"""
Open-TTS qutebrowser bindings.

Append this file's contents to your qutebrowser config.py.
"""

# Read selected text with Open-TTS.
config.bind(",t", "spawn --userscript open-tts")

# Read current page URL with Open-TTS (optional).
config.bind(",T", "spawn --userscript open-tts --page")

# Optional overrides (examples):
# config.bind(",tv", "spawn --userscript open-tts --voice en_US-lessac-medium")
# config.bind(",ts", "spawn --userscript open-tts --speed 1.1")
# config.bind(",tV", "spawn --userscript open-tts --volume 0.8")
