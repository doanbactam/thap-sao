# Tháp Sao — world / VFX / UI art (owner: art-world)

Style: flat mobile cartoon, dark-brown outline #3B2416 (+2 px uniform silhouette stroke after downscale), chunky shapes,
two-tone cel shading, 3/4 top-down. Palette + UI palette reused from Bộ Lạc v2 STYLE.md (orange #F4A63B, green #7CC44E,
red #E2483D, wood #C98A4B, purple #8E6CD8, cream #FFF4DC, dark pill #4A3426). Reference used for style only (cropped
world area `raw_world/ref_world.jpg`); nothing copied.

Pipeline: `art/tools/build_all_world.sh` (tilesets → sprites → fx → ui kit → icons_ui → manifest.world.json → mockups).
Raw generations: `art/raw_world/`. Previews: `art/sheets/` (mockups, `tilecheck_ts_*.png` 6×6 random floor tilings,
`icons_ui_preview.png`).

## Scale / anchors
World art stored 2×, manifest `scale: 0.5`. Props/buildings/room objects anchor bottom-centre `[0.5,1]` (pickups heart/dice/
clover/orb `[0.5,0.5]`, hub_pond `[0.5,0.6]`). UI at 1× (+ `@2x` file alongside, `file2x`), `nine:[l,r,t,b]` insets.

## Tilesets `ts_hub`, `ts_ch1..6` (sheet 8×4 of 96 px → 48 px)
- 0–7 `floor_*` — all variants share identical borders, so any random mix is seamless (verified in tilecheck sheets).
  ch3 = staggered planks, ch5 = riveted plates (intentional 1-tile grid).
- 8–15 decals (transparent) to sprinkle on floor (~6–15 %).
- 16 wall_top, 17 wall_top_edge_e (west wall column), 18 wall_top_edge_w (east column), 19 wall_top_edge_n (south wall row),
  20/21 south corners, 22 wall_face_upper + 23 wall_face_lower (north wall is 2 tiles tall: upper above lower above floor).
- 24/25 liquid fill, 26 liquid_cliff_n (liquid under a floor cell: cliff face + rim), 27 liquid_edge_s (floor below),
  28/29 floor west/east, 30/31 floor north+west / north+east.
  Liquids: hub deep sea, ch1 swamp, ch2 lava, ch3 open sky/clouds, ch4 arctic water, ch5 steam pit, ch6 cosmic void.
  `frameNames` + `frameDoc` are in each manifest entry.

## Extra keys beyond the contract
`hub_tree_c`, `hub_flowers`, `hub_dirt_a/b` (big ochre ground patches like the reference), `prop_wall_block`, `prop_fence`,
`ui_btn_orange_pressed`, `ui_btn_plus`, `ui_btn_close`, `ui_card_header`; props per chapter are 9–10.

## Animated entries
hub_campfire idle(6) · hub_house frames broken(0)/repaired(1) · chest_money closed/open(4)/opened · orb_levelup idle(6) ·
prop_ch*_breakable whole(0)/broken(1) · fx_* `play` (one-shot) or `loop` (burn, shock, poison, telegraphs) ·
pj_* `fly` (face right; engine rotates). fx_thrust anchor [0.06,0.5] (origin at the weapon), fx_telegraph_line anchor [0,0.5]
(scale X to length), telegraph circle 192 px stored (96 on screen) → scale to radius.
