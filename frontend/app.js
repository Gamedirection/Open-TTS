const STORAGE_KEY = "piper_chat_history_v1";
const SETTINGS_KEY = "piper_chat_settings_v1";
const HOTKEY_DEFAULTS = Object.freeze({
  focusInput: "v",
  stopAudio: "s",
  sendMessage: "enter",
  openSettings: "ctrl+,",
  moveUp: "arrowup",
  moveDown: "arrowdown",
  playFocused: "enter",
  pinFocused: "p",
  deleteFocused: "delete",
});
const HOTKEY_INPUT_IDS = Object.freeze({
  focusInput: "hotkeyFocusInput",
  stopAudio: "hotkeyStopAudio",
  sendMessage: "hotkeySendMessage",
  openSettings: "hotkeyOpenSettings",
  moveUp: "hotkeyMoveUp",
  moveDown: "hotkeyMoveDown",
  playFocused: "hotkeyPlayFocused",
  pinFocused: "hotkeyPinFocused",
  deleteFocused: "hotkeyDeleteFocused",
});

const state = {
  history: [],
  focusedIndex: -1,
  activePlaybackId: null,
  currentAudio: null,
  currentPlaybackAbort: null,
  audioQueue: [],
  queueRunning: false,
  voices: [],
  catalog: [],
  settings: {
    serverUrl: "",
    voice: "",
    speed: 1.0,
    volume: 1.0,
    downloadFormat: "wav",
    theme: "light",
    autoPasteClipboard: false,
    hotkeys: { ...HOTKEY_DEFAULTS },
  },
};

const chatList = document.getElementById("chatList");
const pinnedList = document.getElementById("pinnedList");
const chatForm = document.getElementById("chatForm");
const textInput = document.getElementById("textInput");
const visualizer = document.getElementById("visualizer");
const settingsBtn = document.getElementById("settingsBtn");
const settingsDialog = document.getElementById("settingsDialog");
const settingsForm = document.getElementById("settingsForm");
const serverUrlInput = document.getElementById("serverUrlInput");
const voiceSelect = document.getElementById("voiceSelect");
const speedInput = document.getElementById("speedInput");
const speedValue = document.getElementById("speedValue");
const downloadFormatSelect = document.getElementById("downloadFormatSelect");
const cancelSettings = document.getElementById("cancelSettings");
const darkModeInput = document.getElementById("darkModeInput");
const autoPasteInput = document.getElementById("autoPasteInput");
const modelsList = document.getElementById("modelsList");
const refreshModelsBtn = document.getElementById("refreshModelsBtn");
const testVoiceBtn = document.getElementById("testVoiceBtn");
const loadingIndicator = document.getElementById("loadingIndicator");
const speakButton = chatForm.querySelector("button[type='submit']");
const stopAudioBtn = document.getElementById("stopAudioBtn");
const volumeInput = document.getElementById("volumeInput");
const volumeValue = document.getElementById("volumeValue");
const downloadConfigBtn = document.getElementById("downloadConfigBtn");
const uploadConfigBtn = document.getElementById("uploadConfigBtn");
const configFileInput = document.getElementById("configFileInput");
const deleteAllUnpinnedBtn = document.getElementById("deleteAllUnpinnedBtn");
const deleteAllPinnedBtn = document.getElementById("deleteAllPinnedBtn");
let lastClipboardAutopasteMs = 0;

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadLocalState() {
  try {
    const rawHistory = localStorage.getItem(STORAGE_KEY);
    if (rawHistory) {
      state.history = JSON.parse(rawHistory);
    }
  } catch (err) {
    console.warn("Failed loading history", err);
  }

  try {
    const rawSettings = localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      state.settings = { ...state.settings, ...JSON.parse(rawSettings) };
    }
  } catch (err) {
    console.warn("Failed loading settings", err);
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function setLoading(isLoading) {
  loadingIndicator.classList.toggle("active", isLoading);
  if (speakButton) speakButton.disabled = isLoading;
}

function normalizeVolume(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 1.0;
  return Math.max(0, Math.min(1, n));
}

function updateVolumeLabel() {
  volumeValue.textContent = `${Math.round(normalizeVolume(volumeInput.value) * 100)}%`;
}

function applyVolumeToCurrentAudio() {
  if (state.currentAudio) {
    state.currentAudio.volume = normalizeVolume(state.settings.volume);
  }
}

function clearAudioQueue(reason = "queue cleared") {
  const pending = state.audioQueue.splice(0);
  pending.forEach((item) => item.reject(new Error(reason)));
}

function stopPlayback(clearQueue = true) {
  if (state.currentPlaybackAbort) {
    const abortFn = state.currentPlaybackAbort;
    state.currentPlaybackAbort = null;
    abortFn();
  }
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
    state.currentAudio = null;
  }
  if (clearQueue) clearAudioQueue("playback stopped");
  state.activePlaybackId = null;
  visualizer.classList.remove("active");
  clearWordHighlights();
  setLoading(false);
  render();
}

function enqueueAudioJob(jobFn) {
  return new Promise((resolve, reject) => {
    state.audioQueue.push({ jobFn, resolve, reject });
    processAudioQueue();
  });
}

async function processAudioQueue() {
  if (state.queueRunning) return;
  state.queueRunning = true;
  while (state.audioQueue.length) {
    const item = state.audioQueue.shift();
    try {
      await item.jobFn();
      item.resolve();
    } catch (err) {
      item.reject(err);
    }
  }
  state.queueRunning = false;
}

function normalizeKeyToken(token) {
  const lower = (token || "").trim().toLowerCase();
  if (!lower) return "";
  if (lower === "del") return "delete";
  if (lower === "return") return "enter";
  if (lower === "esc") return "escape";
  if (lower === "spacebar") return "space";
  return lower;
}

function normalizeHotkeyString(raw) {
  const parts = (raw || "")
    .split("+")
    .map((p) => normalizeKeyToken(p))
    .filter(Boolean);
  if (!parts.length) return "";

  const modifiers = new Set();
  let key = "";
  for (const part of parts) {
    if (part === "ctrl" || part === "control") modifiers.add("ctrl");
    else if (part === "alt" || part === "option") modifiers.add("alt");
    else if (part === "shift") modifiers.add("shift");
    else if (part === "meta" || part === "cmd" || part === "command") modifiers.add("meta");
    else key = part;
  }
  if (!key) return "";

  const orderedModifiers = ["ctrl", "alt", "shift", "meta"].filter((m) => modifiers.has(m));
  return [...orderedModifiers, key].join("+");
}

function normalizeHotkeysObject(incoming) {
  const merged = { ...HOTKEY_DEFAULTS, ...(incoming || {}) };
  const normalized = {};
  Object.keys(HOTKEY_DEFAULTS).forEach((action) => {
    normalized[action] = normalizeHotkeyString(merged[action]) || HOTKEY_DEFAULTS[action];
  });
  return normalized;
}

function eventToHotkey(ev) {
  const mods = [];
  if (ev.ctrlKey) mods.push("ctrl");
  if (ev.altKey) mods.push("alt");
  if (ev.shiftKey) mods.push("shift");
  if (ev.metaKey) mods.push("meta");
  let key = ev.key || "";
  if (key === " ") key = "space";
  key = normalizeKeyToken(key);
  if (!key) return "";
  return [...mods, key].join("+");
}

function hotkeyMatches(ev, action) {
  const expected = state.settings.hotkeys?.[action];
  if (!expected) return false;
  return eventToHotkey(ev) === expected;
}

function applyHotkeyInputs() {
  Object.entries(HOTKEY_INPUT_IDS).forEach(([action, id]) => {
    const input = document.getElementById(id);
    if (input) input.value = state.settings.hotkeys[action];
  });
}

function readHotkeysFromInputs() {
  const next = {};
  Object.entries(HOTKEY_INPUT_IDS).forEach(([action, id]) => {
    const input = document.getElementById(id);
    next[action] = normalizeHotkeyString(input?.value || "");
  });
  return normalizeHotkeysObject(next);
}

function getConfigForExport() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      serverUrl: state.settings.serverUrl,
      voice: state.settings.voice,
      speed: state.settings.speed,
      volume: state.settings.volume,
      downloadFormat: state.settings.downloadFormat,
      theme: state.settings.theme,
      autoPasteClipboard: state.settings.autoPasteClipboard,
    },
    hotkeys: state.settings.hotkeys,
  };
}

function downloadConfig() {
  const data = JSON.stringify(getConfigForExport(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const name = `piper-chat-config-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importConfigFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const importedSettings = parsed.settings || {};
  const importedHotkeys = parsed.hotkeys || importedSettings.hotkeys || {};

  state.settings.serverUrl = (importedSettings.serverUrl ?? state.settings.serverUrl ?? "").trim();
  state.settings.voice = importedSettings.voice ?? state.settings.voice;
  state.settings.speed = Number(importedSettings.speed ?? state.settings.speed ?? 1.0);
  state.settings.volume = normalizeVolume(importedSettings.volume ?? state.settings.volume);
  state.settings.downloadFormat = normalizeDownloadFormat(importedSettings.downloadFormat ?? state.settings.downloadFormat);
  state.settings.theme = importedSettings.theme === "dark" ? "dark" : "light";
  state.settings.autoPasteClipboard = Boolean(importedSettings.autoPasteClipboard ?? state.settings.autoPasteClipboard);
  state.settings.hotkeys = normalizeHotkeysObject(importedHotkeys);
  saveSettings();
  applyTheme();

  try {
    await fetchVoices();
  } catch (err) {
    alert(`Config imported, but could not load voices: ${err.message}`);
  }

  renderVoiceOptions();
  renderModels();
  openSettings();
}

function applyTheme() {
  const theme = state.settings.theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
}

async function maybeAutoPasteClipboard() {
  if (!state.settings.autoPasteClipboard) return;
  if (!navigator.clipboard || !navigator.clipboard.readText) return;

  const now = Date.now();
  if (now - lastClipboardAutopasteMs < 800) return;
  if ((textInput.value || "").trim()) return;

  try {
    const clipText = await navigator.clipboard.readText();
    if (!clipText || !clipText.trim()) return;
    textInput.value = clipText;
    lastClipboardAutopasteMs = now;
  } catch (_err) {
    // Clipboard permission failures should not block typing/focus flow.
  }
}

async function focusComposerInput() {
  textInput.focus();
  await maybeAutoPasteClipboard();
}

function getApiBase() {
  return (state.settings.serverUrl || "").trim().replace(/\/$/, "");
}

function normalizeDownloadFormat(value) {
  return ["wav", "mp3", "ogg"].includes(value) ? value : "wav";
}

function absoluteAudioUrl(audioUrl) {
  if (!audioUrl) return "";
  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    return audioUrl;
  }
  return `${getApiBase()}${audioUrl}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleString();
}

function updateSpeedLabel() {
  speedValue.textContent = `${Number(speedInput.value).toFixed(1)}x`;
}

function wordify(text) {
  return text.split(/(\s+)/).filter(Boolean);
}

function renderWordSpans(entry, activeIndex = -1) {
  const words = wordify(entry.text);
  return words
    .map((word, idx) => {
      const cls = idx === activeIndex ? "word active" : "word";
      return `<span class="${cls}">${escapeHtml(word)}</span>`;
    })
    .join("");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitForAudioReady(audio, timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (audio.readyState >= 3) {
      resolve();
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      audio.removeEventListener("canplaythrough", finish);
      audio.removeEventListener("loadeddata", finish);
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);
    audio.addEventListener("canplaythrough", finish, { once: true });
    audio.addEventListener("loadeddata", finish, { once: true });
  });
}

function nonEmptyLines(text) {
  return (text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function render() {
  if (!state.history.length) {
    chatList.innerHTML = `<div class="msg"><div class="msg-text">No messages yet.</div></div>`;
    pinnedList.innerHTML = `<div class="msg"><div class="msg-text">No pinned items.</div></div>`;
    return;
  }

  const rows = state.history
    .map((entry, idx) => {
      const focusedClass = idx === state.focusedIndex ? "active" : "";
      const pinnedClass = entry.pinned ? "pinned" : "";
      return `
      <article class="msg ${focusedClass} ${pinnedClass}" tabindex="0" data-id="${entry.id}">
        <div class="msg-head">
          <span>${formatTime(entry.createdAt)}</span>
          <span>${escapeHtml(entry.voice || "default")} | ${Number(entry.speed || 1).toFixed(1)}x</span>
        </div>
        <div class="msg-text">${renderWordSpans(entry, entry.wordIndex ?? -1)}</div>
        <div class="msg-actions">
          <button data-action="play" data-id="${entry.id}">Play</button>
          <button data-action="download" data-id="${entry.id}">Download</button>
          <button data-action="pin" data-id="${entry.id}">${entry.pinned ? "Unpin" : "Pin"}</button>
          <button data-action="delete" data-id="${entry.id}">Delete</button>
        </div>
      </article>`;
    })
    .join("");

  chatList.innerHTML = rows;

  const pinned = state.history.filter((h) => h.pinned);
  pinnedList.innerHTML = pinned.length
    ? pinned
        .map(
          (entry) => `
      <article class="msg pinned" tabindex="0" data-id="${entry.id}">
        <div class="msg-head"><span>${formatTime(entry.createdAt)}</span></div>
        <div class="msg-text">${escapeHtml(entry.text)}</div>
      </article>`
        )
        .join("")
    : `<div class="msg"><div class="msg-text">No pinned items.</div></div>`;
}

function entryById(id) {
  return state.history.find((entry) => entry.id === id);
}

function indexById(id) {
  return state.history.findIndex((entry) => entry.id === id);
}

async function fetchVoices() {
  const res = await fetch(`${getApiBase()}/api/voices`);
  if (!res.ok) {
    throw new Error(`Voices request failed (${res.status})`);
  }
  const data = await res.json();
  state.voices = data.voices || [];
  state.catalog = data.catalog || [];
  const available = new Set(state.voices.map((v) => v.id));
  if (!state.settings.voice || !available.has(state.settings.voice)) {
    state.settings.voice = data.default || state.voices[0]?.id || "";
  }
  saveSettings();
}

function renderVoiceOptions() {
  const options = state.voices
    .map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.label)}</option>`)
    .join("");
  voiceSelect.innerHTML = options || '<option value="">No voices found</option>';
  voiceSelect.value = state.settings.voice;
}

function renderModels() {
  if (!state.catalog.length) {
    modelsList.innerHTML = `<div class="model-item"><small>No catalog available.</small></div>`;
    return;
  }

  modelsList.innerHTML = state.catalog
    .map((model) => {
      const status = model.installed ? "Installed" : "Not installed";
      const buttonLabel = model.installed ? "Uninstall" : "Install";
      const disabled = model.isDefault ? "disabled" : "";
      return `
      <div class="model-item">
        <div>
          <div>${escapeHtml(model.label)}</div>
          <small>${escapeHtml(model.id)} - ${status}${model.isDefault ? " (default)" : ""}</small>
        </div>
        <button type="button" data-model-action="${model.installed ? "uninstall" : "install"}" data-model-id="${escapeHtml(model.id)}" ${disabled}>${buttonLabel}</button>
      </div>`;
    })
    .join("");
}

async function installVoiceModel(voiceId) {
  const res = await fetch(`${getApiBase()}/api/voices/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice: voiceId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Install failed (${res.status})`);
  }
}

async function uninstallVoiceModel(voiceId) {
  const res = await fetch(`${getApiBase()}/api/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Uninstall failed (${res.status})`);
  }
}

async function playSettingsVoiceSampleNow() {
  const previewVoice = voiceSelect.value || state.settings.voice;
  const previewSpeed = Number(speedInput.value || state.settings.speed || 1);
  const sampleText = "This is a voice test. The quick brown fox jumps over the lazy dog.";

  setLoading(true);
  try {
    const res = await fetch(`${getApiBase()}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: sampleText,
        voice: previewVoice,
        speed: previewSpeed,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Voice test failed (${res.status})`);
    }

    const data = await res.json();
    const audio = new Audio(absoluteAudioUrl(data.audioUrl));
    audio.volume = normalizeVolume(state.settings.volume);
    state.currentAudio = audio;
    await waitForAudioReady(audio);
    await sleep(140);
    visualizer.classList.add("active");

    const onDone = () => {
      visualizer.classList.remove("active");
      if (state.currentAudio === audio) state.currentAudio = null;
    };

    await new Promise((resolve, reject) => {
      state.currentPlaybackAbort = () => resolve();
      audio.addEventListener(
        "ended",
        () => {
          state.currentPlaybackAbort = null;
          onDone();
          resolve();
        },
        { once: true }
      );
      audio.addEventListener(
        "error",
        () => {
          state.currentPlaybackAbort = null;
          onDone();
          reject(new Error("voice test playback failed"));
        },
        { once: true }
      );
      audio.play().catch(reject);
    });
  } finally {
    setLoading(false);
  }
}

async function playSettingsVoiceSample() {
  return enqueueAudioJob(async () => {
    await playSettingsVoiceSampleNow();
  });
}

async function synthesize(entry) {
  return synthesizeText(entry.text, entry);
}

async function synthesizeText(text, entry) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(`${getApiBase()}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: entry.voice,
        speed: entry.speed,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const absoluteUrl = absoluteAudioUrl(data.audioUrl);
      entry.audioUrl = absoluteUrl;
      entry.voice = data.voice || entry.voice;
      return absoluteUrl;
    }

    const body = await res.json().catch(() => ({}));
    lastError = new Error(body.error || `Speak request failed (${res.status})`);
    if (attempt === 0 && /voice not found/i.test(lastError.message)) {
      await fetchVoices();
      entry.voice = state.settings.voice;
      continue;
    }
  }

  throw lastError || new Error("Speak request failed");
}

function clearWordHighlights() {
  state.history.forEach((item) => {
    delete item.wordIndex;
  });
}

function setFocusedIndex(index) {
  if (!state.history.length) {
    state.focusedIndex = -1;
    render();
    return;
  }

  state.focusedIndex = Math.max(0, Math.min(index, state.history.length - 1));
  render();

  const target = chatList.querySelector(`article[data-id="${state.history[state.focusedIndex].id}"]`);
  if (target) target.focus();
}

async function playEntryNow(id) {
  const entry = entryById(id);
  if (!entry) return;

  setLoading(true);
  try {
    const lines = nonEmptyLines(entry.text);
    const shouldUseSegments = lines.length > 1;

    if (shouldUseSegments) {
      entry.segmentAudioUrls = [];
      for (let i = 0; i < lines.length; i += 1) {
        const lineText = lines[i];
        const segmentUrl = await synthesizeText(lineText, entry);
        entry.segmentAudioUrls.push(segmentUrl);
      }
      saveHistory();
      render();

      const totalWords = lines.reduce((sum, line) => sum + wordify(line).length, 0);
      let consumedWords = 0;
      for (let i = 0; i < entry.segmentAudioUrls.length; i += 1) {
        const segmentUrl = entry.segmentAudioUrls[i];
        const lineWords = wordify(lines[i]);
        const audio = new Audio(segmentUrl);
        audio.volume = normalizeVolume(state.settings.volume);
        state.currentAudio = audio;
        state.activePlaybackId = id;
        await waitForAudioReady(audio);
        await sleep(140);
        visualizer.classList.add("active");

        let interval = 0.2;
        audio.addEventListener("loadedmetadata", () => {
          if (audio.duration && lineWords.length) interval = audio.duration / lineWords.length;
        });
        audio.addEventListener("timeupdate", () => {
          if (!lineWords.length || !totalWords) return;
          const localIdx = Math.min(lineWords.length - 1, Math.floor(audio.currentTime / interval));
          entry.wordIndex = Math.min(totalWords - 1, consumedWords + localIdx);
          render();
        });
        await new Promise((resolve, reject) => {
          state.currentPlaybackAbort = () => resolve();
          audio.addEventListener("ended", resolve, { once: true });
          audio.addEventListener("error", () => reject(new Error("audio playback failed")), { once: true });
          audio.play().catch(reject);
        });
        state.currentPlaybackAbort = null;
        consumedWords += lineWords.length;
      }
      visualizer.classList.remove("active");
      state.activePlaybackId = null;
      clearWordHighlights();
      render();
      return;
    }

    if (!entry.audioUrl) {
      await synthesize(entry);
      saveHistory();
    }

    const audio = new Audio(entry.audioUrl);
    audio.volume = normalizeVolume(state.settings.volume);
    state.currentAudio = audio;
    state.activePlaybackId = id;
    await waitForAudioReady(audio);
    await sleep(140);
    visualizer.classList.add("active");

    let words = wordify(entry.text);
    let interval = 0.2;

    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && words.length) {
        interval = audio.duration / words.length;
      }
    });

    audio.addEventListener("timeupdate", () => {
      if (!words.length) return;
      const idx = Math.min(words.length - 1, Math.floor(audio.currentTime / interval));
      entry.wordIndex = idx;
      render();
    });

    let doneResolved = false;
    let resolveDone;
    const donePromise = new Promise((resolve) => {
      resolveDone = resolve;
    });

    const onDone = () => {
      visualizer.classList.remove("active");
      state.activePlaybackId = null;
      clearWordHighlights();
      render();
      if (!doneResolved) {
        doneResolved = true;
        resolveDone();
      }
    };
    state.currentPlaybackAbort = () => {
      onDone();
    };

    audio.addEventListener("ended", onDone);
    audio.addEventListener("error", onDone);

    await audio.play();
    await donePromise;
    state.currentPlaybackAbort = null;
  } catch (err) {
    state.currentPlaybackAbort = null;
    visualizer.classList.remove("active");
    state.activePlaybackId = null;
    clearWordHighlights();
    render();
    throw err;
  } finally {
    setLoading(false);
  }
}

async function playEntry(id) {
  return enqueueAudioJob(async () => {
    await playEntryNow(id);
  });
}

function safeDownloadName(entry, format) {
  const date = new Date(entry.createdAt || Date.now()).toISOString().replace(/[:.]/g, "-");
  const voice = (entry.voice || "voice").replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `piper-${voice}-${date}.${format}`;
}

function extractAudioFilename(audioUrl) {
  if (!audioUrl) return "";
  const parsed = new URL(audioUrl, window.location.origin);
  const parts = parsed.pathname.split("/");
  const file = parts[parts.length - 1] || "";
  return file.endsWith(".wav") ? file : "";
}

async function downloadEntry(id) {
  const entry = entryById(id);
  if (!entry) return;
  const format = normalizeDownloadFormat(state.settings.downloadFormat);

  setLoading(true);
  try {
    if (!entry.audioUrl) {
      await synthesize(entry);
      saveHistory();
      render();
    }

    const filename = extractAudioFilename(entry.audioUrl);
    if (!filename) {
      throw new Error("invalid audio URL");
    }

    const response = await fetch(
      `${getApiBase()}/api/download/${encodeURIComponent(filename)}?format=${encodeURIComponent(format)}`
    );
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = safeDownloadName(entry, format);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } finally {
    setLoading(false);
  }
}

function togglePin(id) {
  const entry = entryById(id);
  if (!entry) return;
  entry.pinned = !entry.pinned;
  saveHistory();
  render();
}

function deleteEntry(id) {
  const entry = entryById(id);
  if (!entry || entry.pinned) return;
  state.history = state.history.filter((item) => item.id !== id);
  if (state.focusedIndex >= state.history.length) {
    state.focusedIndex = state.history.length - 1;
  }
  saveHistory();
  render();
}

function deleteAllByPinnedState(shouldDeletePinned) {
  const targetCount = state.history.filter((item) => Boolean(item.pinned) === shouldDeletePinned).length;
  if (!targetCount) return;

  const label = shouldDeletePinned ? "pinned" : "unpinned";
  const ok = window.confirm(`Delete all ${label} messages? This cannot be undone.`);
  if (!ok) return;

  stopPlayback();
  state.history = state.history.filter((item) => Boolean(item.pinned) !== shouldDeletePinned);
  if (state.focusedIndex >= state.history.length) {
    state.focusedIndex = state.history.length - 1;
  }
  saveHistory();
  render();
}

async function submitText(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const entry = {
    id: uid(),
    text: trimmed,
    pinned: false,
    createdAt: nowIso(),
    voice: state.settings.voice,
    speed: state.settings.speed,
    audioUrl: "",
  };

  state.history.push(entry);
  saveHistory();
  render();
  setFocusedIndex(state.history.length - 1);

  try {
    await playEntry(entry.id);
  } catch (err) {
    alert(`Failed to generate audio: ${err.message}`);
  }
}

function bindEvents() {
  chatForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const text = textInput.value;
    textInput.value = "";
    await submitText(text);
    textInput.focus();
  });

  textInput.addEventListener("keydown", async (ev) => {
    if (ev.key === "Enter" && ev.ctrlKey) {
      ev.preventDefault();
      const start = textInput.selectionStart ?? textInput.value.length;
      const end = textInput.selectionEnd ?? textInput.value.length;
      const next = `${textInput.value.slice(0, start)}\n${textInput.value.slice(end)}`;
      textInput.value = next;
      textInput.selectionStart = start + 1;
      textInput.selectionEnd = start + 1;
      return;
    }

    if (ev.key === "Enter" && !ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
      ev.preventDefault();
      const text = textInput.value;
      textInput.value = "";
      await submitText(text);
      return;
    }

    if (hotkeyMatches(ev, "sendMessage")) {
      ev.preventDefault();
      const text = textInput.value;
      textInput.value = "";
      await submitText(text);
    }
  });

  chatList.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-action]");
    const row = ev.target.closest("article[data-id]");
    if (row) {
      const idx = indexById(row.dataset.id);
      if (idx >= 0) state.focusedIndex = idx;
    }

    if (!btn) {
      if (row) await playEntry(row.dataset.id);
      render();
      return;
    }

    const id = btn.dataset.id;
    if (btn.dataset.action === "play") await playEntry(id);
    if (btn.dataset.action === "download") await downloadEntry(id);
    if (btn.dataset.action === "pin") togglePin(id);
    if (btn.dataset.action === "delete") deleteEntry(id);
  });

  pinnedList.addEventListener("click", async (ev) => {
    const row = ev.target.closest("article[data-id]");
    if (!row) return;
    await playEntry(row.dataset.id);
  });

  chatList.addEventListener("contextmenu", (ev) => {
    const row = ev.target.closest("article[data-id]");
    if (!row) return;
    ev.preventDefault();
    togglePin(row.dataset.id);
  });

  document.addEventListener("keydown", async (ev) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const hasComposerText = Boolean((textInput.value || "").trim());

    if (hotkeyMatches(ev, "focusInput")) {
      if (tag !== "textarea" && tag !== "input" && tag !== "select") {
        ev.preventDefault();
        await focusComposerInput();
      }
      return;
    }

    if (ev.key === "Escape") {
      if (settingsDialog.open) settingsDialog.close();
      stopPlayback();
      return;
    }

    if (hotkeyMatches(ev, "openSettings")) {
      ev.preventDefault();
      openSettings();
      return;
    }

    if (hotkeyMatches(ev, "stopAudio") && tag !== "textarea" && tag !== "input" && tag !== "select") {
      ev.preventDefault();
      stopPlayback();
      return;
    }

    if (
      hotkeyMatches(ev, "moveUp") ||
      hotkeyMatches(ev, "moveDown") ||
      hotkeyMatches(ev, "playFocused") ||
      hotkeyMatches(ev, "deleteFocused") ||
      hotkeyMatches(ev, "pinFocused")
    ) {
      if (tag === "textarea" || tag === "input" || tag === "select") return;
    }

    if (hotkeyMatches(ev, "moveUp")) {
      ev.preventDefault();
      setFocusedIndex((state.focusedIndex < 0 ? state.history.length : state.focusedIndex) - 1);
    }

    if (hotkeyMatches(ev, "moveDown")) {
      ev.preventDefault();
      setFocusedIndex(state.focusedIndex + 1);
    }

    if (hotkeyMatches(ev, "playFocused") && state.focusedIndex >= 0) {
      if (hasComposerText) {
        ev.preventDefault();
        const text = textInput.value;
        textInput.value = "";
        await submitText(text);
        return;
      }
      ev.preventDefault();
      await playEntry(state.history[state.focusedIndex].id);
    }

    if (hotkeyMatches(ev, "pinFocused") && state.focusedIndex >= 0) {
      ev.preventDefault();
      togglePin(state.history[state.focusedIndex].id);
    }

    if (hotkeyMatches(ev, "deleteFocused") && state.focusedIndex >= 0) {
      ev.preventDefault();
      deleteEntry(state.history[state.focusedIndex].id);
    }
  });

  settingsBtn.addEventListener("click", openSettings);
  cancelSettings.addEventListener("click", () => settingsDialog.close());
  settingsDialog.addEventListener("cancel", (ev) => {
    ev.preventDefault();
    settingsDialog.close();
  });
  stopAudioBtn.addEventListener("click", stopPlayback);
  volumeInput.addEventListener("input", () => {
    state.settings.volume = normalizeVolume(volumeInput.value);
    updateVolumeLabel();
    applyVolumeToCurrentAudio();
  });
  volumeInput.addEventListener("change", () => {
    saveSettings();
  });
  downloadConfigBtn.addEventListener("click", downloadConfig);
  uploadConfigBtn.addEventListener("click", () => configFileInput.click());
  configFileInput.addEventListener("change", async () => {
    const file = configFileInput.files?.[0];
    if (!file) return;
    try {
      await importConfigFile(file);
      alert("Config imported.");
    } catch (err) {
      alert(`Could not import config: ${err.message}`);
    } finally {
      configFileInput.value = "";
    }
  });
  textInput.addEventListener("focus", () => {
    maybeAutoPasteClipboard();
  });
  deleteAllUnpinnedBtn.addEventListener("click", () => {
    deleteAllByPinnedState(false);
  });
  deleteAllPinnedBtn.addEventListener("click", () => {
    deleteAllByPinnedState(true);
  });

  speedInput.addEventListener("input", updateSpeedLabel);
  refreshModelsBtn.addEventListener("click", async () => {
    try {
      await fetchVoices();
      renderVoiceOptions();
      renderModels();
    } catch (err) {
      alert(`Could not refresh models: ${err.message}`);
    }
  });

  modelsList.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-model-action]");
    if (!btn) return;

    const action = btn.dataset.modelAction;
    const modelId = btn.dataset.modelId;
    btn.disabled = true;
    try {
      if (action === "install") {
        await installVoiceModel(modelId);
      } else if (action === "uninstall") {
        await uninstallVoiceModel(modelId);
      }
      await fetchVoices();
      renderVoiceOptions();
      renderModels();
    } catch (err) {
      alert(`Model operation failed: ${err.message}`);
      btn.disabled = false;
    }
  });

  testVoiceBtn.addEventListener("click", async () => {
    testVoiceBtn.disabled = true;
    try {
      await playSettingsVoiceSample();
    } catch (err) {
      alert(`Could not play voice test: ${err.message}`);
    } finally {
      testVoiceBtn.disabled = false;
    }
  });

  settingsForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    state.settings.serverUrl = (serverUrlInput.value || "").trim().replace(/\/$/, "");
    state.settings.voice = voiceSelect.value;
    state.settings.speed = Number(speedInput.value);
    state.settings.downloadFormat = normalizeDownloadFormat(downloadFormatSelect.value);
    state.settings.theme = darkModeInput.checked ? "dark" : "light";
    state.settings.autoPasteClipboard = autoPasteInput.checked;
    state.settings.hotkeys = readHotkeysFromInputs();
    saveSettings();
    applyTheme();

    try {
      await fetchVoices();
    } catch (err) {
      alert(`Could not fetch voices from server: ${err.message}`);
    }

    settingsDialog.close();
    renderVoiceOptions();
    renderModels();
  });
}

function openSettings() {
  serverUrlInput.value = state.settings.serverUrl;
  speedInput.value = String(state.settings.speed);
  downloadFormatSelect.value = normalizeDownloadFormat(state.settings.downloadFormat);
  darkModeInput.checked = state.settings.theme === "dark";
  autoPasteInput.checked = Boolean(state.settings.autoPasteClipboard);
  applyHotkeyInputs();
  updateSpeedLabel();
  renderVoiceOptions();
  renderModels();
  settingsDialog.showModal();
}

async function init() {
  loadLocalState();
  if (state.settings.theme !== "dark" && state.settings.theme !== "light") {
    state.settings.theme = "light";
  }
  state.settings.downloadFormat = normalizeDownloadFormat(state.settings.downloadFormat);
  state.settings.volume = normalizeVolume(state.settings.volume);
  state.settings.autoPasteClipboard = Boolean(state.settings.autoPasteClipboard);
  state.settings.hotkeys = normalizeHotkeysObject(state.settings.hotkeys);
  applyTheme();
  bindEvents();

  serverUrlInput.value = state.settings.serverUrl;
  speedInput.value = String(state.settings.speed);
  volumeInput.value = String(state.settings.volume);
  updateVolumeLabel();
  updateSpeedLabel();

  try {
    await fetchVoices();
  } catch (err) {
    alert(`Voice loading failed: ${err.message}`);
  }

  renderVoiceOptions();
  renderModels();
  render();
  textInput.focus();
  textInput.select();
}

init();
