// THE LOCK — the ronin always knows which bandit he is fighting, and every strike goes to that bandit.
//  · Batman: Arkham City's Freeflow: with each strike Batman "will leap across the screen and find the nearest enemy that he is facing";
//    a strike misses only when it is aimed where no enemy stands. Arkham Knight "automatically switches to the next target when a player
//    defeats an enemy" (gamedesignskills.com, "Batman Arkham combat"). God of War (2018; Mihir Sheth, GDC 2019, "Evolving Combat in God of
//    War for a New Perspective"): the target is chosen from the stick and the view together, and the attacks turn to face it.
//  · Here: the stick's direction when it is pushed, else the way the ronin faces; the nearest bandit that way within RANGE, nearness and
//    direction weighed together; kept while he lives and stays within KEEP; given up for another only when the stick points clearly at
//    someone else; when he falls, the next one. The owner, 8 Nov: "hitting mostly nothing and not locking on to my enemy".
import * as THREE from 'three';

export const RANGE = 12, KEEP = 16;

export function createLock() {
  let target = null;
  const to = new THREE.Vector3();
  const score = (b, pos, dir) => {
    to.subVectors(b.root.position, pos).setY(0); const d = to.length(); if (d > RANGE) return Infinity;
    const ang = d > 0.01 ? Math.acos(THREE.MathUtils.clamp(to.dot(dir) / d, -1, 1)) : 0;
    return d / RANGE + (ang / Math.PI) * 1.25;
  };
  return {
    get target() { return target; },
    clear() { target = null; },
    // pos: the ronin's feet · dir: the intent, flat and unit length · pushed: the stick is pushed · alive: the bandits standing
    update(pos, dir, pushed, alive) {
      if (target && (target.dead || target.root.position.distanceTo(pos) > KEEP)) target = null;
      let best = null, bs = Infinity;
      for (const b of alive) { const s = score(b, pos, dir); if (s < bs) { bs = s; best = b; } }
      if (!target) target = best;
      else if (pushed && best && best !== target && bs < score(target, pos, dir) * 0.7) target = best;
      return target;
    },
  };
}
