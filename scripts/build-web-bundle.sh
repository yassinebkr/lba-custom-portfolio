#!/bin/sh
# Compatibility entry point for the owner-local Linux DOS bundle builder.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec python3 "$ROOT/scripts/runtime/build-private-jsdos.py" "$@"
