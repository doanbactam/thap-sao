# THÁP SAO — Game spec v1 (distilled from Sephiria's gameplay, original IP)

Goal: a complete, fully playable top-down action roguelite in **Phaser 4.2.1 + TypeScript + Vite** that reproduces
Sephiria's whole gameplay loop (combat, weapons, grid inventory with Artifacts + Tablets + combo families, floor node
maps, events, bosses, hub village with permanent progression). **Original IP**: no names, art, text or audio copied from
Sephiria/TEAM HORAY. Mechanics only. UI language: **Vietnamese** (all strings in `src/data/strings.ts`).

Art direction: the user's reference `files/uploads/1479.jpg` (style only): flat modern mobile cartoon, thick dark-brown
outlines `#3B2416`, chunky rounded shapes, 3/4 top-down view, warm muted pastel palette, two-tone cel shading,
orange rounded buttons, dark pill resource counters, cream cards, Baloo 2 font. A proven style guide + palette +
prompt recipe exists at `/workspace/projects/ea42cd77-2984-436b-ba9e-18585dd39e97/game/art/v2/STYLE.md` — reuse its
palette, UI palette, outline rule and prompt recipe (subjects are new). "Real sprites": every visible entity uses a
generated, animated sprite (no colored rectangles/circles in the final build).

Display: landscape 1280×720 design resolution, `Scale.FIT`, works on desktop (WASD + mouse) and Android/touch
(left floating joystick, right buttons: Attack, Dash, Special, Potion, Inventory). Target 60 fps on mid phones.

## 1. Fiction (original)
Hero **Bông** — a small round hamster-mouse adventurer (cream fur, big ears, teal scarf, leaf hat). Home: **Làng Mây**
(cloud village on top of the **Tháp Sao** — Star Tower). A falling star corrupted the tower; Bông descends 6 chapters
to the Star Core to save the village. Currency names: **Hạt Dẻ** (in-run money, like Leaves), **Ngọc Sao** (permanent,
like Sapphires), **Xúc Xắc** (reroll dice).

## 2. Core stats (Sephiria base values)
HP 50, MP 50 (MP fuels specials/spells/guard; regen 4/s after 1.5 s without spending), Physical/Fire/Ice/Lightning damage
20 each, Defense 0 (% reduction, cap 75%), Evasion 0 (% dodge chance, cap 60%), Crit 0% / CritDmg +50%, AttackSpeed
100%, MoveSpeed 100% (base 150 px/s), Dash count 2, Dash recovery 100% (1 charge / 1.2 s), Luck 0 (+1.16% higher tier
per point), Barter 0 (shop price −1%/pt, sell +1%/pt), MagicDamage (spells only), Lifesteal %. Level-ups: XP from kills;
each level +5 max HP, +2 to all damage, full MP. Damage formula: `base(stat of weapon element) * attackCoef *
(1+%bonus) * crit? (1.5+critDmg) * (1 - targetDef)`; status: Burn (DoT stacking, 3s), Frostbite (stacks → Freeze at 5,
1.5s), Shock (chain 3 targets, +dmg taken 15%), Poison, Wound (+bleed on hit).
Dash: 0.18 s, i-frames, 140 px. Guard (weapons with guard): hold to block frontal 120° arc, cost MP per blocked hit;
perfect guard (within 0.15 s) = no cost + counter-stun.

## 3. Weapons (6 branches, each: basic combo + special + dash attack + Anvil upgrade tree)
| Weapon (VN name) | Basic | Special (MP) | Notes |
|---|---|---|---|
| Kiếm & Khiên | 3-hit combo, short arc | Shield Bash dash (20 MP) | Guard (hold RMB/Guard btn) |
| Đại Kiếm | 2-hit heavy, wide arc, knockback | Charged spin (hold, 25 MP) | super armor during swing |
| Dao Găm | 4-hit fast | Shadow step behind target + backstab (15 MP) | Fury meter: hits fill, at 100 attacks +50% speed 5 s |
| Kiếm Cong (katana) | 3-hit, 3rd is lunge | Iaido draw: hold then dash-slash line (20 MP) | perfect timing release = crit |
| Nỏ | single bolt, magazine 6, reload 1.2 s | Piercing heavy bolt (20 MP) | auto-aim toward mouse/nearest |
| Gậy Phép | magic orb, homing slight | Elemental nova (30 MP) | uses MagicDamage partially |
Start unlocked: Kiếm & Khiên. Others unlocked in the hub Destiny tree (Ngọc Sao) + short training room.
**Anvil (Đe Rèn)**: each weapon has ≥8 upgrades in 2–3 tiers (e.g. "4th hit added", "Special costs −30%", "Element
aspect: Fire/Ice/Lightning" (converts weapon damage element, scaling stat swaps), "Bolt pierces 1", "Magazine +3",
"Fury duration +2s"...). An Anvil node offers choose 1 of 3 upgrades available for the current weapon (tier gated).

## 4. Inventory grid (the heart of the game)
- Bag grid starts **5 columns × 4 rows** (20 cells); hub upgrade "Túi Mở Rộng" adds rows/cols up to 7×5. Plus a
  **Side Bag** of 4 cells (items there are inactive, just storage; unlocked via Destiny tree).
- **Artifacts (Cổ Vật)**: occupy a polyomino footprint (1×1, 1×2, 2×2, L, T...), rotatable (Q/E or rotate button).
  Each has rarity (Thường/Hiếm/Sử Thi/Huyền Thoại), `maxLevel` (stars 1–5), current level starts 0, effect scaling
  per level, 1–2 combo tags, optional constraint (e.g. "must touch the left edge", "no artifact to the right",
  "only active if HP < 50%").
- **Tablets (Phiến Đá)**: 1×1 (some 1×2) pieces with a direction pattern: they modify artifacts in marked relative cells:
  +1/+2 level, −1 level, "ignore constraint", "copy effect of neighbor", "+1 max level", "double tag count". Tablets
  rotate too. A level reduced to −1 or below **disables** the artifact (greyed). Tablets touching tablets have no effect
  on each other.
- Live recompute on every move: show green/red highlights preview while dragging, show final level stars on each artifact.
- **Combo families (Bộ)**: 10 families, each activates at thresholds 2/4/6 (some 3/5) counting tags of ACTIVE artifacts:
  Băng Hà (frostbite/freeze), Than Hồng (burn), Mây Giông (shock/lightning), Hộ Vệ (defense/guard), Bóng Đêm
  (evasion/dash), Hồ Thu (max MP/spell), Gió Hát (dash attack/move), Học Viện (spellbook/magic crit), Đồng Hành
  (summons), Lời Nguyền (debuff amp). A side panel lists active combos with tier.
- Selling: drag item to the sell zone at shops (gives Hạt Dẻ). Drop/discard elsewhere.
- **Spells/quick slots**: 2 quick slots for active spell artifacts (Học Viện) — key 1/2 or buttons; cost MP.
- **Potions**: 3-slot belt, random potions (heal 40%, rage, iron skin, swift, unknown "mystery" potions identified on
  first drink).
- **Miracles (Phép Màu)**: run-wide powerful passives from the Tree Roots node (1 per run), shown as icons.
Content minimum for v1: **72 artifacts**, **24 tablets**, **10 combo families**, **8 miracles**, **6 potion types**.

## 5. Run structure
- Run = **6 chapters**, each chapter = **3 floors**; floor 3 of each chapter ends with the chapter boss; floors 1–2 end
  with a mini-boss-or-elite gate room.
- Floor skeleton (Sephiria): **Start room** (from floor 2 onward: fixed Shop + Training Dummy) → a node map: 3 path
  columns, each path 3 rooms deep, branching allowed between adjacent columns → **Boss/gate room**. Before entering, the
  door shows the node type icon (top) + modifier icon (bottom).
- Node types: Level Up orb, Artifact (choose 1/3), Enchant altar (upgrade an artifact's level permanently 1–3 times by
  altar size), Tablet (choose 1/3), Money chest, Green Heart (+15 max HP), Anvil (weapon upgrade 1/3), Dice (+2 dice),
  Shop (small), Tree Roots (once per run: choose 1 of 3 Miracles, no fight).
- Modifiers: Derangement (random enemy buffs: haste/armor/explode-on-death), Mini Boss (adds the chapter mini-boss,
  drops rare+ artifact).
- Combat rooms: arena rooms close doors until all waves cleared (1–3 waves); then reward spawns + doors open.
- Random events (10–15% per room): Arena (3–4 waves), Secret Room (cracked wall: attack it), Lucky Clover (+6 max HP or
  +4 def), Wandering Merchant (10% cheaper), Obelisk (random stat swap), Fountain (green XP / gold money / red monsters),
  Companion stall (pay 500 Hạt Dẻ: companion artifact), Blood altar (pay 33% current HP for an artifact OR kill the bat
  for a potion), Pocket Dimension (spend Ngọc Sao to permanently unlock artifacts).
- Dice: reroll any 1/3 choice screen or shop stock (cost 1 die).
- Death → results screen: Ngọc Sao earned = f(depth, bosses killed) → back to hub. Win at chapter 6 boss → ending +
  credits + unlock Hard Mode (enemy +40% HP/dmg, new modifiers) for the next runs.
- Pause, save-on-quit of the run between rooms (localStorage), continue.

## 6. Enemies & bosses
- **≥30 enemy types** (5 per chapter) with behaviours from a shared AI kit: chaser, charger (telegraph + dash),
  shooter (aimed / spread / ring), lobber (AoE marker), summoner, shielded (blocks front), exploder, teleporter,
  turret, healer. Telegraphs always visible (red ground markers, wind-up flash).
- Chapter themes: 1 Rừng Rêu (mossy forest), 2 Mỏ Đá Đỏ (red quarry / bandit rats), 3 Thư Viện Bay (floating library,
  bullet patterns), 4 Hồ Băng (frozen lake), 5 Xưởng Máy Hơi (steam workshop), 6 Lõi Sao (star core).
- **6 chapter bosses + 6 mini-bosses** (12 unique). Bosses have 2–3 phases (66%/33% HP) with distinct patterns:
  rings, spirals, cross waves, charges, summons, arena hazards. Boss HP bar at top with name. e.g. ch1 Nấm Chúa Già
  (old mushroom king), ch2 Thủ Lĩnh Chuột Cướp (bandit-rat chief), ch3 Cú Thủ Thư (owl librarian), ch4 Hải Mã Băng
  (ice walrus), ch5 Kỹ Sư Gấu Mèo & Golem (raccoon engineer + golem), ch6 Ngôi Sao Rơi (the fallen star).

## 7. Hub — Làng Mây (style like the reference image)
Walkable village scene (same 3/4 view): campfire, tents, trees, ponds, NPC stations:
- **Cây Định Mệnh** (Destiny tree, like Destiny Inscription): ≥30 nodes spent with Ngọc Sao: Home Repairs (unlocks
  Talents), Talent Points (up to 25), Seed Money (+200/+400 Hạt Dẻ), Dice start (up to 6), Bag expansion, Side Bag,
  Level-up restore HP, weapon unlock nodes, artifact pool unlocks, potion belt slot, Hard Mode gate.
- **Gương Tài Năng** (Talents, free respec): stat trees (HP, damage types, crit, MP, dash, luck, barter).
- **Tủ Trang Phục** (Costumes): ≥6 costumes changing start stats/items (e.g. Skeleton-like "Bù Nhìn" fixed 50 HP;
  "Mèo Áo Đỏ" fire start; "Ếch" lightning), with unlock conditions tracked (achievement-style).
- **Kệ Vũ Khí** (weapon rack) + training rooms for unlocking weapons.
- **Nhật Ký** (journal): discovered artifacts/tablets/enemies/miracles.
- **Sân Tập** (training grounds): dummy + spawn any unlocked artifact for testing.
- Portal to start a run. HUD in hub copies the reference layout language (pill counters top, orange square buttons bottom).
Persistent save in localStorage (versioned).

## 8. UI / HUD
- In-run HUD: HP bar + MP bar (top-left pills), dash pips, currency pills (Hạt Dẻ, Ngọc Sao, dice), potion belt,
  quick-spell slots, mini node map (top-right), boss bar, damage numbers, combo/status icons.
- Inventory screen (Tab/I or bag button): grid, side bag, combo panel, item tooltip card (cream card), drag & rotate,
  sell zone at shops. Pauses combat.
- Choice screens (1 of 3): cards with icon, rarity color, stars, tags, text; reroll button with dice.
- All menus: cream cards, orange buttons, Baloo 2, Vietnamese.

## 9. Audio
Simple generated SFX (WebAudio/jsfxr-style synth at runtime) for hit, dash, pickup, level up, UI; one ambient loop per
area optional. Mute toggle.

## 10. Out of scope
Online co-op (Sephiria has 4-player online co-op; this build is single-player). Steam integration, mods.

## 11. Definition of done ("100% gameplay")
Every item in `docs/CHECKLIST.md` is ticked by an automated or scripted check, `npm run typecheck`, `npm test`,
`npm run build` pass, and a headless-browser playthrough (debug hooks allowed) goes hub → run → all 6 chapters
(bosses killed via debug-assisted combat but real code paths) → ending, plus a death → hub → spend Ngọc Sao loop,
with zero console errors.
