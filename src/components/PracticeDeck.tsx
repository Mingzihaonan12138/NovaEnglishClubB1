import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Volume2, X, Mic, Square, Bookmark, Loader2 } from 'lucide-react';
import { QuestionAnswer } from '../constants';
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

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * How likely a card is to be dealt.
 *
 * Deliberately the opposite of a conversation-card app, which deals only cards
 * you have not seen yet. This is exam revision: the questions a student stumbled
 * on have to come back more often, not disappear.
 */
export function drawWeight(state: DeckCardState | undefined): number {
  if (!state?.lastPractisedAt) return 5;   // never attempted
  if (state.marked) return 4;              // student flagged it as hard
  if (Date.now() - state.lastPractisedAt > WEEK) return 2;
  return 1;                                // recent and not flagged
}

function pickWeighted(
  questions: QuestionAnswer[],
  cardState: Record<string, DeckCardState>,
  exclude?: string
): QuestionAnswer | null {
  const pool = questions.filter(q => q.id !== exclude);
  const candidates = pool.length > 0 ? pool : questions;
  if (candidates.length === 0) return null;

  const weights = candidates.map(q => drawWeight(cardState[q.id]));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
  const historyRef = useRef<QuestionAnswer[]>([]);

  const state = current ? cardState[current.id] : undefined;

  const deal = useCallback(() => {
    const next = pickWeighted(questions, cardState, current?.id);
    if (!next) return;
    if (current) historyRef.current.push(current);
    setCurrent(next);
    setRevealed(false);
    setShowHint(false);
    setShowAnswer(false);
    setDrawn(d => d + 1);
  }, [questions, cardState, current]);

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

  useEffect(() => { if (!current && questions.length) deal(); }, [current, questions, deal]);

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
      <button
        onClick={onExit}
        aria-label="退出练习"
        className="absolute top-0 right-0 p-2 text-muted hover:text-ink transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {!isRecording && (
        <p className="absolute top-1 left-0 text-xs text-muted">
          {deckName} · 第 {drawn} 张
        </p>
      )}

      <div className="relative" style={{ perspective: 1200 }}>
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
            <StarMascot className="w-28 h-28" />
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
      <div className="mt-8 h-24 flex flex-col items-center gap-3">
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
            <div className="flex items-center gap-5 text-xs text-muted">
              {state?.keywords && !showHint && (
                <button onClick={() => setShowHint(true)} className="hover:text-ink transition-colors">
                  卡住了？
                </button>
              )}
              {!showAnswer && (
                <button onClick={() => setShowAnswer(true)} className="hover:text-ink transition-colors">
                  看答案
                </button>
              )}
              <button onClick={deal} className="hover:text-ink transition-colors">下一张</button>
            </div>
          </>
        )}
      </div>

      {!isRecording && drawn <= 1 && (
        <p className="absolute bottom-0 text-[11px] text-muted">
          这副牌优先发没练过的 {counts.fresh} 张{counts.marked > 0 && ` 和标记过的 ${counts.marked} 张`}
        </p>
      )}
    </div>
  );
}
