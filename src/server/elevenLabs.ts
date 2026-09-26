import { timingSafeEqual } from 'node:crypto'
import type { Connect } from 'vite'

export type SpeechSettings = { apiKey?: string; voiceId?: string; accessCode?: string }

export function elevenLabsMiddleware(settings: SpeechSettings, send: typeof fetch = fetch): Connect.NextHandleFunction {
  let requests = 0
  let windowStart = Date.now()
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/live/speech') { next(); return }
    const reply = (status: number, error: string) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ error }))
    }
    if (req.method !== 'POST') { reply(405, 'Use POST for assistant speech.'); return }
    if (!settings.apiKey || !settings.voiceId || !settings.accessCode) {
      reply(503, 'Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to .env.local, then restart the dashboard.'); return
    }
    const supplied = Buffer.from(String(req.headers['x-live-access-code'] ?? ''))
    const expected = Buffer.from(settings.accessCode)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      reply(401, 'Enter the demo access code configured on the laptop.'); return
    }
    if (Date.now() - windowStart > 60_000) { requests = 0; windowStart = Date.now() }
    if (++requests > 30) { reply(429, 'Too many speech requests. Wait a minute and try again.'); return }
    const controller = new AbortController()
    const disconnect = () => { if (!res.writableEnded) controller.abort() }
    res.on('close', disconnect)
    const timeout = setTimeout(() => controller.abort(), 20_000)
    try {
      let body = ''
      for await (const chunk of req) {
        body += chunk.toString()
        if (Buffer.byteLength(body) > 16_384) { reply(413, 'Speech request is too large.'); return }
      }
      let text: unknown
      try { text = JSON.parse(body).text }
      catch { reply(400, 'Send a JSON object containing reply text.'); return }
      if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
        reply(400, 'Reply text must contain between 1 and 4000 characters.'); return
      }
      const upstream = await send(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(settings.voiceId)}?output_format=mp3_44100_128`, {
        method: 'POST', signal: controller.signal,
        headers: { 'xi-api-key': settings.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5' }),
      })
      if (!upstream.ok) { reply(502, 'ElevenLabs could not generate speech. Check the server key, voice access, and quota.'); return }
      const audio = Buffer.from(await upstream.arrayBuffer())
      if (!audio.length) { reply(502, 'ElevenLabs returned no audio.'); return }
      if (!controller.signal.aborted) {
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' })
        res.end(audio)
      }
    } catch {
      if (!res.destroyed) reply(502, 'ElevenLabs speech failed or timed out. Try again.')
    } finally {
      clearTimeout(timeout)
      res.off('close', disconnect)
    }
  }
}
