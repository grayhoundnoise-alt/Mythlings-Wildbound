// =============================================================================
// Right panel (inspector): PROPERTIES / TRANSFORM / APPEARANCE / BEHAVIOR / COLLISION / DATA
// =============================================================================
// ---- field helpers (live edits coalesce in history via '~' labels)
function fNum(label, get, set, { step = 1, min, max, unit = '', key = '' } = {}) {
  const inp = h('input', { type: 'number', value: round(get(), 3), step, min, max, dataset: { key } });
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (!Number.isNaN(v)) { set(v); Scene.invalidate(); } });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
  return h('div', { class: 'field' }, [h('label', { text: label }), inp, unit ? h('span', { class: 'unit', text: unit }) : null]);
}
function fText(label, get, set, { placeholder = '', key = '', multiline = false } = {}) {
  const inp = multiline ? h('textarea', { rows: 3, placeholder, dataset: { key } }) : h('input', { type: 'text', value: get() ?? '', placeholder, dataset: { key } });
  if (multiline) inp.value = get() ?? '';
  inp.addEventListener('change', () => { set(inp.value); Scene.invalidate(); });
  if (!multiline) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
  return h('div', { class: `field ${multiline ? 'col' : ''}` }, [h('label', { text: label }), inp]);
}
function fSelect(label, get, set, options, { key = '' } = {}) {
  const sel = h('select', { dataset: { key } }, options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(get()) === String(v), text: l }); }));
  sel.addEventListener('change', () => { set(sel.value); Scene.invalidate(); });
  return h('div', { class: 'field' }, [h('label', { text: label }), sel]);
}
function fColor(label, get, set, { key = '', allowNone = false } = {}) {
  const val = get(); const isNone = !val || val === 'transparent' || val === 'none';
  const inp = h('input', { type: 'color', value: isNone ? '#000000' : (val.length === 4 ? `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}` : val.slice(0, 7)), dataset: { key } });
  inp.addEventListener('input', () => { set(inp.value); Scene.invalidate(); });
  const kids = [h('label', { text: label }), inp];
  if (allowNone) kids.push(h('button', { class: `btn tiny ${isNone ? 'primary' : 'ghost'}`, text: 'NONE', onclick: (e) => { set(isNone ? inp.value : 'transparent'); e.target.classList.toggle('primary'); Scene.invalidate(); } }));
  return h('div', { class: 'field' }, kids);
}
function fCheck(label, get, set, { key = '' } = {}) {
  const inp = h('input', { type: 'checkbox', dataset: { key } }); inp.checked = !!get();
  inp.addEventListener('change', () => { set(inp.checked); Scene.invalidate(); });
  return h('label', { class: 'toggle' }, [inp, h('span', { text: label })]);
}
function fRange(label, get, set, { min = 0, max = 1, step = 0.01, key = '' } = {}) {
  const inp = h('input', { type: 'range', min, max, step, value: get(), dataset: { key } });
  const out = h('span', { class: 'unit', text: String(round(get(), 2)) });
  inp.addEventListener('input', () => { set(parseFloat(inp.value)); out.textContent = String(round(parseFloat(inp.value), 2)); Scene.invalidate(); });
  return h('div', { class: 'field' }, [h('label', { text: label }), inp, out]);
}
function fRow(children) { return h('div', { class: 'field-row' }, children); }
function sectionEl(title, children, actions = []) { return h('div', { class: 'section' }, [h('div', { class: 'panel-head' }, [h('span', { text: title }), h('span', { class: 'actions' }, actions)]), ...[].concat(children)]); }

const Right = {
  tabs: [['properties', 'PROPERTIES'], ['transform', 'TRANSFORM'], ['appearance', 'APPEARANCE'], ['behavior', 'BEHAVIOR'], ['collision', 'COLLISION'], ['data', 'DATA']],
  render() {
    if (!E.project) return;
    const tb = clear($('#right-tabs'));
    for (const [id, label] of this.tabs) tb.appendChild(h('button', { class: `tab ${E.ui.rightTab === id ? 'active' : ''}`, text: label, onclick: () => { E.ui.rightTab = id; this.render(); } }));
    const body = clear($('#right-body'));
    const n = primarySelected();
    try {
      if (E.selectedKey && E.ui.rightTab === 'properties' && E.mode === 'animation') this.renderKeyframe(body);
      if (n) this[`render${titleCase(E.ui.rightTab)}`](body, n);
      else this.renderDocument(body);
    } catch (err) { console.error(err); body.appendChild(h('div', { class: 'empty', text: `Inspector error: ${err.message}` })); }
  },
  focusName() { const i = $('#right-body input[data-key="name"]'); if (i) { i.focus(); i.select(); } },
  syncTransform() {
    const n = primarySelected(); if (!n) return;
    const set = (k, v) => { const i = $(`#right-body [data-key="${k}"]`); if (i && document.activeElement !== i) i.value = round(v, 3); };
    set('x', n.x); set('y', n.y); set('rotation', n.rotation); set('scaleX', n.scaleX); set('scaleY', n.scaleY); set('pivotX', n.pivotX); set('pivotY', n.pivotY); set('w', n.shape.w); set('h', n.shape.h);
    const [wx, wy] = worldPos(n); set('wx', wx); set('wy', wy);
    for (let i = 0; i < (n.points || []).length; i++) { set(`px${i}`, n.points[i][0]); set(`py${i}`, n.points[i][1]); }
  },
  syncCollision() { const n = primarySelected(); if (!n) return; const c = n.collision; const set = (k, v) => { const i = $(`#right-body [data-key="${k}"]`); if (i && document.activeElement !== i) i.value = round(v, 2); }; set('cr', c.radius); if (c.rect) { set('cx', c.rect[0]); set('cy', c.rect[1]); set('cw', c.rect[2]); set('ch', c.rect[3]); } (c.points || []).forEach((p, i) => { set(`cpx${i}`, p[0]); set(`cpy${i}`, p[1]); }); },
  edit(n, label, fn) { History.run(label, () => fn(n)); },
  multi() { return E.selection.length > 1 ? h('div', { class: 'hint', style: { padding: '6px 10px' }, text: `${E.selection.length} objects selected — editing the last selected (${primarySelected().name}). Transforms apply to all.` }) : null; },
  // ------------------------------------------------------------- PROPERTIES
  renderProperties(body, n) {
    const doc = currentDoc(); const creature = isCreatureMode();
    { const mh = this.multi(); if (mh) body.appendChild(mh); }
    const ed = (label, fn) => this.edit(n, `~${label}`, fn);
    body.appendChild(sectionEl(`${n.type.toUpperCase()}${n.prefab ? ' · ' + (PREFABS[n.prefab]?.name || n.prefab) : ''}`, [
      fText('Name', () => n.name, (v) => { Ops.rename(n.id, v.trim() || n.name); }, { key: 'name' }),
      fText('Tags', () => (n.tags || []).join(', '), (v) => ed('Tags', () => { n.tags = v.split(',').map((s) => s.trim()).filter(Boolean); }), { placeholder: 'comma, separated' }),
      fSelect('Parent', () => n.parent || '', (v) => Ops.reparent(n.id, v || null), [['', '(root)'], ...allNodes(doc).filter((o) => o.id !== n.id && !isAncestor(n.id, o.id, doc) && o.type !== 'anchor').map((o) => [o.id, `${'· '.repeat(nodeDepth(o, doc))}${o.name}`])]),
      doc.layers ? fSelect('Layer', () => n.layer, (v) => ed('Layer', () => { n.layer = v; }), doc.layers.map((l) => [l.id, l.name])) : null,
      creature && n.type !== 'anchor' ? fSelect('Part type', () => n.partType || 'Detail', (v) => ed('Part type', () => { n.partType = v; }), CREATURE_PART_TYPES) : null,
      creature ? fSelect('Anchor (snap to)', () => n.anchor || '', (v) => { if (!v) { ed('Anchor', () => { n.anchor = ''; }); return; } const a = doc.nodes[v]; const [ax, ay] = worldPos(a, doc); History.run('Snap to anchor', () => { n.anchor = v; setWorldPosition(n, ax, ay, doc); }); this.syncTransform(); }, [['', '(none)'], ...allNodes(doc).filter((o) => o.type === 'anchor').map((o) => [o.id, o.name])]) : null,
      fRow([fCheck('Visible', () => n.visible, (v) => ed('Visibility', () => { n.visible = v; Left.render(); })), fCheck('Locked', () => n.locked, (v) => ed('Lock', () => { n.locked = v; Left.render(); }))]),
      fNum('Z-order', () => n.z, (v) => ed('Z-order', () => { n.z = v; }), { step: 1 }),
    ]));
    // type-specific
    if (n.type === 'anchor') body.appendChild(sectionEl('ANCHOR', [
      fSelect('Role', () => n.name, (v) => Ops.rename(n.id, v), ['Root', 'Head', 'Tail', 'TailBase', 'TailTip', 'Mouth', 'Foot_L', 'Foot_R', 'Wing_L', 'Wing_R', 'AttackOrigin', 'VFXOrigin', 'ProjectileOrigin', 'Eye', 'BodyCenter', 'Custom'].map((r) => [r === 'Custom' ? n.name : r, r])),
      fColor('Color', () => n.fill, (v) => ed('Anchor color', () => { n.fill = v; })),
      h('div', { class: 'hint', text: 'Anchors are attachment points for VFX, projectiles and gameplay (mouth, feet, attack origin…). Drag them on the canvas with the ANCHOR tool.' }),
    ]));
    if (n.type === 'text') body.appendChild(sectionEl('TEXT', [fText('Text', () => n.text, (v) => ed('Text', () => { n.text = v; })), fNum('Font size', () => n.fontSize || 18, (v) => ed('Font size', () => { n.fontSize = v; }), { min: 4 }), fText('Font', () => n.font || 'sans-serif', (v) => ed('Font', () => { n.font = v; })), fCheck('Bold', () => n.bold, (v) => ed('Bold', () => { n.bold = v; }))]));
    if (n.type === 'image') body.appendChild(sectionEl('IMAGE', [
      fSelect('Asset', () => n.asset || '', (v) => ed('Asset', () => { n.asset = v; const a = E.project.assets[v]; if (a && (!n.shape.w || n.shape.w === 64)) { n.shape.w = a.w; n.shape.h = a.h; } }), [['', '(none)'], ...Object.values(E.project.assets).map((a) => [a.id, a.name])]),
      h('div', { class: 'row', style: { display: 'flex', gap: '4px', padding: '4px 0' } }, [h('button', { class: 'btn tiny', text: 'IMPORT NEW…', onclick: async () => { const files = await pickFile('image/png,image/jpeg,image/webp'); if (files) { await Ops.importImages([files]); const last = Object.values(E.project.assets).pop(); if (last) ed('Asset', () => { n.asset = last.id; n.shape.w = last.w; n.shape.h = last.h; }); this.render(); } } }), h('button', { class: 'btn tiny ghost', text: 'NATIVE SIZE', onclick: () => { const a = E.project.assets[n.asset]; if (a) ed('Native size', () => { n.shape.w = a.w; n.shape.h = a.h; }); this.syncTransform(); } })]),
      n.asset && !E.project.assets[n.asset] ? h('div', { class: 'hint warn', text: '⚠ Missing asset — the image was deleted or not imported. Pick another asset or import it again.' }) : null,
    ]));
    if (n.type === 'prefab') body.appendChild(sectionEl('PROP', [fSelect('Prop type', () => n.prefab, (v) => ed('Prop type', () => { const pf = PREFABS[v]; n.prefab = v; n.shape = { w: pf.w, h: pf.h }; if (pf.collision) n.collision = Object.assign(n.collision, deepClone(pf.collision), { enabled: true }); }), Object.entries(PREFABS).filter(([, p]) => !p.isNpc).map(([id, p]) => [id, `${p.name} (${p.category})`])), fNum('Variant', () => n.variant || 0, (v) => ed('Variant', () => { n.variant = Math.max(0, Math.floor(v)); }), { min: 0, max: 3 }), fRow([fNum('Width', () => n.shape.w, (v) => ed('Size', () => { n.shape.w = v; }), { key: 'w', min: 2 }), fNum('Height', () => n.shape.h, (v) => ed('Size', () => { n.shape.h = v; }), { key: 'h', min: 2 })])]));
    if (n.type === 'npc') this.renderNpc(body, n);
    if (n.type === 'mythling') body.appendChild(sectionEl('MYTHLING PLACEMENT', [
      fSelect('Species', () => n.mythling.species, (v) => ed('Species', () => { n.mythling.species = v; n.name = E.project.mythlings[v]?.name || n.name; Left.render(); }), Object.values(E.project.mythlings).map((m) => [m.id, m.name])),
      fNum('Level', () => n.mythling.level, (v) => ed('Level', () => { n.mythling.level = Math.max(1, Math.floor(v)); }), { min: 1, max: 100 }),
      fSelect('Behaviour', () => n.mythling.behavior, (v) => ed('Behaviour', () => { n.mythling.behavior = v; }), ['wander', 'idle', 'guard', 'follow']),
      fSelect('Facing', () => n.mythling.facing, (v) => ed('Facing', () => { n.mythling.facing = v; }), ['right', 'left']),
      fSelect('Animation', () => n.mythling.animation || 'Idle', (v) => ed('Animation', () => { n.mythling.animation = v; }), ANIM_NAMES),
      fNum('Display height', () => n.shape.h, (v) => ed('Size', () => { n.shape.h = v; n.shape.w = round(v * 1.2, 1); }), { key: 'h', min: 16 }),
      h('button', { class: 'btn small', text: 'OPEN IN CREATURE EDITOR', onclick: () => UI.openMythling(n.mythling.species, 'creature') }),
    ]));
    if (n.type === 'zone') body.appendChild(sectionEl('ENCOUNTER ZONE', [
      fText('Zone name', () => n.zone.name, (v) => ed('Zone name', () => { n.zone.name = v; })),
      h('div', { class: 'field col' }, [h('label', { text: 'Species pool' }), h('div', { class: 'chips' }, Object.values(E.project.mythlings).map((m) => h('button', { class: `chip ${n.zone.species.includes(m.id) ? 'active' : ''}`, text: m.name, onclick: (e) => { ed('Species pool', () => { n.zone.species = n.zone.species.includes(m.id) ? n.zone.species.filter((s) => s !== m.id) : [...n.zone.species, m.id]; }); e.target.classList.toggle('active'); } })))]),
      fText('Extra species ids', () => n.zone.species.filter((s) => !E.project.mythlings[s]).join(', '), (v) => ed('Species pool', () => { n.zone.species = [...n.zone.species.filter((s) => E.project.mythlings[s]), ...v.split(',').map((s) => s.trim()).filter(Boolean)]; }), { placeholder: 'ids not in this project' }),
      fRow([fNum('Min level', () => n.zone.minLevel, (v) => ed('Levels', () => { n.zone.minLevel = Math.max(1, v); }), { min: 1 }), fNum('Max level', () => n.zone.maxLevel, (v) => ed('Levels', () => { n.zone.maxLevel = Math.max(1, v); }), { min: 1 })]),
      fRow([fNum('Weight', () => n.zone.weight, (v) => ed('Weight', () => { n.zone.weight = v; }), { min: 0 }), fNum('Mutation %', () => n.zone.mutationChance, (v) => ed('Mutation', () => { n.zone.mutationChance = v; }), { min: 0, max: 100 })]),
      fRow([fNum('Width', () => n.shape.w, (v) => ed('Size', () => { n.shape.w = v; }), { key: 'w', min: 8 }), fNum('Height', () => n.shape.h, (v) => ed('Size', () => { n.shape.h = v; }), { key: 'h', min: 8 })]),
    ]));
    if (n.type === 'warp') body.appendChild(sectionEl('WARP', [
      fSelect('Destination map', () => n.warp.toMap, (v) => ed('Warp', () => { n.warp.toMap = v; }), [['', '(none)'], ...Object.values(E.project.maps).map((m) => [m.id, m.name])]),
      fRow([fNum('Dest X', () => n.warp.toX, (v) => ed('Warp', () => { n.warp.toX = v; })), fNum('Dest Y', () => n.warp.toY, (v) => ed('Warp', () => { n.warp.toY = v; }))]),
      h('button', { class: 'btn tiny', text: 'USE DESTINATION PLAYER SPAWN', onclick: () => { const m = E.project.maps[n.warp.toMap]; const sp = m && Object.values(m.nodes).find((x) => x.type === 'spawn' && x.spawn.kind === 'player'); if (sp) { ed('Warp', () => { n.warp.toX = sp.x; n.warp.toY = sp.y; }); this.render(); } else toast('Destination map has no player spawn', 'warn'); } }),
      fText('Required flag', () => n.warp.requiredFlag, (v) => ed('Warp', () => { n.warp.requiredFlag = v; }), { placeholder: 'e.g. beat_gym_1' }),
      fText('Label', () => n.warp.label, (v) => ed('Warp', () => { n.warp.label = v; })),
      fRow([fNum('Width', () => n.shape.w, (v) => ed('Size', () => { n.shape.w = v; }), { key: 'w', min: 8 }), fNum('Height', () => n.shape.h, (v) => ed('Size', () => { n.shape.h = v; }), { key: 'h', min: 8 })]),
    ]));
    if (n.type === 'trigger') body.appendChild(sectionEl('TRIGGER', [
      fSelect('Event', () => n.trigger.event, (v) => ed('Trigger', () => { n.trigger.event = v; }), ['message', 'battle', 'heal', 'save', 'set_flag', 'give_item', 'cutscene', 'custom']),
      fText('Payload', () => n.trigger.payload, (v) => ed('Trigger', () => { n.trigger.payload = v; }), { multiline: true }),
      fCheck('Fire only once', () => n.trigger.once, (v) => ed('Trigger', () => { n.trigger.once = v; })),
      fRow([fNum('Width', () => n.shape.w, (v) => ed('Size', () => { n.shape.w = v; }), { key: 'w', min: 8 }), fNum('Height', () => n.shape.h, (v) => ed('Size', () => { n.shape.h = v; }), { key: 'h', min: 8 })]),
    ]));
    if (n.type === 'spawn') body.appendChild(sectionEl('SPAWN POINT', [
      fSelect('Kind', () => n.spawn.kind, (v) => ed('Spawn', () => { n.spawn.kind = v; }), ['player', 'npc', 'mythling']),
      fSelect('Direction', () => n.spawn.direction, (v) => ed('Spawn', () => { n.spawn.direction = v; }), ['down', 'up', 'left', 'right']),
      fSelect('Zone', () => n.spawn.zone || '', (v) => ed('Spawn', () => { n.spawn.zone = v; }), [['', '(none)'], ...allNodes(doc).filter((o) => o.type === 'zone').map((o) => [o.id, o.zone.name])]),
      fCheck('Enabled', () => n.spawn.enabled, (v) => ed('Spawn', () => { n.spawn.enabled = v; })),
    ]));
    if (n.type === 'group' && n.libraryId) body.appendChild(h('div', { class: 'hint', style: { padding: '6px 10px' }, text: `Instance of library object "${E.project.objects[n.libraryId]?.name || '?'}"` }));
    if (creature) body.appendChild(sectionEl('ANIMATION', [h('div', { class: 'row', style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, [h('button', { class: 'btn tiny primary', text: 'KEY POSE (K)', onclick: () => Ops.keyCurrentPose(E.selection) }), h('button', { class: 'btn tiny', text: 'CLEAR TRACK', onclick: () => { const a = currentAnim(); if (a && a.tracks[n.id]) { History.run('Clear track', () => { delete a.tracks[n.id]; }); Bottom.render(); } } })]), h('div', { class: 'hint', text: currentAnim() ? `Clip: ${currentAnim().name} · ${(currentAnim().tracks[n.id] || []).length} keys on this part` : 'Open the Animation editor to add keyframes.' })]));
  },
  renderNpc(body, n) {
    const ed = (label, fn) => this.edit(n, `~${label}`, fn);
    body.appendChild(sectionEl('NPC', [
      fText('Display name', () => n.name, (v) => Ops.rename(n.id, v)),
      fSelect('Type', () => n.npc.kind, (v) => ed('NPC type', () => { n.npc.kind = v; }), NPC_TYPES.map((t) => [t, t === 'savepoint' ? 'Save Point' : titleCase(t)])),
      fSelect('Sprite', () => n.npc.sprite, (v) => ed('Sprite', () => { n.npc.sprite = v; }), ['villager', 'trainer', 'elder', 'merchant', 'nurse', 'ranger', 'child', 'guard']),
      fSelect('Direction', () => n.npc.direction, (v) => ed('Direction', () => { n.npc.direction = v; }), ['down', 'up', 'left', 'right']),
      fColor('Outfit color', () => n.npc.color, (v) => ed('NPC color', () => { n.npc.color = v; })),
      fText('Story flag', () => n.npc.flag, (v) => ed('Flag', () => { n.npc.flag = v; }), { placeholder: 'set when talked to / defeated' }),
      fText('Reward', () => n.npc.reward || '', (v) => ed('Reward', () => { n.npc.reward = v; }), { placeholder: 'item id or coins' }),
      h('div', { class: 'row', style: { display: 'flex', gap: '4px', padding: '6px 0', flexWrap: 'wrap' } }, [
        h('button', { class: 'btn small primary', text: 'EDIT DIALOGUE', onclick: () => Screens.editDialogue(n) }),
        h('button', { class: 'btn small', text: 'EDIT TEAM', onclick: () => Screens.editTeam(n) }),
        n.npc.kind === 'shop' ? h('button', { class: 'btn small', text: 'EDIT STOCK', onclick: () => Screens.editStock(n) }) : null,
      ]),
      h('div', { class: 'hint', text: `${n.npc.dialogue.length} dialogue line(s) · team: ${n.npc.team.length ? n.npc.team.map((t) => `${E.project.mythlings[t.species]?.name || t.species} Lv.${t.level}`).join(', ') : 'none'}` }),
    ]));
  },
  // ------------------------------------------------------------- TRANSFORM
  renderTransform(body, n) {
    const ed = (label, fn) => this.edit(n, `~${label}`, fn);
    const many = selectedNodes();
    { const mh = this.multi(); if (mh) body.appendChild(mh); }
    const [wx, wy] = worldPos(n);
    body.appendChild(sectionEl('POSITION (LOCAL)', [
      fRow([fNum('X', () => n.x, (v) => { const dx = v - n.x; ed('Move', () => { for (const m of many) m.x = round(m.x + dx, 3); }); }, { key: 'x' }), fNum('Y', () => n.y, (v) => { const dy = v - n.y; ed('Move', () => { for (const m of many) m.y = round(m.y + dy, 3); }); }, { key: 'y' })]),
      fRow([fNum('World X', () => wx, (v) => { ed('Move', () => { setWorldPosition(n, v, worldPos(n)[1]); }); this.syncTransform(); }, { key: 'wx' }), fNum('World Y', () => wy, (v) => { ed('Move', () => { setWorldPosition(n, worldPos(n)[0], v); }); this.syncTransform(); }, { key: 'wy' })]),
    ]));
    body.appendChild(sectionEl('ROTATION & SCALE', [
      fNum('Rotation', () => n.rotation, (v) => { const d = v - n.rotation; ed('Rotate', () => { for (const m of many) m.rotation = round(m.rotation + d, 2); }); }, { step: 1, unit: '°', key: 'rotation' }),
      fRow([fNum('Scale X', () => n.scaleX, (v) => ed('Scale', () => { for (const m of many) m.scaleX = v; if (E.ui.lockRatio) for (const m of many) m.scaleY = v; }), { step: 0.05, key: 'scaleX' }), fNum('Scale Y', () => n.scaleY, (v) => ed('Scale', () => { for (const m of many) m.scaleY = v; if (E.ui.lockRatio) for (const m of many) m.scaleX = v; }), { step: 0.05, key: 'scaleY' })]),
      fRow([fCheck('Lock ratio', () => E.ui.lockRatio, (v) => { E.ui.lockRatio = v; }), h('button', { class: 'btn tiny', text: 'FLIP H', onclick: () => ed('Flip', () => { for (const m of many) m.scaleX = -m.scaleX; }) }), h('button', { class: 'btn tiny', text: 'FLIP V', onclick: () => ed('Flip', () => { for (const m of many) m.scaleY = -m.scaleY; }) })]),
      fNum('Opacity', () => n.opacity, (v) => ed('Opacity', () => { for (const m of many) m.opacity = clamp(v, 0, 1); }), { step: 0.05, min: 0, max: 1, key: 'opacity' }),
    ]));
    if (n.shape && n.shape.w != null) body.appendChild(sectionEl('SIZE', [fRow([fNum('Width', () => n.shape.w, (v) => ed('Size', () => { n.shape.w = Math.max(1, v); }), { key: 'w' }), fNum('Height', () => n.shape.h, (v) => ed('Size', () => { n.shape.h = Math.max(1, v); }), { key: 'h' })])]));
    body.appendChild(sectionEl('PIVOT', [
      fRow([fNum('Pivot X', () => n.pivotX, (v) => ed('Pivot', () => { n.pivotX = v; }), { key: 'pivotX' }), fNum('Pivot Y', () => n.pivotY, (v) => ed('Pivot', () => { n.pivotY = v; }), { key: 'pivotY' })]),
      h('div', { class: 'row', style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, [h('button', { class: 'btn tiny', text: 'CENTER PIVOT', onclick: () => this.centerPivot(n) }), h('button', { class: 'btn tiny', text: 'PIVOT TO TOP', onclick: () => this.pivotTo(n, 'top') }), h('button', { class: 'btn tiny', text: 'PIVOT TO BOTTOM', onclick: () => this.pivotTo(n, 'bottom') }), h('button', { class: 'btn tiny', text: 'PIVOT TOOL (P)', onclick: () => UI.setTool('pivot') })]),
      h('div', { class: 'hint', text: 'The pivot is the point the part rotates and scales around. Legs: top · tails: base · heads: neck.' }),
    ]));
    body.appendChild(sectionEl('ACTIONS', h('div', { class: 'row', style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, [h('button', { class: 'btn tiny', text: 'RESET TRANSFORM', onclick: () => this.resetTransform(n) }), h('button', { class: 'btn tiny', text: 'SNAP TO GRID', onclick: () => { ed('Snap', () => { for (const m of many) { const [x, y] = worldPos(m); setWorldPosition(m, Scene.snap(x), Scene.snap(y)); } }); this.syncTransform(); } }), h('button', { class: 'btn tiny', text: 'ALIGN CENTERS', onclick: () => { if (many.length < 2) return; const [ax] = worldPos(many[many.length - 1]); ed('Align', () => { for (const m of many) setWorldPosition(m, ax, worldPos(m)[1]); }); this.syncTransform(); } })])));
  },
  centerPivot(n) { History.run('Center pivot', () => { const b = localBounds(n); const cx = b.x + b.w / 2, cy = b.y + b.h / 2; const wm = worldMatrix(n); const [wx, wy] = M.apply(wm, cx, cy); n.pivotX = round(cx, 2); n.pivotY = round(cy, 2); invalidateMatrices(); setWorldPosition(n, wx, wy); }); this.syncTransform(); Scene.invalidate(); },
  pivotTo(n, where) { History.run('Pivot', () => { const b = localBounds(n); const cx = b.x + b.w / 2, cy = where === 'top' ? b.y : b.y + b.h; const wm = worldMatrix(n); const [wx, wy] = M.apply(wm, cx, cy); n.pivotX = round(cx, 2); n.pivotY = round(cy, 2); invalidateMatrices(); setWorldPosition(n, wx, wy); }); this.syncTransform(); Scene.invalidate(); },
  resetTransform(n) { History.run('Reset transform', () => { n.rotation = 0; n.scaleX = 1; n.scaleY = 1; n.opacity = 1; }); this.render(); Scene.invalidate(); },
  // ------------------------------------------------------------- APPEARANCE
  renderAppearance(body, n) {
    const ed = (label, fn) => this.edit(n, `~${label}`, fn);
    const many = selectedNodes();
    { const mh = this.multi(); if (mh) body.appendChild(mh); }
    const shapeLike = ['rect', 'ellipse', 'polygon', 'path', 'text'].includes(n.type);
    body.appendChild(sectionEl('COLORS', [
      shapeLike ? fColor('Fill', () => n.fill, (v) => ed('Fill', () => { for (const m of many) m.fill = v; }), { allowNone: true }) : null,
      shapeLike ? fColor('Stroke', () => n.stroke, (v) => ed('Stroke', () => { for (const m of many) m.stroke = v; }), { allowNone: true }) : null,
      shapeLike ? fNum('Stroke width', () => n.strokeWidth, (v) => ed('Stroke width', () => { for (const m of many) m.strokeWidth = Math.max(0, v); }), { min: 0, step: 0.5 }) : null,
      fColor('Tint', () => n.tint || 'transparent', (v) => ed('Tint', () => { for (const m of many) m.tint = v === 'transparent' ? '' : v; }), { allowNone: true }),
      fRange('Opacity', () => n.opacity, (v) => ed('Opacity', () => { for (const m of many) m.opacity = v; })),
      fRange('Brightness', () => n.brightness ?? 1, (v) => ed('Brightness', () => { for (const m of many) m.brightness = v; }), { min: 0.2, max: 2 }),
      fNum('Glow', () => n.glow || 0, (v) => ed('Glow', () => { for (const m of many) m.glow = Math.max(0, v); }), { min: 0 }),
      fSelect('Blend', () => n.blend || 'source-over', (v) => ed('Blend', () => { for (const m of many) m.blend = v; }), BLEND_MODES.map((b) => [b, b === 'source-over' ? 'normal' : b])),
      fRow([fCheck('Outline', () => n.outline, (v) => ed('Outline', () => { for (const m of many) m.outline = v; })), fCheck('Shadow', () => n.shadow, (v) => ed('Shadow', () => { for (const m of many) m.shadow = v; }))]),
    ]));
    if (n.type === 'path' || n.type === 'polygon') {
      const pts = n.points;
      body.appendChild(sectionEl(`POINTS (${pts.length})`, [
        fRow([n.type === 'path' ? fCheck('Closed', () => n.closed, (v) => ed('Closed', () => { n.closed = v; })) : null, fCheck('Smooth', () => n.type === 'path' ? n.smooth !== false : !!n.smooth, (v) => ed('Smooth', () => { n.smooth = v; }))]),
        ...pts.map((p, i) => fRow([fNum(`#${i} X`, () => p[0], (v) => ed('Point', () => { n.points[i][0] = v; }), { key: `px${i}` }), fNum('Y', () => p[1], (v) => ed('Point', () => { n.points[i][1] = v; }), { key: `py${i}` }), h('button', { class: 'btn tiny ghost', text: '✕', title: 'Remove point', onclick: () => { select(n.id); Tools.removeVertex(i); } })])),
        h('div', { class: 'row', style: { display: 'flex', gap: '4px' } }, [h('button', { class: 'btn tiny', text: '+ ADD POINT', onclick: () => { ed('Add point', () => { const a = pts[pts.length - 1], b = pts[0]; n.points.push([round((a[0] + b[0]) / 2, 1), round((a[1] + b[1]) / 2, 1)]); }); this.render(); } }), h('button', { class: 'btn tiny', text: 'CENTER POINTS', onclick: () => { ed('Center points', () => { const b = boundsOfPoints(pts); const cx = b.x + b.w / 2, cy = b.y + b.h / 2; n.points = pts.map(([x, y]) => [round(x - cx, 1), round(y - cy, 1)]); const [wx, wy] = M.apply(worldMatrix(n), cx, cy); setWorldPosition(n, wx, wy); }); this.render(); } })]),
        h('div', { class: 'hint', text: 'On the canvas: drag the white vertex handles · Alt+click an edge to insert a point · Delete removes the highlighted point.' }),
      ]));
    }
    if (n.type === 'prefab') body.appendChild(sectionEl('PROP LOOK', [fNum('Variant', () => n.variant || 0, (v) => ed('Variant', () => { n.variant = Math.max(0, Math.floor(v)); }), { min: 0, max: 3 }), fColor('Accent tint', () => n.tint || 'transparent', (v) => ed('Tint', () => { n.tint = v === 'transparent' ? '' : v; }), { allowNone: true })]));
  },
  // ------------------------------------------------------------- BEHAVIOR
  renderBehavior(body, n) {
    const ed = (label, fn) => this.edit(n, `~${label}`, fn);
    const b = n.behavior;
    body.appendChild(sectionEl('PROP BEHAVIOR', [
      fCheck('Interactable (player can press E)', () => b.interactable, (v) => ed('Interactable', () => { b.interactable = v; })),
      b.interactable ? fText('Interaction text', () => b.text || '', (v) => ed('Text', () => { b.text = v; }), { multiline: true }) : null,
      fSelect('Wind sway', () => b.wind || 'none', (v) => ed('Wind', () => { b.wind = v; }), ['none', 'gentle', 'strong']),
      b.wind && b.wind !== 'none' ? fNum('Wind amount (°)', () => b.windAmount || 2, (v) => ed('Wind', () => { b.windAmount = v; }), { min: 0, max: 30, step: 0.5 }) : null,
      fSelect('Custom idle animation', () => b.idle || 'none', (v) => ed('Idle', () => { b.idle = v; Scene.startClock(6000); }), ['none', 'bob', 'sway', 'pulse', 'spin']),
      b.idle && b.idle !== 'none' ? fRow([fNum('Speed', () => b.idleSpeed || 1, (v) => ed('Idle', () => { b.idleSpeed = v; }), { step: 0.1, min: 0.1 }), fNum('Amount', () => b.idleAmount || 1, (v) => ed('Idle', () => { b.idleAmount = v; }), { step: 0.1, min: 0.1 })]) : null,
      fCheck('Shadow', () => n.shadow, (v) => ed('Shadow', () => { n.shadow = v; })),
      fCheck('Save point', () => b.savePoint, (v) => ed('Save point', () => { b.savePoint = v; })),
      fCheck('Treasure chest', () => b.chest, (v) => ed('Chest', () => { b.chest = v; })),
      b.chest ? fText('Chest contents', () => b.item || '', (v) => ed('Chest', () => { b.item = v; }), { placeholder: 'item id · e.g. basic_ball x3' }) : null,
      h('div', { class: 'hint', text: 'Live Preview (VIEW menu) shows wind and idle animations in the editor. Playtest shows interactions.' }),
    ]));
    if (n.type === 'group' || n.type === 'prefab') body.appendChild(sectionEl('LIBRARY', [h('button', { class: 'btn small', text: 'SAVE AS CUSTOM PROP → LIBRARY', onclick: () => Ops.saveToLibrary([n.id]) })]));
    if (isCreatureMode()) body.appendChild(sectionEl('CREATURE PART', [fSelect('Part type', () => n.partType || 'Detail', (v) => ed('Part type', () => { n.partType = v; }), CREATURE_PART_TYPES), fCheck('Mirror for facing left', () => n.mirror !== false, (v) => ed('Mirror', () => { n.mirror = v; })), h('div', { class: 'hint', text: 'Part types help the exporter and the game rig map body parts (legs, tail, wings…).' })]));
  },
  // ------------------------------------------------------------- COLLISION
  renderCollision(body, n) {
    const ed = (label, fn) => this.edit(n, `~${label}`, fn);
    const c = n.collision;
    body.appendChild(sectionEl('COLLISION SHAPE', [
      fCheck('Enabled', () => c.enabled, (v) => { ed('Collision', () => { c.enabled = v; }); this.render(); }),
      fSelect('Shape', () => c.type, (v) => { ed('Collision shape', () => { c.type = v; }); this.render(); }, ['rect', 'circle', 'polygon']),
      fSelect('Mode', () => c.mode || 'blocked', (v) => ed('Collision mode', () => { c.mode = v; }), COLLISION_MODES.map((m) => [m.id, m.name])),
      c.type === 'rect' ? fRow([fNum('X', () => c.rect[0], (v) => ed('Collision', () => { c.rect[0] = v; }), { key: 'cx' }), fNum('Y', () => c.rect[1], (v) => ed('Collision', () => { c.rect[1] = v; }), { key: 'cy' })]) : null,
      c.type === 'rect' ? fRow([fNum('W', () => c.rect[2], (v) => ed('Collision', () => { c.rect[2] = Math.max(1, v); }), { key: 'cw' }), fNum('H', () => c.rect[3], (v) => ed('Collision', () => { c.rect[3] = Math.max(1, v); }), { key: 'ch' })]) : null,
      c.type === 'circle' ? fNum('Radius', () => c.radius, (v) => ed('Collision', () => { c.radius = Math.max(1, v); }), { key: 'cr', min: 1 }) : null,
      c.type === 'polygon' ? h('div', {}, [...c.points.map((p, i) => fRow([fNum(`#${i} X`, () => p[0], (v) => ed('Collision', () => { c.points[i][0] = v; }), { key: `cpx${i}` }), fNum('Y', () => p[1], (v) => ed('Collision', () => { c.points[i][1] = v; }), { key: `cpy${i}` }), h('button', { class: 'btn tiny ghost', text: '✕', onclick: () => { if (c.points.length <= 3) return; ed('Collision', () => { c.points.splice(i, 1); }); this.render(); } })])), h('button', { class: 'btn tiny', text: '+ ADD VERTEX', onclick: () => { ed('Collision', () => { const a = c.points[c.points.length - 1], b0 = c.points[0]; c.points.push([round((a[0] + b0[0]) / 2, 1), round((a[1] + b0[1]) / 2, 1)]); }); this.render(); } })]) : null,
      h('div', { class: 'row', style: { display: 'flex', gap: '4px', flexWrap: 'wrap', paddingTop: '4px' } }, [h('button', { class: 'btn tiny', text: 'FIT TO BOUNDS', onclick: () => this.fitCollision(n) }), h('button', { class: 'btn tiny', text: 'FOOTPRINT (BOTTOM ⅓)', onclick: () => this.fitCollision(n, true) }), h('button', { class: 'btn tiny', text: 'EDIT ON CANVAS (C)', onclick: () => UI.setTool('collision') })]),
    ]));
    body.appendChild(sectionEl('COLLIDES WITH', [h('div', { class: 'chips' }, COLLISION_LAYERS.map((l) => h('button', { class: `chip ${c.layers[l] ? 'active' : ''}`, text: l === 'mythling' ? 'wild mythling' : l, onclick: (e) => { ed('Collision layers', () => { c.layers[l] = !c.layers[l]; }); e.target.classList.toggle('active'); } }))), h('div', { class: 'hint', text: 'Categories: player · wild mythling · NPC · projectile · interaction. Playtest uses the player category.' })]));
    body.appendChild(sectionEl('VISIBILITY', [fCheck('Show collision shapes in editor', () => settings().showCollision, (v) => { settings().showCollision = v; }), fCheck('Show bounds of selection', () => settings().showBounds, (v) => { settings().showBounds = v; })]));
  },
  fitCollision(n, footprint = false) {
    History.run('Fit collision', () => { const b = localBounds(n); const c = n.collision; c.enabled = true; if (footprint) { const hh = Math.max(6, b.h / 3); c.rect = [round(b.x, 1), round(b.y + b.h - hh, 1), round(b.w, 1), round(hh, 1)]; c.type = 'rect'; } else { c.rect = [round(b.x, 1), round(b.y, 1), round(b.w, 1), round(b.h, 1)]; c.radius = round(Math.max(b.w, b.h) / 2, 1); c.points = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => [round(x, 1), round(y, 1)]); } });
    this.render(); Scene.invalidate();
  },
  // ------------------------------------------------------------- DATA (raw JSON)
  renderData(body, n) { this.jsonEditor(body, `NODE JSON — ${n.name}`, () => n, (obj) => { History.run('Edit JSON', () => { const keep = { id: n.id, parent: n.parent, children: n.children }; for (const k of Object.keys(n)) delete n[k]; Object.assign(n, normalizeNode(Object.assign(obj, keep))); }); Left.render(); }); },
  jsonEditor(body, title, get, apply, { strip = [] } = {}) {
    const src = () => { const o = deepClone(get()); for (const k of strip) delete o[k]; return JSON.stringify(o, null, 2); };
    const ta = h('textarea', { class: 'json', spellcheck: 'false' }); ta.value = src();
    const err = h('div', { class: 'hint err hidden' });
    const applyBtn = h('button', { class: 'btn small primary', text: 'APPLY JSON', onclick: () => { try { const obj = JSON.parse(ta.value); err.classList.add('hidden'); apply(obj); toast('JSON applied', 'ok'); UI.refreshAll(); } catch (e) { err.textContent = `Invalid JSON: ${e.message}`; err.classList.remove('hidden'); } } });
    body.appendChild(sectionEl(title, [h('div', { class: 'row', style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' } }, [applyBtn, h('button', { class: 'btn small', text: 'REVERT', onclick: () => { ta.value = src(); err.classList.add('hidden'); } }), h('button', { class: 'btn small', text: 'COPY', onclick: () => copyText(ta.value) })]), ta, err, h('div', { class: 'hint', text: 'Edits here update the visuals when applied. Structure is validated; ids and hierarchy links are preserved.' })]));
  },
  // ------------------------------------------------------------- no selection → document properties
  renderDocument(body) {
    const tab = E.ui.rightTab;
    if (isCreatureMode()) { const my = currentMythling(); if (!my) { body.appendChild(h('div', { class: 'empty', text: 'No Mythling. Create one from CREATURE → New Mythling.' })); return; } if (tab === 'data') return this.jsonEditor(body, `MYTHLING JSON — ${my.name}`, () => my, (obj) => { History.run('Edit Mythling JSON', () => { Object.assign(my, obj); for (const n of Object.values(my.rig.nodes)) normalizeNode(n); }); }); return this.renderMythlingProps(body, my, tab); }
    const map = currentMap(); if (!map) { body.appendChild(h('div', { class: 'empty', text: 'No map. Create one from WORLD → New Map.' })); return; }
    if (tab === 'data') return this.jsonEditor(body, `MAP JSON — ${map.name}`, () => map, (obj) => { History.run('Edit map JSON', () => { Object.assign(map, obj); for (const n of Object.values(map.nodes)) normalizeNode(n); if (map.terrain.length !== map.cols * map.rows) { map.terrain = resizeGrid(map.terrain, map.cols, map.rows, 1); map.collision = resizeGrid(map.collision, map.cols, map.rows, 0); } }); }, { strip: [] });
    if (tab === 'collision') { body.appendChild(sectionEl('MAP COLLISION', [h('div', { class: 'hint', text: 'Select an object to edit its collision shape, or use the COLLISION tool (C) to paint the grid.' }), h('button', { class: 'btn small', text: 'OPEN COLLISION EDITOR', onclick: () => UI.setTool('collision') }), ...COLLISION_MODES.map((m) => { const count = map.collision.filter((v) => v === m.value).length; return kvRow(m.name, `${count} cells`); })])); return; }
    this.renderMapProps(body, map);
  },
  renderMapProps(body, map) {
    const ed = (label, fn) => History.run(`~${label}`, fn);
    body.appendChild(sectionEl('MAP', [
      fText('Name', () => map.name, (v) => { ed('Map name', () => { map.name = v; }); UI.updateHeader(); Left.render(); }),
      kvRow('ID', map.id), kvRow('Size', `${map.width} × ${map.height} px · ${map.cols} × ${map.rows} cells`),
      h('button', { class: 'btn small', text: 'RESIZE MAP…', onclick: () => Screens.resizeMap() }),
      fSelect('Theme', () => map.theme, (v) => ed('Theme', () => { map.theme = v; }), ['nature', 'coast', 'volcano', 'town', 'cave', 'ruins', 'sky', 'custom']),
      fText('Music', () => map.music, (v) => ed('Music', () => { map.music = v; }), { placeholder: 'track id' }),
      fRow([fNum('Level min', () => map.levelMin, (v) => ed('Levels', () => { map.levelMin = v; }), { min: 1 }), fNum('Level max', () => map.levelMax, (v) => ed('Levels', () => { map.levelMax = v; }), { min: 1 })]),
      fSelect('Weather', () => map.weather, (v) => ed('Weather', () => { map.weather = v; }), ['clear', 'rain', 'petals', 'fog', 'ash', 'snow', 'sunset']),
      fColor('Background', () => map.background, (v) => ed('Background', () => { map.background = v; })),
      fSelect('Base terrain', () => map.baseTerrain || 'grass', (v) => ed('Base terrain', () => { map.baseTerrain = v; }), TERRAINS.filter((t) => t.color).map((t) => [t.id, t.name])),
    ]));
    body.appendChild(sectionEl('CAMERA LIMITS', [
      fRow([fNum('Min X', () => map.camera.minX, (v) => ed('Camera', () => { map.camera.minX = v; })), fNum('Min Y', () => map.camera.minY, (v) => ed('Camera', () => { map.camera.minY = v; }))]),
      fRow([fNum('Max X', () => map.camera.maxX, (v) => ed('Camera', () => { map.camera.maxX = v; })), fNum('Max Y', () => map.camera.maxY, (v) => ed('Camera', () => { map.camera.maxY = v; }))]),
      h('button', { class: 'btn tiny', text: 'RESET TO MAP BOUNDS', onclick: () => { ed('Camera', () => { map.camera = { minX: 0, minY: 0, maxX: map.width, maxY: map.height }; }); this.render(); } }),
    ]));
    const spawn = allNodes(map).find((n) => n.type === 'spawn' && n.spawn.kind === 'player');
    body.appendChild(sectionEl('GAMEPLAY', [
      kvRow('Player spawn', spawn ? `${Math.round(spawn.x)}, ${Math.round(spawn.y)} (${spawn.spawn.direction})` : 'none — add a Spawn Point'),
      kvRow('Encounter zones', String(allNodes(map).filter((n) => n.type === 'zone').length)), kvRow('Warps', String(allNodes(map).filter((n) => n.type === 'warp').length)), kvRow('NPCs', String(allNodes(map).filter((n) => n.type === 'npc').length)), kvRow('Triggers', String(allNodes(map).filter((n) => n.type === 'trigger').length)),
      h('div', { class: 'row', style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, [h('button', { class: 'btn small primary', text: 'PLAYTEST (F5)', onclick: () => Playtest.start('map') }), h('button', { class: 'btn small', text: 'VALIDATE', onclick: () => Exporter.validate(true) }), h('button', { class: 'btn small', text: 'EXPORT MAP', onclick: () => { E.exportKind = 'map'; UI.setMode('export'); } })]),
    ]));
  },
  renderMythlingProps(body, my, tab) {
    const ed = (label, fn) => History.run(`~${label}`, fn);
    if (tab === 'transform' || tab === 'appearance') {
      body.appendChild(sectionEl('PALETTE', Object.entries(my.palette || {}).map(([k, v]) => fColor(titleCase(k), () => v, (c) => { my.palette[k] = c; Ops.applyPalette(my); }))));
      body.appendChild(sectionEl('RIG', [kvRow('Body template', my.bodyType), kvRow('Parts', String(Object.values(my.rig.nodes).filter((n) => n.type !== 'anchor').length)), kvRow('Anchors', String(Object.values(my.rig.nodes).filter((n) => n.type === 'anchor').length)), h('div', { class: 'hint', text: 'Select a part on the canvas or in CREATURE PARTS to edit its transform and appearance.' })]));
      return;
    }
    if (tab === 'behavior') { body.appendChild(sectionEl('ANIMATIONS', my.animations.map((id) => E.project.animations[id]).filter(Boolean).map((a) => h('div', { class: 'list-item compact', onclick: () => { UI.setMode('animation'); UI.setAnimation(a.id); } }, [icon('film', 'ticon'), h('span', { class: 'grow', text: a.name }), h('span', { class: 'dim', text: `${a.duration}s` })])), [h('button', { class: 'btn tiny', text: '+ NEW', onclick: () => Screens.newAnimation() })])); body.appendChild(sectionEl('VFX', [h('div', { class: 'chips' }, Object.values(E.project.vfx).map((v) => h('button', { class: `chip ${(my.vfx || []).includes(v.id) ? 'active' : ''}`, text: v.name, onclick: (e) => { ed('Mythling VFX', () => { my.vfx = (my.vfx || []).includes(v.id) ? my.vfx.filter((x) => x !== v.id) : [...(my.vfx || []), v.id]; }); e.target.classList.toggle('active'); } })))])); return; }
    if (tab === 'collision') { body.appendChild(sectionEl('CREATURE COLLISION', [h('div', { class: 'hint', text: 'Creature parts can carry collision shapes for hit detection (projectiles / interaction). Select a part to edit its shape.' })])); return; }
    body.appendChild(sectionEl('MYTHLING', [
      fText('ID', () => my.id, (v) => { const nid = slug(v); if (!nid || nid === my.id) return; if (E.project.mythlings[nid]) { toast('ID already used', 'warn'); return; } History.run('Rename id', () => { E.project.mythlings[nid] = my; delete E.project.mythlings[my.id]; for (const a of Object.values(E.project.animations)) if (a.mythlingId === my.id) a.mythlingId = nid; my.id = nid; }); E.mythlingId = nid; UI.refreshAll(); }),
      fText('Name', () => my.name, (v) => { ed('Name', () => { my.name = v; }); UI.updateHeader(); Left.render(); }, { key: 'name' }),
      fText('Breed', () => my.breed, (v) => ed('Breed', () => { my.breed = v; })),
      fSelect('Element', () => my.element, (v) => ed('Element', () => { my.element = v; }), Object.entries(ELEMENTS).map(([k, e]) => [k, e.name])),
      fSelect('Rarity', () => my.rarity, (v) => ed('Rarity', () => { my.rarity = v; }), RARITIES),
      fSelect('Mood', () => my.mood, (v) => ed('Mood', () => { my.mood = v; }), MOODS),
      fText('Role', () => my.role, (v) => ed('Role', () => { my.role = v; }), { placeholder: 'Starter · Wild · Boss' }),
      fText('Description', () => my.description, (v) => ed('Description', () => { my.description = v; }), { multiline: true }),
      fSelect('Body template', () => my.bodyType, async (v) => { if (await confirmDialog('Rebuild Rig', `Rebuild ${my.name}'s rig with the ${v} template? Parts and animations will be regenerated.`, 'REBUILD')) Ops.rebuildRig(my, v); else this.render(); }, Object.keys(BODY_TEMPLATES)),
      fNum('Catch rate', () => my.catchRate, (v) => ed('Catch rate', () => { my.catchRate = clamp(v, 0, 1); }), { step: 0.05, min: 0, max: 1 }),
      fText('Ultimate', () => my.ultimate, (v) => ed('Ultimate', () => { my.ultimate = v; })),
      fSelect('Stage', () => my.stage, (v) => ed('Stage', () => { my.stage = +v; }), [[0, 'Base (Lv.1)'], [1, 'Stage 2 (Lv.20)'], [2, 'Stage 3 (Lv.60)'], [3, 'Stage 4 (Lv.80)']]),
    ]));
    body.appendChild(sectionEl('BASE STATS', [
      ...Object.keys(my.stats).map((k) => fRange(k.toUpperCase(), () => my.stats[k], (v) => ed('Stats', () => { my.stats[k] = Math.round(v); }), { min: 0, max: k === 'hp' ? 400 : 200, step: 1 })),
      h('div', { class: 'stat-total hint', text: `Total: ${Object.values(my.stats).reduce((a, b) => a + (+b || 0), 0)}` }),
    ]));
    body.appendChild(sectionEl('SKILLS BY LEVEL', [h('div', { class: 'hint', text: 'Skills unlocked per evolution stage are edited in the EVOLUTION editor; the skill list itself in the SKILL editor.' }), h('div', { class: 'row', style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, [h('button', { class: 'btn small', text: 'EVOLUTION EDITOR', onclick: () => UI.setMode('evolution') }), h('button', { class: 'btn small', text: 'SKILL EDITOR', onclick: () => UI.setMode('skills') }), h('button', { class: 'btn small', text: 'MYTHLING BROWSER', onclick: () => UI.setMode('browser') })])]));
  },
  // ------------------------------------------------------------- selected keyframe
  renderKeyframe(body) {
    const a = currentAnim(); const k = E.selectedKey; if (!a || !k || !a.tracks[k.trackId] || !a.tracks[k.trackId][k.index]) return;
    const kf = a.tracks[k.trackId][k.index]; const part = getNode(k.trackId);
    const ed = (fn) => { History.run('~Edit keyframe', fn); invalidateMatrices(); Bottom.render(); Scene.invalidate(); };
    body.appendChild(sectionEl(`KEYFRAME — ${part ? part.name : k.trackId} @ ${fmtTime(kf.t)}`, [
      fNum('Time (s)', () => kf.t, (v) => { ed(() => { kf.t = clamp(v, 0, a.duration); a.tracks[k.trackId].sort((x, y) => x.t - y.t); k.index = a.tracks[k.trackId].indexOf(kf); }); }, { step: 0.05, min: 0 }),
      fRow([fNum('X offset', () => kf.x, (v) => ed(() => { kf.x = v; })), fNum('Y offset', () => kf.y, (v) => ed(() => { kf.y = v; }))]),
      fNum('Rotation', () => kf.rotation, (v) => ed(() => { kf.rotation = v; }), { unit: '°' }),
      fRow([fNum('Scale X', () => kf.scaleX, (v) => ed(() => { kf.scaleX = v; }), { step: 0.05 }), fNum('Scale Y', () => kf.scaleY, (v) => ed(() => { kf.scaleY = v; }), { step: 0.05 })]),
      fRange('Opacity', () => kf.opacity, (v) => ed(() => { kf.opacity = v; })),
      fSelect('Easing', () => kf.ease || 'easeInOut', (v) => ed(() => { kf.ease = v; }), EASING_IDS.map((e) => [e, titleCase(e)])),
      h('div', { class: 'row', style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, [h('button', { class: 'btn tiny', text: 'COPY', onclick: () => Ops.copyKeyframes(a, k.trackId) }), h('button', { class: 'btn tiny danger', text: 'DELETE', onclick: () => Ops.deleteKeyframe(a, k.trackId, k.index) })]),
    ]));
  },
};
