import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AudioLines, Mic, Square } from 'lucide-react'
import type { useGeminiLive } from '../hooks/useGeminiLive'

type VoiceOption = { id: string; name: string }
type Props = { assistant: ReturnType<typeof useGeminiLive>; accessToken: string; voiceId: string; setVoiceId: (id: string) => Promise<void>; microphoneId: string; setMicrophoneId: (id: string) => void; microphones: MediaDeviceInfo[]; refreshMicrophones: () => Promise<void> }
export function AssistantPanel({ assistant, accessToken, voiceId, setVoiceId, microphoneId, setMicrophoneId, microphones, refreshMicrophones }: Props) {
  const captionsRef = useRef<HTMLDivElement>(null)
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [defaultVoiceId, setDefaultVoiceId] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [voicesLoading, setVoicesLoading] = useState(true)
  const active = assistant.status !== 'off'
  useEffect(() => {
    const controller = new AbortController()
    setVoicesLoading(true); setVoiceError('')
    void fetch('/api/live/voices', { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
      .then(async response => {
        const data = await response.json() as { voices?: VoiceOption[]; defaultVoiceId?: string; error?: string }
        if (!response.ok) throw new Error(data.error || 'Assistant voices could not be loaded.')
        setVoices(data.voices ?? []); setDefaultVoiceId(data.defaultVoiceId ?? '')
      })
      .catch(error => { if (!controller.signal.aborted) setVoiceError(error instanceof Error ? error.message : 'Assistant voices could not be loaded.') })
      .finally(() => { if (!controller.signal.aborted) setVoicesLoading(false) })
    return () => controller.abort()
  }, [accessToken])
  useLayoutEffect(() => {
    const captions = captionsRef.current
    if (captions) captions.scrollTop = captions.scrollHeight
  }, [assistant.captions])
  return <section className="panel assistant-panel" aria-label="Visual AI assistant">
    <div className="assistant-heading"><div className="panel-title"><span className="heading-icon"><AudioLines size={20} /></span><div><h2>Ask your glasses</h2><p>Talk with Gemini about what your camera sees.</p></div></div><button className={`button ${active ? 'button-secondary' : 'button-primary'}`} onClick={() => active ? assistant.stop() : void assistant.start()}>{active ? <Square size={15} /> : <Mic size={15} />}{active ? 'End conversation' : 'Start assistant'}</button></div>
    {!active && <div className="assistant-setup"><label>Microphone<select value={microphoneId} onFocus={() => void refreshMicrophones()} onChange={event => setMicrophoneId(event.target.value)}><option value="">System default</option>{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label><label>Assistant voice<select value={voiceId || defaultVoiceId} disabled={voicesLoading || !!voiceError} onChange={event => void setVoiceId(event.target.value)}><option value="">{voicesLoading ? 'Loading voices…' : voiceError ? 'Voices unavailable' : 'Default voice'}</option>{voiceId && !voices.some(voice => voice.id === voiceId) && <option value={voiceId}>Saved voice</option>}{voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}{voice.id === defaultVoiceId ? ' · Default' : ''}</option>)}</select>{voiceError && <small>{voiceError}</small>}</label></div>}
    <div className="assistant-state" role="status"><span className={`status-dot ${active ? 'assistant-active' : ''}`} />{assistant.status === 'connecting' ? 'Connecting…' : assistant.status === 'speaking' ? 'Assistant is speaking' : assistant.status === 'listening' ? 'Listening · ask a question' : 'Assistant off'}{active && <span>{assistant.vision ? 'Camera context on' : 'Voice only · connect a camera for vision'}</span>}</div>
    {assistant.error && <p className="voice-error" role="alert">{assistant.error}</p>}
    {!!assistant.captions.length && <div ref={captionsRef} className="assistant-captions" aria-live="polite">{assistant.captions.map((caption, index) => <p key={index}><strong>{caption.role}</strong><span>{caption.text}</span></p>)}</div>}
    {!active && <p className="assistant-hint">Connect a camera, then ask “What am I looking at?” Audio and camera frames are sent to Gemini during the conversation. Keep this page open.</p>}
    {active && <p className="assistant-hint">Try “start recording,” “clip a memory,” “make a new note,” or “take lecture notes.” Say “save note” for an organized summary, or “cancel note” to discard it.</p>}
  </section>
}
