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
import copy
import re

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = (ROOT / "output").resolve()


def read_config(archive: zipfile.ZipFile) -> bytes:
    config = archive.read(".jsdos/dosbox.conf")
    if b"[autoexec]" in config.lower():
        raise ValueError("Expected a 6.22 source without [autoexec]; refusing ambiguous startup")
    if b"sbtype=sb16" not in config:
        raise ValueError("Expected original emulated SB16 config")
    return config


def owner_voice_files(voice_dir: Path | None) -> dict[str, Path]:
    """Select authentic DOS VOX files without transcoding or touching owner data."""
    if voice_dir is None:
        return {}
    if voice_dir.is_symlink() or not voice_dir.is_dir():
        raise ValueError("Owner VOX source directory is missing or symlinked")
    result: dict[str, Path] = {}
    total = 0
    for item in voice_dir.iterdir():
        if item.is_symlink() or not item.is_file():
            raise ValueError("VOX folder must contain regular files only")
        # Historical language and bank names from SOURCES/MESSAGE.C.
        if not re.fullmatch(r"(EN|FR|DE|SP|IT)_(SYS|CRE|GAM|[0-9]{3})\.VOX", item.name.upper()):
            raise ValueError("Unexpected legacy voice file: " + item.name)
        # LBA.CFG currently selects LanguageCD: English. Packaging every
        # language would waste ~100+ MB and would not enable those voices.
        if not item.name.upper().startswith("EN_"):
            continue
        if not 8 <= item.stat().st_size <= 128 * 1024 * 1024:
            raise ValueError("Unexpected legacy voice file size: " + item.name)
        name = "VOX/" + item.name.upper()
        if name in result:
            raise ValueError("Duplicate DOS voice filename: " + name)
        result[name] = item
        total += item.stat().st_size
        if total > 400 * 1024 * 1024:
            raise ValueError("Owner voice files exceed private import budget")
    if not result:
        raise ValueError("Owner VOX directory contains no English EN_*.VOX files")
    return result


def prepare(source: Path, destination: Path, cd_image: str = "LBA.ISO", *,
            wave_driver: str = "W_SB16_8.DLL", voice_dir: Path | None = None) -> dict:
    source, destination = source.resolve(strict=True), destination.resolve()
    if not destination.is_relative_to(OUTPUT) or not source.is_relative_to(OUTPUT):
        raise ValueError("All private js-dos archives must stay under ignored output/")
    if source == destination:
        raise ValueError("Source and destination must be different")
    if cd_image not in ("LBA.ISO", "LBA.CUE"):
        raise ValueError("Unsupported CD image")
    if wave_driver not in ("W_SB16_8.DLL", "W_SB16.DLL"):
        raise ValueError("Unsupported original DOS wave driver")
    voices = owner_voice_files(voice_dir)
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
        if wave_driver not in names:
            raise ValueError("Missing original driver DLL: " + wave_driver)
        if any(name in names for name in voices):
            raise ValueError("Voice filename collides with original bundle")
        new_cfg = cfg
        if wave_driver != "W_SB16_8.DLL":
            new_cfg = new_cfg.replace(
                b"WaveDriver: W_SB16_8.DLL", b"WaveDriver: W_SB16.DLL"
            )
        if voices:
            # MESSAGE.C::ClearVoiceFile() deletes cached VOX files at exit
            # when FlagKeepVoice is OFF. Prevent the game deleting test data.
            if new_cfg.count(b"FlagKeepVoice: OFF") != 1:
                raise ValueError("Unexpected voice retention configuration")
            new_cfg = new_cfg.replace(b"FlagKeepVoice: OFF", b"FlagKeepVoice: ON")
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
                    if info.filename == ".jsdos/dosbox.conf":
                        data = override
                    elif info.filename == "LBA.CFG":
                        data = new_cfg
                    else:
                        data = z.read(info.filename)
                    out.writestr(copy.copy(info), data)
                for filename, item in sorted(voices.items()):
                    out.write(item, filename)
            with zipfile.ZipFile(pending) as result:
                if result.testzip() is not None:
                    raise ValueError("Converted ZIP CRC mismatch")
                for item in names:
                    if item not in (".jsdos/dosbox.conf", "LBA.CFG") and result.read(item) != z.read(item):
                        raise ValueError("Game file bytes changed unexpectedly: " + item)
                if result.read("LBA.CFG") != new_cfg:
                    raise ValueError("DOS game audio/voice settings differed from expected profile")
                if result.read(".jsdos/dosbox.conf") != override:
                    raise ValueError("DOSBox configuration substitution failed")
                for filename, voice in voices.items():
                    if result.read(filename) != voice.read_bytes():
                        raise ValueError("Private voice file validation failed: " + filename)
            pending.replace(destination)
        finally:
            pending.unlink(missing_ok=True)
    return {
        "source": str(source), "destination": str(destination), "cdImage": cd_image,
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "destinationSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "unchangedEntries": len(names) - 1 - int(new_cfg != cfg),
        "waveDriver": wave_driver,
        "voiceFiles": len(voices),
        "state": "Archive and binary resource equivalence verified; guest audio/voices not tested",
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--cd-image", choices=("LBA.ISO", "LBA.CUE"), default="LBA.ISO")
    p.add_argument("--wave-driver", choices=("W_SB16_8.DLL", "W_SB16.DLL"),
                   default="W_SB16_8.DLL")
    p.add_argument("--voices-dir", type=Path,
                   help="Optional owner-provided DOS VOX directory; files are included only in private output")
    args = p.parse_args()
    try:
        print(json.dumps(prepare(args.input, args.out, args.cd_image,
                                 wave_driver=args.wave_driver,
                                 voice_dir=args.voices_dir), indent=2))
    except (OSError, ValueError, zipfile.BadZipFile) as err:
        print("R05 v8 conversion failed: " + str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
