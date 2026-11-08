#!/usr/bin/env node
// Builds Painted Ronin's characters and animations from Quaternius's free CC0 packs, with glTF-Transform (MIT, Don McCurdy) and
// sharp (Apache-2.0): phone-sized textures, no normal maps (the oil paint hides them), only the clips the game plays.
//   node examples/painted-ronin/tools/build_assets.mjs <downloads folder>
// The downloads folder holds the packs as their makers ship them (itch.io, "No thanks, just take me to the downloads"):
//   ubc/   Universal Base Characters [Standard]     (CC0)  — the head, eyes and brows
//   outfits/ Modular Character Outfits - Fantasy [Standard] (CC0) — the bodies: Male_Peasant (the ronin), Male_Ranger (bandits)
//   ual1/ ual2/ Universal Animation Library 1 and 2 [Standard] (CC0) — one rig for all of them
//   polypizza/ torii_gate, temple, maple_trees, bamboo (Quaternius, CC0) and toro_lantern (Matt Newell, CC-BY 3.0)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, weld } from '@gltf-transform/functions';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'assets');
const DL = path.resolve(process.argv[2] || path.resolve(HERE, '../../../.downloads'));
const Q = path.join(DL, 'quaternius');
const UBC = path.join(Q, 'ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf');
const OUTFIT = (n) => path.join(Q, `outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/${n}.gltf`);
const OUTFIT_TEX = (rel) => path.join(Q, 'outfits/Modular Character Outfits - Fantasy[Standard]/Textures', rel);
const UAL1 = path.join(Q, 'ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
const UAL2 = path.join(Q, 'ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(path.join(OUT, 'quaternius'), { recursive: true });

// a texture made small (and, for the ronin, dyed indigo by a gradient map on its luminance)
async function smallJpeg(file, size, dye = null) {
  let img = sharp(file).resize(size, size, { fit: 'fill' }).removeAlpha();
  if (dye) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 3) {
      const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const t = Math.min(1, Math.pow(l * 1.25, 0.9));
      const c = t < 0.5 ? dye[0].map((v, k) => v + (dye[1][k] - v) * (t / 0.5)) : dye[1].map((v, k) => v + (dye[2][k] - v) * ((t - 0.5) / 0.5));
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
    }
    img = sharp(data, { raw: info });
  }
  return img.jpeg({ quality: 82 }).toBuffer();
}

function stripMaps(doc) {
  for (const m of doc.getRoot().listMaterials()) {
    m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null);
    m.setRoughnessFactor(0.9); m.setMetallicFactor(0);
  }
}

// the base character's head, eyes and brows, cut from its full body: the triangles whose three corners follow the head or neck
async function addHead(doc, skin, parent) {
  const src = await io.read(UBC);
  const joints = src.getRoot().listSkins()[0].listJoints().map((j) => j.getName());
  const keep = new Set(['Head', 'neck_01'].map((n) => joints.indexOf(n)));
  const made = [];
  for (const node of src.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), I = prim.getIndices().getArray();
      const main = (v) => { const j = J.getElement(v, []), w = W.getElement(v, []); let b = 0; for (let k = 1; k < 4; k++) if (w[k] > w[b]) b = k; return j[b]; };
      const isBody = node.getName() === 'SuperHero_Male';
      const tris = [];
      for (let t = 0; t < I.length; t += 3) if (!isBody || [I[t], I[t + 1], I[t + 2]].every((v) => keep.has(main(v)))) tris.push(I[t], I[t + 1], I[t + 2]);
      // copy the primitive into the outfit's document, bound to the outfit's skin (the same 65 joints in the same order)
      const p = doc.createPrimitive();
      for (const sem of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) {
        const a = prim.getAttribute(sem); if (!a) continue;
        p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(doc.getRoot().listBuffers()[0]));
      }
      p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(tris)).setBuffer(doc.getRoot().listBuffers()[0]));
      const sm = prim.getMaterial(), mat = doc.createMaterial(sm.getName()).setBaseColorFactor(sm.getBaseColorFactor()).setRoughnessFactor(0.9).setMetallicFactor(0).setAlphaMode(sm.getAlphaMode()).setAlphaCutoff(sm.getAlphaCutoff()).setDoubleSided(sm.getDoubleSided());
      const bt = sm.getBaseColorTexture();
      if (bt) mat.setBaseColorTexture(doc.createTexture(bt.getName()).setImage(await sharp(Buffer.from(bt.getImage())).resize(512, 512).png().toBuffer()).setMimeType('image/png').setURI(`head_${made.length}.png`));
      p.setMaterial(mat);
      const n = doc.createNode(node.getName() + '_head').setMesh(doc.createMesh(node.getName() + '_head').addPrimitive(p)).setSkin(skin);
      parent.addChild(n); made.push(n.getName());
    }
  }
  return made;
}

async function buildCharacter(outfit, texRel, out, dye) {
  const doc = await io.read(OUTFIT(outfit));
  const root = doc.getRoot(), skin = root.listSkins()[0];
  const meshNode = root.listNodes().find((n) => n.getMesh() && n.getSkin());
  const parent = root.listNodes().find((n) => n.listChildren().includes(meshNode)) || root.listScenes()[0];
  stripMaps(doc);
  for (const t of root.listTextures()) {                                  // the outfit's colour (swapped or dyed) and its skin, made small
    const uri = t.getURI() || '';
    if (/Peasant_BaseColor|Ranger_BaseColor/.test(uri)) t.setImage(await smallJpeg(OUTFIT_TEX(texRel), 1024, dye)).setMimeType('image/jpeg').setURI(path.basename(out, '.glb') + '_cloth.jpg');
    else if (/Regular_Male.*BaseColor/.test(uri)) t.setImage(await smallJpeg(OUTFIT_TEX('Base/T_Regular_Male_Dark_BaseColor.png'), 512)).setMimeType('image/jpeg').setURI(path.basename(out, '.glb') + '_skin.jpg');
  }
  const head = await addHead(doc, skin, parent);
  await doc.transform(weld(), dedup(), prune());
  await io.write(path.join(OUT, 'quaternius', out), doc);
  return { out, head, bytes: fs.statSync(path.join(OUT, 'quaternius', out)).size };
}

// the clips the game plays, from both libraries, with the mannequin mesh removed and keyframes resampled
const CLIPS = {
  [UAL1]: ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Roll', 'Death01', 'Hit_Chest', 'Hit_Head', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Sword_Idle', 'Sword_Attack'],
  [UAL2]: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Heavy_Combo', 'Sword_Block', 'Sword_Dash', 'Hit_Knockback', 'Idle_No_Loop',
    'Sword_Regular_A_Rec', 'Sword_Regular_B_Rec', 'Sword_Regular_Combo', 'Melee_Hook', 'Slide_Start', 'Slide_Loop', 'Slide_Exit', 'NinjaJump_Start', 'NinjaJump_Idle_Loop', 'NinjaJump_Land'],
};
async function buildAnims(file, out) {
  const doc = await io.read(file), root = doc.getRoot();
  // a removed clip takes its channels and samplers with it (a sampler left behind keeps its keyframes in the file); in the kept
  // clips, scale tracks and the bones' own translations never move (only root and pelvis travel), so they go too
  const drop = (c) => { const smp = c.getSampler(); c.dispose(); if (smp) smp.dispose(); };
  for (const a of root.listAnimations()) {
    if (!CLIPS[file].includes(a.getName())) { for (const c of a.listChannels()) drop(c); for (const smp of a.listSamplers()) smp.dispose(); a.dispose(); continue; }
    for (const c of a.listChannels()) {
      const n = c.getTargetNode() && c.getTargetNode().getName(), tp = c.getTargetPath();
      if (tp === 'scale' || (tp === 'translation' && n !== 'root' && n !== 'pelvis')) drop(c);
    }
  }
  for (const n of root.listNodes()) { if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); } }
  for (const m of root.listMaterials()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune({ keepLeaves: true }));
  await io.write(path.join(OUT, 'quaternius', out), doc);
  return { out, clips: root.listAnimations().map((a) => a.getName()), bytes: fs.statSync(path.join(OUT, 'quaternius', out)).size };
}

const INDIGO = [[18, 20, 34], [44, 52, 92], [150, 158, 178]];             // ink, indigo, faded blue-grey
console.log(await buildCharacter('Male_Peasant', 'Peasant/T_Peasant_2_BaseColor.png', 'ronin.glb', INDIGO));
console.log(await buildCharacter('Male_Ranger', 'Ranger/T_Ranger_3_BaseColor.png', 'bandit.glb', null));
console.log(await buildAnims(UAL1, 'anims_ual1.glb'));
console.log(await buildAnims(UAL2, 'anims_ual2.glb'));

// the land's pieces, as their makers published them on Poly Pizza
fs.mkdirSync(path.join(OUT, 'polypizza'), { recursive: true });
for (const f of ['torii_gate', 'temple', 'maple_trees', 'bamboo', 'toro_lantern']) {
  const doc = await io.read(path.join(DL, 'polypizza', f + '.glb'));
  for (const t of doc.getRoot().listTextures()) {                          // a phone holds 512² textures; the oil paint hides the rest
    const img = t.getImage(); if (!img) continue; const meta = await sharp(Buffer.from(img)).metadata();
    if (meta.width > 512) t.setImage(await sharp(Buffer.from(img)).resize(512, 512, { fit: 'inside' }).png().toBuffer()).setMimeType('image/png');
  }
  await doc.transform(dedup(), prune());
  await io.write(path.join(OUT, 'polypizza', f + '.glb'), doc);
  console.log(f, fs.statSync(path.join(OUT, 'polypizza', f + '.glb')).size);
}
