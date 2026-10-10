// v2 floor-map layout constants (docs/V2_MAP.md). Pure (no Phaser) so tests can check the geometry.
// Logical screen 1280×720 (Scale.FIT). The HUD layout (src/ui/hudLayout.ts, hud agent) stacks the pause / music / bag
// buttons around MINIMAP — its MINIMAP_BASE should equal MINIMAP below (integrator: point it here).
// Rule: the mini-map lives entirely in the top wall band (y < ROOM_TOP) and right of the last door slot, so it never
// covers a door, a door icon or the play area.

export interface Rect { x: number; y: number; w: number; h: number }
/** Safe edge margins of HUD chrome from the screen edge (logical px). Matches hudLayout MARGIN. */
export const SAFE = { l: 12, t: 8, r: 12, b: 12 } as const;
export const SCREEN = { w: 1280, h: 720 } as const;
/** Top of the walkable room (RunScene ROOM.y0). Everything above is the wall band with the doors. */
export const ROOM_TOP = 154;
/** Door slot centres on the top wall, one per map column (col 0/1/2); the gate door uses the centre slot. */
export const DOOR_X = [340, 640, 940] as const;
/** Door footprint incl. type disc and modifier badge (x ± 50 around the slot, y 52..148). */
export const DOOR_HALF_W = 50, DOOR_TOP = 52, DOOR_BOTTOM = 148;
export const doorRect = (col: number): Rect => ({ x: DOOR_X[col] - DOOR_HALF_W, y: DOOR_TOP, w: DOOR_HALF_W * 2, h: DOOR_BOTTOM - DOOR_TOP });

/** Expanded mini-map panel (top-right). */
export const MINIMAP: Rect = { x: SCREEN.w - SAFE.r - 206, y: SAFE.t, w: 206, h: 140 };
/** Collapsed mini-map chip (same top-right anchor). */
export const MINIMAP_COLLAPSED: Rect = { x: SCREEN.w - SAFE.r - 64, y: SAFE.t, w: 64, h: 56 };
/** Collapse / expand toggle inside the expanded panel (top-right corner). */
export const MINIMAP_TOGGLE: Rect = { x: MINIMAP.x + MINIMAP.w - 30, y: MINIMAP.y + 4, w: 26, h: 22 };
/** Optional touch "map" button for a HUD that wants one besides tapping the mini-map (≥ 96 px hit, see hudLayout TOUCH_MIN). */
export const MAP_BUTTON: Rect = { x: MINIMAP_COLLAPSED.x, y: MINIMAP_COLLAPSED.y, w: 64, h: 56 };

/** Mini-map node geometry: vertical, columns line up with the doors (left door = left lane), gate on top, start implied below. */
export const MINI = { cx: MINIMAP.x + MINIMAP.w / 2, colStep: 54, rowY: [MINIMAP.y + 124, MINIMAP.y + 95, MINIMAP.y + 66] as const, gateY: MINIMAP.y + 38, r: 11, gateR: 13, titleY: MINIMAP.y + 15 } as const;
export const miniNodePos = (col: number, depth: number) => ({ x: MINI.cx + (col - 1) * MINI.colStep, y: MINI.rowY[depth] });
export const miniGatePos = () => ({ x: MINI.cx, y: MINI.gateY });
export const miniStartPos = () => ({ x: MINI.cx, y: MINIMAP.y + MINIMAP.h + 6 }); // just below the panel (edges are clipped to it)

/** Full-screen map overlay geometry (vertical like the mini-map; legend column on the right). */
export const FULLMAP = { cx: 520, colStep: 190, rowY: [520, 400, 280] as const, gateY: 160, startY: 630, r: 34, gateR: 42, legendX: 900, legendY: 150 } as const;
export const fullNodePos = (col: number, depth: number) => ({ x: FULLMAP.cx + (col - 1) * FULLMAP.colStep, y: FULLMAP.rowY[depth] });
export const fullGatePos = () => ({ x: FULLMAP.cx, y: FULLMAP.gateY });
export const fullStartPos = () => ({ x: FULLMAP.cx, y: FULLMAP.startY });

export const rectsOverlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const pointIn = (x: number, y: number, r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
