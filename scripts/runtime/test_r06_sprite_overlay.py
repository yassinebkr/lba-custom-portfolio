"""No commercial game bytes: fail-closed private js-dos 8 sprite ZIP overlay tests."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[2]


def load(path: str):
    spec = importlib.util.spec_from_file_location(
        "private_r06_zip", ROOT / "scripts/runtime" / path
    )
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


probe = load("overlay-r05-v8-sprite.py")
conversion = load("prepare-jsdos8-bundle.py")


class FirstMuseumSpriteTest(unittest.TestCase):
    def setUp(self):
        (ROOT / "output").mkdir(exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(prefix="r06-sprite-", dir=ROOT / "output")
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        self.source = self.home / "r05-v8-english-voices-16bit.jsdos"
        self.destination = self.home / "r05-v8-museum-sprite58.jsdos"
        self.patch = self.home / "sprite58"
        self.patch.mkdir()
        exe = bytearray(0x12000)
        for off, signature in conversion.BOOT_PATCHES.items():
            exe[off:off + len(signature)] = signature
        self.entries = {
            ".jsdos/dosbox.conf": b"[dosbox]\r\nmemsize=16\r\n[autoexec]\r\nRELENT.EXE\r\n",
            "LBA.CFG": b"WaveDriver: W_SB16.DLL\r\nFlagKeepVoice: ON\r\n",
            "RELENT.EXE": bytes(exe),
            "S003.LBA": b"museum synthetic save",
            "SPRITES.HQR": b"mock-original-sprite-archive",
            "RESS.HQR": b"fake resource bytes",
            "LBA.ISO": b"fake ISO not a real game",
            "VOX/EN_GAM.VOX": b"fake voice bytes",
        }
        with ZipFile(self.source, "w", compression=ZIP_DEFLATED) as z:
            for name, data in self.entries.items():
                z.writestr(name, data)
        modified = b"mock-overlay-sprite-HQR-58"
        (self.patch / "SPRITES.HQR").write_bytes(modified)
        report = {
            "scene": {"sceneIndex": 43, "entryIndex": 58, "sharedScenes": [1, 43]},
            "originalArchiveSHA256": hashlib.sha256(self.entries["SPRITES.HQR"]).hexdigest(),
            "privateOverlaySHA256": hashlib.sha256(modified).hexdigest(),
        }
        (self.patch / "report.json").write_text(json.dumps(report))

    def test_exactly_one_zip_entry_is_changed_without_touching_audio_or_guest(self):
        report = probe.overlay(self.source, self.patch, self.destination)
        self.assertEqual(report["modifiedZipEntries"], ["SPRITES.HQR"])
        self.assertEqual(report["preservedZipEntries"], len(self.entries)-1)
        with ZipFile(self.destination) as z:
            self.assertEqual(z.namelist(), list(self.entries))
            self.assertEqual(z.read("SPRITES.HQR"), (self.patch/"SPRITES.HQR").read_bytes())
            for name, data in self.entries.items():
                if name != "SPRITES.HQR":
                    self.assertEqual(z.read(name), data)
        with ZipFile(self.source) as z:
            self.assertEqual(z.read("SPRITES.HQR"), self.entries["SPRITES.HQR"])

    def test_refuses_different_baseline_and_leaves_the_zip_untouched(self):
        report = json.loads((self.patch/"report.json").read_text())
        report["originalArchiveSHA256"] = "0" * 64
        (self.patch/"report.json").write_text(json.dumps(report))
        with self.assertRaisesRegex(ValueError, "source archive differs"):
            probe.overlay(self.source,self.patch,self.destination)
        self.assertFalse(self.destination.exists())

    def test_refuses_overwriting_the_working_reference(self):
        with self.assertRaisesRegex(ValueError, "NEW private output"):
            probe.overlay(self.source,self.patch,self.source)
        self.assertTrue(self.source.exists())

    def test_missing_historical_fla_patch_refused(self):
        mutated=bytearray(self.entries["RELENT.EXE"])
        mutated[0x0F83F]=0x68
        self.entries["RELENT.EXE"]=bytes(mutated)
        with ZipFile(self.source, "w", compression=ZIP_DEFLATED) as z:
            for name,data in self.entries.items():
                z.writestr(name,data)
        with self.assertRaisesRegex(ValueError, "missing historical"):
            probe.overlay(self.source,self.patch,self.destination)

    def test_public_output_forbidden(self):
        with self.assertRaisesRegex(ValueError, "ignored output"):
            probe.overlay(self.source,self.patch,ROOT/"web_deploy"/"public.jsdos")


if __name__=="__main__":
    unittest.main()
