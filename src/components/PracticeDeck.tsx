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
const GOLD = '#e5bb40';
const CREAM = '#fcf6f0';

/**
 * Which colour the star prints in on a given card.
 *
 * Gold is the mark's own colour and is used wherever it reads. It does not read
 * on the gold deck, where it would be invisible, nor on the mid-toned ones like
 * terracotta and slate, where it manages barely 2:1. Those print cream instead,
 * which keeps the mark legible without pretending the card is darker or lighter
 * than it is.
 */
function starInk(bg: string): string {
  if (luminance(bg) > 0.33) return INK;
  return contrast(bg, GOLD) >= 2.5 ? GOLD : CREAM;
}

function isLight(hex: string): boolean {
  return luminance(hex) > 0.33;
}

function CardBack({ color, radius = '1.1rem', followPointer = false }: { color: string; radius?: string; followPointer?: boolean }) {
  // The gold deck is the same colour as the star, so a gold star on it would be
  // an invisible mark on a blank rectangle. Light cards print in ink instead.
  const light = isLight(color);
  const rule = light ? 'border-black/20' : 'border-white/25';
  const ruleFaint = light ? 'border-black/10' : 'border-white/12';
  const dot = light ? 'bg-black/20' : 'bg-white/30';
  const ring = light ? 'border-black/15' : 'border-white/20';
  const star = starInk(color);
  const leadEdge = light ? 'bg-white/60' : 'bg-white/45';

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: color, borderRadius: radius }}>
      {/* Printed frame */}
      <div className={`absolute inset-[6%] rounded-[0.75rem] border ${rule} pointer-events-none`} />
      <div className={`absolute inset-[9%] rounded-[0.6rem] border ${ruleFaint} pointer-events-none`} />

      {/* The mark, big enough to read foreshortened */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-[62%] aspect-square flex items-center justify-center">
          <div className={`absolute inset-0 rounded-full border ${ring}`} />
          <StarMascot className="w-[76%] h-[76%] drop-shadow-sm" followPointer={followPointer} fill={star} />
        </div>
      </div>

      {/* Corner marks, so the print continues to the edges rather than floating */}
      {['top-[7%] left-[7%]', 'top-[7%] right-[7%]', 'bottom-[7%] left-[7%]', 'bottom-[7%] right-[7%]'].map(pos => (
        <span key={pos} className={`absolute ${pos} w-1.5 h-1.5 rounded-full ${dot} pointer-events-none`} />
      ))}

      {/* Paper edges: lit on the leading side, shaded on the trailing one, which
          is what separates one card from the next when they share a colour. */}
      <div className={`absolute inset-y-0 left-0 w-[3px] ${leadEdge} pointer-events-none`} />
      <div className="absolute inset-y-0 right-0 w-[3px] bg-black/25 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: radius, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.22)' }} />
    </div>
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
const SPACING = 26;   // px between spines: cards mostly hide each other
const TURN = 66;      // every card sits at this angle; none of them face you
const LIFT = 70;      // how far the card under the cursor rises out of the row
/**
 * Cards near the cursor ease apart a little. This used to be large enough to
 * hollow out the row, leaving the raised card hovering in a void between two
 * piles rather than standing in the slot it came from. A crate is dense: the
 * cards hide one another, and what marks one out is that it is lifted, not that
 * the deck has opened around it.
 */
const PART = 15;

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
        style={{ perspective: 1700 }}
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
  // The row parts around the cursor so that one card is legible among cards of
  // a single colour. tanh rather than sign: sign flips the whole PART term the
  // instant d crosses zero, which threw a card across the centre line in one
  // frame. tanh gives the same widening either side and passes through smoothly.
  const x = useTransform(d, (v: number) => v * SPACING + PART * Math.tanh(v / 1.2));
  const z = useTransform(d, (v: number) => -Math.abs(v) * 34);
  // Distant cards go soft, because nothing says "further away" as plainly as
  // being out of focus. Softening began immediately though, so the cards either
  // side of the one in focus — the ones you are about to move onto — were
  // already smeared. Blur now holds off until the second neighbour and tops out
  // at under 2px: enough to give the row depth, not enough to fog it.
  const blur = useTransform(d, (v: number) =>
    `blur(${Math.min(Math.max(Math.abs(v) - 0.8, 0) * 0.55, 1.8)}px)`);
  // Cards deep in the stack are almost entirely covered anyway; fading the far
  // ones keeps the row from looking like a fan of separate objects.
  const fade = useTransform(d, (v: number) => Math.max(1 - Math.max(Math.abs(v) - 3, 0) * 0.18, 0.35));

  return (
    // Position is a motion value and lives on the outside; the turn is animated
    // and lives on the inside, so taking a card can rotate it without fighting
    // the value that places it.
    <motion.div
      className="absolute left-1/2 top-1/2 w-[16rem] h-[22rem] -ml-[8rem] -mt-[11rem]"
      style={{ x, z, filter: blur, opacity: fade, transformStyle: 'preserve-3d', zIndex: isRising ? 99 : isCentre ? 60 : 40 - Math.abs(index) }}
    >
      <div className="w-full h-full" style={{ pointerEvents: 'none' }}>
        <motion.div
          className="w-full h-full rounded-[1.1rem] relative"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{
            // Every card leans the same way, as records lean in a crate. Turning
            // the halves of the row toward each other put two opposing
            // perspectives side by side, which read as a mistake. Only the card
            // being taken turns flat, arriving face-on as it becomes the question.
            rotateY: isRising ? 0 : -TURN,
            y: isRising ? -210 : isCentre ? -LIFT : 0,
            scale: isRising ? 1.08 : isCentre ? 1.05 : 0.94,
            opacity: dimmed ? 0.18 : fresh ? 1 : 1 - age * 0.5,
            filter: fresh
              ? `saturate(1) brightness(${isCentre || isRising ? 1.1 : 0.82})`
              : `saturate(${1 - age * 0.7}) brightness(${isCentre || isRising ? 1.1 : 0.82})`,
            boxShadow: isCentre || isRising
              ? '0 26px 60px rgba(34,30,26,.32)'
              : '0 2px 6px rgba(34,30,26,.18)',
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          <CardBack color={deckColor} />
          {marked && (
            <span className="absolute top-[7%] left-[7%] w-2.5 h-2.5 rounded-full bg-gold ring-2 ring-white/40 pointer-events-none" />
          )}
        </motion.div>
      </div>
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
