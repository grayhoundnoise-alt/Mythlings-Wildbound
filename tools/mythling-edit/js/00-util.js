'use strict';
// =============================================================================
// MYTHLING EDIT — utilities
// =============================================================================
const EDITOR_VERSION = '1.0.0';
const PROJECT_FORMAT_VERSION = 1;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const round = (v, d = 2) => { const m = 10 ** d; return Math.round(v * m) / m; };
const deg2rad = (d) => d * Math.PI / 180;
const rad2deg = (r) => r * 180 / Math.PI;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const deepClone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const nowIso = () => new Date().toISOString();
/** seconds → "1.25s" (timeline display) */
const fmtTime = (t) => `${(Math.round((+t || 0) * 1000) / 1000).toFixed(2)}s`;
const fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const pad2 = (n) => String(n).padStart(2, '0');
const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
const titleCase = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let _uidCounter = 0;
function uid(prefix = 'n') {
  _uidCounter = (_uidCounter + 1) % 46656;
  return `${prefix}_${Date.now().toString(36)}${_uidCounter.toString(36).padStart(3, '0')}`;
}
/** Unique, readable name inside a namespace: Tree_001, Tree_002… */
function nextName(base, existing) {
  const set = new Set(existing);
  let n = 1;
  while (set.has(`${base}_${pad3(n)}`)) n++;
  return `${base}_${pad3(n)}`;
}
const pad3 = (n) => String(n).padStart(3, '0');

// ---------------------------------------------------------------- DOM
function h(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return n;
}
const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

// ---------------------------------------------------------------- icons (original line icons)
const ICONS = {
  select: '<path d="M4 3l7 17 2.5-6.5L20 11z"/>',
  move: '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
  scale: '<path d="M4 20V10M4 20h10M14 4h6v6M20 4l-8 8"/>',
  draw: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6"/>',
  polygon: '<path d="M12 3l9 6.5-3.5 10.5h-11L3 9.5z"/>',
  path: '<path d="M4 18c4-10 8 10 16-6"/><circle cx="4" cy="18" r="1.6"/><circle cx="20" cy="12" r="1.6"/>',
  anchor: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M5 13a7 7 0 0 0 14 0"/><path d="M3 13h4M17 13h4"/>',
  pivot: '<circle cx="12" cy="12" r="3"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  collision: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M8 12l3 3 5-6"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  loop: '<path d="M17 3l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 21l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  stepBack: '<path d="M18 4v16L8 12zM6 4v16"/>',
  stepFwd: '<path d="M6 4v16l10-8zM18 4v16"/>',
  undo: '<path d="M4 9h11a5 5 0 0 1 0 10H9"/><path d="M8 5L4 9l4 4"/>',
  redo: '<path d="M20 9H9a5 5 0 0 0 0 10h6"/><path d="M16 5l4 4-4 4"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  paint: '<path d="M18 3l3 3-9 9-4 1 1-4z"/><path d="M4 21c2-4 5-4 7-2s-3 4-7 2z"/>',
  erase: '<path d="M4 16l9-9 6 6-6 6H8z"/><path d="M8 19h12"/>',
  fill: '<path d="M5 12l7-7 7 7-7 7z"/><path d="M19 15c1 1.5 1 3 0 4-1-1-1-2.5 0-4z"/>',
  brush: '<path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12c-2 2-2 6-4 8 3 0 6 0 8-3"/>',
  water: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  spawn: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  warp: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M21 3l-9 9"/>',
  trigger: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  npc: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10 6a10 10 0 0 1 12 6 13 13 0 0 1-3 4M6.5 6.5A13 13 0 0 0 2 12s4 7 10 7c1.5 0 3-.4 4.3-1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  folderOpen: '<path d="M3 6h6l2 2h10v3H6l-3 8z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
  text: '<path d="M5 5h14M12 5v14M9 19h6"/>',
  group: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M11 7h2v6"/>',
  tree: '<path d="M12 2l6 9h-3l4 6H5l4-6H6z"/><path d="M12 17v5"/>',
  rock: '<path d="M4 17l3-8 6-4 7 6-2 6z"/>',
  bush: '<circle cx="8" cy="14" r="5"/><circle cx="15" cy="12" r="6"/><path d="M4 19h16"/>',
  flower: '<circle cx="12" cy="9" r="2.5"/><circle cx="12" cy="4" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="7" cy="8" r="2"/><circle cx="9" cy="13" r="2"/><circle cx="15" cy="13" r="2"/><path d="M12 12v9"/>',
  box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  sign: '<path d="M4 5h14l3 3-3 3H4z"/><path d="M11 11v10"/>',
  building: '<path d="M3 21V9l9-6 9 6v12z"/><path d="M9 21v-6h6v6"/>',
  chest: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 12h18M12 12v3"/>',
  star: '<path d="M12 2l3 6.5 7 1-5 5 1.2 7L12 18l-6.2 3.5L7 14.5l-5-5 7-1z"/>',
  creature: '<path d="M6 20c-2-4-1-9 2-12l2 3 2-4 2 4 2-3c3 3 4 8 2 12z"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>',
  bone: '<path d="M6 8a2 2 0 1 1 3-3l6 6a2 2 0 1 1 3 3 2 2 0 1 1-3 3l-6-6a2 2 0 1 1-3-3z"/>',
  vfx: '<path d="M12 2l1.5 5 5 1.5-5 1.5L12 15l-1.5-5-5-1.5 5-1.5z"/><path d="M5 17l.8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8z"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>',
  export: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  import: '<path d="M12 15V3M7 10l5 5 5-5"/><path d="M4 15v5h16v-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.4 3h-4l-.4 2.6a7 7 0 0 0-1.7 1L5.9 5.6l-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z"/>',
  grid: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  dup: '<rect x="4" y="4" width="10" height="10" rx="1"/><rect x="10" y="10" width="10" height="10" rx="1"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M17 5l2 2M14 8l2 2"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  flag: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  point: '<circle cx="12" cy="12" r="3"/>',
  home: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M4 12l5 5L20 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  door: '<path d="M4 21h16M6 21V3h9v18"/><circle cx="12" cy="12" r="1"/>',
  bridge: '<path d="M2 14h20M4 14V9c4-5 12-5 16 0v5M8 14v5M16 14v5M12 14v5"/>',
  crystal: '<path d="M12 2l5 6-5 14-5-14z"/><path d="M7 8h10"/>',
  fence: '<path d="M4 20V8l2-3 2 3v12M16 20V8l2-3 2 3v12M4 12h16M4 17h16"/>',
  package: '<path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  waterfall: '<path d="M5 3v8M9 3v11M13 3v8M17 3v11M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  mushroom: '<path d="M3 11a9 6 0 0 1 18 0z"/><path d="M9 11v9h6v-9"/>',
  log: '<ellipse cx="6" cy="12" rx="3" ry="5"/><path d="M6 7h12a3 5 0 0 1 0 10H6"/>',
  reed: '<path d="M8 21V6M12 21V3M16 21V7"/><ellipse cx="12" cy="5" rx="1.5" ry="3"/>',
  dock: '<path d="M3 12h18M5 12v8M12 12v8M19 12v8M7 12V6l5-3 5 3v6"/>',
  gate: '<path d="M4 21V6a8 8 0 0 1 16 0v15"/><path d="M4 21h16M12 6v15M4 12h16"/>',
  none: '',
};
function icon(name, cls = '') {
  const p = ICONS[name] ?? ICONS.point;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = p;
  return s;
}
const iconHtml = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.point}</svg>`;

// ---------------------------------------------------------------- toasts / console
const toastsRoot = () => $('#toasts');
function toast(msg, kind = '', ms = 2600) {
  const n = h('div', { class: `toast ${kind}`, text: msg });
  toastsRoot().appendChild(n);
  setTimeout(() => { n.style.opacity = '0'; n.style.transition = 'opacity .3s'; setTimeout(() => n.remove(), 320); }, ms);
}
const ConsoleLog = {
  lines: [],
  push(kind, msg) {
    const d = new Date();
    this.lines.push({ kind, msg: String(msg), t: `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` });
    if (this.lines.length > 400) this.lines.shift();
    if (typeof Bottom !== 'undefined' && Bottom.tab === 'console') Bottom.render();
  },
  info(m) { this.push('', m); },
  ok(m) { this.push('ok', m); },
  warn(m) { this.push('warn', m); },
  error(m) { this.push('err', m); },
};

// ---------------------------------------------------------------- dialogs
function dialog({ title, body, buttons = [{ label: 'CLOSE', value: true }], wide = false, onOpen } = {}) {
  return new Promise((resolve) => {
    const ov = h('div', { class: 'overlay' });
    const box = h('div', { class: `dialog ${wide ? 'wide' : ''}` });
    const close = (v) => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
    box.appendChild(h('header', {}, [h('h3', { text: title || '' }), h('button', { class: 'x', title: 'Close', onclick: () => close(null) }, '×')]));
    const b = h('div', { class: 'body' });
    if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
    box.appendChild(b);
    if (buttons && buttons.length) {
      box.appendChild(h('footer', {}, buttons.map((bt) => h('button', {
        class: `btn ${bt.primary ? 'primary' : ''} ${bt.danger ? 'danger' : ''}`,
        onclick: async () => { if (bt.onClick) { const r = await bt.onClick(); if (r === false) return; } close('value' in bt ? bt.value : bt.label); },
      }, bt.label))));
    }
    ov.appendChild(box);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(null); });
    document.body.appendChild(ov);
    document.addEventListener('keydown', onKey);
    if (onOpen) onOpen(box, close);
  });
}
async function confirmDialog(title, text, yes = 'YES', no = 'CANCEL', danger = false) {
  const r = await dialog({ title, body: `<p>${text}</p>`, buttons: [{ label: no, value: false }, { label: yes, value: true, primary: !danger, danger }] });
  return r === true;
}
function promptDialog(title, label, value = '', placeholder = '') {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', value, placeholder });
    dialog({
      title, body: h('div', { class: 'field', style: { gridTemplateColumns: '110px 1fr' } }, [h('label', { text: label }), input]),
      buttons: [{ label: 'CANCEL', value: null }, { label: 'OK', value: '__ok__', primary: true }],
      onOpen: (box) => { setTimeout(() => input.focus(), 30); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') box.querySelector('footer .btn.primary').click(); }); },
    }).then((r) => resolve(r === '__ok__' ? input.value : null));
  });
}

// ---------------------------------------------------------------- files / clipboard
function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard', 'ok'); return true; }
  catch {
    const ta = h('textarea', { style: { position: 'fixed', left: '-9999px' } }); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied to clipboard', 'ok'); return true; } catch { toast('Clipboard blocked — select the text and copy manually', 'warn'); return false; } finally { ta.remove(); }
  }
}
function pickFile(accept, multiple = false) {
  return new Promise((resolve) => {
    const inp = $('#file-input');
    inp.value = ''; inp.accept = accept || ''; inp.multiple = multiple;
    inp.onchange = () => resolve(multiple ? [...inp.files] : inp.files[0] || null);
    inp.click();
  });
}
const readAsText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
const readAsDataURL = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
const loadImage = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

// ---------------------------------------------------------------- math: 2D affine [a b c d e f]
const M = {
  identity: () => [1, 0, 0, 1, 0, 0],
  mul(m, n) { // m * n  (apply n first, then m)
    return [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  },
  invert(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    if (!det) return M.identity();
    const id = 1 / det;
    return [m[3] * id, -m[1] * id, -m[2] * id, m[0] * id, (m[2] * m[5] - m[3] * m[4]) * id, (m[1] * m[4] - m[0] * m[5]) * id];
  },
  apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
  applyVec(m, x, y) { return [m[0] * x + m[2] * y, m[1] * x + m[3] * y]; },
  /** translate(x,y) · rotate(rot) · scale(sx,sy) · translate(-px,-py) */
  compose(x, y, rotDeg, sx, sy, px = 0, py = 0) {
    const r = deg2rad(rotDeg || 0), c = Math.cos(r), s = Math.sin(r);
    const a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
    return [a, b, cc, d, x - (a * px + cc * py), y - (b * px + d * py)];
  },
  rotationOf(m) { return rad2deg(Math.atan2(m[1], m[0])); },
  scaleOf(m) { return [Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3])]; },
};

// ---------------------------------------------------------------- easing
const EASINGS = {
  linear: (k) => k,
  easeIn: (k) => k * k,
  easeOut: (k) => 1 - (1 - k) * (1 - k),
  easeInOut: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  step: (k) => (k < 1 ? 0 : 1),
};
const EASING_IDS = Object.keys(EASINGS);

// ---------------------------------------------------------------- colors
function hexToRgb(hex) {
  const s = String(hex || '#000').replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
function mixHex(a, b, k) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k); }
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
const shade = (hex, k) => mixHex(hex, '#000000', k);
const tint = (hex, k) => mixHex(hex, '#ffffff', k);

// ---------------------------------------------------------------- geometry
function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
  }
  return inside;
}
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}
/** Closest point on segment AB to P (clamped to the segment). */
function projectOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = clamp(l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0, 0, 1);
  return [ax + dx * t, ay + dy * t];
}
function distToPolyline(px, py, pts, closed = false) {
  let best = Infinity;
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    best = Math.min(best, distToSegment(px, py, a[0], a[1], b[0], b[1]));
  }
  return best;
}
function boundsOfPoints(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function rectsIntersect(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function rectContains(a, b) { return b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h; }
/** Smooth polyline (Catmull-Rom → bezier) path builder */
function tracePath(ctx, pts, smooth, closed) {
  if (!pts.length) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (!smooth || pts.length < 3) {
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
    return;
  }
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}
/** Deterministic pseudo-random in [0,1) from integers */
function hash2(x, y, seed = 0) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
