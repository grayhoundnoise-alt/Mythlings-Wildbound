// Feeding: food items convert directly into EXP so players can train a Mythling
// faster without grinding battles. All the rules that govern EXP anywhere else
// (level cap, evolution readiness, ultimate unlock) apply unchanged here.
//
// Stacks can be fed in one go. The count is always capped at what is USEFUL:
// never more than the player owns and never more than it takes to reach the
// level cap, so no food is ever wasted on a Mythling that cannot use it.
import { getItem } from '../data/items.js';
import { LEVEL_CAP, expToNextLevel, totalExpForLevel } from '../data/config.js';
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

  /** EXP still missing between where the Mythling is now and the level cap. */
  expToCap(mythling) {
    if (!mythling || isMaxLevel(mythling)) return 0;
    const have = totalExpForLevel(mythling.level) + Math.max(0, mythling.exp || 0);
    return Math.max(0, totalExpForLevel(LEVEL_CAP) - have);
  },

  /** How many units of this food would reach the level cap (the useful maximum). */
  toCap(mythling, itemId) {
    const item = getItem(itemId);
    if (!item || !item.exp || !mythling || isMaxLevel(mythling)) return 0;
    return Math.max(1, Math.ceil(this.expToCap(mythling) / item.exp));
  },

  /**
   * The most of `itemId` that can sensibly be fed right now:
   * min(owned, units to reach the level cap).
   */
  maxFeedable(mythling, itemId) {
    if (!this.isFood(itemId) || this.blockedReason(mythling)) return 0;
    return Math.max(0, Math.min(InventoryManager.count(itemId), this.toCap(mythling, itemId)));
  },

  /** Where `count` units of this food would leave the Mythling (level + leftover EXP), without feeding. */
  preview(mythling, itemId, count = 1) {
    const item = getItem(itemId);
    if (!item || !mythling) return null;
    let level = mythling.level;
    let exp = Math.max(0, mythling.exp || 0) + item.exp * Math.max(0, count);
    while (level < LEVEL_CAP && exp >= expToNextLevel(level)) { exp -= expToNextLevel(level); level += 1; }
    if (level >= LEVEL_CAP) exp = 0;
    return { level, exp, levelsGained: level - mythling.level, totalExp: item.exp * Math.max(0, count) };
  },

  /**
   * Feed `count` units of `itemId` to `mythling` in one go. The count is capped
   * at maxFeedable(), so asking for more than is useful just feeds the useful
   * amount and leaves the rest in the bag.
   * @returns {{ok:boolean, reason?:string, exp?:number, count?:number, result?:object, item?:object}}
   */
  feed(mythling, itemId, count = 1) {
    const item = getItem(itemId);
    if (!this.isFood(itemId)) return { ok: false, reason: 'That item is not food.' };
    if (!InventoryManager.has(itemId, 1)) return { ok: false, reason: `You have no ${item.name}.` };
    const blocked = this.blockedReason(mythling);
    if (blocked) return { ok: false, reason: blocked };

    const qty = Math.max(1, Math.min(Math.floor(count) || 1, this.maxFeedable(mythling, itemId)));
    InventoryManager.remove(itemId, qty);
    const result = gainExp(mythling, item.exp * qty);
    bus.emit('mythling:fed', { mythling, item, result, count: qty });
    return { ok: true, exp: item.exp * qty, count: qty, result, item };
  },

  /** How many of this food it would take to reach the next level (UI hint). */
  toNextLevel(mythling, itemId) {
    const item = getItem(itemId);
    if (!item || !item.exp || !mythling || isMaxLevel(mythling)) return null;
    const remaining = expToNextLevel(mythling.level) - mythling.exp;
    return Math.max(1, Math.ceil(remaining / item.exp));
  },
};
