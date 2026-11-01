import json,sys,tempfile,unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from visual_matrix import matrix,limited_palette,DIRECTIONS

class TestVisualMatrix(unittest.TestCase):
 def fixture(self,root):
  directions={}
  for d in DIRECTIONS:
   (root/d).mkdir(parents=True)
   img=Image.new("RGBA",(64,64))
   for y in range(4,60):
    for x in range(4,60):
     img.putpixel((x,y),(x*3%256,y*4%256,100,128 if x in (4,59) else 255))
   img.save(root/d/"idle.png")
   directions[d]=[{"path":d+"/idle.png","durationMs":150}]
  path=root/"animation.json"
  path.write_text(json.dumps({"schemaVersion":1,"directions":directions}))
  return path
 def test_24_options_and_lossless_alpha(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);m=self.fixture(root)
   result=matrix(m,root/"out",sizes=(32,48,64))
   self.assertEqual(len(result["candidates"]),24)
   self.assertEqual(len(result["sharedCrop"]),4)
   self.assertEqual(result["inputFrameSize"],[64,64])
   self.assertTrue(all(item["fractional_alpha"] for item in result["candidates"]))
   self.assertTrue(all(item["alpha_levels"]>2 for item in result["candidates"]))
   self.assertTrue(all(x["dark_rmse"]==0 for x in result["candidates"] if x["palette"]=="truecolor"))
   self.assertEqual(len(result["candidates"][0]["per_direction_bbox"]),4)
 def test_alpha_never_becomes_binary(self):
  image=Image.new("RGBA",(5,5))
  image.putpixel((2,2),(20,200,40,128))
  image.putpixel((3,2),(200,20,60,255))
  out=limited_palette(image,8)
  self.assertEqual(out.getpixel((2,2))[3],128)
 def test_source_path_traversal_denied(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);src=self.fixture(root)
   doc=json.loads(src.read_text());doc["directions"]["ne"][0]["path"]="../private.png"
   src.write_text(json.dumps(doc))
   with self.assertRaises(ValueError):matrix(src,root/"out")
if __name__=="__main__":unittest.main()
