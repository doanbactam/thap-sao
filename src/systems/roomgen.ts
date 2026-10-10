// Room layout generator (docs/V2_ROOMS.md). Pure + seeded (rng.ts), framework-free.
// A room is the fixed 27×15 tile grid RunScene draws (48 px tiles, 1296×720 baked). Walkable interior = cols 1..25,
// rows 3..13. Obstacles are authored on cells: rocks / pillars / bushes / low walls block movement, projectiles and
// line of sight; liquid (water / pit / lava…) blocks movement only (shots and sight pass over it); `edge` cells are
// the trimmed outside of smaller rooms. Templates are hand-authored 21×7 ASCII maps over the placement area
// (cols 3..23, rows 5..11) plus a procedural cluster scatter; every result is validated by flood fill (all
// walkable cells connected to the entry, doors + anchors reachable for big bodies) and falls back to a safer layout.
import { Rng } from './rng';

export const TILE = 48, COLS = 27, ROWS = 15;
/** walkable interior (cells) */
export const IN = { c0: 1, c1: 25, r0: 3, r1: 13 };
/** placement area for template obstacles (keeps a 2-cell lane along every wall: doors on top, entry at the bottom) */
export const PL = { c0: 3, c1: 23, r0: 5, r1: 11 };
export const PW = PL.c1 - PL.c0 + 1, PH = PL.r1 - PL.r0 + 1; // 21 × 7

export const CellK = { Floor: 0, Rock: 1, Pillar: 2, Bush: 3, Wall: 4, Liquid: 5, Edge: 6 } as const;
export type ObstacleKind = 'rock' | 'pillar' | 'bush' | 'wall' | 'liquid' | 'edge';
const KIND_OF: Record<number, ObstacleKind> = { 1: 'rock', 2: 'pillar', 3: 'bush', 4: 'wall', 5: 'liquid', 6: 'edge' };
export const blocksMove = (k: number) => k !== CellK.Floor;
export const blocksShot = (k: number) => k !== CellK.Floor && k !== CellK.Liquid;

export type RoomKind = 'start' | 'combat' | 'elite' | 'treasure' | 'event' | 'shop' | 'boss';

/** Fixed world positions RunScene uses for interactables / spawns. Kept clear by every layout (tests check them). */
export const ANCHORS = {
  entry: { x: 640, y: 640 }, startEntry: { x: 640, y: 600 }, gateEntry: { x: 640, y: 620 },
  reward: { x: 640, y: 420 }, miniDrop: { x: 520, y: 420 }, event: { x: 400, y: 470 }, secret: { x: 1200, y: 300 },
  shop: { x: 480, y: 360 }, dummy: { x: 820, y: 360 }, miniBoss: { x: 640, y: 300 }, boss: { x: 640, y: 330 }, portal: { x: 640, y: 420 },
};
/** door x positions (RunScene.drawDoors), doors are used from the top lane (row 3) */
export const DOOR_XS = [340, 460, 640, 820, 940];

export interface Obstacle { kind: ObstacleKind; c: number; r: number; key?: string }
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface RoomLayout {
  kind: RoomKind; chapter: number; template: string; trim: number; seed: number;
  grid: Uint8Array; // COLS*ROWS, CellK
  obstacles: Obstacle[]; // one per blocking interior cell (edge cells excluded), with a prop key for rock/pillar/bush
  anchors: Array<{ x: number; y: number }>; // must stay reachable
}

export interface RoomSpec { kind: RoomKind; chapter: number; seed: number; miniBoss?: boolean; event?: string | null }

// ---------------- chapter themes (existing props only) ----------------
export interface Theme { rock: string[]; pillar: string[]; bush: string[]; liquid: string }
export const THEMES: Record<number, Theme> = {
  1: { rock: ['prop_ch1_boulder', 'prop_ch1_boulder_b', 'prop_ch1_stones'], pillar: ['prop_ch1_lantern', 'prop_ch1_stump'], bush: ['prop_ch1_bramble', 'prop_ch1_mushrooms'], liquid: 'swamp' },
  2: { rock: ['prop_ch2_crates', 'prop_ch2_rubble', 'prop_ch2_rubble_b', 'prop_ch2_minecart'], pillar: ['prop_ch2_spire', 'prop_ch2_support', 'prop_ch2_barrel_flag'], bush: ['prop_ch2_deadbush', 'prop_ch2_crystals'], liquid: 'lava' },
  3: { rock: ['prop_ch3_bookstack', 'prop_ch3_desk', 'prop_ch3_armchair', 'prop_ch3_globe'], pillar: ['prop_ch3_bookshelf', 'prop_ch3_shelf_round', 'prop_ch3_candelabra'], bush: ['prop_ch3_floating_rock', 'prop_ch3_floating_rock_b'], liquid: 'sky' },
  4: { rock: ['prop_ch4_snow_boulder', 'prop_ch4_snow_rocks', 'prop_ch4_fish_barrel', 'prop_ch4_snowman'], pillar: ['prop_ch4_ice_pillar', 'prop_ch4_signpost'], bush: ['prop_ch4_frost_bush', 'prop_ch4_ice_crystals'], liquid: 'water' },
  5: { rock: ['prop_ch5_barrels', 'prop_ch5_barrels_b', 'prop_ch5_parts_crate', 'prop_ch5_workbench'], pillar: ['prop_ch5_boiler', 'prop_ch5_chimney', 'prop_ch5_lamp'], bush: ['prop_ch5_gears', 'prop_ch5_pipe_valve'], liquid: 'steam' },
  6: { rock: ['prop_ch6_moon_rock', 'prop_ch6_meteorite', 'prop_ch6_rubble'], pillar: ['prop_ch6_pillar', 'prop_ch6_crystal', 'prop_ch6_ring_statue'], bush: ['prop_ch6_crystal_flowers', 'prop_ch6_glow_mushrooms', 'prop_ch6_crystal_b'], liquid: 'void' },
};

// ---------------- hand-authored templates (21 × 7 over PL) ----------------
// . floor  R rock  P pillar  B bush  W low wall  ~ liquid  ? rock-or-bush (seeded)  The centre 3×3 is always cleared (reward).
export interface Template { id: string; kinds: RoomKind[]; chapters?: number[]; w?: number; rows: string[] }
export const TEMPLATES: Template[] = [
  { id: 'pillar_grid', kinds: ['combat', 'treasure', 'event'], rows: [
    '.....................',
    '..P....P.....P....P..',
    '.....................',
    '.....................',
    '.....................',
    '..P....P.....P....P..',
    '.....................'] },
  { id: 'rock_clusters', kinds: ['combat', 'treasure', 'event'], rows: [
    '.....................',
    '.RR..............RR..',
    '.R?...............?..',
    '.....................',
    '....??.........??....',
    '.....................',
    '........RRRRR........'] },
  { id: 'choke_walls', kinds: ['combat'], rows: [
    '.....................',
    '..WWWWWW.....WWWWWW..',
    '.....................',
    '.....................',
    '.....................',
    '..WWWWWW.....WWWWWW..',
    '.....................'] },
  { id: 'flank_lanes', kinds: ['combat', 'event'], rows: [
    '......W.......W......',
    '......W.......W......',
    '.....................',
    '.....................',
    '.....................',
    '......W.......W......',
    '......W.......W......'] },
  { id: 'river_bridges', kinds: ['combat', 'treasure'], rows: [
    '.....................',
    '...RR...........RR...',
    '.....................',
    '.....................',
    '.....................',
    '~~~~~~..~~~~~..~~~~~~',
    '~~~~~~..~~~~~..~~~~~~'] },
  { id: 'pillar_ring', kinds: ['combat', 'elite', 'event'], rows: [
    '.....................',
    '......P.......P......',
    '.....................',
    '....P...........P....',
    '.....................',
    '......P.......P......',
    '.....................'] },
  { id: 'crossfire_cover', kinds: ['combat', 'treasure'], rows: [
    '.....................',
    '...BBB.........BBB...',
    '.....................',
    'R...................R',
    '.....................',
    '...BBB.........BBB...',
    '.....................'] },
  { id: 'brackets', kinds: ['combat', 'event'], rows: [
    '.....................',
    '..WWW...........WWW..',
    '..W...............W..',
    '.....................',
    '..W...............W..',
    '..WWW...........WWW..',
    '.....................'] },
  { id: 'twin_pools', kinds: ['combat', 'treasure', 'event'], rows: [
    '.....................',
    '...~~~.........~~~...',
    '...~~~.........~~~...',
    '.....................',
    '........R...R........',
    '..B...............B..',
    '.....................'] },
  { id: 'offset_blocks', kinds: ['combat'], rows: [
    '.....................',
    '..RR........BB.......',
    '..RR.................',
    '................PP...',
    '.....B...............',
    '.....B.......RR......',
    '.............RR......'] },
  { id: 'central_bunker', kinds: ['combat'], rows: [
    '.....................',
    '.......WWWWWWW.......',
    '.....................',
    '..B..............B...',
    '.....................',
    '.......WWWWWWW.......',
    '.....................'] },
  // chapter signatures
  { id: 'ch1_grove', kinds: ['combat', 'treasure'], chapters: [1], rows: [
    '.....................',
    '..BB...~~...~~...BB..',
    '..B....~~...~~....B..',
    '.....................',
    '....R...........R....',
    '.....................',
    '..BB.............BB..'] },
  { id: 'ch2_quarry', kinds: ['combat', 'treasure'], chapters: [2], rows: [
    '.....RR.......RR.....',
    '.....RR.......RR.....',
    '.....................',
    '~~~...............~~~',
    '.....................',
    '.....RR.......RR.....',
    '.....................'] },
  { id: 'ch3_stacks', kinds: ['combat', 'event'], chapters: [3], rows: [
    '.....................',
    '..PPPP.........PPPP..',
    '.....................',
    '..~~.............~~..',
    '.....................',
    '..PPPP.........PPPP..',
    '.....................'] },
  { id: 'ch4_ice_holes', kinds: ['combat', 'treasure'], chapters: [4], rows: [
    '.......B.....B.......',
    '...~~.....P.....~~...',
    '...~~...........~~...',
    'P...................P',
    '...~~...........~~...',
    '...~~.....P.....~~...',
    '.....................'] },
  { id: 'ch5_pipes', kinds: ['combat', 'event'], chapters: [5], rows: [
    '.....................',
    '..WWWW~~.....~~WWWW..',
    '.....................',
    '.....................',
    '.....................',
    '..WWWW~~.....~~WWWW..',
    '.....................'] },
  { id: 'ch6_void', kinds: ['combat', 'treasure'], chapters: [6], rows: [
    '.....................',
    '....P....~~~....P....',
    '.....................',
    '..~~.............~~..',
    '.....................',
    '....P....~~~....P....',
    '.....................'] },
  // elite / arena: open middle for a mini-boss + crowd, cover at the rim
  { id: 'elite_corners', kinds: ['elite'], rows: [
    '.....................',
    '.RR...............RR.',
    '.R.................R.',
    '.....................',
    '.R.................R.',
    '.RR...............RR.',
    '.....................'] },
  { id: 'elite_pillars', kinds: ['elite'], rows: [
    'P...................P',
    '.....................',
    '...P.............P...',
    '.....................',
    '...P.............P...',
    '.....................',
    'P...................P'] },
  { id: 'elite_moat', kinds: ['elite'], rows: [
    '~~.................~~',
    '~...................~',
    '.....................',
    '.....................',
    '.....................',
    '~...................~',
    '~~.................~~'] },
  // no-fight rooms: frame the room, keep the stall readable
  { id: 'start_frame', kinds: ['start'], rows: [
    'P...................P',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    'P...................P'] },
  { id: 'start_gate', kinds: ['start'], rows: [
    '.....................',
    '..P..............P...',
    '.....................',
    '.....................',
    '.....................',
    '..BB.............BB..',
    '.....................'] },
  // shop rooms are trimmed by 3 columns: features sit at template cols 4 / 16
  { id: 'shop_frame', kinds: ['shop'], rows: [
    '....P...........P....',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    '....P...........P....'] },
  { id: 'shop_garden', kinds: ['shop'], rows: [
    '....BB.........BB....',
    '....B...........B....',
    '.....................',
    '.....................',
    '.....................',
    '....B...........B....',
    '....BB.........BB....'] },
  // boss arenas: open readable space, only far-corner features
  { id: 'boss_open', kinds: ['boss'], rows: [
    '.....................', '.....................', '.....................', '.....................', '.....................', '.....................', '.....................'] },
  { id: 'boss_corners', kinds: ['boss'], rows: [
    'P...................P', '.....................', '.....................', '.....................', '.....................', '.....................', 'P...................P'] },
  { id: 'boss_pools', kinds: ['boss'], rows: [
    '~~.................~~', '~...................~', '.....................', '.....................', '.....................', '~...................~', '~~.................~~'] },
];

const CH: Record<string, number> = { '.': CellK.Floor, R: CellK.Rock, P: CellK.Pillar, B: CellK.Bush, W: CellK.Wall, '~': CellK.Liquid };
export const idx = (c: number, r: number) => r * COLS + c;
export const cellOf = (x: number, y: number) => ({ c: Math.floor(x / TILE), r: Math.floor(y / TILE) });
export const cellCenter = (c: number, r: number) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });

/** trim (outer columns turned into edge) per room kind → smaller rooms */
export function trimFor(spec: RoomSpec, rng: Rng): number {
  switch (spec.kind) {
    case 'shop': return 3;
    case 'treasure': return 2;
    case 'event': return spec.event === 'secret' ? 0 : 1;
    case 'combat': return rng.chance(0.35) ? 1 : 0;
    default: return 0;
  }
}

function emptyGrid(): Uint8Array {
  const g = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (c < IN.c0 || c > IN.c1 || r < IN.r0 || r > IN.r1) g[idx(c, r)] = CellK.Edge;
  return g;
}

function stamp(g: Uint8Array, t: Template, rng: Rng, flipX: boolean, flipY: boolean) {
  for (let ry = 0; ry < PH; ry++) for (let rx = 0; rx < PW; rx++) {
    const row = t.rows[flipY ? PH - 1 - ry : ry] ?? ''; const ch = row[flipX ? PW - 1 - rx : rx] ?? '.';
    const k = ch === '?' ? (rng.chance(0.5) ? CellK.Rock : CellK.Bush) : (CH[ch] ?? CellK.Floor);
    if (k) g[idx(PL.c0 + rx, PL.r0 + ry)] = k;
  }
}

// procedural clusters (shapes in cell offsets)
const SHAPES: Array<{ k: number; cells: Array<[number, number]> }> = [
  { k: CellK.Pillar, cells: [[0, 0]] },
  { k: CellK.Rock, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { k: CellK.Rock, cells: [[0, 0], [1, 0]] },
  { k: CellK.Bush, cells: [[0, 0], [1, 0], [2, 0]] },
  { k: CellK.Bush, cells: [[0, 0], [0, 1]] },
  { k: CellK.Wall, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { k: CellK.Wall, cells: [[0, 0], [1, 0], [2, 0], [0, 1]] },
  { k: CellK.Wall, cells: [[0, 0], [0, 1], [0, 2]] },
  { k: CellK.Liquid, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  { k: CellK.Liquid, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
];
function scatter(g: Uint8Array, rng: Rng, spec: RoomSpec) {
  const n = spec.kind === 'treasure' || spec.kind === 'event' ? rng.int(3, 5) : rng.int(5, 7);
  const mirror = rng.chance(0.6); const owner = new Int16Array(COLS * ROWS).fill(-1); let placed = 0;
  for (let tries = 0; tries < 160 && placed < n; tries++) {
    const s = rng.weighted(SHAPES, (x) => (x.k === CellK.Liquid ? 0.6 : 1));
    const flip = rng.chance(0.5);
    const cells = s.cells.map(([dx, dy]) => (flip ? [dy, dx] : [dx, dy]) as [number, number]);
    const ox = rng.int(PL.c0, PL.c1), oy = rng.int(PL.r0, PL.r1);
    const pts: Array<[number, number]> = cells.map(([dx, dy]) => [ox + dx, oy + dy]);
    if (mirror) for (const [x, y] of [...pts]) { const mx = PL.c0 + PL.c1 - x; if (mx !== x) pts.push([mx, y]); }
    // inside the placement area, not in the reward centre, and a 2-cell gap from every other cluster
    if (!pts.every(([x, y]) => x >= PL.c0 && x <= PL.c1 && y >= PL.r0 && y <= PL.r1 && !(Math.abs(x - 13) <= 1 && Math.abs(y - 8) <= 1))) continue;
    let ok = true;
    for (const [x, y] of pts) { for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2 && ok; dx++) { const o = owner[idx(x + dx, y + dy)]; if (o >= 0 && o !== placed) ok = false; } if (!ok) break; }
    if (!ok) continue;
    for (const [x, y] of pts) { g[idx(x, y)] = s.k; owner[idx(x, y)] = placed; }
    placed++;
  }
}

function applyTrim(g: Uint8Array, trim: number) {
  if (trim <= 0) return;
  for (let r = IN.r0; r <= IN.r1; r++) for (let k = 0; k < trim; k++) { g[idx(IN.c0 + k, r)] = CellK.Edge; g[idx(IN.c1 - k, r)] = CellK.Edge; }
  // keep a 2-cell lane inside the new side walls
  for (let r = IN.r0; r <= IN.r1; r++) for (let k = 0; k < 2; k++) { g[idx(IN.c0 + trim + k, r)] = CellK.Floor; g[idx(IN.c1 - trim - k, r)] = CellK.Floor; }
}

function clearDisc(g: Uint8Array, x: number, y: number, rc: number) {
  const { c, r } = cellOf(x, y);
  for (let dr = -rc; dr <= rc; dr++) for (let dc = -rc; dc <= rc; dc++) { const cc = c + dc, rr = r + dr; if (cc >= IN.c0 && cc <= IN.c1 && rr >= IN.r0 && rr <= IN.r1 && g[idx(cc, rr)] !== CellK.Edge) g[idx(cc, rr)] = CellK.Floor; }
}

/** anchors a room of this kind must keep clear + reachable */
export function anchorsFor(spec: RoomSpec): Array<{ x: number; y: number; r: number }> {
  const A = ANCHORS; const out: Array<{ x: number; y: number; r: number }> = [];
  switch (spec.kind) {
    case 'start': out.push({ ...A.startEntry, r: 1 }, { ...A.shop, r: 1 }, { ...A.dummy, r: 1 }); break;
    case 'boss': out.push({ ...A.gateEntry, r: 1 }, { ...A.boss, r: 2 }, { ...A.portal, r: 1 }); break;
    case 'shop': out.push({ ...A.entry, r: 1 }, { ...A.reward, r: 1 }); break;
    default:
      out.push({ ...A.entry, r: 1 }, { ...A.reward, r: 1 });
      if (spec.miniBoss || spec.kind === 'elite') out.push({ ...A.miniBoss, r: 2 }, { ...A.miniDrop, r: 1 });
      if (spec.event) out.push({ ...A.event, r: 1 }, { ...A.miniBoss, r: 1 }); // event props + the bat / arena spawn
      if (spec.event === 'secret') out.push({ ...A.secret, r: 1 });
  }
  return out;
}

export function templatesFor(kind: RoomKind, chapter: number): Template[] {
  return TEMPLATES.filter((t) => t.kinds.includes(kind) && (!t.chapters || t.chapters.includes(chapter)));
}

/** Build the layout for one room. Deterministic for (kind, chapter, seed, flags). */
export function buildRoom(spec: RoomSpec): RoomLayout {
  const rng = new Rng((spec.seed ^ (spec.chapter * 0x51ed27)) >>> 0);
  const trim = trimFor(spec, rng);
  const anchors = anchorsFor(spec);
  const pool = templatesFor(spec.kind, spec.chapter);
  const procChance = spec.kind === 'combat' ? 0.4 : spec.kind === 'treasure' || spec.kind === 'event' ? 0.3 : 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const g = emptyGrid(); let template = 'open';
    const useProc = (procChance > 0 && rng.chance(procChance)) || (!pool.length && procChance > 0);
    if (useProc) { scatter(g, rng, spec); template = 'proc'; }
    else if (pool.length) {
      const t = spec.chapter && pool.some((p) => p.chapters) && rng.chance(0.45) ? rng.pick(pool.filter((p) => p.chapters)) : rng.pick(pool);
      const fx = rng.chance(0.5), fy = rng.chance(0.5); stamp(g, t, rng, fx, fy); template = t.id + (fx ? '/fx' : '') + (fy ? '/fy' : '');
    }
    if (attempt === 5) { g.set(emptyGrid()); template = 'open'; } // last resort: open room
    applyTrim(g, trim);
    clearDisc(g, ANCHORS.reward.x, ANCHORS.reward.y, 1);
    for (const a of anchors) clearDisc(g, a.x, a.y, a.r);
    for (let c = IN.c0; c <= IN.c1; c++) { if (g[idx(c, IN.r0)] !== CellK.Edge) g[idx(c, IN.r0)] = CellK.Floor; if (g[idx(c, IN.r1)] !== CellK.Edge) g[idx(c, IN.r1)] = CellK.Floor; } // door + entry lanes
    fillPockets(g, entryOf(spec));
    const lay: RoomLayout = { kind: spec.kind, chapter: spec.chapter, template, trim, seed: spec.seed, grid: g, obstacles: [], anchors: anchors.map((a) => ({ x: a.x, y: a.y })) };
    if (attempt < 5 && !validate(lay, spec).ok) continue;
    lay.obstacles = decorate(g, spec.chapter, rng);
    return lay;
  }
  throw new Error('unreachable');
}

export function entryOf(spec: RoomSpec) { return spec.kind === 'start' ? ANCHORS.startEntry : spec.kind === 'boss' ? ANCHORS.gateEntry : ANCHORS.entry; }

/** walkable cells not connected to the entry become bushes/rocks (no unreachable pockets for spawns or loot) */
function fillPockets(g: Uint8Array, entry: { x: number; y: number }) {
  const seen = flood(g, cellOf(entry.x, entry.y), false);
  for (let i = 0; i < g.length; i++) if (g[i] === CellK.Floor && !seen[i]) g[i] = CellK.Bush;
}

function decorate(g: Uint8Array, chapter: number, rng: Rng): Obstacle[] {
  const th = THEMES[chapter] ?? THEMES[1]; const out: Obstacle[] = [];
  for (let r = IN.r0; r <= IN.r1; r++) for (let c = IN.c0; c <= IN.c1; c++) {
    const k = g[idx(c, r)]; if (k === CellK.Floor || k === CellK.Edge) continue;
    const kind = KIND_OF[k]; const o: Obstacle = { kind, c, r };
    if (kind === 'rock') o.key = rng.pick(th.rock); else if (kind === 'pillar') o.key = rng.pick(th.pillar); else if (kind === 'bush') o.key = rng.pick(th.bush);
    out.push(o);
  }
  return out;
}

// ---------------- queries ----------------
export function cellAt(l: { grid: Uint8Array }, c: number, r: number): number {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return CellK.Edge; return l.grid[idx(c, r)];
}
export function walkable(l: { grid: Uint8Array }, x: number, y: number): boolean { const { c, r } = cellOf(x, y); return !blocksMove(cellAt(l, c, r)); }
export function shotBlocked(l: { grid: Uint8Array }, x: number, y: number): boolean { const { c, r } = cellOf(x, y); return blocksShot(cellAt(l, c, r)); }

/** 4-neighbour flood fill over walkable cells. fat=true: a cell counts only if its 2×2 block (cell, right, down, diag)
 * or the block up-left of it is walkable too, i.e. a body up to ~48 px wide fits (mini-bosses, big elites). */
export function flood(g: Uint8Array, from: { c: number; r: number }, fat: boolean): Uint8Array {
  const seen = new Uint8Array(COLS * ROWS);
  const free = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && g[idx(c, r)] === CellK.Floor;
  const ok = (c: number, r: number) => {
    if (!free(c, r)) return false; if (!fat) return true;
    for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const a = c + ox, b = r + oy; if (free(a, b) && free(a + 1, b) && free(a, b + 1) && free(a + 1, b + 1)) return true; }
    return false;
  };
  if (!ok(from.c, from.r)) return seen;
  const q = [idx(from.c, from.r)]; seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!; const c = i % COLS, r = (i / COLS) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = c + dc, rr = r + dr; const j = idx(cc, rr); if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || seen[j] || !ok(cc, rr)) continue; seen[j] = 1; q.push(j); }
  }
  return seen;
}

export interface Validation { ok: boolean; reasons: string[] }
/** every walkable cell connected to the entry; doors, anchors reachable (also for big bodies); spawn ring free */
export function validate(l: RoomLayout, spec: RoomSpec): Validation {
  const reasons: string[] = []; const entry = cellOf(entryOf(spec).x, entryOf(spec).y);
  if (cellAt(l, entry.c, entry.r) !== CellK.Floor) reasons.push('entry blocked');
  const thin = flood(l.grid, entry, false), fat = flood(l.grid, entry, true);
  for (let i = 0; i < l.grid.length; i++) if (l.grid[i] === CellK.Floor && !thin[i]) { reasons.push(`pocket ${i % COLS},${(i / COLS) | 0}`); break; }
  const targets: Array<{ x: number; y: number; n: string }> = [...l.anchors.map((a, i) => ({ ...a, n: 'anchor' + i })), ...(spec.kind === 'boss' ? [] : DOOR_XS.map((x) => ({ x, y: IN.r0 * TILE + 24, n: 'door' + x })))];
  for (const t of targets) { const { c, r } = cellOf(t.x, t.y); if (!fat[idx(c, r)]) reasons.push(`${t.n} unreachable`); }
  let free = 0; for (let i = 0; i < l.grid.length; i++) if (l.grid[i] === CellK.Floor) free++;
  if (free < 120) reasons.push('too cramped');
  return { ok: reasons.length === 0, reasons };
}

/** Move-blocking rects in world px, merged per row run; `pad` inflates them (hero feet collision). */
export function blockRects(l: { grid: Uint8Array }, pad = { x: 0, top: 0, bottom: 0 }): Rect[] {
  const out: Rect[] = [];
  for (let r = IN.r0; r <= IN.r1; r++) {
    let c = IN.c0;
    while (c <= IN.c1) {
      if (!blocksMove(l.grid[idx(c, r)])) { c++; continue; }
      const s = c; while (c <= IN.c1 && blocksMove(l.grid[idx(c, r)])) c++;
      out.push({ x0: s * TILE - pad.x, y0: r * TILE - pad.top, x1: c * TILE + pad.x, y1: (r + 1) * TILE + pad.bottom });
    }
  }
  return out;
}

/** circle vs blocked cells: push the centre out (slides along faces). Returns hit=true if it touched anything. */
export function resolveCircle(l: { grid: Uint8Array }, x: number, y: number, rad: number): { x: number; y: number; hit: boolean } {
  let hit = false;
  for (let it = 0; it < 3; it++) {
    const { c, r } = cellOf(x, y); let moved = false;
    if (blocksMove(cellAt(l, c, r))) { // centre inside a blocked cell: jump to the nearest free cell edge
      const n = nearestFree(l, x, y); x = n.x; y = n.y; hit = true; moved = true; continue;
    }
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue; const cc = c + dc, rr = r + dr; if (!blocksMove(cellAt(l, cc, rr))) continue;
      const nx = Math.max(cc * TILE, Math.min(x, (cc + 1) * TILE)), ny = Math.max(rr * TILE, Math.min(y, (rr + 1) * TILE));
      const dx = x - nx, dy = y - ny; const d = Math.hypot(dx, dy);
      if (d < rad && d > 1e-6) { x = nx + (dx / d) * rad; y = ny + (dy / d) * rad; hit = true; moved = true; }
    }
    if (!moved) break;
  }
  return { x, y, hit };
}

/** nearest free point (cell centre, or the point itself if free), searched in growing rings */
export function nearestFree(l: { grid: Uint8Array }, x: number, y: number): { x: number; y: number } {
  const { c, r } = cellOf(x, y); if (!blocksMove(cellAt(l, c, r))) return { x, y };
  for (let ring = 1; ring < 30; ring++) {
    let best: { x: number; y: number } | null = null, bd = 1e9;
    for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue; const cc = c + dc, rr = r + dr;
      if (blocksMove(cellAt(l, cc, rr))) continue; const p = cellCenter(cc, rr); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; }
    }
    if (best) return best;
  }
  return cellCenter(13, 8);
}

/** straight-line test sampled every 8 px: sight/shots (blocksShot) or walking (blocksMove, with a body radius) */
export function lineClear(l: { grid: Uint8Array }, ax: number, ay: number, bx: number, by: number, walk = false, rad = 0): boolean {
  const d = Math.hypot(bx - ax, by - ay); const n = Math.max(1, Math.ceil(d / 8));
  const nx = d ? -(by - ay) / d : 0, ny = d ? (bx - ax) / d : 0;
  for (let i = 1; i < n; i++) {
    const t = i / n; const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    for (const o of rad ? [-rad, 0, rad] : [0]) {
      const { c, r } = cellOf(x + nx * o, y + ny * o); const k = cellAt(l, c, r);
      if (walk ? blocksMove(k) : blocksShot(k)) return false;
    }
  }
  return true;
}

/** Safe enemy spawn near a wanted point: a free cell reachable from the player's cell, ≥ minDist from the player,
 * not adjacent to an obstacle when avoidable, not on top of already-used spots. */
export function safeSpawn(l: { grid: Uint8Array }, want: { x: number; y: number }, player: { x: number; y: number }, minDist = 220, used: Array<{ x: number; y: number }> = []): { x: number; y: number } {
  const pc = cellOf(player.x, player.y); const start = blocksMove(cellAt(l, pc.c, pc.r)) ? cellOf(nearestFree(l, player.x, player.y).x, nearestFree(l, player.x, player.y).y) : pc;
  const reach = flood(l.grid, start, false);
  let best: { x: number; y: number } | null = null, bs = 1e18;
  for (let r = IN.r0; r <= IN.r1; r++) for (let c = IN.c0; c <= IN.c1; c++) {
    if (!reach[idx(c, r)]) continue; const p = cellCenter(c, r);
    const dp = Math.hypot(p.x - player.x, p.y - player.y); if (dp < minDist) continue;
    let adj = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (blocksMove(cellAt(l, c + dc, r + dr))) adj++;
    let crowd = 0; for (const u of used) if (Math.hypot(u.x - p.x, u.y - p.y) < 40) crowd++;
    const score = Math.hypot(p.x - want.x, p.y - want.y) + adj * 30 + crowd * 400 + (r === IN.r0 ? 200 : 0);
    if (score < bs) { bs = score; best = p; }
  }
  if (best) return best;
  // room too small for minDist: farthest reachable cell
  let far = cellCenter(13, 5), fd = -1;
  for (let r = IN.r0; r <= IN.r1; r++) for (let c = IN.c0; c <= IN.c1; c++) { if (!reach[idx(c, r)]) continue; const p = cellCenter(c, r); const d = Math.hypot(p.x - player.x, p.y - player.y); if (d > fd) { fd = d; far = p; } }
  return far;
}

// ---------------- navigation for ai.ts ----------------
/** What the AI needs from the room (ai.ts stays framework-free and works without it in unit tests). */
export interface NavGrid {
  walkable(x: number, y: number): boolean;
  /** sight / shot line between two points (low walls, rocks, pillars, bushes block; liquid does not) */
  los(ax: number, ay: number, bx: number, by: number): boolean;
  /** a body of radius `rad` can walk straight from a to b */
  clear(ax: number, ay: number, bx: number, by: number, rad?: number): boolean;
  /** heading (radians) of the shortest walkable path from (x,y) toward (tx,ty); null if same cell / unreachable */
  flowDir(x: number, y: number, tx: number, ty: number): number | null;
  nearestFree(x: number, y: number): { x: number; y: number };
}

/** BFS distance field toward the target cell, cached until the target changes cell. 8-neighbour, no corner cutting. */
export class RoomNav implements NavGrid {
  private dist = new Int16Array(COLS * ROWS); private target = -1;
  constructor(public layout: { grid: Uint8Array }) {}
  walkable(x: number, y: number) { return walkable(this.layout, x, y); }
  los(ax: number, ay: number, bx: number, by: number) { return lineClear(this.layout, ax, ay, bx, by, false); }
  clear(ax: number, ay: number, bx: number, by: number, rad = 0) { return lineClear(this.layout, ax, ay, bx, by, true, rad); }
  nearestFree(x: number, y: number) { return nearestFree(this.layout, x, y); }
  field(tx: number, ty: number): Int16Array {
    let { c, r } = cellOf(tx, ty); if (blocksMove(cellAt(this.layout, c, r))) { const n = nearestFree(this.layout, tx, ty); ({ c, r } = cellOf(n.x, n.y)); }
    const t = idx(c, r); if (t === this.target) return this.dist;
    this.target = t; const D = this.dist; D.fill(-1); D[t] = 0; const q = [t]; let h = 0;
    const g = this.layout.grid;
    while (h < q.length) {
      const i = q[h++]; const ic = i % COLS, ir = (i / COLS) | 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue; const cc = ic + dc, rr = ir + dr; if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
        const j = idx(cc, rr); if (D[j] >= 0 || blocksMove(g[j])) continue;
        if (dc && dr && (blocksMove(g[idx(ic + dc, ir)]) || blocksMove(g[idx(ic, ir + dr)]))) continue; // no corner cutting
        D[j] = D[i] + 1; q.push(j);
      }
    }
    return D;
  }
  flowDir(x: number, y: number, tx: number, ty: number): number | null {
    const D = this.field(tx, ty); const { c, r } = cellOf(x, y); const here = D[idx(c, r)] ?? -1;
    if (here === 0) return null;
    let best = -1, bd = here >= 0 ? here : 1e9;
    const g = this.layout.grid;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue; const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
      const j = idx(cc, rr); if (D[j] < 0) continue;
      if (dc && dr && (blocksMove(g[idx(c + dc, r)]) || blocksMove(g[idx(c, r + dr)]))) continue;
      const v = D[j] + (dc && dr ? 0.4 : 0); if (v < bd) { bd = v; best = j; }
    }
    if (best < 0) return null;
    const p = cellCenter(best % COLS, (best / COLS) | 0); return Math.atan2(p.y - y, p.x - x);
  }
}

// ---------------- room kind from the run ----------------
/** Map the run position onto a room kind (start / boss gate / node type + modifier + event). */
export function roomKindFor(pos: number | 'start' | 'gate', node?: { type: string; modifier: string; event: string | null } | null): RoomKind {
  if (pos === 'start') return 'start';
  if (pos === 'gate') return 'boss';
  if (!node) return 'combat';
  if (node.type === 'shop' || node.type === 'roots') return 'shop';
  if (node.modifier === 'miniboss' || node.modifier === 'derangement' || node.event === 'arena') return 'elite';
  if (node.event) return 'event';
  if (node.type === 'money' || node.type === 'artifact' || node.type === 'tablet' || node.type === 'dice') return 'treasure';
  return 'combat';
}

/** ASCII dump (dev / docs) */
export function ascii(l: RoomLayout): string {
  const m = ['.', 'R', 'P', 'B', 'W', '~', '#'];
  const lines: string[] = [];
  for (let r = 0; r < ROWS; r++) { let s = ''; for (let c = 0; c < COLS; c++) s += m[l.grid[idx(c, r)]]; lines.push(s); }
  return lines.join('\n');
}
