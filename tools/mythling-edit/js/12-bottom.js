// =============================================================================
// Bottom panel: TIMELINE / ANIMATION / VFX / CONSOLE / OUTPUT
// =============================================================================
const Bottom = {
  tabs: [['timeline', 'TIMELINE'], ['animation', 'ANIMATION'], ['vfx', 'VFX'], ['console', 'CONSOLE'], ['output', 'OUTPUT']],
  get tab() { return E.ui.bottomTab; },
  output: '', tl: null, tlDrag: null,
  visible() { return !$('#app').classList.contains('bottom-collapsed') && E.ui.bottomShown; },
  show(tab) { if (tab) E.ui.bottomTab = tab; E.ui.bottomShown = true; $('#app').classList.remove('bottom-collapsed'); $('#bottom-collapsed').classList.add('hidden'); this.render(); setTimeout(() => Scene.resize(), 0); },
  hide() { E.ui.bottomShown = false; $('#app').classList.add('bottom-collapsed'); $('#bottom-collapsed').classList.remove('hidden'); setTimeout(() => Scene.resize(), 0); },
  setOutput(text) { this.output = text; if (this.tab === 'output' && this.visible()) this.render(); },
  render() {
    if (!E.project) return;
    if (!E.ui.bottomShown) { $('#app').classList.add('bottom-collapsed'); $('#bottom-collapsed').classList.remove('hidden'); return; }
    const tb = clear($('#bottom-tabs'));
    for (const [id, label] of this.tabs) tb.appendChild(h('button', { class: `tab ${this.tab === id ? 'active' : ''}`, text: label + (id === 'console' && ConsoleLog.lines.some((l) => l.kind === 'err') ? ' •' : ''), onclick: () => { E.ui.bottomTab = id; this.render(); } }));
    tb.appendChild(h('span', { class: 'spacer' }));
    tb.appendChild(h('button', { class: 'tab close', text: '▼ HIDE', title: 'Hide bottom panel (Ctrl+B)', onclick: () => this.hide() }));
    const body = clear($('#bottom-body'));
    try { ({ timeline: this.renderTimeline, animation: this.renderAnimation, vfx: this.renderVfx, console: this.renderConsole, output: this.renderOutput }[this.tab] || this.renderTimeline).call(this, body); }
    catch (err) { console.error(err); body.appendChild(h('div', { class: 'empty', text: `Panel error: ${err.message}` })); }
  },
  // ------------------------------------------------------------- transport
  togglePlay() { const a = currentAnim(); if (!a) { toast('Open an animation first (ANIMATION mode)', 'warn'); return; } if (!E.playing && E.playhead >= a.duration) E.playhead = 0; E.playing = !E.playing; this.syncTransport(); Scene.invalidate(); },
  stop() { E.playing = false; E.playhead = 0; invalidateMatrices(); this.syncTransport(); Scene.invalidate(); },
  step(dir) { const a = currentAnim(); if (!a) return; E.playing = false; E.playhead = round(clamp(E.playhead + dir / (a.fps || 60), 0, a.duration), 4); invalidateMatrices(); this.syncTransport(); Scene.invalidate(); },
  seek(t) { const a = currentAnim(); if (!a) return; E.playhead = round(clamp(t, 0, a.duration), 4); invalidateMatrices(); this.syncTransport(); Scene.invalidate(); },
  syncTransport() {
    const a = currentAnim();
    const tEl = $('#tl-time'); if (tEl && a) tEl.textContent = `${fmtTime(E.playhead)} / ${fmtTime(a.duration)}  ·  frame ${Math.round(E.playhead * (a.fps || 60))}`;
    const pb = $('#tl-play'); if (pb) { clear(pb); pb.appendChild(icon(E.playing ? 'pause' : 'play')); pb.title = E.playing ? 'Pause (Space)' : 'Play (Space)'; }
    const lb = $('#tl-loop'); if (lb) lb.classList.toggle('active', E.loopPlayback);
    const sp = $('#tl-speed'); if (sp) sp.value = String(E.speed);
    if (this.tl && this.tab === 'timeline') this.drawTimeline();
    const strip = $('#anim-strip'); if (strip && !strip.classList.contains('hidden')) $$('#anim-strip .acard').forEach((c) => c.classList.toggle('active', c.dataset.id === E.animId));
  },
  reverseAnim() { const a = currentAnim(); if (!a) return; History.run('Reverse animation', () => { for (const tr of Object.values(a.tracks)) { for (const k of tr) k.t = round(a.duration - k.t, 4); tr.sort((x, y) => x.t - y.t); } }); this.render(); },
  quantize() { const a = currentAnim(); if (!a) return; const fps = a.fps || 60; History.run('Quantize keys', () => { for (const [id, tr] of Object.entries(a.tracks)) { for (const k of tr) k.t = round(Math.round(k.t * fps) / fps, 4); const seen = new Set(); a.tracks[id] = tr.filter((k) => { if (seen.has(k.t)) return false; seen.add(k.t); return true; }); } }); this.render(); toast(`Keys snapped to ${fps} fps`, 'ok'); },
  // ------------------------------------------------------------- TIMELINE
  renderTimeline(body) {
    const my = currentMythling(); const a = currentAnim();
    if (!isCreatureMode() || !my) { body.appendChild(h('div', { class: 'empty' }, ['The timeline animates Mythling rigs. ', h('button', { class: 'btn tiny', text: 'OPEN ANIMATION EDITOR', onclick: () => UI.setMode('animation') })])); return; }
    if (!a) { body.appendChild(h('div', { class: 'empty' }, ['No animation clip selected. ', h('button', { class: 'btn tiny primary', text: '+ NEW ANIMATION', onclick: () => Screens.newAnimation() }), ' ', my.animations.length ? h('button', { class: 'btn tiny', text: 'OPEN FIRST CLIP', onclick: () => { UI.setMode('animation'); UI.setAnimation(my.animations[0]); } }) : null])); return; }
    const ed = (label, fn) => { History.run(`~${label}`, fn); UI.updateHeader(); };
    const head = h('div', { class: 'tl-head' }, [
      h('select', { class: 'map-select', title: 'Animation clip', onchange: (e) => UI.setAnimation(e.target.value) }, my.animations.map((id) => E.project.animations[id]).filter(Boolean).map((x) => h('option', { value: x.id, selected: x.id === a.id, text: x.name }))),
      h('input', { type: 'text', class: 'tl-name', value: a.name, title: 'Clip name', onchange: (e) => { ed('Clip name', () => { a.name = e.target.value; }); Left.render(); this.render(); } }),
      h('label', { class: 'inline' }, ['Duration', h('input', { type: 'number', step: 0.1, min: 0.1, value: a.duration, onchange: (e) => { ed('Duration', () => { a.duration = Math.max(0.1, +e.target.value); for (const tr of Object.values(a.tracks)) for (const k of tr) k.t = Math.min(k.t, a.duration); }); this.render(); } }), 's']),
      h('label', { class: 'inline' }, ['FPS', h('select', { onchange: (e) => ed('FPS', () => { a.fps = +e.target.value; }) }, [12, 24, 30, 60].map((f) => h('option', { value: f, selected: (a.fps || 60) === f, text: String(f) })))]),
      h('label', { class: 'inline toggle' }, [h('input', { type: 'checkbox', checked: a.loop, onchange: (e) => ed('Loop', () => { a.loop = e.target.checked; }) }), 'Loop']),
      h('label', { class: 'inline' }, ['Easing', h('select', { onchange: (e) => ed('Easing', () => { a.easing = e.target.value; }) }, EASING_IDS.map((x) => h('option', { value: x, selected: (a.easing || 'easeInOut') === x, text: titleCase(x) })))]),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn tiny primary', text: '+ KEY SELECTED (K)', onclick: () => Ops.keyCurrentPose(E.selection) }),
      h('button', { class: 'btn tiny', text: 'KEY ALL', onclick: () => Ops.keyCurrentPose(allNodes().filter((n) => n.type !== 'anchor').map((n) => n.id)) }),
      h('label', { class: 'inline toggle', title: 'Automatically key parts when you move/rotate/scale them' }, [h('input', { type: 'checkbox', checked: !!settings().autoKey, onchange: (e) => { settings().autoKey = e.target.checked; } }), 'Auto-key']),
      h('button', { class: 'btn tiny', text: '+ NEW', onclick: () => Screens.newAnimation() }),
      h('button', { class: 'btn tiny ghost', text: 'DUPLICATE', onclick: () => Ops.duplicateAnimation(a.id) }),
      h('button', { class: 'btn tiny danger', text: 'DELETE', onclick: () => Ops.deleteAnimation(a.id) }),
    ]);
    body.appendChild(head);
    const transport = h('div', { class: 'tl-transport' }, [
      h('button', { class: 'btn tiny ghost', title: 'To start (Home)', onclick: () => this.seek(0) }, icon('stepBack')),
      h('button', { class: 'btn tiny ghost', title: 'Step back (,)', onclick: () => this.step(-1) }, '‹'),
      h('button', { class: 'btn tiny primary', id: 'tl-play', title: 'Play / Pause', onclick: () => this.togglePlay() }, icon(E.playing ? 'pause' : 'play')),
      h('button', { class: 'btn tiny ghost', title: 'Stop', onclick: () => this.stop() }, icon('stop')),
      h('button', { class: 'btn tiny ghost', title: 'Step forward (.)', onclick: () => this.step(1) }, '›'),
      h('button', { class: 'btn tiny ghost', title: 'To end (End)', onclick: () => this.seek(a.duration) }, icon('stepFwd')),
      h('button', { class: `btn tiny ghost ${E.loopPlayback ? 'active' : ''}`, id: 'tl-loop', title: 'Loop playback', onclick: () => { E.loopPlayback = !E.loopPlayback; this.syncTransport(); } }, icon('loop')),
      h('select', { id: 'tl-speed', title: 'Playback speed', onchange: (e) => { E.speed = +e.target.value; } }, [0.25, 0.5, 1, 2].map((s) => h('option', { value: s, selected: E.speed === s, text: `${s}×` }))),
      h('span', { id: 'tl-time', class: 'tl-time', text: `${fmtTime(E.playhead)} / ${fmtTime(a.duration)}` }),
      h('span', { class: 'spacer' }),
      h('span', { class: 'hint', text: 'Click ruler to scrub · drag ◆ to move · double-click a row to add a key · right-click ◆ for options' }),
    ]);
    body.appendChild(transport);
    const wrap = h('div', { id: 'tl-canvas-wrap' });
    const cv = h('canvas', { id: 'timeline' });
    wrap.appendChild(cv); body.appendChild(wrap);
    this.tl = cv;
    this.bindTimeline(cv);
    requestAnimationFrame(() => this.drawTimeline());
  },
  timelineRows() {
    const a = currentAnim(); const doc = currentDoc(); if (!a || !doc) return [];
    const ids = new Set(Object.keys(a.tracks).filter((id) => doc.nodes[id]));
    for (const id of E.selection) if (doc.nodes[id]) ids.add(id);
    const order = drawOrder(doc).map((n) => n.id);
    return [...ids].sort((x, y) => order.indexOf(x) - order.indexOf(y)).map((id) => ({ id, node: doc.nodes[id], keys: a.tracks[id] || [] }));
  },
  tlGeom() {
    const cv = this.tl; const W = cv.clientWidth, H = cv.clientHeight;
    return { W, H, left: 170, top: 24, row: 22, right: 12, get span() { return Math.max(10, this.W - this.left - this.right); } };
  },
  tToX(t) { const g = this.tlGeom(); const a = currentAnim(); return g.left + (t / Math.max(0.001, a.duration)) * g.span; },
  xToT(x) { const g = this.tlGeom(); const a = currentAnim(); return clamp(((x - g.left) / g.span) * a.duration, 0, a.duration); },
  drawTimeline() {
    const cv = this.tl; if (!cv || !cv.isConnected) return;
    const a = currentAnim(); if (!a) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const g = this.tlGeom();
    const rows = this.timelineRows();
    const needH = g.top + rows.length * g.row + 8;
    cv.style.height = `${Math.max(needH, 60)}px`;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0f131a'; ctx.fillRect(0, 0, W, H);
    // ruler
    ctx.fillStyle = '#161c26'; ctx.fillRect(g.left, 0, g.span, g.top);
    const fps = a.fps || 60; const frames = Math.round(a.duration * fps);
    let stepF = 1; while ((g.span / frames) * stepF < 40) stepF *= 2;
    ctx.font = '10px monospace'; ctx.fillStyle = '#9fb0c8'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let f = 0; f <= frames; f += 1) {
      const x = Math.round(this.tToX(f / fps)) + 0.5;
      if (f % stepF === 0) { ctx.fillText(`${(f / fps).toFixed(2)}`, x, 3); ctx.beginPath(); ctx.moveTo(x, g.top - 6); ctx.lineTo(x, H); ctx.stroke(); }
      else if (g.span / frames > 6) { ctx.beginPath(); ctx.moveTo(x, g.top - 3); ctx.lineTo(x, g.top); ctx.stroke(); }
    }
    // rows
    rows.forEach((r, i) => {
      const y = g.top + i * g.row;
      const sel = E.selection.includes(r.id);
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent'; ctx.fillRect(0, y, W, g.row);
      if (sel) { ctx.fillStyle = 'rgba(96,165,250,0.10)'; ctx.fillRect(0, y, W, g.row); }
      ctx.fillStyle = sel ? '#dbeafe' : '#c9d3e3'; ctx.font = `${sel ? 'bold ' : ''}11px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const name = r.node ? r.node.name : r.id; ctx.fillText(name.length > 22 ? name.slice(0, 21) + '…' : name, 8, y + g.row / 2);
      ctx.fillStyle = '#5b6b82'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`${r.keys.length}`, g.left - 6, y + g.row / 2);
      // key bars between keys
      if (r.keys.length > 1) { ctx.strokeStyle = 'rgba(242,199,97,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.tToX(r.keys[0].t), y + g.row / 2); ctx.lineTo(this.tToX(r.keys[r.keys.length - 1].t), y + g.row / 2); ctx.stroke(); }
      r.keys.forEach((k, ki) => {
        const x = this.tToX(k.t), cy = y + g.row / 2;
        const isSel = E.selectedKey && E.selectedKey.trackId === r.id && E.selectedKey.index === ki;
        ctx.save(); ctx.translate(x, cy); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = isSel ? '#ffffff' : k.ease === 'step' ? '#38bdf8' : '#f2c761'; ctx.fillRect(-5, -5, 10, 10);
        ctx.strokeStyle = isSel ? '#f2c761' : 'rgba(0,0,0,0.6)'; ctx.lineWidth = isSel ? 2 : 1; ctx.strokeRect(-5, -5, 10, 10);
        ctx.restore();
      });
    });
    if (!rows.length) { ctx.fillStyle = '#5b6b82'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Select a part and press K (or move it with Auto-key on) to create its first keyframe.', g.left + 10, g.top + 20); }
    // playhead
    const px = Math.round(this.tToX(E.playhead)) + 0.5;
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(px - 6, 0); ctx.lineTo(px + 6, 0); ctx.lineTo(px, 8); ctx.fill();
    // separator
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.moveTo(g.left - 0.5, 0); ctx.lineTo(g.left - 0.5, H); ctx.moveTo(0, g.top - 0.5); ctx.lineTo(W, g.top - 0.5); ctx.stroke();
  },
  keyAt(x, y) {
    const g = this.tlGeom(); const rows = this.timelineRows();
    const i = Math.floor((y - g.top) / g.row); if (i < 0 || i >= rows.length) return null;
    const r = rows[i];
    let best = null, bd = 8;
    r.keys.forEach((k, ki) => { const d = Math.abs(this.tToX(k.t) - x); if (d < bd) { bd = d; best = { trackId: r.id, index: ki, row: i }; } });
    return best || { trackId: r.id, index: -1, row: i };
  },
  bindTimeline(cv) {
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      const [x, y] = pos(e); const g = this.tlGeom(); const a = currentAnim(); if (!a) return;
      cv.setPointerCapture(e.pointerId);
      if (y < g.top || x < g.left) {
        if (x >= g.left) { E.playing = false; this.seek(this.xToT(x)); this.tlDrag = { kind: 'scrub' }; }
        else { const rows = this.timelineRows(); const i = Math.floor((y - g.top) / g.row); if (rows[i]) select(rows[i].id, { add: e.shiftKey }); }
        return;
      }
      const hit = this.keyAt(x, y);
      if (!hit) return;
      if (e.button === 2) return;
      if (hit.index >= 0) { E.selectedKey = { trackId: hit.trackId, index: hit.index }; if (!E.selection.includes(hit.trackId)) select(hit.trackId); History.begin('Move keyframe'); this.tlDrag = { kind: 'key', trackId: hit.trackId, index: hit.index, moved: false }; this.seek(a.tracks[hit.trackId][hit.index].t); Right.render(); }
      else { E.selectedKey = null; if (!E.selection.includes(hit.trackId)) select(hit.trackId); this.seek(this.xToT(x)); this.tlDrag = { kind: 'scrub' }; Right.render(); }
      this.drawTimeline();
    });
    cv.addEventListener('pointermove', (e) => {
      const d = this.tlDrag; if (!d) return; const [x] = pos(e); const a = currentAnim(); if (!a) return;
      if (d.kind === 'scrub') { this.seek(this.xToT(x)); return; }
      if (d.kind === 'key') { let t = this.xToT(x); if (!e.altKey) t = Math.round(t * (a.fps || 60)) / (a.fps || 60); const ni = Ops.moveKeyframe(a, d.trackId, d.index, t); d.index = ni; E.selectedKey = { trackId: d.trackId, index: ni }; d.moved = true; this.seek(a.tracks[d.trackId][ni].t); }
    });
    const up = () => { const d = this.tlDrag; this.tlDrag = null; if (d && d.kind === 'key') { if (d.moved) History.commit(); else History.cancel(); Right.render(); this.drawTimeline(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', (e) => { const [x, y] = pos(e); const hit = this.keyAt(x, y); const a = currentAnim(); if (!hit || !a) return; if (hit.index >= 0) return; const t = Math.round(this.xToT(x) * (a.fps || 60)) / (a.fps || 60); const o = sampleTrack(a.tracks[hit.trackId], t, a) || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }; Ops.setKeyframe(a, hit.trackId, t, { x: o.x, y: o.y, rotation: o.rotation, scaleX: o.scaleX, scaleY: o.scaleY, opacity: o.opacity }); const idx = a.tracks[hit.trackId].findIndex((k) => Math.abs(k.t - t) < 0.0005); E.selectedKey = { trackId: hit.trackId, index: idx }; this.seek(t); Right.render(); });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault(); const [x, y] = pos(e); const hit = this.keyAt(x, y); const a = currentAnim(); if (!hit || !a) return;
      const items = [];
      if (hit.index >= 0) {
        E.selectedKey = { trackId: hit.trackId, index: hit.index }; this.drawTimeline();
        const k = a.tracks[hit.trackId][hit.index];
        items.push({ label: `Keyframe @ ${fmtTime(k.t)}`, disabled: true }, 'sep',
          { label: 'Easing', sub: EASING_IDS.map((es) => ({ label: `${es === (k.ease || 'easeInOut') ? '✓ ' : ''}${titleCase(es)}`, fn: () => { History.run('Easing', () => { k.ease = es; }); this.drawTimeline(); } })) },
          { label: 'Copy Keyframe', shortcut: 'Ctrl+C', fn: () => Ops.copyKeyframes(a, hit.trackId) },
          { label: 'Copy Whole Track', fn: () => { E.selectedKey = null; Ops.copyKeyframes(a, hit.trackId); } },
          { label: 'Paste Here', disabled: !E.keyClipboard, fn: () => Ops.pasteKeyframes(a, hit.trackId, k.t) },
          { label: 'Duplicate to Playhead', fn: () => Ops.setKeyframe(a, hit.trackId, E.playhead, { x: k.x, y: k.y, rotation: k.rotation, scaleX: k.scaleX, scaleY: k.scaleY, opacity: k.opacity, ease: k.ease }, 'Duplicate keyframe') },
          { label: 'Reset Key to Rest Pose', fn: () => { History.run('Reset key', () => { Object.assign(k, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }); }); invalidateMatrices(); Scene.invalidate(); } },
          'sep', { label: 'Delete Keyframe', shortcut: 'Del', fn: () => Ops.deleteKeyframe(a, hit.trackId, hit.index) });
      } else {
        const t = Math.round(this.xToT(x) * (a.fps || 60)) / (a.fps || 60);
        items.push({ label: `Add Keyframe @ ${fmtTime(t)}`, fn: () => { const o = sampleTrack(a.tracks[hit.trackId], t, a) || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }; Ops.setKeyframe(a, hit.trackId, t, o); } },
          { label: 'Paste Keyframes Here', disabled: !E.keyClipboard, fn: () => Ops.pasteKeyframes(a, hit.trackId, t) },
          { label: 'Copy Track', disabled: !a.tracks[hit.trackId], fn: () => { E.selectedKey = null; Ops.copyKeyframes(a, hit.trackId); } },
          'sep', { label: 'Clear Track', disabled: !a.tracks[hit.trackId], fn: () => { History.run('Clear track', () => { delete a.tracks[hit.trackId]; }); this.render(); } });
      }
      Tools.showContextMenu(e.clientX, e.clientY, items);
    });
    cv.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); } });
    cv.tabIndex = 0;
  },
  // ------------------------------------------------------------- ANIMATION tab (clip manager)
  renderAnimation(body) {
    const my = currentMythling();
    if (!my) { body.appendChild(h('div', { class: 'empty', text: 'Open a Mythling to manage its animations.' })); return; }
    const grid = h('div', { class: 'anim-grid' });
    for (const id of my.animations) {
      const a = E.project.animations[id]; if (!a) continue;
      const c = document.createElement('canvas'); c.width = c.height = 72; c.style.width = c.style.height = '72px';
      renderCreatureTo(c, my, { anim: a, t: a.duration * 0.35, pad: 6 });
      grid.appendChild(h('div', { class: `acard ${E.animId === a.id ? 'active' : ''}`, dataset: { id: a.id }, onclick: () => { if (E.mode !== 'animation') UI.setMode('animation'); UI.setAnimation(a.id); this.render(); } }, [c, h('div', { class: 'title', text: a.name }), h('div', { class: 'sub', text: `${a.duration}s · ${Object.keys(a.tracks).length} tracks · ${a.loop ? 'loop' : 'once'}` }), h('div', { class: 'row' }, [h('button', { class: 'btn tiny', text: '▶', onclick: (e) => { e.stopPropagation(); if (E.mode !== 'animation') UI.setMode('animation'); UI.setAnimation(a.id); E.playing = true; this.syncTransport(); Scene.invalidate(); } }), h('button', { class: 'btn tiny ghost', text: 'EDIT', onclick: (e) => { e.stopPropagation(); UI.setMode('animation'); UI.setAnimation(a.id); this.show('timeline'); } })])]));
    }
    grid.appendChild(h('div', { class: 'acard add', onclick: () => Screens.newAnimation() }, [h('div', { class: 'plus', text: '+' }), h('div', { class: 'title', text: 'NEW ANIMATION' })]));
    body.appendChild(h('div', { class: 'tl-head' }, [h('b', { text: `${my.name} — ${my.animations.length} clips` }), h('span', { class: 'spacer' }), h('span', { class: 'hint', text: 'Standard clips: ' + ANIM_NAMES.join(' · ') })]));
    body.appendChild(grid);
  },
  // ------------------------------------------------------------- VFX tab (emitter editor)
  renderVfx(body) {
    const v = currentVfx();
    const head = h('div', { class: 'tl-head' }, [
      h('select', { class: 'map-select', onchange: (e) => { E.vfxId = e.target.value; UI.refreshAll(); } }, [...Object.values(E.project.vfx).map((x) => h('option', { value: x.id, selected: x.id === E.vfxId, text: `${x.name} (${x.category})` })), h('option', { value: '', text: '(select VFX)', selected: !v })]),
      h('button', { class: 'btn tiny primary', text: '▶ PLAY VFX', onclick: () => this.playVfx() }),
      h('button', { class: 'btn tiny', text: '+ NEW VFX', onclick: () => Screens.newVfx() }),
      v ? h('button', { class: 'btn tiny ghost', text: 'DUPLICATE', onclick: () => Ops.duplicateVfx(v.id) }) : null,
      v ? h('button', { class: 'btn tiny danger', text: 'DELETE', onclick: () => Ops.deleteVfx(v.id) }) : null,
      h('span', { class: 'spacer' }),
      v ? h('label', { class: 'inline' }, ['Name', h('input', { type: 'text', value: v.name, onchange: (e) => { History.run('~VFX name', () => { v.name = e.target.value; }); UI.refreshAll(); } })]) : null,
      v ? h('label', { class: 'inline' }, ['Category', h('select', { onchange: (e) => { History.run('VFX category', () => { v.category = e.target.value; }); Left.render(); } }, VFX_CATEGORIES.map((c) => h('option', { value: c, selected: v.category === c, text: c })))]) : null,
      v ? h('label', { class: 'inline' }, ['Duration', h('input', { type: 'number', step: 0.1, min: 0.1, value: v.duration, onchange: (e) => History.run('~VFX duration', () => { v.duration = Math.max(0.1, +e.target.value); }) }), 's']) : null,
    ]);
    body.appendChild(head);
    if (!v) { body.appendChild(h('div', { class: 'empty', text: 'Create or select a VFX to edit its emitters.' })); return; }
    if (E.mode !== 'vfx' && E.mode !== 'skills') body.appendChild(h('div', { class: 'hint', style: { padding: '4px 10px' } }, ['Preview plays in the creature studio. ', h('button', { class: 'btn tiny', text: 'OPEN VFX EDITOR', onclick: () => UI.setMode('vfx') })]));
    const wrap = h('div', { class: 'vfx-editor' });
    const list = h('div', { class: 'vfx-list' });
    if (!E.ui.emitterIdx || E.ui.emitterIdx >= v.emitters.length) E.ui.emitterIdx = 0;
    v.emitters.forEach((em, i) => list.appendChild(h('div', { class: `list-item compact ${E.ui.emitterIdx === i ? 'active' : ''}`, onclick: () => { E.ui.emitterIdx = i; this.render(); } }, [h('span', { class: 'dot', style: { background: em.color } }), h('span', { class: 'grow', text: `${em.name || em.type}` }), h('span', { class: 'dim', text: `${em.type} · ${em.attach}` })])));
    const addSel = h('select', { class: 'tiny' }, VFX_TYPES.map((t) => h('option', { value: t, text: titleCase(t) })));
    list.appendChild(h('div', { class: 'row', style: { display: 'flex', gap: '4px', padding: '6px', flexWrap: 'wrap' } }, [addSel, h('button', { class: 'btn tiny primary', text: '+ EMITTER', onclick: () => this.addEmitter(addSel.value) }), h('button', { class: 'btn tiny', text: 'DUPLICATE', onclick: () => { const em = v.emitters[E.ui.emitterIdx]; if (!em) return; History.run('Duplicate emitter', () => { const c = deepClone(em); c.id = uid('em'); c.name = `${em.name} Copy`; v.emitters.splice(E.ui.emitterIdx + 1, 0, c); }); E.ui.emitterIdx++; this.render(); } }), h('button', { class: 'btn tiny danger', text: 'REMOVE', onclick: () => { if (v.emitters.length <= 1) { toast('A VFX needs at least one emitter', 'warn'); return; } History.run('Remove emitter', () => { v.emitters.splice(E.ui.emitterIdx, 1); }); E.ui.emitterIdx = 0; this.render(); } })]));
    wrap.appendChild(list);
    const em = v.emitters[E.ui.emitterIdx];
    const props = h('div', { class: 'vfx-props' });
    if (em) {
      const ed = (label, fn) => { History.run(`~${label}`, fn); };
      const col = (children) => h('div', { class: 'vfx-col' }, children);
      props.append(
        col([fText('Name', () => em.name, (x) => { ed('Emitter name', () => { em.name = x; }); this.render(); }), fSelect('Type', () => em.type, (x) => { ed('Emitter type', () => { em.type = x; }); this.render(); }, VFX_TYPES.map((t) => [t, titleCase(t)])), fSelect('Attach to', () => em.attach, (x) => ed('Attach', () => { em.attach = x; }), ATTACH_POINTS), fRow([fNum('X', () => em.x, (x) => ed('Emitter', () => { em.x = x; })), fNum('Y', () => em.y, (x) => ed('Emitter', () => { em.y = x; }))]), fRow([fNum('Scale', () => em.scale, (x) => ed('Emitter', () => { em.scale = x; }), { step: 0.1 }), fNum('Rotation', () => em.rotation, (x) => ed('Emitter', () => { em.rotation = x; }), { unit: '°' })])]),
        col([fRow([fNum('Delay', () => em.delay, (x) => ed('Emitter', () => { em.delay = Math.max(0, x); }), { step: 0.05, unit: 's' }), fNum('Duration', () => em.duration, (x) => ed('Emitter', () => { em.duration = Math.max(0.05, x); }), { step: 0.05, unit: 's' })]), fRange('Opacity', () => em.opacity, (x) => ed('Emitter', () => { em.opacity = x; })), fColor('Color', () => em.color, (x) => ed('Emitter color', () => { em.color = x; })), fColor('Color 2', () => em.color2 || em.color, (x) => ed('Emitter color', () => { em.color2 = x; })), fSelect('Blend', () => em.blend || 'lighter', (x) => ed('Emitter', () => { em.blend = x; }), BLEND_MODES.map((b) => [b, b === 'source-over' ? 'normal' : b]))]),
        col([fRow([fNum('Count', () => em.count, (x) => ed('Emitter', () => { em.count = Math.max(1, Math.round(x)); }), { min: 1 }), fNum('Size', () => em.size, (x) => ed('Emitter', () => { em.size = Math.max(1, x); }), { min: 1 })]), fRow([fNum('Speed', () => em.speed, (x) => ed('Emitter', () => { em.speed = x; })), fNum('Lifetime', () => em.lifetime, (x) => ed('Emitter', () => { em.lifetime = Math.max(0.05, x); }), { step: 0.05, unit: 's' })]), fRow([fNum('Gravity', () => em.gravity, (x) => ed('Emitter', () => { em.gravity = x; })), fNum('Spread', () => em.spread, (x) => ed('Emitter', () => { em.spread = x; }), { unit: '°' })]), fRow([fNum('Glow', () => em.glow, (x) => ed('Emitter', () => { em.glow = Math.max(0, x); }), { min: 0 }), fNum('Trail', () => em.trail, (x) => ed('Emitter', () => { em.trail = Math.max(0, x); }), { min: 0 })])]),
      );
    }
    wrap.appendChild(props);
    body.appendChild(wrap);
  },
  addEmitter(type) { const v = currentVfx(); if (!v) { toast('Select a VFX first', 'warn'); return; } History.run('Add emitter', () => { v.emitters.push(emitter(type, { name: titleCase(type), attach: 'AttackOrigin' })); }); E.ui.emitterIdx = v.emitters.length - 1; this.render(); },
  playVfx(vfx = currentVfx()) {
    if (!vfx) { toast('No VFX selected', 'warn'); return; }
    if (!isCreatureMode() || E.mode === 'browser') UI.setMode('vfx');
    const my = currentMythling();
    VFXSystem.play(vfx, studioAnchors(my));
    E.targetHit = E.time + Math.min(...vfx.emitters.map((e) => (e.delay || 0) + (e.type === 'projectile' ? e.duration || 0.4 : 0.1)));
    Scene.startClock(Math.max(2000, (vfx.duration + 1.5) * 1000));
    ConsoleLog.info(`Played VFX "${vfx.name}" (${vfx.emitters.length} emitters)`);
  },
  // ------------------------------------------------------------- CONSOLE / OUTPUT
  renderConsole(body) {
    const wrap = h('div', { class: 'console' });
    body.appendChild(h('div', { class: 'tl-head' }, [h('b', { text: `CONSOLE — ${ConsoleLog.lines.length} entries` }), h('span', { class: 'spacer' }), h('button', { class: 'btn tiny', text: 'VALIDATE PROJECT', onclick: () => Exporter.validate(true) }), h('button', { class: 'btn tiny ghost', text: 'COPY', onclick: () => copyText(ConsoleLog.lines.map((l) => `[${l.t}] ${l.kind || 'info'}: ${l.msg}`).join('\n')) }), h('button', { class: 'btn tiny ghost', text: 'CLEAR', onclick: () => { ConsoleLog.lines.length = 0; this.render(); } })]));
    if (!ConsoleLog.lines.length) wrap.appendChild(h('div', { class: 'empty', text: 'No messages yet.' }));
    for (const l of ConsoleLog.lines.slice(-300)) wrap.appendChild(h('div', { class: `line ${l.kind}` }, [h('span', { class: 't', text: l.t }), h('span', { class: 'm', text: l.msg })]));
    body.appendChild(wrap);
    wrap.scrollTop = wrap.scrollHeight;
  },
  renderOutput(body) {
    body.appendChild(h('div', { class: 'tl-head' }, [h('b', { text: 'OUTPUT — last export / package' }), h('span', { class: 'spacer' }), h('button', { class: 'btn tiny', text: 'COPY', onclick: () => copyText(this.output) }), h('button', { class: 'btn tiny', text: 'OPEN EXPORT SCREEN', onclick: () => UI.setMode('export') })]));
    const ta = h('textarea', { class: 'output-wrap', readonly: true, spellcheck: 'false' }); ta.value = this.output || '// Nothing exported yet. Use FILE → Export… or the EXPORT mode.';
    body.appendChild(ta);
  },
};
