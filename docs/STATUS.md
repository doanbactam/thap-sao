# Tháp Sao — engine status

_Last updated: 2026-10-10 (v2 skills polish — spells + weapon specials)._

## v2 skills polish (commit "v2 skills polish")
Improve + polish the existing active skills — 6 quick-slot spells (keys 1/2) and the 6 weapon specials (F/L/touch). No new content.
Full audit, before → after table, feel rules and synergy check: `docs/V2_SKILLS.md`.
- **Retune**: spells — icebolt cd 1.5→1.2 s; fireball 15→16 MP, blast 70→90 px; chain 18→16 MP, bounce 70→80 %; arcane 10→14 MP,
  cd 1.2→1.5 s, Magic share 100→40 % per missile (was 2× better per MP than anything); bubble 20→18 MP, cd 8→7 s, 4→5 s; blink 10→8 MP,
  cd 3→2.5 s. Specials — MP 20/25/15/20/20/30 → **16/22/14/18/18/24** (S&S/GS/dagger/katana/crossbow/staff) and new cooldowns
  2 / 3 / 1.5 / 1.2 (perfect iaido refunds) / 1 / 2.5 s; bash coef 1.5→1.8 + stun 1→1.2 s; iaido 2.2→2.4; heavy bolt 3.0→4.2; nova 2.5→3.0
  + 200 ms i-frames; spin minimum 0.6→0.75 × duration. Spell crits now use Crit Damage; Cooldown% now also shortens specials.
- **Bugs fixed**: HUD cooldown overlay used the base cooldown (ignored Cooldown%); dagger special spent MP with no target; spell crit ignored
  Crit Damage; staff nova / iaido / chain zaps allocated a Graphics + tween per cast (now one pooled Graphics, cap 48).
- **Feel**: hold = floor aim preview (line / circle / cone / target ring / blink landing / self), release = cast; 120 ms cast buffer;
  per-skill wind-up (0–180 ms) with rig pose + progress ring; MP + cooldown committed at the end of the wind-up; dash / guard / getting hit
  (no super armor) cancels with nothing spent; right-click or touch drag past 110 px cancels; per-skill hit-stop + shake; 12 distinct SFX +
  cast / ready / cancel; iaido perfect-window glint.
- **HUD**: 3 slots (spell 1, spell 2, weapon special) with clipped radial sweep + seconds, MP cost, key labels, low-MP dim, red deny flash
  (+ MP bar flash), ready pulse + ping, tooltip on hover / long-press with live numbers. Touch: new Phép 1 / Phép 2 buttons, hold-to-aim,
  release-to-cast, drag-out cancel, cooldown overlay on the buttons.
- **Code**: `src/systems/skills.ts` (pure), `src/systems/skillFx.ts` (scene glue), `HudScene.drawSkills`, `input.ts` skill edges,
  `audio.ts` voices, small hooks in `RunScene` (castSpellSlot / doSpell / zap now delegate; `hitEnemy` options `shownCrit`, `hs`, `shk`),
  `combatFx.attackInput` (wind-up blocks attacks), `power.ts` (uses the new tuning). Debug: `window.__TSSkills.state()`.

### Gates (v2 skills)
| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | clean |
| Unit tests | `npm test` | 21 files, 350 pass + 1 skipped (new `tests/skills.test.ts`: 20) |
| Build | `npm run build` | `dist/` + `docs/ThapSao.html` (26.1 MB, 234 embedded files) |
| Smoke | `setsid nohup node tools/smoke.mjs > work/smoke.log 2>&1 &` (~11 min) | **119/119 checks, 0 console errors, boss real kills 6 / 6** (new: `V2_skill_spell_cast`, `V2_skill_cooldown_sweep`, `V2_skill_weapon_special`, `V2_skill_mp_deny`, `V2_skill_touch_drag_cancel`) |
| Checklist | `npm run checklist` | **121/121** (new C119–C121) |
| Source zip | `npm run zip` | `docs/ThapSao_src.zip` 47.3 MB |
| Balance sim | `npm run sim` | **not re-run** this pass |

Screenshot: `out/smoke/18_v2_skills.png` (Lao Khiên line preview held, fireball sweep 1.4 s, icebolt ready pulse, slot keys/costs).
Notes: one smoke run failed `C045_tablet_level_live` (a Q-rotate key press lost mid-drag under load, unrelated code) and passed on rerun;
the first sweep-check failure was a read-order race in the check (now waits for the HUD frame). Detach smoke with `setsid` — a plain
`nohup … &` inside the agent shell is killed with the 120 s command timeout.

## v2 depth pass (commit "v2 depth pass")
Four workstreams merged on top of `v1 baseline` (no new content: no new weapons, enemies, bosses, items, artifacts):
combat feel (`docs/V2_COMBAT.md`, `docs/COMBAT.md`), enemy/boss AI + encounters (`docs/V2_AI.md`), build/decision depth
(`docs/V2_BUILD.md`), animation readability + performance (`docs/V2_ANIM.md`, `docs/V2_PERF.md`).

### Gates (v2, all green)
| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | clean |
| Unit tests | `npm test` | 20 files, 330 pass + 1 skipped (the `npm run sim` full report) |
| Balance sim | `npm run sim` (~110 s, run detached) | pass; see numbers below |
| Build | `npm run build` | `dist/` + `docs/ThapSao.html` (26.1 MB, 234 embedded art files) |
| Smoke | `nohup node tools/smoke.mjs > work/smoke.log 2>&1 &` (~11 min) | **114/114 checks, 0 console errors, boss real kills 6 / 6** |
| Checklist | `npm run checklist` | **118/118** (C001–C110 + new V2 lines C111–C118) |
| Perf | `node tools/perf.mjs dist <label> 10` | see table below |
| Source zip | `npm run zip` | `docs/ThapSao_src.zip` 47.3 MB, 585 entries (now also excludes `.git/`) |

Boss fights in smoke are fought to the death with real damage (god mode, bot at a normal run's level for the chapter):
ch1 3 s · ch2 22 s · ch3 34 s · ch4 23 s · ch5 80 s · ch6 74 s (wall clock under swiftshader); `__TS.killBoss()` fallback never used.

### What the integration pass changed
1. **Leftover hooks wired**
   - `syncEnemyPose(e.sprite, e.agent, isDisabled(e.status), strength)` per enemy per frame in `RunScene.updateEnemies`
     (strength 1 normal, 1.3 elite, 0.6 boss); `enemyPoseClear` on death. RunScene's own red/white windup flicker was dropped
     (kept for teleporter `blink`) so the pose's additive glow + final white flash is the single wind-up read.
   - `combatFx.ts`: removed the redundant startup weapon rotation (the hero rig poses the weapon from `rs.cs`) and the
     perfect-dodge ghost image (rig dash afterimages already cover it); `spark()` now goes through the pooled `fxAt`
     (no sprite + tween per hit).
   - Specials posed on the rig: shield bash `playAttack('bash', 0, 260, {power 1.4})`, katana iaido
     `playAttack('thrust', 20, 260, {reach 22, power 1.6})`, staff nova `playCast(300)`, crossbow piercing shot
     `playAttack('shoot', 0, 220, {power 1.5})`. Greatsword spin already follows `spinning` in the rig.
   - `window.__TSAnim.enemyPose(sprite)` exposed for probes/smoke.
2. **Bug found by the merge**: room setup spawns wave 1 with a 500 ms delayed call, but `checkRoom()` saw 0 enemies on the
   first frame and spawned wave 1 itself, so the delayed call then spawned wave 2 → **waves 1 and 2 always arrived together**
   (hidden in v1, which usually had 1 wave). Fixed in `checkRoom` (waits while `waveIdx === 0`).
3. **Retune where workstreams collide**
   - Chapter-1 encounter budget `waveBudget` 3.5 → **2.75**, and **ch1 floor 1 is always exactly 2 waves** (no 3rd wave).
     Bodies per room (400 seeds, swarm = 3 bodies), before → after:
     ch1 f1 d0 6.7 → **5.1** (wave 1 ≈ 2.4), d1 8.9 → 6.1, d2 11.2 → 7.4; ch1 f2 d0–d2 8.4/10.7/12.6 → 7.1/9.1/11.4;
     ch1 f3 10.3/12.2/14.8 → 8.7/11.0/12.9. Chapters 2–6 unchanged. (v1 ch1 f1 d0 was 1 wave of 2–4.)
     `tests/director.test.ts` "≥ 2 per wave" now counts bodies (a ch1 wave can open with one bee-swarm group of 3).
   - Knockback `knockImpulse` 0.45 (poise holds) / 1.3 (break) **kept**: with v2 AI, idle bodies do no contact damage and
     rushers without an attack token hold a 110–270 px ring, so low knockback no longer lets enemies "pin" the player; it
     keeps recovering enemies inside the punish window. Revisit only if playtests show melee feels sticky.
   - `npm run sim` after the retune (200 runs each, mid-progress meta): greedy win 42 % (tier-2 combo on reaching ch3 84 %),
     casual 37 % (75 %), random 0 % (34 %). Workstream numbers were 43/85, 35/76, 0/27 at 120 runs — within noise.
4. **Smoke / checklist additions** (`tools/smoke.mjs`, `docs/CHECKLIST.md` C111–C118, `tools/checklist.mjs`):
   `V2_wave_waves` (first room has ≥ 2 waves and wave 2 is reached), `V2_elite_marker` (swift elite: ring + "Tinh Anh · Nhanh"),
   `V2_enemy_telegraph` (an enemy in `windup` with the wind-up pose and a telegraph hazard on screen), `V2_charged_attack`
   (real mouse hold → `chargeStart` + `chargedAttack`), `V2_perfect_dodge` (real Space dash; a charging enemy is placed on
   the hero in the dash's first frame), `V2_parry` + `V2_projectile_reflect` (real K guard; a charging enemy / an enemy bolt
   is placed in front inside the 150 ms window; god mode off for that step), `V2_drag_preview` (+/−/★ labels visible mid-drag),
   `V2_choice_deltas` / `V2_choice_keep` / `V2_choice_banish` (real clicks on "Giữ lại", "Loại (1 xúc xắc)", "Đổi").
   C018 waits 700 ms after the last attack before the dash press (a dash is buffered 120 ms; pressing during a
   non-cancellable strike is dropped by design).

### Perf (merged build, `tools/perf.mjs`, 30 enemies + ~110 projectiles + 30 hits/s, swiftshader, load avg ~2)
| metric (median of 3) | v1 baseline (`git archive 7458848`) | v2 merged | change |
|---|---|---|---|
| main-thread step / frame avg | 8.5 ms | 4.8 ms | −43 % |
| step p95 | 13.1 ms | 8.0 ms | −39 % |
| RunScene.update | 0.50 ms | 0.43 ms | — |
| script time / frame (CDP) | 10.4 ms | 5.4 ms | −48 % |
| task time / frame (CDP) | 12.1 ms | 6.9 ms | −43 % |
| game objects created / s | ~84 | ~4.9 | −94 % |
| fps (software GL) | 11.5 | 26.1 | ×2.3 |
| shader links in window | 0–1 | 0–1 | — |
Note: in v2 holding attack with the crossbow fires charged shots every ~1.5 s instead of auto-fire, so the player-side
load in this scenario is lighter than v1's (enemy load is identical). Raw rows: `out/perf/results.jsonl`.

### Best v2 screenshots
`out/smoke/08_v2_elite_telegraph.png` (elite + aim/charge telegraphs), `out/smoke/09_v2_charged_attack.png` (charge ring,
"Tụ đầy!"), `out/smoke/10_v2_perfect_dodge.png` ("Né hoàn hảo!", afterimages), `out/build_v2/03_drag_tablet_disable_preview.png`
(drag preview: −1 VÔ HIỆU, −2 ★0/3, combo loss line), `out/smoke/15_v2_choice_keep_banish.png` (deltas, kept card, banish),
`out/smoke/27_ch2_boss_fight.png` / `39_ch6_boss_fight.png` (boss fights). `out/build_v2/*` comes from
`SHOTS_DIST=dist node tools/build-shots.mjs`.

### Known gaps / risks (v2)
- Perfect dodge and parry smoke checks use real inputs, but the *threat* is placed by a probe hook at the right frame
  (headless frame pacing ~15–25 fps makes a natural 120 ms/150 ms coincidence unreliable). The rules are unit-tested.
- Balance of v2 pacing (windup + recovery per attack, 2–3 waves) is validated only by the abstract simulator and the bot;
  no human playtest. Ch1 floor 1 was eased; ch1 f2–f3 still field 7–13 bodies per room over 2–3 waves.
- Holding attack no longer auto-repeats light attacks (hold = charge) — also for crossbow/staff; players used to v1 hold-to-fire
  will notice. Greatsword taps faster than its chain window are dropped after the 120 ms buffer (intended commitment).
- Slow-mo (perfect dodge) scales scene `dt` only; tweens/sprite anims/delayed calls run at normal speed for those 350 ms.
- Boss kill times in smoke (3–80 s) are bot times in god mode; the modeled TTK for a normal run is 29–37 s.
- Real-GPU / phone FPS still not measured; perf numbers are swiftshader CPU-side.
- Late-game gold surplus (sim: 1.5–2.5k held in ch5–6) remains; needs new sinks (out of scope).

---

## v1 engine continuation run (history)
### Gates at v1 (all green)
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
_v2 note: smoke now takes more shots, so the numeric prefixes below shifted (e.g. ch1 combat room is `22_…`, inventory full `20_…`); names are unchanged._
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
