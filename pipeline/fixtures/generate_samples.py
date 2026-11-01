#!/usr/bin/env python3
"""Create seven ORIGINAL synthetic source fixtures for J3 asset QA.

This tests an actual photo/illustration -> atlas pipeline without distributing
copyrighted game art. Fixtures are not commercial-quality approved portfolio art.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

SIZE = (256, 256)


def canvas():
    return Image.new("RGBA", SIZE, (0, 0, 0, 0))


def polygon(draw, points, fill, outline=None, width=1):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points+[points[0]], fill=outline, width=width, joint="curve")


def block(draw, x, y, w, h, depth, top, right, front):
    polygon(draw, [(x, y), (x+w,y-depth), (x+w+depth,y), (x+depth,y+depth)], top, "#e6d7bd", 2)
    polygon(draw, [(x+depth,y+depth), (x+w+depth,y), (x+w+depth,y+h), (x+depth,y+depth+h)], right)
    polygon(draw, [(x,y),(x+depth,y+depth),(x+depth,y+depth+h),(x,y+h)], front)


def shadow(im, box):
    shade = Image.new("RGBA", im.size, (0,0,0,0))
    d = ImageDraw.Draw(shade)
    d.ellipse(box, fill=(11,16,21,98))
    im.alpha_composite(shade.filter(ImageFilter.GaussianBlur(7)))


def bench():
    im=canvas();shadow(im,(42,203,217,231));d=ImageDraw.Draw(im)
    for x,y in [(66,157),(169,123),(86,177),(189,141)]:
        d.rectangle((x,y,x+13,y+69),fill="#6a5a4d")
        d.rectangle((x+8,y,x+13,y+67),fill="#3b3b3a")
    polygon(d,[(49,150),(160,107),(212,143),(100,189)],"#af825b","#e7ba87",3)
    polygon(d,[(100,189),(212,143),(212,154),(100,201)],"#6a4f40")
    polygon(d,[(49,150),(100,189),(100,201),(49,163)],"#8e684e")
    # instrument bench: PSU, braided lead, oscilloscope
    block(d,119,109,36,24,13,"#607985","#3d535d","#32464f")
    d.rounded_rectangle((144,116,166,132),radius=2,fill="#131f2a",outline="#9fded1",width=2)
    d.line([(149,127),(154,122),(158,125),(163,119)],fill="#a3e6d9",width=2)
    for x,y in [(80,158),(90,153),(101,149)]:
        d.ellipse((x-3,y-3,x+3,y+3),fill="#d6b86b",outline="#5c4d36")
    d.line([(160,151),(170,161),(155,173)],fill="#c75e53",width=3)
    return im


def chair():
    im=canvas();shadow(im,(74,204,183,233));d=ImageDraw.Draw(im)
    polygon(d,[(83,118),(112,104),(158,123),(128,144)],"#447b83","#9cced0",3)
    for x,y in [(88,151),(142,145),(113,167),(164,160)]:
        d.line([(x,y),(x+3,y+57)],fill="#615955",width=9)
    polygon(d,[(83,129),(127,150),(158,135),(112,112)],"#698d90","#c4d7d6",3)
    polygon(d,[(83,129),(127,150),(127,161),(83,142)],"#435964")
    polygon(d,[(127,150),(158,135),(158,147),(127,161)],"#344b55")
    polygon(d,[(77,59),(107,51),(112,113),(83,131)],"#5d7887","#aac7c7",3)
    polygon(d,[(84,69),(101,64),(105,103),(88,113)],"#334f5b")
    d.line([(79,60),(83,131)],fill="#d1b892",width=5)
    return im


def camera():
    im=canvas();shadow(im,(64,213,200,240));d=ImageDraw.Draw(im)
    # tripod
    d.line([(131,144),(82,226)],fill="#75868b",width=8)
    d.line([(131,144),(181,225)],fill="#75868b",width=8)
    d.line([(131,147),(130,229)],fill="#a6afb0",width=7)
    d.rectangle((125,135,139,165),fill="#4d626b")
    # camera rig and rails
    d.line([(73,139),(190,104)],fill="#d2d3bf",width=5)
    d.line([(78,151),(192,116)],fill="#85989f",width=5)
    block(d,92,87,58,43,22,"#465f68","#2e444f","#253843")
    polygon(d,[(151,105),(188,111),(193,135),(157,137)],"#283943","#97afb8",2)
    d.ellipse((154,107,190,142),fill="#151f2b",outline="#bed3cf",width=5)
    d.ellipse((163,116,181,133),fill="#275e6c",outline="#91c6c6",width=3)
    d.ellipse((168,120,177,129),fill="#9bdeda")
    d.rounded_rectangle((98,82,123,93),radius=2,fill="#172a34",outline="#cbbf97",width=2)
    d.rectangle((113,108,136,118),fill="#c3ab7a")
    d.ellipse((99,124,107,132),fill="#d45e57")
    return im


def rf_console(frame=0):
    im=canvas();shadow(im,(47,207,221,240));d=ImageDraw.Draw(im)
    block(d,60,124,103,58,39,"#445c65","#294653","#374953")
    polygon(d,[(68,128),(162,94),(194,126),(98,162)],"#253942","#a4c1c4",3)
    polygon(d,[(103,135),(139,123),(167,139),(129,152)],"#172b36")
    d.line([(113,135),(134,128),(149,136)],fill="#87d3c7",width=3)
    for idx in range(5):
        d.ellipse((95+idx*11,172-idx*3,101+idx*11,178-idx*3),
                  fill=("#a7f5cf" if idx==frame%5 else "#58767b"))
    d.line([(180,123),(186,45)],fill="#bcc5bb",width=5)
    d.line([(164,79),(207,79)],fill="#c8d6ce",width=4)
    d.ellipse((179,39,191,51),fill=("#d1f9cd" if frame%2 else "#7cb7b2"))
    return im


def door():
    im=canvas();shadow(im,(48,215,217,239));d=ImageDraw.Draw(im)
    polygon(d,[(49,81),(131,45),(212,82),(133,119)],"#d4c4a7","#f3dfb2",3)
    polygon(d,[(49,81),(133,119),(133,229),(49,191)],"#516679","#b6b8b4",3)
    polygon(d,[(133,119),(212,82),(212,190),(133,229)],"#405567","#9caaac",3)
    polygon(d,[(71,100),(130,75),(130,194),(71,169)],"#202f3d","#b1c5c9",4)
    polygon(d,[(143,121),(190,99),(190,179),(143,200)],"#72828a","#c0ced0",3)
    for y in (124,140,156):
        d.line([(154,y),(183,y-12)],fill="#394e59",width=3)
    d.ellipse((115,152,122,158),fill="#e8c478")
    return im


def guide(direction: str):
    im=canvas();shadow(im,(87,214,170,238));d=ImageDraw.Draw(im)
    # boots, trousers and long work jacket
    d.line([(109,176),(104,216)],fill="#334b61",width=15)
    d.line([(146,176),(155,216)],fill="#334b61",width=15)
    d.ellipse((91,210,116,225),fill="#1c2933")
    d.ellipse((145,208,172,224),fill="#1c2933")
    polygon(d,[(106,109),(143,105),(164,180),(98,184)],"#69848c","#c4d2cb",3)
    polygon(d,[(109,111),(130,125),(122,181),(101,181)],"#8baab0")
    polygon(d,[(130,125),(147,109),(163,181),(122,181)],"#4b6673")
    # arm pose direction
    arm_offset={"NE":(-10,-4),"NW":(10,-4),"SE":(-4,6),"SW":(4,6)}[direction]
    d.line([(106,125),(91+arm_offset[0],161+arm_offset[1])],fill="#536f7b",width=16)
    d.line([(153,122),(167+arm_offset[0],162+arm_offset[1])],fill="#58717c",width=15)
    d.ellipse((82+arm_offset[0],150+arm_offset[1],99+arm_offset[0],168+arm_offset[1]),fill="#d1a47e")
    d.ellipse((160+arm_offset[0],152+arm_offset[1],177+arm_offset[0],170+arm_offset[1]),fill="#d1a47e")
    d.ellipse((105,65,151,121),fill="#d4a785",outline="#775744",width=2)
    polygon(d,[(104,82),(108,60),(122,54),(145,64),(155,80)],"#29323b")
    if direction in {"SE","SW"}:
        d.ellipse((118,91,122,96),fill="#26323b")
        d.ellipse((138,90,142,95),fill="#26323b")
        d.arc((120,98,140,111),0,170,fill="#a06d58",width=2)
    d.rectangle((111,135,117,150),fill="#e8cd83")
    return im


def lamp(frame: int):
    im=canvas();d=ImageDraw.Draw(im)
    glow=Image.new("RGBA",SIZE,(0,0,0,0))
    g=ImageDraw.Draw(glow)
    power=(27,54,82,115)[frame]
    g.ellipse((71-power//3,78-power//3,185+power//3,174+power//3),
              fill=(91,224,202,power))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(16)))
    d=ImageDraw.Draw(im)
    block(d,91,146,48,25,20,"#516f72","#32434b","#253641")
    d.line([(124,149),(124,103)],fill="#afbab9",width=8)
    d.ellipse((103,77,147,119),fill=("#a4f6d6" if frame>1 else "#7ba9a3"),
              outline="#ecedda",width=4)
    d.ellipse((116,91,134,109),fill="#f7ffdc" if frame>1 else "#a1d4bf")
    return im


def create(base: Path) -> Path:
    base.mkdir(parents=True,exist_ok=True)
    source_dir=base/"sources"
    source_dir.mkdir(exist_ok=True)
    examples=[
        ("workshop-guide","character",[("idle",d,guide(d)) for d in ("SE","NE","NW","SW")]),
        ("electronics-bench","furniture",[("idle","SE",bench())]),
        ("workshop-chair","furniture",[("idle","SE",chair())]),
        ("cine-camera","prop",[("idle","SE",camera())]),
        ("radio-console","prop",[("idle","SE",rf_console())]),
        ("workshop-door","structure",[("idle","SE",door())]),
        ("status-lamp","prop",[("active","SE",lamp(n)) for n in range(4)]),
    ]
    recipe={"schemaVersion":1,"project":"original-workshop-fixture",
            "style":{"width":96,"height":112,"colors":64,"padding":5}, "assets":[]}
    for identifier,kind,frames in examples:
        entries=[]
        for n,(action,direction,image) in enumerate(frames):
            name=f"{identifier}-{direction.lower()}-{n:02}.png"
            image.save(source_dir/name,optimize=True)
            entries.append({"path":"sources/"+name,"action":action,"direction":direction,
                            "durationMs":160 if action=="active" else 240})
        recipe["assets"].append({"id":identifier,"kind":kind,"frames":entries,
            "source":{"origin":"original-art","creator":"Project Atlas synthetic fixture generator",
                      "license":"original","reviewStatus":"pending",
                      "allowedForPublicBuild":False,"sourceUrl":None,"attribution":None}})
    path=base/"recipe.json"
    path.write_text(json.dumps(recipe,indent=2)+"\n",encoding="utf-8")
    return path


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=Path,required=True)
    args=p.parse_args()
    path=create(args.out)
    print(f"Generated {len(json.loads(path.read_text())['assets'])} original synthetic fixtures at {path}")


if __name__=="__main__":
    main()
