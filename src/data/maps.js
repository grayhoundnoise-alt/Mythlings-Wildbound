// World data. Every map is described purely as data so Map 4, 5, 6... can be appended
// later without touching engine code.
//
// terrain ids drive procedural prop generation + ground painting in the renderer.

import { ITEMS } from './items.js';

/** Every purchasable item, in catalogue order — the last region's shop always sells all of it. */
export const FULL_STOCK = Object.values(ITEMS).filter((i) => i.price > 0 && i.category !== 'key').map((i) => i.id);

export const MAPS = {
  verdant_vale: {
    id: 'verdant_vale',
    displayName: 'Verdant Vale',
    order: 0,
    element: 'nature',
    levelRange: [1, 20],
    music: 'vale',
    visualTheme: 'nature',
    width: 3600,
    height: 1500,
    spawn: { x: 420, y: 980 },
    ambient: { sky: ['#bff0ff', '#e8ffd9'], fog: 'rgba(200,255,210,0.10)' },
    regions: [
      { id: 'leafrest_town', name: 'Leafrest Town', rect: [0, 0, 1000, 1500], terrain: 'town' },
      { id: 'petal_path',    name: 'Petal Path',    rect: [1000, 0, 900, 1500], terrain: 'flowers' },
      { id: 'whisperwood',   name: 'Whisperwood',   rect: [1900, 0, 900, 1500], terrain: 'forest' },
      { id: 'verdant_gate',  name: 'Verdant Gate',  rect: [2800, 0, 800, 1500], terrain: 'ruins' },
    ],
    water: [
      { x: 1020, y: 1180, w: 780, h: 200, kind: 'stream' },
      { x: 250, y: 120, w: 520, h: 150, kind: 'pond' },
    ],
    bridges: [{ x: 1320, y: 1140, w: 170, h: 280 }],
    buildings: [
      { id: 'vale_center', type: 'center', x: 250, y: 520, w: 210, h: 160, name: 'Mythling Center' },
      { id: 'vale_shop',   type: 'shop',   x: 620, y: 530, w: 190, h: 150, name: 'Leafrest Supplies',
        stock: ['basic_ball', 'normal_ball', 'potion', 'greater_potion', 'revive_herb', 'skill_tonic', 'sweet_berry', 'crunchy_root', 'honey_nut', 'moon_melon'] },
      { id: 'vale_house1', type: 'house',  x: 120, y: 900, w: 170, h: 130, name: 'Cottage' },
      { id: 'vale_house2', type: 'house',  x: 700, y: 950, w: 170, h: 130, name: 'Cottage' },
    ],
    landmarks: [
      { id: 'sign_town', type: 'sign', x: 500, y: 1130, text: 'LEAFREST TOWN — where every journey begins.' },
      { id: 'sign_path', type: 'sign', x: 1060, y: 780, text: 'PETAL PATH →  Wild Mythlings ahead. Lv.1–5.' },
      { id: 'sign_wood', type: 'sign', x: 1960, y: 760, text: 'WHISPERWOOD →  Stronger Mythlings. Lv.4–8.' },
      { id: 'sign_gate', type: 'sign', x: 2860, y: 740, text: 'VERDANT GATE →  The Guardian awaits. Lv.7–10.' },
      { id: 'ruin_1', type: 'ruin', x: 2980, y: 400 },
      { id: 'ruin_2', type: 'ruin', x: 3260, y: 1020 },
    ],
    npcs: [
      { id: 'prof_fern', type: 'guide', x: 480, y: 800, name: 'Professor Fern', color: '#7ad06a',
        dialogue: [
          'Welcome to Wildbound! I am Professor Fern.',
          'Mythlings come in three elements: Nature beats Water, Water beats Fire, Fire beats Nature.',
          'You must DEFEAT a wild Mythling before you can catch it — a living one will never hold still.',
          'And remember: every Mythling you catch begins again at Lv.1. Their strength is what YOU raise.',
          'Mood and Rarity shape their stats. Rarity D adds nothing... but higher rarities amplify Mood a lot.',
          'Press ESC any time to open your menu — party, bag, collection and saving all live there.',
        ] },
      { id: 'nurse_vale', type: 'villager', x: 355, y: 700, name: 'Caretaker Moss', color: '#8fe0b0',
        dialogue: ['The Mythling Center heals your whole party, refills skill uses and Ultimate Charge. It is free!'] },
      { id: 'kid_leaf', type: 'villager', x: 810, y: 830, name: 'Sprout', color: '#ffd37a',
        dialogue: ['Shiny Mythlings glitter! I saw one once. Or maybe it was a firefly.'] },
    ],
    trainers: [
      { id: 'vale_t1', name: 'Forager Pim', x: 1280, y: 520, color: '#e0a86a', flag: 'vale_t1',
        intro: 'My Leaflet never sits still! Show me what you have got.',
        defeat: 'So fast... and you were faster. Take this.',
        reward: { coins: 220, items: { basic_ball: 2 } },
        team: [{ species: 'leaflet', level: 6 }, { species: 'spriggo', level: 7 }] },
      { id: 'vale_t2', name: 'Ranger Holt', x: 2180, y: 1050, color: '#9ec46a', flag: 'vale_t2',
        intro: 'Whisperwood tests every trainer. Ready?',
        defeat: 'The woods chose well today.',
        reward: { coins: 340, items: { potion: 2 } },
        team: [{ species: 'spriggo', level: 11 }, { species: 'leaflet', level: 11 }, { species: 'spriggo', level: 12 }] },
      { id: 'vale_guardian', name: 'Verdant Guardian Ysel', x: 3130, y: 730, color: '#3f8f4f', guardian: true, flag: 'vale_guardian',
        intro: 'None pass the Verdant Gate untested. Show me your bond!',
        defeat: 'The Vale accepts you. Take the Vale Charm — the gate is open.',
        reward: { coins: 700, items: { vale_charm: 1, normal_ball: 3 } },
        team: [{ species: 'leaflet', level: 18, rarity: 'C' }, { species: 'spriggo', level: 20, rarity: 'B', mood: 'brave' }] },
    ],
    encounterZones: [
      { id: 'vz1', rect: [1040, 150, 820, 1000], levelRange: [1, 8], density: 5,
        species: [{ id: 'spriggo', weight: 30 }, { id: 'leaflet', weight: 30 }, { id: 'mosscoil', weight: 20 }, { id: 'thornhound', weight: 10 }, { id: 'petalwisp', weight: 10 }] },
      { id: 'vz2', rect: [1920, 150, 840, 1200], levelRange: [6, 14], density: 6,
        species: [{ id: 'spriggo', weight: 25 }, { id: 'leaflet', weight: 30 }, { id: 'mosscoil', weight: 20 }, { id: 'thornhound', weight: 15 }, { id: 'petalwisp', weight: 10 }] },
      { id: 'vz3', rect: [2830, 200, 700, 1100], levelRange: [12, 20], density: 5,
        species: [{ id: 'spriggo', weight: 30 }, { id: 'leaflet', weight: 20 }, { id: 'mosscoil', weight: 15 }, { id: 'thornhound', weight: 20 }, { id: 'petalwisp', weight: 15 }] },
    ],
    connections: [
      { id: 'to_azure', rect: [3500, 600, 100, 320], toMap: 'azure_coast', toPoint: { x: 220, y: 900 },
        requiresItem: 'vale_charm',
        lockedText: 'The Verdant Gate is sealed. Defeat the Verdant Guardian to earn the Vale Charm.',
        label: 'To Azure Coast' },
    ],
  },

  azure_coast: {
    id: 'azure_coast',
    displayName: 'Azure Coast',
    order: 1,
    element: 'water',
    levelRange: [15, 30],
    music: 'coast',
    visualTheme: 'water',
    width: 4000,
    height: 1500,
    spawn: { x: 220, y: 900 },
    ambient: { sky: ['#9fdcff', '#d9f4ff'], fog: 'rgba(180,230,255,0.12)' },
    regions: [
      { id: 'tidecrest_port', name: 'Tidecrest Port', rect: [0, 0, 1100, 1500], terrain: 'port' },
      { id: 'coralway',       name: 'Coralway',       rect: [1100, 0, 900, 1500], terrain: 'beach' },
      { id: 'moonlit_river',  name: 'Moonlit River',  rect: [2000, 0, 900, 1500], terrain: 'river' },
      { id: 'azure_caverns',  name: 'Azure Caverns',  rect: [2900, 0, 700, 1500], terrain: 'cavern' },
      { id: 'emberwild_gate', name: 'Emberwild Gate', rect: [3600, 0, 400, 1500], terrain: 'ruins' },
    ],
    water: [
      { x: 0, y: 0, w: 4000, h: 260, kind: 'sea' },
      { x: 1150, y: 1150, w: 850, h: 350, kind: 'sea' },
      { x: 2050, y: 300, w: 300, h: 1100, kind: 'river' },
      { x: 2950, y: 900, w: 560, h: 320, kind: 'pond' },
    ],
    bridges: [{ x: 2020, y: 700, w: 360, h: 180 }],
    buildings: [
      { id: 'coast_center', type: 'center', x: 300, y: 560, w: 210, h: 160, name: 'Mythling Center' },
      { id: 'coast_shop',   type: 'shop',   x: 660, y: 570, w: 190, h: 150, name: 'Tidecrest Trading Post',
        stock: ['basic_ball', 'normal_ball', 'advanced_ball', 'potion', 'greater_potion', 'hyper_potion', 'revive_herb', 'skill_tonic', 'skill_elixir', 'mood_tonic', 'temper_tonic',
          'honey_nut', 'moon_melon', 'river_jerky', 'glow_nectar', 'ember_roast', 'coral_cake', 'tide_pudding'] },
      { id: 'coast_dock1',  type: 'dock',   x: 180, y: 250, w: 300, h: 110, name: 'Docks' },
      { id: 'coast_dock2',  type: 'dock',   x: 720, y: 250, w: 260, h: 110, name: 'Docks' },
      { id: 'coast_house',  type: 'house',  x: 150, y: 1050, w: 180, h: 130, name: 'Fisher Hut' },
    ],
    landmarks: [
      { id: 'sign_port', type: 'sign', x: 560, y: 900, text: 'TIDECREST PORT — Region 2. Wild Mythlings Lv.10–20.' },
      { id: 'sign_coral', type: 'sign', x: 1160, y: 820, text: 'CORALWAY →  Aquini and Rivruff roam the shallows.' },
      { id: 'sign_cav', type: 'sign', x: 2960, y: 640, text: 'AZURE CAVERNS →  Crystals hum. Strong Mythlings within.' },
      { id: 'crystal_1', type: 'crystal', x: 3050, y: 420 },
      { id: 'crystal_2', type: 'crystal', x: 3330, y: 1250 },
      { id: 'crystal_3', type: 'crystal', x: 3200, y: 760 },
    ],
    npcs: [
      { id: 'harbor_master', type: 'guide', x: 520, y: 700, name: 'Harbor Master Kael', color: '#5fc8f0',
        dialogue: [
          'Welcome to Tidecrest Port. The water Mythlings here hit Lv.20 out in the caverns.',
          'A Mythling that reaches Lv.20 can evolve. Watch for it — it is quite a sight.',
          'Beat the Caverns Guardian and I will hand you the Coast Pass for the Emberwild Gate.',
        ] },
      { id: 'coast_kid', type: 'villager', x: 880, y: 980, name: 'Dock Hand Miri', color: '#a8e6ff',
        dialogue: ['Storage is bottomless — catch everything! Sort it later in the Mythlings menu.'] },
    ],
    trainers: [
      { id: 'coast_t1', name: 'Tidewatcher Anu', x: 1500, y: 620, color: '#69b8e8', flag: 'coast_t1',
        intro: 'The tide favours the patient. And the prepared!',
        defeat: 'Well fought. The coast is yours to roam.',
        reward: { coins: 480, items: { normal_ball: 2 } },
        team: [{ species: 'aquini', level: 18 }, { species: 'rivruff', level: 19 }] },
      { id: 'coast_t2', name: 'Angler Bo', x: 2500, y: 1120, color: '#4f8fc0', flag: 'coast_t2',
        intro: 'Caught more Rivruff than fish this week.',
        defeat: 'Guess I should stick to fishing.',
        reward: { coins: 560, items: { greater_potion: 2 } },
        team: [{ species: 'rivruff', level: 22 }, { species: 'aquini', level: 23 }, { species: 'rivruff', level: 23 }] },
      { id: 'coast_guardian', name: 'Cavern Guardian Nerith', x: 3450, y: 700, color: '#2f7fb0', guardian: true, flag: 'coast_guardian',
        intro: 'Beyond me lies fire. Prove the sea cannot break you.',
        defeat: 'Go. The Emberwild Gate will know you now. Take the Coast Pass.',
        reward: { coins: 1100, items: { coast_pass: 1, advanced_ball: 3 } },
        team: [
          { species: 'aquini', level: 27, rarity: 'B' },
          { species: 'rivruff', level: 29, rarity: 'B', mood: 'sturdy' },
          { species: 'aquini', level: 30, rarity: 'A', mood: 'clever' },
        ] },
    ],
    encounterZones: [
      { id: 'az1', rect: [1140, 320, 820, 780], levelRange: [15, 20], density: 6,
        species: [{ id: 'aquini', weight: 30 }, { id: 'rivruff', weight: 30 }, { id: 'currentkit', weight: 20 }, { id: 'shelldrake', weight: 10 }, { id: 'tidewyrm', weight: 10 }] },
      { id: 'az2', rect: [2380, 320, 480, 1050], levelRange: [19, 25], density: 5,
        species: [{ id: 'aquini', weight: 25 }, { id: 'rivruff', weight: 25 }, { id: 'currentkit', weight: 20 }, { id: 'shelldrake', weight: 15 }, { id: 'tidewyrm', weight: 15 }] },
      { id: 'az3', rect: [2930, 320, 620, 520], levelRange: [24, 30], density: 5,
        species: [{ id: 'aquini', weight: 20 }, { id: 'rivruff', weight: 25 }, { id: 'currentkit', weight: 15 }, { id: 'shelldrake', weight: 20 }, { id: 'tidewyrm', weight: 20 }] },
    ],
    connections: [
      { id: 'back_vale', rect: [0, 600, 60, 320], toMap: 'verdant_vale', toPoint: { x: 3420, y: 760 }, label: 'To Verdant Vale' },
      { id: 'to_ember', rect: [3920, 620, 80, 320], toMap: 'emberwild', toPoint: { x: 220, y: 880 },
        requiresItem: 'coast_pass',
        lockedText: 'The Emberwild Gate blazes shut. Defeat the Cavern Guardian for the Coast Pass.',
        label: 'To Emberwild' },
    ],
  },

  emberwild: {
    id: 'emberwild',
    displayName: 'Emberwild',
    order: 2,
    element: 'fire',
    levelRange: [30, 45],
    music: 'ember',
    visualTheme: 'fire',
    width: 4200,
    height: 1500,
    spawn: { x: 220, y: 880 },
    ambient: { sky: ['#5a1f18', '#ff9a4a'], fog: 'rgba(255,120,40,0.13)' },
    regions: [
      { id: 'emberwatch_outpost', name: 'Emberwatch Outpost', rect: [0, 0, 1000, 1500], terrain: 'outpost' },
      { id: 'ashen_trail',        name: 'Ashen Trail',        rect: [1000, 0, 900, 1500], terrain: 'ash' },
      { id: 'cinder_forest',      name: 'Cinder Forest',      rect: [1900, 0, 800, 1500], terrain: 'cinder' },
      { id: 'molten_cavern',      name: 'Molten Cavern',      rect: [2700, 0, 700, 1500], terrain: 'molten' },
      { id: 'volcanic_ruins',     name: 'Volcanic Ruins',     rect: [3400, 0, 800, 1500], terrain: 'volcanic_ruins' },
    ],
    water: [
      { x: 1050, y: 1180, w: 800, h: 180, kind: 'lava' },
      { x: 2740, y: 220, w: 600, h: 220, kind: 'lava' },
      { x: 2760, y: 1080, w: 580, h: 260, kind: 'lava' },
      { x: 3500, y: 560, w: 620, h: 180, kind: 'lava' },
    ],
    bridges: [{ x: 1330, y: 1140, w: 190, h: 260 }, { x: 3700, y: 520, w: 200, h: 260 }],
    buildings: [
      { id: 'ember_center', type: 'center', x: 280, y: 540, w: 210, h: 160, name: 'Mythling Center' },
      { id: 'ember_shop',   type: 'shop',   x: 640, y: 550, w: 190, h: 150, name: 'Emberwatch Quartermaster',
        // Region-3 stock only: the top-tier balls, restores and foods moved to the LAST map's shop.
        stock: ['advanced_ball', 'absolute_ball',
          'greater_potion', 'hyper_potion', 'max_potion', 'revive_herb', 'max_revive', 'skill_tonic', 'skill_elixir', 'mood_tonic', 'temper_tonic',
          'river_jerky', 'ember_roast', 'mythic_feast', 'tide_pudding', 'storm_eel_stew', 'dragonfruit_flambe'] },
      { id: 'ember_tower',  type: 'tower',  x: 140, y: 1020, w: 160, h: 200, name: 'Watchtower' },
    ],
    landmarks: [
      { id: 'sign_out', type: 'sign', x: 540, y: 880, text: 'EMBERWATCH OUTPOST — Region 3. Wild Mythlings Lv.20–30.' },
      { id: 'sign_ash', type: 'sign', x: 1060, y: 760, text: 'ASHEN TRAIL →  Mind the lava. Emberu territory.' },
      { id: 'sign_ruins', type: 'sign', x: 3440, y: 900, text: 'VOLCANIC RUINS →  The Flame Warden guards the summit.' },
      { id: 'volcano_1', type: 'volcano', x: 2300, y: 260 },
      { id: 'ruin_3', type: 'ruin', x: 3560, y: 1120 },
      { id: 'ruin_4', type: 'ruin', x: 3980, y: 380 },
    ],
    npcs: [
      { id: 'warden_scout', type: 'guide', x: 500, y: 700, name: 'Scout Cinder', color: '#ff9a5a',
        dialogue: [
          'Emberwild is no place for a Lv.20 team, trainer. Wild Mythlings here run Lv.30 to Lv.45.',
          'Catch a Lv.45 Emberu if you like — it will still join you at Lv.1. That is the law of the bond.',
          'The Flame Warden waits in the Volcanic Ruins. Come back when your team is near Lv.45 — beyond her lies the Emberwild Pass to the Crags.',
        ] },
      { id: 'ember_smith', type: 'villager', x: 830, y: 960, name: 'Forgehand Vull', color: '#ffb877',
        dialogue: ['A God Ball never fails — pricey, but at Lv.45 a wild Emberu does not go quietly.'] },
    ],
    trainers: [
      { id: 'ember_t1', name: 'Ash Runner Dax', x: 1450, y: 560, color: '#e8743a', flag: 'ember_t1',
        intro: 'You made it past the coast? The ash is less forgiving.',
        defeat: 'Hot-headed of me to challenge you.',
        reward: { coins: 900, items: { advanced_ball: 2 } },
        team: [{ species: 'emberu', level: 33 }, { species: 'emberu', level: 34, mood: 'brave' }] },
      { id: 'ember_t2', name: 'Cinder Witch Vex', x: 2350, y: 1080, color: '#c9502f', flag: 'ember_t2',
        intro: 'The forest burns, yet it grows. Curious, no?',
        defeat: 'Embers scatter. So do I.',
        reward: { coins: 1200, items: { greater_potion: 3 } },
        team: [{ species: 'emberu', level: 36, rarity: 'C' }, { species: 'spriggo', level: 36 }, { species: 'emberu', level: 37, rarity: 'C' }] },
      { id: 'ember_t3', name: 'Magma Diver Rho', x: 3050, y: 700, color: '#ff6a4a', flag: 'ember_t3',
        intro: 'Molten Cavern rules: hit hard, hit first.',
        defeat: 'Fast. Very fast.',
        reward: { coins: 1500, items: { absolute_ball: 1 } },
        team: [{ species: 'emberu', level: 39, rarity: 'B' }, { species: 'rivruff', level: 39 }, { species: 'emberu', level: 40, rarity: 'B', mood: 'sturdy' }] },
      { id: 'flame_warden', name: 'Flame Warden Ignis', x: 3950, y: 900, color: '#ff4d2d', guardian: true, flag: 'flame_warden',
        intro: 'Beyond this pass the mountains themselves fight back. Prove you are ready for stone, trainer.',
        defeat: 'Magnificent. Take the Ember Sigil — the Emberwild Pass to Stonehollow Crags is open to you.',
        reward: { coins: 3000, items: { ember_sigil: 1, god_ball: 1, absolute_ball: 2 } },
        team: [
          { species: 'emberu', level: 42, rarity: 'B', mood: 'sturdy' },
          { species: 'rivruff', level: 43, rarity: 'A', mood: 'sturdy' },
          { species: 'spriggo', level: 44, rarity: 'A', mood: 'brave' },
          { species: 'emberu', level: 45, rarity: 'S', mood: 'brave' },
        ] },
    ],
    encounterZones: [
      { id: 'ez1', rect: [1040, 250, 820, 850], levelRange: [30, 35], density: 6,
        species: [{ id: 'emberu', weight: 45 }, { id: 'emberlynx', weight: 20 }, { id: 'cinderhawk', weight: 15 }, { id: 'ashpup', weight: 15 }, { id: 'magmataur', weight: 5 }] },
      { id: 'ez2', rect: [1930, 300, 730, 1050], levelRange: [34, 39], density: 6,
        species: [{ id: 'emberu', weight: 40 }, { id: 'emberlynx', weight: 20 }, { id: 'cinderhawk', weight: 20 }, { id: 'ashpup', weight: 15 }, { id: 'magmataur', weight: 5 }] },
      { id: 'ez3', rect: [2740, 500, 620, 520], levelRange: [37, 42], density: 5,
        species: [{ id: 'emberu', weight: 40 }, { id: 'emberlynx', weight: 15 }, { id: 'cinderhawk', weight: 15 }, { id: 'ashpup', weight: 20 }, { id: 'magmataur', weight: 10 }] },
      { id: 'ez4', rect: [3440, 800, 700, 620], levelRange: [41, 45], density: 5,
        species: [{ id: 'emberu', weight: 40 }, { id: 'emberlynx', weight: 15 }, { id: 'cinderhawk', weight: 10 }, { id: 'ashpup', weight: 15 }, { id: 'magmataur', weight: 20 }] },
    ],
    connections: [
      { id: 'back_coast', rect: [0, 580, 60, 320], toMap: 'azure_coast', toPoint: { x: 3840, y: 780 }, label: 'To Azure Coast' },
      { id: 'to_crags', rect: [4120, 620, 80, 320], toMap: 'stonehollow_crags', toPoint: { x: 220, y: 880 },
        requiresItem: 'ember_sigil',
        lockedText: 'The Emberwild Pass is barred by fallen rock. Defeat the Flame Warden for the Ember Sigil.',
        label: 'To Stonehollow Crags' },
    ],
  },

  // =====================================================================
  // STONEHOLLOW CRAGS — Rock, Lv.45-60. Quarry camp, crystal caves and the
  // Titan Summit where the Stone Warden waits.
  // =====================================================================
  stonehollow_crags: {
    id: 'stonehollow_crags',
    displayName: 'Stonehollow Crags',
    order: 3,
    element: 'rock',
    levelRange: [45, 60],
    music: 'crags',
    visualTheme: 'rock',
    width: 4400,
    height: 1500,
    spawn: { x: 220, y: 880 },
    ambient: { sky: ['#3b3f4e', '#c9b48b'], fog: 'rgba(210,196,170,0.12)' },
    regions: [
      { id: 'quarry_camp',    name: 'Quarry Camp',    rect: [0, 0, 1000, 1500],    terrain: 'quarry' },
      { id: 'gravel_pass',    name: 'Gravel Pass',    rect: [1000, 0, 900, 1500],  terrain: 'crag' },
      { id: 'crystal_hollow', name: 'Crystal Hollow', rect: [1900, 0, 800, 1500],  terrain: 'cavern' },
      { id: 'shale_ridge',    name: 'Shale Ridge',    rect: [2700, 0, 800, 1500],  terrain: 'crag' },
      { id: 'titan_summit',   name: 'Titan Summit',   rect: [3500, 0, 900, 1500],  terrain: 'summit' },
    ],
    water: [
      { x: 1120, y: 1160, w: 640, h: 200, kind: 'pond' },
      { x: 2880, y: 240, w: 540, h: 170, kind: 'river' },
      { x: 3680, y: 1090, w: 560, h: 220, kind: 'pond' },
    ],
    bridges: [{ x: 1380, y: 1120, w: 190, h: 280 }, { x: 3040, y: 200, w: 180, h: 250 }],
    buildings: [
      { id: 'crag_center', type: 'center', x: 270, y: 540, w: 210, h: 160, name: 'Mythling Center' },
      { id: 'crag_shop',   type: 'shop',   x: 630, y: 550, w: 190, h: 150, name: 'Crags Outfitter',
        // The LAST map's shop carries the COMPLETE catalogue (every ball, restore, tonic and food).
        // When a new region is added, the top of this list moves there and this one is trimmed.
        stock: FULL_STOCK },
      { id: 'crag_lodge',  type: 'house',  x: 300, y: 1000, w: 180, h: 140, name: 'Quarry Lodge' },
      { id: 'summit_watch',type: 'tower',  x: 3900, y: 280, w: 130, h: 210, name: 'Summit Watch' },
    ],
    landmarks: [
      { id: 'crag_sign', type: 'sign', x: 520, y: 820, text: 'STONEHOLLOW CRAGS — mind the falling rock. Titan Summit lies east.' },
      { id: 'hollow_crystal', type: 'crystal', x: 2260, y: 700 },
      { id: 'hollow_crystal2', type: 'crystal', x: 2520, y: 1120 },
      { id: 'ridge_ruin', type: 'ruin', x: 3060, y: 760 },
      { id: 'summit_ruin', type: 'ruin', x: 3720, y: 620 },
    ],
    npcs: [
      { id: 'quarry_foreman', type: 'villager', x: 720, y: 860, name: 'Foreman Bram', color: '#b98b5a',
        dialogue: ['Welcome to the Crags, trainer. Everything up here is Rock type — fire barely scratches them.', 'Water and Nature Mythlings crack stone wide open. Bring the right team, or bring a lot of potions.'] },
      { id: 'crystal_hermit', type: 'guide', x: 2200, y: 480, name: 'Hermit Sela', color: '#8fb8c8',
        dialogue: ['The crystals in this hollow remember everything. The Mythlings that live here drink light from them.', 'The Stone Warden guards the Titan Summit. She has never been beaten. Not once.'] },
    ],
    trainers: [
      { id: 'crag_t1', name: 'Quarry Hand Doric', x: 1320, y: 720, color: '#a08a6a', flag: 'crag_t1',
        intro: 'Heavy hitters only past this point. Let us see what you have got.',
        defeat: 'Ha! Solid. Keep climbing.',
        reward: { coins: 2200, items: { absolute_ball: 2 } },
        team: [{ species: 'pebbleshell', level: 48 }, { species: 'gravelhog', level: 49 }] },
      { id: 'crag_t2', name: 'Prospector Wren', x: 2320, y: 940, color: '#7fa0c0', flag: 'crag_t2',
        intro: 'I dig for crystals. My Mythlings dig for weaknesses.',
        defeat: 'Fine, fine — the hollow is yours to prospect.',
        reward: { coins: 2800, items: { max_potion: 2, mood_tonic: 1 } },
        team: [{ species: 'quartzling', level: 51 }, { species: 'shalecrawl', level: 52 }, { species: 'rubblekin', level: 52, rarity: 'C' }] },
      { id: 'crag_t3', name: 'Ridge Runner Tamsin', x: 3220, y: 720, color: '#c08a6a', flag: 'crag_t3',
        intro: 'Nobody outruns me on the shale. Nobody out-hits my boars either.',
        defeat: 'Not bad, not bad. The summit is just ahead — good luck with HER.',
        reward: { coins: 3400, items: { god_ball: 1, temper_tonic: 1 } },
        team: [{ species: 'gravelhog', level: 54, rarity: 'B' }, { species: 'quartzling', level: 55, rarity: 'B' }, { species: 'pebbleshell', level: 55, rarity: 'B', mood: 'guarded' }] },
      { id: 'stone_warden', name: 'Stone Warden Halda', x: 4030, y: 820, color: '#8a7f6a', guardian: true, finalBoss: true, flag: 'stone_warden',
        intro: 'I am the mountain\'s answer to every trainer who climbed too high. Show me you belong up here.',
        defeat: 'The mountain yields. Wildbound is yours to roam — until the world grows again.',
        reward: { coins: 8000, items: { crag_seal: 1, god_ball: 2, shiny_ball: 1 } },
        team: [
          { species: 'rubblekin', level: 57, rarity: 'A', mood: 'sturdy' },
          { species: 'shalecrawl', level: 58, rarity: 'A', mood: 'swift' },
          { species: 'quartzling', level: 59, rarity: 'S', mood: 'clever' },
          { species: 'gravelhog', level: 60, rarity: 'S', mood: 'brave' },
        ] },
    ],
    encounterZones: [
      { id: 'cz1', rect: [1040, 120, 820, 960], levelRange: [45, 50], density: 6,
        species: [{ id: 'pebbleshell', weight: 30 }, { id: 'gravelhog', weight: 30 }, { id: 'shalecrawl', weight: 20 }, { id: 'quartzling', weight: 10 }, { id: 'rubblekin', weight: 10 }] },
      { id: 'cz2', rect: [1940, 200, 720, 1100], levelRange: [49, 54], density: 6,
        species: [{ id: 'quartzling', weight: 30 }, { id: 'shalecrawl', weight: 25 }, { id: 'rubblekin', weight: 20 }, { id: 'pebbleshell', weight: 15 }, { id: 'gravelhog', weight: 10 }] },
      { id: 'cz3', rect: [2740, 480, 720, 900], levelRange: [53, 58], density: 5,
        species: [{ id: 'gravelhog', weight: 25 }, { id: 'rubblekin', weight: 25 }, { id: 'pebbleshell', weight: 20 }, { id: 'quartzling', weight: 15 }, { id: 'shalecrawl', weight: 15 }] },
      { id: 'cz4', rect: [3540, 560, 760, 480], levelRange: [56, 60], density: 5,
        species: [{ id: 'rubblekin', weight: 30 }, { id: 'quartzling', weight: 20 }, { id: 'gravelhog', weight: 20 }, { id: 'shalecrawl', weight: 15 }, { id: 'pebbleshell', weight: 15 }] },
    ],
    connections: [
      { id: 'back_ember', rect: [0, 600, 60, 320], toMap: 'emberwild', toPoint: { x: 4040, y: 780 }, label: 'To Emberwild' },
    ],
  },
};

export const MAP_ORDER = Object.values(MAPS).sort((a, b) => a.order - b.order).map((m) => m.id);

export function getMap(id) {
  return MAPS[id] || null;
}

export function regionAt(map, x, y) {
  for (const r of map.regions) {
    const [rx, ry, rw, rh] = r.rect;
    if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return r;
  }
  return map.regions[0];
}
