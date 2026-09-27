// Turn-based battle engine. Pure logic: it produces an ordered list of events
// that the battle UI animates. No DOM access in here.
import {
  computeStats, maxHp, displayName, stageData, speciesOf, isFainted,
  equippedSkill, usesLeft, consumeUse, ultimateMove, ultimateReady, ultimateUnlocked,
  addUltimateCharge, gainExp, hpPercent,
} from '../core/mythling.js';
import { getSkill, MAX_BUFF_STACKS, ULTIMATE_MAX_CHARGE } from '../data/skills.js';
import { elementMultiplier, effectivenessLabel } from '../data/elements.js';
import { getItem } from '../data/items.js';
import { getRarity } from '../data/rarity.js';
import {
  DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX, COUNTER_MAX_PERCENT, expReward, LEVEL_CAP,
  counterDodgePercent, CRIT_MAX_PERCENT, CRIT_MAX_MULT, coinReward,
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
    this.canRun = cfg.canRun !== false && this.type === BattleType.WILD;
    this.rng = cfg.rng || Math.random;

    this.playerIndex = this.party.findIndex((m) => !isFainted(m));
    if (this.playerIndex < 0) this.playerIndex = 0;
    this.enemyIndex = 0;

    this.combatants = new Map();
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
  useItem(itemId, targetUid) {
    const events = [];
    const item = getItem(itemId);
    if (!item) return { events, ok: false };
    const target = this.party.find((m) => m.uid === targetUid) || this.player;
    let ok = false;
    if (item.heal) {
      if (isFainted(target)) {
        events.push({ type: 'log', text: `${displayName(target)} has fainted and cannot be healed.` });
        return { events, ok: false };
      }
      const before = target.currentHp;
      target.currentHp = Math.min(maxHp(target), target.currentHp + item.heal);
      events.push({ type: 'heal', side: this.party.includes(target) ? 'player' : 'enemy', uid: target.uid, amount: target.currentHp - before, mythling: this.snapshot(target) });
      events.push({ type: 'log', text: `${displayName(target)} recovered ${target.currentHp - before} HP!` });
      ok = true;
    } else if (item.revive) {
      if (!isFainted(target)) {
        events.push({ type: 'log', text: `${displayName(target)} does not need reviving.` });
        return { events, ok: false };
      }
      target.currentHp = Math.floor(maxHp(target) * item.revive);
      events.push({ type: 'heal', side: 'player', uid: target.uid, amount: target.currentHp, mythling: this.snapshot(target) });
      events.push({ type: 'log', text: `${displayName(target)} was revived!` });
      ok = true;
    } else if (item.restoreUses) {
      for (const id of target.library) {
        const sk = getSkill(id);
        if (sk && Number.isFinite(sk.uses)) target.uses[id] = Math.min(sk.uses, (target.uses[id] ?? 0) + item.restoreUses);
      }
      events.push({ type: 'log', text: `${displayName(target)}'s skills were restored!` });
      ok = true;
    }
    return { events, ok };
  }

  _tryRun(events) {
    if (!this.canRun) {
      events.push({ type: 'log', text: 'You cannot flee from a trainer battle!' });
      return { events, phase: this.phase };
    }
    this.runAttempts += 1;
    const pSpd = this.cb(this.player).stat('spd');
    const eSpd = this.cb(this.enemy).stat('spd');
    const chance = clamp(0.45 + (pSpd - eSpd) * 0.02 + this.runAttempts * 0.12, 0.25, 0.95);
    if (this.rng() < chance) {
      events.push({ type: 'log', text: 'You got away safely!' });
      this.phase = BattlePhase.FLED;
    } else {
      events.push({ type: 'log', text: "You couldn't get away!" });
      const enemyAction = this._enemyChooseAction();
      this._resolve(this.enemy, this.player, enemyAction, events);
      this._postTurn(events);
    }
    return { events, phase: this.phase };
  }

  // ---------------- action resolution ----------------
  _resolve(attacker, defender, action, events) {
    if (!action) return;
    const atkSide = this.party.includes(attacker) ? 'player' : 'enemy';
    const defSide = atkSide === 'player' ? 'enemy' : 'player';

    if (action.type === 'ultimate') {
      const ult = ultimateMove(attacker);
      if (!ultimateReady(attacker) || !ult || ult.future) {
        events.push({ type: 'log', text: `${displayName(attacker)}'s Ultimate is not ready!` });
        return;
      }
      attacker.ultCharge = 0;
      events.push({ type: 'charge', side: atkSide, value: 0 });
      events.push({ type: 'log', text: `${displayName(attacker)} unleashes ${ult.name}!`, emphasis: true });
      events.push({
        type: 'ultimate-cast', side: atkSide, element: ult.element, name: ult.name,
        skillId: ult.id, category: 'ultimate', target: defSide,
      });
      this._dealDamage(attacker, defender, ult, events, { isUltimate: true, logPrefix: `${ult.name} strikes` });
      if (ult.selfBuff) {
        for (const eff of ult.selfBuff) this._applyBuff(attacker, eff, events, atkSide);
      }
      return;
    }

    const skillId = action.skillId || attacker.skills[action.slot];
    const skill = getSkill(skillId);
    if (!skill) {
      events.push({ type: 'log', text: `${displayName(attacker)} hesitates...` });
      return;
    }
    if (Number.isFinite(skill.uses) && usesLeft(attacker, skillId) <= 0) {
      events.push({ type: 'log', text: `${skill.name} has no uses left!` });
      return;
    }
    if (Number.isFinite(skill.uses)) consumeUse(attacker, skillId);

    if (skill.category === 'buff') {
      events.push({ type: 'log', text: `${displayName(attacker)} used ${skill.name}!` });
      events.push({
        type: 'cast', side: atkSide, kind: 'buff', element: null, name: skill.name,
        skillId: skill.id, category: 'buff', target: atkSide,
      });
      for (const eff of skill.effects) this._applyBuff(attacker, eff, events, atkSide);
      // Buff skills never grant Ultimate Charge.
      return;
    }

    events.push({
      type: 'cast', side: atkSide, kind: skill.damageType, element: skill.element, name: skill.name,
      skillId: skill.id, category: skill.category, target: defSide,
    });
    // The "used <skill>" line is written by _dealDamage so the damage (or the dodge)
    // can be reported in the very same sentence.
    this._dealDamage(attacker, defender, skill, events, {
      logPrefix: `${displayName(attacker)} used ${skill.name}!`,
    });
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

  /**
   * @param {object} opts
   *  isUltimate: bool,
   *  logPrefix: string — opening clause of the battle message, e.g. "Emberu used Bite!"
   *    The damage (or the dodge) is appended to it so the attack line reports the result.
   */
  _dealDamage(attacker, defender, move, events, { isUltimate, logPrefix } = {}) {
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

    const atkElement = move.element || speciesOf(attacker).element;
    const mult = elementMultiplier(atkElement, speciesOf(defender).element);
    const rand = DAMAGE_RANDOM_MIN + this.rng() * (DAMAGE_RANDOM_MAX - DAMAGE_RANDOM_MIN);
    const levelFactor = 1 + 0.085 * (attacker.level - 1);
    const stageFactor = stageData(attacker).statMult;

    let dmg = Math.floor(((move.power * off) / Math.max(1, def)) * levelFactor * stageFactor * rand * mult);
    if (crit) dmg = Math.floor(dmg * (1 + critBonus / 100));
    dmg = Math.max(1, dmg);

    defender.currentHp = Math.max(0, defender.currentHp - dmg);
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
    if (eff) events.push({ type: 'log', text: eff });

    // Ultimate charge for successful damaging Normal/Special attacks only.
    if (!isUltimate && (move.category === 'normal' || move.category === 'special')) {
      const c = addUltimateCharge(attacker, 1);
      events.push({ type: 'charge', side: atkSide, value: c, uid: attacker.uid });
      if (c === ULTIMATE_MAX_CHARGE && ultimateUnlocked(attacker)) {
        events.push({ type: 'ultimate-ready', side: atkSide });
        events.push({ type: 'log', text: `${displayName(attacker)}'s Ultimate is READY! (8/8)`, emphasis: true });
      }
    }

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

    const special = equippedSkill(e, 'special');
    const buff = equippedSkill(e, 'buff');
    const normal = equippedSkill(e, 'normal');

    const canSpecial = special && usesLeft(e, special.id) > 0;
    const canBuff = buff && usesLeft(e, buff.id) > 0;

    const r = this.rng();
    // Buff early, then press the attack.
    if (canBuff && this.turn <= 2 && r < 0.3) return { type: 'skill', slot: 'buff' };
    if (canBuff && r < 0.12) return { type: 'skill', slot: 'buff' };
    if (canSpecial && r < 0.75) return { type: 'skill', slot: 'special' };
    if (normal) return { type: 'skill', slot: 'normal' };
    if (canSpecial) return { type: 'skill', slot: 'special' };
    return { type: 'skill', slot: 'normal' };
  }

  // ---------------- turn bookkeeping ----------------
  _postTurn(events) {
    if (this.phase !== BattlePhase.ACTIVE) return;

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
  const sp = speciesOf(target);
  const rarity = getRarity(target.rarity);
  const levelFactor = clamp(1.25 - target.level * 0.02, 0.4, 1.25);
  const hpFactor = target.currentHp <= 0 ? 1.35 : 0.35 * (1 - hpPercent(target)) + 0.4;
  const chance = clamp(sp.catchRate * (ball?.catchMult || 1) * rarity.catchMod * levelFactor * hpFactor, 0.1, 0.985);
  return chance;
}
