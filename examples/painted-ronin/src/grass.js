// Fields of grass that bend in the wind, the way Ghost of Tsushima's GDC 2021 talk ("Procedural Grass in 'Ghost of Tsushima'",
// Eric Wohllaib) describes it, as SimonDev built it for three.js in Quick_Grass (MIT, github.com/simondevyoutube/Quick_Grass,
// src/base/render/grass-component.js and public/shaders/grass-lighting-model-vsh.glsl). Kept from his code: patches of instanced
// blades around the camera with a near LOD (6 segments) and a far LOD (1), every blade's shape from a hash of its position, the
// lean, the wind (two noise fields: direction and strength), the push away from the player, the view-space thickening. Changed:
// the ground is our height field (read with texelFetch, so no float filtering is needed on a phone), a density channel keeps grass
// off cliffs, paths and camps, the colours are a painter's dry susuki field, and the lighting is a short Lambert + translucency.
import * as THREE from 'three';
import { FOG_RAMP_GLSL, paint, WIND } from './paint.js';

const PATCH = 10, SEG_HIGH = 6, SEG_LOW = 1;

function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function bladeGeometry(segments, count) {                              // SimonDev's #CreateGeometry_
  const VERTS = (segments + 1) * 2, idx = [];
  for (let i = 0; i < segments; i++) {
    const vi = i * 2; idx.push(vi, vi + 1, vi + 2, vi + 2, vi + 1, vi + 3);
    const fi = VERTS + vi; idx.push(fi + 2, fi + 1, fi, fi + 3, fi + 1, fi + 2);
  }
  const r = rand(7 + segments), offsets = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { offsets[i * 3] = (r() - 0.5) * PATCH; offsets[i * 3 + 1] = (r() - 0.5) * PATCH; offsets[i * 3 + 2] = 0; }
  const vert = new Float32Array(VERTS * 2); for (let i = 0; i < VERTS * 2; i++) vert[i] = i;
  const g = new THREE.InstancedBufferGeometry();
  g.instanceCount = count;
  g.setAttribute('vertIndex', new THREE.BufferAttribute(vert, 1));
  g.setAttribute('position', new THREE.InstancedBufferAttribute(offsets, 3));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1 + PATCH * 2);
  return g;
}

const VERT = `
precision highp float;
uniform vec2 grassSize; uniform vec4 grassParams; uniform vec4 grassDraw; uniform float time; uniform float windAngle; varying vec3 vPaintFogDir;
uniform highp sampler2D heightmap; uniform vec4 heightParams; uniform vec3 playerPos; uniform vec3 sunDir;
attribute float vertIndex;
varying vec3 vColour; varying float vHeight; varying vec3 vNormal; varying float vFog; varying float vSun;
#define PI 3.14159265
float saturate1(float x) { return clamp(x, 0.0, 1.0); }
float remap(float v, float a, float b, float c, float d) { return c + (v - a) * (d - c) / (b - a); }
float easeOut(float x, float t) { return 1.0 - pow(1.0 - x, t); }
float easeIn(float x, float t) { return pow(x, t); }
vec4 hash42(vec2 p) { vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise12(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y) * 2.0 - 1.0; }
mat3 rotateX(float t) { float c = cos(t), s = sin(t); return mat3(1, 0, 0, 0, c, -s, 0, s, c); }
mat3 rotateY(float t) { float c = cos(t), s = sin(t); return mat3(c, 0, s, 0, 1, 0, -s, 0, c); }
mat3 rotateAxis(vec3 a, float t) { a = normalize(a); float s = sin(t), c = cos(t), oc = 1.0 - c;
  return mat3(oc*a.x*a.x + c, oc*a.x*a.y - a.z*s, oc*a.z*a.x + a.y*s, oc*a.x*a.y + a.z*s, oc*a.y*a.y + c, oc*a.y*a.z - a.x*s, oc*a.z*a.x - a.y*s, oc*a.y*a.z + a.x*s, oc*a.z*a.z + c); }
vec2 ground(vec2 xz) {                                                   // height and density, bilinear by hand (texelFetch)
  float n = heightParams.y, sp = heightParams.z, half1 = heightParams.x * 0.5;
  vec2 f = (xz + half1) / sp; vec2 i0 = clamp(floor(f), vec2(0.0), vec2(n - 2.0)); vec2 t = clamp(f - i0, 0.0, 1.0);
  ivec2 c = ivec2(i0);
  vec2 a = texelFetch(heightmap, c, 0).rg, b = texelFetch(heightmap, c + ivec2(1, 0), 0).rg;
  vec2 d = texelFetch(heightmap, c + ivec2(0, 1), 0).rg, e = texelFetch(heightmap, c + ivec2(1, 1), 0).rg;
  return mix(mix(a, b, t.x), mix(d, e, t.x), t.y);
}
void main() {
  vec3 grassOffset = vec3(position.x, 0.0, position.y);
  vec3 bladePos = (modelMatrix * vec4(grassOffset, 1.0)).xyz;
  vec2 g = ground(bladePos.xz);
  bladePos.y = g.x;
  vec4 h1 = hash42(bladePos.xz);
  float dist = distance(cameraPosition, bladePos);
  float highLODOut = smoothstep(grassDraw.x * 0.5, grassDraw.x, dist);
  float lodFadeIn = smoothstep(grassDraw.x, grassDraw.y, dist);
  float allowed = step(h1.w, g.y);                                       // density from the map: none on cliffs, paths, camps
  float randomAngle = h1.x * 2.0 * PI;
  float randomShade = remap(h1.y, 0.0, 1.0, 0.75, 1.0);
  float clump = noise12(bladePos.xz * 0.09) * 0.5 + 0.5;                  // Tsushima's clumps, cheaply: taller where a low noise is high
  float randomHeight = remap(h1.z, 0.0, 1.0, 0.7, 1.3) * mix(0.75, 1.25, clump) * (1.0 - lodFadeIn) * allowed;
  float randomLean = remap(h1.w, 0.0, 1.0, 0.1, 0.4);
  vec2 hc = hash22(bladePos.xz);
  float leanAnimation = noise12(vec2(time * 0.35) + bladePos.xz * 137.423) * 0.1;
  float SEG = grassParams.x, VERTS = grassParams.y;
  float vertID = mod(vertIndex, VERTS);
  float zSide = -(floor(vertIndex / VERTS) * 2.0 - 1.0);
  float xSide = mod(vertID, 2.0);
  float hp = (vertID - xSide) / (SEG * 2.0);
  float totalH = grassSize.y * randomHeight;
  float widthHigh = easeOut(1.0 - hp, 2.0), widthLow = 1.0 - hp;
  float totalW = grassSize.x * mix(widthHigh, widthLow, highLODOut) * allowed;
  float x = (xSide - 0.5) * totalW, y = hp * totalH;
  float windDir = windAngle + noise12(bladePos.xz * 0.05 + 0.05 * time) * 0.35;      // the one wind (paint.js WIND), gusting ±20°
  float windNoise = noise12(bladePos.xz * 0.25 + time * 1.0);
  float windLean = easeIn(remap(windNoise, -1.0, 1.0, 0.25, 1.0), 2.0) * 1.25 * hp;
  vec3 windAxis = vec3(cos(windDir), 0.0, sin(windDir));
  float dp = distance(bladePos.xz, playerPos.xz);
  float playerLean = mix(0.0, 0.6, smoothstep(1.6, 0.4, dp));
  vec3 toPlayer = normalize(vec3(playerPos.x - bladePos.x, 0.0, playerPos.z - bladePos.z) + 1e-5);
  vec3 playerAxis = vec3(toPlayer.z, 0.0, -toPlayer.x);
  randomLean += leanAnimation;
  float easedH = mix(easeIn(hp, 2.0), 1.0, highLODOut);
  float curve = -randomLean * easedH;
  mat3 M = rotateAxis(playerAxis, playerLean) * rotateAxis(windAxis, windLean) * rotateY(randomAngle);
  vec3 faceN = M * vec3(0.0, 0.0, 1.0) * zSide;
  vec3 p = rotateX(curve) * vec3(x, y, 0.0);
  p = M * p + grassOffset;
  p.y += bladePos.y;
  vec3 world = vec3(bladePos.x, 0.0, bladePos.z) + (p - grassOffset);   // the root on the ground, the blade bent above it
  vec3 base = mix(vec3(0.20, 0.24, 0.07), vec3(0.27, 0.27, 0.08), hc.x);           // olive roots
  vec3 tip = mix(vec3(0.86, 0.72, 0.34), vec3(0.95, 0.83, 0.47), hc.y);           // dry susuki gold at the tips
  tip = mix(tip, vec3(0.55, 0.62, 0.22), smoothstep(0.35, 0.65, noise12(bladePos.xz * 0.02) * 0.5 + 0.5)); // greener swathes
  vColour = mix(base, tip, easeIn(hp, 1.6)) * randomShade;
  vHeight = hp;
  vNormal = normalize(mix(vec3(0.0, 1.0, 0.0), faceN, 0.35));
  vSun = max(0.0, dot(normalize(sunDir), vNormal));
  vec4 mv = viewMatrix * vec4(world, 1.0);
  vec3 viewDir = normalize(cameraPosition - bladePos);
  float vdn = saturate1(dot(faceN, normalize(vec3(viewDir.x, 0.0, viewDir.z))));
  mv.x += easeOut(1.0 - vdn, 4.0) * smoothstep(0.0, 0.2, vdn) * (xSide - 0.5) * totalW * 0.5 * zSide;
  gl_Position = projectionMatrix * mv;
  vFog = -mv.z; vPaintFogDir = world - cameraPosition;
}`;

const FRAG = `
precision highp float;
uniform vec3 sunColour; uniform vec3 skyColour; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
uniform vec3 paintHorizonSun; uniform vec3 paintHorizonAway; uniform vec2 paintSunXZ; varying vec3 vPaintFogDir;
varying vec3 vColour; varying float vHeight; varying vec3 vNormal; varying float vFog; varying float vSun;
void main() {
  float ao = mix(0.35, 1.0, smoothstep(0.0, 0.7, vHeight));                       // dark at the roots
  vec3 c = vColour * (skyColour * 0.55 + sunColour * (0.35 + 0.65 * vSun)) * ao;
  c += vColour * sunColour * 0.25 * vHeight * vHeight;                            // light through the tips
  float fogFactor = smoothstep(fogNear, fogFar, vFog);
  ${FOG_RAMP_GLSL}
  gl_FragColor = vec4(mix(c, paintFogC, fogFactor), 1.0);                        // the fog ends in the sky's horizon (paint.js)
}`;

export function createGrass(scene, land, N, SPACING, { phone = false, sunDir, fog } = {}) {
  // the ground map: R = height, G = grass density (0 on steep slopes, at camps, shrine and spawn, on paths)
  const data = new Float32Array(N * N * 2), half = (N - 1) * SPACING / 2, n = new THREE.Vector3();
  const clear = [land.spots.spawn, land.spots.shrine, ...land.spots.camps].map((p, i) => ({ p, r: i === 0 ? 5 : 14 }));
  if (land.spots.tameshi) clear.push({ p: land.spots.tameshi, r: 5.5 });   // 筆 the brush's cutting ground (blade.js): a yard, its targets seen whole
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -half + i * SPACING, z = -half + j * SPACING, k = j * N + i;
    land.normal(x, z, n);
    let d = THREE.MathUtils.smoothstep(n.y, 0.86, 0.95) * (1 - THREE.MathUtils.smoothstep(land.heights[k], 40, 70));
    for (const c of clear) d *= THREE.MathUtils.smoothstep(Math.hypot(x - c.p.x, z - c.p.y), c.r, c.r * 1.6);
    if (land.pathDist) d *= THREE.MathUtils.smoothstep(land.pathDist(x, z), 1.2, 2.6);
    data[k * 2] = land.heights[k]; data[k * 2 + 1] = d * 0.92;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;

  const COUNT = phone ? 1400 : 3072, LOD = phone ? 11 : 15, MAX = phone ? 55 : 100;
  const uniforms = (seg) => ({
    grassSize: { value: new THREE.Vector2(0.075, 1.15) }, grassParams: { value: new THREE.Vector4(seg, (seg + 1) * 2, 0, 0) },
    grassDraw: { value: new THREE.Vector4(LOD, MAX, 0, 0) }, time: { value: 0 }, heightmap: { value: tex },
    heightParams: { value: new THREE.Vector4((N - 1) * SPACING, N, SPACING, 0) }, playerPos: { value: new THREE.Vector3() },
    sunDir: { value: sunDir.clone() }, sunColour: { value: new THREE.Color('#ffdcae') }, skyColour: { value: new THREE.Color('#9fb6d6') },
    windAngle: { value: Math.atan2(WIND.x, -WIND.z) },                 // a blade leans toward (sin φ, 0, −cos φ): rotateAxis turns by −t
    paintHorizonSun: paint.horizonSun, paintHorizonAway: paint.horizonAway, paintSunXZ: paint.sunXZ,
    fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far },
  });
  const matHigh = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms(SEG_HIGH) });
  const matLow = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms(SEG_LOW) });
  const geoHigh = bladeGeometry(SEG_HIGH, COUNT), geoLow = bladeGeometry(SEG_LOW, COUNT);
  const group = new THREE.Group(); group.name = 'grass'; scene.add(group);
  const pool = { high: [], low: [] };
  const take = (kind, i) => { const list = pool[kind]; if (!list[i]) { const m = new THREE.Mesh(kind === 'high' ? geoHigh : geoLow, kind === 'high' ? matHigh : matLow); m.frustumCulled = false; list[i] = m; group.add(m); } return list[i]; };
  const frustum = new THREE.Frustum(), M = new THREE.Matrix4(), box = new THREE.Box3(), c = new THREE.Vector3();
  let t = 0;
  return {
    update(dt, camera, playerPos) {
      t += dt;
      for (const m of [matHigh, matLow]) { m.uniforms.time.value = t; m.uniforms.playerPos.value.copy(playerPos); }
      frustum.setFromProjectionMatrix(M.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const cx = Math.floor(camera.position.x / PATCH), cz = Math.floor(camera.position.z / PATCH), R = Math.ceil(MAX / PATCH);
      let nh = 0, nl = 0;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const px = (cx + dx) * PATCH + PATCH / 2, pz = (cz + dz) * PATCH + PATCH / 2;
        if (Math.abs(px) > half - 2 || Math.abs(pz) > half - 2) continue;
        const gy = land.groundY(px, pz);
        c.set(px, gy, pz);
        const d = Math.hypot(px - camera.position.x, pz - camera.position.z);
        if (d > MAX + PATCH) continue;
        box.setFromCenterAndSize(c, new THREE.Vector3(PATCH, 8, PATCH));
        if (!frustum.intersectsBox(box)) continue;
        const m = d < LOD ? take('high', nh++) : take('low', nl++);
        m.position.set(px, 0, pz); m.visible = true;
      }
      for (let i = nh; i < pool.high.length; i++) pool.high[i].visible = false;
      for (let i = nl; i < pool.low.length; i++) pool.low[i].visible = false;
      this.blades = (nh + nl) * COUNT;
    },
    blades: 0,
  };
}
