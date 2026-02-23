const MENU_ID = "open_tts_read_selection";
const SHARED_KEYS = ["voice", "speed", "volume", "downloadFormat", "theme", "autoPasteClipboard", "hotkeys"];

async function getSettings() {
  const data = await chrome.storage.sync.get({
    serverUrl: "http://localhost:3016",
    theme: "dark",
    voice: "",
    speed: 1.0,
    volume: 1.0,
    downloadFormat: "wav",
    autoPasteClipboard: false,
    hotkeys: {},
  });
  const serverUrl = normalizeServerUrl(data.serverUrl || "http://localhost:3016");
  return {
    ...data,
    serverUrl,
    theme: String(data.theme || "light").toLowerCase() === "dark" ? "dark" : "light",
    voice: data.voice || "",
    speed: Number(data.speed || 1.0),
    volume: Number(data.volume ?? 1.0),
    downloadFormat: ["wav", "mp3", "ogg"].includes(String(data.downloadFormat || "").toLowerCase())
      ? String(data.downloadFormat).toLowerCase()
      : "wav",
    autoPasteClipboard: Boolean(data.autoPasteClipboard),
    hotkeys: data.hotkeys && typeof data.hotkeys === "object" ? data.hotkeys : {},
  };
}

function normalizeUrl(url) {
  return (url || "").trim().replace(/\/$/, "");
}

function normalizeServerUrl(url) {
  return normalizeUrl(url).replace(/\/api$/i, "");
}

async function appendHistory(serverUrl, entry) {
  try {
    await fetch(`${normalizeServerUrl(serverUrl)}/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    });
  } catch (_err) {
    // non-fatal; local last-entry still updates
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "open_tts_ping" });
    return;
  } catch (_err) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  }
}

async function synthesize(text, serverUrl, voice, speed) {
  const res = await fetch(`${normalizeServerUrl(serverUrl)}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, speed })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Speak failed (${res.status})`);
  }
  const data = await res.json();
  const absoluteAudioUrl = data.audioUrl.startsWith("http")
    ? data.audioUrl
    : `${normalizeServerUrl(serverUrl)}${data.audioUrl}`;
  return { audioUrl: absoluteAudioUrl };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Read selected text with Open-TTS",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = (info.selectionText || "").trim();
  if (!text || !tab?.id) return;

  try {
    const settings = await getSettings();
    const { audioUrl } = await synthesize(text, settings.serverUrl, settings.voice, settings.speed);
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, {
      type: "open_tts_play_audio",
      audioUrl
    });
    await appendHistory(settings.serverUrl, {
      text,
      createdAt: new Date().toISOString(),
      voice: settings.voice || "",
      speed: Number(settings.speed || 1),
      audioUrl,
      pinned: false
    });
    await chrome.storage.local.set({
      lastEntry: text,
      lastEntryAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Open-TTS context menu playback failed", err);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "open_tts_get_settings") {
        sendResponse({ ok: true, ...(await getSettings()) });
        return;
      }
      if (message?.type === "open_tts_set_settings") {
        const existing = await getSettings();
        const serverUrl = normalizeServerUrl(message.serverUrl || existing.serverUrl || "http://localhost:3016");
        const localToSave = { serverUrl };
        for (const key of SHARED_KEYS) {
          if (Object.prototype.hasOwnProperty.call(message, key)) {
            localToSave[key] = message[key];
          }
        }

        const merged = {
          ...existing,
          ...localToSave,
          serverUrl,
        };
        merged.theme = String(merged.theme || "light").toLowerCase() === "dark" ? "dark" : "light";
        merged.speed = Number(merged.speed || 1.0);
        merged.volume = Number(merged.volume ?? 1.0);
        merged.downloadFormat = ["wav", "mp3", "ogg"].includes(String(merged.downloadFormat || "").toLowerCase())
          ? String(merged.downloadFormat).toLowerCase()
          : "wav";
        merged.autoPasteClipboard = Boolean(merged.autoPasteClipboard);
        merged.hotkeys = merged.hotkeys && typeof merged.hotkeys === "object" ? merged.hotkeys : {};

        await chrome.storage.sync.set({
          serverUrl: merged.serverUrl,
          theme: merged.theme,
          voice: merged.voice || "",
          speed: merged.speed,
          volume: merged.volume,
          downloadFormat: merged.downloadFormat,
          autoPasteClipboard: merged.autoPasteClipboard,
          hotkeys: merged.hotkeys,
        });
        sendResponse({ ok: true, ...merged });
        return;
      }
      if (message?.type === "open_tts_speak") {
        const settings = await getSettings();
        const text = (message.text || "").trim();
        if (!text) {
          sendResponse({ ok: false, error: "Text is required" });
          return;
        }
        const result = await synthesize(text, settings.serverUrl, settings.voice, settings.speed);
        await appendHistory(settings.serverUrl, {
          text,
          createdAt: new Date().toISOString(),
          voice: settings.voice || "",
          speed: Number(settings.speed || 1),
          audioUrl: result.audioUrl,
          pinned: false
        });
        await chrome.storage.local.set({
          lastEntry: text,
          lastEntryAt: new Date().toISOString()
        });
        sendResponse({ ok: true, ...result });
        return;
      }
      sendResponse({ ok: false, error: "Unknown message" });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();
  return true;
});
