// Headless harness for MythlingEdit.html: boots the built editor inside jsdom with a real 2D canvas
// (@napi-rs/canvas) behind every <canvas>, so rendering code actually runs.
//
//   npm i --no-save jsdom @napi-rs/canvas          (or install them anywhere and point EDITOR_TEST_MODULES at that node_modules)
//   node tools/mythling-edit/test/game-presets.test.mjs
//
// Env: EDITOR_HTML (default: <repo>/MythlingEdit.html), EDITOR_TEST_MODULES (default: <repo>/node_modules)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..', '..', '..');
const modDir = process.env.EDITOR_TEST_MODULES || path.join(root, 'node_modules');
const require = createRequire(path.join(modDir, 'x.js'));
const { JSDOM, VirtualConsole } = require('jsdom');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const file = process.env.EDITOR_HTML || path.join(root, 'MythlingEdit.html');
const html = readFileSync(file, 'utf8');
const vc = new VirtualConsole();
export const errors = [];
export const logs = [];
vc.on('jsdomError', (e) => { const m = e.detail?.stack || e.detail?.message || e.stack || e.message; errors.push('jsdomError: ' + String(m).split('\n').slice(0, 6).join(' | ')); });
vc.on('error', (...a) => errors.push('console.error: ' + a.map((x) => (x && x.stack) || x).join(' ').split('\n').slice(0, 5).join(' | ')));
vc.on('warn', (...a) => logs.push('warn: ' + a.join(' ')));
vc.on('log', (...a) => logs.push('log: ' + a.join(' ')));

const backing = new WeakMap(); // jsdom canvas element -> napi canvas
const SIZES = { 'canvas-wrap': [1280, 720], 'left-body': [300, 600], 'right-body': [340, 600], 'bottom-body': [1600, 200], 'tl-canvas-wrap': [1300, 170] };

export const dom = new JSDOM(html, {
  url: 'http://localhost/MythlingEdit.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(window) {
    const HC = window.HTMLCanvasElement.prototype;
    const getBacking = (el) => {
      let c = backing.get(el);
      const w = Math.max(1, el.width || 300), h = Math.max(1, el.height || 150);
      if (!c || c.width !== w || c.height !== h) { c = createCanvas(w, h); backing.set(el, c); }
      return c;
    };
    const proxies = new WeakMap();
    const wrapCtx = (el, ctx) => {
      if (ctx.__wrapped) return ctx;
      const origDraw = ctx.drawImage.bind(ctx);
      ctx.drawImage = (img, ...rest) => {
        if (img && img.tagName === 'CANVAS') { const b = backing.get(img); if (!b) return; return origDraw(b, ...rest); }
        if (img && img.tagName === 'IMG') { const n = img.__napi; if (!n) return; return origDraw(n, ...rest); }
        return origDraw(img, ...rest);
      };
      const origPattern = ctx.createPattern.bind(ctx);
      ctx.createPattern = (img, rep) => { if (img && img.tagName === 'CANVAS') img = backing.get(img); try { return origPattern(img, rep); } catch { return '#000'; } };
      ctx.__wrapped = true;
      return ctx;
    };
    HC.getContext = function (type) {
      if (type !== '2d') return null;
      const el = this;
      if (proxies.has(el)) return proxies.get(el);
      // a napi context is bound to one bitmap: proxy every access to the backing store matching the element's current size
      const p = new Proxy({}, {
        get(_, k) {
          if (k === 'canvas') return el;
          const ctx = wrapCtx(el, getBacking(el).getContext('2d'));
          const v = ctx[k];
          return typeof v === 'function' ? v.bind(ctx) : v;
        },
        set(_, k, v) { const ctx = getBacking(el).getContext('2d'); ctx[k] = v; return true; },
      });
      proxies.set(el, p);
      return p;
    };
    HC.toDataURL = function (type = 'image/png') { return getBacking(this).toDataURL(type); };
    HC.toBlob = function (cb, type = 'image/png') { const buf = getBacking(this).toBuffer('image/png'); setTimeout(() => cb(new window.Blob([buf], { type })), 0); };
    // <img src="data:..."> decodes through napi so drawImage works
    const ImgProto = window.HTMLImageElement.prototype;
    const srcDesc = Object.getOwnPropertyDescriptor(ImgProto, 'src');
    Object.defineProperty(ImgProto, 'src', {
      get() { return srcDesc.get.call(this); },
      set(v) {
        srcDesc.set.call(this, v);
        const el = this;
        if (typeof v === 'string' && v.startsWith('data:')) {
          const b64 = v.split(',')[1] || '';
          const buf = Buffer.from(b64, v.includes(';base64') ? 'base64' : 'utf8');
          loadImage(buf).then((n) => { el.__napi = n; Object.defineProperty(el, 'naturalWidth', { value: n.width, configurable: true }); Object.defineProperty(el, 'naturalHeight', { value: n.height, configurable: true }); el.dispatchEvent(new window.Event('load')); }).catch(() => el.dispatchEvent(new window.Event('error')));
        }
      },
      configurable: true,
    });
    // layout stubs (jsdom has no layout engine)
    const EP = window.HTMLElement.prototype;
    const sizeOf = (el) => SIZES[el.id] || (el.tagName === 'CANVAS' ? [el.width, el.height] : [200, 24]);
    Object.defineProperty(EP, 'clientWidth', { get() { return sizeOf(this)[0]; }, configurable: true });
    Object.defineProperty(EP, 'clientHeight', { get() { return sizeOf(this)[1]; }, configurable: true });
    Object.defineProperty(EP, 'offsetWidth', { get() { return sizeOf(this)[0]; }, configurable: true });
    Object.defineProperty(EP, 'offsetHeight', { get() { return sizeOf(this)[1]; }, configurable: true });
    window.Element.prototype.getBoundingClientRect = function () { const [w, h] = sizeOf(this); return { x: 0, y: 0, left: 0, top: 0, right: w, bottom: h, width: w, height: h, toJSON() {} }; };
    EP.scrollIntoView = function () {};
    EP.setPointerCapture = function () {}; EP.releasePointerCapture = function () {};
    window.Element.prototype.setPointerCapture = function () {}; window.Element.prototype.releasePointerCapture = function () {};
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true }); Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });
    window.devicePixelRatio = 1;
    window.requestAnimationFrame = (f) => setTimeout(() => f(window.performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    window.indexedDB = undefined; // force the localStorage fallback (deterministic)
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    window.PointerEvent = window.PointerEvent || window.MouseEvent;
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async (t) => { window.__clip = t; } }, configurable: true });
    window.URL.createObjectURL = () => 'blob:fake'; window.URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = function () { window.__downloads = (window.__downloads || []); window.__downloads.push(this.download); };
  },
});
export const { window } = dom;
export const { document } = window;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];
export const btn = (txt, root = document) => { const b = $$('button', root).find((x) => x.textContent.trim().toUpperCase().includes(txt.toUpperCase())); if (!b) throw new Error('no button ' + txt); b.click(); return b; };
export const snapshot = (el, file) => { const b = backing.get(el); if (!b) throw new Error('no backing canvas'); writeFileSync(file, b.toBuffer('image/png')); return file; };
export const pointer = (type, x, y, extra = {}) => { const ev = new window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, ...extra }); Object.defineProperty(ev, 'pointerId', { value: 1 }); Object.defineProperty(ev, 'pointerType', { value: 'mouse' }); $('#scene').dispatchEvent(ev); return ev; };
export const key = (k, opts = {}, target = document) => { const down = new window.KeyboardEvent('keydown', { key: k, code: opts.code || '', bubbles: true, cancelable: true, ...opts }); target.dispatchEvent(down); const up = new window.KeyboardEvent('keyup', { key: k, code: opts.code || '', bubbles: true, cancelable: true, ...opts }); target.dispatchEvent(up); return down; };
export const G = (name) => window.eval(name); // top-level const/let of the classic script live in the global lexical scope, not on window
export function report(label = '') { const errs = errors.slice(); console.log(`[${label}] errors=${errs.length}`); for (const e of errs.slice(0, 20)) console.log('  ' + e); }
process.on('uncaughtException', (e) => errors.push('uncaught: ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' | ')));
process.on('unhandledRejection', (e) => errors.push('unhandledRejection: ' + (e?.stack || e).toString().split('\n').slice(0, 4).join(' | ')));
