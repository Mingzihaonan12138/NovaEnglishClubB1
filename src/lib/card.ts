/**
 * One card, at three sizes.
 *
 * There were three: the deck on the shelf at 1.367, the card in the crate at
 * 1.375, and the card you answer at 1.316, with corner radii of 0.9, 1.1 and
 * 1.6rem that bore no relation to any of them. Each was defensible alone. Put
 * in a sequence the student walks through in five seconds, they are three
 * different objects wearing the same colour, and that is what makes a set of
 * screens feel loose rather than made.
 *
 * The ratio is a real playing card's — 63 by 88mm, which is 1.397 — and the
 * corner is the same fraction of the width at every size, because that is what
 * happens when you photograph one object from nearer or further away. A card
 * whose corners stay 1.6rem while the card itself grows is a card that gets
 * rounder as it approaches, which nothing does.
 */
export const CARD_RATIO = 1.4;

/** A playing card's corner is about 3.5mm across 63mm of width. */
const CORNER = 0.062;

export interface CardBox {
  width: number;
  height: number;
  radius: string;
}

export function cardBox(width: number): CardBox {
  return {
    width,
    height: Math.round(width * CARD_RATIO),
    radius: `${(width * CORNER).toFixed(1)}px`,
  };
}

/** In the crate, where a whole row has to fit across the page. */
export const CRATE_CARD = cardBox(256);

/** The one you answer. Larger, because it is the only thing on screen. */
export const FLIP_CARD = cardBox(304);

/**
 * On the shelf. Its width comes from the grid rather than from here — five or
 * six across a 64rem column — so the corner is the one thing that has to be
 * stated, and 176px is what that grid actually produces.
 */
export const STACK_CARD = cardBox(176);
