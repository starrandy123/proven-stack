// The painted sky: from beside the ronin, looking up into the patch of sky his cranes keep (life.js: flock 0 holds it ahead of him and
// high), the camera turning slowly so the painted cumulus pass behind them — the bokashi band across the top of the picture.
const G = window.__GAME, p = G.ronin.root.position;
G.cam.hold = true; G.cam.target.set(p.x, p.y + 15, p.z + 14); G.cam.yaw = Math.PI; G.cam.pitch = -0.55; G.cam.dist = 14;
window.__film = (t) => {
  G.cam.yaw = Math.PI + Math.sin(t * 0.25) * 0.5;
  G.cam.target.set(p.x + Math.sin(t * 0.12) * 18 * 0.6, p.y + 16, p.z + Math.cos(t * 0.12) * 18 * 0.6);   // where the flock's home drifts
};
