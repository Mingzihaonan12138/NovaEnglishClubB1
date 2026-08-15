/**
 * What the bulk-paste box must make of a real document.
 *
 * The first version cut the text at blank lines. The teacher's own prep files
 * are numbered lists with no blank lines in them, so a sixteen-question paste
 * imported as one question whose answer was the other fifteen — and the only
 * sign of it was the counter saying "认出 1 题". Run with: npm test
 */
import { parsePastedQuestions } from '../src/lib/parsePaste';

let failures = 0;
let checks = 0;

function check(name: string, pass: boolean, detail = '') {
  checks++;
  if (pass) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

function group(title: string, fn: () => void) {
  console.log(`\n${title}`);
  fn();
}

/** Copied from the teacher's paste, exactly as it was pasted. */
const REAL = `1. How long have you studied English?
I have studied English for two years. I started after I came to the UK.
2. When did you start learning English?
I started learning English two years ago. At first, it was quite difficult for me.
3. Why are you learning English?
I am learning English because I live in the UK. I want to talk to people and do more things by myself.
4. How do you learn English?
I usually study English at home. I watch English videos and write new words in a notebook. I also practise speaking with my husband.
5. How often do you study English?
I study English four or five times a week. I usually study for thirty minutes.`;

group('A numbered list with no blank lines', () => {
  const out = parsePastedQuestions(REAL);
  check('every question is found', out.length === 5, `got ${out.length}`);
  check('the numbering is stripped',
    out[0].question === 'How long have you studied English?',
    JSON.stringify(out[0].question));
  check('the answer is the answer, not the rest of the paste',
    out[0].answer === 'I have studied English for two years. I started after I came to the UK.',
    JSON.stringify(out[0].answer));
  check('no question text leaks into an answer',
    out.every(p => !p.answer.includes('?')),
    JSON.stringify(out.map(p => p.answer).find(a => a.includes('?')) || ''));
  check('a multi-sentence answer stays whole',
    out[3].answer.startsWith('I usually study English at home.') && out[3].answer.endsWith('with my husband.'),
    JSON.stringify(out[3].answer));
  check('the last item is not dropped', out[4].question === 'How often do you study English?');
});

group('Blank lines still work', () => {
  const out = parsePastedQuestions(
    'What do you do?\nI am a nurse.\n\nWhere do you work?\nAt Bolton Hospital.');
  check('two questions', out.length === 2, `got ${out.length}`);
  check('answers attach to their own question',
    out[0].answer === 'I am a nurse.' && out[1].answer === 'At Bolton Hospital.');
});

group('The pipe form still works', () => {
  const out = parsePastedQuestions(
    "What do you do? | I'm a nurse.\nWhere do you work? | At Bolton Hospital.");
  check('two questions', out.length === 2, `got ${out.length}`);
  check('split at the pipe', out[0].question === 'What do you do?' && out[0].answer === "I'm a nurse.");
});

group('Question and answer on one line', () => {
  const out = parsePastedQuestions(
    '1. What do you do? I am a nurse.\n2. Where do you work? At Bolton Hospital.');
  check('two questions', out.length === 2, `got ${out.length}`);
  check('cut at the question mark',
    out[0].question === 'What do you do?' && out[0].answer === 'I am a nurse.',
    JSON.stringify(out[0]));
});

group('Questions with no answers yet', () => {
  const out = parsePastedQuestions(
    '1. What do you do?\n2. Where do you work?\n3. Do you like it?');
  check('all three', out.length === 3, `got ${out.length}`);
  check('answers are empty, not borrowed from the next question',
    out.every(p => p.answer === ''), JSON.stringify(out));
});

group('Numbering the teacher might actually type', () => {
  const out = parsePastedQuestions(
    '1、你叫什么？\n答案一。\n(2) Second question?\nAnswer two.\nQ3: Third question?\nAnswer three.\n- Fourth question?\nAnswer four.');
  check('all four markers recognised', out.length === 4, JSON.stringify(out.map(p => p.question)));
  check('markers stripped from every one',
    out.every(p => !/^\s*[(（]?\s*[Qq]?\s*\d/.test(p.question) && !p.question.startsWith('-')),
    JSON.stringify(out.map(p => p.question)));
});

group('Degenerate input', () => {
  check('empty text gives nothing', parsePastedQuestions('').length === 0);
  check('whitespace gives nothing', parsePastedQuestions('  \n \n ').length === 0);
  check('exported JSON still loads',
    parsePastedQuestions('[{"question":"A?","suggestedAnswer":"B."}]')[0].answer === 'B.');
});

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
