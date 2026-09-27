import test from 'node:test'
import assert from 'node:assert/strict'
import { microphoneErrorMessage, openMicrophone, supportsMicrophoneSelection } from '../src/lib/microphone.ts'

test('offers explicit speech input only on desktop Chromium with audio-track support', () => {
  assert.equal(supportsMicrophoneSelection('Mozilla/5.0 Chrome/135.0.0.0 Safari/537.36'), true)
  assert.equal(supportsMicrophoneSelection('Mozilla/5.0 Chrome/134.0.0.0 Safari/537.36'), false)
  assert.equal(supportsMicrophoneSelection('Mozilla/5.0 Version/18.0 Safari/605.1.15'), false)
  assert.equal(supportsMicrophoneSelection('Mozilla/5.0 Android Chrome/140.0.0.0 Mobile Safari/537.36'), false)
})

function mockCapture(t, getUserMedia) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor)
    else delete globalThis.navigator
  })
}

test('captures the exact chosen microphone without requesting camera access', async t => {
  const stream = {}
  mockCapture(t, async constraints => {
    assert.deepEqual(constraints, { audio: { deviceId: { exact: 'usb-mic' } }, video: false })
    return stream
  })
  assert.equal(await openMicrophone('usb-mic'), stream)
})

test('system default requests default audio without a device constraint', async t => {
  mockCapture(t, async constraints => { assert.deepEqual(constraints, { audio: true, video: false }); return {} })
  await openMicrophone('')
})

test('a missing selected microphone rejects instead of silently using another input', async t => {
  let calls = 0
  mockCapture(t, async () => { calls++; throw new DOMException('Missing input', 'OverconstrainedError') })
  await assert.rejects(openMicrophone('disconnected-mic'), { name: 'OverconstrainedError' })
  assert.equal(calls, 1)
})

test('empty browser capture exceptions still explain how to recover', () => {
  assert.match(microphoneErrorMessage(new DOMException('', 'OverconstrainedError')), /System default/)
  assert.match(microphoneErrorMessage(new DOMException('', 'NotAllowedError')), /Allow microphone access/)
  assert.match(microphoneErrorMessage(new DOMException('', 'NotReadableError')), /busy/)
  assert.ok(microphoneErrorMessage(new Error('')).length > 0)
  assert.ok(microphoneErrorMessage(undefined).length > 0)
})
