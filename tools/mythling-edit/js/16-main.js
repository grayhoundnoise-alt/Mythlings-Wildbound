// =============================================================================
// App: start screen, project lifecycle, persistence, autosave, snapshots, boot
// =============================================================================
const App = {
  autosaveTimer: null, autosaveDue: 0, booted: false,
  // ------------------------------------------------------------- start screen
  async showStart() {
    const start = $('#start'); start.classList.remove('hidden'); clear(start);
    let recent = []; try { recent = await Store.getKV('recent', []); } catch (e) { ConsoleLog.error('Storage error: ' + e.message); }
    E.recent = recent;
    const storageNote = Store.fallback ? 'Storage: localStorage fallback (IndexedDB unavailable). Export your project as a file regularly.' : 'Storage: IndexedDB (this browser profile). Export a project file to move it elsewhere.';
    const recentList = h('div', { class: 'recent-list' }, recent.length ? recent.map((r) => h('div', { class: 'recent-row', onclick: () => this.openProjectId(r.id) }, [
      h('div', { class: 'grow' }, [h('div', { class: 'name', text: r.name }), h('div', { class: 'meta', text: `v${r.version || 1} · ${r.maps ?? '?'} maps · ${r.mythlings ?? '?'} mythlings · saved ${fmtDate(r.lastSaved)}` })]),
      h('button', { class: 'btn tiny ghost', text: 'DELETE', title: 'Delete this project from browser storage', onclick: async (ev) => { ev.stopPropagation(); if (await confirmDialog('Delete Project', `Delete "${escapeHtml(r.name)}" from browser storage? This cannot be undone.`, 'DELETE', 'CANCEL', true)) { await Store.deleteProject(r.id); this.showStart(); } } }),
    ])) : [h('div', { class: 'empty', text: 'No recent projects yet. Create a new project or open a project file.' })]);
    start.appendChild(h('div', { class: 'start-card' }, [
      h('div', { class: 'start-logo' }, [h('div', { class: 'title' }, [h('span', { class: 'accent', text: 'MYTHLING' }), ' EDIT']), h('div', { class: 'sub', text: 'Mythlings: Wildbound — Creature, Map & Animation Editor' }), h('div', { class: 'ver', text: `v${EDITOR_VERSION} · project format ${PROJECT_FORMAT_VERSION} · works fully offline` })]),
      h('div', { class: 'start-cols' }, [
        h('div', { class: 'start-actions' }, [
          h('button', { class: 'btn big primary', onclick: () => this.newProject(), title: 'Create a new project (Ctrl+N)' }, [icon('plus'), ' NEW PROJECT']),
          h('button', { class: 'btn big', onclick: () => this.openFile(), title: 'Open a .json project file exported by MYTHLING EDIT (Ctrl+O)' }, [icon('folder'), ' OPEN PROJECT FILE']),
          h('button', { class: 'btn big', onclick: () => this.newProject({ demo: true }), title: 'Start from the bundled demo (Verdant Vale, Azure Coast, Emberwild + 5 template Mythlings)' }, [icon('sparkles'), ' NEW FROM DEMO CONTENT']),
          h('div', { class: 'hint', text: storageNote }),
          h('div', { class: 'hint', text: 'Tip: F1 or HELP → Keyboard Shortcuts. Everything you edit stays in this file; the game is never modified.' }),
        ]),
        h('div', { class: 'start-recent' }, [h('div', { class: 'panel-head' }, [h('span', { class: 'title', text: 'RECENT PROJECTS' }), h('span', { class: 'sub', text: `${recent.length}` })]), recentList]),
      ]),
    ]));
  },
  hideStart() { $('#start').classList.add('hidden'); },
  // ------------------------------------------------------------- project lifecycle
  async newProject(opts = {}) {
    if (E.project && E.dirty) { const ok = await confirmDialog('Unsaved Changes', 'You have unsaved changes. Save them before creating a new project?', 'SAVE & CONTINUE', 'DISCARD'); if (ok) await this.save(); }
    const body = h('div', { class: 'form-grid' });
    const st = { name: 'My Wildbound Project', demo: opts.demo ?? true, templates: true };
    body.append(fText('Project name', () => st.name, (v) => { st.name = v; }), fCheck('Include demo content (3 maps, demo NPCs, warps, zones)', () => st.demo, (v) => { st.demo = v; }), fCheck('Preload Mythling templates (Spriggo, Aquini, Emberu, Rivruff, Leaflet)', () => st.templates, (v) => { st.templates = v; }));
    const r = await dialog({ title: 'NEW PROJECT', body, buttons: [{ label: 'CANCEL', value: null }, { label: 'CREATE', value: 'ok', primary: true }] });
    if (r !== 'ok') return;
    let project;
    if (st.demo) { project = buildDemoProject(); project.project.name = st.name || 'Untitled'; project.project.id = uid('proj'); if (!st.templates) { for (const id of Object.keys(project.mythlings)) if (id !== 'spriggo') this.stripMythling(project, id); } }
    else { project = emptyProject(st.name || 'Untitled'); if (st.templates) { for (const key of Object.keys(SPECIES_TEMPLATES)) { const my = createMythlingFromTemplate(key); project.mythlings[my.id] = my; attachDefaultAnimations(project, my); } for (const v of defaultVFX()) project.vfx[v.id] = v; project.skills = defaultSkills(); } const m = newMap({ name: 'New Map', width: 1600, height: 1000 }); project.maps[m.id] = m; }
    await this.loadIntoEditor(project, { fresh: true });
    toast(`Project "${project.project.name}" created`, 'ok');
    await this.save(); // persist immediately so it appears in RECENT
  },
  stripMythling(project, id) { const my = project.mythlings[id]; if (!my) return; for (const a of my.animations) delete project.animations[a]; delete project.mythlings[id]; for (const m of Object.values(project.maps)) for (const n of Object.values(m.nodes)) { if (n.type === 'mythling' && n.mythling.species === id) n.mythling.species = 'spriggo'; if (n.type === 'zone') n.zone.species = n.zone.species.filter((s) => s !== id); } },
  async openProjectId(id) {
    try {
      const data = await Store.loadProject(id);
      if (!data) { toast('Project not found in storage', 'err'); const recent = (await Store.getKV('recent', [])).filter((r) => r.id !== id); await Store.setKV('recent', recent); this.showStart(); return; }
      await this.loadIntoEditor(data);
      toast(`Opened "${data.project.name}"`, 'ok');
    } catch (e) { ConsoleLog.error('Open failed: ' + e.message); toast('Could not open project: ' + e.message, 'err'); }
  },
  async openFile() {
    const file = await pickFile('.json,application/json'); if (!file) return;
    await this.importProjectFile(file);
  },
  async importProjectFile(file) {
    if (!file) { file = await pickFile('.json,application/json'); if (!file) return; }
    let text; try { text = await readAsText(file); } catch (e) { toast('Could not read file: ' + e.message, 'err'); return; }
    let data;
    try { data = JSON.parse(text); }
    catch (e) { const m = /position (\d+)/.exec(e.message); const pos = m ? +m[1] : -1; const line = pos >= 0 ? text.slice(0, pos).split('\n').length : '?'; await dialog({ title: 'INVALID JSON', body: h('div', {}, [h('p', { text: `The file "${file.name}" is not valid JSON.` }), h('pre', { class: 'ref', text: `${e.message}${pos >= 0 ? `\nLine ${line}, character ${pos}\n…${text.slice(Math.max(0, pos - 60), pos)}⟵HERE⟶${text.slice(pos, pos + 40)}…` : ''}` })]), buttons: [{ label: 'OK', value: 1, primary: true }] }); return; }
    if (!data || typeof data !== 'object') { toast('File does not contain a project object', 'err'); return; }
    // Accept single-item exports too (map / mythling) by merging into the current project
    if (!data.project && (data.nodes || data.rig) && E.project) { this.importItem(data, file.name); return; }
    if (!data.project) { data = { project: { id: uid('proj'), name: file.name.replace(/\.json$/i, ''), format: PROJECT_FORMAT_VERSION }, ...data }; }
    if (E.project && E.dirty) { const ok = await confirmDialog('Unsaved Changes', 'You have unsaved changes in the current project. Save them before opening?', 'SAVE & OPEN', 'DISCARD'); if (ok) await this.save(); }
    try {
      await this.loadIntoEditor(data);
      toast(`Imported "${E.project.project.name}"`, 'ok');
      await this.save();
    } catch (e) { ConsoleLog.error('Import failed: ' + e.message); toast('Import failed: ' + e.message, 'err'); if (!E.project) this.showStart(); }
  },
  importItem(data, fileName) {
    try {
      if (data.rig) { // mythling export
        const my = deepClone(data); my.id = E.project.mythlings[my.id] ? `${my.id}_${uid('').slice(-4)}` : my.id;
        const rigNodes = {}; for (const n of [...(my.rig.nodes || []), ...(my.rig.anchors || []).map((a) => ({ id: a.id, type: 'anchor', name: a.name, parent: a.parent, x: a.x, y: a.y, rotation: a.rotation, fill: a.color }))]) rigNodes[n.id] = normalizeNode(n);
        for (const n of Object.values(rigNodes)) if (n.parent && rigNodes[n.parent] && !rigNodes[n.parent].children.includes(n.id)) rigNodes[n.parent].children.push(n.id);
        my.rig = { nodes: rigNodes, root: Array.isArray(my.rig.root) && my.rig.root.length ? my.rig.root : Object.values(rigNodes).filter((n) => !n.parent).map((n) => n.id) };
        const animIds = []; for (const a of my.animations || []) { if (typeof a === 'string') { animIds.push(a); continue; } const clip = { id: a.id || uid('anim'), name: a.name, mythlingId: my.id, duration: a.duration, loop: a.loop, fps: a.fps, easing: a.easing, tracks: Object.fromEntries(Object.entries(a.tracks || {}).map(([id, t]) => [id, Array.isArray(t) ? t : t.keys])) }; E.project.animations[clip.id] = clip; animIds.push(clip.id); }
        my.animations = animIds;
        const vfxIds = []; for (const v of my.vfx || []) { if (typeof v === 'string') { vfxIds.push(v); continue; } E.project.vfx[v.id] = v; vfxIds.push(v.id); } my.vfx = vfxIds;
        History.run('Import Mythling', () => { E.project.mythlings[my.id] = my; });
        UI.openMythling(my.id); toast(`Imported Mythling "${my.name}" from ${fileName}`, 'ok');
      } else if (data.nodes && data.width) { // map export
        const map = newMap({ name: data.name, width: data.width, height: data.height, theme: data.theme, music: data.music, weather: data.weather, background: data.background, levelMin: data.levelMin, levelMax: data.levelMax });
        map.id = E.project.maps[data.id] ? `${data.id}_${uid('').slice(-4)}` : data.id || map.id;
        const dec = (g) => (g && g.encoding === 'rle' ? g.data.reduce((out, v, i, arr) => { if (i % 2 === 0) for (let k = 0; k < arr[i + 1]; k++) out.push(v); return out; }, []) : g);
        if (data.terrain) map.terrain = dec(data.terrain); if (data.collision) map.collision = dec(data.collision);
        if (data.layers) map.layers = data.layers; if (data.camera) map.camera = data.camera;
        map.nodes = {}; for (const n of data.nodes) map.nodes[n.id] = normalizeNode(n); map.root = data.root || Object.values(map.nodes).filter((n) => !n.parent).map((n) => n.id);
        History.run('Import map', () => { E.project.maps[map.id] = map; });
        UI.openMap(map.id); toast(`Imported map "${map.name}" from ${fileName}`, 'ok');
      } else if (data.nodes) { // object export
        const o = deepClone(data); o.id = o.id && !E.project.objects[o.id] ? o.id : uid('obj'); const nodes = {}; for (const n of o.nodes) nodes[n.id] = normalizeNode(n); o.nodes = nodes; o.root = o.root || Object.values(nodes).filter((n) => !n.parent).map((n) => n.id);
        History.run('Import object', () => { E.project.objects[o.id] = o; }); UI.showLeftTab('library'); toast(`Imported object "${o.name}"`, 'ok');
      } else toast('Unrecognised export file', 'warn');
    } catch (e) { ConsoleLog.error('Item import failed: ' + e.message); toast('Import failed: ' + e.message, 'err'); }
  },
  async loadIntoEditor(project, { fresh = false } = {}) {
    const fixes = migrateProject(project);
    if (fixes.length) { ConsoleLog.warn(`Project repaired on load (${fixes.length}): ${fixes.slice(0, 8).join('; ')}${fixes.length > 8 ? '…' : ''}`); }
    if (!Object.keys(project.maps).length) { const m = newMap({ name: 'New Map' }); project.maps[m.id] = m; }
    if (!project.snapshots) project.snapshots = [];
    E.project = project; E.dirty = false; E.playtest = null;
    History.undoStack.length = 0; History.redoStack.length = 0; History.pending = null;
    E.selection = []; E.selectedKey = null; E.hover = null; E.dragging = null; E.clipboard = null; E.keyClipboard = null; E.compare = null;
    AssetCache.clear();
    const firstMap = Object.keys(project.maps)[0];
    E.mapId = firstMap; E.mythlingId = Object.keys(project.mythlings)[0] || null; E.animId = null; E.vfxId = Object.keys(project.vfx)[0] || null; E.skillId = Object.keys(project.skills || {})[0] || null;
    E.tool = 'select'; E.playhead = 0; E.playing = false; E.ui.bottomShown = false; E.ui.leftTab = 'hierarchy'; E.ui.rightTab = 'properties';
    this.hideStart(); Screens.hide();
    if (!this.booted) this.bootUI();
    UI.setMode('map'); UI.refreshAll(); Scene.resize(); Scene.fit();
    document.title = `MYTHLING EDIT — ${project.project.name}`;
    this.scheduleAutosave();
    ConsoleLog.info(`${fresh ? 'Created' : 'Loaded'} project "${project.project.name}" (v${project.project.version}, ${Object.keys(project.maps).length} maps, ${Object.keys(project.mythlings).length} mythlings)`);
  },
  async closeProject() {
    if (E.dirty) { const ok = await confirmDialog('Close Project', 'Save changes before closing?', 'SAVE & CLOSE', 'DISCARD'); if (ok) await this.save(); }
    if (E.playtest) Playtest.stop();
    Screens.hide(); E.dirty = false; document.title = 'MYTHLING EDIT';
    this.showStart();
  },
  // ------------------------------------------------------------- save / autosave / snapshots
  async save(asCopy = false) {
    if (!E.project) return;
    const p = E.project;
    if (asCopy) { const name = await promptDialog('Save a Copy', 'Project name', p.project.name + ' copy'); if (!name) return; p.project.id = uid('proj'); p.project.name = name; p.project.created = nowIso(); p.project.version = 1; }
    p.project.version = (p.project.version || 0) + (E.dirty || asCopy ? 1 : 0);
    p.project.lastSaved = nowIso(); p.project.editorVersion = EDITOR_VERSION; p.project.format = PROJECT_FORMAT_VERSION;
    try {
      await Store.saveProject(p);
      E.dirty = false; E.lastSaveAt = Date.now(); await this.refreshRecent();
      UI.updateStatus(); UI.updateHeader();
      if (E.ui.leftTab === 'project') Left.render();
      toast(`Saved v${p.project.version}`, 'ok', 1400); ConsoleLog.ok(`Saved project v${p.project.version} (${p.project.changeCount || 0} changes)`);
    } catch (e) { ConsoleLog.error('Save failed: ' + e.message); toast('SAVE FAILED — ' + e.message, 'err', 6000); await dialog({ title: 'SAVE FAILED', body: h('div', {}, [h('p', { text: e.message }), h('p', { text: 'Use FILE → Export Project File to download a copy of your work.' })]), buttons: [{ label: 'EXPORT FILE NOW', value: 'x', primary: true }, { label: 'CLOSE', value: null }] }).then((r) => { if (r === 'x') Exporter.downloadProject(); }); }
  },
  scheduleAutosave() {
    clearInterval(this.autosaveTimer);
    this.autosaveTimer = setInterval(() => {
      if (!E.project) return;
      const secs = clamp(settings().autosaveSec ?? 30, 5, 600);
      if (E.dirty && Date.now() - (E.lastEditAt || 0) > 1500 && Date.now() - (E.lastSaveAt || 0) > secs * 1000 && !E.playtest && !E.dragging) { this.save(); ConsoleLog.info('Autosaved'); }
    }, 2000);
  },
  async saveSnapshot(label = '') {
    const p = E.project; if (!p) return;
    p.snapshots = p.snapshots || [];
    if (!label) { label = await promptDialog('Save Snapshot', 'Label', `v${p.project.version} — ${new Date().toLocaleString()}`); if (label == null) return; }
    p.snapshots.unshift({ label: label || `Snapshot ${p.snapshots.length + 1}`, version: p.project.version, at: nowIso(), changeCount: p.project.changeCount || 0, data: docSnapshot(p) });
    while (p.snapshots.length > 10) p.snapshots.pop();
    markDirty('Snapshot'); toast('Snapshot saved (max 10 kept)', 'ok'); ConsoleLog.info(`Snapshot "${p.snapshots[0].label}" saved`);
  },
  restoreSnapshot(s) {
    const p = E.project; if (!p) return;
    // keep the current state as a snapshot first (promised by the dialog), without bumping the change count noise
    p.snapshots = p.snapshots || [];
    p.snapshots.unshift({ label: `Before restore of "${s.label}"`, version: p.project.version, at: nowIso(), changeCount: p.project.changeCount || 0, data: docSnapshot(p) });
    while (p.snapshots.length > 10) p.snapshots.pop();
    History.run('Restore snapshot', () => { applyDocSnapshot(E.project, s.data); });
    afterHistoryJump(); UI.refreshAll(); toast(`Snapshot "${s.label}" restored (v${s.version}, ${fmtDate(s.at)})`, 'ok');
  },
  recentMenu() { return (E.recent || []).slice(0, 8).map((r) => ({ label: `${r.name}  —  v${r.version || 1}, ${fmtDate(r.lastSaved)}`, fn: () => this.openProjectId(r.id) })); },
  async refreshRecent() { try { E.recent = await Store.getKV('recent', []); } catch { E.recent = []; } },
  // ------------------------------------------------------------- content helpers used by menus
  addDemoContent() {
    const demo = buildDemoProject();
    History.run('Add demo content', () => {
      for (const [id, m] of Object.entries(demo.maps)) if (!E.project.maps[id]) E.project.maps[id] = m;
      for (const [id, my] of Object.entries(demo.mythlings)) if (!E.project.mythlings[id]) { E.project.mythlings[id] = my; for (const a of my.animations) E.project.animations[a] = demo.animations[a]; }
      for (const [id, v] of Object.entries(demo.vfx)) if (!E.project.vfx[id]) E.project.vfx[id] = v;
      for (const [id, s] of Object.entries(demo.skills)) if (!E.project.skills[id]) E.project.skills[id] = s;
      for (const [id, o] of Object.entries(demo.objects || {})) if (!E.project.objects[id]) E.project.objects[id] = o;
    });
    UI.refreshAll(); toast('Demo content added (existing items kept)', 'ok');
  },
  addTemplate(key) {
    const my = createMythlingFromTemplate(key);
    if (E.project.mythlings[my.id]) { my.id = `${my.id}_${uid('').slice(-4)}`; my.name += ' (copy)'; }
    History.run('Add template Mythling', () => { E.project.mythlings[my.id] = my; attachDefaultAnimations(E.project, my); });
    UI.openMythling(my.id); toast(`Template "${my.name}" added`, 'ok');
  },
  // ------------------------------------------------------------- boot
  bootUI() {
    this.booted = true;
    UI.init(); Scene.init(); Tools.init();
    window.addEventListener('beforeunload', (e) => { if (E.dirty) { e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('error', (e) => { ConsoleLog.error(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`); });
    window.addEventListener('unhandledrejection', (e) => { ConsoleLog.error('Unhandled: ' + (e.reason?.message || e.reason)); });
    // drag & drop files anywhere → images to assets, .json → project import
    document.addEventListener('dragover', (e) => { e.preventDefault(); });
    document.addEventListener('drop', async (e) => { if (e.target.closest('#scene')) return; e.preventDefault(); const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return; const json = files.find((f) => /\.json$/i.test(f.name)); if (json) { await this.importProjectFile(json); return; } const imgs = files.filter((f) => /^image\//.test(f.type)); if (imgs.length) { await Ops.importImages(imgs); UI.showLeftTab('assets'); } });
    document.addEventListener('keydown', (e) => {
      if (E.playtest) { if (e.key === 'Escape') { Playtest.stop(); e.preventDefault(); return; } Playtest.onKey(e, true); return; }
      if (e.key === 'F1') { e.preventDefault(); Screens.shortcuts(); return; }
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      // global shortcuts that must work even while a field has focus
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(true); return; }
      if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); this.openFile(); return; }
      if (mod && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); this.newProject(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); if (E.project) UI.setMode('export'); return; }
      if (inField) { if (e.key === 'Escape') e.target.blur(); return; }
      if (document.querySelector('.overlay')) return; // a dialog is open: it handles its own keys
      Tools.onKey(e);
    });
    document.addEventListener('keyup', (e) => { if (E.playtest) { Playtest.onKey(e, false); return; } Tools.onKeyUp(e); });
  },
  async boot() {
    ConsoleLog.info(`MYTHLING EDIT v${EDITOR_VERSION} starting…`);
    try { await Store.init(); } catch (e) { ConsoleLog.warn('Storage init: ' + e.message); }
    await this.refreshRecent();
    const params = new URLSearchParams(location.search);
    const last = await Store.getKV('lastProject', null);
    if (params.get('fresh') !== '1' && last && (await Store.loadProject(last))) {
      // Offer the last project directly (fast path) but still show the start screen for choice
    }
    if (!E.recent.length && params.get('fresh') !== '1') {
      // First open ever: build the demo project so the user immediately has content to explore
      const project = buildDemoProject();
      await this.loadIntoEditor(project, { fresh: true });
      await this.save();
      toast('Welcome! A demo project was created for you (Verdant Vale, Spriggo & friends).', 'ok', 5000);
      setTimeout(() => Screens.guide(), 600);
      return;
    }
    await this.showStart();
  },
};

document.addEventListener('DOMContentLoaded', () => { App.boot(); });
