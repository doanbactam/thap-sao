// Engine implementation of the 17 'special' effect hooks (docs/CONTENT.md §1). Pure helpers used by RunScene.
import type { Bundle } from './effects';
import { specialsOf } from './effects';

export const SPECIAL_IDS = ['freezeShatter', 'phoenixRevive', 'lightningRod', 'guardCounter', 'backstab', 'manaShield', 'dashStrike', 'galeDash',
  'spellCrit', 'spellEcho', 'companionDamage', 'companionHaste', 'companionCrit', 'extraCompanion', 'companionShare', 'debuffAmp', 'doomMark'] as const;
export type SpecialId = typeof SPECIAL_IDS[number];
export type Specials = Partial<Record<string, number>>;
export const getSpecials = (b: Bundle): Specials => specialsOf(b);

export interface HitTarget { frozen: boolean; shocked: boolean; anyStatus: boolean; behind: boolean }
/** Outgoing damage multiplier from specials for a player hit on a target. */
export function hitMultiplier(sp: Specials, t: HitTarget, isDashAttack = false): number {
  let m = 1;
  if (t.frozen && sp.freezeShatter) m += sp.freezeShatter / 100;
  if (t.shocked && sp.lightningRod) m += sp.lightningRod / 100;
  if (t.behind && sp.backstab) m += sp.backstab / 100;
  if (t.anyStatus && sp.debuffAmp) m += sp.debuffAmp / 100;
  if (isDashAttack && sp.dashStrike) m += sp.dashStrike / 100;
  return m;
}
/** Shock chain target count (+1 with lightningRod). */
export const chainCount = (sp: Specials, base = 3) => base + (sp.lightningRod ? 1 : 0);
/** Is attacker behind target: angle between target facing and direction target→attacker > 100°. */
export function isBehind(targetFacing: number, tx: number, ty: number, ax: number, ay: number): boolean {
  const toA = Math.atan2(ay - ty, ax - tx); let d = Math.abs(toA - targetFacing) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d;
  return d > (100 * Math.PI) / 180;
}
/** manaShield: value% of incoming damage paid from MP first (1 MP per HP). */
export function splitManaShield(sp: Specials, dmg: number, mp: number): { hp: number; mp: number } {
  if (!sp.manaShield) return { hp: dmg, mp: 0 };
  const share = Math.min(dmg, Math.round(dmg * Math.min(100, sp.manaShield) / 100));
  const fromMp = Math.min(share, Math.floor(mp));
  return { hp: dmg - fromMp, mp: fromMp };
}
/** doomMark: every 10th player hit deals `value` extra (ignores defense). Returns [bonus, newCounter]. */
export function doomMark(sp: Specials, counter: number): [number, number] {
  if (!sp.doomMark) return [0, counter];
  const c = counter + 1; return c >= 10 ? [Math.round(sp.doomMark), 0] : [0, c];
}
/** phoenixRevive: once per floor, revive at value% max HP. */
export function phoenix(sp: Specials, usedThisFloor: boolean, maxHp: number): number | null {
  if (!sp.phoenixRevive || usedThisFloor) return null; return Math.max(1, Math.round(maxHp * Math.min(100, sp.phoenixRevive) / 100));
}
export const spellCritChance = (sp: Specials, baseCrit: number) => baseCrit + (sp.spellCrit ?? 0);
export const spellEchoes = (sp: Specials, roll: number) => !!sp.spellEcho && roll * 100 < sp.spellEcho;
export const companionSlots = (sp: Specials, summonCount: number) => summonCount + Math.round(sp.extraCompanion ?? 0);
export function companionMods(sp: Specials) {
  return { damage: 1 + (sp.companionDamage ?? 0) / 100, haste: 1 + (sp.companionHaste ?? 0) / 100, crit: sp.companionCrit ?? 0, healPct: sp.companionShare ?? 0 };
}
export const guardCounterDamage = (sp: Specials) => sp.guardCounter ?? 0;
export const galeDashDamage = (sp: Specials) => sp.galeDash ?? 0;

// ---- V2: elemental proc damage (see effects.ts procElement/procScale) ----
import { procElement, procScale, type ProcElement } from './effects';
import { getArtifact } from './registry';
const DAMAGE_PROCS = new Set(['kill:explode', 'dash:trail', 'dash:shockwave', 'hurt:thorns', 'hurt:nova', 'periodic:orb', 'periodic:lightning', 'periodic:meteor', 'periodic:frostRing']);
export const isDamageProc = (kind: string) => DAMAGE_PROCS.has(kind);
/** Element and scaled amount of a triggered action (heals / MP / money pass through unscaled). */
export function procDamage(kind: string, v: number, source: string, stats: { physical: number; fire: number; ice: number; lightning: number }, level = 1): { v: number; el: ProcElement } {
  const el = procElement(source, kind, (id) => (getArtifact(id)?.tags as string[] | undefined) ?? []);
  return { v: DAMAGE_PROCS.has(kind) ? Math.round(v * procScale(stats, el, level)) : v, el };
}
