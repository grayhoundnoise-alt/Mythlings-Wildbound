// =============================================================================
// Export: JSON / JavaScript (register* calls) / PNG previews / Arena AI package / validation
// =============================================================================
const Exporter = {
  // ------------------------------------------------------------- data shaping
  cleanNode(n) { const c = deepClone(n); delete c.anchor; if (!c.tags?.length) delete c.tags; if (c.type !== 'prefab' && c.shadow === false) delete c.shadow; return c; },
  mapData(map, { debug = false } = {}) {
    const nodes = Object.values(map.nodes).map((n) => this.cleanNode(n));
    const byType = (t) => nodes.filter((n) => n.type === t);
    const spawn = byType('spawn').find((n) => n.spawn.kind === 'player');
    const data = {
      id: map.id, name: map.name, width: map.width, height: map.height, cell: map.cell, cols: map.cols, rows: map.rows,
      theme: map.theme, music: map.music, weather: map.weather, background: map.background, levelMin: map.levelMin, levelMax: map.levelMax,
      camera: map.camera, playerSpawn: spawn ? { x: spawn.x, y: spawn.y, direction: spawn.spawn.direction } : map.spawn,
      layers: map.layers, terrain: this.rle(map.terrain), collision: this.rle(map.collision), terrainLegend: TERRAINS.map((t) => t.id), collisionLegend: COLLISION_MODES.map((m) => m.id),
      nodes, root: map.root,
      encounterZones: byType('zone').map((n) => ({ id: n.id, name: n.zone.name, x: n.x - n.shape.w / 2, y: n.y - n.shape.h / 2, w: n.shape.w, h: n.shape.h, species: n.zone.species, minLevel: n.zone.minLevel, maxLevel: n.zone.maxLevel, weight: n.zone.weight, mutationChance: n.zone.mutationChance })),
      warps: byType('warp').map((n) => ({ id: n.id, name: n.name, x: n.x - n.shape.w / 2, y: n.y - n.shape.h / 2, w: n.shape.w, h: n.shape.h, ...n.warp })),
      triggers: byType('trigger').map((n) => ({ id: n.id, name: n.name, x: n.x - n.shape.w / 2, y: n.y - n.shape.h / 2, w: n.shape.w, h: n.shape.h, ...n.trigger })),
      spawnPoints: byType('spawn').map((n) => ({ id: n.id, name: n.name, x: n.x, y: n.y, ...n.spawn })),
      npcs: byType('npc').map((n) => ({ id: n.id, name: n.name, x: n.x, y: n.y, ...n.npc, collision: n.collision })),
      mythlings: byType('mythling').map((n) => ({ id: n.id, name: n.name, x: n.x, y: n.y, ...n.mythling })),
      props: nodes.filter((n) => n.type === 'prefab').map((n) => ({ id: n.id, prefab: n.prefab, name: n.name, x: n.x, y: n.y, rotation: n.rotation, scaleX: n.scaleX, scaleY: n.scaleY, layer: n.layer, variant: n.variant || 0, collision: n.collision.enabled ? n.collision : null, behavior: n.behavior })),
    };
    if (debug) data._debug = this.debugInfo({ kind: 'map', nodeCount: nodes.length, bounds: { x: 0, y: 0, w: map.width, h: map.height }, warnings: this.validateMap(map) });
    return data;
  },
  rle(arr) { const out = []; let i = 0; while (i < arr.length) { const v = arr[i]; let n = 1; while (i + n < arr.length && arr[i + n] === v && n < 65535) n++; out.push(v, n); i += n; } return { encoding: 'rle', length: arr.length, data: out }; },
  mythlingData(my, { debug = false, includeAnimations = true, includeVfx = true } = {}) {
    const anims = my.animations.map((id) => E.project.animations[id]).filter(Boolean);
    const rigNodes = Object.values(my.rig.nodes).map((n) => this.cleanNode(n));
    const anchors = rigNodes.filter((n) => n.type === 'anchor').map((a) => { const [x, y] = M.apply(worldMatrix(a, my.rig, NO_ANIM), 0, 0); return { id: a.id, name: a.name, parent: a.parent, x: a.x, y: a.y, rotation: a.rotation, worldX: round(x, 2), worldY: round(y, 2), color: a.fill }; });
    const data = {
      id: my.id, name: my.name, breed: my.breed, element: my.element, rarity: my.rarity, mood: my.mood, role: my.role, description: my.description,
      stage: my.stage, catchRate: my.catchRate, ultimate: my.ultimate, bodyType: my.bodyType, palette: my.palette, stats: my.stats,
      evolutions: my.evolutions, assets: my.assets || [],
      rig: { root: my.rig.root, nodes: rigNodes.filter((n) => n.type !== 'anchor'), anchors, parts: my.parts || {}, bounds: rigBounds(my) },
      animations: includeAnimations ? anims.map((a) => this.animationData(a)) : anims.map((a) => a.id),
      vfx: includeVfx ? (my.vfx || []).map((id) => E.project.vfx[id]).filter(Boolean).map((v) => this.vfxData(v)) : (my.vfx || []),
    };
    if (debug) data._debug = this.debugInfo({ kind: 'mythling', nodeCount: rigNodes.length, bounds: rigBounds(my), warnings: this.validateMythling(my) });
    return data;
  },
  animationData(a) { const my = E.project.mythlings[a.mythlingId]; const nameOf = (id) => my?.rig.nodes[id]?.name || id; return { id: a.id, name: a.name, mythlingId: a.mythlingId, duration: a.duration, loop: a.loop, fps: a.fps, easing: a.easing, tracks: Object.fromEntries(Object.entries(a.tracks).map(([id, keys]) => [id, { part: nameOf(id), keys: keys.map((k) => ({ t: k.t, x: k.x, y: k.y, rotation: k.rotation, scaleX: k.scaleX, scaleY: k.scaleY, opacity: k.opacity, ease: k.ease || a.easing || 'easeInOut' })) }])) }; },
  vfxData(v) { return { id: v.id, name: v.name, category: v.category, duration: v.duration, emitters: v.emitters.map((e) => ({ ...e })) }; },
  objectData(o) { return { id: o.id, name: o.name, category: o.category, w: o.w, h: o.h, behavior: o.behavior, root: o.root, nodes: Object.values(o.nodes).map((n) => this.cleanNode(n)) }; },
  projectData({ debug = false } = {}) {
    const p = E.project;
    const data = { project: { ...p.project, exportedAt: nowIso(), editorVersion: EDITOR_VERSION }, settings: p.settings, maps: Object.fromEntries(Object.values(p.maps).map((m) => [m.id, this.mapData(m, { debug })])), mythlings: Object.fromEntries(Object.values(p.mythlings).map((m) => [m.id, this.mythlingData(m, { debug, includeAnimations: false, includeVfx: false })])), objects: Object.fromEntries(Object.values(p.objects).map((o) => [o.id, this.objectData(o)])), animations: Object.fromEntries(Object.values(p.animations).map((a) => [a.id, this.animationData(a)])), vfx: Object.fromEntries(Object.values(p.vfx).map((v) => [v.id, this.vfxData(v)])), skills: p.skills, assets: Object.fromEntries(Object.values(p.assets).map((a) => [a.id, { id: a.id, name: a.name, type: a.type, w: a.w, h: a.h, category: a.category, dataUrl: a.dataUrl }])) };
    if (debug) data._debug = this.debugInfo({ kind: 'project', warnings: this.validate(false) });
    return data;
  },
  debugInfo(extra) { return Object.assign({ exportedAt: nowIso(), editorVersion: EDITOR_VERSION, projectFormat: PROJECT_FORMAT_VERSION, projectId: E.project.project.id, projectVersion: E.project.project.version, changeCount: E.project.project.changeCount || 0 }, extra); },
  // ------------------------------------------------------------- JS wrappers
  js(fnName, data, comment) { return `${comment ? `// ${comment}\n` : ''}${fnName}(${JSON.stringify(data, null, 2)});\n`; },
  jsHeader(title) { return `// ${title}\n// Generated by MYTHLING EDIT v${EDITOR_VERSION} — ${nowIso()}\n// Project: ${E.project.project.name} (${E.project.project.id}) v${E.project.project.version}\n// Load order: registerVFX → registerAnimation → registerMythling → registerObject → registerMap\n\n`; },
  build(kind, itemId, F = { json: true, js: true, png: false, debug: false }) {
    const p = E.project; const files = []; const parts = []; const pngs = [];
    const add = (name, text) => { files.push({ name, text }); parts.push(`// ===== ${name} =====\n${text}`); };
    const dbg = !!F.debug;
    if (kind === 'project') {
      const data = this.projectData({ debug: dbg });
      if (F.json) add(`${p.project.id}.project.json`, JSON.stringify(data, null, 2));
      if (F.js) { let js = this.jsHeader(`Mythlings: Wildbound — full project ${p.project.name}`); for (const v of Object.values(p.vfx)) js += this.js('registerVFX', this.vfxData(v)); for (const a of Object.values(p.animations)) js += this.js('registerAnimation', this.animationData(a)); for (const m of Object.values(p.mythlings)) js += this.js('registerMythling', this.mythlingData(m, { debug: dbg, includeAnimations: false, includeVfx: false })); for (const o of Object.values(p.objects)) js += this.js('registerObject', this.objectData(o)); for (const m of Object.values(p.maps)) js += this.js('registerMap', this.mapData(m, { debug: dbg })); js += `registerSkills(${JSON.stringify(p.skills, null, 2)});\n`; add(`${p.project.id}.register.js`, js); }
      if (F.png) { for (const m of Object.values(p.mythlings)) pngs.push({ name: `${m.id}.png`, canvas: this.creatureCanvas(m) }); for (const m of Object.values(p.maps)) pngs.push({ name: `${m.id}.map.png`, canvas: this.mapCanvas(m) }); }
    } else if (kind === 'map') {
      const m = p.maps[itemId]; if (!m) throw new Error('Map not found');
      const data = this.mapData(m, { debug: dbg });
      if (F.json) add(`${m.id}.map.json`, JSON.stringify(data, null, 2));
      if (F.js) add(`${m.id}.map.js`, this.jsHeader(`Map: ${m.name}`) + this.js('registerMap', data));
      if (F.png) pngs.push({ name: `${m.id}.map.png`, canvas: this.mapCanvas(m) });
    } else if (kind === 'mythling') {
      const m = p.mythlings[itemId]; if (!m) throw new Error('Mythling not found');
      const data = this.mythlingData(m, { debug: dbg });
      if (F.json) add(`${m.id}.mythling.json`, JSON.stringify(data, null, 2));
      if (F.js) { let js = this.jsHeader(`Mythling: ${m.name}`); for (const v of data.vfx) js += this.js('registerVFX', v); for (const a of data.animations) js += this.js('registerAnimation', a); js += this.js('registerMythling', Object.assign({}, data, { animations: data.animations.map((a) => a.id), vfx: data.vfx.map((v) => v.id) })); add(`${m.id}.mythling.js`, js); }
      if (F.png) pngs.push({ name: `${m.id}.png`, canvas: this.creatureCanvas(m) });
    } else if (kind === 'animation') {
      const a = p.animations[itemId]; if (!a) throw new Error('Animation not found');
      const data = this.animationData(a); if (dbg) data._debug = this.debugInfo({ kind: 'animation', keyframes: Object.values(a.tracks).reduce((s, t) => s + t.length, 0) });
      if (F.json) add(`${slug(a.name)}.animation.json`, JSON.stringify(data, null, 2));
      if (F.js) add(`${slug(a.name)}.animation.js`, this.jsHeader(`Animation: ${a.name}`) + this.js('registerAnimation', data));
      if (F.png) { const my = p.mythlings[a.mythlingId]; if (my) pngs.push({ name: `${slug(a.name)}.strip.png`, canvas: this.animStripCanvas(my, a) }); }
    } else if (kind === 'vfx') {
      const v = p.vfx[itemId]; if (!v) throw new Error('VFX not found');
      const data = this.vfxData(v); if (dbg) data._debug = this.debugInfo({ kind: 'vfx', emitters: v.emitters.length });
      if (F.json) add(`${v.id}.vfx.json`, JSON.stringify(data, null, 2));
      if (F.js) add(`${v.id}.vfx.js`, this.jsHeader(`VFX: ${v.name}`) + this.js('registerVFX', data));
    } else if (kind === 'object') {
      const o = p.objects[itemId]; if (!o) throw new Error('Object not found');
      const data = this.objectData(o); if (dbg) data._debug = this.debugInfo({ kind: 'object', nodeCount: Object.keys(o.nodes).length });
      if (F.json) add(`${slug(o.name)}.object.json`, JSON.stringify(data, null, 2));
      if (F.js) add(`${slug(o.name)}.object.js`, this.jsHeader(`Object: ${o.name}`) + this.js('registerObject', data));
      if (F.png) pngs.push({ name: `${slug(o.name)}.png`, canvas: customPrefabThumb(o, 256) });
    }
    if (F.game) { for (const [name, text] of this.gameFormatFiles(kind, itemId)) add(name, text); }
    const preview = parts.join('\n\n') || '// Select at least one text format (JSON, JavaScript or Game format).';
    return { files, pngs, preview, kind, itemId };
  },
  /** "Game format": the item(s) rebuilt in the shape of the game's own data modules (src/data/maps.js, species.js, skills.js, skillVfx.js). */
  gameFormatFiles(kind, itemId) {
    if (typeof Game === 'undefined') return [];
    const p = E.project; const out = [];
    const lit = (v) => JSON.stringify(v, null, 2).replace(/"Infinity"/g, 'Infinity');
    const head = (what) => `// ${what} — game-format export from MYTHLING EDIT v${EDITOR_VERSION} (${nowIso()})\n// Paste / merge into the matching src/data module. Values follow the game's schema${Game.ok ? ` as of game v${Game.meta().gameVersion} (${Game.meta().commit})` : ''}.\n`;
    const mapEntry = (m) => { const e = Game.mapEntryFor(m); const notes = this.gameMapNotes(m); return `${head(`Map "${m.name}"`)}${notes}export const ${m.id.toUpperCase()}_MAP = ${lit(e)};\n// MAPS[${JSON.stringify(m.id)}] = ${m.id.toUpperCase()}_MAP;\n`; };
    const speciesEntry = (my) => { const e = Game.exportSpeciesEntry(my); const ov = Game.partOverrides(my); return `${head(`Species "${my.name}"`)}${ov.length ? `// NOTE: this Mythling's game-art parts were edited in the editor; the species entry cannot express per-part offsets.\n// Part overrides (relative to the game skeleton): ${JSON.stringify(ov)}\n` : ''}${Ops.isGameRig(my) ? '' : '// NOTE: this Mythling uses an editor-built rig (not game art). Its parts / animations are in the JSON + JS exports; art.body picks the closest game body plan.\n'}export const ${e.id.toUpperCase()}_SPECIES = ${lit(e)};\n// SPECIES[${JSON.stringify(e.id)}] = ${e.id.toUpperCase()}_SPECIES;\n`; };
    if (kind === 'map') { const m = p.maps[itemId]; if (m) out.push([`${m.id}.game.js`, mapEntry(m)]); }
    else if (kind === 'mythling') { const my = p.mythlings[itemId]; if (my) out.push([`${my.id}.species.game.js`, speciesEntry(my)]); }
    else if (kind === 'vfx') { const v = p.vfx[itemId]; if (v) out.push([`${v.id}.skillvfx.game.js`, `${head(`Skill VFX "${v.name}"`)}export const ${v.id.toUpperCase()}_VFX = ${lit(Game.exportVfxEntry(v))};\n// SKILL_VFX[${JSON.stringify(v.id)}] = ${v.id.toUpperCase()}_VFX;\n`]); }
    else if (kind === 'project') {
      const maps = Object.values(p.maps).map(mapEntry).join('\n'); if (maps) out.push([`${p.project.id}.maps.game.js`, maps]);
      const sp = Object.values(p.mythlings).filter((m) => !/_stage\d+$/.test(m.id)).map(speciesEntry).join('\n'); if (sp) out.push([`${p.project.id}.species.game.js`, sp]);
      const skills = Object.values(p.skills || {}); if (skills.length) out.push([`${p.project.id}.skills.game.js`, `${head('Skills')}export const SKILLS = ${lit(Object.fromEntries(skills.filter((s) => s.type !== 'ultimate').map((s) => [s.id, Game.exportSkillEntry(s)])))};\n\nexport const ULTIMATES = ${lit(Object.fromEntries(skills.filter((s) => s.type === 'ultimate').map((s) => [s.id, Game.exportSkillEntry(s)])))};\n`]);
      const vfx = Object.values(p.vfx).filter((v) => v.game && !v.game.fallback); if (vfx.length) out.push([`${p.project.id}.skillvfx.game.js`, `${head('Skill VFX descriptors')}export const SKILL_VFX = ${lit(Object.fromEntries(vfx.map((v) => [v.id, Game.exportVfxEntry(v)])))};\n`]);
    }
    return out;
  },
  gameMapNotes(m) {
    const props = Object.values(m.nodes).filter((n) => n.type === 'prefab' && n.prefab === 'game_prop' && !(n.parent && m.nodes[n.parent]?.locked));
    const custom = Object.values(m.nodes).filter((n) => !n.gameId && !(n.tags || []).includes('game') && !['group', 'anchor'].includes(n.type) && !(n.type === 'prefab' && n.prefab === 'game_prop' && n.parent && m.nodes[n.parent]?.locked) && !n.behavior?.region && !n.behavior?.water);
    let s = '';
    if (props.length) s += `// NOTE: ${props.length} game prop(s) were placed / moved by hand. The game generates props procedurally per region (hand placement needs a props[] array or a renderer change).\n`;
    if (custom.length) s += `// NOTE: ${custom.length} editor object(s) (${[...new Set(custom.map((n) => n.type === 'prefab' ? n.prefab : n.type))].slice(0, 8).join(', ')}) have no equivalent in the game's map schema and are only in the JSON / JS exports.\n`;
    return s;
  },
  async download(kind, itemId, F) {
    const r = this.build(kind, itemId, F);
    if (!r.files.length && !r.pngs.length) { toast('Nothing to export — pick a format', 'warn'); return; }
    for (const f of r.files) downloadText(f.name, f.text, f.name.endsWith('.js') ? 'text/javascript' : 'application/json');
    for (const pg of r.pngs) await this.downloadCanvas(pg.name, pg.canvas);
    Bottom.setOutput(r.preview);
    toast(`Exported ${r.files.length + r.pngs.length} file(s)`, 'ok'); ConsoleLog.ok(`Export ${kind}: ${[...r.files.map((f) => f.name), ...r.pngs.map((p) => p.name)].join(', ')}`);
  },
  downloadCanvas(name, canvas) { return new Promise((res) => { canvas.toBlob((b) => { if (b) downloadBlob(name, b); res(); }, 'image/png'); }); },
  downloadProject() { const text = JSON.stringify(E.project, null, 2); downloadText(`${E.project.project.id}.mythling-edit.json`, text); toast('Project JSON downloaded', 'ok'); },
  downloadCreaturePng(my) { this.downloadCanvas(`${my.id}.png`, this.creatureCanvas(my)); },
  downloadObject(o) { downloadText(`${slug(o.name)}.object.json`, JSON.stringify(this.objectData(o), null, 2)); },
  creatureCanvas(my, size = 512) { const c = document.createElement('canvas'); c.width = c.height = size; c.style.width = c.style.height = `${size}px`; renderCreatureTo(c, my, { pad: 40 }); return c; },
  animStripCanvas(my, a, frames = 8, size = 160) { const c = document.createElement('canvas'); c.width = size * frames; c.height = size; c.style.width = `${size * frames}px`; c.style.height = `${size}px`; const ctx = c.getContext('2d'); for (let i = 0; i < frames; i++) { const f = document.createElement('canvas'); f.width = f.height = size; f.style.width = f.style.height = `${size}px`; renderCreatureTo(f, my, { anim: a, t: (a.duration * i) / frames, pad: 16 }); ctx.drawImage(f, i * size, 0, size, size); } return c; },
  mapCanvas(map, maxW = 2048) {
    const s = Math.min(1, maxW / map.width); const c = document.createElement('canvas'); c.width = Math.round(map.width * s); c.height = Math.round(map.height * s);
    const ctx = c.getContext('2d'); ctx.scale(s, s);
    const view = { x: 0, y: 0, zoom: s };
    renderTerrain(ctx, map, view, c.width, c.height);
    const savedView = E.view; E.view = view; renderDoc(ctx, map, { overlays: false, still: true }); E.view = savedView;
    return c;
  },
  // ------------------------------------------------------------- validation
  validateMap(map) {
    const w = [];
    const nodes = Object.values(map.nodes);
    if (!nodes.some((n) => n.type === 'spawn' && n.spawn.kind === 'player')) w.push(`Map "${map.name}": no player spawn point`);
    for (const n of nodes) {
      if (n.type === 'warp') { if (!n.warp.toMap) w.push(`Warp "${n.name}" has no destination map`); else if (!E.project.maps[n.warp.toMap]) w.push(`Warp "${n.name}" points to unknown map "${n.warp.toMap}"`); }
      if (n.type === 'zone') { if (!n.zone.species.length) w.push(`Zone "${n.zone.name}" has an empty species pool`); for (const s of n.zone.species) if (!E.project.mythlings[s]) w.push(`Zone "${n.zone.name}" references unknown species "${s}"`); if (n.zone.minLevel > n.zone.maxLevel) w.push(`Zone "${n.zone.name}": min level > max level`); }
      if (n.type === 'image' && n.asset && !E.project.assets[n.asset]) w.push(`Image "${n.name}" references a missing asset`);
      if (n.type === 'mythling' && !E.project.mythlings[n.mythling.species]) w.push(`Mythling placement "${n.name}" references unknown species "${n.mythling.species}"`);
      if (n.type === 'npc' && n.npc.team) for (const t of n.npc.team) if (!E.project.mythlings[t.species]) w.push(`NPC "${n.name}" team has unknown species "${t.species}"`);
      if (n.parent && !map.nodes[n.parent]) w.push(`Node "${n.name}" has a missing parent (${n.parent})`);
      const [x, y] = worldPos(n, map); if (x < -200 || y < -200 || x > map.width + 200 || y > map.height + 200) w.push(`"${n.name}" is far outside the map bounds (${Math.round(x)}, ${Math.round(y)})`);
    }
    if (map.terrain.length !== map.cols * map.rows) w.push(`Map "${map.name}": terrain grid size mismatch`);
    return w;
  },
  validateMythling(my) {
    const w = [];
    const nodes = Object.values(my.rig.nodes);
    const anchors = nodes.filter((n) => n.type === 'anchor').map((n) => n.name);
    for (const req of ['Root', 'Head', 'Mouth', 'AttackOrigin', 'VFXOrigin', 'BodyCenter']) if (!anchors.includes(req)) w.push(`${my.name}: missing anchor "${req}"`);
    // main body parts (details such as eyes, markings and tips are free); the rig guideline is 8–12 main parts
    const parts = nodes.filter((n) => n.type !== 'anchor' && n.type !== 'group' && n.partType !== 'Detail').length;
    if (parts < 6) w.push(`${my.name}: rig has only ${parts} main parts (guideline 8–12)`); if (parts > 14) w.push(`${my.name}: rig has ${parts} main parts (guideline 8–12) — still fine, just heavier to animate`);
    for (const nm of ['Idle', 'Walk', 'Normal Attack', 'Hit', 'Faint']) if (!my.animations.some((id) => E.project.animations[id]?.name === nm)) w.push(`${my.name}: missing standard animation "${nm}"`);
    for (const id of my.animations) if (!E.project.animations[id]) w.push(`${my.name}: animation id ${id} not found`);
    for (const id of my.vfx || []) if (!E.project.vfx[id]) w.push(`${my.name}: vfx id ${id} not found`);
    for (const n of nodes) if (n.type === 'image' && n.asset && !E.project.assets[n.asset]) w.push(`${my.name}: part "${n.name}" has a missing image asset`);
    for (const a of my.animations.map((id) => E.project.animations[id]).filter(Boolean)) for (const tid of Object.keys(a.tracks)) if (!my.rig.nodes[tid]) w.push(`${my.name}/${a.name}: track for deleted part ${tid}`);
    return w;
  },
  validate(show = false) {
    const w = [];
    for (const m of Object.values(E.project.maps)) w.push(...this.validateMap(m));
    for (const m of Object.values(E.project.mythlings)) w.push(...this.validateMythling(m));
    for (const s of Object.values(E.project.skills)) { if (s.vfx && !E.project.vfx[s.vfx]) w.push(`Skill "${s.name}" references unknown VFX "${s.vfx}"`); if (!ANIM_NAMES.includes(s.animation)) w.push(`Skill "${s.name}" uses non-standard animation name "${s.animation}"`); }
    if (show) { if (w.length) { for (const x of w) ConsoleLog.warn(x); toast(`${w.length} warning(s) — see CONSOLE`, 'warn'); UI.showBottomTab('console'); } else { ConsoleLog.ok('Validation passed — no warnings'); toast('Validation passed', 'ok'); } }
    return w;
  },
  // ------------------------------------------------------------- Arena AI package
  arenaPackage(kind, itemId, built) {
    const p = E.project;
    const label = { project: `the whole project "${p.project.name}"`, map: `map "${p.maps[itemId]?.name}"`, mythling: `Mythling "${p.mythlings[itemId]?.name}"`, animation: `animation "${p.animations[itemId]?.name}"`, vfx: `VFX "${p.vfx[itemId]?.name}"`, object: `object "${p.objects[itemId]?.name}"` }[kind];
    const warnings = this.validate(false);
    const lines = [];
    lines.push('=====================================================================');
    lines.push(' ARENA AI IMPLEMENTATION PACKAGE — Mythlings: Wildbound');
    lines.push(` Generated by MYTHLING EDIT v${EDITOR_VERSION} on ${nowIso()}`);
    lines.push('=====================================================================');
    lines.push('');
    lines.push('## REQUEST');
    lines.push(`Implement ${label} in the game Mythlings: Wildbound using the data below.`);
    lines.push('Do NOT modify the editor. Integrate the content into the game code (src/data, src/render, src/scenes) following the existing architecture.');
    lines.push('Keep everything offline-compatible: no CDN, no network calls, no build-time dependencies.');
    lines.push('');
    lines.push('## HOW THE DATA IS STRUCTURED');
    lines.push(this.schemaDoc());
    lines.push('');
    lines.push('## INTEGRATION CHECKLIST');
    lines.push('1. Add loader functions registerVFX / registerAnimation / registerMythling / registerObject / registerMap / registerSkills (or map the JSON directly into the existing data modules).');
    lines.push('2. Creature rigs: nodes are drawn parent→child; children with z<0 draw behind their parent. Transforms compose as translate(x,y) · rotate(rotation) · scale(scaleX,scaleY) · translate(-pivotX,-pivotY). Creature faces +x, ground line is y=0 (negative y is up).');
    lines.push('3. Animations: keyframe values are ADDITIVE offsets over the rest pose (x,y,rotation added; scaleX/scaleY/opacity multiplied). Interpolate between keys with the easing named on the destination key. loop=true wraps time by duration.');
    lines.push('4. VFX: each emitter spawns at attach point + (x,y). Types ring/burst/glow/shockwave/aura are single timed shapes; projectile travels AttackOrigin→TargetCenter over duration; trail/particle/leaf/flame/splash/vine/smoke/spark emit `count` particles across `duration` with `lifetime`, `speed`, `spread`, `gravity`.');
    lines.push('5. Maps: terrain/collision grids are RLE encoded [value,count,...] over cols×rows cells of `cell` px. Collision values: 0 walkable, 1 blocked, 2 water, 3 trigger, 4 special. Object collision shapes are in node-local space; apply the node world transform.');
    lines.push('6. Encounter zones use weight (relative encounter rate), min/max level, species pool and mutationChance %. Warps teleport to toMap at (toX,toY) when requiredFlag is empty or set. Triggers fire `event` with `payload` (once=true fires a single time).');
    lines.push('7. NPCs: kind regular/trainer/shop/healer/savepoint/quest/guide; dialogue is an ordered string array; team = [{species, level, nickname}], stock = [{item, qty, price}].');
    lines.push('8. Skills: {id,name,element,type,power,uses,animation,vfx,sound,shake}. `animation` is the caster clip name, `vfx` the VFX id, `shake` 0–1 camera shake strength.');
    lines.push('9. Evolutions: stages with level thresholds, statMult and future=true meaning locked/planned content (show as LOCKED/FUTURE in the UI).');
    if (typeof Game !== 'undefined' && Game.ok) {
      const gm = Object.values(p.maps).filter((m) => m.source === 'game').length, gmy = Object.values(p.mythlings).filter((m) => m.source === 'game').length;
      lines.push(`10. GAME PRESETS: this project was started from a read-only snapshot of the game's own data (game v${Game.meta().gameVersion}, commit ${Game.meta().commit}). ${gm} map(s) and ${gmy} Mythling(s) carry source:"game" plus the original ids (node.gameId, map.game, mythling.game = {species, stage}). Nodes of type "gamepart" are the game's own creature-art layers (creatureArt.js part names: game.part) drawn live — apply the node transform on top of the game skeleton pivot; keyframes for them are additive offsets exactly like the game's CreatureAnimationController transforms (dx, dy, rot, sx, sy). Files ending in .game.js contain the same content rebuilt in the src/data schema (maps.js / species.js / skills.js / skillVfx.js) — prefer merging those into the data modules; anything without a schema equivalent is flagged with a NOTE comment.`);
    }
    if (warnings.length) { lines.push(''); lines.push(`## VALIDATION WARNINGS (${warnings.length})`); for (const w of warnings.slice(0, 40)) lines.push(`- ${w}`); if (warnings.length > 40) lines.push(`- …and ${warnings.length - 40} more`); }
    lines.push('');
    lines.push('## SUMMARY');
    lines.push(`- Maps: ${Object.keys(p.maps).length} (${Object.values(p.maps).map((m) => `${m.name} ${m.width}×${m.height}`).join(', ')})`);
    lines.push(`- Mythlings: ${Object.keys(p.mythlings).length} (${Object.values(p.mythlings).map((m) => m.name).join(', ')})`);
    lines.push(`- Animations: ${Object.keys(p.animations).length} · VFX: ${Object.keys(p.vfx).length} · Skills: ${Object.keys(p.skills).length} · Library objects: ${Object.keys(p.objects).length} · Assets: ${Object.keys(p.assets).length}`);
    lines.push('');
    lines.push('## DATA (JavaScript register calls / JSON)');
    lines.push('```javascript');
    lines.push(built.preview.length > 400000 ? built.preview.slice(0, 400000) + '\n// … truncated (export the files instead) …' : built.preview);
    lines.push('```');
    lines.push('');
    lines.push('## ACCEPTANCE CRITERIA');
    lines.push('- The content renders identically to the editor preview (same shapes, colours, pivots, layer order).');
    lines.push('- Animations loop/one-shot exactly as configured; anchors drive VFX/projectile origins.');
    lines.push('- Map collision, warps, triggers, encounter zones and NPC dialogues behave as described.');
    lines.push('- Existing game features are not removed or rewritten; new data plugs into the current systems.');
    lines.push('=====================================================================');
    return lines.join('\n');
  },
  schemaDoc() {
    return [
      'PROJECT { project:{id,name,version,format,editorVersion,created,lastSaved,changeCount}, settings, maps{}, mythlings{}, objects{}, animations{}, vfx{}, skills{}, assets{} }',
      '',
      'NODE (map object or creature part) {',
      '  id, type: group|rect|ellipse|polygon|path|image|text|prefab|npc|mythling|zone|spawn|warp|trigger|anchor|gamepart,',
      '  name, parent, children[], x, y, rotation(deg), scaleX, scaleY, pivotX, pivotY, opacity, z, visible, locked, tags[], layer,',
      '  shape{w,h} | points[[x,y]...] (polygon/path, local space; path: closed, smooth), text/fontSize/font/bold, asset (image id), prefab (library id), variant,',
      '  fill, stroke, strokeWidth, blend, tint, brightness, glow, outline, shadow,',
      '  collision{enabled,type:rect|circle|polygon,rect[x,y,w,h],radius,points[],mode:walkable|blocked|water|trigger|special,layers{player,npc,mythling,projectile,interaction}},',
      '  behavior{interactable,text,wind:none|gentle|strong,windAmount,idle:none|bob|sway|pulse|spin,idleSpeed,idleAmount,savePoint,chest,item},',
      '  partType (creature parts), npc{kind,sprite,direction,color,dialogue[],team[],stock[],flag,reward}, mythling{species,level,behavior,facing,animation},',
      '  zone{name,species[],weights{speciesId:w},minLevel,maxLevel,weight,mutationChance}, warp{toMap,toX,toY,requiredFlag,label,lockedText}, trigger{event,payload,once}, spawn{kind,direction,zone,enabled}',
      '  GAME PRESET fields: gameId (original id in src/data/maps.js), gameKind (game prop / landmark / building kind), seed (prop variation), behavior.region{id,terrain} (ground-terrain rectangle), behavior.water (stream|pond|sea|river|lava),',
      '  npc{intro,defeat,reward{coins,items{}},guardian,finalBoss,gameType,sprite:"game"}; gamepart nodes: game{species,stage,part,mutation} = one live layer of the game creature art (creatureArt.js part name), owner = mythling id',
      '}',
      '',
      'MAP { id,name,width,height,cell,cols,rows,theme,music,weather,background,levelMin,levelMax,camera{minX,minY,maxX,maxY},playerSpawn,layers[{id,name,visible,locked}],',
      '      terrain{rle}, collision{rle}, terrainLegend[], collisionLegend[], nodes[], root[], encounterZones[], warps[], triggers[], spawnPoints[], npcs[], mythlings[], props[] }',
      '',
      'MYTHLING { id,name,breed,element,rarity,mood,role,description,stage,catchRate,expYield,starter,spawnMaps[],skillUnlocks{level:[skillIds]},ultimate,bodyType,palette,stats{hp,patk,satk,pdef,sdef,spd,counter,crit,critMult | hp,atk,def,spd,sp},evolutions[{stage,name,level,statMult,future,art{scale,horns,wings},skills[],ultimate,mythlingId?}],',
      '           game{species,stage,mutation,body} (present when imported from the game snapshot; source:"game"),',
      '           rig{root[],nodes[],anchors[{name,parent,x,y,worldX,worldY}],parts{ROLE:nodeId},bounds}, animations[ids or objects], vfx[ids or objects] }',
      '',
      'ANIMATION { id,name,mythlingId,duration(s),loop,fps,easing, tracks{ nodeId: { part, keys[{t,x,y,rotation,scaleX,scaleY,opacity,ease}] } } }  (values are offsets over the rest pose)',
      'VFX { id,name,category,duration, emitters[{id,name,type,attach,x,y,scale,rotation,delay,duration,opacity,color,color2,count,speed,lifetime,gravity,spread,size,glow,trail,blend}] }',
      `  type ∈ ${VFX_TYPES.join('|')}   attach ∈ ${ATTACH_POINTS.join('|')}`,
      'OBJECT (library prop) { id,name,category,w,h,behavior,root[],nodes[] }  origin = ground point',
      'SKILL { id,name,element,type:normal|special|buff|debuff|ultimate,damageType,power,uses(0 = unlimited),effects?,tiers?(ultimates),animation,vfx,sound,shake,description,future? }',
      'GAME FORMAT (*.game.js, optional) — the same content rebuilt in the game\'s own src/data schema: MAPS entries {id,displayName,order,element,levelRange,music,visualTheme,width,height,spawn,ambient,regions[],water[],bridges[],buildings[],landmarks[],npcs[],trainers[],encounterZones[],connections[]},',
      '  SPECIES entries {id,displayName,breed,element,defaultRarity,defaultMood,role,starter,catchRate,expYield,description,baseStats,ultimate,spawnMaps,evolutions,skillUnlocks,art}, SKILLS/ULTIMATES and SKILL_VFX descriptors.',
      'ASSET { id,name,type,w,h,category,dataUrl }',
    ].join('\n');
  },
};
