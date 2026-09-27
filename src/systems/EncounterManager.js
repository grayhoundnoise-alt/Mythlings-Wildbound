// Wild spawn generation. Spawn tables support weights, level ranges, rarity &
// mutation rolls — future hooks (time of day, weather) slot in here.
import { createMythling } from '../core/mythling.js';
import { getMap } from '../data/maps.js';
import { rollRarity } from '../data/rarity.js';
import { rollMutation } from '../data/mutations.js';
import { MOOD_IDS } from '../data/moods.js';
import { weightedChoice, randInt, choice, clamp } from '../core/utils.js';
import { LEVEL_CAP } from '../data/config.js';

export const EncounterManager = {
  /**
   * Roll a wild Mythling for a given zone.
   *
   * `modifiers.partyLevel` lets the world keep pace with the party: once you
   * out-level a zone's range the whole range shifts up by the difference, so
   * grinding past the story content to the Lv.100 cap stays possible instead
   * of paying nothing.
   */
  spawnForZone(zone, mapId, rng = Math.random, modifiers = {}) {
    const pick = weightedChoice(rng, zone.species);
    const [lo, hi] = zone.levelRange;
    let level = randInt(rng, lo, hi);
    const top = Number(modifiers.partyLevel) || 0;
    if (top > hi) level += top - hi;
    level = clamp(level, 1, LEVEL_CAP);
    return createMythling({
      speciesId: pick.id,
      level,
      rarity: rollRarity(rng, modifiers.rarityLuck || 0),
      mood: choice(rng, MOOD_IDS),
      mutation: rollMutation(rng, modifiers.mutationLuck || 1),
      originMap: mapId,
      rng,
    });
  },

  zonesForMap(mapId) {
    const map = getMap(mapId);
    return map ? map.encounterZones : [];
  },

  zoneAt(mapId, x, y) {
    const map = getMap(mapId);
    if (!map) return null;
    for (const z of map.encounterZones) {
      const [zx, zy, zw, zh] = z.rect;
      if (x >= zx && x <= zx + zw && y >= zy && y <= zy + zh) return z;
    }
    return null;
  },
};
