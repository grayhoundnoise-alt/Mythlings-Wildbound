// Builds MythlingEdit.html — the Mythling image editor — from its template.
//
// Four things get injected at build time, because a page opened from file://
// cannot fetch a sibling file or list a directory:
//   * the rig-geometry table, so the preview matches the real renderer
//   * the species list, for the dropdown
//   * the files actually present in assets/mythlings
//   * the CURRENT placement from src/data/hdManifest.js, so the editor opens on
//     the numbers the game is actually using rather than guessing again
//
// Re-run after changing the rig, adding a species, or adding art:
//   node tools/build-editor.mjs        (or: npm run edit:images)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const template = fs.readFileSync(path.join(root, 'tools/editor-template.html'), 'utf8');
const bounds = fs.readFileSync(path.join(root, 'assets/mythlings/rig-bounds.json'), 'utf8');

const mythlings = path.join(root, 'assets/mythlings');
const files = fs.readdirSync(mythlings)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .sort();

// Species names, read straight from the data so the dropdown never goes stale.
// species.js declares its roster three different ways, so all three are matched.
const speciesSrc = fs.readFileSync(path.join(root, 'src/data/species.js'), 'utf8');
const names = {};
// 1) the block form:  spriggo: { id: 'spriggo', displayName: 'Spriggo', ...
for (const m of speciesSrc.matchAll(/displayName: '([^']+)'/g)) {
  const head = speciesSrc.slice(0, m.index);
  const id = [...head.matchAll(/id: '([a-z0-9_]+)'/g)].pop();
  if (id) names[id[1]] = m[1];
}
// 2) line({ id: 'x', names: ['X', 'X2', ...], ... })  — first name is the base
for (const m of speciesSrc.matchAll(/line\(\{\s*id: '([a-z0-9_]+)',\s*names: \['([^']+)'/g)) {
  names[m[1]] = m[2];
}
// 3) legend({ id: 'x', name: 'X', ... })
for (const m of speciesSrc.matchAll(/legend\(\{\s*id: '([a-z0-9_]+)',\s*name: '([^']+)'/g)) {
  names[m[1]] = m[2];
}

// The live manifest, imported rather than parsed: it is a plain data module
// with no dependencies, and regexing a JS source file is how this tool ends up
// disagreeing with the game. Only model entries carry a placement.
const { HD_ASSETS } = await import(new URL('../src/data/hdManifest.js', import.meta.url));
const manifest = {};
for (const [key, entry] of Object.entries(HD_ASSETS)) {
  if (!key.startsWith('model:') || typeof entry !== 'object') continue;
  const [, speciesId, stage] = key.split(':');
  manifest[`${speciesId}:${stage}`] = { height: entry.height, anchor: entry.anchor };
}

const out = template
  .replace('/*__RIG_BOUNDS__*/{}', bounds.trim())
  .replace('/*__SPECIES_NAMES__*/{}', JSON.stringify(names))
  .replace('/*__MANIFEST__*/{}', JSON.stringify(manifest))
  .replace('/*__ASSET_LIST__*/[]', JSON.stringify(files));

for (const token of ['__RIG_BOUNDS__', '__SPECIES_NAMES__', '__ASSET_LIST__', '__MANIFEST__']) {
  if (!template.includes(token)) throw new Error(`template is missing the ${token} placeholder`);
  if (out.includes(token)) throw new Error(`template placeholder ${token} was not replaced`);
}

const dest = path.join(root, 'MythlingEdit.html');
fs.writeFileSync(dest, out);
const placed = Object.keys(manifest).length;
console.log(`Wrote MythlingEdit.html — ${files.length} image(s) listed, ${Object.keys(names).length} species, ${Object.keys(JSON.parse(bounds)).length} forms mapped, ${placed} placement(s) read from the manifest.`);
