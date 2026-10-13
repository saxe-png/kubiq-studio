"""Pose a MuJoCo Menagerie hand and export its visual meshes as one OBJ in a canonical frame.

Canonical (Blender, Z-up) frame = "right hand in the right-hand slot":
  fingers point -X, back of the hand +Z, thumb side -Y (towards the viewer), index fingertip at the origin.
"""
import sys, json, mujoco, numpy as np

CFG = {
    "shadow": dict(
        xml="shadow_hand/right_hand.xml",
        idx_distal="rh_ffdistal", idx_mcp="rh_FFJ3", idx_dip="rh_FFJ1", mid_mcp="rh_MFJ3", mid_distal="rh_mfdistal",
        exclude_bodies=[],
    ),
    "sharpa": dict(
        xml="sharpa_wave/right_hand.xml",
        idx_distal="right_index_DP", idx_mcp="right_index_MCP_FE", idx_dip="right_index_DIP", mid_mcp="right_middle_MCP_FE", mid_distal="right_middle_DP",
        exclude_bodies=[],
    ),
    "aero": dict(
        xml="tetheria_aero_hand_open/right_hand.xml",
        idx_distal="right_index_distal_link", idx_mcp="right_index_mcp_flex", idx_dip="right_index_dip", mid_mcp="right_middle_mcp_flex", mid_distal="right_middle_distal_link",
        exclude_bodies=["tetheria_mount"],
    ),
}

def norm(v): return v / np.linalg.norm(v)

def main():
    key, pose_path, out_obj = sys.argv[1], sys.argv[2], sys.argv[3]
    cfg = CFG[key]
    m = mujoco.MjModel.from_xml_path(cfg["xml"])
    d = mujoco.MjData(m)

    # --- canonical frame from the zero pose -------------------------------------------------
    mujoco.mj_forward(m, d)
    jid = lambda n: mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, n)
    bid = lambda n: mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_BODY, n)
    f = norm(d.xpos[bid(cfg["mid_distal"])] - d.xanchor[jid(cfg["mid_mcp"])])
    p0 = d.xpos[bid(cfg["idx_distal"])].copy()
    d.qpos[m.jnt_qposadr[jid(cfg["idx_mcp"])]] = 0.35
    mujoco.mj_forward(m, d)
    delta = d.xpos[bid(cfg["idx_distal"])] - p0
    n = norm(delta - f * delta.dot(f))          # out of the palm
    t = np.cross(f, n)                           # thumb side (right hand)
    ex, ey, ez = -f, -t, -n

    # --- apply the pose ------------------------------------------------------------------------
    pose = json.load(open(pose_path))
    d.qpos[:] = 0
    for name, val in pose.items():
        j = jid(name)
        if j < 0: raise SystemExit(f"unknown joint {name}")
        lo, hi = m.jnt_range[j]
        d.qpos[m.jnt_qposadr[j]] = min(max(val, lo), hi)
    mujoco.mj_forward(m, d)

    groups = {}   # material -> (list of vertex arrays, list of face arrays)
    tipverts = []
    excl = {bid(b) for b in cfg["exclude_bodies"]}
    for g in range(m.ngeom):
        if m.geom_type[g] != mujoco.mjtGeom.mjGEOM_MESH: continue
        if m.geom_contype[g] != 0 or m.geom_conaffinity[g] != 0: continue
        if m.geom_bodyid[g] in excl: continue
        mid = m.geom_dataid[g]
        v = m.mesh_vert[m.mesh_vertadr[mid]: m.mesh_vertadr[mid] + m.mesh_vertnum[mid]]
        fc = m.mesh_face[m.mesh_faceadr[mid]: m.mesh_faceadr[mid] + m.mesh_facenum[mid]]
        R = d.geom_xmat[g].reshape(3, 3)
        w = v @ R.T + d.geom_xpos[g]
        mat = m.material(m.geom_matid[g]).name if m.geom_matid[g] >= 0 else "default"
        groups.setdefault(mat, []).append((w, fc))
        if m.geom_bodyid[g] == bid(cfg["idx_distal"]): tipverts.append(w)

    tv = np.concatenate(tipverts)
    dirv = norm(tv.mean(axis=0) - d.xanchor[jid(cfg["idx_dip"])])
    tip = tv[np.argmax(tv @ dirv)]

    B = np.stack([ex, ey, ez])       # rows = canonical axes
    nv = 0; nf = 0
    with open(out_obj, "w") as fh:
        base = 1
        for mat, parts in groups.items():
            fh.write(f"o {mat}\n")
            vs = []; fs = []; off = 0
            for w, fc in parts:
                vs.append((w - tip) @ B.T); fs.append(fc + off); off += len(w)
            vs = np.concatenate(vs); fs = np.concatenate(fs)
            for p in vs: fh.write(f"v {p[0]:.6f} {p[1]:.6f} {p[2]:.6f}\n")
            for a, b, c in fs: fh.write(f"f {a+base} {b+base} {c+base}\n")
            base += len(vs); nv += len(vs); nf += len(fs)
    print(f"EXPORTED {key}: verts={nv} faces={nf} mats={list(groups)} -> {out_obj}")

main()
