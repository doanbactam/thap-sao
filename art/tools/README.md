# art/tools — character pipeline (art-characters)

Re-runnable, in this order (from this folder):
```
python3 build_stills.py            # key chroma bg + despill + slice + scale raws (art/raw_chars) -> art/stills_chars (2x stored size)
sh run_group.sh hero_ ; sh run_group.sh cmp_ ; sh run_group.sh npc_ ; sh run_group.sh en_ ; sh run_group.sh mb_
python3 build_chars.py boss_mushroom_king boss_rat_chief boss_owl_librarian   # bosses take ~15 s each
python3 build_chars.py boss_ice_walrus boss_raccoon_golem boss_fallen_star
python3 build_weapons.py           # wpn_* images, grip origin
python3 build_manifest_chars.py    # -> public/assets/manifest.characters.json (asserts every key + file exists)
python3 optimize_pngs.py           # 256-colour palette PNGs (run last)
python3 build_contacts.py          # art/sheets/sheet_{hero,enemies,bosses,npcs}.png + anim_*.gif
```
- `chars_spec.py`: per key raw file, component index, flip, rig kind (biped/quad/blob/flyer/static/npc/sleeper),
  stored height (2x on-screen), width cap, hitRadius. `prompts.py`: prompt recipe used with generate_image
  (refs: raw_chars/ref_chars.jpg = style crop of art/style_ref.jpg; raw_chars/hero_bong.png for costumes + dark twin).
- `rig.py`: cut-out rig. Seamless warp (squash/stretch about the feet, height-weighted lean, rotation, translation)
  + auto-detected legs (bottom band, split at the gap between the feet) swung around hip pivots behind the body.
  `anims.py` = frame tables. Frames rendered at 2x, downscaled, uniform 2 px #3B2416 stroke.
- Feet anchor is fixed across all frames of a sheet (no jitter except intended bobs/hops). Anchor x is NOT 0.5
  (tight frames); Phaser mirrors around the origin so flipX keeps the feet in place.
- Preview helpers: `anim_preview.py out.png zoom key...`, `summary.py out.png cellH prefix...`.
