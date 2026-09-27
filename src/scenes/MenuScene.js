// Animated title-screen vista: layered mountains, forest, river, clouds,
// drifting particles and idling Mythlings.
import { drawMythling } from '../render/creatures.js';
import { makeRng } from '../core/utils.js';

export class MenuScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.dpr = 1;
    const rng = makeRng(20260927);
    this.clouds = Array.from({ length: 9 }, () => ({
      x: rng() * 1600, y: 40 + rng() * 190, s: 0.6 + rng() * 1.1, v: 6 + rng() * 12,
    }));
    this.trees = Array.from({ length: 46 }, () => ({
      x: rng() * 1700, y: 470 + rng() * 210, s: 0.5 + rng() * 0.9, seed: rng() * 10,
    })).sort((a, b) => a.y - b.y);
    this.grass = Array.from({ length: 130 }, () => ({ x: rng() * 1700, y: 520 + rng() * 210, h: 8 + rng() * 16, seed: rng() * 10 }));
    this.actors = [
      { species: 'spriggo', x: 0.24, y: 0.83, size: 118, facing: 1, phase: 0 },
      { species: 'aquini', x: 0.5, y: 0.895, size: 112, facing: -1, phase: 1.4 },
      { species: 'emberu', x: 0.76, y: 0.84, size: 122, facing: -1, phase: 2.6 },
      { species: 'leaflet', x: 0.62, y: 0.52, size: 78, facing: 1, phase: 3.3, fly: true },
      { species: 'rivruff', x: 0.13, y: 0.94, size: 120, facing: 1, phase: 4.1 },
    ];
  }

  update(dt) { this.time += dt; }

  render() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const W = this.canvas.width / dpr, H = this.canvas.height / dpr;
    const t = this.time;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#5fc8f5');
    sky.addColorStop(0.42, '#a7e6ff');
    sky.addColorStop(0.62, '#ffe9bd');
    sky.addColorStop(1, '#ffd79a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // sun glow
    const sunX = W * 0.76, sunY = H * 0.24;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, H * 0.45);
    glow.addColorStop(0, 'rgba(255,248,210,0.95)');
    glow.addColorStop(0.35, 'rgba(255,225,150,0.35)');
    glow.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // clouds
    for (const c of this.clouds) {
      const x = ((c.x + t * c.v) % (W + 400)) - 200;
      const y = c.y * (H / 700);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffffff';
      const s = c.s * (W / 1400);
      blob(ctx, x, y, 54 * s, 24 * s);
      blob(ctx, x + 42 * s, y - 10 * s, 40 * s, 22 * s);
      blob(ctx, x - 40 * s, y + 4 * s, 36 * s, 18 * s);
      ctx.restore();
    }

    // far mountains
    this.mountains(ctx, W, H, H * 0.52, '#8fa9c9', 0.55, 3, 0);
    this.mountains(ctx, W, H, H * 0.58, '#6f8fb4', 0.75, 4, 120);
    // distant fantasy structures
    this.structures(ctx, W, H);

    // rolling hills
    hill(ctx, W, H, H * 0.63, '#66b96a');
    hill(ctx, W, H, H * 0.70, '#57ab5c', 0.5);

    // river
    const riverTop = H * 0.72;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(W * 0.30, H);
    ctx.quadraticCurveTo(W * 0.42, H * 0.86, W * 0.40, riverTop);
    ctx.lineTo(W * 0.56, riverTop);
    ctx.quadraticCurveTo(W * 0.62, H * 0.87, W * 0.74, H);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, riverTop, 0, H);
    rg.addColorStop(0, '#6ec8f0');
    rg.addColorStop(1, '#2f86c8');
    ctx.fillStyle = rg; ctx.fill();
    ctx.clip();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 9; i++) {
      const y = riverTop + ((i * 40 + t * 40) % (H - riverTop));
      ctx.beginPath();
      for (let x = W * 0.28; x < W * 0.78; x += 16) {
        const oy = Math.sin(x * 0.04 + t * 2 + i) * 3;
        if (x === W * 0.28) ctx.moveTo(x, y + oy); else ctx.lineTo(x, y + oy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // forest band
    const sx = W / 1700, sy = H / 780;
    for (const tr of this.trees) {
      const x = tr.x * sx, y = tr.y * sy;
      if (x > W * 0.33 && x < W * 0.72 && y > riverTop) continue; // keep the river clear
      drawTree(ctx, x, y, tr.s * Math.min(sx, sy) * 1.5, t, tr.seed);
    }
    // grass tufts
    ctx.strokeStyle = '#3f8f45'; ctx.lineWidth = 2;
    for (const g of this.grass) {
      const x = g.x * sx, y = g.y * sy;
      if (x > W * 0.33 && x < W * 0.72 && y > riverTop) continue;
      const sway = Math.sin(t * 2 + g.seed) * 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway, y - g.h * 0.6, x + sway * 1.6, y - g.h); ctx.stroke();
    }

    // Mythlings idling in the scene
    for (const a of this.actors) {
      const x = a.x * W, y = a.y * H;
      const fly = a.fly ? Math.sin(t * 2 + a.phase) * 14 : 0;
      drawMythling(ctx, {
        speciesId: a.species, stage: 0, mutation: 'none',
        x, y: y + fly, size: a.size * Math.min(1, W / 1280), t: t + a.phase, facing: a.facing,
      });
    }

    // floating pollen / sparkles
    for (let i = 0; i < 60; i++) {
      const seed = i * 71.3;
      const x = ((seed * 31 + t * (8 + (i % 5) * 6)) % (W + 80)) - 40;
      const y = (Math.sin(t * 0.6 + i) * 60 + (seed * 13) % H + H) % H;
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t + i));
      ctx.fillStyle = i % 4 === 0 ? '#fff6c8' : '#d9ffd0';
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(4,10,18,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  mountains(ctx, W, H, baseY, color, alpha, peaks, offset) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-50, baseY + 140);
    const step = (W + 100) / (peaks * 2);
    for (let i = 0; i <= peaks * 2; i++) {
      const x = -50 + i * step;
      const y = i % 2 === 0 ? baseY + 40 : baseY - 120 - ((i * 37 + offset) % 90);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 50, baseY + 140);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  structures(ctx, W, H) {
    const y = H * 0.58;
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#5c6f92';
    // distant castle / spires
    const bx = W * 0.14;
    ctx.fillRect(bx, y - 70, 18, 70);
    ctx.fillRect(bx + 26, y - 100, 22, 100);
    ctx.fillRect(bx + 56, y - 60, 16, 60);
    tri(ctx, bx + 9, y - 70, 16, 24, '#48597a');
    tri(ctx, bx + 37, y - 100, 20, 30, '#48597a');
    tri(ctx, bx + 64, y - 60, 14, 20, '#48597a');
    // floating island
    const fx = W * 0.86, fy = H * 0.3;
    ctx.fillStyle = '#6f8fb4';
    ctx.beginPath(); ctx.ellipse(fx, fy, 60, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(fx - 50, fy + 6); ctx.lineTo(fx, fy + 52); ctx.lineTo(fx + 50, fy + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7ec96a';
    ctx.beginPath(); ctx.ellipse(fx, fy - 4, 58, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function blob(ctx, x, y, rx, ry) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function tri(ctx, x, y, w, h, c) {
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
}
function hill(ctx, W, H, y, color, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-20, H);
  ctx.quadraticCurveTo(W * 0.25, y - 40, W * 0.5, y);
  ctx.quadraticCurveTo(W * 0.78, y + 50, W + 20, y - 20);
  ctx.lineTo(W + 20, H); ctx.closePath(); ctx.fill(); ctx.restore();
}
function drawTree(ctx, x, y, s, t, seed) {
  const sway = Math.sin(t * 1.3 + seed) * 0.04;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(sway);
  ctx.globalAlpha = 0.22; ctx.fillStyle = '#123';
  ctx.beginPath(); ctx.ellipse(0, 2, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#7a5433'; ctx.fillRect(-4, -26, 8, 26);
  ctx.fillStyle = '#3f8f42';
  ctx.beginPath(); ctx.arc(-12, -34, 15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12, -34, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4da051';
  ctx.beginPath(); ctx.arc(0, -46, 19, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5cb45f';
  ctx.beginPath(); ctx.arc(-5, -40, 13, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
