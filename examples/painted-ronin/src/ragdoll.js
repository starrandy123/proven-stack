// The fallen: Jolt's own Ragdoll (RagdollSettings: capsules on the skeleton, SwingTwist joints, one-way hinges at knees and elbows,
// Stabilize, DisableParentChildCollisions), the method of JoltPhysics.js Examples/rig/create_rig.html, as Tinlight runs it live
// (NotesMosaic's Tinlight, physics/repo.js). One rule kept from there: every joint limit counts from the skeleton's REST pose,
// never from the pose the body died in, so a knee or an elbow can only ever bend the way a knee or an elbow bends.
import * as THREE from 'three';
import { LAYER_RAGDOLL } from './physics.js';

const D2R = Math.PI / 180;
const PLANT_KNEE = typeof location !== 'undefined' && /[?&]plant=knee\b/.test(location.search);
// the parts on Quaternius's rig (Unreal mannequin names); joint limits are Tinlight's (from Jolt's rig example, knees and elbows one-way)
export const LIMBS = [
  { name: 'pelvis', bone: 'pelvis', tip: 'spine_02', r: 0.14, mass: 11, parent: -1 },
  { name: 'torso', bone: 'spine_02', tip: 'neck_01', r: 0.15, mass: 17, parent: 0, joint: { swing: [20, 20], twist: 10 } },
  { name: 'head', bone: 'Head', tip: null, len: 0.24, r: 0.105, mass: 5, parent: 1, joint: { swing: [45, 45], twist: 70 } },
  { name: 'armL', bone: 'upperarm_l', tip: 'lowerarm_l', r: 0.06, mass: 2.2, parent: 1, joint: { swing: [80, 45], twist: 45 } },
  { name: 'foreL', bone: 'lowerarm_l', tip: 'hand_l', r: 0.05, mass: 1.6, parent: 3, joint: { hinge: [0, 130], elbow: true } },
  { name: 'armR', bone: 'upperarm_r', tip: 'lowerarm_r', r: 0.06, mass: 2.2, parent: 1, joint: { swing: [80, 45], twist: 45 } },
  { name: 'foreR', bone: 'lowerarm_r', tip: 'hand_r', r: 0.05, mass: 1.6, parent: 5, joint: { hinge: [0, 130], elbow: true } },
  { name: 'thighL', bone: 'thigh_l', tip: 'calf_l', r: 0.09, mass: 7, parent: 0, joint: { swing: [45, 45], twist: 45 } },
  { name: 'shinL', bone: 'calf_l', tip: 'foot_l', r: 0.07, mass: 4, parent: 7, joint: { hinge: [0, 140], knee: true } },
  { name: 'thighR', bone: 'thigh_r', tip: 'calf_r', r: 0.09, mass: 7, parent: 0, joint: { swing: [45, 45], twist: 45 } },
  { name: 'shinR', bone: 'calf_r', tip: 'foot_r', r: 0.07, mass: 4, parent: 9, joint: { hinge: [0, 140], knee: true } },
];

const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();
const worldQ = (o) => { o.updateWorldMatrix(true, false); return new THREE.Quaternion().setFromRotationMatrix(_m.copy(o.matrixWorld)); };
const worldP = (o) => { o.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); };

// the rest pose, taken once from a person built in its bind pose (before any clip moves it): each bone's rotation relative to the
// person's own root, and the directions a hinge needs (in the bone's own frame), so the limits can be rebuilt in any pose later
export function restPose(person) {
  const root = person.root; root.updateMatrixWorld(true);
  const rootQi = worldQ(root).invert();
  const rest = {};
  for (const L of LIMBS) {
    const a = person.bones[L.bone];
    const qa = rootQi.clone().multiply(worldQ(a));                       // bone rotation in the person's frame, at rest
    const pa = worldP(a), pb = L.tip ? worldP(person.bones[L.tip]) : pa.clone().add(new THREE.Vector3(0, L.len, 0).applyQuaternion(worldQ(root)));
    const dir = pb.clone().sub(pa).normalize().applyQuaternion(rootQi);  // the limb's direction in the person's frame, at rest
    let hinge = null;
    if (L.joint && L.joint.knee) hinge = new THREE.Vector3(1, 0, 0);                                   // shin swings back: about +X
    if (L.joint && L.joint.elbow) hinge = dir.clone().cross(new THREE.Vector3(0, 0, 1)).normalize();   // forearm swings forward
    rest[L.name] = { qa, dir, hinge };
  }
  return rest;
}

export class Ragdoll {
  constructor(P, person, rest, { velocity = null, impulse = null, at = 'torso', group = 1 } = {}) {
    const { Jolt, system } = P;
    this.P = P; this.person = person; this.parts = []; this.age = 0;
    person.root.updateMatrixWorld(true);
    const rootQ = worldQ(person.root);
    const skel = new Jolt.Skeleton();
    for (const L of LIMBS) skel.AddJoint(new Jolt.JPHString(L.name, L.name.length), L.parent);
    const rs = new Jolt.RagdollSettings(); rs.mSkeleton = skel; rs.mParts.resize(LIMBS.length);
    const V3 = (v) => new Jolt.Vec3(v.x, v.y, v.z);
    LIMBS.forEach((L, i) => {
      const a = person.bones[L.bone];
      const pa = worldP(a), qa = worldQ(a);
      // the head has no end bone: its direction is the rest direction turned by the head's change from rest
      const pb = L.tip ? worldP(person.bones[L.tip]) : pa.clone().addScaledVector(rest[L.name].dir.clone().applyQuaternion(rest[L.name].qa.clone().invert()).applyQuaternion(qa), L.len);
      const mid = pa.clone().add(pb).multiplyScalar(0.5), len = Math.max(0.05, pa.distanceTo(pb)), half = Math.max(0.01, len * 0.5 - L.r * 0.55);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.clone().sub(pa).normalize());
      const part = rs.mParts.at(i);
      part.SetShape(new Jolt.CapsuleShape(half, L.r, null));
      part.mPosition = new Jolt.RVec3(mid.x, mid.y, mid.z); part.mRotation = new Jolt.Quat(q.x, q.y, q.z, q.w);
      part.mMotionType = Jolt.EMotionType_Dynamic; part.mObjectLayer = LAYER_RAGDOLL; part.mFriction = 0.9; part.mRestitution = 0;
      part.mLinearDamping = 0.1; part.mAngularDamping = 0.6;
      part.mNumVelocityStepsOverride = 16; part.mNumPositionStepsOverride = 6;   // more solver passes for the limbs, so the limits hold
      part.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia; part.mMassPropertiesOverride.mMass = L.mass;
      if (L.parent >= 0) {
        // the joint frame at REST, carried by each bone's current rotation (Tinlight's rule): a limit is about the rest pose
        const Pn = LIMBS[L.parent], rA = rest[Pn.name], rB = rest[L.name];
        const curA = worldQ(person.bones[Pn.bone]), curB = qa;
        const localA = (vPerson) => vPerson.clone().applyQuaternion(rA.qa.clone().invert());   // a person-frame rest direction in the parent's bone frame
        const localB = (vPerson) => vPerson.clone().applyQuaternion(rB.qa.clone().invert());   // … in the child's bone frame
        const inA = (vPerson) => localA(vPerson).applyQuaternion(curA), inB = (vPerson) => localB(vPerson).applyQuaternion(curB);
        const twist = rB.dir;
        let cs;
        if (L.joint.hinge) {
          const h = PLANT_KNEE && L.joint.knee ? rB.hinge.clone().negate() : rB.hinge;     // ?plant=knee: the defect the wall must catch
          cs = new Jolt.HingeConstraintSettings(); cs.mSpace = Jolt.EConstraintSpace_WorldSpace;
          cs.mPoint1 = new Jolt.RVec3(pa.x, pa.y, pa.z); cs.mPoint2 = new Jolt.RVec3(pa.x, pa.y, pa.z);
          cs.mHingeAxis1 = V3(inA(h)); cs.mHingeAxis2 = V3(inB(h)); cs.mNormalAxis1 = V3(inA(twist)); cs.mNormalAxis2 = V3(inB(twist));
          cs.mLimitsMin = L.joint.hinge[0] * D2R; cs.mLimitsMax = L.joint.hinge[1] * D2R;
        } else {
          const plane = new THREE.Vector3(0, 0, 1).addScaledVector(twist, -twist.z).normalize();
          cs = new Jolt.SwingTwistConstraintSettings(); cs.mSpace = Jolt.EConstraintSpace_WorldSpace;
          cs.mPosition1 = new Jolt.RVec3(pa.x, pa.y, pa.z); cs.mPosition2 = new Jolt.RVec3(pa.x, pa.y, pa.z);
          cs.mTwistAxis1 = V3(inA(twist)); cs.mTwistAxis2 = V3(inB(twist)); cs.mPlaneAxis1 = V3(inA(plane)); cs.mPlaneAxis2 = V3(inB(plane));
          cs.mTwistMinAngle = -L.joint.twist * D2R; cs.mTwistMaxAngle = L.joint.twist * D2R;
          cs.mNormalHalfConeAngle = L.joint.swing[0] * D2R; cs.mPlaneHalfConeAngle = L.joint.swing[1] * D2R;
        }
        part.mToParent = cs;
      }
      this.parts.push({ L, bone: a, offsetQ: q.clone().invert().multiply(qa), halfLen: len * 0.5, q0: q.clone() });
    });
    rs.Stabilize();
    rs.DisableParentChildCollisions();
    this.rag = rs.CreateRagdoll(group, 0, system);
    this.rag.AddToPhysicsSystem(Jolt.EActivation_Activate);
    const bi = system.GetBodyInterface();
    // ⚠ JoltJS returns GetBodyID(i) in ONE shared temporary (Emscripten's by-value return): keep a copy of each, never the returned object
    this.ids = this.parts.map((p, i) => new Jolt.BodyID(this.rag.GetBodyID(i).GetIndexAndSequenceNumber()));
    const v = new Jolt.Vec3();
    if (velocity) for (const id of this.ids) { v.Set(velocity.x, velocity.y, velocity.z); bi.SetLinearVelocity(id, v); }
    if (impulse) { const k = LIMBS.findIndex((L) => L.name === at); v.Set(impulse.x, impulse.y, impulse.z); bi.AddImpulse(this.ids[Math.max(0, k)], v); }
    person.mixer.stopAllAction();
    person.dead = true;
  }

  // the skeleton follows the bodies (rotations only, so nothing stretches); the pelvis carries the person
  apply(dt) {
    this.age += dt;
    const bi = this.P.system.GetBodyInterface();
    for (const p of this.parts) {
      const id = this.ids[this.parts.indexOf(p)];
      const r = bi.GetRotation(id); _q.set(r.GetX(), r.GetY(), r.GetZ(), r.GetW()).multiply(p.offsetQ);
      if (p.L.name === 'pelvis') {
        const t = bi.GetPosition(id); _v.set(0, -p.halfLen, 0).applyQuaternion(_q.clone().multiply(p.offsetQ.clone().invert()));
        const world = new THREE.Vector3(t.GetX() + _v.x, t.GetY() + _v.y, t.GetZ() + _v.z);
        p.bone.parent.updateWorldMatrix(true, false);
        p.bone.position.copy(p.bone.parent.worldToLocal(world));
      }
      const parent = p.bone.parent;
      parent.updateWorldMatrix(true, false); _qi.setFromRotationMatrix(_m.copy(parent.matrixWorld)).invert();
      p.bone.quaternion.copy(_qi).multiply(_q);
      p.bone.updateWorldMatrix(false, true);
    }
  }

  // for the walls: every hinge's current bend, in degrees, measured about its rest frame (a knee or elbow must stay within -3..145)
  bends() {
    const bi = this.P.system.GetBodyInterface(), out = {};
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i]; if (!p.L.joint || !p.L.joint.hinge) continue;
      const c = this.rag.GetConstraint(i - 1); if (!c) continue;
      const hinge = this.P.Jolt.castObject(c, this.P.Jolt.HingeConstraint);
      out[p.L.name] = hinge.GetCurrentAngle() / D2R;
    }
    return out;
  }

  remove() { this.rag.RemoveFromPhysicsSystem(); }
}

// The wall's own measurement, independent of the joint settings: each knee and elbow's bend from the bones' positions, signed by the
// anatomical axis (the rest hinge carried by the upper bone). A knee bends +0..140 (shin back); a negative bend past a few degrees is
// a knee folding the wrong way, whatever the constraint believes.
export function anatomicalBends(person, rest) {
  const P = (n) => worldP(person.bones[n]);
  const pairs = [['shinL', 'thighL', 'thigh_l', 'calf_l', 'foot_l'], ['shinR', 'thighR', 'thigh_r', 'calf_r', 'foot_r'],
    ['foreL', 'armL', 'upperarm_l', 'lowerarm_l', 'hand_l'], ['foreR', 'armR', 'upperarm_r', 'lowerarm_r', 'hand_r']];
  const out = {};
  for (const [part, upper, a, b, c] of pairs) {
    const u = P(b).sub(P(a)).normalize(), l = P(c).sub(P(b)).normalize();
    const axis = rest[part].hinge.clone().applyQuaternion(rest[upper].qa.clone().invert()).applyQuaternion(worldQ(person.bones[a]));
    out[part] = Math.atan2(u.clone().cross(l).dot(axis), u.dot(l)) / D2R;
  }
  return out;
}
