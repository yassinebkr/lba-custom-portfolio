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

steel=material("Original anodized charcoal",(0.08,0.16,0.21),0.45)
copper=material("Original warm copper",(0.76,0.38,0.18),0.65)
glass=material("Original teal glass",(0.14,0.64,0.65),0.1)
silver=material("Original light alloy",(0.52,0.65,0.71),0.7)

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
cube("Inset instrument display",(0,-.555,.45),(.78,.06,.4),glass)
cube("Offset power module",(.48,.36,.86),(.48,.46,.28),copper)
cylinder("Antenna socket",(-.52,.30,.84),.13,.18,silver)
cylinder("Tall asymmetric antenna",(-.52,.30,1.45),.035,1.20,copper)
for i in range(4):
 cylinder("Antenna indicator "+str(i),(.64,-.62,.15+i*.13),.04,.06,glass if i%2 else copper)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(output),export_format="GLB")
print("Wrote original-source GLB",output)
