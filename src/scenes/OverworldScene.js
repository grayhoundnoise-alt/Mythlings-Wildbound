// Exploration scene: movement, camera, roaming wild Mythlings, NPCs, trainers,
// interaction prompts and map transitions.
import { getMap, regionAt } from '../data/maps.js';
import { GameState, PlayerManager, WorldManager, InventoryManager, CollectionManager, bus } from '../systems/GameState.js';
import { EncounterManager } from '../systems/EncounterManager.js';
import { WorldRenderer, drawTrainerAvatar, roundRect } from '../render/worldRenderer.js';
import { drawMythling } from '../render/creatures.js';
import { displayName, speciesOf } from '../core/mythling.js';
import { getSpecies } from '../data/species.js';
import { clamp, dist, rectsOverlap, randInt } from '../core/utils.js';
import { AudioManager } from '../systems/AudioManager.js';

const PLAYER_SPEED = 230;
const INTERACT_RANGE = 74;
const MAX_WILD = 9;

export class OverworldScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = new WorldRenderer();
    this.time = 0;
    this.keys = new Set();
    this.wild = [];
    this.spawnTimer = 0;
    this.player = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, moving: false, anim: 0 };
    this.mapId = null;
    this.cam = { x: 0, y: 0, w: 0, h: 0 };
    this.paused = false;
    this.nearest = null;
    this.transitioning = false;
    this.toast = null;
    this.stepSfx = 0;
  }

  enter(mapId, x, y) {
    this.mapId = mapId || GameState.player.map;
    const map = getMap(this.mapId);
    this.player.x = x ?? GameState.player.x ?? map.spawn.x;
    this.player.y = y ?? GameState.player.y ?? map.spawn.y;
    this.wild = [];
    this.spawnTimer = 0;
    this.transitioning = false;
    WorldManager.visit(this.mapId);
    PlayerManager.setPosition(this.mapId, this.player.x, this.player.y);
    this.populate(true);
    bus.emit('overworld:map', map);
  }

  get map() { return getMap(this.mapId); }

  // ------------- wild population -------------
  populate(initial = false) {
    const map = this.map;
    const target = Math.min(MAX_WILD, map.encounterZones.length * 3);
    let guard = 0;
    while (this.wild.length < target && guard++ < 40) {
      const zone = map.encounterZones[randInt(Math.random, 0, map.encounterZones.length - 1)];
      const [zx, zy, zw, zh] = zone.rect;
      const x = zx + Math.random() * zw;
      const y = zy + Math.random() * zh;
      if (!initial && dist(x, y, this.player.x, this.player.y) < 420) continue;
      const m = EncounterManager.spawnForZone(zone, map.id, Math.random, { partyLevel: PartyManager.topLevel() });
      this.wild.push({
        m, x, y, zone,
        hx: x, hy: y,
        vx: 0, vy: 0, moving: false,
        t: Math.random() * 10,
        facing: Math.random() < 0.5 ? 1 : -1,
        seen: false,
      });
    }
  }

  despawnFar() {
    this.wild = this.wild.filter((w) => dist(w.x, w.y, this.player.x, this.player.y) < 2000);
  }

  // ------------- input -------------
  onKeyDown(e) {
    this.keys.add(e.key.toLowerCase());
  }

  onKeyUp(e) {
    this.keys.delete(e.key.toLowerCase());
  }

  clearKeys() { this.keys.clear(); }

  // ------------- update -------------
  update(dt) {
    this.time += dt;
    if (this.paused || this.transitioning) return;
    const map = this.map;

    let dx = 0, dy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
    if (this.joy) { dx += this.joy.x; dy += this.joy.y; }
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }
    this.player.moving = len > 0.01;
    if (dx !== 0) this.player.facing = dx > 0 ? 1 : -1;

    const speed = PLAYER_SPEED * (this.keys.has('shift') ? 1.5 : 1);
    const nx = this.player.x + dx * speed * dt;
    const ny = this.player.y + dy * speed * dt;
    this.tryMove(nx, ny);

    if (this.player.moving) {
      this.player.anim += dt * 10;
      this.stepSfx -= dt;
      if (this.stepSfx <= 0) { this.stepSfx = 0.34; AudioManager.sfx('step'); }
    }

    PlayerManager.setPosition(this.mapId, this.player.x, this.player.y);

    // wild wander
    for (const w of this.wild) {
      w.t += dt;
      if (w.t > 2.4) {
        w.t = 0;
        const a = Math.random() * Math.PI * 2;
        w.vx = Math.cos(a) * 28;
        w.vy = Math.sin(a) * 22;
        if (w.vx !== 0) w.facing = w.vx > 0 ? 1 : -1;
      }
      w.moving = Math.hypot(w.vx, w.vy) > 6;
      const tx = w.x + w.vx * dt, ty = w.y + w.vy * dt;
      const [zx, zy, zw, zh] = w.zone.rect;
      w.x = clamp(tx, zx, zx + zw);
      w.y = clamp(ty, zy, zy + zh);
      if (!w.seen && dist(w.x, w.y, this.player.x, this.player.y) < 300) {
        w.seen = true;
        CollectionManager.markSeen(w.m.speciesId, w.m.mutation);
      }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = 4; this.despawnFar(); this.populate(); }

    this.nearest = this.findInteractable();

    // map transitions
    for (const conn of map.connections || []) {
      const [cx, cy, cw, ch] = conn.rect;
      if (rectsOverlap({ x: this.player.x - 14, y: this.player.y - 14, w: 28, h: 28 }, { x: cx, y: cy, w: cw, h: ch })) {
        const locked = conn.requiresItem && !InventoryManager.has(conn.requiresItem, 1);
        if (locked) {
          this.showToast(conn.lockedText || 'The way is blocked.');
          // push the player back out of the gate
          this.player.x -= (this.player.x - (cx + cw / 2)) > 0 ? -24 : 24;
        } else {
          this.transitioning = true;
          bus.emit('overworld:transition', { toMap: conn.toMap, toPoint: conn.toPoint });
        }
      }
    }

    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
  }

  tryMove(nx, ny) {
    const map = this.map;
    const r = 15;
    const colliders = this.renderer.colliders(map);
    const test = (x, y) => {
      if (x < r + 10 || x > map.width - r - 10 || y < r + 40 || y > map.height - r - 10) return false;
      const box = { x: x - r, y: y - r * 0.6, w: r * 2, h: r * 1.2 };
      for (const c of colliders) if (rectsOverlap(box, c)) return false;
      for (const w of map.water) {
        if (rectsOverlap(box, w)) {
          const onBridge = (map.bridges || []).some((b) => rectsOverlap(box, b));
          if (!onBridge) return false;
        }
      }
      return true;
    };
    if (test(nx, this.player.y)) this.player.x = nx;
    if (test(this.player.x, ny)) this.player.y = ny;
  }

  findInteractable() {
    const map = this.map;
    const px = this.player.x, py = this.player.y;
    let best = null, bestD = INTERACT_RANGE;

    for (const w of this.wild) {
      const d = dist(px, py, w.x, w.y);
      if (d < bestD) { bestD = d; best = { kind: 'wild', ref: w, label: `Battle wild ${displayName(w.m)} Lv.${w.m.level}` }; }
    }
    for (const t of map.trainers) {
      if (WorldManager.isTrainerDefeated(t.flag)) continue;
      const d = dist(px, py, t.x, t.y);
      if (d < bestD) { bestD = d; best = { kind: 'trainer', ref: t, label: `Challenge ${t.name}` }; }
    }
    for (const n of map.npcs) {
      const d = dist(px, py, n.x, n.y);
      if (d < bestD) { bestD = d; best = { kind: 'npc', ref: n, label: `Talk to ${n.name}` }; }
    }
    for (const b of map.buildings) {
      const cx = b.x + b.w / 2, cy = b.y + b.h + 10;
      const d = dist(px, py, cx, cy);
      if (d < bestD + 24) {
        if (b.type === 'center') { bestD = d; best = { kind: 'center', ref: b, label: 'Enter Mythling Center' }; }
        else if (b.type === 'shop') { bestD = d; best = { kind: 'shop', ref: b, label: `Shop: ${b.name}` }; }
      }
    }
    for (const lm of map.landmarks || []) {
      if (lm.type !== 'sign') continue;
      const d = dist(px, py, lm.x, lm.y);
      if (d < bestD) { bestD = d; best = { kind: 'sign', ref: lm, label: 'Read sign' }; }
    }
    // defeated trainers can still be talked to
    if (!best) {
      for (const t of map.trainers) {
        if (!WorldManager.isTrainerDefeated(t.flag)) continue;
        const d = dist(px, py, t.x, t.y);
        if (d < bestD) { bestD = d; best = { kind: 'npc', ref: { name: t.name, dialogue: [t.defeat], color: t.color }, label: `Talk to ${t.name}` }; }
      }
    }
    return best;
  }

  interact() {
    if (!this.nearest || this.paused || this.transitioning) return;
    const n = this.nearest;
    AudioManager.sfx('click');
    if (n.kind === 'wild') {
      this.wild = this.wild.filter((w) => w !== n.ref);
      bus.emit('overworld:wild', n.ref.m);
    } else if (n.kind === 'trainer') {
      bus.emit('overworld:trainer', n.ref);
    } else if (n.kind === 'npc') {
      bus.emit('overworld:npc', n.ref);
    } else if (n.kind === 'center') {
      bus.emit('overworld:center', n.ref);
    } else if (n.kind === 'shop') {
      bus.emit('overworld:shop', n.ref);
    } else if (n.kind === 'sign') {
      bus.emit('overworld:sign', n.ref);
    }
  }

  showToast(text) {
    if (this.toast && this.toast.text === text) return;
    this.toast = { text, t: 3 };
  }

  // ------------- render -------------
  render() {
    const ctx = this.ctx;
    const map = this.map;
    const W = this.canvas.width, H = this.canvas.height;
    const dpr = this.dpr || 1;
    const vw = W / dpr, vh = H / dpr;

    const zoom = clamp(Math.min(vw / 1180, vh / 720) * 1.35, 0.72, 1.6);
    const camW = vw / zoom, camH = vh / zoom;
    this.cam.x = clamp(this.player.x - camW / 2, 0, Math.max(0, map.width - camW));
    this.cam.y = clamp(this.player.y - camH / 2, 0, Math.max(0, map.height - camH));
    this.cam.w = camW; this.cam.h = camH;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sky backdrop
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, map.ambient.sky[0]);
    g.addColorStop(1, map.ambient.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    ctx.scale(zoom, zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    this.renderer.drawGround(ctx, map, this.cam, this.time);
    this.renderer.drawWater(ctx, map, this.cam, this.time);

    for (const lm of map.landmarks || []) {
      if (lm.type === 'sign') continue;
      this.renderer.drawLandmark(ctx, lm, this.time);
    }
    for (const conn of map.connections || []) {
      const locked = conn.requiresItem && !InventoryManager.has(conn.requiresItem, 1);
      this.renderer.drawGateArch(ctx, conn, locked, this.time);
    }

    // encounter-zone tint
    ctx.save();
    ctx.globalAlpha = 0.09;
    for (const z of map.encounterZones) {
      ctx.fillStyle = '#2e6f3a';
      roundRect(ctx, z.rect[0], z.rect[1], z.rect[2], z.rect[3], 40);
      ctx.fill();
    }
    ctx.restore();

    // depth-sorted entity pass
    const drawables = [];
    for (const p of this.renderer.props(map)) {
      if (p.x < this.cam.x - 80 || p.x > this.cam.x + camW + 80) continue;
      drawables.push({ y: p.y, fn: () => this.renderer.drawProp(ctx, p, this.time) });
    }
    for (const b of map.buildings) drawables.push({ y: b.y + b.h, fn: () => this.renderer.drawBuilding(ctx, b, this.time) });
    for (const lm of (map.landmarks || []).filter((l) => l.type === 'sign')) {
      drawables.push({ y: lm.y, fn: () => this.renderer.drawLandmark(ctx, lm, this.time) });
    }
    for (const n of map.npcs) {
      drawables.push({ y: n.y, fn: () => {
        drawTrainerAvatar(ctx, n.x, n.y, n.color, this.time, { phase: n.x });
        this.nameTag(ctx, n.x, n.y - 62, n.name, '#cfe9ff');
      } });
    }
    for (const t of map.trainers) {
      const defeated = WorldManager.isTrainerDefeated(t.flag);
      drawables.push({ y: t.y, fn: () => {
        drawTrainerAvatar(ctx, t.x, t.y, t.color, this.time, { phase: t.y, cap: t.guardian ? '#ffd76a' : null });
        this.nameTag(ctx, t.x, t.y - 62, t.name, defeated ? '#9fdca8' : '#ffd0d0', null,
          { mark: defeated ? 'check' : 'battle' });
      } });
    }
    for (const w of this.wild) {
      if (w.x < this.cam.x - 120 || w.x > this.cam.x + camW + 120) continue;
      drawables.push({ y: w.y, fn: () => {
        drawMythling(ctx, {
          speciesId: w.m.speciesId, stage: w.m.stage, mutation: w.m.mutation,
          x: w.x, y: w.y, size: 62, t: this.time + w.hx * 0.01, facing: w.facing,
          animTag: 'wild', pose: { anim: w.moving ? 'walk' : 'idle' },
        });
        this.nameTag(ctx, w.x, w.y - 62, `${displayName(w.m)} Lv.${w.m.level}`, '#ffffff', w.m.mutation);
      } });
    }
    drawables.push({ y: this.player.y, fn: () => this.drawPlayer(ctx) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    this.renderer.drawAmbient(ctx, map, this.cam, this.time);
    this.renderer.drawOverlay(ctx, map, this.cam);

    // interaction prompt
    if (this.nearest) {
      const target = this.nearest.ref;
      const tx = target.x ?? this.player.x;
      const ty = (target.y ?? this.player.y) - 90;
      ctx.save();
      ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      const text = `[E] ${this.nearest.label}`;
      const tw = ctx.measureText(text).width + 22;
      ctx.fillStyle = 'rgba(12,20,32,0.85)';
      roundRect(ctx, tx - tw / 2, ty - 16, tw, 26, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(text, tx, ty + 2);
      ctx.restore();
    }

    ctx.restore();

    if (this.toast) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(this.toast.text).width + 40;
      ctx.globalAlpha = clamp(this.toast.t, 0, 1);
      ctx.fillStyle = 'rgba(20,10,10,0.88)';
      roundRect(ctx, vw / 2 - tw / 2, vh - 150, tw, 42, 12); ctx.fill();
      ctx.strokeStyle = '#ff8a8a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffd6d6';
      ctx.fillText(this.toast.text, vw / 2, vh - 123);
      ctx.restore();
    }
  }

  nameTag(ctx, x, y, text, color, mutation, opts = {}) {
    ctx.save();
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(text).width + 16 + (opts.mark ? 14 : 0);
    ctx.fillStyle = 'rgba(10,18,28,0.6)';
    roundRect(ctx, x - tw / 2, y - 12, tw, 18, 8); ctx.fill();
    if (mutation && mutation !== 'none') {
      ctx.strokeStyle = mutation === 'shiny' ? '#ffe680' : '#b07cff';
      ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x + (opts.mark ? 7 : 0), y + 1);
    if (opts.mark) drawTagMark(ctx, opts.mark, x - tw / 2 + 10, y - 3, color);
    ctx.restore();
  }

  drawPlayer(ctx) {
    const p = this.player;
    const bob = p.moving ? Math.abs(Math.sin(p.anim)) * 3 : Math.sin(this.time * 2) * 1.2;
    ctx.save();
    ctx.translate(p.x, p.y - bob);
    ctx.scale(p.facing, 1);
    ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.ellipse(0, 4 + bob, 15, 5.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#123'; ctx.fill();
    ctx.globalAlpha = 1;
    // legs
    const swing = p.moving ? Math.sin(p.anim) * 4 : 0;
    ctx.fillStyle = '#2f3d5c';
    ctx.fillRect(-8 + swing, -15, 6, 15);
    ctx.fillRect(2 - swing, -15, 6, 15);
    // body
    ctx.fillStyle = '#4fa3e8';
    roundRect(ctx, -12, -37, 24, 24, 8); ctx.fill();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -5, -34, 10, 16, 4); ctx.fill();
    // arms
    ctx.fillStyle = '#4fa3e8';
    roundRect(ctx, -18, -35 + swing, 7, 17, 3); ctx.fill();
    roundRect(ctx, 11, -35 - swing, 7, 17, 3); ctx.fill();
    // head
    ctx.fillStyle = '#f7d9b8';
    ctx.beginPath(); ctx.arc(0, -47, 11, 0, Math.PI * 2); ctx.fill();
    // cap
    ctx.fillStyle = '#e8574f';
    ctx.beginPath(); ctx.arc(0, -49, 11.5, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(0, -50, 17, 4.5);
    // face
    ctx.fillStyle = '#2a2a33';
    ctx.beginPath(); ctx.arc(-3.6, -45, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -45, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // name tag
    this.nameTag(ctx, p.x, p.y - 68, GameState.player.name, '#ffffff');
  }

  currentRegionName() {
    const map = this.map;
    const r = regionAt(map, this.player.x, this.player.y);
    return `${map.displayName} — ${r.name}`;
  }

  minimapData() {
    const map = this.map;
    return {
      w: map.width, h: map.height,
      px: this.player.x, py: this.player.y,
      zones: map.encounterZones.map((z) => z.rect),
      buildings: map.buildings.map((b) => [b.x, b.y, b.w, b.h]),
      wild: this.wild.map((w) => [w.x, w.y, getSpecies(w.m.speciesId).element]),
      conns: (map.connections || []).map((c) => c.rect),
    };
  }
}


/** Tiny vector marks for world name tags (no emoji fonts involved). */
function drawTagMark(ctx, kind, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  if (kind === 'check') {
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(-1, 3.4); ctx.lineTo(4.4, -3.6);
    ctx.stroke();
  } else { // crossed blades = an undefeated trainer
    ctx.beginPath();
    ctx.moveTo(-4, 4); ctx.lineTo(4, -4);
    ctx.moveTo(4, 4); ctx.lineTo(-4, -4);
    ctx.stroke();
  }
  ctx.restore();
}
