"""Synthetic only: separate checkpoint respawn from terminal Game Over in R05."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("r05_death_probe", ROOT / "scripts/runtime/prepare-death-probe.py")
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


def dos_save(clovers=2, title=b"Museum") -> bytes:
    data = bytearray(1 + len(title) + 1 + 0x1CA)
    data[0] = 3
    data[1:1 + len(title)] = title
    data[1 + len(title)] = 0
    data[2 + len(title) + 0x1C7] = clovers
    return bytes(data)


class DeathProbeTest(unittest.TestCase):
    def setUp(self):
        (ROOT / "output").mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="r05-death-", dir=ROOT / "output")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "r05-v8-english-voices-16bit.jsdos"
        self.output = self.root / "r05-v8-gameover-no-clovers.jsdos"
        self.original_save = dos_save()
        self.files = {
            "S003.LBA": self.original_save,
            "RELENT.EXE": b"synthetic binary",
            "LBA.CFG": b"WaveDriver: W_SB16.DLL\r\nMixerDriver: NoMixer\r\n",
            ".jsdos/dosbox.conf": b"[sblaster]\r\nsbtype=sb16\r\n[autoexec]\r\nRELENT.EXE\r\n",
            "RESS.HQR": b"synthetic resource",
            "SAMPLES.HQR": b"synthetic samples",
            "VOX/EN_SYS.VOX": b"synthetic voice",
        }
        with ZipFile(self.source, "w", ZIP_DEFLATED) as z:
            for filename, data in self.files.items():
                z.writestr(filename, data)

    def test_byte_precise_zero_clover_modification_only(self):
        result = probe.make(self.source, self.output, clovers=0)
        self.assertEqual(result["originalClovers"], 2)
        self.assertEqual(result["probeClovers"], 0)
        self.assertEqual(result["modifiedBytes"], 1)
        offset = result["absoluteByteOffset"]
        with ZipFile(self.output) as z:
            modified = z.read("S003.LBA")
            self.assertEqual(modified[offset], 0)
            self.assertEqual(modified[:offset], self.original_save[:offset])
            self.assertEqual(modified[offset + 1:], self.original_save[offset + 1:])
            for filename in self.files:
                if filename != "S003.LBA":
                    self.assertEqual(z.read(filename), self.files[filename])
        with ZipFile(self.source) as z:
            self.assertEqual(z.read("S003.LBA"), self.original_save)

    def test_control_with_two_clovers_remains_identical(self):
        result = probe.make(self.source, self.output, clovers=2)
        self.assertEqual(result["modifiedBytes"], 0)
        with ZipFile(self.output) as z:
            self.assertEqual(z.read("S003.LBA"), self.original_save)

    def test_rejects_unknown_save_format_and_clover_state(self):
        for invalid in (b"bad", dos_save(1), dos_save(title=b"") ,dos_save(title=b"A" * 65)):
            with self.assertRaises(ValueError):
                probe.set_clovers(invalid, 0)
        with self.assertRaises(ValueError):
            probe.set_clovers(self.original_save, 3)

    def test_does_not_write_outside_private_output(self):
        with self.assertRaisesRegex(ValueError, "gitignored"):
            probe.make(self.source, ROOT / "web_deploy/lba-gameover.jsdos")
        self.assertFalse((ROOT / "web_deploy/lba-gameover.jsdos").exists())

    def test_rejects_mismatched_wave_driver(self):
        self.files["LBA.CFG"] = b"WaveDriver: W_SB16_8.DLL\r\n"
        with ZipFile(self.source, "w", ZIP_DEFLATED) as z:
            for filename, data in self.files.items():
                z.writestr(filename, data)
        with self.assertRaisesRegex(ValueError, "16-bit"):
            probe.make(self.source, self.output)


if __name__ == "__main__":
    unittest.main()
