import { describe, it, expect } from 'vitest';
import { art, tab } from './helpers';
import { newGrid, place, canPlace, remove, move, rotateShape, cellsAt, resolve, gridEffects, preview, addItem, addToSide, resizeGrid, MAX_COLS, MAX_ROWS, itemAt } from '../src/systems/inventory';
import { getCombo } from '../src/systems/registry';

const A1 = art('t_a1');
const L3 = art('t_L', { shape: [[0, 0], [0, 1], [1, 1]] });
const SQ = art('t_sq', { shape: [[0, 0], [1, 0], [0, 1], [1, 1]] });
const UP = tab('t_up_r', [{ at: [1, 0], op: { op: 'level', amount: 1 } }]);
const UP2 = tab('t_up2_r', [{ at: [1, 0], op: { op: 'level', amount: 2 } }]);
const DN = tab('t_dn_r', [{ at: [1, 0], op: { op: 'level', amount: -1 } }]);
const DN2 = tab('t_dn2_r', [{ at: [1, 0], op: { op: 'level', amount: -2 } }]);
const FREE = tab('t_free_r', [{ at: [1, 0], op: { op: 'ignoreConstraint' } }]);
const MAX = tab('t_max_r', [{ at: [1, 0], op: { op: 'maxLevel', amount: 2 } }, { at: [1, 0], op: { op: 'level', amount: 5 } }]);
const DBL = tab('t_dbl_r', [{ at: [1, 0], op: { op: 'doubleTags' } }]);
const COPY = tab('t_copy_r', [{ at: [1, 0], op: { op: 'copy' } }]);
const LONG = tab('t_long', [{ at: [2, 0], op: { op: 'level', amount: 1 } }], [[0, 0], [1, 0]]);

describe('grid basics (C035-C038)', () => {
  it('starts 5x4 and expands to max 7x5', () => {
    const g = newGrid(); expect(g.cols).toBe(5); expect(g.rows).toBe(4);
    resizeGrid(g, 9, 9); expect(g.cols).toBe(MAX_COLS); expect(g.rows).toBe(MAX_ROWS);
  });
  it('places without overlap and in bounds', () => {
    const g = newGrid();
    expect(place(g, SQ, 0, 0)).toBeTruthy();
    expect(canPlace(g, A1, 1, 1, 0)).toBe(false);
    expect(canPlace(g, A1, 2, 0, 0)).toBe(true);
    expect(canPlace(g, SQ, 4, 0, 0)).toBe(false);
    expect(canPlace(g, A1, -1, 0, 0)).toBe(false);
  });
  it('remove and move', () => {
    const g = newGrid(); const p = place(g, A1, 0, 0)!;
    expect(move(g, p.uid, 3, 3, 0)).toBe(true); expect(itemAt(g, 3, 3)?.uid).toBe(p.uid);
    expect(remove(g, p.uid)).toBeTruthy(); expect(g.items.length).toBe(0);
  });
  it('rotation gives 4 orientations normalized at origin', () => {
    const shapes = [0, 1, 2, 3].map((r) => JSON.stringify(rotateShape([[0, 0], [0, 1], [1, 1]], r).cells.sort()));
    expect(new Set(shapes).size).toBe(4);
    for (let r = 0; r < 4; r++) { const c = rotateShape([[0, 0], [1, 0], [2, 0]], r).cells; expect(Math.min(...c.map((x) => x[0]))).toBe(0); expect(Math.min(...c.map((x) => x[1]))).toBe(0); }
    expect(cellsAt(L3, 0, 0, 1).length).toBe(3);
  });
  it('rotated L fits where unrotated does not', () => {
    const g = newGrid(3, 2);
    expect(canPlace(g, art('t_bar3', { shape: [[0, 0], [0, 1], [0, 2]] }), 0, 0, 0)).toBe(false);
    expect(canPlace(g, 't_bar3', 0, 0, 1)).toBe(true);
  });
  it('side bag: 4 cells, inactive', () => {
    const g = newGrid(5, 4, true);
    for (let i = 0; i < 4; i++) expect(addToSide(g, A1)).toBeTruthy();
    expect(addToSide(g, A1)).toBeNull();
    expect(gridEffects(g).length).toBe(0);
    const g2 = newGrid(5, 4, false); expect(addToSide(g2, A1)).toBeNull();
  });
  it('addItem falls back to side bag when bag full', () => {
    const g = newGrid(1, 1, true); expect(addItem(g, A1)!.kind).toBe('artifact'); const p = addItem(g, A1)!; expect(g.side[0]?.uid).toBe(p.uid);
  });
});

describe('levels and tablets (C039, C045-C052)', () => {
  it('artifact level starts 0 and effect scales per level', () => {
    const g = newGrid(); place(g, A1, 1, 0); place(g, UP, 0, 0);
    const st = [...resolve(g).arts.values()][0]; expect(st.baseLevel).toBe(0); expect(st.effLevel).toBe(1);
    expect(gridEffects(g)[0].level).toBe(1);
  });
  it('+2 tablet', () => { const g = newGrid(); place(g, A1, 1, 0); place(g, UP2, 0, 0); expect([...resolve(g).arts.values()][0].level).toBe(2); });
  it('level capped by maxLevel for effect', () => {
    const g = newGrid(); place(g, art('t_m1', { maxLevel: 1 }), 1, 0); place(g, UP2, 0, 0);
    const st = [...resolve(g).arts.values()][0]; expect(st.level).toBe(2); expect(st.effLevel).toBe(1);
  });
  it('-1 level disables (level <= -1)', () => {
    const g = newGrid(); place(g, A1, 1, 0); place(g, DN, 0, 0);
    const st = [...resolve(g).arts.values()][0]; expect(st.disabled).toBe(true); expect(st.active).toBe(false);
    expect(gridEffects(g).length).toBe(0);
  });
  it('-1 on a level-1 artifact keeps it active at 0', () => {
    const g = newGrid(); place(g, A1, 1, 0, 0, 1); place(g, DN, 0, 0);
    expect([...resolve(g).arts.values()][0].active).toBe(true);
  });
  it('-2 with +1 still disabled', () => {
    const g = newGrid(); place(g, A1, 1, 0); place(g, DN2, 0, 0); place(g, tab('t_up_l', [{ at: [-1, 0], op: { op: 'level', amount: 1 } }]), 2, 0);
    expect([...resolve(g).arts.values()][0].disabled).toBe(true);
  });
  it('tablet rotation rotates targets', () => {
    const g = newGrid(); place(g, A1, 0, 1); place(g, UP, 0, 0, 1); // rot 1: right → down
    expect([...resolve(g).arts.values()][0].level).toBe(1);
    const g2 = newGrid(); place(g2, A1, 1, 0); place(g2, UP, 0, 0, 1);
    expect([...resolve(g2).arts.values()][0].level).toBe(0);
  });
  it('tablet rot 2 points left', () => { const g = newGrid(); place(g, A1, 0, 0); place(g, UP, 1, 0, 2); expect([...resolve(g).arts.values()][0].level).toBe(1); });
  it('2-cell tablet targets beyond its body, rotated too', () => {
    const g = newGrid(); place(g, A1, 2, 0); place(g, LONG, 0, 0); expect([...resolve(g).arts.values()][0].level).toBe(1);
    const g2 = newGrid(); place(g2, A1, 0, 2); place(g2, LONG, 0, 0, 1); expect([...resolve(g2).arts.values()][0].level).toBe(1);
  });
  it('tablets do not affect tablets', () => {
    const g = newGrid(); place(g, UP, 0, 0); place(g, UP, 1, 0); place(g, A1, 2, 0);
    expect([...resolve(g).arts.values()][0].level).toBe(1);
  });
  it('multi-cell artifact receives one tablet once', () => {
    const g = newGrid(); place(g, SQ, 1, 0); place(g, tab('t_both', [{ at: [1, 0], op: { op: 'level', amount: 1 } }, { at: [1, 1], op: { op: 'level', amount: 1 } }]), 0, 0);
    expect([...resolve(g).arts.values()][0].level).toBe(1);
  });
  it('maxLevel op raises cap', () => { const g = newGrid(); place(g, art('t_m2', { maxLevel: 2 }), 1, 0); place(g, MAX, 0, 0); const st = [...resolve(g).arts.values()][0]; expect(st.maxLevel).toBe(4); expect(st.effLevel).toBe(4); });
  it('doubleTags doubles combo count', () => {
    const g = newGrid(); place(g, art('t_ember1', { tags: ['ember'] }), 1, 0); place(g, DBL, 0, 0);
    expect(resolve(g).comboCounts.ember).toBe(2);
  });
  it('copy op copies effects of opposite artifact', () => {
    const src = art('t_src', { effects: [{ kind: 'stat', stat: 'fire', base: 7, perLevel: 0 }] });
    const g = newGrid(); place(g, src, 0, 0); place(g, COPY, 1, 0); place(g, A1, 2, 0);
    const fx = gridEffects(g); expect(fx.filter((f) => (f.effect as any).stat === 'fire').length).toBe(2);
  });
});

describe('constraints (C040-C043, C047)', () => {
  it('touchEdge', () => {
    const id = art('t_left', { constraint: { kind: 'touchEdge', edge: 'left' } });
    const g = newGrid(); place(g, id, 0, 1); expect([...resolve(g).arts.values()][0].active).toBe(true);
    const g2 = newGrid(); place(g2, id, 2, 1); expect([...resolve(g2).arts.values()][0].active).toBe(false);
    const idb = art('t_bot', { constraint: { kind: 'touchEdge', edge: 'bottom' } });
    const g3 = newGrid(); place(g3, idb, 2, 3); expect([...resolve(g3).arts.values()][0].active).toBe(true);
  });
  it('emptyNeighbor', () => {
    const id = art('t_er', { constraint: { kind: 'emptyNeighbor', dir: 'right' } });
    const g = newGrid(); const p = place(g, id, 1, 1)!; expect(resolve(g).arts.get(p.uid)!.active).toBe(true);
    place(g, A1, 2, 1); expect(resolve(g).arts.get(p.uid)!.active).toBe(false);
  });
  it('cornerOnly', () => {
    const id = art('t_corner', { constraint: { kind: 'cornerOnly' } });
    const g = newGrid(); const p = place(g, id, 4, 3)!; expect(resolve(g).arts.get(p.uid)!.active).toBe(true);
    const g2 = newGrid(); const q = place(g2, id, 2, 2)!; expect(resolve(g2).arts.get(q.uid)!.active).toBe(false);
  });
  it('noOtherOfTag', () => {
    const id = art('t_lone', { constraint: { kind: 'noOtherOfTag', tag: 'shadow' } });
    const g = newGrid(); const p = place(g, id, 0, 0)!; expect(resolve(g).arts.get(p.uid)!.active).toBe(true);
    place(g, art('t_sh', { tags: ['shadow'] }), 3, 3); expect(resolve(g).arts.get(p.uid)!.active).toBe(false);
  });
  it('ignoreConstraint tablet', () => {
    const id = art('t_left2', { constraint: { kind: 'touchEdge', edge: 'left' } });
    const g = newGrid(); const p = place(g, id, 3, 1)!; place(g, FREE, 2, 1);
    expect(resolve(g).arts.get(p.uid)!.active).toBe(true); expect(resolve(g).arts.get(p.uid)!.constraintOk).toBe(false);
  });
});

describe('combos (C054)', () => {
  it('thresholds count ACTIVE artifacts only', () => {
    const c = getCombo('ember')!; const need = c.tiers[0].count;
    const g = newGrid(7, 5);
    const ids = Array.from({ length: need }, (_, i) => art(`t_emb${i}`, { tags: ['ember'] }));
    ids.forEach((id, i) => place(g, id, i % 7, 1 + Math.floor(i / 7) * 2));
    let r = resolve(g); expect(r.activeCombos.find((x) => x.id === 'ember')?.tier).toBe(1);
    place(g, DN, 0, 0); // disables nothing (targets (1,0) empty)
    // disable one ember artifact via a -1 tablet at its left
    const g2 = newGrid(7, 5); ids.forEach((id, i) => place(g2, id, 1 + (i % 6), 1 + Math.floor(i / 6) * 2)); place(g2, DN, 0, 1);
    r = resolve(g2); expect((r.comboCounts.ember ?? 0)).toBe(need - 1);
  });
  it('higher tiers', () => {
    const c = getCombo('glacier')!; const top = c.tiers[c.tiers.length - 1].count;
    const g = newGrid(7, 5); for (let i = 0; i < top; i++) place(g, art(`t_gl${i}`, { tags: ['glacier'] }), i % 7, Math.floor(i / 7));
    expect(resolve(g).activeCombos.find((x) => x.id === 'glacier')?.tier).toBe(c.tiers.length);
    expect(gridEffects(g).some((e) => e.source === 'combo:glacier')).toBe(true);
  });
});

describe('preview (C053)', () => {
  it('reports invalid cells and level changes', () => {
    const g = newGrid(); place(g, A1, 1, 0);
    const pv = preview(g, UP, 0, 0, 0); expect(pv.valid).toBe(true); expect(pv.changes[0].dLevel).toBe(1); expect(pv.targets[0]).toEqual([1, 0]);
    const bad = preview(g, SQ, 0, 0, 0); expect(bad.valid).toBe(false); expect(bad.marks.some((m) => !m.ok)).toBe(true);
  });
});
