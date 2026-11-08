---
name: proven-stack
description: Build a 3D or physics browser game that does not read as AI slop, from the libraries shipped games already trust — Jolt Physics (Horizon Forbidden West's physics) for bodies, ragdolls and characters, Recast & Detour (the navmesh inside Unity, Unreal and Godot) for enemies that find their way, three.js, three.quarks, pmndrs postprocessing, howler, ZzFX, FastNoiseLite — each pinned to an exact release, vendored with its licence and wired by a tested recipe; a painted look built as one language (MyPaint's CC0 brushes, Sea of Thieves-style painted clouds, a printed sky); every rule a wall planted red; then shipped on NotesMosaic through its checks.
metadata:
  repo: https://github.com/starrandy123/proven-stack
  pairs_with: gamedev-skills/awesome-gamedev-agent-skills (the craft; this skill is the runtime)
  publishes_to: NotesMosaic (https://notesmosaic.com/mcp)
  doors: [get_rules, list_skills, read_skill, create_game, begin_bundle_upload, finish_bundle_upload, get_bundle_upload, write_game_files, check_game, playtest_game, get_playtest, play_game, certify_game, launch_game, publish_game]
  subjects: [no ai slop, proven libraries, jolt physics, ragdoll, character controller, recast navmesh, detour crowd, pathfinding, enemies that chase, three.js, three.quarks, particles, postprocessing, oil paint, painterly, kuwahara filter, painted look, painted clouds, painted sky, mypaint brushes, ghost of tsushima grass, open world, samurai game, combat, combos, hit-stop, vendoring, rights.json, walls planted red, awesome-gamedev-agent-skills]
  proof: every library pinned to an npm release and checked against its sha512, vendored with its licence and listed in rights.json; the game's walls measured on the running game in Chromium and WebKit, each proven red by its own planted defect; the painted look's walls (one brush, three bands, one palette, one wind, the sky, the clouds) the same way; the platform's playtest passed in both engines before anything is certified
---

# proven-stack

**Skill version:** 1.0.0
**For:** any coding agent (Claude Code, Codex, Cursor, ChatGPT) asked for a 3D or physics web game: ragdolls, enemies that chase,
a character on real terrain, an open world, a painted look, or simply "make it not look like AI made it".
**Design rule:** **Never write a system that a proven library already does.** You write the GAME — its rules, its world, its feel.
Physics, ragdolls, character controllers, navigation, particles, post-processing, noise and sound come from tools humans already
perfected, each one shipped in real games, pinned to an exact release and vendored with its licence.

**Reading this through the NotesMosaic MCP:** any agent connects at `https://notesmosaic.com/mcp` (the steps for each app:
https://notesmosaic.com/developers/mcp). `list_skills` names this skill and `read_skill {"name": "proven-stack"}` hands the whole text
to any connected agent; nothing needs installing. The platform's own rules are `get_rules {"doc": "PUBLISHING.md"}`: read them before
building and again before shipping.

**The method in the open:** https://github.com/starrandy123/proven-stack holds the catalogue (`stack.json`), the tools that vendor
and check, the recipes, and a game made with them — Painted Ronin, an original samurai open world in oil paint — with its walls and
its guide (`GUIDE.md`: how it was built, step by step, with what went wrong).

## 0. Why this is the right tool

People call AI games slop when the agent writes every system itself: knees that bend backwards, enemies that walk through walls,
particles that look like a tech demo. The shipped games solved those systems already, and their libraries are open:
- **Jolt Physics** — "Used by Horizon Forbidden West and Death Stranding 2"; Godot 4.6 made it the default 3D physics.
- **Recast & Detour** — "Recast powers AI navigation features in Unity, Unreal, Godot, O3DE and countless AAA and indie games".
- **three.js** draws it; **three.quarks** fills the air; **postprocessing** (pmndrs) grades it; **howler** and **ZzFX** sound it.

It pairs with `gamedev-skills/awesome-gamedev-agent-skills` (the craft: game feel, levels, cameras): that repo teaches design and names
no runtime library for a web game; this one is the runtime half.

## 1. Vendor the libraries — never a CDN

A NotesMosaic game ships every script inside its files: no remote code, no threads, relative paths, and a phone holds 192 MB at most
(warned from 128). From an agent with a terminal:

    git clone https://github.com/starrandy123/proven-stack && cd proven-stack && npm i && npx playwright install chromium webkit
    node tools/stack.mjs list
    node tools/stack.mjs add three jolt recast quarks postprocessing howler fastnoise zzfx --to my-game --jolt-mb 32 \
         --addons loaders/GLTFLoader.js,utils/SkeletonUtils.js,objects/Sky.js

`add` checks each npm tarball against the pinned sha512 AND the registry, vendors only the listed files with `LICENSE.txt` beside them,
writes `vendor/importmap.json` (paste it into `index.html`) and `rights.json` (every library with its licence). `--jolt-mb 32` gives a
phone back most of the 128 MB Jolt's build fixes for itself; measure your peak first.

From a chat app with no terminal, the libraries must still be files inside the game: copy the exact vendored files (with their
`LICENSE.txt` and `STACK.lock.json`) from the repository's `examples/painted-ronin/vendor/`, or ask the person to run the one `add` line.

**What fails a NotesMosaic game as shipped:** three.js's own `JoltPhysics.js`, `RapierPhysics.js` and `AmmoPhysics.js` helpers load
their engine from jsDelivr at run time (remote code: vendor the engine); Jolt's multithreaded builds (a game inside the app never has
threads); PhysX and Rapier's SIMD builds (Safari 16.4+ only); GSAP (its licence is not open source).

## 2. Port the recipes — never reinvent

Each module of the worked example names, in its header, the upstream example it was ported from. Read that first, then port.
- **Physics:** a Jolt world with layers (static, moving, ragdoll, debris); the terrain as Jolt's `HeightFieldShape` fed by the SAME
  height function as the mesh (what you see is what you stand on); the player as Jolt's `CharacterVirtual` (slopes, stairs, no sliding).
  Step at a fixed 60 Hz with an accumulator.
- **Ragdolls:** capsules on the bones, swing-twist joints, one-way knees and elbows, every limit counted FROM THE REST POSE (take it
  once, before any clip plays). A cut's shove is 55-110 N·s, never hundreds.
  ⚠ JoltJS returns `Ragdoll.GetBodyID(i)` in one shared temporary: copy each id by its number, or every bone follows one shin.
- **Navigation:** a tiled navmesh baked from the level's own triangles plus obstacles, one Detour crowd per region, stepped at 60 Hz.
- **Characters:** one rig for everyone; strip the clips you don't play (and dispose their samplers: glTF-Transform leaves every keyframe
  behind otherwise); attach props to bones in the bind pose.
- **The fight:** measure each attack clip (where and when the blade crosses in front of the body) and aim the strike there, so the
  blade meets the body; an attack budget so enemies take turns (Kingdoms of Amalur's grid: never more than two at once); hit-stop of
  0.06-0.11 s, trauma² screen shake, a wind-up the player can read before every enemy blow. Every strike goes to ONE locked enemy
  (Arkham's Freeflow: a strike finds the enemy you face, and the next one when it falls; God of War 2018: target from stick and view)
  and reaches it with an AUTHORED DASH ATTACK, whole body (Sekiro's Shadowrush, "a long range, powerful thrust"; Ninja Gaiden 4's Flying
  Swallow). Measure the clip's feet first: carry the body by its own planted foot (Daniel Holden's foot locking), and fly only the rest
  of the gap, low, while no foot is down, ending on the cut (Unreal's Motion Warping window ends on the strike). Wall it off the bones:
  the lift, the front knee at mid-move, how far a planted foot slides. Never slide a body along the ground under an in-place clip, and
  never compose a jump from mismatched halves: both read as sloppy at once (the owner, 8 Nov: "It looks like a frog" · "No front flip!" ·
  "Just dash attack"). Rehearse a fight film beat by beat on the held clock before filming it: it finds the game's own defects.
- **Grass:** SimonDev's Quick_Grass (MIT), the method of Ghost of Tsushima's GDC 2021 talk.

## 3. A painted look is one language, not one filter

A post filter alone is not a painting: over a smooth gradient the Kuwahara pass returns what it was given (Alex Evans on Dreams: "I
have a strong dislike of 'painterly post fx'"). Give every surface strokes BEFORE the pass, the way shipped painterly work does (Meier's
"Painterly Rendering for Animation", SIGGRAPH 96; Disney's Deep Canvas; Dreams):
- **One brush.** Bake one atlas of strokes with MyPaint's own brush engine (libmypaint, ISC; the repository ports it) from MyPaint's
  CC0 presets (`mypaint-brushes`, `brushes/*` only: its build files are GPL). Value and coverage, never colour. A preset's size is a
  SCALE of its own base radius, as MyPaint's slider moves it: forcing the base under a pressure curve paints a 630 px disc.
- **Strokes belong to the object.** In the world (triplanar) on the ground, rocks and cloth; in each particle's own quad; on each
  cloud's own body. Never on the screen, and never world-space strokes on a body that moves (they swim over it).
- **Three bands of light, one palette, one wind.** A 3-texel ramp (Valve's TF2 "warp"; three.js `MeshToonMaterial.gradientMap`) whose
  band edge the bristles move; every authored colour a swatch (sixteen at most); one wind for clouds, grass, leaves, smoke and banners
  (Ghost of Tsushima put one global wind "into nearly every single effect").
- **Clouds the Sea of Thieves way** (SIGGRAPH 2018 talk): opaque puffs drawn into a small buffer, blurred into one mass, then a painted
  edge, three tones (warm light, rose half tone, violet shadow) and a silver lining when the sun is behind them. Billboard puffs read as
  "just meshes". Lay them as ONE DECK: every base on one flat height well over the hills (cumulus humilis: "uniform flat bases", the AMS
  glossary), no two closer than their breadths, so they recede in perspective instead of hanging in the hills as one patch. Their pace
  is an ANGLE: a fair day's cumulus crosses ≤ ~0.3°/s seen from the ground.
  ⚠ three.js `Sky.js`'s `time` uniform counts SECONDS (its example feeds `performance.now() * 0.001`); fed milliseconds its sheet runs
  1,000× fast, and even its default `cloudSpeed` crosses a view 40° up at ~2.4°/s (1.2e-6 gives a cirrus's ~0.14°/s).
- **Thin strokes for cuts, pressed where they wound:** a slash is a band along the blade TIP's path, tapered to points at both ends (a
  crescent from hilt to tip is a metre wide and reads as a smear). Give it a brush's PRESSURE: lifted in the air, pressed where the blade
  meets a body, pressed hard on a death (wider, crimson, lingering), as a calligrapher's stroke widens under pressure.
- **Banners are dyed cloth, not cards:** strokes in the cloth's own UV (world strokes swim on a banner that swings), an outline cut by a
  brush and frayed at its free side, a crest brushed on it, a wave in the one wind.
- **A painted sky:** three.js's `Sky.js` with its luminance held to four premixed tones laid WET — each step blended over most of its
  span, its edge wandering with the strokes (Gurney: grade from saturated at the top to paler and warmer at the horizon; a 24 % blend
  read as flat bands to the owner, "just light blue band to dark blue bands"; wall it against the smooth sky under it) — strokes anchored to the sky's own directions,
  a printed band across the top (the ukiyo-e bokashi); the fog walks to the sky's own horizon colour, measured off the sky (Firewatch).

## 4. Every rule is a wall, and every wall is proven red

Write each rule as a measurement of the running game in a real browser — never a screenshot judged by eye — with a `?plant=<defect>`
seam that must turn it red. The worked example's `tests/walls.mjs` (ragdolls, pursuit, combat, specials, turn-taking, contact, phone
memory, the lock, the approach) and `tests/paint.mjs` (one brush, three bands, one palette, the brush on a bird, one wind, the budget, the
bokashi, the sky's tones and strokes, the clouds' tones, warmth, lit side, silver lining, pace and deck, thin strokes) are the model:

    node tools/check.mjs my-game                          # remote code, relative paths, rights.json, vendored bytes, boot in Chromium + WebKit, memory
    node my-game/tests/walls.mjs --engine chromium && node my-game/tests/walls.mjs --engine webkit
    node my-game/tests/walls.mjs --plant knee             # must exit 1

Plant EVERY rule's defect and watch ITS wall go red. A reading that is too perfect is a suspect reading; three of the example's paint
walls passed their own plants on the first try (a sky's smooth gradient filled the measure; the sky's glow posed as a silver lining; a
random cloud decided the answer) and were rebuilt to measure the thing itself. Pass a plant as two words (`--plant strokes0`).

## 5. Ship it on NotesMosaic

1. `get_rules {"doc": "PUBLISHING.md"}`.
2. `rights.json` at the root: `mine` (what you made), `others` (every library, art pack and sound with its licence, read at its source)
   and `searched` (what you searched, files and web). Painted Ronin's file is an example, not theirs.
3. Zip the game folder uncompressed (`index.html`, `style.css`, `rights.json`, `src`, `vendor`, `assets`). Then call
   `begin_bundle_upload` with the zip's exact `size_bytes` (and `game_id` for a new version of a game they already have) → PUT the
   bytes → `finish_bundle_upload`.
4. `playtest_game` — from a terminal with engines `["chromium","webkit"]`, running its `run_it_here` lines; from a chat app with no
   engines — then `get_playtest`. A device decides whether it works; fix what it says and run it again.
5. Public is the person's word: `certify_game` → `launch_game` → `publish_game`, each when the person asks.

## 6. What never goes in

Code or assets whose licence you have not read at its source; Mixamo files in a repository or a remixable game ("under no circumstances
can you distribute the Content Files on a stand-alone basis"); non-commercial datasets (motion libraries, Shadertoy shaders without a
stated licence); another company's game, characters or names. The mechanic is free; the name and the art are not. Make it theirs.
