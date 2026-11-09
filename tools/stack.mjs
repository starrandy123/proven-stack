#!/usr/bin/env node
// proven-stack: vendor proven, human-made libraries into a browser game, exactly as their makers published them.
//
//   node tools/stack.mjs list                          the catalogue (stack.json): what each library is, who made it, what shipped with it
//   node tools/stack.mjs inspect <id>                  the files inside the pinned npm release (to choose what to vendor)
//   node tools/stack.mjs add <id...> --to <game>       vendor them into <game>/vendor/<id>/, with their LICENSE, and
//        [--addons a.js,b.js]                          write <game>/vendor/importmap.json and the libraries into <game>/rights.json
//        [--jolt-mb 64]                                (three.js addons: their relative imports are followed; Jolt: its fixed
//                                                       WebAssembly memory set to a size a phone can hold, every other byte kept)
//   node tools/stack.mjs importmap --to <game>         print the <script type="importmap"> for the game's index.html
//
// Every download is the exact npm tarball named in stack.json, checked against the sha512 pinned there AND the registry's own
// integrity before a byte is used. Nothing is fetched at run time: the game loads its own vendored copies by relative paths.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'stack.json'), 'utf8'));
const CACHE = path.join(ROOT, '.stack-cache');
const REGISTRY = 'https://registry.npmjs.org/';

function die(msg) { console.error('✖ ' + msg); process.exit(1); }
function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; out[k] = v; }
    else out._.push(a);
  }
  return out;
}

// ── the tarball: fetched once, checked twice, read in memory (no files are unpacked that the game does not ask for) ──
async function tarball(pkg) {
  const { name, version, integrity } = pkg;
  if (!/^sha512-/.test(integrity || '')) die(`${name}@${version}: no sha512 pinned in stack.json`);
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${name.replace('/', '__')}-${version}.tgz`);
  let buf = fs.existsSync(file) ? fs.readFileSync(file) : null;
  if (!buf) {
    const meta = await (await fetch(REGISTRY + name.replace('/', '%2F') + '/' + version)).json();
    if (!meta.dist) die(`${name}@${version}: the registry has no such release`);
    if (meta.dist.integrity !== integrity) die(`${name}@${version}: the registry says ${meta.dist.integrity}, stack.json pins ${integrity}`);
    const res = await fetch(meta.dist.tarball);
    if (!res.ok) die(`${name}@${version}: download failed (${res.status})`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  const got = 'sha512-' + crypto.createHash('sha512').update(buf).digest('base64');
  if (got !== integrity) die(`${name}@${version}: the tarball's sha512 is ${got}, stack.json pins ${integrity}`);
  fs.writeFileSync(file, buf);
  return untar(zlib.gunzipSync(buf));
}

// a tar reader: 512-byte headers, ustar prefixes and pax long names; returns { 'package/path': Buffer }
function untar(buf) {
  const files = {}; let off = 0, longName = null;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a, b) => h.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    let name = str(0, 100); const prefix = str(345, 500); if (prefix) name = prefix + '/' + name;
    const size = parseInt(str(124, 136).trim() || '0', 8); const type = String.fromCharCode(h[156] || 48);
    const body = buf.subarray(off + 512, off + 512 + size);
    if (type === 'x') { const m = /path=([^\n]+)\n/.exec(body.toString('utf8')); if (m) longName = m[1]; }
    else if (type === 'L') longName = body.toString('utf8').replace(/\0.*$/s, '');
    else if (type === '0' || type === '\0') { files[longName || name] = Buffer.from(body); longName = null; }
    else longName = null;
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

// three.js addons: copy the asked files and every relative import they make, transitively
function followImports(files, root, wanted) {
  const out = new Map(); const queue = [...wanted];
  while (queue.length) {
    const rel = path.posix.normalize(queue.shift());
    if (out.has(rel)) continue;
    const buf = files['package/' + root + rel];
    if (!buf) die(`three.js addon not found in the release: ${root}${rel}`);
    out.set(rel, buf);
    const src = buf.toString('utf8');
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      queue.push(path.posix.join(path.posix.dirname(rel), m[1] || m[2]));
    }
  }
  return out;
}

// Jolt's wasm-compat build carries its binary as one string literal; its memory section asks 2,048 pages (128 MB) at start and at
// most, and nothing grows it. Rewrite only the two page counts (same LEB128 width). Method from Tinlight (11-05), peak there 21.7 MB.
function joltMemory(src, MB) {
  const pages = Math.round(MB * 1024 * 1024 / 65536);
  const key = "na??=caa('", at = src.indexOf(key); if (at < 0) die('jolt: the embedded binary was not found (another build?)');
  let i = at + key.length - 1, j = i + 1; while (src[j] !== "'") { if (src[j] === '\\') j++; j++; }
  const str = (0, eval)(src.slice(i, j + 1)), bytes = Uint8Array.from(str, (c) => c.charCodeAt(0));
  const leb = (b, k) => { let r = 0, s = 0, x; do { x = b[k++]; r |= (x & 0x7f) << s; s += 7; } while (x & 0x80); return [r, k]; };
  let k = 8, done = false;
  while (k < bytes.length) {
    const id = bytes[k++]; let size; [size, k] = leb(bytes, k); const start = k;
    if (id === 5) {
      let n, flags, init, max, p = k; [n, p] = leb(bytes, p); [flags, p] = leb(bytes, p);
      const initAt = p; [init, p] = leb(bytes, p); const maxAt = p; if (flags & 1) [max, p] = leb(bytes, p);
      if (init !== 2048 || max !== 2048) die(`jolt: unexpected memory ${init}/${max} pages`);
      const enc = (v) => { const o = []; do { let x = v & 0x7f; v >>>= 7; if (v) x |= 0x80; o.push(x); } while (v); return o; };
      const e = enc(pages); if (e.length !== maxAt - initAt) die(`jolt: ${MB} MB needs another LEB width; pick 32-255 MB`);
      e.forEach((x, q) => { bytes[initAt + q] = x; bytes[maxAt + q] = x; }); done = true;
    }
    k = start + size;
  }
  if (!done) die('jolt: no memory section');
  let lit = "'";
  for (const b of bytes) {
    if (b === 0x27) lit += "\\'"; else if (b === 0x5c) lit += '\\\\'; else if (b === 0x0a) lit += '\\n'; else if (b === 0x0d) lit += '\\r';
    else lit += String.fromCharCode(b);
  }
  lit += "'";
  const head = `// Jolt Physics for JavaScript (github.com/jrouwe/JoltPhysics.js, MIT, Jorrit Rouwe), the npm build jolt-physics.wasm-compat.js\n` +
    `// with ONE change made by proven-stack for phones: its WebAssembly's fixed memory is ${MB} MB instead of 128 MB. Every other byte is the release's.\n`;
  return head + src.slice(0, i) + lit + src.slice(j + 1);
}

async function vendor(id, gameDir, opts) {
  const lib = CATALOGUE.libraries[id]; if (!lib) die(`unknown library "${id}" (node tools/stack.mjs list)`);
  const dest = path.join(gameDir, 'vendor', id);
  fs.rmSync(dest, { recursive: true, force: true }); fs.mkdirSync(dest, { recursive: true });
  const lock = { id, title: lib.title, license: lib.license, by: lib.by, home: lib.home, contains: lib.contains || [], packages: [], files: {} };
  if (lib.license_note) lock.license_note = lib.license_note;   // where the licence was read, when its home and its release disagree
  for (const pkg of lib.npm) {
    const files = await tarball(pkg);
    lock.packages.push({ name: pkg.name, version: pkg.version, integrity: pkg.integrity });
    const put = (rel, buf) => { const to = path.join(dest, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, buf); lock.files[rel] = { bytes: buf.length, sha256: sha256(buf), from: `${pkg.name}@${pkg.version}` }; };
    for (const [from, to] of Object.entries(pkg.files || {})) {
      let buf = files['package/' + from]; if (!buf) die(`${pkg.name}@${pkg.version}: no file ${from} in the release`);
      if (pkg.joltMemory && opts['jolt-mb']) { buf = Buffer.from(joltMemory(buf.toString('utf8'), +opts['jolt-mb']), 'utf8'); lock.joltMemoryMB = +opts['jolt-mb']; }
      put(to, buf);
    }
    if (pkg.addons) {
      const wanted = String(opts.addons || '').split(',').map((s) => s.trim()).filter(Boolean);
      for (const [rel, buf] of followImports(files, pkg.addons.root, wanted)) put(pkg.addons.to + rel, buf);
    }
    const lic = files['package/' + (pkg.license_file || 'LICENSE')];
    if (lic) put((lib.npm.length > 1 ? pkg.name.split('/').pop() + '.' : '') + 'LICENSE.txt', lic);
    else if (!lib.license_text) die(`${pkg.name}@${pkg.version}: no LICENSE file in the release; stack.json must quote its licence text`);
  }
  if (lib.license_text) fs.writeFileSync(path.join(dest, 'LICENSE.txt'), lib.license_text);
  fs.writeFileSync(path.join(dest, 'STACK.lock.json'), JSON.stringify(lock, null, 2) + '\n');
  return { lib, lock };
}

function importmap(gameDir) {
  const imports = {};
  const vdir = path.join(gameDir, 'vendor');
  for (const id of fs.existsSync(vdir) ? fs.readdirSync(vdir) : []) {
    const lib = CATALOGUE.libraries[id]; if (!lib || !fs.existsSync(path.join(vdir, id, 'STACK.lock.json'))) continue;
    for (const [spec, rel] of Object.entries(lib.imports || {})) imports[spec] = './vendor/' + id + '/' + rel;
  }
  return { imports };
}

function writeRights(gameDir) {
  const file = path.join(gameDir, 'rights.json');
  const rights = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { schema: 'mosa.rights.v1', searched: '', mine: '', others: [] };
  rights.others = (rights.others || []).filter((o) => !String(o.from || '').startsWith('vendor/'));
  const vdir = path.join(gameDir, 'vendor');
  for (const id of fs.readdirSync(vdir).sort()) {
    const lockFile = path.join(vdir, id, 'STACK.lock.json'); if (!fs.existsSync(lockFile)) continue;
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    rights.others.push({ what: `${lock.title} (${lock.packages.map((p) => p.name + '@' + p.version).join(', ')})` + (lock.joltMemoryMB ? `, its fixed memory set to ${lock.joltMemoryMB} MB` : ''),
      by: lock.by, license: lock.license, from: `vendor/${id}/ (npm, sha512-checked; licence in vendor/${id}/LICENSE.txt; home ${lock.home})${lock.license_note ? '; ' + lock.license_note : ''}` });
    for (const c of lock.contains || []) rights.others.push({ what: c.what, by: c.by, license: c.license, from: `vendor/${id}/ (${c.home})` });
  }
  fs.writeFileSync(file, JSON.stringify(rights, null, 2) + '\n');
}

const a = args(process.argv.slice(2));
const cmd = a._[0];
if (cmd === 'list') {
  for (const [id, l] of Object.entries(CATALOGUE.libraries)) {
    console.log(`${id.padEnd(14)} ${l.title} — ${l.license} — ${l.npm.map((p) => p.name + '@' + p.version).join(' + ')}`);
    console.log(`${''.padEnd(14)} ${l.does}`);
    for (const p of l.proof || []) console.log(`${''.padEnd(14)} proof: "${p.says}" (${p.url})`);
  }
} else if (cmd === 'inspect') {
  const lib = CATALOGUE.libraries[a._[1]]; if (!lib) die('inspect <id>');
  for (const pkg of lib.npm) { const files = await tarball(pkg); for (const [f, b] of Object.entries(files)) console.log(pkg.name, f.replace(/^package\//, ''), b.length); }
} else if (cmd === 'add') {
  const gameDir = path.resolve(a.to || die('add <id...> --to <game folder>')); const ids = a._.slice(1);
  if (!ids.length) die('add <id...> --to <game folder>');
  for (const id of ids) { const { lock } = await vendor(id, gameDir, a); console.log(`✔ ${id}: ${Object.keys(lock.files).length} files, ${Object.values(lock.files).reduce((s, f) => s + f.bytes, 0)} bytes${lock.joltMemoryMB ? `, Jolt memory ${lock.joltMemoryMB} MB` : ''}`); }
  fs.writeFileSync(path.join(gameDir, 'vendor', 'importmap.json'), JSON.stringify(importmap(gameDir), null, 2) + '\n');
  writeRights(gameDir);
  console.log(`✔ vendor/importmap.json and rights.json written in ${gameDir}`);
} else if (cmd === 'importmap') {
  const gameDir = path.resolve(a.to || '.');
  console.log('<script type="importmap">' + JSON.stringify(importmap(gameDir)) + '</script>');
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
