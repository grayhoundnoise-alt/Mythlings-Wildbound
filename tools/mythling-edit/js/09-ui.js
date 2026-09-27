// =============================================================================
// UI core: menus, toolbar, mode / tool switching, status bar, panel layout
// =============================================================================
const MODE_LABELS = { map: 'MAP EDITOR', creature: 'CREATURE EDITOR', animation: 'ANIMATION EDITOR', vfx: 'VFX EDITOR', skills: 'SKILL EDITOR', evolution: 'EVOLUTION EDITOR', browser: 'MYTHLING BROWSER', export: 'EXPORT', playtest: 'PLAYTEST MODE', collision: 'COLLISION EDITOR' };
const UI = {
  menus: [], openMenu: null, hint: '',
  init() {
    this.buildMenus();
    this.buildToolbar();
    this.bindHeader();
    this.bindSplitters();
    $('#mr-version').textContent = `v${EDITOR_VERSION}`;
    window.addEventListener('resize', () => Scene.resize());
  },
  // ------------------------------------------------------------- menus
  menuDefs() {
    const S = () => settings();
    const chk = (key) => ({ checked: () => !!S()[key], fn: () => this.toggleSetting(key) });
    const my = () => currentMythling();
    return [
      ['FILE', [
        { label: 'New Project…', sc: 'Ctrl+Alt+N', fn: () => App.newProject() },
        { label: 'Open Project File…', sc: 'Ctrl+O', fn: () => App.openFile() },
        { label: 'Open Recent', sub: () => App.recentMenu() },
        { label: 'Project Browser (Start Screen)', fn: () => App.showStart() },
        'sep',
        { label: 'Save', sc: 'Ctrl+S', fn: () => App.save() },
        { label: 'Save As Copy…', sc: 'Ctrl+Shift+S', fn: () => App.save(true) },
        { label: 'Save Snapshot (Version)…', fn: () => App.saveSnapshot() },
        { label: 'Version History…', fn: () => Screens.snapshots() },
        'sep',
        { label: 'Import Project JSON…', fn: () => App.importProjectFile() },
        { label: 'Import Images (PNG/JPG/WEBP)…', fn: async () => Ops.importImages(await pickFile('image/png,image/jpeg,image/webp', true)) },
        { label: 'Export…', sc: 'Ctrl+E', fn: () => this.setMode('export') },
        { label: 'Download Project JSON', fn: () => Exporter.downloadProject() },
        'sep',
        { label: 'Close Project', fn: () => App.closeProject() },
      ]],
      ['EDIT', [
        { label: 'Undo', sc: 'Ctrl+Z', fn: () => History.undo() },
        { label: 'Redo', sc: 'Ctrl+Y', fn: () => History.redo() },
        'sep',
        { label: 'Cut', sc: 'Ctrl+X', fn: () => Ops.cut() },
        { label: 'Copy', sc: 'Ctrl+C', fn: () => Ops.copy() },
        { label: 'Paste', sc: 'Ctrl+V', fn: () => Ops.paste() },
        { label: 'Duplicate', sc: 'Ctrl+D', fn: () => Ops.duplicate() },
        { label: 'Delete', sc: 'Del', fn: () => Ops.deleteNodes() },
        'sep',
        { label: 'Select All', sc: 'Ctrl+A', fn: () => this.selectAll() },
        { label: 'Deselect', sc: 'Esc', fn: () => select([]) },
        { label: 'Rename…', sc: 'F2', fn: () => this.renameSelected() },
        { label: 'Create Parent Group', sc: 'Ctrl+G', fn: () => Ops.groupSelection() },
        { label: 'Ungroup', sc: 'Ctrl+Shift+G', fn: () => primarySelected() && Ops.ungroup(primarySelected().id) },
        { label: 'Lock / Unlock', sc: 'L', fn: () => Ops.toggleLock() },
        { label: 'Hide / Show', sc: 'H', fn: () => Ops.toggleVisible() },
        'sep',
        { label: 'Bring to Front', sc: 'Ctrl+]', fn: () => Ops.bringToFront() },
        { label: 'Send to Back', sc: 'Ctrl+[', fn: () => Ops.sendToBack() },
        'sep',
        { label: 'Preferences…', fn: () => Screens.preferences() },
      ]],
      ['VIEW', [
        { label: 'Zoom In', sc: '+', fn: () => Scene.zoomBy(1.25) },
        { label: 'Zoom Out', sc: '−', fn: () => Scene.zoomBy(0.8) },
        { label: 'Zoom 100%', sc: '0', fn: () => Scene.setZoom(1) },
        { label: 'Fit to Screen', sc: 'F', fn: () => Scene.fit() },
        { label: 'Frame Selection', sc: 'Shift+F', fn: () => Scene.fitSelection() },
        'sep',
        { label: 'Show Grid', sc: 'G', ...chk('showGrid') },
        { label: 'Snap to Grid', ...chk('snap') },
        { label: 'Grid Size', sub: () => [8, 16, 32, 64].map((g) => ({ label: `${g} px`, checked: () => S().gridSize === g, fn: () => { History.run('Grid size', () => { S().gridSize = g; }); this.updateStatus(); } })).concat([{ label: 'Custom…', fn: async () => { const v = +(await promptDialog('Grid Size', 'Pixels', String(S().gridSize))); if (v > 0) { History.run('Grid size', () => { S().gridSize = v; }); Scene.invalidate(); } } }]) },
        { label: 'Creature Snap Step', sub: () => [1, 2, 4, 8].map((g) => ({ label: `${g} px`, checked: () => (S().creatureGridSize || 4) === g, fn: () => { History.run('Creature snap step', () => { S().creatureGridSize = g; }); this.updateStatus(); } })) },
        { label: 'Show Rulers', checked: () => S().showRulers !== false, fn: () => { S().showRulers = S().showRulers === false; Scene.invalidate(); } },
        { label: 'Show Guides', ...chk('showGuides') },
        { label: 'Clear Guides', fn: () => History.run('Clear guides', () => { S().guides.h = []; S().guides.v = []; }) },
        'sep',
        { label: 'Show Anchors', ...chk('showAnchors') },
        { label: 'Show Pivots', ...chk('showPivots') },
        { label: 'Show Collision', ...chk('showCollision') },
        { label: 'Show Spawn Zones', ...chk('showZones') },
        { label: 'Show Triggers / Warps / Spawns', ...chk('showTriggers') },
        { label: 'Show Target Dummy', checked: () => S().showTarget !== false, fn: () => { S().showTarget = S().showTarget === false; Scene.invalidate(); } },
        { label: 'Live Preview (wind, water, idle)', checked: () => !!S().livePreview, fn: () => this.toggleSetting('livePreview') },
        { label: 'Debug Overlays', ...chk('debug') },
        'sep',
        { label: 'Before / After Compare', sc: 'Q', checked: () => E.compare, fn: () => { E.compare = !E.compare; Scene.invalidate(); } },
      ]],
      ['PROJECT', [
        { label: 'Project Settings…', fn: () => Screens.projectSettings() },
        { label: 'Version History / Snapshots…', fn: () => Screens.snapshots() },
        { label: 'Statistics…', fn: () => Screens.stats() },
        { label: 'Validate Project', fn: () => Exporter.validate(true) },
        'sep',
        { label: 'Game Presets… (real maps, Mythlings, skills, VFX)', fn: () => App.gamePresets(), disabled: () => !Game.ok },
        { label: 'Add Game Map', sub: () => Game.mapIds().map((id) => ({ label: `${Game.map(id).displayName}${E.project?.maps[id] ? '  (reset to game version)' : ''}`, fn: () => { Game.addPreset('map', id); UI.openMap(id); toast(`${Game.map(id).displayName} imported from the game`, 'ok'); } })), disabled: () => !Game.ok },
        { label: 'Add Game Mythling', sub: () => Game.speciesIds().map((id) => ({ label: `${Game.species(id).displayName} (${Game.species(id).element})${E.project?.mythlings[id] ? '  (reset to game version)' : ''}`, fn: () => { Game.addPreset('mythling', id); UI.openMythling(id, 'creature'); toast(`${Game.species(id).displayName} imported from the game`, 'ok'); } })), disabled: () => !Game.ok },
        { label: 'Add Demo Content (maps + Mythlings)', fn: () => App.addDemoContent() },
        { label: 'Add Template Mythlings', sub: () => Object.entries(SPECIES_TEMPLATES).map(([k, t]) => ({ label: `${t.name} (${t.element})`, fn: () => App.addTemplate(k) })) },
        'sep',
        { label: 'Export…', sc: 'Ctrl+E', fn: () => this.setMode('export') },
      ]],
      ['WORLD', [
        { label: 'Map Editor', fn: () => this.setMode('map') },
        { label: 'Open Map', sub: () => Object.values(E.project.maps).map((m) => ({ label: m.name, checked: () => E.mapId === m.id && E.mode === 'map', fn: () => this.openMap(m.id) })) },
        { label: 'New Map…', fn: () => Screens.newMap() },
        { label: 'Map Settings…', fn: () => { this.setMode('map'); select([]); this.showRightTab('properties'); } },
        { label: 'Duplicate Map', fn: () => Ops.duplicateMap(E.mapId) },
        { label: 'Delete Map…', fn: () => Ops.deleteMap(E.mapId) },
        { label: 'Resize Map…', fn: () => Screens.resizeMap() },
        'sep',
        { label: 'Layers', fn: () => { this.setMode('map'); this.showLeftTab('hierarchy'); } },
        { label: 'Paint Terrain', sc: 'M', fn: () => { this.setMode('map'); this.setTool('paint'); } },
        { label: 'Collision Editor', sc: 'C', fn: () => { this.setMode('map'); this.setTool('collision'); } },
        { label: 'Add Object', sub: () => [['NPC', 'npc'], ['Mythling', 'mythling'], ['Tree', 'tree'], ['Rock', 'rock'], ['Bush', 'bush'], ['Flower', 'flower'], ['Crystal', 'crystal'], ['Box', 'box'], ['Building', 'building'], ['Sign', 'sign'], ['Bridge', 'bridge'], ['Waterfall', 'waterfall'], ['Chest', 'chest'], ['Save Point', 'savepoint'], ['Warp', 'warp'], ['Spawn Zone', 'zone'], ['Trigger', 'trigger'], ['Spawn Point', 'spawn']].map(([l, t]) => ({ label: l, fn: () => { this.setMode('map'); const [cx, cy] = Scene.screenToWorld(Scene.w / 2, Scene.h / 2); Ops.addObjectOfType(t, cx, cy); } })) },
        'sep',
        { label: 'Playtest Map', sc: 'F5', fn: () => { this.setMode('map'); Playtest.start('map'); } },
      ]],
      ['CREATURE', [
        { label: 'Mythling Browser', fn: () => this.setMode('browser') },
        { label: 'Creature Editor (Design)', fn: () => this.setMode('creature') },
        { label: 'Open Mythling', sub: () => Object.values(E.project.mythlings).map((m) => ({ label: m.name, checked: () => E.mythlingId === m.id && isCreatureMode(), fn: () => this.openMythling(m.id, isCreatureMode() && E.mode !== 'browser' ? E.mode : 'creature') })) },
        { label: 'New Mythling…', fn: () => Screens.newMythling() },
        { label: 'Duplicate Mythling', fn: () => my() && Ops.duplicateMythling(my().id) },
        { label: 'Delete Mythling…', fn: () => my() && Ops.deleteMythling(my().id) },
        'sep',
        { label: 'Add Part', sub: () => [['Rectangle', 'rect'], ['Ellipse', 'ellipse'], ['Polygon', 'polygon'], ['Path', 'path'], ['Image', 'image']].map(([l, t]) => ({ label: l, fn: () => { this.ensureCreature(); Ops.addObjectOfType(t, 0, -40); } })) },
        { label: 'Add Group', fn: () => { this.ensureCreature(); Ops.addObjectOfType('group', 0, -40); } },
        { label: 'Add Anchor', sc: 'A', fn: () => { this.ensureCreature(); this.setTool('anchor'); } },
        { label: 'Rebuild Rig from Template', sub: () => Object.keys(BODY_TEMPLATES).map((b) => ({ label: titleCase(b), fn: async () => { if (my() && (await confirmDialog('Rebuild Rig', `Replace the rig and default animations of ${my().name} with the ${b} template?`, 'REBUILD'))) Ops.rebuildRig(my(), b); } })) },
        'sep',
        { label: 'Evolution Editor', fn: () => this.setMode('evolution') },
        { label: 'Skill Editor', fn: () => this.setMode('skills') },
        { label: 'Creature Playtest', fn: () => { this.ensureCreature(); Playtest.start('creature'); } },
        { label: 'Export PNG Preview', fn: () => my() && Exporter.downloadCreaturePng(my()) },
      ]],
      ['ANIMATION', [
        { label: 'Animation Editor', fn: () => this.setMode('animation') },
        { label: 'Open Animation', sub: () => (my() ? my().animations.map((id) => E.project.animations[id]).filter(Boolean).map((a) => ({ label: a.name, checked: () => E.animId === a.id, fn: () => { this.setMode('animation'); this.setAnimation(a.id); } })) : []) },
        { label: 'New Animation…', fn: () => Screens.newAnimation() },
        { label: 'Duplicate Animation', fn: () => E.animId && Ops.duplicateAnimation(E.animId) },
        { label: 'Delete Animation…', fn: () => E.animId && Ops.deleteAnimation(E.animId) },
        'sep',
        { label: 'Play / Pause', sc: 'Space (timeline)', fn: () => Bottom.togglePlay() },
        { label: 'Stop', fn: () => Bottom.stop() },
        { label: 'Loop Playback', checked: () => E.loopPlayback, fn: () => { E.loopPlayback = !E.loopPlayback; Bottom.syncTransport(); } },
        { label: 'Speed', sub: () => [0.25, 0.5, 1, 2].map((s) => ({ label: `${s}×`, checked: () => E.speed === s, fn: () => { E.speed = s; Bottom.syncTransport(); } })) },
        { label: 'Auto-Key on Move', checked: () => !!S().autoKey, fn: () => this.toggleSetting('autoKey') },
        'sep',
        { label: 'Add Keyframe (selected parts)', sc: 'K', fn: () => Ops.keyCurrentPose(E.selection) },
        { label: 'Key All Parts', sc: 'Shift+K', fn: () => Ops.keyCurrentPose(allNodes().filter((n) => n.type !== 'anchor').map((n) => n.id)) },
        { label: 'Delete Keyframe', sc: 'Del', fn: () => E.selectedKey && Ops.deleteKeyframe(currentAnim(), E.selectedKey.trackId, E.selectedKey.index) },
        { label: 'Copy Keyframes', sc: 'Ctrl+C', fn: () => E.selectedKey && Ops.copyKeyframes(currentAnim(), E.selectedKey.trackId) },
        { label: 'Paste Keyframes', sc: 'Ctrl+V', fn: () => primarySelected() && Ops.pasteKeyframes(currentAnim(), primarySelected().id) },
        { label: 'Reverse Animation', fn: () => Bottom.reverseAnim() },
        { label: 'Quantize Keys to FPS', fn: () => Bottom.quantize() },
      ]],
      ['VFX', [
        { label: 'VFX Library', fn: () => this.setMode('vfxlib') },
        { label: 'VFX Editor', fn: () => this.setMode('vfx') },
        { label: 'Open VFX', sub: () => Object.values(E.project.vfx).map((v) => ({ label: `${v.name} (${v.category})`, checked: () => E.vfxId === v.id, fn: () => { this.setMode('vfx'); E.vfxId = v.id; this.refreshAll(); } })) },
        { label: 'New VFX…', fn: () => Screens.newVfx() },
        { label: 'Duplicate VFX', fn: () => E.vfxId && Ops.duplicateVfx(E.vfxId) },
        { label: 'Delete VFX…', fn: () => E.vfxId && Ops.deleteVfx(E.vfxId) },
        'sep',
        { label: 'Add Emitter', sub: () => VFX_TYPES.map((t) => ({ label: titleCase(t), fn: () => Bottom.addEmitter(t) })) },
        { label: 'Play VFX', sc: 'Shift+Space', fn: () => Bottom.playVfx() },
        { label: 'Attach VFX to Current Mythling', fn: () => { const m = my(), v = currentVfx(); if (m && v) History.run('Attach VFX', () => { if (!m.vfx.includes(v.id)) m.vfx.push(v.id); }); this.refreshAll(); } },
      ]],
      ['TOOLS', [
        ...['select', 'move', 'rotate', 'scale', 'draw', 'rectangle', 'ellipse', 'polygon', 'path', 'eraser', 'anchor', 'pivot', 'collision', 'paint'].map((t) => ({ label: TOOL_INFO[t].name, sc: TOOL_INFO[t].key, checked: () => E.tool === t, fn: () => this.setTool(t) })),
        'sep',
        { label: 'Validate Project', fn: () => Exporter.validate(true) },
        { label: 'Asset Manager', fn: () => this.showLeftTab('assets') },
        { label: 'Console', fn: () => this.showBottomTab('console') },
        { label: 'Clear Console', fn: () => { ConsoleLog.lines.length = 0; Bottom.render(); } },
      ]],
      ['WINDOW', [
        { label: 'Left Panel', checked: () => !E.ui.collapsed.left, fn: () => this.togglePanel('left') },
        { label: 'Right Panel', checked: () => !E.ui.collapsed.right, fn: () => this.togglePanel('right') },
        { label: 'Bottom Panel', sc: 'Ctrl+B', checked: () => Bottom.visible(), fn: () => this.toggleBottom() },
        'sep',
        { label: 'Timeline', fn: () => this.showBottomTab('timeline') },
        { label: 'Animation', fn: () => this.showBottomTab('animation') },
        { label: 'VFX', fn: () => this.showBottomTab('vfx') },
        { label: 'Console', fn: () => this.showBottomTab('console') },
        { label: 'Output', fn: () => this.showBottomTab('output') },
        'sep',
        { label: 'Reset Layout', fn: () => this.resetLayout() },
        { label: 'Fullscreen', fn: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); } },
      ]],
      ['HELP', [
        { label: 'Keyboard Shortcuts', sc: 'Ctrl+/', fn: () => Screens.shortcuts() },
        { label: 'Quick Start Guide', fn: () => Screens.guide() },
        { label: 'Data Format Reference', fn: () => Screens.formatReference() },
        { label: 'About the Game Data Snapshot', fn: () => Screens.aboutGameData() },
        'sep',
        { label: 'About MYTHLING EDIT', fn: () => Screens.about() },
      ]],
    ];
  },
  buildMenus() {
    const root = clear($('#menu-root'));
    for (const [title, items] of this.menuDefs()) {
      const btn = h('button', { class: 'menu-btn', text: title });
      const dd = h('div', { class: 'dropdown hidden' });
      const wrap = h('div', { class: 'menu-wrap', style: { position: 'relative' } }, [btn, dd]);
      const open = () => { this.closeMenus(); this.renderDropdown(dd, items); dd.classList.remove('hidden'); btn.classList.add('open'); this.openMenu = { dd, btn }; };
      btn.addEventListener('click', (e) => { e.stopPropagation(); if (this.openMenu && this.openMenu.dd === dd) this.closeMenus(); else open(); });
      btn.addEventListener('mouseenter', () => { if (this.openMenu && this.openMenu.dd !== dd) open(); });
      root.appendChild(wrap);
    }
    document.addEventListener('mousedown', (e) => { if (this.openMenu && !e.target.closest('.menu-wrap')) this.closeMenus(); });
  },
  renderDropdown(dd, items) {
    clear(dd);
    for (const it of items) {
      if (it === 'sep') { dd.appendChild(h('div', { class: 'sep' })); continue; }
      const disabled = it.disabled ? it.disabled() : (!E.project && !['New Project…', 'Open Project File…', 'Open Recent', 'Project Browser (Start Screen)', 'Keyboard Shortcuts', 'Quick Start Guide', 'About MYTHLING EDIT', 'Data Format Reference'].includes(it.label));
      const checked = it.checked && E.project ? it.checked() : false;
      const el = h('div', { class: `mi ${disabled ? 'disabled' : ''} ${it.sub ? 'has-sub' : ''}`, html: `<span class="chk">${checked ? '✓' : ''}</span><span class="lbl">${escapeHtml(it.label)}</span>${it.sc ? `<span class="sc">${it.sc}</span>` : ''}${it.sub ? '<span class="sc">▸</span>' : ''}` });
      if (it.sub && !disabled) {
        const sub = h('div', { class: 'dropdown sub hidden' });
        el.addEventListener('mouseenter', () => { const items2 = typeof it.sub === 'function' ? it.sub() : it.sub; this.renderDropdown(sub, items2.length ? items2 : [{ label: '(empty)', disabled: () => true }]); sub.classList.remove('hidden'); });
        el.addEventListener('mouseleave', () => sub.classList.add('hidden'));
        el.appendChild(sub);
      } else if (!disabled) el.addEventListener('click', (e) => { e.stopPropagation(); this.closeMenus(); try { it.fn && it.fn(); } catch (err) { console.error(err); toast(err.message, 'err'); } });
      dd.appendChild(el);
    }
  },
  closeMenus() { if (this.openMenu) { this.openMenu.dd.classList.add('hidden'); this.openMenu.btn.classList.remove('open'); this.openMenu = null; } },
  // ------------------------------------------------------------- toolbar
  toolbarDefs() {
    const creature = isCreatureMode();
    const groups = [
      ['select', 'move', 'rotate', 'scale'],
      ['draw', 'rectangle', 'ellipse', 'polygon', 'path', 'eraser'],
      creature ? ['anchor', 'pivot', 'collision'] : ['collision'],
    ];
    if (!creature && E.project) groups.push(['paint', 'spawn', 'warp', 'trigger', 'zone']);
    return groups;
  },
  buildToolbar() {
    const tb = clear($('#toolbar'));
    if (!E.project) return;
    const iconFor = { select: 'select', move: 'move', rotate: 'rotate', scale: 'scale', draw: 'draw', rectangle: 'rect', ellipse: 'ellipse', polygon: 'polygon', path: 'path', eraser: 'erase', anchor: 'anchor', pivot: 'pivot', collision: 'collision', paint: 'paint', spawn: 'spawn', warp: 'warp', trigger: 'trigger', zone: 'target' };
    for (const g of this.toolbarDefs()) {
      const grp = h('div', { class: 'tool-group' });
      for (const t of g) {
        const info = TOOL_INFO[t];
        const b = h('button', { class: `tool ${E.tool === t ? 'active' : ''}`, title: `${info.name} (${info.key}) — ${info.hint}`, dataset: { tool: t }, onclick: () => this.setTool(t) }, [icon(iconFor[t] || 'point'), h('span', { class: 'tl', text: info.name })]);
        grp.appendChild(b);
      }
      tb.appendChild(grp);
    }
    // paint sub-tools appear in the sub toolbar (float) — here: playtest, undo/redo, save
    tb.appendChild(h('div', { class: 'tool-group' }, [
      h('button', { class: 'tool primary', title: 'PLAYTEST (F5) — walk the map or test the creature', onclick: () => Playtest.start(isCreatureMode() ? 'creature' : 'map') }, [icon('play'), h('span', { class: 'tl', text: 'PLAYTEST' })]),
    ]));
    tb.appendChild(h('div', { class: 'tool-group' }, [
      h('button', { class: 'tool', title: 'UNDO (Ctrl+Z)', onclick: () => History.undo() }, [icon('undo'), h('span', { class: 'tl', text: 'UNDO' })]),
      h('button', { class: 'tool', title: 'REDO (Ctrl+Y)', onclick: () => History.redo() }, [icon('redo'), h('span', { class: 'tl', text: 'REDO' })]),
    ]));
    tb.appendChild(h('div', { class: 'tool-group' }, [
      h('button', { class: 'tool', id: 'tb-save', title: 'SAVE (Ctrl+S)', onclick: () => App.save() }, [icon('save'), h('span', { class: 'tl', text: 'SAVE' })]),
    ]));
    // mode switcher on the right
    const modes = [['map', 'WORLD', 'map'], ['browser', 'MYTHLINGS', 'creature'], ['creature', 'DESIGN', 'bone'], ['animation', 'ANIMATION', 'film'], ['vfx', 'VFX', 'vfx'], ['skills', 'SKILLS', 'star'], ['evolution', 'EVOLUTION', 'up'], ['export', 'EXPORT', 'export']];
    const ms = h('div', { class: 'tool-group modes' });
    for (const [m, label, ic] of modes) ms.appendChild(h('button', { class: `tool ${E.mode === m || (m === 'vfx' && E.mode === 'vfxlib') ? 'active' : ''}`, title: `${label} mode`, onclick: () => this.setMode(m) }, [icon(ic), h('span', { class: 'tl', text: label })]));
    tb.appendChild(h('div', { class: 'spacer' }));
    tb.appendChild(ms);
    this.renderSubToolbar();
  },
  renderToolbar() { this.buildToolbar(); },
  renderSubToolbar() {
    const st = clear($('#sub-toolbar'));
    if (!E.project || E.playtest) { st.classList.add('hidden'); return; }
    const chip = (label, active, fn, title = '') => h('button', { class: `btn tiny ${active ? 'primary' : 'ghost'}`, text: label, title, onclick: fn });
    if (E.tool === 'paint' && !isCreatureMode()) {
      st.classList.remove('hidden');
      for (const [id, label] of [['paint', 'PAINT'], ['erase', 'ERASE'], ['fill', 'FILL'], ['replace', 'REPLACE'], ['rect', 'RECTANGLE'], ['water', 'WATER'], ['pick', 'PICK']]) st.appendChild(chip(label, E.subTool === id, () => { E.subTool = id; this.renderSubToolbar(); Left.render(); }));
      st.appendChild(h('span', { class: 'dim', text: 'BRUSH' }));
      for (const b of [1, 2, 4, 8, 16]) st.appendChild(chip(String(b), E.brushSize === b, () => { E.brushSize = b; this.renderSubToolbar(); Left.render(); Scene.invalidate(); }));
      st.appendChild(h('span', { class: 'dim', text: `TERRAIN: ${TERRAINS[TERRAIN_INDEX[E.terrain]]?.name || E.terrain}` }));
      return;
    }
    if (E.tool === 'collision' && !isCreatureMode()) {
      st.classList.remove('hidden');
      for (const m of COLLISION_MODES) { const b = chip(m.name.toUpperCase(), E.collisionMode === m.value, () => { E.collisionMode = m.value; this.renderSubToolbar(); Left.render(); Scene.invalidate(); }); b.style.borderColor = m.color; if (E.collisionMode === m.value) { b.style.background = m.color; b.style.color = '#0b0f14'; } st.appendChild(b); }
      st.appendChild(h('span', { class: 'dim', text: '|' }));
      for (const [id, label] of [['paint', 'BRUSH'], ['rect', 'RECTANGLE'], ['fill', 'FILL']]) st.appendChild(chip(label, E.subTool === id, () => { E.subTool = id; this.renderSubToolbar(); }));
      for (const b of [1, 2, 4, 8, 16]) st.appendChild(chip(String(b), E.brushSize === b, () => { E.brushSize = b; this.renderSubToolbar(); Scene.invalidate(); }));
      st.appendChild(h('span', { class: 'dim', text: 'Alt+drag = clear · select an object to edit its collision shape' }));
      return;
    }
    if (E.tool === 'spawn') { st.classList.remove('hidden'); for (const k of ['player', 'npc', 'mythling']) st.appendChild(chip(k.toUpperCase(), E.spawnKind === k, () => { E.spawnKind = k; this.renderSubToolbar(); Left.render(); })); return; }
    if (['polygon', 'path'].includes(E.tool)) { st.classList.remove('hidden'); st.appendChild(h('span', { class: 'dim', text: TOOL_INFO[E.tool].hint })); st.appendChild(chip('FINISH (Enter)', false, () => Tools.finishDraft())); st.appendChild(chip('CANCEL (Esc)', false, () => Tools.cancelDraft())); return; }
    if (isCreatureMode() && E.mode !== 'browser') {
      st.classList.remove('hidden');
      st.appendChild(chip('COMPARE', E.compare, () => { E.compare = !E.compare; this.renderSubToolbar(); Scene.invalidate(); }, 'Before/After — ghost of the rest pose (Q)'));
      st.appendChild(chip('ANCHORS', settings().showAnchors, () => this.toggleSetting('showAnchors')));
      st.appendChild(chip('PIVOTS', settings().showPivots, () => this.toggleSetting('showPivots')));
      if (E.mode === 'animation' || E.mode === 'vfx' || E.mode === 'skills') st.appendChild(chip('TARGET', settings().showTarget !== false, () => { settings().showTarget = settings().showTarget === false; this.renderSubToolbar(); Scene.invalidate(); }));
      if (this.hint) st.appendChild(h('span', { class: 'dim', text: this.hint }));
      return;
    }
    if (this.hint) { st.classList.remove('hidden'); st.appendChild(h('span', { class: 'dim', text: this.hint })); return; }
    st.classList.add('hidden');
  },
  setHint(t) { this.hint = t; this.renderSubToolbar(); },
  // ------------------------------------------------------------- header / status
  bindHeader() {
    $('#zoom-in').onclick = () => Scene.zoomBy(1.25);
    $('#zoom-out').onclick = () => Scene.zoomBy(0.8);
    $('#zoom-label').onclick = () => Scene.setZoom(1);
    $('#zoom-fit').onclick = () => Scene.fit();
    $('#left-collapsed').querySelector('button').onclick = () => this.togglePanel('left');
    $('#right-collapsed').querySelector('button').onclick = () => this.togglePanel('right');
    $('#bottom-collapsed').querySelector('button').onclick = () => this.toggleBottom(true);
  },
  updateZoom() { const z = `${Math.round(E.view.zoom * 100)}%`; $('#zoom-label').textContent = z; $('#s-zoom').textContent = `Zoom: ${z}`; },
  updateCursor() { const t = `X: ${Math.round(E.cursor.x)}  Y: ${Math.round(E.cursor.y)}`; $('#coord').textContent = t; $('#s-cursor').textContent = t; },
  updateStatus() {
    if (!E.project) return;
    const doc = currentDoc();
    $('#s-tool').textContent = E.playtest ? 'PLAYTEST' : (TOOL_INFO[E.tool]?.name || E.tool.toUpperCase());
    $('#s-mode').textContent = `${MODE_LABELS[E.mode] || E.mode.toUpperCase()}${E.mode === 'map' && currentMap() ? ` · ${currentMap().name}` : isCreatureMode() && currentMythling() ? ` · ${currentMythling().name}` : ''}`;
    $('#s-objects').textContent = `Objects: ${doc ? Object.keys(doc.nodes).length : 0}`;
    $('#s-selected').textContent = `Selected: ${E.selection.length}${E.selection.length === 1 && primarySelected() ? ` (${primarySelected().name})` : ''}`;
    const s = $('#s-save'); s.textContent = E.dirty ? 'UNSAVED CHANGES' : `SAVED${E.project.project.lastSaved ? ' · ' + new Date(E.project.project.lastSaved).toLocaleTimeString() : ''}`; s.className = `s-save ${E.dirty ? 'unsaved' : 'saved'}`;
    $('#mr-project').textContent = `${E.project.project.name} · v${E.project.project.version} · ${E.project.project.changeCount || 0} changes`;
    const tbs = $('#tb-save'); if (tbs) tbs.classList.toggle('warn', E.dirty);
    this.updateZoom();
  },
  updateHeader() {
    const label = E.playtest ? 'PLAYTEST MODE' : E.tool === 'collision' && E.mode === 'map' ? 'COLLISION EDITOR' : (MODE_LABELS[E.mode] || E.mode.toUpperCase());
    $('#mode-label').textContent = label;
    const crumb = clear($('#crumb'));
    if (!E.project) return;
    if (E.mode === 'map' || E.playtest?.kind === 'map') {
      const sel = h('select', { class: 'map-select', title: 'Switch map', onchange: (e) => this.openMap(e.target.value) });
      for (const m of Object.values(E.project.maps)) sel.appendChild(h('option', { value: m.id, selected: m.id === E.mapId, text: `${m.name}  (${m.width}×${m.height})` }));
      sel.appendChild(h('option', { value: '__new', text: '+ New Map…' }));
      sel.onchange = (e) => { if (e.target.value === '__new') { e.target.value = E.mapId; Screens.newMap(); } else this.openMap(e.target.value); };
      crumb.appendChild(sel);
    } else if (isCreatureMode()) {
      const sel = h('select', { class: 'map-select', title: 'Switch Mythling' });
      for (const m of Object.values(E.project.mythlings)) sel.appendChild(h('option', { value: m.id, selected: m.id === E.mythlingId, text: `${m.name}  (${m.element} · ${m.rarity})` }));
      sel.appendChild(h('option', { value: '__new', text: '+ New Mythling…' }));
      sel.onchange = (e) => { if (e.target.value === '__new') { e.target.value = E.mythlingId; Screens.newMythling(); } else this.openMythling(e.target.value, E.mode); };
      crumb.appendChild(sel);
      if (E.mode === 'animation' && currentMythling()) {
        const as = h('select', { class: 'map-select', title: 'Animation clip' });
        for (const id of currentMythling().animations) { const a = E.project.animations[id]; if (a) as.appendChild(h('option', { value: id, selected: id === E.animId, text: a.name })); }
        as.onchange = (e) => this.setAnimation(e.target.value);
        crumb.appendChild(as);
      }
      if (E.mode === 'vfx') {
        const vs = h('select', { class: 'map-select', title: 'VFX' });
        for (const v of Object.values(E.project.vfx)) vs.appendChild(h('option', { value: v.id, selected: v.id === E.vfxId, text: `${v.name} (${v.category})` }));
        vs.onchange = (e) => { E.vfxId = e.target.value; this.refreshAll(); };
        crumb.appendChild(vs);
      }
    }
  },
  // ------------------------------------------------------------- modes / documents
  setMode(mode, { keepSelection = false } = {}) {
    if (!E.project) return;
    if (E.playtest) Playtest.stop();
    Tools.cancelDraft();
    const prev = E.mode;
    if (['map', 'creature', 'animation', 'vfx'].includes(prev)) E.lastEditMode = prev;
    const wasCreature = isCreatureMode();
    E.mode = mode;
    E.playing = false;
    if (isCreatureMode() && !E.project.mythlings[E.mythlingId]) E.mythlingId = Object.keys(E.project.mythlings)[0] || null;
    if (mode === 'map' && !E.project.maps[E.mapId]) E.mapId = Object.keys(E.project.maps)[0] || null;
    if (isCreatureMode() && !wasCreature) { E.savedMapView = { ...E.view }; }
    if (isCreatureMode() && !wasCreature && E.savedCreatureView) E.view = { ...E.savedCreatureView };
    if (!isCreatureMode() && wasCreature) { E.savedCreatureView = { ...E.view }; if (E.savedMapView) E.view = { ...E.savedMapView }; }
    if (isCreatureMode() !== wasCreature && !keepSelection) E.selection = [];
    if (isCreatureMode() && !['anchor', 'pivot', 'select', 'move', 'rotate', 'scale', 'draw', 'rectangle', 'ellipse', 'polygon', 'path', 'eraser'].includes(E.tool)) E.tool = 'select';
    if (!isCreatureMode() && ['anchor', 'pivot'].includes(E.tool)) E.tool = 'select';
    if (mode === 'animation') { const my = currentMythling(); if (my && !my.animations.includes(E.animId)) E.animId = my.animations[0] || null; E.playhead = 0; Bottom.show('timeline'); }
    else if (mode === 'vfx') { if (!E.project.vfx[E.vfxId]) E.vfxId = Object.keys(E.project.vfx)[0] || null; E.animId = null; Bottom.show('vfx'); }
    else if (mode === 'skills') { if (!E.project.skills[E.skillId]) E.skillId = Object.keys(E.project.skills)[0] || null; E.animId = null; }
    else if (mode === 'creature') { E.animId = null; }
    else if (mode === 'map') { E.animId = null; }
    if (['browser', 'evolution', 'skills', 'export', 'vfxlib'].includes(mode)) Screens.show(mode); else Screens.hide();
    invalidateMatrices();
    if (isCreatureMode() && !wasCreature && !E.savedCreatureView) setTimeout(() => Scene.fit(), 0);
    const TARGET_MODES = ['vfx', 'skills', 'animation'];
    if (wasCreature && isCreatureMode() && TARGET_MODES.includes(prev) !== TARGET_MODES.includes(mode)) setTimeout(() => Scene.fit(), 0); // dummy appears / disappears → reframe
    if (mode === 'map' && wasCreature && !E.savedMapView) setTimeout(() => Scene.fit(), 0);
    this.refreshAll();
  },
  ensureCreature() { if (!isCreatureMode() || E.mode === 'browser') this.setMode('creature'); },
  openMap(id) { if (!E.project.maps[id]) return; const changed = E.mapId !== id; E.mapId = id; E.selection = []; E.savedMapView = null; this.setMode('map'); if (changed) setTimeout(() => Scene.fit(), 0); },
  openMythling(id, mode = 'creature') { if (!E.project.mythlings[id]) return; E.mythlingId = id; E.selection = []; E.animId = null; this.setMode(mode); },
  setAnimation(id) { E.animId = id; E.playhead = 0; E.selectedKey = null; invalidateMatrices(); this.updateHeader(); Bottom.render(); Scene.invalidate(); },
  setTool(tool) {
    if (!TOOL_INFO[tool]) return;
    if (isCreatureMode() && ['paint', 'spawn', 'warp', 'trigger', 'zone'].includes(tool)) { toast('That tool is for the map editor', 'warn'); return; }
    if (!isCreatureMode() && ['anchor'].includes(tool)) { toast('Anchors are edited in the creature editor', 'warn'); return; }
    Tools.cancelDraft();
    E.tool = tool; E.activeVertex = null;
    if (tool === 'paint') { E.subTool = ['paint', 'erase', 'fill', 'replace', 'rect', 'water', 'pick'].includes(E.subTool) ? E.subTool : 'paint'; this.showLeftTab('terrain'); }
    else if (tool === 'collision' && !isCreatureMode()) { E.subTool = ['paint', 'rect', 'fill'].includes(E.subTool) ? E.subTool : 'paint'; this.showLeftTab('collision'); this.showRightTab(E.selection.length ? 'collision' : E.ui.rightTab); }
    else if (tool === 'spawn') this.showLeftTab('spawn');
    else if (E.ui.leftTab === 'terrain' || E.ui.leftTab === 'spawn' || E.ui.leftTab === 'collision') this.showLeftTab(isCreatureMode() ? 'parts' : 'hierarchy');
    $$('#toolbar .tool[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
    this.renderSubToolbar(); Tools.updateCursor(); this.updateStatus(); this.updateHeader(); Scene.invalidate();
  },
  toggleSetting(key) { const S = settings(); S[key] = !S[key]; Scene.invalidate(); this.renderSubToolbar(); Left.render(); toast(`${titleCase(key.replace(/^show/, 'Show '))}: ${S[key] ? 'ON' : 'OFF'}`, '', 1200); },
  selectAll() { const doc = currentDoc(); if (!doc) return; select(allNodes(doc).filter((n) => n.visible && !n.locked && (n.type !== 'anchor' || settings().showAnchors)).map((n) => n.id)); },
  cycleSelection(dir) { const list = drawOrder().filter((n) => n.visible && !n.locked); if (!list.length) return; const cur = primarySelected(); let i = cur ? list.indexOf(cur) : -1; i = (i + dir + list.length) % list.length; select(list[i].id); },
  async renameSelected() { const n = primarySelected(); if (!n) return; const name = await promptDialog('Rename', 'Name', n.name); if (name && name !== n.name) Ops.rename(n.id, name.trim()); },
  showLeftTab(tab) { E.ui.leftTab = tab; Left.render(); },
  showRightTab(tab) { E.ui.rightTab = tab; Right.render(); },
  showBottomTab(tab) { Bottom.show(tab); },
  toggleBottom(forceOpen = false) { if (forceOpen || !Bottom.visible()) Bottom.show(E.ui.bottomTab || 'timeline'); else Bottom.hide(); },
  togglePanel(side) {
    E.ui.collapsed[side] = !E.ui.collapsed[side];
    $('#app').classList.toggle(`${side}-collapsed`, E.ui.collapsed[side]);
    setTimeout(() => Scene.resize(), 0);
  },
  resetLayout() { const app = $('#app'); app.style.removeProperty('--left-w'); app.style.removeProperty('--right-w'); app.style.removeProperty('--bottom-h'); E.ui.collapsed = { left: false, right: false, bottom: false }; app.classList.remove('left-collapsed', 'right-collapsed', 'bottom-collapsed'); localStorage.removeItem('me_layout'); setTimeout(() => Scene.resize(), 0); },
  bindSplitters() {
    const app = $('#app');
    try { const saved = JSON.parse(localStorage.getItem('me_layout') || '{}'); if (saved.left) app.style.setProperty('--left-w', `${saved.left}px`); if (saved.right) app.style.setProperty('--right-w', `${saved.right}px`); if (saved.bottom) app.style.setProperty('--bottom-h', `${saved.bottom}px`); } catch { /* ignore */ }
    const persist = () => { const cs = getComputedStyle(app); localStorage.setItem('me_layout', JSON.stringify({ left: parseInt(cs.getPropertyValue('--left-w')) || 0, right: parseInt(cs.getPropertyValue('--right-w')) || 0, bottom: parseInt(cs.getPropertyValue('--bottom-h')) || 0 })); };
    const drag = (el, onMove) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); el.setPointerCapture(e.pointerId);
        const move = (ev) => { onMove(ev); Scene.resize(); };
        const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); persist(); };
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
      });
      el.addEventListener('dblclick', () => { if (el.id === 'lsplit') this.togglePanel('left'); else if (el.id === 'rsplit') this.togglePanel('right'); else this.toggleBottom(); });
    };
    drag($('#lsplit'), (e) => app.style.setProperty('--left-w', `${clamp(e.clientX, 240, 520)}px`));
    drag($('#rsplit'), (e) => app.style.setProperty('--right-w', `${clamp(window.innerWidth - e.clientX, 260, 600)}px`));
    drag($('#bsplit'), (e) => app.style.setProperty('--bottom-h', `${clamp(window.innerHeight - e.clientY - 24, 140, 600)}px`));
  },
  // ------------------------------------------------------------- refresh
  refreshAll() {
    if (!E.project) return;
    this.buildToolbar();
    this.updateHeader();
    Left.render(); Right.render(); Bottom.render();
    Screens.refresh();
    this.updateStatus(); Tools.updateCursor();
    Scene.invalidate();
  },
  onSelectionChanged() {
    E.activeVertex = null;
    if (E.mode === 'map' && E.selection.length === 1 && primarySelected()?.type === 'npc' && E.ui.rightTab === 'transform') { /* keep */ }
    Left.syncSelection(); Right.render();
    if (Bottom.visible() && E.ui.bottomTab === 'timeline') Bottom.render();
    this.updateStatus(); Scene.invalidate();
  },
};
