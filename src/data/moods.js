// Personality traits: MOOD (one stat up, magnitude from the RARITY table) and
// RATIONAL (+10 / -10 on two stats). Both are deterministic & persistent, and both
// can be re-rolled with shop tonics.
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
  counter: 'Evasion. Each point is 0.15% dodge, capped at 6% — a miss is rare (Counter caps at 35).',
  crit: 'Chance to land a critical hit, in percent (caps at 25% — a crit stays special even at Lv.100).',
  critMult: 'Bonus damage on a critical hit, in percent. +50% means a crit deals 1.5x (caps at +200%).',
};

/** Reference used for the stat bars in the detail panel. */
export const STAT_BAR_MAX = {
  hp: 600, patk: 90, satk: 90, pdef: 90, sdef: 90, spd: 90, counter: 35, crit: 25, critMult: 200,
};

// Mood: a purely POSITIVE trait. Every Mood boosts exactly ONE stat, so the nine
// Moods cover every stat there is — nothing is hidden behind a lucky combination.
// The old "three up, one down" Moods are gone: the DOWNSIDE now lives in the
// separate Rational trait (see RATIONALS below), which stacks on top of the Mood.
export const MOODS = {
  sturdy: { id: 'sturdy', name: 'Sturdy', up: ['hp'],       desc: 'Thick-skinned and hard to put down. Boosts HP.' },
  brave:  { id: 'brave',  name: 'Brave',  up: ['patk'],     desc: 'Charges in first. Boosts Physical Attack.' },
  clever: { id: 'clever', name: 'Clever', up: ['satk'],     desc: 'Thinks three moves ahead. Boosts Special Attack.' },
  guarded:{ id: 'guarded',name: 'Guarded',up: ['pdef'],     desc: 'Never drops its guard. Boosts Physical Defense.' },
  calm:   { id: 'calm',   name: 'Calm',   up: ['sdef'],     desc: 'Unshaken by tricks and magic. Boosts Special Defense.' },
  swift:  { id: 'swift',  name: 'Swift',  up: ['spd'],      desc: 'Always a step ahead. Boosts Speed.' },
  agile:  { id: 'agile',  name: 'Agile',  up: ['counter'],  desc: 'Slips out of harm\'s way. Boosts Counter (evasion).' },
  keen:   { id: 'keen',   name: 'Keen',   up: ['crit'],     desc: 'Finds every weak spot. Boosts Crit Chance.' },
  brutal: { id: 'brutal', name: 'Brutal', up: ['critMult'], desc: 'Makes every opening count. Boosts Crit Damage.' },
};

export const MOOD_IDS = Object.keys(MOODS);

/** Moods that touch Crit Chance / Crit Damage (used by the Wiki). */
export const CRIT_MOOD_IDS = MOOD_IDS.filter((id) =>
  MOODS[id].up.includes('crit') || MOODS[id].up.includes('critMult'));

/**
 * Moods from earlier versions (three up stats, one down) map onto the new
 * single-stat Mood that boosts their FIRST up stat, so old saves keep a
 * sensible personality instead of resetting to Brave.
 */
const LEGACY_MOODS = {
  lazy: 'sturdy', energetic: 'brave', aggressive: 'brave', focused: 'brave', reckless: 'brave', stubborn: 'sturdy',
  fierce: 'sturdy', ambitious: 'brave', cautious: 'guarded', playful: 'swift', feral: 'keen', savage: 'keen',
  precise: 'keen',
};

export function normalizeMoodId(id) {
  if (MOODS[id]) return id;
  return LEGACY_MOODS[id] || 'brave';
}

export function getMood(id) {
  return MOODS[normalizeMoodId(id)];
}

// A single-stat Mood swings harder than one point per magnitude: the whole bonus
// that used to be spread over three stats now lands on one.
const MOOD_SCALE = { hp: 6, critMult: 4 };
const MOOD_BASE = 2;

/** Returns {hp:+n, patk:+n, ...} deltas for a mood at a given magnitude (never negative). */
export function moodModifiers(moodId, magnitude) {
  const mood = getMood(moodId);
  const out = {};
  for (const k of STAT_KEYS) out[k] = 0;
  for (const k of mood.up) out[k] += magnitude * MOOD_BASE * (MOOD_SCALE[k] || 1);
  return out;
}

// =============================================================================
// RATIONAL — the second personality trait. Every Rational is a fixed +10 to one
// of the six main stats and a fixed -10 to another (never HP-neutral: exactly one
// pair). It stacks with Mood, Rarity and mutation bonuses. All 30 possible pairs
// exist, so any stat can be traded for any other.
// =============================================================================
export const RATIONAL_STATS = ['hp', 'patk', 'satk', 'pdef', 'sdef', 'spd'];

const RATIONAL_NAMES = {
  hp:   { patk: 'Placid',  satk: 'Docile',  pdef: 'Hearty',   sdef: 'Rugged',  spd: 'Stoic' },
  patk: { hp: 'Reckless',  satk: 'Brash',   pdef: 'Bold',     sdef: 'Fierce',  spd: 'Mighty' },
  satk: { hp: 'Frail',     patk: 'Mystic',  pdef: 'Arcane',   sdef: 'Cunning', spd: 'Pensive' },
  pdef: { hp: 'Stony',     patk: 'Steady',  satk: 'Stubborn', sdef: 'Ironclad',spd: 'Lax' },
  sdef: { hp: 'Wary',      patk: 'Serene',  satk: 'Careful',  pdef: 'Gentle',  spd: 'Patient' },
  spd:  { hp: 'Hasty',     patk: 'Nimble',  satk: 'Jolly',    pdef: 'Flighty', sdef: 'Naive' },
};

export const RATIONALS = {};
for (const up of RATIONAL_STATS) {
  for (const down of RATIONAL_STATS) {
    if (up === down) continue;
    const name = RATIONAL_NAMES[up][down];
    const id = name.toLowerCase();
    RATIONALS[id] = { id, name, up, down };
  }
}
export const RATIONAL_IDS = Object.keys(RATIONALS);

export function getRational(id) {
  return RATIONALS[id] || null;
}

/** Returns {hp:+10, spd:-10, ...} for a rational; every other stat is 0. */
export function rationalModifiers(rationalId, amount = 10) {
  const out = {};
  for (const k of STAT_KEYS) out[k] = 0;
  const r = getRational(rationalId);
  if (!r) return out;
  out[r.up] += amount;
  out[r.down] -= amount;
  return out;
}

export function rationalSummary(rationalId) {
  const r = getRational(rationalId);
  if (!r) return { name: 'None', up: '—', down: '—' };
  return { name: r.name, up: STAT_SHORT[r.up], down: STAT_SHORT[r.down] };
}

/** A random Rational id (uniform over all 30 pairs). */
export function rollRational(rng = Math.random) {
  return RATIONAL_IDS[Math.floor(rng() * RATIONAL_IDS.length)] || RATIONAL_IDS[0];
}

/** A random Rational different from the current one (used by the Temper Tonic). */
export function rerollRational(current, rng = Math.random) {
  if (RATIONAL_IDS.length < 2) return RATIONAL_IDS[0];
  let next = current;
  while (next === current) next = rollRational(rng);
  return next;
}

/** A random Mood different from the current one (used by the Mood Tonic). */
export function rerollMood(current, rng = Math.random) {
  let next = current;
  while (next === current) next = MOOD_IDS[Math.floor(rng() * MOOD_IDS.length)];
  return next;
}

export function moodSummary(moodId) {
  const m = getMood(moodId);
  return {
    up: m.up.map((k) => STAT_SHORT[k]),
    down: null,   // Moods no longer lower anything — the downside is the Rational trait
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
