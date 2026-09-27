// Small DOM toolkit + shared UI pieces (screens, dialogue, toasts, modals).
import { AudioManager } from '../systems/AudioManager.js';
import { SettingsManager } from '../systems/SettingsManager.js';
import { ELEMENTS } from '../data/elements.js';
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
export function modalOpen() { return !!activeModalClose; }
export function dismissModal() {
  if (!activeModalClose) return false;
  AudioManager.sfx('cancel');
  activeModalClose();
  return true;
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
    const layer = document.getElementById('modal');
    layer.innerHTML = '';
    layer.classList.remove('hidden');
    const btns = buttons || [{ label: 'OK', value: true, primary: true }];
    const close = (v) => {
      layer.classList.add('hidden'); layer.innerHTML = '';
      if (activeModalClose === dismiss) activeModalClose = null;
      resolve(v);
    };
    // Dismissing (X / ESC) resolves with the explicit cancel value, else the first
    // non-primary button's value, else false — never a silently ignored promise.
    const fallback = cancelValue !== undefined
      ? cancelValue
      : (btns.find((b) => !b.primary) || {}).value ?? false;
    const dismiss = () => close(fallback);
    if (dismissible) activeModalClose = dismiss;
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
  const e = ELEMENTS[elementId];
  return el('span', { class: `chip ${elementId}` }, [icon(elementId), el('span', { text: e.name })]);
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
