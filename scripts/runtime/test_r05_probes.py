"""Synthetic integration checks for the owner-local R05 probe orchestrator.

These tests never use or distribute original LBA1 assets. A passing test
means that packaging worked, not that sound or game-over works in DOS.
"""
from pathlib import Path
import importlib.util
import tempfile
import unittest
import zipfile

from test_private_jsdos import fixture_game

ROOT = Path(__file__).resolve().parents[2]
PROBE_PATH = ROOT / "scripts/runtime/run-r05-probes.py"
spec = importlib.util.spec_from_file_location("r05_probe", PROBE_PATH)
assert spec is not None and spec.loader is not None
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class ProbeTest(unittest.TestCase):
    def setUp(self):
        (ROOT / "output").mkdir(exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(prefix="r05-probe-test-", dir=ROOT / "output")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.base = self.root / "base"
        self.out = self.root / "probe"
        fixture_game(self.base)

    def test_minimal_scene_slot_structural_validation(self):
        save = bytearray(b"\x03Museum\x00" + bytes(0x1CA))
        save[len(b"\x03Museum\x00") + 0x100] = 0x2B
        item = probe.inspect_slot("S003.LBA", bytes(save))
        self.assertEqual(item["scene"], 43)
        bad = bytearray(save)
        bad[len(b"\x03Museum\x00") + 0x100] = 5
        with self.assertRaisesRegex(ValueError, "expected scene"):
            probe.inspect_slot("S003.LBA", bytes(bad))
        with self.assertRaisesRegex(ValueError, "Unexpected DOS slot"):
            probe.inspect_slot("S999.LBA", bytes(save))

    def test_silent_control_bundle_seven_saves_and_no_driver(self):
        original = (self.base / "RELENT.EXE").read_bytes()
        report = probe.execute(self.base, self.out)
        self.assertEqual(len(report["bundles"]), 1)
        self.assertEqual(report["bundles"][0]["audio"], "off")
        self.assertEqual(report["bundles"][0]["slotsVerified"], 7)
        self.assertEqual(report["wave"]["state"], "not built")
        self.assertEqual(report["sb16"]["state"], "not built")
        self.assertEqual(len(report["saves"]), 7)
        self.assertIn("gameOverResources", report)
        self.assertEqual(report["gameOverResources"]["game_over_model"]["state"], "invalid")
        self.assertEqual((self.base / "RELENT.EXE").read_bytes(), original)
        self.assertTrue((self.out / "report.json").is_file())
        with zipfile.ZipFile(self.out / "r05-silent.jsdos") as z:
            self.assertEqual(z.read("S003.LBA")[z.read("S003.LBA").index(b"\x00", 1) + 1 + 0x100], 43)
            self.assertIn(b"WaveDriver: NoWave", z.read("LBA.CFG"))
            self.assertNotIn("VOX.HQR", z.namelist())

    def test_explicit_source_wave_build_with_synthetic_driver(self):
        (self.base / "LBA.CFG").write_bytes(
            b"WaveDriver: WAVESB.DLL\r\nWaveExec: NoExec\r\n"
            b"WaveBase: 220h\r\nWaveIRQ: 7\r\n"
            b"WaveDMA: 1\r\nWaveRate: 22050\r\n"
        )
        (self.base / "WAVESB.DLL").write_bytes(b"synthetic test DLL - not executable")
        report = probe.execute(self.base, self.out)
        self.assertEqual([p["audio"] for p in report["bundles"]], ["off", "source-wave"])
        self.assertEqual(report["wave"]["state"], "packaged; audible SFX not verified")
        with zipfile.ZipFile(self.out / "r05-source-wave.jsdos") as z:
            self.assertEqual(z.read("WAVESB.DLL"), b"synthetic test DLL - not executable")
            self.assertIn(b"WaveDriver: WAVESB.DLL\r\n", z.read("LBA.CFG"))
        with zipfile.ZipFile(self.out / "r05-silent.jsdos") as z:
            self.assertIn(b"WaveDriver: NoWave", z.read("LBA.CFG"))

    def test_sb16_probe_is_generated_when_real_dos_driver_is_available_even_if_config_says_nowave(self):
        (self.base / "LBA.CFG").write_bytes(b"WaveDriver: NoWave\r\n")
        (self.base / "W_SB16.DLL").write_bytes(b"synthetic SB16 driver bytes" * 1024)
        report = probe.execute(self.base, self.out)
        self.assertEqual([p["audio"] for p in report["bundles"]], ["off", "sb16"])
        self.assertEqual(report["wave"]["state"], "not built")
        self.assertEqual(report["sb16"]["state"], "packaged; audible SFX not verified")
        with zipfile.ZipFile(self.out / "r05-sb16.jsdos") as archive:
            self.assertIn(b"WaveDriver: W_SB16.DLL\r\n", archive.read("LBA.CFG"))
            self.assertEqual(archive.read("W_SB16.DLL"), b"synthetic SB16 driver bytes" * 1024)
        with zipfile.ZipFile(self.out / "r05-silent.jsdos") as archive:
            self.assertIn(b"WaveDriver: NoWave\r\n", archive.read("LBA.CFG"))

    def test_comparison_matrix_has_separate_audio_bundles_and_stable_saves(self):
        (self.base / "LBA.CFG").write_bytes(b"WaveDriver: NoWave\r\n")
        (self.base / "W_SB16.DLL").write_bytes(b"synthetic 16-bit driver" * 1024)
        (self.base / "W_SB16_8.DLL").write_bytes(b"synthetic 8-bit driver" * 1024)
        (self.base / "M_SB16.DLL").write_bytes(b"synthetic mixer" * 80)
        (self.base / "W_SB16_M.DLL").write_bytes(b"synthetic mono driver" * 1024)
        (self.base / "A32SBFM.DLL").write_bytes(b"synthetic FM driver" * 1024)
        (self.base / "A32ALGFM.DLL").write_bytes(b"synthetic AdLib FM driver" * 1024)
        (self.base / "MIDI_SB.HQR").write_bytes(b"synthetic MIDI bank" * 1024)
        report = probe.execute(self.base, self.out)
        self.assertEqual(
            [p["audio"] for p in report["bundles"]],
            ["off", "sb16", "sb16-8", "sb16-mono", "sb16-8-fm", "sb16-8-adlib", "sb16-mixer", "sb16-mixer-loud"]
        )
        self.assertEqual(len(report["saves"]), 7)
        for item in report["bundles"]:
            self.assertEqual(item["slotsVerified"], 7)
        for profile in ("sb16-8", "sb16-mono", "sb16-8-fm", "sb16-8-adlib", "sb16-mixer", "sb16-mixer-loud"):
            self.assertEqual(
                report["audioVariants"][profile]["state"],
                "packaged; audible SFX not verified"
            )
        with zipfile.ZipFile(self.out / "r05-sb16-8.jsdos") as z:
            self.assertIn(b"WaveDriver: W_SB16_8.DLL\r\n", z.read("LBA.CFG"))
            self.assertIn(b"MixerDriver: NoMixer\r\n", z.read("LBA.CFG"))
        with zipfile.ZipFile(self.out / "r05-sb16-mono.jsdos") as z:
            self.assertIn(b"WaveDriver: W_SB16_M.DLL\r\n", z.read("LBA.CFG"))
            self.assertIn(b"MixerDriver: NoMixer\r\n", z.read("LBA.CFG"))
        with zipfile.ZipFile(self.out / "r05-sb16-8-fm.jsdos") as z:
            self.assertIn(b"WaveDriver: W_SB16_8.DLL\r\n", z.read("LBA.CFG"))
            self.assertIn(b"MidiDriver: A32SBFM.DLL\r\n", z.read("LBA.CFG"))
            self.assertIn(b"MixerDriver: NoMixer\r\n", z.read("LBA.CFG"))
        with zipfile.ZipFile(self.out / "r05-sb16-8-adlib.jsdos") as z:
            cfg = z.read("LBA.CFG")
            self.assertIn(b"WaveDriver: W_SB16_8.DLL\r\n", cfg)
            self.assertIn(b"MidiDriver: A32ALGFM.DLL\r\n", cfg)
            self.assertIn(b"MidiBase: 388h\r\n", cfg)
            self.assertIn(b"MixerDriver: NoMixer\r\n", cfg)
        with zipfile.ZipFile(self.out / "r05-sb16-mixer.jsdos") as z:
            self.assertIn(b"MixerDriver: M_SB16.DLL\r\n", z.read("LBA.CFG"))
            self.assertIn(b"WaveVolume: 163\r\n", z.read("LBA.CFG"))
        with zipfile.ZipFile(self.out / "r05-sb16-mixer-loud.jsdos") as z:
            self.assertIn(b"MixerDriver: M_SB16.DLL\r\n", z.read("LBA.CFG"))
            self.assertIn(b"WaveVolume: 240\r\n", z.read("LBA.CFG"))
            self.assertIn(b"MasterVolume: 240\r\n", z.read("LBA.CFG"))

    def test_refuses_public_output_path(self):
        with self.assertRaisesRegex(ValueError, "ignored output"):
            probe.execute(self.base, ROOT / "web_deploy/r05-probes")

    def test_refuses_polluted_control_mod_directory(self):
        (self.out / "empty-mods").mkdir(parents=True)
        (self.out / "empty-mods" / "SCENE.HQR").write_bytes(b"synthetic")
        with self.assertRaisesRegex(ValueError, "must remain empty"):
            probe.execute(self.base, self.out)


if __name__ == "__main__":
    unittest.main()
