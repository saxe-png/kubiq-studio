"""Rig, pose and export the right arm of the CC0 'realistic male body' base mesh
(Blender Human Base Meshes bundle).

The body ships unrigged, but its sculpt face sets mark the upper arm, forearm, palm and
every finger phalanx. Joints are derived from the boundaries between those sets, an
armature is generated and bound to the low-poly cage, and the Armature modifier is placed
*before* Multires so the sculpted detail (level 3) follows the pose.

Output frame (Blender): right hand, forearm along +X (elbow at +X), fingers towards -X,
back of the hand +Z, thumb -Y, index fingertip at the origin.
"""
import bpy, bmesh, sys, os, json, math, collections
import numpy as np
from mathutils import Vector, Matrix, Quaternion
sys.path.insert(0, os.path.dirname(__file__))
from bl_common import *

args = sys.argv[sys.argv.index("--")+1:]
pose_path, out_glb, out_png = args[0], args[1], args[2]
POSE = json.load(open(pose_path))
PALM, FOREARM, UPPER = 10, 11, 20          # face sets of the character's right arm

src = bpy.data.objects["GEO-body_male_realistic"]
sc = bpy.context.scene
if src.name not in sc.collection.all_objects: sc.collection.objects.link(src)
src.hide_viewport = False; src.hide_select = False
try: src.hide_set(False)
except Exception: pass
for o in bpy.data.objects: o.hide_render = True
me = src.data
mr = next(m for m in src.modifiers if m.type == 'MULTIRES')
mr.levels = POSE.get("multires", mr.total_levels)

# ---- joints from face-set boundaries (on the low-poly cage) --------------------------------
fs = np.zeros(len(me.polygons), dtype=np.int32); me.attributes[".sculpt_face_set"].data.foreach_get("value", fs)
co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
v2s = [set() for _ in range(len(me.vertices))]
count = collections.Counter(int(x) for x in fs)
for p in me.polygons:
    for v in p.vertices: v2s[v].add(int(fs[p.index]))
adj = collections.defaultdict(set)
for s in v2s:
    for a in s:
        for b in s:
            if a != b: adj[a].add(b)
def ring(a, b): return np.array([i for i, s in enumerate(v2s) if a in s and b in s])
def setverts(a): return np.array([i for i, s in enumerate(v2s) if a in s])
def cen(idx): return co[idx].mean(axis=0)

wrist = cen(ring(PALM, FOREARM)); elbow = cen(ring(FOREARM, UPPER))
bases = [s for s in adj[PALM] if s != FOREARM and count[s] > 8]
chains = []
for b in bases:
    chain = [b]; prev = PALM; cur = b
    while True:
        nxt = [s for s in adj[cur] if s not in (prev, PALM) and s not in chain and s not in bases and count[s] > 8]
        if not nxt: break
        prev, cur = cur, nxt[0]; chain.append(cur)
    chains.append(chain)
print("CHAINS", chains)
def joints_of(chain):
    js = [cen(ring(PALM, chain[0]))]
    for a, b in zip(chain, chain[1:]): js.append(cen(ring(a, b)))
    last = chain[-1]; nails = [s for s in adj[last] if count[s] <= 8]
    tipv = np.concatenate([setverts(last)] + [setverts(n) for n in nails])
    d = cen(setverts(last)) - js[-1]; d /= np.linalg.norm(d)
    js.append(js[-1] + d * ((co[tipv] - js[-1]) @ d).max())
    return js
allj = [joints_of(c) for c in chains if len(c) == 3]
# thumb = the chain whose base is closest to the wrist; the others are ordered away from it
allj.sort(key=lambda js: np.linalg.norm(js[0] - wrist))
thumb = allj[0]; rest = sorted(allj[1:], key=lambda js: np.linalg.norm(js[0] - thumb[0]))
joints = dict(zip(["index", "middle", "ring", "pinky"], rest)); joints["thumb"] = thumb
for k, js in joints.items(): print("JOINTS", k, [np.round(j, 3).tolist() for j in js])

f_dir = joints["middle"][3] - joints["middle"][0]; f_dir /= np.linalg.norm(f_dir)
lat = joints["index"][0] - joints["pinky"][0]; lat /= np.linalg.norm(lat)       # towards the thumb side
n_palm = np.cross(lat, f_dir); n_palm /= np.linalg.norm(n_palm)                   # out of the palm (right hand)
curl = (joints["middle"][3] - joints["middle"][1]); print("CHECK palm-normal vs rest curl (should be >0):", round(float(curl @ n_palm), 4))
arm_axis = elbow - wrist; fore_len = np.linalg.norm(arm_axis); arm_axis /= fore_len
print("WRIST", np.round(wrist, 3), "ELBOW", np.round(elbow, 3), "forearm", round(float(fore_len), 3))

# ---- armature ---------------------------------------------------------------------------------
ad = bpy.data.armatures.new("rig"); arm = bpy.data.objects.new("rig", ad); sc.collection.objects.link(arm)
arm.matrix_world = src.matrix_world.copy()
bpy.context.view_layer.objects.active = arm; arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None, connect=False):
    b = ad.edit_bones.new(name); b.head = Vector(head); b.tail = Vector(tail)
    if parent: b.parent = ad.edit_bones[parent]; b.use_connect = connect
bone("body", (0, 0, 0.9), (0, 0, 1.45))
bone("upperarm", elbow + arm_axis * 0.3, elbow, "body")
bone("forearm", elbow, wrist, "upperarm", True)
bone("hand", wrist, joints["middle"][0], "forearm", True)
for name, js in joints.items():
    bone(f"{name}_1", js[0], js[1], "hand")
    bone(f"{name}_2", js[1], js[2], f"{name}_1", True)
    bone(f"{name}_3", js[2], js[3], f"{name}_2", True)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); src.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
am = next(m for m in src.modifiers if m.type == 'ARMATURE')
bpy.context.view_layer.objects.active = src
bpy.ops.object.modifier_move_to_index(modifier=am.name, index=0)
print("MODS", [m.type for m in src.modifiers], "VGROUPS", len(src.vertex_groups))

# ---- pose (degrees; positive = flexion towards the palm) ---------------------------------------
def rot(bname, deg, axis):
    if abs(deg) < 1e-6: return
    pb = arm.pose.bones[bname]; pb.rotation_mode = 'QUATERNION'
    a = pb.bone.matrix_local.to_3x3().inverted() @ Vector(axis).normalized()
    pb.rotation_quaternion = Quaternion(a, math.radians(deg)) @ pb.rotation_quaternion
def bdir(bname):
    b = ad.bones[bname]; return np.array((b.tail_local - b.head_local).normalized())
rot("forearm", POSE.get("elbow_flex", 0), np.cross(bdir("forearm"), n_palm))
rot("forearm", POSE.get("forearm_twist", 0), bdir("forearm"))
rot("hand", POSE.get("wrist_flex", 0), np.cross(bdir("hand"), n_palm))
rot("hand", POSE.get("wrist_dev", 0), n_palm)
for name in ("index", "middle", "ring", "pinky"):
    flex = POSE.get(name, [0, 0, 0])
    for i in range(3):
        bn = f"{name}_{i+1}"; rot(bn, flex[i], np.cross(bdir(bn), n_palm))
    rot(f"{name}_1", POSE.get(name + "_spread", 0), n_palm)
target = joints["index"][0] + n_palm * 0.03
flex = POSE.get("thumb", [0, 0, 0])
for i in range(3):
    bn = f"thumb_{i+1}"; d = bdir(bn); b = ad.bones[bn]
    tw = target - np.array(b.head_local); tw = tw - d * tw.dot(d); tw /= np.linalg.norm(tw)
    rot(bn, flex[i], np.cross(d, tw))
rot("thumb_1", POSE.get("thumb_spread", 0), n_palm)
bpy.context.view_layer.update()

# ---- evaluate (pose + sculpt detail), keep only the arm ------------------------------------------
dg = bpy.context.evaluated_depsgraph_get(); dg.update()
final = bpy.data.meshes.new_from_object(src.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
print("EVAL verts", len(final.vertices))
keep_sets = {PALM, FOREARM, UPPER} | {s for c in chains for s in c} | {n for c in chains for n in adj[c[-1]] if count[n] <= 8}
ffs = np.zeros(len(final.polygons), dtype=np.int32); final.attributes[".sculpt_face_set"].data.foreach_get("value", ffs)
tip = arm.pose.bones["index_3"].tail.copy()
pb = arm.pose.bones["forearm"]; fa_head = pb.head.copy(); fa_tail = pb.tail.copy()
ex = (fa_head - fa_tail).normalized()                               # wrist -> elbow
nz = -(arm.pose.bones["forearm"].matrix.to_3x3() @ (ad.bones["forearm"].matrix_local.to_3x3().inverted() @ Vector(n_palm)))
ez = (nz - ex * nz.dot(ex)).normalized(); ey = ez.cross(ex)
M = Matrix((ex, ey, ez)).to_4x4()
bm = bmesh.new(); bm.from_mesh(final)
bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[f for f in bm.faces if int(ffs[f.index]) not in keep_sets], context='FACES')
# cut the upper arm a little above the elbow
cut = fa_head + ex * POSE.get("upper_keep", 0.16)
res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=cut, plane_no=ex, clear_outer=True)
bm.to_mesh(final); bm.free()
final.transform(Matrix.Translation(-(M @ tip)) @ M)
for a in [a.name for a in final.attributes if a.name.startswith(".sculpt")]:
    try: final.attributes.remove(final.attributes[a])
    except Exception: pass
while final.uv_layers: final.uv_layers.remove(final.uv_layers[0])
for p in final.polygons: p.use_smooth = True
out = bpy.data.objects.new("hand_human", final); sc.collection.objects.link(out)
src.hide_render = True; arm.hide_render = True
tris = sum(len(p.vertices) - 2 for p in final.polygons); target = POSE.get("tris", 60000)
if tris > target:
    md = out.modifiers.new("dec", 'DECIMATE'); md.ratio = target / tris
    dg = bpy.context.evaluated_depsgraph_get(); dg.update()
    dec = bpy.data.meshes.new_from_object(out.evaluated_get(dg), depsgraph=dg)
    out.modifiers.clear(); out.data = dec; final = dec
    for p in final.polygons: p.use_smooth = True
mat = bpy.data.materials.new("skin"); final.materials.clear(); final.materials.append(mat)
mn, mx = bbox_world([out]); print("BBOX", [round(v, 3) for v in mn], [round(v, 3) for v in mx], "tris", sum(len(p.vertices) - 2 for p in final.polygons), "from", tris)

out.hide_render = False
bake_ao(out, samples=64)
bpy.ops.object.select_all(action='DESELECT'); out.select_set(True); bpy.context.view_layer.objects.active = out
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_animations=False, export_skins=False,
                          export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True)
print("GLB", out_glb, os.path.getsize(out_glb))
clay([out], (0.85, 0.85, 0.85, 1), 0.5, 0.0)
render_views([out], out_png, views=(("screen", (0, -1, 0)), ("roll25", (0, -0.9, 0.42)), ("top", (0, 0, 1)), ("iso", (-1, -1, 0.8))), res=720)
