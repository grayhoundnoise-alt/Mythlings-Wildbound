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

// Echo the starter placement this build baked in — if this line does not match
// src/ui/screens.js, the write below never happened (or you are looking at an
// older copy of the HTML).
{
  const sc = fs.readFileSync(path.join(root, 'src/ui/screens.js'), 'utf8');
  const val = (n) => { const m = new RegExp(`const ${n} = (-?\\d+)`).exec(sc); return m ? m[1] : '?'; };
  console.log(`  starter placement baked in: Mythling ${val('HD_STARTER_DX')}/${val('HD_STARTER_DY')}` +
    `, glow ${val('HD_STARTER_GLOW_DX')}/${val('HD_STARTER_GLOW_DY')}` +
    `, shadow ${val('HD_STARTER_SHADOW_DX')}/${val('HD_STARTER_SHADOW_DY')}`);
}

// ---- HD image assets --------------------------------------------------------
// file:// cannot fetch a sibling PNG, so the secret HD Images mode would quietly
// fall back to the animated rig in the offline build. Inline every asset the
// manifest lists as a base64 data URI, straight into the bundle.
const manifestSrc = fs.readFileSync(path.join(root, 'src/data/hdManifest.js'), 'utf8');
let jsOut = js;
let inlined = 0;
let inlinedBytes = 0;
for (const m of manifestSrc.matchAll(/src:\s*'([^']+)'/g)) {
  const file = path.join(root, m[1]);
  if (!fs.existsSync(file)) {
    console.warn(`  ! HD asset missing, left as a path: ${m[1]}`);
    continue;
  }
  const buf = fs.readFileSync(file);
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(file).toLowerCase()];
  if (!mime) {
    console.warn(`  ! HD asset has no known image type, left as a path: ${m[1]}`);
    continue;
  }
  const uri = `data:${mime};base64,${buf.toString('base64')}`;
  // The bundler keeps the manifest's string literals verbatim, so swapping the
  // path for the data URI is enough. replaceAll, not replace.
  jsOut = jsOut.split(m[1]).join(uri);
  inlined++;
  inlinedBytes += buf.length;
}

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
${jsOut}
</script>
</body>
</html>
`;

fs.writeFileSync(out, single);
const kb = (Buffer.byteLength(single) / 1024).toFixed(0);
console.log(`Wrote ${path.relative(root, out)} (${kb} KB) — double-click to play offline.`);
console.log(`  HD images inlined: ${inlined} asset(s), ${(inlinedBytes / 1024).toFixed(0)} KB of art.`);
