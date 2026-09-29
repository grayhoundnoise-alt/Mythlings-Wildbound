// =============================================================================
// HD IMAGE ASSETS — the secret "HD Images" mode.
// =============================================================================
// This file is deliberately tiny and boring: a flat map of asset key -> URL.
// It exists as its own module so the offline bundler can rewrite the VALUES
// into base64 data URIs in one pass, without touching any game logic.
//
//   'model:<speciesId>:<stage>'   a transparent PNG of that Mythling form
//   'bg:<mapTheme>'               a battle arena background for that theme
//
// Only a handful of entries exist so far — this is still a trial. A key that is
// missing is NOT an error: the renderer falls back to the animated creature rig
// for that form, so the game always works no matter what is or is not listed
// here. Adding a species is just dropping a PNG in assets/mythlings/ and adding
// one line below.
// =============================================================================

export const HD_ASSETS = {
  // ---- Mythling models (transparent PNG, creature fills the frame) ----
  'model:spriggo:0': 'assets/mythlings/spriggo_0.png',

  // ---- Battle arena backgrounds (drawn behind everything, weather still
  //      paints its sky and tint on top of them) ----
  'bg:nature': 'assets/backgrounds/nature.jpg',
};
