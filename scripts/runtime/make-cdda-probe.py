#!/usr/bin/env python3
"""Build a PRIVATE mixed-mode CUE probe for browser DOSBox CD-DA capability.

A small generated PCM tone mode tests CD audio transport without proprietary
music. Owner-mp3 mode copies the nine legally owned GOG tracks, never published.
Both reuse exactly the existing checked 8-bit game executable/HQR/save inputs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import zipfile
import copy

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = (ROOT / "output").resolve()
TRACKS = range(2, 11)


def generate_cd_audio_tone(track: int, duration_seconds: int = 6) -> bytes:
    """CD-DA RAW: 44.1 kHz, 16-bit signed little-endian stereo, 2352 bytes/sector."""
    if track not in TRACKS or not 1 <= duration_seconds <= 15:
        raise ValueError("Invalid CD-DA tone request")
    rate = 44100
    freq = 220 + (track - 2) * 50
    amplitude = 4500
    data = bytearray(rate * duration_seconds * 4)
    for i in range(rate * duration_seconds):
        sample = round(amplitude * math.sin(2 * math.pi * freq * i / rate))
        struct.pack_into("<hh", data, 4 * i, sample, sample)
    if len(data) % 2352:
        raise ValueError("Synthetic CD audio is not CD-sector aligned")
    return bytes(data)


def mp3_header_like(data: bytes) -> bool:
    if data[:3] == b"ID3":
        if len(data) < 10:
            return False
        length = 10 + ((data[6] & 127) << 21) + ((data[7] & 127) << 14) + ((data[8] & 127) << 7) + (data[9] & 127)
        data = data[length:]
    return any(data[i] == 255 and (data[i + 1] & 0xE0) == 0xE0
               for i in range(min(len(data) - 1, 16384)))


def make(source: Path, dest: Path, *, mode: str, gog_root: Path | None = None,
         tone_seconds: int = 6) -> dict:
    source, dest = source.resolve(strict=True), dest.resolve()
    if not source.is_relative_to(OUTPUT) or not dest.is_relative_to(OUTPUT):
        raise ValueError("Private CD-DA probes must stay under ignored output/")
    if source == dest:
        raise ValueError("Cannot overwrite the known working reference")
    if dest.is_symlink():
        raise ValueError("Refusing symlinked output")
    if mode not in ("tone", "owner-mp3"):
        raise ValueError("Unknown CD-DA probe mode")
    if mode == "owner-mp3":
        if gog_root is None:
            raise ValueError("Owner MP3 mode requires --gog-root")
        music = gog_root.resolve(strict=True) / "Common/Music"
        if not music.is_dir():
            raise ValueError("Missing owner GOG Common/Music folder")
    else:
        music = None

    lines = ['FILE "LBA.ISO" BINARY', '  TRACK 01 MODE1/2048', '    INDEX 01 00:00:00']
    tracks = {}
    for n in TRACKS:
        if mode == "owner-mp3":
            path = music / f"Track_{n:02d}.mp3"
            if path.is_symlink() or not path.is_file() or not (1024 <= path.stat().st_size < 100 * 1024 * 1024):
                raise ValueError(f"Missing or unsafe source CD track {n:02d}")
            data = path.read_bytes()
            if not mp3_header_like(data[:128 * 1024]):
                raise ValueError(f"Owner track {n:02d} has no recognizable MPEG frame header")
            filename, filetype = path.name, "MP3"
        else:
            data = generate_cd_audio_tone(n, tone_seconds)
            filename, filetype = f"track_{n:02d}.bin", "BINARY"
        tracks[filename] = data
        lines += [f'FILE "{filename}" {filetype}', f'  TRACK {n:02d} AUDIO', '    INDEX 01 00:00:00']
    cue = ("\r\n".join(lines) + "\r\n").encode("ascii")
    with zipfile.ZipFile(source) as z:
        if z.testzip() is not None:
            raise ValueError("Source ZIP damaged")
        names = z.namelist()
        if len(names) != len(set(names)) or "LBA.CUE" in names:
            raise ValueError("Invalid control bundle or preexisting CUE")
        for name in ("RELENT.EXE", "LBA.ISO", "LBA.CFG", "S003.LBA", "W_SB16_8.DLL"):
            if name not in names:
                raise ValueError("Missing known-good control file " + name)
        if b"WaveDriver: W_SB16_8.DLL" not in z.read("LBA.CFG"):
            raise ValueError("CD test must preserve the known 8-bit driver")
        dest.parent.mkdir(parents=True, exist_ok=True)
        pending = dest.with_suffix(".tmp")
        if pending.is_symlink():
            raise ValueError("Refusing symlinked intermediate archive")
        try:
            with zipfile.ZipFile(pending, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as out:
                for info in z.infolist():
                    out.writestr(copy.copy(info), z.read(info.filename))
                out.writestr("LBA.CUE", cue)
                for name, data in sorted(tracks.items()):
                    out.writestr(name, data)
            with zipfile.ZipFile(pending) as verify:
                if verify.testzip() is not None or verify.read("LBA.CUE") != cue:
                    raise ValueError("CD-DA probe archive failed CRC/readback")
                for name in names:
                    if verify.read(name) != z.read(name):
                        raise ValueError("Original private game contents changed: " + name)
            pending.replace(dest)
        finally:
            pending.unlink(missing_ok=True)
    return {
        "mode": mode, "bundle": str(dest), "bytes": dest.stat().st_size,
        "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
        "trackCount": len(tracks), "cue": "LBA.CUE",
        "sourceGameBytesUnchanged": True,
        "audioRuntimeState": "Not verified. Test in browser with CUE mount and actual audible output.",
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--mode", choices=("tone", "owner-mp3"), default="tone")
    p.add_argument("--gog-root", type=Path)
    p.add_argument("--tone-seconds", type=int, default=6)
    args = p.parse_args()
    try:
        print(json.dumps(make(args.input, args.out, mode=args.mode,
                              gog_root=args.gog_root, tone_seconds=args.tone_seconds), indent=2))
    except (OSError, ValueError, zipfile.BadZipFile) as err:
        print("CD-DA probe failed: " + str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
