import test from 'node:test'
import assert from 'node:assert/strict'
import { createVideoThumbnail } from '../src/lib/videoThumbnail.ts'

function mockMedia(t) {
  const originalDocument = globalThis.document
  const originalWindow = globalThis.window
  const create = URL.createObjectURL
  const revoke = URL.revokeObjectURL
  const revoked = []
  const frames = []
  let loaded = 0
  const image = new Blob(['preview'], { type: 'image/jpeg' })
  const video = { videoWidth: 1920, videoHeight: 1080, load() { loaded++ }, removeAttribute(name) { delete this[name] } }
  const canvas = { getContext() { return { drawImage(...args) { frames.push(args) } } }, toBlob(callback, type) { assert.equal(type, 'image/jpeg'); callback(image) } }
  globalThis.document = { createElement(tag) { return tag === 'video' ? video : canvas } }
  globalThis.window = { setTimeout, clearTimeout }
  URL.createObjectURL = () => 'blob:test-recording'
  URL.revokeObjectURL = url => revoked.push(url)
  t.after(() => {
    globalThis.document = originalDocument
    globalThis.window = originalWindow
    URL.createObjectURL = create
    URL.revokeObjectURL = revoke
  })
  return { video, canvas, image, revoked, frames, loads: () => loaded }
}

test('creates a bounded JPEG preview without playing the recording and releases its URL', async t => {
  const media = mockMedia(t)
  const result = createVideoThumbnail(new Blob(['video']), new AbortController().signal)
  assert.equal(media.video.muted, true)
  media.video.onloadeddata()
  assert.equal(await result, media.image)
  assert.equal(media.canvas.width, 640)
  assert.equal(media.canvas.height, 360)
  assert.equal(media.frames.length, 1)
  assert.deepEqual(media.revoked, ['blob:test-recording'])
  assert.equal(media.video.onloadeddata, null)
  assert.equal(media.video.src, undefined)
})

test('decode failures release the video and reject for the placeholder fallback', async t => {
  const media = mockMedia(t)
  const result = createVideoThumbnail(new Blob(['video']), new AbortController().signal)
  media.video.onerror()
  await assert.rejects(result, /could not be decoded/)
  assert.deepEqual(media.revoked, ['blob:test-recording'])
})

test('cancelling an in-flight preview releases the video URL', async t => {
  const media = mockMedia(t)
  const controller = new AbortController()
  const result = createVideoThumbnail(new Blob(['video']), controller.signal)
  controller.abort()
  await assert.rejects(result, { name: 'AbortError' })
  assert.deepEqual(media.revoked, ['blob:test-recording'])
  assert.equal(media.video.onerror, null)
})

test('an already cancelled preview allocates no video resources', async t => {
  const media = mockMedia(t)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(createVideoThumbnail(new Blob(['video']), controller.signal), { name: 'AbortError' })
  assert.equal(media.loads(), 0)
  assert.deepEqual(media.revoked, [])
})
