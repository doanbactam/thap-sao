import { describe, it, expect } from 'vitest';
import { generateFloor, choicesFrom, reachable, planWaves, NODE_TYPES, EVENT_IDS, COLS, DEPTH, enemyScale, globalFloor } from '../src/systems/floorgen';

describe('floor generator (C070-C079)', () => {
  it('3 columns x 3 deep', () => {
    const f = generateFloor(1, 1, 1); expect(f.nodes.length).toBe(COLS * DEPTH);
    for (let d = 0; d < 3; d++) expect(f.nodes.filter((n) => n.depth === d).length).toBe(3);
  });
  it('links only to adjacent columns at next depth, straight always', () => {
    for (let s = 1; s < 40; s++) { const f = generateFloor(s, 2, 2);
      for (const n of f.nodes) for (const nx of n.next) { const m = f.nodes[nx]; expect(m.depth).toBe(n.depth + 1); expect(Math.abs(m.col - n.col)).toBeLessThanOrEqual(1); }
      for (const n of f.nodes.filter((x) => x.depth < 2)) expect(n.next).toContain(n.id + 3);
    }
  });
  it('branching occurs', () => { let br = 0; for (let s = 1; s < 30; s++) br += generateFloor(s, 1, 1).nodes.filter((n) => n.next.length > 1).length; expect(br).toBeGreaterThan(10); });
  it('all nodes reachable', () => { for (let s = 1; s < 30; s++) expect(reachable(generateFloor(s, 1, 2)).size).toBe(9); });
  it('choices: start → depth 0, last depth → gate', () => {
    const f = generateFloor(5, 1, 1); expect(choicesFrom(f, 'start')).toEqual([0, 1, 2]); expect(choicesFrom(f, 7)).toBe('gate');
  });
  it('boss on floor 3, gate on 1-2', () => {
    expect(generateFloor(1, 1, 3).gate).toBe('boss'); expect(generateFloor(1, 1, 1).gate).toBe('gate');
    expect(generateFloor(1, 4, 3).bossId).not.toBe(generateFloor(1, 4, 1).bossId);
  });
  it('start shop from global floor 2', () => { expect(generateFloor(1, 1, 1).startShop).toBe(false); expect(generateFloor(1, 1, 2).startShop).toBe(true); expect(generateFloor(1, 3, 1).startShop).toBe(true); });
  it('all 10 node types appear over many seeds, roots at most once', () => {
    const seen = new Set<string>();
    for (let s = 1; s < 200; s++) { const f = generateFloor(s, 1, 1, { rootsAvailable: true }); f.nodes.forEach((n) => seen.add(n.type)); expect(f.nodes.filter((n) => n.type === 'roots').length).toBeLessThanOrEqual(1); }
    for (const t of NODE_TYPES) expect(seen.has(t)).toBe(true);
  });
  it('no roots when used', () => { for (let s = 1; s < 100; s++) expect(generateFloor(s, 1, 1, { rootsAvailable: false }).nodes.some((n) => n.type === 'roots')).toBe(false); });
  it('every floor has an artifact node', () => { for (let s = 1; s < 100; s++) expect(generateFloor(s, 2, 1).nodes.some((n) => n.type === 'artifact')).toBe(true); });
  it('modifiers and events distribution', () => {
    let mods = { derangement: 0, miniboss: 0 }, ev = 0, tot = 0; const evs = new Set<string>();
    for (let s = 1; s < 400; s++) for (const n of generateFloor(s, 1, 1).nodes) { tot++; if (n.modifier !== 'none') mods[n.modifier]++; if (n.event) { ev++; evs.add(n.event); } if (n.type === 'shop' || n.type === 'roots') expect(n.modifier).toBe('none'); }
    expect(mods.derangement).toBeGreaterThan(0); expect(mods.miniboss).toBeGreaterThan(0);
    expect(ev / tot).toBeGreaterThan(0.08); expect(ev / tot).toBeLessThan(0.16);
    for (const e of EVENT_IDS) expect(evs.has(e)).toBe(true);
  });
  it('enchant altar sizes 1-3', () => { const s = new Set<number>(); for (let i = 1; i < 300; i++) generateFloor(i, 1, 1).nodes.filter((n) => n.type === 'enchant').forEach((n) => s.add(n.altarSize!)); expect([...s].sort()).toEqual([1, 2, 3]); });
  it('waves 1-3, arena 3-4, miniboss & derangement plans', () => {
    for (let s = 1; s < 50; s++) { const p = planWaves(s, 1, 1, 0, 'none', null); expect(p.waves.length).toBeGreaterThanOrEqual(1); expect(p.waves.length).toBeLessThanOrEqual(3); }
    for (let s = 1; s < 30; s++) { const p = planWaves(s, 1, 1, 0, 'none', 'arena'); expect(p.waves.length).toBeGreaterThanOrEqual(3); expect(p.waves.length).toBeLessThanOrEqual(4); }
    expect(planWaves(1, 2, 1, 1, 'miniboss', null).miniBoss).toBeTruthy();
    expect(planWaves(1, 2, 1, 1, 'derangement', null).derangement!.length).toBeGreaterThan(0);
  });
  it('hard mode +40% hp/dmg', () => { const a = enemyScale(1, 1, false), b = enemyScale(1, 1, true); expect(b.hp / a.hp).toBeCloseTo(1.4); expect(b.dmg / a.dmg).toBeCloseTo(1.4); expect(globalFloor(6, 3)).toBe(18); });
});
