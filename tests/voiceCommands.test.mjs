import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyVoiceState, interpretSpeech } from '../src/lib/voiceCommands.ts'

test('recognizes recording and clipping commands regardless of case or end punctuation', () => {
  for (const [text, action] of [['START RECORDING!', 'record'], ['Stop recording.', 'stop-recording'], ['Clip a memory', 'clip'], ['Clip this memory!', 'clip'], ['stop listening', 'pause']]) {
    assert.equal(interpretSpeech(emptyVoiceState, text).action, action)
  }
})
test('does not activate recordings from conversational mentions', () => {
  for (const text of ['Record this message.', 'He said record this message yesterday.', 'Do not start recording', 'I want to clip a memory someday', 'new notebook']) {
    const result = interpretSpeech(emptyVoiceState, text)
    assert.equal(result.action, null)
    assert.equal(result.state.mode, 'commands')
  }
})
test('captures dictation after the command in the same utterance', () => {
  const result = interpretSpeech(emptyVoiceState, 'Make a new note, Remember to bring the charger.')
  assert.equal(result.state.draft, 'Remember to bring the charger.')
  assert.equal(result.state.mode, 'dictating')
  assert.equal(result.noteChanged, true)
})
test('combines final dictation segments and strips the finish command', () => {
  let result = interpretSpeech(emptyVoiceState, 'make a new note')
  result = interpretSpeech(result.state, 'Meet Alex tomorrow.')
  result = interpretSpeech(result.state, 'At ten in the morning. Save note.')
  assert.equal(result.noteComplete, 'Meet Alex tomorrow. At ten in the morning.')
  assert.deepEqual(result.state, emptyVoiceState)
})
test('supports creating and completing an entire note in one utterance', () => {
  const result = interpretSpeech(emptyVoiceState, 'Make a new note buy milk save note')
  assert.equal(result.noteComplete, 'buy milk')
  assert.equal(result.action, null)
})
test('keeps command-like phrases as literal note content during dictation', () => {
  const result = interpretSpeech({ mode: 'dictating', draft: 'The instruction was' }, 'stop recording')
  assert.equal(result.state.draft, 'The instruction was stop recording')
  assert.equal(result.action, null)
})
test('does not finish on a mid-sentence mention of save note', () => {
  const result = interpretSpeech({ mode: 'dictating', draft: '' }, 'The save note button should be green')
  assert.equal(result.state.draft, 'The save note button should be green')
  assert.equal(result.noteComplete, undefined)
})
test('finishing an empty note does not manufacture content', () => {
  const result = interpretSpeech({ mode: 'dictating', draft: '' }, 'save note')
  assert.equal(result.noteComplete, '')
  assert.deepEqual(result.state, emptyVoiceState)
})
test('pausing completes the current note, cancelling discards it', () => {
  const state = { mode: 'dictating', draft: 'Remember this detail.' }
  assert.equal(interpretSpeech(state, 'stop listening').noteComplete, state.draft)
  const cancelled = interpretSpeech(state, 'cancel note')
  assert.equal(cancelled.action, 'cancel-note')
  assert.equal(cancelled.noteComplete, undefined)
  assert.deepEqual(cancelled.state, emptyVoiceState)
})
test('empty speech is ignored', () => {
  assert.deepEqual(interpretSpeech(emptyVoiceState, '  ').state, emptyVoiceState)
})
