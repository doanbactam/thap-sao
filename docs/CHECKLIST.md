# Tháp Sao — Feature checklist (SPEC §2–§9)

Each line is ticked only when a unit test (`tests/*.test.ts`, run by `npm test`) or the scripted browser
playthrough (`tools/smoke.mjs`, run by `npm run smoke`) proves it. Proof reference in brackets.

## §2 Core stats & combat
- [x] C001 Base stats: HP 50, MP 50, 4 damage types 20, def 0, eva 0, crit 0 / critDmg +50%, atkSpd/move 100%, dash 2 — proof: test "base values match spec"
- [x] C002 MP regen 4/s only after 1.5 s without spending — proof: test "mp regen 4/s"
- [x] C003 Base move speed 150 px/s scaled by MoveSpeed % — proof: test "move speed 150"
- [x] C004 Defense is % reduction capped at 75% — proof: test "defense capped"; test "target defense reduces"
- [x] C005 Evasion is % dodge chance capped at 60% — proof: test "incoming: evasion"
- [x] C006 Damage formula base(element stat) × coef × (1+%bonus) × crit(1.5+critDmg) × (1−def) — proof: test "base * coef"; test "percent bonus"; test "crit multiplier"
- [x] C007 Luck raises higher-rarity chance (+1.16% tier weight per point) — proof: test "luck raises higher tiers"
- [x] C008 Barter: shop price −1%/pt, sell +1%/pt — proof: test "barter buy/sell"
- [x] C009 Lifesteal heals % of damage dealt — proof: test "lifesteal"
- [x] C010 MagicDamage scales spells only — proof: test "spells scale with magic only"
- [x] C011 XP from kills; level-up +5 max HP, +2 all damage, full MP — proof: test "xp levels"; test "level mods +5 hp"; test "xp level up gives full MP"
- [x] C012 Burn: stacking DoT lasting 3 s — proof: test "burn stacks"
- [x] C013 Frostbite stacks → Freeze at 5 stacks for 1.5 s — proof: test "frostbite freezes"
- [x] C014 Shock chains to 3 targets and adds +15% damage taken — proof: test "shock +15%"
- [x] C015 Poison DoT — proof: test "poison dot"
- [x] C016 Wound: bleed bonus on hit — proof: test "wound adds bleed"
- [x] C017 Stun status prevents acting — proof: test "stun disables"
- [x] C018 Dash 0.18 s, 140 px, i-frames — proof: test "dash recharge"; smoke C018_dash
- [x] C019 Dash charges (2) recover 1 per 1.2 s scaled by DashRecovery — proof: test "dash recharge"
- [x] C020 Guard blocks frontal 120° arc and costs MP per blocked hit — proof: test "guard frontal"
- [x] C021 Perfect guard (≤0.15 s) costs no MP and stuns the attacker — proof: test "guard frontal"
- [x] C022 Knockback, hit-stop, screen shake, damage numbers in real combat — proof: smoke C022_real_combat

## §3 Weapons
- [x] C023 Kiếm & Khiên: 3-hit combo + Shield Bash special (20 MP) + guard — proof: test "sword&shield 3-hit"
- [x] C024 Đại Kiếm: 2-hit heavy wide arc with knockback + charged spin (25 MP) + super armor — proof: test "greatsword 2-hit"
- [x] C025 Dao Găm: 4-hit fast + shadow-step backstab (15 MP) + Fury meter (+50% speed 5 s) — proof: test "dagger 4-hit"
- [x] C026 Kiếm Cong: 3-hit with lunge + Iaido hold/release dash-slash; perfect release = crit — proof: test "katana 3rd hit"
- [x] C027 Nỏ: magazine 6, reload 1.2 s, auto-aim, piercing heavy bolt (20 MP) — proof: test "crossbow magazine"
- [x] C028 Gậy Phép: homing orb using MagicDamage partially + elemental nova (30 MP) — proof: test "staff uses magic"
- [x] C029 Dash attack for every weapon — proof: test "every weapon has a dash attack"
- [x] C030 Only Kiếm & Khiên unlocked at start; others via Destiny + training room — proof: test "weapons need destiny unlock"; smoke C030_weapon_training_unlock
- [x] C031 ≥8 Anvil upgrades per weapon in 2–3 tiers with requires/excludes — proof: test ">= 8 upgrades per weapon"
- [x] C032 Upgrade mods read by weapon code (extra hit, special cost, magazine, pierce, fury duration…) — proof: test "upgrade mods are applied"
- [x] C033 Element aspect upgrade converts weapon element (scaling stat swaps) — proof: test "element aspect converts"
- [x] C034 Anvil offers 1 of 3 upgrades for the current weapon, tier gated — proof: test "anvil: tier gated"; smoke C034_anvil

## §4 Inventory grid
- [x] C035 Bag starts 5×4; expansion grows up to 7×5 — proof: test "starts 5x4"
- [x] C036 Side bag of 4 cells, items inactive, unlocked by Destiny — proof: test "side bag: 4 cells"
- [x] C037 Artifacts occupy polyomino footprints and can be placed/removed without overlap — proof: test "places without overlap"; smoke C037_place_drag
- [x] C038 Rotation of footprints (Q/E / rotate button), 4 orientations — proof: test "rotation gives 4 orientations"; test "rotated L fits"
- [x] C039 Artifact rarity, maxLevel stars, level starts 0, per-level effect scaling — proof: test "artifact level starts 0"
- [x] C040 Constraint touchEdge — proof: test "touchEdge"
- [x] C041 Constraint emptyNeighbor — proof: test "emptyNeighbor"
- [x] C042 Constraint cornerOnly — proof: test "cornerOnly"
- [x] C043 Constraint noOtherOfTag — proof: test "noOtherOfTag"
- [x] C044 Conditional constraint-like effects (only active if HP < 50%) — proof: test "conditional variants"
- [x] C045 Tablet +1/+2 level on targeted cells — proof: test "+2 tablet"; smoke C045_tablet_level_live
- [x] C046 Tablet −1 level; level ≤ −1 disables the artifact (greyed) — proof: test "-1 level disables"
- [x] C047 Tablet ignoreConstraint — proof: test "ignoreConstraint tablet"
- [x] C048 Tablet +max level — proof: test "maxLevel op raises cap"
- [x] C049 Tablet doubleTags — proof: test "doubleTags doubles"
- [x] C050 Tablet copy effect of opposite artifact — proof: test "copy op copies"
- [x] C051 Tablets rotate (targets rotate with them) — proof: test "tablet rotation rotates targets"
- [x] C052 Tablets touching tablets have no effect on each other — proof: test "tablets do not affect tablets"
- [x] C053 Live recompute + green/red drag preview + stars shown on artifacts — proof: test "reports invalid cells"; smoke C053_live_recompute
- [x] C054 10 combo families with thresholds counting tags of ACTIVE artifacts — proof: test "thresholds count ACTIVE"
- [x] C055 Combo side panel lists active combos with tier — proof: smoke C055_combo_panel
- [x] C056 Selling by dragging to sell zone at shops; discard elsewhere — proof: smoke C056_sell_zone
- [x] C057 2 spell quick slots (keys 1/2) costing MP — proof: test "spells: up to 2 quick slots"; smoke C057_spell_slot
- [x] C058 Potion belt 3 slots; heal 40%, rage, iron skin, swift, mana, mystery identified on first drink — proof: test "potions: heal 40%"; test "rage / iron / swift / mana"; smoke C058_potion_drink
- [x] C059 Miracles: run-wide passives shown as icons — proof: test "miracle stat effect"; smoke C075_roots
- [x] C060 Content minimum: 72 artifacts, 24 tablets, 10 combos, 8 miracles, 6 potions in registry — proof: test "content minimums in registry"

## Effects interpreter (types.ts Effect kinds)
- [x] C061 Effect stat (flat & pct, per level) — proof: test "stat flat/pct"
- [x] C062 Effect onHit status application with chance — proof: test "onHit chance"
- [x] C063 Effect onKill heal/mp/money/explode — proof: test "onKill actions"
- [x] C064 Effect onDash trail/shockwave/shield/heal — proof: test "onDash actions"
- [x] C065 Effect onHurt thorns/nova/mp — proof: test "onHurt actions"
- [x] C066 Effect periodic orb/lightning/meteor/heal/frostRing — proof: test "periodic fires"
- [x] C067 Effect conditional (hpBelow50/fullHp/mpAbove50/noDashLeft/bossRoom) — proof: test "conditional variants"; test "conditional wrapping"
- [x] C068 Effect spell (6 spells) and summon companions — proof: test "spells: up to 2"; test "summons and specials"
- [x] C069 Effect special hooks — proof: test "every special id used by content is implemented"; test "freezeShatter"

## §5 Run structure
- [x] C070 Run = 6 chapters × 3 floors; floor 3 boss, floors 1–2 gate (mini-boss/elite) — proof: test "6 chapters x 3 floors"; smoke C110_full_run
- [x] C071 Start room; from floor 2 onward has Shop + Training Dummy — proof: smoke C071_start_room_f1; smoke C071_start_shop_dummy_f2; test "start shop from global floor 2"
- [x] C072 Node map: 3 columns × 3 deep with branching between adjacent columns, then boss/gate — proof: test "3 columns x 3 deep"; test "links only to adjacent"; test "branching occurs"; smoke C072_enter_node
- [x] C073 Doors show node type icon + modifier icon — proof: smoke C071_start_room_f1; test "choices: start"
- [x] C074 All 10 node types generated and resolvable (levelup, artifact, enchant, tablet, money, heart, anvil, dice, shop, roots) — proof: test "all 10 node types appear"; smoke C074_all_nodes
- [x] C075 Tree Roots once per run, choose 1 of 3 miracles, no fight — proof: test "miracle choice from roots"; smoke C075_roots
- [x] C076 Enchant altar sizes give 1–3 permanent level-ups — proof: test "enchant altar sizes"; test "enchant raises level"; smoke C076_enchant
- [x] C077 Modifiers: Derangement (haste/armor/explode) and Mini Boss (rare+ drop) — proof: smoke C077_derangement; smoke C077_miniboss_drop; test "waves 1-3"
- [x] C078 Combat rooms lock doors until 1–3 waves cleared, then reward + doors open — proof: smoke C078_room_cleared_doors_open; test "node entry follows map links"
- [x] C079 Random events 10–15% per room, all 9 EventIds resolvable — proof: test "modifiers and events distribution"; test "all 9 events resolve"; smoke C079_all_events
- [x] C080 Dice reroll 1/3 choices and shop stock (1 die) — proof: test "choice 1/3 unique"; smoke C080_reroll_choice; smoke C080_reroll_shop
- [x] C081 Death → results with Ngọc Sao = f(depth, bosses) → hub — proof: test "death rewards sapphires"; smoke C081_death_results
- [x] C082 Win at chapter 6 boss → ending + credits + Hard Mode unlock (+40% HP/dmg) — proof: test "6 chapters x 3 floors"; smoke C082_ending; smoke C082_hard_mode_unlocked; test "hard mode +40%"
- [x] C083 Pause; mid-run save between rooms + continue (versioned localStorage) — proof: test "run roundtrip"; smoke C083_save_continue

## §6 Enemies & bosses
- [x] C084 ≥30 enemy types (5 per chapter) in registry — proof: test "content minimums in registry"
- [x] C085 AI kit: all 12 AiKind behaviours implemented — proof: test "chaser approaches"; test "healer heals"; test "turret stays"
- [x] C086 Telegraphs (ground markers / wind-up) for chargers, lobbers, bosses — proof: test "charger telegraphs"; test "lobber marks"; test "exploder fuses"
- [x] C087 6 chapter bosses + 6 mini-bosses with phases at 66%/33% — proof: test "phases at thresholds"; smoke C087_phases; smoke C087_boss_ch1_damaged; smoke C087_boss_ch2_damaged; smoke C087_boss_ch3_damaged; smoke C087_boss_ch4_damaged; smoke C087_boss_ch5_damaged; smoke C087_boss_ch6_damaged
- [x] C088 Boss patterns: rings, spirals, cross waves, charges, summons, hazards — proof: test "every pattern used by content"; test "slam, minefield"
- [x] C089 Boss HP bar with name — proof: smoke C089_boss_bar
- [x] C090 Six chapter themes (tileset/tint per chapter) — proof: smoke C090_chapter_theme_1; smoke C090_combat_room_1; smoke C090_chapter_theme_2; smoke C090_combat_room_2; smoke C090_chapter_theme_3; smoke C090_combat_room_3; smoke C090_chapter_theme_4; smoke C090_combat_room_4; smoke C090_chapter_theme_5; smoke C090_combat_room_5; smoke C090_chapter_theme_6; smoke C090_combat_room_6

## §7 Hub
- [x] C091 Walkable hub with stations (Destiny, Talents, Costumes, Weapon rack, Journal, Training, Portal) — proof: smoke C091_hub
- [x] C092 Destiny tree ≥30 nodes bought with Ngọc Sao, requirements respected — proof: test "destiny tree has >= 30"; test "requirements and costs"; smoke C092_destiny_buy
- [x] C093 Destiny grants: talent points, seed money, start dice, bag expansion, side bag, levelup heal, weapon unlocks, potion slot, hard mode gate — proof: test "grant keys present"; test "unlockArtifacts adds"; test "levelUpHeal"; test "chestReroll"
- [x] C094 Talents with free respec — proof: test "talent points cap 25"; smoke C094_talents_respec
- [x] C095 ≥6 costumes changing start stats/items with unlock conditions tracked — proof: test ">= 6 costumes"
- [x] C096 Weapon rack selects unlocked weapon — proof: smoke C096_weapon_rack
- [x] C097 Journal records discovered artifacts/tablets/enemies/miracles — proof: test "journal discovery"; smoke C097_journal
- [x] C098 Training grounds: dummy + spawn any unlocked artifact — proof: smoke C098_training_spawn
- [x] C099 Persistent meta save versioned with migration — proof: test "migration from v1"; test "meta roundtrip"; smoke C099_meta_persisted

## §8 UI / HUD
- [x] C100 HUD: HP/MP pills, dash pips, currency pills, potion belt, spell slots, mini map, boss bar — proof: smoke C100_hud
- [x] C101 Inventory screen pauses combat, shows grid, side bag, combo panel, tooltip card — proof: smoke C101_inventory_opens; smoke C101_pauses_combat; smoke inventory_full
- [x] C102 Choice screen cards (icon, rarity, stars, tags, text) + reroll — proof: smoke C102_choice_cards
- [x] C103 Cream cards / orange buttons / Baloo 2 / Vietnamese strings — proof: test "every engine key resolves"; test "every literal t("; test "ev.*, node.*, rar.*"; smoke C103_font_vn
- [x] C104 Touch controls: floating joystick + Attack/Dash/Special/Potion/Inventory buttons — proof: smoke C104_touch_joystick; smoke C104_touch_attack_button
- [x] C105 Keyboard + mouse controls — proof: smoke C105_keyboard_mouse
- [x] C106 Landscape 1280×720 Scale.FIT — proof: smoke C106_landscape_fit
- [x] C107 Asset manifests merged; missing keys get procedural placeholders — proof: smoke C107_manifests; smoke single_file_build

## §9 Audio
- [x] C108 Procedural WebAudio SFX (hit, dash, pickup, level up, UI) — proof: smoke C108_sfx
- [x] C109 Mute toggle persisted — proof: smoke C109_mute

## Quality gates
- [x] C110 Smoke playthrough hub → all 6 bosses → ending, plus death → hub → Destiny purchase, zero console errors — proof: smoke C110_full_run; smoke C081_death_results; smoke C092_destiny_buy; smoke __noerrors
