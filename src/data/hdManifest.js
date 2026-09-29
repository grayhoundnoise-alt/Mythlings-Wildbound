// =============================================================================
// HD IMAGE ASSETS — the secret "HD Images" mode, plus the main menu picture.
// =============================================================================
// This file is deliberately tiny and boring: a flat map of asset key -> entry.
// It exists as its own module so the offline bundler can rewrite `src` into
// base64 data URIs in one pass, without touching any game logic.
//
//   'model:<speciesId>:<stage>'   a transparent PNG of that Mythling form
//   'bg:<mapTheme>'               a battle arena background
//   'menu:main'                   the main menu picture
//
// MODEL ENTRIES carry their own placement, so a picture of any size or shape
// lands correctly without being cropped to match the animated rig:
//
//   height  how tall to draw the picture, in rig units (what `size` means).
//           Omit it and the form's own rig box height is used.
//   anchor  a point INSIDE the picture, in that picture's own pixels, which is
//           placed exactly on the rig's ground spot. The usual choice is the
//           feet: the bottom centre of the opaque area. Omit it and that is
//           what the game assumes.
//
// MythlingEdit.html measures both of these and hands them back to paste in.
// =============================================================================

export const HD_ASSETS = {
  // ---- Mythling models ----
  'model:spriggo:0': {
    src: 'assets/mythlings/spriggo_0.png',
    height: 108,
    anchor: { x: 442, y: 512 },
  },

  // ---- Battle arena backgrounds (weather still paints its sky on top) ----
  'bg:nature': { src: 'assets/backgrounds/nature.jpg' },

  // ---- The main menu picture ----
  'menu:main': { src: 'assets/backgrounds/mainmenu.jpg' },
};
