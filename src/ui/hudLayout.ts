// v2 HUD layout: one place for every screen-space rect of the in-run HUD, the touch controls and the hub chrome.
// Pure (no Phaser) so it is unit-tested in tests/hudLayout.test.ts. Logical screen is always 1280×720
// (Phaser Scale.FIT, see docs/V2_HUD_LAYOUT.md); `Insets` are the Android/iOS safe-area insets already converted
// to logical px (src/ui/safeArea.ts) — almost always 0 under FIT, because the letterbox already covers notches.

import { MINIMAP, DOOR_X, DOOR_HALF_W } from './layout';

export const SCREEN = { w: 1280, h: 720 } as const;
/** Edge margin of every HUD element from the safe rect (logical px). */
export const MARGIN = 12;
/** Gap between neighbouring HUD groups. */
export const GAP = 8;
/** Minimum touch hit diameter in logical px: 48 dp on a 360 dp-tall landscape phone (720 / 360 × 48 = 96). */
export const TOUCH_MIN = 96;

export interface Insets { l: number; t: number; r: number; b: number }
export interface Rect { x: number; y: number; w: number; h: number }
export const ZERO_INSETS: Insets = { l: 0, t: 0, r: 0, b: 0 };

/** Mini-map panel rect at zero insets — owned by the floor-map layout (src/ui/layout.ts MINIMAP, expanded state);
 *  the HUD only stacks the pause / music / bag buttons around it. */
export const MINIMAP_BASE: Rect = { ...MINIMAP };
/** Right-most door slot footprint (layout.ts): HUD chrome in the top band must stay right of it. */
export const DOOR_RIGHT_EDGE = DOOR_X[2] + DOOR_HALF_W;

export function safeRect(ins: Insets = ZERO_INSETS): Rect {
  return { x: ins.l, y: ins.t, w: SCREEN.w - ins.l - ins.r, h: SCREEN.h - ins.t - ins.b };
}
export const minimapRect = (ins: Insets = ZERO_INSETS): Rect => ({ ...MINIMAP_BASE, x: MINIMAP_BASE.x - ins.r, y: MINIMAP_BASE.y + ins.t });

// ---------------------------------------------------------------- quick bar (potion belt + 3 skill slots)
export const SLOT = 48; export const SLOT_STEP = 60; export const BAR_H = 70;
/** Bottom-left belt: `nPot` potion slots then spell 1 / spell 2 / special (10 px extra gap before the skills). */
export function quickBar(ins: Insets, nPot: number) {
  const x = MARGIN + ins.l, y = SCREEN.h - MARGIN - ins.b - BAR_H; const w = SLOT_STEP * nPot + 200;
  const cy = y + BAR_H / 2; const px = (i: number) => x + 34 + i * SLOT_STEP; const sx = (i: number) => x + 34 + nPot * SLOT_STEP + 10 + i * SLOT_STEP;
  return { rect: { x, y, w, h: BAR_H } as Rect, cy, potX: px, skillX: sx };
}

// ---------------------------------------------------------------- touch controls (right-thumb cluster)
export type TouchId = 'attack' | 'dash' | 'guard' | 'special' | 'spell1' | 'spell2' | 'potion' | 'interact';
export interface TouchBtn { id: TouchId; x: number; y: number; /** visual radius */ r: number; /** hit radius (≥ TOUCH_MIN / 2) */ hit: number; icon: string; label: string }
const ATTACK_HIT = 64; const INNER_R = 140; const OUTER_R = 245;
/** Attack sits in the bottom-right corner; an inner arc (dash, special, guard) and an outer arc (spell 1, spell 2,
 *  potion, interact) fan around it so every hit circle is ≥ 96 px and none overlap each other or the quick bar. */
export function touchLayout(ins: Insets = ZERO_INSETS): Record<TouchId, TouchBtn> {
  const ax = SCREEN.w - ins.r - MARGIN - ATTACK_HIT, ay = SCREEN.h - ins.b - MARGIN - ATTACK_HIT;
  const at = (deg: number, R: number) => { const a = deg * Math.PI / 180; return { x: Math.round(ax + Math.cos(a) * R), y: Math.round(ay + Math.sin(a) * R) }; };
  const h = TOUCH_MIN / 2;
  const B = (id: TouchId, p: { x: number; y: number }, r: number, icon: string, label: string, hit = h): TouchBtn => ({ id, x: p.x, y: p.y, r, hit: Math.max(hit, r), icon, label });
  return {
    attack: B('attack', { x: ax, y: ay }, 60, 'btn_attack', 'Đánh', ATTACK_HIT),
    dash: B('dash', at(180, INNER_R), 46, 'btn_dash', 'Lướt'),
    special: B('special', at(222, INNER_R), 46, 'btn_special', 'Kỹ năng'),
    guard: B('guard', at(264, INNER_R), 44, 'wpn_shield', 'Đỡ'),
    spell1: B('spell1', at(190, OUTER_R), 42, 'btn_special', 'Phép 1'),
    spell2: B('spell2', at(215, OUTER_R), 42, 'btn_special', 'Phép 2'),
    potion: B('potion', at(240, OUTER_R), 40, 'btn_potion', 'Bình'),
    interact: B('interact', at(265, OUTER_R), 40, 'btn_map', 'Dùng'),
  };
}
/** Where a touch may start the floating joystick: left half, below the top HUD band, not on the quick bar. */
export function inJoystickZone(x: number, y: number, ins: Insets, nPot: number): boolean {
  const q = quickBar(ins, nPot).rect; if (x >= SCREEN.w / 2 || x < ins.l || y < ins.t + 104 || y > SCREEN.h - ins.b) return false;
  return !(x >= q.x - GAP && x <= q.x + q.w + GAP && y >= q.y - 30 - GAP); // weapon label sits 24 px above the bar
}
export const JOY = { base: 66, knob: 30, travel: 60 } as const; // travel = full-speed drag distance in Controls.update

// ---------------------------------------------------------------- in-run HUD
export interface HudLayout {
  left: number; top: number; right: number;
  hpIcon: { x: number; y: number }; mpIcon: { x: number; y: number };
  hp: Rect; mp: Rect; xp: Rect; lvl: { x: number; y: number }; dash: { x: number; y: number; step: number };
  pills: { money: { x: number; y: number; w: number }; saph: { x: number; y: number; w: number }; dice: { x: number; y: number; w: number } };
  status: { x: number; y: number };
  pause: Rect; music: Rect; bag: Rect;
  /** combos list + miracle row: right column under the bag (desktop) or left column under the bars (touch: the right
   *  side is the thumb cluster). */
  combos: { x: number; y: number; align: 'left' | 'right' }; miracles: { x: number; y: number; step: number };
  weaponLabel: { x: number; y: number }; boss: { x: number; y: number; w: number };
  minimap: Rect; tooltipMin: { x: number; y: number }; tooltipMax: { x: number; y: number };
}
export function hudLayout(ins: Insets = ZERO_INSETS, touch = false, nPot = 2): HudLayout {
  const L = MARGIN + ins.l, T = MARGIN + ins.t, R = SCREEN.w - MARGIN - ins.r; const mm = minimapRect(ins);
  // pause over music in one column between the last door slot (x ≤ 990) and the mini-map, so neither covers a door
  const btn = { w: 54, h: 50 };
  let pause: Rect = { x: mm.x - MARGIN - btn.w, y: T - 4, w: btn.w, h: btn.h };
  let music: Rect = { x: pause.x, y: pause.y + btn.h + GAP, w: btn.w, h: btn.h };
  const bagS = touch ? { w: 80, h: 76 } : { w: 64, h: 60 };
  const bag: Rect = { x: R - bagS.w + 2, y: mm.y + mm.h + 12, w: bagS.w, h: bagS.h };
  if (pause.x < DOOR_RIGHT_EDGE) { // a right-side safe inset pushed the mini-map left: the column would cover a door → row left of the bag
    pause = { x: bag.x - GAP - btn.w, y: bag.y + (bag.h - btn.h) / 2, w: btn.w, h: btn.h }; music = { ...pause, x: pause.x - GAP - btn.w };
  }
  const q = quickBar(ins, nPot);
  const statusY = T + 98;
  const combos = touch ? { x: L + 4, y: statusY + 24, align: 'left' as const } : { x: R - 2, y: bag.y + bag.h + 14, align: 'right' as const };
  return {
    left: L, top: T, right: R,
    hpIcon: { x: L + 18, y: T + 20 }, mpIcon: { x: L + 18, y: T + 54 },
    hp: { x: L + 34, y: T + 8, w: 210, h: 24 }, mp: { x: L + 34, y: T + 42, w: 170, h: 20 }, xp: { x: L + 34, y: T + 70, w: 170, h: 12 },
    lvl: { x: L + 212, y: T + 64 }, dash: { x: L + 218, y: T + 52, step: 18 },
    pills: { money: { x: L + 278, y: T + 20, w: 120 }, saph: { x: L + 418, y: T + 20, w: 100 }, dice: { x: L + 538, y: T + 20, w: 90 } },
    status: { x: L + 4, y: statusY },
    pause, music, bag, combos,
    miracles: touch ? { x: L + 20, y: 0, step: 36 } : { x: R - 18, y: 0, step: -36 },
    weaponLabel: { x: L + 6, y: q.rect.y - 24 }, boss: { x: SCREEN.w / 2, y: Math.max(190, T + 178), w: 600 },
    minimap: mm, tooltipMin: { x: ins.l + 4, y: ins.t + 4 }, tooltipMax: { x: SCREEN.w - ins.r - 4, y: SCREEN.h - ins.b - 4 },
  };
}

// ---------------------------------------------------------------- safe-area conversion (pure part of safeArea.ts)
/** CSS safe-area insets (CSS px, relative to the viewport) → logical game px, given the FIT canvas rect.
 *  Only the part of an inset that reaches *into* the canvas counts (the FIT letterbox already absorbs the rest). */
export function toGameInsets(css: Insets, canvas: { left: number; top: number; width: number; height: number }, viewport: { w: number; h: number }): Insets {
  if (canvas.width <= 0 || canvas.height <= 0) return { ...ZERO_INSETS };
  const sx = SCREEN.w / canvas.width, sy = SCREEN.h / canvas.height;
  const cr = viewport.w - (canvas.left + canvas.width), cb = viewport.h - (canvas.top + canvas.height);
  const f = (v: number) => Math.max(0, Math.round(v));
  return { l: f((css.l - canvas.left) * sx), t: f((css.t - canvas.top) * sy), r: f((css.r - cr) * sx), b: f((css.b - cb) * sy) };
}
/** Logical px that make up `dp` CSS px on a canvas `cssHeight` CSS px tall (FIT keeps 720 logical rows). */
export const dpToGame = (dp: number, cssHeight: number) => cssHeight > 0 ? dp * SCREEN.h / cssHeight : dp;

// ---------------------------------------------------------------- geometry helpers (tests + debug)
export const rectsOverlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const circleRectOverlap = (c: { x: number; y: number; r: number }, b: Rect) => {
  const nx = Math.max(b.x, Math.min(c.x, b.x + b.w)), ny = Math.max(b.y, Math.min(c.y, b.y + b.h)); return Math.hypot(c.x - nx, c.y - ny) < c.r;
};
export const rectInside = (a: Rect, outer: Rect) => a.x >= outer.x && a.y >= outer.y && a.x + a.w <= outer.x + outer.w && a.y + a.h <= outer.y + outer.h;
