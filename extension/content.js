(() => {
  const state = {
    queue: [],
    running: false,
    audio: null
  };

  function stopPlayback() {
    state.queue = [];
    if (state.audio) {
      state.audio.pause();
      state.audio.currentTime = 0;
      state.audio = null;
    }
    state.running = false;
  }

  function enqueue(audioUrl) {
    state.queue.push(audioUrl);
    processQueue();
  }

  async function processQueue() {
    if (state.running) return;
    state.running = true;
    while (state.queue.length) {
      const audioUrl = state.queue.shift();
      await new Promise((resolve) => {
        const audio = new Audio(audioUrl);
        state.audio = audio;
        audio.addEventListener("ended", resolve, { once: true });
        audio.addEventListener("error", resolve, { once: true });
        audio.play().catch(resolve);
      });
      state.audio = null;
    }
    state.running = false;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "open_tts_ping") {
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === "open_tts_play_audio") {
      if (message.audioUrl) enqueue(message.audioUrl);
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === "open_tts_stop_audio") {
      stopPlayback();
      sendResponse({ ok: true });
    }
  });
})();
