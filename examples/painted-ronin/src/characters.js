// The people: Quaternius's CC0 base character and outfits on one rig, moved by his CC0 Universal Animation Libraries (one skeleton
// for the ronin, the bandits and every clip), played by three.js's AnimationMixer. The samurai pieces (the kasa, the katana and its
// scabbard) are made here from simple shapes: no free samurai model exists under a licence a game may ship.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const load = (url) => new Promise((ok, no) => loader.load(url, ok, undefined, no));

export async function loadCharacterKit() {
  const [ronin, bandit, a1, a2] = await Promise.all(['assets/quaternius/ronin.glb', 'assets/quaternius/bandit.glb',
    'assets/quaternius/anims_ual1.glb', 'assets/quaternius/anims_ual2.glb'].map(load));
  const clips = {};
  for (const c of [...a1.animations, ...a2.animations]) {
    // the clips move the root bone's translation; the game moves the body, so the root stays where physics puts it
    c.tracks = c.tracks.filter((t) => !(t.name.startsWith('root.') && t.name.endsWith('.position')));
    clips[c.name] = c;
  }
  return { ronin: ronin.scene, bandit: bandit.scene, clips };
}

// ── the samurai pieces ──
function kasa() {                                                         // a straw hat: a shallow cone with a curled rim
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; const r = 0.02 + 0.29 * t; const y = 0.15 * (1 - Math.pow(t, 0.85)) - 0.015 * Math.max(0, t - 0.85) / 0.15; pts.push(new THREE.Vector2(r, y)); }
  const g = new THREE.LatheGeometry(pts, 28);
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) {                // woven rings: lighter and darker bands of straw
    const x = g.attributes.position.getX(i), z = g.attributes.position.getZ(i), r = Math.hypot(x, z);
    const band = 0.85 + 0.15 * Math.sin(r * 90) * 0.5 + 0.1 * Math.sin(Math.atan2(z, x) * 14) * 0.3;
    col.set([0.79 * band, 0.64 * band, 0.38 * band], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = true; return m;
}
function katana() {                                                       // blade along +Y from the grip, edge toward +Z
  const group = new THREE.Group();
  const bladeShape = new THREE.Shape(); const L = 0.74, W = 0.034;
  bladeShape.moveTo(0, 0); bladeShape.quadraticCurveTo(0.012, L * 0.5, 0.03, L); bladeShape.lineTo(0.03 - W * 0.3, L + 0.035);
  bladeShape.quadraticCurveTo(-W * 0.55, L * 0.55, -W, 0); bladeShape.lineTo(0, 0);
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: 0.006, bevelEnabled: false }).translate(0, 0.13, -0.003).rotateY(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#eef1f5', metalness: 0.35, roughness: 0.3, emissive: '#30343c' }));
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16).translate(0, 0.12, 0), new THREE.MeshStandardMaterial({ color: '#2a2422', metalness: 0.6, roughness: 0.5 }));
  const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.25, 10).translate(0, 0.0, 0), new THREE.MeshStandardMaterial({ color: '#3a1d1a', roughness: 0.8 }));
  for (const m of [blade, tsuba, tsuka]) { m.castShadow = true; group.add(m); }
  group.userData.tip = new THREE.Object3D(); group.userData.tip.position.set(0, 0.13 + L + 0.03, 0); group.add(group.userData.tip);
  group.userData.base = new THREE.Object3D(); group.userData.base.position.set(0, 0.16, 0); group.add(group.userData.base);
  return group;
}
function saya() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.8, 8), new THREE.MeshStandardMaterial({ color: '#16120f', roughness: 0.6 }));
  m.castShadow = true; return m;
}

// attach a piece to a bone so that, in the pose the skeleton has NOW, the piece sits at a world placement we choose
function attach(bone, piece, worldPos, worldQuat) {
  bone.updateWorldMatrix(true, false);
  const inv = new THREE.Matrix4().copy(bone.matrixWorld).invert();
  const want = new THREE.Matrix4().compose(worldPos, worldQuat, new THREE.Vector3(1, 1, 1));
  const local = new THREE.Matrix4().multiplyMatrices(inv, want);
  local.decompose(piece.position, piece.quaternion, piece.scale);
  bone.add(piece);
}

export class Person {
  constructor(kit, kind, { tint = null } = {}) {
    this.root = new THREE.Group();
    this.model = cloneSkinned(kind === 'ronin' ? kit.ronin : kit.bandit);
    this.root.add(this.model);
    this.bones = {};
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (tint && o.material && /Ranger|Peasant/.test(o.material.name)) { o.material = o.material.clone(); o.material.color.copy(tint); } }
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = kit.clips;
    this.actions = {};
    this.current = null;
    this.locomotion = null;
    // dress the samurai in the bind pose, facing +Z (the model's forward)
    this.model.updateMatrixWorld(true);
    const head = this.bones.Head, handR = this.bones.hand_r, pelvis = this.bones.pelvis;
    const hp = new THREE.Vector3(); head.getWorldPosition(hp);
    this.hat = kasa(); attach(head, this.hat, hp.clone().add(new THREE.Vector3(0, 0.14, 0.035)), new THREE.Quaternion());
    if (kind !== 'ronin') this.hat.visible = false;
    this.sword = katana();
    const hr = new THREE.Vector3(); handR.getWorldPosition(hr);
    // the grip, from the hand's own anatomy: the fingers point along the hand (hand → middle finger), and a gripped blade leaves the
    // fist on the thumb's side, square to the fingers (hand → thumb, with the along-the-fingers part removed)
    const mid = new THREE.Vector3(); this.bones.middle_01_r.getWorldPosition(mid);
    const thumb = new THREE.Vector3(); this.bones.thumb_02_r.getWorldPosition(thumb);
    const along = mid.clone().sub(hr).normalize();
    const bladeDir = thumb.clone().sub(hr); bladeDir.addScaledVector(along, -bladeDir.dot(along)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), bladeDir);
    attach(handR, this.sword, hr.clone().addScaledVector(along, 0.07).addScaledVector(bladeDir, -0.13), q);
    const pp = new THREE.Vector3(); pelvis.getWorldPosition(pp);
    this.scabbard = saya(); attach(pelvis, this.scabbard, pp.clone().add(new THREE.Vector3(0.17, 0.0, 0.05)), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, 0, 0.25)));
  }
  action(name) {
    if (!this.actions[name]) { const c = this.clips[name]; if (!c) throw new Error('no clip ' + name); this.actions[name] = this.mixer.clipAction(c); }
    return this.actions[name];
  }
  // a looping clip (idle, walk, run) blended by speed; a one-shot clip (a strike, a roll, a hit) plays over it and returns
  play(name, { loop = true, fade = 0.18, speed = 1, onEnd = null } = {}) {
    const next = this.action(name);
    if (this.current === next && loop) return next;
    next.reset(); next.enabled = true; next.setEffectiveTimeScale(speed); next.setEffectiveWeight(1);
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); next.clampWhenFinished = !loop;
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false); else next.fadeIn(fade);
    next.play();
    this.current = next; this.oneShot = loop ? null : name;
    if (!loop) {
      const done = (e) => { if (e.action !== next) return; this.mixer.removeEventListener('finished', done); this.oneShot = null; if (onEnd) onEnd(); };
      this.mixer.addEventListener('finished', done);
    }
    return next;
  }
  // idle / walk / jog / sprint by the speed the body actually moves
  move(speed) {
    if (this.oneShot) return;
    const name = speed < 0.3 ? (this.armed ? 'Sword_Idle' : 'Idle_Loop') : speed < 2.6 ? 'Walk_Loop' : speed < 5.6 ? 'Jog_Fwd_Loop' : 'Sprint_Loop';
    const a = this.play(name, { loop: true, fade: 0.22 });
    if (name === 'Walk_Loop') a.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 1.6, 0.6, 1.4));
    if (name === 'Jog_Fwd_Loop') a.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 4.0, 0.7, 1.35));
  }
  update(dt) { this.mixer.update(dt); }
}
