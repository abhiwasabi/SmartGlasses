import { useCallback, useEffect, useRef, useState } from 'react'
import { openMicrophone, supportsMicrophoneSelection } from '../lib/microphone'
import { useLocalState } from './useLocalState'
import { emptyVoiceState, interpretSpeech } from '../lib/voiceCommands'
import type { VoiceAction, VoiceState } from '../lib/voiceCommands'

type RecognitionResult = { isFinal: boolean; [index: number]: { transcript: string } }
type RecognitionEvent = { resultIndex: number; results: { length: number; [index: number]: RecognitionResult } }
interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: RecognitionEvent) => void) | null
  start(audioTrack?: MediaStreamTrack): void; stop(): void; abort(): void
}
type RecognitionConstructor = new () => Recognition
const getRecognition = () => {
  const browser = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}
type Options = {
  onAction: (action: Exclude<VoiceAction, null>) => void
  onNote: (text: string, finished: boolean) => void
  onCancelNote: () => void
}

export function useVoiceControl(options: Options) {
  const [microphoneId, setMicrophoneId] = useLocalState('clarity-microphone-v1', '', (value: unknown): value is string => typeof value === 'string')
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([])
  const [microphoneError, setMicrophoneError] = useState<string | null>(null)
  const canSelectMicrophone = supportsMicrophoneSelection(navigator.userAgent) && !!navigator.mediaDevices?.getUserMedia
  const inputStreamRef = useRef<MediaStream | null>(null)
  const [supported] = useState(() => typeof window !== 'undefined' && !!getRecognition())
  const [status, setStatus] = useState<'off' | 'starting' | 'listening'>('off')
  const [state, setState] = useState<VoiceState>(emptyVoiceState)
  const [interim, setInterim] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [feedback, setFeedback] = useState('Enable your microphone, then speak a command.')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const optionsRef = useRef(options)
  const stateRef = useRef<VoiceState>(emptyVoiceState)
  const recognitionRef = useRef<Recognition | null>(null)
  const wantedRef = useRef(false)
  const restartRef = useRef<number | undefined>(undefined)
  const watchdogRef = useRef<number | undefined>(undefined)
  const audioRef = useRef<AudioContext | null>(null)
  useEffect(() => { optionsRef.current = options }, [options])

  const refreshMicrophones = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMicrophoneError(null)
      setMicrophones(devices.filter(device => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default' && device.deviceId !== 'communications'))
    } catch { setMicrophoneError('Microphones could not be listed. Check browser permissions.') }
  }, [])

  useEffect(() => {
    void refreshMicrophones()
    const devices = navigator.mediaDevices
    devices?.addEventListener('devicechange', refreshMicrophones)
    window.addEventListener('focus', refreshMicrophones)
    let disposed = false
    let permission: PermissionStatus | undefined
    if (navigator.permissions?.query) {
      void navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
        if (disposed) return
        permission = result
        permission.addEventListener('change', refreshMicrophones)
      }).catch(() => { /* Some browsers do not expose microphone permission status. */ })
    }
    return () => {
      disposed = true
      devices?.removeEventListener('devicechange', refreshMicrophones)
      window.removeEventListener('focus', refreshMicrophones)
      permission?.removeEventListener('change', refreshMicrophones)
    }
  }, [refreshMicrophones])

  const chime = useCallback(() => {
    const audio = audioRef.current
    if (!audio || audio.state !== 'running') return
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.connect(gain); gain.connect(audio.destination)
    oscillator.frequency.value = 740
    gain.gain.setValueAtTime(0.035, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.13)
    oscillator.start(); oscillator.stop(audio.currentTime + 0.14)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }, [])

  const finishNote = useCallback(() => {
    const draft = stateRef.current.draft
    if (draft.trim()) optionsRef.current.onNote(draft, true)
    stateRef.current = emptyVoiceState; setState(emptyVoiceState); setInterim('')
    setFeedback(draft ? 'Note saved. Ready for your next command.' : 'No words captured yet.')
    if (draft) chime()
  }, [chime])

  const stop = useCallback(() => {
    wantedRef.current = false
    window.clearTimeout(restartRef.current); window.clearTimeout(watchdogRef.current)
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      recognition.onstart = null; recognition.onend = null; recognition.onresult = null; recognition.onerror = null
      recognition.abort()
    }
    inputStreamRef.current?.getTracks().forEach(track => track.stop())
    inputStreamRef.current = null
    if (stateRef.current.mode === 'dictating') finishNote()
    setStatus('off'); setInterim(''); setFeedback('Microphone paused. Your saved content stays here.')
  }, [finishNote])

  const start = useCallback(() => {
    if (wantedRef.current) return true
    const Constructor = getRecognition()
    if (!Constructor) { setErrorCode('unsupported'); setError('Voice recognition is unavailable in this browser. Open this dashboard in Chrome or another browser with speech recognition.'); return false }
    if (microphoneId && !canSelectMicrophone) { setError('Choose System default, or open this dashboard in desktop Chrome to use a specific microphone.'); return false }
    try {
      // Unlock a short acknowledgement tone only after an explicit user gesture.
      if (typeof AudioContext !== 'undefined') {
        audioRef.current ??= new AudioContext()
        void audioRef.current.resume().catch(() => {})
      }
    } catch { /* Voice still works without acknowledgement tones. */ }
    setError(null); setErrorCode(null); setStatus('starting'); wantedRef.current = true
    let recognition: Recognition
    try { recognition = new Constructor() } catch { wantedRef.current = false; setStatus('off'); setError('This browser could not initialize its speech service. Try a supported browser.'); return false }
    recognitionRef.current = recognition
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US'; recognition.maxAlternatives = 1
    let finalized = new Set<number>()
    let emptyRestarts = 0
    let sessionStartedAt = 0
    const active = () => wantedRef.current && recognitionRef.current === recognition
    const fail = (message: string) => {
      if (recognitionRef.current !== recognition) return
      setError(message); stop()
    }
    const armWatchdog = () => {
      window.clearTimeout(watchdogRef.current)
      watchdogRef.current = window.setTimeout(() => fail('The speech service did not start. Check microphone permission and try a supported browser.'), 15000)
    }
    recognition.onstart = () => {
      if (!active()) { recognition.abort(); return }
      sessionStartedAt = Date.now(); window.clearTimeout(watchdogRef.current); finalized = new Set<number>(); setStatus('listening')
      void refreshMicrophones()
      setFeedback(stateRef.current.mode === 'dictating' ? 'Speak your note, then say “save note”.' : 'Listening for your next command.')
    }
    recognition.onresult = (event) => {
      if (!active()) return
      emptyRestarts = 0
      const partial: string[] = []
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (!active()) break
        const result = event.results[index]
        const text = result[0]?.transcript?.trim() ?? ''
        if (!result.isFinal) { partial.push(text); continue }
        if (finalized.has(index)) continue
        finalized.add(index)
        setLastHeard(text)
        const next = interpretSpeech(stateRef.current, text)
        stateRef.current = next.state; setState(next.state); setFeedback(next.feedback)
        if (next.noteChanged && next.state.draft) optionsRef.current.onNote(next.state.draft, false)
        if (next.noteComplete !== undefined) { if (next.noteComplete) optionsRef.current.onNote(next.noteComplete, true); chime() }
        if (next.action === 'cancel-note') optionsRef.current.onCancelNote()
        else if (next.action === 'pause') stop()
        else if (next.action) optionsRef.current.onAction(next.action)
        if (next.action || next.state.mode === 'dictating' && !next.noteChanged) chime()
      }
      setInterim(active() ? partial.join(' ') : '')
    }
    recognition.onerror = ({ error: code }) => {
      if (!active()) return
      if (code === 'no-speech') return // onend restarts after ordinary silence.
      const errors: Record<string, string> = {
        'not-allowed': 'Microphone access was denied. Allow it in browser settings, then enable voice again.',
        'service-not-allowed': 'This browser cannot access its speech-recognition service. Open this dashboard in Chrome and allow microphone access.',
        'audio-capture': 'No microphone is available. Connect or enable a microphone, then try again.',
        network: navigator.onLine ? /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Safari could not connect to its speech-recognition service. Check your internet connection and Safari microphone permission, then try again.' : 'This browser could not connect to its speech-recognition service. Embedded previews may not support that service. Try this dashboard in Chrome.' : 'Speech recognition needs an internet connection. Reconnect, then try again.',
        'language-not-supported': 'English speech recognition is not available in this browser.',
        aborted: 'Voice recognition was interrupted. Enable voice to try again.',
      }
      setErrorCode(code)
      fail(errors[code] ?? 'Speech recognition stopped unexpectedly. Enable voice to try again.')
    }
    const startRecognition = () => {
      const track = inputStreamRef.current?.getAudioTracks()[0]
      if (microphoneId && (!track || track.readyState !== 'live')) { fail('The selected microphone disconnected. Choose another microphone and enable voice again.'); return }
      armWatchdog()
      if (track) recognition.start(track)
      else recognition.start()
    }
    recognition.onend = () => {
      if (!active()) return
      setInterim(''); setStatus('starting')
      if (Date.now() - sessionStartedAt > 10000) emptyRestarts = 0
      emptyRestarts += 1
      if (emptyRestarts > 8) { fail('The speech service keeps disconnecting. Enable voice again when your microphone and connection are ready.'); return }
      restartRef.current = window.setTimeout(() => {
        if (!active()) return
        try { startRecognition() } catch { fail('The microphone could not restart. Enable voice to try again.') }
      }, Math.min(300 * emptyRestarts, 2000))
    }
    if (microphoneId) {
      void openMicrophone(microphoneId).then(stream => {
        if (!active()) { stream.getTracks().forEach(track => track.stop()); return }
        inputStreamRef.current = stream
        const track = stream.getAudioTracks()[0]
        if (track) track.onended = () => { if (active()) fail('The selected microphone disconnected. Choose another microphone and enable voice again.') }
        void refreshMicrophones()
        try { startRecognition() } catch { fail('Speech recognition could not use the selected microphone. Try desktop Chrome or choose System default.') }
      }).catch(error => {
        if (!active()) return
        const denied = error instanceof DOMException && error.name === 'NotAllowedError'
        setErrorCode(denied ? 'not-allowed' : 'audio-capture')
        fail(denied ? 'Microphone access was denied. Allow it in browser settings, then enable voice again.' : 'The selected microphone is unavailable. Connect it or choose another microphone.')
      })
      return true
    }
    try { startRecognition(); return true }
    catch { fail('Voice recognition could not start. Check microphone access and try again.'); return false }
  }, [chime, stop, microphoneId, canSelectMicrophone, refreshMicrophones])

  const beginNote = useCallback(() => {
    if (!start()) return
    if (stateRef.current.mode === 'dictating') return
    stateRef.current = { mode: 'dictating', draft: '' }; setState(stateRef.current); setInterim('')
    setFeedback('Speak your note, then say “save note”.')
  }, [start])

  useEffect(() => () => {
    wantedRef.current = false; window.clearTimeout(restartRef.current); window.clearTimeout(watchdogRef.current)
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) { recognition.onstart = null; recognition.onend = null; recognition.onresult = null; recognition.onerror = null; recognition.abort() }
    inputStreamRef.current?.getTracks().forEach(track => track.stop())
    inputStreamRef.current = null
    if (audioRef.current) { void audioRef.current.close().catch(() => {}); audioRef.current = null }
  }, [])

  return { microphones, microphoneId, setMicrophoneId, microphoneError, canSelectMicrophone, refreshMicrophones, supported, status, mode: state.mode, draft: state.draft, interim, lastHeard, feedback, error, errorCode, start, stop, beginNote, finishNote }
}
