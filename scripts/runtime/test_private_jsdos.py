"""Synthetic-only R05 private bundle integration tests.

No real Little Big Adventure executable or HQR resource is used in CI.
"""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "scripts/runtime/build-private-jsdos.py"
PATCHER = ROOT / "scripts/hqr-tools/patch-relent.js"

ORIGINAL_PATCHES = {
    0x10A5F: bytes.fromhex("68 5c 01 00 00 e8 2c 89 01 00 83 c4 04"),
    0x10AF1: bytes.fromhex("75 0f"),
    0x0F83F: bytes.fromhex("68 3c 00 00 00 e8 07 54 01 00 83 c4 04"),
    0x10E71: bytes.fromhex("68 64 02 00 00 e8 d5 3d 01 00 83 c4 04"),
}
REQUIRED = (
    "RESS.HQR", "SPRITES.HQR", "SCENE.HQR",
    "LBA_BRK.HQR", "LBA_BLL.HQR", "LBA_GRI.HQR", "SAMPLES.HQR",
)


def fixture_game(directory: Path, compatible: bool = True) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    exe = bytearray(0x12000)
    for offset, source in ORIGINAL_PATCHES.items():
        exe[offset:offset + len(source)] = source
    if not compatible:
        exe[0x10A5F] = 0xFF
    (directory / "RELENT.EXE").write_bytes(exe)
    for name in REQUIRED:
        (directory / name).write_bytes(b"synthetic-test-resource:" + name.encode("ascii"))


class PrivateBundleBuildTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="r05-synthetic-")
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)
        self.base = self.path / "base"
        self.mods = self.path / "overlays"
        self.mods.mkdir()
        self.bundle = self.path / "private.jsdos"
        fixture_game(self.base)

    def run_builder(self, *options):
        return subprocess.run(
            [sys.executable, str(BUILDER), "--base", str(self.base),
             "--mods", str(self.mods), "--out", str(self.bundle), *options],
            text=True, capture_output=True, check=False,
        )

    def test_full_linux_iso_and_zip_pipeline(self):
        result = self.run_builder()
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertTrue(self.bundle.is_file())
        with zipfile.ZipFile(self.bundle) as archive:
            names = archive.namelist()
            self.assertEqual(names[0], ".jsdos/")
            self.assertEqual(len(names), len(set(names)))
            self.assertTrue(set(REQUIRED).issubset(names))
            self.assertTrue({
                "RELENT.EXE", ".jsdos/dosbox.conf", "LBA.ISO", "LBA.CFG"
            }.issubset(names))
            self.assertNotIn("VOX.HQR", names)
            self.assertIn(b"machine=svga_s3", archive.read(".jsdos/dosbox.conf"))
            self.assertIn(b"FlagKeepVoice: OFF", archive.read("LBA.CFG"))
            self.assertIn(b"WaveDriver: NoWave", archive.read("LBA.CFG"))
            self.assertIn(b"sbtype=sb16", archive.read(".jsdos/dosbox.conf"))
            exe = archive.read("RELENT.EXE")
            self.assertEqual(exe[0x10AF1:0x10AF3], bytes.fromhex("eb 0f"))
            self.assertEqual(exe[0x0F83F:0x0F84C], b"\x90" * 13)
            iso = archive.read("LBA.ISO")
            self.assertEqual(iso[16 * 2048 + 1:16 * 2048 + 6], b"CD001")
            self.assertEqual(iso[16 * 2048 + 40:16 * 2048 + 72].rstrip(), b"ADELINE")
            self.assertIsNone(archive.testzip())
        self.assertIn("audio-and-scene-behavior-pending", result.stdout)

    def test_overlay_replaces_only_existing_HQR_entry(self):
        (self.mods / "SCENE.HQR").write_bytes(b"synthetic-replacement-scene")
        result = self.run_builder()
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.bundle) as archive:
            self.assertEqual(archive.read("SCENE.HQR"), b"synthetic-replacement-scene")
            self.assertEqual(archive.read("RESS.HQR"), b"synthetic-test-resource:RESS.HQR")

    def test_rejects_incompatible_executable_without_output(self):
        fixture = bytearray((self.base / "RELENT.EXE").read_bytes())
        fixture[0x10A5F] = 0xFF
        (self.base / "RELENT.EXE").write_bytes(fixture)
        result = self.run_builder()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("patch", result.stderr.lower())
        self.assertFalse(self.bundle.exists())

    def test_missing_owner_input_fails_closed(self):
        (self.base / "LBA_GRI.HQR").unlink()
        result = self.run_builder()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("LBA_GRI.HQR", result.stderr)
        self.assertFalse(self.bundle.exists())

    def test_symlink_input_fails_closed(self):
        target = self.base / "RESS.HQR"
        target.unlink()
        target.symlink_to(self.base / "SCENE.HQR")
        result = self.run_builder()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("symlink", result.stderr.lower())
        self.assertFalse(self.bundle.exists())

    def test_rejects_unknown_overlay(self):
        (self.mods / "NOT_A_GAME.HQR").write_bytes(b"ignored")
        result = self.run_builder()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unrecognized", result.stderr)

    def test_patch_cli_rejects_wrong_source_signature(self):
        target = self.path / "bad.exe"
        fixture_game(self.base, compatible=False)
        result = subprocess.run(
            ["node", str(PATCHER), "--input", str(self.base / "RELENT.EXE"),
             "--output", str(target)],
            text=True, capture_output=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(target.exists())

    def test_original_game_input_bytes_remain_unchanged(self):
        before = (self.base / "RELENT.EXE").read_bytes()
        result = self.run_builder()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.base / "RELENT.EXE").read_bytes(), before)


    def test_explicit_dos_scene_slots_are_packed_at_root(self):
        slots = self.path / "slots"
        slots.mkdir()
        (slots / "S001.LBA").write_bytes(bytes(range(256)) * 2)
        result = self.run_builder("--saves-dir", str(slots))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("saves: 1", result.stdout)
        with zipfile.ZipFile(self.bundle) as archive:
            self.assertEqual(archive.read("S001.LBA"), bytes(range(256)) * 2)

    def test_invalid_save_name_rejected_without_bundle(self):
        slots = self.path / "slots"
        slots.mkdir()
        (slots / "my_game.lba").write_bytes(b"x" * 512)
        result = self.run_builder("--saves-dir", str(slots))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("save slot", result.stderr.lower())
        self.assertFalse(self.bundle.exists())

    def test_missing_source_sound_configuration_is_rejected(self):
        result = self.run_builder("--audio", "source-wave")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("LBA.CFG", result.stderr)
        self.assertFalse(self.bundle.exists())

    def test_missing_wave_driver_file_is_rejected(self):
        (self.base / "LBA.CFG").write_bytes(
            b"WaveDriver: WAVESB.DLL\r\n"
            b"WaveExec: NoExec\r\nWaveBase: 220h\r\n"
            b"WaveIRQ: 7\r\nWaveDMA: 1\r\nWaveRate: 22050\r\n"
        )
        result = self.run_builder("--audio", "source-wave")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing", result.stderr.lower())
        self.assertFalse(self.bundle.exists())

    def test_guarded_source_wave_config_uses_existing_driver_and_crlf(self):
        (self.base / "LBA.CFG").write_bytes(
            b"; test fixture only\r\nWaveDriver: WAVESB.DLL\r\n"
            b"WaveExec: NoExec\r\nWaveBase: 220h\r\n"
            b"WaveIRQ: 7\r\nWaveDMA: 1\r\nWaveRate: 22050\r\n"
            b"MixerDriver: NoMixer\r\nMidiDriver: NoMidi\r\n"
        )
        (self.base / "WAVESB.DLL").write_bytes(b"synthetic non-working driver")
        result = self.run_builder("--audio", "source-wave")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("audio: source-wave", result.stdout)
        with zipfile.ZipFile(self.bundle) as archive:
            self.assertEqual(archive.read("WAVESB.DLL"), b"synthetic non-working driver")
            config = archive.read("LBA.CFG")
            self.assertIn(b"WaveDriver: WAVESB.DLL\r\n", config)
            self.assertIn(b"WaveBase: 220h\r\n", config)
            self.assertNotIn(b"\n", config.replace(b"\r\n", b""))
            self.assertIn(b"MidiDriver: NoMidi\r\n", config)

    def test_sb16_profile_works_with_originally_disabled_audio_if_local_driver_exists(self):
        (self.base / "LBA.CFG").write_bytes(b"WaveDriver: NoWave\r\n")
        (self.base / "W_SB16.DLL").write_bytes(b"synthetic sb16 driver" * 1024)
        result = self.run_builder("--audio", "sb16")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("audio: sb16", result.stdout)
        with zipfile.ZipFile(self.bundle) as archive:
            config = archive.read("LBA.CFG")
            self.assertIn(b"WaveDriver: W_SB16.DLL\r\n", config)
            self.assertNotIn(b"WaveDriver: NoWave", config)
            self.assertIn(b"MidiDriver: NoMidi\r\n", config)
            self.assertIn("W_SB16.DLL", archive.namelist())
            self.assertEqual(archive.read("W_SB16.DLL"), b"synthetic sb16 driver" * 1024)
        self.assertEqual((self.base / "LBA.CFG").read_bytes(), b"WaveDriver: NoWave\r\n")

    def test_sb16_profile_rejects_missing_or_truncated_original_driver(self):
        result = self.run_builder("--audio", "sb16")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("W_SB16.DLL", result.stderr)
        self.assertFalse(self.bundle.exists())
        (self.base / "W_SB16.DLL").write_bytes(b"too small")
        result = self.run_builder("--audio", "sb16")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unexpected size", result.stderr)
        self.assertFalse(self.bundle.exists())

    def test_audio_variants_keep_driver_format_and_mixer_changes_isolated(self):
        (self.base / "W_SB16.DLL").write_bytes(b"synthetic 16-bit" * 1024)
        (self.base / "W_SB16_8.DLL").write_bytes(b"synthetic 8-bit" * 1024)
        (self.base / "M_SB16.DLL").write_bytes(b"synthetic mixer" * 80)
        records = {}
        for profile in ("sb16", "sb16-8", "sb16-mixer", "sb16-mixer-loud"):
            result = self.run_builder("--audio", profile)
            self.assertEqual(result.returncode, 0, profile + ": " + result.stderr)
            with zipfile.ZipFile(self.bundle) as archive:
                records[profile] = archive.read("LBA.CFG")
                self.assertIn(
                    "W_SB16_8.DLL" if profile == "sb16-8" else "W_SB16.DLL",
                    archive.namelist(),
                )
                if profile in ("sb16-mixer", "sb16-mixer-loud"):
                    self.assertIn("M_SB16.DLL", archive.namelist())
        self.assertIn(b"WaveDriver: W_SB16_8.DLL\r\n", records["sb16-8"])
        self.assertIn(b"WaveDriver: W_SB16.DLL\r\n", records["sb16"])
        self.assertIn(b"MixerDriver: NoMixer\r\n", records["sb16"])
        self.assertIn(b"MixerDriver: NoMixer\r\n", records["sb16-8"])
        self.assertIn(b"MixerDriver: M_SB16.DLL\r\n", records["sb16-mixer"])
        self.assertEqual(
            records["sb16-mixer-loud"],
            records["sb16-mixer"].replace(
                b"WaveVolume: 163\r\n", b"WaveVolume: 240\r\n"
            ).replace(b"MasterVolume: 128\r\n", b"MasterVolume: 240\r\n")
        )

    def test_sb16_mono_and_original_fm_profiles_are_isolated(self):
        (self.base / "W_SB16_M.DLL").write_bytes(b"synthetic 16bit mono driver" * 1024)
        (self.base / "W_SB16_8.DLL").write_bytes(b"synthetic 8bit driver" * 1024)
        (self.base / "A32SBFM.DLL").write_bytes(b"synthetic Miles FM driver" * 1024)
        (self.base / "MIDI_SB.HQR").write_bytes(b"synthetic FM bank" * 1024)

        result = self.run_builder("--audio", "sb16-mono")
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.bundle) as archive:
            cfg = archive.read("LBA.CFG")
            self.assertIn(b"WaveDriver: W_SB16_M.DLL\r\n", cfg)
            self.assertIn(b"MidiDriver: NoMidi\r\n", cfg)
            self.assertIn(b"MixerDriver: NoMixer\r\n", cfg)

        result = self.run_builder("--audio", "sb16-8-fm")
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.bundle) as archive:
            cfg = archive.read("LBA.CFG")
            self.assertIn(b"WaveDriver: W_SB16_8.DLL\r\n", cfg)
            self.assertIn(b"MidiDriver: A32SBFM.DLL\r\n", cfg)
            self.assertIn(b"MidiBase: -1\r\n", cfg)
            self.assertIn(b"MidiIRQ: -1\r\n", cfg)
            self.assertIn(b"MidiDMA: -1\r\n", cfg)
            self.assertIn(b"MidiType: Fm\r\n", cfg)
            self.assertIn(b"MixerDriver: NoMixer\r\n", cfg)
            self.assertEqual(
                archive.read("A32SBFM.DLL"),
                (self.base / "A32SBFM.DLL").read_bytes()
            )
            self.assertEqual(
                archive.read("MIDI_SB.HQR"),
                (self.base / "MIDI_SB.HQR").read_bytes()
            )

    def test_fm_mode_refuses_missing_owner_midi_resources(self):
        (self.base / "W_SB16_8.DLL").write_bytes(b"synthetic 8bit driver" * 1024)
        result = self.run_builder("--audio", "sb16-8-fm")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("A32SBFM.DLL", result.stderr)
        (self.base / "A32SBFM.DLL").write_bytes(b"synthetic Miles FM driver" * 1024)
        result = self.run_builder("--audio", "sb16-8-fm")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("MIDI_SB.HQR", result.stderr)

    def test_audio_variant_requires_actual_owner_provided_mixer(self):
        (self.base / "W_SB16.DLL").write_bytes(b"synthetic 16-bit" * 1024)
        result = self.run_builder("--audio", "sb16-mixer")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("M_SB16.DLL", result.stderr)
        self.assertFalse(self.bundle.exists())

    def test_source_wave_rejects_unsupported_irq(self):
        (self.base / "LBA.CFG").write_bytes(
            b"WaveDriver: WAVESB.DLL\r\nWaveBase: 220h\r\n"
            b"WaveIRQ: 5\r\nWaveDMA: 1\r\nWaveRate: 22050\r\n"
        )
        (self.base / "WAVESB.DLL").write_bytes(b"synthetic non-working driver")
        result = self.run_builder("--audio", "source-wave")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("waveirq", result.stderr.lower())
        self.assertFalse(self.bundle.exists())

    def test_dos_input_source_remains_unchanged_in_source_wave_mode(self):
        (self.base / "LBA.CFG").write_bytes(b"WaveDriver: NoWave\r\n")
        original = (self.base / "LBA.CFG").read_bytes()
        result = self.run_builder("--audio", "source-wave")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.base / "LBA.CFG").read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
