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
const SPACING = 34;   // px between spines
const TURN = 66;      // every card sits at this angle; none of them face you
const LIFT = 54;      // how far the card under the cursor rises out of the row
/** Cards near the cursor slide aside, opening a gap around the one in focus. */
const PART = 46;

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
      <div
        ref={wrap}
        onPointerMove={(e) => track(e.clientX)}
        onPointerDown={(e) => track(e.clientX)}
        className="relative h-[24rem] w-full cursor-ew-resize touch-pan-y"
        style={{ perspective: 1500 }}
      >
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
                onPick={() => take(q)}
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
  onPick: () => void;
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
  index, focus, deckColor, isCentre, isRising, dimmed, fresh, marked, age, onPick,
}: CrateCardProps) {
  const d = useTransform(focus, (f: number) => index - f);
  // The row parts around the cursor, most strongly at the nearest neighbours,
  // which is what makes a single card legible among cards of one colour.
  const x = useTransform(d, (v: number) =>
    v * SPACING + Math.sign(v) * PART * Math.exp(-Math.abs(v) / 2.2));
  const z = useTransform(d, (v: number) => -Math.abs(v) * 30);

  return (
    // Position is a motion value and lives on the outside; the turn is animated
    // and lives on the inside, so taking a card can rotate it without fighting
    // the value that places it.
    <motion.div
      className="absolute left-1/2 top-1/2 w-[13rem] h-[18rem] -ml-[6.5rem] -mt-[9rem]"
      style={{ x, z, transformStyle: 'preserve-3d', zIndex: isRising ? 99 : isCentre ? 60 : 40 - Math.abs(index) }}
    >
      <motion.button
        onClick={onPick}
        aria-label={isCentre ? '抽这张' : '移到这张'}
        className="w-full h-full rounded-[1.1rem] relative"
        style={{ background: deckColor, transformStyle: 'preserve-3d' }}
        animate={{
          // Every card leans the same way, the way records lean in a crate.
          // Turning one side of the row to face the other produced two opposing
          // perspectives meeting in the middle, which read as a broken drawing.
          // The only card that ever turns flat is the one being taken, and it
          // turns as it leaves, arriving face-on to match the card it becomes.
          rotateY: isRising ? 0 : -TURN,
          y: isRising ? -180 : isCentre ? -LIFT : 0,
          scale: isRising ? 1.1 : isCentre ? 1.06 : 0.97,
          opacity: dimmed ? 0.2 : fresh ? 1 : 1 - age * 0.5,
          filter: fresh
            ? `saturate(1) brightness(${isCentre || isRising ? 1.12 : 0.86})`
            : `saturate(${1 - age * 0.7}) brightness(${isCentre || isRising ? 1.12 : 0.86})`,
          boxShadow: isCentre || isRising
            ? '0 22px 50px rgba(34,30,26,.28)'
            : '0 1px 0 rgba(0,0,0,.18)',
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        {/* Outline plus a lit leading edge: without both, neighbouring cards of
            the same colour have no boundary and the row looks like one slab. */}
        <div className="absolute inset-0 rounded-[1.1rem] border border-black/25 pointer-events-none" />
        <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-[1.1rem] bg-white/45 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-[3px] rounded-r-[1.1rem] bg-black/25 pointer-events-none" />

        {/* The same star that is on the back of a drawn card, so the card you
            pull out is recognisably the card you were looking at. Foreshortened
            in the row, fully itself once the card turns. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <StarMascot className="w-24 h-24 opacity-95" />
        </div>

        {marked && (
          <span className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-gold pointer-events-none" />
        )}
      </motion.button>
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
      if (e.code === 'Space') { e.preventDefault(); revealed ? deal() : reveal(); }
      else if (e.code === 'ArrowLeft') back();
      else if (e.code === 'ArrowRight') deal();
      else if (e.code === 'Escape') onExit();
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
            className="absolute inset-0 rounded-[1.6rem] flex items-center justify-center"
            style={{ backfaceVisibility: 'hidden', background: deckColor }}
          >
            <div className="absolute inset-2.5 rounded-[1.25rem] border border-white/25" />
            {/* Face-down is the one moment with nothing to read, so the star
                gets the space and watches the pointer while you decide. */}
            <StarMascot className="w-56 h-56" followPointer />
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
