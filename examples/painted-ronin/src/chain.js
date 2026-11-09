// THE MARKS (筆, part 2) — in the held moment a stroke drawn across a bandit MARKS him; when the brush closes the ronin takes the marked in
// the order they were marked (research L §4 and §6 C: ContentFunnel/engine/assets/receipts/2026-11-07_stack/research/L_brush_chain.md).
// The owner after take 5: "I want to do it to enemies and dash to them too like the fear takedown in Arkham knight". The mechanic is
// Batman: Arkham Knight's Fear Multi-Takedown at its published word (research E), never its look; and the shipped mark-and-execute games
// agree (research G): a small hard cap ("you're never going to get twelve marks", Ubisoft's Alexandre Parizeau on Splinter Cell:
// Conviction; Ghost of Tsushima's chains of three), paid for (Conviction earns it with a takedown; here an ink pot a mark, Ōkami's pots), the
// mark ON the enemy in the world (Sucker Punch: shown "without utilising UI"), and the marked taken "in rapid succession" on release
// (Conviction). Which order a game takes its marks in is published by none of them: in the order marked is OURS.
// A stroke counts by its DIRECTION through him, not his exact pixels (Fruit Ninja's Luke Muscat: "You want the collision in the game to
// feel gamey, not realistic", research K §6): the stroke's segment on the screen passes within his drawn half-width of his head, chest or
// hips. A mark is his stroke's ANGLE on the screen; the plane he is cut on is made at his takedown from the ronin's approach (research L §6
// C.2), so a mark drawn from far away never faces the second dash square-on.
import * as THREE from 'three';

export const CHAIN = {
  range: 9, max: 3,                    // m from the ronin (ours, the handoff's; research E's range replaces it if published) · marks (S, above)
  halfWidth: 0.32,                     // m: a bandit's drawn half-width at the chest (ours, a body's shoulders)
  heights: [1.62, 1.25, 0.92],         // m over his feet: head, chest, hips (ours, the Quaternius bandit stands ~1.8 m)
  markLen: 0.95,                       // m: the crimson stroke laid across him (ours: shoulder to shoulder and a little past)
};

// the screen point of a world point (CSS px, y down), and whether it is in front of the camera
function screen(camera, p, out) { const q = p.clone().project(camera); out.x = (q.x + 1) / 2 * innerWidth; out.y = (1 - q.y) / 2 * innerHeight; out.front = q.z < 1; return out; }
// the distance on the screen from a point to a segment
function segDist(px, py, x0, y0, x1, y1) { const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy, t = L > 1e-6 ? THREE.MathUtils.clamp(((px - x0) * dx + (py - y0) * dy) / L, 0, 1) : 0;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy)); }

// the line through a world point at a screen angle, as a world direction: two screen points either side of the point's own, laid back onto
// the plane through it that faces the eye (blade.js's aimPlane does the same for the mats)
const _ray = new THREE.Raycaster(), _n2 = new THREE.Vector2();
export function screenLineDir(camera, at, theta, out = new THREE.Vector3()) {
  const s = screen(camera, at, {}), e = 24, fn = camera.position.clone().sub(at).normalize(), pl = new THREE.Plane().setFromNormalAndCoplanarPoint(fn, at);
  const hit = (x, y) => { _n2.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); _ray.setFromCamera(_n2, camera); return _ray.ray.intersectPlane(pl, new THREE.Vector3()); };
  const a = hit(s.x - Math.cos(theta) * e, s.y + Math.sin(theta) * e), b = hit(s.x + Math.cos(theta) * e, s.y - Math.sin(theta) * e);
  return a && b && a.distanceToSquared(b) > 1e-10 ? out.copy(b).sub(a).normalize() : out.set(1, 0, 0);
}

// the plane a marked bandit is cut on, at his takedown: through his chest, holding the ronin's approach (his shoulder → that chest) and the
// marked angle rolled about it (theta from the screen's right, counter-clockwise, as the stroke was drawn; the eye was behind the ronin)
export function markPlane(b, theta, from, out = { n: new THREE.Vector3(), o: new THREE.Vector3(), dir: new THREE.Vector3() }) {
  out.o.copy(b.root.position); out.o.y += CHAIN.heights[1];
  const f = out.o.clone().sub(from).normalize(), R = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
  if (R.lengthSq() < 1e-8) R.set(1, 0, 0); R.normalize();
  const U = new THREE.Vector3().crossVectors(R, f).normalize();
  out.dir.copy(R).multiplyScalar(Math.cos(theta)).addScaledVector(U, Math.sin(theta)).normalize();
  out.n.crossVectors(out.dir, f).normalize(); return out;
}

export function createMarks({ scene, camera, vfx, strokeMaterial, plant = null }) {
  const marks = [], tmp = new THREE.Vector3();
  // does a stroke from (x0, y0) to (x1, y1) on the screen cross this standing bandit (within reach of the ronin at `me`)?
  function crosses(b, me, x0, y0, x1, y1) {
    if (b.dead || b.root.position.distanceTo(me) > CHAIN.range) return false;
    for (const h of CHAIN.heights) {
      const p = b.root.position.clone(); p.y += h; const s = screen(camera, p, {}); if (!s.front) return false;
      const side = screen(camera, p.clone().addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), CHAIN.halfWidth), {});
      if (segDist(s.x, s.y, x0, y0, x1, y1) <= Math.hypot(side.x - s.x, side.y - s.y)) return true;
    }
    return false;
  }
  // mark him (a new mark costs the caller a pot; a stroke across one already marked sets his angle again, free)
  function add(b, theta) {
    const old = marks.find((m) => m.b === b); if (old) { old.theta = theta; return 'again'; }
    if (marks.length >= CHAIN.max && plant !== 'chfour') return 'full';
    const enso = vfx.enso.clone(); enso.material = vfx.enso.material.clone(); enso.visible = true; enso.material.opacity = 0; scene.add(enso);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), strokeMaterial()); line.renderOrder = 3; line.frustumCulled = false; line.userData.painted = 'stroke'; scene.add(line);
    marks.push({ b, theta, enso, line, a: 0 }); return 'marked';
  }
  // every frame (real seconds): each mark's ensō under him and his crimson stroke across his chest, at his angle, facing the eye
  function update(dt) {
    for (const m of marks) {
      m.a = Math.min(1, m.a + dt / 0.18);
      const p = m.b.root.position; m.enso.position.set(p.x, p.y + 0.06, p.z); m.enso.material.opacity = m.a;
      const c = p.clone(); c.y += CHAIN.heights[1]; const d = screenLineDir(camera, c, m.theta, tmp), z = camera.position.clone().sub(c); z.addScaledVector(d, -z.dot(d)).normalize();
      m.line.position.copy(c).addScaledVector(camera.position.clone().sub(c).normalize(), 0.3); m.line.scale.set(CHAIN.markLen, 0.06, 1);   // on his front, toward the eye
      m.line.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, new THREE.Vector3().crossVectors(z, d), z));
      if (m.line.material.uniforms && m.line.material.uniforms.on) m.line.material.uniforms.on.value = m.a; else m.line.material.opacity = 0.95 * m.a;
    }
  }
  // the chain takes them: the marks in their order, their pictures with them until each is taken (drop(b) when he falls)
  function take() { return marks.map((m) => ({ b: m.b, theta: m.theta })); }
  function drop(b) { const i = marks.findIndex((m) => m.b === b); if (i < 0) return; const m = marks[i];
    scene.remove(m.enso); m.enso.material.dispose(); scene.remove(m.line); m.line.geometry.dispose(); m.line.material.dispose(); marks.splice(i, 1); }
  function clear() { while (marks.length) drop(marks[0].b); }
  return { marks, crosses, add, update, take, drop, clear, get count() { return marks.length; } };
}
