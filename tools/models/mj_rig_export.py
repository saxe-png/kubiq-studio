"""Export a MuJoCo Menagerie hand as an articulated rig description.

Writes
  <out>.obj   every visual mesh as its own object, vertices in the frame of the body it is attached to
  <out>.json  body hierarchy, joints, named poses (joint angles), the canonical frame and the fingertip

Canonical (Blender, Z-up) frame = right hand in the right-hand slot: fingers -X, back of the
hand +Z, thumb -Y, index fingertip of the reference pose at the origin.
"""
import sys, json, mujoco, numpy as np

CFG = {
    "sharpa": dict(
        xml="sharpa_wave/right_hand.xml",
        idx_distal="right_index_DP", idx_mcp="right_index_MCP_FE", idx_dip="right_index_DIP",
        mid_mcp="right_middle_MCP_FE", mid_distal="right_middle_DP", exclude_bodies=[],
    ),
}

def norm(v): return v / np.linalg.norm(v)

def main():
    key, poses_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
    cfg = CFG[key]
    poses = json.load(open(poses_path))
    m = mujoco.MjModel.from_xml_path(cfg["xml"]); d = mujoco.MjData(m)
    jid = lambda n: mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, n)
    bid = lambda n: mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_BODY, n)

    # canonical axes from the zero pose
    mujoco.mj_forward(m, d)
    f = norm(d.xpos[bid(cfg["mid_distal"])] - d.xanchor[jid(cfg["mid_mcp"])])
    p0 = d.xpos[bid(cfg["idx_distal"])].copy()
    d.qpos[m.jnt_qposadr[jid(cfg["idx_mcp"])]] = 0.35; mujoco.mj_forward(m, d)
    delta = d.xpos[bid(cfg["idx_distal"])] - p0
    n = norm(delta - f * delta.dot(f)); t = np.cross(f, n)
    B = np.stack([-f, -t, -n])

    def set_pose(pose):
        d.qpos[:] = 0
        for name, val in pose.items():
            j = jid(name)
            if j < 0: raise SystemExit(f"unknown joint {name}")
            lo, hi = m.jnt_range[j]; d.qpos[m.jnt_qposadr[j]] = min(max(val, lo), hi)
        mujoco.mj_forward(m, d)

    excl = {bid(b) for b in cfg["exclude_bodies"]}
    geoms = []; tip_local = None
    with open(out + ".obj", "w") as fh:
        base = 1
        for g in range(m.ngeom):
            if m.geom_type[g] != mujoco.mjtGeom.mjGEOM_MESH or m.geom_contype[g] != 0 or m.geom_conaffinity[g] != 0: continue
            b = m.geom_bodyid[g]
            if b in excl: continue
            mid = m.geom_dataid[g]
            v = m.mesh_vert[m.mesh_vertadr[mid]: m.mesh_vertadr[mid] + m.mesh_vertnum[mid]]
            fc = m.mesh_face[m.mesh_faceadr[mid]: m.mesh_faceadr[mid] + m.mesh_facenum[mid]]
            R = np.zeros(9); mujoco.mju_quat2Mat(R, m.geom_quat[g]); R = R.reshape(3, 3)
            local = v @ R.T + m.geom_pos[g]                      # in the body frame
            name = f"g{g}"
            fh.write(f"o {name}\n")
            for p in local: fh.write(f"v {p[0]:.6f} {p[1]:.6f} {p[2]:.6f}\n")
            for a, b2, c in fc: fh.write(f"f {a+base} {b2+base} {c+base}\n")
            base += len(local)
            mat = m.material(m.geom_matid[g]).name if m.geom_matid[g] >= 0 else "default"
            geoms.append(dict(obj=name, body=m.body(b).name, mesh=m.mesh(mid).name, mat=mat, faces=int(len(fc))))
            if b == bid(cfg["idx_distal"]) and "elastomer" not in m.mesh(mid).name.lower():
                dirv = norm(local.mean(axis=0)); tip_local = local[np.argmax(local @ dirv)]
    bodies = []
    for b in range(1, m.nbody):
        if b in excl: continue
        bodies.append(dict(name=m.body(b).name, parent=m.body(m.body_parentid[b]).name if m.body_parentid[b] > 0 else None,
                           pos=m.body_pos[b].tolist(), quat=m.body_quat[b].tolist()))
    joints = [dict(name=m.joint(j).name, body=m.body(m.jnt_bodyid[j]).name, axis=m.jnt_axis[j].tolist(), pos=m.jnt_pos[j].tolist(),
                   range=m.jnt_range[j].tolist()) for j in range(m.njnt)]

    # reference pose puts the fingertip at the origin
    set_pose(poses["rest"])
    ib = bid(cfg["idx_distal"])
    tip_world = d.xmat[ib].reshape(3, 3) @ tip_local + d.xpos[ib]
    C = np.eye(4); C[:3, :3] = B; C[:3, 3] = -B @ tip_world
    json.dump(dict(bodies=bodies, geoms=geoms, joints=joints, poses=poses, canon=C.tolist(),
                   tip=dict(body=cfg["idx_distal"], local=tip_local.tolist())), open(out + ".json", "w"), indent=1)
    print(f"RIG {key}: bodies={len(bodies)} geoms={len(geoms)} joints={len(joints)} faces={sum(g['faces'] for g in geoms)} -> {out}.obj/.json")

main()
