// Scenario: GAME PRESETS — the game data snapshot embedded in MythlingEdit.html becomes an editable project
// and round-trips back to the game's own data schema. Runs headless (see harness.mjs). Exit code 1 on failure.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { window, document, wait, $, $$, btn, snapshot, errors, report, key } from './harness.mjs';

const OUT = process.env.EDITOR_TEST_OUT || os.tmpdir();
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.log('WATCHDOG exit'); report('watchdog'); process.exit(2); }, 170000).unref();
await wait(2500);
console.log('overlay dialogs open:', document.querySelectorAll('.overlay').length, [...document.querySelectorAll('.overlay h3')].map((h) => h.textContent).join(','));
for (const o of document.querySelectorAll('.overlay .x')) o.click();
await wait(50);
const W = new Proxy({}, { get: (_, k) => { try { return window.eval(k); } catch { return undefined; } } });
const step = async (name, fn) => { const before = errors.length; try { await fn(); } catch (e) { errors.push('STEP ' + name + ': ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' | ')); } console.log(`${errors.length === before ? 'PASS' : 'FAIL'} ${name}`); const seen = new Set(); for (const e of errors.slice(before)) { const k = e.slice(0, 120); if (seen.has(k)) continue; seen.add(k); console.log('    ! ' + e); } if (errors.length - before > seen.size) console.log(`    (+${errors.length - before - seen.size} similar)`); };
const E = W.E, UI = W.UI, Ops = W.Ops, Scene = W.Scene, Screens = W.Screens, Exporter = W.Exporter, App = W.App, Playtest = W.Playtest, Game = W.Game, GS = W.GameSnapshot, History = W.History;
const frame = async (ms = 80) => { await wait(ms); Scene.frame && Scene.frame(window.performance.now()); };
const shot = (name) => snapshot($('#scene'), path.join(OUT, `mythling-edit_${name}.png`));
const assert = (c, m) => { if (!c) throw new Error(m); };
const dlgBtn = (re) => { const b = $$('.overlay button').find((x) => re.test(x.textContent.trim())); if (!b) throw new Error('no dialog button ' + re); b.click(); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const diff = (a, b, p = '') => { const out = []; if (typeof a !== typeof b || (a && typeof a === 'object') !== (b && typeof b === 'object')) return [`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`]; if (a && typeof a === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diff(a[k], b[k], `${p}.${k}`)); return out; } if (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) > 0.06 : a !== b) out.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); return out; };
const evalExport = (text) => { const out = {}; new Function('exports', text.replace(/export const (\w+) =/g, 'exports.$1 =')).call(null, out); return out; };

await step('boot → game project by default', async () => {
  assert(GS && Game.ok, 'no GameSnapshot (built with --no-game?)');
  const p = E.project; assert(p, 'no project');
  console.log('   project:', p.project.name, 'source', p.project.source, '| maps', Object.keys(p.maps).join(','), '| mythlings', Object.keys(p.mythlings).length, '| skills', Object.keys(p.skills).length, '| vfx', Object.keys(p.vfx).length, '| animations', Object.keys(p.animations).length);
  assert(p.project.source === 'game', 'first-open project should come from game presets');
  assert(Object.keys(p.maps).length === GS.maps.MAP_ORDER.length && Object.keys(p.mythlings).length === Object.keys(GS.species.SPECIES).length, 'counts');
  assert(Object.keys(p.skills).length === Object.keys(GS.skills.SKILLS).length + Object.keys(GS.skills.ULTIMATES).length, 'skill count');
  assert(Object.keys(p.vfx).length >= Object.keys(GS.skillVfx.SKILL_VFX).length + 20, 'vfx count');
  assert(Object.keys(p.animations).length === Object.keys(GS.species.SPECIES).length * 12, 'animation count ' + Object.keys(p.animations).length);
  console.log('   TERRAINS', W.TERRAINS.length, '| library cats', W.PREFAB_CATEGORIES.join(','), '| game prefabs', Object.keys(W.PREFABS).filter((k) => k.startsWith('game_')).length, '| MOODS', W.MOODS.length, 'RARITIES', W.RARITIES.join(','));
});

await step('maps mirror the game data', async () => {
  const p = E.project;
  for (const id of GS.maps.MAP_ORDER) {
    const gm = GS.maps.MAPS[id], m = p.maps[id]; assert(m, 'missing map ' + id);
    assert(m.width === gm.width && m.height === gm.height && m.name === gm.displayName, 'size/name ' + id);
    const nodes = Object.values(m.nodes); const count = (pred) => nodes.filter(pred).length;
    const props = count((n) => n.type === 'prefab' && n.prefab === 'game_prop'); const gprops = Game.world().props(gm).length;
    console.log(`   ${id}: ${m.width}×${m.height} nodes=${nodes.length} regions=${count((n) => n.behavior?.region)}/${gm.regions.length} water=${count((n) => n.behavior?.water)}/${gm.water.length} bridges=${count((n) => n.prefab === 'bridge')}/${gm.bridges.length} buildings=${count((n) => n.prefab === 'game_building')}/${gm.buildings.length} landmarks=${count((n) => n.prefab === 'game_landmark')}/${gm.landmarks.length} npcs=${count((n) => n.type === 'npc' && n.npc.kind !== 'trainer')}/${gm.npcs.length} trainers=${count((n) => n.type === 'npc' && n.npc.kind === 'trainer')}/${gm.trainers.length} zones=${count((n) => n.type === 'zone')}/${gm.encounterZones.length} warps=${count((n) => n.type === 'warp')}/${gm.connections.length} props=${props}/${gprops}`);
    assert(props === gprops, 'prop count');
    for (const np of [...gm.npcs, ...gm.trainers]) { const n = m.nodes[`${id}:${np.id}`]; assert(n && n.x === np.x && n.y === np.y && n.name === np.name, 'npc pos ' + np.id); }
    for (const z of gm.encounterZones) { const n = m.nodes[`${id}:${z.id}`]; assert(n && n.type === 'zone', 'zone ' + z.id); assert(same(n.zone.species, z.species.map((s) => s.id)), 'zone species'); assert(z.species.every((s) => n.zone.weights[s.id] === s.weight), 'zone weights'); }
    for (const c of gm.connections) { const n = m.nodes[`${id}:${c.id}`]; assert(n && n.warp.toMap === c.toMap && n.warp.toX === c.toPoint.x && (n.warp.requiredFlag || '') === (c.requiresItem || ''), 'connection ' + c.id); }
    for (const r of gm.regions) { const [x, y, w, h] = r.rect; const tid = Game.terrainIdOf(m, x + w / 2, y + h / 2); assert(tid === `game_${r.terrain}`, `region paint ${r.id}: ${tid}`); }
    const spawn = nodes.find((n) => n.type === 'spawn'); assert(spawn && spawn.x === gm.spawn.x && spawn.y === gm.spawn.y, 'spawn');
    const locked = nodes.find((n) => n.id === `${id}:props_g`); assert(locked && locked.locked && locked.children.length === gprops, 'locked props group');
  }
});

await step('mythlings mirror the game art + sampled animations', async () => {
  const p = E.project;
  for (const id of Object.keys(GS.species.SPECIES)) {
    const my = p.mythlings[id]; assert(my, 'missing ' + id);
    const art = GS.art.artFor(id); const parts = Object.values(my.rig.nodes).filter((n) => n.type === 'gamepart');
    if (GS.species.SPECIES[id].legendary) assert(my.evolutions.length === 1 && (my.elements || GS.species.SPECIES[id].elements).length >= 2, 'legendary shape ' + id);
    assert(parts.length === art.parts.length, `${id} parts ${parts.length} vs ${art.parts.length}`);
    assert(my.animations.length === 12, 'anims ' + id);
    const anchors = Object.values(my.rig.nodes).filter((n) => n.type === 'anchor').map((n) => n.name);
    for (const req of ['Root', 'Head', 'Mouth', 'AttackOrigin', 'VFXOrigin', 'BodyCenter']) assert(anchors.includes(req), `${id} anchor ${req}`);
    assert(same(my.stats, GS.species.SPECIES[id].baseStats), 'stats ' + id);
    assert(my.evolutions.length === GS.species.SPECIES[id].evolutions.length, 'evolutions ' + id);
  }
  const sp = p.mythlings.spriggo; const walk = p.animations[sp.animations.find((a) => p.animations[a].name === 'Walk')];
  const legFL = walk.tracks[sp.parts.legFL]; assert(legFL && legFL.length >= 3, 'walk legFL keys');
  const R = GS.rig; const tf = {}; for (const pt of GS.art.artFor('spriggo').parts) tf[pt.name] = R.newTf(); const root = R.newTf(); const ctrl = new R.CreatureAnimationController(tf, root); ctrl.seed = 0; ctrl.state = 'walk'; ctrl.loop = true;
  const t = walk.duration * 0.37; ctrl.time = t; ctrl.phase = (t / R.ANIMATIONS.walk.loop) % 1; ctrl.apply({ tf, root, blink: 0 }, t);
  const s = W.sampleTrack(legFL, t, walk); console.log('   walk legFL @', t.toFixed(3), 'game dy', tf.legFL.dy.toFixed(3), 'rot', (tf.legFL.rot * 180 / Math.PI).toFixed(2), '| editor y', s.y.toFixed(3), 'rot', s.rotation.toFixed(2));
  assert(Math.abs(s.y - tf.legFL.dy) < 0.25 && Math.abs(s.rotation - tf.legFL.rot * 180 / Math.PI) < 0.8, 'sampled track deviates from game');
});

await step('render creature (game parts) + map + property panels', async () => {
  UI.openMythling('spriggo', 'creature'); await frame(120); shot('spriggo');
  UI.openMythling('emberu', 'creature'); await frame(120); shot('emberu');
  UI.setMode('animation'); UI.setAnimation(E.project.mythlings.emberu.animations[2]); E.playing = true; await frame(200); shot('anim'); E.playing = false;
  UI.openMap('verdant_vale'); Scene.fit(); await frame(150); shot('verdant_fit');
  E.view.zoom = 1; E.view.x = 420 - Scene.w / 2; E.view.y = 980 - Scene.h / 2; Scene.invalidate(); await frame(150); shot('verdant_spawn');
  UI.openMap('emberwild'); Scene.fit(); await frame(150); shot('ember_fit');
  const map = W.currentMap(); const prop = Object.values(map.nodes).find((n) => n.prefab === 'game_prop' && n.gameKind === 'rock');
  const [wx, wy] = W.worldPos(prop, map); const hit = W.hitTest(wx, wy - 4, { includeLocked: true }); assert(hit && hit.id === prop.id, 'prop should win hit test over regions');
  UI.showLeftTab('library'); E.ui.libraryCat = 'Game'; W.Left.render(); await frame(30); console.log('   Game library cards:', $$('#left-body .card').length); assert($$('#left-body .card').length > 20, 'game library');
  W.select(prop.id); UI.showRightTab('properties'); await frame(30);
  const zone = Object.values(map.nodes).find((n) => n.type === 'zone'); W.select(zone.id); await frame(30); assert($$('#right-body label').some((l) => /Species weights/.test(l.textContent)), 'zone weights panel');
  const region = Object.values(map.nodes).find((n) => n.behavior?.region); W.select(region.id); await frame(30); assert($$('#right-body button').some((b) => /REPAINT GROUND/.test(b.textContent)), 'region panel');
  const water = Object.values(map.nodes).find((n) => n.behavior?.water); W.select(water.id); await frame(30); assert($$('#right-body label').some((l) => /Kind/.test(l.textContent)), 'water panel');
  const trainer = Object.values(map.nodes).find((n) => n.type === 'npc' && n.npc.kind === 'trainer'); W.select(trainer.id); await frame(30); assert($$('#right-body label').some((l) => /Defeat line/.test(l.textContent)), 'trainer panel');
  UI.updateHeader(); const opts = [...$('#crumb select').options].map((o) => o.text); console.log('   map dropdown:', opts.join(' | ')); assert(opts.some((t) => /real game map/.test(t)), 'map dropdown game entries');
});

await step('playtest: walk from the Verdant spawn, water blocks, bridge crosses, NPC talks', async () => {
  UI.openMap('verdant_vale'); await frame(50);
  const map = W.currentMap(); const gm = GS.maps.MAPS.verdant_vale;
  const bridge = gm.bridges[0]; const water = gm.water.find((w) => bridge.x + bridge.w / 2 >= w.x && bridge.x + bridge.w / 2 <= w.x + w.w && bridge.y + bridge.h / 2 >= w.y && bridge.y + bridge.h / 2 <= w.y + w.h) || gm.water[0];
  const inWater = [water.x + 40, water.y + water.h / 2], onBridge = [bridge.x + bridge.w / 2, bridge.y + bridge.h / 2];
  Playtest.start(); await frame(100);
  const pt = E.playtest; assert(pt && pt.player, 'playtest not started');
  assert(Math.abs(pt.player.x - gm.spawn.x) < 1 && Math.abs(pt.player.y - gm.spawn.y) < 1, 'spawn position');
  console.log('   canStand water:', Playtest.canStand(map, ...inWater), '| bridge:', Playtest.canStand(map, ...onBridge), '| spawn:', Playtest.canStand(map, gm.spawn.x, gm.spawn.y));
  assert(!Playtest.canStand(map, ...inWater), 'water should block'); assert(Playtest.canStand(map, ...onBridge), 'bridge should allow');
  const x0 = pt.player.x; document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true })); for (let i = 0; i < 40; i++) Playtest.update(1 / 60); assert(pt.player.x > x0 + 20, 'did not walk'); key('ArrowRight', { code: 'ArrowRight' });
  await frame(80); shot('playtest');
  const npc = gm.npcs[0]; pt.player.x = npc.x - 30; pt.player.y = npc.y; pt.player.dir = 'right'; Playtest.interact(); console.log('   dialogue:', pt.dialogue ? `${pt.dialogue.node.name}: ${pt.dialogue.lines[0].slice(0, 50)}` : 'none'); assert(pt.dialogue, 'npc dialogue');
  Playtest.stop(); await frame(50);
});

await step('game-format export round-trips maps / species / skills / vfx', async () => {
  for (const id of GS.maps.MAP_ORDER) {
    const r = Exporter.build('map', id, { json: false, js: false, png: false, debug: false, game: true });
    const f = r.files.find((x) => x.name.endsWith('.game.js')); assert(f, 'no game file');
    const d = diff(GS.maps.MAPS[id], Object.values(evalExport(f.text))[0]); console.log(`   ${id}: ${(f.text.length / 1024).toFixed(1)} KB, diffs=${d.length}`); for (const x of d.slice(0, 8)) console.log('      ' + x);
    assert(d.length === 0, 'map round trip ' + id);
  }
  for (const id of Object.keys(GS.species.SPECIES)) {
    const r = Exporter.build('mythling', id, { json: false, js: false, png: false, debug: false, game: true });
    const d = diff(GS.species.SPECIES[id], Object.values(evalExport(r.files.find((x) => x.name.endsWith('.game.js')).text))[0]); if (d.length) console.log(`   species ${id}: diffs=${d.length}`, d.slice(0, 4).join('; '));
    assert(d.length === 0, 'species round trip ' + id);
  }
  const r = Exporter.build('project', null, { json: false, js: false, png: false, debug: false, game: true });
  console.log('   project game files:', r.files.map((f) => `${f.name} ${(f.text.length / 1024).toFixed(0)}KB`).join(', '));
  const sk = evalExport(r.files.find((f) => f.name.endsWith('.skills.game.js')).text);
  const norm = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === Infinity ? 'Infinity' : v)));
  let bad = 0; for (const [id, s] of Object.entries(GS.skills.SKILLS)) { const d = diff(norm(s), norm(sk.SKILLS[id])); if (d.length) { bad++; if (bad <= 5) console.log('      skill diff', id, d.slice(0, 3).join('; ')); } }
  for (const [id, s] of Object.entries(GS.skills.ULTIMATES)) { const d = diff(norm(s), norm(sk.ULTIMATES[id])); if (d.length) { bad++; if (bad <= 8) console.log('      ult diff', id, d.slice(0, 3).join('; ')); } }
  console.log('   skills round trip mismatches:', bad); assert(bad === 0, 'skills round trip');
  const vf = evalExport(r.files.find((f) => f.name.endsWith('.skillvfx.game.js')).text); let vbad = 0; for (const [id, v] of Object.entries(GS.skillVfx.SKILL_VFX)) if (diff(v, vf.SKILL_VFX[id]).length) vbad++; console.log('   vfx round trip mismatches:', vbad); assert(vbad === 0, 'vfx round trip');
  assert(/GAME PRESETS/.test(Exporter.arenaPackage('map', 'verdant_vale', r)), 'package note');
  const rj = Exporter.build('mythling', 'spriggo', { json: true, js: true, png: true, debug: true }); assert(rj.files.length === 2 && rj.pngs.length === 1, 'regular export');
});

await step('edit a game map + repaint, then export reflects the edit', async () => {
  UI.openMap('azure_coast'); const map = W.currentMap();
  const region = Object.values(map.nodes).find((n) => n.behavior?.region);
  History.run('edit', () => { region.behavior.region.terrain = 'ash'; }); Game.repaintRegions(map);
  assert(Game.terrainIdOf(map, region.x, region.y) === 'game_ash', 'repaint');
  const npc = Object.values(map.nodes).find((n) => n.type === 'npc'); History.run('move', () => { npc.x += 50; });
  const e = Object.values(evalExport(Exporter.build('map', 'azure_coast', { game: true }).files[0].text))[0];
  assert(e.regions[0].terrain === 'ash', 'export terrain'); assert(e.npcs.find((x) => x.id === npc.gameId).x === npc.x, 'export npc move');
  History.undo(); History.undo(); assert(W.currentMap().nodes[region.id].behavior.region.terrain !== 'ash', 'undo');
});

await step('evolution stage rig from game art + stage switch + rebuild + palette', async () => {
  const p = E.project; const my = p.mythlings.spriggo;
  UI.openMythling('spriggo', 'evolution'); E.ui.evoStage = 2; Screens.show('evolution'); await frame(50);
  btn('CREATE STAGE RIG', $('#screen-layer')); await frame(50);
  const st = p.mythlings.spriggo_stage3; assert(st && st.game.stage === 2 && Object.values(st.rig.nodes).filter((n) => n.type === 'gamepart').length === GS.art.artFor('spriggo').parts.length, 'stage rig');
  assert(st.rig.nodes[st.parts.head].y !== my.rig.nodes[my.parts.head].y, 'stage skeleton should differ');
  UI.openMythling('spriggo_stage3', 'creature'); await frame(100); shot('spriggo_stage3');
  History.run('stage', () => Game.applyStage(my, 1)); assert(my.game.stage === 1 && my.stage === 1, 'applyStage'); History.undo(); assert(p.mythlings.spriggo.game.stage === 0, 'undo stage');
  const m2 = p.mythlings.spriggo; History.run('pal', () => { m2.palette.primary = '#ff00aa'; }); Ops.applyPalette(m2); const pal = Game.paletteFor(m2); assert(pal.primary === '#ff00aa' && pal.light !== pal.primary, 'palette derive'); History.undo();
  assert(Ops.rebuildGameRig(p.mythlings.leaflet) && p.mythlings.leaflet.animations.length === 12, 'rebuild');
  UI.openMythling('leaflet', 'creature'); await frame(80); shot('leaflet');
  console.log('   validation warnings:', Exporter.validate(false).length);
});

await step('screens with game content: browser, skills, vfx library, export, creature playtest, map PNG', async () => {
  UI.setMode('browser'); await frame(80);
  E.skillId = 'burning_fang'; UI.setMode('skills'); await frame(80); assert($$('#screen-layer label').some((t) => /Damage type/.test(t.textContent)), 'damage type field');
  E.skillId = Object.keys(GS.skills.ULTIMATES)[0]; Screens.show('skills'); await frame(60); assert($$('#screen-layer label').some((t) => /tiers/i.test(t.textContent)), 'tiers field');
  btn('PREVIEW', $('#screen-layer')); await frame(300);
  UI.setMode('vfxlib'); await frame(80); E.vfxId = 'burning_fang'; UI.setMode('vfx'); await frame(120);
  UI.setMode('export'); await frame(80); assert($$('#screen-layer label').some((t) => /Game format/.test(t.textContent)), 'game format checkbox');
  const mc = Exporter.mapCanvas(E.project.maps.verdant_vale, 1024); assert(mc && mc.width, 'map canvas'); snapshot(mc, path.join(OUT, 'mythling-edit_map_png.png'));
  UI.openMythling('rivruff', 'creature'); await frame(50); Playtest.start('creature'); await frame(150); shot('creature_playtest'); Playtest.stop(); await frame(30);
});

await step('game presets dialog + about dialog + demo-project hint', async () => {
  const pr = App.gamePresets(); await wait(120);
  const dlg = $('.overlay'); assert(dlg && /GAME PRESETS/.test(dlg.textContent), 'dialog'); dlgBtn(/CANCEL/); await pr; await wait(30);
  Screens.aboutGameData(); await wait(50); assert(/SNAPSHOT/.test($('.overlay')?.textContent || ''), 'about dialog'); dlgBtn(/CLOSE/); await wait(30);
  // a demo (non-game) project opened from storage gets the one-time hint
  window.localStorage.clear(); const demo = W.buildDemoProject(); await W.Store.saveProject(demo); await App.openProjectId(demo.project.id); await wait(1200);
  const toasts = $$('#toasts .toast').map((t) => t.textContent); console.log('   toasts:', toasts.map((t) => t.slice(0, 60)).join(' | ')); assert(toasts.some((t) => /Game Presets/.test(t)), 'hint toast');
  // the map dropdown imports a game map into the demo project
  UI.openMap(Object.keys(E.project.maps)[0]); UI.updateHeader(); const sel = $('#crumb select'); const opt = [...sel.options].find((o) => o.value === '__game:verdant_vale'); assert(opt, 'dropdown entry');
  const before = Object.keys(E.project.maps).length; sel.value = '__game:verdant_vale'; sel.dispatchEvent(new window.Event('change')); await wait(120);
  if ($$('.overlay button').some((b) => /RESET/.test(b.textContent))) dlgBtn(/RESET/); // the demo project already has a map with that id
  await wait(250);
  console.log('   maps before/after dropdown import:', before, Object.keys(E.project.maps).length, 'current', E.mapId);
  assert(E.project.maps.verdant_vale && E.project.maps.verdant_vale.source === 'game' && E.mapId === 'verdant_vale', 'dropdown import');
});

await step('new project from game presets via dialog + reload keeps game data', async () => {
  window.localStorage.clear(); // jsdom's 5 MB localStorage quota cannot hold two ~3 MB projects (real browsers use IndexedDB)
  const pr = App.newProject({ game: true }); await wait(150); if ($$('.overlay button').some((b) => /DISCARD/.test(b.textContent))) { dlgBtn(/DISCARD/); await wait(200); } dlgBtn(/CREATE/); await pr; await wait(200);
  for (const o of document.querySelectorAll('.overlay .x')) o.click();
  assert(E.project.project.source === 'game' && Object.keys(E.project.mythlings).length === Object.keys(GS.species.SPECIES).length, 'game project via dialog');
  const saved = JSON.parse(JSON.stringify(E.project)); W.migrateProject(saved);
  await App.loadIntoEditor(saved, { fresh: true }); await frame(100); UI.openMythling('spriggo', 'creature'); await frame(100);
  assert(Object.values(E.project.mythlings.spriggo.rig.nodes).filter((n) => n.type === 'gamepart').length === GS.art.artFor('spriggo').parts.length, 'reload keeps game parts');
  const z = Object.values(E.project.maps.verdant_vale.nodes).find((n) => n.type === 'zone'); assert(z.zone.weights && Object.keys(z.zone.weights).length, 'weights survive normalize');
});

report('game-presets');
console.log(errors.length ? 'FAILED' : 'ALL PASSED', '— screenshots in', OUT);
process.exit(errors.length ? 1 : 0);
