/**
 * Browser Speech Synthesis Fallback
 */
function fallbackSpeak(text: string) {
  return new Promise<void>((resolve) => {
    // Clear any existing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB'; // English (United Kingdom)
    utterance.rate = 0.8;     // Slightly slower for B1
    utterance.pitch = 1.0;
    
    utterance.onend = () => resolve();
    utterance.onerror = (err) => {
      console.error("SpeechSynthesis Error:", err);
      resolve(); 
    };
    
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Main function to speak the question.
 * Prioritizes pre-generated audio file, falls back to browser TTS.
 */
export async function speakQuestion(text: string, audioUrl?: string): Promise<void> {
  console.log(`Speaking question: ${text.substring(0, 30)}... (URL: ${audioUrl})`);

  // Try the pre-recorded file first. Play it directly instead of probing for
  // existence first — the old probe waited a fixed 2s before falling back,
  // which stalled every question that had no audio file yet.
  if (audioUrl) {
    try {
      return await new Promise<void>((resolve, reject) => {
        const audio = new Audio(audioUrl);
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error(`Audio not available: ${audioUrl}`));
        audio.play().catch(reject);
      });
    } catch (error) {
      console.warn(`Local audio playback failed for ${audioUrl}:`, error);
    }
  }

  // Fallback to Browser Speech Synthesis (Always works, free)
  console.log("Using browser SpeechSynthesis...");
  await fallbackSpeak(text);
}
