// =============================================================================
// MYTHLING CREATURE RENDERER — public entry point
// -----------------------------------------------------------------------------
// The renderer is now a layered 2D puppet rig:
//
//   creatureArt.js   the artwork, authored as 8-12 animatable layers per species
//   creatureRig.js   asset baking/caching, animation controller, compositor
//   creatures.js     this file — the API every game system already imports
//
// `drawMythling(ctx, o)` keeps its original signature and options, and gains
// two: pose.anim ('idle' | 'walk' | 'normalAttack' | ... ) and pose.animPhase.
// =============================================================================
import {
  drawMythling, prewarm, CreatureRig, CreatureAnimationController,
  CreatureAssetLoader, creatureAssets, ANIMATIONS, ANIM_IDS,
} from './creatureRig.js';
import { EXPRESSIONS, SPECIES_ART, artFor } from './creatureArt.js';

export {
  drawMythling, prewarm, CreatureRig, CreatureAnimationController,
  CreatureAssetLoader, creatureAssets, ANIMATIONS, ANIM_IDS,
  EXPRESSIONS, SPECIES_ART, artFor,
};

/** Renders a Mythling to an offscreen canvas (used for list icons). */
export function mythlingIcon(speciesId, stage, mutation, px = 72) {
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const ctx = cv.getContext('2d');
  ctx.save();
  ctx.translate(px * 0.5, px * 0.86);
  drawMythling(ctx, {
    speciesId, stage, mutation, x: -6, y: 0, size: px * 0.72, t: 0, facing: 1, shadow: false,
  });
  ctx.restore();
  return cv;
}

/** Expression ids the renderer understands (used by the design-sheet page). */
export const EXPRESSION_IDS = Object.keys(EXPRESSIONS);
