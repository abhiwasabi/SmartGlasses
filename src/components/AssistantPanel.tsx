import { useState } from 'react'
import { AlertTriangle, AudioLines, Car, Mic, Square } from 'lucide-react'
import type { useGeminiLive } from '../hooks/useGeminiLive'
import type { AssistantMode } from '../lib/assistantMode'

type Props = {
  assistant: ReturnType<typeof useGeminiLive>
  microphoneId: string
  setMicrophoneId: (id: string) => void
  microphones: MediaDeviceInfo[]
  refreshMicrophones: () => Promise<void>
  cameraConnected: boolean
}

export function AssistantPanel({ assistant, microphoneId, setMicrophoneId, microphones, refreshMicrophones, cameraConnected }: Props) {
  const [accessCode, setAccessCode] = useState('')
  const [selectedMode, setSelectedMode] = useState<AssistantMode>('general')
  const active = assistant.status !== 'off'
  const mode = active ? assistant.mode : selectedMode
  const driveMode = mode === 'drive'
  const canStart = !!accessCode.trim() && (!driveMode || cameraConnected)
  const status = assistant.status === 'connecting' ? 'Connecting…'
    : assistant.status === 'speaking' ? (driveMode ? 'Drive Mode is speaking' : 'Assistant is speaking')
      : assistant.status === 'listening' ? (driveMode ? 'Drive Mode is listening' : 'Listening · ask a question')
        : 'Assistant off'

  return <section className={`panel assistant-panel ${driveMode ? 'drive-assistant-panel' : ''}`} aria-label={driveMode ? 'Drive Mode assistant' : 'Visual AI assistant'}>
    <div className="assistant-heading">
      <div className="panel-title"><span className="heading-icon">{driveMode ? <Car size={20} /> : <AudioLines size={20} />}</span><div><h2>{driveMode ? 'Drive Mode' : 'Ask your glasses'}</h2><p>{driveMode ? 'Brief spoken driving guidance from your selected camera.' : 'Talk with Gemini about what your camera sees.'}</p></div></div>
      <button className={`button ${active ? 'button-secondary' : 'button-primary'}`} disabled={!active && !canStart} onClick={() => active ? assistant.stop() : void assistant.start(accessCode, selectedMode)}>{active ? <Square size={15} /> : <Mic size={15} />}{active ? (driveMode ? 'End Drive Mode' : 'End conversation') : (driveMode ? 'Start Drive Mode' : 'Start assistant')}</button>
    </div>
    {!active && <div className="assistant-mode-picker" role="group" aria-label="Assistant mode">
      <button type="button" aria-pressed={selectedMode === 'general'} className={selectedMode === 'general' ? 'selected' : ''} onClick={() => setSelectedMode('general')}><AudioLines size={15} />Everyday assistant</button>
      <button type="button" aria-pressed={selectedMode === 'drive'} className={selectedMode === 'drive' ? 'selected' : ''} onClick={() => setSelectedMode('drive')}><Car size={15} />Drive Mode</button>
    </div>}
    {driveMode && <div className="drive-safety-note" role="note"><AlertTriangle size={18} /><p><strong>Assistance only.</strong> Keep your attention on the road. Camera frames arrive about once per second and may miss hazards; check your mirrors and surroundings, and make every driving decision yourself. No navigation service is connected.</p></div>}
    {!active && <div className="assistant-setup"><label>Demo access code<input type="password" autoComplete="off" value={accessCode} placeholder="Code set on your laptop" onChange={event => setAccessCode(event.target.value)} /></label><label>Microphone<select value={microphoneId} onFocus={() => void refreshMicrophones()} onChange={event => setMicrophoneId(event.target.value)}><option value="">System default</option>{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label></div>}
    <div className="assistant-state" role="status"><span className={`status-dot ${active ? 'assistant-active' : ''}`} />{status}{active && <span>{assistant.vision ? 'Camera context on' : driveMode ? 'Camera unavailable · reconnect before relying on Drive Mode' : 'Voice only · connect a camera for vision'}</span>}</div>
    {driveMode && !cameraConnected && !active && <p className="drive-camera-requirement">Connect the forward-facing camera in the Camera panel before starting Drive Mode.</p>}
    {assistant.error && <p className="voice-error" role="alert">{assistant.error}</p>}
    {!driveMode && !!assistant.captions.length && <div className="assistant-captions" aria-live="polite">{assistant.captions.map((caption, index) => <p key={index}><strong>{caption.role}</strong><span>{caption.text}</span></p>)}</div>}
    {!active && <p className="assistant-hint">{driveMode ? 'Voice only while driving. Use a forward-facing camera. Gemini receives microphone audio and camera frames during the session.' : 'Connect a camera, then ask “What am I looking at?” Audio and camera frames are sent to Gemini during the conversation. Keep this page open.'}</p>}
    {active && !driveMode && <p className="assistant-hint">Try “start recording,” “clip a memory,” “make a new note,” or “take lecture notes.” Say “save note” for an organized summary, or “cancel note” to discard it.</p>}
  </section>
}
