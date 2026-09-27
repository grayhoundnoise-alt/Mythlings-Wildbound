// Builds MythlingEdit.html — the standalone, offline creature / map / animation editor.
//
// The editor is completely separate from the game: the game never loads anything from
// tools/mythling-edit and this script never modifies src/. It does, however, READ the game's
// pure data + art modules (species, maps, skills, VFX tables, creature art/rig, world renderer)
// and embeds a frozen copy of them into the editor as `GameSnapshot`, so the editor can offer
// the real in-game maps, Mythlings, skills and VFX as presets that you can open and modify.
// Rebuild the editor after changing game data to refresh the snapshot.
//
//   node tools/build-editor.mjs            → writes ./MythlingEdit.html
//   node tools/build-editor.mjs --check    → only validates the sources (no write)
//   node tools/build-editor.mjs --no-game  → build without the game snapshot (demo content only)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'tools', 'mythling-edit');
const outArg = process.argv.find((a) => a.startsWith('--out=')); // optional: --out=path (e.g. a --no-game variant for tests)
const out = outArg ? path.resolve(outArg.slice(6)) : path.join(root, 'MythlingEdit.html');

// ---------------------------------------------------------------------------------------------
// Game snapshot: a tiny ES-module bundler for the game's dependency-free data/art modules.
// Each module becomes an IIFE that receives its imports from a module table and returns its
// named exports, so nothing leaks into (or collides with) the editor's own globals.
// ---------------------------------------------------------------------------------------------
const GAME_MODULES = [
  'src/core/utils.js',
  'src/data/config.js',
  'src/data/elements.js',
  'src/data/rarity.js',
  'src/data/moods.js',
  'src/data/mutations.js',
  'src/data/items.js',
  'src/data/skills.js',
  'src/data/skillVfx.js',
  'src/data/species.js',
  'src/data/maps.js',
  'src/render/creatureArt.js',
  'src/render/creatureRig.js',
  'src/render/worldRenderer.js',
];
// Non-exported helpers the editor also needs (only added when the identifier exists in the file).
const EXTRA_EXPORTS = {
  'src/render/creatureRig.js': ['drawAmbient', 'AMBIENT_ELEMENT', 'tf', 'newTf', 'blinkAt', 'personality'],
  'src/render/worldRenderer.js': ['TERRAIN', 'WATER_COLORS', 'hashStr', 'insideAny', 'insideBuildings'],
};

function bundleModule(rel) {
  const file = path.join(root, rel);
  let code = fs.readFileSync(file, 'utf8');
  const dir = path.posix.dirname(rel);
  const deps = [];
  // imports → destructuring from the module table
  code = code.replace(/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm, (m, what, from) => {
    const key = path.posix.normalize(path.posix.join(dir, from));
    deps.push(key);
    what = what.trim();
    if (what.startsWith('{')) {
      const names = what.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
        const [a, b] = s.split(/\s+as\s+/); return b ? `${a}: ${b}` : a;
      });
      return `const { ${names.join(', ')} } = __m[${JSON.stringify(key)}];`;
    }
    if (what.startsWith('* as ')) return `const ${what.slice(5).trim()} = __m[${JSON.stringify(key)}];`;
    return `const ${what} = __m[${JSON.stringify(key)}].default;`;
  });
  code = code.replace(/^import\s+['"][^'"]+['"];?[ \t]*$/gm, '');
  // exports → plain declarations, remembered for the return object
  const names = new Set();
  code = code.replace(/^export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (m, kind, name) => { names.add(name); return `${kind} ${name}`; });
  code = code.replace(/^export\s+default\s+/gm, () => { names.add('default'); return 'const __default = '; });
  code = code.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (m, list) => {
    for (const s of list.split(',').map((x) => x.trim()).filter(Boolean)) { const [a, b] = s.split(/\s+as\s+/); names.add(b ? `${b}: ${a}` : a); }
    return '';
  });
  if (/^\s*(import|export)\b/m.test(code)) throw new Error(`game snapshot: unhandled import/export syntax in ${rel}`);
  for (const extra of EXTRA_EXPORTS[rel] || []) if (new RegExp(`\\b(function|const|let|var|class)\\s+${extra}\\b`).test(code)) names.add(extra);
  const ret = [...names].map((n) => (n === 'default' ? 'default: __default' : n)).join(', ');
  return { key: rel, deps, code: `__m[${JSON.stringify(rel)}] = (function () {\n${code}\nreturn { ${ret} };\n})();` };
}

function buildGameSnapshot() {
  const mods = GAME_MODULES.map(bundleModule);
  const have = new Set(mods.map((m) => m.key));
  for (const m of mods) for (const d of m.deps) if (!have.has(d)) throw new Error(`game snapshot: ${m.key} imports ${d}, which is not in GAME_MODULES`);
  // dependency order (the list is already ordered, but verify so a future edit cannot break it)
  const seen = new Set();
  for (const m of mods) { for (const d of m.deps) if (!seen.has(d)) throw new Error(`game snapshot: ${m.key} must come after ${d}`); seen.add(m.key); }
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
  const meta = { builtAt: new Date().toISOString(), commit, files: GAME_MODULES, gameVersion: (fs.readFileSync(path.join(root, 'src/data/config.js'), 'utf8').match(/GAME_VERSION\s*=\s*'([^']+)'/) || [])[1] || '?' };
  return `// ---- GameSnapshot (generated from the game's data + art modules; read-only copy) ----
const GameSnapshot = (function () {
  const __m = {};
  try {
${mods.map((m) => m.code).join('\n')}
  } catch (e) { console.error('GameSnapshot failed to load:', e); return null; }
  return {
    meta: ${JSON.stringify(meta)},
    modules: __m,
    utils: __m['src/core/utils.js'], config: __m['src/data/config.js'], elements: __m['src/data/elements.js'], rarity: __m['src/data/rarity.js'],
    moods: __m['src/data/moods.js'], mutations: __m['src/data/mutations.js'], items: __m['src/data/items.js'], skills: __m['src/data/skills.js'],
    skillVfx: __m['src/data/skillVfx.js'], species: __m['src/data/species.js'], maps: __m['src/data/maps.js'],
    art: __m['src/render/creatureArt.js'], rig: __m['src/render/creatureRig.js'], world: __m['src/render/worldRenderer.js'],
  };
})();`;
}

// ---------------------------------------------------------------------------------------------
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const files = fs.readdirSync(path.join(src, 'js')).filter((f) => f.endsWith('.js')).sort();
const editorJs = files.map((f) => `// ---- ${f} ----\n${fs.readFileSync(path.join(src, 'js', f), 'utf8')}`).join('\n');
const withGame = !process.argv.includes('--no-game');
const snapshot = withGame ? buildGameSnapshot() : 'const GameSnapshot = null; // built with --no-game';
const js = `${snapshot}\n${editorJs}`;

// The whole editor lives in one classic <script>; a stray "</script>" inside a string would end it early.
if (/<\/script/i.test(js)) throw new Error('editor source contains "</script>" — escape it');
for (const ph of ['/* INLINE:styles.css */', '/* INLINE:js */']) if (!html.includes(ph)) throw new Error(`index.html is missing placeholder ${ph}`);

const version = (editorJs.match(/EDITOR_VERSION\s*=\s*'([^']+)'/) || [])[1] || '0.0.0';
const banner = `/* MYTHLING EDIT v${version} — standalone offline editor for Mythlings: Wildbound.
   Built ${new Date().toISOString()} from tools/mythling-edit (${files.length} modules${withGame ? ` + game data snapshot of ${GAME_MODULES.length} game modules` : ''}). No network access, no build step, no dependencies. */`;

const single = html
  .replace('/* INLINE:styles.css */', () => css)
  .replace('/* INLINE:js */', () => `${banner}\n'use strict';\n${js}`);

if (process.argv.includes('--check')) {
  console.log(`ok — ${files.length} modules${withGame ? ` + ${GAME_MODULES.length} game modules` : ''}, ${(single.length / 1024).toFixed(0)} KB`);
} else {
  fs.writeFileSync(out, single);
  console.log(`wrote ${path.relative(root, out)} (${(single.length / 1024).toFixed(0)} KB, ${files.length} modules${withGame ? ` + game snapshot @ ${(snapshot.match(/"commit":"([^"]+)"/) || [])[1]}` : ''}, v${version})`);
}
