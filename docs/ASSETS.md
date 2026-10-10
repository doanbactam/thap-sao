# Asset contract (art agents ⇄ engine)

All runtime art lives in `public/assets/`. The engine loads **`public/assets/manifest.json`** at boot and, for any key
missing from it, draws a procedural placeholder — so art and engine can be built in parallel. Each art agent owns its
own partial manifest file and NEVER edits another agent's: `public/assets/manifest.characters.json`,
`manifest.world.json`, `manifest.icons.json`. The engine merges every `public/assets/manifest.*.json` (list them in
`public/assets/manifests.json` = `["manifest.characters.json", ...]`; each agent appends its file name if missing).

## Manifest entry format
```jsonc
{
  "<key>": {
    "type": "image" | "sheet" | "atlas",
    "file": "sprites/hero_bong.png",          // relative to public/assets/
    "atlas": "sprites/icons.json",            // type atlas only (Phaser JSON-hash)
    "frameW": 96, "frameH": 96,               // type sheet only (uniform grid, row-major)
    "anims": { "idle": {"frames":[0,1,2,3],"fps":6,"loop":true}, "run": {...}, "attack": {...},
               "dash": {...}, "hurt": {...}, "die": {...}, "cast": {...} },
    "anchor": [0.5, 0.92],                    // origin; feet for characters
    "scale": 0.5,                             // draw scale (art stored at 2x of on-screen size)
    "facing": "right",                        // natural facing; engine flips X for left
    "hitRadius": 14                           // optional, on-screen px
  }
}
```
Characters face right in source; engine flips. On-screen size targets (at 1280×720, TILE = 48 px): hero ≈ 44 px tall,
normal enemy 36–56 px, elite 64 px, mini-boss 96–128 px, boss 160–220 px. Store at 2× and set `scale: 0.5`.
Required anims for characters: `idle, run, attack, hurt, die` (hero also `dash, cast`; bosses also `attack2`, `phase`).
Minimum frames: idle 4, run 6, attack 4, hurt 2, die 5. Frames may be produced by a cut-out rig (deforming/rotating
parts of one generated still — see the Miêu rig approach) as long as motion reads clearly.

## Key list — characters (owner: art-characters)
- Hero costumes: `hero_bong` (default), `hero_scarecrow`, `hero_redcat`, `hero_frog`, `hero_fox`, `hero_knight`
- Weapons (held overlay, static image, handle at origin, pointing right): `wpn_swordshield`, `wpn_shield`,
  `wpn_greatsword`, `wpn_dagger`, `wpn_katana`, `wpn_crossbow`, `wpn_staff`
- Hub NPCs (idle 4 frames): `npc_elder` (Destiny tree keeper), `npc_smith`, `npc_tailor`, `npc_merchant`,
  `npc_trainer`, `npc_bard`, `npc_sleeper`
- Companions: `cmp_sprout`, `cmp_bat`, `cmp_wisp`
- Enemies (ids are final; data uses them as `sprite: 'en_<id>'`):
  - ch1 Rừng Rêu: `en_slime_moss`, `en_mushroom_spore`, `en_beetle_charger`, `en_sprout_archer`, `en_bee_swarm`
  - ch2 Mỏ Đá Đỏ: `en_rat_bandit`, `en_rat_bomber`, `en_rat_shield`, `en_mole_digger`, `en_rat_crossbow`
  - ch3 Thư Viện Bay: `en_book_flyer`, `en_ink_blob`, `en_candle_mage`, `en_mirror_construct`, `en_quill_turret`
  - ch4 Hồ Băng: `en_penguin_slider`, `en_ice_spirit`, `en_seal_lobber`, `en_frost_wolf`, `en_snow_golem_small`
  - ch5 Xưởng Máy Hơi: `en_gear_bot`, `en_steam_turret`, `en_raccoon_mechanic`, `en_drone_bomber`, `en_piston_brute`
  - ch6 Lõi Sao: `en_star_shard`, `en_void_eye`, `en_comet_hound`, `en_nebula_healer`, `en_star_knight`
- Bosses: mini `mb_thorn_boar`, `mb_rat_captain`, `mb_ink_golem`, `mb_yeti`, `mb_saw_crab`, `mb_dark_twin`;
  chapter `boss_mushroom_king`, `boss_rat_chief`, `boss_owl_librarian`, `boss_ice_walrus`, `boss_raccoon_golem`,
  `boss_fallen_star`

## Key list — world (owner: art-world)
- Tilesets (one sheet each, 48 px tiles stored at 96 px = 2×; frames: 0–7 floor variants, 8–15 floor details/decals,
  16–23 wall top/front/corners, 24–31 edge/cliff/water): `ts_hub`, `ts_ch1` … `ts_ch6`
- Props (images, bottom-centre anchor): per chapter 8+ props `prop_ch<N>_<name>` (trees, rocks, crates, bookshelves,
  ice pillars, pipes, crystals…) + destructible `prop_ch<N>_breakable` (2 frames: whole/broken) + `prop_cracked_wall`
- Hub buildings/objects: `hub_destiny_tree`, `hub_house` (2 frames: broken/repaired), `hub_tent_smith`,
  `hub_wardrobe`, `hub_weapon_rack`, `hub_mirror`, `hub_journal_stand`, `hub_training_dummy`, `hub_portal`,
  `hub_campfire` (anim 6), `hub_pond`, `hub_tree_a`, `hub_tree_b`, `hub_bush_berry`, `hub_mushrooms`, `hub_rock`
- Room objects: `door_closed`, `door_open`, `door_boss`, `chest_money` (anim open), `altar_enchant_s|m|l`,
  `anvil`, `orb_levelup` (anim), `heart_green`, `dice_pickup`, `roots_tree`, `shop_stall`, `merchant_rat`,
  `obelisk`, `fountain_green|gold|red`, `blood_altar`, `pocket_portal`, `clover`, `training_dummy`, `portal_exit`
- VFX sheets: `fx_slash_small`, `fx_slash_big`, `fx_thrust`, `fx_hit`, `fx_crit`, `fx_dash_dust`, `fx_explosion`,
  `fx_burn`, `fx_freeze`, `fx_shock`, `fx_poison`, `fx_heal`, `fx_levelup`, `fx_spawn`, `fx_telegraph_circle`,
  `fx_telegraph_line`; projectiles `pj_bolt`, `pj_orb_magic`, `pj_enemy_orb`, `pj_enemy_arrow`, `pj_fireball`,
  `pj_icebolt`, `pj_lightning`, `pj_bomb`, `pj_star`
- UI kit (images, provide 1× for 1280×720 + nineslice insets in manifest `"nine":[l,r,t,b]`): `ui_btn_orange`,
  `ui_btn_green`, `ui_btn_red`, `ui_btn_wood`, `ui_btn_purple`, `ui_card_cream`, `ui_pill_dark`, `ui_bar_track`,
  `ui_bar_hp`, `ui_bar_mp`, `ui_bar_xp`, `ui_cell`, `ui_cell_hi`, `ui_cell_bad`, `ui_panel_dark`, `ui_badge_red`,
  `ui_joystick_base`, `ui_joystick_knob`, `ui_rarity_frame_common|rare|epic|legendary`, `ui_star_on`, `ui_star_off`
- Generic icons (atlas `icons_ui` frames named): `ic_money`, `ic_sapphire`, `ic_dice`, `ic_hp`, `ic_mp`, `ic_dash`,
  node icons `node_levelup|artifact|enchant|tablet|money|heart|anvil|dice|shop|roots|boss|start`,
  `mod_derangement`, `mod_miniboss`, combo icons `combo_glacier|ember|storm|guardian|shadow|lake|windsong|academy|companion|curse`,
  stat icons `st_<StatKey>`, button icons `btn_attack|dash|special|potion|bag|pause|rotate|sell|reroll|map`,
  potions `pot_heal|rage|iron|swift|mystery|mana`, miracles `mir_1`…`mir_8`, weapons `wic_<WeaponId>`.
- Font: copy Baloo 2 from `/workspace/projects/ea42cd77-2984-436b-ba9e-18585dd39e97/game/art/v2/fonts/Baloo2.ttf`
  to `public/assets/fonts/Baloo2.ttf`.

## Key list — artifact & tablet icons (owner: content agent)
Atlas `icons_items` (`public/assets/sprites/icons_items.png/.json`), frame name = the `icon` field in
`src/data/artifacts.ts` / `tablets.ts` (`art_<id>`, `tab_<id>`), 96×96 source, shown at 48 px. Manifest file
`manifest.icons.json`.
