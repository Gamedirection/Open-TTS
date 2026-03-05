const STORAGE_KEY = "piper_chat_history_v1";
const SETTINGS_KEY = "piper_chat_settings_v1";
const SETTINGS_COLLAPSE_KEY = "piper_chat_settings_collapsed_v1";
const API_CLIENT_ID_KEY = "open_tts_client_id_v1";
const API_CLIENT_ID_HEADER = "X-OpenTTS-Client";
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
const DEFAULT_SPEAKER_COUNT = 4;
const VOICE_SWITCH_PAUSE_MS = 280;
const DEFAULT_MAIN_VOICE = "en_US-ryan-high";
const DEFAULT_NARRATOR_VOICE = "en_GB-alan-medium";
const DEFAULT_MALE_VOICE = "en_US-ryan-high";
const DEFAULT_FEMALE_VOICE = "en_US-amy-medium";
const MIN_SYNTH_PREPEND_SILENCE_MS = 350;
const DEFAULT_SPEAKER_COLORS = Object.freeze({
  narrator: "#ffffff",
  male: "#8ec5ff",
  female: "#ff9ecf",
  speaker1: "#f59e0b",
  speaker2: "#ef4444",
  speaker3: "#a855f7",
  speaker4: "#22c55e",
});
const DIALOG_COMMAND_DEFAULTS = Object.freeze([
  { alias: "m", target: "male" },
  { alias: "male", target: "male" },
  { alias: "he", target: "male" },
  { alias: "he said", target: "male" },
  { alias: "f", target: "female" },
  { alias: "female", target: "female" },
  { alias: "she", target: "female" },
  { alias: "she said", target: "female" },
  { alias: "n", target: "narrator" },
  { alias: "narrator", target: "narrator" },
  { alias: "speaker 1", target: "speaker1" },
  { alias: "s1", target: "speaker1" },
  { alias: "speaker 2", target: "speaker2" },
  { alias: "s2", target: "speaker2" },
  { alias: "speaker 3", target: "speaker3" },
  { alias: "s3", target: "speaker3" },
  { alias: "speaker 4", target: "speaker4" },
  { alias: "s4", target: "speaker4" },
]);

function defaultSpeakerProfiles() {
  return Array.from({ length: DEFAULT_SPEAKER_COUNT }, (_v, idx) => ({
    id: `spk-${idx + 1}`,
    name: `Speaker ${idx + 1}`,
    voice: "",
  }));
}

function defaultDialogCommands() {
  return DIALOG_COMMAND_DEFAULTS.map((item) => ({ ...item }));
}

const state = {
  history: [],
  focusedIndex: -1,
  activePlaybackId: null,
  currentAudio: null,
  currentPlaybackAbort: null,
  playbackAbortMode: "",
  playbackToken: 0,
  segmentedPlaybackActive: false,
  audioQueue: [],
  queueRunning: false,
  voices: [],
  catalog: [],
  settings: {
    serverUrl: "",
    voice: DEFAULT_MAIN_VOICE,
    speed: 1.0,
    prependSilenceMs: 250,
    volume: 1.0,
    downloadFormat: "wav",
    theme: "dark",
    autoPasteClipboard: false,
    hotkeys: { ...HOTKEY_DEFAULTS },
    dialogueVoices: {
      narrator: DEFAULT_NARRATOR_VOICE,
      male: DEFAULT_MALE_VOICE,
      female: DEFAULT_FEMALE_VOICE,
    },
    speakerColors: { ...DEFAULT_SPEAKER_COLORS },
    speakerProfiles: defaultSpeakerProfiles(),
    dialogCommands: defaultDialogCommands(),
    phoneticDictionary: [],
  },
};

const chatList = document.getElementById("chatList");
const pinnedList = document.getElementById("pinnedList");
const chatForm = document.getElementById("chatForm");
const textInput = document.getElementById("textInput");
const visualizer = document.getElementById("visualizer");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const settingsForm = document.getElementById("settingsForm");
const settingsSyncStatus = document.getElementById("settingsSyncStatus");
const serverUrlInput = document.getElementById("serverUrlInput");
const voiceSelect = document.getElementById("voiceSelect");
const narratorVoiceSelect = document.getElementById("narratorVoiceSelect");
const maleVoiceSelect = document.getElementById("maleVoiceSelect");
const femaleVoiceSelect = document.getElementById("femaleVoiceSelect");
const narratorColorInput = document.getElementById("narratorColorInput");
const maleColorInput = document.getElementById("maleColorInput");
const femaleColorInput = document.getElementById("femaleColorInput");
const speaker1ColorInput = document.getElementById("speaker1ColorInput");
const speaker2ColorInput = document.getElementById("speaker2ColorInput");
const speaker3ColorInput = document.getElementById("speaker3ColorInput");
const speaker4ColorInput = document.getElementById("speaker4ColorInput");
const speakerProfilesList = document.getElementById("speakerProfilesList");
const addSpeakerBtn = document.getElementById("addSpeakerBtn");
const dialogCommandInput = document.getElementById("dialogCommandInput");
const addDialogCommandBtn = document.getElementById("addDialogCommandBtn");
const resetDialogCommandsBtn = document.getElementById("resetDialogCommandsBtn");
const dialogCommandPills = document.getElementById("dialogCommandPills");
const phoneticSection = document.getElementById("phoneticSection");
const phoneticWordInput = document.getElementById("phoneticWordInput");
const phoneticReplacementInput = document.getElementById("phoneticReplacementInput");
const addPhoneticBtn = document.getElementById("addPhoneticBtn");
const phoneticList = document.getElementById("phoneticList");
const speedInput = document.getElementById("speedInput");
const speedValue = document.getElementById("speedValue");
const prependSilenceInput = document.getElementById("prependSilenceInput");
const downloadFormatSelect = document.getElementById("downloadFormatSelect");
const closeSettings = document.getElementById("closeSettings");
const darkModeInput = document.getElementById("darkModeInput");
const autoPasteInput = document.getElementById("autoPasteInput");
const modelsList = document.getElementById("modelsList");
const refreshModelsBtn = document.getElementById("refreshModelsBtn");
const loadingIndicator = document.getElementById("loadingIndicator");
const inlineColorPicker = document.getElementById("inlineColorPicker");
const speakButton = document.getElementById("speakStopBtn");
const skipAheadBtn = document.getElementById("skipAheadBtn");
const volumeInput = document.getElementById("volumeInput");
const volumeValue = document.getElementById("volumeValue");
const settingsVolumeInput = document.getElementById("settingsVolumeInput");
const settingsVolumeValue = document.getElementById("settingsVolumeValue");
const downloadConfigBtn = document.getElementById("downloadConfigBtn");
const uploadConfigBtn = document.getElementById("uploadConfigBtn");
const configFileInput = document.getElementById("configFileInput");
const deleteAllUnpinnedBtn = document.getElementById("deleteAllUnpinnedBtn");
const deleteAllPinnedBtn = document.getElementById("deleteAllPinnedBtn");
let lastClipboardAutopasteMs = 0;
const warmedVoices = new Set();
let nextSpeakerId = 1;
let apiClientIdCache = "";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function syncSpeakerIdCounter() {
  let maxId = 0;
  state.settings.speakerProfiles.forEach((profile) => {
    const m = String(profile.id || "").match(/^spk-(\d+)$/);
    if (m) maxId = Math.max(maxId, Number(m[1]));
  });
  nextSpeakerId = Math.max(nextSpeakerId, maxId + 1);
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
  persistLocalSettings();
}

function persistLocalSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadCollapsedSectionsState() {
  try {
    const raw = localStorage.getItem(SETTINGS_COLLAPSE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function saveCollapsedSectionsState(next) {
  try {
    localStorage.setItem(SETTINGS_COLLAPSE_KEY, JSON.stringify(next || {}));
  } catch (_err) {
    // ignore storage errors
  }
}

function setSectionCollapsed(section, shouldCollapse) {
  section.classList.toggle("collapsed", Boolean(shouldCollapse));
  const toggle = section.querySelector(".collapse-toggle");
  if (toggle) {
    toggle.textContent = shouldCollapse ? "▾" : "▴";
    toggle.setAttribute("aria-expanded", shouldCollapse ? "false" : "true");
  }
}

function initCollapsibleSettingsSections() {
  if (!settingsForm) return;
  const collapsedState = loadCollapsedSectionsState();
  const sections = Array.from(settingsForm.querySelectorAll(".model-manager"));
  sections.forEach((section, index) => {
    if (!section.id) section.id = `settings-section-${index + 1}`;
    const sectionId = section.id;
    const head = section.querySelector(".model-manager-head");
    if (!head) return;
    if (head.querySelector(".collapse-toggle")) return;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "collapse-toggle";
    const defaultCollapsed = index > 0;
    const collapsed = Object.prototype.hasOwnProperty.call(collapsedState, sectionId)
      ? Boolean(collapsedState[sectionId])
      : defaultCollapsed;
    toggle.addEventListener("click", () => {
      const nextCollapsed = !section.classList.contains("collapsed");
      setSectionCollapsed(section, nextCollapsed);
      collapsedState[sectionId] = nextCollapsed;
      saveCollapsedSectionsState(collapsedState);
    });
    head.appendChild(toggle);
    setSectionCollapsed(section, collapsed);
  });
}

function setLoading(isLoading) {
  loadingIndicator.classList.toggle("active", isLoading);
  updateComposerActionButton();
}

function normalizeVolume(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 1.0;
  return Math.max(0, Math.min(1, n));
}

function updateVolumeLabel() {
  const normalized = normalizeVolume(state.settings.volume);
  const label = `${Math.round(normalized * 100)}%`;
  volumeValue.textContent = label;
  if (settingsVolumeValue) settingsVolumeValue.textContent = label;
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
  state.playbackToken += 1;
  state.playbackAbortMode = "stop";
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
  updateComposerActionButton();
  render();
}

function skipAheadPlayback() {
  if (!state.currentAudio && !state.currentPlaybackAbort) return;

  if (state.segmentedPlaybackActive && state.currentPlaybackAbort) {
    state.playbackAbortMode = "skip";
    const abortFn = state.currentPlaybackAbort;
    state.currentPlaybackAbort = null;
    abortFn();
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
      state.currentAudio = null;
    }
    return;
  }

  if (state.currentAudio && Number.isFinite(state.currentAudio.duration) && state.currentAudio.duration > 0) {
    const next = Math.min(state.currentAudio.duration - 0.05, state.currentAudio.currentTime + 15);
    if (next > state.currentAudio.currentTime) {
      state.currentAudio.currentTime = next;
      return;
    }
  }

  if (state.currentPlaybackAbort) {
    state.playbackAbortMode = "skip";
    const abortFn = state.currentPlaybackAbort;
    state.currentPlaybackAbort = null;
    abortFn();
  }
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
  updateComposerActionButton();
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

function normalizeDialogueVoices(incoming) {
  const raw = incoming && typeof incoming === "object" ? incoming : {};
  return {
    narrator: String(raw.narrator || "").trim(),
    male: String(raw.male || "").trim(),
    female: String(raw.female || "").trim(),
  };
}

function normalizeSpeakerProfiles(incoming) {
  const list = Array.isArray(incoming) ? incoming : [];
  if (!list.length) return defaultSpeakerProfiles();
  return list.map((item, idx) => {
    const fallback = `Speaker ${idx + 1}`;
    const id = String(item.id || `spk-${idx + 1}`).trim() || `spk-${idx + 1}`;
    const name = String(item.name || fallback).trim() || fallback;
    const voice = String(item.voice || "").trim();
    return { id, name, voice };
  });
}

function normalizeHexColor(value, fallback) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function normalizeSpeakerColors(incoming) {
  const raw = incoming && typeof incoming === "object" ? incoming : {};
  return {
    narrator: normalizeHexColor(raw.narrator, DEFAULT_SPEAKER_COLORS.narrator),
    male: normalizeHexColor(raw.male, DEFAULT_SPEAKER_COLORS.male),
    female: normalizeHexColor(raw.female, DEFAULT_SPEAKER_COLORS.female),
    speaker1: normalizeHexColor(raw.speaker1, DEFAULT_SPEAKER_COLORS.speaker1),
    speaker2: normalizeHexColor(raw.speaker2, DEFAULT_SPEAKER_COLORS.speaker2),
    speaker3: normalizeHexColor(raw.speaker3, DEFAULT_SPEAKER_COLORS.speaker3),
    speaker4: normalizeHexColor(raw.speaker4, DEFAULT_SPEAKER_COLORS.speaker4),
  };
}

function applySpeakerColorInputs() {
  if (narratorColorInput) narratorColorInput.value = state.settings.speakerColors.narrator;
  if (maleColorInput) maleColorInput.value = state.settings.speakerColors.male;
  if (femaleColorInput) femaleColorInput.value = state.settings.speakerColors.female;
  if (speaker1ColorInput) speaker1ColorInput.value = state.settings.speakerColors.speaker1;
  if (speaker2ColorInput) speaker2ColorInput.value = state.settings.speakerColors.speaker2;
  if (speaker3ColorInput) speaker3ColorInput.value = state.settings.speakerColors.speaker3;
  if (speaker4ColorInput) speaker4ColorInput.value = state.settings.speakerColors.speaker4;
}

function readSpeakerColorsFromInputs() {
  return normalizeSpeakerColors({
    narrator: narratorColorInput?.value,
    male: maleColorInput?.value,
    female: femaleColorInput?.value,
    speaker1: speaker1ColorInput?.value,
    speaker2: speaker2ColorInput?.value,
    speaker3: speaker3ColorInput?.value,
    speaker4: speaker4ColorInput?.value,
  });
}

function hexToRgb(hex) {
  const value = normalizeHexColor(hex, "#000000");
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16),
  };
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function relativeLuminance({ r, g, b }) {
  const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const rl = toLinear(r);
  const gl = toLinear(g);
  const bl = toLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function mixRgb(a, b, weight) {
  return {
    r: a.r * (1 - weight) + b.r * weight,
    g: a.g * (1 - weight) + b.g * weight,
    b: a.b * (1 - weight) + b.b * weight,
  };
}

function themeAdjustedSpeakerColor(color) {
  const base = hexToRgb(color);
  const lum = relativeLuminance(base);
  if (state.settings.theme === "dark") {
    if (lum >= 0.58) return rgbToHex(base.r, base.g, base.b);
    const mixed = mixRgb(base, { r: 255, g: 255, b: 255 }, 0.55);
    return rgbToHex(mixed.r, mixed.g, mixed.b);
  }
  if (lum <= 0.28) return rgbToHex(base.r, base.g, base.b);
  const mixed = mixRgb(base, { r: 0, g: 0, b: 0 }, 0.62);
  return rgbToHex(mixed.r, mixed.g, mixed.b);
}

function normalizeDialogCommandTarget(raw) {
  const compact = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!compact) return "";
  if (compact === "m" || compact === "male") return "male";
  if (compact === "f" || compact === "female") return "female";
  if (compact === "n" || compact === "narrator") return "narrator";
  const speakerMatch = compact.match(/^(s|speaker)(\d+)$/);
  if (speakerMatch) return `speaker${Number(speakerMatch[2])}`;
  return "";
}

function normalizeDialogCommands(incoming, fallbackToDefaults = true) {
  if (!Array.isArray(incoming)) {
    return fallbackToDefaults ? defaultDialogCommands() : [];
  }
  const seen = new Set();
  const normalized = [];
  incoming.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const alias = String(item.alias || "")
      .trim()
      .toLowerCase();
    const target = normalizeDialogCommandTarget(item.target);
    if (!alias || !target) return;
    const key = `${alias}|${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({ alias, target });
  });
  return normalized;
}

function normalizePhoneticDictionary(incoming) {
  if (!Array.isArray(incoming)) return [];
  const out = [];
  incoming.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const word = String(item.word || "").trim();
    const replacement = String(item.replacement || "").trim();
    if (!word || !replacement) return;
    out.push({ word, replacement });
  });
  return out;
}

function applyPhoneticDictionary(text) {
  let out = String(text || "");
  const dictionary = normalizePhoneticDictionary(state.settings.phoneticDictionary);
  const latestByWord = new Map();
  for (let i = dictionary.length - 1; i >= 0; i -= 1) {
    const item = dictionary[i];
    const key = item.word.toLowerCase();
    if (!latestByWord.has(key)) latestByWord.set(key, item);
  }
  const effectiveDictionary = Array.from(latestByWord.values()).sort((a, b) => b.word.length - a.word.length);
  effectiveDictionary.forEach((item) => {
    const escaped = escapeRegExp(item.word);
    const re = new RegExp(`(^|[^A-Za-z0-9_])(${escaped})(?=$|[^A-Za-z0-9_])`, "gi");
    out = out.replace(re, (match, prefix) => `${prefix}${item.replacement}`);
  });
  return out;
}

function renderPhoneticDictionary() {
  if (!phoneticList) return;
  const items = normalizePhoneticDictionary(state.settings.phoneticDictionary);
  state.settings.phoneticDictionary = items;
  const counts = new Map();
  const latestIndexByWord = new Map();
  items.forEach((item, idx) => {
    const key = item.word.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
    latestIndexByWord.set(key, idx);
  });
  if (!items.length) {
    phoneticList.innerHTML = '<small class="dialog-empty">No phonetic entries yet.</small>';
    return;
  }
  phoneticList.innerHTML = items
    .map((item, idx) => {
      const key = item.word.toLowerCase();
      const isDuplicate = (counts.get(key) || 0) > 1;
      const isLatest = latestIndexByWord.get(key) === idx;
      const duplicateStatus = isDuplicate
        ? `<small class="phonetic-dup-note">${isLatest ? "active duplicate (newest used)" : "overridden by newer entry"}</small>`
        : "";
      return `
      <div class="phonetic-item${isDuplicate ? " duplicate" : ""}${isLatest && isDuplicate ? " active-duplicate" : ""}" data-phonetic-index="${idx}">
        <div class="phonetic-item-text">
          <strong>${escapeHtml(item.word)}</strong><span class="phonetic-arrow"> > </span><em>${escapeHtml(item.replacement)}</em>
          ${duplicateStatus}
        </div>
        <div class="phonetic-item-actions">
          <button type="button" data-phonetic-play="${idx}" title="Play pronunciation">Play</button>
          <button type="button" data-phonetic-remove="${idx}" title="Remove entry">Remove</button>
        </div>
      </div>`;
    })
    .join("");
}

function resolveNarratorVoice() {
  return state.settings.dialogueVoices?.narrator || state.settings.voice || "";
}

function resolveGenderVoice(kind) {
  if (kind === "male") return state.settings.dialogueVoices?.male || resolveNarratorVoice();
  if (kind === "female") return state.settings.dialogueVoices?.female || resolveNarratorVoice();
  return resolveNarratorVoice();
}

function resolveSpeakerVoice(slotIndex) {
  const profile = state.settings.speakerProfiles?.[slotIndex];
  return profile?.voice || resolveNarratorVoice();
}

function resolveVoiceByTarget(target) {
  if (target === "male") return resolveGenderVoice("male");
  if (target === "female") return resolveGenderVoice("female");
  if (target === "narrator") return resolveNarratorVoice();
  const match = String(target || "").match(/^speaker(\d+)$/i);
  if (match) return resolveSpeakerVoice(Math.max(0, Number(match[1]) - 1));
  return resolveNarratorVoice();
}

function autoDialogCommandsFromSpeakers() {
  const commands = [];
  state.settings.speakerProfiles.forEach((profile, idx) => {
    const target = `speaker${idx + 1}`;
    const alias1 = `speaker ${idx + 1}`;
    const alias2 = `s${idx + 1}`;
    commands.push({ alias: alias1, target, auto: true });
    commands.push({ alias: alias2, target, auto: true });
    const customName = (profile.name || "").trim().toLowerCase();
    if (customName) {
      commands.push({ alias: customName, target, auto: true });
      commands.push({ alias: `${customName} said`, target, auto: true });
    }
  });
  return commands;
}

function renderDialogCommandPills() {
  if (!dialogCommandPills) return;
  const userCommands = normalizeDialogCommands(state.settings.dialogCommands, false);
  const commands = [...userCommands, ...autoDialogCommandsFromSpeakers()];
  if (!commands.length) {
    dialogCommandPills.innerHTML = '<small class="dialog-empty">No commands configured.</small>';
    return;
  }
  dialogCommandPills.innerHTML = commands
    .map(
      (item, idx) =>
        item.auto
          ? `<span class="dialog-pill auto" title="Auto command from speaker profile">${escapeHtml(item.alias)} -> ${escapeHtml(
              item.target
            )}</span>`
          : `<button type="button" class="dialog-pill" data-remove-dialog-index="${idx}" title="Remove command">${escapeHtml(
              item.alias
            )} -> ${escapeHtml(item.target)} ×</button>`
    )
    .join("");
}

function parseDialogCommandInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, error: "Enter a command alias." };
  const parts = text.includes("=") ? text.split("=") : text.split("->");
  if (parts.length !== 2) {
    return { ok: false, error: 'Use format "alias=target", e.g. boss=male or lead=speaker1.' };
  }
  const alias = String(parts[0] || "")
    .trim()
    .toLowerCase();
  const target = normalizeDialogCommandTarget(parts[1] || "");
  if (!alias) return { ok: false, error: "Alias cannot be empty." };
  if (!target) return { ok: false, error: "Target must be one of narrator, male, female, speaker1..speakerN." };
  return { ok: true, item: { alias, target } };
}

function readDialogueSettingsFromInputs() {
  const dialogueVoices = normalizeDialogueVoices({
    narrator: narratorVoiceSelect?.value || "",
    male: maleVoiceSelect?.value || "",
    female: femaleVoiceSelect?.value || "",
  });
  const speakerProfiles = Array.from(document.querySelectorAll(".speaker-profile-row")).map((row, idx) => ({
    id: row.getAttribute("data-speaker-id") || `spk-${idx + 1}`,
    name: String(row.querySelector("[data-speaker-name]")?.value || `Speaker ${idx + 1}`).trim() || `Speaker ${idx + 1}`,
    voice: String(row.querySelector("[data-speaker-voice]")?.value || state.settings.voice).trim(),
  }));
  return { dialogueVoices, speakerProfiles };
}

function renderSpeakerProfilesInputs() {
  if (!speakerProfilesList) return;
  speakerProfilesList.innerHTML = state.settings.speakerProfiles
    .map((profile, idx) => {
      const selectId = `speakerVoiceSelect-${escapeHtml(profile.id)}`;
      return `<div class="speaker-profile-row" data-speaker-id="${escapeHtml(profile.id)}">
        <div class="speaker-label">Speaker ${idx + 1}</div>
        <input type="text" data-speaker-name value="${escapeHtml(profile.name)}" placeholder="Speaker ${idx + 1}" />
        <div class="voice-select-row">
          <select id="${selectId}" data-speaker-voice></select>
          <button type="button" data-test-voice-target="${selectId}">Test Voice</button>
        </div>
        <button type="button" data-remove-speaker-id="${escapeHtml(profile.id)}">Remove</button>
      </div>`;
    })
    .join("");
}

function applyDialogueSettingsToInputs() {
  if (narratorVoiceSelect) narratorVoiceSelect.value = state.settings.dialogueVoices.narrator || state.settings.voice;
  if (maleVoiceSelect) maleVoiceSelect.value = state.settings.dialogueVoices.male || state.settings.voice;
  if (femaleVoiceSelect) femaleVoiceSelect.value = state.settings.dialogueVoices.female || state.settings.voice;
  renderSpeakerProfilesInputs();
  renderDialogCommandPills();
}

function getConfigForExport() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      serverUrl: state.settings.serverUrl,
      voice: state.settings.voice,
      speed: state.settings.speed,
      prependSilenceMs: state.settings.prependSilenceMs,
      volume: state.settings.volume,
      downloadFormat: state.settings.downloadFormat,
      theme: state.settings.theme,
      autoPasteClipboard: state.settings.autoPasteClipboard,
      dialogueVoices: state.settings.dialogueVoices,
      speakerColors: state.settings.speakerColors,
      speakerProfiles: state.settings.speakerProfiles,
      dialogCommands: state.settings.dialogCommands,
      phoneticDictionary: state.settings.phoneticDictionary,
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
  state.settings.prependSilenceMs = normalizePrependSilenceMs(
    importedSettings.prependSilenceMs ?? state.settings.prependSilenceMs
  );
  state.settings.volume = normalizeVolume(importedSettings.volume ?? state.settings.volume);
  state.settings.downloadFormat = normalizeDownloadFormat(importedSettings.downloadFormat ?? state.settings.downloadFormat);
  state.settings.theme = importedSettings.theme === "dark" ? "dark" : "light";
  state.settings.autoPasteClipboard = Boolean(importedSettings.autoPasteClipboard ?? state.settings.autoPasteClipboard);
  state.settings.hotkeys = normalizeHotkeysObject(importedHotkeys);
  state.settings.dialogueVoices = normalizeDialogueVoices(
    importedSettings.dialogueVoices ?? state.settings.dialogueVoices
  );
  state.settings.speakerColors = normalizeSpeakerColors(
    importedSettings.speakerColors ?? state.settings.speakerColors
  );
  state.settings.speakerProfiles = normalizeSpeakerProfiles(
    importedSettings.speakerProfiles ?? state.settings.speakerProfiles
  );
  state.settings.dialogCommands = normalizeDialogCommands(
    importedSettings.dialogCommands ?? state.settings.dialogCommands
  );
  state.settings.phoneticDictionary = normalizePhoneticDictionary(
    importedSettings.phoneticDictionary ?? state.settings.phoneticDictionary
  );
  syncSpeakerIdCounter();
  persistLocalSettings();
  applyTheme();
  await fetchVoices();

  renderVoiceOptions();
  renderModels();
  renderPhoneticDictionary();
  openSettings();
}

function applyTheme() {
  const theme = state.settings.theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
}

function isSettingsOpen() {
  return settingsPanel.classList.contains("open");
}

function closeSettingsPanel() {
  settingsPanel.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
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

function randomClientId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
}

function getApiClientId() {
  if (apiClientIdCache) return apiClientIdCache;
  let existing = "";
  try {
    existing = String(localStorage.getItem(API_CLIENT_ID_KEY) || "").trim();
  } catch (_err) {
    existing = "";
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(existing)) {
    existing = randomClientId();
    try {
      localStorage.setItem(API_CLIENT_ID_KEY, existing);
    } catch (_err) {
      // Ignore storage write failures and continue with in-memory ID.
    }
  }
  apiClientIdCache = existing;
  return apiClientIdCache;
}

function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set(API_CLIENT_ID_HEADER, getApiClientId());
  return fetch(url, { ...options, headers });
}

function normalizeDownloadFormat(value) {
  return ["wav", "mp3", "ogg"].includes(value) ? value : "wav";
}

function normalizePrependSilenceMs(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(3000, Math.round(n)));
}

function stripOuterQuotes(value) {
  const text = String(value || "").trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkNarratorText(text) {
  const paragraphs = String(text || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out = [];
  paragraphs.forEach((paragraph) => {
    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph];
    // Keep startup latency low: synthesize/play the first couple of sentences first.
    let bucket = [];
    let targetSize = 2;
    for (let i = 0; i < sentences.length; i += 1) {
      bucket.push(sentences[i].trim());
      if (bucket.length >= targetSize || i === sentences.length - 1) {
        const chunk = bucket.join(" ").trim();
        if (chunk) out.push(chunk);
        bucket = [];
        // After the first chunk, use larger batches for better total throughput.
        targetSize = 4;
      }
    }
  });
  return out.length ? out : [String(text || "").trim()].filter(Boolean);
}

function allCommandMappings() {
  const merged = [...normalizeDialogCommands(state.settings.dialogCommands), ...autoDialogCommandsFromSpeakers()];
  const seen = new Set();
  const out = [];
  merged.forEach((item) => {
    const alias = String(item.alias || "")
      .trim()
      .toLowerCase();
    const target = String(item.target || "").trim().toLowerCase();
    if (!alias || !target) return;
    const key = `${alias}|${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ alias, target });
  });
  return out.sort((a, b) => b.alias.length - a.alias.length);
}

function recentClauseBeforeQuote(beforeText) {
  const text = String(beforeText || "");
  const boundary = Math.max(text.lastIndexOf("\n"), text.lastIndexOf("."), text.lastIndexOf("!"), text.lastIndexOf("?"), text.lastIndexOf(";"));
  return text.slice(boundary + 1).trim();
}

function detectQuoteTarget(beforeText) {
  const clause = recentClauseBeforeQuote(beforeText).toLowerCase();
  if (!clause) return "";
  const mappings = allCommandMappings();
  const verbs = "(?:said|says|asked|replied|whispered|yelled|shouted)";
  for (const item of mappings) {
    const alias = escapeRegExp(item.alias);
    const direct = new RegExp(`(?:^|\\b)${alias}\\s*$`, "i");
    const withVerb = new RegExp(`(?:^|\\b)${alias}\\s+${verbs}\\s*$`, "i");
    const withColon = new RegExp(`(?:^|\\b)${alias}\\s*:\\s*$`, "i");
    if (direct.test(clause) || withVerb.test(clause) || withColon.test(clause)) {
      return item.target;
    }
  }
  return "";
}

function pushNarratorChunks(segments, text) {
  const chunks = chunkNarratorText(text);
  chunks.forEach((chunk) => {
    if (chunk && chunk.trim()) segments.push({ text: chunk.trim(), voice: resolveNarratorVoice(), role: "narrator", quoted: false });
  });
}

function parseVoiceSegments(text) {
  const input = String(text || "");
  if (!input.trim()) return [];
  const segments = [];
  const quoteRe = /"([^"]+)"/g;
  let cursor = 0;
  let match;
  while ((match = quoteRe.exec(input)) !== null) {
    const before = input.slice(cursor, match.index);
    if (before.trim()) {
      pushNarratorChunks(segments, before);
    }
    const quoted = stripOuterQuotes(match[1]);
    if (quoted) {
      const target = detectQuoteTarget(input.slice(0, match.index));
      const voice = target ? resolveVoiceByTarget(target) : resolveNarratorVoice();
      segments.push({ text: quoted, voice, role: target || "narrator", quoted: true });
    }
    cursor = match.index + match[0].length;
  }
  const tail = input.slice(cursor);
  if (tail.trim()) {
    pushNarratorChunks(segments, tail);
  }
  return segments.filter((segment) => segment.text && segment.text.trim());
}

async function warmVoice(voiceId) {
  const voice = (voiceId || "").trim();
  if (!voice || warmedVoices.has(voice)) return;
  warmedVoices.add(voice);
  try {
    await apiFetch(`${getApiBase()}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "warmup",
        voice,
        speed: 1.0,
        prependSilenceMs: 0,
      }),
    });
  } catch (_err) {
    // best-effort warmup only
    warmedVoices.delete(voice);
  }
}

function warmConfiguredVoices() {
  const targets = new Set([
    state.settings.voice,
    state.settings.dialogueVoices?.narrator,
    state.settings.dialogueVoices?.male,
    state.settings.dialogueVoices?.female,
    ...(state.settings.speakerProfiles || []).map((p) => p.voice),
  ]);
  targets.forEach((voice) => {
    if (voice) warmVoice(voice);
  });
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

function voiceLabelById(voiceId) {
  const id = String(voiceId || "").trim();
  if (!id) return "default";
  const found = state.voices.find((v) => v.id === id);
  return found?.label || id;
}

function roleTitle(role) {
  if (role === "male") return "Male";
  if (role === "female") return "Female";
  if (role === "speaker1") return "Speaker 1";
  if (role === "speaker2") return "Speaker 2";
  if (role === "speaker3") return "Speaker 3";
  if (role === "speaker4") return "Speaker 4";
  return "Narrator";
}

function entryVoiceSummaryParts(entry) {
  const segments = parseVoiceSegments(entry?.text || "");
  const ordered = [];
  const seen = new Set();
  segments.forEach((segment) => {
    const role = effectiveRoleForSegment(segment);
    if (seen.has(role)) return;
    seen.add(role);
    const voice = String(segment.voice || "").trim();
    ordered.push({
      role,
      label: voiceLabelById(voice),
      title: roleTitle(role),
    });
  });
  if (!ordered.length) {
    ordered.push({
      role: "narrator",
      label: voiceLabelById(entry?.voice || state.settings.voice || ""),
      title: roleTitle("narrator"),
    });
  }
  return ordered;
}

function updateSettingsSyncStatus() {
  if (!settingsSyncStatus) return;
  settingsSyncStatus.textContent = "Settings are saved locally in this browser only.";
  settingsSyncStatus.classList.remove("error");
}

function updateSpeedLabel() {
  speedValue.textContent = `${Number(speedInput.value).toFixed(1)}x`;
}

function wordify(text) {
  return text.split(/(\s+)/).filter(Boolean);
}

function entryDisplayText(entry) {
  const segments = parseVoiceSegments(entry?.text || "");
  if (!segments.length) return String(entry?.text || "");
  return segments
    .map((segment) => {
      const txt = String(segment?.text || "").trim();
      if (!txt) return "";
      return segment.quoted ? `"${txt}"` : txt;
    })
    .filter(Boolean)
    .join(" ");
}

function roleRangesForDisplayText(entry) {
  const segments = parseVoiceSegments(entry?.text || "");
  const ranges = [];
  let cursor = 0;
  segments.forEach((segment, index) => {
    const txt = String(segment?.text || "").trim();
    if (!txt) return;
    const piece = segment.quoted ? `"${txt}"` : txt;
    const role = effectiveRoleForSegment(segment);
    const start = cursor;
    const end = start + piece.length;
    ranges.push({ start, end, role });
    cursor = end;
    if (index < segments.length - 1) cursor += 1; // space between pieces
  });
  return ranges;
}

function effectiveRoleForSegment(segment) {
  const role = String(segment?.role || "").trim().toLowerCase();
  if (
    role === "narrator" ||
    role === "male" ||
    role === "female" ||
    role === "speaker1" ||
    role === "speaker2" ||
    role === "speaker3" ||
    role === "speaker4"
  ) {
    return role;
  }
  return "narrator";
}

function tokenRolesForEntry(entry) {
  const segments = parseVoiceSegments(entry?.text || "");
  const out = [];
  segments.forEach((segment) => {
    const count = wordify(
      segment.quoted ? `"${String(segment.text || "").trim()}"` : String(segment.text || "").trim()
    ).length;
    const role = effectiveRoleForSegment(segment);
    for (let i = 0; i < count; i += 1) out.push(role);
  });
  return out;
}

function getPhoneticRanges(text) {
  const source = String(text || "");
  if (!source) return [];
  const dictionary = normalizePhoneticDictionary(state.settings.phoneticDictionary);
  const latestByWord = new Map();
  for (let i = dictionary.length - 1; i >= 0; i -= 1) {
    const item = dictionary[i];
    const key = item.word.toLowerCase();
    if (!latestByWord.has(key)) latestByWord.set(key, item);
  }
  const words = Array.from(latestByWord.values()).map((item) => item.word).sort((a, b) => b.length - a.length);
  const ranges = [];
  words.forEach((word) => {
    const escaped = escapeRegExp(word);
    const re = new RegExp(`(^|[^A-Za-z0-9_])(${escaped})(?=$|[^A-Za-z0-9_])`, "gi");
    let match;
    while ((match = re.exec(source)) !== null) {
      const prefixLen = (match[1] || "").length;
      const matchedLen = (match[2] || "").length;
      const start = match.index + prefixLen;
      const end = start + matchedLen;
      if (start < end) ranges.push({ start, end });
    }
  });
  return ranges;
}

function colorForRole(role) {
  const colors = normalizeSpeakerColors(state.settings.speakerColors);
  if (role === "male") return themeAdjustedSpeakerColor(colors.male);
  if (role === "female") return themeAdjustedSpeakerColor(colors.female);
  if (role === "speaker1") return themeAdjustedSpeakerColor(colors.speaker1);
  if (role === "speaker2") return themeAdjustedSpeakerColor(colors.speaker2);
  if (role === "speaker3") return themeAdjustedSpeakerColor(colors.speaker3);
  if (role === "speaker4") return themeAdjustedSpeakerColor(colors.speaker4);
  return themeAdjustedSpeakerColor(colors.narrator);
}

function renderWordSpans(entry, activeIndex = -1) {
  const displayText = entryDisplayText(entry);
  const words = wordify(displayText);
  const roleRanges = roleRangesForDisplayText(entry);
  const phoneticRanges = getPhoneticRanges(displayText);
  let offset = 0;
  return words
    .map((word, idx) => {
      const start = offset;
      const end = start + word.length;
      offset = end;
      const isPhonetic =
        word.trim() &&
        phoneticRanges.some((range) => {
          return start < range.end && end > range.start;
        });
      const classes = ["word"];
      if (idx === activeIndex) classes.push("active");
      if (isPhonetic) classes.push("phonetic-word");
      const roleRange = roleRanges.find((range) => start < range.end && end > range.start);
      const role = roleRange ? roleRange.role : "narrator";
      const color = colorForRole(role);
      return `<span class="${classes.join(" ")}" style="color:${escapeHtml(color)}">${escapeHtml(word)}</span>`;
    })
    .join("");
}

function renderVoiceSummaryChips(entry) {
  const parts = entryVoiceSummaryParts(entry);
  return parts
    .map((part) => {
      const color = colorForRole(part.role);
      const text = `${part.label} (${part.title})`;
      return `<button type="button" class="voice-chip" data-voice-role="${escapeHtml(part.role)}" title="Change ${escapeHtml(part.title)} color" style="color:${escapeHtml(color)}">${escapeHtml(text)}</button>`;
    })
    .join(" ");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
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
          <span>${renderVoiceSummaryChips(entry)} | ${Number(entry.speed || 1).toFixed(1)}x</span>
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
        <div class="msg-text">${escapeHtml(entryDisplayText(entry))}</div>
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
  const res = await apiFetch(`${getApiBase()}/api/voices`);
  if (!res.ok) {
    throw new Error(`Voices request failed (${res.status})`);
  }
  const data = await res.json();
  state.voices = data.voices || [];
  state.catalog = data.catalog || [];
  const available = new Set(state.voices.map((v) => v.id));
  if (!state.settings.voice || !available.has(state.settings.voice)) {
    state.settings.voice = available.has(DEFAULT_MAIN_VOICE)
      ? DEFAULT_MAIN_VOICE
      : data.default || state.voices[0]?.id || "";
  }
  state.settings.dialogueVoices = normalizeDialogueVoices(state.settings.dialogueVoices);
  state.settings.speakerProfiles = normalizeSpeakerProfiles(state.settings.speakerProfiles);
  const preferredByRole = {
    narrator: DEFAULT_NARRATOR_VOICE,
    male: DEFAULT_MALE_VOICE,
    female: DEFAULT_FEMALE_VOICE,
  };
  ["narrator", "male", "female"].forEach((role) => {
    const selected = state.settings.dialogueVoices[role];
    if (!selected || !available.has(selected)) {
      const preferred = preferredByRole[role];
      state.settings.dialogueVoices[role] = available.has(preferred) ? preferred : state.settings.voice;
    }
  });
  state.settings.speakerProfiles = state.settings.speakerProfiles.map((profile, idx) => ({
    id: profile.id || `spk-${idx + 1}`,
    name: profile.name,
    voice: profile.voice && available.has(profile.voice) ? profile.voice : state.settings.voice,
  }));
  saveSettings();
  warmConfiguredVoices();
}

function renderVoiceOptions() {
  const options = state.voices
    .map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.label)}</option>`)
    .join("");
  const fallbackOptions = options || '<option value="">No voices found</option>';
  [voiceSelect, narratorVoiceSelect, maleVoiceSelect, femaleVoiceSelect].forEach((select) => {
    if (select) select.innerHTML = fallbackOptions;
  });
  voiceSelect.value = state.settings.voice;
  applyDialogueSettingsToInputs();
  Array.from(document.querySelectorAll("[data-speaker-voice]")).forEach((select, idx) => {
    select.innerHTML = fallbackOptions;
    select.value = state.settings.speakerProfiles[idx]?.voice || state.settings.voice;
  });
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
  const res = await apiFetch(`${getApiBase()}/api/voices/install`, {
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
  const res = await apiFetch(`${getApiBase()}/api/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Uninstall failed (${res.status})`);
  }
}

async function playSettingsVoiceSampleNow(voiceOverride = "", sampleTextOverride = "") {
  const previewVoice = voiceOverride || voiceSelect.value || state.settings.voice;
  const previewSpeed = Number(speedInput.value || state.settings.speed || 1);
  const previewPrependSilenceMs = normalizePrependSilenceMs(
    prependSilenceInput?.value ?? state.settings.prependSilenceMs ?? 0
  );
  const sampleText = String(sampleTextOverride || "This is a voice test. The quick brown fox jumps over the lazy dog.");

  setLoading(true);
  try {
    const res = await apiFetch(`${getApiBase()}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: sampleText,
        voice: previewVoice,
        speed: previewSpeed,
        prependSilenceMs: previewPrependSilenceMs,
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

async function playPhoneticPreviewNow(replacementText, voiceOverride = "") {
  const text = String(replacementText || "").trim();
  if (!text) return;
  const previewVoice = voiceOverride || resolveNarratorVoice() || state.settings.voice;
  const previewSpeed = Number(speedInput.value || state.settings.speed || 1);
  const previewPrependSilenceMs = normalizePrependSilenceMs(
    prependSilenceInput?.value ?? state.settings.prependSilenceMs ?? 0
  );
  await warmVoice(previewVoice);

  setLoading(true);
  try {
    const res = await apiFetch(`${getApiBase()}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: previewVoice,
        speed: previewSpeed,
        prependSilenceMs: previewPrependSilenceMs,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Voice preview failed (${res.status})`);
    }

    const data = await res.json();
    const audio = new Audio(absoluteAudioUrl(data.audioUrl));
    audio.volume = normalizeVolume(state.settings.volume);
    state.currentAudio = audio;
    await waitForAudioReady(audio);
    visualizer.classList.add("active");

    const playOnce = () =>
      new Promise((resolve, reject) => {
        state.currentPlaybackAbort = () => resolve("aborted");
        audio.currentTime = 0;
        audio.addEventListener("ended", () => resolve("ended"), { once: true });
        audio.addEventListener("error", () => reject(new Error("voice preview playback failed")), { once: true });
        audio.play().catch(reject);
      });

    const first = await playOnce();
    if (first === "aborted") return;
    await sleep(2000);
    const second = await playOnce();
    if (second === "aborted") return;
  } finally {
    state.currentPlaybackAbort = null;
    visualizer.classList.remove("active");
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
      state.currentAudio = null;
    }
    setLoading(false);
  }
}

function getVoiceSelectById(id) {
  const map = {
    voiceSelect,
    narratorVoiceSelect,
    maleVoiceSelect,
    femaleVoiceSelect,
  };
  return map[id] || document.getElementById(id) || null;
}

async function synthesize(entry) {
  return synthesizeText(entry.text, entry, entry.voice);
}

async function synthesizeText(text, entry, voiceOverride) {
  let lastError = null;
  let chosenVoice = (voiceOverride || entry.voice || state.settings.voice || "").trim();
  const normalizedText = applyPhoneticDictionary(text);
  const prependSilenceMs = Math.max(MIN_SYNTH_PREPEND_SILENCE_MS, normalizePrependSilenceMs(state.settings.prependSilenceMs));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await apiFetch(`${getApiBase()}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: normalizedText,
        voice: chosenVoice,
        speed: entry.speed,
        prependSilenceMs,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const absoluteUrl = absoluteAudioUrl(data.audioUrl);
      if (!voiceOverride || voiceOverride === entry.voice) {
        entry.audioUrl = absoluteUrl;
        entry.voice = data.voice || entry.voice;
      }
      return absoluteUrl;
    }

    const body = await res.json().catch(() => ({}));
    lastError = new Error(body.error || `Speak request failed (${res.status})`);
    if (attempt === 0 && /voice not found/i.test(lastError.message)) {
      await fetchVoices();
      chosenVoice = state.settings.voice;
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
  const playbackToken = ++state.playbackToken;
  state.playbackAbortMode = "";
  const isCanceled = () => playbackToken !== state.playbackToken;

  setLoading(true);
  try {
    const segments = parseVoiceSegments(entry.text);
    const shouldUseSegments =
      segments.length > 1 || (segments[0] && segments[0].voice && segments[0].voice !== entry.voice);

    if (shouldUseSegments) {
      state.segmentedPlaybackActive = true;
      entry.segmentAudioSegments = new Array(segments.length);

      const synthPromises = new Array(segments.length);
      const ensureSegmentSynthesis = (index) => {
        if (index < 0 || index >= segments.length) return Promise.resolve("");
        if (synthPromises[index]) return synthPromises[index];
        const segment = segments[index];
        synthPromises[index] = synthesizeText(segment.text, entry, segment.voice).then((segmentUrl) => {
          entry.segmentAudioSegments[index] = { url: segmentUrl, voice: segment.voice, text: segment.text };
          saveHistory();
          render();
          return segmentUrl;
        });
        return synthPromises[index];
      };

      const totalWords = segments.reduce((sum, segment) => sum + wordify(segment.text).length, 0);
      let consumedWords = 0;
      for (let i = 0; i < segments.length; i += 1) {
        if (isCanceled()) break;
        const segmentUrl = await ensureSegmentSynthesis(i);
        if (isCanceled()) break;
        const segmentItem = entry.segmentAudioSegments[i] || {
          url: segmentUrl,
          voice: segments[i].voice,
          text: segments[i].text,
        };

        // Pipeline: prefetch the next segment while the current one is playing.
        if (i + 1 < segments.length) {
          ensureSegmentSynthesis(i + 1).catch(() => {});
        }

        const lineWords = wordify(segmentItem.text);
        const audio = new Audio(segmentUrl);
        audio.volume = normalizeVolume(state.settings.volume);
        state.currentAudio = audio;
        state.activePlaybackId = id;
        await waitForAudioReady(audio);
        visualizer.classList.add("active");

        let interval = 0.2;
        audio.addEventListener("loadedmetadata", () => {
          if (audio.duration && lineWords.length) interval = audio.duration / lineWords.length;
        });
        audio.addEventListener("timeupdate", () => {
          if (!lineWords.length || !totalWords) return;
          const localIdx = Math.min(
            lineWords.length - 1,
            Math.floor((audio.currentTime + interval * 0.35) / interval)
          );
          entry.wordIndex = Math.min(totalWords - 1, consumedWords + localIdx);
          render();
        });
        const playResult = await new Promise((resolve, reject) => {
          state.currentPlaybackAbort = () => resolve("aborted");
          audio.addEventListener("ended", resolve, { once: true });
          audio.addEventListener("error", () => reject(new Error("audio playback failed")), { once: true });
          audio.play().then(() => {}).catch(reject);
        });
        state.currentPlaybackAbort = null;
        if (playResult === "aborted") {
          const mode = state.playbackAbortMode;
          state.playbackAbortMode = "";
          if (mode === "stop" || isCanceled()) break;
        }
        if (isCanceled()) break;
        consumedWords += lineWords.length;
        if (i < segments.length - 1) {
          const nextSegmentItem = entry.segmentAudioSegments[i + 1];
          const nextVoice = (nextSegmentItem && nextSegmentItem.voice) || segments[i + 1].voice || "";
          const currentVoice = segmentItem.voice || "";
          if (nextVoice && currentVoice && nextVoice !== currentVoice) {
            await sleep(VOICE_SWITCH_PAUSE_MS);
          }
        }
      }
      visualizer.classList.remove("active");
      state.currentAudio = null;
      state.activePlaybackId = null;
      clearWordHighlights();
      render();
      return;
    }

    if (!entry.audioUrl) {
      await synthesize(entry);
      saveHistory();
      if (isCanceled()) return;
    }

    const audio = new Audio(entry.audioUrl);
    audio.volume = normalizeVolume(state.settings.volume);
    state.currentAudio = audio;
    state.activePlaybackId = id;
    await waitForAudioReady(audio);
    visualizer.classList.add("active");

    let words = wordify(entryDisplayText(entry));
    let interval = 0.2;

    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && words.length) {
        interval = audio.duration / words.length;
      }
    });

    audio.addEventListener("timeupdate", () => {
      if (!words.length) return;
      const idx = Math.min(words.length - 1, Math.floor((audio.currentTime + interval * 0.35) / interval));
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
    state.segmentedPlaybackActive = false;
    state.playbackAbortMode = "";
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

function parseAudioReference(audioUrl) {
  if (!audioUrl) return { filename: "", token: "" };
  const parsed = new URL(audioUrl, window.location.origin);
  const parts = parsed.pathname.split("/");
  const file = parts[parts.length - 1] || "";
  const filename = file.endsWith(".wav") ? file : "";
  const token = parsed.searchParams.get("token") || "";
  return { filename, token };
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

    const audioRef = parseAudioReference(entry.audioUrl);
    if (!audioRef.filename) {
      throw new Error("invalid audio URL");
    }
    if (!audioRef.token) {
      throw new Error("audio URL token missing");
    }

    const response = await apiFetch(
      `${getApiBase()}/api/download/${encodeURIComponent(audioRef.filename)}?format=${encodeURIComponent(format)}&token=${encodeURIComponent(audioRef.token)}`
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

function isPlaybackActive() {
  return (
    loadingIndicator.classList.contains("active") ||
    state.activePlaybackId !== null ||
    Boolean(state.currentAudio) ||
    state.queueRunning ||
    state.audioQueue.length > 0
  );
}

function updateComposerActionButton() {
  if (!speakButton) return;
  const active = isPlaybackActive();
  speakButton.textContent = active ? "Stop" : "Speak";
  speakButton.classList.toggle("stop-mode", active);
}

async function submitText(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (isPlaybackActive()) {
    stopPlayback();
  }
  const segmentVoices = new Set(parseVoiceSegments(trimmed).map((s) => s.voice).filter(Boolean));
  await Promise.all(Array.from(segmentVoices).map((voice) => warmVoice(voice)));

  const entry = {
    id: uid(),
    text: trimmed,
    pinned: false,
    createdAt: nowIso(),
    voice: resolveNarratorVoice(),
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
  speakButton.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (isPlaybackActive()) {
      stopPlayback();
      return;
    }
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
    const roleChip = ev.target.closest("[data-voice-role]");
    if (roleChip) {
      ev.preventDefault();
      ev.stopPropagation();
      const role = String(roleChip.getAttribute("data-voice-role") || "").trim();
      if (!role || !inlineColorPicker) return;
      const current = normalizeSpeakerColors(state.settings.speakerColors)[role] || "#ffffff";
      inlineColorPicker.value = current;
      inlineColorPicker.setAttribute("data-role", role);
      inlineColorPicker.click();
      return;
    }

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
      if (isSettingsOpen()) closeSettingsPanel();
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
  closeSettings.addEventListener("click", closeSettingsPanel);
  skipAheadBtn?.addEventListener("click", () => {
    skipAheadPlayback();
  });
  inlineColorPicker?.addEventListener("input", () => {
    const role = String(inlineColorPicker.getAttribute("data-role") || "").trim();
    if (!role) return;
    const colors = normalizeSpeakerColors(state.settings.speakerColors);
    if (!Object.prototype.hasOwnProperty.call(colors, role)) return;
    colors[role] = normalizeHexColor(inlineColorPicker.value, colors[role]);
    state.settings.speakerColors = colors;
    applySpeakerColorInputs();
    persistLocalSettings();
    render();
  });
  volumeInput.addEventListener("input", () => {
    state.settings.volume = normalizeVolume(volumeInput.value);
    if (settingsVolumeInput) settingsVolumeInput.value = String(state.settings.volume);
    updateVolumeLabel();
    applyVolumeToCurrentAudio();
  });
  volumeInput.addEventListener("change", () => {
    saveSettings();
  });
  settingsVolumeInput?.addEventListener("input", () => {
    state.settings.volume = normalizeVolume(settingsVolumeInput.value);
    volumeInput.value = String(state.settings.volume);
    updateVolumeLabel();
    applyVolumeToCurrentAudio();
  });
  settingsVolumeInput?.addEventListener("change", () => {
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

  settingsForm.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-test-voice-target]");
    if (!btn) return;
    ev.preventDefault();
    const targetId = btn.getAttribute("data-test-voice-target");
    const select = getVoiceSelectById(targetId);
    const voice = select?.value || state.settings.voice;
    btn.disabled = true;
    try {
      await enqueueAudioJob(async () => {
        await playSettingsVoiceSampleNow(voice);
      });
    } catch (err) {
      alert(`Could not play voice test: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  addDialogCommandBtn?.addEventListener("click", () => {
    const parsed = parseDialogCommandInput(dialogCommandInput?.value || "");
    if (!parsed.ok) {
      alert(parsed.error);
      return;
    }
    const list = normalizeDialogCommands(state.settings.dialogCommands, false);
    if (!list.some((item) => item.alias === parsed.item.alias && item.target === parsed.item.target)) {
      list.push(parsed.item);
      state.settings.dialogCommands = list;
      persistLocalSettings();
      renderDialogCommandPills();
    }
    if (dialogCommandInput) dialogCommandInput.value = "";
  });

  dialogCommandPills?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-remove-dialog-index]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-remove-dialog-index"));
    if (!Number.isInteger(idx) || idx < 0) return;
    const list = normalizeDialogCommands(state.settings.dialogCommands, false);
    if (idx >= list.length) return;
    list.splice(idx, 1);
    state.settings.dialogCommands = list;
    persistLocalSettings();
    renderDialogCommandPills();
  });

  resetDialogCommandsBtn?.addEventListener("click", () => {
    state.settings.dialogCommands = defaultDialogCommands();
    persistLocalSettings();
    renderDialogCommandPills();
  });

  const addPhoneticEntry = () => {
    const word = String(phoneticWordInput?.value || "").trim();
    const replacement = String(phoneticReplacementInput?.value || "").trim();
    if (!word || !replacement) {
      alert("Enter both a word/phrase and a pronunciation.");
      return;
    }
    const list = normalizePhoneticDictionary(state.settings.phoneticDictionary);
    if (!list.some((item) => item.word.toLowerCase() === word.toLowerCase() && item.replacement === replacement)) {
      list.push({ word, replacement });
      state.settings.phoneticDictionary = list;
      persistLocalSettings();
      renderPhoneticDictionary();
    }
    if (phoneticWordInput) phoneticWordInput.value = "";
    if (phoneticReplacementInput) phoneticReplacementInput.value = "";
    phoneticWordInput?.focus();
  };

  addPhoneticBtn?.addEventListener("click", addPhoneticEntry);
  phoneticReplacementInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      addPhoneticEntry();
    }
  });

  phoneticList?.addEventListener("click", async (ev) => {
    const removeBtn = ev.target.closest("button[data-phonetic-remove]");
    if (removeBtn) {
      const idx = Number(removeBtn.getAttribute("data-phonetic-remove"));
      const list = normalizePhoneticDictionary(state.settings.phoneticDictionary);
      if (Number.isInteger(idx) && idx >= 0 && idx < list.length) {
        list.splice(idx, 1);
        state.settings.phoneticDictionary = list;
        persistLocalSettings();
        renderPhoneticDictionary();
      }
      return;
    }

    const playBtn = ev.target.closest("button[data-phonetic-play]");
    if (!playBtn) return;
    const idx = Number(playBtn.getAttribute("data-phonetic-play"));
    const list = normalizePhoneticDictionary(state.settings.phoneticDictionary);
    if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
    const entry = list[idx];
    playBtn.disabled = true;
    try {
      await enqueueAudioJob(async () => {
        await playPhoneticPreviewNow(entry.replacement, resolveNarratorVoice());
      });
    } catch (err) {
      alert(`Could not play pronunciation: ${err.message}`);
    } finally {
      playBtn.disabled = false;
    }
  });

  addSpeakerBtn?.addEventListener("click", () => {
    const current = readDialogueSettingsFromInputs();
    state.settings.speakerProfiles = current.speakerProfiles;
    const index = state.settings.speakerProfiles.length + 1;
    state.settings.speakerProfiles.push({
      id: `spk-${nextSpeakerId++}`,
      name: `Speaker ${index}`,
      voice: state.settings.voice,
    });
    persistLocalSettings();
    renderVoiceOptions();
    renderDialogCommandPills();
  });

  speakerProfilesList?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-remove-speaker-id]");
    if (!btn) return;
    const speakerId = btn.getAttribute("data-remove-speaker-id");
    const current = readDialogueSettingsFromInputs();
    if (current.speakerProfiles.length <= 1) return;
    state.settings.speakerProfiles = current.speakerProfiles.filter((item) => item.id !== speakerId);
    persistLocalSettings();
    renderVoiceOptions();
    renderDialogCommandPills();
  });

  speakerProfilesList?.addEventListener("input", () => {
    const current = readDialogueSettingsFromInputs();
    state.settings.speakerProfiles = current.speakerProfiles;
    renderDialogCommandPills();
  });

  settingsForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    state.settings.serverUrl = (serverUrlInput.value || "").trim().replace(/\/$/, "");
    state.settings.voice = voiceSelect.value;
    state.settings.speed = Number(speedInput.value);
    state.settings.prependSilenceMs = normalizePrependSilenceMs(prependSilenceInput.value);
    state.settings.volume = normalizeVolume(settingsVolumeInput?.value ?? volumeInput.value);
    state.settings.downloadFormat = normalizeDownloadFormat(downloadFormatSelect.value);
    state.settings.theme = darkModeInput.checked ? "dark" : "light";
    state.settings.autoPasteClipboard = autoPasteInput.checked;
    state.settings.hotkeys = readHotkeysFromInputs();
    const dialogueSettings = readDialogueSettingsFromInputs();
    state.settings.dialogueVoices = dialogueSettings.dialogueVoices;
    state.settings.speakerColors = readSpeakerColorsFromInputs();
    state.settings.speakerProfiles = dialogueSettings.speakerProfiles;
    syncSpeakerIdCounter();
    persistLocalSettings();
    try {
      await fetchVoices();
    } catch (err) {
      alert(`Could not refresh voices: ${err.message}`);
    }
    applyTheme();
    renderVoiceOptions();
    renderModels();
    render();
    updateSettingsSyncStatus();
    closeSettingsPanel();
  });
}

async function openSettings() {
  serverUrlInput.value = state.settings.serverUrl;
  speedInput.value = String(state.settings.speed);
  prependSilenceInput.value = String(normalizePrependSilenceMs(state.settings.prependSilenceMs));
  volumeInput.value = String(state.settings.volume);
  if (settingsVolumeInput) settingsVolumeInput.value = String(state.settings.volume);
  downloadFormatSelect.value = normalizeDownloadFormat(state.settings.downloadFormat);
  darkModeInput.checked = state.settings.theme === "dark";
  autoPasteInput.checked = Boolean(state.settings.autoPasteClipboard);
  applyHotkeyInputs();
  applyDialogueSettingsToInputs();
  applySpeakerColorInputs();
  renderPhoneticDictionary();
  updateSpeedLabel();
  renderVoiceOptions();
  renderModels();
  settingsPanel.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
  updateSettingsSyncStatus();
}

async function init() {
  loadLocalState();
  if (state.settings.theme !== "dark" && state.settings.theme !== "light") {
    state.settings.theme = "dark";
  }
  state.settings.downloadFormat = normalizeDownloadFormat(state.settings.downloadFormat);
  state.settings.prependSilenceMs = normalizePrependSilenceMs(state.settings.prependSilenceMs);
  if (state.settings.prependSilenceMs === 0) {
    state.settings.prependSilenceMs = 250;
  }
  state.settings.volume = normalizeVolume(state.settings.volume);
  state.settings.autoPasteClipboard = Boolean(state.settings.autoPasteClipboard);
  state.settings.hotkeys = normalizeHotkeysObject(state.settings.hotkeys);
  state.settings.dialogueVoices = normalizeDialogueVoices(state.settings.dialogueVoices);
  state.settings.speakerColors = normalizeSpeakerColors(state.settings.speakerColors);
  state.settings.speakerProfiles = normalizeSpeakerProfiles(state.settings.speakerProfiles);
  state.settings.dialogCommands = normalizeDialogCommands(state.settings.dialogCommands);
  state.settings.phoneticDictionary = normalizePhoneticDictionary(state.settings.phoneticDictionary);
  syncSpeakerIdCounter();
  saveSettings();
  saveHistory();
  applyTheme();
  initCollapsibleSettingsSections();
  bindEvents();

  serverUrlInput.value = state.settings.serverUrl;
  speedInput.value = String(state.settings.speed);
  prependSilenceInput.value = String(state.settings.prependSilenceMs);
  volumeInput.value = String(state.settings.volume);
  if (settingsVolumeInput) settingsVolumeInput.value = String(state.settings.volume);
  updateVolumeLabel();
  updateSpeedLabel();
  updateComposerActionButton();

  try {
    await fetchVoices();
  } catch (err) {
    alert(`Voice loading failed: ${err.message}`);
  }

  renderVoiceOptions();
  renderModels();
  renderPhoneticDictionary();
  render();
  textInput.focus();
  textInput.select();

  const params = new URLSearchParams(window.location.search);
  if (params.get("openSettings") === "1") {
    openSettings();
  }
}

init();
