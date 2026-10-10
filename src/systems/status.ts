// Status effects (SPEC §2): burn, frostbite→freeze, shock, poison, wound, stun. Framework-free.
import type { StatusId } from '../data/types';
import { EXPOSED_TAKEN } from './difficulty';
export interface StatusState {
  burn: { stacks: number; t: number; power: number };
  frost: { stacks: number; t: number };
  frozenT: number; shockT: number;
  poison: { stacks: number; t: number; power: number };
  wound: { stacks: number; t: number };
  stunT: number;
  /** Exposed: enemy is in an attack recovery / boss stagger window and takes +EXPOSED_TAKEN damage. */
  exposedT: number;
}
export const BURN_DUR = 3, FREEZE_AT = 5, FREEZE_DUR = 1.5, SHOCK_DUR = 3, SHOCK_TAKEN = 0.15, SHOCK_CHAIN = 3, POISON_DUR = 5, WOUND_DUR = 4, FROST_DUR = 4;
export const newStatus = (): StatusState => ({ burn: { stacks: 0, t: 0, power: 0 }, frost: { stacks: 0, t: 0 }, frozenT: 0, shockT: 0, poison: { stacks: 0, t: 0, power: 0 }, wound: { stacks: 0, t: 0 }, stunT: 0, exposedT: 0 });

/** Apply a status. Returns event flags (e.g. 'freeze' when frostbite hits 5 stacks, 'chain' for shock). */
export function applyStatus(s: StatusState, id: StatusId, stacks = 1, power = 4, stunTime = 1): string[] {
  const ev: string[] = [];
  switch (id) {
    case 'burn': s.burn.stacks = Math.min(10, s.burn.stacks + stacks); s.burn.t = BURN_DUR; s.burn.power = Math.max(s.burn.power, power); break;
    case 'frostbite':
      if (s.frozenT > 0) break;
      s.frost.stacks += stacks; s.frost.t = FROST_DUR;
      if (s.frost.stacks >= FREEZE_AT) { s.frost.stacks = 0; s.frozenT = FREEZE_DUR; ev.push('freeze'); }
      break;
    case 'shock': s.shockT = SHOCK_DUR; ev.push('chain'); break;
    case 'poison': s.poison.stacks = Math.min(8, s.poison.stacks + stacks); s.poison.t = POISON_DUR; s.poison.power = Math.max(s.poison.power, power * 0.6); break;
    case 'wound': s.wound.stacks = Math.min(5, s.wound.stacks + stacks); s.wound.t = WOUND_DUR; break;
    case 'stun': s.stunT = Math.max(s.stunT, stunTime); ev.push('stun'); break;
  }
  return ev;
}
/** Advance timers; returns damage over time dealt this tick. */
export function tickStatus(s: StatusState, dt: number): number {
  let dmg = 0;
  if (s.burn.t > 0) { dmg += s.burn.stacks * s.burn.power * dt; s.burn.t -= dt; if (s.burn.t <= 0) s.burn.stacks = 0; }
  if (s.poison.t > 0) { dmg += s.poison.stacks * s.poison.power * dt; s.poison.t -= dt; if (s.poison.t <= 0) s.poison.stacks = 0; }
  if (s.frost.t > 0) { s.frost.t -= dt; if (s.frost.t <= 0) s.frost.stacks = 0; }
  if (s.frozenT > 0) s.frozenT = Math.max(0, s.frozenT - dt);
  if (s.shockT > 0) s.shockT = Math.max(0, s.shockT - dt);
  if (s.stunT > 0) s.stunT = Math.max(0, s.stunT - dt);
  if (s.exposedT > 0) s.exposedT = Math.max(0, s.exposedT - dt);
  if (s.wound.t > 0) { s.wound.t -= dt; if (s.wound.t <= 0) s.wound.stacks = 0; }
  return dmg;
}
export const isDisabled = (s: StatusState) => s.frozenT > 0 || s.stunT > 0;
export const takenMult = (s: StatusState) => (s.shockT > 0 ? SHOCK_TAKEN : 0) + (s.exposedT > 0 ? EXPOSED_TAKEN : 0);
/** Mark the target Exposed for at least `t` seconds (punish window). */
export function expose(s: StatusState, t: number) { s.exposedT = Math.max(s.exposedT, t); }
/** Wound: each stack adds bleed damage = 6% of the hit per stack. */
export const woundBonus = (s: StatusState, hit: number) => Math.round(hit * 0.06 * s.wound.stacks);
/** Pick up to n chain targets nearest to origin within range (excluding origin). */
export function chainTargets<T extends { x: number; y: number }>(origin: T, cands: T[], n = SHOCK_CHAIN, range = 160): T[] {
  return cands.filter((c) => c !== origin && Math.hypot(c.x - origin.x, c.y - origin.y) <= range)
    .sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)).slice(0, n);
}
