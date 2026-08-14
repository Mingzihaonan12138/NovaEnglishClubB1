/**
 * Azure neural speech, proxied.
 *
 * The examiner questions were being read by the browser's own speech synthesis,
 * which sounds like a machine, because nothing better was reachable in
 * production: no audio files are deployed and the Express server that used to
 * generate them has no disk here. This gives the app a real voice without ever
 * putting the subscription key in front of the browser.
 *
 * Needs AZURE_SPEECH_KEY in the environment. AZURE_SPEECH_REGION defaults to
 * northeurope, matching the existing resource.
 */

const REGION = process.env.AZURE_SPEECH_REGION || 'northeurope';

/** British examiner voices. Anything else is refused rather than passed on. */
const VOICES: Record<string, string> = {
  sonia: 'en-GB-SoniaNeural',
  libby: 'en-GB-LibbyNeural',
  ryan: 'en-GB-RyanNeural',
};

const MAX_CHARS = 800;

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const key = process.env.AZURE_SPEECH_KEY;
  if (!key) {
    res.status(503).json({ error: 'TTS_NOT_CONFIGURED' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const text: string = String(body.text || '').trim();
  const voice = VOICES[String(body.voice || 'sonia')] || VOICES.sonia;
  // Examiner questions read a little under natural pace for a B1 listener.
  const rate = Math.max(-40, Math.min(20, Number(body.rate ?? -8)));

  if (!text) {
    res.status(400).json({ error: 'NO_TEXT' });
    return;
  }
  if (text.length > MAX_CHARS) {
    res.status(413).json({ error: 'TEXT_TOO_LONG', limit: MAX_CHARS });
    return;
  }

  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">` +
    `<voice name="${voice}"><prosody rate="${rate}%">${escapeXml(text)}</prosody></voice>` +
    `</speak>`;

  try {
    const azure = await fetch(
      `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
          'User-Agent': 'nova-english-b1',
        },
        body: ssml,
      }
    );

    if (!azure.ok) {
      const detail = await azure.text();
      res.status(502).json({ error: 'AZURE_FAILED', status: azure.status, detail: detail.slice(0, 300) });
      return;
    }

    const audio = Buffer.from(await azure.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    // The same question always sounds the same, so let the CDN keep it.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(audio);
  } catch (err: any) {
    res.status(500).json({ error: 'PROXY_FAILED', detail: String(err?.message || err) });
  }
}
