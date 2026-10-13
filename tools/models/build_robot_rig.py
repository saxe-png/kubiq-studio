"""Build the articulated robot hand (rig from mj_rig_export.py) with a procedurally modelled
mechanical forearm, bake ambient occlusion and export a Draco-compressed GLB plus a small JSON
that tells the website which node is which joint.

The GLB keeps Blender's Z-up axes (export_yup=False) so joint axes can be used as they are;
the website rotates the whole model once.
"""
import bpy, bmesh, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion
sys.path.insert(0, os.path.dirname(__file__))
from bl_common import *

a = sys.argv[sys.argv.index("--")+1:]
base, out_glb, out_json, out_png, ratio = a[0], a[1], a[2], a[3], float(a[4])
rig = json.load(open(base + ".json"))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.wm.obj_import(filepath=base + ".obj", forward_axis='Y', up_axis='Z')
parts = {o.name.split('.')[0]: o for o in bpy.data.objects if o.type == 'MESH'}
mats = {n: bpy.data.materials.new(n) for n in ("body", "accent", "pad", "light")}

def mat_for(g):
    mesh = g["mesh"].lower()
    if "elastomer" in mesh: return "pad"
    if "_vl" in mesh or "_mp_" in mesh: return "accent"       # joint blocks and middle phalanges: bare metal
    return "body"

# ---- hierarchy: one empty per body, canonical frame applied at the base ------------------------
root = bpy.data.objects.new("robot", None); sc.collection.objects.link(root)
C = Matrix(rig["canon"]); emp = {}; rest = {}
for b in rig["bodies"]:
    e = bpy.data.objects.new("J_" + b["name"], None); e.empty_display_size = 0.01; e.rotation_mode = 'QUATERNION'
    sc.collection.objects.link(e)
    e.parent = emp[b["parent"]] if b["parent"] else root; e.matrix_parent_inverse = Matrix.Identity(4)
    local = Matrix.Translation(b["pos"]) @ Quaternion(b["quat"]).to_matrix().to_4x4()
    if not b["parent"]: local = C @ local
    e.matrix_local = local; rest[b["name"]] = local.copy(); emp[b["name"]] = e
jbody = {}
for j in rig["joints"]:
    assert j["body"] not in jbody, "more than one joint on a body"
    jbody[j["body"]] = j
def apply_pose(pose):
    for b in rig["bodies"]:
        j = jbody.get(b["name"]); M = rest[b["name"]]
        if j:
            lo, hi = j["range"]; q = min(max(pose.get(j["name"], 0.0), lo), hi); jp = Vector(j["pos"])
            M = M @ Matrix.Translation(jp) @ Quaternion(Vector(j["axis"]), q).to_matrix().to_4x4() @ Matrix.Translation(-jp)
        emp[b["name"]].matrix_local = M
    bpy.context.view_layer.update()

# ---- hand parts: weld, material, decimate, one mesh per body -----------------------------------
by_body = {}
for g in rig["geoms"]:
    o = parts[g["obj"]]
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-5); bm.to_mesh(o.data); bm.free()
    o.data.materials.clear(); o.data.materials.append(mats[mat_for(g)])
    if ratio < 0.98:
        md = o.modifiers.new("dec", 'DECIMATE'); md.ratio = ratio
    by_body.setdefault(g["body"], []).append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in parts.values(): o.select_set(True)
bpy.context.view_layer.objects.active = next(iter(parts.values()))
bpy.ops.object.convert(target='MESH')
hand_meshes = []
for body, objs in by_body.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = "M_" + body
    o.parent = emp[body]; o.matrix_parent_inverse = Matrix.Identity(4); o.matrix_local = Matrix.Identity(4)
    hand_meshes.append(o)
tip = bpy.data.objects.new("tip", None); tip.empty_display_size = 0.005; sc.collection.objects.link(tip)
tip.parent = emp[rig["tip"]["body"]]; tip.matrix_parent_inverse = Matrix.Identity(4); tip.matrix_local = Matrix.Translation(rig["tip"]["local"])
bpy.context.view_layer.update()

# ---- mechanical forearm (static, modelled from primitives) ------------------------------------
palm = next(o for o in hand_meshes if o.name == "M_" + rig["bodies"][0]["name"])
pw = np.array([palm.matrix_world @ v.co for v in palm.data.vertices])
X0 = pw[:, 0].max(); fl = pw[pw[:, 0] > X0 - 0.012]
CY, CZ = (fl[:, 1].max() + fl[:, 1].min()) / 2, (fl[:, 2].max() + fl[:, 2].min()) / 2
RY, RZ = (fl[:, 1].max() - fl[:, 1].min()) / 2, (fl[:, 2].max() - fl[:, 2].min()) / 2
print("FLANGE x", round(X0, 3), "c", round(CY, 3), round(CZ, 3), "ry rz", round(RY, 3), round(RZ, 3))
fore = []
def finish(name, bm, mat):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mats[mat])
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); fore.append(o); return o
def ring_pts(x, r, seg, sy=1.0, sz=1.0):
    return [(x, CY + r * sy * math.cos(2 * math.pi * i / seg), CZ + r * sz * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
def lathe(name, profile, mat, seg=48, sy=1.0, sz=1.0, cap=True):
    """profile = [(dx, radius), ...] measured from the wrist flange"""
    bm = bmesh.new(); rings = [[bm.verts.new(p) for p in ring_pts(X0 + dx, r, seg, sy, sz)] for dx, r in profile]
    for a_, b_ in zip(rings, rings[1:]):
        for i in range(seg): bm.faces.new((a_[i], a_[(i + 1) % seg], b_[(i + 1) % seg], b_[i]))
    if cap:
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    return finish(name, bm, mat)
def rod(name, p0, p1, r, mat, seg=14):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=d.length)
    M = Matrix.Translation((p0 + p1) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts); return finish(name, bm, mat)
def ball(name, c, r, mat, seg=20):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(c)); return finish(name, bm, mat)
def torus(name, dx, R, r, mat, seg=56, tseg=10):
    bm = bmesh.new(); vs = []
    for i in range(seg):
        A = 2 * math.pi * i / seg; row = []
        for j in range(tseg):
            Bn = 2 * math.pi * j / tseg; rad = R + r * math.cos(Bn)
            row.append(bm.verts.new((X0 + dx + r * math.sin(Bn), CY + rad * math.cos(A), CZ + rad * math.sin(A))))
        vs.append(row)
    for i in range(seg):
        for j in range(tseg):
            bm.faces.new((vs[i][j], vs[(i + 1) % seg][j], vs[(i + 1) % seg][(j + 1) % tseg], vs[i][(j + 1) % tseg]))
    return finish(name, bm, mat)
def polar(dx, r, deg): t = math.radians(deg); return (X0 + dx, CY + r * math.cos(t), CZ + r * math.sin(t))
def panel(name, dx0, dx1, r0, r1, a0, a1, mat, thick=0.0042, seg_x=8):
    """curved armour plate covering angles a0..a1 (degrees around the arm), with thickness and rounded edges"""
    seg_a = max(6, int((a1 - a0) / 7)); bm = bmesh.new(); grid = []
    for i in range(seg_x + 1):
        u = i / seg_x; row = []
        for j in range(seg_a + 1):
            row.append(bm.verts.new(polar(dx0 + (dx1 - dx0) * u, r0 + (r1 - r0) * u, a0 + (a1 - a0) * j / seg_a)))
        grid.append(row)
    for i in range(seg_x):
        for j in range(seg_a): bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    o = finish(name, bm, mat)
    so = o.modifiers.new("solid", 'SOLIDIFY'); so.thickness = thick; so.offset = -1
    bv = o.modifiers.new("bevel", 'BEVEL'); bv.width = 0.0011; bv.segments = 2; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(50)
    return o
def block(name, dx, r, deg, size, mat, bevel=0.0006):
    """small box sitting on the shell: size = (along arm, around arm, radial height)"""
    t = math.radians(deg); er = Vector((0, math.cos(t), math.sin(t))); et = Vector((0, -math.sin(t), math.cos(t))); ex = Vector((1, 0, 0))
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    M = Matrix.Translation(Vector(polar(dx, r, deg))) @ Matrix((ex * size[0], et * size[1], er * size[2])).transposed().to_4x4()
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts); o = finish(name, bm, mat)
    if bevel:
        bv = o.modifiers.new("bevel", 'BEVEL'); bv.width = bevel; bv.segments = 2
    return o
def cable(name, pts, radius, mat):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 2; cu.resolution_u = 8
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts): p.co = (*co, 1.0)
    sp.use_endpoint_u = True; sp.order_u = 4
    cu.materials.append(mats[mat]); o = bpy.data.objects.new(name, cu); sc.collection.objects.link(o); fore.append(o); return o

R = 0.031
# wrist: adapter plate, neck, polished ball in a socket ring, three linkage rods
lathe("wrist_plate", [(-0.004, 0.86), (0.007, 0.86)], "body", sy=RY, sz=RZ)
lathe("wrist_neck", [(0.007, 0.015), (0.024, 0.015)], "accent", seg=32)
ball("wrist_ball", polar(0.036, 0, 0), 0.0195, "accent", seg=28)
torus("wrist_socket", 0.043, 0.0215, 0.0062, "body")
for k, deg in enumerate((95, 215, 335)):
    p0 = polar(0.006, 0.6 * min(RY, RZ) + 0.004, deg); p1 = polar(0.082, 0.0235, deg + 8)
    rod(f"link_{k}", p0, p1, 0.0027, "accent"); ball(f"link_a{k}", p0, 0.0046, "accent", seg=14); ball(f"link_b{k}", p1, 0.0046, "accent", seg=14)
# inner core and four actuator pistons
lathe("core", [(0.05, 0.011), (0.70, 0.011)], "pad", seg=28)
for k, deg in enumerate((168, 214, 20, 80)):
    PR = 0.0195
    rod(f"piston_rod{k}", polar(0.052, PR, deg), polar(0.102, PR, deg), 0.0032, "accent")
    ball(f"piston_eye{k}", polar(0.052, PR, deg), 0.0048, "accent", seg=14)
    rod(f"piston_sleeve{k}", polar(0.098, PR, deg), polar(0.215, PR, deg), 0.0062, "body", seg=18)
    rod(f"piston_collar{k}", polar(0.096, PR, deg), polar(0.103, PR, deg), 0.0076, "accent", seg=18)
    rod(f"piston_tail{k}", polar(0.212, PR, deg), polar(0.222, PR, deg), 0.0076, "accent", seg=18)
# cables running along the core
for k, (deg, sw) in enumerate(((190, 14), (238, -12), (150, 10), (300, 16))):
    pts = [polar(0.03 + 0.37 * i / 11, 0.0155 + 0.003 * math.sin(i * 1.3 + k), deg + sw * math.sin(i * 0.9 + k * 2)) for i in range(12)]
    cable(f"cable_{k}", pts, 0.002 if k % 2 else 0.0026, "pad")
# armour: cuff (two plates), main shell (three plates) with a window towards the viewer, rear tube
panel("cuff_top", 0.078, 0.166, R + 0.002, R + 0.006, 28, 152, "body")
panel("cuff_bottom", 0.078, 0.166, R + 0.002, R + 0.006, 232, 388, "body")
torus("ring_a", 0.172, R + 0.004, 0.0034, "accent")
panel("shell_top", 0.182, 0.345, R + 0.007, R + 0.012, 34, 158, "body")
panel("shell_bottom", 0.182, 0.345, R + 0.007, R + 0.012, 206, 318, "body")
panel("shell_back", 0.196, 0.331, R + 0.006, R + 0.011, 326, 386, "accent", thick=0.003)
torus("ring_b", 0.352, R + 0.011, 0.004, "accent")
lathe("rear", [(0.36, R + 0.008), (0.366, R + 0.012), (0.50, R + 0.014), (0.503, R + 0.0105), (0.511, R + 0.0105), (0.514, R + 0.015), (0.70, R + 0.016)], "body", seg=56, cap=False)
# details: light bar, status dots, vents, bolts
block("light_bar", 0.262, R + 0.0106, 118, (0.118, 0.0042, 0.0022), "light", bevel=0.0005)
for i in range(3): block(f"dot_{i}", 0.092 + i * 0.012, R + 0.0048, 128, (0.0052, 0.0052, 0.002), "light", bevel=0.0008)
for i in range(6): block(f"vent_{i}", 0.205 + i * 0.019, R + 0.0098, 60, (0.011, 0.026, 0.0016), "pad", bevel=0.0005)
for dx, r in ((0.086, R + 0.0036), (0.158, R + 0.0066)):
    for deg in (36, 144, 240, 380): block(f"bolt_c{dx}_{deg}", dx, r, deg, (0.0046, 0.0046, 0.0022), "accent", bevel=0.001)
for dx, r in ((0.192, R + 0.0086), (0.335, R + 0.0126)):
    for deg in (42, 150, 214, 310): block(f"bolt_s{dx}_{deg}", dx, r, deg, (0.0046, 0.0046, 0.0022), "accent", bevel=0.001)

bpy.ops.object.select_all(action='DESELECT')
for o in fore: o.select_set(True)
bpy.context.view_layer.objects.active = fore[0]
bpy.ops.object.convert(target='MESH'); bpy.ops.object.join()
forearm = bpy.context.view_layer.objects.active; forearm.name = "M_forearm"; forearm.parent = root
for o in hand_meshes + [forearm]:
    for p in o.data.polygons: p.use_smooth = True
    o.data.set_sharp_from_angle(angle=math.radians(36))

# ---- ambient occlusion baked in the reference pose --------------------------------------------
apply_pose(rig["poses"]["rest"])
print("TIP in reference pose (should be ~0):", [round(v, 4) for v in tip.matrix_world.translation])
for m in mats.values(): m.use_nodes = True
for o in hand_meshes + [forearm]: bake_ao(o, samples=32, floor=0.22)
tris = sum(len(p.vertices) - 2 for o in hand_meshes + [forearm] for p in o.data.polygons)
print("TRIS hand+forearm", tris, "forearm", sum(len(p.vertices) - 2 for p in forearm.data.polygons), "objects", len(hand_meshes) + 1)

# ---- preview, then export in the zero pose ------------------------------------------------------
cols = {"body": ((0.03, 0.03, 0.035, 1), 0.22, 1.0), "accent": ((0.75, 0.75, 0.78, 1), 0.25, 1.0), "pad": ((0.09, 0.09, 0.09, 1), 0.7, 0.0), "light": ((1, 1, 1, 1), 0.4, 0.0)}
for n, (c, r_, mt) in cols.items():
    b = mats[n].node_tree.nodes.get("Principled BSDF"); b.inputs["Base Color"].default_value = c; b.inputs["Roughness"].default_value = r_; b.inputs["Metallic"].default_value = mt
    if n == "light": b.inputs["Emission Color"].default_value = (1, 1, 1, 1); b.inputs["Emission Strength"].default_value = 3
render_views(hand_meshes + [forearm], out_png, views=(("screen", (0, -1, 0)), ("roll25", (0, -0.9, 0.42)), ("top", (0, 0, 1)), ("iso", (-1, -1, 0.8))), res=900)
apply_pose({})
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_yup=False, export_apply=True, export_texcoords=False,
                          export_normals=True, export_materials='EXPORT', export_animations=False, export_skins=False,
                          export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_color_quantization=8)
print("GLB", out_glb, os.path.getsize(out_glb))
json.dump(dict(root="robot", tip="tip",
               joints={j["name"]: dict(node="J_" + j["body"], axis=j["axis"], pos=j["pos"], range=j["range"]) for j in rig["joints"]},
               poses=rig["poses"]), open(out_json, "w"), indent=1)
print("JSON", out_json)
