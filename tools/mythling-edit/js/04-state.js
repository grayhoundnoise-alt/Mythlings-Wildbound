// =============================================================================
// Editor state, scene-graph access, undo/redo history
// =============================================================================
const E = {
  project: null,
  mode: 'map',            // map | creature | browser | evolution | animation | vfx | skills | playtest | export
  mapId: null, mythlingId: null, animId: null, vfxId: null, skillId: null,
  tool: 'select', subTool: 'paint', terrain: 'grass', brushSize: 2, collisionMode: 1, spawnKind: 'mythling',
  selection: [],           // node ids in the current document
  selectedKey: null,       // { trackId, index } selected keyframe
  view: { x: 0, y: 0, zoom: 1 },
  cursor: { x: 0, y: 0, sx: 0, sy: 0 },
  dirty: false,
  clipboard: null, keyClipboard: null,
  playhead: 0, playing: false, speed: 1, loopPlayback: true,
  guides: { h: [], v: [] },
  hover: null,
  dragging: null,
  compare: false,
  time: 0,
  lastSaveAt: null, lastEditAt: 0, recent: [],
  playtest: null,
  ui: {
    leftTab: 'project', rightTab: 'properties', bottomTab: 'timeline', bottomShown: false, libraryCat: 'Nature', assetCat: 'all',
    collapsed: { left: false, right: false, bottom: false }, expanded: new Set(), treeFilter: '', activeLayer: null, layersOpen: true,
    lockRatio: false, emitterIdx: 0, browserFilter: '', evoStage: 0, skillFilter: 'all', vfxCat: 'All',
  },
};
const settings = () => E.project.settings;

// ---------------------------------------------------------------- documents
/** The active scene document: a map (world) or a Mythling rig. Both expose nodes + root. */
function currentDoc() {
  if (!E.project) return null;
  if (['creature', 'animation', 'vfx', 'skills', 'evolution', 'browser'].includes(E.mode)) {
    const m = E.project.mythlings[E.mythlingId];
    return m ? m.rig : null;
  }
  const map = E.project.maps[E.mapId];
  return map || null;
}
const isCreatureMode = () => ['creature', 'animation', 'vfx', 'skills', 'evolution', 'browser'].includes(E.mode);
const currentMap = () => (E.project && E.project.maps[E.mapId]) || null;
const currentMythling = () => (E.project && E.project.mythlings[E.mythlingId]) || null;
const currentAnim = () => (E.project && E.project.animations[E.animId]) || null;
const currentVfx = () => (E.project && E.project.vfx[E.vfxId]) || null;
const getNode = (id) => { const d = currentDoc(); return d ? d.nodes[id] : null; };
function allNodes(doc = currentDoc()) { return doc ? Object.values(doc.nodes) : []; }
function nodeChildren(n, doc = currentDoc()) { return (n.children || []).map((id) => doc.nodes[id]).filter(Boolean).sort((a, b) => a.z - b.z); }
function rootNodes(doc = currentDoc()) { return doc ? doc.root.map((id) => doc.nodes[id]).filter(Boolean).sort((a, b) => a.z - b.z) : []; }
function isAncestor(ancestorId, id, doc = currentDoc()) {
  let n = doc.nodes[id];
  while (n && n.parent) { if (n.parent === ancestorId) return true; n = doc.nodes[n.parent]; }
  return false;
}
function nodeDepth(n, doc = currentDoc()) { let d = 0; while (n && n.parent) { d++; n = doc.nodes[n.parent]; } return d; }
/** Depth-first order used for drawing and hit-testing (children with z<0 before their parent's own shape). */
function drawOrder(doc = currentDoc()) {
  const out = [];
  const visit = (n) => {
    const kids = nodeChildren(n, doc);
    for (const k of kids) if (k.z < 0) visit(k);
    out.push(n);
    for (const k of kids) if (k.z >= 0) visit(k);
  };
  for (const r of rootNodes(doc)) visit(r);
  return out;
}

// ---------------------------------------------------------------- transforms
/** Animated offsets for a node at the current playhead (creature modes only). */
function animOffset(nodeId) {
  if (!isCreatureMode()) return null;
  const a = currentAnim();
  if (!a || !a.tracks[nodeId]) return null;
  return sampleTrack(a.tracks[nodeId], E.playhead, a);
}
function sampleTrack(keys, t, anim) {
  if (!keys || !keys.length) return null;
  const dur = anim ? anim.duration : keys[keys.length - 1].t;
  if (anim && anim.loop && dur > 0) t = ((t % dur) + dur) % dur;
  let a = keys[0], b = keys[0];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].t <= t) a = keys[i];
    if (keys[i].t >= t) { b = keys[i]; break; }
    b = keys[i];
  }
  if (a === b || b.t <= a.t) return { ...a };
  const k = (EASINGS[b.ease || 'easeInOut'] || EASINGS.linear)(clamp((t - a.t) / (b.t - a.t), 0, 1));
  return {
    x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), rotation: lerp(a.rotation, b.rotation, k),
    scaleX: lerp(a.scaleX, b.scaleX, k), scaleY: lerp(a.scaleY, b.scaleY, k), opacity: lerp(a.opacity, b.opacity, k),
  };
}
/** offsetFn(nodeId) → animated offsets or null. Default = the editor playhead. */
function localMatrix(n, offsetFn = animOffset) {
  const o = offsetFn ? offsetFn(n.id) : null;
  const x = n.x + (o ? o.x : 0), y = n.y + (o ? o.y : 0), rot = n.rotation + (o ? o.rotation : 0);
  const sx = n.scaleX * (o ? o.scaleX : 1), sy = n.scaleY * (o ? o.scaleY : 1);
  return M.compose(x, y, rot, sx, sy, n.pivotX, n.pivotY);
}
const _wmCache = new Map(); let _wmStamp = 0;
function invalidateMatrices() { _wmCache.clear(); _wmStamp++; }
function worldMatrix(n, doc = currentDoc(), offsetFn = animOffset) {
  const cacheable = offsetFn === animOffset && doc === currentDoc();
  if (cacheable) { const c = _wmCache.get(n.id); if (c) return c; }
  const lm = localMatrix(n, offsetFn);
  const wm = n.parent && doc.nodes[n.parent] ? M.mul(worldMatrix(doc.nodes[n.parent], doc, offsetFn), lm) : lm;
  if (cacheable) _wmCache.set(n.id, wm);
  return wm;
}
const NO_ANIM = () => null;
function worldPos(n, doc = currentDoc()) { const m = worldMatrix(n, doc); return M.apply(m, n.pivotX, n.pivotY); }
function worldBounds(n, doc = currentDoc()) {
  const b = localBounds(n), m = worldMatrix(n, doc);
  const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => M.apply(m, x, y));
  return boundsOfPoints(pts);
}
function subtreeBounds(n, doc = currentDoc()) {
  let b = n.type === 'group' && n.children.length ? null : worldBounds(n, doc);
  const visit = (k) => {
    for (const c of nodeChildren(k, doc)) {
      if (!c.visible) continue;
      const cb = c.type === 'anchor' ? null : worldBounds(c, doc);
      if (cb) b = b ? unionRect(b, cb) : cb;
      visit(c);
    }
  };
  visit(n);
  return b || worldBounds(n, doc);
}
function unionRect(a, b) { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; }
function selectionBounds() {
  let b = null;
  for (const id of E.selection) { const n = getNode(id); if (!n) continue; const nb = subtreeBounds(n); b = b ? unionRect(b, nb) : nb; }
  return b;
}
/** Set a node's world position while keeping its parent (used by drags and the pivot tool). */
function setWorldPosition(n, wx, wy, doc = currentDoc()) {
  const parent = n.parent ? doc.nodes[n.parent] : null;
  const pm = parent ? worldMatrix(parent, doc) : M.identity();
  const [lx, ly] = M.apply(M.invert(pm), wx, wy);
  const o = animOffset(n.id);
  n.x = lx - (o ? o.x : 0); n.y = ly - (o ? o.y : 0);
}
/** Large area markers (encounter zones / triggers) only win when nothing else is under the cursor, so they never swallow clicks on props. */
const AREA_TYPES = ['zone', 'trigger'];
const isAreaNode = (n) => AREA_TYPES.includes(n.type) || !!(n.behavior && (n.behavior.region || n.behavior.water));
function hitTest(wx, wy, { includeLocked = false, includeAnchors = true, doc = currentDoc() } = {}) {
  if (!doc) return null;
  const order = drawOrder(doc);
  let areaHit = null;
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i];
    if (!n.visible || (!includeLocked && (n.locked || layerLocked(n, doc)))) continue;
    if (n.type === 'anchor' && (!includeAnchors || !settings().showAnchors)) continue;
    if (hiddenByLayer(n, doc)) continue;
    let hidden = false; let p = n; while (p && p.parent) { p = doc.nodes[p.parent]; if (p && !p.visible) { hidden = true; break; } }
    if (hidden) continue;
    const inv = M.invert(worldMatrix(n, doc));
    const [lx, ly] = M.apply(inv, wx, wy);
    const tol = 4 / E.view.zoom;
    if (!hitLocal(n, lx, ly, tol)) continue;
    if (isAreaNode(n)) { if (!areaHit) areaHit = n; continue; } // props inside an area (or on water / a region) always win
    return n;
  }
  return areaHit;
}
function hiddenByLayer(n, doc) {
  if (!doc.layers) return false;
  const l = doc.layers.find((x) => x.id === n.layer);
  return l ? !l.visible : false;
}
function layerLocked(n, doc) { if (!doc.layers) return false; const l = doc.layers.find((x) => x.id === n.layer); return l ? l.locked : false; }

// ---------------------------------------------------------------- selection
function select(ids, { add = false } = {}) {
  const list = [].concat(ids).filter(Boolean);
  if (add) { for (const id of list) { if (E.selection.includes(id)) E.selection = E.selection.filter((x) => x !== id); else E.selection.push(id); } }
  else E.selection = [...new Set(list)];
  E.selectedKey = null;
  UI.onSelectionChanged();
}
const selectedNodes = () => E.selection.map(getNode).filter(Boolean);
const primarySelected = () => (E.selection.length ? getNode(E.selection[E.selection.length - 1]) : null);
function clearSelection() { select([]); }

// ---------------------------------------------------------------- history (transaction snapshots)
const History = {
  undoStack: [], redoStack: [], pending: null, max: 60, lastLabel: '', lastAt: 0,
  begin(label) {
    if (this.pending) return;
    this.pending = { label, before: docSnapshot(E.project), at: performance.now() };
  },
  cancel() { this.pending = null; },
  commit(label) {
    if (!this.pending) return;
    const after = docSnapshot(E.project);
    const p = this.pending; this.pending = null;
    if (after === p.before) return;
    const lbl = label || p.label;
    const now = performance.now();
    // coalesce rapid identical edits (typing in a number field, slider drags)
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && top.label === lbl && lbl.startsWith('~') && now - this.lastAt < 900) { top.after = after; }
    else {
      // share the string object with the previous entry when the content is identical (keeps large projects' undo memory ~halved)
      const before = top && top.after === p.before ? top.after : p.before;
      this.undoStack.push({ label: lbl, before, after });
      const limit = after.length > 1.5e6 ? Math.max(20, Math.round(this.max / 2)) : this.max; // big (game-preset) projects: shorter history
      while (this.undoStack.length > limit) this.undoStack.shift();
    }
    this.lastAt = now; this.lastLabel = lbl;
    this.redoStack.length = 0;
    markDirty();
  },
  /** Run a mutation as one undoable step. */
  run(label, fn) { this.begin(label); try { fn(); } finally { this.commit(label); } },
  undo() {
    if (this.pending) this.commit();
    const e = this.undoStack.pop(); if (!e) { toast('Nothing to undo'); return; }
    applyDocSnapshot(E.project, e.before); this.redoStack.push(e);
    afterHistoryJump(); toast(`Undo: ${e.label.replace(/^~/, '')}`);
  },
  redo() {
    const e = this.redoStack.pop(); if (!e) { toast('Nothing to redo'); return; }
    applyDocSnapshot(E.project, e.after); this.undoStack.push(e);
    afterHistoryJump(); toast(`Redo: ${e.label.replace(/^~/, '')}`);
  },
  clear() { this.undoStack.length = 0; this.redoStack.length = 0; this.pending = null; },
};
function afterHistoryJump() {
  const doc = currentDoc();
  if (!E.project.maps[E.mapId]) E.mapId = Object.keys(E.project.maps)[0] || null;
  if (!E.project.mythlings[E.mythlingId]) E.mythlingId = Object.keys(E.project.mythlings)[0] || null;
  if (E.animId && !E.project.animations[E.animId]) E.animId = null;
  if (E.vfxId && !E.project.vfx[E.vfxId]) E.vfxId = null;
  E.selection = E.selection.filter((id) => doc && doc.nodes[id]);
  invalidateMatrices(); markDirty(); UI.refreshAll();
}
function markDirty() {
  E.dirty = true; E.lastEditAt = Date.now();
  if (E.project) E.project.project.changeCount = (E.project.project.changeCount || 0) + 1;
  invalidateMatrices();
  UI.updateStatus();
  Scene.invalidate();
}
