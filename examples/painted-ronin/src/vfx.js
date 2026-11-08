// The air: three.quarks (MIT) carries the particles — maple leaves falling in the wind, sparks and a red ink spray on a hit, the
// camps' fires and their smoke — in one batched renderer. Every mark is a stamp from the ONE brush atlas (paint.js: MyPaint's strokes),
// coloured from the one palette, moved by the one wind: leaves are oil dabs, smoke is oil puffs that erode as they die (Simon Trümpler on
// RIME: the alpha is "responsible for the alpha fading/erosion/threshold"), the ink spray is the brush's own flecks. The sword's trail is a ribbon of our own between two points on the blade (the base and
// the tip, Unreal's two-socket trail): no openly licensed three.js sword trail exists.
import * as THREE from 'three';
import { paint, rect, col, PAINT_GLSL, atlasUniforms, WIND } from './paint.js';
import { BatchedRenderer, ParticleSystem, RenderMode, ConstantValue, IntervalValue, ConstantColor, ColorRange, Vector4, Vector3 as QV3,
  SphereEmitter, ConeEmitter, PointEmitter, ColorOverLife, SizeOverLife, ApplyForce, Noise, RotationOverLife, PiecewiseBezier, Bezier, Gradient } from 'three.quarks';

function leafTexture() {                                                  // a five-lobed maple leaf, painted on a canvas
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.translate(32, 34); g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 27 - Math.abs(i - 5) * 1.6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill(); g.fillRect(-1, 8, 2, 20);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createVfx(scene, { phone = false, plant = null } = {}) {
  const batch = new BatchedRenderer(); scene.add(batch);
  const atlas = paint.atlas;
  const sw = (name, a = 1) => { const c = col(name); return new Vector4(c.r, c.g, c.b, a); };         // a palette swatch as a particle colour
  const tiles = { uTileCount: 4, vTileCount: 4 };                                                     // the atlas's 4×4 grid (rows 0-1 are long strokes)
  const T = (name) => paint.regions[name].tile;
  const V4 = (r, g, b, a = 1) => new Vector4(r, g, b, a);

  // falling maple leaves around wherever the ronin is
  const leaves = new ParticleSystem({
    duration: 5, looping: true, worldSpace: true, maxParticle: phone ? 70 : 140,
    startLife: new IntervalValue(7, 11), startSpeed: new IntervalValue(0.2, 0.6), startSize: new IntervalValue(0.12, 0.22),
    startRotation: new IntervalValue(0, Math.PI * 2),
    startColor: new ColorRange(sw('maple'), sw('gold')),
    emissionOverTime: new ConstantValue(phone ? 7 : 14),
    shape: new SphereEmitter({ radius: 22, thickness: 1 }),
    material: plant === 'leafcanvas' ? new THREE.MeshBasicMaterial({ map: leafTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ map: atlas, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
    ...(plant === 'leafcanvas' ? {} : tiles), startTileIndex: new IntervalValue(T('dab_oil'), T('leaf') + 0.999),
    renderMode: RenderMode.BillBoard,
  });
  leaves.addBehavior(new ApplyForce(new QV3(WIND.x * 0.6, -1, WIND.z * 0.6), new ConstantValue(0.55)));      // falling, carried by the one wind
  leaves.addBehavior(new Noise(new ConstantValue(0.4), new ConstantValue(1.2), new ConstantValue(1), new ConstantValue(2)));
  leaves.addBehavior(new RotationOverLife(new IntervalValue(-2, 2)));
  leaves.userData = { painted: 'leaves', wind: new THREE.Vector3(WIND.x * 0.6, 0, WIND.z * 0.6) }; scene.add(leaves.emitter); batch.addSystem(leaves);

  // a hit: sparks off the steel and a spray of red ink
  const burst = (color, count, speed, life, size, gravity, additive, tile) => {
    const ps = new ParticleSystem({
      duration: 0.2, looping: false, autoDestroy: false, worldSpace: true, maxParticle: count * 6,
      startLife: new IntervalValue(life * 0.6, life), startSpeed: new IntervalValue(speed * 0.5, speed), startSize: new IntervalValue(size * 0.5, size),
      startColor: new ConstantColor(color), emissionOverTime: new ConstantValue(0),
      emissionBursts: [{ time: 0, count: new ConstantValue(count), cycle: 1, interval: 0.01, probability: 1 }],
      shape: new ConeEmitter({ radius: 0.05, angle: 0.9 }),
      material: new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }),
      ...tiles, startTileIndex: new ConstantValue(tile), startRotation: new IntervalValue(0, Math.PI * 2),
      renderMode: RenderMode.BillBoard,
    });
    if (gravity) ps.addBehavior(new ApplyForce(new QV3(0, -1, 0), new ConstantValue(gravity)));
    ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.8, 0.4, 0), 0]])));
    scene.add(ps.emitter); batch.addSystem(ps); ps.pause();
    return ps;
  };
  const pools = { spark: [0, 1, 2].map(() => burst(sw('gold'), 16, 9, 0.28, 0.11, 6, true, T('dab_oil'))),
                  ink: [0, 1, 2].map(() => burst(sw('crimson', 0.95), 22, 5, 0.7, 0.22, 14, false, T('flecks'))) };
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
  const smokes = [];
  function fire(at) {
    const ps = new ParticleSystem({
      duration: 1, looping: true, worldSpace: false, maxParticle: phone ? 30 : 60,
      startLife: new IntervalValue(0.5, 0.95), startSpeed: new IntervalValue(0.6, 1.4), startSize: new IntervalValue(0.35, 0.7),
      startColor: new ConstantColor(new Vector4(1, 1, 1, 1)), emissionOverTime: new ConstantValue(phone ? 30 : 55),   // white: quarks multiplies the over-life colour by it
      shape: new ConeEmitter({ radius: 0.35, angle: 0.25 }),
      material: new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      ...tiles, startTileIndex: new IntervalValue(T('dab_oil'), T('dab_oil') + 0.999), startRotation: new IntervalValue(-0.4, 0.4),
      renderMode: RenderMode.BillBoard,
    });
    ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.9, 0.5, 0.1), 0]])));
    { const g = col('gold'), e = col('ember'); ps.addBehavior(new ColorOverLife(new Gradient([[new QV3(g.r, g.g, g.b), 0], [new QV3(e.r, e.g, e.b), 1]], [[1, 0], [0, 1]]))); }
    ps.emitter.position.copy(at); ps.emitter.rotation.x = -Math.PI / 2; scene.add(ps.emitter); batch.addSystem(ps);
    const smoke = new ParticleSystem({                                      // smoke rising off the fire, drifting with the wind
      duration: 3, looping: true, worldSpace: true, maxParticle: phone ? 18 : 34,
      startLife: new IntervalValue(3.5, 5.5), startSpeed: new IntervalValue(0.5, 0.9), startSize: new IntervalValue(0.6, 1.1),
      startColor: new ConstantColor(new Vector4(1, 1, 1, 1)), emissionOverTime: new ConstantValue(phone ? 4 : 7),     // white: the swatches ride the over-life colour
      shape: new ConeEmitter({ radius: 0.3, angle: 0.15 }),
      // erosion, not a fade (Trümpler): the puff keeps a hard painted edge while alphaTest eats it from its thin parts inward
      material: new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, alphaTest: 0.32 }), renderMode: RenderMode.BillBoard,
      ...tiles, startTileIndex: new IntervalValue(T('puff_a'), T('puff_b') + 0.999), startRotation: new IntervalValue(0, Math.PI * 2),
    });
    smoke.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(0.6, 1.4, 2.4, 3.2), 0]])));
    const smokeWind = plant === 'wind90' ? new QV3(-WIND.z, 0.2, WIND.x) : new QV3(WIND.x, 0.2, WIND.z);       // the one wind (plant: turned 90°)
    smoke.addBehavior(new ApplyForce(smokeWind, new ConstantValue(0.25)));
    { const c = col('smoke'), p2 = col('paper'); smoke.addBehavior(new ColorOverLife(new Gradient([[new QV3(c.r, c.g, c.b), 0], [new QV3(p2.r, p2.g, p2.b), 1]], [[0.0, 0], [0.95, 0.12], [0.9, 0.5], [0.35, 1]]))); }
    smoke.userData = { painted: 'smoke', wind: new THREE.Vector3(smokeWind.x, 0, smokeWind.z) };
    smoke.emitter.position.copy(at).add(new THREE.Vector3(0, 0.9, 0)); smoke.emitter.rotation.x = -Math.PI / 2; scene.add(smoke.emitter); batch.addSystem(smoke);
    const light = new THREE.PointLight('#ff9a4a', 6, 12, 1.6); light.position.copy(at).add(new THREE.Vector3(0, 1, 0)); scene.add(light);
    smokes.push(smoke);
    return { ps, light, smoke };
  }

  // the sword trail: the last N base/tip positions while the blade swings, a fading ribbon
  const N = 14, trailGeo = new THREE.BufferGeometry();
  const tpos = new Float32Array(N * 2 * 3), talpha = new Float32Array(N * 2), tuv = new Float32Array(N * 2 * 2);
  for (let i = 0; i < N; i++) tuv.set([i / (N - 1), 0, i / (N - 1), 1], i * 4);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3)); trailGeo.setAttribute('alpha', new THREE.BufferAttribute(talpha, 1)); trailGeo.setAttribute('uv', new THREE.BufferAttribute(tuv, 2));
  const tidx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; tidx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } trailGeo.setIndex(tidx);
  const trailMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { ...atlasUniforms(), cutRect: { value: rect('stroke_cut') }, paperC: { value: col('paper') } },
    vertexShader: 'attribute float alpha; varying float vA; varying vec2 vUv; void main(){ vA = alpha; vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec4 cutRect; uniform vec3 paperC; varying float vA; varying vec2 vUv; ${PAINT_GLSL}
      void main(){ vec4 t = paintTile(vec2(vUv.x, mix(0.2, 0.8, vUv.y)), cutRect); float a = vA * t.a; gl_FragColor = vec4(paperC * a * (0.8 + 0.5 * (t.r - 0.62)), a); }` });
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

  // an ink stroke hung in the air: the atlas's kabura stroke (MyPaint's sumi brush, loaded start, split dry tail) laid WHOLE on a quad from a
  // to b, so its own outline shows; the bristles' value drives the ink's alpha (alphaMap reads G), so where the brush runs dry the ink thins,
  // as sumi-e's dry brush does (a dark colour times a value shows no streaks; an alpha does)
  const inkTex = (() => { const t = atlas.clone(), r = rect('stroke_ink'); t.offset.set(r.x, r.y); t.repeat.set(r.z, r.w); t.needsUpdate = true; return t; })();
  const strokes = [];
  function stroke(a, b, { width = 0.45, color = 'ink', life = 1.1, up = new THREE.Vector3(0, 1, 0) } = {}) {
    const dir = b.clone().sub(a), len = dir.length(); if (len < 0.1) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), new THREE.MeshBasicMaterial({ map: inkTex, alphaMap: inkTex, color: col(color), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.95, fog: false }));
    m.userData.painted = 'stroke';
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

  // a slash arc (Gabriel Aguiar's crescent-mesh method), shaped from the blade's REAL path: the base and the tip of the sword through
  // the strike, sampled at 60 Hz off the clip (assets/clipdata.json). It draws itself as the blade passes, then fades. Gold-white at
  // the cutting edge, red ink toward the hilt, the dry-brush texture through it: a stroke of paint, in the game's own look.
  // the slash as a BRUSH STROKE: a loaded brush dragged through the cut — bristle streaks along the stroke, dry gaps, a heavy start
  // that thins to a flick, flecks thrown off its tail. Painted once on a canvas; laid on a crescent shaped from the blade's real path
  // around the CONTACT (assets/clipdata.json), so the stroke passes through the body it cuts.
  const arcs = [], arcMat = (heavy) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { ...atlasUniforms(), progress: { value: 0 }, fade: { value: 1 }, strokeRect: { value: rect(heavy ? 'stroke_ink' : 'stroke_cut') }, heavy: { value: heavy ? 1 : 0 },
      paperC: { value: col('paper') }, crimsonC: { value: col('crimson') }, inkC: { value: col('ink') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float progress; uniform float fade; uniform vec4 strokeRect; uniform float heavy; uniform vec3 paperC; uniform vec3 crimsonC; uniform vec3 inkC; varying vec2 vUv;
      ${PAINT_GLSL}
      void main(){
        float drawn = smoothstep(progress, progress - 0.12, vUv.x);                // laid down as the blade passes
        vec4 p = paintTile(vec2(vUv.x, mix(0.14, 0.86, vUv.y)), strokeRect);      // MyPaint's stroke: loaded where the blade enters, dry where it leaves
        if (p.a < 0.04) discard;
        vec3 col = heavy > 0.5 ? mix(inkC, crimsonC, smoothstep(0.25, 0.75, vUv.y)) : mix(crimsonC, paperC, smoothstep(0.35, 0.8, vUv.y));
        col *= 0.8 + 0.55 * (p.r - 0.62) + 0.2;                                     // the bristles' own light and dark
        float a = drawn * p.a * fade;
        if (a < 0.03) discard;
        gl_FragColor = vec4(col, min(1.0, a * 1.15));
      }` });
  function slashArc(person, clip, speed, impact, heavy) {
    const d = api.clipdata && api.clipdata[clip]; if (!d) return;
    const cf = d.contact ? d.contact.frame : Math.round(d.hits[0] * 60);
    const j0 = Math.max(0, cf - 10), j1 = Math.min(d.tip.length - 1, cf + 6), n = j1 - j0 + 1;
    if (n < 3) return;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
    for (let j = 0; j < n; j++) {
      const b = d.base[j0 + j], t = d.tip[j0 + j];
      const inner = [0, 1, 2].map((k) => b[k] + (t[k] - b[k]) * 0.25), outer = [0, 1, 2].map((k) => b[k] + (t[k] - b[k]) * (heavy ? 1.55 : 1.35));
      pos.set(inner, j * 6); pos.set(outer, j * 6 + 3); uv.set([j / (n - 1), 0, j / (n - 1), 1], j * 4);
      if (j < n - 1) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, arcMat(heavy)); m.frustumCulled = false; m.renderOrder = 5;
    // carried by the ronin while the blade swings (he may still be closing in), then left in the world where it was painted
    person.root.add(m);
    arcs.push({ m, t: 0, start: j0 / 60 / speed, swing: (j1 - j0) / 60 / speed, fadeT: 0.45, detached: false });
  }
  function arcUpdate(dt) {
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i]; a.t += dt; const u = a.m.material.uniforms;
      u.progress.value = THREE.MathUtils.clamp((a.t - a.start) / a.swing, 0, 1) * 1.18;
      const after = a.t - a.start - a.swing; u.fade.value = after > 0 ? Math.max(0, 1 - after / a.fadeT) : 1;
      if (!a.detached && after >= 0) { scene.attach(a.m); a.detached = true; }
      if (after > a.fadeT) { a.m.removeFromParent(); a.m.geometry.dispose(); a.m.material.dispose(); arcs.splice(i, 1); }
    }
  }

  const api = {
    batch, hit, fire, trailUpdate, stroke, strokeUpdate, slashArc, arcUpdate, clipdata: null, leaves, smokes, pools, strokes, arcs, trail,
    update(dt, playerPos) { leaves.emitter.position.set(playerPos.x, playerPos.y + 10, playerPos.z); batch.update(dt); arcUpdate(dt); },
  };
  return api;
}
