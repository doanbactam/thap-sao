import { describe, it, expect } from 'vitest';
import { SPECIAL_IDS, hitMultiplier, chainCount, isBehind, splitManaShield, doomMark, phoenix, spellCritChance, spellEchoes, companionSlots, companionMods, guardCounterDamage, galeDashDamage } from '../src/systems/specials';
import { artifacts, miracles, destiny, potions } from '../src/systems/registry';
import { newMeta, grantSum, artifactPool, lockedOrder, hasHomeRepairs, canUseHardMode, levelUpHealPct, pocketEnabled } from '../src/systems/meta';
import { newRun, drinkPotion, addPotion, runStats, gainXp } from '../src/systems/run';
import { generateFloor } from '../src/systems/floorgen';

const T = { frozen: false, shocked: false, anyStatus: false, behind: false };
describe('special hooks (C069)', () => {
  it('every special id used by content is implemented', () => {
    const used = new Set<string>(); for (const a of [...artifacts, ...miracles]) for (const e of a.effects) { if (e.kind === 'special') used.add(e.id); if (e.kind === 'conditional' && e.inner.kind === 'special') used.add(e.inner.id); }
    for (const id of used) expect(SPECIAL_IDS as readonly string[]).toContain(id);
  });
  it('freezeShatter / lightningRod / backstab / debuffAmp / dashStrike multipliers', () => {
    expect(hitMultiplier({ freezeShatter: 30 }, { ...T, frozen: true })).toBeCloseTo(1.3);
    expect(hitMultiplier({ freezeShatter: 30 }, T)).toBe(1);
    expect(hitMultiplier({ lightningRod: 20 }, { ...T, shocked: true })).toBeCloseTo(1.2); expect(chainCount({ lightningRod: 1 })).toBe(4);
    expect(hitMultiplier({ backstab: 50 }, { ...T, behind: true })).toBeCloseTo(1.5);
    expect(hitMultiplier({ debuffAmp: 15 }, { ...T, anyStatus: true })).toBeCloseTo(1.15);
    expect(hitMultiplier({ dashStrike: 25 }, T, true)).toBeCloseTo(1.25);
  });
  it('isBehind uses >100°', () => { expect(isBehind(0, 0, 0, -10, 0)).toBe(true); expect(isBehind(0, 0, 0, 10, 0)).toBe(false); expect(isBehind(0, 0, 0, 0, 10)).toBe(false); });
  it('manaShield pays share from MP', () => { expect(splitManaShield({ manaShield: 50 }, 20, 100)).toEqual({ hp: 10, mp: 10 }); expect(splitManaShield({ manaShield: 50 }, 20, 3)).toEqual({ hp: 17, mp: 3 }); expect(splitManaShield({}, 20, 99).hp).toBe(20); });
  it('doomMark every 10th hit', () => { let c = 0, tot = 0; for (let i = 0; i < 20; i++) { const [b, n] = doomMark({ doomMark: 50 }, c); c = n; tot += b; } expect(tot).toBe(100); });
  it('phoenixRevive once per floor', () => { expect(phoenix({ phoenixRevive: 50 }, false, 80)).toBe(40); expect(phoenix({ phoenixRevive: 50 }, true, 80)).toBeNull(); expect(phoenix({}, false, 80)).toBeNull(); });
  it('spell crit / echo', () => { expect(spellCritChance({ spellCrit: 10 }, 5)).toBe(15); expect(spellEchoes({ spellEcho: 20 }, 0.1)).toBe(true); expect(spellEchoes({ spellEcho: 20 }, 0.3)).toBe(false); });
  it('companion hooks', () => { expect(companionSlots({ extraCompanion: 1 }, 1)).toBe(2); const m = companionMods({ companionDamage: 20, companionHaste: 10, companionCrit: 5, companionShare: 1 }); expect(m.damage).toBeCloseTo(1.2); expect(m.haste).toBeCloseTo(1.1); expect(m.crit).toBe(5); expect(m.healPct).toBe(1); });
  it('guardCounter / galeDash values', () => { expect(guardCounterDamage({ guardCounter: 40 })).toBe(40); expect(galeDashDamage({ galeDash: 25 })).toBe(25); });
});
const all = () => { const m = newMeta(); m.sapphires = 1e6; let ch = true; while (ch) { ch = false; for (const d of destiny) if (!m.destinyOwned.includes(d.id) && d.requires.every((q) => m.destinyOwned.includes(q)) && m.sapphires >= d.cost) { m.destinyOwned.push(d.id); m.sapphires -= d.cost; ch = true; } } return m; };
describe('destiny grant keys from data (C093)', () => {
  it('homeRepair unlocks talents, hardMode needs win', () => { const m = all(); expect(hasHomeRepairs(m)).toBe(true); expect(canUseHardMode(m)).toBe(false); m.stats.wins = 1; expect(canUseHardMode(m)).toBe(true); expect(hasHomeRepairs(newMeta())).toBe(false); });
  it('unlockArtifacts adds cheapest locked first', () => { const m = newMeta(); const base = artifactPool(m).length; const full = all(); const n = grantSum(full, 'unlockArtifacts'); expect(artifactPool(full).length).toBe(Math.min(artifacts.length, base + n)); expect(artifactPool(full)).toContain(lockedOrder()[0]); });
  it('levelUpHeal heals % on level up', () => { const m = all(); expect(levelUpHealPct(m)).toBeGreaterThan(0); const r = newRun(m, { seed: 3 }); r.hp = 10; gainXp(r, m, 30); expect(r.hp).toBeGreaterThan(15); });
  it('pocketDimension gates the pocket event', () => { expect(pocketEnabled(newMeta())).toBe(false); for (let s = 1; s < 200; s++) expect(generateFloor(s, 1, 1, { pocket: false }).nodes.some((n) => n.event === 'pocket')).toBe(false); });
  it('chestReroll and bag keys feed the run', () => { const m = all(); const r = newRun(m, { seed: 4 }); expect(r.chestRerolls).toBe(grantSum(m, 'chestReroll')); expect(r.grid.cols).toBe(5 + grantSum(m, 'bagCols')); expect(r.grid.rows).toBe(4 + grantSum(m, 'bagRows')); });
});
describe('potion actions from data (C058)', () => {
  it('rage / iron / swift / mana', () => {
    const m = newMeta(); const r = newRun(m, { seed: 5 }); const s0 = runStats(r, m);
    for (const act of ['rage', 'iron', 'swift']) { const p = potions.find((x) => x.action === act)!; addPotion(r, p.id); drinkPotion(r, m, r.potions.indexOf(p.id)); }
    const s = runStats(r, m); expect(s.damagePct).toBeGreaterThan(s0.damagePct); expect(s.defense).toBeGreaterThan(s0.defense); expect(s.moveSpeed).toBeGreaterThan(s0.moveSpeed); expect(s.attackSpeed).toBeGreaterThan(s0.attackSpeed);
    r.mp = 0; const mana = potions.find((x) => x.action === 'mana')!; addPotion(r, mana.id); drinkPotion(r, m, r.potions.indexOf(mana.id)); expect(r.mp).toBeGreaterThan(0);
  });
});
