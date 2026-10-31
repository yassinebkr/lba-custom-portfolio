"""Run: python -m unittest discover -s pipeline/tests -v"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from PIL import Image

FILE = Path(__file__).resolve().parents[1] / "asset_factory.py"
spec = importlib.util.spec_from_file_location("asset_factory", FILE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class TestAssetFactory(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / "original.png"
        img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        for y in range(20, 115):
            for x in range(40, 90):
                img.putpixel((x, y), (100, 200, 170, 255))
        img.save(self.source)

    def test_size_checks(self):
        self.assertEqual(mod.safe_size("64x80"), (64, 80))
        for invalid in ("64", "0x64", "9999x12", "64x0", "-1x64"):
            with self.assertRaises(ValueError):
                mod.safe_size(invalid)

    def test_rgb_background(self):
        self.assertEqual(mod.color("#ff0033"), (255, 0, 51))
        with self.assertRaises(ValueError):
            mod.color("white")

    def test_source_photo_build_transparency(self):
        atlas = mod.build_atlas([self.source], (64, 64), 32, None, 0)
        self.assertEqual(atlas.size, (64, 64))
        self.assertEqual(atlas.getpixel((0, 0))[3], 0)
        self.assertGreater(atlas.getpixel((32, 30))[3], 0)

    def test_multiple_frames_use_one_atlas(self):
        atlas = mod.build_atlas([self.source, self.source], (48, 48), 16, None, 0)
        self.assertEqual(atlas.size, (96, 48))

    def test_reject_blank_source(self):
        blank = self.root / "blank.png"
        Image.new("RGBA", (24, 24), (0, 0, 0, 0)).save(blank)
        with self.assertRaises(ValueError):
            mod.build_atlas([blank], (64, 64), 32, None, 0)

    def test_reject_too_many_frames(self):
        with self.assertRaises(ValueError):
            mod.build_atlas([self.source]*121, (32, 32), 32, None, 0)

    def test_manifest_defaults_to_not_approved(self):
        args=SimpleNamespace(id="original-camera",name=None,kind="prop",creator="author",
            origin="original-photo",license="original",source_url=None,attribution=None,
            approve=False,duration_ms=150,method="photo-2d",direction="se",colors=64)
        m=mod.build_manifest(args,[self.source],(64,64))
        self.assertFalse(m["source"]["allowedForPublicBuild"])
        self.assertEqual(m["source"]["reviewStatus"],"pending")
        self.assertEqual(len(m["animation"]["frames"][0]["sourceSha256"]),64)

    def test_cli_export(self):
        out=self.root/"export"
        rc=mod.main(["--input",str(self.source),"--out",str(out),
                     "--id","test-prop","--kind","prop","--creator","author"])
        self.assertEqual(rc,0)
        self.assertTrue((out/"test-prop.png").is_file())
        manifest=json.loads((out/"test-prop.json").read_text())
        self.assertEqual(manifest["id"],"test-prop")
        self.assertFalse(manifest["source"]["allowedForPublicBuild"])


if __name__ == "__main__":
    unittest.main()
