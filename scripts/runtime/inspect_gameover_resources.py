#!/usr/bin/env python3
"""Read-only checks for two original DOS resources used by LBA1 GameOver().

Original source references:
- SOURCES/COMMON.H: RESS_GAME_OVER = 21
- SOURCES/GAMEMENU.C: LoadMalloc_HQR("ress.hqr", RESS_GAME_OVER)
                     HQ_MixSample(37, ...)
- LIB386/LIB_SYS/HQ_RESS.C: HQR index table and 10-byte entry headers.

The validation checks file layout and payload bounds, not LZS decompression,
3D object integrity, DOS memory behavior or actual audible sample playback.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import struct
import sys

RESOURCE_INDEXES = {
    "RESS.HQR": ("game_over_model", 21),
    "SAMPLES.HQR": ("game_over_sample", 37),
}
MAX_ARCHIVE_BYTES = 128 * 1024 * 1024


def inspect_entry(data: bytes, index: int) -> dict[str, int | str]:
    if not isinstance(data, bytes) or len(data) < 4:
        raise ValueError("HQR is too short")
    if index < 0:
        raise ValueError("Negative HQR index")
    table_bytes = struct.unpack_from("<I", data, 0)[0]
    if table_bytes < 4 or table_bytes % 4 or table_bytes > len(data):
        raise ValueError("Invalid HQR offset table")
    count = table_bytes // 4
    if index >= count:
        return {"state": "missing", "reason": "entry index outside table", "entryCount": count}
    offset = struct.unpack_from("<I", data, index * 4)[0]
    if offset == 0:
        return {"state": "missing", "reason": "empty offset slot", "entryCount": count}
    if offset < table_bytes or offset + 10 > len(data):
        raise ValueError("HQR entry offset outside payload")
    unpacked, packed, method = struct.unpack_from("<IIH", data, offset)
    if method not in (0, 1):
        raise ValueError("Unsupported HQR compression method")
    if unpacked == 0:
        raise ValueError("Empty HQR entry")
    payload_bytes = unpacked if method == 0 else packed
    if payload_bytes == 0 or offset + 10 + payload_bytes > len(data):
        raise ValueError("HQR entry exceeds file bounds")
    return {
        "state": "present",
        "entryCount": count,
        "offset": offset,
        "decodedBytes": unpacked,
        "packedBytes": packed,
        "compression": method,
    }


def inspect_gameover_files(base: Path) -> dict[str, dict[str, int | str]]:
    if base.is_symlink() or not base.is_dir():
        raise ValueError("Directory missing or unsafe")
    result = {}
    for file, (label, index) in RESOURCE_INDEXES.items():
        path = base / file
        if path.is_symlink():
            result[label] = {"state": "invalid", "reason": "symbolic link rejected"}
            continue
        if not path.is_file():
            result[label] = {"state": "missing", "reason": "file missing"}
            continue
        try:
            size = path.stat().st_size
            if size > MAX_ARCHIVE_BYTES:
                raise ValueError("HQR unexpectedly large")
            result[label] = inspect_entry(path.read_bytes(), index)
        except (ValueError, OSError, struct.error) as error:
            result[label] = {"state": "invalid", "reason": str(error)}
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = inspect_gameover_files(args.base)
    except (ValueError, OSError) as error:
        print("Game-over resource check failed: " + str(error), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
