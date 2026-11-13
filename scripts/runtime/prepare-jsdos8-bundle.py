#!/usr/bin/env python3
"""Prepare a private js-dos 8 comparison ZIP from an existing R05 6.22 ZIP.

Changes ONLY the embedded DOSBox startup configuration. All original private
game files, Snnn.LBA saves, DLLs, HQRs, and patched RELENT.EXE remain unchanged.
Never publish the resulting bundle.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = (ROOT / "output").resolve()


def read_config(archive: zipfile.ZipFile) -> bytes:
    config = archive.read(".jsdos/dosbox.conf")
    if b"[autoexec]" in config.lower():
        raise ValueError("Expected a 6.22 source without [autoexec]; refusing ambiguous startup")
    if b"sbtype=sb16" not in config:
        raise ValueError("Expected original emulated SB16 config")
    return config


def prepare(source: Path, destination: Path, cd_image: str = "LBA.ISO") -> dict:
    source, destination = source.resolve(strict=True), destination.resolve()
    if not destination.is_relative_to(OUTPUT) or not source.is_relative_to(OUTPUT):
        raise ValueError("All private js-dos archives must stay under ignored output/")
    if source == destination:
        raise ValueError("Source and destination must be different")
    if cd_image not in ("LBA.ISO", "LBA.CUE"):
        raise ValueError("Unsupported CD image")
    if destination.exists() and destination.is_symlink():
        raise ValueError("Refusing symlinked destination")
    with zipfile.ZipFile(source) as z:
        if z.testzip() is not None:
            raise ValueError("Source ZIP CRC mismatch")
        names = z.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate ZIP entries")
        for needed in ("RELENT.EXE", "S003.LBA", "LBA.CFG", cd_image,
                       ".jsdos/dosbox.conf", "W_SB16_8.DLL"):
            if needed not in names:
                raise ValueError("Missing comparison input: " + needed)
        cfg = z.read("LBA.CFG")
        if b"WaveDriver: W_SB16_8.DLL" not in cfg or b"MixerDriver: NoMixer" not in cfg:
            raise ValueError("Expected the tested 8-bit, no-mixer audio profile")
        conf = read_config(z)
        newline = b"\r\n" if b"\r\n" in conf else b"\n"
        script = newline.join((
            b"[autoexec]",
            b"mount c .",
            b"c:",
            ("imgmount d " + cd_image + " -t iso").encode("ascii"),
            b"RELENT.EXE",
            b"",
        ))
        override = conf.rstrip(b"\r\n") + newline + script
        destination.parent.mkdir(parents=True, exist_ok=True)
        pending = destination.with_suffix(".tmp")
        if pending.is_symlink():
            raise ValueError("Refusing symlinked temporary file")
        try:
            with zipfile.ZipFile(pending, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as out:
                for info in z.infolist():
                    data = override if info.filename == ".jsdos/dosbox.conf" else z.read(info.filename)
                    out.writestr(info, data)
            with zipfile.ZipFile(pending) as result:
                if result.testzip() is not None:
                    raise ValueError("Converted ZIP CRC mismatch")
                for item in names:
                    if item != ".jsdos/dosbox.conf" and result.read(item) != z.read(item):
                        raise ValueError("Game file bytes changed unexpectedly: " + item)
                if result.read(".jsdos/dosbox.conf") != override:
                    raise ValueError("DOSBox configuration substitution failed")
            pending.replace(destination)
        finally:
            pending.unlink(missing_ok=True)
    return {
        "source": str(source), "destination": str(destination), "cdImage": cd_image,
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "destinationSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "unchangedEntries": len(names) - 1,
        "state": "Archive and byte-equivalence verified; guest runtime/audio not tested",
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--cd-image", choices=("LBA.ISO", "LBA.CUE"), default="LBA.ISO")
    args = p.parse_args()
    try:
        print(json.dumps(prepare(args.input, args.out, args.cd_image), indent=2))
    except (OSError, ValueError, zipfile.BadZipFile) as err:
        print("R05 v8 conversion failed: " + str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
