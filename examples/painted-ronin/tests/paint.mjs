#!/usr/bin/env node
// Painted Ronin's PAINT walls: the one painted language (src/paint.js; research H and I in the receipts) held as measurements of the
// running game in a real browser — the materials it builds and the pixels it draws, never a picture judged by eye. Each rule names its
// source; each has a planted defect that must turn it red (exit 1).
//   L1 one brush    every painted element samples the ONE atlas (Meier 1996: one brush, many marks)              plant leafcanvas
//   L2 three bands  every painted lit body takes THE ramp: 3 texels, Nearest (TF2's warp; MeshToonMaterial)      plant ramp256
//   L3 one palette  every authored colour of a painted element is a swatch (ΔE OKLab ≤ 0.02, ≤ 16 swatches)      plant crane00ff00
//   L4 the brush    a crane's outline is cut by the brush (perimeter ÷ smoothed perimeter ≥ 1.3) and its paper
//                   body shaded by the bristles (fine detail ≥ 1 % RMS: a smooth tint reads 0)                    plant flatbird
//   L5 one wind     clouds, grass, leaves, smoke and banners move along WIND (each · WIND ≥ 0.99) (Ghost of Tsushima) plant wind90
//   L6 the budget   atlas ≤ 1024²; the clouds ≤ 4 draws and ≤ 3 MB of targets (research H, B1)                    plant bigclouds
//   S1 bokashi      the top of the picture is printed darker (L* −10 against 25-35 % down) with an uneven edge    plant bokashi0
//   S2 four tones   the sky's light sits on 3-5 tones (histogram peaks), not a smooth ramp (Gurney's mixes)       plant skyramp
//   S3 strokes      the sky carries oil strokes (fine detail ≥ 0.06 % RMS: a smooth gradient reads 0) laid flat
//                   (upright gradient energy ≥ 2× the sideways) (Yamamoto's flat brush; the oil pass needs them)  plants strokes0, strokes90
//   C1 three tones  near cloud pixels sit on the three swatches' hues (≥ 65 %) (TF2's warp; Masuyama)            plant rampLinear
//   C2 warm/cool    the shadow is bluer than the light ((B−R)/Σ ≥ 0.04) (Gooch; Raybould)                         plant rampGrey
//   C3 lit side     facing away from the sun, the light band shows (≥ 15 % of a cloud) (Gurney 2007)             plant sunFlip
//   C4 silver       backlit, a cloud's thin edge outshines its own sunlit face: the same cloud's backlit edge ÷ its
//                   front-lit interior ≥ 1 (its own colour, before the sky) (Ghost of Tsushima: forward scattering)    plant rim0
//   The sky walls hold Sky.js's moving cloud sheet off; the cloud walls measure two clouds ?test anchors (one away from the sun, one
//   toward it): a wall reads the same thing every run.
//   node examples/painted-ronin/tests/paint.mjs [--engine chromium|webkit] [--plant <name>]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../../tools/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const engine = opt('engine', 'chromium'), plant = opt('plant', null);
const pw = await import('playwright');
const { server, url } = await serve(path.resolve(HERE, '..'));
const browser = await pw[engine].launch(engine === 'chromium' ? { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : {});
const results = [];
const wall = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? '✔' : '✖'} ${name}: ${detail}`); };
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e.message || e)));
await page.goto(url + 'index.html?test' + (plant ? '&plant=' + plant : ''));
await page.waitForFunction(() => window.__MOSA_BOOT && window.__MOSA_BOOT.ok === true, null, { timeout: 60000 });
await page.waitForTimeout(1200);

// the page's own probe: render a pose without the oil pass into a float target and hand back its pixels (rows bottom → top)
await page.evaluate(() => {
  const G = window.__GAME, T = G.THREE, R = G.renderer;
  const dims = () => { const s = R.getDrawingBufferSize(new T.Vector2()); return [s.x, s.y]; };
  const read = (rt, w, h) => { const b = new Uint16Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, b); const f = new Float32Array(b.length); for (let i = 0; i < b.length; i++) f[i] = T.DataUtils.fromHalfFloat(b[i]); return f; };
  const camAt = (pos, look) => { const c = G.camera.clone(); c.position.copy(pos); c.lookAt(look); c.updateMatrixWorld(true); return c; };
  function render(scene, camera, keep = false) {
    const [w, h] = dims(), rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType });
    if (G.clouds.render) G.clouds.render(R, camera);
    const cc = R.getClearColor(new T.Color()), ca = R.getClearAlpha();
    R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(scene, camera); R.setClearColor(cc, ca);
    const px = read(rt, w, h); R.setRenderTarget(null); if (!keep) rt.dispose();
    return { w, h, px, rt };
  }
  const lum = (px, i) => 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
  const Lstar = (y) => (y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y);
  // the cloud whose direction from the eye is most toward (+1) or away from (−1) the sun, 150-450 m off
  function pickCloud(sign) {
    const A = G.clouds.clouds.filter((c) => c.anchored);
    if (A.length === 2) { const eye = G.ronin.root.position.clone(); eye.y += 2; return { eye, cloud: sign < 0 ? A[0] : A[1] }; }
    const eye = G.ronin.root.position.clone(); eye.y += 2;
    const s = new T.Vector2(G.sunDir.x, G.sunDir.z).normalize(); let best = null, score = -1e9;
    for (const c of G.clouds.clouds) { const d = new T.Vector2(c.center.x - eye.x, c.center.z - eye.z), L = d.length(); if (L < 150 || L > 450) continue; const sc = sign * d.normalize().dot(s) - L / 2000; if (sc > score) { score = sc; best = c; } }
    return { eye, cloud: best };
  }
  window.__P = { G, T, R, dims, read, camAt, render, lum, Lstar, pickCloud };
});

// ── L1 · L2 · L3: what the materials are made of ──
{
  const r = await page.evaluate(() => {
    const { G, T } = window.__P, atlas = G.paint.atlas, bad = [], seen = [];
    const uses = (name, ok) => { seen.push(name); if (!ok) bad.push(name); };
    const patched = (m) => !!(m && m.userData.paint && m.userData.paint.some((p) => p.name.startsWith('surface:')));
    uses('sky', G.sky.material.uniforms.paintAtlas && G.sky.material.uniforms.paintAtlas.value === atlas);
    uses('clouds', !!(G.clouds.mesh.material.uniforms.paintAtlas && G.clouds.mesh.material.uniforms.paintAtlas.value === atlas && G.clouds.mass && G.clouds.mass.material.uniforms.paintAtlas.value === atlas));
    uses('birds', G.birds.mesh.material.uniforms.paintAtlas.value === atlas);
    uses('leaves', G.vfx.leaves.material.map === atlas);
    G.vfx.smokes.forEach((s, i) => uses('smoke' + i, s.material.map === atlas));
    uses('sparks', G.vfx.pools.spark[0].material.map === atlas); uses('ink', G.vfx.pools.ink[0].material.map === atlas);
    uses('trail', G.vfx.trail.material.uniforms.paintAtlas.value === atlas);
    G.vfx.slashArc(G.ronin, 'Sword_Regular_A', 1, 0.2, false); G.vfx.slashArc(G.ronin, 'Sword_Regular_B', 1, 0.2, true);
    const arcs = G.vfx.arcs.slice(-2); arcs.forEach((a, i) => uses('slash' + i, a.m.material.uniforms.paintAtlas.value === atlas));
    G.vfx.stroke(new T.Vector3(0, 1, 0), new T.Vector3(2, 1, 0), { color: 'ink' }); const st = G.vfx.strokes[G.vfx.strokes.length - 1];
    uses('dash', st.m.material.map.source === atlas.source);
    const rocks = G.scene.getObjectByName('painted-rocks'), ground = G.scene.getObjectByName('painted-ground');
    uses('rocks', patched(rocks.material)); uses('ground', patched(ground.material));
    const flags = G.env.camps.flatMap((c) => c.group.userData.flags); flags.forEach((f, i) => uses('banner' + i, patched(f.material)));
    // L2: the lit painted bodies take THE ramp
    const lit = [['rocks', rocks.material], ['ground', ground.material], ...flags.map((f, i) => ['banner' + i, f.material])];
    G.env.camps.forEach((c, i) => c.group.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshToonMaterial) lit.push(['camp' + i + ':' + (o.isInstancedMesh ? 'stones' : 'pole'), o.material]); }));
    const rampBad = lit.filter(([, m]) => !(m.isMeshToonMaterial && m.gradientMap === G.RAMP)).map(([n]) => n);
    const R3 = G.RAMP.image.width === 3 && G.RAMP.magFilter === T.NearestFilter && G.RAMP.minFilter === T.NearestFilter;
    // L3: every authored colour of a painted element, against the palette in OKLab
    const okl = (c) => { const l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
      const L = Math.cbrt(l), M = Math.cbrt(m), S = Math.cbrt(s); return [0.2104542553 * L + 0.7936177850 * M - 0.0040720468 * S, 1.9779984951 * L - 2.4285922050 * M + 0.4505937099 * S, 0.0259040371 * L + 0.7827717662 * M - 0.8086757660 * S]; };
    const sw = Object.entries(G.PALETTE).map(([k, h]) => [k, okl(new T.Color(h))]);
    const nearest = (c) => { const o = okl(c); let best = 9, name = ''; for (const [k, s] of sw) { const d = Math.hypot(o[0] - s[0], o[1] - s[1], o[2] - s[2]); if (d < best) { best = d; name = k; } } return [best, name]; };
    const authored = [];
    const add = (name, c) => authored.push([name, c.isColor ? c : new T.Color(c.x, c.y, c.z)]);
    const U = (m, k) => m.uniforms[k].value;
    add('birds.paper', U(G.birds.mesh.material, 'paperC')); add('birds.ink', U(G.birds.mesh.material, 'inkC'));
    for (const k of ['lit', 'half', 'shade']) add('clouds.' + k, G.clouds.tones[k]);
    add('sky.bokashi', U(G.sky.material, 'paintPrussian'));
    add('rocks', rocks.material.color); flags.forEach((f, i) => add('banner' + i, f.material.color));
    lit.filter(([n]) => n.startsWith('camp')).forEach(([n, m]) => add(n, m.color));
    const sc = (ps, name) => { const c = ps.startColor; if (c.a && c.b) { add(name + '.a', c.a); add(name + '.b', c.b); } else if (c.color && !(c.color.x === 1 && c.color.y === 1 && c.color.z === 1)) add(name, c.color);
      for (const b of ps.behaviors) if (b.type === 'ColorOverLife') b.color.color.keys.forEach((k, i) => add(name + '.life' + i, k[0])); };
    sc(G.vfx.leaves, 'leaves'); G.vfx.smokes.forEach((s, i) => sc(s, 'smoke' + i)); sc(G.vfx.pools.spark[0], 'sparks'); sc(G.vfx.pools.ink[0], 'ink');
    arcs.forEach((a, i) => { for (const k of ['paperC', 'crimsonC', 'inkC']) add('slash' + i + '.' + k, U(a.m.material, k)); });
    add('dash', st.m.material.color); add('trail', U(G.vfx.trail.material, 'paperC'));
    const off = authored.map(([n, c]) => [n, ...nearest(c)]).filter(([, d]) => d > 0.02).map(([n, d, k]) => `${n} ${d.toFixed(3)} from ${k}`);
    return { seen: seen.length, bad, rampBad, R3, swatches: sw.length, authored: authored.length, off: off.slice(0, 4), offN: off.length };
  });
  wall('L1 one brush', r.bad.length === 0, `${r.seen - r.bad.length}/${r.seen} painted elements sample the one atlas${r.bad.length ? ' — not: ' + r.bad.join(', ') : ''}`);
  wall('L2 three bands', r.rampBad.length === 0 && r.R3, `the ramp ${r.R3 ? 'is 3 texels, Nearest' : 'is NOT 3 texels, Nearest'}; ${r.rampBad.length ? 'not on it: ' + r.rampBad.join(', ') : 'every lit painted body takes it'}`);
  wall('L3 one palette', r.offN === 0 && r.swatches <= 16, `${r.authored} authored colours, ${r.swatches} swatches; ${r.offN ? r.offN + ' off the palette: ' + r.off.join(' · ') : 'every one a swatch (ΔE ≤ 0.02)'}`);
}

// ── L4: the brush on a crane, seen from below as the ronin sees it, the crane alone ──
{
  const r = await page.evaluate(() => {
    const { G, T, render, lum } = window.__P, m = new T.Matrix4(), p = new T.Vector3(), mesh = G.birds.mesh;
    mesh.getMatrixAt(0, m); p.setFromMatrixPosition(m);
    const cam = window.__P.camAt(p.clone().add(new T.Vector3(0.6, -4.2, 0.4)), p);
    const s = new T.Scene(), parent = mesh.parent; s.add(mesh);
    const { w, h, px } = render(s, cam); parent.add(mesh);
    let x0 = w, y0 = h, x1 = 0, y1 = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 0.5) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    x0 = Math.max(0, x0 - 8); y0 = Math.max(0, y0 - 8); x1 = Math.min(w - 1, x1 + 8); y1 = Math.min(h - 1, y1 + 8);
    const W0 = w, cw = Math.max(1, x1 - x0 + 1), ch = Math.max(1, y1 - y0 + 1), cpx = new Float32Array(cw * ch * 4);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) for (let k = 0; k < 4; k++) cpx[(y * cw + x) * 4 + k] = px[((y + y0) * W0 + x + x0) * 4 + k];
    return (function (w, h, px) {
    const mask = new Uint8Array(w * h); let n = 0; for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] > 0.5) { mask[i] = 1; n++; }
    const perim = (M) => { let c = 0; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (M[i] && (!M[i - 1] || !M[i + 1] || !M[i - w] || !M[i + w])) c++; } return c; };
    const morph = (M, r, dil) => { const O = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = dil ? 0 : 1; for (let dy = -r; dy <= r && (dil ? !v : v); dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; const q = xx >= 0 && yy >= 0 && xx < w && yy < h ? M[yy * w + xx] : 0; if (dil && q) { v = 1; break; } if (!dil && !q) { v = 0; break; } } O[y * w + x] = v; } return O; };
    const smooth = morph(morph(morph(morph(mask, 3, true), 3, false), 3, false), 3, true);    // a close, then an open: the outline a smooth shape would have
    // fine detail: each pixel against the mean of its 5×5 neighbours (a smooth tint or a gradient reads ~0), inside the body eroded by 3 px
    const inner = morph(mask, 3, false), Ls = []; for (let i = 0; i < w * h; i++) if (inner[i]) Ls.push(lum(px, i));
    Ls.sort((a, b) => a - b); const top = Ls[Math.floor(Ls.length * 0.9)] || 0, paper = (v) => v > top * 0.55;   // the paper body; the ink tips fall below
    let sq = 0, nn = 0;
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) { const i = y * w + x; if (!inner[i]) continue;
      let m = 0, ok = true; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) { const v = lum(px, i + dy * w + dx); if (!paper(v)) { ok = false; break; } m += v; }
      if (!ok) continue; m /= 25; sq += ((lum(px, i) - m) / m) ** 2; nn++; }
    return { n, ratio: perim(mask) / Math.max(1, perim(smooth)), dev: Math.sqrt(sq / Math.max(1, nn)), body: nn };
    })(cw, ch, cpx);
  });
  wall('L4 the brush', r.n > 400 && r.body > 200 && r.ratio >= 1.3 && r.dev >= 0.01, `a crane of ${r.n} px: outline ${r.ratio.toFixed(2)}× its smoothed self (≥ 1.3), bristle detail ${(r.dev * 100).toFixed(2)} % RMS in ${r.body} px of its paper body (≥ 1 %)`);
}

// ── L5: one wind ──
{
  const r = await page.evaluate(() => {
    const { G, T } = window.__P, W = new T.Vector2(G.WIND.x, G.WIND.z).normalize(), dirs = [];
    const add = (n, x, z) => dirs.push([n, new T.Vector2(x, z).normalize().dot(W)]);
    const c = G.clouds.clouds.find((k) => !k.anchored), before = c.center.clone(); G.clouds.update(1); add('clouds', c.center.x - before.x, c.center.z - before.z);
    G.scene.traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.windAngle && !dirs.some(([n]) => n === 'grass')) { const a = o.material.uniforms.windAngle.value; add('grass', Math.sin(a), -Math.cos(a)); } });
    add('leaves', G.vfx.leaves.userData.wind.x, G.vfx.leaves.userData.wind.z);
    G.vfx.smokes.forEach((s, i) => add('smoke' + i, s.userData.wind.x, s.userData.wind.z));
    G.env.camps.flatMap((cp) => cp.group.userData.flags).forEach((f, i) => add('banner' + i, Math.cos(f.userData.base), -Math.sin(f.userData.base)));
    return dirs.map(([n, d]) => [n, +d.toFixed(3)]);
  });
  const off = r.filter(([, d]) => d < 0.99);
  wall('L5 one wind', off.length === 0 && r.some(([n]) => n === 'grass') && r.length >= 5, `${r.length} movers along the wind (each · WIND ≥ 0.99)${off.length ? ' — not: ' + off.map(([n, d]) => n + ' ' + d).join(', ') : ''}`);
}

// ── L6: the budget ──
{
  const r = await page.evaluate(() => {
    const { G, R } = window.__P, a = G.paint.atlas.image, info = R.info, auto = info.autoReset;
    info.autoReset = false; info.reset(); G.camera.updateMatrixWorld(); G.clouds.render(R, G.camera); const calls = info.render.calls; info.autoReset = auto;
    return { atlas: [a.width, a.height], calls: calls + 1, mb: +G.clouds.memoryMB().toFixed(2) };
  });
  wall('L6 the budget', r.atlas[0] <= 1024 && r.atlas[1] <= 1024 && r.calls <= 4 && r.mb <= 3, `atlas ${r.atlas.join('×')} · the clouds ${r.calls} draws, ${r.mb} MB of targets (≤ 1024², ≤ 4, ≤ 3 MB)`);
}

// ── S1 · S2 · S3: the sky alone, from high above the valley, looking away from the sun at 30° ──
{
  const r = await page.evaluate(() => {
    const { G, T, R, render, lum, Lstar } = window.__P;
    const s = new T.Vector2(G.sunDir.x, G.sunDir.z).normalize(), eye = new T.Vector3(0, 400, 0), el = 30 * Math.PI / 180;
    const cam = window.__P.camAt(eye, eye.clone().add(new T.Vector3(-s.x * Math.cos(el), Math.sin(el), -s.y * Math.cos(el))));
    const SU = G.sky.material.uniforms, sheet = SU.cloudCoverage.value; SU.cloudCoverage.value = 0;     // Sky.js's moving sheet held off: the same sky every run
    G.clouds.mesh.visible = false; G.birds.mesh.visible = false;
    const { w, h, px, rt } = render(G.scene, cam, true);
    // S1: rows from the top: the band's L* against 25-35 % down; the band's edge row, column by column
    const rowL = (yTop) => { const y = h - 1 - yTop; let a = 0; for (let x = 0; x < w; x++) a += Lstar(lum(px, y * w + x)); return a / w; };
    const avg = (f0, f1) => { let a = 0, n = 0; for (let y = Math.floor(f0 * h); y < Math.floor(f1 * h); y++) { a += rowL(y); n++; } return a / n; };
    const top = avg(0, 0.06), mid = avg(0.25, 0.35), half = (top + mid) / 2, edges = [];
    for (let x = 0; x < w; x += 4) { for (let yt = 0; yt < h * 0.4; yt++) { if (Lstar(lum(px, (h - 1 - yt) * w + x)) > half) { edges.push(yt / h); break; } } }
    const em = edges.reduce((a, b) => a + b, 0) / edges.length, esd = Math.sqrt(edges.reduce((a, b) => a + (b - em) ** 2, 0) / edges.length);
    // S2: below the band (the bottom 70 %), the log-luminance histogram's peaks
    const vals = []; for (let y = 0; y < Math.floor(h * 0.7); y++) for (let x = 0; x < w; x += 2) vals.push(Math.log2(Math.max(lum(px, y * w + x), 1e-5)));
    let lo = Infinity, hi = -Infinity; for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; } const B = 64, hist = new Array(B).fill(0); for (const v of vals) hist[Math.min(B - 1, Math.floor((v - lo) / (hi - lo + 1e-9) * B))]++;
    const peaks = []; for (let i = 0; i < B; i++) { const c = hist[i]; if (c / vals.length >= 0.04 && c >= (hist[i - 1] || 0) && c >= (hist[i + 1] || 0)) peaks.push(i); }
    let near = 0; for (let i = 0; i < B; i++) if (peaks.some((p) => Math.abs(p - i) <= 2)) near += hist[i];
    // S3 looks at the STROKE LAYER alone: the four tones (S2 holds those) off for one more render, so what is left is the strokes over
    // Preetham's smooth gradient. Fine detail = each pixel against its 5×5 neighbours' mean (a smooth gradient reads 0); its direction
    // from the detail's own gradients: horizontal strokes put their energy in the upright gradient.
    const keepTones = SU.paintTones.value; SU.paintTones.value = 0;
    const sk = render(G.scene, cam); SU.paintTones.value = keepTones; SU.cloudCoverage.value = sheet; rt.dispose();
    G.clouds.mesh.visible = true; G.birds.mesh.visible = true;
    const L = new Float32Array(w * h); for (let i = 0; i < w * h; i++) L[i] = lum(sk.px, i);
    const D = new Float32Array(w * h);
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) { const i = y * w + x; let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m += L[i + dy * w + dx]; m /= 25; D[i] = m > 1e-5 ? (L[i] - m) / m : 0; }
    let sq = 0, n = 0, gx2 = 0, gy2 = 0;
    for (let y = 3; y < Math.floor(h * 0.7); y++) for (let x = 3; x < w - 3; x++) { const i = y * w + x; sq += D[i] * D[i]; n++; const gx = D[i + 1] - D[i - 1], gy = D[i + w] - D[i - w]; gx2 += gx * gx; gy2 += gy * gy; }
    return { w, h, top: +top.toFixed(1), mid: +mid.toFixed(1), mura: +(esd * 100).toFixed(2), edgeAt: +(em * 100).toFixed(1), peaks: peaks.length, near: +(near / vals.length).toFixed(2),
      detail: Math.sqrt(sq / n), upright: gy2 / Math.max(gx2, 1e-12) };
  });
  wall('S1 bokashi', r.top <= r.mid - 10 && r.mura >= 0.4, `the top 6 % at L* ${r.top} against ${r.mid} 25-35 % down (−10); its edge ${r.edgeAt} % down, wandering ${r.mura} % of the height (≥ 0.4)`);
  wall('S2 four tones', r.peaks >= 3 && r.peaks <= 5 && r.near >= 0.6, `${r.peaks} tones in the sky's light (3-5), ${Math.round(r.near * 100)} % of it on them (≥ 60 %)`);
  wall('S3 strokes', r.detail >= 0.0006 && r.upright >= 2, `the sky's stroke layer: fine detail ${(r.detail * 100).toFixed(3)} % RMS (≥ 0.06 %), upright gradient energy ${r.upright.toFixed(1)}× the sideways (≥ 2: laid flat)`);
}

// ── C1 · C2 · C3 · C4: the clouds, measured on their pixels ──
async function cloudLook(sign, beyond = false) {
  return page.evaluate(([sign, beyond]) => {
    const { G, T, render, lum, pickCloud } = window.__P; let { eye, cloud } = pickCloud(sign);
    if (!cloud) return { none: true };
    if (beyond) eye = cloud.center.clone().multiplyScalar(2).sub(eye).setY(eye.y);            // the far side of the same cloud, looking back
    const cam = window.__P.camAt(eye, cloud.center), U = G.clouds.mesh.material.uniforms;
    U.debugMask.value = 1; const d = render(G.scene, cam); U.debugMask.value = 2; const own = render(G.scene, cam); U.debugMask.value = 0; const im = render(G.scene, cam);
    const t = G.clouds.tones, chroma = (c) => { const s = c.r + c.g + c.b; return [c.r / s, c.b / s]; }, tones = { shade: chroma(t.shade), half: chroma(t.half), lit: chroma(t.lit) };
    const pix = { all: 0, near: 0, onTone: 0, shade: [], lit: [], litN: 0, edge: [], inner: [] };
    for (let i = 0; i < d.w * d.h; i++) {
      if (Math.abs(d.px[i * 4 + 1] - 7) > 0.05) continue;
      pix.all++; const r = im.px[i * 4], g = im.px[i * 4 + 1], b = im.px[i * 4 + 2], s = r + g + b; if (s <= 0) continue;
      const cr = r / s, cb = b / s; let best = 9, which = '';
      for (const [k, [tr, tb]] of Object.entries(tones)) { const dd = Math.hypot(cr - tr, cb - tb); if (dd < best) { best = dd; which = k; } }
      if (which === 'lit') pix.litN++;
      if (d.px[i * 4 + 2] * 1000 < 450) { pix.near++; if (best <= 0.02) pix.onTone++; if (which === 'shade') pix.shade.push((b - r) / s); if (which === 'lit') pix.lit.push((b - r) / s); }
      const e = d.px[i * 4]; if (e > 0.5) pix.edge.push(own.px[i * 4]); else if (e < 0.02) pix.inner.push(own.px[i * 4]);   // the cloud's own colour, before the sky
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    return { all: pix.all, near: pix.near, onTone: pix.onTone / Math.max(1, pix.near), shadeN: pix.shade.length, litNearN: pix.lit.length, warm: mean(pix.shade) - mean(pix.lit),
      litFrac: pix.litN / Math.max(1, pix.all), edge: mean(pix.edge), inner: mean(pix.inner), edgeN: pix.edge.length, innerN: pix.inner.length, dist: Math.round(cloud.center.distanceTo(eye)) };
  }, [sign, beyond]);
}
{
  const a = await cloudLook(-1), b = await cloudLook(1), f = await cloudLook(1, true);     // f: the backlit cloud seen from its sunny side
  if (a.none || b.none) wall('C clouds in view', false, 'no cloud 150-450 m off toward or away from the sun');
  else {
    wall('C1 three tones', a.near >= 300 && a.onTone >= 0.65, `${a.near} near cloud px (< 450 m; a cloud ${a.dist} m off), ${Math.round(a.onTone * 100)} % on the three swatches' hues (≥ 65 %)`);
    wall('C2 warm/cool', a.shadeN >= 30 && a.litNearN >= 30 && a.warm >= 0.04, `the shadow ${a.warm.toFixed(3)} bluer than the light in (B−R)/Σ (≥ 0.04; ${a.shadeN} shadow px, ${a.litNearN} lit px)`);
    wall('C3 lit side', a.all >= 300 && a.litFrac >= 0.15, `facing away from the sun, ${Math.round(a.litFrac * 100)} % of a cloud in the light band (≥ 15 %)`);
    const glow = b.edge / f.inner;
    wall('C4 silver lining', b.edgeN >= 50 && f.innerN >= 200 && glow >= 1.0, `the same cloud backlit: its edge ${glow.toFixed(2)}× its own sunlit face (≥ 1; ${b.edgeN} edge px backlit, ${f.innerN} face px front-lit)`);
  }
}

if (errors.length) wall('no page errors', false, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
const red = results.filter((r) => !r.ok).length;
console.log(red ? `\n✖ ${red} wall(s) red (${engine}${plant ? ', plant ' + plant : ''})` : `\n✔ every paint wall holds (${engine})`);
process.exit(red ? 1 : 0);
