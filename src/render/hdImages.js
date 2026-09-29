// =============================================================================
// HD IMAGES — the secret image mode, and the single switch that picks between
// a pre-rendered PNG and the live animated creature rig.
//
// Off by default. When it is on, any Mythling (or battle background) that has a
// PNG in HD_ASSETS is drawn from that PNG; everything else keeps animating
// exactly as before, because a missing key is a normal state, not an error.
//
// The roaming overworld map deliberately does NOT go through here — a creature
// that walks and turns still needs the rig.
// =============================================================================
import { HD_ASSETS } from '../data/hdManifest.js';
import { getEvolutionStage } from '../data/species.js';
import { artFor, artContext, EXPRESSIONS } from './creatureArt.js';

// --- state -------------------------------------------------------------------
let enabled = false;
const cache = new Map();     // key -> HTMLImageElement (or null while it loads)

/** True when HD Images mode is on. */
export function hdEnabled() { return enabled; }

/**
 * Turn the mode on or off. Images are decoded on demand, so flipping this is
 * cheap; the caller is responsible for any loading screen it wants to show.
 */
export function setHdEnabled(on) { enabled = !!on; }

/** Drop every decoded image (used when toggling so nothing goes stale). */
export function clearHdCache() { cache.clear(); }

// --- loading -----------------------------------------------------------------
function load(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // a broken file must never break the game
    img.src = url;
  });
}

/** The src of an entry, whether it is a bare string or a { src } object. */
function srcOf(entry) {
  return typeof entry === 'string' ? entry : entry?.src;
}

/**
 * The file to load for a manifest key, for callers that want the picture
 * themselves rather than going through the loader — the main menu does.
 * Reading `.src` off the entry directly is easy to forget, and assigning the
 * whole entry to `img.src` silently yields "[object Object]".
 */
export function hdSrc(key) {
  return srcOf(HD_ASSETS[key]);
}

function get(key) {
  if (cache.has(key)) return cache.get(key);
  const url = srcOf(HD_ASSETS[key]);
  // No Image means no DOM (a test runner, a worker): report "no art" instead of
  // throwing, so the animated rig stays in charge.
  if (!url || typeof Image === 'undefined') { cache.set(key, null); return null; }
  const img = new Image();
  // `complete` means it already decoded (cached by the browser, or a data URI
  // the bundler inlined) — otherwise the load lands later this frame and the
  // first draw just uses the rig, which is harmless.
  if (img.complete && img.naturalWidth) { cache.set(key, img); return img; }
  cache.set(key, null);
  load(url).then((done) => { if (done) cache.set(key, done); });
  return null;
}

/**
 * Decode every asset up front, so turning the mode on never shows a half-empty
 * screen. Resolves even if some files are missing.
 */
export function preloadHdAssets() {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(Object.keys(HD_ASSETS).map((k) => load(srcOf(HD_ASSETS[k]))));
}

/** The per-asset placement an image declares, or null when it declares none. */
function entryFor(speciesId, stage) {
  const e = HD_ASSETS[`model:${speciesId}:${stage}`];
  return e && typeof e === 'object' ? e : null;
}

// --- lookups -----------------------------------------------------------------
/** The PNG for this exact form, or null to draw the animated rig instead. */
export function hdModelFor(speciesId, stage, mutation) {
  if (!enabled) return null;
  if (mutation && mutation !== 'none') return null;   // no variant art yet
  return get(`model:${speciesId}:${stage}`);
}

/** The battle background for a map theme, or null for the painted one. */
export function hdBackdropFor(theme) {
  if (!enabled) return null;
  return get(`bg:${theme}`);
}

// --- where the rig actually draws a Mythling ---------------------------------
/**
 * The visual box the rig gives a species, in its own unit space (where `size`
 * is 100 and the origin is the draw point). Computed by walking the same part
 * boxes creatureRig bakes, so a still can be dropped into exactly the footprint
 * the animated version would occupy — no per-species tuning, and no per-size
 * re-export of the art.
 */
const boundsCache = new Map();

function rigBounds(speciesId, stage) {
  const key = `${speciesId}:${stage}`;
  const hit = boundsCache.get(key);
  if (hit) return hit;

  let b = null;
  const art = artFor(speciesId);
  if (art) {
    const r = art.skel(artContext(speciesId, stage, EXPRESSIONS.neutral, {}));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const def of art.parts) {
      if (def.liveOnly) continue;                     // drawn live, not baked
      const [px, py, s = 1] = def.pivot(r);
      const [bx, by, bw, bh] = def.box || [0, 0, 1, 1];
      minX = Math.min(minX, px + bx * s); minY = Math.min(minY, py + by * s);
      maxX = Math.max(maxX, px + bx * s + bw * s); maxY = Math.max(maxY, py + by * s + bh * s);
    }
    if (Number.isFinite(minX)) {
      b = { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, feetY: maxY };
    }
  }
  boundsCache.set(key, b);
  return b;
}

/**
 * Where a still should be drawn, in rig unit space, for a given PNG.
 * Extracted (and exported) so the placement can be asserted in tests: getting
 * this wrong is invisible until a creature fills the screen, because nothing
 * about a canvas draw throws.
 */
/**
 * Where to draw a picture, in rig units, given the rig's box and the picture's
 * own declared height and anchor. Pulled out of `hdPlacement` as a pure
 * function so it can be reasoned about (and tested) on its own.
 *
 *   iw, ih  the picture's own pixel size
 *   b       the rig box { cx, feetY, ... }, or null when there is no rig
 *   height  how tall to draw it in units; 0 or less means "use the rig's height"
 *   anchor  a pixel inside the picture to stand on the rig's ground spot;
 *           omit it and the feet are assumed (bottom centre of the picture)
 */
export function placeImage(iw, ih, b, height = 0, anchor = null) {
  const aspect = iw / ih;
  if (!b) {
    // No rig geometry to match: stand a 100-unit-tall still on the origin.
    return { x: -50 * aspect, y: 0, w: 100 * aspect, h: 100, matched: false };
  }
  // Height is the asset's own when it declares one, otherwise the rig's box.
  // Either way it is a number of units, never the PNG's pixel size: one file
  // has to serve a 52px list icon and a 190px battle sprite.
  const h = Number(height) > 0 ? Number(height) : b.h;
  const w = h * aspect;
  // The anchor is a point inside the picture, in its own pixels, which is put
  // on the rig's ground spot. Default to the feet: the bottom centre of the
  // opaque area, which is what a standing creature wants.
  const ax = Number.isFinite(anchor?.x) ? anchor.x : iw / 2;
  const ay = Number.isFinite(anchor?.y) ? anchor.y : ih;
  return {
    x: b.cx - (ax / iw) * w,
    y: b.feetY - (ay / ih) * h,
    w, h, matched: true,
  };
}

export function hdPlacement(img, speciesId, stage = 0) {
  const e = entryFor(speciesId, stage);
  return placeImage(
    img.naturalWidth, img.naturalHeight,
    rigBounds(speciesId, stage),
    e?.height, e?.anchor,
  );
}

// --- art focus ---------------------------------------------------------------
// Where the artwork's visible mass actually sits inside its own pixels. The
// manifest anchor is the GROUND point and is never where a frame should centre:
// a picture with a sweeping tail has its silhouette left of the anchor and its
// body right of it. Panels frame the body, picture boxes balance the silhouette
// — and in every case the PANEL comes to the picture. The picture's placement
// (the manifest) never moves.
const focusCache = new WeakMap();

export function hdFocus(img) {
  if (!img || typeof document === 'undefined') return null;
  if (focusCache.has(img)) return focusCache.get(img);
  let out = null;
  try {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = iw; c.height = ih;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, iw, ih).data;
    const col = new Float64Array(iw);
    let x0 = iw, x1 = -1, y0 = ih, y1 = -1;
    for (let y = 0; y < ih; y++) {
      for (let x = 0; x < iw; x++) {
        if (d[(y * iw + x) * 4 + 3] > 128) {
          col[x]++;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) { focusCache.set(img, null); return null; }
    // The body is the tall columns (torso, head). Weighting by height squared
    // keeps a thin sweeping tail from dragging the frame point sideways.
    let maxc = 0;
    for (let x = x0; x <= x1; x++) if (col[x] > maxc) maxc = col[x];
    let sw = 0, sx = 0;
    for (let x = x0; x <= x1; x++) {
      if (col[x] >= maxc * 0.5) { const w = col[x] * col[x]; sw += w; sx += x * w; }
    }
    // The feet: the bottom band of the solid art — the place it stands.
    const band = Math.max(4, Math.round((y1 - y0) * 0.18));
    let fw = 0, fx = 0;
    for (let y = y1 - band; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (d[(y * iw + x) * 4 + 3] > 128) { fx += x; fw++; }
      }
    }
    out = {
      iw, ih,
      bodyX: sw ? sx / sw : (x0 + x1) / 2,
      feetX: fw ? fx / fw : (x0 + x1) / 2,
      feetY: y1,
      blockCx: (x0 + x1) / 2,
      blockCy: (y0 + y1) / 2,
    };
  } catch { out = null; }
  focusCache.set(img, out);
  return out;
}

/**
 * The focus point's offset (in the caller's px) from the point the picture
 * stands on, for a creature drawn at `sizePx`. `kind` picks which point a
 * caller needs: 'body' for a panel/pedestal, 'feet' for ground chrome,
 * 'block' for a frame around the picture itself. Null when there is no HD art
 * (the rig frames itself and must not be nudged).
 */
export function hdFocusOffset(speciesId, stage, mutation, sizePx, kind = 'body') {
  const img = hdModelFor(speciesId, stage, mutation);
  const f = img && hdFocus(img);
  const e = entryFor(speciesId, stage);
  if (!f || !e || !e.anchor) return null;
  const b = rigBounds(speciesId, stage);
  const hUnits = Number(e.height) > 0 ? Number(e.height) : (b ? b.h : 100);
  const evoScale = getEvolutionStage(speciesId, stage).art?.scale || 1;
  const scale = (hUnits * (sizePx / 100) * evoScale) / f.ih;
  const px = kind === 'block' ? f.blockCx : kind === 'feet' ? f.feetX : f.bodyX;
  const py = kind === 'block' ? f.blockCy : f.feetY;
  return { dx: (px - e.anchor.x) * scale, dy: (py - e.anchor.y) * scale };
}

// --- drawing -----------------------------------------------------------------
/**
 * Draw a Mythling from its PNG, matching the rig's contract: (x, y) is the
 * point its feet rest on, `size` is its height in the same units the rig uses,
 * and `facing` mirrors it left or right.
 *
 * `flash` (0..1) is the hit reaction the rig already computes — a crit is 1, a
 * normal hit 0.6. Rather than lose it with the animation, it becomes a red
 * wash over the still, so a critical still reads harder than a glancing one.
 */
export function drawHdModel(ctx, img, o) {
  const {
    x, y, size = 100, facing = 1, stage = 0, speciesId,
    pose = {}, shadow = true,
  } = o;
  const alpha = pose.alpha ?? 1;
  const flash = pose.flash ?? 0;
  // The rig also scales by the form's own art scale; match it so a Mythling
  // does not jump size when HD mode is switched on.
  const evoScale = speciesId ? (getEvolutionStage(speciesId, stage).art?.scale || 1) : 1;
  const s = (size / 100) * evoScale;

  ctx.save();
  ctx.globalAlpha *= alpha;

  if (shadow) {
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * 0.3;
    // The shadow may sit on its own spot (shadowX/shadowY): battle tuning wants
    // the Mythling to move without dragging its shadow along, and the shadow to
    // move without carrying the Mythling. Omitted, it stays under the ground
    // spot as always.
    const shx = o.shadowX ?? x, shy = (o.shadowY ?? y) + 3;
    const g = ctx.createRadialGradient(shx, shy, 2, shx, shy, 36 * s);
    g.addColorStop(0, 'rgba(6,16,10,0.75)');
    g.addColorStop(1, 'rgba(6,16,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(shx, shy, 34 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // `sink` drops the still (in rig units) without touching its shadow: battle
  // platforms want the feet planted into the ground ellipse for depth, while
  // the shadow stays where the ground spot is.
  ctx.translate(x, y);
  ctx.scale(facing * s, s);

  // Place the still inside the rig's own footprint: same height, same centre,
  // same foot line. The PNG's pixel size is deliberately ignored — it is only
  // artwork at whatever resolution it happens to be, and one file has to serve
  // a 52px list icon and a 190px battle sprite alike.
  const r = hdPlacement(img, speciesId, stage);
  const src = flash > 0.01 ? tinted(img, flash) : img;
  ctx.drawImage(src, r.x, r.y + (o.sink || 0), r.w, r.h);
  ctx.restore();
  return true;
}

// The hit wash is rebuilt for each step of the flash decay, which would mean a
// fresh canvas every frame. Quantise the strength and keep the variants.
const TINT_STEPS = 8;
const tintCache = new WeakMap();

/** A copy of `img` washed red, cached per strength step. */
function tinted(img, flash) {
  const step = Math.max(1, Math.min(TINT_STEPS, Math.ceil(flash * TINT_STEPS)));
  let byStep = tintCache.get(img);
  if (!byStep) { byStep = new Map(); tintCache.set(img, byStep); }
  const hit = byStep.get(step);
  if (hit) return hit;

  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cc = c.getContext('2d');
  cc.drawImage(img, 0, 0);
  // `source-atop` keeps the transparent margin clear, so the wash never paints
  // a box around the creature.
  cc.globalCompositeOperation = 'source-atop';
  cc.fillStyle = `rgba(255, 42, 34, ${(step / TINT_STEPS) * 0.85})`;
  cc.fillRect(0, 0, w, h);
  byStep.set(step, c);
  return c;
}
