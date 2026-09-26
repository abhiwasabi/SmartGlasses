import test from 'node:test'
import assert from 'node:assert/strict'
import { makeRecentWebmClip, repairWebmDuration, webmInitializationSegment } from '../src/lib/webmClip.ts'

const vintSize = size => Uint8Array.of(0x80 | size)
const element = (id, payload = new Uint8Array()) => Uint8Array.from([...id, ...vintSize(payload.length), ...payload])
const cluster = (timecode, keyframe = false) => element([0x1f, 0x43, 0xb6, 0x75], Uint8Array.of(
  0xe7, 0x82, (timecode >> 8) & 0xff, timecode & 0xff,
  0xa3, 0x85, 0x81, 0x00, 0x00, keyframe ? 0x80 : 0x00, 0x00,
))
const concat = (...parts) => Uint8Array.from(parts.flatMap(part => [...part]))
const initialization = concat(
  element([0x1a, 0x45, 0xdf, 0xa3]),
  [0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
  element([0x15, 0x49, 0xa9, 0x66]),
  element([0x16, 0x54, 0xae, 0x6b]),
)

function clusterTimes(bytes) {
  const values = []
  for (let index = 0; index < bytes.length - 7; index++) {
    if (bytes[index] === 0x1f && bytes[index + 1] === 0x43 && bytes[index + 2] === 0xb6 && bytes[index + 3] === 0x75) {
      const sizeLength = (bytes[index + 4] & 0x80) ? 1 : 0
      const timecodeStart = index + 4 + sizeLength + 2
      values.push((bytes[timecodeStart] << 8) | bytes[timecodeStart + 1])
    }
  }
  return values
}

function webmDuration(bytes) {
  for (let index = 0; index < bytes.length - 10; index++) {
    if (bytes[index] === 0x44 && bytes[index + 1] === 0x89 && bytes[index + 2] === 0x88) {
      return new DataView(bytes.buffer, bytes.byteOffset + index + 3, 8).getFloat64(0, false)
    }
  }
  return null
}

test('assembles the most recent 30 seconds and rebases WebM timestamps', async () => {
  const initialEvent = concat(initialization, cluster(0))
  assert.deepEqual(webmInitializationSegment(initialEvent), initialization)

  const data = [cluster(0), ...Array.from({ length: 32 }, (_, index) => cluster((index + 1) * 1000))]
  const clip = await makeRecentWebmClip(initialization, [new Blob(data)], 30_000)

  assert.ok(clip)
  assert.equal(clip.duration, 30)
  assert.equal(clip.blob.type, 'video/webm')
  const bytes = new Uint8Array(await clip.blob.arrayBuffer())
  assert.equal(webmDuration(bytes), 30_000)
  assert.deepEqual(clusterTimes(bytes), Array.from({ length: 31 }, (_, index) => index * 1000))
})

test('repairs duration metadata on an already saved WebM memory', async () => {
  const original = new Blob([initialization, cluster(0)], { type: 'video/webm' })
  const repaired = await repairWebmDuration(original, 30)

  assert.notEqual(repaired, original)
  assert.equal(webmDuration(new Uint8Array(await repaired.arrayBuffer())), 30_000)
})

test('starts a recent clip on the first decodable keyframe', async () => {
  const data = [cluster(0, true), cluster(1000), cluster(2000), cluster(3000, true), cluster(4000), cluster(5000)]
  const clip = await makeRecentWebmClip(initialization, [new Blob(data)], 3000)

  assert.ok(clip)
  assert.equal(clip.duration, 2)
  assert.deepEqual(clusterTimes(new Uint8Array(await clip.blob.arrayBuffer())), [0, 1000, 2000])
})

test('returns null when buffered data has no complete WebM clusters', async () => {
  assert.equal(await makeRecentWebmClip(initialization, [new Blob([new Uint8Array([0, 1, 2])])]), null)
})
