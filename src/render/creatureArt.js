// =============================================================================
// MYTHLING CREATURE ART — LAYERED PARTS
// -----------------------------------------------------------------------------
// Every Mythling is still drawn procedurally (no external art, no sprite
// sheets) but the artwork is now authored as a small set of ANIMATION-READY
// LAYERS instead of one monolithic pass:
//
//   ROOT · BODY · HEAD · FRONT_LEG_L/R · BACK_LEG_L/R · TAIL (+ EAR_L/R,
//   WING_L/R, MANE where the species needs them)  ->  8-12 transforms total.
//
// Small detail work (fur tufts, leaf veins, scales, feathers, claws, markings,
// gems) is baked into the layer it belongs to — nothing below "major body
// part" ever gets its own bone.
//
// Each layer is:
//   * baked ONCE into a cached offscreen canvas (CreatureAssetLoader),
//   * re-composited every frame with a transform from CreatureAnimator.
//
// Layers are authored in the same unit space the whole game already uses
// (origin = the creature's feet, y negative = up, ~100 units tall at size 100)
// so they line up seamlessly at rest.
//
// `live` hooks keep a couple of signature details genuinely animated (Emberu's
// flame, Rivruff's water mane, gem pulses) without adding a single bone.
// =============================================================================
import { getSpecies, getEvolutionStage } from '../data/species.js';
import { getMutation } from '../data/mutations.js';
import { adjustColor, shadeColor } from '../core/utils.js';

// ------------------------------------------------------------------ palette
export function pal(speciesId, mutation) {
  const sp = getSpecies(speciesId);
  const base = sp.art;
  const mut = getMutation(mutation);
  const out = { ...base };
  if (mut.palette) {
    for (const [k, v] of Object.entries(base)) {
      out[k] = typeof v === 'string' && v.startsWith('#') ? adjustColor(v, mut.palette) : v;
    }
    if (mutation === 'shiny') out.eye = '#fffbe0';
    if (mutation === 'darkness') out.eye = '#d8b4ff';
  }
  out.light = shadeColor(out.primary, 0.22);
  out.shadow = shadeColor(out.primary, -0.26);
  out.deep = shadeColor(out.dark, -0.15);
  out.bellyShade = shadeColor(out.belly, -0.14);
  return out;
}

// ------------------------------------------------------------------ primitives
export function ell(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Ellipse with a soft top-light / bottom-shadow gradient: reads as volume. */
export function volume(ctx, x, y, rx, ry, top, bottom, rot = 0) {
  const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ell(ctx, x, y, rx, ry, g, rot);
}

export function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function line(ctx, x1, y1, x2, y2, color, w, cap = 'round') {
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = cap;
  ctx.stroke();
}

/** A leaf blade with a midrib and side veins. */
export function leaf(ctx, x, y, len, wid, angle, color, vein, veins = 3) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.36, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.36, wid, 0, 0);
  const g = ctx.createLinearGradient(0, -wid, len, wid);
  g.addColorStop(0, shadeColor(color, 0.12));
  g.addColorStop(1, shadeColor(color, -0.18));
  ctx.fillStyle = g; ctx.fill();
  if (vein) {
    ctx.strokeStyle = vein; ctx.lineWidth = Math.max(0.5, wid * 0.13);
    ctx.beginPath(); ctx.moveTo(len * 0.04, 0); ctx.lineTo(len * 0.92, 0); ctx.stroke();
    for (let i = 1; i <= veins; i++) {
      const p = (i / (veins + 1)) * len;
      const s = wid * 0.55 * (1 - i / (veins + 1.4));
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p + len * 0.12, -s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p + len * 0.12, s); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Tapered limb with an articulated paw. `bend` curves the knee. */
export function limb(ctx, x, y, len, w, color, pawColor, bend = 0, toes = 3) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.8 + bend, y + len * 0.55, x - w * 0.62, y + len);
  ctx.lineTo(x + w * 0.62, y + len);
  ctx.quadraticCurveTo(x + w * 0.8 + bend, y + len * 0.55, x + w, y);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - w, y, x + w, y);
  g.addColorStop(0, shadeColor(color, -0.16));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shadeColor(color, -0.24));
  ctx.fillStyle = g; ctx.fill();
  // paw
  ell(ctx, x, y + len, w * 1.18, w * 0.72, pawColor);
  ctx.fillStyle = shadeColor(pawColor, -0.3);
  for (let i = 0; i < toes; i++) {
    const tx = x - w * 0.6 + (i * w * 1.2) / (toes - 1 || 1);
    ell(ctx, tx, y + len + w * 0.3, w * 0.21, w * 0.18, ctx.fillStyle);
  }
  ctx.restore();
}

/** Ruff / tuft of fur along an arc — gives fur a material identity. */
export function furTufts(ctx, cx, cy, r, from, to, count, len, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = from + ((to - from) * i) / (count - 1 || 1);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const l = len * (0.7 + 0.5 * Math.sin(i * 2.1));
    poly(ctx, [
      [x, y],
      [x + Math.cos(a - 0.22) * l, y + Math.sin(a - 0.22) * l],
      [x + Math.cos(a + 0.3) * l * 0.62, y + Math.sin(a + 0.3) * l * 0.62],
    ], color);
  }
}

/** Translucent flowing water ribbon. */
export function waterRibbon(ctx, cx, cy, r, phase, color, width = 3, span = 1.5) {
  ctx.save();
  ctx.globalAlpha *= 0.55;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, phase, phase + span);
  ctx.stroke();
  ctx.restore();
}

/** Additive flame tongue. */
export function flame(ctx, x, y, h, w, t, seed = 0) {
  const wob = Math.sin(t * 7 + seed) * 0.12 + 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const layers = [
    { c: 'rgba(255,90,20,0.75)', s: 1.0 },
    { c: 'rgba(255,170,50,0.85)', s: 0.72 },
    { c: 'rgba(255,240,170,0.95)', s: 0.42 },
  ];
  for (const L of layers) {
    ctx.beginPath();
    ctx.moveTo(x - w * L.s, y);
    ctx.quadraticCurveTo(x - w * L.s * 1.1, y - h * L.s * 0.6 * wob, x + Math.sin(t * 5 + seed) * w * 0.4, y - h * L.s * wob);
    ctx.quadraticCurveTo(x + w * L.s * 1.1, y - h * L.s * 0.6 * wob, x + w * L.s, y);
    ctx.closePath();
    ctx.fillStyle = L.c; ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ face
export const EXPRESSIONS = {
  neutral:    { lid: 0.00, brow: 0.00, browY: 0.0, mouth: 0.15, pupil: 1.00, open: 0.00, eyeS: 1.00 },
  happy:      { lid: 0.40, brow: -0.15, browY: -1.0, mouth: 1.15, pupil: 1.05, open: 0.30, eyeS: 1.02 },
  angry:      { lid: 0.22, brow: 0.70, browY: 1.0, mouth: -0.85, pupil: 0.70, open: 0.20, eyeS: 0.92 },
  scared:     { lid: -0.15, brow: -0.60, browY: -1.5, mouth: -0.55, pupil: 1.45, open: 0.42, eyeS: 1.16 },
  surprised:  { lid: -0.25, brow: -0.80, browY: -3.0, mouth: 0.00, pupil: 1.25, open: 0.85, eyeS: 1.24 },
  determined: { lid: 0.34, brow: 0.50, browY: 0.5, mouth: -0.18, pupil: 0.85, open: 0.00, eyeS: 0.96 },
  sleepy:     { lid: 0.78, brow: -0.10, browY: 1.5, mouth: 0.25, pupil: 0.85, open: 0.12, eyeS: 0.90 },
};

/**
 * Eye with a species-specific shape.
 * shape: 'round' (curious) | 'almond' (clever) | 'sharp' (fierce) | 'droop' (calm) | 'bead' (bird)
 */
export function eye(ctx, x, y, r0, colour, shape = 'round', ex = EXPRESSIONS.neutral, dark = '#101821') {
  const r = r0 * (ex.eyeS ?? 1);
  const ry = r * (shape === 'almond' ? 0.82 : shape === 'sharp' ? 0.78 : shape === 'bead' ? 1.02 : 1.06);
  const rx = r * (shape === 'bead' ? 0.95 : 1.02);
  ctx.save();
  // socket
  ell(ctx, x, y, rx * 1.12, ry * 1.14, dark);
  ell(ctx, x, y, rx, ry, colour);
  // iris + pupil
  const pr = r * 0.42 * ex.pupil;
  ell(ctx, x + r * 0.06, y + r * 0.06, pr * 0.85, pr * 1.12, shadeColor(colour, -0.65));
  ell(ctx, x + r * 0.06, y + r * 0.06, pr * 0.5, pr * 0.78, '#0c1218');
  // specular
  ell(ctx, x - r * 0.34, y - r * 0.4, r * 0.26, r * 0.24, 'rgba(255,255,255,0.95)');
  ell(ctx, x + r * 0.3, y + r * 0.34, r * 0.13, r * 0.12, 'rgba(255,255,255,0.5)');
  // eyelid
  if (ex.lid > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 1.14, ry * 1.16, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = dark;
    ctx.fillRect(x - rx * 1.2, y - ry * 1.2, rx * 2.4, ry * 2.4 * ex.lid);
    ctx.restore();
  }
  // sharp eyes get an angular upper edge
  if (shape === 'sharp') {
    poly(ctx, [[x - rx * 1.15, y - ry * 1.1], [x + rx * 1.2, y - ry * 0.35], [x + rx * 1.2, y - ry * 1.1]], dark);
  }
  if (shape === 'droop') {
    poly(ctx, [[x - rx * 1.2, y - ry * 0.5], [x + rx * 1.2, y - ry * 1.05], [x + rx * 1.2, y - ry * 1.2], [x - rx * 1.2, y - ry * 1.2]], dark);
  }
  ctx.restore();
}

export function brow(ctx, x, y, w, ex, color, mirrored = false) {
  const tilt = ex.brow * (mirrored ? -1 : 1);
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.2, w * 0.22); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + ex.browY + tilt * 2.2);
  ctx.lineTo(x + w / 2, y + ex.browY - tilt * 2.2);
  ctx.stroke();
  ctx.restore();
}

/** Mouth curve: +1 smiling, -1 frowning, `open` adds a maw. */
export function mouth(ctx, x, y, w, ex, color, fangs = 0) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y + ex.mouth * w * 0.42, x + w / 2, y);
  ctx.stroke();
  if (ex.open > 0.15) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x, y + w * 0.75 * ex.open, x + w / 2, y);
    ctx.closePath();
    ctx.fillStyle = '#5b2130'; ctx.fill();
  }
  for (let i = 0; i < fangs; i++) {
    const fx = x - w * 0.28 + i * w * 0.56;
    poly(ctx, [[fx - w * 0.07, y], [fx + w * 0.07, y], [fx, y + w * 0.2]], '#fffdf3');
  }
  ctx.restore();
}

/** A closed eye (blink): socket + a single lash line. */
function closedEye(ctx, x, y, r, shape, dark = '#101821') {
  const rx = r * 1.02, ry = r * (shape === 'almond' ? 0.82 : shape === 'sharp' ? 0.78 : shape === 'bead' ? 1.02 : 1.06);
  ctx.save();
  ell(ctx, x, y, rx * 1.12, ry * 1.14, dark);
  ell(ctx, x, y, rx, ry, dark);
  ctx.strokeStyle = shadeColor(dark, 0.35);
  ctx.lineWidth = Math.max(1, r * 0.3);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - rx * 0.9, y - ry * 0.1);
  ctx.quadraticCurveTo(x, y + ry * 0.5, x + rx * 0.9, y - ry * 0.1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws the expression-dependent part of a head (eyes, brows, mouth) on top of
 * the baked head layer. Kept out of the texture so expressions, blinking and
 * eye-tracking stay live without re-baking 7 variants of every head.
 */
export function drawFace(ctx, c, face, spec, blink = 0) {
  const ex = face || EXPRESSIONS.neutral;
  const shut = blink > 0.55;
  for (const e of spec.eyes) {
    const col = e.color && e.color.charAt ? (c[e.color] || e.color) : e.color;
    if (shut) closedEye(ctx, e.x, e.y, e.r, e.shape, e.dark);
    else eye(ctx, e.x, e.y, e.r, col, e.shape, ex, e.dark);
  }
  for (const b of spec.brows) brow(ctx, b.x, b.y, b.w, ex, c.dark, !!b.mirror);
  if (spec.mouth && !shut) {
    const m = spec.mouth;
    mouth(ctx, m.x, m.y, m.w, ex, m.color, ex.mouth < 0 ? (m.fangs || 0) : 0);
  }
}

// =============================================================================
// SKELETON — shared quadruped anchors (tuned per species, derived here so every
// creature stands on the same ground line with believable limb length).
// =============================================================================
export function skeleton(ex, o = {}) {
  const g = ex.grow;
  return {
    g,
    legLen: (o.legLen ?? 21) + g * 7,       // ground clearance
    legW: o.legW ?? 5,
    hipX: o.hipX ?? -10,
    shoX: o.shoX ?? 8,
    bodyY: (o.bodyY ?? -34) - g * 4,
    headX: (o.headX ?? 21) + g * 4,
    headY: (o.headY ?? -56) - g * 9,
    headS: 1 - g * 0.1,
  };
}

/** Emberu's chest ember / forehead gem pulse (0..1) — shared by live hooks. */
export function gemPulse(t, excite = 0) {
  return 0.55 + Math.sin(t * 3.4) * 0.25 + excite * 0.2;
}

// =============================================================================
// PART LIBRARY
// -----------------------------------------------------------------------------
// part = { name, z, space, pivot(r)->[x,y,s], box:[dx,dy,w,h], draw, live? }
//   space 'creature' : draw() paints in absolute creature units
//   space 'local'    : draw() paints relative to pivot, scaled by s (head/ears/
//                      tail/legs/wings)
//   live()           : optional animated overlay, same local space as draw()
// =============================================================================

// -----------------------------------------------------------------------------
// SPRIGGO — Nature Fox.  Blade tail, shoulder sprouts, notched ears, vine
// bracers, seed pendant.  Brave, curious, energetic.
// -----------------------------------------------------------------------------
const SPRIGGO = {
  skel: (ex) => skeleton(ex, { legLen: 22, legW: 5.2 }),
  face: {
    eyes: [{ x: 6.4, y: -2.4, r: 4.0, shape: 'round', color: 'eye' },
           { x: -5.6, y: -2.4, r: 3.5, shape: 'round', color: 'eye' }],
    brows: [{ x: 6.4, y: -8, w: 7 }, { x: -5.6, y: -8, w: 6, mirror: true }],
    mouth: { x: 14, y: 8.4, w: 7.4, color: '#3a2a22', fangs: 2 },
  },
  parts: [
    { // ---- TAIL: one huge leaf blade sweeping up behind (silhouette hook)
      name: 'tail', z: 0, space: 'local',
      pivot: (r) => [r.hipX - 8, r.bodyY + 2],
      box: [-51, -64, 58, 72],
      draw(ctx, c, ex, r) {
        ctx.rotate(0.42);
        const tl = 46 + r.g * 20, tw = 19 + r.g * 8;
        line(ctx, 4, 2, -14, -7, c.dark, 5);          // stalk, rooted in the hip
        ctx.beginPath();
        ctx.moveTo(-9, -6);
        ctx.quadraticCurveTo(-tl * 0.38, -tw * 1.9, -tl, -tw * 1.25);
        ctx.quadraticCurveTo(-tl * 0.52, tw * 0.15, -9, -6);
        const tg = ctx.createLinearGradient(-9, -tw, -tl, 0);
        tg.addColorStop(0, shadeColor(c.accent, 0.12));
        tg.addColorStop(1, shadeColor(c.secondary, -0.02));
        ctx.fillStyle = tg; ctx.fill();
        ctx.strokeStyle = shadeColor(c.dark, 0.12); ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-11, -7); ctx.quadraticCurveTo(-tl * 0.5, -tw * 1.0, -tl + 3, -tw * 1.2); ctx.stroke();
        for (let i = 1; i <= 4; i++) {                 // veins
          const p = i / 5;
          const bx = -11 - (tl - 12) * p, by = -7 - tw * 0.95 * p;
          line(ctx, bx, by, bx - 5, by - tw * 0.42, shadeColor(c.dark, 0.12), 1);
        }
      },
    },
    // ---- far pair (behind the body)
    { name: 'legBL', z: 1, space: 'local', pivot: (r) => [r.hipX - 2, r.bodyY + 8], box: [-10, -4, 19, 40],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW * 0.92, c.shadow, c.secondary, -1.6) },
    { name: 'legFL', z: 1, space: 'local', pivot: (r) => [r.shoX + 5, r.bodyY + 8], box: [-10, -4, 19, 39],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.9, c.shadow, c.secondary, 1.4) },

    { // ---- BODY: haunch + chest + neck + belly fur + shoulder sprouts
      name: 'body', z: 2, space: 'creature',
      pivot: (r) => [0, r.bodyY],
      box: [-34, -38, 71, 60],
      draw(ctx, c, ex, r) {
        const g = r.g;
        volume(ctx, r.hipX, r.bodyY, 16 + g * 4, 15 + g * 3, c.light, c.shadow);
        volume(ctx, r.shoX, r.bodyY - 1, 17 + g * 4, 14 + g * 3, c.light, c.shadow);
        ctx.save();                                    // neck
        ctx.beginPath();
        ctx.moveTo(r.shoX + 2, r.bodyY - 10);
        ctx.quadraticCurveTo(r.headX - 4, r.bodyY - 16, r.headX - 1, r.headY + 9);
        ctx.lineTo(r.headX + 8, r.headY + 10);
        ctx.quadraticCurveTo(r.shoX + 16, r.bodyY - 12, r.shoX + 14, r.bodyY - 2);
        ctx.closePath();
        ctx.fillStyle = c.primary; ctx.fill();
        ctx.restore();
        ell(ctx, r.shoX + 3, r.bodyY + 5, 11 + g * 2, 8.6 + g, c.belly);
        furTufts(ctx, r.shoX + 3, r.bodyY + 3, 9, 0.2, 2.5, 5, 5, c.belly);
        // shoulder sprouts
        leaf(ctx, r.shoX - 8, r.bodyY - 13, 15 + g * 7, 5 + g, -1.25, c.accent, c.dark, 2);
        leaf(ctx, r.shoX - 1, r.bodyY - 14, 13 + g * 6, 4.4 + g, -0.82, c.primary, c.dark, 2);
        if (ex.stage >= 1) {
          leaf(ctx, r.hipX - 2, r.bodyY - 13, 14, 4.6, -1.6, c.accent, c.dark, 2);
          leaf(ctx, r.hipX + 6, r.bodyY - 15, 12, 4.2, -1.35, c.primary, c.dark, 2);
        }
        // seed pendant
        ell(ctx, r.shoX + 6, r.bodyY + 9, 2.8, 3.4, c.dark);
        ell(ctx, r.shoX + 6, r.bodyY + 8.4, 1.6, 2.0, c.accent);
      },
    },

    // ---- near pair (in front of the body) + vine bracers
    { name: 'legBR', z: 3, space: 'local', pivot: (r) => [r.hipX + 4, r.bodyY + 9], box: [-10, -4, 20, 41],
      draw(ctx, c, ex, r) {
        limb(ctx, 0, 0, r.legLen, r.legW, c.primary, c.belly, -1.4);
        vineBracer(ctx, c, r.legW);
      } },
    { name: 'legFR', z: 3, space: 'local', pivot: (r) => [r.shoX + 11, r.bodyY + 9], box: [-10, -6, 21, 42],
      draw(ctx, c, ex, r) {
        limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.96, c.primary, c.belly, 1.2);
        vineBracer(ctx, c, r.legW);
        leaf(ctx, 3, 5, 8, 3, -1.15, c.accent, null, 1);
      } },

    // ---- ears (own bones: they flick and fold)
    { name: 'earL', z: 3.5, space: 'local', pivot: (r) => [r.headX - 7 * r.headS, r.headY - 7 * r.headS, r.headS],
      box: [-14, -28, 22, 32],
      draw(ctx, c) {
        ctx.translate(7, 7);                         // ear base -> part origin
        poly(ctx, [[-7, -7], [-17, -31], [-10, -27], [-3, -11]], c.secondary);
        poly(ctx, [[-7.6, -9], [-13.5, -26], [-6.5, -15]], c.accent);
      } },
    { name: 'earR', z: 3.5, space: 'local', pivot: (r) => [r.headX + 7 * r.headS, r.headY - 8 * r.headS, r.headS],
      box: [-4, -26, 18, 31],
      draw(ctx, c) {
        ctx.translate(-7, 8);
        poly(ctx, [[7, -8], [17, -30], [16, -22], [14, -24], [13, -7]], c.secondary);
        poly(ctx, [[8, -9], [14, -24], [12.6, -11]], c.accent);
      } },

    { // ---- HEAD (face is drawn live on top by the rig)
      name: 'head', z: 4, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS],
      box: [-24, -35, 50, 55],
      draw(ctx, c, ex, r) {
        if (ex.horns) {
          for (let i = -1; i <= 1; i++) {
            poly(ctx, [[i * 7 - 2, -13], [i * 7 + 0.6, -27 - (1 - Math.abs(i)) * 6], [i * 7 + 3.4, -12]], c.dark);
          }
        }
        volume(ctx, 0, -2, 14.5, 12.8, c.light, c.shadow);      // skull
        volume(ctx, 11, 4, 10, 6.6, shadeColor(c.primary, 0.08), c.shadow); // muzzle
        ell(ctx, 13, 6, 7.6, 4.4, c.belly);
        furTufts(ctx, -7, 2, 10, 1.4, 3.2, 4, 5, c.belly);
        ell(ctx, 19, 3.4, 2.6, 2.1, '#2b2b2b');                  // nose
        ell(ctx, 18.6, 2.8, 0.9, 0.7, 'rgba(255,255,255,.55)');
        leaf(ctx, -11, 3, 8.5, 3.2, 0.5, c.accent, null, 1);     // cheek leaf
      },
    },
  ],
};

/** Vine bracers wrapped around a near leg (drawn in leg-local space). */
function vineBracer(ctx, c, w) {
  ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8;
  const rr = 5.6 * (w / 5.2);
  ctx.beginPath(); ctx.arc(0, 9, rr, 0.15, 2.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 15, rr * 0.93, 0.3, 2.7); ctx.stroke();
}

// -----------------------------------------------------------------------------
// AQUINI — Water Feline.  Translucent fin-ears, crescent tail, gill flashes,
// dorsal fin, streamlined build.  Clever, playful, fast.
// -----------------------------------------------------------------------------
const AQUINI = {
  skel: (ex) => skeleton(ex, { legLen: 20, legW: 4.4, bodyY: -32, headY: -54 }),
  face: {
    eyes: [{ x: 6.2, y: -2.4, r: 4.1, shape: 'almond', color: 'eye' },
           { x: -5.8, y: -2.4, r: 3.6, shape: 'almond', color: 'eye' }],
    brows: [{ x: 6.2, y: -8, w: 7 }, { x: -5.8, y: -8, w: 6, mirror: true }],
    mouth: { x: 13, y: 7.4, w: 6.6, color: '#23404d' },
  },
  parts: [
    { // ---- TAIL: S-curve ending in a crescent fin
      name: 'tail', z: 0, space: 'local',
      pivot: (r) => [r.hipX - 10, r.bodyY + 4],
      box: [-77, -58, 82, 72],
      draw(ctx, c, ex, r) {
        const L = 30 + r.g * 12;
        ctx.beginPath();                              // tapered tail body
        ctx.moveTo(0, 5);
        ctx.bezierCurveTo(-L * 0.6, 10, -L * 1.0, -6, -L * 1.15, -22 - r.g * 8);
        ctx.lineTo(-L * 0.92, -22 - r.g * 8);
        ctx.bezierCurveTo(-L * 0.8, -6, -L * 0.45, 4, 0, -3);
        ctx.closePath();
        const tg = ctx.createLinearGradient(0, 0, -L, -20);
        tg.addColorStop(0, c.primary); tg.addColorStop(1, c.secondary);
        ctx.fillStyle = tg; ctx.fill();
        // crescent fin at the tip (two lobes, like a fish fluke)
        ctx.save();
        ctx.globalAlpha *= 0.72;
        ctx.beginPath();
        ctx.moveTo(-L * 1.03, -21 - r.g * 8);
        ctx.bezierCurveTo(-L * 1.5, -40 - r.g * 14, -L * 1.75, -30 - r.g * 11, -L * 1.34, -19 - r.g * 7);
        ctx.bezierCurveTo(-L * 1.62, -16 - r.g * 5, -L * 1.5, -2 - r.g * 2, -L * 1.05, -13 - r.g * 5);
        ctx.closePath();
        const fg = ctx.createLinearGradient(-L * 1.0, -34, -L * 1.5, -6);
        fg.addColorStop(0, shadeColor(c.accent, 0.15));
        fg.addColorStop(1, c.accent);
        ctx.fillStyle = fg; ctx.fill();
        ctx.strokeStyle = shadeColor(c.secondary, 0.1); ctx.lineWidth = 0.9;
        for (let i = 0; i < 3; i++) {
          line(ctx, -L * 1.06, -20 - r.g * 7, -L * (1.3 + i * 0.1), -30 - r.g * 10 + i * 9, ctx.strokeStyle, 0.9);
        }
        ctx.restore();
      },
    },
    { name: 'legBL', z: 1, space: 'local', pivot: (r) => [r.hipX - 1, r.bodyY + 7], box: [-9, -4, 18, 38],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW * 0.92, c.shadow, c.secondary, -1.3) },
    { name: 'legFL', z: 1, space: 'local', pivot: (r) => [r.shoX + 5, r.bodyY + 7], box: [-9, -4, 17, 36],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 2, r.legW * 0.9, c.shadow, c.secondary, 1.1) },

    { // ---- long low torso
      name: 'body', z: 2, space: 'creature', pivot: (r) => [0, r.bodyY], box: [-32, -36, 69, 55],
      draw(ctx, c, ex, r) {
        const g = r.g;
        volume(ctx, r.hipX, r.bodyY, 15 + g * 3.5, 12.5 + g * 2.5, c.light, c.shadow);
        volume(ctx, r.shoX, r.bodyY - 1, 15.5 + g * 3.5, 12 + g * 2.5, c.light, c.shadow);
        ctx.save();                                    // neck
        ctx.beginPath();
        ctx.moveTo(r.shoX + 2, r.bodyY - 9);
        ctx.quadraticCurveTo(r.headX - 4, r.bodyY - 14, r.headX - 2, r.headY + 9);
        ctx.lineTo(r.headX + 7, r.headY + 10);
        ctx.quadraticCurveTo(r.shoX + 15, r.bodyY - 11, r.shoX + 13, r.bodyY - 1);
        ctx.closePath(); ctx.fillStyle = c.primary; ctx.fill();
        ctx.restore();
        ell(ctx, r.shoX + 2, r.bodyY + 4, 10 + g * 2, 6.8 + g, c.belly);
        ctx.lineCap = 'round';                          // wave stripes
        for (let i = 0; i < 3; i++) {
          const bx = r.hipX - 4 + i * 8;
          ctx.beginPath();
          ctx.moveTo(bx, r.bodyY - 11);
          ctx.quadraticCurveTo(bx + 3.5, r.bodyY - 6, bx, r.bodyY - 1);
          ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8; ctx.stroke();
        }
        ctx.save(); ctx.globalAlpha *= 0.9;             // dorsal fin
        poly(ctx, [[r.hipX + 6, r.bodyY - 12], [r.hipX + 12, r.bodyY - 26 - g * 6], [r.hipX + 17, r.bodyY - 11]], c.accent);
        ctx.restore();
      },
    },
    { name: 'legBR', z: 3, space: 'local', pivot: (r) => [r.hipX + 5, r.bodyY + 8], box: [-15, -4, 24, 38],
      draw(ctx, c, ex, r) {
        limb(ctx, 0, 0, r.legLen, r.legW, c.primary, c.belly, -1.2);
        poly(ctx, [[-4, 12], [-11, 7], [-4, 6]], c.accent);
      } },
    { name: 'legFR', z: 3, space: 'local', pivot: (r) => [r.shoX + 11, r.bodyY + 8], box: [-14, -4, 23, 36],
      draw(ctx, c, ex, r) {
        limb(ctx, 0, 0, r.legLen - 2, r.legW * 0.96, c.primary, c.belly, 1.0);
        poly(ctx, [[-4, 11], [-10, 6], [-4, 5]], c.accent);
      } },

    // ---- translucent fin-ears (webbing + core), own bones so they flick
    { name: 'earL', z: 3.5, space: 'local', pivot: (r) => [r.headX - 6 * r.headS, r.headY - 9 * r.headS, r.headS],
      box: [-24, -29, 31, 38],
      draw(ctx, c, ex, r) {
        ctx.save();
        ctx.globalAlpha *= 0.68;
        ctx.beginPath();
        ctx.translate(6, 9);
        ctx.moveTo(-6, -9);
        ctx.quadraticCurveTo(-26, -27 - r.g * 6, -22, -4);
        ctx.quadraticCurveTo(-14, -10, -3, -11);
        ctx.closePath(); ctx.fillStyle = c.accent; ctx.fill();
        ctx.restore();
        poly(ctx, [[-7, -8], [-15, -24 - r.g * 4], [-2, -12]], c.secondary);
        line(ctx, -9, -11, -19, -18, shadeColor(c.accent, -0.2), 1);
      } },
    { name: 'earR', z: 3.5, space: 'local', pivot: (r) => [r.headX + 6 * r.headS, r.headY - 10 * r.headS, r.headS],
      box: [-6, -28, 28, 40],
      draw(ctx, c, ex, r) {
        ctx.save();
        ctx.globalAlpha *= 0.68;
        ctx.beginPath();
        ctx.translate(-6, 10);
        ctx.moveTo(6, -10);
        ctx.quadraticCurveTo(24, -25 - r.g * 6, 20, -2);
        ctx.quadraticCurveTo(13, -9, 4, -11);
        ctx.closePath(); ctx.fillStyle = c.accent; ctx.fill();
        ctx.restore();
        poly(ctx, [[6, -9], [15, -23 - r.g * 4], [14, -6]], c.secondary);
        line(ctx, 9, -11, 18, -16, shadeColor(c.accent, -0.2), 1);
      } },

    { name: 'head', z: 4, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS], box: [-17, -34, 47, 48],
      draw(ctx, c, ex, r) {
        if (ex.horns) {
          ctx.save(); ctx.globalAlpha *= 0.85;
          poly(ctx, [[-3, -12], [2, -32], [6, -19], [10, -28], [11, -11]], c.accent);
          ctx.restore();
        }
        volume(ctx, 0, -2, 13.4, 11.8, c.light, c.shadow);
        volume(ctx, 10, 3.6, 9, 5.8, shadeColor(c.primary, 0.08), c.shadow);
        ell(ctx, 11.5, 5.2, 6.8, 3.8, c.belly);
        ell(ctx, 17.4, 3, 2.3, 1.8, '#22404f');                   // nose
        ctx.strokeStyle = c.accent;                               // gill flashes
        for (let i = 0; i < 3; i++) line(ctx, -13 + i * 1.6, 0 + i * 3, -7 + i * 1.6, 1 + i * 3, c.accent, 1.5);
        line(ctx, 14, 3.4, 26, 0, 'rgba(255,255,255,0.72)', 0.9); // whiskers
        line(ctx, 14, 5.6, 26, 8, 'rgba(255,255,255,0.72)', 0.9);
      },
    },
  ],
};

// -----------------------------------------------------------------------------
// EMBERU — Fire Dragon.  Swept horns with ember tips, ember gems, membraned
// wings, flame tail.  Confident, mischievous, fierce.
// -----------------------------------------------------------------------------
const emberuWing = (scale, alpha) => (ctx, c, ex, r) => {
  ctx.save();
  ctx.rotate(0.5);
  ctx.globalAlpha *= alpha;
  const W = scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-24 * W, -22 * W, -52 * W, -16 * W);
  ctx.quadraticCurveTo(-40 * W, -4 * W, -34 * W, 12 * W);
  ctx.quadraticCurveTo(-26 * W, 4 * W, -16 * W, 8 * W);
  ctx.quadraticCurveTo(-12 * W, 2 * W, 0, 0);
  ctx.closePath();
  const wg = ctx.createLinearGradient(0, 0, -46 * W, -16 * W);
  wg.addColorStop(0, shadeColor(c.secondary, -0.2));
  wg.addColorStop(1, shadeColor(c.dark, 0.1));
  ctx.fillStyle = wg; ctx.fill();
  ctx.fillStyle = 'rgba(255,186,110,0.34)'; ctx.fill();
  ctx.strokeStyle = c.deep; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(-(18 + i * 10) * W, (-22 + i * 11) * W);
    ctx.stroke();
  }
  ctx.restore();
};

const EMBERU = {
  skel: (ex) => skeleton(ex, { legLen: 20, legW: 6, bodyY: -35, headY: -58 }),
  face: {
    eyes: [{ x: 6.8, y: -1.6, r: 3.9, shape: 'sharp', color: 'eye' },
           { x: -5.6, y: -1.6, r: 3.4, shape: 'sharp', color: 'eye' }],
    brows: [{ x: 6.8, y: -7.2, w: 7.4 }, { x: -5.6, y: -7.2, w: 6.4, mirror: true }],
    mouth: { x: 15, y: 8.6, w: 8.4, color: '#4a1a10', fangs: 2 },
  },
  parts: [
    { name: 'wingL', z: 0, space: 'local', pivot: (r) => [r.hipX + 12, r.bodyY - 14 - r.g * 4],
      box: [-24, -24, 28, 28], draw: emberuWing(0.52, 0.9) },
    { name: 'wingR', z: 0.5, space: 'local', pivot: (r) => [r.hipX + 14, r.bodyY - 15 - r.g * 4],
      box: [-48, -49, 52, 53], draw: (ctx, c, ex, r) => emberuWing(ex.wings ? 1.15 : 0.5, 1)(ctx, c, ex, r) },

    { // ---- TAIL (flame tip is a live overlay so the fire stays alive)
      name: 'tail', z: 1, space: 'local', pivot: (r) => [r.hipX - 8, r.bodyY + 4],
      box: [-49, -15, 54, 30],
      draw(ctx, c, ex, r) {
        ctx.rotate(-0.25);
        const TL = 30 + r.g * 12;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.quadraticCurveTo(-TL * 0.7, 4, -TL, -12 - r.g * 6);
        ctx.quadraticCurveTo(-TL * 0.62, -6, 0, -6);
        ctx.closePath();
        const tg = ctx.createLinearGradient(0, 0, -TL, -12);
        tg.addColorStop(0, c.primary); tg.addColorStop(1, c.secondary);
        ctx.fillStyle = tg; ctx.fill();
        for (let i = 0; i < 3; i++) {
          poly(ctx, [[-8 - i * 8, -4 - i * 2.4], [-11 - i * 8, -12 - i * 3], [-15 - i * 8, -4 - i * 2.4]], c.dark);
        }
      },
      live(ctx, c, ex, r, t) {
        const TL = 30 + r.g * 12;
        const heat = 1 + (ex.excite || 0) * 0.8;
        ctx.rotate(-0.25);
        flame(ctx, -TL - 2, -13 - r.g * 6, (20 + r.g * 10) * heat, (8 + r.g * 3) * heat, t, 1.2);
      },
    },
    { name: 'legBL', z: 2, space: 'local', pivot: (r) => [r.hipX - 2, r.bodyY + 8], box: [-11, -4, 21, 39],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW * 0.95, c.shadow, c.secondary, -1.7, 3) },
    { name: 'legFL', z: 2, space: 'local', pivot: (r) => [r.shoX + 5, r.bodyY + 8], box: [-11, -4, 21, 38],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.92, c.shadow, c.secondary, 1.5, 3) },

    { // ---- barrel chest
      name: 'body', z: 3, space: 'creature', pivot: (r) => [0, r.bodyY], box: [-35, -33, 73, 56],
      draw(ctx, c, ex, r) {
        const g = r.g;
        volume(ctx, r.hipX, r.bodyY, 17 + g * 4, 15.5 + g * 3, c.light, c.shadow);
        volume(ctx, r.shoX, r.bodyY - 2, 18 + g * 4, 15 + g * 3, c.light, c.shadow);
        ctx.save();                                   // thick neck
        ctx.beginPath();
        ctx.moveTo(r.shoX + 2, r.bodyY - 12);
        ctx.quadraticCurveTo(r.headX - 6, r.bodyY - 18, r.headX - 3, r.headY + 10);
        ctx.lineTo(r.headX + 9, r.headY + 11);
        ctx.quadraticCurveTo(r.shoX + 18, r.bodyY - 14, r.shoX + 16, r.bodyY - 2);
        ctx.closePath(); ctx.fillStyle = c.primary; ctx.fill();
        ctx.restore();
        ell(ctx, r.shoX + 4, r.bodyY + 4, 11.5 + g * 2, 10 + g, c.belly);
        ctx.strokeStyle = c.bellyShade; ctx.lineWidth = 1.2;   // belly plates
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(r.shoX - 3, r.bodyY + 4 + i * 3.8);
          ctx.quadraticCurveTo(r.shoX + 4, r.bodyY + 6 + i * 3.8, r.shoX + 12, r.bodyY + 4 + i * 3.8);
          ctx.stroke();
        }
        for (let i = 0; i < 4; i++) {                          // dorsal ridge
          const bx = r.hipX - 6 + i * 9;
          poly(ctx, [[bx, r.bodyY - 13 + i * 1.2], [bx + 4, r.bodyY - 25 - g * 4 + i], [bx + 8, r.bodyY - 12 + i * 1.2]], c.dark);
        }
        poly(ctx, [[r.shoX + 6, r.bodyY - 3.5], [r.shoX + 9.4, r.bodyY + 1], [r.shoX + 6, r.bodyY + 5.5], [r.shoX + 2.6, r.bodyY + 1]], '#ff8a2a');
      },
      live(ctx, c, ex, r, t) {                                  // chest ember gem pulse
        ctx.save();
        ctx.globalAlpha *= gemPulse(t, ex.excite);
        ell(ctx, r.shoX + 6, r.bodyY + 1, 5.6, 6, '#ffdc8a');
        ctx.restore();
      },
    },
    { name: 'legBR', z: 4, space: 'local', pivot: (r) => [r.hipX + 5, r.bodyY + 9], box: [-11, -4, 22, 39],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW, c.primary, c.belly, -1.5, 3) },
    { name: 'legFR', z: 4, space: 'local', pivot: (r) => [r.shoX + 12, r.bodyY + 9], box: [-11, -4, 22, 38],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.96, c.primary, c.belly, 1.3, 3) },

    { name: 'head', z: 6, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS], box: [-25, -28, 52, 43],
      draw(ctx, c, ex, r) {
        const g = r.g;
        const horn = (sx, scale) => {
          const len = (26 + g * 10) * scale, base = (8 + g * 2) * scale;
          const tipX = sx - len * 0.78, tipY = -len * 0.72;   // sweeps back over the skull
          ctx.beginPath();
          ctx.moveTo(sx + base * 0.45, -7);
          ctx.quadraticCurveTo(sx - len * 0.12, -len * 0.82, tipX, tipY);
          ctx.quadraticCurveTo(sx - len * 0.3, -len * 0.34, sx - base * 0.5, -5);
          ctx.closePath();
          const hg = ctx.createLinearGradient(sx, -4, tipX, tipY);
          hg.addColorStop(0, shadeColor(c.dark, 0.2));
          hg.addColorStop(0.75, c.deep);
          hg.addColorStop(1, shadeColor(c.secondary, -0.1));
          ctx.fillStyle = hg; ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
          for (let i = 1; i <= 3; i++) {
            const p = i / 4.2;
            const px = sx + (tipX - sx) * p, py = -len * 0.74 * p - 5;
            line(ctx, px, py - base * 0.22, px + base * 0.18, py + base * (0.4 - p * 0.24), 'rgba(0,0,0,.22)', 1);
          }
        };
        horn(6.5, 0.9);    // near horn, long
        horn(-3.5, 0.72);  // far horn, shorter + offset (reads as depth)
        volume(ctx, 0, -2, 15, 13.2, c.light, c.shadow);
        poly(ctx, [[-13, -5], [0, -13], [13, -5], [0, -8]], shadeColor(c.primary, -0.1));  // brow ridge
        volume(ctx, 12, 4, 10.6, 7.2, shadeColor(c.primary, 0.05), c.shadow);
        ell(ctx, 14, 6.4, 7.8, 4.4, c.belly);
        ell(ctx, 19.5, 3, 1.7, 1.4, '#3a1a10');
        poly(ctx, [[1, -14.4], [4, -10], [1, -5.6], [-2, -10]], '#ff8a2a');   // forehead gem
        ctx.fillStyle = shadeColor(c.secondary, 0.12);
        for (let i = 0; i < 3; i++) ell(ctx, -10 + i * 2.2, 3 + i * 2.6, 1.6, 1.2, ctx.fillStyle);
      },
      live(ctx, c, ex, r, t) {
        const g = r.g;
        const pulse = gemPulse(t, ex.excite);
        ctx.save();
        ctx.globalAlpha *= pulse;
        ell(ctx, 1, -10, 4.6, 5, '#ffe28a');                  // forehead gem glow
        ctx.globalCompositeOperation = 'lighter';
        const len = (26 + g * 10) * 0.9, sx = 6.5;
        const tipX = sx - len * 0.78, tipY = -len * 0.72;
        ell(ctx, tipX + 1.2, tipY + 1.2, 3.0, 3.4, '#ff9a3c');   // near horn ember tip
        ell(ctx, tipX + 1.2, tipY + 1.2, 1.4, 1.8, '#ffe8a8');
        const l2 = (26 + g * 10) * 0.72, sx2 = -3.5;
        ell(ctx, sx2 - l2 * 0.78 + 1.2, -l2 * 0.72 + 1.2, 2.4, 2.8, '#ff9a3c');
        ctx.restore();
        // smoke puff from the nostril
        ctx.save();
        ctx.globalAlpha *= 0.3;
        ell(ctx, 23 + Math.sin(t * 2) * 2, 1 - ((t * 7) % 9), 3, 2.4, '#e6e6e6');
        ctx.restore();
      },
    },
  ],
};

// -----------------------------------------------------------------------------
// RIVRUFF — Water Wolf.  Living water mane, slab paws, curling wave tail,
// layered fur, droopy ears.  Calm, sleepy, immovable.
// -----------------------------------------------------------------------------
const RIVRUFF = {
  skel: (ex) => skeleton(ex, { legLen: 19, legW: 7, bodyY: -34, headY: -56, headX: 19 }),
  face: {
    eyes: [{ x: 6.8, y: -2, r: 3.7, shape: 'droop', color: 'eye' },
           { x: -5.2, y: -2, r: 3.3, shape: 'droop', color: 'eye' }],
    brows: [{ x: 6.8, y: -7.6, w: 7 }, { x: -5.2, y: -7.6, w: 6, mirror: true }],
    mouth: { x: 15, y: 9.4, w: 7.8, color: '#26323f' },
  },
  parts: [
    { // ---- TAIL: curling wave crest
      name: 'tail', z: 0, space: 'local', pivot: (r) => [r.hipX - 12, r.bodyY + 4],
      box: [-61, -56, 66, 70],
      draw(ctx, c, ex, r) {
        const TL = 30 + r.g * 12;
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.bezierCurveTo(-TL * 0.7, 10, -TL * 1.25, -4, -TL * 1.1, -22 - r.g * 8);
        ctx.bezierCurveTo(-TL * 0.95, -32 - r.g * 10, -TL * 0.6, -24, -TL * 0.55, -14);
        ctx.bezierCurveTo(-TL * 0.5, -4, -TL * 0.3, 0, 0, -4);
        ctx.closePath();
        const tg = ctx.createLinearGradient(0, 6, -TL, -24);
        tg.addColorStop(0, c.secondary); tg.addColorStop(1, shadeColor(c.accent, -0.02));
        ctx.fillStyle = tg; ctx.fill();
        ctx.save();                                    // curling foam crest
        ctx.beginPath();
        ctx.moveTo(-TL * 1.12, -18 - r.g * 7);
        ctx.bezierCurveTo(-TL * 1.35, -34 - r.g * 11, -TL * 0.72, -40 - r.g * 12, -TL * 0.6, -24 - r.g * 7);
        ctx.bezierCurveTo(-TL * 0.72, -31 - r.g * 9, -TL * 1.0, -28 - r.g * 8, -TL * 0.92, -16 - r.g * 5);
        ctx.closePath();
        const fg = ctx.createLinearGradient(-TL, -36, -TL * 0.7, -14);
        fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, shadeColor(c.accent, 0.18));
        ctx.fillStyle = fg; ctx.fill();
        ctx.restore();
      },
      live(ctx, c, ex, r, t) {                          // foam bubbles ride the crest
        const TL = 30 + r.g * 12;
        ctx.save();
        ctx.globalAlpha *= 0.8;
        for (let i = 0; i < 3; i++) {
          ell(ctx, -TL * (1.15 + i * 0.06), -30 - r.g * 9 - i * 5 + Math.sin(t * 2 + i) * 2, 2.4 - i * 0.4, 2.8 - i * 0.4, '#eaf7ff');
        }
        ctx.restore();
      },
    },
    { name: 'legBL', z: 1, space: 'local', pivot: (r) => [r.hipX - 3, r.bodyY + 8], box: [-12, -4, 24, 39],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW * 0.95, c.shadow, c.secondary, -1.8, 4) },
    { name: 'legFL', z: 1, space: 'local', pivot: (r) => [r.shoX + 5, r.bodyY + 8], box: [-12, -4, 23, 38],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.92, c.shadow, c.secondary, 1.6, 4) },

    { // ---- heavy torso
      name: 'body', z: 2, space: 'creature', pivot: (r) => [0, r.bodyY], box: [-39, -36, 76, 62],
      draw(ctx, c, ex, r) {
        const g = r.g;
        volume(ctx, r.hipX, r.bodyY, 19 + g * 4.5, 16 + g * 3.5, c.light, c.shadow);
        volume(ctx, r.shoX, r.bodyY - 2, 19 + g * 4.5, 16 + g * 3.5, c.light, c.shadow);
        ctx.save();                                        // short thick neck
        ctx.beginPath();
        ctx.moveTo(r.shoX + 2, r.bodyY - 12);
        ctx.quadraticCurveTo(r.headX - 6, r.bodyY - 18, r.headX - 3, r.headY + 10);
        ctx.lineTo(r.headX + 10, r.headY + 11);
        ctx.quadraticCurveTo(r.shoX + 19, r.bodyY - 14, r.shoX + 17, r.bodyY - 2);
        ctx.closePath(); ctx.fillStyle = c.primary; ctx.fill();
        ctx.restore();
        ell(ctx, r.shoX + 4, r.bodyY + 5, 12.5 + g * 2, 10 + g, c.belly);
        furTufts(ctx, r.hipX + 2, r.bodyY - 2, 19 + g * 3, -2.95, -0.55, 7, 7.5, shadeColor(c.primary, -0.14));
        furTufts(ctx, r.hipX - 10, r.bodyY + 8, 9, 0.6, 2.4, 4, 6, c.belly);
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {                      // aquatic flank marks
          ctx.beginPath();
          ctx.moveTo(r.hipX - 5 + i * 10, r.bodyY - 9);
          ctx.quadraticCurveTo(r.hipX + i * 10, r.bodyY - 4, r.hipX - 5 + i * 10, r.bodyY + 1);
          ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.stroke();
        }
      },
    },
    { name: 'legBR', z: 3, space: 'local', pivot: (r) => [r.hipX + 5, r.bodyY + 9], box: [-12, -4, 25, 39],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW, c.primary, c.belly, -1.6, 4) },
    { name: 'legFR', z: 3, space: 'local', pivot: (r) => [r.shoX + 13, r.bodyY + 9], box: [-12, -4, 24, 38],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.96, c.primary, c.belly, 1.4, 4) },

    { // ---- WATER MANE: redrawn live so the ribbons keep flowing
      name: 'mane', z: 3.6, space: 'creature', pivot: (r) => [r.shoX - 1, r.bodyY - 12], liveOnly: true,
      box: [-41, -42, 81, 75],
      draw(ctx, c, ex, r, t) {
        const phase = t * 1.4;
        const mx = r.shoX - 1, my = r.bodyY - 12;
        const maneR = 21 + r.g * 6;
        ctx.save();
        ctx.beginPath();
        const lobes = 9;
        for (let i = 0; i <= lobes; i++) {
          const a = Math.PI * 0.96 + (Math.PI * 1.2 * i) / lobes;
          const wob = 1 + 0.17 * Math.sin(i * 2.3 + phase);
          const rr = maneR * (i % 2 ? 1.28 : 1.0) * wob;
          const px = mx + Math.cos(a) * rr, py = my + Math.sin(a) * rr * 0.95;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.quadraticCurveTo(mx + 6, my + 12, mx - 8, my + 10);
        ctx.closePath();
        const mg = ctx.createLinearGradient(mx, my - maneR, mx, my + maneR);
        mg.addColorStop(0, '#f2fbff');
        mg.addColorStop(0.45, shadeColor(c.accent, 0.12));
        mg.addColorStop(1, shadeColor(c.accent, -0.22));
        ctx.fillStyle = mg; ctx.fill();
        ctx.save();                                        // water flowing inside
        ctx.clip();
        for (let i = 0; i < 4; i++) {
          waterRibbon(ctx, mx, my, maneR * (0.5 + i * 0.2), phase + i * 1.25 - 2.7, '#eaf7ff', 4 - i * 0.6, 1.7);
        }
        ctx.restore();
        furTufts(ctx, mx, my, maneR * 1.04, -2.8, -0.2, 7, 9 + r.g * 3, shadeColor(c.accent, 0.18));
        ctx.restore();
        ctx.save(); ctx.globalAlpha *= 0.65;               // dripping water
        for (let i = 0; i < 3; i++) {
          const p = (t * 1.1 + i * 0.33) % 1;
          ell(ctx, r.shoX - 8 + i * 11, r.bodyY - 6 + p * 18, 1.8, 2.8 + p, c.accent);
        }
        ctx.restore();
      },
    },

    // ---- droopy ears
    { name: 'earL', z: 3.5, space: 'local', pivot: (r) => [r.headX - 8 * r.headS, r.headY - 9 * r.headS, r.headS],
      box: [-20, -7, 28, 28],
      draw(ctx, c) {
        ctx.beginPath();
        ctx.translate(8, 9);
        ctx.moveTo(-8, -9);
        ctx.quadraticCurveTo(-24, -12, -20, 8);
        ctx.quadraticCurveTo(-11, 2, -4, -7);
        ctx.closePath(); ctx.fillStyle = c.secondary; ctx.fill();
        ell(ctx, -15, -1, 3.4, 6, shadeColor(c.accent, -0.08), -0.32);
      } },
    { name: 'earR', z: 3.5, space: 'local', pivot: (r) => [r.headX + 9 * r.headS, r.headY - 10 * r.headS, r.headS],
      box: [-6, -4, 24, 27],
      draw(ctx, c) {
        ctx.beginPath();
        ctx.translate(-9, 10);
        ctx.moveTo(9, -10);
        ctx.quadraticCurveTo(23, -9, 20, 9);
        ctx.quadraticCurveTo(12, 2, 7, -7);
        ctx.closePath(); ctx.fillStyle = c.secondary; ctx.fill();
        ell(ctx, 15, 0, 3.2, 5.6, shadeColor(c.accent, -0.08), 0.3);
      } },

    { name: 'head', z: 4, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS], box: [-19, -35, 47, 52],
      draw(ctx, c, ex, r) {
        if (ex.horns) {
          ctx.save(); ctx.globalAlpha *= 0.85;
          poly(ctx, [[-4, -13], [0, -33], [4, -19], [8, -30], [11, -13]], c.accent);
          ctx.restore();
        }
        volume(ctx, 0, -2, 15.5, 13.4, c.light, c.shadow);
        volume(ctx, 12, 4.5, 11, 7.6, shadeColor(c.primary, 0.06), c.shadow);
        ell(ctx, 14, 6.6, 8.4, 4.8, c.belly);
        ell(ctx, 21, 3.6, 2.8, 2.2, '#26323f');
      },
    },
  ],
};

// -----------------------------------------------------------------------------
// LEAFLET — Nature Avian.  Three-leaf crest, leaf-feather wings, curled stem
// tail, twig legs.  Hyperactive, cheerful.
// -----------------------------------------------------------------------------
const LEAFLET = {
  skel: (ex) => {
    const g = ex.grow;
    const by = -34 - g * 6;
    return {
      g, by,
      legLen: -by - 14,                    // twig legs: hip down to the ankle
      legW: 2.2,
      hipX: -4, shoX: 7,
      bodyY: by,
      headX: 10 + g * 3, headY: by - 17 - g * 3, headS: 1 - g * 0.08,
    };
  },
  face: {
    eyes: [{ x: 4.2, y: -1.4, r: 4.1, shape: 'bead', color: '#ffffff', dark: '#20303c' },
           { x: -6.6, y: -1.4, r: 3.6, shape: 'bead', color: '#ffffff', dark: '#20303c' }],
    brows: [{ x: 4.2, y: -7, w: 6.6 }, { x: -6.6, y: -7, w: 5.6, mirror: true }],
    mouth: null,
  },
  parts: [
    { // ---- stem tail with a curl
      name: 'tail', z: 0, space: 'local', pivot: (r) => [-14, r.by + 4], box: [-22, -30, 37, 41],
      draw(ctx, c, ex, r) {
        ctx.strokeStyle = c.dark; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.quadraticCurveTo(-10, -2, -18, -9); ctx.stroke();
        ctx.beginPath(); ctx.arc(-3, 3, 3.6, -1.2, 3.4); ctx.stroke();
        leaf(ctx, -16, -8, 20 + r.g * 8, 6.6 + r.g * 2, -0.68, c.primary, c.dark, 3);
        leaf(ctx, -16, -8, 19 + r.g * 8, 6.2 + r.g * 2, -0.14, c.accent, c.dark, 3);
        leaf(ctx, -16, -8, 17 + r.g * 8, 5.6 + r.g * 2, 0.42, c.primary, c.dark, 3);
      },
    },
    // ---- wings: one behind the body, one in front (leaf feathers)
    { name: 'wingL', z: 1.5, space: 'local', pivot: (r) => [2, r.by - 1], box: [-37, -7, 45, 36],
      draw(ctx, c, ex, r) {
        ctx.save();
        ctx.globalAlpha *= 0.85;
        ctx.rotate(-0.18);
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.quadraticCurveTo(-11, 8, -24 - r.g * 7, 14 + r.g * 4);
        ctx.quadraticCurveTo(-9, 15, 3, 6);
        ctx.closePath();
        ctx.fillStyle = shadeColor(c.secondary, -0.12); ctx.fill();
        for (let i = 0; i < 3; i++) {
          leaf(ctx, -3 - i * 3.4, 1 + i * 3.6, 19 + r.g * 6 + i * 2, 5.4, 2.42 + i * 0.17, i % 2 ? c.primary : c.accent, c.dark, 2);
        }
        ctx.restore();
      } },

    { name: 'legFL', z: 2, space: 'local', pivot: (r) => [-4, r.by + 12], box: [-10, -4, 19, 38],
      draw: (ctx, c, ex, r) => twigLeg(ctx, r.legLen) },
    { name: 'legFR', z: 2, space: 'local', pivot: (r) => [7, r.by + 12], box: [-10, -4, 19, 38],
      draw: (ctx, c, ex, r) => twigLeg(ctx, r.legLen) },

    { // ---- plump body with feather shingles
      name: 'body', z: 3, space: 'creature', pivot: (r) => [0, r.by], box: [-33, -24, 58, 48],
      draw(ctx, c, ex, r) {
        volume(ctx, 0, r.by, 17 + r.g * 4, 16.5 + r.g * 3.5, c.light, c.shadow);
        ell(ctx, 4, r.by + 5, 11 + r.g * 2, 10 + r.g * 2, c.belly);
        for (let i = 0; i < 4; i++) {
          leaf(ctx, -13 + i * 3.6, r.by - 9 + i * 4.6, 13 + r.g * 4, 4.4 + r.g, 2.72 + i * 0.12, i % 2 ? c.accent : c.secondary, c.dark, 2);
        }
      },
    },
    { name: 'wingR', z: 4.5, space: 'local', pivot: (r) => [4, r.by + 1], box: [-41, -7, 48, 30],
      draw(ctx, c, ex, r) {
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.quadraticCurveTo(-11, 8, -24 - r.g * 7, 14 + r.g * 4);
        ctx.quadraticCurveTo(-9, 15, 3, 6);
        ctx.closePath();
        ctx.fillStyle = c.secondary; ctx.fill();
        for (let i = 0; i < 3; i++) {
          leaf(ctx, -3 - i * 3.4, 1 + i * 3.6, 19 + r.g * 6 + i * 2, 5.4, 2.42 + i * 0.17, i % 2 ? c.primary : c.accent, c.dark, 2);
        }
      },
      live(ctx, c, ex, r, t) {                              // speed streaks behind the wing
        ctx.save(); ctx.globalAlpha *= 0.25;
        for (let i = 0; i < 3; i++) line(ctx, -18 - i * 4, 7 + i * 3, -30 - i * 5, 8 + i * 3, c.accent, 1.8);
        ctx.restore();
      },
    },
    { name: 'head', z: 6, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS], box: [-23, -40, 51, 56],
      draw(ctx, c, ex, r) {
        // three-leaf crest
        leaf(ctx, -2, -11, 20 + r.g * 8, 5.8 + r.g * 1.5, -1.66, c.accent, c.dark, 2);
        leaf(ctx, 3, -11, 16 + r.g * 7, 5 + r.g * 1.5, -1.12, c.primary, c.dark, 2);
        leaf(ctx, -7, -10, 15 + r.g * 6, 4.8 + r.g * 1.5, -2.16, c.primary, c.dark, 2);
        if (ex.horns) leaf(ctx, 7, -10, 18, 5.4, -0.78, c.accent, c.dark, 2);
        volume(ctx, 0, 0, 12.8, 12.2, c.light, c.shadow);
        poly(ctx, [[-10, 2], [-19, 4], [-10, 8]], c.accent);       // tail feathers
        poly(ctx, [[9, 0], [22 + r.g * 4, 2.8], [9, 5.4]], '#f5b544');   // beak
        poly(ctx, [[9, 5.4], [18, 4.4], [9, 7.4]], '#d99327');
        ctx.save(); ctx.globalAlpha *= 0.45;                       // cheek blush
        ell(ctx, 7.5, 5.4, 3.1, 2.1, '#ff9aa2');
        ell(ctx, -9.5, 5.4, 2.7, 1.9, '#ff9aa2');
        ctx.restore();
      },
    },
  ],
};

/** Leaflet's twig leg with three toes (drawn in leg-local space). */
function twigLeg(ctx, len) {
  ctx.strokeStyle = '#b08542'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-1, len); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, len); ctx.lineTo(5, len + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, len); ctx.lineTo(-6, len + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, len); ctx.lineTo(-2, len + 4); ctx.stroke();
}

// =============================================================================
// ROCK BODY PLANS — Stonehollow Crags.  Five new silhouettes: tortoise, boar,
// beetle, golem and lizard.  Each line grows visibly per evolution stage
// (ex.stage 0..3): more crystal, bigger tusks / horns / fins, extra plating.
// Bones stay in the shared vocabulary so every animation state just works.
// =============================================================================

/** A faceted crystal spike (pointing up) with a lit facet and a dark facet. */
function crystalSpike(ctx, x, y, h, w, color, tilt = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  poly(ctx, [[-w, 0], [-w * 0.35, -h], [0, -h * 1.15], [w * 0.4, -h * 0.92], [w, 0]], color);
  poly(ctx, [[-w * 0.35, -h], [0, -h * 1.15], [0.2, 0], [-w * 0.55, 0]], shadeColor(color, 0.28));
  poly(ctx, [[0, -h * 1.15], [w * 0.4, -h * 0.92], [w, 0], [0.2, 0]], shadeColor(color, -0.22));
  ctx.restore();
}

/** Rough stone plate: a low polygon with a highlight edge. */
function stonePlate(ctx, x, y, w, h, color, seed = 0) {
  const j = (k) => Math.sin(seed * 3.1 + k * 1.7) * 0.18;
  poly(ctx, [
    [x - w * (0.9 + j(1)), y + h * 0.1], [x - w * 0.5, y - h * (0.9 + j(2))], [x + w * (0.35 + j(3)), y - h],
    [x + w * (0.95 + j(4)), y - h * 0.2], [x + w * 0.6, y + h * 0.85], [x - w * (0.4 + j(5)), y + h],
  ], color);
  poly(ctx, [[x - w * 0.5, y - h * 0.9], [x + w * 0.35, y - h], [x + w * 0.15, y - h * 0.45], [x - w * 0.4, y - h * 0.4]], shadeColor(color, 0.16));
}

/** Small round pebble with a highlight. */
function pebble(ctx, x, y, r, color) {
  ell(ctx, x, y, r, r * 0.8, color);
  ell(ctx, x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.28, shadeColor(color, 0.22));
}

// -----------------------------------------------------------------------------
// PEBBLESHELL — Rock Tortoise.  Domed shell that sprouts crystal spikes with
// every stage, stubby legs, beaked head.  Patient, immovable.
// -----------------------------------------------------------------------------
const TORTOISE = {
  skel: (ex) => skeleton(ex, { legLen: 13, legW: 6.5, bodyY: -25, headY: -37, headX: 24, hipX: -12, shoX: 9 }),
  face: {
    eyes: [{ x: 5.6, y: -2.6, r: 3.4, shape: 'droop', color: 'eye' },
           { x: -4.6, y: -2.6, r: 3.0, shape: 'droop', color: 'eye' }],
    brows: [{ x: 5.6, y: -7.4, w: 6 }, { x: -4.6, y: -7.4, w: 5.4, mirror: true }],
    mouth: { x: 11, y: 5.6, w: 6.2, color: '#2a2f2a' },
  },
  parts: [
    { name: 'tail', z: 0, space: 'local', pivot: (r) => [r.hipX - 14, r.bodyY + 6], box: [-16, -8, 20, 16],
      draw(ctx, c) {
        poly(ctx, [[0, -4], [-12, -1], [-14, 3], [0, 5]], c.primary);
        ell(ctx, -12, 1.5, 2.6, 2.2, c.shadow);
      } },
    { name: 'legBL', z: 1, space: 'local', pivot: (r) => [r.hipX - 2, r.bodyY + 9], box: [-12, -4, 24, 28],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW * 0.95, c.shadow, c.secondary, -1.2, 3) },
    { name: 'legFL', z: 1, space: 'local', pivot: (r) => [r.shoX + 3, r.bodyY + 9], box: [-12, -4, 24, 28],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.92, c.shadow, c.secondary, 1.1, 3) },

    { // ---- torso + SHELL (the shell grows crystals per stage)
      name: 'body', z: 2, space: 'creature', pivot: (r) => [0, r.bodyY], box: [-46, -58, 90, 82],
      draw(ctx, c, ex, r) {
        const g = r.g, st = ex.stage || 0;
        // soft torso under the shell
        volume(ctx, r.hipX + 6, r.bodyY + 6, 24 + g * 4, 11 + g * 2, c.light, c.shadow);
        ell(ctx, r.shoX + 4, r.bodyY + 9, 14 + g * 2, 6.5 + g, c.belly);
        // neck
        poly(ctx, [[r.shoX + 6, r.bodyY - 2], [r.headX - 6, r.headY + 6], [r.headX + 4, r.headY + 9], [r.shoX + 14, r.bodyY + 8]], c.primary);
        // shell dome
        const sx = r.hipX + 4, sy = r.bodyY - 2, sw = 30 + g * 8, sh = 22 + g * 7;
        ctx.save();
        ctx.beginPath(); ctx.ellipse(sx, sy, sw, sh, 0, Math.PI, Math.PI * 2); ctx.lineTo(sx + sw, sy + 3); ctx.lineTo(sx - sw, sy + 3); ctx.closePath();
        const dg = ctx.createLinearGradient(sx, sy - sh, sx, sy + 3);
        dg.addColorStop(0, shadeColor(c.secondary, 0.22)); dg.addColorStop(1, shadeColor(c.secondary, -0.3));
        ctx.fillStyle = dg; ctx.fill();
        ctx.clip();
        // hex-ish plates
        ctx.strokeStyle = shadeColor(c.secondary, -0.45); ctx.lineWidth = 1.6;
        for (let i = -2; i <= 2; i++) {
          for (let j = 0; j < 2; j++) {
            const px = sx + i * sw * 0.42 + (j ? sw * 0.21 : 0), py = sy - sh * 0.25 - j * sh * 0.5;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k; const hx = px + Math.cos(a) * sw * 0.2, hy = py + Math.sin(a) * sh * 0.24; k ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy); }
            ctx.closePath(); ctx.stroke();
          }
        }
        // moss / lichen patches from stage 1
        if (st >= 1) { ctx.globalAlpha *= 0.75; ell(ctx, sx - sw * 0.45, sy - sh * 0.35, 6 + g * 2, 3.5, c.accent); ell(ctx, sx + sw * 0.3, sy - sh * 0.15, 5 + g, 3, c.accent); }
        ctx.restore();
        // rim
        ctx.beginPath(); ctx.ellipse(sx, sy + 3, sw + 2, 4.5, 0, 0, Math.PI * 2); ctx.fillStyle = shadeColor(c.secondary, -0.2); ctx.fill();
        // crystal spikes: 0 / 2 / 4 / 6 with the stage
        const n = st * 2;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const a = Math.PI + Math.PI * t;
          const px = sx + Math.cos(a) * sw * 0.72, py = sy + Math.sin(a) * sh * 0.78 + 2;
          crystalSpike(ctx, px, py, 8 + st * 3 + (i % 2) * 3, 3 + st * 0.6, c.accent, (t - 0.5) * 1.3);
        }
      },
    },
    { name: 'legBR', z: 3, space: 'local', pivot: (r) => [r.hipX + 6, r.bodyY + 10], box: [-12, -4, 25, 28],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW, c.primary, c.belly, -1.1, 3) },
    { name: 'legFR', z: 3, space: 'local', pivot: (r) => [r.shoX + 12, r.bodyY + 10], box: [-12, -4, 24, 28],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.96, c.primary, c.belly, 1, 3) },

    { name: 'head', z: 4, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS], box: [-16, -22, 36, 36],
      draw(ctx, c, ex) {
        if (ex.horns) {                                  // stone crest ridge (stage 2+)
          crystalSpike(ctx, -4, -10, 9 + (ex.stage || 0) * 2, 3, c.accent, -0.35);
          crystalSpike(ctx, 3, -11, 6 + (ex.stage || 0) * 2, 2.4, c.accent, 0.1);
        }
        volume(ctx, 0, -1, 13, 11, c.light, c.shadow);
        // beak
        poly(ctx, [[8, 2], [17, 1], [18, 6], [10, 8]], shadeColor(c.belly, -0.1));
        line(ctx, 10, 5.4, 16.5, 4.4, shadeColor(c.dark, 0.1), 1.2);
        ell(ctx, -3, 7, 7, 3.4, c.belly);
      },
    },
  ],
};

// -----------------------------------------------------------------------------
// GRAVELHOG — Rock Boar.  Gravel-plated back ridge (mane bone), flint tusks
// that grow with every stage, hooves, tufted tail.  Charges first.
// -----------------------------------------------------------------------------
const BOAR = {
  skel: (ex) => skeleton(ex, { legLen: 18, legW: 6, bodyY: -34, headY: -44, headX: 24, hipX: -12, shoX: 8 }),
  face: {
    eyes: [{ x: 4.8, y: -6.2, r: 3.1, shape: 'sharp', color: 'eye' },
           { x: -5.6, y: -6.2, r: 2.8, shape: 'sharp', color: 'eye' }],
    brows: [{ x: 4.8, y: -11, w: 6 }, { x: -5.6, y: -11, w: 5.4, mirror: true }],
    mouth: { x: 16, y: 6.4, w: 6.5, color: '#2c211b', fangs: 2 },
  },
  parts: [
    { name: 'tail', z: 0, space: 'local', pivot: (r) => [r.hipX - 16, r.bodyY - 4], box: [-14, -12, 18, 26],
      draw(ctx, c) {
        line(ctx, 0, 0, -8, 9, c.secondary, 2.6);
        furTufts(ctx, -9, 10, 2.5, 1.2, 4.2, 4, 7, c.dark);
      } },
    { name: 'legBL', z: 1, space: 'local', pivot: (r) => [r.hipX - 4, r.bodyY + 9], box: [-11, -4, 22, 36],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW * 0.9, c.shadow, c.dark, -1.5, 2) },
    { name: 'legFL', z: 1, space: 'local', pivot: (r) => [r.shoX + 4, r.bodyY + 9], box: [-11, -4, 22, 36],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.88, c.shadow, c.dark, 1.3, 2) },

    { name: 'body', z: 2, space: 'creature', pivot: (r) => [0, r.bodyY], box: [-42, -34, 82, 60],
      draw(ctx, c, ex, r) {
        const g = r.g;
        volume(ctx, r.hipX + 1, r.bodyY + 1, 21 + g * 5, 16 + g * 3.5, c.light, c.shadow);
        volume(ctx, r.shoX + 2, r.bodyY - 1, 20 + g * 4.5, 16 + g * 3.5, c.light, c.shadow);
        // thick neck into the head
        poly(ctx, [[r.shoX + 4, r.bodyY - 14], [r.headX - 4, r.headY - 6], [r.headX + 6, r.headY + 12], [r.shoX + 16, r.bodyY + 6]], c.primary);
        ell(ctx, r.shoX + 3, r.bodyY + 6, 13 + g * 2, 9 + g, c.belly);
        // gravel patches on the flank
        for (let i = 0; i < 3; i++) pebble(ctx, r.hipX - 6 + i * 9, r.bodyY - 5 + (i % 2) * 5, 2.6 + (i % 2), shadeColor(c.secondary, 0.1));
      },
    },
    { name: 'legBR', z: 3, space: 'local', pivot: (r) => [r.hipX + 5, r.bodyY + 10], box: [-11, -4, 23, 36],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW, c.primary, c.dark, -1.3, 2) },
    { name: 'legFR', z: 3, space: 'local', pivot: (r) => [r.shoX + 12, r.bodyY + 10], box: [-11, -4, 22, 36],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW * 0.95, c.primary, c.dark, 1.1, 2) },

    { // ---- GRAVEL RIDGE along the back (more plates per stage)
      name: 'mane', z: 3.4, space: 'creature', pivot: (r) => [r.hipX + 6, r.bodyY - 16], box: [-34, -26, 66, 30],
      draw(ctx, c, ex, r) {
        const st = ex.stage || 0, g = r.g;
        const n = 3 + st;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const x = r.hipX - 12 + t * (30 + g * 8), y = r.bodyY - 13 - g * 3 - Math.sin(t * Math.PI) * (5 + st * 1.5);
          stonePlate(ctx, x, y, 5.5 + st * 0.6, 5 + st * 1.2 + Math.sin(t * Math.PI) * 3, shadeColor(c.secondary, 0.08 + (i % 2) * 0.08), i);
        }
        if (st >= 3) crystalSpike(ctx, r.hipX + 4, r.bodyY - 20 - g * 3, 9, 2.6, c.accent, -0.2);
      },
    },

    { name: 'earL', z: 3.5, space: 'local', pivot: (r) => [r.headX - 6 * r.headS, r.headY - 11 * r.headS, r.headS], box: [-9, -12, 14, 14],
      draw(ctx, c) { poly(ctx, [[0, 0], [-6, -10], [3, -6]], c.secondary); poly(ctx, [[-1, -1.5], [-4, -7], [1.5, -5]], shadeColor(c.accent, -0.1)); } },
    { name: 'earR', z: 3.5, space: 'local', pivot: (r) => [r.headX + 6 * r.headS, r.headY - 12 * r.headS, r.headS], box: [-5, -12, 14, 14],
      draw(ctx, c) { poly(ctx, [[0, 0], [7, -10], [-2, -6]], c.secondary); poly(ctx, [[1, -1.5], [5, -7], [-0.5, -5]], shadeColor(c.accent, -0.1)); } },

    { name: 'head', z: 4, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS], box: [-18, -22, 44, 40],
      draw(ctx, c, ex) {
        const st = ex.stage || 0;
        volume(ctx, 0, -3, 14.5, 12.5, c.light, c.shadow);
        // long snout
        volume(ctx, 11, 3, 11, 7.5, shadeColor(c.primary, 0.04), c.shadow);
        ell(ctx, 20.5, 3.2, 4, 3.3, shadeColor(c.dark, 0.25));          // snout disc
        ell(ctx, 19.6, 2.6, 1.1, 1.3, c.dark); ell(ctx, 21.6, 2.6, 1.1, 1.3, c.dark);
        // flint tusks: longer and paler with every stage (horns flag from stage 1)
        const tl = (ex.horns ? 7 : 4) + st * 2.2;
        const tusk = shadeColor(c.belly, 0.1);
        poly(ctx, [[12, 7], [16 + tl * 0.4, 7 - tl], [18 + tl * 0.5, 6 - tl * 0.8], [15, 8.5]], tusk);
        poly(ctx, [[8, 8], [11 + tl * 0.3, 8 - tl * 0.8], [13 + tl * 0.4, 7.4 - tl * 0.6], [11, 9.6]], shadeColor(tusk, -0.12));
        if (st >= 2) stonePlate(ctx, -2, -13, 6, 4, shadeColor(c.secondary, 0.1), 3);   // brow plate
      },
    },
  ],
};

// -----------------------------------------------------------------------------
// QUARTZLING — Rock Beetle.  Crystal-studded carapace, elytra on the wing
// bones (they open into flight wings at stage 2+), a rhino horn that grows
// with every stage, antennae on the ear bones.
// -----------------------------------------------------------------------------
const BEETLE = {
  skel: (ex) => skeleton(ex, { legLen: 15, legW: 3.4, bodyY: -30, headY: -34, headX: 22, hipX: -10, shoX: 6 }),
  face: {
    eyes: [{ x: 5.4, y: -3.2, r: 3.6, shape: 'bead', color: 'eye', dark: '#1a1730' },
           { x: -4.8, y: -3.2, r: 3.2, shape: 'bead', color: 'eye', dark: '#1a1730' }],
    brows: [{ x: 5.4, y: -8.4, w: 5.5 }, { x: -4.8, y: -8.4, w: 5, mirror: true }],
    mouth: { x: 10, y: 5, w: 5.5, color: '#221f36' },
  },
  parts: [
    { name: 'tail', z: 0, space: 'local', pivot: (r) => [r.hipX - 16, r.bodyY + 4], box: [-8, -5, 10, 10],
      draw(ctx, c) { poly(ctx, [[0, -3], [-6, 0], [0, 3]], c.secondary); } },
    { name: 'legBL', z: 1, space: 'local', pivot: (r) => [r.hipX - 6, r.bodyY + 8], box: [-10, -4, 20, 30],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW, c.shadow, c.secondary, -3, 2) },
    { name: 'legFL', z: 1, space: 'local', pivot: (r) => [r.shoX + 2, r.bodyY + 8], box: [-10, -4, 20, 30],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW, c.shadow, c.secondary, 2.6, 2) },

    { // ---- carapace with a seed crystal that grows per stage
      name: 'body', z: 2, space: 'creature', pivot: (r) => [0, r.bodyY], box: [-40, -44, 78, 64],
      draw(ctx, c, ex, r) {
        const g = r.g, st = ex.stage || 0;
        // abdomen + thorax
        volume(ctx, r.hipX, r.bodyY + 2, 22 + g * 5, 15 + g * 3, c.light, c.shadow);
        volume(ctx, r.shoX + 4, r.bodyY, 14 + g * 3, 12 + g * 2, shadeColor(c.primary, 0.04), c.shadow);
        ell(ctx, r.hipX + 2, r.bodyY + 9, 16 + g * 3, 6 + g, c.belly);
        // segment lines
        ctx.strokeStyle = shadeColor(c.dark, 0.2); ctx.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(r.hipX - 6 + i * 7, r.bodyY + 2, 12 + g * 3, 0.5, 2.6); ctx.stroke(); }
        // crystals: 1 / 2 / 3 / 5
        const n = [1, 2, 3, 5][st] || 1;
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          const x = r.hipX - 10 + t * 24, y = r.bodyY - 10 - g * 3 - Math.sin(t * Math.PI) * 4;
          crystalSpike(ctx, x, y, 10 + st * 3 + (i === Math.floor(n / 2) ? 5 : 0), 3.2 + st * 0.5, c.accent, (t - 0.5) * 1.1);
        }
      },
      live(ctx, c, ex, r, t) {                           // seed crystal glow pulse
        const p = gemPulse(t, ex.excite);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35 * p;
        ell(ctx, r.hipX + 2, r.bodyY - 16 - r.g * 3, 12 + (ex.stage || 0) * 3, 8, c.accent);
        ctx.restore();
      },
    },
    { name: 'legBR', z: 3, space: 'local', pivot: (r) => [r.hipX + 4, r.bodyY + 9], box: [-10, -4, 21, 30],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW, c.primary, c.belly, -2.6, 2) },
    { name: 'legFR', z: 3, space: 'local', pivot: (r) => [r.shoX + 11, r.bodyY + 9], box: [-10, -4, 20, 30],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW, c.primary, c.belly, 2.2, 2) },

    { // ---- ELYTRA (wing bones). Closed shells; open with flight wings once ex.wings.
      name: 'wingL', z: 3.3, space: 'local', pivot: (r) => [r.hipX + 2, r.bodyY - 10 - r.g * 3], box: [-30, -30, 44, 36],
      draw(ctx, c, ex) {
        if (ex.wings) { ctx.save(); ctx.globalAlpha *= 0.55; poly(ctx, [[-2, 0], [-30, -16], [-28, 4], [-6, 10]], shadeColor(c.accent, 0.3)); ctx.restore(); }
        poly(ctx, [[0, -2], [-22, -10 - (ex.wings ? 10 : 0)], [-24, 4 - (ex.wings ? 6 : 0)], [-4, 12]], shadeColor(c.secondary, 0.1));
        line(ctx, -3, 0, -20, -6 - (ex.wings ? 8 : 0), shadeColor(c.dark, 0.1), 1);
      } },
    { name: 'wingR', z: 3.6, space: 'local', pivot: (r) => [r.hipX + 6, r.bodyY - 9 - r.g * 3], box: [-14, -30, 44, 36],
      draw(ctx, c, ex) {
        if (ex.wings) { ctx.save(); ctx.globalAlpha *= 0.55; poly(ctx, [[2, 0], [28, -18], [30, 2], [8, 10]], shadeColor(c.accent, 0.3)); ctx.restore(); }
        poly(ctx, [[0, -2], [20, -12 - (ex.wings ? 10 : 0)], [24, 3 - (ex.wings ? 6 : 0)], [6, 12]], shadeColor(c.secondary, 0.22));
        line(ctx, 3, 0, 18, -8 - (ex.wings ? 8 : 0), shadeColor(c.dark, 0.1), 1);
      } },

    // antennae on the ear bones
    { name: 'earL', z: 3.8, space: 'local', pivot: (r) => [r.headX - 4 * r.headS, r.headY - 10 * r.headS, r.headS], box: [-16, -18, 20, 20],
      draw(ctx, c) { line(ctx, 0, 0, -11, -13, c.dark, 1.5); ell(ctx, -11.5, -13.5, 2.2, 2.2, c.accent); } },
    { name: 'earR', z: 3.8, space: 'local', pivot: (r) => [r.headX + 3 * r.headS, r.headY - 11 * r.headS, r.headS], box: [-6, -18, 20, 20],
      draw(ctx, c) { line(ctx, 0, 0, 9, -14, c.dark, 1.5); ell(ctx, 9.5, -14.5, 2.2, 2.2, c.accent); } },

    { name: 'head', z: 4, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS], box: [-16, -34, 36, 46],
      draw(ctx, c, ex) {
        const st = ex.stage || 0;
        volume(ctx, 0, -2, 12, 10.5, c.light, c.shadow);
        // rhino horn (grows with stage; horns flag from stage 1)
        const hl = (ex.horns ? 10 : 5) + st * 4;
        poly(ctx, [[2, -8], [8 + hl * 0.6, -8 - hl], [12 + hl * 0.5, -6 - hl * 0.7], [9, -4]], shadeColor(c.secondary, 0.16));
        poly(ctx, [[8 + hl * 0.6, -8 - hl], [12 + hl * 0.5, -6 - hl * 0.7], [10 + hl * 0.55, -7 - hl * 0.8]], shadeColor(c.accent, 0.1));
        // mandibles
        poly(ctx, [[8, 5], [16, 3], [17, 7], [9, 8]], shadeColor(c.dark, 0.3));
        poly(ctx, [[7, 7], [14, 9], [12, 11], [6, 9.5]], shadeColor(c.dark, 0.2));
      },
    },
  ],
};

// -----------------------------------------------------------------------------
// RUBBLEKIN — Rock Golem.  Stacked quarry stones, long stone arms on the front
// leg bones, a rune eye, and a ring of floating stones (mane bone) that grows
// with every stage.
// -----------------------------------------------------------------------------
const GOLEM = {
  skel: (ex) => skeleton(ex, { legLen: 12, legW: 7, bodyY: -38, headY: -62, headX: 10, hipX: -8, shoX: 10 }),
  face: {
    eyes: [{ x: 5.4, y: -2, r: 3.4, shape: 'bead', color: 'accent', dark: '#2a2723' },
           { x: -5.4, y: -2, r: 3.4, shape: 'bead', color: 'accent', dark: '#2a2723' }],
    brows: [{ x: 5.4, y: -8, w: 6.5 }, { x: -5.4, y: -8, w: 6.5, mirror: true }],
    mouth: { x: 0, y: 7, w: 8, color: '#1e1b18' },
  },
  parts: [
    { name: 'tail', z: 0, space: 'local', pivot: (r) => [r.hipX - 18, r.bodyY + 14], box: [-10, -8, 14, 14],
      draw(ctx, c) { pebble(ctx, -3, 0, 4, c.secondary); pebble(ctx, -8, 3, 2.5, c.shadow); } },
    { name: 'legBL', z: 1, space: 'local', pivot: (r) => [r.hipX - 4, r.bodyY + 16], box: [-12, -4, 24, 26],
      draw(ctx, c, ex, r) { stonePlate(ctx, 0, r.legLen, 8, 6, c.shadow, 1); stonePlate(ctx, 0, r.legLen * 0.5, 6, 6, c.shadow, 2); } },
    { name: 'legFL', z: 1, space: 'local', pivot: (r) => [r.shoX - 2, r.bodyY - 6], box: [-14, -6, 22, 46],
      draw(ctx, c, ex, r) {                              // long stone arm
        stonePlate(ctx, -2, 10, 6, 7, c.shadow, 3); stonePlate(ctx, -4, 22, 6.5, 7, c.shadow, 4);
        stonePlate(ctx, -5, 34 + r.g * 3, 8, 7, shadeColor(c.shadow, -0.1), 5);
      } },

    { // ---- stacked boulder torso with a chest rune
      name: 'body', z: 2, space: 'creature', pivot: (r) => [0, r.bodyY], box: [-40, -36, 80, 60],
      draw(ctx, c, ex, r) {
        const g = r.g, st = ex.stage || 0;
        stonePlate(ctx, r.hipX + 2, r.bodyY + 14, 24 + g * 5, 11 + g * 2, c.shadow, 7);
        stonePlate(ctx, 2, r.bodyY - 2, 26 + g * 6, 15 + g * 3, c.primary, 8);
        stonePlate(ctx, 6, r.bodyY - 16 - g * 2, 18 + g * 4, 9 + g * 2, c.light, 9);
        // chest rune
        ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(6, r.bodyY - 8); ctx.lineTo(10, r.bodyY + 2); ctx.lineTo(2, r.bodyY + 6); ctx.stroke();
        if (st >= 1) { ctx.beginPath(); ctx.moveTo(-6, r.bodyY - 4); ctx.lineTo(-2, r.bodyY + 6); ctx.stroke(); }
        // crystal growths from stage 2
        if (st >= 2) { crystalSpike(ctx, -16, r.bodyY - 8, 9 + st * 2, 3, c.accent, -0.5); crystalSpike(ctx, 22, r.bodyY - 12, 7 + st * 2, 2.6, c.accent, 0.4); }
      },
      live(ctx, c, ex, r, t) {                           // rune glow
        const p = gemPulse(t, ex.excite);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.3 * p;
        ell(ctx, 6, r.bodyY - 1, 9, 9, c.accent);
        ctx.restore();
      },
    },
    { name: 'legBR', z: 3, space: 'local', pivot: (r) => [r.hipX + 12, r.bodyY + 17], box: [-12, -4, 24, 26],
      draw(ctx, c, ex, r) { stonePlate(ctx, 0, r.legLen, 8.5, 6, c.primary, 11); stonePlate(ctx, 1, r.legLen * 0.5, 6.5, 6, c.primary, 12); } },
    { name: 'legFR', z: 3, space: 'local', pivot: (r) => [r.shoX + 16, r.bodyY - 6], box: [-12, -6, 24, 46],
      draw(ctx, c, ex, r) {
        stonePlate(ctx, 2, 10, 6, 7, c.primary, 13); stonePlate(ctx, 4, 22, 6.5, 7, c.primary, 14);
        stonePlate(ctx, 5, 34 + r.g * 3, 8, 7, shadeColor(c.primary, -0.08), 15);
      } },

    { // ---- floating stones (2 / 3 / 4 / 6 with the stage) — redrawn live so they orbit
      name: 'mane', z: 3.6, space: 'creature', pivot: (r) => [4, r.bodyY - 20], liveOnly: true, box: [-44, -48, 88, 70],
      draw(ctx, c, ex, r, t) {
        const st = ex.stage || 0, n = [2, 3, 4, 6][st] || 2;
        for (let i = 0; i < n; i++) {
          const a = t * 0.9 + (i / n) * Math.PI * 2;
          const x = 4 + Math.cos(a) * (30 + r.g * 6), y = r.bodyY - 20 - r.g * 4 + Math.sin(a) * 9 + Math.sin(t * 2 + i) * 2;
          ctx.save(); ctx.globalAlpha *= Math.sin(a) > 0 ? 1 : 0.55;
          pebble(ctx, x, y, 3 + (i % 3), i % 2 ? c.secondary : c.light);
          ctx.restore();
        }
      },
    },

    { name: 'head', z: 4, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS], box: [-20, -26, 40, 40],
      draw(ctx, c, ex) {
        const st = ex.stage || 0;
        if (ex.horns) { crystalSpike(ctx, -8, -12, 9 + st * 2, 3, c.accent, -0.3); crystalSpike(ctx, 0, -14, 12 + st * 2, 3.4, c.accent, 0); crystalSpike(ctx, 8, -12, 9 + st * 2, 3, c.accent, 0.3); }
        stonePlate(ctx, 0, 2, 16, 13, c.light, 21);
        stonePlate(ctx, -1, -9, 12, 5, shadeColor(c.light, 0.1), 22);
        // brow shadow and the mouth crack
        poly(ctx, [[-12, -6], [12, -6], [11, -3], [-11, -3]], shadeColor(c.shadow, -0.1));
      },
    },
  ],
};

// -----------------------------------------------------------------------------
// SHALECRAWL — Rock Lizard.  Low flat body, crystal dorsal fins that multiply
// with every stage, long spiked tail, frills on the ear bones, membranous
// wings at the final stage (Obsidrake).
// -----------------------------------------------------------------------------
const LIZARD = {
  skel: (ex) => skeleton(ex, { legLen: 12, legW: 4.4, bodyY: -22, headY: -30, headX: 26, hipX: -14, shoX: 10 }),
  face: {
    eyes: [{ x: 6.4, y: -3.4, r: 3.4, shape: 'sharp', color: 'eye' },
           { x: -4.4, y: -3.4, r: 3, shape: 'sharp', color: 'eye' }],
    brows: [{ x: 6.4, y: -8.4, w: 6.2 }, { x: -4.4, y: -8.4, w: 5.6, mirror: true }],
    mouth: { x: 14, y: 4.6, w: 8, color: '#1e242c', fangs: 1 },
  },
  parts: [
    { // ---- long tail with a crystal fin at the tip
      name: 'tail', z: 0, space: 'local', pivot: (r) => [r.hipX - 10, r.bodyY + 3], box: [-56, -30, 60, 40],
      draw(ctx, c, ex, r) {
        const TL = 34 + r.g * 12, st = ex.stage || 0;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.bezierCurveTo(-TL * 0.5, -6, -TL * 0.9, 2, -TL, -12 - r.g * 6);
        ctx.bezierCurveTo(-TL * 0.85, 4, -TL * 0.5, 7, 0, 5);
        ctx.closePath();
        const tg = ctx.createLinearGradient(0, 0, -TL, 0);
        tg.addColorStop(0, c.primary); tg.addColorStop(1, c.secondary);
        ctx.fillStyle = tg; ctx.fill();
        for (let i = 0; i < 2 + st; i++) crystalSpike(ctx, -TL * (0.25 + i * 0.16), -2 - i * 1.4, 6 + st * 1.5 + (i === 1 + st ? 4 : 0), 2, c.accent, -0.3 - i * 0.12);
      },
    },
    { name: 'legBL', z: 1, space: 'local', pivot: (r) => [r.hipX - 2, r.bodyY + 6], box: [-12, -4, 24, 26],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW, c.shadow, c.secondary, -3.5, 3) },
    { name: 'legFL', z: 1, space: 'local', pivot: (r) => [r.shoX + 2, r.bodyY + 6], box: [-12, -4, 24, 26],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW, c.shadow, c.secondary, 3, 3) },

    { // ---- low body with dorsal crystal fins (2 / 3 / 4 / 5)
      name: 'body', z: 2, space: 'creature', pivot: (r) => [0, r.bodyY], box: [-40, -40, 80, 56],
      draw(ctx, c, ex, r) {
        const g = r.g, st = ex.stage || 0;
        volume(ctx, -2, r.bodyY + 2, 28 + g * 6, 11 + g * 2.5, c.light, c.shadow);
        poly(ctx, [[r.shoX + 6, r.bodyY - 6], [r.headX - 6, r.headY], [r.headX + 2, r.headY + 8], [r.shoX + 14, r.bodyY + 8]], c.primary);
        ell(ctx, 0, r.bodyY + 8, 22 + g * 4, 5 + g, c.belly);
        // shale scale marks
        ctx.strokeStyle = shadeColor(c.secondary, -0.2); ctx.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-16 + i * 10, r.bodyY + 1, 6, -2.4, -0.7); ctx.stroke(); }
        const n = 2 + st;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const x = -24 + t * (40 + g * 8), y = r.bodyY - 9 - g * 2;
          crystalSpike(ctx, x, y, 8 + st * 2.5 + Math.sin(t * Math.PI) * 4, 2.6 + st * 0.4, c.accent, (t - 0.5) * 0.8);
        }
      },
      live(ctx, c, ex, r, t) {                           // fins glow softly
        const p = gemPulse(t, ex.excite);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.25 * p;
        ell(ctx, -4, r.bodyY - 12 - r.g * 2, 24 + r.g * 4, 7, c.accent);
        ctx.restore();
      },
    },
    { name: 'legBR', z: 3, space: 'local', pivot: (r) => [r.hipX + 8, r.bodyY + 7], box: [-12, -4, 25, 26],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen, r.legW * 1.05, c.primary, c.belly, -3, 3) },
    { name: 'legFR', z: 3, space: 'local', pivot: (r) => [r.shoX + 12, r.bodyY + 7], box: [-12, -4, 24, 26],
      draw: (ctx, c, ex, r) => limb(ctx, 0, 0, r.legLen - 1, r.legW, c.primary, c.belly, 2.6, 3) },

    { // ---- wings: only drawn once ex.wings (Obsidrake)
      name: 'wingL', z: 1.8, space: 'local', pivot: (r) => [-4, r.bodyY - 6 - r.g * 2], box: [-44, -40, 50, 44],
      draw(ctx, c, ex) {
        if (!ex.wings) return;
        poly(ctx, [[0, 0], [-16, -28], [-40, -20], [-30, 0], [-12, 4]], shadeColor(c.secondary, -0.05));
        ctx.save(); ctx.globalAlpha *= 0.7; poly(ctx, [[-4, -2], [-16, -24], [-34, -18], [-26, -2]], shadeColor(c.accent, -0.2)); ctx.restore();
        line(ctx, 0, 0, -16, -28, c.dark, 1.6); line(ctx, -4, -2, -34, -18, c.dark, 1.2);
      } },
    { name: 'wingR', z: 3.7, space: 'local', pivot: (r) => [2, r.bodyY - 5 - r.g * 2], box: [-6, -40, 50, 44],
      draw(ctx, c, ex) {
        if (!ex.wings) return;
        poly(ctx, [[0, 0], [14, -30], [40, -22], [30, -2], [12, 4]], c.secondary);
        ctx.save(); ctx.globalAlpha *= 0.7; poly(ctx, [[4, -2], [14, -26], [34, -20], [26, -4]], shadeColor(c.accent, -0.1)); ctx.restore();
        line(ctx, 0, 0, 14, -30, c.dark, 1.6); line(ctx, 4, -2, 34, -20, c.dark, 1.2);
      } },

    // frills on the ear bones
    { name: 'earL', z: 3.5, space: 'local', pivot: (r) => [r.headX - 8 * r.headS, r.headY - 4 * r.headS, r.headS], box: [-16, -12, 20, 22],
      draw(ctx, c, ex) { const s = 1 + (ex.stage || 0) * 0.2; poly(ctx, [[0, -2], [-10 * s, -10 * s], [-12 * s, 2], [-6 * s, 8 * s]], shadeColor(c.accent, -0.15)); } },
    { name: 'earR', z: 3.5, space: 'local', pivot: (r) => [r.headX + 6 * r.headS, r.headY - 6 * r.headS, r.headS], box: [-6, -14, 18, 22],
      draw(ctx, c, ex) { const s = 1 + (ex.stage || 0) * 0.2; poly(ctx, [[0, 0], [8 * s, -11 * s], [12 * s, 0], [6 * s, 7 * s]], shadeColor(c.accent, -0.05)); } },

    { name: 'head', z: 4, space: 'local', pivot: (r) => [r.headX, r.headY, r.headS], box: [-18, -24, 40, 36],
      draw(ctx, c, ex) {
        const st = ex.stage || 0;
        if (ex.horns) { crystalSpike(ctx, -6, -11, 8 + st * 2, 2.6, c.accent, -0.6); crystalSpike(ctx, 1, -12, 10 + st * 2, 2.8, c.accent, -0.2); }
        // flat wedge head
        poly(ctx, [[-13, -9], [10, -10], [21, 0], [18, 6], [-6, 8], [-14, 2]], c.light);
        poly(ctx, [[-13, -9], [10, -10], [8, -4], [-11, -3]], shadeColor(c.light, 0.12));
        ell(ctx, 16, 2, 2.2, 1.6, shadeColor(c.dark, 0.2));   // nostril
      },
    },
  ],
};

// -----------------------------------------------------------------------------
/** body plan -> art definition */
export const SPECIES_ART = {
  spriggo: SPRIGGO,
  aquini: AQUINI,
  emberu: EMBERU,
  rivruff: RIVRUFF,
  leaflet: LEAFLET,
};

/**
 * Body plans, so a new species can reuse a silhouette instead of needing a
 * hand-authored one: `art: { body: 'wolf', ...your own colours }` is enough.
 * Palette, horns, wings and scale still come from the species itself, so two
 * species on the same plan still read as different Mythlings.
 */
export const BODY_PLANS = {
  fox: SPRIGGO,
  feline: AQUINI,
  dragon: EMBERU,
  wolf: RIVRUFF,
  avian: LEAFLET,
  // Rock plans (Stonehollow Crags)
  tortoise: TORTOISE,
  boar: BOAR,
  beetle: BEETLE,
  golem: GOLEM,
  lizard: LIZARD,
};

export function artFor(speciesId) {
  if (SPECIES_ART[speciesId]) return SPECIES_ART[speciesId];
  const sp = getSpecies(speciesId);
  return BODY_PLANS[sp?.art?.body] || SPECIES_ART[sp?.art?.body] || null;
}

/** Builds the `ex` (art context) the layers and faces are authored against. */
export function artContext(speciesId, stage, expression, pose = {}) {
  const evo = getEvolutionStage(speciesId, stage);
  return {
    horns: !!evo.art?.horns,
    wings: !!evo.art?.wings,
    stage,
    grow: Math.min(1, stage * 0.5),
    face: expression,
    excite: pose.excite ?? 0,
    action: pose.action || 'idle',
  };
}
