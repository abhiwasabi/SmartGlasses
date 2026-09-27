import type { Connect } from 'vite'
import type { AuthorizeRequest } from './auth.ts'

export type SpeechSettings = { apiKey?: string; voiceId?: string; supabaseUrl?: string; supabasePublishableKey?: string }
type VoiceOption = { id: string; name: string }

export function elevenLabsMiddleware(settings: SpeechSettings, send: typeof fetch = fetch, authorize: AuthorizeRequest = async () => false): Connect.NextHandleFunction {
  let requests = 0
  let windowStart = Date.now()
  let voiceCache: { expiresAt: number; voices: VoiceOption[] } | null = null
  const loadVoices = async (): Promise<VoiceOption[]> => {
    if (voiceCache && voiceCache.expiresAt > Date.now()) return voiceCache.voices
    const response = await send('https://api.elevenlabs.io/v2/voices?page_size=100&sort=name&sort_direction=asc', {
      headers: { 'xi-api-key': settings.apiKey! }, signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error('Voice list unavailable')
    const data = await response.json() as { voices?: Array<{ voice_id?: unknown; name?: unknown }> }
    const voices = (data.voices ?? []).flatMap(voice => typeof voice.voice_id === 'string' && typeof voice.name === 'string'
      ? [{ id: voice.voice_id, name: voice.name }] : [])
    if (!voices.some(voice => voice.id === settings.voiceId)) voices.unshift({ id: settings.voiceId!, name: 'Default voice' })
    voiceCache = { expiresAt: Date.now() + 5 * 60_000, voices }
    return voices
  }
  return async (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/live/speech' && path !== '/api/live/voices') { next(); return }
    const replyJson = (status: number, data: object) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(data))
    }
    const reply = (status: number, error: string) => replyJson(status, { error })
    if (!settings.apiKey || !settings.voiceId) {
      reply(503, 'Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to .env.local, then restart the dashboard.'); return
    }
    if (!settings.supabaseUrl || !settings.supabasePublishableKey) { reply(503, 'Account authorization is not configured on the server.'); return }
    try {
      if (!await authorize(req)) { reply(401, 'Your account session expired. Sign in again to use assistant speech.'); return }
    } catch {
      reply(503, 'Account verification is temporarily unavailable. Try again in a moment.'); return
    }
    if (path === '/api/live/voices') {
      if (req.method !== 'GET') { reply(405, 'Use GET to list assistant voices.'); return }
      try { replyJson(200, { voices: await loadVoices(), defaultVoiceId: settings.voiceId }) }
      catch { reply(502, 'ElevenLabs voices could not be loaded. Check the server key and voice access.') }
      return
    }
    if (req.method !== 'POST') { reply(405, 'Use POST for assistant speech.'); return }
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
      let requestedVoice: unknown
      try {
        const parsed = JSON.parse(body) as { text?: unknown; voiceId?: unknown }
        text = parsed.text
        requestedVoice = parsed.voiceId
      }
      catch { reply(400, 'Send a JSON object containing reply text.'); return }
      if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
        reply(400, 'Reply text must contain between 1 and 4000 characters.'); return
      }
      let selectedVoice = settings.voiceId
      if (requestedVoice !== undefined && requestedVoice !== '') {
        if (typeof requestedVoice !== 'string' || requestedVoice.length > 100) { reply(400, 'Choose a valid assistant voice.'); return }
        const voices = await loadVoices()
        if (!voices.some(voice => voice.id === requestedVoice)) { reply(400, 'That assistant voice is not available.'); return }
        selectedVoice = requestedVoice
      }
      const upstream = await send(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selectedVoice)}?output_format=mp3_44100_128`, {
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
