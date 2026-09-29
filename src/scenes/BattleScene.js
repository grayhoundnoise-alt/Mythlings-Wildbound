// Battle presentation layer: arena rendering, effects, and the battle HUD.
// All rules live in BattleManager — this file only shows them.
import { Battle, BattleType, BattlePhase, previewDamage } from '../systems/BattleManager.js';
import { CaptureManager } from '../systems/CaptureManager.js';
import { InventoryManager, PartyManager, GameState, CollectionManager, bus } from '../systems/GameState.js';
import {
  displayName, speciesOf, computeStats, statBreakdown, maxHp, hpPercent, isFainted, ultimateMove,
  ultimateUnlocked, equippedSkill, equippedSkills, usesLeft, basicAttack, applyItemEffects,
  MAX_EQUIPPED_SKILLS,
} from '../core/mythling.js';
import { getSkill, ULTIMATE_MAX_CHARGE, MAX_BUFF_STACKS } from '../data/skills.js';
import { STAT_SHORT, STAT_LABELS, getMood } from '../data/moods.js';
import { ELEMENTS, ELEMENT_ORDER, speciesElements, attackMatchup, typeProfile } from '../data/elements.js';
import { BALL_IDS, getItem } from '../data/items.js';
import { getWeather } from '../data/weather.js';
import { drawMythling, prewarm } from '../render/creatures.js';
import { SkillVFX } from '../render/vfx/SkillVFX.js';
import { paletteFor } from '../data/skillVfx.js';
import { roundRect } from '../render/worldRenderer.js';
import { drawBall, ballCanvas, ballLook, BALL_ART } from '../render/balls.js';
import { el, button, bar, hpClass, elementChip, elementChips, mutationChip, rarityChip, toast, confirmDialog, modal, closeModal } from '../ui/ui.js';
import { icon, iconSvg, iconLabel } from '../ui/icons.js';
import { buffSummary, isDamageSkill } from '../data/skills.js';
import { AudioManager } from '../systems/AudioManager.js';
import { SettingsManager } from '../systems/SettingsManager.js';
import { clamp, coins, randInt } from '../core/utils.js';
import { LEVEL_CAP, DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX, SLEEP_MAX_TURNS, DOT_MAX_TURNS } from '../data/config.js';

const SLOT_POS = {
  player: { x: 0.30, y: 0.80 },
  enemy: { x: 0.72, y: 0.52 },
};

export class BattleScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.dpr = 1;
    this.active = false;
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.anim = { player: this.freshAnim(), enemy: this.freshAnim() };
    this.busy = false;
    this.ui = null;
    this.onEnd = null;
    // What the HUD is currently SHOWING. The rules engine resolves a whole turn
    // up front, so reading live HP would spoil hits that have not been animated
    // yet ("my HP dropped before the enemy attacked"). Every card is therefore
    // drawn from this view, which only advances when the matching event plays.
    this.view = { player: null, enemy: null };
  }

  /** Freeze a combatant's presentable state (HP, charge, active buffs). */
  /**
   * The Mythling currently ON SCREEN for a side.
   *
   * A turn resolves all at once inside BattleManager.act() — by the time the
   * event list is played the engine has already moved `battle.enemy` /
   * `battle.player` on to the next combatant. Anything drawn straight from
   * those getters swaps to the replacement while the finishing blow is still
   * animating, so every visual path resolves through this method instead.
   */
  shownMythling(side) {
    const v = this.view && this.view[side];
    if (v && this.battle) {
      const list = side === 'player' ? this.battle.party : this.battle.enemies;
      const found = list && list.find((m) => m.uid === v.uid);
      if (found) return found;
    }
    return side === 'player' ? this.battle?.player : this.battle?.enemy;
  }

  viewOf(m, side) {
    const buffs = {};
    const cb = this.battle && this.battle.combatants.get(m.uid);
    if (cb) {
      for (const [stat, v] of Object.entries(cb.buffs)) {
        if (v && v.stacks !== 0) buffs[stat] = { stacks: v.stacks, total: v.total };
      }
    }
    return { uid: m.uid, side, hp: m.currentHp, maxHp: maxHp(m), charge: m.ultCharge, buffs };
  }

  /** Re-sync both cards with the truth — used at start and once a turn ends. */
  syncView() {
    if (!this.battle) return;
    this.view.player = this.viewOf(this.battle.player, 'player');
    this.view.enemy = this.viewOf(this.battle.enemy, 'enemy');
  }

  // ------------------------------------------------ lifecycle
  start(battle, { mapTheme = 'nature', onEnd }) {
    this.battle = battle;
    this.mapTheme = mapTheme;
    this.onEnd = onEnd;
    this.active = true;
    this.busy = false;
    this.particles = [];
    this.weatherParticles = [];
    this.weatherAt = null;
    this.capture = null;
    this.logLines = [];
    this.anim.player = this.freshAnim();
    this.anim.enemy = this.freshAnim();
    this.bindVFX();
    // bake the combatants' layers once so the first attack never hitches
    prewarm([battle.player.speciesId, battle.enemy.speciesId], [battle.player.stage, battle.enemy.stage], 176);
    this.syncView();
    this.buildUI();
    const enemy = battle.enemy;
    CollectionManager.markSeen(enemy.speciesId, enemy.mutation);
    const intro = battle.type === BattleType.TRAINER
      ? `${battle.trainer.name} wants to battle! (${battle.enemies.length} Mythlings)`
      : `A wild ${displayName(enemy)} Lv.${enemy.level} appeared!`;
    this.pushLog(intro, true);
    if (battle.type === BattleType.TRAINER) this.pushLog(`${battle.trainer.name}: ${battle.trainer.intro}`);
    AudioManager.playTheme(battle.trainer?.finalBoss ? 'boss' : 'battle');
    this.refreshUI();
  }

  /** Gives the VFX layer screen positions and the feedback hooks it needs. */
  bindVFX() {
    SkillVFX.stopAllVFX();
    SkillVFX.bind({
      pos: (side) => this.screenPos(side),
      shake: (amt) => { if (SettingsManager.get('screenShake')) this.shake = Math.max(this.shake, amt); },
      flash: (amt) => { this.flash = Math.max(this.flash, Math.min(0.85, amt)); },
      float: (side, text, color, kind) => this.floatNumber(side, text, color, kind),
    });
  }

  stop() {
    this.active = false;
    this.capture = null;
    SkillVFX.stopAllVFX();
    SkillVFX.unbind();
    if (this.ui) { this.ui.remove(); this.ui = null; }
  }

  // ------------------------------------------------ DOM UI
  buildUI() {
    if (this.ui) this.ui.remove();
    this.ui = el('div', { class: 'battle-ui' });
    this.enemyCard = el('div', { class: 'combatant-card enemy' });
    this.playerCard = el('div', { class: 'combatant-card player' });
    // Announcements sit at the TOP of the battle screen so the creatures and
    // both status cards stay visible while text scrolls.
    this.logBox = el('div', { class: 'battle-log top' });
    this.weatherBadge = el('div', { class: 'weather-badge' });
    this.weatherBadge.hidden = true;
    this.actions = el('div', { class: 'battle-actions panel' });
    this.ui.append(this.logBox, this.weatherBadge, this.enemyCard, this.playerCard, this.actions);
    document.getElementById('app').appendChild(this.ui);
  }

  /** A short centred banner — used when the weather turns over. */
  announce(text, cls = '') {
    if (!this.ui) return;
    const n = el('div', { class: `battle-banner ${cls}`, text });
    this.ui.appendChild(n);
    setTimeout(() => n.classList.add('out'), 950);
    setTimeout(() => n.remove(), 1500);
  }

  pushLog(text, emph = false) {
    this.logLines.push({ text, emph });
    if (this.logLines.length > 4) this.logLines.shift();
    if (this.logBox) {
      this.logBox.innerHTML = '';
      for (const l of this.logLines) this.logBox.appendChild(el('div', { class: l.emph ? 'emph' : '', text: l.text }));
    }
  }

  combatantCard(m, side) {
    const sp = speciesOf(m);
    // HP shown is the ANIMATED value, not the resolved one (see this.view).
    const v = (this.view[side] && this.view[side].uid === m.uid)
      ? this.view[side]
      : this.viewOf(m, side);
    const hp = clamp(v.hp, 0, v.maxHp);
    const pct = v.maxHp > 0 ? hp / v.maxHp : 0;   // 0..1, matching hpPercent()
    const rows = [
      el('div', { class: 'cc-top' }, [
        el('span', { class: 'cc-name' }, [...speciesElements(sp).map((e) => icon(ELEMENTS[e]?.icon || 'spark', `el ${e}`)), el('span', { text: displayName(m) })]),
        mutationChip(m.mutation),
        el('span', { class: 'cc-lv', text: `Lv.${m.level}` }),
        this.matchupButton(m, side),
      ]),
      this.matchupRow(side),
    ];
    // Trainer battles: how big is their team and how much of it is left?
    if (side === 'enemy' && this.battle.type === BattleType.TRAINER) rows.push(this.teamRow());
    rows.push(
      el('div', { class: 'row', style: { gap: '6px', margin: '4px 0' } }, [
        ...elementChips(sp),
        rarityChip(m.rarity),
        el('span', { class: 'chip', text: getMood(m.mood).name }),
      ]),
      bar('hp', pct, hpClass(pct)),
      el('div', { class: 'cc-hp-text', text: `${hp} / ${v.maxHp} HP` }),
      this.buffRow(v),
      this.statusRow(m),
    );
    if (side === 'player') {
      const pips = el('div', { class: 'ult-track' });
      for (let i = 0; i < ULTIMATE_MAX_CHARGE; i++) {
        pips.appendChild(el('div', { class: `ult-pip ${i < v.charge ? 'on' : ''}` }));
      }
      const ready = v.charge >= ULTIMATE_MAX_CHARGE && ultimateUnlocked(m);
      rows.push(pips);
      rows.push(el('div', {
        class: `ult-label ${ready ? 'ready' : ''}`,
        text: ultimateUnlocked(m)
          ? `ULTIMATE ${v.charge}/${ULTIMATE_MAX_CHARGE}${ready ? ' — READY!' : ''}`
          : `ULTIMATE LOCKED (Lv.10)`,
      }));
    }
    return rows;
  }

  /**
   * Trainer party readout: one pip per team member, filled while it can still
   * fight. Lets the player see immediately whether the enemy is down to its
   * last Mythling.
   */
  // How many of the trainer's Mythlings are still standing *on screen*. The
  // engine has already advanced to the replacement, so a Mythling that has
  // fainted but is still being shown stays in the count until its switch
  // event plays — otherwise the counter blinks down before the KO finishes.
  teamLeft() {
    const b = this.battle;
    const left = b.enemies.filter((m) => !isFainted(m)).length;
    const shown = this.shownMythling('enemy');
    return shown && isFainted(shown) ? left + 1 : left;
  }

  teamRow() {
    const b = this.battle;
    const total = b.enemies.length;
    const left = this.teamLeft();
    const name = b.trainer?.name || 'Trainer';
    const row = el('div', { class: `team-row ${left === 1 ? 'last' : ''}` });
    row.dataset.sig = `${left}/${total}`;
    const pips = el('div', { class: 'team-pips' });
    for (let i = 0; i < total; i++) {
      pips.appendChild(el('div', { class: `team-pip ${i < left ? 'alive' : 'down'}` }));
    }
    row.append(
      el('div', { class: 'team-name', text: name }),
      pips,
      el('div', {
        class: 'team-count',
        text: left === 1 ? `1/${total} LEFT — LAST MYTHLING!` : `${left}/${total} LEFT`,
      }),
    );
    row.title = `${name} has ${left} of ${total} Mythlings still able to battle.`;
    return row;
  }

  /** The two Mythlings currently facing each other, or null before the battle starts. */
  facing(side) {
    const b = this.battle;
    if (!b) return { me: null, foe: null };
    const me = side === 'player' ? b.player : b.enemy;
    const foe = side === 'player' ? b.enemy : b.player;
    return { me, foe };
  }

  /**
   * "Am I strong or weak against what I am looking at?" — one chip per card,
   * shown ONLY when the match-up is actually for or against that side. A
   * neutral match-up adds nothing, so a quiet card means "no type advantage
   * either way".
   */
  matchupRow(side) {
    const { me, foe } = this.facing(side);
    const row = el('div', { class: 'matchup-row' });
    row.dataset.sig = `${me?.uid || '-'}>${foe?.uid || '-'}`;
    if (!me || !foe) return row;
    const mine = speciesElements(speciesOf(me));
    const theirs = speciesElements(speciesOf(foe));
    const off = attackMatchup(mine, theirs);
    if (!off.tone) return row;                       // neutral: show nothing at all

    const strong = off.tone === 'strong';
    const who = side === 'player' ? 'YOUR ATTACKS' : 'ITS ATTACKS';
    const chip = el('span', {
      class: `matchup-chip ${off.tone}`,
      title: `${mine.map((e) => ELEMENTS[e].name).join(' / ')} vs ${theirs.map((e) => ELEMENTS[e].name).join(' / ')}`
        + ` = x${off.mult}. ${strong ? 'Super effective — press the advantage.' : 'Not very effective — consider switching.'}`,
    });
    chip.innerHTML = `${iconSvg(strong ? 'up' : 'down', 'tiny')}`
      + `<span class="mu-who">${who}</span>`
      + `<span class="mu-word">${strong ? 'SUPER EFFECTIVE' : 'RESISTED'}</span>`
      + `<span class="mu-mult">x${off.mult}</span>`;
    row.appendChild(chip);
    return row;
  }

  /** Compact match-up tag for a party card in the switch / item picker. */
  matchupTag(m) {
    const foe = this.battle?.enemy;
    if (!foe || foe.uid === m.uid) return null;
    const off = attackMatchup(speciesElements(speciesOf(m)), speciesElements(speciesOf(foe)));
    if (!off.tone) return null;                       // even: say nothing
    const strong = off.tone === 'strong';
    const tag = el('span', {
      class: `matchup-chip mini ${off.tone}`,
      title: `Against ${displayName(foe)}: x${off.mult} damage`,
    });
    tag.innerHTML = `${iconSvg(strong ? 'up' : 'down', 'tiny')}`
      + `<span class="mu-word">${strong ? 'SUPER EFFECTIVE' : 'RESISTED'}</span>`
      + `<span class="mu-mult">x${off.mult}</span>`;
    return tag;
  }

  /** Small icon button on every card: opens the full type sheet for that Mythling. */
  matchupButton(m, side) {
    const b = button('', {
      class: 'cc-info',
      title: `${displayName(m)}: what it is strong against and weak to`,
      onclick: () => this.showTypePanel(m, side),
    });
    b.innerHTML = iconSvg('matchup');
    return b;
  }

  /**
   * The element sheet for whichever TYPE this Mythling is — no names, no
   * roster noise: what the type beats, what beats it, what it shrugs off, and
   * how all of that lands against the type across the arena right now.
   */
  showTypePanel(m, side) {
    const { title, body } = this.typePanel(m, side);
    modal({ title, body, buttons: [{ label: 'CLOSE', value: true, primary: true }] });
  }

  /** Builds the type sheet (title + body) for one combatant. */
  typePanel(m, side) {
    const sp = speciesOf(m);
    const { foe } = this.facing(side);
    const mine = speciesElements(sp);
    const prof = typeProfile(mine);
    const nameOf = (e) => ELEMENTS[e]?.name || e;
    const names = mine.map(nameOf).join(' / ');

    const list = (entries, empty) => {
      if (!entries.length) return el('div', { class: 'tp-empty', text: empty });
      const row = el('div', { class: 'tp-list' });
      for (const e of entries) {
        row.appendChild(el('span', {
          class: `chip ${e.element}`,
          title: `${nameOf(e.element)} \u00d7${e.mult} damage`,
        }, [
          icon(ELEMENTS[e.element]?.icon || 'spark'),
          el('span', { text: nameOf(e.element) }),
          el('b', { class: 'tp-mult', text: `\u00d7${e.mult}` }),
        ]));
      }
      return row;
    };

    const body = el('div', { class: 'type-panel' }, [
      el('div', { class: 'row', style: { gap: '6px', marginBottom: '10px' } }, elementChips(sp)),
    ]);

    // live match-up, element against element: what matters is "am I hitting
    // hard or am I being hit hard", not who is standing there
    if (foe && foe.uid !== m.uid) {
      const theirs = speciesElements(speciesOf(foe));
      const off = attackMatchup(mine, theirs);
      const def = attackMatchup(theirs, mine);
      const row = (label, res) => {
        const tone = res.tone || 'even';
        const word = res.tone === 'strong' ? 'SUPER EFFECTIVE' : res.tone === 'weak' ? 'RESISTED' : 'NEUTRAL';
        return el('div', { class: `tp-vs ${tone}` }, [
          el('span', { class: 'tp-vs-label', text: label }),
          el('span', { class: 'tp-vs-word', text: word }),
          el('span', { class: 'tp-vs-mult', text: `\u00d7${res.mult}` }),
        ]);
      };
      body.appendChild(el('h3', { class: 'tp-head', text: `RIGHT NOW \u00b7 ${names} vs ${theirs.map(nameOf).join(' / ')}` }));
      body.appendChild(row('Attacking', off));
      body.appendChild(row('Taking hits', def));
    }

    body.appendChild(el('h3', { class: 'tp-head', text: 'STRONG AGAINST' }));
    body.appendChild(list(prof.hits, 'Nothing — this type has no offensive advantage.'));
    body.appendChild(el('h3', { class: 'tp-head', text: 'WEAK AGAINST' }));
    body.appendChild(list(prof.weakTo, 'Nothing — no element hits it for extra.'));
    body.appendChild(el('h3', { class: 'tp-head', text: 'RESISTS' }));
    body.appendChild(list(prof.resists, 'Nothing — no element is resisted.'));

    // ---- SEE MORE: this Mythling's current stats, plainly ----
    // Just the numbers the battle uses. No level/stage, no Rarity, no Mood, no
    // Rational and no (+n) deltas: where a number came from is detail-panel
    // business, and the type sheet is about TYPES.
    const detail = el('div', { class: 'tp-stats' });
    for (const r of statBreakdown(m)) {
      detail.appendChild(el('div', { class: 'tp-stat' }, [
        el('span', { class: 'tp-sname', text: STAT_LABELS[r.key] || r.key.toUpperCase() }),
        el('b', { class: 'tp-sval', text: String(r.total) }),
      ]));
    }
    const more = el('div', { class: 'tp-more' }, [
      el('h3', { class: 'tp-head', text: 'CURRENT STATS' }),
      detail,
    ]);
    more.hidden = true;
    const toggle = button('SEE MORE', {
      class: 'tp-toggle',
      onclick: () => {
        more.hidden = !more.hidden;
        toggle.textContent = more.hidden ? 'SEE MORE' : 'SEE LESS';
        body.classList.toggle('expanded', !more.hidden);
      },
    });
    body.appendChild(el('div', { class: 'tp-actions' }, [toggle]));
    body.appendChild(more);

    return { title: `${names} \u2014 TYPE MATCH-UP`, body };
  }

  /**
   * Active buff / debuff chips: which stat, the total modifier and how many
   * stacks are on it. Shown for BOTH sides so the player can read the enemy.
   */
  /** Sleep / Seal chips. Both are battle-only: they die with the fight. */
  statusRow(m) {
    const row = el('div', { class: 'status-row' });
    const cb = this.battle?.cb(m);
    const sleep = cb?.sleep || 0;
    const sealed = cb?.isSealed(cb.sealed) ? cb.sealed : null;
    const guarded = !!cb?.guard;
    const dot = cb?.dot || null;
    row.dataset.sig = this.statusSig(m) + (guarded ? '|g' : '') + (dot ? `|${dot.kind}${dot.turns}` : '');
    if (!sleep && !sealed && !guarded && !dot) {
      row.classList.add('empty');
      row.appendChild(el('span', { class: 'status-none', text: 'No status' }));
      return row;
    }
    if (dot) {
      const burn = dot.kind === 'burn';
      row.appendChild(el('span', { class: `status-chip dot ${burn ? 'burn' : 'poison'}`,
        title: `${burn ? 'Burn' : 'Poison'}: ${dot.perTick} damage at the end of every round, ${dot.turns} turn(s) left. The damage is set when the status lands and scales with this Mythling's level — a higher level burns or poisons harder. Capped at ${DOT_MAX_TURNS} turns, and Guard does not stop it.`,
        text: `${burn ? '\u2733 BURN' : '\u2620 POISON'} ${dot.turns}` }));
    }
    if (guarded) {
      row.appendChild(el('span', { class: 'status-chip guarded',
        title: "Guard Stance is up: the foe's next attack is cancelled outright. It covers this turn only.",
        text: '\u26E8 GUARDED' }));
    }
    if (sleep > 0) {
      row.appendChild(el('span', { class: 'status-chip sleep',
        title: `Asleep for ${sleep} more turn(s) — it loses its whole turn. Sleep is capped at ${SLEEP_MAX_TURNS}, and a Cleanse Tonic wakes it.`,
        text: `\u2601 ASLEEP ${sleep}` }));
    }
    if (sealed) {
      const sk = getSkill(sealed);
      row.appendChild(el('span', { class: 'status-chip sealed',
        title: `${sk?.name || 'A move'} is sealed for ${cb.sealedTurns} more turn(s) — the unlimited Normal attack can never be sealed.`,
        text: `\u26D4 SEALED ${sk?.name || 'move'} \u00B7 ${cb.sealedTurns}` }));
    }
    return row;
  }

  statusSig(m) {
    const cb = this.battle?.cb(m);
    if (!cb) return '-';
    return `${cb.sleep}|${cb.isSealed(cb.sealed) ? `${cb.sealed}:${cb.sealedTurns}` : ''}`;
  }

  buffRow(v) {
    const row = el('div', { class: 'buff-row' });
    const entries = Object.entries(v.buffs || {}).filter(([, b]) => b && b.stacks !== 0);
    if (!entries.length) {
      row.classList.add('empty');
      row.appendChild(el('span', { class: 'buff-none', text: 'No buffs' }));
      return row;
    }
    entries.sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));
    for (const [stat, b] of entries) {
      const up = b.total >= 0;
      const chip = el('span', { class: `buff-chip ${up ? 'up' : 'down'}`, title:
        `${STAT_SHORT[stat] || stat.toUpperCase()} ${up ? 'buffed' : 'lowered'} by ${Math.abs(b.total)} over ${Math.abs(b.stacks)} stack(s) — clears when the battle ends` });
      chip.innerHTML = `<span class="bc-arrow">${up ? '\u25B2' : '\u25BC'}</span>`
        + `<span class="bc-stat">${STAT_SHORT[stat] || stat.toUpperCase()}</span>`
        + `<span class="bc-val">${up ? '+' : ''}${b.total}</span>`
        + `<span class="bc-stacks">x${Math.abs(b.stacks)}</span>`;
      row.appendChild(chip);
    }
    return row;
  }

  refreshUI() {
    if (!this.ui) return;
    const b = this.battle;
    this.rebuildCard(b.enemy, 'enemy');
    this.rebuildCard(b.player, 'player');
    this.syncWeather();
    this.renderActions();
  }

  /** The live weather badge — it stays up for the rest of the battle. */
  syncWeather() {
    if (!this.weatherBadge) return;
    const w = this.battle?.weather ? getWeather(this.battle.weather) : null;
    if (!w) { this.weatherBadge.hidden = true; return; }
    this.weatherBadge.hidden = false;
    this.weatherBadge.className = `weather-badge ${w.element}`;
    this.weatherBadge.innerHTML = '';
    this.weatherBadge.append(
      icon(w.element, 'tiny'),
      el('b', { text: w.name }),
      el('span', { class: 'wb-note', text: `${ELEMENTS[w.element]?.name || w.element} skills x1.5` }),
    );
    this.weatherBadge.title = w.desc;
  }

  rebuildCard(m, side) {
    const card = side === 'player' ? this.playerCard : this.enemyCard;
    const v = (this.view[side] && this.view[side].uid === m.uid) ? this.view[side] : this.viewOf(m, side);
    card.innerHTML = '';
    card.dataset.uid = String(v.uid);
    this.combatantCard(m, side).forEach((n) => card.appendChild(n));
    const row = card.querySelector('.buff-row');
    if (row) row.dataset.sig = JSON.stringify(Object.entries(v.buffs || {}).sort());
  }

  /** "12 uses" / "∞ unlimited" — the tail of every skill button's meta line. */
  usesTag(sk, left) {
    return Number.isFinite(left) ? `${left} uses` : `${iconSvg('infinity', 'tiny')} unlimited`;
  }

  /**
   * Live damage readout for one move against the Mythling across the arena:
   * the number the button shows, coloured by how the elements actually match up
   * (green = super effective, red = resisted, plain white = neutral).
   *
   * Buffs and debuffs on both sides are folded in, so a debuffed Special Attack
   * drops every Special's number the moment it lands. Element-less moves stay
   * neutral — a plain Bite never turns red.
   *
   * @returns {{pv:object, html:string, title:string}|null} null for moves that
   *   deal no damage (buffs, debuffs, support Ultimates): there is no number to show.
   */
  dmgInfo(move, { isUltimate = false } = {}) {
    const b = this.battle;
    if (!b || !b.enemy || !move) return null;
    const pv = previewDamage(b, b.player, b.enemy, move, { isUltimate });
    if (!pv) return null;
    const mid = (DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2;
    const lo = Math.max(1, Math.floor((pv.dmg * DAMAGE_RANDOM_MIN) / mid));
    const hi = Math.max(1, Math.floor((pv.dmg * DAMAGE_RANDOM_MAX) / mid));
    const word = pv.tone === 'strong' ? 'SUPER EFFECTIVE' : pv.tone === 'weak' ? 'RESISTED' : 'neutral damage';
    const html = `<b class="ab-dmg ${pv.tone}">${pv.dmg.toLocaleString('en-US')}</b>`
      + (pv.mult !== 1 ? `<span class="ab-x">\u00d7${pv.mult}</span>` : '');
    const title = `${word}${pv.element ? ` (${ELEMENTS[pv.element]?.name || pv.element})` : ' (no element)'}`
      + ` \u00b7 lands for about ${lo.toLocaleString('en-US')}\u2013${hi.toLocaleString('en-US')}`;
    return { pv, html, title };
  }

  renderActions() {
    const b = this.battle;
    this.actions.innerHTML = '';
    if (this.busy) {
      this.actions.appendChild(el('div', { class: 'row', style: { gridColumn: '1/-1', justifyContent: 'center', color: '#9fb3c9' }, text: '…' }));
      return;
    }
    if (b.phase === BattlePhase.DEFEATED_WILD) { this.renderCaptureActions(); return; }
    if (b.phase !== BattlePhase.ACTIVE) return;

    const p = b.player;
    // One button per equipped skill, in the order they were equipped (1 / 2 / 3).
    const mk = (index) => {
      const sk = equippedSkill(p, index);
      if (!sk) {
        const empty = button('', { class: 'action-btn empty', disabled: true });
        empty.innerHTML = `<div class="ab-name"><span class="slot-badge dim">${index + 1}</span><span>—</span></div><small>Empty · equip in the Skill Library</small>`;
        return empty;
      }
      const left = usesLeft(p, sk.id);
      const sealedFor = b.cb(p).isSealed(sk.id) ? b.cb(p).sealedTurns : 0;
      const disabled = (Number.isFinite(left) && left <= 0) || sealedFor > 0;
      // Damage moves lead with what they will actually do to the foe across the
      // arena right now; support moves keep describing their effect instead.
      const dmg = this.dmgInfo(sk);
      const uses = this.usesTag(sk, left);
      const power = isDamageSkill(sk)
        ? `PWR ${sk.power} · ${sk.damageType === 'physical' ? 'P.ATK' : 'S.ATK'}`
        : `${buffSummary(sk, ' ')} ${sk.category === 'debuff' ? 'foe' : 'self'}`;
      const detail = sealedFor
        ? `<span class="ab-sealed">SEALED \u00B7 ${sealedFor} turn${sealedFor === 1 ? '' : 's'}</span> · ${uses}`
        : dmg ? `${dmg.html} · ${uses}` : `${power} · ${uses}`;
      const glyph = sk.element || (sk.category === 'buff' ? 'shield' : sk.category === 'debuff' ? 'down' : 'strike');
      const btn = button('', { class: `action-btn ${sk.category}`, disabled, onclick: () => this.doAction({ type: 'skill', index }) });
      btn.innerHTML = `<div class="ab-name"><span class="slot-badge">${index + 1}</span>${iconSvg(glyph, sk.element || '')}<span>${sk.name}</span></div>`
        + `<small>${detail}</small>`;
      btn.title = `[${index + 1}] ${sk.desc}${dmg ? ` — PWR ${sk.power} · ${dmg.title}` : ''}`;
      return btn;
    };
    // If every equipped skill is empty (or nothing is equipped at all) there is
    // nothing to press, so offer the guaranteed unlimited attack instead of
    // leaving the player stuck with a dead turn.
    if (this.anySkillUsable()) {
      for (let i = 0; i < MAX_EQUIPPED_SKILLS; i++) this.actions.appendChild(mk(i));
    } else {
      const basic = basicAttack(p);
      const btn = button('', {
        class: 'action-btn basic',
        onclick: () => this.doAction({ type: 'skill', skillId: basic.id }),
      });
      const bDmg = this.dmgInfo(basic);
      btn.innerHTML = `<div class="ab-name">${iconSvg(basic.element || 'strike', basic.element || '')}<span>${basic.name}</span></div>`
        + `<small>${bDmg ? `${bDmg.html} · ` : ''}Out of uses · ${iconSvg('infinity', 'tiny')} unlimited</small>`;
      btn.title = basic.desc + (bDmg ? ` — ${bDmg.title}` : '');
      btn.style.gridColumn = '1/-1';
      this.actions.appendChild(btn);
    }

    // Ultimate
    const ult = ultimateMove(p);
    const unlocked = ultimateUnlocked(p);
    const ready = unlocked && p.ultCharge >= ULTIMATE_MAX_CHARGE;
    const ultBtn = button('', {
      class: `action-btn ultimate ${ready ? 'ready' : ''}`,
      disabled: !ready,
      sfx: 'ultimate-ready',
      onclick: () => this.doAction({ type: 'ultimate' }),
    });
    const ultDmg = unlocked ? this.dmgInfo(ult, { isUltimate: true }) : null;
    ultBtn.innerHTML = unlocked
      ? `<div class="ab-name">${iconSvg('ultimate')}<span>${ult.name}</span></div><small>${ultDmg ? `${ultDmg.html} · ` : ''}${p.ultCharge}/${ULTIMATE_MAX_CHARGE} ${ready ? '— READY' : 'charge'}</small>`
      : `<div class="ab-name">${iconSvg('lock')}<span>ULTIMATE</span></div><small>Unlocks at Lv.10</small>`;
    ultBtn.title = `${ult.desc}${ultDmg ? ` — ${ultDmg.title}` : ''}`;
    const fill = el('div', { class: 'ult-fill', style: { width: `${(p.ultCharge / ULTIMATE_MAX_CHARGE) * 100}%` } });
    ultBtn.appendChild(fill);
    this.actions.appendChild(ultBtn);

    const itemBtn = button('', { class: 'ghost', onclick: () => this.openItems() });
    itemBtn.appendChild(iconLabel('bag', 'ITEM'));
    this.actions.appendChild(itemBtn);
    const partyBtn = button('', { class: 'ghost', onclick: () => this.openSwitch() });
    partyBtn.appendChild(iconLabel('swap', 'PARTY'));
    this.actions.appendChild(partyBtn);
    const catchBtn = button('', {
      class: 'ghost', disabled: true,
      onclick: () => toast('Defeat the wild Mythling first!', 'bad'),
    });
    catchBtn.appendChild(iconLabel('orb', 'CATCH'));
    catchBtn.title = this.battle.type === BattleType.WILD
      ? 'You must defeat the wild Mythling before catching it.'
      : 'You cannot catch another trainer\'s Mythling.';
    this.actions.appendChild(catchBtn);
    // Running is absolute: any battle, any time, and it always works.
    const runBtn = button('', { class: 'ghost', disabled: !this.battle.canRun, onclick: () => this.doAction({ type: 'run' }) });
    runBtn.appendChild(iconLabel('run', 'RUN'));
    runBtn.title = this.battle.type === BattleType.TRAINER
      ? 'Walk away from this trainer battle — it always succeeds. The trainer can be challenged again later.'
      : 'Leave the battle — it always succeeds.';
    this.actions.appendChild(runBtn);
  }

  /** Can any equipped skill still be used? (Otherwise the fallback attack is offered.) */
  anySkillUsable() {
    const p = this.battle?.player;
    if (!p) return false;
    return equippedSkills(p).some(({ id }) => {
      const left = usesLeft(p, id);
      return !Number.isFinite(left) || left > 0;
    });
  }

  /** Keyboard 1 / 2 / 3: use the skill on that battle button (ignored when it is empty or spent). */
  pressSlot(index) {
    if (this.busy || !this.battle || this.battle.phase !== BattlePhase.ACTIVE) return;
    const p = this.battle.player;
    if (!this.anySkillUsable()) {
      if (index === 0) this.doAction({ type: 'skill', skillId: basicAttack(p).id });
      return;
    }
    const sk = equippedSkill(p, index);
    if (!sk) return;
    const left = usesLeft(p, sk.id);
    if (Number.isFinite(left) && left <= 0) { toast(`${sk.name} has no uses left!`, 'bad'); return; }
    this.doAction({ type: 'skill', index });
  }

  renderCaptureActions() {
    const b = this.battle;
    this.actions.innerHTML = '';
    const target = b.enemy;
    const head = el('div', {
      style: { gridColumn: '1/-1', textAlign: 'center', fontWeight: '800', color: '#ffe08a' },
      text: `${displayName(target)} Lv.${target.level} is defeated — choose a ball to capture it!`,
    });
    this.actions.appendChild(head);
    let any = false;
    for (const ballId of BALL_IDS) {
      const qty = InventoryManager.count(ballId);
      const item = getItem(ballId);
      const allowed = CaptureManager.ballAllowed(target, ballId);
      const chance = Math.round(CaptureManager.chanceFor(target, ballId) * 100);
      const btn = button('', { class: 'action-btn ball-btn', disabled: qty <= 0 || !allowed, onclick: () => this.tryCapture(ballId) });
      btn.title = allowed ? `${item.name} — ${ballLook(ballId)} design. ${item.desc}` : `${item.name} cannot hold a LEGENDARY Mythling — Absolute Ball or better only.`;
      btn.appendChild(el('div', { class: 'ab-name' }, [ballCanvas(ballId, 26), el('span', { text: item.name })]));
      btn.appendChild(el('small', { text: allowed ? `x${qty} · ${chance}% catch` : `x${qty} · too weak for a legendary` }));
      this.actions.appendChild(btn);
      if (qty > 0) any = true;
    }
    const leaveBtn = button('', { class: 'ghost', onclick: () => this.finishWild(false) });
    leaveBtn.appendChild(iconLabel('arrowRight', 'LEAVE IT'));
    this.actions.appendChild(leaveBtn);
    if (!any) this.pushLog('You have no balls left! Buy more at a shop.', true);
  }

  // ------------------------------------------------ actions
  async doAction(action) {
    if (this.busy || !this.battle) return;
    this.busy = true;
    this.renderActions();
    const { events } = this.battle.act(action);
    await this.playEvents(events);
    this.busy = false;
    this.refreshUI();
    this.checkPhase();
  }

  async tryCapture(ballId) {
    if (this.busy) return;
    try {
      await this._tryCapture(ballId);
    } catch (err) {
      // A throw during the animation used to leave the scene busy forever with
      // the action bar stuck on "..." — never again: recover and let the player
      // act. (The ball is already spent; the Mythling stays catchable.)
      console.error('capture failed', err);
      this.capture = null;
      this.anim.enemy.alpha = 1;
      this.anim.enemy.scale = 1;
      this.anim.enemy.pull = null;
      this.pushLog('The throw went wide! Try again.', true);
      toast('The throw glitched — you can throw again.', 'bad');
      this.busy = false;
      this.renderActions();
    }
  }

  async _tryCapture(ballId) {
    this.busy = true;
    this.renderActions();
    const target = this.battle.enemy;
    const res = CaptureManager.attempt(target, ballId);
    if (!res.ok) {
      toast(res.reason, 'bad');
      this.busy = false; this.renderActions();
      return;
    }
    AudioManager.sfx('capture');
    this.pushLog(`You threw a ${getItem(ballId).name}!`);
    await this.captureAnimation(ballId, res.success);
    if (!res.success) {
      this.pushLog(`${displayName(target)} broke free!`, true);
      AudioManager.sfx('capture-fail');
      this.anim.enemy.alpha = 1;
      this.busy = false;
      this.renderActions();
      return;
    }
    AudioManager.sfx('capture-success');
    this.anim.enemy.alpha = 0;
    const caught = res.mythling;
    this.pushLog(`Gotcha! ${displayName(caught)} was caught!`, true);

    // Party or storage?
    let destination = 'party';
    if (PartyManager.isFull()) {
      const send = await confirmDialog(
        'PARTY FULL',
        `Your party is full (6/6). Send <b>${displayName(caught)}</b> to storage?`,
        'YES, STORE IT', 'NO, RELEASE'
      );
      if (send) destination = CaptureManager.place(caught, false);
      else destination = 'released';
    } else {
      destination = CaptureManager.place(caught, true);
    }

    await modal({
      title: 'MYTHLING CAPTURED!',
      body: el('div', {}, [
        el('div', { class: 'caught-ball-row' }, [
          ballCanvas(ballId, 54, 'ball-icon big'),
          el('div', {}, [
            el('div', { class: 'caught-ball-name', text: getItem(ballId).name }),
            el('div', { class: 'sub', text: `${ballLook(ballId)} design` }),
          ]),
        ]),
        el('p', { html: `<b>${displayName(caught)}</b> joined you at <b style="color:#ffd76a">Lv.1</b>!` }),
        el('p', { class: 'sub', html: `It was caught at Lv.${caught.meta.caughtLevel} — every captured Mythling restarts at Lv.1 and must be raised by you.` }),
        el('div', { class: 'row', style: { gap: '6px' } }, [
          ...elementChips(speciesOf(caught)),
          rarityChip(caught.rarity),
          el('span', { class: 'chip', text: caught.mood }),
          mutationChip(caught.mutation),
        ]),
        el('p', { class: 'sub', style: { marginTop: '10px' }, text: destination === 'storage' ? 'Sent to Mythling Storage.' : destination === 'released' ? 'You let it go.' : 'Added to your party.' }),
      ]),
      buttons: [{ label: 'CONTINUE', value: true, primary: true }],
    });

    this.battle.capturedMythling = destination === 'released' ? null : caught;
    this.capture = null;
    this.finishWild(true);
  }

  finishWild(captured) {
    this.battle.finishWild();
    this.busy = false;
    this.end(captured ? 'captured' : 'won');
  }

  async openItems() {
    const usable = InventoryManager.all().filter((e) => e.item.category === 'healing' || e.item.cleanse);
    if (!usable.length) { toast('No usable items!', 'bad'); return; }
    const list = el('div', {});
    usable.forEach((entry) => {
      list.appendChild(el('div', { class: 'item-row' }, [
        el('div', { class: 'ir-main' }, [
          el('div', { class: 'ir-name', text: entry.item.name }),
          el('div', { class: 'ir-desc', text: entry.item.desc }),
        ]),
        el('div', { class: 'ir-qty', text: `x${entry.qty}` }),
        button('USE', { class: 'small primary', onclick: () => closeModal(entry.id) }),
      ]));
    });
    const chosen = await modal({ title: 'BAG — BATTLE ITEMS', body: list, buttons: [{ label: 'CANCEL', value: false }], cancelValue: false });
    if (!chosen || typeof chosen !== 'string') return;
    const item = getItem(chosen);
    // A cleanser is judged against the BATTLE (debuffs live there), everything
    // else against the Mythling itself.
    const useful = (m) => (item.cleanse ? this.battle.debuffs(m).length > 0 : applyItemEffects(item, m, { dryRun: true }).ok);
    // pick target — the note says up front whether the item would do anything
    const target = await this.pickPartyMember('Use on which Mythling?', useful, (m) => {
      if (item.cleanse) return this.battle.debuffs(m).length ? null : 'No debuffs to cleanse';
      const dry = applyItemEffects(item, m, { dryRun: true });
      return dry.ok ? null : dry.reason;
    });
    if (!target) return;
    // Never consume an item that would do nothing (full HP, not fainted, ...).
    if (!item.cleanse) {
      const dry = applyItemEffects(item, target, { dryRun: true });
      if (!dry.ok) { toast(dry.reason, 'bad'); AudioManager.sfx('cancel'); return; }
    }
    if (!InventoryManager.remove(chosen, 1)) { toast(`You have no ${item.name} left!`, 'bad'); return; }
    this.doAction({ type: 'item', itemId: chosen, targetUid: target.uid });
  }

  /**
   * Party picker. `filterFn` greys out Mythlings that cannot be chosen and
   * `noteFn` (optional) returns a warning line per Mythling. Cards close the
   * modal through closeModal() so the dismiss handle is always cleared.
   */
  async pickPartyMember(title, filterFn = () => true, noteFn = null) {
    const list = el('div', { class: 'grid-cards' });
    PartyManager.list().forEach((m) => {
      const ok = filterFn(m);
      const note = noteFn ? noteFn(m) : null;
      const card = el('div', { class: `myth-card ${isFainted(m) ? 'fainted' : ''}`, style: ok ? {} : { opacity: .45, pointerEvents: 'none' } }, [
        this.miniCanvas(m),
        el('div', { class: 'mc-main' }, [
          el('div', { class: 'mc-name', text: displayName(m) }),
          el('div', { class: 'mc-sub', text: `Lv.${m.level} · ${m.currentHp}/${maxHp(m)} HP` }),
          bar('hp', hpPercent(m), hpClass(hpPercent(m))),
          // how THIS Mythling would match up against the Mythling on the field,
          // so switching is an informed choice (nothing shown when it is even)
          this.matchupTag(m),
          note ? el('div', { class: 'mc-sub feed-note', text: note }) : null,
        ]),
      ]);
      card.addEventListener('click', () => closeModal(m));
      list.appendChild(card);
    });
    const v = await modal({ title, body: list, buttons: [{ label: 'CANCEL', value: null }], cancelValue: null });
    return v && v.uid ? v : null;
  }

  async openSwitch() {
    const current = this.battle.player;
    const target = await this.pickPartyMember('Send out which Mythling?', (m) => !isFainted(m) && m.uid !== current.uid);
    if (!target) return;
    this.doAction({ type: 'switch', uid: target.uid });
  }

  miniCanvas(m) {
    const cv = el('canvas', { width: 66, height: 66 });
    const ctx = cv.getContext('2d');
    ctx.save(); ctx.translate(33, 58);
    drawMythling(ctx, { speciesId: m.speciesId, stage: m.stage, mutation: m.mutation, x: -4, y: 0, size: 52, t: 0, facing: 1, shadow: false });
    ctx.restore();
    return cv;
  }

  /** Per-combatant render state: pose offsets + the rig animation playing. */
  freshAnim() {
    return {
      lean: 0, tilt: 0, alpha: 1, scale: 1,
      anim: 'battleIdle', animT0: 0, animDur: 0.6, hold: false, flash: 0,
    };
  }

  /**
   * Is this side currently lying KO'd on the field? The faint handler fades the
   * sprite out and leaves the collapse HELD, so a revived Mythling needs this
   * state cleared or it stands back up at full HP with no creature on the field
   * and a stuck, wobbling KO pose still applied every frame.
   */
  isKnockedOut(side) {
    const a = this.anim[side];
    return !!a && (a.anim === 'faint' || a.alpha <= 0.01);
  }

  /**
   * Bring a revived combatant back on the field: kill the held faint pose and
   * fade the sprite in. Shared by revive-on-heal and a switch, which are the
   * only two ways a fallen Mythling re-enters the fight.
   * @returns {boolean} whether there was anything to clear
   */
  reviveSprite(side) {
    const a = this.anim[side];
    if (!a) return false;
    // A Mythling that is still standing has nothing to undo. Crucially, a plain
    // potion must not touch alpha at all, or a healthy sprite would blank out.
    if (!this.isKnockedOut(side) && a.anim !== 'faint') return false;
    a.anim = 'battleIdle'; a.hold = false; a.tilt = 0; a.lean = 0; a.flash = 0;
    a.alpha = 0;                       // faded back in by fadeSpriteBack
    return true;
  }

  /** Ease a revived sprite from invisible to solid, so it does not just pop in. */
  async fadeSpriteBack(side) {
    const a = this.anim[side];
    if (!a) return;
    const fast = SettingsManager.get('textSpeed') === 'instant';
    const steps = fast ? 4 : 10;
    for (let i = 1; i <= steps; i++) {
      a.alpha = i / steps;
      await new Promise((r) => setTimeout(r, fast ? 10 : 22));
    }
    a.alpha = 1;
  }

  /** Starts a creature rig animation (see ANIMATIONS in creatureRig.js). */
  playCreatureAnim(side, name, dur, hold = false) {
    const a = this.anim[side];
    if (!a) return;
    a.anim = name; a.animT0 = this.time; a.animDur = dur || 0.6; a.hold = hold;
  }

  /** 0..1 progress of the current one-shot animation, or null when looping. */
  animPhase(side) {
    const a = this.anim[side];
    if (!a || !a.anim || a.anim === 'battleIdle') return null;
    if (a.hold) return 1;
    const p = (this.time - a.animT0) / (a.animDur || 0.6);
    if (p >= 1) { a.anim = 'battleIdle'; return 1; }
    return p;
  }

  /** What to hand to drawMythling for one side. */
  creaturePose(side) {
    const a = this.anim[side];
    const ph = this.animPhase(side);
    return {
      alpha: a.alpha, tilt: a.tilt,
      anim: ph === null ? 'battleIdle' : { name: a.anim, phase: ph },
      flash: a.flash,
    };
  }

  // ------------------------------------------------ event playback
  async playEvents(events) {
    for (const ev of events) {
      await this.playEvent(ev);
    }
    // the queue is done, so showing the resolved state is now correct
    this.syncView();
  }

  /** Advance the shown HP to the value captured at the moment of this hit. */
  applyViewHp(ev) {
    const v = this.view[ev.side];
    if (!v) return;
    if (ev.mythling && ev.mythling.uid === v.uid) {
      v.hp = ev.mythling.hp;
      v.maxHp = ev.mythling.maxHp;
    } else if (typeof ev.amount === 'number') {
      v.hp = clamp(v.hp + (ev.type === 'heal' ? ev.amount : -ev.amount), 0, v.maxHp);
    }
  }

  async playEvent(ev) {
    const fast = SettingsManager.get('textSpeed') === 'instant';
    const wait = (ms) => new Promise((r) => setTimeout(r, fast ? Math.min(ms, 90) : ms));
    switch (ev.type) {
      case 'log':
        this.pushLog(ev.text, ev.emphasis);
        await wait(ev.emphasis ? 620 : 460);
        break;
      case 'cast': {
        AudioManager.sfx(ev.kind === 'buff' ? 'heal' : 'click');
        if (ev.kind === 'buff' || ev.kind === 'debuff') this.playCreatureAnim(ev.side, 'buff', 0.9);
        else {
          const dur = ev.category === 'special' ? 0.85 : 0.55;
          this.playCreatureAnim(ev.side, ev.category === 'special' ? 'specialAttack' : 'normalAttack', dur);
        }
        // CAST beat: elemental gathering at the caster, then the projectile.
        SkillVFX.playSkillVFX({
          skillId: ev.skillId, side: ev.side, target: ev.target,
          element: ev.element, category: ev.category,
        });
        await wait(ev.kind === 'buff' || ev.kind === 'debuff' ? 260 : 230);
        break;
      }
      case 'ultimate-cast': {
        AudioManager.sfx('ultimate');
        this.flash = 1;
        this.playCreatureAnim(ev.side, 'ultimate', 1.5);
        SkillVFX.playUltimateVFX(ev.side, ev.target, { element: ev.element, skillId: ev.skillId });
        if (SettingsManager.get('screenShake')) this.shake = 16;
        await wait(760);
        break;
      }
      case 'damage': {
        const target = ev.side;
        this.applyViewHp(ev);
        this.playCreatureAnim(target, 'hit', 0.42);
        this.anim[target].flash = ev.crit ? 1 : (ev.effectiveness > 1 ? 0.8 : 0.6);
        AudioManager.sfx(ev.crit ? 'crit' : (ev.isUltimate || ev.effectiveness > 1) ? 'hit-strong' : 'hit');
        if (SettingsManager.get('screenShake')) this.shake = Math.max(this.shake, ev.isUltimate || ev.crit ? 14 : 7);
        // IMPACT beat: the in-flight projectile snaps home, then detonates.
        SkillVFX.finishProjectiles(ev.source, { crit: ev.crit, scale: ev.isUltimate ? 1.3 : 1 });
        SkillVFX.playHitReaction(target, { crit: ev.crit, effectiveness: ev.effectiveness, element: ev.element });
        if (ev.crit) this.flash = Math.max(this.flash, 0.75);
        if (SettingsManager.get('damageNumbers')) {
          const kind = ev.isUltimate ? 'ult' : ev.crit ? 'crit' : ev.category === 'special' ? 'big' : '';
          const accent = ev.element ? paletteFor(ev.element).core : null;
          const label = ev.crit ? `-${ev.amount} CRIT!` : `-${ev.amount}`;
          if (ev.isUltimate || ev.crit || ev.category === 'special') {
            this.floatNumber(target, label, ev.crit ? '#ffd76a' : (accent || '#ffb0b0'), kind);
          } else {
            this.floatNumber(target, label,
              ev.effectiveness > 1 ? '#ffd76a' : ev.effectiveness < 1 ? '#9fb3c9' : '#ff8a8a', kind);
          }
        }
        this.refreshCards();
        await wait(ev.crit ? 520 : 400);
        break;
      }
      case 'heal': {
        AudioManager.sfx('heal');
        // A revive is the one heal that puts a combatant BACK on the field. The
        // faint handler faded its sprite out and left the collapse held, and
        // only a switch used to clear that — so a Max Revive used to leave the
        // Mythling at full HP with an invisible, still-collapsed creature.
        const wasDown = this.reviveSprite(ev.side);
        this.applyViewHp(ev);
        this.floatNumber(ev.side, wasDown ? 'REVIVED' : `+${ev.amount}`, '#6de89a');
        this.refreshCards();
        if (wasDown) { this.playCreatureAnim(ev.side, 'buff', 0.7); await this.fadeSpriteBack(ev.side); }
        await wait(wasDown ? 420 : 330);
        break;
      }
      case 'miss':
        AudioManager.sfx('miss');
        SkillVFX.whiff(ev.side);
        this.floatNumber(ev.side, 'MISS', '#cfe6ff');
        await wait(330);
        break;
      case 'guarded':
        // Guard Stance ate the whole attack: a shield flash, no damage, no shake.
        AudioManager.sfx('cancel');
        SkillVFX.playBuffVFX(ev.side, { stat: 'pdef', up: true, element: 'none' });
        this.floatNumber(ev.side, ev.isUltimate ? 'BLOCKED!' : 'GUARD', '#9fe0ff');
        this.pushLog(ev.isUltimate
          ? 'The Ultimate was cancelled by the Guard Stance!'
          : 'The attack was cancelled by the Guard Stance!');
        this.refreshCards();
        await wait(380);
        break;
      case 'guard':
        AudioManager.sfx('charge');
        SkillVFX.playBuffVFX(ev.side, { stat: 'pdef', up: true, element: 'none' });
        this.floatNumber(ev.side, 'GUARD', '#9fe0ff');
        await wait(300);
        break;
      case 'purge':
      case 'ward': {
        AudioManager.sfx('confirm');
        const lbl = (ev.stats || []).map((k) => STAT_SHORT[k] || k.toUpperCase()).join(', ');
        if (lbl) this.floatNumber(ev.side, ev.type === 'purge' ? `PURGED ${lbl}` : `CLEARED ${lbl}`, ev.type === 'purge' ? '#ffb3e6' : '#b6f09b');
        this.refreshCards();
        await wait(300);
        break;
      }
      case 'coins':
        if (ev.amount > 0) {
          AudioManager.sfx('coin');
          this.pushLog(`The defeated Mythling dropped ${coins(ev.amount)} Wildcoins!`);
          this.floatNumber(ev.side === 'enemy' ? 'enemy' : 'player', `+${ev.amount}`, '#ffe08a');
          await wait(320);
        }
        break;
      case 'buff':
      case 'debuff': {
        AudioManager.sfx(ev.type === 'buff' ? 'charge' : 'cancel');
        const v = this.view[ev.side];
        if (v) {
          const cur = v.buffs[ev.stat] || { stacks: 0, total: 0 };
          // the engine sends the running totals; fall back to accumulating
          v.buffs[ev.stat] = {
            stacks: ev.stacks !== undefined ? ev.stacks : cur.stacks + (ev.type === 'buff' ? 1 : -1),
            total: ev.total !== undefined ? ev.total : cur.total + (ev.type === 'buff' ? ev.amount : -ev.amount),
          };
        }
        const lbl = STAT_SHORT[ev.stat] || ev.stat.toUpperCase();
        const sign = ev.type === 'buff' ? '+' : '-';
        this.floatNumber(ev.side, `${ev.type === 'buff' ? '\u25B2' : '\u25BC'} ${lbl} ${sign}${Math.abs(ev.amount)}`,
          ev.type === 'buff' ? '#b6f09b' : '#ff9aa2', ev.type === 'buff' ? 'buff' : '');
        SkillVFX.playBuffVFX(ev.side, {
          stat: ev.stat, up: ev.type === 'buff',
          element: speciesOf(this.battle[ev.side] || {}).element || 'none',
        });
        this.refreshCards();
        await wait(420);
        break;
      }
      case 'cleanse': {
        AudioManager.sfx('heal');
        const v = this.view[ev.side];
        if (v) for (const stat of ev.stats) delete v.buffs[stat];
        this.floatNumber(ev.side, `\u2726 CLEANSED`, '#b6f09b', 'buff');
        this.refreshCards();
        await wait(420);
        break;
      }
      case 'weather': {
        AudioManager.sfx('charge');
        this.syncWeather();
        this.announce(`${ev.name}!`, ev.element);
        await wait(760);
        break;
      }
      case 'weather-tick': {
        const v = this.view[ev.side];
        if (v) v.hp = Math.max(0, v.hp - ev.amount);
        AudioManager.sfx('hit');
        this.floatNumber(ev.side, `-${ev.amount}`, '#ffb35c', '');
        this.shake = Math.max(this.shake, 3);
        this.refreshCards();
        await wait(340);
        break;
      }
      case 'dot-set': {
        const burn = ev.kind === 'burn';
        this.floatNumber(ev.side, `${burn ? '\u2733' : '\u2620'} ${burn ? 'BURN' : 'PSN'} ${ev.turns}`, burn ? '#ff9a4a' : '#a8e06a', 'buff');
        this.refreshCards();
        await wait(440);
        break;
      }
      case 'dot-tick': {
        const v = this.view[ev.side];
        if (v) v.hp = Math.max(0, v.hp - ev.amount);
        const burn = ev.kind === 'burn';
        AudioManager.sfx(burn ? 'hit' : 'hit');
        this.floatNumber(ev.side, `-${ev.amount}`, burn ? '#ff8c3a' : '#9fd85c', '');
        this.shake = Math.max(this.shake, 3);
        this.refreshCards();
        await wait(340);
        break;
      }
      case 'sleep-set': {
        this.floatNumber(ev.side, `\u2601 SLEEP ${ev.turns}`, '#b0c4ff', 'buff');
        this.refreshCards();
        await wait(440);
        break;
      }
      case 'sleep': {
        this.floatNumber(ev.side, `\u2601 ASLEEP`, '#b0c4ff', 'buff');
        await wait(560);
        break;
      }
      case 'seal': {
        this.floatNumber(ev.side, `\u26D4 SEALED`, '#ffcf6f', 'buff');
        this.refreshCards();
        await wait(440);
        break;
      }
      case 'charge':
        AudioManager.sfx('charge');
        if (this.view[ev.side]) this.view[ev.side].charge = ev.value;
        this.refreshCards();
        await wait(120);
        break;
      case 'ultimate-ready':
        AudioManager.sfx('ultimate-ready');
        this.flash = 0.6;
        await wait(420);
        break;
      case 'faint': {
        AudioManager.sfx('faint');
        const a = this.anim[ev.side];
        this.playCreatureAnim(ev.side, 'faint', 1.0, true);
        for (let i = 0; i < 12; i++) { a.alpha = 1 - i / 12; await wait(26); }
        a.alpha = 0;
        await wait(240);
        break;
      }
      case 'switch': {
        this.reviveSprite(ev.side);
        const a = this.anim[ev.side];
        a.alpha = 1;
        // a fresh combatant brings its own HP and its own buff stack
        this.view[ev.side] = this.viewOf(ev.side === 'player' ? this.battle.player : this.battle.enemy, ev.side);
        this.refreshCards();
        await wait(360);
        break;
      }
      case 'exp': {
        if (ev.amount > 0) this.pushLog(`${ev.name} gained ${ev.amount} EXP!${ev.atCap ? ' (MAX LEVEL)' : ''}`);
        await wait(300);
        for (const lv of ev.result.levels) {
          AudioManager.sfx('levelup');
          this.pushLog(`LEVEL UP! ${ev.name} reached Lv.${lv.level}!`, true);
          this.flash = 0.5;
          await wait(520);
        }
        break;
      }
      case 'wild-defeated':
        await wait(280);
        break;
      default:
        break;
    }
  }

  /**
   * Update the live parts of both cards in place. Rebuilding the whole card on
   * every event would restart the CSS transitions, so the HP bar would snap
   * instead of draining and every buff chip would re-pop each tick.
   */
  refreshCards() {
    if (!this.ui) return;
    this.updateCard(this.shownMythling('enemy'), 'enemy');
    this.updateCard(this.shownMythling('player'), 'player');
  }

  updateCard(m, side) {
    const card = side === 'player' ? this.playerCard : this.enemyCard;
    if (!card || !card.firstChild) return;
    const v = (this.view[side] && this.view[side].uid === m.uid) ? this.view[side] : this.viewOf(m, side);
    if (card.dataset.uid !== String(v.uid)) {   // a different Mythling is out: full rebuild
      card.innerHTML = '';
      card.dataset.uid = String(v.uid);
      this.combatantCard(m, side).forEach((n) => card.appendChild(n));
      return;
    }
    const hp = clamp(v.hp, 0, v.maxHp);
    const pct = v.maxHp > 0 ? hp / v.maxHp : 0;
    const barEl = card.querySelector('.bar.hp');
    if (barEl) {
      barEl.className = `bar hp ${hpClass(pct)}`;
      const fill = barEl.querySelector('i');
      if (fill) fill.style.width = `${pct * 100}%`;
    }
    const txt = card.querySelector('.cc-hp-text');
    if (txt) txt.textContent = `${hp} / ${v.maxHp} HP`;

    // trainer team: rebuild only when the count actually changed
    const oldTeam = card.querySelector('.team-row');
    if (oldTeam && this.battle.type === BattleType.TRAINER) {
      const sig = `${this.battle.enemies.filter((m) => !isFainted(m)).length}/${this.battle.enemies.length}`;
      if (oldTeam.dataset.sig !== sig) oldTeam.replaceWith(this.teamRow());
    }

    // match-up: recompute when EITHER side changes (a switch on the other card
    // flips this card's advantage too)
    const oldMu = card.querySelector('.matchup-row');
    if (oldMu) {
      const { me, foe } = this.facing(side);
      const muSig = `${me?.uid || '-'}>${foe?.uid || '-'}`;
      if (oldMu.dataset.sig !== muSig) oldMu.replaceWith(this.matchupRow(side));
    }

    // buff chips: only touch the DOM when the readout actually changed
    const oldRow = card.querySelector('.buff-row');
    const sig = JSON.stringify(Object.entries(v.buffs || {}).sort());
    if (oldRow && oldRow.dataset.sig !== sig) {
      const row = this.buffRow(v);
      row.dataset.sig = sig;
      oldRow.replaceWith(row);
    }

    // status chips (sleep / sealed): only touch the DOM when they actually change
    const oldStatus = card.querySelector('.status-row');
    const stSig = this.statusSig(m);
    if (oldStatus && oldStatus.dataset.sig !== stSig) oldStatus.replaceWith(this.statusRow(m));

    if (side === 'player') {
      card.querySelectorAll('.ult-pip').forEach((pip, i) => pip.classList.toggle('on', i < v.charge));
      const lbl = card.querySelector('.ult-label');
      if (lbl) {
        const ready = v.charge >= ULTIMATE_MAX_CHARGE && ultimateUnlocked(m);
        lbl.className = `ult-label ${ready ? 'ready' : ''}`;
        lbl.textContent = ultimateUnlocked(m)
          ? `ULTIMATE ${v.charge}/${ULTIMATE_MAX_CHARGE}${ready ? ' \u2014 READY!' : ''}`
          : 'ULTIMATE LOCKED (Lv.10)';
      }
    }
  }

  checkPhase() {
    const b = this.battle;
    if (b.phase === BattlePhase.DEFEATED_WILD) { this.renderActions(); return; }
    if (b.phase === BattlePhase.WON) { this.end('won'); return; }
    if (b.phase === BattlePhase.LOST) { this.end('lost'); return; }
    if (b.phase === BattlePhase.FLED) { this.end('fled'); return; }
  }

  end(outcome) {
    if (this._ended) return;
    this._ended = true;
    const cb = this.onEnd;
    setTimeout(() => {
      this.stop();
      this._ended = false;
      if (cb) cb(outcome, this.battle);
    }, 420);
  }

  // ------------------------------------------------ effects
  screenPos(side) {
    const dpr = this.dpr;
    const W = this.canvas.width / dpr, H = this.canvas.height / dpr;
    const p = SLOT_POS[side];
    return { x: p.x * W, y: p.y * H };
  }

  /**
   * @param {string} kind '' | 'big' (special) | 'crit' | 'ult' | 'buff'
   *   Normal hits stay small, specials read larger, ultimates are emphasised.
   */
  floatNumber(side, text, color, kind = '') {
    const cls = kind === true ? 'crit' : (kind || '');
    const { x, y } = this.screenPos(side);
    const wide = cls === 'crit' || cls === 'ult';
    const n = el('div', {
      class: `dmg-float ${cls}`,
      text,
      style: { left: `${x - (wide ? 60 : 24)}px`, top: `${y - 110}px`, color },
    });
    document.getElementById('app').appendChild(n);
    setTimeout(() => n.remove(), cls === 'ult' ? 1500 : 1100);
  }

  /**
   * Throw → open → absorb → drop → wobble → lock (or burst), drawn with the
   * actual ball the player picked, so a God Ball throw looks like a God Ball.
   */
  async captureAnimation(ballId, success) {
    const from = this.screenPos('player'), to = this.screenPos('enemy');
    const ea = this.anim.enemy;
    const glow = (BALL_ART[ballId] || BALL_ART.basic_ball).glow;
    const ball = { ballId, x: from.x + 30, y: from.y - 96, r: 17, rot: 0, open: 0, alpha: 1, shadow: false, locked: false };
    this.capture = ball;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const tween = (ms, fn) => new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        const k = clamp((performance.now() - t0) / ms, 0, 1);
        fn(k);
        if (k < 1 && this.active) requestAnimationFrame(step); else resolve();
      };
      step();
    });
    const spark = (x, y, opts = {}) => this.particles.push({
      x, y, vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 120,
      life: 0.7, max: 0.7, size: 3 + Math.random() * 3, color: glow, kind: 'spark', ...opts,
    });

    // 1. the throw: an arc from the player's side to the foe
    const sx = ball.x, sy = ball.y, tx = to.x, ty = to.y - 72;
    await tween(560, (k) => {
      ball.x = sx + (tx - sx) * k;
      ball.y = sy + (ty - sy) * k - Math.sin(k * Math.PI) * 130;
      ball.rot = k * Math.PI * 4;
    });
    ball.rot = 0;

    // 2. the seam opens and the Mythling is pulled inside
    this.flash = 0.45;
    ea.pull = { x: ball.x, y: ball.y };
    await tween(540, (k) => {
      ball.open = Math.min(1, k * 1.8);
      ea.alpha = 1 - k;
      ea.scale = 1 - 0.85 * k;
      if (k < 0.85 && Math.random() < 0.6) {
        spark(to.x + (Math.random() - 0.5) * 90, to.y - 60 + (Math.random() - 0.5) * 90, { tx: ball.x, ty: ball.y, speed: 7, vx: 0, vy: 0, life: 0.5, max: 0.5 });
      }
    });
    ea.alpha = 0; ea.scale = 1; ea.pull = null;
    await tween(160, (k) => { ball.open = 1 - k; });

    // 3. it drops to the ground and bounces once
    const groundY = to.y + 4 - ball.r;
    const dropFrom = ball.y;
    await tween(300, (k) => { ball.y = dropFrom + (groundY - dropFrom) * k * k; });
    ball.shadow = true;
    await tween(220, (k) => { ball.y = groundY - Math.sin(k * Math.PI) * 16; });

    // 4. wobble — a guaranteed catch still rocks, a break-out gives up early
    const wobbles = success ? 3 : 1 + randInt(Math.random, 0, 2);
    for (let i = 0; i < wobbles; i++) {
      AudioManager.sfx('click');
      await tween(420, (k) => {
        ball.rot = Math.sin(k * Math.PI * 2) * 0.42;
        ball.x = to.x + Math.sin(k * Math.PI * 2) * 5;
      });
      ball.rot = 0; ball.x = to.x;
      await wait(150);
    }

    // 5. lock in… or burst open
    if (success) {
      ball.locked = true;
      for (let i = 0; i < 18; i++) spark(ball.x, ball.y);
      await wait(700);
      return;
    }
    ball.open = 1;
    this.flash = 0.35;
    for (let i = 0; i < 20; i++) spark(ball.x, ball.y, { color: '#ffffff' });
    await tween(260, (k) => { ball.alpha = 1 - k; ea.alpha = k; });
    this.capture = null;
    ea.alpha = 1;
  }

  /** Charge aura: proof the Ultimate is ready without obscuring the Mythling. */
  drawReadyAura(ctx, side) {
    const b = this.battle;
    const v = this.view[side];
    const m = this.shownMythling(side);
    if (!m || !v || v.uid !== m.uid || !ultimateUnlocked(m)) return;
    if (v.charge < ULTIMATE_MAX_CHARGE) return;
    if (this.anim[side].alpha < 0.05) return;
    const el = speciesOf(m).element;
    const pal = paletteFor(el);
    const { x, y } = this.screenPos(side);
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 2.6);
    // fade the aura out with the creature so a KO reads cleanly
    const a = this.anim[side].alpha;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.16 + 0.12 * pulse) * a;
    const g = ctx.createRadialGradient(x, y - 60, 8, x, y - 60, 96);
    g.addColorStop(0, pal.core);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y - 60, 96, 92, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = (0.35 + 0.25 * pulse) * a;
    ctx.strokeStyle = pal.glow;
    ctx.lineWidth = 2.4;
    const r = 44 + pulse * 5;
    ctx.beginPath(); ctx.ellipse(x, y - 4, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // a few slow motes — deliberately sparse so the creature stays readable
    if (Math.random() < 0.35) {
      SkillVFX.ps.spawn({
        x: x + (Math.random() - 0.5) * 70, y: y - 6,
        vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 30,
        gravity: -8, drag: 0.6, size: 2 + Math.random() * 2.5, sizeEnd: 0,
        life: 0.9 + Math.random() * 0.6, shape: el === 'fire' ? 'spark' : el === 'water' ? 'bubble' : 'leaf',
        color: pal.mid, color2: pal.deep, additive: el === 'fire',
        rot: Math.random() * 6.28, rotSpeed: (Math.random() - 0.5) * 4,
      });
    }
  }

  // ------------------------------------------------ rendering
  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 42);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    for (const side of ['player', 'enemy']) {
      const a = this.anim[side];
      if (a && a.flash > 0) a.flash = Math.max(0, a.flash - dt * 3.6);
    }
    for (const p of this.particles) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      if (p.tx != null) {
        p.travel = Math.min(1, (p.travel || 0) + dt * p.speed);
        p.x += (p.tx - p.x) * p.travel * 0.35;
        p.y += (p.ty - p.y) * p.travel * 0.35;
        if (p.travel >= 1) p.life -= dt * 2.4;
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += (p.kind === 'fire' ? -60 : 260) * dt;
      }
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this._updateWeather(dt);
    SkillVFX.update(dt);
  }

  /**
   * Ambient weather. A small RECYCLED pool (nothing is allocated per frame) —
   * it is atmosphere, not particle spam.
   */
  _updateWeather(dt) {
    const id = this.battle?.weather || null;
    if (id !== this.weatherAt) { this.weatherAt = id; this.weatherParticles.length = 0; }
    if (!id || !this.active) return;
    const w = getWeather(id);
    if (!w) return;
    const dpr = this.dpr || 1;
    const W = this.canvas.width / dpr, H = this.canvas.height / dpr;
    while (this.weatherParticles.length < 24) {
      this.weatherParticles.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 20, vy: 42 + Math.random() * 70,
        r: 1.4 + Math.random() * 2.2,
      });
    }
    const drift = w.particle.kind === 'rain' ? -34 : w.particle.kind === 'ember' ? 6 : 0;
    for (const q of this.weatherParticles) {
      q.x += (q.vx + drift) * dt;
      q.y += q.vy * dt;
      if (q.y > H + 8) { q.y = -8; q.x = Math.random() * W; }
      if (q.x < -12) q.x = W + 8;
      if (q.x > W + 12) q.x = -8;
    }
  }

  render() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const W = this.canvas.width / dpr, H = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    this.drawArena(ctx, W, H);

    const b = this.battle;
    if (!b) { ctx.restore(); return; }

    // enemy
    const ep = this.screenPos('enemy');
    const ea = this.anim.enemy;
    if (ea.alpha > 0.01) {
      const em = this.shownMythling('enemy');
      ctx.save();
      if (ea.pull) {
        // being absorbed: shrink towards the open ball
        const k = ea.scale ?? 1;
        ctx.translate(ea.pull.x, ea.pull.y); ctx.scale(k, k); ctx.translate(-ea.pull.x, -ea.pull.y);
      }
      drawMythling(ctx, {
        speciesId: em.speciesId, stage: em.stage, mutation: em.mutation,
        x: ep.x + ea.lean, y: ep.y, size: 150, t: this.time, facing: -1,
        animTag: 'enemy', pose: this.creaturePose('enemy'),
      });
      ctx.restore();
    }
    if (this.capture) {
      const c = this.capture;
      if (c.locked) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.25 * pulse;
        ctx.strokeStyle = (BALL_ART[c.ballId] || BALL_ART.basic_ball).glow;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 8 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      drawBall(ctx, c.ballId, c.x, c.y, c.r, { t: this.time, open: c.open, rot: c.rot, alpha: c.alpha, shadow: c.shadow });
    }

    // player
    const pp = this.screenPos('player');
    const pa = this.anim.player;
    if (pa.alpha > 0.01) {
      const pm = this.shownMythling('player');
      drawMythling(ctx, {
        speciesId: pm.speciesId, stage: pm.stage, mutation: pm.mutation,
        x: pp.x + pa.lean, y: pp.y, size: 176, t: this.time, facing: 1,
        animTag: 'player', pose: this.creaturePose('player'),
      });
    }

    // a Mythling at full Ultimate charge keeps a subtle elemental aura
    this.drawReadyAura(ctx, 'player');
    this.drawReadyAura(ctx, 'enemy');

    // skill VFX (projectiles, impacts, particles)
    SkillVFX.render(ctx);

    // particles
    for (const p of this.particles) {
      if (p.delay > 0) continue;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.time * 6 + p.size);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'water') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.7, p.size, 0, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'fire') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.8);
        g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, p.color); g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // weather: a colour wash over the whole arena, then the ambient motes
    // (declared here — `w` inside drawArena is a different scope)
    const wx = this.battle?.weather ? getWeather(this.battle.weather) : null;
    if (wx) {
      ctx.fillStyle = wx.tint;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.fillStyle = wx.particle.color;
      ctx.globalAlpha = wx.particle.kind === 'ember' ? 0.5 : 0.38;
      for (const q of this.weatherParticles) {
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255,245,210,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
    SkillVFX.renderScreen(ctx, W, H);
  }

  drawArena(ctx, W, H) {
    const theme = this.mapTheme;
    const palettes = {
      nature: { sky: ['#9fe8ff', '#e8ffd9'], ground: ['#7ecb6a', '#4f9b52'], accent: '#3f8f42' },
      water:  { sky: ['#8fd8ff', '#d7f3ff'], ground: ['#f0e0b4', '#7fc4d8'], accent: '#3fa9f5' },
      fire:   { sky: ['#5a1f18', '#ff9a4a'], ground: ['#5b3c34', '#33211d'], accent: '#ff7a3d' },
      rock:   { sky: ['#3b3f4e', '#d8c7a4'], ground: ['#9a8f78', '#5e574c'], accent: '#7d7a72' },
      electric: { sky: ['#2b2f4a', '#8fa3c8'], ground: ['#7c8c74', '#4a5266'], accent: '#f4d03f' },
      ice:      { sky: ['#8fb6d8', '#eef7ff'], ground: ['#e6f0f8', '#a4cde8'], accent: '#8fdcff' },
      metal:    { sky: ['#3a3d44', '#b8a89a'], ground: ['#7a7470', '#4d4848'], accent: '#a9b4c2' },
      poison:   { sky: ['#2e3a2c', '#9fb08a'], ground: ['#6f8a5a', '#3c4a3c'], accent: '#b06fe0' },
      psychic:  { sky: ['#1a1030', '#7a5ab8'], ground: ['#7f6aa8', '#403864'], accent: '#ff6fb5' },
    };
    const p = palettes[theme] || palettes.nature;
    const w = this.battle?.weather ? getWeather(this.battle.weather) : null;
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    if (w) {                                  // the weather repaints the sky
      sky.addColorStop(0, w.sky[0]); sky.addColorStop(0.55, w.sky[1]); sky.addColorStop(1, w.sky[2]);
    } else {
      sky.addColorStop(0, p.sky[0]); sky.addColorStop(1, p.sky[1]);
    }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // background silhouettes
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 6; i++) {
      const x = (i / 5) * W;
      const h = 90 + ((i * 53) % 90);
      ctx.beginPath();
      ctx.moveTo(x - 120, H * 0.62);
      ctx.lineTo(x, H * 0.62 - h);
      ctx.lineTo(x + 120, H * 0.62);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // ground
    const gr = ctx.createLinearGradient(0, H * 0.55, 0, H);
    gr.addColorStop(0, p.ground[0]); gr.addColorStop(1, p.ground[1]);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.62);
    ctx.quadraticCurveTo(W * 0.5, H * 0.55, W, H * 0.62);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // platforms
    const plat = (x, y, rx) => {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.ellipse(x, y, rx * 1.25, rx * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    const ep = this.screenPos('enemy');
    const pp = this.screenPos('player');
    plat(ep.x, ep.y + 6, 120);
    plat(pp.x, pp.y + 6, 150);

    // ambient motes
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const x = ((i * 137 + this.time * (10 + i % 7)) % (W + 60)) - 30;
      const y = (i * 91 + Math.sin(this.time + i) * 30) % H;
      ctx.globalAlpha = 0.3;
            ctx.fillStyle = ({ fire: '#ffb46a', water: '#e6faff', rock: '#e9dcc4', electric: '#fff6a8', ice: '#ffffff', metal: '#ffb347', poison: '#c07cff', psychic: '#ffc6e4' })[theme] || '#eaffc9';
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
