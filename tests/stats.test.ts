import { describe, it, expect } from 'vitest';
import { BASE_STATS, computeStats, moveSpeedPx, regenMp, tickDash, dashRechargeTime, addXp, xpToNext, levelMods, rarityWeights, buyPrice, sellPrice, DASH_TIME, DASH_DIST } from '../src/systems/stats';

describe('stats (C001-C011)', () => {
  it('base values match spec', () => {
    expect(BASE_STATS.maxHp).toBe(50); expect(BASE_STATS.maxMp).toBe(50);
    for (const k of ['physical', 'fire', 'ice', 'lightning'] as const) expect(BASE_STATS[k]).toBe(20);
    expect(BASE_STATS.defense).toBe(0); expect(BASE_STATS.evasion).toBe(0); expect(BASE_STATS.critChance).toBe(0);
    expect(BASE_STATS.critDamage).toBe(50); expect(BASE_STATS.attackSpeed).toBe(100); expect(BASE_STATS.moveSpeed).toBe(100); expect(BASE_STATS.dashCount).toBe(2);
    expect(BASE_STATS.mpRegen).toBe(4);
  });
  it('flat and pct mods', () => {
    const s = computeStats([{ stat: 'physical', value: 10 }, { stat: 'physical', value: 50, pct: true }]);
    expect(s.physical).toBe(45);
  });
  it('defense capped at 75 and evasion at 60', () => {
    const s = computeStats([{ stat: 'defense', value: 200 }, { stat: 'evasion', value: 99 }]);
    expect(s.defense).toBe(75); expect(s.evasion).toBe(60);
  });
  it('move speed 150 px/s scaled', () => {
    expect(moveSpeedPx(computeStats([]))).toBe(150);
    expect(moveSpeedPx(computeStats([{ stat: 'moveSpeed', value: 20 }]))).toBeCloseTo(180);
  });
  it('mp regen 4/s only after 1.5s', () => {
    expect(regenMp(10, 50, 4, 1.0, 1)).toBe(10);
    expect(regenMp(10, 50, 4, 1.6, 1)).toBe(14);
    expect(regenMp(49, 50, 4, 5, 1)).toBe(50);
  });
  it('dash recharge 1 per 1.2s scaled by recovery', () => {
    expect(dashRechargeTime(computeStats([]))).toBeCloseTo(1.2);
    expect(dashRechargeTime(computeStats([{ stat: 'dashRecovery', value: 100 }]))).toBeCloseTo(0.6);
    let st = tickDash(0, 0, 2, 1.2, 1.0); expect(st.charges).toBe(0);
    st = tickDash(st.charges, st.timer, 2, 1.2, 0.3); expect(st.charges).toBe(1);
    st = tickDash(st.charges, st.timer, 2, 1.2, 5); expect(st.charges).toBe(2);
    expect(DASH_TIME).toBe(0.18); expect(DASH_DIST).toBe(140);
  });
  it('xp levels', () => {
    const r = addXp(1, 0, xpToNext(1) + xpToNext(2));
    expect(r.level).toBe(3); expect(r.ups).toBe(2); expect(r.xp).toBe(0);
  });
  it('level mods +5 hp +2 dmg per level', () => {
    const s = computeStats(levelMods(3));
    expect(s.maxHp).toBe(60); expect(s.physical).toBe(24); expect(s.fire).toBe(24);
  });
  it('luck raises higher tiers', () => {
    const a = rarityWeights(0), b = rarityWeights(20);
    const share = (w: number[]) => w[3] / w.reduce((x, y) => x + y, 0);
    expect(share(b)).toBeGreaterThan(share(a));
    expect(b[1] / a[1]).toBeCloseTo(1 + 0.0116 * 20);
  });
  it('barter buy/sell', () => {
    expect(buyPrice(100, 10)).toBe(90);
    expect(sellPrice(100, 0)).toBe(40); expect(sellPrice(100, 10)).toBe(44);
  });
});
