import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("original_recipe",Path(__file__).resolve().parents[1]/"original_recipe.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class TestRecipeAdapter(unittest.TestCase):
    def test_four_angles_and_frames_are_in_a_real_recipe(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            directions={}
            for direction in ("ne","nw","sw","se"):
                path=root/direction/(direction+".png")
                path.parent.mkdir(parents=True)
                path.write_bytes(b"PNG fixture placeholder")
                directions[direction]=[{"path":direction+"/"+direction+".png","durationMs":150}]
            manifest=root/"animation.json"
            manifest.write_text(json.dumps({"schemaVersion":1,"clip":"idle","directions":directions}))
            recipe=m.make_recipe(manifest,"bench","furniture","owner","original-shop")
            asset=recipe["assets"][0]
            self.assertEqual(len(asset["frames"]),4)
            self.assertEqual({f["direction"] for f in asset["frames"]},{"NE","NW","SW","SE"})
            self.assertFalse(asset["source"]["allowedForPublicBuild"])
            self.assertEqual(asset["source"]["reviewStatus"],"pending")

    def test_missing_frame_and_path_traversal_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            manifest=root/"animation.json"
            for path in ("missing.png","../external.png"):
                manifest.write_text(json.dumps({"schemaVersion":1,"clip":"idle","directions":{"ne":[{"path":path,"durationMs":120}]}}))
                with self.assertRaises(ValueError):
                    m.make_recipe(manifest,"bench","furniture","author","original-shop")
if __name__=="__main__":
    unittest.main()
