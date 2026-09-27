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

  vale_charm:  { id: 'vale_charm',  name: 'Vale Charm',  category: 'key', desc: 'Proof that the Verdant Guardian was bested. Opens the Verdant Gate.' },
  coast_pass:  { id: 'coast_pass',  name: 'Coast Pass',  category: 'key', desc: 'Granted at Tidecrest Port. Opens the Emberwild Gate.' },
  ember_sigil: { id: 'ember_sigil', name: 'Ember Sigil', category: 'key', desc: 'Awarded for completing the current Emberwild challenge.' },
};

export const ITEM_CATEGORIES = [
  { id: 'balls',   name: 'Balls' },
  { id: 'healing', name: 'Healing' },
  { id: 'key',     name: 'Key Items' },
];

export const BALL_IDS = Object.values(ITEMS).filter((i) => i.category === 'balls').map((i) => i.id);

export function getItem(id) {
  return ITEMS[id] || null;
}

export const STARTING_INVENTORY = {
  basic_ball: 8,
  normal_ball: 2,
  potion: 4,
};

export const STARTING_WILDCOINS = 900;
