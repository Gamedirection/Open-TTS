import json
import os
import sys
import tempfile
import time
import urllib.parse
import urllib.request

API_URL = os.environ.get("OPEN_TTS_API", "http://localhost:3016/api/speak")
DEFAULT_VOICE = os.environ.get("OPEN_TTS_VOICE", "")
DEFAULT_SPEED = os.environ.get("OPEN_TTS_SPEED", "")
DEFAULT_VOLUME = os.environ.get("OPEN_TTS_VOLUME", "")


def _qute_message(text: str) -> None:
    qute_fifo = os.environ.get("QUTE_FIFO", "")
    if not qute_fifo:
        return
    with open(qute_fifo, "w", encoding="utf-8") as f:
        f.write(text + "\n")


def _play_wav_sync(data: bytes) -> bool:
    try:
        import winsound
    except Exception:
        return False

    fd, path = tempfile.mkstemp(suffix=".wav", prefix="open-tts-")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        # Small delay to avoid clipping the start of playback on some systems.
        time.sleep(0.25)
        winsound.PlaySound(path, winsound.SND_FILENAME)
        return True
    except Exception:
        return False


def _parse_args(argv):
    voice = DEFAULT_VOICE
    speed = DEFAULT_SPEED
    volume = DEFAULT_VOLUME
    use_page = False

    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--page":
            use_page = True
        elif arg == "--voice" and i + 1 < len(argv):
            voice = argv[i + 1]
            i += 1
        elif arg == "--speed" and i + 1 < len(argv):
            speed = argv[i + 1]
            i += 1
        elif arg == "--volume" and i + 1 < len(argv):
            volume = argv[i + 1]
            i += 1
        i += 1

    return use_page, voice, speed, volume


def main() -> int:
    use_page, voice, speed, volume = _parse_args(sys.argv[1:])
    text = os.environ.get("QUTE_SELECTED_TEXT", "")
    if use_page:
        text = os.environ.get("QUTE_URL", "")

    if not text:
        _qute_message("message-info 'Open-TTS: no selected text.'")
        return 0

    payload_obj = {"text": text}
    if voice:
        payload_obj["voice"] = voice
    if speed:
        payload_obj["speed"] = speed
    if volume:
        payload_obj["volume"] = volume

    payload = json.dumps(payload_obj).encode("utf-8")
    req = urllib.request.Request(API_URL, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
    except Exception as exc:
        _qute_message(f"message-error 'Open-TTS: request failed: {exc}'")
        return 1

    try:
        data = json.loads(body)
        audio_url = data.get("audioUrl", "")
    except Exception:
        audio_url = ""

    if not audio_url:
        _qute_message("message-info 'Open-TTS: sent to server.'")
        return 0

    base = API_URL.split("/api/")[0] + "/"
    full_url = urllib.parse.urljoin(base, audio_url)

    try:
        with urllib.request.urlopen(full_url, timeout=10) as resp:
            audio_bytes = resp.read()
    except Exception as exc:
        _qute_message(f"message-error 'Open-TTS: audio fetch failed: {exc}'")
        return 1

    if _play_wav_sync(audio_bytes):
        _qute_message("message-info 'Open-TTS: playing audio.'")
        return 0

    _qute_message(f"open -r {full_url}")
    _qute_message("message-info 'Open-TTS: opened audio in tab.'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
