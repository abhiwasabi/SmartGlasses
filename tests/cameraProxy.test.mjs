import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { esp32CameraProxy } from '../src/server/cameraProxy.ts'

async function listen(t, handler) {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  return `http://127.0.0.1:${server.address().port}`
}

async function proxy(t, hook = 'configureServer') {
  let middleware
  esp32CameraProxy()[hook]({ middlewares: { use: (value) => { middleware = value } } })
  return listen(t, (req, res) => middleware(req, res, () => {
    res.writeHead(404)
    res.end('Not handled')
  }))
}

function capture(base, target) {
  return `${base}/api/camera/capture?url=${encodeURIComponent(target)}`
}

test('dev and preview proxy independent camera snapshots and preserve the base path', async (t) => {
  const frame = Buffer.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9])
  const camera = await listen(t, (req, res) => {
    assert.equal(req.url, '/camera/capture')
    res.writeHead(200, { 'Content-Type': 'image/jpeg' })
    res.end(frame)
  })
  for (const hook of ['configureServer', 'configurePreviewServer']) {
    const base = await proxy(t, hook)
    const responses = await Promise.all([
      fetch(capture(base, `${camera}/camera/?ignored=value`)),
      fetch(capture(base, `${camera}/camera`)),
    ])
    for (const response of responses) {
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('content-type'), 'image/jpeg')
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), frame)
    }
  }
})

test('rejects public, hostname, credential, unsupported protocol, and missing targets', async (t) => {
  const base = await proxy(t)
  for (const target of ['', 'https://example.com', 'http://8.8.8.8', 'http://camera.local', 'http://user:pass@192.168.1.1', 'file:///tmp/image.jpg', 'http://169.254.169.254']) {
    const response = await fetch(capture(base, target))
    assert.equal(response.status, 400, target)
    assert.equal((await response.json()).code, 'INVALID_CAMERA_URL')
  }
  const response = await fetch(capture(base, 'http://localhost'), { method: 'POST' })
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('allow'), 'GET')
})

test('preserves camera HTTP errors and does not follow redirects', async (t) => {
  let status = 404
  const camera = await listen(t, (_req, res) => {
    res.writeHead(status, { Location: 'https://example.com' })
    res.end()
  })
  const base = await proxy(t)
  let response = await fetch(capture(base, camera))
  assert.equal(response.status, 404)
  assert.equal((await response.json()).code, 'CAMERA_HTTP_ERROR')
  status = 302
  response = await fetch(capture(base, camera))
  assert.equal(response.status, 502)
  assert.equal((await response.json()).code, 'CAMERA_HTTP_ERROR')
})

test('reports unsupported responses and over-size image headers', async (t) => {
  let oversized = false
  const camera = await listen(t, (_req, res) => {
    res.writeHead(200, oversized
      ? { 'Content-Type': 'image/jpeg', 'Content-Length': 8 * 1024 * 1024 + 1 }
      : { 'Content-Type': 'text/html' })
    res.end('not a frame')
  })
  const base = await proxy(t)
  let response = await fetch(capture(base, camera))
  assert.equal(response.status, 502)
  assert.equal((await response.json()).code, 'UNSUPPORTED_CAMERA_RESPONSE')
  oversized = true
  response = await fetch(capture(base, camera))
  assert.equal(response.status, 502)
  assert.equal((await response.json()).code, 'FRAME_TOO_LARGE')
})

test('aborts the upstream camera request when the dashboard disconnects', async (t) => {
  let started
  let closed
  const cameraStarted = new Promise((resolve) => { started = resolve })
  const cameraClosed = new Promise((resolve) => { closed = resolve })
  const camera = await listen(t, (_req, res) => {
    res.once('close', closed)
    started()
  })
  const base = await proxy(t)
  const controller = new AbortController()
  const pending = fetch(capture(base, camera), { signal: controller.signal })
  await cameraStarted
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  await cameraClosed
})

test('terminates oversized images even without a Content-Length header', async (t) => {
  const camera = await listen(t, (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/jpeg' })
    res.end(Buffer.alloc(8 * 1024 * 1024 + 1))
  })
  const base = await proxy(t)
  await assert.rejects(async () => {
    const response = await fetch(capture(base, camera))
    await response.arrayBuffer()
  })
})

test('times out cameras that do not respond', { timeout: 8_000 }, async (t) => {
  const camera = await listen(t, () => {})
  const base = await proxy(t)
  const response = await fetch(capture(base, camera))
  assert.equal(response.status, 504)
  assert.equal((await response.json()).code, 'CAMERA_TIMEOUT')
})
