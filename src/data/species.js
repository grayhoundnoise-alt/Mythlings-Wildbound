// Species database. Fully data-driven so new Mythlings can be appended later.
//
// evolutions[] index = evolution stage:
//   0 = base (Lv.1)   1 = first evolution (Lv.20)
//   2 = Lv.60 (FUTURE, locked)   3 = Lv.80 (FUTURE, locked)
//
// The current build's level cap (30) means only stages 0 and 1 are reachable.
// The Lv.60 / Lv.80 architecture is intentionally preserved for future updates.

export const SPECIES = {
  spriggo: {
    id: 'spriggo',
    displayName: 'Spriggo',
    breed: 'Fox',
    element: 'nature',
    defaultRarity: 'D',
    defaultMood: 'brave',
    role: 'Balanced',
    starter: true,
    catchRate: 0.55,
    expYield: 62,
    description: 'A curious forest fox whose leaf-tail rustles when it senses adventure. Vines coil around its forelegs like living bracers.',
    baseStats: { hp: 110, patk: 14, satk: 16, pdef: 13, sdef: 15, spd: 14, counter: 8 },
    ultimate: 'verdant_crush',
    spawnMaps: ['verdant_vale'],
    evolutions: [
      { stage: 0, name: 'Spriggo',   level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Thornox',   level: 20, statMult: 1.34, art: { scale: 1.22, horns: true } },
      { stage: 2, name: 'Verdantor', level: 60, statMult: 1.75, future: true, art: { scale: 1.42, horns: true } },
      { stage: 3, name: 'Floragon',  level: 80, statMult: 2.20, future: true, art: { scale: 1.65, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'vine_lash', 'brave_guard'],
      20: ['thorn_spear', 'thorn_armor'],
      60: ['nature_burst', 'wild_instinct'],
      80: ['ancient_bloom', 'forest_blessing'],
    },
    art: {
      body: 'fox',
      primary: '#5fb45a', secondary: '#3c7a3f', belly: '#e9dfae',
      accent: '#8fe06a', eye: '#7cff7c', dark: '#2c5730',
    },
  },

  aquini: {
    id: 'aquini',
    displayName: 'Aquini',
    breed: 'Feline',
    element: 'water',
    defaultRarity: 'D',
    defaultMood: 'clever',
    role: 'Fast Special Attacker',
    starter: true,
    catchRate: 0.52,
    expYield: 64,
    description: 'A sleek river cat with ear-fins that catch the current. It leaves rings of droplets wherever it steps.',
    baseStats: { hp: 95, patk: 11, satk: 19, pdef: 10, sdef: 16, spd: 19, counter: 11 },
    ultimate: 'tidal_burst',
    spawnMaps: ['azure_coast'],
    evolutions: [
      { stage: 0, name: 'Aquini',   level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Aquaro',   level: 20, statMult: 1.34, art: { scale: 1.20, horns: true } },
      { stage: 2, name: 'Tideron',  level: 60, statMult: 1.75, future: true, art: { scale: 1.40, horns: true } },
      { stage: 3, name: 'Leviaron', level: 80, statMult: 2.20, future: true, art: { scale: 1.62, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['scratch', 'water_shot', 'flow_focus'],
      20: ['aqua_spear', 'tidal_focus'],
      60: ['whirlpool', 'deep_current'],
      80: ['ocean_pressure', 'ocean_mind'],
    },
    art: {
      body: 'feline',
      primary: '#4aa8e8', secondary: '#2b6fb0', belly: '#e8f7ff',
      accent: '#9be8ff', eye: '#b8f4ff', dark: '#1d4a78',
    },
  },

  emberu: {
    id: 'emberu',
    displayName: 'Emberu',
    breed: 'Dragon',
    element: 'fire',
    defaultRarity: 'D',
    defaultMood: 'fierce',
    role: 'Offensive',
    starter: true,
    catchRate: 0.45,
    expYield: 70,
    description: 'A stocky young dragon with an ember glowing on its brow. Small puffs of smoke escape its nose when it is excited.',
    baseStats: { hp: 105, patk: 18, satk: 18, pdef: 12, sdef: 11, spd: 13, counter: 7 },
    ultimate: 'fire_blast',
    spawnMaps: ['emberwild'],
    evolutions: [
      { stage: 0, name: 'Emberu',    level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Flamero',   level: 20, statMult: 1.34, art: { scale: 1.24, horns: true, wings: true } },
      { stage: 2, name: 'Inferno',   level: 60, statMult: 1.75, future: true, art: { scale: 1.46, horns: true, wings: true } },
      { stage: 3, name: 'Ignidrake', level: 80, statMult: 2.20, future: true, art: { scale: 1.70, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'flame_rawr', 'dragon_fury'],
      20: ['burning_fang', 'burning_scales'],
      60: ['inferno_roar', 'dragon_heat'],
      80: ['dragon_inferno', 'ancient_flame'],
    },
    art: {
      body: 'dragon',
      primary: '#f0743a', secondary: '#c33c22', belly: '#ffd9a0',
      accent: '#ffb347', eye: '#fff0a8', dark: '#7d2413',
    },
  },

  rivruff: {
    id: 'rivruff',
    displayName: 'Rivruff',
    breed: 'Wolf',
    element: 'water',
    defaultRarity: 'D',
    defaultMood: 'lazy',
    role: 'Tank',
    starter: false,
    catchRate: 0.5,
    expYield: 66,
    description: 'A broad-pawed river wolf. A slow ribbon of water always circles its mane, even far from the shore.',
    baseStats: { hp: 120, patk: 13, satk: 12, pdef: 17, sdef: 15, spd: 9, counter: 5 },
    ultimate: 'ocean_guard',
    spawnMaps: ['azure_coast'],
    evolutions: [
      { stage: 0, name: 'Rivruff',  level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Torruff',  level: 20, statMult: 1.34, art: { scale: 1.24, horns: true } },
      { stage: 2, name: 'Cascadon', level: 60, statMult: 1.75, future: true, art: { scale: 1.44, horns: true } },
      { stage: 3, name: 'Maelwolf', level: 80, statMult: 2.20, future: true, art: { scale: 1.68, horns: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'water_splash', 'aqua_guard'],
      20: ['heavy_wave', 'thick_fur'],
      60: ['crushing_current', 'deep_guard'],
      80: ['abyssal_wave', 'fortress_hide'],
    },
    art: {
      body: 'wolf',
      primary: '#7f9dc4', secondary: '#4f6f96', belly: '#e4eef8',
      accent: '#a8dcff', eye: '#cdefff', dark: '#33506f',
    },
  },

  leaflet: {
    id: 'leaflet',
    displayName: 'Leaflet',
    breed: 'Avian',
    element: 'nature',
    defaultRarity: 'D',
    defaultMood: 'playful',
    role: 'Speed / Evasion',
    starter: false,
    catchRate: 0.62,
    expYield: 52,
    description: 'A palm-sized forest bird whose feathers grew into leaves. It never stops hopping, even while asleep.',
    baseStats: { hp: 80, patk: 11, satk: 14, pdef: 8, sdef: 12, spd: 21, counter: 18 },
    ultimate: 'leafstorm',
    spawnMaps: ['verdant_vale'],
    evolutions: [
      { stage: 0, name: 'Leaflet',   level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Frondwing', level: 20, statMult: 1.34, art: { scale: 1.22, wings: true } },
      { stage: 2, name: 'Galecrest', level: 60, statMult: 1.75, future: true, art: { scale: 1.42, wings: true } },
      { stage: 3, name: 'Zephyrax',  level: 80, statMult: 2.20, future: true, art: { scale: 1.64, wings: true, horns: true } },
    ],
    skillUnlocks: {
      1:  ['peck', 'leaf_shot', 'quick_breeze'],
      20: ['razor_wing', 'wind_step'],
      60: ['sky_cutter', 'feather_flow'],
      80: ['sky_cyclone', 'gale_mastery'],
    },
    art: {
      body: 'avian',
      primary: '#8fd45a', secondary: '#5a9c3c', belly: '#f4f0c0',
      accent: '#d6f77a', eye: '#3a2a12', dark: '#3c6b27',
    },
  },
};

export const SPECIES_IDS = Object.keys(SPECIES);
export const STARTER_IDS = SPECIES_IDS.filter((id) => SPECIES[id].starter);

export function getSpecies(id) {
  return SPECIES[id] || null;
}

export function getEvolutionStage(speciesId, stage) {
  const sp = getSpecies(speciesId);
  if (!sp) return null;
  return sp.evolutions[Math.max(0, Math.min(stage, sp.evolutions.length - 1))];
}

/** All skills a species knows by a given level & stage (cumulative, respecting the level cap). */
export function skillsUnlockedAt(speciesId, level) {
  const sp = getSpecies(speciesId);
  if (!sp) return [];
  const out = [];
  for (const key of Object.keys(sp.skillUnlocks)) {
    if (level >= Number(key)) out.push(...sp.skillUnlocks[key]);
  }
  return out;
}
