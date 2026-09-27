// The Mythling model: creation, stats, EXP/leveling, skills, evolution eligibility.
import { getSpecies, getEvolutionStage, skillsUnlockedAt } from '../data/species.js';
import { getSkill, resolveUltimate, ULTIMATE_MAX_CHARGE } from '../data/skills.js';
import { moodModifiers, STAT_KEYS, MOOD_IDS } from '../data/moods.js';
import { rarityMagnitude, rollRarity } from '../data/rarity.js';
import { rollMutation } from '../data/mutations.js';
import {
  LEVEL_CAP, MAX_UNLOCKED_EVOLUTION_STAGE, STAT_GROWTH,
  expToNextLevel, ULTIMATE_UNLOCK_LEVEL, COUNTER_MAX_PERCENT,
  CRIT_MAX_PERCENT, CRIT_MAX_MULT,
} from '../data/config.js';
import { clamp, uid, choice } from './utils.js';

/** Stage a species should be at for a given level, limited by the build's unlocked stages. */
export function stageForLevel(speciesId, level) {
  const sp = getSpecies(speciesId);
  if (!sp) return 0;
  let stage = 0;
  sp.evolutions.forEach((ev, i) => {
    if (i <= MAX_UNLOCKED_EVOLUTION_STAGE && !ev.future && level >= ev.level) stage = i;
  });
  return stage;
}

export function createMythling(opts = {}) {
  const speciesId = opts.speciesId;
  const sp = getSpecies(speciesId);
  if (!sp) throw new Error(`Unknown species: ${speciesId}`);
  const rand = opts.rng || Math.random;

  const level = clamp(opts.level ?? 1, 1, LEVEL_CAP);
  const rarity = opts.rarity || (opts.rollRarity ? rollRarity(rand, opts.luck || 0) : sp.defaultRarity);
  const mood = opts.mood || (opts.randomMood ? choice(rand, MOOD_IDS) : sp.defaultMood);
  const mutation = opts.mutation || (opts.rollMutation ? rollMutation(rand, opts.mutationLuck || 1) : 'none');

  // Evolution stage: wild/trainer Mythlings appear at the stage matching their level.
  const stage = opts.stage != null ? opts.stage : stageForLevel(speciesId, level);

  const m = {
    uid: opts.uid || uid('myth'),
    speciesId,
    nickname: opts.nickname || null,
    level,
    exp: 0,
    stage,
    rarity,
    mood,
    mutation,
    currentHp: 0,
    ultCharge: 0,
    skills: { normal: null, special: null, buff: null },
    library: [],
    uses: {},
    meta: {
      caughtAt: opts.caughtAt || null,
      caughtWith: opts.caughtWith || null,
      caughtLevel: opts.caughtLevel || null,
      originMap: opts.originMap || null,
      isStarter: !!opts.isStarter,
    },
  };

  refreshLibrary(m);
  autoEquip(m);
  restoreAll(m);
  return m;
}

/** Learn every skill unlocked at/below the current level & stage. Never removes old skills. */
export function refreshLibrary(m) {
  const learned = skillsUnlockedAt(m.speciesId, m.level);
  // Evolution also grants its stage's skills even if the level table lags behind.
  const sp = getSpecies(m.speciesId);
  for (let i = 0; i <= m.stage; i++) {
    const lvlKey = sp.evolutions[i].level;
    (sp.skillUnlocks[lvlKey] || []).forEach((s) => learned.push(s));
  }
  for (const id of learned) {
    const sk = getSkill(id);
    if (!sk || sk.future) continue; // future-stage skills stay locked in this build
    if (!m.library.includes(id)) {
      m.library.push(id);
      if (m.uses[id] == null && Number.isFinite(sk.uses)) m.uses[id] = sk.uses;
    }
  }
  return m;
}

export function autoEquip(m) {
  const pick = (cat) => {
    const owned = m.library.map(getSkill).filter((s) => s && s.category === cat);
    if (!owned.length) return null;
    // prefer the strongest owned (later unlocks are stronger)
    owned.sort((a, b) => (b.power || 0) - (a.power || 0));
    return owned[0].id;
  };
  if (!m.skills.normal || !m.library.includes(m.skills.normal)) m.skills.normal = pick('normal');
  if (!m.skills.special || !m.library.includes(m.skills.special)) m.skills.special = pick('special');
  if (!m.skills.buff || !m.library.includes(m.skills.buff)) m.skills.buff = pick('buff');
  return m;
}

export function speciesOf(m) { return getSpecies(m.speciesId); }

export function stageData(m) { return getEvolutionStage(m.speciesId, m.stage); }

export function displayName(m) {
  return m.nickname || stageData(m).name;
}

export function formName(m) { return stageData(m).name; }

/** Full computed stats (species base -> level growth -> stage multiplier -> mood/rarity). */
export function computeStats(m) {
  const sp = speciesOf(m);
  const st = stageData(m);
  const mag = rarityMagnitude(m.rarity);
  const mods = moodModifiers(m.mood, mag);
  const out = {};
  for (const k of STAT_KEYS) {
    const base = sp.baseStats[k];
    const grown = base * (1 + STAT_GROWTH[k] * (m.level - 1));
    let v = Math.floor(grown * st.statMult) + (mods[k] || 0);
    if (k === 'counter') v = clamp(v, 0, COUNTER_MAX_PERCENT);
    if (k === 'crit') v = clamp(v, 0, CRIT_MAX_PERCENT);
    if (k === 'critMult') v = clamp(v, 0, CRIT_MAX_MULT);
    out[k] = Math.max(k === 'hp' ? 10 : 1, v);
  }
  return out;
}

export function maxHp(m) { return computeStats(m).hp; }

export function restoreAll(m) {
  m.currentHp = maxHp(m);
  m.ultCharge = 0;
  for (const id of m.library) {
    const sk = getSkill(id);
    if (sk && Number.isFinite(sk.uses)) m.uses[id] = sk.uses;
  }
  return m;
}

export function isFainted(m) { return m.currentHp <= 0; }

export function hpPercent(m) { return clamp(m.currentHp / maxHp(m), 0, 1); }

// ---------------- Ultimate ----------------

export function ultimateUnlocked(m) { return m.level >= ULTIMATE_UNLOCK_LEVEL; }

/** Ultimate tier index derived from the evolution stage (0 => base, 1 => " I", ...). */
export function ultimateTier(m) {
  return clamp(m.stage, 0, MAX_UNLOCKED_EVOLUTION_STAGE);
}

export function ultimateMove(m) {
  const sp = speciesOf(m);
  return resolveUltimate(sp.ultimate, ultimateTier(m));
}

export function ultimateReady(m) {
  return ultimateUnlocked(m) && m.ultCharge >= ULTIMATE_MAX_CHARGE;
}

export function addUltimateCharge(m, n = 1) {
  m.ultCharge = clamp(m.ultCharge + n, 0, ULTIMATE_MAX_CHARGE);
  return m.ultCharge;
}

// ---------------- EXP / levelling ----------------

export function expNeeded(m) { return expToNextLevel(m.level); }

export function isMaxLevel(m) { return m.level >= LEVEL_CAP; }

/**
 * Adds EXP with a hard stop at the level cap.
 * Returns { levels:[{level,gains,unlocks}], evolvedReady:bool, capped:bool }
 */
export function gainExp(m, amount) {
  const result = { gained: 0, levels: [], capped: false, evolutionReady: false, ultimateUnlocked: false };
  if (isMaxLevel(m)) { m.exp = 0; result.capped = true; return result; }
  let remaining = Math.max(0, Math.floor(amount));
  result.gained = remaining;
  while (remaining > 0) {
    if (isMaxLevel(m)) { m.exp = 0; result.capped = true; break; }
    const need = expNeeded(m) - m.exp;
    if (remaining < need) { m.exp += remaining; remaining = 0; break; }
    remaining -= need;
    const before = computeStats(m);
    m.level += 1;
    m.exp = 0;
    refreshLibrary(m);
    const after = computeStats(m);
    const gains = {};
    for (const k of STAT_KEYS) gains[k] = after[k] - before[k];
    // Level ups top up HP by the amount max HP grew.
    m.currentHp = Math.min(after.hp, m.currentHp + Math.max(0, gains.hp));
    const entry = { level: m.level, gains, milestones: [] };
    if (m.level === ULTIMATE_UNLOCK_LEVEL) { entry.milestones.push('ultimate'); result.ultimateUnlocked = true; }
    if (canEvolve(m)) { entry.milestones.push('evolution'); result.evolutionReady = true; }
    if (m.level >= LEVEL_CAP) { entry.milestones.push('maxlevel'); result.capped = true; }
    result.levels.push(entry);
  }
  if (isMaxLevel(m)) m.exp = 0;
  return result;
}

// ---------------- Evolution ----------------

export function nextEvolution(m) {
  const sp = speciesOf(m);
  const next = sp.evolutions[m.stage + 1];
  return next || null;
}

/** Can evolve right now in THIS build (Lv.60/80 stages stay locked). */
export function canEvolve(m) {
  const next = nextEvolution(m);
  if (!next) return false;
  if (m.stage + 1 > MAX_UNLOCKED_EVOLUTION_STAGE) return false;
  if (next.future) return false;
  return m.level >= next.level;
}

/** Info about the locked future stage, for UI display only. */
export function futureEvolutionInfo(m) {
  const sp = speciesOf(m);
  const list = [];
  for (let i = m.stage + 1; i < sp.evolutions.length; i++) {
    const ev = sp.evolutions[i];
    const locked = i > MAX_UNLOCKED_EVOLUTION_STAGE || !!ev.future;
    list.push({ name: ev.name, level: ev.level, locked, future: !!ev.future });
  }
  return list;
}

export function evolve(m) {
  if (!canEvolve(m)) return null;
  const from = stageData(m).name;
  const beforeStats = computeStats(m);
  m.stage += 1;
  refreshLibrary(m);
  autoEquip(m);
  const afterStats = computeStats(m);
  const gains = {};
  for (const k of STAT_KEYS) gains[k] = afterStats[k] - beforeStats[k];
  m.currentHp = Math.min(afterStats.hp, m.currentHp + Math.max(0, gains.hp));
  const sp = speciesOf(m);
  const newSkills = (sp.skillUnlocks[stageData(m).level] || []).filter((id) => {
    const s = getSkill(id); return s && !s.future;
  });
  return {
    from,
    to: stageData(m).name,
    gains,
    newSkills,
    ultimate: ultimateMove(m),
  };
}

// ---------------- Skills ----------------

export function equippedSkill(m, slot) {
  const id = m.skills[slot];
  return id ? getSkill(id) : null;
}

export function usesLeft(m, skillId) {
  const sk = getSkill(skillId);
  if (!sk) return 0;
  if (!Number.isFinite(sk.uses)) return Infinity;
  return m.uses[skillId] ?? 0;
}

export function consumeUse(m, skillId) {
  const sk = getSkill(skillId);
  if (!sk || !Number.isFinite(sk.uses)) return;
  m.uses[skillId] = Math.max(0, (m.uses[skillId] ?? sk.uses) - 1);
}

export function restoreUses(m, amount) {
  for (const id of m.library) {
    const sk = getSkill(id);
    if (sk && Number.isFinite(sk.uses)) m.uses[id] = Math.min(sk.uses, (m.uses[id] ?? 0) + amount);
  }
}

export function equipSkill(m, slot, skillId) {
  const sk = getSkill(skillId);
  if (!sk || sk.category !== slot) return false;
  if (!m.library.includes(skillId)) return false;
  m.skills[slot] = skillId;
  return true;
}

export function librarySkills(m, category = null) {
  return m.library.map(getSkill).filter((s) => s && (!category || s.category === category));
}

/** Resets a Mythling to Lv.1 on capture — THE core rule of Wildbound. */
export function resetToLevelOne(m) {
  m.level = 1;
  m.exp = 0;
  m.stage = 0;
  m.library = [];
  m.uses = {};
  m.skills = { normal: null, special: null, buff: null };
  refreshLibrary(m);
  autoEquip(m);
  restoreAll(m);
  return m;
}

export const MAX_CHARGE = ULTIMATE_MAX_CHARGE;
