# V2 — Screen layout (HUD, touch controls, hub, overlays)

Scope: tidy the screen layout for 1280×720 landscape, make it hold on Android safe areas and wide phones (19.5:9, 20:9),
touch controls ≥ 48 dp and clear of the quick bar. **No new content.** Test-pack buttons (hub `testSapphire`, pause `testPack`)
and every skill-HUD feature (sweep, MP dim, deny, pulse, tooltip, touch overlays) are kept.

## Scale strategy: `Scale.FIT` + safe-area-aware HUD
- The game keeps a **fixed logical 1280×720** backbuffer, CSS-scaled by `Scale.FIT` + `CENTER_BOTH` (`src/main.ts`).
  On 19.5:9 / 20:9 phones this gives side bars (pillarbox); on 4:3 tablets top/bottom bars. Nothing is ever cropped (ENVELOP
  would crop the HUD) and every overlay, room and the mini-map keep one geometry — smoke check `C106_landscape_fit` still holds.
- Why not `RESIZE`/`EXPAND`: the room is a fixed 1280-wide arena and ~20 scenes hard-code the 640/360 centre; widening the
  canvas would need camera offsets in every scene and would collide with the parallel room and floor-map work. Using the side bars
  for touch buttons is listed under *Future* below.
- **Safe areas** (`src/ui/safeArea.ts`): `index.html` already had `viewport-fit=cover`; a hidden probe reads
  `env(safe-area-inset-*)`, `toGameInsets()` keeps only the part that reaches *into* the FIT canvas and converts it to logical px.
  On a 20:9 phone the cutout lies inside the side bar, so the inset is 0. When an inset is non-zero (a 16:9 phone with a notch, a
  gesture bar) the HUD and the touch buttons are re-anchored inward; a change (rotation) restarts the stateless HUD scene and
  re-positions the touch buttons. Debug: `?safe=l,t,r,b` (CSS px) simulates a cutout; `window.__TSLayout.insets()` / `.dp(48)`.
- `#game` now uses `100dvh` (fallback `100vh`) and `position: fixed`, so the Android URL bar can no longer push the bottom of the
  canvas (quick bar, attack button) off screen.

## One layout module: `src/ui/hudLayout.ts` (pure, unit-tested)
All screen-space rects of the in-run HUD and the touch cluster come from here (no Phaser import), so tests can prove the geometry.
It reads the mini-map rect and door slots from the floor-map module `src/ui/layout.ts` (`MINIMAP`, `DOOR_X`, `DOOR_HALF_W`).

| Constant | Value | Meaning |
|---|---|---|
| `MARGIN` | 12 px | edge margin of every HUD group from the safe rect |
| `GAP` | 8 px | gap between neighbouring groups (8-px rhythm) |
| `TOUCH_MIN` | 96 px | minimum touch hit diameter = **48 dp on a 360 dp-tall landscape phone** (720 / 360 × 48) |

### In-run HUD (zero insets)
| Group | Where | Notes |
|---|---|---|
| HP / MP / XP bars, dash pips, level | top-left, x 12–270, y 8–94 | unchanged positions (now derived from `MARGIN`) |
| Resource pills Hạt Dẻ / Ngọc / xúc xắc | top row x 290–640 | |
| Buff status line | x 16, y 110 | was y 122 (now hugs the bars) |
| Pause over music (54×50) | one column x 996–1050, y 8–116 | between the last door slot (x ≤ 990) and the mini-map (x 1062); was a row that sat over the door at x 890–990. With a right inset that would push it onto a door it falls back to a row left of the bag. |
| Mini-map | `layout.ts MINIMAP` (1062, 8, 206×140) | owned by the floor-map work |
| Bag button | right edge, 12 px under the mini-map | 64×60 desktop, **80×76 touch, hit 96×92** |
| Combos list + miracle row | desktop: right column under the bag (miracles follow the list height — they used to overlap it). Touch: left column under the bars (the right side is the thumb cluster) | |
| Quick bar (potions + Phép 1 / Phép 2 / special) | bottom-left, `MARGIN` from left and bottom (y 638–708) | was 8 px from the bottom; key labels (R/1/2/F) hidden on touch |
| Weapon label | 24 px above the quick bar | |
| Boss bar | centre, y 190 (below the wall band / doors) | |
| Skill tooltip | above the slot or the held touch button, clamped to the safe rect | |

### Touch controls (right-thumb cluster)
Attack sits in the bottom-right corner (hit r 64); an **inner arc** (R 140: Lướt 180°, Kỹ năng 222°, Đỡ 264°) and an **outer arc**
(R 245: Phép 1 190°, Phép 2 215°, Bình 240°, Dùng 265°) fan around it. Every hit circle is ≥ 96 px (visual radius 40–46, the hit
circle may be larger than the art), no two overlap, and none touches the quick bar (max 5 potion slots), bag, pause/music or mini-map.
At zero insets: attack (1204, 644), dash (1064, 644), special (1100, 550), guard (1189, 505), spell1 (963, 601), spell2 (1003, 503),
potion (1082, 432), interact (1183, 400). The duplicate touch "Túi" button was removed (the HUD bag is the touch target now).

| Device (landscape) | logical px per dp | 48 dp = | smallest hit (96 px) = |
|---|---|---|---|
| 360 dp tall (small phone) | 2.0 | 96 px | 48 dp |
| 2400×1080 @ 2.75 (393 dp) | 1.83 | 88 px | 52 dp |
| 2400×1080 @ 2.625 (411 dp) | 1.75 | 84 px | 55 dp |

Joystick: floating, starts only in the left half **below the top HUD band (y ≥ 104) and not on the quick bar**
(`inJoystickZone`); base r 66, knob r 30 (was 60/26), full speed at 60 px drag (unchanged feel). Positions are exposed for tests via
`ctl.touchPositions()`; smoke's touch steps now read them instead of hard-coded coordinates.

HUD tap targets that are not gameplay controls: pause/music hit 80×58 on touch (column spacing limits height), quick-bar skill slots
hit 58×66 on touch (tooltip by long-press), bag hit 96×92.

## Hub (Làng Mây)
- **Readable name plates** for the 7 stations (dark pill, 14 px cream text), hand-placed so none overlaps another plate
  (wardrobe / dummy / portal plates above their art, the others below). Tapping / clicking a plate uses the station.
- The proximity prompt said "chạm để dùng" but tapping did nothing on touch — it is now the tap target for the nearby station
  (and is clamped so it never sits under the right button column).
- Corner chrome anchored to the safe rect: sapphire pill top-left, title centre, right column settings / Nhật Ký / **+3000 Ngọc test
  pack** on a 104-px rhythm; bottom bar buttons 108×90 with labels auto-fitted ("Gương Tài Năng" no longer overflows); hard-mode tag
  moved out from under the start button.

## Overlays
- FIT means every overlay is centred and fits at every aspect by construction (logical 1280×720).
- **Pause**: one column on a 70-px step (56-px buttons), card sized to its rows (5 rows + test pack in game, 4 in training);
  the test pack no longer touches the card edge.
- **Shop**: the three service buttons are 220 wide inside the card; `button()` now auto-shrinks any label that would overflow
  (`fitText` in `src/ui/kit.ts`) — fixes "Đổi hàng (1 xúc xắc · còn N)" spilling out of its button. Applies to every kit button.
- Inventory / choice / event / results unchanged (verified at 2400×1080).

## Files
| File | Change |
|---|---|
| `src/ui/hudLayout.ts` | **new** — pure layout (HUD rects, quick bar, touch cluster, joystick zone, safe-inset conversion) |
| `src/ui/safeArea.ts` | **new** — DOM safe-area probe, inset subscription, `?safe=` override, `window.__TSLayout` |
| `src/main.ts`, `index.html` | install safe area; `100dvh` fixed game container; FIT rationale comment |
| `src/scenes/HudScene.ts` | every position from `hudLayout`; pause/music column; bag/combo/miracle stacking; touch hit padding; restart on inset change |
| `src/game/input.ts` | touch cluster from `touchLayout`, hit radius ≥ 48 px, joystick zone, `layoutTouch()` / `touchPositions()`, removed duplicate Túi |
| `src/ui/kit.ts` | `fitText`, `padHit`; `button()` auto-fits its label |
| `src/scenes/HubScene.ts` | name plates, tappable prompt, safe-anchored chrome, fitted bottom bar |
| `src/scenes/overlays.ts` | Pause column + card sizing; shop service buttons |
| `tests/hudLayout.test.ts` | **new** — 24 tests: ≥ 96 px hits, no overlaps, inside safe rect for 4 inset cases × desktop/touch × 1–5 potions, doors clear, inset conversion |
| `tools/smoke.mjs` | touch attack / skill steps read `ctl.touchPositions()` |

## Gates
`npm run typecheck` clean · `npm test` 24 files, 406 pass + 1 skipped (includes the parallel agents' new tests). Build / smoke / zip
are left to the integrator. Screenshots (built to `work/hud_dist`, script `work/hud_shots.mjs`): `out/hud_layout/`
`1280x720_desktop_{hub,room,pause}.png`, `2400x1080_touch_{hub,room,pause,inventory}.png` (873×393 CSS @ 2.75 = 2400×1080 px),
`1280x720_touch_safe_{hub,room,pause}.png` (`?safe=48,0,48,20`).

## Risks / follow-ups
- ~~Mini-map + safe insets~~ — fixed in the integration pass: `Minimap` takes `safeInsets` and shifts its container by (−r, +t),
  matching `hudLayout.minimapRect` (smoke `V2_minimap_safe_inset`, `?safe=0,24,100,0` on an 800×360 phone).
- Side bars on 20:9 phones are unused screen (FIT). Future: put the touch cluster in the right bar via a DOM/second-canvas layer
  or move to `EXPAND` with per-scene camera centring.
- Touch arcs assume a right-handed layout; no left-hand mirror option (would be new content/settings).
- Hub plates are tappable on desktop too (click opens the station) — intended, but it is a new affordance.
- The quick-bar zone also blocks the joystick in the hub (bottom-left corner over the pond) — harmless.
- Real-device check not done: dp math is from CSS size; Android WebView `env()` support assumed (falls back to 0).
