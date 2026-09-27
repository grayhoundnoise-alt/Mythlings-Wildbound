// DESIGN RULE: a Buff skill raises exactly ONE stat. `effects` stays an array so
// the battle engine (and future multi-effect content) needs no changes, but every
// buff in this build ships with a single entry — see buffSummary() in ui code.
//
// Skill definitions. Categories: 'normal' (infinite uses), 'special', 'buff', 'ultimate'.
// damageType: 'physical' (P.ATK vs P.DEF) | 'special' (S.ATK vs S.DEF) | null for buffs.
// Roman numerals are ONLY used for intentional stronger versions of the same skill
// (in practice: Ultimates, which upgrade Base -> I -> II -> III).

export const SKILLS = {
  // ---------- Shared normal skills ----------
  bite:    { id: 'bite',    name: 'Bite',    category: 'normal', damageType: 'physical', element: null, power: 10, uses: Infinity, desc: 'A quick bite. Unlimited uses.' },
  scratch: { id: 'scratch', name: 'Scratch', category: 'normal', damageType: 'physical', element: null, power: 10, uses: Infinity, desc: 'A swift claw swipe. Unlimited uses.' },
  peck:    { id: 'peck',    name: 'Peck',    category: 'normal', damageType: 'physical', element: null, power: 10, uses: Infinity, desc: 'A sharp beak jab. Unlimited uses.' },

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

/** Human-readable summary of a buff skill (always exactly one stat). */
export function buffSummary(sk, joiner = ' ') {
  if (!sk || !sk.effects) return '';
  const short = { hp: 'HP', patk: 'P.ATK', satk: 'S.ATK', pdef: 'P.DEF', sdef: 'S.DEF', spd: 'SPD', counter: 'CNT' };
  return sk.effects.map((e) => `${short[e.stat] || e.stat.toUpperCase()}${joiner}+${e.amount}`).join(', ');
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
