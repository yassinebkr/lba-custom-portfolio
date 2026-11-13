#!/usr/bin/env python3
"""One original GOG MP3 -> bounded raw CD-DA preview inside a private tone CUE.

The original main menu requests CD track 10; default to that track.\nUse only after the raw synthetic CD tone gate; the selected js-dos 8 DOSBox
backend is built without SDL_sound, so directly embedded MP3 tracks are not
a supported test. Preserve ALL game bytes and the other eight synthetic tracks.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = (ROOT / "output").resolve()
CD_SECTOR = 2352


def make(source: Path, dest: Path, *, gog_root: Path, track: int = 10,
         seconds: int = 30) -> dict:
    source, dest = source.resolve(strict=True), dest.resolve()
    if not source.is_relative_to(OUTPUT) or not dest.is_relative_to(OUTPUT):
        raise ValueError("Private CD preview archives must stay under ignored output/")
    if source == dest or dest.is_symlink():
        raise ValueError("Cannot overwrite control or write to a symlink")
    if not 2 <= track <= 10 or not 1 <= seconds <= 60:
        raise ValueError("Track must be 02..10 and preview duration 1..60 seconds")
    original = gog_root.resolve(strict=True) / "Common" / "Music" / f"Track_{track:02d}.mp3"
    if original.is_symlink() or not original.is_file():
        raise ValueError("Missing owner MP3 track " + str(original))
    if not 1024 <= original.stat().st_size <= 100 * 1024 * 1024:
        raise ValueError("Owner MP3 track size is unexpected")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required for owner-local MP3 -> PCM decoding")
    filename = f"track_{track:02d}.bin"
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin",
        "-i", str(original), "-t", str(seconds),
        "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le",
        "-f", "s16le", "pipe:1"
    ]
    result = subprocess.run(cmd, capture_output=True, check=False, timeout=120)
    if result.returncode != 0:
        raise RuntimeError("Local ffmpeg decode failed: " + result.stderr.decode("utf-8", errors="replace")[-300:])
    pcm = result.stdout
    if len(pcm) < 176400 or len(pcm) > seconds * 176400 or len(pcm) % CD_SECTOR:
        raise ValueError("Invalid CD-DA PCM: must be 44.1 kHz 16-bit stereo, sector aligned")
    with zipfile.ZipFile(source) as z:
        names = z.namelist()
        if z.testzip() is not None or len(set(names)) != len(names):
            raise ValueError("Source CD tone archive failed integrity checks")
        for needed in ("LBA.CUE", filename, "RELENT.EXE", "S003.LBA"):
            if needed not in names:
                raise ValueError("Input must be an existing private synthetic tone CUE: " + needed)
        cue = z.read("LBA.CUE")
        needle = f'FILE "{filename}" BINARY'.encode("ascii")
        if cue.count(needle) != 1 or b"TRACK 01 MODE1/2048" not in cue:
            raise ValueError("Expected the generated mixed-mode RAW PCM CUE")
        dest.parent.mkdir(parents=True, exist_ok=True)
        candidate = dest.with_suffix(".tmp")
        if candidate.is_symlink():
            raise ValueError("Refusing symlinked intermediate output")
        try:
            with zipfile.ZipFile(candidate, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as out:
                for info in z.infolist():
                    data = pcm if info.filename == filename else z.read(info.filename)
                    out.writestr(copy.copy(info), data)
            with zipfile.ZipFile(candidate) as candidateZip:
                if candidateZip.testzip() is not None or candidateZip.read(filename) != pcm:
                    raise ValueError("Owner CD preview failed ZIP read-back")
                for item in names:
                    if item != filename and candidateZip.read(item) != z.read(item):
                        raise ValueError("Unexpected private input mutation: " + item)
            candidate.replace(dest)
        finally:
            candidate.unlink(missing_ok=True)
    return {
        "privateArchive": str(dest), "selectedTrack": track, "durationSeconds": len(pcm) // 176400,
        "pcmBytes": len(pcm), "bundleBytes": dest.stat().st_size,
        "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
        "state": "Synthetic CD tone replaced with owner PCM; actual DOSBox playback unverified",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--gog-root", type=Path, required=True)
    parser.add_argument("--track", type=int, choices=range(2, 11), default=10)
    parser.add_argument("--seconds", type=int, default=30)
    args = parser.parse_args()
    try:
        print(json.dumps(make(args.input, args.out, gog_root=args.gog_root,
                              track=args.track, seconds=args.seconds), indent=2))
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired,
            zipfile.BadZipFile) as err:
        print("Owner-local PCM preview failed: " + str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
