import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring, useTransform } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { Volume2, X, Mic, Square, Bookmark, Loader2, ChevronRight } from 'lucide-react';
import { QuestionAnswer } from '../constants';
import { stopSpeaking } from '../lib/tts';
import { StarMascot } from './Mascot';

export interface DeckCardState {
  /** ms timestamp of the student's most recent recording, if any */
  lastPractisedAt?: number;
  marked?: boolean;
  keywords?: string;
  feedback?: string;
  feedbackDate?: string;
}

interface PracticeDeckProps {
  deckName: string;
  deckColor: string;
  questions: QuestionAnswer[];
  cardState: Record<string, DeckCardState>;
  onToggleMark: (q: QuestionAnswer) => void;
  onSpeak: (q: QuestionAnswer) => void;
  onExit: () => void;
  isRecording: boolean;
  recordingTime: number;
  isSaving: boolean;
  onStartRecording: (q: QuestionAnswer) => void;
  onStopRecording: () => void;
  /** Anyone may practise; only enrolled students may send work to the teacher. */
  canSubmit: boolean;
}

/**
 * The printed back of a card, used both by the cards in the row and by the one
 * that has been drawn, so they are visibly the same object.
 *
 * A flat rectangle with a hairline was not reading as a card: a card back is a
 * printed thing, and printing is what tells you it is a card rather than a
 * coloured shape. The star is large enough to survive being seen almost
 * edge-on, and the double rule gives the eye an edge to catch at any angle.
 */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const INK = '#221e1a';

function toHsl(hex: string): { h: number; s: number; l: number } {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) :
    max === g ? ((b - r) / d + 2) :
                ((r - g) / d + 4);
  return { h: h * 60, s, l };
}

function toHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(((h % 360) + 360) % 360 / 60);
  const [r, g, b] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][seg];
  return '#' + [r, g, b]
    .map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Which colour the star prints in on a given card: the card's complement.
 *
 * Hue alone is not enough, and this is the whole difficulty of the rule. Two
 * complementary colours of the same lightness have almost no contrast against
 * each other — a mid blue and a mid orange sit at 1.1:1 — so a star placed on
 * its card's exact opposite would be a perfectly correct complement that nobody
 * could see. The hue is taken from across the wheel; the lightness is then
 * driven the other way from the card's own until the mark actually reads, and
 * the saturation is held up so what arrives is a colour rather than a grey.
 *
 * 3.2:1 is the floor. This is a large solid shape, not body text, so it does
 * not owe 4.5:1 — but it does have to survive being seen almost edge-on at the
 * far end of the row.
 */
function starInk(bg: string): string {
  const { h, s, l } = toHsl(bg);
  const hue = (h + 180) % 360;
  // Floored well up. The complement inherits the card's saturation, and the
  // quieter cards — the slates, the mist blue — handed back a mark at 0.24 that
  // had the right hue and looked like mud. A complement should be legible as a
  // colour, not merely be one on paper.
  const sat = Math.min(Math.max(s, 0.62), 0.85);
  const dark = l > 0.5;                 // light card wants a dark mark
  let lum = dark ? 0.26 : 0.78;
  for (let i = 0; i < 14; i++) {
    const ink = toHex(hue, sat, lum);
    if (contrast(bg, ink) >= 3.2) return ink;
    lum += dark ? -0.03 : 0.03;
  }
  return toHex(hue, sat, dark ? 0.1 : 0.95);
}

function isLight(hex: string): boolean {
  return luminance(hex) > 0.33;
}

export function CardBack({ color, radius = '1.1rem', followPointer = false }: { color: string; radius?: string; followPointer?: boolean }) {
  // The gold deck is the same colour as the star, so a gold star on it would be
  // an invisible mark on a blank rectangle. Light cards print in ink instead.
  const light = isLight(color);
  const rule = light ? 'border-black/20' : 'border-white/25';
  const ruleFaint = light ? 'border-black/10' : 'border-white/12';
  const dot = light ? 'bg-black/20' : 'bg-white/30';
  const star = starInk(color);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: color, borderRadius: radius }}>
      {/* Printed frame */}
      <div className={`absolute inset-[6%] rounded-[0.75rem] border ${rule} pointer-events-none`} />
      <div className={`absolute inset-[9%] rounded-[0.6rem] border ${ruleFaint} pointer-events-none`} />

      {/* The mark, big enough to read foreshortened. The ring that used to circle
          it was a mistake at these angles: a circle compressed to a tenth of its
          width stops reading as a foreshortened circle and starts reading as an
          oval that was drawn that way, which fought the turn instead of showing
          it. The frame and the corner marks carry the print on their own.

          The square wrapper is load-bearing. Sizing the star w-[47%] h-[47%]
          takes 47% of the card's width and 47% of its height, and the card is
          not square, so the star came out stretched a third taller than it is
          drawn. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[47%] aspect-square flex items-center justify-center">
          <StarMascot className="w-full h-full drop-shadow-sm" followPointer={followPointer} fill={star} />
        </div>
      </div>

      {/* Corner marks, so the print continues to the edges rather than floating */}
      {['top-[7%] left-[7%]', 'top-[7%] right-[7%]', 'bottom-[7%] left-[7%]', 'bottom-[7%] right-[7%]'].map(pos => (
        <span key={pos} className={`absolute ${pos} w-1.5 h-1.5 rounded-full ${dot} pointer-events-none`} />
      ))}

      {/*
        The face is flat colour. A raking gradient across it was tried, to say
        which edge was the near one, and it read as a gradient rather than as
        light — this is printed card, and print does not have a sheen. The
        depth is carried by the geometry and by the paper edge below instead,
        which is where it belongs.
      */}
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: radius, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.22)' }} />
    </div>
  );
}

/**
 * How thick a card is, in px.
 *
 * At 7 this was a slab: seen at 64° the edge is the one surface facing the
 * viewer squarely, so it is magnified where the face is compressed, and a thick
 * bright one looked like board glued to the back rather than the edge of a
 * card. 3 is enough to exist.
 */
const THICK = 3;

/**
 * The cut edge of the paper.
 *
 * Half of why the reference deck reads as a stack of physical objects is that
 * its cards are solids: you see the edge of every one. A plane has no thickness
 * at any angle, so however well it is lit it stays a coloured rectangle. This
 * is a real face standing at ninety degrees to the front of the card, hinged on
 * the right-hand edge — the near one — and running backwards away from the
 * viewer, which is where the body of the card actually is.
 *
 * Flat and off-white, not white and not shaded: it should read as the cut edge
 * of a stack of paper and then be forgotten about.
 */
function CardEdge() {
  return (
    <div
      aria-hidden
      className="absolute top-[1.5%] bottom-[1.5%] right-0 pointer-events-none"
      style={{
        width: THICK,
        transformOrigin: 'right center',
        transform: 'rotateY(-90deg)',
        background: '#efe6da',
      }}
    />
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The crate: every card stood on its edge and leaning the same way, as records
 * lean in a box. Moving across the strip walks the row; the card under the
 * cursor rises out of it, and only the card actually being taken turns to face
 * you, arriving flat just as it becomes the question.
 *
 * The student picks rather than being dealt to, so weighting moved onto the
 * cards: never-practised ones keep the deck's full colour while cards taken this
 * session sink back and desaturate in the order they were taken. The pull toward
 * the right card is visible instead of hidden in a probability.
 */
/**
 * The row is an arc, not a line.
 *
 * Every card used to sit at the same angle, and the card in focus is always
 * drawn dead centre — which is where the vanishing point is. A rotation at the
 * vanishing point produces no perspective at all: the card is scaled to
 * cos(angle) of its width and nothing else happens to it. So it read as a
 * rectangle that had been squashed rather than one that had been turned, and
 * the two cues cancelled out.
 *
 * The cards now lie tangent to a circle, the way the reference deck does. Each
 * one is RADIUS away from a centre behind the row and ARC degrees round from
 * its neighbour, so no two share an angle: the row opens up at one end and
 * closes toward the other, which is the curve itself becoming visible. They
 * still all lean the same way — this is one continuous arc, not two halves
 * turned to face each other, which is what looked wrong before.
 */
const TURN = 64;      // the lean the card at the focus sits at
/**
 * How much of the circle separates two neighbours.
 *
 * This is easy to overspend, and the reason is not the rotation itself. A card
 * turned this far has its two vertical edges about 240px apart in depth, so at
 * the ends of the row — where the card is also well off the eye's axis — one
 * edge is magnified and the other shrunk, and the projected widths spread far
 * faster than the cosine of the angle suggests. At 2.6° over a ten-card row the
 * widest card measured 3.9 times the narrowest and the end of the row was
 * effectively facing front, when the point is that none of them face you. At 1°
 * the spread is 2.3 and the widest card is still only 60% of its full width:
 * unmistakably a curve, still unmistakably edge-on.
 */
const ARC = 1.0;
const RADIUS = 3400;  // px; with ARC this leaves ~59px of each card in view
const LIFT = 70;      // how far the card under the cursor rises out of the row
/**
 * Cards near the cursor ease apart a little. This used to be large enough to
 * hollow out the row, leaving the raised card hovering in a void between two
 * piles rather than standing in the slot it came from. A crate is dense: the
 * cards hide one another, and what marks one out is that it is lifted, not that
 * the deck has opened around it.
 */
const PART = 12;
const RAD = Math.PI / 180;

function CardCrate({
  questions, cardState, order, deckColor, onPick,
}: {
  questions: QuestionAnswer[];
  cardState: Record<string, DeckCardState>;
  order: string[];
  deckColor: string;
  onPick: (q: QuestionAnswer) => void;
}) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const raw = useMotionValue((questions.length - 1) / 2);
  const focus = useSpring(raw, { stiffness: 210, damping: 30, mass: 0.5 });
  const [centre, setCentre] = useState(Math.round((questions.length - 1) / 2));
  /** The card on its way up and out; the row waits for it before switching. */
  const [rising, setRising] = useState<string | null>(null);

  useEffect(() => {
    const unsub = focus.on('change', v => setCentre(Math.round(v)));
    return () => unsub();
  }, [focus]);

  const track = (clientX: number) => {
    if (rising) return;
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    raw.set(t * (questions.length - 1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rising) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = Math.min(Math.max(centre + (e.key === 'ArrowRight' ? 1 : -1), 0), questions.length - 1);
        raw.set(next);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const q = questions[centre];
        if (q) take(q);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const take = (q: QuestionAnswer) => {
    if (rising) return;
    if (reduce) return onPick(q);
    // Lifted clear of the row first, so the card is seen leaving the deck
    // rather than the deck simply being replaced.
    setRising(q.id);
    setTimeout(() => { setRising(null); onPick(q); }, 300);
  };

  return (
    <div className="w-full">
      {/*
        The whole strip is the control, not the individual cards.
        Which card is in focus comes from where the pointer is horizontally, but
        that card is always drawn in the middle, so the pointer was almost never
        over it: clicking landed on empty space or on some other card. Moving
        browses, clicking takes whatever is currently raised, wherever the
        pointer happens to be.
      */}
      <div
        ref={wrap}
        onPointerMove={(e) => track(e.clientX)}
        onPointerDown={(e) => track(e.clientX)}
        onClick={() => { const q = questions[centre]; if (q) take(q); }}
        role="button"
        aria-label={`抽出第 ${centre + 1} 张，共 ${questions.length} 张`}
        className="relative h-[30rem] w-full cursor-pointer touch-pan-y"
        /*
          The eye sits above the deck, looking down into it the way you look
          into a crate of records — and squarely in front of it horizontally.

          Both halves of that matter. Dropping the eye is what supplies the
          perspective: with the vanishing point at dead centre the focused card
          sat exactly on it, and an element on the vanishing point gets no
          perspective division at all — its edges stay parallel however far it
          is turned, which is why a card at 66° read as a rectangle that had
          been squashed rather than one that had been turned. Off the axis
          vertically, its top and bottom edges converge, and it is seen at an
          angle.

          Moving the eye sideways as well was tried and abandoned. Horizontal
          offset makes perspective swing a card's face toward you in proportion
          to how far along the row it is, and that term is linear and large: it
          took the widest card to 3.9 times the narrowest and left the end of
          the row facing front, when the whole point is that none of them face
          you. Centred horizontally, that swing is symmetric and small, and the
          arc is left to supply the variation on its own.
        */
        style={{ perspective: 2400, perspectiveOrigin: '50% 30%' }}
      >
        {/* Something to stand on. The row was floating in an empty page, which
            is most of why it looked unfinished: a lit patch of table and a
            contact shadow under the cards give the deck somewhere to be. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(60% 44% at 50% 58%, rgba(34,30,26,.07) 0%, rgba(34,30,26,0) 70%)',
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: '4.5rem', width: '30rem', height: '3.5rem', borderRadius: '50%',
            background: 'radial-gradient(50% 50% at 50% 50%, rgba(34,30,26,.22) 0%, rgba(34,30,26,0) 72%)',
            filter: 'blur(6px)',
          }}
        />
        {questions.map((q, i) => {
          const st = cardState[q.id];
          const done = order.indexOf(q.id);
          const fresh = !st?.lastPractisedAt && done === -1;
          // Cards taken earlier this session sit furthest back.
          const age = done === -1 ? 0 : (order.length - done) / order.length;

          return (
            <div key={q.id} style={{ display: 'contents' }}>
              <CrateCard
                index={i}
                focus={focus}
                deckColor={deckColor}
                isCentre={i === centre}
                isRising={rising === q.id}
                dimmed={!!rising && rising !== q.id}
                fresh={fresh}
                marked={!!st?.marked}
                age={age}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mt-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="w-2.5 h-3.5 rounded-[2px]" style={{ background: deckColor }} />
          没练过
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="w-2.5 h-3.5 rounded-[2px] opacity-30" style={{ background: deckColor }} />
          练过的往后退
        </span>
        <span>左右移动鼠标翻牌，点中间那张抽出来</span>
      </div>
    </div>
  );
}

interface CrateCardProps {
  index: number;
  focus: MotionValue<number>;
  deckColor: string;
  isCentre: boolean;
  isRising: boolean;
  dimmed: boolean;
  fresh: boolean;
  marked: boolean;
  age: number;
}

/**
 * One card in the row.
 *
 * All of them lean the same way. Turning the two halves of the row toward each
 * other put two opposing perspectives side by side in the middle, which read as
 * a mistake rather than as depth. Hovering marks a card by raising and
 * brightening it, never by turning it; the turn is reserved for the card being
 * taken, so that movement means one thing only. Colour is the deck's throughout,
 * so the card pulled out is visibly the card that was looked at.
 */
function CrateCard({
  index, focus, deckColor, isCentre, isRising, dimmed, fresh, marked, age,
}: CrateCardProps) {
  const d = useTransform(focus, (f: number) => index - f);
  // Position on the circle. The row parts a little around the cursor on top of
  // that, so one card is legible among cards of a single colour — tanh rather
  // than sign, because sign flips the whole PART term the instant d crosses
  // zero, which threw a card across the centre line in one frame.
  const x = useTransform(d, (v: number) => RADIUS * Math.sin(v * ARC * RAD) + PART * Math.tanh(v / 1.2));
  const z = useTransform(d, (v: number) => RADIUS * (Math.cos(v * ARC * RAD) - 1));
  // Tangent to the circle at that point: the card's own share of the curve.
  const spin = useTransform(d, (v: number) => -TURN + v * ARC);
  // Distant cards go soft, because nothing says "further away" as plainly as
  // being out of focus. Softening began immediately though, so the cards either
  // side of the one in focus — the ones you are about to move onto — were
  // already smeared. Blur now holds off until the second neighbour and tops out
  // at under 2px: enough to give the row depth, not enough to fog it.
  // Depth of field, stopped well down. There should be a focal plane — the row
  // is meant to fall off — but a wide aperture blurs cards the student is about
  // to move onto, and the arc now supplies most of the depth on its own. Three
  // cards either side stay sharp and nothing goes past 0.6px.
  const blur = useTransform(d, (v: number) =>
    `blur(${Math.min(Math.max(Math.abs(v) - 2.6, 0) * 0.3, 0.6)}px)`);
  // Same restraint on the fade: the far end of a ten-card row should recede,
  // not wash out.
  const fade = useTransform(d, (v: number) => Math.max(1 - Math.max(Math.abs(v) - 5, 0) * 0.11, 0.66));

  const lit = isCentre || isRising;

  return (
    /*
      Three layers, because each one has to be allowed to do its job.

      The outer one alone is three-dimensional: it carries the place on the arc,
      the card's share of the curve, and the lift. It deliberately has no filter
      and no opacity, because both of those force a subtree back into 2D — which
      would flatten the paper edge into the face and undo the whole point of it.
      The depth cues and the practised-state cues then sit on plain wrappers
      inside, where flattening costs nothing.
    */
    <motion.div
      className="absolute left-1/2 top-1/2 w-[16rem] h-[22rem] -ml-[8rem] -mt-[11rem]"
      style={{
        x, z, rotateY: spin,
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
        /*
          Painter order runs one way across the whole row, and this is the
          reason it has to.

          Stacking by distance from the focus — highest in the middle, falling
          away to both sides — puts the two halves in opposite orders: left of
          centre each card covers its left-hand neighbour, right of centre each
          card is covered by it. Every card leans the same way, so that is a
          contradiction, and it is visible as a seam running down the middle of
          the deck.

          The order is set by the geometry, not by taste. A card's right-hand
          edge swings about 115px toward the viewer and its left-hand edge the
          same distance away, so where card i overlaps card i+1, card i's
          material is the nearer of the two: the left card is in front. The only
          exception is the card in focus, which is lifted out of the row and is
          meant to be read as being in front of it.
        */
        zIndex: isRising ? 999 : isCentre ? 500 : 400 - index,
      }}
      animate={{
        // The card keeps its lean the whole way up: it is drawn straight out of
        // the queue the way you pull a record from a crate. Turning it flat here
        // made it stop being a card in a row and become a different object
        // mid-animation; the turn belongs to the flip that follows, where it
        // becomes the question.
        y: isRising ? -260 : isCentre ? -LIFT : 0,
        scale: isRising ? 1.04 : isCentre ? 1.05 : 0.94,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <CardEdge />
      <motion.div className="absolute inset-0" style={{ filter: blur, opacity: fade }}>
        <motion.div
          className="absolute inset-0 rounded-[1.1rem]"
          animate={{
            opacity: dimmed ? 0.18 : fresh ? 1 : 1 - age * 0.5,
            // 1.1 against 0.82 was a third of a stop between the card in focus
            // and its neighbours, which is enough to look like a different
            // colour rather than the same card picked out — the exact thing
            // that was wrong when the drawn card changed colour. Marking a card
            // does not need to repaint it.
            filter: `saturate(${fresh ? 1 : 1 - age * 0.7}) brightness(${lit ? 1 : 0.92})`,
            boxShadow: lit ? '0 26px 60px rgba(34,30,26,.32)' : '0 2px 6px rgba(34,30,26,.18)',
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          <CardBack color={deckColor} />
          {marked && (
            <span className="absolute top-[7%] left-[7%] w-2.5 h-2.5 rounded-full bg-gold ring-2 ring-white/40 pointer-events-none" />
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function PracticeDeck({
  deckName, deckColor, questions, cardState,
  onToggleMark, onSpeak, onExit,
  isRecording, recordingTime, isSaving,
  onStartRecording, onStopRecording, canSubmit,
}: PracticeDeckProps) {
  const reduce = useReducedMotion();

  const [current, setCurrent] = useState<QuestionAnswer | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [drawn, setDrawn] = useState(0);
  /** Browsing the crate, as opposed to working on a card already taken. */
  const [picking, setPicking] = useState(true);
  /** Ids in the order they were taken this session, oldest first. */
  const [order, setOrder] = useState<string[]>([]);
  const historyRef = useRef<QuestionAnswer[]>([]);

  const state = current ? cardState[current.id] : undefined;

  // Whatever is being read aloud belongs to the card on screen. Leaving the
  // deck by any route — the exit button, Escape, the browser back gesture —
  // must not leave a voice talking to an empty room.
  useEffect(() => () => { stopSpeaking(); }, []);

  /** Back to the crate so the student chooses the next one themselves. */
  const deal = useCallback(() => {
    stopSpeaking();
    if (current) historyRef.current.push(current);
    setPicking(true);
    setRevealed(false);
    setShowHint(false);
    setShowAnswer(false);
  }, [current]);

  const pick = useCallback((q: QuestionAnswer) => {
    stopSpeaking();
    setCurrent(q);
    setPicking(false);
    setRevealed(false);
    setShowHint(false);
    setShowAnswer(false);
    setDrawn(d => d + 1);
    setOrder(prev => [...prev.filter(id => id !== q.id), q.id]);
  }, []);

  const back = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setCurrent(prev);
    setRevealed(true);
    setShowHint(false);
    setShowAnswer(false);
  }, []);

  const reveal = useCallback(() => {
    if (revealed || !current) return;
    setRevealed(true);
    onSpeak(current);
  }, [revealed, current, onSpeak]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isRecording) return;
      // While browsing the crate the arrows belong to it, for walking the row.
      // Both handlers were live at once, so one press moved the row and left
      // the deck at the same time. Escape still gets out from anywhere.
      if (e.code === 'Escape') { onExit(); return; }
      if (picking) return;
      if (e.code === 'Space') { e.preventDefault(); revealed ? deal() : reveal(); }
      else if (e.code === 'ArrowLeft') back();
      else if (e.code === 'ArrowRight') deal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, deal, reveal, back, onExit, isRecording]);

  const counts = useMemo(() => ({
    fresh: questions.filter(q => !cardState[q.id]?.lastPractisedAt).length,
    marked: questions.filter(q => cardState[q.id]?.marked).length,
  }), [questions, cardState]);

  if (!questions.length) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center">
        <StarMascot className="w-24 h-24 opacity-60" />
        <p className="font-display text-xl">这副牌还是空的</p>
        <p className="text-sm text-muted max-w-xs">老师还没给你加 {deckName} 的题目。</p>
        <button onClick={onExit} className="mt-2 text-sm font-semibold text-blue">返回</button>
      </div>
    );
  }

  const dur = reduce ? 0 : 0.35;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center relative select-none">
      {/*
        Everything that is not the card is deliberately faint and small. Once a
        card is face up the student should have nothing to look at but the
        question and one button.
      */}
      {/* A bare glyph in the corner read as decoration. It is the way out, so
          it says so and has something to aim at. */}
      <button
        onClick={onExit}
        className="absolute top-0 right-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-card text-sm font-semibold text-ink-soft hover:border-ink hover:text-ink transition-colors"
      >
        <X className="w-4 h-4" />
        退出
      </button>

      {!isRecording && (
        <p className="absolute top-1 left-0 text-xs text-muted">
          {deckName} · {picking ? `共 ${questions.length} 张` : `第 ${drawn} 张`}
        </p>
      )}

      {picking && (
        <CardCrate
          questions={questions}
          cardState={cardState}
          order={order}
          deckColor={deckColor}
          onPick={pick}
        />
      )}

      <div className={`relative ${picking ? 'hidden' : ''}`} style={{ perspective: 1200 }}>
        <motion.div
          key={current?.id}
          drag={revealed ? 'x' : false}
          dragSnapToOrigin
          dragElastic={0.14}
          onDragEnd={(_, info) => {
            if (info.offset.x < -90) deal();
            else if (info.offset.x > 90) back();
          }}
          className="w-[19rem] h-[25rem] rounded-[1.6rem] cursor-pointer"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={{ duration: dur, ease: [0.2, 0.7, 0.3, 1] }}
          onClick={reveal}
        >
          {/* back */}
          <div
            className="absolute inset-0 rounded-[1.6rem] overflow-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {/* Same printed back as the cards in the row. Face-down is the one
                moment with nothing to read, so the star watches the pointer
                while you decide. */}
            <CardBack color={deckColor} radius="1.6rem" followPointer />
          </div>

          {/* front */}
          <div
            className="absolute inset-0 rounded-[1.6rem] bg-card border border-line p-7 flex flex-col"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-[11px] tracking-wide text-muted mb-3">{current?.topic}</p>
            <p className="font-display text-[1.6rem] leading-snug">{current?.question}</p>
            {current?.chineseMeaning && (
              <p className="text-xs text-muted mt-2">{current.chineseMeaning}</p>
            )}

            <AnimatePresence>
              {showHint && state?.keywords && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-wrap gap-1.5 mt-4"
                >
                  {state.keywords.split(',').map((k, i) => (
                    <span key={i} className="text-xs bg-sand rounded-lg px-2.5 py-1 text-ink-soft">
                      {k.trim()}
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showAnswer && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm leading-relaxed text-ink-soft mt-4"
                >
                  {current?.suggestedAnswer || '老师还没帮你写这一题的答案。'}
                </motion.p>
              )}
            </AnimatePresence>

            {state?.feedback && (
              <div className="mt-4 bg-gold-soft rounded-xl p-3">
                <p className="text-[10px] text-gold-ink mb-1">老师的反馈</p>
                <p className="text-xs leading-relaxed text-ink">{state.feedback}</p>
              </div>
            )}

            <div className="mt-auto flex items-center gap-3 text-muted">
              <button
                onClick={(e) => { e.stopPropagation(); current && onSpeak(current); }}
                aria-label="再听一遍"
                className="hover:text-ink transition-colors"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); current && onToggleMark(current); }}
                aria-label={state?.marked ? '取消标记' : '标记难点'}
                className={`transition-colors ${state?.marked ? 'text-gold-ink' : 'hover:text-ink'}`}
              >
                <Bookmark className="w-4 h-4" fill={state?.marked ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* One primary action. Nothing competes with it. */}
      {/* min-h rather than a fixed height: the buttons below are taller than
          the grey text they replaced, and a fixed 6rem clipped them. */}
      <div className={`mt-8 min-h-[9rem] flex flex-col items-center gap-3 ${picking ? 'hidden' : ''}`}>
        {!revealed ? (
          <p className="text-sm text-muted">点一下翻开</p>
        ) : isRecording ? (
          <>
            <button
              onClick={onStopRecording}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-ink text-page font-semibold"
            >
              <Square className="w-4 h-4" fill="currentColor" />
              停止 <span className="tabular">{fmt(recordingTime)}</span>
            </button>
          </>
        ) : isSaving ? (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> 正在保存
          </span>
        ) : (
          <>
            <button
              onClick={() => current && onStartRecording(current)}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-blue text-white font-semibold"
            >
              <Mic className="w-4 h-4" /> {canSubmit ? '录一遍' : '录一遍试试'}
            </button>
            {!canSubmit && (
              <p className="text-xs text-muted text-center max-w-xs">
                录音只在你自己这边播放。想让老师听并给你反馈，跟老师说一声开通就好。
              </p>
            )}
            {/*
              These were grey text a shade above invisible. "下一张" is pressed
              on every single card, so it earns a real button; hiding the loop's
              own control is not calm, it is just hard to use. 卡住了 stays quiet
              because it is the occasional one.
            */}
            <div className="flex items-center gap-2.5">
              {!showAnswer && (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="px-4 py-2.5 rounded-xl border border-line bg-card text-sm font-semibold text-ink-soft hover:border-ink hover:text-ink transition-colors"
                >
                  看答案
                </button>
              )}
              <button
                onClick={deal}
                className="px-5 py-2.5 rounded-xl border border-ink bg-card text-sm font-semibold text-ink hover:bg-ink hover:text-page transition-colors inline-flex items-center gap-1.5"
              >
                下一张
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {state?.keywords && !showHint && (
              <button
                onClick={() => setShowHint(true)}
                className="text-xs text-muted hover:text-ink transition-colors"
              >
                卡住了？看几个关键词
              </button>
            )}
          </>
        )}
      </div>

      {/* Said the deck "deals" unpractised cards first, which stopped being true
          when choosing replaced dealing. It now reports what is left to do. */}
      {picking && !isRecording && (
        <p className="absolute bottom-0 text-[11px] text-muted">
          还有 {counts.fresh} 张没练过
          {counts.marked > 0 && `，标记过的 ${counts.marked} 张`}
        </p>
      )}
    </div>
  );
}
