// What makes the valley feel alive: birds, clouds, wind in the trees.
//  · Birds: Craig Reynolds' boids (1987: separation, alignment, cohesion), with the bird of three.js's own webgl_gpgpu_birds example
//    (MIT: a body and two wings, three triangles, the wing tips flapping by a sine of each bird's phase, the phase running faster as
//    it climbs). Here on the CPU: a few dozen birds cost a phone nothing, where the example's GPGPU needs float render targets.
//  · Clouds: billboard puffs gathered into cumulus, the way drei's <Cloud> builds them (MIT): each cloud a cluster of soft sprites,
//    lit from above and shaded beneath, drifting with the wind. The puff is painted here on a canvas; the oil-paint pass does the rest.
import * as THREE from 'three';

// ── birds ──
function birdGeometry() {                                             // three.js webgl_gpgpu_birds BirdGeometry, one bird, in metres
  const k = 0.022, v = [0, 0, -20, 0, 4, -20, 0, 0, 30, 0, 0, -15, -20, 0, 0, 0, 0, 15, 0, 0, 15, 20, 0, 0, 0, 0, -15].map((x) => x * k);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('birdVertex', new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5, 6, 7, 8], 1));
  return g;
}

export function createBirds(scene, land, { flocks = 3, perFlock = 14 } = {}) {
  const n = flocks * perFlock, geo = birdGeometry();
  const phase = new Float32Array(n); geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phase, 1));
  const crane = new Float32Array(n); geo.setAttribute('crane', new THREE.InstancedBufferAttribute(crane, 1));   // flock 0: white cranes
  const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide,
    vertexShader: `attribute float birdVertex; attribute float phase; attribute float crane; varying vec3 vCol; void main(){ vec3 p = position;
      if (birdVertex == 4.0 || birdVertex == 7.0) p.y = sin(phase) * 0.11;         // the example's flap: the two wing tips
      bool tip = birdVertex == 4.0 || birdVertex == 7.0;
      vCol = crane > 0.5 ? (tip ? vec3(0.08) : vec3(0.95, 0.94, 0.9)) : vec3(0.16, 0.14, 0.13);
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p * (crane > 0.5 ? 2.3 : 1.0), 1.0); }`,
    fragmentShader: 'varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.0); }' });
  const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.frustumCulled = false; scene.add(mesh);
  const birds = [], homes = [];
  for (let f = 0; f < flocks; f++) {
    const home = new THREE.Vector3((Math.random() - 0.5) * 240, 0, (Math.random() - 0.5) * 240); home.y = land.groundY(home.x, home.z) + 28 + Math.random() * 18;
    homes.push(home);
    for (let i = 0; i < perFlock; i++) { crane[birds.length] = f === 0 ? 1 : 0; birds.push({ f, p: home.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 12)),
      v: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(6), ph: Math.random() * 6.28 }); }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1), s1 = new THREE.Vector3(1, 1, 1);
  const sep = new THREE.Vector3(), ali = new THREE.Vector3(), coh = new THREE.Vector3(), tmp = new THREE.Vector3();
  let t = 0;
  return {
    update(dt, playerPos, danger) {
      t += dt;
      homes.forEach((h, f) => { h.x += Math.sin(t * 0.05 + f) * dt * 3; h.z += Math.cos(t * 0.04 + f * 2) * dt * 3; });
      if (playerPos) {                                                   // one flock keeps to the ronin's patch of sky, ahead of him and high
        const want = new THREE.Vector3(playerPos.x + Math.sin(t * 0.12) * 18, playerPos.y + 22, playerPos.z + Math.cos(t * 0.12) * 18);
        homes[0].lerp(want, Math.min(1, dt * 0.4));
      }
      for (const b of birds) {
        sep.set(0, 0, 0); ali.set(0, 0, 0); coh.set(0, 0, 0); let na = 0, nc = 0;
        for (const o of birds) {                                          // the three rules, inside each bird's own flock
          if (o === b || o.f !== b.f) continue;
          tmp.subVectors(o.p, b.p); const d = tmp.length();
          if (d < 2.2) sep.addScaledVector(tmp, -1 / Math.max(d * d, 0.05));
          else if (d < 7) { ali.add(o.v); na++; }
          else if (d < 16) { coh.add(o.p); nc++; }
        }
        const acc = sep.multiplyScalar(4);
        if (na) acc.addScaledVector(ali.divideScalar(na).sub(b.v), 0.6);
        if (nc) acc.addScaledVector(coh.divideScalar(nc).sub(b.p), 0.05);
        acc.addScaledVector(tmp.subVectors(homes[b.f], b.p), 0.012);          // a loose pull home, so each flock circles its own patch of sky
        const flee = playerPos && danger > 0 && b.p.distanceTo(playerPos) < 30;    // a fight below scatters them upward
        if (flee) acc.add(tmp.subVectors(b.p, playerPos).setY(Math.abs(b.p.y - playerPos.y) + 10).normalize().multiplyScalar(6));
        b.v.addScaledVector(acc, dt); const sp = b.v.length(), lim = flee ? 14 : 9;
        if (sp > lim) b.v.multiplyScalar(lim / sp); if (sp < 4) b.v.multiplyScalar(4 / Math.max(sp, 0.01));
        b.v.y *= 1 - 0.6 * dt;                                            // fly around rather than up and down (the example's note)
        b.p.addScaledVector(b.v, dt);
        b.ph = (b.ph + dt * ((b.f === 0 ? 3.2 : 7) + Math.max(b.v.y, 0) * 4)) % 62.83;   // flapping harder when climbing (the example); cranes beat slow
      }
      birds.forEach((b, i) => {
        q.setFromUnitVectors(fwd, tmp.copy(b.v).normalize()); m.compose(b.p, q, s1); mesh.setMatrixAt(i, m); phase[i] = b.ph;
      });
      mesh.instanceMatrix.needsUpdate = true; geo.attributes.phase.needsUpdate = true;
    },
  };
}

// ── clouds ──
function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {                                         // overlapping soft dabs: a cumulus puff, like a brush loaded with white
    const x = 64 + (Math.random() - 0.5) * 50, y = 70 + (Math.random() - 0.5) * 30, r = 22 + Math.random() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function createClouds(scene, { count = 16, phone = false } = {}) {
  const tex = puffTexture(), puffs = [];
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { map: { value: tex }, lit: { value: new THREE.Color('#fff1da') }, shade: { value: new THREE.Color('#a9b6cc') } },
    vertexShader: `attribute float shadeK; varying vec2 vUv; varying float vShade; void main(){
      vUv = uv; vShade = shadeK;
      vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);          // a billboard: the puff always faces the camera
      float s = length(instanceMatrix[0].xyz);
      c.xy += position.xy * s; gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 lit; uniform vec3 shade; varying vec2 vUv; varying float vShade; void main(){
      vec4 t = texture2D(map, vUv); vec3 col = mix(shade, lit, clamp(vUv.y * 0.9 + 0.1 - vShade * 0.5, 0.0, 1.0));
      if (t.a < 0.02) discard; gl_FragColor = vec4(col, t.a * 0.95); }` });
  const per = phone ? 7 : 10, n = count * per;
  const shadeK = new Float32Array(n); geo.setAttribute('shadeK', new THREE.InstancedBufferAttribute(shadeK, 1));
  const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.frustumCulled = false; mesh.renderOrder = -1; scene.add(mesh);
  const clouds = [];
  for (let c = 0; c < count; c++) {
    const a = Math.random() * Math.PI * 2, r = 180 + Math.random() * 340, center = new THREE.Vector3(Math.cos(a) * r, 70 + Math.random() * 80, Math.sin(a) * r);
    const size = 30 + Math.random() * 40, cl = { center, items: [] };
    for (let i = 0; i < per; i++) {
      const off = new THREE.Vector3((Math.random() - 0.5) * size * 1.6, (Math.random() - 0.2) * size * 0.45, (Math.random() - 0.5) * size * 0.8);
      cl.items.push({ off, s: size * (0.55 + Math.random() * 0.5), k: c * per + i });
      shadeK[c * per + i] = THREE.MathUtils.clamp(-off.y / (size * 0.45), 0, 1);
    }
    clouds.push(cl);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const wind = new THREE.Vector3(2.2, 0, 0.8);
  return {
    update(dt) {
      for (const cl of clouds) {
        cl.center.addScaledVector(wind, dt); if (cl.center.x > 520) cl.center.x -= 1040;
        for (const it of cl.items) { p.copy(cl.center).add(it.off); s.setScalar(it.s); m.compose(p, q, s); mesh.setMatrixAt(it.k, m); }
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ── wind in the maples: their leaves sway, a little more at the tips (a vertex offset by height and a slow travelling wave) ──
export function swayLeaves(scene) {
  const uniforms = { time: { value: 0 } };
  scene.traverse((o) => {
    if (!o.isInstancedMesh || !o.material || !o.material.map || o.material.userData.sway) return;
    o.material.userData.sway = true;
    o.material.onBeforeCompile = (shader) => {
      shader.uniforms.swayTime = uniforms.time;
      shader.vertexShader = 'uniform float swayTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3].x, 0.0, instanceMatrix[3].z);
        float h = max(position.y, 0.0);
        transformed.x += sin(swayTime * 1.3 + ip.x * 0.07 + position.y * 0.6) * 0.035 * h;
        transformed.z += cos(swayTime * 1.1 + ip.z * 0.07) * 0.025 * h;`);
    };
    o.material.needsUpdate = true;
  });
  return { update(dt) { uniforms.time.value += dt; } };
}
