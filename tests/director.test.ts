// V2 encounter director: role budgets, 2–3 waves escalating per floor, elites with affixes (docs/V2_AI.md).
import { describe, it, expect } from 'vitest';
import { planEncounter, composeWave, waveBudget, eliteChance, enemyCost, eliteMods, affixesFor, AFFIXES, MAX_WAVE_COUNT, roleCaps } from '../src/systems/director';
import { planWaves } from '../src/systems/floorgen';
import { roleOf } from '../src/systems/ai';
import { Rng } from '../src/systems/rng';
import { chapters, getEnemy } from '../src/systems/registry';
import type { EnemyDef } from '../src/data/types';

const pool = (ch: number) => chapters.find((c) => c.id === ch)!.enemies.map((id) => getEnemy(id)!) as EnemyDef[];

describe('encounter director', () => {
  it('normal rooms have 2–3 waves, arena 3–4', () => {
    for (let ch = 1; ch <= 6; ch++) for (let s = 1; s < 60; s++) {
      const n = planEncounter(s, ch, 1 + (s % 3), s % 3, pool(ch)).waves.length; expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(3);
      const a = planEncounter(s, ch, 1, 0, pool(ch), { arena: true }).waves.length; expect(a).toBeGreaterThanOrEqual(3); expect(a).toBeLessThanOrEqual(4);
    }
  });
  it('waves stay within budget, role caps and the count cap; each opens with a rusher', () => {
    for (let ch = 1; ch <= 6; ch++) for (let s = 1; s < 80; s++) {
      const b = waveBudget(ch, 1 + (s % 3), s % 3, s % 3); const ids = composeWave(new Rng(s), pool(ch), b, ch);
      const defs = ids.map((id) => getEnemy(id)!);
      expect(ids.length).toBeLessThanOrEqual(MAX_WAVE_COUNT);
      // ≥ 2 bodies per wave (a swarm entry spawns several; ch1 budget 2.75 can open with a lone swarm group)
      expect(defs.reduce((t, d) => t + (d.params?.swarmSize ?? 1), 0)).toBeGreaterThanOrEqual(2);
      expect(defs.reduce((t, d) => t + enemyCost(d), 0)).toBeLessThanOrEqual(b + 1.5);
      const caps = roleCaps(ch, ids.length); const cnt = (r: string) => defs.filter((d) => roleOf(d.ai) === r).length;
      expect(cnt('tank')).toBeLessThanOrEqual(caps.tank); expect(cnt('support')).toBeLessThanOrEqual(1); expect(cnt('ranged')).toBeLessThanOrEqual(Math.ceil(ids.length * 0.5) + 1);
      expect(roleOf(defs[0].ai)).toBe('rusher');
    }
  });
  it('escalates: budget grows per floor, depth and wave; later chapters field more enemies', () => {
    expect(waveBudget(1, 2, 0, 0)).toBeGreaterThan(waveBudget(1, 1, 0, 0));
    expect(waveBudget(1, 1, 2, 0)).toBeGreaterThan(waveBudget(1, 1, 0, 0));
    expect(waveBudget(1, 1, 0, 2)).toBeGreaterThan(waveBudget(1, 1, 0, 0));
    expect(waveBudget(6, 1, 0, 0)).toBeGreaterThan(waveBudget(1, 1, 0, 0));
    const avg = (ch: number) => { let n = 0; for (let s = 1; s < 60; s++) n += planEncounter(s, ch, 2, 1, pool(ch)).waves.flat().length; return n / 59; };
    expect(avg(6)).toBeGreaterThan(avg(1));
  });
  it('elites: none on chapter 1 floor 1, appear later, max per wave, never on swarms or elite defs, none in miniboss rooms', () => {
    expect(eliteChance(1, 1, 2)).toBe(0);
    for (let s = 1; s < 60; s++) expect(planEncounter(s, 1, 1, 2, pool(1)).waves.flat().some((e) => e.elite)).toBe(false);
    let elites = 0;
    for (let ch = 2; ch <= 6; ch++) for (let s = 1; s < 60; s++) {
      const enc = planEncounter(s, ch, 3, 2, pool(ch));
      enc.waves.forEach((w, i) => { const n = w.filter((e) => e.elite).length; elites += n; expect(n).toBeLessThanOrEqual(i === enc.waves.length - 1 && ch >= 5 ? 2 : 1); });
      for (const e of enc.waves.flat().filter((x) => x.elite)) { const d = getEnemy(e.id)!; expect(d.params?.swarmSize).toBeFalsy(); expect(d.elite).toBeFalsy(); expect(affixesFor(d.ai)).toContain(e.elite); }
      expect(planEncounter(s, ch, 3, 2, pool(ch), { miniboss: true }).waves.flat().some((e) => e.elite)).toBe(false);
    }
    expect(elites).toBeGreaterThan(50);
    // arena last wave always has an elite (past ch1 f1)
    for (let s = 1; s < 30; s++) { const enc = planEncounter(s, 2, 1, 0, pool(2), { arena: true }); expect(enc.waves[enc.waves.length - 1].some((e) => e.elite)).toBe(true); }
  });
  it('affix modifiers: tougher, distinct marker colour + label; swift/shielded/splitting/volatile mechanics', () => {
    const cols = new Set<number>();
    for (const a of AFFIXES) { const m = eliteMods(a); expect(m.hpMul).toBeGreaterThan(1); expect(m.label.length).toBeGreaterThan(3); cols.add(m.color); }
    expect(cols.size).toBe(AFFIXES.length);
    expect(eliteMods('swift').speedMul).toBeGreaterThan(1); expect(eliteMods('swift').cdMul).toBeLessThan(1);
    expect(eliteMods('shielded').armor).toBeGreaterThan(0); expect(eliteMods('splitting').split).toBe(2); expect(eliteMods('volatile').explodeOnDeath).toBe(true);
    expect(affixesFor('shielded')).not.toContain('swift'); expect(affixesFor('turret')).not.toContain('swift');
  });
  it('planWaves (floorgen) carries the director elites aligned with waves', () => {
    for (let s = 1; s < 40; s++) { const p = planWaves(s, 4, 3, 2, 'none', null); expect(p.elites!.length).toBe(p.waves.length); p.waves.forEach((w, i) => expect(p.elites![i].length).toBe(w.length)); }
  });
});
