// Item + ball configuration. Names/prices/multipliers are all editable here,
// capture math never lives inside UI code.
export const ITEMS = {
  basic_ball:    { id: 'basic_ball',    name: 'Basic Ball',    category: 'balls',   price: 120,  catchMult: 1.00, desc: 'A simple binding sphere. Works best on weakened Mythlings.' },
  normal_ball:   { id: 'normal_ball',   name: 'Normal Ball',   category: 'balls',   price: 260,  catchMult: 1.25, desc: 'A refined ball with a stronger binding field.' },
  advanced_ball: { id: 'advanced_ball', name: 'Advanced Ball', category: 'balls',   price: 550,  catchMult: 1.50, desc: 'Crafted with coast crystal. Notably more reliable.' },
  absolute_ball: { id: 'absolute_ball', name: 'Absolute Ball', category: 'balls',   price: 1100, catchMult: 1.80, desc: 'An ember-forged ball for stubborn Mythlings.' },
  god_ball:      { id: 'god_ball',      name: 'God Ball',      category: 'balls',   price: 3000, catchMult: 2.50, desc: 'A legendary sphere. Almost never fails.' },

  potion:         { id: 'potion',         name: 'Potion',         category: 'healing', price: 150,  heal: 60,   desc: 'Restores 60 HP to one Mythling.' },
  greater_potion: { id: 'greater_potion', name: 'Greater Potion', category: 'healing', price: 380,  heal: 160,  desc: 'Restores 160 HP to one Mythling.' },
  revive_herb:    { id: 'revive_herb',    name: 'Revive Herb',    category: 'healing', price: 600,  revive: 0.5, desc: 'Revives a fainted Mythling with half HP.' },
  skill_tonic:    { id: 'skill_tonic',    name: 'Skill Tonic',    category: 'healing', price: 320,  restoreUses: 8, desc: 'Restores 8 uses to every limited skill.' },
  skill_elixir:   { id: 'skill_elixir',   name: 'Skill Elixir',   category: 'healing', price: 950,  restoreAllUses: true, desc: 'Resets every limited skill back to full uses.' },

  // ---- FOOD: feed a Mythling to train it faster (grants EXP directly) ----
  sweet_berry:  { id: 'sweet_berry',  name: 'Sweet Berry',  category: 'food', price: 90,   exp: 40,   desc: 'A sugary forest berry. Feeding it grants 40 EXP.' },
  honey_nut:    { id: 'honey_nut',    name: 'Honey Nut',    category: 'food', price: 240,  exp: 130,  desc: 'A sticky, energy-packed nut. Grants 130 EXP.' },
  river_jerky:  { id: 'river_jerky',  name: 'River Jerky',  category: 'food', price: 620,  exp: 400,  desc: 'Salt-cured coast fish. Grants 400 EXP.' },
  ember_roast:  { id: 'ember_roast',  name: 'Ember Roast',  category: 'food', price: 1400, exp: 1000, desc: 'Slow-roasted over volcanic vents. Grants 1000 EXP.' },
  mythic_feast: { id: 'mythic_feast', name: 'Mythic Feast', category: 'food', price: 3200, exp: 2600, desc: 'A legendary banquet for one. Grants 2600 EXP.' },

  vale_charm:  { id: 'vale_charm',  name: 'Vale Charm',  category: 'key', desc: 'Proof that the Verdant Guardian was bested. Opens the Verdant Gate.' },
  coast_pass:  { id: 'coast_pass',  name: 'Coast Pass',  category: 'key', desc: 'Granted at Tidecrest Port. Opens the Emberwild Gate.' },
  ember_sigil: { id: 'ember_sigil', name: 'Ember Sigil', category: 'key', desc: 'Awarded for completing the current Emberwild challenge.' },
};

export const ITEM_CATEGORIES = [
  { id: 'balls',   name: 'Balls' },
  { id: 'healing', name: 'Healing' },
  { id: 'food',    name: 'Food' },
  { id: 'key',     name: 'Key Items' },
];

export const FOOD_IDS = Object.values(ITEMS).filter((i) => i.category === 'food').map((i) => i.id);

export const BALL_IDS = Object.values(ITEMS).filter((i) => i.category === 'balls').map((i) => i.id);

export function getItem(id) {
  return ITEMS[id] || null;
}

export const STARTING_INVENTORY = {
  basic_ball: 8,
  normal_ball: 2,
  potion: 4,
  sweet_berry: 3,
};

export const STARTING_WILDCOINS = 900;
