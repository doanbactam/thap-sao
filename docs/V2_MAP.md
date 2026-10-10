# V2 floor map: generator + map UI

Scope: the floor node map (`src/systems/floorgen.ts`), the HUD mini-map and the full-screen map overlay. No new content:
same 10 room types, 2 modifiers, 9 events, same 3 columns × 3 rows per floor (SPEC §5).

## 1. Generator (`generateFloor`)
A floor is built step by step from the seeded RNG, then checked by `validateFloor`. If a check fails, it builds again from
the same RNG stream (up to `GEN_ATTEMPTS` = 40 tries). If every try fails, a fixed valid map (`templateNodes`) is used.
This never happened over 7,200 test seeds; the template exists so that generation always returns a valid map.

| Rule | Before (v1) | v2 |
|---|---|---|
| Links | straight always + each diagonal 40 % independently | straight always + **2–3 diagonals per floor, ≥ 1 per layer** (`DIAG_MIN/MAX`) |
| Crossing | `c→c+1` and `c+1→c` could both exist, so paths crossed (X shape) | **at most one diagonal per column gap per layer**, so paths never cross (`linksCross` test) |
| Paths start → gate | 3–17 (from a straight 3-lane map to an almost fully linked one) | **5–8** distinct paths |
| Choice variety | the 3 doors could show the same room type | **rooms offered together are always different types**; **linked rooms never repeat a type** |
| Type caps | none (3 shops possible) | `TYPE_CAP`: artifact ≤ 3, shop / dice / roots ≤ 1, others ≤ 2 |
| Sustain (no "rest" type exists, so shop or Green Heart) | 0 to many, random | **always ≥ 1 shop/heart at depth ≥ 1**, so some path reaches it; **boss floors: one on the row just before the boss** |
| Elites (mini-boss modifier) | 12 % per fight room; could block every lane, could guard a dice room | **0–2 per floor** (30/50/20 %); always guard a **high-value** reward (artifact / enchant / anvil / tablet; a low-value room is upgraded in place); **never chained**; **a path with no elite always exists**; **none in the first row of global floor 1** |
| Derangement | 15 % of fight rooms | 15 % of the fight rooms that are not elites |
| Tree Roots | weight 5 per room | 40 % per floor while available, never in the first row (a no-fight detour) |
| Events | 13 % per fight room | unchanged (`EVENT_CHANCE`), pocket still gated |
| Artifact guarantee | yes | yes |

Per-floor averages over 36k floors: 0.88 elites, 0.76 shops, 0.98 hearts, 1.7 artifacts, Roots on 40 % of floors while available.
(v1 averages: about 0.95 mini-boss rooms, 0.56 shops, 0.56 hearts.) There is a little more sustain than before; the balance sim was **not re-run**.

New pure helpers (all unit-tested):
- `validateFloor(f, opts)`: lists rule violations.
- `allPaths(f)`: every start-to-gate path.
- `linksCross(a, b)`: whether two links cross.
- `parentsOf(f, id)`
- `bossForeshadow(f)`: the gate boss, the chapter boss, and how many floors until the boss.
- `mapView(f, pos, visited, roomCleared)`: per-room state (`current` / `cleared` / `reachable` / `ahead` / `skipped`), gate state, the path walked, and the next choices.

Saves are compatible because `floorData` is stored in the run, so an old run keeps its old map. The shape of `MapNode` and `Floor` is unchanged.

## 2. Map UI
### Layout (`src/ui/layout.ts`, pure)
- `MINIMAP` = {x 1062, y 8, w 206, h 140} sits entirely in the top wall band (bottom 148 < `ROOM_TOP` 154). It is right of the
  last door slot (door rects 290–390 / 590–690 / 890–990), so it never covers a door, a door icon or the play area.
  In v1 the 230×210 panel reached down to y 218, into the room.
- `MINIMAP_COLLAPSED` is a 64×56 chip at the same corner. `MINIMAP_TOGGLE` is the "–" in the panel corner (hit area padded to 44×40).
- `MAP_BUTTON` is an optional touch map button rect for the HUD, if it wants one besides tapping the mini-map.
- `SAFE` margins (12 / 8 / 12 / 12) and `DOOR_X` = [340, 640, 940] (one slot per map column).
- `FULLMAP` holds the overlay geometry.
- `tests/map_layout.test.ts` checks: the mini-map is in the band, clear of the doors and inside the safe margins; nodes fit
  and do not touch; the full map stays inside the card and left of the legend.
- **HUD integration**: `src/ui/hudLayout.ts` (hud agent) has `MINIMAP_BASE = {1040, 8, 230, 210}` and uses it to place
  pause / music / bag. The integrator should set it to `MINIMAP` from `layout.ts`. Until then the buttons are just placed a bit more loosely; nothing overlaps.

### Mini-map (`Minimap` in `src/ui/mapView.ts`, used by `HudScene`)
- Vertical layout: gate on top, then rows 3, 2, 1. Columns line up with the doors (left door = left lane). The start room is implied below the panel.
- Room-type icon per room. Modifier badge (red ring + mini-boss icon for elites, derangement badge).
- States:
  - current: orange with a pulsing ring, plus a ✓ once cleared
  - cleared: muted brown with a green ✓
  - reachable: cream with a gold halo and ring, plus a gold link from the current room
  - ahead: pale
  - skipped: dark, faded icon
  - walked path: thick orange links
- Gate: red disc on boss floors, wood disc on gate floors.
- Title: chapter name and `chapter-floor`, scaled down to fit.
- Tap the panel → full map. Tap "–" → collapse. Tap the chip → expand. The collapsed state persists in `localStorage`
  (`thapsao.minimapCollapsed`). The map redraws only when `mapKey` changes (position, visited rooms, cleared state, floor).
- Hidden in the training room.

### Full map overlay (`MapScene` in `src/scenes/overlays.ts`)
- Open it with **M** (existing `map` action in RunScene), by tapping the mini-map, or from the Pause menu.
- Close it with **M / Esc / any tap**, or the "Đóng" button (id `close`, kept for smoke). A 250 ms guard ignores the
  press that opened it, and a `closed` flag stops a double close.
- Same drawing as the mini-map, at full size, with the start node and Vietnamese room names under every room.
- Boss foreshadow next to the gate: "Cửa Ải / Trùm: <name>", the boss title, and on floors 1–2 "Trùm chương (tầng 3): <chapter boss>".
- Legend panel:
  - the 5 room states
  - the walked path
  - elite ("Tinh Anh (rủi ro cao, thưởng hiếm)") and derangement
  - all 10 room types plus the boss
  - "M / Esc / chạm để đóng"
- New UI strings are in the `DEFAULT_STRINGS` of `src/systems/i18n.ts`, all under `map.*`.
- The legacy `drawMap` is still exported from overlays.ts, but nothing uses it now.

### Doors (RunScene, one localized edit in `drawDoors`)
Each door now sits in the slot of its map column (`DOOR_X[n.col]`). Before, doors were spread by how many there were. Now the
spatial order of the doors always matches the map. All three slots (340 / 640 / 940) are in roomgen's `DOOR_XS`, so the
roomgen door-lane checks still apply.

## 3. Tests
- `tests/floorgen.test.ts`: the 14 v1 tests still pass, plus 9 new ones. They cover 7,200 floors (6 chapters × 3 floors × 400 seeds; roots on and off; pocket on and off):
  - validity
  - the template is valid and essentially never used
  - no crossings, 2–3 diagonals, 5–8 paths
  - distinct choice types and no repeated type on a link
  - sustain on some path, and before the boss
  - elite rules
  - determinism
  - foreshadow
  - `mapView` states and path
- `tests/map_layout.test.ts` (4): geometry checks.

## 4. Risks / follow-ups
- Smoke (integrator):
  - `map_overlay` (`press('m')`, `btn('close')`) should still pass.
  - `C071` expects 3 doors in the start room, which is still true.
  - No smoke check yet for the mini-map collapse or tap-to-open. It worked in a manual headless check: M opens and closes, the toggle collapses, the chip expands, tapping the panel opens the map, and tapping anywhere closes it, with 0 console errors.
- A single door in a side lane now sits at x 340 or 940 instead of the centre. This is intended (it matches the lane).
- Room economy shifted slightly (more sustain, a guaranteed elite reward value). Run `npm run sim` to re-baseline.
- `hudLayout.MINIMAP_BASE` should be synced to `layout.MINIMAP` (see above).
