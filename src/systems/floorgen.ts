// Floor generator (SPEC §5): start room, 3-column × 3-deep node map with branching, node types/modifiers,
// random events, gate/boss room; plus combat wave planning. Framework-free.
//
// v2 map pass (docs/V2_MAP.md): the map is built constructively and then validated (validateFloor), retrying with the
// same seeded stream until every structural rule holds; a fixed template is the last resort, so no seed can produce a
// degenerate map. Rules: straight lane links always; 2–3 diagonal branches per floor (≥1 per layer); at most one
// diagonal per column gap per layer, so paths never cross; choices offered together are always different room types
// and linked rooms never repeat a type; ≥1 sustain room (shop/heart) at depth ≥1 (boss floors: on the pre-boss row);
// 0–2 elites (mini-boss modifier) that guard a high-value reward, never chained, never on every lane (a safe path exists).
import type { NodeType, NodeModifier, EventId, EnemyDef } from '../data/types';
import { planEncounter, type Affix } from './director';
import { Rng } from './rng';
import { getChapter, getEnemy } from './registry';

export const NODE_TYPES: NodeType[] = ['levelup', 'artifact', 'enchant', 'tablet', 'money', 'heart', 'anvil', 'dice', 'shop', 'roots'];
export const EVENT_IDS: EventId[] = ['arena', 'secret', 'clover', 'merchant', 'obelisk', 'fountain', 'companion', 'blood', 'pocket'];
export const COLS = 3, DEPTH = 3;
export const NODE_WEIGHTS: Record<NodeType, number> = { levelup: 12, artifact: 18, enchant: 8, tablet: 12, money: 9, heart: 6, anvil: 8, dice: 6, shop: 6, roots: 5 };
export const NO_FIGHT: NodeType[] = ['shop', 'roots'];
export const EVENT_CHANCE = 0.13;
/** Rooms that restore or prepare the player ("rest" stops): shop and Green Heart. */
export const SUSTAIN: NodeType[] = ['shop', 'heart'];
/** Rewards worth guarding with an elite (mini-boss modifier): the elite's risk always pays into one of these. */
export const HIGH_VALUE: NodeType[] = ['artifact', 'enchant', 'anvil', 'tablet'];
/** Per-floor caps per room type (variety). */
export const TYPE_CAP: Record<NodeType, number> = { levelup: 2, artifact: 3, enchant: 2, tablet: 2, money: 2, heart: 2, anvil: 2, dice: 1, shop: 1, roots: 1 };
export const DIAG_MIN = 2, DIAG_MAX = 3, ELITE_MAX = 2;
export const DERANGE_CHANCE = 0.15;

export interface MapNode { id: number; col: number; depth: number; type: NodeType; modifier: NodeModifier; event: EventId | null; next: number[]; altarSize?: 1 | 2 | 3 }
export interface Floor { chapter: number; floor: number; globalFloor: number; seed: number; startShop: boolean; nodes: MapNode[]; gate: 'boss' | 'gate'; bossId: string; startEvent: EventId | null }

export const globalFloor = (chapter: number, floor: number) => (chapter - 1) * 3 + floor;
export const isBossFloor = (floor: number) => floor === 3;
export const isFight = (t: NodeType) => !NO_FIGHT.includes(t);

export interface GenOpts { rootsAvailable?: boolean; hard?: boolean; eventChance?: number; pocket?: boolean }

const nid = (d: number, c: number) => d * COLS + c;
/** parents of a node (nodes at depth-1 linking to it) */
export function parentsOf(f: { nodes: MapNode[] }, id: number): number[] { return f.nodes.filter((n) => n.next.includes(id)).map((n) => n.id); }
/** ids offered together with `id` as a choice (depth 0 = all of row 0; else every child of each parent) */
function coChoices(nodes: MapNode[], id: number): number[] {
  const n = nodes[id]; if (n.depth === 0) return nodes.filter((m) => m.depth === 0 && m.id !== id).map((m) => m.id);
  const out = new Set<number>(); for (const p of nodes) if (p.next.includes(id)) for (const x of p.next) if (x !== id) out.add(x);
  return [...out];
}
function neighbours(nodes: MapNode[], id: number): number[] { return [...nodes[id].next, ...nodes.filter((m) => m.next.includes(id)).map((m) => m.id)]; }

/** Every start → gate path as a list of node ids (3 nodes each). */
export function allPaths(f: { nodes: MapNode[] }): number[][] {
  const out: number[][] = []; const walk = (id: number, acc: number[]) => { const n = f.nodes[id]; const a = [...acc, id]; if (n.depth === DEPTH - 1) out.push(a); else for (const x of n.next) walk(x, a); };
  for (const n of f.nodes.filter((x) => x.depth === 0)) walk(n.id, []);
  return out;
}
/** two links between consecutive rows cross when their column order flips */
export function linksCross(a: [MapNode, MapNode], b: [MapNode, MapNode]): boolean { return (a[0].col - b[0].col) * (a[1].col - b[1].col) < 0; }

/** Structural rules every generated floor must satisfy. Returns a list of violations (empty = valid). */
export function validateFloor(f: Floor, opts: GenOpts = {}): string[] {
  const bad: string[] = []; const N = f.nodes;
  if (N.length !== COLS * DEPTH) return ['node count'];
  N.forEach((n, i) => { if (n.id !== i || n.col !== i % COLS || n.depth !== Math.floor(i / COLS)) bad.push(`node ${i} position`); });
  let diag = 0; const perLayer = new Array(DEPTH - 1).fill(0);
  for (const n of N) {
    if (n.depth === DEPTH - 1 && n.next.length) bad.push(`last row links ${n.id}`);
    if (n.depth < DEPTH - 1 && !n.next.includes(nid(n.depth + 1, n.col))) bad.push(`no straight link ${n.id}`);
    for (const x of n.next) { const m = N[x]; if (!m || m.depth !== n.depth + 1 || Math.abs(m.col - n.col) > 1) bad.push(`bad link ${n.id}->${x}`); else if (m.col !== n.col) { diag++; perLayer[n.depth]++; } }
  }
  if (diag < DIAG_MIN || diag > DIAG_MAX) bad.push(`diagonals ${diag}`);
  perLayer.forEach((k, d) => { if (k < 1) bad.push(`no branch in layer ${d}`); });
  for (let d = 0; d < DEPTH - 1; d++) {
    const links: Array<[MapNode, MapNode]> = []; for (const n of N.filter((x) => x.depth === d)) for (const x of n.next) links.push([n, N[x]]);
    for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) if (linksCross(links[i], links[j])) bad.push(`crossing in layer ${d}`);
  }
  const count = (t: NodeType) => N.filter((n) => n.type === t).length;
  for (const t of NODE_TYPES) if (count(t) > TYPE_CAP[t]) bad.push(`too many ${t}`);
  if (!opts.rootsAvailable && count('roots') > 0) bad.push('roots not available');
  if (count('artifact') < 1) bad.push('no artifact');
  if (!N.some((n) => SUSTAIN.includes(n.type) && n.depth >= 1)) bad.push('no sustain');
  if (isBossFloor(f.floor) && !N.some((n) => SUSTAIN.includes(n.type) && n.depth === DEPTH - 1)) bad.push('no pre-boss sustain');
  for (const n of N) {
    if (!isFight(n.type) && (n.modifier !== 'none' || n.event)) bad.push(`no-fight room with fight extras ${n.id}`);
    if (n.type === 'enchant' && !n.altarSize) bad.push(`altar size ${n.id}`);
    for (const x of n.next) if (N[x].type === n.type) bad.push(`repeat type on link ${n.id}->${x}`);
  }
  const groups: number[][] = [N.filter((n) => n.depth === 0).map((n) => n.id), ...N.filter((n) => n.next.length > 1).map((n) => n.next)];
  for (const g of groups) if (new Set(g.map((i) => N[i].type)).size !== g.length) bad.push(`duplicate choice types ${g.join(',')}`);
  const elites = N.filter((n) => n.modifier === 'miniboss');
  if (elites.length > ELITE_MAX) bad.push('too many elites');
  for (const e of elites) { if (!HIGH_VALUE.includes(e.type)) bad.push(`elite guards low reward ${e.id}`); if (e.next.some((x) => N[x].modifier === 'miniboss')) bad.push(`chained elites ${e.id}`); }
  if (globalFloor(f.chapter, f.floor) === 1 && elites.some((e) => e.depth === 0)) bad.push('elite in first row of floor 1');
  if (elites.length && !allPaths(f).some((p) => p.every((i) => N[i].modifier !== 'miniboss'))) bad.push('no safe path');
  return bad;
}

/** Diagonal plan: for each layer and column gap one of none / right (c→c+1) / left (c+1→c). */
function rollLinks(rng: Rng, nodes: MapNode[]) {
  for (;;) {
    const plan: Array<Array<0 | 1 | -1>> = [];
    for (let d = 0; d < DEPTH - 1; d++) { const row: Array<0 | 1 | -1> = []; for (let gp = 0; gp < COLS - 1; gp++) { const r = rng.next(); row.push(r < 0.42 ? 0 : r < 0.71 ? 1 : -1); } plan.push(row); }
    const tot = plan.flat().filter((x) => x !== 0).length;
    if (tot < DIAG_MIN || tot > DIAG_MAX || plan.some((row) => row.every((x) => x === 0))) continue;
    for (const n of nodes) n.next = n.depth < DEPTH - 1 ? [nid(n.depth + 1, n.col)] : [];
    plan.forEach((row, d) => row.forEach((dir, gp) => { if (dir === 1) nodes[nid(d, gp)].next.push(nid(d + 1, gp + 1)); else if (dir === -1) nodes[nid(d, gp + 1)].next.push(nid(d + 1, gp)); }));
    for (const n of nodes) n.next.sort((a, b) => a - b);
    return;
  }
}

function buildCandidate(rng: Rng, chapter: number, floor: number, opts: GenOpts): MapNode[] {
  const nodes: MapNode[] = [];
  for (let d = 0; d < DEPTH; d++) for (let c = 0; c < COLS; c++) nodes.push({ id: nid(d, c), col: c, depth: d, type: 'artifact', modifier: 'none', event: null, next: [] });
  rollLinks(rng, nodes);
  const assigned = new Array<NodeType | null>(nodes.length).fill(null);
  const count = (t: NodeType) => assigned.filter((x) => x === t).length;
  const conflicts = (id: number, t: NodeType) => [...neighbours(nodes, id), ...coChoices(nodes, id)].some((j) => assigned[j] === t);
  const ok = (id: number, t: NodeType) => count(t) < TYPE_CAP[t] && !conflicts(id, t) && (t !== 'roots' || !!opts.rootsAvailable);
  const boss = isBossFloor(floor);
  // 1) sustain stop: boss floors camp on the pre-boss row; other floors anywhere past the first row
  const sustainSlots = nodes.filter((n) => (boss ? n.depth === DEPTH - 1 : n.depth >= 1)).map((n) => n.id);
  const sId = rng.pick(sustainSlots); assigned[sId] = rng.chance(boss ? 0.45 : 0.5) ? 'shop' : 'heart';
  // 2) Tree Roots (once per run) — a no-fight detour, never in the first row
  if (opts.rootsAvailable && rng.chance(0.4)) { const slots = nodes.filter((n) => n.depth >= 1 && assigned[n.id] === null && ok(n.id, 'roots')).map((n) => n.id); if (slots.length) assigned[rng.pick(slots)] = 'roots'; }
  // 3) weighted fill, row by row, avoiding repeats on links and duplicate choices
  for (const n of nodes) {
    if (assigned[n.id]) continue;
    const pool = NODE_TYPES.filter((t) => t !== 'roots' && ok(n.id, t));
    assigned[n.id] = pool.length ? rng.weighted(pool, (t) => NODE_WEIGHTS[t]) : rng.weighted(NODE_TYPES.filter((t) => t !== 'roots'), (t) => NODE_WEIGHTS[t]);
  }
  // 4) guarantee an artifact room
  if (count('artifact') === 0) { const c = nodes.filter((n) => assigned[n.id] !== 'shop' && assigned[n.id] !== 'heart' && assigned[n.id] !== 'roots' && !conflicts(n.id, 'artifact')); if (c.length) assigned[rng.pick(c).id] = 'artifact'; }
  nodes.forEach((n, i) => (n.type = assigned[i]!));
  // 5) elites: 0–2 per floor, guard a high-value reward (upgrading a low-value room in place when legal)
  const g = globalFloor(chapter, floor);
  const want = g === 1 ? (rng.chance(0.5) ? 1 : 0) : rng.weighted([0, 1, 2], (k) => [30, 50, 20][k]);
  for (let k = 0; k < want; k++) {
    const cand = nodes.filter((n) => n.id !== sId && isFight(n.type) && n.modifier === 'none' && !(g === 1 && n.depth === 0)
      && !neighbours(nodes, n.id).some((j) => nodes[j].modifier === 'miniboss'));
    if (!cand.length) break;
    const e = rng.pick(cand);
    if (!HIGH_VALUE.includes(e.type)) {
      assigned[e.id] = null; const up = HIGH_VALUE.filter((t) => ok(e.id, t));
      if (!up.length) { assigned[e.id] = e.type; continue; }
      e.type = rng.weighted(up, (t) => NODE_WEIGHTS[t]); assigned[e.id] = e.type;
    }
    e.modifier = 'miniboss';
    if (!allPaths({ nodes }).some((p) => p.every((i) => nodes[i].modifier !== 'miniboss'))) e.modifier = 'none';
  }
  // 6) derangement, events, altar sizes
  for (const n of nodes) {
    if (isFight(n.type) && n.modifier === 'none' && rng.chance(DERANGE_CHANCE)) n.modifier = 'derangement';
    const evChance = opts.eventChance ?? EVENT_CHANCE;
    n.event = isFight(n.type) && rng.chance(evChance) ? rng.pick(opts.pocket === false ? EVENT_IDS.filter((e) => e !== 'pocket') : EVENT_IDS) : null;
    if (n.type === 'enchant') n.altarSize = rng.weighted([1, 2, 3] as const, (s) => [0, 55, 32, 13][s]);
  }
  return nodes;
}

/** Hand-made valid map used only if every seeded attempt fails validation (never observed; keeps generation total). */
export function templateNodes(floor: number, rng: Rng): MapNode[] {
  const types: NodeType[] = isBossFloor(floor)
    ? ['artifact', 'tablet', 'levelup', 'money', 'enchant', 'anvil', 'artifact', 'heart', 'tablet']
    : ['artifact', 'tablet', 'levelup', 'money', 'heart', 'anvil', 'tablet', 'artifact', 'money'];
  const links: number[][] = [[3, 4], [4], [5], [6], [7], [7, 8], [], [], []];
  return types.map((type, i) => {
    const n: MapNode = { id: i, col: i % COLS, depth: Math.floor(i / COLS), type, modifier: 'none', event: null, next: links[i] };
    if (type === 'enchant') n.altarSize = rng.weighted([1, 2, 3] as const, (s) => [0, 55, 32, 13][s]);
    return n;
  });
}

export const GEN_ATTEMPTS = 40;
export function generateFloor(seed: number, chapter: number, floor: number, opts: GenOpts = {}): Floor {
  const rng = new Rng(seed);
  const ch = getChapter(chapter);
  const g = globalFloor(chapter, floor);
  const f: Floor = {
    chapter, floor, globalFloor: g, seed, startShop: g >= 2, nodes: [],
    gate: isBossFloor(floor) ? 'boss' : 'gate', bossId: isBossFloor(floor) ? ch.boss : ch.miniBoss,
    startEvent: null,
  };
  for (let a = 0; a < GEN_ATTEMPTS; a++) { f.nodes = buildCandidate(rng, chapter, floor, opts); if (validateFloor(f, opts).length === 0) return f; }
  f.nodes = templateNodes(floor, rng);
  return f;
}

/** Boss foreshadowing shown on the map from the first room: who waits at this floor's gate and at the chapter's end. */
export function bossForeshadow(f: Floor): { gate: 'boss' | 'gate'; gateBossId: string; chapterBossId: string; floorsToBoss: number } {
  const ch = getChapter(f.chapter);
  return { gate: f.gate, gateBossId: f.bossId, chapterBossId: ch.boss, floorsToBoss: 3 - f.floor };
}

export type NodeState = 'current' | 'cleared' | 'reachable' | 'ahead' | 'skipped';
export interface MapView { nodes: Record<number, NodeState>; start: 'current' | 'cleared'; gate: 'current' | 'reachable' | 'ahead'; currentCleared: boolean; path: Array<[number | 'start', number | 'gate']>; nextIds: Array<number | 'gate'>; reachableAhead: number[] }
/**
 * Map display state for a position: visited rooms are cleared (doors only open after a clear), the current room,
 * the rooms one door away (reachable), rooms still reachable later (ahead) and rooms the chosen path can no longer reach (skipped).
 */
export function mapView(f: Floor, pos: number | 'start' | 'gate', visited: number[], roomCleared: boolean): MapView {
  const nodes: Record<number, NodeState> = {};
  const ch = pos === 'gate' ? [] : choicesFrom(f, pos);
  const nextIds: Array<number | 'gate'> = ch === 'gate' ? ['gate'] : [...ch];
  const ahead = new Set<number>(); const q = ch === 'gate' ? [] : [...ch];
  while (q.length) { const id = q.shift()!; if (ahead.has(id)) continue; ahead.add(id); q.push(...f.nodes[id].next); }
  for (const n of f.nodes) {
    nodes[n.id] = n.id === pos ? 'current' : visited.includes(n.id) ? 'cleared' : ch !== 'gate' && ch.includes(n.id) ? 'reachable' : ahead.has(n.id) ? 'ahead' : 'skipped';
  }
  const path: Array<[number | 'start', number | 'gate']> = []; let prev: number | 'start' = 'start';
  for (const v of visited) { path.push([prev, v]); prev = v; }
  if (pos === 'gate') path.push([prev, 'gate']);
  return { nodes, start: pos === 'start' ? 'current' : 'cleared', gate: pos === 'gate' ? 'current' : ch === 'gate' ? 'reachable' : 'ahead', currentCleared: roomCleared, path, nextIds, reachableAhead: [...ahead] };
}
/** Nodes reachable from a position: 'start' → depth 0; node → its links; last depth → gate. */
export function choicesFrom(f: Floor, pos: number | 'start'): number[] | 'gate' {
  if (pos === 'start') return f.nodes.filter((n) => n.depth === 0).map((n) => n.id);
  const n = f.nodes[pos]; if (!n) return [];
  if (n.depth === DEPTH - 1) return 'gate';
  return n.next;
}
/** every node reachable from start (connectivity check) */
export function reachable(f: Floor): Set<number> {
  const s = new Set<number>(); const q = f.nodes.filter((n) => n.depth === 0).map((n) => n.id);
  while (q.length) { const id = q.shift()!; if (s.has(id)) continue; s.add(id); q.push(...f.nodes[id].next); }
  return s;
}

// ---- waves ----
// Composition is delegated to the encounter director (role budgets, 2–3 waves, elites): see director.ts.
export interface WavePlan { waves: string[][]; elites?: Array<Array<Affix | null>>; miniBoss?: string; derangement?: Array<'haste' | 'armor' | 'explode'> }
export function planWaves(seed: number, chapter: number, floor: number, depth: number, modifier: NodeModifier, event: EventId | null, hard = false): WavePlan {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const ch = getChapter(chapter);
  const pool = ch.enemies.map((e) => getEnemy(e)).filter((d): d is EnemyDef => !!d);
  const enc = planEncounter(seed, chapter, floor, depth, pool, { hard, arena: event === 'arena', miniboss: modifier === 'miniboss', derangement: modifier === 'derangement' });
  const plan: WavePlan = { waves: enc.waves.map((w) => w.map((e) => e.id)), elites: enc.waves.map((w) => w.map((e) => e.elite ?? null)) };
  if (modifier === 'miniboss') plan.miniBoss = ch.miniBoss;
  if (modifier === 'derangement') plan.derangement = rng.shuffle(['haste', 'armor', 'explode'] as Array<'haste' | 'armor' | 'explode'>).slice(0, rng.int(1, 2));
  return plan;
}
export const hardMult = (hard: boolean) => (hard ? 1.4 : 1);
/** enemy stat scaling per global floor */
export function enemyScale(chapter: number, floor: number, hard: boolean) {
  const g = globalFloor(chapter, floor);
  return { hp: (1 + (g - 1) * 0.06) * hardMult(hard), dmg: (1 + (g - 1) * 0.04) * hardMult(hard) };
}
