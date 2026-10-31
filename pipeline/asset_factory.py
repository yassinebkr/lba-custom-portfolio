#!/usr/bin/env python3
"""Original-asset sprite preparation: source image(s) -> quantized atlas + rights manifest.

This tool never fabricates missing 3D views from a single photograph.
For genuine multi-angle isometric renders, supply separate Blender output PNGs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageOps

MAX_INPUT_PIXELS = 32_000_000
ALLOWED_COLORS = (16, 32, 64, 128, 256)
KINDS = ("character", "furniture", "prop", "structure")


def slug(value: str) -> str:
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", value):
        raise ValueError("Asset IDs must be lowercase slugs (max 64 chars)")
    return value


def safe_size(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"([1-9][0-9]{0,3})x([1-9][0-9]{0,3})", value)
    if not match:
        raise ValueError("Size must be WIDTHxHEIGHT")
    width, height = int(match[1]), int(match[2])
    if not (16 <= width <= 512 and 16 <= height <= 512):
        raise ValueError("Sprite frame dimensions must be 16..512 pixels")
    return width, height


def color(value: str) -> tuple[int, int, int]:
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        raise ValueError("Background color must be #RRGGBB")
    return tuple(int(value[i:i+2], 16) for i in (1, 3, 5))


def load_frame(path: Path, bg: tuple[int, int, int] | None,
               tolerance: int, size: tuple[int, int]) -> Image.Image:
    if not path.is_file():
        raise ValueError(f"Missing source: {path}")
    if path.stat().st_size > 40_000_000:
        raise ValueError("Source file too large (40 MB maximum)")
    with Image.open(path) as source:
        if source.format != "PNG":
            raise ValueError("Only lossless PNG sources are supported; convert photos first")
        if source.width * source.height > MAX_INPUT_PIXELS:
            raise ValueError("Source image exceeds pixel budget")
        image = ImageOps.exif_transpose(source).convert("RGBA")
    if bg is not None:
        pix = image.load()
        for y in range(image.height):
            for x in range(image.width):
                r, g, b, a = pix[x, y]
                if max(abs(r-bg[0]), abs(g-bg[1]), abs(b-bg[2])) <= tolerance:
                    pix[x, y] = (0, 0, 0, 0)
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("No foreground pixels detected")
    image = image.crop(bbox)
    target_w, target_h = size
    padding = max(2, min(target_w, target_h) // 12)
    image.thumbnail((target_w - 2 * padding, target_h - 2 * padding),
                    resample=Image.Resampling.LANCZOS)
    output = Image.new("RGBA", size, (0, 0, 0, 0))
    px = (target_w - image.width)//2
    py = target_h - padding - image.height
    output.alpha_composite(image, (px, py))
    return output


def quantize_atlas(atlas: Image.Image, colors: int) -> Image.Image:
    if colors not in ALLOWED_COLORS:
        raise ValueError(f"Colors must be one of {ALLOWED_COLORS}")
    # Quantize the ENTIRE atlas to a shared palette, not individual frames.
    pixels = atlas.convert("RGBA")
    alpha = pixels.getchannel("A")
    opaque = Image.new("RGB", pixels.size, (0, 0, 0))
    opaque.paste(pixels.convert("RGB"), mask=alpha)
    quantized = opaque.quantize(colors=colors, method=Image.Quantize.MEDIANCUT,
                                dither=Image.Dither.NONE).convert("RGBA")
    quantized.putalpha(alpha.point(lambda a: 255 if a >= 128 else 0))
    return quantized


def build_atlas(paths: list[Path], size: tuple[int, int],
                colors: int, bg: tuple[int, int, int] | None,
                tolerance: int) -> Image.Image:
    if not (1 <= len(paths) <= 120):
        raise ValueError("Provide between 1 and 120 frames")
    frames = [load_frame(p, bg, tolerance, size) for p in paths]
    atlas = Image.new("RGBA", (size[0] * len(frames), size[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, (index * size[0], 0))
    return quantize_atlas(atlas, colors)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def build_manifest(args: argparse.Namespace, source_paths: list[Path],
                   size: tuple[int, int]) -> dict:
    if not args.creator.strip() or len(args.creator) > 100:
        raise ValueError("Creator required (max 100 characters)")
    if args.license not in ("original", "CC0-1.0", "MIT", "CC-BY-4.0"):
        raise ValueError("Unsupported license")
    if args.license == "CC-BY-4.0" and not args.attribution:
        raise ValueError("CC-BY requires attribution")
    source = {
        "origin": args.origin,
        "creator": args.creator,
        "sourceUrl": args.source_url,
        "license": args.license,
        "attribution": args.attribution,
        "reviewStatus": "approved" if args.approve else "pending",
        "allowedForPublicBuild": bool(args.approve),
    }
    return {
        "schemaVersion": 1,
        "id": slug(args.id),
        "name": args.name or args.id,
        "kind": args.kind,
        "source": source,
        "atlasRef": f"atlas/{args.id}.png",
        "image": {"frameWidthPx": size[0], "frameHeightPx": size[1],
                  "pivotPx": {"x": size[0]//2, "y": size[1]-max(2, min(size)//12)}},
        "animation": {"id": f"{args.id}-idle", "loop": len(source_paths)>1,
                      "frames": [
                          {"index": i, "durationMs": args.duration_ms,
                           "imageRef": f"atlas/{args.id}.png",
                           "sourceSha256": sha256(p)}
                          for i, p in enumerate(source_paths)
                      ]},
        "production": {"method": args.method, "direction": args.direction,
                       "paletteColors": args.colors,
                       "note": "A single 2D photo cannot synthesize accurate unseen isometric angles."},
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", nargs="+", type=Path, required=True,
                   help="One or more transparent PNGs (one source angle or ordered animation frames)")
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--id", required=True)
    p.add_argument("--name", default=None)
    p.add_argument("--kind", choices=KINDS, required=True)
    p.add_argument("--size", default="64x64")
    p.add_argument("--colors", type=int, default=64, choices=ALLOWED_COLORS)
    p.add_argument("--background", type=color, default=None,
                   help="Optional solid background color to remove (e.g. #ffffff)")
    p.add_argument("--tolerance", type=int, default=15)
    p.add_argument("--creator", required=True)
    p.add_argument("--origin", choices=("original-art","original-photo","licensed-asset","original-model"),
                   default="original-photo")
    p.add_argument("--license", choices=("original","CC0-1.0","MIT","CC-BY-4.0"),default="original")
    p.add_argument("--attribution",default=None)
    p.add_argument("--source-url",default=None)
    p.add_argument("--direction",choices=("front","rear","left","right","ne","nw","se","sw"),default="se")
    p.add_argument("--method",choices=("photo-2d","blender-3d"),default="photo-2d")
    p.add_argument("--duration-ms",type=int,default=150)
    p.add_argument("--approve",action="store_true",help="Explicit license and visual review approval")
    args=p.parse_args(argv)
    if not (0 <= args.tolerance <= 100):
        p.error("Tolerance must be 0..100")
    if not (16 <= args.duration_ms <= 60000):
        p.error("Frame duration must be 16..60000 ms")
    if args.method == "photo-2d" and len(args.input)>1 and args.direction not in ("front","rear","left","right","ne","nw","se","sw"):
        p.error("Invalid direction")
    size=safe_size(args.size)
    output=args.out.resolve()
    output.mkdir(parents=True,exist_ok=True)
    atlas=build_atlas(args.input,size,args.colors,args.background,args.tolerance)
    manifest=build_manifest(args,args.input,size)
    atlas.save(output / (args.id+".png"),format="PNG",optimize=True)
    (output/(args.id+".json")).write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n")
    print("Generated:",output/(args.id+".png"),"frames:",len(args.input),
          "public-approved:",args.approve)
    return 0


if __name__=="__main__":
    raise SystemExit(main())
