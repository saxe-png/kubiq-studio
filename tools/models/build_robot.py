"""Turn a posed robot-hand OBJ (from mj_export.py) into a web-ready GLB.
Welds vertices, decimates, optionally adds a procedural forearm, bakes AO, exports.
Materials are reduced to three named slots the website styles itself: body / accent / pad.
"""
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from bl_common import *

a = sys.argv[sys.argv.index("--")+1:]
src, out_glb, out_png, target_tris, add_forearm = a[0], a[1], a[2], int(a[3]), a[4] == "1"
MATMAP = {"black": "body", "silver": "body", "white": "body", "default": "body", "gray": "accent", "metallic": "accent", "green": "pad"}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=src, forward_axis='Y', up_axis='Z')
objs = [o for o in bpy.data.objects if o.type == 'MESH']
mats = {n: bpy.data.materials.new(n) for n in ("body", "accent", "pad")}
for o in objs:
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-5)
    bm.to_mesh(o.data); bm.free()
    o.data.materials.clear(); o.data.materials.append(mats[MATMAP.get(o.name.split('.')[0], "body")])

def make_forearm():
    co = np.concatenate([np.array([o.matrix_world @ v.co for v in o.data.vertices]) for o in objs])
    xmax = co[:, 0].max(); fl = co[co[:, 0] > xmax - 0.012]
    cy, cz = (fl[:, 1].max() + fl[:, 1].min()) / 2, (fl[:, 2].max() + fl[:, 2].min()) / 2
    ry, rz = (fl[:, 1].max() - fl[:, 1].min()) / 2, (fl[:, 2].max() - fl[:, 2].min()) / 2
    r0 = (ry + rz) / 2
    print("FLANGE x", round(xmax, 3), "c", round(cy, 3), round(cz, 3), "ry rz", round(ry, 3), round(rz, 3))
    # (dx, radius factor, material)
    prof = [(-0.006, 0.55, "accent"), (0.020, 0.55, "accent"), (0.020, 0.80, "accent"), (0.026, 0.80, "accent"), (0.026, 0.55, "accent"), (0.034, 0.55, "accent"),
            (0.034, 0.92, "body"), (0.040, 1.00, "body"), (0.120, 1.16, "body"), (0.123, 1.09, "accent"), (0.131, 1.09, "accent"), (0.134, 1.18, "body"),
            (0.300, 1.36, "body"), (0.303, 1.29, "accent"), (0.311, 1.29, "accent"), (0.314, 1.38, "body"), (0.620, 1.50, "body")]
    seg = 56; bm = bmesh.new(); rings = []
    for dx, k, _ in prof:
        mix = min(max(dx / 0.25, 0), 1)                       # ellipse at the wrist -> round further up
        ay = (ry * (1 - mix) + r0 * mix) * k; az = (rz * (1 - mix) + r0 * mix) * k
        rings.append([bm.verts.new((xmax + dx, cy + ay * math.cos(2 * math.pi * i / seg), cz + az * math.sin(2 * math.pi * i / seg))) for i in range(seg)])
    me = bpy.data.meshes.new("forearm")
    for n in ("body", "accent"): me.materials.append(mats[n])
    for r in range(len(rings) - 1):
        mi = 1 if prof[r][2] == "accent" else 0
        for i in range(seg):
            f = bm.faces.new((rings[r][i], rings[r][(i + 1) % seg], rings[r + 1][(i + 1) % seg], rings[r + 1][i])); f.material_index = mi
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("forearm", me); bpy.context.scene.collection.objects.link(o); return o

tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
ratio = min(1.0, target_tris / tris)
if ratio < 0.98:
    for o in objs:
        md = o.modifiers.new("dec", 'DECIMATE'); md.ratio = ratio
fore = make_forearm() if add_forearm else None
allobjs = objs + ([fore] if fore else [])
bpy.ops.object.select_all(action='DESELECT')
for o in allobjs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
hand = bpy.context.view_layer.objects.active; hand.name = "hand_robot"
me = hand.data
for p in me.polygons: p.use_smooth = True
me.set_sharp_from_angle(angle=math.radians(38))
print("FINAL tris", sum(len(p.vertices) - 2 for p in me.polygons), "verts", len(me.vertices), "mats", [m.name for m in me.materials])
bake_ao(hand, samples=48)
bpy.ops.object.select_all(action='DESELECT'); hand.select_set(True); bpy.context.view_layer.objects.active = hand
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_texcoords=False,
                          export_normals=True, export_materials='EXPORT', export_animations=False, export_skins=False,
                          export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True)
print("GLB", out_glb, os.path.getsize(out_glb))
cols = {"body": ((0.06, 0.06, 0.07, 1), 0.25, 0.9), "accent": ((0.8, 0.8, 0.85, 1), 0.3, 0.9), "pad": ((0.3, 0.3, 0.32, 1), 0.6, 0.0)}
for n, (c, r, mt) in cols.items():
    m = mats[n]; m.use_nodes = True; b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = c; b.inputs["Roughness"].default_value = r; b.inputs["Metallic"].default_value = mt
render_views([hand], out_png, views=(("screen", (0, -1, 0)), ("roll35", (0, -0.82, 0.57)), ("top", (0, 0, 1)), ("iso", (-1, -1, 0.8))))
