import { describe, it, expect } from 'vitest';
import { newMeta, buyDestiny, canBuyDestiny, grantSum, spendTalent, respecTalents, talentPointsTotal, weaponUsable, completeTraining, checkCostumeUnlocks, discover, artifactPool, migrateMeta, sapphireReward, talentMods, costumeMods, hasHomeRepairs } from '../src/systems/meta';
import { destiny, costumes, talents } from '../src/systems/registry';

const rich = () => { const m = newMeta(); m.sapphires = 99999; return m; };
const buyAll = (m: ReturnType<typeof newMeta>) => { let changed = true; while (changed) { changed = false; for (const d of destiny) if (buyDestiny(m, d.id)) changed = true; } };

describe('meta / hub (C092-C099)', () => {
  it('destiny tree has >= 30 nodes', () => { expect(destiny.length).toBeGreaterThanOrEqual(30); });
  it('requirements and costs respected', () => {
    const m = newMeta(); const withReq = destiny.find((d) => d.requires.length)!;
    expect(canBuyDestiny(m, withReq.id).ok).toBe(false);
    const root = destiny.find((d) => !d.requires.length)!; m.sapphires = root.cost - 1; expect(buyDestiny(m, root.id)).toBe(false);
    m.sapphires = root.cost; expect(buyDestiny(m, root.id)).toBe(true); expect(m.sapphires).toBe(0); expect(buyDestiny(m, root.id)).toBe(false);
  });
  it('all nodes purchasable eventually', () => { const m = rich(); buyAll(m); expect(m.destinyOwned.length).toBe(destiny.length); });
  it('grant keys present', () => {
    const keys = new Set(destiny.map((d) => d.grant.key));
    for (const k of ['talentPoints', 'seedMoney', 'startDice', 'unlockWeapon', 'potionSlot', 'sideBag']) expect(keys.has(k)).toBe(true);
    expect(keys.has('bagCols') || keys.has('bagRows') || keys.has('bagSize')).toBe(true);
  });
  it('talent points cap 25, spend & free respec', () => {
    const m = rich(); buyAll(m); expect(talentPointsTotal(m)).toBeLessThanOrEqual(25); expect(talentPointsTotal(m)).toBeGreaterThan(0);
    expect(hasHomeRepairs(m)).toBe(true);
    const t = talents[0]; expect(spendTalent(m, t.id)).toBe(true); expect(talentMods(m)[0].stat).toBe(t.stat);
    const before = m.sapphires; respecTalents(m); expect(m.talentRanks).toEqual({}); expect(m.sapphires).toBe(before);
  });
  it('no talents without points', () => { const m = newMeta(); expect(spendTalent(m, talents[0].id)).toBe(false); });
  it('weapons need destiny unlock + training', () => {
    const m = rich(); expect(weaponUsable(m, 'swordshield')).toBe(true); expect(weaponUsable(m, 'dagger')).toBe(false);
    expect(completeTraining(m, 'dagger')).toBe(false); buyAll(m); expect(weaponUsable(m, 'dagger')).toBe(false);
    expect(completeTraining(m, 'dagger')).toBe(true); expect(weaponUsable(m, 'dagger')).toBe(true);
  });
  it('>= 6 costumes with tracked unlocks', () => {
    expect(costumes.length).toBeGreaterThanOrEqual(6);
    const m = newMeta(); m.stats = { deaths: 99, kills: 9999, bossKills: 99, wins: 9, maxChapter: 6, runs: 99 };
    const n = checkCostumeUnlocks(m); expect(n.length).toBeGreaterThan(0);
    expect(costumes.some((c) => c.fixedHp || Object.keys(c.stats ?? {}).length)).toBe(true);
    m.costume = costumes.find((c) => Object.keys(c.stats ?? {}).length)!.id; expect(costumeMods(m).length).toBeGreaterThan(0);
  });
  it('journal discovery', () => { const m = newMeta(); expect(discover(m, 'enemies', 'x')).toBe(true); expect(discover(m, 'enemies', 'x')).toBe(false); });
  it('artifact pool grows with unlocks', () => { const m = newMeta(); const a = artifactPool(m).length; const r = rich(); buyAll(r); expect(artifactPool(r).length).toBeGreaterThanOrEqual(a); });
  it('migration from v1', () => { const m = migrateMeta({ version: 1, sapphires: 7, journal: { artifacts: ['a'] } }); expect(m.version).toBe(2); expect(m.sapphires).toBe(7); expect(m.pocketUnlocked).toEqual([]); expect(m.journal.enemies).toEqual([]); });
  it('sapphire reward grows with depth and bosses', () => { expect(sapphireReward(5, 1, 0, false, false)).toBeGreaterThan(sapphireReward(2, 0, 0, false, false)); expect(sapphireReward(18, 6, 0, true, true)).toBeGreaterThan(sapphireReward(18, 6, 0, true, false)); });
});
