import { Mic, Radio, Square } from 'lucide-react'

type Props = { assistantActive: boolean; clipSeconds: number | null }
export function VoicePanel({ assistantActive, clipSeconds }: Props) {
  return <section className="voice-panel" aria-label="Hands-free controls">
    <div className="voice-panel-top">
      <span className="voice-emblem"><Mic size={26} strokeWidth={1.6} /></span>
      <div className="voice-intro"><span className="voice-eyebrow">MADE FOR HANDS-FREE MOMENTS</span><h2>Just say the word.</h2><p>Capture a thought or a moment without reaching for a keyboard.</p></div>
    </div>
    <div className="voice-commands"><div><VideoMark /><span>“Start recording”<small>Say “stop recording” to save</small></span></div><div><Mic size={16} /><span>“Make a new note”<small>Dictate, then say “save note”</small></span></div><div><Radio size={16} /><span>“Clip a memory”<small>Save the previous 15 seconds</small></span></div></div>
    <div className="voice-status-row"><span className={`voice-state ${assistantActive ? 'is-listening' : ''}`}><span className="status-dot" />{assistantActive ? 'Ready for voice commands' : 'Start Ask your glasses above to use voice commands'}</span>{clipSeconds !== null && <span className="voice-clip-countdown"><span className="record-dot" />Clipping · {clipSeconds}s remaining</span>}</div>
  </section>
}
function VideoMark() { return <Square size={15} strokeWidth={1.6} /> }
