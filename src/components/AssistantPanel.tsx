import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertTriangle, AudioLines, Car, Mic, Square } from 'lucide-react'
import type { useGeminiLive } from '../hooks/useGeminiLive'
import type { AssistantMode } from '../lib/assistantMode'

type VoiceOption = { id: string; name: string }
type Props = {
  assistant: ReturnType<typeof useGeminiLive>
  accessToken: string
  voiceId: string
  setVoiceId: (id: string) => Promise<void>
  cameraConnected: boolean
  microphoneId: string
  setMicrophoneId: (id: string) => void
  microphones: MediaDeviceInfo[]
  refreshMicrophones: () => Promise<void>
}

export function AssistantPanel({ assistant, accessToken, voiceId, setVoiceId, cameraConnected, microphoneId, setMicrophoneId, microphones, refreshMicrophones }: Props) {
  const captionsRef = useRef<HTMLDivElement>(null)
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [defaultVoiceId, setDefaultVoiceId] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [voicesLoading, setVoicesLoading] = useState(true)
  const [selectedMode, setSelectedMode] = useState<AssistantMode>('general')
  const active = assistant.status !== 'off'
  const mode = active ? assistant.mode : selectedMode
  const driveMode = mode === 'drive'
  const status = assistant.status === 'connecting' ? 'Connecting…'
    : assistant.status === 'speaking' ? (driveMode ? 'Drive Mode is speaking' : 'Assistant is speaking')
      : assistant.status === 'listening' ? (driveMode ? 'Drive Mode is listening' : 'Listening · ask a question')
        : 'Assistant off'

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
    if (captionsRef.current) captionsRef.current.scrollTop = captionsRef.current.scrollHeight
  }, [assistant.captions])

  return <section className={`panel assistant-panel ${driveMode ? 'drive-assistant-panel' : ''}`} aria-label={driveMode ? 'Drive Mode assistant' : 'Visual AI assistant'}>
    <div className="assistant-heading">
      <div className="panel-title"><span className="heading-icon">{driveMode ? <Car size={20} /> : <AudioLines size={20} />}</span><div><h2>{driveMode ? 'Drive Mode' : 'Ask your glasses'}</h2><p>{driveMode ? 'Brief spoken driving guidance from your selected camera.' : 'Talk with Clarity about what your camera sees.'}</p></div></div>
      <button className={`button ${active ? 'button-secondary' : 'button-primary'}`} disabled={!active && driveMode && !cameraConnected} onClick={() => active ? assistant.stop() : void assistant.start(selectedMode)}>{active ? <Square size={15} /> : <Mic size={15} />}{active ? (driveMode ? 'End Drive Mode' : 'End conversation') : (driveMode ? 'Start Drive Mode' : 'Start assistant')}</button>
    </div>
    {!active && <div className="assistant-mode-picker" role="group" aria-label="Assistant mode">
      <button type="button" aria-pressed={selectedMode === 'general'} className={selectedMode === 'general' ? 'selected' : ''} onClick={() => setSelectedMode('general')}><AudioLines size={15} />Everyday assistant</button>
      <button type="button" aria-pressed={selectedMode === 'drive'} className={selectedMode === 'drive' ? 'selected' : ''} onClick={() => setSelectedMode('drive')}><Car size={15} />Drive Mode</button>
    </div>}
    {driveMode && <div className="drive-safety-note" role="note"><AlertTriangle size={18} /><p><strong>Assistance only.</strong> Keep your attention on the road. Camera frames arrive about once per second and may miss hazards; check your mirrors and surroundings, and make every driving decision yourself. No navigation service is connected.</p></div>}
    {!active && <div className="assistant-setup"><label>Microphone<select value={microphoneId} onFocus={() => void refreshMicrophones()} onChange={event => setMicrophoneId(event.target.value)}><option value="">System default</option>{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label>{!driveMode && <label>Assistant voice<select value={voiceId || defaultVoiceId} disabled={voicesLoading || !!voiceError} onChange={event => void setVoiceId(event.target.value)}><option value="">{voicesLoading ? 'Loading voices…' : voiceError ? 'Voices unavailable' : 'Default voice'}</option>{voiceId && !voices.some(voice => voice.id === voiceId) && <option value={voiceId}>Saved voice</option>}{voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}{voice.id === defaultVoiceId ? ' · Default' : ''}</option>)}</select>{voiceError && <small>{voiceError}</small>}</label>}</div>}
    <div className="assistant-state" role="status"><span className={`status-dot ${active ? 'assistant-active' : ''}`} />{status}{active && <span>{assistant.vision ? 'Camera context on' : driveMode ? 'Camera unavailable · reconnect before relying on Drive Mode' : 'Voice only · connect a camera for vision'}</span>}</div>
    {driveMode && !cameraConnected && !active && <p className="drive-camera-requirement">Connect the forward-facing camera in the Camera panel before starting Drive Mode.</p>}
    {assistant.error && <p className="voice-error" role="alert">{assistant.error}</p>}
    {!driveMode && !!assistant.captions.length && <div ref={captionsRef} className="assistant-captions" aria-live="polite">{assistant.captions.map((caption, index) => <p key={index}><strong>{caption.role}</strong><span>{caption.text}</span></p>)}</div>}
    {!active && <p className="assistant-hint">{driveMode ? 'Voice only while driving. Forward camera required. In a collision or incident, say “I had an accident” for State Farm claims co-pilot.' : 'Connect a camera, then ask “What am I looking at?” Audio and camera frames are sent to Clarity during the conversation. Keep this page open.'}</p>}
    {active && !driveMode && <p className="assistant-hint">Try “start recording,” “make a new note,” or say “I was in an accident” for State Farm claim co-pilot.</p>}
  </section>
}
