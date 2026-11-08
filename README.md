# proven-stack

**The libraries shipped games already trust, wired for your AI: vendored, licensed, checked, and published on NotesMosaic.**

People call AI games slop because the AI writes everything itself: its own physics, its own pathfinding, its own particles. The
result is knees that bend backwards and enemies that walk through walls. This repo does the opposite. Your coding agent (Claude
Code, Codex, Cursor) builds the game, and the hard parts come from tools humans already perfected:
- **Jolt** runs the physics of Horizon Forbidden West.
- **Recast** finds the paths in Unity, Unreal and Godot.
- **three.js** draws it.

Every library is pinned to an exact release, checked against its sha512, and vendored with its licence. Every recipe has a test that
measures the running game and is proven to fail when its defect is planted.

**Made with it:** *Painted Ronin* (`examples/painted-ronin/`), an original samurai open world in oil paint, built by Claude Code from
this repo in one night. **Play it on NotesMosaic: https://notesmosaic.com/sim/9MV2-XeIEoAASJo2** (certified in Chromium and WebKit: 59-60 fps,
71-86 MB on a phone).

## Combine it with the skills you already use

[awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0) teaches an agent the
**craft**: game feel, level design, cameras, three.js scene setup. It names no runtime library for a web game, though: its physics
skill pairs only with Godot or Unity, and its game-AI skill has the agent write A* by hand.

proven-stack is the **runtime half**: the libraries that do the work, each with a working recipe. Both use the same portable
`SKILL.md` format, so they sit side by side in `.claude/skills/`:

```
npx skills add gamedev-skills/awesome-gamedev-agent-skills     # the craft: 77 skills + a router (their own install line)
npx skills add starrandy123/proven-stack                       # the tools that do the work, with their recipes and walls
```

Then ask your agent for a game. It reads both.

## Quick start

```bash
git clone https://github.com/starrandy123/proven-stack && cd proven-stack && npm i     # glTF-Transform, sharp, Playwright (dev tools)
npx playwright install chromium webkit                                                  # the check boots your game in both engines

node tools/stack.mjs list                                                               # every library, who made it, what shipped with it
node tools/stack.mjs add three jolt recast quarks postprocessing howler fastnoise zzfx \
     --to my-game --jolt-mb 32 --addons loaders/GLTFLoader.js,utils/SkeletonUtils.js,objects/Sky.js
node tools/check.mjs my-game                                                            # the walls: remote code, paths, licences, boot in Chromium + WebKit, memory
node tools/shot.mjs my-game shot.png --keys "KeyW:1500"                                 # see it the way a player does
```

`add` writes `my-game/vendor/<library>/` (the exact files, `LICENSE.txt`, `STACK.lock.json` with each file's sha256),
`vendor/importmap.json` (paste it into `index.html`) and `rights.json` (every library with its licence, for NotesMosaic).

## The list

| System | Pick | Why it's trusted (its makers' words, linked) | Licence | In a browser game |
|---|---|---|---|---|
| 3D renderer | **three.js** r187 | [Staroyale.io](https://discourse.threejs.org/t/staroyale-io-a-web-based-scifi-shooter-game-the-frontend-is-powered-by-three-js/27688), and every library below targets it | MIT | ES module + import map |
| Physics, ragdolls, characters, vehicles, soft bodies | **Jolt Physics** 1.1.1 | ["Used by Horizon Forbidden West and Death Stranding 2: On the Beach"](https://github.com/jrouwe/JoltPhysics); Godot 4.6 ["make Jolt the default physics engine for all new 3D projects"](https://godotengine.org/releases/4.6/) | MIT | `wasm-compat` build (the wasm is inside the .js); `--jolt-mb` sets its fixed memory |
| Navmesh, pathfinding, crowds | **Recast & Detour** (recast-navigation-js 0.44) | ["Recast powers AI navigation features in Unity, Unreal, Godot, O3DE and countless AAA and indie games"](https://github.com/recastnavigation/recastnavigation) | MIT (bindings) · Zlib (C++) | `wasm-compat` build; bakes a 120 m camp in 53-75 ms |
| Particles, VFX | **three.quarks** 0.17 | [Staroyale.io's particles](https://discourse.threejs.org/t/staroyale-io-a-web-based-scifi-shooter-game-the-frontend-is-powered-by-three-js/27688) (thin: its author's game) | MIT | ES module (with `quarks.core`) |
| Post-processing | **postprocessing** (pmndrs) 6.39 | ["automatically organizes and merges any given combination of effects"](https://github.com/pmndrs/postprocessing) | Zlib | ES module |
| Sound | **howler.js** 2.2.4 + **ZzFX** 1.4 | Howler: ["defaults to Web Audio API and falls back to HTML5 Audio"](https://github.com/goldfire/howler.js), [showcase](https://howlerjs.com/showcase/) (Agar.io, Lichess) · ZzFX: sound effects from numbers, no files | MIT · MIT | script / ES module |
| Noise, terrain | **FastNoiseLite** 1.1.1 | Godot: ["This class generates noise using the FastNoiseLite library"](https://docs.godotengine.org/en/stable/classes/class_fastnoiselite.html) | MIT | ES module |
| Tweens | **tween.js** 25 | used in three.js's own examples | MIT | ES module |
| 2D games | Box2D v3 (`box2d3-wasm/compat`), Phaser 4 | Box2D: Angry Birds, Limbo, Shovel Knight · Phaser: "the original engine of Vampire Survivors" | MIT | not in this catalogue yet |

**What fails a NotesMosaic game as shipped (read before you copy an example):**
- **Remote code:** three.js's own `JoltPhysics.js`, `RapierPhysics.js` and `AmmoPhysics.js` helpers load the engine from jsDelivr at
  run time. Vendor the engine instead.
- **Threads:** Jolt's multithreaded builds need them; a game inside the app never has them.
- **Older iPhones:** PhysX web builds and Rapier's SIMD build need Safari 16.4+.
- **Licences:** GSAP's licence is not open source.

## Recipes: Painted Ronin's modules, each ported from its proven source

| Recipe | What it gives your game | Ported from | Its wall (`examples/painted-ronin/tests/walls.mjs`) |
|---|---|---|---|
| `src/physics.js` | Jolt world, layers, height-field terrain, CharacterVirtual player (slopes, stairs, no sliding) | JoltPhysics.js `Examples/js/example.js`, `heightfield.html`, `character_virtual.html` | W3/W4 run on it |
| `src/ragdoll.js` | Jolt ragdolls on any humanoid rig: capsules on the bones, swing-twist joints, one-way knees and elbows, limits counted **from the rest pose**, plus an anatomical measure of every bend | Jolt `Examples/rig/` + NotesMosaic's Tinlight | **W2**: knees and elbows stay in −15°..155°; plant `knee` (a flipped hinge) folds knees to −136° and turns it red |
| `src/navigation.js` | a tiled navmesh baked from the level's triangles, a Detour crowd stepped at a fixed 60 Hz | recast-navigation-js `example-crowd-fixed-stepping-with-interpolation.ts` | **W3**: a bandit reaches the player in under 6 s; plant `nav` turns it red |
| `src/grass.js` | wind-blown grass fields: instanced patches, 6/1-segment LODs, clumps, player push | SimonDev's [Quick_Grass](https://github.com/simondevyoutube/Quick_Grass) (MIT), Ghost of Tsushima's GDC 2021 talk | — |
| `src/painterly.js` | the oil-paint look: anisotropic Kuwahara at a fraction of the screen, brush sized by depth | Maxime Heckel's [painterly shaders](https://github.com/MaximeHeckel/blog.maximeheckel.com) (MIT code) + Acerola's tensor blur and depth radius (MIT); Kyprianidis et al. 2009 | S3 reads its tensor |
| `src/paint.js` | **one painted language**: one brush atlas, strokes laid on objects in the world (triplanar), a 3-band light ramp whose edge follows the bristles, 16 swatches, one wind, fog that ends in the sky's measured horizon | Meier, ["Painterly Rendering for Animation"](https://www.cs.princeton.edu/courses/archive/fall00/cs597b/papers/meier96.pdf) (SIGGRAPH 96); Valve's TF2 shading (NPAR 2007); Firewatch (GDC 2015); Ghost of Tsushima's one wind | **L1-L6** (`tests/paint.mjs`) |
| `tools/bake_brushes.mjs` + `tools/mypaint_port.mjs` | the brush atlas, painted by MyPaint's own engine from its CC0 presets (Tanda's oil brushes, the dry brush, kabura's sumi stroke) | [libmypaint](https://github.com/mypaint/libmypaint) 1.1 (ISC), ported from its C source; [mypaint-brushes](https://github.com/mypaint/mypaint-brushes) (`brushes/*` CC0) | L1 |
| `src/sky_painted.js` | a painted sky: four soft tones, oil strokes anchored to the sky, a ukiyo-e bokashi band across the top | three.js `Sky.js` (MIT), patched; Gurney's four sky mixes; the ichimonji bokashi (JAANUS) | **S1-S3** |
| `src/clouds_painted.js` | painted cumulus: opaque boiled puffs drawn into a small buffer, blurred into one mass, given a painted edge, three tones and a silver lining | Sea of Thieves, ["The Technical Art of Sea of Thieves"](https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf) (SIGGRAPH 2018); UnlitClouds (CC0); [webgl-noise](https://github.com/stegu/webgl-noise) (MIT) | **C1-C4** |
| `src/life.js` | boid flocks as sumi-e brush strokes (cranes, swallows), wind in the maples | Reynolds 1987; three.js `webgl_gpgpu_birds` (MIT) | L4 |
| `src/characters.js` | Quaternius's CC0 rig + 21 clips on one skeleton, an animation blender, pieces attached to bones | three.js `AnimationMixer`, `SkeletonUtils` | W4 |
| `src/enemies.js` | crowd agents with a state machine: idle → chase → wind-up blow → recover → ragdoll | — | **W4** combat; plant `blade` turns it red |
| `src/vfx.js` | falling leaves, sparks, ink spray, fires and smoke that erodes (three.quarks, all stamped from the one atlas); a two-socket sword trail; the slash as a MyPaint stroke laid on the blade's measured path | three.quarks; Unreal's two-socket trail; Simon Trümpler's erosion (RIME) | **W6/W7** specials · **W9** contact · L1/L3/L5 |
| `src/audio.js` | ZzFX sound effects, filtered-noise wind, a Karplus-Strong koto | ZzFX; Karplus & Strong 1983 | — |
| `tools/build_assets.mjs` | CC0 packs → phone-sized GLBs: outfits recoloured, a head cut from a body by its bone weights, only the clips you play | glTF-Transform (MIT), sharp (Apache-2.0) | — |

## Traps we hit (so your agent doesn't)

- **JoltJS `Ragdoll.GetBodyID(i)` returns one shared temporary.** Store the returned objects and every part points at the last body:
  every bone follows one shin and every corpse lies dead straight. Copy each id by its number. *Our first ragdoll test passed on this
  (every knee at exactly 0°): a perfect reading is a suspect reading.*
- **A ragdoll limit must count from the rest pose**, never from the pose the body died in, or a knee bent at death can fold
  backwards. `ragdoll.js` carries the rest-pose axes on each bone.
- **A sword is not a cannon.** A kill impulse of 520 N·s throws a 17 kg torso at about 30 m/s and overruns every joint limit. A cut's
  shove is 55-110 N·s.
- **glTF-Transform:** removing an animation leaves its samplers behind, along with every keyframe. Dispose the samplers too: 10 MB of
  clips became 740 KB.
- **`smoothstep(x, hi, lo)` with reversed bounds** returns 0 everywhere in three.js. One line took all the grass away.
- **Jolt's npm build fixes its memory at 128 MB**, two thirds of what NotesMosaic lets a phone hold (192 MB). `--jolt-mb 32` gives a
  phone the rest back; measure your peak first.

- **A post filter alone is not a painting** (Alex Evans on Dreams: "I have a strong dislike of 'painterly post fx'"). Over a smooth
  gradient the Kuwahara filter returns its input: give every surface strokes before it runs (`paint.js`).
- **A MyPaint preset's size is a scale of its own base**, the way MyPaint's size slider moves it: forcing pointy_ink's base radius to
  22 px under its +3.36 pressure curve painted a 630 px disc. Shift the base by `ln(scale)` and let the curves ride on it.
- **three.js declares `projectionMatrix` only in the vertex shader.** A fragment shader that writes `gl_FragDepth` declares it itself.
- **three.quarks multiplies `ColorOverLife` by the start colour.** Start white and put the palette in the gradient, or smoke comes out
  smoke × smoke.
- **zsh does not split `${p:+--plant $p}`**: the test got one argument, ignored it, and three "planted" runs were clean runs. Pass plants
  from bash, or as two words.
- **Strokes fixed in the world swim over a body that moves through them** (Meier's "shower door"): paint the props, never a walking
  character, with world-space strokes.

## Art your game may ship

Human-made, licences read at their source (the research is in the receipts):
- **CC0:** Quaternius (Universal Base Characters, Modular Character Outfits, Universal Animation Library 1 and 2, its Poly Pizza
  models), KayKit, Kenney, Poly Haven, ambientCG, and MyPaint's brush presets (`mypaint-brushes/brushes/*`; its build files are GPL,
  so take only the presets).
- **CC-BY, credited:** e.g. Matt Newell's stone lantern.
- **Not in a game's files or this repo:**
  - Mixamo: "under no circumstances can you distribute the Content Files on a stand-alone basis".
  - Sonniss GDC bundles: no asset packs or templates.
  - Pixabay and Mixkit.
  - Any non-commercial set: Bandai Namco motion, AMASS, LaFAN1.
  - Ready Player Me: shut down 31 Jan 2026.
- **Quaternius's own licence changed** (QAL, 28 Aug 2026: no redistribution). Use only packs whose own page still says CC0.

## Publish it on NotesMosaic

Connect your agent to `https://notesmosaic.com/mcp`, then:
1. Zip the game folder (index.html, src, vendor, assets, rights.json).
2. `begin_bundle_upload`, then PUT the zip, then `finish_bundle_upload`.
3. `playtest_game` with engines `["chromium","webkit"]`, then `get_playtest`.
4. `certify_game`, then `launch_game`, then `publish_game`.

The platform checks the same things `tools/check.mjs` checks, on your own device: a phone upright and turned, Chromium and WebKit.

## Licence

The code in this repo (tools, recipes, the example's `src/`) is MIT. Every vendored library keeps its own licence, written beside it.
Every asset keeps its own licence, listed in the example's `rights.json`.
