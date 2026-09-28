// Shop shelves. Stock is finite and refills on a timer, so nothing can be
// farmed by standing at the counter: cheap staples come back in bulk, the
// top-tier balls and the best food arrive rarely — and sometimes not at all.
// Stock lives in GameState.world.shops so it is saved with the game.
import { GameState, PlayerManager, InventoryManager, bus } from './GameState.js';
import { shopStock, getItem } from '../data/items.js';
import { SHOP_RESTOCK_MS } from '../data/config.js';

export const ShopManager = {
  /**
   * What `building` has on the shelf right now: `{ itemId: qty }`.
   * Rolls a fresh set the first time the shop is opened and again every
   * SHOP_RESTOCK_MS of play time.
   */
  stock(building) {
    if (!building) return {};
    GameState.world.shops = GameState.world.shops || {};
    const now = PlayerManager.playTime();
    const cur = GameState.world.shops[building.id];
    if (cur && now - (cur.at || 0) < SHOP_RESTOCK_MS) return cur.stock;
    return this.restock(building);
  },

  /** Roll a fresh shelf for one shop (called automatically when the timer runs out). */
  restock(building) {
    GameState.world.shops = GameState.world.shops || {};
    const stock = {};
    for (const id of building.stock || []) {
      const { max, chance } = shopStock(id);
      if (!max) continue;
      if (chance < 1 && Math.random() > chance) continue;   // the rare shelf is often empty
      stock[id] = max;
    }
    GameState.world.shops[building.id] = { at: PlayerManager.playTime(), stock };
    bus.emit('shop:restock');
    return stock;
  },

  /** How many of one item this shop currently has. */
  qty(building, id) {
    return this.stock(building)[id] || 0;
  },

  /** Milliseconds until this shop's shelves change (0 when they already need to). */
  msUntilRestock(building) {
    if (!building) return 0;
    const cur = (GameState.world.shops || {})[building.id];
    if (!cur) return 0;
    return Math.max(0, SHOP_RESTOCK_MS - (PlayerManager.playTime() - (cur.at || 0)));
  },

  /**
   * Buy `qty` of `id`. Checks coins, shelf stock and (for a bag) eligibility
   * in one place so the UI cannot get out of step with the rules.
   * @returns {{ok:boolean, reason?:string, paid?:number}}
   */
  buy(building, id, qty = 1) {
    const item = getItem(id);
    if (!item) return { ok: false, reason: 'Unknown item.' };
    const n = Math.max(1, Math.floor(qty) || 1);
    const shelf = this.stock(building);
    const have = shelf[id] || 0;
    if (!getItem(id).price) return { ok: false, reason: `${item.name} is not for sale.` };
    if (have <= 0) return { ok: false, reason: `${item.name} is out of stock — the shelves refill on their own.` };
    const count = Math.min(n, have);
    const total = item.price * count;
    if (GameState.player.wildcoins < total) return { ok: false, reason: 'Not enough Wildcoins!' };
    if (!PlayerManager.spendCoins(total)) return { ok: false, reason: 'Not enough Wildcoins!' };
    shelf[id] = have - count;
    InventoryManager.add(id, count);
    bus.emit('shop:purchase');
    return { ok: true, paid: total, count, left: shelf[id] };
  },

  /** "3:07" for the restock countdown. */
  formatCountdown(ms) {
    const total = Math.ceil((ms || 0) / 1000);
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  },
};
