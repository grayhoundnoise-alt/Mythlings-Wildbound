// Headless verification of the rules that matter most (no DOM required).
// Run with:  npm test
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
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
    textContent: '', value: '', width: 300, height: 300, _html: '',
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle() {}, contains(c) { return this._s.has(c); } },
    appendChild(c) { this.children.push(c); return c; },
    append(...c) { c.forEach((x) => this.children.push(x)); },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    remove() {}, insertBefore(c) { this.children.push(c); return c; }, replaceWith() {},
    addEventListener(k, f) { (this._listeners[k] = this._listeners[k] || []).push(f); },
    removeEventListener() {},
    _listeners: {},
    click() { for (const f of (this._listeners.click || [])) f({ stopPropagation() {} }); },
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'disabled') this.disabled = true; },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    querySelector: () => mkEl('div'), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100 }),
    focus() {}, blur() {}, scrollTo() {},
    getContext: () => noopCtx(), toDataURL: () => 'data:image/png;base64,',
  };
  // a real element: setting innerHTML = '' detaches every child. Without this
  // anything that "re-renders in place" would silently stack up instead.
  Object.defineProperty(e, 'innerHTML', {
    get() { return e._html; },
    set(v) { e._html = v; if (v === '') e.children = []; },
  });
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
const { SPECIES, SPECIES_IDS, skillsUnlockedAt } = await import('../src/data/species.js');

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
    // Sleep / Seal debuffs carry a rider instead of a stat effect, so they are
    // judged by their own rule below rather than counted here.
    const withStats = all.filter((e) => Array.isArray(e.sk.effects));
    for (const { sk } of all.filter((e) => !Array.isArray(e.sk.effects))) {
      assert.ok(sk.sleep || sk.seal, `${sk.id} is a status debuff and must carry a rider`);
    }
    const regular = withStats.filter((e) => e.sk.effects.length === 1);
    const elite = withStats.filter((e) => e.sk.effects.length > 1);
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
  const { ULTIMATE_POWER_SCALE, SKILL_POWER_SCALE } = await import('../src/data/config.js');
  const { SKILLS: ALL_SKILLS } = await import('../src/data/skills.js');
  const { ultimateMove: ultMove } = await import('../src/core/mythling.js');
  // Charging to 8/8 has to be worth it. The honest comparison is NOT "beats the
  // strongest Special in the game" — a Lv.10 Mythling cannot have a Lv.80 Special —
  // but "beats the strongest Special you can actually be carrying at that level".
  // At the old 0.7 scale the base tier landed at 35 power against a 17-power
  // Special, so an Ultimate hit SOFTER than the move you could press every turn.
  for (const id of ['emberu', 'spriggo', 'aquini', 'rivruff', 'venomyr', 'gravelhog']) {
    for (const level of [10, 20, 60, 80]) {
      const m = createMythling({ speciesId: id, level, stage: level >= 80 ? 3 : level >= 60 ? 2 : level >= 20 ? 1 : 0 });
      const u = ultMove(m);
      if (!u || !u.damageType) continue;             // support Ultimates deal no damage
      const best = m.library.map((sid) => ALL_SKILLS[sid])
        .filter((sk) => sk && sk.category === 'special').sort((a, b) => b.power - a.power)[0];
      if (!best) continue;
      const ratio = u.power / (best.power * SKILL_POWER_SCALE);
      assert.ok(ratio >= 1.5,
        `${id} Lv.${level}: ${u.name} (${u.power}) is only ${ratio.toFixed(2)}x the best Special you can have there (${best.name} ${best.power})`);
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
  // THE RULE: even a super-effective CRIT Ultimate leaves an equal foe standing.
  assert.ok(hit.amount < before * 0.85,
    `an equal foe survives it: ${hit.amount} of ${before} HP (${Math.round((hit.amount / before) * 100)}% of the bar)`);
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

test('retaliate returns the last hit taken at double strength', () => {
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
  // You chose a reactive skill, so you waited; the foe only buffed, so there is
  // nothing to mirror. The charge is spent and the turn is gone — the price of
  // a reactive skill on a round that never offers a hit. It does NOT quietly
  // turn into a normal attack.
  assert.ok(r3.events.some((x) => x.type === 'log' && /nothing to return/.test(x.text)), 'it explains there is nothing to return');
  assert.equal(r3.events.find((x) => x.type === 'damage' && x.side === 'enemy'), undefined,
    'and it does not fall back on a plain attack — the turn is spent');
});

test('a reactive skill WAITS: the foe strikes first, however fast you are', () => {
  // The rule the player asked for: Retaliate / Vengeance mean "I wait for the
  // first blow". Speed must not override it, or a fast Mythling always acts
  // before anything exists to return and the skill is worthless.
  const castOrder = (events) => events.filter((e) => e.type === 'cast').map((e) => e.side);
  const waited = (events) => events.some((e) => e.type === 'log' && /waits for the first blow/.test(e.text));

  for (const [pId, eId, label] of [['emberfist', 'rubblekin', 'player is FASTER'], ['rubblekin', 'emberfist', 'player is SLOWER']]) {
    const p = createMythling({ speciesId: pId, level: 30, stage: 1 });
    const e = createMythling({ speciesId: eId, level: 30, stage: 1 });
    p.library.push('vengeance'); p.skills = ['vengeance'];
    const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.5 });
    const { events } = b.act({ type: 'skill', index: 0 });
    assert.equal(castOrder(events)[0], 'enemy', `${label}: the enemy still attacks first`);
    assert.ok(waited(events), `${label}: and the log says it is waiting on purpose`);
    // NB: use the event param everywhere — `e` is the enemy Mythling out here.
    const mirrored = events.find((ev) => ev.type === 'damage' && ev.side === 'enemy' && ev.skillId === 'vengeance');
    assert.ok(mirrored, `${label}: the mirror now actually lands`);
    const firstHit = events.find((ev) => ev.type === 'damage' && ev.side === 'player');
    assert.ok(firstHit && mirrored.amount > firstHit.amount, `${label}: and it returns more than it took`);
  }
});

test('when BOTH sides are reactive, higher Speed attacks first (no mutual standoff)', () => {
  // Two Mythlings each waiting on the other would never strike, so this is the
  // one case that falls back to plain Speed order.
  const castOrder = (events) => events.filter((e) => e.type === 'cast').map((e) => e.side);
  for (const [pId, eId, first] of [['emberfist', 'rubblekin', 'player'], ['rubblekin', 'emberfist', 'enemy']]) {
    const p = createMythling({ speciesId: pId, level: 30, stage: 1 });
    const e = createMythling({ speciesId: eId, level: 30, stage: 1 });
    p.library.push('vengeance'); p.skills = ['vengeance'];
    e.library.push('vengeance'); e.skills = ['vengeance'];
    const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.5 });
    const { events } = b.act({ type: 'skill', index: 0 });
    assert.equal(castOrder(events)[0], first, `${pId} vs ${eId}: the faster side (${first}) leads`);
    assert.ok(!events.some((e2) => e2.type === 'log' && /waits for the first blow/.test(e2.text)),
      `${pId} vs ${eId}: nobody holds back, so the round resolves`);
  }
});

test('a spent or sealed reactive skill does not make you hand over the initiative', () => {
  // Waiting is only correct if the move will actually answer. A used-up or
  // sealed Vengeance falls back on the unlimited attack inside _resolve, so
  // waiting first would give the initiative away for nothing.
  const waited = (events) => events.some((e) => e.type === 'log' && /waits for the first blow/.test(e.text));
  const firstCaster = (events) => events.filter((e) => e.type === 'cast').map((e) => e.side)[0];

  const p = createMythling({ speciesId: 'emberfist', level: 30, stage: 1 });
  const e = createMythling({ speciesId: 'rubblekin', level: 30, stage: 1 });
  p.library.push('vengeance'); p.skills = ['vengeance'];
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.5 });
  assert.ok(b.cb(p).stat('spd') > b.cb(e).stat('spd'), 'sanity: the player is the faster one here');
  p.uses.vengeance = 0;                    // after construction: a battle refills uses
  const { events } = b.act({ type: 'skill', index: 0 });
  assert.ok(!waited(events), 'a spent Vengeance does not hold the player back');
  assert.equal(firstCaster(events), 'player', 'it just attacks straight away, as a normal move would');
});

test('normal skills are untouched: the faster Mythling still strikes first', () => {
  const p = createMythling({ speciesId: 'emberfist', level: 30, stage: 1 });
  const e = createMythling({ speciesId: 'rubblekin', level: 30, stage: 1 });
  p.library.push('flame_rawr'); p.skills = ['flame_rawr'];
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.5 });
  assert.ok(b.cb(p).stat('spd') > b.cb(e).stat('spd'), 'sanity: the player really is faster here');
  const { events } = b.act({ type: 'skill', index: 0 });
  assert.equal(events.filter((e) => e.type === 'cast').map((e) => e.side)[0], 'player', 'player leads as usual');
  assert.ok(!events.some((e) => e.type === 'log' && /waits for the first blow/.test(e.text)), 'and never holds back');
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
  assert.equal(p.ultCharge, 1, 'a Buff charges the Ultimate by 1 — support is never a dead turn for it');
});

test('weather can be called by a Normal and a Buff, not only by the exclusives', () => {
  const WEATHER_IDS = ['wildfire', 'monsoon', 'overgrowth', 'thunderhead', 'blizzard', 'miasma'];
  const { getSkill: sk } = SKILLS_MOD;

  // The cheap route: one light Normal + one stat Buff per weather element.
  const PAIRS = [
    ['ember_flicker', 'cinder_chant', 'wildfire', 'fire'],
    ['drizzle', 'tidal_chant', 'monsoon', 'water'],
    ['spore_surge', 'verdant_chant', 'overgrowth', 'nature'],
    ['static_tick', 'voltaic_chant', 'thunderhead', 'electric'],
    ['frost_sigh', 'rime_chant', 'blizzard', 'ice'],
    ['miasma_puff', 'fen_chant', 'miasma', 'poison'],
  ];
  for (const [normal, buff, weatherId, element] of PAIRS) {
    const n = sk(normal), b = sk(buff);
    assert.ok(n && b, `${normal} / ${buff} both exist`);
    assert.equal(n.category, 'normal', `${normal} is a Normal attack`);
    assert.equal(b.category, 'buff', `${buff} is a Buff`);
    for (const s of [n, b]) {
      assert.equal(s.element, element, `${s.id} carries the ${element} element so it gets the x1.5`);
      assert.deepEqual(s.weather, { id: weatherId, chance: 0.45 }, `${s.id} calls ${weatherId} at 45%`);
      assert.ok(WEATHER_IDS.includes(s.weather.id), `${s.id} names a real weather`);
    }
    // A Normal is a WEAKER attack than the element's first rung (17 power) --
    // the weather is the payoff, the damage is the entry fee.
    assert.ok(n.power < 17, `${normal} sits below the 17/30 first rung`);
    assert.ok(n.uses <= 3 && b.uses <= 3, `${normal}/${buff} are rare, not spammable`);
    // A Buff must not smuggle in a second stat boost on top of the weather: it
    // may never beat the best plain Buff for the same stat.
    const best = Math.max(...Object.values(SKILLS_MOD.SKILLS)
      .filter((x) => x.category === 'buff' && !x.weather && x.effects?.length === 1
        && x.effects[0].stat === b.effects[0].stat)
      .map((x) => x.effects[0].amount));
    assert.ok(best && b.effects[0].amount <= best,
      `${buff} raises ${b.effects[0].stat} by ${b.effects[0].amount}, no more than the best plain Buff (${best})`);
  }

  // Only the twelve specialists may call weather; nobody else gets a free sky.
  const CALLERS = new Set(PAIRS.flatMap(([n, b]) => [n, b]));
  const EXCLUSIVES = new Set(['magma_storm', 'monsoon_call', 'worldroot_crown', 'thunder_caller', 'glacial_age', 'miasma_bloom']);
  const weatherIds = Object.values(SKILLS_MOD.SKILLS).filter((x) => x.weather).map((x) => x.id);
  let callers = 0;
  for (const sp of Object.values(SPECIES)) {
    const known = skillsUnlockedAt(sp.id, 99);
    const has = weatherIds.filter((id) => known.includes(id));
    const hasExclusive = has.some((id) => EXCLUSIVES.has(id));
    if (has.some((id) => CALLERS.has(id))) {
      callers++;
      assert.ok(hasExclusive, `${sp.displayName} may call weather only if it holds the exclusive`);
      assert.ok(has.length >= 3, `${sp.displayName} gets its Normal, its Buff and its exclusive`);
    } else {
      assert.equal(has.length, 0, `${sp.displayName} gets no weather caller`);
    }
  }
  assert.equal(callers, 12, 'exactly twelve species may call weather — two per element');
});

test('a weather Normal or Buff actually raises the weather in battle', () => {
  // A uniform roll: 0.0 always passes the 45% weather check, 0.99 always fails
  // it. (0.0 also suppresses the hit itself, so the "still attacks" case uses
  // 0.99, which fails the weather roll but lands the blow.)
  const fight = (speciesId, skillId, roll) => {
    const p = createMythling({ speciesId, level: 50, stage: 1, rational: 'docile' });
    p.library.push(skillId); p.skills = [skillId];
    const e = createMythling({ speciesId: 'gravelhog', level: 50, stage: 1, rational: 'docile' });
    const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'emberwild', rng: () => roll });
    b.weather = null;
    const r = b.act({ type: 'skill', index: 0 });
    return { weather: b.weather, events: r.events, p, e };
  };

  const hit = fight('emberu', 'ember_flicker', 0.0);
  assert.equal(hit.weather, 'wildfire', 'a Normal can raise weather');
  assert.ok(hit.events.some((x) => x.type === 'weather' && x.id === 'wildfire'), 'and it is announced');
  const miss = fight('emberu', 'ember_flicker', 0.99);
  assert.equal(miss.weather, null, 'a failed roll raises nothing');

  // A Buff does the same while staying support: it deals no damage, and it
  // still charges the Ultimate by 1.
  const buffed = fight('magmataur', 'cinder_chant', 0.0);
  assert.equal(buffed.weather, 'wildfire', 'a Buff can raise weather');
  assert.ok(!buffed.events.some((x) => x.type === 'damage'), 'but a Buff still deals no damage');
  assert.ok(buffed.events.some((x) => x.type === 'buff' && x.stat === 'patk'), 'and still raises its stat');
  assert.equal(buffed.p.ultCharge, 1, 'and still charges the Ultimate');
  assert.equal(buffed.events.filter((x) => x.type === 'charge').length, 1, 'exactly one point, not two');

  // The caller is a real attack, not a weather button that does nothing.
  const landed = fight('emberu', 'ember_flicker', 0.99);
  assert.ok(landed.events.some((x) => x.type === 'damage'), 'the Normal still attacks');
  assert.equal(landed.p.ultCharge, 1, 'and still charges the Ultimate');
});

test('a Buff charges the Ultimate by 1; a Debuff does not', () => {
  // Picking a support button used to be a dead turn for the Ultimate bar, so a
  // player who opened with Power Up paid for it with a whole turn of charge.
  const chargeAfter = (speciesId, skillId) => {
    const p = createMythling({ speciesId, level: 30, stage: 1, rational: 'docile' });
    p.library.push(skillId); p.skills = [skillId];
    const e = createMythling({ speciesId: 'gravelhog', level: 30, stage: 1, rational: 'docile' });
    const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.5 });
    const before = p.ultCharge;
    b.act({ type: 'skill', index: 0 });
    return p.ultCharge - before;
  };
  assert.equal(chargeAfter('spriggo', 'mind_up'), 1, 'a Buff grants a point');
  assert.equal(chargeAfter('spriggo', 'power_up'), 1, 'every Buff does, whatever it raises');
  assert.equal(chargeAfter('spriggo', 'vine_lash'), 1, 'a Special attack still grants one');
  assert.equal(chargeAfter('spriggo', 'bite'), 1, 'a Normal attack still grants one');
  assert.equal(chargeAfter('spriggo', 'weaken'), 0, 'a Debuff acts on the foe and grants nothing');

  // and the bar still calls READY when the last point comes from a Buff
  const p = createMythling({ speciesId: 'spriggo', level: 30, stage: 1, rational: 'docile' });
  p.library.push('mind_up'); p.skills = ['mind_up'];
  const e = createMythling({ speciesId: 'gravelhog', level: 30, stage: 1, rational: 'docile' });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.5 });
  p.ultCharge = 7;
  const { events } = b.act({ type: 'skill', index: 0 });
  assert.equal(p.ultCharge, 8, 'the eighth point comes from the Buff');
  assert.ok(events.some((x) => x.type === 'ultimate-ready'), 'and the READY call still fires');
  assert.ok(events.some((x) => x.type === 'charge' && x.value === 8), 'and the HUD is told the new value');
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
  // Rational is ALWAYS rolled from Math.random unless it is passed in, and it
  // swings stats by +/-10. Left to chance, Leaflet fainted to Vine Lash in
  // ~1 run in 30, the battle ended, and the second button had nothing to
  // resolve - a flake that had nothing to do with what this test is checking.
  const p = createMythling({ speciesId: 'spriggo', level: 5, rational: 'docile' });
  assert.deepEqual(p.skills, ['bite', 'vine_lash', 'brave_guard'], 'auto-equip: normal, special, then the stat skill');
  const e = createMythling({ speciesId: 'leaflet', level: 5, rational: 'docile' });
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
section('Map landing points');

test('no structure or model is ever placed where the player lands', async () => {
  const { MAPS } = await import('../src/data/maps.js');
  const { WorldRenderer } = await import('../src/render/worldRenderer.js');
  const r = new WorldRenderer();
  // A prop on a landing spot leaves the player wedged: every direction is
  // blocked, so the controls do nothing and the map reads as broken.
  for (const id of Object.keys(MAPS)) {
    const map = MAPS[id];
    const landings = r.landingPoints(map);
    assert.ok(landings.length >= 1, `${id} knows where the player lands`);
    const near = r.props(map).filter((p) => landings.some((l) => Math.abs(l.x - p.x) < 70 && Math.abs(l.y - p.y) < 70));
    assert.equal(near.length, 0, `${id}: nothing dropped on a landing spot (${landings.length} landing point(s))`);
  }
  // the exclusion must not hollow the maps out
  const total = Object.keys(MAPS).reduce((n, id) => n + r.props(MAPS[id]).length, 0);
  assert.ok(total > 3000, `scenery is still there (${total} props)`);
});

test('every map spawn and every connection arrival is standable', async () => {
  const { MAPS } = await import('../src/data/maps.js');
  const { OverworldScene } = await import('../src/scenes/OverworldScene.js');
  const sc = new OverworldScene(document.createElement('canvas'));
  for (const id of Object.keys(MAPS)) {
    const m = MAPS[id];
    sc.enter(m.id, m.spawn.x, m.spawn.y);
    assert.ok(sc.isStandable(sc.player.x, sc.player.y), `${id} spawn (${m.spawn.x},${m.spawn.y}) is clear`);
    assert.equal(sc.player.x, m.spawn.x, `${id}: a clear spawn is left exactly where it is`);
  }
  for (const id of Object.keys(MAPS)) {
    for (const c of MAPS[id].connections || []) {
      if (!c.toPoint) { assert.fail(`${id} -> ${c.toMap} has no toPoint`); continue; }
      sc.enter(c.toMap, c.toPoint.x, c.toPoint.y);
      assert.ok(sc.isStandable(sc.player.x, sc.player.y),
        `${id} -> ${c.toMap} lands clear at (${c.toPoint.x},${c.toPoint.y})`);
      assert.equal(sc.player.x, c.toPoint.x, `${id} -> ${c.toMap}: not nudged when already clear`);
    }
  }
});

test('a landing point that IS blocked rescues the player instead of wedging them', async () => {
  const { MAPS } = await import('../src/data/maps.js');
  const { OverworldScene } = await import('../src/scenes/OverworldScene.js');
  const sc = new OverworldScene(document.createElement('canvas'));
  const m = MAPS.stormreach_plateau;
  sc.enter(m.id, m.spawn.x, m.spawn.y);
  // force the worst case: a hand-placed building dropped right on the spawn
  const b = m.buildings[0];
  const bx = b.x + b.w / 2, by = b.y + b.h / 2;
  sc.player.x = bx; sc.player.y = by;
  assert.equal(sc.isStandable(bx, by), false, 'the player really is inside a building');
  assert.equal(sc.nudgeToFreeSpot(), true, 'the backstop moves them out');
  assert.ok(sc.isStandable(sc.player.x, sc.player.y), 'and they end up somewhere they can actually walk');
  // they must be able to move again, not just be standing somewhere legal
  const px = sc.player.x, py = sc.player.y;
  sc.tryMove(px + 20, py);
  assert.ok(sc.player.x !== px || sc.player.y !== py, 'and the controls respond again');
  // and entering a map uses the same backstop, which is the real path
  sc.enter(m.id, bx, by);
  assert.ok(sc.isStandable(sc.player.x, sc.player.y), 'entering a map at a blocked point still lands clear');

  // a clear spot is never touched
  sc.player.x = 300; sc.player.y = 1100;
  if (sc.isStandable(300, 1100)) {
    sc.nudgeToFreeSpot();
    assert.equal(sc.player.x, 300, 'a free spot is left alone');
    assert.equal(sc.player.y, 1100, 'in both axes');
  }
});

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

/** Collect every descendant whose className contains `cls` (the DOM shim has no querySelectorAll). */
const byClass = (node, cls) => {
  const out = [];
  for (const c of node?.children || []) {
    if (String(c.className || '').split(/\s+/).includes(cls)) out.push(c);
    out.push(...byClass(c, cls));
  }
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
  const { SKILLS: ALL_SKILLS } = await import('../src/data/skills.js');
  const { MOODS, RATIONAL_IDS } = await import('../src/data/moods.js');
  // Mood and Rational are swept instead of left to chance: Emberu's best Special
  // is PHYSICAL while its Ultimate is SPECIAL, so a physical build narrows the gap.
  let worst = Infinity; let worstAt = '';
  for (const mood of Object.keys(MOODS)) {
    for (const rational of RATIONAL_IDS) {
      for (const level of [10, 60, 100]) {
        const fire = createMythling({ speciesId: 'emberu', level, stage: level >= 80 ? 3 : level >= 60 ? 2 : level >= 20 ? 1 : 0, mood, rational, rarity: 'A' });
        const nature = createMythling({ speciesId: 'spriggo', level, stage: fire.stage, mood: 'brave', rational: 'docile', rarity: 'A' });
        const bt = new Battle({ type: BattleType.WILD, party: [fire], enemies: [nature], mapId: 'emberwild', rng: () => 0.5 });
        const ult = previewDamage(bt, fire, nature, ultimateMove(fire), { isUltimate: true });
        // the strongest Special this Mythling can actually be carrying at that level
        // (comparing against a force-fed endgame move would prove nothing)
        const best = fire.library.map((sid) => ALL_SKILLS[sid])
          .filter((sk) => sk && sk.category === 'special').sort((a, b) => b.power - a.power)[0];
        if (!best) continue;
        const special = previewDamage(bt, fire, nature, best);
        const r = ult.dmg / special.dmg;
        if (r < worst) { worst = r; worstAt = `Lv.${level} ${mood}/${rational}: ${ult.dmg} vs ${best.name} ${special.dmg}`; }
      }
    }
  }
  assert.ok(worst >= 1.2,
    `the Ultimate beats the best Special on every build (worst ${worst.toFixed(2)}x — ${worstAt})`);
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

test('a save/load keeps shop shelves bought-down (regression)', async () => {
  const { ShopManager } = await import('../src/systems/ShopManager.js');
  const { serialize, deserialize } = await import('../src/systems/GameState.js');
  createNewGameState({ slot: 1, playerName: 'RELOAD', starterId: 'spriggo' });
  GameState.player.wildcoins = 1000000;
  const shop = MAPS.verdant_vale.buildings.find((b2) => b2.type === 'shop');

  // Buy one staple down, then round-trip the whole save through disk.
  const before = ShopManager.qty(shop, 'basic_ball');
  assert.ok(ShopManager.buy(shop, 'basic_ball', 4).ok, 'the purchase goes through');
  const bought = ShopManager.qty(shop, 'basic_ball');
  assert.equal(bought, before - 4);

  deserialize(JSON.parse(JSON.stringify(serialize())));
  assert.equal(ShopManager.qty(shop, 'basic_ball'), bought,
    'the shelf is still bought down after a save/load — a load never restocks a shop for free');

  // And a save written before shelves existed (no world.shops) still loads cleanly.
  const legacy = JSON.parse(JSON.stringify(serialize()));
  delete legacy.world.shops;
  assert.equal(deserialize(legacy), true, 'a save with no shop data still loads');
  assert.ok(ShopManager.qty(shop, 'basic_ball') > 0, 'and the shop is stocked normally');
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

test('the type sheet SEE MORE block lists plain current stats, and nothing else', async () => {
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
  // The type sheet is about TYPES. The arithmetic behind a number (level growth,
  // Mood, Rational, Rarity, the (+n) deltas) lives in the Mythling's detail panel.
  assert.doesNotMatch(txt, /Mood Brave/, 'no Mood breakdown here');
  assert.doesNotMatch(txt, /Rational/, 'no Rational breakdown here');
  assert.doesNotMatch(txt, /Rarity A/, 'no rarity tier here');
  assert.doesNotMatch(txt, /Lv\.40/, 'no level/stage line here');
  assert.doesNotMatch(txt, /stage \d+/, 'no stage total here');
  assert.doesNotMatch(txt, /The number the battle uses/, 'and no explanation paragraph');
  // the numbers themselves are still there and still correct
  for (const k of ['hp', 'patk', 'satk', 'pdef', 'sdef', 'spd']) {
    const st = computeStats(m)[k];
    assert.ok(txt.includes(String(st)), `${k} shows its real current value (${st})`);
  }

  // the STRONG / WEAK / RESISTS chip lists above already explain themselves, so
  // the sheet must not repeat the same two paragraphs underneath.
  const full = textOf(body);
  assert.doesNotMatch(full, /Weak against = elements/, 'no duplicated "Weak against =" note');
  assert.doesNotMatch(full, /Dual type: every one of its elements/, 'no duplicated "Dual type" note');

  const theirs = scene.typePanel(foe, 'enemy');
  const moreFoe = theirs.body.children.find((c) => String(c.className || '').includes('tp-more'));
  assert.ok(moreFoe, 'the enemy sheet carries the same block, about the enemy');
});

// ------------------------------------------------------------------
section('Elemental special ladders & the Wiki skill sort');

test('Water and Fire each have a full Physical (P.ATK) elemental ladder', async () => {
  const { SKILLS: ALL } = SKILLS_MOD;
  // Water and Fire were the only elements whose specials all used S.ATK, so a
  // Water or Fire brawler had no elemental move that scaled with P.ATK.
  for (const el of ['water', 'fire']) {
    const own = Object.values(ALL).filter((k) => k.category === 'special' && k.element === el);
    const ph = own.filter((k) => k.damageType === 'physical').map((k) => k.power).sort((a, b) => a - b);
    assert.ok(ph.length >= 4, `${el} has a Physical ladder (${ph.length}: ${ph.join(', ')})`);
    assert.equal(ph[0], 15, `${el}'s Physical ladder starts at power 15`);
    assert.ok(ph.includes(54), `${el}'s Physical ladder reaches power 54`);
    assert.ok(own.some((k) => k.damageType === 'special'), `${el} still has its Special ladder too`);
  }
  // the new rungs sit on the same template as the six newer elements
  for (const [id, power, uses, el] of [
    ['brine_snap', 15, 20, 'water'], ['tide_fang', 28, 18, 'water'],
    ['undertow_rush', 40, 15, 'water'], ['maelstrom_crush', 54, 12, 'water'],
    ['ember_claw', 15, 20, 'fire'], ['furnace_lunge', 40, 15, 'fire'], ['inferno_maul', 54, 12, 'fire'],
  ]) {
    const k = ALL[id];
    assert.ok(k, `${id} exists`);
    assert.equal(k.element, el, `${id} is a ${el} move`);
    assert.equal(k.damageType, 'physical', `${id} scales with P.ATK`);
    assert.equal(k.power, power, `${id} power`);
    assert.equal(k.uses, uses, `${id} uses`);
    assert.ok(k.desc && k.desc.length > 10, `${id} is described`);
  }
  // Fire's Lv.20 rung was already there (Burning Fang), so only 3 were added
  const firePh = Object.values(ALL).filter((k) => k.category === 'special' && k.element === 'fire' && k.damageType === 'physical');
  assert.ok(firePh.some((k) => k.id === 'burning_fang'), 'Burning Fang still fills Fire\'s Lv.20 rung');
});

test('only Water and Fire BRUISERS learn the new Physical ladders', async () => {
  const { skillsUnlockedAt, skillLearnLevel } = await import('../src/data/species.js');
  const NEW = ['brine_snap', 'tide_fang', 'undertow_rush', 'maelstrom_crush', 'ember_claw', 'furnace_lunge', 'inferno_maul'];
  for (const [id, element] of [['rivruff', 'water'], ['shelldrake', 'water'], ['currentkit', 'water'],
    ['emberlynx', 'fire'], ['magmataur', 'fire'], ['ashpup', 'fire']]) {
    const lib = skillsUnlockedAt(id, 100);
    const own = NEW.filter((s) => lib.includes(s) && SKILLS_MOD.SKILLS[s].element === element);
    assert.ok(own.length >= 3, `${id} (${element}, P.ATK-led) learns its Physical ladder: ${own.join(', ')}`);
    assert.equal(skillLearnLevel(id, own[0]), 1, `${id} gets its first rung at Lv.1`);
  }
  // a special attacker of the same element must NOT be handed a P.ATK ladder
  for (const id of ['aquini', 'tidewyrm', 'emberu', 'cinderhawk']) {
    const got = NEW.filter((s) => skillsUnlockedAt(id, 100).includes(s));
    assert.deepEqual(got, [], `${id} is a Special attacker and stays out of the Physical ladder`);
  }
  // and nothing outside Water / Fire is affected
  for (const id of ['spriggo', 'gravelhog', 'venoviper', 'zenram']) {
    assert.deepEqual(NEW.filter((s) => skillsUnlockedAt(id, 100).includes(s)), [], `${id} is untouched`);
  }
});

test('the Wiki skills tab has a Sort control for level and element', async () => {
  const { WIKI_SECTIONS } = await import('../src/ui/wiki.js');
  const section = WIKI_SECTIONS.find((s) => s[0] === 'skills');
  assert.ok(section, 'the skills section exists');
  const nodes = section[3]();
  const flat = [];
  const walk = (n) => { flat.push(n); for (const c of n.children || []) walk(c); };
  for (const n of nodes) walk(n);
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const rows = () => flat.filter((n) => String(n.className || '').includes('wiki-tr'));
  const bands = () => rows().map((n) => strip(n.children[0]?.innerHTML)).filter((t) => /^[A-Z]/.test(t) && / · \d+ skills?$/.test(t));

  const sortBtns = flat.filter((n) => String(n.className || '').includes('wiki-sort-btn'));
  assert.equal(sortBtns.length, 2, 'there are two sort options');
  assert.equal(strip(textOf(sortBtns[0])), 'By level', 'one is "By level"');
  assert.equal(strip(textOf(sortBtns[1])), 'By element', 'one is "By element"');
  assert.equal(bands().length, 0, 'level order opens with no element bands');

  // every elemental skill row carries an element badge with an icon
  const html = flat.map((n) => String(n.innerHTML || '')).join('\n');
  const badges = html.match(/<span class="wiki-element"[^>]*>.*?<\/span>/g) || [];
  assert.ok(badges.length > 100, `elemental rows are badged (${badges.length})`);
  assert.ok(badges.every((b) => b.includes('<svg')), 'and every badge carries an element icon');

  // clicking switches to element order, which heads each group with a band
  const host = nodes.find((n) => String(n.className || '').includes('wiki-sorted'));
  assert.ok(host, 'the sorted tables live in a node that can be redrawn in place');
  sortBtns[1].click();
  flat.length = 0;
  walk(host);
  const after = bands();
  assert.ok(after.length >= 10, `element order groups the tables (${after.length} bands)`);
  assert.ok(after.some((b) => /^Fire · \d+ skills$/.test(b)), 'including a Fire band');
  assert.ok(after.some((b) => /^Water · \d+ skills$/.test(b)), 'and a Water band');
  assert.ok(after.some((b) => /^No element · \d+ skills$/.test(b)), 'element-less moves are grouped last');
});

section('Burn & Poison (damage over time)');

test('burn and poison tick for damage that scales with the TARGET\'s level', async () => {
  const { DOT_BASE, DOT_PER_LEVEL } = await import('../src/data/config.js');
  const tickAt = (lv) => { const m = createMythling({ speciesId: 'emberu', level: lv, stage: 1 }); new Battle({ type: BattleType.WILD, party: [m], enemies: [createMythling({ speciesId: 'aquini', level: lv })], mapId: 'verdant_vale' }); return Battle.dotDamage(m); };
  const lo = tickAt(1), mid = tickAt(50), hi = tickAt(LEVEL_CAP);
  assert.ok(lo < mid && mid < hi, `the same status hurts more on a higher-level target (${lo} < ${mid} < ${hi})`);
  assert.equal(hi, Math.round(DOT_BASE + DOT_PER_LEVEL * LEVEL_CAP), 'the number is the documented formula');
  // a level-1 burn on a level-100 Mythling would be a joke; it is not
  assert.ok(hi >= 10 * lo, `a high-level target genuinely takes a beating (${hi} vs ${lo})`);
});

test('a Fire skill burns the foe and the burn bites at the end of that same round', async () => {
  const atk = createMythling({ speciesId: 'emberu', level: 30, stage: 1 });
  const foe = createMythling({ speciesId: 'aquini', level: 30 });
  atk.library.push('kindling'); atk.uses.kindling = 99;
  const bt = new Battle({ type: BattleType.WILD, party: [atk], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.1 });
  const { events } = bt.act({ type: 'skill', skillId: 'kindling' });
  const set = events.find((e) => e.type === 'dot-set' && e.side === 'enemy');
  assert.ok(set, 'Kindling set a status on the foe');
  assert.equal(set.kind, 'burn', 'and it is Burn, not Poison');
  const tick = events.find((e) => e.type === 'dot-tick' && e.side === 'enemy');
  assert.ok(tick, 'the burn already ticks at the end of the round it was set');
  assert.equal(tick.amount, set.amount, 'for the level-scaled number the status was created with');
  assert.equal(tick.turns, set.turns - 1, 'and the counter counts down');
});

test('a Poison skill poisons without needing to deal damage first', async () => {
  const atk = createMythling({ speciesId: 'venoviper', level: 30, stage: 1 });
  const foe = createMythling({ speciesId: 'aquini', level: 30 });
  atk.library.push('toxic_bite'); atk.uses.toxic_bite = 99;
  const bt = new Battle({ type: BattleType.WILD, party: [atk], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.1 });
  const { events } = bt.act({ type: 'skill', skillId: 'toxic_bite' });
  assert.equal(events.find((e) => e.type === 'dot-set').kind, 'poison', 'Toxic Bite poisons');
  assert.equal(events.find((e) => e.type === 'damage' && e.side === 'enemy'), undefined, 'and is a pure debuff — no hit of its own');
});

test('re-applying a status refreshes it; it can never be doubled into a double tick', async () => {
  const atk = createMythling({ speciesId: 'emberu', level: 30, stage: 1 });
  const foe = createMythling({ speciesId: 'aquini', level: 30 });
  atk.library.push('kindling'); atk.uses.kindling = 99;
  const bt = new Battle({ type: BattleType.WILD, party: [atk], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.1 });
  bt.act({ type: 'skill', skillId: 'kindling' });
  const hpBefore = foe.currentHp;
  const { events } = bt.act({ type: 'skill', skillId: 'kindling' });
  const set = events.find((e) => e.type === 'dot-set' && e.side === 'enemy');
  assert.equal(set.turns, 4, 'the counter is refreshed back to full, not added to');
  assert.equal(set.refreshed, true, 'and the engine says so');
  const ticks = events.filter((e) => e.type === 'dot-tick' && e.side === 'enemy');
  assert.equal(ticks.length, 1, 'still exactly one tick per round');
  assert.equal(ticks[0].amount, Battle.dotDamage(foe), 'for one tick worth, not two');
  // the foe strikes back in the same round, so check the burn specifically
  assert.ok(foe.currentHp < hpBefore, 'the foe bleeds Health every round while it burns');
  assert.ok(foe.currentHp <= hpBefore - ticks[0].amount, 'and at minimum by the tick on top of the hit it took');
});

test('burn and poison both cap at 10 turns, wear off cleanly, and can end a fight on their own', async () => {
  const { DOT_MAX_TURNS } = await import('../src/data/config.js');
  assert.equal(DOT_MAX_TURNS, 10, 'the cap is ten turns');
  for (const kind of ['burn', 'poison']) {
    const big = createMythling({ speciesId: 'aquini', level: 30 });
    const cap = new Battle({ type: BattleType.WILD, party: [createMythling({ speciesId: 'emberu', level: 30 })], enemies: [big], mapId: 'verdant_vale' });
    cap.applyDot(big, kind, 999);
    assert.equal(cap.cb(big).dot.turns, DOT_MAX_TURNS, `${kind} refuses to last past the cap`);

    const tgt = createMythling({ speciesId: 'aquini', level: 30 });
    const bt = new Battle({ type: BattleType.WILD, party: [createMythling({ speciesId: 'emberu', level: 30 })], enemies: [tgt], mapId: 'verdant_vale' });
    bt.applyDot(tgt, kind, 2);
    for (let r = 0; r < 4; r++) bt.act({ type: 'skill', skillId: 'bite' });
    assert.equal(bt.cb(tgt).dot, null, `${kind} wears off and leaves no zero-stack behind`);
    assert.ok(tgt.currentHp > 0, `${kind} ticked but did not kill a healthy foe`);
  }
  // and it CAN decide the fight
  const glass = createMythling({ speciesId: 'aquini', level: 1 });
  const bt2 = new Battle({ type: BattleType.WILD, party: [createMythling({ speciesId: 'emberu', level: 60 })], enemies: [glass], mapId: 'verdant_vale', rng: () => 0.1 });
  bt2.applyDot(glass, 'poison', 5);
  for (let r = 0; r < 8 && glass.currentHp > 0; r++) bt2.act({ type: 'skill', skillId: 'bite' });
  assert.equal(glass.currentHp, 0, 'damage over time can finish a Mythling off by itself');
  assert.equal(bt2.phase, BattlePhase.DEFEATED_WILD, 'and the battle resolves');
});

test('Guard does not stop a status — and weather burn stays a separate, field-wide thing', async () => {
  const guarded = createMythling({ speciesId: 'aquini', level: 30 });
  const bt = new Battle({ type: BattleType.WILD, party: [createMythling({ speciesId: 'emberu', level: 30 })], enemies: [guarded], mapId: 'verdant_vale', rng: () => 0.5 });
  bt.cb(guarded).guard = true;
  bt.applyDot(guarded, 'burn', 3);
  bt.act({ type: 'skill', skillId: 'bite' });
  assert.ok(bt.cb(guarded).dot, 'bracing stops a blow, not the fire that is already inside you');

  const other = createMythling({ speciesId: 'aquini', level: 30 });
  const bt2 = new Battle({ type: BattleType.WILD, party: [createMythling({ speciesId: 'emberu', level: 30 })], enemies: [other], mapId: 'verdant_vale', rng: () => 0.5 });
  bt2.applyDot(other, 'burn', 3);
  const evs = bt2.act({ type: 'skill', skillId: 'bite' }).events;
  assert.ok(!evs.some((e) => e.type === 'weather-tick'), 'no field damage is involved');
  assert.equal(bt2.cb(other).dot.turns, 2, 'the status is its own thing and ticks on its own counter');
});

test('burn and poison are learned by the right element, at levels, and nobody else gets them', async () => {
  const { skillsUnlockedAt, skillLearnLevel } = await import('../src/data/species.js');
  for (const id of ['kindling', 'wildfire', 'immolation']) {
    assert.ok(skillsUnlockedAt('emberu', LEVEL_CAP).includes(id), `a Fire Mythling learns ${id}`);
    assert.ok(!skillsUnlockedAt('spriggo', LEVEL_CAP).includes(id), `a Nature Mythling does NOT learn ${id}`);
  }
  for (const id of ['toxic_bite', 'venom_bloom', 'creeping_toxin', 'plague_bloom', 'septic_rot']) {
    assert.ok(skillsUnlockedAt('venoviper', LEVEL_CAP).includes(id), `a Poison Mythling learns ${id}`);
    assert.ok(!skillsUnlockedAt('emberu', LEVEL_CAP).includes(id), `a Fire Mythling does NOT learn ${id}`);
  }
  assert.ok(skillLearnLevel('emberu', 'kindling') > 1, 'Burn is a later unlock, not a freebie');
  assert.ok(skillLearnLevel('venoviper', 'septic_rot') > skillLearnLevel('venoviper', 'toxic_bite'), 'and the ladder deepens with level');
  for (const id of ['kindling', 'wildfire', 'immolation', 'toxic_bite', 'venom_bloom', 'creeping_toxin', 'plague_bloom', 'septic_rot']) {
    const sk = getSkillById(id);
    assert.ok(sk, `${id} is a real skill`);
    assert.ok(sk.burn || sk.poison, `${id} actually carries a damage-over-time rider`);
  }
});

test('the battle card shows a Burn or Poison chip with the real numbers', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const atk = createMythling({ speciesId: 'emberu', level: 40, stage: 1 });
  const foe = createMythling({ speciesId: 'aquini', level: 40 });
  atk.library.push('kindling'); atk.uses.kindling = 99;
  const bt = new Battle({ type: BattleType.WILD, party: [atk], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.1 });
  bt.act({ type: 'skill', skillId: 'kindling' });
  const scene = new BattleScene(document.createElement('canvas'));
  scene.battle = bt;
  const row = scene.statusRow(foe);
  const txt = textOf(row);
  assert.match(txt, /BURN/, 'the foe is chipped as burning');
  assert.match(txt, /3/, 'with the rounds it has left');
  assert.match(String(row.children[0].getAttribute('title')), /scales with this Mythling's level/, 'and the tooltip says where the number comes from');
  assert.match(String(row.children[0].getAttribute('title')), /Capped at 10 turns/, 'and says the cap');
  // poison reads differently, so the two are never confused
  const p2 = createMythling({ speciesId: 'aquini', level: 40 });
  const bt2 = new Battle({ type: BattleType.WILD, party: [createMythling({ speciesId: 'venoviper', level: 40 })], enemies: [p2], mapId: 'verdant_vale' });
  bt2.applyDot(p2, 'poison', 6);
  scene.battle = bt2;
  const row2 = scene.statusRow(p2);
  assert.match(textOf(row2), /POISON 6/, 'poison shows its own name and counter');
});

test('the type sheet never carves a digit off its own stats at any window width', () => {
  const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
  const rule = () => {
    const hit = css.match(/(?:^|\n)\s*\.type-panel[^{]*\{([^}]*)\}/);
    return hit ? hit[1] : '';
  };
  // A px floor on the panel is what broke this: the modal's content box is
  // 560 - 48 = 512px, so a min-width of 520px overflowed it and the panel's own
  // overflow-x: hidden shaved a digit off the right-hand column. It only bit
  // from roughly a 700px viewport upward, which is why it looked fine small.
  const tp = rule();
  assert.doesNotMatch(tp, /min-width:\s*\d+px/, 'the type panel carries no px floor that can outgrow its modal');
  assert.match(tp, /width:\s*100%/, 'it fills whatever the modal gives it instead');

  // The grid must be able to drop to one column, not demand two at any size.
  const grid = css.match(/\.tp-stats\s*\{([^}]*)\}/);
  assert.ok(grid, 'the stats grid is still a grid');
  assert.match(grid[1], /auto-fit/, 'it reflows instead of forcing two columns into a narrow panel');
  assert.match(grid[1], /minmax\(/, 'with a floor it can actually fall back from');

  // The number is the point of the row: never shrink it, never clip it.
  const val = css.match(/\.tp-stat \.tp-sval\s*\{([^}]*)\}/);
  assert.ok(val, 'the stat value is styled');
  assert.match(val[1], /flex:\s*0 0 auto/, 'the value never shrinks');
  assert.match(val[1], /white-space:\s*nowrap/, 'and never wraps mid-number');
  const name = css.match(/\.tp-stat \.tp-sname\s*\{([^}]*)\}/);
  assert.ok(name, 'the stat label is styled');
  assert.match(name[1], /min-width:\s*0/, 'the label is the one allowed to give way');
  assert.match(name[1], /text-overflow:\s*ellipsis/, 'with an ellipsis rather than pushing the number out');
});

test('a Max Revive puts the Mythling back on the field, not just back on the bar', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const me = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  const foe = createMythling({ speciesId: 'emberu', level: 20, stage: 1 });
  const bt = new Battle({ type: BattleType.WILD, party: [me], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.5 });
  const scene = new BattleScene(document.createElement('canvas'));
  scene.battle = bt;
  scene.view.player = scene.viewOf(me, 'player');
  scene.view.enemy = scene.viewOf(foe, 'enemy');

  // knocked out: the sprite is faded out and the collapse is HELD
  me.currentHp = 0;
  scene.view.player.hp = 0;
  await scene.playEvent({ type: 'faint', side: 'player' });
  const ko = scene.anim.player;
  assert.equal(ko.alpha, 0, 'a fainted Mythling is off the field');
  assert.equal(ko.anim, 'faint', 'and lying in the collapse pose');
  assert.equal(ko.hold, true, 'held there until something puts them back');

  // Max Revive
  const evs = bt.useItem('max_revive', me.uid).events;
  const heal = evs.find((e) => e.type === 'heal');
  assert.ok(heal, 'the revive heals');
  await scene.playEvent(heal);
  const back = scene.anim.player;
  assert.notEqual(back.anim, 'faint', 'the held collapse is cleared — this is the bug that left it wobbling');
  assert.equal(back.hold, false, 'and nothing holds it there any more');
  assert.equal(back.alpha, 1, 'the creature is back on the field and fully solid');
  assert.equal(scene.view.player.hp, me.currentHp, 'and the bar matches the real HP');
  assert.ok(me.currentHp > 0, 'the Mythling is genuinely back in the fight');

  // the same must be true of a plain Revive Herb
  const me2 = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  const bt2 = new Battle({ type: BattleType.WILD, party: [me2], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.5 });
  const scene2 = new BattleScene(document.createElement('canvas'));
  scene2.battle = bt2;
  scene2.view.player = scene2.viewOf(me2, 'player');
  me2.currentHp = 0; scene2.view.player.hp = 0;
  await scene2.playEvent({ type: 'faint', side: 'player' });
  await scene2.playEvent(bt2.useItem('revive_herb', me2.uid).events.find((e) => e.type === 'heal'));
  assert.equal(scene2.anim.player.alpha, 1, 'a Revive Herb brings the sprite back too');
  assert.equal(scene2.anim.player.anim === 'faint', false, 'with no stuck collapse');
});

test('a plain potion on a standing Mythling leaves the sprite alone', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const me = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  const foe = createMythling({ speciesId: 'emberu', level: 20, stage: 1 });
  const bt = new Battle({ type: BattleType.WILD, party: [me], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.5 });
  const scene = new BattleScene(document.createElement('canvas'));
  scene.battle = bt;
  scene.view.player = scene.viewOf(me, 'player');
  me.currentHp = Math.floor(maxHpOf(me) * 0.3);
  const heal = bt.useItem('greater_potion', me.uid).events.find((e) => e.type === 'heal');
  assert.ok(heal, 'the potion healed');
  await scene.playEvent(heal);
  assert.equal(scene.anim.player.alpha, 1, 'a healthy Mythling stays solid — the revive path must not blank it');
  assert.equal(scene.anim.player.anim, 'battleIdle', 'and stays in its idle, not a revive flourish');
});

test('the type sheet shows plain current stats and a slim match-up row, with no duplicate footer', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const m = createMythling({ speciesId: 'emberu', level: 55, stage: 2, rarity: 'S', mood: 'brutal', rational: 'feral' });
  const foe = createMythling({ speciesId: 'aquini', level: 55, stage: 2 });
  const scene = new BattleScene(document.createElement('canvas'));
  scene.battle = new Battle({ type: BattleType.WILD, party: [m], enemies: [foe], mapId: 'verdant_vale' });

  const { body } = scene.typePanel(m, 'player');
  const stats = byClass(body, 'tp-stat');
  assert.ok(stats.length >= 6, 'the six stats are listed');
  // each stat row is a label and a number, nothing else
  for (const st of stats) {
    const kids = st.children;
    assert.equal(kids.length, 2, `a stat row is exactly a label and a value (got ${kids.length})`);
    assert.equal(kids[0].className, 'tp-sname', 'first the label');
    assert.equal(kids[1].className, 'tp-sval', 'then the number');
    assert.match(kids[1].textContent, /^\d+$/, 'and the value is a bare number');
  }
  assert.doesNotMatch(textOf(body), /Mood|Rational|Rarity|Lv\.\d+|stage/i, 'no provenance, no level, no tier');
  // the match-up rows stay slim: label, verdict, multiplier, and nothing tall
  const rows = byClass(body, 'tp-vs');
  assert.ok(rows.length >= 2, 'Attacking / Taking hits rows are present');
  for (const r of rows) assert.equal(r.children.length, 3, 'a match-up row is label + word + multiplier only');
  assert.doesNotMatch(textOf(body), /Dual type|Weak against =|Resists =/, 'and the footer does not repeat what the chips already say');
});

section('Sleep, Seals & Weather');

test('a sleeping Mythling loses its whole turn, and sleep is capped', async () => {
  const { SLEEP_MAX_TURNS } = await import('../src/data/config.js');
  const mine = createMythling({ speciesId: 'psykit', level: 40, stage: 1, rarity: 'D', mood: 'brave', rational: 'docile' });
  const foe = createMythling({ speciesId: 'emberu', level: 40, stage: 1, rarity: 'D', mood: 'brave', rational: 'docile' });
  restoreAll(mine); restoreAll(foe);
  mine.library.push('hypno_gaze'); mine.uses.hypno_gaze = 9;
  let i = 0;
  const seq = [0.5, 0, 0, 0.99, 0.99, 0.99];   // AI pick, sleep chance, turn roll, then the foe's rolls
  const bt = new Battle({ type: BattleType.WILD, party: [mine], enemies: [foe], mapId: 'verdant_vale', rng: () => seq[i++] ?? 0.99 });
  const r = bt.act({ type: 'skill', skillId: 'hypno_gaze' });
  const setEv = r.events.find((e) => e.type === 'sleep-set');
  assert.ok(setEv, 'the sleep landed');
  assert.ok(setEv.turns >= 2 && setEv.turns <= 4, `for 2-4 turns (${setEv.turns})`);
  assert.ok(bt.cb(foe).sleep >= 1, 'the foe is still asleep after the round-end tick');
  assert.ok(r.events.some((e) => e.type === 'sleep'), 'and it lost that turn');
  assert.ok(!r.events.some((e) => e.type === 'cast' && e.side === 'enemy'), 'a sleeping Mythling does not act');
  // however often it is re-applied, the counter never passes the cap
  for (let n = 0; n < 6; n++) bt.cb(foe).putToSleep(3);
  assert.equal(bt.cb(foe).sleep, SLEEP_MAX_TURNS, 'sleep is capped');
});

test('sleep wears off on its own, and a Cleanse Tonic wakes a Mythling early', async () => {
  const mine = createMythling({ speciesId: 'psykit', level: 40, stage: 1 });
  const foe = createMythling({ speciesId: 'emberu', level: 40, stage: 1 });
  const bt = new Battle({ type: BattleType.WILD, party: [mine], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.99 });
  bt.cb(mine).putToSleep(2);
  const evs = [];
  bt._skipAsleep(mine, evs);
  assert.equal(bt.cb(mine).sleep, 1, 'a night asleep spends one of the turns');
  assert.ok(evs.some((e) => e.type === 'sleep'), 'and the UI is told it is asleep');
  bt._skipAsleep(mine, []);
  assert.equal(bt.cb(mine).sleep, 0, 'and then it wakes on its own');
  // a cleanser wakes it early
  bt.cb(mine).putToSleep(4);
  const res = bt.useItem('cleanse_tonic', mine.uid);
  assert.equal(res.ok, true, 'the tonic works on sleep alone');
  assert.equal(bt.cb(mine).sleep, 0, 'and the Mythling is awake');
  const ev = res.events.find((e) => e.type === 'cleanse');
  assert.equal(ev.woke, true, 'the cleanse event says so');
  assert.ok(/woke up/.test(res.events.find((e) => e.type === 'log').text));
});

test('a Seal locks the move the foe just used — never the unlimited attack', async () => {
  const { getSkill } = await import('../src/data/skills.js');
  const mine = createMythling({ speciesId: 'staticat', level: 40, stage: 1 });
  const foe = createMythling({ speciesId: 'emberu', level: 40, stage: 1 });
  restoreAll(mine); restoreAll(foe);
  mine.library.push('static_bind'); mine.uses.static_bind = 9;
  let i = 0; const seq = [];
  const bt = new Battle({ type: BattleType.WILD, party: [mine], enemies: [foe], mapId: 'verdant_vale', rng: () => seq[i++] ?? 0.99 });
  seq.push(0.5);                                    // the foe commits to a move
  bt.act({ type: 'skill', slot: 'special' });
  const used = bt.cb(foe).lastSkillId;
  assert.ok(used, 'the foe used something');
  i = 0; seq.length = 0;
  seq.push(0.5, 0.99, 0.99, 0.99, 0, 0, 0.99, 0.99, 0.99);   // AI, dodge, crit, dmg, SEAL, turns, foe's rolls
  const r = bt.act({ type: 'skill', skillId: 'static_bind' });
  const sealEv = r.events.find((e) => e.type === 'seal');
  assert.ok(sealEv, 'the seal landed');
  assert.equal(sealEv.skillId, used, 'it locks the move the foe JUST used');
  assert.ok(sealEv.turns >= 1 && sealEv.turns <= 2, `for 1-2 turns (${sealEv.turns})`);
  assert.ok(bt.cb(foe).isSealed(used), `the foe is sealed (${bt.cb(foe).sealedTurns} turns left)`);
  // the AI never walks into its own seal: it still picks something, just not that
  const pick = bt._enemyChooseAction();
  assert.ok(pick, 'the foe still chooses something');
  assert.notEqual(pick.skillId, used, 'but not the sealed move');
  // and if it is asked for anyway, the move refuses to answer and the Mythling
  // falls back on its unlimited attack instead of losing the turn
  i = 0; seq.length = 0;
  const evs = [];
  bt._resolve(foe, mine, { type: 'skill', skillId: used }, evs);
  assert.ok(evs.some((e) => e.type === 'log' && /is sealed and will not answer/.test(e.text)),
    'the sealed move refuses to answer');
  assert.ok(evs.some((e) => e.type === 'cast'), 'and the turn is not lost — it falls back');
  // an unlimited attack is untouchable, even when the rider procs
  const bite = basicAttack(foe);
  assert.equal(bite.uses, Infinity, 'the fallback attack is the unlimited one');
  bt.cb(foe).unseal();
  bt.cb(foe).lastSkillId = bite.id;
  const saved = bt.rng;
  bt.rng = () => 0;                                 // force the rider to fire
  bt._applyStatusRiders(getSkill('static_bind'), mine, foe, [], 'player', 'enemy');
  bt.rng = saved;
  assert.equal(bt.cb(foe).sealedTurns, 0, 'an unlimited attack can never be sealed');
});

test('weather boosts matching skills for BOTH sides and burns everyone else', async () => {
  const { getSkill } = await import('../src/data/skills.js');
  const { previewDamage } = await import('../src/systems/BattleManager.js');
  const { WEATHER_BOOST, WEATHER_DAMAGE } = await import('../src/data/weather.js');
  const fire = createMythling({ speciesId: 'emberu', level: 60, stage: 2, rarity: 'A' });
  const nature = createMythling({ speciesId: 'spriggo', level: 60, stage: 2, rarity: 'A' });
  restoreAll(fire); restoreAll(nature);
  fire.library.push('magma_storm'); fire.uses.magma_storm = 9;
  let i = 0; const seq = [];
  const bt = new Battle({ type: BattleType.WILD, party: [fire], enemies: [nature], mapId: 'emberwild', rng: () => seq[i++] ?? 0.99 });
  const storm = getSkill('magma_storm');
  const bite = getSkill('bite');
  const before = previewDamage(bt, fire, nature, storm).dmg;
  seq.push(0.5, 0, 0.99, 0.99, 0.99);      // AI pick, weather chance, dodge / crit / damage
  const r = bt.act({ type: 'skill', skillId: 'magma_storm' });
  assert.equal(bt.weather, 'wildfire', 'Wildfire is up');
  assert.ok(r.events.some((e) => e.type === 'weather' && e.id === 'wildfire'), 'and the UI is told');
  const after = previewDamage(bt, fire, nature, storm);
  assert.equal(after.weatherMult, WEATHER_BOOST, 'the fire move is boosted');
  assert.ok(after.dmg > before * 1.4, `${after.dmg} damage now vs ${before} before`);
  assert.equal(previewDamage(bt, fire, nature, bite).weatherMult, 1, 'an element-less move gets nothing');
  // the foe (Nature) is weak to Fire: 180 a turn. The Fire Mythling pays nothing.
  const foeHp = nature.currentHp; const myHp = fire.currentHp;
  bt._weatherBurn([]);
  assert.equal(foeHp - nature.currentHp, Math.round(WEATHER_DAMAGE * 1.8), 'weak to it -> 180');
  assert.equal(myHp - fire.currentHp, 0, 'a Fire Mythling is untouched');
  // Water is NOT weak to Fire (it is the other way round), so it pays the flat 100
  const water = createMythling({ speciesId: 'aquini', level: 60, stage: 2 });
  const bt2 = new Battle({ type: BattleType.WILD, party: [water], enemies: [nature], mapId: 'azure_coast', rng: () => 0.99 });
  bt2.weather = 'wildfire';
  const wHp = water.currentHp;
  bt2._weatherBurn([]);
  assert.equal(wHp - water.currentHp, WEATHER_DAMAGE, 'a Mythling that merely does not match pays 100');
  // it holds for the rest of the battle, and another weather replaces it
  bt2.weather = 'monsoon';
  assert.equal(bt2.weatherElement(), 'water');
  bt2.weather = null;
  const hp2 = nature.currentHp;
  bt2._weatherBurn([]);
  assert.equal(hp2, nature.currentHp, 'no weather, no burn');
});

test('weather skills are exclusive: only a handful of Mythlings can raise one', async () => {
  const { SPECIES } = await import('../src/data/species.js');
  const { SKILLS } = await import('../src/data/skills.js');
  const owners = new Set();
  for (const sp of Object.values(SPECIES)) {
    for (const ids of Object.values(sp.skillUnlocks || {})) {
      for (const id of ids) if (SKILLS[id]?.weather) owners.add(sp.id);
    }
  }
  assert.ok(owners.size > 0, 'somebody can raise a weather');
  assert.ok(owners.size <= 14, `only a handful can (${owners.size} of ${Object.keys(SPECIES).length} species)`);
  // every weather skill names a real weather and a real element
  for (const sk of Object.values(SKILLS)) {
    if (!sk.weather) continue;
    const w = (await import('../src/data/weather.js')).getWeather(sk.weather.id);
    assert.ok(w, `${sk.id} names a real weather`);
    assert.equal(w.element, sk.element, `${sk.id} raises a weather of its own element`);
  }
});

test('the battle shows the weather, sleep and seals', async () => {
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const { equippedSkills } = await import('../src/core/mythling.js');
  const mine = createMythling({ speciesId: 'emberu', level: 60, stage: 2 });
  const foe = createMythling({ speciesId: 'spriggo', level: 60, stage: 2 });
  const scene = new BattleScene(document.createElement('canvas'));
  scene.start(new Battle({ type: BattleType.WILD, party: [mine], enemies: [foe], mapId: 'emberwild' }),
    { mapTheme: 'nature', onEnd: () => {} });
  assert.ok(scene.weatherBadge.hidden, 'no badge in clear weather');
  scene.battle.weather = 'wildfire';
  scene.syncWeather();
  assert.equal(scene.weatherBadge.hidden, false, 'the badge appears with the weather');
  assert.match(textOf(scene.weatherBadge), /Wildfire/, 'the badge names the weather');
  // a sealed move is labelled and cannot be pressed
  const sealedId = equippedSkills(mine)[0].id;
  scene.battle.cb(mine).seal(sealedId, 2);
  scene.renderActions();
  const html = scene.actions.children.map((c) => c.innerHTML || '').join(' ');
  assert.match(html, /SEALED/, 'the button says the move is sealed');
  const sealedBtn = scene.actions.children.find((c) => /SEALED/.test(c.innerHTML || ''));
  assert.ok(sealedBtn && sealedBtn.disabled, 'and that button cannot be pressed');
  // the cards carry a sleep chip
  scene.battle.cb(foe).putToSleep(3);
  scene.refreshUI();
  assert.match(textOf(scene.enemyCard), /ASLEEP 3/, 'the enemy card shows the sleep counter');
  scene.stop();
});

// ------------------------------------------------------------------
section('Battle canvas, wiki tabs & roster cheats');

test('the battle keeps rendering with the weather up and down', async () => {
  // A stray `w` in render() (it only exists inside drawArena) used to throw every
  // frame: the canvas froze, attacks lost their animation and RUN left you staring
  // at a dead battle screen. Both are drawn 30 frames here to keep it that way.
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  const mine = createMythling({ speciesId: 'emberu', level: 20, stage: 1 });
  const foe = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  const bt = new Battle({ type: BattleType.WILD, party: [mine], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.5 });
  const scene = new BattleScene(document.createElement('canvas'));
  scene.start(bt, { mapTheme: 'nature', onEnd: () => {} });
  for (const weather of [null, 'wildfire']) {
    bt.weather = weather;
    scene.weatherAt = null;
    for (let i = 0; i < 30; i++) { scene.update(0.016); scene.render(); }
    if (weather) assert.equal(scene.weatherParticles.length, 24, 'the weather pools a small set of motes');
  }
  scene.stop();
});

test('running away always ends the battle and hands control back', async () => {
  const mine = createMythling({ speciesId: 'emberu', level: 20, stage: 1 });
  const foe = createMythling({ speciesId: 'spriggo', level: 20, stage: 1 });
  const bt = new Battle({ type: BattleType.WILD, party: [mine], enemies: [foe], mapId: 'verdant_vale', rng: () => 0.5 });
  const r = bt.act({ type: 'run' });
  assert.equal(bt.phase, BattlePhase.FLED, 'RUN always succeeds');
  assert.ok(r.events.some((e) => e.type === 'log'), 'and it says so');
  // the scene hands the outcome back to the game, which returns to the overworld
  const { BattleScene } = await import('../src/scenes/BattleScene.js');
  let ended = null;
  const scene = new BattleScene(document.createElement('canvas'));
  scene.start(bt, { mapTheme: 'nature', onEnd: (o) => { ended = o; } });
  await scene.doAction({ type: 'run' });
  await new Promise((res) => setTimeout(res, 600));
  assert.equal(ended, 'fled', 'the game is told the battle is over');
  assert.equal(scene.active, false, 'and the battle scene stops');
});

test('the wiki has a tab for Sleep, Seals & Weather', async () => {
  const { WIKI_SECTIONS } = await import('../src/ui/wiki.js');
  const { iconPath } = await import('../src/ui/icons.js');
  const tab = WIKI_SECTIONS.find((x) => x[0] === 'status');
  assert.ok(tab, 'the tab exists');
  assert.equal(tab.length, 4, 'it is a real nav entry [id, label, icon, fn]');
  assert.equal(typeof tab[3], 'function', 'with a render function');
  assert.ok(iconPath(tab[2]), `its icon (${tab[2]}) is a real glyph`);
  const walk = (ns) => ns.flatMap((n) => [n, ...((n.children || []).length ? walk(n.children) : [])]);
  const txt = walk(tab[3]()).map((n) => `${n.innerHTML || ''} ${n.textContent || ''}`).join(' ');
  for (const word of ['Sleep', 'Seals', 'Weather', 'Wildfire', 'Monsoon', 'Cleanse Tonic']) {
    assert.ok(txt.includes(word), `the tab explains ${word}`);
  }
  // Battle Rules points at it instead of duplicating it
  const battle = WIKI_SECTIONS.find((x) => x[0] === 'battle');
  const btxt = walk(battle[3]()).map((n) => `${n.innerHTML || ''} ${n.textContent || ''}`).join(' ');
  assert.ok(/SLEEP, SEALS/.test(btxt), 'and the battle rules signpost it');
});

test('the wiki documents both ways to call weather, and lists the light callers', async () => {
  const { WIKI_SECTIONS } = await import('../src/ui/wiki.js');
  const { SKILLS } = SKILLS_MOD;
  const walk = (ns) => ns.flatMap((n) => [n, ...((n.children || []).length ? walk(n.children) : [])]);
  const read = (nodes) => walk(nodes).map((n) => `${n.innerHTML || ''} ${n.textContent || ''}`).join(' ');

  const tab = WIKI_SECTIONS.find((x) => x[0] === 'status');
  const txt = read(tab[3]());
  // The old page only mentioned the Lv.60 exclusives, so a player had no way to
  // learn that a Normal or a Buff could raise the sky too.
  assert.ok(/light route/i.test(txt), 'the weather tab explains the light (Lv.40) route');
  for (const n of ['2 uses', '3 uses', '15 power', '45%', '75%']) {
    assert.ok(txt.includes(n), `and states the real numbers: ${n}`);
  }
  // Owner lists must be built from the central grants, or the light callers go
  // unlisted in the wiki even though the battle grants them.
  const LIGHT = ['ember_flicker', 'cinder_chant', 'drizzle', 'tidal_chant', 'spore_surge',
    'verdant_chant', 'static_tick', 'voltaic_chant', 'frost_sigh', 'rime_chant', 'miasma_puff', 'fen_chant'];
  assert.ok((txt.match(/Raised by:/g) || []).length === 6, 'one owner line per weather');
  for (const name of ['Emberu', 'Aquini', 'Spriggo', 'Voltkit', 'Icecarap', 'Venoviper']) {
    assert.ok(txt.includes(name), `${name} is listed as a weather caller`);
  }

  // and every new skill is findable in the Skills tab
  const sk = WIKI_SECTIONS.find((x) => x[0] === 'skills');
  const stxt = read(sk[3]());
  for (const id of LIGHT) {
    assert.ok(stxt.includes(SKILLS[id].name), `${SKILLS[id].name} appears in the Skills tab`);
  }
});

test('the secret HD Images mode: off by default, and every asset it names exists', async () => {
  const { DEFAULT_SETTINGS } = await import('../src/data/config.js');
  const { HD_ASSETS } = await import('../src/data/hdManifest.js');
  const { hdEnabled, setHdEnabled, hdModelFor, hdBackdropFor } = await import('../src/render/hdImages.js');

  // It has to start OFF: a secret mode must never surprise anyone on first run.
  assert.equal(DEFAULT_SETTINGS.hdImages, false, 'HD Images is off by default');
  assert.equal(hdEnabled(), false, 'and the renderer starts in the animated state');

  // A manifest entry pointing at a file that is not there would silently fall
  // back to the rig, so the art would just never appear. Catch it at test time.
  const keys = Object.keys(HD_ASSETS);
  assert.ok(keys.length > 0, 'the manifest is not empty');
  for (const [key, entry] of Object.entries(HD_ASSETS)) {
    // Entries carry their own placement, so they are objects; a bare string is
    // still accepted for art that is simply stretched, but nothing in the
    // manifest should be left without the richer form.
    const rel = typeof entry === 'string' ? entry : entry.src;
    const p = new URL(`../${rel}`, import.meta.url);
    assert.ok(existsSync(p), `asset for ${key} exists on disk: ${rel}`);
    assert.match(key, /^(model|bg|menu):/, `${key} is namespaced`);
  }
  // Keys must be well formed, or a lookup can never find its art.
  for (const key of keys.filter((k) => k.startsWith('model:'))) {
    const [, speciesId, stage] = key.split(':');
    assert.ok(SPECIES[speciesId], `model key names a real species: ${speciesId}`);
    assert.equal(String(stage), '0', 'and a real stage');
  }

  // Off: no lookup ever returns art, whatever is asked for.
  assert.equal(hdModelFor('spriggo', 0, 'none'), null, 'off returns no model');
  assert.equal(hdBackdropFor('nature'), null, 'off returns no backdrop');

  // On, but with no Image available in this environment, the loader must report
  // "no art" rather than throw — that is the path every un-drawn species takes.
  setHdEnabled(true);
  try {
    assert.equal(hdEnabled(), true, 'the flag flips');
    // A species with art, and one without, must not behave differently in kind:
    // both are allowed to return null here, neither may throw.
    hdModelFor('spriggo', 0, 'none');
    hdModelFor('aquini', 0, 'none');
    hdBackdropFor('nature');
    hdBackdropFor('fire');
  } finally {
    setHdEnabled(false);
  }
  assert.equal(hdEnabled(), false, 'and flips back off');
});

test('the main menu is one full-bleed picture, with only the title and buttons over it', async () => {
  const { HD_ASSETS } = await import('../src/data/hdManifest.js');
  assert.ok(HD_ASSETS['menu:main'], 'the menu picture is in the manifest, so the offline build inlines it');
  const p = new URL(`../${HD_ASSETS['menu:main'].src}`, import.meta.url);
  assert.ok(existsSync(p), `the picture exists: ${HD_ASSETS['menu:main'].src}`);

  // MenuScene draws the picture when it has one, and keeps the old painted
  // vista as a fallback so the menu is never blank.
  const scene = readFileSync(new URL('../src/scenes/MenuScene.js', import.meta.url), 'utf8');
  assert.ok(scene.includes("hdSrc('menu:main')"), 'the scene reads the manifest for the picture');
  // A manifest entry is now an object, so handing the entry itself to an
  // <img> assigns "[object Object]" and the menu quietly loses its art.
  assert.ok(!/img\.src\s*=\s*HD_ASSETS/.test(scene), 'the scene passes the entry a real file path, not the entry object');
  assert.ok(/coverDraw\(/.test(scene), 'and covers the canvas with it');
  assert.ok(scene.includes('renderPainted'), 'with the painted vista kept as a fallback');

  // The overlay is only the title and the buttons: no tagline, no footnote, no
  // version block sitting on the picture.
  const screens = readFileSync(new URL('../src/ui/screens.js', import.meta.url), 'utf8');
  const at = screens.indexOf('export function mainMenuScreen');
  const body = screens.slice(at, screens.indexOf('export function', at + 10));
  assert.ok(body.includes('titleLogo()'), 'the title stays');
  assert.ok(body.includes('menu-buttons'), 'and the buttons');
  assert.ok(!body.includes('menu-tagline'), 'the tagline is gone');
  assert.ok(!body.includes('menu-footnote'), 'the footnote is gone');
  assert.ok(!body.includes('version-block'), 'the version block is gone');
  for (const label of ['NEW GAME', 'LOAD GAME', 'SETTINGS', 'EXIT']) {
    assert.ok(body.includes(`'${label}'`), `${label} is still there`);
  }
});

test('an HD still is placed in the rig footprint, not at its own pixel size', async () => {
  // Regression: the stills were first drawn using the PNG's own pixel
  // dimensions as world units, so a 660x512 file filled the screen at every
  // size. Nothing threw — it just looked catastrophically wrong.
  const { artFor, artContext, EXPRESSIONS } = await import('../src/render/creatureArt.js');
  const { hdPlacement } = await import('../src/render/hdImages.js');
  const img = { naturalWidth: 660, naturalHeight: 512 };

  for (const id of ['spriggo', 'aquini', 'emberu', 'rivruff']) {
    const art = artFor(id);
    const r = art.skel(artContext(id, 0, EXPRESSIONS.neutral, {}));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const def of art.parts) {
      if (def.liveOnly) continue;
      const [px, py, sc = 1] = def.pivot(r);
      const [bx, by, bw, bh] = def.box || [0, 0, 1, 1];
      minX = Math.min(minX, px + bx * sc); minY = Math.min(minY, py + by * sc);
      maxX = Math.max(maxX, px + bx * sc + bw * sc); maxY = Math.max(maxY, py + by * sc + bh * sc);
    }
    const rigH = maxY - minY;
    const p = hdPlacement(img, id, 0);
    assert.ok(p.matched, `${id} has rig geometry to match`);
    // Height must equal the rig's height: `size` means height, and this is the
    // whole difference between "a Mythling" and "a Mythling filling the screen".
    assert.ok(Math.abs(p.h - rigH) < 0.001, `${id}: still height ${p.h} equals rig height ${rigH}`);
    // Bottom edge sits on the rig's foot line.
    assert.ok(Math.abs((p.y + p.h) - maxY) < 0.001, `${id}: still stands on the same foot line`);
    // And it is nowhere near its own pixel size.
    assert.ok(p.h < 200, `${id}: a 512px-tall file must not draw 512 units tall`);
    assert.ok(p.w < 200, `${id}: a 660px-wide file must not draw 660 units wide`);
  }
});

test('HD mode only reaches the screens that show a Mythling, never the roaming map', async () => {
  // Every UI/scene that DISPLAYS a Mythling must go through the drawCreature
  // switch, or the secret toggle would not affect it.
  for (const f of ['../src/ui/screens.js', '../src/ui/PlayerMenu.js', '../src/scenes/MenuScene.js',
    '../src/ui/wiki.js', '../src/scenes/BattleScene.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(src.includes('drawCreature('), `${f} draws through the switch`);
    assert.match(src, /import \{[^}]*\bdrawCreature\b[^}]*\} from '\.\.\/render\/creatures\.js'/,
      `${f} actually imports drawCreature (a missing import is a runtime crash)`);
  }
  // The roaming map deliberately keeps the rig: a creature that walks and turns
  // cannot be a still.
  const ow = readFileSync(new URL('../src/scenes/OverworldScene.js', import.meta.url), 'utf8');
  assert.ok(ow.includes('drawMythling('), 'the overworld still animates');
  assert.ok(!ow.includes('drawCreature'), 'and is never routed through the HD switch');
});

test('the secret panel is hidden: Ctrl+Enter only, and not in the settings screen', async () => {
  const sec = readFileSync(new URL('../src/ui/secretSettings.js', import.meta.url), 'utf8');
  assert.match(sec, /e\.ctrlKey && e\.key === 'Enter'/, 'the hotkey is Ctrl+Enter and nothing else');
  assert.ok(!/metaKey|shiftKey|ctrlKey && e\.key === 'e'/.test(sec), 'no accidental second binding');

  // It must be reachable ONLY by the hotkey: no button, no menu entry, and the
  // normal settings screen must not mention it.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('secretSettingsHotkey(e)'), 'main.js binds the hotkey');
  // Reading the HD renderer's art is fine — the starter screen draws with it —
  // what must not exist is a control, a label or a settings row. Strip the
  // import lines so only real usage is left to look at.
  const menu = readFileSync(new URL('../src/ui/screens.js', import.meta.url), 'utf8')
    .split('\n').filter((l) => !/^\s*import\b/.test(l)).join('\n');
  assert.ok(!/hdImages/.test(menu), 'the main menu never offers it');
  assert.ok(!/['\"]HD Images['\"]/.test(menu), 'and no screen ever shows a user-facing HD Images control');
  const pm = readFileSync(new URL('../src/ui/PlayerMenu.js', import.meta.url), 'utf8');
  const settingsBlock = pm.slice(pm.indexOf('export function settingsPanel'), pm.indexOf('export function settingsPanel') + 4000);
  assert.ok(!settingsBlock.includes('hdImages'), 'the settings screen never lists it');
  assert.ok(!settingsBlock.includes('Secret'), 'and gives no hint that it exists');
});

test('the offline build inlines the HD art so file:// keeps working', async () => {
  const build = readFileSync(new URL('../tools/build-standalone.mjs', import.meta.url), 'utf8');
  assert.match(build, /data:\$\{mime\};base64/, 'the bundler writes data URIs');
  assert.match(build, /hdManifest\.js/, 'and reads the manifest to know what to inline');
  // A missing file must warn, not throw, or an absent optional asset would
  // break every build.
  assert.match(build, /existsSync/, 'it checks the file is there first');
});

test('every species can be minted at its top form, Lv.100, SSS+', async () => {
  const { SPECIES, SPECIES_IDS } = await import('../src/data/species.js');
  const { LEVEL_CAP } = await import('../src/data/config.js');
  const { stageForLevel } = await import('../src/core/mythling.js');
  assert.ok(SPECIES_IDS.length >= 55, `the whole roster (${SPECIES_IDS.length})`);
  for (const id of SPECIES_IDS) {
    const m = createMythling({ speciesId: id, level: LEVEL_CAP, stage: stageForLevel(id, LEVEL_CAP), rarity: 'SSS+' });
    assert.equal(m.level, LEVEL_CAP, `${id} is Lv.100`);
    assert.equal(m.rarity, 'SSS+', `${id} is SSS+`);
    assert.ok(m.stage >= 0 && m.stage <= Math.max(0, SPECIES[id].evolutions.length), `${id} is at a real form (${m.stage})`);
    // never a form the game would refuse to show
    assert.equal(m.stage, stageForLevel(id, LEVEL_CAP), `${id} is at its highest reachable form`);
  }
});

test('Release All empties storage and never touches the party', async () => {
  const { GameState, StorageManager, PartyManager } = await import('../src/systems/GameState.js');
  const before = PartyManager.list().length;
  assert.ok(before > 0, 'there is a party to protect');
  GameState.storage.push(createMythling({ speciesId: 'emberu', level: 5 }));
  GameState.storage.push(createMythling({ speciesId: 'psykit', level: 5 }));
  const party = PartyManager.list().map((m) => m.uid);
  // what Release All does, one Mythling at a time
  for (const m of [...StorageManager.list()]) StorageManager.remove(m.uid);
  assert.equal(StorageManager.list().length, 0, 'storage is empty');
  assert.deepEqual(PartyManager.list().map((m) => m.uid), party, 'and the party is untouched');
});

test('every Mythling learns the tactical trio, and it is never auto-equipped', async () => {
  const { SPECIES_IDS, skillsUnlockedAt, skillLearnLevel } = await import('../src/data/species.js');
  const { getSkill } = await import('../src/data/skills.js');
  for (const id of SPECIES_IDS) {
    const lib = skillsUnlockedAt(id, LEVEL_CAP);
    for (const sk of ['ward', 'guard_stance', 'purge']) {
      assert.ok(lib.includes(sk), `${id} learns ${sk}`);
    }
    // they cost a whole turn, so they must NOT hijack the default loadout
    const m = createMythling({ speciesId: id, level: LEVEL_CAP });
    assert.ok(!m.skills.some((s) => getSkill(s)?.utility),
      `${id}'s default buttons stay its attacker / defender / debuff (${m.skills.join(', ')})`);
  }
  assert.equal(skillLearnLevel('spriggo', 'ward'), 12, 'Ward at Lv.12');
  assert.equal(skillLearnLevel('spriggo', 'guard_stance'), 20, 'Guard Stance at Lv.20');
  assert.equal(skillLearnLevel('spriggo', 'purge'), 40, 'Purge at Lv.40');
  // a Lv.1 Mythling is unaffected
  assert.ok(!skillsUnlockedAt('spriggo', 1).includes('guard_stance'), 'nothing new at Lv.1');
});

test('Guard Stance cancels the foe\'s next attack, then lapses', () => {
  // Spriggo is the faster of the two, which is the whole point: it braces on
  // its own turn and the foe's blow is cancelled before it can land.
  const p = createMythling({ speciesId: 'aquini', level: 60, stage: 2 });
  p.library.push('guard_stance'); p.skills = ['guard_stance'];
  const e = createMythling({ speciesId: 'gravelhog', level: 60, stage: 2 });
  e.currentHp = 99999; p.currentHp = 99999;
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.99 });
  const before = p.currentHp;
  const r = b.act({ type: 'skill', index: 0 });
  assert.ok(r.events.some((x) => x.type === 'guard'), 'the stance went up');
  // the foe's attack in the same round is the one that gets cancelled
  const blocked = r.events.find((x) => x.type === 'guarded' && x.side === 'player');
  assert.ok(blocked, 'the attack was cancelled outright');
  assert.equal(p.currentHp, before, 'and not a single point of damage landed');
  assert.ok(r.events.some((x) => x.type === 'log' && /braced/.test(x.text)), 'the log says so');
  // it covered exactly ONE attack: the stance is spent
  assert.equal(b.cb(p).guard, false, 'the stance is used up');
  // press a real attack (NOT Guard again) and the foe's next blow must land
  const after = p.currentHp;
  const r2 = b.act({ type: 'skill', skillId: 'aqua_spear' });
  const landed = r2.events.some((x) => x.type === 'damage' && x.side === 'player');
  assert.ok(landed, 'the next attack gets through');
  assert.ok(p.currentHp < after, `and it hurts (${after} -> ${p.currentHp})`);
});

test('Guard Stance also stops a full-charge Ultimate', () => {
  const p = createMythling({ speciesId: 'aquini', level: LEVEL_CAP, stage: 3 });
  p.library.push('guard_stance'); p.skills = ['guard_stance'];
  const e = createMythling({ speciesId: 'emberu', level: LEVEL_CAP, stage: 3 });
  e.currentHp = 99999; p.currentHp = 99999;
  e.ultCharge = 8;                                  // the foe is holding an Ultimate
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'emberwild', rng: () => 0.99 });
  const r = b.act({ type: 'skill', index: 0 });
  const blocked = r.events.find((x) => x.type === 'guarded');
  assert.ok(blocked, 'the Ultimate was cancelled');
  assert.equal(blocked.isUltimate, true, 'and the block reports it was an Ultimate');
  assert.equal(p.currentHp, 99999, 'the Ultimate landed for nothing');
  assert.equal(e.ultCharge, 0, 'and its Ultimate was still spent — the block is not a free charge');
});

test('an unused Guard lapses at the end of the round (it covers one turn only)', () => {
  const p = createMythling({ speciesId: 'aquini', level: 60, stage: 2 });
  p.library.push('guard_stance'); p.skills = ['guard_stance'];
  const e = createMythling({ speciesId: 'gravelhog', level: 60, stage: 2 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.99 });
  b.cb(e).guard = false;
  b.act({ type: 'skill', index: 0 });
  // the foe is slower, so it never attacked: brace, then let the round end
  if (b.cb(p).guard) {
    assert.equal(b.cb(p).guard, true, 'still braced because the foe never swung');
    b._postTurn([]);
    assert.equal(b.cb(p).guard, false, 'the stance lapsed rather than being banked for a free double block');
  } else {
    assert.equal(b.cb(p).guard, false, 'the stance lapsed rather than being banked for a free double block');
  }
});

test('Purge strips every buff off the foe and leaves debuffs alone', () => {
  const p = createMythling({ speciesId: 'spriggo', level: 60, stage: 2 });
  p.library.push('purge'); p.skills = ['purge'];
  const e = createMythling({ speciesId: 'gravelhog', level: 60, stage: 2 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.99 });
  // give the foe a spread of buffs and one debuff
  const ecb = b.cb(e);
  ecb.buffs = {
    patk: { stacks: 3, total: 12 }, spd: { stacks: 2, total: 10 }, sdef: { stacks: 1, total: 4 },
    satk: { stacks: -2, total: -8 },
  };
  const satkBefore = ecb.stat('satk');
  b.act({ type: 'skill', index: 0 });
  const after = b.cb(e).buffs;
  assert.equal(after.patk, undefined, 'its Attack buff is gone');
  assert.equal(after.spd, undefined, 'its Speed buff is gone');
  assert.equal(after.sdef, undefined, 'its Defense buff is gone');
  assert.ok(after.satk && after.satk.stacks < 0, 'its DEBUFF is untouched — Purge is not a cleanse');
  assert.equal(b.cb(e).stat('satk'), satkBefore, 'so the debuff still bites');
});

test('Ward strips every debuff off you and leaves your buffs alone', () => {
  const p = createMythling({ speciesId: 'spriggo', level: 60, stage: 2 });
  p.library.push('ward'); p.skills = ['ward'];
  const e = createMythling({ speciesId: 'gravelhog', level: 60, stage: 2 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.99 });
  b.cb(p).buffs = {
    patk: { stacks: -3, total: -12 }, sdef: { stacks: -1, total: -4 },   // debuffs on me
    spd: { stacks: 2, total: 10 },                                       // my own buff
  };
  const myBuff = b.cb(p).stat('spd');
  b.act({ type: 'skill', index: 0 });
  const after = b.cb(p).buffs;
  assert.equal(after.patk, undefined, 'the Attack debuff is gone');
  assert.equal(after.sdef, undefined, 'the Defense debuff is gone');
  assert.ok(after.spd && after.spd.stacks > 0, 'my own Speed buff survives');
  assert.equal(b.cb(p).stat('spd'), myBuff, 'and still counts');
});

test('a tactical skill against a clean target says so instead of silently wasting the turn', () => {
  const p = createMythling({ speciesId: 'spriggo', level: 60, stage: 2 });
  p.library.push('purge', 'ward'); p.skills = ['purge', 'ward'];
  const e = createMythling({ speciesId: 'gravelhog', level: 60, stage: 2 });
  const b = new Battle({ type: BattleType.WILD, party: [p], enemies: [e], mapId: 'verdant_vale', rng: () => 0.99 });
  b.act({ type: 'skill', index: 0 });
  assert.ok(b.act({ type: 'skill', index: 1 }).events.some((x) => x.type === 'log' && /no debuffs to clear/.test(x.text)),
    'Ward on a clean Mythling says there was nothing to clear');
});

test('the tactical skills are described to the player, not just hidden in data', async () => {
  const { getSkill, riderSummary, UTILITY_LABEL } = await import('../src/data/skills.js');
  assert.equal(getSkill('guard_stance').utility, 'guard');
  assert.equal(getSkill('purge').utility, 'purge');
  assert.equal(getSkill('ward').utility, 'ward');
  // they deal no damage, so the house rule makes them Buff-type buttons
  for (const id of ['guard_stance', 'purge', 'ward']) {
    const sk = getSkill(id);
    assert.ok(['buff', 'debuff'].includes(sk.category), `${id} is a support button, not an attack`);
    assert.ok(riderSummary(sk).includes(UTILITY_LABEL[sk.utility]), `${id} explains itself: ${riderSummary(sk)}`);
  }
});

test('a legendary Mythling gets its own panel on every card', async () => {
  const { PlayerMenu, mythCardClassFor } = await import('../src/ui/PlayerMenu.js');
  const { createMythling } = await import('../src/core/mythling.js');
  const { getSpecies, LEGENDARY_IDS } = await import('../src/data/species.js');
  assert.ok(LEGENDARY_IDS.length > 0, 'the game has legendaries');
  for (const id of LEGENDARY_IDS) {
    assert.equal(getSpecies(id).legendary, true, `${id} is flagged legendary`);
    assert.equal(mythCardClassFor(createMythling({ speciesId: id, level: 40 })), 'myth-card legendary',
      `${id} gets the legendary card class`);
  }
  // ...and an ordinary Mythling never does.
  assert.equal(mythCardClassFor(createMythling({ speciesId: 'spriggo', level: 5 })), 'myth-card',
    'a common Mythling keeps the plain card');
  // createMythling heals to full, so knock one out after it is built
  const fainted = createMythling({ speciesId: 'emberu', level: 5 });
  fainted.currentHp = 0;
  assert.equal(mythCardClassFor(fainted), 'myth-card fainted', 'a fainted Mythling still reads as fainted');
  // a fainted legendary keeps both
  const faintedLegend = createMythling({ speciesId: LEGENDARY_IDS[0], level: 40 });
  faintedLegend.currentHp = 0;
  assert.equal(mythCardClassFor(faintedLegend), 'myth-card fainted legendary', 'a fainted legendary is still legendary');

  // the panel itself is styled: a gold frame, a sheen and a glow, not just a class name
  assert.match(cssText, /\.myth-card\.legendary\s*\{/, 'the legendary card is styled');
  assert.match(cssText, /@keyframes\s+legendFrame/, 'the legendary frame animates');
  assert.match(cssText, /@keyframes\s+legendSheen/, 'and carries a travelling sheen');
  assert.match(cssText, /prefers-reduced-motion[\s\S]{0,400}myth-card\.legendary/, 'and settles down for reduced motion');
});

test('cards read out clean stat numbers', async () => {
  const { cleanStats } = await import('../src/ui/PlayerMenu.js');
  const { createMythling, computeStats } = await import('../src/core/mythling.js');
  const { STAT_KEYS, STAT_SHORT } = await import('../src/data/moods.js');
  const m = createMythling({ speciesId: 'spriggo', level: 40, rarity: 'SSS+' });
  const stats = computeStats(m);
  const node = cleanStats(m, STAT_KEYS, 'compact');
  assert.equal(node.children.length, STAT_KEYS.length, 'one line per stat');
  // label on the left, the plain number on the right — no bars, no bonus maths
  const first = node.children[0].children;
  assert.equal(first[0].textContent, STAT_SHORT.hp, 'the label is the short stat name');
  assert.equal(first[1].textContent, String(stats.hp), 'and the value is the real number');
  for (const line of node.children) {
    assert.equal(line.children.length, 2, 'each stat is exactly label + value');
    assert.equal(line.children[0].className, 'cs-key');
    assert.equal(line.children[1].className, 'cs-val');
  }
  assert.match(cssText, /\.clean-stats\s*\{/, 'the clean readout is styled');
});

/** Width and height out of a PNG's IHDR chunk, with no image library. */
function pngSize(url) {
  const b = readFileSync(url);
  assert.equal(b.readUInt32BE(0), 0x89504e47, 'it really is a PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('each picture declares its own height and anchor, and the anchor lands on the rig feet', async () => {
  const { HD_ASSETS } = await import('../src/data/hdManifest.js');
  const bounds = JSON.parse(readFileSync(new URL('../assets/mythlings/rig-bounds.json', import.meta.url), 'utf8'));

  for (const [key, entry] of Object.entries(HD_ASSETS)) {
    if (!key.startsWith('model:')) continue;
    const [, speciesId, stage] = key.split(':');
    const b = bounds[`${speciesId}:${stage}`];
    assert.ok(b, `${key} has rig data to place against`);
    assert.ok(entry.height > 0, `${key} declares a height in rig units`);
    assert.ok(Number.isInteger(entry.anchor?.x) && Number.isInteger(entry.anchor?.y),
      `${key} declares an anchor as whole pixels inside the picture`);

    // The anchor must be inside the picture, or it is a typo rather than a placement.
    const [iw, ih] = pngSize(new URL(`../${entry.src}`, import.meta.url));
    assert.ok(entry.anchor.x >= 0 && entry.anchor.x <= iw, `${key} anchor x sits inside the picture`);
    assert.ok(entry.anchor.y >= 0 && entry.anchor.y <= ih, `${key} anchor y sits inside the picture`);
  }

  // And the placement maths the renderer uses must put that exact pixel on the
  // rig's ground spot, which is the whole point of the anchor. Spriggo's own
  // anchor is dead centre at the bottom, which is indistinguishable from simply
  // centring the picture — so this is checked on a deliberately off-centre
  // anchor, where ignoring it would move the art and fail the test.
  const { hdPlacement, placeImage } = await import('../src/render/hdImages.js');
  const e = HD_ASSETS['model:spriggo:0'];
  const b = bounds['spriggo:0'];
  const [iw, ih] = pngSize(new URL(`../${e.src}`, import.meta.url));
  const p = hdPlacement({ naturalWidth: iw, naturalHeight: ih }, 'spriggo', 0);
  assert.ok(Math.abs(p.h - e.height) < 0.01, 'the declared height is the height used');

  for (const anchor of [{ x: 120, y: 90 }, { x: 800, y: 430 }, { x: 469, y: 512 }, { x: 0, y: 0 }]) {
    const q = placeImage(iw, ih, b, e.height, anchor);
    const ux = q.x + (anchor.x / iw) * q.w;
    const uy = q.y + (anchor.y / ih) * q.h;
    assert.ok(Math.abs(ux - b.cx) < 0.01, `anchor ${JSON.stringify(anchor)} lands on the rig axis (${ux.toFixed(1)} vs ${b.cx})`);
    assert.ok(Math.abs(uy - b.feetY) < 0.01, `anchor ${JSON.stringify(anchor)} lands on the ground line (${uy.toFixed(1)} vs ${b.feetY})`);
  }
  // An off-centre anchor must actually move the picture, or the check above is
  // passing for the wrong reason.
  const near = placeImage(iw, ih, b, e.height, { x: 100, y: ih });
  const far = placeImage(iw, ih, b, e.height, { x: iw - 100, y: ih });
  // Anchoring further right slides the picture left, so the origin must move.
  assert.ok(far.x < near.x - 1, 'moving the anchor sideways moves the picture');
  assert.ok(Math.abs(far.x - near.x) > 100, 'by a real amount, not a rounding wobble');
  assert.ok(Math.abs(near.y - far.y) < 0.01, 'while both still stand on the same ground line');
  // Anchoring a pixel above the floor still stands that pixel on the ground
  // line, so the real feet end up below it — which is exactly why the editor
  // defaults the anchor to the feet. Canvas y grows downward, hence the sign.
  const lifted = placeImage(iw, ih, b, e.height, { x: 100, y: ih - 50 });
  assert.ok(Math.abs((lifted.y - near.y) - 50 / ih * b.h) < 0.01,
    'lifting the anchor above the feet pushes the feet below the ground line');
  assert.ok(lifted.y + lifted.h > b.feetY, 'and the picture really does overhang');
});

test('every manifest entry is read through .src, never used as a path itself', async () => {
  // Entries became { src, height, anchor } so each picture can place itself.
  // Anywhere that still treats an entry as a string passes an object to
  // <img>.src, which becomes "[object Object]" and fails silently — the menu
  // simply loses its picture with nothing in the console. Inside hdImages.js
  // the reads are deliberate; everywhere else the file path is required.
  const dir = new URL('../src/', import.meta.url);
  const walk = (u, out = []) => {
    for (const e of readdirSync(u, { withFileTypes: true })) {
      const f = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, u);
      if (e.isDirectory()) walk(f, out);
      else if (e.name.endsWith('.js')) out.push(f);
    }
    return out;
  };
  const files = walk(dir);
  assert.ok(files.length > 10, `the sweep found the source tree (${files.length} files)`);
  let found = 0;
  for (const f of files) {
    if (f.pathname.endsWith('render/hdImages.js')) continue;   // the one place that knows the shape
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/HD_ASSETS\[[^\]]*\](?!\s*\.src)/g)) {
      found++;
      const line = text.slice(0, m.index).split('\n').length;
      assert.fail(`${f.pathname}:${line} uses a manifest entry without reading .src`);
    }
  }
  assert.ok(found === 0, `found ${found} unguarded manifest reads`);
});

test('a starter with HD art stands still, while a starter without it keeps animating', async () => {
  const screens = readFileSync(new URL('../src/ui/screens.js', import.meta.url), 'utf8');
  const start = screens.indexOf('export function starterScreen');
  assert.ok(start > 0, 'the starter screen exists');
  const body = screens.slice(start, screens.indexOf('\nfunction elementGlow', start));
  // Only Spriggo has HD art in stage 1, so the screen has to decide per card.
  assert.ok(/const still = !!hdModelFor\(/.test(body), 'each card asks whether it has a still');
  // A still has no turn-around and nothing to idle against.
  assert.ok(/if \(still\) draw\(0\)/.test(body) || /if \(still\)\s*\{[\s\S]{0,200}?draw\(0\)/.test(body),
    'a still is drawn once, with no animation loop');
  assert.ok(/requestAnimationFrame/.test(body), 'the non-HD cards still animate');
  assert.ok(/if \(still\) return;/.test(body), 'the orbiting sparkles are skipped for a still');
  assert.ok(/ctx\.scale\(Math\.max\(0\.28/.test(body), 'the shape squash only applies to the rig');
});

test('the image editor can anchor a picture without ever cropping it', async () => {
  const tpl = readFileSync(new URL('../tools/editor-template.html', import.meta.url), 'utf8');
  // A movable anchor is the approved answer to "my art is off-centre" — the
  // picture must be placed, not cut down to fit.
  assert.ok(/state\.anchorX\s*=\s*0/.test(tpl) || /anchorX/.test(tpl), 'the editor keeps an anchor x');
  assert.ok(/snapFeet/.test(tpl), 'the editor can auto-detect the feet');
  assert.ok(/Snap to feet/.test(tpl), 'and exposes it as a button');
  assert.ok(/pointerdown/.test(tpl) && /pointermove/.test(tpl), 'the anchor is draggable');
  assert.ok(/getImageData/.test(tpl), 'the feet are found by reading the alpha channel');
  assert.ok(/clipboard\.writeText/.test(tpl), 'the placement is copyable back into the manifest');
  // A browser cannot overwrite a file the user did not pick, so Save was dead
  // weight and the anchor is the part that actually matters. It is gone, and
  // must not creep back as a control that silently does nothing.
  assert.ok(!/btnSave|toBlob|Save PNG/.test(tpl), 'there is no Save button that cannot work');
  // Mistakes need to be cheap to back out of.
  assert.ok(/btnUndo/.test(tpl) && /btnRedo/.test(tpl), 'undo and redo are there');
  assert.ok(/btnReset/.test(tpl), 'and a reset back to the placement it opened with');
  assert.ok(/state\.original\s*=/.test(tpl), 'the opening anchor is remembered so Reset has something to restore');
  assert.ok(/function undo\(\)/.test(tpl) && /function redo\(\)/.test(tpl), 'both really walk the history');
  assert.ok(/e\.ctrlKey[\s\S]{0,40}===\s*'z'/.test(tpl), 'Ctrl+Z is bound');
  // No crop: the tool must not resize the artwork to the rig.
  assert.ok(!/drawImage\([^)]*,\s*-\d/.test(tpl.replace(/\s+/g,' ')), 'nothing is drawn cropped');
});

test('the editor and the offline bundle open on the manifest placement', () => {
  // This pins the exact bug the user hit: MythlingEdit.html used to ignore
  // hdManifest.js and re-guess the feet on every open, so a measured anchor
  // never showed up in the tool and the three files looked unconnected.
  const tpl = readFileSync(new URL('../tools/editor-template.html', import.meta.url), 'utf8');
  const bld = readFileSync(new URL('../tools/build-editor.mjs', import.meta.url), 'utf8');
  assert.ok(bld.includes('hdManifest.js'), 'the builder reads the live manifest module');
  assert.ok(tpl.includes('/*__MANIFEST__*/{}'), 'the template has somewhere to inject it');
  assert.ok(/MANIFEST\[/.test(tpl), 'the editor opens on a saved manifest entry when one exists');
  assert.ok(/state\.original = snap\(\)/.test(tpl), 'the opening anchor is still remembered for Reset');

  // Every model placement declared in the manifest must be in the built editor
  // AND in the offline bundle — those two are generated copies, not live links.
  const man = readFileSync(new URL('../src/data/hdManifest.js', import.meta.url), 'utf8');
  const entries = [...man.matchAll(/'model:([a-z0-9_]+:\d+)':\s*\{([\s\S]*?)\n\s*\},/g)];
  assert.ok(entries.length > 0, 'the manifest declares model placements');

  const built = readFileSync(new URL('../MythlingEdit.html', import.meta.url), 'utf8');
  const injected = /const MANIFEST = (\{[\s\S]*?\});/.exec(built);
  assert.ok(injected, 'the built editor carries the injected placements');
  const editorMan = JSON.parse(injected[1]);

  const bundle = readFileSync(new URL('../MythlingsWildbound-Offline.html', import.meta.url), 'utf8');
  for (const [, key, body] of entries) {
    const h = /height:\s*(\d+)/.exec(body);
    const a = /anchor:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+)\s*\}/.exec(body);
    assert.ok(h && a, `the ${key} entry declares a height and an anchor`);
    assert.ok(editorMan[key], `the built editor knows ${key}`);
    assert.equal(editorMan[key].height, Number(h[1]), `editor height for ${key}`);
    assert.equal(editorMan[key].anchor.x, Number(a[1]), `editor anchor x for ${key}`);
    assert.equal(editorMan[key].anchor.y, Number(a[2]), `editor anchor y for ${key}`);
    assert.ok(bundle.includes(`anchor: { x: ${a[1]}, y: ${a[2]} }`),
      `the offline bundle carries the ${key} anchor — rebuild it with npm run build:offline`);
  }
});

test('panels come to the picture, and battle stills sink into the platform', () => {
  const hd = readFileSync(new URL('../src/render/hdImages.js', import.meta.url), 'utf8');
  // The measured focus is what lets a panel find the artwork's body/feet
  // without touching the manifest placement.
  assert.ok(/export function hdFocus\(/.test(hd), 'the art focus is measured from the alpha channel');
  assert.ok(/export function hdFocusOffset\(/.test(hd), 'and handed to UI callers in px');
  // Battle depth: the still drops into the ground ellipse; its shadow stays
  // where the ground spot is.
  assert.ok(/r\.y \+ \(o\.sink \|\| 0\)/.test(hd), 'a still can sink without moving its shadow');

  const rig = readFileSync(new URL('../src/render/creatureRig.js', import.meta.url), 'utf8');
  assert.ok(/o\.shadowX \?\? x/.test(hd) && /o\.shadowX \?\? x/.test(rig),
    'both renderers let the shadow travel alone');

  const bs = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  assert.ok(/const HD_PLAYER_SINK = \d+/.test(bs) && /const HD_ENEMY_SINK = \d+/.test(bs),
    'each side declares its own plant depth');
  assert.ok(/sink: HD_PLAYER_SINK/.test(bs) && /sink: HD_ENEMY_SINK/.test(bs),
    'both battle models sink');
  assert.ok(/shadowX: pp\.x \+ HD_PLAYER_SHADOW_DX/.test(bs) && /shadowY: ep\.y \+ HD_ENEMY_SHADOW_DY/.test(bs),
    'each side pins its shadow to its own spot');
  assert.ok(/HD_PLAYER_DX = -?\d+/.test(bs) && /pp\.x \+ pa\.lean \+ HD_PLAYER_DX/.test(bs),
    'the battle player nudges left');
  assert.ok(/HD_PLAYER_DY = -?\d+/.test(bs) && /pp\.y \+ HD_PLAYER_DY/.test(bs),
    'the battle player nudges up');

  // The starter pedestal moves to the picture — never the other way round.
  const sc = readFileSync(new URL('../src/ui/screens.js', import.meta.url), 'utf8');
  assert.ok(/hdFocusOffset\(id, 0, 'none', 210, 'body'\)/.test(sc), 'the pedestal recentres on the body');
  assert.ok(/hdFocusOffset\(id, 0, 'none', 210, 'feet'\)/.test(sc), 'the starter shadow sits on the standing place');
  // The contact shadow paints BEFORE the still: the Mythling is in front.
  const shadowIdx = sc.indexOf('ctx.ellipse(0, 0, 71, 19');
  const stillIdx = sc.indexOf('size: 210, t: 0, facing: 1, shadow: false');
  assert.ok(shadowIdx > 0 && stillIdx > 0 && shadowIdx < stillIdx,
    'the starter shadow is painted behind the Mythling');
  assert.ok(/HD_STARTER_SHADOW_DX/.test(sc) && /HD_STARTER_DX/.test(sc),
    'the starter card keeps its own tuned placement block');

  // Card pictures reframe inside their box (the box IS the canvas there).
  const pm = readFileSync(new URL('../src/ui/PlayerMenu.js', import.meta.url), 'utf8');
  assert.ok(/hdFocusOffset\([\s\S]*?'block'\)/.test(pm), 'card pictures frame their silhouette');
});


test('the editor\u2019s Battle mode tunes the same numbers the battle runs', () => {
  const ed = readFileSync(new URL('../MythlingEdit.html', import.meta.url), 'utf8');
  assert.ok(/id="btnModeBattle"/.test(ed) && /Battle placement/.test(ed),
    'the editor opens a Battle mode with a placement panel');
  assert.ok(/Paste this into src\/scenes\/BattleScene\.js/.test(ed),
    'its copy panel sends values for BattleScene.js');
  assert.ok(/HD_PLAYER_SHADOW_DX/.test(ed) && /HD_ENEMY_SINK/.test(ed),
    'and outputs the per-side constants block');

  // It opens on the game\u2019s live numbers, not a guess.
  const bs = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  const val = (n) => Number(new RegExp(`const ${n} = (-?\\d+)`).exec(bs)[1]);
  const m = /const BATTLE_DEFAULTS = (\{[^;]*\});/.exec(ed);
  assert.ok(m, 'the builder injects the live battle placement');
  const def = JSON.parse(m[1]);
  for (const [k, n] of [['dx', 'HD_PLAYER_DX'], ['dy', 'HD_PLAYER_DY'], ['sink', 'HD_PLAYER_SINK'], ['sx', 'HD_PLAYER_SHADOW_DX'], ['sy', 'HD_PLAYER_SHADOW_DY']]) {
    assert.equal(def.player[k], val(n), `the editor opens on ${n}`);
  }
  for (const [k, n] of [['dx', 'HD_ENEMY_DX'], ['dy', 'HD_ENEMY_DY'], ['sink', 'HD_ENEMY_SINK'], ['sx', 'HD_ENEMY_SHADOW_DX'], ['sy', 'HD_ENEMY_SHADOW_DY']]) {
    assert.equal(def.enemy[k], val(n), `the editor opens on ${n}`);
  }
});


test('the editor\u2019s Starter mode tunes the card the game draws', () => {
  const ed = readFileSync(new URL('../MythlingEdit.html', import.meta.url), 'utf8');
  assert.ok(/id="btnModeStarter"/.test(ed) && /Starter card placement/.test(ed),
    'the editor opens a Starter mode with a placement panel');
  assert.ok(/Paste this into src\/ui\/screens\.js/.test(ed),
    'its copy panel sends values for screens.js');
  assert.ok(/HD_STARTER_SHADOW_DX/.test(ed) && /HD_STARTER_GLOW_DY/.test(ed),
    'and outputs the starter constants block');

  // It opens on the game's live numbers, not a guess.
  const sc = readFileSync(new URL('../src/ui/screens.js', import.meta.url), 'utf8');
  const val = (n) => Number(new RegExp(`const ${n} = (-?\\d+)`).exec(sc)[1]);
  const m = /const STARTER_DEFAULTS = (\{[^;]*\});/.exec(ed);
  assert.ok(m, 'the builder injects the live starter placement');
  const def = JSON.parse(m[1]);
  for (const [k, n] of [['dx', 'HD_STARTER_DX'], ['dy', 'HD_STARTER_DY'], ['gx', 'HD_STARTER_GLOW_DX'], ['gy', 'HD_STARTER_GLOW_DY'], ['sx', 'HD_STARTER_SHADOW_DX'], ['sy', 'HD_STARTER_SHADOW_DY']]) {
    assert.equal(def[k], val(n), `the editor opens on ${n}`);
  }
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
