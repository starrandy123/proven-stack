// 筆 THE BRUSH — a held moment and a cut the player draws (research K: ContentFunnel/engine/assets/receipts/2026-11-07_stack/research/
// K_blade_mode.md, every number there marked as a source's or ours). The mechanic is Metal Gear Rising's free-angle cut in slowed time, at
// its makers' word: "Let the player be able to carefully adjust the positioning and angle at which they want to cut" · "Bringing the stick
// from the outside to the center (by releasing your hold) will cause Raiden to slice" · "the first strike in Blade Mode always follows the
// path displayed by the line on the player's screen" (Takashi Wagatsuma, Siliconera). Its painted half is Ōkami's brush: the world becomes
// a painting, the stroke you draw cuts, and ink pots pay for it. Nothing of either game's name or art is here: in this valley it is 筆.
// The proven pieces do the work: three-pinata 2.0.1 (MIT, Daniel Greenheck) cuts the mesh by the plane, with the inner material on the
// new faces, and every piece can be cut again; Jolt carries every piece (a ConvexHullShape of its own vertices, as the proof did:
// receipts/2026-11-09_blade/demo/blade.js); the clips are Quaternius's own sword cuts; the strokes are the one MyPaint atlas.
// Real tameshigiri sets the targets (Toyama-ryu: mats "rolled", "soaked", "thrust down onto the spike/peg" of a stand "2 shaku tall"; the
// diagonal cut "approximately 30-50 degrees from the surface", Wikipedia; bamboo "hollow" between nodes, its fibres "scattered throughout
// the walls of the stalk"). The top of a mat slides off its own face because Jolt says so: friction 0.45 (rice straw's 0.20-0.45, rising
// with moisture) against the face's slope, nothing scripted.
import * as THREE from 'three';
import { DestructibleMesh } from 'three-pinata';
import { LAYER_STATIC, LAYER_DEBRIS, addStaticBox } from './physics.js';
import { col, paint, rect, atlasUniforms, PAINT_GLSL, addPatch, paintSurface, paintFog, RAMP } from './paint.js';

export const BRUSH = {
  scale: 0.05, tauIn: 0.06, tauOut: 0.08,               // the world's clock held to 0.05 (ours); ≤ 0.08 within 0.25 s, back within 0.6 s (B3)
  pots: 3, dryAfter: 1.5, dryEvery: 4, refillEvery: 1.5, // Ōkami's ink pots; the count and the pace are ours: a held moment dries one
                                                        // pot every 4 s after its first 1.5 s, so three quick cuts fit (Inazuma giri: "within one second")
  reach: 1.7, focusRange: 4.0, focusCone: 70,           // m (Ronin's REACH 1.5 + a mat's radius), m, degrees off the view
  cap: 36, minVolume: 2e-6, rest: 9, fade: 0.6,         // live pieces (Korekado: "2倍、4倍、8倍"), m³ (2 cm³), s at rest before they fade
  mu: 0.45, restitution: 0.05, push: 0.15, part: 0.03,  // wet straw's friction, a soft knock; a clean cut carries little ("The top of the
                                                        // target slipped off"): the swing's push and the parting, m/s
  cam: { back: 2.2, right: 1.5, height: 1.6, look: 0.75, fov: 40, tau: 0.3, linger: 1.1 },   // linger: after a cut the shot holds while time
                                                                                  // comes back, so the fall is seen close (the cut, the beat, the fall)    // behind his right shoulder and out to the side, so the target
                                                                                  // stands clear of his body (take 2 hid it); 55° → 40°
  orbit: { speed: 1.4, min: 0.8, max: 2.2 },            // stepping round the focus in the held moment (MGR: "enable the player to move")
  lead: 0.16, swingRate: 1.4, hitStop: 0.06, recover: 0.16, tap: 0.25,
};
// the cuts by the line's angle on the screen (a line has no direction): each is an authored clip whose measured blade travel at contact
// (assets/clipdata.json `swing`, his frame: +x to his left) lies along that line seen over his shoulder
export const CUTS = {
  level: { id: 'level', label: '横 yoko', clip: 'Sword_Regular_B' },
  falling: { id: 'falling', label: '袈裟 kesa', clip: 'Sword_Attack' },             // '/': from over his right shoulder down to his left
  // (each clip's pose 0.16 s before its contact was looked at from the brush's camera: Sword_Regular_C's is a leap with a knee raised, so
  // the kesa is Sword_Attack's, the blade raised over the right shoulder; A low by the hip, B a lunge, the slam overhead in jōdan)
  rising: { id: 'rising', label: '逆袈裟 gyaku-kesa', clip: 'Sword_Regular_A' },    // '\': rising to his left
  vertical: { id: 'vertical', label: '唐竹 karatake', clip: 'two-handed-overhead-slam' },
};
export function cutOf(theta) {
  let a = ((theta % Math.PI) + Math.PI) % Math.PI; if (a > Math.PI / 2) a -= Math.PI;
  const d = a * 180 / Math.PI;
  return Math.abs(d) <= 22.5 ? CUTS.level : Math.abs(d) >= 67.5 ? CUTS.vertical : d > 0 ? CUTS.falling : CUTS.rising;
}
// a closed mesh's volume (the divergence theorem over its triangles), for the walls and for the smallest piece the brush will cut again
export function volumeOf(g) {
  const p = g.attributes.position, ix = g.index, n = ix ? ix.count : p.count, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < n; i += 3) { a.fromBufferAttribute(p, ix ? ix.getX(i) : i); b.fromBufferAttribute(p, ix ? ix.getX(i + 1) : i + 1); c.fromBufferAttribute(p, ix ? ix.getX(i + 2) : i + 2); v += a.dot(b.cross(c)) / 6; }
  return Math.abs(v);
}

const STRAW = { r: 0.07, len: 0.9, segs: 40 }, STALK = { r: 0.035, len: 2.2, segs: 28, wall: 0.72, node: 0.42 }, STAND = { h: 0.61, top: 0.17 };

export async function createBrush({ scene, P, land, camera, cam, ronin, vfx, sfx, painterly, contactOf, bandits, say, plant = null, spot, face = 0, hud = null, lantern = null, align = null }) {
  const PL = plant || '';
  const T = { v: new THREE.Vector3(), w: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), box: new THREE.Box3() };
  const baseFov = camera.fov;

  // ── the painted materials: every authored colour a swatch, the light on THE ramp, the strokes in each body's own space ──
  // the line where the sheet meets a cuttable, painted on its surface in crimson (MGR's "holographic orange lines", research K §5)
  const lineU = { bmN: { value: new THREE.Vector3(0, 1, 0) }, bmO: { value: new THREE.Vector3() }, bmOn: { value: 0 }, bmC: { value: col('crimson') } };
  const cutLine = (m) => addPatch(m, 'brush:line', (shader) => {
    Object.assign(shader.uniforms, lineU);
    shader.vertexShader = 'varying vec3 vBmW;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vBmW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'uniform vec3 bmN; uniform vec3 bmO; uniform float bmOn; uniform vec3 bmC; varying vec3 vBmW;\n' + shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      { float d = abs(dot(bmN, vBmW - bmO)), w = 0.004 + 0.0022 * length(vBmW - cameraPosition);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, bmC, bmOn * (1.0 - smoothstep(0.45 * w, w, d))); }`);
  });
  // the cut faces: the mat shows its roll (a spiral of pale straw, as a rolled sheet must), the stalk its wall (a pale ring stippled with its
  // fibres, hollow inside). Both read the piece's OWN space, which three-pinata keeps: a piece is drawn in its parent's frame
  // every colour a patch paints is a swatch, kept on the material (userData.swatches) where the paint walls read it (tests/paint.mjs L3)
  const keep = (m, o) => { m.userData.swatches = Object.assign(m.userData.swatches || {}, Object.fromEntries(Object.entries(o).map(([k, u]) => [k, u.value]))); return o; };
  const facePatch = (m, kind) => { const U = keep(m, { bmA: { value: col(kind === 'straw' ? 'gold' : 'moss') }, bmB: { value: col(kind === 'straw' ? 'stone' : 'mossDeep') } }); return addPatch(m, 'brush:face:' + kind, (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = 'varying vec3 vBmL;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vBmL = transformed;');
    shader.fragmentShader = 'uniform vec3 bmA; uniform vec3 bmB; varying vec3 vBmL;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float r = length(vBmL.xz), a = atan(vBmL.z, vBmL.x) / 6.28318;
        ${kind === 'straw'
    ? `float u = r / ${STRAW.r.toFixed(3)}, s = fract(u * 7.0 - a);                          // seven turns of the roll, core to rim
        diffuseColor.rgb = mix(diffuseColor.rgb, bmA, smoothstep(0.62, 0.8, s) * (1.0 - smoothstep(0.9, 1.0, s)));
        diffuseColor.rgb = mix(diffuseColor.rgb, bmB, 1.0 - smoothstep(0.1, 0.16, u));`        // the roll's core, dark and wet
    : `float u = r / ${STALK.r.toFixed(3)}; vec2 c = floor(vBmL.xz * 260.0);
        float dots = step(0.86 - 0.3 * smoothstep(${STALK.wall.toFixed(2)}, 1.0, u), fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453));
        diffuseColor.rgb = mix(diffuseColor.rgb, bmA, dots * 0.8);                         // the fibres, denser toward the skin
        diffuseColor.rgb = mix(diffuseColor.rgb, bmB, 1.0 - smoothstep(${(STALK.wall - 0.03).toFixed(2)}, ${STALK.wall.toFixed(2)}, u));`}   // the hollow
      }`);
  }); };
  // the outside: straw with its twine, the stalk with its nodes, both painted in the body's own space
  const bands = (m, kind) => { const U = keep(m, { bmBand: { value: col(kind === 'straw' ? 'ink' : 'mossDeep') }, bmRing: { value: col('paper') } }); return addPatch(m, 'brush:bands:' + kind, (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = 'varying vec3 vBmL;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vBmL = transformed;');
    shader.fragmentShader = 'uniform vec3 bmBand; uniform vec3 bmRing; varying vec3 vBmL;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { ${kind === 'straw'
    ? `float y = vBmL.y; float tw = 0.0; for (int i = -1; i <= 1; i++) tw = max(tw, 1.0 - smoothstep(0.006, 0.011, abs(y - float(i) * 0.3)));
        diffuseColor.rgb = mix(diffuseColor.rgb, bmBand, tw);`                              // the twine, three turns (Toyama-ryu: "fastened")
    : `float y = mod(vBmL.y + 0.05, ${STALK.node.toFixed(2)});
        diffuseColor.rgb = mix(diffuseColor.rgb, bmBand, 1.0 - smoothstep(0.006, 0.014, abs(y - 0.02)));
        diffuseColor.rgb = mix(diffuseColor.rgb, bmRing, 0.55 * (1.0 - smoothstep(0.0, 0.01, abs(y - 0.034))));`}   // a node and its pale ring
      }`);
  }); };
  const toon = (c) => new THREE.MeshToonMaterial({ color: col(c), gradientMap: RAMP });
  const own = (m, region, scale, strength) => paintSurface(m, { region, scale, strength, band: 0.25, space: 'object' });
  const M = {
    strawOut: own(bands(toon('gold'), 'straw'), 'field_b', 0.16, 0.42), strawIn: own(facePatch(toon('paper'), 'straw'), 'field_a', 0.05, 0.3),
    stalkOut: own(bands(toon('moss'), 'stalk'), 'field_b', 0.22, 0.3), stalkIn: own(facePatch(toon('paper'), 'stalk'), 'field_a', 0.05, 0.25),
    stand: paintSurface(toon('ink'), { region: 'field_a', scale: 0.4, strength: 0.35, band: 0.25 }), base: paintSurface(toon('stoneShade'), { region: 'field_a', scale: 0.4, strength: 0.35, band: 0.25 }),
  };
  for (const k of ['strawOut', 'strawIn', 'stalkOut', 'stalkIn']) cutLine(M[k]);
  if (PL === 'bmnoinner') { M.strawIn = M.strawOut; M.stalkIn = M.stalkOut; }
  for (const m of Object.values(M)) paintFog(m);

  // ── the sheet and the line: a pale wash of the paper with a dry-brush edge, and a wet crimson stroke where the blade will pass ──
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { ...atlasUniforms(), washRect: { value: rect('field_b') }, paperC: { value: col('ink') }, opacity: { value: 0 } },   // a thin wash of ink: on the
                                                                                  // ink-painted world a paper sheet vanished (take 2)
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec4 washRect; uniform vec3 paperC; uniform float opacity; varying vec2 vUv; ${PAINT_GLSL}
      void main(){ vec4 t = paintTile(vUv, washRect); float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float fray = smoothstep(0.02, 0.2, e + (t.r - 0.62) * 0.18); gl_FragColor = vec4(paperC, opacity * fray * (0.45 + 0.55 * t.a)); }` }));
  sheet.name = 'brush-sheet'; sheet.userData.painted = 'brush'; sheet.renderOrder = 5; sheet.frustumCulled = false; sheet.visible = false; scene.add(sheet);
  // the line is the ensō's own ink stroke texture (vfx.js): the same object, so the page holds the atlas once (a phone holds 192 MB)
  const strokeTex = vfx.enso.material.map; strokeTex.updateMatrix();
  // THE LINE, SEEN (research L §1, §6 A; the owner: "we need to show the lines"): wall C7 read take 5's line at 1.1 CSS px across on a phone,
  // and the oil pass KEPT it (153 % of the scene's own crimson: it spreads it) — the line was faint in the scene itself: crimson multiplied
  // by the stroke tile's own tone, and hidden behind the front of the mat it crossed. Now it is the crimson itself, the tile only its alpha
  // (the bristles' value, G, as every stroke here reads it), laid over what it cuts, 0.06 m wide (ours, from 0.035), drawn as the finger
  // draws it (C9). Plant bmthinline: the old line.
  const LINE_W = PL === 'bmthinline' ? 0.035 : 0.06;
  // THE LINE LIES UNDER THE FIGHTERS (the owner, 9 Nov, on take 6: "The line should not go over the character"). It is drawn as the ink
  // cut's blot is (vfx.js: "over the world and BEHIND the fighters"): in the opaque pass, after the world and before every fighter
  // (renderOrder 2 on every mesh of the ronin and the bandits, main.js), with no depth test so the mat it crosses never hides it, and no
  // blending (three.js draws every opaque mesh before any transparent one, so a blended line could only ever lie over him): its bristles cut
  // it out (discard), as the blot's ink is cut — the bristles ×3, cut at 25 %: the atlas stroke is a dry brush, mostly faint, and a cut at
  // 35 % of ×1.6 left 2.6 px of a half-drawn line (C9). It fades by its bristles too: the thinnest drop out first. Plant lineover: the line over him.
  const inkLine = () => PL === 'bmthinline'
    ? new THREE.MeshBasicMaterial({ map: strokeTex, alphaMap: strokeTex, color: col('crimson'), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0 })
    : new THREE.ShaderMaterial({ transparent: PL === 'lineover', depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { map: { value: strokeTex }, uvT: { value: strokeTex.matrix }, color: { value: col('crimson') }, on: { value: 0 } },
      vertexShader: 'uniform mat3 uvT; varying vec2 vUv; void main(){ vUv = (uvT * vec3(uv, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 color; uniform float on; varying vec2 vUv; void main(){ float a = clamp(texture2D(map, vUv).g * 3.0, 0.0, 1.0); if (a < mix(1.01, 0.25, on)) discard; gl_FragColor = vec4(color, 1.0); }' });
  const setOn = (m, v) => { if (m.uniforms) m.uniforms.on.value = v; else m.opacity = v; };
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), inkLine());
  line.name = 'brush-line'; line.userData.painted = 'stroke'; line.renderOrder = PL === 'lineover' ? 9 : 1; line.frustumCulled = false; line.visible = false; scene.add(line);

  // ── the bits a cut throws: straw and splinters, painted from the atlas's flecks in the body's swatches, on the world's clock ──
  const BITS = 96, bitGeo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  const bPos = new Float32Array(BITS * 3), bSize = new Float32Array(BITS), bTone = new Float32Array(BITS), bSpin = new Float32Array(BITS);
  bitGeo.setAttribute('iPos', new THREE.InstancedBufferAttribute(bPos, 3)); bitGeo.setAttribute('iSize', new THREE.InstancedBufferAttribute(bSize, 1));
  bitGeo.setAttribute('iTone', new THREE.InstancedBufferAttribute(bTone, 1)); bitGeo.setAttribute('iSpin', new THREE.InstancedBufferAttribute(bSpin, 1)); bitGeo.instanceCount = 0;
  const bitMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { ...atlasUniforms(), fleckRect: { value: rect('flecks') }, aC: { value: col('gold') }, bC: { value: col('paper') }, cC: { value: col('moss') } },
    vertexShader: `attribute vec3 iPos; attribute float iSize; attribute float iTone; attribute float iSpin; varying vec2 vUv; varying float vTone;
      void main(){ vUv = uv; vTone = iTone; vec4 mv = viewMatrix * vec4(iPos, 1.0); float c = cos(iSpin), s = sin(iSpin);
        mv.xy += mat2(c, -s, s, c) * (position.xy * vec2(iSize, iSize * 0.32)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec4 fleckRect; uniform vec3 aC; uniform vec3 bC; uniform vec3 cC; varying vec2 vUv; varying float vTone; ${PAINT_GLSL}
      void main(){ vec4 t = paintTile(vUv, fleckRect); if (t.a < 0.08) discard; vec3 c = vTone < 0.5 ? aC : vTone < 1.5 ? bC : cC; gl_FragColor = vec4(c * (0.82 + 0.4 * (t.r - 0.62)), t.a); }` });
  const bitMesh = new THREE.Mesh(bitGeo, bitMat); bitMesh.name = 'brush-bits'; bitMesh.userData.painted = 'brush'; bitMesh.frustumCulled = false; bitMesh.renderOrder = 3; scene.add(bitMesh);
  const bits = [];
  function throwBits(at, sweep, n, kind) {
    for (let i = 0; i < n && bits.length < BITS; i++) {
      const v = sweep.clone().multiplyScalar(1.2 + Math.random() * 2.2).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.6, (Math.random() - 0.5) * 1.6));
      bits.push({ p: at.clone().addScaledVector(sweep, (Math.random() - 0.5) * 0.12), v, size: 0.025 + Math.random() * 0.035, tone: kind === 'straw' ? (Math.random() < 0.6 ? 0 : 1) : (Math.random() < 0.5 ? 2 : 1), spin: Math.random() * 6.28, w: (Math.random() - 0.5) * 18, life: 2.2 + Math.random() });
    }
  }
  function bitsUpdate(dt) {
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]; b.life -= dt; b.v.y -= 9.81 * dt; b.v.multiplyScalar(Math.max(0, 1 - 1.4 * dt)); b.p.addScaledVector(b.v, dt); b.spin += b.w * dt;
      const g = land.groundY(b.p.x, b.p.z) + 0.01; if (b.p.y < g) { b.p.y = g; b.v.set(0, 0, 0); b.w = 0; }
      if (b.life <= 0) bits.splice(i, 1);
    }
    bitGeo.instanceCount = bits.length;
    bits.forEach((b, i) => { bPos.set([b.p.x, b.p.y, b.p.z], i * 3); bSize[i] = b.size * Math.min(1, b.life * 2); bTone[i] = b.tone; bSpin[i] = b.spin; });
    for (const k of ['iPos', 'iSize', 'iTone', 'iSpin']) bitGeo.attributes[k].needsUpdate = true;
  }

  // ── Jolt: a body per piece, the convex hull of its own vertices (a cut cylinder is convex) ──
  function hullBody(mesh, dynamic) {
    const { Jolt, bodies } = P, s = new Jolt.ConvexHullShapeSettings(), a = mesh.geometry.attributes.position, v = new Jolt.Vec3(0, 0, 0);
    for (let i = 0; i < a.count; i++) { v.Set(a.getX(i), a.getY(i), a.getZ(i)); s.mPoints.push_back(v); }
    s.mMaxConvexRadius = 0.004;
    const r = s.Create(); Jolt.destroy(v);
    if (r.HasError()) { console.warn('[brush] hull refused:', r.GetError().c_str()); Jolt.destroy(s); return null; }
    const p = mesh.position, q = mesh.quaternion, rp = new Jolt.RVec3(p.x, p.y, p.z), rq = new Jolt.Quat(q.x, q.y, q.z, q.w);
    const cs = new Jolt.BodyCreationSettings(r.Get(), rp, rq, dynamic ? Jolt.EMotionType_Dynamic : Jolt.EMotionType_Static, dynamic ? LAYER_DEBRIS : LAYER_STATIC);
    cs.mFriction = BRUSH.mu; cs.mRestitution = BRUSH.restitution;
    const body = bodies.CreateBody(cs); bodies.AddBody(body.GetID(), dynamic ? Jolt.EActivation_Activate : Jolt.EActivation_DontActivate);
    Jolt.destroy(cs); Jolt.destroy(s); Jolt.destroy(rp); Jolt.destroy(rq);
    return body;
  }
  const dropBody = (b) => { if (!b) return; const id = b.GetID(); P.bodies.RemoveBody(id); P.bodies.DestroyBody(id); };

  // ── the ground: three mats on stands, a stand of three green stalks, two stone lanterns; at a named spot on the spawn's own flat ──
  const fwd = new THREE.Vector3(Math.sin(face), 0, Math.cos(face)), side = new THREE.Vector3(fwd.z, 0, -fwd.x);
  const at = (x, z) => { const p = spot.clone().addScaledVector(side, x).addScaledVector(fwd, z); p.y = land.groundY(p.x, p.z); return p; };
  const stands = [], pieces = [], events = [];
  const log = (e) => { events.push(e); if (events.length > 240) events.splice(0, events.length - 240); };   // what the walls read
  function addStand(kind, x, z) {
    const g = at(x, z), id = stands.length, grp = new THREE.Group(); grp.position.copy(g); scene.add(grp);
    if (kind === 'straw') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), M.base); base.position.y = 0.03;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, STAND.h - 0.06, 0.09), M.stand); post.position.y = 0.06 + (STAND.h - 0.06) / 2;
      for (const m of [base, post]) { m.castShadow = m.receiveShadow = true; grp.add(m); }
      addStaticBox(P, g.clone().add(new THREE.Vector3(0, STAND.h / 2, 0)), new THREE.Vector3(0.06, STAND.h / 2, 0.06));
    } else {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 20), M.base); base.position.y = 0.06; base.castShadow = base.receiveShadow = true; grp.add(base);
      addStaticBox(P, g.clone().add(new THREE.Vector3(0, 0.06, 0)), new THREE.Vector3(0.28, 0.06, 0.28));
    }
    const s = { id, kind, at: g, grp, cutAt: null, fading: 0, homes: [] };
    if (kind === 'straw') s.homes.push({ p: g.clone().add(new THREE.Vector3(0, STAND.h + STRAW.len / 2 - 0.05, 0)), base: g.clone().add(new THREE.Vector3(0, STAND.h, 0)) });
    else for (const [dx, dz] of [[-0.11, 0.04], [0.1, 0.07], [0.0, -0.1]]) { const p = g.clone().add(new THREE.Vector3(dx, 0.12 + STALK.len / 2, dz)); s.homes.push({ p, base: g.clone().add(new THREE.Vector3(dx, 0.12, dz)) }); }
    stands.push(s); raise(s); return s;
  }
  function raise(s) {                                                   // a fresh target on every home of the stand (it fades in)
    for (const h of s.homes) {
      const geo = s.kind === 'straw' ? new THREE.CylinderGeometry(STRAW.r, STRAW.r, STRAW.len, STRAW.segs, 1) : new THREE.CylinderGeometry(STALK.r * 0.92, STALK.r, STALK.len, STALK.segs, 1);
      const mesh = new DestructibleMesh(geo, s.kind === 'straw' ? M.strawOut : M.stalkOut, s.kind === 'straw' ? M.strawIn : M.stalkIn);
      mesh.position.copy(h.p); mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'brush-' + s.kind; scene.add(mesh); mesh.updateMatrixWorld(true);
      pieces.push({ mesh, body: hullBody(mesh, false), dynamic: false, kind: s.kind, stand: s, rooted: true, base: h.base.clone(), volume: volumeOf(geo), born: clock.t, rest: 0, out: 0, whole: true, alpha: 0 });
    }
  }
  const clock = { t: 0 };
  addStand('straw', -2.2, 0); addStand('straw', -0.6, 0.45); addStand('straw', 1.0, 0); addStand('stalk', 2.7, -0.4);
  // two stone lanterns at its ends: the shrine's own CC0 toro (Poly Pizza), cloned from the model env.js loaded, so its geometry and its
  // painted materials are shared, never loaded twice
  if (lantern) for (const x of [-3.8, 4.2]) {
    const l = lantern.clone(), p = at(x, 0.9); l.position.copy(p); l.position.y -= 0.05; l.rotation.y = face + Math.PI; l.scale.setScalar(3); scene.add(l);
    l.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    addStaticBox(P, p.clone().add(new THREE.Vector3(0, 0.75, 0)), new THREE.Vector3(0.3, 0.75, 0.3));
  }

  // ── the held moment ──
  const S = { open: false, toggled: false, pressedAt: 0, ink: BRUSH.pots, ts: 1, look: 0, focus: null, aim: new THREE.Vector3(), theta: 0.55, cut: cutOf(0.55),
    screenNew: null, aimY: null, n: new THREE.Vector3(0, 1, 0), o: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), toAim: new THREE.Vector3(0, 0, 1),
    swing: null, freeze: 0, real: 0, pose: null, saved: null, linger: 0, lens: 0, cutThisTime: false,
    draw: { t0: -1.2, t1: -1.2, mode: 'auto' } };                     // the line as drawn: metres from the aim along it, start and end
  // a screen point laid onto the cut line as the screen shows it: metres from the aim along S.dir (C9: the line is drawn as the finger draws)
  function alongLine(sx, sy) {
    const a = S.aim.clone().project(camera), b = S.aim.clone().addScaledVector(S.dir, 0.5).project(camera);
    const ax = (a.x + 1) / 2 * innerWidth, ay = (1 - a.y) / 2 * innerHeight, bx = (b.x + 1) / 2 * innerWidth, by = (1 - b.y) / 2 * innerHeight, L = Math.hypot(bx - ax, by - ay);
    return L < 1e-3 ? 0 : THREE.MathUtils.clamp(((sx - ax) * (bx - ax) + (sy - ay) * (by - ay)) / (L * L) * 0.5, -1.6, 1.6);
  }
  const pieceOf = (mesh) => pieces.find((x) => x.mesh === mesh);
  const centerOf = (x, out = new THREE.Vector3()) => { T.box.setFromObject(x.mesh); return T.box.getCenter(out); };
  function chooseFocus(me) {
    const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
    let best = null, score = 1e9;
    for (const x of pieces) {
      if (x.out > 0 || x.volume < BRUSH.minVolume) continue;
      const c = centerOf(x), to = c.clone().sub(me.pos).setY(0), d = to.length(); if (d > BRUSH.focusRange) continue;
      const ang = Math.acos(THREE.MathUtils.clamp(to.normalize().dot(f), -1, 1)) * 57.3; if (ang > BRUSH.focusCone && d > 1.2) continue;
      const sc = d + ang * 0.03 + (x.whole ? 0 : 0.4); if (sc < score) { score = sc; best = x; }
    }
    return best;
  }
  // the plane the player is shown: through the aim, holding the line's direction on the screen at its angle, and the line from his sword
  // shoulder to the aim (so it is seen a little from the side, a sheet, never edge on). The swing follows it exactly (B1).
  const ndc = (sx, sy, out) => out.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
  const ray = new THREE.Raycaster(), n2 = new THREE.Vector2();
  function onPlane(sx, sy, pn, po, out) { ray.setFromCamera(ndc(sx, sy, n2), camera); return ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(pn, po), out); }
  function shoulder(me, out) { const f = me.facing; return out.set(me.pos.x - Math.cos(f) * 0.2, me.pos.y + 1.42, me.pos.z + Math.sin(f) * 0.2); }
  function aimPlane(me) {
    camera.updateMatrixWorld();
    const c = S.focus ? centerOf(S.focus) : me.pos.clone().add(new THREE.Vector3(Math.sin(me.facing) * 1.2, 1.1, Math.cos(me.facing) * 1.2));
    // the aim: the focus's middle, at the height the stroke (or the brush's tip) crossed it, on the upright plane through the focus facing
    // the eye; kept in the WORLD once set, so the camera easing in never moves it (a screen point held still would slide up the mat)
    S.aim.copy(c);
    if (S.focus) {
      T.box.setFromObject(S.focus.mesh);
      if (S.screenNew) { const fn = camera.position.clone().sub(c).setY(0).normalize(), hit = onPlane(S.screenNew.x, S.screenNew.y, fn, c, new THREE.Vector3()); if (hit) S.aimY = hit.y - T.box.min.y; S.screenNew = null; }
      if (S.aimY !== null) S.aim.y = THREE.MathUtils.clamp(T.box.min.y + S.aimY, T.box.min.y + 0.03, T.box.max.y - 0.03);
    }
    const H = shoulder(me, new THREE.Vector3()); S.toAim.copy(S.aim).sub(H).normalize();
    // the line's direction in the world: two points along the screen line through the aim's own screen point, on the plane square to toAim
    const sp = S.aim.clone().project(camera), px = (sp.x + 1) / 2 * innerWidth, py = (1 - sp.y) / 2 * innerHeight, e = 24;
    const th = PL === 'bmswipe' ? 0.55 : S.theta, a = onPlane(px - Math.cos(th) * e, py + Math.sin(th) * e, S.toAim, S.aim, new THREE.Vector3()), b = onPlane(px + Math.cos(th) * e, py - Math.sin(th) * e, S.toAim, S.aim, new THREE.Vector3());
    if (a && b && a.distanceToSquared(b) > 1e-8) S.dir.copy(b).sub(a).normalize();
    S.n.crossVectors(S.dir, S.toAim).normalize(); S.o.copy(S.aim);
    const y = new THREE.Vector3().crossVectors(S.n, S.dir);
    sheet.quaternion.setFromRotationMatrix(T.m.makeBasis(S.dir, y, S.n)); sheet.position.copy(S.aim);
    lineU.bmN.value.copy(S.n); lineU.bmO.value.copy(S.o);
  }
  function pose(cut) {                                                  // the wind-up of the cut the line names, held still
    const C = contactOf(cut.clip); S.pose = cut;
    ronin.play(cut.clip, { loop: false, fade: 0.14, speed: 0, at: Math.max(0, C.t - BRUSH.lead) });
  }
  function open(me, toggled = false) {
    if (S.open || S.ink < 1 || !me.alive || me.busy) return false;
    S.open = true; S.toggled = toggled; S.pressedAt = S.real; S.screenNew = null; S.aimY = null; S.focus = chooseFocus(me);
    S.draw.t0 = S.draw.t1 = -1.2; S.draw.mode = 'auto';
    if (!S.saved) S.saved = { dist: cam.dist, pitch: cam.pitch };
    S.cut = cutOf(S.theta); aimPlane(me); pose(S.cut);
    S.flash = 0.45; sfx('breath'); log({ kind: 'open', real: S.real, t: clock.t }); return true;
  }
  function close() {
    if (!S.open) return; S.open = false; S.toggled = false;
    if (!S.swing) { ronin.play('Sword_Idle', { loop: true, fade: 0.2 }); if (align) align.letGo(); }
    S.linger = S.cutThisTime ? BRUSH.cam.linger : 0; S.cutThisTime = false;
    sfx('exhale'); log({ kind: 'close', real: S.real, t: clock.t });
  }
  // the release: the ronin swings the cut the line names; the slice lands on the clip's contact frame (afterAnimate)
  function release(me) {
    if (!S.open || S.swing) return false;
    if (S.ink < 1) { sfx('swing', 0.3); return false; }
    if (PL !== 'bmfreeink') S.ink -= 1;
    aimPlane(me);
    const cut = cutOf(S.theta), C = contactOf(cut.clip);
    if (S.pose !== cut) pose(cut);
    const a = ronin.action(cut.clip); a.setEffectiveTimeScale(BRUSH.swingRate);
    S.swing = { cut, C, a, at: S.real, done: false, n: S.n.clone(), o: S.o.clone(), dir: S.dir.clone(), aim: S.aim.clone(), sweep: null, wait: PL === 'bmlate' ? 0.3 : 0 };
    S.swing.dirAt = S.dir.clone(); S.draw.mode = 'cut';                // the cut completes the line it follows
    sfx('swing'); log({ kind: 'release', real: S.real, t: clock.t, theta: S.theta, cut: cut.id, dir: S.dir.clone(), sheet: { n: new THREE.Vector3(0, 0, 1).applyQuaternion(sheet.quaternion), o: sheet.position.clone() } }); return true;
  }
  // the cut itself, on the shown plane (plant bmskew turns it 20° off the sheet)
  function slice(x, n, o, sweep) {
    if (x.volume < BRUSH.minVolume) return 0;
    x.mesh.updateMatrixWorld(true);
    const parts = x.mesh.sliceWorld(n, o);
    if (!parts || parts.length < 2) return 0;
    let v0 = new THREE.Vector3(), w0 = new THREE.Vector3();
    if (x.dynamic && x.body) { const lv = P.bodies.GetLinearVelocity(x.body.GetID()), av = P.bodies.GetAngularVelocity(x.body.GetID()); v0.set(lv.GetX(), lv.GetY(), lv.GetZ()); w0.set(av.GetX(), av.GetY(), av.GetZ()); }
    remove(x);
    const b = x.rooted ? n.dot(T.v.copy(x.base).sub(o)) : 0, keep = x.rooted && Math.abs(b) > 0.01 && PL !== 'bmroot' ? Math.sign(b) : 0;
    const made = [];
    parts.forEach((p, i) => {
      p.castShadow = p.receiveShadow = true; p.name = x.mesh.name; scene.add(p); p.updateMatrixWorld(true);
      if (PL === 'bmshrink' && i === 1) p.geometry.scale(0.9, 0.9, 0.9);
      const s = sideOf(p, n, o), rooted = keep !== 0 && s === keep;
      const rec = { mesh: p, body: hullBody(p, !rooted), dynamic: !rooted, kind: x.kind, stand: x.stand, rooted, base: rooted ? x.base.clone() : null, volume: volumeOf(p.geometry), born: clock.t, rest: 0, out: 0, whole: false, alpha: 1 };
      pieces.push(rec); made.push(rec);
      if (rec.dynamic && rec.body) {
        const v = v0.clone().addScaledVector(sweep, PL === 'bmthrow' ? 0 : BRUSH.push).addScaledVector(n, (PL === 'bmthrow' ? 3 : BRUSH.part) * s);
        const w = w0.clone().addScaledVector(new THREE.Vector3().crossVectors(n, sweep), 0.9 * s);
        P.bodies.SetLinearVelocity(rec.body.GetID(), new P.Jolt.Vec3(v.x, v.y, v.z)); P.bodies.SetAngularVelocity(rec.body.GetID(), new P.Jolt.Vec3(w.x, w.y, w.z));
      }
    });
    if (x.stand) x.stand.cutAt = clock.t;
    log({ kind: 'slice', real: S.real, t: clock.t, of: x.kind, volume: x.volume, n: n.clone(), o: o.clone(), pieces: made });
    // the cap: the oldest piece that is not a stand's rooted base goes when there are too many (Korekado: every cut doubles the count)
    if (PL !== 'bmnocap') while (pieces.filter((q) => !q.out).length > BRUSH.cap) { const old = pieces.find((q) => !q.out && q.dynamic); if (!old) break; old.out = 1e-4; }
    return made.length;
  }
  // which side of the plane a piece lies on: the sign of its farthest vertex (a tilted sliver's bounding-box centre can lie on the other side)
  function sideOf(mesh, n, o) { mesh.updateMatrixWorld(true); const a = mesh.geometry.attributes.position; let best = 0;
    for (let i = 0; i < a.count; i++) { const d = n.dot(T.w.fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld).sub(o)); if (Math.abs(d) > Math.abs(best)) best = d; } return Math.sign(best) || 1; }
  function remove(x) {                                                // gone: its body, its geometry, its fading copies (a phone holds 192 MB)
    scene.remove(x.mesh); dropBody(x.body); x.body = null; x.mesh.geometry.dispose(); if (x.fadeMats) { for (const m of x.fadeMats) m.dispose(); x.fadeMats = null; }
    const i = pieces.indexOf(x); if (i >= 0) pieces.splice(i, 1); }
  function contact(me) {
    const st = S.swing; st.done = true; S.freeze = BRUSH.hitStop;
    let n = st.n, o = st.o;
    if (PL === 'bmskew') { const axis = camera.position.clone().sub(o).normalize(); n = n.clone().applyAxisAngle(axis, 20 * Math.PI / 180); }
    // the blade's travel at contact, from the clip (his frame turned by his facing), laid along the plane
    const sw = st.C.swing || [1, 0, 0], f = me.facing, sweep = new THREE.Vector3(Math.cos(f) * sw[0] + Math.sin(f) * sw[2], sw[1], -Math.sin(f) * sw[0] + Math.cos(f) * sw[2]);
    sweep.addScaledVector(n, -sweep.dot(n)); if (sweep.lengthSq() < 1e-6) sweep.copy(st.dir); sweep.normalize(); st.sweep = sweep;
    let cut = 0; const kinds = new Set(); S.cutThisTime = true;
    const reach = PL === 'bmreach' ? 99 : BRUSH.reach;
    for (const x of [...pieces]) {
      if (x.out) continue;
      T.box.setFromObject(x.mesh);
      const cx = THREE.MathUtils.clamp(me.pos.x, T.box.min.x, T.box.max.x), cz = THREE.MathUtils.clamp(me.pos.z, T.box.min.z, T.box.max.z);
      if (Math.hypot(cx - me.pos.x, cz - me.pos.z) > reach) continue;
      let lo = 1e9, hi = -1e9;
      for (const X of [T.box.min.x, T.box.max.x]) for (const Y of [T.box.min.y, T.box.max.y]) for (const Z of [T.box.min.z, T.box.max.z]) { const d = n.dot(T.v.set(X, Y, Z).sub(o)); lo = Math.min(lo, d); hi = Math.max(hi, d); }
      if (lo < -1e-3 && hi > 1e-3 && slice(x, n, o, sweep)) { cut++; kinds.add(x.kind); throwBits(T.v.copy(st.aim), sweep, x.kind === 'straw' ? 16 : 10, x.kind); }
    }
    // a bandit on the line takes the cut as the combo's first cut would: he is never sliced (props only, no gore)
    for (const b of bandits.alive()) {
      const bp = b.root.position; if (Math.hypot(bp.x - me.pos.x, bp.z - me.pos.z) > reach) continue;
      if (Math.abs(n.dot(T.v.set(bp.x, bp.y + 1.1, bp.z).sub(o))) > 0.6) continue;
      bandits.hit(b, sweep.clone().setY(0).normalize(), 1, { from: me.pos.clone() }); vfx.hit(T.v.set(bp.x, bp.y + 1.2, bp.z), sweep, true);
    }
    if (cut) {
      vfx.stroke(st.aim.clone().addScaledVector(st.dir, -0.55), st.aim.clone().addScaledVector(st.dir, 0.55), { width: 0.07, color: 'ink', life: 1.5 });
      sfx('cut', 0.9); if (kinds.has('straw')) sfx('straw'); if (kinds.has('stalk')) sfx('knock');
      say(st.cut.label, 900);
    }
    log({ kind: 'contact', real: S.real, t: clock.t, cut, theta: S.theta, swing: st.cut.id, clipTime: st.a.time, contactT: st.C.t, nearT: st.nearT, near: st.near, dir: st.dir.clone(), tip: ronin.sword.userData.tip.getWorldPosition(new THREE.Vector3()), n: n.clone(), o: o.clone(), shown: { n: st.n.clone(), o: st.o.clone() },
      align: align ? { need: align.S.need, got: align.S.got, carry: align.S.carry, moved: align.S.moved, turned: align.S.turned, wantMove: align.S.wantMove, wantTurn: align.S.wantTurn, miss: align.S.miss } : null });
    if (align) align.letGo();                                           // the turn eases out after the cut (the carry holds its window)
  }

  // ── every frame, before the world steps (real seconds; the input of this frame; the ronin as main.js holds him) ──
  function frame(realDt, inp, me) {
    S.real += realDt;
    // the button or the key: a hold is a held moment, a tap opens it until a second tap (or the ink runs dry)
    if (inp.brushDown) { if (!S.open) open(me); else if (S.toggled) close(); }
    if (inp.brushUp && S.open && !S.toggled) { if (S.real - S.pressedAt < BRUSH.tap) S.toggled = true; else close(); }
    if (S.open) {
      if (PL !== 'bmfreeink' && S.real - S.pressedAt > BRUSH.dryAfter) S.ink = Math.max(0, S.ink - realDt / BRUSH.dryEvery);
      if (S.ink < 1 && !S.swing) close();
    } else S.ink = Math.min(BRUSH.pots, S.ink + realDt / BRUSH.refillEvery);
    // the world's clock and the look (both eased on the real clock)
    const want = S.open && PL !== 'bmnoslow' ? BRUSH.scale : 1, tau = S.open ? BRUSH.tauIn : (PL === 'bmlinger' ? 1.0 : BRUSH.tauOut);
    S.ts += (want - S.ts) * (1 - Math.exp(-realDt / tau)); if (Math.abs(S.ts - 1) < 1e-3 && want === 1) S.ts = 1;
    // the look snaps in within two frames and leaves in ~0.2 s (MGR's tint, measured off its footage: research K §8); the opening flashes
    // the bare paper and settles into the ink over ~0.45 s, as MGR's tint overshoots and settles
    S.look += ((S.open ? 1 : 0) - S.look) * (1 - Math.exp(-realDt / (S.open ? 0.025 : 0.07))); if (!S.open && S.look < 1e-3) S.look = 0;
    S.flash = S.open ? (S.flash || 0) * Math.exp(-realDt / 0.15) : 0;
    if (S.open) {
      if (!S.focus || S.focus.out || !pieces.includes(S.focus)) { S.focus = chooseFocus(me); S.aimY = null; }
      // the stroke: its angle on the screen is the line's (the stick pushed out), its lift is the cut (the stick let go)
      const k = inp.stroke;
      if (k && k.down) {
        const dx = k.x - k.x0, dy = k.y - k.y0;
        if (Math.hypot(dx, dy) > 12) { S.theta = Math.atan2(-dy, dx); S.screenNew = { x: (k.x + k.x0) / 2, y: (k.y + k.y0) / 2 }; }
      } else if (k && k.hover) S.screenNew = { x: k.hover.x, y: k.hover.y };
      if (k && k.ended) release(me);
      if (inp.cut) release(me);
      // stepping round the focus, always facing it (left/right round it, up/down nearer or farther), on the real clock
      if (S.focus && !S.swing && (Math.abs(inp.mx) > 0.05 || Math.abs(inp.my) > 0.05)) {
        const c = centerOf(S.focus), r0 = Math.hypot(me.pos.x - c.x, me.pos.z - c.z), ang = Math.atan2(me.pos.x - c.x, me.pos.z - c.z);
        const r = THREE.MathUtils.clamp(r0 - inp.my * BRUSH.orbit.speed * realDt, BRUSH.orbit.min, BRUSH.orbit.max), a = ang + inp.mx * BRUSH.orbit.speed * realDt / Math.max(r, 0.5);
        const x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r; me.setPos(x, land.groundY(x, z) + 0.02, z);
      }
      const cut = cutOf(S.theta);
      if (cut !== S.cut) { S.cut = cut; if (!S.swing) pose(cut); }
      // he turns so the line's cut meets the focus where its clip's blade crosses in front of him (strike()'s own turn)
      if (S.focus) {                                                      // ...by where the TURNED contact lands, once the body aligns (align.js)
        const clip = (S.swing ? S.swing.cut : S.cut).clip, c = centerOf(S.focus), C = (align && align.turnedContact(clip, me.facing, me.pos)) || contactOf(clip), fa = Math.atan2(c.x - me.pos.x, c.z - me.pos.z) - Math.atan2(C.off, C.reach);
        const d = Math.atan2(Math.sin(fa - me.facing), Math.cos(fa - me.facing)); me.facing += d * Math.min(1, realDt * 12);
      }
      aimPlane(me);
      // the line as the finger draws it: from where the stroke began to where the finger is, both laid onto the cut line (plant bmwholeline:
      // the whole line from the first touch, as take 5 had it)
      if (k && k.down && PL !== 'bmwholeline') { S.draw.t0 = alongLine(k.x0, k.y0); S.draw.t1 = alongLine(k.x, k.y); S.draw.mode = 'finger'; }
      // the body aligns (align.js): the cut the line names turned toward the plane, while it is aimed and through its swing
      if (align) { const st = S.swing; if (st && !st.done) align.aim(st.n, st.cut.clip, me.facing); else if (!st) align.aim(S.n, S.cut.clip, me.facing); }
    }
    // the line's own pace when no finger draws it: drawn out by itself (a key's cut) over 0.15 s, and completed by the cut over 0.08 s so it
    // spans the target (ours)
    { const D = S.draw, full = 1.2, toward = (x, y, v) => (x < y ? Math.min(y, x + v) : Math.max(y, x - v));
      if (PL === 'bmwholeline') { D.t0 = -full; D.t1 = full; }
      else if (D.mode === 'auto') { D.t0 = -full; D.t1 = Math.min(full, D.t1 + realDt * 2 * full / 0.15); }
      else if (D.mode === 'cut') { const s = D.t1 >= D.t0 ? 1 : -1, v = realDt * 2 * full / 0.08;
        D.t0 = toward(D.t0, s > 0 ? Math.min(D.t0, -0.6) : Math.max(D.t0, 0.6), v); D.t1 = toward(D.t1, s > 0 ? Math.max(D.t1, 0.6) : Math.min(D.t1, -0.6), v); } }
    // the camera, through cam alone: in over the right shoulder, low, the field of view narrowed; back to where it was after
    S.me = me;
    // the linger: the shot holds on the cut while time comes back, and lets go at once if he moves or acts
    if (!S.open && S.linger > 0) { S.linger = Math.max(0, S.linger - realDt); if (Math.abs(inp.mx) + Math.abs(inp.my) > 0.1 || inp.strike || inp.roll || inp.jump || inp.dash || inp.storm) S.linger = 0; }
    S.lens += ((S.open || S.linger > 0 ? 1 : 0) - S.lens) * (1 - Math.exp(-realDt / (S.open ? 0.025 : 0.12))); if (!S.open && S.linger <= 0 && S.lens < 1e-3) S.lens = 0;
    if ((S.look > 0 || S.linger > 0 || S.lens > 0) && !cam.hold) {
      const k = 1 - Math.exp(-realDt / BRUSH.cam.tau);
      if (S.open) {                                                     // the shot: behind his right shoulder, low, toward the focus
        const fw = S.focus ? centerOf(S.focus).sub(me.pos).setY(0).normalize() : new THREE.Vector3(Math.sin(me.facing), 0, Math.cos(me.facing)), rt = new THREE.Vector3(-fw.z, 0, fw.x);
        const C = me.pos.clone().addScaledVector(fw, -BRUSH.cam.back).addScaledVector(rt, BRUSH.cam.right); C.y = me.pos.y + BRUSH.cam.height;
        const off = C.sub(frameTarget(new THREE.Vector3())), dist = off.length();
        const yaw = Math.atan2(off.x, off.z), pitch = Math.asin(THREE.MathUtils.clamp(off.y / dist, -1, 1)), dy = Math.atan2(Math.sin(yaw - cam.yaw), Math.cos(yaw - cam.yaw));
        cam.yaw += dy * k; cam.pitch += (pitch - cam.pitch) * k; cam.dist += (dist - cam.dist) * k;
      } else if (S.linger <= 0 && S.saved && PL !== 'bmcamstuck') { cam.dist += (S.saved.dist - cam.dist) * k; cam.pitch += (S.saved.pitch - cam.pitch) * k; }
      const fov = PL === 'bmcamstuck' && !S.open ? BRUSH.cam.fov : baseFov + (BRUSH.cam.fov - baseFov) * S.lens;
      if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
    // the held moment over: the follow camera has its own distance, height and lens back exactly (plant bmcamstuck keeps the brush's)
    if (S.look === 0 && S.linger <= 0 && S.lens < 1e-3 && S.saved) { if (PL !== 'bmcamstuck') { cam.dist = S.saved.dist; cam.pitch = S.saved.pitch; if (camera.fov !== baseFov) { camera.fov = baseFov; camera.updateProjectionMatrix(); } } S.saved = null; }
    // the look: the ink wash, the painter's focus, the sheet and the line, the crimson lines on what it will cut
    const L = S.look;
    painterly.brush.wash.value = PL === 'bmnowash' ? 0 : L; painterly.brush.flash.value = PL === 'bmnowash' ? 0 : S.flash;
    painterly.brush.focusAmt.value = L; if (S.focus) painterly.brush.focusDepth.value = camera.position.distanceTo(S.aim);
    sheet.visible = line.visible = L > 0.01; sheet.material.uniforms.opacity.value = 0.13 * L; setOn(line.material, 0.95 * L); lineU.bmOn.value = S.focus ? L : 0;
    if (L > 0.01) {                                                     // the drawn part of the line, its pressed start where the stroke began
      const D = S.draw, len = Math.max(0.04, Math.abs(D.t1 - D.t0)), x = S.dir.clone().multiplyScalar(D.t1 >= D.t0 ? 1 : -1);
      line.position.copy(S.aim).addScaledVector(S.dir, (D.t0 + D.t1) / 2);
      line.scale.set(len, LINE_W * Math.min(1, 0.4 + 0.6 * len / 0.15), 1);   // it widens from its press over its first 0.15 m (ours)
      const z = camera.position.clone().sub(line.position); z.addScaledVector(x, -z.dot(x)).normalize();
      line.quaternion.setFromRotationMatrix(T.m.makeBasis(x, new THREE.Vector3().crossVectors(z, x), z));
    }
    if (hud) { const full = Math.floor(S.ink + 1e-6); hud.pots.forEach((el, i) => { el.className = i < full ? 'full' : i < S.ink ? 'part' : ''; }); }
    document.body.classList.toggle('brush-open', S.open); document.body.classList.toggle('brush-near', !S.open && !!chooseFocus(me));
    if (S.freeze > 0) S.freeze = Math.max(0, S.freeze - realDt);
    return S;
  }
  // after the ronin's mixer moved: the slice lands as the REAL blade (hilt to tip, read off the skeleton) passes nearest the aim, in a window
  // round the clip's measured contact: a mat is cut where the blade crosses it, anywhere along its length (the tip alone missed the drawn line
  // by 0.49 m on Sword_Attack while its blade went through the mat); then the next cut may begin from the wind-up again
  const bladeTo = (p) => { const a = ronin.sword.userData.base.getWorldPosition(new THREE.Vector3()), b = ronin.sword.userData.tip.getWorldPosition(new THREE.Vector3()), ab = b.clone().sub(a);
    const k = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1); return a.addScaledVector(ab, k).distanceTo(p); };
  function afterAnimate(me) {
    const st = S.swing; if (!st) return;
    if (align) align.carry(st.n, st.o, st.a.time - st.C.t);             // the arm lays the blade into the shown plane through its contact window

    if (!st.done && st.a.time >= st.C.t - 0.1) {
      const d = bladeTo(st.aim);
      // a real pass: the distance has fallen and turns back up (a swing's wind-back first moves the tip away), or the window ends
      if (st.near === undefined || d < st.near) { st.near = d; st.nearT = st.a.time; }
      if (st.prev !== undefined && d < st.prev - 1e-4) st.falling = true;
      // the rise that says it passed is relative (ours): 1 cm over a pass at 0.92 m let a wobble of the carried arm read as the contact in
      // WebKit (B14: the slice 0.92 m from the aim); 15 % of the nearest distance holds a far wobble, and a true pass still fires in a frame
      const passed = st.falling && d > st.near * 1.15 + 0.01;
      st.prev = d;
      if (passed || st.a.time >= st.C.t + 0.12) { if (st.wait > 0) st.wait -= 1 / 60; else contact(me); }
    }
    if (st.done && S.freeze <= 0 && S.real - st.at > (st.C.t - Math.max(0, st.C.t - BRUSH.lead)) / BRUSH.swingRate + BRUSH.recover) {
      S.swing = null;
      if (S.open) pose(S.cut); else ronin.play('Sword_Idle', { loop: true, fade: 0.25 });
    }
  }
  // after the world stepped: the pieces where Jolt carries them; at rest a while, they fade into the paper and the stand is dressed again
  function sync(dt) {
    clock.t += dt; bitsUpdate(dt);
    for (const x of [...pieces]) {
      if (x.dynamic && x.body) {
        const p = x.body.GetPosition(), q = x.body.GetRotation(); x.mesh.position.set(p.GetX(), p.GetY(), p.GetZ()); x.mesh.quaternion.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
        const v = x.body.GetLinearVelocity(); x.rest = Math.hypot(v.GetX(), v.GetY(), v.GetZ()) < 0.05 ? x.rest + dt : 0;
      }
      if (x.alpha < 1 && !x.out) { x.alpha = Math.min(1, x.alpha + dt / BRUSH.fade); fadeTo(x, x.alpha); }
      if (x.out) { x.out += dt; fadeTo(x, Math.max(0, 1 - x.out / BRUSH.fade)); if (x.out >= BRUSH.fade) remove(x); }
    }
    // plant bmheavy: the mistake of remaking every falling piece's hull every frame (wall B10 must catch the brush's own work growing)
    if (PL === 'bmheavy') for (const x of pieces) if (x.dynamic && x.body) { const lv = x.body.GetLinearVelocity(), v = new P.Jolt.Vec3(lv.GetX(), lv.GetY(), lv.GetZ()); dropBody(x.body); x.body = hullBody(x.mesh, true); if (x.body) P.bodies.SetLinearVelocity(x.body.GetID(), v); P.Jolt.destroy(v); }
    for (const s of stands) {
      if (s.cutAt === null || S.open || clock.t - s.cutAt < BRUSH.rest) continue;
      const mine = pieces.filter((x) => x.stand === s);
      if (mine.some((x) => !x.out)) { for (const x of mine) if (!x.out) x.out = 1e-4; }
      else { s.cutAt = null; raise(s); }
    }
  }
  // a piece fading in (a fresh target) or out (into the paper) draws with its own copies of the painted materials, then hands them back
  // (a copy keeps the paint: three.js's clone() drops onBeforeCompile, so the patches are carried by hand)
  function fadeTo(x, a) {
    if (!x.fadeMats) {
      x.origMat = x.mesh.material;
      x.fadeMats = [].concat(x.origMat).map((m) => { const c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; c.userData = m.userData; c.transparent = true; c.depthWrite = false; return c; });
      x.mesh.material = Array.isArray(x.origMat) ? x.fadeMats : x.fadeMats[0];
    }
    for (const m of x.fadeMats) m.opacity = a;
    if (a >= 1 && !x.out) { x.mesh.material = x.origMat; for (const m of x.fadeMats) m.dispose(); x.fadeMats = null; }
  }
  // the framing point the follow camera looks at in the held moment: most of the way from his chest to the aim
  function frameTarget(out, me = S.me) { return out.copy(me.pos).add(new THREE.Vector3(0, 1.35, 0)).lerp(S.aim, BRUSH.cam.look); }

  return {
    BRUSH, CUTS, S, stands, pieces, events, sheet, line, lineU, materials: M, bits, clock, align, inkLine,
    get active() { return S.open; }, get timeScale() { return S.ts; }, get look() { return S.look; }, get framing() { return S.look > 0 || S.linger > 0; },
    get holdsBody() { return S.open || !!S.swing; }, get selfClock() { return S.open || !!S.swing; }, selfDt: (realDt) => (S.freeze > 0 ? 0 : realDt),
    frame, afterAnimate, sync, frameTarget, open, close, release, cutOf, aimPlane, volumeOf,
  };
}
