// Global tunables for the current version.
export const GAME_VERSION = '0.3.0';
export const SAVE_PREFIX = 'mythlings_wildbound';
export const SAVE_SLOT_COUNT = 3;

export const LEVEL_CAP = 100;         // live cap: every Mythling can reach Lv.100
export const ABSOLUTE_MAX_LEVEL = 100; // ceiling the data structures are built for

/** Rarity of the starter partner: always a top-tier S Mythling. */
export const STARTER_RARITY = 'S';

export const PARTY_MAX = 6;
export const STORAGE_MAX = 200;

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
 * Counter is the EVASION stat: every point of Counter used to be a full 1% dodge,
 * which made attacks miss far too often. Each point is now worth half a percent and
 * the dodge chance is hard-capped, so a maxed Counter dodges 18% of hits, not 35%.
 */
export const COUNTER_DODGE_SCALE = 0.5;
export const COUNTER_MAX_DODGE = 18;

/** Crit Chance is a percentage (0-60). Crit Damage is a BONUS percentage (0-200 => up to x3). */
export const CRIT_MAX_PERCENT = 60;
export const CRIT_MAX_MULT = 200;

export const DAMAGE_RANDOM_MIN = 0.85;
export const DAMAGE_RANDOM_MAX = 1.0;

export const STAT_GROWTH = {
  hp: 0.085, patk: 0.075, satk: 0.075, pdef: 0.070, sdef: 0.070, spd: 0.060, counter: 0.035,
  crit: 0.030, critMult: 0.008,
};

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

export const DEFAULT_SETTINGS = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.75,
  textSpeed: 'normal',      // slow | normal | fast | instant
  cameraSensitivity: 1.0,
  fullscreen: false,
  graphicsQuality: 'high',  // low | medium | high
  screenShake: true,
  damageNumbers: true,
  tutorialHints: true,
  confirmImportantActions: true,
};
