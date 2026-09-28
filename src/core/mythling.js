// The Mythling model: creation, stats, EXP/leveling, skills, evolution eligibility.
import { getSpecies, getEvolutionStage, skillsUnlockedAt, skillLearnLevel } from '../data/species.js';
import { getSkill, resolveUltimate, skillStrength, ULTIMATE_MAX_CHARGE } from '../data/skills.js';
import { moodModifiers, STAT_KEYS, MOOD_IDS, normalizeMoodId, rationalModifiers, rollRational, rerollRational as rerollRationalId, rerollMood as rerollMoodId, getRational } from '../data/moods.js';
import { rarityMagnitude, rollRarity } from '../data/rarity.js';
import { rollMutation, getMutation } from '../data/mutations.js';
import {
  LEVEL_CAP, MAX_UNLOCKED_EVOLUTION_STAGE, FUTURE_CONTENT_LIVE, STAT_GROWTH,
  expToNextLevel, ULTIMATE_UNLOCK_LEVEL, COUNTER_MAX_PERCENT,
  CRIT_MAX_PERCENT, CRIT_MAX_MULT, RATIONAL_AMOUNT,
  EVOLUTION_LEVELS,
} from '../data/config.js';
import { clamp, uid, choice } from './utils.js';

/** Stage a species should be at for a given level, limited by the build's unlocked stages. */
export function stageForLevel(speciesId, level) {
  const sp = getSpecies(speciesId);
  if (!sp) return 0;
  let stage = 0;
  sp.evolutions.forEach((ev, i) => {
    if (i <= MAX_UNLOCKED_EVOLUTION_STAGE && (FUTURE_CONTENT_LIVE || !ev.future) && level >= ev.level) stage = i;
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
  const mood = normalizeMoodId(opts.mood || (opts.randomMood ? choice(rand, MOOD_IDS) : sp.defaultMood));
  const mutation = opts.mutation || (opts.rollMutation ? rollMutation(rand, opts.mutationLuck || 1) : 'none');
  // Rational: the +10 / -10 trait. Always rolled (there is no "neutral" Rational).
  const rational = getRational(opts.rational) ? opts.rational : rollRational(rand);

  // Evolution stage: wild/trainer Mythlings appear at the stage matching their level.
  // (Legendaries have a single form, so any requested stage collapses to 0.)
  const stage = clamp(opts.stage != null ? opts.stage : stageForLevel(speciesId, level), 0, sp.evolutions.length - 1);

  const m = {
    uid: opts.uid || uid('myth'),
    speciesId,
    nickname: opts.nickname || null,
    level,
    exp: 0,
    stage,
    rarity,
    mood,
    rational,
    mutation,
    currentHp: 0,
    ultCharge: 0,
    skills: [],                       // ordered: index = battle button (max MAX_EQUIPPED_SKILLS)
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
  for (let i = 0; i <= Math.min(m.stage, sp.evolutions.length - 1); i++) {
    const lvlKey = sp.evolutions[i].level;
    (sp.skillUnlocks[lvlKey] || []).forEach((s) => learned.push(s));
  }
  for (const id of learned) {
    const sk = getSkill(id);
    if (!sk || (!FUTURE_CONTENT_LIVE && sk.future)) continue; // future-stage skills stay locked unless the cap allows them
    if (!m.library.includes(id)) {
      m.library.push(id);
      if (m.uses[id] == null && Number.isFinite(sk.uses)) m.uses[id] = sk.uses;
    }
  }
  return m;
}

/** How many skills a Mythling can take into battle (one battle button each). */
export const MAX_EQUIPPED_SKILLS = 3;

/**
 * Fill the empty battle buttons: strongest Normal, strongest Special, then the
 * strongest stat skill (Buff or Debuff — whichever changes a stat the most,
 * Buff on a tie). Skills the player already equipped keep their button; only
 * empty buttons are filled, so a deliberate empty slot survives (the callers
 * decide when to auto-fill: creation, capture, evolution, old saves).
 */
export function autoEquip(m) {
  if (!Array.isArray(m.skills)) m.skills = normalizeEquipped(m.skills);
  m.skills = m.skills.filter((id) => id && m.library.includes(id) && getSkill(id));
  const owned = (cat) => m.library.map(getSkill).filter((s) => s && s.category === cat && !m.skills.includes(s.id));
  const strongest = (cat) => {
    const list = owned(cat);
    if (!list.length) return null;
    list.sort((a, b) => skillStrength(b) - skillStrength(a));   // later unlocks are stronger
    return list[0];
  };
  const pick = (cats) => {
    const best = cats.map(strongest).filter(Boolean).sort((a, b) => skillStrength(b) - skillStrength(a))[0];
    if (best && m.skills.length < MAX_EQUIPPED_SKILLS) m.skills.push(best.id);
  };
  pick(['normal']);
  pick(['special']);
  pick(['buff', 'debuff']);
  // still room (e.g. a species that lacks a category)? take the strongest of anything
  while (m.skills.length < MAX_EQUIPPED_SKILLS) {
    const rest = m.library.map(getSkill).filter((s) => s && !m.skills.includes(s.id));
    if (!rest.length) break;
    rest.sort((a, b) => skillStrength(b) - skillStrength(a));
    m.skills.push(rest[0].id);
  }
  return m;
}

/**
 * Accept every shape `skills` has ever been saved in and return the ordered
 * array: the old `{normal, special, buff}` object becomes [normal, special, buff].
 */
export function normalizeEquipped(raw) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === 'object') list = ['normal', 'special', 'buff'].map((k) => raw[k]);
  const out = [];
  for (const id of list) {
    if (typeof id === 'string' && id && !out.includes(id)) out.push(id);
  }
  return out.slice(0, MAX_EQUIPPED_SKILLS);
}

export function speciesOf(m) { return getSpecies(m.speciesId); }

export function stageData(m) { return getEvolutionStage(m.speciesId, m.stage); }

export function displayName(m) {
  return m.nickname || stageData(m).name;
}

export function formName(m) { return stageData(m).name; }

/**
 * Full computed stats: species base -> level growth -> stage multiplier ->
 * Mood (x rarity magnitude) -> Rational (+10 / -10) -> caps -> mutation bonus.
 */
export function computeStats(m) {
  const sp = speciesOf(m);
  const st = stageData(m);
  const mag = rarityMagnitude(m.rarity);
  const mods = moodModifiers(m.mood, mag);
  const rat = rationalModifiers(m.rational, RATIONAL_AMOUNT);
  const out = {};
  // Shiny +1 and Darkness +2 to every stat, added AFTER the caps so the bonus
  // is never swallowed by them.
  const mutBonus = getMutation(m.mutation).statBonus || 0;
  for (const k of STAT_KEYS) {
    const base = sp.baseStats[k];
    const grown = base * (1 + STAT_GROWTH[k] * (m.level - 1));
    let v = Math.floor(grown * st.statMult) + (mods[k] || 0) + (rat[k] || 0);
    if (k === 'counter') v = clamp(v, 0, COUNTER_MAX_PERCENT);
    if (k === 'crit') v = clamp(v, 0, CRIT_MAX_PERCENT);
    if (k === 'critMult') v = clamp(v, 0, CRIT_MAX_MULT);
    v += mutBonus;
    out[k] = Math.max(k === 'hp' ? 10 : 1, v);
  }
  return out;
}

/**
 * Where each of a Mythling's CURRENT stats comes from: the level-and-stage
 * growth, the Mood bonus (scaled by its Rarity tier), the Rational's +10 / -10
 * and the Shiny / Darkness bonus. Drives the battle type sheet's SEE MORE panel.
 * @returns {Array<{key:string,total:number,grown:number,mood:number,rational:number,mutation:number,rarityMag:number}>}
 */
export function statBreakdown(m) {
  const sp = speciesOf(m);
  const st = stageData(m);
  const mag = rarityMagnitude(m.rarity);
  const mods = moodModifiers(m.mood, mag);
  const rat = rationalModifiers(m.rational, RATIONAL_AMOUNT);
  const mutBonus = getMutation(m.mutation).statBonus || 0;
  const stats = computeStats(m);
  return STAT_KEYS.map((k) => ({
    key: k,
    total: stats[k],
    grown: Math.floor(sp.baseStats[k] * (1 + STAT_GROWTH[k] * (m.level - 1)) * st.statMult),
    mood: mods[k] || 0,
    rational: rat[k] || 0,
    mutation: mutBonus,
    rarityMag: mag,
  }));
}

export function maxHp(m) { return computeStats(m).hp; }

/** Re-roll the Mood into a different one (Mood Tonic). Current HP is kept in proportion. */
export function rerollMood(m, rng = Math.random) {
  const before = m.mood;
  const ratio = maxHp(m) > 0 ? m.currentHp / maxHp(m) : 1;
  m.mood = rerollMoodId(normalizeMoodId(m.mood), rng);
  m.currentHp = Math.max(m.currentHp > 0 ? 1 : 0, Math.round(maxHp(m) * ratio));
  return { before, after: m.mood };
}

/** Re-roll the Rational into a different one (Temper Tonic). Current HP is kept in proportion. */
export function rerollRational(m, rng = Math.random) {
  const before = m.rational;
  const ratio = maxHp(m) > 0 ? m.currentHp / maxHp(m) : 1;
  m.rational = rerollRationalId(m.rational, rng);
  m.currentHp = Math.max(m.currentHp > 0 ? 1 : 0, Math.round(maxHp(m) * ratio));
  return { before, after: m.rational };
}

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
  const sp = speciesOf(m);
  // Legendaries never evolve: their Ultimate tiers unlock by LEVEL instead (the same
  // Lv.20 / 60 / 80 thresholds at which other species evolve).
  if (sp && sp.evolutions.length === 1) {
    let tier = 0;
    EVOLUTION_LEVELS.forEach((lv, i) => { if (i > 0 && m.level >= lv) tier = i; });
    return clamp(tier, 0, MAX_UNLOCKED_EVOLUTION_STAGE);
  }
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
  if (!FUTURE_CONTENT_LIVE && next.future) return false;
  return m.level >= next.level;
}

/** Info about the locked future stage, for UI display only. */
export function futureEvolutionInfo(m) {
  const sp = speciesOf(m);
  const list = [];
  for (let i = m.stage + 1; i < sp.evolutions.length; i++) {
    const ev = sp.evolutions[i];
    const locked = i > MAX_UNLOCKED_EVOLUTION_STAGE || (!FUTURE_CONTENT_LIVE && !!ev.future);
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
    const s = getSkill(id); return s && (FUTURE_CONTENT_LIVE || !s.future);
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

/** The skill on battle button `index` (0-based), or null when that button is empty. */
export function equippedSkill(m, index) {
  const id = Array.isArray(m.skills) ? m.skills[index] : null;
  return id ? getSkill(id) : null;
}

/** Every equipped skill in button order, as `{ index, id, skill }`. */
export function equippedSkills(m) {
  const out = [];
  (Array.isArray(m.skills) ? m.skills : []).forEach((id, index) => {
    const skill = getSkill(id);
    if (skill) out.push({ index, id, skill });
  });
  return out;
}

/** Index of an equipped skill (0-based), or -1. */
export function equippedIndex(m, skillId) {
  return Array.isArray(m.skills) ? m.skills.indexOf(skillId) : -1;
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

/**
 * Equip a skill. There are no slot types: any learned skill can be equipped,
 * up to MAX_EQUIPPED_SKILLS at a time, and the ORDER you equip them in is the
 * order of the battle buttons (first equipped = leftmost). Pass `index` to put
 * the skill on a specific button instead (replacing what was there).
 * Returns true when the loadout changed.
 */
export function equipSkill(m, skillId, index = null) {
  if (!skillId || !getSkill(skillId)) return false;
  if (!m.library.includes(skillId)) return false;
  if (!Array.isArray(m.skills)) m.skills = normalizeEquipped(m.skills);
  if (m.skills.includes(skillId)) return false;               // already on a button
  if (Number.isInteger(index) && index >= 0 && index < MAX_EQUIPPED_SKILLS) {
    if (index < m.skills.length) m.skills[index] = skillId;
    else m.skills.push(skillId);
    return true;
  }
  if (m.skills.length >= MAX_EQUIPPED_SKILLS) return false;    // full: unequip one first
  m.skills.push(skillId);
  return true;
}

/** Is there a free battle button left? */
export function canEquipMore(m) {
  return (Array.isArray(m.skills) ? m.skills.length : 0) < MAX_EQUIPPED_SKILLS;
}

/**
 * Unequip a skill (by id or by button index). The remaining skills close the
 * gap and keep their relative order. Leaving buttons empty is allowed —
 * nothing refills them for you.
 */
export function unequipSkill(m, skillOrIndex) {
  if (!Array.isArray(m.skills)) m.skills = normalizeEquipped(m.skills);
  const idx = Number.isInteger(skillOrIndex) ? skillOrIndex : m.skills.indexOf(skillOrIndex);
  if (idx < 0 || idx >= m.skills.length) return false;
  m.skills.splice(idx, 1);
  return true;
}

/** Swap two battle buttons (re-order without unequipping). */
export function moveSkill(m, from, to) {
  if (!Array.isArray(m.skills)) return false;
  if (from === to || from < 0 || to < 0 || from >= m.skills.length || to >= m.skills.length) return false;
  const [id] = m.skills.splice(from, 1);
  m.skills.splice(to, 0, id);
  return true;
}

/**
 * The attack a Mythling falls back on when every equipped skill is out of
 * uses: its own unlimited Normal move if it knows one, otherwise any skill
 * with uses left, otherwise a universal Struggle. A turn is never wasted.
 */
export function basicAttack(m) {
  const known = (m.library || []).map(getSkill).filter(Boolean);
  // strongest unlimited Normal move it has learned (evolutions teach better ones)
  const infinite = known
    .filter((sk) => sk.category === 'normal' && !Number.isFinite(sk.uses))
    .sort((a, b) => (b.power || 0) - (a.power || 0))[0];
  if (infinite) return infinite;
  const usable = known.find((sk) => Number.isFinite(sk.uses) && (m.uses?.[sk.id] ?? 0) > 0);
  if (usable) return usable;
  return getSkill('struggle');
}

export function librarySkills(m, category = null) {
  return m.library.map(getSkill).filter((s) => s && (!category || s.category === category));
}

/**
 * The Skill Library the way the player browses it: every learned skill in
 * unlock order (the level this species learns it at), weaker before stronger
 * within the same level. Each entry is `{ skill, level, index }` where `index`
 * is the battle button it sits on (or -1).
 */
export function libraryByLevel(m) {
  return librarySkills(m)
    .map((skill) => ({ skill, level: skillLearnLevel(m.speciesId, skill.id) ?? 1, index: equippedIndex(m, skill.id) }))
    .sort((a, b) => a.level - b.level || skillStrength(a.skill) - skillStrength(b.skill) || a.skill.name.localeCompare(b.skill.name));
}

// ---------------- Items ----------------

/**
 * Apply a healing-category item to a Mythling. One routine for the bag and for
 * battle, and it honours EVERY effect the item carries (heal / healFull /
 * revive / restoreUses / restoreAllUses) so combo items like Full Restore work.
 * With `dryRun` nothing is changed — it only reports what WOULD happen, which
 * lets the UI refuse to consume an item that would do nothing.
 * @returns {{ ok:boolean, reason:string|null, healed:number, revived:boolean, usesRestored:boolean }}
 */
export function applyItemEffects(item, m, { dryRun = false } = {}) {
  const out = { ok: false, reason: null, healed: 0, revived: false, usesRestored: false };
  if (!item || !m) { out.reason = 'Nothing to use.'; return out; }
  // Battle-only items work on the combatant, not on the Mythling: applyItemEffects
  // cannot see a battle's debuffs, so it refuses them instead of wasting the item.
  if (item.cleanse) { out.reason = `${item.name} only works in battle — on a Mythling that is debuffed.`; return out; }
  const wantsHp = !!(item.heal || item.healFull || item.revive);
  const wantsUses = !!(item.restoreUses || item.restoreAllUses);
  if (!wantsHp && !wantsUses) { out.reason = `${item.name || 'That item'} cannot be used on a Mythling.`; return out; }

  const fainted = isFainted(m);
  const mx = maxHp(m);
  let hp = Math.max(0, m.currentHp);
  if (item.revive) {
    if (!fainted) { out.reason = `${displayName(m)} does not need reviving.`; return out; }
    hp = Math.max(1, Math.floor(mx * item.revive));
    out.revived = true;
  } else if ((item.heal || item.healFull) && fainted) {
    out.reason = `${displayName(m)} has fainted — use a Revive Herb or Max Revive.`;
    return out;
  }
  if (item.healFull) hp = mx;
  else if (item.heal) hp = Math.min(mx, hp + item.heal);
  out.healed = Math.max(0, hp - Math.max(0, m.currentHp));

  const nextUses = {};
  for (const id of m.library || []) {
    const sk = getSkill(id);
    if (!sk || !Number.isFinite(sk.uses)) continue;
    const cur = m.uses[id] ?? 0;
    const to = item.restoreAllUses ? sk.uses : item.restoreUses ? Math.min(sk.uses, cur + item.restoreUses) : cur;
    if (to > cur) { nextUses[id] = to; out.usesRestored = true; }
  }

  if (!out.revived && out.healed <= 0 && !out.usesRestored) {
    out.reason = wantsHp && !wantsUses ? 'HP is already full!'
      : wantsUses && !wantsHp ? 'Every skill is already at full uses!'
        : `${displayName(m)} is already at full HP and full uses!`;
    return out;
  }
  out.ok = true;
  if (!dryRun) {
    m.currentHp = hp;
    Object.assign(m.uses, nextUses);
  }
  return out;
}

/** Resets a Mythling to Lv.1 on capture — THE core rule of Wildbound. */
export function resetToLevelOne(m) {
  m.level = 1;
  m.exp = 0;
  m.stage = 0;
  m.library = [];
  m.uses = {};
  m.skills = [];
  refreshLibrary(m);
  autoEquip(m);
  restoreAll(m);
  return m;
}

export const MAX_CHARGE = ULTIMATE_MAX_CHARGE;
