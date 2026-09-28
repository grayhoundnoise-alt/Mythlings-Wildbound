// Original hand-built vector icon set for Mythlings: Wildbound.
// No emoji anywhere in the UI — every glyph below is drawn from our own path data
// so the interface keeps one consistent visual language on every platform.
// Each icon is authored on a 24x24 grid and inherits `currentColor`.

const P = {
  // ---- elements -------------------------------------------------------
  nature: '<path d="M20.4 3.2c-7.6-.6-12.2 1.5-14.4 4.6-2.2 3.2-1.5 7 .3 9l1.9-2.9c.4-2.6 1.7-4.9 4-6.6-1.6 2-2.6 4.3-3 6.9l-2.9 4.4a1.1 1.1 0 0 0 1.8 1.2l1.7-2.6c2.6 1 6.1.5 8.4-2.3 2.6-3.1 3.1-7.6 2.2-11.7Z"/>',
  water: '<path d="M12 2.2c-.4 0-.8.2-1 .5C8.3 6.3 5 10.4 5 14a7 7 0 0 0 14 0c0-3.6-3.3-7.7-6-11.3a1.3 1.3 0 0 0-1-.5Zm3.6 12.6a.8.8 0 0 1 .8.9 4.6 4.6 0 0 1-4 3.9.8.8 0 1 1-.2-1.6 3 3 0 0 0 2.6-2.5.8.8 0 0 1 .8-.7Z"/>',
  fire: '<path d="M13.4 1.6c.5 3.2-.7 4.8-2.2 6.4-1.7 1.8-3.7 3.8-3.7 7.2a6.5 6.5 0 0 0 13 .3c0-2.5-1-4.3-2-5.8-.2 1-.8 1.9-1.7 2.3.3-3.4-1-6.6-3.4-10.4ZM12 13.2c1.2 1.4 1.8 2.5 1.8 3.6a2.4 2.4 0 0 1-4.8.1c0-1.3.9-2.1 1.6-3 .5-.6.9-1.2 1.4-.7Z"/>',
  rock: '<path d="M8.2 3.4h6.4l4.6 4.2 1.6 6.4-3.4 6.6H7.4l-4.2-5.2.8-6.6Zm1 2.2L5.9 9.3l-.6 4.9 3.1 3.9h7.2l2.5-4.8-1.2-4.8-3.4-3.1Zm.6 3.2 3.6 1.2 1.1 3.6-2.8 2.3-3-1.3-.5-3.4Z"/>',
  // electric: a lightning bolt
  electric: '<path d="M13.2 2 4.6 13.4h5.9L9.4 22l9.9-12.4h-6.1L13.2 2Z"/>',
  // ice: a six-armed snowflake
  ice: '<path d="M11 2h2v3.3l2.2-1.3 1 1.7L13 7.6v3.2l2.8-1.6.1-2.6 2-.1.1 1.6 2.8-1.6 1 1.7-2.8 1.6 1.4.9-1 1.7-2.4-1.4L14 12l2.9 1.7 2.4-1.4 1 1.7-1.4.9 2.8 1.6-1 1.7-2.8-1.6-.1 1.6-2-.1-.1-2.6L13 13.2v3.2l3.2 1.9-1 1.7L13 18.7V22h-2v-3.3l-2.2 1.3-1-1.7 3.2-1.9v-3.2l-2.8 1.6-.1 2.6-2 .1-.1-1.6-2.8 1.6-1-1.7 2.8-1.6-1.4-.9 1-1.7 2.4 1.4L10 12 7.1 10.3 4.7 11.7l-1-1.7 1.4-.9-2.8-1.6 1-1.7 2.8 1.6.1-1.6 2 .1.1 2.6L11 10.8V7.6L7.8 5.7l1-1.7L11 5.3V2Z"/>',
  // metal: a hexagonal bolt head with a hex hole
  metal: '<path d="M12 1.8 21 7v10l-9 5.2L3 17V7l9-5.2Zm0 2.3L5 8.2v7.6l7 4 7-4V8.2l-7-4.1Zm0 3.4 4.1 2.4v4.7L12 17l-4.1-2.4V9.9L12 7.5Zm0 2.3-2.1 1.2v2.5l2.1 1.2 2.1-1.2v-2.5L12 9.8Z"/>',
  // poison: a dripping droplet with a skull-eye
  poison: '<path d="M12 2.4c-.4 0-.7.2-.9.5C8.6 6.6 5.4 10.6 5.4 14.2A6.6 6.6 0 0 0 12 20.8a6.6 6.6 0 0 0 6.6-6.6c0-3.6-3.2-7.6-5.7-11.3a1.1 1.1 0 0 0-.9-.5Zm-2.6 9.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm5.2 0a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM10.4 16h3.2v1.6h-3.2V16Z"/>',
  // psychic: an eye with a radiating iris
  psychic: '<path d="M12 5C7 5 3.2 8.2 1.6 12c1.6 3.8 5.4 7 10.4 7s8.8-3.2 10.4-7C20.8 8.2 17 5 12 5Zm0 11.6A4.6 4.6 0 1 1 12 7.4a4.6 4.6 0 0 1 0 9.2Zm0-7a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z"/>',
  spark: '<path d="M12 1.8 14 9l7.2 2-7.2 2-2 7.2L10 13 2.8 11 10 9Z"/>',

  // ---- battle ---------------------------------------------------------
  strike: '<path d="M3.6 3.1 9 8.5 7 10.5 2 5.6V3.1ZM20.4 3.1v2.5l-11 11-1.7-1 1-1.7ZM14.9 14l1.9 1.9 4.6 4.6v.4h-2.4L14.5 16ZM7.6 14.6 9.4 16.4 6 19.9 4.1 18Z"/>',
  ultimate: '<path d="M12 1.6 14.6 8l6.9.4-5.3 4.4 1.7 6.7L12 15.9 6.1 19.5l1.7-6.7L2.5 8.4 9.4 8Z"/>',
  orb: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2.2a7.8 7.8 0 0 1 7.7 6.7h-3.4a4.4 4.4 0 0 0-8.6 0H4.3A7.8 7.8 0 0 1 12 4.2Zm0 5.5a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Zm-7.7 3.4h3.4a4.4 4.4 0 0 0 8.6 0h3.4A7.8 7.8 0 0 1 12 19.8a7.8 7.8 0 0 1-7.7-6.7Z"/>',
  bag: '<path d="M9 2.8h6a3 3 0 0 1 3 3v1h1.6a1.6 1.6 0 0 1 1.6 1.8l-1.3 10a2.6 2.6 0 0 1-2.6 2.3H6.7a2.6 2.6 0 0 1-2.6-2.3l-1.3-10A1.6 1.6 0 0 1 4.4 6.8H6v-1a3 3 0 0 1 3-3Zm0 2.2a.9.9 0 0 0-.8.8v1h7.6v-1a.9.9 0 0 0-.8-.8Z"/>',
  swap: '<path d="M7.6 3.4 11 6.8l-1.6 1.6-1-1v6.2H6.2V7.4l-1 1L3.6 6.8ZM16.4 20.6 13 17.2l1.6-1.6 1 1V10.4h2.2v6.2l1-1 1.6 1.6Z"/>',
  run: '<path d="M14.6 2.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM12.4 7.6l3-.8 3.4 2.6-1.2 1.7-2.3-1.6-1 3.3 2.7 2.6 1.1 5.4-2.1.4-1-4.4-3.4-3-1.4 4.3-4.5 2.4-1-1.9 3.6-2 2.2-6.6-1.9.8-.8 2.6-2-.6 1.1-3.6Z"/>',
  block: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2.2c1.7 0 3.3.6 4.6 1.6L5.8 16.6A7.8 7.8 0 0 1 12 4.2Zm0 15.6a7.7 7.7 0 0 1-4.6-1.6L18.2 7.4A7.8 7.8 0 0 1 12 19.8Z"/>',
  shield: '<path d="M12 2.2 20 5v6.3c0 4.5-3.2 8.6-8 10.5-4.8-1.9-8-6-8-10.5V5Zm0 2.5L6.2 6.7v4.6c0 3.2 2.2 6.2 5.8 7.8 3.6-1.6 5.8-4.6 5.8-7.8V6.7Z"/>',

  // ---- ui chrome ------------------------------------------------------
  play: '<path d=\"M7.4 4.3 19.6 12 7.4 19.7Z\"/>',
  power: '<path d=\"M10.9 2.4h2.2v9.2h-2.2Zm-3.6 2.5 1.3 1.8a6.6 6.6 0 1 0 6.8 0l1.3-1.8a8.8 8.8 0 1 1-9.4 0Z\"/>',
  'chevron-right': '<path d=\"M8.6 4.2 16.4 12l-7.8 7.8-1.6-1.6L13.2 12 7 5.8Z\"/>',
  close: '<path d="M5.3 3.8 12 10.5l6.7-6.7 1.5 1.5L13.5 12l6.7 6.7-1.5 1.5L12 13.5l-6.7 6.7-1.5-1.5L10.5 12 3.8 5.3Z"/>',
  menu: '<path d="M3.4 5.4h17.2v2.3H3.4Zm0 5.5h17.2v2.2H3.4Zm0 5.4h17.2v2.3H3.4Z"/>',
  chevronDown: '<path d="M12 15.8 4.8 8.6l1.6-1.6L12 12.6l5.6-5.6 1.6 1.6Z"/>',
  chevronRight: '<path d="M8.6 19.2 7 17.6l5.6-5.6L7 6.4l1.6-1.6 7.2 7.2Z"/>',
  arrowRight: '<path d="M13.2 4.6 20.6 12l-7.4 7.4-1.6-1.6 4.7-4.7H3.4v-2.2h12.9L11.6 6.2Z"/>',
  up: '<path d="M12 5.4 19 14h-4v5h-6v-5H5Z"/>',
  down: '<path d="M12 18.6 5 10h4V5h6v5h4Z"/>',
  plus: '<path d="M10.9 4.4h2.2v6.5h6.5v2.2h-6.5v6.5h-2.2v-6.5H4.4v-2.2h6.5Z"/>',
  minus: '<path d="M4.4 10.9h15.2v2.2H4.4Z"/>',
  check: '<path d="M9.6 17.5 4 11.9l1.7-1.7 3.9 3.9L18.3 5.4 20 7.1Z"/>',
  lock: '<path d="M12 2.4a4.6 4.6 0 0 1 4.6 4.6v2.2h1a1.6 1.6 0 0 1 1.6 1.6v8a1.6 1.6 0 0 1-1.6 1.6H6.4a1.6 1.6 0 0 1-1.6-1.6v-8a1.6 1.6 0 0 1 1.6-1.6h1V7A4.6 4.6 0 0 1 12 2.4Zm0 2.2A2.4 2.4 0 0 0 9.6 7v2.2h4.8V7A2.4 2.4 0 0 0 12 4.6Zm0 8a1.8 1.8 0 0 0-.9 3.4v1.8h1.8V16a1.8 1.8 0 0 0-.9-3.4Z"/>',
  coin: '<path d="M12 2.4c5.3 0 9.6 2.2 9.6 4.8v9.6c0 2.6-4.3 4.8-9.6 4.8s-9.6-2.2-9.6-4.8V7.2c0-2.6 4.3-4.8 9.6-4.8Zm0 2.2C7.9 4.6 4.6 6 4.6 7.2S7.9 9.8 12 9.8s7.4-1.4 7.4-2.6S16.1 4.6 12 4.6Zm-1.1 3.2h2.2v1c1 .2 1.7.8 1.7 1.7h-1.8c0-.3-.4-.5-1-.5s-1 .2-1 .5.3.4 1.2.6c1.6.3 2.7.8 2.7 2.1 0 1-.8 1.7-1.8 1.9v1h-2.2v-1c-1.1-.2-1.9-.9-1.9-1.9h1.8c0 .4.5.6 1.2.6s1.1-.2 1.1-.5-.4-.5-1.4-.7c-1.4-.3-2.5-.8-2.5-2 0-.9.7-1.6 1.7-1.8Z"/>',
  heal: '<path d="M9.4 2.6h5.2v6.8h6.8v5.2h-6.8v6.8H9.4v-6.8H2.6V9.4h6.8Z"/>',
  dna: '<path d="M6.4 2.4h11.2v2.2c0 2.3-1.6 4-3.3 5.2l-.6.4.6.4c1.7 1.2 3.3 2.9 3.3 5.2v2.2H6.4v-2.2c0-2.3 1.6-4 3.3-5.2l.6-.4-.6-.4C8 8.6 6.4 6.9 6.4 4.6Zm2.2 2.2c0 1.3 1 2.4 2.5 3.4l1 .7 1-.7c1.4-1 2.4-2.1 2.4-3.4Zm3.4 7.7-1 .7c-1.5 1-2.4 2.1-2.4 3.4h6.8c0-1.3-1-2.4-2.4-3.4Z"/>',
  box: '<path d="M3 6.2 12 2.4l9 3.8v11.6L12 21.6l-9-3.8Zm9 2 5.6-2.3L12 4.7 6.4 6Zm-1.1 2-5.7-2.4v8.4l5.7 2.4Zm2.2 8.4 5.7-2.4V7.8l-5.7 2.4Z"/>',
  save: '<path d="M4.6 2.8h12.1l4.5 4.5v13.9H4.6a1.8 1.8 0 0 1-1.8-1.8V4.6a1.8 1.8 0 0 1 1.8-1.8Zm2.2 2.2v4.6h8.4V5Zm-.8 8.2v6h12v-6Z"/>',
  folder: '<path d="M2.6 4.8h6.6l2 2.4h10.2v12H2.6Zm2.2 2.2v9.6h14.4V9.4H10.2l-2-2.4Z"/>',
  home: '<path d="M12 2.4 22 11l-1.5 1.7-1.3-1.1v9.2h-5v-6h-4.4v6h-5v-9.2L3.5 12.7 2 11Z"/>',
  pencil: '<path d="M16.6 2.6 21.4 7.4 8.8 20H4v-4.8ZM6.2 16.1v1.7h1.7l9-9-1.7-1.7Z"/>',
  book: '<path d="M4 3.2h6.2A3 3 0 0 1 12 4a3 3 0 0 1 1.8-.7H20v16h-6.2a1.7 1.7 0 0 0-1.3.6H11.5a1.7 1.7 0 0 0-1.3-.6H4Zm2.2 2.2v11.6h4c.6 0 1.2.1 1.7.4V6.4a1.7 1.7 0 0 0-1.4-.7Zm7.9 0a1.7 1.7 0 0 0-1.4.7v11a4 4 0 0 1 1.7-.4h4V5.4Z"/>',
  map: '<path d="M8.9 2.6 15.1 5l5.5-2.4 1.4.9v16l-6.9 2.9-6.2-2.4L3.4 22 2 21.1v-16Zm-.9 2.7-3.8 1.6v11.4l3.8-1.6Zm2.2 11.5 3.6 1.4V7.2l-3.6-1.4Zm5.8 1.4 3.8-1.6V5.2l-3.8 1.6Z"/>',
  food: '<path d="M12.6 5.3c1.5-1.1 3.4-1.4 5.1-.7 2.7 1.1 3.9 4.5 2.6 8-1 2.9-3.1 6.1-5.2 7.6-1 .7-2.1.6-3.1 0-1-.6-2.1-.7-3.1 0-1 .6-2.1.7-3.1 0C3.7 18.7 1.6 15.5.6 12.6c-1.3-3.5-.1-6.9 2.6-8 1.8-.7 3.9-.3 5.4 1a5.8 5.8 0 0 1 1.8 2.4 5.6 5.6 0 0 1 2.2-2.7Z" transform="translate(1.6 0)"/><path d="M12.4 5.2c-.3-1.6.3-3.2 1.7-4.2l1.3 1.8c-.8.6-1 1.4-.8 2.2Z"/>',
  shop: '<path d="M3.4 3.4h3l.6 2.4h13.6l-2 8.1H8.5l.3 1.4h10.6v2.2H7L4.8 5.6H3.4Zm5.2 14.9a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Zm9 0a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z"/>',
  settings: '<path d="m10.3 2.4h3.4l.4 2.4c.6.2 1.2.5 1.7.9l2.3-.9 1.7 3-1.8 1.6a6.9 6.9 0 0 1 0 2l1.8 1.6-1.7 3-2.3-.9c-.5.4-1.1.7-1.7.9l-.4 2.4h-3.4l-.4-2.4a6.6 6.6 0 0 1-1.7-.9l-2.3.9-1.7-3 1.8-1.6a6.9 6.9 0 0 1 0-2L3.9 7.8l1.7-3 2.3.9c.5-.4 1.1-.7 1.7-.9ZM12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z"/>',
  infinity: '<path d="M6.6 7.6c2 0 3.3 1.4 4.2 2.6l.7 1 .8 1c.8 1 1.5 1.6 2.6 1.6a2.2 2.2 0 1 0 0-4.4c-.7 0-1.3.3-1.9.8l-1.4-1.7a5 5 0 0 1 3.3-1.3 4.4 4.4 0 1 1 0 8.8c-2 0-3.3-1.4-4.2-2.6l-.7-1-.8-1c-.8-1-1.5-1.6-2.6-1.6a2.2 2.2 0 1 0 0 4.4c.7 0 1.3-.3 1.9-.8l1.4 1.7a5 5 0 0 1-3.3 1.3 4.4 4.4 0 1 1 0-8.8Z"/>',
  shiny: '<path d="M12 1.4 13.7 7 19.3 8.7 13.7 10.4 12 16l-1.7-5.6L4.7 8.7 10.3 7Zm6.4 11.2.9 2.8 2.9.9-2.9.9-.9 2.8-.9-2.8-2.8-.9 2.8-.9ZM5.6 14.4l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7Z"/>',
  darkness: '<path d="M20.4 14.9A8.6 8.6 0 0 1 9.1 3.6 8.6 8.6 0 1 0 20.4 15ZM14.9 2.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
  diamond: '<path d="M12 2.2 21.8 12 12 21.8 2.2 12Zm0 3.6L5.8 12 12 18.2 18.2 12Z"/>',
  flag: '<path d="M4.6 2.4h2.2v1.3l3.6-.9 4 1 5-1.2v10.6l-5 1.2-4-1-3.6.9v7.3H4.6Z"/>',
  user: '<path d="M12 2.6a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4ZM3.6 21.4c0-4.3 3.8-7.3 8.4-7.3s8.4 3 8.4 7.3Z"/>',
  levelup: '<path d="M12 2.4 20.6 11h-4.4v4.2H7.8V11H3.4Zm-4.2 16h8.4v2.8H7.8Z"/>',
  timer: '<path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 2.2A6.8 6.8 0 1 0 12 18.8 6.8 6.8 0 0 0 12 5.2Zm1.1 1.9v5.4l3.6 2.1-1.1 1.9-4.7-2.7V7.1Z"/>',
  key: '<path d="M15.4 2.6a6 6 0 0 1 2.3 11.6l-1.5 3.3-2.1.9-.9 2.1-2.1.9-.9 2.1H3.4v-4.3l7.2-7.2A6 6 0 0 1 15.4 2.6Zm1.4 3.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z"/>',
};

const ALIASES = {
  catch: 'orb', ball: 'orb', item: 'bag', party: 'swap', physical: 'strike',
  special: 'spark', buff: 'shield', storage: 'box', collection: 'book',
  exit: 'home', slots: 'folder', nickname: 'pencil', objective: 'diamond',
};

export function iconPath(name) {
  return P[ALIASES[name] || name] || P.spark;
}

/** SVG markup string — use inside innerHTML/templates. */
/**
 * The raw `d` path data of an icon, for drawing the glyph on a <canvas> with
 * Path2D (authored on a 24x24 grid). Returns [] when the icon has no path data.
 */
export function iconPathData(name) {
  const src = P[ALIASES[name] || name] || '';
  const out = [];
  const re = /\sd="([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}
/** Draw an icon glyph on a canvas at (x, y) top-left, `size` px square, filled with `color`. */
export function drawIconGlyph(ctx, name, x, y, size, color) {
  if (typeof Path2D === 'undefined') return false;
  const paths = iconPathData(name);
  if (!paths.length) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  for (const d of paths) ctx.fill(new Path2D(d));
  ctx.restore();
  return true;
}

export function iconSvg(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPath(name)}</svg>`;
}

/** SVG element — use with the `el()` DOM helper. */
export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `ico-wrap ${cls}`;
  span.innerHTML = iconSvg(name);
  return span.firstElementChild;
}

/** Label made of an icon plus text, for buttons. */
export function iconLabel(name, text, cls = '') {
  const span = document.createElement('span');
  span.className = 'ico-label';
  span.innerHTML = `${iconSvg(name, cls)}<span>${text}</span>`;
  return span;
}

export const ELEMENT_ICON = { nature: 'nature', water: 'water', fire: 'fire', rock: 'rock', electric: 'electric', ice: 'ice', metal: 'metal', poison: 'poison', psychic: 'psychic' };
