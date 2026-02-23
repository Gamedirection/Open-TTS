const serverUrlInput = document.getElementById("serverUrlInput");
const textInput = document.getElementById("textInput");
const speakBtn = document.getElementById("speakBtn");
const stopBtn = document.getElementById("stopBtn");
const settingsBtn = document.getElementById("settingsBtn");
const lastEntry = document.getElementById("lastEntry");
const statusEl = document.getElementById("status");
const settingsPanel = document.getElementById("settingsPanel");
const mainSiteUrlInput = document.getElementById("mainSiteUrlInput");
const voiceSelect = document.getElementById("voiceSelect");
const speedInput = document.getElementById("speedInput");
const volumeInput = document.getElementById("volumeInput");
const downloadFormatInput = document.getElementById("downloadFormatInput");
const themeInput = document.getElementById("themeInput");
const autoPasteInput = document.getElementById("autoPasteInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const testVoiceBtn = document.getElementById("testVoiceBtn");
const downloadConfigBtn = document.getElementById("downloadConfigBtn");
const uploadConfigBtn = document.getElementById("uploadConfigBtn");
const configFileInput = document.getElementById("configFileInput");

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
  if (mainSiteUrlInput) mainSiteUrlInput.value = settings.mainSiteUrl || deriveMainSiteUrl(settings.serverUrl);
  if (speedInput) speedInput.value = String(Number(settings.speed || 1.0));
  if (volumeInput) volumeInput.value = String(Number(settings.volume ?? 1.0));
  if (downloadFormatInput) downloadFormatInput.value = ["wav", "mp3", "ogg"].includes(settings.downloadFormat) ? settings.downloadFormat : "wav";
  if (themeInput) themeInput.value = settings.theme === "dark" ? "dark" : "light";
  if (autoPasteInput) autoPasteInput.checked = Boolean(settings.autoPasteClipboard);

  try {
    const res = await fetch(`${normalize(settings.serverUrl)}/api/voices`);
    if (res.ok) {
      const data = await res.json();
      const voices = Array.isArray(data.voices) ? data.voices : [];
      voiceSelect.innerHTML = voices
        .map((v) => `<option value="${v.id}">${v.label || v.id}</option>`)
        .join("");
      const preferredVoice = settings.voice || data.default || voices[0]?.id || "";
      voiceSelect.value = preferredVoice;
    }
  } catch (_err) {
    // ignore voice-list errors in popup UI
  }

  const last = await getLastEntry(settings);
  lastEntry.textContent = last.lastEntry || "No entry yet.";
}

async function saveSettingsFromInputs() {
  const serverUrl = normalize(serverUrlInput.value);
  const mainSiteUrl = normalize(mainSiteUrlInput?.value) || deriveMainSiteUrl(serverUrl);
  const voice = voiceSelect?.value || "";
  const speed = Number(speedInput?.value || 1);
  const volume = Number(volumeInput?.value ?? 1);
  const downloadFormat = ["wav", "mp3", "ogg"].includes(downloadFormatInput?.value) ? downloadFormatInput.value : "wav";
  const theme = themeInput?.value === "dark" ? "dark" : "light";
  const autoPasteClipboard = Boolean(autoPasteInput?.checked);

  const saved = await setSettings({
    serverUrl,
    mainSiteUrl,
    voice,
    speed,
    volume,
    downloadFormat,
    theme,
    autoPasteClipboard,
  });
  applyTheme(saved.theme);
  await refreshUI();
  return saved;
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
  if (!settingsPanel) {
    try {
      const settings = await getSettings();
      const settingsUrl = normalize(settings.mainSiteUrl) || deriveMainSiteUrl(settings.serverUrl);
      const url = new URL(settingsUrl);
      url.searchParams.set("openSettings", "1");
      await chrome.tabs.create({ url: url.toString() });
    } catch (err) {
      status(`Could not open settings: ${err.message}`);
    }
    return;
  }

  settingsPanel.classList.toggle("open");
  if (settingsPanel.classList.contains("open")) {
    try {
      await refreshUI();
      status("Settings loaded.");
    } catch (err) {
      status(`Could not open settings: ${err.message}`);
    }
  }
});

textInput.addEventListener("keydown", async (ev) => {
  if (ev.key === "Enter" && !ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
    ev.preventDefault();
    speakBtn.click();
  }
});

saveSettingsBtn?.addEventListener("click", async (ev) => {
  ev.preventDefault();
  try {
    await saveSettingsFromInputs();
    status("Settings synced.");
  } catch (err) {
    status(`Could not save settings: ${err.message}`);
  }
});

testVoiceBtn?.addEventListener("click", async (ev) => {
  ev.preventDefault();
  const sample = "This is a voice test from Open-TTS extension.";
  testVoiceBtn.disabled = true;
  status("Testing voice...");
  try {
    await saveSettingsFromInputs();
    const { audioUrl } = await speak(sample);
    await playPopupAudio(audioUrl);
    status("Voice test playing.");
  } catch (err) {
    status(`Voice test failed: ${err.message}`);
  } finally {
    testVoiceBtn.disabled = false;
  }
});

downloadConfigBtn?.addEventListener("click", async (ev) => {
  ev.preventDefault();
  try {
    const settings = await getSettings();
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        serverUrl: settings.serverUrl || "",
        mainSiteUrl: settings.mainSiteUrl || "",
        voice: settings.voice || "",
        speed: Number(settings.speed || 1),
        volume: Number(settings.volume ?? 1),
        downloadFormat: settings.downloadFormat || "wav",
        theme: settings.theme === "dark" ? "dark" : "light",
        autoPasteClipboard: Boolean(settings.autoPasteClipboard),
      },
      hotkeys: settings.hotkeys || {},
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `open-tts-extension-config-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    status("Config downloaded.");
  } catch (err) {
    status(`Download failed: ${err.message}`);
  }
});

uploadConfigBtn?.addEventListener("click", (ev) => {
  ev.preventDefault();
  configFileInput?.click();
});

configFileInput?.addEventListener("change", async () => {
  const file = configFileInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = parsed.settings || {};
    const serverUrl = normalize(imported.serverUrl || serverUrlInput.value || "");
    const mainSiteUrl = normalize(imported.mainSiteUrl || mainSiteUrlInput?.value || deriveMainSiteUrl(serverUrl));
    const voice = String(imported.voice || "");
    const speed = Number(imported.speed ?? 1);
    const volume = Number(imported.volume ?? 1);
    const downloadFormat = ["wav", "mp3", "ogg"].includes(imported.downloadFormat) ? imported.downloadFormat : "wav";
    const theme = imported.theme === "dark" ? "dark" : "light";
    const autoPasteClipboard = Boolean(imported.autoPasteClipboard);
    const hotkeys = parsed.hotkeys && typeof parsed.hotkeys === "object" ? parsed.hotkeys : {};

    await setSettings({
      serverUrl,
      mainSiteUrl,
      voice,
      speed,
      volume,
      downloadFormat,
      theme,
      autoPasteClipboard,
      hotkeys,
    });
    await refreshUI();
    status("Config uploaded and synced.");
  } catch (err) {
    status(`Could not import config: ${err.message}`);
  } finally {
    configFileInput.value = "";
  }
});

refreshUI().catch((err) => status(err.message));
