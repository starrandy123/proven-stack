// MyPaint's brush engine, ported to JavaScript to bake brush strokes offline (never shipped in the game: only its strokes are).
// Ported from libmypaint 1.1 (mypaint/libmypaint at 60369db01ca225e715f087df44be6a5525995936, the version libmypaint.js 0.1.1 compiled):
//   mypaint-brush.c   — stroke_to, count_dabs_to, update_states_and_setting_values, prepare_and_draw_dab, settings_base_values_have_changed
//   mapping.c         — mapping_calculate (each input's piecewise-linear curve, summed onto the base value)
//   helpers.c         — rand_gauss and the HSV / HSL conversions
//   mypaint-tiled-surface.c — render_dab_mask (the two-segment hardness falloff), get_color, the normal and eraser blends
// libmypaint is ISC — "brushlib - The MyPaint Brush Library. Copyright (C) 2008-2011 Martin Renold and contributors. Permission to use,
// copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright
// notice and this permission notice appear in all copies." (the whole notice: LICENSES/libmypaint.txt beside the atlas)
// What differs, each on purpose: the random generator is a seeded mulberry32 (libmypaint's is Knuth's ran_array: only the sequence
// differs, so a bake is repeatable); the surface is one float image (premultiplied RGBA) instead of tiles; lock_alpha and colorize (used
// by none of our presets) are refused loudly rather than half-done; tilt is never given (a mouse, not a tablet); the undo-split bookkeeping
// at the end of stroke_to is left out (it decides nothing about the paint).
export const INPUTS = ['pressure', 'speed1', 'speed2', 'random', 'stroke', 'direction', 'tilt_declination', 'tilt_ascension', 'custom'];
const R_MIN = 0.2, R_MAX = 1000;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const expDecay = (T, t) => (T <= 0.001 ? 0 : Math.exp(-t / T));

export function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const randGauss = (rng) => (rng() + rng() + rng() + rng()) * 1.73205080757 - 3.46410161514;

function smallestAngularDifference(a, b) {
  a %= 360; b %= 360; let cw, ccw;
  if (a > b) { cw = a - b; ccw = b + 360 - a; } else { cw = a + 360 - b; ccw = b - a; }
  return cw < ccw ? -cw : ccw;
}
function rgbToHsv(r, g, b) {
  r = clamp(r, 0, 1); g = clamp(g, 0, 1); b = clamp(b, 0, 1);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0, s = 0;
  if (d > 0.0001) { s = d / max; if (r === max) { h = (g - b) / d; if (h < 0) h += 6; } else if (g === max) h = 2 + (b - r) / d; else h = 4 + (r - g) / d; h /= 6; }
  return [h, s, max];
}
function hsvToRgb(h, s, v) {
  h -= Math.floor(h); s = clamp(s, 0, 1); v = clamp(v, 0, 1);
  if (s === 0) return [v, v, v];
  let hue = h === 1 ? 0 : h; hue *= 6; const i = Math.floor(hue), f = hue - i, w = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, w], [q, v, w], [w, v, t], [w, q, v], [t, w, v], [v, w, q]][i];
}
function rgbToHsl(r, g, b) {
  r = clamp(r, 0, 1); g = clamp(g, 0, 1); b = clamp(b, 0, 1);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2; let h = 0, s = 0;
  if (max !== min) {
    s = l <= 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min);
    const d = max - min || 1;
    if (r === max) h = (g - b) / d; else if (g === max) h = 2 + (b - r) / d; else h = 4 + (r - g) / d;
    h /= 6; if (h < 0) h += 1;
  }
  return [h, s, l];
}
function hslValue(n1, n2, hue) {
  if (hue > 6) hue -= 6; else if (hue < 0) hue += 6;
  if (hue < 1) return n1 + (n2 - n1) * hue; if (hue < 3) return n2; if (hue < 4) return n1 + (n2 - n1) * (4 - hue); return n1;
}
function hslToRgb(h, s, l) {
  h -= Math.floor(h); s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  if (s === 0) return [l, l, l];
  const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s, m1 = 2 * l - m2;
  return [hslValue(m1, m2, h * 6 + 2), hslValue(m1, m2, h * 6), hslValue(m1, m2, h * 6 - 2)];
}

const STATES = ['x', 'y', 'pressure', 'declination', 'ascension', 'actual_x', 'actual_y', 'partial_dabs', 'actual_radius', 'norm_speed1_slow',
  'norm_speed2_slow', 'norm_dx_slow', 'norm_dy_slow', 'direction_dx', 'direction_dy', 'stroke', 'stroke_started', 'custom_input',
  'last_getcolor_r', 'last_getcolor_g', 'last_getcolor_b', 'last_getcolor_a', 'last_getcolor_recentness', 'smudge_ra', 'smudge_ga',
  'smudge_ba', 'smudge_a', 'actual_elliptical_dab_ratio', 'actual_elliptical_dab_angle'];

export class MyPaintBrush {
  // myb: a MyPaint brush file (JSON, version 3); brushsettings: libmypaint 1.1's brushsettings.json (names and defaults)
  constructor(myb, brushsettings, rng) {
    this.rng = rng; this.m = {};
    for (const s of brushsettings.settings) this.m[s.internal_name] = { base: s.default, curves: [] };
    for (const [k, v] of Object.entries(myb.settings)) {
      if (!this.m[k]) throw new Error('setting ' + k + ' is not libmypaint 1.1\'s');
      this.m[k].base = v.base_value;
      this.m[k].curves = Object.entries(v.inputs || {}).filter(([, pts]) => pts.length >= 2).map(([i, pts]) => {
        if (!INPUTS.includes(i)) throw new Error('input ' + i + ' is not libmypaint 1.1\'s');
        return [i, pts.map((p) => p[0]), pts.map((p) => p[1])];
      });
    }
    for (const k of ['lock_alpha', 'colorize']) if (this.m[k].base || this.m[k].curves.length) throw new Error(k + ' is not ported');
    this.st = Object.fromEntries(STATES.map((k) => [k, 0])); this.v = {}; this.resetRequested = true;
    this.baseValuesChanged();
  }
  base(k) { return this.m[k].base; }
  setBase(k, value) { this.m[k].base = value; this.baseValuesChanged(); }
  setColor(r, g, b) { const [h, s, v] = rgbToHsv(r, g, b); this.m.color_h.base = h; this.m.color_s.base = s; this.m.color_v.base = v; }
  calc(k, inputs) {
    const m = this.m[k]; let r = m.base;
    for (const [i, xs, ys] of m.curves) {
      const x = inputs[i]; let x0 = xs[0], y0 = ys[0], x1 = xs[1], y1 = ys[1];
      for (let j = 2; j < xs.length && x > x1; j++) { x0 = x1; y0 = y1; x1 = xs[j]; y1 = ys[j]; }
      r += x0 === x1 ? y0 : (y1 * (x - x0) + y0 * (x1 - x)) / (x1 - x0);
    }
    return r;
  }
  baseValuesChanged() {
    this.gamma = [0, 0]; this.sm = [0, 0]; this.sq = [0, 0];
    for (let i = 0; i < 2; i++) { const g = Math.exp(this.base(i ? 'speed2_gamma' : 'speed1_gamma')), m = 0.015 * (45 + g); this.gamma[i] = g; this.sm[i] = m; this.sq[i] = 0.5 - m * Math.log(45 + g); }
  }
  newStroke() { this.resetRequested = true; }

  update(ddab, dx, dy, dp, ddecl, dasc, dt) {                               // update_states_and_setting_values
    const S = this.st, V = this.v;
    if (dt <= 0) dt = 0.001;
    S.x += dx; S.y += dy; S.pressure += dp; S.declination += ddecl; S.ascension += dasc;
    const baseRadius = Math.exp(this.base('radius_logarithmic'));
    if (S.pressure <= 0) S.pressure = 0;
    const pressure = S.pressure;
    if (!S.stroke_started) { if (pressure > this.base('stroke_threshold') + 0.0001) { S.stroke_started = 1; S.stroke = 0; } }
    else if (pressure <= this.base('stroke_threshold') * 0.9 + 0.0001) S.stroke_started = 0;
    const ndx = dx / dt / baseRadius, ndy = dy / dt / baseRadius, nspeed = Math.hypot(ndx, ndy), ndist = nspeed * dt;
    const inputs = {
      pressure: pressure * Math.exp(this.base('pressure_gain_log')),
      speed1: Math.log(this.gamma[0] + S.norm_speed1_slow) * this.sm[0] + this.sq[0],
      speed2: Math.log(this.gamma[1] + S.norm_speed2_slow) * this.sm[1] + this.sq[1],
      random: this.rng(), stroke: Math.min(S.stroke, 1),
      direction: (Math.atan2(S.direction_dy, S.direction_dx) / (2 * Math.PI) * 360 + 180) % 180,
      tilt_declination: S.declination, tilt_ascension: ((S.ascension + 180) % 360) - 180, custom: S.custom_input,
    };
    for (const k in this.m) V[k] = this.calc(k, inputs);
    { const f = 1 - expDecay(V.slow_tracking_per_dab, ddab); S.actual_x += (S.x - S.actual_x) * f; S.actual_y += (S.y - S.actual_y) * f; }
    { let f = 1 - expDecay(V.speed1_slowness, dt); S.norm_speed1_slow += (nspeed - S.norm_speed1_slow) * f;
      f = 1 - expDecay(V.speed2_slowness, dt); S.norm_speed2_slow += (nspeed - S.norm_speed2_slow) * f; }
    { let tc = Math.exp(V.offset_by_speed_slowness * 0.01) - 1; if (tc < 0.002) tc = 0.002;
      const f = 1 - expDecay(tc, dt); S.norm_dx_slow += (ndx - S.norm_dx_slow) * f; S.norm_dy_slow += (ndy - S.norm_dy_slow) * f; }
    { let ddx = dx / baseRadius, ddy = dy / baseRadius; const step = Math.hypot(ddx, ddy), f = 1 - expDecay(Math.exp(V.direction_filter * 0.5) - 1, step);
      const ox = S.direction_dx, oy = S.direction_dy;
      if ((ox - ddx) ** 2 + (oy - ddy) ** 2 > (ox + ddx) ** 2 + (oy + ddy) ** 2) { ddx = -ddx; ddy = -ddy; }
      S.direction_dx += (ddx - S.direction_dx) * f; S.direction_dy += (ddy - S.direction_dy) * f; }
    { const f = 1 - expDecay(V.custom_input_slowness, 0.1); S.custom_input += (V.custom_input - S.custom_input) * f; }
    { S.stroke += ndist * Math.exp(-V.stroke_duration_logarithmic); if (S.stroke < 0) S.stroke = 0;
      const wrap = 1 + V.stroke_holdtime;
      if (S.stroke > wrap) { if (wrap > 9.9 + 1) S.stroke = 1; else { S.stroke %= wrap; if (S.stroke < 0) S.stroke = 0; } } }
    S.actual_radius = clamp(Math.exp(V.radius_logarithmic), R_MIN, R_MAX);
    S.actual_elliptical_dab_ratio = V.elliptical_dab_ratio; S.actual_elliptical_dab_angle = V.elliptical_dab_angle;
  }

  dab(surface) {                                                            // prepare_and_draw_dab
    const S = this.st, V = this.v;
    if (V.opaque < 0) V.opaque = 0;
    let opaque = clamp(V.opaque * V.opaque_multiply, 0, 1);
    if (V.opaque_linearize) {
      let dpp = (this.base('dabs_per_actual_radius') + this.base('dabs_per_basic_radius')) * 2; if (dpp < 1) dpp = 1;
      dpp = 1 + this.base('opaque_linearize') * (dpp - 1);
      opaque = 1 - Math.pow(1 - opaque, 1 / dpp);
    }
    let x = S.actual_x, y = S.actual_y;
    const baseRadius = Math.exp(this.base('radius_logarithmic'));
    if (V.offset_by_speed) { x += S.norm_dx_slow * V.offset_by_speed * 0.1 * baseRadius; y += S.norm_dy_slow * V.offset_by_speed * 0.1 * baseRadius; }
    if (V.offset_by_random) { const amp = Math.max(0, V.offset_by_random); x += randGauss(this.rng) * amp * baseRadius; y += randGauss(this.rng) * amp * baseRadius; }
    let radius = S.actual_radius;
    if (V.radius_by_random) {
      radius = clamp(Math.exp(V.radius_logarithmic + randGauss(this.rng) * V.radius_by_random), R_MIN, R_MAX);
      let ac = S.actual_radius / radius; ac *= ac; if (ac <= 1) opaque *= ac;
    }
    if (V.smudge_length < 1 && (V.smudge !== 0 || this.m.smudge.curves.length)) {
      let fac = Math.max(0.01, V.smudge_length), r, g, b, a;
      S.last_getcolor_recentness *= fac;
      if (S.last_getcolor_recentness < 0.5 * fac) {
        if (S.last_getcolor_recentness === 0) fac = 0;
        S.last_getcolor_recentness = 1;
        [r, g, b, a] = surface.getColor(Math.floor(x + 0.5), Math.floor(y + 0.5), clamp(radius * Math.exp(V.smudge_radius_log), R_MIN, R_MAX));
        S.last_getcolor_r = r; S.last_getcolor_g = g; S.last_getcolor_b = b; S.last_getcolor_a = a;
      } else { r = S.last_getcolor_r; g = S.last_getcolor_g; b = S.last_getcolor_b; a = S.last_getcolor_a; }
      S.smudge_a = clamp(fac * S.smudge_a + (1 - fac) * a, 0, 1);
      S.smudge_ra = fac * S.smudge_ra + (1 - fac) * r * a; S.smudge_ga = fac * S.smudge_ga + (1 - fac) * g * a; S.smudge_ba = fac * S.smudge_ba + (1 - fac) * b * a;
    }
    let ch = this.base('color_h'), cs = this.base('color_s'), cv = this.base('color_v'), eraserTarget = 1;
    if (V.smudge > 0) {
      let [cr, cg, cb] = hsvToRgb(ch, cs, cv); const fac = Math.min(1, V.smudge);
      eraserTarget = clamp((1 - fac) + fac * S.smudge_a, 0, 1);
      if (eraserTarget > 0) { cr = (fac * S.smudge_ra + (1 - fac) * cr) / eraserTarget; cg = (fac * S.smudge_ga + (1 - fac) * cg) / eraserTarget; cb = (fac * S.smudge_ba + (1 - fac) * cb) / eraserTarget; }
      else { cr = 1; cg = 0; cb = 0; }
      [ch, cs, cv] = rgbToHsv(cr, cg, cb);
    }
    if (V.eraser) eraserTarget *= 1 - V.eraser;
    ch += V.change_color_h; cs += V.change_color_hsv_s; cv += V.change_color_v;
    if (V.change_color_l || V.change_color_hsl_s) {
      let [hh, ss, ll] = rgbToHsl(...hsvToRgb(ch, cs, cv)); ll += V.change_color_l; ss += V.change_color_hsl_s;
      [ch, cs, cv] = rgbToHsv(...hslToRgb(hh, ss, ll));
    }
    let hardness = clamp(V.hardness, 0, 1);
    const minFade = V.anti_aliasing;
    if (radius * (1 - hardness) < minFade) {                                 // soften to the minimum fade, keeping the optical radius
      const optical = radius - (1 - hardness) * radius / 2, hn = (optical - minFade / 2) / (optical + minFade / 2);
      radius = minFade / (1 - hn); hardness = hn;
    }
    if (V.snap_to_pixel > 0) {
      const k = V.snap_to_pixel; x += (Math.floor(x) + 0.5 - x) * k; y += (Math.floor(y) + 0.5 - y) * k;
      let sr = Math.round(radius * 2) / 2; if (sr < 0.5) sr = 0.5; if (k > 0.9999) sr -= 0.0001; radius += (sr - radius) * k;
    }
    const [r, g, b] = hsvToRgb(ch, cs, cv);
    return surface.drawDab(x, y, radius, r, g, b, opaque, hardness, eraserTarget, S.actual_elliptical_dab_ratio, S.actual_elliptical_dab_angle);
  }

  countDabsTo(x, y, dt) {
    const S = this.st;
    if (S.actual_radius === 0) S.actual_radius = Math.exp(this.base('radius_logarithmic'));
    S.actual_radius = clamp(S.actual_radius, R_MIN, R_MAX);
    const baseRadius = clamp(Math.exp(this.base('radius_logarithmic')), R_MIN, R_MAX), xx = x - S.x, yy = y - S.y;
    let dist;
    if (S.actual_elliptical_dab_ratio > 1) {
      const a = S.actual_elliptical_dab_angle / 360 * 2 * Math.PI, cs = Math.cos(a), sn = Math.sin(a);
      const yyr = (yy * cs - xx * sn) * S.actual_elliptical_dab_ratio, xxr = yy * sn + xx * cs; dist = Math.sqrt(yyr * yyr + xxr * xxr);
    } else dist = Math.hypot(xx, yy);
    return dist / S.actual_radius * this.base('dabs_per_actual_radius') + dist / baseRadius * this.base('dabs_per_basic_radius') + dt * this.base('dabs_per_second');
  }

  strokeTo(surface, x, y, pressure, dtime) {                                // mypaint_brush_stroke_to (no tilt: a mouse)
    const S = this.st, tiltAsc = 0, tiltDecl = 90;
    if (pressure <= 0) pressure = 0;
    if (dtime <= 0) dtime = 0.0001;
    if (dtime > 0.1 && pressure && S.pressure === 0) { this.strokeTo(surface, x, y, 0, dtime - 0.0001); dtime = 0.0001; }
    if (this.base('tracking_noise')) {
      const br = Math.exp(this.base('radius_logarithmic'));
      x += randGauss(this.rng) * this.base('tracking_noise') * br; y += randGauss(this.rng) * this.base('tracking_noise') * br;
    }
    { const f = 1 - expDecay(this.base('slow_tracking'), 100 * dtime); x = S.x + (x - S.x) * f; y = S.y + (y - S.y) * f; }
    let moved = S.partial_dabs, todo = this.countDabsTo(x, y, dtime);
    if (dtime > 5 || this.resetRequested) {
      this.resetRequested = false;
      for (const k of STATES) S[k] = 0;
      S.x = x; S.y = y; S.pressure = pressure; S.actual_x = x; S.actual_y = y; S.stroke = 1;
      return;
    }
    let left = dtime;
    while (moved + todo >= 1) {
      let ddab; if (moved > 0) { ddab = 1 - moved; moved = 0; } else ddab = 1;
      const f = ddab / todo, sdt = f * left;
      this.update(ddab, f * (x - S.x), f * (y - S.y), f * (pressure - S.pressure), f * (tiltDecl - S.declination), f * smallestAngularDifference(S.ascension, tiltAsc), sdt);
      this.dab(surface);
      left -= sdt; todo = this.countDabsTo(x, y, left);
    }
    this.update(todo, x - S.x, y - S.y, pressure - S.pressure, tiltDecl - S.declination, smallestAngularDifference(S.ascension, tiltAsc), left);
    S.partial_dabs = moved + todo;
  }
}

// One float image (premultiplied RGBA, 0..1) that paints itself as libmypaint's tiled surface does. clip limits a stroke to its region;
// wrap repeats every dab across the region's edges so the region tiles seamlessly.
export class Surface {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Float32Array(w * h * 4); this.clip = [0, 0, w, h]; this.wrap = false; }
  dabAt(x, y, radius, r, g, b, opaque, hardness, eraser, aspect, angle) {     // render_dab_mask + draw_dab_pixels_BlendMode_Normal(_and_Eraser)
    const [cx, cy, cw, ch] = this.clip, rf = radius + 1, P = this.px, W = this.w;
    const x0 = Math.max(cx, Math.floor(x - rf - 0.5)), x1 = Math.min(cx + cw - 1, Math.floor(x + rf - 0.5));
    const y0 = Math.max(cy, Math.floor(y - rf - 0.5)), y1 = Math.min(cy + ch - 1, Math.floor(y + rf - 0.5));
    if (x0 > x1 || y0 > y1) return;
    const a = angle / 360 * 2 * Math.PI, cs = Math.cos(a), sn = Math.sin(a), inv = 1 / (radius * radius);
    const s1 = -(1 / hardness - 1), o2 = hardness < 1 ? hardness / (1 - hardness) : 0, s2 = hardness < 1 ? -hardness / (1 - hardness) : 0;
    for (let yp = y0; yp <= y1; yp++) {
      const yy = yp + 0.5 - y;
      for (let xp = x0; xp <= x1; xp++) {
        const xx = xp + 0.5 - x, yyr = (yy * cs - xx * sn) * aspect, xxr = yy * sn + xx * cs, rr = (yyr * yyr + xxr * xxr) * inv;
        if (rr > 1) continue;
        let oa = (rr <= hardness ? 1 + rr * s1 : o2 + rr * s2) * opaque; if (oa <= 0) continue;
        const ob = 1 - oa, i = (yp * W + xp) * 4; oa *= eraser;
        P[i] = oa * r + ob * P[i]; P[i + 1] = oa * g + ob * P[i + 1]; P[i + 2] = oa * b + ob * P[i + 2]; P[i + 3] = oa + ob * P[i + 3];
      }
    }
  }
  drawDab(x, y, radius, r, g, b, opaque, hardness, eraser, aspect, angle) {
    if (opaque === 0 || radius < 0.1 || hardness === 0) return false;
    if (aspect < 1) aspect = 1;
    if (!this.wrap) { this.dabAt(x, y, radius, r, g, b, opaque, hardness, eraser, aspect, angle); return true; }
    const [cx, cy, cw, ch] = this.clip, lx = (((x - cx) % cw) + cw) % cw + cx, ly = (((y - cy) % ch) + ch) % ch + cy;
    for (const dx of [-cw, 0, cw]) for (const dy of [-ch, 0, ch]) this.dabAt(lx + dx, ly + dy, radius, r, g, b, opaque, hardness, eraser, aspect, angle);
    return true;
  }
  getColor(x, y, radius) {                                                   // get_color: the average under a dab of hardness 0.5
    if (radius < 1) radius = 1;
    const [cx, cy, cw, ch] = this.clip, P = this.px, W = this.w, inv = 1 / (radius * radius);
    let sw = 0, sr = 0, sg = 0, sb = 0, sa = 0;
    for (let yp = Math.floor(y - radius - 1); yp <= Math.ceil(y + radius + 1); yp++) for (let xp = Math.floor(x - radius - 1); xp <= Math.ceil(x + radius + 1); xp++) {
      const xx = xp + 0.5 - x, yy = yp + 0.5 - y, rr = (xx * xx + yy * yy) * inv; if (rr > 1) continue;
      let px = xp, py = yp;
      if (this.wrap) { px = (((px - cx) % cw) + cw) % cw + cx; py = (((py - cy) % ch) + ch) % ch + cy; }
      if (px < cx || py < cy || px >= cx + cw || py >= cy + ch) continue;
      const w = 1 - rr, i = (py * W + px) * 4;
      sw += w; sr += w * P[i]; sg += w * P[i + 1]; sb += w * P[i + 2]; sa += w * P[i + 3];
    }
    if (sw <= 0) return [0, 1, 0, 0];
    sa /= sw; sr /= sw; sg /= sw; sb /= sw;
    const a = clamp(sa, 0, 1);
    return sa > 0 ? [clamp(sr / sa, 0, 1), clamp(sg / sa, 0, 1), clamp(sb / sa, 0, 1), a] : [0, 1, 0, 0];
  }
}
