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
    # A single camera scale/pivot is used for every viewpoint and frame.
    # Frame cropping and palette conversion must not change this framing.
    camera.data.ortho_scale=extent*2.30
    scene.camera=camera

    def area_light(name,position,power,color,size):
        bpy.ops.object.light_add(type="AREA",location=position)
        light=bpy.context.object
        light.name=name
        light.data.energy=power
        light.data.color=color
        light.data.shape="DISK"
        light.data.size=size
        direction=mid-light.location
        light.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
        return light

    # Three-point studio softbox arrangement; world-space stationary across rotations.
    area_light("Warm large upper-left softbox",
       (mid.x-extent*3,mid.y-extent*3,mid.z+extent*5),
       1000,(1.0,.82,.67),extent*3.4)
    area_light("Cool low-energy bounce fill",
       (mid.x+extent*3,mid.y-extent*.8,mid.z+extent*1.5),
       370,(.61,.79,1.0),extent*4.2)
    area_light("Warm edge separation",
       (mid.x+extent,mid.y+extent*4,mid.z+extent*3),
       600,(1.0,.87,.70),extent*2.5)
    world=bpy.data.worlds.new("Atlas neutral studio environment")
    scene.world=world
    world.use_nodes=True
    world.node_tree.nodes["Background"].inputs["Color"].default_value=(.23,.30,.36,1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value=.34

    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=56
    scene.cycles.use_denoising=True
    scene.view_settings.view_transform="Standard"
    scene.view_settings.look="Medium High Contrast"
    scene.view_settings.exposure=0
    scene.view_settings.gamma=1
    scene.render.film_transparent=True
    scene.render.resolution_x=a.size
    scene.render.resolution_y=a.size
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGBA"
    scene.render.image_settings.color_depth="16"
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
