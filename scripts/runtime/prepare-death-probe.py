#!/usr/bin/env python3
"""Owner-local R05 death-path probe: change ONLY Museum save's clover count.

No executable patch. No source game mutation, no publication. The v8 bundle
must already have the working original 16-bit SB16 driver and English VOX
banks. The control is the exact input bundle with 2 clovers; --clovers 0
creates a deterministic terminal-Game-Over test from the same save.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile, BadZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = (ROOT / "output").resolve()
SAVE = "S003.LBA"
CLOVERS_OFFSET = 0x1C7


def set_clovers(data: bytes, requested: int) -> tuple[bytes, dict]:
    if requested not in (0, 2):
        raise ValueError("Probe supports exactly 0 or 2 clovers")
    if not data or data[0] != 0x03:
        raise ValueError("Unexpected DOS save signature; refusing edits")
    end = data.find(b"\0", 1, 65)
    if end < 0:
        raise ValueError("DOS save title not terminated in first 64 bytes")
    title = data[1:end]
    if not title or not re.fullmatch(rb"[\x20-\x7e]{1,64}", title):
        raise ValueError("Unexpected DOS save title")
    data_start = end + 1
    if len(data) - data_start != 0x1CA:
        raise ValueError("Unexpected DOS save body length")
    offset = data_start + CLOVERS_OFFSET
    existing = data[offset]
    if existing != 2:
        raise ValueError(f"Expected original two-clover Museum save, got {existing}")
    changed = bytearray(data)
    changed[offset] = requested
    details = {
        "slot": SAVE, "title": title.decode("ascii"),
        "absoluteByteOffset": offset, "originalClovers": existing,
        "probeClovers": requested,
        "modifiedBytes": 0 if existing == requested else 1,
    }
    return bytes(changed), details


def make(source: Path, destination: Path, clovers: int = 0) -> dict:
    source = source.resolve(strict=True)
    destination = destination.resolve()
    if not source.is_relative_to(OUTPUT) or not destination.is_relative_to(OUTPUT):
        raise ValueError("Private archives must stay in gitignored output/")
    if source == destination or destination.is_symlink():
        raise ValueError("Refusing to overwrite the working source bundle or a symlink")
    with ZipFile(source) as z:
        entries = z.namelist()
        if len(entries) != len(set(entries)) or z.testzip() is not None:
            raise ValueError("Source bundle failed ZIP integrity check")
        for name in (SAVE, "RELENT.EXE", "LBA.CFG", ".jsdos/dosbox.conf", "RESS.HQR", "SAMPLES.HQR"):
            if name not in entries:
                raise ValueError("Missing expected DOS bundle entry: " + name)
        if b"WaveDriver: W_SB16.DLL" not in z.read("LBA.CFG"):
            raise ValueError("Expected accepted 16-bit SB16 configuration")
        if b"[autoexec]" not in z.read(".jsdos/dosbox.conf").lower():
            raise ValueError("Expected js-dos 8 startup config")
        replacement, details = set_clovers(z.read(SAVE), clovers)
        destination.parent.mkdir(parents=True, exist_ok=True)
        tmp = destination.with_suffix(".tmp")
        if tmp.is_symlink():
            raise ValueError("Refusing symlinked temporary output")
        try:
            with ZipFile(tmp, "w", compression=ZIP_DEFLATED, compresslevel=6) as out:
                for info in z.infolist():
                    out.writestr(copy.copy(info), replacement if info.filename == SAVE else z.read(info.filename))
            with ZipFile(tmp) as candidate:
                if candidate.testzip() is not None or candidate.read(SAVE) != replacement:
                    raise ValueError("Failed post-write verification")
                for name in entries:
                    if name != SAVE and candidate.read(name) != z.read(name):
                        raise ValueError("Other game resources changed: " + name)
            tmp.replace(destination)
        finally:
            tmp.unlink(missing_ok=True)
    return {
        "source": str(source), "privateProbe": str(destination),
        "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        **details,
        "state": "Archive verified; no actual game death tested",
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--clovers", type=int, choices=(0, 2), default=0)
    args = p.parse_args()
    try:
        print(json.dumps(make(args.input, args.out, args.clovers), indent=2))
    except (ValueError, OSError, BadZipFile) as exc:
        print("Private death probe failed: " + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
