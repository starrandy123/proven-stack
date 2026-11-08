#!/usr/bin/env node
// Bakes Painted Ronin's ONE brush atlas (assets/paint/atlas.png): every painted thing in the game — sky, clouds, birds, slashes, leaves,
// smoke, rocks, ground — samples these strokes, the way Meier's "Painterly Rendering for Animation" (SIGGRAPH 96) gives every particle one
// monochrome brush that "does not impart color, just texture".
//
// The strokes are painted by MyPaint's brush engine (libmypaint 1.1, ISC; ported to JavaScript in mypaint_port.mjs) from MyPaint's own
// presets (mypaint/mypaint-brushes, brushes/* — CC0-1.0: the MyPaint team, Marcelo "Tanda" Cerviño, Ramón Miranda). The engine places
// the dabs as MyPaint does (spacing, pressure, speed, jitter, smudge, elliptical dabs) and paints them with libmypaint's own dab mask.
//
// Each region is painted twice: COVERAGE (white on transparent: the alpha) and VALUE (a dry brush dragged over a mid grey: the bristle
// streaks in RGB) — Dreams' "two layers" (Alex Evans, SIGGRAPH 2015). A FIELD is a tile meant to repeat over big surfaces (ground, rocks,
// sky): all paint, strokes of differing value over a grey ground, every dab wrapped across the tile's edges so it tiles without a seam.
// Deterministic: the same presets and seed bake the same bytes.
//   node examples/painted-ronin/tools/bake_brushes.mjs [--mypaint <folder holding brushes/*.myb and brushsettings_60369db.json>]
// The folder holds the presets as MyPaint ships them (.downloads/mypaint/, gitignored) and libmypaint 1.1's own brushsettings.json (the
// names and defaults of its 45 settings). A preset setting libmypaint 1.1 does not know is refused, never guessed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MyPaintBrush, Surface, mulberry32 } from './mypaint_port.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const MP = path.resolve(opt('mypaint', path.join(ROOT, '.downloads/mypaint')));
const OUT = path.resolve(HERE, '../assets/paint');
const S = 1024, T = 256;

// long strokes take a whole row (u runs from the loaded start to the dry tail, v across the stroke); the rest are 256² tiles, index row*4+col
export const REGIONS = [
  { name: 'stroke_cut', rect: [0, 0, S, T], brush: 'classic_dry_brush', scale: 3.4, path: 'long', passes: 22, spread: 0.5, value: { brush: 'tanda_oil-06-paint', radius: 6, across: 64, n: 9 } },
  { name: 'stroke_ink', rect: [0, T, S, T], brush: 'classic_kabura', radius: 44, path: 'long', passes: 3, spread: 0.13, value: { brush: 'tanda_oil-06-paint', radius: 8, across: 72, n: 9 } },
  { name: 'dab_oil', tile: 8, brush: 'tanda_oil-03-paint', radius: 34, path: 'dab', value: { brush: 'tanda_oil-06-paint', radius: 7, across: 34, n: 5 } },
  { name: 'leaf', tile: 9, brush: 'tanda_oil-03-paint', radius: 20, path: 'leaf', value: { brush: 'tanda_oil-06-paint', radius: 5, across: 18, n: 5 } },
  { name: 'puff_a', tile: 10, brush: 'tanda_oil-03-paint', radius: 22, path: 'puff', value: { brush: 'tanda_oil-06-paint', radius: 7, across: 26, n: 5 } },
  { name: 'puff_b', tile: 11, brush: 'tanda_oil-01-paint', radius: 26, path: 'puff', value: { brush: 'tanda_oil-06-paint', radius: 7, across: 30, n: 5 } },
  { name: 'wing', tile: 12, brush: 'classic_pointy_ink', scale: 0.42, path: 'wing', value: { brush: 'tanda_oil-06-paint', radius: 3, across: 8, n: 3 } },
  { name: 'field_a', tile: 13, brush: 'tanda_oil-01-paint', radius: 9, path: 'field', wrap: true },
  { name: 'field_b', tile: 14, brush: 'tanda_oil-06-paint', radius: 7, path: 'field', wrap: true },
  { name: 'flecks', tile: 15, brush: 'classic_textured_ink', radius: 5, path: 'flecks', value: null },
];
for (const r of REGIONS) if (r.tile !== undefined) r.rect = [(r.tile % 4) * T, Math.floor(r.tile / 4) * T, T, T];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const known = JSON.parse(fs.readFileSync(path.join(MP, 'brushsettings_60369db.json'), 'utf8'));
  const presets = {};
  for (const r of REGIONS) for (const b of [r.brush, r.value && r.value.brush]) if (b && !presets[b]) presets[b] = JSON.parse(fs.readFileSync(path.join(MP, 'brushes', b + '.myb'), 'utf8'));
  const rnd = mulberry32(1337);
  const cov = new Surface(S, S), val = new Surface(S, S);
  // a size is an absolute base radius, or a SCALE of the preset's own — MyPaint's size slider: the base moves by ln(scale) and the
  // preset's pressure and speed curves ride on it (a base forced to ln(22) under pointy_ink's +3.36 pressure curve painted a 630 px disc)
  const brushOf = (name, surface, size, grey) => {
    const b = new MyPaintBrush(presets[name], known, mulberry32(Math.floor(rnd() * 2 ** 31)));
    b.setBase('radius_logarithmic', size.scale ? b.base('radius_logarithmic') + Math.log(size.scale) : Math.log(size.radius));
    b.setColor(grey, grey, grey); b.surface = surface; return b;
  };
  const sized = (r, k = 1) => (r.scale ? { scale: r.scale * k } : { radius: r.radius * k });
  // a stroke as a tablet hands it over: the path, its pressure and its clock (a point every 2.5 px, 6 ms apart), lifted at the end
  const paint = (b, pts) => {
    b.newStroke(); b.strokeTo(b.surface, pts[0][0], pts[0][1], 0, 10);
    for (const [x, y, p] of pts) b.strokeTo(b.surface, x, y, p, 0.006);
    const [xe, ye] = pts[pts.length - 1]; b.strokeTo(b.surface, xe, ye, 0, 0.2);
  };
  const line = (x0, y0, x1, y1, p0, p1, bend = 0, step = 2.5) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)), pts = [];
    for (let k = 0; k <= n; k++) { const t = k / n; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + bend * Math.sin(Math.PI * t), p0 + (p1 - p0) * t]); }
    return pts;
  };
  const paths = {
    long: (rx, ry, w, h, r) => Array.from({ length: r.passes }, (_, k) => {
      const y = ry + h / 2 + (k / Math.max(1, r.passes - 1) - 0.5) * h * r.spread + (rnd() - 0.5) * 6;
      return line(rx + w * 0.04, y, rx + w * (0.9 + 0.06 * rnd()), y + (rnd() - 0.5) * 10, 0.95, 0.12, (rnd() - 0.5) * 16);
    }),
    dab: (rx, ry, w, h) => [line(rx + w * 0.22, ry + h * 0.56, rx + w * 0.78, ry + h * 0.44, 0.9, 0.55, -8), line(rx + w * 0.3, ry + h * 0.62, rx + w * 0.7, ry + h * 0.55, 0.7, 0.4, 6)],
    leaf: (rx, ry, w, h) => [line(rx + w * 0.5, ry + h * 0.84, rx + w * 0.52, ry + h * 0.16, 0.95, 0.25, 14), line(rx + w * 0.44, ry + h * 0.72, rx + w * 0.56, ry + h * 0.34, 0.8, 0.3, -12)],
    puff: (rx, ry, w, h) => [0, 1, 2, 3].map((k) => {
      const cx = rx + w * (0.5 + 0.12 * Math.cos(k * 1.9)), cy = ry + h * (0.52 + 0.1 * Math.sin(k * 2.3)), R = w * (0.2 + 0.05 * k), pts = [];
      for (let a = 0; a <= Math.PI * 2.2; a += 0.08) pts.push([cx + Math.cos(a + k) * R * (1 - a / 9), cy + Math.sin(a + k) * R * 0.8 * (1 - a / 9), 0.75]);
      return pts;
    }),
    // a wing, the way a sumi-e painter lays one: full pressure through its middle, a quick lift to a dry tip (a feather, not a comma)
    wing: (rx, ry, w, h) => [line(rx + w * 0.06, ry + h * 0.5, rx + w * 0.95, ry + h * 0.47, 1, 1, -h * 0.08, 2).map(([x, y], i, a) => {
      const t = i / (a.length - 1); return [x, y, t < 0.3 ? 0.86 + 0.14 * t / 0.3 : t < 0.8 ? 1 - 0.22 * (t - 0.3) / 0.5 : 0.78 - 0.62 * (t - 0.8) / 0.2]; })],
    field: (rx, ry, w, h) => Array.from({ length: 70 }, () => {
      const x = rx + rnd() * w, y = ry + rnd() * h, L = w * (0.18 + 0.3 * rnd()), a = (rnd() - 0.5) * 0.4;
      return line(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.85, 0.35, (rnd() - 0.5) * 8);
    }),
    flecks: (rx, ry, w, h) => Array.from({ length: 34 }, () => { const x = rx + w * (0.1 + 0.8 * rnd()), y = ry + h * (0.1 + 0.8 * rnd()); return line(x, y, x + 3 + rnd() * 6, y + (rnd() - 0.5) * 4, 0.9, 0.6, 0, 1.5); }),
  };
  const fill = (surf, [rx, ry, w, h], rgb, a) => { for (let y = ry; y < ry + h; y++) for (let x = rx; x < rx + w; x++) { const i = (y * S + x) * 4; surf.px[i] = surf.px[i + 1] = surf.px[i + 2] = rgb * a; surf.px[i + 3] = a; } };
  const report = [];
  for (const r of REGIONS) {
    cov.clip = val.clip = r.rect; cov.wrap = val.wrap = !!r.wrap;
    const [rx, ry, w, h] = r.rect, strokes = paths[r.path](rx, ry, w, h, r);
    if (r.path === 'field') {
      fill(cov, r.rect, 1, 1); fill(val, r.rect, 0.62, 1);
      for (const s of strokes) paint(brushOf(r.brush, val, sized(r, 0.7 + 0.6 * rnd()), 0.42 + 0.58 * rnd()), s);
    } else {
      for (const s of strokes) paint(brushOf(r.brush, cov, sized(r), 1), s);
      fill(val, r.rect, 0.66, 1);
      // the value strokes cross the WHOLE shape: each path copied along its own normal, n times over `across` px, each copy in its own grey
      if (r.value) for (const s of strokes) for (let k = 0; k < r.value.n; k++) {
        const d = r.value.n > 1 ? (k / (r.value.n - 1) - 0.5) * 2 * r.value.across : 0;
        const moved = s.map(([x, y, p], i) => {
          const [ax, ay] = s[Math.max(0, i - 1)], [bx, by] = s[Math.min(s.length - 1, i + 1)], L = Math.hypot(bx - ax, by - ay) || 1;
          return [x - (by - ay) / L * d, y + (bx - ax) / L * d, p];
        });
        paint(brushOf(r.value.brush, val, { radius: r.value.radius * (0.8 + 0.4 * rnd()) }, 0.5 + 0.5 * rnd()), moved);
      }
    }
    let a = 0; for (let y = ry; y < ry + h; y++) for (let x = rx; x < rx + w; x++) a += cov.px[(y * S + x) * 4 + 3];
    report.push(r.name + ' ' + (a / (w * h)).toFixed(3));
  }
  // out: RGB = the bristle value (straight colour of the value layer), A = coverage
  const px = Buffer.alloc(S * S * 4), prev = Buffer.alloc(S * S * 3);
  for (let i = 0; i < S * S; i++) {
    const v = Math.min(1, val.px[i * 4] / Math.max(val.px[i * 4 + 3], 1e-6)), a = Math.min(1, cov.px[i * 4 + 3]);
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = Math.round(v * 255); px[i * 4 + 3] = Math.round(a * 255);
    for (let c = 0; c < 3; c++) prev[i * 3 + c] = Math.round(255 * (0.1 * (1 - a) + v * a));
  }
  fs.mkdirSync(OUT, { recursive: true });
  await sharp(px, { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'atlas.png'));
  await sharp(prev, { raw: { width: S, height: S, channels: 3 } }).jpeg({ quality: 80 }).toFile(path.join(ROOT, '.downloads', 'atlas_preview.jpg'));
  const atlas = {
    size: S, channels: 'RGB = bristle value (grey: the brush\'s own light and dark); A = coverage',
    regions: Object.fromEntries(REGIONS.map((r) => [r.name, { rect: r.rect.map((v) => v / S), tile: r.tile ?? null, brush: r.brush, value: r.value ? r.value.brush : null, wrap: !!r.wrap }])),
    engine: 'libmypaint 1.1 (60369db), ported to JavaScript (tools/mypaint_port.mjs) — ISC, Copyright (C) 2008-2011 Martin Renold and contributors',
    presets: 'mypaint/mypaint-brushes brushes/* — CC0-1.0 (classic: the MyPaint team; tanda: Marcelo "Tanda" Cerviño; ramon: Ramón Miranda)',
  };
  fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(atlas, null, 1) + '\n');
  console.log(report.join(' · '));
}
