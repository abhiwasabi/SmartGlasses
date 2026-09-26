import { useState } from 'react'
import { AudioLines, Check, Copy, Mic, MicOff, Radio, Square } from 'lucide-react'
import type { useVoiceControl } from '../hooks/useVoiceControl'

type Props = { voice: ReturnType<typeof useVoiceControl>; clipSeconds: number | null; microphoneLocked?: boolean }
export function VoicePanel({ voice, clipSeconds, microphoneLocked = false }: Props) {
  const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const active = voice.status !== 'off'
  const [copyStatus, setCopyStatus] = useState('')
  const needsBrowserHelp = !voice.supported || ['network', 'service-not-allowed', 'unsupported'].includes(voice.errorCode ?? '')
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyStatus('Copied. Paste the link into Chrome’s address bar.')
    } catch {
      setCopyStatus('Copy the address above and paste it into Chrome’s address bar.')
    }
  }
  return <section className={`voice-panel ${active ? 'voice-enabled' : ''}`} aria-label="Hands-free controls">
    <div className="voice-panel-top">
      <span className="voice-emblem"><AudioLines size={26} strokeWidth={1.6} /></span>
      <div className="voice-intro"><span className="voice-eyebrow">MADE FOR HANDS-FREE MOMENTS</span><h2>{voice.mode === 'dictating' ? 'Your words, remembered.' : 'Just say the word.'}</h2><p>{voice.mode === 'dictating' ? 'Speak naturally. Your note saves as you go.' : 'Capture a thought or a moment without reaching for a keyboard.'}</p></div>
      <button className={`button ${active ? 'button-secondary' : 'button-primary'}`} onClick={active ? voice.stop : voice.start}>{active ? <MicOff size={15} /> : <Mic size={15} />}{active ? 'Pause microphone' : 'Enable voice'}</button>
    </div>
    <div className="microphone-controls"><label htmlFor="voice-microphone"><Mic size={15} />Microphone</label><select id="voice-microphone" value={voice.microphoneId} onFocus={() => void voice.refreshMicrophones()} disabled={active || microphoneLocked} onChange={event => voice.setMicrophoneId(event.target.value)}><option value="">System default</option>{voice.microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId} disabled={!voice.canSelectMicrophone}>{device.label || `Microphone ${index + 1}`}</option>)}{voice.microphoneId && !voice.microphones.some(device => device.deviceId === voice.microphoneId) && <option value={voice.microphoneId}>Previously selected microphone (unavailable)</option>}</select>{!voice.canSelectMicrophone && <p className="microphone-hint">{ /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Safari uses your iPhone’s default microphone.' : 'This browser uses your system default microphone. Choose a specific input in desktop Chrome.' }</p>}{(active || microphoneLocked) && <p className="microphone-hint">{microphoneLocked ? 'End the assistant conversation to change microphones.' : 'Pause voice to change microphones.'}</p>}{voice.microphoneError && <p className="voice-error" role="alert">{voice.microphoneError}</p>}</div>
    <div className="voice-commands"><div><VideoMark /><span>“Record this message”<small>Say “stop recording” to save</small></span></div><div><Mic size={16} /><span>“Make a new note”<small>Dictate, then say “save note”</small></span></div><div><Radio size={16} /><span>“Clip a memory”<small>Save the next 30 seconds</small></span></div></div>
    <div className="voice-status-row"><span className={`voice-state ${voice.status === 'listening' ? 'is-listening' : ''}`}><span className="status-dot" />{!voice.supported ? 'Voice unavailable in this browser' : voice.status === 'starting' ? 'Connecting microphone…' : voice.status === 'listening' ? voice.mode === 'dictating' ? 'Taking a note' : 'Listening for commands' : 'Microphone off'}</span>{clipSeconds !== null && <span className="voice-clip-countdown"><span className="record-dot" />Clipping · {clipSeconds}s remaining</span>}<span className="voice-feedback" role="status">{active ? voice.feedback : voice.microphoneId ? (voice.microphones.find(device => device.deviceId === voice.microphoneId)?.label || 'Selected microphone') : 'Uses your system default microphone'}</span></div>
    {(active || voice.error || !voice.supported) && <div className="voice-live-area">{voice.error || !voice.supported ? <div className="voice-recovery"><p className="voice-error" role="alert">{voice.error ?? 'This preview does not support speech recognition. Open the dashboard in Chrome, then enable voice.'}</p>{!isIPhone && needsBrowserHelp && <><p className="voice-recovery-hint">Open this address in Chrome, select Enable voice, and allow microphone access. Notes and recordings stay in the browser where you created them.</p><input className="voice-dashboard-address" aria-label="Dashboard address for Chrome" readOnly value={window.location.href} onFocus={event => event.currentTarget.select()} /><button className="button button-secondary" onClick={() => void copyLink()}><Copy size={14} />Copy dashboard link</button><p className="voice-copy-status" role="status">{copyStatus}</p></>}{voice.supported && <button className="button button-secondary" onClick={voice.start}><Mic size={14} />Try again</button>}</div> : <><p className="voice-transcript">{voice.mode === 'dictating' ? voice.draft || 'Your note will appear as you speak…' : voice.lastHeard ? `Heard: “${voice.lastHeard}”` : 'Ready when you are…'}{voice.interim && <span className="interim-transcript"> {voice.interim}</span>}</p>{voice.mode === 'dictating' && <button className="button button-secondary" onClick={voice.finishNote}><Check size={14} />Finish note</button>}</>}</div>}
    {!active && <p className="voice-permission-note">Enable once, then use voice commands while this page stays open. Your browser may process speech online.</p>}
  </section>
}
function VideoMark() { return <Square size={15} strokeWidth={1.6} /> }
