// Input for a computer and a phone. Keys and mouse; on a touch screen a stick under the left thumb (it appears where the thumb lands),
// the right side drags the camera, and three painted buttons: strike, roll, jump.
export function createInput(root) {
  const s = { mx: 0, my: 0, run: false, look: { dx: 0, dy: 0 }, edges: new Set(), held: new Set(), touch: false };
  const press = (k) => { if (!s.held.has(k)) s.edges.add(k); s.held.add(k); };
  const release = (k) => s.held.delete(k);
  const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump', KeyF: 'strike', KeyJ: 'strike', ControlLeft: 'roll', KeyK: 'roll', KeyC: 'roll' };
  addEventListener('keydown', (e) => { const k = KEYS[e.code]; if (k) { press(k); e.preventDefault(); } });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) release(k); });
  addEventListener('blur', () => s.held.clear());

  // mouse: a click locks the pointer (the camera follows the mouse); while locked, a click strikes and the right button rolls
  const canvas = root.querySelector('canvas');
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    if (s.touch) return;
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
    press(e.button === 2 ? 'roll' : 'strike');
  });
  addEventListener('mouseup', (e) => release(e.button === 2 ? 'roll' : 'strike'));
  addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) { s.look.dx += e.movementX; s.look.dy += e.movementY; } });

  // touch: the stick, the look drag and the buttons
  const ui = document.createElement('div'); ui.className = 'touch-ui'; root.appendChild(ui);
  const stick = document.createElement('div'); stick.className = 'stick'; stick.innerHTML = '<div class="knob"></div>'; ui.appendChild(stick);
  const knob = stick.firstChild;
  const btn = (cls, label, key) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.setAttribute('aria-label', key);
    b.addEventListener('touchstart', (e) => { press(key); b.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    b.addEventListener('touchend', (e) => { release(key); b.classList.remove('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    ui.appendChild(b); return b; };
  btn('strike', '斬', 'strike'); btn('roll', '転', 'roll'); btn('jump', '跳', 'jump');
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
  const R = 56;
  canvas.addEventListener('touchstart', (e) => {
    s.touch = true; document.body.classList.add('is-touch');
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && stickId === null) { stickId = t.identifier; sx = t.clientX; sy = t.clientY; stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on'); }
      else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
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
      } else if (t.identifier === lookId) { s.look.dx += (t.clientX - lx) * 1.6; s.look.dy += (t.clientY - ly) * 1.6; lx = t.clientX; ly = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) {
    if (t.identifier === stickId) { stickId = null; s.mx = s.my = 0; s.run = false; knob.style.transform = ''; stick.classList.remove('on'); }
    if (t.identifier === lookId) lookId = null; } };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);

  return {
    // read once a frame: the move vector (camera space: x right, y forward), run, look deltas, and the buttons pressed since last frame
    read() {
      let mx = s.mx, my = s.my, run = s.run;
      if (!s.touch || stickId === null) {
        mx = (s.held.has('right') ? 1 : 0) - (s.held.has('left') ? 1 : 0); my = (s.held.has('up') ? 1 : 0) - (s.held.has('down') ? 1 : 0);
        run = s.held.has('run');
        const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      }
      const out = { mx, my, run, dx: s.look.dx, dy: s.look.dy, strike: s.edges.has('strike'), roll: s.edges.has('roll'), jump: s.edges.has('jump'), holdStrike: s.held.has('strike') };
      s.look.dx = s.look.dy = 0; s.edges.clear();
      return out;
    },
    get touch() { return s.touch; },
  };
}
