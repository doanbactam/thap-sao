#!/bin/sh
# Source archive → docs/ThapSao_src.zip (excludes node_modules, dist*, out, tools/.sysroot, work, build outputs in docs/,
# and the raw image generations art/raw_*, art/stills_chars — they stay in the project workspace; runtime art in public/ is included)
cd "$(dirname "$0")/.." && rm -f docs/ThapSao_src.zip
zip -qr docs/ThapSao_src.zip . -x 'node_modules/*' 'dist/*' 'dist-single/*' 'out/*' 'tools/.sysroot/*' 'work/*' 'docs/ThapSao.html' 'docs/ThapSao_src.zip' 'art/raw_chars/*' 'art/raw_world/*' 'art/raw_icons/*' 'art/stills_chars/*' '*.DS_Store'
ls -la docs/ThapSao_src.zip
