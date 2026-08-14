/**
 * Speaking the examiner's questions.
 *
 * Order of preference: audio already cached in this browser, then Azure neural
 * speech through /api/tts, then the browser's own synthesis. The last of those
 * is what students were hearing before, and it sounds like a machine, so it is
 * strictly a fallback for when the service is unavailable.
 *
 * Caching is not an optimisation here so much as good manners toward a free
 * quota: a question is asked over and over during revision, and every repeat
 * after the first costs nothing.
 */

const DB_NAME = 'b1_tts_cache';
const STORE = 'audio';
const VOICE = 'sonia';
const RATE = -8;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function cacheGet(key: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve((r.result as Blob) || null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function cachePut(key: string, blob: Blob) {
  try {
    const db = await openDb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, key);
  } catch {
    // A full or unavailable cache is not worth interrupting practice for.
  }
}

/**
 * After the service fails once, stop hammering it for a while. Without this a
 * misconfigured key means every single card waits on a doomed request before
 * falling back.
 */
let unavailableUntil = 0;

let shared: HTMLAudioElement | null = null;
function player(): HTMLAudioElement {
  if (!shared) shared = new Audio();
  return shared;
}

export function stopSpeaking() {
  if (shared) {
    shared.pause();
    shared.currentTime = 0;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function playBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const a = player();
    a.src = url;
    a.onended = () => { URL.revokeObjectURL(url); resolve(); };
    a.onerror = () => { URL.revokeObjectURL(url); reject(new Error('playback failed')); };
    a.play().catch(err => { URL.revokeObjectURL(url); reject(err); });
  });
}

function browserSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.85;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/** Reads a question aloud. Never throws: silence is worse than a lesser voice. */
export async function speak(text: string): Promise<void> {
  const clean = (text || '').trim();
  if (!clean) return;

  stopSpeaking();
  const key = `${VOICE}|${RATE}|${clean}`;

  const cached = await cacheGet(key);
  if (cached) {
    try { return await playBlob(cached); } catch { /* fall through */ }
  }

  if (Date.now() > unavailableUntil) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, voice: VOICE, rate: RATE }),
      });
      if (res.ok && (res.headers.get('content-type') || '').includes('audio')) {
        const blob = await res.blob();
        cachePut(key, blob);
        return await playBlob(blob);
      }
      // 503 means the key is not set up; anything else is a transient failure.
      unavailableUntil = Date.now() + (res.status === 503 ? 10 * 60_000 : 60_000);
    } catch {
      unavailableUntil = Date.now() + 60_000;
    }
  }

  await browserSpeak(clean);
}

/** True once a real voice has been heard, so the UI can stop apologising. */
export function ttsLikelyAvailable(): boolean {
  return Date.now() > unavailableUntil;
}
