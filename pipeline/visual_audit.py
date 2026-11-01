"""Source-derived sprite audit: measures actual pixels, never guesses artistic quality."""
from __future__ import annotations
import argparse, json, math
from pathlib import Path
from PIL import Image

def analyze_frame(frame:Image.Image)->dict:
    rgba=frame.convert("RGBA")
    a=rgba.getchannel("A")
    box=a.point(lambda v: 255 if v>=20 else 0).getbbox()
    if not box:raise ValueError("Rendered sprite has no visible geometry")
    levels=sorted(set(a.getdata()))
    colors=len({pixel[:3] for pixel in rgba.getdata() if pixel[3]>=20})
    w,h=rgba.size
    return dict(width=w,height=h,nonempty_bbox=list(box),
        occupied_width_ratio=round((box[2]-box[0])/w,4),
        occupied_height_ratio=round((box[3]-box[1])/h,4),
        alpha_levels=len(levels),binary_alpha=len(levels)<=2,
        rgb_colors=colors)
def analyze_atlas(path:Path,frame_width:int,frame_height:int)->dict:
    with Image.open(path) as image:
        if image.width%frame_width or image.height%frame_height:raise ValueError("Atlas grid does not divide image dimensions")
        frames=[]
        for row in range(image.height//frame_height):
            for col in range(image.width//frame_width):
                bounds=(col*frame_width,row*frame_height,(col+1)*frame_width,(row+1)*frame_height)
                frames.append(analyze_frame(image.crop(bounds)))
    return dict(source=str(path),frame_size=[frame_width,frame_height],frames=frames,
        all_alpha_binary=all(f["binary_alpha"] for f in frames))
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("atlas",type=Path)
    p.add_argument("--frame-width",type=int,required=True)
    p.add_argument("--frame-height",type=int,required=True)
    p.add_argument("--output",type=Path)
    a=p.parse_args()
    result=analyze_atlas(a.atlas,a.frame_width,a.frame_height)
    text=json.dumps(result,indent=2)+"\n"
    if a.output:
        a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(text)
    print(text,end="")
if __name__=="__main__":main()
