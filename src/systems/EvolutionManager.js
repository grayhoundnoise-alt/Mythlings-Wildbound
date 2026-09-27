// Evolution gating. Only the Lv.20 stage is reachable in the current build;
// Lv.60 / Lv.80 stay locked but remain described in the data for future updates.
import { canEvolve, evolve, futureEvolutionInfo, nextEvolution } from '../core/mythling.js';
import { MAX_UNLOCKED_EVOLUTION_STAGE, FUTURE_CONTENT_LIVE } from '../data/config.js';
import { CollectionManager } from './GameState.js';

export const EvolutionManager = {
  isReady(m) { return canEvolve(m); },

  pending(party) { return party.filter((m) => canEvolve(m)); },

  /** Perform the evolution. Returns the transformation record (or null). */
  perform(m) {
    if (!canEvolve(m)) return null;
    const rec = evolve(m);
    // The Index reveals an evolution only once the player has actually owned it.
    CollectionManager.markForm(m.speciesId, m.stage);
    return rec;
  },

  /** Locked future stages, for the detail screen (never shown as usable buttons). */
  lockedStages(m) {
    return futureEvolutionInfo(m).filter((s) => s.locked);
  },

  nextStageInfo(m) {
    const next = nextEvolution(m);
    if (!next) return null;
    const locked = (m.stage + 1) > MAX_UNLOCKED_EVOLUTION_STAGE || (!FUTURE_CONTENT_LIVE && !!next.future);
    return { name: next.name, level: next.level, locked, reached: m.level >= next.level };
  },
};
