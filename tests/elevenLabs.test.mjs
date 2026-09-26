import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { elevenLabsMiddleware } from '../src/server/elevenLabs.ts'
import { liveTokenMiddleware } from '../src/server/geminiLive.ts'

const settings = { apiKey: 'private-eleven-key', voiceId: 'chosen-voice', supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'public-key' }
const authorize = async request => request.headers.authorization === 'Bearer valid-session'
function request(handler, options = {}, body = JSON.stringify({ text: 'A chair is in front of you.' })) {
  return new Promise(resolve => {
    const req = Object.assign(Readable.from([Buffer.from(body)]), {
      url: '/api/live/speech', method: 'POST', headers: { authorization: 'Bearer valid-session' }, ...options,
    })
    const res = Object.assign(new EventEmitter(), {
      status: 0, headers: {}, writableEnded: false,
      writeHead(status, headers) { this.status = status; this.headers = headers },
      end(body) { this.writableEnded = true; resolve({ status: this.status, headers: this.headers, body }) },
    })
    void handler(req, res, () => resolve({ next: true }))
  })
}
test('speech requires authorization and setup before calling ElevenLabs', async () => {
  const handler = elevenLabsMiddleware(settings, async () => assert.fail('Must not call upstream'), authorize)
  assert.equal((await request(handler, { headers: {} })).status, 401)
  assert.equal((await request(handler, { method: 'GET' })).status, 405)
  assert.equal((await request(elevenLabsMiddleware({}), {})).status, 503)
  assert.equal((await request(handler, { url: '/other' })).next, true)
})
test('speech rejects malformed, empty, oversized, and non-string text', async () => {
  const handler = elevenLabsMiddleware(settings, async () => assert.fail('Must not call upstream'), authorize)
  for (const body of ['{', '{}', '{"text":42}', '{"text":" "}', JSON.stringify({ text: 'x'.repeat(4001) })]) {
    assert.equal((await request(handler, {}, body)).status, 400)
  }
  assert.equal((await request(handler, {}, 'x'.repeat(17000))).status, 413)
})
test('speech sends credentials only upstream and returns uncached audio', async () => {
  const handler = elevenLabsMiddleware(settings, async (url, options) => {
    assert.match(url, /chosen-voice/)
    assert.equal(options.headers['xi-api-key'], settings.apiKey)
    assert.equal(JSON.parse(options.body).model_id, 'eleven_flash_v2_5')
    return new Response(new Uint8Array([1, 2, 3]))
  }, authorize)
  const result = await request(handler)
  assert.equal(result.status, 200)
  assert.equal(result.headers['Content-Type'], 'audio/mpeg')
  assert.equal(result.headers['Cache-Control'], 'no-store')
  assert.deepEqual([...result.body], [1, 2, 3])
})
test('lists account voices and uses an available selected voice', async () => {
  const calls = []
  const handler = elevenLabsMiddleware(settings, async (url, options) => {
    calls.push(url)
    assert.equal(options.headers['xi-api-key'], settings.apiKey)
    if (url.includes('/v2/voices')) return Response.json({ voices: [
      { voice_id: 'chosen-voice', name: 'Hale' },
      { voice_id: 'second-voice', name: 'River' },
    ] })
    assert.match(url, /second-voice/)
    return new Response(new Uint8Array([4, 5, 6]))
  }, authorize)
  const listed = await request(handler, { url: '/api/live/voices', method: 'GET' }, '')
  assert.deepEqual(JSON.parse(listed.body), { voices: [
    { id: 'chosen-voice', name: 'Hale' },
    { id: 'second-voice', name: 'River' },
  ], defaultVoiceId: 'chosen-voice' })
  const spoken = await request(handler, {}, JSON.stringify({ text: 'Hello.', voiceId: 'second-voice' }))
  assert.equal(spoken.status, 200)
  assert.equal(calls.filter(url => url.includes('/v2/voices')).length, 1)
})
test('rejects a voice that is not available to the ElevenLabs account', async () => {
  const handler = elevenLabsMiddleware(settings, async url => {
    if (url.includes('/v2/voices')) return Response.json({ voices: [{ voice_id: 'chosen-voice', name: 'Hale' }] })
    return assert.fail('Must not generate speech with an unavailable voice')
  }, authorize)
  const result = await request(handler, {}, JSON.stringify({ text: 'Hello.', voiceId: 'unknown-voice' }))
  assert.equal(result.status, 400)
})
test('speech failures do not expose provider errors or credentials', async () => {
  for (const send of [async () => { throw new Error(settings.apiKey) }, async () => new Response(settings.apiKey, { status: 401 })]) {
    const result = await request(elevenLabsMiddleware(settings, send, authorize))
    assert.equal(result.status, 502)
    assert.doesNotMatch(result.body, /private-eleven-key/)
  }
})
test('partial ElevenLabs configuration blocks session creation', async () => {
  const handler = liveTokenMiddleware({ apiKey: 'gemini-key', elevenLabsApiKey: settings.apiKey, supabaseUrl: settings.supabaseUrl, supabasePublishableKey: settings.supabasePublishableKey }, async () => assert.fail(), authorize)
  const result = await request(handler, { url: '/api/live/token' })
  assert.equal(result.status, 503)
})
