// DESIGN RULE: a regular Buff skill raises exactly ONE stat and a regular Debuff
// skill lowers exactly ONE enemy stat. `effects` is an array, and the ELITE
// support skills (Lv.60 / Lv.80, few uses) and the support Ultimates use two
// entries. An effect may carry `target: 'self' | 'foe'`: on the foe it is always
// a debuff, on self always a buff — see buffSummary() in ui code.
//
// Extra skill riders the battle engine understands:
//   drain: 0.5      heal 50% of the damage this hit dealt (crits heal more)
//   healPct: 0.2    heal 20% of max HP after a successful hit (fixed heal)
//   reflect: 2      deal 2x the damage the LAST enemy attack did to you (no
//                   damage taken this round -> the skill fizzles)
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

  // ---------- ROCK pool (Stonehollow Crags) ----------
  pebble_toss:     { id: 'pebble_toss',     name: 'Pebble Toss',     category: 'normal', damageType: 'physical', element: null,   power: 10, uses: Infinity, desc: 'A flick of loose gravel. Unlimited uses.' },
  rock_jab:        { id: 'rock_jab',        name: 'Rock Jab',        category: 'normal', damageType: 'physical', element: 'rock', power: 18, uses: Infinity, desc: 'A stone-hard headbutt. Unlimited uses.' },
  boulder_smash:   { id: 'boulder_smash',   name: 'Boulder Smash',   category: 'normal', damageType: 'physical', element: 'rock', power: 31, uses: Infinity, desc: 'Brings a boulder down on the foe. Unlimited uses.' },
  tectonic_slam:   { id: 'tectonic_slam',   name: 'Tectonic Slam',   category: 'normal', damageType: 'physical', element: 'rock', power: 42, uses: Infinity, desc: 'The ground itself lurches. Unlimited uses.' },
  stone_shard:     { id: 'stone_shard',     name: 'Stone Shard',     category: 'special', damageType: 'physical', element: 'rock', power: 17, uses: 20, desc: 'Hurls a jagged shard of flint.' },
  crag_lance:      { id: 'crag_lance',      name: 'Crag Lance',      category: 'special', damageType: 'physical', element: 'rock', power: 28, uses: 18, desc: 'A spear of stone erupts from the ground.' },
  crystal_ray:     { id: 'crystal_ray',     name: 'Crystal Ray',     category: 'special', damageType: 'special',  element: 'rock', power: 27, uses: 18, desc: 'Light focused through a living crystal.' },
  meteor_fist:     { id: 'meteor_fist',     name: 'Meteor Fist',     category: 'special', damageType: 'physical', element: 'rock', power: 42, uses: 15, desc: 'A punch that lands like a falling star.', future: true },
  quartz_storm:    { id: 'quartz_storm',    name: 'Quartz Storm',    category: 'special', damageType: 'special',  element: 'rock', power: 40, uses: 15, desc: 'A blizzard of razor crystal.', future: true },
  titan_quake:     { id: 'titan_quake',     name: 'Titan Quake',     category: 'special', damageType: 'physical', element: 'rock', power: 56, uses: 12, desc: 'The mountain answers. Everything shakes.', future: true },
  core_beam:       { id: 'core_beam',       name: 'Core Beam',       category: 'special', damageType: 'special',  element: 'rock', power: 54, uses: 12, desc: 'A beam of pressure from the planet\'s heart.', future: true },
  stone_skin:      { id: 'stone_skin',      name: 'Stone Skin',      category: 'buff', effects: [{ stat: 'pdef', amount: 4 }], uses: 10, desc: 'Raises Physical Defense.' },
  granite_might:   { id: 'granite_might',   name: 'Granite Might',   category: 'buff', effects: [{ stat: 'patk', amount: 4 }], uses: 10, desc: 'Raises Physical Attack.' },
  quartz_focus:    { id: 'quartz_focus',    name: 'Quartz Focus',    category: 'buff', effects: [{ stat: 'satk', amount: 4 }], uses: 10, desc: 'Raises Special Attack.' },
  bedrock_will:    { id: 'bedrock_will',    name: 'Bedrock Will',    category: 'buff', effects: [{ stat: 'sdef', amount: 4 }], uses: 10, desc: 'Raises Special Defense.' },
  landslide_pace:  { id: 'landslide_pace',  name: 'Landslide Pace',  category: 'buff', effects: [{ stat: 'spd', amount: 5 }], uses: 8, desc: 'Raises Speed.', future: true },
  mountain_heart:  { id: 'mountain_heart',  name: 'Mountain Heart',  category: 'buff', effects: [{ stat: 'hp', amount: 9 }], uses: 10, desc: 'Raises max HP.' },
  obsidian_edge:   { id: 'obsidian_edge',   name: 'Obsidian Edge',   category: 'buff', effects: [{ stat: 'patk', amount: 6 }], uses: 8, desc: 'Raises Physical Attack sharply.', future: true },
  geode_mind:      { id: 'geode_mind',      name: 'Geode Mind',      category: 'buff', effects: [{ stat: 'satk', amount: 6 }], uses: 8, desc: 'Raises Special Attack sharply.', future: true },
  // -- rock debuffs (same ladder as the other elements) --
  grit_blind:      { id: 'grit_blind',      name: 'Grit Blind',      category: 'debuff', effects: [{ stat: 'satk', amount: 4 }], uses: 12, desc: 'Grit in the eyes. Lowers the foe\'s Special Attack.' },
  petrify:         { id: 'petrify',         name: 'Petrify',         category: 'debuff', effects: [{ stat: 'patk', amount: 4 }], uses: 12, desc: 'Stiffens the foe\'s limbs. Lowers its Physical Attack.' },
  sandstorm:       { id: 'sandstorm',       name: 'Sandstorm',       category: 'debuff', effects: [{ stat: 'spd',  amount: 4 }], uses: 12, desc: 'A wall of blowing sand. Lowers the foe\'s Speed.' },
  crush_armor:     { id: 'crush_armor',     name: 'Crush Armor',     category: 'debuff', effects: [{ stat: 'pdef', amount: 5 }], uses: 10, desc: 'Cracks the foe\'s plating. Lowers its Physical Defense.' },
  quake_shock:     { id: 'quake_shock',     name: 'Quake Shock',     category: 'debuff', effects: [{ stat: 'sdef', amount: 5 }], uses: 10, desc: 'A tremor that rattles focus. Lowers the foe\'s Special Defense.' },
  fault_line:      { id: 'fault_line',      name: 'Fault Line',      category: 'debuff', effects: [{ stat: 'pdef', amount: 7 }], uses: 8,  desc: 'Splits the ground under the foe. Lowers its Physical Defense sharply.' },
  stone_curse:     { id: 'stone_curse',     name: 'Stone Curse',     category: 'debuff', effects: [{ stat: 'sdef', amount: 7 }], uses: 8,  desc: 'An ancient curse of the crags. Lowers the foe\'s Special Defense sharply.' },

  // ---------- LIFE STEAL: attack and heal in the same move ----------
  // "drain" heals a share of the damage dealt (a crit heals more), "healPct" is a
  // fixed heal that lands after any successful hit.
  sap_bite:        { id: 'sap_bite',        name: 'Sap Bite',        category: 'special', damageType: 'physical', element: 'nature', power: 22, uses: 12, drain: 0.5, desc: 'Bites deep and drinks the sap. Heals 50% of the damage dealt.' },
  siphon_tide:     { id: 'siphon_tide',     name: 'Siphon Tide',     category: 'special', damageType: 'special',  element: 'water',  power: 22, uses: 12, drain: 0.5, desc: 'Pulls the foe\'s strength out with the tide. Heals 50% of the damage dealt.' },
  ember_leech:     { id: 'ember_leech',     name: 'Ember Leech',     category: 'special', damageType: 'special',  element: 'fire',   power: 22, uses: 12, drain: 0.5, desc: 'Steals the foe\'s warmth. Heals 50% of the damage dealt.' },
  crystal_leech:   { id: 'crystal_leech',   name: 'Crystal Leech',   category: 'special', damageType: 'special',  element: 'rock',   power: 22, uses: 12, drain: 0.5, desc: 'Crystals drink the foe\'s vigour. Heals 50% of the damage dealt.' },
  vampiric_maw:    { id: 'vampiric_maw',    name: 'Vampiric Maw',    category: 'special', damageType: 'physical', element: null,     power: 34, uses: 8,  drain: 0.75, desc: 'A ravenous bite. Heals 75% of the damage dealt — a crit heals a fortune.', future: true },
  mending_strike:  { id: 'mending_strike',  name: 'Mending Strike',  category: 'special', damageType: 'physical', element: null,     power: 18, uses: 10, healPct: 0.2, desc: 'A measured strike that steadies the body. Heals 20% of max HP after it lands.' },
  restoring_pulse: { id: 'restoring_pulse', name: 'Restoring Pulse', category: 'special', damageType: 'special',  element: null,     power: 26, uses: 8,  healPct: 0.3, desc: 'A pulse that hurts the foe and knits your wounds. Heals 30% of max HP after it lands.', future: true },

  // ---------- REFLECT: pay the last hit back double ----------
  retaliate:       { id: 'retaliate',       name: 'Retaliate',       category: 'special', damageType: 'physical', element: null, power: 0, uses: 6, reflect: 2, desc: 'Returns the LAST hit you took at double strength. You still take the hit first — and if the foe only buffed, there is nothing to return.' },
  vengeance:       { id: 'vengeance',       name: 'Vengeance',       category: 'special', damageType: 'physical', element: null, power: 0, uses: 4, reflect: 3, desc: 'Returns the LAST hit you took at triple strength. Risky: a buffing foe leaves you nothing to return.', future: true },

  // ---------- ELITE support skills: two effects, few uses ----------
  // Foe-side entries are always debuffs, self-side entries always buffs.
  war_cry:         { id: 'war_cry',         name: 'War Cry',         category: 'buff',   effects: [{ stat: 'patk', amount: 8 }, { stat: 'spd', amount: 6 }], uses: 4, desc: 'A roar that quickens the blood. Raises Physical Attack AND Speed.', future: true },
  arcane_surge:    { id: 'arcane_surge',    name: 'Arcane Surge',    category: 'buff',   effects: [{ stat: 'satk', amount: 8 }, { stat: 'sdef', amount: 6 }], uses: 4, desc: 'Power floods every sense. Raises Special Attack AND Special Defense.', future: true },
  bulwark:         { id: 'bulwark',         name: 'Bulwark',         category: 'buff',   effects: [{ stat: 'pdef', amount: 8 }, { stat: 'sdef', amount: 8 }], uses: 4, desc: 'Becomes a living wall. Raises both Defenses.', future: true },
  intimidate:      { id: 'intimidate',      name: 'Intimidate',      category: 'debuff', effects: [{ stat: 'patk', amount: 7 }, { stat: 'satk', amount: 7 }], uses: 4, desc: 'A stare that drains the will to fight. Lowers the foe\'s Physical AND Special Attack.', future: true },
  shatter:         { id: 'shatter',         name: 'Shatter',         category: 'debuff', effects: [{ stat: 'pdef', amount: 8 }, { stat: 'sdef', amount: 8 }], uses: 4, desc: 'Breaks every guard at once. Lowers both of the foe\'s Defenses.', future: true },
  predator_focus:  { id: 'predator_focus',  name: 'Predator Focus',  category: 'buff',   effects: [{ stat: 'patk', amount: 7 }, { stat: 'pdef', amount: 6, target: 'foe' }], uses: 4, desc: 'Locks onto the prey. Raises your Physical Attack and lowers the foe\'s Physical Defense.', future: true },
  mind_break:      { id: 'mind_break',      name: 'Mind Break',      category: 'debuff', effects: [{ stat: 'sdef', amount: 7 }, { stat: 'satk', amount: 6, target: 'self' }], uses: 4, desc: 'Cracks the foe\'s focus and feeds on it. Lowers the foe\'s Special Defense and raises your Special Attack.', future: true },

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
  // ---------- ROCK ----------
  stone_avalanche: {
    id: 'stone_avalanche', baseName: 'Stone Avalanche', element: 'rock', damageType: 'physical',
    tiers: [
      { suffix: '',    power: 35, unlockLevel: 10 },
      { suffix: ' I',  power: 51, unlockLevel: 20 },
      { suffix: ' II', power: 75, unlockLevel: 60, future: true },
      { suffix: ' III',power: 105, unlockLevel: 80, future: true },
    ],
    desc: 'Half a mountainside comes down on the foe.',
  },
  crystal_cannon: {
    id: 'crystal_cannon', baseName: 'Crystal Cannon', element: 'rock', damageType: 'special',
    tiers: [
      { suffix: '',    power: 34, unlockLevel: 10 },
      { suffix: ' I',  power: 50, unlockLevel: 20 },
      { suffix: ' II', power: 74, unlockLevel: 60, future: true },
      { suffix: ' III',power: 104, unlockLevel: 80, future: true },
    ],
    desc: 'Every crystal on its body fires at once.',
  },
  // ---------- SUPPORT ULTIMATES (kind: 'support') ----------
  // No damage: two effects that grow with the tier. Foe-side effects are ALWAYS
  // debuffs, self-side effects ALWAYS buffs — an Ultimate-grade buff or debuff.
  granite_bastion: {
    id: 'granite_bastion', baseName: 'Granite Bastion', element: 'rock', damageType: null, kind: 'support',
    tiers: [
      { suffix: '',    unlockLevel: 10, effects: [{ stat: 'pdef', amount: 8,  target: 'self' }, { stat: 'sdef', amount: 8,  target: 'self' }] },
      { suffix: ' I',  unlockLevel: 20, effects: [{ stat: 'pdef', amount: 11, target: 'self' }, { stat: 'sdef', amount: 11, target: 'self' }] },
      { suffix: ' II', unlockLevel: 60, effects: [{ stat: 'pdef', amount: 15, target: 'self' }, { stat: 'sdef', amount: 15, target: 'self' }], future: true },
      { suffix: ' III',unlockLevel: 80, effects: [{ stat: 'pdef', amount: 20, target: 'self' }, { stat: 'sdef', amount: 20, target: 'self' }], future: true },
    ],
    desc: 'Buff Ultimate: the Mythling turns to living granite. Raises BOTH of its Defenses by far more than any buff skill.',
  },
  quake_curse: {
    id: 'quake_curse', baseName: 'Quake Curse', element: 'rock', damageType: null, kind: 'support',
    tiers: [
      { suffix: '',    unlockLevel: 10, effects: [{ stat: 'pdef', amount: 8,  target: 'foe' }, { stat: 'spd', amount: 6,  target: 'foe' }] },
      { suffix: ' I',  unlockLevel: 20, effects: [{ stat: 'pdef', amount: 11, target: 'foe' }, { stat: 'spd', amount: 8,  target: 'foe' }] },
      { suffix: ' II', unlockLevel: 60, effects: [{ stat: 'pdef', amount: 15, target: 'foe' }, { stat: 'spd', amount: 11, target: 'foe' }], future: true },
      { suffix: ' III',unlockLevel: 80, effects: [{ stat: 'pdef', amount: 20, target: 'foe' }, { stat: 'spd', amount: 14, target: 'foe' }], future: true },
    ],
    desc: 'Debuff Ultimate: the ground swallows the foe\'s footing. Lowers the foe\'s Physical Defense AND Speed.',
  },
  crystal_resonance: {
    id: 'crystal_resonance', baseName: 'Crystal Resonance', element: 'rock', damageType: null, kind: 'support',
    tiers: [
      { suffix: '',    unlockLevel: 10, effects: [{ stat: 'satk', amount: 8,  target: 'self' }, { stat: 'sdef', amount: 6,  target: 'foe' }] },
      { suffix: ' I',  unlockLevel: 20, effects: [{ stat: 'satk', amount: 11, target: 'self' }, { stat: 'sdef', amount: 8,  target: 'foe' }] },
      { suffix: ' II', unlockLevel: 60, effects: [{ stat: 'satk', amount: 15, target: 'self' }, { stat: 'sdef', amount: 11, target: 'foe' }], future: true },
      { suffix: ' III',unlockLevel: 80, effects: [{ stat: 'satk', amount: 20, target: 'self' }, { stat: 'sdef', amount: 14, target: 'foe' }], future: true },
    ],
    desc: 'Buff + Debuff Ultimate: a resonance that empowers the caster and shatters the foe. Raises your Special Attack and lowers the foe\'s Special Defense.',
  },

};

export const ULTIMATE_MAX_CHARGE = 8;
export const MAX_BUFF_STACKS = 30;

/** Battle-button / library labels for every skill category. */
export const SKILL_CATEGORY_LABEL = { normal: 'Normal', special: 'Special', buff: 'Buff', debuff: 'Debuff', ultimate: 'Ultimate' };

/** Sort order of the categories in the Skill Library and the wiki. */
export const SKILL_CATEGORY_ORDER = ['normal', 'special', 'buff', 'debuff', 'ultimate'];

/** True when a skill deals damage (Normal / Special / damage Ultimate). */
export function isDamageSkill(sk) {
  return !!sk && sk.category !== 'buff' && sk.category !== 'debuff' && sk.kind !== 'support';
}

/** Which side an effect lands on: explicit `target`, else the skill's own category. */
export function effectTarget(sk, eff) {
  if (eff.target) return eff.target;
  return sk.category === 'debuff' ? 'foe' : 'self';
}

/**
 * Human-readable summary of a buff / debuff skill or a support Ultimate.
 * Self-side effects read "P.ATK +4", foe-side effects read "foe P.DEF -5".
 */
export function buffSummary(sk, joiner = ' ') {
  if (!sk || !sk.effects) return '';
  const short = { hp: 'HP', patk: 'P.ATK', satk: 'S.ATK', pdef: 'P.DEF', sdef: 'S.DEF', spd: 'SPD', counter: 'CNT' };
  return sk.effects.map((e) => {
    const foe = effectTarget(sk, e) === 'foe';
    return `${foe ? 'foe ' : ''}${short[e.stat] || e.stat.toUpperCase()}${joiner}${foe ? '-' : '+'}${e.amount}`;
  }).join(', ');
}

/** Short text for the extra riders of a skill (life steal, fixed heal, reflect). */
export function riderSummary(sk) {
  if (!sk) return '';
  const out = [];
  if (sk.drain) out.push(`heals ${Math.round(sk.drain * 100)}% of damage dealt`);
  if (sk.healPct) out.push(`heals ${Math.round(sk.healPct * 100)}% max HP on hit`);
  if (sk.reflect) out.push(`returns the last hit taken x${sk.reflect}`);
  return out.join(' · ');
}

/**
 * Rank used to order skills "by level and power": lower unlock level first,
 * then weaker before stronger (damage power, or the stat change for buffs and
 * debuffs). `level` is the level the skill is learned at.
 */
export function skillStrength(sk) {
  if (!sk) return 0;
  if (sk.category === 'buff' || sk.category === 'debuff' || sk.kind === 'support') return (sk.effects || []).reduce((s, e) => s + Math.abs(e.amount), 0);
  if (sk.reflect) return 30 * sk.reflect;      // ranks between the mid and late specials
  return (sk.power || 0) + (sk.drain ? 6 : 0) + (sk.healPct ? 6 : 0);
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
    kind: ult.kind || 'damage',
    damageType: ult.damageType,
    element: ult.element,
    power: tier.power || 0,
    effects: tier.effects || null,
    selfBuff: tier.selfBuff || null,
    desc: ult.desc,
    future: !!tier.future,
  };
}

/** True for the buff / debuff Ultimates (no damage, two effects). */
export function isSupportUltimate(u) {
  return !!u && (u.kind === 'support');
}
