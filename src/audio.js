// Synthesised audio (GDD 11.4): dice clacks, chimes, buzz, and a soft ambient loop.
// Everything is generated with WebAudio, so there are no audio files to load.

import { save } from './save.js';

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let musicTimer = null, musicStep = 0, nextNoteTime = 0;

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

/** Call from a user gesture to unlock audio on mobile browsers. */
export function unlockAudio() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
  syncMusic();
}

function tone(freq, dur, { type = 'sine', gain = 0.2, when = 0, bus = sfxBus, attack = 0.005, slideTo = 0 } = {}) {
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(dur, freq, q, gain) {
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t0, Math.random() * 0.1, dur + 0.02);
}

const on = () => save.settings.sound && ensure() && ctx.state === 'running';

export const sfx = {
  clack(i = 0) {
    if (!on()) return;
    noise(0.05, 1700 + Math.random() * 1400 + (i % 3) * 180, 2.2, 0.5);
    tone(150 + Math.random() * 50, 0.07, { type: 'triangle', gain: 0.22 });
  },
  land() { if (on()) { noise(0.09, 900, 1.2, 0.5); tone(110, 0.12, { type: 'sine', gain: 0.3 }); } },
  chime() {
    if (!on()) return;
    [1318.5, 1760, 2637].forEach((f, i) => tone(f, 0.5, { gain: 0.16, when: i * 0.07 }));
  },
  wrong() { if (on()) { tone(330, 0.16, { type: 'triangle', gain: 0.2, slideTo: 220 }); tone(220, 0.22, { type: 'triangle', gain: 0.18, when: 0.12, slideTo: 160 }); } },
  buzz() { if (on()) tone(95, 0.13, { type: 'sawtooth', gain: 0.09 }); },
  tap() { if (on()) tone(880, 0.05, { type: 'triangle', gain: 0.1 }); },
  star(i = 0) { if (on()) tone([1046.5, 1318.5, 1568][i] || 1568, 0.4, { gain: 0.2 }); },
  win() { if (on()) [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.45, { type: 'triangle', gain: 0.2, when: i * 0.1 })); },
  fail() { if (on()) [392, 329.6, 261.6].forEach((f, i) => tone(f, 0.4, { type: 'triangle', gain: 0.18, when: i * 0.16 })); },
  portal() { if (on()) { tone(520, 0.28, { type: 'sine', gain: 0.14, slideTo: 1560 }); tone(780, 0.3, { type: 'triangle', gain: 0.06, when: 0.05, slideTo: 2080 }); } },
  crumble() { if (on()) { noise(0.22, 420, 0.8, 0.45); tone(90, 0.2, { type: 'triangle', gain: 0.15, slideTo: 50 }); } },
  whoosh() { if (on()) noise(0.12, 2600, 0.9, 0.25); },
  pad() { if (on()) { tone(660, 0.09, { type: 'square', gain: 0.05 }); tone(440, 0.14, { type: 'triangle', gain: 0.12, when: 0.05 }); } },
  undo() { if (on()) tone(700, 0.16, { type: 'triangle', gain: 0.12, slideTo: 420 }); },
  open() { if (on()) [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.14, when: i * 0.06 })); },
  coin() { if (on()) { tone(1568, 0.08, { type: 'square', gain: 0.06 }); tone(2093, 0.25, { type: 'square', gain: 0.06, when: 0.07 }); } },
};

// ---------- ambient music: slow pad chords with a sparse pentatonic melody ----------
const CHORDS = [[261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 329.63], [196.0, 246.94, 293.66, 392.0]];
const MELODY = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const BEAT = 0.5;

function schedule() {
  if (!ctx) return;
  while (nextNoteTime < ctx.currentTime + 0.6) {
    const when = Math.max(0, nextNoteTime - ctx.currentTime);
    const bar = Math.floor(musicStep / 8) % CHORDS.length;
    if (musicStep % 8 === 0) {
      for (const f of CHORDS[bar]) tone(f / 2, BEAT * 8.5, { type: 'sine', gain: 0.07, when, bus: musicBus, attack: 1.2 });
    }
    const r = Math.sin(musicStep * 12.9898) * 43758.5453; // deterministic pseudo-random
    const frac = r - Math.floor(r);
    if (musicStep % 2 === 0 && frac > 0.35) {
      tone(MELODY[Math.floor(frac * 97) % MELODY.length], 0.9, { type: 'triangle', gain: 0.045, when, bus: musicBus, attack: 0.02 });
    }
    musicStep++; nextNoteTime += BEAT;
  }
}

export function syncMusic() {
  if (!ctx) return;
  const want = save.settings.music && !document.hidden;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(want ? 1 : 0, ctx.currentTime, 0.4);
  if (want && !musicTimer) {
    nextNoteTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(schedule, 200);
  } else if (!want && musicTimer) {
    clearInterval(musicTimer); musicTimer = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
  syncMusic();
});

export function vibrate(pattern) {
  if (save.settings.vibration && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* unsupported */ } }
}
