// Procedural WebAudio SFX (jsfxr-style). No audio files. Mute persisted in meta settings.
import { G } from './state';

export type Sfx = 'hit' | 'crit' | 'hurt' | 'dash' | 'pickup' | 'coin' | 'levelup' | 'ui' | 'shoot' | 'explode' | 'boss' | 'door' | 'deny' | 'magic' | 'guard' | 'death' | 'win'
  // v2 skills polish: one voice per active skill + cast wind-up, ready ping, cancel
  | 'cast' | 'ready' | 'cancel' | 'sp_ice' | 'sp_fire' | 'sp_chain' | 'sp_arcane' | 'sp_shield' | 'sp_blink'
  | 'sk_bash' | 'sk_spin' | 'sk_shadow' | 'sk_iaido' | 'sk_iaido_perfect' | 'sk_pierce' | 'sk_nova';
export const SKILL_SFX: Sfx[] = ['sp_ice', 'sp_fire', 'sp_chain', 'sp_arcane', 'sp_shield', 'sp_blink', 'sk_bash', 'sk_spin', 'sk_shadow', 'sk_iaido', 'sk_pierce', 'sk_nova'];
let ctx: AudioContext | null = null; let master: GainNode | null = null;
export const sfxLog: string[] = [];
function ac(): AudioContext | null {
  if (ctx) return ctx;
  try { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx!.createGain(); master.connect(ctx!.destination); } catch { return null; }
  return ctx;
}
export function unlockAudio() { const c = ac(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }
function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.3, delay = 0) {
  const c = ac(); if (!c || !master) return; const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain(); o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0), t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol = 0.3, hp = 400) {
  const c = ac(); if (!c || !master) return; const n = Math.floor(c.sampleRate * dur); const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = c.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
let last: Record<string, number> = {};
export function sfx(name: Sfx) {
  sfxLog.push(name); if (sfxLog.length > 200) sfxLog.shift();
  if (G.meta.settings.mute) return;
  const now = performance.now(); if (now - (last[name] ?? 0) < 35) return; last[name] = now;
  if (master) master.gain.value = G.meta.settings.sfxVolume ?? 0.6;
  switch (name) {
    case 'hit': noise(0.07, 0.25, 900); tone('square', 320, 120, 0.08, 0.12); break;
    case 'crit': noise(0.1, 0.3, 600); tone('square', 640, 160, 0.14, 0.16); break;
    case 'hurt': tone('sawtooth', 300, 80, 0.2, 0.2); break;
    case 'dash': noise(0.12, 0.15, 2000); break;
    case 'pickup': tone('sine', 660, 990, 0.08, 0.15); break;
    case 'coin': tone('square', 990, 1320, 0.06, 0.08); tone('square', 1320, 1760, 0.06, 0.08, 0.05); break;
    case 'levelup': [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.12, 0.18, i * 0.08)); break;
    case 'ui': tone('sine', 520, 700, 0.05, 0.12); break;
    case 'shoot': tone('square', 900, 300, 0.07, 0.08); break;
    case 'explode': noise(0.35, 0.35, 120); tone('sine', 120, 40, 0.3, 0.25); break;
    case 'boss': tone('sawtooth', 110, 55, 0.6, 0.25); break;
    case 'door': tone('triangle', 200, 400, 0.15, 0.15); break;
    case 'deny': tone('square', 200, 150, 0.12, 0.12); break;
    case 'magic': tone('sine', 400, 1200, 0.2, 0.15); break;
    case 'guard': tone('square', 1200, 900, 0.06, 0.15); noise(0.05, 0.2, 3000); break;
    case 'death': tone('triangle', 400, 60, 0.8, 0.25); break;
    case 'cast': tone('sine', 300, 620, 0.12, 0.08); break;
    case 'ready': tone('triangle', 1046, 1318, 0.07, 0.07); break;
    case 'cancel': tone('sine', 500, 260, 0.1, 0.08); break;
    case 'sp_ice': tone('triangle', 1500, 900, 0.14, 0.12); noise(0.06, 0.1, 5000); break;
    case 'sp_fire': noise(0.25, 0.22, 200); tone('sawtooth', 180, 90, 0.22, 0.12); break;
    case 'sp_chain': noise(0.12, 0.2, 2500); tone('square', 1800, 600, 0.1, 0.08); tone('square', 1400, 500, 0.08, 0.06, 0.06); break;
    case 'sp_arcane': [700, 900, 1100].forEach((f, i) => tone('sine', f, f * 1.3, 0.08, 0.08, i * 0.05)); break;
    case 'sp_shield': tone('sine', 330, 660, 0.3, 0.14); tone('triangle', 495, 990, 0.3, 0.08); break;
    case 'sp_blink': tone('sine', 1200, 300, 0.12, 0.12); tone('sine', 300, 1200, 0.1, 0.08, 0.08); break;
    case 'sk_bash': noise(0.12, 0.3, 300); tone('square', 160, 70, 0.14, 0.18); break;
    case 'sk_spin': noise(0.3, 0.16, 1200); tone('sawtooth', 220, 440, 0.3, 0.08); break;
    case 'sk_shadow': tone('sine', 900, 200, 0.1, 0.1); noise(0.08, 0.15, 3000); break;
    case 'sk_iaido': noise(0.06, 0.25, 4000); tone('square', 1400, 300, 0.12, 0.12); break;
    case 'sk_iaido_perfect': noise(0.08, 0.3, 4000); tone('triangle', 2000, 1500, 0.25, 0.16); tone('triangle', 3000, 2400, 0.2, 0.08, 0.04); break;
    case 'sk_pierce': tone('square', 1200, 200, 0.16, 0.12); noise(0.1, 0.2, 1500); break;
    case 'sk_nova': noise(0.4, 0.3, 150); tone('sine', 220, 50, 0.35, 0.22); tone('triangle', 660, 220, 0.25, 0.08); break;
    case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.2, 0.2, i * 0.12)); break;
  }
}
export function setMute(m: boolean) { G.meta.settings.mute = m; G.saveMeta(); if (m) stopMusic(true); else if (musicArea >= 0) { const a = musicArea; musicArea = -1; playMusic(a); } }

// ---------------- ambient music (v2) ----------------
// Tiny procedural loop per area: a soft two-oscillator pad chord every 2 bars + a sparse pentatonic pluck.
// ~3 short-lived oscillators per beat through one low-passed bus; scheduled 0.3 s ahead from a timer (not the
// game loop). Off when muted (global mute) or when the player turns music off (persisted in localStorage).
interface Area { root: number; scale: number[]; bpm: number; chords: number[][]; wave: OscillatorType; cut: number }
const AREAS: Area[] = [
  { root: 196.0, scale: [0, 2, 4, 7, 9], bpm: 76, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], wave: 'triangle', cut: 1400 }, // hub: warm G major
  { root: 220.0, scale: [0, 2, 4, 7, 9], bpm: 84, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], wave: 'triangle', cut: 1500 }, // ch1 Rừng Rêu
  { root: 174.6, scale: [0, 3, 5, 7, 10], bpm: 92, chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], wave: 'sawtooth', cut: 900 }, // ch2 mine, minor
  { root: 261.6, scale: [0, 2, 4, 7, 11], bpm: 70, chords: [[0, 4, 11], [5, 9, 16], [2, 5, 9], [7, 11, 14]], wave: 'sine', cut: 2200 }, // ch3 library, maj7
  { root: 233.1, scale: [0, 2, 3, 7, 9], bpm: 64, chords: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]], wave: 'sine', cut: 1800 }, // ch4 ice, dorian
  { root: 164.8, scale: [0, 3, 5, 6, 7, 10], bpm: 100, chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [-2, 2, 5]], wave: 'square', cut: 700 }, // ch5 steam works, blues
  { root: 207.7, scale: [0, 2, 6, 7, 11], bpm: 60, chords: [[0, 4, 7, 11], [2, 6, 9], [-1, 2, 6], [6, 9, 13]], wave: 'sine', cut: 2600 }, // ch6 star core, lydian
];
const MUSIC_KEY = 'thapsao_music';
let musicBus: GainNode | null = null; let musicArea = -1; let musicTimer: any = null; let nextBeat = 0; let beatN = 0; let seed = 1;
export function musicEnabled(): boolean { try { return localStorage.getItem(MUSIC_KEY) !== '0'; } catch { return true; } }
export function setMusicEnabled(on: boolean) { try { localStorage.setItem(MUSIC_KEY, on ? '1' : '0'); } catch { /* private mode */ } if (!on) stopMusic(); else if (musicArea >= 0) { const a = musicArea; musicArea = -1; playMusic(a); } }
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function note(c: AudioContext, bus: AudioNode, type: OscillatorType, f: number, t: number, dur: number, vol: number, attack = 0.01) {
  const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function schedule() {
  const c = ctx; if (!c || !musicBus || c.state !== 'running' || musicArea < 0) return;
  const A = AREAS[musicArea] ?? AREAS[0]; const beat = 60 / A.bpm;
  if (nextBeat < c.currentTime) nextBeat = c.currentTime + 0.05;
  while (nextBeat < c.currentTime + 0.3) {
    const bar = Math.floor(beatN / 4), inBar = beatN % 4; const semi = (s: number) => A.root * Math.pow(2, s / 12);
    if (inBar === 0 && bar % 2 === 0) { // pad chord, 2 bars long
      const ch = A.chords[(bar / 2) % A.chords.length];
      for (const s of ch) { note(c, musicBus, A.wave, semi(s - 12), nextBeat, beat * 8, 0.05, beat * 1.5); note(c, musicBus, 'sine', semi(s - 12) * 1.004, nextBeat, beat * 8, 0.035, beat * 2); }
      note(c, musicBus, 'sine', semi(ch[0] - 24), nextBeat, beat * 4, 0.08, 0.05); // soft bass
    }
    if (rnd() < (inBar === 0 ? 0.75 : 0.4)) { // pluck
      const deg = A.scale[Math.floor(rnd() * A.scale.length)] + (rnd() < 0.3 ? 12 : 0);
      note(c, musicBus, 'triangle', semi(deg), nextBeat + (rnd() < 0.25 ? beat / 2 : 0), beat * 1.6, 0.06);
    }
    nextBeat += beat; beatN++;
  }
}
/** Start (or switch to) the loop for an area: 0 = hub, 1..6 = chapters. Safe to call every second. */
export function playMusic(area: number) {
  if (area === musicArea && musicTimer) return;
  musicArea = area;
  if (G.meta.settings.mute || !musicEnabled()) { stopMusic(true); return; }
  const c = ac(); if (!c || !master) return;
  if (!musicBus) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4; musicBus = c.createGain(); musicBus.connect(lp); lp.connect(c.destination); (musicBus as any)._lp = lp; }
  const A = AREAS[area] ?? AREAS[0]; ((musicBus as any)._lp as BiquadFilterNode).frequency.setTargetAtTime(A.cut, c.currentTime, 0.5);
  musicBus.gain.setTargetAtTime(0.5 * (G.meta.settings.sfxVolume ?? 0.6), c.currentTime, 0.8);
  seed = 1 + area * 977; beatN = 0; nextBeat = 0;
  if (!musicTimer) musicTimer = setInterval(schedule, 120);
}
export function stopMusic(keepArea = false) {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  if (!keepArea) musicArea = -1;
}
export const musicState = () => ({ area: musicArea, playing: !!musicTimer, enabled: musicEnabled() });
