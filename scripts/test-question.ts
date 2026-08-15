/**
 * Splitting a question from the examiner's other wordings of it.
 *
 * Trinity's material carries the alternatives in brackets, and printed as one
 * string they ran off the bottom of the card. The risk in fixing that is cutting
 * a question that only happens to contain a bracket, so most of these are about
 * what must be left alone. Run with: npm test
 */
import { splitQuestion, spokenForm, questionSize } from '../src/lib/question';

let failures = 0;
let checks = 0;

function check(name: string, pass: boolean, detail = '') {
  checks++;
  if (pass) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
}

function group(title: string, fn: () => void) { console.log(`\n${title}`); fn(); }

/** The question that overflowed the card, exactly as it is stored. */
const REAL =
  'Tell me about a recent event that made you feel happy. (Do you have a recent ' +
  'event that made you feel excited? / Can you describe a recent experience that ' +
  'made you happy?)';

group('The question that overran the card', () => {
  const s = splitQuestion(REAL);
  check('the main wording is what the examiner asks',
    s.main === 'Tell me about a recent event that made you feel happy.',
    JSON.stringify(s.main));
  check('both alternatives are kept', s.alts.length === 2, JSON.stringify(s.alts));
  check('the alternatives lose the brackets and the slash',
    s.alts.every(a => !/[()/]/.test(a)), JSON.stringify(s.alts));
  check('nothing is thrown away',
    s.alts[1] === 'Can you describe a recent experience that made you happy?',
    JSON.stringify(s.alts[1]));
  check('the voice reads one wording, not three',
    spokenForm(REAL).length < REAL.length / 2,
    `${spokenForm(REAL).length} of ${REAL.length} chars`);
});

group('Questions that must not be cut', () => {
  const plain = 'What are her hobbies?';
  check('no brackets, nothing happens',
    splitQuestion(plain).main === plain && splitQuestion(plain).alts.length === 0);

  const aside = 'Can you tell me about your family (in English)?';
  check('a short aside stays part of the sentence',
    splitQuestion(aside).main === aside && splitQuestion(aside).alts.length === 0,
    JSON.stringify(splitQuestion(aside)));

  const mid = 'Do you use public transport (buses, trains) every day?';
  check('a bracket in the middle is left alone',
    splitQuestion(mid).main === mid && splitQuestion(mid).alts.length === 0,
    JSON.stringify(splitQuestion(mid)));

  const allBracketed = '(What do you do at the weekend?)';
  check('a question that is entirely bracketed is still the question',
    splitQuestion(allBracketed).main === allBracketed,
    JSON.stringify(splitQuestion(allBracketed)));
});

group('Shapes the material actually uses', () => {
  const cn = '你周末做什么？（你周末一般干点什么？／周末怎么安排？）';
  const s = splitQuestion(cn);
  check('full-width brackets and slash work', s.alts.length === 2, JSON.stringify(s));

  const one = 'Tell me about your house. (Could you describe the place you live in?)';
  check('a single long alternative is still an alternative',
    splitQuestion(one).alts.length === 1, JSON.stringify(splitQuestion(one)));

  check('empty input does not throw',
    splitQuestion('').main === '' && splitQuestion('').alts.length === 0);
});

group('The type shrinks as the question grows', () => {
  const sizes = [
    splitQuestion('What are her hobbies?'),
    splitQuestion(REAL),
  ].map(s => parseFloat(questionSize(s.main, s.alts.length)));
  check('a long question is set smaller than a short one', sizes[1] < sizes[0],
    `short ${sizes[0]}rem vs long ${sizes[1]}rem`);
  check('never smaller than 1rem', sizes.every(v => v >= 1), JSON.stringify(sizes));
  check('never larger than 1.6rem', sizes.every(v => v <= 1.6), JSON.stringify(sizes));
});

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
