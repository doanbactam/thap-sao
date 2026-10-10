# Tháp Sao — V2 build / decision depth

_Workstream: grid inventory, tablets, combos, economy, choices. Scope rule: optimise existing features, **no new
artifacts / tablets / combos / items** (only numbers, tags, descriptions and logic changed)._

## 1. Inventory clarity (live placement preview)
`placementPreview()` in `src/systems/inventory.ts`, drawn by `GridView.drawPreview()` (`src/ui/gridView.ts`).
While dragging or rotating (Q/E/R, right-click, "Xoay"), **before dropping**:
- footprint cells green/red (fits / blocked);
- every **tablet target cell** outlined green (+), red (−) or yellow (special op) with its op (`+1`, `-1`, `+1★max`, `×2 bộ`, `chép`, `tự do`), dimmed when the cell holds no artifact;
- every **artifact whose state changes** is outlined and labelled: level change (`+2`, `-1`), resulting stars (`★2/3`), `VÔ HIỆU` when it drops to level ≤ −1, `tắt`/`bật` when its constraint/activation flips — including the dragged artifact itself (`★1/3`, `! điều kiện`);
- **combo progress** above the grid, e.g. `Băng Hà 1→2/4 ★1 kích hoạt!` or `Băng Hà 2→1/2 (mất ★1)`; moving an item compares against the pre-drag snapshot, so the readout is the *net* change.
- Disabled artifacts (level ≤ −1) now carry a red X per cell + red frame + `VÔ HIỆU (cấp −1)`; constraint-inactive ones a red frame + `! điều kiện`.
- Tablet hover outlines are green/red/yellow by op sign.

## 2. Choice quality
All in `src/systems/run.ts` (offers) and `src/systems/build.ts` (deltas):
- **Build-aware weights** (`offerWeight`, knobs `OFFER`): +0.25 per owned artifact sharing a tag (cap 4), +0.6 when one more tag reaches the next combo threshold, +0.5 for the artifact's `weaponBias` (the field existed but was never read).
- **Pity**: after 3 artifact offers in a row with nothing matching the bag's tags, one option is replaced by a build-matching one.
- **Lock / banish** with existing currency: "Giữ lại" (free) keeps a card through the dice reroll; "Loại (1 xúc xắc)" banishes it for the rest of the run and refills the slot. Reroll keeps the offer's rarity floor (mini-boss / blood altar).
- **Rarity per floor**: `rarityWeights(luck, chapter, floor)` interpolates inside a chapter (floor 1 = v1 values).
- **Rarity floor honoured** (bug): a "rare+" drop on a fresh save (no rare+ unlocked) used to fall back to commons. It now pulls from the next 6 locked items of that rarity.
- **Concrete delta on every card** (`choiceDelta`): power change (`▲ Sức mạnh +20%`), up to 3 lines of stat changes with before→after (`HP tối đa +10 (58→68)`), and combo progress. Computed at the spot the item will actually go: picking an item now uses `addBest()` (best spot by power, constraint-aware), not first-fit. Shop items show the same `+x% sức mạnh` and combo line.
- Power = `src/systems/power.ts`: DPS (weapon hits, statuses, chains, procs, spells, companions, weapon special from the MP budget) × effective HP (HP, defense, evasion, sustain, shields, mana shield, phoenix, mobility), normalised to 100 for a fresh Kiếm & Khiên hero. It is a heuristic for ranking options, not a combat simulation.

## 3. Economy & risk/reward (`ECON` in `src/systems/run.ts`)
| Lever | v1 | V2 |
|---|---|---|
| Shop prices | flat | +10% per chapter (`inflation`) |
| Potion in shop | 60 | 40 + 12/chapter |
| Heal | none | **Băng bó**: +35% max HP for 30 + 9/global floor, once per shop |
| Enchant | altars only | **Cường hóa** in shops: +1 level for (60 + 0.4·price)·(level+1)·inflation, +50% per extra enchant in the same shop |
| Shop reroll | 1 die only | 1 die, or gold when out of dice (30, +25 per reroll in that shop) |
| Blood altar | 33% *current* HP → rare+ (actually common on fresh saves) | **25% max HP → epic+ choice**, exact HP before/after shown |
| Companion stall | 500 gold (unaffordable in ch1–3) | 150 + 50/chapter |
| Red fountain | waves, no reward | 90 + 45/chapter gold up front, then 2 waves |
| Destiny "Rương May Mắn" | granted but never read | money chest pays the better of 2 rolls once per floor |
Event dialogs show the stakes of each option under its button (`eventStakes`): HP cost and what is left, gold cost vs held, XP/gold amounts, and the obelisk's **exact** stat swap (resolved on a clone with the same RNG state, so the preview is the real outcome).

## 4. Synergy audit (numbers/logic only)
Found with an isolated-value scan (power gain of each artifact alone at max level) + the simulator:
- **Dead element stats**: `+Ice/+Fire/+Lightning` did nothing on the 5 physical weapons (procs used flat values). Now elemental procs (frost ring, meteor, lightning strike, element-tagged explode/trail/shockwave/thorns/nova, combo procs) scale with the element stat **relative to the level baseline** (`procScale`, `procDamage` in effects.ts/specials.ts; one line in `RunScene.doAction`). Physical procs keep v1 values.
- `g_frost_shard`, `e_ember_coal`, `s_spark_bead` (pure +element, dead on physical): gained a small on-hit status (8% frostbite / 8% burn / 5% shock), so the element stat powers their status.
- `sh_smoke_pellet` was an exact duplicate of `w_swift_sandals` → now dash recovery 8+4% and +10+4% evasion while out of dashes.
- `l_koi_charm` duplicated `c_wisp_lantern` with a worse shape + constraint → wisp 14+5 dmg.
- Overtuned per cell: `cu_witch_candle` lifesteal 2+1 → 1+1 (low-HP bonus 3+2 → 2+1); `gd_stone_amulet` nova 20+10 → 16+8; `s_static_sock` shock 5+3 → 4+2%; `s_spark_bead` shock 5+1%.
- Undertuned: `g_cold_mittens` frostbite 10+2 → 15+4%; `w_dandelion_seed` luck 2+1 → 3+2; spell books lost to the weapon special for MP → icebolt 30+10 → 40+14, fireball 40+12 → 52+16, chain 30+10 → 38+13.
- `KNOWN_SPECIALS` listed 8 ids that do not exist → now the 17 implemented hooks. `a_ink_pot` text said "kill with a spell" but fires on any kill → text fixed.
- Remaining *conditional* zeros are payoffs by design (glacier heart, lightning rod, hex doll, grimoire, acorn snack, bone dice need their enabler).
Guard tests in `tests/build_v2.test.ts` (no duplicate effect lists, special registry = engine hooks, element commons carry a status).

## 5. Balance simulator
`src/systems/sim.ts`, run with `npm run sim` (vitest; env `SIM_RUNS`, `SIM_POLICY=greedy|casual|random|both`, `SIM_META=fresh`, `SIM_IMMORTAL=1`, `SIM_OUT`). Plays whole runs through the **real run model** (floor maps, node rewards, choices, shops, services, events, XP, bosses, potions, phoenix) with an abstract combat model: room clear time = enemy HP / power DPS, damage taken = time × living enemies' damage × hit rate × skill noise ÷ (EHP/HP) (`COMBAT` knobs). Policies: **greedy** (power + combo planning, rerolls with lock, enchants, gold rerolls), **casual** (biggest immediate power gain, no rerolls), **random**. Default profile = mid-progress meta (bag +1 col, side bag, shelves I–II, 2 dice, 200 seed money).

### Headline results (120 runs each, mid-progress meta, seeds 1000+)
| Policy | Win | ≥1 active combo on reaching ch3 | **Tier-2 combo (4+ tags) on reaching ch3** | Max take-rate when offered |
|---|---|---|---|---|
| greedy | 43% | 100% | **85%** | 57% |
| casual | 35% | 100% | **76%** | 64% (`s_spark_bead`) |
| random | 0% (avg ch 3.2) | 100% | **27%** | — |
| casual, v1 offers (no weights/pity), 100 runs | 34% | 100% | 56% | 72% (`s_spark_bead`) |
| random, v1 offers, 100 runs | 0% | 100% | 8% | — |
| casual, fresh save, 80 runs | 61% | 100% | 57% | 54% |

**Judgment call on the 60–75% target.** With tier-1 thresholds at 2 tags and 10 families, "≥1 active combo by chapter 3" is ~100% for every policy, **already in v1** (2 of ~10 artifacts sharing a family is near certain). Hitting 60–75% on that metric would mean raising tier-1 to 3+ tags (tested: still 88–100%), i.e. reworking every combo; I did not. The meaningful build milestone is a **tier-2 combo (4 same-family tags)**: I tuned offers so a casual player lands at ~76% (top of the band; 56% with v1 offers), a planner ~85%, a random clicker ~27% — builds form, but intent matters.

**Gold (casual):** held gold stays 240–720 through ch1–3 (real heal-vs-buy-vs-enchant tension; ~870 gold/run goes to healing, ~4.7k to enchants, ~800 to items), then piles to 1.5–2.5k in ch5–6 (late surplus, see risks).
**Power:** 100 → ~320 end of ch1 → ~650 end of ch3 → ~1800 end of ch6 for casual (power is the multiplicative DPS×EHP index above).
**Dominance:** no artifact is taken >64% of the time it is offered (3 options → 33% is neutral). "Share of final builds" is dominated by the **pool**: shelves I–II unlock only 6 rares (`c_paw_print`, `l_clam_pearl`, `gd_turtle_shell`, `g_cold_mittens`, `s_storm_kite`, `sh_moon_dagger`), and every gate/mini-boss drop is rare+, so those six appear in 58–83% of mid-meta final builds even for the random policy — that is unlock order, not item strength.

### Full tables
## Sim: policy=casual, meta=mid-progress, runs=120
win 35% · reach ch3 100% · avg chapter reached 5.49
≥1 active combo on reaching ch3: 100% of runs that reached it (100% of all) · at end of ch3: 100% · tier≥2 combo on reaching ch3: 76%
largest tag count on reaching ch3 (0..7+): 0% 0% 8% 16% 38% 20% 12% 7%
avg spend/run: items 788 · heal 870 · enchant 4670 · events 128 · rerolls 0.0
| floor | alive | gold held | gold earned (cum.) | power | active combos |
|---|---|---|---|---|---|
| 1-1 | 100% | 318 | 352 | 157 | 0.46 |
| 1-2 | 100% | 235 | 529 | 243 | 1.77 |
| 1-3 | 100% | 318 | 806 | 323 | 2.58 |
| 2-1 | 100% | 364 | 1095 | 378 | 2.72 |
| 2-2 | 100% | 426 | 1420 | 424 | 2.84 |
| 2-3 | 100% | 675 | 1971 | 472 | 2.88 |
| 3-1 | 100% | 710 | 2400 | 524 | 2.89 |
| 3-2 | 100% | 803 | 2886 | 581 | 3.03 |
| 3-3 | 100% | 1101 | 3568 | 649 | 3.13 |
| 4-1 | 98% | 1224 | 4156 | 710 | 3.20 |
| 4-2 | 97% | 1329 | 4783 | 770 | 3.20 |
| 4-3 | 91% | 1575 | 5631 | 855 | 3.16 |
| 5-1 | 83% | 1576 | 6353 | 965 | 3.21 |
| 5-2 | 68% | 1736 | 7154 | 1092 | 3.22 |
| 5-3 | 58% | 2079 | 8204 | 1237 | 3.29 |
| 6-1 | 51% | 2244 | 9151 | 1382 | 3.34 |
| 6-2 | 42% | 2456 | 10250 | 1573 | 3.34 |
| 6-3 | 35% | 2546 | 11216 | 1786 | 3.50 |
most-taken artifacts (take rate when offered, share of final builds): s_spark_bead 64%/46%, s_static_sock 59%/40%, gd_wooden_buckler 57%/54%, gd_stone_amulet 54%/28%, g_frozen_tear 54%/2%, a_blink_card 53%/1%, cu_rusty_nail 52%/22%, sh_cat_bell 52%/37%
most common in final builds: gd_turtle_shell 83%, c_paw_print 66%, l_clam_pearl 65%, s_storm_kite 58%, gd_wooden_buckler 54%, s_spark_bead 46%, s_static_sock 40%, sh_cat_bell 37%

## Sim: policy=greedy, meta=mid-progress, runs=120
win 43% · reach ch3 100% · avg chapter reached 5.60
≥1 active combo on reaching ch3: 100% of runs that reached it (100% of all) · at end of ch3: 100% · tier≥2 combo on reaching ch3: 85%
largest tag count on reaching ch3 (0..7+): 0% 0% 3% 13% 35% 19% 22% 9%
avg spend/run: items 967 · heal 869 · enchant 4981 · events 109 · rerolls 12.1
| floor | alive | gold held | gold earned (cum.) | power | active combos |
|---|---|---|---|---|---|
| 1-1 | 100% | 319 | 352 | 157 | 0.57 |
| 1-2 | 100% | 212 | 521 | 244 | 2.10 |
| 1-3 | 100% | 305 | 790 | 321 | 2.70 |
| 2-1 | 100% | 362 | 1070 | 380 | 2.93 |
| 2-2 | 100% | 424 | 1400 | 431 | 2.92 |
| 2-3 | 100% | 635 | 1921 | 486 | 2.98 |
| 3-1 | 100% | 655 | 2350 | 546 | 3.02 |
| 3-2 | 100% | 739 | 2861 | 601 | 3.04 |
| 3-3 | 99% | 939 | 3542 | 661 | 3.17 |
| 4-1 | 98% | 1017 | 4113 | 730 | 3.22 |
| 4-2 | 98% | 1113 | 4759 | 810 | 3.32 |
| 4-3 | 95% | 1408 | 5611 | 893 | 3.23 |
| 5-1 | 88% | 1487 | 6342 | 1003 | 3.30 |
| 5-2 | 78% | 1479 | 7123 | 1137 | 3.30 |
| 5-3 | 66% | 1707 | 8148 | 1277 | 3.32 |
| 6-1 | 54% | 1869 | 9120 | 1460 | 3.35 |
| 6-2 | 47% | 2042 | 10203 | 1624 | 3.36 |
| 6-3 | 43% | 2160 | 11190 | 1795 | 3.39 |
most-taken artifacts (take rate when offered, share of final builds): gd_stone_amulet 57%/29%, gd_wooden_buckler 57%/59%, l_dew_drop 55%/8%, s_spark_bead 54%/51%, s_static_sock 53%/36%, cu_rusty_nail 51%/23%, w_dandelion_seed 51%/17%, c_paw_print 50%/65%
most common in final builds: gd_turtle_shell 68%, c_paw_print 65%, s_storm_kite 63%, gd_wooden_buckler 59%, l_clam_pearl 57%, s_spark_bead 51%, s_static_sock 36%, gd_stone_amulet 29%

## Sim: policy=random, meta=mid-progress, runs=120
win 0% · reach ch3 76% · avg chapter reached 3.18
≥1 active combo on reaching ch3: 100% of runs that reached it (76% of all) · at end of ch3: 100% · tier≥2 combo on reaching ch3: 27%
largest tag count on reaching ch3 (0..7+): 0% 0% 29% 42% 24% 3% 1% 1%
avg spend/run: items 1011 · heal 187 · enchant 0 · events 43 · rerolls 0.0
| floor | alive | gold held | gold earned (cum.) | power | active combos |
|---|---|---|---|---|---|
| 1-1 | 100% | 355 | 383 | 140 | 0.12 |
| 1-2 | 100% | 352 | 570 | 190 | 1.14 |
| 1-3 | 99% | 459 | 866 | 243 | 2.11 |
| 2-1 | 98% | 502 | 1141 | 283 | 2.60 |
| 2-2 | 93% | 626 | 1460 | 319 | 2.79 |
| 2-3 | 76% | 915 | 1910 | 355 | 2.76 |
| 3-1 | 67% | 1134 | 2278 | 385 | 2.69 |
| 3-2 | 53% | 1470 | 2684 | 426 | 2.62 |
| 3-3 | 33% | 1956 | 3239 | 479 | 2.51 |
| 4-1 | 21% | 2392 | 3775 | 526 | 2.60 |
| 4-2 | 15% | 2864 | 4278 | 575 | 2.61 |
| 4-3 | 9% | 3600 | 5135 | 601 | 2.36 |
| 5-1 | 4% | 3925 | 5667 | 657 | 2.00 |
| 5-2 | 3% | 4307 | 6230 | 651 | 2.00 |
| 5-3 | 2% | 5356 | 7739 | 636 | 2.50 |
| 6-1 | 1% | 6916 | 9227 | 586 | 3.00 |
| 6-2 | 0% | – | – | – | – |
| 6-3 | 0% | – | – | – | – |
most-taken artifacts (take rate when offered, share of final builds): e_pepper_pouch 32%/9%, cu_toad_vial 32%/7%, c_sprout_pot 29%/8%, w_wind_whistle 27%/11%, c_acorn_snack 25%/15%, sh_cat_bell 24%/7%, c_friend_badge 24%/12%, sh_smoke_pellet 24%/8%
most common in final builds: c_paw_print 74%, l_clam_pearl 68%, s_storm_kite 63%, gd_turtle_shell 61%, g_cold_mittens 44%, gd_wooden_buckler 16%, c_acorn_snack 15%, e_ember_coal 12%

## Sim: policy=casual, meta=fresh, runs=80
win 61% · reach ch3 100% · avg chapter reached 5.76
≥1 active combo on reaching ch3: 100% of runs that reached it (100% of all) · at end of ch3: 100% · tier≥2 combo on reaching ch3: 57%
largest tag count on reaching ch3 (0..7+): 0% 0% 15% 26% 31% 11% 9% 8%
avg spend/run: items 973 · heal 955 · enchant 6185 · events 158 · rerolls 0.0
| floor | alive | gold held | gold earned (cum.) | power | active combos |
|---|---|---|---|---|---|
| 1-1 | 100% | 151 | 151 | 152 | 0.26 |
| 1-2 | 100% | 210 | 335 | 226 | 1.46 |
| 1-3 | 100% | 336 | 638 | 304 | 2.25 |
| 2-1 | 100% | 371 | 948 | 368 | 2.54 |
| 2-2 | 100% | 431 | 1335 | 420 | 2.73 |
| 2-3 | 100% | 611 | 1886 | 482 | 2.91 |
| 3-1 | 100% | 581 | 2318 | 546 | 2.96 |
| 3-2 | 100% | 625 | 2796 | 628 | 2.99 |
| 3-3 | 100% | 811 | 3462 | 725 | 3.01 |
| 4-1 | 100% | 831 | 4053 | 805 | 3.02 |
| 4-2 | 100% | 884 | 4716 | 885 | 3.15 |
| 4-3 | 99% | 1074 | 5568 | 980 | 3.18 |
| 5-1 | 91% | 1112 | 6247 | 1110 | 3.12 |
| 5-2 | 88% | 1103 | 7009 | 1251 | 3.11 |
| 5-3 | 78% | 1340 | 8031 | 1431 | 3.15 |
| 6-1 | 73% | 1398 | 8964 | 1596 | 3.17 |
| 6-2 | 70% | 1500 | 9984 | 1820 | 3.13 |
| 6-3 | 61% | 1651 | 10916 | 2052 | 3.08 |
most-taken artifacts (take rate when offered, share of final builds): sh_cat_bell 54%/53%, c_paw_print 52%/33%, s_static_sock 51%/61%, cu_rusty_nail 51%/30%, gd_wooden_buckler 49%/81%, s_spark_bead 49%/53%, e_ember_coal 38%/18%, g_frost_shard 36%/13%
most common in final builds: gd_wooden_buckler 81%, s_static_sock 61%, l_clam_pearl 53%, sh_cat_bell 53%, s_spark_bead 53%, gd_turtle_shell 48%, s_storm_kite 44%, s_copper_coil 40%

## 6. Tests and tools
- `tests/build_v2.test.ts` (23 tests): placement preview (tablet signs, level change, disable, self state, net change on move, invalid-spot targets), combo progress, offer weights, pity, lock/banish/rarity floor, rarity per floor, choice deltas, best placement, shop heal/reroll/enchant pricing, blood altar, obelisk stakes, companion/red fountain, Destiny chest reroll, proc scaling, audit guards.
- `tests/sim.test.ts`: determinism, a 30-run casual smoke (combos form, tier-2 rate in a loose band, power grows ×2 by ch3, no artifact taken ≥85% when offered), `npm run sim` report.
- `tools/build-shots.mjs`: screenshots of the drag preview, choice cards, shop services, event stakes (`out/build_v2/`; needs `npx vite build --outDir work/dist_build_v2`).

## 7. Risks / open items
- The simulator's combat is abstract; absolute win rates are not predictions. Use it for relative comparisons (policy vs policy, before vs after a change).
- Late-game gold surplus (1.5–2.5k held in ch5–6). Further sinks would need new features (out of scope) or steeper inflation.
- Shelf unlock order (`lockedOrder`: cheapest first) makes mid-progress pools thin in rares and adds weak commons first (pool dilution: fresh-save casual wins more than mid-progress in the sim).
- `choiceDelta` / `bestPlacement` evaluate up to ~80 placements per card; fine on desktop, untested on low-end phones (runs only when a choice/shop opens).
- Elemental procs now grow with element investment; a dedicated element stack (e.g. +lightning% items + storm combo) can roughly double proc damage (clamped at ×4).
