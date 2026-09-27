// Headless verification of the rules that matter most (no DOM required).
// Run with:  npm test
import assert from 'node:assert/strict';

// minimal browser shims used by a couple of modules at import time
globalThis.window = globalThis;
globalThis.document = { documentElement: { dataset: {} } };
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
const { moodModifiers } = await import('../src/data/moods.js');
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

test('skill swapping only accepts matching category from the library', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  assert.equal(equipSkill(m, 'special', 'thorn_spear'), true);
  assert.equal(m.skills.special, 'thorn_spear');
  assert.equal(equipSkill(m, 'special', 'brave_guard'), false);
  assert.equal(equipSkill(m, 'normal', 'nature_burst'), false);
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

test('a save claiming Lv.99 is clamped to the level cap', () => {
  const cheat = {
    slot: 1, player: { name: 'CHEAT', map: 'verdant_vale', starter: 'emberu' },
    party: [{ speciesId: 'emberu', level: 99, stage: 3 }], inventory: {}, collection: {}, world: {}, meta: {},
  };
  deserialize(cheat);
  const m = PartyManager.lead();
  assert.equal(m.level, LEVEL_CAP);
  assert.ok(m.stage <= 1, 'future evolution stage rejected');
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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
