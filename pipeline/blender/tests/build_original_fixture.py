"""V3 ORIGINAL golden sample: compact telemetry receiver with actual 3D detail.

Generated from zero-owned procedural geometry and PBR materials.
This produces a GLB source fixture and DOES NOT imply visual/art approval.
"""
import math,sys
from pathlib import Path
import bpy

output=Path(sys.argv[sys.argv.index("--")+1]).resolve()
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def pbr(name,base,roughness=0.5,metallic=0.0,emission=None):
    m=bpy.data.materials.new(name);m.diffuse_color=(*base,1)
    m.use_nodes=True
    shader=m.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value=(*base,1)
    shader.inputs["Roughness"].default_value=roughness
    shader.inputs["Metallic"].default_value=metallic
    if emission:
        # Blender version-specific emission sockets
        input_color=shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        input_strength=shader.inputs.get("Emission Strength")
        if input_color:input_color.default_value=(*emission[0],1)
        if input_strength:input_strength.default_value=emission[1]
    return m

case=pbr("Atlas original powder-coated marine enamel",(0.11,0.23,0.30),.45,.35)
case_side=pbr("Atlas case dark side panels",(0.07,0.14,0.18),.49,.25)
alloy=pbr("Atlas brushed bead-blasted aluminium",(.57,.68,.73),.32,.82)
rubber=pbr("Atlas matte graphite elastomer",(.025,.045,.055),.84,.0)
brass=pbr("Atlas satin brass connectors",(.71,.42,.18),.32,.72)
orange=pbr("Atlas safety orange",(.85,.31,.12),.48,.22)
screen=pbr("Atlas recessed glass face",(.018,.065,.075),.16,.18)
teal=pbr("Atlas cyan phosphor",(.07,.79,.69),.36,.1,((.03,.85,.77),1.6))
ivory=pbr("Atlas warm silkscreen",(.67,.77,.65),.71,.0)
dark=pbr("Atlas recessed ventilation slots",(.018,.037,.045),.9,.0)

def beveled(name,position,dimensions,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=position)
    obj=bpy.context.object;obj.name=name
    obj.dimensions=dimensions;obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel>0:
        mod=obj.modifiers.new("Manufactured rounded edges","BEVEL")
        mod.width=bevel;mod.segments=3
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=obj.modifiers.new("Weighted manufactured normals","WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def rod(name,position,radius,depth,mat,rotation=(0,0,0),vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,
                                        location=position,rotation=rotation)
    obj=bpy.context.object;obj.name=name;obj.data.materials.append(mat)
    bevel=obj.modifiers.new("Cut edge highlights","BEVEL")
    bevel.width=min(radius*.12,depth*.13);bevel.segments=2
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.modifiers.new("Weighted normals","WEIGHTED_NORMAL")
    return obj

FRONT=(math.pi/2,0,0)
# Main 1.72 x 1.08 x 0.78 case; orientation intentionally asymmetrical.
beveled("Rugged sealed receiver enclosure",(0,0,.54),(1.75,1.07,.84),case,.085)
beveled("Upper roof service plate",(.0,.01,1.00),(1.55,.92,.11),case_side,.034)
beveled("Rear service block",(.10,.56,.55),(1.32,.10,.63),case_side,.02)
# Distinct corner protective pads.
for x in (-.82,.82):
    for z in (.26,.87):
        beveled("Corner shock bumper", (x,-.06,z),(.17,1.13,.17),rubber,.055)
# Machined faceplate and display with true layered depth.
beveled("Inset front aluminium bezel",(-.22,-.558,.59),(1.08,.078,.55),alloy,.045)
beveled("Black display gasket",(-.22,-.607,.60),(.91,.055,.39),rubber,.03)
beveled("Deep recessed OLED display",(-.22,-.641,.60),(.81,.018,.30),screen,.022)
# Line waveform, bargraph, asymmetric on-screen controls.
wave=[(-.53,.53),(-.43,.56),(-.34,.51),(-.26,.68),(-.17,.63),(-.08,.76),(.04,.72),(.13,.78)]
for i in range(len(wave)-1):
    (x0,z0),(x1,z1)=wave[i],wave[i+1]
    dist=math.hypot(x1-x0,z1-z0)
    bpy.ops.mesh.primitive_cube_add(size=1,location=((x0+x1)/2,-.657,(z0+z1)/2))
    o=bpy.context.object;o.name="Original display waveform segment";o.dimensions=(dist,.008,.014)
    o.rotation_euler[1]=-math.atan2(z1-z0,x1-x0)
    o.data.materials.append(teal)
for i in range(4):
    beveled("Original signal strength pixel",(-.56+i*.087,-.656,.46+i*.03),
           (.054,.01,.03),teal,.004)
# Physical controls on front right, offset and strongly extruded.
for i,(x,z) in enumerate([(.51,.70),(.67,.56),(.51,.42)]):
    beveled("Rubber button collar "+str(i),(x,-.577,z),(.17,.10,.13),rubber,.025)
    beveled("Orange or ivory push button "+str(i),(x,-.642,z),(.11,.075,.09),orange if i==0 else ivory,.02)
# Two front circular connectors with real concavity from layered ring and dark well.
for i,x in enumerate((-.49,-.17)):
    rod("Brass receiver port rim "+str(i),(x,-.607,.23),.073,.085,brass,FRONT)
    rod("Black port well "+str(i),(x,-.665,.23),.047,.018,screen,FRONT)
    rod("Silver coax pin "+str(i),(x,-.681,.23),.010,.02,alloy,FRONT)
# Side panel : knurled dial with ridges, positive depth.
beveled("Control side bracket",(.88,-.05,.54),(.075,.65,.60),rubber,.018)
for i,z in enumerate((.44,.76)):
    rod("Side tuning knob "+str(i),(.975,-.25,z),.112,.16,brass,(0,math.pi/2,0))
    for n in range(12):
        theta=n*math.tau/12
        beveled("Knurl "+str(i)+"."+str(n),
                (1.073,-.25+math.sin(theta)*.088,z+math.cos(theta)*.088),
                (.02,.027,.018),alloy,.004)
# Rear heatsink with alternating relief.
for i in range(7):
    beveled("Rear anodized radiator fin "+str(i),(-.54+i*.18,.636,.65),
            (.062,.10,.47),alloy,.017)
# Top heavy-duty carrying handle: two supports and upper curved-looking grip.
for x in (-.43,.30):
    beveled("Carry handle mount "+str(x),(x,.28,1.13),(.13,.12,.22),alloy,.02)
beveled("Protective carry grip",(-.07,.29,1.30),(.94,.23,.15),rubber,.065)
# Antenna offset left, with segmented copper + pale collars.
rod("Offset antenna base",(-.66,.32,1.15),.13,.22,alloy)
rod("Antenna brass swivel joint",(-.66,.32,1.31),.086,.17,brass)
rod("Extendable dark antenna mast",(-.66,.32,1.76),.038,.84,rubber)
rod("Copper antenna band",(-.66,.32,1.82),.052,.052,brass)
rod("Visible antenna termination",(-.66,.32,2.20),.067,.12,alloy)
# Discrete top connector and contrasting red warning mark.
rod("Secondary RF socket",(.60,.31,1.10),.09,.13,brass)
beveled("Top orange status telltale",(.50,-.26,1.07),(.17,.17,.045),orange,.025)
# Real fasteners and highlights on case and service plate.
for x in (-.71,.71):
    for z in (.20,.89):
        rod("Visible front screw head",(x,-.565,z),.039,.022,alloy,FRONT,24)
        beveled("Screw slot",(x,-.585,z),(.044,.009,.012),dark,.002)
# Add large manufacturer-independent color marking, not a trademark.
beveled("Primary safety stripe",(0,.545,.16),(1.25,.019,.055),orange,.006)
# Tiny silkscreen bars that survive downsampling, not text copied from any product.
for i in range(4):
    beveled("Original dial scale marker",(0.25+i*.11,-.558,.19),(.07,.013,.018),ivory,.003)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(output),export_format="GLB")
print("V3 original golden sample GLB",output,"objects",len(bpy.data.objects))
