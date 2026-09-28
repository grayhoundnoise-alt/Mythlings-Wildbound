// =============================================================================
// Scene: canvas viewport, render loop, grid / rulers / guides, snapping
// =============================================================================
const RULER = 16;
const Scene = {
  canvas: null, ctx: null, w: 0, h: 0, dpr: 1,
  needsDraw: true, rafId: null, lastTs: 0, clockUntil: 0, fps: 0, _fpsAcc: 0, _fpsN: 0,
  init() {
    this.canvas = $('#scene');
    this.ctx = this.canvas.getContext('2d');
    const ro = new ResizeObserver(() => this.resize());
    ro.observe($('#canvas-wrap'));
    this.resize();
    this.ensureLoop();
  },
  resize() {
    const wrap = $('#canvas-wrap');
    const w = Math.max(50, wrap.clientWidth), hh = Math.max(50, wrap.clientHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w; this.h = hh;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(hh * this.dpr);
    this.canvas.style.width = `${w}px`; this.canvas.style.height = `${hh}px`;
    this.invalidate();
  },
  invalidate() { this.needsDraw = true; this.ensureLoop(); },
  startClock(ms = 4000) { this.clockUntil = Math.max(this.clockUntil, performance.now() + ms); this.ensureLoop(); },
  ensureLoop() { if (!this.rafId) this.rafId = requestAnimationFrame((ts) => this.frame(ts)); },
  /** True when something on screen is time-dependent. */
  animated() {
    if (!E.project) return false;
    if (E.playing || VFXSystem.busy || E.playtest) return true;
    if (performance.now() < this.clockUntil) return true;
    return !!settings().livePreview;
  },
  frame(ts) {
    this.rafId = null;
    const dt = Math.min(0.1, this.lastTs ? (ts - this.lastTs) / 1000 : 0.016);
    this.lastTs = ts;
    this._fpsAcc += dt; this._fpsN++; if (this._fpsAcc >= 0.5) { this.fps = Math.round(this._fpsN / this._fpsAcc); this._fpsAcc = 0; this._fpsN = 0; }
    const anim = this.animated();
    if (anim) {
      E.time += dt;
      if (E.playing) {
        const a = currentAnim();
        if (a) {
          E.playhead += dt * E.speed;
          if (E.playhead >= a.duration) { if (E.loopPlayback && a.loop !== false) E.playhead = E.playhead % Math.max(0.001, a.duration); else { E.playhead = a.duration; E.playing = false; Bottom.syncTransport(); } }
          invalidateMatrices();
          Bottom.syncTransport();
        } else E.playing = false;
      }
      if (E.playtest) Playtest.update(dt);
      VFXSystem.update(dt);
      this.needsDraw = true;
    }
    if (this.needsDraw) { this.needsDraw = false; try { this.render(); } catch (err) { console.error(err); ConsoleLog.error(`Render error: ${err.message}`); } }
    if (anim || this.needsDraw) this.ensureLoop();
    else this.lastTs = 0;
  },
  // ------------------------------------------------------------- viewport
  screenToWorld(sx, sy) { const v = E.view; return [sx / v.zoom + v.x, sy / v.zoom + v.y]; },
  worldToScreen(wx, wy) { const v = E.view; return [(wx - v.x) * v.zoom, (wy - v.y) * v.zoom]; },
  setZoom(z, sx = this.w / 2, sy = this.h / 2) {
    z = clamp(z, 0.05, 16);
    const [wx, wy] = this.screenToWorld(sx, sy);
    E.view.zoom = z;
    E.view.x = wx - sx / z; E.view.y = wy - sy / z;
    UI.updateZoom(); this.invalidate();
  },
  zoomBy(f, sx, sy) { this.setZoom(E.view.zoom * f, sx, sy); },
  centerOn(wx, wy, zoom = E.view.zoom) { E.view.zoom = zoom; E.view.x = wx - this.w / 2 / zoom; E.view.y = wy - this.h / 2 / zoom; UI.updateZoom(); this.invalidate(); },
  fit(rect) {
    if (!rect) rect = this.contentRect();
    if (!rect || rect.w <= 0 || rect.h <= 0) return;
    const pad = 40;
    const z = clamp(Math.min((this.w - pad * 2) / rect.w, (this.h - pad * 2) / rect.h), 0.05, 8);
    this.centerOn(rect.x + rect.w / 2, rect.y + rect.h / 2, z);
  },
  fitSelection() { const b = selectionBounds(); if (b) this.fit({ x: b.x - 60, y: b.y - 60, w: b.w + 120, h: b.h + 120 }); else this.fit(); },
  contentRect() {
    if (isCreatureMode()) { const withTarget = ['vfx', 'skills', 'animation'].includes(E.mode) && settings().showTarget !== false; return { x: -200, y: -260, w: 400 + (withTarget ? TARGET_X - 40 : 0), h: 340 }; }
    const map = currentMap(); return map ? { x: 0, y: 0, w: map.width, h: map.height } : null;
  },
  // ------------------------------------------------------------- snapping
  /** Active snap step: maps use the visible grid, creature/animation editing uses a finer creature grid (default 4 px). */
  snapStep() { const S = settings(); return isCreatureMode() ? (S.creatureGridSize || 4) : S.gridSize; },
  snap(v) { const S = settings(); const gs = this.snapStep(); return S.snap ? Math.round(v / gs) * gs : v; },
  snapPoint(wx, wy, { guides = true } = {}) {
    const S = settings();
    let x = wx, y = wy, sx = false, sy = false;
    if (S.snap) { const gs = this.snapStep(); x = Math.round(wx / gs) * gs; y = Math.round(wy / gs) * gs; }
    if (guides && S.showGuides) {
      const th = 6 / E.view.zoom;
      for (const gx of S.guides.v) if (Math.abs(wx - gx) < th) { x = gx; sx = true; }
      for (const gy of S.guides.h) if (Math.abs(wy - gy) < th) { y = gy; sy = true; }
    }
    return [x, y, sx, sy];
  },
  // ------------------------------------------------------------- render
  render() {
    const ctx = this.ctx, v = E.view, S = E.project ? settings() : null;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#10141b';
    ctx.fillRect(0, 0, this.w, this.h);
    if (!E.project) return;
    if (E.playtest) { Playtest.render(ctx, this.w, this.h); return; }
    const doc = currentDoc();
    ctx.save();
    ctx.translate(-v.x * v.zoom, -v.y * v.zoom);
    ctx.scale(v.zoom, v.zoom);
    if (isCreatureMode()) this.renderCreatureWorld(ctx, doc, S);
    else this.renderMapWorld(ctx, doc, S);
    VFXSystem.render(ctx);
    ctx.restore();
    // screen-space overlays
    if (S.showGrid && v.zoom * S.gridSize >= 4 && !isCreatureMode()) this.drawGrid(ctx, S);
    if (S.showGuides) this.drawGuides(ctx, S);
    if (doc) drawGizmos(ctx, doc);
    if (Tools.drawOverlay) Tools.drawOverlay(ctx);
    if (S.showRulers !== false) this.drawRulers(ctx, S);
    if (S.debug) this.drawDebug(ctx);
  },
  renderMapWorld(ctx, map, S) {
    if (!map) return;
    renderTerrain(ctx, map, E.view, this.w, this.h);
    // map border
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2 / E.view.zoom; ctx.strokeRect(0, 0, map.width, map.height);
    // camera limits
    if (map.camera && (map.camera.minX > 0 || map.camera.minY > 0 || map.camera.maxX < map.width || map.camera.maxY < map.height)) {
      ctx.setLineDash([10 / E.view.zoom, 6 / E.view.zoom]); ctx.strokeStyle = '#f2c761'; ctx.strokeRect(map.camera.minX, map.camera.minY, map.camera.maxX - map.camera.minX, map.camera.maxY - map.camera.minY); ctx.setLineDash([]);
    }
    const overlays = { zone: S.showZones, warp: S.showTriggers, trigger: S.showTriggers, spawn: S.showTriggers };
    renderDoc(ctx, map, { overlays, still: !S.livePreview });
    const showCol = S.showCollision || E.tool === 'collision';
    if (showCol) { renderCollisionGrid(ctx, map, E.view, this.w, this.h, E.tool === 'collision' ? 0.45 : 0.3); renderObjectCollisions(ctx, map); }
    else if (E.selection.length && S.showBounds) renderObjectCollisions(ctx, map, true);
    if (S.debug) this.drawMapDebugWorld(ctx, map);
  },
  renderCreatureWorld(ctx, rig, S) {
    const v = E.view;
    // studio backdrop
    const x0 = v.x, y0 = v.y, x1 = v.x + this.w / v.zoom, y1 = v.y + this.h / v.zoom;
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#182030'); g.addColorStop(1, '#0f141c');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // ground
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x0, 0, x1 - x0, y1);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1 / v.zoom; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
    // origin axes
    ctx.strokeStyle = 'rgba(96,165,250,0.35)'; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(0, y1); ctx.stroke();
    // creature grid (light)
    if (S.showGrid) {
      const gs = S.gridSize; ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath();
      for (let x = Math.floor(x0 / gs) * gs; x < x1; x += gs) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let y = Math.floor(y0 / gs) * gs; y < y1; y += gs) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      ctx.stroke();
    }
    if (!rig) return;
    const my = currentMythling();
    // ground shadow
    const b = rigBounds(my);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 3, b.w * 0.45, 9, 0, 0, Math.PI * 2); ctx.fill();
    // before/after compare: ghost rest pose to the left
    if (E.compare) { ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(-b.w - 60, 0); renderDoc(ctx, rig, { offsetFn: NO_ANIM }); ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `${12 / v.zoom}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('BEFORE (rest pose)', -b.w - 60, 24 / v.zoom); ctx.fillText('AFTER', 0, 24 / v.zoom); }
    renderDoc(ctx, rig, {});
    // target dummy for attack testing
    if (['vfx', 'skills', 'animation'].includes(E.mode) && (S.showTarget !== false)) this.drawTargetDummy(ctx, my);
    if (S.showAnchors && ['vfx', 'skills', 'animation'].includes(E.mode)) {
      const [ax, ay] = anchorWorld(my, 'AttackOrigin');
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2 / v.zoom; ctx.beginPath(); ctx.arc(ax, ay, 8 / v.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 40 / v.zoom, ay); ctx.stroke();
      ctx.fillStyle = '#f87171'; ctx.font = `${11 / v.zoom}px sans-serif`; ctx.textAlign = 'left'; ctx.fillText('ATTACK ORIGIN', ax + 12 / v.zoom, ay - 10 / v.zoom);
    }
  },
  drawTargetDummy(ctx, my) {
    const tx = TARGET_X, t = E.time;
    const hit = E.targetHit && (E.time - E.targetHit) < 0.4;
    const shake = hit ? Math.sin(E.time * 60) * 4 : 0;
    ctx.save(); ctx.translate(tx + shake, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 3, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hit ? '#f87171' : '#3b4656'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    // dummy: post + body + head
    ctx.fillRect(-6, -60, 12, 60);
    ctx.beginPath(); ctx.ellipse(0, -90, 34, 42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -145, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f2c761'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -90, 16, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -90, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TARGET DUMMY', 0, -178 + Math.sin(t * 2) * 2);
    ctx.restore();
  },
  drawGrid(ctx, S) {
    const v = E.view; let gs = S.gridSize;
    while (gs * v.zoom < 12) gs *= 2;
    const x0 = Math.floor(v.x / gs) * gs, y0 = Math.floor(v.y / gs) * gs;
    const x1 = v.x + this.w / v.zoom, y1 = v.y + this.h / v.zoom;
    const map = currentMap();
    ctx.save();
    ctx.beginPath();
    for (let x = x0; x <= x1; x += gs) { if (map && (x < 0 || x > map.width)) continue; const sx = Math.round((x - v.x) * v.zoom) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, this.h); }
    for (let y = y0; y <= y1; y += gs) { if (map && (y < 0 || y > map.height)) continue; const sy = Math.round((y - v.y) * v.zoom) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(this.w, sy); }
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.stroke();
    // major lines every 4 cells
    ctx.beginPath(); const maj = gs * 4;
    for (let x = Math.floor(v.x / maj) * maj; x <= x1; x += maj) { if (map && (x < 0 || x > map.width)) continue; const sx = Math.round((x - v.x) * v.zoom) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, this.h); }
    for (let y = Math.floor(v.y / maj) * maj; y <= y1; y += maj) { if (map && (y < 0 || y > map.height)) continue; const sy = Math.round((y - v.y) * v.zoom) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(this.w, sy); }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
    ctx.restore();
  },
  drawGuides(ctx, S) {
    const v = E.view;
    ctx.save(); ctx.strokeStyle = 'rgba(34,211,238,0.8)'; ctx.lineWidth = 1;
    for (const gx of S.guides.v) { const sx = Math.round((gx - v.x) * v.zoom) + 0.5; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, this.h); ctx.stroke(); }
    for (const gy of S.guides.h) { const sy = Math.round((gy - v.y) * v.zoom) + 0.5; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(this.w, sy); ctx.stroke(); }
    if (E.dragging && E.dragging.kind === 'guide') {
      ctx.strokeStyle = '#22d3ee'; ctx.setLineDash([4, 4]); const d = E.dragging;
      if (d.axis === 'v') { const sx = Math.round((d.value - v.x) * v.zoom) + 0.5; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, this.h); ctx.stroke(); ctx.fillStyle = '#22d3ee'; ctx.font = '11px sans-serif'; ctx.fillText(`x ${Math.round(d.value)}`, sx + 4, 30); }
      else { const sy = Math.round((d.value - v.y) * v.zoom) + 0.5; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(this.w, sy); ctx.stroke(); ctx.fillStyle = '#22d3ee'; ctx.font = '11px sans-serif'; ctx.fillText(`y ${Math.round(d.value)}`, 22, sy - 4); }
    }
    ctx.restore();
  },
  drawRulers(ctx, S) {
    const v = E.view;
    ctx.save();
    ctx.fillStyle = 'rgba(20,26,36,0.92)';
    ctx.fillRect(0, 0, this.w, RULER); ctx.fillRect(0, 0, RULER, this.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, RULER + 0.5); ctx.lineTo(this.w, RULER + 0.5); ctx.moveTo(RULER + 0.5, 0); ctx.lineTo(RULER + 0.5, this.h); ctx.stroke();
    // nice step
    const target = 80 / v.zoom; const pow = Math.pow(10, Math.floor(Math.log10(target)));
    const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= target) || pow * 10;
    ctx.fillStyle = '#9fb0c8'; ctx.font = '9px sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const x0 = Math.floor(v.x / step) * step, x1 = v.x + this.w / v.zoom;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) { const sx = Math.round((x - v.x) * v.zoom) + 0.5; if (sx < RULER) continue; ctx.moveTo(sx, RULER - 6); ctx.lineTo(sx, RULER); ctx.fillText(String(Math.round(x)), sx + 2, 1); for (let k = 1; k < 5; k++) { const mx = Math.round((x + (step * k) / 5 - v.x) * v.zoom) + 0.5; ctx.moveTo(mx, RULER - 3); ctx.lineTo(mx, RULER); } }
    const y0 = Math.floor(v.y / step) * step, y1 = v.y + this.h / v.zoom;
    for (let y = y0; y <= y1; y += step) { const sy = Math.round((y - v.y) * v.zoom) + 0.5; if (sy < RULER) continue; ctx.moveTo(RULER - 6, sy); ctx.lineTo(RULER, sy); for (let k = 1; k < 5; k++) { const my = Math.round((y + (step * k) / 5 - v.y) * v.zoom) + 0.5; ctx.moveTo(RULER - 3, my); ctx.lineTo(RULER, my); } }
    ctx.strokeStyle = '#9fb0c8'; ctx.stroke();
    for (let y = y0; y <= y1; y += step) { const sy = Math.round((y - v.y) * v.zoom); if (sy < RULER) continue; ctx.save(); ctx.translate(2, sy + 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'right'; ctx.fillText(String(Math.round(y)), 0, 0); ctx.restore(); }
    // cursor markers
    const [cx, cy] = [E.cursor.sx, E.cursor.sy];
    ctx.strokeStyle = '#f2c761'; ctx.beginPath(); ctx.moveTo(cx + 0.5, 0); ctx.lineTo(cx + 0.5, RULER); ctx.moveTo(0, cy + 0.5); ctx.lineTo(RULER, cy + 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(20,26,36,0.92)'; ctx.fillRect(0, 0, RULER, RULER);
    ctx.restore();
  },
  drawMapDebugWorld(ctx, map) {
    ctx.save(); ctx.font = `${10 / E.view.zoom}px monospace`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'left';
    for (const n of allNodes(map)) { if (n.type === 'group') continue; const [x, y] = worldPos(n, map); ctx.fillText(`${n.name} (${Math.round(x)},${Math.round(y)}) z${n.z}`, x + 4 / E.view.zoom, y - 4 / E.view.zoom); }
    ctx.restore();
  },
  drawDebug(ctx) {
    const doc = currentDoc();
    const lines = [`fps ${this.fps}`, `zoom ${E.view.zoom.toFixed(2)}  view ${Math.round(E.view.x)},${Math.round(E.view.y)}`, `nodes ${doc ? Object.keys(doc.nodes).length : 0}  particles ${VFXSystem.particles.length}`, `tool ${E.tool}  mode ${E.mode}`, `playhead ${E.playhead.toFixed(3)}`];
    ctx.save(); ctx.font = '11px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.w - 250, 8 + i * 15, 242, 14); ctx.fillStyle = '#a7f3d0'; ctx.fillText(l, this.w - 12, 9 + i * 15); });
    ctx.restore();
  },
};
const TARGET_X = 300;
/** World position of a named anchor on a Mythling (uses current playhead when it is the current doc). */
function anchorWorld(my, name, offsetFn) {
  if (!my) return [0, 0];
  const doc = my.rig;
  const a = Object.values(doc.nodes).find((n) => n.type === 'anchor' && n.name === name) || Object.values(doc.nodes).find((n) => n.type === 'anchor' && n.name === 'BodyCenter');
  if (!a) return [0, -40];
  return M.apply(worldMatrix(a, doc, offsetFn || (doc === currentDoc() ? animOffset : NO_ANIM)), 0, 0);
}
/** Attach-point resolver for the VFX system in the creature studio. */
function studioAnchors(my, casterX = 0, targetX = TARGET_X) {
  return (name) => {
    switch (name) {
      case 'World': return [0, 0];
      case 'Target': return [targetX, -20];
      case 'TargetCenter': return [targetX, -90];
      case 'Body': case 'BodyCenter': { const [x, y] = anchorWorld(my, 'BodyCenter'); return [x + casterX, y]; }
      case 'Tail': { const [x, y] = anchorWorld(my, 'TailTip'); return [x + casterX, y]; }
      default: { const [x, y] = anchorWorld(my, name); return [x + casterX, y]; }
    }
  };
}
