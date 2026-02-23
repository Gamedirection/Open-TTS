const MENU_ID = "open_tts_read_selection";

async function getSettings() {
  const data = await chrome.storage.sync.get({
    serverUrl: "http://localhost:3016",
    mainSiteUrl: "http://localhost:3015"
  });
  return data;
}

function normalizeUrl(url) {
  return (url || "").trim().replace(/\/$/, "");
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

async function synthesize(text, serverUrl) {
  const res = await fetch(`${normalizeUrl(serverUrl)}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Speak failed (${res.status})`);
  }
  const data = await res.json();
  const absoluteAudioUrl = data.audioUrl.startsWith("http")
    ? data.audioUrl
    : `${normalizeUrl(serverUrl)}${data.audioUrl}`;
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
    const { serverUrl } = await getSettings();
    const { audioUrl } = await synthesize(text, serverUrl);
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, {
      type: "open_tts_play_audio",
      audioUrl
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
        const serverUrl = normalizeUrl(message.serverUrl || "http://localhost:3016");
        const mainSiteUrl = normalizeUrl(message.mainSiteUrl || "http://localhost:3015");
        await chrome.storage.sync.set({ serverUrl, mainSiteUrl });
        sendResponse({ ok: true, serverUrl, mainSiteUrl });
        return;
      }
      if (message?.type === "open_tts_speak") {
        const { serverUrl } = await getSettings();
        const text = (message.text || "").trim();
        if (!text) {
          sendResponse({ ok: false, error: "Text is required" });
          return;
        }
        const result = await synthesize(text, serverUrl);
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
