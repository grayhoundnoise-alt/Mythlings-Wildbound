// =============================================================================
// PARTICLE SYSTEM — pooled, canvas-only, zero per-frame allocation
// -----------------------------------------------------------------------------
// Every particle is reused from a fixed pool. Quality comes from shape, timing,
// easing and layering — NOT from particle counts: a fireball is one glow, one
// core, one trail and a dozen sparks, not five hundred dots.
//
// Particle fields: x, y, vx, vy, gravity, drag, rot, rotSpeed, size, sizeEnd,
// life, max, alpha, fadeIn, shape, color, color2, additive, spin, wobble.
// =============================================================================

const TAU = Math.PI * 2;

function blankParticle() {
  return {
    on: false, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, drag: 0,
    rot: 0, rotSpeed: 0, size: 4, sizeEnd: 0, life: 0, max: 1,
    alpha: 1, fadeIn: 0, shape: 'spark', color: '#fff', color2: null,
    additive: false, wobble: 0, seed: 0, sx: 1, sy: 1, stretch: 0,
  };
}

function blankEffect() {
  return {
    on: false, kind: 'ring', x: 0, y: 0, life: 0, max: 1,
    r0: 0, r1: 60, w: 3, color: '#fff', alpha: 1, additive: true,
    rot: 0, len: 0, x2: 0, y2: 0, ease: 'out', delay: 0, spin: 0,
  };
}

const EASE = {
  out: (k) => 1 - (1 - k) * (1 - k),
  in: (k) => k * k,
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2),
  linear: (k) => k,
  spring: (k) => {
    const c = 1.70158 + 1;
    return 1 + c * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
  },
};

export class ParticleSystem {
  constructor({ particles = 320, effects = 40 } = {}) {
    this.pool = [];
    this.live = [];
    for (let i = 0; i < particles; i++) this.pool.push(blankParticle());
    this.fxPool = [];
    this.fx = [];
    for (let i = 0; i < effects; i++) this.fxPool.push(blankEffect());
    this.gradCache = new Map();
  }

  get activeCount() { return this.live.length + this.fx.length; }

  /** @returns {object|null} a pooled particle, or null when the pool is full. */
  spawn(cfg) {
    const p = this.pool.pop();
    if (!p) return null;                       // hard cap: never allocate mid-frame
    p.on = true;
    p.x = cfg.x; p.y = cfg.y;
    p.vx = cfg.vx || 0; p.vy = cfg.vy || 0;
    p.gravity = cfg.gravity || 0;
    p.drag = cfg.drag || 0;
    p.rot = cfg.rot || 0;
    p.rotSpeed = cfg.rotSpeed || 0;
    p.size = cfg.size ?? 4;
    p.sizeEnd = cfg.sizeEnd ?? p.size * 0.2;
    p.life = 0;
    p.max = cfg.life ?? 0.6;
    p.alpha = cfg.alpha ?? 1;
    p.fadeIn = cfg.fadeIn || 0;
    p.shape = cfg.shape || 'spark';
    p.color = cfg.color || '#ffffff';
    p.color2 = cfg.color2 || null;
    p.additive = !!cfg.additive;
    p.wobble = cfg.wobble || 0;
    p.seed = Math.random() * TAU;
    p.sx = cfg.sx ?? 1; p.sy = cfg.sy ?? 1;
    p.stretch = cfg.stretch || 0;
    this.live.push(p);
    return p;
  }

  /** Ring / slash / beam / burst primitive. */
  addEffect(cfg) {
    const e = this.fxPool.pop();
    if (!e) return null;
    e.on = true;
    e.kind = cfg.kind || 'ring';
    e.x = cfg.x; e.y = cfg.y;
    e.x2 = cfg.x2 ?? cfg.x; e.y2 = cfg.y2 ?? cfg.y;
    e.life = 0;
    e.max = cfg.life ?? 0.4;
    e.delay = cfg.delay || 0;
    e.r0 = cfg.r0 ?? 0;
    e.r1 = cfg.r1 ?? 60;
    e.w = cfg.w ?? 3;
    e.color = cfg.color || '#ffffff';
    e.alpha = cfg.alpha ?? 1;
    e.additive = cfg.additive !== false;
    e.rot = cfg.rot || 0;
    e.spin = cfg.spin || 0;
    e.len = cfg.len ?? 0;
    e.ease = cfg.ease || 'out';
    this.fx.push(e);
    return e;
  }

  update(dt) {
    const live = this.live;
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life += dt;
      if (p.life >= p.max) {
        p.on = false;
        live[i] = live[live.length - 1]; live.pop();
        this.pool.push(p);
        continue;
      }
      p.vy += p.gravity * dt;
      if (p.drag) {
        const d = 1 - p.drag * dt;
        p.vx *= d; p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;
    }
    const fx = this.fx;
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i];
      if (e.delay > 0) { e.delay -= dt; continue; }
      e.life += dt;
      if (e.life >= e.max) {
        e.on = false;
        fx[i] = fx[fx.length - 1]; fx.pop();
        this.fxPool.push(e);
      }
    }
  }

  /**
   * Cached radial gradient centred on the CURRENT ORIGIN (0,0), keyed by colour
   * + radius bucket. Translate the context to the effect centre before using it.
   */
  radial(ctx, r, inner, outer) {
    const rb = Math.max(2, Math.round(r));
    const key = `${inner}|${outer}|${rb}`;
    let g = this.gradCache.get(key);
    if (!g) {
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, rb);
      g.addColorStop(0, inner);
      g.addColorStop(1, outer);
      if (this.gradCache.size > 120) this.gradCache.clear();
      this.gradCache.set(key, g);
    }
    return g;
  }

  render(ctx) {
    // pass 1: additive (glow, fire, energy) — drawn beneath
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.live) if (p.additive) this.drawParticle(ctx, p);
    for (const e of this.fx) if (e.additive && e.delay <= 0) this.drawEffect(ctx, e);
    ctx.restore();

    // pass 2: normal blending (leaves, water, petals, smoke)
    ctx.save();
    for (const p of this.live) if (!p.additive) this.drawParticle(ctx, p);
    for (const e of this.fx) if (!e.additive && e.delay <= 0) this.drawEffect(ctx, e);
    ctx.restore();
  }

  drawParticle(ctx, p) {
    const k = p.life / p.max;
    const a = p.alpha * (p.fadeIn && k < p.fadeIn ? k / p.fadeIn : 1 - (k - (p.fadeIn || 0)) / Math.max(0.001, 1 - (p.fadeIn || 0)));
    if (a <= 0.01) return;
    const s = p.size + (p.sizeEnd - p.size) * k;
    const wob = p.wobble ? Math.sin(p.life * 6 + p.seed) * p.wobble : 0;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.save();
    ctx.translate(p.x + wob, p.y);
    ctx.rotate(p.rot);
    const stretch = p.stretch ? 1 + p.stretch * Math.min(1, Math.hypot(p.vx, p.vy) / 600) : 1;
    ctx.scale(p.sx * stretch, p.sy);

    switch (p.shape) {
      case 'spark': {                       // elongated ember streak
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(0.4, s), Math.max(0.3, s * 0.45), 0, 0, TAU);
        ctx.fill();
        break;
      }
      case 'glow': {                        // soft radial blob
        ctx.fillStyle = this.radial(ctx, s * 2.2, p.color, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(0, 0, s * 2.2, 0, TAU); ctx.fill();
        break;
      }
      case 'leaf': {                        // veined leaf blade
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-s, 0);
        ctx.quadraticCurveTo(0, -s * 0.62, s, 0);
        ctx.quadraticCurveTo(0, s * 0.62, -s, 0);
        ctx.fill();
        if (p.color2) {
          ctx.strokeStyle = p.color2; ctx.lineWidth = Math.max(0.4, s * 0.12);
          ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.8, 0); ctx.stroke();
        }
        break;
      }
      case 'petal': {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.85, -s * 0.2, 0, s);
        ctx.quadraticCurveTo(-s * 0.85, -s * 0.2, 0, -s);
        ctx.fill();
        break;
      }
      case 'droplet': {                     // teardrop: pointed on the travel side
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.5);
        ctx.quadraticCurveTo(s * 0.9, 0, 0, s);
        ctx.quadraticCurveTo(-s * 0.9, 0, 0, -s * 1.5);
        ctx.fill();
        break;
      }
      case 'bubble': {
        ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(0.5, s * 0.22);
        ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke();
        ctx.fillStyle = p.color2 || p.color;
        ctx.globalAlpha *= 0.28;
        ctx.beginPath(); ctx.arc(0, 0, s * 0.92, 0, TAU); ctx.fill();
        break;
      }
      case 'shard': {                       // thorn / ice shard
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * 0.55, s * 0.5); ctx.lineTo(-s * 0.55, s * 0.5);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'smoke': {
        ctx.globalAlpha *= 0.5;
        ctx.fillStyle = this.radial(ctx, s * 2, p.color, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(0, 0, s * 2, 0, TAU); ctx.fill();
        break;
      }
      case 'streak': {                      // motion streak (peck / claw / wind)
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-s * 2.2, -s * 0.16);
        ctx.quadraticCurveTo(0, -s * 0.42, s * 2.2, -s * 0.1);
        ctx.quadraticCurveTo(0, s * 0.26, -s * 2.2, s * 0.16);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'fang': {                        // crescent claw arc
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, s * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, s * 1.8, -0.9, 0.9);
        ctx.stroke();
        break;
      }
      case 'ring': {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.6, s * 0.3);
        ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke();
        break;
      }
      case 'star': {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a2 = (i / 8) * TAU;
          const rr = i % 2 ? s * 0.4 : s;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a2) * rr, Math.sin(a2) * rr);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, Math.max(0.4, s), 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawEffect(ctx, e) {
    const k = Math.min(1, e.life / e.max);
    const p = (EASE[e.ease] || EASE.out)(k);
    const a = e.alpha * (1 - k * k);
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot + e.spin * p);

    if (e.kind === 'ring') {
      const r = e.r0 + (e.r1 - e.r0) * p;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = Math.max(0.5, e.w * (1 - k * 0.7));
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * (e.len ? e.len : 0.42), 0, 0, TAU);
      ctx.stroke();
    } else if (e.kind === 'shock') {          // ground shockwave (wide, flat)
      const r = e.r0 + (e.r1 - e.r0) * p;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = Math.max(0.5, e.w * (1 - k));
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.3, 0, 0, TAU);
      ctx.stroke();
    } else if (e.kind === 'burst') {          // filled radial flash
      const r = e.r0 + (e.r1 - e.r0) * p;
      ctx.fillStyle = this.radial(ctx, r, e.color, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.restore();
      return;
    } else if (e.kind === 'slash') {          // tapered arc slash
      ctx.strokeStyle = e.color;
      ctx.lineWidth = Math.max(1, e.w * (1 - k * 0.8));
      ctx.lineCap = 'round';
      ctx.beginPath();
      const r = e.r0 + (e.r1 - e.r0) * p;
      ctx.arc(0, 0, r, e.rot - 0.9, e.rot + 0.9);
      ctx.stroke();
    } else if (e.kind === 'beam') {
      const dx = e.x2 - e.x, dy = e.y2 - e.y;
      const L = Math.hypot(dx, dy) || 1;
      ctx.globalAlpha *= (1 - k) * e.alpha;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = e.w * (1 - k * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(dx * p, dy * p);
      ctx.stroke();
      ctx.globalAlpha *= 0.5;
      ctx.lineWidth = e.w * 2.2 * (1 - k * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(dx * p, dy * p); ctx.stroke();
      void L;
    } else if (e.kind === 'rune') {           // glowing ground circle
      const r = e.r1 * (0.7 + 0.3 * p);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = Math.max(0.8, e.w * (1 - k * 0.5));
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.38, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.72, r * 0.28, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a2 = (i / 6) * TAU + p * 1.2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a2) * r * 0.86, Math.sin(a2) * r * 0.33, e.w * 0.9, e.w * 0.9, 0, 0, TAU);
        ctx.fillStyle = e.color; ctx.fill();
      }
    } else if (e.kind === 'dome') {           // defensive barrier
      const r = e.r1 * (0.86 + 0.14 * Math.sin(k * Math.PI));
      ctx.strokeStyle = e.color;
      ctx.lineWidth = Math.max(1, e.w * (1 - k * 0.4));
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.globalAlpha *= 0.22;
      ctx.fillStyle = this.radial(ctx, r, e.color, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.restore();
      return;
    } else if (e.kind === 'column') {         // water column / pressure pillar
      const h = e.len * p;
      ctx.globalAlpha *= (1 - k * 0.8);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(-e.r1, 0);
      ctx.quadraticCurveTo(-e.r1 * 0.6, -h * 0.6, -e.r1 * 0.35, -h);
      ctx.lineTo(e.r1 * 0.35, -h);
      ctx.quadraticCurveTo(e.r1 * 0.6, -h * 0.6, e.r1, 0);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  clear() {
    for (const p of this.live) { p.on = false; this.pool.push(p); }
    this.live.length = 0;
    for (const e of this.fx) { e.on = false; this.fxPool.push(e); }
    this.fx.length = 0;
  }
}

export { TAU };
