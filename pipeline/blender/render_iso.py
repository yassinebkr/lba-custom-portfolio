"""Blender original GLB/glTF -> true isometric directional PNG animation frames.

Example:
  blender -b --python pipeline/blender/render_iso.py -- \
      --input /path/to/original-character.glb --output /tmp/atlas-render \
      --size 256 --clip walk --frames 1,5,9,13 --fps 12 --action Walk

Requires an ORIGINAL rigged GLB for multiple animation frames.
Static assets use the default single frame and no action.
All frames use the SAME orthographic camera scale and center.
"""
import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
from iso_spec import ANGLES,camera_position,frame_numbers,export_plan


def render():
    import bpy
    from mathutils import Vector
    args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    p=argparse.ArgumentParser()
    p.add_argument("--input",required=True,type=Path)
    p.add_argument("--output",required=True,type=Path)
    p.add_argument("--size",type=int,default=256)
    p.add_argument("--clip",default="idle")
    p.add_argument("--frames",default="0")
    p.add_argument("--fps",type=int,default=12)
    p.add_argument("--action",default=None,help="Named original Blender action for animated frames")
    p.add_argument("--elevation",type=float,default=35.0)
    a=p.parse_args(args)
    if not a.input.is_file() or a.input.suffix.lower() not in (".glb",".gltf"):
        p.error("An original .glb or .gltf model is required")
    if not 64<=a.size<=1024:
        p.error("Size must be 64..1024")
    frames=frame_numbers(a.frames)
    plan=export_plan(a.clip,frames,a.fps)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(a.input.resolve()))
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    if not meshes:
        raise RuntimeError("Original model contains no meshes")
    if len(frames)>1 and not a.action:
        raise RuntimeError("Animated frames require --action for an original rig")
    if a.action:
        action=bpy.data.actions.get(a.action)
        if action is None:
            raise RuntimeError("Animation action not found: "+a.action)
        targets=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"]
        if not targets:
            raise RuntimeError("Animated GLB requires an armature")
        for target in targets:
            if target.animation_data is None:
                target.animation_data_create()
            target.animation_data.action=action
    points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    mid=sum(points,Vector())/len(points)
    extent=max((q-mid).length for q in points)
    if extent<=1e-6:
        raise RuntimeError("Degenerate model bounds")
    scene=bpy.context.scene
    bpy.ops.object.camera_add()
    camera=bpy.context.object
    camera.data.type="ORTHO"
    camera.data.ortho_scale=extent*3.4
    scene.camera=camera
    bpy.ops.object.light_add(type="AREA",location=(mid.x+extent*4,mid.y-extent*4,mid.z+extent*6))
    light=bpy.context.object
    light.data.energy=650
    light.data.shape="DISK"
    light.data.size=extent*4
    scene.render.engine="BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    scene.render.film_transparent=True
    scene.render.resolution_x=a.size
    scene.render.resolution_y=a.size
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGBA"
    a.output.mkdir(parents=True,exist_ok=True)
    for direction in ANGLES:
        camera.location=camera_position(tuple(mid),extent,direction,a.elevation)
        target=mid-camera.location
        camera.rotation_euler=target.to_track_quat("-Z","Y").to_euler()
        for frame in plan["directions"][direction]:
            scene.frame_set(frame["frameNumber"])
            out=(a.output/frame["path"]).resolve()
            out.parent.mkdir(parents=True,exist_ok=True)
            scene.render.filepath=str(out)
            bpy.ops.render.render(write_still=True)
    plan["sourceType"]="original-model"
    plan["sourceFile"]=a.input.name
    plan["requiresRightsReview"]=True
    (a.output/"animation.json").write_text(json.dumps(plan,indent=2)+"\n",encoding="utf-8")
    print("Rendered",len(frames)*len(ANGLES),"original directional frames")


if __name__=="__main__":
    render()
