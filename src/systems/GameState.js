// Central mutable game state + Player/Party/Storage/Inventory/Collection managers.
// Serialisation is validated & migrated on load so old saves never break.
import { GAME_VERSION, PARTY_MAX, LEVEL_CAP } from '../data/config.js';
import { STARTING_INVENTORY, STARTING_WILDCOINS, getItem } from '../data/items.js';
import { SPECIES_IDS, getSpecies } from '../data/species.js';
import { MAPS, getMap } from '../data/maps.js';
import {
  createMythling, restoreAll, refreshLibrary, autoEquip, displayName,
  maxHp, computeStats, stageForLevel,
} from '../core/mythling.js';
import { clamp, EventBus, deepClone } from '../core/utils.js';

export const bus = new EventBus();

function blankCollection() {
  const c = {};
  for (const id of SPECIES_IDS) c[id] = { seen: false, caught: false, mutations: { shiny: false, darkness: false } };
  return c;
}

export const GameState = {
  slot: 1,
  player: {
    name: 'TRAINER',
    wildcoins: STARTING_WILDCOINS,
    map: 'verdant_vale',
    x: MAPS.verdant_vale.spawn.x,
    y: MAPS.verdant_vale.spawn.y,
    facing: 'down',
    starter: null,
    lastHealMap: 'verdant_vale',
    lastHealPoint: { ...MAPS.verdant_vale.spawn },
  },
  party: [],
  storage: [],
  inventory: { ...STARTING_INVENTORY },
  collection: blankCollection(),
  world: {
    defeatedTrainers: {},   // flag -> true
    unlockedMaps: { verdant_vale: true },
    visitedMaps: { verdant_vale: true },
    flags: {},              // arbitrary story flags
    npcProgress: {},
  },
  meta: {
    playTime: 0,
    startedAt: Date.now(),
    gameVersion: GAME_VERSION,
    levelCap: LEVEL_CAP,
  },
  settings: null, // filled by SettingsManager
  _sessionStart: Date.now(),
};

// -------------------------------------------------- Player
export const PlayerManager = {
  setName(name) {
    GameState.player.name = (name || 'TRAINER').slice(0, 14).toUpperCase();
  },
  addCoins(n) {
    GameState.player.wildcoins = Math.max(0, Math.floor(GameState.player.wildcoins + n));
    bus.emit('coins:changed', GameState.player.wildcoins);
  },
  spendCoins(n) {
    if (n > GameState.player.wildcoins) return false;
    GameState.player.wildcoins -= n;
    bus.emit('coins:changed', GameState.player.wildcoins);
    return true;
  },
  setPosition(map, x, y) {
    GameState.player.map = map;
    GameState.player.x = x;
    GameState.player.y = y;
  },
  playTime() {
    return GameState.meta.playTime + (Date.now() - GameState._sessionStart);
  },
};

// -------------------------------------------------- Party
export const PartyManager = {
  list() { return GameState.party; },
  count() { return GameState.party.length; },
  isFull() { return GameState.party.length >= PARTY_MAX; },
  lead() { return GameState.party[0] || null; },
  firstHealthy() { return GameState.party.find((m) => m.currentHp > 0) || null; },
  allFainted() { return GameState.party.length > 0 && GameState.party.every((m) => m.currentHp <= 0); },
  /** Highest level in the party — wild spawns and trainer teams keep pace with it. */
  topLevel() {
    return GameState.party.reduce((top, m) => Math.max(top, m.level || 1), 1);
  },
  add(m) {
    if (this.isFull()) return false;
    GameState.party.push(m);
    bus.emit('party:changed');
    return true;
  },
  remove(uid) {
    const i = GameState.party.findIndex((m) => m.uid === uid);
    if (i < 0) return null;
    // never allow the player to be left with zero Mythlings
    if (GameState.party.length <= 1) return null;
    const [m] = GameState.party.splice(i, 1);
    bus.emit('party:changed');
    return m;
  },
  swap(i, j) {
    const p = GameState.party;
    if (i < 0 || j < 0 || i >= p.length || j >= p.length) return;
    [p[i], p[j]] = [p[j], p[i]];
    bus.emit('party:changed');
  },
  healAll() {
    for (const m of GameState.party) restoreAll(m);
    bus.emit('party:changed');
  },
  get(uid) { return GameState.party.find((m) => m.uid === uid) || null; },
};

// -------------------------------------------------- Storage
export const StorageManager = {
  list() { return GameState.storage; },
  add(m) { GameState.storage.push(m); bus.emit('storage:changed'); return true; },
  remove(uid) {
    const i = GameState.storage.findIndex((m) => m.uid === uid);
    if (i < 0) return null;
    const [m] = GameState.storage.splice(i, 1);
    bus.emit('storage:changed');
    return m;
  },
  toParty(uid) {
    if (PartyManager.isFull()) return false;
    const m = this.remove(uid);
    if (!m) return false;
    PartyManager.add(m);
    return true;
  },
  fromParty(uid) {
    if (GameState.party.length <= 1) return false;
    const m = PartyManager.remove(uid);
    if (!m) return false;
    this.add(m);
    return true;
  },
  filter({ element, species, rarity, mood, mutation, minLevel, maxLevel, query } = {}) {
    return GameState.storage.filter((m) => {
      const sp = getSpecies(m.speciesId);
      if (element && sp.element !== element) return false;
      if (species && m.speciesId !== species) return false;
      if (rarity && m.rarity !== rarity) return false;
      if (mood && m.mood !== mood) return false;
      if (mutation && m.mutation !== mutation) return false;
      if (minLevel != null && m.level < minLevel) return false;
      if (maxLevel != null && m.level > maxLevel) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!displayName(m).toLowerCase().includes(q) && !sp.displayName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  },
};

// -------------------------------------------------- Inventory
export const InventoryManager = {
  count(id) { return GameState.inventory[id] || 0; },
  add(id, n = 1) {
    if (!getItem(id) || n <= 0) return false;
    GameState.inventory[id] = Math.max(0, (GameState.inventory[id] || 0) + Math.floor(n));
    bus.emit('inventory:changed');
    return true;
  },
  remove(id, n = 1) {
    const have = this.count(id);
    if (have < n) return false;
    GameState.inventory[id] = have - n;
    if (GameState.inventory[id] <= 0) delete GameState.inventory[id];
    bus.emit('inventory:changed');
    return true;
  },
  has(id, n = 1) { return this.count(id) >= n; },
  byCategory(cat) {
    return Object.keys(GameState.inventory)
      .map((id) => ({ id, item: getItem(id), qty: GameState.inventory[id] }))
      .filter((e) => e.item && e.qty > 0 && e.item.category === cat);
  },
  all() {
    return Object.keys(GameState.inventory)
      .map((id) => ({ id, item: getItem(id), qty: GameState.inventory[id] }))
      .filter((e) => e.item && e.qty > 0);
  },
};

// -------------------------------------------------- Collection
export const CollectionManager = {
  markSeen(speciesId, mutation = 'none') {
    const e = GameState.collection[speciesId];
    if (!e) return;
    e.seen = true;
    if (mutation !== 'none') e.mutations[mutation] = true;
    bus.emit('collection:changed');
  },
  markCaught(speciesId, mutation = 'none') {
    const e = GameState.collection[speciesId];
    if (!e) return;
    e.seen = true; e.caught = true;
    if (mutation !== 'none') e.mutations[mutation] = true;
    bus.emit('collection:changed');
  },
  entry(id) { return GameState.collection[id]; },
  stats() {
    const ids = SPECIES_IDS;
    return {
      total: ids.length,
      seen: ids.filter((i) => GameState.collection[i]?.seen).length,
      caught: ids.filter((i) => GameState.collection[i]?.caught).length,
      shiny: ids.filter((i) => GameState.collection[i]?.mutations.shiny).length,
      darkness: ids.filter((i) => GameState.collection[i]?.mutations.darkness).length,
    };
  },
};

// -------------------------------------------------- World
export const WorldManager = {
  isTrainerDefeated(flag) { return !!GameState.world.defeatedTrainers[flag]; },
  defeatTrainer(flag) { GameState.world.defeatedTrainers[flag] = true; },
  setFlag(f, v = true) { GameState.world.flags[f] = v; },
  getFlag(f) { return !!GameState.world.flags[f]; },
  unlockMap(id) { GameState.world.unlockedMaps[id] = true; },
  isMapUnlocked(id) { return !!GameState.world.unlockedMaps[id]; },
  visit(id) { GameState.world.visitedMaps[id] = true; },
};

// -------------------------------------------------- New game / serialisation
export function createNewGameState({ slot, playerName, starterId, settings }) {
  GameState.slot = slot;
  GameState.player = {
    name: (playerName || 'TRAINER').slice(0, 14).toUpperCase(),
    wildcoins: STARTING_WILDCOINS,
    map: 'verdant_vale',
    x: MAPS.verdant_vale.spawn.x,
    y: MAPS.verdant_vale.spawn.y,
    facing: 'down',
    starter: starterId,
    lastHealMap: 'verdant_vale',
    lastHealPoint: { ...MAPS.verdant_vale.spawn },
  };
  GameState.party = [];
  GameState.storage = [];
  GameState.inventory = { ...STARTING_INVENTORY };
  GameState.collection = blankCollection();
  GameState.world = {
    defeatedTrainers: {},
    unlockedMaps: { verdant_vale: true },
    visitedMaps: { verdant_vale: true },
    flags: {},
    npcProgress: {},
  };
  GameState.meta = { playTime: 0, startedAt: Date.now(), gameVersion: GAME_VERSION, levelCap: LEVEL_CAP };
  GameState._sessionStart = Date.now();
  if (settings) GameState.settings = settings;

  const starter = createMythling({ speciesId: starterId, level: 1, isStarter: true, originMap: 'verdant_vale' });
  PartyManager.add(starter);
  CollectionManager.markCaught(starterId, starter.mutation);
  return starter;
}

export function serialize() {
  const lead = PartyManager.lead();
  const map = getMap(GameState.player.map);
  return {
    gameVersion: GAME_VERSION,
    slot: GameState.slot,
    player: deepClone(GameState.player),
    party: deepClone(GameState.party),
    storage: deepClone(GameState.storage),
    inventory: deepClone(GameState.inventory),
    collection: deepClone(GameState.collection),
    world: deepClone(GameState.world),
    settings: GameState.settings ? deepClone(GameState.settings) : null,
    meta: {
      ...GameState.meta,
      playTime: PlayerManager.playTime(),
      locationName: map ? map.displayName : '—',
      leadMythling: lead ? `${displayName(lead)} Lv.${lead.level}` : '—',
      starter: GameState.player.starter,
      levelCap: LEVEL_CAP,
    },
  };
}

/** Validate + migrate a single Mythling record loaded from disk. */
function migrateMythling(raw) {
  if (!raw || !raw.speciesId || !getSpecies(raw.speciesId)) return null;
  const m = {
    uid: raw.uid || `myth_${Math.random().toString(36).slice(2)}`,
    speciesId: raw.speciesId,
    nickname: raw.nickname ?? null,
    level: clamp(raw.level ?? 1, 1, LEVEL_CAP),
    exp: Math.max(0, raw.exp ?? 0),
    stage: raw.stage ?? 0,
    rarity: raw.rarity ?? getSpecies(raw.speciesId).defaultRarity,
    mood: raw.mood ?? getSpecies(raw.speciesId).defaultMood,
    mutation: raw.mutation ?? 'none',          // migration: old saves had no mutation
    currentHp: raw.currentHp ?? null,   // null => restore to full below (old saves)
    ultCharge: clamp(raw.ultCharge ?? 0, 0, 8),
    skills: { normal: null, special: null, buff: null, ...(raw.skills || {}) },
    library: Array.isArray(raw.library) ? [...raw.library] : [],
    uses: { ...(raw.uses || {}) },
    meta: { caughtAt: null, caughtWith: null, caughtLevel: null, originMap: null, isStarter: false, ...(raw.meta || {}) },
  };
  // clamp stage to what this build allows for the stored level
  const maxStage = stageForLevel(m.speciesId, m.level);
  if (m.stage > maxStage) m.stage = maxStage;
  refreshLibrary(m);  // adds any skills introduced by a newer game version
  // only fill empty slots for saves that predate free slot assignment: if the
  // player chose to leave a slot empty, that choice has to survive a reload
  if (!raw.skills) autoEquip(m);
  const mx = maxHp(m);
  if (m.currentHp == null || !Number.isFinite(m.currentHp) || m.currentHp > mx) m.currentHp = mx;
  if (m.currentHp < 0) m.currentHp = 0;
  return m;
}

export function deserialize(data) {
  if (!data) return false;
  GameState.slot = data.slot ?? 1;

  const defMap = 'verdant_vale';
  const p = data.player || {};
  const mapId = getMap(p.map) ? p.map : defMap;
  GameState.player = {
    name: p.name || 'TRAINER',
    wildcoins: Math.max(0, Math.floor(p.wildcoins ?? STARTING_WILDCOINS)),
    map: mapId,
    x: Number.isFinite(p.x) ? p.x : MAPS[mapId].spawn.x,
    y: Number.isFinite(p.y) ? p.y : MAPS[mapId].spawn.y,
    facing: p.facing || 'down',
    starter: p.starter ?? null,
    lastHealMap: getMap(p.lastHealMap) ? p.lastHealMap : mapId,
    lastHealPoint: p.lastHealPoint || { ...MAPS[mapId].spawn },
  };

  GameState.party = (data.party || []).map(migrateMythling).filter(Boolean).slice(0, PARTY_MAX);
  GameState.storage = (data.storage || []).map(migrateMythling).filter(Boolean);

  // Safety: a save must always have at least one Mythling to continue.
  if (GameState.party.length === 0 && GameState.storage.length > 0) {
    GameState.party.push(GameState.storage.shift());
  }
  if (GameState.party.length === 0) {
    GameState.party.push(createMythling({ speciesId: p.starter || 'spriggo', level: 1, isStarter: true }));
  }

  const inv = {};
  for (const [id, qty] of Object.entries(data.inventory || {})) {
    if (getItem(id) && Number.isFinite(qty) && qty > 0) inv[id] = Math.floor(qty);
  }
  GameState.inventory = Object.keys(inv).length ? inv : { ...STARTING_INVENTORY };

  const col = blankCollection();
  for (const [id, e] of Object.entries(data.collection || {})) {
    if (!col[id]) continue;   // species removed in a later version -> ignore
    col[id] = {
      seen: !!e.seen, caught: !!e.caught,
      mutations: { shiny: !!e?.mutations?.shiny, darkness: !!e?.mutations?.darkness },
    };
  }
  GameState.collection = col;

  const w = data.world || {};
  GameState.world = {
    defeatedTrainers: { ...(w.defeatedTrainers || {}) },
    unlockedMaps: { verdant_vale: true, ...(w.unlockedMaps || {}) },
    visitedMaps: { verdant_vale: true, ...(w.visitedMaps || {}) },
    flags: { ...(w.flags || {}) },
    npcProgress: { ...(w.npcProgress || {}) },
  };

  GameState.meta = {
    playTime: Math.max(0, data.meta?.playTime ?? 0),
    startedAt: data.meta?.startedAt ?? Date.now(),
    gameVersion: GAME_VERSION,
    levelCap: LEVEL_CAP,
  };
  GameState._sessionStart = Date.now();
  if (data.settings) GameState.settings = { ...(GameState.settings || {}), ...data.settings };

  bus.emit('party:changed');
  bus.emit('inventory:changed');
  bus.emit('collection:changed');
  return true;
}

export { PARTY_MAX };
