# Shared helpers for headless Blender scripts (preview renders, contact sheets).
import bpy, math, numpy as np
from mathutils import Vector

def bbox_world(objs):
    pts = []
    for o in objs:
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

def setup_render(res=640, engine=None):
    sc = bpy.context.scene
    sc.render.resolution_x = res; sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    try:
        sc.render.engine = engine or 'BLENDER_EEVEE'
    except Exception:
        sc.render.engine = 'CYCLES'
    if sc.render.engine == 'CYCLES':
        sc.cycles.samples = 24
        sc.cycles.device = 'CPU'
    w = bpy.data.worlds.new("pw"); sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.05, 0.05, 0.06, 1); bg.inputs[1].default_value = 1.0
    sc.view_settings.view_transform = 'Standard'

def clay(objs, color=(0.8, 0.8, 0.8, 1), rough=0.45, metallic=0.0):
    m = bpy.data.materials.new("clay"); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    for o in objs:
        o.data.materials.clear(); o.data.materials.append(m)

def render_views(objs, out_png, views=(("front",(0,-1,0)),("side",(1,0,0)),("top",(0,0,1)),("iso",(1,-1,0.7))), res=640, engine=None, ortho=True):
    setup_render(res, engine)
    sc = bpy.context.scene
    mn, mx = bbox_world(objs)
    c = (mn + mx) / 2; size = max((mx - mn).length, 1e-4)
    cam_d = bpy.data.cameras.new("pc"); cam = bpy.data.objects.new("pc", cam_d); sc.collection.objects.link(cam); sc.camera = cam
    if ortho:
        cam_d.type = 'ORTHO'; cam_d.ortho_scale = size * 1.05
    cam_d.clip_start = size * 0.01; cam_d.clip_end = size * 20
    # lights
    for i, (d, e) in enumerate((((1,-1,1.2), 3.0), ((-1,-0.6,0.4), 1.2), ((0,1,0.6), 1.5))):
        ld = bpy.data.lights.new(f"pl{i}", 'SUN'); ld.energy = e; lo = bpy.data.objects.new(f"pl{i}", ld); sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(d).to_track_quat('Z', 'Y').to_euler()
    tiles = []
    for name, d in views:
        dv = Vector(d).normalized()
        cam.location = c + dv * size * 3
        up = 'Y'
        cam.rotation_euler = dv.to_track_quat('Z', up).to_euler()
        sc.render.filepath = out_png + f".{name}.png"
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(sc.render.filepath)
        a = np.array(img.pixels[:], dtype=np.float32).reshape(res, res, 4)
        tiles.append(a); bpy.data.images.remove(img)
        import os; os.remove(sc.render.filepath)
    sheet = np.concatenate(tiles, axis=1)
    out = bpy.data.images.new("sheet", width=sheet.shape[1], height=sheet.shape[0], alpha=True)
    out.pixels = sheet.ravel(); out.filepath_raw = out_png; out.file_format = 'PNG'; out.save()
    print("SHEET", out_png)


def bake_ao(obj, samples=48, distance=0.03, floor=0.18, gamma=1.0):
    """Bake ambient occlusion into a vertex colour attribute named COLOR_0 (cheap contact shading on the web)."""
    sc = bpy.context.scene
    prev = sc.render.engine
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    if sc.world is None: sc.world = bpy.data.worlds.new("w")
    me = obj.data
    if "Col" in me.color_attributes: me.color_attributes.remove(me.color_attributes["Col"])
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = ca; me.color_attributes.render_color_index = me.color_attributes.find("Col")
    for slot in obj.material_slots:
        m = slot.material
        if m and not m.use_nodes: m.use_nodes = True
    if not obj.material_slots:
        m = bpy.data.materials.new("bake"); m.use_nodes = True; me.materials.append(m)
    try: sc.world.light_settings.distance = distance
    except Exception: pass
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    sc.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='AO')
    n = len(me.vertices); col = np.zeros(n * 4, dtype=np.float32); ca = me.color_attributes["Col"]; ca.data.foreach_get("color", col)
    col = col.reshape(-1, 4); v = np.clip(col[:, 0], 0, 1) ** gamma; v = floor + (1 - floor) * v
    col[:, 0] = col[:, 1] = col[:, 2] = v; col[:, 3] = 1
    ca.data.foreach_set("color", col.ravel()); me.update()
    print("AO baked", n, "verts; min/mean", round(float(v.min()), 3), round(float(v.mean()), 3))
    sc.render.engine = prev
