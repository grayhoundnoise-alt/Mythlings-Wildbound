// Mood system: each mood raises 3 stats and lowers 1.
// Magnitude comes from the RARITY table (see rarity.js) — Mood is deterministic & persistent.
export const STAT_KEYS = ['hp', 'patk', 'satk', 'pdef', 'sdef', 'spd', 'counter'];

export const STAT_LABELS = {
  hp: 'HP',
  patk: 'Physical Attack',
  satk: 'Special Attack',
  pdef: 'Physical Defense',
  sdef: 'Special Defense',
  spd: 'Speed',
  counter: 'Counter',
};

export const STAT_SHORT = {
  hp: 'HP', patk: 'P.ATK', satk: 'S.ATK', pdef: 'P.DEF', sdef: 'S.DEF', spd: 'SPD', counter: 'CNT',
};

export const MOODS = {
  lazy:      { id: 'lazy',      name: 'Lazy',      up: ['hp', 'pdef', 'sdef'],     down: 'spd' },
  energetic: { id: 'energetic', name: 'Energetic', up: ['patk', 'satk', 'spd'],    down: 'sdef' },
  aggressive:{ id: 'aggressive',name: 'Aggressive',up: ['patk', 'spd', 'counter'], down: 'sdef' },
  clever:    { id: 'clever',    name: 'Clever',    up: ['satk', 'sdef', 'counter'],down: 'patk' },
  sturdy:    { id: 'sturdy',    name: 'Sturdy',    up: ['hp', 'pdef', 'sdef'],     down: 'satk' },
  swift:     { id: 'swift',     name: 'Swift',     up: ['spd', 'counter', 'sdef'], down: 'hp' },
  brave:     { id: 'brave',     name: 'Brave',     up: ['hp', 'patk', 'counter'],  down: 'sdef' },
  focused:   { id: 'focused',   name: 'Focused',   up: ['patk', 'satk', 'spd'],    down: 'hp' },
  guarded:   { id: 'guarded',   name: 'Guarded',   up: ['hp', 'pdef', 'sdef'],     down: 'counter' },
  reckless:  { id: 'reckless',  name: 'Reckless',  up: ['patk', 'satk', 'spd'],    down: 'pdef' },
  playful:   { id: 'playful',   name: 'Playful',   up: ['spd', 'counter', 'satk'], down: 'pdef' },
  calm:      { id: 'calm',      name: 'Calm',      up: ['hp', 'sdef', 'counter'],  down: 'patk' },
  stubborn:  { id: 'stubborn',  name: 'Stubborn',  up: ['hp', 'patk', 'pdef'],     down: 'spd' },
  ambitious: { id: 'ambitious', name: 'Ambitious', up: ['patk', 'satk', 'counter'],down: 'hp' },
  cautious:  { id: 'cautious',  name: 'Cautious',  up: ['pdef', 'sdef', 'counter'],down: 'patk' },
  fierce:    { id: 'fierce',    name: 'Fierce',    up: ['hp', 'patk', 'spd'],      down: 'counter' },
};

export const MOOD_IDS = Object.keys(MOODS);

export function getMood(id) {
  return MOODS[id] || MOODS.brave;
}

/** Returns {hp:+n, patk:-n, ...} deltas for a mood at a given magnitude. */
export function moodModifiers(moodId, magnitude) {
  const mood = getMood(moodId);
  const out = {};
  for (const k of STAT_KEYS) out[k] = 0;
  // HP scales a bit harder so the bonus is meaningful on the HP pool.
  for (const k of mood.up) out[k] += (k === 'hp' ? magnitude * 3 : magnitude);
  out[mood.down] -= (mood.down === 'hp' ? magnitude * 3 : magnitude);
  return out;
}

export function moodSummary(moodId) {
  const m = getMood(moodId);
  return {
    up: m.up.map((k) => STAT_SHORT[k]),
    down: STAT_SHORT[m.down],
  };
}
