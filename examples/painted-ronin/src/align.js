// THE ALIGNMENT (筆, part 2) — the body turns toward the drawn plane and the arm carries the blade into it through the cut (research L §2
// and §6 B: ContentFunnel/engine/assets/receipts/2026-11-07_stack/research/L_brush_chain.md). The owner after take 5: "we need to show the
// lines and moving the body to align and slash".
// Measured first (receipts/2026-11-09_blade/study/planarity.py on assets/clipdata.json): Quaternius's cuts are whips. Over ±2 frames of
// contact the blade strays 15-22 cm from any plane and its own plane turns 28-52° a frame; only the slam sweeps a plane (0.8 cm). A turn of
// the upper body alone turns that twisted sheet but cannot flatten it, so the alignment has two parts:
//  · THE TURN, an aim offset: after the mixer, one rotation multiplied onto the clip's own pose (Epic: "An Aim Offset is a type of Blend
//    Space in which the animation samples are additive"; Transform (Modify) Bone's "Add to Existing"), shared down the chain parent first
//    (Godot's LookAtModifier3D: "the LookAtModifier3D assigned to the parent bone must be put above the LookAtModifier3D assigned to the
//    child bone"), clamped with its soft knee ("let it feel more resistance the more it rotate to the edge limit": remap_damped, below),
//    eased in as the line turns, held through the swing, eased out after.
//  · THE CARRY, through the contact window: the blade (hilt → tip, off the skeleton) turned onto the drawn plane and its hilt laid in it,
//    the right arm reaching there by Godot's TwoBoneIK3D ("Mid-position should be a point of intersection of two circles"), the elbow on
//    the side the clip put it (its pole).
// Godot Engine is MIT ("Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md). Copyright (c) 2007-2014 Juan Linietsky,
// Ariel Manzur."): remapDamped and twoCircle below are ported from scene/3d/look_at_modifier_3d.cpp, scene/3d/two_bone_ik_3d.cpp and
// SkeletonModifier3D::get_projected_normal, line for line (rights.json records it).
import * as THREE from 'three';

export const ALIGN = {
  chain: [['spine_02', 0.35], ['spine_03', 0.35], ['clavicle_r', 0.30]],  // the turn's shares, parent first (ours)
  limit: 60 * Math.PI / 180, knee: 0.75,                                  // the clamp, and where its soft knee begins (ours; Godot's names): no
                                                                          // authored cut lies within 36° of most drawn planes (wall C4's
                                                                          // calibration), so the body takes the larger share (a 60° need → 45°)
  tauIn: 0.05, tauOut: 0.07,                                              // in: ~95 % within 0.15 s; out: ~95 % within 0.2 s (ours, research L)
  win: [-0.10, 0.12], ramp: 0.05,                                         // the carry: whole over the brush's own contact search (blade.js
                                                                          // afterAnimate: the clip's contact − 0.1 to + 0.12 s), ramped 0.05 s
  maxMove: 0.45, maxTurn: 60 * Math.PI / 180,                             // the hand's move and the wrist's turn at most (ours, over the measured
};                                                                        // 22 cm rms and 52° a frame)

// Godot's LookAtModifier3D::remap_damped + get_bspline_y (MIT), ported: under the damp threshold the angle is clamped as it is; past it, it
// eases into the limit along a quadratic b-spline from (damp, damp) through (1, 1) to (π / limit, 1)
export function remapDamped(from, to, damp, v) {
  const sign = v < 0 ? -1 : 1, a = Math.abs(v);
  if (Math.abs(damp - 1) < 1e-6 || Math.abs(to) < 1e-6) return sign * THREE.MathUtils.clamp(a, from, to);
  if ((a - from) / (to - from) <= damp) return sign * THREE.MathUtils.clamp(a, from, to);
  const x = a / to, endX = Math.PI / to, A = damp - 2 + endX, B = -2 * damp + 2, C = damp - x;
  let t;
  if (Math.abs(A) < 1e-9) t = -C / B;
  else { const s = Math.sqrt(Math.max(0, B * B - 4 * A * C)), e = 1 / (2 * A), t1 = (-B + s) * e; t = t1 >= 0 && t1 <= 1 ? t1 : (-B - s) * e; }
  const u = 1 - t, y = u * u * damp + 2 * u * t + t * t;
  return sign * (from + (to - from) * y);
}

// Godot's TwoBoneIK3D::_process_joints (MIT), ported: the end on the target (straight toward it when out of reach, pushed out when nearer
// than the bones' difference); the middle joint where the root's circle meets the end's, on the side of the pole (get_projected_normal)
export function twoCircle(root, l1, l2, target, pole) {
  const rd = target.clone().sub(root), dl2 = rd.lengthSq();
  if (dl2 < 1e-12) return null;
  if (dl2 >= (l1 + l2) * (l1 + l2)) { const n = rd.normalize(), mid = root.clone().addScaledVector(n, l1); return { mid, end: mid.clone().addScaledVector(n, l2) }; }
  let dest = target.clone(); const sub = l1 - l2;
  if (dl2 < sub * sub) dest = root.clone().addScaledVector(rd.clone().normalize(), Math.abs(sub));
  const d = dest.clone().sub(root), L = d.length(), u = d.clone().divideScalar(L);
  const w = pole.clone().sub(root), t = w.dot(d) / d.lengthSq(), pv = pole.clone().sub(root.clone().addScaledVector(d, t));
  if (pv.lengthSq() < 1e-12) return null; pv.normalize();
  const a = (L * L + l1 * l1 - l2 * l2) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), c = root.clone().addScaledVector(u, a);
  const plus = c.clone().addScaledVector(pv, h), minus = c.clone().addScaledVector(pv, -h);
  return { mid: pole.distanceToSquared(plus) < pole.distanceToSquared(minus) ? plus : minus, end: dest };
}

const Y = new THREE.Vector3(0, 1, 0), I = new THREE.Quaternion();
const _p = new THREE.Quaternion(), _pi = new THREE.Quaternion(), _q = new THREE.Quaternion();
// a bone turned by r in the WORLD, its children with it: local' = (parent⁻¹ · r · parent) · local
function rotateWorld(bone, r) {
  bone.parent.getWorldQuaternion(_p); _pi.copy(_p).invert();
  bone.quaternion.premultiply(_q.copy(_pi).multiply(r).multiply(_p)); bone.updateMatrixWorld(true);
}
// a bone's local turn set so that its WORLD rotation is q
function setWorld(bone, q) { bone.parent.getWorldQuaternion(_p); bone.quaternion.copy(_p.invert().multiply(q)); bone.updateMatrixWorld(true); }
const angleOf = (q) => 2 * Math.acos(Math.min(1, Math.abs(q.w)));
function axisOf(q, out) { const s = Math.sqrt(Math.max(0, 1 - q.w * q.w)); return s < 1e-6 ? out.set(1, 0, 0) : out.set(q.x, q.y, q.z).multiplyScalar((q.w < 0 ? -1 : 1) / s); }

// the clip's blade plane at contact, in his own frame: the blade (hilt → tip) and its tip's travel at the contact frame (clipdata.json)
export function clipPlaneNormal(clipdata, clip) {
  const d = clipdata[clip]; if (!d || !d.contact || !d.tip || !d.base) return null;
  const f = THREE.MathUtils.clamp(d.contact.frame, 1, d.tip.length - 2), b = d.base[f], t = d.tip[f], a = d.tip[f - 1], c = d.tip[f + 1];
  return new THREE.Vector3(t[0] - b[0], t[1] - b[1], t[2] - b[2]).cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2])).normalize();
}

export function createAlign(person, clipdata, { plant = null } = {}) {
  const bones = person.bones, chain = ALIGN.chain.map(([n, w]) => [bones[n], w]);
  const arm = { root: bones.upperarm_r, mid: bones.lowerarm_r, end: bones.hand_r };
  for (const [k, b] of [...ALIGN.chain.map(([n], i) => [n, chain[i][0]]), ['upperarm_r', arm.root], ['lowerarm_r', arm.mid], ['hand_r', arm.end]]) if (!b) throw new Error('[align] the rig has no bone ' + k);
  const S = { on: false, want: new THREE.Quaternion(), turn: new THREE.Quaternion(), need: 0, got: 0, carry: 0, moved: 0, turned: 0 };
  const v = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3()), q = [0, 1, 2].map(() => new THREE.Quaternion()), axis = new THREE.Vector3();

  // the turn the body should hold: the least rotation taking this clip's blade plane at contact (his facing applied) onto the drawn plane,
  // whichever of the plane's two normals needs less; clamped with the soft knee. Called every frame while it holds (the line may turn).
  function aim(n, clip, facing) {
    const nc = clipPlaneNormal(clipdata, clip); if (!nc) { S.on = false; return; }
    nc.applyAxisAngle(Y, facing); const nd = n.clone().normalize(); if (nd.dot(nc) < 0) nd.negate();
    const r = new THREE.Quaternion().setFromUnitVectors(nc, nd), ang = angleOf(r); axisOf(r, axis);
    S.need = ang; S.got = remapDamped(0, ALIGN.limit, ALIGN.knee, ang);
    S.want.setFromAxisAngle(axis, S.got); S.on = plant !== 'chnoalign';
  }
  function letGo() { S.on = false; }

  // every frame after the mixer has posed him (his own clock): the turn eased toward what it should be, laid down the chain, parent first
  function update(dt) {
    const k = 1 - Math.exp(-Math.max(0, dt) / (S.on ? ALIGN.tauIn : ALIGN.tauOut));
    S.turn.slerp(S.on ? S.want : I, k);
    const ang = angleOf(S.turn); if (ang < 1e-4) { if (!S.on) S.turn.identity(); return; }
    axisOf(S.turn, axis);
    for (const [b, share] of chain) rotateWorld(b, q[0].setFromAxisAngle(axis, ang * share));
  }

  // through the contact window (clip seconds from the clip's contact), after the turn: the blade laid into the plane (n through o) by the
  // right arm: whole wherever the brush may find the contact, ramped either side
  function carry(n, o, fromContact) {
    const [lo, hi] = ALIGN.win, out = fromContact < lo ? lo - fromContact : fromContact > hi ? fromContact - hi : 0;
    const w = plant === 'chnocarry' || plant === 'chnoalign' || out >= ALIGN.ramp ? 0 : 1 - out / ALIGN.ramp;
    S.carry = w; if (w <= 0) return 0;
    const hilt = person.sword.userData.base.getWorldPosition(v[0]), tip = person.sword.userData.tip.getWorldPosition(v[1]);
    const bd = v[2].copy(tip).sub(hilt).normalize(), bp = v[3].copy(bd).addScaledVector(n, -bd.dot(n));
    if (bp.lengthSq() < 1e-8) return 0; bp.normalize();
    // the wrist's turn: the blade onto its own shadow in the plane, at most maxTurn, by the window's weight
    const r = q[1].setFromUnitVectors(bd, bp), full = angleOf(r); S.wantTurn = full;
    if (full > ALIGN.maxTurn) r.slerpQuaternions(I, r.clone(), ALIGN.maxTurn / full);
    r.slerpQuaternions(I, r.clone(), w); S.turned = angleOf(r);
    // the hand's target: the hilt, turned with the hand, laid in the plane
    const hand = arm.end.getWorldPosition(v[4]), hw0 = arm.end.getWorldQuaternion(q[2]).clone();
    const off = hilt.clone().sub(hand).applyQuaternion(r), hiltIn = hilt.clone().addScaledVector(n, -n.dot(v[5].copy(hilt).sub(o)));
    // Where in the plane the blade passes is the BODY's to set: he faces so the turned contact meets the target (turnedContact, below);
    // a pull of the hand along the plane toward the aim was tried and taken out — with the facing right, B14 held without it (0.105 m)
    const move = hiltIn.clone().sub(off).sub(hand); S.wantMove = move.length(); if (move.length() > ALIGN.maxMove) move.setLength(ALIGN.maxMove);
    const target = hand.clone().addScaledVector(move, w); S.moved = move.length() * w;
    // the right arm reaches it (two circles), the elbow on the clip's side
    const root = arm.root.getWorldPosition(new THREE.Vector3()), mid = arm.mid.getWorldPosition(new THREE.Vector3()), end = hand.clone();
    const sol = twoCircle(root, root.distanceTo(mid), mid.distanceTo(end), target, mid);
    if (sol) {
      rotateWorld(arm.root, q[0].setFromUnitVectors(mid.clone().sub(root).normalize(), sol.mid.clone().sub(root).normalize()));
      const m2 = arm.mid.getWorldPosition(new THREE.Vector3()), e2 = arm.end.getWorldPosition(new THREE.Vector3());
      rotateWorld(arm.mid, q[0].setFromUnitVectors(e2.sub(m2).normalize(), sol.end.clone().sub(m2).normalize()));
    }
    setWorld(arm.end, r.clone().multiply(hw0));                           // the hand holds the blade on its shadow in the plane
    S.miss = arm.end.getWorldPosition(v[4]).distanceTo(target);           // how far the arm fell short of where it was sent
    return w;
  }
  // where this clip's contact point (its tip at the contact frame, clipdata.json) lands once the turn it should hold is laid on, pivoting on
  // the chest (spine_03): the body faces so THAT point meets the target (wall B14: faced by the clip's own point, the turned kesa passed
  // 1.03 m from the mat). In his frame: off across, reach ahead, as contactOf gives them.
  function turnedContact(clip, facing, pos) {
    const d = clipdata[clip]; if (!d || !d.contact || !S.on || S.got < 1e-3) return null;
    const t = d.contact.tip, c = Math.cos(facing), s = Math.sin(facing), P = bones.spine_03.getWorldPosition(v[5]);
    const w = new THREE.Vector3(pos.x + c * t[0] + s * t[2], pos.y + t[1], pos.z - s * t[0] + c * t[2]).sub(P).applyQuaternion(S.want).add(P).sub(pos);
    return { off: c * w.x - s * w.z, reach: s * w.x + c * w.z };
  }
  return { S, aim, letGo, update, carry, turnedContact, planeOf: (clip) => clipPlaneNormal(clipdata, clip), get turning() { return angleOf(S.turn); } };
}
