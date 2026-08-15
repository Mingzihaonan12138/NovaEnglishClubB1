import { speak, stopSpeaking } from '../lib/tts';
import { spokenForm } from '../lib/question';

/**
 * Reads an examiner question aloud.
 *
 * Only the main wording. Many questions carry the examiner's alternative
 * phrasings in brackets, and reading all three aloud is not what happens in the
 * exam — a real examiner asks one. It also spent three times the characters of
 * the free speech tier on every card.
 *
 * The audioUrl argument is kept for the callers that still pass one, but it is
 * no longer used: no audio files are deployed, and requesting them returned the
 * SPA's own HTML with a 200, which the audio element then failed to decode. All
 * speech now goes through src/lib/tts.ts, which prefers Azure's neural voice
 * and only falls back to the browser's synthesis when that is unreachable.
 */
export async function speakQuestion(text: string, _audioUrl?: string): Promise<void> {
  await speak(spokenForm(text));
}

export { stopSpeaking };
