const serverUrlInput = document.getElementById("serverUrlInput");
const textInput = document.getElementById("textInput");
const speakBtn = document.getElementById("speakBtn");
const stopBtn = document.getElementById("stopBtn");
const settingsBtn = document.getElementById("settingsBtn");
const lastEntry = document.getElementById("lastEntry");
const statusEl = document.getElementById("status");

let currentAudio = null;

function status(msg) {
  statusEl.textContent = msg || "";
}

function normalize(url) {
  return (url || "").trim().replace(/\/$/, "");
}

function deriveMainSiteUrl(serverUrl) {
  const normalized = normalize(serverUrl);
  if (!normalized) return "http://localhost:3015";
  try {
    const url = new URL(normalized);
    if (url.port === "3016") url.port = "3015";
    return normalize(url.toString());
  } catch (_err) {
    return "http://localhost:3015";
  }
}

function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
}

async function getSettings() {
  const response = await chrome.runtime.sendMessage({ type: "open_tts_get_settings" });
  if (!response?.ok) throw new Error(response?.error || "Could not load settings");
  return response;
}

async function setSettings(next) {
  const response = await chrome.runtime.sendMessage({ type: "open_tts_set_settings", ...next });
  if (!response?.ok) throw new Error(response?.error || "Could not save settings");
  return response;
}

async function getLastEntry(settings) {
  try {
    const base = normalize(settings.serverUrl || "");
    if (base) {
      const res = await fetch(`${base}/api/history`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        if (items.length) {
          const last = items[items.length - 1];
          return { lastEntry: last.text || "", lastEntryAt: last.createdAt || "" };
        }
      }
    }
  } catch (_err) {
    // fallback to local value
  }
  const local = await chrome.storage.local.get({ lastEntry: "", lastEntryAt: "" });
  return local;
}

async function speak(text) {
  const response = await chrome.runtime.sendMessage({ type: "open_tts_speak", text });
  if (!response?.ok) throw new Error(response?.error || "Speak failed");
  return response;
}

function stopLocalAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

async function stopEverywhere() {
  stopLocalAudio();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "open_tts_stop_audio" });
    } catch (_err) {
      // ignore if content script not available
    }
  }
}

async function playPopupAudio(audioUrl) {
  stopLocalAudio();
  currentAudio = new Audio(audioUrl);
  await currentAudio.play();
}

async function refreshUI() {
  const settings = await getSettings();
  serverUrlInput.value = settings.serverUrl;
  applyTheme(settings.theme);
  const last = await getLastEntry(settings);
  lastEntry.textContent = last.lastEntry || "No entry yet.";
}

serverUrlInput.addEventListener("change", async () => {
  try {
    const serverUrl = normalize(serverUrlInput.value);
    await setSettings({ serverUrl, mainSiteUrl: deriveMainSiteUrl(serverUrl) });
    status("Server saved.");
  } catch (err) {
    status(err.message);
  }
});

speakBtn.addEventListener("click", async () => {
  const text = (textInput.value || "").trim();
  if (!text) return;
  speakBtn.disabled = true;
  status("Generating audio...");
  try {
    const { audioUrl } = await speak(text);
    await playPopupAudio(audioUrl);
    status("Playing.");
    await refreshUI();
  } catch (err) {
    status(`Error: ${err.message}`);
  } finally {
    speakBtn.disabled = false;
  }
});

stopBtn.addEventListener("click", async () => {
  await stopEverywhere();
  status("Stopped.");
});

settingsBtn.addEventListener("click", async () => {
  try {
    const settings = await getSettings();
    const settingsUrl = normalize(settings.mainSiteUrl) || deriveMainSiteUrl(settings.serverUrl);
    const url = new URL(settingsUrl);
    url.searchParams.set("openSettings", "1");
    await chrome.tabs.create({ url: url.toString() });
  } catch (err) {
    status(`Could not open settings: ${err.message}`);
  }
});

textInput.addEventListener("keydown", async (ev) => {
  if (ev.key === "Enter" && !ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
    ev.preventDefault();
    speakBtn.click();
  }
});

refreshUI().catch((err) => status(err.message));
