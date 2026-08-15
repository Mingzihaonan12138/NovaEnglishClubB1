import { CardBack } from './PracticeDeck';
import { STACK_CARD } from '../lib/card';

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
      {/* Same proportion and same corner as the card in the crate and the card
          you answer on — see src/lib/card.ts. This one's width comes from the
          grid, so only the ratio and the radius can be stated here. */}
      <div
        className="relative w-full aspect-[1/1.4] transition-transform duration-200 group-hover:-translate-y-1"
        style={{ opacity: done ? 0.55 : 1 }}
      >
        {/*
          Two cards showing under the top one. They are the stack: without them
          this is a single card, and the count underneath has to do all the work
          of saying there are twenty more behind it. They lean apart a little on
          hover, which is the same gesture the crate makes.

          They turn about their middles, not their bottom edges, and that is
          what buys the angle. Rotating about the bottom makes the lever arm the
          whole height of the card, so each degree throws the top corners about
          4px sideways — out of the grid column and into the neighbouring stack
          — and the fan had to be cut to four degrees to stop the row colliding
          with itself, by which point it was too small to see. About the middle
          the arm is half as long, so eight degrees costs the same 16px of reach
          as four did. Twice the fan, same footprint.
        */}
        <div
          className="absolute inset-0 origin-center transition-transform duration-200 -rotate-[8deg] group-hover:-rotate-[12deg]"
          style={{ filter: 'brightness(0.82) saturate(0.9)' }}
        >
          <CardBack color={colour} radius={STACK_CARD.radius} />
        </div>
        <div
          className="absolute inset-0 origin-center transition-transform duration-200 rotate-[5deg] group-hover:rotate-[8deg]"
          style={{ filter: 'brightness(0.9) saturate(0.95)' }}
        >
          <CardBack color={colour} radius={STACK_CARD.radius} />
        </div>
        <div
          className="absolute inset-0"
          style={{ borderRadius: STACK_CARD.radius, boxShadow: '0 10px 24px rgba(34,30,26,.20)' }}
        >
          <CardBack color={colour} radius={STACK_CARD.radius} />
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
