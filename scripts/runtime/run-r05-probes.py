#!/usr/bin/env python3
"""Build isolated private R05 probes; never redistribute GOG game data.

Creates a silent control bundle, seven DOS save slots, and a wave-enabled
bundle only if the installed DOS game has a compatible driver/configuration.
All generated artifacts stay under ignored output/. Real gameplay remains
a manual acceptance gate.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SLOTS = {
    "S001.LBA": 0x01,  # Citadel
    "S002.LBA": 0x05,  # House
    "S003.LBA": 0x2B,  # Museum
    "S004.LBA": 0x0D,  # Old Burg
    "S005.LBA": 0x2A,  # Proxima
    "S006.LBA": 0x3C,  # Rebel camp
    "S007.LBA": 0x06,  # Harbor
}


def load_python_file(filename: str, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, ROOT / "scripts/runtime" / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load runtime module " + filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def inspect_slot(name: str, data: bytes) -> dict[str, object]:
    """Minimal structural checks, not proof that original RELENT.EXE loads it."""
    if name not in SLOTS:
        raise ValueError("Unexpected DOS slot: " + name)
    if not (12 <= len(data) <= 65536) or data[0] != 3:
        raise ValueError("Invalid DOS save header: " + name)
    title_end = data.find(b"\x00", 1)
    if not 1 < title_end < 32:
        raise ValueError("Invalid DOS save title: " + name)
    offset = title_end + 1
    if len(data) < offset + 0x1CA:
        raise ValueError("Truncated DOS save data: " + name)
    area = data[offset + 0x100]
    if area != SLOTS[name]:
        raise ValueError(f"{name}: expected scene {SLOTS[name]}, found {area}")
    return {"slot": name, "scene": area, "bytes": len(data)}


def generate_isolated_saves(output_dir: Path) -> list[dict[str, object]]:
    """Reuse the historic generator, then copy only the seven known slots."""
    generator = ROOT / "scripts/hqr-tools/create-savegame.js"
    run = subprocess.run(
        ["node", str(generator), "--dos", "--no-deploy"],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    if run.returncode:
        raise RuntimeError("Save generator failed:\n" + (run.stderr or run.stdout)[-2500:])
    generated = ROOT / "output/saves/dos"
    isolated = output_dir / "saves"
    isolated.mkdir(parents=True, exist_ok=True)
    unknown = [p.name for p in isolated.iterdir() if p.name not in SLOTS or not p.is_file() or p.is_symlink()]
    if unknown:
        raise ValueError("Probe save folder contains unexpected files: " + ", ".join(unknown))
    slots = []
    for name in SLOTS:
        source = generated / name
        if source.is_symlink() or not source.is_file():
            raise ValueError("Missing generated save: " + name)
        data = source.read_bytes()
        slots.append(inspect_slot(name, data))
        (isolated / name).write_bytes(data)
    return slots


def verify_bundle(path: Path, saves: Path, audio: str) -> dict[str, object]:
    """Inspect the actual ZIP; no claim about in-emulator gameplay."""
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError("ZIP verification failed: " + path.name)
        names = set(archive.namelist())
        if "RELENT.EXE" not in names or "LBA.ISO" not in names:
            raise ValueError("DOS runtime files missing in " + path.name)
        for name in SLOTS:
            if archive.read(name) != (saves / name).read_bytes():
                raise ValueError("Save bytes differ after packaging: " + name)
        cfg = archive.read("LBA.CFG")
        if audio == "off" and b"WaveDriver: NoWave" not in cfg:
            raise ValueError("Silent control unexpectedly enables wave audio")
        if audio == "source-wave" and b"WaveDriver: NoWave" in cfg:
            raise ValueError("Wave experiment unexpectedly disables wave audio")
    return {"file": str(path), "bytes": path.stat().st_size,
            "audio": audio, "slotsVerified": len(SLOTS),
            "state": "ZIP verified; in-game audio/scene/death behavior not verified"}


def build_bundle(base: Path, mods: Path, saves: Path, path: Path, audio: str):
    run = subprocess.run(
        [sys.executable, str(ROOT / "scripts/runtime/build-private-jsdos.py"),
         "--base", str(base), "--mods", str(mods),
         "--saves-dir", str(saves), "--audio", audio, "--out", str(path)],
        cwd=ROOT, text=True, capture_output=True, check=False,
    )
    if run.returncode:
        raise RuntimeError(f"Private {audio} build failed:\n" +
                           (run.stderr or run.stdout)[-2500:])


def execute(base: Path, output: Path) -> dict[str, object]:
    base = base.resolve(strict=True)
    output = output.resolve()
    if not output.is_relative_to((ROOT / "output").resolve()) or output == (ROOT / "output").resolve():
        raise ValueError("Probe output must be a subdirectory of ignored output/")
    if output.is_symlink():
        raise ValueError("Refusing symlinked output directory")
    audit = load_python_file("audit-dos-install.py", "r05_audio_audit")
    builder = load_python_file("build-private-jsdos.py", "r05_private_builder")
    inventory = audit.check_install(base)
    gameover_inspector = load_python_file("inspect_gameover_resources.py", "r05_gameover_audit")
    gameover_resources = gameover_inspector.inspect_gameover_files(base)
    if inventory["missing"]:
        raise ValueError("Required DOS files missing: " + ", ".join(inventory["missing"]))

    output.mkdir(parents=True, exist_ok=True)
    mods = output / "empty-mods"
    mods.mkdir(exist_ok=True)
    if any(mods.iterdir()):
        raise ValueError("Control mods directory must remain empty: " + str(mods))

    slots = generate_isolated_saves(output)
    saves = output / "saves"
    silent = output / "r05-silent.jsdos"
    build_bundle(base, mods, saves, silent, "off")
    bundles = [verify_bundle(silent, saves, "off")]

    try:
        builder.prepare_audio(builder.owner_files(base), "source-wave")
    except (ValueError, OSError) as error:
        wave = {"state": "not built", "reason": str(error)}
    else:
        candidate = output / "r05-source-wave.jsdos"
        build_bundle(base, mods, saves, candidate, "source-wave")
        bundles.append(verify_bundle(candidate, saves, "source-wave"))
        wave = {"state": "packaged; audible SFX not verified", "file": str(candidate)}

    # Explicit SB16 fallback for a genuine GOG DOS driver even if LBA.CFG
    # disables wave effects. This is another *experimental*, isolated bundle.
    try:
        builder.prepare_audio(builder.owner_files(base), "sb16")
    except (ValueError, OSError) as error:
        sb16 = {"state": "not built", "reason": str(error)}
    else:
        candidate = output / "r05-sb16.jsdos"
        build_bundle(base, mods, saves, candidate, "sb16")
        bundles.append(verify_bundle(candidate, saves, "sb16"))
        sb16 = {"state": "packaged; audible SFX not verified", "file": str(candidate)}

    report = {
        "installation": str(base),
        "audioGate": inventory["audio_gate"],
        "gameOverResources": gameover_resources,
        "wave": wave,
        "sb16": sb16,
        "saves": slots,
        "bundles": bundles,
        "manualGates": [
            "Compare identical scene with silent and wave bundles for audible SFX",
            "Load S003 Museum, S002 House and S005 Proxima; confirm position, collision and movement",
            "Test death with a remaining clover, separately from final game over",
            "For black screen, record elapsed time, ESC behavior, screenshot and browser console",
            "Inspect RESS.HQR entry 21 and SAMPLES.HQR entry 37; a valid header does not prove decoded content",
        ],
        "status": "Packaged probes only; real DOS gameplay tests must be completed by owner",
    }
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--base", type=Path, required=True,
                     help="Owner-provided GOG Speedrun/Windows directory (read-only)")
    cli.add_argument("--out-dir", type=Path, default=ROOT / "output/r05-probes")
    args = cli.parse_args()
    try:
        report = execute(args.base, args.out_dir)
    except (ValueError, RuntimeError, OSError) as error:
        print("R05 probes failed: " + str(error), file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
