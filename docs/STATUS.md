# Tháp Sao — engine status

_Last updated: 2026-10-10 (engine continuation run)._

## Gates (all green)
| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | clean |
| Unit tests | `npm test` | 14 files, 194 tests pass (13 engine files in `tests/` + `src/data/content.test.ts` 17 content tests) |
| Build | `npm run build` | `dist/` + single-file `docs/ThapSao.html` (~26 MB, all 234 art files embedded as data URIs) |
| Smoke | `npm run smoke` (headless Chromium, `tools/.sysroot`) | 103/103 checks, 0 console errors, ~8 min |
| Checklist | `npm run checklist` (`tools/checklist.mjs`) | 110/110 lines of `docs/CHECKLIST.md` ticked from test + smoke evidence |
| Source zip | `npm run zip` | `docs/ThapSao_src.zip` (47 MB, 557 entries; excludes node_modules, dist*, out, tools/.sysroot, work, docs/ThapSao.html and the raw image generations `art/raw_*`, `art/stills_chars` — those stay in the workspace) |

The smoke run takes longer than the 120 s shell limit of the agent sandbox; run it detached
(`nohup node tools/smoke.mjs > work/smoke.log 2>&1 &`) and poll the log.

## What changed in this run
- **Smoke blocker fixed**: ch3 boss (Cú Thủ Thư, radius 40) was never hit because the smoke bot stopped approaching at
  110 px while melee reach is weapon range 58 + boss radius 40 = 98 px. Bot now closes to 72 px. Game code was right.
- **Performance**: room floor and hub island are baked into one RenderTexture (`bakeTiles` in `src/game/assets.ts`) instead of
  ~450 tile images + decals per room; removed the full-screen background fill. Headless swiftshader room FPS 12 → 16.
- **Visual pass vs `art/sheets/mockup_*.png`**: removed overlapping floating station labels in the hub (proximity prompt only),
  fixed hub bottom-bar icons (Sân Tập = crossed swords, Cây Sao = star), sapphire pill no longer clipped; HUD spell
  quick-slots show the spell artifact's icon + key number instead of a truncated spell id; `R` key hint on the potion belt;
  card titles sit on the art ribbon `ui_card_header`; readable rarity text colours (`RARITY_TEXT`); choice cards show
  the item's footprint; event dialogs show the event's art (clover, merchant, obelisk, fountains, blood altar, portal);
  boss/enemy telegraphs now draw the art sprites `fx_telegraph_circle` (centred, scaled to radius) and `fx_telegraph_line`
  (anchor [0,0.5], stretched along X) over the graphics marker; ending screen shows the village celebrating (hero + NPCs at
  the campfire) instead of a bare starfield; training room hides the empty mini-map panel; start-room chapter banner moved
  off the shop stall; room props kept clear of doors and the mini-map; inventory tooltip card opens beside the grid instead
  of covering it (between the grid and the combo panel); touch "Đỡ" (guard) button uses the shield art.
- **Smoke additions**: a real mid-fight combat room per chapter (`C090_combat_room_1..6`, chapter enemies on screen, no
  placeholders), a full inventory (6+ artifacts, tablets, active combos, tooltip) screenshot (`inventory_full`). Checklist
  C087 now requires real boss damage in all 6 chapters, C090 requires the combat rooms, C101 the full inventory.
- **i18n tests**: every literal `t('…')` key in engine code and every templated key family (`ev.*`, `node.*`, `rar.*`,
  `choice.*`, `ev.fountain.*`) must resolve to Vietnamese text.
- `docs/CONTENT.md`: stale warnings annotated (engine reads the right Destiny grant keys; vitest includes `src/**/*.test.ts`).
  No content data was changed.

## Verified "new facts" (in code)
1. Destiny grant keys `homeRepair, talentPoints, seedMoney, startDice, bagCols, bagRows, sideBag, levelUpHeal, unlockWeapon,
   unlockArtifacts, potionSlot, hardMode, pocketDimension, chestReroll` — read in `src/systems/meta.ts` / `run.ts`.
2. All 12 boss patterns (`ring, spiral, crossWave, aimedBurst, charge, slam, summon, laserSweep, rainMarkers, teleportStrike,
   shieldPhase, minefield`) with CONTENT.md params — `bossThink` in `src/systems/ai.ts`; onEnter hooks in RunScene.
3. 17 special ids — `src/systems/specials.ts` helpers, all called from RunScene; weapon mod keys (all 18) read in
   `src/systems/weapons.ts`; onHit chance clamped 0..1; flat percentage-point stats.
4. `vite.config.ts` test.include has `src/**/*.test.ts` (content tests run).
5. Flip = `scaleX = -|scaleX|` around the manifest origin (`face()` in assets.ts), so tight-cropped feet stay put.
6. Boot loads hub/hero/UI/fx/icons only; `ensureChapter` lazy-loads the chapter's enemies, bosses, tileset, props and
   removes the previous chapter's textures + anims.
7. Hurt flash = `setTint(0xffffff)` + `TintModes.FILL` (enemies and hero), not the pale art frames.
8. Tileset frames per frameDoc (north wall 22 over 23 over floor, liquids 24–27, edges); `fx_thrust` [0.06,0.5],
   `fx_telegraph_line` [0,0.5] stretched; pickups centred; `hub_pond` [0.5,0.6]; hub uses hub_dirt_a/b, hub_tree_c,
   hub_flowers; training room uses prop_fence.
9. Screenshots compared against the mockups (see list below); placeholders = 0 in every smoke state.

## Screenshots (out/smoke/, regenerated by every smoke run)
Best six to show: `01_hub.png`, `17_ch1_combat_room.png`, `15_inventory_full.png`, `10_choice_artifact.png`,
`34_ch6_boss_fight.png`, `35_ending_credits.png`. Also: `11_shop.png`, `12_event_dialog.png`, `13_map.png`,
`21/24/27/30/33_ch*_combat_room.png`, `18/22/25/28/31_ch*_boss_fight.png`, `37_destiny_tree.png`, `38_talents.png`,
`39_training_room.png`, `40_touch_controls.png`, `99_single_file_hub.png`.

## Known gaps / judgment calls
- Headless swiftshader runs at ~16–25 FPS (CPU rendering); real-GPU / phone FPS was not measured here.
- Desktop hides the touch buttons (the mockup shows them); they appear on touch devices or with `?touch=1`.
- Hub island is a rounded rectangle of tiles, not the irregular coastline of the mockup.
- Bosses are finished with `__TS.killBoss()` after real damage is dealt (SPEC §11 allows debug-assisted kills).
- Only the chapter-1 mini-boss drop is exercised in smoke; all 12 boss definitions/phases are unit-tested.
- Audio is procedural WebAudio SFX only (no ambient loops).
