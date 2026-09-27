// The pause / player menu: Party, Mythlings (storage), Skills, Bag, Map,
// Collection, Stats, Save, Settings.
import {
  GameState, PartyManager, StorageManager, InventoryManager, CollectionManager, WorldManager,
  PlayerManager, bus,
} from '../systems/GameState.js';
import {
  displayName, speciesOf, computeStats, maxHp, hpPercent, isFainted, stageData,
  libraryByLevel, equippedSkills, equipSkill, unequipSkill, moveSkill, canEquipMore,
  MAX_EQUIPPED_SKILLS, ultimateMove, ultimateUnlocked, expNeeded, applyItemEffects,
  rerollMood, rerollRational,
} from '../core/mythling.js';
import { EvolutionManager } from '../systems/EvolutionManager.js';
import { SPECIES, SPECIES_IDS, getSpecies } from '../data/species.js';
import { MOODS, STAT_LABELS, STAT_KEYS, STAT_SHORT, STAT_INFO, STAT_BAR_MAX, moodSummary, formatStat, getMood, getRational, rationalSummary, RATIONALS } from '../data/moods.js';
import { counterDodgePercent, MAX_UNLOCKED_EVOLUTION_STAGE } from '../data/config.js';
import { openWiki } from './wiki.js';
import { RARITY_ORDER, getRarity } from '../data/rarity.js';
import { MUTATIONS, getMutation } from '../data/mutations.js';
import { ITEM_CATEGORIES, getItem } from '../data/items.js';
import { MAPS, MAP_ORDER } from '../data/maps.js';
import { ELEMENTS, ELEMENT_ORDER } from '../data/elements.js';
import { LEVEL_CAP, PARTY_MAX, ULTIMATE_UNLOCK_LEVEL } from '../data/config.js';
import { drawMythling } from '../render/creatures.js';
import {
  el, button, bar, hpClass, elementChip, rarityChip, mutationChip, toast, modal, closeModal, confirmDialog,
  Screens, panelHeader, closeButton,
} from './ui.js';
import { icon, iconSvg, iconLabel } from './icons.js';
import { ballCanvas, ballLook } from '../render/balls.js';
import { buffSummary, getSkill, SKILL_CATEGORY_LABEL, isDamageSkill, riderSummary, isSupportUltimate } from '../data/skills.js';
import { FeedManager } from '../systems/FeedManager.js';
import { SettingsManager } from '../systems/SettingsManager.js';
import { AudioManager } from '../systems/AudioManager.js';
import { coins, formatTime } from '../core/utils.js';

const TABS = [
  ['party', 'PARTY', 'dna'],
  ['mythlings', 'MYTHLINGS', 'box'],
  ['skills', 'SKILLS', 'strike'],
  ['bag', 'BAG', 'bag'],
  ['map', 'MAP', 'map'],
  ['collection', 'COLLECTION', 'book'],
  ['index', 'INDEX', 'book'],
  ['stats', 'STATS', 'user'],
  ['save', 'SAVE', 'save'],
  ['settings', 'SETTINGS', 'settings'],
];

/**
 * A Mythling portrait.
 *
 * `size` is the design box, but the CSS is free to give the canvas any shape
 * (party chips are wide and short, the starter art is a banner). The drawing is
 * always scaled by the SHORTER side and centred, so a Mythling is never
 * squashed, and the backing store follows the real CSS box at device
 * resolution so it stays crisp.
 */
/** One-line description of what a skill does, shared by the library and the detail panel. */
export function skillMetaText(sk, m = null) {
  const uses = Number.isFinite(sk.uses)
    ? `${m ? `${m.uses[sk.id] ?? 0}/` : ''}${sk.uses} uses`
    : 'Unlimited uses';
  const what = isDamageSkill(sk)
    ? (sk.reflect ? `Returns the last hit x${sk.reflect} · ${sk.damageType === 'physical' ? 'Physical' : 'Special'}` : `Power ${sk.power} · ${sk.damageType === 'physical' ? 'Physical' : 'Special'}`)
    : `${buffSummary(sk, ' ')}${(sk.effects || []).some((e) => e.target) ? '' : (sk.category === 'debuff' ? ' on the foe' : ' on self')}`;
  const rider = !sk.reflect ? riderSummary(sk) : '';
  return `${SKILL_CATEGORY_LABEL[sk.category] || sk.category} · ${what}${rider ? ` · ${rider}` : ''} · ${uses}`;
}

/**
 * Portrait with an element badge in the corner, so the element is readable at a
 * glance on every card (party, storage, index).
 */
export function portrait(m, size = 66, animated = false) {
  const sp = getSpecies(m.speciesId);
  const elId = sp?.element || 'nature';
  const wrap = el('div', { class: 'portrait', style: { width: `${size}px`, height: `${size}px` } }, [mythCanvas(m, size, animated)]);
  const badge = el('span', { class: `el-badge ${elId}`, title: `${ELEMENTS[elId]?.name || elId} type` }, [icon(ELEMENTS[elId]?.icon || 'spark')]);
  wrap.appendChild(badge);
  return wrap;
}

export function mythCanvas(m, size = 66, animated = false) {
  const dpr = () => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const cv = el('canvas', { width: size, height: size });
  const ctx = cv.getContext('2d');
  let bw = 0, bh = 0;
  let clock = 0;

  const fit = () => {
    const d = dpr();
    const w = Math.max(1, Math.round((cv.clientWidth || size) * d));
    const h = Math.max(1, Math.round((cv.clientHeight || size) * d));
    if (w === bw && h === bh) return false;
    bw = w; bh = h;
    cv.width = w; cv.height = h;
    return true;
  };

  const draw = (t = 0) => {
    clock = t;
    fit();
    const d = dpr();
    const w = bw / d, h = bh / d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(w, h) / size;              // uniform: never stretch
    ctx.translate((w - size * s) / 2, (h - size * s) / 2);
    ctx.scale(s, s);
    ctx.save();
    ctx.translate(size / 2, size * 0.88);
    drawMythling(ctx, {
      speciesId: m.speciesId, stage: m.stage ?? 0, mutation: m.mutation || 'none',
      x: -size * 0.06, y: 0, size: size * 0.78, t, facing: 1, shadow: false,
    });
    ctx.restore();
  };

  draw(0);
  // the element usually has no layout yet on the first paint: repaint once it has
  const repaint = () => { if (fit()) draw(clock); };
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(repaint);
    ro.observe(cv);
    cv._ro = ro;
  } else if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(repaint);
  }
  if (animated) {
    let raf, t0 = performance.now();
    const loop = (now) => { draw((now - t0) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const prevStop = cv._stop;
    cv._stop = () => { cancelAnimationFrame(raf); cv._ro && cv._ro.disconnect(); prevStop && prevStop(); };
  }
  cv.redraw = repaint;
  return cv;
}

/** A bar with a small legend above it, so HP and EXP can never be confused. */
export function labeledBar(kind, label, value, pct, extraClass = '', title = '') {
  const wrap = el('div', { class: 'bar-wrap' }, [
    el('div', { class: 'bar-label' }, [
      el('span', { text: label }),
      el('span', { class: 'bar-value', text: value }),
    ]),
    bar(kind, pct, extraClass),
  ]);
  if (title) wrap.title = title;
  return wrap;
}

export class PlayerMenu {
  constructor(game) {
    this.game = game;
    this.tab = 'party';
    this.selected = null;
    this.storageFilters = {};
  }

  open(tab = 'party') {
    this.tab = tab;
    this.node = el('div', { class: 'menu-screen panel screen-inner' });
    Screens.push(this.node, 'player-menu', () => this.close());
    this.render();
  }

  close() {
    Screens.clear();
    this.game.resumeOverworld();
  }

  render() {
    this.node.innerHTML = '';
    const tabs = el('div', { class: 'menu-tabs' });
    for (const [id, label, ico] of TABS) {
      const b = el('button', { class: `menu-tab ${this.tab === id ? 'active' : ''}` }, [icon(ico), el('span', { text: label })]);
      b.addEventListener('click', () => { AudioManager.sfx('click'); this.tab = id; this.render(); });
      tabs.appendChild(b);
    }
    tabs.appendChild(el('div', { class: 'spacer', style: { flex: '1' } }));
    const back = button('', { class: 'primary small', onclick: () => this.close() });
    back.appendChild(iconLabel('chevronRight', 'RETURN TO GAME'));
    tabs.appendChild(back);

    const body = el('div', { class: 'menu-body' });
    this.body = body;
    // Every panel in the game carries the same header: title left, X right.
    this.head = el('div', { class: 'panel-head sticky' }, [
      el('div', { class: 'panel-head-text' }, [el('h2', { class: 'panel-title', text: 'Party' })]),
      closeButton(() => this.close(), 'Close menu (ESC)'),
    ]);
    const col = el('div', { class: 'menu-col' }, [this.head, body]);
    this.node.append(tabs, col);
    this.renderTab();
  }

  /** Sets the shared header title and returns the body root. */
  setTitle(text) {
    const h = this.head?.querySelector('.panel-title');
    if (h) h.textContent = text;
  }

  renderTab() {
    const b = this.body;
    b.innerHTML = '';
    this.setTitle((TABS.find((t) => t[0] === this.tab) || [, 'Menu'])[1]);
    switch (this.tab) {
      case 'party': this.renderParty(b); break;
      case 'mythlings': this.renderStorage(b); break;
      case 'skills': this.renderSkills(b); break;
      case 'bag': this.renderBag(b); break;
      case 'map': this.renderMap(b); break;
      case 'collection': this.renderCollection(b); break;
      case 'index': this.renderIndex(b); break;
      case 'stats': this.renderStats(b); break;
      case 'save': this.renderSave(b); break;
      case 'settings': this.renderSettings(b); break;
      default: break;
    }
  }

  // ---------------------------------------------------- PARTY
  renderParty(root) {
    this.setTitle(`Party  (${PartyManager.count()}/${PARTY_MAX})`);
    root.appendChild(el('p', { class: 'sub', text: 'Click a Mythling for full details. Use the arrows to reorder — the first Mythling leads every battle.' }));
    const grid = el('div', { class: 'grid-cards' });
    PartyManager.list().forEach((m, i) => {
      grid.appendChild(this.mythCard(m, {
        extra: el('div', { class: 'row', style: { gap: '4px', marginTop: '4px' } }, [
          iconBtn('up', 'Move up', { class: 'small ghost', disabled: i === 0, onclick: (e) => { e.stopPropagation(); PartyManager.swap(i, i - 1); this.renderTab(); } }),
          iconBtn('down', 'Move down', { class: 'small ghost', disabled: i === PartyManager.count() - 1, onclick: (e) => { e.stopPropagation(); PartyManager.swap(i, i + 1); this.renderTab(); } }),
          iconTextBtn('box', 'Storage', { class: 'small ghost', disabled: PartyManager.count() <= 1, onclick: (e) => { e.stopPropagation(); if (StorageManager.fromParty(m.uid)) { toast(`${displayName(m)} sent to storage`); this.renderTab(); } else toast('You must keep at least one Mythling!', 'bad'); } }),
        ]),
      }));
    });
    root.appendChild(grid);
  }

  mythCard(m, { extra, onClick } = {}) {
    const sp = speciesOf(m);
    const pct = hpPercent(m);
    const evoReady = EvolutionManager.isReady(m);
    const card = el('div', { class: `myth-card ${isFainted(m) ? 'fainted' : ''}` }, [
      portrait(m, 66),
      el('div', { class: 'mc-main' }, [
        el('div', { class: 'mc-name' }, [
          displayName(m),
          m.level >= LEVEL_CAP ? el('span', { class: 'chip max', text: 'MAX' }) : null,
          evoReady ? el('span', { class: 'chip evolve icon-only', title: 'Ready to evolve! Open the card and press EVOLVE NOW.', 'aria-label': 'Ready to evolve' }, [icon('levelup')]) : null,
          mutationChip(m.mutation),
        ]),
        el('div', { class: 'mc-sub', text: `Lv.${m.level} · ${sp.displayName} · ${getMood(m.mood).name} · ${rationalSummary(m.rational).name} · ${getRarity(m.rarity).name}` }),
        labeledBar('hp', 'HP', `${m.currentHp}/${maxHp(m)}`, pct, hpClass(pct)),
        labeledBar('exp', 'EXP',
          m.level >= LEVEL_CAP ? 'MAX LEVEL' : `${m.exp} / ${expNeeded(m)}`,
          m.level >= LEVEL_CAP ? 1 : m.exp / expNeeded(m),
          '', 'EXP is kept forever — healing only restores HP, skill uses and Ultimate Charge.'),
        extra || null,
      ]),
    ]);
    card.addEventListener('click', () => (onClick ? onClick(m) : this.openDetail(m)));
    return card;
  }

  // ---------------------------------------------------- DETAIL
  openDetail(m) {
    const sp = speciesOf(m);
    const stats = computeStats(m);
    const mood = moodSummary(m.mood);
    const evoNext = EvolutionManager.nextStageInfo(m);
    const locked = EvolutionManager.lockedStages(m);
    const ult = ultimateMove(m);

    const rational = getRational(m.rational);
    const statRows = STAT_KEYS.map((k) => {
      const moodUp = getMood(m.mood).up.includes(k);
      const ratUp = rational?.up === k;
      const isDown = rational?.down === k;
      const isUp = moodUp || ratUp;
      const maxRef = STAT_BAR_MAX[k] || 90;
      const why = [moodUp ? `Mood ${getMood(m.mood).name}` : '', ratUp ? `Rational ${rational.name} +10` : '', isDown ? `Rational ${rational.name} -10` : ''].filter(Boolean).join(' · ');
      return el('div', { class: `stat-row ${isUp ? 'up' : ''} ${isDown ? 'down' : ''}`, title: `${STAT_INFO[k]}${why ? ` (${why})` : ''}` }, [
        el('span', { class: 'stat-name' }, [el('span', { text: STAT_LABELS[k] }), moodUp ? icon('up', 'tiny') : null, ratUp ? icon('up', 'tiny') : null, isDown ? icon('down', 'tiny') : null]),
        el('div', { class: 'sbar' }, [el('i', { style: { width: `${Math.min(100, (stats[k] / maxRef) * 100)}%` } })]),
        el('b', { text: formatStat(k, stats[k]) }),
      ]);
    });

    const body = el('div', { class: 'detail-wrap' }, [
      el('div', {}, [
        el('div', { class: 'detail-art' }, [mythCanvas(m, 240, true)]),
        el('div', { class: 'row', style: { gap: '6px', marginTop: '10px', justifyContent: 'center' } }, [
          elementChip(sp.element), rarityChip(m.rarity),
          el('span', { class: 'chip', title: 'Mood', text: getMood(m.mood).name }),
          el('span', { class: 'chip', title: 'Rational', text: rationalSummary(m.rational).name }),
          mutationChip(m.mutation),
        ]),
        el('p', { class: 'sub', style: { marginTop: '10px', fontSize: '.85rem' }, text: sp.description }),
        el('div', { class: 'row', style: { gap: '6px' } }, [
          iconTextBtn('pencil', 'Nickname', { class: 'small ghost', onclick: async () => {
            const input = el('input', { type: 'text', value: m.nickname || '', maxlength: 12 });
            const ok = await modal({ title: 'NICKNAME', body: el('div', {}, [el('p', { class: 'sub', text: 'Leave blank to use the species name.' }), input]), buttons: [{ label: 'CANCEL', value: false }, { label: 'SAVE', value: true, primary: true }] });
            if (ok) { m.nickname = input.value.trim().slice(0, 12) || null; toast('Nickname updated'); this.renderTab(); }
          } }),
          EvolutionManager.isReady(m) ? iconTextBtn('levelup', 'EVOLVE NOW', { class: 'small primary', onclick: () => { closeModal(true); this.game.runEvolution(m, () => this.renderTab()); } }) : null,
        ]),
      ]),
      el('div', {}, [
        el('h3', { text: `${displayName(m)}  ·  Lv.${m.level}${m.level >= LEVEL_CAP ? '  (MAX LEVEL)' : ''}` }),
        el('div', { class: 'mc-sub', text: `Species: ${sp.displayName} · Breed: ${sp.breed} · Role: ${sp.role} · Form: ${stageData(m).name} (stage ${m.stage + 1})` }),
        el('div', { style: { margin: '8px 0' } }, [
          labeledBar('exp', 'EXP',
            m.level >= LEVEL_CAP ? 'MAX LEVEL' : `${m.exp} / ${expNeeded(m)}`,
            m.level >= LEVEL_CAP ? 1 : m.exp / expNeeded(m),
            '', 'EXP is never lost when healing — only HP, skill uses and Ultimate Charge are restored.'),
        ]),
        el('h3', { text: 'Stats' }),
        el('div', { class: 'stat-rows' }, statRows),
        el('div', { class: 'mc-sub', style: { marginTop: '6px' }, html:
          `In battle: <b>${Math.round(counterDodgePercent(stats.counter))}%</b> dodge (Counter ${stats.counter}) · `
          + `<b>${stats.crit}%</b> crit chance · crit damage <b>+${stats.critMult}%</b> (x${(1 + stats.critMult / 100).toFixed(2)})` }),
        el('div', { class: 'mc-sub', style: { marginTop: '6px' }, html: `Mood <b>${getMood(m.mood).name}</b>: ${iconSvg('up', 'tiny')} ${mood.up.join(', ')} — magnitude ${getRarity(m.rarity).magnitude} (rarity ${m.rarity}) · Rational <b>${rationalSummary(m.rational).name}</b>: ${iconSvg('up', 'tiny')} ${rationalSummary(m.rational).up} +10 &nbsp; ${iconSvg('down', 'tiny')} ${rationalSummary(m.rational).down} -10${getMutation(m.mutation).statBonus ? ` · ${getMutation(m.mutation).name} +${getMutation(m.mutation).statBonus} to every stat` : ''}` }),
        el('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } }, [
          iconTextBtn('swap', `Re-roll Mood (Mood Tonic ×${InventoryManager.count('mood_tonic')})`, { class: 'small ghost', disabled: !InventoryManager.has('mood_tonic', 1), title: InventoryManager.has('mood_tonic', 1) ? 'Uses one Mood Tonic: the Mood becomes a different one at random.' : 'Buy a Mood Tonic at a shop (Azure Coast onward).', onclick: async () => {
            const ok = await confirmDialog('RE-ROLL MOOD', `Use a Mood Tonic on ${displayName(m)}? Its Mood (${getMood(m.mood).name}) becomes a different one at random. This cannot be undone.`);
            if (!ok) return;
            if (!InventoryManager.has('mood_tonic', 1)) { toast('You have no Mood Tonic left.', 'bad'); return; }
            InventoryManager.remove('mood_tonic', 1);
            const r = rerollMood(m);
            AudioManager.sfx('heal');
            toast(`${displayName(m)}'s Mood: ${getMood(r.before).name} → ${getMood(r.after).name}`, 'ok');
            closeModal(true); this.renderTab(); this.openDetail(m);
          } }),
          iconTextBtn('swap', `Re-roll Rational (Temper Tonic ×${InventoryManager.count('temper_tonic')})`, { class: 'small ghost', disabled: !InventoryManager.has('temper_tonic', 1), title: InventoryManager.has('temper_tonic', 1) ? 'Uses one Temper Tonic: the Rational (+10 / -10 trait) becomes a different one at random.' : 'Buy a Temper Tonic at a shop (Azure Coast onward).', onclick: async () => {
            const ok = await confirmDialog('RE-ROLL RATIONAL', `Use a Temper Tonic on ${displayName(m)}? Its Rational (${rationalSummary(m.rational).name}: ${rationalSummary(m.rational).up} +10 / ${rationalSummary(m.rational).down} -10) becomes a different one at random. This cannot be undone.`);
            if (!ok) return;
            if (!InventoryManager.has('temper_tonic', 1)) { toast('You have no Temper Tonic left.', 'bad'); return; }
            InventoryManager.remove('temper_tonic', 1);
            const r = rerollRational(m);
            AudioManager.sfx('heal');
            toast(`${displayName(m)}'s Rational: ${rationalSummary(r.before).name} → ${rationalSummary(r.after).name}`, 'ok');
            closeModal(true); this.renderTab(); this.openDetail(m);
          } }),
        ]),

        el('h3', { text: `Equipped Skills (${equippedSkills(m).length}/${MAX_EQUIPPED_SKILLS})` }),
        ...Array.from({ length: MAX_EQUIPPED_SKILLS }, (_, i) => {
          const sk = m.skills[i] ? getSkill(m.skills[i]) : null;
          return el('div', { class: `skill-row ${sk ? 'equipped' : ''}` }, [
            el('span', { class: 'slot-badge', text: String(i + 1) }),
            el('div', { style: { flex: '1' } }, [
              el('div', { class: 'sk-name', text: sk ? sk.name : '— empty button —' }),
              el('div', { class: 'sk-meta', text: sk ? skillMetaText(sk, m) : 'Equip a skill in the Skill Library.' }),
            ]),
          ]);
        }),
        el('div', { class: 'skill-row', style: { borderColor: '#ffd76a' } }, [
          el('div', { style: { flex: '1' } }, [
            el('div', { class: 'sk-name', html: `${iconSvg('ultimate', 'gold')} ${ult.name}` }),
            el('div', { class: 'sk-meta', text: ultimateUnlocked(m) ? `ULTIMATE · Power ${ult.power} · Charge ${m.ultCharge}/8 · cannot be replaced` : `ULTIMATE · locked until Lv.${ULTIMATE_UNLOCK_LEVEL}` }),
          ]),
        ]),
        iconTextBtn('strike', 'Open Skill Library', { class: 'small ghost', onclick: () => { closeModal(true); this.tab = 'skills'; this.selected = m.uid; this.render(); } }),

        el('h3', { text: 'Evolution' }),
        el('div', { class: 'mc-sub', html: evoNext
          ? (evoNext.locked
            ? `Next: <b>${evoNext.name}</b> at Lv.${evoNext.level} — <span style="color:#ff9aa2">LOCKED (future update)</span>`
            : `Next: <b>${evoNext.name}</b> at Lv.${evoNext.level} — ${evoNext.reached ? '<span style="color:#6de89a">READY!</span>' : `${evoNext.level - m.level} levels to go`}`)
          : 'Final form available in this version.' }),
        ...locked.map((s) => el('div', { class: 'mc-sub locked-row', style: { opacity: .6 }, html: `${iconSvg('lock', 'tiny')} ${s.name} — Lv.${s.level} (future content)` })),

        el('h3', { text: 'Capture Info' }),
        el('div', { class: 'mc-sub caught-line' }, [
          m.meta?.caughtWith && !m.meta?.isStarter ? ballCanvas(m.meta.caughtWith, 24) : null,
          el('span', { text: m.meta?.isStarter
            ? 'Your starter partner — chosen at the beginning of your journey.'
            : m.meta?.caughtLevel
              ? `Caught at Lv.${m.meta.caughtLevel} with a ${getItem(m.meta.caughtWith)?.name || 'ball'} (${ballLook(m.meta.caughtWith)}) in ${MAPS[m.meta.originMap]?.displayName || 'the wild'} — restarted at Lv.1.`
              : 'Origin unknown.' }),
        ]),
      ]),
    ]);

    // Wide + scrollable: this panel used to run far past the bottom of the screen.
    modal({ title: displayName(m).toUpperCase(), body, wide: true, buttons: [{ label: 'CLOSE', value: true, primary: true }] });
  }

  // ---------------------------------------------------- STORAGE
  renderStorage(root) {
    this.setTitle(`Mythling Storage  (${StorageManager.list().length})`);
    const f = this.storageFilters;
    const filters = el('div', { class: 'filters' }, [
      el('input', { type: 'text', placeholder: 'Search…', style: { width: '160px', fontSize: '.9rem', letterSpacing: 'normal', textTransform: 'none' }, oninput: (e) => { f.query = e.target.value; this.renderStorageList(); } }),
      select('Element', ['', ...Object.keys(ELEMENTS)], (v) => { f.element = v || null; this.renderStorageList(); }),
      select('Species', ['', ...SPECIES_IDS], (v) => { f.species = v || null; this.renderStorageList(); }),
      select('Rarity', ['', ...RARITY_ORDER], (v) => { f.rarity = v || null; this.renderStorageList(); }),
      select('Mood', ['', ...Object.keys(MOODS)], (v) => { f.mood = v || null; this.renderStorageList(); }),
      select('Mutation', ['', ...Object.keys(MUTATIONS)], (v) => { f.mutation = v || null; this.renderStorageList(); }),
      select('Sort', ['level-desc', 'level-asc', 'name', 'rarity'], (v) => { f.sort = v; this.renderStorageList(); }),
    ]);
    root.appendChild(filters);
    this.storageList = el('div', { class: 'grid-cards' });
    root.appendChild(this.storageList);
    this.renderStorageList();
  }

  renderStorageList() {
    const f = this.storageFilters;
    let list = StorageManager.filter(f);
    const sort = f.sort || 'level-desc';
    list = [...list].sort((a, b) => {
      if (sort === 'level-asc') return a.level - b.level;
      if (sort === 'name') return displayName(a).localeCompare(displayName(b));
      if (sort === 'rarity') return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
      return b.level - a.level;
    });
    this.storageList.innerHTML = '';
    if (!list.length) {
      this.storageList.appendChild(el('p', { class: 'sub', text: 'Storage is empty. Catch more Mythlings!' }));
      return;
    }
    for (const m of list) {
      this.storageList.appendChild(this.mythCard(m, {
        extra: el('div', { class: 'mc-actions' }, [
          iconTextBtn('dna', 'Party', {
            class: 'small primary', disabled: PartyManager.isFull(),
            onclick: (e) => { e.stopPropagation(); if (StorageManager.toParty(m.uid)) { toast(`${displayName(m)} joined your party`); this.renderStorageList(); } else toast('Party is full!', 'bad'); },
          }),
          iconTextBtn('close', 'Release', {
            class: 'small ghost',
            onclick: (e) => { e.stopPropagation(); this.releaseFromStorage(m); },
          }),
        ]),
      }));
    }
  }

  // ---------------------------------------------------- SKILLS
  renderSkills(root) {
    this.setTitle('Skill Library');
    root.appendChild(el('p', { class: 'sub', text:
      `Equip up to ${MAX_EQUIPPED_SKILLS} skills — any mix of Normal, Special, Buff and Debuff. `
      + 'The ORDER you equip them in is the order of the battle buttons: the first equipped is button 1 (leftmost), then 2, then 3. '
      + 'Skills are listed in the order they are learned. Everything learned stays in the library — nothing is ever lost. '
      + 'The Ultimate is fixed to the species and cannot be replaced.' }));
    const party = PartyManager.list();
    const sel = this.selected && party.find((m) => m.uid === this.selected) || party[0];
    const picker = el('div', { class: 'row', style: { marginBottom: '14px' } }, party.map((m) =>
      button(`${displayName(m)} Lv.${m.level}`, {
        class: `small ${sel.uid === m.uid ? 'primary' : 'ghost'}`,
        onclick: () => { this.selected = m.uid; this.renderTab(); },
      })));
    root.appendChild(picker);
    if (!sel) return;

    // ---- the loadout: three battle buttons, in order ----
    const equipped = equippedSkills(sel);
    root.appendChild(el('h3', { text: `Battle buttons (${equipped.length}/${MAX_EQUIPPED_SKILLS})` }));
    const strip = el('div', { class: 'loadout-strip' });
    for (let i = 0; i < MAX_EQUIPPED_SKILLS; i++) {
      const entry = equipped.find((e) => e.index === i) || null;
      const sk = entry ? entry.skill : null;
      strip.appendChild(el('div', { class: `loadout-slot ${sk ? `filled ${sk.category}` : 'empty'}` }, [
        el('div', { class: 'ls-head' }, [
          el('span', { class: 'slot-badge', text: String(i + 1) }),
          el('span', { class: 'ls-name', html: sk ? `${iconSvg(sk.element || (sk.category === 'buff' ? 'shield' : sk.category === 'debuff' ? 'down' : 'strike'), sk.element || '')} ${sk.name}` : 'Empty' }),
        ]),
        el('div', { class: 'ls-meta', text: sk ? skillMetaText(sk, sel) : 'Pick a skill below.' }),
        sk ? el('div', { class: 'row', style: { gap: '4px', marginTop: '6px' } }, [
          i > 0 ? button('◀', { class: 'small ghost', title: 'Move left (earlier button)', onclick: () => { moveSkill(sel, i, i - 1); AudioManager.sfx('click'); this.renderTab(); } }) : null,
          i < equipped.length - 1 ? button('▶', { class: 'small ghost', title: 'Move right (later button)', onclick: () => { moveSkill(sel, i, i + 1); AudioManager.sfx('click'); this.renderTab(); } }) : null,
          button('UNEQUIP', { class: 'small ghost', onclick: () => { unequipSkill(sel, i); AudioManager.sfx('cancel'); this.renderTab(); } }),
        ]) : null,
      ]));
    }
    root.appendChild(strip);

    const ult = ultimateMove(sel);
    root.appendChild(el('div', { class: 'skill-row', style: { borderColor: '#ffd76a' } }, [
      el('span', { class: 'slot-badge gold', text: '4' }),
      el('div', { style: { flex: '1' } }, [
        el('div', { class: 'sk-name', html: `${iconSvg('ultimate', 'gold')} ${ult.name} (ULTIMATE — fixed)` }),
        el('div', { class: 'sk-meta', text: ultimateUnlocked(sel) ? `Power ${ult.power} · Charge ${sel.ultCharge}/8 · upgrades with evolution` : `Locked until Lv.${ULTIMATE_UNLOCK_LEVEL}` }),
      ]),
    ]));

    // ---- the library, in unlock order ----
    root.appendChild(el('h3', { text: 'Learned skills — by unlock level' }));
    const entries = libraryByLevel(sel);
    if (!entries.length) { root.appendChild(el('p', { class: 'sub', text: 'None learned yet.' })); return; }
    let lastLevel = null;
    for (const { skill: sk, level, index } of entries) {
      if (level !== lastLevel) {
        lastLevel = level;
        root.appendChild(el('div', { class: 'lib-level', text: `Lv.${level}` }));
      }
      const on = index >= 0;
      root.appendChild(el('div', { class: `skill-row ${on ? 'equipped' : ''}` }, [
        on ? el('span', { class: 'slot-badge', text: String(index + 1) }) : el('span', { class: 'slot-badge dim', text: '·' }),
        el('div', { style: { flex: '1' } }, [
          el('div', { class: 'sk-name', html: `${iconSvg(sk.element || (sk.category === 'buff' ? 'shield' : sk.category === 'debuff' ? 'down' : 'strike'), sk.element || '')} ${sk.name} <span class="cat-tag ${sk.category}">${SKILL_CATEGORY_LABEL[sk.category]}</span>` }),
          el('div', { class: 'sk-meta', text: `${skillMetaText(sk, sel)} — ${sk.desc}` }),
        ]),
        el('div', { class: 'skill-slots' }, [
          on
            ? button('UNEQUIP', { class: 'small ghost', title: `Take ${sk.name} off button ${index + 1}`, onclick: () => { unequipSkill(sel, sk.id); AudioManager.sfx('cancel'); this.renderTab(); } })
            : button('EQUIP', {
              class: `small ${canEquipMore(sel) ? 'primary' : 'ghost'}`,
              title: canEquipMore(sel) ? `Equip ${sk.name} on button ${equippedSkills(sel).length + 1}` : 'All battle buttons are full — unequip one first',
              onclick: () => {
                if (!canEquipMore(sel)) { toast(`All ${MAX_EQUIPPED_SKILLS} battle buttons are full — unequip one first.`, 'bad'); AudioManager.sfx('cancel'); return; }
                if (equipSkill(sel, sk.id)) { AudioManager.sfx('confirm'); toast(`${sk.name} → button ${equippedSkills(sel).length}`, 'ok'); }
                this.renderTab();
              },
            }),
        ]),
      ]));
    }
  }

  /** Let a Mythling go. Storage only — the party always keeps at least one. */
  async releaseFromStorage(m) {
    const ok = await confirmDialog(
      'RELEASE MYTHLING',
      `Release <b>${displayName(m)}</b> (Lv.${m.level}) for good?<br><br>It leaves your storage and cannot be recovered.`,
      'RELEASE', 'KEEP',
    );
    if (!ok) return;
    if (!StorageManager.remove(m.uid)) { toast('That Mythling is no longer in storage.', 'bad'); return; }
    CollectionManager.markSeen(m.speciesId, m.mutation);   // it still counts as discovered
    AudioManager.sfx('cancel');
    toast(`${displayName(m)} was released into the wild`, 'ok');
    this.renderStorageList();
    if (this.game && this.game.autosave) this.game.autosave();
  }

  // ---------------------------------------------------- BAG
  renderBag(root) {
    this.setTitle('Bag');
    root.appendChild(el('div', { class: 'coin-pill', style: { display: 'inline-flex', marginBottom: '12px' } },
      [icon('coin', 'gold'), el('span', { text: `${coins(GameState.player.wildcoins)} Wildcoins` })]));
    for (const cat of ITEM_CATEGORIES) {
      const entries = InventoryManager.byCategory(cat.id);
      root.appendChild(el('h3', { text: cat.name }));
      if (cat.id === 'tonics') {
        root.appendChild(el('p', { class: 'sub', text: 'Tonics re-roll a Mythling\'s personality traits. Open a Mythling\'s profile (PARTY or MYTHLINGS tab) and press RE-ROLL MOOD / RE-ROLL RATIONAL to use one.' }));
      }
      if (cat.id === 'food') {
        root.appendChild(el('p', { class: 'sub', text: `Feed food to a Mythling to convert it straight into EXP — a faster way to train than battling. You can feed a whole stack at once; the amount is capped at what it takes to reach Lv.${LEVEL_CAP}, so no food is ever wasted.` }));
      }
      if (!entries.length) { root.appendChild(el('p', { class: 'sub', text: '— empty —' })); continue; }
      for (const e of entries) {
        const isFood = e.item.category === 'food';
        const usable = e.item.heal || e.item.healFull || e.item.revive || e.item.restoreUses || e.item.restoreAllUses;
        root.appendChild(el('div', { class: 'item-row' }, [
          cat.id === 'balls' ? ballCanvas(e.item.id, 30, 'item-ico ball-icon') : icon(isFood ? 'food' : cat.id === 'key' ? 'key' : cat.id === 'tonics' ? 'swap' : 'heal', 'item-ico'),
          el('div', { class: 'ir-main' }, [
            el('div', { class: 'ir-name', text: e.item.name }),
            el('div', { class: 'ir-desc', text: e.item.desc }),
          ]),
          el('div', { class: 'ir-qty', text: `x${e.qty}` }),
          isFood
            ? iconTextBtn('food', 'FEED', { class: 'small primary', onclick: () => this.feedFromBag(e.id) })
            : cat.id === 'tonics' ? button('USE ON…', { class: 'small primary', onclick: () => this.useTonicFromBag(e.id) })
            : usable ? button('USE', { class: 'small primary', onclick: () => this.useItemFromBag(e.id) }) : null,
        ]));
      }
    }
  }

  /**
   * Feed a food item to a chosen party Mythling and play the level-up flow.
   * Stacks are fed in one go: a quantity picker (−/+/MAX) caps the count at
   * what is useful — never more than you own, never past the level cap.
   */
  async feedFromBag(itemId) {
    const item = getItem(itemId);
    const pick = await this.pickPartyTarget(`FEED ${item.name.toUpperCase()}`, (m) => {
      const need = FeedManager.toNextLevel(m, itemId);
      return m.level >= LEVEL_CAP
        ? 'MAX LEVEL — cannot gain EXP'
        : `+${item.exp.toLocaleString()} EXP each · ${need} to reach Lv.${m.level + 1} · ${FeedManager.toCap(m, itemId).toLocaleString()} to reach Lv.${LEVEL_CAP}`;
    });
    if (!pick) return;
    const blocked = FeedManager.blockedReason(pick);
    if (blocked) { toast(blocked, 'bad'); AudioManager.sfx('cancel'); return; }

    const max = FeedManager.maxFeedable(pick, itemId);
    let qty = 1;
    if (max > 1) {
      const chosen = await this.pickFeedQuantity(pick, item, max);
      if (!chosen) return;
      qty = chosen;
    }
    const res = FeedManager.feed(pick, itemId, qty);
    if (!res.ok) { toast(res.reason, 'bad'); AudioManager.sfx('cancel'); return; }
    AudioManager.sfx('heal');
    toast(`${displayName(pick)} ate ${res.count > 1 ? `${res.count}× ` : 'the '}${item.name} — +${res.exp.toLocaleString()} EXP`, 'ok');
    this.renderTab();
    if (res.result.levels.length) {
      const entries = res.result.levels.map((lv) => ({ uid: pick.uid, name: displayName(pick), ...lv }));
      await new Promise((done) => levelUpSummaryRef(entries, done));
      this.renderTab();
    }
    // Feeding can push a Mythling over its evolution level.
    await this.game.checkEvolutions();
    this.renderTab();
    await this.game.autosave();
  }

  /** Quantity picker for feeding a stack. Resolves with the count, or 0 on cancel. */
  pickFeedQuantity(m, item, max) {
    let qty = 1;
    const owned = InventoryManager.count(item.id);
    const toCap = FeedManager.toCap(m, item.id);
    const qtyLabel = el('b', { class: 'qty-value', text: '1' });
    const preview = el('div', { class: 'sub feed-preview' });
    const refresh = () => {
      qty = Math.max(1, Math.min(max, qty));
      qtyLabel.textContent = String(qty);
      const p = FeedManager.preview(m, item.id, qty);
      preview.innerHTML = `+${p.totalExp.toLocaleString()} EXP → <b>Lv.${p.level}</b>`
        + (p.level >= LEVEL_CAP ? ' <span style="color:#ffd76a">(MAX LEVEL)</span>' : ` · ${p.exp.toLocaleString()} / ${expNeeded({ ...m, level: p.level }).toLocaleString()} EXP`)
        + (p.levelsGained > 0 ? ` · <span style="color:#6de89a">+${p.levelsGained} level${p.levelsGained === 1 ? '' : 's'}</span>` : '')
        + `<br>Costs ${qty} of your ${owned} ${item.name}${owned === 1 ? '' : 's'}.`;
    };
    const step = (d) => { qty += d; refresh(); AudioManager.sfx('click'); };
    const body = el('div', {}, [
      el('p', { class: 'sub', html: `How many <b>${item.name}</b> should <b>${displayName(m)}</b> (Lv.${m.level}) eat?`
        + `<br>Max useful: <b>${max}</b>${max < owned ? ` — that is all it takes to reach Lv.${LEVEL_CAP} (${toCap} needed).` : ' (all you have).'}` }),
      el('div', { class: 'qty-picker' }, [
        button('−10', { class: 'small ghost', onclick: () => step(-10) }),
        button('−', { class: 'small ghost', onclick: () => step(-1) }),
        qtyLabel,
        button('+', { class: 'small ghost', onclick: () => step(1) }),
        button('+10', { class: 'small ghost', onclick: () => step(10) }),
        button('MAX', { class: 'small primary', onclick: () => { qty = max; refresh(); AudioManager.sfx('click'); } }),
      ]),
      preview,
    ]);
    refresh();
    return modal({
      title: 'FEED HOW MANY?', body,
      buttons: [{ label: 'CANCEL', value: 0 }, { label: 'FEED', value: true, primary: true }],
      cancelValue: 0,
    }).then((v) => (v === true ? qty : 0));
  }

  /**
   * Shared party picker used by items and food. `note` adds a per-Mythling line.
   * Cards close the modal through closeModal() so the dismiss handle is cleared
   * (hiding the layer by hand left the game thinking a modal was still open).
   */
  async pickPartyTarget(title, note = null) {
    const list = el('div', { class: 'grid-cards' });
    PartyManager.list().forEach((m) => {
      list.appendChild(this.mythCard(m, {
        onClick: () => closeModal(m),
        extra: note ? el('div', { class: 'mc-sub feed-note', text: note(m) }) : null,
      }));
    });
    const v = await modal({ title, body: list, buttons: [{ label: 'CANCEL', value: null }], cancelValue: null });
    return v && v.uid ? v : null;
  }

  async useItemFromBag(itemId) {
    const item = getItem(itemId);
    const pick = await this.pickPartyTarget(`USE ${item.name.toUpperCase()}`, (m) => {
      const dry = applyItemEffects(item, m, { dryRun: true });
      return dry.ok ? 'Can use' : dry.reason;
    });
    if (!pick) return;
    if (!InventoryManager.has(itemId, 1)) { toast(`You have no ${item.name} left.`, 'bad'); return; }
    // one routine for every healing item — it refuses to waste an item that would do nothing
    const res = applyItemEffects(item, pick);
    if (!res.ok) { toast(res.reason, 'bad'); AudioManager.sfx('cancel'); return; }
    InventoryManager.remove(itemId, 1);
    const parts = [];
    if (res.revived) parts.push('was revived');
    else if (res.healed > 0) parts.push(`recovered ${res.healed} HP`);
    if (res.usesRestored) parts.push('had its skills restored');
    AudioManager.sfx('heal');
    toast(`${displayName(pick)} ${parts.join(' and ')}!`, 'ok');
    this.renderTab();
  }

  /** Tonics from the bag: pick a party Mythling, then re-roll its Mood or Rational. */
  async useTonicFromBag(itemId) {
    const item = getItem(itemId);
    const pick = await this.pickPartyTarget(`${item.name.toUpperCase()} — CHOOSE A MYTHLING`, (m) => item.rerollMood
      ? `Mood: ${getMood(m.mood).name}` : `Rational: ${rationalSummary(m.rational).name} (${rationalSummary(m.rational).up} +10 / ${rationalSummary(m.rational).down} -10)`);
    if (!pick) return;
    if (!InventoryManager.has(itemId, 1)) { toast(`You have no ${item.name} left.`, 'bad'); return; }
    InventoryManager.remove(itemId, 1);
    const r = item.rerollMood ? rerollMood(pick) : rerollRational(pick);
    AudioManager.sfx('heal');
    toast(item.rerollMood
      ? `${displayName(pick)}'s Mood: ${getMood(r.before).name} → ${getMood(r.after).name}`
      : `${displayName(pick)}'s Rational: ${rationalSummary(r.before).name} → ${rationalSummary(r.after).name}`, 'ok');
    this.renderTab();
  }

  /** Species ids grouped by element, in ELEMENT_ORDER (Nature, Water, Fire, Rock …). */
  speciesByElement() {
    const groups = [];
    for (const elId of [...ELEMENT_ORDER, ...Object.keys(ELEMENTS).filter((e) => !ELEMENT_ORDER.includes(e))]) {
      const ids = SPECIES_IDS.filter((id) => SPECIES[id].element === elId);
      if (ids.length) groups.push({ element: elId, ids });
    }
    return groups;
  }

  elementHeader(elId, sub = '') {
    const e = ELEMENTS[elId];
    return el('div', { class: `element-group-head ${elId}` }, [
      icon(e?.icon || 'spark', elId), el('b', { text: `${e?.name || elId} type` }), sub ? el('span', { class: 'sub', text: sub }) : null,
    ]);
  }

  // ---------------------------------------------------- MAP
  renderMap(root) {
    this.setTitle('World Map');
    const cur = GameState.player.map;
    for (const id of MAP_ORDER) {
      const map = MAPS[id];
      const unlocked = WorldManager.isMapUnlocked(id) || WorldManager.visitedMaps?.[id];
      const visited = GameState.world.visitedMaps[id];
      root.appendChild(el('div', { class: 'item-row', style: { borderColor: cur === id ? '#f2c761' : undefined } }, [
        el('div', { class: 'ir-main' }, [
          el('div', { class: 'ir-name' }, [icon(map.element), el('span', { text: map.displayName }), cur === id ? el('span', { class: 'chip', style: { marginLeft: '8px' }, text: 'YOU ARE HERE' }) : null]),
          el('div', { class: 'ir-desc', text: `Wild Mythlings Lv.${map.levelRange[0]}–${map.levelRange[1]} · Routes: ${map.regions.map((r) => r.name).join(' → ')}` }),
          el('div', { class: 'ir-desc', text: visited ? 'Explored' : 'Not yet visited' }),
        ]),
      ]));
    }
    root.appendChild(el('p', { class: 'sub', style: { marginTop: '14px' }, text: 'Travel between regions by walking through the gates at the edge of each map. More regions will open in future updates.' }));
  }

  // ---------------------------------------------------- COLLECTION
  // ---------------------------------------------------- INDEX
  /**
   * Mythling Index: every species with all four evolution stages drawn side by
   * side, so you can see exactly what a Mythling grows into and at what level.
   */
  renderIndex(root) {
    const seen = SPECIES_IDS.filter((id) => CollectionManager.entry(id)?.seen).length;
    this.setTitle(`Mythling Index — ${seen}/${SPECIES_IDS.length} discovered`);
    root.appendChild(el('p', {
      class: 'sub',
      text: 'Every Mythling, grouped by type. An evolution stays hidden until you have actually owned that form — catch the base form, raise it to Lv.20 / Lv.60 / Lv.80 and each new form is revealed as it evolves.',
    }));

    const list = el('div', { class: 'index-list' });
    for (const group of this.speciesByElement()) {
      const owned = group.ids.filter((id) => CollectionManager.entry(id)?.caught).length;
      list.appendChild(this.elementHeader(group.element, `${owned}/${group.ids.length} caught`));
      for (const id of group.ids) {
        const sp = SPECIES[id];
        const entry = CollectionManager.entry(id);
        const known = !!(entry && (entry.seen || entry.caught));
        const card = el('div', { class: `index-card ${known ? '' : 'locked'}` }, [
          el('div', { class: 'index-head' }, [
            el('b', { text: known ? sp.displayName : '???' }),
            elementChip(sp.element),
            el('span', { class: 'role', text: known ? sp.role : '???' }),
            el('span', { class: 'role', text: `· ${known ? sp.breed : '???'} · ${MAPS[sp.spawnMaps?.[0]]?.displayName || ''}` }),
          ]),
          el('div', { class: 'index-stages' }, sp.evolutions.map((ev, stage) => {
            // base form: revealed once seen; evolutions: only once OWNED
            const unlocked = stage === 0 ? known : CollectionManager.hasForm(id, stage);
            return el('div', { class: `index-stage ${unlocked ? '' : 'locked'}`, title: unlocked ? ev.name : (stage === 0 ? 'Not discovered yet' : `Locked — evolve a ${known ? sp.displayName : '???'} to Lv.${ev.level} to reveal this form`) }, [
              unlocked
                ? mythCanvas({ speciesId: id, stage, mutation: 'none' }, 96)
                : el('div', { class: 'index-blank' }, [icon('lock')]),
              el('div', { class: 'is-name', text: unlocked ? ev.name : '???' }),
              el('div', { class: 'is-lv', text: stage === 0 ? 'Base form' : `Lv.${ev.level}` }),
              !unlocked && stage > 0 ? el('div', { class: 'is-tag', text: 'LOCKED' }) : (unlocked && (ev.art?.horns || ev.art?.wings)
                ? el('div', { class: 'is-tag', text: [ev.art.horns ? 'Horns' : '', ev.art.wings ? 'Wings' : ''].filter(Boolean).join(' + ') })
                : null),
            ]);
          })),
        ]);
        list.appendChild(card);
      }
    }
    root.appendChild(list);
  }

  renderCollection(root) {
    const s = CollectionManager.stats();
    this.setTitle(`Collection — ${s.caught}/${s.total} caught, ${s.seen}/${s.total} seen`);
    root.appendChild(el('p', { class: 'sub', html: `Mutations discovered: ${iconSvg('shiny', 'tiny')} Shiny ${s.shiny} · ${iconSvg('darkness', 'tiny')} Darkness ${s.darkness}` }));
    for (const group of this.speciesByElement()) {
      const caught = group.ids.filter((id) => CollectionManager.entry(id)?.caught).length;
      root.appendChild(this.elementHeader(group.element, `${caught}/${group.ids.length} caught`));
      const grid = el('div', { class: 'collection-grid' });
      for (const id of group.ids) {
        const sp = SPECIES[id];
        const e = CollectionManager.entry(id);
        const known = e.seen || e.caught;
        const forms = sp.evolutions.filter((ev, st) => CollectionManager.hasForm(id, st)).length;
        const card = el('div', { class: `col-card ${known ? '' : 'unknown'} ${e.caught ? 'caught' : ''}` }, [
          known ? portrait({ speciesId: id, stage: 0, mutation: 'none' }, 90) : mythCanvas({ speciesId: id, stage: 0, mutation: 'none' }, 90),
          el('div', { class: 'cc-name', text: known ? sp.displayName : '???' }),
          el('div', { class: 'cc-status' }, e.caught ? [icon('check', 'tiny'), el('span', { text: `Caught · ${forms}/${sp.evolutions.length} forms` })] : [el('span', { text: e.seen ? 'Seen' : 'Undiscovered' })]),
          known ? el('div', { class: 'row', style: { justifyContent: 'center', gap: '4px', marginTop: '4px' } }, [
            e.mutations.shiny ? el('span', { class: 'chip shiny' }, [icon('shiny')]) : null,
            e.mutations.darkness ? el('span', { class: 'chip darkness' }, [icon('darkness')]) : null,
          ]) : null,
        ]);
        if (known) card.addEventListener('click', () => this.showSpeciesInfo(id));
        grid.appendChild(card);
      }
      root.appendChild(grid);
    }
  }

  showSpeciesInfo(id) {
    const sp = SPECIES[id];
    const body = el('div', {}, [
      el('div', { class: 'row', style: { gap: '16px' } }, [
        mythCanvas({ speciesId: id, stage: 0, mutation: 'none' }, 150, true),
        el('div', {}, [
          el('div', { class: 'row', style: { gap: '6px' } }, [elementChip(sp.element), el('span', { class: 'chip', text: sp.breed }), el('span', { class: 'chip', text: sp.role })]),
          el('p', { class: 'sub', text: sp.description }),
          el('div', { class: 'mc-sub', text: `Base stats — ${STAT_KEYS.map((k) => `${STAT_SHORT[k]} ${formatStat(k, sp.baseStats[k])}`).join(', ')}` }),
          el('div', { class: 'mc-sub', text: `Found in: ${sp.spawnMaps.map((mp) => MAPS[mp].displayName).join(', ')}` }),
        ]),
      ]),
      el('h3', { text: 'Evolution line' }),
      el('div', { class: 'row', style: { gap: '8px' } }, sp.evolutions.map((ev, st) => {
        const owned = st === 0 ? true : CollectionManager.hasForm(id, st);
        return el('div', { class: 'chip', style: owned ? {} : { opacity: .55 }, title: owned ? ev.name : `Locked — evolve ${sp.displayName} to Lv.${ev.level} to reveal this form` }, [
          el('span', { text: owned ? `${ev.name} (Lv.${ev.level})` : `??? (Lv.${ev.level})` }), owned ? null : icon('lock', 'tiny'),
        ]);
      })),
      el('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } }, sp.evolutions.map((ev, st) => {
        const owned = st === 0 ? true : CollectionManager.hasForm(id, st);
        return owned ? mythCanvas({ speciesId: id, stage: st, mutation: 'none' }, 84) : el('div', { class: 'index-blank', style: { width: '84px', height: '84px' } }, [icon('lock')]);
      })),
    ]);
    modal({ title: sp.displayName.toUpperCase(), body, wide: true, buttons: [{ label: 'CLOSE', value: true, primary: true }] });
  }

  // ---------------------------------------------------- STATS
  renderStats(root) {
    const s = CollectionManager.stats();
    this.setTitle('Trainer Record');
    const rows = [
      ['Trainer', GameState.player.name],
      ['Wildcoins', coins(GameState.player.wildcoins)],
      ['Play time', formatTime(PlayerManager.playTime())],
      ['Current region', MAPS[GameState.player.map].displayName],
      ['Starter', GameState.player.starter ? SPECIES[GameState.player.starter].displayName : '—'],
      ['Party', `${PartyManager.count()} / ${PARTY_MAX}`],
      ['Storage', `${StorageManager.list().length} Mythlings`],
      ['Collection', `${s.caught}/${s.total} caught`],
      ['Trainers defeated', String(Object.keys(GameState.world.defeatedTrainers).length)],
      ['Regions visited', String(Object.keys(GameState.world.visitedMaps).length)],
      ['Level cap (this version)', `Lv.${LEVEL_CAP}`],
      ['Game version', GameState.meta.gameVersion],
    ];
    for (const [k, v] of rows) {
      root.appendChild(el('div', { class: 'item-row' }, [
        el('div', { class: 'ir-main' }, [el('div', { class: 'ir-name', text: k })]),
        el('div', { class: 'ir-qty', text: v }),
      ]));
    }
  }

  // ---------------------------------------------------- SAVE
  renderSave(root) {
    this.setTitle('Save Game');
    root.appendChild(el('p', { class: 'sub', text: `You are playing on Save Slot ${GameState.slot}. Saving writes your full state — party, storage, bag, collection, world progress and position.` }));
    root.appendChild(iconTextBtn('save', 'SAVE TO SLOT ' + GameState.slot, {
      class: 'primary', onclick: async () => {
        await this.game.saveGame(GameState.slot, true);
        this.renderTab();
      },
    }));
    root.appendChild(el('div', { style: { height: '14px' } }));
    root.appendChild(iconTextBtn('folder', 'SAVE TO A DIFFERENT SLOT', {
      class: 'ghost', onclick: () => this.game.openSlotPicker('save'),
    }));
    root.appendChild(el('div', { style: { height: '14px' } }));
    root.appendChild(iconTextBtn('home', 'QUIT TO MAIN MENU', {
      class: 'danger', onclick: async () => {
        const ok = await confirmDialog('QUIT TO MENU', 'Unsaved progress since your last save will be lost. Save first?', 'SAVE & QUIT', 'QUIT WITHOUT SAVING');
        if (ok) await this.game.saveGame(GameState.slot, true);
        Screens.clear();
        this.game.toMainMenu();
      },
    }));
    const last = this.game.lastSaveInfo;
    if (last) root.appendChild(el('p', { class: 'sub', style: { marginTop: '14px' }, text: `Last saved: ${new Date(last).toLocaleString()}` }));
  }

  // ---------------------------------------------------- SETTINGS
  renderSettings(root) {
    this.setTitle('Settings');
    root.appendChild(settingsPanel());
  }
}

/** Small square icon-only button. */
export function iconBtn(name, title, opts = {}) {
  const b = button('', { ...opts, class: `icon-btn ${opts.class || ''}`, title });
  b.appendChild(icon(name));
  return b;
}

/** Button with a leading icon and a text label. */
export function iconTextBtn(name, text, opts = {}) {
  const b = button('', opts);
  b.appendChild(iconLabel(name, text));
  return b;
}

// levelUpSummary lives in screens.js which imports this module; resolve lazily
// to keep the two modules free of a hard circular dependency at load time.
let levelUpSummaryRef = (entries, done) => done();
export function _bindLevelUpSummary(fn) { levelUpSummaryRef = fn; }

export function settingsPanel() {
  const wrap = el('div', {});
  const S = SettingsManager;
  const slider = (label, key, min, max, step) => {
    const val = el('b', { text: String(Math.round(S.get(key) * 100) + '%') });
    return el('div', { class: 'item-row' }, [
      el('div', { class: 'ir-main' }, [el('div', { class: 'ir-name', text: label })]),
      el('input', {
        type: 'range', min, max, step, value: S.get(key),
        oninput: (e) => { const v = parseFloat(e.target.value); S.set(key, v); val.textContent = `${Math.round(v * 100)}%`; },
      }),
      val,
    ]);
  };
  const dropdown = (label, key, options) => el('div', { class: 'item-row' }, [
    el('div', { class: 'ir-main' }, [el('div', { class: 'ir-name', text: label })]),
    (() => {
      const s = el('select', { onchange: (e) => S.set(key, e.target.value) });
      options.forEach((o) => s.appendChild(el('option', { value: o, ...(S.get(key) === o ? { selected: true } : {}) }, [o])));
      return s;
    })(),
  ]);
  const toggle = (label, key) => {
    const b = button(S.get(key) ? 'ON' : 'OFF', { class: `small ${S.get(key) ? 'primary' : 'ghost'}` });
    b.addEventListener('click', () => { S.set(key, !S.get(key)); b.textContent = S.get(key) ? 'ON' : 'OFF'; b.className = `btn small ${S.get(key) ? 'primary' : 'ghost'}`; });
    return el('div', { class: 'item-row' }, [el('div', { class: 'ir-main' }, [el('div', { class: 'ir-name', text: label })]), b]);
  };

  // Wiki: every rule, Mythling, mood, stat, skill and item in the game.
  const wikiBtn = iconTextBtn('book', 'OPEN WIKI', { class: 'primary small', sfx: 'confirm', onclick: () => openWiki() });
  wrap.append(
    el('div', { class: 'item-row', style: { borderColor: 'rgba(242,199,97,.5)', background: 'rgba(242,199,97,.08)' } }, [
      el('div', { class: 'ir-main' }, [
        el('div', { class: 'ir-name', text: 'Game Wiki' }),
        el('div', { class: 'ir-desc', text: 'Stats, moods, rarities, elements, species, skills, items, battle rules and the world — all in one place.' }),
      ]),
      wikiBtn,
    ]),
    slider('Master Volume', 'masterVolume', 0, 1, 0.05),
    slider('Music Volume', 'musicVolume', 0, 1, 0.05),
    slider('SFX Volume', 'sfxVolume', 0, 1, 0.05),
    dropdown('Text Speed', 'textSpeed', ['slow', 'normal', 'fast', 'instant']),
    dropdown('Graphics Quality', 'graphicsQuality', ['low', 'medium', 'high']),
    (() => {
      const val = el('b', { text: S.get('cameraSensitivity').toFixed(1) });
      return el('div', { class: 'item-row' }, [
        el('div', { class: 'ir-main' }, [el('div', { class: 'ir-name', text: 'Camera Sensitivity' })]),
        el('input', { type: 'range', min: 0.4, max: 2, step: 0.1, value: S.get('cameraSensitivity'), oninput: (e) => { const v = parseFloat(e.target.value); S.set('cameraSensitivity', v); val.textContent = v.toFixed(1); } }),
        val,
      ]);
    })(),
    toggle('Fullscreen', 'fullscreen'),
    toggle('Screen Shake', 'screenShake'),
    toggle('Damage Numbers', 'damageNumbers'),
    toggle('Tutorial Hints', 'tutorialHints'),
    toggle('Confirm Important Actions', 'confirmImportantActions'),
    el('div', { style: { height: '10px' } }),
    button('RESET TO DEFAULTS', { class: 'ghost small', onclick: () => { S.reset(); toast('Settings reset'); } }),
  );

  // fullscreen toggle side effect
  bus.on('settings:changed', (s) => {
    if (s.fullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    if (!s.fullscreen && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  });
  return wrap;
}

function select(label, options, onChange) {
  const s = el('select', { onchange: (e) => onChange(e.target.value) });
  options.forEach((o) => s.appendChild(el('option', { value: o }, [o === '' ? `All ${label}` : o])));
  return s;
}
