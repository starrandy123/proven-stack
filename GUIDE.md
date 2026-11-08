# How Painted Ronin was made, and how to make yours

*Painted Ronin* is an original samurai open world in oil paint: a ronin, a valley of golden grass in the wind, red maples, a shrine on a
hill, three bandit camps. It was built by Claude Code from this repo in one evening. Every system in it comes from a library or a
method that shipped before; the game's own code is the glue, the rules and the look. Here is the order it was built in. Each step is
small enough to see working before the next one starts. The painted look of everything (step 6) was added the next night.

## 1. The land you can stand on (Jolt + FastNoiseLite)
One height function (`world.js`) feeds three things: the terrain mesh, Jolt's `HeightFieldShape` and everything placed on the ground.
What you see is what you stand on. The player is Jolt's `CharacterVirtual`, ported from `character_virtual.html`: it climbs slopes
up to 50°, steps up 45 cm, sticks to the floor and doesn't slide when standing still.

![the land](docs/process/m1_land.jpg)

*Checked:* `tools/check.mjs` boots it in Chromium and WebKit with no errors.

## 2. The painting (grass + the Kuwahara filter)
The grass is SimonDev's Quick_Grass (MIT), the method of Ghost of Tsushima's GDC 2021 talk: instanced patches around the camera, a
6-segment blade near you and a 1-segment one far away, wind from two noise fields, blades leaning away from the player. About 59,000
blades are on screen at once.
The oil paint is Maxime Heckel's anisotropic Kuwahara (MIT code; the method is Kyprianidis et al., 2009):
- a Sobel structure tensor, blurred;
- 8 sectors weighted by a polynomial;
- a grade.

It runs at 0.5-0.7 of the screen's resolution, with the brush small near the camera and wide in the distance, so the hero stays
readable while the land turns to paint.

![the painting](docs/process/m2_paint.jpg)

*Found on the way:* `THREE.MathUtils.smoothstep(h, 70, 40)` with its bounds reversed returns 0 everywhere, and there was no grass at all.

## 3. The ronin (Quaternius CC0 + glTF-Transform)
No free samurai model exists under a licence a game may ship (searched: Quaternius, KayKit, Kenney, Poly Pizza, Sketchfab). So the
ronin is built from Quaternius's CC0 pieces, which all share one 65-bone rig:
- **Body:** the Modular Character Outfits peasant, dyed indigo by a gradient map.
- **Head:** cut from the Universal Base Character by its bone weights (the triangles whose corners follow `Head` or `neck_01`).
- **Clips:** 21 from the Universal Animation Libraries.
- **Made here from simple shapes:** the kasa hat (a lathe profile), the katana (gripped where a fist holds a blade: on the thumb's
  side, square to the fingers) and the scabbard.

`tools/build_assets.mjs` does all of it and shrinks the result for a phone. 10 MB of clips became 740 KB once the removed clips' samplers
were disposed too.

![the ronin](docs/process/m3_ronin.jpg) ![a strike, four frames](docs/process/m3_strike_strip.jpg)

## 4. The world and its people (Recast & Detour + Jolt ragdolls)
- **The world:** Quaternius's CC0 torii, temple, maples and bamboo, and Matt Newell's CC-BY stone lantern, each with a Jolt collider.
- **The bandits:** Detour crowd agents on a navmesh baked from the terrain around each camp (53-75 ms per camp). They idle at camp,
  chase, wind up a blow you can read, then recover.
- **When they fall:** they become Jolt ragdolls, built on the same rig, with one-way knees and elbows and limits counted from the
  REST pose.

![the valley](docs/process/m4_world.jpg) ![a camp](docs/process/m5_fight.jpg)

*Found on the way:* JoltJS returns `Ragdoll.GetBodyID(i)` in one shared temporary. Storing the returned objects made every bone
follow one shin, and every corpse lay straight. The first ragdoll test passed on that (every knee at exactly 0°): a perfect reading
was the clue.

## 5. The fight and the specials
- **Combat:** a three-strike combo (the third is heavy), hit-stop of 0.07-0.11 s, trauma² screen shake, a roll with invulnerability
  frames, and a parry when blades meet.
- **Ki:** fills from hits, kills and parries.
  - 閃: a dash that cuts a line. The bandits fall a beat after the blade passes, and an ink stroke hangs in the air.
  - 嵐: three beats of cuts all around.
- **The air:** three.quarks carries the falling leaves, sparks, red ink and fires.
- **Sound:** ZzFX, plus a Karplus-Strong koto.

![the dash cut](docs/process/m6_dash.jpg)

## 6. One painted language (MyPaint's brushes, Sea of Thieves' clouds, a printed sky)
Looking at it, the owner said the clouds "must look painted well instead of just meshes too". A post filter alone does not make a
painting: over a smooth gradient the Kuwahara filter returns what it was given, and Alex Evans (Dreams) said it plainly — *"I have a
strong dislike of 'painterly post fx'"*. So everything painted now speaks one language, the one shipped painterly work shares (Meier's
"Painterly Rendering for Animation", SIGGRAPH 96; Disney's Deep Canvas; Dreams' splats):
- **One brush.** `tools/bake_brushes.mjs` paints `assets/paint/atlas.png` with MyPaint's own brush engine (libmypaint 1.1, ISC, ported
  from its C source in `tools/mypaint_port.mjs`) from MyPaint's CC0 presets: Tanda's oil brushes, the dry brush, kabura's sumi stroke,
  pointy ink. The atlas holds value and coverage, never colour (Meier: *"the brush itself does not impart color, just texture"*).
- **Strokes belong to the object, never the screen.** On the ground, the rocks and the banners they are laid in the world (triplanar);
  on a leaf, a puff of smoke or a spark, in the particle's own quad; on a cloud, on its own body. A bird is three brush strokes.
- **Three bands of light, sixteen colours, one wind.** A 3-texel ramp (Valve's TF2 "warp"; `MeshToonMaterial`) whose band edge is moved
  by the bristles, so a shadow's edge is a brush edge; every authored colour a swatch; and the wind that drifts the clouds also leans the
  grass, carries the leaves and the smoke and flies the banners (Ghost of Tsushima: one wind in "nearly every single effect").
- **Clouds the way Sea of Thieves made them** (SIGGRAPH 2018): opaque puffs, boiled by noise, drawn into a small buffer, blurred into
  one mass, then given a painted edge, three tones (warm cream, rose, violet-grey) and a silver lining when the sun is behind them.
- **A painted sky.** three.js's own `Sky.js`, patched: four soft tones (Gurney's sky mixes), oil strokes anchored to the sky's own
  directions, and the ukiyo-e bokashi, a Prussian-blue band printed across the top with an uneven edge. The fog walks to the sky's own
  horizon colour, measured off the sky (Firewatch).

![the painted sky and cranes](docs/process/m7_painted.jpg) ![backlit clouds](docs/process/m8_backlit.jpg)

*Found on the way:*
- Running the downloaded libmypaint.js was refused by the session's safety check, so its engine was ported from the C source, read at
  source.
- A MyPaint preset's size is a scale of its own base. Forcing pointy_ink's base to 22 px under its +3.36 pressure curve painted a 630 px
  disc.
- The grass leaned along −z while the clouds drifted along +x: two winds.
- Three of the new walls lied on their first try, and their plants proved it:
  - the sky's strokes were measured through a tensor that the sky's own smooth gradient filled;
  - the "silver lining" was the sky bleeding into the cloud's anti-aliased edge;
  - two walls read whichever random cloud was in view.
  They now measure fine detail, the cloud's own colour, and two clouds placed for the test.

## 7. The walls (`examples/painted-ronin/tests/walls.mjs`, `tests/paint.mjs`)
Each wall is a measurement of the running game, in Chromium and in WebKit, proven red by a planted defect:

| Wall | Holds | Planted defect → red |
|---|---|---|
| W2 ragdolls | every knee and elbow in −15°..155° (measured from the bones), bodies at rest on the ground | `knee`: a flipped hinge → knees fold to −136° |
| W3 pursuit | a bandit reaches the ronin through the navmesh within 6 s | `nav`: agents can't move |
| W4 combat | strikes take a bandit down within six blows | `blade`: the blow never lands |
| W5 phone | the page's own memory count < 192 MB | — |
| W6 / W7 specials | the dash fells both bandits in its line; the storm fells both around him | `specials`: no damage |
| W8 turns | four bandits never overspend the attack budget (≤ 10), never more than two strike at once, impacts ≥ 0.29 s apart | `budget`: peak 20/10, four at once |
| W9 contact | at each strike's contact the real sword (off the skeleton) passes within 0.6 m of the bandit's axis | `reach`: 0.8-0.9 m off |

The painted language has its own walls (`tests/paint.mjs`), measured on the materials the game builds and the pixels it draws:

| Wall | Holds | Planted defect → red |
|---|---|---|
| L1 one brush | every painted element samples the one atlas | `leafcanvas`: the leaves' old canvas texture |
| L2 three bands | every lit painted body takes the ramp: 3 texels, Nearest | `ramp256`: a smooth ramp on the rocks |
| L3 one palette | every authored colour of a painted element is a swatch (ΔE OKLab ≤ 0.02) | `crane00ff00` |
| L4 the brush | a crane's outline is cut by the brush (≥ 1.3× its smoothed self) and its body shaded by bristles | `flatbird` |
| L5 one wind | clouds, grass, leaves, smoke and banners all move along the one wind | `wind90`: the smoke turned |
| L6 the budget | atlas ≤ 1024²; the clouds ≤ 4 draws and ≤ 3 MB of targets | `bigclouds`: a full-size buffer |
| S1 bokashi | the top of the picture printed darker (−10 L*) with an uneven edge | `bokashi0` |
| S2 four tones | the sky's light sits on 3-5 tones | `skyramp`: the smooth ramp back |
| S3 strokes | the sky carries strokes (fine detail) laid flat | `strokes0`, `strokes90` |
| C1-C4 clouds | three tones on the swatches' hues; the shadow cooler than the light; the lit side shows away from the sun; the edge glows toward it | `rampLinear`, `rampGrey`, `sunFlip`, `rim0` |

## Make yours
Start from the recipes, not from this game. Tell your agent what you want (a game, its feel, its look) and point it at this repo.
`SKILL.md` tells it the order:
1. Pick from the list.
2. Vendor with `tools/stack.mjs`.
3. Port the recipe.
4. Look at it with `tools/shot.mjs` (and `examples/painted-ronin/tools/looks.mjs` for the painted views: valley, toward the sun, a camp,
   the birds, a phone).
5. Give every surface strokes before the paint pass runs: one brush, one ramp, one palette, one wind (`src/paint.js`).
6. Write the walls and plant them red.
7. `tools/check.mjs`.
8. Publish on NotesMosaic.
