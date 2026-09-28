// =============================================================================
// Templates: species, rig builder, default animations, VFX presets, skills,
// and the demo project (Verdant Vale + the five starting Mythlings).
// =============================================================================
const SPECIES_TEMPLATES = {
  spriggo: { name: 'Spriggo', breed: 'Fox', element: 'nature', rarity: 'D', mood: 'brave', role: 'Balanced', body: 'fox', catchRate: 0.55,
    description: 'A curious forest fox whose leaf-tail rustles when it senses adventure. Vines coil around its forelegs like living bracers.',
    palette: { primary: '#5fb45a', secondary: '#3c7a3f', belly: '#e9dfae', accent: '#8fe06a', eye: '#7cff7c', dark: '#2c5730' },
    stats: { hp: 110, patk: 14, satk: 16, pdef: 13, sdef: 15, spd: 14, counter: 8, crit: 6, critMult: 40 }, ultimate: 'Verdant Crush',
    evolutions: [['Spriggo', 1, 1.0], ['Thornox', 20, 1.34], ['Verdantor', 60, 1.75], ['Floragon', 80, 2.2]],
    skills: { 1: ['bite', 'vine_lash', 'brave_guard', 'sap_drain'], 12: ['pollen_veil'], 20: ['thorn_spear', 'thorn_armor', 'thorn_jab'] } },
  aquini: { name: 'Aquini', breed: 'Feline', element: 'water', rarity: 'D', mood: 'clever', role: 'Fast Special Attacker', body: 'feline', catchRate: 0.52,
    description: 'A sleek river cat with ear-fins that catch the current. It leaves rings of droplets wherever it steps.',
    palette: { primary: '#4aa8e8', secondary: '#2b6fb0', belly: '#e8f7ff', accent: '#9be8ff', eye: '#b8f4ff', dark: '#1d4a78' },
    stats: { hp: 100, patk: 12, satk: 18, pdef: 12, sdef: 14, spd: 18, counter: 6, crit: 8, critMult: 45 }, ultimate: 'Tidal Surge',
    evolutions: [['Aquini', 1, 1.0], ['Aquaro', 20, 1.34], ['Tideron', 60, 1.75], ['Leviaron', 80, 2.2]],
    skills: { 1: ['scratch', 'water_shot', 'flow_focus', 'mist_veil'], 20: ['aqua_spear', 'tidal_focus', 'stream_jab'] } },
  emberu: { name: 'Emberu', breed: 'Dragon', element: 'fire', rarity: 'D', mood: 'aggressive', role: 'Offensive', body: 'dragon', catchRate: 0.5,
    description: 'A stubby dragon whelp whose belly glows like banked coals. It sneezes sparks when excited.',
    palette: { primary: '#f0743a', secondary: '#c33c22', belly: '#ffd9a0', accent: '#ffb347', eye: '#fff0a8', dark: '#7d2413' },
    stats: { hp: 105, patk: 18, satk: 15, pdef: 12, sdef: 11, spd: 13, counter: 7, crit: 7, critMult: 45 }, ultimate: 'Fire Blast',
    evolutions: [['Emberu', 1, 1.0], ['Flamero', 20, 1.34], ['Inferno', 60, 1.75], ['Ignidrake', 80, 2.2]],
    skills: { 1: ['bite', 'flame_rawr', 'dragon_fury', 'ember_hex'], 20: ['burning_fang', 'burning_scales', 'ember_jab'] } },
  rivruff: { name: 'Rivruff', breed: 'Wolf', element: 'water', rarity: 'D', mood: 'sturdy', role: 'Tank', body: 'wolf', catchRate: 0.45,
    description: 'A river wolf with a mane of foam-white fur. It stands its ground in the strongest currents.',
    palette: { primary: '#7f9dc4', secondary: '#4f6f96', belly: '#e4eef8', accent: '#a8dcff', eye: '#cdefff', dark: '#33506f' },
    stats: { hp: 130, patk: 14, satk: 10, pdef: 18, sdef: 16, spd: 9, counter: 12, crit: 4, critMult: 35 }, ultimate: 'Riptide Howl',
    evolutions: [['Rivruff', 1, 1.0], ['Torruff', 20, 1.34], ['Cascadon', 60, 1.75], ['Maelwolf', 80, 2.2]],
    skills: { 1: ['bite', 'water_splash', 'aqua_guard', 'mist_veil'], 20: ['heavy_wave', 'thick_fur', 'tide_smash'] } },
  leaflet: { name: 'Leaflet', breed: 'Avian', element: 'nature', rarity: 'D', mood: 'playful', role: 'Speed / Evasion', body: 'avian', catchRate: 0.6,
    description: 'A leaf-winged songbird that glides between branches. Its tail feathers are literal leaves.',
    palette: { primary: '#8fd45a', secondary: '#5a9c3c', belly: '#f4f0c0', accent: '#d6f77a', eye: '#3a2a12', dark: '#3c6b27' },
    stats: { hp: 92, patk: 13, satk: 14, pdef: 10, sdef: 12, spd: 20, counter: 5, crit: 9, critMult: 45 }, ultimate: 'Gale Feather',
    evolutions: [['Leaflet', 1, 1.0], ['Frondwing', 20, 1.34], ['Galecrest', 60, 1.75], ['Zephyrax', 80, 2.2]],
    skills: { 1: ['peck', 'leaf_shot', 'quick_breeze', 'spore_haze'], 20: ['razor_wing', 'wind_step', 'briar_smash'] } },
};

const BODY_TEMPLATES = {
  fox:    { body: [78, 46, -44], head: [44, 40, 34, -22], ear: [14, 24], snout: [22, 12], legs: { len: 30, w: 12, front: 18, back: -22 }, tail: { len: 60, w: 22, x: -34, y: -6 }, wings: false, horns: false, mane: false, beak: false, quad: true },
  feline: { body: [72, 40, -40], head: [40, 36, 32, -22], ear: [12, 18], snout: [16, 10], legs: { len: 30, w: 10, front: 18, back: -20 }, tail: { len: 66, w: 12, x: -32, y: -10 }, wings: false, horns: false, mane: false, beak: false, quad: true },
  wolf:   { body: [86, 52, -48], head: [48, 42, 38, -24], ear: [14, 22], snout: [26, 14], legs: { len: 34, w: 14, front: 22, back: -24 }, tail: { len: 56, w: 26, x: -40, y: -8 }, wings: false, horns: false, mane: true, beak: false, quad: true },
  dragon: { body: [80, 50, -46], head: [46, 38, 36, -26], ear: [12, 18], snout: [24, 14], legs: { len: 32, w: 13, front: 20, back: -22 }, tail: { len: 76, w: 20, x: -36, y: -4 }, wings: true, horns: true, mane: false, beak: false, quad: true },
  avian:  { body: [56, 50, -40], head: [36, 34, 24, -28], ear: null, snout: null, legs: { len: 26, w: 6, front: 8, back: -6 }, tail: { len: 40, w: 24, x: -24, y: 2 }, wings: true, horns: false, mane: false, beak: true, quad: false },
};

/** Build a lightweight 8–12 part rig with anchors and pivots for a body type. */
function buildRig(bodyType, pal) {
  const T = BODY_TEMPLATES[bodyType] || BODY_TEMPLATES.fox;
  const nodes = {}, root = [], parts = {};
  const add = (role, type, props, parentId) => {
    const n = makeNode(type, Object.assign({ name: role, stroke: pal.dark, strokeWidth: 2 }, props));
    n.partType = props.partType || role.replace(/_.*/, '');
    nodes[n.id] = n;
    if (parentId) { n.parent = parentId; nodes[parentId].children.push(n.id); } else root.push(n.id);
    parts[role] = n.id;
    return n;
  };
  const [bw, bh, by] = T.body;
  const [hw, hh, hx, hy] = T.head;
  const rootN = add('ROOT', 'group', { x: 0, y: 0, partType: 'Group' });
  const body = add('BODY', 'ellipse', { x: 0, y: by, shape: { w: bw, h: bh }, fill: pal.primary, z: 2, partType: 'Body' }, rootN.id);
  // tail (behind the body)
  const tail = add('TAIL', 'ellipse', { x: T.tail.x, y: T.tail.y, shape: { w: T.tail.len, h: T.tail.w }, pivotX: T.tail.len / 2, pivotY: 0, rotation: bodyType === 'feline' ? 30 : 12, fill: bodyType === 'avian' ? pal.secondary : pal.primary, z: -2, partType: 'Tail' }, body.id);
  if (bodyType !== 'avian') add('TAIL_TIP', 'ellipse', { x: -T.tail.len * 0.36, y: 0, shape: { w: T.tail.len * 0.34, h: T.tail.w * 0.9 }, fill: pal.accent, strokeWidth: 0, z: 1, partType: 'Detail' }, tail.id);
  // legs
  const legShape = (len, w) => [[-w / 2, 0], [w / 2, 0], [w / 2 - 1, len - 6], [w / 2 + 4, len], [-w / 2 - 2, len], [-w / 2 + 1, len - 6]];
  const legY = bh * 0.3;
  const L = T.legs;
  if (T.quad) {
    add('LEG_BL', 'polygon', { x: L.back, y: legY, points: legShape(L.len, L.w), fill: shade(pal.primary, 0.18), z: -1, partType: 'Leg' }, body.id);
    add('LEG_FL', 'polygon', { x: L.front, y: legY, points: legShape(L.len, L.w), fill: shade(pal.primary, 0.18), z: -1, partType: 'Leg' }, body.id);
    add('LEG_BR', 'polygon', { x: L.back + 8, y: legY + 2, points: legShape(L.len - 2, L.w), fill: pal.primary, z: 1, partType: 'Leg' }, body.id);
    add('LEG_FR', 'polygon', { x: L.front + 8, y: legY + 2, points: legShape(L.len - 2, L.w), fill: pal.primary, z: 1, partType: 'Leg' }, body.id);
  } else {
    add('LEG_L', 'polygon', { x: L.back, y: legY + 4, points: legShape(L.len, L.w), fill: '#c9a26b', stroke: '#7a5433', z: -1, partType: 'Leg' }, body.id);
    add('LEG_R', 'polygon', { x: L.front, y: legY + 4, points: legShape(L.len, L.w), fill: '#d9b27b', stroke: '#7a5433', z: 1, partType: 'Leg' }, body.id);
  }
  // wings
  if (T.wings) {
    const wing = bodyType === 'avian'
      ? [[0, 0], [-22, -30], [-58, -40], [-70, -18], [-52, 2], [-20, 10]]
      : [[0, 0], [-16, -34], [-48, -46], [-40, -20], [-52, -4], [-18, 8]];
    add('WING_L', 'polygon', { x: -6, y: -bh * 0.25, points: wing, fill: shade(pal.secondary, 0.15), rotation: -8, z: -3, partType: 'Wing' }, body.id);
    add('WING_R', 'polygon', { x: 2, y: -bh * 0.2, points: wing, fill: pal.secondary, rotation: 4, z: 3, partType: 'Wing' }, body.id);
  }
  // belly / mane
  add('BELLY', 'ellipse', { x: 6, y: bh * 0.18, shape: { w: bw * 0.62, h: bh * 0.5 }, fill: pal.belly, strokeWidth: 0, z: 0.5, partType: 'Detail' }, body.id);
  if (T.mane) add('MANE', 'ellipse', { x: hx * 0.55, y: -bh * 0.12, shape: { w: bw * 0.5, h: bh * 1.1 }, fill: pal.belly, z: 3, partType: 'Mane' }, body.id);
  // head
  const head = add('HEAD', 'ellipse', { x: hx, y: hy, shape: { w: hw, h: hh }, pivotX: -hw * 0.3, pivotY: hh * 0.25, fill: pal.primary, z: 4, partType: 'Head' }, body.id);
  if (T.ear) {
    const [ew, eh] = T.ear;
    const earPts = [[-ew / 2, 0], [0, -eh], [ew / 2, 0]];
    add('EAR_L', 'polygon', { x: -hw * 0.18, y: -hh * 0.36, points: earPts, rotation: -14, fill: shade(pal.primary, 0.2), z: -1, partType: 'Ear' }, head.id);
    add('EAR_R', 'polygon', { x: hw * 0.16, y: -hh * 0.4, points: earPts, rotation: 10, fill: pal.secondary, z: 1, partType: 'Ear' }, head.id);
  }
  if (T.horns) {
    add('HORN_L', 'polygon', { x: -hw * 0.1, y: -hh * 0.4, points: [[-4, 0], [-6, -18], [4, -4]], fill: pal.belly, z: -1, partType: 'Horn' }, head.id);
    add('HORN_R', 'polygon', { x: hw * 0.16, y: -hh * 0.44, points: [[-4, 0], [-4, -20], [6, -2]], fill: pal.belly, z: 1, partType: 'Horn' }, head.id);
  }
  if (T.beak) {
    add('BEAK', 'polygon', { x: hw * 0.42, y: hh * 0.05, points: [[0, -5], [16, 2], [0, 7]], fill: '#f2b04a', stroke: '#8a5a10', z: 2, partType: 'Detail' }, head.id);
    add('CREST', 'polygon', { x: -hw * 0.1, y: -hh * 0.42, points: [[-6, 0], [-2, -16], [6, -6], [10, 0]], fill: pal.accent, z: -1, partType: 'Detail' }, head.id);
  }
  if (T.snout) add('SNOUT', 'ellipse', { x: hw * 0.4, y: hh * 0.12, shape: { w: T.snout[0], h: T.snout[1] }, fill: pal.belly, strokeWidth: 1.5, z: 2, partType: 'Snout' }, head.id);
  add('EYE', 'ellipse', { x: hw * 0.2, y: -hh * 0.1, shape: { w: 8, h: 9 }, fill: '#1c1f28', stroke: pal.eye, strokeWidth: 2, z: 3, partType: 'Eye' }, head.id);
  // anchors
  const anchor = (name, parentRole, x, y, color = '#f2c761') => add(name, 'anchor', { x, y, fill: color, z: 20, partType: 'Anchor' }, parts[parentRole]);
  anchor('Root', 'ROOT', 0, 0, '#ffffff');
  anchor('BodyCenter', 'BODY', 0, 0, '#60a5fa');
  anchor('Head', 'HEAD', 0, 0, '#60a5fa');
  anchor('Mouth', 'HEAD', hw * 0.5, hh * 0.18, '#f87171');
  anchor('AttackOrigin', 'HEAD', hw * 0.72, hh * 0.1, '#fb923c');
  anchor('VFXOrigin', 'BODY', hx * 0.45, -bh * 0.7, '#c084fc');
  anchor('TailBase', 'TAIL', 0, 0, '#4ade80');
  anchor('TailTip', 'TAIL', -T.tail.len, 0, '#4ade80');
  if (T.quad) { anchor('Foot_L', 'LEG_FL', 0, L.len, '#22d3ee'); anchor('Foot_R', 'LEG_FR', 0, L.len - 2, '#22d3ee'); }
  else { anchor('Foot_L', 'LEG_L', 0, L.len, '#22d3ee'); anchor('Foot_R', 'LEG_R', 0, L.len, '#22d3ee'); }
  if (T.wings) { anchor('Wing_L', 'WING_L', -40, -30, '#e879f9'); anchor('Wing_R', 'WING_R', -40, -30, '#e879f9'); }
  return { nodes, root, parts };
}

// ---------------------------------------------------------------- default animations (offsets from the rest pose)
function kf(t, o = {}) {
  return { t, x: o.x || 0, y: o.y || 0, rotation: o.r || 0, scaleX: o.sx == null ? 1 : o.sx, scaleY: o.sy == null ? 1 : o.sy, opacity: o.o == null ? 1 : o.o, ease: o.ease || 'easeInOut' };
}
function defaultAnimations(mythlingId, parts) {
  const P = (role) => parts[role];
  const has = (role) => !!parts[role];
  const legsQuad = has('LEG_FL');
  const legsL = legsQuad ? ['LEG_FL', 'LEG_BR'] : ['LEG_L'];
  const legsR = legsQuad ? ['LEG_FR', 'LEG_BL'] : ['LEG_R'];
  const mk = (name, duration, loop, tracksByRole, fps = 60) => {
    const tracks = {};
    for (const [role, keys] of Object.entries(tracksByRole)) if (has(role)) tracks[P(role)] = keys;
    return { id: uid('anim'), name, mythlingId, duration, loop, fps, easing: 'easeInOut', tracks };
  };
  const swing = (amp, dur, phase = 0) => [kf(0, { r: amp * phase }), kf(dur * 0.25, { r: amp }), kf(dur * 0.75, { r: -amp }), kf(dur, { r: amp * phase })];
  const walkLegs = (amp, dur) => Object.fromEntries([...legsL.map((r) => [r, [kf(0, { r: -amp }), kf(dur / 2, { r: amp }), kf(dur, { r: -amp })]]), ...legsR.map((r) => [r, [kf(0, { r: amp }), kf(dur / 2, { r: -amp }), kf(dur, { r: amp })]])]);
  const wingFlap = (amp, dur) => ({ WING_L: [kf(0, { r: -amp }), kf(dur / 2, { r: amp }), kf(dur, { r: -amp })], WING_R: [kf(0, { r: amp * 0.8 }), kf(dur / 2, { r: -amp * 0.8 }), kf(dur, { r: amp * 0.8 })] });
  return [
    mk('Idle', 1.6, true, { BODY: [kf(0), kf(0.8, { y: -2, sy: 1.02 }), kf(1.6)], HEAD: [kf(0), kf(0.8, { r: -3 }), kf(1.6)], TAIL: swing(8, 1.6), EAR_L: [kf(0), kf(1.1, { r: -6 }), kf(1.3), kf(1.6)], ...(has('WING_L') ? wingFlap(3, 1.6) : {}) }),
    mk('Walk', 0.62, true, { BODY: [kf(0), kf(0.155, { y: -2 }), kf(0.31), kf(0.465, { y: -2 }), kf(0.62)], HEAD: [kf(0), kf(0.31, { r: 3 }), kf(0.62)], TAIL: swing(10, 0.62), ...walkLegs(18, 0.62), ...(has('WING_L') ? wingFlap(6, 0.62) : {}) }),
    mk('Run', 0.44, true, { BODY: [kf(0, { r: -6 }), kf(0.11, { y: -5, r: -6 }), kf(0.22, { r: -6 }), kf(0.33, { y: -5, r: -6 }), kf(0.44, { r: -6 })], HEAD: [kf(0, { r: 4 }), kf(0.22, { r: 8 }), kf(0.44, { r: 4 })], TAIL: swing(14, 0.44), ...walkLegs(32, 0.44), ...(has('WING_L') ? wingFlap(14, 0.44) : {}) }),
    mk('Battle Idle', 1.2, true, { BODY: [kf(0), kf(0.6, { y: -3, sy: 1.03 }), kf(1.2)], HEAD: [kf(0, { r: -2 }), kf(0.6, { r: -6 }), kf(1.2, { r: -2 })], TAIL: swing(12, 1.2), ...(has('WING_L') ? wingFlap(5, 1.2) : {}) }),
    mk('Normal Attack', 0.55, false, { BODY: [kf(0), kf(0.14, { x: -8, r: 4, ease: 'easeIn' }), kf(0.3, { x: 22, r: -6, ease: 'easeOut' }), kf(0.55)], HEAD: [kf(0), kf(0.14, { r: -14 }), kf(0.3, { r: 14, sx: 1.1, sy: 1.1 }), kf(0.42, { r: 4 }), kf(0.55)], ...(has('LEG_FR') ? { LEG_FR: [kf(0), kf(0.3, { r: -30 }), kf(0.55)], LEG_FL: [kf(0), kf(0.3, { r: -20 }), kf(0.55)] } : {}) }),
    mk('Special Attack', 0.85, false, { BODY: [kf(0), kf(0.3, { y: -12, r: -16, ease: 'easeOut' }), kf(0.5, { x: 16, y: -2, r: 6, ease: 'easeIn' }), kf(0.85)], HEAD: [kf(0), kf(0.3, { r: -20 }), kf(0.5, { r: 16, sx: 1.12, sy: 1.12 }), kf(0.85)], TAIL: [kf(0), kf(0.3, { r: 28 }), kf(0.5, { r: -10 }), kf(0.85)], ...(has('WING_L') ? wingFlap(28, 0.85) : {}) }),
    mk('Buff', 0.9, false, { BODY: [kf(0), kf(0.45, { y: -8, sx: 1.1, sy: 1.1 }), kf(0.9)], HEAD: [kf(0), kf(0.45, { r: -18 }), kf(0.9)], TAIL: [kf(0), kf(0.45, { r: 30 }), kf(0.9)] }),
    mk('Ultimate', 1.5, false, { BODY: [kf(0), kf(0.5, { y: -16, r: -20, sx: 1.08, sy: 1.08, ease: 'easeOut' }), kf(0.9, { y: -16, r: -20, sx: 1.12, sy: 1.12 }), kf(1.1, { x: 34, y: 0, r: 8, ease: 'easeIn' }), kf(1.5)], HEAD: [kf(0), kf(0.5, { r: -24 }), kf(0.9, { r: -28 }), kf(1.1, { r: 18, sx: 1.15, sy: 1.15 }), kf(1.5)], TAIL: [kf(0), kf(0.5, { r: 34 }), kf(1.1, { r: -14 }), kf(1.5)], ...(has('WING_L') ? wingFlap(36, 1.5) : {}) }),
    mk('Hit', 0.42, false, { BODY: [kf(0), kf(0.1, { x: -14, r: -8, o: 0.55, ease: 'easeOut' }), kf(0.24, { x: -6, o: 1 }), kf(0.42)], HEAD: [kf(0), kf(0.1, { r: -18 }), kf(0.42)], EAR_L: [kf(0), kf(0.1, { r: 30 }), kf(0.42)], EAR_R: [kf(0), kf(0.1, { r: 30 }), kf(0.42)] }),
    mk('Faint', 1.0, false, { BODY: [kf(0), kf(0.3, { y: -6, ease: 'easeOut' }), kf(0.75, { y: 26, r: -78, ease: 'easeIn' }), kf(1.0, { y: 26, r: -84, o: 0.35 })], HEAD: [kf(0), kf(0.75, { r: -20 }), kf(1.0, { r: -26 })] }),
    mk('Capture', 0.8, false, { BODY: [kf(0), kf(0.3, { y: -10, sx: 1.05, sy: 1.05 }), kf(0.8, { y: -60, sx: 0.15, sy: 0.15, r: 360, o: 0.1, ease: 'easeIn' })] }),
    mk('Evolution', 1.2, false, { BODY: [kf(0), kf(0.3, { sx: 1.15, sy: 1.15, o: 0.6 }), kf(0.6, { sx: 0.9, sy: 0.9, o: 1 }), kf(0.9, { sx: 1.25, sy: 1.25, o: 0.5 }), kf(1.2)], HEAD: [kf(0), kf(0.6, { r: -20 }), kf(1.2)], TAIL: [kf(0), kf(0.6, { r: 40 }), kf(1.2)] }),
  ];
}

// ---------------------------------------------------------------- VFX presets
function emitter(type, o = {}) {
  return Object.assign({ id: uid('em'), name: titleCase(type), type, attach: 'Target', x: 0, y: -40, scale: 1, rotation: 0, delay: 0, duration: 0.5, opacity: 1, color: '#8fe06a', color2: '#ffffff', count: 16, speed: 140, lifetime: 0.6, gravity: 80, spread: 360, size: 6, glow: 8, trail: 0, blend: 'lighter' }, o);
}
function defaultVFX() {
  return [
    { id: 'nature_burst', name: 'Nature Burst', category: 'Nature', duration: 0.9, emitters: [
      emitter('ring', { name: 'Impact Ring', attach: 'Target', color: '#a8f08a', duration: 0.35, size: 70, glow: 14, count: 1 }),
      emitter('leaf', { name: 'Leaf Scatter', attach: 'Target', color: '#6fd36a', color2: '#d8ffb0', count: 22, speed: 190, lifetime: 0.8, gravity: 120, size: 7, blend: 'source-over' }),
      emitter('burst', { name: 'Core Flash', attach: 'Target', color: '#d8ffb0', duration: 0.2, size: 40, count: 1, glow: 20 }),
    ] },
    { id: 'leaf_trail', name: 'Leaf Trail', category: 'Nature', duration: 0.7, emitters: [
      emitter('projectile', { name: 'Vine Dart', attach: 'AttackOrigin', color: '#4fa64a', color2: '#a8f08a', duration: 0.42, size: 12, trail: 1, glow: 10, count: 1 }),
      emitter('trail', { name: 'Leaf Wake', attach: 'AttackOrigin', color: '#8fe06a', count: 14, speed: 40, lifetime: 0.5, gravity: 30, size: 5, duration: 0.42, blend: 'source-over' }),
    ] },
    { id: 'water_shot', name: 'Water Shot', category: 'Water', duration: 0.8, emitters: [
      emitter('projectile', { name: 'Water Orb', attach: 'Mouth', color: '#5cc0f5', color2: '#f2fdff', duration: 0.38, size: 14, trail: 1, glow: 14, count: 1 }),
      emitter('splash', { name: 'Splash', attach: 'Target', delay: 0.38, color: '#bfe9ff', color2: '#ffffff', count: 20, speed: 200, lifetime: 0.55, gravity: 260, size: 5 }),
      emitter('ring', { name: 'Wave Ring', attach: 'Target', delay: 0.38, color: '#5cc0f5', duration: 0.4, size: 60, count: 1 }),
    ] },
    { id: 'flame_rawr', name: 'Flame Rawr', category: 'Fire', duration: 0.9, emitters: [
      emitter('flame', { name: 'Roar Flames', attach: 'Mouth', color: '#ff9a2e', color2: '#fff3b0', count: 26, speed: 260, lifetime: 0.5, gravity: -60, spread: 40, size: 9, duration: 0.45, rotation: 0 }),
      emitter('burst', { name: 'Heat Burst', attach: 'Target', delay: 0.35, color: '#ffcf7a', duration: 0.25, size: 56, count: 1, glow: 24 }),
      emitter('smoke', { name: 'Smoke', attach: 'Target', delay: 0.45, color: '#5a5a66', count: 8, speed: 40, lifetime: 0.8, gravity: -50, size: 12, opacity: 0.5, blend: 'source-over' }),
      emitter('spark', { name: 'Embers', attach: 'Target', delay: 0.35, color: '#ffb060', count: 18, speed: 180, lifetime: 0.6, gravity: 100, size: 3 }),
    ] },
    { id: 'buff_aura', name: 'Buff Aura', category: 'Buff', duration: 1.0, emitters: [
      emitter('aura', { name: 'Aura', attach: 'BodyCenter', color: '#f2c761', duration: 1.0, size: 90, count: 1, glow: 30, opacity: 0.7 }),
      emitter('particle', { name: 'Rising Motes', attach: 'BodyCenter', color: '#fff1b8', count: 18, speed: 60, lifetime: 0.9, gravity: -120, spread: 60, size: 4, rotation: -90 }),
    ] },
    { id: 'debuff_haze', name: 'Debuff Haze', category: 'Debuff', duration: 0.9, emitters: [
      emitter('smoke', { name: 'Haze', attach: 'TargetCenter', color: '#a855f7', count: 14, speed: 30, lifetime: 0.9, gravity: -20, size: 14, opacity: 0.55, blend: 'source-over' }),
      emitter('shockwave', { name: 'Drop Wave', attach: 'TargetCenter', color: '#c084fc', duration: 0.5, size: 50, count: 1 }),
    ] },
    { id: 'ultimate_verdant', name: 'Ultimate — Verdant Crush', category: 'Ultimate', duration: 1.6, emitters: [
      emitter('glow', { name: 'Charge Glow', attach: 'BodyCenter', color: '#a8f08a', duration: 0.9, size: 80, count: 1, glow: 40 }),
      emitter('vine', { name: 'Root Spears', attach: 'Target', delay: 0.9, color: '#3c7a3f', color2: '#8fe06a', count: 6, speed: 240, lifetime: 0.6, gravity: 0, spread: 120, size: 10, rotation: -90 }),
      emitter('shockwave', { name: 'Crush Wave', attach: 'Target', delay: 1.0, color: '#d8ffb0', duration: 0.5, size: 120, count: 1 }),
      emitter('leaf', { name: 'Leaf Storm', attach: 'Target', delay: 1.0, color: '#6fd36a', count: 40, speed: 260, lifetime: 0.9, gravity: 60, size: 8, blend: 'source-over' }),
    ] },
  ];
}

// ---------------------------------------------------------------- skills
const SKILL_SEED = [
  ['bite', 'Bite', 'none', 'normal', 10, 0, 'Normal Attack', null, 'bite', 3],
  ['scratch', 'Scratch', 'none', 'normal', 10, 0, 'Normal Attack', null, 'slash', 3],
  ['peck', 'Peck', 'none', 'normal', 10, 0, 'Normal Attack', null, 'peck', 3],
  ['vine_lash', 'Vine Lash', 'nature', 'special', 16, 20, 'Special Attack', 'leaf_trail', 'whip', 6],
  ['water_shot', 'Water Shot', 'water', 'special', 17, 20, 'Special Attack', 'water_shot', 'splash', 6],
  ['flame_rawr', 'Flame Rawr', 'fire', 'special', 17, 20, 'Special Attack', 'flame_rawr', 'roar', 7],
  ['leaf_shot', 'Leaf Shot', 'nature', 'special', 16, 20, 'Special Attack', 'nature_burst', 'whoosh', 5],
  ['water_splash', 'Water Splash', 'water', 'special', 15, 20, 'Special Attack', 'water_shot', 'splash', 5],
  ['brave_guard', 'Brave Guard', 'none', 'buff', 0, 10, 'Buff', 'buff_aura', 'chime', 0],
  ['flow_focus', 'Flow Focus', 'none', 'buff', 0, 10, 'Buff', 'buff_aura', 'chime', 0],
  ['dragon_fury', 'Dragon Fury', 'none', 'buff', 0, 10, 'Buff', 'buff_aura', 'chime', 0],
  ['sap_drain', 'Sap Drain', 'nature', 'debuff', 0, 12, 'Special Attack', 'debuff_haze', 'hiss', 2],
  ['mist_veil', 'Mist Veil', 'water', 'debuff', 0, 12, 'Special Attack', 'debuff_haze', 'hiss', 2],
  ['pollen_veil', 'Pollen Veil', 'nature', 'debuff', 0, 10, 'Special Attack', 'debuff_haze', 'hiss', 2],
  ['thorn_spear', 'Thorn Spear', 'nature', 'special', 26, 18, 'Special Attack', 'nature_burst', 'whoosh', 8],
  ['verdant_crush', 'Verdant Crush (Ultimate)', 'nature', 'ultimate', 60, 0, 'Ultimate', 'ultimate_verdant', 'rumble', 14],
];
function defaultSkills() {
  const out = {};
  for (const [id, name, element, type, power, uses, animation, vfx, sound, shake] of SKILL_SEED) out[id] = { id, name, element, type, power, uses, animation, vfx, sound, shake };
  return out;
}

// ---------------------------------------------------------------- mythling factory
function createMythlingFromTemplate(key, template) {
  const t = template || SPECIES_TEMPLATES[key] || SPECIES_TEMPLATES.spriggo;
  const rig = buildRig(t.body, t.palette);
  const m = {
    id: key, name: t.name, breed: t.breed, element: t.element, rarity: t.rarity, mood: t.mood, role: t.role, description: t.description,
    bodyType: t.body, catchRate: t.catchRate ?? 0.5, stage: 0, level: 1, ultimate: t.ultimate || '', palette: deepClone(t.palette),
    stats: deepClone(t.stats), rig: { nodes: rig.nodes, root: rig.root }, parts: rig.parts, animations: [], vfx: [], assets: [],
    evolutions: (t.evolutions || []).map(([name, level, statMult], i) => ({ stage: i, name, level, statMult, future: level >= 60, skills: (t.skills && t.skills[level]) || [], ultimate: `${t.ultimate || 'Ultimate'} ${['I', 'II', 'III', 'IV'][i]}` })),
  };
  return m;
}
function attachDefaultAnimations(project, m) {
  const anims = defaultAnimations(m.id, m.parts);
  for (const a of anims) { project.animations[a.id] = a; m.animations.push(a.id); }
}

// ---------------------------------------------------------------- demo maps
function newMap(props = {}) {
  const m = Object.assign({ id: uid('map'), name: 'New Map', width: 2400, height: 1400, theme: 'nature', music: 'vale', levelMin: 1, levelMax: 10, weather: 'clear', background: '#4f9d4a', cell: 32, spawn: null }, props);
  m.cols = Math.ceil(m.width / m.cell); m.rows = Math.ceil(m.height / m.cell);
  m.terrain = new Array(m.cols * m.rows).fill(TERRAIN_INDEX[props.baseTerrain || 'grass']);
  m.collision = new Array(m.cols * m.rows).fill(0);
  m.layers = defaultLayers();
  m.nodes = {}; m.root = [];
  m.camera = { minX: 0, minY: 0, maxX: m.width, maxY: m.height };
  return m;
}
function mapAddNode(map, node, parentId = null) {
  map.nodes[node.id] = node;
  node.parent = parentId;
  if (parentId && map.nodes[parentId]) map.nodes[parentId].children.push(node.id); else map.root.push(node.id);
  return node;
}
function paintRect(map, terrainId, x, y, w, h) {
  const ti = TERRAIN_INDEX[terrainId] ?? 0;
  const c0 = clamp(Math.floor(x / map.cell), 0, map.cols - 1), c1 = clamp(Math.ceil((x + w) / map.cell), 0, map.cols);
  const r0 = clamp(Math.floor(y / map.cell), 0, map.rows - 1), r1 = clamp(Math.ceil((y + h) / map.cell), 0, map.rows);
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) { map.terrain[r * map.cols + c] = ti; if (terrainId === 'water') map.collision[r * map.cols + c] = 2; else if (terrainId === 'cliff' || terrainId === 'lava') map.collision[r * map.cols + c] = 1; }
}
function demoVerdantVale() {
  const map = newMap({ id: 'verdant_vale', name: 'Verdant Vale', width: 3600, height: 1500, theme: 'nature', music: 'vale', levelMin: 1, levelMax: 10, background: '#4f9d4a', spawn: { x: 420, y: 980 } });
  // terrain: town square, petal path, whisperwood floor, ruins rock, water
  paintRect(map, 'dirt', 120, 440, 780, 340);
  paintRect(map, 'path', 380, 700, 120, 520);
  paintRect(map, 'path', 480, 1000, 900, 90);
  paintRect(map, 'path', 1380, 700, 90, 400);
  paintRect(map, 'path', 1400, 700, 1500, 90);
  paintRect(map, 'forest', 1900, 0, 900, 1500);
  paintRect(map, 'rock', 2800, 0, 800, 1500);
  paintRect(map, 'grass', 2900, 500, 500, 500);
  paintRect(map, 'water', 1020, 1180, 780, 200);
  paintRect(map, 'water', 250, 120, 520, 150);
  paintRect(map, 'cliff', 0, 0, 3600, 32); paintRect(map, 'cliff', 0, 1468, 3600, 32); paintRect(map, 'cliff', 0, 0, 32, 1500);
  // layer groups (folders in the hierarchy)
  const groups = {};
  for (const [id, name] of [['terrain_g', 'Terrain'], ['water_g', 'Water'], ['trees_g', 'Trees'], ['rocks_g', 'Rocks'], ['decor_g', 'Decorations'], ['buildings_g', 'Buildings'], ['npcs_g', 'NPCs'], ['zones_g', 'Spawn Zones'], ['warps_g', 'Warps'], ['effects_g', 'Effects']]) {
    groups[id] = mapAddNode(map, makeNode('group', { id, name, layer: 'objects' }));
  }
  const rnd = seededRandom(7);
  const names = () => Object.values(map.nodes).map((n) => n.name);
  const place = (pf, x, y, g, extra = {}) => mapAddNode(map, makePrefabNode(pf, Math.round(x), Math.round(y), Object.assign({ name: nextName(PREFABS[pf].name.replace(/\s/g, ''), names()) }, extra)), g);
  // forest trees
  for (let i = 0; i < 46; i++) { const x = 1920 + rnd() * 860, y = 80 + rnd() * 1380; if (y > 640 && y < 860 && x < 2760) continue; place('tree', x, y, 'trees_g', { variant: Math.floor(rnd() * 3) }); }
  // edge trees
  for (let i = 0; i < 18; i++) place('tree', 60 + rnd() * 900, 1300 + rnd() * 140, 'trees_g', { variant: Math.floor(rnd() * 3) });
  for (let i = 0; i < 12; i++) place('tree', 1040 + rnd() * 800, 40 + rnd() * 90, 'trees_g', { variant: Math.floor(rnd() * 3) });
  for (let i = 0; i < 6; i++) place('tree', 1100 + i * 130, 1450, 'trees_g');
  // rocks, bushes, flowers, mushrooms
  for (let i = 0; i < 10; i++) place('rock', 1050 + rnd() * 1700, 150 + rnd() * 500, 'rocks_g', { variant: Math.floor(rnd() * 3) });
  for (let i = 0; i < 14; i++) place('bush', 1000 + rnd() * 1800, 200 + rnd() * 900, 'decor_g', { variant: Math.floor(rnd() * 2) });
  for (let i = 0; i < 40; i++) place('flower', 1020 + rnd() * 860, 200 + rnd() * 900, 'decor_g', { variant: Math.floor(rnd() * 4) });
  for (let i = 0; i < 10; i++) place('mushroom', 1950 + rnd() * 800, 200 + rnd() * 1200, 'decor_g', { variant: Math.floor(rnd() * 3) });
  for (let i = 0; i < 8; i++) place('reed', 270 + i * 64, 280, 'decor_g');
  place('log', 1500, 420, 'decor_g'); place('log', 2300, 1180, 'decor_g');
  // ruins as rocks + crystals + gate
  place('rock', 2980, 400, 'rocks_g', { name: 'Ruin_001', variant: 1, scaleX: 1.6, scaleY: 1.6 });
  place('rock', 3260, 1020, 'rocks_g', { name: 'Ruin_002', variant: 1, scaleX: 1.4, scaleY: 1.4 });
  place('crystal', 3060, 760, 'decor_g', { variant: 3 }); place('crystal', 3220, 690, 'decor_g', { variant: 3 });
  place('gate', 3520, 760, 'buildings_g', { name: 'Verdant_Gate' });
  // town
  place('building', 355, 680, 'buildings_g', { name: 'Mythling_Center', variant: 1, shape: { w: 210, h: 170 }, behavior: { interactable: true, kind: 'center', name: 'Mythling Center' } });
  place('building', 715, 680, 'buildings_g', { name: 'Leafrest_Supplies', variant: 2, shape: { w: 190, h: 160 }, behavior: { interactable: true, kind: 'shop', name: 'Leafrest Supplies', stock: ['basic_ball', 'normal_ball', 'potion', 'crunchy_root', 'moon_melon'] } });
  place('building', 205, 1030, 'buildings_g', { name: 'Cottage_001', variant: 0, shape: { w: 170, h: 140 } });
  place('building', 785, 1080, 'buildings_g', { name: 'Cottage_002', variant: 3, shape: { w: 170, h: 140 } });
  place('save_point', 560, 900, 'buildings_g');
  place('fence', 140, 780, 'decor_g', { shape: { w: 200, h: 40 } });
  place('box', 900, 640, 'decor_g'); place('box', 940, 640, 'decor_g'); place('chest', 2630, 260, 'decor_g', { behavior: { interactable: true, chest: true, item: 'normal_ball', qty: 2 } });
  place('sign', 500, 1130, 'decor_g', { name: 'Sign_Town', behavior: { interactable: true, text: 'LEAFREST TOWN — where every journey begins.' } });
  place('sign', 1060, 780, 'decor_g', { name: 'Sign_Path', behavior: { interactable: true, text: 'PETAL PATH → Wild Mythlings ahead. Lv.1–5.' } });
  place('sign', 1960, 760, 'decor_g', { name: 'Sign_Wood', behavior: { interactable: true, text: 'WHISPERWOOD → Stronger Mythlings. Lv.4–8.' } });
  place('sign', 2860, 740, 'decor_g', { name: 'Sign_Gate', behavior: { interactable: true, text: 'VERDANT GATE → The Guardian awaits. Lv.7–10.' } });
  place('bridge', 1405, 1400, 'water_g', { name: 'Stream_Bridge', shape: { w: 150, h: 240 } });
  place('waterfall', 700, 120, 'water_g', { name: 'Pond_Falls' });
  // NPCs
  const npc = (name, x, y, kind, color, dialogue, extra = {}) => mapAddNode(map, makeNode('npc', { name, x, y, npc: Object.assign({ kind, color, dialogue, sprite: kind === 'trainer' ? 'trainer' : 'villager' }, extra) }), 'npcs_g');
  npc('Professor_Fern', 480, 800, 'guide', '#7ad06a', ['Welcome to Wildbound! I am Professor Fern.', 'Nature beats Water, Water beats Fire, Fire beats Nature.', 'Defeat a wild Mythling before you throw a ball — a healthy one will never hold still.']);
  npc('Caretaker_Moss', 355, 720, 'healer', '#8fe0b0', ['The Mythling Center heals your whole party. It is free!']);
  npc('Sprout', 810, 830, 'regular', '#ffd37a', ['Shiny Mythlings glitter! I saw one once. Or maybe it was a firefly.']);
  npc('Forager_Pim', 1280, 520, 'trainer', '#e0a86a', ['My Leaflet never sits still! Show me what you have got.'], { team: [{ species: 'leaflet', level: 4 }, { species: 'spriggo', level: 5 }], flag: 'vale_t1', reward: { coins: 220 } });
  npc('Ranger_Holt', 2180, 1050, 'trainer', '#9ec46a', ['Whisperwood tests every trainer. Ready?'], { team: [{ species: 'spriggo', level: 7 }, { species: 'leaflet', level: 7 }], flag: 'vale_t2', reward: { coins: 340 } });
  npc('Guardian_Ysel', 3130, 730, 'trainer', '#3f8f4f', ['None pass the Verdant Gate untested. Show me your bond!'], { team: [{ species: 'leaflet', level: 9 }, { species: 'spriggo', level: 10 }], flag: 'vale_guardian', guardian: true, reward: { coins: 700 } });
  // spawn zones / player spawn / warp
  const zone = (name, x, y, w, h, species, minL, maxL, weight) => mapAddNode(map, makeNode('zone', { name, x: x + w / 2, y: y + h / 2, shape: { w, h }, zone: { name, species, minLevel: minL, maxLevel: maxL, weight, mutationChance: 2 } }), 'zones_g');
  zone('Petal_Path_Zone', 1040, 150, 820, 1000, ['spriggo', 'leaflet'], 1, 4, 5);
  zone('Whisperwood_Zone', 1920, 150, 840, 1200, ['spriggo', 'leaflet', 'rivruff'], 4, 8, 6);
  zone('Verdant_Gate_Zone', 2830, 200, 700, 1100, ['spriggo', 'leaflet', 'emberu'], 7, 10, 5);
  mapAddNode(map, makeNode('spawn', { name: 'Player_Spawn', x: 420, y: 980, spawn: { kind: 'player', direction: 'right', enabled: true } }), 'zones_g');
  mapAddNode(map, makeNode('warp', { name: 'Warp_Azure', x: 3550, y: 760, shape: { w: 100, h: 320 }, warp: { toMap: 'azure_coast', toX: 220, toY: 900, requiredFlag: 'vale_charm', label: 'To Azure Coast' } }), 'warps_g');
  mapAddNode(map, makeNode('trigger', { name: 'Tutorial_Trigger', x: 1000, y: 900, shape: { w: 60, h: 300 }, trigger: { event: 'message', payload: 'Wild Mythlings live in the tall grass ahead!', once: true } }), 'warps_g');
  return map;
}
function demoAzureCoast() {
  const map = newMap({ id: 'azure_coast', name: 'Azure Coast', width: 4000, height: 1500, theme: 'water', music: 'coast', levelMin: 10, levelMax: 20, background: '#e0cf95', baseTerrain: 'sand', spawn: { x: 220, y: 900 } });
  paintRect(map, 'water', 0, 0, 4000, 260); paintRect(map, 'water', 1150, 1150, 850, 350); paintRect(map, 'water', 2050, 300, 300, 1100); paintRect(map, 'water', 2950, 900, 560, 320);
  paintRect(map, 'path', 200, 800, 1900, 90); paintRect(map, 'grass', 1100, 400, 900, 400); paintRect(map, 'rock', 2900, 0, 700, 800); paintRect(map, 'cliff', 3980, 0, 20, 1500);
  const g = {}; for (const [id, name] of [['water_g', 'Water'], ['objects_g', 'Objects'], ['npcs_g', 'NPCs'], ['zones_g', 'Spawn Zones'], ['warps_g', 'Warps']]) g[id] = mapAddNode(map, makeNode('group', { id, name }));
  const rnd = seededRandom(21);
  const names = () => Object.values(map.nodes).map((n) => n.name);
  const place = (pf, x, y, gid, extra = {}) => mapAddNode(map, makePrefabNode(pf, Math.round(x), Math.round(y), Object.assign({ name: nextName(PREFABS[pf].name.replace(/\s/g, ''), names()) }, extra)), gid);
  for (let i = 0; i < 12; i++) place('water_rock', 100 + rnd() * 3700, 270 + rnd() * 40, 'water_g');
  for (let i = 0; i < 16; i++) place('reed', 2000 + rnd() * 40, 320 + rnd() * 1000, 'water_g');
  for (let i = 0; i < 10; i++) place('rock', 2950 + rnd() * 600, 100 + rnd() * 600, 'objects_g', { variant: 2 });
  for (let i = 0; i < 8; i++) place('crystal', 2960 + rnd() * 560, 120 + rnd() * 620, 'objects_g', { variant: 0 });
  place('bridge', 2200, 880, 'water_g', { shape: { w: 360, h: 180 } });
  place('dock', 330, 350, 'water_g', { shape: { w: 300, h: 110 } }); place('dock', 850, 350, 'water_g', { shape: { w: 260, h: 110 } });
  place('building', 405, 720, 'objects_g', { name: 'Mythling_Center', variant: 1, shape: { w: 210, h: 170 }, behavior: { interactable: true, kind: 'center', name: 'Mythling Center' } });
  place('building', 755, 720, 'objects_g', { name: 'Trading_Post', variant: 2, shape: { w: 190, h: 160 }, behavior: { interactable: true, kind: 'shop', name: 'Tidecrest Trading Post' } });
  place('sign', 560, 900, 'objects_g', { behavior: { interactable: true, text: 'TIDECREST PORT — Region 2. Wild Mythlings Lv.10–20.' } });
  place('gate', 3900, 760, 'objects_g', { name: 'Emberwild_Gate' });
  mapAddNode(map, makeNode('npc', { name: 'Harbor_Master', x: 600, y: 600, npc: { kind: 'guide', color: '#4aa8e8', dialogue: ['The tide is calm today. Aquini love the shallows past the docks.'] } }), 'npcs_g');
  mapAddNode(map, makeNode('npc', { name: 'Diver_Kai', x: 1500, y: 700, npc: { kind: 'trainer', color: '#2b6fb0', dialogue: ['Coralway is my turf!'], team: [{ species: 'aquini', level: 13 }, { species: 'rivruff', level: 14 }], flag: 'coast_t1' } }), 'npcs_g');
  mapAddNode(map, makeNode('zone', { name: 'Coralway_Zone', x: 1550, y: 700, shape: { w: 900, h: 700 }, zone: { name: 'Coralway Zone', species: ['aquini', 'rivruff'], minLevel: 10, maxLevel: 15, weight: 5, mutationChance: 2 } }), 'zones_g');
  mapAddNode(map, makeNode('zone', { name: 'Caverns_Zone', x: 3250, y: 400, shape: { w: 700, h: 700 }, zone: { name: 'Caverns Zone', species: ['aquini', 'rivruff', 'emberu'], minLevel: 15, maxLevel: 20, weight: 6, mutationChance: 3 } }), 'zones_g');
  mapAddNode(map, makeNode('spawn', { name: 'Player_Spawn', x: 220, y: 900, spawn: { kind: 'player', direction: 'right', enabled: true } }), 'zones_g');
  mapAddNode(map, makeNode('warp', { name: 'Warp_Verdant', x: 60, y: 900, shape: { w: 80, h: 300 }, warp: { toMap: 'verdant_vale', toX: 3400, toY: 760, label: 'To Verdant Vale' } }), 'warps_g');
  mapAddNode(map, makeNode('warp', { name: 'Warp_Emberwild', x: 3950, y: 760, shape: { w: 80, h: 320 }, warp: { toMap: 'emberwild', toX: 200, toY: 800, requiredFlag: 'tide_charm', label: 'To Emberwild' } }), 'warps_g');
  return map;
}
function demoEmberwild() {
  const map = newMap({ id: 'emberwild', name: 'Emberwild', width: 3800, height: 1500, theme: 'fire', music: 'ember', levelMin: 20, levelMax: 32, background: '#5c4a46', baseTerrain: 'rock', spawn: { x: 200, y: 800 } });
  paintRect(map, 'lava', 900, 0, 300, 600); paintRect(map, 'lava', 1800, 1000, 900, 500); paintRect(map, 'lava', 2900, 0, 400, 500); paintRect(map, 'dirt', 100, 600, 3600, 300); paintRect(map, 'path', 100, 730, 3600, 60);
  const g = {}; for (const [id, name] of [['objects_g', 'Objects'], ['npcs_g', 'NPCs'], ['zones_g', 'Spawn Zones'], ['warps_g', 'Warps']]) g[id] = mapAddNode(map, makeNode('group', { id, name }));
  const rnd = seededRandom(99);
  const names = () => Object.values(map.nodes).map((n) => n.name);
  const place = (pf, x, y, gid, extra = {}) => mapAddNode(map, makePrefabNode(pf, Math.round(x), Math.round(y), Object.assign({ name: nextName(PREFABS[pf].name.replace(/\s/g, ''), names()) }, extra)), gid);
  for (let i = 0; i < 18; i++) place('volcanic_rock', 200 + rnd() * 3400, 100 + rnd() * 500, 'objects_g');
  for (let i = 0; i < 14; i++) place('ash_tree', 200 + rnd() * 3400, 950 + rnd() * 500, 'objects_g');
  for (let i = 0; i < 10; i++) place('lava_rock', 1200 + rnd() * 2400, 300 + rnd() * 300, 'objects_g');
  for (let i = 0; i < 8; i++) place('burning_rock', 300 + rnd() * 3200, 1000 + rnd() * 400, 'objects_g');
  for (let i = 0; i < 8; i++) place('crystal', 400 + rnd() * 3000, 200 + rnd() * 400, 'objects_g', { variant: 2 });
  place('building', 405, 560, 'objects_g', { name: 'Mythling_Center', variant: 1, shape: { w: 210, h: 170 }, behavior: { interactable: true, kind: 'center', name: 'Mythling Center' } });
  place('building', 755, 560, 'objects_g', { name: 'Forge_Shop', variant: 2, shape: { w: 190, h: 160 }, behavior: { interactable: true, kind: 'shop', name: 'Emberwild Forge' } });
  mapAddNode(map, makeNode('npc', { name: 'Smith_Brann', x: 620, y: 660, npc: { kind: 'shop', color: '#f0743a', dialogue: ['Ember-forged balls, best in the wild. Also the only King Ball for sale anywhere.'] } }), 'npcs_g');
  mapAddNode(map, makeNode('npc', { name: 'Pyre_Warden', x: 3400, y: 700, npc: { kind: 'trainer', color: '#c33c22', dialogue: ['The Emberwild answers only to strength.'], team: [{ species: 'emberu', level: 28 }, { species: 'emberu', level: 30 }], flag: 'ember_guardian', guardian: true } }), 'npcs_g');
  mapAddNode(map, makeNode('zone', { name: 'Ashfield_Zone', x: 1600, y: 350, shape: { w: 1600, h: 500 }, zone: { name: 'Ashfield Zone', species: ['emberu', 'leaflet'], minLevel: 20, maxLevel: 26, weight: 5, mutationChance: 3 } }), 'zones_g');
  mapAddNode(map, makeNode('zone', { name: 'Cinder_Grove_Zone', x: 1200, y: 1200, shape: { w: 1200, h: 500 }, zone: { name: 'Cinder Grove Zone', species: ['emberu', 'rivruff'], minLevel: 26, maxLevel: 32, weight: 6, mutationChance: 4 } }), 'zones_g');
  mapAddNode(map, makeNode('spawn', { name: 'Player_Spawn', x: 200, y: 800, spawn: { kind: 'player', direction: 'right', enabled: true } }), 'zones_g');
  mapAddNode(map, makeNode('warp', { name: 'Warp_Azure', x: 50, y: 760, shape: { w: 80, h: 300 }, warp: { toMap: 'azure_coast', toX: 3800, toY: 760, label: 'To Azure Coast' } }), 'warps_g');
  return map;
}

/** The first-run project: three maps, five Mythlings with rigs + animations, VFX, skills. */
function buildDemoProject() {
  const p = emptyProject('Mythlings Wildbound', 'mythlings-wildbound');
  for (const m of [demoVerdantVale(), demoAzureCoast(), demoEmberwild()]) p.maps[m.id] = m;
  for (const key of Object.keys(SPECIES_TEMPLATES)) {
    const my = createMythlingFromTemplate(key);
    p.mythlings[key] = my;
    attachDefaultAnimations(p, my);
  }
  for (const v of defaultVFX()) p.vfx[v.id] = v;
  p.mythlings.spriggo.vfx = ['nature_burst', 'leaf_trail', 'ultimate_verdant'];
  p.mythlings.leaflet.vfx = ['nature_burst', 'leaf_trail'];
  p.mythlings.aquini.vfx = ['water_shot']; p.mythlings.rivruff.vfx = ['water_shot'];
  p.mythlings.emberu.vfx = ['flame_rawr'];
  p.skills = defaultSkills();
  return p;
}
