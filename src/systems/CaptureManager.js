// Capture flow. THE core rule lives here: every captured Mythling becomes Lv.1.
import { captureChance } from './BattleManager.js';
import { resetToLevelOne, displayName, speciesOf, isFainted } from '../core/mythling.js';
import { InventoryManager, PartyManager, StorageManager, CollectionManager, GameState } from './GameState.js';
import { getItem, canHoldLegendary, LEGENDARY_MIN_BALL } from '../data/items.js';
import { combineMutations } from '../data/mutations.js';

export const CaptureManager = {
  /** A living wild Mythling can never be caught. */
  canAttempt(target) {
    return !!target && isFainted(target);
  },

  chanceFor(target, ballId) {
    if (speciesOf(target).legendary && !canHoldLegendary(ballId)) return 0;
    return captureChance({ target, ballId });
  },
  /** Can this ball hold this Mythling at all? (Legendaries: Absolute Ball or better.) */
  ballAllowed(target, ballId) {
    return !speciesOf(target).legendary || canHoldLegendary(ballId);
  },

  /**
   * Attempt a capture. Consumes one ball.
   * @returns {{ok:boolean, success:boolean, reason?:string, chance:number, mythling?:object, destination?:'party'|'storage'|'pending'}}
   */
  attempt(target, ballId, rng = Math.random) {
    if (!this.canAttempt(target)) {
      return { ok: false, success: false, reason: 'You must defeat the wild Mythling first!', chance: 0 };
    }
    if (!InventoryManager.has(ballId, 1)) {
      return { ok: false, success: false, reason: `You have no ${getItem(ballId)?.name || 'balls'} left!`, chance: 0 };
    }
    // Legendaries slip out of anything weaker than an Absolute Ball — the ball is not wasted.
    if (speciesOf(target).legendary && !canHoldLegendary(ballId)) {
      return { ok: false, success: false, reason: `${getItem(ballId)?.name || 'That ball'} cannot hold a legendary Mythling. Use an ${getItem(LEGENDARY_MIN_BALL).name} or better.`, chance: 0, legendaryBlocked: true };
    }
    InventoryManager.remove(ballId, 1);
    const chance = captureChance({ target, ballId });
    const roll = rng();
    const success = roll < chance;
    if (!success) {
      return { ok: true, success: false, chance, reason: 'The Mythling broke free!' };
    }

    // --- capture succeeded ---
    const caught = target;
    caught.meta = caught.meta || {};
    caught.meta.caughtAt = Date.now();
    caught.meta.caughtWith = ballId;
    caught.meta.caughtLevel = caught.level;      // remembered for the detail screen
    caught.meta.originMap = caught.meta.originMap || GameState.player.map;

    resetToLevelOne(caught);                     // <<< ALWAYS Lv.1

    // Shiny Ball / Dark Ball: the Mythling ALWAYS emerges with that mutation —
    // ON TOP of whatever it already had. Catch a wild Shiny with a Dark Ball and
    // it comes out Shiny Darkness, carrying both auras and both stat bonuses.
    const ball = getItem(ballId);
    if (ball?.forceMutation) caught.mutation = combineMutations(caught.mutation, ball.forceMutation);

    CollectionManager.markCaught(caught.speciesId, caught.mutation, caught.stage);

    return { ok: true, success: true, chance, mythling: caught, destination: 'pending' };
  },

  /** Place a freshly-caught Mythling. Returns 'party' | 'storage'. */
  place(mythling, preferParty = true) {
    if (preferParty && !PartyManager.isFull()) {
      PartyManager.add(mythling);
      return 'party';
    }
    StorageManager.add(mythling);
    return 'storage';
  },
};
