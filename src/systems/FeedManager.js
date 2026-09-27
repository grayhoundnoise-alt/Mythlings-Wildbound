// Feeding: food items convert directly into EXP so players can train a Mythling
// faster without grinding battles. All the rules that govern EXP anywhere else
// (level cap, evolution readiness, ultimate unlock) apply unchanged here.
import { getItem } from '../data/items.js';
import { LEVEL_CAP, expToNextLevel } from '../data/config.js';
import { gainExp, displayName, isMaxLevel } from '../core/mythling.js';
import { InventoryManager, bus } from './GameState.js';

export const FeedManager = {
  isFood(itemId) {
    const item = getItem(itemId);
    return !!(item && item.category === 'food' && item.exp > 0);
  },

  /** Why a Mythling cannot be fed right now, or null when it can. */
  blockedReason(mythling) {
    if (!mythling) return 'No Mythling selected.';
    if (isMaxLevel(mythling)) return `${displayName(mythling)} is already MAX LEVEL (Lv.${LEVEL_CAP}).`;
    return null;
  },

  /**
   * Feed one unit of `itemId` to `mythling`.
   * @returns {{ok:boolean, reason?:string, exp?:number, result?:object, item?:object}}
   */
  feed(mythling, itemId, count = 1) {
    const item = getItem(itemId);
    if (!this.isFood(itemId)) return { ok: false, reason: 'That item is not food.' };
    if (!InventoryManager.has(itemId, count)) return { ok: false, reason: `You have no ${item.name}.` };
    const blocked = this.blockedReason(mythling);
    if (blocked) return { ok: false, reason: blocked };

    InventoryManager.remove(itemId, count);
    const result = gainExp(mythling, item.exp * count);
    bus.emit('mythling:fed', { mythling, item, result });
    return { ok: true, exp: item.exp * count, result, item };
  },

  /** How many of this food it would take to reach the next level (UI hint). */
  toNextLevel(mythling, itemId) {
    const item = getItem(itemId);
    if (!item || !item.exp || !mythling || isMaxLevel(mythling)) return null;
    const remaining = expToNextLevel(mythling.level) - mythling.exp;
    return Math.max(1, Math.ceil(remaining / item.exp));
  },
};
