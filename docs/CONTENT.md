# Tháp Sao — Content reference (src/data/*)

> **V2 note (build/decision workstream):** some artifact numbers/descriptions, event costs (blood altar 25% max HP → epic+, companion 150+50/chapter, red fountain gold) and shop prices were retuned; see `docs/V2_BUILD.md` §3–4 for the authoritative list.

Owner: content agent. Engine reads everything through `src/data/types.ts` (unchanged — **no contract additions were
needed**). This file documents the open-ended vocabularies (mod keys, pattern params, special ids, grant keys…) so the
engine can implement them. All names/text are original; Sephiria was used only for mechanics/balance shape.

## Counts
| File | Count |
|---|---|
| artifacts.ts | 81 (33 common / 23 rare / 15 epic / 10 legendary), 26 `unlockedByDefault`, 12 with constraints |
| tablets.ts | 26 (7 `unlockedByDefault`) |
| combos.ts | 10 families (8 × tiers 2/4/6, companion + curse 3/5) |
| weapons.ts / weaponUpgrades.ts | 6 / 61 (8–11 per weapon, tiers 1–3) |
| enemies.ts | 30 (all 12 AiKinds) |
| bosses.ts | 12 (6 mini × 2 phases, 6 chapter × 3 phases) |
| chapters / miracles / potions | 6 / 8 / 6 |
| destiny.ts / talents.ts / costumes.ts | 31 nodes / 12 talents (40 total ranks) / 6 |
| strings.ts | 375 Vietnamese UI strings (superset of the engine's DEFAULT_STRINGS keys) |

Family sizes (by tag, active artifacts count once per tag; ×2 under `doubleTags`): glacier 9, ember 9, storm 9,
guardian 10, shadow 10, lake 10, windsong 12, academy 10, companion 10, curse 10 → every top tier is reachable.

## 1. Effect conventions
- Value at level L: `base + perLevel * L` (L = effective level, 0…maxLevel; artifacts start at 0). Combo/miracle effects
  are applied at level 0 so only `base` matters.
- `stat` without `pct`: flat add in the stat's own unit. For percentage-point stats (defense, evasion, critChance,
  critDamage, lifesteal, damagePct, cooldownPct, attackSpeed, moveSpeed, dashRecovery) the flat value *is* percentage
  points. `pct: true` multiplies the stat (`stat *= 1 + v/100`) and is only used on stats with a non-zero base
  (ice/fire/lightning/magic, maxMp, mpRegen, moveSpeed, attackSpeed, dashRecovery).
- `onHit.chance` / `perLevel` are **probabilities 0..1** (e.g. 0.15 + 0.05/level). `stacks` defaults to 1.
- `onKill.action`: `heal` (HP), `mp` (MP), `money` (extra Hạt Dẻ dropped), `explode` (AoE damage, radius ≈ 60 px, at the corpse).
- `onDash.action`: `trail` (damaging trail for 1.5 s; element = the artifact's family: ice for glacier), `shockwave`
  (radial knockback burst, radius ≈ 70 px), `shield` (absorb shield worth `value` HP for 2 s), `heal` (HP).
- `onHurt.action`: `thorns` (reflect `value` to the attacker), `nova` (radial knockback burst for `value`, internal
  cooldown 3 s), `mp` (restore MP).
- `periodic.action`: `orb` (homing water orb at nearest enemy), `lightning` (strike a random enemy on screen, applies
  Shock), `meteor` (AoE marker 0.6 s then fire impact r≈56 at nearest enemy), `heal` (HP), `frostRing` (ring around the
  player r≈90, applies 1 Frostbite). `every` is reduced by cooldownPct (engine already does this).
- `summon.companion`: `cmp_sprout` (ranged seed shooter), `cmp_bat` (melee dive, 20 % lifesteal to player),
  `cmp_wisp` (beam). `value` = damage per hit. One companion per summon effect (+1 slot via `extraCompanion`).
- `spell`: quick-slot spells (first two spell effects in the bag), `value` = power: icebolt/fireball/chainLightning/
  arcaneMissiles → damage (arcaneMissiles: per missile, 5 missiles); shieldBubble → absorb HP for 4 s; blink → distance px.
  Spell damage scales with MagicDamage.

### Special hook ids (`{kind:'special'}`), `value` = scaled number
| id | meaning |
|---|---|
| freezeShatter | Frozen enemies take +value % damage |
| phoenixRevive | Once per floor, on death revive with value % max HP |
| lightningRod | Shock chains +1 extra target and shocked enemies take +value % extra damage |
| guardCounter | Perfect guard releases a counter hit dealing `value` damage (arc in front) |
| backstab | Hits from behind the target (>100° from its facing) deal +value % |
| manaShield | value % of incoming damage is paid from MP first (1 MP per 1 HP) |
| dashStrike | Dash-attack damage +value % |
| galeDash | Each dash leaves a tornado (1.5 s, pulls) dealing `value` per 0.5 s |
| spellCrit | Spells gain +value % crit chance |
| spellEcho | value % chance a cast spell repeats for free |
| companionDamage / companionHaste / companionCrit | companions +value % damage / action speed / crit chance |
| extraCompanion | +value companion slots |
| companionShare | each companion hit heals the player value % max HP (max once per second) |
| debuffAmp | +value % damage to enemies with any status |
| doomMark | every 10th player hit deals `value` extra (curse, ignores defense) |

Multiple specials with the same id add up (engine `specialsOf` already sums).

## 2. Constraints & tablets
Constraints: `touchEdge` (any footprint cell on that bag edge), `emptyNeighbor` (every cell directly in `dir` from the
footprint that lies inside the bag is empty; out-of-bag counts as empty), `cornerOnly` (some cell on a bag corner),
`noOtherOfTag` (no other artifact in the bag carries that tag).
Tablet `targets.at` are offsets at rotation 0 with **x → right, y → down** (up = `[0,-1]`), rotate with the tablet.
`copy`: the artifact at the target copies effects of the artifact on the opposite side of the tablet (engine resolves
`opp`). Tablet icons are drawn procedurally from these targets (green arrow +1, double/triple heads +2/+3, red = −,
orange arrow + ring = ignore constraint, star = +max level, ×2 = double tags, cyan + two squares = copy, curved "hop"
arrow = target two cells away). Regenerate icons whenever targets change.

## 3. Weapons
`range`/`arc` in on-screen px/degrees (arc 0 = projectile weapon), `attackInterval` seconds per combo hit at 100 %
attack speed, `baseCoef` per combo hit. Staff element defaults to fire (aspects override); staff damage should blend
50 % weapon element stat + 50 % magic.

### Weapon upgrade mod keys (WeaponUpgradeDef.mods) — shared vocabulary
| key | value | meaning |
|---|---|---|
| extraHit | int | append N hits to the basic combo (coef = last hit × 0.9) |
| specialCostPct | number (−30) | special MP cost change in % |
| aspect | 'fire'\|'ice'\|'lightning' | convert weapon damage element (scales with that stat; hits have 15 % chance to apply burn/frostbite/shock) |
| pierce | int | projectiles/lines pass through N extra enemies (99 = all) |
| magazine | int | crossbow magazine +N |
| reloadPct | number (−30) | reload time change in % |
| furyDuration | seconds | dagger Fury duration +N |
| rangePct | number | attack range (or nova radius for staff) +% |
| arcPct | number | swing arc +% |
| dashAttack | true | dashing through enemies deals a weapon hit (coef 1.0) |
| guardCostPct | number (−40) | MP per blocked hit change in % |
| chargeSpeedPct | number | charge/draw time faster by % |
| projectileCount | int | extra projectiles per shot (fanned 12° apart) |
| homing | number 0..1 | turn rate factor for projectiles (0.5 slight, 1 strong) |
| critOnPerfect | true | perfect guard counter / perfect iaido release always crits |
| knockbackPct | number | knockback +% |
| damagePct | number | weapon damage +% (can be negative) |
| attackSpeedPct | number | weapon attack speed +% (can be negative) |
Mods stack additively across owned upgrades. Every weapon has 3 mutually-exclusive tier-2 aspects (`<w>_aspect_fire|ice|lightning`).
`requires` always point to lower-tier upgrades of the same weapon; tier gating per floor is the engine's choice
(suggest: tier 1 chapters 1–2, tier ≤2 chapters 3–4, all from chapter 5).

## 4. Enemies — AI params
Base values in enemies.ts are chapter-1-equivalent and multiplied by chapter scaling
(`HP_SCALE = [1,1.5,2.2,3.1,4.3,6]`, `DMG_SCALE = [1,1.35,1.75,2.2,2.75,3.4]`, money ×[1…2.5], xp ×(1+0.4·(ch−1))); the
exported numbers are already scaled. Speeds in px/s, times in seconds, angles in degrees.
| ai | params used |
|---|---|
| chaser | contactCooldown, hopInterval, swarmSize (spawn N together), jitter, lungeRange/lungeSpeed/telegraph, swoopInterval/swoopSpeed, circleRadius |
| charger | chargeSpeed, telegraph (line marker), chargeDuration, cooldown, stunOnWall, bounces, slamRadius, trailFire |
| shooter | bulletSpeed, fireRate (s between shots), telegraph (flash), keepDistance, bulletCount (burst size), burstGap |
| spread | bulletCount, spreadDeg (total fan), bulletSpeed, fireRate, telegraph, keepDistance |
| ring | bulletCount, bulletSpeed, fireRate, telegraph, keepDistance |
| lobber | fireRate, telegraph (= red circle lifetime), aoeRadius, lobRange, keepDistance, shards (bullets on impact), hover |
| summoner | summonInterval, summonCount, maxMinions, telegraph, keepDistance (minion = first chaser/exploder of the chapter) |
| shielded | shieldArc (frontal block °), turnSpeed (rad/s), contactCooldown, bashTelegraph / slamTelegraph+slamRadius / slashTelegraph+slashRange, bulletCount+bulletSpeed (ring on slam) |
| exploder | fuse, triggerRange, aoeRadius, telegraph |
| teleporter | teleportInterval, telegraph (circle at destination), emergeRadius, bulletCount, bulletSpeed, applyFrostbite |
| turret | bulletCount, spiralStep (° per volley) or spreadDeg, bulletSpeed, fireRate, telegraph (speed 0 = immobile) |
| healer | healAmount, healRadius, healInterval, keepDistance, bulletSpeed/fireRate (weak shot), shieldAllies |
Elites (`elite: true`): snow_golem_small, piston_brute, star_knight.

## 5. Boss patterns (BossAttack.pattern + params)
Common: `telegraph` = seconds the warning (red marker / flash) is shown before damage. `speed` px/s. Damage = boss
`damage` × `damageMul` (default 1).
| pattern | params |
|---|---|
| ring | count (bullets), speed, telegraph, waves (default 1), waveGap (s; each wave offset by half a step) |
| spiral | arms, speed, rate (volleys/s), duration (s), turnDeg (rotation per volley) |
| crossWave | arms (4 = +, 8 = +×), count (bullets per arm line), speed, waves, waveGap, rotateDeg (rotation between waves) |
| aimedBurst | count (bullets per burst), spreadDeg (fan), speed, bursts, burstGap, telegraph |
| charge | telegraph (line), speed, duration, count (consecutive charges, re-aimed), bounces (wall bounces) |
| slam | telegraph (circle), radius, damageMul, shards (optional ring of bullets on impact) |
| summon | count → spawns `count` enemies chosen from the phase's `summon` list (every phase using it has one) |
| laserSweep | telegraph (thin line preview), width (px), sweepDeg, duration, beams (evenly spaced) |
| rainMarkers | count, radius, telegraph, area (px radius around the player where markers land; first marker on the player) |
| teleportStrike | telegraph (circle at destination), count (consecutive blinks), radius (AoE on arrival), gap (s) |
| shieldPhase | duration (invulnerable), reflect (1 = reflect projectiles), telegraph |
| minefield | count, radius (blast), armTime (s before armed), life (s before auto-detonation) |
`weight` = relative pick chance inside the phase. `phase.summon` ids are spawned once when the phase starts (and by
`summon` attacks). `onEnter` hooks (engine, cosmetic + small arena hazard): `enrage` (+20 % speed), `blizzard`
(slow-field tint), `splitShadow` (spawn 1 decoy with 1 HP), `rootsArena` (roots hazard ring at arena edge),
`goldRage`, `shelvesFall` (3 falling-shelf markers), `iceCrack` (cracked-ice slow tiles), `overdrive`, `supernova`
(screen flash, 1 s invuln transition). Unknown hooks may be treated as a flash + 1 s pause. Mini-boss phases:
`hpBelow` 1 / 0.5; chapter bosses 1 / 0.66 / 0.33. Boss HP is final (no chapter scaling).

## 6. Meta
### Destiny grant keys (DestinyNode.grant)
`homeRepair` (1 → unlocks talents), `talentPoints` (5 per node, 25 total), `seedMoney` (Hạt Dẻ at run start, sums to
600), `startDice` (sums to 6), `bagCols` (+2 → 7), `bagRows` (+1 → 5), `sideBag` (4 cells), `levelUpHeal` (% max HP on
level up, sums to 60), `unlockWeapon` (value = WeaponId), `unlockArtifacts` (value = number of extra artifacts added
to the drop pool, 30 total; suggested order: cheapest locked first by rarity), `potionSlot` (+1 each, 2 nodes),
`hardMode` (gate; still needs a win), `pocketDimension` (enables the Pocket event), `chestReroll` (1 reroll of a money
chest per floor). `pos` = `[column −4..4, row 0..8]` grid units, root at `[0,0]` bottom; suggest 110×72 px spacing.
> ⚠️ Engine `src/systems/meta.ts` (as of this writing) reads `homeRepairs`, `artifactPool`, `hardModeGate`,
> `startMaxHp/startLuck/startBarter`. The assignment's key list (above) is what the data uses — engine should read
> `homeRepair`, `unlockArtifacts`, `hardMode`, `seedMoney`, `startDice`, `bagCols`, `bagRows`, `sideBag`,
> `levelUpHeal`, `potionSlot`, `pocketDimension`, `chestReroll`.
>
> ✅ Engine note (2026-10-10): resolved. `src/systems/meta.ts` + `run.ts` now read exactly the keys above via
> `grantSum`/`grantList` (tests "grant keys present", "unlockArtifacts adds", "levelUpHeal", "chestReroll"). The legacy
> `startMaxHp/startLuck/startBarter` reads are harmless no-ops (no node grants them). No content was changed.

### Costumes
`unlock.kind` vocabulary: `bossesKilled`, `chapterReached`, `artifactsFound`, `winRuns` (also reserved: runsStarted,
comboTier6, totalSapphires). `stats` are flat stat mods; `fixedHp` overrides max HP and ignores level-up HP;
`startItems` are artifact ids placed into the bag at run start.

### Potions
`action`: heal (value = fraction of max HP), rage (+value % damage), iron (+value defense points), swift (+value %
move & attack speed), mana (fraction of max MP), mystery (random among the others or a mild bad effect, identified on
first drink). `duration` seconds.

### Talents
`perRank` flat on `stat` (critChance/critDamage/barter in points). 12 talents, 40 total ranks vs 25 points.

## 7. Balance notes
- Player baseline: 50 HP, 20 dmg/element. Chapter-1 trash dies in 2–4 hits (slime 40 HP); elites/minis are 10–20×
  trash. Bosses are tuned for ~60–90 s fights with a mid build (≈ +60–100 % damage by chapter 3).
- Artifact power budget per cell ≈ common 1.0, rare 1.4, epic 1.9, legendary 2.6 "units" (1 unit ≈ +3 flat element
  damage or +3 % defense at level 0). Legendaries get maxLevel 5, commons 2–3. Constraints buy ~+30 % budget.
- Tablets: +1 patterns scale with neighbours (cross/X up to +4 levels total); trade-offs give +2/+3 at a −1/−2 cost
  that can **disable** (level ≤ −1) cheap neighbours — intended as a puzzle.
- Combo top tiers are run-defining but need 6 tags (or 3/5 for companion/curse); `doubleTags` tablets make them
  reachable with fewer items.
- Prices: common 70–110, rare 160–240, epic 320–420, legendary 760–900 Hạt Dẻ (tablets 60–800). Sell = 40 %.

## 8. Icons (`icons_items` atlas)
`public/assets/sprites/icons_items.png/.json` (Phaser JSON-hash, 107 frames of 96×96: `art_<id>` ×81, `tab_<id>` ×26),
registered in `public/assets/manifest.icons.json`. Rebuild: `python3 art/tools/build_icons.py` (needs numpy, scipy,
Pillow, npx tsx). Raw generations: `art/raw_icons/grid1..6.png` (+ `ref_icons.jpg` crop of the style reference);
component→id mapping lives in `build_icons.py` (`MAP`); prompts in `art/tools/prompt_grid*.txt`,
`art/tools/icon_subjects.json`. Contact sheet: `art/sheets/icons_items_sheet.png`. Adding an artifact = add a
subject, generate a small grid, extend `MAP`, rerun.

## 9. Tests
`src/data/content.test.ts` (17 tests). ✅ The engine's `vite.config.ts` now includes `src/**/*.test.ts`, so `npm test`
runs these 17 tests together with the engine tests.
