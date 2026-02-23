(() => {
  const state = {
    queue: [],
    running: false,
    audio: null
  };

  function waitForAudioReady(audio, timeoutMs = 2500) {
    return new Promise((resolve) => {
      if (audio.readyState >= 3) {
        resolve();
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        audio.removeEventListener("canplaythrough", finish);
        audio.removeEventListener("loadeddata", finish);
        resolve();
      };

      const timer = setTimeout(finish, timeoutMs);
      audio.addEventListener("canplaythrough", finish, { once: true });
      audio.addEventListener("loadeddata", finish, { once: true });
    });
  }

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
        audio.preload = "auto";
        state.audio = audio;
        audio.addEventListener("ended", resolve, { once: true });
        audio.addEventListener("error", resolve, { once: true });
        waitForAudioReady(audio)
          .then(() => new Promise((r) => setTimeout(r, 120)))
          .then(() => {
            audio.currentTime = 0;
            return audio.play();
          })
          .catch(() => resolve());
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
