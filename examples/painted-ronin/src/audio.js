// The sound: ZzFX (Frank Force, MIT) makes every effect from a list of numbers, so no sound files ship; the wind is filtered noise;
// the koto is the Karplus-Strong plucked string (Karplus & Strong, 1983), a few notes of the in scale now and then.
import { ZZFX, zzfx } from 'zzfx';

const ctx = ZZFX.audioContext;
ZZFX.volume = 0.35;
let started = false, wind = null, master = null, nextNote = 3;
const SFX = {
  swing: [0.55, 0.05, 330, 0.01, 0.04, 0.16, 4, 0.6, -9, 0, 0, 0, 0, 2.2, 0, 0, 0, 0.5, 0.05, 0, 1800],
  heavy: [0.7, 0.05, 200, 0.02, 0.07, 0.24, 4, 0.6, -6, 0, 0, 0, 0, 2.6, 0, 0, 0, 0.5, 0.06, 0, 1300],
  cut: [1, 0.1, 140, 0, 0.03, 0.22, 3, 2.2, 0, 0, 0, 0, 0, 1.6, 0, 0.15, 0, 0.5, 0.05],
  clash: [0.8, 0.05, 1300, 0, 0.01, 0.3, 0, 1.6, 0, 0, 640, 0.01, 0, 0.3, 0, 0.08, 0, 0.55, 0.05],
  hurt: [0.9, 0.1, 90, 0, 0.04, 0.25, 2, 1.4, -2, 0, 0, 0, 0, 1, 0, 0.1, 0, 0.6, 0.05],
  roll: [0.45, 0.05, 120, 0.02, 0.08, 0.2, 4, 0.5, -3, 0, 0, 0, 0, 3, 0, 0, 0, 0.4, 0.06, 0, 700],
  fall: [0.9, 0.1, 55, 0, 0.05, 0.4, 3, 1.2, -1, 0, 0, 0, 0, 1.4, 0, 0.1, 0, 0.6, 0.1],
  alert: [0.5, 0, 520, 0.02, 0.12, 0.2, 1, 1.2, 0, 0, 120, 0.06, 0, 0, 0, 0, 0, 0.6, 0.05],
};
export function play(name, vol = 1) { if (!started || !SFX[name]) return; const p = SFX[name].slice(); p[0] *= vol; zzfx(...p); }

function noiseBuffer(sec) { const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { last = 0.97 * last + 0.03 * (Math.random() * 2 - 1); d[i] = last * 6; } return b; }
function pluck(freq) {                                   // Karplus-Strong: a burst of noise through a delay line that averages itself
  const n = Math.round(ctx.sampleRate / freq), len = Math.round(ctx.sampleRate * 2.4), out = ctx.createBuffer(1, len, ctx.sampleRate), d = out.getChannelData(0);
  const line = new Float32Array(n); for (let i = 0; i < n; i++) line[i] = Math.random() * 2 - 1;
  for (let i = 0, k = 0; i < len; i++, k = (k + 1) % n) { const nx = (k + 1) % n; const v = line[k]; d[i] = v; line[k] = 0.4985 * (v + line[nx]); }
  return out;
}
const IN_SCALE = [146.83, 155.56, 196.0, 220.0, 233.08, 293.66, 311.13, 392.0];   // D, E♭, G, A, B♭ (the in scale), two octaves
let plucks = null;

export function startAudio() {
  if (started) return; started = true;
  ctx.resume?.();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(3); src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = 0.05; src.connect(lp); lp.connect(g); g.connect(master); src.start();
  wind = { lp, g };
  plucks = IN_SCALE.map(pluck);
}

export function updateAudio(dt, { speed = 0, danger = 0 } = {}) {
  if (!started) return;
  const t = ctx.currentTime, gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.077 + 1.3);
  wind.g.gain.setTargetAtTime(0.03 + 0.05 * gust + 0.02 * Math.min(1, speed / 7), t, 0.4);
  wind.lp.frequency.setTargetAtTime(300 + 400 * gust, t, 0.5);
  nextNote -= dt;
  if (nextNote <= 0 && danger < 0.5) {
    nextNote = 2.5 + Math.random() * 5;
    const k = Math.floor(Math.random() * IN_SCALE.length), s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = plucks[k]; g.gain.value = 0.09 + Math.random() * 0.05; s.connect(g); g.connect(master); s.start();
    if (Math.random() < 0.4) { const s2 = ctx.createBufferSource(), g2 = ctx.createGain(); s2.buffer = plucks[(k + 2) % IN_SCALE.length]; g2.gain.value = 0.06; s2.connect(g2); g2.connect(master); s2.start(ctx.currentTime + 0.32); }
  }
}
