// Element definitions & effectiveness chart (data-driven, extensible).
export const ELEMENTS = {
  nature: { id: 'nature', name: 'Nature', icon: '🌿', color: '#4fc76a', glow: '#9cff9c' },
  water:  { id: 'water',  name: 'Water',  icon: '💧', color: '#3fa9f5', glow: '#a5e6ff' },
  fire:   { id: 'fire',   name: 'Fire',   icon: '🔥', color: '#ff7a3d', glow: '#ffd08a' },
  // Future elements can simply be appended here.
};

export const EFFECTIVENESS = {
  STRONG: 1.5,
  WEAK: 0.75,
  NEUTRAL: 1.0,
};

// attacker -> defender it is strong against
const STRONG_AGAINST = {
  nature: ['water'],
  water: ['fire'],
  fire: ['nature'],
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
  return ELEMENTS[id] || { id, name: id, icon: '✦', color: '#bbb', glow: '#fff' };
}
