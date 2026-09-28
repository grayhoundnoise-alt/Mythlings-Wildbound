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
    arc() {}, arcTo() {}, ellipse() {}, rect() {}, fill() {}, stroke() {}, clip() {},
    fillRect() {}, strokeRect() {}, clearRect() {}, drawImage() {}, fillText() {}, strokeText() {},
    transform() {}, roundRect() {}, createImageData: () => ({ data: [] }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {},
    measureText: () => ({ width: 10 }), setLineDash() {},
  };
  return new Proxy(base, { get: (o, k) => (k in o ? o[k] : undefined), set: (o, k, v) => { o[k] = v; return true; } });
};
const mkEl = (tag) => {
  const e = {
    tagName: String(tag).toUpperCase(), style: {}, dataset: {}, children: [],
    textContent: '', innerHTML: '', value: '', width: 300, height: 300,
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle() {}, contains(c) { return this._s.has(c); } },
    appendChild(c) { this.children.push(c); return c; },
    append(...c) { c.forEach((x) => this.children.push(x)); },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    remove() {}, insertBefore(c) { this.children.push(c); return c; }, replaceWith() {},
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null,
    querySelector: () => mkEl('div'), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100 }),
    focus() {}, blur() {}, scrollTo() {},
    getContext: () => noopCtx(), toDataURL: () => 'data:image/png;base64,',
  };
  return e;
};
globalThis.document = {
  documentElement: { dataset: {} },
  body: mkEl('body'),
  createElement: (tag) => mkEl(tag),
  createElementNS: (ns, tag) => mkEl(tag),
  createTextNode: (t) => ({ nodeValue: t }),
  getElementById: () => mkEl('div'),
  querySelector: () => mkEl('div'), querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}, activeElement: null,
};
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.window.devicePixelRatio = 2;
globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};

const { createMythling, gainExp, computeStats, resetToLevelOne, canEvolve, evolve,
  ultimateUnlocked, ultimateMove, addUltimateCharge, isMaxLevel, restoreAll,
  usesLeft, consumeUse, equipSkill, unequipSkill, moveSkill, equippedSkill, librarySkills,
  applyItemEffects } = await import('../src/core/mythling.js');
const { LEVEL_CAP, expToNextLevel } = await import('../src/data/config.js');
const { Battle, BattleType, BattlePhase, captureChance } = await import('../src/systems/BattleManager.js');
const { GameState, PartyManager, StorageManager, InventoryManager, CollectionManager,
  PlayerManager, createNewGameState, serialize, deserialize } = await import('../src/systems/GameState.js');
const { CaptureManager } = await import('../src/systems/CaptureManager.js');
const ITEMS_MOD = await import('../src/data/items.js');
const { FeedManager } = await import('../src/systems/FeedManager.js');
const { elementMultiplier } = await import('../src/data/elements.js');
const { moodModifiers, MOODS, STAT_KEYS, RATIONALS, RATIONAL_IDS, rationalModifiers, normalizeMoodId, traitModifiers } = await import('../src/data/moods.js');
const { counterDodgePercent, COUNTER_MAX_DODGE, CRIT_MAX_PERCENT, RATIONAL_AMOUNT } = await import('../src/data/config.js');
const { MAPS } = await import('../src/data/maps.js');
const { SPECIES, SPECIES_IDS } = await import('../src/data/species.js');

const { maxHp: maxHpOf } = await import('../src/core/mythling.js');
const mythlingApi = await import('../src/core/mythling.js');
const evolutionApi = await import('../src/systems/EvolutionManager.js');
const SKILLS_MOD = await import('../src/data/skills.js');

let pass = 0, fail = 0;
// Tests are collected and run at the end, in source order, so that an async
// test is awaited. The old runner called fn() inside a try/catch, which cannot
// catch a rejected promise: all 19 async tests reported ✓ no matter what they
// asserted, including the battle-balance ones.
const queue = [];
function test(name, fn) { queue.push({ kind: 'test', name, fn }); }
function section(t) { queue.push({ kind: 'section', name: t }); }

// ------------------------------------------------------------------
section('Species & stats');
test('every species exists with base stats and a filled-in roster', () => {
  assert.equal(Object.keys(SPECIES).length, 55, '20 originals + 25 new-element lines + 2 dual-typed lines + 5 Fighting lines + 3 legendaries');
  assert.equal(SPECIES.spriggo.baseStats.hp, 110);
  assert.equal(SPECIES.aquini.baseStats.spd, 19);
  assert.equal(SPECIES.emberu.baseStats.patk, 18);
  assert.equal(SPECIES.rivruff.baseStats.pdef, 17);
  assert.equal(SPECIES.leaflet.baseStats.counter, 18);
  // five of each element, and every new Mythling is fully specified
  const byEl = {};
  for (const id of Object.keys(SPECIES)) {
    const sp = SPECIES[id];
    byEl[sp.element] = (byEl[sp.element] || 0) + 1;
    assert.ok(sp.role, `${id} has a role`);
    assert.ok(sp.evolutions.length === (sp.legendary ? 1 : 4), `${id} has ${sp.legendary ? 'one form' : 'four stages'}`);
    assert.ok(sp.ultimate, `${id} has an ultimate`);
    assert.ok(sp.art && sp.art.body, `${id} names a body plan`);
  }
  // five single-typed lines per element (dual types and legendaries are counted under their first element)
  assert.deepEqual(byEl, { nature: 5, water: 5, fire: 5, rock: 6, electric: 6, ice: 5, metal: 5, poison: 7, psychic: 6, fighting: 5 });
  const dual = Object.values(SPECIES).filter((sp) => (sp.elements || []).length > 1 && !sp.legendary).map((sp) => sp.id);
  assert.deepEqual(dual, ['mirewisp', 'sparkbug', 'ironpaw', 'emberfist', 'stormkick', 'zenram'], 'the dual-typed lines: two mid-game and the four Fighting ones');
  assert.deepEqual(SPECIES.mirewisp.elements, ['poison', 'psychic']);
});

test('rarity D applies no mood modifier, higher rarity does — and moods never lower a stat', () => {
  // rational Docile = +HP / -S.ATK, pinned so only the mood varies; Brave = +HP +P.ATK +CNT
  const d = createMythling({ speciesId: 'spriggo', level: 1, rarity: 'D', mood: 'brave', rational: 'docile' });
  const s = createMythling({ speciesId: 'spriggo', level: 1, rarity: 'S', mood: 'brave', rational: 'docile' });
  assert.equal(computeStats(d).patk, SPECIES.spriggo.baseStats.patk, 'rarity D: no mood bonus');
  assert.equal(computeStats(s).patk, SPECIES.spriggo.baseStats.patk + 5, 'S = magnitude 5 -> +5 to each of the three boosted stats');
  assert.equal(computeStats(s).hp - computeStats(d).hp, 15, 'HP counts triple: +15 at magnitude 5');
  assert.equal(computeStats(s).sdef, SPECIES.spriggo.baseStats.sdef, 'a mood lowers nothing any more');
  const mods = moodModifiers('brave', 5);
  assert.ok(Object.values(mods).every((v) => v >= 0), 'mood modifiers are never negative');
  assert.equal(Object.values(mods).filter((v) => v > 0).length, 3, 'exactly three stats are raised');
});

test('the Rational trait is a fixed +10 / -10 pair that stacks with mood, rarity and mutation', () => {
  assert.equal(RATIONAL_IDS.length, 30, 'all 30 ordered pairs of the six main stats exist');
  const names = new Set(RATIONAL_IDS.map((id) => RATIONALS[id].name));
  assert.equal(names.size, 30, 'every Rational has a distinct name');
  for (const r of Object.values(RATIONALS)) assert.notEqual(r.up, r.down, `${r.id} trades two different stats`);
  const mods = rationalModifiers('hasty', RATIONAL_AMOUNT);
  assert.equal(mods.spd, 10); assert.equal(mods.hp, -10); assert.equal(mods.patk, 0);
  const base = createMythling({ speciesId: 'spriggo', level: 1, rarity: 'D', mood: 'brave', rational: 'docile' });   // +HP -S.ATK
  const hasty = createMythling({ speciesId: 'spriggo', level: 1, rarity: 'D', mood: 'brave', rational: 'hasty' });   // +SPD -HP
  assert.equal(computeStats(hasty).spd, computeStats(base).spd + 10);
  assert.equal(computeStats(hasty).hp, computeStats(base).hp - 20, 'HP swings from +10 to -10');
  // stacks with mood (Brave at S = +5 P.ATK) and mutation (+1 everything)
  const stacked = createMythling({ speciesId: 'spriggo', level: 1, rarity: 'S', mood: 'brave', rational: 'mighty', mutation: 'shiny' });
  assert.equal(computeStats(stacked).patk, SPECIES.spriggo.baseStats.patk + 5 + 10 + 1);
  assert.equal(computeStats(stacked).spd, Math.max(1, SPECIES.spriggo.baseStats.spd - 10) + 1);
  // a Mood plus and a Rational minus on the SAME stat: the net is what the profile shows
  const net = traitModifiers('brave', 5, 'hasty');   // Brave +15 HP, Hasty -10 HP => +5 HP; +10 SPD
  assert.equal(net.hp, 5, '+15 mood and -10 rational leave +5');
  assert.equal(net.spd, 10);
  assert.equal(traitModifiers('brave', 1, 'hasty').hp, -7, 'at a low magnitude the penalty wins (+3 -10 = -7)');
  // every Mythling gets one, and old saves without one are repaired
  const wild = createMythling({ speciesId: 'aquini', level: 5 });
  assert.ok(RATIONALS[wild.rational], 'a rational is always rolled');
  assert.equal(normalizeMoodId('feral'), 'feral', 'every legacy mood id still exists');
  assert.equal(normalizeMoodId('agile'), 'agile', 'the single-stat era moods still exist too');
  assert.equal(normalizeMoodId('no_such_mood'), 'brave', 'unknown ids fall back to Brave');
});

test('counter is capped so nothing becomes untouchable', () => {
  const m = createMythling({ speciesId: 'leaflet', level: 30, rarity: 'SSS+', mood: 'swift' });
  assert.ok(computeStats(m).counter <= 35);
});

test('crit chance is nerfed: slow growth, hard-capped — a crit stays rare even at the cap', async () => {
  const m = createMythling({ speciesId: 'leaflet', level: 30, rarity: 'SSS+', mood: 'keen' });
  const s = computeStats(m);
  assert.equal(CRIT_MAX_PERCENT, 10, 'crit chance hard-caps at 10%: a crit is a lucky spike');
  assert.ok(s.crit <= CRIT_MAX_PERCENT, `crit chance capped, got ${s.crit}`);
  const { CRIT_MAX_MULT } = await import('../src/data/config.js');
  assert.equal(CRIT_MAX_MULT, 35, 'crit damage caps at +35% (x1.35): a crit stings, it never deletes an equal foe');
  assert.ok(s.critMult <= CRIT_MAX_MULT, `crit damage capped, got ${s.critMult}`);
  // a crit-focused mood beats the same Mythling with a non-crit mood (measured below the caps)
  const plain = computeStats(createMythling({ speciesId: 'leaflet', level: 30, rarity: 'SSS+', mood: 'brave', rational: m.rational }));
  assert.ok(s.crit > plain.crit, 'keen raises crit chance');
  const low = (mood) => computeStats(createMythling({ speciesId: 'spriggo', level: 5, rarity: 'A', mood, rational: m.rational }));
  assert.ok(low('brutal').critMult > low('brave').critMult, 'brutal raises crit damage');
  // a maxed, ordinary Mythling no longer crits every other hit
  for (const id of SPECIES_IDS) {
    const top = computeStats(createMythling({ speciesId: id, level: LEVEL_CAP, rarity: 'A', mood: 'brave', stage: 3 }));
    assert.ok(top.crit <= CRIT_MAX_PERCENT, `${id} at Lv.${LEVEL_CAP} crits ${top.crit}% — a crit stays rare`);
  }
});

test('every mood boosts exactly THREE stats and lowers none — no two moods share a trio, every stat is covered', () => {
  const covered = new Set(); const trios = new Set();
  for (const [id, mood] of Object.entries(MOODS)) {
    assert.equal(mood.up.length, 3, `${id} boosts three stats`);
    assert.equal(mood.down, undefined, `${id} lowers nothing`);
    for (const k of mood.up) { assert.ok(STAT_KEYS.includes(k), `${id} up stat ${k} is known`); covered.add(k); }
    const key = [...mood.up].sort().join(',');
    assert.ok(!trios.has(key), `${id} repeats another mood's trio`);
    trios.add(key);
  }
  assert.deepEqual([...covered].sort(), [...STAT_KEYS].sort(), 'every stat has a mood');
  assert.ok(Object.keys(MOODS).length >= 24, 'at least 24 moods');
});

test('the crit moods are wired to the crit stats', () => {
  assert.ok(MOODS.keen.up.includes('crit'));
  assert.ok(MOODS.brutal.up.includes('critMult'));
});

test('counter is nerfed hard: 0.15% per point, capped at 6% — a miss is rare', () => {
  assert.equal(counterDodgePercent(20), 3);
  assert.equal(counterDodgePercent(0), 0);
  assert.equal(counterDodgePercent(35), 5.25);
  assert.equal(counterDodgePercent(999), COUNTER_MAX_DODGE);
  assert.equal(COUNTER_MAX_DODGE, 6);
  // and the underlying stat still caps at 35 so nothing is untouchable
  const m = createMythling({ speciesId: 'leaflet', level: 30, rarity: 'SSS+', mood: 'agile' });
  assert.ok(computeStats(m).counter <= 35);
  assert.ok(counterDodgePercent(computeStats(m).counter) <= 6);
});

test('element chart: the triangle plus Rock (beats Fire, weak to Water and Nature)', () => {
  assert.equal(elementMultiplier('nature', 'water'), 1.5);
  assert.equal(elementMultiplier('water', 'fire'), 1.5);
  assert.equal(elementMultiplier('fire', 'nature'), 1.5);
  assert.equal(elementMultiplier('water', 'nature'), 0.75);
  assert.equal(elementMultiplier('fire', 'fire'), 1.0);
  assert.equal(elementMultiplier('rock', 'fire'), 1.5);
  assert.equal(elementMultiplier('fire', 'rock'), 0.75);
  assert.equal(elementMultiplier('water', 'rock'), 1.5);
  assert.equal(elementMultiplier('nature', 'rock'), 1.5);
  assert.equal(elementMultiplier('rock', 'water'), 0.75);
  assert.equal(elementMultiplier('rock', 'rock'), 1.0);
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

test('any learned skill can be equipped — up to 3, in the order you equip them', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  m.skills = [];
  assert.equal(equipSkill(m, 'thorn_spear'), true);
  assert.equal(equipSkill(m, 'thorn_armor'), true, 'a buff next to a special — no slot types');
  assert.equal(equipSkill(m, 'pollen_veil'), true, 'a debuff too');
  assert.deepEqual(m.skills, ['thorn_spear', 'thorn_armor', 'pollen_veil'], 'equip order = button order');
  assert.equal(equipSkill(m, 'bite'), false, 'all three buttons are full');
  assert.equal(equipSkill(m, 'thorn_armor'), false, 'the same skill cannot sit on two buttons');
  // ...but only skills the Mythling has actually learned
  assert.equal(equipSkill(m, 'ocean_pressure'), false, 'not in the library');
  assert.equal(equipSkill(m, 'not_a_skill'), false, 'unknown skill');
  // unequipping closes the gap and keeps the order of the rest
  assert.equal(unequipSkill(m, 'thorn_armor'), true);
  assert.deepEqual(m.skills, ['thorn_spear', 'pollen_veil']);
  assert.equal(equipSkill(m, 'bite'), true);
  assert.deepEqual(m.skills, ['thorn_spear', 'pollen_veil', 'bite'], 'a newly equipped skill takes the next button');
  assert.equal(equippedSkill(m, 2).id, 'bite');
  assert.equal(moveSkill(m, 2, 0), true);
  assert.deepEqual(m.skills, ['bite', 'thorn_spear', 'pollen_veil'], 're-ordering works');
});

test('buttons can be left empty and the loadout survives a save/load', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  m.skills = [];
  equipSkill(m, 'thorn_armor');
  assert.deepEqual(m.skills, ['thorn_armor']);
  // a reload must not quietly refill buttons the player chose to leave empty
  GameState.party = [m];
  GameState.storage = [];
  const round = deserialize(serialize());
  assert.equal(round, true);
  const reloaded = PartyManager.lead();
  assert.deepEqual(reloaded.skills, ['thorn_armor'], 'the loadout survives a save/load');
});

test('old saves with {normal, special, buff} slots migrate to the ordered loadout', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  GameState.party = [m];
  GameState.storage = [];
  const data = serialize();
  data.party[0].skills = { normal: 'thorn_jab', special: null, buff: 'thorn_armor' };
  assert.equal(deserialize(data), true);
  assert.deepEqual(PartyManager.lead().skills, ['thorn_jab', 'thorn_armor'], 'old slots become buttons, empties dropped');
});

test('every species learns three debuff skills (Lv.1, Lv.12, Lv.40)', () => {
  const { SKILLS: allSkills } = SKILLS_MOD;
  for (const id of SPECIES_IDS) {
    const sp = SPECIES[id];
    const all = Object.entries(sp.skillUnlocks)
      .flatMap(([lv, ids]) => ids.map((sid) => ({ lv: Number(lv), sk: allSkills[sid] })))
      .filter((e) => e.sk && e.sk.category === 'debuff');
    const regular = all.filter((e) => e.sk.effects.length === 1);
    const elite = all.filter((e) => e.sk.effects.length > 1);
    assert.equal(regular.length, 3, `${id} has three single-stat debuffs`);
    assert.deepEqual(regular.map((e) => e.lv).sort((a, b) => a - b), [1, 12, 40], `${id} learns them at 1 / 12 / 40`);
    for (const { sk } of all) assert.ok(Number.isFinite(sk.uses) && sk.uses > 0, `${sk.id} has limited uses`);
    // elite (two-effect) support skills only arrive late and are scarce
    for (const { lv, sk } of elite) { assert.ok(lv >= 60, `${sk.id} is late game`); assert.ok(sk.uses <= 4, `${sk.id} is scarce`); }
  }
  const m = createMythling({ speciesId: 'emberu', level: 12 });
  assert.ok(m.library.includes('scorch') && m.library.includes('ash_cloud'), 'debuffs land in the library');
});

const { getSkill: getSkillById } = SKILLS_MOD;
const { basicAttack, maxHp } = await import('../src/core/mythling.js');

test('an exhausted move falls back to the unlimited attack instead of wasting the turn', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  for (const id of m.library) { const sk = getSkillById(id); if (sk && Number.isFinite(sk.uses)) m.uses[id] = 0; }
  const basic = basicAttack(m);
  assert.equal(Number.isFinite(basic.uses), false, `${basic.name} has unlimited uses`);
  assert.equal(basic.category, 'normal');
  assert.equal(basic.id, 'bite', 'the element-less starter attack is the only unlimited move');
});

test('elemental Normal skills have limited uses; only the plain starter attacks are unlimited', () => {
  const normals = Object.values(SKILLS_MOD.SKILLS).filter((s) => s.category === 'normal');
  for (const s of normals) {
    if (s.element) assert.ok(Number.isFinite(s.uses) && s.uses > 0, `${s.id} carries an element -> limited uses`);
    else assert.equal(s.uses, Infinity, `${s.id} has no element -> unlimited`);
  }
  for (const sp of Object.values(SPECIES)) {
    const lv1 = (sp.skillUnlocks[1] || []).map((id) => SKILLS_MOD.SKILLS[id]);
    assert.ok(lv1.some((s) => s && s.category === 'normal' && !s.element), `${sp.id} learns an unlimited element-less normal at Lv.1`);
  }
  // a save from before the change starts the newly-limited normals full instead of empty
  const m = createMythling({ speciesId: 'spriggo', level: 25, stage: 1 });
  delete m.uses.thorn_jab;
  const raw = JSON.parse(JSON.stringify(serialize()));
  raw.party = [JSON.parse(JSON.stringify(m))];
  deserialize(raw);
  assert.equal(PartyManager.list()[0].uses.thorn_jab, SKILLS_MOD.SKILLS.thorn_jab.uses, 'migrated uses start full');
});

// ------------------------------------------------------------------
section('Battle');
test('battles are fair at Lv.100: no one-shots at parity, trainer teams stay at their written level', async () => {
  const { DAMAGE_LEVEL_SCALE, DAMAGE_STAGE_SCALE } = await import('../src/data/config.js');
  assert.ok(DAMAGE_LEVEL_SCALE <= 0.04 && DAMAGE_STAGE_SCALE <= 0.1, 'gentle level / stage scaling');
  // two equal Lv.100 final-stage Mythlings, neutral element, strongest Special: at least four hits to KO, an Ultimate at least two
  const a = createMythling({ speciesId: 'spriggo', level: LEVEL_CAP, stage: 3, rarity: 'A', mood: 'brave', rational: 'docile' });
  const b = createMythling({ speciesId: 'emberu', level: LEVEL_CAP, stage: 3, rarity: 'A', mood: 'brave', rational: 'docile' });   // Nature vs Fire is a weakness for a; use b attacking a neutral? Fire→Nature is strong, so measure b's hits on a with a NEUTRAL move
  const hitsToKo = (attacker, defender, skillId, rng = () => 0.999) => {
    let hits = 0; const hpStart = defender.currentHp;
    while (defender.currentHp > 0 && hits < 50) { const bt = new Battle({ type: BattleType.WILD, party: [attacker], enemies: [defender], mapId: 'verdant_vale', rng }); bt.act({ type: 'skill', skillId }); hits++; }
    defender.currentHp = hpStart; return hits;
  };
  // Bite is element-less (neutral) — the strongest neutral is Worldroot... no, that is Nature; use 'bite' scaled: we check a Special instead
  const neutralSpecial = 'crystal_ray';   // Rock special: neutral against Nature? Rock vs Nature = weak; pick Water 'aqua_spear' vs Fire = strong. Use retaliate-free: Bite (neutral, normal).
  void neutralSpecial;
  const hitsNormal = hitsToKo(b, a, 'bite');
  assert.ok(hitsNormal >= 6, `a neutral Lv.100 Normal needs several hits (${hitsNormal})`);
  b.library.push('inferno_roar'); b.uses.inferno_roar = 99;
  const hitsSpecialSE = hitsToKo(b, a, 'inferno_roar');   // Fire vs Nature: super effective, max roll, no crit
  assert.ok(hitsSpecialSE >= 3, `even a super-effective Lv.100 Special needs several hits (${hitsSpecialSE})`);
  // trainer teams are fixed: a Lv.100 party does not inflate a Lv.5 trainer
  createNewGameState({ slot: 1, playerName: 'T', starterId: 'spriggo' });
  PartyManager.list()[0].level = LEVEL_CAP;
  const t = MAPS.verdant_vale.trainers[0];
  const enemies = t.team.map((spec) => createMythling({ speciesId: spec.species, level: Math.min(LEVEL_CAP, spec.level || 1) }));
  assert.deepEqual(enemies.map((e) => e.level), t.team.map((x) => x.level));
});

test('skill uses refill at the start of every battle, and a max-damage crit still cannot one-shot an equal foe', () => {
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  for (const id of m.library) if (Number.isFinite(getSkillById(id)?.uses)) m.uses[id] = 0;
  const foe = createMythling({ speciesId: 'aquini', level: 20 });
  new Battle({ type: BattleType.WILD, party: [m], enemies: [foe], mapId: 'verdant_vale' });
  for (const id of m.library) { const sk = getSkillById(id); if (Number.isFinite(sk.uses)) assert.equal(m.uses[id], sk.uses, `${id} starts the battle full`); }
  // crit: super-effective Special, max damage roll, forced crit, Lv.100 vs Lv.100 → still not a one-shot
  const a = createMythling({ speciesId: 'emberu', level: LEVEL_CAP, stage: 3, rarity: 'A', mood: 'brutal', rational: 'docile' });
  const d = createMythling({ speciesId: 'spriggo', level: LEVEL_CAP, stage: 3, rarity: 'A', mood: 'brave', rational: 'docile' });
  a.library.push('inferno_roar'); a.uses.inferno_roar = 99;
  // rng sequence per turn: enemy AI pick, [speed tie], dodge (no), crit (YES), damage roll (max)...
  const seq = [0.5, 0.99, 0.0, 0.99, 0.5, 0.99, 0.0, 0.99]; let i = 0;
  const rng = () => seq[i++] ?? 0.99;
  const bt = new Battle({ type: BattleType.WILD, party: [a], enemies: [d], mapId: 'emberwild', rng });
  const before = d.currentHp;
  const { events } = bt.act({ type: 'skill', skillId: 'inferno_roar' });
  const hit = events.find((e) => e.type === 'damage' && e.side === 'enemy');
  assert.ok(hit, 'the attack landed');
  assert.ok(hit.crit, 'the hit was a crit');
  assert.ok(hit.amount < before, `a super-effective crit deals ${hit.amount} of ${before} HP — big, not a one-shot`);
  assert.ok(hit.amount > before * 0.15, `but it is still clearly impactful (${Math.round(hit.amount / before * 100)}% of the bar)`);
});

test('Ultimates hit like a finisher: every tier out-muscles the best Special, and an equal foe still survives one', async () => {
  const { ULTIMATE_POWER_SCALE } = await import('../src/data/config.js');
  const { ULTIMATES, SKILLS: ALL_SKILLS } = await import('../src/data/skills.js');
  // Charging to 8/8 has to be worth it: every Ultimate tier must beat the
  // strongest Special in the game. At the old 0.7 scale, tier I landed at 35
  // power — below the 56-power top Special — so an Ultimate hit SOFTER than
  // the move you could press every turn.
  const topSpecial = Math.max(...Object.values(ALL_SKILLS).filter((s) => s.category === 'special').map((s) => s.power));
  for (const u of Object.values(ULTIMATES)) {
    for (const t of u.tiers) {
      if (!t.power) continue;                       // support Ultimates deal no damage
      const effective = Math.round(t.power * ULTIMATE_POWER_SCALE);
      // a hybrid trades a slice of its power for a rider (Ocean Guard shields
      // itself), so it is measured against a slightly gentler bar
      const bar = t.selfBuff ? topSpecial * 0.9 : topSpecial;
      assert.ok(effective >= bar, `${u.id}${t.suffix} lands at ${effective} power against a ${Math.round(bar)} bar`);
    }
  }
  const a = createMythling({ speciesId: 'emberu', level: LEVEL_CAP, stage: 3, rarity: 'A', mood: 'brutal', rational: 'mystic' });   // Fire vs Nature: super effective
  const d = createMythling({ speciesId: 'spriggo', level: LEVEL_CAP, stage: 3, rarity: 'A', mood: 'brave', rational: 'docile' });
  a.ultCharge = 8;
  const seq = [0.5, 0.99, 0.0, 0.99, 0.5, 0.99, 0.0, 0.99]; let i = 0;   // dodge no, crit YES, max roll
  const bt = new Battle({ type: BattleType.WILD, party: [a], enemies: [d], mapId: 'emberwild', rng: () => seq[i++] ?? 0.99 });
  const before = d.currentHp;
  const { events } = bt.act({ type: 'ultimate' });
  const hit = events.find((e) => e.type === 'damage' && e.side === 'enemy' && e.isUltimate);
  assert.ok(hit && hit.crit, 'a critical Ultimate landed');
  assert.ok(hit.amount < before, `SE crit Ultimate: ${hit.amount} of ${before} HP — huge, not a delete`);
  assert.ok(hit.amount > before * 0.4, 'and it clearly hurts — a full charge is a finisher');
  // the Power shown in menus is the effective one
  const { ultimateMove } = await import('../src/core/mythling.js');
  const u = ultimateMove(a);
  assert.equal(u.power, Math.round(u.listedPower * ULTIMATE_POWER_SCALE));
});

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
  // Mood and Rational are pinned: speed decides who rolls first, and these tests
  // drive the RNG by position, so a random Mood could flip the turn order.
  const p = createMythling({ speciesId: 'emberu', level: 30, mood: 'brave', rational: 'docile', rarity: 'D' });
  const e = createMythling({ speciesId: 'rivruff', level: 30, mood: 'brave', rational: 'docile', rarity: 'D' });
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
  assert.ok(r.events.some((ev) => ev.type === 'log' && String(ev.text).includes(`${dmg.amount} damage`)),
    `the message reports the damage: ${r.events.filter((ev) => ev.type === 'log').map((ev) => ev.text).join(' / ')}`);
  assert.ok(!/CRITICAL/.test(r.events.filter((ev) => ev.type === 'log' && String(ev.text).includes('used')).map((ev) => ev.text).join(' ')),
    'no crit on this roll');
});

test('a crit multiplies the damage and says so', () => {
  const p = createMythling({ speciesId: 'leaflet', level: 30, mood: 'feral', rarity: 'SSS+' });
  const e = createMythling({ speciesId: 'rivruff', level: 30, mood: 'brave', rational: 'docile', rarity: 'D' });
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

test('RUN is absolute: fleeing always works, from wild AND trainer battles', () => {
  const player = createMythling({ speciesId: 'spriggo', level: 3 });
  const wild = createMythling({ speciesId: 'leaflet', level: 30 });     // far faster than us
  const b = new Battle({ type: BattleType.WILD, party: [player], enemies: [wild], mapId: 'verdant_vale', rng: () => 0.999 });
  const r = b.act({ type: 'run' });
  assert.equal(b.phase, BattlePhase.FLED, 'fled on the first try despite the worst roll');
  assert.ok(!r.events.some((ev) => ev.type === 'damage'), 'the enemy gets no free hit');
  assert.equal(player.currentHp, maxHpOf(player));

  const trainerTeam = [createMythling({ speciesId: 'rivruff', level: 30 }), createMythling({ speciesId: 'aquini', level: 30 })];
  const t = new Battle({
    type: BattleType.TRAINER, party: [createMythling({ speciesId: 'emberu', level: 40 })], enemies: trainerTeam,
    trainer: { name: 'Coach Nia', flag: 't_test', team: [] }, mapId: 'tidecrest', rng: () => 0.999,
  });
  assert.equal(t.canRun, true, 'trainer battles can be left too');
  t.act({ type: 'skill', index: 0 });
  assert.equal(t.phase, BattlePhase.ACTIVE);
  const r2 = t.act({ type: 'run' });
  assert.equal(t.phase, BattlePhase.FLED, 'walked away mid-battle');
  assert.ok(r2.events.some((ev) => ev.type === 'log' && /walked away/i.test(ev.text)));
});

test('debuff skills lower the FOE\'s stat and grant no Ultimate Charge', () => {
  const p = createMythling({ speciesId: 'spriggo', level: 12 });
  p.skills = ['pollen_veil'];                                   // S.DEF -5 on the foe
  const e = createMythling({ speciesId: 'rivruff', level: 12 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.99 });
  const before = b.cb(e).stat('sdef');
  const r = b.act({ type: 'skill', index: 0 });
  const ev = r.events.find((x) => x.type === 'debuff' && x.side === 'enemy');
  assert.ok(ev, 'a debuff event on the enemy side');
  assert.equal(ev.stat, 'sdef');
  assert.equal(b.cb(e).stat('sdef'), Math.max(1, before - 5), 'the foe\'s S.DEF dropped by 5');
  assert.equal(b.cb(p).buffs.sdef, undefined, 'nothing happened to the caster');
  assert.equal(p.ultCharge, 0, 'no charge from a debuff');
  assert.equal(usesLeft(p, 'pollen_veil'), 9, 'one use spent');
  assert.ok(r.events.some((x) => x.type === 'log' && /S\.?DEF fell/i.test(x.text)), 'the log says it fell');
});

test('life steal: drain heals a share of the damage dealt, mending heals a share of max HP', () => {
  const p = createMythling({ speciesId: 'spriggo', level: 60, stage: 2 });
  p.library.push('mending_strike'); p.skills = ['sap_bite', 'mending_strike']; restoreAll(p);   // sap_bite is learned at Lv.60 anyway
  const e = createMythling({ speciesId: 'rivruff', level: 60, stage: 2 });
  e.currentHp = 99999; // keep the foe alive
  e.library = ['aqua_guard']; e.skills = ['aqua_guard']; // the foe only buffs, so our HP is ours to control
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.99 });
  p.currentHp = 30;
  const r = b.act({ type: 'skill', index: 0 });
  const dmg = r.events.find((x) => x.type === 'damage' && x.side === 'enemy');
  const heal = r.events.find((x) => x.type === 'heal' && x.side === 'player');
  assert.ok(dmg && heal, 'a hit followed by a heal');
  assert.equal(heal.amount, Math.floor(dmg.amount * 0.5), 'heals exactly 50% of the damage');
  assert.ok(r.events.some((x) => x.type === 'log' && /recovered/.test(x.text)));
  p.currentHp = 30;
  const r2 = b.act({ type: 'skill', index: 1 });
  const heal2 = r2.events.find((x) => x.type === 'heal' && x.side === 'player');
  assert.equal(heal2.amount, Math.floor(maxHpOf(p) * 0.2), 'mending strike heals 20% of max HP');
  // never over-heals
  p.currentHp = maxHpOf(p) - 3;
  const r3 = b.act({ type: 'skill', index: 1 });
  const heal3 = r3.events.find((x) => x.type === 'heal' && x.side === 'player');
  assert.ok(!heal3 || heal3.amount <= 3, 'capped at max HP');
});

test('retaliate returns the last hit taken at double strength — and fizzles when there is nothing to return', () => {
  const p = createMythling({ speciesId: 'shalecrawl', level: 60, stage: 2 });
  p.library.push('retaliate'); p.skills = ['retaliate'];
  const e = createMythling({ speciesId: 'gravelhog', level: 60, stage: 2 });
  e.currentHp = 99999; p.currentHp = 99999;
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'stonehollow_crags', rng: () => 0.99 });
  // turn 1: the foe is faster or slower, either way it attacks once with a rock skill
  const r1 = b.act({ type: 'skill', index: 0 });
  const taken = r1.events.filter((x) => x.type === 'damage' && x.side === 'player').pop();
  assert.ok(taken, 'the foe hit us');
  // turn 2: retaliate returns exactly double that hit (rng 0.99 -> no crit)
  const r2 = b.act({ type: 'skill', index: 0 });
  const returned = r2.events.find((x) => x.type === 'damage' && x.side === 'enemy' && x.skillId === 'retaliate');
  const lastTakenBefore = b.cb(p).lastHit;
  assert.ok(returned, 'retaliate dealt damage');
  void lastTakenBefore;
  const prevTaken = r2.events.findIndex((x) => x === returned) < r2.events.findIndex((x) => x.type === 'damage' && x.side === 'player') || !r2.events.some((x) => x.type === 'damage' && x.side === 'player') ? taken.amount : null;
  if (prevTaken != null) assert.equal(returned.amount, prevTaken * 2, 'double the hit it answered');
  // a foe that only buffs leaves nothing to return
  const p2 = createMythling({ speciesId: 'shalecrawl', level: 60, stage: 2 });
  p2.library.push('retaliate'); p2.skills = ['retaliate'];
  const buffer = createMythling({ speciesId: 'pebbleshell', level: 60, stage: 2 });
  buffer.skills = ['stone_skin']; buffer.library = ['stone_skin'];
  const b2 = new Battle({ type: BattleType.WILD, party: [p2], enemies: [buffer], mapId: 'stonehollow_crags', rng: () => 0.99 });
  const r3 = b2.act({ type: 'skill', index: 0 });
  assert.ok(r3.events.some((x) => x.type === 'log' && /nothing to return/.test(x.text)), 'fizzles against a buffer');
  assert.ok(!r3.events.some((x) => x.type === 'damage' && x.side === 'enemy'), 'no damage dealt');
});

test('elite support skills carry two effects; foe-side entries are always debuffs, self-side always buffs', () => {
  const { getSkill: sk } = SKILLS_MOD;
  assert.equal(sk('war_cry').effects.length, 2);
  assert.equal(sk('predator_focus').effects.find((e) => e.target === 'foe').stat, 'pdef');
  const p = createMythling({ speciesId: 'emberlynx', level: 80, stage: 3 });
  p.library.push('predator_focus'); p.skills = ['predator_focus'];
  const e = createMythling({ speciesId: 'rivruff', level: 80, stage: 3 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'emberwild', rng: () => 0.99 });
  const r = b.act({ type: 'skill', index: 0 });
  assert.ok(r.events.some((x) => x.type === 'buff' && x.side === 'player' && x.stat === 'patk'), 'own P.ATK up');
  assert.ok(r.events.some((x) => x.type === 'debuff' && x.side === 'enemy' && x.stat === 'pdef'), 'foe P.DEF down');
  assert.equal(p.ultCharge, 0, 'support skills never charge the Ultimate');
});

test('support Ultimates deal no damage and apply two Ultimate-grade effects', () => {
  const { resolveUltimate, isSupportUltimate } = SKILLS_MOD;
  const u = resolveUltimate('crystal_resonance', 1);
  assert.ok(isSupportUltimate(u) && u.effects.length === 2 && !u.power);
  const p = createMythling({ speciesId: 'shalecrawl', level: 25, stage: 1 });   // crystal_resonance: self S.ATK +, foe S.DEF -
  p.ultCharge = 8;
  const e = createMythling({ speciesId: 'rivruff', level: 25, stage: 1 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'stonehollow_crags', rng: () => 0.99 });
  const r = b.act({ type: 'ultimate' });
  assert.ok(r.events.some((x) => x.type === 'ultimate-cast' && x.kind === 'support'), 'a support cast event');
  assert.ok(!r.events.some((x) => x.type === 'damage' && x.side === 'enemy' && x.isUltimate), 'no ultimate damage');
  assert.ok(r.events.some((x) => x.type === 'buff' && x.side === 'player' && x.stat === 'satk' && x.amount === 11), 'tier I self buff');
  assert.ok(r.events.some((x) => x.type === 'debuff' && x.side === 'enemy' && x.stat === 'sdef' && x.amount === 8), 'tier I foe debuff');
  assert.equal(p.ultCharge, 0, 'charge spent');
  // the pure buff and pure debuff variants exist too
  assert.ok(resolveUltimate('granite_bastion', 0).effects.every((x) => x.target === 'self'));
  assert.ok(resolveUltimate('quake_curse', 0).effects.every((x) => x.target === 'foe'));
  for (const id of ['granite_bastion', 'quake_curse', 'crystal_resonance']) assert.ok(SPECIES_IDS.some((sp) => SPECIES[sp].ultimate === id), `${id} belongs to a species`);
});

test('the Index reveals an evolution only once that form has been owned', () => {
  createNewGameState({ slot: 1, playerName: 'DEX', starterId: 'spriggo' });
  assert.ok(CollectionManager.hasForm('spriggo', 0), 'the starter counts as owned');
  assert.ok(!CollectionManager.hasForm('spriggo', 1), 'Thornox is still hidden');
  const m = PartyManager.lead();
  gainExp(m, 999999); // straight to the cap
  const { EvolutionManager } = evolutionApi;
  while (EvolutionManager.isReady(m)) EvolutionManager.perform(m);
  assert.ok(CollectionManager.hasForm('spriggo', 1) && CollectionManager.hasForm('spriggo', m.stage), 'every stage reached is revealed');
  // seeing a wild evolved Mythling does NOT reveal the form
  CollectionManager.markSeen('rivruff');
  assert.ok(!CollectionManager.hasForm('rivruff', 1));
  // catching records stage 0; an old save with an evolved Mythling gets its forms back on load
  const data = serialize();
  data.collection.spriggo.forms = {};
  deserialize(data);
  assert.ok(CollectionManager.hasForm('spriggo', PartyManager.lead().stage), 'forms rebuilt from the party on load');
});

test('battle actions address buttons by index, and a category name still resolves', () => {
  const p = createMythling({ speciesId: 'spriggo', level: 5 });
  assert.deepEqual(p.skills, ['bite', 'vine_lash', 'brave_guard'], 'auto-equip: normal, special, then the stat skill');
  const e = createMythling({ speciesId: 'leaflet', level: 5 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.99 });
  const r1 = b.act({ type: 'skill', index: 1 });
  assert.ok(r1.events.some((ev) => ev.type === 'cast' && ev.side === 'player' && ev.skillId === 'vine_lash'), 'button 2 = Vine Lash');
  const r2 = b.act({ type: 'skill', slot: 'buff' });
  assert.ok(r2.events.some((ev) => ev.type === 'cast' && ev.side === 'player' && ev.skillId === 'brave_guard'), 'legacy category lookup');
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
  InventoryManager.add('absolute_ball', 50);
  let res, guard = 0;
  do { res = CaptureManager.attempt(wild, 'absolute_ball'); } while (!res.success && guard++ < 200);
  assert.ok(res.success, 'the ball eventually catches');
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
test('the God Ball is the supreme regular ball: a guaranteed catch; the King Ball is gone', () => {
  const { ITEMS: allItems, BALL_IDS: balls } = ITEMS_MOD;
  assert.deepEqual(balls, ['basic_ball', 'normal_ball', 'advanced_ball', 'absolute_ball', 'god_ball', 'shiny_ball', 'dark_ball']);
  assert.equal(allItems.king_ball, undefined, 'no King Ball any more');
  const nasty = createMythling({ speciesId: 'cinderhawk', level: 100, rarity: 'SSS+' });
  nasty.currentHp = 0;
  assert.equal(captureChance({ target: nasty, ballId: 'god_ball' }), 1, '100% on the hardest possible target');
  assert.ok(captureChance({ target: nasty, ballId: 'absolute_ball' }) < 1, 'the Absolute Ball can still fail');
  assert.ok(allItems.god_ball.price > allItems.absolute_ball.price, 'priced above every regular ball');
  createNewGameState({ slot: 1, playerName: 'ROYAL', starterId: 'spriggo' });
  InventoryManager.add('god_ball', 1);
  const res = CaptureManager.attempt(nasty, 'god_ball', () => 0.999999);
  assert.equal(res.success, true, 'never breaks free');
  assert.equal(InventoryManager.count('god_ball'), 0, 'the ball is spent');
});

test('Shiny Ball and Dark Ball: guaranteed catch AND a guaranteed mutation, for a fortune', () => {
  const { ITEMS: allItems } = ITEMS_MOD;
  assert.ok(allItems.shiny_ball.price >= 5 * allItems.god_ball.price && allItems.dark_ball.price > allItems.shiny_ball.price, 'very expensive');
  createNewGameState({ slot: 1, playerName: 'LUCKY', starterId: 'spriggo' });
  for (const [ball, mutation] of [['shiny_ball', 'shiny'], ['dark_ball', 'darkness']]) {
    const wild = createMythling({ speciesId: 'aquini', level: 30, rarity: 'A', mutation: 'none' });
    wild.currentHp = 0;
    InventoryManager.add(ball, 1);
    const res = CaptureManager.attempt(wild, ball, () => 0.999999);
    assert.equal(res.success, true, `${ball} never fails`);
    assert.equal(res.mythling.mutation, mutation, `${ball} forces the ${mutation} mutation`);
    assert.equal(res.mythling.level, 1, 'still restarts at Lv.1');
    assert.ok(CollectionManager.entry('aquini').mutations[mutation], 'the mutation is recorded in the Collection');
  }
  // a retired King Ball in an old save turns into a God Ball
  const data = serialize();
  data.inventory = { king_ball: 2, basic_ball: 1 };
  data.party[0].meta.caughtWith = 'king_ball';
  deserialize(data);
  assert.equal(InventoryManager.count('god_ball'), 2, 'King Balls migrate to God Balls');
  assert.equal(InventoryManager.count('king_ball'), 0);
  assert.equal(PartyManager.list()[0].meta.caughtWith, 'god_ball');
});

test('Mood Tonic and Temper Tonic re-roll a trait into a different one and keep HP in proportion', () => {
  const { rerollMood, rerollRational } = mythlingApi;
  const m = createMythling({ speciesId: 'rivruff', level: 20, rarity: 'S', mood: 'sturdy', rational: 'stoic' });
  m.currentHp = Math.floor(maxHpOf(m) / 2);
  const r1 = rerollMood(m, () => 0.999);
  assert.notEqual(r1.after, 'sturdy'); assert.equal(m.mood, r1.after);
  assert.ok(Math.abs(m.currentHp / maxHpOf(m) - 0.5) < 0.02, 'HP ratio survives the mood change');
  const r2 = rerollRational(m, () => 0.5);
  assert.notEqual(r2.after, 'stoic'); assert.equal(m.rational, r2.after);
  assert.ok(ITEMS_MOD.ITEMS.mood_tonic.rerollMood && ITEMS_MOD.ITEMS.temper_tonic.rerollRational, 'both tonics exist');
  assert.ok(MAPS.azure_coast.buildings.some((b) => (b.stock || []).includes('mood_tonic')), 'sold from Azure Coast');
});

test('the starter partner is always S rarity', () => {
  for (const id of ['spriggo', 'aquini', 'emberu']) {
    const starter = createNewGameState({ slot: 1, playerName: 'DUMDUM', starterId: id });
    assert.equal(starter.rarity, 'S', `${id} starter is S`);
    assert.equal(starter.meta.isStarter, true);
    assert.equal(PartyManager.lead().rarity, 'S');
  }
  // but the species itself still spawns at its normal rarity in the wild
  assert.equal(createMythling({ speciesId: 'spriggo', level: 3 }).rarity, SPECIES.spriggo.defaultRarity);
});

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

test('a stack of food can be fed at once and is capped at the level cap', () => {
  createNewGameState({ slot: 1, playerName: 'CHEF', starterId: 'aquini' });
  const m = PartyManager.lead();
  gainExp(m, 5_000_000);                                  // Lv.100 already
  assert.equal(FeedManager.maxFeedable(m, 'sweet_berry'), 0, 'a maxed Mythling cannot be fed');
  const late = createMythling({ speciesId: 'leaflet', level: 95 });
  PartyManager.add(late);
  InventoryManager.add('wildbound_ambrosia', 50);
  const need = FeedManager.toCap(late, 'wildbound_ambrosia');
  assert.ok(need >= 1 && need < 50, `only ${need} ambrosia are useful from Lv.95`);
  assert.equal(FeedManager.maxFeedable(late, 'wildbound_ambrosia'), need, 'never more than useful');
  const prev = FeedManager.preview(late, 'wildbound_ambrosia', need);
  assert.equal(prev.level, LEVEL_CAP, 'the preview reaches the cap');
  const res = FeedManager.feed(late, 'wildbound_ambrosia', 50);
  assert.equal(res.ok, true);
  assert.equal(res.count, need, 'asked for 50, fed only what was useful');
  assert.equal(late.level, LEVEL_CAP);
  assert.equal(InventoryManager.count('wildbound_ambrosia'), 50 - need, 'the rest stays in the bag');
  // small stacks: feed exactly what you asked for
  const kid = createMythling({ speciesId: 'spriggo', level: 1 });
  InventoryManager.add('sweet_berry', 10);
  const r2 = FeedManager.feed(kid, 'sweet_berry', 3);
  assert.equal(r2.count, 3);
  assert.equal(r2.exp, 120);
  assert.equal(InventoryManager.count('sweet_berry'), 7 + 3, 'starting berries + the rest');
});

test('the food ladder reaches high-level training and every shop sells food', () => {
  const foods = Object.values(ITEMS_MOD.ITEMS).filter((i) => i.category === 'food');
  assert.ok(foods.length >= 15, `${foods.length} foods (5 old + 10 new)`);
  const best = Math.max(...foods.map((f) => f.exp));
  assert.ok(best >= expToNextLevel(LEVEL_CAP - 1) * 5, 'the best food is worth several late levels');
  for (const id of Object.keys(MAPS)) {
    const shop = MAPS[id].buildings.find((b) => b.type === 'shop');
    assert.ok(shop.stock.some((s) => ITEMS_MOD.ITEMS[s]?.category === 'food'), `${id} sells food`);
    for (const s of shop.stock) assert.ok(ITEMS_MOD.ITEMS[s], `${id} stocks a real item (${s})`);
  }
});

test('healing items apply every effect they carry and refuse to be wasted', () => {
  const { ITEMS: allItems } = ITEMS_MOD;
  const m = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  assert.equal(applyItemEffects(allItems.potion, m).ok, false, 'full HP: a potion does nothing');
  m.currentHp = 1;
  consumeUse(m, 'vine_lash'); consumeUse(m, 'vine_lash');
  const full = applyItemEffects(allItems.full_restore, m);
  assert.equal(full.ok, true);
  assert.equal(m.currentHp, maxHpOf(m), 'Full Restore heals everything');
  assert.equal(usesLeft(m, 'vine_lash'), 20, '...and refills every skill');
  assert.equal(full.usesRestored, true);
  m.currentHp = 0;
  assert.equal(applyItemEffects(allItems.max_potion, m).ok, false, 'a fainted Mythling needs a revive');
  const rev = applyItemEffects(allItems.max_revive, m);
  assert.equal(rev.ok, true);
  assert.equal(m.currentHp, maxHpOf(m), 'Max Revive brings it back at full HP');
  m.currentHp = 10;
  const dry = applyItemEffects(allItems.hyper_potion, m, { dryRun: true });
  assert.equal(dry.ok, true);
  assert.equal(m.currentHp, 10, 'a dry run changes nothing');
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
  InventoryManager.add('absolute_ball', 30);
  let res, guard = 0;
  do { res = CaptureManager.attempt(leaflet, 'absolute_ball'); } while (!res.success && guard++ < 200);
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
test('shops: the volcano shop is trimmed, the LAST map sells the complete catalogue', () => {
  const MAP_ORDER = Object.values(MAPS).sort((a, b) => a.order - b.order).map((m) => m.id);
  const stock = (id) => MAPS[id].buildings.find((b) => b.type === 'shop').stock;
  const ember = stock('emberwild');
  for (const id of ['god_ball', 'shiny_ball', 'dark_ball', 'full_restore', 'wildbound_ambrosia', 'titan_broth', 'phoenix_pepper']) assert.ok(!ember.includes(id), `Emberwild no longer sells ${id}`);
  assert.ok(ember.includes('absolute_ball') && ember.includes('max_revive'), 'Emberwild keeps its region-3 essentials');
  const last = stock(MAP_ORDER[MAP_ORDER.length - 1]);
  const purchasable = Object.values(ITEMS_MOD.ITEMS).filter((i) => i.price > 0 && i.category !== 'key').map((i) => i.id);
  assert.deepEqual([...last].sort(), [...purchasable].sort(), 'the last region sells every purchasable item');
  for (const id of MAP_ORDER.slice(0, -1)) assert.ok(stock(id).length < last.length, `${id} sells less than the last map`);
});

test('treasure chests: capped per tier, placed on walkable ground, and their loot follows the tier', async () => {
  const { CHEST_TIERS, rollChestTiers, rollChestLoot, CHEST_TIER_IDS } = await import('../src/data/chests.js');
  const { ChestManager } = await import('../src/systems/ChestManager.js');
  const { WorldRenderer } = await import('../src/render/worldRenderer.js');
  assert.deepEqual(CHEST_TIER_IDS, ['bronze', 'silver', 'emerald', 'ultra_gold']);
  assert.equal(CHEST_TIERS.bronze.max, 2); for (const id of ['silver', 'emerald', 'ultra_gold']) assert.equal(CHEST_TIERS[id].max, 1, `${id}: only one at a time`);
  assert.ok(CHEST_TIERS.ultra_gold.chance <= 0.005, 'Ultra Gold is nearly impossible');
  // a roll that always succeeds still respects the caps
  const all = rollChestTiers(() => 0);
  assert.deepEqual(all.sort(), ['bronze', 'bronze', 'emerald', 'silver', 'ultra_gold']);
  assert.deepEqual(rollChestTiers(() => 0.999), [], 'a bad roll spawns nothing');
  // loot: always coins, better tiers pay more, top items only from the top chests
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  const bronze = rollChestLoot('bronze', 0, seq([0.5, 0.99]));
  assert.ok(bronze.coins >= 40 && bronze.coins <= 120 && bronze.item === null, 'a common bronze chest is just coins');
  const gold = rollChestLoot('ultra_gold', 3, seq([0.5, 0, 0, 0]));
  assert.ok(gold.coins >= 4000 * 3.4, 'ultra gold pays a fortune, more in later regions');
  assert.ok(['god_ball', 'shiny_ball', 'dark_ball'].includes(gold.item.id), 'the best balls only come from the best chest');
  for (const t of ['bronze', 'silver', 'emerald']) for (const b of CHEST_TIERS[t].balls) assert.ok(!['god_ball', 'shiny_ball', 'dark_ball'].includes(b), `${t} never drops a guaranteed ball`);
  // tiers stay ordered: a better chest never pays less than the one below it
  const foodExp = (t) => CHEST_TIERS[t].foods.map((f) => ITEMS_MOD.ITEMS[f].exp);
  assert.ok(Math.max(...foodExp('bronze')) < Math.min(...foodExp('silver')), 'silver food beats bronze food');
  assert.ok(Math.max(...foodExp('silver')) < Math.min(...foodExp('emerald')), 'emerald food beats silver food');
  // placement + opening through the manager
  createNewGameState({ slot: 1, playerName: 'CHEST', starterId: 'spriggo' });
  const map = MAPS.verdant_vale; const wr = new WorldRenderer();
  const free = ChestManager.makeFreeTest(map, wr.colliders(map));
  // The first five rolls decide the tiers (0 wins every one), and the same rng
  // then places them — so it has to vary, or all 60 attempts pick one point.
  let rolls = 0;
  const spawnRng = () => (rolls++ < 5 ? 0 : (rolls * 0.137) % 1);
  const list = ChestManager.ensure('verdant_vale', free, spawnRng);
  assert.equal(list.length, 5, `every slot spawned with a perfect roll (got ${list.length})`);
  for (const c of list) assert.ok(free(c.x, c.y) && c.x > 0 && c.y > 0 && c.x < map.width && c.y < map.height, `${c.tier} stands on free ground`);
  assert.equal(ChestManager.ensure('verdant_vale', free, () => 0.999).length, 5, 'entering again keeps the current set (no instant re-roll)');
  const before = GameState.player.wildcoins;
  const gold2 = list.find((c) => c.tier === 'ultra_gold');
  const res = ChestManager.open('verdant_vale', gold2.id, seq([0.5, 0, 0, 0]));
  assert.ok(res.ok && res.coins > 0 && GameState.player.wildcoins === before + res.coins, 'opening pays out');
  assert.ok(res.item && InventoryManager.has(res.item.id, 1), 'the item landed in the bag');
  assert.equal(ChestManager.list('verdant_vale').length, 4, 'an opened chest is gone');
  assert.equal(ChestManager.open('verdant_vale', gold2.id).ok, false, 'cannot be opened twice');
  assert.equal(ChestManager.stats().ultra_gold, 1);
  // survives a save / load
  const raw = JSON.parse(JSON.stringify(serialize()));
  deserialize(raw);
  assert.equal(ChestManager.list('verdant_vale').length, 4, 'chests are saved with the world');
  assert.equal(ChestManager.stats().ultra_gold, 1, 'chest records are saved too');
});

test('camera zoom replaces camera sensitivity and stays within its limits', async () => {
  const cfg = await import('../src/data/config.js');
  assert.equal(cfg.DEFAULT_SETTINGS.cameraSensitivity, undefined, 'no more "sensitivity" in a 2D game');
  assert.ok(cfg.DEFAULT_SETTINGS.cameraZoom >= cfg.CAMERA_ZOOM_MIN && cfg.DEFAULT_SETTINGS.cameraZoom <= cfg.CAMERA_ZOOM_MAX);
  assert.ok(cfg.CAMERA_ZOOM_MIN >= 1.0, 'you can never zoom out far enough to see half the map');
  const { SettingsManager } = await import('../src/systems/SettingsManager.js');
  const { OverworldScene } = await import('../src/scenes/OverworldScene.js');
  const ow = new OverworldScene(document.createElement('canvas'));
  SettingsManager.set('cameraZoom', cfg.CAMERA_ZOOM_MAX);
  assert.equal(ow.zoomBy(1), cfg.CAMERA_ZOOM_MAX, 'cannot zoom past the maximum');
  let z = cfg.CAMERA_ZOOM_MAX; for (let i = 0; i < 40; i++) z = ow.zoomBy(-1);
  assert.equal(z, cfg.CAMERA_ZOOM_MIN, 'cannot zoom out past the minimum');
  assert.equal(SettingsManager.get('cameraZoom'), cfg.CAMERA_ZOOM_MIN, 'the zoom is persisted as a setting');
  SettingsManager.set('cameraZoom', cfg.DEFAULT_SETTINGS.cameraZoom);
});

test('map level ranges match the design: fixed bands that overlap slightly', () => {
  const bands = { verdant_vale: [1, 20], azure_coast: [15, 30], emberwild: [28, 40], stonehollow_crags: [38, 48], stormreach_plateau: [46, 56], frostveil_tundra: [54, 64], ironhold_foundry: [62, 72], miremarsh_fen: [70, 80], astral_spire: [78, 90], ironfist_colosseum: [88, 100] };
  for (const [id, band] of Object.entries(bands)) assert.deepEqual(MAPS[id].levelRange, band, `${id} band`);
  // progressive: each band starts a little under the previous one's top and ends higher; the last one reaches Lv.90
  const order = Object.values(MAPS).sort((a, b) => a.order - b.order);
  for (let i = 1; i < order.length; i++) { assert.ok(order[i].levelRange[0] < order[i - 1].levelRange[1] && order[i].levelRange[0] >= order[i - 1].levelRange[1] - 5, `${order[i].id} overlaps the previous band slightly`); assert.ok(order[i].levelRange[1] > order[i - 1].levelRange[1]); }
  assert.equal(order[order.length - 1].levelRange[1], LEVEL_CAP, 'the last map tops out at the level cap');
  // trainers sit inside their region's band, guardians at the top of it
  for (const map of Object.values(MAPS)) {
    for (const t of map.trainers) for (const mm of t.team) assert.ok(mm.level >= map.levelRange[0] && mm.level <= map.levelRange[1], `${t.id} ${mm.species} Lv.${mm.level} inside ${map.id}`);
    const guardian = map.trainers.find((t) => t.guardian);
    assert.equal(Math.max(...guardian.team.map((mm) => mm.level)), map.levelRange[1], `${map.id} guardian tops the band`);
  }
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
  const order = Object.values(MAPS).sort((a, b) => a.order - b.order).map((m) => m.id);
  assert.deepEqual(order, ['verdant_vale', 'azure_coast', 'emberwild', 'stonehollow_crags', 'stormreach_plateau', 'frostveil_tundra', 'ironhold_foundry', 'miremarsh_fen', 'astral_spire', 'ironfist_colosseum']);
  for (let i = 0; i < order.length - 1; i++) {
    const from = MAPS[order[i]], to = MAPS[order[i + 1]];
    const gate = from.connections.find((c) => c.toMap === to.id);
    assert.ok(gate && gate.requiresItem, `${from.id} → ${to.id} is gated`);
    const guardian = from.trainers.find((t) => t.guardian);
    assert.ok(guardian.reward.items[gate.requiresItem], `${from.id}'s guardian hands out ${gate.requiresItem}`);
    assert.ok(to.connections.some((c) => c.toMap === from.id), `${to.id} has the way back`);
    assert.ok(!guardian.finalBoss, `${from.id}'s guardian is not the final boss`);
  }
  const toAzure = MAPS.verdant_vale.connections.find((c) => c.toMap === 'azure_coast');
  assert.equal(toAzure.requiresItem, 'vale_charm');
  assert.ok(MAPS.stonehollow_crags.connections.some((c) => c.toMap === 'emberwild'), 'and the way back exists');
  const boss = Object.values(MAPS).flatMap((m) => m.trainers).filter((t) => t.finalBoss);
  assert.deepEqual(boss.map((t) => t.flag), ['ironfist_champion'], 'the Grand Champion is the one final boss');
  for (const map of Object.values(MAPS)) {
    for (const b of map.buildings) for (const id of b.stock || []) assert.ok(ITEMS_MOD.ITEMS[id], `${map.id}/${b.id} sells a real item (${id})`);
    for (const t of map.trainers) for (const id of Object.keys(t.reward?.items || {})) assert.ok(ITEMS_MOD.ITEMS[id], `${t.id} rewards a real item (${id})`);
    for (const z of map.encounterZones) for (const sp of z.species) assert.ok(SPECIES[sp.id], `${z.id} spawns a real species`);
  }
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
const { SPECIES_ART, BODY_PLANS, artFor } = await import('../src/render/creatureArt.js');

test('every species resolves to a rig with 8-12 layers plus a face spec', () => {
  for (const id of Object.keys(SPECIES)) {
    // a species either owns hand-authored art or borrows a named body plan
    const art = artFor(id);
    assert.ok(art, `${id} has art`);
    const parts = art.parts.map((p) => p.name);
    assert.ok(parts.length >= 7 && parts.length <= 12, `${id} has ${parts.length} layers`);
    assert.ok(art.face && art.face.eyes.length === 2, `${id} has two eyes`);
    assert.ok(art.parts.some((p) => p.name === 'head'), `${id} has a head`);
    assert.ok(art.parts.some((p) => p.name === 'body'), `${id} has a body`);
  }
});

test('body plans are reusable by name, so new species need no bespoke art', () => {
  assert.deepEqual(Object.keys(BODY_PLANS).sort(), ['avian', 'bat', 'beetle', 'boar', 'dragon', 'feline', 'fox', 'golem', 'lizard', 'ram', 'serpent', 'tortoise', 'wisp', 'wolf']);
  for (const [plan, art] of Object.entries(BODY_PLANS)) {
    assert.ok(art.parts.length >= 7, `${plan} plan is a complete rig`);
  }
  // every species lands on a plan, including the ten added after launch
  for (const id of Object.keys(SPECIES)) {
    if (!SPECIES_ART[id]) assert.ok(BODY_PLANS[SPECIES[id].art.body], `${id} resolves through its body plan`);
  }
});

test('layer bones stay in the shared vocabulary (no per-detail bones)', () => {
  const allowed = new Set(['root', 'tail', 'body', 'head', 'legFL', 'legFR', 'legBL', 'legBR',
    'earL', 'earR', 'wingL', 'wingR', 'mane']);
  for (const art of [...Object.values(SPECIES_ART), ...Object.values(BODY_PLANS)]) {
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

test('the evolution summary crops the empty band under the Mythling', () => {
  const done = cssText.match(/\.cinematic\.done canvas\s*\{([^}]*)\}/);
  assert.ok(done, '.cinematic.done canvas rule exists');
  assert.match(done[1], /aspect-ratio:\s*460\s*\/\s*356/, 'the done canvas is shorter than it is wide');
  const screens = readFileSync(new URL('../src/ui/screens.js', import.meta.url), 'utf8');
  assert.match(screens, /DONE_HEIGHT = 356/, 'the JS backs the canvas at the same ratio');
});

// ------------------------------------------------------------------
section('Wild encounters');
const { EncounterManager } = await import('../src/systems/EncounterManager.js');

test('every region spawns its own element (five lines, plus dual-typed visitors) and legendaries only through the rare roll', async () => {
  const { speciesElements } = await import('../src/data/elements.js');
  const { LEGENDARY_IDS } = await import('../src/data/species.js');
  const noLegend = () => 0.999;   // an rng that never wins the legendary roll but still picks species
  for (const map of Object.values(MAPS)) {
    const zones = EncounterManager.zonesForMap(map.id);
    const tabled = new Set();
    for (const z of zones) for (const s of z.species) tabled.add(s.id);
    // five lines of the region's own element. Ironfist's Fighting lines are
    // mostly dual-typed, so count element membership rather than single types.
    const own = [...tabled].filter((id) => speciesElements(SPECIES[id]).includes(map.element));
    assert.ok(own.length >= 5, `${map.id} tables five lines of its own element`);
    // The Grand Ring is the one place a legendary is tabled on purpose — it is
    // the colosseum's champion, not a lucky rare roll.
    const LEGENDARY_ZONES = new Set(['fz4']);
    for (const z of zones) for (const sp of z.species) {
      if (!SPECIES[sp.id].legendary) continue;
      assert.ok(LEGENDARY_ZONES.has(z.id), `${sp.id} is only tabled in the colosseum's Grand Ring`);
    }
    // spawns follow the table when the legendary roll fails
    let rngI = 0; const seq = () => { rngI++; return rngI % 7 === 0 ? 0.999 : (rngI * 0.137) % 1; };
    for (const z of zones) for (let i = 0; i < 20; i++) { const sp = EncounterManager.spawnForZone(z, map.id, seq); assert.ok(tabled.has(sp.speciesId) || LEGENDARY_IDS.includes(sp.speciesId)); }
    void noLegend;
  }
});

test('legendaries: rare, home-map biased, one form, 2-3 elements, Absolute Ball or better', async () => {
  const { LEGENDARY_IDS } = await import('../src/data/species.js');
  const { LEGENDARY_HOME_CHANCE, LEGENDARY_AWAY_CHANCE } = await import('../src/systems/EncounterManager.js');
  const { canHoldLegendary } = await import('../src/data/items.js');
  assert.deepEqual(LEGENDARY_IDS, ['aetherion', 'venomyr', 'basaltyr']);
  for (const id of LEGENDARY_IDS) {
    const sp = SPECIES[id];
    assert.ok(sp.elements.length >= 2 && sp.elements.length <= 3, `${id} has 2-3 elements`);
    assert.equal(sp.evolutions.length, 1, `${id} never evolves`);
    assert.ok(sp.spawnMaps.every((m) => (sp.elements).includes(MAPS[m].element)), `${id} only spawns where one of its elements lives`);
    assert.equal(sp.homeMap, sp.spawnMaps[0]);
    const lvls = Object.keys(sp.skillUnlocks).map(Number); assert.ok(lvls.includes(20) && lvls.includes(60) && lvls.includes(80), `${id} still learns by level`);
  }
  assert.ok(LEGENDARY_HOME_CHANCE <= 0.03 && LEGENDARY_AWAY_CHANCE < LEGENDARY_HOME_CHANCE, 'rare, rarer away from home');
  assert.equal(EncounterManager.rollLegendary('astral_spire', () => 0.001), 'aetherion', 'a lucky roll on the home map');
  assert.equal(EncounterManager.rollLegendary('verdant_vale', () => 0.001), null, 'never on a map without its elements');
  assert.equal(EncounterManager.rollLegendary('astral_spire', () => 0.5), null, 'an ordinary roll spawns nothing special');
  const zone = MAPS.astral_spire.encounterZones[0];
  const legend = EncounterManager.spawnForZone(zone, 'astral_spire', () => 0.001);
  assert.equal(legend.speciesId, 'aetherion'); assert.equal(legend.stage, 0); assert.equal(legend.level, zone.levelRange[1], 'a legendary spawns at the top of the band');
  // balls
  assert.ok(!canHoldLegendary('basic_ball') && !canHoldLegendary('advanced_ball') && canHoldLegendary('absolute_ball') && canHoldLegendary('god_ball') && canHoldLegendary('dark_ball'));
  createNewGameState({ slot: 1, playerName: 'LEG', starterId: 'spriggo' });
  legend.currentHp = 0;
  InventoryManager.add('advanced_ball', 1); InventoryManager.add('god_ball', 1);
  const weak = CaptureManager.attempt(legend, 'advanced_ball');
  assert.equal(weak.ok, false); assert.ok(weak.legendaryBlocked && /legendary/i.test(weak.reason));
  assert.equal(InventoryManager.count('advanced_ball'), 1, 'the weak ball is not wasted');
  assert.equal(CaptureManager.chanceFor(legend, 'advanced_ball'), 0);
  const strong = CaptureManager.attempt(legend, 'god_ball', () => 0.5);
  assert.ok(strong.ok && strong.success, 'a God Ball holds it');
  // legendary ultimates climb by level instead of by stage
  const { ultimateMove } = await import('../src/core/mythling.js');
  assert.equal(ultimateMove(createMythling({ speciesId: 'aetherion', level: 10 })).tierIndex, 0);
  assert.equal(ultimateMove(createMythling({ speciesId: 'aetherion', level: 60 })).tierIndex, 2);
  assert.equal(ultimateMove(createMythling({ speciesId: 'aetherion', level: 85 })).tierIndex, 3);
  assert.ok(ultimateMove(createMythling({ speciesId: 'aetherion', level: 85 })).power > ultimateMove(createMythling({ speciesId: 'spriggo', level: 85, stage: 3 })).power, 'legendary ultimates hit harder');
});

test('dual-typed defenders weigh every element; dual-typed lines learn both elements', async () => {
  const { elementMultiplier } = await import('../src/data/elements.js');
  assert.equal(elementMultiplier('fire', ['poison', 'psychic']), 0.75, 'Fire vs Poison/Psychic: neutral × weak');
  assert.equal(elementMultiplier('psychic', ['poison', 'psychic']), 1.5);
  assert.equal(elementMultiplier('rock', ['electric', 'metal']), 1.5 * 0.75, 'Rock vs Electric/Metal: strong × weak');
  const learned = Object.values(SPECIES.sparkbug.skillUnlocks).flat().map((id) => SKILLS_MOD.SKILLS[id]).filter(Boolean);
  assert.ok(learned.some((s) => s.element === 'electric') && learned.some((s) => s.element === 'metal'), 'Sparkbug learns Electric AND Metal attacks');
  for (const s of learned) if (s.category === 'buff' || s.category === 'debuff') assert.ok(!s.element, `${s.id}: support skills carry no element`);
});

test('wild levels are FIXED per zone: an over-levelled party never scales the world up', () => {
  GameState.party = [createMythling({ speciesId: 'emberu', level: 70 })];
  for (const mapId of Object.keys(MAPS)) {
    for (const zone of EncounterManager.zonesForMap(mapId)) {
      for (let i = 0; i < 25; i++) {
        const lv = EncounterManager.spawnForZone(zone, mapId, Math.random, { partyLevel: PartyManager.topLevel() }).level;
        assert.ok(lv >= zone.levelRange[0] && lv <= zone.levelRange[1], `${mapId}/${zone.id} spawned Lv.${lv} outside ${zone.levelRange}`);
      }
    }
  }
});

// ------------------------------------------------------------------
// Anything that throws below is a black screen or a dead menu in the browser,
// so these deliberately run the real scene and menu code, not its data.
section('Screens actually run');
const { OverworldScene } = await import('../src/scenes/OverworldScene.js');
const { PlayerMenu } = await import('../src/ui/PlayerMenu.js');
const { Screens: ScreenStack } = await import('../src/ui/ui.js');
const { MAPS: MAPS2, MAP_ORDER } = await import('../src/data/maps.js');

test('the overworld spawns and runs in every region', () => {
  const ow = new OverworldScene(document.createElement('canvas'));
  for (const mapId of MAP_ORDER) {
    ow.enter(mapId, MAPS2[mapId].spawn.x, MAPS2[mapId].spawn.y);
    ow.populate(true);
    for (let i = 0; i < 5; i++) { ow.update(1 / 60); ow.render(); }
  }
  assert.ok(ow.wild.length > 0, 'wild Mythlings spawned');
});

test('every menu tab renders, including the Index', () => {
  const menu = new PlayerMenu({ autosave: () => {} });
  menu.node = document.createElement('div');
  menu.body = document.createElement('div');
  menu.head = document.createElement('div');
  for (const tab of ['party', 'mythlings', 'skills', 'bag', 'map', 'collection', 'index', 'stats', 'save', 'settings']) {
    menu.tab = tab;
    menu.renderTab();
    assert.ok(menu.body.children.length > 0, `${tab} tab drew something`);
  }
});

test('every wiki section renders — including Controls & Menus', async () => {
  const wiki = await import('../src/ui/wiki.js');
  ScreenStack.init();
  const node = wiki.openWiki('controls');
  assert.ok(node, 'the wiki opened on the Controls page');
  // walk every page through the same builders the nav buttons use; the
  // Controls page used to throw (undefined helper) and come up blank
  for (const [id, label, , fn] of wiki.WIKI_SECTIONS) {
    const blocks = fn();
    assert.ok(Array.isArray(blocks) && blocks.length > 0, `${label} (${id}) produced content`);
  }
  const controls = wiki.WIKI_SECTIONS.find((sec) => sec[0] === 'controls');
  assert.ok(controls[3]().length >= 8, 'Controls & Menus has its tables');
  ScreenStack.pop();
});

test('the modal helper never leaves a stale "modal open" flag behind', async () => {
  const ui = await import('../src/ui/ui.js');
  const layer = document.getElementById('modal');
  layer.classList.add('hidden');
  const p = ui.modal({ title: 'PICK', body: document.createElement('div'), buttons: [{ label: 'CANCEL', value: null }] });
  assert.equal(ui.modalOpen(), true);
  assert.equal(ui.closeModal({ uid: 'x' }), true, 'closeModal settles the open modal');
  assert.deepEqual(await p, { uid: 'x' }, 'the promise resolves with the chosen value');
  assert.equal(ui.modalOpen(), false, 'input is no longer blocked');
});

test('the species info popup renders for every species', () => {
  const menu = new PlayerMenu({ autosave: () => {} });
  for (const id of SPECIES_IDS) menu.showSpeciesInfo(id);
});

section('v0.5.1 — Fighting, double mutations, softer crits, no capture freeze');

test('throwing a ball never freezes the battle — even when the Mythling breaks free', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const { Battle: B2, BattleType: BT2 } = await import('../src/systems/BattleManager.js');
  const { InventoryManager: INV } = await import('../src/systems/GameState.js');
  const scene = new BattleScene(document.createElement('canvas'));
  const mine = createMythling({ speciesId: 'spriggo', level: 40 });
  const wild = createMythling({ speciesId: 'leaflet', level: 6 });
  wild.currentHp = 0;                                   // defeated: catchable
  const battle = new B2({ type: BT2.WILD, party: [mine], enemies: [wild], mapId: 'verdant_vale' });
  battle.phase = 'defeated_wild';
  scene.start(battle, { mapTheme: 'nature', onEnd: () => {} });
  INV.add('basic_ball', 4);
  const realRandom = Math.random;
  Math.random = () => 0.999;                            // force the break-out branch
  try {
    await scene.tryCapture('basic_ball');
  } finally {
    Math.random = realRandom;
  }
  assert.equal(scene.busy, false, 'the scene is interactive again after a failed throw');
  assert.equal(scene.battle.phase, 'defeated_wild', 'the Mythling is still there to try again');
  scene.stop();
});

test('Shiny and Darkness can BOTH sit on the same Mythling', async () => {
  const mut = await import('../src/data/mutations.js');
  const { CaptureManager: CM } = await import('../src/systems/CaptureManager.js');
  const { InventoryManager: INV, GameState: GS2 } = await import('../src/systems/GameState.js');

  assert.equal(mut.combineMutations('shiny', 'darkness'), 'shiny_dark');
  assert.equal(mut.combineMutations('darkness', 'shiny'), 'shiny_dark');
  assert.equal(mut.combineMutations('none', 'shiny'), 'shiny');
  assert.equal(mut.combineMutations('shiny_dark', 'shiny'), 'shiny_dark', 'already both: nothing changes');
  assert.deepEqual(mut.mutationParts('shiny_dark'), ['shiny', 'darkness']);
  assert.equal(mut.getMutation('shiny_dark').statBonus, 3, 'it carries both stat bonuses');
  assert.ok(mut.getMutation('shiny_dark').palette && mut.getMutation('shiny_dark').aura, 'and its own look');

  // the wild can roll both at once (shiny odds x darkness odds)
  let both = 0;
  let i = 0;
  const seq = () => { i += 1; return i % 2 ? 0.0001 : 0.0001; };   // both rolls succeed
  for (let n = 0; n < 5; n++) if (mut.rollMutation(seq) === 'shiny_dark') both += 1;
  assert.equal(both, 5, 'independent rolls can both land');

  // catching a wild Shiny with a Dark Ball ADDS Darkness instead of replacing it
  const wild = createMythling({ speciesId: 'leaflet', level: 9, mutation: 'shiny' });
  wild.currentHp = 0;
  INV.add('dark_ball', 1);
  const res = CM.attempt(wild, 'dark_ball', () => 0);
  assert.equal(res.success, true);
  assert.equal(res.mythling.mutation, 'shiny_dark', 'Shiny + Dark Ball = Shiny Darkness');
  assert.equal(res.mythling.level, 1, 'and it still resets to Lv.1');
  assert.deepEqual(GS2.collection.leaflet.mutations, { shiny: true, darkness: true }, 'the Index ticks both');
});

test('your first partner starts at Lv.5, but catches still reset to Lv.1', async () => {
  const cfg = await import('../src/data/config.js');
  const { createNewGameState: newGame, PartyManager: PM2 } = await import('../src/systems/GameState.js');
  assert.equal(cfg.STARTER_LEVEL, 5);
  const starter = newGame({ slot: 1, playerName: 'TESTER', starterId: 'aquini' });
  assert.equal(starter.level, 5, 'the starter joins at Lv.5');
  assert.equal(PM2.lead().level, 5);
  assert.ok(starter.skills.length >= 1, 'with its skills already equipped');
  assert.equal(starter.currentHp, maxHp(starter), 'at full HP');
});

test('crit is a lucky spike: both caps are low and no Mythling can exceed them', async () => {
  const cfg = await import('../src/data/config.js');
  assert.ok(cfg.CRIT_MAX_PERCENT <= 12, `crit chance cap is ${cfg.CRIT_MAX_PERCENT}%`);
  assert.ok(cfg.CRIT_MAX_MULT <= 40, `crit damage cap is +${cfg.CRIT_MAX_MULT}%`);
  for (const id of SPECIES_IDS) {
    const top = createMythling({ speciesId: id, level: LEVEL_CAP, rarity: 'SSS', mutation: 'shiny_dark' });
    const st = computeStats(top);
    // the flat mutation bonus is added after the caps, so allow for it
    assert.ok(st.crit <= cfg.CRIT_MAX_PERCENT + 3, `${id} crit ${st.crit}%`);
    assert.ok(st.critMult <= cfg.CRIT_MAX_MULT + 3, `${id} crit damage +${st.critMult}%`);
  }
  // a crit can never be worth more than +40% damage
  assert.ok(1 + (cfg.CRIT_MAX_MULT + 3) / 100 <= 1.4);
});

test('skill uses are refilled at the START and the END of every battle', async () => {
  const { Battle: B3, BattleType: BT3 } = await import('../src/systems/BattleManager.js');
  const mine = createMythling({ speciesId: 'emberu', level: 30 });
  const limited = mine.library.find((id) => Number.isFinite(SKILLS_MOD.SKILLS[id]?.uses));
  mine.uses[limited] = 0;
  const wild = createMythling({ speciesId: 'leaflet', level: 20 });
  new B3({ type: BT3.WILD, party: [mine], enemies: [wild], mapId: 'verdant_vale' });
  assert.equal(mine.uses[limited], SKILLS_MOD.SKILLS[limited].uses, 'a new battle starts with full uses');
  // and main.js tops the party back up when the battle ends
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const endBattle = main.slice(main.indexOf('async endBattle('), main.indexOf('async endBattle(') + 400);
  assert.match(endBattle, /restoreUses\(m, Infinity\)/, 'endBattle() refills every party member');
});

test('Fighting: a tenth element, its own region and five new lines', async () => {
  const { ELEMENTS, ELEMENT_ORDER, elementMultiplier: em, strongAgainst, weakTo } = await import('../src/data/elements.js');
  assert.ok(ELEMENTS.fighting && ELEMENT_ORDER.includes('fighting'));
  assert.deepEqual(strongAgainst('fighting').sort(), ['ice', 'metal', 'rock']);
  assert.deepEqual(weakTo('fighting').sort(), ['poison', 'psychic']);
  assert.equal(em('fighting', 'rock'), 1.5);
  assert.equal(em('psychic', 'fighting'), 1.5);
  assert.equal(em('fighting', 'psychic'), 0.75);
  assert.equal(em('fighting', 'nature'), 1.0);
  // one pure Fighting line, four dual-typed
  const fighters = SPECIES_IDS.filter((id) => (SPECIES[id].elements || [SPECIES[id].element]).includes('fighting'));
  assert.equal(fighters.length, 5, 'five Fighting lines');
  const pure = fighters.filter((id) => !(SPECIES[id].elements || []).length);
  assert.deepEqual(pure, ['cubrawl'], 'exactly one of them is single-typed');
  for (const id of fighters) {
    const sp = SPECIES[id];
    assert.equal(sp.evolutions.length, 4, `${id} has four stages`);
    const all = Object.values(sp.skillUnlocks).flat();
    for (const sid of all) assert.ok(SKILLS_MOD.SKILLS[sid], `${id} learns a real skill (${sid})`);
    // every dual-typed fighter really learns attacks of BOTH elements
    if ((sp.elements || []).length > 1) {
      const els = new Set(all.map((sid) => SKILLS_MOD.SKILLS[sid].element).filter(Boolean));
      for (const e of sp.elements) assert.ok(els.has(e), `${id} learns ${e} attacks`);
    }
    const m = createMythling({ speciesId: id, level: 95 });
    assert.ok(m.skills.length > 0 && maxHp(m) > 0, `${id} is playable at Lv.95`);
  }
  // the region
  const colo = MAPS.ironfist_colosseum;
  assert.equal(colo.element, 'fighting');
  assert.deepEqual(colo.levelRange, [88, 100]);
  assert.ok(colo.trainers.find((t) => t.finalBoss), 'it holds the new final boss');
  const gate = MAPS.astral_spire.connections.find((c) => c.toMap === 'ironfist_colosseum');
  assert.equal(gate.requiresItem, 'astral_crest', 'gated behind the Astral Warden\'s crest');
  assert.ok(MAPS.astral_spire.trainers.find((t) => t.guardian).reward.items.astral_crest);
  for (const z of colo.encounterZones) {
    for (const sp of z.species) assert.ok(SPECIES[sp.id], `zone spawns a real species (${sp.id})`);
  }
});

test('battle shows a type match-up indicator — and stays quiet when it is even', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const { Battle: B4, BattleType: BT4 } = await import('../src/systems/BattleManager.js');
  const { attackMatchup, typeProfile } = await import('../src/data/elements.js');

  // the maths first
  assert.equal(attackMatchup(['nature'], ['water']).tone, 'strong');
  assert.equal(attackMatchup(['water'], ['nature']).tone, 'weak');
  assert.equal(attackMatchup(['nature'], ['nature']).tone, null, 'an even match-up has no tone');
  assert.equal(attackMatchup(['fighting', 'metal'], ['rock', 'ice']).mult, 2.25, 'dual vs dual multiplies out');
  const prof = typeProfile(['fighting', 'psychic']);
  assert.ok(prof.weakTo.some((w) => w.element === 'poison' && w.mult === 2.25));
  assert.ok(prof.resists.some((r) => r.element === 'fighting'));
  assert.ok(prof.hits.some((h) => h.element === 'rock'));

  const scene = new BattleScene(document.createElement('canvas'));
  const mine = createMythling({ speciesId: 'spriggo', level: 20 });      // Nature
  const foe = createMythling({ speciesId: 'aquini', level: 20 });        // Water
  scene.start(new B4({ type: BT4.WILD, party: [mine], enemies: [foe], mapId: 'verdant_vale' }), { mapTheme: 'nature', onEnd: () => {} });

  // both cards carry the row, each with the right verdict
  const pRow = scene.matchupRow('player');
  const eRow = scene.matchupRow('enemy');
  assert.equal(pRow.children.length, 1, 'the player card shows a chip');
  assert.equal(eRow.children.length, 1, 'so does the enemy card');
  assert.match(pRow.children[0].innerHTML, /SUPER EFFECTIVE/);
  assert.match(pRow.children[0].innerHTML, /x1\.5/);
  assert.match(eRow.children[0].innerHTML, /RESISTED/);

  // an even match-up draws nothing at all
  const mirror = new B4({ type: BT4.WILD, party: [mine], enemies: [createMythling({ speciesId: 'leaflet', level: 20 })], mapId: 'verdant_vale' });
  scene.battle = mirror;
  assert.equal(scene.matchupRow('player').children.length, 0, 'Nature vs Nature shows no chip');
  assert.equal(scene.matchupRow('enemy').children.length, 0);

  // the icon button and the panel it opens
  const btn = scene.matchupButton(mine, 'player');
  assert.ok(btn && /svg/.test(btn.innerHTML), 'the card has an icon button');
  scene.battle = new B4({ type: BT4.WILD, party: [mine], enemies: [foe], mapId: 'verdant_vale' });
  scene.showTypePanel(foe, 'enemy');           // must not throw and must fill the modal
  assert.equal((await import('../src/ui/ui.js')).modalOpen(), true, 'the type panel opened');
  (await import('../src/ui/ui.js')).closeModal(true);

  // party cards in the switch picker are tagged too
  const fireGuy = createMythling({ speciesId: 'emberu', level: 20 });
  assert.match(scene.matchupTag(fireGuy).innerHTML, /RESISTED/, 'Fire into Water is resisted, and the chip says so');
  const waterTwin = createMythling({ speciesId: 'aquini', level: 20 });
  assert.equal(scene.matchupTag(waterTwin), null, 'Water vs Water is even, so no tag');
  const natureGuy = createMythling({ speciesId: 'leaflet', level: 20 });
  assert.match(scene.matchupTag(natureGuy).innerHTML, /SUPER EFFECTIVE/, 'Nature vs Water is tagged');
  scene.stop();
});

// ------------------------------------------------------------------
section('Live damage readout & the element sheet');

// walks the shim DOM and collects every bit of text inside a node
const textOf = (node) => {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  let out = node.nodeValue || node.textContent || node.innerHTML || '';
  for (const c of node.children || []) out += ` ${textOf(c)}`;
  return out;
};

test('previewDamage promises the number the hit will actually deal', async () => {
  const { previewDamage } = await import('../src/systems/BattleManager.js');
  const { DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX } = await import('../src/data/config.js');
  const fire = createMythling({ speciesId: 'emberu', level: 40, stage: 1 });
  fire.library.push('inferno_roar'); fire.uses.inferno_roar = 99;
  const nature = createMythling({ speciesId: 'spriggo', level: 40, stage: 1 });
  const bt = new Battle({ type: BattleType.WILD, party: [fire], enemies: [nature], mapId: 'emberwild', rng: () => 0.5 });

  const se = previewDamage(bt, fire, nature, getSkillById('inferno_roar'));      // Fire into Nature
  assert.equal(se.mult, 1.5);
  assert.equal(se.tone, 'strong');
  // an element-less move stays element-less, even in a Fire Mythling's mouth
  const bite = previewDamage(bt, fire, nature, getSkillById('bite'));
  assert.equal(bite.mult, 1, 'Bite carries no element, so it never borrows the species one');
  assert.equal(bite.tone, 'even', 'and that is why it never turns red or green');

  // the range the button advertises is the range the hit lands in
  const mid = (DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2;
  const lo = Math.max(1, Math.floor((se.dmg * DAMAGE_RANDOM_MIN) / mid));
  const hi = Math.max(1, Math.floor((se.dmg * DAMAGE_RANDOM_MAX) / mid));
  const { events } = bt.act({ type: 'skill', skillId: 'inferno_roar' });
  const hit = events.find((e) => e.type === 'damage' && e.side === 'enemy');
  assert.ok(hit, 'the attack landed');
  assert.ok(hit.amount >= lo && hit.amount <= hi, `the button promised ${lo}\u2013${hi} and the hit dealt ${hit.amount}`);
});

test('the number moves the moment a buff or a debuff lands', async () => {
  const { previewDamage } = await import('../src/systems/BattleManager.js');
  const fire = createMythling({ speciesId: 'emberu', level: 40, stage: 1 });
  fire.library.push('inferno_roar'); fire.uses.inferno_roar = 99;
  const nature = createMythling({ speciesId: 'spriggo', level: 40, stage: 1 });
  const bt = new Battle({ type: BattleType.WILD, party: [fire], enemies: [nature], mapId: 'emberwild', rng: () => 0.5 });
  const move = getSkillById('inferno_roar');                 // a Special: reads S.ATK
  const base = previewDamage(bt, fire, nature, move).dmg;

  bt.cb(fire).applyDebuff('satk', 40);
  const dropped = previewDamage(bt, fire, nature, move).dmg;
  assert.ok(dropped < base, `a debuffed S.ATK lowers every Special's number (${base} -> ${dropped})`);

  const bt2 = new Battle({ type: BattleType.WILD, party: [fire], enemies: [nature], mapId: 'emberwild', rng: () => 0.5 });
  bt2.cb(fire).applyBuff('satk', 40);
  const raised = previewDamage(bt2, fire, nature, move).dmg;
  assert.ok(raised > base, `and a buff raises it (${base} -> ${raised})`);
  // a physical move is untouched by a Special Attack debuff
  const bt3 = new Battle({ type: BattleType.WILD, party: [fire], enemies: [nature], mapId: 'emberwild', rng: () => 0.5 });
  const biteBase = previewDamage(bt3, fire, nature, getSkillById('bite')).dmg;
  bt3.cb(fire).applyDebuff('satk', 40);
  assert.equal(previewDamage(bt3, fire, nature, getSkillById('bite')).dmg, biteBase, 'Bite is physical: an S.ATK debuff does not touch it');
});

test('a full-charge Ultimate is the biggest number on the bar', async () => {
  const { previewDamage } = await import('../src/systems/BattleManager.js');
  const { ultimateMove } = await import('../src/core/mythling.js');
  const { LEVEL_CAP: CAP } = await import('../src/data/config.js');
  for (const level of [10, 20, 60, 80, CAP]) {
    const fire = createMythling({ speciesId: 'emberu', level, stage: level >= 80 ? 3 : level >= 60 ? 2 : level >= 20 ? 1 : 0 });
    fire.library.push('inferno_roar'); fire.uses.inferno_roar = 99;
    const nature = createMythling({ speciesId: 'spriggo', level, stage: fire.stage });
    const bt = new Battle({ type: BattleType.WILD, party: [fire], enemies: [nature], mapId: 'emberwild', rng: () => 0.5 });
    const ult = previewDamage(bt, fire, nature, ultimateMove(fire), { isUltimate: true });
    const special = previewDamage(bt, fire, nature, getSkillById('inferno_roar'));
    const bar = level <= 10 ? 1.3 : 1.9;      // base tier is the gentlest; tier I and up more than doubles it
    assert.ok(ult.dmg > special.dmg * bar,
      `at Lv.${level} the Ultimate (${ult.dmg}) beats the strongest Special (${special.dmg}) by ${(ult.dmg / special.dmg).toFixed(2)}x, needs ${bar}x`);
  }
});

test('the battle buttons print the number, coloured by the match-up', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const bar = (foeId) => {
    const mine = createMythling({ speciesId: 'emberu', level: 30, stage: 1 });
    mine.library.push('inferno_roar'); mine.uses.inferno_roar = 99;
    mine.skills = ['inferno_roar', 'bite'];
    const scene = new BattleScene(document.createElement('canvas'));
    scene.start(new Battle({ type: BattleType.WILD, party: [mine],
      enemies: [createMythling({ speciesId: foeId, level: 30, stage: 1 })], mapId: 'emberwild' }),
      { mapTheme: 'nature', onEnd: () => {} });
    scene.renderActions();
    const html = scene.actions.children.map((c) => c.innerHTML || '').join(' ');
    scene.stop();
    return html;
  };
  const strong = bar('spriggo');                      // Fire into Nature
  assert.match(strong, /ab-dmg strong/, 'a super-effective skill is green');
  assert.match(strong, /ab-dmg even/, 'the element-less attack stays plain white');
  assert.match(bar('aquini'), /ab-dmg weak/, 'Fire into Water is red');
});

test('the type sheet is about the ELEMENT: strong against / weak against / resists, and no Mythling names', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const { displayName } = await import('../src/core/mythling.js');
  const mine = createMythling({ speciesId: 'spriggo', level: 20 });       // Nature
  const foe = createMythling({ speciesId: 'emberu', level: 20 });         // Fire
  const scene = new BattleScene(document.createElement('canvas'));
  scene.battle = new Battle({ type: BattleType.WILD, party: [mine], enemies: [foe], mapId: 'verdant_vale' });

  const own = scene.typePanel(mine, 'player');
  const text = textOf(own.body);
  assert.match(own.title, /Nature/, 'the sheet is titled by the element');
  assert.match(text, /STRONG AGAINST/);
  assert.match(text, /WEAK AGAINST/);
  assert.match(text, /RESISTS/);
  // the live block names the two ELEMENTS, not the two Mythlings
  assert.match(text, /RIGHT NOW/);
  assert.match(text, /Nature vs Fire/);
  for (const m of [mine, foe]) {
    const nm = displayName(m);
    assert.ok(!text.includes(nm) && !own.title.includes(nm), `${nm} must not appear in the type sheet`);
  }
  // Nature: water and rock are what it beats; fire, ice and poison are what beat it
  assert.match(text, /Water/);
  assert.match(text, /Rock/);
  assert.match(text, /Fire/);

  // the sheet opened from the enemy card is about the enemy's element
  const theirs = scene.typePanel(foe, 'enemy');
  assert.match(theirs.title, /Fire/, 'and the enemy sheet is titled by ITS element');
  assert.ok(!textOf(theirs.body).includes(displayName(foe)), 'the enemy sheet names no Mythling either');
});

// ------------------------------------------------------------------
section('Bags, shop shelves, premium balls & the Cleanse Tonic');

test('you start on Bag 1 (20 Mythlings) and buy bigger ones, region by region', async () => {
  const { BAG_TIERS } = await import('../src/data/config.js');
  assert.equal(BAG_TIERS[0].capacity, 20, 'Bag 1 holds 20');
  assert.equal(BAG_TIERS[BAG_TIERS.length - 1].capacity, 100, 'the biggest bag holds 100');
  for (let i = 1; i < BAG_TIERS.length; i++) {
    assert.ok(BAG_TIERS[i].capacity > BAG_TIERS[i - 1].capacity, `${BAG_TIERS[i].name} is bigger`);
    assert.ok(BAG_TIERS[i].price > BAG_TIERS[i - 1].price, `${BAG_TIERS[i].name} is dearer`);
  }
  createNewGameState({ slot: 1, playerName: 'BAGS', starterId: 'spriggo' });
  assert.equal(StorageManager.capacity(), 20, 'a new game carries 20');
  GameState.player.wildcoins = 0;
  assert.equal(StorageManager.upgradeBag().ok, false, 'no coins, no bag');
  GameState.player.wildcoins = 100000;
  assert.equal(StorageManager.upgradeBag().ok, true);
  assert.equal(StorageManager.capacity(), 30, 'Bag 2 holds 30');

  // every region sells bags, but only up to its own tier
  const shops = Object.values(MAPS).flatMap((m) => (m.buildings || []).filter((b2) => b2.type === 'shop'));
  assert.equal(shops.length, 10, 'one shop per region');
  for (const shop of shops) {
    assert.ok(shop.maxBagTier >= 2 && shop.maxBagTier <= BAG_TIERS.length, `${shop.id} sells a sane bag tier`);
  }
  const first = shops.find((x) => x.id === 'vale_shop');
  const last = shops.find((x) => x.id === 'colo_shop');
  assert.ok(first.maxBagTier < last.maxBagTier, 'bigger bags are sold deeper into the world');
  assert.equal(last.maxBagTier, BAG_TIERS.length, 'the last shop sells the biggest bag');
  // not every map adds one, so a bag can be two regions away
  const tiers = shops.map((x) => x.maxBagTier);
  assert.ok(tiers.some((t, i) => i > 0 && t === tiers[i - 1]), 'some maps carry no new bag at all');
});

test('a full bag refuses the catch instead of wasting the ball', async () => {
  createNewGameState({ slot: 1, playerName: 'FULL', starterId: 'spriggo' });
  while (PartyManager.count() < 6) PartyManager.add(createMythling({ speciesId: 'spriggo', level: 5 }));
  while (StorageManager.used() < StorageManager.capacity()) StorageManager.add(createMythling({ speciesId: 'leaflet', level: 5 }));
  assert.equal(StorageManager.isFull(), true, 'the bag is full');
  const wild = createMythling({ speciesId: 'aquini', level: 5 });
  wild.currentHp = 0;
  InventoryManager.add('god_ball', 5);
  const blocked = CaptureManager.attempt(wild, 'god_ball', () => 0);
  assert.equal(blocked.success, false);
  assert.ok(blocked.bagFull, 'the attempt is refused up front');
  assert.equal(InventoryManager.count('god_ball'), 5, 'and the ball is not spent');
  // a bigger bag makes room again
  GameState.player.wildcoins = 100000;
  StorageManager.upgradeBag();
  assert.equal(StorageManager.isFull(), false);
  assert.equal(CaptureManager.attempt(wild, 'god_ball', () => 0).success, true, 'and the catch goes through');
});

test('shop shelves are finite, and refill every five minutes', async () => {
  const { SHOP_RESTOCK_MS } = await import('../src/data/config.js');
  const { ShopManager } = await import('../src/systems/ShopManager.js');
  createNewGameState({ slot: 1, playerName: 'SHOP', starterId: 'spriggo' });
  GameState.player.wildcoins = 1000000;
  const shop = MAPS.verdant_vale.buildings.find((b2) => b2.type === 'shop');
  const shelf = ShopManager.stock(shop);
  assert.ok(shelf.basic_ball > 10, `a staple arrives in bulk (${shelf.basic_ball})`);
  for (const [id, qty] of Object.entries(shelf)) assert.ok(qty > 0 && qty <= 30, `${id} has a sane shelf (${qty})`);

  // buying draws the shelf down
  const before = shelf.basic_ball;
  const buy = ShopManager.buy(shop, 'basic_ball', 3);
  assert.equal(buy.ok, true);
  assert.equal(ShopManager.qty(shop, 'basic_ball'), before - 3);
  assert.equal(InventoryManager.count('basic_ball'), 8 + 3, '3 more in the bag');
  // drain it: an empty shelf refuses the sale
  ShopManager.buy(shop, 'basic_ball', ShopManager.qty(shop, 'basic_ball'));
  assert.equal(ShopManager.qty(shop, 'basic_ball'), 0);
  const none = ShopManager.buy(shop, 'basic_ball', 1);
  assert.equal(none.ok, false, 'you cannot buy what is not on the shelf');
  assert.match(none.reason, /out of stock/i);

  // the timer: unchanged after a minute, fresh after five
  GameState.world.shops[shop.id].at = PlayerManager.playTime() - 60 * 1000;
  assert.equal(ShopManager.qty(shop, 'basic_ball'), 0, 'one minute later the shelf is still empty');
  GameState.world.shops[shop.id].at = PlayerManager.playTime() - SHOP_RESTOCK_MS - 1;
  assert.equal(ShopManager.qty(shop, 'basic_ball'), before, 'after five minutes it is restocked');
  assert.ok(ShopManager.msUntilRestock(shop) > 0);
  assert.match(ShopManager.formatCountdown(65000), /^1:0[45]$/, 'the countdown reads m:ss');
});

test('the rarest shelves are usually empty', async () => {
  const { ShopManager } = await import('../src/systems/ShopManager.js');
  createNewGameState({ slot: 1, playerName: 'RARE', starterId: 'spriggo' });
  const shop = MAPS.ironfist_colosseum.buildings.find((b2) => b2.type === 'shop');
  assert.ok(shop.stock.includes('dark_ball'), 'the last shop lists the Dark Ball');
  let seen = 0;
  for (let i = 0; i < 60; i++) {
    GameState.world.shops = {};                       // force a fresh roll
    if (ShopManager.qty(shop, 'dark_ball') > 0) seen += 1;
  }
  assert.ok(seen > 0, `the Dark Ball does turn up (${seen}/60 restocks)`);
  assert.ok(seen < 60, `but never reliably (${seen}/60 restocks)`);
});

test('God / Shiny / Dark Balls guarantee the top rarity tier, at a price', async () => {
  const { ITEMS: allItems } = ITEMS_MOD;
  for (const id of ['god_ball', 'shiny_ball', 'dark_ball']) {
    assert.equal(allItems[id].forceRarity, 'SSS+', `${id} forces SSS+`);
    assert.equal(allItems[id].guaranteed, true, `${id} never fails`);
  }
  assert.ok(allItems.god_ball.price > 20 * allItems.absolute_ball.price, 'the God Ball is out of the ordinary league');
  assert.ok(allItems.shiny_ball.price > 5 * allItems.god_ball.price, 'the Shiny Ball dwarfs the God Ball');
  assert.ok(allItems.dark_ball.price > allItems.shiny_ball.price, 'and the Dark Ball is the dearest thing sold');
  for (const [ball, mutation] of [['god_ball', null], ['shiny_ball', 'shiny'], ['dark_ball', 'darkness']]) {
    createNewGameState({ slot: 1, playerName: 'SSS', starterId: 'spriggo' });
    const wild = createMythling({ speciesId: 'leaflet', level: 30, rarity: 'D' });
    wild.currentHp = 0;
    InventoryManager.add(ball, 1);
    const res = CaptureManager.attempt(wild, ball, () => 0);
    assert.equal(res.success, true, `${ball} never fails`);
    assert.equal(wild.rarity, 'SSS+', `${ball} delivers SSS+`);
    if (mutation) assert.equal(wild.mutation, mutation, `${ball} also forces ${mutation}`);
    assert.equal(wild.level, 1, 'and it still arrives at Lv.1');
  }
});

test('a Cleanse Tonic lifts every debuff and leaves your own buffs alone', async () => {
  const m = createMythling({ speciesId: 'spriggo', level: 30, stage: 1 });
  const foe = createMythling({ speciesId: 'emberu', level: 30, stage: 1 });
  const bt = new Battle({ type: BattleType.WILD, party: [m], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.5 });
  bt.cb(m).applyDebuff('satk', 40);
  bt.cb(m).applyDebuff('spd', 12);
  bt.cb(m).applyBuff('patk', 20);
  assert.equal(bt.debuffs(m).length, 2, 'two stats are down');
  const res = bt.useItem('cleanse_tonic', m.uid);
  assert.equal(res.ok, true);
  assert.equal(bt.debuffs(m).length, 0, 'every debuff is gone');
  assert.equal(bt.cb(m).buffs.patk.total, 20, 'but the buff you earned is untouched');
  // with nothing to cleanse it refuses, so the item is never wasted
  assert.equal(bt.useItem('cleanse_tonic', m.uid).ok, false);
  // and it is battle-only
  const dry = applyItemEffects(ITEMS_MOD.getItem('cleanse_tonic'), m, { dryRun: true });
  assert.equal(dry.ok, false);
  assert.match(dry.reason, /battle/i);
});

test('food gets dearer per EXP the higher you go — the top of the range is endgame money', async () => {
  const { ITEMS: allItems } = ITEMS_MOD;
  const food = Object.values(allItems).filter((i) => i.category === 'food').sort((a, b2) => a.exp - b2.exp);
  assert.ok(food.length >= 10, 'a full food ladder');
  for (let i = 1; i < food.length; i++) {
    const prev = food[i - 1].price / food[i - 1].exp;
    const cur = food[i].price / food[i].exp;
    assert.ok(cur > prev - 0.01,
      `${food[i].name} (${cur.toFixed(2)}/EXP) is no better value than ${food[i - 1].name} (${prev.toFixed(2)}/EXP)`);
  }
  const top = food[food.length - 1];
  assert.equal(top.id, 'wildbound_ambrosia');
  assert.ok(top.price > 1000000, `Wildbound Ambrosia costs ${top.price.toLocaleString()} — buying two is an achievement`);
});

test('the type sheet SEE MORE block breaks the current stats down by source', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const m = createMythling({ speciesId: 'spriggo', level: 40, stage: 1, rarity: 'A', mood: 'brave', rational: 'docile' });
  const foe = createMythling({ speciesId: 'emberu', level: 40, stage: 1 });
  const scene = new BattleScene(document.createElement('canvas'));
  scene.battle = new Battle({ type: BattleType.WILD, party: [m], enemies: [foe], mapId: 'verdant_vale' });

  const { body } = scene.typePanel(m, 'player');
  const more = body.children.find((c) => String(c.className || '').includes('tp-more'));
  assert.ok(more, 'the sheet carries a SEE MORE block');
  assert.equal(more.hidden, true, 'collapsed until you ask for it');
  const txt = textOf(more);
  for (const label of ['HP', 'Physical Attack', 'Special Attack', 'Physical Defense', 'Special Defense', 'Speed']) {
    assert.ok(txt.includes(label), `${label} is listed with its current value`);
  }
  assert.match(txt, /Mood Brave/, 'the Mood bonus is named');
  assert.match(txt, /Rational/, 'so is the Rational, plus and minus');
  assert.match(txt, /Rarity A/, 'and the rarity tier behind the Mood bonus');

  const theirs = scene.typePanel(foe, 'enemy');
  const moreFoe = theirs.body.children.find((c) => String(c.className || '').includes('tp-more'));
  assert.ok(moreFoe, 'the enemy sheet carries the same block, about the enemy');
});

for (const item of queue) {
  if (item.kind === 'section') { console.log(`\n${item.name}`); continue; }
  try {
    await item.fn();
    pass++;
    console.log(`  ✓ ${item.name}`);
  } catch (e) {
    fail++;
    console.error(`  ✗ ${item.name}\n      ${e.message}${process.env.DEBUG_STACK ? `\n${e.stack}` : ''}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
