#!/usr/bin/env python3
"""M3/M5: Convert the Blender directional render manifest into asset_batch's recipe.

Never approves artwork; a creator must inspect final PNGs and rights first.
Example:
 python pipeline/original_recipe.py renders/animation.json --id camera \
   --kind prop --creator "project-owner" --project electronics
 python pipeline/asset_batch.py renders/recipe.json --out /tmp/art-atlases
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

KINDS={"character","furniture","prop","structure"}
DIRECTIONS={"ne","nw","sw","se"}
def make_recipe(animation_path:Path,asset_id:str,kind:str,creator:str,project:str,
                width:int=96,height:int=112,colors:int=64)->dict:
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,63}",asset_id):
        raise ValueError("Invalid original asset ID")
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,63}",project):
        raise ValueError("Invalid project slug")
    if kind not in KINDS or not creator.strip():
        raise ValueError("Valid asset kind and creator required")
    if not (32<=width<=256 and 32<=height<=256 and 8<=colors<=256):
        raise ValueError("Unsupported frame dimensions or palette")
    original=animation_path.resolve()
    m=json.loads(original.read_text(encoding="utf-8"))
    if m.get("schemaVersion")!=1 or not m.get("clip") or not isinstance(m.get("directions"),dict):
        raise ValueError("Expected Blender direction manifest v1")
    frames=[]
    for direction,entries in m["directions"].items():
        if direction not in DIRECTIONS or not isinstance(entries,list):
            raise ValueError("Unexpected rendered direction")
        for entry in entries:
            path=entry.get("path")
            if not isinstance(path,str) or "\\" in path:
                raise ValueError("Invalid original source path")
            candidate=(original.parent/path).resolve()
            if not candidate.is_relative_to(original.parent) or not candidate.is_file():
                raise ValueError("Missing original rendered frame: "+str(path))
            duration=entry.get("durationMs")
            if type(duration) is not int or not 16<=duration<=60000:
                raise ValueError("Invalid animation duration")
            frames.append({"path":path,"action":m["clip"],"direction":direction.upper(),"durationMs":duration})
    if not frames or len(frames)>64:
        raise ValueError("Expected 1..64 actual rendered frames")
    return {
        "schemaVersion":1,"project":project,
        "style":{"width":width,"height":height,"colors":colors,"padding":4},
        "assets":[{
            "id":asset_id,"kind":kind,
            "source":{"origin":"original-model","creator":creator.strip(),
              "license":"original","sourceUrl":None,"attribution":None,
              "reviewStatus":"pending","allowedForPublicBuild":False},
            "frames":frames
        }]
    }

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest",type=Path)
    p.add_argument("--id",required=True)
    p.add_argument("--kind",required=True,choices=sorted(KINDS))
    p.add_argument("--creator",required=True)
    p.add_argument("--project",default="original-workshop")
    p.add_argument("--width",type=int,default=96)
    p.add_argument("--height",type=int,default=112)
    p.add_argument("--colors",type=int,default=64)
    p.add_argument("--output",type=Path,default=None)
    a=p.parse_args()
    result=make_recipe(a.manifest,a.id,a.kind,a.creator,a.project,a.width,a.height,a.colors)
    output=a.output or a.manifest.parent/"recipe.json"
    # A recipe next to rendered animation JSON preserves all relative PNG paths.
    if output.resolve().parent!=a.manifest.resolve().parent:
        p.error("Recipe must reside beside source animation.json so frames resolve safely")
    output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Original Blender recipe created; art approval remains PENDING:",output)
if __name__=="__main__":
    main()
