// Input for a computer and a phone. Keys and mouse; on a touch screen a stick under the left thumb (it appears where the thumb lands),
// the right side drags the camera, and six painted buttons: strike, roll, jump, the two specials and 筆 the brush.
// While the brush holds the moment (blade.js), the drag that turns the camera draws the cut's line instead: a swipe on the right of the
// screen (its direction is the line, its lift the cut — MGR's stick "from the outside to the center … will cause Raiden to slice"), or on a
// computer a drag of the locked mouse (the brush's tip moves with the mouse; press, draw, let go). A tap on 筆 opens it until a second
// tap, a hold keeps it while held.
const PLANT_IN = new URLSearchParams(location.search).get('plant');   // plant brushstick: the left 45 % stays the stick in the brush
export function createInput(root, { plant = null } = {}) {
  const s = { mx: 0, my: 0, run: false, look: { dx: 0, dy: 0 }, edges: new Set(), ups: new Set(), held: new Set(), touch: false, brush: false,
    stroke: { down: false, x0: 0, y0: 0, x: 0, y: 0, ended: false }, cur: { x: innerWidth / 2, y: innerHeight * 0.45, moved: false } };
  const press = (k) => { if (!s.held.has(k)) s.edges.add(k); s.held.add(k); };
  const release = (k) => { if (s.held.has(k)) s.ups.add(k); s.held.delete(k); };
  const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump', KeyF: 'strike', KeyJ: 'strike', ControlLeft: 'roll', KeyK: 'roll', KeyC: 'roll', KeyQ: 'dash', KeyE: 'storm', KeyR: 'brush' };
  addEventListener('keydown', (e) => { const k = KEYS[e.code]; if (k) { press(k); e.preventDefault(); } });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) release(k); });
  addEventListener('blur', () => { for (const k of s.held) s.ups.add(k); s.held.clear(); });
  const strokeAt = (x, y) => { s.stroke.down = true; s.stroke.ended = false; s.stroke.x0 = s.stroke.x = x; s.stroke.y0 = s.stroke.y = y; };
  const strokeEnd = () => { if (s.stroke.down) { s.stroke.down = false; s.stroke.ended = true; } };

  // mouse: a click locks the pointer (the camera follows the mouse); while locked, a click strikes and the right button rolls
  const canvas = root.querySelector('canvas');
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    if (s.touch) return;
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
    if (s.brush) { if (e.button === 0) strokeAt(s.cur.x, s.cur.y); return; }
    press(e.button === 2 ? 'roll' : 'strike');
  });
  addEventListener('mouseup', (e) => { if (s.brush && e.button === 0 && s.stroke.down) strokeEnd(); else release(e.button === 2 ? 'roll' : 'strike'); });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    if (s.brush) { s.cur.x = Math.min(innerWidth, Math.max(0, s.cur.x + e.movementX)); s.cur.y = Math.min(innerHeight, Math.max(0, s.cur.y + e.movementY)); s.cur.moved = true; if (s.stroke.down) { s.stroke.x = s.cur.x; s.stroke.y = s.cur.y; } }
    else { s.look.dx += e.movementX; s.look.dy += e.movementY; }
  });

  // touch: the stick, the look drag and the buttons
  const ui = document.createElement('div'); ui.className = 'touch-ui'; root.appendChild(ui);
  const stick = document.createElement('div'); stick.className = 'stick'; stick.innerHTML = '<div class="knob"></div>'; ui.appendChild(stick);
  const knob = stick.firstChild;
  const btn = (cls, label, key) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.setAttribute('aria-label', key);
    b.addEventListener('touchstart', (e) => { if (!(key === 'brush' && plant === 'bmdead')) press(key); b.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    b.addEventListener('touchend', (e) => { release(key); b.classList.remove('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    ui.appendChild(b); return b; };
  btn('strike', '斬', 'strike'); btn('roll', '転', 'roll'); btn('jump', '跳', 'jump'); btn('dash', '閃', 'dash'); btn('storm', '嵐', 'storm');
  const brushBtn = btn('brush', '筆', 'brush'); if (plant === 'bmhidden') brushBtn.style.display = 'none';
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
  const R = 56;
  const touchOn = () => { s.touch = true; document.body.classList.add('is-touch'); };
  // a touch device shows its buttons from the first frame (NotesMosaic's phone pass fails a declared control that is hidden: E-CONTROL-HIDDEN)
  const coarse = () => matchMedia('(pointer: coarse)').matches || !!(window.__MOSA_DEVICE && (window.__MOSA_DEVICE.touch || window.__MOSA_DEVICE.mobile));
  if (coarse()) touchOn();
  addEventListener('mosa:device', () => { if (coarse()) touchOn(); });
  canvas.addEventListener('touchstart', (e) => {
    touchOn();
    for (const t of e.changedTouches) {
      // in the brush the stick keeps only the bottom-left corner and the rest of the screen is the canvas, so a stroke can be drawn across a
      // bandit anywhere he stands (the chain: on a phone the left 45 % was the stick and a stroke begun there walked him); outside it, the left 45 %
      const stickZone = s.brush && PLANT_IN !== 'brushstick' ? t.clientX < innerWidth * 0.35 && t.clientY > innerHeight * 0.55 : t.clientX < innerWidth * 0.45;
      if (stickZone && stickId === null) { stickId = t.identifier; sx = t.clientX; sy = t.clientY; stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on'); }
      else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; if (s.brush) strokeAt(lx, ly); }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        s.mx = dx / R; s.my = -dy / R; s.run = d > R * 0.92;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (t.identifier === lookId) {
        if (s.brush) { if (!s.stroke.down) strokeAt(t.clientX, t.clientY); s.stroke.x = t.clientX; s.stroke.y = t.clientY; }
        else { s.look.dx += (t.clientX - lx) * 1.6; s.look.dy += (t.clientY - ly) * 1.6; }
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) {
    if (t.identifier === stickId) { stickId = null; s.mx = s.my = 0; s.run = false; knob.style.transform = ''; stick.classList.remove('on'); }
    if (t.identifier === lookId) { lookId = null; if (s.brush) strokeEnd(); } } };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);

  // what the page declares a phone player can press (NotesMosaic's mosa.controls.v1: the certification finds each on the phone's screen)
  window.__MOSA_CONTROLS = { schema: 'mosa.controls.v1', actions: [
    { id: 'strike', label: '斬 strike', keys: ['KeyF', 'KeyJ', 'click'], touch: '.btn.strike', kind: 'button' },
    { id: 'roll', label: '転 roll', keys: ['ControlLeft', 'KeyK', 'KeyC', 'right click'], touch: '.btn.roll', kind: 'button' },
    { id: 'jump', label: '跳 jump', keys: ['Space'], touch: '.btn.jump', kind: 'button' },
    { id: 'dash', label: '閃 dash cut (half ki)', keys: ['KeyQ'], touch: '.btn.dash', kind: 'button' },
    { id: 'storm', label: '嵐 storm (full ki)', keys: ['KeyE'], touch: '.btn.storm', kind: 'button' },
    { id: 'brush', label: '筆 the brush: hold or tap, then draw the cut', keys: ['KeyR'], touch: '.btn.brush', kind: 'button', hold: true },
  ] };

  return {
    // read once a frame: the move vector (camera space: x right, y forward), run, look deltas, the buttons pressed (and let go) since last
    // frame, and the brush's stroke (screen px: where it began, where it is, whether it ended this frame; on a computer the brush's tip)
    read() {
      let mx = s.mx, my = s.my, run = s.run;
      if (!s.touch || stickId === null) {
        mx = (s.held.has('right') ? 1 : 0) - (s.held.has('left') ? 1 : 0); my = (s.held.has('up') ? 1 : 0) - (s.held.has('down') ? 1 : 0);
        run = s.held.has('run');
        const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      }
      const k = s.stroke, out = { mx, my, run, dx: s.look.dx, dy: s.look.dy, strike: s.edges.has('strike'), roll: s.edges.has('roll'), jump: s.edges.has('jump'), dash: s.edges.has('dash'), storm: s.edges.has('storm'), holdStrike: s.held.has('strike'),
        brushDown: s.edges.has('brush'), brushUp: s.ups.has('brush'), brushHeld: s.held.has('brush'), cut: s.brush && s.edges.has('strike'),
        stroke: { down: k.down, x0: k.x0, y0: k.y0, x: k.x, y: k.y, ended: k.ended, hover: s.touch || !s.cur.moved ? null : { x: s.cur.x, y: s.cur.y } } };
      s.cur.moved = false;
      s.look.dx = s.look.dy = 0; s.edges.clear(); s.ups.clear(); k.ended = false;
      return out;
    },
    // the brush opens and closes the stroke: the look drag draws while it is open, and the brush's tip starts at the middle of the screen
    setBrush(on) { if (on === s.brush) return; s.brush = on; s.stroke.down = false; s.stroke.ended = false; if (on) { s.cur.x = innerWidth / 2; s.cur.y = innerHeight * 0.45; s.cur.moved = false; } },
    // the brush's tip on a computer, set by a film or a wall the way the locked mouse moves it
    setCursor(x, y) { s.cur.x = x; s.cur.y = y; s.cur.moved = true; },
    get touch() { return s.touch; },
  };
}
