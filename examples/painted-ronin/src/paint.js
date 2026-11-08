// THE ONE PAINTED LANGUAGE: what every painted thing in the valley shares — the sky, the clouds, the birds, the slashes, the leaves, the
// smoke, the rocks, the ground. What the shipped work that keeps one painted language has in common (research I §1, H §4):
//  · ONE BRUSH, many marks — Meier, "Painterly Rendering for Animation" (SIGGRAPH 96): "the brush itself does not impart color, just
//    texture". Ours is assets/paint/atlas.png: MyPaint's own strokes (libmypaint 1.1, ISC, ported in tools/mypaint_port.mjs) from its CC0
//    presets, baked by tools/bake_brushes.mjs. RGB = the bristles' own light and dark, A = coverage.
//  · STROKES BELONG TO THE OBJECT, never the screen (Meier's "textured glass", Disney's Deep Canvas, Dreams' splats): every sample here is
//    anchored in the world (triplanar), in a particle's own quad or on a cloud's own body; only the paper's weave sits on the screen.
//  · A FEW LIGHT VALUES from ONE SET OF COLOURS (Valve's TF2 "warp", NPAR 2007; three.js MeshToonMaterial's gradientMap; Genshin's
//    "systematic transformation"): RAMP has three bands, PALETTE sixteen swatches, and every authored colour of a painted element is one.
//  · ONE WIND (Ghost of Tsushima, Matt Vainio: "integrated this global wind direction into nearly every single effect"): WIND.
//  · THE FOG ENDS IN THE SKY (Firewatch, Jane Ng, GDC 2015: the colour "determined by the sky"): far land takes the sky's own horizon.
import * as THREE from 'three';

export const PALETTE = {                                                   // 16 swatches (sRGB)
  paper: '#f2e8d5', ink: '#1c1517', crimson: '#9e1b16', indigo: '#2e3a63',
  maple: '#b5361f', ember: '#d8732c', gold: '#e9b44c', moss: '#6e7a3c',
  mossDeep: '#3d4a2b', stone: '#8a8276', stoneShade: '#55505a', smoke: '#a49b92',
  prussian: '#24466e', skyPale: '#b9cbd6', rose: '#d7a39b', violet: '#7f7a9a',
};
export const col = (name) => { if (!(name in PALETTE)) throw new Error('not a swatch: ' + name); return new THREE.Color(PALETTE[name]); };

// the light in three bands (a shadow, a half tone, the light), read by MeshToonMaterial as its gradientMap: Nearest, never smoothed
export const RAMP_BANDS = [0.5, 0.76, 1.0];
export const RAMP = (() => {
  const t = new THREE.DataTexture(new Uint8Array(RAMP_BANDS.map((v) => Math.round(v * 255))), RAMP_BANDS.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();

// one wind: its direction on the ground (x, z) and its speed (m/s); clouds drift with it, smoke bends with it, leaves fall with it,
// the grass leans with it, the banners fly with it
export const WIND = new THREE.Vector3(1, 0, 0.36).normalize();
export const WIND_SPEED = 2.4;

export const paint = { atlas: null, regions: null, time: { value: 0 }, horizonSun: { value: new THREE.Color() }, horizonAway: { value: new THREE.Color() },
  sunXZ: { value: new THREE.Vector2(1, 0) } };

export async function loadPaint(base = 'assets/paint/') {
  const [tex, meta] = await Promise.all([new THREE.TextureLoader().loadAsync(base + 'atlas.png'), fetch(base + 'atlas.json').then((r) => r.json())]);
  tex.colorSpace = THREE.NoColorSpace;                                    // data, not colour: a value and a coverage
  tex.anisotropy = 4; tex.needsUpdate = true;
  paint.atlas = tex; paint.regions = meta.regions; paint.size = meta.size;
  return paint;
}
// a region's rectangle in the texture's own uv (three.js flips the image on upload, so y runs up): x0, y0, w, h
export function rect(name) {
  const r = paint.regions && paint.regions[name]; if (!r) throw new Error('no atlas region ' + name);
  const [x, y, w, h] = r.rect; return new THREE.Vector4(x, 1 - y - h, w, h);
}
export const atlasUniforms = () => ({ paintAtlas: { value: paint.atlas } });

// GLSL every painted shader shares
export const PAINT_GLSL = /* glsl */`
uniform sampler2D paintAtlas;
vec4 paintTile(vec2 uv, vec4 r) { return texture2D(paintAtlas, r.xy + clamp(uv, 0.002, 0.998) * r.zw); }
// a FIELD repeats without a seam: the tile's own uv wraps, and the mip comes from the unwrapped coordinate, so no seam line shows
vec4 paintField(vec2 uv, vec4 r) { return textureGrad(paintAtlas, r.xy + fract(uv) * r.zw, dFdx(uv) * r.zw, dFdy(uv) * r.zw); }
// strokes laid on a body in the world: three samples blended by the normal (three.js TSL triplanarTextures, MIT, after keijiro), each
// plane's strokes run along its first axis; 0.62 is the field's mid grey (its ground before the strokes)
float paintTriplanar(vec3 p, vec3 n, float scale, vec4 r) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  return paintField(p.zy * scale, r).r * w.x + paintField(p.xz * scale, r).r * w.y + paintField(p.xy * scale, r).r * w.z;
}`;

// the chain of shader patches one material carries (three.js has one onBeforeCompile per material): each patch is named, so a material
// is patched once and its program is keyed by every patch it carries
function addPatch(material, name, fn) {
  material.userData.paint = material.userData.paint || [];
  if (material.userData.paint.some((p) => p.name === name)) return material;
  material.userData.paint.push({ name, fn });
  material.onBeforeCompile = (shader, r) => { for (const p of material.userData.paint) p.fn(shader, r); };
  material.customProgramCacheKey = () => 'paint:' + material.userData.paint.map((p) => p.name).join('+');
  material.needsUpdate = true;
  return material;
}

// A PAINTED SURFACE: oil strokes laid on a lit body in the world (the atlas field, triplanar), the body's colour lifted and sunk by the
// bristles, and — on a toon material — the light's band edge moved by the same bristles (the cheap form of Bolt's "painterly normals":
// research I §4), so the terminator is a brush edge, never a line.
export function paintSurface(material, { region = 'field_a', scale = 0.55, strength = 0.42, band = 0.32 } = {}) {
  const U = { paintRect: { value: rect(region) }, paintScale: { value: scale }, paintStrength: { value: strength }, paintBand: { value: band } };
  material.userData.paintRegion = region;
  return addPatch(material, 'surface:' + region, (shader) => {
    Object.assign(shader.uniforms, atlasUniforms(), U);
    shader.vertexShader = 'varying vec3 vPaintPos; varying vec3 vPaintN;\n' + shader.vertexShader.replace('#include <project_vertex>', `{
      vec4 pw = vec4(transformed, 1.0); vec3 pn = objectNormal;
      #ifdef USE_INSTANCING
        pw = instanceMatrix * pw; pn = mat3(instanceMatrix) * pn;
      #endif
      vPaintPos = (modelMatrix * pw).xyz; vPaintN = normalize(mat3(modelMatrix) * pn);
    }
    #include <project_vertex>`);
    shader.fragmentShader = 'uniform vec4 paintRect; uniform float paintScale; uniform float paintStrength; uniform float paintBand;\n' +
      'varying vec3 vPaintPos; varying vec3 vPaintN; float paintBristle = 0.0;\n' + PAINT_GLSL + '\n' +
      shader.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          paintBristle = paintTriplanar(vPaintPos, normalize(vPaintN), paintScale, paintRect) - 0.62;
          diffuseColor.rgb *= 1.0 + paintBristle * paintStrength;`)
        .replace('#include <gradientmap_pars_fragment>', THREE.ShaderChunk.gradientmap_pars_fragment.replace(
          'vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );', 'vec2 coord = vec2( dotNL * 0.5 + 0.5 + paintBristle * paintBand, 0.0 );'));
  });
}

// THE FOG ENDS IN THE SKY: by distance the fog walks from its near haze to the sky's own horizon colour in the direction the pixel lies
// (toward the sun, away from it), so far ridges dissolve into the horizon band. Both horizon colours are MEASURED off the sky itself
// (measureHorizon), never picked.
export const FOG_RAMP_GLSL = /* glsl */`
  vec2 paintFd = normalize(vPaintFogDir.xz + vec2(1e-5));
  vec3 paintHorizon = mix(paintHorizonAway, paintHorizonSun, smoothstep(-0.6, 1.0, dot(paintFd, paintSunXZ)));
  vec3 paintFogC = mix(fogColor, paintHorizon, smoothstep(0.1, 0.9, fogFactor));`;
export function paintFog(material) {
  if (!material.fog) return material;
  return addPatch(material, 'fog', (shader) => {
    shader.uniforms.paintHorizonSun = paint.horizonSun; shader.uniforms.paintHorizonAway = paint.horizonAway; shader.uniforms.paintSunXZ = paint.sunXZ;
    shader.vertexShader = 'varying vec3 vPaintFogDir;\n' + shader.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
      vPaintFogDir = (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;`);
    shader.fragmentShader = 'varying vec3 vPaintFogDir; uniform vec3 paintHorizonSun; uniform vec3 paintHorizonAway; uniform vec2 paintSunXZ;\n' +
      shader.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
        #ifdef FOG_EXP2
          float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        #else
          float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
        #endif
        ${FOG_RAMP_GLSL}
        gl_FragColor.rgb = mix( gl_FragColor.rgb, paintFogC, fogFactor );
      #endif`);
  });
}
// every material in the scene that takes fog gets the painted fog (called once the valley is built, and for anything added later)
export function paintFogAll(scene) {
  scene.traverse((o) => { const m = o.material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) if (mm.fog && !(mm.userData.paint || []).some((p) => p.name === 'fog') && !mm.isShaderMaterial) paintFog(mm); });
}

// the sky's own colour a degree and a half above the horizon, toward the sun and away from it, read from a render of the sky alone
export function measureHorizon(renderer, sky, sunDir) {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  const cam = new THREE.PerspectiveCamera(2, 1, 0.1, 10000), s = new THREE.Scene(), parent = sky.parent, buf = new Uint16Array(4 * 4 * 4);
  s.add(sky);
  const read = (az, el) => {
    cam.position.set(0, 0, 0); cam.lookAt(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    renderer.setRenderTarget(rt); renderer.render(s, cam); renderer.readRenderTargetPixels(rt, 0, 0, 4, 4, buf);
    const c = [0, 0, 0]; for (let i = 0; i < 16; i++) for (let k = 0; k < 3; k++) c[k] += THREE.DataUtils.fromHalfFloat(buf[i * 4 + k]) / 16;
    return new THREE.Color(c[0], c[1], c[2]);
  };
  const az = Math.atan2(sunDir.z, sunDir.x), el = THREE.MathUtils.degToRad(1.5);
  const keep = sky.material.uniforms.paintBokashi ? sky.material.uniforms.paintBokashi.value : 0;
  if (sky.material.uniforms.paintBokashi) sky.material.uniforms.paintBokashi.value = 0;      // the print's band belongs to the screen, not the sky
  paint.horizonSun.value.copy(read(az, el)); paint.horizonAway.value.copy(read(az + Math.PI, el));
  paint.sky12 = read(az + Math.PI * 0.75, THREE.MathUtils.degToRad(14));                     // the sky beside the clouds (the clouds' own exposure)
  if (sky.material.uniforms.paintBokashi) sky.material.uniforms.paintBokashi.value = keep;
  paint.sunXZ.value.set(sunDir.x, sunDir.z).normalize();
  renderer.setRenderTarget(null); rt.dispose(); if (parent) parent.add(sky); else s.remove(sky);
  return { sun: paint.horizonSun.value.clone(), away: paint.horizonAway.value.clone() };
}

// what the paint asks a phone to hold (W5 reads it): the atlas with its mips
export const paintMemoryMB = () => (paint.atlas ? paint.size * paint.size * 4 * 1.33 / 1048576 : 0);
