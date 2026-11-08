// The valley: the ronin walks toward us through the grass at golden hour, leaves falling, the camera easing round him.
const G = window.__GAME;
G.cam.yaw = 2.9; G.cam.pitch = 0.02; G.cam.dist = 4.8;   // low, so the sky (clouds, birds) is in the frame
window.__keys('KeyS', true);
window.__film = (t) => { G.cam.yaw = 2.9 + t * 0.07; G.cam.pitch = 0.02 + t * 0.004; };
