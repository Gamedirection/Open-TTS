import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path
from urllib.parse import urlparse

import requests
from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

VOICES_DIR = Path(os.getenv("PIPER_VOICES_DIR", "/data/voices"))
AUDIO_DIR = Path(os.getenv("PIPER_AUDIO_DIR", "/data/audio"))
DEFAULT_VOICE = os.getenv("PIPER_DEFAULT_VOICE", "en_US-lessac-medium")
DEFAULT_VOICE_BASE = os.getenv(
    "PIPER_DEFAULT_VOICE_BASE",
    "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium",
)
PIPER_BIN = os.getenv("PIPER_BIN", "piper")
SPEAK_TIMEOUT_SECONDS = int(os.getenv("PIPER_TIMEOUT_SECONDS", "60"))
VOICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+$")
ALLOWED_DOWNLOAD_FORMATS = {"wav", "mp3", "ogg"}

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
    return voices


def list_catalog_with_status():
    installed = {voice["id"] for voice in list_voice_models()}
    return [
        {
            "id": item["id"],
            "label": item["label"],
            "installed": item["id"] in installed,
            "isDefault": item["id"] == DEFAULT_VOICE,
        }
        for item in VOICE_CATALOG
    ]


def normalize_speed(speed: float) -> float:
    # Piper uses length_scale where larger values are slower.
    if speed <= 0:
        speed = 1.0
    speed = max(0.5, min(speed, 2.0))
    return round(1.0 / speed, 3)


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
            "version": "0.3.0",
            "description": "API for Piper-based text-to-speech, voice management, and downloadable audio.",
        },
        "servers": [{"url": base_url}],
        "paths": {
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

    if not text:
        return jsonify({"error": "text is required"}), 400

    model_path = VOICES_DIR / f"{voice}.onnx"
    if not model_path.exists():
        fallback_model = VOICES_DIR / f"{DEFAULT_VOICE}.onnx"
        if fallback_model.exists():
            voice = DEFAULT_VOICE
            model_path = fallback_model
        else:
            return jsonify({"error": f"voice not found: {voice}"}), 400

    output_name = f"{uuid.uuid4().hex}.wav"
    output_path = AUDIO_DIR / output_name

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


if __name__ == "__main__":
    ensure_default_voice()
    app.run(host="0.0.0.0", port=5000)
else:
    ensure_default_voice()
