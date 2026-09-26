import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
loadEnv('server/.env.local');
if (process.env.SMARTGLASSES_ENV_FILE) loadEnv(process.env.SMARTGLASSES_ENV_FILE);

const MAX_BODY = 5_000_000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

function authorized(supplied, expected) {
  if (!supplied || !expected) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function parseRequest(input) {
  const { mode, goal, question, imageBase64, audioBase64 } = input || {};
  if (!['scene', 'question', 'transcribe'].includes(mode)) throw new Error('Choose a valid mode.');
  if (imageBase64 && (typeof imageBase64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(imageBase64))) throw new Error('Invalid image.');
  if (audioBase64 && (typeof audioBase64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(audioBase64))) throw new Error('Invalid audio.');
  if (mode === 'scene' && !imageBase64) throw new Error('A camera image is required.');
  if (mode === 'question' && !question && !audioBase64) throw new Error('Enter or record a question.');
  if (mode === 'transcribe' && !audioBase64) throw new Error('An audio recording is required.');
  return { mode, goal: String(goal || '').slice(0, 300), question: String(question || '').slice(0, 1000), imageBase64, audioBase64 };
}

export function createAppServer({ accessCode = process.env.MOBILE_ACCESS_CODE, apiKey = process.env.GEMINI_API_KEY, generate } = {}) {
  const run = generate || (async (args) => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
    const data = await response.json();
    return { text: (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('') };
  });
  return createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, { ok: true, geminiConfigured: Boolean(apiKey), model: MODEL });
    }
    if (req.method !== 'POST' || req.url !== '/api/assist') return send(res, 404, { error: 'Not found.' });
    if (!authorized(req.headers['x-mobile-access-code'], accessCode)) return send(res, 401, { error: 'Invalid access code.' });
    if (!apiKey && !generate) return send(res, 503, { error: 'Gemini API key is not configured on the laptop.' });

    try {
      let length = 0;
      const chunks = [];
      for await (const chunk of req) {
        length += chunk.length;
        if (length > MAX_BODY) {
          send(res, 413, { error: 'Image or recording is too large.' });
          req.destroy();
          return;
        }
        chunks.push(chunk);
      }
      const { mode, goal, question, imageBase64, audioBase64 } = parseRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const parts = [];
      if (mode === 'scene') {
        parts.push({ text: `You are a context-aware wearable assistant. The user's goal is: ${goal || 'notice what matters nearby'}. Examine only the visible image. Decide whether something in the image matters to this goal. Ignore routine details. Never claim unseen facts, distances, or certainty. Return JSON only: {"shouldAlert":boolean,"message":"one short actionable sentence or empty string"}. For urgent visible hazards, alert even if outside the goal.` });
      } else if (mode === 'transcribe') {
        parts.push({ text: 'Transcribe this voice note accurately. Return only the transcript, with no introduction. If no speech is understandable, return an empty string.' });
      } else {
        parts.push({ text: `Answer the user's question in one or two concise, useful sentences. Use the camera image only for visible facts. If the question is in audio, listen to it. Current goal: ${goal || 'general help'}. Typed question: ${question || '(spoken in the audio)'}. Do not invent details outside the available input.` });
      }
      if (imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
      if (audioBase64) parts.push({ inlineData: { mimeType: 'audio/mp4', data: audioBase64 } });
      const response = await run({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 250, ...(mode === 'scene' ? { responseMimeType: 'application/json' } : {}) } });
      const raw = String(response.text || '').trim();
      if (mode === 'scene') {
        const parsed = JSON.parse(raw);
        return send(res, 200, { shouldAlert: parsed.shouldAlert === true, message: String(parsed.message || '').slice(0, 400) });
      }
      return send(res, 200, { message: raw.slice(0, 1500) });
    } catch (error) {
      if (error instanceof SyntaxError || /Invalid|Choose|Enter|required/.test(error.message)) return send(res, 400, { error: error.message });
      console.error('Gemini request failed:', error.message);
      return send(res, 502, { error: 'Gemini request failed. Check the laptop service and API key.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.MOBILE_PORT || 8766);
  createAppServer().listen(port, '0.0.0.0', () => {
    console.log(`SmartGlasses mobile service listening on port ${port}. Gemini key configured: ${Boolean(process.env.GEMINI_API_KEY)}.`);
  });
}
