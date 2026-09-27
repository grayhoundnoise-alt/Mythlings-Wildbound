// Procedural world rendering: ground, water, props, buildings, weather particles.
import { makeRng, shadeColor, clamp } from '../core/utils.js';

const TERRAIN = {
  town:    { grass: '#7ec96a', grass2: '#6bb95c', path: '#e5d3a1', props: ['tree', 'flower', 'bush', 'lamp'] },
  flowers: { grass: '#8ad86f', grass2: '#74c65e', path: '#ecd9a8', props: ['flower', 'flower', 'bush', 'tree'] },
  forest:  { grass: '#5cb058', grass2: '#4a9a4c', path: '#d8c493', props: ['tree', 'tree', 'bigtree', 'bush', 'mushroom'] },
  ruins:   { grass: '#78b96a', grass2: '#639e58', path: '#cfc3a0', props: ['pillar', 'rock', 'bush', 'tree'] },
  port:    { grass: '#8fd0a8', grass2: '#7ab994', path: '#e8dcc0', props: ['palm', 'crate', 'barrel', 'rock'] },
  beach:   { grass: '#f2e2b6', grass2: '#e6d3a2', path: '#f7ecd0', props: ['palm', 'shell', 'rock', 'coral'] },
  river:   { grass: '#86cfa0', grass2: '#6fba8b', path: '#dfe9cf', props: ['reed', 'rock', 'tree', 'flower'] },
  cavern:  { grass: '#6d7fa8', grass2: '#5c6d94', path: '#8f9fc0', props: ['crystal', 'rock', 'crystal', 'stalag'] },
  outpost: { grass: '#6b5750', grass2: '#5c4a44', path: '#8a7264', props: ['deadtree', 'rock', 'brazier', 'crate'] },
  ash:     { grass: '#5b4a46', grass2: '#4c3d3a', path: '#7a655c', props: ['deadtree', 'rock', 'ember', 'bone'] },
  cinder:  { grass: '#59453f', grass2: '#4a3833', path: '#79615a', props: ['burnttree', 'ember', 'rock', 'deadtree'] },
  molten:  { grass: '#4a332f', grass2: '#3c2926', path: '#6d4b42', props: ['rock', 'ember', 'obsidian', 'crystal'] },
  volcanic_ruins: { grass: '#4f3a34', grass2: '#41302b', path: '#74564a', props: ['pillar', 'obsidian', 'ember', 'rock'] },
  // ---- Stonehollow Crags (rock) ----
  quarry:  { grass: '#9a8f78', grass2: '#877c67', path: '#c9bda0', props: ['rock', 'crate', 'barrel', 'deadtree'] },
  crag:    { grass: '#7d7a72', grass2: '#6b685f', path: '#a39e90', props: ['rock', 'rock', 'stalag', 'crystal'] },
  summit:  { grass: '#8f949c', grass2: '#7c8188', path: '#b8bcc2', props: ['pillar', 'rock', 'stalag', 'crystal'] },
};

/** Ground colour of a terrain id (used by the minimap so it matches the world). */
export function terrainColor(terrainId) {
  return (TERRAIN[terrainId] || TERRAIN.forest).grass;
}

const WATER_COLORS = {
  stream: ['#4fb0e8', '#2d84c4'],
  pond:   ['#54b6ec', '#2f88c8'],
  sea:    ['#38a8e8', '#1d6fb4'],
  river:  ['#48b4ee', '#2a82c6'],
  lava:   ['#ff7a2a', '#c62d0f'],
};

export class WorldRenderer {
  constructor() {
    this.cache = new Map(); // mapId -> props
  }

  props(map) {
    if (this.cache.has(map.id)) return this.cache.get(map.id);
    const rng = makeRng(hashStr(map.id));
    const out = [];
    for (const region of map.regions) {
      const cfg = TERRAIN[region.terrain] || TERRAIN.forest;
      const [rx, ry, rw, rh] = region.rect;
      const count = Math.floor((rw * rh) / 12000);
      for (let i = 0; i < count; i++) {
        const x = rx + rng() * rw;
        const y = ry + rng() * rh;
        // keep the central corridor walkable-looking
        if (Math.abs(y - map.height * 0.55) < 90 && rng() < 0.7) continue;
        if (insideAny(map.water, x, y, 40)) continue;
        if (insideBuildings(map, x, y, 60)) continue;
        const kind = cfg.props[Math.floor(rng() * cfg.props.length)];
        out.push({ kind, x, y, s: 0.7 + rng() * 0.7, seed: rng() * 100, solid: ['tree', 'bigtree', 'pillar', 'deadtree', 'burnttree', 'crystal', 'obsidian', 'palm', 'stalag'].includes(kind) });
      }
    }
    out.sort((a, b) => a.y - b.y);
    this.cache.set(map.id, out);
    return out;
  }

  /** Solid collision rects derived from props + buildings + water. */
  colliders(map) {
    const key = `col_${map.id}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const list = [];
    for (const b of map.buildings) list.push({ x: b.x, y: b.y, w: b.w, h: b.h - 10 });
    for (const p of this.props(map)) {
      if (!p.solid) continue;
      list.push({ x: p.x - 11 * p.s, y: p.y - 8 * p.s, w: 22 * p.s, h: 14 * p.s });
    }
    this.cache.set(key, list);
    return list;
  }

  drawGround(ctx, map, cam, time) {
    const q = document.documentElement.dataset.quality || 'high';
    const detail = q === 'low' ? 0.4 : q === 'medium' ? 0.7 : 1;
    for (const region of map.regions) {
      const cfg = TERRAIN[region.terrain] || TERRAIN.forest;
      const [rx, ry, rw, rh] = region.rect;
      if (rx + rw < cam.x - 100 || rx > cam.x + cam.w + 100) continue;
      const g = ctx.createLinearGradient(rx, ry, rx, ry + rh);
      g.addColorStop(0, cfg.grass2);
      g.addColorStop(0.5, cfg.grass);
      g.addColorStop(1, cfg.grass2);
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, rw, rh);

      // texture speckles
      const rng = makeRng(hashStr(region.id));
      const n = Math.floor((rw * rh) / 9000 * detail);
      ctx.fillStyle = shadeColor(cfg.grass, -0.05);
      for (let i = 0; i < n; i++) {
        const x = rx + rng() * rw, y = ry + rng() * rh;
        const w = 6 + rng() * 16;
        if (x < cam.x - 40 || x > cam.x + cam.w + 40) continue;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x, y, w, 3);
      }
      ctx.globalAlpha = 1;
    }

    // main path corridor
    ctx.save();
    ctx.globalAlpha = 0.55;
    const py = map.height * 0.55;
    const pathGrad = ctx.createLinearGradient(0, py - 70, 0, py + 70);
    pathGrad.addColorStop(0, 'rgba(230,214,170,0)');
    pathGrad.addColorStop(0.5, 'rgba(232,215,172,0.95)');
    pathGrad.addColorStop(1, 'rgba(230,214,170,0)');
    ctx.fillStyle = pathGrad;
    ctx.beginPath();
    for (let x = 0; x <= map.width; x += 40) {
      const yy = py + Math.sin(x * 0.0022) * 60;
      if (x === 0) ctx.moveTo(x, yy - 62); else ctx.lineTo(x, yy - 62);
    }
    for (let x = map.width; x >= 0; x -= 40) {
      const yy = py + Math.sin(x * 0.0022) * 60;
      ctx.lineTo(x, yy + 62);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawWater(ctx, map, cam, time) {
    for (const w of map.water) {
      if (w.x + w.w < cam.x - 60 || w.x > cam.x + cam.w + 60) continue;
      const [c1, c2] = WATER_COLORS[w.kind] || WATER_COLORS.pond;
      const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      roundRect(ctx, w.x, w.y, w.w, w.h, 26);
      ctx.fill();
      // animated ripples / lava flow
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, w.x, w.y, w.w, w.h, 26);
      ctx.clip();
      ctx.globalAlpha = w.kind === 'lava' ? 0.5 : 0.35;
      ctx.strokeStyle = w.kind === 'lava' ? '#ffd35a' : '#ffffff';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 7; i++) {
        const yy = w.y + ((i * 47 + time * (w.kind === 'lava' ? 12 : 26)) % w.h);
        ctx.beginPath();
        for (let x = w.x; x < w.x + w.w; x += 22) {
          const oy = Math.sin((x * 0.03) + time * 1.6 + i) * 4;
          if (x === w.x) ctx.moveTo(x, yy + oy); else ctx.lineTo(x, yy + oy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    // bridges above water
    for (const b of map.bridges || []) {
      ctx.fillStyle = '#a97a49';
      roundRect(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill();
      ctx.strokeStyle = '#7d5630'; ctx.lineWidth = 3;
      for (let y = b.y; y < b.y + b.h; y += 18) {
        ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); ctx.stroke();
      }
      ctx.fillStyle = '#8a5f35';
      ctx.fillRect(b.x - 6, b.y, 8, b.h);
      ctx.fillRect(b.x + b.w - 2, b.y, 8, b.h);
    }
  }

  drawProp(ctx, p, time) {
    const s = p.s;
    const sway = Math.sin(time * 1.4 + p.seed) * 0.05;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(s, s);
    // soft shadow
    ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.ellipse(0, 2, 14, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#123'; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.rotate(sway);
    switch (p.kind) {
      case 'tree': case 'bigtree': {
        const h = p.kind === 'bigtree' ? 1.5 : 1;
        ctx.fillStyle = '#7a5433';
        ctx.fillRect(-4, -26 * h, 8, 26 * h);
        circle(ctx, -12, -34 * h, 16, '#3f8f42');
        circle(ctx, 12, -34 * h, 15, '#3f8f42');
        circle(ctx, 0, -46 * h, 20, '#4da051');
        circle(ctx, -4, -38 * h, 15, '#58b45c');
        break;
      }
      case 'palm': {
        ctx.strokeStyle = '#9c7440'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -24, 2, -44); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i - 2.5) * 0.5;
          ctx.save(); ctx.translate(2, -44); ctx.rotate(a);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(14, -8, 30, 2);
          ctx.quadraticCurveTo(14, 2, 0, 3); ctx.closePath();
          ctx.fillStyle = '#3fa05a'; ctx.fill(); ctx.restore();
        }
        break;
      }
      case 'deadtree': case 'burnttree': {
        ctx.strokeStyle = p.kind === 'burnttree' ? '#2b2220' : '#4a3a32';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -34); ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-14, -32); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(13, -38); ctx.stroke();
        if (p.kind === 'burnttree') {
          ctx.globalAlpha = 0.6 + Math.sin(time * 4 + p.seed) * 0.25;
          circle(ctx, 0, -34, 3, '#ff8a3a'); ctx.globalAlpha = 1;
        }
        break;
      }
      case 'bush': circle(ctx, 0, -8, 13, '#3f8f45'); circle(ctx, -8, -4, 9, '#4da051'); circle(ctx, 8, -5, 9, '#4da051'); break;
      case 'flower': {
        ctx.strokeStyle = '#4b9b4a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -12); ctx.stroke();
        const cols = ['#ff9ec4', '#ffd76a', '#b39bff', '#ffffff'];
        const col = cols[Math.floor(p.seed) % cols.length];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          circle(ctx, Math.cos(a) * 4, -12 + Math.sin(a) * 4, 3.4, col);
        }
        circle(ctx, 0, -12, 2.4, '#ffe680');
        break;
      }
      case 'mushroom': circle(ctx, 0, -8, 7, '#e2584f'); ctx.fillStyle = '#f5ead1'; ctx.fillRect(-2.5, -8, 5, 8); break;
      case 'rock': circle(ctx, 0, -6, 10, '#8d8d94'); circle(ctx, -5, -9, 6, '#a3a3aa'); break;
      case 'obsidian': {
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(9, -6); ctx.lineTo(-8, -6); ctx.closePath();
        ctx.fillStyle = '#2a2230'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(3, -8); ctx.lineTo(-2, -8); ctx.closePath();
        ctx.fillStyle = '#4a3c56'; ctx.fill(); break;
      }
      case 'crystal': {
        const glow = 0.5 + Math.sin(time * 2 + p.seed) * 0.3;
        ctx.globalAlpha = glow * 0.5;
        circle(ctx, 0, -18, 20, '#7fd8ff');
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(8, -8); ctx.lineTo(-8, -8); ctx.closePath();
        ctx.fillStyle = '#6ecbf5'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(3, -9); ctx.lineTo(-1, -9); ctx.closePath();
        ctx.fillStyle = '#c7f1ff'; ctx.fill();
        break;
      }
      case 'stalag': {
        ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(7, 0); ctx.lineTo(-7, 0); ctx.closePath();
        ctx.fillStyle = '#6a7391'; ctx.fill(); break;
      }
      case 'pillar': {
        ctx.fillStyle = '#c9c1a6'; ctx.fillRect(-9, -44, 18, 44);
        ctx.fillStyle = '#b3aa8f'; ctx.fillRect(-12, -48, 24, 7);
        ctx.fillStyle = '#6fae5e';
        ctx.beginPath(); ctx.ellipse(-6, -20, 6, 10, 0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'crate': ctx.fillStyle = '#b4854b'; ctx.fillRect(-11, -20, 22, 20); ctx.strokeStyle = '#8a6437'; ctx.lineWidth = 2; ctx.strokeRect(-11, -20, 22, 20); break;
      case 'barrel': ctx.fillStyle = '#9d6f3e'; roundRect(ctx, -9, -22, 18, 22, 5); ctx.fill(); break;
      case 'shell': circle(ctx, 0, -5, 7, '#ffd9e0'); break;
      case 'coral': circle(ctx, 0, -10, 8, '#ff8fa3'); circle(ctx, -7, -6, 6, '#ffb3c1'); break;
      case 'reed': {
        ctx.strokeStyle = '#5aa35a'; ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 4, 0); ctx.quadraticCurveTo(i * 7, -12, i * 9, -24); ctx.stroke(); }
        break;
      }
      case 'lamp': {
        ctx.fillStyle = '#5b5b66'; ctx.fillRect(-2, -34, 4, 34);
        const glow = 0.6 + Math.sin(time * 3 + p.seed) * 0.2;
        ctx.globalAlpha = glow * 0.45; circle(ctx, 0, -38, 14, '#ffe08a'); ctx.globalAlpha = 1;
        circle(ctx, 0, -38, 6, '#ffe9a8'); break;
      }
      case 'brazier': {
        ctx.fillStyle = '#4a4048'; roundRect(ctx, -9, -16, 18, 16, 4); ctx.fill();
        const f = 1 + Math.sin(time * 8 + p.seed) * 0.2;
        ctx.globalAlpha = 0.5; circle(ctx, 0, -24, 16 * f, '#ff8a3a'); ctx.globalAlpha = 1;
        circle(ctx, 0, -22, 7 * f, '#ffce5a'); break;
      }
      case 'ember': {
        const f = 0.5 + Math.sin(time * 5 + p.seed) * 0.4;
        ctx.globalAlpha = f * 0.8; circle(ctx, 0, -6, 8, '#ff7a2a'); ctx.globalAlpha = 1;
        circle(ctx, 0, -5, 3.5, '#ffd06a'); break;
      }
      case 'bone': ctx.fillStyle = '#e4dcc8'; roundRect(ctx, -10, -5, 20, 5, 3); ctx.fill(); break;
      default: circle(ctx, 0, -6, 8, '#888'); break;
    }
    ctx.restore();
  }

  drawBuilding(ctx, b, time) {
    const { x, y, w, h } = b;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#123';
    roundRect(ctx, x + 6, y + h - 6, w, 14, 8); ctx.fill();
    ctx.globalAlpha = 1;

    const themes = {
      center: { wall: '#fdf6e6', roof: '#f0607a', trim: '#e04a66', sign: 'heal' },
      shop:   { wall: '#fff3dc', roof: '#4fb0e8', trim: '#2f88c8', sign: 'shop' },
      house:  { wall: '#f6ead3', roof: '#c58b5c', trim: '#a06f45', sign: '' },
      dock:   { wall: '#c39a63', roof: '#8a6437', trim: '#6f5029', sign: '' },
      tower:  { wall: '#d8cbb4', roof: '#7b5a4a', trim: '#5c4236', sign: '' },
    };
    const th = themes[b.type] || themes.house;

    // walls
    ctx.fillStyle = th.wall;
    roundRect(ctx, x, y + h * 0.35, w, h * 0.65, 8); ctx.fill();
    // roof
    ctx.fillStyle = th.roof;
    ctx.beginPath();
    ctx.moveTo(x - 12, y + h * 0.4);
    ctx.lineTo(x + w / 2, y - 14);
    ctx.lineTo(x + w + 12, y + h * 0.4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.trim;
    ctx.fillRect(x - 12, y + h * 0.36, w + 24, 8);
    // door
    ctx.fillStyle = '#7a5433';
    roundRect(ctx, x + w / 2 - 15, y + h * 0.62, 30, h * 0.38, 4); ctx.fill();
    ctx.fillStyle = '#ffd98a';
    circle(ctx, x + w / 2 + 9, y + h * 0.82, 2.4, '#ffd98a');
    // windows
    ctx.fillStyle = '#9fd8f5';
    roundRect(ctx, x + 12, y + h * 0.5, 22, 18, 4); ctx.fill();
    roundRect(ctx, x + w - 34, y + h * 0.5, 22, 18, 4); ctx.fill();
    // sign — drawn from our own vector marks, never a font emoji
    if (th.sign) drawSignMark(ctx, th.sign, x + w / 2, y + h * 0.26, 13);
    // name plate
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,28,40,0.75)';
    const tw = ctx.measureText(b.name).width + 16;
    roundRect(ctx, x + w / 2 - tw / 2, y - 40, tw, 20, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(b.name, x + w / 2, y - 26);
    ctx.restore();
  }

  drawLandmark(ctx, lm, time) {
    ctx.save();
    ctx.translate(lm.x, lm.y);
    if (lm.type === 'sign') {
      ctx.fillStyle = '#8a6437'; ctx.fillRect(-3, -22, 6, 22);
      ctx.fillStyle = '#c99b5f'; roundRect(ctx, -26, -42, 52, 22, 4); ctx.fill();
      ctx.strokeStyle = '#8a6437'; ctx.lineWidth = 2; ctx.strokeRect(-26, -42, 52, 22);
      ctx.fillStyle = '#5c4126'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('SIGN', 0, -28);
    } else if (lm.type === 'ruin') {
      ctx.fillStyle = '#bdb39a';
      ctx.fillRect(-40, -60, 14, 60); ctx.fillRect(26, -46, 14, 46);
      ctx.fillRect(-40, -68, 80, 12);
      ctx.fillStyle = '#6fae5e';
      ctx.beginPath(); ctx.ellipse(-33, -30, 9, 16, 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (lm.type === 'crystal') {
      const glow = 0.5 + Math.sin(time * 1.7) * 0.3;
      ctx.globalAlpha = glow * 0.45; circle(ctx, 0, -40, 54, '#7fd8ff'); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(0, -86); ctx.lineTo(20, -10); ctx.lineTo(-20, -10); ctx.closePath();
      ctx.fillStyle = '#5fc4ee'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -86); ctx.lineTo(7, -12); ctx.lineTo(-3, -12); ctx.closePath();
      ctx.fillStyle = '#cdf2ff'; ctx.fill();
    } else if (lm.type === 'volcano') {
      ctx.fillStyle = '#4a332f';
      ctx.beginPath(); ctx.moveTo(-160, 0); ctx.lineTo(0, -180); ctx.lineTo(160, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff7a2a';
      ctx.beginPath(); ctx.moveTo(-26, -160); ctx.lineTo(0, -184); ctx.lineTo(26, -160);
      ctx.quadraticCurveTo(0, -140, -26, -160); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 4; i++) {
        const yy = -190 - ((time * 24 + i * 40) % 160);
        circle(ctx, Math.sin(time + i) * 18, yy, 18 + i * 6, '#7a6a66');
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawGateArch(ctx, conn, locked, time) {
    const [x, y, w, h] = conn.rect;
    ctx.save();
    ctx.fillStyle = locked ? 'rgba(220,70,70,0.25)' : 'rgba(120,230,160,0.25)';
    roundRect(ctx, x - 20, y - 60, w + 40, h + 120, 16); ctx.fill();
    ctx.fillStyle = '#b8a888';
    ctx.fillRect(x - 24, y - 70, 20, h + 140);
    ctx.fillRect(x + w + 4, y - 70, 20, h + 140);
    ctx.fillRect(x - 24, y - 90, w + 48, 26);
    ctx.fillStyle = locked ? '#ff6b6b' : '#8ef0a8';
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(locked ? 'LOCKED' : conn.label || 'GATE', x + w / 2, y - 100);
    if (locked) drawSignMark(ctx, 'lock', x + w / 2 - ctx.measureText('LOCKED').width / 2 - 13, y - 105, 8);
    ctx.restore();
  }

  drawAmbient(ctx, map, cam, time) {
    const q = document.documentElement.dataset.quality || 'high';
    if (q === 'low') return;
    const count = q === 'medium' ? 24 : 46;
    const theme = map.visualTheme;
    ctx.save();
    for (let i = 0; i < count; i++) {
      const seed = i * 97.13;
      const speed = 12 + (i % 5) * 7;
      let x = (seed * 37 + time * speed) % (cam.w + 200) + cam.x - 100;
      let y = (seed * 53 + Math.sin(time * 0.7 + i) * 40) % (cam.h + 100) + cam.y - 50;
      if (theme === 'nature') {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = i % 3 === 0 ? '#ffe6a8' : '#bff5a0';
        ctx.beginPath(); ctx.ellipse(x, y, 4, 2.2, time + i, 0, Math.PI * 2); ctx.fill();
      } else if (theme === 'water') {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#e6faff';
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
      } else if (theme === 'rock') {
        // drifting quarry dust + the odd falling pebble
        ctx.globalAlpha = i % 4 === 0 ? 0.6 : 0.3;
        ctx.fillStyle = i % 4 === 0 ? '#6e665c' : '#e8dcc4';
        const py = i % 4 === 0 ? (y + time * 60) % (cam.h + 100) + cam.y - 50 : y;
        ctx.beginPath(); ctx.arc(x, py, i % 4 === 0 ? 2.2 : 1.6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = i % 2 ? '#ff9a4a' : '#ffd07a';
        ctx.beginPath(); ctx.arc(x, (y + time * 20) % (cam.h + 100) + cam.y - 50, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawOverlay(ctx, map, cam) {
    const amb = map.ambient;
    if (!amb) return;
    ctx.save();
    ctx.fillStyle = amb.fog;
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    ctx.restore();
  }
}

// ---------- helpers ----------
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function circle(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function insideAny(rects, x, y, pad = 0) {
  return rects.some((r) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
}

function insideBuildings(map, x, y, pad = 0) {
  return map.buildings.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);
}

export function drawTrainerAvatar(ctx, x, y, color, time, opts = {}) {
  const bob = Math.sin(time * 2.4 + (opts.phase || 0)) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.ellipse(0, 4, 14, 5, 0, 0, Math.PI * 2); ctx.fillStyle = '#123'; ctx.fill();
  ctx.globalAlpha = 1;
  // legs
  ctx.fillStyle = '#39445c';
  ctx.fillRect(-7, -14, 5, 14); ctx.fillRect(2, -14, 5, 14);
  // body
  ctx.fillStyle = color;
  roundRect(ctx, -11, -34, 22, 22, 7); ctx.fill();
  // arms
  ctx.fillStyle = color;
  roundRect(ctx, -16, -32, 6, 16, 3); ctx.fill();
  roundRect(ctx, 10, -32, 6, 16, 3); ctx.fill();
  // head
  ctx.fillStyle = '#f7d9b8';
  ctx.beginPath(); ctx.arc(0, -43, 10, 0, Math.PI * 2); ctx.fill();
  // hair / cap
  ctx.fillStyle = opts.hair || '#3b2f2a';
  ctx.beginPath(); ctx.arc(0, -45, 10.5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(-11, -46, 22, 4);
  if (opts.cap) {
    ctx.fillStyle = opts.cap;
    ctx.beginPath(); ctx.arc(0, -46, 11, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(-2, -47, 16, 4);
  }
  // eyes
  ctx.fillStyle = '#2a2a33';
  ctx.beginPath(); ctx.arc(-3.4, -42, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3.4, -42, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}


/**
 * Small vector marks used on world signage (shop / center / locked gate).
 * Drawn with paths so the world never depends on emoji font coverage.
 */
export function drawSignMark(ctx, kind, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  if (kind === 'heal') {
    ctx.fillStyle = '#ffffff';
    const t = r * 0.42;
    ctx.fillRect(-t, -r, t * 2, r * 2);
    ctx.fillRect(-r, -t, r * 2, t * 2);
  } else if (kind === 'shop') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.6, r * 0.22);
    ctx.beginPath();                       // basket
    ctx.moveTo(-r, -r * 0.25);
    ctx.lineTo(r, -r * 0.25);
    ctx.lineTo(r * 0.7, r * 0.8);
    ctx.lineTo(-r * 0.7, r * 0.8);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();                       // handle
    ctx.arc(0, -r * 0.25, r * 0.5, Math.PI, 0);
    ctx.stroke();
  } else if (kind === 'lock') {
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = Math.max(1.4, r * 0.24);
    ctx.beginPath();
    ctx.arc(0, -r * 0.15, r * 0.52, Math.PI, 0);
    ctx.stroke();
    roundRect(ctx, -r * 0.8, -r * 0.15, r * 1.6, r * 1.15, r * 0.28);
    ctx.fill();
  }
  ctx.restore();
}
