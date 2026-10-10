// v2 HUD layout geometry (src/ui/hudLayout.ts): touch targets ≥ 48 dp, no overlaps, everything inside the safe rect.
import { describe, it, expect } from 'vitest';
import { touchLayout, hudLayout, quickBar, safeRect, toGameInsets, dpToGame, inJoystickZone, rectsOverlap, circleRectOverlap, rectInside, TOUCH_MIN, SCREEN, DOOR_RIGHT_EDGE, type Insets, type Rect } from '../src/ui/hudLayout';
import { MINIMAP, ROOM_TOP } from '../src/ui/layout';

const INSETS: Array<[string, Insets]> = [
  ['none', { l: 0, t: 0, r: 0, b: 0 }],
  ['left notch', { l: 40, t: 0, r: 0, b: 0 }],
  ['right notch + gesture bar', { l: 0, t: 0, r: 44, b: 18 }],
  ['both sides', { l: 36, t: 10, r: 36, b: 12 }],
];
const circleRect = (c: { x: number; y: number; hit: number }): Rect => ({ x: c.x - c.hit, y: c.y - c.hit, w: c.hit * 2, h: c.hit * 2 });

describe('touch controls', () => {
  for (const [name, ins] of INSETS) {
    it(`hit circles ≥ ${TOUCH_MIN}px, inside the safe rect, no overlaps (${name})`, () => {
      const L = Object.values(touchLayout(ins)); const safe = safeRect(ins);
      for (const b of L) {
        expect(b.hit * 2, b.id).toBeGreaterThanOrEqual(TOUCH_MIN);
        expect(b.hit, b.id).toBeGreaterThanOrEqual(b.r);
        expect(rectInside(circleRect(b), safe), `${b.id} inside safe rect`).toBe(true);
      }
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j]; expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}/${b.id}`).toBeGreaterThanOrEqual(a.hit + b.hit);
      }
    });
    it(`never covers the quick bar, bag, pause/music, mini-map or the joystick zone (${name})`, () => {
      const L = Object.values(touchLayout(ins));
      for (const touch of [true, false]) for (const nPot of [1, 2, 3, 4, 5]) {
        const H = hudLayout(ins, touch, nPot); const q = quickBar(ins, nPot).rect;
        for (const b of L) {
          const c = { x: b.x, y: b.y, r: b.hit };
          for (const [nm, r] of [['quickbar', q], ['bag', H.bag], ['pause', H.pause], ['music', H.music], ['minimap', H.minimap]] as Array<[string, Rect]>) expect(circleRectOverlap(c, r), `${b.id} vs ${nm} (${nPot} potions)`).toBe(false);
          expect(inJoystickZone(b.x, b.y, ins, nPot), `${b.id} in joystick zone`).toBe(false);
        }
      }
    });
  }
  it('48 dp holds on a 360 dp-tall landscape phone (worst common case)', () => {
    expect(dpToGame(48, 360)).toBeLessThanOrEqual(TOUCH_MIN);
    // 2400×1080 @ 2.625 DPR → 411 dp tall → 48 dp = 84 logical px < 96
    expect(dpToGame(48, 1080 / 2.625)).toBeLessThan(TOUCH_MIN);
  });
});

describe('HUD chrome', () => {
  for (const [name, ins] of INSETS) for (const touch of [false, true]) {
    it(`groups do not overlap and stay in the safe rect (${name}, ${touch ? 'touch' : 'desktop'})`, () => {
      const H = hudLayout(ins, touch, 3); const safe = safeRect(ins); const q = quickBar(ins, 3).rect;
      const top: Rect = { x: H.hpIcon.x - 16, y: H.hp.y, w: H.pills.dice.x + H.pills.dice.w - H.hpIcon.x + 16, h: H.xp.y + H.xp.h - H.hp.y };
      const pills: Rect = { x: H.pills.money.x - 20, y: H.pills.money.y - 18, w: H.pills.dice.x + H.pills.dice.w - H.pills.money.x + 20, h: 36 };
      const named: Array<[string, Rect]> = [['bars+pills', top], ['pause', H.pause], ['music', H.music], ['bag', H.bag], ['quickbar', q], ['minimap', H.minimap]];
      for (const [n, r] of named) expect(rectInside(r, safe), `${n} inside`).toBe(true);
      for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) expect(rectsOverlap(named[i][1], named[j][1]), `${named[i][0]} / ${named[j][0]}`).toBe(false);
      expect(rectsOverlap(pills, H.music) || rectsOverlap(pills, H.pause)).toBe(false);
      // boss bar sits below the wall band and clear of the mini-map and the quick bar
      const boss: Rect = { x: H.boss.x - H.boss.w / 2, y: H.boss.y - 34, w: H.boss.w, h: 50 };
      expect(rectsOverlap(boss, H.minimap) || rectsOverlap(boss, q)).toBe(false);
      expect(H.boss.y - 34).toBeGreaterThanOrEqual(ROOM_TOP - 10);
    });
  }
  it('pause / music never cover a door slot (any inset) and sit left of the mini-map at zero insets', () => {
    for (const [, ins] of INSETS) for (const touch of [false, true]) { const H = hudLayout(ins, touch);
      for (const r of [H.pause, H.music]) expect(r.x >= DOOR_RIGHT_EDGE || r.y >= ROOM_TOP, JSON.stringify(ins)).toBe(true); }
    const H = hudLayout({ l: 0, t: 0, r: 0, b: 0 }, true); expect(H.pause.x).toBeGreaterThanOrEqual(DOOR_RIGHT_EDGE); expect(H.pause.x + H.pause.w).toBeLessThanOrEqual(MINIMAP.x);
  });
  it('mini-map rect follows the floor-map layout', () => { expect(hudLayout().minimap).toEqual(MINIMAP); });
  it('quick bar slots: potions then three skills with the extra 10 px gap', () => {
    const q = quickBar({ l: 0, t: 0, r: 0, b: 0 }, 2);
    expect(q.rect).toEqual({ x: 12, y: 638, w: 320, h: 70 }); expect(q.potX(0)).toBe(46); expect(q.skillX(0)).toBe(46 + 120 + 10); expect(q.skillX(2) + 24).toBeLessThanOrEqual(q.rect.x + q.rect.w);
  });
});

describe('safe-area conversion', () => {
  it('a notch inside the 20:9 pillarbox costs nothing', () => {
    // 2400×1080 phone at DPR 2.75 → 873×393 CSS px; FIT canvas 698×393 centred (88 px bars); 32 px cutout on the left
    expect(toGameInsets({ l: 32, t: 0, r: 0, b: 0 }, { left: 87.5, top: 0, width: 698, height: 393 }, { w: 873, h: 393 })).toEqual({ l: 0, t: 0, r: 0, b: 0 });
  });
  it('an inset that reaches into the canvas is scaled to logical px', () => {
    // 16:9 viewport 640×360 CSS, canvas fills it; 20 px right inset → 40 logical px; 10 px bottom → 20
    expect(toGameInsets({ l: 0, t: 0, r: 20, b: 10 }, { left: 0, top: 0, width: 640, height: 360 }, { w: 640, h: 360 })).toEqual({ l: 0, t: 0, r: 40, b: 20 });
  });
  it('a zero-size canvas gives zero insets', () => { expect(toGameInsets({ l: 5, t: 5, r: 5, b: 5 }, { left: 0, top: 0, width: 0, height: 0 }, { w: 0, h: 0 })).toEqual({ l: 0, t: 0, r: 0, b: 0 }); });
  it('joystick zone is the left half minus the top band and the quick bar', () => {
    const z = (x: number, y: number) => inJoystickZone(x, y, { l: 0, t: 0, r: 0, b: 0 }, 2);
    expect(z(200, 500)).toBe(true); expect(z(700, 500)).toBe(false); expect(z(200, 60)).toBe(false); expect(z(100, 680)).toBe(false); expect(z(500, 680)).toBe(true);
    expect(SCREEN.w).toBe(1280);
  });
});
