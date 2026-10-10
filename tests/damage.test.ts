import { describe, it, expect } from 'vitest';
import { computeDamage, spellDamage, incomingDamage, critMultiplier, lifestealHeal } from '../src/systems/damage';
import { computeStats } from '../src/systems/stats';

describe('damage formula (C006, C004, C005, C009, C010)', () => {
  const s = computeStats([]);
  it('base * coef', () => { expect(computeDamage({ stats: s, element: 'physical', coef: 1.5, noCrit: true }).amount).toBe(30); });
  it('percent bonus', () => { expect(computeDamage({ stats: computeStats([{ stat: 'damagePct', value: 50 }]), element: 'fire', coef: 1, noCrit: true }).amount).toBe(30); });
  it('crit multiplier 1.5 at base critDmg', () => {
    expect(critMultiplier(50)).toBe(1.5);
    const r = computeDamage({ stats: s, element: 'ice', coef: 1, forceCrit: true }); expect(r.crit).toBe(true); expect(r.amount).toBe(30);
  });
  it('crit chance roll', () => {
    const cs = computeStats([{ stat: 'critChance', value: 50 }]);
    expect(computeDamage({ stats: cs, element: 'physical', coef: 1, rand: () => 0.4 }).crit).toBe(true);
    expect(computeDamage({ stats: cs, element: 'physical', coef: 1, rand: () => 0.6 }).crit).toBe(false);
  });
  it('target defense reduces, capped 75', () => {
    expect(computeDamage({ stats: s, element: 'physical', coef: 1, noCrit: true, targetDefense: 50 }).amount).toBe(10);
    expect(computeDamage({ stats: s, element: 'physical', coef: 1, noCrit: true, targetDefense: 100 }).amount).toBe(5);
  });
  it('element stat used', () => {
    const fs = computeStats([{ stat: 'fire', value: 20 }]);
    expect(computeDamage({ stats: fs, element: 'fire', coef: 1, noCrit: true }).amount).toBe(40);
    expect(computeDamage({ stats: fs, element: 'physical', coef: 1, noCrit: true }).amount).toBe(20);
  });
  it('shock taken bonus', () => { expect(computeDamage({ stats: s, element: 'physical', coef: 1, noCrit: true, targetTakenPct: 0.15 }).amount).toBe(23); });
  it('magic share for staff', () => { const ms = computeStats([{ stat: 'magic', value: 30 }]); expect(computeDamage({ stats: ms, element: 'fire', coef: 1, noCrit: true, magicShare: 0.5 }).amount).toBe(30); });
  it('spells scale with magic only', () => {
    const a = spellDamage(computeStats([]), 10), b = spellDamage(computeStats([{ stat: 'magic', value: 10 }]), 10), c = spellDamage(computeStats([{ stat: 'physical', value: 50 }]), 10);
    expect(b).toBeGreaterThan(a); expect(c).toBe(a);
  });
  it('incoming: evasion & defense', () => {
    const es = computeStats([{ stat: 'evasion', value: 30 }, { stat: 'defense', value: 50 }]);
    expect(incomingDamage(20, es, () => 0.1).evaded).toBe(true);
    expect(incomingDamage(20, es, () => 0.9).amount).toBe(10);
  });
  it('lifesteal', () => { expect(lifestealHeal(100, 5)).toBe(5); });
});
