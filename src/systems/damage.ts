// Damage formula (SPEC §2). Framework-free.
import type { Element } from '../data/types';
import type { Stats } from './stats';
import { CAPS } from './stats';

export interface DamageInput {
  stats: Stats; element: Element; coef: number; bonusPct?: number; magicShare?: number;
  targetDefense?: number; targetTakenPct?: number; forceCrit?: boolean; noCrit?: boolean; rand?: () => number;
}
export interface DamageResult { amount: number; crit: boolean }

export const critMultiplier = (critDamage: number) => 1.5 + (critDamage - 50) / 100;
export const defenseMult = (def: number) => 1 - Math.max(-100, Math.min(CAPS.defense, def)) / 100;

export function computeDamage(i: DamageInput): DamageResult {
  const r = i.rand ?? Math.random;
  const share = i.magicShare ?? 0;
  const base = i.stats[i.element] * (1 - share) + i.stats.magic * share;
  let amt = base * i.coef * (1 + ((i.stats.damagePct ?? 0) + (i.bonusPct ?? 0)) / 100);
  const crit = !i.noCrit && (i.forceCrit || r() * 100 < i.stats.critChance);
  if (crit) amt *= critMultiplier(i.stats.critDamage);
  amt *= defenseMult(i.targetDefense ?? 0);
  amt *= 1 + (i.targetTakenPct ?? 0);
  return { amount: Math.max(1, Math.round(amt)), crit };
}
/** Spell damage: scales with MagicDamage only. */
export function spellDamage(stats: Stats, base: number, targetTakenPct = 0): number {
  return Math.max(1, Math.round((base + stats.magic) * (1 + (stats.damagePct ?? 0) / 100) * (1 + targetTakenPct)));
}
/** Damage taken by the player from an enemy hit. Returns 0 on evade. */
export function incomingDamage(raw: number, stats: Stats, rand: () => number = Math.random): { amount: number; evaded: boolean } {
  if (rand() * 100 < Math.min(CAPS.evasion, stats.evasion)) return { amount: 0, evaded: true };
  return { amount: Math.max(1, Math.round(raw * defenseMult(stats.defense))), evaded: false };
}
export const lifestealHeal = (dealt: number, lifesteal: number) => dealt * lifesteal / 100;
