# Open-TTS

Chat-style local text-to-speech app powered by Piper, with history, pinning, downloads, keyboard controls, and Docker/Swarm deployment.

## Version
- Current app version: `0.3.0`
- See `CHANGELOG.md` for release history.

## Features
- Chat-like TTS workflow (submit text, auto-generate audio, replay).
- Single-entry multiline sequencing (lines are read one-by-one in order).
- Playback queue: no overlapping audio; new requests wait their turn.
- Stop playback (`Stop` button, `Esc`, configurable hotkey).
- Word highlight + visualizer while audio plays.
- Local history and pinned sidebar (browser `localStorage`).
- Download audio as `wav`, `mp3`, or `ogg`.
- Voice model management (install/uninstall catalog voices).
- Settings for server URL, voice, speed, theme, volume, hotkeys.
- Config export/import (JSON).
- Bulk delete actions (pinned / unpinned) with confirmation.
- Browser extension (Chrome + Firefox) with popup speak/stop and context-menu read.

## Runtime Dependencies

### Host dependencies
- Docker Engine (with Compose plugin)
- For Swarm mode: Docker Swarm initialized on the target node

### Container dependencies
- Backend:
  - Python 3.11
  - `Flask`, `flask-cors`, `requests`, `piper-tts`
  - `ffmpeg` (for mp3/ogg conversion)
- Frontend:
  - Nginx serving static UI and reverse-proxying `/api`
- Swagger UI service:
  - `swaggerapi/swagger-ui`

## Project Structure
- `backend/` API + Piper integration
- `frontend/` static web app
- `extension/` browser extension source (Chrome + Firefox)
- `docker-compose.yml` local Compose deployment (includes Swagger UI service)
- `docker-compose.swarm.yml` Docker Swarm stack file
- `.env` local environment values
- `.env.example` template values for new users
- `CHANGELOG.md` release notes

## Environment Configuration
Copy from template if needed:

```bash
cp .env.example .env
```

Key variables:
- `WEB_PORT` default `3015`
- `API_PORT` default `3016`
- `SWAGGER_PORT` default `3017`
- `WEB_IMAGE`, `API_IMAGE`
- `PIPER_DEFAULT_VOICE`, `PIPER_DEFAULT_VOICE_BASE`, `PIPER_TIMEOUT_SECONDS`

## Local Deployment (Docker Compose)

Build and start:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

Stop:

```bash
docker compose down
```

## Docker Swarm Deployment

1. Build images on the target node:

```bash
docker build -t tts-api:local ./backend
docker build -t tts-web:local ./frontend
```

2. Initialize swarm (once):

```bash
docker swarm init
```

3. Deploy stack:

```bash
docker stack deploy -c docker-compose.swarm.yml tts
```

4. Verify:

```bash
docker stack services tts
```

5. Remove:

```bash
docker stack rm tts
```

## Access URLs
- Main UI: `http://localhost:3015`
- Backend API health: `http://localhost:3016/api/health`
- In-app Swagger UI (served by API): `http://localhost:3015/api/docs`
- OpenAPI JSON (dynamic): `http://localhost:3015/api/openapi.json`
- Standalone Swagger UI service (Compose/Swarm): `http://localhost:3017`

## Browser Extension (Chrome + Firefox)

Extension source lives in `extension/` and provides:
- popup UI with:
  - server URL input
  - last generated entry display
  - submission box
  - `Speak` and `Stop` controls
  - `Settings` button that opens main Open-TTS site
- context menu:
  - highlight any text in browser
  - right-click: `Read selected text with Open-TTS`

### Load in Chrome
1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `extension/` folder.

### Load in Firefox
1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on...`.
3. Select `extension/manifest.json`.

### Extension Notes
- Default server URL is `http://localhost:3016`.
- Default settings URL opens `http://localhost:3015`.
- Context-menu playback is queued in-page to avoid overlapping speech.

## API Overview

Core endpoints:
- `GET /api/health`
- `GET /api/voices`
- `POST /api/voices/install`
- `DELETE /api/voices/{voice_id}`
- `POST /api/speak`
- `GET /api/audio/{name}`
- `GET /api/download/{name}?format=wav|mp3|ogg`
- `GET /api/openapi.json`
- `GET /api/docs`

Use either:
- direct API port (`3016`) for programmatic clients, or
- proxied route (`/api`) via web port (`3015`) for browser use.

## Notes
- On first run, default voice model files are downloaded automatically.
- Voice and audio artifacts persist in Docker volumes:
  - `piper_voices`
  - `piper_audio`
- Browser-side state (history/settings/pins/hotkeys/config) is stored in `localStorage`.
- `.env` can contain local/private deployment values; keep it private in shared/public repos.
