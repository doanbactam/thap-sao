#!/bin/sh
# Re-run the whole world/UI art pipeline (needs numpy, scipy, Pillow). Raw generations live in art/raw_world/.
cd "$(dirname "$0")" && python3 build_tilesets.py && python3 build_world_sprites.py && python3 build_fx.py && \
python3 build_ui_kit.py && python3 build_icons_ui.py && python3 build_manifest_world.py && python3 build_mockups.py
