// =============================================================================
// Content model: terrain, collision, elements, node factories, prefab library
// =============================================================================
const TERRAINS = [
  { id: 'none', name: 'Clear', color: null },
  { id: 'grass', name: 'Grass', color: '#4f9d4a', accent: '#5fb45a' },
  { id: 'dirt', name: 'Dirt', color: '#8a6a44', accent: '#9c7a52' },
  { id: 'path', name: 'Path', color: '#c8b27a', accent: '#d8c48e' },
  { id: 'sand', name: 'Sand', color: '#e0cf95', accent: '#ecdca8' },
  { id: 'rock', name: 'Rock', color: '#7d848c', accent: '#8f969e' },
  { id: 'water', name: 'Water', color: '#3f86c8', accent: '#5aa0dc' },
  { id: 'lava', name: 'Lava', color: '#d8501e', accent: '#ff8a3c' },
  { id: 'forest', name: 'Forest Floor', color: '#3b6f3a', accent: '#4a8546' },
  { id: 'cliff', name: 'Cliff', color: '#5c5f66', accent: '#6d7078' },
];
const TERRAIN_INDEX = Object.fromEntries(TERRAINS.map((t, i) => [t.id, i]));
const COLLISION_MODES = [
  { id: 'walkable', name: 'Walkable', color: '#22c55e', value: 0 },
  { id: 'blocked', name: 'Blocked', color: '#ef4444', value: 1 },
  { id: 'water', name: 'Water', color: '#3b82f6', value: 2 },
  { id: 'trigger', name: 'Trigger', color: '#f97316', value: 3 },
  { id: 'special', name: 'Special Zone', color: '#a855f7', value: 4 },
];
const COLLISION_LAYERS = ['player', 'npc', 'mythling', 'projectile', 'interaction'];
const ELEMENTS = { nature: { name: 'Nature', color: '#4fc76a' }, water: { name: 'Water', color: '#4aa8e8' }, fire: { name: 'Fire', color: '#f0743a' }, rock: { name: 'Rock', color: '#c9a86c' }, electric: { name: 'Electric', color: '#f4d03f' }, ice: { name: 'Ice', color: '#8fdcff' }, metal: { name: 'Metal', color: '#a9b4c2' }, poison: { name: 'Poison', color: '#b06fe0' }, psychic: { name: 'Psychic', color: '#ff6fb5' }, none: { name: 'None', color: '#9aa7bd' } };
const RARITIES = ['D', 'C', 'B', 'A', 'S'];
const MOODS = ['brave', 'clever', 'sturdy', 'playful', 'aggressive', 'focused', 'calm', 'brutal'];
const ANIM_NAMES = ['Idle', 'Walk', 'Run', 'Battle Idle', 'Normal Attack', 'Special Attack', 'Buff', 'Ultimate', 'Hit', 'Faint', 'Capture', 'Evolution'];
const VFX_TYPES = ['particle', 'trail', 'projectile', 'burst', 'ring', 'glow', 'shockwave', 'splash', 'flame', 'leaf', 'vine', 'smoke', 'spark', 'aura'];
const VFX_CATEGORIES = ['Nature', 'Water', 'Fire', 'Rock', 'Electric', 'Ice', 'Metal', 'Poison', 'Psychic', 'Universal', 'Buff', 'Debuff', 'Ultimate'];
const ATTACH_POINTS = ['AttackOrigin', 'VFXOrigin', 'Mouth', 'Head', 'Body', 'BodyCenter', 'Tail', 'TailBase', 'Root', 'Target', 'TargetCenter', 'World'];
const NPC_TYPES = ['regular', 'trainer', 'shop', 'healer', 'savepoint', 'quest', 'guide'];
const BLEND_MODES = ['source-over', 'lighter', 'multiply', 'screen', 'overlay'];
const NODE_TYPES = ['group', 'rect', 'ellipse', 'polygon', 'path', 'image', 'text', 'prefab', 'npc', 'mythling', 'zone', 'spawn', 'warp', 'trigger', 'anchor', 'gamepart'];
const CREATURE_PART_TYPES = ['Body', 'Head', 'Ear', 'Eye', 'Snout', 'Leg', 'Tail', 'Wing', 'Fin', 'Horn', 'Mane', 'Detail', 'Group'];

// ---------------------------------------------------------------- node factory
function makeNode(type, props = {}) {
  const n = normalizeNode(Object.assign({ id: uid('n'), type }, props));
  if (type === 'group') { n.fill = 'transparent'; n.shape = {}; }
  if (type === 'anchor') { n.shape = {}; n.fill = props.fill || '#f2c761'; }
  if (type === 'zone') { n.fill = props.fill || '#22c55e'; n.layer = 'triggers'; n.zone = Object.assign({ name: n.name, species: [], minLevel: 1, maxLevel: 5, weight: 5, mutationChance: 2 }, props.zone || {}); }
  if (type === 'spawn') { n.spawn = Object.assign({ kind: 'player', direction: 'down', zone: '', enabled: true }, props.spawn || {}); n.shape = { w: 32, h: 32 }; n.layer = 'triggers'; }
  if (type === 'warp') { n.fill = props.fill || '#22d3ee'; n.layer = 'triggers'; n.warp = Object.assign({ toMap: '', toX: 0, toY: 0, requiredFlag: '', label: '' }, props.warp || {}); }
  if (type === 'trigger') { n.fill = props.fill || '#f97316'; n.layer = 'triggers'; n.trigger = Object.assign({ event: 'message', payload: 'Something happens here.', once: false }, props.trigger || {}); }
  if (type === 'npc') {
    n.layer = 'npcs'; n.shape = { w: 34, h: 52 };
    n.npc = Object.assign({ kind: 'regular', sprite: 'villager', direction: 'down', color: '#7ad06a', dialogue: ['Hello, traveller!'], team: [], stock: [], flag: '' }, props.npc || {});
    n.collision = Object.assign(n.collision, { enabled: true, type: 'rect', rect: [-14, -18, 28, 18] });
  }
  if (type === 'mythling') {
    n.layer = 'mythlings'; n.shape = { w: 110, h: 90 };
    n.mythling = Object.assign({ species: 'spriggo', level: 5, behavior: 'wander', facing: 'right', animation: 'Idle' }, props.mythling || {});
    n.collision = Object.assign(n.collision, { enabled: true, type: 'circle', radius: 20 });
  }
  if (type === 'text') { n.text = props.text || 'Text'; n.fontSize = props.fontSize || 18; n.fill = props.fill || '#ffffff'; }
  if (type === 'gamepart') { n.game = Object.assign({ species: 'spriggo', stage: 0, part: 'body', mutation: 'none' }, props.game || {}); n.fill = 'transparent'; n.stroke = 'transparent'; n.strokeWidth = 0; n.shadow = false; }
  return n;
}
function makePrefabNode(prefabId, x, y, extra = {}) {
  const pf = PREFABS[prefabId];
  if (!pf) return makeNode('rect', { x, y });
  if (pf.alias) {
    const n = makePrefabNode(pf.alias, x, y, Object.assign({ name: pf.name.replace(/ \(game\)$/, ''), gameKind: pf.gameKind, layer: pf.layer || PREFABS[pf.alias].layer, shape: { w: pf.w, h: pf.h }, seed: round(Math.random() * 1000, 3) }, extra));
    if (pf.alias === 'game_building') { n.behavior.kind = pf.gameKind; n.behavior.name = n.name; n.collision.rect = [-pf.w / 2, -pf.h, pf.w, Math.max(4, pf.h - 10)]; }
    if (pf.alias === 'game_landmark') { n.behavior.interactable = pf.gameKind === 'sign'; if (pf.gameKind === 'sign') { n.behavior.text = 'A wooden sign.'; n.collision.rect = [-6, -8, 12, 8]; } if (pf.gameKind === 'volcano') n.collision.rect = [-120, -60, 240, 60]; }
    return n;
  }
  const n = makeNode('prefab', Object.assign({
    name: pf.name, prefab: prefabId, x, y, layer: pf.layer || 'objects', shape: { w: pf.w, h: pf.h }, fill: pf.fill || '#6fa8dc', variant: 0,
  }, extra));
  if (pf.collision) n.collision = Object.assign(n.collision, deepClone(pf.collision), { enabled: true });
  if (pf.behavior) n.behavior = Object.assign(n.behavior, deepClone(pf.behavior));
  return n;
}
/** Local-space bounding box {x,y,w,h} of a node's own geometry (children excluded). */
function localBounds(n) {
  switch (n.type) {
    case 'group': return { x: -8, y: -8, w: 16, h: 16 };
    case 'anchor': return { x: -6, y: -6, w: 12, h: 12 };
    case 'polygon': case 'path': return boundsOfPoints(n.points || []);
    case 'gamepart': return (typeof Game !== 'undefined' && Game.ok) ? Game.partBounds(n) : { x: -n.shape.w / 2, y: -n.shape.h / 2, w: n.shape.w, h: n.shape.h };
    case 'prefab': if (n.prefab === 'game_prop' || n.prefab === 'game_landmark') { const b = (n.prefab === 'game_prop' ? GAME_PROP_BOX[n.gameKind] : GAME_LANDMARK_BOX[n.gameKind]) || [-n.shape.w / 2, -n.shape.h, n.shape.w, n.shape.h]; return { x: b[0], y: b[1], w: b[2], h: b[3] }; } // falls through
    case 'npc': case 'mythling': return { x: -n.shape.w / 2, y: -n.shape.h, w: n.shape.w, h: n.shape.h };
    case 'text': { const w = (n.text || '').length * (n.fontSize || 18) * 0.55; return { x: -w / 2, y: -(n.fontSize || 18) * 0.7, w, h: (n.fontSize || 18) * 1.2 }; }
    default: return { x: -n.shape.w / 2, y: -n.shape.h / 2, w: n.shape.w, h: n.shape.h };
  }
}
function hitLocal(n, lx, ly, tol = 4) {
  const b = localBounds(n);
  switch (n.type) {
    case 'ellipse': { const rx = n.shape.w / 2 || 1, ry = n.shape.h / 2 || 1; return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1; }
    case 'polygon': return pointInPolygon(lx, ly, n.points) || distToPolyline(lx, ly, n.points, true) <= tol;
    case 'path': return (n.closed && pointInPolygon(lx, ly, n.points)) || distToPolyline(lx, ly, n.points, !!n.closed) <= Math.max(tol, (n.strokeWidth || 2) / 2 + 2);
    case 'anchor': return Math.hypot(lx, ly) <= 9;
    case 'group': return Math.hypot(lx, ly) <= 8;
    default: return lx >= b.x - tol && lx <= b.x + b.w + tol && ly >= b.y - tol && ly <= b.y + b.h + tol;
  }
}

// ---------------------------------------------------------------- prefab library (procedural vector props)
// Every prefab draws at its local origin = the point where it touches the ground.
function pfShadow(ctx, w, h, k = 0.5) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(0, 0, w * k, Math.max(4, w * k * 0.32), 0, 0, Math.PI * 2); ctx.fill();
}
function pfEllipse(ctx, x, y, rx, ry, fill, stroke) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function pfPoly(ctx, pts, fill, stroke) {
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function pfRect(ctx, x, y, w, h, fill, stroke, r = 0) {
  ctx.beginPath();
  if (r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
const TREE_PALETTES = [
  { leaf: '#3f9a4a', leaf2: '#5fc26a', trunk: '#6b4a2e' }, { leaf: '#2f7d3f', leaf2: '#4aa856', trunk: '#5a3d26' },
  { leaf: '#7fb53a', leaf2: '#a6d95a', trunk: '#7a5433' }, { leaf: '#d67ab0', leaf2: '#f0a2cf', trunk: '#6b4a2e' },
];
const PREFABS = {
  // --- nature
  tree: { name: 'Tree', category: 'Nature', icon: 'tree', w: 96, h: 150, layer: 'trees', collision: { type: 'rect', rect: [-14, -18, 28, 18] }, behavior: { wind: 'soft', windAmount: 2 },
    draw(ctx, n, t) {
      const p = TREE_PALETTES[(n.variant || 0) % TREE_PALETTES.length];
      pfShadow(ctx, 40, 0);
      pfRect(ctx, -9, -58, 18, 60, p.trunk, shade(p.trunk, 0.35), 4);
      ctx.fillStyle = shade(p.trunk, 0.2); ctx.fillRect(-3, -50, 3, 44);
      pfEllipse(ctx, 0, -92, 46, 44, shade(p.leaf, 0.2), shade(p.leaf, 0.45));
      pfEllipse(ctx, -14, -104, 30, 30, p.leaf);
      pfEllipse(ctx, 16, -100, 28, 28, p.leaf);
      pfEllipse(ctx, 2, -118, 26, 24, p.leaf2);
      ctx.fillStyle = rgba('#ffffff', 0.18); ctx.beginPath(); ctx.ellipse(-8, -122, 10, 6, -0.5, 0, Math.PI * 2); ctx.fill();
    } },
  bush: { name: 'Bush', category: 'Nature', icon: 'bush', w: 70, h: 44, layer: 'decorations', collision: { type: 'circle', radius: 22 },
    draw(ctx, n) { const p = TREE_PALETTES[(n.variant || 0) % TREE_PALETTES.length]; pfShadow(ctx, 30, 0); pfEllipse(ctx, 0, -16, 34, 18, shade(p.leaf, 0.15), shade(p.leaf, 0.45)); pfEllipse(ctx, -12, -22, 18, 16, p.leaf); pfEllipse(ctx, 12, -24, 18, 17, p.leaf2); pfEllipse(ctx, 0, -30, 14, 12, p.leaf2); } },
  flower: { name: 'Flower', category: 'Nature', icon: 'flower', w: 26, h: 34, layer: 'decorations', collision: null,
    draw(ctx, n) { const cols = ['#ff8fb0', '#ffd66a', '#8fb7ff', '#ffffff']; const c = cols[(n.variant || 0) % cols.length]; ctx.strokeStyle = '#3f8f3f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(3, -12, 0, -22); ctx.stroke(); for (let i = 0; i < 5; i++) { const a = (Math.PI * 2 / 5) * i; pfEllipse(ctx, Math.cos(a) * 6, -24 + Math.sin(a) * 6, 5, 5, c); } pfEllipse(ctx, 0, -24, 3.5, 3.5, '#ffdf6a'); } },
  log: { name: 'Log', category: 'Nature', icon: 'log', w: 80, h: 30, layer: 'objects', collision: { type: 'rect', rect: [-38, -20, 76, 20] },
    draw(ctx) { pfShadow(ctx, 38, 0, 0.5); pfRect(ctx, -36, -26, 72, 24, '#7a5433', '#4a3320', 8); pfEllipse(ctx, 36, -14, 8, 12, '#c9a26b', '#4a3320'); pfEllipse(ctx, 36, -14, 4, 6, '#a5794a'); ctx.strokeStyle = '#5c3f26'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-28, -18); ctx.lineTo(20, -18); ctx.moveTo(-24, -10); ctx.lineTo(24, -10); ctx.stroke(); } },
  rock: { name: 'Rock', category: 'Nature', icon: 'rock', w: 64, h: 46, layer: 'objects', collision: { type: 'rect', rect: [-28, -22, 56, 22] },
    draw(ctx, n) { const cols = ['#8d949c', '#7a7f88', '#9aa3ad']; const c = cols[(n.variant || 0) % cols.length]; pfShadow(ctx, 28, 0); pfPoly(ctx, [[-30, -4], [-24, -26], [-6, -40], [16, -36], [30, -18], [26, -2]], c, shade(c, 0.45)); pfPoly(ctx, [[-16, -20], [-4, -34], [12, -30], [8, -18]], tint(c, 0.2)); } },
  mushroom: { name: 'Mushroom', category: 'Nature', icon: 'mushroom', w: 30, h: 34, layer: 'decorations', collision: null,
    draw(ctx, n) { const caps = ['#e05a4a', '#c98a3a', '#8f6bd6']; const c = caps[(n.variant || 0) % caps.length]; pfRect(ctx, -5, -18, 10, 18, '#f0e6cf', '#b8a98a', 3); pfEllipse(ctx, 0, -20, 15, 9, c, shade(c, 0.4)); pfEllipse(ctx, -5, -23, 3, 2, '#fff'); pfEllipse(ctx, 6, -20, 2.5, 1.8, '#fff'); } },
  // --- water
  water_rock: { name: 'Water Rock', category: 'Water', icon: 'rock', w: 54, h: 34, layer: 'objects', collision: { type: 'circle', radius: 20 },
    draw(ctx) { pfEllipse(ctx, 0, 0, 30, 9, rgba('#dff4ff', 0.35)); pfPoly(ctx, [[-24, -2], [-18, -20], [0, -28], [18, -22], [26, -4]], '#6f8fa8', '#3f5a70'); pfPoly(ctx, [[-12, -14], [0, -22], [10, -18], [4, -10]], '#93b1c6'); } },
  reed: { name: 'Reed', category: 'Water', icon: 'reed', w: 26, h: 54, layer: 'decorations', collision: null, behavior: { wind: 'soft', windAmount: 4 },
    draw(ctx) { ctx.strokeStyle = '#4f9d4a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (const [dx, hh] of [[-8, 40], [0, 50], [8, 44]]) { ctx.beginPath(); ctx.moveTo(dx, 0); ctx.quadraticCurveTo(dx + 4, -hh / 2, dx, -hh); ctx.stroke(); } pfEllipse(ctx, 0, -42, 3.5, 9, '#7a5433'); } },
  waterfall: { name: 'Waterfall', category: 'Water', icon: 'waterfall', w: 90, h: 140, layer: 'water', collision: { type: 'rect', rect: [-45, -30, 90, 30], mode: 'water' }, behavior: { animated: true },
    draw(ctx, n, t = 0) { pfRect(ctx, -46, -140, 92, 130, '#5c5f66', '#3a3d44', 6); const g = ctx.createLinearGradient(0, -130, 0, 0); g.addColorStop(0, rgba('#bfe9ff', 0.9)); g.addColorStop(1, rgba('#3f86c8', 0.95)); pfRect(ctx, -30, -132, 60, 132, g); ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = -24 + i * 12; const off = ((t * 120 + i * 30) % 60); ctx.beginPath(); ctx.moveTo(x, -132 + off); ctx.lineTo(x, -112 + off); ctx.stroke(); } pfEllipse(ctx, 0, -2, 44, 12, rgba('#dff4ff', 0.8)); for (let i = 0; i < 6; i++) { const a = t * 3 + i; pfEllipse(ctx, Math.sin(a) * 30, -4 + Math.cos(a * 1.3) * 5, 4, 3, rgba('#ffffff', 0.8)); } } },
  bridge: { name: 'Bridge', category: 'Water', icon: 'bridge', w: 160, h: 80, layer: 'ground', collision: null, behavior: { bridge: true },
    draw(ctx, n) { const w = n.shape.w, hh = n.shape.h; pfRect(ctx, -w / 2, -hh, w, hh, '#a57a4a', '#5c3f26', 4); ctx.strokeStyle = '#7a5433'; ctx.lineWidth = 2; for (let x = -w / 2 + 12; x < w / 2; x += 14) { ctx.beginPath(); ctx.moveTo(x, -hh); ctx.lineTo(x, 0); ctx.stroke(); } pfRect(ctx, -w / 2, -hh - 8, w, 8, '#6b4a2e'); pfRect(ctx, -w / 2, -2, w, 8, '#6b4a2e'); } },
  dock: { name: 'Dock', category: 'Water', icon: 'dock', w: 140, h: 60, layer: 'ground', collision: null, behavior: { bridge: true },
    draw(ctx, n) { const w = n.shape.w, hh = n.shape.h; pfRect(ctx, -w / 2, -hh, w, hh, '#b8905a', '#6b4a2e', 3); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2; for (let y = -hh + 10; y < 0; y += 12) { ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke(); } for (const x of [-w / 2 + 8, w / 2 - 8]) { pfRect(ctx, x - 5, -hh - 10, 10, hh + 14, '#6b4a2e', '#3f2a18', 2); } } },
  // --- fire
  volcanic_rock: { name: 'Volcanic Rock', category: 'Fire', icon: 'rock', w: 70, h: 56, layer: 'objects', collision: { type: 'rect', rect: [-30, -26, 60, 26] },
    draw(ctx) { pfShadow(ctx, 30, 0); pfPoly(ctx, [[-32, -4], [-26, -30], [-4, -50], [18, -44], [32, -20], [28, -2]], '#3a3238', '#1e1a1e'); ctx.strokeStyle = '#ff7a2e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -40); ctx.lineTo(-2, -24); ctx.lineTo(10, -30); ctx.moveTo(-2, -24); ctx.lineTo(2, -8); ctx.stroke(); } },
  crystal: { name: 'Crystal', category: 'Fire', icon: 'crystal', w: 44, h: 70, layer: 'objects', collision: { type: 'circle', radius: 14 }, behavior: { animated: true },
    draw(ctx, n, t = 0) { const cols = ['#7fd6ff', '#c58bff', '#ffb45c', '#8ff0b0']; const c = cols[(n.variant || 0) % cols.length]; const pulse = 0.7 + 0.3 * Math.sin(t * 2 + (n.x || 0)); ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 18 * pulse; pfPoly(ctx, [[-14, -4], [-10, -46], [0, -66], [10, -42], [14, -6]], rgba(c, 0.95), shade(c, 0.4)); pfPoly(ctx, [[-22, -2], [-18, -30], [-10, -40], [-8, -6]], rgba(c, 0.85), shade(c, 0.4)); pfPoly(ctx, [[8, -4], [12, -34], [22, -40], [24, -6]], rgba(c, 0.85), shade(c, 0.4)); ctx.restore(); pfPoly(ctx, [[-6, -10], [-4, -40], [0, -56], [2, -14]], rgba('#ffffff', 0.5)); } },
  lava_rock: { name: 'Lava Rock', category: 'Fire', icon: 'rock', w: 60, h: 40, layer: 'objects', collision: { type: 'circle', radius: 22, mode: 'blocked' }, behavior: { animated: true },
    draw(ctx, n, t = 0) { const glow = 0.6 + 0.4 * Math.sin(t * 3); pfEllipse(ctx, 0, -4, 30, 12, rgba('#ff6a1e', 0.35 * glow)); pfPoly(ctx, [[-26, -4], [-20, -24], [0, -34], [20, -26], [26, -6]], '#4a2a22', '#2a1410'); ctx.strokeStyle = rgba('#ffb060', glow); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(0, -14); ctx.lineTo(12, -22); ctx.moveTo(0, -14); ctx.lineTo(4, -4); ctx.stroke(); } },
  ash_tree: { name: 'Ash Tree', category: 'Fire', icon: 'tree', w: 80, h: 140, layer: 'trees', collision: { type: 'rect', rect: [-12, -16, 24, 16] }, behavior: { wind: 'soft', windAmount: 1 },
    draw(ctx) { pfShadow(ctx, 32, 0); ctx.strokeStyle = '#3a2f2c'; ctx.lineCap = 'round'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -70); ctx.stroke(); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(-26, -100); ctx.moveTo(0, -70); ctx.lineTo(22, -110); ctx.moveTo(0, -50); ctx.lineTo(28, -76); ctx.moveTo(-26, -100); ctx.lineTo(-38, -128); ctx.moveTo(22, -110); ctx.lineTo(30, -136); ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#5a4a46'; ctx.beginPath(); ctx.moveTo(-26, -100); ctx.lineTo(-10, -122); ctx.moveTo(22, -110); ctx.lineTo(6, -130); ctx.stroke(); for (const [x, y] of [[-38, -128], [30, -136], [-10, -122], [6, -130], [28, -76]]) pfEllipse(ctx, x, y, 3, 3, '#ff8a3c'); } },
  burning_rock: { name: 'Burning Rock', category: 'Fire', icon: 'rock', w: 60, h: 80, layer: 'objects', collision: { type: 'circle', radius: 22 }, behavior: { animated: true },
    draw(ctx, n, t = 0) { pfPoly(ctx, [[-26, -2], [-22, -24], [-2, -36], [18, -28], [26, -4]], '#4a3a36', '#241a18'); for (let i = 0; i < 3; i++) { const fx = -10 + i * 10, fh = 30 + Math.sin(t * 9 + i * 2) * 8; ctx.fillStyle = rgba('#ff9a2e', 0.9); ctx.beginPath(); ctx.moveTo(fx - 7, -30); ctx.quadraticCurveTo(fx - 10, -30 - fh * 0.6, fx, -30 - fh); ctx.quadraticCurveTo(fx + 10, -30 - fh * 0.6, fx + 7, -30); ctx.fill(); ctx.fillStyle = rgba('#fff3b0', 0.9); ctx.beginPath(); ctx.moveTo(fx - 3, -30); ctx.quadraticCurveTo(fx - 4, -30 - fh * 0.35, fx, -30 - fh * 0.55); ctx.quadraticCurveTo(fx + 4, -30 - fh * 0.35, fx + 3, -30); ctx.fill(); } } },
  // --- general
  box: { name: 'Box', category: 'General', icon: 'box', w: 44, h: 44, layer: 'objects', collision: { type: 'rect', rect: [-22, -22, 44, 22] },
    draw(ctx) { pfShadow(ctx, 22, 0); pfRect(ctx, -22, -42, 44, 42, '#b8905a', '#5c3f26', 3); ctx.strokeStyle = '#7a5433'; ctx.lineWidth = 2; ctx.strokeRect(-16, -36, 32, 30); ctx.beginPath(); ctx.moveTo(-16, -36); ctx.lineTo(16, -6); ctx.moveTo(16, -36); ctx.lineTo(-16, -6); ctx.stroke(); } },
  fence: { name: 'Fence', category: 'General', icon: 'fence', w: 96, h: 40, layer: 'objects', collision: { type: 'rect', rect: [-48, -10, 96, 10] },
    draw(ctx, n) { const w = n.shape.w; pfRect(ctx, -w / 2, -30, w, 6, '#a57a4a', '#5c3f26'); pfRect(ctx, -w / 2, -16, w, 6, '#a57a4a', '#5c3f26'); for (let x = -w / 2 + 6; x < w / 2; x += 24) { pfRect(ctx, x - 4, -40, 8, 40, '#8a6a44', '#5c3f26', 2); } } },
  sign: { name: 'Sign', category: 'General', icon: 'sign', w: 44, h: 54, layer: 'objects', collision: { type: 'rect', rect: [-6, -8, 12, 8] }, behavior: { interactable: true, text: 'A wooden sign.' },
    draw(ctx) { pfRect(ctx, -4, -30, 8, 30, '#7a5433', '#4a3320'); pfRect(ctx, -22, -52, 44, 26, '#c9a26b', '#5c3f26', 4); ctx.strokeStyle = '#7a5433'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -44); ctx.lineTo(12, -44); ctx.moveTo(-14, -36); ctx.lineTo(6, -36); ctx.stroke(); } },
  chest: { name: 'Chest', category: 'General', icon: 'chest', w: 48, h: 40, layer: 'objects', collision: { type: 'rect', rect: [-24, -20, 48, 20] }, behavior: { interactable: true, chest: true, item: 'potion', qty: 1 },
    draw(ctx) { pfShadow(ctx, 24, 0); pfRect(ctx, -24, -30, 48, 30, '#8a5a2e', '#3f2a18', 4); pfRect(ctx, -24, -40, 48, 14, '#a5703a', '#3f2a18', 6); pfRect(ctx, -24, -28, 48, 4, '#f2c761'); pfRect(ctx, -6, -32, 12, 10, '#f2c761', '#7a5410', 2); } },
  building: { name: 'Building', category: 'General', icon: 'building', w: 190, h: 170, layer: 'objects', collision: { type: 'rect', rect: [-95, -110, 190, 110] }, behavior: { interactable: true, kind: 'house', name: 'Cottage' },
    draw(ctx, n) { const w = n.shape.w, hh = n.shape.h; const pal = [['#e6d9bd', '#b85a4a'], ['#d9e6f0', '#3f86c8'], ['#f0d9d0', '#c96a12'], ['#dfe9d0', '#3f8f4f']][(n.variant || 0) % 4]; pfRect(ctx, -w / 2, -hh * 0.62, w, hh * 0.62, pal[0], '#5c4a3a'); pfPoly(ctx, [[-w / 2 - 10, -hh * 0.62], [0, -hh], [w / 2 + 10, -hh * 0.62]], pal[1], '#3a2a20'); pfRect(ctx, -16, -hh * 0.36, 32, hh * 0.36, '#6b4a2e', '#3f2a18', 4); pfRect(ctx, -w / 2 + 20, -hh * 0.5, 30, 26, '#9fd8ff', '#5c4a3a'); pfRect(ctx, w / 2 - 50, -hh * 0.5, 30, 26, '#9fd8ff', '#5c4a3a'); } },
  gate: { name: 'Gate', category: 'General', icon: 'gate', w: 120, h: 130, layer: 'objects', collision: { type: 'rect', rect: [-60, -30, 120, 30], mode: 'trigger' }, behavior: { interactable: true },
    draw(ctx) { for (const x of [-50, 50]) pfRect(ctx, x - 12, -110, 24, 110, '#8d949c', '#3f444b', 3); ctx.strokeStyle = '#8d949c'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, -100, 50, Math.PI, 0); ctx.stroke(); ctx.strokeStyle = '#3f444b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -100, 57, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#f2c761'; ctx.beginPath(); ctx.arc(0, -128, 8, 0, Math.PI * 2); ctx.fill(); } },
  npc: { name: 'NPC', category: 'General', icon: 'npc', w: 34, h: 52, layer: 'npcs', collision: { type: 'rect', rect: [-14, -18, 28, 18] }, isNpc: true, draw() {} },
  save_point: { name: 'Save Point', category: 'General', icon: 'star', w: 44, h: 64, layer: 'objects', collision: { type: 'circle', radius: 14 }, behavior: { interactable: true, savePoint: true, animated: true },
    draw(ctx, n, t = 0) { const pulse = 0.6 + 0.4 * Math.sin(t * 3); pfEllipse(ctx, 0, 0, 22, 8, rgba('#7fd6ff', 0.35 * pulse)); pfRect(ctx, -6, -28, 12, 28, '#c8d2dc', '#5c6670', 3); ctx.save(); ctx.shadowColor = '#7fd6ff'; ctx.shadowBlur = 16 * pulse; pfPoly(ctx, [[0, -60], [10, -40], [0, -28], [-10, -40]], '#9fe4ff', '#3f86c8'); ctx.restore(); } },
};
const PREFAB_CATEGORIES = ['Nature', 'Water', 'Fire', 'General', 'Custom']; // 'Game' is appended by Game.install() when a game data snapshot is embedded

// NPC sprite (procedural little person) — shared by the prefab renderer, playtest and browser
function drawNpcSprite(ctx, n, t = 0, facing = 'down') {
  const c = n.npc?.color || '#7ad06a';
  const kind = n.npc?.kind || 'regular';
  pfShadow(ctx, 14, 0, 0.9);
  const bob = Math.sin(t * 2 + (n.x || 0)) * 1.2;
  pfRect(ctx, -10, -30 + bob, 20, 26, c, shade(c, 0.45), 6);            // body
  pfEllipse(ctx, 0, -38 + bob, 11, 11, '#f5d5b0', '#8a6a44');            // head
  const hair = { regular: '#5c3f26', trainer: '#c94a2a', shop: '#f2c761', healer: '#ffffff', savepoint: '#7fd6ff', quest: '#c084fc', guide: '#3f8f4f' }[kind] || '#5c3f26';
  pfEllipse(ctx, 0, -44 + bob, 11, 6, hair);
  ctx.fillStyle = '#2a2a33';
  if (facing !== 'up') { ctx.fillRect(-4, -39 + bob, 2, 3); ctx.fillRect(2, -39 + bob, 2, 3); }
  pfRect(ctx, -9, -6 + bob, 7, 6, '#3f2a18'); pfRect(ctx, 2, -6 + bob, 7, 6, '#3f2a18');
  if (kind === 'trainer') { pfRect(ctx, -12, -46 + bob, 24, 5, '#c94a2a', '#5a1405', 2); }
  if (kind === 'shop') { pfRect(ctx, -14, -24 + bob, 8, 10, '#8a5a2e', '#3f2a18', 2); }
  if (kind === 'healer') { ctx.fillStyle = '#ef4444'; ctx.fillRect(-1.5, -24 + bob, 3, 9); ctx.fillRect(-4.5, -21 + bob, 9, 3); }
  if (kind === 'quest') { ctx.fillStyle = '#f2c761'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -54 + bob); }
}
