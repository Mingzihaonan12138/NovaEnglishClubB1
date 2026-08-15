import { CardBack } from './PracticeDeck';

/**
 * A deck on the shelf, before it is opened.
 *
 * The choosing screen used to be a grid of landscape colour blocks with the
 * topic printed on them. Nothing about that said "cards", so opening one and
 * landing in a crate of them was a jump: the thing you clicked and the thing
 * you got were different objects. A deck here is now the same printed back the
 * crate deals, in the same colour, stacked — click a stack, the stack fans out.
 *
 * The title sits under the card rather than on it, for the same reason it is
 * not on the cards in the crate: a card back is a printed pattern, and once it
 * starts carrying text it stops reading as the back of anything.
 */
export default function DeckStack({
  topic, colour, total, fresh, onOpen,
}: {
  topic: string;
  colour: string;
  total: number;
  fresh: number;
  onOpen: () => void;
}) {
  const done = fresh === 0;

  return (
    <button
      onClick={onOpen}
      className="group text-center flex flex-col items-center gap-2.5 focus:outline-none"
      aria-label={`打开 ${topic}，${total} 张`}
    >
      <div
        className="relative w-full aspect-[3/4.1] transition-transform duration-200 group-hover:-translate-y-1"
        style={{ opacity: done ? 0.55 : 1 }}
      >
        {/*
          Two cards showing under the top one. They are the stack: without them
          this is a single card, and the count underneath has to do all the work
          of saying there are twenty more behind it. They lean apart a little on
          hover, which is the same gesture the crate makes.

          The angles are small on purpose. Rotation here is about the bottom
          edge, so the lever arm is the whole height of the card and every
          degree costs about 4px of horizontal reach at the top corners — which
          is spent outside the grid column, on the neighbouring stack. Five
          degrees was enough to make the row collide with itself.
        */}
        <div
          className="absolute inset-0 origin-bottom transition-transform duration-200 -rotate-[4deg] group-hover:-rotate-[6deg]"
          style={{ filter: 'brightness(0.82) saturate(0.9)' }}
        >
          <CardBack color={colour} radius="0.9rem" />
        </div>
        <div
          className="absolute inset-0 origin-bottom transition-transform duration-200 rotate-[2.5deg] group-hover:rotate-[4deg]"
          style={{ filter: 'brightness(0.9) saturate(0.95)' }}
        >
          <CardBack color={colour} radius="0.9rem" />
        </div>
        <div
          className="absolute inset-0 rounded-[0.9rem]"
          style={{ boxShadow: '0 10px 24px rgba(34,30,26,.20)' }}
        >
          <CardBack color={colour} radius="0.9rem" />
        </div>
      </div>

      <div className="px-1">
        <p className="font-semibold text-sm leading-tight text-ink group-hover:underline decoration-1 underline-offset-4">
          {topic}
        </p>
        <p className="text-[11px] text-muted mt-0.5">
          {total} 张{done ? ' · 全练过了' : ` · 没练过 ${fresh}`}
        </p>
      </div>
    </button>
  );
}
