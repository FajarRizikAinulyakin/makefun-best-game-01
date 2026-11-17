// Sound, synthesized with WebAudio only — no audio files, no network.
// The engine is created lazily on the first user gesture (browsers block audio
// before one) and stays silent in screenshot mode, where nothing calls init().
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function init() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
    } catch {
      context = null;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(dur, vol, lowpass) {
    if (!context || muted) return;
    try {
      const now = context.currentTime;
      const len = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = context.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(now);
    } catch {
      // Ignore audio failures.
    }
  }

  // A quiet two-note-per-step bass arpeggio that loops while playing.
  const MUSIC_NOTES = [110, 0, 130.8, 0, 98, 0, 146.8, 0, 110, 0, 164.8, 0, 98, 0, 123.5, 0];
  function startMusic() {
    if (!context || musicTimer) return;
    musicStep = 0;
    musicTimer = window.setInterval(() => {
      const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      musicStep += 1;
      if (note) tone(note, 0.34, 'triangle', 0.10);
    }, 170);
  }
  function stopMusic() {
    if (musicTimer) window.clearInterval(musicTimer);
    musicTimer = null;
  }

  return {
    init,
    startMusic,
    stopMusic,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(720 + Math.random() * 120, 0.07, 'square', 0.05, 320);
    },
    hit() {
      tone(220, 0.06, 'sawtooth', 0.07, 140);
    },
    explode() {
      noise(0.28, 0.22, 900);
      tone(160, 0.22, 'sine', 0.16, 42);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.10);
      window.setTimeout(() => tone(990, 0.12, 'sine', 0.10), 70);
    },
    hurt() {
      tone(180, 0.18, 'sawtooth', 0.14, 70);
      noise(0.12, 0.12, 500);
    },
    dash() {
      noise(0.14, 0.10, 2400);
    },
    bomb() {
      noise(0.5, 0.28, 600);
      tone(90, 0.45, 'sine', 0.20, 30);
    },
    wave() {
      tone(392, 0.16, 'triangle', 0.12);
      window.setTimeout(() => tone(523, 0.22, 'triangle', 0.12), 140);
    },
    boss() {
      tone(65, 0.7, 'sawtooth', 0.16, 40);
      noise(0.5, 0.14, 300);
    },
    gameOver() {
      tone(330, 0.3, 'triangle', 0.12, 220);
      window.setTimeout(() => tone(220, 0.5, 'triangle', 0.12, 110), 260);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.3, 'triangle', 0.12), i * 130));
    },
    click() {
      tone(880, 0.05, 'sine', 0.08);
    },
  };
}
