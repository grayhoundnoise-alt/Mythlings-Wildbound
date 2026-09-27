// DESIGN RULE: a Buff skill raises exactly ONE stat and a Debuff skill lowers
// exactly ONE enemy stat. `effects` stays an array so the battle engine (and
// future multi-effect content) needs no changes, but every buff/debuff in this
// build ships with a single entry — see buffSummary() in ui code.
//
// Skill definitions. Categories: 'normal' (infinite uses), 'special', 'buff',
// 'debuff' (lowers a stat of the FOE) and 'ultimate'.
// damageType: 'physical' (P.ATK vs P.DEF) | 'special' (S.ATK vs S.DEF) | null for buffs/debuffs.
// Roman numerals are ONLY used for intentional stronger versions of the same skill
// (in practice: Ultimates, which upgrade Base -> I -> II -> III).

export const SKILLS = {
  // ---------- Shared normal skills ----------
  bite:    { id: 'bite',    name: 'Bite',    category: 'normal', damageType: 'physical', element: null, power: 10, uses: Infinity, desc: 'A quick bite. Unlimited uses.' },
  scratch: { id: 'scratch', name: 'Scratch', category: 'normal', damageType: 'physical', element: null, power: 10, uses: Infinity, desc: 'A swift claw swipe. Unlimited uses.' },
  peck:    { id: 'peck',    name: 'Peck',    category: 'normal', damageType: 'physical', element: null, power: 10, uses: Infinity, desc: 'A sharp beak jab. Unlimited uses.' },

  // ---------- Evolved normal skills ----------
  // Evolutions used to grant only Specials and Buffs, so a Mythling's unlimited
  // attack stayed at the Lv.1 power forever. Every stage now also teaches a
  // stronger unlimited Normal move (weaker than the stage's Special, because it
  // never runs out).
  thorn_jab:      { id: 'thorn_jab',      name: 'Thorn Jab',      category: 'normal', damageType: 'physical', element: 'nature', power: 17, uses: Infinity, desc: 'A jab of hardened thorns. Unlimited uses.' },
  briar_smash:    { id: 'briar_smash',    name: 'Briar Smash',    category: 'normal', damageType: 'physical', element: 'nature', power: 29, uses: Infinity, desc: 'A crushing blow wrapped in briars. Unlimited uses.' },
  worldroot_slam: { id: 'worldroot_slam', name: 'Worldroot Slam', category: 'normal', damageType: 'physical', element: 'nature', power: 40, uses: Infinity, desc: 'Roots older than the forest come down. Unlimited uses.' },
  stream_jab:     { id: 'stream_jab',     name: 'Stream Jab',     category: 'normal', damageType: 'physical', element: 'water',  power: 17, uses: Infinity, desc: 'A lance of running water. Unlimited uses.' },
  tide_smash:     { id: 'tide_smash',     name: 'Tide Smash',     category: 'normal', damageType: 'physical', element: 'water',  power: 30, uses: Infinity, desc: 'The weight of the turning tide. Unlimited uses.' },
  abyss_slam:     { id: 'abyss_slam',     name: 'Abyss Slam',     category: 'normal', damageType: 'physical', element: 'water',  power: 41, uses: Infinity, desc: 'Pressure from the lightless deep. Unlimited uses.' },
  ember_jab:      { id: 'ember_jab',      name: 'Ember Jab',      category: 'normal', damageType: 'physical', element: 'fire',   power: 18, uses: Infinity, desc: 'A searing strike. Unlimited uses.' },
  cinder_smash:   { id: 'cinder_smash',   name: 'Cinder Smash',   category: 'normal', damageType: 'physical', element: 'fire',   power: 31, uses: Infinity, desc: 'A heavy blow wreathed in cinders. Unlimited uses.' },
  magma_slam:     { id: 'magma_slam',     name: 'Magma Slam',     category: 'normal', damageType: 'physical', element: 'fire',   power: 42, uses: Infinity, desc: 'A fist of cooled magma. Unlimited uses.' },
  struggle:       { id: 'struggle',       name: 'Struggle',       category: 'normal', damageType: 'physical', element: null,     power: 8,  uses: Infinity, desc: 'A desperate shove when nothing else is left. Unlimited uses.' },

  // ---------- SPRIGGO line ----------
  vine_lash:      { id: 'vine_lash',      name: 'Vine Lash',      category: 'special', damageType: 'special',  element: 'nature', power: 16, uses: 20, desc: 'Whips the foe with a living vine.' },
  brave_guard:    { id: 'brave_guard',    name: 'Brave Guard',    category: 'buff', effects: [{ stat: 'patk', amount: 4 }], uses: 10, desc: 'Raises Physical Attack.' },
  thorn_spear:    { id: 'thorn_spear',    name: 'Thorn Spear',    category: 'special', damageType: 'special',  element: 'nature', power: 26, uses: 18, desc: 'Fires a hardened thorn lance.' },
  thorn_armor:    { id: 'thorn_armor',    name: 'Thorn Armor',    category: 'buff', effects: [{ stat: 'pdef', amount: 4 }], uses: 10, desc: 'Raises Physical Defense.' },
  nature_burst:   { id: 'nature_burst',   name: 'Nature Burst',   category: 'special', damageType: 'special',  element: 'nature', power: 38, uses: 15, desc: 'A bursting wave of wild growth.', future: true },
  wild_instinct:  { id: 'wild_instinct',  name: 'Wild Instinct',  category: 'buff', effects: [{ stat: 'spd', amount: 5 }], uses: 8, desc: 'Raises Speed.', future: true },
  ancient_bloom:  { id: 'ancient_bloom',  name: 'Ancient Bloom',  category: 'special', damageType: 'special',  element: 'nature', power: 52, uses: 12, desc: 'Ancient petals tear through the foe.', future: true },
  forest_blessing:{ id: 'forest_blessing',name: 'Forest Blessing',category: 'buff', effects: [{ stat: 'satk', amount: 6 }], uses: 8, desc: 'Raises Special Attack.', future: true },

  // ---------- AQUINI line ----------
  water_shot:   { id: 'water_shot',   name: 'Water Shot',   category: 'special', damageType: 'special', element: 'water', power: 17, uses: 20, desc: 'A pressurized jet of water.' },
  flow_focus:   { id: 'flow_focus',   name: 'Flow Focus',   category: 'buff', effects: [{ stat: 'satk', amount: 4 }], uses: 10, desc: 'Raises Special Attack.' },
  aqua_spear:   { id: 'aqua_spear',   name: 'Aqua Spear',   category: 'special', damageType: 'special', element: 'water', power: 28, uses: 18, desc: 'A lance of compressed water.' },
  tidal_focus:  { id: 'tidal_focus',  name: 'Tidal Focus',  category: 'buff', effects: [{ stat: 'sdef', amount: 4 }], uses: 10, desc: 'Raises Special Defense.' },
  whirlpool:    { id: 'whirlpool',    name: 'Whirlpool',    category: 'special', damageType: 'special', element: 'water', power: 40, uses: 15, desc: 'May reduce the foe\'s Speed.', debuff: { stat: 'spd', amount: 3, chance: 0.35 }, future: true },
  deep_current: { id: 'deep_current', name: 'Deep Current', category: 'buff', effects: [{ stat: 'spd', amount: 5 }], uses: 8, desc: 'Raises Speed.', future: true },
  ocean_pressure:{ id: 'ocean_pressure',name:'Ocean Pressure',category:'special', damageType: 'special', element: 'water', power: 54, uses: 12, desc: 'May reduce the foe\'s Special Defense.', debuff: { stat: 'sdef', amount: 4, chance: 0.4 }, future: true },
  ocean_mind:   { id: 'ocean_mind',   name: 'Ocean Mind',   category: 'buff', effects: [{ stat: 'satk', amount: 6 }], uses: 8, desc: 'Raises Special Attack.', future: true },

  // ---------- EMBERU line ----------
  flame_rawr:    { id: 'flame_rawr',    name: 'Flame Rawr',    category: 'special', damageType: 'special', element: 'fire', power: 17, uses: 20, desc: 'A roaring gout of flame.' },
  dragon_fury:   { id: 'dragon_fury',   name: 'Dragon Fury',   category: 'buff', effects: [{ stat: 'patk', amount: 4 }], uses: 10, desc: 'Raises Physical Attack.' },
  burning_fang:  { id: 'burning_fang',  name: 'Burning Fang',  category: 'special', damageType: 'physical', element: 'fire', power: 28, uses: 18, desc: 'A fang wreathed in fire.' },
  burning_scales:{ id: 'burning_scales',name: 'Burning Scales',category: 'buff', effects: [{ stat: 'pdef', amount: 4 }], uses: 10, desc: 'Raises Physical Defense.' },
  inferno_roar:  { id: 'inferno_roar',  name: 'Inferno Roar',  category: 'special', damageType: 'special', element: 'fire', power: 42, uses: 15, desc: 'A devastating roar of fire.', future: true },
  dragon_heat:   { id: 'dragon_heat',   name: 'Dragon Heat',   category: 'buff', effects: [{ stat: 'spd', amount: 5 }], uses: 8, desc: 'Raises Speed.', future: true },
  dragon_inferno:{ id: 'dragon_inferno',name: 'Dragon Inferno',category: 'special', damageType: 'special', element: 'fire', power: 56, uses: 12, desc: 'May reduce the foe\'s Physical Defense.', debuff: { stat: 'pdef', amount: 4, chance: 0.4 }, future: true },
  ancient_flame: { id: 'ancient_flame', name: 'Ancient Flame', category: 'buff', effects: [{ stat: 'satk', amount: 6 }], uses: 8, desc: 'Raises Special Attack.', future: true },

  // ---------- RIVRUFF line ----------
  water_splash:    { id: 'water_splash',    name: 'Water Splash',    category: 'special', damageType: 'special', element: 'water', power: 14, uses: 20, desc: 'A heavy splash of river water.' },
  aqua_guard:      { id: 'aqua_guard',      name: 'Aqua Guard',      category: 'buff', effects: [{ stat: 'pdef', amount: 4 }], uses: 10, desc: 'Raises Physical Defense.' },
  heavy_wave:      { id: 'heavy_wave',      name: 'Heavy Wave',      category: 'special', damageType: 'special', element: 'water', power: 23, uses: 18, desc: 'A crushing wall of water.' },
  thick_fur:       { id: 'thick_fur',       name: 'Thick Fur',       category: 'buff', effects: [{ stat: 'hp', amount: 9 }], uses: 10, desc: 'Raises maximum HP.' },
  crushing_current:{ id: 'crushing_current',name: 'Crushing Current',category: 'special', damageType: 'special', element: 'water', power: 35, uses: 15, desc: 'May reduce the foe\'s Speed.', debuff: { stat: 'spd', amount: 3, chance: 0.35 }, future: true },
  deep_guard:      { id: 'deep_guard',      name: 'Deep Guard',      category: 'buff', effects: [{ stat: 'counter', amount: 4 }], uses: 8, desc: 'Raises Counter (evasion).', future: true },
  abyssal_wave:    { id: 'abyssal_wave',    name: 'Abyssal Wave',    category: 'special', damageType: 'special', element: 'water', power: 48, uses: 12, desc: 'A wave from the lightless deep.', future: true },
  fortress_hide:   { id: 'fortress_hide',   name: 'Fortress Hide',   category: 'buff', effects: [{ stat: 'pdef', amount: 7 }], uses: 8, desc: 'Raises Physical Defense sharply.', future: true },

  // ---------- LEAFLET line ----------
  leaf_shot:     { id: 'leaf_shot',     name: 'Leaf Shot',     category: 'special', damageType: 'special', element: 'nature', power: 15, uses: 20, desc: 'Fires a spinning razor leaf.' },
  quick_breeze:  { id: 'quick_breeze',  name: 'Quick Breeze',  category: 'buff', effects: [{ stat: 'spd', amount: 4 }], uses: 10, desc: 'Raises Speed.' },
  razor_wing:    { id: 'razor_wing',    name: 'Razor Wing',    category: 'special', damageType: 'physical', element: 'nature', power: 27, uses: 18, desc: 'Slashes with bladed feathers.' },
  wind_step:     { id: 'wind_step',     name: 'Wind Step',     category: 'buff', effects: [{ stat: 'counter', amount: 4 }], uses: 10, desc: 'Raises Counter (evasion).' },
  sky_cutter:    { id: 'sky_cutter',    name: 'Sky Cutter',    category: 'special', damageType: 'physical', element: 'nature', power: 39, uses: 15, desc: 'A diving aerial strike.', future: true },
  feather_flow:  { id: 'feather_flow',  name: 'Feather Flow',  category: 'buff', effects: [{ stat: 'spd', amount: 5 }], uses: 8, desc: 'Raises Speed.', future: true },
  sky_cyclone:   { id: 'sky_cyclone',   name: 'Sky Cyclone',   category: 'special', damageType: 'special', element: 'nature', power: 51, uses: 12, desc: 'May reduce the foe\'s Speed.', debuff: { stat: 'spd', amount: 4, chance: 0.4 }, future: true },
  gale_mastery:  { id: 'gale_mastery',  name: 'Gale Mastery',  category: 'buff', effects: [{ stat: 'satk', amount: 6 }], uses: 8, desc: 'Raises Special Attack.', future: true },

  // ---------- DEBUFF skills (lower ONE stat of the FOE) ----------
  // Every element has the same ladder: two -4 openers (P.ATK / S.ATK), a Speed
  // opener, two -5 defence breakers and two -7 late-game curses. Species pick the
  // ones that suit their role in species.js. Debuffs never grant Ultimate Charge.
  // -- nature --
  sap_drain:       { id: 'sap_drain',       name: 'Sap Drain',       category: 'debuff', effects: [{ stat: 'patk', amount: 4 }], uses: 12, desc: "Saps the foe's strength. Lowers its Physical Attack." },
  spore_haze:      { id: 'spore_haze',      name: 'Spore Haze',      category: 'debuff', effects: [{ stat: 'satk', amount: 4 }], uses: 12, desc: 'A dizzying cloud of spores. Lowers the foe\'s Special Attack.' },
  bramble_snare:   { id: 'bramble_snare',   name: 'Bramble Snare',   category: 'debuff', effects: [{ stat: 'spd',  amount: 4 }], uses: 12, desc: 'Tangles the foe in brambles. Lowers its Speed.' },
  root_rot:        { id: 'root_rot',        name: 'Root Rot',        category: 'debuff', effects: [{ stat: 'pdef', amount: 5 }], uses: 10, desc: "Rots the foe's guard away. Lowers its Physical Defense." },
  pollen_veil:     { id: 'pollen_veil',     name: 'Pollen Veil',     category: 'debuff', effects: [{ stat: 'sdef', amount: 5 }], uses: 10, desc: 'Clogs the foe\'s senses. Lowers its Special Defense.' },
  withering_curse: { id: 'withering_curse', name: 'Withering Curse', category: 'debuff', effects: [{ stat: 'pdef', amount: 7 }], uses: 8,  desc: 'An old forest hex. Lowers the foe\'s Physical Defense sharply.' },
  blight_bloom:    { id: 'blight_bloom',    name: 'Blight Bloom',    category: 'debuff', effects: [{ stat: 'sdef', amount: 7 }], uses: 8,  desc: 'A flower that drinks magic. Lowers the foe\'s Special Defense sharply.' },
  // -- water --
  soak:            { id: 'soak',            name: 'Soak',            category: 'debuff', effects: [{ stat: 'patk', amount: 4 }], uses: 12, desc: 'Drenches the foe to the bone. Lowers its Physical Attack.' },
  mist_veil:       { id: 'mist_veil',       name: 'Mist Veil',       category: 'debuff', effects: [{ stat: 'satk', amount: 4 }], uses: 12, desc: 'A blinding sea mist. Lowers the foe\'s Special Attack.' },
  undertow:        { id: 'undertow',        name: 'Undertow',        category: 'debuff', effects: [{ stat: 'spd',  amount: 4 }], uses: 12, desc: 'Drags at the foe\'s legs. Lowers its Speed.' },
  brine_rust:      { id: 'brine_rust',      name: 'Brine Rust',      category: 'debuff', effects: [{ stat: 'pdef', amount: 5 }], uses: 10, desc: 'Salt eats through armour. Lowers the foe\'s Physical Defense.' },
  pressure_drop:   { id: 'pressure_drop',   name: 'Pressure Drop',   category: 'debuff', effects: [{ stat: 'sdef', amount: 5 }], uses: 10, desc: 'Deep-sea pressure. Lowers the foe\'s Special Defense.' },
  abyssal_chill:   { id: 'abyssal_chill',   name: 'Abyssal Chill',   category: 'debuff', effects: [{ stat: 'pdef', amount: 7 }], uses: 8,  desc: 'Cold from the trench. Lowers the foe\'s Physical Defense sharply.' },
  riptide_pull:    { id: 'riptide_pull',    name: 'Riptide Pull',    category: 'debuff', effects: [{ stat: 'sdef', amount: 7 }], uses: 8,  desc: 'Tears the foe\'s focus away. Lowers its Special Defense sharply.' },
  // -- fire --
  scorch:          { id: 'scorch',          name: 'Scorch',          category: 'debuff', effects: [{ stat: 'patk', amount: 4 }], uses: 12, desc: 'Burns the foe\'s limbs. Lowers its Physical Attack.' },
  heat_haze:       { id: 'heat_haze',       name: 'Heat Haze',       category: 'debuff', effects: [{ stat: 'satk', amount: 4 }], uses: 12, desc: 'Shimmering heat breaks concentration. Lowers the foe\'s Special Attack.' },
  singe:           { id: 'singe',           name: 'Singe',           category: 'debuff', effects: [{ stat: 'spd',  amount: 4 }], uses: 12, desc: 'Scorches the foe\'s feet. Lowers its Speed.' },
  melt_armor:      { id: 'melt_armor',      name: 'Melt Armor',      category: 'debuff', effects: [{ stat: 'pdef', amount: 5 }], uses: 10, desc: 'Softens the foe\'s hide. Lowers its Physical Defense.' },
  ash_cloud:       { id: 'ash_cloud',       name: 'Ash Cloud',       category: 'debuff', effects: [{ stat: 'sdef', amount: 5 }], uses: 10, desc: 'Choking ash. Lowers the foe\'s Special Defense.' },
  magma_brand:     { id: 'magma_brand',     name: 'Magma Brand',     category: 'debuff', effects: [{ stat: 'pdef', amount: 7 }], uses: 8,  desc: 'A searing brand. Lowers the foe\'s Physical Defense sharply.' },
  cinder_curse:    { id: 'cinder_curse',    name: 'Cinder Curse',    category: 'debuff', effects: [{ stat: 'sdef', amount: 7 }], uses: 8,  desc: 'Smouldering cinders cling to the foe. Lowers its Special Defense sharply.' },

};

// ---------- Ultimates ----------
// Tier index 0 = base (Lv.10), 1 = " I" (Lv.20), 2 = " II" (Lv.60, future), 3 = " III" (Lv.80, future)
export const ULTIMATES = {
  verdant_crush: {
    id: 'verdant_crush', baseName: 'Verdant Crush', element: 'nature', damageType: 'special',
    tiers: [
      { suffix: '',    power: 34, unlockLevel: 10 },
      { suffix: ' I',  power: 50, unlockLevel: 20 },
      { suffix: ' II', power: 74, unlockLevel: 60, future: true },
      { suffix: ' III',power: 104, unlockLevel: 80, future: true },
    ],
    desc: 'Colossal roots erupt and crush the foe.',
  },
  tidal_burst: {
    id: 'tidal_burst', baseName: 'Tidal Burst', element: 'water', damageType: 'special',
    tiers: [
      { suffix: '',    power: 34, unlockLevel: 10 },
      { suffix: ' I',  power: 50, unlockLevel: 20 },
      { suffix: ' II', power: 74, unlockLevel: 60, future: true },
      { suffix: ' III',power: 104, unlockLevel: 80, future: true },
    ],
    desc: 'A towering tide detonates on impact.',
  },
  fire_blast: {
    id: 'fire_blast', baseName: 'Fire Blast', element: 'fire', damageType: 'special',
    tiers: [
      { suffix: '',    power: 36, unlockLevel: 10 },
      { suffix: ' I',  power: 52, unlockLevel: 20 },
      { suffix: ' II', power: 76, unlockLevel: 60, future: true },
      { suffix: ' III',power: 106, unlockLevel: 80, future: true },
    ],
    desc: 'A concentrated star of dragonfire.',
  },
  ocean_guard: {
    id: 'ocean_guard', baseName: 'Ocean Guard', element: 'water', damageType: 'special',
    tiers: [
      { suffix: '',    power: 30, unlockLevel: 10, selfBuff: [{ stat: 'pdef', amount: 5 }] },
      { suffix: ' I',  power: 44, unlockLevel: 20, selfBuff: [{ stat: 'pdef', amount: 7 }] },
      { suffix: ' II', power: 66, unlockLevel: 60, future: true, selfBuff: [{ stat: 'pdef', amount: 10 }] },
      { suffix: ' III',power: 94, unlockLevel: 80, future: true, selfBuff: [{ stat: 'pdef', amount: 13 }] },
    ],
    desc: 'A guardian tide strikes, then shields its caster.',
  },
  leafstorm: {
    id: 'leafstorm', baseName: 'Leafstorm', element: 'nature', damageType: 'special',
    tiers: [
      { suffix: '',    power: 32, unlockLevel: 10 },
      { suffix: ' I',  power: 47, unlockLevel: 20 },
      { suffix: ' II', power: 70, unlockLevel: 60, future: true },
      { suffix: ' III',power: 100, unlockLevel: 80, future: true },
    ],
    desc: 'A cyclone of razor leaves engulfs the field.',
  },
};

export const ULTIMATE_MAX_CHARGE = 8;
export const MAX_BUFF_STACKS = 30;

/** Battle-button / library labels for every skill category. */
export const SKILL_CATEGORY_LABEL = { normal: 'Normal', special: 'Special', buff: 'Buff', debuff: 'Debuff', ultimate: 'Ultimate' };

/** Sort order of the categories in the Skill Library and the wiki. */
export const SKILL_CATEGORY_ORDER = ['normal', 'special', 'buff', 'debuff', 'ultimate'];

/** True when a skill deals damage (Normal / Special / Ultimate). */
export function isDamageSkill(sk) {
  return !!sk && sk.category !== 'buff' && sk.category !== 'debuff';
}

/**
 * Human-readable summary of a buff or debuff skill (always exactly one stat).
 * Buffs read "P.ATK +4", debuffs read "P.DEF -5" (they lower the FOE's stat).
 */
export function buffSummary(sk, joiner = ' ') {
  if (!sk || !sk.effects) return '';
  const short = { hp: 'HP', patk: 'P.ATK', satk: 'S.ATK', pdef: 'P.DEF', sdef: 'S.DEF', spd: 'SPD', counter: 'CNT' };
  const sign = sk.category === 'debuff' ? '-' : '+';
  return sk.effects.map((e) => `${short[e.stat] || e.stat.toUpperCase()}${joiner}${sign}${e.amount}`).join(', ');
}

/**
 * Rank used to order skills "by level and power": lower unlock level first,
 * then weaker before stronger (damage power, or the stat change for buffs and
 * debuffs). `level` is the level the skill is learned at.
 */
export function skillStrength(sk) {
  if (!sk) return 0;
  if (sk.category === 'buff' || sk.category === 'debuff') return (sk.effects || []).reduce((s, e) => s + Math.abs(e.amount), 0);
  return sk.power || 0;
}

export function getSkill(id) {
  return SKILLS[id] || null;
}

export function getUltimate(id) {
  return ULTIMATES[id] || null;
}

/** Resolve the concrete ultimate move for an ultimate id at a given tier. */
export function resolveUltimate(ultId, tierIndex) {
  const ult = getUltimate(ultId);
  if (!ult) return null;
  const idx = Math.max(0, Math.min(tierIndex, ult.tiers.length - 1));
  const tier = ult.tiers[idx];
  return {
    id: `${ult.id}:${idx}`,
    ultimateId: ult.id,
    tierIndex: idx,
    name: ult.baseName + tier.suffix,
    category: 'ultimate',
    damageType: ult.damageType,
    element: ult.element,
    power: tier.power,
    selfBuff: tier.selfBuff || null,
    desc: ult.desc,
    future: !!tier.future,
  };
}
