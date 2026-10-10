// Enemy AI kit (all AiKind values) and boss pattern system. Pure decision functions that return actions;
// the scene executes them. Framework-free (SPEC §6).
import type { AiKind, BossDef, BossAttack } from '../data/types';
import type { Rng } from './rng';

export type AiAction =
  | { type: 'shoot'; angle: number; speed: number; count: number; spread: number; kind?: string }
  | { type: 'ring'; count: number; speed: number; offset: number; kind?: string }
  | { type: 'telegraphLine'; angle: number; length: number; time: number }
  | { type: 'telegraphCircle'; x: number; y: number; radius: number; time: number }
  | { type: 'lob'; x: number; y: number; radius: number; delay: number }
  | { type: 'summon'; count: number; ids?: string[] }
  | { type: 'heal'; radius: number; pct: number; amount?: number }
  | { type: 'teleport'; x: number; y: number }
  | { type: 'explode'; radius: number }
  | { type: 'charge'; angle: number; speed: number; duration: number }
  | { type: 'hazard'; x: number; y: number; radius: number; delay: number }
  | { type: 'phase'; index: number; onEnter?: string; summon?: string[] };

export interface Agent {
  x: number; y: number; vx: number; vy: number; ai: AiKind; speed: number; state: string; t: number; cd: number;
  angle: number; params: Record<string, number>; shieldAngle: number; hp: number; maxHp: number; bounds?: { w: number; h: number };
}
export function newAgent(ai: AiKind, x: number, y: number, speed: number, hp: number, params: Record<string, number> = {}): Agent {
  return { x, y, vx: 0, vy: 0, ai, speed, state: 'idle', t: 0, cd: 0.6 + Math.random() * 0.8, angle: 0, params, shieldAngle: 0, hp, maxHp: hp };
}
const ang = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.y - a.y, b.x - a.x);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
function steer(a: Agent, angle: number, mult = 1) { a.vx = Math.cos(angle) * a.speed * mult; a.vy = Math.sin(angle) * a.speed * mult; }
function keepRange(a: Agent, p: { x: number; y: number }, want: number) {
  const d = dist(a, p), an = ang(a, p);
  if (d > want + 40) steer(a, an); else if (d < want - 40) steer(a, an + Math.PI, 0.8); else steer(a, an + Math.PI / 2, 0.4);
}

/** param lookup with aliases (content vocabulary: fireRate, bulletCount, bulletSpeed, keepDistance, telegraph, chargeSpeed...) */
export function pr(P: Record<string, number>, keys: string[], d: number): number { for (const k of keys) if (typeof P[k] === 'number') return P[k]; return d; }
export function think(a: Agent, p: { x: number; y: number }, dt: number, rng: Rng): AiAction[] {
  const out: AiAction[] = []; a.t += dt; a.cd -= dt;
  const d = dist(a, p), an = ang(a, p); a.angle = an;
  const P = a.params;
  switch (a.ai) {
    case 'chaser': steer(a, an); break;
    case 'charger': {
      if (a.state === 'idle') { steer(a, an, 0.7); if (d < pr(P, ['range'], 260) && a.cd <= 0) { a.state = 'windup'; a.t = 0; a.shieldAngle = an; out.push({ type: 'telegraphLine', angle: an, length: 240, time: pr(P, ['windup', 'telegraph'], 0.7) }); } }
      else if (a.state === 'windup') { a.vx = a.vy = 0; if (a.t >= pr(P, ['windup', 'telegraph'], 0.7)) { a.state = 'dash'; a.t = 0; } }
      else if (a.state === 'dash') { a.vx = Math.cos(a.shieldAngle) * pr(P, ['chargeSpeed'], a.speed * 3.6); a.vy = Math.sin(a.shieldAngle) * pr(P, ['chargeSpeed'], a.speed * 3.6); if (a.t >= pr(P, ['chargeDuration'], 0.45)) { a.state = 'recover'; a.t = 0; } }
      else { a.vx = a.vy = 0; if (a.t >= 0.6) { a.state = 'idle'; a.cd = pr(P, ['cooldown'], 1.2); } }
      break;
    }
    case 'shooter': keepRange(a, p, pr(P, ['keepDistance'], 220)); if (a.cd <= 0) { a.cd = pr(P, ['cooldown', 'fireRate'], 1.7); const n = pr(P, ['bulletCount', 'count'], 1); out.push({ type: 'shoot', angle: an, speed: pr(P, ['bulletSpeed'], 200), count: n, spread: n > 1 ? 0.3 : 0, kind: 'arrow' }); } break;
    case 'spread': keepRange(a, p, pr(P, ['keepDistance'], 240)); if (a.cd <= 0) { a.cd = pr(P, ['cooldown', 'fireRate'], 2.1); out.push({ type: 'shoot', angle: an, speed: pr(P, ['bulletSpeed'], 180), count: pr(P, ['bulletCount', 'count'], 5), spread: pr(P, ['spreadDeg'], 50) * Math.PI / 180 }); } break;
    case 'ring': if (d < pr(P, ['keepDistance'], 0)) steer(a, an + Math.PI, 0.5); else steer(a, an + Math.sin(a.t) * 1.2, 0.5); if (a.cd <= 0) { a.cd = pr(P, ['cooldown', 'fireRate'], 2.6); out.push({ type: 'ring', count: pr(P, ['count', 'bulletCount'], 10), speed: pr(P, ['bulletSpeed'], 140), offset: rng.next() * Math.PI }); } break;
    case 'lobber': keepRange(a, p, pr(P, ['keepDistance'], 260)); if (a.cd <= 0) { a.cd = pr(P, ['cooldown', 'fireRate'], 2.4); const lx = p.x + rng.range(-20, 20), ly = p.y + rng.range(-20, 20); out.push({ type: 'lob', x: lx, y: ly, radius: pr(P, ['radius', 'aoeRadius'], 46), delay: pr(P, ['telegraph'], 1.0) }); } break;
    case 'summoner': keepRange(a, p, pr(P, ['keepDistance'], 280)); if (a.cd <= 0) { a.cd = pr(P, ['summonInterval', 'cooldown', 'fireRate'], 5); out.push({ type: 'summon', count: pr(P, ['count', 'summonCount'], 2) }); } break;
    case 'shielded': {
      let diff = an - a.shieldAngle; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
      a.shieldAngle += Math.sign(diff) * Math.min(Math.abs(diff), pr(P, ['turnSpeed'], 2.2) * dt);
      steer(a, an, 0.8); break;
    }
    case 'exploder': {
      if (a.state === 'idle') { steer(a, an, 1.1); if (d < pr(P, ['triggerRange'], 44)) { a.state = 'fuse'; a.t = 0; out.push({ type: 'telegraphCircle', x: a.x, y: a.y, radius: pr(P, ['radius', 'aoeRadius', 'blastRadius'], 64), time: pr(P, ['fuse', 'telegraph'], 0.6) }); } }
      else { a.vx = a.vy = 0; if (a.t >= pr(P, ['fuse', 'telegraph'], 0.6)) { out.push({ type: 'explode', radius: pr(P, ['radius', 'aoeRadius', 'blastRadius'], 64) }); a.state = 'done'; } }
      break;
    }
    case 'teleporter': {
      if (a.state === 'idle') { steer(a, an + Math.PI / 2, 0.5); if (a.cd <= 0) { a.state = 'blink'; a.t = 0; const r = rng.range(110, 170), th = rng.next() * Math.PI * 2; a.params._tx = p.x + Math.cos(th) * r; a.params._ty = p.y + Math.sin(th) * r; out.push({ type: 'telegraphCircle', x: a.params._tx, y: a.params._ty, radius: 22, time: 0.5 }); } }
      else { a.vx = a.vy = 0; if (a.t >= 0.5) { out.push({ type: 'teleport', x: a.params._tx, y: a.params._ty }); out.push({ type: 'shoot', angle: ang({ x: a.params._tx, y: a.params._ty }, p), speed: 190, count: 3, spread: 0.5 }); a.state = 'idle'; a.cd = pr(P, ['teleportInterval', 'cooldown'], 3); } }
      break;
    }
    case 'turret': a.vx = a.vy = 0; if (a.cd <= 0) { a.cd = pr(P, ['cooldown', 'fireRate'], 1.4); if (rng.chance(0.3)) out.push({ type: 'ring', count: 8, speed: 130, offset: a.t }); else out.push({ type: 'shoot', angle: an, speed: 230, count: 1, spread: 0 }); } break;
    case 'healer': keepRange(a, p, pr(P, ['keepDistance'], 300)); if (a.cd <= 0) { a.cd = pr(P, ['healInterval', 'cooldown'], 3); out.push({ type: 'heal', radius: pr(P, ['healRadius', 'radius'], 170), pct: pr(P, ['healPct'], 15) > 1 ? pr(P, ['healPct'], 15) / 100 : pr(P, ['healPct'], 0.15), amount: P.healAmount }); } break;
  }
  return out;
}
/** Shielded enemies block hits coming from their front 120° arc. */
export function shieldBlocks(a: Agent, from: { x: number; y: number }): boolean {
  if (a.ai !== 'shielded') return false;
  let d = ang(a, from) - a.shieldAngle; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) <= Math.PI / 3;
}

// ---------------- bosses ----------------
export type BossAction = AiAction
  | { type: 'laser'; angle: number; sweep: number; duration: number; width: number; beams: number; telegraph: number }
  | { type: 'mine'; x: number; y: number; radius: number; arm: number; life: number }
  | { type: 'shield'; duration: number; reflect: boolean }
  | { type: 'slam'; radius: number; telegraph: number; mult: number };
export interface BossBrain { phase: number; cd: number; cur: { atk: BossAttack; t: number; step: number; angle: number; tx?: number; ty?: number } | null; enraged: boolean; shieldT: number }
export const newBrain = (): BossBrain => ({ phase: 0, cd: 1.2, cur: null, enraged: false, shieldT: 0 });
export function phaseFor(def: BossDef, hpRatio: number): number {
  let idx = 0; def.phases.forEach((ph, i) => { if (hpRatio <= ph.hpBelow + 1e-9) idx = i; }); return idx;
}
export function ringAngles(count: number, offset = 0): number[] { return Array.from({ length: count }, (_, i) => offset + (i / count) * Math.PI * 2); }
export const BOSS_PATTERNS = ['ring', 'spiral', 'crossWave', 'cross', 'aimedBurst', 'aimed', 'charge', 'summon', 'hazard', 'rainMarkers', 'slam', 'minefield', 'laserSweep', 'shieldPhase', 'teleportStrike'];

export function bossThink(b: BossBrain, def: BossDef, hpRatio: number, me: Agent, p: { x: number; y: number }, arena: { w: number; h: number }, dt: number, rng: Rng): BossAction[] {
  const out: BossAction[] = [];
  if (b.shieldT > 0) b.shieldT = Math.max(0, b.shieldT - dt);
  const ph = phaseFor(def, hpRatio);
  if (ph !== b.phase) { b.phase = ph; b.cur = null; b.cd = 0.8; const pd = def.phases[ph]; out.push({ type: 'phase', index: ph, onEnter: pd.onEnter, summon: pd.summon }); if (pd.onEnter) b.enraged = true; }
  const phase = def.phases[b.phase];
  const speedMul = b.enraged ? 1.2 : 1;
  if (!b.cur) {
    const an = ang(me, p); const d = dist(me, p);
    if (d > 150) steer(me, an, 0.6); else steer(me, an + Math.PI / 2, 0.4);
    b.cd -= dt * speedMul;
    if (b.cd <= 0 && phase.attacks.length) { const atk = rng.weighted(phase.attacks, (x) => x.weight); b.cur = { atk, t: 0, step: 0, angle: an }; }
    return out;
  }
  const c = b.cur; const P = c.atk.params; c.t += dt * speedMul; me.vx = me.vy = 0;
  const done = (cool = 1.0) => { b.cur = null; b.cd = cool; };
  const tele = pr(P, ['telegraph'], 0);
  switch (c.atk.pattern) {
    case 'ring': {
      const waves = pr(P, ['waves', 'bursts'], 1), gap = pr(P, ['waveGap', 'burstGap'], 0.45);
      if (c.step === 0 && tele > 0 && c.t < tele) { if (c.tx === undefined) { c.tx = 1; out.push({ type: 'telegraphCircle', x: me.x, y: me.y, radius: 70, time: tele }); } break; }
      const t0 = c.t - tele;
      if (t0 >= c.step * gap && c.step < waves) { out.push({ type: 'ring', count: pr(P, ['count'], 12), speed: pr(P, ['speed'], 150), offset: c.angle + c.step * (Math.PI / pr(P, ['count'], 12)), kind: 'orb' }); c.step++; }
      if (c.step >= waves) done(); break;
    }
    case 'spiral': {
      const rate = pr(P, ['rate'], 12), dur = pr(P, ['duration'], (pr(P, ['shots'], 24)) / 12), arms = pr(P, ['arms'], 3), turn = pr(P, ['turnDeg'], 15) * Math.PI / 180;
      const shots = Math.round(rate * dur);
      while (c.t >= c.step / rate && c.step < shots) { out.push({ type: 'ring', count: arms, speed: pr(P, ['speed'], 150), offset: c.angle + c.step * turn, kind: 'star' }); c.step++; }
      if (c.step >= shots) done(1.2); break;
    }
    case 'cross': case 'crossWave': {
      const waves = pr(P, ['waves'], 3), gap = pr(P, ['waveGap'], 0.5), arms = pr(P, ['arms'], 4), rot = pr(P, ['rotateDeg'], 45) * Math.PI / 180, cnt = pr(P, ['count'], 5);
      if (c.t >= c.step * gap && c.step < waves) { for (const a of ringAngles(arms, c.step * rot)) out.push({ type: 'shoot', angle: a, speed: pr(P, ['speed'], 200), count: Math.min(cnt, 3), spread: 0.12 }); c.step++; }
      if (c.step >= waves) done(); break;
    }
    case 'aimed': case 'aimedBurst': {
      const n = pr(P, ['bursts'], 3), gap = pr(P, ['burstGap'], 0.3);
      if (c.t < tele) break;
      if (c.t - tele >= c.step * gap && c.step < n) { out.push({ type: 'shoot', angle: ang(me, p), speed: pr(P, ['speed'], 220), count: pr(P, ['count'], 3), spread: P.spreadDeg != null ? P.spreadDeg * Math.PI / 180 : pr(P, ['spread'], 0.4) }); c.step++; }
      if (c.step >= n) done(0.9); break;
    }
    case 'charge': {
      const w = pr(P, ['windup', 'telegraph'], 0.8), dur = pr(P, ['duration'], 0.6), n = pr(P, ['count'], 1);
      const cyc = w + dur + 0.15; const k = Math.floor(c.t / cyc), local = c.t - k * cyc;
      if (k >= n) { done(1.0); break; }
      if (c.step === k * 2 && local >= 0) { c.angle = ang(me, p); out.push({ type: 'telegraphLine', angle: c.angle, length: 420, time: w }); c.step++; }
      else if (c.step === k * 2 + 1 && local >= w) { out.push({ type: 'charge', angle: c.angle, speed: pr(P, ['speed'], 380), duration: dur }); c.step++; }
      break;
    }
    case 'summon': out.push({ type: 'summon', count: pr(P, ['count'], 2), ids: phase.summon }); done(1.6); break;
    case 'hazard': case 'rainMarkers': {
      if (c.step === 0) {
        const n = pr(P, ['count'], 5), r = pr(P, ['radius'], 48), dl = pr(P, ['delay', 'telegraph'], 1), area = pr(P, ['area'], 0);
        out.push({ type: 'hazard', x: p.x, y: p.y, radius: r, delay: dl });
        for (let i = 1; i < n; i++) {
          const x = area ? p.x + rng.range(-area / 2, area / 2) : rng.range(60, arena.w - 60), y = area ? p.y + rng.range(-area / 2, area / 2) : rng.range(80, arena.h - 60);
          out.push({ type: 'hazard', x: Math.max(40, Math.min(arena.w - 40, x)), y: Math.max(60, Math.min(arena.h - 40, y)), radius: r, delay: dl });
        }
        c.step = 1;
      } else if (c.t >= pr(P, ['delay', 'telegraph'], 1) + 0.3) done(0.9);
      break;
    }
    case 'slam': {
      if (c.step === 0) { out.push({ type: 'slam', radius: pr(P, ['radius'], 110), telegraph: pr(P, ['telegraph'], 0.9), mult: pr(P, ['damageMul'], 1.2) }); c.step = 1; }
      else if (c.t >= pr(P, ['telegraph'], 0.9) + 0.3) done(0.9);
      break;
    }
    case 'minefield': {
      for (let i = 0; i < pr(P, ['count'], 8); i++) out.push({ type: 'mine', x: rng.range(60, arena.w - 60), y: rng.range(90, arena.h - 60), radius: pr(P, ['radius'], 42), arm: pr(P, ['armTime'], 0.9), life: pr(P, ['life'], 8) });
      done(1.4); break;
    }
    case 'laserSweep': {
      const w = pr(P, ['telegraph'], 0.8), dur = pr(P, ['duration'], 2);
      if (c.step === 0) { c.angle = ang(me, p) - (pr(P, ['sweepDeg'], 180) * Math.PI / 360); out.push({ type: 'laser', angle: c.angle, sweep: pr(P, ['sweepDeg'], 180) * Math.PI / 180, duration: dur, width: pr(P, ['width'], 28), beams: pr(P, ['beams'], 1), telegraph: w }); c.step = 1; }
      else if (c.t >= w + dur) done(1.0);
      break;
    }
    case 'shieldPhase': {
      if (c.step === 0) { out.push({ type: 'shield', duration: pr(P, ['duration'], 3), reflect: pr(P, ['reflect'], 0) > 0 }); b.shieldT = pr(P, ['duration'], 3) + pr(P, ['telegraph'], 0.6); c.step = 1; }
      else if (c.t >= 0.8) done(0.6);
      break;
    }
    case 'teleportStrike': {
      const n = pr(P, ['count'], 2), gap = pr(P, ['gap'], 0.4), w = pr(P, ['telegraph'], 0.6), r = pr(P, ['radius'], 70);
      const cyc = w + gap; const k = Math.floor(c.t / cyc), local = c.t - k * cyc;
      if (k >= n) { done(1.0); break; }
      if (c.step === k * 2) { c.tx = Math.max(60, Math.min(arena.w - 60, p.x + rng.range(-30, 30))); c.ty = Math.max(90, Math.min(arena.h - 60, p.y + rng.range(-30, 30))); out.push({ type: 'telegraphCircle', x: c.tx, y: c.ty, radius: r, time: w }); c.step++; }
      else if (c.step === k * 2 + 1 && local >= w) { out.push({ type: 'teleport', x: c.tx!, y: c.ty! }); out.push({ type: 'slam', radius: r, telegraph: 0, mult: 1.1 }); c.step++; }
      break;
    }
    default: done(0.5);
  }
  return out;
}
