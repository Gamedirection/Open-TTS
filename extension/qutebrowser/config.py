"""
Open-TTS qutebrowser bindings.

Append this file's contents to your qutebrowser config.py.
"""

# Read selected text with Open-TTS.
config.bind(",t", "spawn --userscript open-tts")

# Read current page URL with Open-TTS (optional).
config.bind(",T", "spawn --userscript open-tts --page")
