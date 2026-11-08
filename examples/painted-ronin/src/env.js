// What stands on the land: Quaternius's CC0 torii gate, temple, maple trees and bamboo, and Matt Newell's CC-BY stone lantern
// (all from Poly Pizza), placed by rules on the one height function, each with a Jolt collider; plus rocks and the camps'
// banners, made here from simple shapes. Trees and bamboo are instanced (one draw per variant), so a forest costs a phone little.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { addStaticCylinder, addStaticBox } from './physics.js';
import { RAMP, col, paintSurface, WIND } from './paint.js';

const loader = new GLTFLoader();
const load = (url) => new Promise((ok, no) => loader.load(url, ok, undefined, no));

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// one InstancedMesh per mesh inside a model, all sharing the same placements
function instanced(model, mats, scene) {
  const out = [];
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
    const local = o.matrixWorld.clone();
    mats.forEach((m, i) => im.setMatrixAt(i, m.clone().multiply(local)));
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    if (o.material.map) { o.material.alphaTest = 0.4; o.material.side = THREE.DoubleSide; }
    scene.add(im); out.push(im);
  });
  return out;
}

export async function buildEnvironment(scene, land, P) {
  const [torii, temple, maples, bamboo, toro] = await Promise.all(['torii_gate', 'temple', 'maple_trees', 'bamboo', 'toro_lantern'].map((n) => load(`assets/polypizza/${n}.glb`)));
  const r = rng(42), S = land.spots, obstacles = [], placed = [];
  const free = (x, z, rad) => {
    if (Math.hypot(x, z) > 200) return false;
    for (const c of [S.spawn, S.shrine, ...S.camps]) if (Math.hypot(x - c.x, z - c.y) < (c === S.spawn ? 9 : 22) + rad) return false;
    for (const p of placed) if (Math.hypot(x - p.x, z - p.z) < p.r + rad) return false;
    const n = land.normal(x, z); return n.y > 0.88;
  };
  const M = (x, y, z, ry, s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));

  // the shrine on its hill: a temple, the torii before it facing the valley, stone lanterns lining the approach
  const sx = S.shrine.x, sz = S.shrine.y, sy = land.groundY(sx, sz);
  const face = Math.atan2(S.spawn.x - sx, S.spawn.y - sz);                       // the shrine looks toward where you wake
  const fwd = new THREE.Vector3(Math.sin(face), 0, Math.cos(face)), side = new THREE.Vector3(fwd.z, 0, -fwd.x);
  const t = temple.scene; t.scale.setScalar(3); t.position.set(sx - fwd.x * 3, sy - 0.05, sz - fwd.z * 3); t.rotation.y = face; scene.add(t);
  addStaticBox(P, new THREE.Vector3(sx - fwd.x * 3, sy + 3, sz - fwd.z * 3), new THREE.Vector3(2.7, 3, 4.2), face);
  const g = torii.scene; const gx = sx + fwd.x * 9, gz = sz + fwd.z * 9; g.position.set(gx, land.groundY(gx, gz) - 0.1, gz); g.rotation.y = face; scene.add(g);
  for (const k of [-1, 1]) addStaticCylinder(P, new THREE.Vector3(gx + side.x * 2.15 * k, land.groundY(gx, gz) + 2.5, gz + side.z * 2.15 * k), 2.5, 0.25);
  for (let i = 0; i < 3; i++) for (const k of [-1, 1]) {
    const lx = sx + fwd.x * (12 + i * 5) + side.x * 2.8 * k, lz = sz + fwd.z * (12 + i * 5) + side.z * 2.8 * k;
    const l = toro.scene.clone(); l.scale.setScalar(3); l.position.set(lx, land.groundY(lx, lz) - 0.05, lz); l.rotation.y = face; scene.add(l);
    addStaticBox(P, new THREE.Vector3(lx, land.groundY(lx, lz) + 0.9, lz), new THREE.Vector3(0.3, 0.9, 0.3));
  }
  placed.push({ x: sx, z: sz, r: 14 });
  for (const o of [t, g]) o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  // maple forest: the five variants in Quaternius's file, each instanced, scattered by rejection on gentle ground
  const variants = maples.scene.children[0].children.length ? maples.scene.children[0].children : maples.scene.children;
  const per = variants.map(() => []);
  for (let i = 0, tries = 0; i < 90 && tries < 4000; tries++) {
    const x = (r() - 0.5) * 380, z = (r() - 0.5) * 380; if (!free(x, z, 3)) continue;
    const y = land.groundY(x, z), v = i % variants.length, s = 0.8 + r() * 0.5, ry = r() * Math.PI * 2;
    const vb = new THREE.Box3().setFromObject(variants[v]); const c = vb.getCenter(new THREE.Vector3());
    per[v].push(M(x, y - 0.2, z, ry, s).multiply(new THREE.Matrix4().makeTranslation(-c.x, -vb.min.y, -c.z)));
    placed.push({ x, z, r: 3 }); obstacles.push({ x, z, r: 0.45 * s, h: 3 }); addStaticCylinder(P, new THREE.Vector3(x, y + 1.5, z), 1.5, 0.3 * s);
    i++;
  }
  variants.forEach((v, i) => { if (per[i].length) { const holder = new THREE.Group(); holder.add(v.clone()); instanced(holder, per[i], scene); } });

  // bamboo groves near the camps (a camp hides in bamboo)
  const bam = [];
  for (const c of S.camps) for (let i = 0, tries = 0; i < 9 && tries < 300; tries++) {
    const a = r() * Math.PI * 2, d = 24 + r() * 16, x = c.x + Math.cos(a) * d, z = c.y + Math.sin(a) * d; if (!free(x, z, 1.2)) continue;
    const s = 1.6 + r() * 0.8; bam.push(M(x, land.groundY(x, z) - 0.1, z, r() * 6.28, s)); placed.push({ x, z, r: 1.4 }); obstacles.push({ x, z, r: 0.9, h: 6 });
    addStaticCylinder(P, new THREE.Vector3(x, land.groundY(x, z) + 3, z), 3, 0.7); i++;
  }
  const bamHolder = new THREE.Group(); bamHolder.add(bamboo.scene); instanced(bamHolder, bam, scene);

  // rocks: noise-displaced stones, painted: three bands of light (the one ramp) and oil strokes laid on them in the world (the one atlas)
  const rockGeo = new THREE.IcosahedronGeometry(1, 2), pos = rockGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pos, i); const n = 0.75 + 0.35 * Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.3); v.multiplyScalar(n); v.y *= 0.7; pos.setXYZ(i, v.x, v.y, v.z); }
  rockGeo.computeVertexNormals();
  const rocks = [];
  for (let i = 0, tries = 0; i < 45 && tries < 3000; tries++) {
    const x = (r() - 0.5) * 400, z = (r() - 0.5) * 400; const s = 0.6 + r() * 1.8; if (!free(x, z, s)) continue;
    const y = land.groundY(x, z); rocks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + s * 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), new THREE.Vector3(s, s, s)));
    placed.push({ x, z, r: s }); obstacles.push({ x, z, r: s * 0.9, h: s }); addStaticBox(P, new THREE.Vector3(x, y + s * 0.3, z), new THREE.Vector3(s * 0.75, s * 0.55, s * 0.75)); i++;
  }
  const rockMesh = new THREE.InstancedMesh(rockGeo, paintSurface(new THREE.MeshToonMaterial({ color: col('stone'), gradientMap: RAMP }), { region: 'field_a', scale: 0.9, strength: 0.5, band: 0.4 }), rocks.length);
  rockMesh.name = 'painted-rocks';
  rocks.forEach((m, i) => rockMesh.setMatrixAt(i, m)); rockMesh.castShadow = rockMesh.receiveShadow = true; scene.add(rockMesh);

  // the camps: a fire ring, war banners (sashimono) on poles, a lantern
  const camps = S.camps.map((c, ci) => {
    const y = land.groundY(c.x, c.y), group = new THREE.Group(); group.position.set(c.x, y, c.y); scene.add(group);
    const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.22, 1), paintSurface(new THREE.MeshToonMaterial({ color: col('stoneShade'), gradientMap: RAMP }), { region: 'field_a', scale: 2.4, strength: 0.5, band: 0.4 }), 10);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; stones.setMatrixAt(i, new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8)); }
    group.add(stones);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.4, bx = Math.cos(a) * 7, bz = Math.sin(a) * 7, by = land.groundY(c.x + bx, c.y + bz) - y;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.2, 6), new THREE.MeshToonMaterial({ color: col('ink'), gradientMap: RAMP }));
      pole.position.set(bx, by + 2.1, bz); group.add(pole);
      // a banner flies downwind (the one wind): its width laid along it, its cloth painted with the atlas's oil strokes
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.9, 1, 8), paintSurface(new THREE.MeshToonMaterial({ color: col(ci === 1 ? 'ink' : 'crimson'), gradientMap: RAMP, side: THREE.DoubleSide }), { region: 'field_b', scale: 2.2, strength: 0.4, band: 0.3 }));
      flag.position.set(bx + WIND.x * 0.36, by + 3.0, bz + WIND.z * 0.36); flag.userData.wave = r() * 6; flag.userData.base = Math.atan2(-WIND.z, WIND.x); flag.rotation.y = flag.userData.base; group.add(flag);
      group.userData.flags = (group.userData.flags || []).concat(flag);
      addStaticCylinder(P, new THREE.Vector3(c.x + bx, y + by + 2, c.y + bz), 2, 0.08);
      obstacles.push({ x: c.x + bx, z: c.y + bz, r: 0.15, h: 4 });
    }
    const l = toro.scene.clone(); l.scale.setScalar(3); l.position.set(3, land.groundY(c.x + 3, c.y) - y, 0); group.add(l);
    return { center: new THREE.Vector3(c.x, y, c.y), group };
  });
  return { camps, obstacles, shrine: { pos: new THREE.Vector3(sx, sy, sz), face } };
}

// the obstacle shapes Recast reads for a camp's navmesh (trunks, rocks, poles), as plain meshes
export function obstacleMeshes(obstacles, land, center, half) {
  const out = [];
  for (const o of obstacles) {
    if (Math.abs(o.x - center.x) > half || Math.abs(o.z - center.y) > half) continue;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, o.h + 2, 8));
    m.position.set(o.x, land.groundY(o.x, o.z) + o.h / 2, o.z); m.updateMatrixWorld(true); out.push(m);
  }
  return out;
}
