// The pause / player menu: Party, Mythlings (storage), Skills, Bag, Map,
// Collection, Stats, Save, Settings.
import {
  GameState, PartyManager, StorageManager, InventoryManager, CollectionManager, WorldManager,
  PlayerManager, bus,
} from '../systems/GameState.js';
import {
  displayName, speciesOf, computeStats, maxHp, hpPercent, isFainted, stageData,
  librarySkills, equipSkill, ultimateMove, ultimateUnlocked, expNeeded, restoreUses,
} from '../core/mythling.js';
import { EvolutionManager } from '../systems/EvolutionManager.js';
import { SPECIES, SPECIES_IDS, getSpecies } from '../data/species.js';
import { MOODS, STAT_LABELS, STAT_KEYS, STAT_INFO, STAT_BAR_MAX, moodSummary, formatStat } from '../data/moods.js';
import { counterDodgePercent } from '../data/config.js';
import { openWiki } from './wiki.js';
import { RARITY_ORDER, getRarity } from '../data/rarity.js';
import { MUTATIONS } from '../data/mutations.js';
import { ITEM_CATEGORIES, getItem } from '../data/items.js';
import { MAPS, MAP_ORDER } from '../data/maps.js';
import { ELEMENTS } from '../data/elements.js';
import { LEVEL_CAP, PARTY_MAX, ULTIMATE_UNLOCK_LEVEL } from '../data/config.js';
import { drawMythling } from '../render/creatures.js';
import {
  el, button, bar, hpClass, elementChip, rarityChip, mutationChip, toast, modal, confirmDialog,
  Screens, panelHeader, closeButton,
} from './ui.js';
import { icon, iconSvg, iconLabel } from './icons.js';
import { buffSummary } from '../data/skills.js';
import { FeedManager } from '../systems/FeedManager.js';
import { SettingsManager } from '../systems/SettingsManager.js';
import { AudioManager } from '../systems/AudioManager.js';
import { formatTime } from '../core/utils.js';

const TABS = [
  ['party', 'PARTY', 'dna'],
  ['mythlings', 'MYTHLINGS', 'box'],
  ['skills', 'SKILLS', 'strike'],
  ['bag', 'BAG', 'bag'],
  ['map', 'MAP', 'map'],
  ['collection', 'COLLECTION', 'book'],
  ['stats', 'STATS', 'user'],
  ['save', 'SAVE', 'save'],
  ['settings', 'SETTINGS', 'settings'],
];

export function mythCanvas(m, size = 66, animated = false) {
  const cv = el('canvas', { width: size, height: size });
  const ctx = cv.getContext('2d');
  const draw = (t = 0) => {
    ctx.clearRect(0, 0, size, size);
    ctx.save(); ctx.translate(size / 2, size * 0.88);
    drawMythling(ctx, {
      speciesId: m.speciesId, stage: m.stage ?? 0, mutation: m.mutation || 'none',
      x: -size * 0.06, y: 0, size: size * 0.78, t, facing: 1, shadow: false,
    });
    ctx.restore();
  };
  draw(0);
  if (animated) {
    let raf, t0 = performance.now();
    const loop = (now) => { draw((now - t0) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    cv._stop = () => cancelAnimationFrame(raf);
  }
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
      mythCanvas(m, 66),
      el('div', { class: 'mc-main' }, [
        el('div', { class: 'mc-name' }, [
          displayName(m),
          m.level >= LEVEL_CAP ? el('span', { class: 'chip max', text: 'MAX' }) : null,
          evoReady ? el('span', { class: 'chip evolve' }, [icon('levelup'), el('span', { text: 'EVOLVE' })]) : null,
          mutationChip(m.mutation),
        ]),
        el('div', { class: 'mc-sub', text: `Lv.${m.level} · ${sp.displayName} · ${MOODS[m.mood].name} · ${getRarity(m.rarity).name}` }),
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

    const statRows = STAT_KEYS.map((k) => {
      const isUp = MOODS[m.mood].up.includes(k);
      const isDown = MOODS[m.mood].down === k;
      const maxRef = STAT_BAR_MAX[k] || 90;
      return el('div', { class: `stat-row ${isUp ? 'up' : ''} ${isDown ? 'down' : ''}`, title: STAT_INFO[k] }, [
        el('span', { class: 'stat-name' }, [el('span', { text: STAT_LABELS[k] }), isUp ? icon('up', 'tiny') : isDown ? icon('down', 'tiny') : null]),
        el('div', { class: 'sbar' }, [el('i', { style: { width: `${Math.min(100, (stats[k] / maxRef) * 100)}%` } })]),
        el('b', { text: formatStat(k, stats[k]) }),
      ]);
    });

    const body = el('div', { class: 'detail-wrap' }, [
      el('div', {}, [
        el('div', { class: 'detail-art' }, [mythCanvas(m, 240, true)]),
        el('div', { class: 'row', style: { gap: '6px', marginTop: '10px', justifyContent: 'center' } }, [
          elementChip(sp.element), rarityChip(m.rarity),
          el('span', { class: 'chip', text: MOODS[m.mood].name }),
          mutationChip(m.mutation),
        ]),
        el('p', { class: 'sub', style: { marginTop: '10px', fontSize: '.85rem' }, text: sp.description }),
        el('div', { class: 'row', style: { gap: '6px' } }, [
          iconTextBtn('pencil', 'Nickname', { class: 'small ghost', onclick: async () => {
            const input = el('input', { type: 'text', value: m.nickname || '', maxlength: 12 });
            const ok = await modal({ title: 'NICKNAME', body: el('div', {}, [el('p', { class: 'sub', text: 'Leave blank to use the species name.' }), input]), buttons: [{ label: 'CANCEL', value: false }, { label: 'SAVE', value: true, primary: true }] });
            if (ok) { m.nickname = input.value.trim().slice(0, 12) || null; toast('Nickname updated'); this.renderTab(); }
          } }),
          EvolutionManager.isReady(m) ? iconTextBtn('levelup', 'EVOLVE NOW', { class: 'small primary', onclick: () => { document.getElementById('modal').classList.add('hidden'); this.game.runEvolution(m, () => this.renderTab()); } }) : null,
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
        el('div', { class: 'mc-sub', style: { marginTop: '6px' }, html: `Mood ${MOODS[m.mood].name}: ${iconSvg('up', 'tiny')} ${mood.up.join(', ')} &nbsp; ${iconSvg('down', 'tiny')} ${mood.down} — magnitude ${getRarity(m.rarity).magnitude} (rarity ${m.rarity})` }),

        el('h3', { text: 'Equipped Skills' }),
        ...['normal', 'special', 'buff'].map((slot) => {
          const sk = m.skills[slot] ? librarySkills(m).find((s) => s.id === m.skills[slot]) : null;
          return el('div', { class: 'skill-row equipped' }, [
            el('div', { style: { flex: '1' } }, [
              el('div', { class: 'sk-name', text: sk ? sk.name : '—' }),
              el('div', { class: 'sk-meta', html: sk ? `${slot.toUpperCase()} · ${sk.category === 'buff' ? buffSummary(sk) : `Power ${sk.power}`} · ${Number.isFinite(sk.uses) ? `${m.uses[sk.id] ?? 0}/${sk.uses} uses` : `${iconSvg('infinity', 'tiny')} unlimited`}` : '—' }),
            ]),
          ]);
        }),
        el('div', { class: 'skill-row', style: { borderColor: '#ffd76a' } }, [
          el('div', { style: { flex: '1' } }, [
            el('div', { class: 'sk-name', html: `${iconSvg('ultimate', 'gold')} ${ult.name}` }),
            el('div', { class: 'sk-meta', text: ultimateUnlocked(m) ? `ULTIMATE · Power ${ult.power} · Charge ${m.ultCharge}/8 · cannot be replaced` : `ULTIMATE · locked until Lv.${ULTIMATE_UNLOCK_LEVEL}` }),
          ]),
        ]),
        iconTextBtn('strike', 'Open Skill Library', { class: 'small ghost', onclick: () => { document.getElementById('modal').classList.add('hidden'); this.tab = 'skills'; this.selected = m.uid; this.render(); } }),

        el('h3', { text: 'Evolution' }),
        el('div', { class: 'mc-sub', html: evoNext
          ? (evoNext.locked
            ? `Next: <b>${evoNext.name}</b> at Lv.${evoNext.level} — <span style="color:#ff9aa2">LOCKED (future update)</span>`
            : `Next: <b>${evoNext.name}</b> at Lv.${evoNext.level} — ${evoNext.reached ? '<span style="color:#6de89a">READY!</span>' : `${evoNext.level - m.level} levels to go`}`)
          : 'Final form available in this version.' }),
        ...locked.map((s) => el('div', { class: 'mc-sub locked-row', style: { opacity: .6 }, html: `${iconSvg('lock', 'tiny')} ${s.name} — Lv.${s.level} (future content)` })),

        el('h3', { text: 'Capture Info' }),
        el('div', { class: 'mc-sub', text: m.meta?.isStarter
          ? 'Your starter partner — chosen at the beginning of your journey.'
          : m.meta?.caughtLevel
            ? `Caught at Lv.${m.meta.caughtLevel} with a ${getItem(m.meta.caughtWith)?.name || 'ball'} in ${MAPS[m.meta.originMap]?.displayName || 'the wild'} — restarted at Lv.1.`
            : 'Origin unknown.' }),
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
        extra: iconTextBtn('dna', 'Party', {
          class: 'small primary', disabled: PartyManager.isFull(),
          onclick: (e) => { e.stopPropagation(); if (StorageManager.toParty(m.uid)) { toast(`${displayName(m)} joined your party`); this.renderStorageList(); } else toast('Party is full!', 'bad'); },
        }),
      }));
    }
  }

  // ---------------------------------------------------- SKILLS
  renderSkills(root) {
    this.setTitle('Skill Library');
    root.appendChild(el('p', { class: 'sub', text: 'Each Mythling equips 1 Normal, 1 Special and 1 Buff skill. Everything it has learned stays in its library — nothing is ever lost. The Ultimate is fixed to the species and cannot be replaced.' }));
    const party = PartyManager.list();
    const sel = this.selected && party.find((m) => m.uid === this.selected) || party[0];
    const picker = el('div', { class: 'row', style: { marginBottom: '14px' } }, party.map((m) =>
      button(`${displayName(m)} Lv.${m.level}`, {
        class: `small ${sel.uid === m.uid ? 'primary' : 'ghost'}`,
        onclick: () => { this.selected = m.uid; this.renderTab(); },
      })));
    root.appendChild(picker);
    if (!sel) return;

    const ult = ultimateMove(sel);
    root.appendChild(el('div', { class: 'skill-row', style: { borderColor: '#ffd76a' } }, [
      el('div', { style: { flex: '1' } }, [
        el('div', { class: 'sk-name', html: `${iconSvg('ultimate', 'gold')} ${ult.name} (ULTIMATE — fixed)` }),
        el('div', { class: 'sk-meta', text: ultimateUnlocked(sel) ? `Power ${ult.power} · Charge ${sel.ultCharge}/8 · upgrades with evolution` : `Locked until Lv.${ULTIMATE_UNLOCK_LEVEL}` }),
      ]),
    ]));

    for (const cat of ['normal', 'special', 'buff']) {
      root.appendChild(el('h3', { text: `${cat.toUpperCase()} SKILLS` }));
      const skills = librarySkills(sel, cat);
      if (!skills.length) { root.appendChild(el('p', { class: 'sub', text: 'None learned yet.' })); continue; }
      for (const sk of skills) {
        const equipped = sel.skills[cat] === sk.id;
        root.appendChild(el('div', { class: `skill-row ${equipped ? 'equipped' : ''}` }, [
          el('div', { style: { flex: '1' } }, [
            el('div', { class: 'sk-name', html: `${iconSvg(sk.element || 'strike', sk.element || '')} ${sk.name}` }),
            el('div', { class: 'sk-meta', text: `${sk.category === 'buff' ? buffSummary(sk, ' ') : `Power ${sk.power} · ${sk.damageType === 'physical' ? 'Physical' : 'Special'}`} · ${Number.isFinite(sk.uses) ? `${sel.uses[sk.id] ?? 0}/${sk.uses} uses` : 'Unlimited uses'} — ${sk.desc}` }),
          ]),
          equipped ? el('span', { class: 'chip', text: 'EQUIPPED' })
            : button('EQUIP', { class: 'small primary', onclick: () => { equipSkill(sel, cat, sk.id); AudioManager.sfx('confirm'); this.renderTab(); } }),
        ]));
      }
    }
  }

  // ---------------------------------------------------- BAG
  renderBag(root) {
    this.setTitle('Bag');
    root.appendChild(el('div', { class: 'coin-pill', style: { display: 'inline-flex', marginBottom: '12px' } },
      [icon('coin', 'gold'), el('span', { text: `${GameState.player.wildcoins} Wildcoins` })]));
    for (const cat of ITEM_CATEGORIES) {
      const entries = InventoryManager.byCategory(cat.id);
      root.appendChild(el('h3', { text: cat.name }));
      if (cat.id === 'food') {
        root.appendChild(el('p', { class: 'sub', text: 'Feed food to a Mythling to convert it straight into EXP — a faster way to train than battling. Food cannot push a Mythling past the level cap.' }));
      }
      if (!entries.length) { root.appendChild(el('p', { class: 'sub', text: '— empty —' })); continue; }
      for (const e of entries) {
        const isFood = e.item.category === 'food';
        const usable = e.item.heal || e.item.revive || e.item.restoreUses;
        root.appendChild(el('div', { class: 'item-row' }, [
          icon(isFood ? 'food' : cat.id === 'balls' ? 'orb' : cat.id === 'key' ? 'key' : 'heal', 'item-ico'),
          el('div', { class: 'ir-main' }, [
            el('div', { class: 'ir-name', text: e.item.name }),
            el('div', { class: 'ir-desc', text: e.item.desc }),
          ]),
          el('div', { class: 'ir-qty', text: `x${e.qty}` }),
          isFood
            ? iconTextBtn('food', 'FEED', { class: 'small primary', onclick: () => this.feedFromBag(e.id) })
            : usable ? button('USE', { class: 'small primary', onclick: () => this.useItemFromBag(e.id) }) : null,
        ]));
      }
    }
  }

  /** Feed a food item to a chosen party Mythling and play the level-up flow. */
  async feedFromBag(itemId) {
    const item = getItem(itemId);
    const pick = await this.pickPartyTarget(`FEED ${item.name.toUpperCase()}`, (m) => {
      const need = FeedManager.toNextLevel(m, itemId);
      return m.level >= LEVEL_CAP
        ? 'MAX LEVEL — cannot gain EXP'
        : `+${item.exp} EXP · ${need} to reach Lv.${m.level + 1}`;
    });
    if (!pick) return;
    const res = FeedManager.feed(pick, itemId);
    if (!res.ok) { toast(res.reason, 'bad'); AudioManager.sfx('cancel'); return; }
    AudioManager.sfx('heal');
    toast(`${displayName(pick)} ate the ${item.name} — +${res.exp} EXP`, 'ok');
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

  /** Shared party picker used by items and food. `note` adds a per-Mythling line. */
  pickPartyTarget(title, note = null) {
    const list = el('div', { class: 'grid-cards' });
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return; done = true;
        const layer = document.getElementById('modal');
        layer.classList.add('hidden'); layer.innerHTML = '';
        resolve(v);
      };
      PartyManager.list().forEach((m) => {
        const card = this.mythCard(m, {
          onClick: () => finish(m),
          extra: note ? el('div', { class: 'mc-sub feed-note', text: note(m) }) : null,
        });
        list.appendChild(card);
      });
      modal({ title, body: list, buttons: [{ label: 'CANCEL', value: null }] }).then(() => finish(null));
    });
  }

  async useItemFromBag(itemId) {
    const item = getItem(itemId);
    const pick = await this.pickPartyTarget(`USE ${item.name.toUpperCase()}`);
    if (!pick) return;
    if (item.heal) {
      if (isFainted(pick)) { toast('That Mythling has fainted — use a Revive Herb.', 'bad'); return; }
      const before = pick.currentHp;
      pick.currentHp = Math.min(maxHp(pick), pick.currentHp + item.heal);
      if (pick.currentHp === before) { toast('HP is already full!', 'bad'); return; }
      InventoryManager.remove(itemId, 1);
      toast(`${displayName(pick)} recovered ${pick.currentHp - before} HP`, 'ok');
    } else if (item.revive) {
      if (!isFainted(pick)) { toast('That Mythling does not need reviving.', 'bad'); return; }
      InventoryManager.remove(itemId, 1);
      pick.currentHp = Math.floor(maxHp(pick) * item.revive);
      toast(`${displayName(pick)} was revived!`, 'ok');
    } else if (item.restoreUses) {
      InventoryManager.remove(itemId, 1);
      restoreUses(pick, item.restoreUses);
      toast(`${displayName(pick)}'s skills were restored`, 'ok');
    }
    AudioManager.sfx('heal');
    this.renderTab();
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
  renderCollection(root) {
    const s = CollectionManager.stats();
    this.setTitle(`Collection — ${s.caught}/${s.total} caught, ${s.seen}/${s.total} seen`);
    root.appendChild(el('p', { class: 'sub', html: `Mutations discovered: ${iconSvg('shiny', 'tiny')} Shiny ${s.shiny} · ${iconSvg('darkness', 'tiny')} Darkness ${s.darkness}` }));
    const grid = el('div', { class: 'collection-grid' });
    for (const id of SPECIES_IDS) {
      const sp = SPECIES[id];
      const e = CollectionManager.entry(id);
      const known = e.seen || e.caught;
      const card = el('div', { class: `col-card ${known ? '' : 'unknown'} ${e.caught ? 'caught' : ''}` }, [
        mythCanvas({ speciesId: id, stage: 0, mutation: 'none' }, 90),
        el('div', { class: 'cc-name', text: known ? sp.displayName : '???' }),
        el('div', { class: 'cc-status' }, e.caught ? [icon('check', 'tiny'), el('span', { text: 'Caught' })] : [el('span', { text: e.seen ? 'Seen' : 'Undiscovered' })]),
        known ? el('div', { class: 'row', style: { justifyContent: 'center', gap: '4px', marginTop: '4px' } }, [
          elementChip(sp.element),
          e.mutations.shiny ? el('span', { class: 'chip shiny' }, [icon('shiny')]) : null,
          e.mutations.darkness ? el('span', { class: 'chip darkness' }, [icon('darkness')]) : null,
        ]) : null,
      ]);
      if (known) card.addEventListener('click', () => this.showSpeciesInfo(id));
      grid.appendChild(card);
    }
    root.appendChild(grid);
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
      el('div', { class: 'row', style: { gap: '8px' } }, sp.evolutions.map((ev) => el('div', { class: 'chip', style: ev.future ? { opacity: .55 } : {} }, [
        el('span', { text: `${ev.name} (Lv.${ev.level})` }), ev.future ? icon('lock', 'tiny') : null,
      ]))),
    ]);
    modal({ title: sp.displayName.toUpperCase(), body, wide: true, buttons: [{ label: 'CLOSE', value: true, primary: true }] });
  }

  // ---------------------------------------------------- STATS
  renderStats(root) {
    const s = CollectionManager.stats();
    this.setTitle('Trainer Record');
    const rows = [
      ['Trainer', GameState.player.name],
      ['Wildcoins', String(GameState.player.wildcoins)],
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
