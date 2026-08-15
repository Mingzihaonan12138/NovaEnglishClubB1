/**
 * A bench for looking at the crate on its own.
 *
 * The real deck is behind a Google sign-in, which makes the one thing that has
 * to be judged by eye — the geometry of the row — the one thing that cannot be
 * looked at while working on it. This mounts PracticeDeck with fake cards and
 * nothing else. It is a development page and is not part of the build the
 * students get; it is deleted before the branch is pushed.
 */
import { createRoot } from 'react-dom/client';
import PracticeDeck from './components/PracticeDeck';
import DeckStack from './components/DeckStack';
import type { QuestionAnswer } from './constants';
import './index.css';

const questions: QuestionAnswer[] = Array.from({ length: 16 }, (_, i) => ({
  id: `q${i}`,
  topic: 'Family activities',
  question: `Question number ${i + 1} about what your family does together.`,
  suggestedAnswer: 'We usually go to the park on Sundays.',
  audioUrl: '',
  section: 'Part 1',
}));

const COLOURS = [
  '#e5bb40', '#445da3', '#d4673a', '#88aec9', '#7a7c2e', '#efa0b3',
  '#6e86a8', '#c9cf92', '#221e1a', '#2c3d6e', '#a8791f',
];

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-page p-10">
    {/* Same grid classes as the real choosing screen, so what is measured here
        is what the student gets. Keep the two in step. */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-12 gap-y-12 max-w-4xl mx-auto mb-16">
      {COLOURS.map((c, i) => (
        <div key={c} style={{ display: 'contents' }}>
          <DeckStack topic={`Deck ${i + 1}`} colour={c} total={10} fresh={i === 3 ? 0 : 10} onOpen={() => {}} />
        </div>
      ))}
    </div>
    <PracticeDeck
      deckName="Family activities"
      deckColor="#445da3"
      questions={questions}
      cardState={{}}
      onToggleMark={() => {}}
      onSpeak={() => {}}
      onExit={() => {}}
      isRecording={false}
      recordingTime={0}
      isSaving={false}
      onStartRecording={() => {}}
      onStopRecording={() => {}}
      canSubmit
    />
  </div>
);
