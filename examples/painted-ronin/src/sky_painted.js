// THE PAINTED SKY (research H §4b): three.js's own Sky.js (MIT: Preetham's analytic daylight, which already holds Gurney's two
// gradations — lighter, warmer toward the sun; lighter at the horizon — and since r187 a 2D cloud sheet) with a painted layer laid on
// its last line, by patch, so the MIT file stays as shipped:
//  1. FOUR TONES, stepped softly: the luminance is cut into steps (Gurney: "at least four separate mixes"; Masuyama's lighter and darker
//     blue, wet-in-wet edges), the hue kept.
//  2. HORIZONTAL BRUSH STROKES: MyPaint's oil strokes from the one atlas (Yamamoto laid the sky with a flat brush), anchored to the sky's
//     own azimuth and elevation, so they stay where they were painted as the camera turns. They give the oil-paint pass something to
//     paint: over a smooth gradient the Kuwahara filter returns its input ("the flat digital blue").
//  3. THE BOKASHI: a Prussian-blue band printed across the top of the picture with an uneven edge (ichimonji-mura bokashi), then a
//     lighter band, then nothing — JAANUS: "a dark band, a light band, and a band fading into nothing"; Fletcher (1916): "printed with a
//     soft edge". It belongs to the print, so it rides the screen, and it is switched off when the sky is measured.
// Sky.js's own cloud sheet is kept as the high thin layer, its clock running in seconds at a cirrus's pace, banded with the rest.
import * as THREE from 'three';
import { PAINT_GLSL, atlasUniforms, rect, col } from './paint.js';

export function paintSky(sky, { plant = null } = {}) {
  const U = sky.material.uniforms;
  Object.assign(U, atlasUniforms(), {
    paintRect: { value: rect('field_b') }, paintMuraRect: { value: rect('field_a') }, paintRes: { value: new THREE.Vector2(1, 1) },
    paintBokashi: { value: plant === 'bokashi0' ? 0 : 1 }, paintPrussian: { value: col('prussian') },
    paintStrokes: { value: plant === 'strokes0' ? 0 : 1 }, paintTones: { value: plant === 'skyramp' ? 0 : 1 },
    paintStrokeTurn: { value: plant === 'strokes90' ? 1 : 0 },
  });
  U.cloudCoverage.value = 0.3;
  // the high sheet at a cirrus's pace: three.js's default (2e-5 a second) carried it 2.4°/s across the view 40° up (measured, wall C5);
  // cirrus 8-12 km up in a 30 m/s wind crosses ~0.2°/s overhead, less lower down. 1.2e-6 reads ~0.14°/s.
  U.cloudSpeed.value = 1.2e-6;
  let fs = sky.material.fragmentShader;
  const at = 'uniform float time;', last = 'gl_FragColor = vec4( texColor, 1.0 );';
  if (!fs.includes(at) || !fs.includes(last)) throw new Error('Sky.js changed: the painted layer has nowhere to go');
  fs = fs.replace(at, at + `
    uniform vec4 paintRect; uniform vec4 paintMuraRect; uniform vec2 paintRes; uniform float paintBokashi; uniform vec3 paintPrussian;
    uniform float paintStrokes; uniform float paintTones; uniform float paintStrokeTurn;
    ${PAINT_GLSL}`);
  fs = fs.replace(last, `
    // 1) four tones, stepped softly in log luminance, hue kept
    const vec3 pW = vec3(0.2126, 0.7152, 0.0722);
    float pL = log2(max(dot(texColor, pW), 1e-6)), pS = 2.2;
    float pQ = (floor(pL * pS) + smoothstep(0.38, 0.62, fract(pL * pS))) / pS;
    texColor *= mix(1.0, exp2(pQ - pL), paintTones);
    // 2) oil strokes laid across the sky, anchored to its azimuth and elevation: 24 tiles round (an integer, so they close behind you)
    vec2 pUv = vec2(phi, theta) * 3.8197;
    if (paintStrokeTurn > 0.5) pUv = pUv.yx;
    vec2 pGx = dFdx(pUv), pGy = dFdy(pUv);
    pGx.x -= 24.0 * floor(pGx.x / 24.0 + 0.5); pGy.x -= 24.0 * floor(pGy.x / 24.0 + 0.5);    // the seam behind you is not a gradient
    float pStroke = textureGrad(paintAtlas, paintRect.xy + fract(pUv) * paintRect.zw, pGx * paintRect.zw, pGy * paintRect.zw).r - 0.62;
    texColor *= 1.0 + pStroke * 0.085 * paintStrokes;
    // 3) the bokashi, printed across the top of the picture: a dark band with an uneven edge, a lighter band, then nothing
    vec2 pScr = gl_FragCoord.xy / paintRes;
    float pEdge = 0.9 + (paintField(vec2(pScr.x * 2.3, 0.37), paintMuraRect).r - 0.62) * 0.05 + sin(pScr.x * 7.0 + 1.3) * 0.006;
    float pDark = smoothstep(pEdge - 0.035, pEdge + 0.012, pScr.y);
    float pLight = smoothstep(pEdge - 0.17, pEdge - 0.05, pScr.y) * (1.0 - pDark);
    vec3 pBand = paintPrussian / max(dot(paintPrussian, pW), 1e-4) * dot(texColor, pW);
    texColor = mix(texColor, pBand * 0.5, pDark * 0.9 * paintBokashi);
    texColor = mix(texColor, pBand * 0.86, pLight * 0.5 * paintBokashi);
    ${last}`);
  sky.material.fragmentShader = fs; sky.material.needsUpdate = true;
  return {
    setResolution(w, h) { U.paintRes.value.set(w, h); },
    update(seconds) { U.time.value = seconds; },                       // SECONDS, as three.js's own example feeds it
  };
}
