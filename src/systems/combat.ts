// Combat feel & skill expression (v2): per-weapon frame data, input buffer, cancel windows, hold-to-charge,
// dash i-frames + perfect dodge, perfect parry lockout, enemy poise/weight. Framework-free and unit-tested
// (tests/combat.test.ts). Frame data is documented in docs/COMBAT.md — keep both in sync.
import type { WeaponId } from '../data/types';
import { DASH_TIME } from './stats';

export type ShakeTier = 0 | 1 | 2 | 3 | 4;
/** One light-chain hit. All times are seconds at 100% attack speed; scaled by 1/attackRate at runtime.
 *  startup: wind-up before the hitbox; cancel: after the strike, earliest next light (chain window);
 *  dashCancel: after the strike, earliest dash; recovery: after the strike, full end of the move (move slow ends);
 *  range/arc: multipliers of the weapon's range/arc; lunge: px stepped forward on strike; knock/poise: knockback
 *  multiplier and poise damage; sweep: swing direction; feint: startup can be dash-cancelled (aim follows
 *  until the strike); moveMul: move speed multiplier while the move runs. */
export interface MoveData {
  startup: number; cancel: number; dashCancel: number; recovery: number; range: number; arc: number; lunge: number;
  knock: number; poise: number; sweep: 1 | -1; feint: boolean; moveMul: number; finisher: boolean; hitstop: number; shake: ShakeTier;
}
/** Charged (held) attack. Melee: one big swing. Ranged: one empowered projectile. */
export interface ChargedData {
  chargeTime: number; coef: number; range: number; arc: number; lunge: number; knock: number; poise: number; startup: number;
  recovery: number; critBonus: number; pierce: number; speed: number; size: number; moveMul: number; shake: ShakeTier;
}

const L = (o: Partial<MoveData>): MoveData => ({ startup: 0.05, cancel: 0.2, dashCancel: 0.08, recovery: 0.3, range: 1, arc: 1, lunge: 8, knock: 0.8, poise: 10, sweep: 1, feint: true, moveMul: 0.6, finisher: false, hitstop: 1, shake: 0, ...o });
const F = (o: Partial<MoveData>) => L({ finisher: true, shake: 2, hitstop: 1.6, ...o });

/** Light chains. Last entry is the finisher; extra hits from Anvil (`extraHit`) repeat the non-finisher hits. */
export const LIGHT: Record<WeaponId, MoveData[]> = {
  // balanced: quick, short commitment, guard-capable
  swordshield: [
    L({ startup: 0.05, cancel: 0.22, dashCancel: 0.08, recovery: 0.32, lunge: 10, knock: 0.8, poise: 10, sweep: 1 }),
    L({ startup: 0.05, cancel: 0.22, dashCancel: 0.08, recovery: 0.32, arc: 0.9, lunge: 10, knock: 0.8, poise: 10, sweep: -1 }),
    F({ startup: 0.1, cancel: 0.42, dashCancel: 0.18, recovery: 0.52, range: 1.15, arc: 1.3, lunge: 22, knock: 2.2, poise: 25 }),
  ],
  // reach + commitment: long startup, cannot feint, crawls while swinging, super armor (weapons.ts)
  greatsword: [
    L({ startup: 0.18, cancel: 0.44, dashCancel: 0.34, recovery: 0.62, lunge: 14, knock: 1.0, poise: 30, sweep: 1, feint: false, moveMul: 0.2, hitstop: 1.4, shake: 1 }),
    F({ startup: 0.24, cancel: 0.62, dashCancel: 0.48, recovery: 0.85, range: 1.12, arc: 1.1, lunge: 24, knock: 1.7, poise: 50, sweep: -1, feint: false, moveMul: 0.15, hitstop: 2, shake: 3 }),
  ],
  // speed: no startup, dash-cancel any time, tiny knockback, low poise per hit
  dagger: [
    L({ startup: 0, cancel: 0.14, dashCancel: 0, recovery: 0.18, lunge: 6, knock: 0.3, poise: 4, sweep: 1, moveMul: 0.9, hitstop: 0.5 }),
    L({ startup: 0, cancel: 0.14, dashCancel: 0, recovery: 0.18, lunge: 6, knock: 0.3, poise: 4, sweep: -1, moveMul: 0.9, hitstop: 0.5 }),
    L({ startup: 0, cancel: 0.14, dashCancel: 0, recovery: 0.18, arc: 0.8, lunge: 8, knock: 0.3, poise: 4, sweep: 1, moveMul: 0.9, hitstop: 0.5 }),
    F({ startup: 0.03, cancel: 0.26, dashCancel: 0.06, recovery: 0.3, range: 1.15, arc: 1.2, lunge: 28, knock: 1.4, poise: 14, sweep: -1, moveMul: 0.7, hitstop: 1.2, shake: 1 }),
  ],
  // precision/reach: two cuts then a long thrust (lunge 50, narrow arc)
  katana: [
    L({ startup: 0.06, cancel: 0.22, dashCancel: 0.1, recovery: 0.3, lunge: 10, knock: 0.7, poise: 12, sweep: 1 }),
    L({ startup: 0.06, cancel: 0.24, dashCancel: 0.1, recovery: 0.32, lunge: 10, knock: 0.7, poise: 12, sweep: -1 }),
    F({ startup: 0.1, cancel: 0.34, dashCancel: 0.14, recovery: 0.46, range: 1.25, arc: 0.45, lunge: 50, knock: 1.8, poise: 28 }),
  ],
  // ranged weapons keep v1 cadence (see weapons.ts tryAttack); this entry only feeds move speed / cancel rules
  crossbow: [L({ startup: 0, cancel: 0, dashCancel: 0, recovery: 0.12, lunge: 0, knock: 0.5, poise: 6, moveMul: 0.8, hitstop: 0 })],
  staff: [L({ startup: 0, cancel: 0, dashCancel: 0, recovery: 0.16, lunge: 0, knock: 0.5, poise: 6, moveMul: 0.75, hitstop: 0 })],
};

const C = (o: Partial<ChargedData>): ChargedData => ({ chargeTime: 0.5, coef: 2.2, range: 1.2, arc: 1.8, lunge: 20, knock: 2.4, poise: 40, startup: 0.06, recovery: 0.45, critBonus: 0, pierce: 0, speed: 1, size: 1, moveMul: 0.55, shake: 2, ...o });
/** Held attack per weapon (hold the attack button / touch button ≥ HOLD_DELAY, release ≥ MIN_CHARGE). */
export const CHARGED: Record<WeaponId, ChargedData> = {
  swordshield: C({ chargeTime: 0.5, coef: 2.2, range: 1.2, arc: 1.8, lunge: 30, knock: 2.6, poise: 40 }),
  greatsword: C({ chargeTime: 0.8, coef: 3.4, range: 1.3, arc: 1.4, lunge: 0, knock: 2.2, poise: 80, startup: 0.12, recovery: 0.7, moveMul: 0.3, shake: 3 }),
  dagger: C({ chargeTime: 0.35, coef: 2.0, range: 1.7, arc: 0.4, lunge: 60, knock: 1.2, poise: 20, startup: 0.02, recovery: 0.25, critBonus: 25, moveMul: 0.75, shake: 1 }),
  katana: C({ chargeTime: 0.55, coef: 2.5, range: 1.35, arc: 1.6, lunge: 20, knock: 1.6, poise: 35, startup: 0.05, recovery: 0.4 }),
  crossbow: C({ chargeTime: 0.45, coef: 2.6, range: 1, arc: 0, lunge: 0, knock: 1.5, poise: 25, startup: 0, recovery: 0.3, pierce: 3, speed: 1.4, size: 1.5, moveMul: 0.6, shake: 1 }),
  staff: C({ chargeTime: 0.6, coef: 2.4, range: 1, arc: 0, lunge: 0, knock: 1.2, poise: 25, startup: 0, recovery: 0.35, pierce: 2, speed: 0.85, size: 1.8, moveMul: 0.5, shake: 1 }),
};

/** Frame data for light hit `hit` of a chain `len` long. The last hit is always the finisher. */
export function moveFor(id: WeaponId, hit: number, len: number): MoveData {
  const tbl = LIGHT[id] ?? LIGHT.swordshield;
  if (tbl.length === 1) return tbl[0];
  if (hit >= len - 1) return tbl[tbl.length - 1];
  return tbl[hit % (tbl.length - 1)];
}
/** Seconds between pressing a light and the earliest next light (= weapon cooldown) at time scale `scale`. */
export const lightCooldown = (m: MoveData, scale: number) => (m.startup + m.cancel) * scale;

// ---- tuning constants ----
export const BUFFER = 0.12;            // attack / dash input buffer
export const HOLD_DELAY = 0.28;        // hold this long before a charge starts (taps stay light attacks)
export const MIN_CHARGE = 0.35;        // release below this fraction = cancelled charge
export const OVERCHARGE = 0.35;        // held this long at full charge = auto-release (touch-friendly, never stuck)
export const DASH_IFRAMES = DASH_TIME + 0.05;   // 0.23 s of invulnerability from dash start
export const PERFECT_DODGE_WINDOW = 0.12;       // a threat that would have hit within this long of dash start
export const PERFECT_DODGE_CD = 1.0;
export const SLOWMO_TIME = 0.35, SLOWMO_SCALE = 0.3;  // real seconds / game speed after a perfect dodge
export const COUNTER_TIME = 1.5, COUNTER_BONUS = 50;  // perfect dodge: next hit +50% damage within 1.5 s
export const RIPOSTE_TIME = 1.2;                      // perfect parry: next hit is a guaranteed crit within 1.2 s
export const PARRY_LOCKOUT = 0.35;    // re-raising guard within this long of dropping it (no parry) gets no perfect window
export const STAGGER_TIME = 0.45;     // poise break stun
export const POISE_REGEN_DELAY = 1.2; // poise refills this long after the last poise damage

export type Phase = 'idle' | 'startup' | 'recovery';
export interface Pending { kind: 'light' | 'charged'; hit: number; coef: number; last: boolean; lunge: boolean; angle: number; power: number; dash?: boolean }
export interface CombatState {
  atkBuf: number; dashBuf: number; phase: Phase; t: number; move: MoveData | null; scale: number; pending: Pending | null; moveMulNow: number;
  holdT: number; charging: boolean; charge: number; fullT: number; full: boolean;
  sinceDash: number; dodgeCd: number; slowT: number; counterT: number; riposteT: number; guardOffT: number; parried: boolean;
}
export function newCombat(): CombatState {
  return { atkBuf: 0, dashBuf: 0, phase: 'idle', t: 0, move: null, scale: 1, pending: null, moveMulNow: 1, holdT: 0, charging: false, charge: 0, fullT: 0, full: false,
    sinceDash: 99, dodgeCd: 0, slowT: 0, counterT: 0, riposteT: 0, guardOffT: 99, parried: false };
}
/** Advance timers by game dt. Returns the pending strike when its startup elapses (the scene performs it). */
export function tickCombat(cs: CombatState, dt: number): Pending | null {
  cs.atkBuf = Math.max(0, cs.atkBuf - dt); cs.dashBuf = Math.max(0, cs.dashBuf - dt);
  cs.sinceDash += dt; cs.dodgeCd = Math.max(0, cs.dodgeCd - dt); cs.counterT = Math.max(0, cs.counterT - dt); cs.riposteT = Math.max(0, cs.riposteT - dt); cs.guardOffT += dt;
  if (cs.phase === 'idle') return null;
  cs.t += dt; const m = cs.move!;
  if (cs.phase === 'startup' && cs.t >= m.startup * cs.scale) { const p = cs.pending; cs.pending = null; cs.phase = 'recovery'; cs.t = 0; cs.moveMulNow = m.moveMul; return p; }
  if (cs.phase === 'recovery' && cs.t >= m.recovery * cs.scale) { cs.phase = 'idle'; cs.t = 0; cs.move = null; cs.moveMulNow = 1; }
  return null;
}
/** Real-time (unscaled) timers: slow-mo itself must not be slowed. */
export function tickReal(cs: CombatState, realDt: number) { cs.slowT = Math.max(0, cs.slowT - realDt); }
export const timeScale = (cs: CombatState) => (cs.slowT > 0 ? SLOWMO_SCALE : 1);

/** Start a move. With startup > 0 the strike is deferred (returned later by tickCombat); otherwise the caller strikes now. */
export function beginMove(cs: CombatState, m: MoveData, scale: number, p: Pending): boolean {
  cs.move = m; cs.scale = scale; cs.t = 0;
  if (m.startup > 0) { cs.phase = 'startup'; cs.pending = p; cs.moveMulNow = m.moveMul * 0.5; return false; }
  cs.phase = 'recovery'; cs.pending = null; cs.moveMulNow = m.moveMul; return true;
}
/** Charged data expressed as a MoveData so it shares the startup/recovery/cancel machinery. */
export function chargedMove(c: ChargedData): MoveData {
  return { startup: c.startup, cancel: c.recovery, dashCancel: c.recovery * 0.5, recovery: c.recovery, range: c.range, arc: c.arc, lunge: c.lunge, knock: c.knock,
    poise: c.poise, sweep: 1, feint: false, moveMul: c.moveMul, finisher: true, hitstop: 2, shake: c.shake };
}
export function canDash(cs: CombatState): boolean {
  if (cs.phase === 'idle' || !cs.move) return true;
  if (cs.phase === 'startup') return cs.move.feint;
  return cs.t >= cs.move.dashCancel * cs.scale;
}
/** Move speed multiplier from the current move / charge. */
export const moveMul = (cs: CombatState, chargeMoveMul = 0.55) => Math.min(cs.moveMulNow, cs.charging ? chargeMoveMul : 1);
/** Dash started: cancels startup/recovery/charge (the "animation cancel"), opens the perfect-dodge window. */
export function onDash(cs: CombatState) { cs.phase = 'idle'; cs.pending = null; cs.move = null; cs.t = 0; cs.moveMulNow = 1; cs.charging = false; cs.charge = 0; cs.holdT = 0; cs.full = false; cs.sinceDash = 0; cs.dashBuf = 0; }
/** Drop a move still in startup (guard raised during a feint-able wind-up). */
export function cancelStartup(cs: CombatState) { if (cs.phase === 'startup') { cs.phase = 'idle'; cs.pending = null; cs.move = null; cs.t = 0; cs.moveMulNow = 1; } }
/** Player took damage: interrupts startup and charge unless super armor. */
export function onHurt(cs: CombatState, superArmor: boolean) {
  if (superArmor) return;
  if (cs.phase === 'startup') { cs.phase = 'idle'; cs.pending = null; cs.move = null; cs.moveMulNow = 1; }
  cs.charging = false; cs.charge = 0; cs.holdT = 0; cs.full = false;
}

export interface AttackInput { pressed: boolean; held: boolean; canAttack: boolean; canCharge: boolean; ready: boolean; chargeTime: number }
export type AttackCmd = { type: 'light' } | { type: 'charged'; power: number } | { type: 'chargeStart' } | { type: 'chargeFull' } | { type: 'chargeCancel' };
/** Per-frame attack input → commands. Tap = light (buffered BUFFER s); hold ≥ HOLD_DELAY = charge; release = charged
 *  attack (≥ MIN_CHARGE); full charge held OVERCHARGE s auto-releases. */
export function stepAttack(cs: CombatState, i: AttackInput, dt: number): AttackCmd[] {
  const out: AttackCmd[] = [];
  if (i.pressed) cs.atkBuf = BUFFER;
  if (!i.canAttack) { if (cs.charging) out.push({ type: 'chargeCancel' }); cs.charging = false; cs.charge = 0; cs.full = false; cs.holdT = i.held ? cs.holdT : 0; return out; }
  if (cs.charging) {
    if (!i.held) {
      const p = cs.charge; cs.charging = false; cs.charge = 0; cs.holdT = 0; cs.full = false;
      out.push(p >= MIN_CHARGE ? { type: 'charged', power: p } : { type: 'chargeCancel' }); return out;
    }
    cs.charge = Math.min(1, cs.charge + dt / Math.max(0.05, i.chargeTime));
    if (cs.charge >= 1) {
      if (!cs.full) { cs.full = true; cs.fullT = 0; out.push({ type: 'chargeFull' }); return out; }
      cs.fullT += dt;
      if (cs.fullT >= OVERCHARGE) { cs.charging = false; cs.charge = 0; cs.holdT = 0; cs.full = false; out.push({ type: 'charged', power: 1 }); }
    }
    return out;
  }
  if (i.held) cs.holdT += dt; else cs.holdT = 0;
  if (i.held && cs.holdT >= HOLD_DELAY && i.canCharge && cs.phase !== 'startup') {
    cs.charging = true; cs.charge = 0; cs.full = false; cs.fullT = 0; cs.atkBuf = 0; out.push({ type: 'chargeStart' }); return out;
  }
  if (cs.atkBuf > 0 && cs.phase !== 'startup' && i.ready) { cs.atkBuf = 0; out.push({ type: 'light' }); }
  return out;
}
export const bufferDash = (cs: CombatState) => { cs.dashBuf = BUFFER; };
/** Consume a buffered dash if the current move allows it. */
export function takeDash(cs: CombatState, haveCharge: boolean): boolean {
  if (cs.dashBuf <= 0 || !haveCharge || !canDash(cs)) return false;
  cs.dashBuf = 0; return true;
}

// ---- perfect dodge ----
/** A threat (projectile, hazard, charge, explosion, boss hit) reached the player while dash i-frames are up. */
export function tryPerfectDodge(cs: CombatState, dashing: boolean): boolean {
  if (!dashing || cs.sinceDash > PERFECT_DODGE_WINDOW || cs.dodgeCd > 0) return false;
  cs.dodgeCd = PERFECT_DODGE_CD; cs.slowT = SLOWMO_TIME; cs.counterT = COUNTER_TIME; return true;
}
export const dashIframesActive = (cs: CombatState) => cs.sinceDash <= DASH_IFRAMES;
/** Bonus from perfect dodge / parry for the next hit; consumed by the caller via consumeBonus. */
export function nextHitBonus(cs: CombatState): { bonusPct: number; forceCrit: boolean } {
  return { bonusPct: cs.counterT > 0 ? COUNTER_BONUS : 0, forceCrit: cs.riposteT > 0 };
}
export function consumeBonus(cs: CombatState) { cs.counterT = 0; cs.riposteT = 0; }

// ---- guard / parry ----
/** Guard raised: returns the initial guardT (0 = fresh perfect window, > window = no perfect window: lockout). */
export function guardOpen(cs: CombatState, perfectWindow: number): number {
  const spam = cs.guardOffT < PARRY_LOCKOUT && !cs.parried;
  cs.parried = false; return spam ? perfectWindow + 0.01 : 0;
}
export function guardClose(cs: CombatState) { cs.guardOffT = 0; }
export function onParry(cs: CombatState) { cs.parried = true; cs.riposteT = RIPOSTE_TIME; }

// ---- enemy weight / poise ----
export interface Poise { max: number; cur: number; since: number }
export interface Body { radius: number; elite?: boolean; boss?: boolean }
export const weightOf = (b: Body) => Math.max(0.7, Math.min(2.5, b.radius / 16)) * (b.elite ? 1.6 : 1) * (b.boss ? 4 : 1);
export const poiseMaxOf = (b: Body) => Math.round(12 + b.radius * 0.8 + (b.elite ? 30 : 0));
export const newPoise = (b: Body): Poise => ({ max: poiseMaxOf(b), cur: poiseMaxOf(b), since: 99 });
export function tickPoise(p: Poise, dt: number) { p.since += dt; if (p.since >= POISE_REGEN_DELAY) p.cur = p.max; }
/** Apply poise damage; returns true when poise breaks (stagger) — poise then refills. */
export function damagePoise(p: Poise, dmg: number): boolean {
  p.since = 0; p.cur -= dmg;
  if (p.cur <= 0) { p.cur = p.max; return true; }
  return false;
}
/** Knockback impulse (px/s) = base × move × 1/weight; reduced to 45% while poise holds, ×1.3 on a break. */
export const knockImpulse = (base: number, mul: number, weight: number, broke: boolean) => base * mul / weight * (broke ? 1.3 : 0.45);

// ---- hit feel (hit-stop + shake) ----
export interface ImpactInfo { amount: number; targetMaxHp: number; crit: boolean; melee: boolean; finisher?: boolean; charged?: boolean; hitstopMul?: number; kill?: boolean; broke?: boolean }
/** Hit-stop seconds, scaled by damage share and crit; ranged/procs only stop on crits and charged shots. Cap 0.12. */
export function hitStopFor(i: ImpactInfo): number {
  let hs = 0;
  if (i.melee) hs = 0.035 * (i.hitstopMul ?? 1) + Math.min(0.03, (i.amount / Math.max(1, i.targetMaxHp)) * 0.08);
  else if (i.charged) hs = 0.05;
  if (i.crit) hs += i.melee ? 0.025 : 0.02;
  if (i.charged && i.melee) hs += 0.02;
  if (i.broke) hs += 0.015;
  if (i.kill && i.melee) hs += 0.015;
  return Math.min(0.12, hs);
}
export function shakeTierFor(i: ImpactInfo, moveTier: ShakeTier = 0): ShakeTier {
  let t: number = moveTier;
  if (i.crit) t = Math.max(t, 1);
  if (i.broke) t = Math.max(t, 2);
  if (i.charged) t = Math.max(t, 2);
  return Math.min(4, t) as ShakeTier;
}
/** [duration ms, intensity] for camera.shake. */
export const SHAKE: Record<ShakeTier, [number, number]> = { 0: [0, 0], 1: [60, 0.002], 2: [100, 0.004], 3: [160, 0.007], 4: [260, 0.01] };
