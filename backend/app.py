import os
import re
import shutil
import subprocess
import uuid
import json
import wave
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

VOICES_DIR = Path(os.getenv("PIPER_VOICES_DIR", "/data/voices"))
AUDIO_DIR = Path(os.getenv("PIPER_AUDIO_DIR", "/data/audio"))
STATE_DIR = Path(os.getenv("OPEN_TTS_STATE_DIR", "/data/state"))
SETTINGS_FILE = STATE_DIR / "settings.json"
HISTORY_FILE = STATE_DIR / "history.json"
SUPERTONIC_STATE_FILE = STATE_DIR / "supertonic_voices.json"
DEFAULT_VOICE = os.getenv("PIPER_DEFAULT_VOICE", "en_US-lessac-medium")
DEFAULT_VOICE_BASE = os.getenv(
    "PIPER_DEFAULT_VOICE_BASE",
    "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium",
)
PIPER_BIN = os.getenv("PIPER_BIN", "piper")
SPEAK_TIMEOUT_SECONDS = int(os.getenv("PIPER_TIMEOUT_SECONDS", "60"))
PREPEND_SILENCE_MS = int(os.getenv("OPEN_TTS_PREPEND_SILENCE_MS", "0"))
VOICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+$")
ALLOWED_DOWNLOAD_FORMATS = {"wav", "mp3", "ogg"}
SUPERTONIC_VOICE_NAMES = ["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"]
SUPERTONIC_LANGS = {"en", "ko", "es", "pt", "fr"}
SUPERTONIC_PREINSTALLED = {"supertonic:en:M1", "supertonic:en:F1"}

try:
    from supertonic import TTS as SupertonicTTS
except Exception:
    SupertonicTTS = None

_SUPERTONIC_INSTANCE = None

VOICE_CATALOG = [
    {
        "id": "en_US-lessac-medium",
        "label": "English US - Lessac (Medium)",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium",
    },
    {
        "id": "en_US-amy-medium",
        "label": "English US - Amy (Medium)",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium",
    },
    {
        "id": "en_US-ryan-high",
        "label": "English US - Ryan (High)",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/high",
    },
    {
        "id": "en_US-libritts-high",
        "label": "English US - LibriTTS (High)",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/libritts/high",
    },
    {
        "id": "en_GB-alan-medium",
        "label": "English UK - Alan (Medium)",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium",
    },
    {
        "id": "en_GB-alba-medium",
        "label": "English UK - Alba (Medium)",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alba/medium",
    },
    {
        "id": "es_ES-sharvard-medium",
        "label": "Spanish ES - Sharvard (Medium)",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/sharvard/medium",
    },
    {
        "id": "fr_FR-siwis-medium",
        "label": "French FR - Siwis (Medium)",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/siwis/medium",
    },
    {
        "id": "de_DE-thorsten-medium",
        "label": "German DE - Thorsten (Medium)",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium",
    },
]
VOICE_CATALOG_BY_ID = {v["id"]: v for v in VOICE_CATALOG}

VOICES_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
STATE_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SETTINGS = {
    "voice": DEFAULT_VOICE,
    "speed": 1.0,
    "volume": 1.0,
    "downloadFormat": "wav",
    "theme": "dark",
    "autoPasteClipboard": False,
    "hotkeys": {},
    "prependSilenceMs": PREPEND_SILENCE_MS,
}


def read_json_file(path: Path, default_value):
    if not path.exists():
        return default_value
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default_value


def write_json_file(path: Path, data) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(data, ensure_ascii=True, indent=2), encoding="utf-8")
    tmp_path.replace(path)


def normalize_settings(data: dict) -> dict:
    incoming = data or {}
    merged = {**DEFAULT_SETTINGS, **incoming}
    merged["voice"] = str(merged.get("voice") or DEFAULT_VOICE).strip() or DEFAULT_VOICE
    merged["speed"] = float(merged.get("speed") or 1.0)
    merged["volume"] = float(merged.get("volume") or 1.0)
    merged["downloadFormat"] = safe_download_format(merged.get("downloadFormat") or "wav")
    merged["theme"] = "dark" if str(merged.get("theme") or "").lower() == "dark" else "light"
    merged["autoPasteClipboard"] = bool(merged.get("autoPasteClipboard"))
    merged["hotkeys"] = merged.get("hotkeys") if isinstance(merged.get("hotkeys"), dict) else {}
    try:
        silence_ms = int(merged.get("prependSilenceMs", PREPEND_SILENCE_MS))
    except (TypeError, ValueError):
        silence_ms = PREPEND_SILENCE_MS
    merged["prependSilenceMs"] = max(0, min(silence_ms, 3000))
    return merged


def load_settings() -> dict:
    return normalize_settings(read_json_file(SETTINGS_FILE, DEFAULT_SETTINGS))


def save_settings(data: dict) -> dict:
    settings = normalize_settings(data)
    write_json_file(SETTINGS_FILE, settings)
    return settings


def load_history() -> list:
    history = read_json_file(HISTORY_FILE, [])
    return history if isinstance(history, list) else []


def save_history(items: list) -> list:
    history = items if isinstance(items, list) else []
    write_json_file(HISTORY_FILE, history)
    return history


def ensure_default_voice() -> None:
    model_path = VOICES_DIR / f"{DEFAULT_VOICE}.onnx"
    config_path = VOICES_DIR / f"{DEFAULT_VOICE}.onnx.json"

    if model_path.exists() and config_path.exists():
        return

    default_info = VOICE_CATALOG_BY_ID.get(DEFAULT_VOICE)
    if default_info:
        download_voice(default_info["id"], default_info["base_url"])
        return

    model_url = f"{DEFAULT_VOICE_BASE}/{DEFAULT_VOICE}.onnx"
    config_url = f"{DEFAULT_VOICE_BASE}/{DEFAULT_VOICE}.onnx.json"
    download_file(model_url, model_path)
    download_file(config_url, config_path)


def ensure_preinstalled_piper_voices() -> None:
    # Preinstall only the default and Ryan for new installations.
    preinstall_ids = [DEFAULT_VOICE, "en_US-ryan-high"]
    seen = set()
    for voice_id in preinstall_ids:
        if voice_id in seen:
            continue
        seen.add(voice_id)
        item = VOICE_CATALOG_BY_ID.get(voice_id)
        if not item:
            continue
        try:
            download_voice(item["id"], item["base_url"])
        except Exception:
            # Non-fatal: API should still start and users can install later.
            pass


def download_file(url: str, target: Path) -> None:
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    target.write_bytes(response.content)


def download_voice(voice_id: str, base_url: str) -> None:
    model_path = VOICES_DIR / f"{voice_id}.onnx"
    config_path = VOICES_DIR / f"{voice_id}.onnx.json"
    if not model_path.exists():
        download_file(f"{base_url}/{voice_id}.onnx", model_path)
    if not config_path.exists():
        download_file(f"{base_url}/{voice_id}.onnx.json", config_path)


def list_voice_models():
    voices = []
    for model_file in sorted(VOICES_DIR.glob("*.onnx")):
        voices.append(
            {
                "id": model_file.stem,
                "label": model_file.stem.replace("_", " "),
                "model": str(model_file.name),
            }
        )
    voices.extend(list_supertone_models())
    return voices


def list_catalog_with_status():
    installed = {voice["id"] for voice in list_voice_models()}
    catalog = [
        {
            "id": item["id"],
            "label": item["label"],
            "installed": item["id"] in installed,
            "isDefault": item["id"] == DEFAULT_VOICE,
        }
        for item in VOICE_CATALOG
    ]
    catalog.extend(
        {
            "id": item["id"],
            "label": item["label"],
            "installed": item["id"] in installed,
            "isDefault": False,
        }
        for item in list_supertone_catalog()
    )
    return catalog


def list_supertone_catalog():
    entries = []
    for lang in sorted(SUPERTONIC_LANGS):
        for voice_name in SUPERTONIC_VOICE_NAMES:
            entries.append(
                {
                    "id": f"supertonic:{lang}:{voice_name}",
                    "label": f"Supertonic {lang.upper()} - {voice_name}",
                    "provider": "supertonic",
                }
            )
    return entries


def _read_supertone_state():
    raw = read_json_file(SUPERTONIC_STATE_FILE, None)
    if isinstance(raw, list):
        return raw
    return None


def _save_supertone_state(voice_ids):
    write_json_file(SUPERTONIC_STATE_FILE, sorted(set(voice_ids)))


def _is_existing_installation():
    # Preserve currently available voices for existing deployments.
    return SETTINGS_FILE.exists() or HISTORY_FILE.exists() or any(VOICES_DIR.glob("*.onnx"))


def get_enabled_supertone_voice_ids():
    configured = _read_supertone_state()
    valid_ids = {item["id"] for item in list_supertone_catalog()}
    if configured is None:
        enabled = valid_ids if _is_existing_installation() else set(SUPERTONIC_PREINSTALLED)
        enabled = {voice_id for voice_id in enabled if voice_id in valid_ids}
        _save_supertone_state(enabled)
        return enabled

    enabled = {voice_id for voice_id in configured if isinstance(voice_id, str) and voice_id in valid_ids}
    if set(configured) != enabled:
        _save_supertone_state(enabled)
    return enabled


def set_enabled_supertone_voice_ids(voice_ids):
    valid_ids = {item["id"] for item in list_supertone_catalog()}
    cleaned = {voice_id for voice_id in voice_ids if voice_id in valid_ids}
    _save_supertone_state(cleaned)
    return cleaned


def list_supertone_models():
    if SupertonicTTS is None:
        return []
    enabled = get_enabled_supertone_voice_ids()
    return [
        {
            "id": item["id"],
            "label": item["label"],
            "model": "supertonic",
        }
        for item in list_supertone_catalog()
        if item["id"] in enabled
    ]


def get_supertone_tts():
    global _SUPERTONIC_INSTANCE
    if SupertonicTTS is None:
        raise RuntimeError("supertonic package is not installed")
    if _SUPERTONIC_INSTANCE is None:
        _SUPERTONIC_INSTANCE = SupertonicTTS(auto_download=True)
    return _SUPERTONIC_INSTANCE


def synthesize_with_supertone(text: str, voice_id: str, speed: float, output_path: Path):
    parts = voice_id.split(":")
    if len(parts) != 3 or parts[0] != "supertonic":
        raise ValueError(f"invalid supertonic voice id: {voice_id}")
    lang = parts[1].strip().lower()
    voice_name = parts[2].strip().upper()
    if lang not in SUPERTONIC_LANGS:
        raise ValueError(f"unsupported supertonic language: {lang}")
    if voice_name not in SUPERTONIC_VOICE_NAMES:
        raise ValueError(f"unsupported supertonic voice style: {voice_name}")
    if voice_id not in get_enabled_supertone_voice_ids():
        raise ValueError(f"voice not installed: {voice_id}")

    tts = get_supertone_tts()
    style = tts.get_voice_style(voice_name=voice_name)
    try:
        wav, _duration = tts.synthesize(text, voice_style=style, lang=lang, speed=speed)
    except TypeError:
        # Fallback for older supertonic signatures that do not expose speed.
        wav, _duration = tts.synthesize(text, voice_style=style, lang=lang)
    tts.save_audio(wav, str(output_path))


def normalize_speed(speed: float) -> float:
    # Piper uses length_scale where larger values are slower.
    if speed <= 0:
        speed = 1.0
    speed = max(0.5, min(speed, 2.0))
    return round(1.0 / speed, 3)


def prepend_wav_silence(path: Path, silence_ms: int) -> None:
    if silence_ms <= 0:
        return
    with wave.open(str(path), "rb") as src:
        params = src.getparams()
        frames = src.readframes(src.getnframes())
        silent_frames = int(params.framerate * (silence_ms / 1000.0))
        silence = b"\x00" * (silent_frames * params.nchannels * params.sampwidth)

    tmp_path = path.with_suffix(".silence.tmp.wav")
    with wave.open(str(tmp_path), "wb") as dst:
        dst.setparams(params)
        dst.writeframes(silence)
        dst.writeframes(frames)
    tmp_path.replace(path)


def safe_audio_filename(name: str) -> str:
    parsed = urlparse(name)
    base = os.path.basename(parsed.path)
    if not base.endswith(".wav"):
        return ""
    return base


def safe_download_format(value: str) -> str:
    fmt = (value or "wav").strip().lower()
    return fmt if fmt in ALLOWED_DOWNLOAD_FORMATS else "wav"


def openapi_spec():
    base_url = request.host_url.rstrip("/")
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "Open-TTS API",
            "version": "0.4.0",
            "description": "API for Piper-based text-to-speech, voice management, and downloadable audio.",
        },
        "servers": [{"url": base_url}],
        "paths": {
            "/api/settings": {
                "get": {
                    "summary": "Read shared app settings",
                    "responses": {"200": {"description": "Settings"}},
                },
                "put": {
                    "summary": "Write shared app settings",
                    "requestBody": {
                        "required": True,
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    },
                    "responses": {"200": {"description": "Settings saved"}},
                },
            },
            "/api/history": {
                "get": {
                    "summary": "Read shared history",
                    "responses": {"200": {"description": "History"}},
                },
                "put": {
                    "summary": "Replace shared history",
                    "requestBody": {
                        "required": True,
                        "content": {"application/json": {"schema": {"type": "array"}}},
                    },
                    "responses": {"200": {"description": "History saved"}},
                },
                "post": {
                    "summary": "Append one history entry",
                    "requestBody": {
                        "required": True,
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    },
                    "responses": {"201": {"description": "Entry added"}},
                },
            },
            "/api/health": {
                "get": {
                    "summary": "Health check",
                    "responses": {"200": {"description": "OK"}},
                }
            },
            "/api/voices": {
                "get": {
                    "summary": "List installed voices and catalog",
                    "responses": {"200": {"description": "Voice list"}},
                }
            },
            "/api/voices/install": {
                "post": {
                    "summary": "Install a voice from the catalog",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {"voice": {"type": "string"}},
                                    "required": ["voice"],
                                }
                            }
                        },
                    },
                    "responses": {"201": {"description": "Installed"}},
                }
            },
            "/api/voices/{voice_id}": {
                "delete": {
                    "summary": "Uninstall voice model",
                    "parameters": [
                        {
                            "name": "voice_id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"},
                        }
                    ],
                    "responses": {"200": {"description": "Uninstalled"}},
                }
            },
            "/api/speak": {
                "post": {
                    "summary": "Synthesize speech with Piper",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "text": {"type": "string"},
                                        "voice": {"type": "string"},
                                        "speed": {"type": "number"},
                                    },
                                    "required": ["text"],
                                }
                            }
                        },
                    },
                    "responses": {"201": {"description": "Audio generated"}},
                }
            },
            "/api/audio/{name}": {
                "get": {
                    "summary": "Fetch generated WAV audio",
                    "parameters": [
                        {
                            "name": "name",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"},
                        }
                    ],
                    "responses": {"200": {"description": "WAV audio"}},
                }
            },
            "/api/download/{name}": {
                "get": {
                    "summary": "Download generated audio in selected format",
                    "parameters": [
                        {
                            "name": "name",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"},
                        },
                        {
                            "name": "format",
                            "in": "query",
                            "required": False,
                            "schema": {"type": "string", "enum": ["wav", "mp3", "ogg"]},
                        },
                    ],
                    "responses": {"200": {"description": "Download file"}},
                }
            },
            "/api/openapi.json": {
                "get": {
                    "summary": "OpenAPI document",
                    "responses": {"200": {"description": "OpenAPI spec"}},
                }
            },
            "/api/docs": {
                "get": {
                    "summary": "Swagger UI docs",
                    "responses": {"200": {"description": "Swagger UI"}},
                }
            },
        },
    }


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/settings")
def get_settings():
    return jsonify(load_settings())


@app.put("/api/settings")
def put_settings():
    body = request.get_json(silent=True) or {}
    saved = save_settings(body)
    return jsonify(saved)


@app.get("/api/history")
def get_history():
    return jsonify({"items": load_history()})


@app.put("/api/history")
def put_history():
    body = request.get_json(silent=True)
    if not isinstance(body, list):
        return jsonify({"error": "history body must be an array"}), 400
    saved = save_history(body)
    return jsonify({"ok": True, "items": saved})


@app.post("/api/history")
def post_history():
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return jsonify({"error": "history entry must be an object"}), 400

    entry = {
        "id": body.get("id") or uuid.uuid4().hex,
        "text": str(body.get("text") or "").strip(),
        "createdAt": body.get("createdAt"),
        "voice": str(body.get("voice") or DEFAULT_VOICE),
        "speed": float(body.get("speed") or 1.0),
        "audioUrl": str(body.get("audioUrl") or ""),
        "pinned": bool(body.get("pinned")),
    }
    if not entry["text"]:
        return jsonify({"error": "text is required"}), 400
    if not entry["createdAt"]:
        entry["createdAt"] = datetime.now(timezone.utc).isoformat()

    history = load_history()
    history.append(entry)
    save_history(history)
    return jsonify({"ok": True, "entry": entry}), 201


@app.get("/api/openapi.json")
def openapi_json():
    return jsonify(openapi_spec())


@app.get("/api/docs")
def docs():
    html = """<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Open-TTS API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis]
      });
    </script>
  </body>
</html>"""
    return Response(html, mimetype="text/html")


@app.get("/api/voices")
def voices():
    return jsonify(
        {
            "voices": list_voice_models(),
            "catalog": list_catalog_with_status(),
            "default": DEFAULT_VOICE,
        }
    )


@app.post("/api/voices/install")
def install_voice():
    body = request.get_json(silent=True) or {}
    voice_id = (body.get("voice") or "").strip()
    if not voice_id:
        return jsonify({"error": "voice is required"}), 400
    if not VOICE_ID_PATTERN.match(voice_id):
        return jsonify({"error": "invalid voice id"}), 400
    if voice_id.startswith("supertonic:"):
        supertone_ids = {item["id"] for item in list_supertone_catalog()}
        if voice_id not in supertone_ids:
            return jsonify({"error": f"voice not in catalog: {voice_id}"}), 404
        enabled = get_enabled_supertone_voice_ids()
        enabled.add(voice_id)
        set_enabled_supertone_voice_ids(enabled)
        return jsonify({"ok": True, "voice": voice_id}), 201
    catalog_item = VOICE_CATALOG_BY_ID.get(voice_id)
    if not catalog_item:
        return jsonify({"error": f"voice not in catalog: {voice_id}"}), 404

    try:
        download_voice(voice_id, catalog_item["base_url"])
    except requests.RequestException as exc:
        return jsonify({"error": f"download failed: {exc}"}), 502

    return jsonify({"ok": True, "voice": voice_id}), 201


@app.delete("/api/voices/<voice_id>")
def uninstall_voice(voice_id: str):
    voice_id = voice_id.strip()
    if not VOICE_ID_PATTERN.match(voice_id):
        return jsonify({"error": "invalid voice id"}), 400
    if voice_id.startswith("supertonic:"):
        enabled = get_enabled_supertone_voice_ids()
        removed = voice_id in enabled
        if removed:
            enabled.remove(voice_id)
            set_enabled_supertone_voice_ids(enabled)
        return jsonify({"ok": True, "removed": removed, "voice": voice_id})
    if voice_id == DEFAULT_VOICE:
        return jsonify({"error": "cannot uninstall default voice"}), 400

    model_path = VOICES_DIR / f"{voice_id}.onnx"
    config_path = VOICES_DIR / f"{voice_id}.onnx.json"
    removed = False
    for path in (model_path, config_path):
        if path.exists():
            path.unlink()
            removed = True

    return jsonify({"ok": True, "removed": removed, "voice": voice_id})


@app.post("/api/speak")
def speak():
    body = request.get_json(silent=True) or {}
    text = (body.get("text") or "").strip()
    voice = (body.get("voice") or DEFAULT_VOICE).strip()
    speed = float(body.get("speed") or 1.0)
    current_settings = load_settings()
    silence_ms = int(current_settings.get("prependSilenceMs", PREPEND_SILENCE_MS))
    if body.get("prependSilenceMs") is not None:
        try:
            silence_ms = int(body.get("prependSilenceMs"))
        except (TypeError, ValueError):
            silence_ms = int(current_settings.get("prependSilenceMs", PREPEND_SILENCE_MS))
    silence_ms = max(0, min(silence_ms, 3000))

    if not text:
        return jsonify({"error": "text is required"}), 400

    output_name = f"{uuid.uuid4().hex}.wav"
    output_path = AUDIO_DIR / output_name

    if voice.startswith("supertonic:"):
        try:
            synthesize_with_supertone(text, voice, speed, output_path)
        except Exception as exc:
            return jsonify({"error": f"supertonic synthesis failed: {exc}"}), 500
    else:
        model_path = VOICES_DIR / f"{voice}.onnx"
        if not model_path.exists():
            fallback_model = VOICES_DIR / f"{DEFAULT_VOICE}.onnx"
            if fallback_model.exists():
                voice = DEFAULT_VOICE
                model_path = fallback_model
            else:
                return jsonify({"error": f"voice not found: {voice}"}), 400

        cmd = [
            PIPER_BIN,
            "--model",
            str(model_path),
            "--output_file",
            str(output_path),
            "--length_scale",
            str(normalize_speed(speed)),
        ]

        try:
            subprocess.run(
                cmd,
                input=text.encode("utf-8"),
                capture_output=True,
                check=True,
                timeout=SPEAK_TIMEOUT_SECONDS,
            )
        except subprocess.CalledProcessError as exc:
            return (
                jsonify(
                    {
                        "error": "piper synthesis failed",
                        "stderr": exc.stderr.decode("utf-8", errors="ignore"),
                    }
                ),
                500,
            )
        except subprocess.TimeoutExpired:
            return jsonify({"error": "piper synthesis timed out"}), 504

    try:
        prepend_wav_silence(output_path, silence_ms)
    except Exception as exc:
        # Do not fail synthesis when silence prepend fails.
        print(f"[open-tts] warning: could not prepend silence: {exc}")

    return (
        jsonify(
            {
                "audioUrl": f"/api/audio/{output_name}",
                "voice": voice,
                "speed": speed,
            }
        ),
        201,
    )


@app.get("/api/audio/<path:name>")
def audio(name: str):
    filename = safe_audio_filename(name)
    if not filename:
        return jsonify({"error": "invalid filename"}), 400
    return send_from_directory(AUDIO_DIR, filename, mimetype="audio/wav")


@app.get("/api/download/<path:name>")
def download_audio(name: str):
    filename = safe_audio_filename(name)
    if not filename:
        return jsonify({"error": "invalid filename"}), 400

    source_path = AUDIO_DIR / filename
    if not source_path.exists():
        return jsonify({"error": "audio not found"}), 404

    fmt = safe_download_format(request.args.get("format", "wav"))
    if fmt == "wav":
        return send_from_directory(
            AUDIO_DIR,
            filename,
            mimetype="audio/wav",
            as_attachment=True,
            download_name=filename,
        )

    if not shutil.which("ffmpeg"):
        return jsonify({"error": "ffmpeg is required for mp3/ogg conversion"}), 501

    converted_name = f"{source_path.stem}.{fmt}"
    converted_path = AUDIO_DIR / converted_name
    if (not converted_path.exists()) or converted_path.stat().st_mtime < source_path.stat().st_mtime:
        cmd = ["ffmpeg", "-y", "-i", str(source_path), str(converted_path)]
        try:
            subprocess.run(cmd, capture_output=True, check=True, timeout=60)
        except subprocess.CalledProcessError as exc:
            return (
                jsonify(
                    {
                        "error": "audio conversion failed",
                        "stderr": exc.stderr.decode("utf-8", errors="ignore"),
                    }
                ),
                500,
            )
        except subprocess.TimeoutExpired:
            return jsonify({"error": "audio conversion timed out"}), 504

    mime = "audio/mpeg" if fmt == "mp3" else "audio/ogg"
    return send_from_directory(
        AUDIO_DIR,
        converted_name,
        mimetype=mime,
        as_attachment=True,
        download_name=converted_name,
    )


def try_ensure_default_voice():
    try:
        ensure_preinstalled_piper_voices()
    except Exception as exc:
        # Keep API available even when default model download is unavailable.
        print(f"[open-tts] warning: could not ensure default voice: {exc}")


if __name__ == "__main__":
    try_ensure_default_voice()
    app.run(host="0.0.0.0", port=5000)
else:
    try_ensure_default_voice()
