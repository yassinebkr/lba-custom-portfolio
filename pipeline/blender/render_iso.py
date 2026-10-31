"""Blender background render for genuine 3D source → four isometric PNG orientations.

Usage:
  blender -b --python pipeline/blender/render_iso.py -- \
     --input /path/to/original.glb --output /tmp/atlas-views --size 256

Requires Blender 4.x with glTF importer. This file cannot be tested in CI without
Blender and a rights-cleared model fixture; run an end-to-end spike before J4 acceptance.
"""
import argparse
import math
import sys
from pathlib import Path

def run():
    try:
        import bpy
        from mathutils import Vector
    except ImportError as exc:
        raise SystemExit("This script must run within Blender") from exc
    arguments=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",required=True,type=Path)
    parser.add_argument("--output",required=True,type=Path)
    parser.add_argument("--size",type=int,default=256)
    args=parser.parse_args(arguments)
    if args.input.suffix.lower() not in (".glb",".gltf"):
        parser.error("Only glTF/GLB sources are supported")
    if not 64<=args.size<=1024:
        parser.error("Size must be 64..1024")
    if not args.input.is_file():
        parser.error("Input model not found")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()))
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    if not meshes:
        raise RuntimeError("No renderable meshes")
    # Bound all meshes in world coordinates, including imported transforms.
    points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    mid=sum(points,Vector())/len(points)
    extent=max((p-mid).length for p in points)
    if extent<=1e-6:
        raise RuntimeError("Degenerate model geometry")

    bpy.ops.object.camera_add()
    camera=bpy.context.object
    camera.data.type="ORTHO"
    camera.data.ortho_scale=extent*3.4
    bpy.context.scene.camera=camera

    def point_at(obj,target):
        direction=target-obj.location
        obj.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()

    bpy.ops.object.light_add(type="AREA",location=(mid.x+extent*4,mid.y-extent*4,mid.z+extent*6))
    light=bpy.context.object
    light.data.energy=650
    light.data.shape="DISK"
    light.data.size=extent*4
    scene=bpy.context.scene
    scene.render.engine="BLENDER_EEVEE_NEXT"
    scene.render.film_transparent=True
    scene.render.resolution_x=args.size
    scene.render.resolution_y=args.size
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGBA"
    args.output.mkdir(parents=True,exist_ok=True)
    for name,degrees in (("ne",45),("nw",135),("sw",225),("se",315)):
        a=math.radians(degrees)
        camera.location=(mid.x+extent*3*math.cos(a),
                         mid.y+extent*3*math.sin(a),
                         mid.z+extent*2.2)
        point_at(camera,mid)
        scene.render.filepath=str((args.output / (name+".png")).resolve())
        bpy.ops.render.render(write_still=True)
        print("Rendered",name)
if __name__=="__main__":
    run()
