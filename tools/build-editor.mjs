// Builds MythlingEdit.html — the standalone, offline creature / map / animation editor.
// The editor is completely separate from the game: nothing from src/ is imported here and the
// game never loads anything from tools/mythling-edit.
//
//   node tools/build-editor.mjs            → writes ./MythlingEdit.html
//   node tools/build-editor.mjs --check    → only validates the sources (no write)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'tools', 'mythling-edit');
const out = path.join(root, 'MythlingEdit.html');

const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const files = fs.readdirSync(path.join(src, 'js')).filter((f) => f.endsWith('.js')).sort();
const js = files.map((f) => `// ---- ${f} ----\n${fs.readFileSync(path.join(src, 'js', f), 'utf8')}`).join('\n');

// The whole editor lives in one classic <script>; a stray "</script>" inside a string would end it early.
if (/<\/script/i.test(js)) throw new Error('editor source contains "</script>" — escape it');
for (const ph of ['/* INLINE:styles.css */', '/* INLINE:js */']) if (!html.includes(ph)) throw new Error(`index.html is missing placeholder ${ph}`);

const version = (js.match(/EDITOR_VERSION\s*=\s*'([^']+)'/) || [])[1] || '0.0.0';
const banner = `/* MYTHLING EDIT v${version} — standalone offline editor for Mythlings: Wildbound.
   Built ${new Date().toISOString()} from tools/mythling-edit (${files.length} modules). No network access, no build step, no dependencies. */`;

const single = html
  .replace('/* INLINE:styles.css */', () => css)
  .replace('/* INLINE:js */', () => `${banner}\n'use strict';\n${js}`);

if (process.argv.includes('--check')) {
  console.log(`ok — ${files.length} modules, ${(single.length / 1024).toFixed(0)} KB`);
} else {
  fs.writeFileSync(out, single);
  console.log(`wrote ${path.relative(root, out)} (${(single.length / 1024).toFixed(0)} KB, ${files.length} modules, v${version})`);
}
