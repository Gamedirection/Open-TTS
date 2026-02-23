@echo off
REM Optional defaults (uncomment and edit):
REM set "OPEN_TTS_API=http://localhost:3016/api/speak"
REM set "OPEN_TTS_VOICE=en_US-lessac-medium"
REM set "OPEN_TTS_SPEED=1.0"
REM set "OPEN_TTS_VOLUME=1.0"
python "%~dp0open-tts.py" %*
