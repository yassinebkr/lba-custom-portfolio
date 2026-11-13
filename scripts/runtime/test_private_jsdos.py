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

    def run_builder(self):
        return subprocess.run(
            [sys.executable, str(BUILDER), "--base", str(self.base),
             "--mods", str(self.mods), "--out", str(self.bundle)],
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
            exe = archive.read("RELENT.EXE")
            self.assertEqual(exe[0x10AF1:0x10AF3], bytes.fromhex("eb 0f"))
            self.assertEqual(exe[0x0F83F:0x0F84C], b"\x90" * 13)
            iso = archive.read("LBA.ISO")
            self.assertEqual(iso[16 * 2048 + 1:16 * 2048 + 6], b"CD001")
            self.assertEqual(iso[16 * 2048 + 40:16 * 2048 + 72].rstrip(), b"ADELINE")
            self.assertIsNone(archive.testzip())
        self.assertIn("real-DOS-boot-pending", result.stdout)

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


if __name__ == "__main__":
    unittest.main()
