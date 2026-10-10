import { describe, it, expect } from 'vitest';
import { buildBundle, statMods, fireOnHit, fireOnKill, fireOnDash, fireOnHurt, tickPeriodic, quickSpells, castSpell, specialsOf, condOk } from '../src/systems/effects';
import type { Effect } from '../src/data/types';
const I = (effect: Effect, level = 0) => ({ effect, level, source: 's' });
const ctx = { hpPct: 1, mpPct: 1, dashLeft: 2, bossRoom: false };

describe('effects interpreter (C061-C069)', () => {
  it('stat flat/pct scaled per level', () => {
    const b = buildBundle([I({ kind: 'stat', stat: 'fire', base: 2, perLevel: 3 }, 2), I({ kind: 'stat', stat: 'ice', base: 10, perLevel: 0, pct: true })]);
    const m = statMods(b, ctx); expect(m[0].value).toBe(8); expect(m[1].pct).toBe(true);
  });
  it('onHit chance per level and stacks', () => {
    const b = buildBundle([I({ kind: 'onHit', chance: 0.2, perLevel: 0.1, apply: 'burn', stacks: 2 }, 2)]);
    expect(b.onHit[0].chance).toBeCloseTo(0.4);
    expect(fireOnHit(b, ctx, () => 0.39)[0]).toMatchObject({ status: 'burn', stacks: 2 });
    expect(fireOnHit(b, ctx, () => 0.41).length).toBe(0);
  });
  it('onKill actions', () => {
    const b = buildBundle(['heal', 'mp', 'money', 'explode'].map((a) => I({ kind: 'onKill', action: a as any, base: 1, perLevel: 1 }, 1)));
    expect(fireOnKill(b, ctx).map((a) => a.action)).toEqual(['heal', 'mp', 'money', 'explode']);
    expect(fireOnKill(b, ctx)[0].amount).toBe(2);
  });
  it('onDash actions', () => {
    const b = buildBundle(['trail', 'shockwave', 'shield', 'heal'].map((a) => I({ kind: 'onDash', action: a as any, base: 5, perLevel: 0 })));
    expect(fireOnDash(b, ctx).length).toBe(4);
  });
  it('onHurt actions', () => {
    const b = buildBundle(['thorns', 'nova', 'mp'].map((a) => I({ kind: 'onHurt', action: a as any, base: 5, perLevel: 0 })));
    expect(fireOnHurt(b, ctx).map((x) => x.action)).toEqual(['thorns', 'nova', 'mp']);
  });
  it('periodic fires on its interval with cooldown reduction', () => {
    const b = buildBundle(['orb', 'lightning', 'meteor', 'heal', 'frostRing'].map((a) => I({ kind: 'periodic', every: 2, action: a as any, base: 3, perLevel: 0 })));
    const timers = {};
    expect(tickPeriodic(timers, b, ctx, 1.5).length).toBe(0);
    expect(tickPeriodic(timers, b, ctx, 0.6).length).toBe(5);
    const t2 = {}; expect(tickPeriodic(t2, b, ctx, 1.1, 50).length).toBe(5);
  });
  it('conditional variants', () => {
    expect(condOk('hpBelow50', { ...ctx, hpPct: 0.4 })).toBe(true); expect(condOk('hpBelow50', ctx)).toBe(false);
    expect(condOk('fullHp', ctx)).toBe(true); expect(condOk('mpAbove50', { ...ctx, mpPct: 0.3 })).toBe(false);
    expect(condOk('noDashLeft', { ...ctx, dashLeft: 0 })).toBe(true); expect(condOk('bossRoom', { ...ctx, bossRoom: true })).toBe(true);
    const b = buildBundle([I({ kind: 'conditional', when: 'hpBelow50', inner: { kind: 'stat', stat: 'damagePct', base: 20, perLevel: 0 } })]);
    expect(statMods(b, ctx).length).toBe(0); expect(statMods(b, { ...ctx, hpPct: 0.3 })[0].value).toBe(20);
  });
  it('conditional wrapping a trigger', () => {
    const b = buildBundle([I({ kind: 'conditional', when: 'bossRoom', inner: { kind: 'onKill', action: 'heal', base: 3, perLevel: 0 } })]);
    expect(fireOnKill(b, ctx).length).toBe(0); expect(fireOnKill(b, { ...ctx, bossRoom: true }).length).toBe(1);
  });
  it('spells: up to 2 quick slots, MP + cooldown', () => {
    const sp = ['icebolt', 'fireball', 'chainLightning'].map((s) => I({ kind: 'spell', spell: s as any, mpCost: 10, cooldown: 2, base: 10, perLevel: 2 }, 1));
    const q = quickSpells(buildBundle(sp)); expect(q.length).toBe(2); expect(q[0].power).toBe(12);
    expect(castSpell(q[0], 5, 0).ok).toBe(false); expect(castSpell(q[0], 20, 1).reason).toBe('cooldown'); expect(castSpell(q[0], 20, 0).mp).toBe(10);
  });
  it('summons and specials', () => {
    const b = buildBundle([I({ kind: 'summon', companion: 'cmp_bat', base: 5, perLevel: 1 }, 2), I({ kind: 'special', id: 'goldTouch', base: 3, perLevel: 1 }, 1), I({ kind: 'special', id: 'goldTouch', base: 1, perLevel: 0 })]);
    expect(b.summons[0].value).toBe(7); expect(specialsOf(b).goldTouch).toBe(5);
  });
});
