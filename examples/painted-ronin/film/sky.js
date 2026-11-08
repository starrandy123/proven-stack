// The painted sky: looking up from below at the cranes (life.js: flock 0 keeps the patch of sky above the ronin), the camera following the
// flock's own centre each frame, so the painted cumulus and the bokashi band pass behind the birds.
const G = window.__GAME, T = G.THREE, m = new T.Matrix4(), p = new T.Vector3();
const centre = () => { const c = new T.Vector3(), n = Math.min(14, G.birds.mesh.count); for (let i = 0; i < n; i++) { G.birds.mesh.getMatrixAt(i, m); c.add(p.setFromMatrixPosition(m)); } return c.divideScalar(n); };
G.cam.hold = true; G.cam.target.copy(centre()); G.cam.yaw = Math.PI; G.cam.pitch = -0.6; G.cam.dist = 22;
window.__film = (t) => { G.cam.target.lerp(centre(), 0.08); G.cam.yaw = Math.PI + t * 0.06; };
