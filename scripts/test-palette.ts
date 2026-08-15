/**
 * The two rules asked for: no deck repeats another deck's colour, and no star
 * repeats another star's colour.
 *
 * Worth pinning because the second one very nearly has no solution. Six of the
 * eleven brand colours sit between 0.19 and 0.24 relative luminance, and if the
 * stars have to be flat brand colours too then terracotta, olive, slate and
 * ochre can only take the near black or the cream — four decks, two inks — so
 * by Hall's theorem there is no assignment at any useful contrast. It works
 * only because the stars are tints and shades of those hues rather than the
 * hues themselves, and it came apart once already when the blue and the navy,
 * one degree of hue apart, produced byte-identical shades.
 *
 * Run with: npm test
 */
import { DECK_COLOURS, starForIndex, starInk, contrast, PALETTE_ROTATION } from '../src/lib/deckPalette';

let failures = 0;
let checks = 0;

function check(name: string, pass: boolean, detail = '') {
  checks++;
  if (pass) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
}

function group(title: string, fn: () => void) { console.log(`\n${title}`); fn(); }

const stars = DECK_COLOURS.map((_, i) => starForIndex(i));

group('Nothing repeats', () => {
  check('eleven decks, eleven colours',
    new Set(DECK_COLOURS).size === DECK_COLOURS.length,
    `${new Set(DECK_COLOURS).size} distinct of ${DECK_COLOURS.length}`);
  check('eleven stars, eleven colours',
    new Set(stars).size === stars.length,
    `${new Set(stars).size} distinct of ${stars.length}: ${JSON.stringify(stars)}`);
  check('no star is the colour of the card it sits on',
    DECK_COLOURS.every((c, i) => stars[i].toLowerCase() !== c.toLowerCase()));
  check('no star is any deck colour verbatim — they are steps of one, not one',
    stars.every(s => !DECK_COLOURS.includes(s.toLowerCase())),
    JSON.stringify(stars.filter(s => DECK_COLOURS.includes(s.toLowerCase()))));
});

group('Every star can actually be seen', () => {
  const ratios = DECK_COLOURS.map((c, i) => contrast(c, stars[i]));
  const worst = Math.min(...ratios);
  check('all above 3.5:1', worst >= 3.5, `worst ${worst.toFixed(2)}:1`);
  check('better than the complementary rule it replaced (3.34:1)', worst > 3.34,
    `worst ${worst.toFixed(2)}:1`);
  DECK_COLOURS.forEach((c, i) => {
    check(`  ${c} -> ${stars[i]}  ${ratios[i].toFixed(2)}:1`, ratios[i] >= 3.5);
  });
});

group('The lookup and the index agree', () => {
  check('starInk(colour) matches starForIndex(position)',
    DECK_COLOURS.every((c, i) => starInk(c) === starForIndex(i)));
  check('a colour from outside the palette still gets a readable mark',
    contrast('#ff00ff', starInk('#ff00ff')) >= 3);
  check('the rotation is a real rotation, not zero',
    PALETTE_ROTATION > 0 && PALETTE_ROTATION < DECK_COLOURS.length,
    String(PALETTE_ROTATION));
});

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
