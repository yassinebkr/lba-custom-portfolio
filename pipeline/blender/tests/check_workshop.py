"""V7 validates actually rendered original-workshop PNGs and scene placement."""
from __future__ import annotations
import json,struct,sys
from pathlib import Path
from PIL import Image

def verify(root:Path)->dict:
 root=root.resolve()
 layout=json.loads((root/"layout.json").read_text())
 assert layout["schemaVersion"]==1
 assert layout["source"]=="original-v7-blender-workshop"
 assert layout["approvedForPortfolio"] is False
 assert layout["reviewStatus"]=="pending-artistic-review"
 assert layout["depthLayers"]==["background.png","radio sprite from V5","foreground.png"]
 assert layout["width"]==960 and layout["height"]==640
 x,y=layout["anchor"];assert 160<x<800 and 110<y<600
 stats={}
 for name in ("background.png","foreground.png"):
  with Image.open(root/name) as png:
   png.verify()
  with Image.open(root/name) as png:
   assert png.size==(960,640) and png.mode=="RGBA"
   alpha=png.getchannel("A")
   box=alpha.point(lambda n:255 if n>=30 else 0).getbbox()
   assert box is not None
   values=set(alpha.getdata())
   assert any(0<v<255 for v in values),"Antialiasing lost in "+name
   stats[name]={"bbox":list(box),"alphaLevels":len(values)}
 # Occluder should be a small overlay, not the entire room.
 assert stats["foreground.png"]["bbox"][2]-stats["foreground.png"]["bbox"][0]<700
 assert stats["foreground.png"]["bbox"][3]-stats["foreground.png"]["bbox"][1]<250
 print(json.dumps({"status":"V7 original renders passed","anchor":layout["anchor"],"stats":stats},indent=2))
 return stats

if __name__=="__main__":verify(Path(sys.argv[1]))
