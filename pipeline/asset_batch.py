#!/usr/bin/env python3
"""Asset-first pipeline: one JSON recipe -> PNG atlases, manifests, contact-sheet QA.

Offline and deterministic; Pillow is the only runtime dependency.
Sources may be photographs, transparent PNGs or Blender renders. The pipeline
does NOT infer unseen faces or invent motion from a single still image.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ID = re.compile(r"^[a-z][a-z0-9-]{0,63}$")
KIND = {"character", "furniture", "prop", "structure"}
DIRECTIONS = {"S", "SE", "E", "NE", "N", "NW", "W", "SW", "ISO"}
ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP"}
ALLOWED_ORIGINS = {"original-art", "original-photo", "original-model", "licensed-asset"}
ALLOWED_LICENSES = {"original", "CC0-1.0", "CC-BY-4.0", "MIT"}
MAX_FRAMES = 64
MAX_SOURCE_BYTES = 40_000_000
MAX_SOURCE_PIXELS = 32_000_000
MAX_COLS = 8


class RecipeError(ValueError):
    """Actionable, user-facing input validation error."""


def slug(value: object, field: str) -> str:
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise RecipeError(f"{field}: expected a lowercase ID (a-z, 0-9, dash)")
    return value


def integer(value: object, minimum: int, maximum: int, field: str) -> int:
    if type(value) is not int or not minimum <= value <= maximum:
        raise RecipeError(f"{field}: expected an integer from {minimum} to {maximum}")
    return value


def safe_source(root: Path, source: object) -> Path:
    if not isinstance(source, str) or not source or "\\" in source:
        raise RecipeError("Frame source must be a nonempty relative path")
    path = (root / source).resolve()
    if not path.is_relative_to(root.resolve()):
        raise RecipeError(f"Frame path escapes recipe folder: {source}")
    if not path.is_file() or path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise RecipeError(f"Source PNG/JPEG/WebP not found: {source}")
    if path.stat().st_size > MAX_SOURCE_BYTES:
        raise RecipeError(f"Source exceeds 40MB: {source}")
    return path


def provenance(record: object, asset_id: str) -> dict:
    if not isinstance(record, dict):
        raise RecipeError(f"{asset_id}: source rights record is required")
    if record.get("origin") not in ALLOWED_ORIGINS:
        raise RecipeError(f"{asset_id}: unsupported origin")
    creator = record.get("creator")
    if not isinstance(creator, str) or not 1 <= len(creator.strip()) <= 100:
        raise RecipeError(f"{asset_id}: source creator must be specified")
    license_id = record.get("license")
    if license_id not in ALLOWED_LICENSES:
        raise RecipeError(f"{asset_id}: unsupported license")
    status = record.get("reviewStatus", "pending")
    if status not in {"pending", "approved", "rejected"}:
        raise RecipeError(f"{asset_id}: invalid reviewStatus")
    allowed = record.get("allowedForPublicBuild", False)
    if type(allowed) is not bool or (allowed and status != "approved"):
        raise RecipeError(f"{asset_id}: public publication requires explicit approved status")
    attribution = record.get("attribution")
    if license_id == "CC-BY-4.0" and (not isinstance(attribution, str) or not attribution.strip()):
        raise RecipeError(f"{asset_id}: CC-BY-4.0 requires attribution")
    source_url = record.get("sourceUrl")
    if source_url is not None and (not isinstance(source_url, str) or not source_url.startswith("https://")):
        raise RecipeError(f"{asset_id}: sourceUrl must be HTTPS or null")
    return {
        "origin": record["origin"], "creator": creator.strip(), "license": license_id,
        "sourceUrl": source_url, "attribution": attribution,
        "reviewStatus": status, "allowedForPublicBuild": allowed,
    }


def load_rgba(path: Path, key_rgb: tuple[int, int, int] | None, tolerance: int) -> Image.Image:
    try:
        with Image.open(path) as image:
            if image.format not in ALLOWED_FORMATS:
                raise RecipeError(f"Unsupported image format in {path.name}")
            if image.width * image.height > MAX_SOURCE_PIXELS:
                raise RecipeError(f"{path.name}: image exceeds 32 million pixels")
            result = ImageOps.exif_transpose(image).convert("RGBA")
    except (OSError, ValueError) as err:
        if isinstance(err, RecipeError):
            raise
        raise RecipeError(f"Unable to read {path.name}: {err}") from err
    if key_rgb is not None:
        pixels = result.load()
        for y in range(result.height):
            for x in range(result.width):
                r, g, b, a = pixels[x, y]
                if max(abs(r-key_rgb[0]), abs(g-key_rgb[1]), abs(b-key_rgb[2])) <= tolerance:
                    pixels[x, y] = (0, 0, 0, 0)
    if not result.getchannel("A").getbbox():
        raise RecipeError(f"{path.name}: image contains no visible pixels")
    return result


def render_fixed_frames(sources: list[Image.Image], size: tuple[int, int], padding: int) -> list[Image.Image]:
    """Common scale and foot baseline across all frames, avoiding zoom jitter."""
    boxes = [im.getchannel("A").getbbox() for im in sources]
    assert all(box is not None for box in boxes)
    max_width = max(box[2] - box[0] for box in boxes if box)
    max_height = max(box[3] - box[1] for box in boxes if box)
    scale = min((size[0] - padding*2)/max_width, (size[1] - padding*2)/max_height)
    if scale <= 0:
        raise RecipeError("Frame size is too small for the requested padding")
    frames = []
    for image, box in zip(sources, boxes):
        assert box is not None
        im = image.crop(box)
        w = max(1, round(im.width * scale))
        h = max(1, round(im.height * scale))
        im = im.resize((w, h), Image.Resampling.LANCZOS)
        dest = Image.new("RGBA", size, (0, 0, 0, 0))
        dest.alpha_composite(im, ((size[0]-w)//2, size[1]-padding-h))
        frames.append(dest)
    return frames


def shared_palette(atlas: Image.Image, colors: int) -> Image.Image:
    """Quantize opaque RGB samples jointly; preserve alpha instead of black fringes."""
    a = atlas.getchannel("A")
    rgb = Image.new("RGB", atlas.size, (38, 42, 46))
    rgb.paste(atlas.convert("RGB"), mask=a)
    quant = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = quant.convert("RGBA")
    out.putalpha(a.point(lambda value: 255 if value >= 128 else 0))
    return out


def checker_preview(atlas: Image.Image, frame_size: tuple[int, int], frame_count: int) -> Image.Image:
    """Readable contact sheet showing the *actual generated* atlas frames."""
    show_count = min(frame_count, 16)
    scale = 3
    cell_w, cell_h = frame_size[0] * scale + 24, frame_size[1] * scale + 44
    cols = min(4, show_count)
    rows = math.ceil(show_count / cols)
    preview = Image.new("RGB", (cols * cell_w, rows * cell_h), (21, 29, 38))
    draw = ImageDraw.Draw(preview)
    for idx in range(show_count):
        x, y = idx % cols * cell_w, idx // cols * cell_h
        sx, sy = idx % MAX_COLS * frame_size[0], idx // MAX_COLS * frame_size[1]
        frame = atlas.crop((sx, sy, sx + frame_size[0], sy + frame_size[1]))
        board = Image.new("RGB", frame.size, (77, 83, 90))
        bd = ImageDraw.Draw(board)
        for by in range(0, frame.height, 8):
            for bx in range(0, frame.width, 8):
                if ((bx//8)+(by//8))%2 == 0:
                    bd.rectangle((bx, by, bx+7, by+7), fill=(93, 98, 105))
        board.paste(frame, (0, 0), frame)
        preview.paste(board.resize((frame_size[0]*scale, frame_size[1]*scale),
                                  Image.Resampling.NEAREST), (x+12, y+10))
        draw.text((x+14, y+frame_size[1]*scale+17), f"FRAME {idx+1:02}", fill=(194, 214, 215))
    return preview


def build(recipe_path: Path, destination: Path) -> dict:
    recipe_path = recipe_path.resolve()
    try:
        spec = json.loads(recipe_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise RecipeError(f"Unable to read recipe JSON: {e}") from e
    if not isinstance(spec, dict) or spec.get("schemaVersion") != 1:
        raise RecipeError("Recipe requires schemaVersion: 1")
    slug(spec.get("project"), "project")
    style = spec.get("style")
    if not isinstance(style, dict):
        raise RecipeError("style is required")
    width = integer(style.get("width"), 32, 256, "style.width")
    height = integer(style.get("height"), 32, 256, "style.height")
    colors = integer(style.get("colors"), 8, 256, "style.colors")
    padding = integer(style.get("padding", 4), 0, 24, "style.padding")
    if padding*2 >= min(width, height):
        raise RecipeError("style.padding consumes all usable frame space")
    key = style.get("backgroundKey")
    if key is not None and (not isinstance(key, str) or not re.fullmatch("#[a-fA-F0-9]{6}", key)):
        raise RecipeError("backgroundKey must be #RRGGBB")
    key_rgb = tuple(int(key[i:i+2], 16) for i in (1, 3, 5)) if key else None
    tolerance = integer(style.get("keyTolerance", 0), 0, 80, "style.keyTolerance")
    assets = spec.get("assets")
    if not isinstance(assets, list) or not 1 <= len(assets) <= 80:
        raise RecipeError("Provide 1..80 assets")
    names: set[str] = set()
    prepared: list[tuple[dict, list[dict], list[Image.Image]]] = []
    root = recipe_path.parent
    # Validate and decode everything before creating or replacing any outputs.
    for raw in assets:
        if not isinstance(raw, dict):
            raise RecipeError("Every asset must be an object")
        name = slug(raw.get("id"), "asset.id")
        if name in names:
            raise RecipeError(f"Duplicate asset ID: {name}")
        names.add(name)
        if raw.get("kind") not in KIND:
            raise RecipeError(f"{name}: invalid kind")
        rights = provenance(raw.get("source"), name)
        frames = raw.get("frames")
        if not isinstance(frames, list) or not 1 <= len(frames) <= MAX_FRAMES:
            raise RecipeError(f"{name}: provide 1..{MAX_FRAMES} frames")
        meta, loaded = [], []
        for frame in frames:
            if not isinstance(frame, dict):
                raise RecipeError(f"{name}: invalid frame entry")
            direction = frame.get("direction")
            action = slug(frame.get("action"), f"{name}.action")
            if direction not in DIRECTIONS:
                raise RecipeError(f"{name}: direction must be {sorted(DIRECTIONS)}")
            duration = integer(frame.get("durationMs", 150), 16, 60000, f"{name}.durationMs")
            path = safe_source(root, frame.get("path"))
            loaded.append(load_rgba(path, key_rgb, tolerance))
            meta.append({"action":action, "direction":direction, "durationMs":duration,
                         "input": frame["path"], "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        prepared.append(({"id":name, "kind":raw["kind"], "source":rights}, meta, loaded))
    destination = destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    (destination/"atlases").mkdir(exist_ok=True)
    (destination/"previews").mkdir(exist_ok=True)
    output = {"schemaVersion": 1, "project":spec["project"], "style":style, "assets":[]}
    for item, frame_data, images in prepared:
        frames = render_fixed_frames(images, (width,height), padding)
        columns = min(len(frames), MAX_COLS)
        rows = math.ceil(len(frames)/MAX_COLS)
        atlas = Image.new("RGBA", (columns*width, rows*height), (0,0,0,0))
        for n, frame in enumerate(frames):
            atlas.alpha_composite(frame, ((n % MAX_COLS)*width, (n // MAX_COLS)*height))
            frame_data[n]["rect"] = [(n % MAX_COLS)*width, (n // MAX_COLS)*height, width, height]
        atlas = shared_palette(atlas, colors)
        atlas_file = "atlases/"+item["id"]+".png"
        preview_file = "previews/"+item["id"]+".png"
        atlas.save(destination/atlas_file, optimize=True)
        checker_preview(atlas, (width,height), len(frames)).save(destination/preview_file, optimize=True)
        output["assets"].append({
            **item, "atlasRef": atlas_file, "previewRef": preview_file,
            "frameSize": {"width":width, "height":height},
            "pivot": {"x":width//2, "y":height-padding},
            "frames": frame_data,
            "warnings": ["Artwork is a synthetic fixture or artist-provided source; visual approval required"]
            if not item["source"]["allowedForPublicBuild"] else [],
        })
    (destination/"assets.json").write_text(json.dumps(output,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    cards = []
    for asset in output["assets"]:
        src = html.escape(asset["previewRef"], quote=True)
        title = html.escape(asset["id"])
        subtitle = html.escape(asset["kind"])
        status = "APPROVED" if asset["source"]["allowedForPublicBuild"] else "PENDING REVIEW"
        cards.append(f'<article><img src="{src}" alt="{title} sprite contact sheet"><strong>{title}</strong><span>{subtitle} · {len(asset["frames"])} frames · {status}</span></article>')
    gallery = ('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
       '<title>Asset QA — '+html.escape(spec["project"])+'</title>'
       '<style>body{font:15px system-ui;background:#111b26;color:#e6f1ec;margin:24px}h1{font-size:24px}'
       'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}'
       'article{border:1px solid #3b5663;border-radius:10px;padding:16px;background:#1d303d;display:flex;flex-direction:column;gap:8px}'
       'img{max-width:100%;height:auto;image-rendering:pixelated}span{color:#b1c4c8;font-size:12px}</style>'
       '<h1>Asset quality review</h1><p>Original source fixtures. NOT approved production artwork.</p><main>'
       +''.join(cards)+'</main></html>')
    (destination/"index.html").write_text(gallery,encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recipe",type=Path,help="JSON recipe with source images, actions and directions")
    parser.add_argument("--out",type=Path,default=Path("output/atlas-assets"))
    args = parser.parse_args()
    try:
        result = build(args.recipe,args.out)
    except RecipeError as error:
        parser.exit(2, f"Asset pipeline: {error}\n")
    print(f"Prepared {len(result['assets'])} assets in {args.out}")
    print(f"Review: {args.out / 'index.html'}")


if __name__ == "__main__":
    main()
