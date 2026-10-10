import { describe, it, expect } from 'vitest';
import {
  buildRoom, validate, flood, cellOf, idx, cellAt, CellK, COLS, ROWS, IN, TILE, ANCHORS, DOOR_XS, TEMPLATES, PW, PH,
  entryOf, safeSpawn, resolveCircle, walkable, shotBlocked, lineClear, RoomNav, roomKindFor, blockRects, nearestFree,
  type RoomKind, type RoomSpec,
} from '../src/systems/roomgen';
import { AiWorld, newAgent } from '../src/systems/ai';
import { Rng } from '../src/systems/rng';

const KINDS: RoomKind[] = ['start', 'combat', 'elite', 'treasure', 'event', 'shop', 'boss'];
const EVENTS = ['clover', 'merchant', 'obelisk', 'fountain', 'companion', 'blood', 'pocket', 'secret', 'arena'];
const SEEDS = 150;
function specs(): RoomSpec[] {
  const out: RoomSpec[] = [];
  for (let ch = 1; ch <= 6; ch++) for (const kind of KINDS) for (let s = 0; s < SEEDS; s++) {
    out.push({ kind, chapter: ch, seed: (s * 2654435761 + ch * 97) >>> 0, miniBoss: kind === 'elite' && s % 2 === 0, event: kind === 'event' || (kind === 'elite' && s % 3 === 0) ? EVENTS[s % EVENTS.length] : null });
  }
  return out;
}
const ALL = specs();

describe('roomgen templates', () => {
  it('every template is 21×7 with known glyphs', () => {
    for (const t of TEMPLATES) {
      expect(t.rows.length, t.id).toBe(PH);
      for (const r of t.rows) { expect(r.length, t.id).toBe(PW); expect(/^[.RPBW~?]+$/.test(r), t.id).toBe(true); }
    }
  });
  it('every room kind × chapter has templates or the procedural fallback', () => {
    for (let ch = 1; ch <= 6; ch++) for (const k of KINDS) expect(TEMPLATES.some((t) => t.kinds.includes(k) && (!t.chapters || t.chapters.includes(ch))), `${k} ch${ch}`).toBe(true);
    for (let ch = 1; ch <= 6; ch++) expect(TEMPLATES.some((t) => t.chapters?.includes(ch)), `signature ch${ch}`).toBe(true);
  });
});

describe('roomgen reachability (flood fill, many seeds × chapters × room types)', () => {
  it(`${ALL.length} layouts validate: no pockets, doors + anchors reachable, also for big bodies`, () => {
    const bad: string[] = [];
    for (const sp of ALL) { const l = buildRoom(sp); const v = validate(l, sp); if (!v.ok) bad.push(`${sp.kind} ch${sp.chapter} ${sp.seed} ${l.template}: ${v.reasons.join(',')}`); }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  it('every walkable cell is reachable from the entry and every anchor / door stays clear', () => {
    for (const sp of ALL.filter((_, i) => i % 3 === 0)) {
      const l = buildRoom(sp); const e = cellOf(entryOf(sp).x, entryOf(sp).y);
      const seen = flood(l.grid, e, false);
      for (let i = 0; i < l.grid.length; i++) if (l.grid[i] === CellK.Floor) expect(seen[i], `${sp.kind} ${sp.seed} cell ${i}`).toBe(1);
      for (const a of l.anchors) { const c = cellOf(a.x, a.y); expect(cellAt(l, c.c, c.r)).toBe(CellK.Floor); }
      if (sp.kind !== 'boss') for (const x of DOOR_XS) { const c = cellOf(x, IN.r0 * TILE + 24); expect(seen[idx(c.c, c.r)]).toBe(1); }
      // reward / chest / altar / shop-stall spot always walkable and reachable
      const rw = cellOf(ANCHORS.reward.x, ANCHORS.reward.y); expect(seen[idx(rw.c, rw.r)]).toBe(1);
      // the door lane (row 3) and the entry lane (row 13) are open wherever the room is
      for (let c = IN.c0; c <= IN.c1; c++) { const k = cellAt(l, c, IN.r0); expect(k === CellK.Floor || k === CellK.Edge).toBe(true); }
    }
  });
  it('mini-boss / event / secret anchors are reachable when the room has them', () => {
    for (const sp of ALL.filter((s) => s.miniBoss || s.event)) {
      const l = buildRoom(sp); const fat = flood(l.grid, cellOf(entryOf(sp).x, entryOf(sp).y), true);
      if (sp.miniBoss) { const c = cellOf(ANCHORS.miniBoss.x, ANCHORS.miniBoss.y); expect(fat[idx(c.c, c.r)]).toBe(1); const d = cellOf(ANCHORS.miniDrop.x, ANCHORS.miniDrop.y); expect(fat[idx(d.c, d.r)]).toBe(1); }
      if (sp.event) { const c = cellOf(ANCHORS.event.x, ANCHORS.event.y); expect(fat[idx(c.c, c.r)]).toBe(1); }
      if (sp.event === 'secret') { expect(l.trim).toBe(0); const c = cellOf(ANCHORS.secret.x, ANCHORS.secret.y); expect(fat[idx(c.c, c.r)]).toBe(1); }
    }
  });
  it('is deterministic per seed', () => {
    for (const sp of ALL.slice(0, 200)) expect(Array.from(buildRoom(sp).grid)).toEqual(Array.from(buildRoom(sp).grid));
  });
});

describe('roomgen shape rules', () => {
  it('combat rooms actually have cover (not flat grass) and vary between templates / sizes', () => {
    for (let ch = 1; ch <= 6; ch++) {
      const ids = new Set<string>(); const trims = new Set<number>(); let withCover = 0, n = 0;
      for (let s = 0; s < 200; s++) {
        const l = buildRoom({ kind: 'combat', chapter: ch, seed: s * 31 + 7 }); n++;
        ids.add(l.template.split('/')[0]); trims.add(l.trim);
        if (l.obstacles.filter((o) => o.kind !== 'liquid').length >= 4) withCover++;
      }
      expect(ids.size, `ch${ch} templates`).toBeGreaterThanOrEqual(8);
      expect(trims.size, `ch${ch} sizes`).toBeGreaterThanOrEqual(2);
      expect(withCover / n, `ch${ch} cover share`).toBeGreaterThan(0.85);
    }
  });
  it('room sizes differ by type (shop < treasure < combat ≤ elite/boss)', () => {
    const free = (k: RoomKind) => { let t = 0; for (let s = 0; s < 40; s++) { const l = buildRoom({ kind: k, chapter: 2, seed: s }); t += IN.c1 - IN.c0 + 1 - 2 * l.trim; } return t / 40; };
    expect(free('shop')).toBeLessThan(free('treasure'));
    expect(free('treasure')).toBeLessThan(free('combat'));
    expect(free('combat')).toBeLessThanOrEqual(free('boss'));
  });
  it('boss arenas keep an open readable middle (no obstacle within 4 cells of the boss spawn / 3 rows of the entry)', () => {
    for (const sp of ALL.filter((s) => s.kind === 'boss')) {
      const l = buildRoom(sp); const b = cellOf(ANCHORS.boss.x, ANCHORS.boss.y);
      for (const o of l.obstacles) expect(Math.max(Math.abs(o.c - b.c) / 2.5, Math.abs(o.r - b.r)) >= 3 || Math.abs(o.c - b.c) >= 9, `${sp.seed} ${o.c},${o.r}`).toBe(true);
      expect(l.obstacles.length).toBeLessThanOrEqual(12);
    }
  });
  it('obstacles get chapter props; liquid/walls are tiles', () => {
    for (const sp of ALL.filter((_, i) => i % 7 === 0)) {
      const l = buildRoom(sp);
      for (const o of l.obstacles) {
        if (o.kind === 'rock' || o.kind === 'pillar' || o.kind === 'bush') expect(o.key?.startsWith(`prop_ch${sp.chapter}_`), o.key).toBe(true);
        else expect(o.key).toBeUndefined();
      }
    }
  });
  it('roomKindFor maps run positions', () => {
    expect(roomKindFor('start')).toBe('start'); expect(roomKindFor('gate')).toBe('boss');
    expect(roomKindFor(0, { type: 'shop', modifier: 'none', event: null })).toBe('shop');
    expect(roomKindFor(0, { type: 'roots', modifier: 'none', event: null })).toBe('shop');
    expect(roomKindFor(0, { type: 'levelup', modifier: 'miniboss', event: null })).toBe('elite');
    expect(roomKindFor(0, { type: 'levelup', modifier: 'none', event: 'arena' })).toBe('elite');
    expect(roomKindFor(0, { type: 'anvil', modifier: 'none', event: 'clover' })).toBe('event');
    expect(roomKindFor(0, { type: 'money', modifier: 'none', event: null })).toBe('treasure');
    expect(roomKindFor(0, { type: 'anvil', modifier: 'none', event: null })).toBe('combat');
  });
});

describe('roomgen collision + spawn helpers', () => {
  const rooms = ALL.filter((s) => s.kind === 'combat' || s.kind === 'elite' || s.kind === 'event').filter((_, i) => i % 5 === 0).map((s) => ({ s, l: buildRoom(s) }));
  it('safe spawns: never inside obstacles, reachable, ≥ 220 px from the hero, spread out', () => {
    const rng = new Rng(9);
    for (const { s, l } of rooms) {
      const hero = entryOf(s); const used: Array<{ x: number; y: number }> = [];
      const reach = flood(l.grid, cellOf(hero.x, hero.y), false);
      for (let i = 0; i < 10; i++) {
        const want = { x: rng.range(80, 1200), y: rng.range(170, 650) };
        const p = safeSpawn(l, want, hero, 220, used); used.push(p);
        expect(walkable(l, p.x, p.y)).toBe(true);
        const c = cellOf(p.x, p.y); expect(reach[idx(c.c, c.r)]).toBe(1);
        expect(Math.hypot(p.x - hero.x, p.y - hero.y)).toBeGreaterThanOrEqual(220);
      }
      expect(new Set(used.map((u) => `${u.x},${u.y}`)).size).toBe(10);
    }
  });
  it('resolveCircle pushes bodies out of every obstacle cell; blockRects cover the blocked cells', () => {
    for (const { l } of rooms.slice(0, 40)) {
      const rects = blockRects(l);
      for (const o of l.obstacles) {
        const x = o.c * TILE + 24, y = o.r * TILE + 24;
        const r = resolveCircle(l, x, y, 16); expect(r.hit).toBe(true); expect(walkable(l, r.x, r.y)).toBe(true);
        expect(rects.some((b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1)).toBe(true);
        expect(walkable(l, nearestFree(l, x, y).x, nearestFree(l, x, y).y)).toBe(true);
      }
    }
  });
  it('shots: rocks / pillars / bushes / walls block, liquid does not', () => {
    for (const { l } of rooms.slice(0, 60)) for (const o of l.obstacles) {
      const x = o.c * TILE + 24, y = o.r * TILE + 24;
      expect(shotBlocked(l, x, y)).toBe(o.kind !== 'liquid');
      expect(walkable(l, x, y)).toBe(false);
    }
    // a line through a wall is blocked for sight, a line over liquid is clear for sight but not for walking
    const g = buildRoom({ kind: 'combat', chapter: 1, seed: 1 }); g.grid.fill(CellK.Floor);
    for (let r = 0; r < ROWS; r++) { g.grid[idx(10, r)] = CellK.Wall; g.grid[idx(16, r)] = CellK.Liquid; }
    expect(lineClear(g, 300, 400, 700, 400)).toBe(false);
    expect(lineClear(g, 600, 400, 1000, 400)).toBe(true);
    expect(lineClear(g, 600, 400, 1000, 400, true)).toBe(false);
  });
  it('flow field: following flowDir from any reachable cell reaches the target', () => {
    for (const { s, l } of rooms.slice(0, 30)) {
      const nav = new RoomNav(l); const target = entryOf(s); const tc = cellOf(target.x, target.y);
      const reach = flood(l.grid, tc, false);
      for (let i = 0; i < l.grid.length; i += 3) {
        if (!reach[i]) continue; let c = i % COLS, r = (i / COLS) | 0; let steps = 0;
        while ((c !== tc.c || r !== tc.r) && steps < 200) {
          const p = { x: c * TILE + 24, y: r * TILE + 24 }; const h = nav.flowDir(p.x, p.y, target.x, target.y); if (h === null) break;
          const nc = cellOf(p.x + Math.cos(h) * TILE, p.y + Math.sin(h) * TILE); expect(cellAt(l, nc.c, nc.r)).toBe(CellK.Floor); c = nc.c; r = nc.r; steps++;
        }
        expect(c === tc.c && r === tc.r, `${s.seed} from ${i}`).toBe(true);
      }
    }
  });
});

describe('ai.ts obstacle steering (no getting stuck)', () => {
  function simulate(l: ReturnType<typeof buildRoom>, ai: 'chaser' | 'charger' | 'shooter' | 'shielded', from: { x: number; y: number }, player: { x: number; y: number }, secs = 14) {
    const w = new AiWorld(1, false, { x0: 62, y0: 154, x1: 1234, y1: 664 }, true); w.nav = new RoomNav(l);
    const a = newAgent(ai, from.x, from.y, 90, 50, ai === 'shooter' ? { keepDistance: 200 } : {}); a.radius = 16;
    const rng = new Rng(5); let best = 1e9; const dt = 1 / 30; let inside = 0;
    for (let t = 0; t < secs; t += dt) {
      w.beginFrame(dt, [{ agent: a, radius: 16 }]);
      w.think(a, player, dt, rng);
      a.x += a.vx * dt; a.y += a.vy * dt;
      a.x = Math.max(62 + 16, Math.min(1234 - 16, a.x)); a.y = Math.max(154 + 8, Math.min(664 - 4, a.y));
      const rc = resolveCircle(l, a.x, a.y, 11); a.x = rc.x; a.y = rc.y;
      if (!walkable(l, a.x, a.y)) inside++;
      best = Math.min(best, Math.hypot(a.x - player.x, a.y - player.y));
    }
    return { best, inside, los: lineClear(l, a.x, a.y - 14, player.x, player.y - 14) };
  }
  // a hard case: a long wall between the enemy and the player with gaps only at the ends
  function wallRoom() {
    const l = buildRoom({ kind: 'combat', chapter: 1, seed: 3 }); for (let i = 0; i < l.grid.length; i++) if (l.grid[i] !== CellK.Edge) l.grid[i] = CellK.Floor;
    for (let c = 4; c <= 22; c++) l.grid[idx(c, 8)] = CellK.Wall;
    for (let r = 5; r <= 8; r++) l.grid[idx(4, r)] = CellK.Wall; // U-shape trap opening north
    for (let r = 5; r <= 8; r++) l.grid[idx(22, r)] = CellK.Wall;
    return l;
  }
  it('melee enemies path around a U-shaped wall to reach the player', () => {
    const l = wallRoom();
    for (const ai of ['chaser', 'charger', 'shielded'] as const) {
      const r = simulate(l, ai, { x: 640, y: 300 }, { x: 640, y: 560 });
      expect(r.inside, ai).toBe(0);
      expect(r.best, ai).toBeLessThan(150);
    }
  });
  it('ranged enemies reposition until they have line of sight', () => {
    const l = wallRoom();
    const r = simulate(l, 'shooter', { x: 640, y: 300 }, { x: 640, y: 560 });
    expect(r.inside).toBe(0); expect(r.los).toBe(true);
  });
  it('across generated rooms, chasers reach the hero from far spawns', () => {
    let fails = 0, n = 0;
    for (const sp of ALL.filter((s) => s.kind === 'combat' && s.seed % 4 === 0).slice(0, 60)) {
      const l = buildRoom(sp); const hero = entryOf(sp);
      const spawn = safeSpawn(l, { x: 640, y: 200 }, hero, 300);
      const r = simulate(l, 'chaser', spawn, hero, 16); n++;
      expect(r.inside).toBe(0);
      if (r.best > 160) fails++;
    }
    expect(fails / n).toBeLessThan(0.05);
  });
  it('without a nav grid the AI behaves as before (open arena)', () => {
    const w = new AiWorld(1, false, undefined, true); const a = newAgent('chaser', 300, 300, 90, 50);
    expect(w.nav).toBeNull(); expect(w.hasLine(a, { x: 600, y: 300 })).toBe(true);
  });
});
