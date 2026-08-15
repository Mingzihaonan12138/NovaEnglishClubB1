/**
 * Trinity's questions often carry the examiner's alternative phrasings with
 * them, in brackets, separated by slashes:
 *
 *   Tell me about a recent event that made you feel happy. (Do you have a
 *   recent event that made you feel excited? / Can you describe a recent
 *   experience that made you happy?)
 *
 * Printed as one string that is three questions long, which overran the card —
 * and asked the student to read a paragraph when the examiner will ask them one
 * sentence. It is one question with three wordings, so it is stored as one and
 * shown as one, with the other wordings kept small underneath.
 *
 * The reading voice gets the main wording only. Reading all three aloud is not
 * what happens in the exam, and it also spent the free tier's characters three
 * times over on every card.
 */
export interface SplitQuestion {
  /** What the examiner actually asks. */
  main: string;
  /** The same question in the examiner's other words. */
  alts: string[];
}

/**
 * Splits only a trailing bracket. A bracket in the middle of a question is part
 * of the sentence, not a list of alternatives, and is left alone.
 */
export function splitQuestion(raw: string): SplitQuestion {
  const q = (raw || '').trim();
  const m = q.match(/^([\s\S]*?)\s*[（(]([\s\S]+)[）)]\s*$/);
  if (!m) return { main: q, alts: [] };

  const main = m[1].trim();
  // No main text means the whole question happened to be bracketed; that is a
  // question in brackets, not an alternative to something.
  if (!main) return { main: q, alts: [] };

  const alts = m[2]
    .split(/\s*[/／]\s*/)
    .map(s => s.trim())
    .filter(Boolean);

  // A bracket holding one short fragment is an aside ("(in English)"), not a
  // rephrasing. Keep the sentence whole.
  if (alts.length === 1 && alts[0].length < 25) return { main: q, alts: [] };

  return { main, alts };
}

/** What the examiner reads aloud: the main wording, never the alternatives. */
export function spokenForm(raw: string): string {
  return splitQuestion(raw).main;
}

/**
 * How large the question can be set before it stops fitting the card.
 *
 * The card is a fixed size on purpose — it is a card — so the type has to give
 * instead. These are rem values against a content column of about 248px.
 */
export function questionSize(main: string, altCount: number): string {
  const weight = main.length + altCount * 12;
  if (weight > 190) return '1.05rem';
  if (weight > 140) return '1.2rem';
  if (weight > 95) return '1.35rem';
  if (weight > 55) return '1.5rem';
  return '1.6rem';
}
