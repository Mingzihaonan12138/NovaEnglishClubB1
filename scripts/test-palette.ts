/**
 * The mark is one mark, in one of two inks.
 *
 * This test used to assert the opposite — that all eleven stars were different
 * colours. That rule was satisfiable and was satisfied, at 4.02:1, and it still
 * failed: four of the eleven came out dark navies a few points apart and three
 * came out creams, so the page read as four colours scattered at random, with
 * the near-misses looking like errors. It is recorded here because the arithmetic
 * passing is exactly why it survived as long as it did.
 *
 * What is pinned now is that no deck repeats another deck's colour, that the
 * mark takes one of exactly two inks, and that a single ink is genuinely
 * impossible rather than merely unfashionable.
 *
 * Run with: npm test
 */
import { DECK_COLOURS, INK, CREAM, starInk, contrast, luminance } from '../src/lib/deckPalette';

let failures = 0;
let checks = 0;

function check(name: string, pass: boolean, detail = '') {
  checks++;
  if (pass) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
}

function group(title: string, fn: () => void) { console.log(`\n${title}`); fn(); }

const inks = DECK_COLOURS.map(starInk);
const ratios = DECK_COLOURS.map(c => contrast(c, starInk(c)));

group('One mark, two inks', () => {
  check('the decks themselves are all different',
    new Set(DECK_COLOURS).size === DECK_COLOURS.length);
  check('exactly two inks are ever used',
    new Set(inks).size === 2, `${new Set(inks).size}: ${JSON.stringify([...new Set(inks)])}`);
  check('and they are the ink and the cream',
    new Set(inks).has(INK) && new Set(inks).has(CREAM));
  check('dark ink goes on light stock and light ink on dark stock',
    DECK_COLOURS.every(c => (starInk(c) === INK) === (luminance(c) > 0.2)));
});

group('Every star can be seen', () => {
  const worst = Math.min(...ratios);
  check('all above 4:1', worst >= 4, `worst ${worst.toFixed(2)}:1`);
  check('better than the eleven-colour rule it replaced (4.02:1)', worst > 4.02,
    `worst ${worst.toFixed(2)}:1`);
  DECK_COLOURS.forEach((c, i) => {
    check(`  ${c} -> ${inks[i]}  ${ratios[i].toFixed(2)}:1`, ratios[i] >= 4);
  });
});

group('One ink alone is impossible, not merely unwanted', () => {
  const single = (ink: string) => Math.min(...DECK_COLOURS.map(c => contrast(c, ink)));
  check('the ink alone fails — it is invisible on the near-black deck',
    single(INK) < 1.05, `${single(INK).toFixed(2)}:1`);
  check('the cream alone fails on the pale decks',
    single(CREAM) < 2, `${single(CREAM).toFixed(2)}:1`);
  check('the brand gold alone fails on eight of eleven',
    DECK_COLOURS.filter(c => contrast(c, '#e5bb40') < 2.5).length === 8,
    String(DECK_COLOURS.filter(c => contrast(c, '#e5bb40') < 2.5).length));
});

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
