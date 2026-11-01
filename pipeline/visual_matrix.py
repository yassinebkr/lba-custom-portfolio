#!/usr/bin/env python3
"""V5 non-destructive comparison: real source PNG -> 24 sprite atlas variants.

Preserves fractional alpha and Blender's common camera framing. Nothing here
approves or publishes imagery. Pillow only, deterministic output.
"""
from __future__ import annotations
import argparse, hashlib, html, json, math
from pathlib import Path
from PIL import Image, ImageOps

SIZES=(192,224,256)
PALETTES=("truecolor",96,160,256)
FILTERS={"lanczos":Image.Resampling.LANCZOS,"box":Image.Resampling.BOX}
DIRECTIONS=("ne","nw","sw","se")
BACKGROUNDS=((24,38,48),(233,235,225))

def load_views(manifest:Path):
    manifest=manifest.resolve()
    doc=json.loads(manifest.read_text())
    if doc.get("schemaVersion")!=1 or set(doc.get("directions",{}))!=set(DIRECTIONS):
        raise ValueError("Expected four original Blender camera directions")
    result={}
    for direction in DIRECTIONS:
        frames=doc["directions"][direction]
        if not isinstance(frames,list) or len(frames)!=1:
            raise ValueError("V5 compares one source frame per direction")
        name=frames[0].get("path")
        if not isinstance(name,str) or "\\" in name:
            raise ValueError("Invalid image reference")
        path=(manifest.parent/name).resolve()
        if not path.is_relative_to(manifest.parent) or not path.is_file():
            raise ValueError("Unsafe or missing original image")
        with Image.open(path) as source:
            if source.format!="PNG" or max(source.size)>2048:
                raise ValueError("Expected bounded original PNG")
            result[direction]=ImageOps.exif_transpose(source).convert("RGBA")
    if len({im.size for im in result.values()})!=1:
        raise ValueError("Original camera canvas dimensions differ")
    return result

def pack(views):
    first=views[DIRECTIONS[0]]
    atlas=Image.new("RGBA",(first.width*4,first.height))
    for i,d in enumerate(DIRECTIONS):
        atlas.alpha_composite(views[d],(i*first.width,0))
    return atlas

def limited_palette(source,colors):
    alpha=source.getchannel("A")
    backdrop=Image.new("RGB",source.size,(133,140,138))
    backdrop.paste(source.convert("RGB"),mask=alpha)
    reduced=backdrop.quantize(colors=colors,method=Image.Quantize.MEDIANCUT,
                              dither=Image.Dither.NONE).convert("RGBA")
    reduced.putalpha(alpha)  # Keep antialiased edges, never threshold to binary.
    return reduced

def over(im,color):
    matte=Image.new("RGBA",im.size,(*color,255))
    return Image.alpha_composite(matte,im).convert("RGB")

def rmse(a,b):
    results=[]
    for color in BACKGROUNDS:
        x=over(a,color).tobytes()
        y=over(b,color).tobytes()
        results.append(round(math.sqrt(sum((u-v)**2 for u,v in zip(x,y))/len(x)),3))
    return results

def alpha_info(im):
    rgba=im.convert("RGBA")
    levels=set(rgba.getchannel("A").getdata())
    bbox=rgba.getchannel("A").point(lambda x:255 if x>=20 else 0).getbbox()
    if not bbox:raise ValueError("Empty sprite")
    return dict(alpha_levels=len(levels),fractional_alpha=any(0<x<255 for x in levels),
                bbox=list(bbox),opaque_colors=len({p[:3] for p in rgba.getdata() if p[3]>=128}))

def matrix(manifest:Path,out:Path,sizes=SIZES,palettes=PALETTES,filters=FILTERS):
    views=load_views(manifest)
    out.mkdir(parents=True,exist_ok=True)
    candidates=[]
    for size in sizes:
        if type(size)!=int or not 32<=size<=512:raise ValueError("Invalid target size")
        for name,filter_type in filters.items():
            resized={d:views[d].resize((size,size),filter_type) for d in DIRECTIONS}
            truecolor=pack(resized)
            for colors in palettes:
                if colors!="truecolor" and (type(colors)!=int or not 8<=colors<=256):
                    raise ValueError("Invalid palette")
                candidate=truecolor if colors=="truecolor" else limited_palette(truecolor,colors)
                file=f"{size}px-{name}-{colors}.png"
                candidate.save(out/file,optimize=True)
                e1,e2=rmse(truecolor,candidate)
                info=alpha_info(candidate)
                entries={d:alpha_info(candidate.crop((i*size,0,(i+1)*size,size)))["bbox"]
                         for i,d in enumerate(DIRECTIONS)}
                candidates.append(dict(file=file,size=size,downscale=name,palette=colors,
                    bytes=(out/file).stat().st_size,
                    sha256=hashlib.sha256((out/file).read_bytes()).hexdigest(),
                    dark_rmse=e1,light_rmse=e2,per_direction_bbox=entries,**info))
    result={"schemaVersion":1,"sourceManifest":manifest.name,
            "inputFrameSize":list(views["ne"].size),"directions":list(DIRECTIONS),
            "note":"Truecolor is the reference; numeric scores cannot certify beauty.",
            "candidates":candidates}
    (out/"matrix.json").write_text(json.dumps(result,indent=2)+"\n")
    panels=[]
    for row in candidates:
        url=html.escape(row["file"],quote=True)
        title=html.escape(row["file"])
        panels.append(f'<article><h2>{title}</h2><img src="{url}" alt="Actual four-direction {title}"><p>'
                      f'{row["bytes"]/1024:.1f} KiB · {row["alpha_levels"]} alpha levels · '
                      f'RMSE dark/light {row["dark_rmse"]}/{row["light_rmse"]}</p></article>')
    document=('<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
      '<title>V5 real sprite export comparison</title>'
      '<style>body{font:14px/1.5 system-ui;background:#0e1e27;color:#e2f0ec;margin:20px}'
      'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}'
      'article{background:#18303c;border:1px solid #436273;padding:13px;border-radius:9px;overflow:hidden}'
      'img{max-width:100%;height:auto;background:repeating-conic-gradient(#52606c 0 25%,#384954 0 50%) 50%/20px 20px}'
      'h2{font-size:14px}p{color:#bad2d2}</style>'
      '<h1>V5 — actual sprite outputs, 24 variants</h1>'
      '<p>192, 224, 256 pixels · BOX/Lanczos · truecolor/96/160/256 colors. '
      'All images preserve RGBA antialiasing and original Blender framing. '
      'No variant is approved for public portfolio use.</p><main>'
      +''.join(panels)+'</main></html>')
    (out/"index.html").write_text(document)
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("animation_json",type=Path)
    p.add_argument("--out",required=True,type=Path)
    args=p.parse_args()
    result=matrix(args.animation_json,args.out)
    print("V5 generated",len(result["candidates"]),"spritesheet candidates:",args.out)
if __name__=="__main__":main()
