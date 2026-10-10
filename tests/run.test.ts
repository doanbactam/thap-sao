import { describe, it, expect } from 'vitest';
import { newMeta, grantSum } from '../src/systems/meta';
import { newRun, runStats, makeChoice, rerollChoice, takeChoice, makeShop, buy, sell, rerollShop, gainXp, enterNode, canEnter, applyNodeReward, bossDefeated, endRun, drinkPotion, addPotion, enchant, resolveEvent, batReward, setChapter, onLethal, discard, tickBuffs, enchantTimes } from '../src/systems/run';
import { EVENT_IDS } from '../src/systems/floorgen';
import { destiny, potions, artifacts, tablets, miracles, combos, enemies, bosses } from '../src/systems/registry';
import { autoPlace } from '../src/systems/inventory';

const meta = () => newMeta();
describe('run (C011, C056, C058, C059, C070-C083)', () => {
  it('new run: chapter 1 floor 1, full hp/mp, 5x4 bag', () => { const r = newRun(meta(), { seed: 1 }); expect(r.chapter).toBe(1); expect(r.floor).toBe(1); expect(r.hp).toBe(50); expect(r.mp).toBe(50); expect(r.grid.cols * r.grid.rows).toBe(20); expect(r.potions.length).toBe(3); });
  it('destiny start bonuses apply', () => {
    const m = meta(); m.sapphires = 1e6; let ch = true; while (ch) { ch = false; for (const d of destiny) if (!m.destinyOwned.includes(d.id) && (d.requires.every((q) => m.destinyOwned.includes(q))) && m.sapphires >= d.cost) { m.destinyOwned.push(d.id); m.sapphires -= d.cost; ch = true; } }
    const r = newRun(m, { seed: 2 }); expect(r.money).toBe(grantSum(m, 'seedMoney')); expect(r.dice).toBe(grantSum(m, 'startDice')); expect(r.grid.sideUnlocked).toBe(true);
    expect(r.grid.cols * r.grid.rows).toBeGreaterThan(20); expect(r.potions.length).toBeGreaterThan(3);
  });
  it('choice 1/3 unique, reroll costs a die', () => {
    const m = meta(); const r = newRun(m, { seed: 3 }); const c = makeChoice(r, m, 'artifact', 't'); expect(c.options.length).toBe(3); expect(new Set(c.options).size).toBe(3);
    expect(rerollChoice(r, m)).toBe(false); r.dice = 1; expect(rerollChoice(r, m)).toBe(true); expect(r.dice).toBe(0);
    expect(takeChoice(r, m, 0)).toBe(true); expect(r.grid.items.length).toBe(1); expect(m.journal.artifacts.length).toBe(1);
  });
  it('tablet and upgrade choices', () => { const m = meta(); const r = newRun(m, { seed: 4 }); makeChoice(r, m, 'tablet', 't'); takeChoice(r, m, 0); expect(r.grid.items[0].kind).toBe('tablet'); makeChoice(r, m, 'upgrade', 'anvil'); takeChoice(r, m, 1); expect(r.upgrades.length).toBe(1); });
  it('miracle choice from roots, once per run', () => { const m = meta(); const r = newRun(m, { seed: 5 }); makeChoice(r, m, 'miracle', 'roots'); takeChoice(r, m, 0); expect(r.miracles.length).toBe(1); expect(r.rootsUsed).toBe(true);
    const node = { id: 0, col: 0, depth: 0, type: 'roots' as const, modifier: 'none' as const, event: null, next: [] }; expect(applyNodeReward(r, m, node)).toBe('none'); });
  it('miracle stat effect reaches stats', () => { const m = meta(); const r = newRun(m, { seed: 6 }); const mir = miracles.find((x) => x.effects.some((e) => e.kind === 'stat'))!; const b = runStats(r, m); r.miracles.push(mir.id); expect(JSON.stringify(runStats(r, m))).not.toBe(JSON.stringify(b)); });
  it('shop buy / sell / reroll', () => {
    const m = meta(); const r = newRun(m, { seed: 7 }); makeShop(r, m, 4); r.money = 5000; const n0 = r.grid.items.length;
    const idx = r.shop!.items.findIndex((i) => i.kind !== 'potion'); expect(buy(r, m, idx)).toBe(true); expect(r.shop!.items[idx].sold).toBe(true); expect(buy(r, m, idx)).toBe(false);
    expect(r.grid.items.length).toBe(n0 + 1); const money = r.money; const v = sell(r, r.grid.items[0].uid); expect(v).toBeGreaterThan(0); expect(r.money).toBe(money + v);
    r.dice = 1; expect(rerollShop(r, m)).toBe(true); expect(r.shop!.items.every((i) => !i.sold)).toBe(true);
  });
  it('cannot buy without money', () => { const m = meta(); const r = newRun(m, { seed: 8 }); makeShop(r, m, 4); r.money = 0; expect(buy(r, m, 0)).toBe(false); });
  it('discard', () => { const m = meta(); const r = newRun(m, { seed: 9 }); const p = autoPlace(r.grid, artifacts[0].id)!; expect(discard(r, p.uid)).toBe(true); expect(r.grid.items.length).toBe(0); });
  it('xp level up gives full MP', () => { const m = meta(); const r = newRun(m, { seed: 10 }); r.mp = 0; expect(gainXp(r, m, 25)).toBe(1); expect(r.level).toBe(2); expect(r.mp).toBe(runStats(r, m).maxMp); expect(runStats(r, m).maxHp).toBe(55); });
  it('node entry follows map links and room lock', () => {
    const m = meta(); const r = newRun(m, { seed: 11 }); expect(canEnter(r, 4)).toBe(false); expect(enterNode(r, 0)).toBeTruthy(); expect(r.roomCleared).toBe(false);
    expect(canEnter(r, r.floorData.nodes[0].next[0])).toBe(false); r.roomCleared = true; expect(canEnter(r, r.floorData.nodes[0].next[0])).toBe(true);
  });
  it('immediate node rewards', () => {
    const m = meta(); const r = newRun(m, { seed: 12 }); const N = (type: any) => ({ id: 0, col: 0, depth: 0, type, modifier: 'none' as const, event: null, next: [], altarSize: 2 as const });
    const lv = r.level; applyNodeReward(r, m, N('levelup')); expect(r.level).toBe(lv + 1);
    const mo = r.money; applyNodeReward(r, m, N('money')); expect(r.money).toBeGreaterThan(mo);
    const hp = runStats(r, m).maxHp; applyNodeReward(r, m, N('heart')); expect(runStats(r, m).maxHp).toBe(hp + 15);
    applyNodeReward(r, m, N('dice')); expect(r.dice).toBe(2);
    expect(applyNodeReward(r, m, N('artifact'))).toBe('choice'); expect(applyNodeReward(r, m, N('tablet'))).toBe('choice'); expect(applyNodeReward(r, m, N('anvil'))).toBe('choice');
    expect(applyNodeReward(r, m, N('shop'))).toBe('shop'); expect(applyNodeReward(r, m, N('enchant'))).toBe('enchant'); expect(enchantTimes(N('enchant'), m)).toBe(2);
  });
  it('enchant raises level permanently up to max', () => { const m = meta(); const r = newRun(m, { seed: 13 }); const p = autoPlace(r.grid, artifacts[0].id)!; enchant(r, p.uid, 2); expect(p.level).toBe(Math.min(2, artifacts[0].maxLevel)); enchant(r, p.uid, 99); expect(p.level).toBe(artifacts[0].maxLevel); });
  it('6 chapters x 3 floors → win', () => {
    const m = meta(); const r = newRun(m, { seed: 14 }); let res = '';
    for (let i = 0; i < 18; i++) res = bossDefeated(r, m, r.floor !== 3);
    expect(res).toBe('win'); expect(r.won).toBe(true); expect(r.bossesKilled).toBe(6); expect(r.minisKilled).toBe(12);
    const s = endRun(r, m, true); expect(s).toBeGreaterThan(0); expect(m.hardModeUnlocked).toBe(true); expect(m.stats.wins).toBe(1);
  });
  it('death rewards sapphires and counts death', () => { const m = meta(); const r = newRun(m, { seed: 15 }); bossDefeated(r, m, true); const s = endRun(r, m, false); expect(s).toBeGreaterThan(0); expect(m.sapphires).toBe(s); expect(m.stats.deaths).toBe(1); });
  it('revive from destiny', () => { const m = meta(); const r = newRun(m, { seed: 16 }); r.revives = 1; expect(onLethal(r, 50)).toBe(true); expect(r.hp).toBe(25); expect(onLethal(r, 50)).toBe(false); expect(r.dead).toBe(true); });
  it('potions: heal 40%, buffs, mystery identified on first drink', () => {
    const m = meta(); const r = newRun(m, { seed: 17 }); r.hp = 10; drinkPotion(r, m, 0); expect(r.hp).toBe(30);
    const buff = potions.find((p) => p.duration)!; addPotion(r, buff.id); drinkPotion(r, m, r.potions.indexOf(buff.id)); expect(r.buffs.length).toBe(1); tickBuffs(r, 999); expect(r.buffs.length).toBe(0);
    const myst = potions.find((p) => p.action === 'mystery')!; addPotion(r, myst.id); addPotion(r, myst.id);
    expect(drinkPotion(r, m, r.potions.indexOf(myst.id))!.identified).toBe(true); expect(drinkPotion(r, m, r.potions.indexOf(myst.id))!.identified).toBe(false);
  });
  it('all 9 events resolve', () => {
    for (const ev of EVENT_IDS) { const m = meta(); m.sapphires = 50; m.destinyOwned.push(...destiny.filter((d) => d.grant.key === 'pocketDimension').map((d) => d.id)); const r = newRun(m, { seed: 18 }); r.money = 1000; r.hp = 50;
      const opt = ev === 'clover' ? 'hp' : ev === 'fountain' ? 'gold' : ev === 'blood' ? 'pay' : 'go';
      const res = resolveEvent(r, m, ev, opt); expect(res.ok).toBe(true); }
  });
  it('event specifics', () => {
    const m = meta(); const r = newRun(m, { seed: 19 });
    resolveEvent(r, m, 'clover', 'def'); expect(runStats(r, m).defense).toBe(4);
    r.money = 100; expect(resolveEvent(r, m, 'companion', '').ok).toBe(false);
    expect(resolveEvent(r, m, 'merchant', '').shop).toBe(true); expect(r.shop!.discount).toBeCloseTo(0.1);
    expect(resolveEvent(r, m, 'fountain', 'red').fight).toBe('waves'); expect(resolveEvent(r, m, 'blood', 'bat').fight).toBe('bat'); expect(batReward(r)).toBeTruthy();
    expect(resolveEvent(r, m, 'arena', '').fight).toBe('arena');
    const hp = r.hp; resolveEvent(r, m, 'blood', 'pay'); expect(r.hp).toBeLessThan(hp);
  });
  it('setChapter jumps', () => { const m = meta(); const r = newRun(m, { seed: 20 }); setChapter(r, 5, 3); expect(r.floorData.gate).toBe('boss'); expect(r.floorData.chapter).toBe(5); });
  it('content minimums in registry (C060, C084, C087)', () => {
    expect(artifacts.length).toBeGreaterThanOrEqual(72); expect(tablets.length).toBeGreaterThanOrEqual(24); expect(combos.length).toBe(10);
    expect(miracles.length).toBeGreaterThanOrEqual(8); expect(potions.length).toBeGreaterThanOrEqual(6);
    expect(enemies.length).toBeGreaterThanOrEqual(30); for (let c = 1; c <= 6; c++) expect(enemies.filter((e) => e.chapter === c).length).toBeGreaterThanOrEqual(5);
    expect(bosses.filter((b) => b.mini).length).toBe(6); expect(bosses.filter((b) => !b.mini).length).toBe(6);
    for (const b of bosses.filter((x) => !x.mini)) expect(b.phases.length).toBeGreaterThanOrEqual(2);
  });
});
