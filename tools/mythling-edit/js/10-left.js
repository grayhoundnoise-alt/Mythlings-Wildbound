// =============================================================================
// Left panel: PROJECT / HIERARCHY (CREATURE PARTS) / ASSETS / LIBRARY + tool tabs
// =============================================================================
const Left = {
  dragId: null,
  tabs() {
    const creature = isCreatureMode();
    const tabs = [['project', 'PROJECT'], [creature ? 'parts' : 'hierarchy', creature ? 'PARTS' : 'HIERARCHY'], ['assets', 'ASSETS'], ['library', 'LIBRARY']];
    if (!creature && E.tool === 'paint') tabs.push(['terrain', 'TERRAIN']);
    if (!creature && E.tool === 'collision') tabs.push(['collision', 'COLLISION']);
    if (!creature && E.tool === 'spawn') tabs.push(['spawn', 'SPAWN']);
    if (E.mode === 'animation') tabs.push(['anims', 'ANIMATIONS']);
    if (E.mode === 'vfx') tabs.push(['vfx', 'VFX']);
    return tabs;
  },
  render() {
    if (!E.project) return;
    const tabs = this.tabs();
    if (!tabs.some((t) => t[0] === E.ui.leftTab)) E.ui.leftTab = tabs[1][0];
    const tb = clear($('#left-tabs'));
    for (const [id, label] of tabs) tb.appendChild(h('button', { class: `tab ${E.ui.leftTab === id ? 'active' : ''}`, text: label, onclick: () => { E.ui.leftTab = id; this.render(); } }));
    const body = clear($('#left-body'));
    const fn = { project: this.renderProject, hierarchy: this.renderHierarchy, parts: this.renderHierarchy, assets: this.renderAssets, library: this.renderLibrary, terrain: this.renderTerrain, collision: this.renderCollision, spawn: this.renderSpawn, anims: this.renderAnims, vfx: this.renderVfx }[E.ui.leftTab];
    if (fn) fn.call(this, body);
  },
  syncSelection() {
    if (!['hierarchy', 'parts'].includes(E.ui.leftTab)) return;
    $$('#left-body .tree-item').forEach((el) => el.classList.toggle('selected', E.selection.includes(el.dataset.id)));
    const prim = primarySelected(); if (prim) { const el = $(`#left-body .tree-item[data-id="${prim.id}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); else { for (let p = prim.parent; p; p = getNode(p)?.parent) E.ui.expanded.add(p); this.render(); } }
  },
  section(title, children, actions = []) { return h('div', { class: 'section' }, [h('div', { class: 'panel-head' }, [h('span', { text: title }), h('span', { class: 'actions' }, actions)]), ...[].concat(children)]); },
  // ------------------------------------------------------------- PROJECT
  renderProject(body) {
    const p = E.project, ph = p.project;
    body.appendChild(this.section('PROJECT', [
      kvRow('Name', ph.name), kvRow('ID', ph.id), kvRow('Version', `v${ph.version}`), kvRow('Editor', `MYTHLING EDIT ${ph.editorVersion || EDITOR_VERSION}`), kvRow('Last saved', ph.lastSaved ? new Date(ph.lastSaved).toLocaleString() : 'never'), kvRow('Changes', String(ph.changeCount || 0)), kvRow('Snapshots', String(p.snapshots.length)),
      h('div', { class: 'row', style: { display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' } }, [
        h('button', { class: 'btn small primary', text: 'SAVE', onclick: () => App.save() }),
        h('button', { class: 'btn small', text: 'SNAPSHOT', onclick: () => App.saveSnapshot() }),
        h('button', { class: 'btn small', text: 'SETTINGS', onclick: () => Screens.projectSettings() }),
        h('button', { class: 'btn small', text: 'EXPORT', onclick: () => UI.setMode('export') }),
      ]),
    ]));
    const listBlock = (title, items, onNew, render) => this.section(title, items.length ? items.map(render) : h('div', { class: 'empty', text: 'Nothing here yet' }), onNew ? [h('button', { class: 'btn tiny', text: '+ NEW', onclick: onNew })] : []);
    body.appendChild(listBlock('MAPS', Object.values(p.maps), () => Screens.newMap(), (m) => h('div', { class: `list-item ${E.mapId === m.id && E.mode === 'map' ? 'active' : ''}`, onclick: () => UI.openMap(m.id) }, [icon('map', 'ticon'), h('div', { class: 'grow' }, [h('div', { class: 'title', text: m.name }), h('div', { class: 'sub', text: `${m.width}×${m.height} · ${m.theme} · Lv.${m.levelMin}-${m.levelMax} · ${Object.keys(m.nodes).length} objects` })])])));
    body.appendChild(listBlock('MYTHLINGS', Object.values(p.mythlings), () => Screens.newMythling(), (m) => { const it = h('div', { class: `list-item ${E.mythlingId === m.id && isCreatureMode() ? 'active' : ''}`, draggable: 'true', onclick: () => UI.openMythling(m.id, isCreatureMode() && E.mode !== 'browser' ? E.mode : 'creature') }, [creatureThumb(m, 40), h('div', { class: 'grow' }, [h('div', { class: 'title', text: m.name }), h('div', { class: 'sub', text: `${m.element} · ${m.rarity} · ${m.animations.length} anims · ${(m.vfx || []).length} vfx` })])]); it.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', `mythling:${m.id}`)); return it; }));
    body.appendChild(listBlock('ANIMATIONS', Object.values(p.animations).slice(0, 60), () => Screens.newAnimation(), (a) => h('div', { class: `list-item ${E.animId === a.id ? 'active' : ''}`, onclick: () => { if (p.mythlings[a.mythlingId]) { E.mythlingId = a.mythlingId; UI.setMode('animation'); UI.setAnimation(a.id); } } }, [icon('film', 'ticon'), h('div', { class: 'grow' }, [h('div', { class: 'title', text: a.name }), h('div', { class: 'sub', text: `${p.mythlings[a.mythlingId]?.name || '?'} · ${a.duration}s · ${Object.keys(a.tracks).length} tracks` })])])));
    body.appendChild(listBlock('VFX', Object.values(p.vfx), () => Screens.newVfx(), (v) => h('div', { class: `list-item ${E.vfxId === v.id && E.mode === 'vfx' ? 'active' : ''}`, onclick: () => { E.vfxId = v.id; UI.setMode('vfx'); } }, [icon('vfx', 'ticon'), h('div', { class: 'grow' }, [h('div', { class: 'title', text: v.name }), h('div', { class: 'sub', text: `${v.category} · ${v.emitters.length} emitters · ${v.duration}s` })])])));
    body.appendChild(listBlock('SKILLS', Object.values(p.skills), () => Ops.createSkill(), (s) => h('div', { class: `list-item ${E.skillId === s.id && E.mode === 'skills' ? 'active' : ''}`, onclick: () => { E.skillId = s.id; UI.setMode('skills'); } }, [icon('star', 'ticon'), h('div', { class: 'grow' }, [h('div', { class: 'title', text: s.name }), h('div', { class: 'sub', text: `${s.element} · ${s.type} · pow ${s.power}` })])])));
    body.appendChild(listBlock('OBJECT LIBRARY (CUSTOM)', Object.values(p.objects), null, (o) => h('div', { class: 'list-item', onclick: () => { E.ui.leftTab = 'library'; E.ui.libraryCat = 'Custom'; this.render(); } }, [customPrefabThumb(o, 40), h('div', { class: 'grow' }, [h('div', { class: 'title', text: o.name }), h('div', { class: 'sub', text: `${Object.keys(o.nodes).length} nodes` })])])));
    body.appendChild(listBlock('IMAGE ASSETS', Object.values(p.assets).slice(0, 30), async () => Ops.importImages(await pickFile('image/png,image/jpeg,image/webp', true)), (a) => h('div', { class: 'list-item', onclick: () => { E.ui.leftTab = 'assets'; this.render(); } }, [h('img', { class: 'thumb', src: a.dataUrl }), h('div', { class: 'grow' }, [h('div', { class: 'title', text: a.name }), h('div', { class: 'sub', text: `${a.w}×${a.h}` })])])));
  },
  // ------------------------------------------------------------- HIERARCHY / PARTS
  renderHierarchy(body) {
    const doc = currentDoc(); if (!doc) { body.appendChild(h('div', { class: 'empty', text: 'No document open' })); return; }
    const creature = isCreatureMode();
    if (!E.ui.expanded) E.ui.expanded = new Set(rootNodes(doc).map((n) => n.id));
    // header actions
    const acts = h('div', { class: 'row', style: { display: 'flex', gap: '4px', padding: '6px 8px', flexWrap: 'wrap', borderBottom: '1px solid var(--line)' } });
    if (creature) {
      acts.append(
        h('button', { class: 'btn tiny primary', text: '+ ADD PART', title: 'Add a body part under the selected part', onclick: () => this.addPartMenu(acts) }),
        h('button', { class: 'btn tiny', text: '+ ADD GROUP', onclick: () => Ops.addObjectOfType('group', 0, -40) }),
        h('button', { class: 'btn tiny', text: '+ ANCHOR', onclick: () => UI.setTool('anchor') }),
        h('button', { class: 'btn tiny', text: 'DUPLICATE', onclick: () => Ops.duplicate() }),
        h('button', { class: 'btn tiny danger', text: 'DELETE', onclick: () => Ops.deleteNodes() }),
      );
    } else {
      acts.append(
        h('button', { class: 'btn tiny primary', text: '+ ADD OBJECT', onclick: () => this.addObjectMenu(acts) }),
        h('button', { class: 'btn tiny', text: '+ GROUP', onclick: () => Ops.addObjectOfType('group', ...Scene.screenToWorld(Scene.w / 2, Scene.h / 2)) }),
        h('button', { class: 'btn tiny', text: 'DUPLICATE', onclick: () => Ops.duplicate() }),
        h('button', { class: 'btn tiny danger', text: 'DELETE', onclick: () => Ops.deleteNodes() }),
      );
    }
    body.appendChild(acts);
    const search = h('input', { class: 'search', placeholder: creature ? 'Filter parts…' : 'Filter objects…', value: E.ui.treeFilter || '', oninput: (e) => { E.ui.treeFilter = e.target.value; this.renderTree(treeWrap, doc); } });
    body.appendChild(h('div', { style: { padding: '6px 8px' } }, [search]));
    // layers (maps)
    if (!creature && doc.layers) body.appendChild(this.renderLayers(doc));
    const treeWrap = h('div', { class: 'tree' });
    body.appendChild(this.section(creature ? 'CREATURE PARTS' : 'OBJECTS', treeWrap, [h('button', { class: 'btn tiny ghost', text: 'EXPAND', onclick: () => { for (const n of allNodes(doc)) if (n.children.length) E.ui.expanded.add(n.id); this.renderTree(treeWrap, doc); } }), h('button', { class: 'btn tiny ghost', text: 'COLLAPSE', onclick: () => { E.ui.expanded.clear(); this.renderTree(treeWrap, doc); } })]));
    this.renderTree(treeWrap, doc);
    if (creature) {
      const my = currentMythling();
      body.appendChild(this.section('ANCHORS', allNodes(doc).filter((n) => n.type === 'anchor').map((a) => h('div', { class: `list-item compact ${E.selection.includes(a.id) ? 'active' : ''}`, onclick: () => select(a.id) }, [h('span', { class: 'dot', style: { background: a.fill } }), h('span', { class: 'grow', text: a.name }), h('span', { class: 'dim', text: `${Math.round(worldPos(a)[0])}, ${Math.round(worldPos(a)[1])}` })])), [h('button', { class: 'btn tiny', text: '+ ADD', onclick: () => UI.setTool('anchor') })]));
      if (my) body.appendChild(this.section('PALETTE', Object.entries(my.palette || {}).map(([k, v]) => h('div', { class: 'field' }, [h('label', { text: k }), h('input', { type: 'color', value: v, oninput: (e) => { my.palette[k] = e.target.value; Ops.applyPalette(my); } })]))));
    }
  },
  renderLayers(doc) {
    const list = h('div', { class: 'layers' });
    const layers = [...doc.layers].reverse();
    layers.forEach((l) => {
      const idx = doc.layers.indexOf(l);
      const count = allNodes(doc).filter((n) => n.layer === l.id).length;
      list.appendChild(h('div', { class: `list-item compact layer ${E.ui.activeLayer === l.id ? 'active' : ''}`, onclick: () => { E.ui.activeLayer = l.id; this.render(); } }, [
        h('button', { class: `tflag ${l.visible ? '' : 'off'}`, title: 'Toggle visibility', onclick: (e) => { e.stopPropagation(); History.run('Layer visibility', () => { l.visible = !l.visible; }); this.render(); } }, icon(l.visible ? 'eye' : 'eyeOff')),
        h('button', { class: `tflag ${l.locked ? 'on' : ''}`, title: 'Toggle lock', onclick: (e) => { e.stopPropagation(); History.run('Layer lock', () => { l.locked = !l.locked; }); this.render(); } }, icon(l.locked ? 'lock' : 'unlock')),
        h('span', { class: 'grow', text: l.name }), h('span', { class: 'dim', text: String(count) }),
        h('button', { class: 'tflag', title: 'Move up', onclick: (e) => { e.stopPropagation(); if (idx < doc.layers.length - 1) History.run('Reorder layer', () => { doc.layers.splice(idx, 1); doc.layers.splice(idx + 1, 0, l); }); this.render(); } }, icon('up')),
        h('button', { class: 'tflag', title: 'Move down', onclick: (e) => { e.stopPropagation(); if (idx > 0) History.run('Reorder layer', () => { doc.layers.splice(idx, 1); doc.layers.splice(idx - 1, 0, l); }); this.render(); } }, icon('down')),
      ]));
    });
    const sec = this.section('LAYERS', h('div', { class: 'collapsible' }, [list]), [
      h('button', { class: 'btn tiny', text: '+', title: 'Add layer', onclick: async () => { const name = await promptDialog('New Layer', 'Layer name', 'Custom Layer'); if (name) History.run('Add layer', () => { doc.layers.push({ id: nextName(slug(name), doc.layers.map((x) => x.id)), name, visible: true, locked: false }); }); this.render(); } }),
      h('button', { class: 'btn tiny ghost', text: E.ui.layersOpen === false ? 'SHOW' : 'HIDE', onclick: () => { E.ui.layersOpen = E.ui.layersOpen === false; this.render(); } }),
    ]);
    if (E.ui.layersOpen === false) list.classList.add('hidden');
    return sec;
  },
  renderTree(wrap, doc) {
    clear(wrap);
    const filter = (E.ui.treeFilter || '').toLowerCase();
    const creature = isCreatureMode();
    const matches = (n) => !filter || n.name.toLowerCase().includes(filter) || n.type.includes(filter) || (n.tags || []).some((t) => t.toLowerCase().includes(filter));
    const hasMatchIn = (n) => matches(n) || n.children.some((c) => doc.nodes[c] && hasMatchIn(doc.nodes[c]));
    const iconFor = (n) => n.type === 'group' ? (E.ui.expanded.has(n.id) ? 'folderOpen' : 'folder') : n.type === 'anchor' ? 'anchor' : n.type === 'npc' ? 'npc' : n.type === 'mythling' ? 'creature' : n.type === 'prefab' ? (PREFABS[n.prefab]?.icon || 'box') : n.type === 'zone' ? 'target' : n.type === 'warp' ? 'warp' : n.type === 'trigger' ? 'trigger' : n.type === 'spawn' ? 'spawn' : n.type === 'image' ? 'image' : n.type === 'text' ? 'text' : n.type === 'ellipse' ? 'ellipse' : n.type === 'polygon' ? 'polygon' : n.type === 'path' ? 'path' : n.type === 'gamepart' ? 'creature' : 'rect';
    const visit = (n, depth) => {
      if (!hasMatchIn(n)) return;
      const kids = nodeChildren(n, doc);
      const open = E.ui.expanded.has(n.id) || !!filter;
      const item = h('div', { class: `tree-item ${E.selection.includes(n.id) ? 'selected' : ''} ${n.visible ? '' : 'hidden-node'} ${n.locked ? 'locked-node' : ''}`, dataset: { id: n.id }, draggable: 'true', style: { paddingLeft: `${6 + depth * 14}px` }, title: `${n.type}${n.partType ? ' · ' + n.partType : ''}${n.layer ? ' · layer ' + n.layer : ''}` });
      item.appendChild(h('span', { class: `caret ${kids.length ? '' : 'none'} ${open ? 'open' : ''}`, onclick: (e) => { e.stopPropagation(); if (open) E.ui.expanded.delete(n.id); else E.ui.expanded.add(n.id); this.renderTree(wrap, doc); } }, kids.length ? '▸' : ''));
      const ic = icon(iconFor(n), 'ticon'); if (n.type === 'anchor') ic.style.color = n.fill; item.appendChild(ic);
      item.appendChild(h('span', { class: 'tname', text: n.name }));
      if (creature && n.partType && n.type !== 'anchor') item.appendChild(h('span', { class: 'pill tiny', text: n.partType }));
      if (creature && currentAnim() && currentAnim().tracks[n.id]) item.appendChild(h('span', { class: 'tl-icon', title: `${currentAnim().tracks[n.id].length} keyframes` }, icon('key')));
      item.appendChild(h('span', { class: 'tflags' }, [
        h('button', { class: `tflag ${n.visible ? '' : 'off'}`, title: 'Toggle visibility (H)', onclick: (e) => { e.stopPropagation(); Ops.toggleVisible([n.id]); } }, icon(n.visible ? 'eye' : 'eyeOff')),
        h('button', { class: `tflag ${n.locked ? 'on' : ''}`, title: 'Toggle lock (L)', onclick: (e) => { e.stopPropagation(); Ops.toggleLock([n.id]); } }, icon(n.locked ? 'lock' : 'unlock')),
      ]));
      item.addEventListener('click', (e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) select(n.id, { add: true }); else select(n.id); });
      item.addEventListener('dblclick', (e) => { e.stopPropagation(); UI.renameSelected(); });
      item.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!E.selection.includes(n.id)) select(n.id); Tools.showContextMenu(e.clientX, e.clientY, Tools.contextItems(n, ...worldPos(n, doc))); });
      // drag & drop reparent
      item.addEventListener('dragstart', (e) => { this.dragId = n.id; e.dataTransfer.setData('text/plain', `node:${n.id}`); e.dataTransfer.effectAllowed = 'move'; });
      item.addEventListener('dragover', (e) => { if (!this.dragId || this.dragId === n.id) return; e.preventDefault(); const r = item.getBoundingClientRect(); const k = (e.clientY - r.top) / r.height; item.classList.remove('drop-before', 'drop-after', 'drop-inside'); item.classList.add(k < 0.25 ? 'drop-before' : k > 0.75 ? 'drop-after' : 'drop-inside'); });
      item.addEventListener('dragleave', () => item.classList.remove('drop-before', 'drop-after', 'drop-inside'));
      item.addEventListener('drop', (e) => {
        e.preventDefault(); const src = this.dragId; this.dragId = null; item.classList.remove('drop-before', 'drop-after', 'drop-inside');
        if (!src || src === n.id) return;
        const r = item.getBoundingClientRect(); const k = (e.clientY - r.top) / r.height;
        const ids = E.selection.includes(src) ? E.selection : [src];
        for (const id of ids) {
          if (k < 0.25 || k > 0.75) { const arr = n.parent ? doc.nodes[n.parent].children : doc.root; let idx = arr.indexOf(n.id) + (k > 0.75 ? 1 : 0); if (doc.nodes[id].parent === (n.parent || null) && arr.indexOf(id) < idx) idx--; Ops.reparent(id, n.parent || null, idx); }
          else if (n.type !== 'anchor') Ops.reparent(id, n.id, -1);
        }
      });
      item.addEventListener('dragend', () => { this.dragId = null; $$('.tree-item').forEach((x) => x.classList.remove('drop-before', 'drop-after', 'drop-inside')); });
      wrap.appendChild(item);
      if (open) for (const k of kids) visit(k, depth + 1);
    };
    for (const r of rootNodes(doc)) visit(r, 0);
    // drop on empty area → move to root
    wrap.addEventListener('dragover', (e) => { if (this.dragId && e.target === wrap) e.preventDefault(); });
    wrap.addEventListener('drop', (e) => { if (e.target === wrap && this.dragId) { e.preventDefault(); Ops.reparent(this.dragId, null, -1); this.dragId = null; } });
    if (!wrap.children.length) wrap.appendChild(h('div', { class: 'empty', text: filter ? 'No matches' : 'Empty — use + ADD to create objects' }));
  },
  addPartMenu(anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    Tools.showContextMenu(r.left + 8, r.bottom, [
      ...[['Rectangle part', 'rect'], ['Ellipse part', 'ellipse'], ['Polygon part', 'polygon'], ['Path part', 'path'], ['Image part', 'image'], ['Text', 'text']].map(([l, t]) => ({ label: l, fn: () => { const sel = primarySelected(); const [x, y] = sel ? worldPos(sel) : [0, -40]; Ops.addObjectOfType(t, x + 10, y - 10); } })),
      'sep',
      { label: 'Body part presets', sub: CREATURE_PART_TYPES.filter((p) => p !== 'Group').map((pt) => ({ label: pt, fn: () => this.addPresetPart(pt) })) },
    ]);
  },
  addPresetPart(pt) {
    const my = currentMythling(); const pal = my?.palette || { main: '#6fa8dc', dark: '#3b5f8a', light: '#cfe6ff', accent: '#f2c761' };
    const sel = primarySelected(); const [wx, wy] = sel ? worldPos(sel) : [0, -40];
    const presets = { Body: ['ellipse', { w: 90, h: 60 }, pal.main], Head: ['ellipse', { w: 56, h: 50 }, pal.main], Ear: ['polygon', null, pal.main], Eye: ['ellipse', { w: 10, h: 12 }, '#1b1b1b'], Snout: ['ellipse', { w: 22, h: 14 }, pal.light], Leg: ['rect', { w: 14, h: 34 }, pal.dark], Tail: ['path', null, pal.main], Wing: ['polygon', null, pal.light], Fin: ['polygon', null, pal.light], Horn: ['polygon', null, pal.accent], Mane: ['ellipse', { w: 60, h: 40 }, pal.accent], Detail: ['ellipse', { w: 16, h: 16 }, pal.accent] };
    const [type, shape, fill] = presets[pt] || presets.Detail;
    const extra = { name: pt, partType: pt, fill, stroke: pal.dark || '#1b2a3d' };
    if (shape) extra.shape = shape;
    if (type === 'polygon') extra.points = pt === 'Ear' ? [[-10, 0], [0, -30], [10, 0]] : pt === 'Horn' ? [[-6, 0], [0, -26], [6, 0]] : [[-30, 0], [0, -34], [34, -6], [10, 10]];
    if (type === 'path') { extra.points = [[0, 0], [20, -16], [44, -10], [56, -30]]; extra.closed = false; extra.strokeWidth = 12; extra.stroke = fill; extra.fill = 'transparent'; }
    Ops.addObjectOfType(type, wx + 10, wy - 10, extra);
  },
  addObjectMenu(anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    const [cx, cy] = Scene.screenToWorld(Scene.w / 2, Scene.h / 2);
    const cat = (names) => names.map(([l, t]) => ({ label: l, fn: () => Ops.addObjectOfType(t, cx, cy) }));
    Tools.showContextMenu(r.left + 8, r.bottom, [
      { label: 'Shapes', sub: cat([['Image', 'image'], ['Rectangle', 'rect'], ['Ellipse', 'ellipse'], ['Polygon', 'polygon'], ['Path', 'path'], ['Group', 'group'], ['Text', 'text']]) },
      { label: 'Characters', sub: cat([['NPC', 'npc'], ['Mythling', 'mythling']]) },
      { label: 'Nature', sub: cat([['Tree', 'tree'], ['Rock', 'rock'], ['Bush', 'bush'], ['Flower', 'flower'], ['Mushroom', 'mushroom'], ['Log', 'log'], ['Reed', 'reed'], ['Crystal', 'crystal']]) },
      { label: 'Structures', sub: cat([['Box', 'box'], ['Building', 'building'], ['Sign', 'sign'], ['Bridge', 'bridge'], ['Waterfall', 'waterfall'], ['Chest', 'chest'], ['Save Point', 'savepoint']]) },
      { label: 'Gameplay', sub: cat([['Warp', 'warp'], ['Spawn Zone', 'zone'], ['Trigger', 'trigger'], ['Spawn Point', 'spawn']]) },
    ]);
  },
  // ------------------------------------------------------------- ASSETS
  renderAssets(body) {
    const cats = ['all', 'general', 'creature', 'terrain', 'prop', 'ui'];
    body.appendChild(h('div', { class: 'row', style: { display: 'flex', gap: '4px', padding: '8px', flexWrap: 'wrap' } }, [
      h('button', { class: 'btn small primary', text: '⬆ UPLOAD IMAGES', onclick: async () => Ops.importImages(await pickFile('image/png,image/jpeg,image/webp', true)) }),
      h('span', { class: 'hint', text: 'PNG / JPG / WEBP · drag a thumbnail onto the canvas to place it' }),
    ]));
    body.appendChild(h('div', { class: 'row', style: { display: 'flex', gap: '4px', padding: '0 8px 8px', flexWrap: 'wrap' } }, cats.map((c) => h('button', { class: `cat-btn ${E.ui.assetCat === c ? 'active' : ''}`, text: c.toUpperCase(), onclick: () => { E.ui.assetCat = c; this.render(); } }))));
    const assets = Object.values(E.project.assets).filter((a) => E.ui.assetCat === 'all' || a.category === E.ui.assetCat);
    if (!assets.length) { body.appendChild(h('div', { class: 'empty', text: 'No images yet. Upload PNG/JPG/WEBP files to use them as parts, props or backgrounds.' })); return; }
    const grid = h('div', { class: 'grid-cards' });
    for (const a of assets) {
      const card = h('div', { class: 'card', draggable: 'true', title: `${a.name} · ${a.w}×${a.h} · ${Math.round(a.size / 1024)} KB` }, [
        h('div', { class: 'card-img' }, [h('img', { src: a.dataUrl })]),
        h('div', { class: 'card-title', text: a.name }),
        h('div', { class: 'card-sub', text: `${a.w}×${a.h}` }),
        h('div', { class: 'card-actions' }, [
          h('button', { class: 'btn tiny', text: 'PLACE', onclick: () => Ops.addObjectOfType('image', ...Scene.screenToWorld(Scene.w / 2, Scene.h / 2), { name: a.name, asset: a.id, shape: { w: a.w, h: a.h } }) }),
          h('button', { class: 'btn tiny ghost', text: 'RENAME', onclick: async () => { const nm = await promptDialog('Rename Asset', 'Name', a.name); if (nm) { History.run('Rename asset', () => { a.name = nm; }); this.render(); } } }),
          h('button', { class: 'btn tiny ghost', text: 'REPLACE', onclick: () => Ops.replaceAsset(a.id) }),
          h('select', { class: 'tiny', title: 'Category', onchange: (e) => { History.run('Asset category', () => { a.category = e.target.value; }); } }, cats.slice(1).map((c) => h('option', { value: c, selected: a.category === c, text: c }))),
          h('button', { class: 'btn tiny danger', text: '✕', title: 'Delete', onclick: () => Ops.deleteAsset(a.id) }),
        ]),
      ]);
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', `asset:${a.id}`));
      grid.appendChild(card);
    }
    body.appendChild(grid);
  },
  // ------------------------------------------------------------- LIBRARY
  renderLibrary(body) {
    const cats = PREFAB_CATEGORIES;
    body.appendChild(h('div', { class: 'row', style: { display: 'flex', gap: '4px', padding: '8px', flexWrap: 'wrap' } }, cats.map((c) => h('button', { class: `cat-btn ${E.ui.libraryCat === c ? 'active' : ''}`, text: c.toUpperCase(), onclick: () => { E.ui.libraryCat = c; this.render(); } }))));
    body.appendChild(h('div', { class: 'hint', style: { padding: '0 10px 6px' }, text: isCreatureMode() ? 'Library objects are placed in maps. Switch to the Map editor to use them.' : 'Click to place at the view centre, or drag onto the canvas.' }));
    const grid = h('div', { class: 'grid-cards' });
    if (E.ui.libraryCat === 'Custom') {
      const objs = Object.values(E.project.objects);
      if (!objs.length) body.appendChild(h('div', { class: 'empty', text: 'No custom objects. Select objects on a map and use right-click → Save to Library.' }));
      for (const o of objs) {
        const card = h('div', { class: 'card', draggable: 'true' }, [h('div', { class: 'card-img' }, [customPrefabThumb(o, 64)]), h('div', { class: 'card-title', text: o.name }), h('div', { class: 'card-sub', text: `${Object.keys(o.nodes).length} nodes` }), h('div', { class: 'card-actions' }, [
          h('button', { class: 'btn tiny', text: 'PLACE', onclick: () => { if (isCreatureMode()) UI.setMode('map'); Ops.placeLibraryObject(o.id, ...Scene.screenToWorld(Scene.w / 2, Scene.h / 2)); } }),
          h('button', { class: 'btn tiny ghost', text: 'RENAME', onclick: async () => { const nm = await promptDialog('Rename Object', 'Name', o.name); if (nm) { History.run('Rename object', () => { o.name = nm; }); this.render(); } } }),
          h('button', { class: 'btn tiny ghost', text: 'EXPORT', onclick: () => Exporter.downloadObject(o) }),
          h('button', { class: 'btn tiny danger', text: '✕', onclick: async () => { if (await confirmDialog('Delete Object', `Remove "${o.name}" from the library?`, 'DELETE', 'CANCEL', true)) { History.run('Delete object', () => { delete E.project.objects[o.id]; }); this.render(); } } }),
        ])]);
        card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', `object:${o.id}`));
        grid.appendChild(card);
      }
    } else {
      for (const [id, pf] of Object.entries(PREFABS)) {
        if (pf.category !== E.ui.libraryCat) continue;
        const card = h('div', { class: 'card', draggable: 'true', title: `${pf.name} — click to place`, onclick: () => { if (isCreatureMode()) UI.setMode('map'); Ops.addObjectOfType(id, ...Scene.screenToWorld(Scene.w / 2, Scene.h / 2)); } }, [h('div', { class: 'card-img' }, [prefabThumb(id, 64)]), h('div', { class: 'card-title', text: pf.name }), h('div', { class: 'card-sub', text: `${pf.w}×${pf.h}${pf.collision ? ' · collides' : ''}` })]);
        card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', `prefab:${id}`));
        grid.appendChild(card);
      }
      if (E.ui.libraryCat === 'General') {
        for (const m of Object.values(E.project.mythlings)) { const card = h('div', { class: 'card', draggable: 'true', title: `Place ${m.name} on the map`, onclick: () => { if (isCreatureMode()) UI.setMode('map'); Ops.addObjectOfType('mythling', ...Scene.screenToWorld(Scene.w / 2, Scene.h / 2), { name: m.name, mythling: { species: m.id, level: 5 } }); } }, [h('div', { class: 'card-img' }, [creatureThumb(m, 64)]), h('div', { class: 'card-title', text: m.name }), h('div', { class: 'card-sub', text: 'Mythling' })]); card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', `mythling:${m.id}`)); grid.appendChild(card); }
      }
    }
    body.appendChild(grid);
  },
  // ------------------------------------------------------------- TERRAIN / COLLISION / SPAWN
  renderTerrain(body) {
    body.appendChild(this.section('TERRAIN BRUSHES', h('div', { class: 'terrain-grid' }, TERRAINS.filter((t) => t.color).map((t) => h('button', { class: `terrain-btn ${E.terrain === t.id ? 'active' : ''}`, title: `${t.name} (${TERRAIN_INDEX[t.id]})`, onclick: () => { E.terrain = t.id; this.render(); UI.renderSubToolbar(); Scene.invalidate(); } }, [h('span', { class: 'swatch', style: { background: t.color } }), h('span', { text: t.name })])))));
    body.appendChild(this.section('MODE', h('div', { class: 'chips' }, [['paint', 'PAINT'], ['erase', 'ERASE'], ['fill', 'FILL'], ['replace', 'REPLACE'], ['rect', 'RECTANGLE'], ['water', 'WATER'], ['pick', 'PICK']].map(([id, l]) => h('button', { class: `chip ${E.subTool === id ? 'active' : ''}`, text: l, onclick: () => { E.subTool = id; this.render(); UI.renderSubToolbar(); } })))));
    body.appendChild(this.section('BRUSH SIZE', h('div', { class: 'chips' }, [1, 2, 4, 8, 16].map((b) => h('button', { class: `chip ${E.brushSize === b ? 'active' : ''}`, text: `${b}×${b}`, onclick: () => { E.brushSize = b; this.render(); UI.renderSubToolbar(); Scene.invalidate(); } })))));
    const map = currentMap();
    if (map) body.appendChild(this.section('MAP', [h('div', { class: 'field' }, [h('label', { text: 'Base terrain' }), h('select', { onchange: (e) => History.run('Base terrain', () => { map.baseTerrain = e.target.value; }) }, TERRAINS.filter((t) => t.color).map((t) => h('option', { value: t.id, selected: (map.baseTerrain || 'grass') === t.id, text: t.name })))]), h('div', { class: 'field' }, [h('label', { text: 'Background' }), h('input', { type: 'color', value: map.background || '#4f9d4a', oninput: (e) => History.run('~Background', () => { map.background = e.target.value; }) })]), h('button', { class: 'btn small', text: 'FILL WHOLE MAP WITH TERRAIN', onclick: async () => { if (await confirmDialog('Fill Map', `Replace all terrain with ${E.terrain}?`)) History.run('Fill map', () => { map.terrain.fill(TERRAIN_INDEX[E.terrain]); }); } })]));
    body.appendChild(h('div', { class: 'hint', style: { padding: '10px' }, text: 'Tips: Alt+drag erases to the base terrain · [ and ] change brush size · 1–9 pick a terrain · Water and cliffs also update the collision grid.' }));
  },
  renderCollision(body) {
    body.appendChild(this.section('COLLISION PAINT', h('div', { class: 'col-modes' }, COLLISION_MODES.map((m) => h('button', { class: `terrain-btn ${E.collisionMode === m.value ? 'active' : ''}`, onclick: () => { E.collisionMode = m.value; this.render(); UI.renderSubToolbar(); Scene.invalidate(); } }, [h('span', { class: 'swatch', style: { background: m.color } }), h('span', { text: `${m.name} (${m.value + 1})` })])))));
    body.appendChild(this.section('MODE', h('div', { class: 'chips' }, [['paint', 'BRUSH'], ['rect', 'RECTANGLE'], ['fill', 'FILL']].map(([id, l]) => h('button', { class: `chip ${E.subTool === id ? 'active' : ''}`, text: l, onclick: () => { E.subTool = id; this.render(); UI.renderSubToolbar(); } })))));
    body.appendChild(this.section('BRUSH SIZE', h('div', { class: 'chips' }, [1, 2, 4, 8, 16].map((b) => h('button', { class: `chip ${E.brushSize === b ? 'active' : ''}`, text: `${b}×${b}`, onclick: () => { E.brushSize = b; this.render(); Scene.invalidate(); } })))));
    const map = currentMap();
    if (map) body.appendChild(this.section('GRID TOOLS', [
      h('button', { class: 'btn small', text: 'AUTO FROM TERRAIN', title: 'Water → water, cliffs/lava → blocked, everything else walkable', onclick: () => History.run('Auto collision', () => { for (let i = 0; i < map.terrain.length; i++) { const t = TERRAINS[map.terrain[i]]?.id; map.collision[i] = t === 'water' ? 2 : (t === 'cliff' || t === 'lava') ? 1 : (map.collision[i] === 3 || map.collision[i] === 4 ? map.collision[i] : 0); } }) }),
      h('button', { class: 'btn small', text: 'CLEAR ALL (WALKABLE)', onclick: async () => { if (await confirmDialog('Clear Collision', 'Set every cell to walkable?')) History.run('Clear collision', () => { map.collision.fill(0); }); } }),
      h('button', { class: 'btn small', text: 'BLOCK MAP EDGES', onclick: () => History.run('Block edges', () => { for (let c = 0; c < map.cols; c++) { map.collision[c] = 1; map.collision[(map.rows - 1) * map.cols + c] = 1; } for (let r = 0; r < map.rows; r++) { map.collision[r * map.cols] = 1; map.collision[r * map.cols + map.cols - 1] = 1; } }) }),
    ]));
    body.appendChild(h('div', { class: 'hint', style: { padding: '10px' }, text: 'Object collision shapes (rect / circle / polygon) are edited per object: select it, then drag the red handles or use the COLLISION tab in the inspector. Alt+drag clears cells.' }));
  },
  renderSpawn(body) {
    body.appendChild(this.section('SPAWN TYPE', h('div', { class: 'chips' }, [['player', 'PLAYER'], ['npc', 'NPC'], ['mythling', 'MYTHLING']].map(([id, l]) => h('button', { class: `chip ${E.spawnKind === id ? 'active' : ''}`, text: l, onclick: () => { E.spawnKind = id; this.render(); UI.renderSubToolbar(); } })))));
    const map = currentMap(); if (!map) return;
    const spawns = allNodes(map).filter((n) => n.type === 'spawn');
    body.appendChild(this.section('SPAWN POINTS', spawns.length ? spawns.map((s) => h('div', { class: `list-item compact ${E.selection.includes(s.id) ? 'active' : ''}`, onclick: () => { select(s.id); Scene.centerOn(s.x, s.y); } }, [icon('spawn', 'ticon'), h('span', { class: 'grow', text: `${s.name} (${s.spawn.kind})` }), h('span', { class: 'dim', text: `${Math.round(s.x)}, ${Math.round(s.y)}${s.spawn.enabled ? '' : ' · off'}` })])) : h('div', { class: 'empty', text: 'Click on the map to place a spawn point' })));
    body.appendChild(h('div', { class: 'hint', style: { padding: '10px' }, text: 'Player spawn = where playtest starts. Mythling spawns are used by encounter zones; NPC spawns mark where an NPC stands.' }));
  },
  // ------------------------------------------------------------- ANIMATIONS / VFX lists
  renderAnims(body) {
    const my = currentMythling(); if (!my) return;
    body.appendChild(h('div', { style: { padding: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' } }, [h('button', { class: 'btn small primary', text: '+ NEW ANIMATION', onclick: () => Screens.newAnimation() }), h('button', { class: 'btn small', text: 'DUPLICATE', onclick: () => E.animId && Ops.duplicateAnimation(E.animId) }), h('button', { class: 'btn small danger', text: 'DELETE', onclick: () => E.animId && Ops.deleteAnimation(E.animId) })]));
    body.appendChild(this.section(`${my.name.toUpperCase()} — CLIPS`, my.animations.map((id) => E.project.animations[id]).filter(Boolean).map((a) => h('div', { class: `list-item ${E.animId === a.id ? 'active' : ''}`, onclick: () => UI.setAnimation(a.id) }, [icon('film', 'ticon'), h('div', { class: 'grow' }, [h('div', { class: 'title', text: a.name }), h('div', { class: 'sub', text: `${a.duration}s · ${a.fps} fps · ${a.loop ? 'loop' : 'once'} · ${Object.keys(a.tracks).length} tracks` })]), h('button', { class: 'btn tiny ghost', text: '▶', title: 'Play', onclick: (e) => { e.stopPropagation(); UI.setAnimation(a.id); E.playing = true; Bottom.syncTransport(); Scene.invalidate(); } })]))));
    body.appendChild(this.section('STANDARD CLIP NAMES', h('div', { class: 'chips' }, ANIM_NAMES.map((nm) => { const has = my.animations.some((id) => E.project.animations[id]?.name === nm); return h('button', { class: `chip ${has ? 'active' : ''}`, text: nm, title: has ? 'Exists' : 'Create this clip', onclick: () => { const ex = my.animations.map((id) => E.project.animations[id]).find((a) => a && a.name === nm); if (ex) UI.setAnimation(ex.id); else Ops.createAnimation(my, { name: nm, duration: ['Idle', 'Battle Idle', 'Walk', 'Run'].includes(nm) ? 1.2 : 0.8, loop: ['Idle', 'Battle Idle', 'Walk', 'Run'].includes(nm) }); } }); }))));
  },
  renderVfx(body) {
    body.appendChild(h('div', { style: { padding: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' } }, [h('button', { class: 'btn small primary', text: '+ NEW VFX', onclick: () => Screens.newVfx() }), h('button', { class: 'btn small', text: 'LIBRARY', onclick: () => UI.setMode('vfxlib') })]));
    for (const cat of VFX_CATEGORIES) {
      const list = Object.values(E.project.vfx).filter((v) => v.category === cat); if (!list.length) continue;
      body.appendChild(this.section(cat.toUpperCase(), list.map((v) => h('div', { class: `list-item ${E.vfxId === v.id ? 'active' : ''}`, onclick: () => { E.vfxId = v.id; UI.refreshAll(); } }, [icon('vfx', 'ticon'), h('div', { class: 'grow' }, [h('div', { class: 'title', text: v.name }), h('div', { class: 'sub', text: `${v.emitters.length} emitters · ${v.duration}s` })]), h('button', { class: 'btn tiny ghost', text: '▶', onclick: (e) => { e.stopPropagation(); E.vfxId = v.id; UI.refreshAll(); Bottom.playVfx(); } })]))));
    }
  },
};
function kvRow(k, v) { return h('div', { class: 'kv' }, [h('span', { class: 'k', text: k }), h('span', { class: 'v', text: v })]); }
