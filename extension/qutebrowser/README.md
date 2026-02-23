Qutebrowser Integration
=======================

This folder contains a small userscript and config snippet to send selected
text to the Open-TTS API from qutebrowser.

Files
-----
- `config.py`: keybindings to trigger the userscript.
- `open-tts`: userscript that POSTs selected text to Open-TTS.

Install
-------
1. Copy `open-tts` into your qutebrowser userscripts directory:
   - Linux: `~/.local/share/qutebrowser/userscripts/`
2. Ensure it is executable.
3. Add the `config.py` snippet to your qutebrowser `config.py`.

Environment
-----------
You can override the API endpoint by setting:
`OPEN_TTS_API=http://localhost:3016/api/speak`

Dependencies
------------
- `curl`
- `python3`
