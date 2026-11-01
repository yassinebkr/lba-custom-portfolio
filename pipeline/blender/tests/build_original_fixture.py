"""Generate a completely ORIGINAL asymmetric 3D electronics test fixture in Blender.
This exercises multi-direction transforms only. NOT approved final art.
"""
import sys
from pathlib import Path
import bpy

output=Path(sys.argv[sys.argv.index("--")+1]).resolve()
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def material(name,color,metallic=0):
 m=bpy.data.materials.new(name)
 m.diffuse_color=(*color,1)
 m.use_nodes=True
 node=m.node_tree.nodes.get("Principled BSDF")
 node.inputs["Base Color"].default_value=(*color,1)
 node.inputs["Metallic"].default_value=metallic
 node.inputs["Roughness"].default_value=0.52
 return m

steel=material("Original anodized charcoal",(0.20,0.30,0.39),0.35)
copper=material("Original warm copper",(0.92,0.46,0.16),0.5)
glass=material("Original teal glass",(0.10,0.83,0.78),0.05)
silver=material("Original light alloy",(0.75,0.79,0.80),0.6)

def cube(name,location,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location)
 o=bpy.context.object;o.name=name;o.dimensions=scale
 o.data.materials.append(mat)
 return o

def cylinder(name,location,radius,depth,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=radius,depth=depth,location=location)
 o=bpy.context.object;o.name=name;o.data.materials.append(mat)
 return o

cube("Telemetry receiver housing",(0,0,.36),(1.6,1.08,.72),steel)
# A high-contrast field instrumentation face and recognisable operator controls.
black=material("Original display bezel",(0.025,0.045,0.07),0.12)
rubber=material("Original protective edge",(0.055,0.085,0.11),0.08)
cream=material("Original engraved screen markers",(0.85,0.94,0.75),0.0)
cube("Display contrasting dark border",(0,-.568,.47),(.96,.06,.54),black)
for i in range(3):
 cube("Monitor waveform segment "+str(i),(-.26+i*.20,-.605,.48+(i%2)*.07),(.14,.015,.018),cream)
for i in range(4):
 cube("Housing vent slot "+str(i),(-.51+i*.17,.548,.33),(.09,.035,.30),black)
for x in (-.69,.69):
 cube("Protective rubber foot "+str(x),(x,-.38,.1),(.12,.13,.21),rubber)
for i in range(2):
 cylinder("Detailed side control dial "+str(i),(.79,-.27+i*.33,.35),.105,.08,silver)
 cube("Control dial locator "+str(i),(.85,-.27+i*.33,.35),(.035,.16,.015),copper)
cube("Raised shoulder pad",(-.43,.37,.76),(.48,.30,.09),rubber)

cube("Inset instrument display",(0,-.619,.47),(.78,.06,.4),glass)
cube("Offset power module",(.48,.36,.86),(.48,.46,.28),copper)
cylinder("Antenna socket",(-.52,.30,.84),.13,.18,silver)
cylinder("Tall asymmetric antenna",(-.52,.30,1.45),.035,1.20,copper)
for i in range(4):
 cylinder("Antenna indicator "+str(i),(.64,-.62,.15+i*.13),.04,.06,glass if i%2 else copper)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(output),export_format="GLB")
print("Wrote original-source GLB",output)
