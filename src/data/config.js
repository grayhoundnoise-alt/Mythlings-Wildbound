// Global tunables for the current version.
export const GAME_VERSION = '0.3.0';
export const SAVE_PREFIX = 'mythlings_wildbound';
export const SAVE_SLOT_COUNT = 3;

export const LEVEL_CAP = 30;          // current live cap. Architecture supports raising this.
export const ABSOLUTE_MAX_LEVEL = 100; // ceiling the data structures are built for

export const PARTY_MAX = 6;
export const STORAGE_MAX = 200;

export const ULTIMATE_UNLOCK_LEVEL = 10;
export const EVOLUTION_LEVELS = [1, 20, 60, 80];
/** Evolution stages the CURRENT build allows. Index into species.evolutions. */
export const MAX_UNLOCKED_EVOLUTION_STAGE = 1;

export const COUNTER_MAX_PERCENT = 35; // Counter can never make something untouchable
export const DAMAGE_RANDOM_MIN = 0.85;
export const DAMAGE_RANDOM_MAX = 1.0;

export const STAT_GROWTH = {
  hp: 0.085, patk: 0.075, satk: 0.075, pdef: 0.070, sdef: 0.070, spd: 0.060, counter: 0.035,
};

/** EXP needed to go from `level` to `level+1`. */
export function expToNextLevel(level) {
  if (level >= LEVEL_CAP) return Infinity;
  return Math.floor(24 + 9 * Math.pow(level, 1.85));
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
