# V2 rooms — layouts, cover and obstacle-aware AI

Problem: combat rooms were flat grass with a few non-colliding decor props (and one optional liquid pool).
v2 rooms give every room a seeded layout with real cover — pillars, rock clusters, water/pits, low walls, bushes —
that shapes fights (chokepoints, flank lanes, line-of-sight blockers) while keeping doors, loot and the boss arena
readable. **No new content**: only existing chapter props (`prop_ch<N>_*`) and tileset frames are used.

Code: `src/systems/roomgen.ts` (pure, seeded through `rng.ts`), small hooks in `src/scenes/RunScene.ts`,
obstacle steering in `src/systems/ai.ts`. Tests: `tests/roomgen.test.ts`.

## Grid
- The room is RunScene's fixed 27 × 15 grid of 48 px tiles. Walkable interior = cols 1..25, rows 3..13
  (row 3 = door lane under the north wall, row 13 = entry lane).
- Templates are authored over the **placement area** cols 3..23 × rows 5..11 (21 × 7), so every room keeps a
  2-cell lane along all four walls (doors on top, the hero's entry at the bottom, flank lanes on the sides).
- Cell kinds:

| Kind | Glyph | Movement | Shots / sight | Drawn as |
|---|---|---|---|---|
| rock | `R` | blocks | blocks | chapter rock prop (boulder, crates, desk, snow boulder, barrels, moon rock…) |
| pillar | `P` | blocks | blocks | tall chapter prop (lantern, spire, bookshelf, ice pillar, boiler, star pillar…) |
| bush | `B` | blocks | blocks | soft cover prop (bramble, dead bush, floating rock, frost bush, gears, crystal flowers…) |
| low wall | `W` | blocks | blocks | baked wall-face tiles (frames 22/23 of the chapter tileset) |
| liquid | `~` | blocks | **passes** | baked liquid tiles (24/25, 26 top edge, 27 bottom edge): swamp, lava, sky, water, steam, void |
| edge | `#` | blocks | blocks | trimmed outside of a smaller room (frames 16 / 17 / 18) |
| `?` | | | | seeded rock-or-bush |

Each rock / pillar / bush cell gets one prop (scaled to ≤ 60 px wide, 54 px for pillars, random flip, soft shadow,
depth-sorted by y). Theme lists per chapter: `THEMES` in roomgen.ts.

## Room kinds and sizes
`roomKindFor(pos, node)` maps the run position:

| Run position | Kind | Size (trim = columns cut from each side) | Pool |
|---|---|---|---|
| `start` | start | full | `start_frame`, `start_gate` (shop stall + dummy kept clear) |
| `gate` (boss / mini-boss gate) | boss | full | `boss_open`, `boss_corners`, `boss_pools` — only far-corner features |
| node `shop`, `roots` (no fight) | shop | trim 3 (smallest) | `shop_frame`, `shop_garden` |
| modifier `miniboss` / `derangement`, event `arena` | elite | full | `elite_corners`, `elite_pillars`, `elite_moat`, `pillar_ring` (open middle) |
| other events (clover, merchant, obelisk, fountain, companion, blood, pocket, secret) | event | trim 1 (secret: 0, the cracked wall is on the east wall) | 7 shared + ch3/ch5 signature + procedural 30 % |
| node `money`, `artifact`, `tablet`, `dice` | treasure | trim 2 | 6 shared + chapter signature + procedural 30 % |
| everything else (levelup, enchant, heart, anvil) | combat | full or trim 1 (35 %) | 11 shared + chapter signature + procedural 40 % |

Hand-authored templates (each also mirrored X and/or Y by seed):
`pillar_grid`, `rock_clusters`, `choke_walls` (two wall pairs → central corridor), `flank_lanes` (vertical walls →
side lanes), `river_bridges` (liquid moat with 2-cell bridges), `pillar_ring`, `crossfire_cover` (bush lines for
ranged duels), `brackets` (L-walls), `twin_pools`, `offset_blocks` (asymmetric), `central_bunker`.
Chapter signatures: ch1 `ch1_grove` (bush groves + swamp), ch2 `ch2_quarry` (rock spines + lava), ch3 `ch3_stacks`
(bookshelf rows + sky pits), ch4 `ch4_ice_holes` (water holes + ice pillars), ch5 `ch5_pipes` (walls with steam),
ch6 `ch6_void` (void pits + crystal pillars). Signatures are picked 45 % of the time when the chapter has one.

Procedural variant (`scatter`): 5–7 clusters (3–5 in treasure/event) from a shape set (pillar, 2×2 rocks, 2-rock,
3-bush row, 2-bush column, 4-wall, L-wall, 3-wall column, 3×2 / 2×2 liquid), 60 % mirrored left↔right; every
cluster keeps a **2-cell gap** from every other cluster and stays out of the reward centre.

Example (combat, ch2, `ch2_quarry` mirrored):
```
#.........................#
#.........................#
#.......RR.......RR.......#
#.......RR.......RR.......#
#.........................#
#..~~~...............~~~..#
#.........................#
#.......RR.......RR.......#
#.........................#
```

## Rules (enforced by `buildRoom` + `validate`, checked by tests)
1. **Anchors kept clear** (`ANCHORS`, must match RunScene's literals): entry (640,640) / start (640,600) / gate
   (640,620); reward chest/altar/orb (640,420); mini-boss drop (520,420) + mini-boss spawn (640,300, radius 2 cells)
   in elite rooms; event prop (400,470) and the bat/arena spawn (640,300) in event rooms; secret wall (east wall,
   y 300); shop stall (480,360) and dummy (820,360) in the start room; boss spawn (640,330, radius 2) and portal
   (640,420) in boss rooms. The reward centre 3×3 is always cleared.
2. Door lane (row 3) and entry lane (row 13) are always open; all 5 door slots (x 340/460/640/820/940 — the map
   agent's `DOOR_X` uses 340/640/940) are reachable.
3. **No pockets**: walkable cells not connected to the entry are filled (bush) before validation.
4. **Big bodies**: doors and anchors must be reachable by a "fat" flood fill (2×2-cell clearance ≈ 96 px), so
   mini-bosses and elites never get wedged out of the fight.
5. ≥ 120 walkable cells; a layout that fails validation is regenerated (another template / seed draw), and the 6th
   attempt is an open room — in 6 300 tested layouts no fallback was needed.
6. Deterministic: seed = floor seed ⊕ node id, so re-entering a room (save/continue) rebuilds the same layout.

## Collision
- **Hero**: `this.blocks = blockRects(layout, {x:12, top:6, bottom:4})` — the existing point-vs-rect `blocked()` test
  with obstacle cells inflated by the hero's feet size (dash, lunges, blink and shadow-step all go through
  `moveBy`, so none of them can end inside cover).
- **Enemies**: `resolveCircle(layout, x, y, min(radius·0.7, 20))` after movement — circle vs blocked cells, pushes out
  along the face so bodies slide around corners; a boss charge ends when it hits cover (same as the walls).
  Replaces the old point-in-rect push (which also exempted teleporters).
- **Projectiles** (both sides): die on a shot-blocking cell (tested at the projectile's ground point, y + 18) with a
  small `fx_hit`; liquid lets shots fly over. Lobbed bombs, telegraphed AoE, lasers and boss hazards are area attacks
  and ignore cover (they are already dodged by movement).
- **Spawns**: `spawnWave` routes every wave group through `safeSpawn` — a free cell reachable from the hero,
  ≥ 220 px away, penalised next to obstacles and on top of other groups (swarm members share their group's cell).
  `makeEnemy` moves any spawn that would land inside an obstacle (minions, summons, the blood-altar bat, decoys) to the
  nearest free cell; teleport landings (teleporter enemies in `ai.ts`, boss `teleportStrike` in RunScene) do the same.
- Training room: no layout (`layout = null`), behaviour unchanged.

## AI (ai.ts)
`AiWorld.nav: NavGrid | null` (set by RunScene to a `RoomNav`; null in unit tests → legacy behaviour).
- `RoomNav`: 8-neighbour BFS distance field toward the hero's cell (no corner cutting), cached until the hero changes
  cell (405 cells — negligible cost); `los` (sight/shots), `clear` (walkable straight line with a body radius),
  `flowDir`, `nearestFree`.
- `navSteer` after each think, only while the agent moves freely (idle state; wind-up, active lunges and recovery are
  untouched): if a melee body has no walkable line to the hero, or a ranged/support enemy has no line of sight, it
  follows the flow field; otherwise it probes 16 px + radius ahead and rotates ±0.5…2.6 rad (strafe side first) to
  slide along cover. A stuck detector (wanted to move, moved < 25 % for 0.5 s) forces 0.9 s of path-following.
- Attacks need a line: lunges/charges need a walkable line, aimed shooters / spreads / turrets need sight
  (`hasLine`). Lobbers, rings, summons, heals are unaimed and unaffected. So cover works: a turret behind a pillar
  waits, a shooter repositions until it can see the hero.
- Ranged wall-awareness (`inBounds`) also treats obstacle cells as out of bounds.

## Tests (`tests/roomgen.test.ts`, 19)
- Template shape/glyph check; every kind × chapter has a pool; every chapter has a signature.
- 6 300 layouts (6 chapters × 7 kinds × 150 seeds, mini-boss / event flags mixed): `validate` ok; thin flood fill
  reaches every walkable cell; anchors free; all door slots reachable; mini-boss / event / secret anchors reachable
  for big bodies; deterministic.
- Combat rooms: ≥ 8 distinct templates and ≥ 2 sizes per chapter, > 85 % with ≥ 4 solid cover cells; size order
  shop < treasure < combat ≤ boss; boss arenas keep the middle open (≤ 12 obstacle cells, none near the boss spawn).
- Props are chapter props; walls/liquid are tiles.
- `safeSpawn` never in an obstacle, reachable, ≥ 220 px, distinct; `resolveCircle`/`nearestFree` always end free;
  shots blocked by solids but not liquid; `lineClear` sight vs walk; following `flowDir` from every reachable cell
  reaches the target.
- AI simulation with the real `AiWorld.think` + scene-like movement + `resolveCircle`: chaser / charger / shielded
  get around a U-shaped wall to the hero; a shooter repositions until it has line of sight; chasers reach the hero from
  far spawns in 60 generated combat rooms (test bound: < 5 % may stop short of 160 px); no agent ever ends inside an obstacle;
  without a nav grid nothing changes.

## Known gaps / risks
- `ANCHORS` duplicates RunScene's hard-coded positions (reward 640,420; event 400,470; …). If someone moves an
  interactable in RunScene, update `ANCHORS` too (tests only guard the roomgen side).
- Melee swings and the greatsword spin still hit through cover (only projectiles are blocked) — melee reach is short
  enough that this reads fine, but it is not physically exact.
- Floor decals (tileset frames 8–15: mushrooms, manholes, bones…) are pre-existing and non-colliding; with real
  obstacles in the room a few of them can be mistaken for cover at a glance.
- Smoke bot: now steers with `__TS.navStep(x, y)` (straight when a hero-wide line is walkable, else the room nav
  flow field), used by `walkTo` and the fight approach (integration pass).
- Bosses are not path-aware (bossThink untouched); boss arenas are kept open so this does not matter, and bosses slide
  off the far-corner pillars.
