"""First complete *local* original-room pipeline, not public art approval."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


class TestWorkshopPreviewSources(unittest.TestCase):
    def test_existing_fixtures_and_blender_sources_form_animated_original_atlases(self):
        with tempfile.TemporaryDirectory(prefix="workshop-preview-") as temp:
            root = Path(temp)
            sources = root / "sources"
            out = root / "atlas"
            result = subprocess.run(
                [sys.executable, "pipeline/fixtures/generate_workshop.py",
                 "--out", str(sources)],
                cwd=ROOT, capture_output=True, text=True, check=True
            )
            self.assertIn("Original workshop source recipe", result.stdout)
            spec = json.loads((sources / "recipe.json").read_text())
            self.assertEqual(len(spec["assets"]), 8)
            self.assertEqual(spec["style"]["colors"], "truecolor")
            self.assertEqual(spec["style"]["fixedCropPx"], [0, 0, 256, 256])
            guide = next(a for a in spec["assets"] if a["id"] == "workshop-guide")
            self.assertEqual(len(guide["frames"]), 20)
            for direction in ("NE", "NW", "SE", "SW"):
                walk = [f for f in guide["frames"]
                        if f["direction"] == direction and f["action"] == "walk"]
                self.assertEqual(len(walk), 4)
                # The user sees actual different authored poses, not frame delay
                # applied to one static sprite.
                with Image.open(sources / walk[0]["path"]) as first, \
                     Image.open(sources / walk[2]["path"]) as last:
                    self.assertNotEqual(first.tobytes(), last.tobytes())
            proc = subprocess.run(
                [sys.executable, "pipeline/asset_batch.py",
                 str(sources / "recipe.json"), "--out", str(out)],
                cwd=ROOT, capture_output=True, text=True, check=True
            )
            self.assertIn("Prepared 8 assets", proc.stdout)
            data = json.loads((out / "assets.json").read_text())
            self.assertEqual(len(data["assets"]), 8)
            self.assertTrue(all(not a["source"]["allowedForPublicBuild"]
                                for a in data["assets"]))
            with Image.open(out / "atlases" / "workshop-guide.png") as sprite:
                self.assertEqual(sprite.size, (8*112, 3*112))
                self.assertEqual(sprite.mode, "RGBA")
            with Image.open(out / "atlases" / "telemetry-receiver.png") as sprite:
                self.assertEqual(sprite.size, (4*112, 112))
                self.assertEqual(sprite.mode, "RGBA")
                self.assertIsNotNone(sprite.getbbox())
            with Image.open(out / "atlases" / "status-lamp.png") as lamp:
                self.assertEqual(lamp.size, (4*112, 112))
            self.assertTrue((out / "index.html").is_file())

    def test_authored_scene_requires_original_objects_and_not_approved(self):
        room = json.loads(
            (ROOT / "examples" / "workshop" / "scene.json").read_text()
        )
        self.assertEqual(room["id"], "showroom")
        self.assertEqual(room["playerAssetId"], "workshop-guide")
        self.assertEqual(len(room["instances"]), 8)
        self.assertEqual(len({x["id"] for x in room["instances"]}), 8)
        self.assertEqual(
            {x["id"] for x in room["instances"]} &
            {"cinepi", "lora", "bigbrain", "shellfolio"},
            {"cinepi", "lora", "bigbrain", "shellfolio"}
        )
        self.assertEqual(room["metadata"]["reviewStatus"],
                         "pending-artistic-review")


if __name__ == "__main__":
    unittest.main()
