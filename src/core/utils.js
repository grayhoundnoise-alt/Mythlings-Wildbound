export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
export function choice(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export function weightedChoice(rng, entries, weightKey = 'weight') {
  const total = entries.reduce((s, e) => s + (e[weightKey] || 1), 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= (e[weightKey] || 1);
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}

/** Deterministic seeded PRNG (mulberry32). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = Math.random;

let uidCounter = 0;
export function uid(prefix = 'm') {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function rectContains(r, x, y) {
  return x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Simple event bus used to decouple systems from the UI. */
export class EventBus {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) { const s = this.map.get(evt); if (s) s.delete(fn); }
  emit(evt, payload) {
    const s = this.map.get(evt);
    if (s) for (const fn of [...s]) { try { fn(payload); } catch (e) { console.error(e); } }
  }
}

export function shadeColor(hex, amount) {
  const c = hex.replace('#', '');
  const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  r = clamp(Math.round(r + amount * 255), 0, 255);
  g = clamp(Math.round(g + amount * 255), 0, 255);
  b = clamp(Math.round(b + amount * 255), 0, 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function hexToRgb(hex) {
  const c = hex.replace('#', '');
  const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r, g, b) {
  return `#${((1 << 24) + (clamp(Math.round(r),0,255) << 16) + (clamp(Math.round(g),0,255) << 8) + clamp(Math.round(b),0,255)).toString(16).slice(1)}`;
}

/** Shift hue/saturation/lightness of a hex color — used by mutation palettes. */
export function adjustColor(hex, { hueShift = 0, saturate = 1, lighten = 1 } = {}) {
  const { r, g, b } = hexToRgb(hex);
  let [h, s, l] = rgbToHsl(r, g, b);
  h = (h + hueShift / 360 + 1) % 1;
  s = clamp(s * saturate, 0, 1);
  l = clamp(l * lighten, 0, 1);
  const [nr, ng, nb] = hslToRgb(h, s, l);
  return rgbToHex(nr, ng, nb);
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}
