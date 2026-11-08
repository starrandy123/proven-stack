// The land: one height function (FastNoiseLite, MIT, Jordan Peck; the noise behind Godot's FastNoiseLite class) read by the
// terrain mesh, by Jolt's height field and by everything placed on the ground, so what you see is what you stand on.
import * as THREE from 'three';
import { RAMP, paintSurface } from './paint.js';
import FastNoiseLite from 'fastnoise-lite';

export const N = 256, SPACING = 2, HALF = (N - 1) * SPACING / 2;     // 510 m across, a sample every 2 m

export function makeLand(seed = 1337) {
  const fbm = new FastNoiseLite(seed);
  fbm.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
  fbm.SetFractalType(FastNoiseLite.FractalType.FBm);
  fbm.SetFractalOctaves(5);
  fbm.SetFrequency(0.0032);
  const ridge = new FastNoiseLite(seed + 7);
  ridge.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
  ridge.SetFractalType(FastNoiseLite.FractalType.Ridged);
  ridge.SetFractalOctaves(4);
  ridge.SetFrequency(0.006);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // places the story needs: where you wake, the shrine on its hill, the bandit camps
  const spots = {
    spawn: new THREE.Vector2(-40, 70),
    shrine: new THREE.Vector2(60, -40),
    camps: [new THREE.Vector2(-120, -60), new THREE.Vector2(120, 90), new THREE.Vector2(10, -150)],
  };
  const flats = [{ p: spots.spawn, r: 14, h: null }, { p: spots.shrine, r: 16, h: null }, ...spots.camps.map((p) => ({ p, r: 18, h: null }))];

  function raw(x, z) {
    const d = Math.hypot(x, z);
    let h = 16 * fbm.GetNoise(x, z) + 9 * Math.max(0, ridge.GetNoise(x, z) - 0.15);
    h += 70 * smooth(170, 250, d) * (0.6 + 0.4 * ridge.GetNoise(x * 0.7, z * 0.7));    // mountains ring the valley
    h -= 6 * Math.exp(-((x + 10) ** 2 + (z - 10) ** 2) / (2 * 90 * 90));                // the valley floor dips a little
    return h;
  }
  for (const f of flats) f.h = raw(f.p.x, f.p.y);
  spots.shrineLift = 9;                                                                   // the shrine stands on a raised hill
  function height(x, z) {
    let h = raw(x, z);
    for (const f of flats) {
      const d = Math.hypot(x - f.p.x, z - f.p.y);
      let target = f.h + (f === flats[1] ? spots.shrineLift : 0);
      const w = 1 - smooth(f.r, f.r * 2.4, d);
      h = h * (1 - w) + target * w;
    }
    return h;
  }

  const heights = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) heights[j * N + i] = height(-HALF + i * SPACING, -HALF + j * SPACING);

  // the height the player actually stands on: bilinear on the same samples Jolt reads
  function groundY(x, z) {
    const fx = (x + HALF) / SPACING, fz = (z + HALF) / SPACING;
    const i = Math.max(0, Math.min(N - 2, Math.floor(fx))), j = Math.max(0, Math.min(N - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
    const a = heights[j * N + i], b = heights[j * N + i + 1], c = heights[(j + 1) * N + i], d = heights[(j + 1) * N + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  function normal(x, z, out = new THREE.Vector3()) {
    const e = 1;
    return out.set(groundY(x - e, z) - groundY(x + e, z), 2 * e, groundY(x, z - e) - groundY(x, z + e)).normalize();
  }
  return { heights, height, groundY, normal, spots };
}

// The terrain mesh: the same grid Jolt collides with (Jolt maps one sample to one vertex), coloured by slope and height in a
// painter's palette: warm grass, ochre earth, cool stone.
export function terrainMesh(land) {
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3);
  const grass = new THREE.Color('#5f7a33'), dry = new THREE.Color('#a39a45'), earth = new THREE.Color('#6e5236'), stone = new THREE.Color('#77736d'), snow = new THREE.Color('#eef0f2');
  const n = new THREE.Vector3(), c = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = -HALF + i * SPACING, z = -HALF + j * SPACING, y = land.heights[k];
    pos.set([x, y, z], k * 3);
    land.normal(x, z, n);
    const slope = 1 - n.y;                                           // 0 flat … ~0.5 cliff
    c.copy(grass).lerp(dry, Math.min(1, Math.max(0, 0.5 + 0.5 * Math.sin(x * 0.013 + z * 0.009))));
    c.lerp(earth, Math.min(1, Math.max(0, (slope - 0.12) * 5)));
    c.lerp(stone, Math.min(1, Math.max(0, (slope - 0.25) * 4)));
    c.lerp(snow, Math.min(1, Math.max(0, (y - 62) / 12)));
    col.set([c.r, c.g, c.b], k * 3);
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6); let o = 0;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, c2 = a + N, d = c2 + 1;
    idx.set([a, c2, b, b, c2, d], o); o += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  // the ground, painted: three bands of light (the one ramp) and oil strokes laid on it in the world (the one atlas), never a flat digital field
  const m = new THREE.Mesh(g, paintSurface(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP }), { region: 'field_a', scale: 0.32, strength: 0.42, band: 0.3 }));
  m.name = 'painted-ground';
  m.receiveShadow = true;
  return m;
}
