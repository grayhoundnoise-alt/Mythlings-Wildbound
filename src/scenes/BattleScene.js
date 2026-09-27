// Battle presentation layer: arena rendering, effects, and the battle HUD.
// All rules live in BattleManager — this file only shows them.
import { Battle, BattleType, BattlePhase } from '../systems/BattleManager.js';
import { CaptureManager } from '../systems/CaptureManager.js';
import { InventoryManager, PartyManager, GameState, CollectionManager, bus } from '../systems/GameState.js';
import {
  displayName, speciesOf, computeStats, maxHp, hpPercent, isFainted, ultimateMove,
  ultimateUnlocked, equippedSkill, usesLeft, librarySkills,
} from '../core/mythling.js';
import { getSkill, ULTIMATE_MAX_CHARGE } from '../data/skills.js';
import { ELEMENTS } from '../data/elements.js';
import { BALL_IDS, getItem } from '../data/items.js';
import { drawMythling } from '../render/creatures.js';
import { roundRect, circle } from '../render/worldRenderer.js';
import { el, button, bar, hpClass, elementChip, mutationChip, rarityChip, toast, confirmDialog, modal } from '../ui/ui.js';
import { AudioManager } from '../systems/AudioManager.js';
import { SettingsManager } from '../systems/SettingsManager.js';
import { clamp, randInt } from '../core/utils.js';
import { LEVEL_CAP } from '../data/config.js';

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
    this.anim = { player: { lean: 0, tilt: 0, alpha: 1, scale: 1 }, enemy: { lean: 0, tilt: 0, alpha: 1, scale: 1 } };
    this.busy = false;
    this.ui = null;
    this.onEnd = null;
  }

  // ------------------------------------------------ lifecycle
  start(battle, { mapTheme = 'nature', onEnd }) {
    this.battle = battle;
    this.mapTheme = mapTheme;
    this.onEnd = onEnd;
    this.active = true;
    this.busy = false;
    this.particles = [];
    this.logLines = [];
    this.anim.player = { lean: 0, tilt: 0, alpha: 1, scale: 1 };
    this.anim.enemy = { lean: 0, tilt: 0, alpha: 1, scale: 1 };
    this.buildUI();
    const enemy = battle.enemy;
    CollectionManager.markSeen(enemy.speciesId, enemy.mutation);
    const intro = battle.type === BattleType.TRAINER
      ? `${battle.trainer.name} wants to battle!`
      : `A wild ${displayName(enemy)} Lv.${enemy.level} appeared!`;
    this.pushLog(intro, true);
    if (battle.type === BattleType.TRAINER) this.pushLog(`${battle.trainer.name}: ${battle.trainer.intro}`);
    AudioManager.playTheme(battle.trainer?.finalBoss ? 'boss' : 'battle');
    this.refreshUI();
  }

  stop() {
    this.active = false;
    if (this.ui) { this.ui.remove(); this.ui = null; }
  }

  // ------------------------------------------------ DOM UI
  buildUI() {
    if (this.ui) this.ui.remove();
    this.ui = el('div', { class: 'battle-ui' });
    this.enemyCard = el('div', { class: 'combatant-card enemy' });
    this.playerCard = el('div', { class: 'combatant-card player' });
    this.logBox = el('div', { class: 'battle-log' });
    this.actions = el('div', { class: 'battle-actions panel' });
    this.ui.append(this.enemyCard, this.playerCard, this.logBox, this.actions);
    document.getElementById('app').appendChild(this.ui);
  }

  pushLog(text, emph = false) {
    this.logLines.push({ text, emph });
    if (this.logLines.length > 3) this.logLines.shift();
    if (this.logBox) {
      this.logBox.innerHTML = '';
      for (const l of this.logLines) this.logBox.appendChild(el('div', { class: l.emph ? 'emph' : '', text: l.text }));
    }
  }

  combatantCard(m, side) {
    const sp = speciesOf(m);
    const pct = hpPercent(m);
    const rows = [
      el('div', { class: 'cc-top' }, [
        el('span', { class: 'cc-name', text: displayName(m) }),
        mutationChip(m.mutation),
        el('span', { class: 'cc-lv', text: `Lv.${m.level}` }),
      ]),
      el('div', { class: 'row', style: { gap: '6px', margin: '4px 0' } }, [
        elementChip(sp.element),
        rarityChip(m.rarity),
        el('span', { class: 'chip', text: m.mood }),
      ]),
      bar('hp', pct, hpClass(pct)),
      el('div', { class: 'cc-hp-text', text: `${m.currentHp} / ${maxHp(m)} HP` }),
    ];
    if (side === 'player') {
      const pips = el('div', { class: 'ult-track' });
      for (let i = 0; i < ULTIMATE_MAX_CHARGE; i++) {
        pips.appendChild(el('div', { class: `ult-pip ${i < m.ultCharge ? 'on' : ''}` }));
      }
      const ready = m.ultCharge >= ULTIMATE_MAX_CHARGE && ultimateUnlocked(m);
      rows.push(pips);
      rows.push(el('div', {
        class: `ult-label ${ready ? 'ready' : ''}`,
        text: ultimateUnlocked(m)
          ? `ULTIMATE ${m.ultCharge}/${ULTIMATE_MAX_CHARGE}${ready ? ' — READY!' : ''}`
          : `ULTIMATE LOCKED (Lv.10)`,
      }));
    }
    return rows;
  }

  refreshUI() {
    if (!this.ui) return;
    const b = this.battle;
    this.enemyCard.innerHTML = '';
    this.playerCard.innerHTML = '';
    this.combatantCard(b.enemy, 'enemy').forEach((n) => this.enemyCard.appendChild(n));
    this.combatantCard(b.player, 'player').forEach((n) => this.playerCard.appendChild(n));
    this.renderActions();
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
    const mk = (slot) => {
      const sk = equippedSkill(p, slot);
      if (!sk) return button('—', { class: `action-btn ${slot}`, disabled: true });
      const left = usesLeft(p, sk.id);
      const disabled = Number.isFinite(left) && left <= 0;
      const power = sk.category === 'buff'
        ? sk.effects.map((e) => `${e.stat.toUpperCase()}+${e.amount}`).join(' ')
        : `PWR ${sk.power} · ${sk.damageType === 'physical' ? 'P.ATK' : 'S.ATK'}`;
      const elIcon = sk.element ? ELEMENTS[sk.element].icon : '⚔';
      const btn = button('', { class: `action-btn ${slot}`, disabled, onclick: () => this.doAction({ type: 'skill', slot }) });
      btn.innerHTML = `<div>${elIcon} ${sk.name}</div><small>${power} · ${Number.isFinite(left) ? `${left} uses` : '∞ uses'}</small>`;
      btn.title = sk.desc;
      return btn;
    };
    this.actions.append(mk('normal'), mk('special'), mk('buff'));

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
    ultBtn.innerHTML = unlocked
      ? `<div>★ ${ult.name}</div><small>${p.ultCharge}/${ULTIMATE_MAX_CHARGE} ${ready ? '— READY' : 'charge'}</small>`
      : `<div>★ ULTIMATE</div><small>Unlocks at Lv.10</small>`;
    const fill = el('div', { class: 'ult-fill', style: { width: `${(p.ultCharge / ULTIMATE_MAX_CHARGE) * 100}%` } });
    ultBtn.appendChild(fill);
    this.actions.appendChild(ultBtn);

    this.actions.appendChild(button('🎒 ITEM', { class: 'ghost', onclick: () => this.openItems() }));
    this.actions.appendChild(button('🔄 PARTY', { class: 'ghost', onclick: () => this.openSwitch() }));
    const catchBtn = button('⭕ CATCH', {
      class: 'ghost', disabled: true,
      onclick: () => toast('Defeat the wild Mythling first!', 'bad'),
    });
    catchBtn.title = this.battle.type === BattleType.WILD
      ? 'You must defeat the wild Mythling before catching it.'
      : 'You cannot catch another trainer\'s Mythling.';
    this.actions.appendChild(catchBtn);
    this.actions.appendChild(button(this.battle.type === BattleType.WILD ? '🏃 RUN' : '🚫 NO ESCAPE', {
      class: 'ghost', disabled: this.battle.type !== BattleType.WILD,
      onclick: () => this.doAction({ type: 'run' }),
    }));
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
      const chance = Math.round(CaptureManager.chanceFor(target, ballId) * 100);
      const btn = button('', { class: 'action-btn', disabled: qty <= 0, onclick: () => this.tryCapture(ballId) });
      btn.innerHTML = `<div>⭕ ${item.name}</div><small>x${qty} · ${chance}% catch</small>`;
      this.actions.appendChild(btn);
      if (qty > 0) any = true;
    }
    this.actions.appendChild(button('➡ LEAVE IT', { class: 'ghost', onclick: () => this.finishWild(false) }));
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
    await this.captureAnimation();
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
        el('p', { html: `<b>${displayName(caught)}</b> joined you at <b style="color:#ffd76a">Lv.1</b>!` }),
        el('p', { class: 'sub', html: `It was caught at Lv.${caught.meta.caughtLevel} — every captured Mythling restarts at Lv.1 and must be raised by you.` }),
        el('div', { class: 'row', style: { gap: '6px' } }, [
          elementChip(speciesOf(caught).element),
          rarityChip(caught.rarity),
          el('span', { class: 'chip', text: caught.mood }),
          mutationChip(caught.mutation),
        ]),
        el('p', { class: 'sub', style: { marginTop: '10px' }, text: destination === 'storage' ? 'Sent to Mythling Storage.' : destination === 'released' ? 'You let it go.' : 'Added to your party.' }),
      ]),
      buttons: [{ label: 'CONTINUE', value: true, primary: true }],
    });

    this.battle.capturedMythling = destination === 'released' ? null : caught;
    this.finishWild(true);
  }

  finishWild(captured) {
    this.battle.finishWild();
    this.busy = false;
    this.end(captured ? 'captured' : 'won');
  }

  async openItems() {
    const usable = InventoryManager.all().filter((e) => e.item.category === 'healing');
    if (!usable.length) { toast('No usable items!', 'bad'); return; }
    const list = el('div', {});
    let chosen = null;
    const close = await new Promise((resolve) => {
      usable.forEach((entry) => {
        list.appendChild(el('div', { class: 'item-row' }, [
          el('div', { class: 'ir-main' }, [
            el('div', { class: 'ir-name', text: entry.item.name }),
            el('div', { class: 'ir-desc', text: entry.item.desc }),
          ]),
          el('div', { class: 'ir-qty', text: `x${entry.qty}` }),
          button('USE', { class: 'small primary', onclick: () => { chosen = entry.id; resolve(true); document.getElementById('modal').classList.add('hidden'); } }),
        ]));
      });
      modal({ title: 'BAG — HEALING', body: list, buttons: [{ label: 'CANCEL', value: false }] }).then(() => resolve(false));
    });
    if (!chosen) return;
    // pick target
    const target = await this.pickPartyMember('Use on which Mythling?');
    if (!target) return;
    InventoryManager.remove(chosen, 1);
    this.doAction({ type: 'item', itemId: chosen, targetUid: target.uid });
  }

  async pickPartyMember(title, filterFn = () => true) {
    const list = el('div', { class: 'grid-cards' });
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (done) return; done = true; document.getElementById('modal').classList.add('hidden'); document.getElementById('modal').innerHTML = ''; resolve(v); };
      PartyManager.list().forEach((m) => {
        const ok = filterFn(m);
        const card = el('div', { class: `myth-card ${isFainted(m) ? 'fainted' : ''}`, style: ok ? {} : { opacity: .45, pointerEvents: 'none' } }, [
          this.miniCanvas(m),
          el('div', { class: 'mc-main' }, [
            el('div', { class: 'mc-name', text: displayName(m) }),
            el('div', { class: 'mc-sub', text: `Lv.${m.level} · ${m.currentHp}/${maxHp(m)} HP` }),
            bar('hp', hpPercent(m), hpClass(hpPercent(m))),
          ]),
        ]);
        card.addEventListener('click', () => finish(m));
        list.appendChild(card);
      });
      modal({ title, body: list, buttons: [{ label: 'CANCEL', value: null }] }).then(() => finish(null));
    });
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

  // ------------------------------------------------ event playback
  async playEvents(events) {
    for (const ev of events) {
      await this.playEvent(ev);
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
        const a = this.anim[ev.side];
        a.lean = ev.side === 'player' ? 26 : -26;
        AudioManager.sfx(ev.kind === 'buff' ? 'heal' : 'click');
        this.spawnCastParticles(ev.side, ev.element, ev.kind);
        await wait(230);
        a.lean = 0;
        break;
      }
      case 'ultimate-cast': {
        const a = this.anim[ev.side];
        AudioManager.sfx('ultimate');
        this.flash = 1;
        this.spawnUltimate(ev.side, ev.element);
        a.lean = ev.side === 'player' ? 40 : -40;
        if (SettingsManager.get('screenShake')) this.shake = 16;
        await wait(700);
        a.lean = 0;
        break;
      }
      case 'damage': {
        const target = ev.side;
        this.anim[target].tilt = target === 'player' ? -0.14 : 0.14;
        AudioManager.sfx(ev.isUltimate || ev.effectiveness > 1 ? 'hit-strong' : 'hit');
        if (SettingsManager.get('screenShake')) this.shake = Math.max(this.shake, ev.isUltimate ? 14 : 7);
        this.spawnHit(target, ev.effectiveness);
        if (SettingsManager.get('damageNumbers')) this.floatNumber(target, `-${ev.amount}`, ev.effectiveness > 1 ? '#ffd76a' : ev.effectiveness < 1 ? '#9fb3c9' : '#ff8a8a');
        this.refreshCards();
        await wait(400);
        this.anim[target].tilt = 0;
        break;
      }
      case 'heal':
        AudioManager.sfx('heal');
        this.floatNumber(ev.side, `+${ev.amount}`, '#6de89a');
        this.refreshCards();
        await wait(330);
        break;
      case 'miss':
        AudioManager.sfx('miss');
        this.floatNumber(ev.side, 'MISS', '#cfe6ff');
        await wait(330);
        break;
      case 'buff':
      case 'debuff':
        AudioManager.sfx(ev.type === 'buff' ? 'charge' : 'cancel');
        this.floatNumber(ev.side, `${ev.type === 'buff' ? '▲' : '▼'} ${ev.stat.toUpperCase()}`, ev.type === 'buff' ? '#b6f09b' : '#ff9aa2');
        this.spawnBuff(ev.side, ev.type === 'buff');
        await wait(260);
        break;
      case 'charge':
        AudioManager.sfx('charge');
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
        for (let i = 0; i < 12; i++) { a.alpha = 1 - i / 12; a.tilt = (i / 12) * (ev.side === 'player' ? -0.8 : 0.8); await wait(26); }
        a.alpha = 0;
        await wait(240);
        break;
      }
      case 'switch': {
        const a = this.anim[ev.side];
        a.alpha = 1; a.tilt = 0; a.lean = 0;
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

  refreshCards() {
    if (!this.ui) return;
    const b = this.battle;
    this.enemyCard.innerHTML = '';
    this.playerCard.innerHTML = '';
    this.combatantCard(b.enemy, 'enemy').forEach((n) => this.enemyCard.appendChild(n));
    this.combatantCard(b.player, 'player').forEach((n) => this.playerCard.appendChild(n));
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

  floatNumber(side, text, color) {
    const { x, y } = this.screenPos(side);
    const n = el('div', { class: 'dmg-float', text, style: { left: `${x - 24}px`, top: `${y - 110}px`, color } });
    document.getElementById('app').appendChild(n);
    setTimeout(() => n.remove(), 1100);
  }

  spawnCastParticles(side, element, kind) {
    const from = this.screenPos(side);
    const to = this.screenPos(side === 'player' ? 'enemy' : 'player');
    const color = element ? ELEMENTS[element].color : '#ffe08a';
    const glow = element ? ELEMENTS[element].glow : '#fff4c9';
    const n = kind === 'buff' ? 22 : 28;
    for (let i = 0; i < n; i++) {
      if (kind === 'buff') {
        this.particles.push({
          x: from.x + (Math.random() - 0.5) * 70, y: from.y - Math.random() * 40,
          vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 60,
          life: 0.9, max: 0.9, size: 3 + Math.random() * 4, color: '#b6f09b', kind: 'spark',
        });
      } else {
        const t = i / n;
        this.particles.push({
          x: from.x + (to.x - from.x) * 0.05, y: from.y - 60,
          tx: to.x, ty: to.y - 60,
          vx: 0, vy: 0, travel: 0, speed: 2.4 + Math.random() * 1.6, delay: t * 0.22,
          life: 1.0, max: 1.0, size: 4 + Math.random() * 6,
          color: Math.random() < 0.5 ? color : glow, kind: element === 'fire' ? 'fire' : element === 'water' ? 'water' : 'leaf',
        });
      }
    }
  }

  spawnUltimate(side, element) {
    const to = this.screenPos(side === 'player' ? 'enemy' : 'player');
    const color = element ? ELEMENTS[element].color : '#ffe08a';
    const glow = element ? ELEMENTS[element].glow : '#fff4c9';
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 170;
      this.particles.push({
        x: to.x + Math.cos(a) * r, y: to.y - 60 + Math.sin(a) * r * 0.6,
        vx: -Math.cos(a) * 180, vy: -Math.sin(a) * 120,
        life: 1.1, max: 1.1, size: 5 + Math.random() * 9,
        color: Math.random() < 0.5 ? color : glow,
        kind: element === 'fire' ? 'fire' : element === 'water' ? 'water' : 'leaf',
      });
    }
  }

  spawnHit(side, effectiveness) {
    const p = this.screenPos(side);
    const color = effectiveness > 1 ? '#ffd76a' : effectiveness < 1 ? '#9fb3c9' : '#ffffff';
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 190;
      this.particles.push({
        x: p.x, y: p.y - 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.5, max: 0.5, size: 3 + Math.random() * 5, color, kind: 'spark',
      });
    }
  }

  spawnBuff(side, up) {
    const p = this.screenPos(side);
    for (let i = 0; i < 16; i++) {
      this.particles.push({
        x: p.x + (Math.random() - 0.5) * 80, y: p.y - Math.random() * 20,
        vx: 0, vy: up ? -80 - Math.random() * 40 : 70 + Math.random() * 30,
        life: 0.8, max: 0.8, size: 3 + Math.random() * 3,
        color: up ? '#b6f09b' : '#ff9aa2', kind: 'spark',
      });
    }
  }

  async captureAnimation() {
    const p = this.screenPos('enemy');
    for (let i = 0; i < 14; i++) {
      this.anim.enemy.alpha = 1 - i / 18;
      this.particles.push({
        x: p.x, y: p.y - 60, vx: (Math.random() - 0.5) * 70, vy: -60 - Math.random() * 40,
        life: 0.7, max: 0.7, size: 4 + Math.random() * 4, color: '#ffe08a', kind: 'spark',
      });
      await new Promise((r) => setTimeout(r, 40));
    }
    this.captureWobble = 3;
    await new Promise((r) => setTimeout(r, 900));
    this.captureWobble = 0;
  }

  // ------------------------------------------------ rendering
  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 42);
    this.flash = Math.max(0, this.flash - dt * 2.4);
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
      drawMythling(ctx, {
        speciesId: b.enemy.speciesId, stage: b.enemy.stage, mutation: b.enemy.mutation,
        x: ep.x + ea.lean, y: ep.y, size: 150, t: this.time, facing: -1,
        pose: { alpha: ea.alpha, tilt: ea.tilt },
      });
    }
    if (this.captureWobble) {
      const wob = Math.sin(this.time * 12) * 8;
      ctx.save();
      ctx.translate(ep.x + wob, ep.y - 40);
      circle(ctx, 0, 0, 26, '#e8574f');
      ctx.fillStyle = '#f4f4f4';
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#2a2a33';
      ctx.fillRect(-26, -3, 52, 6);
      circle(ctx, 0, 0, 8, '#ffffff');
      circle(ctx, 0, 0, 5, '#ffd76a');
      ctx.restore();
    }

    // player
    const pp = this.screenPos('player');
    const pa = this.anim.player;
    if (pa.alpha > 0.01) {
      drawMythling(ctx, {
        speciesId: b.player.speciesId, stage: b.player.stage, mutation: b.player.mutation,
        x: pp.x + pa.lean, y: pp.y, size: 176, t: this.time, facing: 1,
        pose: { alpha: pa.alpha, tilt: pa.tilt },
      });
    }

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

    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255,245,210,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawArena(ctx, W, H) {
    const theme = this.mapTheme;
    const palettes = {
      nature: { sky: ['#9fe8ff', '#e8ffd9'], ground: ['#7ecb6a', '#4f9b52'], accent: '#3f8f42' },
      water:  { sky: ['#8fd8ff', '#d7f3ff'], ground: ['#f0e0b4', '#7fc4d8'], accent: '#3fa9f5' },
      fire:   { sky: ['#5a1f18', '#ff9a4a'], ground: ['#5b3c34', '#33211d'], accent: '#ff7a3d' },
    };
    const p = palettes[theme] || palettes.nature;
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, p.sky[0]); sky.addColorStop(1, p.sky[1]);
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
      ctx.fillStyle = theme === 'fire' ? '#ffb46a' : theme === 'water' ? '#e6faff' : '#eaffc9';
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
