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

function get(key) {
  if (cache.has(key)) return cache.get(key);
  const url = HD_ASSETS[key];
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
  return Promise.all(Object.keys(HD_ASSETS).map((k) => load(HD_ASSETS[k])));
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
    const g = ctx.createRadialGradient(x, y + 3, 2, x, y + 3, 36 * s);
    g.addColorStop(0, 'rgba(6,16,10,0.75)');
    g.addColorStop(1, 'rgba(6,16,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 34 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.translate(x, y);
  ctx.scale(facing * s, s);

  // Feet at the origin, centred horizontally: the PNG is already cropped tight
  // to the creature, so it simply hangs up from the ground point.
  const src = flash > 0.01 ? tinted(img, flash) : img;
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  ctx.drawImage(src, -w / 2, -h, w, h);
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
