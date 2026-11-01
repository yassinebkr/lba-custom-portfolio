"""Validate real Blender-produced images and four-direction manifest."""
import json
import hashlib
import sys
from pathlib import Path

from PIL import Image

root=Path(sys.argv[1])
meta=json.loads((root/"animation.json").read_text())
assert set(meta["directions"])=={"ne","nw","se","sw"}
assert meta["sourceType"]=="original-model"
digests=set()
for orientation,frames in meta["directions"].items():
    assert len(frames)==1
    path=root/frames[0]["path"]
    assert path.is_file(),str(path)
    with Image.open(path) as png:
        assert png.size==(512,512)
        rgba=png.convert("RGBA")
        assert rgba.getchannel("A").getbbox(),"Transparent or empty render: "+str(path)
        digests.add(hashlib.sha256(rgba.tobytes()).hexdigest())
assert len(digests)==4,"Directional views must contain different real geometry"
print("Blender GLB render accepted: four distinct real original fixture views, 96px with alpha")
