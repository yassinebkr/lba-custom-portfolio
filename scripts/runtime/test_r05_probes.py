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
