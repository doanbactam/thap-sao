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

// ---- v2 map pass (docs/V2_MAP.md): structural rules over many seeds ----
import { validateFloor, allPaths, linksCross, mapView, bossForeshadow, templateNodes, SUSTAIN, HIGH_VALUE, ELITE_MAX, DIAG_MIN, DIAG_MAX, type Floor } from '../src/systems/floorgen';
import { Rng } from '../src/systems/rng';
const SEEDS = 400;
function* floors(): Generator<[Floor, boolean]> {
  for (let ch = 1; ch <= 6; ch++) for (let fl = 1; fl <= 3; fl++) for (let s = 1; s <= SEEDS; s++) { const roots = s % 3 !== 0; yield [generateFloor(s * 7919 + ch * 131 + fl, ch, fl, { rootsAvailable: roots, pocket: s % 2 === 0 }), roots]; }
}
describe('floor map v2 (non-degenerate, readable)', () => {
  it('every floor over 7200 seeds passes validateFloor', () => {
    let n = 0; for (const [f, roots] of floors()) { const v = validateFloor(f, { rootsAvailable: roots }); if (v.length) throw new Error(`ch${f.chapter} f${f.floor} seed ${f.seed}: ${v.join('; ')}`); n++; }
    expect(n).toBe(6 * 3 * SEEDS);
  });
  it('fallback template is itself valid and practically never needed', () => {
    for (const fl of [1, 2, 3]) { const f = generateFloor(1, 2, fl); f.nodes = templateNodes(fl, new Rng(fl)); expect(validateFloor(f, {})).toEqual([]); }
    let used = 0; for (const [f] of floors()) { const tpl = JSON.stringify(templateNodes(f.floor, new Rng(1)).map((n) => [n.type, n.next])); if (JSON.stringify(f.nodes.map((n) => [n.type, n.next])) === tpl) used++; }
    expect(used).toBeLessThan(3);
  });
  it('paths never cross and branch count stays in 2–3 (≥1 per layer)', () => {
    for (const [f] of floors()) {
      let diag = 0; for (let d = 0; d < 2; d++) {
        const links = f.nodes.filter((n) => n.depth === d).flatMap((n) => n.next.map((x) => [n, f.nodes[x]] as [typeof n, typeof n]));
        const dl = links.filter(([a, b]) => a.col !== b.col).length; expect(dl).toBeGreaterThanOrEqual(1); diag += dl;
        for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) expect(linksCross(links[i], links[j])).toBe(false);
      }
      expect(diag).toBeGreaterThanOrEqual(DIAG_MIN); expect(diag).toBeLessThanOrEqual(DIAG_MAX);
      const p = allPaths(f).length; expect(p).toBeGreaterThanOrEqual(5); expect(p).toBeLessThanOrEqual(8);
    }
  });
  it('choices offered together are different room types; linked rooms never repeat a type', () => {
    for (const [f] of floors()) {
      const d0 = f.nodes.filter((n) => n.depth === 0).map((n) => n.type); expect(new Set(d0).size).toBe(3);
      for (const n of f.nodes) { if (n.next.length > 1) expect(new Set(n.next.map((x) => f.nodes[x].type)).size).toBe(n.next.length); for (const x of n.next) expect(f.nodes[x].type).not.toBe(n.type); }
    }
  });
  it('a sustain room (shop/heart) is always on some path past the first row; boss floors have one right before the boss', () => {
    for (const [f] of floors()) {
      const paths = allPaths(f); expect(paths.some((p) => p.some((i) => SUSTAIN.includes(f.nodes[i].type) && f.nodes[i].depth >= 1))).toBe(true);
      if (f.floor === 3) expect(f.nodes.some((n) => n.depth === 2 && SUSTAIN.includes(n.type))).toBe(true);
      expect(f.nodes.filter((n) => n.type === 'shop').length).toBeLessThanOrEqual(1);
    }
  });
  it('elites: 0–2, guard high-value rewards, never chained, a safe path always exists, none in the very first row of the run', () => {
    const hist = [0, 0, 0];
    for (const [f] of floors()) {
      const el = f.nodes.filter((n) => n.modifier === 'miniboss'); expect(el.length).toBeLessThanOrEqual(ELITE_MAX); hist[el.length]++;
      for (const e of el) { expect(HIGH_VALUE).toContain(e.type); for (const x of e.next) expect(f.nodes[x].modifier).not.toBe('miniboss'); }
      if (el.length) { const paths = allPaths(f); expect(paths.some((p) => p.every((i) => f.nodes[i].modifier !== 'miniboss'))).toBe(true); expect(paths.some((p) => p.some((i) => f.nodes[i].modifier === 'miniboss'))).toBe(true); }
      if (f.globalFloor === 1) expect(el.some((e) => e.depth === 0)).toBe(false);
    }
    expect(hist[0]).toBeGreaterThan(0); expect(hist[1]).toBeGreaterThan(0); expect(hist[2]).toBeGreaterThan(0);
  });
  it('deterministic per seed', () => { for (let s = 1; s < 50; s++) expect(generateFloor(s, 3, 2, { rootsAvailable: true })).toEqual(generateFloor(s, 3, 2, { rootsAvailable: true })); });
  it('boss foreshadow names the gate boss and the chapter boss', () => {
    const a = bossForeshadow(generateFloor(1, 2, 1)), b = bossForeshadow(generateFloor(1, 2, 3));
    expect(a.gate).toBe('gate'); expect(a.floorsToBoss).toBe(2); expect(a.chapterBossId).toBe(b.gateBossId); expect(b.gate).toBe('boss'); expect(b.floorsToBoss).toBe(0);
  });
  it('mapView: current / cleared / reachable / ahead / skipped and the path walked', () => {
    const f = generateFloor(11, 1, 2);
    const v0 = mapView(f, 'start', [], true); expect(v0.start).toBe('current'); expect([0, 1, 2].every((i) => v0.nodes[i] === 'reachable')).toBe(true); expect(v0.gate).toBe('ahead');
    for (const n of f.nodes) if (n.depth > 0) expect(v0.nodes[n.id]).toBe('ahead');
    const a = 0, b = f.nodes[0].next[f.nodes[0].next.length - 1];
    const v1 = mapView(f, b, [a, b], false);
    expect(v1.nodes[a]).toBe('cleared'); expect(v1.nodes[b]).toBe('current'); expect(v1.currentCleared).toBe(false);
    for (const x of f.nodes[b].next) expect(v1.nodes[x]).toBe('reachable');
    expect(v1.nodes[1]).toBe('skipped'); expect(v1.nodes[2]).toBe('skipped');
    expect(v1.path).toEqual([['start', a], [a, b]]);
    const c = f.nodes[b].next[0]; const v2 = mapView(f, c, [a, b, c], true); expect(v2.gate).toBe('reachable'); expect(v2.nextIds).toEqual(['gate']);
    const v3 = mapView(f, 'gate', [a, b, c], false); expect(v3.gate).toBe('current'); expect(v3.path[v3.path.length - 1]).toEqual([c, 'gate']);
  });
});
