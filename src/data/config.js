// Global tunables for the current version.
export const GAME_VERSION = '0.5.1';
export const SAVE_PREFIX = 'mythlings_wildbound';
export const SAVE_SLOT_COUNT = 3;

export const LEVEL_CAP = 100;         // live cap: every Mythling can reach Lv.100
export const ABSOLUTE_MAX_LEVEL = 100; // ceiling the data structures are built for

/** Rarity of the starter partner: always a top-tier S Mythling. */
export const STARTER_RARITY = 'S';
/**
 * Your first partner does not start from scratch: it joins at Lv.5 with its
 * Lv.1 skills already learned, so the first route is a warm-up rather than a
 * crawl. Captured Mythlings still ALWAYS reset to Lv.1 - that rule never moves.
 */
export const STARTER_LEVEL = 5;

export const PARTY_MAX = 6;
export const STORAGE_MAX = 200;

/**
 * How many Mythlings you can carry at once. You start on Bag 1 (20) and buy
 * bigger bags from the region shops; each shop only carries up to a certain
 * tier, so the biggest bags are spread across the later maps rather than all
 * sitting in the first shop. Capacity counts your party AND your storage.
 */
export const BAG_TIERS = [
  { tier: 1, name: 'Bag 1', capacity: 20,  price: 0 },        // the one you start with
  { tier: 2, name: 'Bag 2', capacity: 30,  price: 2500 },
  { tier: 3, name: 'Bag 3', capacity: 40,  price: 9000 },
  { tier: 4, name: 'Bag 4', capacity: 50,  price: 25000 },
  { tier: 5, name: 'Bag 5', capacity: 60,  price: 60000 },
  { tier: 6, name: 'Bag 6', capacity: 70,  price: 130000 },
  { tier: 7, name: 'Bag 7', capacity: 80,  price: 260000 },
  { tier: 8, name: 'Bag 8', capacity: 90,  price: 500000 },
  { tier: 9, name: 'Bag 9', capacity: 100, price: 900000 },
];
export const BAG_MAX_TIER = BAG_TIERS.length;
export function bagTier(tier) { return BAG_TIERS[Math.max(0, Math.min(BAG_TIERS.length - 1, (Number(tier) || 1) - 1))]; }
export function bagCapacity(tier) { return bagTier(tier).capacity; }
/** The cheapest bag that can hold `count` Mythlings — used when migrating older saves. */
export function bagTierFor(count) { return (BAG_TIERS.find((b) => b.capacity >= count) || BAG_TIERS[BAG_TIERS.length - 1]).tier; }

/**
 * Shops refill their shelves this often, so nothing can be farmed by standing
 * at the counter: cheap staples come back in bulk, the top-tier balls and the
 * best food arrive rarely and often not at all.
 */
export const SHOP_RESTOCK_MS = 5 * 60 * 1000;

export const ULTIMATE_UNLOCK_LEVEL = 10;
export const EVOLUTION_LEVELS = [1, 20, 60, 80];
/** Evolution stages the CURRENT build allows. Index into species.evolutions. */
export const MAX_UNLOCKED_EVOLUTION_STAGE = 3;
/**
 * The Lv.60 / Lv.80 evolutions, their skills and Ultimate tiers II / III are
 * flagged `future` in the data. With the cap at Lv.100 they are all reachable,
 * so they are live; flip this off to lock them again without editing data.
 */
export const FUTURE_CONTENT_LIVE = true;

export const COUNTER_MAX_PERCENT = 35; // Counter can never make something untouchable
/**
 * Counter is the EVASION stat. A miss should be a rare surprise, never a routine
 * annoyance: each point is now worth 0.15% dodge and the chance is hard-capped,
 * so even a maxed Counter (35) dodges only about 5% of hits.
 */
export const COUNTER_DODGE_SCALE = 0.15;
export const COUNTER_MAX_DODGE = 6;

/**
 * Crit Chance is a percentage, Crit Damage a BONUS percentage on top of the hit.
 * Both caps were lowered again: a crit should be a lucky spike, not a coin flip
 * that doubles the damage. Even a fully evolved Lv.100 Mythling now crits at most
 * one hit in ten, for at most +35% damage (x1.35).
 */
export const CRIT_MAX_PERCENT = 10;
export const CRIT_MAX_MULT = 35;

export const DAMAGE_RANDOM_MIN = 0.85;
export const DAMAGE_RANDOM_MAX = 1.0;
/**
 * Damage scaling on top of the stat ratio. Attack and Defense already grow with level
 * and evolution stage, so these stay gentle: the old 0.085/level × full stage multiplier
 * let two Lv.100 Mythlings one-shot each other and made "who moves first" the whole
 * fight. At Lv.100 / stage 4 the factor is now ~5 instead of ~20.7 — a neutral Special
 * takes about six hits to KO an equal foe, a super-effective one about four, and even
 * a super-effective Ultimate needs two or three.
 */
export const DAMAGE_LEVEL_SCALE = 0.03;
export const DAMAGE_STAGE_SCALE = 0.08;
/**
 * A small across-the-board bump for every regular skill (Normal / Special).
 * Deliberately gentle: it makes the moves you press all battle feel weightier
 * without undoing the "no one-shots at parity" rule. Ultimates are not affected
 * — they are tuned through ULTIMATE_POWER_SCALE instead.
 */
export const SKILL_POWER_SCALE = 1.12;
/**
 * Ultimates are a finisher, not a delete button: their listed tier power is scaled by
 * this before anything else.
 *
 * It used to be 0.7, which made an Ultimate *weaker* than the best Special at every
 * tier (tier I landed at 35 power against a 56-power Special), so charging to 8/8
 * felt pointless. 1.75 fixed that but overshot: measured across all 658
 * super-effective Lv.100 matchups, the MEDIAN full-charge Ultimate took 62% of an
 * equal foe's HP bar, and the median one CRIT for 84% — add two set-up buffs and
 * the average same-level fight ended in a single hit.
 *
 * At 1.25 the tiers land at 43 / 63 / 93 / 130 power (58 / 80 / 113 / 155 for the
 * legendary lines) — still roughly 2x the top Special, so a full charge is plainly
 * the biggest button you have. A super-effective Lv.100 Ultimate now takes about
 * 44% of an equal foe's bar (~2.3 hits, ~1,150 damage on a 2,600 HP Mythling),
 * 60% on a crit and 79% on a crit with set-up buffs. Strategy wins over damage:
 * one-shots are left to true glass cannons (~6% of matchups) instead of the average.
 */
export const ULTIMATE_POWER_SCALE = 1.25;

/**
 * Sleep can be re-applied, but the counter never climbs past this many turns —
 * a sleeping Mythling loses one whole turn per point.
 */
export const SLEEP_MAX_TURNS = 5;

/* ---------------------------------------------------------------------
   BURN & POISON — damage over time.
   Two riders, one shape: a flat tick that SCALES WITH THE TARGET'S LEVEL, so
   a burn set on a Lv.100 Mythling hurts far more than the same burn on a Lv.20
   one. That is the whole point: the number on the card is read against the foe
   in front of you, not against a flat wall.

   A status lasts DOT_MAX_TURNS and is refreshed, never stacked, so a second
   burn cannot double the tick. It ticks at the END of the round, after both
   Mythlings have acted, and it bypasses Guard: bracing stops a blow, not the
   fire that is already inside you.
   --------------------------------------------------------------------- */
export const DOT_MAX_TURNS = 10;          // Burn and Poison both cap here
/** Ticks at the end of a round, before the faint checks. */
export const DOT_TICK_PERCENT = 100;      // of the computed per-tick damage
/**
 * Per-tick damage = DOT_BASE + DOT_PER_LEVEL x target level. Deliberately
 * linear in the TARGET's level (not the attacker's): a status is worth more
 * against something that can survive it, and it keeps a late-game burn
 * meaningful without scaling into an instant knockout.
 */
export const DOT_BASE = 2;
export const DOT_PER_LEVEL = 0.55;

export const STAT_GROWTH = {
  // HP grows a little faster than the attacking stats, so fights get LONGER as levels rise, not shorter.
  hp: 0.105, patk: 0.075, satk: 0.075, pdef: 0.070, sdef: 0.070, spd: 0.060, counter: 0.035,
  crit: 0.006, critMult: 0.004,
};

/**
 * Rational (the second personality trait): a fixed +10 to one stat and -10 to
 * another, flat, on top of level growth, Mood, Rarity and mutation bonuses.
 */
export const RATIONAL_AMOUNT = 10;

/** Counter (evasion stat) -> actual dodge chance in percent. Single source of truth. */
export function counterDodgePercent(counter) {
  const v = (Number(counter) || 0) * COUNTER_DODGE_SCALE;
  return Math.max(0, Math.min(COUNTER_MAX_DODGE, v));
}

/** EXP needed to go from `level` to `level+1`. */
const STORY_CAP = 30;                                  // story content tops out here
const STORY_ANCHOR = 24 + 9 * Math.pow(STORY_CAP, 1.85);  // cost of Lv.30 -> 31

export function expToNextLevel(level) {
  if (level >= LEVEL_CAP) return Infinity;
  if (level <= STORY_CAP) return Math.floor(24 + 9 * Math.pow(level, 1.85));
  // Past the story cap the curve flattens to a straight line through the
  // Lv.30 anchor, so a level always costs roughly what a level-appropriate
  // battle pays out. Keeping the L^1.85 curve would ask for ~2,000 extra
  // battles to reach Lv.100; this asks for a long post-game grind instead.
  return Math.floor((STORY_ANCHOR * level) / STORY_CAP);
}

export function totalExpForLevel(level) {
  let t = 0;
  for (let l = 1; l < level; l++) t += expToNextLevel(l);
  return t;
}

/** EXP awarded for defeating an enemy. Scales down hard when heavily over-levelled. */
export function expReward({ enemyLevel, enemyYield, winnerLevel, isTrainer }) {
  const base = (enemyYield * enemyLevel) / 5.2;
  const diff = winnerLevel - enemyLevel;
  // over-levelling penalty (prevents farming weak areas forever)
  let scale = 1;
  if (diff > 0) scale = Math.max(0.12, 1 - diff * 0.075);
  else scale = Math.min(1.5, 1 + Math.abs(diff) * 0.04);
  const trainerBonus = isTrainer ? 1.6 : 1;
  return Math.max(1, Math.floor(base * scale * trainerBonus));
}

export const DEFEAT_COIN_PENALTY = 0.08; // lose 8% of Wildcoins when whited out

/**
 * Wildcoins dropped by a DEFEATED WILD Mythling (trainers pay their own reward).
 * Scales with the enemy's level and how much EXP it was worth, and falls off when
 * you are heavily over-levelled so low areas cannot be farmed forever.
 */
export function coinReward({ enemyLevel, enemyYield, winnerLevel }) {
  const diff = (winnerLevel ?? enemyLevel) - enemyLevel;
  let scale = 1;
  if (diff > 0) scale = Math.max(0.25, 1 - diff * 0.06);
  return Math.max(1, Math.floor((2.2 * enemyLevel + enemyYield * 0.55) * scale));
}

/** Overworld camera zoom limits: you can zoom in a fair bit, but never far enough out to see half the map. */
export const CAMERA_ZOOM_MIN = 1.1;
export const CAMERA_ZOOM_MAX = 1.8;
export const CAMERA_ZOOM_STEP = 0.05;

export const DEFAULT_SETTINGS = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.75,
  textSpeed: 'normal',      // slow | normal | fast | instant
  cameraZoom: 1.35,         // overworld camera zoom, CAMERA_ZOOM_MIN..CAMERA_ZOOM_MAX (this is a 2D game: no "sensitivity")
  fullscreen: false,
  graphicsQuality: 'high',  // low | medium | high
  screenShake: true,
  damageNumbers: true,
  tutorialHints: true,
  confirmImportantActions: true,
};
