// Small DOM toolkit + shared UI pieces (screens, dialogue, toasts, modals).
import { AudioManager } from '../systems/AudioManager.js';
import { SettingsManager } from '../systems/SettingsManager.js';
import { ELEMENTS, speciesElements } from '../data/elements.js';
import { getRarity } from '../data/rarity.js';
import { getMutation } from '../data/mutations.js';
import { icon, iconSvg } from './icons.js';

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function button(label, opts = {}) {
  const b = el('button', { class: `btn ${opts.class || ''}`, ...(opts.disabled ? { disabled: true } : {}) }, [label]);
  b.addEventListener('mouseenter', () => AudioManager.sfx('hover'));
  if (opts.onclick) b.addEventListener('click', (e) => { AudioManager.sfx(opts.sfx || 'click'); opts.onclick(e); });
  if (opts.title) b.title = opts.title;
  return b;
}

export const Screens = {
  root: null,
  stack: [],
  init() { this.root = document.getElementById('screens'); },
  /** @param onClose optional handler making the screen closable with ESC / the X button. */
  push(node, id, onClose = null) {
    const wrap = el('div', { class: 'screen', 'data-id': id || '' }, [node]);
    wrap._onClose = onClose;
    this.root.appendChild(wrap);
    this.stack.push(wrap);
    return wrap;
  },
  replace(node, id, onClose = null) { this.clear(); return this.push(node, id, onClose); },
  pop() { const w = this.stack.pop(); if (w) w.remove(); },
  clear() { this.stack.forEach((w) => w.remove()); this.stack = []; },
  top() { return this.stack[this.stack.length - 1]; },
  get count() { return this.stack.length; },
  /** Close the topmost screen through its own handler. Returns true if something closed. */
  closeTop() {
    const w = this.top();
    if (!w || typeof w._onClose !== 'function') return false;
    AudioManager.sfx('cancel');
    w._onClose();
    return true;
  },
};

/**
 * Standard header for every panel: title on the left, an X close button on the right.
 * Using this everywhere is what keeps the panels visually consistent.
 */
export function panelHeader(title, onClose, subtitle = '') {
  return el('div', { class: 'panel-head' }, [
    el('div', { class: 'panel-head-text' }, [
      el('h2', { text: title }),
      subtitle ? el('p', { class: 'sub', text: subtitle }) : null,
    ]),
    onClose ? closeButton(onClose) : null,
  ]);
}

export function closeButton(onClose, title = 'Close (ESC)') {
  const b = el('button', { class: 'icon-btn close-btn', title, 'aria-label': title, html: iconSvg('close') });
  b.addEventListener('mouseenter', () => AudioManager.sfx('hover'));
  b.addEventListener('click', () => { AudioManager.sfx('cancel'); onClose(); });
  return b;
}

export function toast(text, kind = '') {
  const layer = document.getElementById('toast-layer');
  const t = el('div', { class: `toast ${kind}`, text });
  layer.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .4s, transform .4s'; t.style.opacity = '0'; t.style.transform = 'translateY(-12px)'; }, 1800);
  setTimeout(() => t.remove(), 2300);
}

/** Currently open modal's dismiss handler (used by the global ESC handler). */
let activeModalClose = null;
/** The `close(value)` of the modal currently on screen — lets code that built
 *  the modal body finish it programmatically (see closeModal). */
let activeModalFinish = null;

function modalLayerVisible() {
  const layer = document.getElementById('modal');
  return !!layer && !layer.classList.contains('hidden');
}

/**
 * Is a modal blocking input? Self-healing: if the #modal layer was hidden by
 * some other path while a dismiss handle was still registered, the stale
 * handle is dropped instead of freezing WASD/E for the rest of the session.
 */
export function modalOpen() {
  if (!activeModalClose) return false;
  if (!modalLayerVisible()) { activeModalClose = null; activeModalFinish = null; return false; }
  return true;
}
export function dismissModal() {
  if (!modalOpen()) return false;
  AudioManager.sfx('cancel');
  activeModalClose();
  return true;
}

/**
 * Close the modal that is currently open and resolve its promise with `value`.
 * THE way to close a modal from inside its own body (a card click, a USE
 * button, ...). Hiding the layer by hand used to leave the dismiss handle
 * registered, so the game thought a modal was still open and ignored every
 * key except ESC — the "everything froze after I clicked X" bug.
 */
export function closeModal(value) {
  if (activeModalFinish) { activeModalFinish(value); return true; }
  const layer = document.getElementById('modal');
  if (layer) { layer.classList.add('hidden'); layer.innerHTML = ''; }
  activeModalClose = null;
  return false;
}

/**
 * @param {object} opts
 *  wide:   roomier box (used by the Mythling detail panel so it does not turn
 *          into one very tall column of text)
 *  scroll: cap the body height and let long content scroll instead of running
 *          off the bottom of the screen
 */
export function modal({ title, body, buttons, dismissible = true, cancelValue, wide = false, scroll = true }) {
  return new Promise((resolve) => {
    // Only one modal is ever on screen: opening a new one settles the old one
    // (resolving its promise) BEFORE the layer is reused.
    if (activeModalFinish) activeModalFinish(undefined);
    const layer = document.getElementById('modal');
    layer.innerHTML = '';
    layer.classList.remove('hidden');
    const btns = buttons || [{ label: 'OK', value: true, primary: true }];
    let settled = false;
    const close = (v) => {
      if (settled) return;
      settled = true;
      layer.classList.add('hidden'); layer.innerHTML = '';
      if (activeModalClose === dismiss) activeModalClose = null;
      if (activeModalFinish === close) activeModalFinish = null;
      resolve(v);
    };
    // Dismissing (X / ESC) resolves with the explicit cancel value, else the first
    // non-primary button's value, else false — never a silently ignored promise.
    const fallback = cancelValue !== undefined
      ? cancelValue
      : (btns.find((b) => !b.primary) || {}).value ?? false;
    const dismiss = () => close(fallback);
    activeModalClose = dismissible ? dismiss : null;
    activeModalFinish = close;
    const box = el('div', { class: `modal panel ${wide ? 'wide' : ''}` }, [
      el('div', { class: 'panel-head' }, [
        el('div', { class: 'panel-head-text' }, [el('h3', { text: title || '' })]),
        dismissible ? closeButton(dismiss) : null,
      ]),
      el('div', { class: `modal-body ${scroll ? 'scroll-y' : ''}` },
        [typeof body === 'string' ? el('p', { html: body }) : body]),
      el('div', { class: 'row end', style: { marginTop: '12px' } }, btns.map((b) =>
        button(b.label, { class: b.primary ? 'primary' : b.danger ? 'danger' : 'ghost', onclick: () => close(b.value) }))),
    ]);
    layer.appendChild(box);
  });
}

/**
 * Single ESC policy for the whole game: modal first, then the topmost closable
 * panel. Returns true when it consumed the key.
 */
export function handleGlobalEscape() {
  if (dismissModal()) return true;
  if (Screens.closeTop()) return true;
  return false;
}

export function confirmDialog(title, text, yes = 'YES', no = 'NO') {
  return modal({
    title, body: text,
    buttons: [{ label: no, value: false }, { label: yes, value: true, primary: true }],
  });
}

// ---------------- Dialogue box with typewriter ----------------
export const Dialogue = {
  node: null, nameNode: null, textNode: null,
  queue: [], resolve: null, typing: false, timer: null, full: '',
  init() {
    this.node = document.getElementById('dialogue');
    this.nameNode = document.getElementById('dialogue-name');
    this.textNode = document.getElementById('dialogue-text');
    this.node.addEventListener('click', () => this.advance());
  },
  get open() { return !this.node.classList.contains('hidden'); },
  show(lines, speaker = '') {
    this.queue = [].concat(lines);
    this.speaker = speaker;
    this.node.classList.remove('hidden');
    return new Promise((res) => { this.resolve = res; this.next(); });
  },
  next() {
    if (!this.queue.length) { this.close(); return; }
    const line = this.queue.shift();
    this.nameNode.textContent = this.speaker || '';
    this.full = line;
    const delay = SettingsManager.textDelay();
    if (delay === 0) { this.textNode.textContent = line; this.typing = false; return; }
    this.typing = true;
    this.textNode.textContent = '';
    let i = 0;
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.textNode.textContent = line.slice(0, ++i);
      if (i >= line.length) { clearInterval(this.timer); this.typing = false; }
    }, delay);
  },
  advance() {
    if (!this.open) return;
    if (this.typing) { clearInterval(this.timer); this.textNode.textContent = this.full; this.typing = false; return; }
    AudioManager.sfx('click');
    this.next();
  },
  close() {
    clearInterval(this.timer);
    this.node.classList.add('hidden');
    const r = this.resolve; this.resolve = null;
    if (r) r();
  },
};

export function fade(on) {
  const f = document.getElementById('fade');
  f.classList.toggle('on', !!on);
  return new Promise((r) => setTimeout(r, 360));
}

// ---------------- chips ----------------
export function elementChip(elementId) {
  const e = ELEMENTS[elementId] || { name: elementId };
  return el('span', { class: `chip ${elementId}` }, [icon(ELEMENTS[elementId]?.icon || 'spark'), el('span', { text: e.name })]);
}

/** One chip per element of a species (dual / triple types get two or three), plus a LEGENDARY chip. */
export function elementChips(sp) {
  const out = speciesElements(sp).map(elementChip);
  if (sp?.legendary) out.push(el('span', { class: 'chip legendary', title: 'Legendary: one form, 2-3 elements, rare spawn, Absolute Ball or better to catch' }, [icon('ultimate'), el('span', { text: 'Legendary' })]));
  return out;
}

export function rarityChip(rarityId) {
  const r = getRarity(rarityId);
  return el('span', { class: 'chip rarity', style: { borderColor: r.color, color: r.color }, text: `${r.name}${r.magnitude ? ` +${r.magnitude}` : ''}` });
}

export function mutationChip(mutationId) {
  if (!mutationId || mutationId === 'none') return null;
  const m = getMutation(mutationId);
  return el('span', { class: `chip ${m.id}` }, [icon(m.id === 'shiny' ? 'shiny' : 'darkness'), el('span', { text: m.name })]);
}

export function bar(kind, pct, extraClass = '') {
  return el('div', { class: `bar ${kind} ${extraClass}` }, [el('i', { style: { width: `${Math.max(0, Math.min(1, pct)) * 100}%` } })]);
}

export function hpClass(pct) { return pct <= 0.2 ? 'crit' : pct <= 0.5 ? 'low' : ''; }
