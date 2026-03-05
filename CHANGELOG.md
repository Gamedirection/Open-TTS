# Changelog

All notable changes to this project are documented in this file.

## [0.6.0] - 2026-03-05
- Improved long-text startup latency with segmented synthesis/playback pipelining:
- First segments play earlier while later segments synthesize in background.
- Added skip-ahead playback control (`>>`) for quicker navigation.
- Improved segmented stop behavior so `Stop` reliably cancels all further chunks.
- Added client-isolated server settings/history:
- `/api/settings` and `/api/history` now require `X-OpenTTS-Client`.
- Data is stored per client identity instead of a shared global file.
- Hardened audio/download access with signed expiring URL tokens:
- `/api/speak` now returns tokenized audio URLs.
- `/api/audio/{name}` and `/api/download/{name}` reject missing/invalid tokens.
- Added phonetic dictionary workflow in web UI:
- Add/remove pronunciation replacements.
- Play per-entry pronunciation preview.
- Dictionary replacements are applied before synthesis.
- Dictionary is included in config export/import.
- Added dictionary duplicate-word handling:
- Duplicate words are highlighted.
- The newest duplicate entry is treated as active and used for synthesis.
- Added richer message metadata display:
- Header now shows all voices used in playback for a message.
- Added role color customization:
- Default role colors for narrator/male/female/speaker1..speaker4.
- Click voice chips in message header to open color picker.
- Theme-aware color contrast adjustment for light/dark mode.
- Improved dark-mode link contrast with lighter hyperlink colors.
- Added collapsible settings sections with persisted expand/collapse state.
- Updated default voices:
- Voice + Male: `en_US-ryan-high`
- Female: `en_US-amy-medium`
- Narrator: `en_GB-alan-medium`
- Improved quote-based highlighting alignment and timing for multi-speaker lines.
- Updated settings Credits GitHub link to:
- `https://github.com/Gamedirection/Open-TTS`

## [0.5.0] - 2026-03-03
- Switched web app persistence to local-only per browser/device for history and settings.
- Removed web history sync and extension history sync with `/api/history`.
- Switched extension settings storage from `chrome.storage.sync` to `chrome.storage.local`.
- Cleared server-side shared history and kept existing API endpoints for optional integrations.
- Added dialogue voice routing features:
- Configurable Narrator, Male, Female, and Speaker voices.
- Dynamic speaker profiles with add/remove support in settings.
- Quote-first parsing behavior:
- Speaker voice applies to quoted text only.
- Non-quoted text defaults to narrator voice.
- Added auto-generated dialog command aliases from speaker profiles and names.
- Added pill-based dialog command manager:
- Preloaded defaults, add/remove custom aliases, reset-to-defaults button.
- Added per-voice dropdown `Test Voice` buttons in settings.
- Improved first-play reliability:
- Added voice warm-up before first playback.
- Added narrator chunking for long submissions (paragraphs / sentence groups).
- Added pause between voice changes to improve fluidity and avoid overlap artifacts.
- Added direct OpenAPI access links in web settings credits (`/api/docs`, `/api/openapi.json`).
- Updated README and release docs to reflect local-only behavior and new dialogue workflow.

## [0.4.0] - 2026-02-23
- Added Supertonic voice provider support in backend synthesis and voice listing.
- Added support for Supertonic voice IDs in `/api/voices`, `/api/voices/install`, and `/api/voices/{voice_id}`.
- Added startup resilience so API can boot even if default Piper voice download fails.
- Added configurable startup silence prepend for generated WAV files (to reduce clipped first words).
- Added server setting `prependSilenceMs` (default `350`) and frontend Settings control for it.
- Changed web app default theme to dark mode.
- Added dedicated server-backed Settings panel in web app with sync status text.
- Improved config import/export behavior to include new shared settings and sync server state.
- Refined extension behavior:
- Extension settings are now local-only (no main-site settings sync dependency).
- Added extension popup settings panel and clearer labeled playback controls.
- Added extension clipboard auto-paste and auto-speak on popup open when enabled.
- Improved extension playback startup buffering to reduce clipped first words.
- Added URL normalization fixes for extension server URL handling.
- Added defensive popup fallback when settings panel elements are unavailable.

## [0.3.0] - 2026-02-23
- Renamed project branding to `Open-TTS`.
- Added browser extension for Chrome and Firefox in `extension/`.
- Extension supports:
- Compact popup UI with server URL, last entry, submit box, speak/stop.
- Settings button and context-menu readout for selected text.

## [0.2.0] - 2026-02-23
- Added settings credits block with author/site/chat/version/github placeholder.
- Added configurable hotkeys and config export/import.
- Added in-app volume slider with persistence.
- Added stop playback button and `Esc` handling for stopping audio.
- Added queue-based playback so overlapping requests are serialized.
- Added bulk actions in settings: delete all pinned / delete all unpinned with confirmation.
- Added multiline playback sequencing in a single chat entry.
- Added OpenAPI endpoint (`/api/openapi.json`) and in-app Swagger (`/api/docs`).
- Added standalone Swagger UI service in Docker Compose (`swagger` service).

## [0.1.0] - 2026-02-23
- Initial Piper chat TTS web application.
- Dockerized frontend/backend with local persistence volumes.
- Chat history, pinning, replay, downloads, settings, themes, keyboard navigation.
- Voice catalog install/uninstall and playback speed support.
