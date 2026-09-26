import test from 'node:test'
import assert from 'node:assert/strict'
import { liveTokenMiddleware } from '../src/server/geminiLive.ts'
import { encodePcm, decodePcm } from '../src/lib/liveAudio.ts'

function request(handler, options = {}) {
  return new Promise(resolve => {
    const req = { url: '/api/live/token', method: 'POST', headers: { 'x-live-access-code': 'private-demo' }, ...options }
    const res = { status: 0, headers: {}, writeHead(status, headers) { this.status = status; this.headers = headers }, end(body) { resolve({ status: this.status, headers: this.headers, body: JSON.parse(body) }) } }
    void handler(req, res, () => resolve({ next: true }))
  })
}
const settings = { apiKey: 'server-only-secret', accessCode: 'private-demo', model: 'test-live-model' }
test('token route requires the demo code before calling Gemini', async () => {
  let called = false
  const handler = liveTokenMiddleware(settings, async () => { called = true; return 'temporary-token' })
  assert.equal((await request(handler, { headers: {} })).status, 401)
  assert.equal((await request(handler, { headers: { 'x-live-access-code': 'wrong' } })).status, 401)
  assert.equal(called, false)
})
test('missing setup returns a useful error without trying Gemini', async () => {
  const result = await request(liveTokenMiddleware({}, async () => assert.fail()))
  assert.equal(result.status, 503)
  assert.match(result.body.error, /GEMINI_API_KEY/)
})
test('valid request returns only temporary credentials and never caches them', async () => {
  const result = await request(liveTokenMiddleware(settings, async () => 'temporary-token'))
  assert.deepEqual(result.body, { token: 'temporary-token', model: 'test-live-model' })
  assert.equal(result.headers['Cache-Control'], 'no-store')
  assert.doesNotMatch(JSON.stringify(result), /server-only-secret/)
})
test('upstream failures do not leak key or private errors', async () => {
  const result = await request(liveTokenMiddleware(settings, async () => { throw new Error(settings.apiKey) }))
  assert.equal(result.status, 502)
  assert.doesNotMatch(JSON.stringify(result), /server-only-secret/)
})
test('rejects GET and rate limits repeated authorized session creation', async () => {
  const handler = liveTokenMiddleware(settings, async () => 'temporary-token')
  assert.equal((await request(handler, { method: 'GET' })).status, 405)
  for (let i = 0; i < 6; i++) assert.equal((await request(handler)).status, 200)
  assert.equal((await request(handler)).status, 429)
  assert.equal((await request(handler, { url: '/api/other' })).next, true)
})
test('microphone PCM is signed little-endian and clips overloaded samples', () => {
  const encoded = encodePcm(new Float32Array([-2, -1, 0, 0.5, 1, 2]))
  assert.deepEqual([...Buffer.from(encoded, 'base64')], [0, 128, 0, 128, 0, 0, 0, 64, 255, 127, 255, 127])
  const decoded = decodePcm(encoded)
  assert.equal(decoded[0], -1)
  assert.equal(decoded[3], 0.5)
  assert.ok(decoded[4] > 0.999)
})
test('malformed response audio is rejected', () => {
  assert.throws(() => decodePcm(btoa('x')), /Invalid PCM/)
})
