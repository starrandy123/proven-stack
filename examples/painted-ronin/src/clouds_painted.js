// THE PAINTED CLOUDS — Sea of Thieves' shipped method (Ang, Catling, Cifariello Ciardi, Kozin, "The Technical Art of Sea of Thieves",
// SIGGRAPH 2018 Talks, DOI 10.1145/3214745.3214820): it "renders opaque geometry with simple per-vertex illumination that approximates
// sub-surface scattering" into a buffer at a fraction of the screen, blurs it, and composites it with "a distortion map … to give the
// clouds a fluffy appearance", far clouds cut by a threshold for a "more distinct and cartoon-like appearance". The billboard puffs the
// owner called "just meshes" are gone at the root: the blur makes one mass, the threshold gives it a designed edge, the oil pass paints it.
//  · SHAPES: drei <Cloud>'s cluster layout (MIT) — a cloud is a cluster of puffs; each puff an opaque icosphere whose surface boils by
//    three layers of 3D simplex noise along its normal (AlexStrook/UnlitClouds' Cloud_unlit_vertex_color.shader, CC0; the noise is
//    webgl-noise, MIT) and whose underside is pressed flat — a cumulus's base (Gurney, "Capturing a Cumulus").
//  · LIGHT, per vertex: Valve's half Lambert (TF2, NPAR 2007: "scale by 0.5, bias by 0.5 and square") on a normal bent toward the cloud's
//    own, darkened deep inside and at the base — the paper gives no formula for its sub-surface term, so this one is ours.
//  · THREE TONES (TF2's warp: a scalar mapped to colour): warm cream light, a rose half tone, a violet-grey shadow (Raybould: "yellow
//    lights to red half tones to violet shadows"), the band edges carried by the brush's bristles; exposed against the sky beside them
//    (Gurney: the lit side below white, the shadow side not darker than the sky in fair weather).
//  · RIM: the thin edge glows when the sun is behind the cloud and darkens a little when it is in front (Ghost of Tsushima's HG term).
//  · STROKES: the one atlas's oil strokes laid on each cloud's own body, so they travel with it (never on the screen).
//  · THE HILLS HIDE THEM: the composite writes each pixel's cloud depth.
import * as THREE from 'three';
import { PAINT_GLSL, atlasUniforms, rect, col, paint, WIND, WIND_SPEED } from './paint.js';

// THE DECK — a fair day's cumulus. The American Meteorological Society's glossary, cumulus humilis: "uniform flat bases and a general
// similarity among clouds"; fair-weather cumulus bases sit about 500-1,500 m up (the WMO cloud atlas's humilis: base 1,300 m, top
// 1,500 m). This valley's mountains stand ~100 m, so the deck's ONE flat base is 320 m up, well clear of every peak: no cloud hangs in
// the hills (the owner, 8 Nov: "one big patch of clouds too that don't make sense": the old ring put them 70-150 m up, inside the ridge),
// and a flat deck seen from below recedes in perspective, smaller and closer together toward the horizon.
export const DECK = 320, SPAN = 1000;
// THE PACE — what the eye reads is an ANGLE per second. Overhead cumulus 1,000-1,500 m up in a 5-10 m/s wind (the Beaufort scale's gentle
// breeze is 3.4-5.4 m/s at 10 m, more aloft) cross 0.2-0.6°/s, far ones far less. This deck drifts 1.4 m/s: 0.25°/s straight overhead
// from the valley floor, ~0.1°/s at 30° up (the owner, 8 Nov: "It's supposed to be going slow like a normal day!").
export const CLOUD_DRIFT = 1.4;
import { NOISE3D } from './noise3d.js';

const FAR = 2000;
const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BLUR = `uniform sampler2D buf; uniform vec2 dir; varying vec2 vUv;
void main(){ vec4 c = texture2D(buf, vUv); vec3 s = c.rgb * 0.2270270270;
  s += (texture2D(buf, vUv + dir * 1.3846153846).rgb + texture2D(buf, vUv - dir * 1.3846153846).rgb) * 0.3162162162;
  s += (texture2D(buf, vUv + dir * 3.2307692308).rgb + texture2D(buf, vUv - dir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(s, c.a); }`;                                       // painterly.js's own Gaussian; the strokes (alpha) stay sharp

// anchors: the first clouds placed where a test wants them (the walls measure two known clouds; everything else as usual)
export function createPaintedClouds(scene, { count = 16, phone = false, sunDir, plant = null, targetHeight = 280, anchors = [] } = {}) {
  const per = phone ? 7 : 10, n = count * per;
  // ── the mass: opaque boiled puffs, one instanced draw ──
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const aCenter = new Float32Array(n * 3), aCloudR = new Float32Array(n), aSeed = new Float32Array(n);
  geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(aCenter, 3)); geo.setAttribute('aCloudR', new THREE.InstancedBufferAttribute(aCloudR, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  const sun = sunDir.clone().multiplyScalar(plant === 'sunFlip' ? -1 : 1);
  const massMat = new THREE.ShaderMaterial({
    uniforms: { ...atlasUniforms(), sunDir: { value: sun }, time: paint.time, far: { value: FAR }, paintRect: { value: rect('field_b') }, rimOn: { value: plant === 'rim0' ? 0 : 1 } },
    vertexShader: `attribute vec3 aCenter; attribute float aCloudR; attribute float aSeed; uniform vec3 sunDir; uniform float time; uniform float rimOn;
      varying float vLight; varying float vDepth; varying vec3 vBody;
      ${NOISE3D}
      void main(){
        vec3 n0 = normalize(mat3(instanceMatrix) * normal);
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        float pr = length(instanceMatrix[0].xyz);
        vec3 q = wp.xyz * 0.018 + vec3(aSeed * 17.0);
        float d = snoise(q + vec3(0.0, time * 0.012, 0.0)) * 0.5 + snoise(q * 2.3 - vec3(time * 0.018)) * 0.25 + snoise(q * 5.1) * 0.12;
        wp.xyz += n0 * d * pr * 0.34;                                     // the boil (UnlitClouds' three layers)
        float floorY = aCenter.y - aCloudR * 0.32; wp.y = max(wp.y, floorY);          // a cumulus's flat base
        vec3 cn = normalize(wp.xyz - aCenter);
        vec3 N = normalize(mix(n0, cn, 0.6));
        float hl = 0.5 * dot(N, sunDir) + 0.5; hl *= hl;                // TF2's half Lambert
        float thick = clamp(length(wp.xyz - aCenter) / aCloudR, 0.0, 1.0);
        float base = smoothstep(floorY, floorY + aCloudR * 0.5, wp.y);
        vLight = hl * mix(0.62, 1.0, thick) * mix(0.62, 1.0, base);
        // the silver lining: the mass's own silhouette (UnlitClouds' fresnel rim, CC0) lights up as the eye looks into the sun, its thin
        // outer parts most (Ghost of Tsushima: forward scattering at the edges of a backlit cloud)
        vec3 V = normalize(wp.xyz - cameraPosition);
        float fres = pow(1.0 - abs(dot(normalize(mix(n0, cn, 0.8)), V)), 2.0), into = pow(max(dot(V, sunDir), 0.0), 5.0);
        vLight += (fres * into * 0.85 * (1.0 - 0.5 * thick)) * rimOn + into * 0.12;
        // light through the thin outer billows when the sun is behind (Gurney: "most of the light enters the cloud"): the rose half tone
        // shows round a violet heart instead of one flat shadow
        vLight += into * 0.3 * smoothstep(0.55, 1.0, thick) * rimOn;
        vBody = (wp.xyz - aCenter) / aCloudR;
        vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float far; uniform vec4 paintRect; varying float vLight; varying float vDepth; varying vec3 vBody;
      ${PAINT_GLSL}
      void main(){
        float s = paintTriplanar(vBody, normalize(vBody + vec3(1e-4)), 0.9, paintRect);
        gl_FragColor = vec4(vLight, 1.0, vDepth / far, max(s, 0.25));
      }`,
  });
  const mass = new THREE.InstancedMesh(geo, massMat, n); mass.frustumCulled = false;
  const massScene = new THREE.Scene(); massScene.add(mass);

  // the layout (drei <Cloud>: each cloud a handful of puffs), on THE DECK: scattered over a square 2 km on a side laid along the wind (a
  // cloud blown off its downwind edge comes round at the upwind one), each base on the one flat base, and no two closer than their own
  // breadths, so no two merge into one patch. Plants: lowclouds (the old ring inside the ridge, at the old speed), cloudclump (crowded).
  const clouds = [], across = new THREE.Vector3(-WIND.z, 0, WIND.x), breadth = (size) => size * 1.6;
  for (let c = 0; c < count; c++) {
    let center, size;
    if (anchors[c]) { center = anchors[c].clone(); size = 46; }
    else if (plant === 'lowclouds') { const a = Math.random() * Math.PI * 2, r = 180 + Math.random() * 340; size = 30 + Math.random() * 40; center = new THREE.Vector3(Math.cos(a) * r, 70 + Math.random() * 80, Math.sin(a) * r); }
    else {
      const room = plant === 'cloudclump' ? 0.12 : 1;
      for (let tries = 0; tries < 80; tries++) {
        size = 46 + Math.random() * 40;
        center = WIND.clone().multiplyScalar((Math.random() * 2 - 1) * SPAN * room).addScaledVector(across, (Math.random() * 2 - 1) * SPAN * room).setY(DECK + size * 0.32);
        if (plant === 'cloudclump' || clouds.every((o) => o.anchored || Math.hypot(o.center.x - center.x, o.center.z - center.z) >= breadth(o.size) + breadth(size))) break;
      }
    }
    const cl = { center, size, items: [], anchored: !!anchors[c] };
    for (let i = 0; i < per; i++) {
      const off = new THREE.Vector3((Math.random() - 0.5) * size * 1.5, (Math.random() - 0.25) * size * 0.42, (Math.random() - 0.5) * size * 0.7);
      if (i === 0) off.set(0, size * 0.05, 0);                                // every cloud has a big heart
      cl.items.push({ off, s: size * (i === 0 ? 0.8 : 0.42 + Math.random() * 0.4), k: c * per + i });
      aSeed[c * per + i] = Math.random();
    }
    clouds.push(cl);
  }

  // ── the buffer (a fixed height, like the oil pass) and its blur ──
  const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const bufA = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true }), bufB = rt();     // A → B → A: two colour targets and a depth
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qScene = new THREE.Scene(), qCam = new THREE.Camera(); quad.frustumCulled = false; qScene.add(quad);
  const blurMat = new THREE.ShaderMaterial({ uniforms: { buf: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: QUAD_VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false });

  // ── the composite, in the scene: the painted mass over the sky, under everything near ──
  const tones = { lit: col('paper'), half: col('rose'), shade: col('violet') };
  if (plant === 'rampGrey') { tones.lit = new THREE.Color(0.8, 0.8, 0.8); tones.half = new THREE.Color(0.55, 0.55, 0.55); tones.shade = new THREE.Color(0.35, 0.35, 0.35); }
  const exposure = { value: 1 };
  const compMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: true, depthWrite: false,
    uniforms: { ...atlasUniforms(), cloudBuf: { value: bufA.texture }, bufTexel: { value: new THREE.Vector2() }, time: paint.time, far: { value: FAR },
      litC: { value: tones.lit }, halfC: { value: tones.half }, shadeC: { value: tones.shade }, exposure, horizonC: paint.horizonAway,
      sunDir: { value: sun }, camWorldInvProj: { value: new THREE.Matrix4() }, distortRect: { value: rect('field_a') },
      rimOn: { value: plant === 'rim0' ? 0 : 1 }, bands: { value: plant === 'rampLinear' ? 0 : 1 }, edgeByDistance: { value: plant === 'edgeGlobal' ? 0 : 1 },
      debugMask: { value: 0 } },
    vertexShader: QUAD_VERT,
    fragmentShader: `uniform sampler2D cloudBuf; uniform vec2 bufTexel; uniform float time; uniform float far; uniform vec3 litC; uniform vec3 halfC;
      uniform vec3 shadeC; uniform float exposure; uniform vec3 horizonC; uniform vec3 sunDir; uniform mat4 camWorldInvProj; uniform vec4 distortRect;
      uniform float rimOn; uniform float bands; uniform float edgeByDistance; uniform float debugMask; uniform mat4 projectionMatrix; varying vec2 vUv;
      ${PAINT_GLSL}
      float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
      void main(){
        // the distortion map (Sea of Thieves): the buffer read through a slow brush field, so the edge breaks like a loaded brush
        vec2 dist = vec2(paintField(vUv * vec2(5.0, 3.0) + vec2(time * 0.004, 0.0), distortRect).r, paintField(vUv * vec2(4.0, 6.0) - vec2(0.0, time * 0.003), distortRect).r) - 0.62;
        vec4 c = texture2D(cloudBuf, vUv + dist * bufTexel * 5.0);
        float cov = c.g; if (cov < 0.04) discard;
        float light = c.r / cov, depth = c.b / cov * far, st = c.a > 0.2 ? c.a : 0.62;
        // the edge: a threshold on the blurred mass, hard far away, softer near (Sea of Thieves)
        float w = mix(0.03, 0.14, (1.0 - smoothstep(450.0, 1100.0, depth)) * edgeByDistance + 0.5 * (1.0 - edgeByDistance));
        float alpha = smoothstep(0.5 - w, 0.5 + w, cov); if (alpha < 0.01) discard;
        // three tones (TF2's warp), the band edges carried by the bristles, each step one pixel wide
        float l = light + (st - 0.62) * 0.24, fw = fwidth(l) + 0.004;
        vec3 col = mix(shadeC, halfC, smoothstep(0.30 - fw, 0.30 + fw, l));
        col = mix(col, litC, smoothstep(0.52 - fw, 0.52 + fw, l));            // a low sun behind the eye lights most of the billows
        vec3 lin = mix(shadeC, litC, clamp(l, 0.0, 1.0));
        col = mix(lin, col, bands) * exposure;
        col *= 1.0 + (st - 0.62) * 0.5 * bands;                         // the bristles shade inside each band too (one oil stroke beside another)
        // the silver lining: the thin edge glows with the sun behind the cloud, darkens a touch with the sun in front
        vec4 wd = camWorldInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 view = normalize(wd.xyz / wd.w - cameraPosition);
        float edge = 1.0 - smoothstep(0.5, 0.95, cov), back = hg(dot(view, sunDir), 0.7) / hg(1.0, 0.7);
        col *= 1.0 + edge * (back * 1.8 - 0.1) * rimOn;
        col = mix(col, horizonC, smoothstep(700.0, 1700.0, depth) * 0.5);    // the air between (the deck's far side fades into the horizon)
        gl_FragColor = vec4(col, alpha);
        if (debugMask > 0.5) { if (alpha < 0.5) discard;                    // the walls' masks: G = 7 marks a cloud pixel
          gl_FragColor = debugMask > 1.5 ? vec4(dot(col, vec3(0.2126, 0.7152, 0.0722)), 7.0, edge, 1.0) : vec4(edge, 7.0, depth / 1000.0, 1.0); }
        vec4 clip = projectionMatrix * vec4(0.0, 0.0, -depth, 1.0);
        gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
      }`,
  });
  const comp = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat); comp.frustumCulled = false; comp.renderOrder = -1; comp.name = 'painted-clouds';
  scene.add(comp);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const place = () => {
    for (const cl of clouds) for (const it of cl.items) {
      p.copy(cl.center).add(it.off); sc.setScalar(it.s); m.compose(p, q, sc); mass.setMatrixAt(it.k, m);
      aCenter.set([cl.center.x, cl.center.y, cl.center.z], it.k * 3); aCloudR[it.k] = cl.size;
    }
    mass.instanceMatrix.needsUpdate = true; geo.attributes.aCenter.needsUpdate = true; geo.attributes.aCloudR.needsUpdate = true;
  };
  place();
  let W = 0, H = 0;
  return {
    mesh: comp, mass, clouds, buffers: [bufA, bufB], tones, exposure,
    // the clouds' exposure from the sky beside them (measureHorizon's 14° reading): the shadow sits a little under that sky, the light
    // well over it and below white (Gurney: "most of the light enters the cloud"; Raybould: a shadow darker than the sky means rain)
    exposeTo(skyColour) { const y = skyColour.r * 0.2126 + skyColour.g * 0.7152 + skyColour.b * 0.0722, ys = tones.shade.r * 0.2126 + tones.shade.g * 0.7152 + tones.shade.b * 0.0722; exposure.value = 0.95 * y / ys; },
    setSize(w, h) {
      const k = Math.min(1, targetHeight / h); W = Math.max(1, Math.round(w * k)); H = Math.max(1, Math.round(h * k));
      for (const b of [bufA, bufB]) b.setSize(W, H);
      compMat.uniforms.bufTexel.value.set(1 / W, 1 / H);
    },
    update(dt) {
      const drift = (plant === 'lowclouds' ? WIND_SPEED : CLOUD_DRIFT) * dt, edge = plant === 'lowclouds' ? 520 : SPAN;
      for (const cl of clouds) {
        if (!cl.anchored) cl.center.addScaledVector(WIND, drift);
        if (cl.center.dot(WIND) > edge) cl.center.addScaledVector(WIND, -2 * edge);    // round again, upwind
      }
      place();
    },
    // drawn before the frame: the mass into the buffer with the frame's camera, then two blur passes
    render(renderer, camera) {
      if (!W) { const s = renderer.getDrawingBufferSize(new THREE.Vector2()); this.setSize(s.x, s.y); }
      compMat.uniforms.camWorldInvProj.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
      const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(bufA); renderer.clear(true, true, false); renderer.render(massScene, camera);
      quad.material = blurMat;
      blurMat.uniforms.buf.value = bufA.texture; blurMat.uniforms.dir.value.set(1.5 / W, 0); renderer.setRenderTarget(bufB); renderer.render(qScene, qCam);
      blurMat.uniforms.buf.value = bufB.texture; blurMat.uniforms.dir.value.set(0, 1.5 / H); renderer.setRenderTarget(bufA); renderer.render(qScene, qCam);
      renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevClear, prevAlpha);
    },
    memoryMB() { return W * H * 8 * 2 / 1048576 + W * H * 4 / 1048576; },
    deck: plant === 'lowclouds' ? null : DECK,
  };
}
