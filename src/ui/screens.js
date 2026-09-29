// Title screen, save-slot screens, new-game flow, starter selection, shops,
// Mythling Centers and the evolution cinematic.
import {
  el, button, Screens, toast, modal, confirmDialog, elementChip, rarityChip, mutationChip,
  bar, hpClass, Dialogue, panelHeader, closeButton,
} from './ui.js';
import { settingsPanel, mythCanvas, iconTextBtn, _bindLevelUpSummary } from './PlayerMenu.js';
import { icon, iconSvg } from './icons.js';
import { ballCanvas } from '../render/balls.js';
import { titleLogo } from './logo.js';
import { SPECIES, STARTER_IDS, getSpecies } from '../data/species.js';
import { MOODS } from '../data/moods.js';
import { STAT_SHORT } from '../data/moods.js';
import { getItem } from '../data/items.js';
import { GAME_VERSION, LEVEL_CAP, STARTER_RARITY, BAG_TIERS, bagTier } from '../data/config.js';
import { GameState, InventoryManager, PlayerManager, PartyManager, StorageManager, bus } from '../systems/GameState.js';
import { ShopManager } from '../systems/ShopManager.js';
import { displayName, maxHp, hpPercent, computeStats } from '../core/mythling.js';
import { drawCreature } from '../render/creatures.js';
import { AudioManager } from '../systems/AudioManager.js';
import { coins, formatTime, formatDate } from '../core/utils.js';

// ------------------------------------------------------------------ MAIN MENU
export function mainMenuScreen({ onNewGame, onLoad, onSettings, onExit }) {
  const entries = [
    { id: 'new', label: 'NEW GAME', hint: 'Begin a fresh adventure', ico: 'play', run: onNewGame, primary: true },
    { id: 'load', label: 'LOAD GAME', hint: 'Continue from a save slot', ico: 'folder', run: onLoad },
    { id: 'settings', label: 'SETTINGS', hint: 'Audio, text, display', ico: 'settings', run: onSettings },
    { id: 'exit', label: 'EXIT', hint: 'Close the game', ico: 'power', run: onExit },
  ];

  const buttons = entries.map((e, i) => {
    const b = el('button', { class: `menu-btn${e.primary ? ' primary' : ''}`, 'data-index': String(i) }, [
      el('span', { class: 'mb-ico', html: iconSvg(e.ico) }),
      el('span', { class: 'mb-text' }, [
        el('span', { class: 'mb-label', text: e.label }),
        el('span', { class: 'mb-hint', text: e.hint }),
      ]),
      el('span', { class: 'mb-arrow', html: iconSvg('chevron-right') }),
    ]);
    b.addEventListener('click', () => { AudioManager.sfx('confirm'); e.run(); });
    b.addEventListener('mouseenter', () => { select(i, true); });
    b.addEventListener('focus', () => select(i, false));
    return b;
  });

  let index = 0;
  function select(i, sound) {
    index = (i + buttons.length) % buttons.length;
    buttons.forEach((b, n) => b.classList.toggle('selected', n === index));
    if (sound) AudioManager.sfx('hover');
  }

  const column = el('div', { class: 'menu-column' }, [
    titleLogo(),
    el('div', { class: 'menu-tagline', text: 'Small Creatures. Big Adventures.' }),
    el('div', { class: 'menu-buttons' }, buttons),
  ]);

  const node = el('div', { class: 'menu-overlay' }, [
    column,
    el('div', { class: 'menu-footnote' }, [
      el('span', { class: 'mf-line', text: 'An original creature-collecting adventure' }),
    ]),
    el('div', { class: 'version-block' }, [
      el('span', { text: `v${GAME_VERSION}` }),
      el('span', { text: `Level Cap: Lv.${LEVEL_CAP}` }),
      el('span', { text: '5 Mythlings' }),
      el('span', { text: '3 Regions' }),
    ]),
  ]);

  select(0, false);
  const handle = Screens.replace(node, 'main-menu');

  // Keyboard navigation, live for as long as the title screen is mounted.
  // It unhooks itself once the node leaves the document, so no stale listeners
  // survive into the overworld.
  const onKey = (ev) => {
    if (!node.isConnected) { window.removeEventListener('keydown', onKey, true); return; }
    if (document.getElementById('modal') && !document.getElementById('modal').classList.contains('hidden')) return;
    const k = (ev.key || '').toLowerCase();
    if (k === 'arrowdown' || k === 's') { select(index + 1, true); ev.preventDefault(); }
    else if (k === 'arrowup' || k === 'w') { select(index - 1, true); ev.preventDefault(); }
    else if (k === 'enter' || k === ' ') { AudioManager.sfx('confirm'); entries[index].run(); ev.preventDefault(); }
  };
  window.addEventListener('keydown', onKey, true);
  return handle;
}

// ------------------------------------------------------------------ SAVE SLOTS
export function slotScreen({ title, subtitle, slots, mode, onPick, onBack }) {
  const list = el('div', { class: 'slot-list' });
  for (const s of slots) {
    const row = el('div', { class: `slot ${s.empty ? 'empty' : ''}` }, [
      el('div', { class: 'slot-no', text: `${s.slot}` }),
      s.empty ? el('div', { class: 'slot-portrait' }) : portraitFor(s),
      el('div', { class: 'slot-main' }, s.empty ? [
        el('div', { class: 'slot-name', text: 'EMPTY' }),
        el('div', { class: 'slot-meta', text: mode === 'load' ? 'No data' : 'Start a new adventure here' }),
      ] : [
        el('div', { class: 'slot-name', text: s.playerName }),
        el('div', { class: 'slot-meta', text: `${s.mapName} · ${s.leadMythling}` }),
        el('div', { class: 'slot-meta', text: `${formatTime(s.playTime)} · ${formatDate(s.savedAt)} · v${s.gameVersion}` }),
      ]),
      mode !== 'load' && !s.empty ? button('DELETE', {
        class: 'danger small',
        onclick: async (e) => {
          e.stopPropagation();
          const ok = await confirmDialog('DELETE SAVE', `Permanently delete Slot ${s.slot} (<b>${s.playerName}</b>)? This cannot be undone.`, 'DELETE', 'CANCEL');
          if (ok) onPick({ slot: s.slot, action: 'delete' });
        },
      }) : null,
    ]);
    if (!(mode === 'load' && s.empty)) {
      row.addEventListener('click', () => { AudioManager.sfx('confirm'); onPick({ slot: s.slot, action: 'pick', empty: s.empty, info: s }); });
    } else {
      row.style.opacity = '.5'; row.style.cursor = 'default';
    }
    list.appendChild(row);
  }
  const node = el('div', { class: 'dialog panel screen-inner' }, [
    panelHeader(title, onBack, subtitle),
    list,
    el('div', { class: 'row end', style: { marginTop: '18px' } }, [button('BACK', { class: 'ghost', onclick: onBack, sfx: 'cancel' })]),
  ]);
  return Screens.replace(node, 'slots', onBack);
}

function portraitFor(s) {
  const cv = el('canvas', { class: 'slot-portrait', width: 64, height: 64 });
  const ctx = cv.getContext('2d');
  if (s.starter && SPECIES[s.starter]) {
    ctx.save(); ctx.translate(32, 56);
    drawCreature(ctx, { speciesId: s.starter, stage: 0, mutation: 'none', x: -4, y: 0, size: 52, t: 0, facing: 1, shadow: false });
    ctx.restore();
  }
  return cv;
}

// ------------------------------------------------------------------ NEW GAME: NAME
export function nameEntryScreen({ onConfirm, onBack }) {
  const input = el('input', { type: 'text', maxlength: 14, placeholder: 'DUMDUM', value: '' });
  const go = () => {
    const v = input.value.trim();
    if (!v) { toast('Please enter a trainer name', 'bad'); return; }
    onConfirm(v.toUpperCase());
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); });
  const node = el('div', { class: 'dialog panel screen-inner', style: { maxWidth: '620px' } }, [
    el('h2', { text: 'Your Name' }),
    el('p', { class: 'sub', text: 'Every legend needs a name. What should the Mythlings call you?' }),
    el('div', { style: { margin: '10px 0 6px', letterSpacing: '.2em', color: '#9fb3c9', fontSize: '.85rem' }, text: 'PLAYER NAME:' }),
    input,
    el('div', { class: 'row end', style: { marginTop: '22px' } }, [
      button('BACK', { class: 'ghost', onclick: onBack, sfx: 'cancel' }),
      button('CONTINUE', { class: 'primary', onclick: go, sfx: 'confirm' }),
    ]),
  ]);
  Screens.replace(node, 'name-entry');
  setTimeout(() => input.focus(), 60);
}

// ------------------------------------------------------------------ INTRO
export const INTRO_LINES = [
  'The world of Wildbound is home to mysterious creatures known as Mythlings.',
  'Every Mythling has its own strengths, abilities, moods, and potential.',
  'Explore the wild.',
  'Battle wild Mythlings.',
  'Defeat them.',
  'Catch them.',
  'Raise them.',
  'Discover the world of Wildbound.',
];

// ------------------------------------------------------------------ STARTER SELECT
export function starterScreen({ onChoose, onBack }) {
  let selected = null;
  const cards = {};
  const grid = el('div', { class: 'starter-grid' });

  for (const id of STARTER_IDS) {
    const sp = SPECIES[id];
    const cv = el('canvas', { width: 420, height: 380 });
    const ctx = cv.getContext('2d');
    const state = { rot: 0, drag: false, lastX: 0, auto: true };
    const draw = (t) => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      // pedestal glow
      const g = ctx.createRadialGradient(210, 300, 10, 210, 300, 190);
      g.addColorStop(0, `${elementGlow(sp.element)}55`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.save();
      ctx.translate(210, 320);
      const spin = state.auto ? Math.sin(t * 0.7) : Math.sin(state.rot);
      const facing = spin >= 0 ? 1 : -1;
      const squash = 0.86 + Math.abs(spin) * 0.14;
      ctx.scale(Math.max(0.28, Math.abs(spin) * 0.6 + 0.55), 1);
      drawCreature(ctx, {
        speciesId: id, stage: 0, mutation: 'none', x: 0, y: 0,
        size: 210, t, facing, shadow: true, pose: { squash: 1 },
      });
      ctx.restore();
      // sparkles
      for (let i = 0; i < 12; i++) {
        const a = t * 0.8 + i;
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + i);
        ctx.fillStyle = elementGlow(sp.element);
        ctx.beginPath(); ctx.arc(210 + Math.cos(a) * 130, 250 + Math.sin(a * 1.3) * 80, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    let t0 = performance.now();
    const loop = (now) => { draw((now - t0) / 1000); cv._raf = requestAnimationFrame(loop); };
    cv._raf = requestAnimationFrame(loop);

    cv.addEventListener('pointerdown', (e) => { state.drag = true; state.auto = false; state.lastX = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (state.drag) { state.rot += (e.clientX - state.lastX) * 0.02; state.lastX = e.clientX; } });
    cv.addEventListener('pointerup', () => { state.drag = false; });
    cv.addEventListener('pointerleave', () => { state.drag = false; });

    const stats = sp.baseStats;
    const card = el('div', { class: 'starter-card' }, [
      cv,
      el('h3', { text: sp.displayName }),
      el('div', { class: 'role', text: `${sp.breed} · ${sp.role}` }),
      el('div', { class: 'row', style: { justifyContent: 'center', gap: '5px', marginBottom: '8px' } }, [
        elementChip(sp.element), rarityChip(STARTER_RARITY), el('span', { class: 'chip', text: MOODS[sp.defaultMood].name }),
      ]),
      el('div', { class: 'stat-mini' }, Object.keys(stats).map((k) =>
        el('div', {}, [el('span', { text: STAT_SHORT[k] }), el('b', { text: String(stats[k]) })]))),
      el('p', { class: 'sub', style: { fontSize: '.78rem', marginTop: '8px' }, text: sp.description }),
      el('div', { class: 'sub', style: { fontSize: '.75rem' }, text: `Evolves into ${sp.evolutions[1].name} at Lv.20 · Ultimate: ${ultimateName(sp)}` }),
    ]);
    card.addEventListener('click', () => {
      selected = id;
      Object.values(cards).forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      confirmBtn.disabled = false;
      AudioManager.sfx('click');
    });
    cards[id] = card;
    grid.appendChild(card);
  }

  const confirmBtn = button('CHOOSE PARTNER', {
    class: 'primary', disabled: true, sfx: 'confirm',
    onclick: async () => {
      if (!selected) return;
      const sp = SPECIES[selected];
      const ok = await confirmDialog('CONFIRM PARTNER', `Are you sure you want <b>${sp.displayName}</b> as your first partner?`, 'YES', 'NO');
      if (!ok) return;
      Object.values(cards).forEach((c) => c.querySelector('canvas')?._raf && cancelAnimationFrame(c.querySelector('canvas')._raf));
      onChoose(selected);
    },
  });

  const node = el('div', { class: 'dialog panel screen-inner', style: { maxWidth: '1080px' } }, [
    panelHeader('Choose Your First Mythling', onBack,
      `Drag a Mythling to turn it around. Whichever you choose joins you as a rare ${STARTER_RARITY}-tier partner — and the others can still be found in the wild later.`),
    grid,
    el('div', { class: 'row end', style: { marginTop: '18px' } }, [
      button('BACK', { class: 'ghost', onclick: onBack, sfx: 'cancel' }),
      confirmBtn,
    ]),
  ]);
  Screens.replace(node, 'starter', onBack);
}

function elementGlow(e) { return e === 'nature' ? '#8fe06a' : e === 'water' ? '#7fd8ff' : '#ffb347'; }
function ultimateName(sp) {
  const map = { verdant_crush: 'Verdant Crush', tidal_burst: 'Tidal Burst', fire_blast: 'Fire Blast', ocean_guard: 'Ocean Guard', leafstorm: 'Leafstorm' };
  return map[sp.ultimate] || sp.ultimate;
}

// ------------------------------------------------------------------ SETTINGS SCREEN
export function settingsScreen({ onBack }) {
  const node = el('div', { class: 'dialog panel screen-inner' }, [
    panelHeader('Settings', onBack, 'Settings are saved automatically and persist between sessions.'),
    settingsPanel(),
    el('div', { class: 'row end', style: { marginTop: '16px' } }, [button('BACK', { class: 'primary', onclick: onBack, sfx: 'cancel' })]),
  ]);
  Screens.replace(node, 'settings', onBack);
}

// ------------------------------------------------------------------ SHOP
export function shopScreen(building, { onClose }) {
  const stock = ShopManager.stock(building);          // rolls a fresh shelf when the timer has run out
  let clock = null;

  /** Live restock countdown; cleared the moment the shop closes, by any route. */
  const countdown = () => {
    const ms = ShopManager.msUntilRestock(building);
    const label = el('span', { class: 'shop-timer', text: ms > 0 ? `Restocks in ${ShopManager.formatCountdown(ms)}` : 'Shelves are being refilled…' });
    if (ms > 0) {
      clock = setInterval(() => {
        const left = ShopManager.msUntilRestock(building);
        if (left > 0) { label.textContent = `Restocks in ${ShopManager.formatCountdown(left)}`; return; }
        label.textContent = 'Shelves are being refilled… leave and come back!';
        clearInterval(clock); clock = null;
      }, 1000);
    }
    return label;
  };

  /** Bag upgrades: this shop sells up to `maxBagTier`, and only bags bigger than yours. */
  const bagSection = () => {
    const wrap = el('div', { class: 'shop-bags' });
    const tier = StorageManager.bagTier();
    const here = building.maxBagTier || 1;
    wrap.appendChild(el('div', { class: 'shop-baghead' }, [
      el('span', { text: `BAG ${tier}` }),
      el('span', { class: 'dim', text: `${StorageManager.used()} / ${StorageManager.capacity()} Mythlings` }),
    ]));
    const options = BAG_TIERS.filter((b) => b.tier > tier && b.tier <= here);
    if (!options.length) {
      wrap.appendChild(el('p', { class: 'sub', style: { margin: '6px 0 0' },
        text: here <= tier
          ? 'This shop has no bigger bag. The next one is sold deeper into the world.'
          : 'You already own the biggest bag sold here.' }));
      return wrap;
    }
    for (const b of options) {
      const next = b.tier === tier + 1;              // bags are bought in order, one tier at a time
      const afford = GameState.player.wildcoins >= b.price;
      wrap.appendChild(el('div', { class: `item-row${next ? '' : ' sold-out'}` }, [
        el('div', { class: 'ir-main' }, [
          el('div', { class: 'ir-name', text: `${b.name} — ${b.capacity} Mythlings` }),
          el('div', { class: 'ir-desc', text: next
            ? `Carry ${b.capacity - bagTier(b.tier - 1).capacity} more than your current bag.`
            : `Buy ${BAG_TIERS[b.tier - 2].name} first.` }),
        ]),
        el('div', { class: 'ir-qty price' }, [icon('coin', 'gold'), el('span', { text: coins(b.price) })]),
        button('BUY', {
          class: 'small primary', disabled: !next || !afford,
          onclick: async () => {
            const ok = await confirmDialog('BIGGER BAG', `Buy <b>${b.name}</b> for <b>${coins(b.price)} Wildcoins</b>? You will be able to carry <b>${b.capacity}</b> Mythlings.`, 'BUY', 'CANCEL');
            if (!ok) return;
            const res = StorageManager.upgradeBag();
            if (!res.ok) { toast(res.reason, 'bad'); AudioManager.sfx('cancel'); return; }
            AudioManager.sfx('coin');
            toast(`${b.name} bought — you can now carry ${res.capacity} Mythlings`, 'ok');
            refresh();
          },
        }),
      ]));
    }
    return wrap;
  };

  const render = () => {
    const rows = el('div', {});
    for (const id of building.stock) {
      const item = getItem(id);
      if (!item || !item.price) continue;
      const left = stock[id] || 0;
      let qty = 1;
      const totalLabel = el('div', { class: 'ir-qty price' }, [icon('coin', 'gold'), el('span', { text: coins(item.price) })]);
      const qtyLabel = el('b', { text: '1' });
      const setQty = (n) => {
        qty = Math.max(1, Math.min(left || 1, n));
        qtyLabel.textContent = String(qty);
        totalLabel.lastChild.textContent = coins(item.price * qty);
      };
      rows.appendChild(el('div', { class: `item-row${left ? '' : ' sold-out'}` }, [
        item.category === 'balls' ? ballCanvas(item.id, 30, 'item-ico ball-icon') : icon(item.category === 'food' ? 'food' : item.category === 'key' ? 'key' : 'heal', 'item-ico'),
        el('div', { class: 'ir-main' }, [
          el('div', { class: 'ir-name', text: item.name }),
          el('div', { class: 'ir-desc', text: item.desc }),
          el('div', { class: 'ir-desc', text: `Owned: ${InventoryManager.count(id)}` }),
          el('div', { class: `ir-stock${left ? '' : ' out'}`, text: left ? `In stock: ${left}` : 'Out of stock' }),
        ]),
        el('div', { class: 'qty-ctl' }, [
          el('button', { html: iconSvg('minus'), title: 'Less', onclick: () => setQty(qty - 1) }),
          qtyLabel,
          el('button', { html: iconSvg('plus'), title: 'More', onclick: () => setQty(qty + 1) }),
        ]),
        totalLabel,
        button(left ? 'BUY' : 'SOLD OUT', {
          class: 'small primary', disabled: !left,
          onclick: async () => {
            if (!left) { toast(`${item.name} is out of stock.`, 'bad'); return; }
            const total = item.price * qty;
            if (GameState.player.wildcoins < total) { toast('Not enough Wildcoins!', 'bad'); AudioManager.sfx('cancel'); return; }
            const ok = await confirmDialog('CONFIRM PURCHASE', `Buy <b>${qty}× ${item.name}</b> for <b>${coins(total)} Wildcoins</b>?`, 'BUY', 'CANCEL');
            if (!ok) return;
            const res = ShopManager.buy(building, id, qty);
            if (!res.ok) { toast(res.reason, 'bad'); AudioManager.sfx('cancel'); return; }
            AudioManager.sfx('coin');
            toast(`Bought ${res.count}× ${item.name}`, 'ok');
            refresh();
          },
        }),
      ]));
    }
    return rows;
  };

  let node;
  const refresh = () => {
    if (clock) { clearInterval(clock); clock = null; }   // one countdown at a time, however often we re-render
    const content = el('div', { class: 'dialog panel screen-inner', style: { maxWidth: '860px' } }, [
      panelHeader(building.name, leave),
      el('p', { class: 'sub coin-line' }, [
        el('span', { text: 'Wildcoins:' }), icon('coin', 'gold'),
        el('b', { style: { color: '#ffe08a' }, text: coins(GameState.player.wildcoins) }),
      ]),
      bagSection(),
      el('div', { class: 'shop-head' }, [
        el('span', { text: 'GOODS' }),
        countdown(),
      ]),
      render(),
      el('div', { class: 'row end', style: { marginTop: '16px' } }, [button('LEAVE SHOP', { class: 'primary', onclick: leave, sfx: 'cancel' })]),
    ]);
    node = Screens.replace(content, 'shop', leave);
  };

  function leave() {
    if (clock) { clearInterval(clock); clock = null; }
    onClose();
  }

  refresh();
  return node;
}
export function centerScreen({ onHeal, onParty, onStorage, onSave, onClose }) {
  const party = el('div', { class: 'grid-cards' });
  for (const m of PartyManager.list()) {
    const pct = hpPercent(m);
    party.appendChild(el('div', { class: 'myth-card' }, [
      mythCanvas(m, 60),
      el('div', { class: 'mc-main' }, [
        el('div', { class: 'mc-name', text: `${displayName(m)} Lv.${m.level}` }),
        bar('hp', pct, hpClass(pct)),
        el('div', { class: 'mc-sub', text: `${m.currentHp}/${maxHp(m)} HP · Ultimate ${m.ultCharge}/8` }),
      ]),
    ]));
  }
  const node = el('div', { class: 'dialog panel screen-inner', style: { maxWidth: '760px' } }, [
    panelHeader('Mythling Center', onClose,
      'Rest your team here. Healing is free and instant: HP, skill uses, Ultimate Charge and battle status are all restored.'),
    party,
    el('div', { class: 'row', style: { marginTop: '18px', gap: '10px' } }, [
      iconTextBtn('heal', 'HEAL ALL', { class: 'primary', onclick: onHeal, sfx: 'heal' }),
      iconTextBtn('dna', 'PARTY', { class: 'ghost', onclick: onParty }),
      iconTextBtn('box', 'STORAGE', { class: 'ghost', onclick: onStorage }),
      iconTextBtn('save', 'SAVE GAME', { class: 'ghost', onclick: onSave }),
      el('div', { class: 'spacer', style: { flex: 1 } }),
      button('LEAVE', { class: 'ghost', onclick: onClose, sfx: 'cancel' }),
    ]),
  ]);
  Screens.replace(node, 'center', onClose);
}

// ------------------------------------------------------------------ EVOLUTION CINEMATIC
/**
 * Evolution is staged like a transformation, not a jump cut: the old form is
 * held, then cracks between forms faster and faster, then a short flash lands
 * on the new one — which then stays on screen, idling, behind the summary.
 *
 * Two things this used to get wrong, both now fixed:
 *  - the canvas was 460x460 but stretched by CSS into a wide, short box, so
 *    the Mythling came out squashed and blurry. It is now square at every
 *    size and backed at device resolution.
 *  - the summary was appended under a full-size canvas in a non-scrolling
 *    overlay, so on short windows the CONTINUE button sat off screen.
 */
export function evolutionCinematic(mythling, result, onDone) {
  const SIZE = 460;                       // logical drawing units; CSS sizes the box
  // In the summary the Mythling stands at y=330 of 460, so everything below
  // ~356 is empty. The done-state canvas is cropped to that height (CSS keeps
  // the same ratio) so the title sits directly under the evolved Mythling.
  const DONE_HEIGHT = 356;
  const layer = el('div', { class: 'cinematic' });
  const stage = el('div', { class: 'cinematic-stage' });
  const cv = el('canvas', { width: SIZE, height: SIZE });
  const title = el('h2', { text: `${result.from} is evolving...` });
  const sub = el('p', { text: 'Do not look away!' });
  stage.append(cv, title, sub);
  layer.appendChild(stage);
  document.getElementById('app').appendChild(layer);
  AudioManager.playTheme('evolve');
  AudioManager.sfx('evolve');

  const ctx = cv.getContext('2d');
  const fromStage = Math.max(0, mythling.stage - 1);
  const start = performance.now();
  const DURATION = 4200;
  const REVEAL = 0.86;                    // the new form stops flickering here
  let raf = 0;
  let scale = 1;
  let cssW = 0;
  let lastPaint = 0;

  // Back the canvas at device resolution for whatever size CSS gave it, so the
  // Mythling is crisp instead of a 460px bitmap stretched to fit.
  let fitDone = false;
  const fit = () => {
    const w = Math.round(cv.clientWidth || SIZE);
    const done = layer.classList.contains('done');
    if (!w || (w === cssW && done === fitDone)) return;
    cssW = w;
    fitDone = done;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(w * dpr * ((done ? DONE_HEIGHT : SIZE) / SIZE));
    scale = (w * dpr) / SIZE;
  };

  // held -> flickering -> locked to the new form
  const showNewForm = (t, p) => {
    if (p >= REVEAL) return true;
    if (p < 0.46) return false;
    const u = (p - 0.46) / (REVEAL - 0.46);
    const hz = 3 + 6 * u;                 // 3 -> 9 Hz: it crackles, it never strobes
    return Math.sin(t * hz * Math.PI * 2) > 0;
  };

  const paint = (t, p) => {
    fit();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    // a short deliberate burst that has fully cleared by the time p hits 1,
    // so the evolved Mythling is never left behind a white blob
    const flash = p < REVEAL ? 0
      : p < 0.94 ? (p - REVEAL) / 0.08
        : Math.max(0, 1 - (p - 0.94) / 0.06);
    const glow = p < REVEAL ? 0.16 + 0.4 * p : 0.55 - 0.27 * ((p - REVEAL) / 0.14);

    const g = ctx.createRadialGradient(230, 250, 10, 230, 250, 220);
    g.addColorStop(0, `rgba(255,240,180,${glow})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const motes = p < REVEAL ? 40 : 18;
    for (let i = 0; i < motes; i++) {
      const a = (i / motes) * Math.PI * 2 + t;
      const r = 40 + ((t * 90 + i * 17) % 190);
      ctx.globalAlpha = (1 - r / 230) * (p < REVEAL ? 0.8 : 0.45);
      ctx.fillStyle = i % 3 === 0 ? '#fff6c8' : '#ffd76a';
      ctx.beginPath();
      ctx.arc(230 + Math.cos(a) * r * 0.7, 300 - r * 0.8, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(230, 330);
    const s = 1 + (p < REVEAL ? 0.14 * p : 0.14 * (1 - (p - REVEAL) / 0.14));
    ctx.scale(s, s);
    drawCreature(ctx, {
      speciesId: mythling.speciesId,
      stage: showNewForm(t, p) ? mythling.stage : fromStage,
      mutation: mythling.mutation,
      x: 0, y: 0, size: 190, t, facing: 1,
      pose: p >= 1 ? { alpha: 1 } : { alpha: 1, anim: { name: 'evolve', phase: p } },
    });
    ctx.restore();

    if (flash > 0) {
      ctx.globalAlpha = flash * 0.92;
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.globalAlpha = 1;
    }
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  // Keep the evolved Mythling alive and idling behind the summary (throttled
  // to ~30fps: it is decoration while the player reads).
  const reveal = (now) => {
    if (!layer.isConnected) { raf = 0; return; }
    if (now - lastPaint >= 32) { lastPaint = now; paint((now - start) / 1000, 1); }
    raf = requestAnimationFrame(reveal);
  };

  const loop = (now) => {
    const t = (now - start) / 1000;
    const p = Math.min(1, (now - start) / DURATION);
    paint(t, p);
    if (p >= 1) {
      finish();
      raf = requestAnimationFrame(reveal);
      return;
    }
    raf = requestAnimationFrame(loop);
  };

  const finish = () => {
    AudioManager.sfx('levelup');
    layer.classList.add('done');           // shrink the canvas so the summary fits
    title.textContent = 'Congratulations!';
    sub.innerHTML = `<b>${result.from}</b> evolved into <b style="color:#ffd76a">${result.to}</b>!`;
    const gains = el('div', { class: 'levelup-list' }, Object.entries(result.gains)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => el('div', { class: 'gain', text: `${STAT_SHORT[k]} ${v > 0 ? '+' : ''}${v}` })));
    const skills = result.newSkills.length
      ? el('p', { html: `New skills added to the Skill Library: <b>${result.newSkills.map((s) => s.replace(/_/g, ' ')).join(', ')}</b>` })
      : null;
    const ult = el('p', { html: `Ultimate upgraded to <b style="color:#ffd76a">${result.ultimate.name}</b>!` });
    const btn = button('CONTINUE', {
      class: 'primary',
      onclick: () => { stop(); layer.remove(); onDone(); },
    });
    stage.append(gains, skills || el('span'), ult, btn);
    setTimeout(() => btn.focus && btn.focus(), 0);
  };

  fit();
  raf = requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ LEVEL UP SUMMARY
/**
 * Collapses a (possibly long) list of level events into ONE entry per Mythling
 * ("Lv.12 → Lv.15" with the combined stat gains) and puts the whole thing in a
 * scrollable box, so a whole party levelling up at once stays readable.
 */
export function groupLevelUps(entries) {
  const groups = [];
  const byKey = new Map();
  for (const e of entries) {
    const key = e.uid || e.name;
    let g = byKey.get(key);
    if (!g) {
      g = { uid: e.uid || null, name: e.name, from: e.level - 1, to: e.level, gains: {}, milestones: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.from = Math.min(g.from, e.level - 1);
    g.to = Math.max(g.to, e.level);
    for (const [k, v] of Object.entries(e.gains || {})) g.gains[k] = (g.gains[k] || 0) + v;
    for (const ms of e.milestones || []) if (!g.milestones.includes(ms)) g.milestones.push(ms);
  }
  return groups;
}

export function levelUpSummary(entries, onDone) {
  if (!entries.length) { onDone(); return; }
  const groups = groupLevelUps(entries);
  const body = el('div', { class: 'levelup-body' });
  for (const g of groups) {
    body.appendChild(el('h3', { text: `${g.name}  ·  Lv.${g.from} → Lv.${g.to}` }));
    const gains = Object.entries(g.gains).filter(([, v]) => v !== 0);
    body.appendChild(el('div', { class: 'levelup-list' }, gains.length
      ? gains.map(([k, v]) => el('div', {
        class: `gain ${v > 0 ? 'up' : 'down'}`,
        text: `${STAT_SHORT[k]} ${v > 0 ? '+' : ''}${v}`,
      }))
      : [el('div', { class: 'gain', text: 'no stat change' })]));
    for (const ms of g.milestones) {
      if (ms === 'ultimate') body.appendChild(el('p', { html: `${iconSvg('ultimate', 'gold')} <b style="color:#ffd76a">ULTIMATE UNLOCKED!</b> Charge it by attacking — 8 charges to unleash it.` }));
      if (ms === 'evolution') body.appendChild(el('p', { html: `${iconSvg('levelup', 'good')} <b style="color:#6de89a">EVOLUTION AVAILABLE!</b>` }));
      if (ms === 'maxlevel') body.appendChild(el('p', { html: `<b style="color:#ffd76a">MAX LEVEL Lv.${LEVEL_CAP} REACHED!</b> Further levels arrive in a future update.` }));
    }
  }
  const title = groups.length > 1 ? `LEVEL UP! (${groups.length} Mythlings)` : 'LEVEL UP!';
  // .levelup-body scrolls itself, so the modal wrapper must not add a second scrollbar.
  modal({ title, body, scroll: false, buttons: [{ label: 'NICE!', value: true, primary: true }] }).then(onDone);
}

// ------------------------------------------------------------------ VERSION COMPLETE
export function versionCompleteScreen(onDone) {
  const layer = el('div', { class: 'cinematic' });
  const stage = el('div', { class: 'cinematic-stage' });
  layer.appendChild(stage);
  stage.append(
    el('h2', { text: 'STONEHOLLOW CRAGS COMPLETE' }),
    el('h2', { style: { fontSize: '1.4rem', color: '#eaf3ff' }, text: 'Current Version Complete' }),
    el('p', { text: 'You have bested the Stone Warden and cleared every region of the current build of Wildbound.' }),
    el('p', { text: 'The world stays open: keep exploring all four regions, hunt for Shiny and Darkness mutations, chase better Moods, Rationals and Rarities, complete your collection, and raise your team to Lv.100.' }),
    el('p', { class: 'sub', text: 'More regions and Mythlings arrive in future updates.' }),
    button('CONTINUE EXPLORING', { class: 'primary', onclick: () => { layer.remove(); onDone(); } }),
  );
  document.getElementById('app').appendChild(layer);
  AudioManager.sfx('levelup');
}


// Give PlayerMenu access to the level-up summary without a circular import.
_bindLevelUpSummary(levelUpSummary);
