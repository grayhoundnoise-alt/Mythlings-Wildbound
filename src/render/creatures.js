// Original procedural Mythling artwork, drawn with canvas paths.
// Every creature is built from its own body plan — no external art assets.
import { getSpecies, getEvolutionStage } from '../data/species.js';
import { getMutation } from '../data/mutations.js';
import { adjustColor, shadeColor } from '../core/utils.js';

function pal(speciesId, mutation) {
  const sp = getSpecies(speciesId);
  const base = sp.art;
  const mut = getMutation(mutation);
  if (!mut.palette) return { ...base };
  const out = {};
  for (const [k, v] of Object.entries(base)) {
    out[k] = typeof v === 'string' && v.startsWith('#') ? adjustColor(v, mut.palette) : v;
  }
  if (mutation === 'shiny') out.eye = '#fffbe0';
  if (mutation === 'darkness') out.eye = '#d8b4ff';
  return out;
}

function ell(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function stroked(ctx, color, width, fn) {
  fn();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function leaf(ctx, x, y, len, wid, angle, color, vein) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.4, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.4, wid, 0, 0);
  ctx.fillStyle = color; ctx.fill();
  if (vein) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0);
    ctx.strokeStyle = vein; ctx.lineWidth = Math.max(0.6, wid * 0.14); ctx.stroke();
  }
  ctx.restore();
}

function eye(ctx, x, y, r, colour, dark = '#15202b', shine = true) {
  ell(ctx, x, y, r * 1.02, r * 1.15, dark);
  ell(ctx, x, y, r * 0.78, r * 0.92, colour);
  ell(ctx, x, y + r * 0.1, r * 0.34, r * 0.5, '#101820');
  if (shine) ell(ctx, x - r * 0.3, y - r * 0.38, r * 0.26, r * 0.26, 'rgba(255,255,255,0.95)');
}

/**
 * Draw a Mythling.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o {speciesId, stage, mutation, x, y, size, t, facing(1|-1), pose}
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
  const bob = pose.bob ?? Math.sin(t * 2.2) * 2.2;
  const lean = pose.lean || 0;
  const squash = pose.squash ?? 1;
  const alpha = pose.alpha ?? 1;
  const tilt = pose.tilt || 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.28;
    ell(ctx, x, y + 4, 34 * s, 9 * s, '#0a1a10');
    ctx.restore();
  }
  ctx.translate(x + lean, y + bob);
  ctx.rotate(tilt);
  ctx.scale(facing * s, s * squash);

  // Mutation aura behind the creature
  const mut = getMutation(mutation);
  if (mut.aura) {
    const g = ctx.createRadialGradient(0, -34, 4, 0, -34, 62);
    g.addColorStop(0, mut.aura.color.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -34, 62, 0, Math.PI * 2); ctx.fill();
  }

  const body = sp.art.body;
  const extra = { horns: !!evo.art?.horns, wings: !!evo.art?.wings, stage };
  if (body === 'fox') drawFox(ctx, c, t, extra);
  else if (body === 'feline') drawFeline(ctx, c, t, extra);
  else if (body === 'dragon') drawDragon(ctx, c, t, extra);
  else if (body === 'wolf') drawWolf(ctx, c, t, extra);
  else if (body === 'avian') drawAvian(ctx, c, t, extra);

  // Mutation sparkles / shadow motes
  if (mut.aura) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = t * 1.4 + (i / n) * Math.PI * 2;
      const rx = Math.cos(a) * 40, ry = Math.sin(a * 1.3) * 26 - 34;
      ctx.globalAlpha = alpha * (0.35 + 0.35 * Math.sin(t * 3 + i));
      ell(ctx, rx, ry, mutation === 'shiny' ? 2.2 : 3.2, mutation === 'shiny' ? 2.2 : 3.2, mut.aura.color);
    }
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
}

// ------------------------------------------------- FOX (Spriggo line)
function drawFox(ctx, c, t, ex) {
  const tailSway = Math.sin(t * 2.4) * 0.22;
  // tail (leaf shaped)
  ctx.save();
  ctx.translate(-22, -26); ctx.rotate(-0.5 + tailSway);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-26, -6, -34, -30);
  ctx.quadraticCurveTo(-14, -22, 0, -10);
  ctx.closePath();
  ctx.fillStyle = c.secondary; ctx.fill();
  leaf(ctx, -30, -26, 18, 7, -0.9, c.accent, c.dark);
  leaf(ctx, -22, -14, 14, 6, -0.3, c.primary, c.dark);
  ctx.restore();

  // hind + front legs
  ell(ctx, -12, -8, 7, 9, c.secondary);
  ell(ctx, 14, -8, 6.5, 9, c.secondary);
  ell(ctx, 6, -7, 6, 8, c.primary);
  ell(ctx, -4, -7, 6.5, 8.5, c.primary);
  // vines on the front legs
  ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(6, -8, 6.5, 0.2, 2.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(14, -9, 6.5, 0.4, 2.8); ctx.stroke();
  leaf(ctx, 9, -13, 7, 3, -1.2, c.accent, null);

  // body
  ell(ctx, 0, -22, 22, 17, c.primary);
  ell(ctx, 2, -16, 15, 10, c.belly);
  // markings
  leaf(ctx, -10, -30, 12, 4.5, -0.5, c.accent, null);
  leaf(ctx, -2, -33, 10, 4, -0.2, c.accent, null);

  // head
  const hx = 18, hy = -36;
  ell(ctx, hx, hy, 15, 13.5, c.primary);
  // ears
  ctx.beginPath();
  ctx.moveTo(hx - 8, hy - 9); ctx.lineTo(hx - 13, hy - 26); ctx.lineTo(hx + 1, hy - 14); ctx.closePath();
  ctx.fillStyle = c.secondary; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx + 7, hy - 10); ctx.lineTo(hx + 13, hy - 25); ctx.lineTo(hx + 14, hy - 8); ctx.closePath();
  ctx.fillStyle = c.secondary; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx - 7, hy - 11); ctx.lineTo(hx - 10, hy - 21); ctx.lineTo(hx - 1, hy - 14); ctx.closePath();
  ctx.fillStyle = c.accent; ctx.fill();

  if (ex.horns) {
    // evolved: thorn crown
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + i * 6, hy - 12);
      ctx.lineTo(hx + i * 6 + 1.5, hy - 24 - Math.abs(i) * -4);
      ctx.lineTo(hx + i * 6 + 4, hy - 12);
      ctx.closePath();
      ctx.fillStyle = c.dark; ctx.fill();
    }
  }
  // snout
  ell(ctx, hx + 9, hy + 4, 8, 6, c.belly);
  ell(ctx, hx + 15, hy + 3, 2.4, 2, '#2b2b2b');
  // eyes
  eye(ctx, hx + 6, hy - 2, 3.6, c.eye);
  eye(ctx, hx - 5, hy - 2, 3.2, c.eye);
  // cheek marking
  leaf(ctx, hx - 9, hy + 3, 8, 3, 0.4, c.accent, null);
}

// ------------------------------------------------- FELINE (Aquini line)
function drawFeline(ctx, c, t, ex) {
  const sway = Math.sin(t * 2.6) * 0.3;
  // fish tail
  ctx.save();
  ctx.translate(-20, -28); ctx.rotate(-0.3 + sway);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-20, -4, -30, -16);
  ctx.lineTo(-38, -4); ctx.lineTo(-30, -6); ctx.lineTo(-34, 8);
  ctx.quadraticCurveTo(-18, 2, 0, 4);
  ctx.closePath();
  ctx.fillStyle = c.secondary; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-26, -10); ctx.lineTo(-33, -2); ctx.lineTo(-27, 2);
  ctx.closePath(); ctx.fillStyle = c.accent; ctx.fill();
  ctx.restore();

  // legs
  ell(ctx, -11, -8, 5.5, 8.5, c.secondary);
  ell(ctx, 13, -8, 5, 8.5, c.secondary);
  ell(ctx, 5, -7, 5, 8, c.primary);
  ell(ctx, -3, -7, 5.5, 8, c.primary);
  // droplets by the paws
  ell(ctx, 18, -3, 2.2, 3, c.accent);
  ell(ctx, -16, -3, 1.8, 2.6, c.accent);

  // sleek body
  ell(ctx, 0, -22, 21, 14, c.primary);
  ell(ctx, 2, -17, 14, 8, c.belly);

  // head
  const hx = 18, hy = -36;
  ell(ctx, hx, hy, 14, 12.5, c.primary);
  // cat ears with fins
  ctx.beginPath();
  ctx.moveTo(hx - 9, hy - 8); ctx.lineTo(hx - 12, hy - 23); ctx.lineTo(hx - 1, hy - 13); ctx.closePath();
  ctx.fillStyle = c.secondary; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx + 6, hy - 9); ctx.lineTo(hx + 12, hy - 22); ctx.lineTo(hx + 13, hy - 7); ctx.closePath();
  ctx.fillStyle = c.secondary; ctx.fill();
  // ear fins
  ctx.beginPath();
  ctx.moveTo(hx - 12, hy - 20); ctx.quadraticCurveTo(hx - 22, hy - 18, hx - 18, hy - 8);
  ctx.quadraticCurveTo(hx - 13, hy - 12, hx - 11, hy - 16); ctx.closePath();
  ctx.fillStyle = c.accent; ctx.globalAlpha *= 0.9; ctx.fill(); ctx.globalAlpha /= 0.9;
  ctx.beginPath();
  ctx.moveTo(hx + 12, hy - 19); ctx.quadraticCurveTo(hx + 22, hy - 15, hx + 17, hy - 6);
  ctx.quadraticCurveTo(hx + 13, hy - 11, hx + 11, hy - 15); ctx.closePath();
  ctx.fillStyle = c.accent; ctx.fill();

  if (ex.horns) {
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy - 12); ctx.quadraticCurveTo(hx + 2, hy - 30, hx + 8, hy - 14);
    ctx.closePath(); ctx.fillStyle = c.accent; ctx.fill();
  }

  // muzzle
  ell(ctx, hx + 8, hy + 4, 7.5, 5.5, c.belly);
  ell(ctx, hx + 13, hy + 2.5, 2.2, 1.8, '#2b3b48');
  eye(ctx, hx + 6, hy - 2, 3.8, c.eye);
  eye(ctx, hx - 5, hy - 2, 3.4, c.eye);
  // facial markings
  ctx.strokeStyle = c.accent; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(hx - 12, hy + 1); ctx.lineTo(hx - 6, hy + 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx - 11, hy + 5); ctx.lineTo(hx - 5, hy + 6); ctx.stroke();
  // whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(hx + 12, hy + 4); ctx.lineTo(hx + 22, hy + 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 12, hy + 6); ctx.lineTo(hx + 22, hy + 8); ctx.stroke();
}

// ------------------------------------------------- DRAGON (Emberu line)
function drawDragon(ctx, c, t, ex) {
  const flap = Math.sin(t * 5) * 0.4;
  // flame tail
  ctx.save();
  ctx.translate(-22, -24); ctx.rotate(Math.sin(t * 2) * 0.16);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-18, -2, -26, -16);
  ctx.quadraticCurveTo(-14, -10, 0, -8);
  ctx.closePath(); ctx.fillStyle = c.secondary; ctx.fill();
  const fl = 1 + Math.sin(t * 7) * 0.12;
  ctx.beginPath();
  ctx.moveTo(-24, -14);
  ctx.quadraticCurveTo(-36 * fl, -22 * fl, -28, -34 * fl);
  ctx.quadraticCurveTo(-24, -22, -18, -18);
  ctx.closePath(); ctx.fillStyle = '#ffb03a'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-25, -16);
  ctx.quadraticCurveTo(-31 * fl, -22, -27, -29 * fl);
  ctx.quadraticCurveTo(-24, -21, -21, -19);
  ctx.closePath(); ctx.fillStyle = '#fff0a0'; ctx.fill();
  ctx.restore();

  // wings (evolved only)
  if (ex.wings) {
    ctx.save();
    ctx.translate(-4, -34); ctx.rotate(-0.5 + flap);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-24, -26, -40, -14);
    ctx.quadraticCurveTo(-26, -8, -22, 6);
    ctx.quadraticCurveTo(-10, -2, 0, 0);
    ctx.closePath();
    ctx.fillStyle = c.dark; ctx.fill();
    ctx.fillStyle = 'rgba(255,190,120,0.55)';
    ctx.fill();
    ctx.restore();
  } else {
    // small starter wings
    ctx.save();
    ctx.translate(-2, -34); ctx.rotate(-0.4 + flap * 0.6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-14, -16, -24, -8);
    ctx.quadraticCurveTo(-14, -4, 0, 2);
    ctx.closePath();
    ctx.fillStyle = c.dark; ctx.fill();
    ctx.restore();
  }

  // chunky legs
  ell(ctx, -10, -8, 8, 10, c.secondary);
  ell(ctx, 12, -8, 7.5, 10, c.secondary);
  ell(ctx, 4, -7, 7, 9, c.primary);
  ell(ctx, -2, -7, 7.5, 9.5, c.primary);
  ctx.fillStyle = c.belly;
  for (let i = 0; i < 3; i++) ell(ctx, 8 + i * 3.4, -2, 1.5, 2.2, c.belly);

  // body
  ell(ctx, 0, -24, 22, 18, c.primary);
  ell(ctx, 3, -18, 14, 11, c.belly);
  // belly scale lines
  ctx.strokeStyle = shadeColor(c.belly, -0.12); ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(-6, -18 + i * 4); ctx.lineTo(12, -18 + i * 4); ctx.stroke();
  }
  // back spikes
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-12 + i * 9, -38 + i * 1.6);
    ctx.lineTo(-8 + i * 9, -48 + i * 1.2);
    ctx.lineTo(-4 + i * 9, -37 + i * 1.6);
    ctx.closePath(); ctx.fillStyle = c.dark; ctx.fill();
  }

  // head
  const hx = 18, hy = -38;
  ell(ctx, hx, hy, 16, 14, c.primary);
  // horns
  ctx.beginPath();
  ctx.moveTo(hx - 6, hy - 11); ctx.lineTo(hx - 12, hy - 26); ctx.lineTo(hx - 1, hy - 14); ctx.closePath();
  ctx.fillStyle = c.dark; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx + 5, hy - 11); ctx.lineTo(hx + 12, hy - 25); ctx.lineTo(hx + 12, hy - 11); ctx.closePath();
  ctx.fillStyle = c.dark; ctx.fill();
  if (ex.horns) {
    ctx.beginPath();
    ctx.moveTo(hx + 12, hy - 25); ctx.lineTo(hx + 22, hy - 32); ctx.lineTo(hx + 14, hy - 20); ctx.closePath();
    ctx.fillStyle = c.dark; ctx.fill();
  }
  // snout
  ell(ctx, hx + 11, hy + 4, 9, 6.5, c.primary);
  ell(ctx, hx + 12, hy + 6, 7, 3.6, c.belly);
  ell(ctx, hx + 16, hy + 2, 2, 1.6, '#3a1a10');
  // smoke puff
  ctx.globalAlpha *= 0.5;
  ell(ctx, hx + 22 + Math.sin(t * 2) * 2, hy - 1 - (t * 6 % 8), 3, 2.4, '#dddddd');
  ctx.globalAlpha /= 0.5;
  // ember forehead mark
  const glow = 0.6 + Math.sin(t * 4) * 0.25;
  ctx.globalAlpha *= glow;
  ell(ctx, hx + 1, hy - 8, 4.2, 4.6, '#ffe28a');
  ctx.globalAlpha /= glow;
  ell(ctx, hx + 1, hy - 8, 2.4, 2.8, '#ff8a2a');
  eye(ctx, hx + 7, hy - 1, 3.6, c.eye);
  eye(ctx, hx - 5, hy - 1, 3.2, c.eye);
  // brow (aggressive)
  ctx.strokeStyle = c.dark; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(hx + 3, hy - 5); ctx.lineTo(hx + 11, hy - 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx - 9, hy - 4); ctx.lineTo(hx - 2, hy - 5); ctx.stroke();
}

// ------------------------------------------------- WOLF (Rivruff line)
function drawWolf(ctx, c, t, ex) {
  const waterPhase = t * 1.6;
  // wave tail
  ctx.save();
  ctx.translate(-24, -26); ctx.rotate(Math.sin(t * 1.6) * 0.14);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-22, 2, -34, -14);
  ctx.quadraticCurveTo(-30, -24, -20, -18);
  ctx.quadraticCurveTo(-12, -14, 0, -10);
  ctx.closePath(); ctx.fillStyle = c.secondary; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-30, -14); ctx.quadraticCurveTo(-26, -22, -18, -17);
  ctx.quadraticCurveTo(-24, -13, -30, -11); ctx.closePath();
  ctx.fillStyle = c.accent; ctx.fill();
  ctx.restore();

  // big paws
  ell(ctx, -14, -8, 9, 9, c.secondary);
  ell(ctx, 16, -8, 8.5, 9, c.secondary);
  ell(ctx, 6, -7, 8.5, 8.5, c.primary);
  ell(ctx, -4, -7, 9, 9, c.primary);
  // leg markings
  ctx.fillStyle = c.accent;
  ell(ctx, 6, -3, 6, 2.6, c.accent);
  ell(ctx, -4, -3, 6, 2.6, c.accent);

  // heavy body
  ell(ctx, 0, -26, 26, 19, c.primary);
  ell(ctx, 3, -20, 16, 11, c.belly);

  // flowing water around the mane
  ctx.save();
  ctx.globalAlpha *= 0.75;
  for (let i = 0; i < 3; i++) {
    const a = waterPhase + i * 2.1;
    ctx.beginPath();
    ctx.arc(10, -38, 22 + i * 3, a, a + 1.4);
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 3 - i * 0.6;
    ctx.stroke();
  }
  ctx.restore();

  // head
  const hx = 16, hy = -40;
  // neck fin fur
  ctx.beginPath();
  ctx.moveTo(hx - 16, hy + 6);
  ctx.quadraticCurveTo(hx - 26, hy - 6, hx - 14, hy - 14);
  ctx.quadraticCurveTo(hx - 8, hy + 2, hx - 6, hy + 10);
  ctx.closePath(); ctx.fillStyle = c.secondary; ctx.fill();

  ell(ctx, hx, hy, 16, 14, c.primary);
  // droopy ears
  ctx.beginPath();
  ctx.moveTo(hx - 10, hy - 8);
  ctx.quadraticCurveTo(hx - 22, hy - 10, hx - 18, hy + 6);
  ctx.quadraticCurveTo(hx - 10, hy + 2, hx - 6, hy - 6);
  ctx.closePath(); ctx.fillStyle = c.secondary; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx + 8, hy - 8);
  ctx.quadraticCurveTo(hx + 20, hy - 8, hx + 17, hy + 6);
  ctx.quadraticCurveTo(hx + 10, hy + 2, hx + 6, hy - 6);
  ctx.closePath(); ctx.fillStyle = c.secondary; ctx.fill();
  if (ex.horns) {
    ctx.beginPath();
    ctx.moveTo(hx - 2, hy - 13); ctx.quadraticCurveTo(hx + 4, hy - 32, hx + 10, hy - 14);
    ctx.closePath(); ctx.fillStyle = c.accent; ctx.fill();
  }
  // muzzle
  ell(ctx, hx + 11, hy + 5, 10, 7, c.belly);
  ell(ctx, hx + 18, hy + 3, 2.6, 2.1, '#26323f');
  eye(ctx, hx + 7, hy - 2, 3.4, c.eye);
  eye(ctx, hx - 4, hy - 2, 3.1, c.eye);
  // calm sleepy lids
  ctx.strokeStyle = shadeColor(c.primary, -0.18); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hx + 3.5, hy - 4); ctx.lineTo(hx + 10.5, hy - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx - 7.5, hy - 4); ctx.lineTo(hx - 0.5, hy - 4); ctx.stroke();
}

// ------------------------------------------------- AVIAN (Leaflet line)
function drawAvian(ctx, c, t, ex) {
  const flap = Math.sin(t * 7) * 0.55;
  const hop = 0;
  // stem tail
  ctx.save();
  ctx.translate(-14, -28); ctx.rotate(Math.sin(t * 2) * 0.1);
  ctx.strokeStyle = c.dark; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, -6); ctx.stroke();
  leaf(ctx, -14, -6, 16, 6, -0.5, c.primary, c.dark);
  leaf(ctx, -14, -6, 15, 5.5, -0.05, c.accent, c.dark);
  leaf(ctx, -14, -6, 14, 5, 0.45, c.primary, c.dark);
  ctx.restore();

  // twig legs
  ctx.strokeStyle = '#a9813f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, -12); ctx.lineTo(-5, -1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, -1); ctx.lineTo(-1, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(5, -1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -1); ctx.lineTo(9, 0); ctx.stroke();

  // round body
  ell(ctx, 0, -26 + hop, 17, 16, c.primary);
  ell(ctx, 2, -22 + hop, 11, 10, c.belly);
  // leaf patterning
  leaf(ctx, -8, -32, 11, 4, -0.8, c.accent, c.dark);
  leaf(ctx, -10, -24, 10, 3.6, -0.2, c.accent, c.dark);

  // wing
  ctx.save();
  ctx.translate(4, -28 + hop); ctx.rotate(flap * (ex.wings ? 1.1 : 0.8));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8, 8, -18, 14);
  ctx.quadraticCurveTo(-6, 14, 2, 6);
  ctx.closePath();
  ctx.fillStyle = c.secondary; ctx.fill();
  if (ex.wings) {
    leaf(ctx, -4, 4, 20, 6, 2.5, c.accent, c.dark);
  }
  ctx.restore();

  // head
  const hx = 8, hy = -40 + hop;
  ell(ctx, hx, hy, 12.5, 12, c.primary);
  // head leaf feathers
  leaf(ctx, hx - 2, hy - 10, 16, 5, -1.5, c.accent, c.dark);
  leaf(ctx, hx + 2, hy - 10, 13, 4.5, -1.1, c.primary, c.dark);
  leaf(ctx, hx - 6, hy - 9, 12, 4, -2.0, c.primary, c.dark);
  if (ex.horns) leaf(ctx, hx + 5, hy - 9, 15, 5, -0.8, c.accent, c.dark);
  // beak
  ctx.beginPath();
  ctx.moveTo(hx + 10, hy + 1); ctx.lineTo(hx + 20, hy + 3); ctx.lineTo(hx + 10, hy + 6);
  ctx.closePath(); ctx.fillStyle = '#f5b544'; ctx.fill();
  eye(ctx, hx + 4, hy - 1, 3.6, '#ffffff');
  eye(ctx, hx - 6, hy - 1, 3.2, '#ffffff');
  // cheek
  ctx.globalAlpha *= 0.5;
  ell(ctx, hx + 7, hy + 5, 3, 2, '#ff9aa2');
  ctx.globalAlpha /= 0.5;
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
