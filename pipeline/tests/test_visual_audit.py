import unittest,sys
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from visual_audit import analyze_frame,analyze_atlas
from tempfile import TemporaryDirectory
class TestVisualAudit(unittest.TestCase):
 def test_bounding_box_and_binary_alpha(self):
  im=Image.new("RGBA",(10,10),(0,0,0,0))
  im.putpixel((2,3),(120,20,30,255))
  r=analyze_frame(im)
  self.assertEqual(r["nonempty_bbox"],[2,3,3,4])
  self.assertTrue(r["binary_alpha"])
  self.assertEqual(r["rgb_colors"],1)
 def test_preserved_alpha_is_detected(self):
  im=Image.new("RGBA",(4,4),(0,0,0,0))
  im.putpixel((2,2),(220,200,100,128));im.putpixel((1,1),(5,6,7,255))
  self.assertFalse(analyze_frame(im)["binary_alpha"])
 def test_atlas_grid_rejects_bad_dimensions(self):
  with TemporaryDirectory() as d:
   path=Path(d)/"sprite.png"
   Image.new("RGBA",(7,4),(255,0,0,255)).save(path)
   with self.assertRaises(ValueError):analyze_atlas(path,4,4)
 def test_transparent_image_fails(self):
  with self.assertRaises(ValueError):analyze_frame(Image.new("RGBA",(8,8)))
if __name__=="__main__":unittest.main()
