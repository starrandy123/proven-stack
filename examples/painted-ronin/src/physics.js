// The physics world: Jolt Physics (MIT, Jorrit Rouwe; the engine of Horizon Forbidden West and Death Stranding 2).
// Ported from JoltPhysics.js's own examples (Examples/js/example.js for the layers, heightfield.html for the terrain,
// character_virtual.html for the player). Nothing here is a physics engine of our own: it is Jolt, wired.
import initJolt from 'jolt-physics';

export const LAYER_STATIC = 0, LAYER_MOVING = 1, LAYER_RAGDOLL = 2, LAYER_DEBRIS = 3;
const NUM_LAYERS = 4;

export async function createPhysics() {
  const Jolt = await initJolt();
  // Layers (example.js): static meets everything, moving meets moving, the dead (ragdolls) meet the world and each other but never
  // the living characters' capsules, so a corpse never shoves the player; debris meets the world and the dead.
  const pairs = new Jolt.ObjectLayerPairFilterTable(NUM_LAYERS);
  pairs.EnableCollision(LAYER_STATIC, LAYER_MOVING);
  pairs.EnableCollision(LAYER_MOVING, LAYER_MOVING);
  pairs.EnableCollision(LAYER_STATIC, LAYER_RAGDOLL);
  pairs.EnableCollision(LAYER_RAGDOLL, LAYER_RAGDOLL);
  pairs.EnableCollision(LAYER_STATIC, LAYER_DEBRIS);
  pairs.EnableCollision(LAYER_DEBRIS, LAYER_RAGDOLL);
  pairs.EnableCollision(LAYER_DEBRIS, LAYER_DEBRIS);
  const BP_STATIC = new Jolt.BroadPhaseLayer(0), BP_MOVING = new Jolt.BroadPhaseLayer(1);
  const bp = new Jolt.BroadPhaseLayerInterfaceTable(NUM_LAYERS, 2);
  bp.MapObjectToBroadPhaseLayer(LAYER_STATIC, BP_STATIC);
  bp.MapObjectToBroadPhaseLayer(LAYER_MOVING, BP_MOVING);
  bp.MapObjectToBroadPhaseLayer(LAYER_RAGDOLL, BP_MOVING);
  bp.MapObjectToBroadPhaseLayer(LAYER_DEBRIS, BP_MOVING);
  const settings = new Jolt.JoltSettings();
  settings.mObjectLayerPairFilter = pairs;
  settings.mBroadPhaseLayerInterface = bp;
  settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(bp, 2, pairs, NUM_LAYERS);
  const jolt = new Jolt.JoltInterface(settings);
  Jolt.destroy(settings);
  const system = jolt.GetPhysicsSystem();
  const bodies = system.GetBodyInterface();
  system.SetGravity(new Jolt.Vec3(0, -9.81, 0));
  return { Jolt, jolt, system, bodies };
}

// The terrain as Jolt's HeightFieldShape (heightfield.html): one height per sample, `spacing` metres apart, centred on the origin.
export function addHeightField(P, heights, n, spacing) {
  const { Jolt, bodies } = P;
  const s = new Jolt.HeightFieldShapeSettings();
  s.mOffset.Set(-(n - 1) * spacing / 2, 0, -(n - 1) * spacing / 2);
  s.mScale.Set(spacing, 1, spacing);
  s.mSampleCount = n;
  s.mBlockSize = 4;
  s.mHeightSamples.resize(n * n);
  const view = new Float32Array(Jolt.HEAPF32.buffer, Jolt.getPointer(s.mHeightSamples.data()), n * n);
  view.set(heights);
  const shape = s.Create().Get();
  const cs = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(0, 0, 0), Jolt.Quat.prototype.sIdentity(), Jolt.EMotionType_Static, LAYER_STATIC);
  cs.mFriction = 0.9;
  const body = bodies.CreateBody(cs);
  bodies.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(cs);
  return body;
}

export function addStaticBox(P, pos, half, rotY = 0) {
  const { Jolt, bodies } = P;
  const q = new Jolt.Quat(0, Math.sin(rotY / 2), 0, Math.cos(rotY / 2));
  const cs = new Jolt.BodyCreationSettings(new Jolt.BoxShape(new Jolt.Vec3(half.x, half.y, half.z), 0.05), new Jolt.RVec3(pos.x, pos.y, pos.z), q, Jolt.EMotionType_Static, LAYER_STATIC);
  const body = bodies.CreateBody(cs); bodies.AddBody(body.GetID(), Jolt.EActivation_DontActivate); Jolt.destroy(cs); Jolt.destroy(q);
  return body;
}

export function addStaticCylinder(P, pos, halfHeight, radius) {
  const { Jolt, bodies } = P;
  const cs = new Jolt.BodyCreationSettings(new Jolt.CylinderShape(halfHeight, radius, 0.05), new Jolt.RVec3(pos.x, pos.y, pos.z), Jolt.Quat.prototype.sIdentity(), Jolt.EMotionType_Static, LAYER_STATIC);
  const body = bodies.CreateBody(cs); bodies.AddBody(body.GetID(), Jolt.EActivation_DontActivate); Jolt.destroy(cs);
  return body;
}

// The player: Jolt's CharacterVirtual (character_virtual.html), a capsule that walks slopes and stairs and sticks to the ground.
export function createCharacter(P, { radius = 0.35, height = 1.1, maxSlopeDeg = 50 } = {}) {
  const { Jolt, jolt, system } = P;
  const shape = new Jolt.RotatedTranslatedShapeSettings(new Jolt.Vec3(0, 0.5 * height + radius, 0), Jolt.Quat.prototype.sIdentity(),
    new Jolt.CapsuleShapeSettings(0.5 * height, radius)).Create().Get();
  const cs = new Jolt.CharacterVirtualSettings();
  cs.mMass = 80;
  cs.mMaxSlopeAngle = maxSlopeDeg * Math.PI / 180;
  cs.mMaxStrength = 100;
  cs.mShape = shape;
  cs.mBackFaceMode = Jolt.EBackFaceMode_CollideWithBackFaces;
  cs.mCharacterPadding = 0.02;
  cs.mPenetrationRecoverySpeed = 1;
  cs.mPredictiveContactDistance = 0.1;
  cs.mSupportingVolume = new Jolt.Plane(Jolt.Vec3.prototype.sAxisY(), -radius);
  const character = new Jolt.CharacterVirtual(cs, Jolt.RVec3.prototype.sZero(), Jolt.Quat.prototype.sIdentity(), system);
  Jolt.destroy(cs);
  // the example's listener: no sliding down a walkable slope while standing still
  const listener = new Jolt.CharacterContactListenerJS();
  let moving = false;
  listener.OnContactSolve = (ch, body2, sub, cpos, cnormal, cvel, cmat, charVel, newVel) => {
    ch = Jolt.wrapPointer(ch, Jolt.CharacterVirtual); cvel = Jolt.wrapPointer(cvel, Jolt.Vec3);
    newVel = Jolt.wrapPointer(newVel, Jolt.Vec3); cnormal = Jolt.wrapPointer(cnormal, Jolt.Vec3);
    if (!moving && cvel.IsNearZero() && !ch.IsSlopeTooSteep(cnormal)) { newVel.SetX(0); newVel.SetY(0); newVel.SetZ(0); }
  };
  for (const k of ['OnAdjustBodyVelocity', 'OnContactAdded', 'OnContactPersisted', 'OnContactRemoved', 'OnCharacterContactAdded', 'OnCharacterContactPersisted', 'OnCharacterContactRemoved', 'OnCharacterContactSolve']) listener[k] = () => {};
  listener.OnContactValidate = () => true; listener.OnCharacterContactValidate = () => true;
  character.SetListener(listener);

  const upd = new Jolt.ExtendedUpdateSettings();
  upd.mStickToFloorStepDown.Set(0, -0.6, 0);
  upd.mWalkStairsStepUp.Set(0, 0.45, 0);
  const bpf = new Jolt.DefaultBroadPhaseLayerFilter(jolt.GetObjectVsBroadPhaseLayerFilter(), LAYER_MOVING);
  const olf = new Jolt.DefaultObjectLayerFilter(jolt.GetObjectLayerPairFilter(), LAYER_MOVING);
  const bf = new Jolt.BodyFilter(), sf = new Jolt.ShapeFilter();
  const tmp = new Jolt.Vec3(), tmpR = new Jolt.RVec3();
  const g = -9.81;
  let vy = 0;

  return {
    character,
    setPosition(x, y, z) { tmpR.Set(x, y, z); character.SetPosition(tmpR); },
    position(out) { const p = character.GetPosition(); return out.set(p.GetX(), p.GetY(), p.GetZ()); },
    onGround() { return character.GetGroundState() === Jolt.EGroundState_OnGround; },
    // the example's handleInput + prePhysicsUpdate, for a character whose up is always +Y
    // launch: an upward speed to add when on the ground (a leaping special); gScale: gravity's multiple for that leap (Pittman's jump)
    step(dt, vx, vz, jump, launch = 0, gScale = 1) {
      moving = Math.hypot(vx, vz) > 1e-6;
      character.UpdateGroundVelocity();
      const onGround = character.GetGroundState() === Jolt.EGroundState_OnGround && !character.IsSlopeTooSteep(character.GetGroundNormal());
      const gv = character.GetGroundVelocity();
      if (onGround && vy <= 0.1) { vy = gv.GetY(); if (jump) vy += 6.2; if (launch) vy += launch; }
      vy += g * gScale * dt;
      tmp.Set(vx, vy, vz); character.SetLinearVelocity(tmp);
      character.ExtendedUpdate(dt, character.GetUp(), upd, bpf, olf, bf, sf, jolt.GetTempAllocator());
      const lv = character.GetLinearVelocity(); vy = lv.GetY();
    },
  };
}
