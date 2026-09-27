// =============================================================================
// Screens (center overlays): Mythling Browser, Evolution, Skills, VFX Library, Export + dialogs
// =============================================================================
const Screens = {
  current: null, previewRaf: null, previewT: 0,
  show(mode) {
    this.current = mode;
    const layer = $('#screen-layer'); layer.classList.add('active'); clear(layer);
    ({ browser: this.renderBrowser, evolution: this.renderEvolution, skills: this.renderSkills, vfxlib: this.renderVfxLib, export: this.renderExport }[mode] || (() => {})).call(this, layer);
  },
  hide() { this.current = null; const layer = $('#screen-layer'); layer.classList.remove('active'); clear(layer); this.stopPreview(); },
  refresh() { if (this.current && ['browser', 'evolution', 'skills', 'vfxlib', 'export'].includes(E.mode)) this.show(E.mode); },
  // live preview loop for screens with animated canvases
  startPreview(fn) { this.stopPreview(); let last = performance.now(); const loop = (ts) => { const dt = Math.min(0.1, (ts - last) / 1000); last = ts; this.previewT += dt; try { fn(this.previewT, dt); } catch (err) { console.error(err); } this.previewRaf = requestAnimationFrame(loop); }; this.previewRaf = requestAnimationFrame(loop); },
  stopPreview() { if (this.previewRaf) cancelAnimationFrame(this.previewRaf); this.previewRaf = null; },
  animByName(my, name) { return my.animations.map((id) => E.project.animations[id]).find((a) => a && a.name === name) || E.project.animations[my.animations[0]] || null; },
  // ------------------------------------------------------------- MYTHLING BROWSER
  renderBrowser(root) {
    const list = Object.values(E.project.mythlings);
    if (!E.project.mythlings[E.mythlingId]) E.mythlingId = list[0]?.id || null;
    const my = E.project.mythlings[E.mythlingId];
    const filter = E.ui.browserFilter || '';
    const left = h('div', { class: 'box list' }, [
      h('div', { class: 'panel-head' }, [h('span', { text: `MYTHLINGS (${list.length})` }), h('span', { class: 'actions' }, [h('button', { class: 'btn tiny primary', text: '+ NEW MYTHLING', onclick: () => this.newMythling() })])]),
      h('input', { class: 'search', placeholder: 'Search name / element / rarity…', value: filter, oninput: (e) => { E.ui.browserFilter = e.target.value; this.show('browser'); setTimeout(() => { const i = $('#screen-layer .search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); } }),
      ...list.filter((m) => !filter || `${m.name} ${m.element} ${m.rarity} ${m.breed} ${m.id}`.toLowerCase().includes(filter.toLowerCase())).map((m) => h('div', { class: `list-item ${m.id === E.mythlingId ? 'active' : ''}`, onclick: () => { E.mythlingId = m.id; this.show('browser'); } }, [creatureThumb(m, 48), h('div', { class: 'grow' }, [h('div', { class: 'title', text: m.name }), h('div', { class: 'sub', text: `${ELEMENTS[m.element]?.name || m.element} · ${m.rarity} · ${m.breed}` })]), h('span', { class: 'pill', style: { background: ELEMENTS[m.element]?.color || '#666' }, text: m.rarity })])),
    ]);
    const cv = h('canvas', { class: 'preview-canvas' });
    const animSel = h('select', { class: 'map-select' }, my ? my.animations.map((id) => E.project.animations[id]).filter(Boolean).map((a) => h('option', { value: a.id, text: a.name })) : []);
    const center = h('div', { class: 'box preview' }, [
      h('div', { class: 'panel-head' }, [h('span', { text: my ? `${my.name.toUpperCase()} — LIVE PREVIEW` : 'PREVIEW' }), h('span', { class: 'actions' }, [animSel, h('button', { class: 'btn tiny', text: 'PNG', title: 'Download PNG preview', onclick: () => my && Exporter.downloadCreaturePng(my) })])]),
      cv,
      my ? h('div', { class: 'btn-row' }, [
        h('button', { class: 'btn primary', text: 'EDIT DESIGN', onclick: () => UI.openMythling(my.id, 'creature') }),
        h('button', { class: 'btn', text: 'EDIT RIG', onclick: () => { UI.openMythling(my.id, 'creature'); UI.setTool('pivot'); UI.showLeftTab('parts'); } }),
        h('button', { class: 'btn', text: 'EDIT ANIMATION', onclick: () => UI.openMythling(my.id, 'animation') }),
        h('button', { class: 'btn', text: 'EDIT VFX', onclick: () => { UI.openMythling(my.id, 'vfx'); } }),
        h('button', { class: 'btn', text: 'EDIT DATA', onclick: () => { UI.openMythling(my.id, 'creature'); UI.showRightTab('data'); } }),
        h('button', { class: 'btn', text: 'EVOLUTION', onclick: () => UI.openMythling(my.id, 'evolution') }),
        h('button', { class: 'btn', text: 'PLAYTEST', onclick: () => { UI.openMythling(my.id, 'creature'); Playtest.start('creature'); } }),
        h('button', { class: 'btn ghost', text: 'DUPLICATE', onclick: () => Ops.duplicateMythling(my.id) }),
        h('button', { class: 'btn danger ghost', text: 'DELETE', onclick: () => Ops.deleteMythling(my.id) }),
      ]) : h('div', { class: 'empty', text: 'No Mythlings in this project yet.' }),
    ]);
    const right = h('div', { class: 'box info' }, my ? [
      h('div', { class: 'panel-head' }, [h('span', { text: 'INFO' })]),
      h('h2', { text: my.name }), h('div', { class: 'sub', text: `${my.breed} · ${my.role}` }),
      h('div', { class: 'chips' }, [h('span', { class: 'chip', style: { borderColor: ELEMENTS[my.element]?.color }, text: ELEMENTS[my.element]?.name || my.element }), h('span', { class: 'chip', text: `Rarity ${my.rarity}` }), h('span', { class: 'chip', text: `Mood: ${my.mood}` }), h('span', { class: 'chip', text: `Stage ${my.stage + 1}` })]),
      h('p', { class: 'desc', text: my.description }),
      h('div', { class: 'stat-grid' }, Object.entries(my.stats).map(([k, v]) => h('div', { class: 'stat' }, [h('span', { class: 'k', text: k.toUpperCase() }), h('div', { class: 'bar' }, [h('div', { class: 'fill', style: { width: `${clamp(v / 1.6, 2, 100)}%`, background: ELEMENTS[my.element]?.color } })]), h('span', { class: 'v', text: String(v) })]))),
      kvRow('ID', my.id), kvRow('Body template', my.bodyType), kvRow('Catch rate', String(my.catchRate)), kvRow('Ultimate', my.ultimate || '—'),
      kvRow('Parts', String(Object.values(my.rig.nodes).filter((n) => n.type !== 'anchor').length)), kvRow('Anchors', Object.values(my.rig.nodes).filter((n) => n.type === 'anchor').map((n) => n.name).join(', ')),
      kvRow('Animations', my.animations.map((id) => E.project.animations[id]?.name).filter(Boolean).join(', ') || '—'),
      kvRow('VFX', (my.vfx || []).map((id) => E.project.vfx[id]?.name || id).join(', ') || '—'),
      kvRow('Evolutions', my.evolutions.map((e) => `${e.name} (Lv.${e.level})`).join(' → ')),
    ] : []);
    root.appendChild(h('div', { class: 'screen browser' }, [left, center, right]));
    if (my) {
      let anim = this.animByName(my, 'Idle');
      animSel.value = anim ? anim.id : ''; animSel.onchange = () => { anim = E.project.animations[animSel.value]; this.previewT = 0; };
      this.startPreview((t) => { if (!cv.isConnected) { this.stopPreview(); return; } renderCreatureTo(cv, my, { anim, t, pad: 40, background: '#141a24' }); });
    }
  },
  // ------------------------------------------------------------- EVOLUTION EDITOR
  renderEvolution(root) {
    const my = currentMythling();
    if (!my) { root.appendChild(h('div', { class: 'screen evolution' }, [h('div', { class: 'empty', text: 'Open a Mythling first.' })])); return; }
    if (!my.evolutions.length) my.evolutions = [{ stage: 0, name: my.name, level: 1, statMult: 1, future: false, skills: [], ultimate: `${my.ultimate || 'Ultimate'} I` }];
    const idx = clamp(E.ui.evoStage || 0, 0, my.evolutions.length - 1); E.ui.evoStage = idx;
    const st = my.evolutions[idx];
    const ed = (label, fn) => { History.run(`~${label}`, fn); };
    const tabs = h('div', { class: 'stage-tabs' }, [...my.evolutions.map((e, i) => h('button', { class: `stage-tab ${i === idx ? 'active' : ''} ${e.future ? 'future' : ''}`, onclick: () => { E.ui.evoStage = i; this.show('evolution'); } }, [h('b', { text: `Lv.${e.level}` }), h('span', { text: e.name }), e.future ? h('span', { class: 'pill tiny', text: e.level >= 80 ? 'FUTURE' : 'LOCKED' }) : null])), h('button', { class: 'stage-tab add', text: '+ STAGE', onclick: () => { History.run('Add stage', () => { const last = my.evolutions[my.evolutions.length - 1]; my.evolutions.push({ stage: my.evolutions.length, name: `${my.name} ${['II', 'III', 'IV', 'V'][my.evolutions.length - 1] || my.evolutions.length + 1}`, level: Math.min(100, (last?.level || 1) + 20), statMult: round((last?.statMult || 1) + 0.3, 2), future: true, skills: [], ultimate: `${my.ultimate || 'Ultimate'} ${['I', 'II', 'III', 'IV', 'V'][my.evolutions.length] || ''}` }); }); E.ui.evoStage = my.evolutions.length - 1; this.show('evolution'); } })]);
    const cv = h('canvas', { class: 'preview-canvas' });
    const stageMy = st.mythlingId && E.project.mythlings[st.mythlingId] ? E.project.mythlings[st.mythlingId] : my;
    const preview = h('div', { class: 'box preview' }, [h('div', { class: 'panel-head' }, [h('span', { text: `STAGE ${idx + 1} — ${st.name.toUpperCase()}` }), h('span', { class: 'actions' }, [st.mythlingId && E.project.mythlings[st.mythlingId] ? h('button', { class: 'btn tiny', text: 'EDIT STAGE RIG', onclick: () => UI.openMythling(st.mythlingId, 'creature') }) : h('button', { class: 'btn tiny', text: 'CREATE STAGE RIG', title: 'Duplicate the base rig as an editable Mythling for this stage', onclick: () => { const key = `${my.id}_stage${idx + 1}`; if (E.project.mythlings[key]) { ed('Link stage', () => { st.mythlingId = key; }); this.show('evolution'); return; } const c = deepClone(my); c.id = key; c.name = st.name; c.stage = idx; c.animations = []; c.evolutions = []; History.run('Create stage rig', () => { E.project.mythlings[key] = c; for (const aid of my.animations) { const a = E.project.animations[aid]; if (!a) continue; const ca = deepClone(a); ca.id = uid('anim'); ca.mythlingId = key; E.project.animations[ca.id] = ca; c.animations.push(ca.id); } st.mythlingId = key; }); this.show('evolution'); } })])]), cv, h('div', { class: 'hint', text: st.future ? 'This stage is marked LOCKED / FUTURE — exported as planned content.' : 'Preview scale grows with the stat multiplier; create a stage rig to design a unique look.' })]);
    const flow = h('div', { class: 'evo-flow' }, my.evolutions.flatMap((e, i) => [h('div', { class: `evo-node ${i === idx ? 'active' : ''}`, onclick: () => { E.ui.evoStage = i; this.show('evolution'); } }, [creatureThumb(e.mythlingId && E.project.mythlings[e.mythlingId] ? E.project.mythlings[e.mythlingId] : my, 44), h('div', { class: 'title', text: e.name }), h('div', { class: 'sub', text: `Lv.${e.level} · ×${e.statMult}` })]), i < my.evolutions.length - 1 ? h('div', { class: 'arrow', text: '→' }) : null]));
    const skills = Object.values(E.project.skills);
    const data = h('div', { class: 'box info' }, [
      h('div', { class: 'panel-head' }, [h('span', { text: 'STAGE DATA' }), h('span', { class: 'actions' }, [my.evolutions.length > 1 ? h('button', { class: 'btn tiny danger', text: 'REMOVE STAGE', onclick: () => { History.run('Remove stage', () => { my.evolutions.splice(idx, 1); my.evolutions.forEach((e, i) => { e.stage = i; }); }); E.ui.evoStage = 0; this.show('evolution'); } }) : null])]),
      fText('Stage name', () => st.name, (v) => { ed('Stage name', () => { st.name = v; }); this.show('evolution'); }),
      fNum('Evolves at level', () => st.level, (v) => { ed('Stage level', () => { st.level = Math.max(1, Math.round(v)); }); }, { min: 1, max: 100 }),
      fNum('Stat multiplier', () => st.statMult, (v) => ed('Stat mult', () => { st.statMult = Math.max(0.1, v); }), { step: 0.05 }),
      fText('Ultimate', () => st.ultimate || '', (v) => ed('Ultimate', () => { st.ultimate = v; })),
      fSelect('Status', () => (st.future ? 'future' : 'available'), (v) => { ed('Stage status', () => { st.future = v === 'future'; }); this.show('evolution'); }, [['available', 'Available'], ['future', 'Locked / Future']]),
      h('div', { class: 'field col' }, [h('label', { text: 'Skills unlocked at this stage' }), h('div', { class: 'chips' }, skills.map((s) => h('button', { class: `chip ${st.skills.includes(s.id) ? 'active' : ''}`, text: s.name, onclick: (e) => { ed('Stage skills', () => { st.skills = st.skills.includes(s.id) ? st.skills.filter((x) => x !== s.id) : [...st.skills, s.id]; }); e.target.classList.toggle('active'); } })))]),
      h('div', { class: 'panel-head' }, [h('span', { text: 'PROJECTED STATS' })]),
      h('div', { class: 'stat-grid' }, Object.entries(my.stats).map(([k, v]) => h('div', { class: 'stat' }, [h('span', { class: 'k', text: k.toUpperCase() }), h('div', { class: 'bar' }, [h('div', { class: 'fill', style: { width: `${clamp((v * st.statMult) / 3, 2, 100)}%`, background: ELEMENTS[my.element]?.color } })]), h('span', { class: 'v', text: String(Math.round(v * st.statMult)) })]))),
      h('div', { class: 'btn-row' }, [h('button', { class: 'btn', text: 'BACK TO DESIGN', onclick: () => UI.setMode('creature') }), h('button', { class: 'btn', text: 'SKILL EDITOR', onclick: () => UI.setMode('skills') }), h('button', { class: 'btn primary', text: 'EXPORT MYTHLING', onclick: () => { E.exportKind = 'mythling'; UI.setMode('export'); } })]),
    ]);
    root.appendChild(h('div', { class: 'screen evolution' }, [h('div', { class: 'evo-top' }, [tabs, flow]), h('div', { class: 'evo-main' }, [preview, data])]));
    const anim = this.animByName(stageMy, 'Idle');
    this.startPreview((t) => { if (!cv.isConnected) { this.stopPreview(); return; } renderCreatureTo(cv, stageMy, { anim, t, pad: 40, background: st.future ? '#1a1418' : '#141a24', scaleMult: clamp(0.7 + st.statMult * 0.25, 0.6, 1.4) }); if (st.future) { const ctx = cv.getContext('2d'); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#f2c761'; ctx.font = `bold ${Math.round(cv.width / 18)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(st.level >= 80 ? 'FUTURE' : 'LOCKED', cv.width / 2, cv.height / 2); ctx.restore(); } });
  },
  // ------------------------------------------------------------- SKILL EDITOR
  renderSkills(root) {
    const skills = Object.values(E.project.skills);
    if (!E.project.skills[E.skillId]) E.skillId = skills[0]?.id || null;
    const s = E.project.skills[E.skillId];
    const my = currentMythling();
    const filter = E.ui.skillFilter || 'all';
    const ed = (label, fn) => { History.run(`~${label}`, fn); };
    const left = h('div', { class: 'box list' }, [
      h('div', { class: 'panel-head' }, [h('span', { text: `SKILLS (${skills.length})` }), h('span', { class: 'actions' }, [h('button', { class: 'btn tiny primary', text: '+ NEW', onclick: () => Ops.createSkill({ element: filter === 'all' ? 'nature' : filter }) })])]),
      h('div', { class: 'chips', style: { padding: '6px' } }, ['all', ...Object.keys(ELEMENTS)].map((el) => h('button', { class: `chip ${filter === el ? 'active' : ''}`, text: el.toUpperCase(), onclick: () => { E.ui.skillFilter = el; this.show('skills'); } }))),
      ...skills.filter((x) => filter === 'all' || x.element === filter).map((x) => h('div', { class: `list-item ${x.id === E.skillId ? 'active' : ''}`, onclick: () => { E.skillId = x.id; this.show('skills'); } }, [h('span', { class: 'dot', style: { background: ELEMENTS[x.element]?.color || '#888' } }), h('div', { class: 'grow' }, [h('div', { class: 'title', text: x.name }), h('div', { class: 'sub', text: `${x.type} · pow ${x.power} · ${x.uses} uses` })])])),
    ]);
    const cv = h('canvas', { class: 'preview-canvas' });
    const casterSel = h('select', { class: 'map-select', title: 'Caster', onchange: (e) => { E.mythlingId = e.target.value; this.show('skills'); } }, Object.values(E.project.mythlings).map((m) => h('option', { value: m.id, selected: m.id === E.mythlingId, text: m.name })));
    const center = h('div', { class: 'box preview' }, [
      h('div', { class: 'panel-head' }, [h('span', { text: 'BATTLE PREVIEW — CASTER vs TARGET' }), h('span', { class: 'actions' }, [casterSel, h('button', { class: 'btn tiny primary', text: '▶ PREVIEW', onclick: () => this.previewSkill(s, my) })])]),
      cv,
      h('div', { class: 'hint', text: 'Preview plays the caster animation, spawns the VFX at its attach points and shakes the camera by the configured amount. Press PREVIEW again to replay.' }),
    ]);
    const right = h('div', { class: 'box info' }, s ? [
      h('div', { class: 'panel-head' }, [h('span', { text: 'SKILL PROPERTIES' })]),
      fText('Name', () => s.name, (v) => { ed('Skill name', () => { s.name = v; }); this.show('skills'); }),
      kvRow('ID', s.id),
      fSelect('Element', () => s.element, (v) => { ed('Skill element', () => { s.element = v; }); this.show('skills'); }, Object.entries(ELEMENTS).map(([k, e]) => [k, e.name])),
      fSelect('Type', () => s.type, (v) => ed('Skill type', () => { s.type = v; }), ['attack', 'special', 'buff', 'debuff', 'heal', 'ultimate', 'status']),
      fRow([fNum('Power', () => s.power, (v) => ed('Skill power', () => { s.power = Math.max(0, Math.round(v)); }), { min: 0 }), fNum('Uses', () => s.uses, (v) => ed('Skill uses', () => { s.uses = Math.max(1, Math.round(v)); }), { min: 1 })]),
      fSelect('Animation', () => s.animation, (v) => ed('Skill animation', () => { s.animation = v; }), ANIM_NAMES),
      fSelect('VFX', () => s.vfx || '', (v) => ed('Skill VFX', () => { s.vfx = v; }), [['', '(none)'], ...Object.values(E.project.vfx).map((v) => [v.id, `${v.name} (${v.category})`])]),
      fSelect('Sound', () => s.sound || '', (v) => ed('Skill sound', () => { s.sound = v; }), ['', 'hit_soft', 'hit_hard', 'slash', 'splash', 'flame', 'leaf', 'buff', 'debuff', 'heal', 'roar', 'ultimate']),
      fRange('Camera shake', () => s.shake || 0, (v) => ed('Skill shake', () => { s.shake = v; }), { min: 0, max: 1, step: 0.05 }),
      fText('Description', () => s.description || '', (v) => ed('Skill description', () => { s.description = v; }), { multiline: true }),
      h('div', { class: 'btn-row' }, [
        h('button', { class: 'btn', text: 'EDIT ANIMATION', onclick: () => { if (!my) return; const a = this.animByName(my, s.animation); UI.openMythling(my.id, 'animation'); if (a) UI.setAnimation(a.id); else Ops.createAnimation(my, { name: s.animation, duration: 0.8, loop: false }); } }),
        h('button', { class: 'btn', text: 'EDIT VFX', onclick: () => { if (s.vfx && E.project.vfx[s.vfx]) { E.vfxId = s.vfx; UI.setMode('vfx'); } else this.newVfx({ name: `${s.name} FX`, category: titleCase(s.element) }).then((v) => { if (v) { ed('Skill VFX', () => { s.vfx = v.id; }); } }); } }),
        h('button', { class: 'btn primary', text: 'PREVIEW', onclick: () => this.previewSkill(s, my) }),
        h('button', { class: 'btn good', text: 'SAVE', onclick: () => App.save() }),
        h('button', { class: 'btn danger ghost', text: 'DELETE', onclick: () => Ops.deleteSkill(s.id) }),
      ]),
    ] : [h('div', { class: 'empty', text: 'No skill selected.' })]);
    root.appendChild(h('div', { class: 'screen skills' }, [left, center, right]));
    // preview loop
    this.skillState = { my, anim: my ? this.animByName(my, 'Battle Idle') : null, t: 0, playing: null, shake: 0 };
    this.startPreview((t, dt) => {
      if (!cv.isConnected) { this.stopPreview(); return; }
      const ss = this.skillState; ss.t += dt; VFXSystem.update(dt);
      const ctx = cv.getContext('2d'); const dpr = Math.min(2, window.devicePixelRatio || 1); const cw = cv.clientWidth || 600, ch = cv.clientHeight || 340;
      if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, '#1a2434'); g.addColorStop(1, '#0f141c'); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, ch * 0.72, cw, ch);
      const scale = Math.min(cw / 640, ch / 360); const sh = ss.shake > 0 ? (Math.random() - 0.5) * ss.shake * 24 : 0; ss.shake = Math.max(0, ss.shake - dt * 2);
      ctx.save(); ctx.translate(cw * 0.3 + sh, ch * 0.72); ctx.scale(scale, scale);
      if (ss.my) { let anim = ss.anim, t = ss.t; if (ss.playing) { anim = ss.playing.anim; t = ss.t - ss.playing.start; if (anim && t > anim.duration) { ss.playing = null; anim = ss.anim; t = ss.t; } } const offsetFn = anim ? (id) => (anim.tracks[id] ? sampleTrack(anim.tracks[id], t, anim) : null) : NO_ANIM; ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 3, 50, 9, 0, 0, 7); ctx.fill(); renderDoc(ctx, ss.my.rig, { offsetFn, still: true }); const [ax, ay] = anchorWorld(ss.my, 'AttackOrigin', offsetFn); ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, 7); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.translate(cw * 0.3 + sh, ch * 0.72); ctx.scale(scale, scale); Scene.drawTargetDummy(ctx, ss.my); VFXSystem.render(ctx); ctx.restore();
      ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(ss.my ? `CASTER: ${ss.my.name}` : 'CASTER', 12, 20); ctx.textAlign = 'right'; ctx.fillText('TARGET', cw - 12, 20);
      if (s) { ctx.textAlign = 'center'; ctx.fillStyle = '#f2c761'; ctx.fillText(`${s.name} · ${s.element} · ${s.type} · POW ${s.power}`, cw / 2, ch - 12); }
    });
  },
  previewSkill(s, my) {
    if (!s || !my || !this.skillState) return;
    const ss = this.skillState;
    const anim = this.animByName(my, s.animation);
    ss.playing = anim ? { anim, start: ss.t } : null;
    const vfx = E.project.vfx[s.vfx];
    if (vfx) setTimeout(() => { VFXSystem.play(vfx, studioAnchors(my)); }, anim ? Math.min(400, anim.duration * 400) : 0);
    setTimeout(() => { ss.shake = s.shake || 0; }, 380);
    ConsoleLog.info(`Skill preview: ${s.name} (${s.animation}${vfx ? ' + ' + vfx.name : ''})`);
  },
  // ------------------------------------------------------------- VFX LIBRARY
  renderVfxLib(root) {
    const cat = E.ui.vfxCat || 'All';
    const list = Object.values(E.project.vfx).filter((v) => cat === 'All' || v.category === cat);
    const grid = h('div', { class: 'grid-cards big' });
    for (const v of list) {
      const c = document.createElement('canvas'); c.width = c.height = 96; c.style.width = c.style.height = '96px';
      const ctx = c.getContext('2d'); ctx.fillStyle = '#141a24'; ctx.fillRect(0, 0, 96, 96);
      const em = v.emitters[0]; if (em) { const g = ctx.createRadialGradient(48, 48, 2, 48, 48, 40); g.addColorStop(0, '#fff'); g.addColorStop(0.35, em.color); g.addColorStop(1, rgba(em.color2 || em.color, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(48, 48, 40, 0, 7); ctx.fill(); const rnd = seededRandom(hash2(v.id.length, v.emitters.length) * 1000); ctx.fillStyle = em.color2 || em.color; for (let i = 0; i < 14; i++) { ctx.globalAlpha = 0.4 + rnd() * 0.6; ctx.beginPath(); ctx.arc(10 + rnd() * 76, 10 + rnd() * 76, 1 + rnd() * 3, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
      grid.appendChild(h('div', { class: `card ${v.id === E.vfxId ? 'active' : ''}`, onclick: () => { E.vfxId = v.id; UI.setMode('vfx'); } }, [h('div', { class: 'card-img' }, [c]), h('div', { class: 'card-title', text: v.name }), h('div', { class: 'card-sub', text: `${v.category} · ${v.emitters.length} emitters · ${v.duration}s · ${[...new Set(v.emitters.map((e) => e.type))].join(', ')}` }), h('div', { class: 'card-actions' }, [h('button', { class: 'btn tiny primary', text: 'EDIT', onclick: (e) => { e.stopPropagation(); E.vfxId = v.id; UI.setMode('vfx'); } }), h('button', { class: 'btn tiny', text: '▶ PLAY', onclick: (e) => { e.stopPropagation(); E.vfxId = v.id; UI.setMode('vfx'); setTimeout(() => Bottom.playVfx(), 50); } }), h('button', { class: 'btn tiny ghost', text: 'DUPLICATE', onclick: (e) => { e.stopPropagation(); Ops.duplicateVfx(v.id); UI.setMode('vfxlib'); } }), h('button', { class: 'btn tiny danger', text: '✕', onclick: (e) => { e.stopPropagation(); Ops.deleteVfx(v.id).then(() => UI.setMode('vfxlib')); } })])]));
    }
    root.appendChild(h('div', { class: 'screen vfxlib' }, [
      h('div', { class: 'panel-head big' }, [h('span', { text: `VFX LIBRARY — ${Object.keys(E.project.vfx).length} effects` }), h('span', { class: 'actions' }, [h('button', { class: 'btn primary', text: '+ NEW VFX', onclick: () => this.newVfx() }), h('button', { class: 'btn', text: 'OPEN VFX EDITOR', onclick: () => UI.setMode('vfx') })])]),
      h('div', { class: 'chips', style: { padding: '8px 14px' } }, ['All', ...VFX_CATEGORIES].map((c) => h('button', { class: `chip ${cat === c ? 'active' : ''}`, text: c.toUpperCase(), onclick: () => { E.ui.vfxCat = c; this.show('vfxlib'); } }))),
      list.length ? grid : h('div', { class: 'empty', text: 'No VFX in this category.' }),
      h('div', { class: 'hint', style: { padding: '10px 14px' }, text: `Emitter types: ${VFX_TYPES.join(', ')}. Attach points: ${ATTACH_POINTS.join(', ')}.` }),
    ]));
  },
  // ------------------------------------------------------------- EXPORT SCREEN
  renderExport(root) {
    const kinds = [['project', 'PROJECT'], ['map', 'MAP'], ['mythling', 'MYTHLING'], ['animation', 'ANIMATION'], ['vfx', 'VFX'], ['object', 'OBJECT']];
    if (!E.exportKind) E.exportKind = 'project';
    if (!E.exportFormats) E.exportFormats = { json: true, js: true, png: false, debug: false };
    const kind = E.exportKind, F = E.exportFormats;
    const itemsFor = { project: [[E.project.project.id, E.project.project.name]], map: Object.values(E.project.maps).map((m) => [m.id, m.name]), mythling: Object.values(E.project.mythlings).map((m) => [m.id, m.name]), animation: Object.values(E.project.animations).map((a) => [a.id, `${a.name} (${E.project.mythlings[a.mythlingId]?.name || '?'})`]), vfx: Object.values(E.project.vfx).map((v) => [v.id, v.name]), object: Object.values(E.project.objects).map((o) => [o.id, o.name]) }[kind];
    if (!itemsFor.some(([id]) => id === E.exportItem)) E.exportItem = kind === 'map' ? E.mapId : kind === 'mythling' ? E.mythlingId : kind === 'animation' ? E.animId : kind === 'vfx' ? E.vfxId : itemsFor[0]?.[0];
    if (!itemsFor.some(([id]) => id === E.exportItem)) E.exportItem = itemsFor[0]?.[0] || null;
    const preview = h('textarea', { class: 'export-preview', readonly: true, spellcheck: 'false' });
    const pkg = h('textarea', { class: 'export-preview pkg', readonly: true, spellcheck: 'false' });
    const LIMIT = 300000; const refresh = () => { try { const r = Exporter.build(kind, E.exportItem, F); preview.value = r.preview.length > LIMIT ? `${r.preview.slice(0, LIMIT)}\n\n// … preview truncated at ${Math.round(LIMIT / 1000)}K characters (${(r.preview.length / 1024).toFixed(0)} KB total) — EXPORT or COPY TO CLIPBOARD gives the complete output …` : r.preview; preview.dataset.full = ''; pkg.value = Exporter.arenaPackage(kind, E.exportItem, r); Bottom.setOutput(r.preview.slice(0, LIMIT)); this._exportFull = r.preview; } catch (err) { preview.value = `// Export error: ${err.message}`; console.error(err); } };
    const left = h('div', { class: 'box list export-opts' }, [
      h('div', { class: 'panel-head' }, [h('span', { text: 'WHAT TO EXPORT' })]),
      h('div', { class: 'chips col' }, kinds.map(([k, l]) => h('button', { class: `chip big ${kind === k ? 'active' : ''}`, text: l, onclick: () => { E.exportKind = k; E.exportItem = null; this.show('export'); } }))),
      kind !== 'project' ? h('div', { class: 'field col' }, [h('label', { text: 'Item' }), h('select', { onchange: (e) => { E.exportItem = e.target.value; refresh(); } }, itemsFor.map(([id, l]) => h('option', { value: id, selected: id === E.exportItem, text: l })))]) : null,
      h('div', { class: 'panel-head' }, [h('span', { text: 'FORMATS' })]),
      fCheck('JSON (data file)', () => F.json, (v) => { F.json = v; refresh(); }),
      fCheck('JavaScript (register* calls)', () => F.js, (v) => { F.js = v; refresh(); }),
      fCheck('PNG preview (creature / map thumbnail)', () => F.png, (v) => { F.png = v; refresh(); }),
      fCheck('Debug info (bounds, counts, warnings)', () => F.debug, (v) => { F.debug = v; refresh(); }),
      h('div', { class: 'btn-row col' }, [
        h('button', { class: 'btn primary', text: '⬇ EXPORT (DOWNLOAD FILES)', onclick: () => Exporter.download(kind, E.exportItem, F) }),
        h('button', { class: 'btn', text: 'COPY TO CLIPBOARD', onclick: () => copyText(this._exportFull || preview.value) }),
        h('button', { class: 'btn good', text: 'COPY FOR ARENA AI', onclick: () => copyText(pkg.value) }),
        h('button', { class: 'btn ghost', text: 'VALIDATE PROJECT', onclick: () => { Exporter.validate(true); refresh(); } }),
      ]),
      h('div', { class: 'hint', text: 'JavaScript output uses registerMythling / registerMap / registerAnimation / registerVFX / registerObject — implement these in the game to load editor data.' }),
    ]);
    const center = h('div', { class: 'box preview' }, [h('div', { class: 'panel-head' }, [h('span', { text: 'PREVIEW' }), h('span', { class: 'actions' }, [h('button', { class: 'btn tiny', text: 'REFRESH', onclick: refresh })])]), preview]);
    const right = h('div', { class: 'box info' }, [h('div', { class: 'panel-head' }, [h('span', { text: 'ARENA AI IMPLEMENTATION PACKAGE' }), h('span', { class: 'actions' }, [h('button', { class: 'btn tiny good', text: 'COPY EVERYTHING', onclick: () => copyText(pkg.value) })])]), pkg, h('div', { class: 'hint', text: 'Read-only. Paste this whole package into Arena AI to implement the content in the game: it contains the data, the schema and integration notes.' })]);
    root.appendChild(h('div', { class: 'screen export' }, [left, center, right]));
    refresh();
  },
  // ------------------------------------------------------------- dialogs
  async newMap() {
    const f = { name: h('input', { type: 'text', value: 'New Map' }), width: h('input', { type: 'number', value: 2400, step: 32, min: 320 }), height: h('input', { type: 'number', value: 1400, step: 32, min: 320 }), theme: h('select', {}, ['nature', 'coast', 'volcano', 'town', 'cave', 'ruins', 'sky', 'custom'].map((t) => h('option', { value: t, text: t }))), music: h('input', { type: 'text', value: 'vale' }), levelMin: h('input', { type: 'number', value: 1, min: 1 }), levelMax: h('input', { type: 'number', value: 10, min: 1 }), weather: h('select', {}, ['clear', 'rain', 'petals', 'fog', 'ash', 'snow', 'sunset'].map((t) => h('option', { value: t, text: t }))), background: h('input', { type: 'color', value: '#4f9d4a' }), baseTerrain: h('select', {}, TERRAINS.filter((t) => t.color).map((t) => h('option', { value: t.id, text: t.name }))), camMinX: h('input', { type: 'number', value: 0 }), camMinY: h('input', { type: 'number', value: 0 }), camMaxX: h('input', { type: 'number', value: 2400 }), camMaxY: h('input', { type: 'number', value: 1400 }) };
    const row = (l, el) => h('div', { class: 'field' }, [h('label', { text: l }), el]);
    const body = h('div', { class: 'form-grid' }, [row('Name', f.name), row('Width (px)', f.width), row('Height (px)', f.height), row('Theme', f.theme), row('Music', f.music), row('Level min', f.levelMin), row('Level max', f.levelMax), row('Weather', f.weather), row('Background', f.background), row('Base terrain', f.baseTerrain), row('Camera min X', f.camMinX), row('Camera min Y', f.camMinY), row('Camera max X', f.camMaxX), row('Camera max Y', f.camMaxY)]);
    f.width.onchange = () => { f.camMaxX.value = f.width.value; }; f.height.onchange = () => { f.camMaxY.value = f.height.value; };
    const r = await dialog({ title: 'NEW MAP', body, buttons: [{ label: 'CANCEL', value: null }, { label: 'CREATE MAP', value: 'ok', primary: true }] });
    if (r !== 'ok') return;
    const map = Ops.createMap({ name: f.name.value || 'New Map', width: Math.max(320, +f.width.value), height: Math.max(320, +f.height.value), theme: f.theme.value, music: f.music.value, levelMin: +f.levelMin.value, levelMax: +f.levelMax.value, weather: f.weather.value, background: f.background.value, baseTerrain: f.baseTerrain.value });
    History.run('Camera limits', () => { map.camera = { minX: +f.camMinX.value, minY: +f.camMinY.value, maxX: +f.camMaxX.value, maxY: +f.camMaxY.value }; });
    toast(`Created map "${map.name}"`, 'ok');
  },
  async resizeMap() {
    const map = currentMap(); if (!map) return;
    const w = h('input', { type: 'number', value: map.width, step: 32, min: 320 }), hh = h('input', { type: 'number', value: map.height, step: 32, min: 320 });
    const r = await dialog({ title: 'RESIZE MAP', body: h('div', { class: 'form-grid' }, [h('div', { class: 'field' }, [h('label', { text: 'Width' }), w]), h('div', { class: 'field' }, [h('label', { text: 'Height' }), hh]), h('div', { class: 'hint', text: 'Terrain and collision are preserved from the top-left corner. Objects outside the new bounds stay where they are.' })]), buttons: [{ label: 'CANCEL', value: null }, { label: 'RESIZE', value: 'ok', primary: true }] });
    if (r === 'ok') Ops.resizeMap(map, Math.max(320, +w.value), Math.max(320, +hh.value));
  },
  async newMythling() {
    const f = { name: h('input', { type: 'text', value: 'New Mythling' }), id: h('input', { type: 'text', placeholder: 'auto from name' }), template: h('select', {}, Object.entries(SPECIES_TEMPLATES).map(([k, t]) => h('option', { value: k, text: `${t.name} (${t.body} · ${t.element})` }))), element: h('select', {}, Object.entries(ELEMENTS).map(([k, e]) => h('option', { value: k, text: e.name }))), rarity: h('select', {}, RARITIES.map((r) => h('option', { value: r, text: r, selected: r === 'C' }))), breed: h('input', { type: 'text', placeholder: 'e.g. Sprout Fox' }), description: h('textarea', { rows: 3 }) };
    const row = (l, el) => h('div', { class: 'field' }, [h('label', { text: l }), el]);
    const r = await dialog({ title: 'NEW MYTHLING', body: h('div', { class: 'form-grid' }, [row('Name', f.name), row('ID', f.id), row('Template rig', f.template), row('Element', f.element), row('Rarity', f.rarity), row('Breed', f.breed), h('div', { class: 'field col' }, [h('label', { text: 'Description' }), f.description]), h('div', { class: 'hint', text: 'The template provides a rig (8–12 parts with anchors) and the 12 standard animations. Everything is editable afterwards.' })]), buttons: [{ label: 'CANCEL', value: null }, { label: 'CREATE', value: 'ok', primary: true }] });
    if (r !== 'ok') return;
    Ops.createMythling({ id: f.id.value, name: f.name.value || 'New Mythling', template: f.template.value, element: f.element.value, rarity: f.rarity.value, breed: f.breed.value, description: f.description.value });
  },
  async newAnimation() {
    const my = currentMythling(); if (!my) { toast('Open a Mythling first', 'warn'); return; }
    const f = { name: h('select', {}, [...ANIM_NAMES.map((n) => h('option', { value: n, text: n })), h('option', { value: '__custom', text: 'Custom name…' })]), custom: h('input', { type: 'text', placeholder: 'Custom clip name', class: 'hidden' }), duration: h('input', { type: 'number', value: 1, step: 0.1, min: 0.1 }), loop: h('input', { type: 'checkbox', checked: true }), fps: h('select', {}, [12, 24, 30, 60].map((x) => h('option', { value: x, text: String(x), selected: x === 60 }))), easing: h('select', {}, EASING_IDS.map((x) => h('option', { value: x, text: titleCase(x), selected: x === 'easeInOut' }))) };
    f.name.onchange = () => { f.custom.classList.toggle('hidden', f.name.value !== '__custom'); const loops = ['Idle', 'Walk', 'Run', 'Battle Idle'].includes(f.name.value); f.loop.checked = loops; f.duration.value = loops ? 1.2 : 0.8; };
    const row = (l, el) => h('div', { class: 'field' }, [h('label', { text: l }), el]);
    const r = await dialog({ title: 'NEW ANIMATION', body: h('div', { class: 'form-grid' }, [row('Name', f.name), row('', f.custom), row('Duration (s)', f.duration), row('FPS', f.fps), row('Default easing', f.easing), h('label', { class: 'toggle' }, [f.loop, h('span', { text: 'Loop' })])]), buttons: [{ label: 'CANCEL', value: null }, { label: 'CREATE', value: 'ok', primary: true }] });
    if (r !== 'ok') return;
    const name = f.name.value === '__custom' ? (f.custom.value || 'Custom') : f.name.value;
    if (E.mode !== 'animation') UI.setMode('animation');
    Ops.createAnimation(my, { name, duration: Math.max(0.1, +f.duration.value), loop: f.loop.checked, fps: +f.fps.value, easing: f.easing.value });
    toast(`Created animation "${name}"`, 'ok');
  },
  async newVfx(defaults = {}) {
    const f = { name: h('input', { type: 'text', value: defaults.name || 'New VFX' }), category: h('select', {}, VFX_CATEGORIES.map((c) => h('option', { value: c, text: c, selected: c === (defaults.category || 'Universal') }))), duration: h('input', { type: 'number', value: 1, step: 0.1, min: 0.1 }), type: h('select', {}, VFX_TYPES.map((t) => h('option', { value: t, text: titleCase(t) }))) };
    const row = (l, el) => h('div', { class: 'field' }, [h('label', { text: l }), el]);
    const r = await dialog({ title: 'NEW VFX', body: h('div', { class: 'form-grid' }, [row('Name', f.name), row('Category', f.category), row('Duration (s)', f.duration), row('First emitter', f.type)]), buttons: [{ label: 'CANCEL', value: null }, { label: 'CREATE', value: 'ok', primary: true }] });
    if (r !== 'ok') return null;
    if (E.mode !== 'vfx') UI.setMode('vfx');
    const v = Ops.createVfx({ name: f.name.value || 'New VFX', category: f.category.value, duration: Math.max(0.1, +f.duration.value) });
    History.run('Emitter type', () => { v.emitters[0].type = f.type.value; v.emitters[0].name = titleCase(f.type.value); });
    UI.refreshAll();
    return v;
  },
  async editDialogue(n) {
    const lines = deepClone(n.npc.dialogue || []);
    const list = h('div', { class: 'dlg-lines' });
    const render = () => { clear(list); lines.forEach((l, i) => list.appendChild(h('div', { class: 'dlg-line' }, [h('span', { class: 'idx', text: String(i + 1) }), h('textarea', { rows: 2, value: l, oninput: (e) => { lines[i] = e.target.value; } }), h('div', { class: 'col' }, [h('button', { class: 'btn tiny ghost', text: '▲', onclick: () => { if (i > 0) { [lines[i - 1], lines[i]] = [lines[i], lines[i - 1]]; render(); } } }), h('button', { class: 'btn tiny ghost', text: '▼', onclick: () => { if (i < lines.length - 1) { [lines[i + 1], lines[i]] = [lines[i], lines[i + 1]]; render(); } } }), h('button', { class: 'btn tiny danger', text: '✕', onclick: () => { lines.splice(i, 1); render(); } })])]))); list.querySelectorAll('textarea').forEach((ta, i) => { ta.value = lines[i]; }); };
    render();
    const r = await dialog({ title: `EDIT DIALOGUE — ${n.name}`, wide: true, body: h('div', {}, [h('div', { class: 'hint', text: 'Lines are shown one after another when the player talks to the NPC. Use {player} for the player name.' }), list, h('button', { class: 'btn small', text: '+ ADD LINE', onclick: () => { lines.push(''); render(); } })]), buttons: [{ label: 'CANCEL', value: null }, { label: 'SAVE DIALOGUE', value: 'ok', primary: true }] });
    if (r === 'ok') { History.run('Edit dialogue', () => { n.npc.dialogue = lines.filter((l) => l.trim().length); }); Right.render(); }
  },
  async editTeam(n) {
    const team = deepClone(n.npc.team || []);
    const list = h('div', { class: 'team-list' });
    const render = () => { clear(list); team.forEach((t, i) => list.appendChild(h('div', { class: 'team-row' }, [h('select', { onchange: (e) => { t.species = e.target.value; } }, Object.values(E.project.mythlings).map((m) => h('option', { value: m.id, selected: m.id === t.species, text: m.name }))), h('input', { type: 'number', min: 1, max: 100, value: t.level, onchange: (e) => { t.level = +e.target.value; } }), h('input', { type: 'text', placeholder: 'nickname', value: t.nickname || '', onchange: (e) => { t.nickname = e.target.value; } }), h('button', { class: 'btn tiny danger', text: '✕', onclick: () => { team.splice(i, 1); render(); } })]))); if (!team.length) list.appendChild(h('div', { class: 'empty', text: 'No team — a regular NPC. Add Mythlings to make this a trainer battle.' })); };
    render();
    const r = await dialog({ title: `EDIT TEAM — ${n.name}`, body: h('div', {}, [list, h('button', { class: 'btn small', text: '+ ADD MYTHLING', onclick: () => { if (team.length >= 6) return; team.push({ species: Object.keys(E.project.mythlings)[0], level: 5, nickname: '' }); render(); } })]), buttons: [{ label: 'CANCEL', value: null }, { label: 'SAVE TEAM', value: 'ok', primary: true }] });
    if (r === 'ok') { History.run('Edit team', () => { n.npc.team = team; if (team.length && n.npc.kind === 'regular') n.npc.kind = 'trainer'; }); Right.render(); }
  },
  async editStock(n) {
    const ta = h('textarea', { rows: 8, spellcheck: 'false' }); ta.value = (n.npc.stock || []).map((s) => `${s.item} x${s.qty ?? 1} @${s.price ?? 0}`).join('\n');
    const r = await dialog({ title: `EDIT SHOP STOCK — ${n.name}`, body: h('div', {}, [h('div', { class: 'hint', text: 'One item per line: item_id xQty @price' }), ta]), buttons: [{ label: 'CANCEL', value: null }, { label: 'SAVE', value: 'ok', primary: true }] });
    if (r === 'ok') History.run('Edit stock', () => { n.npc.stock = ta.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(\S+)(?:\s+x(\d+))?(?:\s+@(\d+))?/); return m ? { item: m[1], qty: +(m[2] || 1), price: +(m[3] || 0) } : null; }).filter(Boolean); });
  },
  async projectSettings() {
    const p = E.project.project, S = settings();
    const name = h('input', { type: 'text', value: p.name }), id = h('input', { type: 'text', value: p.id }), autosave = h('input', { type: 'number', value: S.autosaveSec ?? 30, min: 0, step: 5 });
    const r = await dialog({ title: 'PROJECT SETTINGS', body: h('div', { class: 'form-grid' }, [h('div', { class: 'field' }, [h('label', { text: 'Name' }), name]), h('div', { class: 'field' }, [h('label', { text: 'ID' }), id]), h('div', { class: 'field' }, [h('label', { text: 'Autosave (s, 0=off)' }), autosave]), kvRow('Format version', String(p.format)), kvRow('Editor version', p.editorVersion || EDITOR_VERSION), kvRow('Created', new Date(p.created).toLocaleString()), kvRow('Last saved', p.lastSaved ? new Date(p.lastSaved).toLocaleString() : 'never'), kvRow('Version', `v${p.version}`), kvRow('Change count', String(p.changeCount || 0))]), buttons: [{ label: 'CANCEL', value: null }, { label: 'SAVE', value: 'ok', primary: true }] });
    if (r === 'ok') { History.run('Project settings', () => { p.name = name.value || p.name; const nid = slug(id.value); if (nid) p.id = nid; S.autosaveSec = Math.max(0, +autosave.value); }); App.scheduleAutosave(); UI.refreshAll(); }
  },
  async preferences() {
    const S = settings();
    const body = h('div', { class: 'form-grid' }, [
      fCheck('Snap to grid', () => S.snap, (v) => { S.snap = v; }), fNum('Grid size (map)', () => S.gridSize, (v) => { S.gridSize = Math.max(1, v); }),
      fNum('Snap step (creature / animation)', () => S.creatureGridSize || 4, (v) => { S.creatureGridSize = Math.max(1, v); }), h('div'),
      fCheck('Show rulers', () => S.showRulers !== false, (v) => { S.showRulers = v; }), fCheck('Live preview (wind / water)', () => !!S.livePreview, (v) => { S.livePreview = v; }),
      fCheck('Auto-key on move (animation)', () => !!S.autoKey, (v) => { S.autoKey = v; }), fCheck('Show debug overlays', () => S.debug, (v) => { S.debug = v; }),
      fNum('Autosave interval (s)', () => S.autosaveSec ?? 30, (v) => { S.autosaveSec = Math.max(0, v); App.scheduleAutosave(); }),
    ]);
    await dialog({ title: 'PREFERENCES', body }); Scene.invalidate(); UI.refreshAll();
  },
  async snapshots() {
    const p = E.project;
    const list = h('div', { class: 'snap-list' });
    const render = () => { clear(list); if (!p.snapshots.length) list.appendChild(h('div', { class: 'empty', text: 'No snapshots yet. Use FILE → Save Snapshot to store a named version inside the project.' })); [...p.snapshots].reverse().forEach((s) => list.appendChild(h('div', { class: 'list-item' }, [icon('save', 'ticon'), h('div', { class: 'grow' }, [h('div', { class: 'title', text: `${s.label} — v${s.version}` }), h('div', { class: 'sub', text: `${new Date(s.at).toLocaleString()} · ${Math.round(s.data.length / 1024)} KB · ${s.changeCount} changes` })]), h('button', { class: 'btn tiny primary', text: 'RESTORE', onclick: async () => { if (await confirmDialog('Restore Snapshot', `Restore "${s.label}"? The current state will be kept as a new snapshot first.`, 'RESTORE')) { App.restoreSnapshot(s); } } }), h('button', { class: 'btn tiny', text: 'DOWNLOAD', onclick: () => downloadText(`${p.project.id}-${slug(s.label)}.json`, s.data) }), h('button', { class: 'btn tiny danger', text: '✕', onclick: () => { History.run('Delete snapshot', () => { p.snapshots.splice(p.snapshots.indexOf(s), 1); }); render(); } })]))); };
    render();
    await dialog({ title: 'VERSION HISTORY', wide: true, body: h('div', {}, [h('div', { class: 'row', style: { display: 'flex', gap: '6px', marginBottom: '8px' } }, [h('button', { class: 'btn small primary', text: '+ SAVE SNAPSHOT NOW', onclick: async () => { await App.saveSnapshot(); render(); } }), h('span', { class: 'hint', text: `Project v${p.project.version} · ${p.project.changeCount || 0} changes since creation · autosave keeps the latest state in this browser.` })]), list]) });
  },
  async stats() {
    const p = E.project;
    const rows = [['Maps', Object.keys(p.maps).length], ['Map objects', Object.values(p.maps).reduce((a, m) => a + Object.keys(m.nodes).length, 0)], ['Mythlings', Object.keys(p.mythlings).length], ['Rig parts', Object.values(p.mythlings).reduce((a, m) => a + Object.keys(m.rig.nodes).length, 0)], ['Animations', Object.keys(p.animations).length], ['Keyframes', Object.values(p.animations).reduce((a, x) => a + Object.values(x.tracks).reduce((b, t) => b + t.length, 0), 0)], ['VFX', Object.keys(p.vfx).length], ['Skills', Object.keys(p.skills).length], ['Library objects', Object.keys(p.objects).length], ['Image assets', Object.keys(p.assets).length], ['Project size', `${Math.round(JSON.stringify(p).length / 1024)} KB`], ['Undo steps', History.undoStack.length]];
    await dialog({ title: 'PROJECT STATISTICS', body: h('div', {}, rows.map(([k, v]) => kvRow(k, String(v)))) });
  },
  shortcuts() {
    const groups = [
      ['TOOLS', [['V', 'Select'], ['W', 'Move'], ['E', 'Rotate'], ['R', 'Scale'], ['B', 'Draw (pencil)'], ['U', 'Rectangle'], ['O', 'Ellipse'], ['Y', 'Polygon'], ['N', 'Path'], ['X', 'Eraser'], ['A', 'Anchor (creature)'], ['P', 'Pivot'], ['C', 'Collision'], ['M', 'Paint terrain (map)'], ['S / T / I / Z', 'Spawn / Warp / Trigger / Zone (map)']]],
      ['EDIT', [['Ctrl+Z / Ctrl+Y', 'Undo / Redo'], ['Ctrl+D', 'Duplicate'], ['Ctrl+C / Ctrl+V / Ctrl+X', 'Copy / Paste / Cut'], ['Ctrl+A', 'Select all'], ['Ctrl+G / Ctrl+Shift+G', 'Group / Ungroup'], ['Delete', 'Delete selection / keyframe / vertex'], ['F2 / Enter', 'Rename / edit properties'], ['H / L', 'Hide / Lock'], ['[ / ]', 'Send backward / bring forward (brush size in paint mode)'], ['Arrows (+Shift)', 'Nudge 1px (10px)'], ['Alt+click edge', 'Insert vertex'], ['Tab', 'Cycle selection']]],
      ['VIEW', [['Space + drag / middle drag', 'Pan'], ['Wheel', 'Zoom at cursor'], ['Shift+wheel / Alt+wheel', 'Pan horizontally / vertically'], ['F / Shift+F', 'Fit / frame selection'], ['+ / − / 0', 'Zoom in / out / 100%'], ['G', 'Toggle grid'], ['Q', 'Before/After compare'], ['Ctrl+B', 'Toggle bottom panel'], ['Esc', 'Cancel / deselect / exit screen']]],
      ['ANIMATION', [['K / Shift+K', 'Key selected parts / all parts'], ['Space (timeline)', 'Play / pause'], [', / .', 'Step frame'], ['Home / End', 'Playhead to start / end'], ['1–9', 'Play animation clip N (creature) · pick terrain (paint)'], ['Double-click row', 'Add keyframe']]],
      ['FILE', [['Ctrl+S / Ctrl+Shift+S', 'Save / Save as copy'], ['Ctrl+N / Ctrl+O', 'New / Open project'], ['Ctrl+E', 'Export screen'], ['F5', 'Playtest'], ['Ctrl+/', 'This list']]],
    ];
    dialog({ title: 'KEYBOARD SHORTCUTS', wide: true, body: h('div', { class: 'shortcuts' }, groups.map(([t, rows]) => h('div', { class: 'sc-group' }, [h('h4', { text: t }), ...rows.map(([k, d]) => h('div', { class: 'sc-row' }, [h('kbd', { text: k }), h('span', { text: d })]))]))) });
  },
  guide() {
    dialog({ title: 'QUICK START GUIDE', wide: true, body: `
      <ol class="guide">
        <li><b>Maps (WORLD)</b> — pick a map from the dropdown above the canvas. Paint terrain with <b>M</b>, place props from the LIBRARY tab (click or drag onto the canvas), paint collision with <b>C</b>, add spawn zones / warps / triggers / NPCs from <b>+ ADD OBJECT</b>. Press <b>F5</b> to walk around.</li>
        <li><b>Creatures (DESIGN)</b> — open the Mythling Browser, pick one and press EDIT DESIGN. Parts live in the CREATURE PARTS tree (drag to re-parent). Use <b>P</b> to move pivots, <b>A</b> to place anchors (Mouth, AttackOrigin, VFXOrigin…).</li>
        <li><b>Animation</b> — switch to ANIMATION mode. Select a part, move/rotate it and press <b>K</b> to key the pose at the playhead (or enable Auto-key). Diamonds on the timeline can be dragged; right-click for easing, copy and paste.</li>
        <li><b>VFX & Skills</b> — build effects from 14 emitter types, attach them to anchors, then link them to skills. The Skill editor previews caster + target dummy with camera shake.</li>
        <li><b>Export</b> — EXPORT mode produces JSON, JavaScript (<code>registerMythling(...)</code> etc.), PNG previews and the <b>ARENA AI IMPLEMENTATION PACKAGE</b>. Copy it and paste it to Arena AI to implement the content in the game.</li>
        <li><b>Saving</b> — projects autosave to this browser (IndexedDB). Use FILE → Download Project JSON to keep a file backup, Save Snapshot for named versions.</li>
      </ol>` });
  },
  formatReference() { dialog({ title: 'DATA FORMAT REFERENCE', wide: true, body: h('pre', { class: 'ref', text: Exporter.schemaDoc() }) }); },
  about() { dialog({ title: 'ABOUT', body: `<p><b>MYTHLING EDIT</b> v${EDITOR_VERSION} — Mythlings: Wildbound Creature, Map &amp; Animation Editor.</p><p>A single offline HTML file. No server, no build step, no external dependencies. Data is stored in your browser (IndexedDB) and in the JSON files you export.</p><p>Project format v${PROJECT_FORMAT_VERSION}.</p>` }); },
};
