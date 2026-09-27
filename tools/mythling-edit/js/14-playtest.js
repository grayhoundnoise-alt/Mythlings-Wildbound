// =============================================================================
// Playtest: walk the map (collision, NPCs, warps, triggers, encounters) / creature arena
// =============================================================================
const Playtest = {
  keys: {},
  start(kind = 'map') {
    if (E.playtest) this.stop();
    if (kind === 'map' && !currentMap()) { toast('No map to playtest', 'warn'); return; }
    if (kind === 'creature' && !currentMythling()) { toast('No Mythling to playtest', 'warn'); return; }
    E.playing = false; VFXSystem.clear();
    const pt = { kind, t: 0, debug: false, msg: null, flags: {}, firedOnce: new Set(), encounterCooldown: 1.5, encounter: null, log: [], paused: false, shake: 0, fade: 0 };
    if (kind === 'map') {
      const map = currentMap();
      const spawn = allNodes(map).find((n) => n.type === 'spawn' && n.spawn.kind === 'player' && n.spawn.enabled) || allNodes(map).find((n) => n.type === 'spawn' && n.spawn.kind === 'player');
      const start = spawn ? worldPos(spawn, map) : map.spawn ? [map.spawn.x, map.spawn.y] : [map.width / 2, map.height / 2];
      pt.mapId = map.id; pt.player = { x: start[0], y: start[1], dir: spawn?.spawn.direction || 'down', speed: 190, r: 12, moving: false, step: 0, anim: 0 };
      pt.cam = { x: start[0], y: start[1], zoom: 1.25 };
      pt.mythlings = allNodes(map).filter((n) => n.type === 'mythling' && n.visible).map((n) => ({ node: n, x: n.x, y: n.y, ox: n.x, oy: n.y, vx: 0, vy: 0, t: Math.random() * 3, facingLeft: n.mythling.facing === 'left' }));
    } else {
      const my = currentMythling();
      pt.my = my; pt.creature = { x: 0, y: 0, vx: 0, facingLeft: false, anim: Screens.animByName(my, 'Idle'), animStart: 0, oneShot: null };
      pt.cam = { x: 120, y: -90, zoom: 1.6 };
    }
    E.playtest = pt; E.savedTool = E.tool;
    $('#app').classList.add('playtest');
    $('#playtest-hud').classList.remove('hidden');
    this.renderHud();
    this.msg(kind === 'map' ? 'PLAYTEST — WASD / arrows to walk · E or Enter to interact · Shift to run · Esc to exit' : 'CREATURE PLAYTEST — A/D walk · 1-9 play clips · Q/W/E/R skills · Space jump · Esc to exit', 4);
    UI.updateHeader(); UI.updateStatus(); UI.renderSubToolbar();
    Scene.canvas.focus(); Scene.resize(); Scene.startClock(); Scene.invalidate();
    ConsoleLog.info(`Playtest started (${kind})`);
  },
  stop() {
    if (!E.playtest) return;
    const wasMap = E.playtest.kind === 'map';
    E.playtest = null; this.keys = {};
    $('#app').classList.remove('playtest');
    $('#playtest-hud').classList.add('hidden'); $('#playtest-msg').classList.add('hidden');
    VFXSystem.clear();
    if (E.tool === 'playtest') E.tool = E.savedTool || 'select';
    UI.refreshAll(); Scene.resize();
    ConsoleLog.info(`Playtest ended${wasMap ? '' : ' (creature)'}`);
  },
  renderHud() {
    const pt = E.playtest; const hud = clear($('#playtest-hud'));
    hud.append(...[
      h('span', { class: 'mode-badge' }, [h('span', { class: 'dot' }), 'PLAYTEST MODE']),
      h('span', { class: 'hud-info', id: 'pt-info', text: '' }),
      h('span', { class: 'spacer' }),
      pt.kind === 'creature' ? h('select', { class: 'map-select', title: 'Caster Mythling', onchange: (e) => { E.mythlingId = e.target.value; this.start('creature'); } }, Object.values(E.project.mythlings).map((m) => h('option', { value: m.id, selected: m.id === E.mythlingId, text: m.name }))) : null,
      pt.kind === 'map' ? h('button', { class: 'btn small', text: 'RESPAWN', onclick: () => this.start('map') }) : null,
      h('button', { class: `btn small ${pt.debug ? 'primary' : ''}`, id: 'pt-debug', text: 'DEBUG', title: 'Toggle debug overlays (collision, zones, coordinates)', onclick: () => { pt.debug = !pt.debug; this.renderHud(); } }),
      h('button', { class: 'btn small danger', text: 'EXIT (Esc)', onclick: () => this.stop() }),
    ].filter(Boolean));
    if (pt.kind === 'creature') {
      const my = pt.my; const strip = h('div', { class: 'pt-strip' });
      my.animations.map((id) => E.project.animations[id]).filter(Boolean).forEach((a, i) => strip.appendChild(h('button', { class: 'btn tiny', text: `${i + 1 <= 9 ? i + 1 + ' ' : ''}${a.name}`, onclick: () => this.playClip(a) })));
      const skills = Object.values(E.project.skills).filter((s) => s.element === my.element || s.element === 'none').slice(0, 8);
      skills.forEach((s, i) => strip.appendChild(h('button', { class: 'btn tiny primary', text: `${['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I'][i]} ${s.name}`, onclick: () => this.castSkill(s) })));
      hud.appendChild(strip);
    }
  },
  msg(text, secs = 3, opts = {}) {
    const el = $('#playtest-msg'); el.classList.remove('hidden'); clear(el);
    el.appendChild(h('div', { class: `pt-dialog ${opts.kind || ''}` }, [opts.title ? h('div', { class: 'title', text: opts.title }) : null, h('div', { class: 'text', text }), opts.hint ? h('div', { class: 'hint', text: opts.hint }) : null]));
    if (E.playtest) E.playtest.msg = { until: secs > 0 ? E.playtest.t + secs : Infinity, sticky: !!opts.sticky };
  },
  clearMsg() { $('#playtest-msg').classList.add('hidden'); if (E.playtest) E.playtest.msg = null; },
  onKey(e, down) {
    const pt = E.playtest; if (!pt) return;
    const k = e.key.toLowerCase();
    if (down) {
      if (pt.dialogue) { if (['enter', 'e', ' '].includes(k)) { e.preventDefault(); this.advanceDialogue(); } return; }
      if (pt.encounter) { if (['enter', ' ', 'e', 'escape'].includes(k)) { e.preventDefault(); this.endEncounter(k === 'escape'); } return; }
      if (k === 'e' || k === 'enter') { if (pt.kind === 'map') this.interact(); else if (k === 'e') this.castSkill(this.skillFor(2)); e.preventDefault(); return; }
      if (k === 'f3' || k === '`') { pt.debug = !pt.debug; this.renderHud(); e.preventDefault(); return; }
      if (pt.kind === 'creature') {
        if (/^[1-9]$/.test(k)) { const a = E.project.animations[pt.my.animations[+k - 1]]; if (a) this.playClip(a); return; }
        const si = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i'].indexOf(k); if (si >= 0 && k !== 'w') { const s = this.skillFor(si); if (s) this.castSkill(s); return; }
        if (k === ' ') { pt.creature.jump = 1; e.preventDefault(); return; }
      }
    }
    this.keys[k] = down; this.keys[e.code] = down;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  },
  onPointer(e) { if (e.type === 'pointerdown' && E.playtest?.dialogue) this.advanceDialogue(); else if (e.type === 'pointerdown' && E.playtest?.encounter) this.endEncounter(false); },
  skillFor(i) { const my = E.playtest?.my; if (!my) return null; return Object.values(E.project.skills).filter((s) => s.element === my.element || s.element === 'none')[i] || null; },
  // ------------------------------------------------------------- update
  update(dt) {
    const pt = E.playtest; if (!pt) return;
    pt.t += dt;
    if (pt.msg && pt.t > pt.msg.until && !pt.msg.sticky) this.clearMsg();
    if (pt.kind === 'map') this.updateMap(dt); else this.updateCreature(dt);
    if (pt.shake > 0) pt.shake = Math.max(0, pt.shake - dt * 2);
    const info = $('#pt-info'); if (info) info.textContent = pt.kind === 'map' ? `${E.project.maps[pt.mapId]?.name} · x ${Math.round(pt.player.x)} y ${Math.round(pt.player.y)} · ${pt.zoneName || 'no zone'}` : `${pt.my.name} · ${pt.creature.oneShot ? pt.creature.oneShot.anim.name : pt.creature.anim?.name || '—'}`;
  },
  updateMap(dt) {
    const pt = E.playtest; const map = E.project.maps[pt.mapId]; if (!map) { this.stop(); return; }
    const p = pt.player;
    if (pt.dialogue || pt.encounter) { p.moving = false; return; }
    const kd = (a, b) => this.keys[a] || this.keys[b];
    let dx = (kd('d', 'arrowright') ? 1 : 0) - (kd('a', 'arrowleft') ? 1 : 0), dy = (kd('s', 'arrowdown') ? 1 : 0) - (kd('w', 'arrowup') ? 1 : 0);
    const run = this.keys.shift || this.keys.ShiftLeft || this.keys.ShiftRight;
    p.moving = !!(dx || dy);
    if (p.moving) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const sp = p.speed * (run ? 1.7 : 1) * dt;
      const nx = p.x + dx * sp, ny = p.y + dy * sp;
      if (this.canStand(map, nx, p.y)) p.x = nx;
      if (this.canStand(map, p.x, ny)) p.y = ny;
      p.step += sp; p.anim += dt * (run ? 14 : 9);
      pt.encounterCooldown -= dt;
      this.checkZones(map, sp);
    }
    p.x = clamp(p.x, p.r, map.width - p.r); p.y = clamp(p.y, p.r, map.height - p.r);
    // camera follow with limits
    const c = pt.cam; const vw = Scene.w / c.zoom, vh = Scene.h / c.zoom;
    const cam = map.camera || { minX: 0, minY: 0, maxX: map.width, maxY: map.height };
    const tx = clamp(p.x, cam.minX + vw / 2, Math.max(cam.minX + vw / 2, cam.maxX - vw / 2)), ty = clamp(p.y, cam.minY + vh / 2, Math.max(cam.minY + vh / 2, cam.maxY - vh / 2));
    c.x = lerp(c.x, tx, Math.min(1, dt * 6)); c.y = lerp(c.y, ty, Math.min(1, dt * 6));
    // warps & triggers
    for (const n of allNodes(map)) {
      if (!n.visible) continue;
      if (n.type === 'warp' && this.inRect(n, map, p.x, p.y)) { this.doWarp(n); return; }
      if (n.type === 'trigger' && this.inRect(n, map, p.x, p.y)) { if (n.trigger.once && pt.firedOnce.has(n.id)) continue; if (pt.lastTrigger === n.id) continue; pt.lastTrigger = n.id; pt.firedOnce.add(n.id); this.fireTrigger(n); return; }
    }
    if (pt.lastTrigger && !allNodes(map).some((n) => n.id === pt.lastTrigger && this.inRect(n, map, p.x, p.y))) pt.lastTrigger = null;
    // wandering mythlings
    for (const m of pt.mythlings) {
      m.t -= dt;
      if (m.node.mythling.behavior === 'wander') { if (m.t <= 0) { m.t = 1.5 + Math.random() * 3; const ang = Math.random() * 6.28; const go = Math.random() < 0.6; m.vx = go ? Math.cos(ang) * 40 : 0; m.vy = go ? Math.sin(ang) * 30 : 0; if (m.vx) m.facingLeft = m.vx < 0; } const nx = m.x + m.vx * dt, ny = m.y + m.vy * dt; if (Math.hypot(nx - m.ox, ny - m.oy) < 140 && this.canStand(map, nx, ny, 14, m.node.id)) { m.x = nx; m.y = ny; } else { m.vx = -m.vx; m.vy = -m.vy; } }
      else if (m.node.mythling.behavior === 'follow') { const d = Math.hypot(p.x - m.x, p.y - m.y); if (d > 60) { const nx = m.x + ((p.x - m.x) / d) * 120 * dt, ny = m.y + ((p.y - m.y) / d) * 120 * dt; if (this.canStand(map, nx, ny, 14, m.node.id)) { m.x = nx; m.y = ny; } m.facingLeft = p.x < m.x; m.vx = 1; } else m.vx = 0; }
    }
  },
  inRect(n, map, x, y) { const b = worldBounds(n, map); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; },
  cellBlocked(map, x, y) { const c = Math.floor(x / map.cell), r = Math.floor(y / map.cell); if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return true; const v = map.collision[r * map.cols + c]; return v === 1 || v === 2; },
  canStand(map, x, y, r = 12, ignoreId = null) {
    for (const [ox, oy] of [[-r, -r * 0.5], [r, -r * 0.5], [-r, r * 0.6], [r, r * 0.6]]) if (this.cellBlocked(map, x + ox, y + oy)) return false;
    for (const n of allNodes(map)) {
      if (!n.collision?.enabled || !n.visible || n.id === ignoreId || !n.collision.layers?.player) continue;
      if (n.collision.mode && n.collision.mode !== 'blocked' && n.collision.mode !== 'water') continue;
      if (n.type === 'zone' || n.type === 'warp' || n.type === 'trigger' || n.type === 'spawn') continue;
      const s = collisionShapeWorld(n, map); if (!s) continue;
      if (s.type === 'circle') { if (Math.hypot(x - s.x, y - s.y) < s.r + r * 0.6) return false; }
      else { const b = boundsOfPoints(s.points); if (x + r < b.x || x - r > b.x + b.w || y + r * 0.6 < b.y || y - r * 0.6 > b.y + b.h) continue; if (pointInPolygon(x, y, s.points) || distToPolyline(x, y, s.points, true) < r * 0.7) return false; }
    }
    return true;
  },
  checkZones(map, moved) {
    const pt = E.playtest; const p = pt.player;
    const zone = allNodes(map).find((n) => n.type === 'zone' && n.visible && this.inRect(n, map, p.x, p.y));
    pt.zoneName = zone ? zone.zone.name : null;
    if (!zone || pt.encounterCooldown > 0) return;
    const ti = map.terrain[Math.floor(p.y / map.cell) * map.cols + Math.floor(p.x / map.cell)];
    const tid = TERRAINS[ti]?.id; const grassy = ['grass', 'forest', 'sand', 'dirt'].includes(tid);
    const rate = (zone.zone.weight || 5) / 100 * (grassy ? 1 : 0.35) * (moved / 32);
    if (Math.random() < rate * 0.9) this.startEncounter(zone);
  },
  startEncounter(zone) {
    const pt = E.playtest; const z = zone.zone;
    const pool = z.species.length ? z.species : Object.keys(E.project.mythlings);
    const sp = pool[Math.floor(Math.random() * pool.length)];
    const my = E.project.mythlings[sp];
    const level = Math.floor(lerp(z.minLevel, z.maxLevel + 1, Math.random()));
    const mutant = Math.random() * 100 < (z.mutationChance || 0);
    pt.encounter = { species: sp, my, level, mutant, t: 0 };
    pt.encounterCooldown = 4;
    this.msg(`A wild ${my ? my.name : sp}${mutant ? ' ✦MUTANT✦' : ''} (Lv.${level}) appeared in ${z.name}!`, 0, { title: 'WILD ENCOUNTER', hint: 'Enter / click to continue · Esc to run away', sticky: true, kind: 'encounter' });
    ConsoleLog.info(`Encounter: ${sp} Lv.${level}${mutant ? ' (mutant)' : ''} in ${z.name}`);
    pt.shake = 0.4;
  },
  endEncounter(ran) { const pt = E.playtest; if (!pt.encounter) return; pt.encounter = null; this.clearMsg(); this.msg(ran ? 'You ran away safely.' : 'Battle would start here in the game. (Encounter preview only)', 2); },
  interact() {
    const pt = E.playtest; const map = E.project.maps[pt.mapId]; const p = pt.player;
    const face = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.dir];
    const fx = p.x + face[0] * 34, fy = p.y + face[1] * 34;
    let best = null, bd = 60;
    for (const n of allNodes(map)) {
      if (!n.visible) continue;
      const interactable = n.type === 'npc' || (n.type === 'prefab' && (n.behavior.interactable || n.behavior.savePoint || n.behavior.chest || ['sign', 'chest', 'savepoint'].includes(n.prefab))) || (n.type === 'mythling') || (n.behavior && n.behavior.interactable);
      if (!interactable) continue;
      const [wx, wy] = worldPos(n, map); const d = Math.min(Math.hypot(wx - fx, wy - fy), Math.hypot(wx - p.x, wy - p.y) + 10);
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) { this.msg('Nothing to interact with here.', 1.2); return; }
    if (best.type === 'npc') { const lines = best.npc.dialogue?.length ? best.npc.dialogue : ['...']; pt.dialogue = { node: best, lines: lines.map((l) => l.replace(/\{player\}/g, 'Player')), i: 0 }; this.showDialogueLine(); return; }
    if (best.type === 'mythling') { this.msg(`${E.project.mythlings[best.mythling.species]?.name || 'Mythling'} looks at you curiously. (Lv.${best.mythling.level})`, 2.5, { title: best.name }); return; }
    if (best.behavior.savePoint || best.prefab === 'savepoint') { this.msg('Progress saved! (save point)', 2, { title: 'SAVE POINT' }); return; }
    if (best.behavior.chest || best.prefab === 'chest') { if (pt.firedOnce.has(best.id)) { this.msg('The chest is empty.', 1.5); return; } pt.firedOnce.add(best.id); this.msg(`You found ${best.behavior.item || 'a mysterious item'}!`, 2.5, { title: 'TREASURE' }); return; }
    if (best.prefab === 'sign') { this.msg(best.behavior.text || best.name, 3, { title: 'SIGN' }); return; }
    this.msg(best.behavior.text || `It's a ${best.name}.`, 2.5, { title: best.name });
  },
  showDialogueLine() { const d = E.playtest.dialogue; if (!d) return; const n = d.node; const isLast = d.i >= d.lines.length - 1; this.msg(d.lines[d.i], 0, { title: `${n.name}${n.npc.kind !== 'regular' ? ' · ' + n.npc.kind.toUpperCase() : ''}`, hint: isLast ? (n.npc.team?.length ? 'Enter — (trainer battle would start)' : 'Enter to close') : 'Enter ▸', sticky: true }); },
  advanceDialogue() {
    const pt = E.playtest; const d = pt.dialogue; if (!d) return;
    d.i++;
    if (d.i < d.lines.length) { this.showDialogueLine(); return; }
    pt.dialogue = null; this.clearMsg();
    const n = d.node;
    if (n.npc.flag) { pt.flags[n.npc.flag] = true; ConsoleLog.info(`Flag set: ${n.npc.flag}`); }
    if (n.npc.kind === 'healer') this.msg('Your Mythlings are fully healed!', 2, { title: 'HEALER' });
    else if (n.npc.kind === 'shop') this.msg(`Shop: ${(n.npc.stock || []).map((s) => `${s.item} (${s.price})`).join(', ') || 'no stock configured'}`, 3, { title: 'SHOP' });
    else if (n.npc.kind === 'savepoint') this.msg('Progress saved!', 2, { title: 'SAVE' });
    else if (n.npc.team?.length) this.msg(`Trainer battle vs ${n.npc.team.map((t) => `${E.project.mythlings[t.species]?.name || t.species} Lv.${t.level}`).join(', ')} (preview only)`, 3, { title: 'TRAINER BATTLE' });
  },
  doWarp(n) {
    const pt = E.playtest; const w = n.warp;
    if (pt.warpCooldown > pt.t) return;
    if (w.requiredFlag && !pt.flags[w.requiredFlag]) { if (pt.lastBlockedWarp !== n.id) { pt.lastBlockedWarp = n.id; this.msg(`The way is blocked. (requires flag "${w.requiredFlag}")`, 2, { title: w.label || n.name }); } this.pushBack(n); return; }
    const dest = E.project.maps[w.toMap];
    if (!dest) { this.msg(`Warp "${n.name}" has no valid destination map.`, 2, { title: 'WARP' }); this.pushBack(n); return; }
    pt.mapId = dest.id; pt.player.x = w.toX; pt.player.y = w.toY; pt.cam.x = w.toX; pt.cam.y = w.toY; pt.warpCooldown = pt.t + 1;
    pt.mythlings = allNodes(dest).filter((x) => x.type === 'mythling' && x.visible).map((x) => ({ node: x, x: x.x, y: x.y, ox: x.x, oy: x.y, vx: 0, vy: 0, t: Math.random() * 3, facingLeft: x.mythling.facing === 'left' }));
    pt.fade = 1;
    this.msg(`${w.label || 'Warped'} → ${dest.name}`, 2, { title: 'MAP TRANSITION' });
    ConsoleLog.info(`Warp to ${dest.name} @ ${w.toX},${w.toY}`);
  },
  pushBack(n) { const pt = E.playtest; const map = E.project.maps[pt.mapId]; const b = worldBounds(n, map); const p = pt.player; const cx = b.x + b.w / 2, cy = b.y + b.h / 2; const dx = p.x - cx, dy = p.y - cy; if (Math.abs(dx) / b.w > Math.abs(dy) / b.h) p.x = dx > 0 ? b.x + b.w + p.r + 1 : b.x - p.r - 1; else p.y = dy > 0 ? b.y + b.h + p.r + 1 : b.y - p.r - 1; },
  fireTrigger(n) {
    const pt = E.playtest; const t = n.trigger;
    ConsoleLog.info(`Trigger "${n.name}" fired: ${t.event}`);
    switch (t.event) {
      case 'message': this.msg(t.payload || '...', 3, { title: n.name }); break;
      case 'battle': this.msg(`Battle trigger: ${t.payload || 'wild battle'} (preview)`, 2.5, { title: 'BATTLE' }); pt.shake = 0.5; break;
      case 'heal': this.msg('Your team was healed.', 2, { title: 'HEAL' }); break;
      case 'save': this.msg('Progress saved.', 2, { title: 'SAVE' }); break;
      case 'set_flag': pt.flags[t.payload] = true; this.msg(`Flag "${t.payload}" set.`, 1.5, { title: 'FLAG' }); break;
      case 'give_item': this.msg(`Received ${t.payload || 'an item'}.`, 2, { title: 'ITEM' }); break;
      case 'cutscene': this.msg(`Cutscene: ${t.payload || '(unnamed)'}`, 3, { title: 'CUTSCENE' }); break;
      default: this.msg(`${t.event}: ${t.payload || ''}`, 2.5, { title: n.name });
    }
  },
  updateCreature(dt) {
    const pt = E.playtest; const c = pt.creature;
    const kd = (a, b) => this.keys[a] || this.keys[b];
    const dir = (kd('d', 'arrowright') ? 1 : 0) - (kd('a', 'arrowleft') ? 1 : 0);
    const run = this.keys.shift || this.keys.ShiftLeft;
    c.vx = dir * (run ? 260 : 130);
    c.x = clamp(c.x + c.vx * dt, -300, 520);
    if (dir) c.facingLeft = dir < 0;
    if (c.jump) { c.jumpT = (c.jumpT || 0) + dt * 3; c.y = -Math.sin(Math.min(Math.PI, c.jumpT)) * 70; if (c.jumpT >= Math.PI) { c.jump = 0; c.jumpT = 0; c.y = 0; } }
    if (c.oneShot && pt.t - c.oneShot.start > c.oneShot.anim.duration) c.oneShot = null;
    if (!c.oneShot) { const want = dir ? (run ? 'Run' : 'Walk') : 'Idle'; if (!c.anim || c.anim.name !== want) { const a = Screens.animByName(pt.my, want); if (a && a.name === want) c.anim = a; else if (!c.anim) c.anim = a; } }
    pt.cam.x = lerp(pt.cam.x, c.x + 120, dt * 4);
  },
  playClip(a) { const pt = E.playtest; if (!pt || pt.kind !== 'creature') return; pt.creature.oneShot = { anim: a, start: pt.t }; if (a.loop) { pt.creature.anim = a; pt.creature.oneShot = null; } },
  castSkill(s) {
    const pt = E.playtest; if (!pt || !s || pt.kind !== 'creature') return;
    const a = Screens.animByName(pt.my, s.animation); if (a) pt.creature.oneShot = { anim: a, start: pt.t };
    const vfx = E.project.vfx[s.vfx];
    const c = pt.creature;
    if (vfx) setTimeout(() => { if (!E.playtest) return; VFXSystem.play(vfx, studioAnchors(pt.my, c.x, c.x + (c.facingLeft ? -300 : 300))); E.targetHit = E.time + 0.3; }, a ? Math.min(400, a.duration * 400) : 0);
    setTimeout(() => { if (E.playtest) E.playtest.shake = s.shake || 0; }, 400);
    this.msg(`${pt.my.name} used ${s.name}!`, 1.5);
  },
  // ------------------------------------------------------------- render
  render(ctx, W, H) {
    const pt = E.playtest; if (!pt) return;
    const sh = pt.shake > 0 ? pt.shake * 10 : 0;
    const ox = sh ? (Math.random() - 0.5) * sh : 0, oy = sh ? (Math.random() - 0.5) * sh : 0;
    if (pt.kind === 'map') this.renderMap(ctx, W, H, ox, oy); else this.renderCreature(ctx, W, H, ox, oy);
    if (pt.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${pt.fade})`; ctx.fillRect(0, 0, W, H); pt.fade = Math.max(0, pt.fade - 0.04); }
    // hud text
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, H - 22, W, 22);
    ctx.fillStyle = '#e2e8f0'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(pt.kind === 'map' ? 'WASD / arrows: move · Shift: run · E / Enter: interact · F3: debug · Esc: exit' : 'A/D: walk · Shift: run · Space: jump · 1-9: clips · Q/E/R: skills · Esc: exit', 10, H - 11);
    if (pt.debug) { ctx.textAlign = 'right'; ctx.fillStyle = '#a7f3d0'; ctx.fillText(`fps ${Scene.fps} · particles ${VFXSystem.particles.length}`, W - 10, H - 11); }
  },
  renderMap(ctx, W, H, ox, oy) {
    const pt = E.playtest; const map = E.project.maps[pt.mapId]; if (!map) return;
    const c = pt.cam; const view = { x: c.x - W / 2 / c.zoom + ox, y: c.y - H / 2 / c.zoom + oy, zoom: c.zoom };
    ctx.save(); ctx.translate(-view.x * view.zoom, -view.y * view.zoom); ctx.scale(view.zoom, view.zoom);
    ctx.fillStyle = '#0b0f14'; ctx.fillRect(view.x, view.y, W / view.zoom, H / view.zoom);
    renderTerrain(ctx, map, view, W, H);
    // y-sorted objects: draw doc but insert player by depth — simple approach: draw doc, then player, then objects in front (y greater than player)
    const savedView = E.view; E.view = view;
    const p = pt.player;
    const order = drawOrder(map);
    const behind = [], front = [];
    for (const n of order) { if (['zone', 'warp', 'trigger', 'spawn', 'anchor'].includes(n.type)) continue; const [, wy] = worldPos(n, map); (n.type === 'group' || wy <= p.y || n.layer === 'terrain' || n.layer === 'ground' || n.layer === 'water' ? behind : front).push(n); }
    const drawSet = (list) => { for (const n of list) { if (!n.visible || hiddenByLayer(n, map)) continue; if (n.type === 'group') continue; let hidden = false; for (let q = n.parent; q; q = map.nodes[q]?.parent) if (map.nodes[q] && !map.nodes[q].visible) { hidden = true; break; } if (hidden) continue; if (n.type === 'mythling') { const st = pt.mythlings.find((m) => m.node === n); if (st) { ctx.save(); ctx.translate(st.x, st.y); const my = E.project.mythlings[n.mythling.species]; if (my) drawMythlingInline(ctx, my, Screens.animByName(my, st.vx ? 'Walk' : 'Idle'), pt.t + st.t, n.shape.h, st.facingLeft); ctx.restore(); continue; } } const m = worldMatrix(n, map, NO_ANIM); ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.globalAlpha = n.opacity; applyAppearance(ctx, n); applyIdleBehavior(ctx, n, E.time); drawNodeShape(ctx, n, { overlays: false }); ctx.restore(); } };
    drawSet(behind);
    this.drawPlayer(ctx, p);
    drawSet(front.sort((a, b) => worldPos(a, map)[1] - worldPos(b, map)[1]));
    if (pt.debug) {
      renderCollisionGrid(ctx, map, view, W, H, 0.3); renderObjectCollisions(ctx, map);
      renderDoc(ctx, map, { overlays: true, still: true });
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#f2c761'; ctx.strokeRect(map.camera.minX, map.camera.minY, map.camera.maxX - map.camera.minX, map.camera.maxY - map.camera.minY);
    }
    // interaction prompt
    const near = allNodes(map).find((n) => (n.type === 'npc' || (n.type === 'prefab' && (n.behavior.interactable || ['sign', 'chest', 'savepoint'].includes(n.prefab)))) && n.visible && dist(...worldPos(n, map), p.x, p.y) < 60);
    if (near && !pt.dialogue) { const [nx, ny] = worldPos(near, map); ctx.fillStyle = '#f2c761'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('[E] ' + near.name, nx, ny - near.shape.h - 8); }
    VFXSystem.render(ctx);
    E.view = savedView;
    ctx.restore();
  },
  drawPlayer(ctx, p) {
    const t = p.anim; const bob = p.moving ? Math.abs(Math.sin(t)) * 3 : Math.sin(E.time * 2) * 1;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, 14, 6, 0, 0, 7); ctx.fill();
    ctx.translate(0, -bob);
    const flip = p.dir === 'left';
    if (flip) ctx.scale(-1, 1);
    // legs
    const swing = p.moving ? Math.sin(t) * 6 : 0;
    ctx.fillStyle = '#2b3b55'; ctx.fillRect(-9 + swing * 0.3, -14, 7, 14); ctx.fillRect(2 - swing * 0.3, -14, 7, 14);
    // body
    ctx.fillStyle = '#3aa6a0'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-12, -38, 24, 26, 6) : ctx.rect(-12, -38, 24, 26); ctx.fill();
    ctx.fillStyle = '#f2c761'; ctx.fillRect(-12, -22, 24, 4);
    // head
    ctx.fillStyle = '#f5d0b0'; ctx.beginPath(); ctx.arc(0, -50, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#5b3a29'; ctx.beginPath(); ctx.arc(0, -54, 12, Math.PI, 0); ctx.fill(); ctx.fillRect(-12, -54, 24, 5);
    // eyes by direction
    ctx.fillStyle = '#1b1b1b';
    if (p.dir === 'down') { ctx.fillRect(-5, -50, 3, 3); ctx.fillRect(2, -50, 3, 3); }
    else if (p.dir === 'up') { /* back of head */ }
    else { ctx.fillRect(4, -50, 3, 3); }
    // cap
    ctx.fillStyle = '#e34a4a'; ctx.beginPath(); ctx.arc(0, -56, 12, Math.PI, 0); ctx.fill(); ctx.fillRect(flip ? -6 : -6, -57, 22, 4);
    ctx.restore();
  },
  renderCreature(ctx, W, H, ox, oy) {
    const pt = E.playtest; const c = pt.creature; const cam = pt.cam;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2a3d'); g.addColorStop(0.7, '#2b4a3a'); g.addColorStop(1, '#3f6b3a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const view = { x: cam.x - W / 2 / cam.zoom + ox, y: cam.y - H / 2 / cam.zoom + oy, zoom: cam.zoom };
    ctx.save(); ctx.translate(-view.x * view.zoom, -view.y * view.zoom); ctx.scale(view.zoom, view.zoom);
    // ground
    ctx.fillStyle = '#4f9d4a'; ctx.fillRect(view.x - 100, 0, W / view.zoom + 200, 400);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = Math.floor((view.x - 100) / 64) * 64; x < view.x + W / view.zoom + 100; x += 64) ctx.fillRect(x, 0, 32, 400);
    // target dummy (arena)
    const tx = c.x + (c.facingLeft ? -300 : 300);
    ctx.save(); ctx.translate(tx - TARGET_X, 0); Scene.drawTargetDummy(ctx, pt.my); ctx.restore();
    // creature
    const anim = c.oneShot ? c.oneShot.anim : c.anim; const t = c.oneShot ? pt.t - c.oneShot.start : pt.t;
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, -c.y + 3, 50, 9, 0, 0, 7); ctx.fill();
    if (c.facingLeft) ctx.scale(-1, 1);
    const offsetFn = anim ? (id) => (anim.tracks[id] ? sampleTrack(anim.tracks[id], t, anim) : null) : NO_ANIM;
    renderDoc(ctx, pt.my.rig, { offsetFn, still: true });
    ctx.restore();
    VFXSystem.render(ctx);
    if (pt.debug) { const [ax, ay] = anchorWorld(pt.my, 'AttackOrigin', offsetFn); ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x + (c.facingLeft ? -ax : ax), ay + c.y, 6, 0, 7); ctx.stroke(); for (const n of allNodes(pt.my.rig)) { if (n.type !== 'anchor') continue; const [x, y] = M.apply(worldMatrix(n, pt.my.rig, offsetFn), 0, 0); ctx.fillStyle = n.fill; ctx.beginPath(); ctx.arc(c.x + (c.facingLeft ? -x : x), y + c.y, 3, 0, 7); ctx.fill(); } }
    ctx.restore();
    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${pt.my.name} — ${anim ? anim.name : 'no clip'}`, 14, 60);
  },
};
