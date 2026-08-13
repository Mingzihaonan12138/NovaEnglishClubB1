import fs from 'fs';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Auth
//
// These routes spend the teacher's Gemini quota, so they must not be open to
// anyone who happens to find the deployed URL. The client sends a Firebase ID
// token; we hand it to Google's Identity Toolkit, which rejects forged or
// expired tokens, and check the resulting email against the admin list.
// ---------------------------------------------------------------------------
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8')
);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'xuanyu.diao@gmail.com,aitonghan02@gmail.com')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

interface AuthUser {
  email: string;
  emailVerified: boolean;
}

async function verifyIdToken(req: express.Request): Promise<AuthUser | null> {
  const header = req.headers.authorization || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!idToken) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const u = data.users?.[0];
    if (!u?.email) return null;
    return { email: String(u.email).toLowerCase(), emailVerified: !!u.emailVerified };
  } catch (err) {
    console.error('[Auth] Token verification failed:', err);
    return null;
  }
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = await verifyIdToken(req);
  if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED', details: 'Please sign in again.' });
  if (!user.emailVerified || !ADMIN_EMAILS.includes(user.email)) {
    return res.status(403).json({ error: 'FORBIDDEN', details: 'Teacher account required.' });
  }
  (req as any).authUser = user;
  next();
}

// Use the same helper for audio generation
async function generateAudio(text: string, filename: string, force = false) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[AudioGen] No API Key found");
    return;
  }

  const audioDir = path.join(process.cwd(), 'public', 'audio');
  if (!fs.existsSync(audioDir)) {
    console.log(`[AudioGen] Creating directory ${audioDir}`);
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const filePath = path.join(audioDir, filename);
  const fileDir = path.dirname(filePath);
  if (!fs.existsSync(fileDir)) {
    console.log(`[AudioGen] Creating directory ${fileDir}`);
    fs.mkdirSync(fileDir, { recursive: true });
  }
  
  if (!force && fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    if (stats.size > 1000) {
      return;
    }
  }

  console.log(`[AudioGen] Requesting: ${filename}...`);
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Using gemini-3.1-flash-tts-preview as per skill guidelines for high quality TTS
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `You are a professional British English examiner for the Trinity GESE B1 exam. Speak the following text naturally, clearly, and at a pace suitable for an intermediate (B1) English student. Use a professional yet encouraging tone. British accent. Text: "${text}"` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Aoede" } // Consistent premium British female examiner voice
          },
        },
      },
    });

    const audioPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (audioPart?.inlineData?.data) {
      const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
      
      // If it already starts with RIFF, it's already a WAV file
      if (audioBuffer.toString('utf8', 0, 4) === 'RIFF') {
        fs.writeFileSync(filePath, audioBuffer);
      } else {
        const wavHeader = Buffer.alloc(44);
        wavHeader.write("RIFF", 0);
        wavHeader.writeUInt32LE(audioBuffer.length + 36, 4);
        wavHeader.write("WAVE", 8);
        wavHeader.write("fmt ", 12);
        wavHeader.writeUInt32LE(16, 16);
        wavHeader.writeUInt16LE(1, 20); // PCM
        wavHeader.writeUInt16LE(1, 22); // Mono
        wavHeader.writeUInt32LE(24000, 24);
        wavHeader.writeUInt32LE(48000, 28);
        wavHeader.writeUInt16LE(2, 32);
        wavHeader.writeUInt16LE(16, 34);
        wavHeader.write("data", 36);
        wavHeader.writeUInt32LE(audioBuffer.length, 40);
        fs.writeFileSync(filePath, Buffer.concat([wavHeader, audioBuffer]));
      }
      console.log(`[AudioGen] SUCCESS: Saved ${filename}`);
      return true;
    }
    return false;
  } catch (e: any) {
    console.error(`[AudioGen Error] ${filename}:`, e.message);
    return false;
  }
}

import { B1_QUESTIONS, TOPIC_EXPANSION_BANK } from './src/constants';

function findQuestionTextById(id: string): string | null {
  // Check B1_QUESTIONS
  const b1q = B1_QUESTIONS.find(q => q.id === id);
  if (b1q) return b1q.question;

  // Check TOPIC_EXPANSION_BANK
  if (Array.isArray(TOPIC_EXPANSION_BANK)) {
    for (const topic of TOPIC_EXPANSION_BANK) {
      if (topic && Array.isArray(topic.expansionQuestions)) {
        const eq = topic.expansionQuestions.find(q => q && q.id === id);
        if (eq) return eq.question;
      }
    }
  }

  return null;
}

// Vite middleware setup
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Explicitly serve generated audio files with correct MIME types
  const audioDir = path.join(process.cwd(), 'public', 'audio');
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

  // On-the-fly dynamic generator middleware for missing audio
  app.get('/audio/*', async (req, res, next) => {
    try {
      const relativePath = req.params[0]; // e.g., "part1/d1.wav" or "d1.wav"
      if (!relativePath || !relativePath.endsWith('.wav')) {
        return next();
      }

      const filePath = path.join(audioDir, relativePath);
      if (fs.existsSync(filePath)) {
        return next(); // Let static serve existing files immediately
      }

      // Extract the ID from base filename
      const id = path.basename(relativePath, '.wav');
      console.log(`[AudioGen Interceptor] Missing file requested: ${relativePath}. Extracted ID: ${id}`);

      // Lookup text
      const questionText = findQuestionTextById(id);
      if (!questionText) {
        console.warn(`[AudioGen Interceptor] No question text found for ID: ${id}`);
        return next();
      }

      console.log(`[AudioGen Interceptor] Found question text: "${questionText}". Starting generation...`);
      // Generate audio (never force: the file-exists check above already short-
      // circuits, so forcing here only lets a refresh loop re-burn API quota)
      const success = await generateAudio(questionText, relativePath, false);
      if (success) {
        console.log(`[AudioGen Interceptor] Successfully generated on-the-fly: ${relativePath}`);
      } else {
        console.error(`[AudioGen Interceptor] Failed to generate on-the-fly: ${relativePath}`);
      }
    } catch (err) {
      console.error("[AudioGen Interceptor Error]:", err);
    }
    next();
  });

  app.use('/audio', express.static(audioDir, {
    setHeaders: (res) => {
      res.setHeader('Content-Type', 'audio/wav');
    }
  }));

  // Health check
  app.get('/api/health', (req, res) => {
    const files = fs.existsSync(audioDir) ? fs.readdirSync(audioDir) : [];
    res.json({ 
      status: "ok", 
      version: "3.2.1 (Natural Zephyr Voice)",
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      audioFilesCount: files.length
    });
  });

  // NOTE: the old POST /api/analyze route (AI pronunciation feedback) was removed
  // on purpose — the teacher gives feedback by hand, which costs no API quota.
  // The old POST /api/save-audio route was also removed. Nothing in the client
  // called it, and it wrote `path.join(audioDir, filename)` straight from the
  // request body, so a filename like "../../server.ts" could overwrite any file
  // on the server.

  // API Route to generate single audio
  app.post('/api/admin/generate-audio-single', requireAdmin, async (req, res) => {
    try {
      const { id, text } = req.body;
      if (!id || !text) return res.status(400).json({ error: "ID and text required" });
      
      const success = await generateAudio(text, `${id}.wav`, true);
      if (success) {
        res.json({ success: true, path: `/audio/${id}.wav` });
      } else {
        res.status(500).json({ error: "Failed to generate audio" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route to batch generate audio (Admin only)
  app.post('/api/admin/generate-audio-batch', requireAdmin, async (req, res) => {
    try {
      const { questions } = req.body; // Array of { id, text }
      if (!Array.isArray(questions)) return res.status(400).json({ error: "Questions must be an array" });

      console.log(`[BatchGen] Starting batch generation for ${questions.length} items`);
      
      // Process sequentially to avoid rate limits and memory issues
      const results = [];
      for (const q of questions) {
        const filename = `${q.id}.wav`;
        await generateAudio(q.text, filename);
        results.push({ id: q.id, success: true });
      }

      res.json({ success: true, results });
    } catch (err: any) {
      console.error("[BatchGen Error]:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
