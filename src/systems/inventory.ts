// Grid inventory: polyomino artifacts + tablets, rotation, constraints, tablet ops, levels, combos.
// Framework-free (SPEC §4).
import type { ArtifactDef, TabletDef, Shape, ComboId, Effect, TabletOp } from '../data/types';
import { getArtifact, getTablet, getCombo, combos as COMBOS } from './registry';

export interface Placed { uid: number; id: string; kind: 'artifact' | 'tablet'; x: number; y: number; rot: number; level: number }
export interface Grid { cols: number; rows: number; items: Placed[]; side: (Placed | null)[]; sideUnlocked: boolean; nextUid: number }

export const MAX_COLS = 7, MAX_ROWS = 5, SIDE_CELLS = 4;
export function newGrid(cols = 5, rows = 4, sideUnlocked = false): Grid {
  return { cols: Math.min(MAX_COLS, cols), rows: Math.min(MAX_ROWS, rows), items: [], side: new Array(SIDE_CELLS).fill(null), sideUnlocked, nextUid: 1 };
}
export function resizeGrid(g: Grid, cols: number, rows: number) { g.cols = Math.min(MAX_COLS, Math.max(g.cols, cols)); g.rows = Math.min(MAX_ROWS, Math.max(g.rows, rows)); }

const norm = (r: number) => ((r % 4) + 4) % 4;
/** rotate a cell 90° clockwise `rot` times */
export function rotCell([x, y]: [number, number], rot: number): [number, number] {
  let a = x, b = y;
  for (let i = 0; i < norm(rot); i++) { const t = a; a = -b; b = t; }
  return [a + 0, b + 0];
}
/** Returns rotated shape normalised to min (0,0) plus the offset used (to apply to tablet targets). */
export function rotateShape(shape: Shape, rot: number): { cells: Array<[number, number]>; off: [number, number] } {
  const r = shape.map((c) => rotCell(c, rot));
  const mx = Math.min(...r.map((c) => c[0])), my = Math.min(...r.map((c) => c[1]));
  return { cells: r.map(([a, b]) => [a - mx, b - my] as [number, number]), off: [-mx, -my] };
}
export function defOf(id: string): ArtifactDef | TabletDef | undefined { return getArtifact(id) ?? getTablet(id); }
export function kindOf(id: string): 'artifact' | 'tablet' | undefined { return getArtifact(id) ? 'artifact' : getTablet(id) ? 'tablet' : undefined; }
export function shapeOf(id: string): Shape { return defOf(id)?.shape ?? [[0, 0]]; }
export function cellsAt(id: string, x: number, y: number, rot: number): Array<[number, number]> {
  return rotateShape(shapeOf(id), rot).cells.map(([a, b]) => [a + x, b + y]);
}
export const cellsOf = (p: Placed) => cellsAt(p.id, p.x, p.y, p.rot);
/** absolute target cells of a tablet */
export function tabletTargets(p: Placed): Array<{ cell: [number, number]; opp: [number, number]; op: TabletOp }> {
  const t = getTablet(p.id); if (!t) return [];
  const { off } = rotateShape(t.shape, p.rot);
  return t.targets.map((tg) => {
    const r = rotCell(tg.at, p.rot); const o = rotCell([-tg.at[0], -tg.at[1]], p.rot);
    return { cell: [r[0] + off[0] + p.x, r[1] + off[1] + p.y] as [number, number], opp: [o[0] + off[0] + p.x, o[1] + off[1] + p.y] as [number, number], op: tg.op };
  });
}
export function occupancy(g: Grid, ignoreUid?: number): Map<string, Placed> {
  const m = new Map<string, Placed>();
  for (const it of g.items) if (it.uid !== ignoreUid) for (const [x, y] of cellsOf(it)) m.set(`${x},${y}`, it);
  return m;
}
export function itemAt(g: Grid, x: number, y: number): Placed | undefined { return occupancy(g).get(`${x},${y}`); }
export function canPlace(g: Grid, id: string, x: number, y: number, rot: number, ignoreUid?: number): boolean {
  if (!defOf(id)) return false;
  const occ = occupancy(g, ignoreUid);
  return cellsAt(id, x, y, rot).every(([cx, cy]) => cx >= 0 && cy >= 0 && cx < g.cols && cy < g.rows && !occ.has(`${cx},${cy}`));
}
export function place(g: Grid, id: string, x: number, y: number, rot = 0, level = 0): Placed | null {
  if (!canPlace(g, id, x, y, rot)) return null;
  const p: Placed = { uid: g.nextUid++, id, kind: kindOf(id)!, x, y, rot: norm(rot), level };
  g.items.push(p); return p;
}
export function move(g: Grid, uid: number, x: number, y: number, rot: number): boolean {
  const p = g.items.find((i) => i.uid === uid); if (!p) return false;
  if (!canPlace(g, p.id, x, y, rot, uid)) return false;
  p.x = x; p.y = y; p.rot = norm(rot); return true;
}
export function remove(g: Grid, uid: number): Placed | null {
  const i = g.items.findIndex((p) => p.uid === uid); if (i < 0) return null;
  return g.items.splice(i, 1)[0];
}
/** Auto-place: first fitting spot/rotation; returns placed or null */
export function autoPlace(g: Grid, id: string, level = 0): Placed | null {
  for (let rot = 0; rot < 4; rot++) for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) if (canPlace(g, id, x, y, rot)) return place(g, id, x, y, rot, level);
  return null;
}
export function addToSide(g: Grid, id: string, level = 0): Placed | null {
  if (!g.sideUnlocked) return null;
  const i = g.side.findIndex((s) => !s); if (i < 0) return null;
  const p: Placed = { uid: g.nextUid++, id, kind: kindOf(id)!, x: i, y: 0, rot: 0, level };
  g.side[i] = p; return p;
}
export function takeFromSide(g: Grid, idx: number): Placed | null { const p = g.side[idx]; g.side[idx] = null; return p ?? null; }
/** Add an item anywhere (bag first, then side bag). */
export function addItem(g: Grid, id: string, level = 0): Placed | null { return autoPlace(g, id, level) ?? addToSide(g, id, level); }

// ---------------- resolution ----------------
export interface ArtState {
  uid: number; id: string; baseLevel: number; level: number; maxLevel: number; effLevel: number;
  disabled: boolean; constraintOk: boolean; ignoreConstraint: boolean; tagMult: number; copies: string[]; active: boolean;
  tabletHits: Array<{ tablet: number; op: TabletOp }>;
}
export interface Resolution { arts: Map<number, ArtState>; comboCounts: Record<string, number>; activeCombos: Array<{ id: ComboId; tier: number; count: number }>; tabletTargets: Map<number, Array<[number, number]>> }

function checkConstraint(g: Grid, p: Placed, def: ArtifactDef, occ: Map<string, Placed>): boolean {
  const c = def.constraint; if (!c) return true;
  const cells = cellsOf(p);
  switch (c.kind) {
    case 'touchEdge': return cells.some(([x, y]) => (c.edge === 'left' && x === 0) || (c.edge === 'right' && x === g.cols - 1) || (c.edge === 'top' && y === 0) || (c.edge === 'bottom' && y === g.rows - 1));
    case 'cornerOnly': return cells.some(([x, y]) => (x === 0 || x === g.cols - 1) && (y === 0 || y === g.rows - 1));
    case 'emptyNeighbor': {
      const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[c.dir];
      return cells.every(([x, y]) => { const o = occ.get(`${x + d[0]},${y + d[1]}`); return !o || o.uid === p.uid; });
    }
    case 'noOtherOfTag': return !g.items.some((o) => o.uid !== p.uid && o.kind === 'artifact' && (getArtifact(o.id)?.tags ?? []).includes(c.tag));
  }
  return true;
}

export function resolve(g: Grid): Resolution {
  const occ = occupancy(g);
  const arts = new Map<number, ArtState>();
  for (const p of g.items) if (p.kind === 'artifact') {
    const d = getArtifact(p.id)!;
    arts.set(p.uid, { uid: p.uid, id: p.id, baseLevel: p.level, level: p.level, maxLevel: d.maxLevel, effLevel: 0, disabled: false, constraintOk: true, ignoreConstraint: false, tagMult: 1, copies: [], active: true, tabletHits: [] });
  }
  const tt = new Map<number, Array<[number, number]>>();
  for (const t of g.items) if (t.kind === 'tablet') {
    const seen = new Set<string>(); const cells: Array<[number, number]> = [];
    for (const { cell, opp, op } of tabletTargets(t)) {
      cells.push(cell);
      const target = occ.get(`${cell[0]},${cell[1]}`);
      if (!target || target.kind !== 'artifact') continue; // tablets don't affect tablets
      const key = `${target.uid}:${JSON.stringify(op)}`; if (seen.has(key)) continue; seen.add(key);
      const st = arts.get(target.uid)!; st.tabletHits.push({ tablet: t.uid, op });
      switch (op.op) {
        case 'level': st.level += op.amount; break;
        case 'maxLevel': st.maxLevel += op.amount; break;
        case 'ignoreConstraint': st.ignoreConstraint = true; break;
        case 'doubleTags': st.tagMult = 2; break;
        case 'copy': { const src = occ.get(`${opp[0]},${opp[1]}`); if (src && src.kind === 'artifact' && src.uid !== target.uid) st.copies.push(src.id); break; }
      }
    }
    tt.set(t.uid, cells);
  }
  for (const p of g.items) if (p.kind === 'artifact') {
    const st = arts.get(p.uid)!; const d = getArtifact(p.id)!;
    st.disabled = st.level <= -1;
    st.effLevel = Math.max(0, Math.min(st.level, st.maxLevel));
    st.constraintOk = checkConstraint(g, p, d, occ);
    st.active = !st.disabled && (st.constraintOk || st.ignoreConstraint);
  }
  const comboCounts: Record<string, number> = {};
  for (const st of arts.values()) if (st.active) for (const tag of getArtifact(st.id)!.tags) comboCounts[tag] = (comboCounts[tag] ?? 0) + st.tagMult;
  const activeCombos: Resolution['activeCombos'] = [];
  for (const c of COMBOS) {
    const n = comboCounts[c.id] ?? 0; let tier = 0;
    c.tiers.forEach((t, i) => { if (n >= t.count) tier = i + 1; });
    if (tier > 0) activeCombos.push({ id: c.id, tier, count: n });
  }
  return { arts, comboCounts, activeCombos, tabletTargets: tt };
}

/** Effects contributed by the grid: each active artifact's effects (+copies) at its level, plus combo tiers. */
export interface EffectInstance { effect: Effect; level: number; source: string }
export function gridEffects(g: Grid, res = resolve(g)): EffectInstance[] {
  const out: EffectInstance[] = [];
  for (const st of res.arts.values()) {
    if (!st.active) continue;
    for (const e of getArtifact(st.id)!.effects) out.push({ effect: e, level: st.effLevel, source: st.id });
    for (const cid of st.copies) for (const e of getArtifact(cid)?.effects ?? []) out.push({ effect: e, level: st.effLevel, source: `${st.id}<${cid}` });
  }
  for (const ac of res.activeCombos) { const c = getCombo(ac.id)!; for (const e of c.tiers[ac.tier - 1].effects) out.push({ effect: e, level: 0, source: `combo:${ac.id}` }); }
  return out;
}

/** Drag preview: validity, cells with ok flags, and artifacts whose level/active state would change. */
export function preview(g: Grid, id: string, x: number, y: number, rot: number, movingUid?: number) {
  const cells = cellsAt(id, x, y, rot);
  const occ = occupancy(g, movingUid);
  const marks = cells.map(([cx, cy]) => ({ x: cx, y: cy, ok: cx >= 0 && cy >= 0 && cx < g.cols && cy < g.rows && !occ.has(`${cx},${cy}`) }));
  const valid = marks.every((m) => m.ok);
  const before = resolve(g);
  let changes: Array<{ uid: number; dLevel: number; nowActive: boolean; wasActive: boolean }> = [];
  let targets: Array<[number, number]> = [];
  if (valid) {
    const clone: Grid = { ...g, items: g.items.filter((i) => i.uid !== movingUid).map((i) => ({ ...i })), side: [...g.side] };
    const p = place(clone, id, x, y, rot);
    if (p) {
      const after = resolve(clone);
      for (const [uid, a] of after.arts) { const b = before.arts.get(uid); if (b && (b.level !== a.level || b.active !== a.active)) changes.push({ uid, dLevel: a.level - b.level, nowActive: a.active, wasActive: b.active }); }
      if (p.kind === 'tablet') targets = tabletTargets(p).map((t) => t.cell);
    }
  }
  return { valid, marks, changes, targets };
}

export function listItems(g: Grid): Placed[] { return [...g.items, ...(g.side.filter(Boolean) as Placed[])]; }
export function cloneGrid(g: Grid): Grid { return JSON.parse(JSON.stringify(g)); }
