// Species database. Fully data-driven so new Mythlings can be appended later.
//
// evolutions[] index = evolution stage:
//   0 = base (Lv.1)   1 = first evolution (Lv.20)
//   2 = Lv.60 (FUTURE, locked)   3 = Lv.80 (FUTURE, locked)
//
// skillUnlocks keys are LEVELS: 1 / 20 / 60 / 80 are the evolution stages
// (one Normal, one Special and one Buff each) and 1 / 12 / 40 add the species'
// Debuff skills (an opener, a defence breaker and a late-game curse).
// With the level cap at 100 every stage is reachable.

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
    baseStats: { hp: 110, patk: 14, satk: 16, pdef: 13, sdef: 15, spd: 14, counter: 8, crit: 3, critMult: 16 },
    ultimate: 'verdant_crush',
    spawnMaps: ['verdant_vale'],
    evolutions: [
      { stage: 0, name: 'Spriggo',   level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Thornox',   level: 20, statMult: 1.34, art: { scale: 1.22, horns: true } },
      { stage: 2, name: 'Verdantor', level: 60, statMult: 1.75, future: true, art: { scale: 1.42, horns: true } },
      { stage: 3, name: 'Floragon',  level: 80, statMult: 2.20, future: true, art: { scale: 1.65, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'vine_lash', 'brave_guard', 'sap_drain'],
      12: ['pollen_veil'],
      20: ['thorn_spear', 'thorn_armor', 'thorn_jab'],
      40: ['blight_bloom'],
      60: ['nature_burst', 'wild_instinct', 'briar_smash', 'sap_bite', 'worldroot_crown'],
      80: ['ancient_bloom', 'forest_blessing', 'worldroot_slam'],
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
    baseStats: { hp: 95, patk: 11, satk: 19, pdef: 10, sdef: 16, spd: 19, counter: 11, crit: 4, critMult: 17 },
    ultimate: 'tidal_burst',
    spawnMaps: ['azure_coast'],
    evolutions: [
      { stage: 0, name: 'Aquini',   level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Aquaro',   level: 20, statMult: 1.34, art: { scale: 1.20, horns: true } },
      { stage: 2, name: 'Tideron',  level: 60, statMult: 1.75, future: true, art: { scale: 1.40, horns: true } },
      { stage: 3, name: 'Leviaron', level: 80, statMult: 2.20, future: true, art: { scale: 1.62, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['scratch', 'water_shot', 'flow_focus', 'mist_veil'],
      12: ['pressure_drop'],
      20: ['aqua_spear', 'tidal_focus', 'stream_jab'],
      40: ['riptide_pull'],
      60: ['whirlpool', 'deep_current', 'tide_smash', 'siphon_tide', 'monsoon_call'],
      80: ['ocean_pressure', 'ocean_mind', 'abyss_slam'],
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
    defaultMood: 'sturdy',
    role: 'Offensive',
    starter: true,
    catchRate: 0.45,
    expYield: 70,
    description: 'A stocky young dragon with an ember glowing on its brow. Small puffs of smoke escape its nose when it is excited.',
    baseStats: { hp: 105, patk: 18, satk: 18, pdef: 12, sdef: 11, spd: 13, counter: 7, crit: 4, critMult: 19 },
    ultimate: 'fire_blast',
    spawnMaps: ['emberwild'],
    evolutions: [
      { stage: 0, name: 'Emberu',    level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Flamero',   level: 20, statMult: 1.34, art: { scale: 1.24, horns: true, wings: true } },
      { stage: 2, name: 'Inferno',   level: 60, statMult: 1.75, future: true, art: { scale: 1.46, horns: true, wings: true } },
      { stage: 3, name: 'Ignidrake', level: 80, statMult: 2.20, future: true, art: { scale: 1.70, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'flame_rawr', 'dragon_fury', 'scorch'],
      12: ['ash_cloud'],
      20: ['burning_fang', 'burning_scales', 'ember_jab'],
      40: ['cinder_curse'],
      60: ['inferno_roar', 'dragon_heat', 'cinder_smash', 'ember_leech', 'magma_storm'],
      80: ['dragon_inferno', 'ancient_flame', 'magma_slam'],
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
    defaultMood: 'sturdy',
    role: 'Tank',
    starter: false,
    catchRate: 0.5,
    expYield: 66,
    description: 'A broad-pawed river wolf. A slow ribbon of water always circles its mane, even far from the shore.',
    baseStats: { hp: 120, patk: 13, satk: 12, pdef: 17, sdef: 15, spd: 9, counter: 5, crit: 2, critMult: 13 },
    ultimate: 'ocean_guard',
    spawnMaps: ['azure_coast'],
    evolutions: [
      { stage: 0, name: 'Rivruff',  level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Torruff',  level: 20, statMult: 1.34, art: { scale: 1.24, horns: true } },
      { stage: 2, name: 'Cascadon', level: 60, statMult: 1.75, future: true, art: { scale: 1.44, horns: true } },
      { stage: 3, name: 'Maelwolf', level: 80, statMult: 2.20, future: true, art: { scale: 1.68, horns: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'water_splash', 'aqua_guard', 'soak'],
      12: ['brine_rust'],
      20: ['heavy_wave', 'thick_fur', 'stream_jab'],
      40: ['abyssal_chill'],
      60: ['crushing_current', 'deep_guard', 'tide_smash'],
      80: ['abyssal_wave', 'fortress_hide', 'abyss_slam', 'retaliate'],
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
    defaultMood: 'swift',
    role: 'Speed / Evasion',
    starter: false,
    catchRate: 0.62,
    expYield: 52,
    description: 'A palm-sized forest bird whose feathers grew into leaves. It never stops hopping, even while asleep.',
    baseStats: { hp: 80, patk: 11, satk: 14, pdef: 8, sdef: 12, spd: 21, counter: 18, crit: 6, critMult: 21 },
    ultimate: 'leafstorm',
    spawnMaps: ['verdant_vale'],
    evolutions: [
      { stage: 0, name: 'Leaflet',   level: 1,  statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Frondwing', level: 20, statMult: 1.34, art: { scale: 1.22, wings: true } },
      { stage: 2, name: 'Galecrest', level: 60, statMult: 1.75, future: true, art: { scale: 1.42, wings: true } },
      { stage: 3, name: 'Zephyrax',  level: 80, statMult: 2.20, future: true, art: { scale: 1.64, wings: true, horns: true } },
    ],
    skillUnlocks: {
      1:  ['peck', 'leaf_shot', 'quick_breeze', 'bramble_snare'],
      12: ['root_rot'],
      20: ['razor_wing', 'wind_step', 'thorn_jab'],
      40: ['withering_curse'],
      60: ['sky_cutter', 'feather_flow', 'briar_smash'],
      80: ['sky_cyclone', 'gale_mastery', 'worldroot_slam', 'mending_strike'],
    },
    art: {
      body: 'avian',
      primary: '#8fd45a', secondary: '#5a9c3c', belly: '#f4f0c0',
      accent: '#d6f77a', eye: '#3a2a12', dark: '#3c6b27',
    },
  },
  thornhound: {
    id: 'thornhound',
    displayName: 'Thornhound',
    breed: 'Hound',
    element: 'nature',
    defaultRarity: 'C',
    defaultMood: 'sturdy',
    role: 'Bulky Attacker',
    catchRate: 0.5,
    expYield: 66,
    description: 'A thick-coated pack hunter with briars for a ruff. It tanks a hit and answers with a shoulder charge.',
    baseStats: { hp: 125, patk: 18, satk: 10, pdef: 16, sdef: 12, spd: 10, counter: 6, crit: 3, critMult: 15 },
    ultimate: 'verdant_crush',
    spawnMaps: ['verdant_vale'],
    evolutions: [
      { stage: 0, name: 'Thornpup', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Thornhound', level: 20, statMult: 1.36, art: { scale: 1.21 } },
      { stage: 2, name: 'Briarfang', level: 60, statMult: 1.80, art: { scale: 1.41, horns: true } },
      { stage: 3, name: 'Rootwarden', level: 80, statMult: 2.28, art: { scale: 1.63, horns: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'vine_lash', 'brave_guard', 'spore_haze'],
      12: ['root_rot'],
      20: ['thorn_spear', 'thorn_armor', 'thorn_jab', 'tangle_snare'],
      40: ['withering_curse'],
      60: ['nature_burst', 'wild_instinct', 'briar_smash', 'worldroot_crown'],
      80: ['ancient_bloom', 'forest_blessing', 'worldroot_slam', 'war_cry'],
    },
    art: {
      body: 'wolf',
      primary: '#6b8f4e', secondary: '#3f5c33', belly: '#e6dfae',
      accent: '#a7d86b', eye: '#8dff7a', dark: '#26381f',
    },
  },
  mosscoil: {
    id: 'mosscoil',
    displayName: 'Mosscoil',
    breed: 'Fox',
    element: 'nature',
    defaultRarity: 'C',
    defaultMood: 'clever',
    role: 'Tricky Support',
    catchRate: 0.52,
    expYield: 62,
    description: 'Vines coil around its legs and never touch the ground. It fights by tripping foes and slipping away.',
    baseStats: { hp: 105, patk: 12, satk: 15, pdef: 13, sdef: 14, spd: 15, counter: 14, crit: 4, critMult: 17 },
    ultimate: 'leafstorm',
    spawnMaps: ['verdant_vale'],
    evolutions: [
      { stage: 0, name: 'Mosskit', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Mosscoil', level: 20, statMult: 1.34, art: { scale: 1.22 } },
      { stage: 2, name: 'Vineshade', level: 60, statMult: 1.75, art: { scale: 1.42, horns: true } },
      { stage: 3, name: 'Worldcoil', level: 80, statMult: 2.20, art: { scale: 1.65, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'vine_lash', 'brave_guard', 'bramble_snare'],
      12: ['pollen_veil'],
      20: ['thorn_spear', 'thorn_armor', 'thorn_jab', 'tangle_snare'],
      40: ['blight_bloom', 'spore_drift'],
      60: ['nature_burst', 'wild_instinct', 'briar_smash'],
      80: ['ancient_bloom', 'forest_blessing', 'worldroot_slam', 'mind_break'],
    },
    art: {
      body: 'fox',
      primary: '#4f9e6a', secondary: '#2f6b47', belly: '#dff0c8',
      accent: '#7ce0a0', eye: '#b6ffd0', dark: '#1d4432',
    },
  },
  petalwisp: {
    id: 'petalwisp',
    displayName: 'Petalwisp',
    breed: 'Avian',
    element: 'nature',
    defaultRarity: 'C',
    defaultMood: 'calm',
    role: 'Speed Support',
    catchRate: 0.58,
    expYield: 58,
    description: 'A blossom-feathered flier that scatters pollen on the wind. It is gone before most Mythlings react.',
    baseStats: { hp: 90, patk: 10, satk: 16, pdef: 9, sdef: 13, spd: 21, counter: 13, crit: 4, critMult: 17 },
    ultimate: 'leafstorm',
    spawnMaps: ['verdant_vale'],
    evolutions: [
      { stage: 0, name: 'Petalflit', level: 1, statMult: 1.00, art: { scale: 1.00, wings: true } },
      { stage: 1, name: 'Petalwisp', level: 20, statMult: 1.32, art: { scale: 1.19, wings: true } },
      { stage: 2, name: 'Bloomdancer', level: 60, statMult: 1.72, art: { scale: 1.39, wings: true } },
      { stage: 3, name: 'Skyblossom', level: 80, statMult: 2.15, art: { scale: 1.60, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['peck', 'vine_lash', 'brave_guard', 'spore_haze'],
      12: ['pollen_veil'],
      20: ['thorn_spear', 'thorn_armor', 'thorn_jab'],
      40: ['blight_bloom', 'spore_drift'],
      60: ['nature_burst', 'wild_instinct', 'briar_smash'],
      80: ['ancient_bloom', 'forest_blessing', 'worldroot_slam', 'restoring_pulse'],
    },
    art: {
      body: 'avian',
      primary: '#e58fb8', secondary: '#a3557f', belly: '#ffe9f2',
      accent: '#ffc2dd', eye: '#8dffb0', dark: '#5c2a44',
    },
  },
  tidewyrm: {
    id: 'tidewyrm',
    displayName: 'Tidewyrm',
    breed: 'Serpent',
    element: 'water',
    defaultRarity: 'C',
    defaultMood: 'brave',
    role: 'Special Wall',
    catchRate: 0.46,
    expYield: 70,
    description: 'A long river serpent that reads the current like a script. Waves break against its scales and go nowhere.',
    baseStats: { hp: 115, patk: 10, satk: 17, pdef: 12, sdef: 20, spd: 11, counter: 8, crit: 3, critMult: 16 },
    ultimate: 'ocean_guard',
    spawnMaps: ['azure_coast'],
    evolutions: [
      { stage: 0, name: 'Tidelet', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Tidewyrm', level: 20, statMult: 1.38, art: { scale: 1.24 } },
      { stage: 2, name: 'Maelstrake', level: 60, statMult: 1.80, art: { scale: 1.46, horns: true } },
      { stage: 3, name: 'Abysscoil', level: 80, statMult: 2.28, art: { scale: 1.70, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'water_shot', 'flow_focus', 'mist_veil'],
      12: ['pressure_drop'],
      20: ['aqua_spear', 'tidal_focus', 'stream_jab'],
      40: ['riptide_pull'],
      60: ['whirlpool', 'deep_current', 'tide_smash', 'monsoon_call'],
      80: ['ocean_pressure', 'ocean_mind', 'abyss_slam', 'arcane_surge'],
    },
    art: {
      body: 'dragon',
      primary: '#3f7fd0', secondary: '#24508f', belly: '#dff1ff',
      accent: '#7fc0ff', eye: '#9fe8ff', dark: '#16305c',
    },
  },
  shelldrake: {
    id: 'shelldrake',
    displayName: 'Shelldrake',
    breed: 'Hound',
    element: 'water',
    defaultRarity: 'C',
    defaultMood: 'sturdy',
    role: 'Tank',
    catchRate: 0.48,
    expYield: 68,
    description: 'A coast guardian grown into its own shell. It simply refuses to move, and the tide does the rest.',
    baseStats: { hp: 135, patk: 15, satk: 10, pdef: 19, sdef: 15, spd: 8, counter: 5, crit: 3, critMult: 14 },
    ultimate: 'ocean_guard',
    spawnMaps: ['azure_coast'],
    evolutions: [
      { stage: 0, name: 'Shellpup', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Shelldrake', level: 20, statMult: 1.40, art: { scale: 1.21 } },
      { stage: 2, name: 'Tidebastion', level: 60, statMult: 1.84, art: { scale: 1.41, horns: true } },
      { stage: 3, name: 'Fortressshell', level: 80, statMult: 2.34, art: { scale: 1.63, horns: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'water_shot', 'flow_focus', 'soak'],
      12: ['brine_rust'],
      20: ['aqua_spear', 'tidal_focus', 'stream_jab'],
      40: ['abyssal_chill'],
      60: ['whirlpool', 'deep_current', 'tide_smash', 'retaliate'],
      80: ['ocean_pressure', 'ocean_mind', 'abyss_slam', 'bulwark'],
    },
    art: {
      body: 'wolf',
      primary: '#3fa8a0', secondary: '#206b6b', belly: '#e2fbff',
      accent: '#7fe6dd', eye: '#b6fff5', dark: '#124040',
    },
  },
  currentkit: {
    id: 'currentkit',
    displayName: 'Currentkit',
    breed: 'Feline',
    element: 'water',
    defaultRarity: 'C',
    defaultMood: 'brave',
    role: 'Fast Physical',
    catchRate: 0.5,
    expYield: 66,
    description: 'A cat that runs on the surface of the water. It strikes first, often, and then is already somewhere else.',
    baseStats: { hp: 98, patk: 18, satk: 12, pdef: 11, sdef: 12, spd: 20, counter: 12, crit: 6, critMult: 19 },
    ultimate: 'tidal_burst',
    spawnMaps: ['azure_coast'],
    evolutions: [
      { stage: 0, name: 'Ripplet', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Currentkit', level: 20, statMult: 1.32, art: { scale: 1.20 } },
      { stage: 2, name: 'Torrentlynx', level: 60, statMult: 1.72, art: { scale: 1.40 } },
      { stage: 3, name: 'Stormcurrent', level: 80, statMult: 2.15, art: { scale: 1.62, horns: true } },
    ],
    skillUnlocks: {
      1:  ['scratch', 'water_shot', 'flow_focus', 'undertow'],
      12: ['brine_rust'],
      20: ['aqua_spear', 'tidal_focus', 'stream_jab'],
      40: ['abyssal_chill'],
      60: ['whirlpool', 'deep_current', 'tide_smash', 'mending_strike'],
      80: ['ocean_pressure', 'ocean_mind', 'abyss_slam'],
    },
    art: {
      body: 'feline',
      primary: '#5cb8f0', secondary: '#2b72b8', belly: '#eaf9ff',
      accent: '#a8e6ff', eye: '#d8f6ff', dark: '#164a78',
    },
  },
  emberlynx: {
    id: 'emberlynx',
    displayName: 'Emberlynx',
    breed: 'Feline',
    element: 'fire',
    defaultRarity: 'C',
    defaultMood: 'brave',
    role: 'Physical Sweeper',
    catchRate: 0.44,
    expYield: 72,
    description: 'Its claws glow from the inside. It hunts in straight lines and expects the fight to end quickly.',
    baseStats: { hp: 92, patk: 20, satk: 12, pdef: 10, sdef: 10, spd: 18, counter: 10, crit: 7, critMult: 21 },
    ultimate: 'fire_blast',
    spawnMaps: ['emberwild'],
    evolutions: [
      { stage: 0, name: 'Emberkit', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Emberlynx', level: 20, statMult: 1.32, art: { scale: 1.20 } },
      { stage: 2, name: 'Blazefang', level: 60, statMult: 1.72, art: { scale: 1.40, horns: true } },
      { stage: 3, name: 'Infernalynx', level: 80, statMult: 2.15, art: { scale: 1.62, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['scratch', 'flame_rawr', 'dragon_fury', 'singe'],
      12: ['melt_armor'],
      20: ['burning_fang', 'burning_scales', 'ember_jab'],
      40: ['magma_brand'],
      60: ['inferno_roar', 'dragon_heat', 'cinder_smash'],
      80: ['dragon_inferno', 'ancient_flame', 'magma_slam', 'predator_focus'],
    },
    art: {
      body: 'feline',
      primary: '#f0803c', secondary: '#b8451c', belly: '#ffe6c8',
      accent: '#ffb56b', eye: '#ffd27a', dark: '#5c1e08',
    },
  },
  cinderhawk: {
    id: 'cinderhawk',
    displayName: 'Cinderhawk',
    breed: 'Avian',
    element: 'fire',
    defaultRarity: 'C',
    defaultMood: 'sturdy',
    role: 'Glass Cannon',
    catchRate: 0.42,
    expYield: 74,
    description: 'A hunting bird that leaves a trail of embers. Enormous power, and almost nothing standing behind it.',
    baseStats: { hp: 82, patk: 11, satk: 21, pdef: 8, sdef: 9, spd: 22, counter: 12, crit: 6, critMult: 20 },
    ultimate: 'fire_blast',
    spawnMaps: ['emberwild'],
    evolutions: [
      { stage: 0, name: 'Cinderchick', level: 1, statMult: 1.00, art: { scale: 1.00, wings: true } },
      { stage: 1, name: 'Cinderhawk', level: 20, statMult: 1.30, art: { scale: 1.19, wings: true } },
      { stage: 2, name: 'Embertalon', level: 60, statMult: 1.70, art: { scale: 1.39, wings: true } },
      { stage: 3, name: 'Solarhawk', level: 80, statMult: 2.12, art: { scale: 1.60, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['peck', 'flame_rawr', 'dragon_fury', 'heat_haze'],
      12: ['ash_cloud'],
      20: ['burning_fang', 'burning_scales', 'ember_jab'],
      40: ['cinder_curse'],
      60: ['inferno_roar', 'dragon_heat', 'cinder_smash'],
      80: ['dragon_inferno', 'ancient_flame', 'magma_slam', 'vampiric_maw'],
    },
    art: {
      body: 'avian',
      primary: '#ffb03c', secondary: '#c96a12', belly: '#fff0d0',
      accent: '#ffd98a', eye: '#fff3b0', dark: '#6b3208',
    },
  },
  magmataur: {
    id: 'magmataur',
    displayName: 'Magmataur',
    breed: 'Dragon',
    element: 'fire',
    defaultRarity: 'B',
    defaultMood: 'sturdy',
    role: 'Heavy Hitter',
    catchRate: 0.38,
    expYield: 78,
    description: 'Slow, immense and patient as a volcano. Everything it lands is the last thing most Mythlings feel.',
    baseStats: { hp: 120, patk: 22, satk: 14, pdef: 15, sdef: 12, spd: 7, counter: 4, crit: 4, critMult: 18 },
    ultimate: 'fire_blast',
    spawnMaps: ['emberwild'],
    evolutions: [
      { stage: 0, name: 'Ashwhelp', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Magmataur', level: 20, statMult: 1.36, art: { scale: 1.24, horns: true } },
      { stage: 2, name: 'Moltenhorne', level: 60, statMult: 1.80, art: { scale: 1.46, horns: true } },
      { stage: 3, name: 'Cataclysm', level: 80, statMult: 2.28, art: { scale: 1.70, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'flame_rawr', 'dragon_fury', 'scorch'],
      12: ['melt_armor'],
      20: ['burning_fang', 'burning_scales', 'ember_jab'],
      40: ['magma_brand'],
      60: ['inferno_roar', 'dragon_heat', 'cinder_smash', 'magma_storm'],
      80: ['dragon_inferno', 'ancient_flame', 'magma_slam', 'intimidate'],
    },
    art: {
      body: 'dragon',
      primary: '#c94a2a', secondary: '#7d2412', belly: '#ffd9a8',
      accent: '#ff8340', eye: '#ffb04a', dark: '#4a1005',
    },
  },
  ashpup: {
    id: 'ashpup',
    displayName: 'Ashpup',
    breed: 'Hound',
    element: 'fire',
    defaultRarity: 'C',
    defaultMood: 'sturdy',
    role: 'Balanced Bruiser',
    catchRate: 0.52,
    expYield: 64,
    description: 'An ash-coated pack runner from the foothills. It gives nothing away and takes whatever is offered.',
    baseStats: { hp: 112, patk: 17, satk: 14, pdef: 14, sdef: 13, spd: 13, counter: 9, crit: 4, critMult: 17 },
    ultimate: 'fire_blast',
    spawnMaps: ['emberwild'],
    evolutions: [
      { stage: 0, name: 'Ashpup', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Cinderpelt', level: 20, statMult: 1.34, art: { scale: 1.21 } },
      { stage: 2, name: 'Emberhowl', level: 60, statMult: 1.75, art: { scale: 1.41, horns: true } },
      { stage: 3, name: 'Duskfang', level: 80, statMult: 2.20, art: { scale: 1.63, horns: true } },
    ],
    skillUnlocks: {
      1:  ['bite', 'flame_rawr', 'dragon_fury', 'singe'],
      12: ['melt_armor'],
      20: ['burning_fang', 'burning_scales', 'ember_jab'],
      40: ['magma_brand'],
      60: ['inferno_roar', 'dragon_heat', 'cinder_smash'],
      80: ['dragon_inferno', 'ancient_flame', 'magma_slam', 'shatter'],
    },
    art: {
      body: 'wolf',
      primary: '#a45a4a', secondary: '#6b332a', belly: '#f0dcc8',
      accent: '#d88a6a', eye: '#ffb090', dark: '#3a1a14',
    },
  },

  // =====================================================================
  // ROCK — Stonehollow Crags (Lv.45-60). Five new body plans: tortoise,
  // boar, beetle, golem and lizard.
  // =====================================================================
  pebbleshell: {
    id: 'pebbleshell',
    displayName: 'Pebbleshell',
    breed: 'Tortoise',
    element: 'rock',
    defaultRarity: 'C',
    defaultMood: 'guarded',
    role: 'Wall',
    catchRate: 0.50,
    expYield: 72,
    description: 'A patient tortoise whose shell grows crystal spikes as it ages. Nothing hurries it, and very little hurts it.',
    baseStats: { hp: 132, patk: 14, satk: 10, pdef: 21, sdef: 16, spd: 7, counter: 4, crit: 2, critMult: 16 },
    ultimate: 'granite_bastion',
    spawnMaps: ['stonehollow_crags'],
    evolutions: [
      { stage: 0, name: 'Pebbleshell', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Cragshell', level: 20, statMult: 1.36, art: { scale: 1.22 } },
      { stage: 2, name: 'Terradome', level: 60, statMult: 1.80, art: { scale: 1.44, horns: true } },
      { stage: 3, name: 'Titanshell', level: 80, statMult: 2.30, art: { scale: 1.68, horns: true } },
    ],
    skillUnlocks: {
      1:  ['pebble_toss', 'stone_shard', 'stone_skin', 'petrify'],
      12: ['crush_armor'],
      20: ['crag_lance', 'mountain_heart', 'rock_jab'],
      40: ['fault_line'],
      60: ['meteor_fist', 'bulwark', 'boulder_smash'],
      80: ['titan_quake', 'restoring_pulse', 'tectonic_slam'],
    },
    art: {
      body: 'tortoise',
      primary: '#7f9a6a', secondary: '#5e6f57', belly: '#e6dcb8',
      accent: '#c9b27a', eye: '#f2e6a0', dark: '#2f3a2c',
    },
  },
  gravelhog: {
    id: 'gravelhog',
    displayName: 'Gravelhog',
    breed: 'Boar',
    element: 'rock',
    defaultRarity: 'C',
    defaultMood: 'brave',
    role: 'Physical Bruiser',
    catchRate: 0.48,
    expYield: 74,
    description: 'A boar with a back of fused gravel and tusks of raw flint. It charges first and thinks never.',
    baseStats: { hp: 118, patk: 21, satk: 9, pdef: 16, sdef: 11, spd: 12, counter: 6, crit: 4, critMult: 18 },
    ultimate: 'stone_avalanche',
    spawnMaps: ['stonehollow_crags'],
    evolutions: [
      { stage: 0, name: 'Gravelhog', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Bouldertusk', level: 20, statMult: 1.34, art: { scale: 1.22, horns: true } },
      { stage: 2, name: 'Ridgeback', level: 60, statMult: 1.76, art: { scale: 1.43, horns: true } },
      { stage: 3, name: 'Terratusk', level: 80, statMult: 2.22, art: { scale: 1.66, horns: true } },
    ],
    skillUnlocks: {
      1:  ['pebble_toss', 'stone_shard', 'granite_might', 'sandstorm'],
      12: ['crush_armor'],
      20: ['crag_lance', 'stone_skin', 'rock_jab'],
      40: ['fault_line'],
      60: ['meteor_fist', 'war_cry', 'boulder_smash'],
      80: ['titan_quake', 'obsidian_edge', 'tectonic_slam'],
    },
    art: {
      body: 'boar',
      primary: '#8b6f5a', secondary: '#5a4538', belly: '#d9c6a8',
      accent: '#c4a57a', eye: '#ffcf7a', dark: '#2e211a',
    },
  },
  quartzling: {
    id: 'quartzling',
    displayName: 'Quartzling',
    breed: 'Beetle',
    element: 'rock',
    defaultRarity: 'C',
    defaultMood: 'clever',
    role: 'Special Attacker',
    catchRate: 0.46,
    expYield: 70,
    description: 'A beetle grown around a seed crystal. Light gathers in its carapace and leaves as a searing ray.',
    baseStats: { hp: 96, patk: 11, satk: 20, pdef: 13, sdef: 15, spd: 14, counter: 8, crit: 5, critMult: 17 },
    ultimate: 'crystal_cannon',
    spawnMaps: ['stonehollow_crags'],
    evolutions: [
      { stage: 0, name: 'Quartzling', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Geodrone', level: 20, statMult: 1.32, art: { scale: 1.20, horns: true } },
      { stage: 2, name: 'Prismatid', level: 60, statMult: 1.72, art: { scale: 1.40, horns: true, wings: true } },
      { stage: 3, name: 'Crystalisk', level: 80, statMult: 2.15, art: { scale: 1.62, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['pebble_toss', 'crystal_ray', 'quartz_focus', 'grit_blind'],
      12: ['quake_shock'],
      20: ['crystal_leech', 'bedrock_will', 'rock_jab'],
      40: ['stone_curse'],
      60: ['quartz_storm', 'arcane_surge', 'boulder_smash'],
      80: ['core_beam', 'geode_mind', 'tectonic_slam'],
    },
    art: {
      body: 'beetle',
      primary: '#6d6a8c', secondary: '#3f3c5c', belly: '#cfc6e6',
      accent: '#9ee6ff', eye: '#d8fbff', dark: '#221f36',
    },
  },
  rubblekin: {
    id: 'rubblekin',
    displayName: 'Rubblekin',
    breed: 'Golem',
    element: 'rock',
    defaultRarity: 'C',
    defaultMood: 'sturdy',
    role: 'Debuffer',
    catchRate: 0.44,
    expYield: 76,
    description: 'A heap of quarry stones that woke up one morning and decided to walk. It fights by taking the ground from under you.',
    baseStats: { hp: 126, patk: 16, satk: 13, pdef: 18, sdef: 14, spd: 6, counter: 3, crit: 3, critMult: 16 },
    ultimate: 'quake_curse',
    spawnMaps: ['stonehollow_crags'],
    evolutions: [
      { stage: 0, name: 'Rubblekin', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Cairnling', level: 20, statMult: 1.36, art: { scale: 1.23 } },
      { stage: 2, name: 'Monolith', level: 60, statMult: 1.80, art: { scale: 1.45, horns: true } },
      { stage: 3, name: 'Colossus', level: 80, statMult: 2.30, art: { scale: 1.70, horns: true } },
    ],
    skillUnlocks: {
      1:  ['pebble_toss', 'stone_shard', 'stone_skin', 'sandstorm'],
      12: ['quake_shock'],
      20: ['crag_lance', 'mountain_heart', 'rock_jab'],
      40: ['stone_curse'],
      60: ['meteor_fist', 'shatter', 'boulder_smash'],
      80: ['titan_quake', 'intimidate', 'tectonic_slam'],
    },
    art: {
      body: 'golem',
      primary: '#8a8478', secondary: '#5a554c', belly: '#bfb7a6',
      accent: '#ffb75a', eye: '#ffd98a', dark: '#2a2723',
    },
  },
  shalecrawl: {
    id: 'shalecrawl',
    displayName: 'Shalecrawl',
    breed: 'Lizard',
    element: 'rock',
    defaultRarity: 'C',
    defaultMood: 'swift',
    role: 'Striker',
    catchRate: 0.47,
    expYield: 68,
    description: 'A flat, quick lizard that skims across loose shale. Its crystal fins drink what its claws tear.',
    baseStats: { hp: 90, patk: 17, satk: 15, pdef: 11, sdef: 11, spd: 19, counter: 12, crit: 7, critMult: 20 },
    ultimate: 'crystal_resonance',
    spawnMaps: ['stonehollow_crags'],
    evolutions: [
      { stage: 0, name: 'Shalecrawl', level: 1, statMult: 1.00, art: { scale: 1.00 } },
      { stage: 1, name: 'Slatestrider', level: 20, statMult: 1.32, art: { scale: 1.20 } },
      { stage: 2, name: 'Flintclaw', level: 60, statMult: 1.72, art: { scale: 1.40, horns: true } },
      { stage: 3, name: 'Obsidrake', level: 80, statMult: 2.15, art: { scale: 1.62, horns: true, wings: true } },
    ],
    skillUnlocks: {
      1:  ['scratch', 'stone_shard', 'granite_might', 'petrify'],
      12: ['grit_blind'],
      20: ['crystal_leech', 'stone_skin', 'rock_jab'],
      40: ['fault_line'],
      60: ['retaliate', 'predator_focus', 'boulder_smash'],
      80: ['vampiric_maw', 'mind_break', 'tectonic_slam'],
    },
    art: {
      body: 'lizard',
      primary: '#5f6b7a', secondary: '#3c4552', belly: '#d2d8c8',
      accent: '#7fe0c8', eye: '#c8fff0', dark: '#1e242c',
    },
  },
};

// =============================================================================
// THE FIVE NEW ELEMENTS (Stormreach Plateau → Astral Spire): 25 species, two
// dual-typed lines and three legendaries, built from compact specs so every line
// shares the same balance rules:
//   * roles set the base stats and which support skills a line learns (buffs and
//     debuffs carry no element, so the neutral pool is shared),
//   * the element pool (skills.js) supplies the elemental normals, the special
//     ladder and the life-steal move,
//   * evolutions follow the usual Lv.1 / 20 / 60 / 80 stages with growing art flags.
// Dual-typed species learn BOTH elements' attacks. Legendaries have ONE stage,
// two or three elements, stronger stats and unlock their skills purely by level.
// =============================================================================
import { ELEMENT_POOLS } from './skills.js';

const ROLE_STATS = {
  physical: { hp: 108, patk: 19, satk: 10, pdef: 14, sdef: 12, spd: 15, counter: 8,  crit: 4,  critMult: 18 },
  special:  { hp: 96,  patk: 10, satk: 20, pdef: 11, sdef: 15, spd: 17, counter: 10, crit: 4,  critMult: 18 },
  tank:     { hp: 130, patk: 14, satk: 11, pdef: 20, sdef: 17, spd: 7,  counter: 5,  crit: 2,  critMult: 16 },
  fast:     { hp: 92,  patk: 17, satk: 14, pdef: 10, sdef: 11, spd: 22, counter: 12, crit: 6, critMult: 20 },
  balanced: { hp: 110, patk: 15, satk: 15, pdef: 14, sdef: 14, spd: 14, counter: 8,  crit: 3,  critMult: 17 },
};
const ROLE_LABEL = { physical: 'Physical Attacker', special: 'Special Attacker', tank: 'Wall', fast: 'Fast Striker', balanced: 'Balanced' };
// support skills by role: [Lv.1 buff, Lv.20 buff, Lv.60 buff, Lv.80 buff] / [Lv.1, Lv.12, Lv.40 debuffs] / Lv.80 elite
const ROLE_SUPPORT = {
  physical: { buffs: ['power_up', 'guard_up', 'haste', 'overpower'], debuffs: ['weaken', 'expose', 'cripple'],  elite: 'war_cry' },
  special:  { buffs: ['mind_up', 'ward_up', 'haste', 'overmind'],    debuffs: ['daze', 'unnerve', 'hex'],       elite: 'arcane_surge' },
  tank:     { buffs: ['guard_up', 'vitality', 'ward_up', 'fortify'], debuffs: ['weaken', 'unnerve', 'cripple'], elite: 'bulwark' },
  fast:     { buffs: ['power_up', 'haste', 'mind_up', 'overpower'],  debuffs: ['hobble', 'expose', 'hex'],      elite: 'predator_focus' },
  balanced: { buffs: ['mind_up', 'guard_up', 'haste', 'overmind'],   debuffs: ['weaken', 'unnerve', 'hex'],     elite: 'intimidate' },
};
const PLAIN_NORMAL = { fox: 'bite', feline: 'scratch', dragon: 'bite', wolf: 'bite', avian: 'peck', tortoise: 'pebble_toss', boar: 'bite', beetle: 'bite', golem: 'pebble_toss', lizard: 'bite', bat: 'bite', serpent: 'bite', wisp: 'scratch' };
const ART_FLAGS = [{ scale: 1.00 }, { scale: 1.22 }, { scale: 1.42, horns: true }, { scale: 1.65, horns: true, wings: true }];
const STAT_MULTS = [1.0, 1.34, 1.75, 2.2];

/** Ladder for a role: physical roles hit with the physical specials, everything else with the special ones. */
function ladderFor(role, pool) { return role === 'physical' || role === 'tank' || role === 'fast' ? pool.ph : pool.sp; }

/** Build the unlock table of a (possibly dual-typed) line. */
function unlocksFor(role, elements, plainNormal, extraLv1 = []) {
  const sup = ROLE_SUPPORT[role];
  const pools = elements.map((e) => ELEMENT_POOLS[e]).filter(Boolean);
  const main = pools[0];
  const second = pools[1] || null;
  const lad = ladderFor(role, main);
  const lad2 = second ? ladderFor(role === 'physical' ? 'special' : 'physical', second) : null;   // the second element hits with the other ladder
  const t = {
    1:  [plainNormal, lad[0][0], sup.buffs[0], sup.debuffs[0], ...extraLv1],
    12: [sup.debuffs[1]],
    20: [lad[1][0], sup.buffs[1], main.normals[0][0]],
    40: [sup.debuffs[2]],
    60: [lad[2][0], sup.buffs[2], main.normals[1][0], main.drain[0]],
    80: [lad[3][0], sup.buffs[3], main.normals[2][0], sup.elite],
  };
  if (second && lad2) {
    t[1].push(lad2[0][0]);
    t[20].push(lad2[1][0], second.normals[0][0]);
    t[60].push(lad2[2][0]);
    t[80].push(lad2[3][0], second.normals[2][0]);
  }
  return t;
}

/**
 * Merge hand-written skills into a generated unlock table. Used when a line is
 * dual-typed with one of the four ORIGINAL elements (Nature / Water / Fire /
 * Rock), whose moves are written by hand instead of generated from a pool — so
 * a Fighting/Fire brawler really does learn Fire attacks.
 */
function mergeExtra(table, extra) {
  if (!extra) return table;
  for (const [lv, ids] of Object.entries(extra)) {
    table[lv] = [...new Set([...(table[lv] || []), ...ids])];
  }
  return table;
}

/**
 * spec: { id, names[4], breed, body, role, element(s), ultimate, catchRate?, rarity?, mood?,
 *         desc, palette{primary,secondary,belly,accent,eye,dark}, spawnMaps[] }
 */
function line(spec) {
  const elements = spec.elements || [spec.element];
  const stats = { ...ROLE_STATS[spec.role] };
  for (const [k, v] of Object.entries(spec.tweak || {})) stats[k] += v;
  const entry = {
    id: spec.id, displayName: spec.names[0], breed: spec.breed,
    element: elements[0], ...(elements.length > 1 ? { elements } : {}),
    defaultRarity: spec.rarity || 'C', defaultMood: spec.mood || 'brave', role: ROLE_LABEL[spec.role],
    catchRate: spec.catchRate ?? 0.48, expYield: spec.expYield ?? 74,
    description: spec.desc, baseStats: stats, ultimate: spec.ultimate, spawnMaps: spec.spawnMaps,
    evolutions: spec.names.map((name, i) => ({ stage: i, name, level: [1, 20, 60, 80][i], statMult: STAT_MULTS[i], ...(i >= 2 ? { future: true } : {}), art: { ...ART_FLAGS[i], ...(spec.hornsEarly && i === 1 ? { horns: true } : {}) } })),
    skillUnlocks: mergeExtra(unlocksFor(spec.role, elements, PLAIN_NORMAL[spec.body] || 'bite'), spec.extraSkills),
    art: { body: spec.body, ...spec.palette },
  };
  SPECIES[spec.id] = entry;
}

/** A legendary: one form, 2-3 elements, stronger stats, purely level-based skills. */
function legend(spec) {
  const base = { ...ROLE_STATS[spec.role] };
  for (const k of Object.keys(base)) base[k] = Math.round(base[k] * (k === 'critMult' ? 1.1 : 1.28));
  for (const [k, v] of Object.entries(spec.tweak || {})) base[k] += v;
  const pools = spec.elements.map((e) => ELEMENT_POOLS[e] || null);
  // legendaries learn the attacks of every one of their elements, by level
  const t = { 1: [PLAIN_NORMAL[spec.body] || 'bite', ROLE_SUPPORT[spec.role].buffs[0], ROLE_SUPPORT[spec.role].debuffs[0]], 12: [ROLE_SUPPORT[spec.role].debuffs[1]], 20: [ROLE_SUPPORT[spec.role].buffs[1]], 40: [ROLE_SUPPORT[spec.role].debuffs[2]], 60: [ROLE_SUPPORT[spec.role].buffs[2]], 80: [ROLE_SUPPORT[spec.role].buffs[3], ROLE_SUPPORT[spec.role].elite, 'vengeance'] };
  spec.elements.forEach((el, i) => {
    const pool = pools[i];
    if (!pool) { (spec.legacySkills?.[el] || []).forEach(([lv, id]) => (t[lv] = t[lv] || []).push(id)); return; }
    const lad = (i === 0 ? ladderFor(spec.role, pool) : (spec.role === 'physical' ? pool.sp : pool.ph));
    t[1].push(lad[0][0]); t[20].push(lad[1][0], pool.normals[0][0]); t[60].push(lad[2][0], pool.normals[1][0]); t[80].push(lad[3][0], pool.normals[2][0]);
    if (i === 0) t[60].push(pool.drain[0]);
  });
  SPECIES[spec.id] = {
    id: spec.id, displayName: spec.name, breed: spec.breed, element: spec.elements[0], elements: spec.elements, legendary: true,
    defaultRarity: 'S', defaultMood: spec.mood || 'brave', role: `Legendary ${ROLE_LABEL[spec.role]}`,
    catchRate: 0.12, expYield: 160, description: spec.desc, baseStats: base, ultimate: spec.ultimate, spawnMaps: spec.spawnMaps, homeMap: spec.spawnMaps[0],
    evolutions: [{ stage: 0, name: spec.name, level: 1, statMult: 1.0, art: { scale: 1.45, horns: true, wings: true } }],
    skillUnlocks: mergeExtra(t, spec.extraSkills),
    art: { body: spec.body, ...spec.palette },
  };
}

// ---- ELECTRIC — Stormreach Plateau ------------------------------------------
line({ id: 'voltkit', names: ['Voltkit', 'Zapfox', 'Stormvulp', 'Thunderfox'], breed: 'Fox', body: 'fox', role: 'fast', element: 'electric', ultimate: 'gigavolt_charge', mood: 'swift', spawnMaps: ['stormreach_plateau'],
  desc: 'A fox whose fur crackles with static. It naps on the highest rock it can find and wakes up humming.',
  palette: { primary: '#f0c93c', secondary: '#b88a1a', belly: '#fff4c2', accent: '#7ee8ff', eye: '#4fd8ff', dark: '#4a3608' } ,
  extraSkills: { 60: ['thunder_caller'] }});
line({ id: 'staticat', names: ['Staticat', 'Voltclaw', 'Arcfeline', 'Tempestlynx'], breed: 'Feline', body: 'feline', role: 'special', element: 'electric', ultimate: 'thunder_crown', mood: 'clever', spawnMaps: ['stormreach_plateau'],
  desc: 'A sleek cat that stores lightning in its ear-fins. Petting it is a mistake you make once.',
  palette: { primary: '#5b6bd8', secondary: '#2e3a8a', belly: '#dfe6ff', accent: '#ffe85a', eye: '#fff0a0', dark: '#161c48' } ,
  extraSkills: { 40: ['static_bind'] }});
line({ id: 'boltpup', names: ['Boltpup', 'Voltwolf', 'Stormhowl', 'Thunderfang'], breed: 'Wolf', body: 'wolf', role: 'physical', element: 'electric', ultimate: 'gigavolt_charge', mood: 'brave', spawnMaps: ['stormreach_plateau'],
  desc: 'A pack runner that howls thunder back at the sky. Its bite jolts before it bruises.',
  palette: { primary: '#8a8fa8', secondary: '#4b5070', belly: '#e8eaf5', accent: '#ffd83a', eye: '#fff2a0', dark: '#22243a' } ,
  extraSkills: { 40: ['static_bind'] }});
line({ id: 'zapwing', names: ['Zapwing', 'Arcwing', 'Stormtalon', 'Skyvolt'], breed: 'Bird', body: 'avian', role: 'fast', element: 'electric', ultimate: 'thunder_crown', mood: 'focused', spawnMaps: ['stormreach_plateau'],
  desc: 'A storm-petrel that rides the lightning down. Its feathers glow before a strike.',
  palette: { primary: '#f7e27a', secondary: '#c49a2a', belly: '#fffbe0', accent: '#8fd8ff', eye: '#5fc8ff', dark: '#5a4210' } ,
  extraSkills: { 60: ['thunder_caller'] }});
line({ id: 'coilstone', names: ['Coilstone', 'Voltgolem', 'Dynamolith', 'Gigavolt'], breed: 'Golem', body: 'golem', role: 'tank', element: 'electric', ultimate: 'storm_mantle', mood: 'sturdy', spawnMaps: ['stormreach_plateau'],
  desc: 'A golem wound with copper coils that hum in a storm. Lightning strikes it on purpose.',
  palette: { primary: '#c47d3a', secondary: '#7a4a1c', belly: '#f2d7b0', accent: '#8ff0ff', eye: '#b8f8ff', dark: '#3a230c' } ,
  extraSkills: { 40: ['static_bind'] }});
// ---- ICE — Frostveil Tundra ---------------------------------------------------
line({ id: 'frostpup', names: ['Frostpup', 'Snowfang', 'Glacierwolf', 'Frosthowl'], breed: 'Wolf', body: 'wolf', role: 'physical', element: 'ice', ultimate: 'glacier_fall', mood: 'fierce', spawnMaps: ['frostveil_tundra'],
  desc: 'A white wolf whose breath freezes mid-air. It hunts in the blizzard nobody else can see through.',
  palette: { primary: '#e8f4ff', secondary: '#9fc4e0', belly: '#ffffff', accent: '#7fd8ff', eye: '#4fb8ff', dark: '#3a5670' } });
line({ id: 'snowkit', names: ['Snowkit', 'Frostlynx', 'Glacierlynx', 'Aurorlynx'], breed: 'Feline', body: 'feline', role: 'special', element: 'ice', ultimate: 'winter_crown', mood: 'calm', spawnMaps: ['frostveil_tundra'],
  desc: 'A lynx with frost crystals for whiskers. It can sit in a snowdrift for a whole day, waiting.',
  palette: { primary: '#bfe3ff', secondary: '#6ea8d8', belly: '#f4fbff', accent: '#ffffff', eye: '#a8ecff', dark: '#274a68' } ,
  extraSkills: { 40: ['frost_hush'] }});
line({ id: 'icecarap', names: ['Icecarap', 'Glaceshell', 'Frostdome', 'Glacierdome'], breed: 'Tortoise', body: 'tortoise', role: 'tank', element: 'ice', ultimate: 'frozen_bastion', mood: 'lazy', spawnMaps: ['frostveil_tundra'],
  desc: 'A tortoise whose shell is a slab of glacier ice. It has never once hurried.',
  palette: { primary: '#9fd0ea', secondary: '#5f92b8', belly: '#e6f6ff', accent: '#ffffff', eye: '#cfeeff', dark: '#2a4f6a' } ,
  extraSkills: { 60: ['glacial_age'] }});
line({ id: 'flurrywing', names: ['Flurrywing', 'Sleetwing', 'Blizzardwing', 'Aurorawing'], breed: 'Bird', body: 'avian', role: 'fast', element: 'ice', ultimate: 'winter_crown', mood: 'swift', spawnMaps: ['frostveil_tundra'],
  desc: 'A snow-bunting that leaves frost on the wind. Its wings chime like icicles.',
  palette: { primary: '#f2f8ff', secondary: '#b6cfe6', belly: '#ffffff', accent: '#8fe0ff', eye: '#5fc0ff', dark: '#405a72' } ,
  extraSkills: { 40: ['frost_hush'] }});
line({ id: 'frostling', names: ['Frostling', 'Frostwyrm', 'Glacidrake', 'Absolutus'], breed: 'Dragon', body: 'dragon', role: 'balanced', element: 'ice', ultimate: 'glacier_fall', mood: 'stubborn', spawnMaps: ['frostveil_tundra'],
  desc: 'A drake hatched in a glacier. Its flame is cold enough to shatter stone.',
  palette: { primary: '#7fb8e6', secondary: '#3f6f9e', belly: '#e8f4ff', accent: '#c8f4ff', eye: '#eaffff', dark: '#1e3a55' } ,
  extraSkills: { 60: ['glacial_age'] }});
// ---- METAL — Ironhold Foundry -------------------------------------------------
line({ id: 'ironbug', names: ['Ironbug', 'Steelbeetle', 'Titanbeetle', 'Adamantrex'], breed: 'Beetle', body: 'beetle', role: 'tank', element: 'metal', ultimate: 'adamant_shell', mood: 'guarded', spawnMaps: ['ironhold_foundry'],
  desc: 'A beetle plated in scrap iron. Smiths use its shed shells for shields.',
  palette: { primary: '#8e97a6', secondary: '#4f5866', belly: '#d5dbe4', accent: '#ffb347', eye: '#ffd8a0', dark: '#23282f' } });
line({ id: 'scrapling', names: ['Scrapling', 'Scrapgolem', 'Ironclad', 'Titanforge'], breed: 'Golem', body: 'golem', role: 'physical', element: 'metal', ultimate: 'iron_judgment', mood: 'sturdy', spawnMaps: ['ironhold_foundry'],
  desc: 'A golem assembled from foundry scrap. Every fight adds a new plate.',
  palette: { primary: '#a8adb8', secondary: '#5c6270', belly: '#e0e4ea', accent: '#ff8a3c', eye: '#ffc890', dark: '#2a2e36' } ,
  extraSkills: { 40: ['rust_grip'] }});
line({ id: 'ironhog', names: ['Ironhog', 'Steeltusk', 'Alloyboar', 'Titanboar'], breed: 'Boar', body: 'boar', role: 'physical', element: 'metal', ultimate: 'iron_judgment', mood: 'brave', spawnMaps: ['ironhold_foundry'],
  desc: 'A boar with tusks of tempered steel. It sharpens them on anvils.',
  palette: { primary: '#7d8794', secondary: '#454c58', belly: '#cfd6df', accent: '#e6eef7', eye: '#ffe0a0', dark: '#1f242b' } });
line({ id: 'chromeling', names: ['Chromeling', 'Chromegecko', 'Steelwyrm', 'Platinodon'], breed: 'Lizard', body: 'lizard', role: 'special', element: 'metal', ultimate: 'magnetic_storm', mood: 'clever', spawnMaps: ['ironhold_foundry'],
  desc: 'A mirror-scaled lizard that reflects heat and insults alike.',
  palette: { primary: '#c9d3de', secondary: '#7b8794', belly: '#f2f5f9', accent: '#6fd0ff', eye: '#a8ecff', dark: '#343c46' } ,
  extraSkills: { 40: ['rust_grip'] }});
line({ id: 'cogfox', names: ['Cogfox', 'Gearfox', 'Clockfox', 'Chronofox'], breed: 'Fox', body: 'fox', role: 'fast', element: 'metal', ultimate: 'magnetic_storm', mood: 'keen', spawnMaps: ['ironhold_foundry'],
  desc: 'A fox with gears for markings that tick faster when it is excited.',
  palette: { primary: '#b8a27a', secondary: '#7a6746', belly: '#efe6d2', accent: '#8fd0ff', eye: '#c8f0ff', dark: '#3a2f1e' } ,
  extraSkills: { 40: ['rust_grip'] }});
// ---- POISON — Miremarsh Fen ---------------------------------------------------
line({ id: 'venoviper', names: ['Venoviper', 'Toxiviper', 'Plagueviper', 'Basiliskos'], breed: 'Serpent', body: 'serpent', role: 'special', element: 'poison', ultimate: 'plague_crown', mood: 'clever', spawnMaps: ['miremarsh_fen'],
  desc: 'A hooded marsh viper. Its hood spreads wider with every stage — and so does its venom.',
  palette: { primary: '#7e4fb8', secondary: '#4a2a78', belly: '#d9f5a8', accent: '#9cff5a', eye: '#d8ff8a', dark: '#26123f' } ,
  extraSkills: { 60: ['miasma_bloom'] }});
line({ id: 'mirenewt', names: ['Mirenewt', 'Bognewt', 'Toxalamander', 'Plaguedon'], breed: 'Lizard', body: 'lizard', role: 'balanced', element: 'poison', ultimate: 'plague_crown', mood: 'hardy', spawnMaps: ['miremarsh_fen'],
  desc: 'A newt that is very hard to swallow — for very good reasons.',
  palette: { primary: '#6fa04a', secondary: '#3e6a2c', belly: '#e8f0a0', accent: '#c05cff', eye: '#f0c8ff', dark: '#1f3a18' } });
line({ id: 'stingbug', names: ['Stingbug', 'Venomscarab', 'Plaguebeetle', 'Toxitan'], breed: 'Beetle', body: 'beetle', role: 'physical', element: 'poison', ultimate: 'venom_tyrant', mood: 'aggressive', spawnMaps: ['miremarsh_fen'],
  desc: 'A scarab with a sting that drips. Nothing eats it twice.',
  palette: { primary: '#5a3a7a', secondary: '#31204a', belly: '#b8f07a', accent: '#a6ff4a', eye: '#e8ffb0', dark: '#180e28' } });
line({ id: 'venobat', names: ['Venobat', 'Gloomwing', 'Nightvenom', 'Dreadwing'], breed: 'Bat', body: 'bat', role: 'fast', element: 'poison', ultimate: 'venom_tyrant', mood: 'playful', spawnMaps: ['miremarsh_fen'],
  desc: 'A fen bat that hunts by the smell of fear. Its bite numbs before it burns.',
  palette: { primary: '#5c4a86', secondary: '#33294f', belly: '#c2b3e0', accent: '#8dff6a', eye: '#ccff9a', dark: '#1a1230' } ,
  extraSkills: { 40: ['venom_lullaby'] }});
line({ id: 'boghound', names: ['Boghound', 'Mirewolf', 'Plaguefang', 'Blightwolf'], breed: 'Hound', body: 'wolf', role: 'physical', element: 'poison', ultimate: 'miasma_hex', mood: 'fierce', spawnMaps: ['miremarsh_fen'],
  desc: 'A hound that drinks from the sludge and thrives on it.',
  palette: { primary: '#4f6a4a', secondary: '#2e4230', belly: '#c9dcb0', accent: '#b26fff', eye: '#e2c8ff', dark: '#15211a' } });
// ---- PSYCHIC — Astral Spire ---------------------------------------------------
line({ id: 'psykit', names: ['Psykit', 'Mindcat', 'Astralynx', 'Oraclynx'], breed: 'Feline', body: 'feline', role: 'special', element: 'psychic', ultimate: 'astral_crown', mood: 'clever', spawnMaps: ['astral_spire'],
  desc: 'A cat that answers questions you have not asked yet.',
  palette: { primary: '#e88ab8', secondary: '#a8508a', belly: '#ffe6f2', accent: '#8fd8ff', eye: '#c8f4ff', dark: '#4a1e3a' } ,
  extraSkills: { 40: ['hypno_gaze'] }});
line({ id: 'dreamwisp', names: ['Dreamwisp', 'Mindwisp', 'Astralwisp', 'Nebulon'], breed: 'Wisp', body: 'wisp', role: 'special', element: 'psychic', ultimate: 'astral_ward', mood: 'mystic', spawnMaps: ['astral_spire'],
  desc: 'A drifting light that feeds on dreams and leaves better ones behind.',
  palette: { primary: '#b58cff', secondary: '#6f4fc0', belly: '#f0e6ff', accent: '#ffd1f0', eye: '#ffffff', dark: '#2a1a50' } ,
  extraSkills: { 40: ['hypno_gaze'] }});
line({ id: 'mystfox', names: ['Mystfox', 'Auraphox', 'Seerfox', 'Kitsunova'], breed: 'Fox', body: 'fox', role: 'fast', element: 'psychic', ultimate: 'mind_shatter', mood: 'focused', spawnMaps: ['astral_spire'],
  desc: 'A fox that is always one step ahead, because it saw the step coming.',
  palette: { primary: '#f0a6d8', secondary: '#b064a0', belly: '#fff0f8', accent: '#9ff0ff', eye: '#dcfbff', dark: '#4e2646' } ,
  extraSkills: { 40: ['mirror_trap'] }});
line({ id: 'omenwing', names: ['Omenwing', 'Seerwing', 'Astralwing', 'Cosmowl'], breed: 'Owl', body: 'avian', role: 'balanced', element: 'psychic', ultimate: 'astral_crown', mood: 'vigilant', spawnMaps: ['astral_spire'],
  desc: 'An owl whose eyes show tomorrow. It rarely blinks.',
  palette: { primary: '#8a7ac8', secondary: '#524490', belly: '#ece6ff', accent: '#ff9ad2', eye: '#ffe0f0', dark: '#221a48' } ,
  extraSkills: { 40: ['mirror_trap'] }});
line({ id: 'mindram', names: ['Mindram', 'Psyram', 'Astralram', 'Oraclorn'], breed: 'Ram', body: 'ram', role: 'tank', element: 'psychic', ultimate: 'mind_shatter', mood: 'guarded', spawnMaps: ['astral_spire'],
  desc: 'A ram with horns of solid thought. Walls are a suggestion.',
  palette: { primary: '#d8c8f0', secondary: '#9282c0', belly: '#f8f4ff', accent: '#ff7fc8', eye: '#ffc8e8', dark: '#3e3060' } ,
  extraSkills: { 40: ['hypno_gaze'] }});
// ---- DUAL-TYPED lines: both elements' attacks, home map first, also found on the other ----
line({ id: 'mirewisp', names: ['Mirewisp', 'Hexwisp', 'Miasmind', 'Phantasmire'], breed: 'Wisp', body: 'wisp', role: 'special', elements: ['poison', 'psychic'], ultimate: 'miasma_hex', mood: 'mystic', rarity: 'B', catchRate: 0.4, expYield: 88, spawnMaps: ['miremarsh_fen', 'astral_spire'],
  desc: 'A marsh-light that whispers. Poison and Psychic at once: it withers the body and clouds the mind.',
  palette: { primary: '#8c6fd0', secondary: '#4f3a90', belly: '#e0ffb8', accent: '#a8ff5a', eye: '#f4ffd8', dark: '#22163e' } ,
  extraSkills: { 40: ['venom_lullaby'] }});
line({ id: 'sparkbug', names: ['Sparkbug', 'Voltsteel', 'Dynabeetle', 'Ferrovolt'], breed: 'Beetle', body: 'beetle', role: 'physical', elements: ['electric', 'metal'], ultimate: 'gigavolt_charge', mood: 'aggressive', rarity: 'B', catchRate: 0.4, expYield: 88, spawnMaps: ['ironhold_foundry', 'stormreach_plateau'],
  desc: 'A steel beetle that stores the storm in its plating. Electric and Metal at once: it conducts as hard as it hits.',
  palette: { primary: '#98a2b4', secondary: '#525c6e', belly: '#e2e8f0', accent: '#ffe23a', eye: '#fff5b0', dark: '#20262f' } });
// ---- FIGHTING — Ironfist Colosseum (Region 10) -------------------------------
// One pure Fighting line and four dual-typed ones, as the roster's melee school.
line({ id: 'cubrawl', names: ['Cubrawl', 'Pawnch', 'Bruiseursa', 'Grandfist'], breed: 'Cub', body: 'boar', role: 'physical', element: 'fighting', ultimate: 'titan_gauntlet', mood: 'brave', rarity: 'C', catchRate: 0.46, expYield: 96, spawnMaps: ['ironfist_colosseum'],
  desc: 'A stubborn cub that shadow-boxes at its own reflection. Pure Fighting: no tricks, no element to hide behind, just technique and a very hard right.',
  palette: { primary: '#c8632f', secondary: '#8e3f1c', belly: '#ffe0b8', accent: '#ffb06a', eye: '#fff0c8', dark: '#4a1e0c' } });
line({ id: 'ironpaw', names: ['Ironpaw', 'Steelbrawl', 'Anvilarm', 'Titanfist'], breed: 'Golem', body: 'golem', role: 'tank', elements: ['fighting', 'metal'], ultimate: 'unbroken_stance', mood: 'sturdy', rarity: 'B', catchRate: 0.36, expYield: 104, spawnMaps: ['ironfist_colosseum', 'ironhold_foundry'],
  desc: 'A sparring dummy that woke up and never stopped training. Fighting and Metal at once: it hits like a hammer and takes a hit like an anvil.',
  palette: { primary: '#8d9099', secondary: '#5b5e66', belly: '#d9dde4', accent: '#ff8a4a', eye: '#ffd8a8', dark: '#23262c' } });
line({ id: 'emberfist', names: ['Emberfist', 'Blazeknuckle', 'Pyrobrawler', 'Infernochamp'], breed: 'Kickboxer', body: 'lizard', role: 'fast', elements: ['fighting', 'fire'], ultimate: 'champion_roar', mood: 'fierce', rarity: 'B', catchRate: 0.36, expYield: 104, spawnMaps: ['ironfist_colosseum', 'emberwild'],
  extraSkills: { 1: ['flame_rawr'], 20: ['burning_fang', 'ember_jab'], 60: ['inferno_roar', 'ember_leech'], 80: ['dragon_inferno', 'magma_slam'] },
  desc: 'Its wraps smoulder from friction alone. Fighting and Fire at once: every combo ends with something on fire, usually the arena floor.',
  palette: { primary: '#e8622f', secondary: '#a3331a', belly: '#ffd9a0', accent: '#ffc247', eye: '#fff3c0', dark: '#4f1408' } });
line({ id: 'stormkick', names: ['Stormkick', 'Voltstrike', 'Thunderkata', 'Galechampion'], breed: 'Crane', body: 'avian', role: 'fast', elements: ['fighting', 'electric'], ultimate: 'titan_gauntlet', mood: 'swift', rarity: 'B', catchRate: 0.36, expYield: 104, spawnMaps: ['ironfist_colosseum', 'stormreach_plateau'],
  desc: 'It balances on one talon for hours, then moves faster than the eye. Fighting and Electric at once: the kick lands before the thunder does.',
  palette: { primary: '#e8e2cf', secondary: '#b0a88c', belly: '#fffaf0', accent: '#ffd83a', eye: '#4fd8ff', dark: '#3f3a2c' } });
line({ id: 'zenram', names: ['Zenram', 'Kataram', 'Sageguard', 'Grandmaster'], breed: 'Monk Ram', body: 'ram', role: 'balanced', elements: ['fighting', 'psychic'], ultimate: 'unbroken_stance', mood: 'focused', rarity: 'A', catchRate: 0.3, expYield: 112, spawnMaps: ['ironfist_colosseum', 'astral_spire'],
  desc: 'A horned monk that meditates between rounds. Fighting and Psychic at once: it reads the strike coming and answers it before you commit.',
  palette: { primary: '#d8cbb0', secondary: '#9f8f72', belly: '#fff6e0', accent: '#ff8ac0', eye: '#ffd6ec', dark: '#453a2a' } });

// ---- LEGENDARIES: one form, 2-3 elements, rare spawns, Absolute Ball or better only ----
legend({ id: 'aetherion', name: 'Aetherion', breed: 'Celestial Elk', body: 'ram', role: 'special', elements: ['psychic', 'electric', 'ice'], ultimate: 'aurora_cataclysm', mood: 'mystic', spawnMaps: ['astral_spire', 'stormreach_plateau', 'frostveil_tundra'],
  tweak: { spd: 4, satk: 4 },
  desc: 'LEGENDARY. An elk of aurora light seen once a generation on the Spire. Psychic, Electric and Ice — the northern lights given antlers.',
  palette: { primary: '#d8e8ff', secondary: '#8ab0e0', belly: '#ffffff', accent: '#7fffd4', eye: '#c8fff0', dark: '#2c4a70' } });
legend({ id: 'venomyr', name: 'Venomyr', breed: 'Corroded Wyrm', body: 'serpent', role: 'physical', elements: ['poison', 'metal'], ultimate: 'plague_engine', mood: 'brutal', spawnMaps: ['miremarsh_fen', 'ironhold_foundry'],
  tweak: { hp: 10, pdef: 3 },
  desc: 'LEGENDARY. A serpent of rusted iron and living venom that sleeps under the fen. Poison and Metal — it corrodes whatever it cannot bite through.',
  palette: { primary: '#5a7a58', secondary: '#33463a', belly: '#c8d8a8', accent: '#b0ff4a', eye: '#e8ff9a', dark: '#141f16' } ,
  extraSkills: { 60: ['miasma_bloom'] }});
legend({ id: 'basaltyr', name: 'Basaltyr', breed: 'Molten Colossus', body: 'golem', role: 'tank', elements: ['rock', 'fire', 'metal'], ultimate: 'core_meltdown', mood: 'sturdy', spawnMaps: ['ironhold_foundry', 'emberwild', 'stonehollow_crags'],
  tweak: { patk: 4, satk: 6 },
  legacySkills: { rock: [[1, 'stone_shard'], [20, 'crag_lance'], [20, 'rock_jab'], [60, 'quartz_storm'], [80, 'core_beam'], [80, 'tectonic_slam']], fire: [[1, 'flame_rawr'], [20, 'burning_fang'], [20, 'ember_jab'], [60, 'inferno_roar'], [80, 'dragon_inferno'], [80, 'magma_slam']] },
  desc: 'LEGENDARY. A colossus of cooled basalt with a molten iron heart, said to be the mountain\'s own forge. Rock, Fire and Metal.',
  palette: { primary: '#4a4048', secondary: '#2a2428', belly: '#8a7f86', accent: '#ff7a2a', eye: '#ffc46a', dark: '#120e12' } });

export const SPECIES_IDS = Object.keys(SPECIES);
/** Legendary species ids (rare spawns, one form, 2-3 elements). */
export const LEGENDARY_IDS = SPECIES_IDS.filter((id) => SPECIES[id].legendary);
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
/**
 * The three tactical skills every Mythling learns, whatever its species or role.
 * They are support (no damage), so they are added centrally here rather than
 * copied into every one of the 55 species tables: Guard Stance at Lv.20, Ward at
 * Lv.12, Purge at Lv.40. Exactly three, with no elite variants.
 * This way a species added later gets them for free.
 */
export const TACTICAL_UNLOCKS = {
  12: ['ward'],
  20: ['guard_stance'],
  40: ['purge'],
};

/**
 * BURN and POISON: the two damage-over-time ladders. A Mythling learns the one
 * that matches its own element — Fire scorches, Poison festers — at the same
 * levels, so the two read identically in shape and differ only in name, colour
 * and which stat they pair with. A dual Fire/Poison line learns both.
 * Applied centrally, like TACTICAL_UNLOCKS, so a species added later gets them.
 */
const BURN_UNLOCKS = { 12: ['kindling'], 40: ['wildfire'], 80: ['immolation'] };
const POISON_UNLOCKS = { 12: ['toxic_bite'], 20: ['venom_bloom'], 40: ['creeping_toxin'], 60: ['plague_bloom'], 80: ['septic_rot'] };

/** The shared tactical set plus whichever DoT ladder this species earns. */
function sharedUnlocksFor(sp, level) {
  const els = Array.isArray(sp.elements) && sp.elements.length ? sp.elements : [sp.element];
  const out = [];
  for (const key of Object.keys(TACTICAL_UNLOCKS)) {
    if (level >= Number(key)) out.push(...TACTICAL_UNLOCKS[key]);
  }
  if (els.includes('fire')) {
    for (const key of Object.keys(BURN_UNLOCKS)) if (level >= Number(key)) out.push(...BURN_UNLOCKS[key]);
  }
  if (els.includes('poison')) {
    for (const key of Object.keys(POISON_UNLOCKS)) if (level >= Number(key)) out.push(...POISON_UNLOCKS[key]);
  }
  return out;
}

export function skillsUnlockedAt(speciesId, level) {
  const sp = getSpecies(speciesId);
  if (!sp) return [];
  const out = sharedUnlocksFor(sp, level);
  for (const key of Object.keys(sp.skillUnlocks)) {
    if (level >= Number(key)) out.push(...sp.skillUnlocks[key]);
  }
  return [...new Set(out)];
}

/** The level a species learns `skillId` at (lowest table entry), or null if it never does. */
export function skillLearnLevel(speciesId, skillId) {
  const sp = getSpecies(speciesId);
  if (!sp) return null;
  let best = null;
  // the shared skills first: the tactical trio, plus this species' DoT ladder
  for (const key of Object.keys(TACTICAL_UNLOCKS)) {
    if (!TACTICAL_UNLOCKS[key].includes(skillId)) continue;
    const lv = Number(key);
    if (best == null || lv < best) best = lv;
  }
  const els = Array.isArray(sp.elements) && sp.elements.length ? sp.elements : [sp.element];
  for (const table of [els.includes('fire') ? BURN_UNLOCKS : null, els.includes('poison') ? POISON_UNLOCKS : null]) {
    if (!table) continue;
    for (const key of Object.keys(table)) {
      if (!table[key].includes(skillId)) continue;
      const lv = Number(key);
      if (best == null || lv < best) best = lv;
    }
  }
  for (const key of Object.keys(sp.skillUnlocks)) {
    if (!sp.skillUnlocks[key].includes(skillId)) continue;
    const lv = Number(key);
    if (best == null || lv < best) best = lv;
  }
  return best;
}
