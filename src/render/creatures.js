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
import { hdEnabled, hdModelFor, drawHdModel } from './hdImages.js';

export {
  drawMythling, prewarm, CreatureRig, CreatureAnimationController,
  CreatureAssetLoader, creatureAssets, ANIMATIONS, ANIM_IDS,
  EXPRESSIONS, SPECIES_ART, artFor,
};

/**
 * The one place that decides "PNG or rig" — every UI and scene that shows a
 * Mythling calls this instead of drawMythling, so the secret HD Images toggle
 * switches the whole game at once. Anything without a PNG keeps animating.
 *
 * `force: true` skips the lookup and always animates. The roaming overworld
 * map uses that, because a creature that walks and turns needs the rig.
 */
export function drawCreature(ctx, o) {
  if (!o.force) {
    const img = hdModelFor(o.speciesId, o.stage ?? 0, o.mutation, o.view);
    if (img) { drawHdModel(ctx, img, o); return; }
  }
  drawMythling(ctx, o);
}

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
