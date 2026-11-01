"""M3: deterministic camera directions and animation export plans for original meshes."""
from __future__ import annotations
import math
import re
from pathlib import Path

ANGLES = {"ne":45, "nw":135, "sw":225, "se":315}


def camera_position(center, extent, direction, elevation=35.0):
    if direction not in ANGLES:
        raise ValueError("Unknown original camera direction: "+str(direction))
    if not 5 <= elevation <= 85 or not math.isfinite(extent) or extent <= 0:
        raise ValueError("Invalid elevation or model extent")
    a=math.radians(ANGLES[direction])
    h=math.radians(elevation)
    distance=extent*4
    return (center[0]+distance*math.cos(h)*math.cos(a),
            center[1]+distance*math.cos(h)*math.sin(a),
            center[2]+distance*math.sin(h))


def frame_numbers(value):
    if not isinstance(value,str) or not re.fullmatch(r"\d+(,\d+)*",value):
        raise ValueError("Frames must be comma-separated nonnegative integers")
    numbers=[int(v) for v in value.split(",")]
    if len(numbers)>120 or len(set(numbers))!=len(numbers) or any(n>100000 for n in numbers):
        raise ValueError("Frames must be unique and bounded, max 120")
    return numbers


def export_plan(clip,frames,fps,directions=("ne","nw","sw","se")):
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,63}",clip):
        raise ValueError("Invalid clip identifier")
    if not 1<=fps<=60 or not isinstance(fps,int):
        raise ValueError("FPS must be integer 1..60")
    if not frames or len(frames)>120 or len(set(frames))!=len(frames):
        raise ValueError("Require 1..120 unique animation frames")
    if not directions or len(set(directions))!=len(directions) or any(d not in ANGLES for d in directions):
        raise ValueError("Require unique camera directions")
    return {
        "schemaVersion":1,"clip":clip,"fps":fps,"loop":True,
        "directions":{direction:[
            {"frameNumber":n,"durationMs":round(1000/fps),
             "path":direction+"/"+clip+"-"+str(n).zfill(5)+".png"}
            for n in frames] for direction in directions}
    }
