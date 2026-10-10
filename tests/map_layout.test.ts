import { describe, it, expect } from 'vitest';
import { MINIMAP, MINIMAP_COLLAPSED, MINIMAP_TOGGLE, MINI, FULLMAP, ROOM_TOP, DOOR_X, SCREEN, SAFE, doorRect, rectsOverlap, pointIn, miniNodePos, miniGatePos, fullNodePos, fullGatePos, fullStartPos } from '../src/ui/layout';
import fs from 'node:fs'; import path from 'node:path';
const ROOM = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/scenes/RunScene.ts'), 'utf8').match(/export const ROOM = (\{[^}]+\})/)![1].replace(/(\w+):/g, '"$1":'));

describe('map layout (docs/V2_MAP.md)', () => {
  it('mini-map stays in the top wall band, inside the safe margins, clear of every door slot', () => {
    for (const R of [MINIMAP, MINIMAP_COLLAPSED]) {
      expect(R.y + R.h).toBeLessThan(ROOM_TOP); expect(R.x + R.w).toBeLessThanOrEqual(SCREEN.w - SAFE.r); expect(R.y).toBeGreaterThanOrEqual(SAFE.t);
      for (let c = 0; c < DOOR_X.length; c++) expect(rectsOverlap(R, doorRect(c))).toBe(false);
    }
    expect(pointIn(MINIMAP_TOGGLE.x, MINIMAP_TOGGLE.y, MINIMAP) && pointIn(MINIMAP_TOGGLE.x + MINIMAP_TOGGLE.w, MINIMAP_TOGGLE.y + MINIMAP_TOGGLE.h, MINIMAP)).toBe(true);
  });
  it('mini-map nodes fit the panel and do not touch each other', () => {
    const pts = [miniGatePos(), ...[0, 1, 2].flatMap((d) => [0, 1, 2].map((c) => miniNodePos(c, d)))];
    for (const p of pts) { expect(p.x - MINI.gateR - 3).toBeGreaterThanOrEqual(MINIMAP.x); expect(p.x + MINI.gateR + 3).toBeLessThanOrEqual(MINIMAP.x + MINIMAP.w); expect(p.y - MINI.r - 3).toBeGreaterThan(MINI.titleY + 6); expect(p.y + MINI.r + 3).toBeLessThanOrEqual(MINIMAP.y + MINIMAP.h); }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThan(2 * MINI.r + 4);
  });
  it('full map graph stays inside the card and left of the legend', () => {
    const pts = [fullGatePos(), fullStartPos(), ...[0, 1, 2].flatMap((d) => [0, 1, 2].map((c) => fullNodePos(c, d)))];
    for (const p of pts) { expect(p.x - FULLMAP.gateR).toBeGreaterThan(50); expect(p.x + FULLMAP.r + 60).toBeLessThan(FULLMAP.legendX - 14); expect(p.y - FULLMAP.gateR).toBeGreaterThan(90); expect(p.y + FULLMAP.r).toBeLessThan(690); }
  });
  it('door slots sit on the wall inside the room width', () => { expect(ROOM.y0).toBe(ROOM_TOP); for (const x of DOOR_X) { expect(x).toBeGreaterThan(ROOM.x0); expect(x).toBeLessThan(ROOM.x1); } });
});
