// =============================================================================
// MYTHLING CREATURE RENDERER
// -----------------------------------------------------------------------------
// Every Mythling is drawn procedurally from its own body plan — no external art,
// no sprite sheets, nothing borrowed. The design rules this file implements:
//
//   * SILHOUETTE FIRST  — each species is identifiable as a black shape thanks to
//     3-5 signature forms (Spriggo's blade tail + shoulder sprouts, Aquini's
//     fin-ears + crescent tail, Emberu's swept horns + flame tail, Rivruff's
//     water mane + slab paws, Leaflet's leaf crest + stem tail).
//   * ANATOMY  — layered shapes: haunch, chest, neck, muzzle, articulated paws.
//     No creature is a stack of plain spheres.
//   * FACE     — every species has its own eye shape, brow and mouth, and can
//     play six expressions (happy / angry / scared / surprised / determined /
//     sleepy) so personality reads before the name does.
//   * ELEMENT  — nature grows leaves/vines, water flows and turns translucent,
//     fire glows and emits embers. Element lives in the anatomy, not just the hue.
//   * MATERIAL — fur is shaded and tufted, leaves are veined, water is
//     semi-transparent, flame is additive, claws/horns are hard and matte.
//   * EVOLUTION— `stage` grows the body, lengthens the limbs, sharpens the face
//     and enlarges the signature feature instead of just scaling the sprite.
// =============================================================================
import { getSpecies, getEvolutionStage } from '../data/species.js';
import { getMutation } from '../data/mutations.js';
import { adjustColor, shadeColor } from '../core/utils.js';

// ------------------------------------------------------------------ palette
function pal(speciesId, mutation) {
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
function ell(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Ellipse with a soft top-light / bottom-shadow gradient: reads as volume. */
function volume(ctx, x, y, rx, ry, top, bottom, rot = 0) {
  const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ell(ctx, x, y, rx, ry, g, rot);
}

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2, color, w, cap = 'round') {
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = cap;
  ctx.stroke();
}

/** A leaf blade with a midrib and side veins. */
function leaf(ctx, x, y, len, wid, angle, color, vein, veins = 3) {
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
function limb(ctx, x, y, len, w, color, pawColor, bend = 0, toes = 3) {
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
function furTufts(ctx, cx, cy, r, from, to, count, len, color) {
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
function waterRibbon(ctx, cx, cy, r, phase, color, width = 3, span = 1.5) {
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
function flame(ctx, x, y, h, w, t, seed = 0) {
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
const EXPRESSIONS = {
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
function eye(ctx, x, y, r0, colour, shape = 'round', ex = EXPRESSIONS.neutral, dark = '#101821') {
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

function brow(ctx, x, y, w, ex, color, mirrored = false) {
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
function mouth(ctx, x, y, w, ex, color, fangs = 0) {
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

// ------------------------------------------------------------------ entry point
/**
 * Draw a Mythling.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o
 *   speciesId, stage, mutation, x, y, size, t, facing(1|-1), shadow
 *   pose: { bob, lean, squash, alpha, tilt, expression, action, excite }
 */
export function drawMythling(ctx, o) {
  const {
    speciesId, stage = 0, mutation = 'none', x, y, size = 100, t = 0,
    facing = 1, pose = {}, shadow = true,
  } = o;
  const sp = getSpecies(speciesId);
  if (!sp) return;
  const evo = getEvolutionStage(speciesId, stage);
  const c = pal(speciesId, mutation);
  const s = (size / 100) * (evo.art?.scale || 1);
  const bob = pose.bob ?? Math.sin(t * 2.2) * 2.0;
  const lean = pose.lean || 0;
  const squash = pose.squash ?? 1;
  const alpha = pose.alpha ?? 1;
  const tilt = pose.tilt || 0;
  const expression = EXPRESSIONS[pose.expression] || EXPRESSIONS.neutral;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (shadow) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.3;
    const g = ctx.createRadialGradient(x, y + 3, 2, x, y + 3, 36 * s);
    g.addColorStop(0, 'rgba(6,16,10,0.75)');
    g.addColorStop(1, 'rgba(6,16,10,0)');
    ell(ctx, x, y + 3, 34 * s, 9 * s, g);
    ctx.restore();
  }

  ctx.translate(x + lean, y + bob);
  ctx.rotate(tilt);
  ctx.scale(facing * s, s * squash);

  // mutation aura behind the body
  const mut = getMutation(mutation);
  if (mut.aura) {
    const g = ctx.createRadialGradient(0, -36, 4, 0, -36, 64);
    g.addColorStop(0, mut.aura.color.replace(/[\d.]+\)$/, '0.32)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -36, 64, 0, Math.PI * 2); ctx.fill();
  }

  // `grow` drives evolution proportions: longer limbs, smaller head ratio.
  const ex = {
    horns: !!evo.art?.horns,
    wings: !!evo.art?.wings,
    stage,
    grow: Math.min(1, stage * 0.5),
    face: expression,
    excite: pose.excite ?? 0,
    action: pose.action || 'idle',
  };

  const body = sp.art.body;
  if (body === 'fox') drawSpriggo(ctx, c, t, ex);
  else if (body === 'feline') drawAquini(ctx, c, t, ex);
  else if (body === 'dragon') drawEmberu(ctx, c, t, ex);
  else if (body === 'wolf') drawRivruff(ctx, c, t, ex);
  else if (body === 'avian') drawLeaflet(ctx, c, t, ex);

  // mutation motes
  if (mut.aura) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = t * 1.4 + (i / n) * Math.PI * 2;
      const rx = Math.cos(a) * 42, ry = Math.sin(a * 1.3) * 28 - 36;
      ctx.globalAlpha = alpha * (0.3 + 0.4 * Math.sin(t * 3 + i));
      if (mutation === 'shiny') {
        poly(ctx, [[rx, ry - 3], [rx + 1.2, ry], [rx, ry + 3], [rx - 1.2, ry]], mut.aura.color);
      } else {
        ell(ctx, rx, ry, 3.2, 3.2, mut.aura.color);
      }
    }
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
}

// =============================================================================
// Shared quadruped skeleton. Anchors are tuned per species but derived here so
// every creature stands on the same ground line with believable limb length.
// =============================================================================
function rig(ex, o = {}) {
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

// =============================================================================
// SPRIGGO — Nature Fox.  Signature: broad leaf-blade tail held high, vine
// bracers, shoulder sprouts, tall notched ears, seed pendant.
// Personality: brave, curious, energetic (alert stance, tail raised).
// =============================================================================
function drawSpriggo(ctx, c, t, ex) {
  const r = rig(ex, { legLen: 22, legW: 5.2 });
  const g = r.g;
  const sway = Math.sin(t * 2.3) * 0.16;
  const breathe = Math.sin(t * 2.2) * 0.6;

  // ---------- TAIL: one huge leaf blade sweeping up behind (silhouette hook)
  ctx.save();
  ctx.translate(r.hipX - 8, r.bodyY + 2);
  ctx.rotate(0.42 + sway * 0.6);
  const tl = 46 + g * 20, tw = 19 + g * 8;
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
  for (let i = 1; i <= 4; i++) {
    const p = i / 5;
    const bx = -11 - (tl - 12) * p, by = -7 - tw * 0.95 * p;
    line(ctx, bx, by, bx - 5, by - tw * 0.42, shadeColor(c.dark, 0.12), 1);
  }
  ctx.restore();

  // ---------- far legs
  limb(ctx, r.hipX - 2, r.bodyY + 8, r.legLen, r.legW * 0.92, c.shadow, c.secondary, -1.6);
  limb(ctx, r.shoX + 5, r.bodyY + 8, r.legLen - 1, r.legW * 0.9, c.shadow, c.secondary, 1.4);

  // ---------- haunch + chest
  volume(ctx, r.hipX, r.bodyY, 16 + g * 4, 15 + g * 3, c.light, c.shadow);
  volume(ctx, r.shoX, r.bodyY - 1, 17 + g * 4, 14 + g * 3, c.light, c.shadow);
  // neck connecting chest to head
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(r.shoX + 2, r.bodyY - 10);
  ctx.quadraticCurveTo(r.headX - 4, r.bodyY - 16, r.headX - 1, r.headY + 9);
  ctx.lineTo(r.headX + 8, r.headY + 10);
  ctx.quadraticCurveTo(r.shoX + 16, r.bodyY - 12, r.shoX + 14, r.bodyY - 2);
  ctx.closePath();
  ctx.fillStyle = c.primary; ctx.fill();
  ctx.restore();
  ell(ctx, r.shoX + 3, r.bodyY + 5 + breathe * 0.2, 11 + g * 2, 8.6 + g, c.belly);
  furTufts(ctx, r.shoX + 3, r.bodyY + 3, 9, 0.2, 2.5, 5, 5, c.belly);

  // shoulder sprouts
  leaf(ctx, r.shoX - 8, r.bodyY - 13, 15 + g * 7, 5 + g, -1.25 + Math.sin(t * 2) * 0.06, c.accent, c.dark, 2);
  leaf(ctx, r.shoX - 1, r.bodyY - 14, 13 + g * 6, 4.4 + g, -0.82 + Math.sin(t * 2 + 1) * 0.06, c.primary, c.dark, 2);
  if (ex.stage >= 1) {
    leaf(ctx, r.hipX - 2, r.bodyY - 13, 14, 4.6, -1.6, c.accent, c.dark, 2);
    leaf(ctx, r.hipX + 6, r.bodyY - 15, 12, 4.2, -1.35, c.primary, c.dark, 2);
  }

  // ---------- near legs + vine bracers
  limb(ctx, r.hipX + 4, r.bodyY + 9, r.legLen, r.legW, c.primary, c.belly, -1.4);
  limb(ctx, r.shoX + 11, r.bodyY + 9, r.legLen - 1, r.legW * 0.96, c.primary, c.belly, 1.2);
  ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8;
  for (const lx of [r.hipX + 4, r.shoX + 11]) {
    ctx.beginPath(); ctx.arc(lx, r.bodyY + 18, 5.6, 0.15, 2.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(lx, r.bodyY + 24, 5.2, 0.3, 2.7); ctx.stroke();
  }
  leaf(ctx, r.shoX + 14, r.bodyY + 14, 8, 3, -1.15, c.accent, null, 1);
  // seed pendant
  ell(ctx, r.shoX + 6, r.bodyY + 9, 2.8, 3.4, c.dark);
  ell(ctx, r.shoX + 6, r.bodyY + 8.4, 1.6, 2.0, c.accent);

  // ---------- head
  ctx.save();
  ctx.translate(r.headX, r.headY + breathe * 0.3); ctx.scale(r.headS, r.headS);
  // ears: tall, notched, inner leaf
  poly(ctx, [[-7, -7], [-17, -31], [-10, -27], [-3, -11]], c.secondary);
  poly(ctx, [[-7.6, -9], [-13.5, -26], [-6.5, -15]], c.accent);
  poly(ctx, [[7, -8], [17, -30], [16, -22], [14, -24], [13, -7]], c.secondary);
  poly(ctx, [[8, -9], [14, -24], [12.6, -11]], c.accent);
  if (ex.horns) {
    for (let i = -1; i <= 1; i++) {
      poly(ctx, [[i * 7 - 2, -13], [i * 7 + 0.6, -27 - (1 - Math.abs(i)) * 6], [i * 7 + 3.4, -12]], c.dark);
    }
  }
  volume(ctx, 0, -2, 14.5, 12.8, c.light, c.shadow);      // skull
  volume(ctx, 11, 4, 10, 6.6, shadeColor(c.primary, 0.08), c.shadow); // muzzle
  ell(ctx, 13, 6, 7.6, 4.4, c.belly);
  furTufts(ctx, -7, 2, 10, 1.4, 3.2, 4, 5, c.belly);
  ell(ctx, 19, 3.4, 2.6, 2.1, '#2b2b2b');
  ell(ctx, 18.6, 2.8, 0.9, 0.7, 'rgba(255,255,255,.55)');
  mouth(ctx, 14, 8.4, 7.4, ex.face, '#3a2a22', ex.face.mouth < 0 ? 2 : 0);
  eye(ctx, 6.4, -2.4, 4.0, c.eye, 'round', ex.face);
  eye(ctx, -5.6, -2.4, 3.5, c.eye, 'round', ex.face);
  brow(ctx, 6.4, -8, 7, ex.face, c.dark);
  brow(ctx, -5.6, -8, 6, ex.face, c.dark, true);
  leaf(ctx, -11, 3, 8.5, 3.2, 0.5, c.accent, null, 1);
  ctx.restore();

  // drifting leaf motes
  ctx.globalAlpha *= 0.5;
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.6 + i * 0.33) % 1;
    leaf(ctx, -34 - p * 14, r.bodyY - 22 + Math.sin(t * 2 + i) * 6 + p * 12, 6, 2.2, p * 5, c.accent, null, 0);
  }
  ctx.globalAlpha /= 0.5;
}

// =============================================================================
// AQUINI — Water Feline.  Signature: translucent fin-ears, S-curved crescent
// water tail, gill flashes, dorsal fin, streamlined build.
// Personality: clever, playful, fast (low crouch, weight forward).
// =============================================================================
function drawAquini(ctx, c, t, ex) {
  const r = rig(ex, { legLen: 20, legW: 4.4, bodyY: -32, headY: -54 });
  const g = r.g;
  const sway = Math.sin(t * 2.7) * 0.22;
  const breathe = Math.sin(t * 2.4) * 0.5;

  // ---------- TAIL: S-curve ending in a crescent fin
  ctx.save();
  ctx.translate(r.hipX - 10, r.bodyY + 4);
  ctx.rotate(sway * 0.4);
  const L = 30 + g * 12;
  ctx.beginPath();                              // tapered tail body
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-L * 0.6, 10, -L * 1.0, -6, -L * 1.15, -22 - g * 8);
  ctx.lineTo(-L * 0.92, -22 - g * 8);
  ctx.bezierCurveTo(-L * 0.8, -6, -L * 0.45, 4, 0, -3);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, 0, -L, -20);
  tg.addColorStop(0, c.primary); tg.addColorStop(1, c.secondary);
  ctx.fillStyle = tg; ctx.fill();
  // crescent fin at the tip
  ctx.save();
  ctx.globalAlpha *= 0.72;
  // two-lobed crescent, like a fish fluke
  ctx.beginPath();
  ctx.moveTo(-L * 1.03, -21 - g * 8);
  ctx.bezierCurveTo(-L * 1.5, -40 - g * 14, -L * 1.75, -30 - g * 11, -L * 1.34, -19 - g * 7);
  ctx.bezierCurveTo(-L * 1.62, -16 - g * 5, -L * 1.5, -2 - g * 2, -L * 1.05, -13 - g * 5);
  ctx.closePath();
  const fg = ctx.createLinearGradient(-L * 1.0, -34, -L * 1.5, -6);
  fg.addColorStop(0, shadeColor(c.accent, 0.15));
  fg.addColorStop(1, c.accent);
  ctx.fillStyle = fg; ctx.fill();
  ctx.strokeStyle = shadeColor(c.secondary, 0.1); ctx.lineWidth = 0.9;
  for (let i = 0; i < 3; i++) {
    line(ctx, -L * 1.06, -20 - g * 7, -L * (1.3 + i * 0.1), -30 - g * 10 + i * 9, ctx.strokeStyle, 0.9);
  }
  ctx.restore();
  ctx.restore();

  ctx.globalAlpha *= 0.55;                       // droplet trail
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.9 + i * 0.25) % 1;
    ell(ctx, r.hipX - 40 - p * 16, r.bodyY - 22 - p * 14 + Math.sin(t * 3 + i) * 3, 2.2 - p, 2.9 - p, c.accent);
  }
  ctx.globalAlpha /= 0.55;

  // ---------- legs (slim, springy)
  limb(ctx, r.hipX - 1, r.bodyY + 7, r.legLen, r.legW * 0.92, c.shadow, c.secondary, -1.3);
  limb(ctx, r.shoX + 5, r.bodyY + 7, r.legLen - 2, r.legW * 0.9, c.shadow, c.secondary, 1.1);

  // ---------- long low torso
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
  ell(ctx, r.shoX + 2, r.bodyY + 4 + breathe * 0.2, 10 + g * 2, 6.8 + g, c.belly);
  // wave stripes
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const bx = r.hipX - 4 + i * 8;
    ctx.beginPath();
    ctx.moveTo(bx, r.bodyY - 11);
    ctx.quadraticCurveTo(bx + 3.5, r.bodyY - 6, bx, r.bodyY - 1);
    ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8; ctx.stroke();
  }
  // dorsal fin
  ctx.save(); ctx.globalAlpha *= 0.9;
  poly(ctx, [[r.hipX + 6, r.bodyY - 12], [r.hipX + 12, r.bodyY - 26 - g * 6], [r.hipX + 17, r.bodyY - 11]], c.accent);
  ctx.restore();

  limb(ctx, r.hipX + 5, r.bodyY + 8, r.legLen, r.legW, c.primary, c.belly, -1.2);
  limb(ctx, r.shoX + 11, r.bodyY + 8, r.legLen - 2, r.legW * 0.96, c.primary, c.belly, 1.0);
  poly(ctx, [[r.hipX + 1, r.bodyY + 20], [r.hipX - 6, r.bodyY + 15], [r.hipX + 1, r.bodyY + 14]], c.accent);
  poly(ctx, [[r.shoX + 7, r.bodyY + 19], [r.shoX + 1, r.bodyY + 14], [r.shoX + 7, r.bodyY + 13]], c.accent);

  // splash ring under the front paws (playful pose)
  ctx.save(); ctx.globalAlpha *= 0.4;
  ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(r.shoX + 9, 0, 13 + Math.sin(t * 3) * 2, 3.4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // ---------- head
  ctx.save();
  ctx.translate(r.headX, r.headY + breathe * 0.3); ctx.scale(r.headS, r.headS);
  // fin-ears: big translucent webbing (signature)
  ctx.save();
  ctx.globalAlpha *= 0.68;
  ctx.beginPath();
  ctx.moveTo(-6, -9);
  ctx.quadraticCurveTo(-26, -27 - g * 6, -22, -4);
  ctx.quadraticCurveTo(-14, -10, -3, -11);
  ctx.closePath(); ctx.fillStyle = c.accent; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, -10);
  ctx.quadraticCurveTo(24, -25 - g * 6, 20, -2);
  ctx.quadraticCurveTo(13, -9, 4, -11);
  ctx.closePath(); ctx.fillStyle = c.accent; ctx.fill();
  ctx.restore();
  poly(ctx, [[-7, -8], [-15, -24 - g * 4], [-2, -12]], c.secondary);   // ear cores
  poly(ctx, [[6, -9], [15, -23 - g * 4], [14, -6]], c.secondary);
  ctx.strokeStyle = shadeColor(c.accent, -0.2); ctx.lineWidth = 1;
  line(ctx, -9, -11, -19, -18, ctx.strokeStyle, 1);
  line(ctx, 9, -11, 18, -16, ctx.strokeStyle, 1);
  if (ex.horns) {
    ctx.save(); ctx.globalAlpha *= 0.85;
    poly(ctx, [[-3, -12], [2, -32], [6, -19], [10, -28], [11, -11]], c.accent);
    ctx.restore();
  }
  volume(ctx, 0, -2, 13.4, 11.8, c.light, c.shadow);
  volume(ctx, 10, 3.6, 9, 5.8, shadeColor(c.primary, 0.08), c.shadow);
  ell(ctx, 11.5, 5.2, 6.8, 3.8, c.belly);
  ell(ctx, 17.4, 3, 2.3, 1.8, '#22404f');
  mouth(ctx, 13, 7.4, 6.6, ex.face, '#23404d');
  ctx.strokeStyle = c.accent;
  for (let i = 0; i < 3; i++) line(ctx, -13 + i * 1.6, 0 + i * 3, -7 + i * 1.6, 1 + i * 3, c.accent, 1.5);
  eye(ctx, 6.2, -2.4, 4.1, c.eye, 'almond', ex.face);
  eye(ctx, -5.8, -2.4, 3.6, c.eye, 'almond', ex.face);
  brow(ctx, 6.2, -8, 7, ex.face, c.dark);
  brow(ctx, -5.8, -8, 6, ex.face, c.dark, true);
  line(ctx, 14, 3.4, 26, 0, 'rgba(255,255,255,0.72)', 0.9);
  line(ctx, 14, 5.6, 26, 8, 'rgba(255,255,255,0.72)', 0.9);
  ctx.restore();
}

// =============================================================================
// EMBERU — Fire Dragon.  Signature: thick swept horns with ember tips, forehead
// and chest ember gems, membraned wings, flame tail that reacts to excitement.
// Personality: confident, mischievous, fierce (chest out, tail raised).
// =============================================================================
function drawEmberu(ctx, c, t, ex) {
  const r = rig(ex, { legLen: 20, legW: 6, bodyY: -35, headY: -58 });
  const g = r.g;
  const flap = Math.sin(t * 5) * 0.34;
  const breathe = Math.sin(t * 2.6) * 0.6;
  const heat = 1 + ex.excite * 0.8;
  const pulse = 0.55 + Math.sin(t * 3.4) * 0.25 + ex.excite * 0.2;

  // ---------- wings behind the body
  const wing = (scale, alpha) => {
    ctx.save();
    ctx.translate(r.hipX + 12, r.bodyY - 14 - g * 4); ctx.rotate(0.5 + flap * 0.55);
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
  wing(ex.wings ? 1.15 : 0.5, 1);

  // ---------- TAIL + flame (raised behind)
  ctx.save();
  ctx.translate(r.hipX - 8, r.bodyY + 4);
  ctx.rotate(-0.25 + Math.sin(t * 2) * 0.1);
  const TL = 30 + g * 12;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.quadraticCurveTo(-TL * 0.7, 4, -TL, -12 - g * 6);
  ctx.quadraticCurveTo(-TL * 0.62, -6, 0, -6);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, 0, -TL, -12);
  tg.addColorStop(0, c.primary); tg.addColorStop(1, c.secondary);
  ctx.fillStyle = tg; ctx.fill();
  for (let i = 0; i < 3; i++) {
    poly(ctx, [[-8 - i * 8, -4 - i * 2.4], [-11 - i * 8, -12 - i * 3], [-15 - i * 8, -4 - i * 2.4]], c.dark);
  }
  flame(ctx, -TL - 2, -13 - g * 6, (20 + g * 10) * heat, (8 + g * 3) * heat, t, 1.2);
  ctx.restore();

  // ---------- legs
  limb(ctx, r.hipX - 2, r.bodyY + 8, r.legLen, r.legW * 0.95, c.shadow, c.secondary, -1.7, 3);
  limb(ctx, r.shoX + 5, r.bodyY + 8, r.legLen - 1, r.legW * 0.92, c.shadow, c.secondary, 1.5, 3);

  // ---------- barrel chest
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
  ell(ctx, r.shoX + 4, r.bodyY + 4 + breathe * 0.2, 11.5 + g * 2, 10 + g, c.belly);
  ctx.strokeStyle = c.bellyShade; ctx.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(r.shoX - 3, r.bodyY + 4 + i * 3.8);
    ctx.quadraticCurveTo(r.shoX + 4, r.bodyY + 6 + i * 3.8, r.shoX + 12, r.bodyY + 4 + i * 3.8);
    ctx.stroke();
  }
  // dorsal ridge
  for (let i = 0; i < 4; i++) {
    const bx = r.hipX - 6 + i * 9;
    poly(ctx, [[bx, r.bodyY - 13 + i * 1.2], [bx + 4, r.bodyY - 25 - g * 4 + i], [bx + 8, r.bodyY - 12 + i * 1.2]], c.dark);
  }
  // chest ember gem
  ctx.save(); ctx.globalAlpha *= pulse;
  ell(ctx, r.shoX + 6, r.bodyY + 1, 5.6, 6, '#ffdc8a');
  ctx.restore();
  poly(ctx, [[r.shoX + 6, r.bodyY - 3.5], [r.shoX + 9.4, r.bodyY + 1], [r.shoX + 6, r.bodyY + 5.5], [r.shoX + 2.6, r.bodyY + 1]], '#ff8a2a');

  limb(ctx, r.hipX + 5, r.bodyY + 9, r.legLen, r.legW, c.primary, c.belly, -1.5, 3);
  limb(ctx, r.shoX + 12, r.bodyY + 9, r.legLen - 1, r.legW * 0.96, c.primary, c.belly, 1.3, 3);

  // ---------- head
  ctx.save();
  ctx.translate(r.headX, r.headY + breathe * 0.3); ctx.scale(r.headS, r.headS);
  // thick swept horns with ember tips
  const horn = (sx, scale) => {
    const len = (26 + g * 10) * scale, base = (8 + g * 2) * scale;
    const tipX = sx - len * 0.78, tipY = -len * 0.72;   // sweeps back over the skull
    const dir = -1;
    ctx.beginPath();
    ctx.moveTo(sx + base * 0.45, -7);                                           // front of the base
    ctx.quadraticCurveTo(sx - len * 0.12, -len * 0.82, tipX, tipY);             // upper edge
    ctx.quadraticCurveTo(sx - len * 0.3, -len * 0.34, sx - base * 0.5, -5);     // lower edge
    ctx.closePath();
    const hg = ctx.createLinearGradient(sx, -4, tipX, tipY);
    hg.addColorStop(0, shadeColor(c.dark, 0.2));
    hg.addColorStop(0.75, c.deep);
    hg.addColorStop(1, shadeColor(c.secondary, -0.1));
    ctx.fillStyle = hg; ctx.fill();
    // ridges along the horn
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const p = i / 4.2;
      const px = sx + (tipX - sx) * p, py = -len * 0.74 * p - 5;
      line(ctx, px, py - base * 0.22, px + base * 0.18, py + base * (0.4 - p * 0.24), 'rgba(0,0,0,.22)', 1);
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= pulse * 0.9;
    ell(ctx, tipX + 1.2, tipY + 1.2, 3.0, 3.4, '#ff9a3c');
    ell(ctx, tipX + 1.2, tipY + 1.2, 1.4, 1.8, '#ffe8a8');
    ctx.restore();
  };
  horn(6.5, 0.9);    // near horn, long
  horn(-3.5, 0.72);  // far horn, shorter + offset (reads as depth)
  volume(ctx, 0, -2, 15, 13.2, c.light, c.shadow);
  poly(ctx, [[-13, -5], [0, -13], [13, -5], [0, -8]], shadeColor(c.primary, -0.1));  // brow ridge
  volume(ctx, 12, 4, 10.6, 7.2, shadeColor(c.primary, 0.05), c.shadow);
  ell(ctx, 14, 6.4, 7.8, 4.4, c.belly);
  ell(ctx, 19.5, 3, 1.7, 1.4, '#3a1a10');
  ctx.save(); ctx.globalAlpha *= 0.3;
  ell(ctx, 23 + Math.sin(t * 2) * 2, 1 - ((t * 7) % 9), 3, 2.4, '#e6e6e6');
  ctx.restore();
  mouth(ctx, 15, 8.6, 8.4, ex.face, '#4a1a10', 2);
  ctx.save(); ctx.globalAlpha *= pulse;              // forehead gem
  ell(ctx, 1, -10, 4.6, 5, '#ffe28a');
  ctx.restore();
  poly(ctx, [[1, -14.4], [4, -10], [1, -5.6], [-2, -10]], '#ff8a2a');
  eye(ctx, 6.8, -1.6, 3.9, c.eye, 'sharp', ex.face);
  eye(ctx, -5.6, -1.6, 3.4, c.eye, 'sharp', ex.face);
  brow(ctx, 6.8, -7.2, 7.4, ex.face, c.dark);
  brow(ctx, -5.6, -7.2, 6.4, ex.face, c.dark, true);
  ctx.fillStyle = shadeColor(c.secondary, 0.12);
  for (let i = 0; i < 3; i++) ell(ctx, -10 + i * 2.2, 3 + i * 2.6, 1.6, 1.2, ctx.fillStyle);
  ctx.restore();

  // rising embers
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.8 + i * 0.27) % 1;
    ctx.globalAlpha = (1 - p) * 0.7;
    ell(ctx, r.hipX - 26 + Math.sin(t * 3 + i * 2) * 5, r.bodyY - 10 - p * 36, 2 - p, 2 - p, '#ffb347');
  }
  ctx.restore();
}

// =============================================================================
// RIVRUFF — Water Wolf.  Signature: living water mane over the shoulders, slab
// paws, curling wave tail, layered fur, droopy ears.
// Personality: calm, sleepy, immovable (low heavy stance).
// =============================================================================
function drawRivruff(ctx, c, t, ex) {
  const r = rig(ex, { legLen: 19, legW: 7, bodyY: -34, headY: -56, headX: 19 });
  const g = r.g;
  const phase = t * 1.4;
  const breathe = Math.sin(t * 1.7) * 0.8;

  // ---------- TAIL: curling wave crest
  ctx.save();
  ctx.translate(r.hipX - 12, r.bodyY + 4);
  ctx.rotate(Math.sin(t * 1.5) * 0.08);
  const TL = 30 + g * 12;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-TL * 0.7, 10, -TL * 1.25, -4, -TL * 1.1, -22 - g * 8);
  ctx.bezierCurveTo(-TL * 0.95, -32 - g * 10, -TL * 0.6, -24, -TL * 0.55, -14);
  ctx.bezierCurveTo(-TL * 0.5, -4, -TL * 0.3, 0, 0, -4);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, 6, -TL, -24);
  tg.addColorStop(0, c.secondary); tg.addColorStop(1, shadeColor(c.accent, -0.02));
  ctx.fillStyle = tg; ctx.fill();
  // curling foam crest at the tip
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-TL * 1.12, -18 - g * 7);
  ctx.bezierCurveTo(-TL * 1.35, -34 - g * 11, -TL * 0.72, -40 - g * 12, -TL * 0.6, -24 - g * 7);
  ctx.bezierCurveTo(-TL * 0.72, -31 - g * 9, -TL * 1.0, -28 - g * 8, -TL * 0.92, -16 - g * 5);
  ctx.closePath();
  const fg = ctx.createLinearGradient(-TL, -36, -TL * 0.7, -14);
  fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, shadeColor(c.accent, 0.18));
  ctx.fillStyle = fg; ctx.fill();
  ctx.globalAlpha *= 0.8;
  for (let i = 0; i < 3; i++) {
    ell(ctx, -TL * (1.15 + i * 0.06), -30 - g * 9 - i * 5 + Math.sin(t * 2 + i) * 2, 2.4 - i * 0.4, 2.8 - i * 0.4, '#eaf7ff');
  }
  ctx.restore();
  ctx.restore();

  // ---------- legs: thick columns
  limb(ctx, r.hipX - 3, r.bodyY + 8, r.legLen, r.legW * 0.95, c.shadow, c.secondary, -1.8, 4);
  limb(ctx, r.shoX + 5, r.bodyY + 8, r.legLen - 1, r.legW * 0.92, c.shadow, c.secondary, 1.6, 4);

  // ---------- heavy torso
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
  ell(ctx, r.shoX + 4, r.bodyY + 5 + breathe * 0.2, 12.5 + g * 2, 10 + g, c.belly);
  furTufts(ctx, r.hipX + 2, r.bodyY - 2, 19 + g * 3, -2.95, -0.55, 7, 7.5, shadeColor(c.primary, -0.14));
  furTufts(ctx, r.hipX - 10, r.bodyY + 8, 9, 0.6, 2.4, 4, 6, c.belly);
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {                      // aquatic flank marks
    ctx.beginPath();
    ctx.moveTo(r.hipX - 5 + i * 10, r.bodyY - 9);
    ctx.quadraticCurveTo(r.hipX + i * 10, r.bodyY - 4, r.hipX - 5 + i * 10, r.bodyY + 1);
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.stroke();
  }

  limb(ctx, r.hipX + 5, r.bodyY + 9, r.legLen, r.legW, c.primary, c.belly, -1.6, 4);
  limb(ctx, r.shoX + 13, r.bodyY + 9, r.legLen - 1, r.legW * 0.96, c.primary, c.belly, 1.4, 4);

  // ---------- water mane over the shoulders (signature) — clipped to an arc so
  // it reads as a flowing ruff instead of floating rings.
  const mx = r.shoX - 1, my = r.bodyY - 12;
  const maneR = 21 + g * 6;
  ctx.save();
  // one solid, wavy ruff silhouette — the mane must read at thumbnail size
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
  // water flowing inside the mane
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    waterRibbon(ctx, mx, my, maneR * (0.5 + i * 0.2), phase + i * 1.25 - 2.7, '#eaf7ff', 4 - i * 0.6, 1.7);
  }
  ctx.restore();
  // spiky highlights along the mane edge give it fur/water material
  furTufts(ctx, mx, my, maneR * 1.04, -2.8, -0.2, 7, 9 + g * 3, shadeColor(c.accent, 0.18));
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= 0.65;               // dripping water
  for (let i = 0; i < 3; i++) {
    const p = (t * 1.1 + i * 0.33) % 1;
    ell(ctx, r.shoX - 8 + i * 11, r.bodyY - 6 + p * 18, 1.8, 2.8 + p, c.accent);
  }
  ctx.restore();

  // ---------- head
  ctx.save();
  ctx.translate(r.headX, r.headY + breathe * 0.3); ctx.scale(r.headS, r.headS);
  ctx.beginPath();                                   // droopy ears
  ctx.moveTo(-8, -9);
  ctx.quadraticCurveTo(-24, -12, -20, 8);
  ctx.quadraticCurveTo(-11, 2, -4, -7);
  ctx.closePath(); ctx.fillStyle = c.secondary; ctx.fill();
  ell(ctx, -15, -1, 3.4, 6, shadeColor(c.accent, -0.08), -0.32);
  ctx.beginPath();
  ctx.moveTo(9, -10);
  ctx.quadraticCurveTo(23, -9, 20, 9);
  ctx.quadraticCurveTo(12, 2, 7, -7);
  ctx.closePath(); ctx.fillStyle = c.secondary; ctx.fill();
  ell(ctx, 15, 0, 3.2, 5.6, shadeColor(c.accent, -0.08), 0.3);
  if (ex.horns) {
    ctx.save(); ctx.globalAlpha *= 0.85;
    poly(ctx, [[-4, -13], [0, -33], [4, -19], [8, -30], [11, -13]], c.accent);
    ctx.restore();
  }
  volume(ctx, 0, -2, 15.5, 13.4, c.light, c.shadow);
  volume(ctx, 12, 4.5, 11, 7.6, shadeColor(c.primary, 0.06), c.shadow);
  ell(ctx, 14, 6.6, 8.4, 4.8, c.belly);
  ell(ctx, 21, 3.6, 2.8, 2.2, '#26323f');
  mouth(ctx, 15, 9.4, 7.8, ex.face, '#26323f');
  eye(ctx, 6.8, -2, 3.7, c.eye, 'droop', ex.face);
  eye(ctx, -5.2, -2, 3.3, c.eye, 'droop', ex.face);
  brow(ctx, 6.8, -7.6, 7, ex.face, c.dark);
  brow(ctx, -5.2, -7.6, 6, ex.face, c.dark, true);
  ctx.restore();
}

// =============================================================================
// LEAFLET — Nature Avian.  Signature: three-leaf crest, leaf-feather wings,
// curled stem tail, twig legs. Personality: hyperactive, cheerful (in the air).
// =============================================================================
function drawLeaflet(ctx, c, t, ex) {
  const g = ex.grow;
  const flap = Math.sin(t * 8) * 0.6;
  const hover = Math.sin(t * 3.2) * 1.6;
  const by = -34 - g * 6 + hover;

  // ---------- stem tail with a curl
  ctx.save();
  ctx.translate(-14, by + 4);
  ctx.rotate(Math.sin(t * 2.4) * 0.12);
  ctx.strokeStyle = c.dark; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(-10, -2, -18, -9); ctx.stroke();
  ctx.beginPath(); ctx.arc(-3, 3, 3.6, -1.2, 3.4); ctx.stroke();
  leaf(ctx, -16, -8, 20 + g * 8, 6.6 + g * 2, -0.68, c.primary, c.dark, 3);
  leaf(ctx, -16, -8, 19 + g * 8, 6.2 + g * 2, -0.14, c.accent, c.dark, 3);
  leaf(ctx, -16, -8, 17 + g * 8, 5.6 + g * 2, 0.42, c.primary, c.dark, 3);
  ctx.restore();

  // ---------- twig legs
  ctx.strokeStyle = '#b08542'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (const lx of [-4, 7]) {
    ctx.beginPath(); ctx.moveTo(lx, by + 12); ctx.lineTo(lx - 1, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx - 1, -2); ctx.lineTo(lx + 5, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx - 1, -2); ctx.lineTo(lx - 6, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx - 1, -2); ctx.lineTo(lx - 2, 2); ctx.stroke();
  }

  // ---------- plump body with feather shingles
  volume(ctx, 0, by, 17 + g * 4, 16.5 + g * 3.5, c.light, c.shadow);
  ell(ctx, 4, by + 5, 11 + g * 2, 10 + g * 2, c.belly);
  for (let i = 0; i < 4; i++) {
    leaf(ctx, -13 + i * 3.6, by - 9 + i * 4.6, 13 + g * 4, 4.4 + g, 2.72 + i * 0.12, i % 2 ? c.accent : c.secondary, c.dark, 2);
  }

  // ---------- wing
  ctx.save();
  ctx.translate(4, by + 1); ctx.rotate(flap * (ex.wings ? 1.2 : 0.9));
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.quadraticCurveTo(-11, 8, -24 - g * 7, 14 + g * 4);
  ctx.quadraticCurveTo(-9, 15, 3, 6);
  ctx.closePath();
  ctx.fillStyle = c.secondary; ctx.fill();
  for (let i = 0; i < 3; i++) {
    leaf(ctx, -3 - i * 3.4, 1 + i * 3.6, 19 + g * 6 + i * 2, 5.4, 2.42 + i * 0.17, i % 2 ? c.primary : c.accent, c.dark, 2);
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= 0.25;
  for (let i = 0; i < 3; i++) line(ctx, -18 - i * 4, by + 8 + i * 3, -30 - i * 5, by + 9 + i * 3, c.accent, 1.8);
  ctx.restore();

  // ---------- head
  const hx = 10 + g * 3, hy = by - 17 - g * 3;
  ctx.save();
  ctx.translate(hx, hy); ctx.scale(1 - g * 0.08, 1 - g * 0.08);
  leaf(ctx, -2, -11, 20 + g * 8, 5.8 + g * 1.5, -1.66 + Math.sin(t * 3) * 0.08, c.accent, c.dark, 2);
  leaf(ctx, 3, -11, 16 + g * 7, 5 + g * 1.5, -1.12 + Math.sin(t * 3 + 0.6) * 0.08, c.primary, c.dark, 2);
  leaf(ctx, -7, -10, 15 + g * 6, 4.8 + g * 1.5, -2.16 + Math.sin(t * 3 + 1.2) * 0.08, c.primary, c.dark, 2);
  if (ex.horns) leaf(ctx, 7, -10, 18, 5.4, -0.78, c.accent, c.dark, 2);
  volume(ctx, 0, 0, 12.8, 12.2, c.light, c.shadow);
  poly(ctx, [[-10, 2], [-19, 4], [-10, 8]], c.accent);
  poly(ctx, [[9, 0], [22 + g * 4, 2.8], [9, 5.4]], '#f5b544');
  poly(ctx, [[9, 5.4], [18, 4.4], [9, 7.4]], '#d99327');
  eye(ctx, 4.2, -1.4, 4.1, '#ffffff', 'bead', ex.face, '#20303c');
  eye(ctx, -6.6, -1.4, 3.6, '#ffffff', 'bead', ex.face, '#20303c');
  brow(ctx, 4.2, -7, 6.6, ex.face, c.dark);
  brow(ctx, -6.6, -7, 5.6, ex.face, c.dark, true);
  ctx.save(); ctx.globalAlpha *= 0.45;
  ell(ctx, 7.5, 5.4, 3.1, 2.1, '#ff9aa2');
  ell(ctx, -9.5, 5.4, 2.7, 1.9, '#ff9aa2');
  ctx.restore();
  ctx.restore();

  // swirling leaf motes
  ctx.globalAlpha *= 0.45;
  for (let i = 0; i < 4; i++) {
    const a = t * 2 + (i / 4) * Math.PI * 2;
    leaf(ctx, Math.cos(a) * 32, by - 6 + Math.sin(a) * 16, 6, 2.2, a, c.accent, null, 0);
  }
  ctx.globalAlpha /= 0.45;
}

/** Renders a Mythling to an offscreen canvas (used for list icons). */
export function mythlingIcon(speciesId, stage, mutation, px = 72) {
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const ctx = cv.getContext('2d');
  ctx.save();
  ctx.translate(px * 0.5, px * 0.86);
  drawMythling(ctx, {
    speciesId, stage, mutation, x: -6, y: 0, size: px * 0.72, t: 0, facing: 1, shadow: false,
  });
  ctx.restore();
  return cv;
}

/** Expression ids the renderer understands (used by the design-sheet page). */
export const EXPRESSION_IDS = Object.keys(EXPRESSIONS);
