// =============================================================================
// Persistent storage — IndexedDB with a localStorage fallback.
// Stores: projects (id → { meta, data }), kv (recent list, last project, layout)
// =============================================================================
const Store = {
  db: null, ready: null, fallback: false,
  init() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve) => {
      if (!('indexedDB' in window)) { this.fallback = true; resolve(); return; }
      let req;
      try { req = indexedDB.open('MythlingEditDB', 1); } catch { this.fallback = true; resolve(); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => { this.fallback = true; ConsoleLog.warn('IndexedDB unavailable — using localStorage'); resolve(); };
    });
    return this.ready;
  },
  _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, mode);
      const os = tx.objectStore(store);
      const req = fn(os);
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
  // ---- kv
  async getKV(key, def = null) {
    await this.init();
    if (this.fallback) { try { const v = localStorage.getItem('me_kv_' + key); return v == null ? def : JSON.parse(v); } catch { return def; } }
    const v = await this._tx('kv', 'readonly', (os) => os.get(key));
    return v === undefined ? def : v;
  },
  async setKV(key, value) {
    await this.init();
    if (this.fallback) { try { localStorage.setItem('me_kv_' + key, JSON.stringify(value)); } catch (e) { ConsoleLog.error('localStorage full: ' + e.message); } return; }
    await this._tx('kv', 'readwrite', (os) => os.put(value, key));
  },
  // ---- projects
  async listProjects() {
    await this.init();
    if (this.fallback) {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('me_project_')) { try { const p = JSON.parse(localStorage.getItem(k)); out.push(p.meta); } catch { /* skip */ } }
      }
      return out;
    }
    const all = await this._tx('projects', 'readonly', (os) => os.getAll());
    return (all || []).map((p) => p.meta);
  },
  async loadProject(id) {
    await this.init();
    if (this.fallback) { try { const p = JSON.parse(localStorage.getItem('me_project_' + id)); return p ? p.data : null; } catch { return null; } }
    const p = await this._tx('projects', 'readonly', (os) => os.get(id));
    return p ? p.data : null;
  },
  async saveProject(project) {
    await this.init();
    const meta = {
      id: project.project.id, name: project.project.name, version: project.project.version,
      lastSaved: project.project.lastSaved, changeCount: project.project.changeCount,
      maps: Object.keys(project.maps).length, mythlings: Object.keys(project.mythlings).length,
    };
    if (this.fallback) {
      try { localStorage.setItem('me_project_' + meta.id, JSON.stringify({ id: meta.id, meta, data: project })); }
      catch (e) { throw new Error('Browser storage is full (' + e.message + '). Export the project as a file to keep it safe.'); }
    } else {
      await this._tx('projects', 'readwrite', (os) => os.put({ id: meta.id, meta, data: project }));
    }
    const recent = (await this.getKV('recent', [])).filter((r) => r.id !== meta.id);
    recent.unshift(meta);
    await this.setKV('recent', recent.slice(0, 12));
    await this.setKV('lastProject', meta.id);
  },
  async deleteProject(id) {
    await this.init();
    if (this.fallback) localStorage.removeItem('me_project_' + id);
    else await this._tx('projects', 'readwrite', (os) => os.delete(id));
    const recent = (await this.getKV('recent', [])).filter((r) => r.id !== id);
    await this.setKV('recent', recent);
  },
};

// =============================================================================
// Project document helpers
// =============================================================================
function emptyProject(name = 'Mythlings Wildbound', id = null) {
  return {
    project: {
      id: id || slug(name) || 'project', name, version: 1, format: PROJECT_FORMAT_VERSION, editorVersion: EDITOR_VERSION,
      created: nowIso(), lastSaved: null, changeCount: 0,
    },
    maps: {}, mythlings: {}, objects: {}, animations: {}, vfx: {}, skills: {}, assets: {}, snapshots: [],
    settings: { gridSize: 32, creatureGridSize: 4, snap: true, showGrid: true, showGuides: true, showRulers: true, showAnchors: true, showPivots: true, showCollision: false, showTriggers: true, showZones: true, showBounds: false, showTarget: true, livePreview: true, autoKey: false, debug: false, autosaveSec: 30, guides: { h: [], v: [] } },
  };
}
/** Make an old / hand-edited project safe to open. Returns a list of repairs. */
function migrateProject(p) {
  const fixes = [];
  if (!p || typeof p !== 'object') throw new Error('Project file is not an object');
  if (!p.project) { p.project = emptyProject().project; fixes.push('added project header'); }
  for (const k of ['maps', 'mythlings', 'objects', 'animations', 'vfx', 'skills', 'assets']) if (!p[k] || typeof p[k] !== 'object') { p[k] = {}; fixes.push(`added ${k}`); }
  if (!Array.isArray(p.snapshots)) { p.snapshots = []; fixes.push('added snapshots'); }
  p.settings = Object.assign(emptyProject().settings, p.settings || {});
  if (!p.settings.guides) p.settings.guides = { h: [], v: [] };
  for (const [id, m] of Object.entries(p.maps)) {
    m.id = m.id || id;
    if (!m.nodes) { m.nodes = {}; fixes.push(`map ${id}: nodes`); }
    if (!Array.isArray(m.root)) { m.root = Object.values(m.nodes).filter((n) => !n.parent).map((n) => n.id); }
    if (!Array.isArray(m.layers) || !m.layers.length) { m.layers = defaultLayers(); fixes.push(`map ${id}: layers`); }
    m.cell = m.cell || 32;
    m.cols = m.cols || Math.ceil((m.width || 1600) / m.cell);
    m.rows = m.rows || Math.ceil((m.height || 1000) / m.cell);
    if (!Array.isArray(m.terrain) || m.terrain.length !== m.cols * m.rows) { m.terrain = resizeGrid(m.terrain, m.cols, m.rows, 0); fixes.push(`map ${id}: terrain grid`); }
    if (!Array.isArray(m.collision) || m.collision.length !== m.cols * m.rows) { m.collision = resizeGrid(m.collision, m.cols, m.rows, 0); fixes.push(`map ${id}: collision grid`); }
    for (const n of Object.values(m.nodes)) normalizeNode(n);
  }
  for (const [id, my] of Object.entries(p.mythlings)) {
    my.id = my.id || id;
    if (!my.rig) { my.rig = { nodes: {}, root: [] }; fixes.push(`mythling ${id}: rig`); }
    if (!my.rig.nodes) my.rig.nodes = {};
    if (!Array.isArray(my.rig.root)) my.rig.root = Object.values(my.rig.nodes).filter((n) => !n.parent).map((n) => n.id);
    for (const n of Object.values(my.rig.nodes)) normalizeNode(n);
    if (!Array.isArray(my.evolutions)) my.evolutions = [];
    my.stats = Object.assign({ hp: 100, patk: 12, satk: 12, pdef: 12, sdef: 12, spd: 12, counter: 6, crit: 5, critMult: 40 }, my.stats || {});
  }
  for (const [id, a] of Object.entries(p.animations)) { a.id = a.id || id; a.tracks = a.tracks || {}; a.duration = a.duration || 1; a.fps = a.fps || 60; }
  for (const [id, v] of Object.entries(p.vfx)) { v.id = v.id || id; v.emitters = v.emitters || []; }
  return fixes;
}
function resizeGrid(old, cols, rows, fill) {
  const g = new Array(cols * rows).fill(fill);
  if (Array.isArray(old)) for (let i = 0; i < Math.min(old.length, g.length); i++) g[i] = old[i];
  return g;
}
/** Resize a map in pixels, preserving terrain/collision from the top-left corner. */
function resizeMapGrid(map, width, height) {
  const cols = Math.ceil(width / map.cell), rows = Math.ceil(height / map.cell);
  const copy = (src, fill) => { const g = new Array(cols * rows).fill(fill); for (let r = 0; r < Math.min(rows, map.rows); r++) for (let c = 0; c < Math.min(cols, map.cols); c++) g[r * cols + c] = src[r * map.cols + c]; return g; };
  const base = TERRAIN_INDEX[map.baseTerrain || 'grass'] ?? 1;
  map.terrain = copy(map.terrain, base); map.collision = copy(map.collision, 0);
  map.width = width; map.height = height; map.cols = cols; map.rows = rows;
}
function defaultLayers() {
  return ['Sky', 'Far Background', 'Mountains', 'Terrain', 'Water', 'Ground', 'Decorations', 'Trees', 'Objects', 'NPCs', 'Mythlings', 'Effects', 'Collision', 'Triggers']
    .map((name) => ({ id: slug(name), name, visible: true, locked: false }));
}
/** Every node gets the full property set, so the inspector never sees undefined. */
function normalizeNode(n) {
  n.type = n.type || 'rect';
  n.name = n.name || titleCase(n.type);
  n.children = Array.isArray(n.children) ? n.children : [];
  n.parent = n.parent || null;
  n.x = +n.x || 0; n.y = +n.y || 0; n.rotation = +n.rotation || 0;
  n.scaleX = n.scaleX == null ? 1 : +n.scaleX; n.scaleY = n.scaleY == null ? 1 : +n.scaleY;
  n.pivotX = +n.pivotX || 0; n.pivotY = +n.pivotY || 0;
  n.opacity = n.opacity == null ? 1 : +n.opacity;
  n.z = +n.z || 0;
  n.visible = n.visible !== false; n.locked = !!n.locked;
  n.tags = Array.isArray(n.tags) ? n.tags : [];
  n.layer = n.layer || 'objects';
  if (!n.shape) n.shape = {};
  if (n.shape.w == null && ['rect', 'ellipse', 'image', 'text', 'prefab', 'npc', 'mythling', 'zone', 'warp', 'trigger', 'spawn'].includes(n.type)) { n.shape.w = n.shape.w ?? 64; n.shape.h = n.shape.h ?? 64; }
  if (['polygon', 'path'].includes(n.type) && !Array.isArray(n.points)) n.points = [[-20, -20], [20, -20], [20, 20], [-20, 20]];
  n.fill = n.fill || (n.type === 'anchor' ? '#f2c761' : '#6fa8dc'); n.stroke = n.stroke || '#1b2a3d'; n.strokeWidth = n.strokeWidth == null ? 2 : +n.strokeWidth;
  n.blend = n.blend || 'source-over'; n.tint = n.tint || ''; n.outline = !!n.outline; n.shadow = n.shadow == null ? (n.type === 'prefab') : !!n.shadow;
  n.brightness = n.brightness == null ? 1 : +n.brightness; n.glow = +n.glow || 0;
  n.collision = Object.assign({ enabled: false, type: 'rect', rect: [-16, -16, 32, 32], radius: 16, points: [[-16, -16], [16, -16], [16, 16], [-16, 16]], mode: 'blocked', layers: { player: true, npc: true, mythling: true, projectile: false, interaction: true } }, n.collision || {});
  n.collision.layers = Object.assign({ player: true, npc: true, mythling: true, projectile: false, interaction: true }, n.collision.layers || {});
  n.behavior = Object.assign({ interactable: false, animated: false, wind: 'none', windAmount: 2, savePoint: false, chest: false, anim: null }, n.behavior || {});
  return n;
}
/** JSON string of everything that undo/redo tracks (assets and snapshots are excluded — they are big and rarely change). */
function docSnapshot(p) {
  return JSON.stringify({ maps: p.maps, mythlings: p.mythlings, objects: p.objects, animations: p.animations, vfx: p.vfx, skills: p.skills, settings: p.settings });
}
function applyDocSnapshot(p, str) {
  const d = JSON.parse(str);
  p.maps = d.maps; p.mythlings = d.mythlings; p.objects = d.objects; p.animations = d.animations; p.vfx = d.vfx; p.skills = d.skills; p.settings = d.settings;
}
