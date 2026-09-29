// Regenerates the rig-geometry table that MythlingEdit.html embeds.
//
// The image editor needs to know, for every Mythling form, the exact visual box
// the animated rig gives it — because HD stills are placed to match that box.
// Reading it out of creatureArt.js at build time keeps the two from drifting
// apart: change the rig, re-run this, the editor is right again.
//
//   node tools/gen-rig-bounds.mjs
import fs from 'node:fs';
import path from 'node:path';

// creatureArt and the rest touch window/canvas at import time.
globalThis.window = globalThis;
const shim = () => new Proxy(
  { canvas: { width: 300, height: 300 }, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
  { get: (o, k) => (k in o ? o[k] : undefined), set: (o, k, v) => { o[k] = v; return true; } },
);
globalThis.HTMLCanvasElement = class {
  constructor() { this.style = {}; this.width = 300; this.height = 300; }
  getContext() { return shim(); }
};

const root = path.resolve(import.meta.dirname, '..');
const { artFor, artContext, EXPRESSIONS } = await import(path.join(root, 'src/render/creatureArt.js'));
const { SPECIES, getEvolutionStage } = await import(path.join(root, 'src/data/species.js'));

const out = {};
let skipped = 0;
for (const sp of Object.values(SPECIES)) {
  for (let stage = 0; stage < sp.evolutions.length; stage++) {
    const art = artFor(sp.id);
    if (!art) { skipped++; continue; }
    const r = art.skel(artContext(sp.id, stage, EXPRESSIONS.neutral, {}));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const def of art.parts) {
      if (def.liveOnly) continue;                 // drawn live, never baked
      const [px, py, s = 1] = def.pivot(r);
      const [bx, by, bw, bh] = def.box || [0, 0, 1, 1];
      minX = Math.min(minX, px + bx * s); minY = Math.min(minY, py + by * s);
      maxX = Math.max(maxX, px + bx * s + bw * s); maxY = Math.max(maxY, py + by * s + bh * s);
    }
    if (!Number.isFinite(minX)) { skipped++; continue; }
    const evo = getEvolutionStage(sp.id, stage);
    out[`${sp.id}:${stage}`] = {
      x: +minX.toFixed(2), y: +minY.toFixed(2),
      w: +(maxX - minX).toFixed(2), h: +(maxY - minY).toFixed(2),
      cx: +((minX + maxX) / 2).toFixed(2), feetY: +maxY.toFixed(2),
      scale: +(evo.art?.scale ?? 1).toFixed(3),
    };
  }
}

const dest = path.join(root, 'assets/mythlings/rig-bounds.json');
fs.writeFileSync(dest, `${JSON.stringify(out, null, 0)}\n`);
console.log(`Wrote ${path.relative(root, dest)} — ${Object.keys(out).length} forms${skipped ? ` (${skipped} skipped)` : ''}.`);
