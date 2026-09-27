// =============================================================================
// Rendering: nodes, prefabs, terrain, collision, gizmos, particles
// =============================================================================
const AssetCache = {
  images: new Map(), failed: new Set(),
  clear() { this.images.clear(); this.failed.clear(); },
  get(assetId) {
    if (!assetId) return null;
    if (this.images.has(assetId)) return this.images.get(assetId);
    const a = E.project && E.project.assets[assetId];
    if (!a || this.failed.has(assetId)) return null;
    const im = new Image();
    im.onload = () => { this.images.set(assetId, im); Scene.invalidate(); };
    im.onerror = () => { this.failed.add(assetId); ConsoleLog.warn(`Asset failed to load: ${a.name}`); };
    im.src = a.dataUrl;
    this.images.set(assetId, im);
    return im.complete && im.naturalWidth ? im : null;
  },
  drop(assetId) { this.images.delete(assetId); this.failed.delete(assetId); },
};

function setPathFor(ctx, n) {
  const b = localBounds(n);
  ctx.beginPath();
  switch (n.type) {
    case 'ellipse': ctx.ellipse(0, 0, Math.max(0.5, n.shape.w / 2), Math.max(0.5, n.shape.h / 2), 0, 0, Math.PI * 2); break;
    case 'polygon': tracePath(ctx, n.points, !!n.smooth, true); break;
    case 'path': tracePath(ctx, n.points, n.smooth !== false, !!n.closed); break;
    default: ctx.rect(b.x, b.y, b.w, b.h);
  }
}
function applyAppearance(ctx, n) {
  if (n.blend && n.blend !== 'source-over') ctx.globalCompositeOperation = n.blend;
  if (n.brightness != null && n.brightness !== 1) ctx.filter = `brightness(${n.brightness})`;
  if (n.glow > 0) { ctx.shadowColor = n.tint || n.fill || '#fff'; ctx.shadowBlur = n.glow; }
}
/** Draw one node's own geometry in its local space. */
function drawNodeShape(ctx, n, opts = {}) {
  const t = E.time;
  switch (n.type) {
    case 'group': return;
    case 'anchor': return; // drawn as gizmo
    case 'prefab': {
      const pf = PREFABS[n.prefab];
      if (!pf) { drawMissing(ctx, n, 'Missing Prefab'); return; }
      ctx.save();
      if (n.behavior.wind && n.behavior.wind !== 'none' && !opts.still) {
        const amt = n.behavior.wind === 'strong' ? (n.behavior.windAmount || 2) * 2 : (n.behavior.windAmount || 2);
        ctx.rotate(deg2rad(Math.sin(t * 1.4 + n.x * 0.01 + n.y * 0.013) * amt));
      }
      if (pf.isNpc) drawNpcSprite(ctx, n, t); else pf.draw(ctx, n, t);
      ctx.restore();
      return;
    }
    case 'npc': if (n.npc?.sprite === 'game' && typeof Game !== 'undefined' && Game.ok) { drawGameAvatar(ctx, n, opts.still ? 0 : t); return; } drawNpcSprite(ctx, n, t, n.npc?.direction); return;
    case 'gamepart': {
      if (typeof Game === 'undefined' || !Game.ok) { drawMissing(ctx, n, 'Game art unavailable'); return; }
      const my = (E.project && ((n.owner && E.project.mythlings[n.owner]) || (isCreatureMode() && E.project.mythlings[E.mythlingId]))) || opts.mythling || null;
      Game.drawPart(ctx, n, opts.still ? 0 : t, my, { blink: opts.blink || 0, expression: opts.expression });
      return;
    }
    case 'mythling': {
      const my = E.project && E.project.mythlings[n.mythling?.species];
      if (!my) { drawMissing(ctx, n, 'Missing Mythling'); return; }
      const key = `${my.id}:${n.mythling.animation || 'Idle'}`;
      const anim = E.project.animations[(my.animations || []).find((id) => E.project.animations[id]?.name === (n.mythling.animation || 'Idle'))] || null;
      drawMythlingInline(ctx, my, anim, opts.still ? 0 : t + hash2(n.x, n.y) * 3, n.shape.h, n.mythling.facing === 'left');
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${my.name} Lv.${n.mythling.level || 1}`, 0, -n.shape.h - 4);
      void key;
      return;
    }
    case 'image': {
      const im = AssetCache.get(n.asset);
      const b = localBounds(n);
      if (!im) { drawMissing(ctx, n, 'Missing Asset'); return; }
      if (n.tint) { ctx.save(); ctx.drawImage(im, b.x, b.y, b.w, b.h); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = rgba(n.tint, 0.45); ctx.fillRect(b.x, b.y, b.w, b.h); ctx.restore(); }
      else ctx.drawImage(im, b.x, b.y, b.w, b.h);
      return;
    }
    case 'text': {
      ctx.font = `${n.bold ? 'bold ' : ''}${n.fontSize || 18}px ${n.font || 'sans-serif'}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (n.stroke && n.strokeWidth) { ctx.lineWidth = n.strokeWidth; ctx.strokeStyle = n.stroke; ctx.strokeText(n.text || '', 0, 0); }
      ctx.fillStyle = n.fill || '#fff'; ctx.fillText(n.text || '', 0, 0);
      return;
    }
    case 'zone': case 'warp': case 'trigger': case 'spawn': {
      if (!overlayOn(opts.overlays, n.type)) return;
      const b = localBounds(n);
      const col = n.type === 'zone' ? '#22c55e' : n.type === 'warp' ? '#22d3ee' : n.type === 'trigger' ? '#f97316' : '#f2c761';
      if (n.type === 'spawn') {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.fillStyle = rgba(col, 0.25);
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[n.spawn?.direction || 'down'];
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(d[0] * 22, d[1] * 22); ctx.stroke();
        ctx.fillStyle = col; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${(n.spawn?.kind || 'player').toUpperCase()} SPAWN`, 0, -20);
        return;
      }
      ctx.fillStyle = rgba(col, 0.16); ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const label = n.type === 'zone' ? `${n.name}  Lv.${n.zone?.minLevel}-${n.zone?.maxLevel}` : n.type === 'warp' ? `${n.name} → ${n.warp?.toMap || '?'}` : `${n.name}`;
      ctx.fillText(label, b.x + 6, b.y + 5);
      return;
    }
    default: {
      if (n.type === 'rect' && n.behavior?.water) { drawGameWater(ctx, n, opts.still ? 0 : t); return; }
      if (n.type === 'rect' && n.behavior?.region) { drawRegionRect(ctx, n, opts); return; }
      setPathFor(ctx, n);
      const hasFill = n.fill && n.fill !== 'transparent' && n.fill !== 'none';
      if (n.type === 'path' && !n.closed) { /* stroke only */ }
      else if (hasFill) { ctx.fillStyle = n.tint ? mixHex(n.fill, n.tint, 0.5) : n.fill; ctx.fill(); }
      if (n.strokeWidth > 0 && n.stroke && n.stroke !== 'none') { ctx.lineWidth = n.strokeWidth; ctx.strokeStyle = n.stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
      if (n.outline) { ctx.lineWidth = (n.strokeWidth || 2) + 2; ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.stroke(); }
    }
  }
}
/** Water / lava rectangles imported from the game: the game's WATER_COLORS palette + animated waves. */
function drawGameWater(ctx, n, t) {
  const b = localBounds(n);
  const kind = n.behavior.water || 'pond';
  const cols = (typeof Game !== 'undefined' && Game.ok && GameSnapshot.world.WATER_COLORS[kind]) || [n.fill || '#3b82f6', n.stroke || '#60a5fa'];
  ctx.fillStyle = cols[0]; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
  ctx.strokeStyle = rgba(cols[1] || '#ffffff', 0.55); ctx.lineWidth = 2;
  const step = kind === 'sea' ? 26 : 22;
  for (let y = b.y + 10; y < b.y + b.h; y += step) {
    ctx.beginPath();
    for (let x = b.x; x <= b.x + b.w; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.05 + t * 1.6 + y * 0.05) * 3);
    ctx.stroke();
  }
  if (kind === 'lava') { ctx.fillStyle = rgba('#ffd27a', 0.35); for (let i = 0; i < Math.max(2, (b.w * b.h) / 12000); i++) { const rx = b.x + hash2(i, n.x) * b.w, ry = b.y + hash2(n.y, i) * b.h; ctx.beginPath(); ctx.arc(rx, ry, 3 + 3 * Math.abs(Math.sin(t * 2 + i)), 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
  if (n.strokeWidth > 0 && n.stroke && n.stroke !== 'none') { ctx.lineWidth = n.strokeWidth; ctx.strokeStyle = n.stroke; ctx.strokeRect(b.x, b.y, b.w, b.h); }
}
/** Region rectangles imported from the game (they only define which ground terrain is painted). */
function drawRegionRect(ctx, n, opts = {}) {
  if (!(opts.overlays === true || (opts.overlays && opts.overlays.zone))) return; // regions follow the encounter-zone overlay toggle
  const b = localBounds(n);
  const ti = TERRAIN_INDEX[typeof Game !== 'undefined' && Game.ok ? Game.gameTerrainId(n.behavior.region.terrain) : 'grass'];
  const col = TERRAINS[ti]?.accent || '#ffffff';
  ctx.setLineDash([10, 8]); ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const label = `${n.name} · ${n.behavior.region.terrain}`; const tw = ctx.measureText(label).width + 10;
  ctx.fillRect(b.x + 4, b.y + 4, tw, 16); ctx.fillStyle = '#e8f0ff'; ctx.fillText(label, b.x + 9, b.y + 6);
}
/** NPCs / trainers imported from the game are drawn with the game's own trainer avatar. */
function drawGameAvatar(ctx, n, t) {
  const npc = n.npc || {};
  GameSnapshot.world.drawTrainerAvatar(ctx, 0, 0, npc.color || '#7ad06a', t, { phase: (n.x || 0) * 0.01, cap: npc.kind === 'trainer' });
  if (npc.kind === 'trainer' && (npc.guardian || npc.finalBoss)) { ctx.fillStyle = npc.finalBoss ? '#ffd166' : '#9fd8ff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(npc.finalBoss ? 'FINAL BOSS' : 'GUARDIAN', 0, -58); }
}
/** Draw a Mythling rig scaled so its ground sits at y=0 of the current transform. */
function drawMythlingInline(ctx, my, anim, t, targetH, flip) {
  const doc = my.rig;
  const offsetFn = anim ? (id) => (anim.tracks[id] ? sampleTrack(anim.tracks[id], t, anim) : null) : NO_ANIM;
  const b = rigBounds(my);
  const s = targetH / Math.max(1, b.h);
  ctx.save();
  ctx.scale(flip ? -s : s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 2, b.w * 0.42, 7, 0, 0, Math.PI * 2); ctx.fill();
  renderDoc(ctx, doc, { offsetFn, still: true });
  ctx.restore();
}
const _rigBoundsCache = new Map();
function rigBounds(my) {
  const stamp = `${my.id}:${_wmStamp}`;
  const c = _rigBoundsCache.get(my.id);
  if (c && c.stamp === stamp) return c.b;
  let b = null;
  for (const n of allNodes(my.rig)) { if (n.type === 'anchor' || n.type === 'group' || !n.visible) continue; const bb = worldBoundsWith(n, my.rig, NO_ANIM); b = b ? unionRect(b, bb) : bb; }
  b = b || { x: -40, y: -80, w: 80, h: 80 };
  _rigBoundsCache.set(my.id, { stamp, b });
  return b;
}
/** Idle behaviours for props (bob / sway / pulse / spin). Applied around the node origin. */
function applyIdleBehavior(ctx, n, t) {
  const bh = n.behavior; if (!bh || !bh.idle || bh.idle === 'none') return;
  const sp = bh.idleSpeed || 1, am = bh.idleAmount || 1, ph = n.x * 0.02 + n.y * 0.01;
  switch (bh.idle) {
    case 'bob': ctx.translate(0, Math.sin(t * 2.2 * sp + ph) * 4 * am); break;
    case 'sway': ctx.rotate(deg2rad(Math.sin(t * 1.6 * sp + ph) * 3 * am)); break;
    case 'pulse': { const k = 1 + Math.sin(t * 3 * sp + ph) * 0.05 * am; ctx.scale(k, k); break; }
    case 'spin': ctx.rotate(t * sp * 1.5); break;
  }
}
function drawMissing(ctx, n, label) {
  const b = localBounds(n);
  ctx.fillStyle = 'rgba(248,113,113,0.18)'; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.setLineDash([6, 4]); ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x, b.y + b.h); ctx.stroke();
  ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2);
}
/** Draw a whole document (map or rig) into ctx, which is already in world space. */
function renderDoc(ctx, doc, opts = {}) {
  const offsetFn = opts.offsetFn || animOffset;
  const order = drawOrder(doc);
  const opacityOf = new Map();
  for (const n of order) {
    if (!n.visible) { opacityOf.set(n.id, 0); continue; }
    if (hiddenByLayer(n, doc)) { opacityOf.set(n.id, 0); continue; }
    const po = n.parent ? (opacityOf.get(n.parent) ?? 1) : 1;
    const o = animOffsetFor(n.id, offsetFn);
    const al = po * n.opacity * (o ? o.opacity : 1);
    opacityOf.set(n.id, al);
    if (al <= 0.001) continue;
    if (n.type === 'anchor') continue;
    if (['zone', 'warp', 'trigger', 'spawn'].includes(n.type) && !overlayOn(opts.overlays, n.type)) continue;
    const m = worldMatrix(n, doc, offsetFn);
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.globalAlpha = al;
    applyAppearance(ctx, n);
    if (!opts.still) applyIdleBehavior(ctx, n, E.time);
    if (n.shadow && n.type !== 'prefab' && n.type !== 'npc' && n.type !== 'mythling') { const b = localBounds(n); ctx.save(); ctx.globalAlpha = al * 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, b.y + b.h + 2, b.w * 0.45, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    drawNodeShape(ctx, n, opts);
    ctx.restore();
  }
}
function animOffsetFor(id, offsetFn) { return offsetFn ? offsetFn(id) : null; }
function overlayOn(ov, type) { if (!ov) return false; if (ov === true) return true; return !!ov[type]; }

// ---------------------------------------------------------------- terrain & collision
const terrainPatterns = new Map();
function terrainPattern(ctx, idx) {
  if (terrainPatterns.has(idx)) return terrainPatterns.get(idx);
  const t = TERRAINS[idx]; if (!t || !t.color) return null;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = t.color; g.fillRect(0, 0, 64, 64);
  g.fillStyle = t.accent || tint(t.color, 0.1);
  const rnd = seededRandom(idx * 77 + 3);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 64, y = rnd() * 64;
    if (t.id === 'grass' || t.id === 'forest' || t.game) { g.fillRect(x, y, 2, 5); }
    else if (t.id === 'water') { g.fillStyle = rgba('#ffffff', 0.18); g.fillRect(x, y, 8, 1.5); g.fillStyle = t.accent; }
    else if (t.id === 'lava') { g.fillStyle = '#ffb060'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); g.fillStyle = t.accent; }
    else if (t.id === 'rock' || t.id === 'cliff') { g.fillStyle = shade(t.color, 0.25); g.fillRect(x, y, 5, 3); g.fillStyle = t.accent; }
    else { g.beginPath(); g.arc(x, y, 1.5, 0, 7); g.fill(); }
  }
  const p = ctx.createPattern(c, 'repeat');
  terrainPatterns.set(idx, p);
  return p;
}
function renderTerrain(ctx, map, view, vw, vh) {
  const cell = map.cell;
  ctx.fillStyle = map.background || '#4f9d4a';
  ctx.fillRect(0, 0, map.width, map.height);
  const x0 = clamp(Math.floor(view.x / cell), 0, map.cols), x1 = clamp(Math.ceil((view.x + vw / view.zoom) / cell) + 1, 0, map.cols);
  const y0 = clamp(Math.floor(view.y / cell), 0, map.rows), y1 = clamp(Math.ceil((view.y + vh / view.zoom) / cell) + 1, 0, map.rows);
  // batch by terrain type to limit fillStyle switches
  const runs = new Map();
  for (let r = y0; r < y1; r++) for (let c = x0; c < x1; c++) {
    const ti = map.terrain[r * map.cols + c]; if (!ti) continue;
    if (!runs.has(ti)) runs.set(ti, []);
    runs.get(ti).push(c, r);
  }
  for (const [ti, cells] of runs) {
    const pat = view.zoom > 0.35 ? terrainPattern(ctx, ti) : null;
    ctx.fillStyle = pat || TERRAINS[ti].color;
    ctx.beginPath();
    for (let i = 0; i < cells.length; i += 2) ctx.rect(cells[i] * cell, cells[i + 1] * cell, cell + 0.5, cell + 0.5);
    ctx.fill();
  }
  // water shimmer
  if (view.zoom > 0.5) {
    const wcells = runs.get(TERRAIN_INDEX.water) || [];
    ctx.fillStyle = rgba('#ffffff', 0.12);
    for (let i = 0; i < wcells.length; i += 2) { const cx = wcells[i], cy = wcells[i + 1]; if (hash2(cx, cy) < 0.25) { const ph = (E.time * 0.6 + hash2(cx, cy, 5)) % 1; ctx.fillRect(cx * cell + ph * cell * 0.6, cy * cell + cell * 0.5, cell * 0.4, 2); } }
  }
}
function renderCollisionGrid(ctx, map, view, vw, vh, alpha = 0.35) {
  const cell = map.cell;
  const x0 = clamp(Math.floor(view.x / cell), 0, map.cols), x1 = clamp(Math.ceil((view.x + vw / view.zoom) / cell) + 1, 0, map.cols);
  const y0 = clamp(Math.floor(view.y / cell), 0, map.rows), y1 = clamp(Math.ceil((view.y + vh / view.zoom) / cell) + 1, 0, map.rows);
  ctx.globalAlpha = alpha;
  for (const mode of COLLISION_MODES) {
    ctx.fillStyle = mode.color; ctx.beginPath();
    let any = false;
    for (let r = y0; r < y1; r++) for (let c = x0; c < x1; c++) { if (map.collision[r * map.cols + c] === mode.value && (mode.value !== 0 || E.tool === 'collision')) { ctx.rect(c * cell, r * cell, cell, cell); any = true; } }
    if (any) ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function collisionShapeWorld(n, doc) {
  const c = n.collision; if (!c || !c.enabled) return null;
  const m = worldMatrix(n, doc);
  if (c.type === 'circle') { const [cx, cy] = M.apply(m, 0, 0); const [sx] = M.scaleOf(m); return { type: 'circle', x: cx, y: cy, r: c.radius * sx, mode: c.mode, node: n }; }
  if (c.type === 'polygon') return { type: 'polygon', points: c.points.map(([x, y]) => M.apply(m, x, y)), mode: c.mode, node: n };
  const [x, y, w, hh] = c.rect;
  return { type: 'polygon', points: [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]].map(([px, py]) => M.apply(m, px, py)), mode: c.mode, node: n, rect: true };
}
function renderObjectCollisions(ctx, doc, onlySelected = false) {
  for (const n of allNodes(doc)) {
    if (!n.collision?.enabled || !n.visible) continue;
    if (onlySelected && !E.selection.includes(n.id)) continue;
    const s = collisionShapeWorld(n, doc); if (!s) continue;
    const col = (COLLISION_MODES.find((m) => m.id === (s.mode || 'blocked')) || COLLISION_MODES[1]).color;
    ctx.fillStyle = rgba(col, 0.28); ctx.strokeStyle = col; ctx.lineWidth = 2 / E.view.zoom;
    ctx.beginPath();
    if (s.type === 'circle') ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); else { s.points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
  }
}

// ---------------------------------------------------------------- gizmos (screen space)
function drawGizmos(ctx, doc) {
  const v = E.view;
  const toS = (x, y) => [(x - v.x) * v.zoom, (y - v.y) * v.zoom];
  const S = settings();
  // anchors
  if (S.showAnchors && isCreatureMode()) {
    for (const n of allNodes(doc)) {
      if (n.type !== 'anchor' || !n.visible) continue;
      const [sx, sy] = toS(...worldPos(n, doc));
      const sel = E.selection.includes(n.id);
      ctx.beginPath(); ctx.arc(sx, sy, sel ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = n.fill || '#f2c761'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,.6)'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 9, sy); ctx.lineTo(sx + 9, sy); ctx.moveTo(sx, sy - 9); ctx.lineTo(sx, sy + 9); ctx.strokeStyle = rgba(n.fill || '#f2c761', 0.8); ctx.lineWidth = 1; ctx.stroke();
      if (E.tool === 'anchor' || sel || S.debug) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(n.name, sx + 8, sy - 6); }
    }
  }
  // pivots for parts
  if (S.showPivots && isCreatureMode() && (E.tool === 'pivot' || S.debug)) {
    for (const n of allNodes(doc)) {
      if (n.type === 'anchor' || !n.visible) continue;
      const [sx, sy] = toS(...worldPos(n, doc));
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // selection
  const sel = selectedNodes();
  if (!sel.length) return;
  for (const n of sel) {
    const b = subtreeBounds(n, doc);
    const [x0, y0] = toS(b.x, b.y), [x1, y1] = toS(b.x + b.w, b.y + b.h);
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0); ctx.setLineDash([]);
  }
  const b = selectionBounds(); if (!b) return;
  const [x0, y0] = toS(b.x, b.y), [x1, y1] = toS(b.x + b.w, b.y + b.h);
  ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0);
  const prim = primarySelected();
  const [px, py] = toS(...worldPos(prim, doc));
  // pivot marker
  ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.strokeStyle = E.tool === 'pivot' ? '#f2c761' : '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  if (E.tool === 'pivot') { ctx.fillStyle = '#f2c761'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('PIVOT', px + 9, py - 8); }
  if (E.tool === 'scale' || E.tool === 'select') {
    for (const [hx, hy] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]]) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5; ctx.fillRect(hx - 4, hy - 4, 8, 8); ctx.strokeRect(hx - 4, hy - 4, 8, 8);
    }
  }
  if (E.tool === 'move' || E.tool === 'select') {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 46, py); ctx.stroke(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(px + 54, py); ctx.lineTo(px + 44, py - 5); ctx.lineTo(px + 44, py + 5); ctx.fill();
    ctx.strokeStyle = '#22c55e'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 46); ctx.stroke(); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.moveTo(px, py - 54); ctx.lineTo(px - 5, py - 44); ctx.lineTo(px + 5, py - 44); ctx.fill();
  }
  if (E.tool === 'rotate') {
    const r = Math.max(40, Math.max(x1 - x0, y1 - y0) / 2 + 14);
    ctx.strokeStyle = '#f2c761'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
    const a = deg2rad(prim.rotation - 90);
    ctx.fillStyle = '#f2c761'; ctx.beginPath(); ctx.arc(px + Math.cos(a) * r, py + Math.sin(a) * r, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (E.tool === 'collision' && prim.collision?.enabled) {
    const s = collisionShapeWorld(prim, doc);
    if (s && s.type === 'polygon') {
      s.points.forEach((p, i) => { const [sx, sy] = toS(p[0], p[1]); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (!s.rect) { ctx.fillStyle = '#ef4444'; ctx.font = '9px sans-serif'; ctx.fillText(String(i), sx + 6, sy - 6); } });
    } else if (s && s.type === 'circle') {
      const [sx, sy] = toS(s.x + s.r, s.y); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  // polygon / path vertices for the selected shape when drawing tools are active
  if (['polygon', 'path'].includes(prim.type) && (['draw', 'polygon', 'path', 'select'].includes(E.tool)) && E.selection.length === 1) {
    const m = worldMatrix(prim, doc);
    prim.points.forEach((p, i) => { const [wx, wy] = M.apply(m, p[0], p[1]); const [sx, sy] = toS(wx, wy); ctx.fillStyle = i === E.activeVertex ? '#f2c761' : '#fff'; ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  }
}

// ---------------------------------------------------------------- particles / VFX playback
const VFXSystem = {
  particles: [], pool: [], active: [], // active = running effect instances
  clear() { this.particles.length = 0; this.active.length = 0; },
  /** Start an effect. anchorsFn(name) → [x,y] world coords for attach points. */
  play(effect, anchorsFn) {
    if (!effect) return;
    this.active.push({ effect, anchorsFn, t: 0, started: new Set() });
    Scene.startClock();
  },
  spawn(em, x, y, ang, k) {
    const p = this.pool.pop() || {};
    const spread = deg2rad(em.spread || 0);
    const a = deg2rad(em.rotation || 0) + (Math.random() - 0.5) * spread;
    const sp = (em.speed || 0) * (0.6 + Math.random() * 0.8);
    p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.life = p.max = (em.lifetime || 0.6) * (0.7 + Math.random() * 0.6);
    p.size = (em.size || 6) * (em.scale || 1) * (0.7 + Math.random() * 0.6);
    p.color = Math.random() < 0.7 ? em.color : em.color2 || em.color;
    p.kind = em.type; p.g = em.gravity || 0; p.rot = Math.random() * 6.28; p.spin = (Math.random() - 0.5) * 8;
    p.alpha = em.opacity == null ? 1 : em.opacity; p.blend = em.blend || 'lighter'; p.glow = em.glow || 0; p.trail = em.trail || 0;
    p.tx = null;
    this.particles.push(p);
    return p;
  },
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const inst = this.active[i];
      inst.t += dt;
      for (const em of inst.effect.emitters) {
        const start = em.delay || 0, end = start + (em.duration || 0.5);
        const [ax, ay] = inst.anchorsFn(em.attach, em) || [0, 0];
        const x = ax + (em.x || 0), y = ay + (em.y || 0);
        if (['ring', 'burst', 'glow', 'shockwave', 'aura'].includes(em.type)) {
          if (inst.t >= start && !inst.started.has(em.id)) {
            inst.started.add(em.id);
            const p = this.spawn(em, x, y, 0, 0); p.vx = p.vy = 0; p.g = 0; p.life = p.max = em.duration || 0.5; p.size = (em.size || 40) * (em.scale || 1); p.shape = em.type; p.follow = em.attach; p.inst = inst; p.em = em;
          }
          continue;
        }
        if (em.type === 'projectile') {
          if (inst.t >= start && !inst.started.has(em.id)) {
            inst.started.add(em.id);
            const [tx, ty] = inst.anchorsFn('TargetCenter', em) || [x + 200, y];
            const p = this.spawn(em, x, y, 0, 0); p.vx = p.vy = 0; p.g = 0; p.life = p.max = em.duration || 0.4; p.shape = 'projectile'; p.sx = x; p.sy = y; p.tx = tx; p.ty = ty; p.size = (em.size || 12) * (em.scale || 1); p.trail = em.trail;
          }
          continue;
        }
        // continuous emitters (particle, trail, splash, flame, leaf, vine, smoke, spark)
        if (inst.t >= start && inst.t <= end) {
          const rate = (em.count || 10) / Math.max(0.05, em.duration || 0.5);
          inst.acc = (inst.acc || 0) + rate * dt;
          let ex = x, ey = y;
          if (em.type === 'trail') { const [tx, ty] = inst.anchorsFn('TargetCenter', em) || [x + 200, y]; const k = clamp((inst.t - start) / (em.duration || 0.4), 0, 1); ex = lerp(x, tx, k); ey = lerp(y, ty, k); }
          if (em.type === 'vine') { const [tx, ty] = inst.anchorsFn('TargetCenter', em) || [x, y]; ex = tx + (Math.random() - 0.5) * 80; ey = ty + 20; }
          while (inst.acc >= 1) { inst.acc -= 1; const p = this.spawn(em, ex + (Math.random() - 0.5) * 10, ey + (Math.random() - 0.5) * 10); if (em.type === 'splash') { p.vy -= 120; } if (em.type === 'flame') { p.vy -= 40; } if (em.type === 'vine') { p.vx = 0; p.vy = -(em.speed || 200); p.g = 0; p.life = p.max = 0.5; } }
        }
      }
      const total = Math.max(inst.effect.duration || 1, ...inst.effect.emitters.map((e) => (e.delay || 0) + (e.duration || 0.5) + (e.lifetime || 0)));
      if (inst.t > total + 0.2) this.active.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); this.pool.push(p); continue; }
      if (p.shape === 'projectile') { const k = 1 - p.life / p.max; p.x = lerp(p.sx, p.tx, k); p.y = lerp(p.sy, p.ty, k) - Math.sin(k * Math.PI) * 30; continue; }
      if (p.follow && p.inst) { const [ax, ay] = p.inst.anchorsFn(p.follow, p.em) || [p.x, p.y]; p.x = ax + (p.em.x || 0); p.y = ay + (p.em.y || 0); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.rot += p.spin * dt;
      if (p.kind === 'smoke') p.size += dt * 14;
    }
  },
  render(ctx) {
    for (const p of this.particles) {
      const k = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = p.blend;
      ctx.globalAlpha = p.alpha * (p.shape ? 1 : Math.min(1, k * 1.5));
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = p.glow; }
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      const prog = 1 - k;
      switch (p.shape || p.kind) {
        case 'ring': case 'shockwave': { ctx.lineWidth = p.shape === 'shockwave' ? 6 * k + 1 : 3; ctx.globalAlpha *= k; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.2 + prog * 0.8) * (p.shape === 'shockwave' ? 1.3 : 1), 0, Math.PI * 2); ctx.stroke(); break; }
        case 'burst': { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (0.4 + prog)); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, p.color); g.addColorStop(1, rgba(p.color, 0)); ctx.fillStyle = g; ctx.globalAlpha *= k; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + prog), 0, Math.PI * 2); ctx.fill(); break; }
        case 'glow': case 'aura': { const pulse = 0.85 + 0.15 * Math.sin(E.time * 8); const r = p.size * pulse * (p.shape === 'aura' ? 1 : 0.6 + prog * 0.4); const g = ctx.createRadialGradient(p.x, p.y, r * 0.1, p.x, p.y, r); g.addColorStop(0, rgba(p.color, 0.8)); g.addColorStop(1, rgba(p.color, 0)); ctx.fillStyle = g; ctx.globalAlpha *= Math.min(1, k * 3); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); if (p.shape === 'aura') { ctx.lineWidth = 2; ctx.strokeStyle = rgba(p.color, 0.7); ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.7, r * 0.9, r * 0.25, 0, 0, Math.PI * 2); ctx.stroke(); } break; }
        case 'projectile': { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.35, 0, Math.PI * 2); ctx.fill(); if (p.trail) { ctx.globalAlpha *= 0.5; ctx.lineWidth = p.size * 0.9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.tx - p.sx) * 0.12, p.y - (p.ty - p.sy) * 0.12 + 6); ctx.stroke(); } break; }
        case 'leaf': { ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = rgba('#000', 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.stroke(); break; }
        case 'flame': { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.6); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.45, p.color); g.addColorStop(1, rgba(p.color, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 1.6, 0, Math.PI * 2); ctx.fill(); break; }
        case 'smoke': { ctx.globalAlpha *= k * 0.8; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); break; }
        case 'splash': case 'water': { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.6, p.size, 0, 0, Math.PI * 2); ctx.fill(); break; }
        case 'vine': { ctx.lineWidth = p.size * 0.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y + 30); ctx.quadraticCurveTo(p.x + 8, p.y + 10, p.x, p.y - 20 * prog); ctx.stroke(); break; }
        case 'spark': { ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size * 0.3, p.size * 2, p.size * 0.6); break; }
        default: { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
  },
  get busy() { return this.active.length > 0 || this.particles.length > 0; },
};

// ---------------------------------------------------------------- creature preview helper
/** Render a Mythling rig into any canvas (thumbnails, browser, evolution, PNG export). */
function renderCreatureTo(canvas, mythling, { anim = null, t = 0, pad = 20, background = null, scaleMult = 1, showAnchors = false } = {}) {
  const ctx = canvas.getContext('2d');
  const doc = mythling.rig;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, cw, ch); }
  const offsetFn = anim ? (id) => (anim.tracks[id] ? sampleTrack(anim.tracks[id], t, anim) : null) : NO_ANIM;
  let b = null;
  for (const n of allNodes(doc)) { if (n.type === 'anchor' || n.type === 'group' || !n.visible) continue; const bb = worldBoundsWith(n, doc, NO_ANIM); b = b ? unionRect(b, bb) : bb; }
  if (!b) return;
  const s = Math.min((cw - pad * 2) / Math.max(1, b.w), (ch - pad * 2) / Math.max(1, b.h)) * scaleMult;
  const cx = cw / 2 - (b.x + b.w / 2) * s, cy = ch / 2 - (b.y + b.h / 2) * s;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 2, b.w * 0.45, 8, 0, 0, Math.PI * 2); ctx.fill();
  renderDoc(ctx, doc, { offsetFn });
  if (showAnchors) for (const n of allNodes(doc)) { if (n.type !== 'anchor') continue; const [x, y] = M.apply(worldMatrix(n, doc, offsetFn), 0, 0); ctx.fillStyle = n.fill; ctx.beginPath(); ctx.arc(x, y, 3 / s * 2, 0, 7); ctx.fill(); }
  ctx.restore();
}
function worldBoundsWith(n, doc, offsetFn) {
  const b = localBounds(n), m = worldMatrix(n, doc, offsetFn);
  return boundsOfPoints([[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => M.apply(m, x, y)));
}
function creatureThumb(mythling, size = 56) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size; c.style.width = c.style.height = `${size}px`;
  renderCreatureTo(c, mythling, { pad: 6 });
  return c;
}
function prefabThumb(prefabId, size = 56) {
  const c = document.createElement('canvas'); c.width = c.height = size; c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d');
  const pf = PREFABS[prefabId]; if (!pf) return c;
  const s = (size - 10) / Math.max(pf.w, pf.h);
  ctx.translate(size / 2, size / 2 + (pf.h * s) / 2 - 2); ctx.scale(s, s);
  const fake = { shape: { w: pf.w, h: pf.h }, variant: 0, x: 0, y: 0, npc: { kind: 'regular', color: '#7ad06a' }, behavior: {} };
  if (pf.isNpc) drawNpcSprite(ctx, fake, 0); else pf.draw(ctx, fake, 0.5);
  return c;
}
function customPrefabThumb(prefab, size = 56) {
  const c = document.createElement('canvas'); c.width = c.height = size; c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d');
  const doc = { nodes: prefab.nodes, root: prefab.root };
  let b = null; for (const n of Object.values(prefab.nodes)) { if (n.type === 'group') continue; const bb = worldBoundsWith(n, doc, NO_ANIM); b = b ? unionRect(b, bb) : bb; }
  if (!b) return c;
  const s = (size - 8) / Math.max(b.w, b.h, 1);
  ctx.translate(size / 2 - (b.x + b.w / 2) * s, size / 2 - (b.y + b.h / 2) * s); ctx.scale(s, s);
  renderDoc(ctx, doc, { offsetFn: NO_ANIM, still: true });
  return c;
}
