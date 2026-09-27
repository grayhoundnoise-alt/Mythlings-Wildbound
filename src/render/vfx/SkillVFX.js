// =============================================================================
// SKILL VFX MANAGER
// -----------------------------------------------------------------------------
// Every damaging skill plays the same six beats:
//
//   CAST (anticipation) -> ATTACK MOTION -> PROJECTILE -> IMPACT -> AFTERMATH
//                                                              -> DAMAGE NUMBER
//
// The battle scene drives the beats: `cast` starts the sequence, `damage`
// resolves it (a projectile still in flight is snapped home so the hit always
// lines up with the number). Effects are data-driven from src/data/skillVfx.js.
//
// Performance rules this file obeys:
//   * pooled particles, hard cap, nothing allocated inside update/render
//   * gradients cached by colour + radius
//   * no DOM elements (the scene owns the floating numbers)
//   * camera shake is requested through the scene, never applied blindly
// =============================================================================
import { ParticleSystem } from './particles.js';
import { vfxFor, paletteFor, BUFF_VFX } from '../../data/skillVfx.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

/** Impact recipes: counts only — the palette comes from the element. */
const IMPACT = {
  slash:      { sparks: 8,  slash: 2, dust: 3 },
  claw:       { sparks: 10, slash: 3, dust: 3 },
  bite:       { sparks: 8,  slash: 1, dust: 4, flash: 22 },
  peck:       { sparks: 7,  slash: 1, dust: 2, feathers: 4 },
  burst:      { ring: 1, sparks: 16, flash: 42 },
  splash:     { ring: 2, drops: 18, foam: 6, mist: 3 },
  pierce:     { ring: 1, drops: 14, sparks: 10, flash: 30 },
  thorns:     { ring: 1, shards: 14, leaves: 6, dust: 4 },
  leafBurst:  { ring: 1, leaves: 16, petals: 8, pollen: 8 },
  bloom:      { ring: 2, petals: 22, leaves: 10, pollen: 12, flash: 30 },
  burn:       { ring: 1, embers: 18, flame: 5, smoke: 4, flash: 34 },
  inferno:    { ring: 2, embers: 26, flame: 8, smoke: 6, flash: 56 },
  whirlpool:  { ring: 3, drops: 20, mist: 6, foam: 8 },
  pressure:   { ring: 2, drops: 22, column: 1, mist: 5 },
  cyclone:    { ring: 2, leaves: 20, wind: 8 },
  slashWind:  { slash: 3, wind: 8, sparks: 6, dust: 3 },
  vineWhip:   { ring: 1, leaves: 12, dust: 5, sparks: 6 },
  // ---- ultimates
  verdantCrush: { ring: 3, shock: 2, leaves: 26, dust: 14, debris: 10, flash: 70, rune: 1 },
  tidalBurst:   { ring: 3, shock: 2, drops: 30, foam: 14, mist: 8, column: 1, flash: 70 },
  fireBlast:    { ring: 3, shock: 1, embers: 34, flame: 12, smoke: 8, flash: 86 },
  leafStorm:    { ring: 2, leaves: 30, petals: 14, wind: 10, pollen: 10 },
  oceanGuard:   { ring: 2, drops: 14, bubbles: 14, mist: 6, dome: 1 },
};

export class SkillVFXManager {
  constructor() {
    this.ps = new ParticleSystem({ particles: 340, effects: 44 });
    this.projectiles = [];
    this.timers = [];
    this.time = 0;
    this.stage = null;          // { pos(side), shake(amt), flash(amt), float(...) }
    this.enabled = true;
    this.screen = { flash: 0, flashColor: '#ffffff', pulse: 0, px: 0, py: 0 };
    this._lastSkill = new Map(); // side -> { def, target }
  }

  // ------------------------------------------------------------ stage hookup
  /** Called by BattleScene: gives the VFX layer screen positions + feedback. */
  bind(stage) { this.stage = stage; return this; }
  unbind() { this.stage = null; }

  pos(side) {
    const p = this.stage?.pos ? this.stage.pos(side) : null;
    return p || { x: 0, y: 0 };
  }
  shake(amt) { if (this.stage?.shake && amt > 0) this.stage.shake(amt); }
  flash(amt, color = '#fff6d8') {
    if (this.stage?.flash && amt > 0) this.stage.flash(amt);
    if (amt > this.screen.flash) { this.screen.flash = Math.min(0.7, amt); this.screen.flashColor = color; }
  }

  // ------------------------------------------------------------ public API
  /**
   * Full sequence for a skill (used for previews / one-shot playback).
   * @param {object} o { skillId, side, target, element, category, crit, amount }
   */
  play(o = {}) {
    return this.playSkillVFX(o);
  }

  /** CAST beat + projectile launch. */
  playSkillVFX({ skillId, side = 'player', target, element, category, amount, crit, effectiveness, isUltimate } = {}) {
    if (!this.enabled || !this.stage) return null;
    const def = vfxFor(skillId, { element, category: isUltimate ? 'ultimate' : category });
    const to = target || (side === 'player' ? 'enemy' : 'player');
    this._lastSkill.set(side, { def, target: to, crit });
    this.playCastVFX(def, side, to);
    const castDur = def.cast?.dur ?? 0.16;
    this.after(castDur, () => {
      if (def.projectile) {
        this.playProjectileVFX(def, this.pos(side), this.pos(to), { side, target: to, crit, amount, effectiveness });
      }
    });
    return def;
  }

  /** Gathering energy at the caster. */
  playCastVFX(def, side, to) {
    const at = this.pos(side);
    const pal = paletteFor(def.element);
    const style = def.cast?.style || 'gather';
    const dir = Math.sign((this.pos(to).x - at.x) || 1);
    const cx = at.x + dir * 26, cy = at.y - 58;

    if (style === 'charge') {                       // ultimate: rune + rising aura
      this.ps.addEffect({ kind: 'rune', x: at.x, y: at.y - 4, r1: 62, w: 3, color: pal.glow, life: 0.9, additive: true });
      this.ps.addEffect({ kind: 'ring', x: at.x, y: at.y - 6, r0: 90, r1: 26, w: 4, color: pal.mid, life: 0.7 });
      for (let i = 0; i < 16; i++) {
        const a = rand(0, TAU), r = rand(30, 86);
        this.ps.spawn({
          x: at.x + Math.cos(a) * r, y: at.y - 10 + Math.sin(a) * r * 0.4,
          vx: -Math.cos(a) * 40, vy: -rand(60, 150), gravity: -30, drag: 0.6,
          size: rand(3, 7), sizeEnd: 0, life: rand(0.5, 0.9),
          shape: def.element === 'fire' ? 'spark' : def.element === 'water' ? 'bubble' : 'leaf',
          color: pal.core, color2: pal.deep, additive: def.element !== 'nature', rot: rand(0, TAU), rotSpeed: rand(-6, 6),
        });
      }
      this.flash(def.defensive ? 0.12 : 0.22, pal.core);
      return;
    }
    if (style === 'crouch' || style === 'none') {
      for (let i = 0; i < 5; i++) {
        this.ps.spawn({
          x: at.x + rand(-24, 24), y: at.y - 6, vx: rand(-40, 40), vy: -rand(10, 40),
          gravity: 120, size: rand(2, 4.5), life: rand(0.2, 0.4), shape: 'smoke',
          color: 'rgba(210,205,190,0.5)', additive: false,
        });
      }
      return;
    }
    if (style === 'bloom') {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + rand(-1.2, 1.2);
        this.ps.spawn({
          x: cx, y: cy, vx: Math.cos(a) * rand(20, 70), vy: Math.sin(a) * rand(20, 70),
          gravity: 30, drag: 1.2, size: rand(4, 8), life: rand(0.5, 0.9), shape: 'petal',
          color: i % 2 ? pal.core : pal.mid, rot: rand(0, TAU), rotSpeed: rand(-5, 5),
        });
      }
    }
    // default 'gather': a tight swirl of element motes drawn into the caster
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU), r = rand(34, 76);
      const sp = rand(70, 130);
      this.ps.spawn({
        x: at.x + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.7,
        vx: -Math.cos(a) * sp, vy: -Math.sin(a) * sp * 0.7,
        gravity: def.element === 'fire' ? -60 : 0, drag: 1.6,
        size: rand(2.5, 6), sizeEnd: 0, life: rand(0.26, 0.5),
        shape: def.element === 'fire' ? 'spark' : def.element === 'water' ? 'droplet' : 'leaf',
        color: i % 3 ? pal.mid : pal.core, color2: pal.deep,
        additive: def.element === 'fire', rot: rand(0, TAU), rotSpeed: rand(-8, 8),
      });
    }
    if (def.element === 'fire') {
      this.ps.addEffect({ kind: 'burst', x: cx, y: cy, r0: 6, r1: 30, color: pal.glow, life: 0.3, alpha: 0.5 });
    } else {
      this.ps.addEffect({ kind: 'ring', x: cx, y: cy, r0: 34, r1: 8, w: 2.5, color: pal.glow, life: 0.3, alpha: 0.7 });
    }
  }

  /** PROJECTILE beat: launch `def.projectile` from A to B. */
  playProjectileVFX(def, from, to, opts = {}) {
    const p = def.projectile;
    if (!p) return null;
    const pal = paletteFor(def.element);
    const dur = p.dur ?? 0.24;
    const proj = {
      style: p.style || 'orb', def, pal, from: { x: from.x, y: from.y - 58 }, to: { x: to.x, y: to.y - 58 },
      t: 0, dur, spin: p.spin || 0, big: !!p.big, tint: p.tint || def.element,
      side: opts.side, target: opts.target, crit: opts.crit, amount: opts.amount,
      effectiveness: opts.effectiveness, trail: p.trail || null, acc: 0, rot: 0, arrived: false,
      arc: p.style === 'wave' || p.style === 'orb' ? rand(60, 110) : rand(20, 60),
    };
    this.projectiles.push(proj);
    // launch kick
    this.launchPuff(proj);
    return proj;
  }

  /** IMPACT beat. */
  playImpactVFX(def, at, opts = {}) {
    const pal = paletteFor(def.element);
    const style = def.impact?.style || 'burst';
    const recipe = IMPACT[style] || IMPACT.burst;
    const k = (opts.scale ?? 1) * (opts.crit ? 1.35 : 1) * (def.category === 'ultimate' ? 1.6 : 1);
    const x = at.x, y = at.y - 56;
    this.emit(recipe, x, y, pal, k, def, opts);
    if (def.impact?.ring || recipe.ring) {
      this.ps.addEffect({ kind: 'ring', x, y, r0: 8, r1: (recipe.ring > 1 ? 120 : 78) * k, w: 4 * k, color: pal.glow, life: 0.42, alpha: 0.9 });
    }
    if (recipe.shock) {
      for (let i = 0; i < recipe.shock; i++) {
        this.ps.addEffect({ kind: 'shock', x: at.x, y: at.y - 4, r0: 10, r1: 260 * k, w: 6, color: pal.mid, life: 0.6 + i * 0.15, delay: i * 0.08, alpha: 0.8 });
      }
    }
    if (recipe.rune) this.ps.addEffect({ kind: 'rune', x: at.x, y: at.y - 2, r1: 120, w: 4, color: pal.glow, life: 0.9 });
    if (recipe.dome) this.ps.addEffect({ kind: 'dome', x, y: at.y - 52, r1: 96, w: 5, color: pal.core, life: 1.0, alpha: 0.9 });
    if (recipe.column) this.ps.addEffect({ kind: 'column', x: at.x, y: at.y - 2, r1: 54 * k, len: 250 * k, color: pal.mid, life: 0.5, alpha: 0.75, additive: false });
    if (recipe.flash) this.ps.addEffect({ kind: 'burst', x, y, r0: 10, r1: recipe.flash * k, color: pal.core, life: 0.26, alpha: 0.85 });
    // camera
    const shake = (def.impact?.shake ?? 6) * (opts.crit ? 1.3 : 1) * (def.category === 'ultimate' ? 1.25 : 1);
    this.shake(shake * (opts.scale ?? 1));
    if (def.impact?.flash) this.flash(def.impact.flash);
    else if (def.category === 'ultimate') this.flash(0.4, pal.core);
    else if (opts.crit) this.flash(0.22, pal.core);
    // aftermath
    const after = def.aftermath?.style;
    if (after) this.after(0.08, () => this.emitAftermath(after, x, y, pal, k, def));
  }

  /** Spawns the particle set for an impact recipe. */
  emit(r, x, y, pal, k, def, opts = {}) {
    const n = (v) => Math.max(1, Math.round((v || 0) * k));
    if (r.sparks) {
      for (let i = 0; i < n(r.sparks); i++) {
        const a = rand(0, TAU), sp = rand(120, 340) * k;
        this.ps.spawn({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, gravity: 520, drag: 1.4,
          size: rand(2, 4.5), sizeEnd: 0, life: rand(0.24, 0.5), shape: 'spark', stretch: 1.6,
          color: i % 3 ? pal.core : pal.mid, additive: true, rot: Math.atan2(Math.sin(a), Math.cos(a)),
        });
      }
    }
    if (r.embers) {
      for (let i = 0; i < n(r.embers); i++) {
        const a = rand(0, TAU), sp = rand(90, 300) * k;
        this.ps.spawn({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, gravity: -60, drag: 1.1,
          size: rand(2, 5.5), sizeEnd: 0, life: rand(0.4, 0.85), shape: 'spark', stretch: 1.4,
          color: i % 4 ? pal.mid : pal.core, additive: true, rot: rand(0, TAU), rotSpeed: rand(-8, 8),
        });
      }
    }
    if (r.flame) {
      for (let i = 0; i < n(r.flame); i++) {
        this.ps.spawn({
          x: x + rand(-24, 24), y: y + rand(-16, 16), vx: rand(-40, 40), vy: -rand(60, 170),
          gravity: -140, drag: 1.6, size: rand(10, 20) * k, sizeEnd: 2, life: rand(0.3, 0.55),
          shape: 'glow', color: i % 2 ? pal.mid : pal.glow, additive: true,
        });
      }
    }
    if (r.smoke) {
      for (let i = 0; i < n(r.smoke); i++) {
        this.ps.spawn({
          x: x + rand(-20, 20), y: y + rand(-10, 10), vx: rand(-30, 30), vy: -rand(30, 80),
          gravity: -20, drag: 1.2, size: rand(8, 16), sizeEnd: 22, life: rand(0.5, 0.9),
          shape: 'smoke', color: 'rgba(80,78,84,0.55)', additive: false,
        });
      }
    }
    if (r.drops) {
      for (let i = 0; i < n(r.drops); i++) {
        const a = -Math.PI / 2 + rand(-1.1, 1.1), sp = rand(120, 320) * k;
        this.ps.spawn({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gravity: 720, drag: 0.5,
          size: rand(2.5, 6), sizeEnd: 1, life: rand(0.3, 0.7), shape: 'droplet', stretch: 1.8,
          color: i % 4 ? pal.core : pal.mid, color2: pal.deep, additive: false, rot: a + Math.PI / 2,
        });
      }
    }
    if (r.foam) {
      for (let i = 0; i < n(r.foam); i++) {
        this.ps.spawn({
          x: x + rand(-30, 30), y: y + rand(-6, 14), vx: rand(-70, 70), vy: -rand(10, 60),
          gravity: 240, drag: 1.1, size: rand(3, 7), sizeEnd: 0, life: rand(0.3, 0.6),
          shape: 'bubble', color: '#ffffff', color2: pal.glow, additive: false,
        });
      }
    }
    if (r.bubbles) {
      for (let i = 0; i < n(r.bubbles); i++) {
        this.ps.spawn({
          x: x + rand(-40, 40), y: y + rand(10, 60), vx: rand(-20, 20), vy: -rand(40, 110),
          gravity: -30, drag: 0.7, size: rand(3, 7), sizeEnd: rand(4, 9), life: rand(0.6, 1.1),
          shape: 'bubble', color: pal.core, color2: pal.glow, additive: false, wobble: rand(1, 3),
        });
      }
    }
    if (r.leaves) {
      for (let i = 0; i < n(r.leaves); i++) {
        const a = rand(0, TAU), sp = rand(70, 240) * k;
        this.ps.spawn({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, gravity: 260, drag: 1.5,
          size: rand(4, 9), sizeEnd: rand(2, 5), life: rand(0.5, 1.0), shape: 'leaf',
          color: i % 3 ? pal.mid : pal.deep, color2: pal.core, additive: false,
          rot: rand(0, TAU), rotSpeed: rand(-9, 9), wobble: rand(2, 6),
        });
      }
    }
    if (r.petals) {
      for (let i = 0; i < n(r.petals); i++) {
        const a = rand(0, TAU), sp = rand(60, 200) * k;
        this.ps.spawn({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, gravity: 180, drag: 1.4,
          size: rand(3, 7), sizeEnd: 1, life: rand(0.6, 1.1), shape: 'petal',
          color: i % 2 ? pal.core : pal.mid, additive: false, rot: rand(0, TAU), rotSpeed: rand(-7, 7),
        });
      }
    }
    if (r.pollen) {
      for (let i = 0; i < n(r.pollen); i++) {
        this.ps.spawn({
          x: x + rand(-34, 34), y: y + rand(-24, 24), vx: rand(-24, 24), vy: rand(-30, 10),
          gravity: -12, drag: 0.8, size: rand(1.5, 3.5), life: rand(0.7, 1.3), shape: 'glow',
          color: pal.glow, additive: true, wobble: rand(2, 5),
        });
      }
    }
    if (r.mist) {
      for (let i = 0; i < n(r.mist); i++) {
        this.ps.spawn({
          x: x + rand(-40, 40), y: y + rand(-10, 20), vx: rand(-30, 30), vy: -rand(6, 26),
          gravity: -8, drag: 0.9, size: rand(10, 20), sizeEnd: rand(20, 34), life: rand(0.5, 0.9),
          shape: 'smoke', color: pal.glow, additive: false,
        });
      }
    }
    if (r.dust) {
      for (let i = 0; i < n(r.dust); i++) {
        this.ps.spawn({
          x: x + rand(-26, 26), y: y + rand(10, 26), vx: rand(-90, 90), vy: -rand(20, 70),
          gravity: 200, drag: 1.3, size: rand(4, 10), sizeEnd: rand(8, 16), life: rand(0.3, 0.6),
          shape: 'smoke', color: 'rgba(196,186,166,0.5)', additive: false,
        });
      }
    }
    if (r.debris) {
      for (let i = 0; i < n(r.debris); i++) {
        const a = -Math.PI / 2 + rand(-1.2, 1.2);
        this.ps.spawn({
          x, y: y + 30, vx: Math.cos(a) * rand(120, 300), vy: Math.sin(a) * rand(180, 420),
          gravity: 900, drag: 0.3, size: rand(3, 7), life: rand(0.5, 0.9), shape: 'shard',
          color: i % 2 ? pal.deep : pal.mid, additive: false, rot: rand(0, TAU), rotSpeed: rand(-10, 10),
        });
      }
    }
    if (r.shards) {
      for (let i = 0; i < n(r.shards); i++) {
        const a = rand(0, TAU), sp = rand(140, 320);
        this.ps.spawn({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gravity: 420, drag: 1.2,
          size: rand(3, 7), sizeEnd: 1, life: rand(0.3, 0.6), shape: 'shard',
          color: pal.deep, color2: pal.mid, additive: false, rot: Math.atan2(Math.sin(a), Math.cos(a)) + Math.PI / 2,
        });
      }
    }
    if (r.feathers) {
      for (let i = 0; i < n(r.feathers); i++) {
        const a = rand(0, TAU);
        this.ps.spawn({
          x, y, vx: Math.cos(a) * rand(40, 130), vy: Math.sin(a) * rand(40, 110) - 30,
          gravity: 90, drag: 1.7, size: rand(3, 6), life: rand(0.6, 1.1), shape: 'petal',
          color: '#f4f7ff', color2: pal.mid, additive: false, rot: rand(0, TAU), rotSpeed: rand(-6, 6), wobble: 4,
        });
      }
    }
    if (r.wind) {
      for (let i = 0; i < n(r.wind); i++) {
        const a = rand(0, TAU);
        this.ps.spawn({
          x: x + rand(-40, 40), y: y + rand(-40, 40), vx: Math.cos(a) * rand(150, 300), vy: Math.sin(a) * rand(60, 140),
          gravity: 0, drag: 1.4, size: rand(2, 4), life: rand(0.2, 0.4), shape: 'streak', sy: 0.5,
          color: pal.glow, additive: true, rot: a,
        });
      }
    }
    if (r.slash) {
      for (let i = 0; i < n(r.slash); i++) {
        this.ps.addEffect({
          kind: 'slash', x, y: y + rand(-14, 14), r0: 10, r1: rand(52, 84) * k, w: 5 * k,
          rot: rand(-0.9, 0.9), color: i % 2 ? pal.core : pal.mid, life: 0.22, delay: i * 0.045, alpha: 0.95,
        });
      }
    }
    void def; void opts;
  }

  emitAftermath(style, x, y, pal, k, def) {
    if (style === 'pollen') this.emit({ pollen: 10 }, x, y, pal, k, def);
    else if (style === 'mist') this.emit({ mist: 5 }, x, y, pal, k, def);
    else if (style === 'smoke') this.emit({ smoke: 5, embers: 6 }, x, y, pal, k, def);
    else if (style === 'dust') this.emit({ dust: 5 }, x, y, pal, k, def);
    else if (style === 'feathers') this.emit({ feathers: 6 }, x, y, pal, k, def);
  }

  // ------------------------------------------------------------ buffs
  /**
   * Buffs read as a stat rising: upward energy + a floating icon (drawn by the
   * scene) + a ring that matches what the stat does.
   */
  playBuffVFX(side, { stat = 'patk', up = true, element = 'none' } = {}) {
    if (!this.enabled || !this.stage) return;
    const at = this.pos(side);
    const cfg = BUFF_VFX[stat] || BUFF_VFX.patk;
    const pal = paletteFor(element);
    const tint = element && element !== 'none' ? pal.mid : cfg.color;
    const cx = at.x, cy = at.y - 56;

    if (up) {
      // rising energy column
      for (let i = 0; i < 14; i++) {
        this.ps.spawn({
          x: cx + rand(-30, 30), y: cy + rand(30, 60), vx: rand(-14, 14), vy: -rand(80, 170),
          gravity: -40, drag: 0.5, size: rand(2.5, 5), sizeEnd: 0, life: rand(0.5, 0.95),
          shape: 'spark', color: i % 3 ? cfg.color : '#ffffff', additive: true, stretch: 1.5,
        });
      }
      this.ps.addEffect({ kind: 'ring', x: cx, y: at.y - 4, r0: 10, r1: 74, w: 3, color: tint, life: 0.5, alpha: 0.85 });
      if (cfg.ring === 'shield') {
        this.ps.addEffect({ kind: 'dome', x: cx, y: cy, r1: 78, w: 4, color: cfg.color, life: 0.7, alpha: 0.55 });
      } else if (cfg.ring === 'wind') {
        for (let i = 0; i < 10; i++) {
          this.ps.spawn({
            x: cx + rand(-40, 40), y: cy + rand(-40, 30), vx: rand(-40, 40), vy: -rand(40, 120),
            gravity: -20, drag: 1.2, size: rand(2, 4), life: rand(0.25, 0.5), shape: 'streak',
            color: cfg.color, additive: true, sy: 0.6, rot: -Math.PI / 2,
          });
        }
        this.ps.addEffect({ kind: 'ring', x: cx, y: at.y - 4, r0: 80, r1: 30, w: 2.5, color: cfg.color, life: 0.4 });
      } else { // spike
        for (let i = 0; i < 6; i++) {
          this.ps.spawn({
            x: cx + rand(-26, 26), y: cy + rand(10, 30), vx: rand(-20, 20), vy: -rand(120, 220),
            gravity: 260, drag: 0.6, size: rand(3, 6), life: rand(0.3, 0.5), shape: 'shard',
            color: cfg.color, additive: true, rot: rand(-0.3, 0.3),
          });
        }
      }
    } else {
      // debuffs: visible but subdued, never covering the target
      for (let i = 0; i < 8; i++) {
        this.ps.spawn({
          x: cx + rand(-26, 26), y: cy + rand(-20, 20), vx: rand(-20, 20), vy: rand(30, 80),
          gravity: 60, drag: 1.2, size: rand(2, 4), life: rand(0.4, 0.7), shape: 'spark',
          color: '#ff9aa2', additive: false,
        });
      }
      this.ps.addEffect({ kind: 'ring', x: cx, y: at.y - 4, r0: 60, r1: 14, w: 2, color: '#ff9aa2', life: 0.45, alpha: 0.5 });
    }
    this.flash(0.06, cfg.color);
  }

  // ------------------------------------------------------------ ultimates
  /**
   * Cinematic: camera emphasis -> elemental charge -> the big sequence ->
   * impact -> aftermath. `defensive` ultimates (Ocean Guard) never look like
   * an attack: they raise a barrier around the caster.
   */
  playUltimateVFX(side, target, { element = 'none', skillId = '' } = {}) {
    if (!this.enabled || !this.stage) return null;
    const def = vfxFor(skillId, { element, category: 'ultimate' });
    const at = this.pos(side);
    const pal = paletteFor(element || def.element);
    const to = target || (side === 'player' ? 'enemy' : 'player');

    this.flash(0.35, pal.core);
    this.shake(6);
    this.ps.addEffect({ kind: 'rune', x: at.x, y: at.y - 2, r1: 108, w: 5, color: pal.glow, life: 1.1 });
    this.ps.addEffect({ kind: 'ring', x: at.x, y: at.y - 6, r0: 150, r1: 30, w: 6, color: pal.mid, life: 0.8 });
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU), r = rand(40, 130);
      this.ps.spawn({
        x: at.x + Math.cos(a) * r, y: at.y - 20 + Math.sin(a) * r * 0.45,
        vx: -Math.cos(a) * 60, vy: -rand(90, 220), gravity: -40, drag: 0.7,
        size: rand(3, 8), sizeEnd: 0, life: rand(0.6, 1.1),
        shape: def.element === 'fire' ? 'spark' : def.element === 'water' ? 'bubble' : 'leaf',
        color: i % 3 ? pal.mid : pal.core, color2: pal.deep, additive: def.element === 'fire',
        rot: rand(0, TAU), rotSpeed: rand(-7, 7),
      });
    }

    if (def.defensive) {                        // barrier, not an attack
      this.after(0.35, () => {
        const c = this.pos(side);
        this.ps.addEffect({ kind: 'dome', x: c.x, y: c.y - 56, r1: 104, w: 6, color: pal.core, life: 1.2, alpha: 1 });
        this.ps.addEffect({ kind: 'ring', x: c.x, y: c.y - 4, r0: 20, r1: 150, w: 4, color: pal.glow, life: 0.9 });
        this.emit({ bubbles: 16, drops: 12, mist: 6 }, c.x, c.y - 30, pal, 1.2, def);
        this.flash(0.18, pal.core);
      });
      return def;
    }

    this.after(0.42, () => {
      if (def.projectile) this.playProjectileVFX(def, this.pos(side), this.pos(to), { side, target: to, ultimate: true });
      else this.playImpactVFX(def, this.pos(to), { scale: 1 });
    });
    return def;
  }

  /** Small recoil dust + a tiny shake — the creature rig does the rest. */
  playHitReaction(side, { crit = false, effectiveness = 1, element = 'none' } = {}) {
    if (!this.enabled || !this.stage) return;
    const at = this.pos(side);
    const pal = paletteFor(element);
    const n = crit ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      this.ps.spawn({
        x: at.x + rand(-18, 18), y: at.y - 56 + rand(-20, 20),
        vx: Math.cos(a) * rand(60, 190), vy: Math.sin(a) * rand(40, 120) - 30,
        gravity: 480, drag: 1.5, size: rand(2, 4.5), life: rand(0.2, 0.45),
        shape: 'spark', stretch: 1.5, color: crit ? '#ffe08a' : pal.core, additive: true,
        rot: a,
      });
    }
    if (effectiveness > 1) {
      this.ps.addEffect({ kind: 'ring', x: at.x, y: at.y - 56, r0: 6, r1: 62, w: 3, color: '#ffd76a', life: 0.3, alpha: 0.9 });
    }
    this.shake(crit ? 5 : 2.5);
  }

  /** Snaps any projectile from `side` to its target (called on the damage beat). */
  finishProjectiles(side, info = {}) {
    for (const p of this.projectiles) {
      if (p.arrived) continue;
      if (side && p.side && p.side !== side) continue;
      p.arrived = true;
      p.t = p.dur;
      this.launchImpact(p, info);
    }
    if (this.projectiles.length) this.projectiles = this.projectiles.filter((p) => !p.arrived);
  }

  /** A dodged attack: the projectile dissipates instead of detonating. */
  whiff(targetSide) {
    for (const pr of this.projectiles) {
      if (pr.arrived) continue;
      if (targetSide && pr.target && pr.target !== targetSide) continue;
      pr.arrived = true;
      const pal = pr.pal;
      for (let i = 0; i < 8; i++) {
        this.ps.spawn({
          x: pr.x + rand(-14, 14), y: pr.y + rand(-14, 14),
          vx: rand(-70, 70), vy: rand(-50, 50), gravity: 120, drag: 1.6,
          size: rand(2, 5), sizeEnd: 0, life: rand(0.2, 0.45), shape: 'spark',
          color: pal.mid, additive: pr.tint === 'fire', rotSpeed: rand(-6, 6),
        });
      }
    }
    if (this.projectiles.length) this.projectiles = this.projectiles.filter((pr) => !pr.arrived);
  }

  stopAllVFX() {
    this.projectiles.length = 0;
    this.timers.length = 0;
    this.ps.clear();
    this.screen.flash = 0;
    this.screen.pulse = 0;
    this._lastSkill.clear();
  }

  // ------------------------------------------------------------ timeline
  after(delay, fn) { this.timers.push({ t: delay, fn }); }

  update(dt) {
    this.time += dt;
    this.ps.update(dt);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      p.rot += (p.spin || 6) * dt;
      p.acc += dt;
      const k = Math.min(1, p.t / p.dur);
      p.x = p.from.x + (p.to.x - p.from.x) * k;
      p.y = p.from.y + (p.to.y - p.from.y) * k - Math.sin(k * Math.PI) * p.arc;
      this.spawnTrail(p, dt, k);
      if (k >= 1 && !p.arrived) {
        p.arrived = true;
        this.launchImpact(p, {});
      }
      if (p.arrived) { this.projectiles[i] = this.projectiles[this.projectiles.length - 1]; this.projectiles.pop(); }
    }

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }

    if (this.screen.flash > 0) this.screen.flash = Math.max(0, this.screen.flash - dt * 2.2);
    if (this.screen.pulse > 0) this.screen.pulse = Math.max(0, this.screen.pulse - dt * 2.4);
  }

  launchImpact(p, info) {
    const at = { x: p.to.x, y: p.to.y + 58 };
    const crit = info.crit ?? p.crit;
    this.playImpactVFX(p.def, at, { crit, scale: info.scale ?? 1, effectiveness: p.effectiveness });
  }

  launchPuff(p) {
    const pal = p.pal;
    const dx = p.to.x - p.from.x, dy = p.to.y - p.from.y;
    const L = Math.hypot(dx, dy) || 1;
    const n = p.big ? 10 : 6;
    for (let i = 0; i < n; i++) {
      this.ps.spawn({
        x: p.from.x, y: p.from.y,
        vx: (dx / L) * rand(-40, 60) + rand(-40, 40), vy: (dy / L) * rand(-40, 60) + rand(-40, 40),
        gravity: 0, drag: 2.4, size: rand(2.5, 6), sizeEnd: 0, life: rand(0.14, 0.3),
        shape: p.tint === 'fire' ? 'spark' : p.tint === 'water' ? 'droplet' : 'leaf',
        color: pal.mid, color2: pal.deep, additive: p.tint === 'fire', rot: rand(0, TAU), rotSpeed: rand(-8, 8),
      });
    }
  }

  spawnTrail(p, dt, k) {
    if (!p.trail) return;
    const step = p.big ? 0.012 : 0.022;
    if (p.acc < step) return;
    p.acc = 0;
    const pal = p.pal;
    const jitter = p.big ? 12 : 7;
    const cfg = {
      x: p.x + rand(-jitter, jitter), y: p.y + rand(-jitter, jitter),
      vx: rand(-30, 30), vy: rand(-30, 30), drag: 1.4,
      size: rand(2, 5.5), sizeEnd: 0, life: rand(0.16, 0.4),
      rot: rand(0, TAU), rotSpeed: rand(-9, 9),
    };
    if (p.trail === 'ember') {
      this.ps.spawn({ ...cfg, vy: -rand(20, 90), gravity: -60, shape: 'spark', color: Math.random() < 0.5 ? pal.mid : pal.core, additive: true, stretch: 1.4 });
    } else if (p.trail === 'droplet') {
      this.ps.spawn({ ...cfg, gravity: 260, shape: 'droplet', color: pal.core, color2: pal.mid, additive: false });
    } else if (p.trail === 'leaf') {
      this.ps.spawn({ ...cfg, gravity: 180, shape: 'leaf', color: pal.mid, color2: pal.core, additive: false, wobble: 3 });
    } else if (p.trail === 'wind') {
      this.ps.spawn({ ...cfg, gravity: 0, shape: 'streak', color: pal.glow, additive: true, sy: 0.5 });
    } else {
      this.ps.spawn({ ...cfg, gravity: 40, shape: 'spark', color: pal.core, additive: true });
    }
    void k; void dt;
  }

  // ------------------------------------------------------------ rendering
  render(ctx) {
    for (const p of this.projectiles) this.renderProjectile(ctx, p);
    this.ps.render(ctx);
  }

  renderProjectile(ctx, p) {
    const pal = p.pal;
    const k = Math.min(1, p.t / p.dur);
    const dx = p.to.x - p.from.x, dy = p.to.y - p.from.y;
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(p.x, p.y);

    switch (p.style) {
      case 'orb': {
        const r = (p.big ? 26 : 15) * (0.7 + 0.3 * Math.sin(p.t * 30));
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = this.ps.radial(ctx, r * 2.4, pal.core, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.mid;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.core;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, TAU); ctx.fill();
        break;
      }
      case 'fireball': {
        const r = (p.big ? 30 : 20) * (0.85 + 0.15 * Math.sin(p.t * 24));
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = this.ps.radial(ctx, r * 2.2, pal.glow, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.mid;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.core;
        ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.1, r * 0.45, 0, TAU); ctx.fill();
        break;
      }
      case 'spear': {
        ctx.rotate(ang);
        const L = p.big ? 64 : 46, w = p.big ? 9 : 6;
        ctx.fillStyle = pal.deep;
        ctx.beginPath();
        ctx.moveTo(L * 0.5, 0); ctx.lineTo(-L * 0.5, -w * 0.6); ctx.lineTo(-L * 0.34, 0); ctx.lineTo(-L * 0.5, w * 0.6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = pal.mid;
        ctx.beginPath();
        ctx.moveTo(L * 0.42, 0); ctx.lineTo(-L * 0.3, -w * 0.34); ctx.lineTo(-L * 0.3, w * 0.34);
        ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = pal.core;
        ctx.beginPath(); ctx.ellipse(L * 0.34, 0, L * 0.16, w * 0.3, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'droplet': {
        ctx.rotate(ang + Math.PI / 2);
        const L = 26, w = 9;
        ctx.fillStyle = pal.mid;
        ctx.beginPath();
        ctx.moveTo(0, -L); ctx.quadraticCurveTo(w, 0, 0, L * 0.5); ctx.quadraticCurveTo(-w, 0, 0, -L);
        ctx.fill();
        ctx.fillStyle = pal.core;
        ctx.beginPath(); ctx.ellipse(0, -L * 0.25, w * 0.34, L * 0.3, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'leafDisc': {
        ctx.rotate(p.rot);
        const r = 13;
        ctx.fillStyle = pal.mid;
        ctx.beginPath();
        ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, -r * 0.72, r, 0); ctx.quadraticCurveTo(0, r * 0.72, -r, 0);
        ctx.fill();
        ctx.strokeStyle = pal.deep; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.8, 0); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = pal.glow; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * 0.5, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'vine': {                       // a whipping vine stretched from A to B
        const t = k;
        const ax = p.from.x - p.x, ay = p.from.y - p.y;
        ctx.rotate(ang);
        const L = Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y);
        ctx.strokeStyle = pal.deep; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-L * t, 0);
        ctx.quadraticCurveTo(-L * t * 0.5, Math.sin(p.t * 22) * 16, 0, 0);
        ctx.stroke();
        ctx.strokeStyle = pal.mid; ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(-L * t, 0);
        ctx.quadraticCurveTo(-L * t * 0.5, Math.sin(p.t * 22) * 16, 0, 0);
        ctx.stroke();
        ctx.fillStyle = pal.core;                        // leaf buds along the vine
        for (let i = 1; i <= 3; i++) {
          const f = i / 4;
          ctx.beginPath();
          ctx.ellipse(-L * t * (1 - f), Math.sin(p.t * 22 + i) * 10, 5, 2.4, 0.5, 0, TAU);
          ctx.fill();
        }
        void ax; void ay;
        break;
      }
      case 'wave': {                        // travelling arc of water
        const w = p.big ? 84 : 54, h = p.big ? 40 : 26;
        ctx.fillStyle = pal.mid;
        ctx.beginPath();
        ctx.moveTo(-w, 6);
        ctx.quadraticCurveTo(0, -h, w, 6);
        ctx.quadraticCurveTo(0, h * 0.5, -w, 6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = pal.core;
        ctx.beginPath();
        ctx.moveTo(-w * 0.7, 2);
        ctx.quadraticCurveTo(0, -h * 0.55, w * 0.7, 2);
        ctx.quadraticCurveTo(0, h * 0.25, -w * 0.7, 2);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'whirl': {
        ctx.rotate(p.rot);
        ctx.strokeStyle = pal.mid; ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.9 - i * 0.2;
          ctx.beginPath();
          ctx.arc(0, 0, (p.big ? 26 : 18) - i * 5, i * 2.1, i * 2.1 + 4.2);
          ctx.stroke();
        }
        break;
      }
      case 'cyclone': {
        ctx.rotate(p.rot * 0.4);
        ctx.strokeStyle = pal.mid; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = 0.85 - i * 0.18;
          ctx.beginPath();
          ctx.ellipse(0, (i - 1.5) * 9, 22 - i * 3, 8 - i, 0, i, i + 4.4);
          ctx.stroke();
        }
        break;
      }
      case 'flameCone': {                   // a cone of fire from the caster
        const L = Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y) * Math.min(1, k * 1.4);
        ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter';
        const layers = [
          { c: pal.deep, s: 1.0, a: 0.55 },
          { c: pal.mid, s: 0.66, a: 0.75 },
          { c: pal.core, s: 0.32, a: 0.95 },
        ];
        const h = p.big ? 46 : 30;
        for (const Ly of layers) {
          ctx.globalAlpha = Ly.a;
          ctx.fillStyle = Ly.c;
          ctx.beginPath();
          ctx.moveTo(-L, 0);
          ctx.quadraticCurveTo(-L * 0.5, -h * Ly.s * (0.7 + 0.4 * Math.sin(p.t * 26)), 0, -h * 0.16 * Ly.s);
          ctx.quadraticCurveTo(-L * 0.5, h * Ly.s * (0.7 + 0.4 * Math.cos(p.t * 24)), -L, 0);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'petalStorm': case 'leafStorm': {
        ctx.rotate(p.rot);
        ctx.fillStyle = pal.mid;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + p.t * 9;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 16, Math.sin(a) * 11, 7, 3, a, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'tidalColumn': case 'column': {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = pal.mid;
        const w = 44, h = 150 * k;
        ctx.beginPath();
        ctx.moveTo(-w * 0.5, 0);
        ctx.quadraticCurveTo(-w * 0.35, -h * 0.6, -w * 0.22, -h);
        ctx.lineTo(w * 0.22, -h);
        ctx.quadraticCurveTo(w * 0.35, -h * 0.6, w * 0.5, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = pal.core;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(-w * 0.26, 0);
        ctx.quadraticCurveTo(-w * 0.18, -h * 0.6, -w * 0.1, -h * 0.92);
        ctx.lineTo(w * 0.1, -h * 0.92);
        ctx.quadraticCurveTo(w * 0.18, -h * 0.6, w * 0.26, 0);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'rootErupt': {                   // cracks running along the ground
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = pal.deep; ctx.lineWidth = 6; ctx.lineCap = 'round';
        const L = 90 * k;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(-L * 0.5, i * 10);
          ctx.lineTo(L * 0.5, i * 14 + 6);
          ctx.stroke();
        }
        ctx.strokeStyle = pal.mid; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-L * 0.5, 0); ctx.lineTo(L * 0.5, 6); ctx.stroke();
        break;
      }
      case 'lunge': case 'dash': case 'contact': default: {
        // melee: the creature itself is the projectile — show speed streaks
        ctx.globalCompositeOperation = 'lighter';
        ctx.rotate(ang);
        ctx.strokeStyle = p.tint === 'fire' ? pal.glow : p.tint === 'nature' ? pal.glow : '#ffffff';
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.globalAlpha = 0.7 * (1 - k * 0.6);
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(-46, i * 12);
          ctx.lineTo(30, i * 8);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  /** Full-screen flash + radial pulse (drawn last, over the creatures). */
  renderScreen(ctx, W, H) {
    if (this.screen.flash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.screen.flash * 0.5;
      ctx.fillStyle = this.screen.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.screen.pulse > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.screen.pulse * 0.35;
      const g = ctx.createRadialGradient(this.screen.px, this.screen.py, 10, this.screen.px, this.screen.py, 320);
      g.addColorStop(0, this.screen.flashColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

/** Shared singleton — every scene talks to the same manager. */
export const SkillVFX = new SkillVFXManager();

// Standalone helpers (named exactly as the VFX brief asks for).
export const playSkillVFX = (o) => SkillVFX.playSkillVFX(o);
export const playProjectileVFX = (def, from, to, opts) => SkillVFX.playProjectileVFX(def, from, to, opts);
export const playImpactVFX = (def, at, opts) => SkillVFX.playImpactVFX(def, at, opts);
export const playBuffVFX = (side, opts) => SkillVFX.playBuffVFX(side, opts);
export const playUltimateVFX = (side, target, opts) => SkillVFX.playUltimateVFX(side, target, opts);
export const playHitReaction = (side, opts) => SkillVFX.playHitReaction(side, opts);
export const stopAllVFX = () => SkillVFX.stopAllVFX();
