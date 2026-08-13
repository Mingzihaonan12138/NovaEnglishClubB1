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

  // Try pre-recorded audio ONLY if we are fairly sure it exists or if we can handle the 404 quickly
  if (audioUrl) {
    try {
      const audioExists = await new Promise<boolean>((resolve) => {
        const audio = new Audio(audioUrl);
        audio.oncanplaythrough = () => resolve(true);
        audio.onerror = () => resolve(false);
        // Timeout if it takes too long to load
        setTimeout(() => resolve(false), 2000);
      });

      if (audioExists) {
        return await new Promise<void>((resolve, reject) => {
          const audio = new Audio(audioUrl);
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Audio playback failed"));
          audio.play().catch(reject);
        });
      }
    } catch (error) {
      console.warn(`Local audio playback failed for ${audioUrl}:`, error);
    }
  }

  // Fallback to Browser Speech Synthesis (Always works, free)
  console.log("Using browser SpeechSynthesis...");
  await fallbackSpeak(text);
}

export async function analyzePronunciation(audioBase64: string, expectedText: string): Promise<string> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, expectedText })
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const errorData = contentType.includes("application/json") 
        ? await response.json() 
        : { details: "Analysis server returned an error page (HTML)." };
      throw new Error(errorData.details || errorData.error || `Analysis failed with status ${response.status}`);
    }

    if (!contentType.includes("application/json")) {
      throw new Error("Analysis service returned a non-JSON response.");
    }

    const { feedback } = await response.json();
    return feedback || "抱歉，分析过程中出现了问题，请再试一次。";
  } catch (error: any) {
    console.error("Analysis Error:", error);
    return `分析音频时遇到问题: ${error.message}。请检查您的网络连接或稍后再试。`;
  }
}
