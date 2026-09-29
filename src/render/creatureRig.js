// =============================================================================
// CREATURE RIG — lightweight 2D puppet system
// -----------------------------------------------------------------------------
//   CreatureAssetLoader          bakes + caches every layer of a creature once
//   CreatureAnimationController  picks / blends / advances animation states
//   CreatureRig                  one creature: layers + live transforms
//   CreatureRenderer             drawMythling() — the public entry point
//
// Budget: 8-12 transforms per creature, ~1 drawImage per layer, zero per-frame
// allocation. Nothing here knows about species anatomy: the part list lives in
// creatureArt.js, so adding a species (or a new stage) needs no engine change.
// =============================================================================
import { getSpecies, getEvolutionStage } from '../data/species.js';
import { getMutation } from '../data/mutations.js';
import { pal, artFor, artContext, EXPRESSIONS, drawFace, ell, leaf } from './creatureArt.js';

// ------------------------------------------------------------------ easings
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeIn = (k) => k * k;
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2);
const easeOutCubic = (k) => 1 - (1 - k) ** 3;
const easeOutBack = (k) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
};
const pingPong = (k) => Math.sin(k * Math.PI);
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);

// =============================================================================
// ASSET LOADER — bakes each animated layer into a cached offscreen canvas.
// Keyed by species | stage | mutation | size bucket, so a battle reuses the
// same textures instead of re-drawing hundreds of paths every frame.
// =============================================================================
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

export class CreatureAssetLoader {
  constructor(limit = 32) {
    this.cache = new Map();
    this.limit = limit;
  }

  /** Pixels per creature-unit for a given on-screen size. */
  static ppuFor(size) {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const raw = (size / 100) * Math.min(2, dpr);
    return Math.max(1.25, Math.min(2.6, Math.round(raw * 2) / 2));
  }

  static sizeBucket(size) { return Math.max(24, Math.round(size / 12) * 12); }

  get(speciesId, stage, mutation, size) {
    const bucket = CreatureAssetLoader.sizeBucket(size);
    const key = `${speciesId}|${stage}|${mutation}|${bucket}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const set = this.bake(speciesId, stage, mutation, CreatureAssetLoader.ppuFor(bucket));
    if (!set) return null;
    this.cache.set(key, set);
    if (this.cache.size > this.limit) {
      // LRU: Map preserves insertion order — drop the oldest entry.
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    return set;
  }

  /** Renders every layer once into its own offscreen canvas. */
  bake(speciesId, stage, mutation, ppu) {
    const art = artFor(speciesId);
    if (!art) return null;
    const ex = artContext(speciesId, stage, EXPRESSIONS.neutral, {});
    const c = pal(speciesId, mutation);
    const r = art.skel(ex);
    const layers = [];
    for (const def of art.parts) {
      const [px, py, s = 1] = def.pivot(r);
      const [bx, by, bw, bh] = def.box || [0, 0, 1, 1];
      let tex = null;
      if (!def.liveOnly && def.draw) {
        const X = px + bx * s, Y = py + by * s;          // box origin, creature space
        const W = Math.max(1, Math.ceil(bw * s * ppu));
        const H = Math.max(1, Math.ceil(bh * s * ppu));
        tex = makeCanvas(W, H);
        const cx = tex.getContext('2d');
        cx.setTransform(ppu, 0, 0, ppu, -X * ppu, -Y * ppu);
        cx.save();
        if (def.space === 'local') {
          cx.translate(px, py);
          if (s !== 1) cx.scale(s, s);
        }
        cx.save();
        def.draw(cx, c, ex, r);
        cx.restore();
        cx.restore();
      }
      layers.push({ def, tex, px, py, s, bx, by, bw, bh });
    }
    layers.sort((a, b) => a.def.z - b.def.z);
    return { speciesId, stage, mutation, ppu, layers, c, r, ex, art };
  }

  clear() { this.cache.clear(); }
}

export const creatureAssets = new CreatureAssetLoader();

// =============================================================================
// ANIMATION CONTROLLER
// -----------------------------------------------------------------------------
// Every state is a small procedural function of time: no keyframe tables, no
// hundreds of poses. Each writes into transform objects that were allocated
// once per rig, so a frame costs no garbage.
// =============================================================================
export const ANIMATIONS = {
  idle:          { loop: 0 },
  battleIdle:    { loop: 0 },
  walk:          { loop: 0.62 },
  run:           { loop: 0.44 },
  normalAttack:  { dur: 0.55 },
  specialAttack: { dur: 0.85 },
  buff:          { dur: 0.9 },
  ultimate:      { dur: 1.5 },
  hit:           { dur: 0.42 },
  faint:         { dur: 1.0 },
  capture:       { dur: 0.8 },
  evolve:        { dur: 1.2 },
};
export const ANIM_IDS = Object.keys(ANIMATIONS);

function tf(o, dx, dy, rot, sx, sy) {
  o.dx = dx; o.dy = dy; o.rot = rot; o.sx = sx; o.sy = sy;
  return o;
}
function newTf() { return { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 }; }

/** Occasional personality pulse: 0 most of the time, a quick bump every ~5s. */
function personality(t, seed) {
  const period = 5.2 + (seed % 1) * 2.6;
  const local = (t + seed * 3.7) % period;
  if (local > 0.58) return 0;
  return Math.sin((local / 0.58) * Math.PI);
}

/** Occasional blink, 0..1. */
function blinkAt(t, seed) {
  const period = 4.2 + (seed % 1) * 3.1;
  const local = (t + seed * 5.1) % period;
  if (local > 0.17) return 0;
  return Math.sin((local / 0.17) * Math.PI);
}

export class CreatureAnimationController {
  /**
   * @param {object} tfMap  name -> transform object (mutated in place)
   */
  constructor(tfMap, root) {
    this.tf = tfMap;                 // { tail:{...}, head:{...}, ... }
    this.root = root;
    this.state = 'idle';
    this.time = 0;                   // continuous clock (looping states)
    this.phase = 0;                  // 0..1 for one-shot states
    this.seed = Math.random() * 10;
    this.speed = 1;
    this.blink = 0;
    this.next = null;                // auto-return state
  }

  /** @param {string} name  @param {object} [o] { loop, speed } */
  play(name, o = {}) {
    if (!ANIMATIONS[name]) name = 'idle';
    if (this.state !== name) {
      this.state = name;
      this.phase = 0;
      if (!ANIMATIONS[name].loop) this.time = 0;
    }
    this.speed = o.speed ?? 1;
    this.loop = !!o.loop;
    this.next = o.next || null;
    return this;
  }

  update(dt) {
    const def = ANIMATIONS[this.state] || ANIMATIONS.idle;
    this.time += dt * this.speed;
    if (def.loop) {
      this.phase = ((this.time / def.loop) % 1 + 1) % 1;
    } else {
      this.phase += (dt * this.speed) / (def.dur || 1);
      if (this.phase >= 1) {
        if (this.loop) { this.phase = this.phase % 1; }
        else {
          this.phase = 1;
          if (this.next) { this.state = this.next; this.phase = 0; this.next = null; }
        }
      }
    }
    this.blink = blinkAt(this.time, this.seed);
  }

  /** Writes this frame's transforms into the rig's transform objects. */
  apply(rig, t) {
    if (t === undefined || t === null) t = this.time;
    const T = rig.tf;
    const root = rig.root;
    for (const k in T) tf(T[k], 0, 0, 0, 1, 1);
    tf(root, 0, 0, 0, 1, 1);
    const seed = this.seed;
    const clock = this.state === 'idle' || this.state === 'battleIdle' || this.state === 'walk'
      || this.state === 'run' ? t * this.speed : this.time;

    switch (this.state) {
      case 'walk': case 'run': this._locomote(T, root, clock, this.state === 'run'); break;
      case 'battleIdle': this._battleIdle(T, root, clock, seed); break;
      case 'normalAttack': this._attack(T, root, this.phase, seed, 1); break;
      case 'specialAttack': this._attack(T, root, this.phase, seed, 1.5); break;
      case 'buff': this._buff(T, root, this.phase, seed); break;
      case 'ultimate': this._ultimate(T, root, this.phase, seed); break;
      case 'hit': this._hit(T, root, this.phase); break;
      case 'faint': this._faint(T, root, this.phase); break;
      case 'capture': this._capture(T, root, this.phase); break;
      case 'evolve': this._evolve(T, root, this.phase, clock, seed); break;
      default: this._idle(T, root, clock, seed); break;
    }
    rig.blink = this.blink;
  }

  // ---------------------------------------------------------------- states
  _idle(T, root, t, seed) {
    const br = Math.sin(t * 1.9 + seed);            // breathing
    const sw = Math.sin(t * 1.25 + seed * 1.7);     // slow sway
    const fl = Math.sin(t * 0.7 + seed * 2.3);      // slow drift
    const per = personality(t, seed);               // rare ear flick / head tilt
    tf(root, 0, br * 0.6, 0, 1 + br * 0.012, 1 - br * 0.014);
    if (T.body) tf(T.body, 0, br * 0.5, sw * 0.012, 1 + br * 0.018, 1 - br * 0.02);
    if (T.head) tf(T.head, sw * 0.7, -br * 1.2 - per * 0.9, sw * 0.04 - per * 0.14, 1, 1);
    if (T.tail) tf(T.tail, 0, 0, sw * 0.13 + fl * 0.07 + per * 0.12, 1, 1);
    if (T.mane) tf(T.mane, 0, 0, sw * 0.05, 1 + br * 0.01, 1);
    if (T.earL) tf(T.earL, 0, 0, sw * 0.07 + fl * 0.05 - per * 0.4, 1, 1);
    if (T.earR) tf(T.earR, 0, 0, -sw * 0.06 - fl * 0.06 - per * 0.34, 1, 1);
    if (T.wingL) tf(T.wingL, 0, 0, -0.05 + br * 0.05, 1, 1);
    if (T.wingR) tf(T.wingR, 0, 0, 0.05 - br * 0.06, 1, 1);
    for (const k of ['legFL', 'legFR', 'legBL', 'legBR']) {
      if (T[k]) tf(T[k], 0, br * 0.25, 0, 1, 1);
    }
  }

  _battleIdle(T, root, t, seed) {
    const br = Math.sin(t * 2.6 + seed);
    const bounce = Math.abs(Math.sin(t * 2.0 + seed));
    tf(root, 0, -bounce * 1.1 + br * 0.4, 0, 1 + br * 0.014, 1 - br * 0.018);
    if (T.body) tf(T.body, 0, br * 0.5, 0, 1 + br * 0.02, 1 - br * 0.022);
    if (T.head) tf(T.head, br * 0.5, -br * 1.1, br * 0.05, 1, 1);
    if (T.tail) tf(T.tail, 0, 0, Math.sin(t * 2.2 + seed) * 0.2, 1, 1);
    if (T.mane) tf(T.mane, 0, 0, Math.sin(t * 1.6 + seed) * 0.06, 1, 1);
    if (T.earL) tf(T.earL, 0, 0, Math.sin(t * 2.6 + seed) * 0.13, 1, 1);
    if (T.earR) tf(T.earR, 0, 0, -Math.sin(t * 2.4 + seed * 1.3) * 0.11, 1, 1);
    if (T.wingL) tf(T.wingL, 0, 0, -0.08 + Math.sin(t * 3.4 + seed) * 0.1, 1, 1);
    if (T.wingR) tf(T.wingR, 0, 0, 0.08 - Math.sin(t * 3.4 + seed) * 0.12, 1, 1);
    for (const k of ['legFL', 'legFR', 'legBL', 'legBR']) {
      if (T[k]) tf(T[k], 0, -bounce * 0.3, 0, 1, 1);
    }
  }

  _locomote(T, root, t, run) {
    const loop = run ? 0.44 : 0.62;
    const p = (t / loop) * Math.PI * 2;
    const amp = run ? 0.85 : 0.52;
    const s1 = Math.sin(p), s2 = Math.sin(p + Math.PI);
    const lift = (v) => -Math.max(0, v) * (run ? 3.2 : 1.7);
    // diagonal gait: front-left pairs with back-right
    if (T.legFL) tf(T.legFL, 0, lift(s1), s1 * amp, 1, 1);
    if (T.legFR) tf(T.legFR, 0, lift(s2), s2 * amp, 1, 1);
    if (T.legBL) tf(T.legBL, 0, lift(s2), s2 * amp * 0.92, 1, 1);
    if (T.legBR) tf(T.legBR, 0, lift(s1), s1 * amp * 0.92, 1, 1);
    const bob = Math.abs(Math.sin(p));
    tf(root, 0, -bob * (run ? 2.6 : 1.4), run ? 0.09 : 0.03, 1, 1);
    if (T.body) tf(T.body, 0, 0, s1 * 0.03, 1 + bob * 0.01, 1 - bob * 0.025);
    if (T.head) tf(T.head, -s1 * (run ? 1.4 : 0.9), bob * 0.7, s1 * 0.05, 1, 1);
    if (T.tail) tf(T.tail, 0, 0, Math.sin(p - 0.7) * (run ? 0.34 : 0.22) + (run ? 0.15 : 0), 1, 1);
    if (T.mane) tf(T.mane, 0, 0, Math.sin(p - 0.5) * 0.09, 1, 1);
    if (T.earL) tf(T.earL, 0, 0, s1 * 0.12 - (run ? 0.25 : 0), 1, 1);
    if (T.earR) tf(T.earR, 0, 0, -s1 * 0.1 - (run ? 0.22 : 0), 1, 1);
    if (T.wingL) tf(T.wingL, 0, 0, -0.1 + s1 * 0.16, 1, 1);
    if (T.wingR) tf(T.wingR, 0, 0, 0.1 - s1 * 0.18, 1, 1);
  }

  // anticipation -> strike -> recovery, with a touch of squash & stretch
  _attack(T, root, ph, seed, power) {
    const A = 0.32, S = 0.46;            // strike starts / ends (normalised)
    let dx = 0, lean = 0, headRot = 0, sq = 1;
    if (ph < A) {                        // anticipation: pull back and coil
      const k = easeOut(ph / A);
      dx = -7 * power * k; lean = -0.05 * k * power;
      headRot = 0.14 * k; sq = 1 - 0.06 * k;
    } else if (ph < S) {                 // strike: fast lunge forward
      const k = easeOutCubic((ph - A) / (S - A));
      dx = (-7 * power) + (23 * power) * k;
      lean = (-0.05 + 0.16) * k * power;
      headRot = 0.14 - 0.36 * k; sq = 1 - 0.06 + 0.16 * Math.sin(k * Math.PI);
    } else {                             // recovery: settle back with a small overshoot
      const k = easeOutBack((ph - S) / (1 - S));
      dx = (16 * power) * (1 - k);
      lean = 0.11 * (1 - k);
      headRot = -0.22 + 0.22 * k; sq = 1 + 0.1 * (1 - k);
    }
    tf(root, dx, 0, lean, 2 - sq, sq);
    if (T.body) tf(T.body, 0, 0, lean * 0.4, 2 - sq, sq);
    if (T.head) tf(T.head, dx * 0.14, -Math.abs(dx) * 0.05, headRot, 1, 1);
    if (T.tail) tf(T.tail, 0, 0, -0.2 * power * (ph < S ? ph / S : 1 - (ph - S) / (1 - S)), 1, 1);
    if (T.earL) tf(T.earL, 0, 0, -0.3 * (ph < S ? 1 : 1 - (ph - S) / (1 - S)), 1, 1);
    if (T.earR) tf(T.earR, 0, 0, -0.32 * (ph < S ? 1 : 1 - (ph - S) / (1 - S)), 1, 1);
    if (T.wingL) tf(T.wingL, 0, 0, -0.1 - 0.3 * pingPong(clamp01(ph / 0.7)), 1, 1);
    if (T.wingR) tf(T.wingR, 0, 0, 0.1 + 0.34 * pingPong(clamp01(ph / 0.7)), 1, 1);
    if (T.legFL) tf(T.legFL, 0, 0, -0.5 * Math.sin(clamp01(ph / S) * Math.PI) * power, 1, 1);
    if (T.legFR) tf(T.legFR, 0, 0, -0.35 * Math.sin(clamp01(ph / S) * Math.PI) * power, 1, 1);
  }

  _buff(T, root, ph, seed) {
    const rise = ph < 0.55 ? easeOutBack(ph / 0.55) : 1;
    const settle = ph > 0.8 ? (ph - 0.8) / 0.2 : 0;
    const lvl = rise * (1 - settle);
    tf(root, 0, -9 * lvl, 0, 1 + 0.03 * lvl, 1 + 0.04 * lvl);
    if (T.body) tf(T.body, 0, 0, 0, 1 + 0.04 * lvl, 1 + 0.03 * lvl);
    if (T.head) tf(T.head, 0, -3 * lvl, -0.2 * lvl, 1, 1);
    if (T.tail) tf(T.tail, 0, 0, 0.3 * lvl, 1, 1);
    if (T.mane) tf(T.mane, 0, 0, 0.12 * lvl, 1 + 0.05 * lvl, 1 + 0.05 * lvl);
    if (T.earL) tf(T.earL, 0, 0, 0.35 * lvl, 1, 1);
    if (T.earR) tf(T.earR, 0, 0, 0.3 * lvl, 1, 1);
    if (T.wingL) tf(T.wingL, 0, 0, -0.34 * lvl, 1, 1);
    if (T.wingR) tf(T.wingR, 0, 0, 0.38 * lvl, 1, 1);
    for (const k of ['legFL', 'legFR', 'legBL', 'legBR']) if (T[k]) tf(T[k], 0, -1.5 * lvl, 0, 1, 1);
  }

  _ultimate(T, root, ph, seed) {
    // charge -> rise & pose -> hold (the VFX layer adds the elemental charge)
    let crouch = 0, rise = 0, spread = 0;
    if (ph < 0.3) crouch = easeInOut(ph / 0.3);
    else if (ph < 0.55) { crouch = 1 - easeOutBack((ph - 0.3) / 0.25); rise = easeOutBack((ph - 0.3) / 0.25); }
    else { rise = 1; spread = 1; }
    const pulse = Math.sin(ph * Math.PI * 6) * 0.04 * spread;
    tf(root, 0, 5 * crouch - 11 * rise, 0.06 * crouch - 0.05 * rise,
      1 + 0.09 * crouch - 0.05 * rise + pulse, 1 - 0.1 * crouch + 0.07 * rise - pulse);
    if (T.body) tf(T.body, 0, 0, -0.05 * spread, 1 + 0.05 * crouch, 1 + 0.04 * rise);
    if (T.head) tf(T.head, 0, 2 * crouch - 4 * rise, 0.16 * crouch - 0.28 * rise, 1, 1);
    if (T.tail) tf(T.tail, 0, 0, -0.35 * crouch + 0.45 * spread, 1, 1);
    if (T.mane) tf(T.mane, 0, 0, 0.18 * spread, 1 + 0.1 * spread, 1 + 0.1 * spread);
    if (T.earL) tf(T.earL, 0, 0, -0.4 * crouch + 0.45 * spread, 1, 1);
    if (T.earR) tf(T.earR, 0, 0, -0.36 * crouch + 0.4 * spread, 1, 1);
    if (T.wingL) tf(T.wingL, 0, 0, -0.1 - 0.55 * spread + 0.1 * crouch, 1, 1);
    if (T.wingR) tf(T.wingR, 0, 0, 0.1 + 0.62 * spread - 0.1 * crouch, 1, 1);
    for (const k of ['legFL', 'legFR', 'legBL', 'legBR']) if (T[k]) tf(T[k], 0, -2 * spread, 0, 1, 1);
  }

  _hit(T, root, ph) {
    const d = (1 - ph) ** 2;                 // fast recoil that eases out
    tf(root, -9 * d, 0, -0.05 * d, 1, 1);
    if (T.body) tf(T.body, 0, 0, -0.06 * d, 1 + 0.13 * d, 1 - 0.13 * d);
    if (T.head) tf(T.head, -3.5 * d, 1.5 * d, 0.2 * d, 1, 1);
    if (T.tail) tf(T.tail, 0, 0, -0.35 * d, 1, 1);
    if (T.mane) tf(T.mane, 0, 0, -0.2 * d, 1, 1);
    if (T.earL) tf(T.earL, 0, 0, -0.45 * d, 1, 1);
    if (T.earR) tf(T.earR, 0, 0, -0.4 * d, 1, 1);
    if (T.wingL) tf(T.wingL, 0, 0, 0.2 * d, 1, 1);
    if (T.wingR) tf(T.wingR, 0, 0, -0.22 * d, 1, 1);
  }

  _faint(T, root, ph) {
    const e = easeInOut(clamp01(ph));
    tf(root, 0, 9 * e, 0.16 * e, 1 + 0.04 * e, 1 - 0.1 * e);
    if (T.body) tf(T.body, 0, 2 * e, 0.1 * e, 1, 1 - 0.12 * e);
    if (T.head) tf(T.head, -2 * e, 11 * e, 0.5 * e, 1, 1);
    if (T.tail) tf(T.tail, 0, 4 * e, -0.55 * e, 1, 1);
    if (T.mane) tf(T.mane, 0, 2 * e, -0.2 * e, 1, 1 - 0.1 * e);
    if (T.earL) tf(T.earL, 0, 0, -0.7 * e, 1, 1);
    if (T.earR) tf(T.earR, 0, 0, -0.65 * e, 1, 1);
    if (T.wingL) tf(T.wingL, 0, 3 * e, 0.4 * e, 1, 1);
    if (T.wingR) tf(T.wingR, 0, 3 * e, -0.45 * e, 1, 1);
    if (T.legFL) tf(T.legFL, 0, 0, -0.45 * e, 1, 1);
    if (T.legFR) tf(T.legFR, 0, 0, 0.5 * e, 1, 1);
    if (T.legBL) tf(T.legBL, 0, 0, -0.3 * e, 1, 1);
    if (T.legBR) tf(T.legBR, 0, 0, 0.35 * e, 1, 1);
  }

  _capture(T, root, ph) {
    const e = easeIn(clamp01(ph));
    tf(root, 0, -4 * e, e * Math.PI * 3, 1 - 0.85 * e, 1 - 0.85 * e);
    if (T.body) tf(T.body, 0, 0, 0, 1 - 0.1 * e, 1 - 0.1 * e);
    if (T.head) tf(T.head, 0, 0, -0.3 * e, 1, 1);
    if (T.tail) tf(T.tail, 0, 0, 0.4 * e, 1, 1);
    for (const k of ['legFL', 'legFR', 'legBL', 'legBR']) if (T[k]) tf(T[k], 0, 0, 0.4 * e, 1, 1);
  }

  _evolve(T, root, ph, t, seed) {
    const e = pingPong(clamp01(ph));
    tf(root, 0, -7 * e, 0, 1 + 0.11 * e, 1 + 0.13 * e);
    if (T.body) tf(T.body, 0, 0, 0, 1 + 0.06 * e, 1 + 0.06 * e);
    if (T.head) tf(T.head, 0, -2 * e, -0.18 * e, 1, 1);
    if (T.tail) tf(T.tail, 0, 0, 0.35 * e, 1, 1);
    if (T.mane) tf(T.mane, 0, 0, 0.2 * e, 1 + 0.12 * e, 1 + 0.12 * e);
    if (T.earL) tf(T.earL, 0, 0, 0.4 * e, 1, 1);
    if (T.earR) tf(T.earR, 0, 0, 0.36 * e, 1, 1);
    if (T.wingL) tf(T.wingL, 0, 0, -0.5 * e, 1, 1);
    if (T.wingR) tf(T.wingR, 0, 0, 0.55 * e, 1, 1);
  }
}

// =============================================================================
// RIG — one creature instance: cached layers + live transform objects
// =============================================================================
export class CreatureRig {
  constructor({ speciesId, species, stage = 0, mutation = 'none', size = 100 }) {
    this.speciesId = speciesId || species;
    this.stage = stage;
    this.mutation = mutation;
    this.size = size;
    this.set = creatureAssets.get(this.speciesId, stage, mutation, size);
    const art = artFor(this.speciesId);
    this.tf = {};
    this.root = newTf();
    this.blink = 0;
    if (art) {
      for (const p of art.parts) this.tf[p.name] = newTf();
    }
    this.anim = new CreatureAnimationController(this.tf, this.root);
  }

  play(name, opts) { this.anim.play(name, opts); return this; }
  update(dt, t) { this.anim.update(dt); this.anim.apply(this, t ?? this.anim.time); }
  get state() { return this.anim.state; }
}

// rigs are pooled per (species|stage|mutation|size bucket) so the common case
// (two creatures redrawn 60x a second) never allocates.
const rigPool = new Map();

function sharedRig(speciesId, stage, mutation, size, key) {
  let rig = rigPool.get(key);
  if (!rig) {
    rig = new CreatureRig({ speciesId, stage, mutation, size });
    rigPool.set(key, rig);
    if (rigPool.size > 24) {
      const oldest = rigPool.keys().next().value;
      rigPool.delete(oldest);
    }
  }
  return rig;
}

/**
 * Shared rigs are stateless renderers: they are advanced once per frame by
 * whoever draws them. `owner` lets one rig be bound to one on-screen actor
 * (each battle side keeps its own animation state via `animTag`).
 */
function acquireRig(speciesId, stage, mutation, size, animTag) {
  const key = `${speciesId}|${stage}|${mutation}|${CreatureAssetLoader.sizeBucket(size)}|${animTag || ''}`;
  return sharedRig(speciesId, stage, mutation, size, key);
}

// =============================================================================
// RENDERER
// =============================================================================
/** A few ambient motes in creature space — element identity, ~5 shapes max. */
function drawAmbient(ctx, c, speciesId, t, r, excite) {
  const el = getSpecies(speciesId)?.element || 'nature';
  const n = el === 'fire' ? 4 : 3;
  ctx.save();
  if (el === 'rock') {                            // drifting grit + a slow-orbiting pebble
    ctx.globalAlpha *= 0.55;
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.5 + i * 0.25) % 1;
      ell(ctx, (r.hipX ?? -10) - 30 - p * 10 + Math.sin(t * 1.5 + i) * 4, (r.bodyY ?? -34) - 14 + p * 22, 1.6, 1.4, i % 2 ? c.accent : c.belly);
    }
    const a = t * 1.2;
    ell(ctx, (r.hipX ?? -10) - 22 + Math.cos(a) * 14, (r.bodyY ?? -34) - 28 + Math.sin(a) * 4, 2.6, 2.2, c.secondary);
  } else if (el === 'nature') {
    ctx.globalAlpha *= 0.5;
    for (let i = 0; i < n; i++) {
      const p = (t * 0.6 + i * 0.33) % 1;
      leaf(ctx, -34 - p * 14, (r.bodyY ?? -34) - 22 + Math.sin(t * 2 + i) * 6 + p * 12, 6, 2.2, p * 5, c.accent, null, 0);
    }
  } else if (el === 'water') {
    ctx.globalAlpha *= 0.55;
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.9 + i * 0.25) % 1;
      ell(ctx, (r.hipX ?? -10) - 34 - p * 16, (r.bodyY ?? -34) - 20 - p * 14 + Math.sin(t * 3 + i) * 3, 2.2 - p, 2.9 - p, c.accent);
    }
    ctx.save();                                  // splash ring under the paws
    ctx.globalAlpha *= 0.28;
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse((r.shoX ?? 8) + 5, 0, 13 + Math.sin(t * 3) * 2, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const p = (t * (0.8 + excite * 0.6) + i * 0.27) % 1;
      ctx.globalAlpha = (1 - p) * 0.7;
      ell(ctx, (r.hipX ?? -10) - 16 + Math.sin(t * 3 + i * 2) * 5, (r.bodyY ?? -34) - 8 - p * 36, 2 - p, 2 - p, '#ffb347');
    }
  }
  ctx.restore();
}

/**
 * Draw a Mythling (public entry point — every game system calls this).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o  speciesId, stage, mutation, x, y, size, t, facing, shadow,
 *                    pose:{ bob, lean, squash, alpha, tilt, expression, excite,
 *                           anim, animPhase, flash }
 */
export function drawMythling(ctx, o) {
  const {
    speciesId, stage = 0, mutation = 'none', x, y, size = 100, t = 0,
    facing = 1, pose = {}, shadow = true,
  } = o;
  const sp = getSpecies(speciesId);
  if (!sp) return;
  const evo = getEvolutionStage(speciesId, stage);
  const rig = acquireRig(speciesId, stage, mutation, size, o.animTag);
  if (!rig || !rig.set) return;
  const set = rig.set;

  const s = (size / 100) * (evo.art?.scale || 1);
  const bob = pose.bob ?? 0;
  const lean = pose.lean || 0;
  const squash = pose.squash ?? 1;
  const alpha = pose.alpha ?? 1;
  const tilt = pose.tilt || 0;
  const excite = pose.excite ?? 0;
  const flash = pose.flash ?? 0;
  const expression = EXPRESSIONS[pose.expression] || EXPRESSIONS.neutral;

  // animation state -------------------------------------------------------
  const animReq = pose.anim ?? o.anim ?? null;
  let state = 'idle', phase = 0;
  if (typeof animReq === 'string') state = animReq;
  else if (animReq && typeof animReq === 'object') { state = animReq.name || 'idle'; phase = animReq.phase ?? 0; }
  if (!ANIMATIONS[state]) state = 'idle';
  const def = ANIMATIONS[state];
  if (def.loop) {
    rig.anim.state = state;
    rig.anim.time = t;                            // continuous: driven by the caller's clock
    rig.anim.phase = ((t / def.loop) % 1 + 1) % 1;
  } else {
    if (rig.anim.state !== state) { rig.anim.state = state; }
    rig.anim.phase = clamp01(phase);
    rig.anim.time = t;                            // keeps blinking during one-shots
  }
  rig.anim.speed = pose.animSpeed ?? 1;
  rig.anim.apply(rig, t);
  const liveT = t;

  const c = set.c, r = set.r, ex = set.ex;
  const pal2 = c;
  ctx.save();
  ctx.globalAlpha *= alpha;

  // ---- ground shadow
  if (shadow) {
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * 0.3;
    // Same contract as drawHdModel: shadowX/shadowY pin the shadow to its own
    // spot so it does not travel with the body.
    const shx = o.shadowX ?? x, shy = (o.shadowY ?? y) + 3;
    const g = ctx.createRadialGradient(shx, shy, 2, shx, shy, 36 * s);
    g.addColorStop(0, 'rgba(6,16,10,0.75)');
    g.addColorStop(1, 'rgba(6,16,10,0)');
    ell(ctx, shx, shy, 34 * s, 9 * s, g);
    ctx.restore();
  }

  // ---- mutation aura behind the body
  const mut = getMutation(mutation);
  if (mut.aura) {
    const g = ctx.createRadialGradient(x, y - 36 * s, 4 * s, x, y - 36 * s, 64 * s);
    g.addColorStop(0, mut.aura.color.replace(/[\d.]+\)$/, '0.32)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y - 36 * s, 64 * s, 0, Math.PI * 2); ctx.fill();
  }

  const root = rig.root;
  ctx.translate(x + (lean + root.dx) * facing, y + bob + root.dy * s);
  ctx.rotate(tilt + root.rot * facing);
  ctx.scale(facing * s * squash * root.sx, s * squash * root.sy);

  // ---- layers
  const paint = () => {
    for (const L of set.layers) {
      const d = L.def;
      const T = rig.tf[d.name];
      ctx.save();
      ctx.translate(L.px, L.py);
      if (T && (T.dx || T.dy || T.rot || T.sx !== 1 || T.sy !== 1)) {
        ctx.translate(T.dx, T.dy);
        ctx.rotate(T.rot);
        ctx.scale(T.sx, T.sy);
      }
      if (d.space === 'local' && L.s !== 1) ctx.scale(L.s, L.s);
      if (L.tex) ctx.drawImage(L.tex, L.bx, L.by, L.bw, L.bh);
      else if (d.draw) {                       // live-only layer (e.g. Rivruff's mane)
        ctx.save();
        if (d.space !== 'local') ctx.translate(-L.px, -L.py);
        d.draw(ctx, c, exWith(ex, expression, excite), r, liveT, T);
        ctx.restore();
      }
      if (d.live) {
        ctx.save();
        if (d.space !== 'local') ctx.translate(-L.px, -L.py);
        d.live(ctx, c, exWith(ex, expression, excite), r, liveT, T);
        ctx.restore();
      }
      if (d.name === 'head' && set.art.face) {          // face stays live (blinks, expressions)
        ctx.save();
        drawFace(ctx, c, expression, set.art.face, rig.blink);
        ctx.restore();
      }
      ctx.restore();
    }
  };
  paint();

  // ---- hit flash: additive re-composite (no extra textures)
  if (flash > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = ctx.globalAlpha * Math.min(0.85, flash * 0.55);
    paint();
    ctx.restore();
  }

  // ---- ambient element motes
  drawAmbient(ctx, pal2, speciesId, liveT, r, excite);

  // ---- mutation motes
  if (mut.aura) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = liveT * 1.4 + (i / n) * Math.PI * 2;
      const rx = Math.cos(a) * 42, ry = Math.sin(a * 1.3) * 28 - 36;
      ctx.globalAlpha = alpha * (0.3 + 0.4 * Math.sin(liveT * 3 + i));
      if (mutation === 'shiny') {
        ctx.fillStyle = mut.aura.color;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 3); ctx.lineTo(rx + 1.2, ry); ctx.lineTo(rx, ry + 3); ctx.lineTo(rx - 1.2, ry);
        ctx.closePath(); ctx.fill();
      } else {
        ell(ctx, rx, ry, 3.2, 3.2, mut.aura.color);
      }
    }
    ctx.globalAlpha = alpha;
  }

  ctx.restore();
}

const _exScratch = {};
function exWith(ex, face, excite) {
  _exScratch.horns = ex.horns; _exScratch.wings = ex.wings;
  _exScratch.stage = ex.stage; _exScratch.grow = ex.grow;
  _exScratch.face = face; _exScratch.excite = excite; _exScratch.action = ex.action;
  return _exScratch;
}

/** Warms the texture cache so the first frame of a scene never hitches. */
export function prewarm(speciesIds, stages = [0, 1, 2], size = 160) {
  for (const id of speciesIds) for (const st of stages) creatureAssets.get(id, st, 'none', size);
}
