// Treasure chests: where they are on each map, when they re-roll, what happens on
// opening. State lives in GameState.world.chests so it is saved with the game.
import { GameState, PlayerManager, InventoryManager, bus } from './GameState.js';
import { getMap, MAP_ORDER } from '../data/maps.js';
import { getItem } from '../data/items.js';
import { CHEST_TIERS, CHEST_REROLL_MS, CHEST_MIN_SPACING, rollChestTiers, rollChestLoot, getChestTier } from '../data/chests.js';
import { rectsOverlap, dist } from '../core/utils.js';

let seq = 0;

export const ChestManager = {
  /** The chest records of a map (empty array when none were rolled yet). */
  list(mapId) {
    return (GameState.world.chests && GameState.world.chests[mapId]?.list) || [];
  },

  /**
   * Make sure `mapId` has a current chest set. Rolls a fresh set the first time
   * the map is entered and again once CHEST_REROLL_MS of play time has passed
   * since the last roll (opened chests stay gone until then).
   * `isFree(x, y)` is supplied by the world so chests never sit in water,
   * inside buildings or on top of props.
   */
  ensure(mapId, isFree, rng = Math.random) {
    const map = getMap(mapId);
    if (!map) return [];
    GameState.world.chests = GameState.world.chests || {};
    const now = PlayerManager.playTime();
    const cur = GameState.world.chests[mapId];
    if (cur && now - (cur.at || 0) < CHEST_REROLL_MS) return cur.list;
    const tiers = rollChestTiers(rng);
    const placed = [];
    for (const tier of tiers) {
      const pos = this.findSpot(map, isFree, placed, rng);
      if (!pos) continue;
      placed.push({ id: `chest_${Date.now().toString(36)}_${seq++}`, tier, x: pos.x, y: pos.y });
    }
    GameState.world.chests[mapId] = { at: now, list: placed };
    return placed;
  },

  /** A walkable point inside one of the map's encounter zones, away from the spawn and other chests. */
  findSpot(map, isFree, placed, rng = Math.random) {
    const zones = map.encounterZones.length ? map.encounterZones : [{ rect: [80, 120, map.width - 160, map.height - 240] }];
    for (let attempt = 0; attempt < 60; attempt++) {
      const z = zones[Math.floor(rng() * zones.length)];
      const [zx, zy, zw, zh] = z.rect;
      const x = Math.round(zx + 30 + rng() * Math.max(1, zw - 60));
      const y = Math.round(zy + 30 + rng() * Math.max(1, zh - 60));
      if (dist(x, y, map.spawn.x, map.spawn.y) < CHEST_MIN_SPACING) continue;
      if (placed.some((c) => dist(x, y, c.x, c.y) < CHEST_MIN_SPACING)) continue;
      if (isFree && !isFree(x, y)) continue;
      return { x, y };
    }
    return null;
  },

  /**
   * Open a chest: pays the coins, hands over the item, removes the chest.
   * @returns {{ ok:boolean, tier:object, coins:number, item:null|{id,qty,name} }}
   */
  open(mapId, chestId, rng = Math.random) {
    const list = this.list(mapId);
    const idx = list.findIndex((c) => c.id === chestId);
    if (idx < 0) return { ok: false };
    const chest = list[idx];
    const tier = getChestTier(chest.tier);
    const regionIndex = Math.max(0, MAP_ORDER.indexOf(mapId));
    const loot = rollChestLoot(chest.tier, regionIndex, rng);
    list.splice(idx, 1);
    if (loot.coins > 0) PlayerManager.addCoins(loot.coins);
    let item = null;
    if (loot.item && getItem(loot.item.id)) {
      InventoryManager.add(loot.item.id, loot.item.qty);
      item = { ...loot.item, name: getItem(loot.item.id).name };
    }
    const stats = (GameState.world.chestStats = GameState.world.chestStats || {});
    stats[chest.tier] = (stats[chest.tier] || 0) + 1;
    bus.emit('chest:opened', { mapId, tier: chest.tier, coins: loot.coins, item });
    return { ok: true, tier, coins: loot.coins, item };
  },

  /** How many chests of each tier the player has opened, for the Trainer Record. */
  stats() {
    const s = GameState.world.chestStats || {};
    const out = { total: 0 };
    for (const id of Object.keys(CHEST_TIERS)) { out[id] = s[id] || 0; out.total += out[id]; }
    return out;
  },

  /** Free-spot test built from the world renderer's colliders + the map's water. */
  makeFreeTest(map, colliders) {
    return (x, y) => {
      const box = { x: x - 22, y: y - 26, w: 44, h: 32 };
      for (const c of colliders) if (rectsOverlap(box, c)) return false;
      for (const w of map.water) if (rectsOverlap(box, w)) return false;
      for (const b of map.buildings) if (rectsOverlap(box, { x: b.x - 30, y: b.y - 30, w: b.w + 60, h: b.h + 60 })) return false;
      return true;
    };
  },
};
