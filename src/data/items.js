// Item + ball configuration. Names/prices/multipliers are all editable here,
// capture math never lives inside UI code.
export const ITEMS = {
  basic_ball:    { id: 'basic_ball',    name: 'Basic Ball',    category: 'balls',   price: 120,  catchMult: 1.00, desc: 'A simple binding sphere. Works best on weakened Mythlings.' },
  normal_ball:   { id: 'normal_ball',   name: 'Normal Ball',   category: 'balls',   price: 260,  catchMult: 1.25, desc: 'A refined ball with a stronger binding field.' },
  advanced_ball: { id: 'advanced_ball', name: 'Advanced Ball', category: 'balls',   price: 550,  catchMult: 1.50, desc: 'Crafted with coast crystal. Notably more reliable.' },
  absolute_ball: { id: 'absolute_ball', name: 'Absolute Ball', category: 'balls',   price: 1100, catchMult: 1.80, desc: 'An ember-forged ball for stubborn Mythlings.' },
  // `guaranteed` bypasses the capture formula entirely: a 100% catch, every time.
  // `forceRarity` fixes the rarity of what you catch, on top of `guaranteed`.
  god_ball:      { id: 'god_ball',      name: 'God Ball',      category: 'balls',   price: 120000, catchMult: 99, guaranteed: true, forceRarity: 'SSS+', desc: 'The supreme binding sphere. Never fails, and the Mythling always emerges SSS+.' },
  // `forceMutation` turns the caught Mythling into that mutation, every time.
  shiny_ball:    { id: 'shiny_ball',    name: 'Shiny Ball',    category: 'balls',   price: 800000, catchMult: 99, guaranteed: true, forceRarity: 'SSS+', forceMutation: 'shiny',    desc: 'Forged from starlight. Guaranteed capture, always SSS+, always SHINY. Priced so that buying a second one is an achievement.' },
  dark_ball:     { id: 'dark_ball',     name: 'Dark Ball',     category: 'balls',   price: 950000, catchMult: 99, guaranteed: true, forceRarity: 'SSS+', forceMutation: 'darkness', desc: 'Cut from an eclipse. Guaranteed capture, always SSS+, always DARKNESS. The rarest thing money can buy.' },

  potion:         { id: 'potion',         name: 'Potion',         category: 'healing', price: 150,  heal: 60,   desc: 'Restores 60 HP to one Mythling.' },
  greater_potion: { id: 'greater_potion', name: 'Greater Potion', category: 'healing', price: 380,  heal: 160,  desc: 'Restores 160 HP to one Mythling.' },
  hyper_potion:   { id: 'hyper_potion',   name: 'Hyper Potion',   category: 'healing', price: 800,  heal: 400,  desc: 'Restores 400 HP to one Mythling.' },
  max_potion:     { id: 'max_potion',     name: 'Max Potion',     category: 'healing', price: 1800, healFull: true, desc: 'Fully restores the HP of one Mythling.' },
  revive_herb:    { id: 'revive_herb',    name: 'Revive Herb',    category: 'healing', price: 600,  revive: 0.5, desc: 'Revives a fainted Mythling with half HP.' },
  max_revive:     { id: 'max_revive',     name: 'Max Revive',     category: 'healing', price: 1500, revive: 1.0, desc: 'Revives a fainted Mythling with full HP.' },
  skill_tonic:    { id: 'skill_tonic',    name: 'Skill Tonic',    category: 'healing', price: 320,  restoreUses: 8, desc: 'Restores 8 uses to every limited skill.' },
  skill_elixir:   { id: 'skill_elixir',   name: 'Skill Elixir',   category: 'healing', price: 950,  restoreAllUses: true, desc: 'Resets every limited skill back to full uses.' },
  full_restore:   { id: 'full_restore',   name: 'Full Restore',   category: 'healing', price: 3200, healFull: true, restoreAllUses: true, desc: 'Fully restores HP AND every skill\'s uses. Cannot revive.' },

  // ---- TONICS: re-roll a Mythling's personality traits (used from its profile) ----
  mood_tonic:   { id: 'mood_tonic',   name: 'Mood Tonic',   category: 'tonics', price: 2500, rerollMood: true,     desc: 'Re-rolls a Mythling\'s Mood into a different one. Use it from the Mythling\'s profile.' },
  // Battle only: debuffs live on the battle combatant, not on the Mythling.
  cleanse_tonic: { id: 'cleanse_tonic', name: 'Cleanse Tonic', category: 'healing', price: 2200, cleanse: true, desc: 'Washes every debuff off one Mythling, wakes it from sleep and unseals its moves. Battle only — nothing to cleanse outside a fight.' },
  temper_tonic: { id: 'temper_tonic', name: 'Temper Tonic', category: 'tonics', price: 2500, rerollRational: true, desc: 'Re-rolls a Mythling\'s Rational (+10 / -10 trait) into a different one. Use it from the Mythling\'s profile.' },

  // ---- FOOD: feed a Mythling to train it faster (grants EXP directly) ----
  sweet_berry:  { id: 'sweet_berry',  name: 'Sweet Berry',  category: 'food', price: 90,   exp: 40,   desc: 'A sugary forest berry. Feeding it grants 40 EXP.' },
  honey_nut:    { id: 'honey_nut',    name: 'Honey Nut',    category: 'food', price: 420,  exp: 130,  desc: 'A sticky, energy-packed nut. Grants 130 EXP.' },
  river_jerky:  { id: 'river_jerky',  name: 'River Jerky',  category: 'food', price: 1900,  exp: 400,  desc: 'Salt-cured coast fish. Grants 400 EXP.' },
  ember_roast:  { id: 'ember_roast',  name: 'Ember Roast',  category: 'food', price: 6000, exp: 1000, desc: 'Slow-roasted over volcanic vents. Grants 1000 EXP.' },
  mythic_feast: { id: 'mythic_feast', name: 'Mythic Feast', category: 'food', price: 20800, exp: 2600, desc: 'A legendary banquet for one. Grants 2600 EXP.' },
  // High-level training food: a level past Lv.30 costs thousands of EXP and a
  // level near the cap over 16,000, so the ladder keeps climbing. Feeding a
  // stack at once never wastes food — the game caps it at the level cap.
  crunchy_root:       { id: 'crunchy_root',       name: 'Crunchy Root',       category: 'food', price: 200,   exp: 80,     desc: 'A crisp forest root. Grants 80 EXP.' },
  moon_melon:         { id: 'moon_melon',         name: 'Moon Melon',         category: 'food', price: 950,   exp: 250,    desc: 'Ripens only under moonlight. Grants 250 EXP.' },
  glow_nectar:        { id: 'glow_nectar',        name: 'Glow Nectar',        category: 'food', price: 3400,   exp: 650,    desc: 'Luminous nectar from coast blossoms. Grants 650 EXP.' },
  coral_cake:         { id: 'coral_cake',         name: 'Coral Cake',         category: 'food', price: 12600,  exp: 1800,   desc: 'A dense, sweet cake baked by port cooks. Grants 1,800 EXP.' },
  tide_pudding:       { id: 'tide_pudding',       name: 'Tide Pudding',       category: 'food', price: 36000,  exp: 4000,   desc: 'Wobbles like the sea it came from. Grants 4,000 EXP.' },
  storm_eel_stew:     { id: 'storm_eel_stew',     name: 'Storm Eel Stew',     category: 'food', price: 80000,  exp: 8000,   desc: 'Crackles with leftover lightning. Grants 8,000 EXP.' },
  dragonfruit_flambe: { id: 'dragonfruit_flambe', name: 'Dragonfruit Flambé', category: 'food', price: 165000, exp: 15000,  desc: 'Set alight over a volcanic vent. Grants 15,000 EXP.' },
  phoenix_pepper:     { id: 'phoenix_pepper',     name: 'Phoenix Pepper',     category: 'food', price: 360000, exp: 30000,  desc: 'So hot it is said to bring the eater back to life. Grants 30,000 EXP.' },
  titan_broth:        { id: 'titan_broth',        name: 'Titan Broth',        category: 'food', price: 780000, exp: 60000,  desc: 'Simmered for a hundred days in a caldera. Grants 60,000 EXP.' },
  wildbound_ambrosia: { id: 'wildbound_ambrosia', name: 'Wildbound Ambrosia', category: 'food', price: 1800000, exp: 120000, desc: 'The food of legends. Grants 120,000 EXP — several levels even near the cap.' },

  vale_charm:  { id: 'vale_charm',  name: 'Vale Charm',  category: 'key', desc: 'Proof that the Verdant Guardian was bested. Opens the Verdant Gate.' },
  coast_pass:  { id: 'coast_pass',  name: 'Coast Pass',  category: 'key', desc: 'Granted at Tidecrest Port. Opens the Emberwild Gate.' },
  ember_sigil: { id: 'ember_sigil', name: 'Ember Sigil', category: 'key', desc: 'Awarded by the Flame Warden. Opens the Emberwild Pass to Stonehollow Crags.' },
  crag_seal:   { id: 'crag_seal',   name: 'Crag Seal',   category: 'key', desc: 'Proof that the Stone Warden of Stonehollow Crags was bested. Opens the Storm Gate to Stormreach Plateau.' },
  storm_sigil: { id: 'storm_sigil', name: 'Storm Sigil', category: 'key', desc: 'Awarded by the Storm Warden. Opens the Frost Gate to Frostveil Tundra.' },
  frost_sigil: { id: 'frost_sigil', name: 'Frost Sigil', category: 'key', desc: 'Awarded by the Frost Warden. Opens the Iron Gate to Ironhold Foundry.' },
  iron_sigil:  { id: 'iron_sigil',  name: 'Iron Sigil',  category: 'key', desc: 'Awarded by the Forge Warden. Opens the Mire Gate to Miremarsh Fen.' },
  mire_sigil:  { id: 'mire_sigil',  name: 'Mire Sigil',  category: 'key', desc: 'Awarded by the Plague Warden. Opens the Spire Gate to the Astral Spire.' },
  astral_crest:{ id: 'astral_crest',name: 'Astral Crest',category: 'key', desc: 'Awarded on the Astral Summit. Opens the Colosseum Gate to the Ironfist Colosseum.' },
  champion_belt:{ id: 'champion_belt',name: "Champion's Belt",category: 'key', desc: 'Won in the Grand Ring for beating every region of Wildbound. Proof you are the champion.' },
};

/** Item ids from earlier versions and what they became (applied when a save is loaded). */
export const LEGACY_ITEMS = { king_ball: 'god_ball' };

export const ITEM_CATEGORIES = [
  { id: 'balls',   name: 'Balls' },
  { id: 'healing', name: 'Healing' },
  { id: 'tonics',  name: 'Tonics' },
  { id: 'food',    name: 'Food' },
  { id: 'key',     name: 'Key Items' },
];

export const FOOD_IDS = Object.values(ITEMS).filter((i) => i.category === 'food').map((i) => i.id);

export const BALL_IDS = Object.values(ITEMS).filter((i) => i.category === 'balls').map((i) => i.id);

/** Ball tier = position in the catalogue (Basic 0 ... Dark 6). Legendaries need LEGENDARY_MIN_BALL_TIER or better. */
export function ballTier(id) { return BALL_IDS.indexOf(id); }
export const LEGENDARY_MIN_BALL = 'absolute_ball';
export function canHoldLegendary(ballId) { return ballTier(ballId) >= ballTier(LEGENDARY_MIN_BALL); }

export function getItem(id) {
  return ITEMS[id] || null;
}

/**
 * Shop stock. Nothing is unlimited any more: a restock brings `max` of an item
 * and only has a `chance` of including it at all, so the top-tier balls and the
 * best food are genuinely rare — a shop will often have none.
 * Staples come back in bulk; the expensive end does not.
 */
const STOCK_BANDS = [
  { under: 600,      max: 20, chance: 1.0 },
  { under: 2000,     max: 12, chance: 1.0 },
  { under: 6000,     max: 8,  chance: 1.0 },
  { under: 20000,    max: 5,  chance: 0.9 },
  { under: 100000,   max: 3,  chance: 0.75 },
  { under: 500000,   max: 2,  chance: 0.5 },
  { under: Infinity, max: 1,  chance: 0.3 },
];
const STOCK_OVERRIDES = {
  basic_ball: { max: 24 }, normal_ball: { max: 18 }, advanced_ball: { max: 12 }, absolute_ball: { max: 8 },
  god_ball: { max: 1, chance: 0.5 }, shiny_ball: { max: 1, chance: 0.25 }, dark_ball: { max: 1, chance: 0.2 },
};
/** @returns {{max:number, chance:number}} how much of `id` a restock brings, and how likely it is to bring any. */
export function shopStock(id) {
  const it = ITEMS[id];
  if (!it || !it.price) return { max: 0, chance: 0 };
  const band = STOCK_BANDS.find((b) => it.price < b.under) || STOCK_BANDS[STOCK_BANDS.length - 1];
  const over = STOCK_OVERRIDES[id] || {};
  return { max: over.max ?? band.max, chance: over.chance ?? band.chance };
}

export const STARTING_INVENTORY = {
  basic_ball: 8,
  normal_ball: 2,
  potion: 4,
  sweet_berry: 3,
};

export const STARTING_WILDCOINS = 900;
