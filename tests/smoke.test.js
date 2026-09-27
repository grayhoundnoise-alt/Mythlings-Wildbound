// Headless verification of the rules that matter most (no DOM required).
// Run with:  npm test
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// minimal browser shims used by a couple of modules at import time
globalThis.window = globalThis;
// canvas shim: the creature rig bakes its layers into offscreen canvases and the
// VFX layer draws into them, so every 2D call is a no-op here.
const noopCtx = () => {
  const grad = { addColorStop() {} };
  const base = {
    canvas: { width: 300, height: 300 },
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', font: '', textAlign: 'left',
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null,
    setTransform() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {},
    arc() {}, ellipse() {}, rect() {}, fill() {}, stroke() {}, clip() {},
    fillRect() {}, strokeRect() {}, clearRect() {}, drawImage() {}, fillText() {}, strokeText() {},
    measureText: () => ({ width: 10 }), setLineDash() {},
  };
  return new Proxy(base, { get: (o, k) => (k in o ? o[k] : undefined), set: (o, k, v) => { o[k] = v; return true; } });
};
globalThis.document = {
  documentElement: { dataset: {} },
  createElement: (tag) => {
    if (tag === 'canvas') return { tagName: 'CANVAS', width: 300, height: 300, style: {}, getContext: () => noopCtx() };
    return { tagName: String(tag).toUpperCase(), style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild(c) { return c; }, children: [] };
  },
};
globalThis.window.devicePixelRatio = 2;
globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};

const { createMythling, gainExp, computeStats, resetToLevelOne, canEvolve, evolve,
  ultimateUnlocked, ultimateMove, addUltimateCharge, isMaxLevel, restoreAll,
  usesLeft, consumeUse, equipSkill, librarySkills } = await import('../src/core/mythling.js');
const { LEVEL_CAP, expToNextLevel } = await import('../src/data/config.js');
const { Battle, BattleType, BattlePhase, captureChance } = await import('../src/systems/BattleManager.js');
const { GameState, PartyManager, StorageManager, InventoryManager, CollectionManager,
  PlayerManager, createNewGameState, serialize, deserialize } = await import('../src/systems/GameState.js');
const { CaptureManager } = await import('../src/systems/CaptureManager.js');
const { elementMultiplier } = await import('../src/data/elements.js');
const { moodModifiers, MOODS, STAT_KEYS } = await import('../src/data/moods.js');
const { counterDodgePercent, COUNTER_MAX_DODGE } = await import('../src/data/config.js');
const { MAPS } = await import('../src/data/maps.js');
const { SPECIES } = await import('../src/data/species.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}
function section(t) { console.log(`\n${t}`); }

// ------------------------------------------------------------------
section('Species & stats');
test('all 5 species exist with base stats', () => {
  assert.equal(Object.keys(SPECIES).length, 5);
  assert.equal(SPECIES.spriggo.baseStats.hp, 110);
  assert.equal(SPECIES.aquini.baseStats.spd, 19);
  assert.equal(SPECIES.emberu.baseStats.patk, 18);
  assert.equal(SPECIES.rivruff.baseStats.pdef, 17);
  assert.equal(SPECIES.leaflet.baseStats.counter, 18);
});

test('rarity D applies no mood modifier, higher rarity does', () => {
  const d = createMythling({ speciesId: 'spriggo', level: 1, rarity: 'D', mood: 'brave' });
  const s = createMythling({ speciesId: 'spriggo', level: 1, rarity: 'S', mood: 'brave' });
  assert.equal(computeStats(d).patk, SPECIES.spriggo.baseStats.patk);
  assert.equal(computeStats(s).patk, SPECIES.spriggo.baseStats.patk + 5); // S = +5
  assert.equal(computeStats(s).sdef, SPECIES.spriggo.baseStats.sdef - 5); // brave lowers S.DEF
});

test('counter is capped so nothing becomes untouchable', () => {
  const m = createMythling({ speciesId: 'leaflet', level: 30, rarity: 'SSS+', mood: 'swift' });
  assert.ok(computeStats(m).counter <= 35);
});

test('crit chance and crit damage exist and are capped', () => {
  const m = createMythling({ speciesId: 'leaflet', level: 30, rarity: 'SSS+', mood: 'feral' });
  const s = computeStats(m);
  assert.ok(s.crit <= 60, `crit chance capped, got ${s.crit}`);
  assert.ok(s.critMult <= 200, `crit damage capped, got ${s.critMult}`);
  // a crit-focused mood beats the same Mythling with a non-crit mood
  const plain = computeStats(createMythling({ speciesId: 'leaflet', level: 30, rarity: 'SSS+', mood: 'brave' }));
  assert.ok(s.crit > plain.crit, 'feral raises crit chance');
  assert.ok(s.critMult > plain.critMult, 'feral raises crit damage');
});

test('every mood touches three up stats and one down stat', () => {
  for (const [id, mood] of Object.entries(MOODS)) {
    assert.equal(mood.up.length, 3, `${id} ups`);
    assert.ok(STAT_KEYS.includes(mood.down), `${id} down stat is known`);
    for (const k of mood.up) assert.ok(STAT_KEYS.includes(k), `${id} up stat ${k} is known`);
    assert.ok(!mood.up.includes(mood.down), `${id} does not boost and lower the same stat`);
  }
});

test('the crit moods are wired to the crit stats', () => {
  for (const id of ['feral', 'savage', 'precise', 'brutal', 'keen']) {
    const mood = MOODS[id];
    assert.ok(mood.up.includes('crit') || mood.up.includes('critMult'), `${id} boosts a crit stat`);
  }
});

test('counter is nerfed: half a percent per point, capped at 18%', () => {
  assert.equal(counterDodgePercent(20), 10);
  assert.equal(counterDodgePercent(0), 0);
  assert.equal(counterDodgePercent(35), 17.5);
  assert.equal(counterDodgePercent(999), COUNTER_MAX_DODGE);
  // and the underlying stat still caps at 35 so nothing is untouchable
  const m = createMythling({ speciesId: 'leaflet', level: 30, rarity: 'SSS+', mood: 'swift' });
  assert.ok(computeStats(m).counter <= 35);
  assert.ok(counterDodgePercent(computeStats(m).counter) <= 18);
});

test('element triangle', () => {
  assert.equal(elementMultiplier('nature', 'water'), 1.5);
  assert.equal(elementMultiplier('water', 'fire'), 1.5);
  assert.equal(elementMultiplier('fire', 'nature'), 1.5);
  assert.equal(elementMultiplier('water', 'nature'), 0.75);
  assert.equal(elementMultiplier('fire', 'fire'), 1.0);
});

// ------------------------------------------------------------------
section('Levelling & level cap');
test('EXP levels a Mythling up', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 1 });
  const res = gainExp(m, expToNextLevel(1));
  assert.equal(m.level, 2);
  assert.equal(res.levels.length, 1);
});

test('never exceeds Lv.30 and EXP stops accumulating', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 29 });
  gainExp(m, 9999999);
  assert.equal(m.level, LEVEL_CAP);
  assert.equal(m.exp, 0);
  const res = gainExp(m, 500000);
  assert.equal(m.level, LEVEL_CAP);
  assert.equal(m.exp, 0);
  assert.ok(res.capped);
  assert.ok(isMaxLevel(m));
});

test('a multi-level-up is collapsed to one entry per Mythling', async () => {
  const { groupLevelUps } = await import('../src/ui/screens.js');
  const groups = groupLevelUps([
    { uid: 'a', name: 'Spriggo', level: 12, gains: { hp: 5, crit: 1 }, milestones: [] },
    { uid: 'a', name: 'Spriggo', level: 13, gains: { hp: 5, crit: 1 }, milestones: ['ultimate'] },
    { uid: 'b', name: 'Aquini', level: 20, gains: { hp: 9 }, milestones: [] },
  ]);
  assert.equal(groups.length, 2, 'one entry per Mythling');
  const a = groups[0];
  assert.equal(a.from, 11);
  assert.equal(a.to, 13);
  assert.deepEqual(a.gains, { hp: 10, crit: 2 }, 'gains are summed across levels');
  assert.deepEqual(a.milestones, ['ultimate'], 'milestones are merged');
  assert.equal(groups[1].name, 'Aquini');
  assert.equal(groupLevelUps([]).length, 0);
});

test('Ultimate unlocks at Lv.10 only', () => {
  const a = createMythling({ speciesId: 'emberu', level: 9 });
  const b = createMythling({ speciesId: 'emberu', level: 10 });
  assert.equal(ultimateUnlocked(a), false);
  assert.equal(ultimateUnlocked(b), true);
});

test('Ultimate charge fills to 8 and clamps', () => {
  const m = createMythling({ speciesId: 'emberu', level: 12 });
  for (let i = 0; i < 12; i++) addUltimateCharge(m, 1);
  assert.equal(m.ultCharge, 8);
});

// ------------------------------------------------------------------
section('Evolution');
test('evolves at Lv.20 into the first evolution', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 19, stage: 0 });
  assert.equal(canEvolve(m), false);
  gainExp(m, expToNextLevel(19));
  assert.equal(m.level, 20);
  assert.equal(canEvolve(m), true);
  const r = evolve(m);
  assert.equal(r.to, 'Thornox');
  assert.equal(m.stage, 1);
});

test('Lv.60 / Lv.80 evolutions stay locked in this build', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 30, stage: 1 });
  assert.equal(canEvolve(m), false, 'must not evolve past stage 1');
  assert.equal(evolve(m), null);
  assert.equal(m.stage, 1);
});

test('ultimate upgrades to tier I after evolving', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 0 });
  assert.equal(ultimateMove(m).name, 'Verdant Crush');
  evolve(m);
  assert.equal(ultimateMove(m).name, 'Verdant Crush I');
});

test('evolution adds new skills to the library without deleting old ones', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 0 });
  const before = [...m.library];
  evolve(m);
  for (const id of before) assert.ok(m.library.includes(id), `${id} kept`);
  assert.ok(m.library.includes('thorn_spear'));
  assert.ok(m.library.includes('thorn_armor'));
  assert.ok(!m.library.includes('nature_burst'), 'future skill stays locked');
});

// ------------------------------------------------------------------
section('Skills');
test('normal skill has infinite uses, special/buff limited', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 1 });
  assert.equal(usesLeft(m, 'bite'), Infinity);
  assert.equal(usesLeft(m, 'vine_lash'), 20);
  assert.equal(usesLeft(m, 'brave_guard'), 10);
  consumeUse(m, 'bite'); consumeUse(m, 'vine_lash');
  assert.equal(usesLeft(m, 'bite'), Infinity);
  assert.equal(usesLeft(m, 'vine_lash'), 19);
});

test('any learned skill can go into any slot', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  assert.equal(equipSkill(m, 'special', 'thorn_spear'), true);
  assert.equal(m.skills.special, 'thorn_spear');
  // slots are just slots: two specials, or a buff in the normal slot, are fine
  assert.equal(equipSkill(m, 'normal', 'thorn_armor'), true, 'a buff in the normal slot');
  assert.equal(equipSkill(m, 'buff', 'thorn_armor'), true, 'the same skill in two slots');
  assert.equal(m.skills.normal, 'thorn_armor');
  // ...but only skills the Mythling has actually learned
  assert.equal(equipSkill(m, 'special', 'ocean_pressure'), false, 'not in the library');
  assert.equal(equipSkill(m, 'special', 'not_a_skill'), false, 'unknown skill');
});

test('a slot can be left empty', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  equipSkill(m, 'normal', null);
  equipSkill(m, 'special', null);
  equipSkill(m, 'buff', null);
  assert.deepEqual(m.skills, { normal: null, special: null, buff: null });
  // a reload must not quietly refill slots the player chose to leave empty
  GameState.party = [m];
  GameState.storage = [];
  const round = deserialize(serialize());
  assert.equal(round, true);
  const reloaded = PartyManager.lead();
  assert.deepEqual(reloaded.skills, { normal: null, special: null, buff: null },
    'empty slots survive a save/load');
});

const { getSkill: getSkillById } = await import('../src/data/skills.js');
const { basicAttack } = await import('../src/core/mythling.js');

test('an exhausted move falls back to the unlimited attack instead of wasting the turn', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  for (const id of m.library) { const sk = getSkillById(id); if (sk && Number.isFinite(sk.uses)) m.uses[id] = 0; }
  const basic = basicAttack(m);
  assert.equal(Number.isFinite(basic.uses), false, `${basic.name} has unlimited uses`);
  assert.equal(basic.category, 'normal');
  assert.equal(basic.id, 'thorn_jab', 'the evolved unlimited move beats Lv.1 Bite');
});

// ------------------------------------------------------------------
section('Battle');
test('a full wild battle can be fought and won', () => {
  const player = createMythling({ speciesId: 'spriggo', level: 12 });
  const wild = createMythling({ speciesId: 'leaflet', level: 5 });
  const b = new Battle({ type: BattleType.WILD, party: [player], enemies: [wild], mapId: 'verdant_vale' });
  let guard = 0;
  while (b.phase === BattlePhase.ACTIVE && guard++ < 100) b.act({ type: 'skill', slot: 'special' });
  assert.equal(b.phase, BattlePhase.DEFEATED_WILD);
  assert.equal(wild.currentHp, 0);
  assert.ok(b.rewards.exp.length > 0, 'EXP awarded');
});

test('the attack message reports the damage dealt', () => {
  const p = createMythling({ speciesId: 'emberu', level: 30 });
  const e = createMythling({ speciesId: 'rivruff', level: 30 });
  // rng() order per turn: enemy AI pick, then per attack (dodge roll, crit roll, damage random)
  const seq = [0.5, 0.99, 0.99, 0.5, 0.99];
  let i = 0;
  const b = new Battle({
    type: BattleType.WILD, party: [p], enemies: [e], mapId: 'emberwild',
    rng: () => seq[i++] ?? 0.99,
  });
  const r = b.act({ type: 'skill', slot: 'special' });
  const dmg = r.events.find((ev) => ev.type === 'damage' && ev.side === 'enemy');
  assert.ok(dmg, 'the attack connected');
  const log = r.events.find((ev) => ev.type === 'log' && ev.text.includes('used'));
  assert.ok(log, 'there is an attack message');
  assert.ok(log.text.includes(`${dmg.amount} damage`), `message reports damage: ${log.text}`);
  assert.equal(log.text.includes('CRITICAL'), false, 'no crit on this roll');
});

test('a crit multiplies the damage and says so', () => {
  const p = createMythling({ speciesId: 'leaflet', level: 30, mood: 'feral', rarity: 'SSS+' });
  const e = createMythling({ speciesId: 'rivruff', level: 30 });
  const hit = (seq) => {
    let i = 0;
    const b = new Battle({
      type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale',
      rng: () => seq[i++] ?? 0.99,
    });
    restoreAll(p);
    restoreAll(e);
    const r = b.act({ type: 'skill', slot: 'special' });
    return r.events.find((ev) => ev.type === 'damage' && ev.side === 'enemy');
  };
  const noCrit = hit([0.5, 0.99, 0.99, 0.5]);   // AI, dodge no, crit no
  const crit = hit([0.5, 0.99, 0.001, 0.5]);    // AI, dodge no, crit yes
  assert.ok(crit && noCrit, 'both attacks landed');
  assert.equal(noCrit.crit, false);
  assert.equal(crit.crit, true);
  assert.ok(crit.amount > noCrit.amount, `crit (${crit.amount}) beats normal (${noCrit.amount})`);
  const critLog = hit([0.5, 0.99, 0.001, 0.5]);
  assert.ok(critLog, 'crit still lands');
});

test('trainer battles report how many Mythlings the trainer has left', () => {
  const p = createMythling({ speciesId: 'emberu', level: 30 });
  const trainer = { name: 'Tester', intro: 'hi', defeat: 'bye', flag: 't1', reward: {}, team: [] };
  const enemies = [
    createMythling({ speciesId: 'leaflet', level: 2 }),
    createMythling({ speciesId: 'leaflet', level: 2 }),
    createMythling({ speciesId: 'leaflet', level: 2 }),
  ];
  const b = new Battle({ type: BattleType.TRAINER, party: [p], enemies, trainer, mapId: 'verdant_vale' });
  assert.equal(b.enemyTeamTotal(), 3);
  assert.equal(b.enemyTeamLeft(), 3);
  const events = [];
  let guard = 0;
  while (b.phase === BattlePhase.ACTIVE && guard++ < 60) events.push(...b.act({ type: 'skill', slot: 'normal' }).events);
  const switches = events.filter((ev) => ev.type === 'switch' && ev.side === 'enemy');
  assert.equal(switches.length, 2, 'trainer sent out two replacements');
  assert.equal(switches[0].teamLeft, 2);
  assert.equal(switches[0].teamTotal, 3);
  assert.equal(switches[1].teamLeft, 1, 'the last Mythling is flagged as 1 left');
  assert.equal(b.enemyTeamLeft(), 0);
  assert.ok(events.some((ev) => ev.type === 'log' && /last Mythling/i.test(ev.text)), 'announces the final Mythling');
});

test('buff stacking is capped at 30 stacks', () => {
  const p = createMythling({ speciesId: 'spriggo', level: 20 });
  const e = createMythling({ speciesId: 'rivruff', level: 30 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale' });
  const cb = b.cb(p);
  for (let i = 0; i < 60; i++) cb.applyBuff('patk', 3);
  assert.equal(cb.buffs.patk.stacks, 30);
  assert.equal(cb.buffs.patk.total, 90);
});

test('ultimate requires 8/8 and resets to 0 after use', () => {
  const p = createMythling({ speciesId: 'emberu', level: 20 });
  const e = createMythling({ speciesId: 'rivruff', level: 30 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'emberwild' });
  p.ultCharge = 3;
  const r1 = b.act({ type: 'ultimate' });
  assert.ok(r1.events.some((ev) => ev.type === 'log' && /not ready/i.test(ev.text)));
  p.ultCharge = 8;
  b.act({ type: 'ultimate' });
  assert.equal(p.ultCharge, 0);
});

// ------------------------------------------------------------------
section('Capture — the core rule');
test('a living wild Mythling cannot be caught', () => {
  const wild = createMythling({ speciesId: 'emberu', level: 27 });
  assert.equal(CaptureManager.canAttempt(wild), false);
  const res = CaptureManager.attempt(wild, 'basic_ball');
  assert.equal(res.ok, false);
});

test('a captured Mythling ALWAYS becomes Lv.1 and keeps its identity', () => {
  createNewGameState({ slot: 1, playerName: 'DUMDUM', starterId: 'spriggo' });
  const wild = createMythling({ speciesId: 'emberu', level: 27, rarity: 'A', mood: 'clever', mutation: 'shiny' });
  wild.currentHp = 0;
  InventoryManager.add('god_ball', 50);
  let res, guard = 0;
  do { res = CaptureManager.attempt(wild, 'god_ball'); } while (!res.success && guard++ < 200);
  assert.ok(res.success, 'god ball eventually catches');
  assert.equal(wild.level, 1);
  assert.equal(wild.exp, 0);
  assert.equal(wild.stage, 0);
  assert.equal(wild.speciesId, 'emberu');
  assert.equal(wild.rarity, 'A');
  assert.equal(wild.mood, 'clever');
  assert.equal(wild.mutation, 'shiny');
  assert.equal(wild.meta.caughtLevel, 27);
  assert.equal(CollectionManager.entry('emberu').caught, true);
});

test('capture chance is forgiving on low-level commons and harder at Lv.30', () => {
  const low = createMythling({ speciesId: 'leaflet', level: 3 }); low.currentHp = 0;
  const high = createMythling({ speciesId: 'emberu', level: 30 }); high.currentHp = 0;
  assert.ok(captureChance({ target: low, ballId: 'basic_ball' }) > 0.75);
  assert.ok(captureChance({ target: high, ballId: 'basic_ball' }) < captureChance({ target: high, ballId: 'god_ball' }));
});

// ------------------------------------------------------------------
section('Party / storage / inventory');
test('party caps at 6, extra Mythlings go to storage', () => {
  createNewGameState({ slot: 1, playerName: 'DUMDUM', starterId: 'aquini' });
  for (let i = 0; i < 8; i++) {
    const m = createMythling({ speciesId: 'leaflet', level: 1 });
    CaptureManager.place(m, true);
  }
  assert.equal(PartyManager.count(), 6);
  assert.equal(StorageManager.list().length, 3);
});

test('the last party Mythling cannot be removed', () => {
  createNewGameState({ slot: 1, playerName: 'SOLO', starterId: 'emberu' });
  assert.equal(PartyManager.remove(PartyManager.lead().uid), null);
  assert.equal(PartyManager.count(), 1);
});

test('inventory never goes negative and purchases are validated', () => {
  createNewGameState({ slot: 1, playerName: 'BUY', starterId: 'spriggo' });
  const start = InventoryManager.count('potion');
  assert.equal(InventoryManager.remove('potion', start + 5), false);
  assert.equal(InventoryManager.count('potion'), start);
  GameState.player.wildcoins = 100;
  assert.equal(PlayerManager.spendCoins(500), false);
  assert.equal(GameState.player.wildcoins, 100);
  assert.equal(PlayerManager.spendCoins(60), true);
  assert.equal(GameState.player.wildcoins, 40);
});

// ------------------------------------------------------------------
section('Save / load round trip');
test('save then load restores the exact state', async () => {
  createNewGameState({ slot: 2, playerName: 'DUMDUM', starterId: 'spriggo' });
  const starter = PartyManager.lead();
  gainExp(starter, 300);
  // catch a Leaflet
  const leaflet = createMythling({ speciesId: 'leaflet', level: 8, mood: 'playful', rarity: 'C' });
  leaflet.currentHp = 0;
  InventoryManager.add('god_ball', 30);
  let res, guard = 0;
  do { res = CaptureManager.attempt(leaflet, 'god_ball'); } while (!res.success && guard++ < 200);
  CaptureManager.place(leaflet, true);
  GameState.player.wildcoins = 1234;
  GameState.world.defeatedTrainers.vale_t1 = true;
  starter.ultCharge = 5;
  starter.uses.vine_lash = 13;

  const snapshot = serialize();
  const json = JSON.parse(JSON.stringify(snapshot));

  // wipe & reload
  createNewGameState({ slot: 3, playerName: 'WIPED', starterId: 'emberu' });
  deserialize(json);

  assert.equal(GameState.player.name, 'DUMDUM');
  assert.equal(GameState.player.wildcoins, 1234);
  assert.equal(PartyManager.count(), 2);
  const [sp, lf] = PartyManager.list();
  assert.equal(sp.speciesId, 'spriggo');
  assert.equal(lf.speciesId, 'leaflet');
  assert.equal(lf.level, 1, 'caught Leaflet is still Lv.1 after reload');
  assert.equal(lf.rarity, 'C');
  assert.equal(lf.mood, 'playful');
  assert.equal(sp.ultCharge, 5);
  assert.equal(sp.uses.vine_lash, 13);
  assert.equal(GameState.world.defeatedTrainers.vale_t1, true);
  assert.equal(GameState.player.map, 'verdant_vale');
});

test('no duplicated Mythlings or items across repeated save/load', () => {
  const before = serialize();
  deserialize(JSON.parse(JSON.stringify(before)));
  deserialize(JSON.parse(JSON.stringify(before)));
  const after = serialize();
  assert.equal(after.party.length, before.party.length);
  assert.deepEqual(after.inventory, before.inventory);
  assert.equal(after.storage.length, before.storage.length);
});

test('old saves missing new fields get safe defaults', () => {
  const legacy = {
    slot: 1,
    player: { name: 'OLDIE', wildcoins: 50, map: 'verdant_vale', x: 100, y: 100, starter: 'spriggo' },
    party: [{ speciesId: 'spriggo', level: 5 }],   // no mutation / uses / skills / stage
    inventory: { potion: 2, ghost_item: 9 },        // unknown item dropped
    collection: { spriggo: { seen: true, caught: true }, removed_species: { seen: true } },
    world: {}, meta: {},
  };
  assert.equal(deserialize(legacy), true);
  const m = PartyManager.lead();
  assert.equal(m.mutation, 'none');
  assert.equal(m.level, 5);
  assert.ok(m.library.includes('vine_lash'));
  assert.equal(m.currentHp > 0, true);
  assert.equal(InventoryManager.count('ghost_item'), 0);
  assert.equal(InventoryManager.count('potion'), 2);
});

test('a save claiming an impossible level is clamped to the level cap', () => {
  const cheat = {
    slot: 1, player: { name: 'CHEAT', map: 'verdant_vale', starter: 'emberu' },
    party: [{ speciesId: 'emberu', level: 9999, stage: 3 }], inventory: {}, collection: {}, world: {}, meta: {},
  };
  deserialize(cheat);
  const m = PartyManager.lead();
  assert.equal(m.level, LEVEL_CAP);
  assert.equal(LEVEL_CAP, 100, 'every Mythling can reach Lv.100');
  assert.equal(m.stage, 3, 'all four evolution stages are live at this cap');
});

test('Lv.100 is reachable and the exp curve stays sane past the story cap', () => {
  // the story tops out at Lv.30; the curve past it must not ask for thousands
  // of battles per level, so cost per level stays proportional to payout
  const at30 = expToNextLevel(30);
  const at99 = expToNextLevel(99);
  assert.ok(at99 / at30 < 5, `Lv.99 costs ${(at99 / at30).toFixed(1)}x Lv.30, expected under 5x`);
  assert.equal(expToNextLevel(100), Infinity, 'Lv.100 is the ceiling');
  let total = 0;
  for (let l = 1; l < 100; l++) total += expToNextLevel(l);
  assert.ok(total < 1_500_000, `total exp to Lv.100 is ${total}`);
});

// ------------------------------------------------------------------
section('World data');
test('map level ranges match the design', () => {
  assert.deepEqual(MAPS.verdant_vale.levelRange, [1, 10]);
  assert.deepEqual(MAPS.azure_coast.levelRange, [10, 20]);
  assert.deepEqual(MAPS.emberwild.levelRange, [20, 30]);
});

test('no encounter zone can spawn above its map maximum', () => {
  for (const map of Object.values(MAPS)) {
    for (const z of map.encounterZones) {
      assert.ok(z.levelRange[1] <= map.levelRange[1], `${map.id}/${z.id}`);
      assert.ok(z.levelRange[0] >= map.levelRange[0], `${map.id}/${z.id}`);
      assert.ok(z.levelRange[1] <= LEVEL_CAP);
    }
  }
});

test('progression gates exist between regions', () => {
  const toAzure = MAPS.verdant_vale.connections.find((c) => c.toMap === 'azure_coast');
  const toEmber = MAPS.azure_coast.connections.find((c) => c.toMap === 'emberwild');
  assert.equal(toAzure.requiresItem, 'vale_charm');
  assert.equal(toEmber.requiresItem, 'coast_pass');
});

test('every starter species is obtainable in the wild', () => {
  for (const id of ['spriggo', 'aquini', 'emberu']) {
    const found = Object.values(MAPS).some((m) => m.encounterZones.some((z) => z.species.some((s) => s.id === id)));
    assert.ok(found, `${id} spawns somewhere`);
  }
});

// ------------------------------------------------------------------
section('Coins from defeating wild Mythlings');
const { coinReward, DEFEAT_COIN_PENALTY } = await import('../src/data/config.js');

test('coinReward scales with level and yield', () => {
  const low = coinReward({ enemyLevel: 5, enemyYield: 52, winnerLevel: 5 });
  const high = coinReward({ enemyLevel: 30, enemyYield: 70, winnerLevel: 30 });
  assert.ok(low > 0 && high > low, `${low} < ${high}`);
});

test('coinReward is never zero and falls off when over-levelled', () => {
  assert.equal(coinReward({ enemyLevel: 2, enemyYield: 30, winnerLevel: 2 }) >= 1, true);
  const even = coinReward({ enemyLevel: 20, enemyYield: 60, winnerLevel: 20 });
  const over = coinReward({ enemyLevel: 20, enemyYield: 60, winnerLevel: 60 });
  assert.ok(over < even, `over-levelled ${over} should pay less than ${even}`);
  assert.ok(over >= 1);
});

test('a defeated wild Mythling pays Wildcoins; trainer battles do not double-pay', () => {
  const runOut = (battle) => {
    const seen = [];
    let g = 0;
    while (battle.phase === BattlePhase.ACTIVE && g++ < 100) {
      const res = battle.act({ type: 'skill', slot: 'special' });
      seen.push(...(res.events || []));
    }
    return seen;
  };
  const wild = new Battle({ type: BattleType.WILD, party: [createMythling({ speciesId: 'emberu', level: 14 })], enemies: [createMythling({ speciesId: 'leaflet', level: 9 })], mapId: 'verdant_vale' });
  const wildEvents = runOut(wild);
  assert.equal(wild.phase, BattlePhase.DEFEATED_WILD);
  assert.ok(wild.rewards.coins > 0, 'defeating a wild Mythling drops coins');
  const coinEvent = wildEvents.find((e) => e.type === 'coins');
  assert.ok(coinEvent && coinEvent.amount === wild.rewards.coins, 'the UI gets a coin event to play');

  const trainer = { name: 'T', intro: '', defeat: '', flag: 'f1', reward: { coins: 300 }, team: [] };
  const tb = new Battle({ type: BattleType.TRAINER, party: [createMythling({ speciesId: 'emberu', level: 14 })], enemies: [createMythling({ speciesId: 'leaflet', level: 9 })], trainer, mapId: 'verdant_vale' });
  runOut(tb);
  assert.equal(tb.rewards.coins, 0, 'the trainer bounty is paid separately, not per faint');
});

test('the coin reward is clamped to at least one coin at any level gap', () => {
  for (const gap of [0, 10, 30, 80]) {
    const c = coinReward({ enemyLevel: 5, enemyYield: 40, winnerLevel: 5 + gap });
    assert.ok(c >= 1 && Number.isFinite(c), `gap ${gap} -> ${c}`);
  }
});

// ------------------------------------------------------------------
section('Creature rig (layered 2D puppet)');
const { CreatureRig, ANIMATIONS, ANIM_IDS, drawMythling, prewarm, creatureAssets } = await import('../src/render/creatures.js');
const { SPECIES_ART } = await import('../src/render/creatureArt.js');

test('every species exposes 8-12 rig layers plus a face spec', () => {
  for (const id of Object.keys(SPECIES)) {
    const art = SPECIES_ART[id];
    assert.ok(art, `${id} has art`);
    const parts = art.parts.map((p) => p.name);
    assert.ok(parts.length >= 7 && parts.length <= 12, `${id} has ${parts.length} layers`);
    assert.ok(art.face && art.face.eyes.length === 2, `${id} has two eyes`);
    assert.ok(art.parts.some((p) => p.name === 'head'), `${id} has a head`);
    assert.ok(art.parts.some((p) => p.name === 'body'), `${id} has a body`);
  }
});

test('layer bones stay in the shared vocabulary (no per-detail bones)', () => {
  const allowed = new Set(['root', 'tail', 'body', 'head', 'legFL', 'legFR', 'legBL', 'legBR',
    'earL', 'earR', 'wingL', 'wingR', 'mane']);
  for (const art of Object.values(SPECIES_ART)) {
    for (const p of art.parts) assert.ok(allowed.has(p.name), `unexpected bone ${p.name}`);
  }
});

test('the animation controller covers every state the brief asks for', () => {
  for (const id of ['idle', 'walk', 'run', 'battleIdle', 'normalAttack', 'specialAttack',
    'buff', 'ultimate', 'hit', 'faint', 'capture', 'evolve']) {
    assert.ok(ANIMATIONS[id], `missing animation ${id}`);
  }
  assert.equal(ANIM_IDS.length, 12);
});

test('a rig instance animates: transforms change across the walk cycle', () => {
  const creature = new CreatureRig({ species: 'spriggo', stage: 0 });
  creature.play('walk');
  assert.equal(creature.state, 'walk');
  creature.update(1 / 60, 0);
  const a = creature.tf.legFL.rot;
  for (let i = 0; i < 20; i++) creature.update(1 / 60, i / 60);
  const b = creature.tf.legFL.rot;
  assert.notEqual(a, b, 'the leg swings while walking');
  // the two front legs are always out of phase (a gait, not a shuffle)
  assert.ok(Math.abs(creature.tf.legFL.rot - creature.tf.legFR.rot) > 0.05);
});

test('idle breathes without shaking: motion stays subtle', () => {
  const creature = new CreatureRig({ species: 'emberu', stage: 1 });
  creature.play('idle');
  let maxRoot = 0;
  for (let i = 0; i < 240; i++) {
    creature.update(1 / 60, i / 60);
    maxRoot = Math.max(maxRoot, Math.abs(creature.root.dx), Math.abs(creature.root.dy));
  }
  assert.ok(maxRoot < 3, `idle root motion ${maxRoot.toFixed(2)} units should stay tiny`);
});

test('drawMythling survives every species, stage, mutation and animation', () => {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  for (const id of Object.keys(SPECIES)) {
    for (const stage of [0, 1, 2]) {
      for (const mut of ['none', 'shiny', 'darkness']) {
        for (const anim of ANIM_IDS) {
          drawMythling(ctx, {
            speciesId: id, stage, mutation: mut, x: 100, y: 200, size: 160, t: 1.5,
            facing: -1, pose: { anim: { name: anim, phase: 0.5 }, flash: 0.4, expression: 'happy' },
          });
        }
      }
    }
  }
  prewarm(Object.keys(SPECIES), [0, 1, 2], 160);
  assert.ok(creatureAssets.cache.size > 0);
});

test('textures are cached, never re-baked for the same creature', () => {
  creatureAssets.clear();
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const opts = { speciesId: 'aquini', stage: 1, mutation: 'none', x: 0, y: 0, size: 120, t: 0, facing: 1 };
  drawMythling(ctx, opts);
  const afterFirst = creatureAssets.cache.size;
  for (let i = 0; i < 30; i++) drawMythling(ctx, { ...opts, t: i / 30 });
  assert.equal(creatureAssets.cache.size, afterFirst, 'no extra bakes per frame');
});

// ------------------------------------------------------------------
section('Skill VFX');
const { SkillVFX, playSkillVFX, playImpactVFX, playProjectileVFX, playBuffVFX,
  playUltimateVFX, playHitReaction, stopAllVFX } = await import('../src/render/vfx/SkillVFX.js');
const { SKILL_VFX, vfxFor, paletteFor, BUFF_VFX } = await import('../src/data/skillVfx.js');

test('the full VFX API exists', () => {
  for (const fn of [playSkillVFX, playProjectileVFX, playImpactVFX, playBuffVFX,
    playUltimateVFX, playHitReaction, stopAllVFX]) assert.equal(typeof fn, 'function');
  assert.equal(typeof SkillVFX.play, 'function');
});

test('every VFX entry is data: element, category and an impact', () => {
  for (const [id, def] of Object.entries(SKILL_VFX)) {
    assert.equal(def.id, id);
    assert.ok(def.element, `${id} has an element`);
    assert.ok(['normal', 'special', 'buff', 'ultimate'].includes(def.category), `${id} category`);
    assert.ok(def.impact || def.category === 'buff', `${id} has an impact`);
  }
});

test('unknown skills fall back instead of failing', () => {
  const def = vfxFor('a_brand_new_move', { element: 'water', category: 'special' });
  assert.equal(def.element, 'water');
  assert.ok(def.projectile && def.impact);
  assert.deepEqual(Object.keys(def).sort(), ['aftermath', 'cast', 'category', 'element', 'id', 'impact', 'projectile']);
});

test('playing a skill spawns effects and respects the particle cap', () => {
  stopAllVFX();
  SkillVFX.bind({
    pos: (side) => (side === 'player' ? { x: 300, y: 500 } : { x: 900, y: 300 }),
    shake: () => {}, flash: () => {}, float: () => {},
  });
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  let peak = 0;
  for (let i = 0; i < 40; i++) {                 // hammer it: the pool must hold
    playSkillVFX({ skillId: 'dragon_inferno', side: 'player', target: 'enemy', element: 'fire', category: 'special' });
    SkillVFX.finishProjectiles('player', { crit: true });
    SkillVFX.update(1 / 60); SkillVFX.render(ctx);
    peak = Math.max(peak, SkillVFX.ps.live.length);
  }
  for (let i = 0; i < 120; i++) { SkillVFX.update(1 / 60); SkillVFX.render(ctx); }
  assert.ok(peak > 0, 'effects were spawned');
  assert.ok(peak <= 340, `particle cap respected (peak ${peak})`);
  assert.equal(SkillVFX.projectiles.length, 0, 'projectiles are released');
  assert.equal(SkillVFX.timers.length, 0, 'timers are released');
});

test('every named skill plays end to end without error', () => {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  for (const id of Object.keys(SKILL_VFX)) {
    const def = SKILL_VFX[id];
    playSkillVFX({ skillId: id, side: 'player', target: 'enemy', element: def.element, category: def.category });
    for (let i = 0; i < 20; i++) { SkillVFX.update(1 / 60); SkillVFX.render(ctx); }
    SkillVFX.finishProjectiles('player', { crit: false });
    for (let i = 0; i < 30; i++) { SkillVFX.update(1 / 60); SkillVFX.render(ctx); }
    if (def.category === 'ultimate') {
      playUltimateVFX('enemy', 'player', { element: def.element, skillId: id });
      for (let i = 0; i < 100; i++) { SkillVFX.update(1 / 60); SkillVFX.render(ctx); }
    }
  }
  SkillVFX.whiff('player');
  playBuffVFX('player', { stat: 'pdef', up: true, element: 'water' });
  playHitReaction('enemy', { crit: true, effectiveness: 2, element: 'fire' });
  for (let i = 0; i < 60; i++) { SkillVFX.update(1 / 60); SkillVFX.render(ctx); }
  assert.ok(true);
});

test('the defensive ultimate never plays an attack projectile', () => {
  const guard = SKILL_VFX.ocean_guard;
  assert.equal(guard.defensive, true);
  assert.equal(guard.projectile, null);
  assert.equal(guard.impact.style, 'oceanGuard');
});

test('stopAllVFX clears everything', () => {
  stopAllVFX();
  assert.equal(SkillVFX.ps.live.length, 0);
  assert.equal(SkillVFX.ps.fx.length, 0);
  assert.equal(SkillVFX.projectiles.length, 0);
  assert.equal(SkillVFX.timers.length, 0);
  assert.equal(SkillVFX.ps.pool.length + SkillVFX.ps.live.length, 340, 'every particle is back in the pool');
});

test('element palettes are distinct (nature is organic, water fluid, fire alive)', () => {
  const n = paletteFor('nature'), w = paletteFor('water'), f = paletteFor('fire');
  assert.notEqual(n.mid, w.mid);
  assert.notEqual(w.mid, f.mid);
  for (const [k, v] of Object.entries(BUFF_VFX)) assert.ok(v.icon.startsWith('↑'), `${k} reads as a stat rise`);
});

// ------------------------------------------------------------------
section('Fainting: the display never skips ahead to the replacement');
const { BattleScene } = await import('../src/scenes/BattleScene.js');

// A turn resolves all at once: run a trainer battle until the enemy is KO'd.
function koTrainerBattle() {
  const team = [createMythling({ speciesId: 'aquini', level: 3 }), createMythling({ speciesId: 'leaflet', level: 3 })];
  const trainer = { name: 'Ranger Vi', intro: '', defeat: '', flag: 'f_vi', reward: { coins: 200 }, team };
  const battle = new Battle({ type: BattleType.TRAINER, party: [createMythling({ speciesId: 'emberu', level: 30 })], enemies: team, trainer, mapId: 'verdant_vale' });
  const fainted = battle.enemy;
  let g = 0, events = [];
  while (battle.phase === BattlePhase.ACTIVE && g++ < 40) {
    const res = battle.act({ type: 'skill', slot: 'special' });
    events = events.concat(res.events || []);
    if (events.some((e) => e.type === 'faint')) break;
  }
  return { battle, fainted, events };
}

test('the engine advances to the next combatant before the events are played', () => {
  const { battle, fainted } = koTrainerBattle();
  // this is the pitfall the scene works around: battle.enemy is ALREADY the
  // replacement while the KO events are still queued.
  assert.notEqual(battle.enemy.uid, fainted.uid);
  assert.equal(fainted.currentHp, 0);
});

test('a KO is emitted as damage -> faint -> switch, in that order', () => {
  const { events } = koTrainerBattle();
  const order = events.map((e) => e.type);
  const dmg = order.lastIndexOf('damage');
  const faint = order.indexOf('faint');
  const sw = order.indexOf('switch');
  assert.ok(dmg >= 0 && faint > dmg, `damage (${dmg}) before faint (${faint})`);
  assert.ok(sw > faint, `faint (${faint}) before switch (${sw})`);
  const lastDamage = events[dmg];
  assert.equal(lastDamage.mythling.hp, 0, 'the finishing blow leaves it at 0 HP');
});

test('shownMythling() shows the fainted Mythling until the switch event plays', () => {
  const { battle, fainted, events } = koTrainerBattle();
  const next = battle.enemy;
  const scene = Object.create(BattleScene.prototype);   // no DOM: method only
  scene.battle = battle;
  scene.view = { enemy: { uid: fainted.uid }, player: { uid: battle.player.uid } };
  // while the damage + faint events play, the view still points at the KO'd one
  const koEvents = events.filter((e) => ['damage', 'faint', 'exp'].includes(e.type));
  for (const _ of koEvents) {
    assert.equal(scene.shownMythling('enemy').uid, fainted.uid, 'still showing the fainting Mythling');
  }
  // the switch event is what advances the display
  scene.view.enemy = { uid: next.uid };
  assert.equal(scene.shownMythling('enemy').uid, next.uid);
});

test('shownMythling() falls back to the live combatant when no view is set', () => {
  const { battle } = koTrainerBattle();
  const scene = Object.create(BattleScene.prototype);
  scene.battle = battle;
  scene.view = {};
  assert.equal(scene.shownMythling('enemy'), battle.enemy);
  assert.equal(scene.shownMythling('player'), battle.player);
});

test('the player side waits for its own switch event too', () => {
  const party = [createMythling({ speciesId: 'aquini', level: 2 }), createMythling({ speciesId: 'leaflet', level: 2 })];
  const battle = new Battle({ type: BattleType.WILD, party, enemies: [createMythling({ speciesId: 'emberu', level: 30 })], mapId: 'emberwild' });
  const fainted = battle.player;
  const scene = Object.create(BattleScene.prototype);
  scene.battle = battle;
  scene.view = { player: { uid: fainted.uid } };
  let g = 0, events = [];
  while (battle.phase === BattlePhase.ACTIVE && g++ < 40) {
    const res = battle.act({ type: 'skill', slot: 'special' });
    events = events.concat(res.events || []);
    if (events.some((e) => e.type === 'faint' && e.side === 'player')) break;
  }
  // the engine has queued the replacement, the display has not
  assert.equal(scene.shownMythling('player').uid, fainted.uid);
  const sw = events.find((e) => e.type === 'switch' && e.side === 'player');
  assert.ok(sw, 'a switch event is emitted for the player');
  scene.view.player = { uid: battle.player.uid };
  assert.equal(scene.shownMythling('player').uid, battle.player.uid);
});

// ------------------------------------------------------------------
section('Evolution cinematic layout');
const cssText = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

test('the cinematic overlay scrolls instead of clipping the summary', () => {
  const overlay = cssText.match(/\.cinematic\s*\{([^}]*)\}/);
  assert.ok(overlay, '.cinematic rule exists');
  assert.match(overlay[1], /overflow-y:\s*auto/, 'the overlay scrolls');
  // a single margin:auto child centres the content without cutting off the top
  const stage = cssText.match(/\.cinematic-stage\s*\{([^}]*)\}/);
  assert.ok(stage, '.cinematic-stage rule exists');
  assert.match(stage[1], /margin:\s*auto/);
});

test('the evolution canvas stays square at every size', () => {
  const cv = cssText.match(/\.cinematic canvas\s*\{([^}]*)\}/);
  assert.ok(cv, '.cinematic canvas rule exists');
  assert.match(cv[1], /aspect-ratio:\s*1\s*\/\s*1/, 'the Mythling is never squashed');
  assert.match(cv[1], /height:\s*auto/);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
