// V2 build/decision helpers: run power, best placement of a new item, and the concrete numeric delta a choice card /
// shop item would make to the current build (stats, combos, power). Framework-free.
import type { StatKey, ComboId } from '../data/types';
import { cloneGrid, canPlace, place, resolve, addToSide, type Grid, type Placed, comboProgress, type PreviewCombo } from './inventory';
import { runStats, runBundle, cloneRun, type RunState, STAT_VN } from './run';
import { estimatePower, type Power } from './power';
import { buildWeapon } from './weapons';
import type { MetaState } from './meta';
import type { Stats } from './stats';
import { getArtifact, getTablet } from './registry';

export function runPower(run: RunState, meta: MetaState): Power {
  const b = runBundle(run); const s = runStats(run, meta, undefined, b);
  return estimatePower(s, b, buildWeapon(run.weapon, run.upgrades), undefined, run.level);
}
const comboScore = (g: Grid) => resolve(g).activeCombos.reduce((a, c) => a + c.tier, 0);

/**
 * Best spot for a new item in the bag: maximises run power (ties → more combo tiers → top-left). Tablets are only
 * tried next to artifacts (a tablet touching nothing is worth nothing). Returns null when nothing fits.
 */
export function bestPlacement(run: RunState, meta: MetaState, id: string, level = 0): { x: number; y: number; rot: number; score: number } | null {
  const g = run.grid; const isTab = !!getTablet(id);
  const near = new Set<string>();
  if (isTab) for (const p of g.items) if (p.kind === 'artifact') for (const c of placedCells(p)) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) near.add(`${c[0] + dx},${c[1] + dy}`);
  let best: { x: number; y: number; rot: number; score: number; combos: number } | null = null;
  const rots = (getArtifact(id) ?? getTablet(id))?.shape.length === 1 && !isTab ? [0] : [0, 1, 2, 3];
  const seen = new Set<string>();
  for (const rot of rots) for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    if (!canPlace(g, id, x, y, rot)) continue;
    if (isTab && near.size && !near.has(`${x},${y}`)) continue;
    const c: RunState = { ...run, grid: { ...g, items: g.items.map((i) => ({ ...i })), side: [...g.side] } }; const p = place(c.grid, id, x, y, rot, level)!;
    const key = JSON.stringify(placedCells(p).sort()) + (isTab ? rot : ''); if (!isTab && seen.has(key) && !getArtifact(id)?.constraint) continue; seen.add(key);
    const score = runPower(c, meta).score; const combos = comboScore(c.grid);
    if (!best || score > best.score + 1e-6 || (Math.abs(score - best.score) <= 1e-6 && combos > best.combos)) best = { x, y, rot, score, combos };
  }
  return best && { x: best.x, y: best.y, rot: best.rot, score: best.score };
}
function placedCells(p: Placed): Array<[number, number]> {
  const def = getArtifact(p.id) ?? getTablet(p.id); if (!def) return [[p.x, p.y]];
  // local rotate (avoid importing cellsOf to keep this module light on side effects)
  const r = def.shape.map(([a, b]) => { let x = a, y = b; for (let i = 0; i < p.rot; i++) { const t = x; x = -y; y = t; } return [x, y] as [number, number]; });
  const mx = Math.min(...r.map((c) => c[0])), my = Math.min(...r.map((c) => c[1]));
  return r.map(([a, b]) => [a - mx + p.x, b - my + p.y]);
}
/** Put an item where it helps most (fallback: side bag). */
export function addBest(run: RunState, meta: MetaState, id: string, level = 0): Placed | null {
  const b = bestPlacement(run, meta, id, level);
  if (b) return place(run.grid, id, b.x, b.y, b.rot, level);
  return addToSide(run.grid, id, level);
}

// ---------------- choice / shop deltas ----------------
export interface StatDelta { stat: StatKey; before: number; after: number; text: string }
export interface ChoiceDelta { stats: StatDelta[]; combos: PreviewCombo[]; power: { before: number; after: number; pct: number; dps: number; ehp: number }; placed: 'bag' | 'side' | 'none' | 'n/a'; lines: string[] }
const PCT_STATS = new Set<StatKey>(['defense', 'evasion', 'critChance', 'critDamage', 'attackSpeed', 'moveSpeed', 'dashRecovery', 'lifesteal', 'damagePct', 'cooldownPct']);
const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
export function statDeltas(a: Stats, b: Stats): StatDelta[] {
  const out: StatDelta[] = [];
  for (const k of Object.keys(STAT_VN) as StatKey[]) {
    const d = b[k] - a[k]; if (Math.abs(d) < 0.05) continue;
    const u = PCT_STATS.has(k) ? '%' : '';
    out.push({ stat: k, before: a[k], after: b[k], text: `${STAT_VN[k]} ${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}${u} (${fmt(a[k])}→${fmt(b[k])}${u})` });
  }
  return out;
}
/**
 * Concrete effect of taking option `id` of `kind` on the current build: stat changes, combo progress and power
 * (DPS × effective HP heuristic). Artifacts / tablets are evaluated at the spot `takeChoice` would put them.
 */
export function choiceDelta(run: RunState, meta: MetaState, kind: 'artifact' | 'tablet' | 'miracle' | 'upgrade', id: string): ChoiceDelta {
  const p0 = runPower(run, meta); const s0 = runStats(run, meta); const r0 = resolve(run.grid);
  const c = cloneRun(run); let placed: ChoiceDelta['placed'] = 'n/a';
  if (kind === 'artifact' || kind === 'tablet') { const b = bestPlacement(c, meta, id); if (b) { place(c.grid, id, b.x, b.y, b.rot); placed = 'bag'; } else placed = addToSide(c.grid, id) ? 'side' : 'none'; }
  else if (kind === 'miracle') c.miracles.push(id);
  else c.upgrades.push(id);
  const p1 = runPower(c, meta); const s1 = runStats(c, meta); const r1 = resolve(c.grid);
  const stats = statDeltas(s0, s1);
  const combos: PreviewCombo[] = [];
  const tags = new Set<string>([...Object.keys(r0.comboCounts), ...Object.keys(r1.comboCounts)]);
  const own = (getArtifact(id)?.tags ?? []) as string[];
  for (const t of tags) {
    const nb = r0.comboCounts[t] ?? 0, na = r1.comboCounts[t] ?? 0; if (nb === na && !own.includes(t)) continue;
    const pa = comboProgress(t as ComboId, na);
    combos.push({ id: t as ComboId, before: nb, after: na, thresholds: pa.thresholds, tierBefore: comboProgress(t as ComboId, nb).tier, tierAfter: pa.tier, next: pa.next });
  }
  const pct = p0.score > 0 ? (p1.score / p0.score - 1) * 100 : 0;
  const lines: string[] = [];
  lines.push(`Sức mạnh ${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)}%  (ST/giây ${fmtPct(p0.dps, p1.dps)}, máu hiệu dụng ${fmtPct(p0.ehp, p1.ehp)})`);
  for (const sd of stats.slice(0, 4)) lines.push(sd.text);
  if (placed === 'side') lines.push('Túi đầy: vào Túi Phụ (chưa có tác dụng)');
  if (placed === 'none') lines.push('Túi đầy!');
  return { stats, combos, power: { before: p0.score, after: p1.score, pct, dps: p1.dps - p0.dps, ehp: p1.ehp - p0.ehp }, placed, lines };
}
const fmtPct = (a: number, b: number) => { const d = a > 0 ? (b / a - 1) * 100 : 0; return `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(0)}%`; };
export { cloneGrid };
