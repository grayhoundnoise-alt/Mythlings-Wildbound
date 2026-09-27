// Builds a single self-contained HTML file that runs by double-clicking it
// (file:// blocks ES modules, so everything is bundled + inlined).
//   node tools/build-standalone.mjs
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'MythlingsWildbound-Offline.html');

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome90', 'firefox90', 'safari15'],
  write: false,
  minify: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text;
const css = fs.readFileSync(path.join(root, 'src/ui/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// take the <body> markup from index.html so both versions never drift apart
const body = html.match(/<body>([\s\S]*?)<script/)[1].trim();

const single = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>Mythlings: Wildbound</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌿</text></svg>" />
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>
`;

fs.writeFileSync(out, single);
const kb = (Buffer.byteLength(single) / 1024).toFixed(0);
console.log(`Wrote ${path.relative(root, out)} (${kb} KB) — double-click to play offline.`);
