import { GoogleGenAI, Modality } from "@google/genai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { B1_QUESTIONS } from "../src/constants";

dotenv.config();

/**
 * Creates a WAV header for PCM audio.
 */
function getWavHeader(dataLength: number, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16) {
  const header = Buffer.alloc(44);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("API Key (GEMINI_API_KEY or GOOGLE_API_KEY) is not set in environment variables.");
  console.log("Current env keys:", Object.keys(process.env).filter(k => k.includes("API") || k.includes("KEY")));
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const AUDIO_DIR = path.join(process.cwd(), "public", "audio", "part1");

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

async function generateAudio(question: string, id: string) {
  const filePath = path.join(AUDIO_DIR, `${id}.wav`);
  
  if (fs.existsSync(filePath)) {
    console.log(`Skipping ${id}, already exists.`);
    return;
  }

  console.log(`Generating audio for question: ${id}...`);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ 
        parts: [{ 
          text: `You are a professional British English examiner for the Trinity GESE B1 exam. Speak the following question naturally, clearly, and at a pace suitable for an intermediate (B1) English student. Use a professional yet encouraging tone. British accent. Question: "${question}"` 
        }] 
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Aoede' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const pcmBuffer = Buffer.from(base64Audio, "base64");
      const wavHeader = getWavHeader(pcmBuffer.length);
      const fullWav = Buffer.concat([wavHeader, pcmBuffer]);
      
      fs.writeFileSync(filePath, fullWav);
      console.log(`Successfully generated ${filePath}`);
    } else {
      console.error(`No audio data returned for ${id}`);
    }
  } catch (error) {
    console.error(`Error generating audio for ${id}:`, error);
  }
}

async function main() {
  console.log(`Starting audio generation for ${B1_QUESTIONS.length} questions...`);
  // Process in sequence to avoid rate limits
  for (const q of B1_QUESTIONS) {
    await generateAudio(q.question, q.id);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log("Audio generation complete!");
}

main().catch(console.error);
