/**
 * Reads a block of pasted text into question/answer pairs.
 *
 * The teacher writes this material in a document, not in a JSON editor, so the
 * import has to accept what a copy-paste actually looks like:
 *
 *   一行一题     What are her hobbies? | Dressing up and shopping.
 *   问答分行     1. What are her hobbies?
 *                Dressing up and shopping.
 *   同一行       1. What are her hobbies? Dressing up and shopping.
 *
 * This used to cut the text at blank lines, which quietly failed on the most
 * ordinary document there is: a numbered list with no blank line between the
 * items. The whole paste became a single question whose answer was the other
 * fifteen questions, and nothing announced the loss — the count just said 1.
 * Boundaries now come from the text itself: a numbering marker starts a new
 * question, and so does a line that asks something when one is already open.
 * Blank lines are welcome but no longer load-bearing.
 *
 * JSON still parses, so anything exported earlier keeps working.
 */
export interface QAPair {
  question: string;
  answer: string;
}

/** "1." "2、" "3)" "(4)" "Q5:" "-" "•" — the ways a list marks its items. */
const MARKER = /^\s*(?:[(（]?\s*(?:[Qq]\s*)?\d+\s*[.、)）．:：]|[-*•])\s*/;
const SEP = /\s*[|｜\t]\s*/;
const ASKS = /[?？]\s*$/;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Splits "What do you do? I'm a nurse." into its two halves.
 *
 * Only at the *first* question mark, and only when what follows is substantial:
 * "Do you mean A? Or B?" is one question, and a stray "?" at the very end is
 * not a split point at all.
 */
function cut(line: string): QAPair {
  const at = line.search(/[?？]/);
  if (at === -1) return { question: clean(line), answer: '' };
  const q = clean(line.slice(0, at + 1));
  const a = clean(line.slice(at + 1));
  return a.length >= 2 ? { question: q, answer: a } : { question: clean(line), answer: '' };
}

export function parsePastedQuestions(raw: string): QAPair[] {
  const text = (raw || '').trim();
  if (!text) return [];

  // Anything previously exported from this app.
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      return json
        .filter(o => o && typeof o.question === 'string')
        .map(o => ({ question: o.question.trim(), answer: (o.suggestedAnswer || '').trim() }))
        .filter(p => p.question);
    }
    if (json && typeof json === 'object') {
      return Object.entries(json)
        .map(([q, a]) => ({ question: q.trim(), answer: String(a).trim() }))
        .filter(p => p.question);
    }
  } catch {
    // Not JSON, which is the normal case.
  }

  const lines = text.split(/\r?\n/);
  const nonEmpty = lines.filter(l => l.trim());
  const withSep = nonEmpty.filter(l => SEP.test(l)).length;

  // If most lines carry a separator, every line is its own pair.
  if (withSep >= Math.ceil(nonEmpty.length / 2)) {
    return nonEmpty
      .map(l => {
        const [q, ...rest] = l.split(SEP);
        return { question: clean(q.replace(MARKER, '')), answer: clean(rest.join(' ')) };
      })
      .filter(p => p.question);
  }

  const out: QAPair[] = [];
  let open: QAPair | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const marked = MARKER.test(line);
    const body = marked ? line.replace(MARKER, '').trim() : line;
    if (!body) continue;

    // A marker always starts a new item. Without one, a line that asks
    // something starts a new item only if the one open already has its
    // question — otherwise a two-line question would split itself.
    const starts = marked || (!!open && ASKS.test(body));

    if (starts) {
      if (open) out.push(open);
      open = cut(body);
    } else if (open) {
      open.answer = clean(`${open.answer} ${body}`);
    } else {
      open = cut(body);
    }
  }
  if (open) out.push(open);

  return out.filter(p => p.question);
}
