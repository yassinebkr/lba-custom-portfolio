#!/usr/bin/env python3
"""Build an owner-local LBA1 js-dos 6.22 bundle on Linux.

The repository contains build tools only. Game executables and archives are
read from owner-supplied directories and are never shipped by GitHub Pages.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
REQUIRED = (
    "RELENT.EXE", "RESS.HQR", "SPRITES.HQR", "SCENE.HQR",
    "LBA_BRK.HQR", "LBA_BLL.HQR", "LBA_GRI.HQR", "SAMPLES.HQR",
)
PATCHED_SIGNATURES = {
    0x10A5F: bytes.fromhex("c6 05 32 2c 00 00 03 b8 01 00 00 00 90"),
    0x10AF1: bytes.fromhex("eb 0f"),
    0x0F83F: bytes([0x90] * 13),
    0x10E71: bytes([0x90] * 13),
}
CONFIG = (
    "[sdl]\r\n"
    "fullscreen=false\r\n"
    "[dosbox]\r\n"
    "machine=svga_s3\r\n"
    "memsize=16\r\n"
    "[sblaster]\r\n"
    "sbtype=sb16\r\n"
    "sbbase=220\r\n"
    "irq=7\r\n"
    "dma=1\r\n"
    "hdma=5\r\n"
    "sbmixer=true\r\n"
    "oplmode=auto\r\n"
    "[mixer]\r\n"
    "nosound=false\r\n"
    "rate=22050\r\n"
    "[cpu]\r\n"
    "core=auto\r\n"
    "cputype=auto\r\n"
    "cycles=auto\r\n"
    "[midi]\r\n"
    "mididevice=none\r\n"
)
GAME_CONFIG = (
    "; js-dos 6.22 owner-local verification\r\n"
    "Language: English\r\n"
    "LanguageCD: English\r\n"
    "FlagKeepVoice: OFF\r\n"
    "FlagDisplayText: ON\r\n"
    "SvgaDriver: VESA\r\n"
    "MidiDriver: NoMidi\r\n"
    "MidiExec: NoExec\r\n"
    "MidiBase: 330h\r\n"
    "MidiIRQ: \r\n"
    "MidiDMA: \r\n"
    "MidiType: Fm\r\n"
    "WaveDriver: NoWave\r\n"
    "WaveExec: NoExec\r\n"
    "WaveBase: 220h\r\n"
    "WaveIRQ: 7\r\n"
    "WaveDMA: 1\r\n"
    "WaveRate: 22000\r\n"
    "MixerDriver: NoMixer\r\n"
    "MixerBase: 220h\r\n"
    "WaveVolume: 163\r\n"
    "MusicVolume: 100\r\n"
    "CDVolume: 0\r\n"
    "LineVolume: 0\r\n"
    "MasterVolume: 128\r\n"
)


def owner_files(directory: Path) -> dict[str, Path]:
    if not directory.is_dir() or directory.is_symlink():
        raise ValueError(f"Missing or unsafe private source directory: {directory}")
    result: dict[str, Path] = {}
    for child in directory.iterdir():
        if child.is_symlink():
            raise ValueError(f"Private input symlinks are unsupported: {child.name}")
        if child.is_file() and child.suffix.upper() in {".EXE", ".HQR", ".CFG", ".DLL"}:
            key = child.name.upper()
            if key in result:
                raise ValueError(f"Case-insensitive duplicate game file: {key}")
            if key != "VOX.HQR":
                result[key] = child
    return result



def prepare_audio(sources: dict[str, Path], profile: str) -> bytes:
    """Verify the historical driver exists before enabling WaveDriver.

    The old DOS runtime loads WaveDriver as a DLL filename. The DOSBox SB16
    hardware emulation alone cannot supply a missing game-specific driver.
    """
    if profile == "off":
        return GAME_CONFIG.encode("ascii")
    if profile in ("sb16", "sb16-8", "sb16-mono", "sb16-8-fm", "sb16-8-adlib", "sb16-mixer", "sb16-mixer-loud"):
        # The historical build uses 16-bit stereo for W_SB16.DLL and 8-bit
        # stereo for W_SB16_8.DLL. Keep all variants isolated and opt-in.
        driver_name = {"sb16-8": "W_SB16_8.DLL", "sb16-8-fm": "W_SB16_8.DLL", "sb16-8-adlib": "W_SB16_8.DLL", "sb16-mono": "W_SB16_M.DLL"}.get(profile, "W_SB16.DLL")
        driver = sources.get(driver_name)
        if driver is None:
            raise ValueError(f"{profile} needs owner-provided {driver_name}")
        if not (8192 <= driver.stat().st_size <= 128 * 1024):
            raise ValueError(f"Owner-provided {driver_name} has unexpected size")
        configuration = GAME_CONFIG
        if configuration.count("WaveDriver: NoWave\r\n") != 1:
            raise ValueError("Internal WaveDriver template is ambiguous")
        configuration = configuration.replace(
            "WaveDriver: NoWave\r\n", f"WaveDriver: {driver_name}\r\n"
        )
        if profile in ("sb16-mixer", "sb16-mixer-loud"):
            mixer = sources.get("M_SB16.DLL")
            if mixer is None:
                raise ValueError(f"{profile} needs owner-provided M_SB16.DLL")
            if not (512 <= mixer.stat().st_size <= 8192):
                raise ValueError("Owner-provided M_SB16.DLL has unexpected size")
            # The original engine only writes the game's WaveVolume and
            # MasterVolume to SB16 hardware when MixerDriver is enabled.
            configuration = configuration.replace(
                "MixerDriver: NoMixer\r\n", "MixerDriver: M_SB16.DLL\r\n"
            )
            if profile == "sb16-mixer-loud":
                # Volume-only delta from sb16-mixer (both drivers unchanged).
                # Experimental high volume; reduce host volume when testing.
                configuration = configuration.replace(
                    "WaveVolume: 163\r\n", "WaveVolume: 240\r\n"
                ).replace(
                    "MasterVolume: 128\r\n", "MasterVolume: 240\r\n"
                )
        if profile in ("sb16-8-fm", "sb16-8-adlib"):
            # Miles FM driver comparison: the previous A32SBFM.DLL
            # default-IO detection failed in js-dos 6.22. For AdLib,
            # explicitly use its fixed OPL port 388h (not the MPU-401
            # port 330h) while keeping the same 8-bit SB16 wave path.
            fm_driver_name = (
                "A32ALGFM.DLL" if profile == "sb16-8-adlib"
                else "A32SBFM.DLL"
            )
            fm_driver = sources.get(fm_driver_name)
            midi_bank = sources.get("MIDI_SB.HQR")
            if fm_driver is None or not (8192 <= fm_driver.stat().st_size <= 128 * 1024):
                raise ValueError(f"{profile} needs owner-provided {fm_driver_name}")
            if midi_bank is None or not (1024 <= midi_bank.stat().st_size <= 16 * 1024 * 1024):
                raise ValueError(f"{profile} needs owner-provided MIDI_SB.HQR")
            for key, previous, new in (
                ("MidiDriver", "NoMidi", fm_driver_name),
                ("MidiBase", "330h", "388h" if profile == "sb16-8-adlib" else "-1"),
                ("MidiIRQ", "", "-1"),
                ("MidiDMA", "", "-1"),
            ):
                old_line = f"{key}: {previous}\r\n"
                if configuration.count(old_line) != 1:
                    raise ValueError("Unexpected FM MIDI config template: " + key)
                configuration = configuration.replace(old_line, f"{key}: {new}\r\n")
        return configuration.encode("ascii")
    if profile != "source-wave":
        raise ValueError(f"Unknown audio profile: {profile}")
    original = sources.get("LBA.CFG")
    if original is None:
        raise ValueError("source-wave needs the owner-provided LBA.CFG")
    raw = original.read_bytes()
    if len(raw) > 128 * 1024:
        raise ValueError("Source LBA.CFG is unexpectedly large")
    fields = {}
    for line in raw.decode("latin1").splitlines():
        line = line.strip()
        if not line or line.startswith((";", "#")) or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().lower()
        if key in fields:
            raise ValueError(f"Duplicate game audio configuration key: {key}")
        fields[key] = value.strip()
    driver = fields.get("wavedriver", "")
    if not re.fullmatch(r"[a-z0-9_-]{1,8}\.dll", driver, flags=re.I):
        raise ValueError("source-wave requires a DOS WaveDriver .DLL filename in LBA.CFG")
    if driver.upper() not in sources:
        raise ValueError(f"Source WaveDriver {driver} missing from DOS installation")
    if fields.get("waveexec", "NoExec").lower() not in ("", "noexec"):
        raise ValueError("WaveExec requires an unverified setup program; refusing source-wave")
    required = {"wavebase": ("220h", "220"), "waveirq": ("7",),
                "wavedma": ("1",), "waverate": ("11025", "22000", "22050")}
    for key, supported in required.items():
        if fields.get(key, "").lower() not in supported:
            raise ValueError(f"Source LBA.CFG has unsupported {key}: {fields.get(key, '(missing)')}")
    configuration = GAME_CONFIG
    for key, value in {
        "WaveDriver": driver.upper(), "WaveBase": fields["wavebase"],
        "WaveIRQ": fields["waveirq"], "WaveDMA": fields["wavedma"],
        "WaveRate": fields["waverate"],
    }.items():
        configuration = re.sub(
            rf"(?m)^{re.escape(key)}:[^\r\n]*",
            lambda match, k=key, v=value: f"{k}: {v}",
            configuration,
        )
    return configuration.encode("ascii")


def selected_dos_saves(directory: Path | None) -> dict[str, Path]:
    """Include only explicit DOS Snnn.LBA saves; never follow links."""
    if directory is None:
        return {}
    if not directory.is_dir() or directory.is_symlink():
        raise ValueError(f"Unsafe or missing DOS save directory: {directory}")
    saves = {}
    for file in directory.iterdir():
        if file.is_symlink():
            raise ValueError(f"Symlinks not permitted in DOS save directory: {file.name}")
        if not file.is_file():
            continue
        if not re.fullmatch(r"S[0-9]{3}\.LBA", file.name, flags=re.I):
            raise ValueError(f"Invalid DOS save slot filename: {file.name}")
        name = file.name.upper()
        if name in saves:
            raise ValueError(f"Duplicate DOS save slot: {name}")
        if not 12 <= file.stat().st_size <= 65536:
            raise ValueError(f"Unexpected DOS save size: {file.name}")
        saves[name] = file
    if not saves:
        raise ValueError("No DOS Snnn.LBA saves found")
    return saves

def assert_patched(executable: Path) -> None:
    with executable.open("rb") as handle:
        for offset, expected in PATCHED_SIGNATURES.items():
            handle.seek(offset)
            actual = handle.read(len(expected))
            if actual != expected:
                raise ValueError(
                    f"Executable patch mismatch at 0x{offset:x}. "
                    "Use a compatible original RELENT.EXE with the guarded patcher."
                )


def validate_output_path(out: Path) -> None:
    if out.suffix.lower() != ".jsdos":
        raise ValueError("Private output must have a .jsdos extension")
    resolved = out.resolve()
    if resolved.is_symlink():
        raise ValueError("Private output symlinks are unsupported")
    if resolved.is_relative_to(ROOT) and not (
        resolved.is_relative_to(ROOT / "web_deploy")
        or resolved.is_relative_to(ROOT / "output")
    ):
        raise ValueError("Private game bundles must stay in ignored output locations")
    if out.exists() and out.is_symlink():
        raise ValueError("Refusing to overwrite a symlink")


def run_iso_tool(source: Path, target: Path) -> None:
    xorriso = shutil.which("xorriso")
    if not xorriso:
        raise RuntimeError("xorriso missing. Install on Debian: sudo apt install xorriso")
    subprocess.run(
        [xorriso, "-as", "mkisofs", "-quiet", "-iso-level", "1",
         "-V", "ADELINE", "-o", str(target), str(source)],
        check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    with target.open("rb") as handle:
        handle.seek(16 * 2048)
        descriptor = handle.read(72)
    if len(descriptor) != 72 or descriptor[0] != 1 or descriptor[1:6] != b"CD001":
        raise ValueError("ISO9660 primary volume descriptor is missing")
    if descriptor[40:72].decode("ascii").strip() != "ADELINE":
        raise ValueError("ISO9660 volume label must be ADELINE")
    inspected = subprocess.run(
        [xorriso, "-indev", str(target), "-ls", "/"],
        check=True, capture_output=True, text=True
    ).stdout.upper()
    for file in ("CD_LBA", "SAMPLES.HQR"):
        if file not in inspected:
            raise ValueError(f"CD ISO is missing {file}")


def zip_entry(name: str, data: bytes, directory: bool = False) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_STORED if directory else zipfile.ZIP_DEFLATED
    info.external_attr = (0o40755 if directory else 0o100644) << 16
    return info


def write_bundle(folder: Path, destination: Path) -> None:
    files = sorted(p for p in folder.rglob("*") if p.is_file())
    dirs = sorted(p for p in folder.rglob("*") if p.is_dir())
    with zipfile.ZipFile(destination, "w", allowZip64=True) as archive:
        # The bundled js-dos 6.22 ZIP extractor expects explicit parent
        # directory records before nested files.
        for directory in dirs:
            rel = directory.relative_to(folder).as_posix() + "/"
            archive.writestr(zip_entry(rel, b"", True), b"")
        for file in files:
            rel = file.relative_to(folder).as_posix()
            with file.open("rb") as source, archive.open(zip_entry(rel, b""), "w") as dest:
                shutil.copyfileobj(source, dest, length=1024 * 1024)
    with zipfile.ZipFile(destination) as archive:
        names = archive.namelist()
        if not names or names[0] != ".jsdos/":
            raise ValueError("js-dos 6.22 requires .jsdos/ as first ZIP entry")
        required = set(REQUIRED) | {"LBA.ISO", "LBA.CFG", ".jsdos/dosbox.conf"}
        if missing := required.difference(names):
            raise ValueError("Missing ZIP bundle entries: " + ", ".join(sorted(missing)))
        if len(names) != len(set(names)):
            raise ValueError("Duplicate ZIP bundle entries")
        if archive.testzip() is not None:
            raise ValueError("ZIP integrity test failed")


def build(base: Path, mods: Path, output: Path, *, audio: str = "off",
          saves_dir: Path | None = None) -> dict[str, object]:
    validate_output_path(output)
    if base.resolve() == mods.resolve():
        raise ValueError("Source and modification directories must differ")
    sources = owner_files(base)
    if missing := set(REQUIRED).difference(sources):
        raise ValueError("Missing owner-provided files: " + ", ".join(sorted(missing)))
    game_config = prepare_audio(sources, audio)
    dos_saves = selected_dos_saves(saves_dir)
    overlays = owner_files(mods) if mods.exists() else {}
    exe_override = overlays.pop("RELENT.EXE", None)
    for key in overlays:
        if not key.endswith(".HQR"):
            raise ValueError("Only HQR overlays and the guarded patched EXE are supported")
        if key not in sources:
            raise ValueError(f"Unrecognized private HQR overlay: {key}")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="lba-dos-", dir=output.parent) as tmp:
        work = Path(tmp)
        game = work / "game"
        cd = work / "cd"
        (game / ".jsdos").mkdir(parents=True)
        cd.mkdir()
        for key, src in sorted(sources.items()):
            if key != "RELENT.EXE":
                shutil.copyfile(src, game / key)
        for key, src in sorted(overlays.items()):
            shutil.copyfile(src, game / key)
        if exe_override:
            shutil.copyfile(exe_override, game / "RELENT.EXE")
        else:
            node = shutil.which("node")
            if not node:
                raise RuntimeError("Node.js is required for the guarded RELENT.EXE patcher")
            subprocess.run(
                [node, str(ROOT / "scripts/hqr-tools/patch-relent.js"),
                 "--input", str(sources["RELENT.EXE"]),
                 "--output", str(game / "RELENT.EXE")],
                check=True, capture_output=True, text=True
            )
        assert_patched(game / "RELENT.EXE")
        for filename, source in sorted(dos_saves.items()):
            shutil.copyfile(source, game / filename)
        (game / ".jsdos/dosbox.conf").write_bytes(CONFIG.encode("ascii"))
        (game / "LBA.CFG").write_bytes(game_config)
        (cd / "CD_LBA").write_bytes(b'"15/08/94 Lba Demo" \r\n')
        shutil.copyfile(sources["SAMPLES.HQR"], cd / "SAMPLES.HQR")
        run_iso_tool(cd, game / "LBA.ISO")

        candidate = work / "candidate.jsdos"
        write_bundle(game, candidate)
        os.replace(candidate, output)

    digest_state = hashlib.sha256()
    with output.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest_state.update(chunk)
    digest = digest_state.hexdigest()
    return {"bundle": str(output), "bytes": output.stat().st_size,
            "sha256": digest, "originalFiles": len(sources),
            "overlays": len(overlays) + int(exe_override is not None),
            "audio": audio, "saves": len(dos_saves),
            "status": "package-verified; audio-and-scene-behavior-pending"}


def main(argv: list[str] | None = None) -> int:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--base", type=Path, default=ROOT / "base_game",
                     help="A separate lawful installation, not a damaged disk")
    cli.add_argument("--mods", type=Path, default=ROOT / "output")
    cli.add_argument("--out", type=Path, default=ROOT / "web_deploy/lba1_portfolio.jsdos")
    cli.add_argument("--audio", choices=("off", "source-wave", "sb16", "sb16-8", "sb16-mono", "sb16-8-fm", "sb16-8-adlib", "sb16-mixer", "sb16-mixer-loud"), default="off",
                     help="Experimental SFX: source config DLL or owner-provided W_SB16.DLL")
    cli.add_argument("--saves-dir", type=Path,
                     help="Optional private directory containing DOS Snnn.LBA save files")
    args = cli.parse_args(argv)
    try:
        report = build(args.base.resolve(), args.mods.resolve(), args.out.resolve(),
                       audio=args.audio,
                       saves_dir=args.saves_dir.resolve() if args.saves_dir else None)
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "").strip()
        print(f"R05 build failed: external tool returned {error.returncode}", file=sys.stderr)
        if detail:
            print(detail[-2500:], file=sys.stderr)
        return 1
    except (OSError, ValueError, RuntimeError) as error:
        print(f"R05 build failed: {error}", file=sys.stderr)
        return 1
    print("R05 private bundle ready for local browser import")
    for key, value in report.items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
