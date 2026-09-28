// Turn-based battle engine. Pure logic: it produces an ordered list of events
// that the battle UI animates. No DOM access in here.
import {
  computeStats, maxHp, displayName, stageData, speciesOf, isFainted,
  equippedSkill, equippedSkills, usesLeft, consumeUse, restoreUses, ultimateMove, ultimateReady, ultimateUnlocked, basicAttack,
  addUltimateCharge, gainExp, hpPercent, applyItemEffects,
} from '../core/mythling.js';
import { getSkill, MAX_BUFF_STACKS, ULTIMATE_MAX_CHARGE, effectTarget, isSupportUltimate, isDamageSkill } from '../data/skills.js';
import { elementMultiplier, effectivenessLabel, speciesElements } from '../data/elements.js';
import { getItem } from '../data/items.js';
import { getRarity } from '../data/rarity.js';
import { STAT_SHORT } from '../data/moods.js';
import { getWeather, WEATHER_BOOST, weatherEffectOn } from '../data/weather.js';
import {
  DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX, COUNTER_MAX_PERCENT, expReward, LEVEL_CAP,
  counterDodgePercent, CRIT_MAX_PERCENT, CRIT_MAX_MULT, coinReward, FUTURE_CONTENT_LIVE,
  DAMAGE_LEVEL_SCALE, DAMAGE_STAGE_SCALE, SKILL_POWER_SCALE, SLEEP_MAX_TURNS,
} from '../data/config.js';
import { clamp, randInt } from '../core/utils.js';

export const BattleType = { WILD: 'wild', TRAINER: 'trainer' };
export const BattlePhase = {
  ACTIVE: 'active',
  DEFEATED_WILD: 'defeated_wild', // wild enemy down -> capture allowed
  WON: 'won',
  LOST: 'lost',
  FLED: 'fled',
  CAPTURED: 'captured',
};

/** Per-battle combatant wrapper (buffs/debuffs live here and die with the battle). */
class Combatant {
  constructor(mythling, side) {
    this.m = mythling;
    this.side = side;
    this.buffs = {}; // stat -> { stacks, total }
    this.lastHit = 0; // damage of the most recent enemy attack (0 after a foe's buff / debuff / miss)
    // Battle-only status conditions — both die with the battle.
    this.sleep = 0;           // turns of sleep left: the Mythling loses the whole turn
    this.sealed = null;       // the skill id a Seal has locked away
    this.sealedTurns = 0;
    this.lastSkillId = null;  // the move it used last — what a Seal locks
  }
  base() { return computeStats(this.m); }
  stat(key) {
    const b = this.base()[key];
    const buff = this.buffs[key]?.total || 0;
    let v = b + buff;
    if (key === 'counter') v = clamp(v, 0, COUNTER_MAX_PERCENT);
    if (key === 'crit') v = clamp(v, 0, CRIT_MAX_PERCENT);
    if (key === 'critMult') v = clamp(v, 0, CRIT_MAX_MULT);
    return Math.max(1, Math.floor(v));
  }
  applyBuff(stat, amount) {
    const cur = this.buffs[stat] || { stacks: 0, total: 0 };
    if (cur.stacks >= MAX_BUFF_STACKS) return { applied: false, stacks: cur.stacks, total: cur.total };
    cur.stacks += 1;
    cur.total += amount;
    this.buffs[stat] = cur;
    return { applied: true, stacks: cur.stacks, total: cur.total };
  }
  applyDebuff(stat, amount) {
    const cur = this.buffs[stat] || { stacks: 0, total: 0 };
    if (Math.abs(cur.stacks) >= MAX_BUFF_STACKS) return { applied: false, stacks: cur.stacks, total: cur.total };
    cur.stacks -= 1;
    cur.total -= amount;
    this.buffs[stat] = cur;
    return { applied: true, stacks: cur.stacks, total: cur.total };
  }
  /** Put to sleep for `turns` more turns. Re-sleeping adds to the counter, capped. */
  putToSleep(turns) { this.sleep = Math.min(SLEEP_MAX_TURNS, this.sleep + turns); return this.sleep; }
  wake() { this.sleep = 0; }
  /** Seal `skillId`. Re-sealing keeps whichever lock lasts longer. */
  seal(skillId, turns) {
    this.sealed = skillId;
    this.sealedTurns = Math.max(this.sealedTurns, turns);
    this.sealedFresh = true;      // applied this round: do not tick it away yet
  }
  isSealed(skillId) { return !!skillId && this.sealedTurns > 0 && this.sealed === skillId; }
  unseal() { this.sealed = null; this.sealedTurns = 0; this.sealedFresh = false; }
  /**
   * End of a round: seals count down (sleep is spent the moment it costs a turn,
   * so that a sleep costs the same number of turns whoever moved first).
   */
  tick() {
    if (this.sealedTurns > 0) {
      if (this.sealedFresh) this.sealedFresh = false;
      else { this.sealedTurns -= 1; if (this.sealedTurns <= 0) this.unseal(); }
    }
  }
}

/**
 * What `move` will actually do to `defender` right now — the number the battle
 * buttons show.
 *
 * It is the same arithmetic as _dealDamage with the dice taken out: the random
 * roll is averaged, crits and dodges are left off, so what you read is a normal
 * hit. Both sides' live buffs / debuffs are folded in, which is why the number
 * drops the moment the foe debuffs your Special Attack and jumps when you buff
 * yourself. Element-less moves stay neutral.
 *
 * @returns {{dmg:number, mult:number, element:string|null, tone:'strong'|'weak'|'even'}|null}
 *   null when the move is not a damage move (buffs, debuffs, support Ultimates).
 */
export function previewDamage(battle, attacker, defender, move, { isUltimate = false } = {}) {
  if (!battle || !attacker || !defender || !move) return null;
  if (!isDamageSkill(move)) return null;
  const acb = battle.cb(attacker);
  const dcb = battle.cb(defender);
  const offKey = move.damageType === 'physical' ? 'patk' : 'satk';
  const defKey = move.damageType === 'physical' ? 'pdef' : 'sdef';
  const off = acb.stat(offKey);
  const def = dcb.stat(defKey);
  const atkElement = move.element || null;
  const mult = elementMultiplier(atkElement, speciesElements(speciesOf(defender)));
  const rand = (DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2;
  const levelFactor = 1 + DAMAGE_LEVEL_SCALE * (attacker.level - 1);
  const stageFactor = 1 + DAMAGE_STAGE_SCALE * (attacker.stage || 0);
  const powerScale = isUltimate ? 1 : SKILL_POWER_SCALE;
  const weatherMult = battle.weatherMultFor(move);
  const dmg = Math.max(1, Math.floor(((move.power * powerScale * off) / Math.max(1, def)) * levelFactor * stageFactor * rand * mult * weatherMult));
  return { dmg, mult, element: atkElement, weatherMult, tone: mult > 1.01 ? 'strong' : mult < 0.99 ? 'weak' : 'even' };
}

/**
 * What `move` will actually do to `defender` right now — the number the battle
 * buttons show.
 *
 * It is the same arithmetic as _dealDamage with the dice taken out: the random
 * roll is averaged, crits and dodges are left off, so what you read is a normal
 * hit. Both sides' live buffs / debuffs are folded in, which is why the number
 * drops the moment the foe debuffs your Special Attack and jumps when you buff
 * yourself. Element-less moves stay neutral.
 *
 * @returns {{dmg:number, mult:number, element:string|null, tone:'strong'|'weak'|'even'}|null}
 *   null when the move is not a damage move (buffs, debuffs, support Ultimates).
 */
export function previewDamage(battle, attacker, defender, move, { isUltimate = false } = {}) {
  if (!battle || !attacker || !defender || !move) return null;
  if (!isDamageSkill(move)) return null;
  const acb = battle.cb(attacker);
  const dcb = battle.cb(defender);
  const offKey = move.damageType === 'physical' ? 'patk' : 'satk';
  const defKey = move.damageType === 'physical' ? 'pdef' : 'sdef';
  const off = acb.stat(offKey);
  const def = dcb.stat(defKey);
  const atkElement = move.element || null;
  const mult = elementMultiplier(atkElement, speciesElements(speciesOf(defender)));
  const rand = (DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2;
  const levelFactor = 1 + DAMAGE_LEVEL_SCALE * (attacker.level - 1);
  const stageFactor = 1 + DAMAGE_STAGE_SCALE * (attacker.stage || 0);
  const powerScale = isUltimate ? 1 : SKILL_POWER_SCALE;
  const dmg = Math.max(1, Math.floor(((move.power * powerScale * off) / Math.max(1, def)) * levelFactor * stageFactor * rand * mult));
  return { dmg, mult, element: atkElement, tone: mult > 1.01 ? 'strong' : mult < 0.99 ? 'weak' : 'even' };
}

export class Battle {
  /**
   * @param {object} cfg
   *  type: 'wild'|'trainer', party: Mythling[], enemies: Mythling[],
   *  trainer: trainer data (optional), mapId, canRun
   */
  constructor(cfg) {
    this.type = cfg.type;
    this.trainer = cfg.trainer || null;
    this.mapId = cfg.mapId;
    this.party = cfg.party;
    this.enemies = cfg.enemies;
    // Running is absolute: any battle, wild or trainer, can be left at any time.
    this.canRun = cfg.canRun !== false;
    this.rng = cfg.rng || Math.random;

    // Skill uses are a PER-BATTLE resource: every fight starts with every skill full.
    for (const m of this.party) restoreUses(m, Infinity);
    for (const m of this.enemies) restoreUses(m, Infinity);

    this.playerIndex = this.party.findIndex((m) => !isFainted(m));
    if (this.playerIndex < 0) this.playerIndex = 0;
    this.enemyIndex = 0;

    this.combatants = new Map();
    this.weather = null;              // a raised weather id — lasts the whole battle
    this.phase = BattlePhase.ACTIVE;
    this.turn = 0;
    this.participants = new Set();
    this.rewards = { exp: [], coins: 0, items: {} };
    this.capturedMythling = null;
    this.runAttempts = 0;
    this._markParticipant();
  }

  // ---------------- accessors ----------------
  get player() { return this.party[this.playerIndex]; }
  get enemy() { return this.enemies[this.enemyIndex]; }

  /** Trainer party bookkeeping: how big the enemy team is and how much of it is left. */
  enemyTeamTotal() { return this.enemies.length; }
  enemyTeamLeft() { return this.enemies.filter((m) => !isFainted(m)).length; }
  enemyTeamSummary() { return { left: this.enemyTeamLeft(), total: this.enemyTeamTotal() }; }

  cb(m) {
    if (!this.combatants.has(m.uid)) {
      this.combatants.set(m.uid, new Combatant(m, this.party.includes(m) ? 'player' : 'enemy'));
    }
    return this.combatants.get(m.uid);
  }

  _markParticipant() {
    if (this.player) this.participants.add(this.player.uid);
  }

  snapshot(m) {
    return {
      uid: m.uid, name: displayName(m), level: m.level, hp: m.currentHp, maxHp: maxHp(m),
      element: speciesOf(m).element, charge: m.ultCharge, mutation: m.mutation,
    };
  }

  // ---------------- player actions ----------------
  /** Returns { events: [], phase } */
  act(action) {
    if (this.phase !== BattlePhase.ACTIVE) return { events: [], phase: this.phase };
    const events = [];
    this.turn += 1;

    // Non-turn-consuming / special flows
    if (action.type === 'run') return this._tryRun(events);

    let playerAction = action;
    let enemyAction = this._enemyChooseAction();

    // Items and switching always resolve first (they are "fast" actions).
    if (playerAction.type === 'item' || playerAction.type === 'switch') {
      this._resolvePlayerUtility(playerAction, events);
      if (this.phase !== BattlePhase.ACTIVE) return { events, phase: this.phase };
      this._resolve(this.enemy, this.player, enemyAction, events);
      this._postTurn(events);
      return { events, phase: this.phase };
    }

    const pSpd = this.cb(this.player).stat('spd');
    const eSpd = this.cb(this.enemy).stat('spd');
    let playerFirst;
    if (pSpd !== eSpd) playerFirst = pSpd > eSpd;
    else playerFirst = this.rng() < 0.5;

    const order = playerFirst
      ? [[this.player, this.enemy, playerAction], [this.enemy, this.player, enemyAction]]
      : [[this.enemy, this.player, enemyAction], [this.player, this.enemy, playerAction]];

    for (const [attacker, defender, act] of order) {
      if (isFainted(attacker) || isFainted(defender)) continue;
      if (this.phase !== BattlePhase.ACTIVE) break;
      // Asleep: the whole turn is lost. (Switching and items are still open to the
      // player — sleep takes the attack, not the trainer's judgement.)
      if (this.cb(attacker).sleep > 0) { this._skipAsleep(attacker, events); continue; }
      this._resolve(attacker, defender, act, events);
    }
    this._postTurn(events);
    return { events, phase: this.phase };
  }

  _resolvePlayerUtility(action, events) {
    if (action.type === 'item') {
      const res = this.useItem(action.itemId, action.targetUid);
      events.push(...res.events);
    } else if (action.type === 'switch') {
      const idx = this.party.findIndex((m) => m.uid === action.uid);
      if (idx >= 0 && !isFainted(this.party[idx])) {
        events.push({ type: 'log', text: `${displayName(this.player)}, come back!` });
        this.playerIndex = idx;
        this._markParticipant();
        events.push({ type: 'switch', side: 'player', mythling: this.snapshot(this.player) });
        events.push({ type: 'log', text: `Go, ${displayName(this.player)}!` });
      }
    }
  }

  /** Item usage is also available from this API mid-battle. */
  /** Stats currently dragged down on `m`: the battle's negative buff stacks. */
  debuffs(m) {
    const cb = this.combatants.get(m?.uid);
    if (!cb) return [];
    return Object.entries(cb.buffs).filter(([, b]) => b.stacks < 0).map(([stat, b]) => ({ stat, stacks: b.stacks, total: b.total }));
  }

  /**
   * Wipe every debuff off `m` (a Cleanse Tonic). Buffs are untouched — it lifts
   * what the foe did to you, it does not strip what you did for yourself.
   * @returns {string[]} the stat keys that were restored.
   */
  clearDebuffs(m) {
    const cb = this.combatants.get(m?.uid);
    const cleared = [];
    if (!cb) return cleared;
    for (const [stat, b] of Object.entries(cb.buffs)) {
      if (b.stacks >= 0) continue;
      cleared.push(stat);
      delete cb.buffs[stat];
    }
    return cleared;
  }

  useItem(itemId, targetUid) {
    const events = [];
    const item = getItem(itemId);
    if (!item) return { events, ok: false };
    const target = this.party.find((m) => m.uid === targetUid) || this.player;
    const side = this.party.includes(target) ? 'player' : 'enemy';
    // A Cleanse Tonic works on the combatant, not on the Mythling: debuffs live
    // in the battle and die with it, so applyItemEffects cannot see them.
    if (item.cleanse) {
      // A cleanser lifts everything the foe has done: stat debuffs, sleep and seals.
      const cb = this.cb(target);
      const cleared = this.clearDebuffs(target);
      const woke = cb.sleep > 0;
      const unsealed = cb.isSealed(cb.sealed) ? cb.sealed : null;
      if (!cleared.length && !woke && !unsealed) {
        events.push({ type: 'log', text: `${displayName(target)} has nothing to cleanse.` });
        return { events, ok: false };
      }
      cb.wake();
      if (unsealed) cb.unseal();
      const bits = [];
      if (cleared.length) bits.push(cleared.map((k) => STAT_SHORT[k] || k.toUpperCase()).join(', '));
      if (woke) bits.push('woke up');
      if (unsealed) bits.push(`${getSkill(unsealed)?.name || 'sealed move'} unsealed`);
      events.push({ type: 'cleanse', side, uid: target.uid, stats: cleared, woke, unsealed });
      events.push({ type: 'log', text: `${displayName(target)} was cleansed! (${bits.join(' · ')})` });
      return { events, ok: true };
    }
    const res = applyItemEffects(item, target);
    if (!res.ok) {
      events.push({ type: 'log', text: res.reason || 'It had no effect.' });
      return { events, ok: false };
    }
    if (res.revived) {
      events.push({ type: 'heal', side, uid: target.uid, amount: target.currentHp, mythling: this.snapshot(target) });
      events.push({ type: 'log', text: `${displayName(target)} was revived!` });
    } else if (res.healed > 0) {
      events.push({ type: 'heal', side, uid: target.uid, amount: res.healed, mythling: this.snapshot(target) });
      events.push({ type: 'log', text: `${displayName(target)} recovered ${res.healed} HP!` });
    }
    if (res.usesRestored) events.push({ type: 'log', text: `${displayName(target)}'s skills were restored!` });
    return { events, ok: true };
  }

  /**
   * Fleeing is guaranteed: the moment the player runs, the battle is over —
   * no speed roll, no free hit for the enemy, and trainers cannot stop you.
   * Partial rewards already earned (KO'd trainer Mythlings) are kept.
   */
  _tryRun(events) {
    if (!this.canRun) {
      events.push({ type: 'log', text: 'You cannot flee from this battle!' });
      return { events, phase: this.phase };
    }
    this.runAttempts += 1;
    events.push({ type: 'log', text: this.type === BattleType.TRAINER
      ? `You walked away from ${this.trainer?.name || 'the trainer'}'s challenge.`
      : 'You got away safely!', emphasis: true });
    this.phase = BattlePhase.FLED;
    return { events, phase: this.phase };
  }

  // ---------------- action resolution ----------------
  _resolve(attacker, defender, action, events) {
    if (!action) return;
    const atkSide = this.party.includes(attacker) ? 'player' : 'enemy';
    const defSide = atkSide === 'player' ? 'enemy' : 'player';

    if (action.type === 'ultimate') {
      const ult = ultimateMove(attacker);
      if (!ultimateReady(attacker) || !ult || (!FUTURE_CONTENT_LIVE && ult.future)) {
        events.push({ type: 'log', text: `${displayName(attacker)}'s Ultimate is not ready!` });
        return;
      }
      attacker.ultCharge = 0;
      events.push({ type: 'charge', side: atkSide, value: 0 });
      events.push({ type: 'log', text: `${displayName(attacker)} unleashes ${ult.name}!`, emphasis: true });
      if (isSupportUltimate(ult)) {
        // Buff / debuff Ultimate: no damage, two effects. Foe-side effects are
        // always debuffs, self-side effects always buffs. Never dodged.
        const hitsFoe = (ult.effects || []).some((e) => effectTarget(ult, e) === 'foe');
        events.push({
          type: 'ultimate-cast', side: atkSide, element: ult.element, name: ult.name,
          skillId: ult.id, category: 'ultimate', kind: 'support', target: hitsFoe ? defSide : atkSide,
        });
        this._applyEffects(ult, attacker, defender, events, atkSide, defSide);
        this.cb(defender).lastHit = 0;   // nothing to retaliate against
        return;
      }
      events.push({
        type: 'ultimate-cast', side: atkSide, element: ult.element, name: ult.name,
        skillId: ult.id, category: 'ultimate', target: defSide,
      });
      this.cb(attacker).lastSkillId = ult.id;
      this._rollWeather(ult, events);
      this._dealDamage(attacker, defender, ult, events, { isUltimate: true, logPrefix: `${ult.name} strikes` });
      if (ult.selfBuff) {
        for (const eff of ult.selfBuff) this._applyBuff(attacker, eff, events, atkSide);
      }
      if (ult.foeDebuff && !isFainted(defender)) {
        for (const eff of ult.foeDebuff) this._applyDebuff(defender, eff, events, defSide);
      }
      return;
    }

    let skillId = this._actionSkillId(attacker, action);
    let skill = getSkill(skillId);
    // Sealed? The move is unusable for a turn or two — fall back to the unlimited
    // attack rather than losing the turn (the unlimited attack can never be sealed).
    if (skill && this.cb(attacker).isSealed(skillId)) {
      events.push({ type: 'log', text: `${displayName(attacker)}'s ${skill.name} is sealed and will not answer!` });
      skill = basicAttack(attacker);
      skillId = skill.id;
    }
    // Out of uses (or nothing equipped at all)? Fall back to the Mythling's
    // unlimited attack instead of losing the turn.
    if (!skill || (Number.isFinite(skill.uses) && usesLeft(attacker, skillId) <= 0)) {
      const fallback = basicAttack(attacker);
      if (skill) events.push({ type: 'log', text: `${skill.name} has no uses left!` });
      events.push({ type: 'log', text: `${displayName(attacker)} falls back on ${fallback.name}!` });
      skill = fallback;
      skillId = fallback.id;
    }
    if (Number.isFinite(skill.uses)) consumeUse(attacker, skillId);
    this.cb(attacker).lastSkillId = skillId;      // a Seal locks whatever was just used

    if (skill.category === 'buff' || skill.category === 'debuff') {
      // Support skills never miss and never grant Ultimate Charge. Each effect
      // lands on its own side: foe-side entries are debuffs, self-side buffs
      // (an elite skill may carry one of each).
      events.push({ type: 'log', text: `${displayName(attacker)} used ${skill.name}!` });
      events.push({
        type: 'cast', side: atkSide, kind: skill.category, element: skill.element || null, name: skill.name,
        skillId: skill.id, category: skill.category, target: skill.category === 'debuff' ? defSide : atkSide,
      });
      this._applyEffects(skill, attacker, defender, events, atkSide, defSide);
      this._applyStatusRiders(skill, attacker, defender, events, atkSide, defSide);
      this._rollWeather(skill, events);
      this.cb(defender).lastHit = 0;   // a foe that only buffed / debuffed leaves nothing to retaliate against
      return;
    }

    if (skill.reflect) {
      // Retaliate / Vengeance: return the LAST hit taken, multiplied. Nothing to
      // return (the foe buffed, missed or has not attacked yet) -> the move fizzles.
      const taken = this.cb(attacker).lastHit || 0;
      events.push({
        type: 'cast', side: atkSide, kind: skill.damageType, element: skill.element, name: skill.name,
        skillId: skill.id, category: skill.category, target: defSide,
      });
      if (taken <= 0) {
        events.push({ type: 'log', text: `${displayName(attacker)} used ${skill.name}! — but there was nothing to return.` });
        return;
      }
      this._dealDamage(attacker, defender, skill, events, {
        logPrefix: `${displayName(attacker)} used ${skill.name}!`,
        fixedDamage: Math.max(1, Math.floor(taken * skill.reflect)),
      });
      return;
    }

    events.push({
      type: 'cast', side: atkSide, kind: skill.damageType, element: skill.element, name: skill.name,
      skillId: skill.id, category: skill.category, target: defSide,
    });
    this._rollWeather(skill, events);
    // The "used <skill>" line is written by _dealDamage so the damage (or the dodge)
    // can be reported in the very same sentence.
    this._dealDamage(attacker, defender, skill, events, {
      logPrefix: `${displayName(attacker)} used ${skill.name}!`,
    });
  }

  // ---------------- weather ----------------
  /** The active weather's element, or null. */
  weatherElement() { return getWeather(this.weather)?.element || null; }

  /** x1.5 when the move carries the weather's element — paid to BOTH sides. */
  weatherMultFor(move) {
    const el = this.weatherElement();
    return el && move?.element && move.element === el ? WEATHER_BOOST : 1;
  }

  /**
   * Raise a weather condition when the move is USED (not when it hits — it is the
   * field that changes, not the foe). A weather then lasts the rest of the battle,
   * or until another weather replaces it.
   */
  _rollWeather(skill, events) {
    if (!skill?.weather) return;
    const w = getWeather(skill.weather.id);
    if (!w) return;
    if (this.weather === w.id) {
      events.push({ type: 'log', text: `${w.name} is already raging.` });
      return;
    }
    if (this.rng() >= skill.weather.chance) {
      events.push({ type: 'log', text: `The air stirs, but ${w.name} does not break.` });
      return;
    }
    this.weather = w.id;
    events.push({ type: 'weather', id: w.id, element: w.element, name: w.name, desc: w.desc });
    events.push({ type: 'log', text: `${w.name} breaks over the battlefield!`, emphasis: true });
  }

  /**
   * End of every round: any Mythling on the field that does NOT share the weather's
   * element pays a flat 100 HP (180 when it is weak to that element).
   */
  _weatherBurn(events) {
    const w = getWeather(this.weather);
    if (!w) return;
    for (const [m, side] of [[this.enemy, 'enemy'], [this.player, 'player']]) {
      if (!m || isFainted(m)) continue;
      const eff = weatherEffectOn(speciesElements(speciesOf(m)), w.id);
      if (!eff.burn) continue;
      m.currentHp = Math.max(0, m.currentHp - eff.damage);
      events.push({ type: 'weather-tick', side, uid: m.uid, amount: eff.damage, weak: eff.weak, weather: w.id });
      events.push({ type: 'log', text: `${displayName(m)} is battered by ${w.name}! (${eff.damage} damage${eff.weak ? ' — weak to it' : ''})` });
    }
  }

  // ---------------- status conditions: sleep & seals ----------------
  /** A sleeping Mythling loses its whole turn. */
  _skipAsleep(m, events) {
    const side = this.party.includes(m) ? 'player' : 'enemy';
    const turns = this.cb(m).sleep;
    events.push({ type: 'sleep', side, uid: m.uid, turns });
    events.push({ type: 'log', text: `${displayName(m)} is fast asleep... (${turns} more turn${turns === 1 ? '' : 's'})` });
    this.cb(m).sleep -= 1;       // it just spent one of its turns asleep
    this.cb(m).lastHit = 0;      // nothing to retaliate against
  }

  /**
   * Sleep / Seal riders, both landing on the foe. Sleep is capped at
   * SLEEP_MAX_TURNS however often it is re-applied; a Seal locks the move the foe
   * JUST used and can never take away its unlimited Normal attack.
   */
  _applyStatusRiders(move, attacker, defender, events, atkSide, defSide) {
    if (!move) return;
    const dcb = this.cb(defender);
    if (move.sleep && this.rng() < move.sleep.chance) {
      const [lo, hi] = move.sleep.turns;
      const roll = lo + Math.floor(this.rng() * (hi - lo + 1));
      const turns = dcb.putToSleep(roll);
      events.push({ type: 'sleep-set', side: defSide, uid: defender.uid, turns, added: roll });
      events.push({ type: 'log', text: `${displayName(defender)} fell asleep! (${turns} turn${turns === 1 ? '' : 's'}, capped at ${SLEEP_MAX_TURNS})` });
    }
    if (move.seal && this.rng() < move.seal.chance) {
      const last = dcb.lastSkillId;
      const sk = last ? getSkill(last) : null;
      if (sk && sk.uses !== Infinity) {          // the unlimited Normal attack is never sealed
        const [lo, hi] = move.seal.turns;
        const turns = lo + Math.floor(this.rng() * (hi - lo + 1));
        dcb.seal(last, turns);
        events.push({ type: 'seal', side: defSide, uid: defender.uid, skillId: last, turns, name: sk.name });
        events.push({ type: 'log', text: `${displayName(defender)}'s ${sk.name} is sealed! (${turns} turn${turns === 1 ? '' : 's'})` });
      }
    }
  }

  /** Route each effect of a support skill / Ultimate to the side it targets. */
  _applyEffects(skill, attacker, defender, events, atkSide, defSide) {
    for (const eff of skill.effects || []) {
      if (effectTarget(skill, eff) === 'foe') this._applyDebuff(defender, eff, events, defSide);
      else this._applyBuff(attacker, eff, events, atkSide);
    }
  }

  _applyBuff(target, eff, events, side) {
    const cb = this.cb(target);
    const res = cb.applyBuff(eff.stat, eff.amount);
    if (!res.applied) {
      events.push({ type: 'log', text: `${displayName(target)}'s ${eff.stat.toUpperCase()} cannot rise any further! (max ${MAX_BUFF_STACKS} stacks)` });
      return;
    }
    events.push({ type: 'buff', side, stat: eff.stat, amount: eff.amount, stacks: res.stacks, total: res.total, uid: target.uid });
    events.push({ type: 'log', text: `${displayName(target)}'s ${eff.stat.toUpperCase()} rose! (+${res.total}, ${res.stacks}/${MAX_BUFF_STACKS} stacks)` });
  }

  _applyDebuff(target, eff, events, side) {
    const cb = this.cb(target);
    const res = cb.applyDebuff(eff.stat, eff.amount);
    if (!res.applied) {
      events.push({ type: 'log', text: `${displayName(target)}'s ${eff.stat.toUpperCase()} cannot fall any further! (max ${MAX_BUFF_STACKS} stacks)` });
      return;
    }
    events.push({ type: 'debuff', side, stat: eff.stat, amount: eff.amount, stacks: res.stacks, total: res.total, uid: target.uid });
    events.push({ type: 'log', text: `${displayName(target)}'s ${eff.stat.toUpperCase()} fell! (${res.total}, ${Math.abs(res.stacks)}/${MAX_BUFF_STACKS} stacks)` });
  }

  /**
   * Which skill an action refers to. Actions name a skill directly
   * (`skillId`), a battle button (`index`, 0-based) or — for older callers —
   * a category (`slot`), which resolves to the first equipped skill of that kind.
   */
  _actionSkillId(m, action) {
    if (action.skillId) return action.skillId;
    if (Number.isInteger(action.index)) return equippedSkill(m, action.index)?.id || null;
    if (action.slot) {
      const hit = equippedSkills(m).find((e) => e.skill.category === action.slot);
      return hit ? hit.id : null;
    }
    return null;
  }

  /**
   * @param {object} opts
   *  isUltimate: bool,
   *  logPrefix: string — opening clause of the battle message, e.g. "Emberu used Bite!"
   *    The damage (or the dodge) is appended to it so the attack line reports the result.
   */
  _dealDamage(attacker, defender, move, events, { isUltimate, logPrefix, fixedDamage = null } = {}) {
    const atkSide = this.party.includes(attacker) ? 'player' : 'enemy';
    const defSide = atkSide === 'player' ? 'enemy' : 'player';
    const acb = this.cb(attacker);
    const dcb = this.cb(defender);
    const prefix = logPrefix ? `${logPrefix} — ` : '';

    // Counter = evasion chance (nerfed: half a percent per point, capped at 18%).
    const dodge = counterDodgePercent(dcb.stat('counter'));
    if (this.rng() * 100 < dodge) {
      events.push({
        type: 'log',
        text: `${prefix}${displayName(defender)} countered and dodged it! (${Math.round(dodge)}% Counter)`,
      });
      events.push({ type: 'miss', side: defSide, uid: defender.uid });
      dcb.lastHit = 0;
      return; // no charge on a miss
    }

    const offKey = move.damageType === 'physical' ? 'patk' : 'satk';
    const defKey = move.damageType === 'physical' ? 'pdef' : 'sdef';
    const off = acb.stat(offKey);
    const def = dcb.stat(defKey);

    // Crit Chance / Crit Damage
    const critChance = clamp(acb.stat('crit'), 0, CRIT_MAX_PERCENT);
    const critBonus = clamp(acb.stat('critMult'), 0, CRIT_MAX_MULT);
    const crit = this.rng() * 100 < critChance;

    // An element-less move stays element-less: a plain Bite is never a Fire move,
    // even in a Fire Mythling's mouth. Only moves that carry an element get one.
    const atkElement = move.element || null;
    // dual / triple-typed defenders weigh every one of their elements
    const mult = elementMultiplier(atkElement, speciesElements(speciesOf(defender)));
    const rand = DAMAGE_RANDOM_MIN + this.rng() * (DAMAGE_RANDOM_MAX - DAMAGE_RANDOM_MIN);
    // Attack and Defense already grow with level and evolution, so the extra level /
    // stage factors are deliberately gentle: at Lv.100 a Special takes ~5-6 hits to KO
    // an equal foe and even an Ultimate needs two or three — no more coin-flip one-shots.
    const levelFactor = 1 + DAMAGE_LEVEL_SCALE * (attacker.level - 1);
    const stageFactor = 1 + DAMAGE_STAGE_SCALE * (attacker.stage || 0);

    // Regular skills get a small across-the-board bump (SKILL_POWER_SCALE) so they
    // feel weightier; Ultimates are balanced separately through their own scale.
    const powerScale = isUltimate ? 1 : SKILL_POWER_SCALE;
    // Weather pays the same bonus to BOTH sides — but only to a move that carries
    // the weather's element. A plain Bite gets nothing, even in a Fire Mythling's mouth.
    const weatherMult = this.weatherMultFor(move);
    let dmg = Math.floor(((move.power * powerScale * off) / Math.max(1, def)) * levelFactor * stageFactor * rand * mult * weatherMult);
    if (crit) dmg = Math.floor(dmg * (1 + critBonus / 100));
    // Reflected damage ignores stats and elements: it is the foe's own hit, multiplied.
    if (fixedDamage != null) dmg = crit ? Math.floor(fixedDamage * (1 + critBonus / 100)) : fixedDamage;
    dmg = Math.max(1, dmg);

    defender.currentHp = Math.max(0, defender.currentHp - dmg);
    dcb.lastHit = dmg;
    events.push({
      type: 'log',
      text: `${prefix}${dmg} damage!${crit ? ` CRITICAL HIT! (x${(1 + critBonus / 100).toFixed(2)})` : ''}`,
      emphasis: crit,
    });
    events.push({
      type: 'damage', side: defSide, uid: defender.uid, amount: dmg, effectiveness: mult,
      isUltimate: !!isUltimate, crit, critBonus, mythling: this.snapshot(defender),
      // VFX routing: which skill produced this hit, and where it came from.
      skillId: move.id, category: isUltimate ? 'ultimate' : move.category,
      element: atkElement, source: atkSide,
    });
    const eff = effectivenessLabel(mult);
    if (eff && fixedDamage == null) events.push({ type: 'log', text: eff });

    // Life steal / fixed heal riders: the attacker heals right after a landed hit.
    if ((move.drain || move.healPct) && !isFainted(attacker)) {
      const mx = maxHp(attacker);
      let heal = 0;
      if (move.drain) heal += Math.floor(dmg * move.drain);
      if (move.healPct) heal += Math.floor(mx * move.healPct);
      heal = Math.min(heal, mx - attacker.currentHp);
      if (heal > 0) {
        attacker.currentHp += heal;
        events.push({ type: 'heal', side: atkSide, uid: attacker.uid, amount: heal, mythling: this.snapshot(attacker), source: move.id });
        events.push({ type: 'log', text: `${displayName(attacker)} recovered ${heal} HP${move.drain ? (crit ? ' — the critical hit drained even more!' : ' by draining the foe!') : '!'}` });
      }
    }

    // Ultimate charge for successful damaging Normal/Special attacks only.
    if (!isUltimate && (move.category === 'normal' || move.category === 'special')) {
      const c = addUltimateCharge(attacker, 1);
      events.push({ type: 'charge', side: atkSide, value: c, uid: attacker.uid });
      if (c === ULTIMATE_MAX_CHARGE && ultimateUnlocked(attacker)) {
        events.push({ type: 'ultimate-ready', side: atkSide });
        events.push({ type: 'log', text: `${displayName(attacker)}'s Ultimate is READY! (8/8)`, emphasis: true });
      }
    }

    // Optional Sleep / Seal riders
    this._applyStatusRiders(move, attacker, defender, events, atkSide, defSide);
    // Optional debuff riders
    if (move.debuff && this.rng() < move.debuff.chance) {
      const res = dcb.applyDebuff(move.debuff.stat, move.debuff.amount);
      if (res.applied) {
        events.push({ type: 'debuff', side: defSide, uid: defender.uid, stat: move.debuff.stat, amount: move.debuff.amount, stacks: res.stacks, total: res.total });
        events.push({ type: 'log', text: `${displayName(defender)}'s ${move.debuff.stat.toUpperCase()} fell!` });
      }
    }

    if (defender.currentHp <= 0) {
      events.push({ type: 'faint', side: defSide, uid: defender.uid });
      events.push({ type: 'log', text: `${displayName(defender)} was defeated!`, emphasis: true });
    }
  }

  // ---------------- enemy AI ----------------
  _enemyChooseAction() {
    const e = this.enemy;
    if (!e || isFainted(e)) return null;
    if (ultimateReady(e)) return { type: 'ultimate' };

    // The enemy plays whatever it has on its battle buttons, by category.
    const ready = equippedSkills(e).filter((x) => usesLeft(e, x.id) > 0 && !this.cb(e).isSealed(x.id));
    const first = (cat) => ready.find((x) => x.skill.category === cat) || null;
    const special = first('special');
    const buff = first('buff');
    const debuff = first('debuff');
    const normal = first('normal');
    const use = (x) => ({ type: 'skill', index: x.index });

    const r = this.rng();                       // exactly one roll per decision
    // Buff or weaken early, then press the attack.
    if (buff && this.turn <= 2 && r < 0.3) return use(buff);
    if (debuff && this.turn <= 3 && r >= 0.3 && r < 0.55) return use(debuff);
    if (buff && r < 0.12) return use(buff);
    if (debuff && r >= 0.12 && r < 0.24) return use(debuff);
    if (special && r < 0.75) return use(special);
    if (normal) return use(normal);
    if (special) return use(special);
    if (debuff) return use(debuff);
    if (buff) return use(buff);
    return { type: 'skill', skillId: basicAttack(e).id };
  }

  // ---------------- turn bookkeeping ----------------
  _postTurn(events) {
    if (this.phase !== BattlePhase.ACTIVE) return;
    this._weatherBurn(events);      // before the faint checks, so a lethal burn counts
    this.cb(this.player).tick();
    this.cb(this.enemy).tick();

    if (isFainted(this.enemy)) {
      const nextEnemy = this.enemies.findIndex((m, i) => i > this.enemyIndex && !isFainted(m));
      if (this.type === BattleType.TRAINER && nextEnemy >= 0) {
        this._awardExp(this.enemy, events);
        this.enemyIndex = nextEnemy;
        const { left, total } = this.enemyTeamSummary();
        const last = left === 1 ? ' — their last Mythling!' : ` (${left} of ${total} left)`;
        events.push({ type: 'log', text: `${this.trainer.name} sends out ${displayName(this.enemy)}!${last}`, emphasis: true });
        events.push({ type: 'switch', side: 'enemy', mythling: this.snapshot(this.enemy), teamLeft: left, teamTotal: total });
        return;
      }
      this._awardExp(this.enemy, events);
      if (this.type === BattleType.WILD) {
        this.phase = BattlePhase.DEFEATED_WILD;
        events.push({ type: 'wild-defeated', mythling: this.snapshot(this.enemy) });
      } else {
        this.phase = BattlePhase.WON;
        events.push({ type: 'log', text: `${this.trainer.name} has no Mythlings left!`, emphasis: true });
        events.push({ type: 'win', teamLeft: 0, teamTotal: this.enemyTeamTotal() });
      }
      return;
    }

    if (isFainted(this.player)) {
      events.push({ type: 'log', text: `${displayName(this.player)} can no longer battle.` });
      const next = this.party.findIndex((m) => !isFainted(m));
      if (next >= 0) {
        this.playerIndex = next;
        this._markParticipant();
        events.push({ type: 'log', text: `Go, ${displayName(this.player)}!` });
        events.push({ type: 'switch', side: 'player', mythling: this.snapshot(this.player) });
      } else {
        this.phase = BattlePhase.LOST;
        events.push({ type: 'lose' });
      }
    }
  }

  _awardExp(defeated, events) {
    const yieldV = speciesOf(defeated).expYield;

    // Defeating a wild Mythling pays Wildcoins (trainers pay their own bounty).
    if (this.type === BattleType.WILD) {
      const coins = coinReward({ enemyLevel: defeated.level, enemyYield: yieldV, winnerLevel: this.player?.level });
      this.rewards.coins += coins;
      events.push({ type: 'coins', amount: coins });
    }

    for (const m of this.party) {
      if (isFainted(m)) continue;
      const participated = this.participants.has(m.uid);
      if (!participated && m.uid !== this.player?.uid) {
        // bench members earn a reduced share
      }
      const amount = Math.max(1, Math.floor(expReward({
        enemyLevel: defeated.level,
        enemyYield: yieldV,
        winnerLevel: m.level,
        isTrainer: this.type === BattleType.TRAINER,
      }) * (participated ? 1 : 0.4)));
      const before = { level: m.level, exp: m.exp };
      const res = gainExp(m, amount);
      this.rewards.exp.push({ uid: m.uid, name: displayName(m), amount, result: res, before });
      events.push({ type: 'exp', uid: m.uid, name: displayName(m), amount, result: res, atCap: m.level >= LEVEL_CAP });
    }
  }

  /** Called by CaptureManager when the wild Mythling is defeated. */
  finishWild() {
    if (this.phase === BattlePhase.DEFEATED_WILD) this.phase = BattlePhase.WON;
  }
}

export function captureChance({ target, ballId, rngValue }) {
  const ball = getItem(ballId);
  if (ball?.guaranteed) return 1;                 // God / Shiny / Dark Ball: never fails
  const sp = speciesOf(target);
  const rarity = getRarity(target.rarity);
  const levelFactor = clamp(1.25 - target.level * 0.02, 0.4, 1.25);
  const hpFactor = target.currentHp <= 0 ? 1.35 : 0.35 * (1 - hpPercent(target)) + 0.4;
  const chance = clamp(sp.catchRate * (ball?.catchMult || 1) * rarity.catchMod * levelFactor * hpFactor, 0.1, 0.985);
  return chance;
}
