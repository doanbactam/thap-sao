// Floor generator (SPEC §5): start room, 3-column × 3-deep node map with branching, node types/modifiers,
// random events, gate/boss room; plus combat wave planning. Framework-free.
import type { NodeType, NodeModifier, EventId } from '../data/types';
import { Rng } from './rng';
import { getChapter, getEnemy } from './registry';

export const NODE_TYPES: NodeType[] = ['levelup', 'artifact', 'enchant', 'tablet', 'money', 'heart', 'anvil', 'dice', 'shop', 'roots'];
export const EVENT_IDS: EventId[] = ['arena', 'secret', 'clover', 'merchant', 'obelisk', 'fountain', 'companion', 'blood', 'pocket'];
export const COLS = 3, DEPTH = 3;
export const NODE_WEIGHTS: Record<NodeType, number> = { levelup: 12, artifact: 18, enchant: 8, tablet: 12, money: 9, heart: 6, anvil: 8, dice: 6, shop: 6, roots: 5 };
export const NO_FIGHT: NodeType[] = ['shop', 'roots'];
export const EVENT_CHANCE = 0.13;

export interface MapNode { id: number; col: number; depth: number; type: NodeType; modifier: NodeModifier; event: EventId | null; next: number[]; altarSize?: 1 | 2 | 3 }
export interface Floor { chapter: number; floor: number; globalFloor: number; seed: number; startShop: boolean; nodes: MapNode[]; gate: 'boss' | 'gate'; bossId: string; startEvent: EventId | null }

export const globalFloor = (chapter: number, floor: number) => (chapter - 1) * 3 + floor;
export const isBossFloor = (floor: number) => floor === 3;

export interface GenOpts { rootsAvailable?: boolean; hard?: boolean; eventChance?: number; pocket?: boolean }
export function generateFloor(seed: number, chapter: number, floor: number, opts: GenOpts = {}): Floor {
  const rng = new Rng(seed);
  const ch = getChapter(chapter);
  const nodes: MapNode[] = [];
  let rootsPlaced = !opts.rootsAvailable;
  const evChance = opts.eventChance ?? EVENT_CHANCE;
  for (let d = 0; d < DEPTH; d++) for (let c = 0; c < COLS; c++) {
    const types = NODE_TYPES.filter((t) => t !== 'roots' || !rootsPlaced);
    let type = rng.weighted(types, (t) => NODE_WEIGHTS[t]);
    if (type === 'roots') rootsPlaced = true;
    let modifier: NodeModifier = 'none';
    if (!NO_FIGHT.includes(type)) { const r = rng.next(); modifier = r < 0.12 ? 'miniboss' : r < 0.27 ? 'derangement' : 'none'; }
    const event = !NO_FIGHT.includes(type) && rng.chance(evChance) ? rng.pick(opts.pocket === false ? EVENT_IDS.filter((e) => e !== 'pocket') : EVENT_IDS) : null;
    const n: MapNode = { id: d * COLS + c, col: c, depth: d, type, modifier, event, next: [] };
    if (type === 'enchant') n.altarSize = rng.weighted([1, 2, 3] as const, (s) => [0, 55, 32, 13][s]);
    nodes.push(n);
  }
  // guarantee at least one artifact node on the floor
  if (!nodes.some((n) => n.type === 'artifact')) { const n = nodes[rng.int(0, nodes.length - 1)]; if (n.type === 'roots') rootsPlaced = false; n.type = 'artifact'; delete n.altarSize; }
  // links: straight always; diagonal branching to adjacent columns with probability
  for (let d = 0; d < DEPTH - 1; d++) for (let c = 0; c < COLS; c++) {
    const n = nodes[d * COLS + c]; n.next.push((d + 1) * COLS + c);
    for (const dc of [-1, 1]) { const cc = c + dc; if (cc >= 0 && cc < COLS && rng.chance(0.4)) n.next.push((d + 1) * COLS + cc); }
    n.next.sort((a, b) => a - b);
  }
  const g = globalFloor(chapter, floor);
  return {
    chapter, floor, globalFloor: g, seed, startShop: g >= 2, nodes,
    gate: isBossFloor(floor) ? 'boss' : 'gate', bossId: isBossFloor(floor) ? ch.boss : ch.miniBoss,
    startEvent: null,
  };
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
export interface WavePlan { waves: string[][]; miniBoss?: string; derangement?: Array<'haste' | 'armor' | 'explode'> }
export function planWaves(seed: number, chapter: number, floor: number, depth: number, modifier: NodeModifier, event: EventId | null): WavePlan {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const ch = getChapter(chapter);
  const pool = ch.enemies.filter((e) => getEnemy(e));
  let nWaves = event === 'arena' ? rng.int(3, 4) : rng.int(1, Math.min(3, 1 + Math.floor((floor + depth) / 2)));
  const waves: string[][] = [];
  for (let w = 0; w < nWaves; w++) {
    const count = Math.min(9, 2 + Math.floor(chapter / 2) + depth + w + rng.int(0, 2));
    waves.push(Array.from({ length: count }, () => rng.pick(pool)));
  }
  const plan: WavePlan = { waves };
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
