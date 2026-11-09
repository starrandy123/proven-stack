// The air: three.quarks (MIT) carries the particles — maple leaves falling in the wind, sparks and a red ink spray on a hit, the
// camps' fires and their smoke — in one batched renderer. Every mark is a stamp from the ONE brush atlas (paint.js: MyPaint's strokes),
// coloured from the one palette, moved by the one wind: leaves are oil dabs, smoke is oil puffs that erode as they die (Simon Trümpler on
// RIME: the alpha is "responsible for the alpha fading/erosion/threshold"), the ink spray is the brush's own flecks. The sword's trail is a ribbon of our own between two points on the blade (the base and
// the tip, Unreal's two-socket trail): no openly licensed three.js sword trail exists.
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { paint, rect, col, PAINT_GLSL, atlasUniforms, WIND } from './paint.js';
import { N as GRID, SPACING, HALF } from './world.js';                 // GRID: the terrain's samples a side (vfx's own N is the trail's)
import { BatchedRenderer, ParticleSystem, RenderMode, ConstantValue, IntervalValue, ConstantColor, ColorRange, Vector4, Vector3 as QV3,
  SphereEmitter, ConeEmitter, PointEmitter, ColorOverLife, SizeOverLife, ApplyForce, Noise, RotationOverLife, PiecewiseBezier, Bezier, Gradient } from 'three.quarks';

function leafTexture() {                                                  // a five-lobed maple leaf, painted on a canvas
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.translate(32, 34); g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 27 - Math.abs(i - 5) * 1.6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill(); g.fillRect(-1, 8, 2, 20);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createVfx(scene, { phone = false, plant = null, land = null } = {}) {
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
    // the ribbon follows the blade's last fifth, not its whole length (thin, as the crescent is; plant wideslash: the whole blade)
    if (active) { sword.userData.base.getWorldPosition(b); sword.userData.tip.getWorldPosition(t); hist.unshift([plant === 'wideslash' ? b.clone() : b.clone().lerp(t, 0.8), t.clone()]); }
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
    const rec = { m, t: 0, life, dir: dir.normalize(), press: 1 };
    scene.add(m); strokes.push(rec); return rec;
  }
  // an ink stroke that wounds swells (the brush pressed), one that kills swells more and lingers (plant nopress)
  function pressStroke(rec, level) {
    if (!rec || plant === 'nopress') return;
    rec.press = Math.max(rec.press, level >= 2 ? 2.2 : 1.5); if (level >= 2) rec.life = Math.max(rec.life, rec.t + 1.6);
  }
  // THE LOCK'S MARK: an ensō brushed on the ground under the bandit the ronin is fighting (lock.js) — the one atlas's sumi stroke laid
  // round a circle it does not close (the ensō's open stroke), the brush lifting as it goes round; crimson, fading in as the lock takes him
  const enso = (() => {
    const S = 48, r0 = 0.8, w = 0.2, open = 0.86, vp = [], uv = [], idx = [];
    for (let j = 0; j <= S; j++) {
      const u = j / S, a = u * Math.PI * 2 * open, ww = w * (1 - 0.6 * u);
      vp.push(Math.sin(a) * (r0 - ww / 2), 0, Math.cos(a) * (r0 - ww / 2), Math.sin(a) * (r0 + ww / 2), 0, Math.cos(a) * (r0 + ww / 2)); uv.push(u, 0, u, 1);
      if (j < S) { const q = j * 2; idx.push(q, q + 1, q + 2, q + 2, q + 1, q + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: inkTex, alphaMap: inkTex, color: col('crimson'), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0, fog: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.name = 'lock-enso'; m.userData.painted = 'stroke'; m.renderOrder = 4; m.visible = false; m.frustumCulled = false; scene.add(m); return m;
  })();
  let ensoOn = null, ensoA = 0;
  function lockMark(target, dt) {
    if (target !== ensoOn) { ensoOn = target; ensoA = 0; }
    ensoA = target ? Math.min(1, ensoA + dt / 0.18) : 0;
    enso.visible = !!target && ensoA > 0;
    if (target) { enso.position.copy(target.root.position); enso.position.y += 0.06; enso.material.opacity = ensoA; }
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
      s.m.scale.y += (s.press - s.m.scale.y) * Math.min(1, dt / 0.08);       // pressed: it swells across its width
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
  // ITS COLOURS FOLLOW THE PRESSURE (the ink cut's beat 4, research §4): the brush in the air is ink alone, no crimson (a light cut ink fading
  // to paper at its outer edge, a heavy one ink); a wound brings crimson along the INNER side, toward the hilt and the swing's centre, around
  // where the blade met him (the ink cut: "ink along the outer side, crimson along the inner side where it wounds"); a death FLOODS it, crimson
  // across the stroke with ink kept only along its outer edge (until 8 Nov a 75 % mix that read pink on the paper part: W19 measured it at
  // 55 % crimson); and for the instant of contact the stroke is bare paper on the ink blot. Until 8 Nov the air stroke itself was crimson
  // (plant misscrimson).
  const arcs = [], arcMat = (heavy) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { ...atlasUniforms(), progress: { value: 0 }, fade: { value: 1 }, strokeRect: { value: rect(heavy ? 'stroke_ink' : 'stroke_cut') }, heavy: { value: heavy ? 1 : 0 }, death: { value: 0 },
      wound: { value: 0 }, cutU: { value: 0.6 }, paper: { value: 0 }, airCrimson: { value: plant === 'misscrimson' ? 1 : 0 },
      paperC: { value: col('paper') }, crimsonC: { value: col('crimson') }, inkC: { value: col('ink') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float progress; uniform float fade; uniform vec4 strokeRect; uniform float heavy; uniform float death; uniform float wound; uniform float cutU; uniform float paper; uniform float airCrimson;
      uniform vec3 paperC; uniform vec3 crimsonC; uniform vec3 inkC; varying vec2 vUv;
      ${PAINT_GLSL}
      void main(){
        float drawn = smoothstep(progress, progress - 0.12, vUv.x);                // laid down as the blade passes
        vec4 p = paintTile(vec2(vUv.x, mix(0.14, 0.86, vUv.y)), strokeRect);      // MyPaint's stroke: loaded where the blade enters, dry where it leaves
        if (p.a < 0.04) discard;
        vec3 air = heavy > 0.5 ? inkC : mix(inkC, paperC, smoothstep(0.35, 0.8, vUv.y));
        vec3 old = heavy > 0.5 ? mix(inkC, crimsonC, smoothstep(0.25, 0.75, vUv.y)) : mix(crimsonC, paperC, smoothstep(0.35, 0.8, vUv.y));
        float b = 1.0 + 0.55 * (p.r - 0.62);                                         // the bristles' own light and dark
        vec3 col = mix(air, old, airCrimson) * b;
        float zone = clamp(1.6 - abs(vUv.x - cutU - 0.05) * 4.2, 0.0, 1.0), inner = 1.0 - smoothstep(0.3, 0.62, vUv.y);
        col = mix(col, crimsonC * b, wound * zone * inner);                          // a wound: crimson along the inner side
        col = mix(col, mix(crimsonC, inkC, smoothstep(0.72, 0.92, vUv.y)) * b, death);   // a death FLOODS it: crimson across, ink kept on its outer edge
        col = mix(col, paperC, paper);                                               // the contact: bare paper
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
    for (let j = 0; j < n; j++) { uv.set([j / (n - 1), 0, j / (n - 1), 1], j * 4); if (j < n - 1) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, arcMat(heavy)); m.frustumCulled = false; m.renderOrder = 5;
    // carried by the ronin while the blade swings (he may still be closing in), then left in the world where it was painted
    person.root.add(m);
    const arc = { m, t: 0, start: impact - (cf - j0) / 60 / speed, swing: (j1 - j0) / 60 / speed, fadeT: 0.45, detached: false, src: { d, j0, n, heavy }, cutAt: cf - j0, press: 1 };
    m.material.uniforms.cutU.value = (cf - j0) / (n - 1);
    shapeArc(arc); arcs.push(arc);
    return arc;
  }
  // THE BRUSH'S PRESSURE. THIN (the owner, 8 Nov: "The attack slashes are too wide in strokes and must be thinner"): a band along the
  // TIP's path, a fifth of the blade at its belly, drawn to a point at both ends (Aguiar's crescent) — it was the whole sweep from near
  // the hilt to past the tip, about a metre wide (plant wideslash). And THICKER WHERE IT WOUNDS (the owner, 8 Nov: "the slashes to get
  // thicker as they injure their enemies to make cooler paint stroke effect and show death"): a calligrapher's stroke widens as the brush
  // is pressed and thins as it lifts (the soft bristles "let stroke width vary as the writer applies pressure"; sumi-e: "light pressure
  // for thin lines and heavy pressure for bold strokes"). A swing that meets no one is the brush in the air; where the blade meets a body
  // the brush presses (×2), and on a death it presses down hard (×3.6), turns to crimson ink and lingers (plant nopress).
  function shapeArc(a) {
    const { d, j0, n, heavy } = a.src, pos = a.m.geometry.attributes.position.array;
    for (let j = 0; j < n; j++) {
      const b = d.base[j0 + j], t = d.tip[j0 + j];
      const taper = Math.pow(Math.sin(Math.PI * (j + 0.5) / n), 0.6), o = heavy ? 1.12 : 1.08;
      const into = THREE.MathUtils.smoothstep(j, a.cutAt - 3, a.cutAt);           // pressed from where the blade meets the body
      const band = (heavy ? 0.22 : 0.18) * taper * (1 + (a.press - 1) * into);
      const [fi, fo] = plant === 'wideslash' ? [0.25, heavy ? 1.55 : 1.35] : [o - band * 0.6, o + band * 0.4];
      for (let k = 0; k < 3; k++) { pos[j * 6 + k] = b[k] + (t[k] - b[k]) * fi; pos[j * 6 + 3 + k] = b[k] + (t[k] - b[k]) * fo; }
    }
    a.m.geometry.attributes.position.needsUpdate = true;
  }
  function pressArc(a, level) {                                       // level 1: a wound · level 2: a death
    if (a && level >= 1) a.m.material.uniforms.wound.value = 1;       // its colour (W19); its width and linger below (W12)
    if (!a || plant === 'nopress') return;
    a.press = Math.max(a.press, level >= 2 ? 3.6 : 2); shapeArc(a);
    if (level >= 2) { a.fadeT = 1.4; a.m.material.uniforms.death.value = 1; }
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

  // ── THE INK CUT'S BEATS, PAINTED (8 Nov 2026; the receipts' 2026-11-09_pixelfx/painted_ronin/RESEARCH.md) ─────────────────────────────
  // The pixel ink cut (pixelfx, MIT) was made FROM this slash and added three beats: an ink blot with the stroke bare paper at contact,
  // flecks that land as stains, and the blade flicked clean. Here they are painted in this game's one language: the one atlas, the palette.
  const clock = { t: 0, u: { value: 0 } };                             // the game's own clock (it holds in the hit-stop, slows in slow motion)

  // 1 · THE INK SPLASH AT CONTACT: a shock frame (Sakuga Booru: "Special frames drawn by animators that appear for a split second, often
  // added to make an impact more pronounced"), drawn behind the wound as INK FLICKED ALONG THE CUT. The owner, 8 Nov, on the first take: "It
  // just looks like black smudge so we must show better brush strokes … making sure it looks pixelly but painted as well". So, from the
  // references (research §8): splatter made "by forcefully flicking the brush toward the paper" scatters outward "depending on the flicking
  // angle" (Lei et al., Pacific Graphics 2013), so the splash is directional: a pooled core blotted into the paper (nijimi, "A blotting
  // effect"), brush flicks fanned along the stroke's travel as the camera sees it, each the atlas's kabura sumi stroke with its loaded start
  // at the wound and its split dry tail (kasure, "A running out of ink effect") at the tip, and droplets strung past the tips. Tones from the
  // palette by the bristles' own value (ink, stoneShade, a smoke wash; crimson and maple flicks where it wounds, more on a kill). PAINTERLY
  // PIXEL ART (Bionic Bay's "slightly smaller pixels than usual and a broader range of color tones"; Shadowglass's "pixel stabilization" and
  // "Fewer colors means more cohesion"): with inkPix > 0 every fragment takes the value at the centre of its SCREEN cell, tones step through a
  // 4×4 ordered dither, and the pixels are flagged (alpha 0.5) so the oil pass keeps them crisp (painterly.js). It runs on the game's clock,
  // so it holds through the hit-stop, as the ink cut's act holds its blot. It is drawn over the world and BEHIND the fighters (the act's
  // drawBack): after the world's opaque pass, before the characters (renderOrder 2, main.js), without a depth test, writing its own depth
  // half a metre behind the wound. Plants: noblot (none), blotfront (drawn over the fighters), paperoff (the stroke never bares the paper),
  // smudge (one flat round blot of ink, the first take's "black smudge"), flatstart (the strokes' straight starts, below), rimoff (inkTile).
  const BLOT = { life: 0.07, span: 3.2 };                              // seconds; the card's width in his heights (the flicks reach ~1.3)
  const inkPix = { value: 0 };                                          // the pixel cell in device px (0: painted, no grid)
  const INK_GLSL = /* glsl */`
uniform float inkPix;
// the uv at the centre of this fragment's SCREEN cell: every fragment of a cell takes one value (pixel stabilization)
vec2 cellUv(vec2 uv) { if (inkPix < 1.0) return uv; vec2 c = (floor(gl_FragCoord.xy / inkPix) + 0.5) * inkPix - gl_FragCoord.xy; return uv + dFdx(uv) * c.x + dFdy(uv) * c.y; }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
// the ordered dither's threshold for this cell (0.5 everywhere when painted)
float dith() { return inkPix < 1.0 ? 0.5 : bayer4(floor(gl_FragCoord.xy / inkPix)); }
float inkAlpha() { return inkPix < 1.0 ? 1.0 : 0.5; }
// a mark never shows the edge of the tile it is taken from (the owner, 9 Nov: "One corner looks too square and shart … And rectangle I
// mean"). The bake painted the oil dab and the puff reaching their tiles' borders, which cut them straight (measured in the atlas: puff_a's
// left side, dab_oil's right end), so ink taken from them is ERODED toward the tile's rim, the way the smoke erodes (Trümpler): coverage
// pulled down from 0.78 of the tile's half-width out to 0.96, so a cut side turns round inside the tile. Plant rimoff: not eroded.
vec4 inkTile(vec2 uv, vec4 r) { if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return vec4(0.0); vec4 s = paintTile(uv, r); s.a *=${plant === 'rimoff' ? '1.0' : '1.0 - smoothstep(0.78, 0.96, length(uv - 0.5) * 2.0)'}; return s; }`;
  const blotMat = new THREE.ShaderMaterial({ transparent: plant === 'blotfront', depthTest: false, depthWrite: plant !== 'blotfront', side: THREE.DoubleSide,
    uniforms: { ...atlasUniforms(), inkPix, flickRect: { value: rect('stroke_ink') }, dotRect: { value: rect('puff_a') },
      inkC: { value: col('ink') }, midC: { value: col('stoneShade') }, washC: { value: col('stoneShade') }, crimsonC: { value: col('crimson') }, mapleC: { value: col('maple') },
      flicks: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, drops: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // flicks[i]: x its angle, y its bend (a flick bends as it flies), z its length, w its width (negative: crimson), all in his heights.
    // 0-3: the core, short wide presses whose loaded starts overlap into the pooled ink; 4-12 the flicks fanned along the cut; 13-15 back.
    // THE PRESS (9 Nov, his note on the two looks: "One corner looks too square and shart … And rectangle I mean"): the atlas's kabura
    // stroke starts in a straight cut, because the bake laid its first dab 41 px inside the tile at a radius of ~101 px (the preset's
    // pressure curve at 0.95), and the tile's edge cut the rest off. MyPaint's dab is round (classic_kabura: elliptical_dab_ratio 1.0, "1.0
    // means a perfectly round dab", libmypaint's brushsettings), and a brush stroke begins in its press with the tip hidden ("the first and
    // last touches of the brush tip on the paper should be hidden", art-virtue's Basic Brush Techniques). So each stroke here starts in
    // that dab, whole: a disc of the stroke's own half-width at its start (0.42 of it across), round in the card's plane whatever the
    // stroke's length, its rim at the wound. The pale bleed (nijimi) is the stroke's outline grown 1.25× across at the press, closing onto
    // the stroke over a quarter of his height, and round around the press. It meets the stroke with no gap. The old bleed was a band from
    // |v| 0.5, started on the same straight cut. At 1.6× the press's halo read as a white disc behind him, and in the smoke swatch even
    // a rim read as a white outline on the grass (looked at, 9 Nov), so it is a rim in the mid ink tone: diluted ink, darker than its ground. Plant flatstart: the old straight start and banded bleed.
    fragmentShader: `uniform vec4 flickRect; uniform vec4 dotRect; uniform vec3 inkC; uniform vec3 midC; uniform vec3 washC; uniform vec3 crimsonC; uniform vec3 mapleC;
      uniform vec4 flicks[16]; uniform vec4 drops[12]; varying vec2 vUv; ${PAINT_GLSL} ${INK_GLSL}
      vec4 tile(vec2 u, vec4 r) { return (u.x > 0.0 && u.y > 0.0 && u.x < 1.0 && u.y < 1.0) ? paintTile(u, r) : vec4(0.0); }
      void main(){
        vec2 q = (cellUv(vUv) - 0.5) * ${BLOT.span.toFixed(2)};                                  // in his heights from the wound
        ${plant === 'smudge' ? 'if (length(q) > 0.5) discard; gl_FragColor = vec4(inkC, inkAlpha()); return;   // plant smudge: the flat round blot he called a smudge' : ''}
        float cov = 0.0, val = 0.6, red = 0.0, wash = 0.0;
        for (int i = 0; i < 16; i++) {                                                         // each stroke: loaded at the wound, split and dry at its tip
          vec4 f = flicks[i]; if (f.z <= 0.0) continue;
          float w = abs(f.w), rp = ${plant === 'flatstart' ? '0.0' : '0.42'} * w, rb = rp / 0.8;     // the press's radius and the bleed's around it
          vec2 d = vec2(cos(f.x), sin(f.x)); float a = dot(q, d), u = a / f.z;                // a: along the stroke from the wound
          if (u > 1.0 || a < rp - rb - 0.06 * w) continue;
          float v = (d.x * q.y - d.y * q.x - f.y * u * u * f.z) / w;                          // across, in its widths
          float e = length(vec2(a - rp, v * w));                                               // from the press's centre
          float disc = rp > 0.0 ? 1.0 - smoothstep(rp - 0.05 * w, rp + 0.05 * w, e) : 0.0;
          float body = a >= rp ? tile(vec2(u, v + 0.5), flickRect).a : 0.0;
          float c = max(body, disc);
          if (a - rp < 0.25) {                                                                 // the bleed, within its reach
            float k = mix(0.8, 1.0, smoothstep(0.0, 0.25, a - rp));
            float grown = a >= rp ? tile(vec2(u, v * k + 0.5), flickRect).a : 0.0;
            wash = max(wash, max(grown, rp > 0.0 ? 1.0 - smoothstep(rb - 0.05 * w, rb + 0.05 * w, e) : 0.0));
          }
          if (c > cov) { cov = c; val = paintTile(vec2(clamp(u, 0.0, 1.0), v + 0.5), flickRect).r; red = f.w < 0.0 ? 1.0 : 0.0; }
        }
        for (int i = 0; i < 12; i++) {                                                         // droplets strung past the tips
          vec4 p = drops[i]; if (p.z <= 0.0) continue; vec2 e = q - p.xy; if (dot(e, e) > p.z * p.z * 1.6) continue;
          vec4 s = inkTile(e / (2.2 * p.z) + 0.5, dotRect); if (s.a > cov) { cov = s.a; val = s.r; red = p.w; }
        }
        float t = dith();
        if (cov < 0.42) { if (wash < 0.45 + 0.35 * t) discard; gl_FragColor = vec4(washC, inkAlpha()); return; }
        // the bristles' own light and dark as palette tones: black ink, with the palest bristles in the mid tone as dry-brush streaks
        float k = smoothstep(0.7, 0.95, val);
        vec3 dark = red > 0.5 ? crimsonC : inkC, light = red > 0.5 ? mapleC : midC;
        gl_FragColor = vec4(inkPix < 1.0 ? mix(dark, light, k) : (k > t ? light : dark), inkAlpha());
      }` });
  const blot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blotMat);
  blot.name = 'ink-blot'; blot.userData.painted = 'blot'; blot.renderOrder = plant === 'blotfront' ? 9 : 1; blot.frustumCulled = false; blot.visible = false; scene.add(blot);
  const blotState = { t: -1, arc: null, at: new THREE.Vector3(), r: 0, height: 0, level: 0, count: 0 };
  const paperOn = (a, v) => { if (a && a.m.material.uniforms.paper) a.m.material.uniforms.paper.value = v; };
  const _cr = new THREE.Vector3(), _cu = new THREE.Vector3(), R1 = (a, b) => a + Math.random() * (b - a);
  function contact(at, height, level, arc, camera, travel = null) {    // a cut that wounds (1) or kills (2), flung along the stroke's travel
    if (level < 1 || plant === 'noblot') return;
    Object.assign(blotState, { t: 0, fresh: true, r: height, height, level, count: blotState.count + 1 }); blotState.at.copy(at);
    blot.position.copy(at).addScaledVector(at.clone().sub(camera.position).normalize(), 0.5);
    blot.quaternion.copy(camera.quaternion); blot.scale.setScalar(height * BLOT.span);
    // the flick's angle in the card's plane: the stroke's travel as the camera sees it (its right and up)
    _cr.set(1, 0, 0).applyQuaternion(camera.quaternion); _cu.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const tx = travel ? travel.dot(_cr) : 0, ty = travel ? travel.dot(_cu) : 0, th = Math.hypot(tx, ty) > 0.2 ? Math.atan2(ty, tx) : Math.random() * Math.PI * 2;
    const U = blotMat.uniforms, nRed = level >= 2 ? 6 : 3, F = U.flicks.value;
    for (let i = 0; i < 4; i++) F[i].set(Math.random() * Math.PI * 2, R1(-0.2, 0.2), R1(0.24, 0.36), R1(0.26, 0.36));   // the core
    for (let i = 4; i < 13; i++) {                                                // the flicks, fanned along the cut, the longest down its line
      const off = THREE.MathUtils.clamp((Math.random() + Math.random() + Math.random() - 1.5) * 0.65, -0.95, 0.95);
      F[i].set(th + off, R1(-0.28, 0.28), R1(0.6, 1.15) * (1 - 0.3 * Math.abs(off)), (i - 4 < nRed ? -1 : 1) * R1(0.13, 0.21));
    }
    for (let i = 13; i < 16; i++) F[i].set(th + Math.PI + R1(-0.75, 0.75), R1(-0.2, 0.2), R1(0.26, 0.45), R1(0.1, 0.14));   // a few thrown back
    U.drops.value.forEach((p, j) => {                                             // droplets strung past the flicks' tips
      const f = F[4 + (j % 9)], d = f.z * R1(1.05, 1.35) + R1(0, 0.1), a = f.x + R1(-0.1, 0.1) + f.y * 0.5;
      p.set(Math.cos(a) * d, Math.sin(a) * d, R1(0.025, 0.06), Math.random() < (level >= 2 ? 0.6 : 0.3) ? 1 : 0);
    });
    blot.visible = true;
    if (blotState.arc !== arc) paperOn(blotState.arc, 0);
    blotState.arc = arc; paperOn(arc, plant === 'paperoff' ? 0 : 1);   // plant paperoff: the stroke never bares the paper
  }
  function blotUpdate(dt, camera) {
    if (blotState.t < 0) return;
    if (blotState.fresh) blotState.fresh = false; else blotState.t += dt;   // counted from its first frame on screen, not the contact frame's slice
    if (camera) blot.quaternion.copy(camera.quaternion);
    if (blotState.t >= BLOT.life) { blotState.t = -1; blot.visible = false; paperOn(blotState.arc, 0); blotState.arc = null; }
  }

  // 2 · FLECKS THAT LAND AS STAINS. Ghost of Tsushima: "every attack creates a particle effect with thousands of blood droplets and blood
  // strings … Each of the droplets lands on nearby geometry" (Matt Vainio, 2021). The quarks spray above stays (the fine droplets); these
  // are the larger flung drops. A wound flings 9 (5 ink, 4 crimson) along the stroke's travel, spread 0.5 rad, at 4-11.5 m/s (the ink cut's
  // 90-260 px/s at its 4.4 cm a pixel), and 3 small ink drops back; a death flings 14 (10 crimson). Each flies under gravity AND air drag
  // (Attinger, NIJ report 249851: straight-line reconstructions "neglecting drag and gravity forces … induce systematic and poorly quantified
  // uncertainties"; F_D = ½ ρa C_D A |v| v, C_D = 0.28 + 6/√Re + 21/Re, Lavernia) as a drop of 1-3 mm, painted at the game's fleck scale.
  // It lands on the land's own height and becomes a STAIN: three.js's DecalGeometry (r187, MIT; its webgl_decals material) projected onto
  // the terrain cells under it alone, the same vertices and diagonal terrainMesh draws, so a phone never projects onto 130,050 triangles.
  // The stain is stretched along its travel by 1/sin α (an oblique stain is an ellipse whose width the normal speed sets: the NIJ report;
  // Balthazard 1939) and dries away by erosion (Trümpler on RIME) between 1.6 s and 2.25 s after the cut (+0.6 s on a death), as the ink
  // cut's stains dry. Every stain shares ONE buffer and ONE draw. Plants: nostains (the drops vanish), floatstains (laid 0.25 m up), nodry.
  const RHO_AIR = 1.2, MU_AIR = 1.81e-5, RHO_BLOOD = 1060, G0 = 9.81;
  const DROPS = 64, drops = [];
  const dropGeo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  const dPos = new Float32Array(DROPS * 3), dVel = new Float32Array(DROPS * 3), dSize = new Float32Array(DROPS), dTone = new Float32Array(DROPS);
  for (const [k, arr, n] of [['iPos', dPos, 3], ['iVel', dVel, 3], ['iSize', dSize, 1], ['iTone', dTone, 1]]) dropGeo.setAttribute(k, new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
  dropGeo.instanceCount = 0;
  const dropMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide,
    uniforms: { ...atlasUniforms(), inkPix, dabRect: { value: rect('dab_oil') }, inkC: { value: col('ink') }, crimsonC: { value: col('crimson') }, midC: { value: col('stoneShade') }, mapleC: { value: col('maple') } },
    vertexShader: `attribute vec3 iPos; attribute vec3 iVel; attribute float iSize; attribute float iTone; varying vec2 vUv; varying float vTone;
      void main(){
        vUv = uv; vTone = iTone;
        vec4 c = viewMatrix * vec4(iPos, 1.0); vec2 d = (viewMatrix * vec4(iVel, 0.0)).xy; float L = length(d);
        d = L > 1e-4 ? d / L : vec2(1.0, 0.0);
        float stretch = 1.0 + clamp(length(iVel) * 0.06, 0.0, 1.4);                   // a flung drop reads as a short streak along its flight
        c.xy += (position.x * d * stretch + position.y * vec2(-d.y, d.x)) * iSize;
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: `uniform vec4 dabRect; uniform vec3 inkC; uniform vec3 crimsonC; uniform vec3 midC; uniform vec3 mapleC; varying vec2 vUv; varying float vTone; ${PAINT_GLSL} ${INK_GLSL}
      void main(){ vec4 p = inkTile(cellUv(vUv), dabRect); if (p.a < 0.35) discard;
        float k = smoothstep(0.55, 0.85, p.r), t = dith(); vec3 dark = vTone > 0.5 ? crimsonC : inkC, light = vTone > 0.5 ? mapleC : midC;
        gl_FragColor = vec4(inkPix < 1.0 ? mix(dark, light, k * 0.6) : (k > t ? light : dark), inkAlpha()); }` });
  const dropMesh = new THREE.Mesh(dropGeo, dropMat); dropMesh.name = 'ink-drops'; dropMesh.userData.painted = 'drops'; dropMesh.frustumCulled = false; dropMesh.visible = false; scene.add(dropMesh);

  const STAINS = 96, SV = 36;                                          // stain slots (a ring) × vertices a stain may take
  const sPos = new Float32Array(STAINS * SV * 3), sUv = new Float32Array(STAINS * SV * 2), sInfo = new Float32Array(STAINS * SV * 4);
  const stainGeo = new THREE.BufferGeometry();
  stainGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  stainGeo.setAttribute('uv', new THREE.BufferAttribute(sUv, 2).setUsage(THREE.DynamicDrawUsage));
  stainGeo.setAttribute('aInfo', new THREE.BufferAttribute(sInfo, 4).setUsage(THREE.DynamicDrawUsage));   // landed, dries from, gone at, crimson
  // opaque (each pixel is ink or nothing), so painterly pixel art's flag is written as is; depth and offset as webgl_decals' material
  const stainMat = new THREE.ShaderMaterial({ transparent: false, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
    uniforms: { ...atlasUniforms(), inkPix, stampRect: { value: rect('dab_oil') }, inkC: { value: col('ink') }, crimsonC: { value: col('crimson') }, midC: { value: col('stoneShade') }, mapleC: { value: col('maple') }, uTime: clock.u },
    vertexShader: 'attribute vec4 aInfo; varying vec2 vUv; varying vec4 vInfo; void main(){ vUv = uv; vInfo = aInfo; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec4 stampRect; uniform vec3 inkC; uniform vec3 crimsonC; uniform vec3 midC; uniform vec3 mapleC; uniform float uTime; varying vec2 vUv; varying vec4 vInfo; ${PAINT_GLSL} ${INK_GLSL}
      void main(){
        if (uTime >= vInfo.z) discard;
        vec4 p = inkTile(cellUv(vUv), stampRect);
        float dry = clamp((uTime - vInfo.y) / max(vInfo.z - vInfo.y, 1e-3), 0.0, 1.0);
        float ink = p.a * (0.7 + 0.6 * (p.r - 0.62));                                  // the thin, pale bristles carry the least ink
        if (ink < mix(0.3, 1.05, dry)) discard;                                         // dried away by erosion, never a fade (Trümpler)
        float k = smoothstep(0.55, 0.85, p.r), t = dith(); vec3 dark = vInfo.w > 0.5 ? crimsonC : inkC, light = vInfo.w > 0.5 ? mapleC : midC;
        gl_FragColor = vec4(inkPix < 1.0 ? mix(dark, light, k * 0.6) : (k > t ? light : dark), inkAlpha());
      }` });
  const stainMesh = new THREE.Mesh(stainGeo, stainMat); stainMesh.name = 'ink-stains'; stainMesh.userData.painted = 'stains'; stainMesh.frustumCulled = false; stainMesh.renderOrder = 3; scene.add(stainMesh);
  const cells = new THREE.Mesh(new THREE.BufferGeometry());            // the terrain cells under a stain, 3 × 3 samples, drawn as terrainMesh draws them
  { const g = cells.geometry, idx = []; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3));
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const a = j * 3 + i, b = a + 1, c2 = a + 3, d = c2 + 1; idx.push(a, c2, b, b, c2, d); } g.setIndex(idx); }
  let slot = 0; const stainLog = [], woundLog = [];
  const _sn = new THREE.Vector3(), _sx = new THREE.Vector3(), _sy = new THREE.Vector3(), _sm = new THREE.Matrix4(), _se = new THREE.Euler(), _ss = new THREE.Vector3();
  function stain(d) {
    if (!land || plant === 'nostains') return;
    const p = d.p, cp = cells.geometry.attributes.position;
    const i0 = THREE.MathUtils.clamp(Math.round((p.x + HALF) / SPACING) - 1, 0, GRID - 3), j0 = THREE.MathUtils.clamp(Math.round((p.z + HALF) / SPACING) - 1, 0, GRID - 3);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) cp.setXYZ(j * 3 + i, -HALF + (i0 + i) * SPACING, land.heights[(j0 + j) * GRID + i0 + i], -HALF + (j0 + j) * SPACING);
    land.normal(p.x, p.z, _sn);
    _sx.copy(d.v).addScaledVector(_sn, -d.v.dot(_sn)); if (_sx.lengthSq() < 1e-8) _sx.set(1, 0, 0).addScaledVector(_sn, -_sn.x); _sx.normalize();
    const sinA = THREE.MathUtils.clamp(Math.abs(d.v.dot(_sn)) / Math.max(d.v.length(), 1e-6), 0.25, 1);   // width ÷ length = sin α
    const W = d.size * 1.6, L = W / sinA;                                  // a drop spreads as it lands: the stain is wider than the drop
    _sy.crossVectors(_sn, _sx); _sm.makeBasis(_sx, _sy, _sn); _se.setFromRotationMatrix(_sm);
    const geo = new DecalGeometry(cells, p, _se, _ss.set(L, W, 0.8)), P = geo.attributes.position, U = geo.attributes.uv;
    const n = Math.min(P.count - (P.count % 3), SV), base = slot * SV, lift = plant === 'floatstains' ? 0.25 : 0;
    const dryAt = plant === 'nodry' ? 1e9 : d.t0 + 1.6 + d.linger, goneAt = plant === 'nodry' ? 1e9 : Math.max(d.t0 + 2.25 + d.linger, clock.t + 0.3);   // plant nodry: never dries
    for (let k = 0; k < SV; k++) {
      const o = base + k;
      if (k < n) { sPos.set([P.getX(k) + _sn.x * lift, P.getY(k) + _sn.y * lift, P.getZ(k) + _sn.z * lift], o * 3); sUv.set([U.getX(k), U.getY(k)], o * 2); sInfo.set([clock.t, dryAt, goneAt, d.tone], o * 4); }
      else { sPos.fill(0, o * 3, o * 3 + 3); sInfo.set([0, 0, -1, 0], o * 4); }
    }
    geo.dispose();
    for (const [k, w] of [['position', 3], ['uv', 2], ['aInfo', 4]]) { const a = stainGeo.attributes[k]; a.addUpdateRange(base * w, SV * w); a.needsUpdate = true; }
    stainLog.push({ slot, at: p.clone(), dir: _sx.clone(), normal: _sn.clone(), L, W, sinA, tone: d.tone, t0: d.t0, landed: clock.t, dryAt, goneAt, verts: n, cast: !!d.cast, from: d.from });
    if (stainLog.length > STAINS) stainLog.shift();
    slot = (slot + 1) % STAINS;
  }
  function fling(at, dir, spread, s0, s1, tone, z0, z1, linger, cast = false) {
    if (drops.length >= DROPS) return;
    const w = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), e1 = w.cross(dir).normalize(), e2 = dir.clone().cross(e1);
    const th = spread * Math.sqrt(Math.random()), ph = Math.random() * Math.PI * 2;      // inside a cone of half-angle `spread`
    const u = dir.clone().multiplyScalar(Math.cos(th)).addScaledVector(e1, Math.sin(th) * Math.cos(ph)).addScaledVector(e2, Math.sin(th) * Math.sin(ph));
    const size = z0 + Math.random() * (z1 - z0);
    drops.push({ p: at.clone(), v: u.multiplyScalar(s0 + Math.random() * (s1 - s0)), size, rad: THREE.MathUtils.clamp(0.0005 + (size - 0.05) * 0.009, 0.0005, 0.0015), tone, t0: clock.t, linger, cast, from: at.clone(), age: 0 });
  }
  function wound(at, travel, level) {                                   // a cut (or a special's blow) that wounds (1) or kills (2)
    if (level < 1) return;
    const n = level >= 2 ? 14 : 9, crimson = level >= 2 ? 10 : 4, linger = level >= 2 ? 0.6 : 0, dir = travel.clone().normalize();
    for (let i = 0; i < n; i++) fling(at, dir, 0.5, 4.0, 11.5, i < crimson ? 1 : 0, 0.08, 0.16, linger);
    const back = dir.clone().negate(); for (let i = 0; i < 3; i++) fling(at, back, 0.45, 1.8, 4.8, 0, 0.05, 0.09, linger);
    woundLog.push({ t: clock.t, level, n, crimson, back: 3, at: at.clone(), dir }); if (woundLog.length > 32) woundLog.shift();
  }
  // 3 · THE CHIBURI'S DROPS (main.js times the flick): one crimson drop off the blade, with the blade's own velocity there
  function castOff(p, v) {
    if (drops.length >= DROPS) return;
    const size = 0.09 + Math.random() * 0.04;
    drops.push({ p: p.clone(), v: v.clone(), size, rad: THREE.MathUtils.clamp(0.0005 + (size - 0.05) * 0.009, 0.0005, 0.0015), tone: 1, t0: clock.t, linger: 0, cast: true, from: p.clone(), age: 0 });
  }
  function dropsUpdate(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.age += dt;
      for (let h = dt; h > 1e-7; h -= 1 / 120) {
        const s = Math.min(h, 1 / 120), sp = d.v.length(), Re = Math.max(0.1, RHO_AIR * sp * 2 * d.rad / MU_AIR), CD = 0.28 + 6 / Math.sqrt(Re) + 21 / Re;
        d.v.addScaledVector(d.v, -3 * RHO_AIR * CD / (8 * RHO_BLOOD * d.rad) * sp * s); d.v.y -= G0 * s; d.p.addScaledVector(d.v, s);
        if (land && d.p.y <= land.groundY(d.p.x, d.p.z)) { d.p.y = land.groundY(d.p.x, d.p.z); stain(d); d.landed = true; break; }
      }
      if (d.landed || d.age > 4) drops.splice(i, 1);
    }
    dropGeo.instanceCount = drops.length; dropMesh.visible = drops.length > 0;
    drops.forEach((d, i) => { dPos.set([d.p.x, d.p.y, d.p.z], i * 3); dVel.set([d.v.x, d.v.y, d.v.z], i * 3); dSize[i] = d.size; dTone[i] = d.tone; });
    for (const k of ['iPos', 'iVel', 'iSize', 'iTone']) dropGeo.attributes[k].needsUpdate = true;
  }

  const api = {
    batch, hit, fire, trailUpdate, stroke, strokeUpdate, slashArc, arcUpdate, pressArc, pressStroke, lockMark, enso, clipdata: null, leaves, smokes, pools, strokes, arcs, trail,
    contact, wound, castOff, blot, blotState, BLOT, inkPix, drops, dropMesh, stainMesh, stainLog, woundLog, clock, cells,
    update(dt, playerPos, camera) {
      leaves.emitter.position.set(playerPos.x, playerPos.y + 10, playerPos.z); batch.update(dt); arcUpdate(dt);
      clock.t += dt; clock.u.value = clock.t; dropsUpdate(dt); blotUpdate(dt, camera);
    },
  };
  return api;
}
