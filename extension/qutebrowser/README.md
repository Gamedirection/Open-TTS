Qutebrowser Integration
=======================

This folder contains userscripts and config snippets to send selected text
to the Open-TTS API from qutebrowser. The Windows userscript plays audio
directly using the built-in `winsound` module to avoid browser autoplay
restrictions.

Files
-----
- `config.py`: Linux keybindings to trigger the userscript.
- `open-tts`: Linux userscript that POSTs selected text to Open-TTS.
- `open-tts.py`: Windows userscript (downloads audio and plays it).
- `open-tts.cmd`: Windows userscript launcher.
- `open-tts-stop.py`: Windows stop playback script.
- `open-tts-stop.cmd`: Windows stop playback launcher.
- `install.ps1`: Windows installer that adds userscripts and appends bindings.

Install
-------
Linux
1. Copy `open-tts` into your qutebrowser userscripts directory:
   - `~/.local/share/qutebrowser/userscripts/`
2. Ensure it is executable.
3. Add the `config.py` snippet to your qutebrowser `config.py`.

Windows
1. Run the installer from PowerShell:

```powershell
cd path\\to\\Open-TTS\\extension\\qutebrowser
.\install.ps1
```

2. Restart qutebrowser.

Windows bindings added by the installer:
- `,t` speak selected text
- `,T` speak current page URL
- `,s` stop playback

By default the Windows userscript uses `http://localhost:3016/api/speak`.
To target a different server, set `OPEN_TTS_API` in `open-tts.cmd` or pass
`-ApiUrl` to the installer:

```powershell
.\install.ps1 -ApiUrl "http://100.106.163.87:3016/api/speak"
```

The installer does not overwrite existing `config.py` content; it appends a
small binding block if it is not already present. It also skips copying
userscripts if they already exist (unless you pass `-Force`).

Environment
-----------
You can override the API endpoint by setting:
`OPEN_TTS_API=http://localhost:3016/api/speak`

Dependencies
------------
Linux:
- `curl`
- `python3`

Windows:
- `python`
