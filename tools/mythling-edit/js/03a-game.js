// =============================================================================
// GAME PRESETS — bridges the frozen GameSnapshot (a read-only copy of the game's
// real data + art modules, embedded at build time) into editor documents.
//
//   Game.importMap(id)        → editor map with the exact regions / water / buildings /
//                               NPCs / trainers / encounter zones / connections of the game,
//                               plus the game's procedurally generated props (locked group)
//   Game.importMythling(id)   → editor Mythling whose parts are the game's own art layers
//                               ('gamepart' nodes drawn live by the game's draw code), the
//                               game's stats / evolutions / skill unlocks, anchors, and the
//                               12 game animations sampled into editable keyframes
//   Game.importSkills()       → every SKILLS / ULTIMATES entry
//   Game.importVfx(id)        → an editable emitter VFX derived from a SKILL_VFX descriptor
//   Game.buildProject()       → a whole project with everything above
//   Game.exportMapEntry(map)  → the map back in src/data/maps.js format (round-trip)
//   Game.exportSpeciesEntry() → the Mythling back in src/data/species.js format
// =============================================================================
const GAME_ANIM_NAMES = { idle: 'Idle', walk: 'Walk', run: 'Run', battleIdle: 'Battle Idle', normalAttack: 'Normal Attack', specialAttack: 'Special Attack', buff: 'Buff', ultimate: 'Ultimate', hit: 'Hit', faint: 'Faint', capture: 'Capture', evolve: 'Evolution' };
const GAME_PART_LABEL = { tail: 'TAIL', legBL: 'LEG_BL', legFL: 'LEG_FL', legBR: 'LEG_BR', legFR: 'LEG_FR', body: 'BODY', earL: 'EAR_L', earR: 'EAR_R', head: 'HEAD', wingL: 'WING_L', wingR: 'WING_R', mane: 'MANE' };
const GAME_PART_TYPE = { tail: 'Tail', body: 'Body', head: 'Head', mane: 'Mane' };
// approximate local boxes (relative to the base point) of the game's procedural props, for bounds / hit-testing
const GAME_PROP_BOX = {
  tree: [-24, -60, 48, 62], bigtree: [-36, -90, 72, 92], palm: [-30, -64, 60, 66], deadtree: [-20, -56, 40, 58], burnttree: [-20, -56, 40, 58],
  bush: [-22, -22, 44, 26], flower: [-9, -18, 18, 20], mushroom: [-9, -18, 18, 20], rock: [-16, -18, 32, 20], obsidian: [-18, -32, 36, 34],
  crystal: [-18, -38, 36, 40], stalag: [-16, -40, 32, 42], pillar: [-14, -64, 28, 66], crate: [-13, -22, 26, 24], barrel: [-11, -24, 22, 26],
  shell: [-9, -12, 18, 14], coral: [-15, -20, 30, 22], reed: [-11, -32, 22, 34], lamp: [-10, -52, 20, 54], brazier: [-16, -40, 32, 42], ember: [-11, -12, 22, 14], bone: [-12, -7, 24, 9],
};
const GAME_LANDMARK_BOX = { sign: [-26, -42, 52, 42], ruin: [-40, -68, 80, 68], crystal: [-54, -94, 108, 94], volcano: [-160, -190, 320, 190] };
const GAME_PROP_KINDS = Object.keys(GAME_PROP_BOX);

const Game = {
  get ok() { return !!GameSnapshot; },
  get S() { return GameSnapshot; },
  meta() { return GameSnapshot ? GameSnapshot.meta : null; },
  _world: null,
  world() { if (!this._world && GameSnapshot) this._world = new GameSnapshot.world.WorldRenderer(); return this._world; },
  speciesIds() { return GameSnapshot ? Object.keys(GameSnapshot.species.SPECIES) : []; },
  mapIds() { return GameSnapshot ? GameSnapshot.maps.MAP_ORDER.slice() : []; },
  species(id) { return GameSnapshot ? GameSnapshot.species.SPECIES[id] || null : null; },
  map(id) { return GameSnapshot ? GameSnapshot.maps.MAPS[id] || null : null; },
  items() { return GameSnapshot ? GameSnapshot.items.ITEMS : {}; },

  /** Registers the game's ground terrains, moods and rarities with the editor's palettes (idempotent). */
  install() {
    if (!GameSnapshot) return;
    for (const [id, cfg] of Object.entries(GameSnapshot.world.TERRAIN)) {
      const tid = `game_${id}`;
      if (TERRAIN_INDEX[tid] != null) continue;
      TERRAIN_INDEX[tid] = TERRAINS.length;
      TERRAINS.push({ id: tid, name: `${titleCase(id)} (game)`, color: cfg.grass, accent: cfg.grass2, path: cfg.path, game: id, props: cfg.props });
    }
    for (const m of Object.keys(GameSnapshot.moods.MOODS)) if (!MOODS.includes(m)) MOODS.push(m);
    for (const r of GameSnapshot.rarity.RARITY_ORDER) if (!RARITIES.includes(r)) RARITIES.push(r);
    ConsoleLog.info(`Game data snapshot loaded: ${this.speciesIds().length} Mythlings, ${this.mapIds().length} maps, ${Object.keys(GameSnapshot.skills.SKILLS).length} skills (game v${GameSnapshot.meta.gameVersion}, commit ${GameSnapshot.meta.commit})`);
  },
  gameTerrainId(t) { return TERRAIN_INDEX[`game_${t}`] != null ? `game_${t}` : ({ town: 'grass', flowers: 'grass', forest: 'forest', ruins: 'grass', port: 'grass', beach: 'sand', river: 'grass', cavern: 'rock', outpost: 'dirt', ash: 'dirt', cinder: 'dirt', molten: 'rock', volcanic_ruins: 'rock' }[t] || 'grass'); },
  terrainIdOf(map, x, y) { const c = clamp(Math.floor(x / map.cell), 0, map.cols - 1), r = clamp(Math.floor(y / map.cell), 0, map.rows - 1); const t = TERRAINS[map.terrain[r * map.cols + c]]; return t ? t.id : 'grass'; },

  // =========================================================================== maps
  importMap(gmOrId, { props = true } = {}) {
    const gm = typeof gmOrId === 'string' ? this.map(gmOrId) : gmOrId;
    if (!gm) return null;
    const T = GameSnapshot.world.TERRAIN, WC = GameSnapshot.world.WATER_COLORS;
    const firstT = gm.regions[0]?.terrain || 'forest';
    const map = newMap({ id: gm.id, name: gm.displayName, width: gm.width, height: gm.height, theme: gm.visualTheme || 'nature', music: gm.music || 'vale', levelMin: gm.levelRange?.[0] ?? 1, levelMax: gm.levelRange?.[1] ?? 10, background: (T[firstT] || T.forest).grass, baseTerrain: this.gameTerrainId(firstT), spawn: gm.spawn ? { x: gm.spawn.x, y: gm.spawn.y } : null });
    map.source = 'game';
    map.game = { id: gm.id, order: gm.order ?? 0, element: gm.element || 'nature', ambient: deepClone(gm.ambient || {}), music: gm.music, visualTheme: gm.visualTheme, levelRange: gm.levelRange ? [...gm.levelRange] : [1, 10] };
    const nid = (s) => `${gm.id}:${s}`;
    const grp = (key, name, extra = {}) => mapAddNode(map, makeNode('group', Object.assign({ id: nid(key), name, layer: 'objects' }, extra)));
    grp('regions_g', 'Regions (ground terrain)'); grp('water_g', 'Water & Lava'); grp('bridges_g', 'Bridges'); grp('buildings_g', 'Buildings');
    grp('landmarks_g', 'Landmarks'); grp('npcs_g', 'NPCs'); grp('trainers_g', 'Trainers'); grp('zones_g', 'Encounter Zones'); grp('warps_g', 'Connections (warps)'); grp('spawn_g', 'Player Spawn');
    // regions → ground paint + editable region rectangles
    for (const r of gm.regions || []) {
      const [x, y, w, h] = r.rect;
      paintRect(map, this.gameTerrainId(r.terrain), x, y, w, h);
      mapAddNode(map, makeNode('rect', { id: nid(r.id), name: r.name, x: x + w / 2, y: y + h / 2, shape: { w, h }, fill: 'transparent', stroke: '#ffffff', strokeWidth: 1, layer: 'terrain', tags: ['game', 'region'], gameId: r.id, behavior: { region: { id: r.id, terrain: r.terrain } } }), nid('regions_g'));
    }
    // water / lava
    (gm.water || []).forEach((wt, i) => {
      const cols = WC[wt.kind] || WC.pond;
      const n = makeNode('rect', { id: nid(`water_${i + 1}`), name: `${titleCase(wt.kind)} ${i + 1}`, x: wt.x + wt.w / 2, y: wt.y + wt.h / 2, shape: { w: wt.w, h: wt.h }, fill: cols[0], stroke: cols[1], strokeWidth: 0, layer: 'water', tags: ['game', 'water'], behavior: { water: wt.kind } });
      n.collision = Object.assign(n.collision, { enabled: true, type: 'rect', rect: [-wt.w / 2, -wt.h / 2, wt.w, wt.h], mode: 'water' });
      mapAddNode(map, n, nid('water_g'));
    });
    (gm.bridges || []).forEach((b, i) => mapAddNode(map, makePrefabNode('bridge', b.x + b.w / 2, b.y + b.h, { id: nid(`bridge_${i + 1}`), name: `Bridge ${i + 1}`, shape: { w: b.w, h: b.h }, tags: ['game'] }), nid('bridges_g')));
    // buildings
    for (const b of gm.buildings || []) {
      const n = makePrefabNode('game_building', b.x + b.w / 2, b.y + b.h, { id: nid(b.id), name: b.name || titleCase(b.type), shape: { w: b.w, h: b.h }, gameId: b.id, tags: ['game', 'building'] });
      n.behavior = Object.assign(n.behavior, { interactable: true, kind: b.type, name: b.name || '', stock: b.stock ? [...b.stock] : [] }); // (prefab defaults are merged after `extra`, so set these afterwards)
      n.collision = Object.assign(n.collision, { enabled: true, type: 'rect', rect: [-b.w / 2, -b.h, b.w, Math.max(4, b.h - 10)], mode: 'blocked' });
      mapAddNode(map, n, nid('buildings_g'));
    }
    // landmarks (signs, ruins, crystals, volcano)
    for (const lm of gm.landmarks || []) {
      const box = GAME_LANDMARK_BOX[lm.type] || [-20, -40, 40, 40];
      const n = makePrefabNode('game_landmark', lm.x, lm.y, { id: nid(lm.id), name: lm.type === 'sign' ? `Sign: ${(lm.text || '').split(/[—→]/)[0].trim().slice(0, 24)}` : titleCase(lm.type), gameKind: lm.type, gameId: lm.id, shape: { w: box[2], h: box[3] }, tags: ['game', 'landmark'] });
      n.behavior = Object.assign(n.behavior, { interactable: lm.type === 'sign', text: lm.text || '' });
      n.collision = Object.assign(n.collision, lm.type === 'sign' ? { enabled: true, type: 'rect', rect: [-6, -8, 12, 8] } : lm.type === 'volcano' ? { enabled: true, type: 'rect', rect: [-120, -60, 240, 60] } : { enabled: true, type: 'rect', rect: [-box[2] / 2 + 6, -18, box[2] - 12, 18] });
      mapAddNode(map, n, nid('landmarks_g'));
    }
    // npcs + trainers
    for (const np of gm.npcs || []) {
      mapAddNode(map, makeNode('npc', { id: nid(np.id), name: np.name, x: np.x, y: np.y, gameId: np.id, tags: ['game', 'npc'], npc: { kind: np.type === 'guide' ? 'guide' : 'regular', gameType: np.type, sprite: 'game', color: np.color || '#7ad06a', dialogue: [...(np.dialogue || [])], team: [], stock: [], flag: '' } }), nid('npcs_g'));
    }
    for (const tr of gm.trainers || []) {
      mapAddNode(map, makeNode('npc', { id: nid(tr.id), name: tr.name, x: tr.x, y: tr.y, gameId: tr.id, tags: ['game', 'trainer'], npc: { kind: 'trainer', sprite: 'game', color: tr.color || '#e0a86a', dialogue: [tr.intro || 'Let us battle!'], intro: tr.intro || '', defeat: tr.defeat || '', reward: deepClone(tr.reward || { coins: 0, items: {} }), team: (tr.team || []).map((t) => Object.assign({ species: t.species, level: t.level }, t.rarity ? { rarity: t.rarity } : {}, t.mood ? { mood: t.mood } : {})), stock: [], flag: tr.flag || '', guardian: !!tr.guardian, finalBoss: !!tr.finalBoss } }), nid('trainers_g'));
    }
    // encounter zones (weighted species pools)
    for (const z of gm.encounterZones || []) {
      const [x, y, w, h] = z.rect;
      const weights = {}; for (const s of z.species || []) weights[s.id] = s.weight;
      mapAddNode(map, makeNode('zone', { id: nid(z.id), name: `Zone ${z.id}`, x: x + w / 2, y: y + h / 2, shape: { w, h }, gameId: z.id, tags: ['game', 'zone'], zone: { name: z.id, species: (z.species || []).map((s) => s.id), weights, minLevel: z.levelRange?.[0] ?? 1, maxLevel: z.levelRange?.[1] ?? 5, weight: z.density ?? 5, mutationChance: 2 } }), nid('zones_g'));
    }
    // connections → warps
    for (const c of gm.connections || []) {
      const [x, y, w, h] = c.rect;
      mapAddNode(map, makeNode('warp', { id: nid(c.id), name: c.label || `To ${c.toMap}`, x: x + w / 2, y: y + h / 2, shape: { w, h }, gameId: c.id, tags: ['game', 'connection'], warp: { toMap: c.toMap, toX: c.toPoint?.x ?? 0, toY: c.toPoint?.y ?? 0, requiredFlag: c.requiresItem || '', label: c.label || '', lockedText: c.lockedText || '' } }), nid('warps_g'));
    }
    if (gm.spawn) mapAddNode(map, makeNode('spawn', { id: nid('player_spawn'), name: 'Player Spawn', x: gm.spawn.x, y: gm.spawn.y, tags: ['game'], spawn: { kind: 'player', direction: 'right', enabled: true } }), nid('spawn_g'));
    if (props) this.regenerateProps(map);
    return map;
  },
  /** Re-creates the game's procedural props for this map (same seeded RNG as the game → identical layout). */
  regenerateProps(map) {
    const gm = this.mapEntryFor(map);
    const gid = `${map.id}:props_g`;
    if (map.nodes[gid]) { for (const cid of [...map.nodes[gid].children]) delete map.nodes[cid]; map.nodes[gid].children = []; }
    else mapAddNode(map, makeNode('group', { id: gid, name: 'Generated Props (procedural in the game — locked)', layer: 'decorations', locked: true }));
    const W = this.world(); W.cache.delete(gm.id); W.cache.delete(`col_${gm.id}`);
    const list = W.props(gm);
    list.forEach((p, i) => {
      const box = GAME_PROP_BOX[p.kind] || [-12, -24, 24, 26];
      const n = makePrefabNode('game_prop', round(p.x, 1), round(p.y, 1), { id: `${map.id}:prop_${i}`, name: `${titleCase(p.kind)} ${i + 1}`, gameKind: p.kind, seed: round(p.seed, 3), scaleX: round(p.s, 3), scaleY: round(p.s, 3), shape: { w: box[2], h: box[3] }, layer: ['tree', 'bigtree', 'palm', 'deadtree', 'burnttree'].includes(p.kind) ? 'trees' : 'decorations', tags: ['game', 'prop'] });
      n.collision = Object.assign(n.collision, { enabled: !!p.solid, type: 'rect', rect: [-11, -8, 22, 14], mode: 'blocked' });
      mapAddNode(map, n, gid);
    });
    return list.length;
  },
  /** The map in the game's maps.js shape, rebuilt from the editor nodes (used by prop generation + export). */
  mapEntryFor(map) {
    const nodes = Object.values(map.nodes);
    const rectOf = (n) => [round(n.x - n.shape.w / 2, 1), round(n.y - n.shape.h / 2, 1), round(n.shape.w, 1), round(n.shape.h, 1)];
    const g = map.game || {};
    const regions = nodes.filter((n) => n.behavior?.region).map((n) => ({ id: n.behavior.region.id || slug(n.name), name: n.name, rect: rectOf(n), terrain: n.behavior.region.terrain || 'forest' }));
    const water = nodes.filter((n) => n.behavior?.water).map((n) => { const [x, y, w, h] = rectOf(n); return { x, y, w, h, kind: n.behavior.water }; });
    const bridges = nodes.filter((n) => n.type === 'prefab' && n.prefab === 'bridge').map((n) => ({ x: round(n.x - n.shape.w / 2, 1), y: round(n.y - n.shape.h, 1), w: round(n.shape.w, 1), h: round(n.shape.h, 1) }));
    const buildings = nodes.filter((n) => n.type === 'prefab' && (n.prefab === 'game_building' || (n.prefab === 'building' && n.behavior?.kind))).map((n) => { const b = { id: n.gameId || slug(n.name), type: n.behavior?.kind || 'house', x: round(n.x - n.shape.w / 2, 1), y: round(n.y - n.shape.h, 1), w: round(n.shape.w, 1), h: round(n.shape.h, 1), name: n.behavior?.name || n.name }; if (n.behavior?.stock?.length) b.stock = [...n.behavior.stock]; return b; });
    const landmarks = nodes.filter((n) => n.type === 'prefab' && (n.prefab === 'game_landmark' || n.prefab === 'sign')).map((n) => { const lm = { id: n.gameId || slug(n.name), type: n.prefab === 'sign' ? 'sign' : n.gameKind || 'ruin', x: round(n.x, 1), y: round(n.y, 1) }; if (lm.type === 'sign') lm.text = n.behavior?.text || ''; return lm; });
    const npcs = nodes.filter((n) => n.type === 'npc' && n.npc.kind !== 'trainer').map((n) => ({ id: n.gameId || slug(n.name), type: n.npc.gameType || (n.npc.kind === 'guide' ? 'guide' : 'villager'), x: round(n.x, 1), y: round(n.y, 1), name: n.name, color: n.npc.color, dialogue: [...n.npc.dialogue] }));
    const trainers = nodes.filter((n) => n.type === 'npc' && n.npc.kind === 'trainer').map((n) => { const t = { id: n.gameId || slug(n.name), name: n.name, x: round(n.x, 1), y: round(n.y, 1), color: n.npc.color, flag: n.npc.flag || slug(n.name) }; if (n.npc.guardian) t.guardian = true; if (n.npc.finalBoss) t.finalBoss = true; t.intro = n.npc.intro || n.npc.dialogue[0] || ''; t.defeat = n.npc.defeat || ''; t.reward = deepClone(n.npc.reward || { coins: 0, items: {} }); t.team = (n.npc.team || []).map((m) => { const e = { species: m.species, level: m.level }; if (m.rarity) e.rarity = m.rarity; if (m.mood) e.mood = m.mood; return e; }); return t; });
    const encounterZones = nodes.filter((n) => n.type === 'zone').map((n) => ({ id: n.gameId || slug(n.zone.name || n.name), rect: rectOf(n), levelRange: [n.zone.minLevel, n.zone.maxLevel], density: n.zone.weight ?? 5, species: n.zone.species.map((id) => ({ id, weight: (n.zone.weights || {})[id] ?? 1 })) }));
    const connections = nodes.filter((n) => n.type === 'warp').map((n) => { const c = { id: n.gameId || slug(n.name), rect: rectOf(n), toMap: n.warp.toMap, toPoint: { x: n.warp.toX, y: n.warp.toY } }; if (n.warp.requiredFlag) c.requiresItem = n.warp.requiredFlag; if (n.warp.lockedText) c.lockedText = n.warp.lockedText; c.label = n.warp.label || n.name; return c; });
    const spawnNode = nodes.find((n) => n.type === 'spawn' && n.spawn.kind === 'player');
    return {
      id: map.id, displayName: map.name, order: g.order ?? 0, element: g.element || 'nature', levelRange: [map.levelMin, map.levelMax], music: map.music || g.music || 'vale', visualTheme: map.theme || g.visualTheme || 'nature',
      width: map.width, height: map.height, spawn: spawnNode ? { x: round(spawnNode.x, 1), y: round(spawnNode.y, 1) } : (map.spawn || { x: 200, y: 200 }), ambient: deepClone(g.ambient || { sky: ['#bff0ff', '#e8ffd9'], fog: 'rgba(200,255,210,0.10)' }),
      regions, water, bridges, buildings, landmarks, npcs, trainers, encounterZones, connections,
    };
  },
  exportMapEntry(map) { return this.mapEntryFor(map); },
  /** Repaints the ground terrain from the region rectangles (after moving / resizing / re-typing them). */
  repaintRegions(map) {
    const regs = Object.values(map.nodes).filter((n) => n.behavior?.region);
    if (!regs.length) return 0;
    for (const n of regs) { const [x, y, w, h] = [n.x - n.shape.w / 2, n.y - n.shape.h / 2, n.shape.w, n.shape.h]; paintRect(map, this.gameTerrainId(n.behavior.region.terrain), x, y, w, h); }
    return regs.length;
  },

  // =========================================================================== creatures
  paletteFor(my) {
    const A = GameSnapshot.art, U = GameSnapshot.utils;
    const species = my?.game?.species || my?.id;
    const base = this.species(species) ? A.pal(species, my?.game?.mutation || 'none') : { primary: '#5fb45a', secondary: '#3c7a3f', belly: '#e9dfae', accent: '#8fe06a', eye: '#7cff7c', dark: '#2c5730' };
    const out = Object.assign({}, base, my?.palette || {});
    out.light = U.shadeColor(out.primary, 0.22); out.shadow = U.shadeColor(out.primary, -0.26); out.deep = U.shadeColor(out.dark, -0.15); out.bellyShade = U.shadeColor(out.belly, -0.14);
    return out;
  },
  /** Cached art context for (species, stage): art definition, skeleton, ex. */
  _ctxCache: new Map(),
  artContext(species, stage = 0) {
    const key = `${species}|${stage}`;
    if (this._ctxCache.has(key)) return this._ctxCache.get(key);
    const A = GameSnapshot.art; const art = A.artFor(species); if (!art) return null;
    const ex = A.artContext(species, stage, A.EXPRESSIONS.neutral, {}); const r = art.skel(ex);
    const v = { art, ex, r, parts: Object.fromEntries(art.parts.map((p) => [p.name, p])) };
    this._ctxCache.set(key, v); return v;
  },
  partDef(n) { const g = n.game; if (!g) return null; const c = this.artContext(g.species, g.stage || 0); return c ? { def: c.parts[g.part], ctx: c } : null; },
  /** Draws one game art layer in the node's local space (origin = the part's pivot). */
  drawPart(ctx, n, t, my, opts = {}) {
    const P = this.partDef(n); if (!P || !P.def) { drawMissing(ctx, n, `Missing game part ${n.game?.part || ''}`); return; }
    const A = GameSnapshot.art; const { def, ctx: C } = P; const [, , s = 1] = def.pivot(C.r);
    const c = this.paletteFor(my || (n.owner && E.project ? E.project.mythlings[n.owner] : null));
    const face = A.EXPRESSIONS[opts.expression || (my && my.expression) || 'neutral'] || A.EXPRESSIONS.neutral;
    const ex = Object.assign({}, C.ex, { face, excite: opts.excite || 0 });
    const T = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
    ctx.save();
    if (def.space === 'local' && s !== 1) ctx.scale(s, s);
    if (def.draw) { ctx.save(); if (def.space !== 'local') { const [px, py] = def.pivot(C.r); ctx.translate(-px, -py); } def.draw(ctx, c, ex, C.r, t, T); ctx.restore(); }
    if (def.live) { ctx.save(); if (def.space !== 'local') { const [px, py] = def.pivot(C.r); ctx.translate(-px, -py); } def.live(ctx, c, ex, C.r, t, T); ctx.restore(); }
    if (def.name === 'head' && C.art.face) { ctx.save(); A.drawFace(ctx, c, face, C.art.face, opts.blink || 0); ctx.restore(); }
    ctx.restore();
  },
  partBounds(n) {
    const P = this.partDef(n); if (!P || !P.def) return { x: -20, y: -20, w: 40, h: 40 };
    const [, , s = 1] = P.def.pivot(P.ctx.r); const [bx, by, bw, bh] = P.def.box || [0, 0, 1, 1];
    return { x: bx * s, y: by * s, w: bw * s, h: bh * s };
  },
  drawAmbient(ctx, my, t) {
    const R = GameSnapshot.rig; const species = my?.game?.species; if (!species || !R.drawAmbient) return;
    const C = this.artContext(species, my.stage || 0); if (!C) return;
    try { R.drawAmbient(ctx, this.paletteFor(my), species, t, C.r, 0); } catch { /* ambient is decorative */ }
  },
  anchorsFor(C, parts) {
    const r = C.r, face = C.art.face; const has = (p) => !!parts[p];
    const headS = (() => { const d = C.parts.head; return d ? (d.pivot(r)[2] ?? 1) : 1; })();
    const mouth = face?.mouth ? [face.mouth.x * headS, face.mouth.y * headS] : [14 * headS, 6 * headS];
    const eye = face?.eyes?.[0] ? [face.eyes[0].x * headS, face.eyes[0].y * headS] : [6, -2];
    const out = [['Root', null, 0, 0, '#ffffff']];
    if (has('body')) { out.push(['BodyCenter', 'body', 0, -6, '#60a5fa']); out.push(['VFXOrigin', 'body', 4, -14, '#c084fc']); }
    if (has('head')) { out.push(['Head', 'head', -6, -12, '#60a5fa']); out.push(['Mouth', 'head', mouth[0], mouth[1], '#f87171']); out.push(['Eye', 'head', eye[0], eye[1], '#fbbf24']); out.push(['AttackOrigin', 'head', mouth[0] + 18, mouth[1] - 4, '#fb923c']); out.push(['ProjectileOrigin', 'head', mouth[0] + 34, mouth[1] - 10, '#f97316']); }
    if (has('tail')) out.push(['TailBase', 'tail', 0, 0, '#4ade80'], ['Tail', 'tail', -26, -18, '#4ade80']);
    if (has('legFL')) out.push(['Foot_L', 'legFL', 0, r.legLen, '#22d3ee']);
    if (has('legFR')) out.push(['Foot_R', 'legFR', 0, r.legLen, '#22d3ee']);
    if (has('wingL')) out.push(['Wing_L', 'wingL', -18, -10, '#e879f9']);
    if (has('wingR')) out.push(['Wing_R', 'wingR', -18, -10, '#e879f9']);
    return out;
  },
  /** Builds rig nodes for a species/stage: ROOT group → one 'gamepart' per game art layer + anchors. */
  buildRig(species, stage, myId) {
    const C = this.artContext(species, stage); if (!C) return null;
    const nodes = {}, root = [], parts = {};
    const add = (n, parentId) => { nodes[n.id] = n; n.parent = parentId || null; if (parentId) nodes[parentId].children.push(n.id); else root.push(n.id); return n; };
    const rootN = add(makeNode('group', { id: `${myId}:ROOT`, name: 'ROOT', x: 0, y: 0, partType: 'Group' }));
    parts.ROOT = rootN.id;
    for (const def of C.art.parts) {
      const [px, py, s = 1] = def.pivot(C.r); const [, , bw, bh] = def.box || [0, 0, 1, 1];
      const n = makeNode('gamepart', { id: `${myId}:${def.name}`, name: GAME_PART_LABEL[def.name] || def.name.toUpperCase(), x: round(px, 2), y: round(py, 2), z: def.z, shape: { w: round(bw * s, 2), h: round(bh * s, 2) }, game: { species, stage, part: def.name, mutation: 'none' }, owner: myId, partType: GAME_PART_TYPE[def.name] || (def.name.startsWith('leg') ? 'Leg' : def.name.startsWith('ear') ? 'Ear' : def.name.startsWith('wing') ? 'Wing' : 'Detail'), fill: 'transparent', stroke: 'transparent', strokeWidth: 0, shadow: false });
      add(n, rootN.id); parts[def.name] = n.id;
    }
    for (const [name, part, x, y, color] of this.anchorsFor(C, parts)) add(makeNode('anchor', { id: `${myId}:anchor:${name}`, name, x: round(x, 2), y: round(y, 2), fill: color, z: 20, partType: 'Anchor' }), part ? parts[part] : rootN.id);
    return { nodes, root, parts };
  },
  importMythling(species, { stage = 0, id = null, project = E.project } = {}) {
    const sp = this.species(species); if (!sp) return null;
    const S = GameSnapshot; const myId = id || (stage ? `${species}_stage${stage}` : species);
    const rig = this.buildRig(species, stage, myId); if (!rig) return null;
    const evo = S.species.getEvolutionStage(species, stage);
    const ult = S.skills.ULTIMATES[sp.ultimate];
    const my = {
      id: myId, name: stage ? (evo?.name || sp.displayName) : sp.displayName, breed: sp.breed || '', element: sp.element, rarity: sp.defaultRarity || 'D', mood: sp.defaultMood || 'brave', role: sp.role || '', description: sp.description || '',
      bodyType: sp.art?.body || 'fox', catchRate: sp.catchRate ?? 0.5, expYield: sp.expYield ?? 60, starter: !!sp.starter, stage, level: evo?.level || 1, ultimate: sp.ultimate || '', spawnMaps: [...(sp.spawnMaps || [])],
      palette: { primary: sp.art.primary, secondary: sp.art.secondary, belly: sp.art.belly, accent: sp.art.accent, eye: sp.art.eye, dark: sp.art.dark },
      stats: deepClone(sp.baseStats), rig: { nodes: rig.nodes, root: rig.root }, parts: rig.parts, animations: [], vfx: [], assets: [],
      skillUnlocks: deepClone(sp.skillUnlocks || {}),
      evolutions: (sp.evolutions || []).map((e, i) => ({ stage: e.stage ?? i, name: e.name, level: e.level, statMult: e.statMult, future: !!e.future, art: deepClone(e.art || {}), skills: [...((sp.skillUnlocks || {})[e.level] || [])], ultimate: ult ? `${ult.baseName}${ult.tiers[i]?.suffix || ''}` : '' })),
      source: 'game', game: { species, stage, mutation: 'none', body: sp.art.body, displayName: sp.displayName },
    };
    // skills this Mythling can learn → VFX list
    const skillIds = [...new Set(Object.values(sp.skillUnlocks || {}).flat())];
    for (const sid of skillIds) if (project && (project.vfx[sid] || S.skillVfx.SKILL_VFX[sid])) { if (!project.vfx[sid]) { const v = this.importVfx(sid); if (v) project.vfx[v.id] = v; } if (project.vfx[sid]) my.vfx.push(sid); }
    if (project && sp.ultimate && !my.vfx.includes(sp.ultimate)) { if (!project.vfx[sp.ultimate]) { const v = this.importVfx(sp.ultimate); if (v) project.vfx[v.id] = v; } if (project.vfx[sp.ultimate]) my.vfx.push(sp.ultimate); }
    // animations sampled from the game's procedural controller
    if (project) for (const a of this.sampleAnimations(my)) { project.animations[a.id] = a; my.animations.push(a.id); }
    return my;
  },
  /** Re-samples the game's 12 animations for a Mythling (replaces its existing sampled clips). */
  sampleAnimations(my) {
    const R = GameSnapshot.rig; const species = my.game?.species; const C = this.artContext(species, my.game?.stage || 0); if (!C) return [];
    const tfMap = {}; for (const p of C.art.parts) tfMap[p.name] = R.newTf(); const root = R.newTf();
    const ctrl = new R.CreatureAnimationController(tfMap, root); ctrl.seed = 0; const fake = { tf: tfMap, root, blink: 0 };
    const parts = my.parts || {}; const rootId = parts.ROOT;
    const key = (t, T) => ({ t: round(t, 3), x: round(T.dx, 2), y: round(T.dy, 2), rotation: round(rad2deg(T.rot), 2), scaleX: round(T.sx, 3), scaleY: round(T.sy, 3), opacity: 1, ease: 'linear' });
    const out = [];
    for (const [gname, ename] of Object.entries(GAME_ANIM_NAMES)) {
      const def = R.ANIMATIONS[gname]; if (!def) continue;
      const loop = !!def.loop || gname === 'idle' || gname === 'battleIdle';
      const duration = def.loop || def.dur || (gname === 'idle' ? 4 : 3);
      const fps = duration < 1 ? 30 : duration >= 3 ? 15 : 20; const N = Math.max(2, Math.round(duration * fps));
      ctrl.state = gname; ctrl.speed = 1; ctrl.loop = loop; ctrl.next = null;
      const tracks = {}; const rootKeys = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * duration;
        ctrl.time = t; ctrl.phase = def.loop ? (t / def.loop) % 1 : def.dur ? Math.min(1, t / def.dur) : 0;
        ctrl.apply(fake, t);
        for (const [name, T] of Object.entries(tfMap)) { const nid = parts[name]; if (!nid) continue; (tracks[nid] = tracks[nid] || []).push(key(t, T)); }
        if (rootId) rootKeys.push(key(t, root));
      }
      if (rootId) tracks[rootId] = rootKeys;
      for (const k of Object.keys(tracks)) { tracks[k] = this.reduceKeys(tracks[k]); if (this.isStaticTrack(tracks[k])) delete tracks[k]; }
      out.push({ id: `${my.id}:anim:${gname}`, name: ename, mythlingId: my.id, duration: round(duration, 3), loop, fps, easing: 'linear', tracks, game: { state: gname, sampled: true } });
    }
    return out;
  },
  isStaticTrack(keys) { return keys.every((k) => Math.abs(k.x) < 0.02 && Math.abs(k.y) < 0.02 && Math.abs(k.rotation) < 0.05 && Math.abs(k.scaleX - 1) < 0.002 && Math.abs(k.scaleY - 1) < 0.002); },
  /** Drops sampled keys that linear interpolation between their neighbours already reproduces. */
  reduceKeys(keys, tol = { pos: 0.15, rot: 0.5, scale: 0.004 }) {
    if (keys.length <= 2) return keys;
    const keep = [keys[0]]; let i = 0;
    while (i < keys.length - 1) {
      let j = i + 2;
      while (j < keys.length) {
        const a = keys[i], b = keys[j]; let ok = true;
        for (let k = i + 1; k < j && ok; k++) {
          const m = keys[k]; const u = (m.t - a.t) / (b.t - a.t || 1);
          const L = (p) => a[p] + (b[p] - a[p]) * u;
          if (Math.abs(L('x') - m.x) > tol.pos || Math.abs(L('y') - m.y) > tol.pos || Math.abs(L('rotation') - m.rotation) > tol.rot || Math.abs(L('scaleX') - m.scaleX) > tol.scale || Math.abs(L('scaleY') - m.scaleY) > tol.scale) ok = false;
        }
        if (!ok) break;
        j++;
      }
      i = j - 1; keep.push(keys[i]);
    }
    if (keep[keep.length - 1] !== keys[keys.length - 1]) keep.push(keys[keys.length - 1]);
    return keep;
  },
  /** Switches a game-rigged Mythling to another evolution stage: re-positions parts from the stage's skeleton (horns / wings / growth follow automatically). */
  applyStage(my, stage) {
    const species = my.game?.species; if (!species) return false;
    const C = this.artContext(species, stage); if (!C) return false;
    for (const n of Object.values(my.rig.nodes)) {
      if (n.type !== 'gamepart' || !n.game) continue;
      const def = C.parts[n.game.part]; if (!def) continue;
      const [px, py, s = 1] = def.pivot(C.r); const [, , bw, bh] = def.box || [0, 0, 1, 1];
      n.game.stage = stage; n.x = round(px, 2); n.y = round(py, 2); n.shape = { w: round(bw * s, 2), h: round(bh * s, 2) };
    }
    my.game.stage = stage; my.stage = stage;
    const evo = GameSnapshot.species.getEvolutionStage(species, stage); if (evo && my.evolutions?.[stage]) my.name = my.evolutions[stage].name || my.name; else if (evo) my.name = evo.name;
    this._ctxCache.delete(`${species}|${stage}`);
    return true;
  },
  /** Player-facing summary of what the game art still controls (used by the export notes). */
  partOverrides(my) {
    const species = my.game?.species; if (!species) return [];
    const C = this.artContext(species, my.game?.stage || 0); if (!C) return [];
    const out = [];
    for (const n of Object.values(my.rig.nodes)) {
      if (n.type !== 'gamepart') continue; const def = C.parts[n.game.part]; if (!def) continue;
      const [px, py] = def.pivot(C.r);
      const o = { part: n.game.part }; let changed = false;
      if (Math.abs(n.x - px) > 0.05 || Math.abs(n.y - py) > 0.05) { o.dx = round(n.x - px, 2); o.dy = round(n.y - py, 2); changed = true; }
      if (Math.abs(n.rotation) > 0.05) { o.rotation = round(n.rotation, 2); changed = true; }
      if (Math.abs(n.scaleX - 1) > 0.005 || Math.abs(n.scaleY - 1) > 0.005) { o.scaleX = round(n.scaleX, 3); o.scaleY = round(n.scaleY, 3); changed = true; }
      if (n.opacity < 0.999) { o.opacity = round(n.opacity, 3); changed = true; }
      if (!n.visible) { o.hidden = true; changed = true; }
      if (n.z !== def.z) { o.z = n.z; changed = true; }
      if (changed) out.push(o);
    }
    return out;
  },
  exportSpeciesEntry(my) {
    const sp = this.species(my.game?.species) || {};
    const skillUnlocks = {};
    for (const e of my.evolutions || []) if (e.skills?.length) skillUnlocks[e.level] = [...e.skills];
    for (const [lvl, list] of Object.entries(my.skillUnlocks || {})) if (!skillUnlocks[lvl] && list?.length) skillUnlocks[lvl] = [...list];
    const entry = {
      id: my.id.replace(/_stage\d+$/, ''), displayName: my.game?.displayName || (my.game?.stage ? my.evolutions?.[0]?.name : my.name) || my.name, breed: my.breed, element: my.element, defaultRarity: my.rarity, defaultMood: my.mood, role: my.role,
      catchRate: my.catchRate ?? 0.5, expYield: my.expYield ?? 60, description: my.description, baseStats: deepClone(my.stats), ultimate: my.ultimate || sp.ultimate || '', spawnMaps: [...(my.spawnMaps || sp.spawnMaps || [])],
      evolutions: (my.evolutions || []).map((e, i) => { const o = { stage: e.stage ?? i, name: e.name, level: e.level, statMult: e.statMult }; if (e.future) o.future = true; o.art = Object.assign({ scale: 1 }, e.art || {}); return o; }),
      skillUnlocks: Object.fromEntries(Object.entries(skillUnlocks).sort((a, b) => +a[0] - +b[0])),
      art: Object.assign({ body: my.bodyType || my.game?.body || 'fox' }, my.palette || {}),
    };
    if (my.starter || (sp && 'starter' in sp)) entry.starter = !!my.starter;
    return entry;
  },

  // =========================================================================== skills & vfx
  skillAnimationFor(cat) { return { normal: 'Normal Attack', special: 'Special Attack', buff: 'Buff', debuff: 'Special Attack', ultimate: 'Ultimate' }[cat] || 'Normal Attack'; },
  importSkill(id) {
    const S = GameSnapshot; const sk = S.skills.SKILLS[id]; const ult = S.skills.ULTIMATES[id];
    if (!sk && !ult) return null;
    const fx = S.skillVfx.SKILL_VFX[id];
    if (ult) {
      return { id, name: ult.baseName, element: ult.element || 'none', type: 'ultimate', damageType: ult.damageType === undefined ? 'special' : ult.damageType, power: ult.tiers?.[0]?.power || 0, uses: 0, animation: 'Ultimate', vfx: fx ? id : `fx_${ult.element || 'none'}_ultimate`, sound: 'rumble', shake: fx?.impact?.shake ?? 14, description: ult.desc || '', tiers: deepClone(ult.tiers || []), source: 'game', game: deepClone(ult) };
    }
    const cat = sk.category || 'normal'; const el = sk.element || 'none';
    const s = { id, name: sk.name, element: el, type: cat, damageType: sk.damageType || (cat === 'special' ? 'special' : 'physical'), power: sk.power || 0, uses: sk.uses === Infinity || sk.uses == null ? 0 : sk.uses, animation: this.skillAnimationFor(cat), vfx: fx ? id : `fx_${el}_${cat}`, sound: { normal: 'hit_soft', special: 'whoosh', buff: 'chime', debuff: 'hiss', ultimate: 'rumble' }[cat] || 'hit_soft', shake: fx?.impact?.shake ?? { normal: 3, special: 7, buff: 0, debuff: 2, ultimate: 14 }[cat], description: sk.desc || '', source: 'game', game: deepClone(sk) };
    if (sk.effects) s.effects = deepClone(sk.effects);
    if (sk.future) s.future = true;
    if (s.game.uses === Infinity) s.game.uses = 'Infinity';
    return s;
  },
  importSkills(project = E.project) {
    const S = GameSnapshot; let n = 0;
    for (const id of [...Object.keys(S.skills.SKILLS), ...Object.keys(S.skills.ULTIMATES)]) { const s = this.importSkill(id); if (s) { project.skills[s.id] = s; n++; } }
    return n;
  },
  vfxCategory(el, cat) { return cat === 'buff' ? 'Buff' : cat === 'debuff' ? 'Debuff' : cat === 'ultimate' ? 'Ultimate' : { nature: 'Nature', water: 'Water', fire: 'Fire', rock: 'Rock' }[el] || 'Universal'; },
  /** Editable emitter VFX approximating a SKILL_VFX descriptor (cast → projectile → impact → aftermath) with the game's element palette. */
  importVfx(id) {
    const S = GameSnapshot; const d = S.skillVfx.SKILL_VFX[id]; if (!d) return null;
    const P = S.skillVfx.ELEMENT_VFX[d.element] || S.skillVfx.ELEMENT_VFX.none; const el = d.element || 'none'; const cat = d.category || 'special';
    const scatter = el === 'nature' ? 'leaf' : el === 'water' ? 'splash' : el === 'fire' ? 'flame' : el === 'rock' ? 'shockwave' : 'spark';
    const em = (type, o) => { const e = emitter(type, Object.assign({ color: P.mid, color2: P.core }, o)); for (const k of ['delay', 'duration', 'lifetime']) if (typeof e[k] === 'number') e[k] = round(e[k], 3); return e; };
    const emitters = []; let t = 0;
    const castDur = d.cast?.dur ?? 0.15;
    if (d.cast && d.cast.style !== 'none') {
      if (d.cast.style === 'crouch') emitters.push(em('particle', { name: 'Cast Dust', attach: 'Root', y: 0, color: '#c9bfa8', color2: '#ffffff', count: 6, speed: 40, lifetime: 0.3, gravity: -20, size: 4, duration: castDur, blend: 'source-over', opacity: 0.6 }));
      else emitters.push(em('glow', { name: d.cast.style === 'charge' ? 'Charge Glow' : 'Gather', attach: 'BodyCenter', y: 0, color: P.glow, color2: P.core, duration: castDur, size: d.cast.style === 'charge' ? 90 : 60, count: 1, glow: d.cast.style === 'charge' ? 40 : 22 }), em(d.cast.shape === 'leaf' ? 'leaf' : el === 'water' ? 'particle' : el === 'fire' ? 'spark' : 'particle', { name: 'Gathering Motes', attach: 'BodyCenter', y: 0, color: P.mid, color2: P.spark, count: 10, speed: 60, lifetime: castDur + 0.1, gravity: -40, size: 4, duration: castDur }));
    }
    t += castDur;
    const projDur = d.projectile?.dur ?? 0;
    if (d.projectile) {
      const st = d.projectile.style;
      if (['lunge', 'dash', 'contact'].includes(st)) emitters.push(em('trail', { name: 'Dash Streak', attach: 'AttackOrigin', delay: t, duration: projDur || 0.2, color: P.spark, color2: P.mid, count: 10, speed: 30, lifetime: 0.25, gravity: 0, size: 4, opacity: 0.7 }));
      else emitters.push(em('projectile', { name: `${titleCase(st)} Projectile`, attach: 'AttackOrigin', delay: t, duration: projDur || 0.3, color: P.mid, color2: P.core, size: cat === 'ultimate' ? 18 : 12, trail: 1, glow: 14, count: 1 }), em(scatter, { name: `${titleCase(d.projectile.trail || scatter)} Trail`, attach: 'AttackOrigin', delay: t, duration: projDur || 0.3, color: P.mid, color2: P.core, count: 12, speed: 40, lifetime: 0.4, gravity: 30, size: 5, blend: 'source-over', opacity: 0.8 }));
    }
    t += projDur;
    if (d.impact) {
      emitters.push(em('burst', { name: `${titleCase(d.impact.style || 'impact')} Flash`, attach: 'Target', delay: t, duration: 0.22, color: P.core, color2: P.glow, size: cat === 'ultimate' ? 90 : 46, count: 1, glow: 24 }));
      if (d.impact.ring || cat === 'ultimate') emitters.push(em('ring', { name: 'Impact Ring', attach: 'Target', delay: t, duration: 0.4, color: P.glow, color2: P.core, size: cat === 'ultimate' ? 130 : 70, count: 1, glow: 12 }));
      emitters.push(em(scatter, { name: `${titleCase(scatter)} Scatter`, attach: 'Target', delay: t, color: P.mid, color2: P.core, count: cat === 'ultimate' ? 36 : 18, speed: cat === 'ultimate' ? 260 : 180, lifetime: 0.6, gravity: el === 'fire' ? -40 : 120, size: 6, blend: 'source-over' }));
    }
    const afterDur = d.aftermath?.dur ?? 0.3;
    if (d.aftermath) emitters.push(em(['dust', 'smoke', 'burn', 'mist'].includes(d.aftermath.style) ? 'smoke' : ['pollen', 'feathers', 'petalStorm'].includes(d.aftermath.style) ? 'particle' : scatter, { name: `${titleCase(d.aftermath.style)} Aftermath`, attach: 'Target', delay: t + 0.1, duration: afterDur, color: d.aftermath.style === 'dust' ? '#c9bfa8' : d.aftermath.style === 'smoke' || d.aftermath.style === 'burn' ? '#5a5a66' : P.glow, color2: P.core, count: 10, speed: 40, lifetime: afterDur, gravity: -30, size: 9, opacity: 0.55, blend: 'source-over' }));
    return { id, name: (S.skills.SKILLS[id]?.name || S.skills.ULTIMATES[id]?.baseName || titleCase(id)) + ' (game)', category: this.vfxCategory(el, cat), duration: round(t + 0.25 + afterDur, 2), shake: d.impact?.shake ?? d.camera?.shake ?? 0, emitters, source: 'game', game: deepClone(d) };
  },
  /** Generic element × category fallbacks the game uses when a skill has no descriptor of its own. */
  importFallbackVfx(project = E.project) {
    const S = GameSnapshot; let n = 0;
    for (const el of Object.keys(S.skillVfx.ELEMENT_VFX)) for (const cat of ['normal', 'special', 'buff', 'debuff', 'ultimate']) {
      const id = `fx_${el}_${cat}`; if (project.vfx[id]) continue;
      const fb = { normal: { cast: { style: 'crouch', dur: 0.12 }, projectile: { style: 'lunge', dur: 0.18 }, impact: { style: 'slash', shake: 3 }, aftermath: { style: 'dust', dur: 0.24 } }, special: { cast: { style: 'gather', dur: 0.18 }, projectile: { style: 'orb', dur: 0.3 }, impact: { style: 'burst', shake: 7, ring: true }, aftermath: { style: 'pollen', dur: 0.4 } }, buff: { cast: { style: 'gather', dur: 0.5 }, impact: null, aftermath: { style: 'pollen', dur: 0.4 } }, debuff: { cast: { style: 'gather', dur: 0.18 }, projectile: { style: 'orb', dur: 0.3 }, impact: { style: 'burst', shake: 2 }, aftermath: { style: 'mist', dur: 0.4 } }, ultimate: { cast: { style: 'charge', dur: 0.4 }, projectile: { style: 'orb', dur: 0.4 }, impact: { style: 'burst', shake: 14, ring: true, flash: 0.5 }, aftermath: { style: 'pollen', dur: 0.7 } } }[cat];
      const tmp = S.skillVfx.SKILL_VFX[id]; S.skillVfx.SKILL_VFX[id] = Object.assign({ id, element: el, category: cat }, fb);
      const v = this.importVfx(id); if (tmp) S.skillVfx.SKILL_VFX[id] = tmp; else delete S.skillVfx.SKILL_VFX[id];
      if (v) { v.name = `${titleCase(el)} ${titleCase(cat)} (game fallback)`; v.game.fallback = true; project.vfx[id] = v; n++; }
    }
    return n;
  },
  exportSkillEntry(s) {
    const base = s.game ? deepClone(s.game) : {}; // keeps fields the editor does not model (e.g. future: true)
    if (s.type === 'ultimate') {
      // support ultimates (buff / debuff) carry damageType: null in the game data — keep it that way
      const dt = s.damageType !== undefined ? s.damageType : base.damageType;
      return Object.assign(base, { id: s.id, baseName: s.name, element: s.element === 'none' ? null : s.element, damageType: dt === undefined ? 'special' : dt, tiers: deepClone(s.tiers || [{ suffix: '', power: s.power, unlockLevel: 10 }]), desc: s.description || '' });
    }
    const e = Object.assign(base, { id: s.id, name: s.name, category: s.type });
    if (['normal', 'special'].includes(s.type) || s.power) { e.damageType = s.damageType || (s.type === 'special' ? 'special' : 'physical'); e.element = s.element === 'none' ? null : s.element; e.power = s.power; }
    else { delete e.damageType; delete e.element; delete e.power; }
    if (s.effects) e.effects = deepClone(s.effects); else delete e.effects;
    e.uses = s.uses ? s.uses : 'Infinity';
    e.desc = s.description || '';
    return e;
  },
  exportVfxEntry(v) { return v.game && !v.game.fallback ? Object.assign(deepClone(v.game), { id: v.id }) : { id: v.id, element: { Nature: 'nature', Water: 'water', Fire: 'fire' }[v.category] || 'none', category: v.category === 'Buff' ? 'buff' : v.category === 'Debuff' ? 'debuff' : v.category === 'Ultimate' ? 'ultimate' : 'special', editorEmitters: deepClone(v.emitters) }; },

  // =========================================================================== whole project
  buildProject(name = 'Mythlings Wildbound (game presets)') {
    const p = emptyProject(name, 'mythlings-wildbound-game');
    p.project.source = 'game';
    p.project.game = deepClone(GameSnapshot.meta);
    for (const id of this.mapIds()) { const m = this.importMap(id); if (m) p.maps[m.id] = m; }
    this.importSkills(p);
    for (const id of Object.keys(GameSnapshot.skillVfx.SKILL_VFX)) { const v = this.importVfx(id); if (v) p.vfx[v.id] = v; }
    this.importFallbackVfx(p);
    for (const id of this.speciesIds()) { const my = this.importMythling(id, { project: p }); if (my) p.mythlings[my.id] = my; }
    return p;
  },
  /** Adds (or resets) one game preset in the current project. kind: 'map' | 'mythling' | 'skills' | 'vfx' */
  addPreset(kind, id, { stage = 0 } = {}) {
    const p = E.project; if (!p || !GameSnapshot) return null;
    let made = null;
    History.run(`Import game ${kind}`, () => {
      if (kind === 'map') { const m = this.importMap(id); if (m) { p.maps[m.id] = m; made = m; } }
      else if (kind === 'mythling') { const my = this.importMythling(id, { stage, project: p }); if (my) { for (const aid of p.mythlings[my.id]?.animations || []) delete p.animations[aid]; p.mythlings[my.id] = my; made = my; } }
      else if (kind === 'skills') { made = this.importSkills(p); }
      else if (kind === 'vfx') { if (id) { const v = this.importVfx(id); if (v) { p.vfx[v.id] = v; made = v; } } else { for (const vid of Object.keys(GameSnapshot.skillVfx.SKILL_VFX)) { const v = this.importVfx(vid); if (v) p.vfx[v.id] = v; } made = this.importFallbackVfx(p); } }
    });
    invalidateMatrices(); UI.refreshAll();
    return made;
  },
};

// ---------------------------------------------------------------- game prefabs (drawn by the game's own world renderer)
Object.assign(PREFABS, {
  game_prop: { name: 'Game Prop', category: 'Game', icon: 'tree', w: 48, h: 62, layer: 'decorations', collision: { type: 'rect', rect: [-11, -8, 22, 14] },
    draw(ctx, n, t = 0) { if (!Game.ok) { drawMissing(ctx, n, 'Game data missing'); return; } const kind = n.gameKind || 'tree'; Game.world().drawProp(ctx, { kind, x: 0, y: 0, s: 1, seed: n.seed || 0, solid: true }, settings().livePreview ? t : 0); } },
  game_building: { name: 'Game Building', category: 'Game', icon: 'building', w: 200, h: 140, layer: 'objects', collision: { type: 'rect', rect: [-100, -140, 200, 130] }, behavior: { interactable: true, kind: 'house', name: 'House', stock: [] },
    draw(ctx, n, t = 0) { if (!Game.ok) { drawMissing(ctx, n, 'Game data missing'); return; } const w = n.shape.w, hh = n.shape.h; Game.world().drawBuilding(ctx, { x: -w / 2, y: -hh, w, h: hh, type: n.behavior?.kind || 'house', name: n.behavior?.name || n.name || '' }, t); } },
  game_landmark: { name: 'Game Landmark', category: 'Game', icon: 'crystal', w: 80, h: 68, layer: 'objects', collision: { type: 'rect', rect: [-30, -18, 60, 18] }, behavior: { interactable: false, text: '' },
    draw(ctx, n, t = 0) { if (!Game.ok) { drawMissing(ctx, n, 'Game data missing'); return; } Game.world().drawLandmark(ctx, { x: 0, y: 0, type: n.gameKind || 'ruin', text: n.behavior?.text || '' }, settings().livePreview ? t : 0); } },
});
/** Per-kind library cards for the game's props / buildings / landmarks (aliases of the three generic prefabs). */
Game.installLibrary = function installLibrary() {
  if (!GameSnapshot || PREFAB_CATEGORIES.includes('Game')) return;
  PREFAB_CATEGORIES.push('Game');
  for (const kind of GAME_PROP_KINDS) { const b = GAME_PROP_BOX[kind]; PREFABS[`game_prop_${kind}`] = { name: `${titleCase(kind)} (game)`, category: 'Game', icon: 'tree', alias: 'game_prop', gameKind: kind, w: b[2], h: b[3], layer: ['tree', 'bigtree', 'palm', 'deadtree', 'burnttree'].includes(kind) ? 'trees' : 'decorations', draw(ctx, n, t) { PREFABS.game_prop.draw(ctx, Object.assign({ gameKind: kind }, n), t); } }; }
  for (const type of ['center', 'shop', 'house', 'dock', 'tower']) PREFABS[`game_building_${type}`] = { name: `${titleCase(type)} (game)`, category: 'Game', icon: 'building', alias: 'game_building', gameKind: type, w: type === 'tower' ? 120 : 200, h: type === 'tower' ? 220 : 140, layer: 'objects', draw(ctx, n, t) { PREFABS.game_building.draw(ctx, Object.assign({}, n, { behavior: { kind: type, name: titleCase(type) } }), t); } };
  for (const type of Object.keys(GAME_LANDMARK_BOX)) { const b = GAME_LANDMARK_BOX[type]; PREFABS[`game_landmark_${type}`] = { name: `${titleCase(type)} (game)`, category: 'Game', icon: 'crystal', alias: 'game_landmark', gameKind: type, w: b[2], h: b[3], layer: 'objects', draw(ctx, n, t) { PREFABS.game_landmark.draw(ctx, Object.assign({ gameKind: type }, n), t); } }; }
};
