// The oil-paint look: the anisotropic Kuwahara filter (Kyprianidis, Kang & Döllner, 2009, with the polynomial sector weights of
// their 2010 follow-up), as Maxime Heckel wrote it for three.js in "On Crafting Painterly Shaders" (code MIT, Copyright (c) 2024
// Maxime Heckel: github.com/MaximeHeckel/blog.maximeheckel.com, core/components/MDX/Widgets/PainterlyShaders/final.ts).
// His three shaders are kept: the Sobel structure tensor, the 8-sector Kuwahara, the grade (quantised tone, saturation, ACES).
// Changed for a phone game, each change said where it is: the tensor is blurred before use (Acerola's AnisotropicKuwahara, MIT),
// the brush is sized by depth (small near the camera, wide in the distance: Acerola's depth-aware radius), the filter runs at a
// fraction of the screen's resolution, and the paper is a canvas weave made in code (his watercolour image is not ours to ship).
import * as THREE from 'three';
import { Pass } from 'postprocessing';

const VERT = `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`;

// Heckel's TensorFragmentShader, unchanged but for reading by vUv at the target's own size
const TENSOR = `varying vec2 vUv; uniform sampler2D inputBuffer; uniform vec4 resolution;
const mat3 Gx = mat3(-1, -2, -1, 0, 0, 0, 1, 2, 1); const mat3 Gy = mat3(-1, 0, 1, -2, 0, 2, -1, 0, 1);
vec4 computeStructureTensor(sampler2D t, vec2 uv) {
  vec3 tx0y0 = texture2D(t, uv + vec2(-1, -1) * resolution.zw).rgb; vec3 tx0y1 = texture2D(t, uv + vec2(-1, 0) * resolution.zw).rgb;
  vec3 tx0y2 = texture2D(t, uv + vec2(-1, 1) * resolution.zw).rgb;  vec3 tx1y0 = texture2D(t, uv + vec2(0, -1) * resolution.zw).rgb;
  vec3 tx1y1 = texture2D(t, uv).rgb;                                  vec3 tx1y2 = texture2D(t, uv + vec2(0, 1) * resolution.zw).rgb;
  vec3 tx2y0 = texture2D(t, uv + vec2(1, -1) * resolution.zw).rgb;   vec3 tx2y1 = texture2D(t, uv + vec2(1, 0) * resolution.zw).rgb;
  vec3 tx2y2 = texture2D(t, uv + vec2(1, 1) * resolution.zw).rgb;
  vec3 Sx = Gx[0][0]*tx0y0 + Gx[1][0]*tx1y0 + Gx[2][0]*tx2y0 + Gx[0][1]*tx0y1 + Gx[1][1]*tx1y1 + Gx[2][1]*tx2y1 + Gx[0][2]*tx0y2 + Gx[1][2]*tx1y2 + Gx[2][2]*tx2y2;
  vec3 Sy = Gy[0][0]*tx0y0 + Gy[1][0]*tx1y0 + Gy[2][0]*tx2y0 + Gy[0][1]*tx0y1 + Gy[1][1]*tx1y1 + Gy[2][1]*tx2y1 + Gy[0][2]*tx0y2 + Gy[1][2]*tx1y2 + Gy[2][2]*tx2y2;
  return vec4(dot(Sx, Sx), dot(Sy, Sy), dot(Sx, Sy), 1.0);
}
void main() { gl_FragColor = computeStructureTensor(inputBuffer, vUv); }`;

// Acerola's tensor smoothing: a separable Gaussian over the tensor (sigma 2), so stroke directions flow instead of flickering
const BLUR = `varying vec2 vUv; uniform sampler2D inputBuffer; uniform vec2 dir;
void main() { vec4 s = texture2D(inputBuffer, vUv) * 0.2270270270;
  s += (texture2D(inputBuffer, vUv + dir * 1.3846153846) + texture2D(inputBuffer, vUv - dir * 1.3846153846)) * 0.3162162162;
  s += (texture2D(inputBuffer, vUv + dir * 3.2307692308) + texture2D(inputBuffer, vUv - dir * 3.2307692308)) * 0.0702702703;
  gl_FragColor = s; }`;

// Heckel's KuwaharaFragmentShader; the radius is per pixel (from depth) and the colour stays linear for the grade that follows
const KUWAHARA = `#define SECTOR_COUNT 8
uniform sampler2D tensorBuffer; uniform sampler2D originalTexture; uniform sampler2D depthBuffer; uniform vec4 resolution;
uniform float radiusNear; uniform float radiusFar; uniform float cameraNear; uniform float cameraFar; uniform float useDepth;
varying vec2 vUv;
vec3 sampleColor(vec2 offset) { return texture2D(originalTexture, vUv + offset * resolution.zw).rgb; }
vec4 getDominantOrientation(vec4 st) {
  float Jxx = st.r, Jyy = st.g, Jxy = st.b; float trace = Jxx + Jyy, det = Jxx * Jyy - Jxy * Jxy;
  float root = sqrt(max(0.0, trace * trace * 0.25 - det)); float l1 = trace * 0.5 + root, l2 = trace * 0.5 - root;
  float jxyStrength = abs(Jxy) / (abs(Jxx) + abs(Jyy) + abs(Jxy) + 1e-6);
  vec2 v = jxyStrength > 0.0 ? normalize(vec2(-Jxy, Jxx - l1) + 1e-9) : vec2(0.0, 1.0);
  return vec4(normalize(v), l1, l2);
}
float polynomialWeight(float x, float y, float eta, float lambda) { float p = (x + eta) - lambda * (y * y); return max(0.0, p * p); }
void sector(mat2 A, float angle, float radius, out vec3 avg, out float variance) {
  vec3 s = vec3(0.0), s2 = vec3(0.0); float tw = 0.0;
  for (float r = 1.0; r <= 8.0; r += 1.0) {
    if (r > radius) break;
    for (float a = -0.392699; a <= 0.392699; a += 0.196349) {
      vec2 o = r * vec2(cos(angle + a), sin(angle + a)); o *= A;
      vec3 c = sampleColor(o); float w = polynomialWeight(o.x, o.y, 0.1, 0.5);
      s += c * w; s2 += c * c * w; tw += w;
    }
  }
  avg = s / max(tw, 1e-6); vec3 v = s2 / max(tw, 1e-6) - avg * avg; variance = dot(v, vec3(0.299, 0.587, 0.114));
}
float linearDepth(float d) { float z = d * 2.0 - 1.0; return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear)); }
void main() {
  vec4 o = getDominantOrientation(texture2D(tensorBuffer, vUv));
  float anis = (o.z - o.w) / (o.z + o.w + 1e-6); float alpha = 25.0;
  mat2 A = mat2(o.x, -o.y, o.y, o.x) * mat2(alpha / (anis + alpha), 0.0, 0.0, (anis + alpha) / alpha);
  float radius = radiusFar;
  if (useDepth > 0.5) radius = mix(radiusNear, radiusFar, smoothstep(4.0, 45.0, linearDepth(texture2D(depthBuffer, vUv).r)));
  vec3 best = texture2D(originalTexture, vUv).rgb; float bestVar = 1e9;
  for (int i = 0; i < SECTOR_COUNT; i++) {
    vec3 c; float v; sector(A, float(i) * 6.28318 / float(SECTOR_COUNT), radius, c, v);
    if (v < bestVar) { bestVar = v; best = c; }
  }
  gl_FragColor = vec4(best, 1.0);
}`;

// Heckel's FinalFragmentShader (quantised tone toward dark and light, saturation, ACES) with our canvas weave for the paper,
// tuned gentler for a lit 3D world (his quantisation of 16 steps and saturation 1.5 were tuned for a single object on white)
const FINAL = `uniform sampler2D inputBuffer; uniform vec4 resolution; uniform float time; uniform float strength; varying vec2 vUv;
vec3 ACESFilm(vec3 x) { float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
vec3 sat(vec3 rgb, float k) { vec3 i = vec3(dot(rgb, vec3(0.2125, 0.7154, 0.0721))); return mix(i, rgb, k); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float canvas(vec2 px) {               // a linen weave: two crossing threads, uneven, plus a slow blotch like dried paint
  float warp = 0.5 + 0.5 * sin(px.x * 1.9 + noise(px * 0.15) * 3.0), weft = 0.5 + 0.5 * sin(px.y * 1.9 + noise(px.yx * 0.15) * 3.0);
  float weave = mix(warp, weft, step(0.5, fract((floor(px.x / 3.3) + floor(px.y / 3.3)) * 0.5)));
  return 0.93 + 0.05 * weave + 0.04 * (noise(px * 0.02) - 0.5);
}
void main() {
  vec3 color = texture2D(inputBuffer, vUv).rgb;
  float g = dot(color, vec3(0.299, 0.587, 0.114));
  float n = 10.0; float qn = clamp(floor(g * (n - 1.0) + 0.5) / (n - 1.0), 0.15, 0.85);
  vec3 q = qn < 0.5 ? mix(vec3(0.08, 0.07, 0.09), color, qn * 2.0) : mix(color, vec3(1.0, 0.97, 0.9), (qn - 0.5) * 2.0);
  color = mix(color, q, 0.35 * strength);
  color = sat(color, mix(1.0, 1.25, strength));
  color = ACESFilm(color * 1.22);
  color *= mix(1.0, canvas(gl_FragCoord.xy), strength);
  float vig = smoothstep(1.25, 0.45, length(vUv - 0.5) * 1.45); color *= mix(0.82, 1.0, vig);
  gl_FragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);
}`;

export class PainterlyPass extends Pass {
  // scale: the filter's resolution against the screen (0.5 on a phone); radiusNear/radiusFar: the brush in texels near and far
  constructor(camera, { scale = 0.6, radiusNear = 2, radiusFar = 6, strength = 1 } = {}) {
    super('PainterlyPass');
    this.needsDepthTexture = true;
    this.cameraRef = camera; this.scale = scale; this.strength = strength;
    const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.tensorRT = rt(); this.blurRT = rt(); this.paintRT = rt();
    this.tensorMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: TENSOR, uniforms: { inputBuffer: { value: null }, resolution: { value: new THREE.Vector4() } }, depthTest: false, depthWrite: false });
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BLUR, uniforms: { inputBuffer: { value: null }, dir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    this.kuwaharaMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: KUWAHARA, depthTest: false, depthWrite: false, uniforms: {
      tensorBuffer: { value: null }, originalTexture: { value: null }, depthBuffer: { value: null }, resolution: { value: new THREE.Vector4() },
      radiusNear: { value: radiusNear }, radiusFar: { value: radiusFar }, cameraNear: { value: 0.1 }, cameraFar: { value: 1000 }, useDepth: { value: 0 } } });
    this.finalMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FINAL, depthTest: false, depthWrite: false,
      uniforms: { inputBuffer: { value: null }, resolution: { value: new THREE.Vector4() }, time: { value: 0 }, strength: { value: strength } } });
    this.fullscreenMaterial = this.finalMat;
  }
  setDepthTexture(depthTexture) { this.kuwaharaMat.uniforms.depthBuffer.value = depthTexture; this.kuwaharaMat.uniforms.useDepth.value = depthTexture ? 1 : 0; }
  setSize(width, height) {
    const w = Math.max(1, Math.round(width * this.scale)), h = Math.max(1, Math.round(height * this.scale));
    for (const t of [this.tensorRT, this.blurRT, this.paintRT]) t.setSize(w, h);
    this.tensorMat.uniforms.resolution.value.set(width, height, 1 / width, 1 / height);
    this.kuwaharaMat.uniforms.resolution.value.set(w, h, 1 / w, 1 / h);
    this.w = w; this.h = h;
  }
  draw(renderer, material, target) { this.fullscreenMaterial = material; renderer.setRenderTarget(target); renderer.render(this.scene, this.camera); }
  render(renderer, inputBuffer, outputBuffer) {
    if (!this.w) this.setSize(inputBuffer.width, inputBuffer.height);
    this.tensorMat.uniforms.inputBuffer.value = inputBuffer.texture;
    this.draw(renderer, this.tensorMat, this.tensorRT);
    this.blurMat.uniforms.inputBuffer.value = this.tensorRT.texture; this.blurMat.uniforms.dir.value.set(1 / this.w, 0);
    this.draw(renderer, this.blurMat, this.blurRT);
    this.blurMat.uniforms.inputBuffer.value = this.blurRT.texture; this.blurMat.uniforms.dir.value.set(0, 1 / this.h);
    this.draw(renderer, this.blurMat, this.tensorRT);
    const k = this.kuwaharaMat.uniforms;
    k.tensorBuffer.value = this.tensorRT.texture; k.originalTexture.value = inputBuffer.texture;
    k.cameraNear.value = this.cameraRef.near; k.cameraFar.value = this.cameraRef.far;
    this.draw(renderer, this.kuwaharaMat, this.paintRT);
    this.finalMat.uniforms.inputBuffer.value = this.paintRT.texture; this.finalMat.uniforms.strength.value = this.strength;
    this.draw(renderer, this.finalMat, this.renderToScreen ? null : outputBuffer);
  }
  dispose() { for (const t of [this.tensorRT, this.blurRT, this.paintRT]) t.dispose(); for (const m of [this.tensorMat, this.blurMat, this.kuwaharaMat, this.finalMat]) m.dispose(); super.dispose(); }
}
