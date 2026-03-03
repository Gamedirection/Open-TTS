# Changelog

All notable changes to this project are documented in this file.

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
