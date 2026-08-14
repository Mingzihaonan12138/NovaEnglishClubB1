import { QuestionAnswer } from '../constants';

/**
 * Works out which questions a signed-in person is allowed to see.
 *
 * This lives on its own, away from the component and away from Firebase,
 * because it is the thing that decides who sees whose material. Two leaks
 * reached production while this logic sat inline with no way to test it: a
 * hardcoded topic list rendered to everyone, and the library's Part 1
 * templates handed to every student. The rules below are covered by
 * scripts/test-resolve.ts.
 *
 * The exam has two halves and they are sourced differently:
 *
 *   Part 1  topics the candidate chose with their teacher. Somebody's actual
 *           life, so they come only from that person's own userTopics.
 *
 *   Part 2  the fixed Trinity subject areas. Questions are the same for
 *           everyone and come from the shared library; the answer is personal
 *           and comes only from that person's userConversations. With no
 *           personal answer we return none, because the library's answers
 *           belong to whoever the material was first written for.
 */

export interface TopicSource {
  topicName: string;
  questions: { id: string; question: string; suggestedAnswer: string }[];
}

export interface LibraryTopic extends TopicSource {
  section?: 'Part 1' | 'Part 2';
}

export interface ConversationSource {
  topicName: string;
  answers?: Record<string, string>;
  questions?: Record<string, string>;
}

export interface ResolveInput {
  /** The signed-in student's own Part 1 topics. */
  userTopics: TopicSource[];
  /** The shared library. Only its Part 2 half is student-facing. */
  globalTopics: LibraryTopic[];
  /** The signed-in student's own Part 2 answers. */
  userConversations: ConversationSource[];
  /** Bundled demo material, shown to the teacher when nothing is set up yet. */
  sample?: QuestionAnswer[];
  /** Which of the sample's topics belong to Part 1. */
  samplePart1Topics?: string[];
  isAdmin?: boolean;
}

const audioFor = (id: string) => `/audio/${id}.wav`;

export function resolveQuestions(input: ResolveInput): QuestionAnswer[] {
  const {
    userTopics, globalTopics, userConversations,
    sample = [], samplePart1Topics = [], isAdmin = false,
  } = input;

  // Part 1 — strictly this student's own.
  const part1: QuestionAnswer[] = [];
  userTopics.forEach(t => {
    t.questions.forEach(q => {
      part1.push({
        ...q,
        topic: t.topicName,
        section: 'Part 1',
        audioUrl: audioFor(q.id),
      });
    });
  });

  // Part 2 — shared questions, personal answers. The library's Part 1 entries
  // are teacher-side templates and must never appear here.
  const part2: QuestionAnswer[] = [];
  const seen = new Set<string>();
  globalTopics
    .filter(gt => (gt.section || 'Part 2') === 'Part 2')
    .forEach(gt => {
      const key = gt.topicName.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const conv = userConversations.find(c => c.topicName === gt.topicName);
      gt.questions.forEach(q => {
        part2.push({
          ...q,
          topic: gt.topicName,
          section: 'Part 2',
          question: conv?.questions?.[q.id] || q.question,
          suggestedAnswer: conv?.answers?.[q.id] || '',
          audioUrl: audioFor(q.id),
        });
      });
    });

  // With nothing set up the teacher would face an empty app. Students never
  // reach this branch, whatever state their account is in.
  const usingSample = part1.length === 0 && part2.length === 0 && isAdmin;
  const p1Names = new Set(samplePart1Topics.map(t => t.trim().toLowerCase()));
  const combined: QuestionAnswer[] = usingSample
    ? sample.map(q => ({
        ...q,
        section: p1Names.has(q.topic.trim().toLowerCase()) ? 'Part 1' : 'Part 2',
      }))
    : [...part1, ...part2];

  // Collapse questions that read identically once the bracketed rephrasings are
  // dropped, so "Next" never appears to repeat itself.
  const unique = new Map<string, QuestionAnswer>();
  combined.forEach(q => {
    const bracket = q.question.indexOf('(');
    const clean = (bracket !== -1 ? q.question.slice(0, bracket) : q.question).trim();
    const key = `${q.topic.toLowerCase()}_${clean.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, q);
  });
  return Array.from(unique.values());
}

/** True when the teacher is looking at bundled demo material, not real content. */
export function isShowingSample(input: ResolveInput): boolean {
  return !!input.isAdmin
    && input.userTopics.length === 0
    && input.globalTopics.filter(gt => (gt.section || 'Part 2') === 'Part 2').length === 0;
}
