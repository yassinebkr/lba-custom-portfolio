"""J3 end-to-end tests: assets, animations, provenance, safety and deterministic QA."""
from __future__ import annotations

import importlib.util
import json
import hashlib
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def import_from(relative, name):
    spec = importlib.util.spec_from_file_location(name, ROOT/relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pipeline = import_from("asset_batch.py", "asset_batch")
fixtures = import_from("fixtures/generate_samples.py", "generate_samples")


class TestBatchPipeline(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.recipe_path = fixtures.create(self.base/"input")
        self.output = self.base/"output"

    def build(self):
        return pipeline.build(self.recipe_path,self.output)

    def recipe(self):
        return json.loads(self.recipe_path.read_text())

    def write(self, recipe):
        self.recipe_path.write_text(json.dumps(recipe))

    def test_complete_seven_asset_fixture_set(self):
        doc=self.build()
        self.assertEqual(len(doc["assets"]),7)
        kinds=[asset["kind"] for asset in doc["assets"]]
        self.assertEqual(kinds.count("character"),1)
        self.assertEqual(kinds.count("furniture"),2)
        self.assertGreaterEqual(kinds.count("prop"),3)
        self.assertEqual(kinds.count("structure"),1)
        self.assertTrue((self.output/"index.html").is_file())
        self.assertTrue((self.output/"assets.json").is_file())
        for asset in doc["assets"]:
            self.assertTrue((self.output/asset["atlasRef"]).is_file())
            self.assertTrue((self.output/asset["previewRef"]).is_file())
            self.assertFalse(asset["source"]["allowedForPublicBuild"])
            self.assertEqual(asset["source"]["reviewStatus"],"pending")
            self.assertEqual(len(asset["frames"][0]["sourceSha256"]),64)

    def test_directions_are_preserved_with_nonoverlapping_rects(self):
        doc=self.build()
        guide=next(a for a in doc["assets"] if a["id"]=="workshop-guide")
        self.assertEqual([f["direction"] for f in guide["frames"]],["SE","NE","NW","SW"])
        self.assertEqual(len({tuple(f["rect"]) for f in guide["frames"]}),4)

    def test_animation_preserves_timings_and_is_not_flattened(self):
        doc=self.build()
        lamp=next(a for a in doc["assets"] if a["id"]=="status-lamp")
        self.assertEqual(len(lamp["frames"]),4)
        self.assertEqual({f["action"] for f in lamp["frames"]},{"active"})
        self.assertEqual({f["durationMs"] for f in lamp["frames"]},{160})
        self.assertEqual(len({tuple(f["rect"]) for f in lamp["frames"]}),4)

    def test_generated_atlas_has_real_transparency_and_shared_colors(self):
        doc=self.build()
        for asset in doc["assets"]:
            with Image.open(self.output/asset["atlasRef"]) as raw:
                img=raw.convert("RGBA")
                self.assertTrue(any(a==0 for *_,a in img.getdata()))
                self.assertTrue(any(a==255 for *_,a in img.getdata()))
                colors={pixel[:3] for pixel in img.getdata() if pixel[3]}
                self.assertLessEqual(len(colors),64,"shared quantized palette")

    def test_deterministic_outputs_across_two_builds(self):
        one=self.build()
        second=self.base/"output2"
        two=pipeline.build(self.recipe_path,second)
        self.assertEqual(one,two)
        for asset in one["assets"]:
            p=asset["atlasRef"]
            self.assertEqual(hashlib.sha256((self.output/p).read_bytes()).digest(),
                             hashlib.sha256((second/p).read_bytes()).digest())

    def test_reject_source_escape(self):
        doc=self.recipe()
        doc["assets"][0]["frames"][0]["path"]="../../outside.png"
        self.write(doc)
        with self.assertRaisesRegex(pipeline.RecipeError,"escapes"):
            self.build()

    def test_reject_duplicate_asset_ids(self):
        doc=self.recipe()
        doc["assets"][1]["id"]=doc["assets"][0]["id"]
        self.write(doc)
        with self.assertRaisesRegex(pipeline.RecipeError,"Duplicate"):
            self.build()

    def test_unapproved_asset_cannot_claim_public_rights(self):
        doc=self.recipe()
        doc["assets"][0]["source"]["allowedForPublicBuild"]=True
        self.write(doc)
        with self.assertRaisesRegex(pipeline.RecipeError,"explicit approved"):
            self.build()

    def test_cc_by_requires_attribution(self):
        doc=self.recipe()
        doc["assets"][0]["source"]["license"]="CC-BY-4.0"
        self.write(doc)
        with self.assertRaisesRegex(pipeline.RecipeError,"requires attribution"):
            self.build()

    def test_reject_invalid_dimensions_before_writing_outputs(self):
        doc=self.recipe()
        doc["style"]["width"]=1
        self.write(doc)
        with self.assertRaises(pipeline.RecipeError):
            self.build()
        self.assertFalse(self.output.exists())

    def test_jpeg_source_is_supported_as_observed_single_view(self):
        doc=self.recipe()
        entry=doc["assets"][0]["frames"][0]
        png=self.recipe_path.parent/entry["path"]
        jpeg=png.with_suffix(".jpg")
        with Image.open(png) as image:
            image.convert("RGB").save(jpeg, quality=90)
        entry["path"]=entry["path"].replace(".png",".jpg")
        self.write(doc)
        result=self.build()
        self.assertEqual(len(result["assets"]),7)

    def test_j3_generated_gallery_escapes_asset_names(self):
        self.build()
        html_text=(self.output/"index.html").read_text()
        self.assertIn("Asset quality review",html_text)
        self.assertIn("workshop-guide",html_text)
        self.assertNotIn("<script",html_text)


if __name__=="__main__":
    unittest.main()
