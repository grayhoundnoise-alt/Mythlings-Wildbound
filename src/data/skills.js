import { ULTIMATE_POWER_SCALE } from './config.js';
import { getWeather } from './weather.js';
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
//   sleep: { chance, turns: [min, max] }  put the foe to sleep — it loses whole
//                   turns. Re-sleeping adds to the counter, capped at 5.
//   seal:  { chance, turns: [min, max] }  seal the move the foe JUST used for
//                   1-2 turns. The unlimited Normal attack can never be sealed.
//   burn:   { chance, turns }   set BURNING on the foe (Fire). It ticks at the
//                   end of every round for up to DOT_MAX_TURNS. The tick scales
//                   with the TARGET's level, so the same burn is far heavier on
//                   a Lv.100 Mythling than on a Lv.20 one. Re-applying REFRESHES
//                   the counter; it never stacks into a double tick.
//   poison: { chance, turns }   the same rider for Poison. Identical maths, and
//                   it is listed separately so the Wiki and the icons can tell
//                   the two apart.
//   weather: { id, chance }  raise a weather condition for the rest of the battle
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
  // Every evolution stage teaches a stronger ELEMENTAL Normal move. Unlike the
  // element-less Lv.1 normals (Bite / Scratch / Peck / Pebble Toss), these carry an
  // element and therefore have LIMITED uses (30 / 25 / 20 by tier) — only the plain
  // starter attack is truly unlimited, and it is what a Mythling falls back on.
  thorn_jab:      { id: 'thorn_jab',      name: 'Thorn Jab',      category: 'normal', damageType: 'physical', element: 'nature', power: 17, uses: 30, desc: 'A jab of hardened thorns. 30 uses.' },
  briar_smash:    { id: 'briar_smash',    name: 'Briar Smash',    category: 'normal', damageType: 'physical', element: 'nature', power: 29, uses: 25, desc: 'A crushing blow wrapped in briars. 25 uses.' },
  worldroot_slam: { id: 'worldroot_slam', name: 'Worldroot Slam', category: 'normal', damageType: 'physical', element: 'nature', power: 40, uses: 20, desc: 'Roots older than the forest come down. 20 uses.' },
  stream_jab:     { id: 'stream_jab',     name: 'Stream Jab',     category: 'normal', damageType: 'physical', element: 'water',  power: 17, uses: 30, desc: 'A lance of running water. 30 uses.' },
  tide_smash:     { id: 'tide_smash',     name: 'Tide Smash',     category: 'normal', damageType: 'physical', element: 'water',  power: 30, uses: 25, desc: 'The weight of the turning tide. 25 uses.' },
  abyss_slam:     { id: 'abyss_slam',     name: 'Abyss Slam',     category: 'normal', damageType: 'physical', element: 'water',  power: 41, uses: 20, desc: 'Pressure from the lightless deep. 20 uses.' },
  ember_jab:      { id: 'ember_jab',      name: 'Ember Jab',      category: 'normal', damageType: 'physical', element: 'fire',   power: 18, uses: 30, desc: 'A searing strike. 30 uses.' },
  cinder_smash:   { id: 'cinder_smash',   name: 'Cinder Smash',   category: 'normal', damageType: 'physical', element: 'fire',   power: 31, uses: 25, desc: 'A heavy blow wreathed in cinders. 25 uses.' },
  magma_slam:     { id: 'magma_slam',     name: 'Magma Slam',     category: 'normal', damageType: 'physical', element: 'fire',   power: 42, uses: 20, desc: 'A fist of cooled magma. 20 uses.' },
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

  // ---------- BURN & POISON: damage over time ----------
  // Both are the SAME rider with a different name and colour. The tick scales
  // with the TARGET's level (see DOT_BASE / DOT_PER_LEVEL in config.js), so a
  // burn is worth far more against something that can survive it, and it lasts
  // up to DOT_MAX_TURNS. Re-applying refreshes the counter, never stacks.
  // Fire: the early move is a Special, so it lands a hit AND leaves the burn.
  kindling:        { id: 'kindling',        name: 'Kindling',        category: 'special', damageType: 'special',  element: 'fire',   power: 14, uses: 12, burn: { chance: 1.0, turns: 4 },  desc: 'Sets the foe alight. It burns every round for a few turns — and the hotter it is, the higher its level, the more it hurts.' },
  wildfire:        { id: 'wildfire',        name: 'Wildfire',        category: 'special', damageType: 'special',  element: 'fire',   power: 20, uses: 10, burn: { chance: 1.0, turns: 6 },  desc: 'A spreading blaze. Burns for longer, and a high-level foe cooks in it.' },
  immolation:      { id: 'immolation',      name: 'Immolation',      category: 'special', damageType: 'special',  element: 'fire',   power: 30, uses: 8,  burn: { chance: 1.0, turns: 8 },  desc: 'Sets the whole field alight. A long, punishing burn on a strong foe.', future: true },
  // Poison: the early move is a pure Debuff, so it does no damage of its own.
  toxic_bite:      { id: 'toxic_bite',      name: 'Toxic Bite',      category: 'debuff', effects: [{ stat: 'patk', amount: 4 }], uses: 12, poison: { chance: 1.0, turns: 4 }, desc: "Poisons the foe. It loses Health every round — the higher its level, the worse it festers." },
  venom_bloom:     { id: 'venom_bloom',     name: 'Venom Bloom',     category: 'debuff', effects: [{ stat: 'satk', amount: 4 }], uses: 12, poison: { chance: 1.0, turns: 4 }, desc: "A toxic bloom. Poisons the foe and dulls its Special Attack." },
  creeping_toxin:  { id: 'creeping_toxin',  name: 'Creeping Toxin',  category: 'debuff', effects: [{ stat: 'spd',  amount: 4 }], uses: 10, poison: { chance: 1.0, turns: 6 }, desc: 'A slow poison that drags at the foe and festers for a long time.' },
  plague_bloom:    { id: 'plague_bloom',    name: 'Plague Bloom',    category: 'debuff', effects: [{ stat: 'sdef', amount: 5 }], uses: 10, poison: { chance: 1.0, turns: 6 }, desc: 'A wasting plague. The foe rots away a little more every round.' },
  septic_rot:      { id: 'septic_rot',      name: 'Septic Rot',      category: 'debuff', effects: [{ stat: 'pdef', amount: 7 }], uses: 8,  poison: { chance: 1.0, turns: 8 }, desc: 'Rot that will not leave. A long, punishing poison on a strong foe.', future: true },

  // ---------- ROCK pool (Stonehollow Crags) ----------
  pebble_toss:     { id: 'pebble_toss',     name: 'Pebble Toss',     category: 'normal', damageType: 'physical', element: null,   power: 10, uses: Infinity, desc: 'A flick of loose gravel. Unlimited uses.' },
  rock_jab:        { id: 'rock_jab',        name: 'Rock Jab',        category: 'normal', damageType: 'physical', element: 'rock', power: 18, uses: 30, desc: 'A stone-hard headbutt. 30 uses.' },
  boulder_smash:   { id: 'boulder_smash',   name: 'Boulder Smash',   category: 'normal', damageType: 'physical', element: 'rock', power: 31, uses: 25, desc: 'Brings a boulder down on the foe. 25 uses.' },
  tectonic_slam:   { id: 'tectonic_slam',   name: 'Tectonic Slam',   category: 'normal', damageType: 'physical', element: 'rock', power: 42, uses: 20, desc: 'The ground itself lurches. 20 uses.' },
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

  // ---------- TACTICAL support: GUARD, PURGE, WARD ----------
  // The three "thinking" skills. They deal NO damage, so by the house rule they
  // are Buff type — but they are utility, not stat boosts, and each costs a
  // whole turn. Together they let a Mythling that is FASTER than its foe act
  // first and shape the round before the enemy's blow ever lands:
  //   GUARD — nullify the foe's next attack entirely. Press it when you can see
  //           an Ultimate coming: brace, eat nothing, then charge your own.
  //   PURGE — strip every buff off the foe (its Attack, Defense, Speed …).
  //   WARD  — strip every debuff off yourself. It does NOT touch your own buffs.
  guard_stance:    { id: 'guard_stance',    name: 'Guard Stance',    category: 'buff', effects: [{ stat: 'pdef', amount: 5 }, { stat: 'sdef', amount: 5 }], uses: 8, utility: 'guard', desc: "Braces for one turn: the foe's next attack is cancelled outright. Raises both Defenses in the meantime. Stops attacks only — a weather still burns through." },
  purge:           { id: 'purge',           name: 'Purge',           category: 'debuff', effects: [{ stat: 'pdef', amount: 3, target: 'foe' }], uses: 8, utility: 'purge', desc: "Wipes every buff off the foe — Attack, Defense, Speed, all of it — and leaves a gap in its guard." },
  ward:            { id: 'ward',            name: 'Ward',            category: 'buff', effects: [{ stat: 'sdef', amount: 3 }], uses: 8, utility: 'ward', desc: 'Cleanses every debuff off you. Your own buffs are left alone.' },

  // ---------- ELITE support skills: two effects, few uses ----------
  // Foe-side entries are always debuffs, self-side entries always buffs.
  war_cry:         { id: 'war_cry',         name: 'War Cry',         category: 'buff',   effects: [{ stat: 'patk', amount: 8 }, { stat: 'spd', amount: 6 }], uses: 4, desc: 'A roar that quickens the blood. Raises Physical Attack AND Speed.', future: true },
  arcane_surge:    { id: 'arcane_surge',    name: 'Arcane Surge',    category: 'buff',   effects: [{ stat: 'satk', amount: 8 }, { stat: 'sdef', amount: 6 }], uses: 4, desc: 'Power floods every sense. Raises Special Attack AND Special Defense.', future: true },
  bulwark:         { id: 'bulwark',         name: 'Bulwark',         category: 'buff',   effects: [{ stat: 'pdef', amount: 8 }, { stat: 'sdef', amount: 8 }], uses: 4, desc: 'Becomes a living wall. Raises both Defenses.', future: true },
  intimidate:      { id: 'intimidate',      name: 'Intimidate',      category: 'debuff', effects: [{ stat: 'patk', amount: 7 }, { stat: 'satk', amount: 7 }], uses: 4, desc: 'A stare that drains the will to fight. Lowers the foe\'s Physical AND Special Attack.', future: true },
  shatter:         { id: 'shatter',         name: 'Shatter',         category: 'debuff', effects: [{ stat: 'pdef', amount: 8 }, { stat: 'sdef', amount: 8 }], uses: 4, desc: 'Breaks every guard at once. Lowers both of the foe\'s Defenses.', future: true },
  predator_focus:  { id: 'predator_focus',  name: 'Predator Focus',  category: 'buff',   effects: [{ stat: 'patk', amount: 7 }, { stat: 'pdef', amount: 6, target: 'foe' }], uses: 4, desc: 'Locks onto the prey. Raises your Physical Attack and lowers the foe\'s Physical Defense.', future: true },
  mind_break:      { id: 'mind_break',      name: 'Mind Break',      category: 'debuff', effects: [{ stat: 'sdef', amount: 7 }, { stat: 'satk', amount: 6, target: 'self' }], uses: 4, desc: 'Cracks the foe\'s focus and feeds on it. Lowers the foe\'s Special Defense and raises your Special Attack.', future: true },


  // ---------- ELEMENT-NEUTRAL support pool (used by the Stormreach → Astral Spire species) ----------
  // Buffs and debuffs carry no element, so these are shared by every new line by role.
  power_up:  { id: 'power_up',  name: 'Power Up',  category: 'buff', effects: [{ stat: 'patk', amount: 4 }], uses: 10, desc: 'Raises Physical Attack.' },
  guard_up:  { id: 'guard_up',  name: 'Guard Up',  category: 'buff', effects: [{ stat: 'pdef', amount: 4 }], uses: 10, desc: 'Raises Physical Defense.' },
  mind_up:   { id: 'mind_up',   name: 'Mind Up',   category: 'buff', effects: [{ stat: 'satk', amount: 4 }], uses: 10, desc: 'Raises Special Attack.' },
  ward_up:   { id: 'ward_up',   name: 'Ward Up',   category: 'buff', effects: [{ stat: 'sdef', amount: 4 }], uses: 10, desc: 'Raises Special Defense.' },
  haste:     { id: 'haste',     name: 'Haste',     category: 'buff', effects: [{ stat: 'spd', amount: 5 }], uses: 8,  desc: 'Raises Speed.' },
  vitality:  { id: 'vitality',  name: 'Vitality',  category: 'buff', effects: [{ stat: 'hp', amount: 9 }], uses: 10, desc: 'Raises max HP.' },
  overpower: { id: 'overpower', name: 'Overpower', category: 'buff', effects: [{ stat: 'patk', amount: 6 }], uses: 8,  desc: 'Raises Physical Attack sharply.', future: true },
  overmind:  { id: 'overmind',  name: 'Overmind',  category: 'buff', effects: [{ stat: 'satk', amount: 6 }], uses: 8,  desc: 'Raises Special Attack sharply.', future: true },
  fortify:   { id: 'fortify',   name: 'Fortify',   category: 'buff', effects: [{ stat: 'pdef', amount: 7 }], uses: 8,  desc: 'Raises Physical Defense sharply.', future: true },
  weaken:    { id: 'weaken',    name: 'Weaken',    category: 'debuff', effects: [{ stat: 'patk', amount: 4 }], uses: 12, desc: 'Lowers the foe\'s Physical Attack.' },
  daze:      { id: 'daze',      name: 'Daze',      category: 'debuff', effects: [{ stat: 'satk', amount: 4 }], uses: 12, desc: 'Lowers the foe\'s Special Attack.' },
  hobble:    { id: 'hobble',    name: 'Hobble',    category: 'debuff', effects: [{ stat: 'spd',  amount: 4 }], uses: 12, desc: 'Lowers the foe\'s Speed.' },
  expose:    { id: 'expose',    name: 'Expose',    category: 'debuff', effects: [{ stat: 'pdef', amount: 5 }], uses: 10, desc: 'Lowers the foe\'s Physical Defense.' },
  unnerve:   { id: 'unnerve',   name: 'Unnerve',   category: 'debuff', effects: [{ stat: 'sdef', amount: 5 }], uses: 10, desc: 'Lowers the foe\'s Special Defense.' },
  cripple:   { id: 'cripple',   name: 'Cripple',   category: 'debuff', effects: [{ stat: 'pdef', amount: 7 }], uses: 8,  desc: 'Lowers the foe\'s Physical Defense sharply.' },
  hex:       { id: 'hex',       name: 'Hex',       category: 'debuff', effects: [{ stat: 'sdef', amount: 7 }], uses: 8,  desc: 'Lowers the foe\'s Special Defense sharply.' },

  // ---------- SLEEP: the foe loses whole turns ----------
  // `sleep: { chance, turns: [min, max] }` — the sleep counter is capped at
  // SLEEP_MAX_TURNS (5) no matter how often it is re-applied.
  spore_drift:    { id: 'spore_drift',    name: 'Spore Drift',    category: 'special', damageType: 'special', element: 'nature', power: 30, uses: 12,
                    sleep: { chance: 0.30, turns: [2, 4] }, desc: 'A drifting cloud of spores. May put the foe to sleep for 2-4 turns.' },
  venom_lullaby:  { id: 'venom_lullaby',  name: 'Venom Lullaby',  category: 'special', damageType: 'special', element: 'poison', power: 32, uses: 12,
                    sleep: { chance: 0.30, turns: [2, 4] }, desc: 'A sweet, poisoned hum. May put the foe to sleep for 2-4 turns.' },
  hypno_gaze:     { id: 'hypno_gaze',     name: 'Hypno Gaze',     category: 'debuff', uses: 6,
                    sleep: { chance: 0.35, turns: [2, 4] }, desc: 'A stare that folds the foe\'s mind shut. May put it to sleep for 2-4 turns.' },
  frost_hush:     { id: 'frost_hush',     name: 'Frost Hush',     category: 'debuff', uses: 6,
                    sleep: { chance: 0.32, turns: [1, 3] }, desc: 'Silence falls with the snow. May put the foe to sleep for 1-3 turns.' },

  // ---------- SEAL: the move the foe JUST used is locked away ----------
  // `seal: { chance, turns: [min, max] }` — it seals whatever skill the target
  // last used, for 1-2 turns. The unlimited Normal attack can never be sealed.
  static_bind:    { id: 'static_bind',    name: 'Static Bind',    category: 'special', damageType: 'special', element: 'electric', power: 34, uses: 12,
                    seal: { chance: 0.60, turns: [1, 2] }, desc: 'Charged coils clamp down. Likely to seal the move the foe just used for 1-2 turns.' },
  mirror_trap:    { id: 'mirror_trap',    name: 'Mirror Trap',    category: 'special', damageType: 'special', element: 'psychic', power: 36, uses: 12,
                    seal: { chance: 0.55, turns: [1, 2] }, desc: 'The foe sees its own move and forgets it. May seal its last used move for 1-2 turns.' },
  tangle_snare:   { id: 'tangle_snare',   name: 'Tangle Snare',   category: 'debuff', uses: 6,
                    seal: { chance: 0.60, turns: [2, 2] }, desc: 'Living rope knots the foe\'s stance. Likely to seal its last used move for 2 turns.' },
  rust_grip:      { id: 'rust_grip',      name: 'Rust Grip',      category: 'debuff', uses: 6,
                    seal: { chance: 0.65, turns: [2, 2] }, desc: 'Corrosion seizes the foe\'s form. Likely to seal its last used move for 2 turns.' },

  // ---------- WEATHER: exclusive, one per element, a handful of species ----------
  // `weather: { id, chance }` — raised when the move is USED, and the weather
  // then lasts for the rest of the battle (or until another weather replaces it).
  magma_storm:      { id: 'magma_storm',      name: 'Magma Storm',      category: 'special', damageType: 'special', element: 'fire',     power: 42, uses: 6,
                      weather: { id: 'wildfire',   chance: 0.75 }, desc: 'EXCLUSIVE — the ground splits and vents. Calls down Wildfire.' },
  monsoon_call:     { id: 'monsoon_call',     name: 'Monsoon Call',     category: 'special', damageType: 'special', element: 'water',    power: 42, uses: 6,
                      weather: { id: 'monsoon',    chance: 0.75 }, desc: 'EXCLUSIVE — the sky opens. Calls down Monsoon.' },
  worldroot_crown:  { id: 'worldroot_crown',  name: 'Worldroot Crown',  category: 'special', damageType: 'special', element: 'nature',   power: 42, uses: 6,
                      weather: { id: 'overgrowth', chance: 0.75 }, desc: 'EXCLUSIVE — the old roots answer. Calls down Overgrowth.' },
  thunder_caller:   { id: 'thunder_caller',   name: 'Thunder Caller',   category: 'special', damageType: 'special', element: 'electric', power: 42, uses: 6,
                      weather: { id: 'thunderhead', chance: 0.75 }, desc: 'EXCLUSIVE — a black cloud gathers. Calls down Thunderhead.' },
  glacial_age:      { id: 'glacial_age',      name: 'Glacial Age',      category: 'special', damageType: 'special', element: 'ice',      power: 42, uses: 6,
                      weather: { id: 'blizzard',   chance: 0.75 }, desc: 'EXCLUSIVE — the air goes white and still. Calls down Blizzard.' },
  miasma_bloom:     { id: 'miasma_bloom',     name: 'Miasma Bloom',     category: 'special', damageType: 'special', element: 'poison',   power: 42, uses: 6,
                      weather: { id: 'miasma',     chance: 0.75 }, desc: 'EXCLUSIVE — the fen exhales. Calls down Miasma.' },

};
// =============================================================================
// ELEMENT POOLS for Electric / Ice / Metal / Poison / Psychic — the same ladders
// the first four elements use (same powers, uses and riders), re-skinned per
// element. Generated here so every element stays identical in balance.
//   normals:  jab 17 (30 uses) · smash 30 (25) · slam 41 (20)          [elemental → limited]
//   specials: sp 16/27/41/55 and ph 15/28/40/54 (Lv.1 / 20 / 60 / 80), late tiers carry a rider
//   drain:    22 power, heals 50% of the damage dealt
// =============================================================================
const NEW_ELEMENT_POOLS = {
  electric: {
    normals: [['spark_jab', 'Spark Jab', 'A crackling jab.'], ['volt_smash', 'Volt Smash', 'A blow that discharges on impact.'], ['thunder_slam', 'Thunder Slam', 'The whole sky comes down.']],
    sp: [['static_shot', 'Static Shot', 'A snapping bolt of static.'], ['arc_lance', 'Arc Lance', 'A lance of arcing current.'], ['storm_surge', 'Storm Surge', 'A surge that may reduce the foe\'s Speed.', { stat: 'spd', amount: 3, chance: 0.35 }], ['thunderfall', 'Thunderfall', 'May reduce the foe\'s Special Defense.', { stat: 'sdef', amount: 4, chance: 0.4 }]],
    ph: [['volt_fang', 'Volt Fang', 'A bite that jolts.'], ['tesla_claw', 'Tesla Claw', 'Claws wreathed in current.'], ['lightning_dash', 'Lightning Dash', 'A charge faster than the eye.'], ['stormbreaker', 'Stormbreaker', 'May reduce the foe\'s Physical Defense.', { stat: 'pdef', amount: 4, chance: 0.4 }]],
    drain: ['volt_leech', 'Volt Leech', 'Draws the foe\'s charge into itself. Heals 50% of the damage dealt.', 'special'],
  },
  ice: {
    normals: [['frost_jab', 'Frost Jab', 'A jab that leaves rime behind.'], ['glacier_smash', 'Glacier Smash', 'A blow like calving ice.'], ['avalanche_slam', 'Avalanche Slam', 'A mountainside of snow comes down.']],
    sp: [['ice_shard', 'Ice Shard', 'A splinter of hard ice.'], ['frost_lance', 'Frost Lance', 'A lance of frozen air.'], ['blizzard', 'Blizzard', 'May reduce the foe\'s Speed.', { stat: 'spd', amount: 3, chance: 0.35 }], ['absolute_zero', 'Absolute Zero', 'May reduce the foe\'s Physical Defense.', { stat: 'pdef', amount: 4, chance: 0.4 }]],
    ph: [['icicle_fang', 'Icicle Fang', 'A bite of needle ice.'], ['frostbite_claw', 'Frostbite Claw', 'Claws that numb what they touch.'], ['glacial_charge', 'Glacial Charge', 'A charge with a glacier\'s weight.'], ['permafrost_crush', 'Permafrost Crush', 'May reduce the foe\'s Special Defense.', { stat: 'sdef', amount: 4, chance: 0.4 }]],
    drain: ['frost_siphon', 'Frost Siphon', 'Steals the foe\'s warmth. Heals 50% of the damage dealt.', 'special'],
  },
  metal: {
    normals: [['iron_jab', 'Iron Jab', 'A jab hard as an anvil.'], ['steel_smash', 'Steel Smash', 'A hammer-blow of tempered steel.'], ['titanium_slam', 'Titanium Slam', 'An unbreakable mass comes down.']],
    sp: [['shrapnel_shot', 'Shrapnel Shot', 'A spray of hot metal splinters.'], ['magnet_pulse', 'Magnet Pulse', 'A pulse that wrenches at the foe.'], ['forge_blast', 'Forge Blast', 'May reduce the foe\'s Special Defense.', { stat: 'sdef', amount: 3, chance: 0.35 }], ['singularity_core', 'Singularity Core', 'May reduce the foe\'s Physical Defense.', { stat: 'pdef', amount: 4, chance: 0.4 }]],
    ph: [['iron_fang', 'Iron Fang', 'A bite with iron teeth.'], ['steel_claw', 'Steel Claw', 'Claws of folded steel.'], ['piston_charge', 'Piston Charge', 'A charge driven like a piston.'], ['titan_press', 'Titan Press', 'May reduce the foe\'s Speed.', { stat: 'spd', amount: 4, chance: 0.4 }]],
    drain: ['alloy_leech', 'Alloy Leech', 'Magnetises the foe\'s strength into its own plating. Heals 50% of the damage dealt.', 'physical'],
  },
  poison: {
    normals: [['venom_jab', 'Venom Jab', 'A jab that leaves a sting.'], ['toxic_smash', 'Toxic Smash', 'A blow that splatters venom.'], ['plague_slam', 'Plague Slam', 'A crushing, festering impact.']],
    sp: [['toxic_spit', 'Toxic Spit', 'A gob of burning venom.'], ['venom_lance', 'Venom Lance', 'A lance of concentrated toxin.'], ['plague_wave', 'Plague Wave', 'May reduce the foe\'s Special Defense.', { stat: 'sdef', amount: 3, chance: 0.35 }], ['necrotic_burst', 'Necrotic Burst', 'May reduce the foe\'s Physical Attack.', { stat: 'patk', amount: 4, chance: 0.4 }]],
    ph: [['venom_fang', 'Venom Fang', 'A bite that poisons.'], ['toxic_claw', 'Toxic Claw', 'Claws dripping with toxin.'], ['corrosive_charge', 'Corrosive Charge', 'A charge that eats through armour.'], ['blight_crush', 'Blight Crush', 'May reduce the foe\'s Physical Defense.', { stat: 'pdef', amount: 4, chance: 0.4 }]],
    drain: ['venom_drain', 'Venom Drain', 'Drinks the foe\'s poisoned blood. Heals 50% of the damage dealt.', 'special'],
  },
  fighting: {
    normals: [['jab_cross', 'Jab Cross', 'A fast one-two.'], ['hammer_smash', 'Hammer Smash', 'A two-fisted hammer blow.'], ['finisher_slam', 'Finisher Slam', 'The move that ends the bout.']],
    sp: [['chi_palm', 'Chi Palm', 'A palm strike that lands on the spirit.'], ['focus_wave', 'Focus Wave', 'A shout given force.'], ['aura_burst', 'Aura Burst', 'May reduce the foe\'s Physical Defense.', { stat: 'pdef', amount: 3, chance: 0.35 }], ['spirit_barrage', 'Spirit Barrage', 'May reduce the foe\'s Special Defense.', { stat: 'sdef', amount: 4, chance: 0.4 }]],
    ph: [['knuckle_strike', 'Knuckle Strike', 'A bare-knuckle hit with the hips behind it.'], ['rising_kick', 'Rising Kick', 'An upward kick that lifts the foe.'], ['grapple_throw', 'Grapple Throw', 'A throw that uses the foe\'s own weight.'], ['champions_combo', 'Champion\'s Combo', 'May reduce the foe\'s Physical Attack.', { stat: 'patk', amount: 4, chance: 0.4 }]],
    drain: ['vital_press', 'Vital Press', 'A pressure-point hold that feeds on the foe\'s stamina. Heals 50% of the damage dealt.', 'physical'],
  },
  psychic: {
    normals: [['psi_jab', 'Psi Jab', 'A jab of focused will.'], ['mind_smash', 'Mind Smash', 'A blow of pure thought.'], ['astral_slam', 'Astral Slam', 'The weight of a star, imagined.']],
    sp: [['psi_bolt', 'Psi Bolt', 'A bolt of concentrated thought.'], ['mind_lance', 'Mind Lance', 'A lance aimed straight at the mind.'], ['astral_wave', 'Astral Wave', 'May reduce the foe\'s Special Attack.', { stat: 'satk', amount: 3, chance: 0.35 }], ['singularity', 'Singularity', 'May reduce the foe\'s Special Defense.', { stat: 'sdef', amount: 4, chance: 0.4 }]],
    ph: [['psi_fang', 'Psi Fang', 'A bite guided by foresight.'], ['telekinetic_claw', 'Telekinetic Claw', 'Claws that strike from a distance.'], ['astral_dash', 'Astral Dash', 'A dash through folded space.'], ['mind_crush', 'Mind Crush', 'May reduce the foe\'s Physical Defense.', { stat: 'pdef', amount: 4, chance: 0.4 }]],
    drain: ['psi_siphon', 'Psi Siphon', 'Feeds on the foe\'s thoughts. Heals 50% of the damage dealt.', 'special'],
  },
};
const NORMAL_LADDER = [[17, 30], [30, 25], [41, 20]];
const SP_LADDER = [[16, 20, 1], [27, 18, 20], [41, 15, 60], [55, 12, 80]];
const PH_LADDER = [[15, 20, 1], [28, 18, 20], [40, 15, 60], [54, 12, 80]];
for (const [element, pool] of Object.entries(NEW_ELEMENT_POOLS)) {
  pool.normals.forEach(([id, name, desc], i) => {
    const [power, uses] = NORMAL_LADDER[i];
    SKILLS[id] = { id, name, category: 'normal', damageType: 'physical', element, power, uses, desc: `${desc} ${uses} uses.` };
  });
  const special = (list, ladder, damageType) => list.forEach(([id, name, desc, rider], i) => {
    const [power, uses, lv] = ladder[i];
    SKILLS[id] = { id, name, category: 'special', damageType, element, power, uses, desc };
    if (rider) SKILLS[id].debuff = rider;
    if (lv >= 60) SKILLS[id].future = true;
  });
  special(pool.sp, SP_LADDER, 'special');
  special(pool.ph, PH_LADDER, 'physical');
  const [did, dname, ddesc, dtype] = pool.drain;
  SKILLS[did] = { id: did, name: dname, category: 'special', damageType: dtype, element, power: 22, uses: 12, drain: 0.5, desc: ddesc };
}
/** The pools by element, for species.js (which builds its unlock tables from them). */
export const ELEMENT_POOLS = NEW_ELEMENT_POOLS;


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

// ---------- Generated Ultimates for the five new elements ----------
// Per element: one Physical and one Special damage Ultimate (same tiers as the
// originals) and one SUPPORT Ultimate. Legendaries get their own, stronger tiers.
const DMG_TIERS = (p0) => [
  { suffix: '',    power: p0,      unlockLevel: 10 },
  { suffix: ' I',  power: p0 + 16, unlockLevel: 20 },
  { suffix: ' II', power: p0 + 40, unlockLevel: 60, future: true },
  { suffix: ' III',power: p0 + 70, unlockLevel: 80, future: true },
];
const SUPPORT_TIERS = (a, b) => [8, 11, 15, 20].map((amt, i) => ({
  suffix: ['', ' I', ' II', ' III'][i], unlockLevel: [10, 20, 60, 80][i], future: i >= 2 || undefined,
  effects: [{ stat: a.stat, amount: amt, target: a.target }, { stat: b.stat, amount: Math.round(amt * 0.75), target: b.target }],
}));
const NEW_ULTIMATES = [
  ['thunder_crown',    'Thunder Crown',    'electric', 'special',  34, 'A crown of lightning detonates over the foe.'],
  ['gigavolt_charge',  'Gigavolt Charge',  'electric', 'physical', 36, 'A charge carrying a whole storm\'s current.'],
  ['storm_mantle',     'Storm Mantle',     'electric', null, 0, 'Buff Ultimate: the caster wears the storm. Raises Speed AND Special Attack far beyond any buff skill.', { stat: 'spd', target: 'self' }, { stat: 'satk', target: 'self' }],
  ['winter_crown',     'Winter Crown',     'ice', 'special',  34, 'A halo of killing frost closes on the foe.'],
  ['glacier_fall',     'Glacier Fall',     'ice', 'physical', 36, 'A glacier\'s edge comes down on the foe.'],
  ['frozen_bastion',   'Frozen Bastion',   'ice', null, 0, 'Buff Ultimate: armour of living ice. Raises BOTH Defenses by far more than any buff skill.', { stat: 'pdef', target: 'self' }, { stat: 'sdef', target: 'self' }],
  ['magnetic_storm',   'Magnetic Storm',   'metal', 'special',  34, 'Every scrap of metal in the field turns into a weapon.'],
  ['iron_judgment',    'Iron Judgment',    'metal', 'physical', 36, 'A single, colossal hammer-blow.'],
  ['adamant_shell',    'Adamant Shell',    'metal', null, 0, 'Buff + Debuff Ultimate: the caster hardens while the foe is magnetised down. Raises your Physical Defense and lowers the foe\'s Speed.', { stat: 'pdef', target: 'self' }, { stat: 'spd', target: 'foe' }],
  ['plague_crown',     'Plague Crown',     'poison', 'special',  34, 'A crown of miasma settles on the foe.'],
  ['venom_tyrant',     'Venom Tyrant',     'poison', 'physical', 36, 'A single bite carrying every toxin the fen knows.'],
  ['miasma_hex',       'Miasma Hex',       'poison', null, 0, 'Debuff Ultimate: a poison that eats will and wits alike. Lowers the foe\'s Physical Attack AND Special Defense.', { stat: 'patk', target: 'foe' }, { stat: 'sdef', target: 'foe' }],
  ['champion_roar',    'Champion\'s Roar', 'fighting', 'special',  34, 'A shout of pure fighting spirit that lands like a blow.'],
  ['titan_gauntlet',   'Titan Gauntlet',   'fighting', 'physical', 36, 'Every ounce of the caster\'s weight behind one fist.'],
  ['unbroken_stance',  'Unbroken Stance',  'fighting', null, 0, 'Buff Ultimate: a stance nothing moves. Raises Physical Attack AND Physical Defense far beyond any buff skill.', { stat: 'patk', target: 'self' }, { stat: 'pdef', target: 'self' }],
  ['astral_crown',     'Astral Crown',     'psychic', 'special',  34, 'The stars themselves are turned on the foe.'],
  ['mind_shatter',     'Mind Shatter',     'psychic', 'physical', 36, 'A telekinetic blow that breaks bone and resolve.'],
  ['astral_ward',      'Astral Ward',      'psychic', null, 0, 'Buff Ultimate: a mind made unassailable. Raises Special Defense AND Special Attack far beyond any buff skill.', { stat: 'sdef', target: 'self' }, { stat: 'satk', target: 'self' }],
];
for (const [id, baseName, element, damageType, p0, desc, a, b] of NEW_ULTIMATES) {
  ULTIMATES[id] = damageType
    ? { id, baseName, element, damageType, tiers: DMG_TIERS(p0), desc }
    : { id, baseName, element, damageType: null, kind: 'support', tiers: SUPPORT_TIERS(a, b), desc };
}
// ---------- Legendary Ultimates: no evolution, so the tiers unlock by LEVEL (1 / 20 / 60 / 80) ----------
const LEGEND_TIERS = (p0) => [
  { suffix: '',    power: p0,      unlockLevel: 10 },
  { suffix: ' I',  power: p0 + 18, unlockLevel: 20 },
  { suffix: ' II', power: p0 + 44, unlockLevel: 60 },
  { suffix: ' III',power: p0 + 78, unlockLevel: 80 },
];
ULTIMATES.aurora_cataclysm = { id: 'aurora_cataclysm', baseName: 'Aurora Cataclysm', element: 'psychic', damageType: 'special', legendary: true,
  tiers: LEGEND_TIERS(46).map((t, i) => ({ ...t, selfBuff: [{ stat: 'satk', amount: 4 + i * 2 }] })),
  desc: 'LEGENDARY — the aurora itself is torn down onto the foe, and the caster drinks its light (raises its Special Attack).' };
ULTIMATES.plague_engine = { id: 'plague_engine', baseName: 'Plague Engine', element: 'poison', damageType: 'physical', legendary: true,
  tiers: LEGEND_TIERS(46).map((t, i) => ({ ...t, foeDebuff: [{ stat: 'pdef', amount: 4 + i * 2 }] })),
  desc: 'LEGENDARY — a corroded engine of venom and iron tears into the foe and eats its armour (lowers its Physical Defense).' };
ULTIMATES.core_meltdown = { id: 'core_meltdown', baseName: 'Core Meltdown', element: 'fire', damageType: 'special', legendary: true,
  tiers: LEGEND_TIERS(46).map((t, i) => ({ ...t, foeDebuff: [{ stat: 'sdef', amount: 4 + i * 2 }] })),
  desc: 'LEGENDARY — the planet\'s molten heart erupts through the foe and softens it to slag (lowers its Special Defense).' };

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

/** What a `utility` skill actually does, in one line (or '' when it has none). */
export const UTILITY_LABEL = {
  guard: "cancels the foe's next attack",
  purge: 'strips every buff off the foe',
  ward: 'strips every debuff off you',
};

/** Short text for the extra riders of a skill (life steal, fixed heal, reflect). */
export function riderSummary(sk) {
  if (!sk) return '';
  const out = [];
  if (sk.utility) out.push(UTILITY_LABEL[sk.utility] || sk.utility);
  if (sk.drain) out.push(`heals ${Math.round(sk.drain * 100)}% of damage dealt`);
  if (sk.healPct) out.push(`heals ${Math.round(sk.healPct * 100)}% max HP on hit`);
  if (sk.reflect) out.push(`returns the last hit taken x${sk.reflect}`);
  if (sk.sleep) out.push(`${Math.round(sk.sleep.chance * 100)}% chance to put the foe to sleep ${sk.sleep.turns[0]}-${sk.sleep.turns[1]} turns`);
  if (sk.seal) out.push(`${Math.round(sk.seal.chance * 100)}% chance to seal the move it just used for ${sk.seal.turns[0]}-${sk.seal.turns[1]} turns`);
  if (sk.weather) {
    const w = getWeather(sk.weather.id);
    if (w) out.push(`${Math.round(sk.weather.chance * 100)}% chance to call down ${w.name}`);
  }
  for (const kind of ['burn', 'poison']) {
    if (sk[kind]) out.push(`${Math.round(sk[kind].chance * 100)}% chance to ${kind} for ${sk[kind].turns} turns (scales with level, 10-turn cap)`);
  }
  return out.join(' · ');
}

/**
 * Rank used to order skills "by level and power": lower unlock level first,
 * then weaker before stronger (damage power, or the stat change for buffs and
 * debuffs). `level` is the level the skill is learned at.
 */
export function skillStrength(sk) {
  if (!sk) return 0;
  // A utility (Guard / Purge / Ward) is ranked on its stat numbers like any other
  // support skill. It is deliberately NOT boosted: auto-equip fills a battle
  // button with the strongest support it can find, and a boosted utility would
  // push itself onto every Mythling's loadout and evict the debuff the species
  // is actually built around. Utilities are meant to be equipped BY HAND.
  if (sk.category === 'buff' || sk.category === 'debuff' || sk.kind === 'support') {
    return (sk.effects || []).reduce((s, e) => s + Math.abs(e.amount), 0);
  }
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
    power: Math.round((tier.power || 0) * ULTIMATE_POWER_SCALE),
    listedPower: tier.power || 0,
    effects: tier.effects || null,
    selfBuff: tier.selfBuff || null,
    foeDebuff: tier.foeDebuff || null,
    legendary: !!ult.legendary,
    desc: ult.desc,
    future: !!tier.future,
  };
}

/** True for the buff / debuff Ultimates (no damage, two effects). */
export function isSupportUltimate(u) {
  return !!u && (u.kind === 'support');
}
