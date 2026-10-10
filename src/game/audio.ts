// Procedural WebAudio SFX (jsfxr-style). No audio files. Mute persisted in meta settings.
import { G } from './state';

type Sfx = 'hit' | 'crit' | 'hurt' | 'dash' | 'pickup' | 'coin' | 'levelup' | 'ui' | 'shoot' | 'explode' | 'boss' | 'door' | 'deny' | 'magic' | 'guard' | 'death' | 'win';
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
    case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.2, 0.2, i * 0.12)); break;
  }
}
export function setMute(m: boolean) { G.meta.settings.mute = m; G.saveMeta(); }
