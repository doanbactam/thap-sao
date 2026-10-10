#!/bin/sh
# move named generated files from project root into raw_world (only the named ones!)
R=/workspace/projects/64c57e1c-4a89-46cb-9149-73ad88e2e422
for f in "$@"; do [ -f "$R/$f" ] && mv "$R/$f" "$R/thap-sao/art/raw_world/$f"; done
