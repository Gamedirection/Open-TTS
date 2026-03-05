# Open-TTS

Open-TTS is a Docker-first text-to-speech service and web UI with chat-style playback, voice management, downloads, and browser extension support.

## Version
- Current app version: `0.6.0`
- See `CHANGELOG.md` for release history.

## Highlights
- Web UI with history, pinning, downloads, and keyboard shortcuts.
- Queue-based playback to avoid overlap.
- Segmented playback pipelining for faster long-text startup.
- Skip-ahead playback control (`>>`) and improved stop-all behavior.
- Local-only web persistence (history + settings are not shared across browsers/devices).
- Phonetic dictionary with add/remove and pronunciation preview.
- Duplicate phonetic-word detection (newest duplicate wins).
- Voice providers:
- Piper voices (model-based).
- Supertonic voices (provider-based).
- Configurable startup silence (`prependSilenceMs`) to avoid clipped first words.
- Dialogue voice routing with quote-first behavior:
- Quoted speech can switch to male/female/speaker voices.
- Non-quoted text remains narrator voice by default.
- Dynamic speaker profiles with add/remove support.
- Dialog command pill manager with default aliases, custom aliases, and reset support.
- Clickable voice chips in message headers for role color customization.
- Theme-aware role color contrast adjustment for light/dark mode.
- Collapsible settings sections with persisted state.
- Dark mode default.
- Browser extension (Chrome + Firefox) with popup controls and context-menu readout.

<img width="1688" height="1890" alt="image" src="https://github.com/user-attachments/assets/bcbdb317-72cf-4058-ac49-a1e67fc84bb5" />
<img width="1786" height="2017" alt="image" src="https://github.com/user-attachments/assets/cba34b64-8dbd-4396-b730-a0e0db1edb95" />
<img width="856" height="704" alt="image" src="https://github.com/user-attachments/assets/40325635-87c3-4890-bcfa-ea44430176fc" />


## Requirements
- Docker Engine with Docker Compose plugin.
- Network access from containers for model downloads (Piper/Supertonic) if models are not already cached.

## Install And Setup (Docker Compose)
1. Clone and enter the repo.

```bash
git clone https://github.com/Gamedirection/Open-TTS.git
cd Open-TTS
```

2. Create local env file.

```bash
cp .env.example .env
```

3. Start services.

```bash
docker compose up -d --build
```

4. Verify services.

```bash
docker compose ps
curl http://localhost:3016/api/health
```

5. Open the app.
- UI: `http://localhost:3015`
- API health: `http://localhost:3016/api/health`
- Swagger UI: `http://localhost:3017`

## Upgrade Or Redeploy
Use this after pulling updates:

```bash
git pull --rebase
docker compose up -d --build
```

## First-Install Voice Behavior
On a fresh install, preinstalled voices are intentionally limited to:
- Piper: `en_US-lessac-medium`
- Piper: `en_US-ryan-high`
- Supertonic: `supertonic:en:M1`
- Supertonic: `supertonic:en:F1`

Existing deployments are preserved and are not force-pruned.
Users can install additional voices later from the UI or API.

## Settings Notes
Web app settings and history are local to each browser profile/device.
They are not synced across browsers or machines.

Current defaults include:
- `theme`: `dark`
- `prependSilenceMs`: `250`

`prependSilenceMs` is applied as dead air at the start of generated WAV output.
Range: `0` to `3000` ms.

## Browser Extension
Extension source is in `extension/`.

### Install In Chrome
1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `extension/` folder.

### Install In Firefox
1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on...`.
3. Select `extension/manifest.json`.

### Configure Extension
1. Open extension popup.
2. Set server URL to your API host, for example:
- `http://localhost:3016`
- `http://<server-ip>:3016`
3. Open extension Settings panel and choose playback voice/speed/volume.
4. Save settings.

Notes:
- Extension settings are local to that browser profile (`chrome.storage.local`).
- Extension can auto-paste clipboard and auto-speak on popup open when enabled.

## OpenAPI Access
- Direct API OpenAPI JSON: `http://localhost:3016/api/openapi.json`
- Direct API docs UI: `http://localhost:3016/api/docs`
- Proxied via web port:
- `http://localhost:3015/api/openapi.json`
- `http://localhost:3015/api/docs`
- Separate Swagger container UI: `http://localhost:3017`

## API Overview
Core endpoints:
- `GET /api/health`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/history`
- `PUT /api/history`
- `POST /api/history`
- `GET /api/voices`
- `POST /api/voices/install`
- `DELETE /api/voices/{voice_id}`
- `POST /api/speak`
- `GET /api/audio/{name}`
- `GET /api/download/{name}?format=wav|mp3|ogg`
- `GET /api/openapi.json`
- `GET /api/docs`

Security notes:
- `GET/PUT /api/settings` and `GET/PUT/POST /api/history` require `X-OpenTTS-Client`.
- `/api/speak` returns tokenized `audioUrl`.
- `/api/audio/{name}` and `/api/download/{name}` require the token in query parameters.

Use either:
- Direct API port (`3016`) for API clients, or
- Proxied route via web port (`3015`) using `/api/*`.

## Production Checklist
- [ ] Pin and review image/base dependency versions.
- [ ] Set stable `.env` values for `WEB_PORT`, `API_PORT`, `SWAGGER_PORT`.
- [ ] Put TLS and auth in front of UI/API.
- [ ] Restrict CORS and host exposure to required origins only.
- [ ] Persist Docker volumes and back up state/voice/audio data.
- [ ] Confirm `prependSilenceMs` and voice defaults match requirements.
- [ ] Add container health checks and restart policies.
- [ ] Monitor logs and disk growth for `/data/audio`.
- [ ] Test upgrade path on staging before production rollout.

## Dev Update Checklist
- [ ] Pull latest `main` and rebase local branch.
- [ ] Run local syntax checks and targeted tests.
- [ ] Update `CHANGELOG.md` for user-visible behavior changes.
- [ ] Update `README.md` for setup/runtime/feature changes.
- [ ] Update `backend/openapi.static.json` for API changes.
- [ ] Rebuild containers with `docker compose up -d --build`.
- [ ] Verify `GET /api/health` and `GET /api/voices`.
- [ ] Verify web settings save/load and extension popup behavior.
- [ ] Verify voice install/uninstall and playback startup quality.

## Troubleshooting
- `Settings sync failed (404)`: check server URL and whether `/api/settings` exists on the target API.
- Missing first words: increase `prependSilenceMs` in app settings.
- If audio/download returns `403`: ensure you are using the tokenized URL returned by `/api/speak`.
- Voice install issues: inspect backend logs and network access for model download hosts.
- API not starting: check `docker compose logs api` for model download or dependency errors.
