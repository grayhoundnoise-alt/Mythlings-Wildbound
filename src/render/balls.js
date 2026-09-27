// Signature 2D art for every binding ball — one original silhouette per ball,
// drawn with plain canvas calls so it works at icon size (bag, shop, capture
// buttons) and at battle size (the throw / absorb / wobble sequence).
//
//   basic_ball     Cordbound   fired clay wrapped in a knotted leather cord
//   normal_ball    Rune Shell  polished steel, riveted band, glowing rune window
//   advanced_ball  Coast Prism faceted coast crystal around a bright core
//   absolute_ball  Ember Forge dark forge-iron split by molten veins in a heat cage
//   god_ball       Halo        pearl sphere circled by a tilted golden halo ring (guaranteed catch)
//   shiny_ball     Starlight   gold sphere holding a turning starfield (guaranteed catch, always Shiny)
//   dark_ball      Eclipse     void sphere with a violet corona and a crescent of light (guaranteed, always Darkness)
//
// `drawBall(ctx, ballId, x, y, r, opts)` — opts.t drives pulses/sparkles,
// opts.open (0..1) shows the binding seam split open, opts.rot spins the ball.

export const BALL_ART = {
  basic_ball:    { look: 'Cordbound',   base: '#d2ad74', shade: '#7a5630', accent: '#4a3320', glow: '#ffdca0' },
  normal_ball:   { look: 'Rune Shell',  base: '#93adc9', shade: '#39516f', accent: '#e4f7ff', glow: '#8fe3ff' },
  advanced_ball: { look: 'Coast Prism', base: '#5ad3c6', shade: '#166872', accent: '#eafffb', glow: '#a8fff2' },
  absolute_ball: { look: 'Ember Forge', base: '#524850', shade: '#1a1216', accent: '#ff8a3c', glow: '#ffb060' },
  god_ball:      { look: 'Halo',        base: '#fff8ea', shade: '#c5a058', accent: '#f2c761', glow: '#fff1b8' },
  shiny_ball:    { look: 'Starlight',   base: '#ffd766', shade: '#b8860b', accent: '#fff2a8', glow: '#fff6c8' },
  dark_ball:     { look: 'Eclipse',     base: '#1b1230', shade: '#07040f', accent: '#b07cff', glow: '#7a4dff' },
};

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, k) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function sphere(ctx, r, base, shade, alpha = 1) {
  const g = ctx.createRadialGradient(-r * 0.36, -r * 0.4, r * 0.08, 0, 0, r * 1.05);
  g.addColorStop(0, mix(base, '#ffffff', 0.4));
  g.addColorStop(0.45, base);
  g.addColorStop(1, shade);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
function outline(ctx, r, shade) {
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.strokeStyle = shade;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
}
function specular(ctx, r) {
  ctx.save();
  ctx.translate(-r * 0.34, -r * 0.42); ctx.rotate(-0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function clipSphere(ctx, r) {
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
}
function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// ---------------------------------------------------------------- designs
function drawCordbound(ctx, r, art) {
  sphere(ctx, r, art.base, art.shade);
  ctx.save(); clipSphere(ctx, r);
  ctx.lineCap = 'round';
  for (const ang of [0.72, -0.72]) {
    ctx.save(); ctx.rotate(ang);
    ctx.strokeStyle = art.accent; ctx.lineWidth = r * 0.24;
    ctx.beginPath(); ctx.moveTo(-r * 1.2, 0); ctx.lineTo(r * 1.2, 0); ctx.stroke();
    ctx.strokeStyle = mix(art.accent, '#ffffff', 0.35); ctx.lineWidth = r * 0.06;
    ctx.setLineDash([r * 0.16, r * 0.12]);
    ctx.beginPath(); ctx.moveTo(-r * 1.2, -r * 0.04); ctx.lineTo(r * 1.2, -r * 0.04); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.restore();
  // knot + copper clasp
  ctx.fillStyle = art.accent;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c98a45'; ctx.lineWidth = r * 0.07;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2); ctx.stroke();
  outline(ctx, r, art.shade);
  specular(ctx, r);
}

function drawRuneShell(ctx, r, art, t) {
  sphere(ctx, r, art.base, art.shade);
  ctx.save(); clipSphere(ctx, r);
  ctx.fillStyle = art.shade;
  ctx.fillRect(-r, -r * 0.13, r * 2, r * 0.26);
  ctx.fillStyle = mix(art.shade, '#ffffff', 0.18);
  ctx.fillRect(-r, -r * 0.13, r * 2, r * 0.05);
  for (const x of [-0.52, 0, 0.52]) {
    ctx.fillStyle = art.accent;
    ctx.beginPath(); ctx.arc(x * r, 0, r * 0.07, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // rune window (triangle), pulsing
  const pulse = 0.65 + 0.35 * Math.sin(t * 3.2);
  const cy = -r * 0.5, s = r * 0.42;
  const tri = [[0, cy - s * 0.6], [s * 0.55, cy + s * 0.35], [-s * 0.55, cy + s * 0.35]];
  poly(ctx, tri);
  const g = ctx.createRadialGradient(0, cy, 0, 0, cy, s * 0.7);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, art.glow); g.addColorStop(1, rgba(art.glow, 0.15));
  ctx.fillStyle = g; ctx.globalAlpha = pulse; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = art.shade; ctx.lineWidth = r * 0.06; ctx.stroke();
  outline(ctx, r, art.shade);
  specular(ctx, r);
}

function drawCoastPrism(ctx, r, art, t) {
  sphere(ctx, r, art.base, art.shade, 0.96);
  ctx.save(); clipSphere(ctx, r);
  // honeycomb facets
  ctx.strokeStyle = rgba(art.accent, 0.42); ctx.lineWidth = Math.max(0.8, r * 0.045);
  const step = r * 0.5, h = step * 0.866;
  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      const cx = col * step * 1.5, cy = row * h * 2 + (col % 2 ? h : 0);
      if (cx * cx + cy * cy > (r * 1.3) ** 2) continue;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i;
        const px = cx + Math.cos(a) * step * 0.5, py = cy + Math.sin(a) * step * 0.5;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
  }
  // bright binding core
  const pulse = 0.75 + 0.25 * Math.sin(t * 2.4);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, art.glow); g.addColorStop(1, rgba(art.glow, 0));
  ctx.globalAlpha = pulse; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
  // silver polar cap
  ctx.fillStyle = '#e3edf2';
  ctx.beginPath(); ctx.ellipse(0, -r * 0.82, r * 0.42, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8fa3ad'; ctx.lineWidth = r * 0.05; ctx.stroke();
  outline(ctx, r, art.shade);
  specular(ctx, r);
}

const EMBER_CRACKS = [
  [[0, 0], [0.22, -0.12], [0.38, -0.3], [0.62, -0.36], [0.8, -0.52]],
  [[0, 0], [-0.2, -0.18], [-0.44, -0.2], [-0.66, -0.42]],
  [[0, 0], [0.18, 0.2], [0.28, 0.44], [0.5, 0.62]],
  [[0, 0], [-0.24, 0.16], [-0.5, 0.26], [-0.72, 0.5]],
  [[0, 0], [0.02, -0.34], [-0.1, -0.6], [0.04, -0.84]],
  [[0, 0], [-0.04, 0.3], [0.1, 0.56], [-0.06, 0.82]],
];
function drawEmberForge(ctx, r, art, t) {
  sphere(ctx, r, art.base, art.shade);
  ctx.save(); clipSphere(ctx, r);
  const pulse = 0.85 + 0.15 * Math.sin(t * 4.1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = art.glow; ctx.shadowBlur = r * 0.5;
  ctx.strokeStyle = mix(art.accent, '#ffffff', 0.15); ctx.lineWidth = r * 0.1; ctx.globalAlpha = pulse;
  for (const crack of EMBER_CRACKS) {
    ctx.beginPath();
    crack.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
    ctx.stroke();
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.42);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.4, art.accent); g.addColorStop(1, rgba(art.accent, 0));
  ctx.fillStyle = g; ctx.globalAlpha = pulse;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
  // heat cage: two iron rings
  ctx.strokeStyle = '#8d939d'; ctx.lineWidth = r * 0.085; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.02, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.4, r * 1.02, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  outline(ctx, r, art.shade);
  specular(ctx, r);
}

function star(ctx, cx, cy, outer, inner, points, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 ? inner : outer;
    const a = rot + (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
function drawHalo(ctx, r, art, t) {
  const tilt = -0.32;
  // back half of the ring
  ctx.save(); ctx.rotate(tilt);
  ctx.strokeStyle = mix(art.accent, '#000000', 0.25); ctx.lineWidth = r * 0.14;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.36, r * 0.42, 0, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // soft rays
  ctx.save(); ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 2);
  ctx.strokeStyle = art.glow; ctx.lineWidth = r * 0.05;
  for (let i = 0; i < 8; i++) {
    const a = t * 0.4 + (Math.PI / 4) * i;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    ctx.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); ctx.stroke();
  }
  ctx.restore();
  sphere(ctx, r, art.base, art.shade);
  // eight-point star sigil
  star(ctx, 0, 0, r * 0.36, r * 0.15, 8, t * 0.3);
  ctx.fillStyle = art.accent; ctx.fill();
  ctx.strokeStyle = mix(art.accent, '#000000', 0.3); ctx.lineWidth = r * 0.04; ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, Math.PI * 2); ctx.fill();
  outline(ctx, r, art.shade);
  specular(ctx, r);
  // front half of the ring
  ctx.save(); ctx.rotate(tilt);
  ctx.strokeStyle = art.accent; ctx.lineWidth = r * 0.14;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.36, r * 0.42, 0, 0, Math.PI); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = r * 0.04;
  ctx.beginPath(); ctx.ellipse(0, -r * 0.03, r * 1.36, r * 0.42, 0, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.restore();
}

function drawStarlight(ctx, r, art, t) {
  // Shiny Ball — a gold sphere holding a slowly turning starfield; sparkles orbit it.
  ctx.save(); ctx.globalAlpha = 0.3 + 0.12 * Math.sin(t * 2.2);
  ctx.fillStyle = art.glow;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.32, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  sphere(ctx, r, art.base, art.shade);
  ctx.save(); clipSphere(ctx, r);
  // inner starfield
  for (let i = 0; i < 9; i++) {
    const a = t * 0.35 + i * 0.7, rr = r * (0.2 + (i % 4) * 0.18);
    ctx.fillStyle = i % 3 ? '#ffffff' : art.accent;
    star(ctx, Math.cos(a) * rr, Math.sin(a) * rr * 0.7, r * 0.09, r * 0.035, 4, a);
    ctx.fill();
  }
  // bright equator seam
  ctx.fillStyle = rgba('#ffffff', 0.75); ctx.fillRect(-r, -r * 0.05, r * 2, r * 0.1);
  ctx.restore();
  // the big central star sigil
  star(ctx, 0, 0, r * 0.42, r * 0.17, 5, -t * 0.5);
  ctx.fillStyle = '#fffbe6'; ctx.fill();
  ctx.strokeStyle = mix(art.accent, '#000000', 0.25); ctx.lineWidth = r * 0.045; ctx.lineJoin = 'round'; ctx.stroke();
  outline(ctx, r, art.shade);
  specular(ctx, r);
  // orbiting sparkles
  for (let i = 0; i < 3; i++) {
    const a = t * 1.6 + (i * Math.PI * 2) / 3;
    const k = (Math.sin(t * 4 + i * 2) + 1) / 2;
    ctx.fillStyle = rgba('#ffffff', 0.6 + 0.4 * k);
    star(ctx, Math.cos(a) * r * 1.22, Math.sin(a) * r * 0.9, r * (0.07 + 0.08 * k), r * 0.03, 4);
    ctx.fill();
  }
}
function drawEclipse(ctx, r, art, t) {
  // Dark Ball — a void sphere ringed by a violet corona, with a crescent of light along the rim.
  ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 1.7);
  const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.5);
  g.addColorStop(0, rgba(art.glow, 0.7)); g.addColorStop(1, rgba(art.glow, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  sphere(ctx, r, art.base, art.shade);
  ctx.save(); clipSphere(ctx, r);
  // swirling shadow bands
  ctx.strokeStyle = rgba(art.accent, 0.35); ctx.lineWidth = r * 0.08;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.ellipse(0, r * (i - 1) * 0.35, r * 0.95, r * 0.22, Math.sin(t * 0.6 + i) * 0.25, 0, Math.PI * 2); ctx.stroke();
  }
  // the eclipse crescent
  ctx.fillStyle = rgba('#ffffff', 0.85);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, -Math.PI * 0.85, Math.PI * 0.15); ctx.arc(-r * 0.12, r * 0.1, r * 0.6, Math.PI * 0.15, -Math.PI * 0.85, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = art.base;
  ctx.beginPath(); ctx.arc(-r * 0.1, r * 0.08, r * 0.56, 0, Math.PI * 2); ctx.fill();
  // violet eye at the centre
  ctx.fillStyle = art.accent; ctx.beginPath(); ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-r * 0.04, -r * 0.04, r * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  outline(ctx, r, art.shade);
  specular(ctx, r);
  // drifting shadow motes
  ctx.save(); ctx.globalAlpha = 0.7;
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.4 + i * 0.25) % 1;
    ctx.fillStyle = art.accent;
    ctx.beginPath(); ctx.arc(Math.cos(i * 1.6 + t) * r * 1.15, -r * 0.4 + (1 - p) * r * 1.2 - r * 0.6, r * 0.05 * (1 - p) + r * 0.02, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const DESIGNS = {
  basic_ball: drawCordbound,
  normal_ball: drawRuneShell,
  advanced_ball: drawCoastPrism,
  absolute_ball: drawEmberForge,
  god_ball: drawHalo,
  shiny_ball: drawStarlight,
  dark_ball: drawEclipse,
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} ballId
 * @param {number} x @param {number} y @param {number} r radius in px
 * @param {{t?:number, open?:number, rot?:number, alpha?:number, shadow?:boolean}} opts
 */
export function drawBall(ctx, ballId, x, y, r, opts = {}) {
  const art = BALL_ART[ballId] || BALL_ART.basic_ball;
  const draw = DESIGNS[ballId] || drawCordbound;
  const { t = 0, open = 0, rot = 0, alpha = 1, shadow = false } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y + r * 1.05, r * 0.9, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.translate(x, y);
  if (open > 0) {
    // binding light spilling out of the opened seam
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.6);
    g.addColorStop(0, rgba(art.glow, 0.85 * open)); g.addColorStop(1, rgba(art.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.rotate(rot);
  draw(ctx, r, art, t);
  if (open > 0) {
    ctx.save(); clipSphere(ctx, r);
    ctx.fillStyle = rgba('#ffffff', 0.9 * open);
    ctx.fillRect(-r, -r * 0.16 * open, r * 2, r * 0.32 * open);
    ctx.restore();
  }
  ctx.restore();
}

/** A crisp canvas icon of the ball for lists and buttons. */
export function ballCanvas(ballId, size = 24, className = 'ball-icon') {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = `${size}px`;
  c.className = className;
  c.title = `${BALL_ART[ballId]?.look || 'Ball'}`;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  drawBall(ctx, ballId, size / 2, size / 2 + size * 0.03, size * 0.36, { t: 1.3 });
  return c;
}

/** The ball's own design name, e.g. "Halo" for the God Ball. */
export function ballLook(ballId) {
  return BALL_ART[ballId]?.look || 'Sphere';
}
