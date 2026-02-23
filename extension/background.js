const MENU_ID = "open_tts_read_selection";
const SHARED_KEYS = [
  "voice",
  "speed",
  "volume",
  "downloadFormat",
  "theme",
  "autoPasteClipboard",
  "hotkeys",
];

async function getSettings() {
  const data = await chrome.storage.sync.get({
    serverUrl: "http://localhost:3016",
    mainSiteUrl: "http://localhost:3015",
    theme: "light",
    voice: "",
    speed: 1.0
  });
  const serverUrl = normalizeServerUrl(data.serverUrl || "http://localhost:3016");
  const mainSiteUrl = normalizeUrl(data.mainSiteUrl || deriveMainSiteUrl(serverUrl));
  const remoteSettings = await getRemoteSettings(serverUrl);
  const merged = { ...data, ...remoteSettings, serverUrl, mainSiteUrl };
  const normalizedTheme = String(merged.theme || "light").toLowerCase() === "dark" ? "dark" : "light";
  merged.theme = normalizedTheme;
  if (remoteSettings && Object.keys(remoteSettings).length) {
    await chrome.storage.sync.set({
      theme: merged.theme,
      voice: merged.voice || "",
      speed: Number(merged.speed || 1.0),
      volume: Number(merged.volume ?? 1.0),
      downloadFormat: merged.downloadFormat || "wav",
      autoPasteClipboard: Boolean(merged.autoPasteClipboard),
      hotkeys: merged.hotkeys && typeof merged.hotkeys === "object" ? merged.hotkeys : {},
    });
  }
  return merged;
}

function normalizeUrl(url) {
  return (url || "").trim().replace(/\/$/, "");
}

function normalizeServerUrl(url) {
  return normalizeUrl(url).replace(/\/api$/i, "");
}

function deriveMainSiteUrl(serverUrl) {
  const normalized = normalizeServerUrl(serverUrl);
  if (!normalized) return "http://localhost:3015";
  try {
    const url = new URL(normalized);
    if (url.port === "3016") url.port = "3015";
    return normalizeUrl(url.toString());
  } catch (_err) {
    return "http://localhost:3015";
  }
}

async function getRemoteSettings(serverUrl) {
  const base = normalizeServerUrl(serverUrl);
  const candidates = [`${base}/api/settings`, `${base}/settings`];
  try {
    for (const url of candidates) {
      const res = await fetch(url);
      if (res.status === 404) continue;
      if (!res.ok) return {};
      const data = await res.json();
      return data && typeof data === "object" ? data : {};
    }
    return {};
  } catch (_err) {
    return {};
  }
}

async function putRemoteSettings(serverUrl, nextSettings) {
  const payload = {};
  for (const key of SHARED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(nextSettings, key)) {
      payload[key] = nextSettings[key];
    }
  }
  if (!Object.keys(payload).length) return {};

  const base = normalizeServerUrl(serverUrl);
  const candidates = [`${base}/api/settings`, `${base}/settings`];
  let lastStatus = 0;

  for (const url of candidates) {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 404) {
      lastStatus = res.status;
      continue;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Settings sync failed (${res.status})`);
    }
    const saved = await res.json().catch(() => ({}));
    return saved && typeof saved === "object" ? saved : {};
  }

  throw new Error(`Settings sync failed (${lastStatus || 404})`);
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
        const hasMainSiteUrl = typeof message.mainSiteUrl === "string" && message.mainSiteUrl.trim().length > 0;
        const mainSiteUrl = hasMainSiteUrl
          ? normalizeUrl(message.mainSiteUrl)
          : deriveMainSiteUrl(serverUrl);
        const localToSave = { serverUrl, mainSiteUrl };
        for (const key of SHARED_KEYS) {
          if (Object.prototype.hasOwnProperty.call(message, key)) {
            localToSave[key] = message[key];
          }
        }

        let remoteSaved = {};
        let syncWarning = "";
        try {
          remoteSaved = await putRemoteSettings(serverUrl, localToSave);
        } catch (err) {
          syncWarning = err?.message || "Settings sync failed";
        }
        const merged = {
          ...existing,
          ...localToSave,
          ...remoteSaved,
          serverUrl,
          mainSiteUrl,
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
          mainSiteUrl: merged.mainSiteUrl,
          theme: merged.theme,
          voice: merged.voice || "",
          speed: merged.speed,
          volume: merged.volume,
          downloadFormat: merged.downloadFormat,
          autoPasteClipboard: merged.autoPasteClipboard,
          hotkeys: merged.hotkeys,
        });
        sendResponse({ ok: true, syncWarning, ...merged });
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
