/* Ingredient artwork.
 *
 * Playful, slightly-3D illustrations per PRD 6.4 — rounded forms, soft
 * gradients, a specular highlight. Deliberately NOT photographic.
 *
 * Why SVG rather than emoji: emoji glyphs are drawn by the operating system's
 * font. They look dimensional on macOS and quite different on Windows or
 * another macOS version. The booth screen must not depend on that.
 *
 * Adding an ingredient: add a <symbol id="ing-yourkey"> below, then set
 * `sprite: 'yourkey'` in backend/seed.js. Anything with no matching symbol
 * falls back to `ing-generic`, so an unrecognised ingredient still renders.
 */

export const SPRITE_KEYS = [
  // the confirmed event list
  'crab', 'shabu-beef', 'pork-ribs', 'rice', 'cabbage', 'corn', 'broccoli',
  'potato', 'mushroom', 'carrot', 'tomato', 'capsicum', 'red-pepper',
  'eggplant', 'green-chilli', 'peas',
  // kept from the placeholder set, in case the list changes again
  'shrimp-ball', 'fish-tofu', 'meatball',
  'generic',
];

const SPRITE_SET = new Set(SPRITE_KEYS);

/** Resolve an ingredient's sprite key to a <use> href, with a safe fallback. */
export function spriteHref(key) {
  return SPRITE_SET.has(key) ? `#ing-${key}` : '#ing-generic';
}

/** Markup for one ingredient at a given CSS size. */
export function spriteSvg(key, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><use href="${spriteHref(key)}"/></svg>`;
}

/** Markup for a UI icon (not an ingredient — no generic fallback). */
export function iconSvg(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
}

const MARKUP = `
<svg id="hotpot-sprites" aria-hidden="true" focusable="false"
     style="position:absolute;width:0;height:0;overflow:hidden">
<defs>
  <linearGradient id="gBroc" x1="0" y1="0" x2=".35" y2="1">
    <stop offset="0" stop-color="#8AD46C"/><stop offset=".55" stop-color="#57A845"/><stop offset="1" stop-color="#2F7030"/>
  </linearGradient>
  <linearGradient id="gStalk" x1="0" y1="0" x2=".4" y2="1">
    <stop offset="0" stop-color="#E2F0C0"/><stop offset="1" stop-color="#9DBC72"/>
  </linearGradient>
  <radialGradient id="gCap" cx=".34" cy=".26" r=".86">
    <stop offset="0" stop-color="#CE9058"/><stop offset=".5" stop-color="#9A5C30"/><stop offset="1" stop-color="#5C3117"/>
  </radialGradient>
  <linearGradient id="gGill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FBEFD4"/><stop offset="1" stop-color="#D9C094"/>
  </linearGradient>
  <linearGradient id="gCarrot" x1="0" y1="0" x2=".5" y2="1">
    <stop offset="0" stop-color="#FFB457"/><stop offset=".5" stop-color="#F0801F"/><stop offset="1" stop-color="#BF500B"/>
  </linearGradient>
  <linearGradient id="gFrond" x1="0" y1="0" x2=".3" y2="1">
    <stop offset="0" stop-color="#7FCB63"/><stop offset="1" stop-color="#3B8A38"/>
  </linearGradient>
  <radialGradient id="gShrimp" cx=".33" cy=".27" r=".84">
    <stop offset="0" stop-color="#FFE6E0"/><stop offset=".55" stop-color="#F7B0A4"/><stop offset="1" stop-color="#D9776A"/>
  </radialGradient>
  <linearGradient id="gTofu" x1="0" y1="0" x2=".3" y2="1">
    <stop offset="0" stop-color="#FBDC97"/><stop offset=".55" stop-color="#EDB65C"/><stop offset="1" stop-color="#C2842A"/>
  </linearGradient>
  <linearGradient id="gCabbage" x1="0" y1="0" x2=".3" y2="1">
    <stop offset="0" stop-color="#F2F7E4"/><stop offset="1" stop-color="#B6CE92"/>
  </linearGradient>
  <linearGradient id="gCorn" x1="0" y1="0" x2=".35" y2="1">
    <stop offset="0" stop-color="#FFE07A"/><stop offset=".55" stop-color="#F5C518"/><stop offset="1" stop-color="#CE9A08"/>
  </linearGradient>
  <radialGradient id="gMeat" cx=".33" cy=".27" r=".84">
    <stop offset="0" stop-color="#C98A63"/><stop offset=".55" stop-color="#9E5F3C"/><stop offset="1" stop-color="#6E3B22"/>
  </radialGradient>
  <linearGradient id="gTrophy" x1=".15" y1="0" x2=".8" y2="1">
    <stop offset="0" stop-color="#FFE585"/><stop offset=".45" stop-color="#F5C518"/><stop offset="1" stop-color="#C9960A"/>
  </linearGradient>
  <linearGradient id="gTrophyBase" x1="0" y1="0" x2=".2" y2="1">
    <stop offset="0" stop-color="#F0B93C"/><stop offset="1" stop-color="#A87C06"/>
  </linearGradient>
  <linearGradient id="gCrab" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#FF8A5C"/><stop offset=".5" stop-color="#E8502A"/><stop offset="1" stop-color="#A82E12"/>
  </linearGradient>
  <linearGradient id="gBeef" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#F0A0A0"/><stop offset=".5" stop-color="#D9606A"/><stop offset="1" stop-color="#A83848"/>
  </linearGradient>
  <linearGradient id="gPork" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#C98A5C"/><stop offset=".5" stop-color="#A2603A"/><stop offset="1" stop-color="#70391E"/>
  </linearGradient>
  <linearGradient id="gRice" x1=".25" y1="0" x2=".6" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F4ECDA"/><stop offset="1" stop-color="#D8C9A8"/>
  </linearGradient>
  <linearGradient id="gPotato" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#E0BC86"/><stop offset=".5" stop-color="#C0965C"/><stop offset="1" stop-color="#8E6A38"/>
  </linearGradient>
  <radialGradient id="gTomato" cx=".33" cy=".28" r=".84">
    <stop offset="0" stop-color="#FF7A66"/><stop offset=".55" stop-color="#E33B2E"/><stop offset="1" stop-color="#A81E16"/>
  </radialGradient>
  <linearGradient id="gCapsicum" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#8AD46C"/><stop offset=".5" stop-color="#4E9B3E"/><stop offset="1" stop-color="#2E6B26"/>
  </linearGradient>
  <linearGradient id="gRedPepper" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#FF7A5C"/><stop offset=".5" stop-color="#DA3A26"/><stop offset="1" stop-color="#9E1E10"/>
  </linearGradient>
  <linearGradient id="gEggplant" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#A87CD4"/><stop offset=".5" stop-color="#6E3FA0"/><stop offset="1" stop-color="#43216A"/>
  </linearGradient>
  <linearGradient id="gChilli" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#8AD46C"/><stop offset=".55" stop-color="#4E9B3E"/><stop offset="1" stop-color="#2E7030"/>
  </linearGradient>
  <linearGradient id="gPeas" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#A5E58C"/><stop offset=".5" stop-color="#5FB047"/><stop offset="1" stop-color="#357A2E"/>
  </linearGradient>
  <linearGradient id="gCrown" x1=".2" y1="0" x2=".7" y2="1">
    <stop offset="0" stop-color="#FFE071"/><stop offset=".5" stop-color="#F5C518"/><stop offset="1" stop-color="#D9A400"/>
  </linearGradient>
  <linearGradient id="gGeneric" x1="0" y1="0" x2=".35" y2="1">
    <stop offset="0" stop-color="#F7EAC9"/><stop offset="1" stop-color="#CBB086"/>
  </linearGradient>
</defs>

<symbol id="ing-broccoli" viewBox="0 0 64 64">
  <path d="M27 33h10v19c0 4-2 6-5 6s-5-2-5-6z" fill="url(#gStalk)"/>
  <circle cx="19" cy="29" r="11" fill="url(#gBroc)"/>
  <circle cx="45" cy="29" r="11" fill="url(#gBroc)"/>
  <circle cx="26" cy="35" r="9"  fill="url(#gBroc)"/>
  <circle cx="40" cy="35" r="9"  fill="url(#gBroc)"/>
  <circle cx="32" cy="20" r="13" fill="url(#gBroc)"/>
  <circle cx="28" cy="14" r="4.2" fill="#A9E890" opacity=".7"/>
  <circle cx="16" cy="25" r="3"   fill="#A9E890" opacity=".5"/>
  <circle cx="42" cy="24" r="2.4" fill="#A9E890" opacity=".4"/>
</symbol>

<symbol id="ing-mushroom" viewBox="0 0 64 64">
  <path d="M27 32h10v18c0 3.4-2.2 5.6-5 5.6s-5-2.2-5-5.6z" fill="url(#gGill)"/>
  <ellipse cx="32" cy="32" rx="21" ry="6.4" fill="#E0C69C"/>
  <path d="M32 8c12.5 0 21.5 9.4 21.5 19.8 0 4.2-9.6 6.9-21.5 6.9s-21.5-2.7-21.5-6.9C10.5 17.4 19.5 8 32 8z" fill="url(#gCap)"/>
  <ellipse cx="24" cy="17.5" rx="7.4" ry="4.1" fill="#D9A170" opacity=".55" transform="rotate(-20 24 17.5)"/>
  <path d="M20 26.5c8-2 16-2 24 0" stroke="#4E2A12" stroke-width="1.5" fill="none" opacity=".3" stroke-linecap="round"/>
</symbol>

<symbol id="ing-carrot" viewBox="0 0 64 64">
  <g fill="url(#gFrond)">
    <path d="M32 19c-2.4-7.4-7.6-11.4-14-12.4 1.2 7.4 5.6 12.4 14 12.4z"/>
    <path d="M32 19c2.4-7.4 7.6-11.4 14-12.4-1.2 7.4-5.6 12.4-14 12.4z"/>
    <path d="M32.6 18.4c.4-8.2 2.4-13-.2-17.4-2.2 4.4-.6 9.2.2 17.4z"/>
  </g>
  <path d="M32 17c6.2 0 10.4 2.8 10.4 5.8 0 8.2-6.2 34.2-10.4 34.2S21.6 31 21.6 22.8C21.6 19.8 25.8 17 32 17z" fill="url(#gCarrot)"/>
  <g stroke="#B04A08" stroke-width="1.7" opacity=".45" stroke-linecap="round">
    <path d="M25.6 29h5.2"/><path d="M34 37.5h4.6"/><path d="M26.8 45h4"/>
  </g>
  <path d="M27 22c-1.2 6.4 0 19 2.2 27.6" stroke="#FFCE93" stroke-width="2.6" fill="none" opacity=".5" stroke-linecap="round"/>
</symbol>

<symbol id="ing-shrimp-ball" viewBox="0 0 64 64">
  <circle cx="32" cy="33" r="22.5" fill="url(#gShrimp)"/>
  <g fill="#D06A5E" opacity=".4">
    <circle cx="23" cy="29" r="1.9"/><circle cx="41" cy="27" r="1.6"/>
    <circle cx="36" cy="42" r="1.8"/><circle cx="22" cy="41" r="1.5"/><circle cx="31" cy="34" r="1.4"/>
  </g>
  <ellipse cx="24" cy="24" rx="8.4" ry="5.6" fill="#fff" opacity=".6" transform="rotate(-30 24 24)"/>
</symbol>

<symbol id="ing-fish-tofu" viewBox="0 0 64 64">
  <rect x="8" y="17" width="48" height="31" rx="12" fill="url(#gTofu)"/>
  <path d="M20 17h24c6.6 0 12 5.4 12 12 0 1.8-1.4 3-3.2 3H11.2C9.4 32 8 30.8 8 29c0-6.6 5.4-12 12-12z" fill="#FCE7B4" opacity=".45"/>
  <rect x="8" y="38" width="48" height="10" rx="5" fill="#B87A26" opacity=".4"/>
  <ellipse cx="21" cy="25" rx="7.4" ry="3.6" fill="#fff" opacity=".42" transform="rotate(-8 21 25)"/>
</symbol>

<symbol id="ing-cabbage" viewBox="0 0 64 64">
  <ellipse cx="32" cy="35" rx="22" ry="20" fill="url(#gCabbage)"/>
  <path d="M32 15c-6 6-9 13-9 20s3 13 9 20" stroke="#93B171" stroke-width="2" fill="none" opacity=".65"/>
  <path d="M32 15c6 6 9 13 9 20s-3 13-9 20" stroke="#93B171" stroke-width="2" fill="none" opacity=".65"/>
  <path d="M12 33c8-4 32-4 40 0" stroke="#93B171" stroke-width="2" fill="none" opacity=".5"/>
  <ellipse cx="24" cy="26" rx="7" ry="4" fill="#fff" opacity=".5" transform="rotate(-24 24 26)"/>
</symbol>

<symbol id="ing-corn" viewBox="0 0 64 64">
  <rect x="19" y="8" width="26" height="48" rx="13" fill="url(#gCorn)"/>
  <g fill="#D9A408" opacity=".45">
    <circle cx="26" cy="18" r="2.4"/><circle cx="34" cy="18" r="2.4"/><circle cx="42" cy="18" r="2.4"/>
    <circle cx="26" cy="27" r="2.4"/><circle cx="34" cy="27" r="2.4"/><circle cx="42" cy="27" r="2.4"/>
    <circle cx="26" cy="36" r="2.4"/><circle cx="34" cy="36" r="2.4"/><circle cx="42" cy="36" r="2.4"/>
    <circle cx="26" cy="45" r="2.4"/><circle cx="34" cy="45" r="2.4"/><circle cx="42" cy="45" r="2.4"/>
  </g>
  <ellipse cx="25" cy="16" rx="4" ry="7" fill="#fff" opacity=".35" transform="rotate(-10 25 16)"/>
</symbol>

<symbol id="ing-meatball" viewBox="0 0 64 64">
  <circle cx="32" cy="33" r="22.5" fill="url(#gMeat)"/>
  <g fill="#5E3018" opacity=".3">
    <circle cx="24" cy="28" r="2.1"/><circle cx="40" cy="30" r="1.8"/><circle cx="33" cy="43" r="2"/>
  </g>
  <ellipse cx="24" cy="24" rx="8" ry="5.2" fill="#fff" opacity=".38" transform="rotate(-30 24 24)"/>
</symbol>

<!-- Not an ingredient: a UI icon. Kept here so every drawn asset lives in one
     place and renders identically on any machine, unlike an emoji glyph. -->
<symbol id="icon-trophy" viewBox="0 0 64 64">
  <g fill="none" stroke="url(#gTrophyBase)" stroke-width="5" stroke-linecap="round">
    <path d="M17 15h-6a8 8 0 0 0 0 16h4"/>
    <path d="M47 15h6a8 8 0 0 1 0 16h-4"/>
  </g>
  <path d="M15 8h34v16c0 10.5-7.6 19-17 19s-17-8.5-17-19z" fill="url(#gTrophy)"/>
  <path d="M15 8h34v5H15z" fill="#FFE585" opacity=".55"/>
  <ellipse cx="24" cy="20" rx="4.4" ry="8" fill="#fff" opacity=".45" transform="rotate(-10 24 20)"/>
  <rect x="28" y="42" width="8" height="8" fill="url(#gTrophyBase)"/>
  <path d="M20 58h24c0-5-3.4-7.5-8-7.5h-8c-4.6 0-8 2.5-8 7.5z" fill="url(#gTrophyBase)"/>
  <rect x="16" y="55" width="32" height="6" rx="3" fill="url(#gTrophy)"/>
</symbol>

<!-- Sits on the pale-gold winner row, so it carries a darker outline: a plain
     gold fill would wash out against that background. -->
<symbol id="icon-crown" viewBox="0 0 64 64">
  <path d="M6 20l11 11L32 12l15 19 11-11-5 30H11z"
        fill="url(#gCrown)" stroke="#8E6A04" stroke-width="3" stroke-linejoin="round"/>
  <rect x="10" y="48" width="44" height="10" rx="4"
        fill="url(#gCrown)" stroke="#8E6A04" stroke-width="3"/>
  <circle cx="32" cy="40" r="4" fill="#E8547A" stroke="#8E6A04" stroke-width="1.6"/>
  <circle cx="18" cy="42" r="3" fill="#4FA8D8" stroke="#8E6A04" stroke-width="1.4"/>
  <circle cx="46" cy="42" r="3" fill="#4FA8D8" stroke="#8E6A04" stroke-width="1.4"/>
  <circle cx="6" cy="19" r="4.5" fill="url(#gCrown)" stroke="#8E6A04" stroke-width="2.4"/>
  <circle cx="58" cy="19" r="4.5" fill="url(#gCrown)" stroke="#8E6A04" stroke-width="2.4"/>
  <circle cx="32" cy="11" r="5" fill="url(#gCrown)" stroke="#8E6A04" stroke-width="2.4"/>
</symbol>

<!-- Shown on the dark reveal overlay, so it uses the bright poster accents. -->
<symbol id="icon-confetti" viewBox="0 0 64 64">
  <g fill="none" stroke-width="6" stroke-linecap="round">
    <path d="M13 52C20 40 26 33 38 26" stroke="#F5C518"/>
    <path d="M20 56C29 49 36 44 48 40" stroke="#E8547A"/>
    <path d="M10 43C14 33 19 26 27 18" stroke="#4FA8D8"/>
  </g>
  <g>
    <circle cx="46" cy="14" r="4.5" fill="#8B5FBF"/>
    <circle cx="56" cy="27" r="3.6" fill="#4A9B4E"/>
    <circle cx="34" cy="8" r="3.4" fill="#F5821F"/>
    <circle cx="57" cy="52" r="3.6" fill="#F5C518"/>
  </g>
</symbol>

<!-- Monochrome on purpose: it inherits the icon button's colour, including
     the coral it turns on hover. -->
<symbol id="icon-bin" viewBox="0 0 64 64">
  <g fill="currentColor">
    <path d="M25 6h14a4 4 0 0 1 4 4v4h-6v-2H27v2h-6v-4a4 4 0 0 1 4-4z"/>
    <rect x="10" y="15" width="44" height="7" rx="3.5"/>
    <path d="M16 26h32l-2.6 28a6 6 0 0 1-6 5.4H24.6a6 6 0 0 1-6-5.4z"/>
  </g>
  <g stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".55">
    <path d="M26 34v16"/><path d="M32 34v16"/><path d="M38 34v16"/>
  </g>
</symbol>

<symbol id="ing-crab" viewBox="0 0 64 64">
  <g stroke="#A82E12" stroke-width="4.5" stroke-linecap="round" fill="none">
    <path d="M18 42 8 51"/><path d="M23 47 17 57"/><path d="M46 42 56 51"/><path d="M41 47 47 57"/>
  </g>
  <g fill="url(#gCrab)" stroke="#A82E12" stroke-width="2.4">
    <path d="M13 26c-6-4-11-1-11 5s6 9 11 5l4-5z"/>
    <path d="M51 26c6-4 11-1 11 5s-6 9-11 5l-4-5z"/>
  </g>
  <ellipse cx="32" cy="34" rx="22" ry="15.5" fill="url(#gCrab)"/>
  <ellipse cx="23" cy="27" rx="7" ry="4" fill="#fff" opacity=".38" transform="rotate(-16 23 27)"/>
  <g fill="#5E1A0C"><circle cx="25" cy="30" r="2.8"/><circle cx="39" cy="30" r="2.8"/></g>
</symbol>

<symbol id="ing-shabu-beef" viewBox="0 0 64 64">
  <ellipse cx="32" cy="34" rx="25" ry="19" fill="url(#gBeef)"/>
  <g fill="#FBE6E3" opacity=".9">
    <path d="M11 29c9-5 22-6 34-2-11-1-23 0-34 2z"/>
    <path d="M9 37c11-4 25-5 37-1-12-1-25 0-37 1z"/>
    <path d="M15 44c9-3 21-4 30-1-10 0-21 0-30 1z"/>
  </g>
  <ellipse cx="22" cy="24" rx="9" ry="4.2" fill="#fff" opacity=".35" transform="rotate(-12 22 24)"/>
</symbol>

<symbol id="ing-pork-ribs" viewBox="0 0 64 64">
  <g fill="#F5E8D2">
    <rect x="2" y="23" width="12" height="7" rx="3.5"/><rect x="2" y="35" width="12" height="7" rx="3.5"/>
    <rect x="50" y="23" width="12" height="7" rx="3.5"/><rect x="50" y="35" width="12" height="7" rx="3.5"/>
  </g>
  <rect x="8" y="19" width="48" height="28" rx="9" fill="url(#gPork)"/>
  <g stroke="#66341A" stroke-width="2.2" opacity=".45" stroke-linecap="round">
    <path d="M23 21v24"/><path d="M34 21v24"/><path d="M45 21v24"/>
  </g>
  <ellipse cx="21" cy="26" rx="8" ry="3.2" fill="#fff" opacity=".24"/>
</symbol>

<symbol id="ing-rice" viewBox="0 0 64 64">
  <path d="M9 45c0-15 10-26 23-26s23 11 23 26z" fill="url(#gRice)"/>
  <ellipse cx="32" cy="45" rx="23" ry="7.5" fill="url(#gRice)"/>
  <g fill="#DFD0B0" opacity=".85">
    <ellipse cx="23" cy="34" rx="4.4" ry="2.5" transform="rotate(-26 23 34)"/>
    <ellipse cx="39" cy="31" rx="4.4" ry="2.5" transform="rotate(20 39 31)"/>
    <ellipse cx="31" cy="41" rx="4.4" ry="2.5" transform="rotate(-8 31 41)"/>
    <ellipse cx="45" cy="41" rx="4" ry="2.3" transform="rotate(32 45 41)"/>
    <ellipse cx="18" cy="42" rx="4" ry="2.3" transform="rotate(14 18 42)"/>
  </g>
  <ellipse cx="24" cy="28" rx="8" ry="3.6" fill="#fff" opacity=".55" transform="rotate(-20 24 28)"/>
</symbol>

<symbol id="ing-potato" viewBox="0 0 64 64">
  <ellipse cx="32" cy="33" rx="25" ry="18" fill="url(#gPotato)" transform="rotate(-12 32 33)"/>
  <g fill="#8E6A38" opacity=".5">
    <ellipse cx="21" cy="26" rx="3.2" ry="2.1"/><ellipse cx="41" cy="30" rx="2.8" ry="1.9"/>
    <ellipse cx="30" cy="41" rx="3" ry="2"/><ellipse cx="46" cy="39" rx="2.4" ry="1.6"/>
  </g>
  <ellipse cx="21" cy="24" rx="9" ry="4.2" fill="#fff" opacity=".32" transform="rotate(-20 21 24)"/>
</symbol>

<symbol id="ing-tomato" viewBox="0 0 64 64">
  <circle cx="32" cy="37" r="22" fill="url(#gTomato)"/>
  <g fill="#3E8A46">
    <path d="M32 17c-4-6-9-8-15-7 2 6 7 9 15 7z"/>
    <path d="M32 17c4-6 9-8 15-7-2 6-7 9-15 7z"/>
    <path d="M32 16c0-6 1-9 0-12-1 3 0 6 0 12z"/>
  </g>
  <ellipse cx="23" cy="29" rx="7.4" ry="4.8" fill="#fff" opacity=".45" transform="rotate(-28 23 29)"/>
</symbol>

<symbol id="ing-capsicum" viewBox="0 0 64 64">
  <path d="M32 19c13 0 21 8 21 20s-9 17-21 17-21-5-21-17 8-20 21-20z" fill="url(#gCapsicum)"/>
  <g fill="#265C20" opacity=".35">
    <path d="M20 31c0 13 3 21 6 23-6-3-10-11-10-23z"/><path d="M44 31c0 13-3 21-6 23 6-3 10-11 10-23z"/>
  </g>
  <rect x="29" y="7" width="6" height="13" rx="3" fill="#3E7A38"/>
  <ellipse cx="32" cy="20" rx="9" ry="3.6" fill="#4E9B4A"/>
  <ellipse cx="23" cy="29" rx="5.4" ry="7.4" fill="#fff" opacity=".3" transform="rotate(-14 23 29)"/>
</symbol>

<symbol id="ing-red-pepper" viewBox="0 0 64 64">
  <path d="M32 19c13 0 21 8 21 20s-9 17-21 17-21-5-21-17 8-20 21-20z" fill="url(#gRedPepper)"/>
  <g fill="#8E1A0E" opacity=".35">
    <path d="M20 31c0 13 3 21 6 23-6-3-10-11-10-23z"/><path d="M44 31c0 13-3 21-6 23 6-3 10-11 10-23z"/>
  </g>
  <rect x="29" y="7" width="6" height="13" rx="3" fill="#3E7A38"/>
  <ellipse cx="32" cy="20" rx="9" ry="3.6" fill="#4E9B4A"/>
  <ellipse cx="23" cy="29" rx="5.4" ry="7.4" fill="#fff" opacity=".3" transform="rotate(-14 23 29)"/>
</symbol>

<symbol id="ing-eggplant" viewBox="0 0 64 64">
  <path d="M43 21c9 7 10 21 2 29s-22 9-29 1-3-20 6-27c7-5 15-8 21-3z" fill="url(#gEggplant)"/>
  <g fill="#3E7A38">
    <path d="M40 19c3-6 9-9 15-9-1 7-6 11-13 13z"/>
    <path d="M47 8c2-3 5-5 9-5-1 4-4 7-9 5z"/>
  </g>
  <ellipse cx="25" cy="33" rx="5" ry="10" fill="#fff" opacity=".26" transform="rotate(-32 25 33)"/>
</symbol>

<symbol id="ing-green-chilli" viewBox="0 0 64 64">
  <path d="M21 15c11-1 24 8 28 21 3 10-1 19-8 21-6 1-10-3-8-10 3-11-4-21-15-23-5-1-3-8 3-9z" fill="url(#gChilli)"/>
  <path d="M21 15c-4-4-10-4-14-1 3 5 9 6 14 3z" fill="#3E7A38"/>
  <path d="M29 24c9 5 14 14 15 24" stroke="#A5E58C" stroke-width="3.2" fill="none" opacity=".45" stroke-linecap="round"/>
</symbol>

<symbol id="ing-peas" viewBox="0 0 64 64">
  <path d="M6 40c3-16 19-27 37-24 7 1 11 6 10 12-2 7-10 9-18 9-12 1-21 6-25 12-3 5-6 0-4-9z" fill="url(#gPeas)"/>
  <g fill="#7FCB63" stroke="#2F7030" stroke-width="2">
    <circle cx="21" cy="35" r="6.6"/><circle cx="35" cy="30" r="6.6"/><circle cx="48" cy="26" r="6"/>
  </g>
  <g fill="#fff" opacity=".5">
    <ellipse cx="19" cy="32" rx="2.4" ry="1.6"/><ellipse cx="33" cy="27" rx="2.4" ry="1.6"/>
  </g>
</symbol>

<symbol id="ing-generic" viewBox="0 0 64 64">
  <ellipse cx="32" cy="36" rx="21.5" ry="17.5" fill="url(#gGeneric)"/>
  <path d="M12 32c7-5.5 33-5.5 40 0" stroke="#BFA678" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".65"/>
  <ellipse cx="23" cy="28" rx="6.4" ry="3.4" fill="#fff" opacity=".45" transform="rotate(-18 23 28)"/>
</symbol>
</svg>`;

let injected = false;

/** Put the sprite sheet in the document once. Safe to call repeatedly. */
export function injectSprites() {
  if (injected || document.getElementById('hotpot-sprites')) return;
  document.body.insertAdjacentHTML('afterbegin', MARKUP);
  injected = true;
}
