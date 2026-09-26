import { useState } from 'react'
import { AudioLines, Mic, Square } from 'lucide-react'
import type { useGeminiLive } from '../hooks/useGeminiLive'

type Props = { assistant: ReturnType<typeof useGeminiLive>; microphoneId: string; setMicrophoneId: (id: string) => void; microphones: MediaDeviceInfo[]; refreshMicrophones: () => Promise<void> }
export function AssistantPanel({ assistant, microphoneId, setMicrophoneId, microphones, refreshMicrophones }: Props) {
  const [accessCode, setAccessCode] = useState('')
  const active = assistant.status !== 'off'
  return <section className="panel assistant-panel" aria-label="Visual AI assistant">
    <div className="assistant-heading"><div className="panel-title"><span className="heading-icon"><AudioLines size={20} /></span><div><h2>Ask your glasses</h2><p>Talk with Gemini about what your camera sees.</p></div></div><button className={`button ${active ? 'button-secondary' : 'button-primary'}`} disabled={!active && !accessCode.trim()} onClick={() => active ? assistant.stop() : void assistant.start(accessCode)}>{active ? <Square size={15} /> : <Mic size={15} />}{active ? 'End conversation' : 'Start assistant'}</button></div>
    {!active && <div className="assistant-setup"><label>Demo access code<input type="password" autoComplete="off" value={accessCode} placeholder="Code set on your laptop" onChange={event => setAccessCode(event.target.value)} /></label><label>Microphone<select value={microphoneId} onFocus={() => void refreshMicrophones()} onChange={event => setMicrophoneId(event.target.value)}><option value="">System default</option>{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label></div>}
    <div className="assistant-state" role="status"><span className={`status-dot ${active ? 'assistant-active' : ''}`} />{assistant.status === 'connecting' ? 'Connecting…' : assistant.status === 'speaking' ? 'Assistant is speaking' : assistant.status === 'listening' ? 'Listening · ask a question' : 'Assistant off'}{active && <span>{assistant.vision ? 'Camera context on' : 'Voice only · connect a camera for vision'}</span>}</div>
    {assistant.error && <p className="voice-error" role="alert">{assistant.error}</p>}
    {!!assistant.captions.length && <div className="assistant-captions" aria-live="polite">{assistant.captions.map((caption, index) => <p key={index}><strong>{caption.role}</strong><span>{caption.text}</span></p>)}</div>}
    {!active && <p className="assistant-hint">Connect a camera, then ask “What am I looking at?” Audio and camera frames are sent to Gemini during the conversation. Keep this page open.</p>}
    {active && <p className="assistant-hint">Try “start recording,” “clip a memory,” “make a new note,” or “take lecture notes.” Say “save note” for an organized summary, or “cancel note” to discard it.</p>}
  </section>
}
