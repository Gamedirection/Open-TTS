# Changelog

All notable changes to this project are documented in this file.

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

## [0.3.0] - 2026-02-23
- Renamed project branding to `Open-TTS`.
- Added browser extension for Chrome and Firefox in `extension/`.
- Extension supports:
  - compact popup UI with server URL, last entry, submit box, speak/stop
  - settings button opening main site
  - right-click context-menu readout for selected text on any page

## [0.1.0] - 2026-02-23
- Initial Piper chat TTS web application.
- Dockerized frontend/backend with local persistence volumes.
- Chat history, pinning, replay, downloads, settings, themes, keyboard navigation.
- Voice catalog install/uninstall and playback speed support.
