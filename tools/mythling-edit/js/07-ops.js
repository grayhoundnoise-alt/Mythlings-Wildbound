// =============================================================================
// Document operations (all undoable through History)
// =============================================================================
const Ops = {
  // ------------------------------------------------------------- nodes
  addNode(node, { parentId = null, selectIt = true, label = 'Add object', doc = currentDoc() } = {}) {
    if (!doc) return null;
    History.run(label, () => {
      const names = allNodes(doc).map((n) => n.name);
      if (names.includes(node.name)) node.name = nextName(node.name.replace(/_\d+$/, ''), names);
      doc.nodes[node.id] = node;
      node.parent = parentId || null;
      if (parentId && doc.nodes[parentId]) doc.nodes[parentId].children.push(node.id); else doc.root.push(node.id);
      if (E.ui.expanded && parentId) E.ui.expanded.add(parentId);
    });
    if (selectIt) select(node.id);
    Left.render();
    return node;
  },
  addObjectOfType(type, wx, wy, extra = {}) {
    const doc = currentDoc(); if (!doc) return null;
    const [x, y] = Scene.snapPoint(wx, wy);
    const creature = isCreatureMode();
    let node;
    if (PREFABS[type]) node = makePrefabNode(type, x, y, extra);
    else if (type === 'mythling') node = makeNode('mythling', Object.assign({ x, y, name: 'Mythling' }, extra));
    else if (type === 'npc') node = makeNode('npc', Object.assign({ x, y, name: 'NPC' }, extra));
    else if (type === 'anchor') node = makeNode('anchor', Object.assign({ x, y, name: nextName('Anchor', allNodes(doc).map((n) => n.name)) }, extra));
    else if (type === 'group') node = makeNode('group', Object.assign({ x, y, name: 'Group' }, extra));
    else if (type === 'text') node = makeNode('text', Object.assign({ x, y, name: 'Text', text: 'Label' }, extra));
    else if (type === 'image') node = makeNode('image', Object.assign({ x, y, name: 'Image', shape: { w: 96, h: 96 } }, extra));
    else if (type === 'zone') node = makeNode('zone', Object.assign({ x, y, name: 'Spawn_Zone', shape: { w: 320, h: 224 } }, extra));
    else if (type === 'warp') node = makeNode('warp', Object.assign({ x, y, name: 'Warp', shape: { w: 64, h: 96 } }, extra));
    else if (type === 'trigger') node = makeNode('trigger', Object.assign({ x, y, name: 'Trigger', shape: { w: 96, h: 96 } }, extra));
    else if (type === 'spawn') node = makeNode('spawn', Object.assign({ x, y, name: `${titleCase(extra.spawn?.kind || 'player')}_Spawn` }, extra));
    else if (type === 'polygon') node = makeNode('polygon', Object.assign({ x, y, name: 'Polygon', points: [[-30, 20], [0, -30], [30, 20]] }, extra));
    else if (type === 'path') node = makeNode('path', Object.assign({ x, y, name: 'Path', points: [[-40, 0], [0, -20], [40, 0]], closed: false }, extra));
    else node = makeNode(type, Object.assign({ x, y, name: titleCase(type), shape: { w: 64, h: 64 } }, extra));
    if (creature) { node.layer = 'objects'; if (!node.partType && node.type !== 'anchor' && node.type !== 'group') node.partType = 'Detail'; if (node.type === 'group') node.partType = 'Group'; }
    const sel = primarySelected();
    const parentId = creature && sel && sel.type !== 'anchor' ? sel.id : (sel && sel.type === 'group' ? sel.id : null);
    if (parentId && creature) { // place relative to the parent
      const inv = M.invert(worldMatrix(doc.nodes[parentId], doc)); const [lx, ly] = M.apply(inv, x, y); node.x = lx; node.y = ly;
    }
    return this.addNode(node, { parentId, label: `Add ${node.name}` });
  },
  deleteNodes(ids = E.selection) {
    const doc = currentDoc(); if (!doc || !ids.length) return;
    const list = ids.filter((id) => doc.nodes[id] && !doc.nodes[id].locked);
    if (!list.length) { toast('Selected objects are locked', 'warn'); return; }
    History.run(`Delete ${list.length} object${list.length > 1 ? 's' : ''}`, () => {
      const removeTree = (id) => { const n = doc.nodes[id]; if (!n) return; for (const c of [...n.children]) removeTree(c); delete doc.nodes[id]; this._dropAnimTracks(id); };
      for (const id of list) {
        const n = doc.nodes[id]; if (!n) continue;
        if (n.parent && doc.nodes[n.parent]) doc.nodes[n.parent].children = doc.nodes[n.parent].children.filter((c) => c !== id);
        doc.root = doc.root.filter((c) => c !== id);
        removeTree(id);
      }
    });
    select([]);
    Left.render();
  },
  _dropAnimTracks(nodeId) {
    const my = currentMythling(); if (!my || !isCreatureMode()) return;
    for (const aid of my.animations) { const a = E.project.animations[aid]; if (a && a.tracks[nodeId]) delete a.tracks[nodeId]; }
    if (my.parts) for (const [role, id] of Object.entries(my.parts)) if (id === nodeId) delete my.parts[role];
  },
  cloneSubtree(doc, id, parentId, idMap = {}) {
    const src = doc.nodes[id];
    const copy = deepClone(src);
    copy.id = uid('n'); idMap[id] = copy.id;
    copy.parent = parentId; copy.children = [];
    doc.nodes[copy.id] = copy;
    for (const c of src.children) { const cc = this.cloneSubtree(doc, c, copy.id, idMap); copy.children.push(cc.id); }
    return copy;
  },
  duplicate(ids = E.selection, offset = 24) {
    const doc = currentDoc(); if (!doc || !ids.length) return;
    const tops = ids.filter((id) => !ids.some((o) => o !== id && isAncestor(o, id, doc)));
    const created = [];
    History.run('Duplicate', () => {
      const names = allNodes(doc).map((n) => n.name);
      for (const id of tops) {
        const src = doc.nodes[id];
        const idMap = {};
        const c = this.cloneSubtree(doc, id, src.parent, idMap);
        c.name = nextName(src.name.replace(/_\d+$/, ''), names); names.push(c.name);
        c.x += offset; c.y += offset;
        if (src.parent && doc.nodes[src.parent]) { const arr = doc.nodes[src.parent].children; arr.splice(arr.indexOf(id) + 1, 0, c.id); } else doc.root.splice(doc.root.indexOf(id) + 1, 0, c.id);
        // duplicate animation tracks for creature parts
        const my = currentMythling();
        if (my && isCreatureMode()) for (const aid of my.animations) { const a = E.project.animations[aid]; if (!a) continue; for (const [from, to] of Object.entries(idMap)) if (a.tracks[from]) a.tracks[to] = deepClone(a.tracks[from]); }
        created.push(c.id);
      }
    });
    select(created);
    Left.render();
  },
  copy(ids = E.selection) {
    const doc = currentDoc(); if (!doc || !ids.length) return;
    const tops = ids.filter((id) => !ids.some((o) => o !== id && isAncestor(o, id, doc)));
    const pack = (id) => { const n = deepClone(doc.nodes[id]); n.children = n.children.map(pack); return n; };
    E.clipboard = { kind: 'nodes', creature: isCreatureMode(), items: tops.map(pack), at: Date.now() };
    toast(`Copied ${tops.length} object${tops.length > 1 ? 's' : ''}`, 'ok');
  },
  cut(ids = E.selection) { this.copy(ids); this.deleteNodes(ids); },
  paste(atWorld = null) {
    const doc = currentDoc(); if (!doc) return;
    if (!E.clipboard || E.clipboard.kind !== 'nodes') { toast('Clipboard is empty'); return; }
    const created = [];
    History.run('Paste', () => {
      const names = allNodes(doc).map((n) => n.name);
      const sel = primarySelected();
      const parentId = isCreatureMode() && sel && sel.type !== 'anchor' ? sel.id : (sel && sel.type === 'group' ? sel.id : null);
      const unpack = (item, pid) => {
        const kids = item.children; const n = deepClone(item); n.id = uid('n'); n.parent = pid; n.children = [];
        n.name = nextName(n.name.replace(/_\d+$/, ''), names); names.push(n.name);
        doc.nodes[n.id] = n;
        for (const k of kids) n.children.push(unpack(k, n.id).id);
        return n;
      };
      for (const item of E.clipboard.items) {
        const n = unpack(item, parentId);
        if (parentId) doc.nodes[parentId].children.push(n.id); else doc.root.push(n.id);
        if (atWorld) { setWorldPosition(n, atWorld[0], atWorld[1], doc); } else { n.x += 24; n.y += 24; }
        created.push(n.id);
      }
    });
    select(created); Left.render();
  },
  rename(id, name) { const n = getNode(id); if (!n || !name) return; History.run('Rename', () => { n.name = name; }); Left.render(); Right.render(); },
  setProp(id, key, value, label = '~Edit property') { const n = getNode(id); if (!n) return; History.run(label, () => { n[key] = value; }); },
  toggleVisible(ids = E.selection) { History.run('Toggle visibility', () => { for (const n of ids.map(getNode).filter(Boolean)) n.visible = !n.visible; }); Left.render(); Right.render(); },
  toggleLock(ids = E.selection) { History.run('Toggle lock', () => { for (const n of ids.map(getNode).filter(Boolean)) n.locked = !n.locked; }); Left.render(); Right.render(); },
  /** Reparent while preserving the world transform. index = position in new parent's children (-1 = end). */
  reparent(id, newParentId, index = -1, { keepWorld = true } = {}) {
    const doc = currentDoc(); const n = doc.nodes[id]; if (!n) return false;
    if (newParentId === id || (newParentId && isAncestor(id, newParentId, doc))) { toast('Cannot parent an object to its own child', 'warn'); return false; }
    History.run('Reparent', () => {
      const wm = worldMatrix(n, doc);
      if (n.parent && doc.nodes[n.parent]) doc.nodes[n.parent].children = doc.nodes[n.parent].children.filter((c) => c !== id); else doc.root = doc.root.filter((c) => c !== id);
      n.parent = newParentId || null;
      const arr = newParentId ? doc.nodes[newParentId].children : doc.root;
      if (index < 0 || index > arr.length) arr.push(id); else arr.splice(index, 0, id);
      invalidateMatrices();
      if (keepWorld) {
        const pm = newParentId ? worldMatrix(doc.nodes[newParentId], doc) : M.identity();
        const local = M.mul(M.invert(pm), wm);
        // decompose: rotation, scale, and position of the pivot
        const o = animOffset(id);
        n.rotation = M.rotationOf(local) - (o ? o.rotation : 0);
        const [sx, sy] = M.scaleOf(local);
        const det = local[0] * local[3] - local[1] * local[2];
        n.scaleX = sx / (o ? o.scaleX : 1); n.scaleY = (det < 0 ? -sy : sy) / (o ? o.scaleY : 1);
        const [px, py] = M.apply(local, n.pivotX, n.pivotY);
        n.x = px - (o ? o.x : 0); n.y = py - (o ? o.y : 0);
      }
      if (E.ui.expanded && newParentId) E.ui.expanded.add(newParentId);
    });
    Left.render(); Right.render();
    return true;
  },
  reorder(id, dir) { // dir -1 = backward (lower z / earlier), +1 = forward
    const doc = currentDoc(); const n = doc.nodes[id]; if (!n) return;
    History.run('Reorder', () => {
      const arr = n.parent ? doc.nodes[n.parent].children : doc.root;
      const i = arr.indexOf(id); const j = clamp(i + dir, 0, arr.length - 1);
      if (i !== j) { arr.splice(i, 1); arr.splice(j, 0, id); }
      // keep explicit z consistent with order among siblings
      const sibs = arr.map((x) => doc.nodes[x]);
      if (sibs.some((s) => s.z !== 0)) { const zs = sibs.map((s) => s.z).sort((a, b) => a - b); sibs.forEach((s, k) => { s.z = zs[k]; }); }
    });
    Left.render();
  },
  bringToFront(ids = E.selection) { const doc = currentDoc(); History.run('Bring to front', () => { for (const id of ids) { const n = doc.nodes[id]; const arr = n.parent ? doc.nodes[n.parent].children : doc.root; arr.splice(arr.indexOf(id), 1); arr.push(id); const mz = Math.max(0, ...arr.map((x) => doc.nodes[x].z)); if (n.z < mz) n.z = mz; } }); Left.render(); },
  sendToBack(ids = E.selection) { const doc = currentDoc(); History.run('Send to back', () => { for (const id of ids) { const n = doc.nodes[id]; const arr = n.parent ? doc.nodes[n.parent].children : doc.root; arr.splice(arr.indexOf(id), 1); arr.unshift(id); const mz = Math.min(0, ...arr.map((x) => doc.nodes[x].z)); if (n.z > mz) n.z = mz; } }); Left.render(); },
  /** Wrap the selection in a new group positioned at the selection's centre. */
  groupSelection(ids = E.selection) {
    const doc = currentDoc(); if (!doc || !ids.length) return;
    const tops = ids.filter((id) => !ids.some((o) => o !== id && isAncestor(o, id, doc)));
    const first = doc.nodes[tops[0]];
    const b = selectionBounds();
    let g;
    History.run('Create parent group', () => {
      const parentId = first.parent;
      g = makeNode('group', { name: nextName('Group', allNodes(doc).map((n) => n.name)), layer: first.layer });
      if (isCreatureMode()) g.partType = 'Group';
      doc.nodes[g.id] = g; g.parent = parentId;
      const arr = parentId ? doc.nodes[parentId].children : doc.root;
      arr.splice(arr.indexOf(tops[0]), 0, g.id);
      const pm = parentId ? worldMatrix(doc.nodes[parentId], doc) : M.identity();
      const [gx, gy] = M.apply(M.invert(pm), b.x + b.w / 2, isCreatureMode() ? b.y + b.h : b.y + b.h / 2);
      g.x = gx; g.y = gy;
      invalidateMatrices();
    });
    for (const id of tops) this.reparent(id, g.id, -1);
    select(g.id);
  },
  ungroup(id) {
    const doc = currentDoc(); const g = doc.nodes[id]; if (!g || g.type !== 'group') return;
    const kids = [...g.children];
    const arr = g.parent ? doc.nodes[g.parent].children : doc.root; const at = arr.indexOf(id);
    kids.forEach((k, i) => this.reparent(k, g.parent, at + i));
    History.run('Ungroup', () => { const a2 = g.parent ? doc.nodes[g.parent].children : doc.root; a2.splice(a2.indexOf(id), 1); delete doc.nodes[id]; });
    select(kids); Left.render();
  },
  addChild(parentId, type = 'rect') { const p = getNode(parentId); if (!p) return; const [wx, wy] = worldPos(p); const n = this.addObjectOfType(type, wx + 20, wy - 20); if (n && n.parent !== parentId) this.reparent(n.id, parentId); },
  /** Save the selection as a reusable library object (custom prefab). */
  async saveToLibrary(ids = E.selection) {
    const doc = currentDoc(); if (!doc || !ids.length) return;
    const tops = ids.filter((id) => !ids.some((o) => o !== id && isAncestor(o, id, doc)));
    const name = await promptDialog('Save to Library', 'Object name', tops.length === 1 ? doc.nodes[tops[0]].name : 'Custom Object');
    if (!name) return;
    const b = selectionBounds();
    const ox = b.x + b.w / 2, oy = b.y + b.h; // ground point origin
    const nodes = {}; const root = [];
    const pack = (id, pid) => { const src = doc.nodes[id]; const n = deepClone(src); n.id = uid('n'); n.parent = pid; n.children = []; nodes[n.id] = n; for (const c of src.children) n.children.push(pack(c, n.id).id); return n; };
    for (const id of tops) {
      const n = pack(id, null); root.push(n.id);
      const wm = worldMatrix(doc.nodes[id], doc); const [px, py] = M.apply(wm, doc.nodes[id].pivotX, doc.nodes[id].pivotY);
      n.x = px - ox; n.y = py - oy; n.rotation = M.rotationOf(wm); const [sx, sy] = M.scaleOf(wm); n.scaleX = sx; n.scaleY = sy;
    }
    const obj = { id: uid('obj'), name, category: 'Custom', nodes, root, w: Math.round(b.w), h: Math.round(b.h), created: nowIso(), behavior: { shadow: true, wind: 'none', interactable: false } };
    History.run('Save to library', () => { E.project.objects[obj.id] = obj; });
    E.ui.libraryCat = 'Custom'; E.ui.leftTab = 'library'; Left.render();
    toast(`Saved "${name}" to the object library`, 'ok');
  },
  /** Instantiate a custom library object at a world position. */
  placeLibraryObject(objId, wx, wy) {
    const obj = E.project.objects[objId]; if (!obj) return;
    const doc = currentDoc();
    const [x, y] = Scene.snapPoint(wx, wy);
    let g;
    History.run(`Place ${obj.name}`, () => {
      g = makeNode('group', { name: nextName(obj.name.replace(/\s+/g, ''), allNodes(doc).map((n) => n.name)), x, y, layer: 'objects' });
      g.libraryId = objId; g.behavior = Object.assign(g.behavior, deepClone(obj.behavior || {}));
      doc.nodes[g.id] = g; doc.root.push(g.id);
      const idMap = {};
      const unpack = (id, pid) => { const src = obj.nodes[id]; const n = deepClone(src); n.id = uid('n'); idMap[id] = n.id; n.parent = pid; n.children = []; doc.nodes[n.id] = n; for (const c of src.children) n.children.push(unpack(c, n.id).id); return n; };
      for (const r of obj.root) g.children.push(unpack(r, g.id).id);
    });
    select(g.id); Left.render();
    return g;
  },
  // ------------------------------------------------------------- maps
  createMap(props) {
    const map = newMap(props);
    History.run('New map', () => { E.project.maps[map.id] = map; });
    mapAddNode(map, makeNode('spawn', { name: 'Player_Spawn', x: Math.round(map.width / 2), y: Math.round(map.height / 2), spawn: { kind: 'player', direction: 'down', enabled: true } }));
    UI.openMap(map.id);
    return map;
  },
  duplicateMap(id) { const src = E.project.maps[id]; if (!src) return; const m = deepClone(src); m.id = uid('map'); m.name = `${src.name} Copy`; History.run('Duplicate map', () => { E.project.maps[m.id] = m; }); UI.openMap(m.id); },
  async deleteMap(id) {
    const m = E.project.maps[id]; if (!m) return;
    if (Object.keys(E.project.maps).length <= 1) { toast('A project needs at least one map', 'warn'); return; }
    if (!(await confirmDialog('Delete Map', `Delete "${m.name}"? This cannot be undone after saving.`, 'DELETE', 'CANCEL', true))) return;
    History.run('Delete map', () => { delete E.project.maps[id]; });
    if (E.mapId === id) UI.openMap(Object.keys(E.project.maps)[0]);
    Left.render();
  },
  resizeMap(map, width, height) {
    History.run('Resize map', () => { resizeMapGrid(map, width, height); map.camera = { minX: 0, minY: 0, maxX: map.width, maxY: map.height }; });
    Scene.fit(); Right.render();
  },
  // terrain painting
  paintCells(map, cells, terrainIdx, { collisionToo = true } = {}) {
    let changed = false;
    for (const [c, r] of cells) {
      if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) continue;
      const i = r * map.cols + c;
      if (map.terrain[i] !== terrainIdx) { map.terrain[i] = terrainIdx; changed = true; }
      if (collisionToo) { const tid = TERRAINS[terrainIdx]?.id; if (tid === 'water') map.collision[i] = 2; else if (tid === 'cliff' || tid === 'lava') map.collision[i] = 1; else if (map.collision[i] === 2 || (map.collision[i] === 1 && (tid === 'grass' || tid === 'path' || tid === 'dirt' || tid === 'sand'))) map.collision[i] = 0; }
    }
    return changed;
  },
  brushCells(map, wx, wy, size) {
    const cc = Math.floor(wx / map.cell), rr = Math.floor(wy / map.cell);
    const half = Math.floor(size / 2), out = [];
    for (let r = rr - half; r < rr - half + size; r++) for (let c = cc - half; c < cc - half + size; c++) out.push([c, r]);
    return out;
  },
  floodFill(map, wx, wy, terrainIdx, grid = map.terrain) {
    const c0 = Math.floor(wx / map.cell), r0 = Math.floor(wy / map.cell);
    if (c0 < 0 || r0 < 0 || c0 >= map.cols || r0 >= map.rows) return [];
    const from = grid[r0 * map.cols + c0]; if (from === terrainIdx) return [];
    const stack = [[c0, r0]], seen = new Set(), out = [];
    while (stack.length) {
      const [c, r] = stack.pop(); const i = r * map.cols + c;
      if (c < 0 || r < 0 || c >= map.cols || r >= map.rows || seen.has(i) || grid[i] !== from) continue;
      seen.add(i); out.push([c, r]);
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
      if (out.length > 200000) break;
    }
    return out;
  },
  replaceTerrain(map, fromIdx, toIdx) { const out = []; for (let i = 0; i < map.terrain.length; i++) if (map.terrain[i] === fromIdx) out.push([i % map.cols, Math.floor(i / map.cols)]); return out; },
  // ------------------------------------------------------------- mythlings
  createMythling({ id, name, template = 'spriggo', element, rarity = 'C', breed, description }) {
    const base = SPECIES_TEMPLATES[template] || SPECIES_TEMPLATES.spriggo;
    const t = Object.assign({}, base, { name, element: element || base.element, rarity, breed: breed || base.breed, description: description || `${name} — a new Mythling.` });
    const key = slug(id || name) || uid('myth');
    if (E.project.mythlings[key]) { toast(`A Mythling with id "${key}" already exists`, 'warn'); return null; }
    const m = createMythlingFromTemplate(key, t);
    m.stats = deepClone(base.stats);
    History.run('New Mythling', () => { E.project.mythlings[key] = m; attachDefaultAnimations(E.project, m); });
    UI.openMythling(key, 'creature');
    ConsoleLog.ok(`Created Mythling ${m.name} (${key}) from template ${template}`);
    return m;
  },
  duplicateMythling(id) {
    const src = E.project.mythlings[id]; if (!src) return;
    const key = nextName(id.replace(/_\d+$/, ''), Object.keys(E.project.mythlings)).toLowerCase();
    const m = deepClone(src); m.id = key; m.name = `${src.name} Copy`; m.animations = [];
    History.run('Duplicate Mythling', () => {
      E.project.mythlings[key] = m;
      for (const aid of src.animations) { const a = E.project.animations[aid]; if (!a) continue; const c = deepClone(a); c.id = uid('anim'); c.mythlingId = key; E.project.animations[c.id] = c; m.animations.push(c.id); }
    });
    UI.openMythling(key, 'creature');
  },
  async deleteMythling(id) {
    const m = E.project.mythlings[id]; if (!m) return;
    if (!(await confirmDialog('Delete Mythling', `Delete "${m.name}" and its animations?`, 'DELETE', 'CANCEL', true))) return;
    History.run('Delete Mythling', () => { for (const aid of m.animations) delete E.project.animations[aid]; delete E.project.mythlings[id]; });
    const next = Object.keys(E.project.mythlings)[0];
    if (next) UI.openMythling(next, E.mode === 'map' ? 'creature' : E.mode); else UI.setMode('map');
  },
  rebuildRig(my, bodyType) {
    History.run('Rebuild rig', () => {
      const rig = buildRig(bodyType, my.palette);
      my.rig = { nodes: rig.nodes, root: rig.root }; my.parts = rig.parts; my.bodyType = bodyType;
      for (const aid of my.animations) delete E.project.animations[aid];
      my.animations = []; attachDefaultAnimations(E.project, my);
    });
    E.selection = []; E.animId = my.animations[0] || null;
    UI.refreshAll();
  },
  isGameRig(my) { return !!(my && my.rig && Object.values(my.rig.nodes).some((n) => n.type === 'gamepart')); },
  /** Game-rigged Mythlings: rebuild the parts from the game art of a species/stage (positions reset, animations re-sampled). */
  rebuildGameRig(my, species = my.game?.species, stage = my.game?.stage || 0) {
    if (typeof Game === 'undefined' || !Game.ok || !Game.species(species)) return false;
    History.run('Rebuild rig from game art', () => {
      const rig = Game.buildRig(species, stage, my.id);
      my.rig = { nodes: rig.nodes, root: rig.root }; my.parts = rig.parts; my.game = Object.assign({}, my.game || {}, { species, stage }); my.bodyType = Game.species(species).art.body;
      for (const aid of my.animations) delete E.project.animations[aid];
      my.animations = [];
      for (const a of Game.sampleAnimations(my)) { E.project.animations[a.id] = a; my.animations.push(a.id); }
    });
    E.selection = []; E.animId = my.animations[0] || null;
    invalidateMatrices(); UI.refreshAll();
    return true;
  },
  applyPalette(my) { if (this.isGameRig(my)) { invalidateMatrices(); Scene.invalidate(); return; } History.run('~Palette', () => { const rig = buildRig(my.bodyType, my.palette); const byRole = Object.fromEntries(Object.entries(rig.parts).map(([role, id]) => [role, rig.nodes[id]])); for (const [role, id] of Object.entries(my.parts || {})) { const n = my.rig.nodes[id], src = byRole[role]; if (n && src) { n.fill = src.fill; n.stroke = src.stroke; } } }); },
  // ------------------------------------------------------------- animations
  createAnimation(my, { name = 'New Animation', duration = 1, loop = true, fps = 60, easing = 'easeInOut' } = {}) {
    const a = { id: uid('anim'), name, mythlingId: my.id, duration, loop, fps, easing, tracks: {} };
    History.run('New animation', () => { E.project.animations[a.id] = a; my.animations.push(a.id); });
    E.animId = a.id; E.playhead = 0; UI.refreshAll();
    return a;
  },
  duplicateAnimation(id) { const a = E.project.animations[id]; if (!a) return; const my = E.project.mythlings[a.mythlingId]; const c = deepClone(a); c.id = uid('anim'); c.name = `${a.name} Copy`; History.run('Duplicate animation', () => { E.project.animations[c.id] = c; if (my) my.animations.push(c.id); }); E.animId = c.id; UI.refreshAll(); },
  async deleteAnimation(id) {
    const a = E.project.animations[id]; if (!a) return;
    if (!(await confirmDialog('Delete Animation', `Delete "${a.name}"?`, 'DELETE', 'CANCEL', true))) return;
    History.run('Delete animation', () => { delete E.project.animations[id]; for (const m of Object.values(E.project.mythlings)) m.animations = m.animations.filter((x) => x !== id); });
    const my = currentMythling(); E.animId = my ? my.animations[0] || null : null; UI.refreshAll();
  },
  /** Insert/replace a keyframe on nodeId at time t (values = full kf without t). */
  setKeyframe(anim, nodeId, t, values, label = 'Add keyframe') {
    History.run(label, () => {
      const tr = anim.tracks[nodeId] || (anim.tracks[nodeId] = []);
      t = round(clamp(t, 0, anim.duration), 3);
      const ex = tr.find((k) => Math.abs(k.t - t) < 0.0005);
      if (ex) Object.assign(ex, values, { t }); else { tr.push(Object.assign({ t, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ease: anim.easing || 'easeInOut' }, values)); tr.sort((a, b) => a.t - b.t); }
    });
    Bottom.render();
  },
  /** Key the current (animated) pose of a node: offsets currently displayed become the key values. */
  keyCurrentPose(nodeIds, t = E.playhead) {
    const a = currentAnim(); if (!a) { toast('Select or create an animation first', 'warn'); return; }
    for (const id of nodeIds) { const o = animOffset(id) || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }; this.setKeyframe(a, id, t, { x: o.x, y: o.y, rotation: o.rotation, scaleX: o.scaleX, scaleY: o.scaleY, opacity: o.opacity }); }
    toast(`Keyframe at ${fmtTime(t)}`, 'ok');
  },
  deleteKeyframe(anim, nodeId, index) { History.run('Delete keyframe', () => { const tr = anim.tracks[nodeId]; if (!tr) return; tr.splice(index, 1); if (!tr.length) delete anim.tracks[nodeId]; }); E.selectedKey = null; Bottom.render(); },
  moveKeyframe(anim, nodeId, index, t) { const tr = anim.tracks[nodeId]; if (!tr || !tr[index]) return index; tr[index].t = round(clamp(t, 0, anim.duration), 3); const k = tr[index]; tr.sort((a, b) => a.t - b.t); return tr.indexOf(k); },
  copyKeyframes(anim, nodeId) { const tr = anim.tracks[nodeId]; if (!tr) return; E.keyClipboard = { keys: deepClone(E.selectedKey ? [tr[E.selectedKey.index]] : tr), from: E.playhead }; toast(`Copied ${E.keyClipboard.keys.length} keyframe(s)`, 'ok'); },
  pasteKeyframes(anim, nodeId, t = E.playhead) { if (!E.keyClipboard) { toast('No keyframes copied'); return; } const base = E.keyClipboard.keys[0].t; History.run('Paste keyframes', () => { const tr = anim.tracks[nodeId] || (anim.tracks[nodeId] = []); for (const k of E.keyClipboard.keys) { const nk = deepClone(k); nk.t = round(clamp(t + (k.t - base), 0, anim.duration), 3); const ex = tr.find((x) => Math.abs(x.t - nk.t) < 0.0005); if (ex) Object.assign(ex, nk); else tr.push(nk); } tr.sort((a, b) => a.t - b.t); }); Bottom.render(); },
  // ------------------------------------------------------------- vfx / skills
  createVfx({ name = 'New VFX', category = 'Universal', duration = 1 } = {}) {
    const v = { id: slug(name) && !E.project.vfx[slug(name)] ? slug(name) : uid('vfx'), name, category, duration, emitters: [emitter('burst', { name: 'Burst', attach: 'AttackOrigin', color: '#ffffff', color2: '#94a3b8', duration: 0.4, size: 40 })] };
    History.run('New VFX', () => { E.project.vfx[v.id] = v; });
    E.vfxId = v.id; UI.refreshAll(); return v;
  },
  duplicateVfx(id) { const s = E.project.vfx[id]; if (!s) return; const c = deepClone(s); c.id = uid('vfx'); c.name = `${s.name} Copy`; c.emitters.forEach((e) => { e.id = uid('em'); }); History.run('Duplicate VFX', () => { E.project.vfx[c.id] = c; }); E.vfxId = c.id; UI.refreshAll(); },
  async deleteVfx(id) { const v = E.project.vfx[id]; if (!v) return; if (!(await confirmDialog('Delete VFX', `Delete "${v.name}"?`, 'DELETE', 'CANCEL', true))) return; History.run('Delete VFX', () => { delete E.project.vfx[id]; for (const m of Object.values(E.project.mythlings)) m.vfx = (m.vfx || []).filter((x) => x !== id); }); E.vfxId = Object.keys(E.project.vfx)[0] || null; UI.refreshAll(); },
  createSkill(props = {}) { const id = slug(props.name || 'new_skill') || uid('skill'); const s = Object.assign({ id: E.project.skills[id] ? uid('skill') : id, name: 'New Skill', element: 'nature', type: 'attack', power: 40, uses: 15, animation: 'Normal Attack', vfx: '', sound: 'hit_soft', shake: 0.3 }, props); History.run('New skill', () => { E.project.skills[s.id] = s; }); E.skillId = s.id; UI.refreshAll(); return s; },
  async deleteSkill(id) { const s = E.project.skills[id]; if (!s) return; if (!(await confirmDialog('Delete Skill', `Delete "${s.name}"?`, 'DELETE', 'CANCEL', true))) return; History.run('Delete skill', () => { delete E.project.skills[id]; }); E.skillId = Object.keys(E.project.skills)[0] || null; UI.refreshAll(); },
  // ------------------------------------------------------------- assets
  async importImages(files) {
    let n = 0;
    for (const f of files) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { toast(`Skipped ${f.name}: not PNG/JPG/WEBP`, 'warn'); continue; }
      if (f.size > 6 * 1024 * 1024) { toast(`Skipped ${f.name}: larger than 6 MB`, 'warn'); continue; }
      const dataUrl = await readAsDataURL(f);
      let w = 0, hgt = 0; try { const im = await loadImage(dataUrl); w = im.naturalWidth; hgt = im.naturalHeight; } catch { toast(`Could not decode ${f.name}`, 'err'); continue; }
      const a = { id: uid('asset'), name: f.name.replace(/\.[^.]+$/, ''), type: f.type, size: f.size, w, h: hgt, category: 'general', dataUrl, created: nowIso() };
      History.run('Import image', () => { E.project.assets[a.id] = a; });
      n++;
    }
    if (n) { toast(`Imported ${n} image${n > 1 ? 's' : ''}`, 'ok'); ConsoleLog.ok(`Imported ${n} image asset(s)`); }
    Left.render();
  },
  async deleteAsset(id) {
    const a = E.project.assets[id]; if (!a) return;
    const users = []; for (const m of Object.values(E.project.maps)) for (const n of Object.values(m.nodes)) if (n.asset === id) users.push(`${m.name}/${n.name}`);
    for (const my of Object.values(E.project.mythlings)) for (const n of Object.values(my.rig.nodes)) if (n.asset === id) users.push(`${my.name}/${n.name}`);
    if (!(await confirmDialog('Delete Asset', `Delete "${a.name}"?${users.length ? ` It is used by ${users.length} object(s): ${escapeHtml(users.slice(0, 5).join(', '))}${users.length > 5 ? '…' : ''}. They will show a Missing Asset placeholder.` : ''}`, 'DELETE', 'CANCEL', true))) return;
    History.run('Delete asset', () => { delete E.project.assets[id]; }); AssetCache.drop(id); Left.render();
  },
  async replaceAsset(id) {
    const f = await pickFile('image/png,image/jpeg,image/webp'); if (!f) return;
    const dataUrl = await readAsDataURL(f);
    try { const im = await loadImage(dataUrl); History.run('Replace asset', () => { Object.assign(E.project.assets[id], { dataUrl, type: f.type, size: f.size, w: im.naturalWidth, h: im.naturalHeight }); }); AssetCache.drop(id); Left.render(); toast('Asset replaced', 'ok'); }
    catch { toast('Could not decode that image', 'err'); }
  },
};
