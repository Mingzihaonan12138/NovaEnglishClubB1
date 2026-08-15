/**
 * The deck colours, and the colour the star prints in on each of them.
 *
 * Two rules were asked for: no deck repeats another deck's colour, and no star
 * repeats another star's colour. The first is free — there are eleven decks and
 * eleven colours, so position decides it.
 *
 * The second has no solution if the stars must also be flat brand colours.
 * Six of the eleven sit between 0.19 and 0.24 relative luminance, and the only
 * palette entries far enough from that band to read against them are the near
 * black and the cream. Terracotta, olive, slate and ochre have those two and
 * nothing else — four decks competing for two inks — so by Hall's theorem no
 * assignment exists, at any contrast threshold worth having. Tried and
 * measured, not assumed.
 *
 * What the palette was missing is a light and a dark step of each hue, which is
 * what a palette normally has. So the star on a deck is a tint or a shade of
 * *another* deck's hue: same eleven colours, two more values each. Which hue is
 * a fixed rotation, so every star has a different one and none matches the card
 * it sits on. The rotation is chosen below by measuring, not by taste.
 */

/** The eleven, in the order decks are handed them. */
export const DECK_COLOURS = [
  '#e5bb40', // gold
  '#445da3', // blue
  '#d4673a', // terracotta
  '#88aec9', // mist blue
  '#7a7c2e', // olive
  '#efa0b3', // pink
  '#6e86a8', // slate
  '#c9cf92', // pale green
  '#221e1a', // near black
  '#2c3d6e', // navy
  '#a8791f', // ochre
];

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function toHsl(hex: string): { h: number; s: number; l: number } {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) :
    max === g ? ((b - r) / d + 2) : ((r - g) / d + 4);
  return { h: h * 60, s, l };
}

function toHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor((((h % 360) + 360) % 360) / 60);
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * The dark and light steps of a brand hue.
 *
 * The near black is all but colourless, and a tint of a colourless thing is a
 * grey, so saturation is floored — a step of our ochre should still look like
 * ochre. The two lightnesses are pushed far apart because the mid-toned cards
 * are the hard ones: olive sits at 0.188 relative luminance, almost exactly
 * halfway, and only clears 3.7:1 against either step once they are this far out.
 */
/**
 * The step's lightness also walks a little with which colour it came from.
 *
 * Without that the blue and the navy — 224° and 225° apart from each other by
 * one degree — produced byte-identical shades, and two decks ended up with the
 * same star after all. Each hue is used by exactly one deck, so keying the
 * lightness to it guarantees eleven distinct values, and the spread is small
 * enough that they all still read as the same dark or the same light.
 */
const shade = (hex: string, k: number) => {
  const { h, s } = toHsl(hex);
  return toHex(h, Math.max(s, 0.5), 0.10 + 0.04 * k);
};
const tint = (hex: string, k: number) => {
  const { h, s } = toHsl(hex);
  return toHex(h, Math.max(s, 0.45), 0.93 - 0.05 * k);
};

/** Mid grey. Above it a card wants a dark mark, below it a light one. */
const PIVOT = 0.2;

function starForRotation(i: number, rotation: number): string {
  const card = DECK_COLOURS[i];
  const from = (i + rotation) % DECK_COLOURS.length;
  const source = DECK_COLOURS[from];
  const k = from / (DECK_COLOURS.length - 1);
  return luminance(card) >= PIVOT ? shade(source, k) : tint(source, k);
}

/**
 * Which rotation to use.
 *
 * Any non-zero rotation gives every star a different hue from every other and
 * from its own card — that part is arithmetic. Which one to take is a question
 * about contrast, so it is measured: the rotation whose worst card-to-star pair
 * is the best of the ten. Computed once at load; eleven colours is nothing.
 */
const ROTATION = (() => {
  let best = 1, bestWorst = -1;
  for (let r = 1; r < DECK_COLOURS.length; r++) {
    let worst = Infinity;
    for (let i = 0; i < DECK_COLOURS.length; i++) {
      worst = Math.min(worst, contrast(DECK_COLOURS[i], starForRotation(i, r)));
    }
    if (worst > bestWorst) { bestWorst = worst; best = r; }
  }
  return best;
})();

/** The star colour for the deck in position i. */
export function starForIndex(i: number): string {
  return starForRotation(((i % DECK_COLOURS.length) + DECK_COLOURS.length) % DECK_COLOURS.length, ROTATION);
}

/**
 * The star colour for a card of this colour.
 *
 * Kept as a lookup so callers that only have the colour to hand — the card back
 * does not know its own position in the grid — get the same answer. A colour
 * from outside the palette falls back to whichever step reads on it.
 */
export function starInk(cardHex: string): string {
  const i = DECK_COLOURS.indexOf(cardHex.toLowerCase());
  if (i >= 0) return starForIndex(i);
  return luminance(cardHex) >= PIVOT ? '#221e1a' : '#fcf6f0';
}

/** For tests and for looking at. */
export const PALETTE_ROTATION = ROTATION;
