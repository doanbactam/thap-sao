import { describe, it, expect } from 'vitest';
import { buildWeapon, newWeaponState, tryAttack, tickWeapon, addFury, trySpecial, iaidoRelease, guardBlock, availableUpgrades, offerUpgrades, maxTierForChapter, manualReload, attackRate } from '../src/systems/weapons';
import { weapons, weaponUpgrades, getUpgrade } from '../src/systems/registry';
import { Rng } from '../src/systems/rng';
import type { WeaponId } from '../src/data/types';

const IDS: WeaponId[] = ['swordshield', 'greatsword', 'dagger', 'katana', 'crossbow', 'staff'];
describe('weapons (C023-C034)', () => {
  it('six weapons registered', () => { for (const id of IDS) expect(weapons.find((w) => w.id === id)).toBeTruthy(); });
  it('sword&shield 3-hit combo with guard, cost 20', () => {
    const c = buildWeapon('swordshield'); expect(c.coefs.length).toBe(3); expect(c.hasGuard).toBe(true); expect(c.specialCost).toBe(20);
    const s = newWeaponState(c); const hits: number[] = [];
    for (let i = 0; i < 4; i++) { const h = tryAttack(s, c)!; hits.push(h.hit); tickWeapon(s, c, 0.6); }
    expect(hits).toEqual([0, 1, 2, 0]);
  });
  it('combo resets after idle', () => { const c = buildWeapon('swordshield'); const s = newWeaponState(c); tryAttack(s, c); tickWeapon(s, c, 1.0); expect(tryAttack(s, c)!.hit).toBe(0); });
  it('greatsword 2-hit heavy, knockback, super armor, 25 MP', () => { const c = buildWeapon('greatsword'); expect(c.coefs.length).toBe(2); expect(c.superArmor).toBe(true); expect(c.knockback).toBeGreaterThan(buildWeapon('swordshield').knockback); expect(c.specialCost).toBe(25); expect(c.arc).toBeGreaterThan(140); });
  it('dagger 4-hit, fury triggers +50% attack speed', () => {
    const c = buildWeapon('dagger'); expect(c.coefs.length).toBe(4); expect(c.specialCost).toBe(15);
    const s = newWeaponState(c); let trig = false; for (let i = 0; i < 20 && !trig; i++) trig = addFury(s, c);
    expect(trig).toBe(true); expect(s.furyT).toBe(c.furyDuration); expect(attackRate(s, 100)).toBe(1.5);
  });
  it('katana 3rd hit lunges, iaido perfect release', () => {
    const c = buildWeapon('katana'); const s = newWeaponState(c);
    tryAttack(s, c); tickWeapon(s, c, 0.5); tryAttack(s, c); tickWeapon(s, c, 0.5); expect(tryAttack(s, c)!.lunge).toBe(true);
    s.charging = true; tickWeapon(s, c, c.iaidoPerfectAt); expect(iaidoRelease(s, c).perfect).toBe(true);
    s.charging = true; tickWeapon(s, c, 0.1); expect(iaidoRelease(s, c).perfect).toBe(false);
  });
  it('crossbow magazine 6 and reload 1.2s', () => {
    const c = buildWeapon('crossbow'); expect(c.magazine).toBe(6); expect(c.reload).toBeCloseTo(1.2);
    const s = newWeaponState(c); let shots = 0;
    for (let i = 0; i < 10; i++) { if (tryAttack(s, c)) shots++; s.cooldown = 0; }
    expect(shots).toBe(6); expect(s.reloading).toBeGreaterThan(0);
    tickWeapon(s, c, 1.25); expect(s.ammo).toBe(6);
    s.ammo = 3; manualReload(s, c); expect(s.reloading).toBeGreaterThan(0);
  });
  it('staff uses magic partially, homing, 30 MP', () => { const c = buildWeapon('staff'); expect(c.magicShare).toBeGreaterThan(0); expect(c.homing).toBeGreaterThan(0); expect(c.specialCost).toBe(30); });
  it('special mp check', () => { const c = buildWeapon('swordshield'); expect(trySpecial(10, c).ok).toBe(false); expect(trySpecial(25, c).mp).toBe(5); });
  it('guard frontal 120° arc, MP cost, perfect guard free', () => {
    const c = buildWeapon('swordshield'); const s = newWeaponState(c); s.guarding = true; s.guardT = 0.05;
    expect(guardBlock(s, c, 0, 0.3, 50)).toMatchObject({ blocked: true, perfect: true, mpCost: 0 });
    s.guardT = 0.5; const g = guardBlock(s, c, 0, 0.3, 50); expect(g.blocked).toBe(true); expect(g.mpCost).toBeGreaterThan(0);
    expect(guardBlock(s, c, 0, Math.PI, 50).blocked).toBe(false);
    expect(guardBlock(s, c, 0, 0.3, 0).blocked).toBe(false);
    const d = buildWeapon('dagger'); expect(guardBlock({ ...s }, d, 0, 0, 50).blocked).toBe(false);
  });
  it('>= 8 upgrades per weapon, 2-3 tiers', () => {
    for (const id of IDS) { const u = weaponUpgrades.filter((x) => x.weapon === id); expect(u.length).toBeGreaterThanOrEqual(8); expect(new Set(u.map((x) => x.tier)).size).toBeGreaterThanOrEqual(2); }
  });
  it('upgrade mods are applied (extraHit, cost, magazine, pierce)', () => {
    for (const id of IDS) {
      const ups = weaponUpgrades.filter((x) => x.weapon === id);
      const base = buildWeapon(id); const all = buildWeapon(id, ups.filter((u) => !u.excludes?.length).map((u) => u.id));
      const changed = JSON.stringify(base.mods) !== JSON.stringify(all.mods); expect(changed).toBe(true);
    }
    const eh = weaponUpgrades.find((u) => u.mods.some((m) => m.key === 'extraHit'))!; expect(buildWeapon(eh.weapon, [eh.id]).coefs.length).toBe(buildWeapon(eh.weapon).coefs.length + 1);
    const sc = weaponUpgrades.find((u) => u.mods.some((m) => m.key === 'specialCostPct'))!; expect(buildWeapon(sc.weapon, [sc.id]).specialCost).toBeLessThan(buildWeapon(sc.weapon).specialCost);
    const mg = weaponUpgrades.find((u) => u.mods.some((m) => m.key === 'magazine'))!; expect(buildWeapon(mg.weapon, [mg.id]).magazine).toBeGreaterThan(6);
    const pc = weaponUpgrades.find((u) => u.mods.some((m) => m.key === 'pierce'))!; expect(buildWeapon(pc.weapon, [pc.id]).pierce).toBeGreaterThan(0);
  });
  it('element aspect converts element', () => {
    const asp = weaponUpgrades.find((u) => u.mods.some((m) => (m.key === 'aspect' || m.key === 'element') && m.value === 'ice'))!;
    expect(buildWeapon(asp.weapon, [asp.id]).element).toBe('ice');
  });
  it('anvil: tier gated, requires/excludes respected', () => {
    expect(maxTierForChapter(1)).toBe(1); expect(maxTierForChapter(6)).toBe(3);
    const t1 = availableUpgrades('swordshield', [], 1); expect(t1.every((u) => u.tier === 1)).toBe(true);
    const withReq = weaponUpgrades.find((u) => u.requires?.length)!;
    expect(availableUpgrades(withReq.weapon, [], 3).some((u) => u.id === withReq.id)).toBe(false);
    expect(availableUpgrades(withReq.weapon, withReq.requires!, 3).some((u) => u.id === withReq.id)).toBe(true);
    const ex = weaponUpgrades.find((u) => u.excludes?.length)!;
    expect(availableUpgrades(ex.weapon, [ex.id], 3).some((u) => ex.excludes!.includes(u.id))).toBe(false);
    const o = offerUpgrades(new Rng(3), 'katana', [], 3); expect(o.length).toBe(3); expect(new Set(o.map((u) => u.id)).size).toBe(3);
    expect(getUpgrade(o[0].id)).toBeTruthy();
  });
});
describe('dash attack (C029)', () => {
  it('every weapon has a dash attack coefficient and dashAttack upgrades enable it', () => {
    for (const id of IDS) expect(buildWeapon(id).dashAttackCoef).toBeGreaterThan(0);
    const u = weaponUpgrades.find((x) => x.mods.some((m) => m.key === 'dashAttack'))!;
    expect(buildWeapon(u.weapon, [u.id]).dashAttack).toBe(true); expect(buildWeapon(u.weapon).dashAttack).toBe(false);
  });
});
