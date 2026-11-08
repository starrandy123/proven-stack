// How the bandits find you: Recast & Detour (Mikko Mononen; "Recast powers AI navigation features in Unity, Unreal, Godot, O3DE"),
// through recast-navigation-js (Isaac Mason, MIT). Ported from its example-crowd-fixed-stepping-with-interpolation.ts:
// a navigation mesh baked from the level's own triangles, then a Detour crowd stepped at a fixed 60 Hz and drawn interpolated.
import * as THREE from 'three';
import { init, Crowd, NavMeshQuery } from '@recast-navigation/core';
import { threeToTiledNavMesh } from '@recast-navigation/three';

// Bake one tiled navmesh per region the bandits use (a camp and its surroundings), from the terrain's triangles in that square
// plus the obstacles standing in it. A camp's square is small enough to bake in well under a second on a phone.
export async function createNavigation(regions) {
  await init();
  const navs = [];
  for (const r of regions) {
    const t0 = performance.now();
    const { success, navMesh } = threeToTiledNavMesh(r.meshes, {
      cs: 0.4, ch: 0.2, tileSize: 48,
      walkableSlopeAngle: 42, walkableHeight: Math.ceil(1.8 / 0.2), walkableClimb: Math.ceil(0.5 / 0.2), walkableRadius: Math.ceil(0.4 / 0.4),
      maxEdgeLen: 24, maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20, detailSampleDist: 6, detailSampleMaxError: 1,
    });
    if (!success || !navMesh) throw new Error(`navmesh for ${r.name} failed`);
    const query = new NavMeshQuery(navMesh);
    const crowd = new Crowd(navMesh, { maxAgents: r.maxAgents || 8, maxAgentRadius: 0.6 });
    navs.push({ name: r.name, center: r.center, size: r.size, navMesh, query, crowd, bakeMs: performance.now() - t0 });
  }
  return navs;
}

// the triangles of the terrain inside a square (centre, half size), as one mesh Recast can read
export function terrainPatch(land, center, half, N, SPACING) {
  const HALF = (N - 1) * SPACING / 2;
  const i0 = Math.max(0, Math.floor((center.x - half + HALF) / SPACING)), i1 = Math.min(N - 1, Math.ceil((center.x + half + HALF) / SPACING));
  const j0 = Math.max(0, Math.floor((center.y - half + HALF) / SPACING)), j1 = Math.min(N - 1, Math.ceil((center.y + half + HALF) / SPACING));
  const w = i1 - i0 + 1, h = j1 - j0 + 1;
  const pos = new Float32Array(w * h * 3), idx = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const gi = i0 + i, gj = j0 + j;
    pos.set([-HALF + gi * SPACING, land.heights[gj * N + gi], -HALF + gj * SPACING], (j * w + i) * 3);
  }
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i, b = a + 1, c = a + w, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  return new THREE.Mesh(g);
}
