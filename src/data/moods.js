// Mood system: each mood raises 3 stats and lowers 1.
// Magnitude comes from the RARITY table (see rarity.js) — Mood is deterministic & persistent.
export const STAT_KEYS = ['hp', 'patk', 'satk', 'pdef', 'sdef', 'spd', 'counter', 'crit', 'critMult'];

export const STAT_LABELS = {
  hp: 'HP',
  patk: 'Physical Attack',
  satk: 'Special Attack',
  pdef: 'Physical Defense',
  sdef: 'Special Defense',
  spd: 'Speed',
  counter: 'Counter',
  crit: 'Crit Chance',
  critMult: 'Crit Damage',
};

export const STAT_SHORT = {
  hp: 'HP', patk: 'P.ATK', satk: 'S.ATK', pdef: 'P.DEF', sdef: 'S.DEF', spd: 'SPD', counter: 'CNT',
  crit: 'CRIT', critMult: 'C.DMG',
};

/** One-line explanation of every stat, used by the detail panel and the Wiki. */
export const STAT_INFO = {
  hp: 'Hit Points. Reach 0 and the Mythling faints.',
  patk: 'Drives the damage of Physical skills (and how hard Physical hits land).',
  satk: 'Drives the damage of Special skills and every Ultimate.',
  pdef: 'Reduces incoming Physical damage.',
  sdef: 'Reduces incoming Special damage.',
  spd: 'Higher Speed acts first each turn — and helps you flee.',
  counter: 'Evasion. Each point is 0.5% dodge, capped at 18% (Counter caps at 35).',
  crit: 'Chance to land a critical hit, in percent (caps at 60%).',
  critMult: 'Bonus damage on a critical hit, in percent. +50% means a crit deals 1.5x (caps at +200%).',
};

/** Reference used for the stat bars in the detail panel. */
export const STAT_BAR_MAX = {
  hp: 600, patk: 90, satk: 90, pdef: 90, sdef: 90, spd: 90, counter: 35, crit: 60, critMult: 200,
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
  // ---- Crit moods (Crit Chance / Crit Damage) ----
  feral:     { id: 'feral',     name: 'Feral',     up: ['crit', 'critMult', 'patk'], down: 'sdef' },
  savage:    { id: 'savage',    name: 'Savage',    up: ['crit', 'patk', 'spd'],      down: 'pdef' },
  precise:   { id: 'precise',   name: 'Precise',   up: ['crit', 'critMult', 'satk'], down: 'hp' },
  brutal:    { id: 'brutal',    name: 'Brutal',    up: ['critMult', 'patk', 'satk'], down: 'sdef' },
  keen:      { id: 'keen',      name: 'Keen',      up: ['crit', 'spd', 'counter'],   down: 'pdef' },
};

export const MOOD_IDS = Object.keys(MOODS);

/** Moods that touch Crit Chance / Crit Damage (used by the Wiki). */
export const CRIT_MOOD_IDS = MOOD_IDS.filter((id) =>
  MOODS[id].up.includes('crit') || MOODS[id].up.includes('critMult'));

export function getMood(id) {
  return MOODS[id] || MOODS.brave;
}

// Some stats need a bigger swing than one point per magnitude to matter.
const MOOD_SCALE = { hp: 3, critMult: 2 };

/** Returns {hp:+n, patk:-n, ...} deltas for a mood at a given magnitude. */
export function moodModifiers(moodId, magnitude) {
  const mood = getMood(moodId);
  const out = {};
  for (const k of STAT_KEYS) out[k] = 0;
  // HP scales a bit harder so the bonus is meaningful on the HP pool.
  for (const k of mood.up) out[k] += magnitude * (MOOD_SCALE[k] || 1);
  out[mood.down] -= magnitude * (MOOD_SCALE[mood.down] || 1);
  return out;
}

export function moodSummary(moodId) {
  const m = getMood(moodId);
  return {
    up: m.up.map((k) => STAT_SHORT[k]),
    down: STAT_SHORT[m.down],
  };
}

/** Human-readable stat value: percentages get a unit, everything else is a plain number. */
export function formatStat(key, value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (key === 'crit') return `${value}%`;
  if (key === 'critMult') return `+${value}%`;
  if (key === 'counter') return String(value);
  return String(value);
}
