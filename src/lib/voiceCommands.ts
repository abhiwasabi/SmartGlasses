export type VoiceAction = 'record' | 'stop-recording' | 'clip' | 'pause' | 'cancel-note' | null
export type VoiceState = { mode: 'commands' | 'dictating'; draft: string }
export type VoiceResult = { state: VoiceState; action: VoiceAction; feedback: string; noteChanged?: boolean; noteComplete?: string }
export const emptyVoiceState: VoiceState = { mode: 'commands', draft: '' }

function normalized(text: string) { return text.toLowerCase().replace(/[.,!?;:]+$/g, '').trim() }
const exactCommands: Record<string, VoiceAction> = {
  'start recording': 'record',
  'stop recording': 'stop-recording', 'stop the recording': 'stop-recording', 'save recording': 'stop-recording',
  'clip a memory': 'clip', 'clip this memory': 'clip', 'clip this': 'clip', 'clip that': 'clip',
  'stop listening': 'pause', 'pause listening': 'pause', 'pause voice': 'pause',
}

/** Interpret final speech only. Ordinary sentences never trigger embedded commands. */
export function interpretSpeech(state: VoiceState, transcript: string): VoiceResult {
  const text = transcript.trim()
  const command = normalized(text)
  if (!text) return { state, action: null, feedback: '' }
  if (state.mode === 'dictating') {
    if (command === 'cancel note' || command === 'discard note') {
      return { state: emptyVoiceState, action: 'cancel-note', feedback: 'Note discarded.' }
    }
    if (command === 'stop listening' || command === 'pause listening' || command === 'pause voice') {
      return { state: emptyVoiceState, action: 'pause', noteComplete: state.draft, feedback: 'Microphone paused.' }
    }
    // Only a trailing finish phrase closes a note; earlier mentions remain content.
    const finish = text.match(/(?:^|\s)(?:save (?:my |this )?note|finish (?:the )?note|end note)[.!?,]*\s*$/i)
    const body = finish ? text.slice(0, finish.index).trim() : text
    const draft = [state.draft, body].filter(Boolean).join(' ')
    if (finish) return { state: emptyVoiceState, action: null, noteComplete: draft, feedback: draft ? 'Note saved.' : 'No words captured. Say “make a new note” to try again.' }
    // While dictating, recording commands are note content to avoid accidental actions.
    return { state: { mode: 'dictating', draft }, action: null, noteChanged: true, feedback: 'Taking your note. Say “save note” when finished.' }
  }
  const noteStart = text.match(/^(?:make (?:a )?(?:new )?note|create (?:a )?(?:new )?note|take a note|new note)\b[\s,:.!-]*/i)
  if (noteStart) {
    const remainder = text.slice(noteStart[0].length).trim()
    if (remainder) return interpretSpeech({ mode: 'dictating', draft: '' }, remainder)
    return { state: { mode: 'dictating', draft: '' }, action: null, feedback: 'Taking your note. Speak naturally, then say “save note”.' }
  }
  const action = exactCommands[command]
  if (action) return { state, action, feedback: action === 'pause' ? 'Microphone paused.' : 'Command received.' }
  return { state, action: null, feedback: 'Try “start recording”, “make a new note”, or “clip a memory”.' }
}
