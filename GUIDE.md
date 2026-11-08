# How Painted Ronin was made, and how to make yours

*Painted Ronin* is an original samurai open world in oil paint: a ronin, a valley of golden grass in the wind, red maples, a shrine on a
hill, three bandit camps. It was built by Claude Code from this repo in one evening. Every system in it comes from a library or a
method that shipped before; the game's own code is the glue, the rules and the look. Here is the order it was built in. Each step is
small enough to see working before the next one starts.

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

## 6. The walls (`examples/painted-ronin/tests/walls.mjs`)
Each wall is a measurement of the running game, in Chromium and in WebKit, proven red by a planted defect:

| Wall | Holds | Planted defect → red |
|---|---|---|
| W2 ragdolls | every knee and elbow in −15°..155° (measured from the bones), bodies at rest on the ground | `knee`: a flipped hinge → knees fold to −136° |
| W3 pursuit | a bandit reaches the ronin through the navmesh within 6 s | `nav`: agents can't move |
| W4 combat | strikes take a bandit down within six blows | `blade`: the blow never lands |
| W5 phone | the page's own memory count < 192 MB | — |
| W6 / W7 specials | the dash fells both bandits in its line; the storm fells both around him | `specials`: no damage |

## Make yours
Start from the recipes, not from this game. Tell your agent what you want (a game, its feel, its look) and point it at this repo.
`SKILL.md` tells it the order:
1. Pick from the list.
2. Vendor with `tools/stack.mjs`.
3. Port the recipe.
4. Look at it with `tools/shot.mjs`.
5. Write the walls and plant them red.
6. `tools/check.mjs`.
7. Publish on NotesMosaic.
