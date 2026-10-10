#!/bin/sh
# usage: sh run_group.sh prefix   -> builds every SPEC key starting with prefix
cd "$(dirname "$0")"
python3 build_chars.py $(python3 -c "from chars_spec import SPEC;import sys;print(' '.join(k for k in SPEC if k.startswith('$1')))")
