#!/usr/bin/env python3
"""Read-only report of the owner-provided LBA1 DOS installation.

Reports filenames and audio driver availability only. Never changes the
game installation, registry, or any other mounted volume.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import re


def dos_config(path: Path) -> dict[str, str]:
    if not path.is_file() or path.is_symlink():
        return {}
    content = path.read_bytes()
    if len(content) > 128 * 1024:
        raise ValueError("Unusually large LBA.CFG; refusing to parse")
    data = content.decode("latin1")
    config: dict[str, str] = {}
    for line in data.splitlines():
        line = line.strip()
        if not line or line.startswith(";") or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().lower()
        if key in config:
            raise ValueError(f"Duplicate LBA.CFG option: {key}")
        config[key] = value.strip()
    return config


def check_install(base: Path) -> dict[str, object]:
    if not base.is_dir() or base.is_symlink():
        raise ValueError("A clean source directory is required")
    contents = {p.name.upper(): p for p in base.iterdir() if p.is_file() and not p.is_symlink()}
    expected = ("RELENT.EXE", "RESS.HQR", "SPRITES.HQR", "SCENE.HQR", "SAMPLES.HQR")
    missing = [name for name in expected if name not in contents]
    cfg = dos_config(contents.get("LBA.CFG", base / "LBA.CFG"))
    fields = {key: cfg.get(key, "(missing)") for key in (
        "wavedriver", "waveexec", "wavebase", "waveirq", "wavedma", "waverate",
        "mididriver", "mixerdriver",
    )}
    result: dict[str, object] = {
        "base": str(base),
        "missing": missing,
        "audio_config": fields,
        "dll_files": sorted(name for name in contents if name.endswith(".DLL")),
        "setup_files": sorted(name for name in contents if name.startswith("SETUP")),
    }
    candidate = cfg.get("wavedriver", "NoWave")
    if candidate.lower() == "nowave":
        result["audio_gate"] = "wave disabled in source LBA.CFG"
    elif not re.fullmatch(r"[A-Za-z0-9_-]{1,8}\.DLL", candidate, re.I):
        result["audio_gate"] = "unsupported WaveDriver filename; manual review required"
    elif candidate.upper() not in contents:
        result["audio_gate"] = f"driver {candidate} missing from DOS directory"
    else:
        result["audio_gate"] = f"local driver {candidate} found; in-browser playback still unverified"
    sb16 = contents.get("W_SB16.DLL")
    if sb16 is None:
        result["sb16_gate"] = "not available: original W_SB16.DLL absent"
    elif 8192 <= sb16.stat().st_size <= 128 * 1024:
        result["sb16_gate"] = "owner-provided W_SB16.DLL present; packaging can be attempted"
    else:
        result["sb16_gate"] = "W_SB16.DLL size outside accepted DOS driver range"
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, required=True)
    args = parser.parse_args()
    report = check_install(args.base)
    print("DOS installation:", report["base"])
    print("Required file gaps:", ", ".join(report["missing"]) or "none")
    print("Audio configuration:")
    for k, v in report["audio_config"].items():
        print(f"  {k}: {v}")
    print("DOS DLL files:", ", ".join(report["dll_files"]) or "(none)")
    print("Setup files:", ", ".join(report["setup_files"]) or "(none)")
    print("Wave driver gate:", report["audio_gate"])
    print("SB16 profile gate:", report["sb16_gate"])
    print("Read-only inspection complete.")


if __name__ == "__main__":
    main()
