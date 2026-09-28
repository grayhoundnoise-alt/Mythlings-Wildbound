// =============================================================================
// Canvas tools: pointer interaction, gizmo handles, drawing, painting, shortcuts
// =============================================================================
const TRANSFORM_TOOLS = ['select', 'move', 'rotate', 'scale'];
const TOOL_INFO = {
  select: { name: 'SELECT', key: 'V', hint: 'Click to select · Shift+click multi-select · drag empty space for box select · drag handles to resize' },
  move: { name: 'MOVE', key: 'W', hint: 'Drag to move · Shift = axis lock · arrows nudge (Shift ×10)' },
  rotate: { name: 'ROTATE', key: 'E', hint: 'Drag around the pivot to rotate · Shift snaps to 15°' },
  scale: { name: 'SCALE', key: 'R', hint: 'Drag handles or the object to scale · Shift = uniform' },
  draw: { name: 'DRAW', key: 'B', hint: 'Drag to draw a freehand path' },
  rectangle: { name: 'RECTANGLE', key: 'U', hint: 'Drag to create a rectangle' },
  ellipse: { name: 'ELLIPSE', key: 'O', hint: 'Drag to create an ellipse' },
  polygon: { name: 'POLYGON', key: 'Y', hint: 'Click to add vertices · Enter / double-click to finish · Esc to cancel' },
  path: { name: 'PATH', key: 'N', hint: 'Click to add smooth points · Enter to finish · Esc to cancel' },
  eraser: { name: 'ERASER', key: 'X', hint: 'Click an object to delete it · click a vertex to remove it' },
  anchor: { name: 'ANCHOR', key: 'A', hint: 'Click to add an anchor · drag anchors to move them' },
  pivot: { name: 'PIVOT', key: 'P', hint: 'Drag the pivot marker of the selected object' },
  collision: { name: 'COLLISION', key: 'C', hint: 'Paint collision cells · drag shape handles of a selected object' },
  paint: { name: 'PAINT', key: 'M', hint: 'Paint terrain · [ ] change brush size · 1-9 pick terrain' },
  spawn: { name: 'SPAWN', key: 'S', hint: 'Click to place a spawn point' },
  warp: { name: 'WARP', key: 'T', hint: 'Drag to place a warp area' },
  trigger: { name: 'TRIGGER', key: 'I', hint: 'Drag to place a trigger area' },
  zone: { name: 'SPAWN ZONE', key: 'Z', hint: 'Drag to place an encounter zone' },
};
const Tools = {
  spaceHeld: false, draft: null, hoverHandle: null, ctxMenu: null,
  init() {
    const c = Scene.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    c.addEventListener('dblclick', (e) => this.onDblClick(e));
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); this.onContext(e); });
    // keyboard: App.bootUI owns the single document keydown/keyup dispatcher (playtest → dialogs → screens → Tools.onKey)
    document.addEventListener('mousedown', (e) => { if (this.ctxMenu && !this.ctxMenu.contains(e.target)) this.closeContext(); }, true);
    // drag & drop from library / assets
    c.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    c.addEventListener('drop', (e) => this.onDrop(e));
  },
  local(e) { const r = Scene.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; },
  updateCursor() {
    const c = Scene.canvas;
    c.className = '';
    if (this.spaceHeld || (E.dragging && E.dragging.kind === 'pan')) c.classList.add('panning');
    else if (E.tool === 'select') c.classList.add('tool-select');
    else if (E.tool === 'move') c.classList.add('tool-move');
    else if (E.tool === 'paint' || E.tool === 'collision') c.classList.add('tool-paint');
    if (this.hoverHandle) c.style.cursor = this.hoverHandle.cursor || 'pointer'; else c.style.cursor = '';
  },
  // ------------------------------------------------------------- handle hit-testing (screen space)
  handles() {
    const out = [];
    const doc = currentDoc(); if (!doc || !E.selection.length || E.playtest) return out;
    const prim = primarySelected(); if (!prim) return out;
    const b = selectionBounds(); if (!b) return out;
    const [x0, y0] = Scene.worldToScreen(b.x, b.y), [x1, y1] = Scene.worldToScreen(b.x + b.w, b.y + b.h);
    const [px, py] = Scene.worldToScreen(...worldPos(prim, doc));
    if (E.tool === 'pivot') out.push({ kind: 'pivot', x: px, y: py, r: 10, cursor: 'move' });
    if (E.tool === 'rotate') { const r = Math.max(40, Math.max(x1 - x0, y1 - y0) / 2 + 14); const a = deg2rad(prim.rotation - 90); out.push({ kind: 'rotate', x: px + Math.cos(a) * r, y: py + Math.sin(a) * r, r: 10, cursor: 'grab' }); }
    if (E.tool === 'scale' || E.tool === 'select') {
      const hs = [[x0, y0, 'nw'], [x1, y0, 'ne'], [x1, y1, 'se'], [x0, y1, 'sw'], [(x0 + x1) / 2, y0, 'n'], [(x0 + x1) / 2, y1, 's'], [x0, (y0 + y1) / 2, 'w'], [x1, (y0 + y1) / 2, 'e']];
      for (const [hx, hy, dir] of hs) out.push({ kind: 'scale', dir, x: hx, y: hy, r: 7, cursor: `${dir}-resize`, box: { x0, y0, x1, y1 } });
    }
    if (E.tool === 'collision' && prim.collision?.enabled) {
      const s = collisionShapeWorld(prim, doc);
      if (s && s.type === 'polygon') s.points.forEach((p, i) => { const [sx, sy] = Scene.worldToScreen(p[0], p[1]); out.push({ kind: 'colvertex', index: i, x: sx, y: sy, r: 8, cursor: 'move', rect: s.rect }); });
      else if (s && s.type === 'circle') { const [sx, sy] = Scene.worldToScreen(s.x + s.r, s.y); out.push({ kind: 'colradius', x: sx, y: sy, r: 8, cursor: 'ew-resize' }); }
    }
    if (['polygon', 'path'].includes(prim.type) && E.selection.length === 1 && ['select', 'draw', 'polygon', 'path', 'eraser'].includes(E.tool)) {
      const m = worldMatrix(prim, doc);
      prim.points.forEach((p, i) => { const [wx, wy] = M.apply(m, p[0], p[1]); const [sx, sy] = Scene.worldToScreen(wx, wy); out.push({ kind: 'vertex', index: i, x: sx, y: sy, r: 7, cursor: 'move' }); });
    }
    return out;
  },
  handleAt(sx, sy) {
    const hs = this.handles();
    // vertices & pivots first (smaller targets), then scale handles
    const order = ['pivot', 'vertex', 'colvertex', 'colradius', 'rotate', 'scale'];
    hs.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    return hs.find((hh) => Math.hypot(hh.x - sx, hh.y - sy) <= hh.r) || null;
  },
  // ------------------------------------------------------------- pointer
  onDown(e) {
    if (E.playtest) { Playtest.onPointer(e); return; }
    Scene.canvas.focus({ preventScroll: true });
    this.closeContext();
    const [sx, sy] = this.local(e); const [wx, wy] = Scene.screenToWorld(sx, sy);
    E.cursor = { x: wx, y: wy, sx, sy };
    if (e.button === 1 || (e.button === 0 && this.spaceHeld)) { E.dragging = { kind: 'pan', sx, sy, vx: E.view.x, vy: E.view.y }; this.updateCursor(); Scene.canvas.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0) return;
    // rulers → guides
    if (settings().showRulers !== false && (sx < RULER || sy < RULER)) { E.dragging = { kind: 'guide', axis: sx < RULER ? 'v' : 'h', value: sx < RULER ? wx : wy }; return; }
    const doc = currentDoc(); if (!doc) return;
    const tool = E.tool;
    const hnd = this.handleAt(sx, sy);
    if (tool === 'eraser' && hnd && hnd.kind === 'vertex') { this.removeVertex(hnd.index); return; } // eraser removes vertices instead of dragging them
    if (hnd && !e.altKey) { this.beginHandleDrag(hnd, sx, sy, wx, wy, e); return; }
    if (['polygon', 'path'].includes(tool)) { this.draftAddPoint(wx, wy, tool); return; }
    if (['rectangle', 'ellipse', 'warp', 'trigger', 'zone'].includes(tool)) { const [x, y] = Scene.snapPoint(wx, wy); E.dragging = { kind: 'draft-rect', tool, x0: x, y0: y, x1: x, y1: y }; return; }
    if (tool === 'draw') { E.dragging = { kind: 'pencil', points: [[wx, wy]] }; return; }
    if (tool === 'spawn') { Ops.addObjectOfType('spawn', wx, wy, { spawn: { kind: E.spawnKind, direction: 'down', enabled: true } }); return; }
    if (tool === 'anchor' && isCreatureMode()) {
      const hit = hitTest(wx, wy, { includeAnchors: true });
      if (hit && hit.type === 'anchor') { select(hit.id, { add: e.shiftKey }); this.beginMove([hit.id], wx, wy, e); return; }
      const n = Ops.addObjectOfType('anchor', wx, wy); if (n) { this.beginMove([n.id], wx, wy, e); } return;
    }
    if (tool === 'paint' && !isCreatureMode()) { this.beginPaint(wx, wy, e); return; }
    if (tool === 'collision' && !isCreatureMode()) {
      const hit = hitTest(wx, wy, { includeAnchors: false });
      if (hit && hit.collision?.enabled && (e.shiftKey || E.selection.includes(hit.id))) { select(hit.id); return; }
      this.beginCollisionPaint(wx, wy, e); return;
    }
    if (tool === 'eraser') {
      const hit = hitTest(wx, wy); if (hit) Ops.deleteNodes([hit.id]); return;
    }
    // alt+click on selected polygon edge → insert vertex
    if (e.altKey && E.selection.length === 1 && ['polygon', 'path'].includes(primarySelected().type)) { if (this.insertVertexNear(wx, wy)) return; }
    // transform tools
    const hit = hitTest(wx, wy, { includeAnchors: tool !== 'collision' });
    if (tool === 'pivot') { if (hit) select(hit.id); return; }
    if (hit) {
      const already = E.selection.includes(hit.id);
      if (e.shiftKey || e.ctrlKey || e.metaKey) { select(hit.id, { add: true }); return; }
      if (!already) select(hit.id);
      if (tool === 'rotate') { this.beginRotate(sx, sy, e); return; }
      if (tool === 'scale') { this.beginBodyScale(sx, sy, wx, wy, e); return; }
      this.beginMove(E.selection, wx, wy, e);
      return;
    }
    if (tool === 'select' || tool === 'move') { if (!e.shiftKey) select([]); E.dragging = { kind: 'box', sx, sy, x: sx, y: sy, add: e.shiftKey }; return; }
    if (!e.shiftKey) select([]);
  },
  beginHandleDrag(hnd, sx, sy, wx, wy, e) {
    const doc = currentDoc(); const prim = primarySelected();
    if (hnd.kind === 'pivot') { History.begin('Move pivot'); E.dragging = { kind: 'pivot', node: prim }; return; }
    if (hnd.kind === 'rotate') { this.beginRotate(sx, sy, e); return; }
    if (hnd.kind === 'scale') {
      History.begin('Scale');
      const b = selectionBounds();
      const anchorMap = { nw: [b.x + b.w, b.y + b.h], ne: [b.x, b.y + b.h], se: [b.x, b.y], sw: [b.x + b.w, b.y], n: [b.x + b.w / 2, b.y + b.h], s: [b.x + b.w / 2, b.y], w: [b.x + b.w, b.y + b.h / 2], e: [b.x, b.y + b.h / 2] };
      const nodes = selectedNodes().filter((n) => !n.locked);
      const resizeShape = E.tool === 'select' && nodes.length === 1 && ['rect', 'ellipse', 'image', 'zone', 'warp', 'trigger', 'text'].includes(nodes[0].type) && Math.abs(nodes[0].rotation % 360) < 0.01;
      E.dragging = { kind: 'scale', dir: hnd.dir, anchor: e.altKey ? [b.x + b.w / 2, b.y + b.h / 2] : anchorMap[hnd.dir], startB: b, resizeShape, nodes: nodes.map((n) => ({ n, sx: n.scaleX, sy: n.scaleY, x: n.x, y: n.y, w: n.shape.w, h: n.shape.h, wp: worldPos(n, doc) })), wx, wy };
      return;
    }
    if (hnd.kind === 'vertex') { History.begin('~Move vertex'); E.activeVertex = hnd.index; E.dragging = { kind: 'vertex', node: prim, index: hnd.index }; Scene.invalidate(); return; }
    if (hnd.kind === 'colvertex') { History.begin('~Edit collision'); E.dragging = { kind: 'colvertex', node: prim, index: hnd.index, rect: hnd.rect }; return; }
    if (hnd.kind === 'colradius') { History.begin('~Edit collision'); E.dragging = { kind: 'colradius', node: prim }; return; }
  },
  beginMove(ids, wx, wy, e) {
    const doc = currentDoc();
    const nodes = ids.map((id) => doc.nodes[id]).filter((n) => n && !n.locked);
    if (!nodes.length) return;
    // do not move both a parent and its descendant
    const tops = nodes.filter((n) => !nodes.some((o) => o !== n && isAncestor(o.id, n.id, doc)));
    History.begin(isCreatureMode() && currentAnim() && E.mode === 'animation' ? 'Move (pose)' : 'Move');
    E.dragging = { kind: 'move', wx, wy, moved: false, nodes: tops.map((n) => ({ n, x: n.x, y: n.y, wp: worldPos(n, doc) })), prim: primarySelected() };
  },
  beginRotate(sx, sy, e) {
    const doc = currentDoc(); const prim = primarySelected(); if (!prim) return;
    const [px, py] = Scene.worldToScreen(...worldPos(prim, doc));
    History.begin('Rotate');
    E.dragging = { kind: 'rotate', px, py, a0: Math.atan2(sy - py, sx - px), nodes: selectedNodes().filter((n) => !n.locked).map((n) => ({ n, r: n.rotation })) };
  },
  beginBodyScale(sx, sy, wx, wy, e) {
    const doc = currentDoc(); const prim = primarySelected(); if (!prim) return;
    const [px, py] = worldPos(prim, doc);
    History.begin('Scale');
    E.dragging = { kind: 'bodyscale', px, py, d0: Math.max(4, dist(wx, wy, px, py)), nodes: selectedNodes().filter((n) => !n.locked).map((n) => ({ n, sx: n.scaleX, sy: n.scaleY })) };
  },
  beginPaint(wx, wy, e) {
    const map = currentMap(); if (!map) return;
    const sub = E.subTool;
    const ti = e.altKey || sub === 'erase' ? TERRAIN_INDEX[map.baseTerrain || 'grass'] : TERRAIN_INDEX[E.terrain];
    if (sub === 'fill') { History.run('Fill terrain', () => { Ops.paintCells(map, Ops.floodFill(map, wx, wy, ti), ti); }); return; }
    if (sub === 'replace') { const c = Math.floor(wx / map.cell), r = Math.floor(wy / map.cell); const from = map.terrain[r * map.cols + c]; if (from === ti) return; History.run('Replace terrain', () => { Ops.paintCells(map, Ops.replaceTerrain(map, from, ti), ti); }); return; }
    if (sub === 'rect') { E.dragging = { kind: 'paintrect', ti, x0: wx, y0: wy, x1: wx, y1: wy }; return; }
    if (sub === 'pick') { const c = Math.floor(wx / map.cell), r = Math.floor(wy / map.cell); const t = TERRAINS[map.terrain[r * map.cols + c]]; if (t) { E.terrain = t.id; Left.render(); } return; }
    History.begin('Paint terrain');
    E.dragging = { kind: 'paint', ti: sub === 'water' ? TERRAIN_INDEX.water : ti };
    this.paintAt(wx, wy);
  },
  paintAt(wx, wy) { const map = currentMap(); const d = E.dragging; if (Ops.paintCells(map, Ops.brushCells(map, wx, wy, E.brushSize), d.ti)) Scene.invalidate(); },
  beginCollisionPaint(wx, wy, e) {
    const map = currentMap(); if (!map) return;
    const sub = E.subTool;
    const val = e.altKey ? 0 : E.collisionMode;
    if (sub === 'fill') { History.run('Fill collision', () => { for (const [c, r] of Ops.floodFill(map, wx, wy, val, map.collision)) map.collision[r * map.cols + c] = val; }); return; }
    if (sub === 'rect') { E.dragging = { kind: 'colrect', val, x0: wx, y0: wy, x1: wx, y1: wy }; return; }
    History.begin('Paint collision');
    E.dragging = { kind: 'colpaint', val };
    this.collisionAt(wx, wy);
  },
  collisionAt(wx, wy) { const map = currentMap(); const d = E.dragging; let ch = false; for (const [c, r] of Ops.brushCells(map, wx, wy, E.brushSize)) { if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) continue; const i = r * map.cols + c; if (map.collision[i] !== d.val) { map.collision[i] = d.val; ch = true; } } if (ch) Scene.invalidate(); },
  onMove(e) {
    if (!Scene.canvas) return;
    const [sx, sy] = this.local(e); const [wx, wy] = Scene.screenToWorld(sx, sy);
    E.cursor = { x: wx, y: wy, sx, sy };
    UI.updateCursor();
    if (E.playtest) { Playtest.onPointer(e); return; }
    const d = E.dragging;
    if (!d) {
      const inside = sx >= 0 && sy >= 0 && sx <= Scene.w && sy <= Scene.h;
      const hh = inside ? this.handleAt(sx, sy) : null;
      if ((hh && hh.kind) !== (this.hoverHandle && this.hoverHandle.kind) || (hh && this.hoverHandle && hh.cursor !== this.hoverHandle.cursor)) { this.hoverHandle = hh; this.updateCursor(); }
      else this.hoverHandle = hh;
      if (settings().showRulers !== false || E.tool === 'paint' || E.tool === 'collision') Scene.invalidate();
      return;
    }
    const doc = currentDoc();
    switch (d.kind) {
      case 'pan': E.view.x = d.vx - (sx - d.sx) / E.view.zoom; E.view.y = d.vy - (sy - d.sy) / E.view.zoom; Scene.invalidate(); break;
      case 'guide': d.value = d.axis === 'v' ? wx : wy; Scene.invalidate(); break;
      case 'box': d.x = sx; d.y = sy; Scene.invalidate(); break;
      case 'move': {
        let dx = wx - d.wx, dy = wy - d.wy;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        // snap the primary's pivot
        const p = d.nodes.find((x) => x.n === d.prim) || d.nodes[0];
        const [tx, ty] = [p.wp[0] + dx, p.wp[1] + dy];
        const [snx, sny] = e.altKey ? [tx, ty] : Scene.snapPoint(tx, ty);
        dx = snx - p.wp[0]; dy = sny - p.wp[1];
        for (const it of d.nodes) setWorldPosition(it.n, it.wp[0] + dx, it.wp[1] + dy, doc);
        d.moved = true; invalidateMatrices(); Scene.invalidate(); Right.syncTransform();
        break;
      }
      case 'rotate': {
        let da = rad2deg(Math.atan2(sy - d.py, sx - d.px) - d.a0);
        if (e.shiftKey) da = Math.round(da / 15) * 15;
        for (const it of d.nodes) it.n.rotation = round(it.r + da, 2);
        invalidateMatrices(); Scene.invalidate(); Right.syncTransform();
        break;
      }
      case 'bodyscale': {
        const k = clamp(dist(wx, wy, d.px, d.py) / d.d0, 0.05, 20);
        for (const it of d.nodes) { it.n.scaleX = round(it.sx * k, 3); it.n.scaleY = round(it.sy * k, 3); }
        invalidateMatrices(); Scene.invalidate(); Right.syncTransform();
        break;
      }
      case 'scale': {
        const [ax, ay] = d.anchor; const b = d.startB;
        let kx = 1, ky = 1;
        const dirX = d.dir.includes('e') ? 1 : d.dir.includes('w') ? -1 : 0, dirY = d.dir.includes('s') ? 1 : d.dir.includes('n') ? -1 : 0;
        const [swx, swy] = e.altKey ? [wx, wy] : Scene.snapPoint(wx, wy);
        if (dirX) { const w0 = Math.max(1, Math.abs(d.wx - ax)); kx = Math.abs(swx - ax) / w0; }
        if (dirY) { const h0 = Math.max(1, Math.abs(d.wy - ay)); ky = Math.abs(swy - ay) / h0; }
        if (e.shiftKey || (!dirX || !dirY) === false && E.tool === 'scale' && !d.resizeShape) { const k = dirX && dirY ? Math.max(kx, ky) : dirX ? kx : ky; if (e.shiftKey) { kx = k; ky = k; } }
        if (!dirX) kx = e.shiftKey ? ky : 1; if (!dirY) ky = e.shiftKey ? kx : 1;
        kx = clamp(kx, 0.02, 50); ky = clamp(ky, 0.02, 50);
        for (const it of d.nodes) {
          if (d.resizeShape) { it.n.shape.w = Math.max(2, round(it.w * kx, 1)); it.n.shape.h = Math.max(2, round(it.h * ky, 1)); if (it.n.type === 'text') it.n.fontSize = Math.max(6, round((it.n.fontSize || 18) * ky, 1)); }
          else { it.n.scaleX = round(it.sx * kx, 3); it.n.scaleY = round(it.sy * ky, 3); }
          // keep the anchor corner fixed: move the pivot accordingly
          const nx = ax + (it.wp[0] - ax) * kx, ny = ay + (it.wp[1] - ay) * ky;
          if (d.resizeShape && ['prefab', 'npc', 'mythling'].includes(it.n.type)) continue;
          setWorldPosition(it.n, nx, ny, doc);
        }
        invalidateMatrices(); Scene.invalidate(); Right.syncTransform();
        break;
      }
      case 'pivot': {
        const n = d.node; const parent = n.parent ? doc.nodes[n.parent] : null;
        const [px, py] = e.altKey ? [wx, wy] : Scene.snapPoint(wx, wy);
        const inv = M.invert(worldMatrix(n, doc)); const [lx, ly] = M.apply(inv, px, py);
        const pm = parent ? worldMatrix(parent, doc) : M.identity(); const [nx, ny] = M.apply(M.invert(pm), px, py);
        const o = animOffset(n.id);
        n.pivotX = round(lx, 2); n.pivotY = round(ly, 2); n.x = round(nx - (o ? o.x : 0), 2); n.y = round(ny - (o ? o.y : 0), 2);
        invalidateMatrices(); Scene.invalidate(); Right.syncTransform();
        break;
      }
      case 'vertex': {
        const n = d.node; const inv = M.invert(worldMatrix(n, doc));
        const [px, py] = e.altKey ? [wx, wy] : Scene.snapPoint(wx, wy);
        const [lx, ly] = M.apply(inv, px, py); n.points[d.index] = [round(lx, 1), round(ly, 1)];
        Scene.invalidate(); break;
      }
      case 'colvertex': {
        const n = d.node; const inv = M.invert(worldMatrix(n, doc)); const [lx, ly] = M.apply(inv, wx, wy);
        if (d.rect) { // rect corners: rebuild rect from opposite corner
          const [x, y, w, hh] = n.collision.rect; const corners = [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]]; const opp = corners[(d.index + 2) % 4];
          const nx = Math.min(lx, opp[0]), ny = Math.min(ly, opp[1]); n.collision.rect = [round(nx, 1), round(ny, 1), round(Math.abs(lx - opp[0]), 1), round(Math.abs(ly - opp[1]), 1)];
        } else n.collision.points[d.index] = [round(lx, 1), round(ly, 1)];
        Scene.invalidate(); Right.syncCollision(); break;
      }
      case 'colradius': { const n = d.node; const inv = M.invert(worldMatrix(n, doc)); const [lx, ly] = M.apply(inv, wx, wy); n.collision.radius = Math.max(2, round(Math.hypot(lx, ly), 1)); Scene.invalidate(); Right.syncCollision(); break; }
      case 'draft-rect': { const [x, y] = e.altKey ? [wx, wy] : Scene.snapPoint(wx, wy); d.x1 = x; d.y1 = y; if (e.shiftKey) { const s = Math.max(Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); d.x1 = d.x0 + Math.sign(d.x1 - d.x0 || 1) * s; d.y1 = d.y0 + Math.sign(d.y1 - d.y0 || 1) * s; } Scene.invalidate(); break; }
      case 'pencil': { const last = d.points[d.points.length - 1]; if (dist(last[0], last[1], wx, wy) > 3 / E.view.zoom) d.points.push([wx, wy]); Scene.invalidate(); break; }
      case 'paint': this.paintAt(wx, wy); break;
      case 'paintrect': case 'colrect': d.x1 = wx; d.y1 = wy; Scene.invalidate(); break;
      case 'colpaint': this.collisionAt(wx, wy); break;
    }
  },
  onUp(e) {
    if (E.playtest) { Playtest.onPointer(e); return; }
    const d = E.dragging; if (!d) return;
    E.dragging = null;
    const doc = currentDoc();
    const [sx, sy] = this.local(e); const [wx, wy] = Scene.screenToWorld(sx, sy);
    switch (d.kind) {
      case 'pan': this.updateCursor(); break;
      case 'guide': { if (sx > RULER && sy > RULER && sx < Scene.w && sy < Scene.h) { const S = settings(); History.run('Add guide', () => { (d.axis === 'v' ? S.guides.v : S.guides.h).push(Math.round(d.value)); }); } Scene.invalidate(); break; }
      case 'box': {
        const x0 = Math.min(d.sx, d.x), y0 = Math.min(d.sy, d.y), x1 = Math.max(d.sx, d.x), y1 = Math.max(d.sy, d.y);
        if (x1 - x0 < 3 && y1 - y0 < 3) { Scene.invalidate(); break; }
        const [wx0, wy0] = Scene.screenToWorld(x0, y0), [wx1, wy1] = Scene.screenToWorld(x1, y1);
        const rect = { x: wx0, y: wy0, w: wx1 - wx0, h: wy1 - wy0 };
        const ids = allNodes(doc).filter((n) => n.visible && !n.locked && !hiddenByLayer(n, doc) && (n.type !== 'anchor' || settings().showAnchors) && (n.type !== 'group' || !n.children.length)).filter((n) => { const b = worldBounds(n, doc); return rectContains(rect, b) || (e.altKey && rectsIntersect(rect, b)); }).map((n) => n.id);
        select(d.add ? [...E.selection, ...ids] : ids);
        break;
      }
      case 'move': if (d.moved) { for (const it of d.nodes) { it.n.x = round(it.n.x, 2); it.n.y = round(it.n.y, 2); } History.commit(); if (E.mode === 'animation' && currentAnim() && settings().autoKey) Ops.keyCurrentPose(d.nodes.map((x) => x.n.id)); } else History.cancel(); Right.render(); break;
      case 'rotate': case 'bodyscale': case 'scale': case 'pivot': History.commit(); Right.render(); break;
      case 'vertex': case 'colvertex': case 'colradius': History.commit(); Right.render(); break;
      case 'draft-rect': this.finishDraftRect(d); break;
      case 'pencil': this.finishPencil(d); break;
      case 'paint': case 'colpaint': History.commit(); break;
      case 'paintrect': { const map = currentMap(); const x0 = Math.min(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), x1 = Math.max(d.x0, d.x1), y1 = Math.max(d.y0, d.y1); History.run('Paint rectangle', () => { const cells = []; for (let r = Math.floor(y0 / map.cell); r <= Math.floor(y1 / map.cell); r++) for (let c = Math.floor(x0 / map.cell); c <= Math.floor(x1 / map.cell); c++) cells.push([c, r]); Ops.paintCells(map, cells, d.ti); }); break; }
      case 'colrect': { const map = currentMap(); const x0 = Math.min(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), x1 = Math.max(d.x0, d.x1), y1 = Math.max(d.y0, d.y1); History.run('Collision rectangle', () => { for (let r = Math.max(0, Math.floor(y0 / map.cell)); r <= Math.min(map.rows - 1, Math.floor(y1 / map.cell)); r++) for (let c = Math.max(0, Math.floor(x0 / map.cell)); c <= Math.min(map.cols - 1, Math.floor(x1 / map.cell)); c++) map.collision[r * map.cols + c] = d.val; }); break; }
    }
    Scene.invalidate();
  },
  onWheel(e) {
    e.preventDefault();
    if (E.playtest) return;
    const [sx, sy] = this.local(e);
    if (e.shiftKey) { E.view.x += e.deltaY / E.view.zoom; Scene.invalidate(); return; }
    if (e.altKey) { E.view.y += e.deltaY / E.view.zoom; Scene.invalidate(); return; }
    Scene.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, sx, sy);
  },
  onDblClick(e) {
    if (E.playtest) return;
    if (this.draft) { this.finishDraft(); return; }
    const [sx, sy] = this.local(e); const [wx, wy] = Scene.screenToWorld(sx, sy);
    const hit = hitTest(wx, wy);
    if (hit) { select(hit.id); if (hit.type === 'group' && E.ui.expanded) { E.ui.expanded.add(hit.id); Left.render(); } Right.focusName(); }
  },
  onDrop(e) {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain'); if (!data) return;
    const [sx, sy] = this.local(e); const [wx, wy] = Scene.screenToWorld(sx, sy);
    if (data.startsWith('prefab:')) Ops.addObjectOfType(data.slice(7), wx, wy);
    else if (data.startsWith('object:')) Ops.placeLibraryObject(data.slice(7), wx, wy);
    else if (data.startsWith('asset:')) { const a = E.project.assets[data.slice(6)]; if (a) Ops.addObjectOfType('image', wx, wy, { name: a.name, asset: a.id, shape: { w: a.w, h: a.h } }); }
    else if (data.startsWith('mythling:')) Ops.addObjectOfType('mythling', wx, wy, { name: E.project.mythlings[data.slice(9)]?.name || 'Mythling', mythling: { species: data.slice(9), level: 5 } });
  },
  // ------------------------------------------------------------- drafts (polygon / path / rect / pencil)
  draftAddPoint(wx, wy, tool) {
    const [x, y] = Scene.snapPoint(wx, wy);
    if (!this.draft) { this.draft = { tool, points: [] }; UI.setHint(`${tool === 'polygon' ? 'Polygon' : 'Path'}: click to add points, Enter/double-click to finish, Esc to cancel`); }
    const pts = this.draft.points;
    if (pts.length >= 3 && dist(x, y, pts[0][0], pts[0][1]) < 8 / E.view.zoom) { this.finishDraft(true); return; }
    pts.push([x, y]); Scene.invalidate();
  },
  finishDraft(closeIt = false) {
    const d = this.draft; this.draft = null; UI.setHint('');
    if (!d || d.points.length < 2) { Scene.invalidate(); return; }
    const b = boundsOfPoints(d.points); const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const pts = d.points.map(([x, y]) => [round(x - cx, 1), round(y - cy, 1)]);
    const type = d.tool === 'polygon' ? 'polygon' : 'path';
    const n = makeNode(type, { x: cx, y: cy, name: type === 'polygon' ? 'Polygon' : 'Path', points: pts, closed: type === 'polygon' ? true : closeIt, smooth: type === 'path', fill: type === 'polygon' ? '#6fa8dc' : 'transparent', stroke: '#e2e8f0', strokeWidth: type === 'path' ? 3 : 2 });
    if (isCreatureMode()) n.partType = 'Detail';
    Ops.addNode(n, { parentId: isCreatureMode() && primarySelected() && primarySelected().type !== 'anchor' ? primarySelected().id : null, label: `Add ${n.name}` });
    if (n.parent) { const inv = M.invert(worldMatrix(getNode(n.parent))); const [lx, ly] = M.apply(inv, cx, cy); n.x = lx; n.y = ly; invalidateMatrices(); }
    UI.setTool('select');
  },
  cancelDraft() { this.draft = null; UI.setHint(''); Scene.invalidate(); },
  finishDraftRect(d) {
    const x0 = Math.min(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), hgt = Math.abs(d.y1 - d.y0);
    if (w < 4 || hgt < 4) { if (['warp', 'trigger', 'zone'].includes(d.tool)) Ops.addObjectOfType(d.tool, d.x0, d.y0); return; }
    if (d.tool === 'rectangle' || d.tool === 'ellipse') { const n = Ops.addObjectOfType(d.tool === 'rectangle' ? 'rect' : 'ellipse', x0 + w / 2, y0 + hgt / 2, { shape: { w: round(w, 1), h: round(hgt, 1) }, fill: isCreatureMode() ? (currentMythling()?.palette?.main || '#6fa8dc') : '#6fa8dc' }); if (n && !isCreatureMode()) { n.x = round(x0 + w / 2, 1); n.y = round(y0 + hgt / 2, 1); } }
    else Ops.addObjectOfType(d.tool, x0 + w / 2, y0 + hgt / 2, { shape: { w: round(w, 1), h: round(hgt, 1) } });
    invalidateMatrices(); Scene.invalidate();
    if (!isCreatureMode() && ['rectangle', 'ellipse'].includes(d.tool)) UI.setTool('select');
  },
  finishPencil(d) {
    let pts = d.points; if (pts.length < 2) return;
    // simplify: keep points at least 4px apart, then Douglas-Peucker-lite
    const simp = [pts[0]]; for (const p of pts) if (dist(p[0], p[1], simp[simp.length - 1][0], simp[simp.length - 1][1]) > 4 / E.view.zoom) simp.push(p);
    pts = simp; if (pts.length < 2) return;
    const b = boundsOfPoints(pts); const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const closed = dist(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]) < 12 / E.view.zoom && pts.length > 4;
    const n = makeNode('path', { x: round(cx, 1), y: round(cy, 1), name: 'Stroke', points: pts.map(([x, y]) => [round(x - cx, 1), round(y - cy, 1)]), closed, smooth: true, fill: closed ? '#6fa8dc' : 'transparent', stroke: '#e2e8f0', strokeWidth: 3 });
    if (isCreatureMode()) n.partType = 'Detail';
    Ops.addNode(n, { label: 'Draw stroke' });
  },
  insertVertexNear(wx, wy) {
    const n = primarySelected(); const inv = M.invert(worldMatrix(n)); const [lx, ly] = M.apply(inv, wx, wy);
    const pts = n.points; let best = -1, bd = 10 / E.view.zoom;
    let bp = [lx, ly];
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length; if (j === 0 && !(n.closed || n.type === 'polygon')) continue;
      const dd = distToSegment(lx, ly, pts[i][0], pts[i][1], pts[j][0], pts[j][1]);
      if (dd < bd) { bd = dd; best = i; bp = projectOnSegment(lx, ly, pts[i][0], pts[i][1], pts[j][0], pts[j][1]); }
    }
    if (best < 0) return false;
    History.run('Insert vertex', () => { pts.splice(best + 1, 0, [round(bp[0], 1), round(bp[1], 1)]); }); E.activeVertex = best + 1; Scene.invalidate(); return true;
  },
  removeVertex(i) { const n = primarySelected(); if (!n || !n.points || n.points.length <= (n.type === 'polygon' ? 3 : 2)) { toast('Shape needs more points', 'warn'); return; } History.run('Remove vertex', () => { n.points.splice(i, 1); }); E.activeVertex = null; Scene.invalidate(); Right.render(); },
  // ------------------------------------------------------------- overlays (screen space)
  drawOverlay(ctx) {
    const d = E.dragging, v = E.view;
    if (d && d.kind === 'box') { const x = Math.min(d.sx, d.x), y = Math.min(d.sy, d.y), w = Math.abs(d.x - d.sx), hh = Math.abs(d.y - d.sy); ctx.fillStyle = 'rgba(96,165,250,0.12)'; ctx.fillRect(x, y, w, hh); ctx.strokeStyle = '#60a5fa'; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 0.5, y + 0.5, w, hh); ctx.setLineDash([]); }
    if (d && d.kind === 'draft-rect') { const [x0, y0] = Scene.worldToScreen(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1)); const w = Math.abs(d.x1 - d.x0) * v.zoom, hh = Math.abs(d.y1 - d.y0) * v.zoom; ctx.strokeStyle = '#f2c761'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); if (d.tool === 'ellipse') { ctx.beginPath(); ctx.ellipse(x0 + w / 2, y0 + hh / 2, w / 2, hh / 2, 0, 0, Math.PI * 2); ctx.stroke(); } else ctx.strokeRect(x0, y0, w, hh); ctx.setLineDash([]); ctx.fillStyle = '#f2c761'; ctx.font = '11px monospace'; ctx.fillText(`${Math.round(Math.abs(d.x1 - d.x0))} × ${Math.round(Math.abs(d.y1 - d.y0))}`, x0 + w + 6, y0 + hh + 12); }
    if (d && d.kind === 'pencil') { ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.beginPath(); d.points.forEach((p, i) => { const [sx, sy] = Scene.worldToScreen(p[0], p[1]); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.stroke(); }
    if (d && (d.kind === 'paintrect' || d.kind === 'colrect')) { const [x0, y0] = Scene.worldToScreen(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1)); const w = Math.abs(d.x1 - d.x0) * v.zoom, hh = Math.abs(d.y1 - d.y0) * v.zoom; ctx.fillStyle = d.kind === 'colrect' ? rgba(COLLISION_MODES.find((m) => m.value === d.val).color, 0.3) : rgba(TERRAINS[d.ti]?.color || '#fff', 0.4); ctx.fillRect(x0, y0, w, hh); ctx.strokeStyle = '#fff'; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, hh); }
    if (this.draft) { const pts = this.draft.points; ctx.strokeStyle = '#f2c761'; ctx.lineWidth = 1.5; ctx.beginPath(); pts.forEach((p, i) => { const [sx, sy] = Scene.worldToScreen(p[0], p[1]); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.lineTo(E.cursor.sx, E.cursor.sy); ctx.stroke(); for (const p of pts) { const [sx, sy] = Scene.worldToScreen(p[0], p[1]); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 7); ctx.fill(); } if (pts.length) { const [sx, sy] = Scene.worldToScreen(pts[0][0], pts[0][1]); ctx.strokeStyle = '#22c55e'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 7); ctx.stroke(); } }
    // brush preview
    if ((E.tool === 'paint' || (E.tool === 'collision' && !isCreatureMode())) && !E.playtest && currentMap() && E.cursor.sx > 0) {
      const map = currentMap(); const cells = Ops.brushCells(map, E.cursor.x, E.cursor.y, E.subTool === 'fill' || E.subTool === 'replace' || E.subTool === 'pick' ? 1 : E.brushSize);
      const col = E.tool === 'paint' ? (TERRAINS[TERRAIN_INDEX[E.terrain]]?.color || '#fff') : COLLISION_MODES.find((m) => m.value === E.collisionMode).color;
      ctx.fillStyle = rgba(col, 0.35); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      for (const [c, r] of cells) { const [sx, sy] = Scene.worldToScreen(c * map.cell, r * map.cell); ctx.fillRect(sx, sy, map.cell * v.zoom, map.cell * v.zoom); }
      const c0 = cells[0], c1 = cells[cells.length - 1]; const [sx, sy] = Scene.worldToScreen(c0[0] * map.cell, c0[1] * map.cell); const [ex, ey] = Scene.worldToScreen((c1[0] + 1) * map.cell, (c1[1] + 1) * map.cell); ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx, ey - sy);
    }
    if (E.tool === 'anchor' && isCreatureMode()) { ctx.strokeStyle = '#f2c761'; ctx.beginPath(); ctx.arc(E.cursor.sx, E.cursor.sy, 6, 0, 7); ctx.stroke(); }
  },
  // ------------------------------------------------------------- context menu
  closeContext() { if (this.ctxMenu) { this.ctxMenu.remove(); this.ctxMenu = null; } },
  showContextMenu(cx, cy, items) {
    this.closeContext();
    const menu = h('div', { class: 'context-menu' });
    const build = (list, root) => {
      for (const it of list) {
        if (it === 'sep' || it.sep) { root.appendChild(h('div', { class: 'sep' })); continue; }
        const el = h('div', { class: `mi ${it.disabled ? 'disabled' : ''} ${it.sub ? 'has-sub' : ''}`, html: `<span>${escapeHtml(it.label)}</span>${it.shortcut ? `<span class="sc">${it.shortcut}</span>` : ''}${it.sub ? '<span class="sc">▸</span>' : ''}` });
        if (it.sub) { const sub = h('div', { class: 'context-menu sub' }); build(it.sub, sub); el.appendChild(sub); }
        else if (!it.disabled) el.addEventListener('click', (e) => { e.stopPropagation(); this.closeContext(); it.fn && it.fn(); });
        root.appendChild(el);
      }
    };
    build(items, menu);
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(cx, window.innerWidth - r.width - 8)}px`; menu.style.top = `${Math.min(cy, window.innerHeight - r.height - 8)}px`;
    this.ctxMenu = menu;
  },
  onContext(e) {
    if (E.playtest) return;
    const [sx, sy] = this.local(e); const [wx, wy] = Scene.screenToWorld(sx, sy);
    if (this.draft) { this.finishDraft(); return; }
    const hit = hitTest(wx, wy, { includeLocked: true });
    if (hit && !E.selection.includes(hit.id)) select(hit.id);
    this.showContextMenu(e.clientX, e.clientY, this.contextItems(hit, wx, wy));
  },
  contextItems(hit, wx, wy) {
    const doc = currentDoc(); const creature = isCreatureMode();
    const addTypes = creature ? [['Rectangle part', 'rect'], ['Ellipse part', 'ellipse'], ['Polygon part', 'polygon'], ['Path part', 'path'], ['Group', 'group'], ['Anchor', 'anchor'], ['Image', 'image'], ['Text', 'text']] : [['Rectangle', 'rect'], ['Ellipse', 'ellipse'], ['Polygon', 'polygon'], ['Path', 'path'], ['Group', 'group'], ['Text', 'text'], ['Image', 'image'], ['NPC', 'npc'], ['Mythling', 'mythling'], 'sep', ['Tree', 'tree'], ['Rock', 'rock'], ['Bush', 'bush'], ['Flower', 'flower'], ['Crystal', 'crystal'], ['Box', 'box'], ['Building', 'building'], ['Sign', 'sign'], ['Bridge', 'bridge'], ['Waterfall', 'waterfall'], ['Chest', 'chest'], ['Save Point', 'savepoint'], 'sep', ['Warp', 'warp'], ['Spawn Zone', 'zone'], ['Trigger', 'trigger'], ['Spawn Point', 'spawn']];
    const addMenu = (fn) => addTypes.map((t) => (t === 'sep' ? 'sep' : { label: t[0], fn: () => fn(t[1]) }));
    if (!hit) {
      return [
        { label: 'Add Object Here', sub: addMenu((t) => Ops.addObjectOfType(t, wx, wy)) },
        { label: 'Paste Here', shortcut: 'Ctrl+V', disabled: !E.clipboard, fn: () => Ops.paste([wx, wy]) },
        'sep',
        ...(creature ? [{ label: 'Add Anchor Here', fn: () => Ops.addObjectOfType('anchor', wx, wy) }, { label: 'Key Pose of All Parts', shortcut: 'Shift+K', fn: () => Ops.keyCurrentPose(allNodes().filter((n) => n.type !== 'anchor').map((n) => n.id)) }] : [{ label: 'Set Player Spawn Here', fn: () => { const map = currentMap(); History.run('Set spawn', () => { map.spawn = { x: Math.round(wx), y: Math.round(wy) }; const sp = allNodes(map).find((n) => n.type === 'spawn' && n.spawn.kind === 'player'); if (sp) { sp.x = Math.round(wx); sp.y = Math.round(wy); } }); } }, { label: 'Paint Terrain Here', fn: () => UI.setTool('paint') }, { label: 'Edit Collision Here', fn: () => UI.setTool('collision') }]),
        'sep',
        { label: 'Select All', shortcut: 'Ctrl+A', fn: () => UI.selectAll() },
        { label: 'Zoom to Fit', shortcut: 'F', fn: () => Scene.fit() },
        { label: 'Add Guides at Cursor', fn: () => { const S = settings(); History.run('Add guides', () => { S.guides.v.push(Math.round(wx)); S.guides.h.push(Math.round(wy)); }); } },
      ];
    }
    const n = hit; const many = E.selection.length > 1;
    const items = [
      { label: many ? `Select (${E.selection.length} objects)` : `Select "${n.name}"`, fn: () => select(n.id) },
      { label: 'Edit Properties', shortcut: 'Enter', fn: () => { select(n.id); UI.showRightTab('properties'); } },
      'sep',
      { label: 'Duplicate', shortcut: 'Ctrl+D', fn: () => Ops.duplicate() },
      { label: 'Rename…', shortcut: 'F2', fn: () => UI.renameSelected() },
      { label: 'Delete', shortcut: 'Del', fn: () => Ops.deleteNodes() },
      'sep',
      { label: n.locked ? 'Unlock' : 'Lock', shortcut: 'L', fn: () => Ops.toggleLock() },
      { label: n.visible ? 'Hide' : 'Show', shortcut: 'H', fn: () => Ops.toggleVisible() },
      { label: 'Create Parent (Group)', shortcut: 'Ctrl+G', fn: () => Ops.groupSelection() },
      ...(n.type === 'group' ? [{ label: 'Ungroup', shortcut: 'Ctrl+Shift+G', fn: () => Ops.ungroup(n.id) }] : []),
      { label: 'Add Child', sub: addMenu((t) => Ops.addChild(n.id, t)) },
      { label: 'Arrange', sub: [{ label: 'Bring to Front', shortcut: 'Ctrl+]', fn: () => Ops.bringToFront() }, { label: 'Bring Forward', shortcut: ']', fn: () => Ops.reorder(n.id, 1) }, { label: 'Send Backward', shortcut: '[', fn: () => Ops.reorder(n.id, -1) }, { label: 'Send to Back', shortcut: 'Ctrl+[', fn: () => Ops.sendToBack() }] },
      'sep',
      { label: 'Copy', shortcut: 'Ctrl+C', fn: () => Ops.copy() },
      { label: 'Cut', shortcut: 'Ctrl+X', fn: () => Ops.cut() },
      { label: 'Paste', shortcut: 'Ctrl+V', disabled: !E.clipboard, fn: () => Ops.paste() },
      { label: 'Save to Library…', fn: () => Ops.saveToLibrary() },
      'sep',
      { label: 'Collision', sub: [
        { label: n.collision.enabled ? 'Disable Collision' : 'Enable Collision', fn: () => Ops.setProp(n.id, 'collision', Object.assign({}, n.collision, { enabled: !n.collision.enabled }), 'Toggle collision') },
        { label: 'Fit Collision to Bounds', fn: () => Right.fitCollision(n) },
        { label: 'Edit Collision Shape', fn: () => { UI.setTool('collision'); UI.showRightTab('collision'); } },
        { label: 'Shape: Rectangle', fn: () => Ops.setProp(n.id, 'collision', Object.assign({}, n.collision, { type: 'rect', enabled: true }), 'Collision shape') },
        { label: 'Shape: Circle', fn: () => Ops.setProp(n.id, 'collision', Object.assign({}, n.collision, { type: 'circle', enabled: true }), 'Collision shape') },
        { label: 'Shape: Polygon', fn: () => Ops.setProp(n.id, 'collision', Object.assign({}, n.collision, { type: 'polygon', enabled: true }), 'Collision shape') },
      ] },
    ];
    if (creature) items.push({ label: 'Mythling', sub: [
      { label: 'Key Pose (selected parts)', shortcut: 'K', fn: () => Ops.keyCurrentPose(E.selection) },
      { label: 'Add Anchor at Pivot', fn: () => { const [x, y] = worldPos(n); Ops.addObjectOfType('anchor', x, y); } },
      { label: 'Center Pivot', fn: () => Right.centerPivot(n) },
      { label: 'Mirror Part (flip X)', fn: () => Ops.setProp(n.id, 'scaleX', -n.scaleX, 'Mirror') },
      { label: 'Part Type', sub: CREATURE_PART_TYPES.map((pt) => ({ label: pt, fn: () => Ops.setProp(n.id, 'partType', pt, 'Part type') })) },
      { label: 'Reset Transform', fn: () => Right.resetTransform(n) },
    ] });
    else if (n.type === 'npc') items.push({ label: 'NPC', sub: [{ label: 'Edit Dialogue…', fn: () => Screens.editDialogue(n) }, { label: 'Edit Team…', fn: () => Screens.editTeam(n) }] });
    else if (n.type === 'warp') items.push({ label: 'Go to Destination Map', disabled: !E.project.maps[n.warp.toMap], fn: () => UI.openMap(n.warp.toMap) });
    return items;
  },
  // ------------------------------------------------------------- keyboard
  onKeyUp(e) { if (e.code === 'Space') { this.spaceHeld = false; this.updateCursor(); } },
  onKey(e) {
    const t = e.target; const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === 'Escape') {
      if (this.ctxMenu) { this.closeContext(); return; }
      if (typing) { t.blur(); return; }
      if (E.playtest) { Playtest.stop(); return; }
      if (this.draft) { this.cancelDraft(); return; }
      if (E.dragging) { E.dragging = null; History.cancel(); Scene.invalidate(); return; }
      if (E.mode !== 'map' && !isCreatureMode()) { UI.setMode(E.lastEditMode || 'map'); return; }
      if (E.selection.length) { select([]); return; }
      return;
    }
    if (typing) return;
    if (E.playtest) { Playtest.onKey(e, true); return; }
    if (!E.project) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.code === 'Space' && !e.repeat) { this.spaceHeld = true; this.updateCursor(); e.preventDefault(); return; }
    if (ctrl) {
      const map = { z: () => (e.shiftKey ? History.redo() : History.undo()), y: () => History.redo(), d: () => Ops.duplicate(), s: () => App.save(e.shiftKey), c: () => (E.selectedKey && E.ui.bottomTab === 'timeline' && Bottom.visible() ? Ops.copyKeyframes(currentAnim(), E.selectedKey.trackId) : Ops.copy()), v: () => (E.keyClipboard && E.ui.bottomTab === 'timeline' && Bottom.visible() && E.selection.length && isCreatureMode() && E.mode === 'animation' ? Ops.pasteKeyframes(currentAnim(), E.selection[0]) : Ops.paste()), x: () => Ops.cut(), a: () => UI.selectAll(), g: () => (e.shiftKey ? (primarySelected() && Ops.ungroup(primarySelected().id)) : Ops.groupSelection()), e: () => UI.setMode('export'), n: () => App.newProject(), o: () => App.openFile(), ']': () => Ops.bringToFront(), '[': () => Ops.sendToBack(), '=': () => Scene.zoomBy(1.25), '+': () => Scene.zoomBy(1.25), '-': () => Scene.zoomBy(0.8), '0': () => Scene.setZoom(1), b: () => UI.toggleBottom(), '/': () => Screens.shortcuts() };
      if (map[k]) { e.preventDefault(); map[k](); }
      return;
    }
    const shift = e.shiftKey;
    switch (k) {
      case 'v': UI.setTool('select'); break;
      case 'w': UI.setTool('move'); break;
      case 'e': UI.setTool('rotate'); break;
      case 'r': UI.setTool('scale'); break;
      case 'a': if (isCreatureMode()) UI.setTool('anchor'); break;
      case 'p': UI.setTool('pivot'); break;
      case 'c': UI.setTool('collision'); break;
      case 'm': if (!isCreatureMode()) UI.setTool('paint'); break;
      case 'b': UI.setTool('draw'); break;
      case 'u': UI.setTool('rectangle'); break;
      case 'o': UI.setTool('ellipse'); break;
      case 'y': UI.setTool('polygon'); break;
      case 'n': UI.setTool('path'); break;
      case 'x': UI.setTool('eraser'); break;
      case 't': if (!isCreatureMode()) UI.setTool('warp'); break;
      case 'i': if (!isCreatureMode()) UI.setTool('trigger'); break;
      case 'z': if (!isCreatureMode()) UI.setTool('zone'); break;
      case 's': if (!isCreatureMode()) UI.setTool('spawn'); break;
      case 'g': UI.toggleSetting('showGrid'); break;
      case 'f': if (shift) Scene.fitSelection(); else if (E.selection.length) Scene.fitSelection(); else Scene.fit(); break;
      case 'h': if (E.selection.length) Ops.toggleVisible(); break;
      case 'l': if (E.selection.length) Ops.toggleLock(); break;
      case 'k': if (isCreatureMode()) Ops.keyCurrentPose(shift ? allNodes().filter((n) => n.type !== 'anchor').map((n) => n.id) : E.selection); break;
      case 'q': E.compare = !E.compare; Scene.invalidate(); toast(`Before/After compare ${E.compare ? 'ON' : 'OFF'}`); break;
      case 'delete': case 'backspace':
        e.preventDefault();
        if (E.selectedKey && Bottom.visible() && E.ui.bottomTab === 'timeline') { Ops.deleteKeyframe(currentAnim(), E.selectedKey.trackId, E.selectedKey.index); break; }
        if (E.activeVertex != null && E.selection.length === 1 && primarySelected().points) { this.removeVertex(E.activeVertex); break; }
        Ops.deleteNodes(); break;
      case 'enter': if (this.draft) this.finishDraft(); else if (E.selection.length) { UI.showRightTab('properties'); Right.focusName(); } break;
      case 'f2': if (E.selection.length) UI.renameSelected(); break;
      case 'f5': e.preventDefault(); Playtest.start(isCreatureMode() ? 'creature' : 'map'); break;
      case ' ': break;
      case 'arrowleft': case 'arrowright': case 'arrowup': case 'arrowdown': {
        e.preventDefault();
        if (E.mode === 'animation' && !E.selection.length && (k === 'arrowleft' || k === 'arrowright')) { Bottom.step(k === 'arrowleft' ? -1 : 1); break; }
        const step = (shift ? 10 : 1) * (settings().snap && !shift ? 1 : 1);
        const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0, dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
        const nodes = selectedNodes().filter((n) => !n.locked); if (!nodes.length) break;
        History.run('~Nudge', () => { for (const n of nodes) { const [wx, wy] = worldPos(n); setWorldPosition(n, wx + dx, wy + dy); n.x = round(n.x, 2); n.y = round(n.y, 2); } });
        Right.syncTransform(); break;
      }
      case '[': if (E.tool === 'paint' || E.tool === 'collision') { E.brushSize = Math.max(1, [1, 2, 4, 8, 16].filter((b) => b < E.brushSize).pop() || 1); Left.render(); Scene.invalidate(); } else if (primarySelected()) Ops.reorder(primarySelected().id, -1); break;
      case ']': if (E.tool === 'paint' || E.tool === 'collision') { E.brushSize = [1, 2, 4, 8, 16].find((b) => b > E.brushSize) || 16; Left.render(); Scene.invalidate(); } else if (primarySelected()) Ops.reorder(primarySelected().id, 1); break;
      case '+': case '=': Scene.zoomBy(1.25); break;
      case '-': Scene.zoomBy(0.8); break;
      case '0': Scene.setZoom(1); break;
      case 'home': E.playhead = 0; invalidateMatrices(); Bottom.syncTransport(); Scene.invalidate(); break;
      case 'end': if (currentAnim()) { E.playhead = currentAnim().duration; invalidateMatrices(); Bottom.syncTransport(); Scene.invalidate(); } break;
      case ',': Bottom.step(-1); break;
      case '.': Bottom.step(1); break;
      case 'tab': e.preventDefault(); UI.cycleSelection(shift ? -1 : 1); break;
      default:
        if (/^[1-9]$/.test(k)) {
          if (E.tool === 'paint') { const t = TERRAINS[+k]; if (t) { E.terrain = t.id; Left.render(); Scene.invalidate(); } }
          else if (E.tool === 'collision') { const m = COLLISION_MODES[+k - 1]; if (m) { E.collisionMode = m.value; Left.render(); Scene.invalidate(); } }
          else if (isCreatureMode()) { const my = currentMythling(); const aid = my && my.animations[+k - 1]; if (aid) { UI.setAnimation(aid); E.playing = true; Bottom.syncTransport(); Scene.invalidate(); } }
        }
        return;
    }
    if (k !== 'tab') e.preventDefault();
  },
};
