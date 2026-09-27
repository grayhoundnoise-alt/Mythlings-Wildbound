// =============================================================================
// The MYTHLINGS: WILDBOUND wordmark.
//
// Built as an inline SVG so it stays razor sharp at any resolution and needs no
// image assets or licensed fonts. Three layers give it dimension:
//   1. a dark navy outline drawn as a fat stroke behind the letters
//   2. a gold keyline
//   3. an ice-blue -> white gradient fill with a soft inner highlight
// The crest above the wordmark carries the game's three elements — a leaf
// (Nature), a droplet (Water) and a flame (Fire) — inside a cut-gem frame.
// =============================================================================

export function titleLogo() {
  const wrap = document.createElement('div');
  wrap.className = 'logo-wrap';
  wrap.innerHTML = LOGO_SVG;
  return wrap;
}

export const LOGO_SVG = `
<svg class="logo-svg" viewBox="0 0 720 300" role="img" aria-label="Mythlings: Wildbound">
  <defs>
    <linearGradient id="lg-title" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#ffffff"/>
      <stop offset="42%"  stop-color="#dff2ff"/>
      <stop offset="63%"  stop-color="#8fd3f8"/>
      <stop offset="100%" stop-color="#3f9ad8"/>
    </linearGradient>
    <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#fff3c9"/>
      <stop offset="45%"  stop-color="#f6cd6a"/>
      <stop offset="100%" stop-color="#c2861f"/>
    </linearGradient>
    <linearGradient id="lg-ribbon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#1d3b5f"/>
      <stop offset="100%" stop-color="#0d1f36"/>
    </linearGradient>
    <linearGradient id="lg-crest" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#2a5c8f"/>
      <stop offset="100%" stop-color="#0e2440"/>
    </linearGradient>
    <radialGradient id="lg-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#8fe6ff" stop-opacity=".75"/>
      <stop offset="100%" stop-color="#8fe6ff" stop-opacity="0"/>
    </radialGradient>
    <filter id="lg-soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#04101f" flood-opacity=".6"/>
    </filter>
  </defs>

  <!-- crest -->
  <g class="logo-crest" filter="url(#lg-soft)">
    <ellipse cx="360" cy="62" rx="120" ry="60" fill="url(#lg-glow)"/>
    <path d="M360 8 421 46 421 84 360 122 299 84 299 46Z" fill="url(#lg-crest)" stroke="#f0cd7e" stroke-width="4" stroke-linejoin="round"/>
    <path d="M360 18 411 51 411 79 360 112 309 79 309 51Z" fill="none" stroke="#6fd0f5" stroke-width="2" stroke-opacity=".7" stroke-linejoin="round"/>
    <!-- nature leaf (left) -->
    <path d="M338 48c-12 2-19 10-19 20 0 9 7 16 16 16 11 0 18-10 18-23 0-5-1-9-3-13-4 5-7 11-8 18-1-6 0-12 4-18Z" fill="#6fcf71"/>
    <path d="M335 84c1-10 5-18 11-24" fill="none" stroke="#2f7a45" stroke-width="2" stroke-linecap="round"/>
    <!-- water droplet (centre) -->
    <path d="M360 34c9 12 16 21 16 29a16 16 0 0 1-32 0c0-8 7-17 16-29Z" fill="#63c8f5"/>
    <path d="M368 66a8 8 0 0 1-7 7" fill="none" stroke="#eaf9ff" stroke-width="2.4" stroke-linecap="round"/>
    <!-- fire (right) -->
    <path d="M385 36c2 8-1 11-4 15-4 4-8 8-8 15a12 12 0 0 0 24 1c0-6-3-10-5-14-1 3-2 4-4 5 1-8-1-15-3-22Z" fill="#ff9a3c"/>
    <path d="M383 63c3 4 4 6 4 8a4 4 0 0 1-8 0c0-3 2-5 4-8Z" fill="#ffe08a"/>
    <!-- side flourishes -->
    <path d="M296 70c-22 2-38 10-52 22 18-4 33-4 47 1Z" fill="#2f7a45"/>
    <path d="M424 70c22 2 38 10 52 22-18-4-33-4-47 1Z" fill="#2f7a45"/>
  </g>

  <!-- MYTHLINGS -->
  <g class="logo-main" filter="url(#lg-soft)">
    <text x="360" y="200" text-anchor="middle" textLength="604" lengthAdjust="spacingAndGlyphs"
          class="logo-text"
          stroke="#0b1f38" stroke-width="18" stroke-linejoin="round" fill="#0b1f38">MYTHLINGS</text>
    <text x="360" y="200" text-anchor="middle" textLength="604" lengthAdjust="spacingAndGlyphs"
          class="logo-text"
          stroke="url(#lg-gold)" stroke-width="7" stroke-linejoin="round" fill="none">MYTHLINGS</text>
    <text x="360" y="200" text-anchor="middle" textLength="604" lengthAdjust="spacingAndGlyphs"
          class="logo-text" fill="url(#lg-title)">MYTHLINGS</text>
  </g>

  <!-- WILDBOUND ribbon -->
  <g class="logo-sub" filter="url(#lg-soft)">
    <path d="M196 226 524 226 512 268 208 268Z" fill="url(#lg-ribbon)" stroke="#f0cd7e" stroke-width="3"/>
    <path d="M196 226 168 240 196 254Z" fill="#153050" stroke="#f0cd7e" stroke-width="3" stroke-linejoin="round"/>
    <path d="M524 226 552 240 524 254Z" fill="#153050" stroke="#f0cd7e" stroke-width="3" stroke-linejoin="round"/>
    <text x="360" y="258" text-anchor="middle" textLength="286" lengthAdjust="spacingAndGlyphs" class="logo-subtext" fill="url(#lg-gold)">WILDBOUND</text>
  </g>
</svg>`;
