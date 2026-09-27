import { Mic } from 'lucide-react'

type Props = { assistantActive: boolean }
export function VoicePanel({ assistantActive }: Props) {
  return <section className="voice-panel" aria-label="Hands-free controls">
    <div className="voice-panel-top">
      <span className="voice-emblem"><Mic size={26} strokeWidth={1.6} /></span>
      <div className="voice-intro"><span className="voice-eyebrow">MADE FOR HANDS-FREE MOMENTS</span><h2>Just say the word.</h2><p>Capture a thought or a moment without reaching for a keyboard.</p></div>
    </div>
    <div className="voice-commands">
      <div>
        <RecordingCircle />
        <span>“Start recording”<small>Say “stop recording” to save</small></span>
      </div>
      <div>
        <Mic size={16} />
        <span>“Make a new note”<small>Dictate, then say “save note”</small></span>
      </div>
    </div>
    <div className="voice-status-row"><span className={`voice-state ${assistantActive ? 'is-listening' : ''}`}><span className="status-dot" />{assistantActive ? 'Ready for voice commands' : 'Start Ask your glasses above to use voice commands'}</span></div>
  </section>
}

function RecordingCircle() {
  return (
    <svg
      className="recording-circle-icon"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
