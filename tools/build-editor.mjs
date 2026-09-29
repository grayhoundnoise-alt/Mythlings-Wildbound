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

// Battle placement the game is actually running, so Battle mode opens on the
// live values instead of a guess. These are consts inside a scene rather than
// a data module, so this is the one place that reads them with a regex — the
// smoke test pins the editor and BattleScene.js to the same numbers.
const battleSrc = fs.readFileSync(path.join(root, 'src/scenes/BattleScene.js'), 'utf8');
const cn = (name, d) => {
  const m = new RegExp(`const ${name} = (-?\\d+)`).exec(battleSrc);
  return m ? Number(m[1]) : d;
};
const battleDefaults = {
  player: { dx: cn('HD_PLAYER_DX', -16), dy: cn('HD_PLAYER_DY', -8), sink: cn('HD_PLAYER_SINK', 15), sx: cn('HD_PLAYER_SHADOW_DX', 0), sy: cn('HD_PLAYER_SHADOW_DY', 0) },
  enemy:  { dx: cn('HD_ENEMY_DX', 0), dy: cn('HD_ENEMY_DY', 0), sink: cn('HD_ENEMY_SINK', 15), sx: cn('HD_ENEMY_SHADOW_DX', 0), sy: cn('HD_ENEMY_SHADOW_DY', 0) },
};
// The starter card's placement lives the same way — consts inside screens.js.
const screenSrc = fs.readFileSync(path.join(root, 'src/ui/screens.js'), 'utf8');
const scn = (name, d) => {
  const m = new RegExp(`const ${name} = (-?\\d+)`).exec(screenSrc);
  return m ? Number(m[1]) : d;
};
const starterDefaults = {
  dx: scn('HD_STARTER_DX', 0), dy: scn('HD_STARTER_DY', 0),
  gx: scn('HD_STARTER_GLOW_DX', 0), gy: scn('HD_STARTER_GLOW_DY', 0),
  sx: scn('HD_STARTER_SHADOW_DX', 0), sy: scn('HD_STARTER_SHADOW_DY', 0),
};

const out = template
  .replace('/*__RIG_BOUNDS__*/{}', bounds.trim())
  .replace('/*__SPECIES_NAMES__*/{}', JSON.stringify(names))
  .replace('/*__MANIFEST__*/{}', JSON.stringify(manifest))
  .replace('/*__BATTLE_DEFAULTS__*/null', JSON.stringify(battleDefaults))
  .replace('/*__STARTER_DEFAULTS__*/null', JSON.stringify(starterDefaults))
  .replace('/*__ASSET_LIST__*/[]', JSON.stringify(files));

for (const token of ['__RIG_BOUNDS__', '__SPECIES_NAMES__', '__ASSET_LIST__', '__MANIFEST__', '__BATTLE_DEFAULTS__', '__STARTER_DEFAULTS__']) {
  if (!template.includes(token)) throw new Error(`template is missing the ${token} placeholder`);
  if (out.includes(token)) throw new Error(`template placeholder ${token} was not replaced`);
}

const dest = path.join(root, 'MythlingEdit.html');
fs.writeFileSync(dest, out);
const placed = Object.keys(manifest).length;
console.log(`Wrote MythlingEdit.html — ${files.length} image(s) listed, ${Object.keys(names).length} species, ${Object.keys(JSON.parse(bounds)).length} forms mapped, ${placed} placement(s) read from the manifest, battle placement read from BattleScene.js.`);
