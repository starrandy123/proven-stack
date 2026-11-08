// The air: three.quarks (MIT) carries the particles — maple leaves falling in the wind, sparks and a red ink spray on a hit, the
// camps' fires — in one batched renderer. The sword's trail is a ribbon of our own between two points on the blade (the base and
// the tip, Unreal's two-socket trail): no openly licensed three.js sword trail exists.
import * as THREE from 'three';
import { BatchedRenderer, ParticleSystem, RenderMode, ConstantValue, IntervalValue, ConstantColor, ColorRange, Vector4, Vector3 as QV3,
  SphereEmitter, ConeEmitter, PointEmitter, ColorOverLife, SizeOverLife, ApplyForce, Noise, RotationOverLife, PiecewiseBezier, Bezier, Gradient } from 'three.quarks';

function leafTexture() {                                                  // a five-lobed maple leaf, painted on a canvas
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.translate(32, 34); g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 27 - Math.abs(i - 5) * 1.6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill(); g.fillRect(-1, 8, 2, 20);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
}

export function createVfx(scene, { phone = false } = {}) {
  const batch = new BatchedRenderer(); scene.add(batch);
  const dot = dotTexture();
  const V4 = (r, g, b, a = 1) => new Vector4(r, g, b, a);

  // falling maple leaves around wherever the ronin is
  const leaves = new ParticleSystem({
    duration: 5, looping: true, worldSpace: true, maxParticle: phone ? 70 : 140,
    startLife: new IntervalValue(7, 11), startSpeed: new IntervalValue(0.2, 0.6), startSize: new IntervalValue(0.12, 0.22),
    startRotation: new IntervalValue(0, Math.PI * 2),
    startColor: new ColorRange(V4(0.85, 0.22, 0.08), V4(0.97, 0.62, 0.16)),
    emissionOverTime: new ConstantValue(phone ? 7 : 14),
    shape: new SphereEmitter({ radius: 22, thickness: 1 }),
    material: new THREE.MeshBasicMaterial({ map: leafTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
    renderMode: RenderMode.BillBoard,
  });
  leaves.addBehavior(new ApplyForce(new QV3(0.35, -1, 0.2), new ConstantValue(0.55)));
  leaves.addBehavior(new Noise(new ConstantValue(0.4), new ConstantValue(1.2), new ConstantValue(1), new ConstantValue(2)));
  leaves.addBehavior(new RotationOverLife(new IntervalValue(-2, 2)));
  scene.add(leaves.emitter); batch.addSystem(leaves);

  // a hit: sparks off the steel and a spray of red ink
  const burst = (color, count, speed, life, size, gravity, additive) => {
    const ps = new ParticleSystem({
      duration: 0.2, looping: false, autoDestroy: false, worldSpace: true, maxParticle: count * 6,
      startLife: new IntervalValue(life * 0.6, life), startSpeed: new IntervalValue(speed * 0.5, speed), startSize: new IntervalValue(size * 0.5, size),
      startColor: new ConstantColor(color), emissionOverTime: new ConstantValue(0),
      emissionBursts: [{ time: 0, count: new ConstantValue(count), cycle: 1, interval: 0.01, probability: 1 }],
      shape: new ConeEmitter({ radius: 0.05, angle: 0.9 }),
      material: new THREE.MeshBasicMaterial({ map: dot, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }),
      renderMode: RenderMode.BillBoard,
    });
    if (gravity) ps.addBehavior(new ApplyForce(new QV3(0, -1, 0), new ConstantValue(gravity)));
    ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.8, 0.4, 0), 0]])));
    scene.add(ps.emitter); batch.addSystem(ps); ps.pause();
    return ps;
  };
  const pools = { spark: [0, 1, 2].map(() => burst(V4(1, 0.85, 0.55), 16, 9, 0.28, 0.09, 6, true)),
                  ink: [0, 1, 2].map(() => burst(V4(0.42, 0.03, 0.03, 0.95), 22, 5, 0.7, 0.16, 14, false)) };
  let turn = 0;
  function hit(pos, dir, ink = true) {
    const i = (turn++) % 3;
    for (const [kind, on] of [['spark', true], ['ink', ink]]) {
      if (!on) continue;
      const ps = pools[kind][i];
      ps.emitter.position.copy(pos); ps.emitter.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().setY(0.5).normalize());
      ps.restart();
    }
  }

  // the camps' fires
  function fire(at) {
    const ps = new ParticleSystem({
      duration: 1, looping: true, worldSpace: false, maxParticle: phone ? 30 : 60,
      startLife: new IntervalValue(0.5, 0.95), startSpeed: new IntervalValue(0.6, 1.4), startSize: new IntervalValue(0.35, 0.7),
      startColor: new ColorRange(V4(1, 0.55, 0.15), V4(1, 0.8, 0.35)), emissionOverTime: new ConstantValue(phone ? 30 : 55),
      shape: new ConeEmitter({ radius: 0.35, angle: 0.25 }),
      material: new THREE.MeshBasicMaterial({ map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      renderMode: RenderMode.BillBoard,
    });
    ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.9, 0.5, 0.1), 0]])));
    ps.addBehavior(new ColorOverLife(new Gradient([[new QV3(1, 0.9, 0.6), 0], [new QV3(0.8, 0.25, 0.05), 1]], [[1, 0], [0, 1]])));
    ps.emitter.position.copy(at); ps.emitter.rotation.x = -Math.PI / 2; scene.add(ps.emitter); batch.addSystem(ps);
    const light = new THREE.PointLight('#ff9a4a', 6, 12, 1.6); light.position.copy(at).add(new THREE.Vector3(0, 1, 0)); scene.add(light);
    return { ps, light };
  }

  // the sword trail: the last N base/tip positions while the blade swings, a fading ribbon
  const N = 14, trailGeo = new THREE.BufferGeometry();
  const tpos = new Float32Array(N * 2 * 3), talpha = new Float32Array(N * 2);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3)); trailGeo.setAttribute('alpha', new THREE.BufferAttribute(talpha, 1));
  const tidx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; tidx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } trailGeo.setIndex(tidx);
  const trailMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * vA, vA); }' });
  const trail = new THREE.Mesh(trailGeo, trailMat); trail.frustumCulled = false; scene.add(trail);
  const hist = []; const b = new THREE.Vector3(), t = new THREE.Vector3();
  function trailUpdate(sword, active) {
    if (active) { sword.userData.base.getWorldPosition(b); sword.userData.tip.getWorldPosition(t); hist.unshift([b.clone(), t.clone()]); }
    else hist.unshift(null);
    hist.length = Math.min(hist.length, N);
    for (let i = 0; i < N; i++) {
      const h = hist[i] || hist.find(Boolean);
      const [p0, p1] = h || [b, b];
      tpos.set([p0.x, p0.y, p0.z], i * 6); tpos.set([p1.x, p1.y, p1.z], i * 6 + 3);
      const a = hist[i] ? Math.pow(1 - i / N, 1.6) * 0.75 : 0; talpha[i * 2] = a * 0.2; talpha[i * 2 + 1] = a;
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.alpha.needsUpdate = true;
  }

  // an ink stroke hung in the air: a dry brush's streaks painted on a canvas, laid on a quad from a to b, fading out
  const brushTex = (() => {                                                 // a sumi-e brush stroke: bristles that taper, dry out and fade at both ends
    const W = 1024, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    for (let i = 0; i < 90; i++) {
      const y0 = H / 2 + (Math.random() - 0.5) * H * 0.62, w = 1 + Math.random() * 4.5, dry = 0.55 + Math.random() * 0.45;
      const x0 = 30 + Math.random() * 120, x1 = W - 40 - Math.random() * 260, bend = (Math.random() - 0.5) * 18;
      for (let x = x0; x < x1; x += 3) {                                 // segment by segment: width tapers, ink skips where the brush dries
        const t = (x - x0) / (x1 - x0), taper = Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.6;
        if (Math.random() > dry + (1 - t) * 0.4) continue;
        g.fillStyle = `rgba(255,255,255,${(0.45 + 0.55 * Math.random()) * taper})`;
        g.fillRect(x, y0 + bend * Math.sin(t * Math.PI) - w * taper / 2, 3.2, Math.max(0.6, w * taper));
      }
    }
    g.globalCompositeOperation = 'destination-in';                       // the whole stroke fades in at the start, out at the tail
    const fade = g.createLinearGradient(0, 0, W, 0); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.06, 'rgba(0,0,0,1)'); fade.addColorStop(0.7, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fade; g.fillRect(0, 0, W, H);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const strokes = [];
  function stroke(a, b, { width = 0.45, color = '#1a0d0b', life = 1.1, up = new THREE.Vector3(0, 1, 0) } = {}) {
    const dir = b.clone().sub(a), len = dir.length(); if (len < 0.1) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), new THREE.MeshBasicMaterial({ map: brushTex, color, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9, fog: false }));
    m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.x = 0.01;
    scene.add(m); strokes.push({ m, t: 0, life, dir: dir.normalize() });
  }
  const _z = new THREE.Vector3(), _y = new THREE.Vector3(), _mm = new THREE.Matrix4();
  function strokeUpdate(dt, camera) {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i]; s.t += dt; const k = s.t / s.life;
      if (camera) {                                                           // turn about its own length to face the camera, like paint on glass
        _z.copy(camera.position).sub(s.m.position); _z.addScaledVector(s.dir, -_z.dot(s.dir)).normalize();
        _y.crossVectors(_z, s.dir); s.m.quaternion.setFromRotationMatrix(_mm.makeBasis(s.dir, _y, _z));
      }
      s.m.scale.x = Math.min(1, s.t / 0.08);                                 // the brush is drawn in 80 ms, then the ink fades
      s.m.material.opacity = 0.95 * (1 - Math.max(0, (k - 0.35) / 0.65));
      if (k >= 1) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); strokes.splice(i, 1); }
    }
  }

  return {
    batch, hit, fire, trailUpdate, stroke, strokeUpdate,
    update(dt, playerPos) { leaves.emitter.position.set(playerPos.x, playerPos.y + 10, playerPos.z); batch.update(dt); },
  };
}
