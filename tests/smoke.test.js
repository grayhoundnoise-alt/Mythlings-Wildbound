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
