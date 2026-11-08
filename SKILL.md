---
name: proven-stack
description: Build a browser game from the libraries shipped games already trust — Jolt Physics (Horizon Forbidden West's physics) for bodies, ragdolls, characters and vehicles, Recast & Detour (Unity/Unreal/Godot's navmesh) for pathfinding and crowds, three.js, three.quarks, pmndrs postprocessing, howler, ZzFX, FastNoiseLite — vendored at exact releases with their licences, wired by tested recipes (ragdolls with rest-pose limits, CharacterVirtual on a height field, Detour crowds, Ghost of Tsushima-style grass, an oil-paint Kuwahara pass), every rule a wall planted red, then published on NotesMosaic. Use when someone asks for a 3D or physics web game, ragdolls, enemies that path-find, a character controller, an open world, a painterly look, or "no AI slop".
metadata:
  repo: https://github.com/starrandy123/proven-stack
  pairs_with: gamedev-skills/awesome-gamedev-agent-skills (the craft; this skill is the runtime)
  publishes_to: NotesMosaic (https://notesmosaic.com/mcp)
---

# proven-stack

**The rule that makes a game not look like AI slop:** never write a system that a proven library already does. You write the GAME —
its rules, its world, its feel, its code that glues things together. Physics, ragdolls, character controllers, navigation, particles,
post-processing, noise and sound come from the libraries in `stack.json`, each one shipped in real games, each one pinned to an exact
release and vendored with its licence.

## 0. Before any code
1. Read `README.md` → "The list" and "What fails a NotesMosaic game as shipped".
2. For each system the game needs, pick the library from `stack.json` (`node tools/stack.mjs list`). If none fits, research the
   proven open-source option first (its licence, a shipped game that uses it, a single-threaded browser build), name it, and only then
   write your own — saying so.
3. Read the matching recipe in `examples/painted-ronin/src/` and its upstream example (each file's header names it) before writing
   your version. Port; do not reinvent.

## 1. Vendor the libraries (never a CDN)
```bash
node tools/stack.mjs add three jolt recast quarks postprocessing howler fastnoise zzfx --to <game> --jolt-mb 32 \
     --addons loaders/GLTFLoader.js,utils/SkeletonUtils.js,objects/Sky.js
```
Paste `vendor/importmap.json` into `index.html` as `<script type="importmap">`. Import by bare name (`import initJolt from 'jolt-physics'`).
`rights.json` is written for you: complete its `mine` (what you made) and `searched` (what you searched, files and web).

## 2. Build with the recipes
- **Physics:** `createPhysics()` → layers (static, moving, ragdoll, debris) → `addHeightField()` for terrain → `createCharacter()` (Jolt
  CharacterVirtual: slopes, stairs, stick to floor). Step at a fixed 60 Hz with an accumulator.
- **Ragdolls:** take `restPose(person)` ONCE from a character in its bind pose (before any clip plays). `new Ragdoll(P, person, rest,
  { velocity, impulse })` when it dies. A cut's shove is 55-110 N·s; never hundreds.
  ⚠ JoltJS returns `Ragdoll.GetBodyID(i)` in one shared temporary: copy each id (`new Jolt.BodyID(id.GetIndexAndSequenceNumber())`).
- **Navigation:** bake a tiled navmesh per region from the level's own triangles plus obstacle meshes (`threeToTiledNavMesh`), one
  Detour `Crowd` per region, `crowd.update(1/60, dt)`, draw `agent.interpolatedPosition`.
- **Characters:** one rig for everyone (Quaternius's UBC + outfits + UAL clips share 65 joints in the same order). Strip clips you
  don't play and the root's translation; attach props to bones in the bind pose.
- **Look:** grass (`grass.js`), the painterly pass (`painterly.js`, run it at 0.5-0.7 of the screen), three.quarks for the air.
- **Feel:** hit-stop 0.06-0.11 s on a hit, trauma² screen shake, a wind-up the player can read before every enemy blow.

## 3. Every rule is a wall, and every wall is proven red
Write the game's walls as measurements of the running game in a real browser (`examples/painted-ronin/tests/walls.mjs` is the
model): never a screenshot judged by eye. For each wall, add a `?plant=<defect>` seam and prove the wall fails with it:
```bash
node tools/check.mjs <game>                                   # remote code, relative paths, rights.json, vendored bytes, boot in Chromium + WebKit, memory
node <game>/tests/walls.mjs --engine chromium && node <game>/tests/walls.mjs --engine webkit
node <game>/tests/walls.mjs --plant knee                      # must exit 1
```
A reading that is too perfect (every knee at exactly 0°) is a suspect reading: find out why before you trust it.

## 4. Look at it
`node tools/shot.mjs <game> out.png --keys "KeyW:1500"` boots it on this machine's GPU and plays inputs. Look at every milestone.

## 5. Publish on NotesMosaic (the MCP at https://notesmosaic.com/mcp)
`get_rules {"doc":"PUBLISHING.md"}` first. Then: zip the game folder → `begin_bundle_upload {size_bytes}` → PUT → `finish_bundle_upload`
→ `playtest_game {engines:["chromium","webkit"]}` and run its lines → `get_playtest` → fix → `certify_game` → `launch_game` →
`publish_game` (only when the person asks for it public). A game on NotesMosaic is single-threaded, has no remote code, loads by
relative paths, and must fit a phone: 192 MB at most (warned from 128).

## What never goes in
Code or assets whose licence you have not read; Mixamo files in a repo or a remixable game; non-commercial datasets; another
company's game, characters or names. Make the game yours: the mechanic is free, the name and the art are not.
