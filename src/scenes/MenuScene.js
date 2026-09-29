// =============================================================================
// Title-screen vista for MYTHLINGS: WILDBOUND.
//
// Everything here is drawn procedurally at runtime — no image assets, nothing
// traced from another game. The scene is built in depth layers so the world
// reads as large and explorable behind the menu:
//
//   sky + sun + god rays  ->  far ranges  ->  floating isle  ->  near ranges
//   -> valley + lake + waterfalls -> village -> forest bands -> hero ledge
//   -> Mythlings -> foliage framing -> light/particles -> grade
//
// The left ~36% of the frame is deliberately kept low-contrast and empty of
// focal detail so the menu column stays readable at every supported size.
// =============================================================================
import { drawCreature } from '../render/creatures.js';
import { HD_ASSETS } from '../data/hdManifest.js';
import { makeRng } from '../core/utils.js';

const SKY_TOP = '#1f6fc4';
const SKY_MID = '#7cc6f2';
const SKY_HAZE = '#cfeaff';
const SKY_WARM = '#ffe6bd';

export class MenuScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.dpr = 1;

    const rng = makeRng(20260927);
    const r = (a, b) => a + rng() * (b - a);

    // --- cloud banks: three parallax depths -------------------------------
    this.clouds = [];
    for (let i = 0; i < 7; i++) this.clouds.push({ x: rng(), y: r(0.04, 0.20), s: r(1.1, 1.9), v: r(0.0016, 0.0032), a: r(0.55, 0.9), layer: 0, seed: rng() * 99 });
    for (let i = 0; i < 6; i++) this.clouds.push({ x: rng(), y: r(0.16, 0.34), s: r(0.6, 1.1), v: r(0.0035, 0.006), a: r(0.45, 0.8), layer: 1, seed: rng() * 99 });
    for (let i = 0; i < 5; i++) this.clouds.push({ x: rng(), y: r(0.30, 0.44), s: r(0.35, 0.6), v: r(0.006, 0.011), a: r(0.3, 0.55), layer: 2, seed: rng() * 99 });

    // --- forest bands: x, depth row, scale, sway seed ----------------------
    this.forest = [];
    for (let row = 0; row < 4; row++) {
      const count = [34, 26, 18, 13][row];
      for (let i = 0; i < count; i++) {
        this.forest.push({
          row,
          x: rng(),
          jitter: r(-0.012, 0.012),
          s: r(0.75, 1.3) * [0.42, 0.62, 0.9, 1.3][row],
          seed: rng() * 20,
          kind: rng() < 0.33 ? 'pine' : 'round',
        });
      }
    }
    this.forest.sort((a, b) => a.row - b.row);

    // --- village cottages --------------------------------------------------
    this.village = Array.from({ length: 9 }, (_, i) => ({
      x: 0.235 + i * 0.026 + r(-0.006, 0.006),
      y: 0.612 + (i % 3) * 0.013,
      s: r(0.8, 1.15),
      roof: ['#b4542f', '#a8473c', '#8e5a36', '#b8663a'][i % 4],
      lit: rng() < 0.45,
    }));

    // --- foreground grass + flowers on the hero ledge ----------------------
    this.tufts = Array.from({ length: 150 }, () => ({
      x: r(0.02, 1.02), yo: r(0, 1), h: r(9, 26), seed: rng() * 20, tone: rng(),
    }));
    this.flowers = Array.from({ length: 46 }, () => ({
      x: r(0.05, 1.0), yo: r(0.1, 1), s: r(0.7, 1.5), seed: rng() * 20,
      c: ['#ffd95e', '#ff9fc2', '#fff3d0', '#b98cff', '#ff8a5c'][Math.floor(rng() * 5)],
    }));
    this.rocks = Array.from({ length: 14 }, () => ({ x: r(0.06, 1.0), yo: r(0, 1), s: r(0.5, 1.5), seed: rng() * 10 }));

    // --- drifting motes ----------------------------------------------------
    this.motes = Array.from({ length: 90 }, () => ({
      x: rng(), y: rng(), s: r(0.8, 2.6), v: r(0.004, 0.016), drift: r(0.3, 1.4),
      seed: rng() * 100, warm: rng() < 0.45,
    }));

    // --- distant birds -----------------------------------------------------
    this.birds = Array.from({ length: 3 }, (_, i) => ({
      x: rng(), y: r(0.16, 0.34), v: r(0.012, 0.022), n: 3 + Math.floor(rng() * 3), seed: i * 7.3, s: r(0.5, 1),
    }));

    // --- the cast ----------------------------------------------------------
    // Everything sits right of x = 0.46 so the menu column never covers a face.
    this.actors = [
      // drop = how far below the ledge lip the creature stands (screen-space depth)
      { species: 'rivruff', x: 0.495, y: 0, drop: 0.085, size: 232, facing: -1, phase: 4.1, expression: 'sleepy' },
      { species: 'spriggo', x: 0.648, y: 0, drop: 0.055, size: 214, facing: -1, phase: 0.0, expression: 'determined' },
      { species: 'aquini',  x: 0.785, y: 0, drop: 0.135, size: 226, facing: -1, phase: 1.4, expression: 'happy' },
      { species: 'emberu',  x: 0.905, y: 0, drop: -0.038, size: 218, facing: -1, phase: 2.6, expression: 'determined' },
      { species: 'leaflet', x: 0.735, y: 0.425, drop: 0, size: 128, facing: -1, phase: 3.3, fly: true, expression: 'happy' },
    ];
  }

  update(dt) { this.time += dt; }

  /**
   * The main menu is one full-bleed picture. Everything it used to draw itself
   * — sky, ranges, floating isle, clouds, village, the cast of Mythlings, the
   * framing foliage, god rays and motes — is gone; the buttons sit straight on
   * the art. If the picture is missing the old painted scene is still there
   * underneath, so the menu is never blank.
   */
  render() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const W = this.canvas.width / dpr, H = this.canvas.height / dpr;
    const t = this.time;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const pic = this.menuPicture();
    if (pic && pic.naturalWidth) {
      this.coverDraw(ctx, pic, W, H, t);
      return;
    }
    this.renderPainted(ctx, W, H, t);
  }

  /**
   * The full-bleed menu picture, fetched once. Returns null until it arrives, so
   * the caller falls back to the painted scene rather than showing a blank
   * screen. `_pic` is left at null after the first call, so this never kicks
   * off a second load.
   */
  menuPicture() {
    if (this._pic !== undefined) return this._pic;
    this._pic = null;
    const url = HD_ASSETS['menu:main'];
    if (url && typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => { this._pic = img; };
      img.src = url;
    }
    return this._pic;
  }

  /**
   * Cover the canvas with the picture, cropping whatever overflows. `t` adds a
   * drift of a fraction of a percent — enough that the screen is not dead, slow
   * enough that nobody consciously sees it.
   */
  coverDraw(ctx, img, W, H, t = 0) {
    const base = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const zoom = 1.02 + Math.sin(t * 0.09) * 0.006;
    const s = base * zoom;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    const dx = (W - w) / 2;
    const dy = (H - h) / 2 + Math.sin(t * 0.06) * (H * 0.004);
    ctx.drawImage(img, dx, dy, w, h);
  }

  /** The old procedural vista, kept as the fallback. */
  renderPainted(ctx, W, H, t) {
    const sunX = W * 0.665, sunY = H * 0.155;
    const horizon = H * 0.56;

    this.sky(ctx, W, H, horizon);
    this.sun(ctx, W, H, sunX, sunY);
    this.cloudLayer(ctx, W, H, t, 0);
    this.farRanges(ctx, W, H, horizon, t);
    this.floatingIsle(ctx, W, H, t);
    this.cloudLayer(ctx, W, H, t, 1);
    this.nearRanges(ctx, W, H, horizon, t);
    this.birdFlocks(ctx, W, H, t);
    this.valley(ctx, W, H, horizon, t);
    this.villageRow(ctx, W, H);
    this.forestBands(ctx, W, H, t);
    this.cloudLayer(ctx, W, H, t, 2);
    this.heroLedge(ctx, W, H, t);
    this.cast(ctx, W, H, t);
    this.framingFoliage(ctx, W, H, t);
    this.godRays(ctx, W, H, sunX, sunY, t);
    this.moteField(ctx, W, H, t);
    this.grade(ctx, W, H);
  }

  // ---------------------------------------------------------------- sky
  sky(ctx, W, H, horizon) {
    const g = ctx.createLinearGradient(0, 0, 0, horizon * 1.05);
    g.addColorStop(0, SKY_TOP);
    g.addColorStop(0.30, '#4a9ddb');
    g.addColorStop(0.58, SKY_MID);
    g.addColorStop(0.82, SKY_HAZE);
    g.addColorStop(1, SKY_WARM);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizon + 4);

    // warm band hugging the horizon
    const hb = ctx.createLinearGradient(0, horizon - H * 0.16, 0, horizon + 2);
    hb.addColorStop(0, 'rgba(255,225,170,0)');
    hb.addColorStop(1, 'rgba(255,221,163,0.85)');
    ctx.fillStyle = hb;
    ctx.fillRect(0, horizon - H * 0.16, W, H * 0.16 + 2);
  }

  sun(ctx, W, H, x, y) {
    const outer = ctx.createRadialGradient(x, y, 2, x, y, H * 0.62);
    outer.addColorStop(0, 'rgba(255,252,226,0.95)');
    outer.addColorStop(0.12, 'rgba(255,240,186,0.55)');
    outer.addColorStop(0.4, 'rgba(255,214,140,0.22)');
    outer.addColorStop(1, 'rgba(255,205,130,0)');
    ctx.fillStyle = outer;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const core = ctx.createRadialGradient(x, y, 0, x, y, H * 0.055);
    core.addColorStop(0, 'rgba(255,255,255,0.95)');
    core.addColorStop(1, 'rgba(255,246,208,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(x, y, H * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  cloudLayer(ctx, W, H, t, layer) {
    ctx.save();
    for (const c of this.clouds) {
      if (c.layer !== layer) continue;
      const span = W + 700;
      const x = ((c.x * span + t * c.v * W) % span) - 350;
      const y = c.y * H;
      const s = c.s * (W / 1600);
      ctx.globalAlpha = c.a;
      puff(ctx, x, y, s, c.seed, t);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ mountains
  farRanges(ctx, W, H, horizon, t) {
    // pale, hazy back range with snow caps
    ridge(ctx, W, horizon + 6, {
      peaks: [
        [-0.05, 0.06], [0.06, 0.20], [0.14, 0.10], [0.24, 0.26], [0.33, 0.13],
        [0.44, 0.22], [0.55, 0.11], [0.63, 0.24], [0.74, 0.14], [0.86, 0.23], [1.05, 0.10],
      ],
      H, colorTop: '#b7d3ec', colorBottom: '#94b7dc', alpha: 0.85, snow: 0.55,
    });
    ridge(ctx, W, horizon + 12, {
      peaks: [
        [-0.05, 0.03], [0.09, 0.16], [0.2, 0.07], [0.3, 0.19], [0.41, 0.09],
        [0.52, 0.17], [0.66, 0.08], [0.78, 0.18], [0.9, 0.09], [1.05, 0.14],
      ],
      H, colorTop: '#8fb3d8', colorBottom: '#6f96c2', alpha: 0.9, snow: 0.4,
    });
  }

  nearRanges(ctx, W, H, horizon, t) {
    ridge(ctx, W, horizon + 26, {
      peaks: [
        [-0.05, 0.02], [0.04, 0.11], [0.16, 0.05], [0.27, 0.13], [0.38, 0.05],
        [0.5, 0.10], [0.62, 0.05], [0.72, 0.12], [0.84, 0.05], [0.95, 0.11], [1.05, 0.04],
      ],
      H, colorTop: '#5f86ae', colorBottom: '#3f6690', alpha: 0.95, snow: 0.22,
    });
    // atmospheric haze veil over the ranges
    const hz = ctx.createLinearGradient(0, horizon - H * 0.12, 0, horizon + H * 0.05);
    hz.addColorStop(0, 'rgba(206,232,255,0)');
    hz.addColorStop(1, 'rgba(216,236,255,0.75)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizon - H * 0.12, W, H * 0.17);
  }

  floatingIsle(ctx, W, H, t) {
    const x = W * 0.545, y = H * 0.245 + Math.sin(t * 0.5) * H * 0.004;
    const s = Math.min(W / 1600, H / 900);
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.translate(x, y);
    ctx.scale(s, s);

    // rock underside
    ctx.beginPath();
    ctx.moveTo(-112, 4);
    ctx.bezierCurveTo(-78, 46, -46, 74, -22, 118);
    ctx.bezierCurveTo(-6, 150, 8, 132, 16, 96);
    ctx.bezierCurveTo(34, 118, 54, 96, 66, 60);
    ctx.bezierCurveTo(86, 44, 104, 24, 112, 2);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, -10, 0, 140);
    rg.addColorStop(0, '#7e8fa8');
    rg.addColorStop(0.45, '#5d6d87');
    rg.addColorStop(1, '#3d4c64');
    ctx.fillStyle = rg; ctx.fill();

    // grass cap
    ctx.beginPath();
    ctx.ellipse(0, -2, 114, 22, 0, 0, Math.PI * 2);
    const gg = ctx.createLinearGradient(0, -24, 0, 20);
    gg.addColorStop(0, '#8fd77a');
    gg.addColorStop(1, '#4f9a4f');
    ctx.fillStyle = gg; ctx.fill();

    // slender spire + outbuilding (original silhouette, not a castle copy)
    const tower = (tx, tw, th, roofC) => {
      ctx.fillStyle = '#e6eef7';
      ctx.fillRect(tx - tw / 2, -th, tw, th);
      ctx.fillStyle = 'rgba(90,120,160,0.35)';
      ctx.fillRect(tx + tw * 0.18, -th, tw * 0.32, th);
      ctx.beginPath();
      ctx.moveTo(tx - tw * 0.85, -th);
      ctx.lineTo(tx, -th - tw * 1.9);
      ctx.lineTo(tx + tw * 0.85, -th);
      ctx.closePath();
      ctx.fillStyle = roofC; ctx.fill();
      ctx.fillStyle = 'rgba(40,70,110,0.5)';
      for (let i = 1; i <= 2; i++) ctx.fillRect(tx - tw * 0.16, -th + i * th * 0.28, tw * 0.32, th * 0.12);
    };
    tower(-34, 15, 52, '#4fa8d8');
    tower(-4, 22, 84, '#3d90c6');
    tower(28, 13, 44, '#4fa8d8');
    ctx.fillStyle = '#e6eef7';
    ctx.fillRect(-46, -30, 88, 30);
    ctx.fillStyle = 'rgba(90,120,160,0.28)';
    ctx.fillRect(-46, -30, 88, 8);

    // trees on the rim
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const tx = i * 38 + (i > 0 ? 18 : -18);
      ctx.fillStyle = '#6b4a2c'; ctx.fillRect(tx - 2, -16, 4, 16);
      ctx.fillStyle = '#54a352';
      ctx.beginPath(); ctx.arc(tx, -22, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6fc169';
      ctx.beginPath(); ctx.arc(tx - 3, -25, 7, 0, Math.PI * 2); ctx.fill();
    }

    // waterfall pouring off the isle into mist
    const wfx = 34, wfTop = 8, wfLen = 96;
    const wg = ctx.createLinearGradient(0, wfTop, 0, wfTop + wfLen);
    wg.addColorStop(0, 'rgba(226,246,255,0.92)');
    wg.addColorStop(0.55, 'rgba(190,230,255,0.55)');
    wg.addColorStop(1, 'rgba(190,230,255,0)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(wfx - 7, wfTop);
    ctx.lineTo(wfx + 7, wfTop);
    ctx.lineTo(wfx + 15, wfTop + wfLen);
    ctx.lineTo(wfx - 15, wfTop + wfLen);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.35 + i * 0.2) % 1);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(wfx - 5 + Math.sin(i * 2 + t) * 3, wfTop + p * wfLen, 3, 16 * (1 - p * 0.5));
    }
    ctx.restore();
  }

  birdFlocks(ctx, W, H, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(38,62,92,0.55)';
    ctx.lineWidth = Math.max(1, W / 1300);
    for (const f of this.birds) {
      const span = W + 300;
      const bx = ((f.x * span + t * f.v * W) % span) - 150;
      for (let i = 0; i < f.n; i++) {
        const x = bx + i * 26 * f.s;
        const y = f.y * H + Math.sin(t * 0.7 + i + f.seed) * 10 + i * 7 * f.s;
        const w = 7 * f.s;
        const flap = Math.sin(t * 6 + i * 1.3 + f.seed) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.moveTo(x - w, y + flap * 3);
        ctx.quadraticCurveTo(x, y - w * 0.5, x + w, y + flap * 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------- valley + water
  valley(ctx, W, H, horizon, t) {
    const gy = horizon + H * 0.02;

    // far meadow plate
    ctx.beginPath();
    ctx.moveTo(-10, H);
    ctx.lineTo(-10, gy + H * 0.02);
    ctx.quadraticCurveTo(W * 0.3, gy - H * 0.025, W * 0.62, gy + H * 0.012);
    ctx.quadraticCurveTo(W * 0.85, gy + H * 0.04, W + 10, gy - H * 0.005);
    ctx.lineTo(W + 10, H);
    ctx.closePath();
    const mg = ctx.createLinearGradient(0, gy, 0, H * 0.86);
    mg.addColorStop(0, '#a8db8d');
    mg.addColorStop(0.35, '#74bd68');
    mg.addColorStop(1, '#3f8c4c');
    ctx.fillStyle = mg; ctx.fill();
    // dappled field patches so the meadow is not one flat slab
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 16; i++) {
      const f = Math.abs(Math.sin(i * 7.3) );
      const f2 = Math.abs(Math.sin(i * 3.1 + 1.7));
      const px = (f * 1.15 - 0.05) * W;
      const py = gy + f2 * H * 0.22;
      ctx.globalAlpha = 0.16 + f2 * 0.12;
      ctx.fillStyle = i % 3 === 0 ? '#c3e79c' : i % 3 === 1 ? '#5aa85c' : '#8ccf79';
      ctx.beginPath();
      ctx.ellipse(px, py, W * (0.06 + f * 0.09), H * (0.012 + f2 * 0.022), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // hedgerow shadows anchoring the tree line
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#1d5233';
    for (let i = 0; i < 9; i++) {
      const px = (i / 9 + 0.03) * W;
      ctx.beginPath();
      ctx.ellipse(px, gy + H * 0.055, W * 0.07, H * 0.012, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // lake
    const lakeTop = gy + H * 0.115;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(W * 0.085, lakeTop + H * 0.02);
    ctx.bezierCurveTo(W * 0.24, lakeTop - H * 0.02, W * 0.44, lakeTop + H * 0.005, W * 0.56, lakeTop + H * 0.05);
    ctx.bezierCurveTo(W * 0.66, lakeTop + H * 0.10, W * 0.58, H * 0.90, W * 0.44, H + 10);
    ctx.lineTo(W * 0.02, H + 10);
    ctx.closePath();
    const lg = ctx.createLinearGradient(0, lakeTop, 0, H);
    lg.addColorStop(0, '#9fe0f5');
    lg.addColorStop(0.35, '#4fb0e0');
    lg.addColorStop(1, '#1f6ba8');
    ctx.fillStyle = lg; ctx.fill();
    ctx.clip();

    // pale shallows along the shoreline
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#d9f5ff';
    ctx.lineWidth = Math.max(4, H * 0.012);
    ctx.beginPath();
    ctx.moveTo(W * 0.085, lakeTop + H * 0.02);
    ctx.bezierCurveTo(W * 0.24, lakeTop - H * 0.02, W * 0.44, lakeTop + H * 0.005, W * 0.56, lakeTop + H * 0.05);
    ctx.stroke();
    ctx.restore();

    // sun glitter + flowing ripples
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < 16; i++) {
      const y = lakeTop + ((i * H * 0.035 + t * 14) % (H - lakeTop));
      const amp = 2 + (y - lakeTop) * 0.02;
      ctx.lineWidth = 1 + (y - lakeTop) / H * 3;
      ctx.beginPath();
      for (let x = 0; x <= W * 0.62; x += 18) {
        const oy = Math.sin(x * 0.02 + t * 1.6 + i) * amp;
        if (x === 0) ctx.moveTo(x, y + oy); else ctx.lineTo(x, y + oy);
      }
      ctx.stroke();
    }
    // warm reflection column under the sun
    ctx.globalAlpha = 0.28;
    const refl = ctx.createLinearGradient(0, lakeTop, 0, H);
    refl.addColorStop(0, 'rgba(255,240,190,0.9)');
    refl.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = refl;
    ctx.fillRect(W * 0.30, lakeTop, W * 0.18, H);
    ctx.restore();

    // reeds + low mist along the near shore
    ctx.save();
    const rngSeed = (i) => Math.sin(i * 12.9898) * 43758.5453 % 1;
    ctx.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      const f = Math.abs(rngSeed(i));
      const x = W * (0.02 + f * 0.46);
      const y = this.ledgeAt(0.02 + f * 0.46, W, H) + H * 0.004 - Math.abs(rngSeed(i + 40)) * H * 0.035;
      const h = H * (0.016 + Math.abs(rngSeed(i + 90)) * 0.026);
      const sway = Math.sin(t * 1.5 + i) * h * 0.18;
      ctx.strokeStyle = i % 3 === 0 ? '#2b6b4a' : '#35805a';
      ctx.lineWidth = Math.max(1.6, h * 0.09);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway * 0.4, y - h * 0.6, x + sway, y - h);
      ctx.stroke();
      if (i % 4 === 0) {
        ctx.fillStyle = '#6b4a2c';
        ctx.beginPath();
        ctx.ellipse(x + sway, y - h - h * 0.06, h * 0.045, h * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.03 + i * 0.2) % 1);
      const mx = (p * 1.25 - 0.15) * W * 0.7;
      const my = lakeTop + H * (0.05 + (i % 3) * 0.05);
      const mg2 = ctx.createRadialGradient(mx, my, 0, mx, my, W * 0.16);
      mg2.addColorStop(0, 'rgba(226,244,255,0.20)');
      mg2.addColorStop(1, 'rgba(226,244,255,0)');
      ctx.fillStyle = mg2;
      ctx.beginPath(); ctx.ellipse(mx, my, W * 0.16, H * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // river spilling out of the eastern hills into the lake
    ctx.save();
    const riverPath = (widen) => {
      ctx.beginPath();
      ctx.moveTo(W * 0.86, gy + H * 0.012 - widen * 0.4);
      ctx.bezierCurveTo(W * 0.78, gy + H * 0.05, W * 0.74, gy + H * 0.075, W * 0.655, gy + H * 0.10);
      ctx.bezierCurveTo(W * 0.60, gy + H * 0.115, W * 0.57, gy + H * 0.13, W * 0.535, gy + H * 0.165);
      ctx.lineTo(W * 0.535 - widen * 1.5, gy + H * 0.165);
      ctx.bezierCurveTo(W * 0.575 - widen, gy + H * 0.125, W * 0.61 - widen, gy + H * 0.108, W * 0.66 - widen * 0.8, gy + H * 0.092);
      ctx.bezierCurveTo(W * 0.75 - widen * 0.5, gy + H * 0.066, W * 0.79 - widen * 0.4, gy + H * 0.04, W * 0.86, gy + H * 0.012 + widen * 0.4);
      ctx.closePath();
    };
    riverPath(H * 0.030);
    const rvg = ctx.createLinearGradient(W * 0.86, gy, W * 0.52, gy + H * 0.17);
    rvg.addColorStop(0, '#a6e4f6');
    rvg.addColorStop(1, '#4fb0e0');
    ctx.fillStyle = rvg; ctx.fill();
    ctx.clip();
    ctx.globalAlpha = 0.45; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.4, H * 0.002);
    for (let i = 0; i < 8; i++) {
      const o = ((t * 0.12 + i * 0.13) % 1);
      ctx.beginPath();
      ctx.moveTo(W * (0.86 - o * 0.34), gy + H * (0.012 + o * 0.15));
      ctx.lineTo(W * (0.845 - o * 0.34), gy + H * (0.03 + o * 0.15));
      ctx.stroke();
    }
    ctx.restore();

    // winding path on the right meadow
    ctx.save();
    ctx.strokeStyle = 'rgba(226,206,160,0.85)';
    ctx.lineWidth = Math.max(3, W * 0.006);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(W * 0.985, gy + H * 0.055);
    ctx.bezierCurveTo(W * 0.86, gy + H * 0.07, W * 0.83, gy + H * 0.13, W * 0.72, gy + H * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  villageRow(ctx, W, H) {
    const s = Math.min(W / 1600, H / 900);
    for (const v of this.village) {
      cottage(ctx, v.x * W, v.y * H, 1.0 * v.s * s, v.roof, v.lit);
    }
    // little bridge over the lake inlet
    ctx.save();
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(W * 0.175, H * 0.688);
    ctx.quadraticCurveTo(W * 0.215, H * 0.664, W * 0.255, H * 0.688);
    ctx.stroke();
    ctx.lineWidth = 1.6 * s;
    for (let i = 0; i <= 4; i++) {
      const p = i / 4;
      const x = W * (0.175 + p * 0.08);
      const y = H * (0.688 - Math.sin(p * Math.PI) * 0.024);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + H * 0.012); ctx.stroke();
    }
    ctx.restore();
  }

  forestBands(ctx, W, H, t) {
    const rows = [
      { y: 0.600, veil: 0.30 },
      { y: 0.650, veil: 0.20 },
      { y: 0.708, veil: 0.11 },
      { y: 0.778, veil: 0.00 },
    ];
    const s = Math.min(W / 1600, H / 900);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (const f of this.forest) {
        if (f.row !== r) continue;
        const x = (f.x + f.jitter) * W;
        const y = (row.y + f.jitter * 0.4) * H;
        // keep the lake and the village clear
        if (f.row >= 1 && x < W * 0.62 && y > H * 0.66) continue;
        if (f.row === 0 && x > W * 0.2 && x < W * 0.46) continue;
        tree(ctx, x, y, f.s * s * 2.1, t, f.seed, f.kind);
      }
      // aerial perspective: veil everything drawn so far before the next band
      if (row.veil > 0) {
        const top = (row.y - 0.30) * H, bot = (row.y + 0.05) * H;
        const v = ctx.createLinearGradient(0, top, 0, bot);
        v.addColorStop(0, 'rgba(206,232,252,0)');
        v.addColorStop(0.55, `rgba(206,232,252,${row.veil})`);
        v.addColorStop(1, `rgba(214,238,253,${row.veil * 0.25})`);
        ctx.fillStyle = v;
        ctx.fillRect(0, top, W, bot - top);
      }
    }
  }

  // --------------------------------------------------------- hero ground
  /** Height of the foreground ledge at normalised x (rises towards the right). */
  ledgeAt(xn, W, H) {
    const p = clamp01(xn);
    const e = p * p * (3 - 2 * p);                 // smoothstep
    return H * (0.945 - 0.235 * e) - Math.sin(p * Math.PI * 1.7) * H * 0.022;
  }

  heroLedge(ctx, W, H, t) {
    const L = (xn) => this.ledgeAt(xn, W, H);
    const edge = (fn) => {
      ctx.beginPath();
      ctx.moveTo(-10, H + 12);
      ctx.lineTo(-10, L(0));
      for (let xn = 0; xn <= 1.001; xn += 0.02) ctx.lineTo(xn * W, fn(xn));
      ctx.lineTo(W + 10, H + 12);
      ctx.closePath();
    };

    // main grassy shelf
    ctx.save();
    edge(L);
    const gg = ctx.createLinearGradient(0, H * 0.62, 0, H);
    gg.addColorStop(0, '#7fd06d');
    gg.addColorStop(0.22, '#4f9e50');
    gg.addColorStop(0.62, '#2f7444');
    gg.addColorStop(1, '#1b4a33');
    ctx.fillStyle = gg; ctx.fill();
    ctx.clip();
    // sun-dappled patches across the shelf
    for (let i = 0; i < 14; i++) {
      const f = Math.abs(Math.sin(i * 5.7)), f2 = Math.abs(Math.sin(i * 2.9 + 0.8));
      ctx.globalAlpha = 0.10 + f2 * 0.12;
      ctx.fillStyle = i % 2 ? '#a9e58a' : '#1d5638';
      ctx.beginPath();
      ctx.ellipse((f * 1.2 - 0.1) * W, H * (0.78 + f2 * 0.24), W * (0.07 + f * 0.1), H * (0.02 + f2 * 0.03), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // bright rim along the lip
    ctx.save();
    ctx.beginPath();
    for (let xn = 0; xn <= 1.001; xn += 0.02) {
      const x = xn * W, y = L(xn);
      if (xn === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#cdf3a6';
    ctx.lineWidth = Math.max(7, H * 0.016);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,246,205,0.7)';
    ctx.lineWidth = Math.max(1.4, H * 0.002);
    ctx.stroke();
    ctx.restore();

    // big outcrop on the right that Emberu perches on
    const oX = W * 0.905, oY = L(0.905) + H * 0.012;
    outcrop(ctx, oX, oY, Math.min(W / 1600, H / 900) * 120);
    // smaller boulder pair mid-right
    outcrop(ctx, W * 0.735, L(0.735) + H * 0.05, Math.min(W / 1600, H / 900) * 46);

    // clutter riding the ledge curve
    const s = Math.min(W / 1600, H / 900);
    for (const r of this.rocks) {
      if (r.x < 0.22) continue;
      stone(ctx, r.x * W, L(r.x) + r.yo * (H - L(r.x)) * 0.8, r.s * s * 15, r.seed);
    }
    ctx.lineCap = 'round';
    for (const g of this.tufts) {
      if (g.x < 0.16) continue;
      const x = g.x * W;
      const base = L(g.x);
      const y = base + g.yo * (H + 20 - base) * 0.92;
      const depth = (y - base) / Math.max(1, H - base);      // 0 at lip, 1 at camera
      const h = g.h * s * (0.55 + depth * 1.5);
      const sway = Math.sin(t * 1.7 + g.seed) * h * 0.22;
      ctx.strokeStyle = g.tone < 0.4 ? '#1f5e38' : g.tone < 0.75 ? '#35803f' : '#63b35c';
      ctx.lineWidth = Math.max(1.4, h * 0.13);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway * 0.5, y - h * 0.6, x + sway, y - h);
      ctx.stroke();
    }
    for (const f of this.flowers) {
      if (f.x < 0.2) continue;
      const x = f.x * W;
      const base = L(f.x);
      const y = base + f.yo * (H + 10 - base) * 0.9;
      const depth = (y - base) / Math.max(1, H - base);
      const sc = f.s * s * (0.7 + depth * 1.1);
      const sway = Math.sin(t * 1.9 + f.seed) * 2.5 * sc;
      ctx.strokeStyle = '#2f7444'; ctx.lineWidth = 1.6 * sc;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway * 0.6, y - 7 * sc, x + sway, y - 13 * sc); ctx.stroke();
      ctx.fillStyle = f.c;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + f.seed;
        ctx.beginPath();
        ctx.ellipse(x + sway + Math.cos(a) * 3.1 * sc, y - 13 * sc + Math.sin(a) * 3.1 * sc, 2.3 * sc, 2.3 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(x + sway, y - 13 * sc, 1.7 * sc, 0, Math.PI * 2); ctx.fill();
    }
  }

  cast(ctx, W, H, t) {
    const scale = Math.min(1.25, Math.max(0.6, W / 1500));
    // on narrower screens the menu column eats more of the frame, so nudge the
    // cast towards the right edge to keep every face clear of the UI
    const shift = W < 1480 ? Math.min(0.045, (1480 - W) * 0.00007) : 0;
    for (const a of this.actors) {
      const x = (a.x + shift) * W;
      const y = a.fly ? a.y * H : this.ledgeAt(a.x, W, H) + a.drop * H;
      const fly = a.fly ? Math.sin(t * 2 + a.phase) * H * 0.016 : 0;
      const size = a.size * scale;
      ctx.save();
      // soft darkening behind the actor lifts it off same-coloured foliage
      const sh = ctx.createRadialGradient(x, y - size * 0.34, 2, x, y - size * 0.34, size * 0.8);
      sh.addColorStop(0, 'rgba(8,26,20,0.30)');
      sh.addColorStop(0.65, 'rgba(8,26,20,0.14)');
      sh.addColorStop(1, 'rgba(8,26,20,0)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(x, y - size * 0.34 + fly, size * 0.8, 0, Math.PI * 2); ctx.fill();
      // then a warm key-light bloom so it reads as lit by the same sun
      const gl = ctx.createRadialGradient(x, y - size * 0.3, 2, x, y - size * 0.3, size * 0.95);
      gl.addColorStop(0, 'rgba(255,238,190,0.30)');
      gl.addColorStop(1, 'rgba(255,238,190,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(x, y - size * 0.3 + fly, size * 0.95, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      drawCreature(ctx, {
        speciesId: a.species, stage: 0, mutation: 'none',
        x, y: y + fly, size, t: t + a.phase, facing: a.facing,
        pose: { expression: a.expression || 'happy' },
      });
    }
  }

  // --------------------------------------------------------- framing art
  framingFoliage(ctx, W, H, t) {
    const s = Math.min(W / 1600, H / 900);
    // canopy hanging into the top-right corner
    ctx.save();
    ctx.translate(W * 1.02, -H * 0.06);
    const sway = Math.sin(t * 0.8) * 0.02;
    ctx.rotate(sway);
    ctx.fillStyle = '#1f5c34';
    branchCanopy(ctx, s * 1.25, t, '#27713d', '#378f4a');
    ctx.restore();
    // smaller canopy top-left, kept dark and simple behind the logo
    ctx.save();
    ctx.translate(-W * 0.03, -H * 0.10);
    ctx.rotate(Math.PI - Math.sin(t * 0.7) * 0.02);
    ctx.globalAlpha = 0.85;
    branchCanopy(ctx, s * 0.95, t + 2, '#1d5732', '#2a6d3c');
    ctx.restore();

    // out-of-focus grass blades along the very bottom
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * W + Math.sin(i * 3.1) * 14;
      const h = (44 + Math.sin(i * 2.2) * 26) * s;
      const sway2 = Math.sin(t * 1.4 + i) * 7 * s;
      ctx.strokeStyle = i % 3 === 0 ? '#1d5732' : '#265f37';
      ctx.lineWidth = (6 + (i % 3) * 2) * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, H + 6);
      ctx.quadraticCurveTo(x + sway2 * 0.5, H - h * 0.55, x + sway2, H - h);
      ctx.stroke();
    }
    ctx.restore();
  }

  godRays(ctx, W, H, sunX, sunY, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const a = -0.95 + i * 0.13 + Math.sin(t * 0.25 + i) * 0.012;
      const len = H * 1.35;
      const wdt = (26 + i * 9) * (W / 1600);
      ctx.save();
      ctx.translate(sunX, sunY);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(255,243,200,${0.075 + 0.035 * Math.sin(t * 0.6 + i)})`);
      g.addColorStop(1, 'rgba(255,243,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-wdt * 0.25, 0);
      ctx.lineTo(wdt * 0.25, 0);
      ctx.lineTo(wdt, len);
      ctx.lineTo(-wdt, len);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  moteField(ctx, W, H, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const x = ((m.x + t * m.v) % 1.1) * W - W * 0.05;
      const y = ((m.y - t * m.v * 0.35 + 1) % 1) * H + Math.sin(t * m.drift + m.seed) * H * 0.02;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + m.seed));
      ctx.globalAlpha = 0.5 * tw;
      ctx.fillStyle = m.warm ? '#fff3c0' : '#d6fff0';
      const r = m.s * Math.min(W / 1600, H / 900);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (m.s > 2) {
        ctx.globalAlpha = 0.25 * tw;
        ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  grade(ctx, W, H) {
    // warm highlight from the sun side
    const warm = ctx.createLinearGradient(W, 0, W * 0.35, H);
    warm.addColorStop(0, 'rgba(255,214,150,0.20)');
    warm.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, H);

    // reading scrim behind the menu column (left third)
    const scrim = ctx.createLinearGradient(0, 0, W * 0.46, 0);
    scrim.addColorStop(0, 'rgba(8,22,44,0.46)');
    scrim.addColorStop(0.5, 'rgba(8,22,44,0.20)');
    scrim.addColorStop(1, 'rgba(8,22,44,0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W * 0.46, H);

    // top + bottom cinematic falloff
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    top.addColorStop(0, 'rgba(4,12,26,0.30)');
    top.addColorStop(1, 'rgba(4,12,26,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H * 0.3);
    const bot = ctx.createLinearGradient(0, H * 0.72, 0, H);
    bot.addColorStop(0, 'rgba(4,12,26,0)');
    bot.addColorStop(1, 'rgba(4,12,26,0.55)');
    ctx.fillStyle = bot;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    // vignette
    const vg = ctx.createRadialGradient(W * 0.58, H * 0.45, Math.min(W, H) * 0.46, W * 0.58, H * 0.5, Math.max(W, H) * 0.82);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(3,9,18,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}

// =============================================================================
// Primitives
// =============================================================================
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/** Chunky mossy rock the cast can perch on. */
function outcrop(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(12,36,26,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 4, s * 1.15, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(-s * 0.4, -s * 0.9, s * 0.6, s * 0.4);
  g.addColorStop(0, '#a7b2ba');
  g.addColorStop(0.5, '#77848f');
  g.addColorStop(1, '#4b5763');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s, s * 0.22);
  ctx.lineTo(-s * 0.82, -s * 0.36);
  ctx.lineTo(-s * 0.3, -s * 0.72);
  ctx.lineTo(s * 0.28, -s * 0.66);
  ctx.lineTo(s * 0.86, -s * 0.24);
  ctx.lineTo(s * 1.02, s * 0.2);
  ctx.closePath();
  ctx.fill();
  // lit top plane
  ctx.fillStyle = 'rgba(255,244,205,0.3)';
  ctx.beginPath();
  ctx.moveTo(-s * 0.78, -s * 0.34);
  ctx.lineTo(-s * 0.28, -s * 0.7);
  ctx.lineTo(s * 0.3, -s * 0.64);
  ctx.lineTo(s * 0.1, -s * 0.34);
  ctx.closePath();
  ctx.fill();
  // moss cap + tufts
  ctx.fillStyle = '#3f8c4c';
  ctx.beginPath();
  ctx.ellipse(-s * 0.2, -s * 0.62, s * 0.5, s * 0.14, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2f7444'; ctx.lineWidth = Math.max(1.2, s * 0.05); ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const bx = -s * 0.55 + i * s * 0.22;
    ctx.beginPath();
    ctx.moveTo(bx, -s * 0.62);
    ctx.quadraticCurveTo(bx + s * 0.05, -s * 0.82, bx + s * 0.13, -s * 0.92);
    ctx.stroke();
  }
  ctx.restore();
}

function puff(ctx, x, y, s, seed, t) {
  const drift = Math.sin(t * 0.3 + seed) * 3;
  const g = ctx.createLinearGradient(x, y - 34 * s, x, y + 22 * s);
  g.addColorStop(0, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.6, 'rgba(244,250,255,0.92)');
  g.addColorStop(1, 'rgba(206,226,245,0.78)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, 62 * s, 21 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 44 * s + drift, y - 11 * s, 42 * s, 20 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 46 * s - drift, y - 4 * s, 36 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 8 * s, y - 22 * s, 34 * s, 19 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 16 * s, y - 16 * s, 28 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function ridge(ctx, W, baseY, o) {
  const { peaks, H, colorTop, colorBottom, alpha, snow } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(-60, baseY + H * 0.2);
  for (let i = 0; i < peaks.length; i++) {
    const [px, ph] = peaks[i];
    const x = px * W;
    const y = baseY - ph * H;
    if (i === 0) ctx.lineTo(x, y);
    else {
      const [ppx, pph] = peaks[i - 1];
      const px0 = ppx * W, py0 = baseY - pph * H;
      const mx = (ppx + px) / 2 * W;
      const my = baseY - Math.min(pph, ph) * H * 0.38;
      // broken shoulder on the way down, then a rocky step back up
      ctx.lineTo(px0 + (mx - px0) * 0.42, py0 + (my - py0) * 0.30);
      ctx.lineTo(px0 + (mx - px0) * 0.56, py0 + (my - py0) * 0.52);
      ctx.lineTo(mx, my);
      ctx.lineTo(mx + (x - mx) * 0.38, my + (y - my) * 0.46);
      ctx.lineTo(mx + (x - mx) * 0.62, my + (y - my) * 0.30);
      ctx.lineTo(x, y);
    }
  }
  ctx.lineTo(W + 60, baseY + H * 0.2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, baseY - H * 0.26, 0, baseY + H * 0.06);
  g.addColorStop(0, colorTop);
  g.addColorStop(1, colorBottom);
  ctx.fillStyle = g;
  ctx.fill();

  // shaded rock faces: light from the right, shadow on the left flank
  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  for (let i = 0; i < peaks.length; i++) {
    const [px, ph] = peaks[i];
    if (ph < 0.06) continue;
    const x = px * W, y = baseY - ph * H;
    const foot = ph * H * 1.15;
    ctx.fillStyle = 'rgba(28,54,92,0.35)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - foot * 0.5, baseY + H * 0.01);
    ctx.lineTo(x - foot * 0.12, baseY + H * 0.01);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,205,0.22)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + foot * 0.42, baseY + H * 0.01);
    ctx.lineTo(x + foot * 0.1, baseY + H * 0.01);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // snow caps
  if (snow > 0) {
    ctx.fillStyle = `rgba(255,255,255,${snow})`;
    for (const [px, ph] of peaks) {
      if (ph < 0.09) continue;
      const x = px * W, y = baseY - ph * H;
      const w = ph * H * 0.42;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + w * 0.8);
      ctx.lineTo(x + w * 0.45, y + w * 0.62);
      ctx.lineTo(x + w * 0.16, y + w * 0.95);
      ctx.lineTo(x - w * 0.3, y + w * 0.55);
      ctx.lineTo(x - w, y + w * 0.8);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function cottage(ctx, x, y, s, roofColor, lit) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(30,60,40,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 1, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2e6cf';
  ctx.fillRect(-10, -14, 20, 14);
  ctx.fillStyle = 'rgba(120,100,80,0.22)';
  ctx.fillRect(4, -14, 6, 14);
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(-13, -13);
  ctx.lineTo(0, -25);
  ctx.lineTo(13, -13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.moveTo(2, -19.5); ctx.lineTo(13, -13); ctx.lineTo(2, -13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lit ? '#ffd984' : '#6d8199';
  ctx.fillRect(-6, -10, 5, 5);
  ctx.fillStyle = '#7a5433';
  ctx.fillRect(1, -8, 5, 8);
  ctx.restore();
}

function tree(ctx, x, y, s, t, seed, kind) {
  const sway = Math.sin(t * 1.1 + seed) * 0.035;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(sway);
  ctx.fillStyle = 'rgba(24,52,36,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 1.5, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a2c';
  ctx.fillRect(-2.4, -18, 4.8, 18);
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const w = 15 - i * 3.4, yy = -16 - i * 11;
      ctx.fillStyle = ['#2f7a45', '#358a4c', '#3f9c55'][i];
      ctx.beginPath();
      ctx.moveTo(-w, yy); ctx.lineTo(0, yy - 17); ctx.lineTo(w, yy);
      ctx.closePath(); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#2d7a40';
    ctx.beginPath(); ctx.arc(-9, -24, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -23, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b9450';
    ctx.beginPath(); ctx.arc(0, -33, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#54b061';
    ctx.beginPath(); ctx.arc(-5, -31, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(190,240,170,0.5)';
    ctx.beginPath(); ctx.arc(5, -38, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function stone(ctx, x, y, s, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20,40,30,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 1, s * 0.95, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(0, -s, 0, s * 0.4);
  g.addColorStop(0, '#9aa7ae');
  g.addColorStop(1, '#5d6a73');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(-s * 0.75, -s * 0.85, -s * 0.1, -s * 0.78);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.7, s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,245,210,0.28)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.2, -s * 0.52, s * 0.42, s * 0.16, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // moss
  ctx.fillStyle = 'rgba(86,160,80,0.65)';
  ctx.beginPath(); ctx.ellipse(s * 0.35, -s * 0.1, s * 0.32, s * 0.12, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Leafy branch sweeping in from a screen corner; used to frame the shot. */
function branchCanopy(ctx, s, t, darkC, litC) {
  ctx.save();
  ctx.scale(s, s);
  ctx.strokeStyle = '#3f2c1c';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(60, -40);
  ctx.quadraticCurveTo(-40, 30, -230, 90);
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-60, 46); ctx.quadraticCurveTo(-110, 96, -150, 178); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-150, 70); ctx.quadraticCurveTo(-200, 120, -252, 148); ctx.stroke();

  const clump = (cx, cy, r, c) => {
    ctx.fillStyle = c;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + cx * 0.01;
      const wob = Math.sin(t * 1.2 + i + cx * 0.02) * r * 0.06;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r * 0.7 + wob, cy + Math.sin(a) * r * 0.5, r * 0.62, r * 0.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  clump(30, -18, 74, darkC);
  clump(-70, 26, 84, darkC);
  clump(-180, 78, 70, darkC);
  clump(-150, 176, 52, darkC);
  clump(-244, 140, 46, darkC);
  clump(10, 8, 52, litC);
  clump(-96, 54, 58, litC);
  clump(-176, 96, 44, litC);
  ctx.restore();
}
