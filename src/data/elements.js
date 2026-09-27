// Element definitions & effectiveness chart (data-driven, extensible).
// `icon` names an entry in src/ui/icons.js — the UI never uses emoji.
export const ELEMENTS = {
  nature: { id: 'nature', name: 'Nature', icon: 'nature', color: '#4fc76a', glow: '#9cff9c' },
  water:  { id: 'water',  name: 'Water',  icon: 'water', color: '#3fa9f5', glow: '#a5e6ff' },
  fire:   { id: 'fire',   name: 'Fire',   icon: 'fire', color: '#ff7a3d', glow: '#ffd08a' },
  rock:   { id: 'rock',   name: 'Rock',   icon: 'rock', color: '#b99a6b', glow: '#f0dcb0' },
  // Future elements can simply be appended here.
};

/** Display order used by the Index, the Collection and the Wiki (grouped by element). */
export const ELEMENT_ORDER = ['nature', 'water', 'fire', 'rock'];

export const EFFECTIVENESS = {
  STRONG: 1.5,
  WEAK: 0.75,
  NEUTRAL: 1.0,
};

// attacker -> defender it is strong against
// Rock smothers Fire, but water erodes it and roots crack it: strong against
// one element, weak to two — so a Rock team is a real puzzle for the Fire party
// most players bring out of Emberwild, and a Water or Nature party shines there.
const STRONG_AGAINST = {
  nature: ['water', 'rock'],
  water: ['fire', 'rock'],
  fire: ['nature'],
  rock: ['fire'],
};

export function elementMultiplier(attackElement, defenderElement) {
  if (!attackElement || !defenderElement) return EFFECTIVENESS.NEUTRAL;
  if (attackElement === defenderElement) return EFFECTIVENESS.NEUTRAL;
  if ((STRONG_AGAINST[attackElement] || []).includes(defenderElement)) return EFFECTIVENESS.STRONG;
  if ((STRONG_AGAINST[defenderElement] || []).includes(attackElement)) return EFFECTIVENESS.WEAK;
  return EFFECTIVENESS.NEUTRAL;
}

export function effectivenessLabel(mult) {
  if (mult > 1.01) return "It's super effective!";
  if (mult < 0.99) return "It's not very effective...";
  return null;
}

export function elementOf(id) {
  return ELEMENTS[id] || { id, name: id, icon: 'spark', color: '#bbb', glow: '#fff' };
}
