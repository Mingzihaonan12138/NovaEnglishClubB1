/**
 * The deck colours, and the ink the star prints in on each of them.
 *
 * The star is the mark, so it is the same mark on every deck. It got there the
 * long way round. First it was the complement of its card, which is a real rule
 * and looked like mud: a light card's complement has to go dark to be seen at
 * all, and the dark side of orange is brown. Then it was a step of another
 * deck's hue, one per deck, so that no two stars repeated — which worked on
 * paper, eleven distinct values and 4.02:1 at worst, and failed in front of the
 * eye. Four of the eleven were dark navies within a few points of each other
 * and three were creams. The page read as four colours scattered at random, and
 * the small differences looked like mistakes rather than like a system. A rule
 * nobody can perceive is not a rule, it is noise.
 *
 * It is also the wrong job for a mark. Which deck this is gets said by the
 * colour of the card and by the name printed under it; the star saying it a
 * third time buys nothing and costs the mascot its identity. Eleven coloured
 * mascots are eleven mascots.
 *
 * So: one mark, two inks, chosen the way a printer chooses them — dark ink on
 * light stock, light ink on dark stock. A single flat colour cannot work, and
 * that is arithmetic rather than preference: the near-black deck against the
 * ink is 1.00:1, and gold, the mark's own colour, falls below 2.5:1 on eight of
 * the eleven. Two values clear 4.12:1 at worst, which is better than either
 * rule they replace.
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

export const INK = '#221e1a';
export const CREAM = '#fcf6f0';

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

/**
 * Where the stock stops being light.
 *
 * Not 0.5. Relative luminance is not perceptual lightness, and the awkward
 * decks — olive at 0.188, ochre at 0.221, slate at 0.232 — all sit under a
 * quarter while looking like mid-tones. 0.2 is the point at which the two inks
 * are equally good, and it puts olive on cream at 4.12:1, the worst pair there
 * is.
 */
const LIGHT_STOCK = 0.2;

/** The ink the mark prints in on a card of this colour. */
export function starInk(cardHex: string): string {
  return luminance(cardHex) > LIGHT_STOCK ? INK : CREAM;
}
