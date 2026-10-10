// Weapon configuration (def + Anvil upgrade mods) and the per-weapon combat state machine:
// combos, magazine/reload, fury, iaido timing, guard/perfect guard. Framework-free (SPEC §2–3).
import type { WeaponDef, WeaponId, Element, WeaponUpgradeDef } from '../data/types';
import { getWeapon, getUpgrade, weaponUpgrades } from './registry';
import type { Rng } from './rng';

export interface WeaponConfig {
  id: WeaponId; def: WeaponDef; element: Element; coefs: number[]; range: number; arc: number; interval: number;
  specialCost: number; hasGuard: boolean; magazine: number; reload: number; pierce: number; multishot: number;
  furyDuration: number; furyGain: number; iaidoWindow: number; iaidoPerfectAt: number; knockback: number; homing: number;
  novaRadius: number; dashAttackCoef: number; guardCostMult: number; spinDuration: number; backstabMult: number;
  damagePct: number; magicShare: number; critBonus: number; superArmor: boolean; chargeSpeed: number; critOnPerfect: boolean; dashAttack: boolean; mods: Record<string, number | string | boolean>;
}
const num = (v: any, d = 0) => (typeof v === 'number' ? v : d);

export function buildWeapon(id: WeaponId, upgradeIds: string[] = []): WeaponConfig {
  const def = getWeapon(id) ?? getWeapon('swordshield')!;
  const mods: Record<string, any> = {};
  for (const uid of upgradeIds) {
    const u = getUpgrade(uid); if (!u || u.weapon !== def.id) continue;
    for (const m of u.mods) {
      if (typeof m.value === 'number') {
        // *Pct keys accept either fractions (0.3) or percents (30)
        const v = /Pct$/.test(m.key) && Math.abs(m.value) >= 2 ? m.value / 100 : m.value;
        mods[m.key] = num(mods[m.key]) + v;
      } else mods[m.key] = m.value;
    }
  }
  const coefs = [...def.baseCoef];
  for (let i = 0; i < num(mods.extraHit); i++) coefs.push(+(coefs[coefs.length - 1] * 0.9).toFixed(3));
  const asp = 1 + num(mods.attackSpeedPct);
  return {
    id: def.id, def, element: (typeof mods.element === 'string' ? mods.element : typeof mods.aspect === 'string' ? mods.aspect : def.element) as Element, coefs,
    range: def.range * (1 + num(mods.rangePct)), arc: def.arc * (1 + num(mods.arcPct)), interval: def.attackInterval / asp,
    specialCost: Math.max(0, Math.round(def.specialMp * (1 + num(mods.specialCostPct)))),
    hasGuard: !!def.hasGuard, magazine: (def.magazine ?? 0) + num(mods.magazine), reload: (def.reload ?? 0) * (1 + num(mods.reloadPct)),
    pierce: num(mods.pierce), multishot: num(mods.multishot) + num(mods.projectileCount), furyDuration: 5 + num(mods.furyDuration), furyGain: 8,
    iaidoWindow: 0.15 + num(mods.iaidoWindow) + (mods.critOnPerfect === true ? 0.05 : 0), iaidoPerfectAt: 0.6, knockback: (def.id === 'greatsword' ? 260 : 90) * (1 + num(mods.knockbackPct)),
    homing: Math.min(1.5, (def.id === 'staff' ? 0.35 : 0) + num(mods.homing)), novaRadius: 140 * (1 + num(mods.novaRadiusPct) + (def.id === 'staff' ? num(mods.rangePct) : 0)),
    dashAttackCoef: 1.0 * (1 + num(mods.dashAttackPct)), guardCostMult: 1 + num(mods.guardCostPct), spinDuration: 1.2 + num(mods.spinDuration),
    backstabMult: 2 + num(mods.backstabMult), damagePct: num(mods.damagePct) * 100, magicShare: def.id === 'staff' ? 0.5 : 0,
    critBonus: num(mods.critChance), superArmor: def.id === 'greatsword', chargeSpeed: 1 + num(mods.chargeSpeedPct), critOnPerfect: mods.critOnPerfect === true, dashAttack: mods.dashAttack === true || num(mods.dashAttackPct) > 0, mods,
  };
}

export interface WeaponState {
  combo: number; sinceAttack: number; cooldown: number; ammo: number; reloading: number;
  fury: number; furyT: number; charge: number; charging: boolean; guarding: boolean; guardT: number;
}
export const COMBO_RESET = 0.8;
export function newWeaponState(c: WeaponConfig): WeaponState {
  return { combo: 0, sinceAttack: 99, cooldown: 0, ammo: c.magazine, reloading: 0, fury: 0, furyT: 0, charge: 0, charging: false, guarding: false, guardT: 0 };
}
export function tickWeapon(s: WeaponState, c: WeaponConfig, dt: number) {
  s.sinceAttack += dt; s.cooldown = Math.max(0, s.cooldown - dt);
  if (s.sinceAttack > COMBO_RESET) s.combo = 0;
  if (s.reloading > 0) { s.reloading -= dt; if (s.reloading <= 0) { s.reloading = 0; s.ammo = c.magazine; } }
  if (s.furyT > 0) s.furyT = Math.max(0, s.furyT - dt);
  if (s.charging) s.charge += dt * c.chargeSpeed;
  if (s.guarding) s.guardT += dt;
}
/** Attack speed multiplier from stat% and fury (+50%). */
export const attackRate = (s: WeaponState, attackSpeed: number) => (attackSpeed / 100) * (s.furyT > 0 ? 1.5 : 1);
/** Try a basic attack. Returns the hit descriptor or null if on cooldown / reloading. */
export function tryAttack(s: WeaponState, c: WeaponConfig, attackSpeed = 100): { hit: number; coef: number; last: boolean; lunge: boolean } | null {
  if (s.cooldown > 0 || s.guarding) return null;
  if (c.magazine > 0) {
    if (s.reloading > 0) return null;
    if (s.ammo <= 0) { s.reloading = c.reload; return null; }
    s.ammo--; if (s.ammo <= 0) s.reloading = c.reload;
  }
  const hit = s.combo % c.coefs.length;
  const last = hit === c.coefs.length - 1;
  s.combo = hit + 1; s.sinceAttack = 0;
  s.cooldown = c.interval / attackRate(s, attackSpeed) * (last ? 1.6 : 1);
  return { hit, coef: c.coefs[hit], last, lunge: c.id === 'katana' && last };
}
export function manualReload(s: WeaponState, c: WeaponConfig) { if (c.magazine > 0 && s.reloading <= 0 && s.ammo < c.magazine) s.reloading = c.reload; }
/** Fury: hits fill the meter; at 100 fury triggers (attack speed +50%) for furyDuration. Dagger only. */
export function addFury(s: WeaponState, c: WeaponConfig): boolean {
  if (c.id !== 'dagger' || s.furyT > 0) return false;
  s.fury += c.furyGain;
  if (s.fury >= 100) { s.fury = 0; s.furyT = c.furyDuration; return true; }
  return false;
}
/** Special MP check. */
export function trySpecial(mp: number, c: WeaponConfig): { ok: boolean; mp: number } { return mp >= c.specialCost ? { ok: true, mp: mp - c.specialCost } : { ok: false, mp }; }
/** Iaido: hold to charge; release returns perfect if |charge - perfectAt| <= window. */
export function iaidoRelease(s: WeaponState, c: WeaponConfig): { perfect: boolean; power: number } {
  const t = s.charge; s.charging = false; s.charge = 0;
  const perfect = Math.abs(t - c.iaidoPerfectAt) <= c.iaidoWindow;
  return { perfect, power: Math.min(1.5, 0.6 + t) };
}
/** Guard check: blocks if guarding and attack comes from within the frontal 120° arc. */
export const GUARD_ARC = 120, PERFECT_GUARD = 0.15, GUARD_MP = 6;
export function guardBlock(s: WeaponState, c: WeaponConfig, facing: number, attackFrom: number, mp: number) {
  if (!c.hasGuard || !s.guarding) return { blocked: false, perfect: false, mpCost: 0 };
  let d = Math.abs(((attackFrom - facing) * 180 / Math.PI) % 360); if (d > 180) d = 360 - d;
  if (d > GUARD_ARC / 2) return { blocked: false, perfect: false, mpCost: 0 };
  const perfect = s.guardT <= PERFECT_GUARD;
  const cost = perfect ? 0 : Math.round(GUARD_MP * c.guardCostMult);
  if (!perfect && mp < cost) return { blocked: false, perfect: false, mpCost: 0 };
  return { blocked: true, perfect, mpCost: cost };
}
/** Anvil: upgrades available for weapon (not owned, requires met, excludes respected, tier ≤ maxTier). */
export const maxTierForChapter = (chapter: number) => (chapter <= 2 ? 1 : chapter <= 4 ? 2 : 3);
export function availableUpgrades(weapon: WeaponId, owned: string[], maxTier: number): WeaponUpgradeDef[] {
  return weaponUpgrades.filter((u) => u.weapon === weapon && !owned.includes(u.id) && u.tier <= maxTier
    && (u.requires ?? []).every((r) => owned.includes(r))
    && !(u.excludes ?? []).some((x) => owned.includes(x))
    && !owned.some((o) => (getUpgrade(o)?.excludes ?? []).includes(u.id)));
}
export function offerUpgrades(rng: Rng, weapon: WeaponId, owned: string[], chapter: number, n = 3): WeaponUpgradeDef[] {
  let pool = availableUpgrades(weapon, owned, maxTierForChapter(chapter));
  if (pool.length < n) pool = availableUpgrades(weapon, owned, 3);
  return rng.shuffle([...pool]).slice(0, n);
}
