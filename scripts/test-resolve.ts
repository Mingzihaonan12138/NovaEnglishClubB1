/**
 * Rules about who may see whose material.
 *
 * Two leaks reached production before this existed: a hardcoded topic list
 * rendered to every visitor, and the library's Part 1 templates handed to every
 * student as if they were their own. Both were found by the teacher, in
 * production, with a test account. Run with: npm test
 */
import { resolveQuestions, isShowingSample, ResolveInput } from '../src/lib/resolveQuestions';

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

// Anna's own Part 1: her life.
const annaTopics = [
  { topicName: 'My daughter', questions: [
    { id: 'a1', question: 'What are her hobbies?', suggestedAnswer: 'Shopping.' },
  ]},
  { topicName: 'My English Learning', questions: [] }, // created, no questions yet
];

// The library. Its Part 1 half is teacher-side template material.
const library = [
  { topicName: 'My daughter', section: 'Part 1' as const, questions: [
    { id: 'lib1', question: 'What are her hobbies?', suggestedAnswer: "The FIRST student's answer." },
  ]},
  { topicName: 'My cats', section: 'Part 1' as const, questions: [
    { id: 'lib2', question: 'What are your cats like?', suggestedAnswer: 'Oreal is shy.' },
  ]},
  { topicName: 'Music', section: 'Part 2' as const, questions: [
    { id: 'm1', question: 'What music do you like?', suggestedAnswer: "The FIRST student's answer." },
  ]},
];

const base: ResolveInput = {
  userTopics: annaTopics,
  globalTopics: library,
  userConversations: [],
};

group('Part 1 belongs to one student only', () => {
  const out = resolveQuestions(base);
  const topics = [...new Set(out.filter(q => q.section === 'Part 1').map(q => q.topic))];

  check('the library\'s Part 1 templates never reach a student',
    !topics.includes('My cats'), `saw: ${topics.join(', ')}`);
  check('only the student\'s own topics appear',
    topics.length === 1 && topics[0] === 'My daughter', `saw: ${topics.join(', ')}`);
  check('a topic with no questions yields no questions',
    !out.some(q => q.topic === 'My English Learning'));
  check('the student\'s own answer is kept',
    out.find(q => q.topic === 'My daughter')?.suggestedAnswer === 'Shopping.');
});

group('One student never sees another\'s Part 1', () => {
  const ben = resolveQuestions({ ...base, userTopics: [
    { topicName: 'My job', questions: [{ id: 'b1', question: 'What do you do?', suggestedAnswer: "I'm a nurse." }] },
  ]});
  const text = JSON.stringify(ben);
  check('Anna\'s topics are absent from Ben\'s list', !text.includes('My daughter'));
  check('Anna\'s answers are absent from Ben\'s list', !text.includes('Shopping.'));
  check('Ben sees his own topic', ben.some(q => q.topic === 'My job'));
});

group('Part 2 shares the question, never the answer', () => {
  const out = resolveQuestions(base);
  const music = out.find(q => q.topic === 'Music');

  check('the shared question comes through', music?.question === 'What music do you like?');
  check('with no personal answer the field is empty, not the library\'s',
    music?.suggestedAnswer === '', `saw: ${JSON.stringify(music?.suggestedAnswer)}`);

  const withAnswer = resolveQuestions({ ...base, userConversations: [
    { topicName: 'Music', answers: { m1: 'I like Cantonese music.' } },
  ]});
  check('the student\'s own answer is used when present',
    withAnswer.find(q => q.topic === 'Music')?.suggestedAnswer === 'I like Cantonese music.');

  const reworded = resolveQuestions({ ...base, userConversations: [
    { topicName: 'Music', questions: { m1: 'Which music do you enjoy?' } },
  ]});
  check('the teacher may reword the question for one student',
    reworded.find(q => q.topic === 'Music')?.question === 'Which music do you enjoy?');
});

group('The bundled sample is for the teacher alone', () => {
  const sample = [
    { id: 's1', topic: 'My daughter', question: 'Q', suggestedAnswer: 'A', audioUrl: '' },
    { id: 's2', topic: 'Music', question: 'Q2', suggestedAnswer: 'A2', audioUrl: '' },
  ];
  const empty = { userTopics: [], globalTopics: [], userConversations: [], sample, samplePart1Topics: ['My daughter'] };

  const student = resolveQuestions({ ...empty, isAdmin: false });
  check('a student with no content sees nothing at all', student.length === 0,
    `saw ${student.length}`);

  const teacher = resolveQuestions({ ...empty, isAdmin: true });
  check('the teacher sees the sample', teacher.length === 2);
  check('the sample is split into the two exam parts',
    teacher.find(q => q.topic === 'My daughter')?.section === 'Part 1' &&
    teacher.find(q => q.topic === 'Music')?.section === 'Part 2');
  check('isShowingSample agrees', isShowingSample({ ...empty, isAdmin: true }) === true);

  const teacherWithContent = resolveQuestions({ ...base, isAdmin: true });
  check('the sample stays hidden once real content exists',
    !teacherWithContent.some(q => q.id.startsWith('s')));
});

group('Duplicates collapse', () => {
  const out = resolveQuestions({
    ...base,
    globalTopics: [
      ...library,
      { topicName: 'Music', section: 'Part 2' as const, questions: [
        { id: 'm2', question: 'What music do you like? (Which genres?)', suggestedAnswer: '' },
      ]},
    ],
  });
  check('the same question asked twice appears once',
    out.filter(q => q.topic === 'Music').length === 1);
});

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
