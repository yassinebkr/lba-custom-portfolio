"""V7 original electronics workshop — separate static in-scene visual QA backdrop.

This script builds geometry and PBR materials from scratch. NO assets, geometry,
textures, palettes or models from the original LBA game are used.

Run:
 blender -b --python pipeline/blender/render_workshop.py -- --out /tmp/v7-workshop

Outputs: background.png, foreground.png (desk rim occlusion), layout.json.
These are review assets, NOT finalized production rooms.
"""
from __future__ import annotations
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

def mat(name,color,metal=0.0,rough=.58,emit=None):
 m=bpy.data.materials.new(name)
 m.diffuse_color=(*color,1)
 m.use_nodes=True
 p=m.node_tree.nodes.get("Principled BSDF")
 p.inputs["Base Color"].default_value=(*color,1)
 p.inputs["Metallic"].default_value=metal
 p.inputs["Roughness"].default_value=rough
 if emit:
  e=p.inputs.get("Emission Color") or p.inputs.get("Emission")
  s=p.inputs.get("Emission Strength")
  if e:e.default_value=(*emit[0],1)
  if s:s.default_value=emit[1]
 return m

def block(name,pos,size,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
 ob=bpy.context.object;ob.name=name;ob.dimensions=size
 ob.data.materials.append(material)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  m=ob.modifiers.new("Machined edges","BEVEL")
  m.width=bevel;m.segments=3
  bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=m.name)
  n=ob.modifiers.new("Weighted surface normals","WEIGHTED_NORMAL")
  bpy.ops.object.modifier_apply(modifier=n.name)
 return ob

def tube(name,pos,radius,depth,material,rotation=(0,0,0)):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth,location=pos,rotation=rotation)
 ob=bpy.context.object;ob.name=name;ob.data.materials.append(material)
 return ob

def area(name,loc,power,color,size,target):
 bpy.ops.object.light_add(type="AREA",location=loc)
 obj=bpy.context.object;obj.name=name;obj.data.energy=power;obj.data.color=color
 obj.data.shape="DISK";obj.data.size=size
 obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()

def main():
 a=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
 p=argparse.ArgumentParser()
 p.add_argument("--out",required=True,type=Path)
 args=p.parse_args(a)
 out=args.out.resolve();out.mkdir(parents=True,exist_ok=True)
 bpy.ops.object.select_all(action="SELECT")
 bpy.ops.object.delete(use_global=False)
 floor=mat("Original slate blue composite floor",(.14,.235,.30),.08,.84)
 floor_alt=mat("Original brushed floor seam",(.08,.17,.21),.3,.68)
 wall=mat("Original workshop warm grey ceramic",(.45,.53,.55),.05,.81)
 wall_dark=mat("Original acoustic wall panel",(.15,.29,.35),.05,.78)
 edge=mat("Original black coated structural profile",(.06,.10,.13),.6,.35)
 copper=mat("Original copper trim",(.70,.35,.14),.74,.38)
 yellow=mat("Original warm birch desktop",(.58,.39,.24),.08,.64)
 desktop=mat("Original charcoal desk mat",(.095,.14,.18),.05,.78)
 glass=mat("Original teal signal monitor",(.014,.13,.17),.1,.21,((.02,.65,.69),.7))
 bright=mat("Original warm instrument labels",(.78,.79,.68),0,.8)
 light=mat("Original LED status dots",(.10,.70,.55),.1,.5,((.04,.82,.65),2.0))
 accent=mat("Original orange ceramic insulator",(.85,.32,.12),.25,.45)

 # Modular architectural environment, modelled in Blender, not tiled Canvas polygons.
 block("Raised monolithic platform",(0,0,-.20),(7.0,7.0,.40),floor,.07)
 for i in range(-3,4):
  block("Real cut-floor seam X "+str(i),(i,0,.005),(.018,6.84,.005),floor_alt)
  block("Real cut-floor seam Y "+str(i),(0,i,.005),(6.84,.018,.005),floor_alt)
 for i in range(7):
  # Braided anti-slip detail, not a downloaded texture.
  block("Long antislip floor inlay "+str(i),(-3+i,2.85,.012),(.54,.028,.006),copper,.003)

 # Two sculpted rear walls, open front to the viewer; plus structural frames.
 block("X back wall",(-3.43,0,1.84),(.15,6.8,3.66),wall,.04)
 block("Y back wall",(0,-3.43,1.84),(6.8,.15,3.66),wall,.04)
 block("Rear wall baseboard",(-3.31,0,.20),(.13,6.8,.24),edge,.025)
 block("Rear wall baseboard two",(0,-3.31,.20),(6.8,.13,.24),edge,.025)
 block("Structural back corner upright",(-3.24,-3.24,1.85),(.15,.15,3.50),edge,.03)
 for n in range(4):
  block("Wall slat vertical "+str(n),(-3.32,-2.65+n*1.7,2.14),(.035,.065,1.66),wall_dark,.01)
  block("Wall slat horizontal "+str(n),(-2.65+n*1.7,-3.32,2.15),(.065,.035,1.25),wall_dark,.01)
 # Original illustration of illuminated wall strip and workshop power tray.
 block("Upper workshop display panel",(-1.5,-3.23,2.75),(2.35,.13,.64),edge,.045)
 block("Signal schematic glass",(-1.5,-3.305,2.75),(2.10,.02,.48),glass,.016)
 for n in range(7):
  block("Wall signal indicator "+str(n),(-2.38+n*.28,-3.33,2.7+(n%3)*.055),(.15,.018,.015),light,.004)
 block("Conduit along X",(-3.23,-.1,1.6),(.05,5.4,.07),copper,.008)
 # Power supply shelf above desk, with actual extruded instruments.
 block("Rear wall instrument shelf",(-.38,-2.56,1.80),(3.95,.75,.12),edge,.03)
 for n in range(3):
  x=-1.8+n*1.15
  block("Instrumentation control shell "+str(n),(x,-2.55,2.10),(.92,.61,.47),edge,.045)
  block("Original panel face "+str(n),(x,-2.222,2.10),(.74,.014,.31),glass,.016)
  for i in range(3):
   tube("Original shelf dial "+str(n)+" "+str(i),(x-.24+i*.24,-2.235,1.98),.034,.03,copper,(math.pi/2,0,0))

 # Workshop bench: real feet, table structure, inset rubber work mat, brushed edge.
 bench_x,bench_y=.36,.38
 for x in (-1.10,1.80):
  for y in (-.42,1.16):
   block("Bolted aluminium bench leg",(x,y,.58),(.13,.13,1.16),edge,.025)
 block("Crossbar under workbench",(bench_x,.37,.58),(3.15,.11,.12),edge,.02)
 block("Crossbar under workbench along Y",(.36,.37,.55),(.1,1.75,.12),edge,.02)
 block("Rich birch worktop",(bench_x,bench_y,1.17),(3.30,2.15,.16),yellow,.038)
 block("Inset charcoal ESD mat",(.30,.30,1.264),(2.55,1.50,.022),desktop,.045)
 for i in range(4):
  # desk mat stitched linear edging at native resolution
  block("ESD table copper edge stitch "+str(i),(-.77+i*.66,1.053,1.282),(.46,.016,.009),copper,.002)
 # Tool holders and a physical microscope shape: backs left of radio placement
 block("Solder station housing",(-.82,-.36,1.43),(.55,.49,.33),edge,.034)
 block("Copper front plate",(-.82,-.621,1.44),(.43,.025,.21),copper,.014)
 block("Instrument teal readout",(-.89,-.64,1.48),(.17,.012,.075),glass,.004)
 for n in range(3):
  tube("Solder station knob "+str(n),(-.66+n*.11,-.65,1.40),.032,.026,bright,(math.pi/2,0,0))
 # Mounted probe arm behind sample position.
 tube("Left oscilloscope stand",(-.8,.93,1.55),.047,.57,edge)
 block("Probe swivel link",(-.8,.86,1.88),(.58,.09,.085),edge,.033)
 tube("Antistatic probe housing",(-.57,.85,1.83),.075,.18,copper)
 # Parts bins: small, physically inset.
 for n in range(3):
  x=1.22+n*.25
  block("Small electronics storage bin "+str(n),(x,.85,1.37),(.20,.27,.20),wall_dark,.015)
  block("Storage label "+str(n),(x,1.0,1.4),(.12,.012,.035),bright,.003)
 # Physical high-grade bench power supply with display
 block("Service supply shell",(1.30,-.28,1.47),(.64,.49,.40),edge,.028)
 block("Service supply display",(1.30,-.54,1.51),(.43,.02,.18),glass,.014)
 for n in range(2):
  tube("Service knob "+str(n),(1.13+n*.35,-.553,1.37),.045,.03,bright,(math.pi/2,0,0))

 # Bench lip rendered again in a separate correctly aligned transparent pass:
 # its nearest visible edge can occlude the radio sprite locally.
 front_lip=[]
 front_lip.append(block("Foreground bench trim plus Y",(bench_x,1.47,1.105),(3.36,.09,.12),edge,.025))
 front_lip.append(block("Foreground bench brass line plus Y",(bench_x,1.522,1.123),(3.20,.018,.018),copper,.004))
 front_lip.append(block("Foreground bench trim plus X",(2.06,bench_y,1.105),(.09,2.14,.12),edge,.025))

 # Additional nearby floor apparatus, all our own parts.
 block("Left side instrument stand",(-2.30,.50,.65),(.57,.68,1.32),edge,.04)
 block("Original side panel",(-2.30, .86,.78),(.37,.015,.27),glass,.012)
 for n in range(3):
  tube("Instrument status light "+str(n),(-2.42+n*.12,.87,.57),.035,.04,light,(math.pi/2,0,0))
 block("Service side storage chest",(2.3,-1.35,.45),(.90,.95,.90),wall_dark,.045)
 for z in (.26,.53,.78):
  block("Drawer face "+str(z),(2.3,-.866,z),(.76,.045,.17),edge,.015)
  block("Drawer pull "+str(z),(2.30,-.837,z),(.18,.028,.025),bright,.005)

 scene=bpy.context.scene
 bpy.ops.object.camera_add()
 camera=bpy.context.object
 camera.name="V7 fixed orthographic workshop camera"
 camera.data.type="ORTHO"
 camera.data.ortho_scale=8.5
 camera.location=(10.7,11.4,11.0)
 camera.rotation_euler=(Vector((0,0,1.34))-camera.location).to_track_quat("-Z","Y").to_euler()
 scene.camera=camera
 area("Soft warm workshop key",(1,5.5,9),1650,(1.0,.83,.70),5.6,(0,0,1))
 area("Cool wall bounce",(-4.0,1.0,6.0),760,(.68,.83,1.0),5.5,(0,0,1))
 area("Back rim strip",(2.5,-4.0,7.2),850,(.88,.97,1.0),4.0,(0,0,1))
 world=bpy.data.worlds.new("Original workshop neutral environment")
 scene.world=world;world.use_nodes=True
 world.node_tree.nodes["Background"].inputs["Color"].default_value=(.26,.32,.38,1)
 world.node_tree.nodes["Background"].inputs["Strength"].default_value=.36
 scene.render.engine="CYCLES"
 scene.cycles.device="CPU"
 scene.cycles.samples=24
 scene.cycles.use_denoising=False
 scene.render.film_transparent=True
 scene.render.resolution_x=960
 scene.render.resolution_y=640
 scene.render.resolution_percentage=100
 scene.render.image_settings.file_format="PNG"
 scene.render.image_settings.color_mode="RGBA"
 scene.render.image_settings.color_depth="8"
 scene.view_settings.view_transform="Standard"
 scene.view_settings.look="Medium High Contrast"

 sample_loc=Vector((bench_x,.35,1.28))
 cam=world_to_camera_view(scene,camera,sample_loc)
 target=(round(cam.x*960,2),round((1-cam.y)*640,2))
 assert 160<target[0]<800 and 110<target[1]<600,(target,cam)
 scene.render.filepath=str(out/"background.png")
 bpy.ops.render.render(write_still=True)

 keep={x.name for x in front_lip}
 for item in bpy.data.objects:
  if item.type=="MESH":item.hide_render=item.name not in keep
 # Preserve EXACT camera, lights, materials, color transform, output.
 scene.render.filepath=str(out/"foreground.png")
 bpy.ops.render.render(write_still=True)
 for item in bpy.data.objects:
  if item.type=="MESH":item.hide_render=False

 meta={
  "schemaVersion":1,"source":"original-v7-blender-workshop",
  "reviewStatus":"pending-artistic-review","approvedForPortfolio":False,
  "width":960,"height":640,
  "view":"original isometric, fixed camera",
  "anchor":list(target),"spriteSource":"../compare/256px-lanczos-160.png",
  "defaultFrame":"ne","spritePixels":256,
  "defaultScale":0.75,
  "sampleWorldPosition":[bench_x,.35,1.28],
  "depthLayers":["background.png","radio sprite from V5","foreground.png"],
  "manualReviewRequired":["sprite scale and table contact","light consistency","depth order","contact shadows","material readability","mobile fidelity"]
 }
 (out/"layout.json").write_text(json.dumps(meta,indent=2)+"\n",encoding="utf8")
 print("V7 original workshop renders complete. Desk anchor pixels:",target)

if __name__=="__main__":main()
