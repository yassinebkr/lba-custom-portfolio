#!/usr/bin/env python3
"""Assemble the first owner-original workshop asset recipe using existing art.

The generator reuses the J3 authored fixtures, adds a four-direction 4-pose
walk cycle, and reuses real V5 Blender field-receiver source renders.
All produced assets remain explicitly PENDING and restricted to local QA.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image
from generate_samples import create, guide


ROOT = Path(__file__).resolve().parents[2]
BLENDER_SOURCE = ROOT / "apps/portfolio/sprite-demo/compare"
RECEIVER_CROP = (103, 35, 665, 597)
DIRECTIONS = ("SE", "NE", "NW", "SW")


def build(out: Path) -> Path:
    recipe_path = create(out)
    recipe = json.loads(recipe_path.read_text(encoding="utf-8"))
    sources = out / "sources"
    # A single camera-space crop is shared by every source. Both procedural
    # source frames and aligned Blender renders are 256x256 at this point.
    recipe["project"] = "first-original-workshop-local-preview"
    recipe["style"] = {
        "width": 112,
        "height": 112,
        "colors": "truecolor",
        "padding": 2,
        "fixedCropPx": [0, 0, 256, 256],
    }
    guide_asset = next(a for a in recipe["assets"] if a["id"] == "workshop-guide")
    for direction in DIRECTIONS:
        for index, stride in enumerate((-1, 0, 1, 0)):
            name = f"workshop-guide-walk-{direction.lower()}-{index:02d}.png"
            guide(direction, stride=stride).save(sources / name, optimize=True)
            guide_asset["frames"].append({
                "path": "sources/" + name,
                "action": "walk",
                "direction": direction,
                "durationMs": 130,
            })
    # Four independently authored Blender views with a common fixed crop.
    # Never copy source game textures, character models or game audio.
    receiver_frames = []
    for direction in DIRECTIONS:
        target = sources / f"telemetry-receiver-{direction.lower()}.png"
        original = BLENDER_SOURCE / f"source-{direction.lower()}.png"
        with Image.open(original) as im:
            if im.size != (768, 768) or im.format != "PNG":
                raise ValueError("Unexpected original Blender receiver render: " + str(original))
            cropped = im.convert("RGBA").crop(RECEIVER_CROP)
            cropped.resize((256, 256), Image.Resampling.LANCZOS).save(target, optimize=True)
        receiver_frames.append({
            "path": "sources/" + target.name,
            "action": "idle", "direction": direction, "durationMs": 200,
        })
    recipe["assets"].append({
        "id": "telemetry-receiver", "kind": "prop",
        "source": {
            "origin": "original-model",
            "creator": "Project Atlas Blender source renderer",
            "license": "original",
            "reviewStatus": "pending", "allowedForPublicBuild": False,
            "sourceUrl": None, "attribution": None,
        },
        "frames": receiver_frames,
    })
    # Do not assert independent artistic approval: these are a pilot's sources.
    assert all(a["source"]["allowedForPublicBuild"] is False for a in recipe["assets"])
    recipe_path.write_text(json.dumps(recipe, indent=2) + "\n", encoding="utf-8")
    return recipe_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    result = build(args.out.resolve())
    print(f"Original workshop source recipe: {result}")
