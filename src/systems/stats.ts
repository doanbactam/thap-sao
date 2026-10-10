// Stat block + formulas (SPEC §2). Framework-free.
import type { StatKey, Element } from '../data/types';
export type Stats = Record<StatKey, number>;
export const STAT_KEYS: StatKey[] = ['maxHp', 'maxMp', 'mpRegen', 'physical', 'fire', 'ice', 'lightning', 'magic', 'defense', 'evasion', 'critChance', 'critDamage', 'attackSpeed', 'moveSpeed', 'dashCount', 'dashRecovery', 'luck', 'barter', 'lifesteal', 'damagePct', 'cooldownPct'];
export const BASE_STATS: Readonly<Stats> = Object.freeze({
  maxHp: 50, maxMp: 50, mpRegen: 4, physical: 20, fire: 20, ice: 20, lightning: 20, magic: 10,
  defense: 0, evasion: 0, critChance: 0, critDamage: 50, attackSpeed: 100, moveSpeed: 100,
  dashCount: 2, dashRecovery: 100, luck: 0, barter: 0, lifesteal: 0, damagePct: 0, cooldownPct: 0,
});
export const CAPS = { defense: 75, evasion: 60, critChance: 100, cooldownPct: 60 } as const;
export const BASE_MOVE = 150; export const MP_REGEN_DELAY = 1.5;
export const DASH_TIME = 0.18; export const DASH_DIST = 140; export const DASH_RECHARGE = 1.2;
export const LUCK_PER_POINT = 0.0116;

export interface StatMod { stat: StatKey; value: number; pct?: boolean }

export function computeStats(mods: StatMod[], base: Readonly<Stats> = BASE_STATS): Stats {
  const s = { ...base } as Stats; const pct: Partial<Record<StatKey, number>> = {};
  for (const m of mods) { if (!(m.stat in s)) continue; if (m.pct) pct[m.stat] = (pct[m.stat] ?? 0) + m.value; else s[m.stat] += m.value; }
  for (const k of Object.keys(pct) as StatKey[]) s[k] *= 1 + (pct[k]! / 100);
  return clampStats(s);
}
export function clampStats(s: Stats): Stats {
  s.defense = Math.min(CAPS.defense, s.defense); s.evasion = Math.max(0, Math.min(CAPS.evasion, s.evasion));
  s.critChance = Math.max(0, Math.min(CAPS.critChance, s.critChance)); s.cooldownPct = Math.min(CAPS.cooldownPct, s.cooldownPct);
  s.maxHp = Math.max(1, Math.round(s.maxHp)); s.maxMp = Math.max(0, Math.round(s.maxMp));
  s.moveSpeed = Math.max(20, s.moveSpeed); s.attackSpeed = Math.max(20, s.attackSpeed);
  s.dashCount = Math.max(0, Math.round(s.dashCount)); s.dashRecovery = Math.max(10, s.dashRecovery);
  return s;
}
export const moveSpeedPx = (s: Stats) => BASE_MOVE * s.moveSpeed / 100;
export const dashRechargeTime = (s: Stats) => DASH_RECHARGE / (s.dashRecovery / 100);
export const elementStat = (s: Stats, e: Element) => s[e];

/** MP regen: returns new mp. `sinceSpend` seconds since last spend. */
export function regenMp(mp: number, maxMp: number, regen: number, sinceSpend: number, dt: number): number {
  if (sinceSpend < MP_REGEN_DELAY) return mp;
  return Math.min(maxMp, mp + regen * dt);
}
/** Dash charges recovery. Returns {charges, timer}. */
export function tickDash(charges: number, timer: number, max: number, rechargeTime: number, dt: number) {
  if (charges >= max) return { charges: max, timer: 0 };
  timer += dt;
  while (timer >= rechargeTime && charges < max) { timer -= rechargeTime; charges++; }
  if (charges >= max) timer = 0;
  return { charges, timer };
}

// ---- XP / levels ----
export const xpToNext = (level: number) => 20 + (level - 1) * 18;
export const LEVEL_HP = 5; export const LEVEL_DMG = 2;
export function addXp(level: number, xp: number, gain: number) {
  let ups = 0; xp += gain;
  while (xp >= xpToNext(level)) { xp -= xpToNext(level); level++; ups++; }
  return { level, xp, ups };
}
export function levelMods(level: number): StatMod[] {
  const n = level - 1; if (n <= 0) return [];
  return [{ stat: 'maxHp', value: LEVEL_HP * n }, ...(['physical', 'fire', 'ice', 'lightning', 'magic'] as StatKey[]).map((stat) => ({ stat, value: LEVEL_DMG * n }))];
}

/** Rarity weights with luck: each tier above common weighted ×(1+0.0116·luck)^tier. Chapter shifts upward. */
export function rarityWeights(luck: number, chapter = 1): number[] {
  const base = [62 - chapter * 3, 27 + chapter, 9 + chapter * 1.4, 2 + chapter * 0.6];
  const m = 1 + LUCK_PER_POINT * Math.max(-50, luck);
  return base.map((w, t) => Math.max(0.01, w * Math.pow(m, t)));
}
export const buyPrice = (price: number, barter: number, discount = 0) => Math.max(1, Math.round(price * (1 - barter / 100) * (1 - discount)));
export const sellPrice = (price: number, barter: number) => Math.max(1, Math.floor(price * 0.4 * (1 + barter / 100)));
