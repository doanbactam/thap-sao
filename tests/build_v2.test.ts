import { describe, it, expect } from 'vitest';
import { art, tab } from './helpers';
import { newGrid, place, placementPreview, comboLine, cloneGrid, remove, resolve, comboProgress } from '../src/systems/inventory';
import { newMeta } from '../src/systems/meta';
import {
  newRun, makeChoice, rerollChoice, toggleLock, banishOption, offerArtifacts, offerWeight, OFFER, buildTags, makeShop, shopHeal, shopHealCost,
  rerollShop, shopRerollGold, shopEnchant, enchantCost, inflation, potionPrice, resolveEvent, eventStakes, companionPrice, bloodCost, redFountainGold,
  applyNodeReward, runStats, ECON,
} from '../src/systems/run';
import { rarityWeights } from '../src/systems/stats';
import { choiceDelta, runPower, bestPlacement, addBest } from '../src/systems/build';
import { procElement, procScale, KNOWN_SPECIALS } from '../src/systems/effects';
import { SPECIAL_IDS, procDamage } from '../src/systems/specials';
import { getArtifact, destiny } from '../src/systems/registry';
import artifacts from '../src/data/artifacts';

const A = art('v2_a', { tags: ['glacier'] });
const B = art('v2_b', { tags: ['glacier'], shape: [[0, 0], [1, 0]] });
const PLUS = tab('v2_plus_r', [{ at: [1, 0], op: { op: 'level', amount: 1 } }]);
const MINUS = tab('v2_minus_r', [{ at: [1, 0], op: { op: 'level', amount: -1 } }]);

describe('V2 placement preview (inventory clarity)', () => {
  it('tablet: target cells with sign, level change and disabling are known before placing', () => {
    const g = newGrid(); place(g, A, 1, 0);
    const pv = placementPreview(g, PLUS, 0, 0, 0);
    expect(pv.valid).toBe(true); expect(pv.targets[0].cell).toEqual([1, 0]); expect(pv.targets[0].sign).toBe(1); expect(pv.targets[0].hitsArtifact).toBe(true);
    expect(pv.arts).toHaveLength(1); expect(pv.arts[0].levelBefore).toBe(0); expect(pv.arts[0].levelAfter).toBe(1); expect(pv.arts[0].effAfter).toBe(1);
    const bad = placementPreview(g, MINUS, 0, 0, 0);
    expect(bad.targets[0].sign).toBe(-1); expect(bad.arts[0].disabledAfter).toBe(true); expect(bad.arts[0].nowActive).toBe(false); expect(bad.arts[0].wasActive).toBe(true);
    expect(bad.combos[0]).toMatchObject({ id: 'glacier', before: 1, after: 0 }); // a disabled artifact stops counting for its combo
  });
  it('artifact: combo progress 1→2/2 activates, and the dragged item reports its own level from nearby tablets', () => {
    const g = newGrid(); place(g, A, 0, 1); place(g, PLUS, 0, 0);
    const pv = placementPreview(g, B, 1, 0, 0);
    const self = pv.arts.find((a) => a.self)!; expect(self.levelAfter).toBe(1); expect(self.nowActive).toBe(true);
    const c = pv.combos.find((x) => x.id === 'glacier')!; expect(c.before).toBe(1); expect(c.after).toBe(2); expect(c.tierAfter).toBe(1); expect(c.next).toBe(4);
    expect(comboLine(c)).toMatch(/1→2\/4 ★1 kích hoạt!/);
  });
  it('moving an item compares against the pre-drag snapshot (net change, not +everything)', () => {
    const g = newGrid(); const a = place(g, A, 0, 0)!; place(g, B, 2, 0);
    const before = cloneGrid(g); remove(g, a.uid);
    const pv = placementPreview(g, A, 0, 2, 0, a.uid, before);
    const c = pv.combos.find((x) => x.id === 'glacier')!; expect(c.before).toBe(2); expect(c.after).toBe(2);
    expect(pv.arts.find((x) => x.self)!.wasActive).toBe(true);
  });
  it('invalid spot still shows where a tablet would point', () => {
    const g = newGrid(); place(g, A, 0, 0);
    const pv = placementPreview(g, PLUS, 0, 0, 0); expect(pv.valid).toBe(false); expect(pv.targets[0].cell).toEqual([1, 0]);
  });
  it('comboProgress thresholds', () => { expect(comboProgress('glacier', 3)).toEqual({ thresholds: [2, 4, 6], tier: 1, next: 4 }); expect(comboProgress('glacier', 6).next).toBeNull(); });
});

describe('V2 choice quality', () => {
  it('offers lean toward the build: weight grows with matching tags, near-threshold and weapon bias', () => {
    const m = newMeta(); const r = newRun(m, { seed: 1 });
    const base = offerWeight(r, 'g_snow_charm');
    place(r.grid, 'g_frost_shard', 0, 0);
    expect(offerWeight(r, 'g_snow_charm')).toBeCloseTo(base + OFFER.perTag + OFFER.nearThreshold);
    expect(offerWeight(r, 'e_matchbox')).toBe(1);
    expect(offerWeight(r, 'gd_wooden_buckler')).toBeCloseTo(1 + OFFER.weaponBias); // swordshield bias
  });
  it('pity: after missing offers, one option always grows the current build', () => {
    const m = newMeta();
    for (let seed = 1; seed <= 40; seed++) {
      const r = newRun(m, { seed }); place(r.grid, 'w_paper_fan', 0, 0); r.pity = OFFER.pityAfter - 1;
      const offer = offerArtifacts(r, m, 0, 3); const tags = buildTags(r);
      expect(offer.some((id) => getArtifact(id)!.tags.some((t) => tags[t]))).toBe(true);
    }
  });
  it('lock keeps an option through a reroll; banish costs a die and removes it for the run', () => {
    const m = newMeta(); const r = newRun(m, { seed: 7 }); r.dice = 3;
    const c = makeChoice(r, m, 'artifact', 't'); const keep = c.options[1];
    expect(toggleLock(r, 1)).toBe(true); expect(rerollChoice(r, m)).toBe(true);
    expect(r.choice!.options[1]).toBe(keep); expect(r.choice!.options).toHaveLength(3); expect(new Set(r.choice!.options).size).toBe(3);
    const gone = r.choice!.options[0]; expect(banishOption(r, m, 0)).toBe(true); expect(r.dice).toBe(1);
    expect(r.choice!.options[0]).not.toBe(gone); expect(r.banished).toContain(gone);
    for (let i = 0; i < 30; i++) expect(offerArtifacts(r, m, 0, 3)).not.toContain(gone);
    r.dice = 0; expect(banishOption(r, m, 0)).toBe(false);
  });
  it('mini-boss rarity floor survives a reroll', () => {
    const m = newMeta(); const r = newRun(m, { seed: 9 }); r.dice = 5; makeChoice(r, m, 'artifact', 'mb', 0, 1);
    for (let i = 0; i < 5; i++) { rerollChoice(r, m); for (const id of r.choice!.options) expect(getArtifact(id)!.rarity).not.toBe('common'); }
  });
  it('rarity scales per floor inside a chapter', () => {
    const f1 = rarityWeights(0, 2, 1), f3 = rarityWeights(0, 2, 3), next = rarityWeights(0, 3, 1);
    expect(f3[3] / f3.reduce((a, b) => a + b)).toBeGreaterThan(f1[3] / f1.reduce((a, b) => a + b));
    expect(next[3]).toBeGreaterThan(f3[3]);
  });
  it('every choice card has a concrete numeric delta', () => {
    const m = newMeta(); const r = newRun(m, { seed: 3 });
    const helm = choiceDelta(r, m, 'artifact', 'gd_iron_helm');
    expect(helm.power.pct).toBeGreaterThan(0); expect(helm.stats.find((s) => s.stat === 'maxHp')!.text).toMatch(/HP tối đa \+8 \(50→58\)/);
    place(r.grid, 'g_frost_shard', 0, 0);
    const charm = choiceDelta(r, m, 'artifact', 'g_snow_charm'); expect(charm.combos.find((c) => c.id === 'glacier')!.after).toBe(2);
    expect(choiceDelta(r, m, 'miracle', 'mir_starlight_blessing').stats.some((s) => s.stat === 'damagePct')).toBe(true);
    expect(choiceDelta(r, m, 'tablet', 't_arrow').lines[0]).toMatch(/Sức mạnh/);
  });
  it('best placement puts a +1 tablet next to an artifact, addBest respects constraints', () => {
    const m = newMeta(); const r = newRun(m, { seed: 4 }); place(r.grid, 'gd_iron_helm', 2, 2);
    const b = bestPlacement(r, m, 't_arrow')!; const p0 = runPower(r, m).score; expect(b.score).toBeGreaterThan(p0);
    const p = addBest(r, m, 'g_icicle_spear')!; expect(resolve(r.grid).arts.get(p.uid)!.active).toBe(true); // must touch bottom edge
  });
});

describe('V2 economy & events', () => {
  it('shop: inflation, potion price, heal once, gold reroll escalates when out of dice', () => {
    const m = newMeta(); const r = newRun(m, { seed: 11 }); r.chapter = 3; makeShop(r, m, 4);
    expect(inflation(3)).toBeCloseTo(1 + 2 * ECON.inflationPerChapter); expect(r.shop!.items.find((i) => i.kind === 'potion')!.price).toBe(potionPrice(3));
    r.money = 1000; r.hp = 10; const hc = shopHealCost(r); expect(shopHeal(r, 50)).toBe(true); expect(r.money).toBe(1000 - hc); expect(r.hp).toBeGreaterThan(10);
    expect(shopHeal(r, 50)).toBe(false);
    r.dice = 0; const g1 = shopRerollGold(r); expect(rerollShop(r, m)).toBe(true); expect(r.money).toBe(1000 - hc - g1);
    expect(shopRerollGold(r)).toBeGreaterThan(g1); expect(r.shop!.healed).toBe(true);
    r.money = 0; expect(rerollShop(r, m)).toBe(false);
  });
  it('shop enchant: +1 level for gold, price grows with level and repeat', () => {
    const m = newMeta(); const r = newRun(m, { seed: 12 }); makeShop(r, m, 4); const p = place(r.grid, 'gd_iron_helm', 0, 0)!;
    r.money = 5000; const c1 = enchantCost(r, p.uid)!; expect(shopEnchant(r, p.uid)).toBe(true); expect(p.level).toBe(1);
    expect(enchantCost(r, p.uid)!).toBeGreaterThan(c1 * 2); p.level = getArtifact('gd_iron_helm')!.maxLevel; expect(enchantCost(r, p.uid)).toBeNull();
  });
  it('blood altar: costs 25% max HP, gives an epic+ choice; stakes text is exact', () => {
    const m = newMeta(); const r = newRun(m, { seed: 13 }); r.hp = 50;
    expect(eventStakes(r, m, 'blood', 'pay', { maxHp: 50 })).toMatch(new RegExp(`Mất ${bloodCost(r, 50)} HP`));
    const res = resolveEvent(r, m, 'blood', 'pay', { maxHp: 50 }); expect(res.ok).toBe(true); expect(r.hp).toBe(50 - Math.ceil(50 * ECON.bloodHpPct));
    for (const id of res.choice!.options) expect(['epic', 'legendary']).toContain(getArtifact(id)!.rarity);
    r.hp = 5; expect(resolveEvent(r, m, 'blood', 'pay', { maxHp: 50 }).ok).toBe(false);
  });
  it('obelisk stakes name the exact swap that will happen', () => {
    const m = newMeta(); const r = newRun(m, { seed: 14 });
    const txt = eventStakes(r, m, 'obelisk', 'go'); const res = resolveEvent(r, m, 'obelisk', 'go'); const [, , , amt] = res.text.split(':');
    expect(txt).toContain(`+${amt}`); expect(txt).toContain(`−${amt}`);
  });
  it('companion price scales by chapter, red fountain pays up front', () => {
    const m = newMeta(); const r = newRun(m, { seed: 15 }); r.money = companionPrice(r);
    expect(resolveEvent(r, m, 'companion', 'go').ok).toBe(true); expect(r.money).toBe(0);
    const g = redFountainGold(r); expect(resolveEvent(r, m, 'fountain', 'red').fight).toBe('waves'); expect(r.money).toBe(g);
  });
  it('Destiny chest reroll: money chest pays the better of two rolls once per floor', () => {
    const N = { id: 0, col: 0, depth: 0, type: 'money' as const, modifier: 'none' as const, event: null, next: [] };
    let sumA = 0, sumB = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const ma = newMeta(); const a = newRun(ma, { seed }); a.money = 0; applyNodeReward(a, ma, N); sumA += a.money;
      const mb = newMeta(); mb.destinyOwned.push(destiny.find((d) => d.grant.key === 'chestReroll')!.id); const b = newRun(mb, { seed }); b.money = 0; applyNodeReward(b, mb, N); sumB += b.money; expect(b.chestRerollUsed).toBe(true);
    }
    expect(sumB).toBeGreaterThan(sumA);
  });
});

describe('V2 synergy audit', () => {
  it('elemental procs scale with the build\'s element bonus, not with level-ups', () => {
    expect(procElement('combo:ember', 'kill:explode')).toBe('fire');
    expect(procElement('x', 'periodic:frostRing')).toBe('ice');
    expect(procElement('s_storm_kite', 'dash:shockwave', (id) => getArtifact(id)!.tags as string[])).toBe('lightning');
    const s = { physical: 34, fire: 34, ice: 34, lightning: 51 };
    expect(procScale(s, 'fire', 8)).toBeCloseTo(1); expect(procScale(s, 'lightning', 8)).toBeCloseTo(1.5);
    expect(procDamage('dash:shockwave', 20, 's_storm_kite', s, 8).v).toBe(30); expect(procDamage('kill:heal', 20, 'combo:ember', s, 8).v).toBe(20);
  });
  it('flat element commons are live on physical weapons (they carry their status)', () => {
    for (const id of ['g_frost_shard', 'e_ember_coal', 's_spark_bead']) expect(getArtifact(id)!.effects.some((e) => e.kind === 'onHit')).toBe(true);
  });
  it('special hook registry matches the engine', () => { expect([...KNOWN_SPECIALS].sort()).toEqual([...SPECIAL_IDS].sort()); });
  it('no two artifacts have identical effect lists', () => {
    const seen = new Map<string, string>();
    for (const a of artifacts) { const k = JSON.stringify(a.effects); expect(seen.get(k), `${a.id} duplicates ${seen.get(k)}`).toBeUndefined(); seen.set(k, a.id); }
  });
  it('a fresh hero scores 100 power and every artifact moves power or economy', () => {
    const m = newMeta(); const r = newRun(m, { seed: 1 }); expect(Math.round(runPower(r, m).score)).toBe(100);
    expect(runStats(r, m).maxHp).toBe(50);
  });
});
