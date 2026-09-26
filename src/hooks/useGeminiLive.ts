import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session, LiveServerMessage } from '@google/genai'
import { encodePcm, decodePcm } from '../lib/liveAudio'
import { LIVE_TOOLS } from '../lib/liveTools'

type Status = 'off' | 'connecting' | 'listening' | 'speaking'
type Caption = { role: 'You' | 'Assistant'; text: string }
type LiveActions = {
  onCommand: (command: string) => string
  onNote: (text: string, finished: boolean, title?: string) => void
  onCancelNote: () => void
  onNoteMode: (active: boolean) => void
}
export function useGeminiLive(cameraStream: MediaStream | null, microphoneId: string, accessToken: string, voiceId: string, beforeStart: () => void, actions: LiveActions) {
  const [status, setStatus] = useState<Status>('off')
  const [error, setError] = useState('')
  const [captions, setCaptions] = useState<Caption[]>([])
  const [vision, setVision] = useState(false)
  const generation = useRef(0)
  const cleanup = useRef<(() => void) | null>(null)
  const camera = useRef(cameraStream)
  camera.current = cameraStream
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const starting = useRef(false)

  const stop = useCallback(() => {
    generation.current++
    starting.current = false
    cleanup.current?.()
    cleanup.current = null
    setStatus('off'); setVision(false)
  }, [])

  const start = useCallback(async () => {
    if (starting.current) return
    stop()
    beforeStart()
    const run = ++generation.current
    starting.current = true
    setError(''); setCaptions([]); setStatus('connecting')
    let session: Session | undefined
    let mic: MediaStream | undefined
    let capture: AudioWorkletNode | undefined
    let source: MediaStreamAudioSourceNode | undefined
    let frameTimer: number | undefined
    let durationTimer: number | undefined
    let video: HTMLVideoElement | undefined
    let context: AudioContext
    try { context = new AudioContext() }
    catch { stop(); setError('Live audio is unavailable in this browser. Use current Safari or Chrome.'); return }
    const tokenRequest = new AbortController()
    const speakers = new Set<AudioBufferSourceNode>()
    let nextAudioTime = 0
    let elevenLabs = false
    let assistantNoteActive = false
    let assistantNoteDraft = ''
    let transcriptBeforeTools = ''
    let replyText = ''
    let speechGeneration = 0
    let speechQueue = Promise.resolve()
    const speechRequests = new Set<AbortController>()
    let releaseDone = false
    const clearSpeaker = () => {
      speechGeneration++
      for (const request of speechRequests) request.abort()
      speechRequests.clear()
      replyText = ''
      for (const node of speakers) { node.onended = null; try { node.stop() } catch { /* Already ended. */ } node.disconnect() }
      speakers.clear(); nextAudioTime = 0
    }
    const release = () => {
      if (releaseDone) return
      releaseDone = true
      if (assistantNoteActive && assistantNoteDraft.trim()) {
        actionsRef.current.onNote(finishNoteText(assistantNoteDraft), true)
        assistantNoteActive = false
        assistantNoteDraft = ''
        actionsRef.current.onNoteMode(false)
      }
      tokenRequest.abort()
      window.clearInterval(frameTimer); window.clearTimeout(durationTimer)
      capture?.disconnect(); source?.disconnect()
      if (capture) capture.port.onmessage = null
      mic?.getTracks().forEach(track => track.stop())
      clearSpeaker()
      if (video) { video.pause(); video.srcObject = null; video.remove() }
      session?.close()
      void context.close().catch(() => {})
    }
    cleanup.current = release
    const current = () => run === generation.current && !releaseDone
    const fail = (message: string) => { if (current()) { stop(); setError(message) } }
    const addCaption = (role: Caption['role'], text: string) => {
      setCaptions(previous => {
        const last = previous.at(-1)
        return last?.role === role
          ? [...previous.slice(0, -1), { role, text: (last.text + text).slice(-4000) }]
          : [...previous.slice(-11), { role, text }]
      })
    }
    const startNoteText = (text: string) => text
      .replace(/^\s*(?:(?:all\s+right|alright|okay|ok|sure|yes|hey)[,!.?\s]+)*(?:(?:can|could|would)\s+you\s+)?(?:i\s+want\s+to\s+)?(?:please\s+)?(?:make|create|start)\s+(?:me\s+)?(?:a\s+)?new\s+note(?:\s+for\s+me)?[,:.!?\s]*/i, '')
      .replace(/^\s*(?:(?:all\s+right|alright|okay|ok|sure|yes|hey)[,!.?\s]+)*(?:(?:can|could|would)\s+you\s+)?(?:i\s+want\s+to\s+)?(?:please\s+)?(?:take|start)\s+(?:some\s+)?(?:lecture\s+)?notes?\b[,:.!?\s]*/i, '')
      .replace(/\s+(?:save|finish)\s+(?:the\s+)?note[.!?]*\s*$/i, '').trim()
    const finishNoteText = (text: string) => text.replace(/\s+(?:save|finish)\s+(?:the\s+)?note[.!?]*\s*$/i, '').trim()
    const handleToolCalls = (message: LiveServerMessage) => {
      const calls = message.toolCall?.functionCalls
      if (!calls?.length || !session) return
      const functionResponses = calls.map(call => {
        let result: string
        switch (call.name) {
          case 'start_recording':
          case 'stop_recording':
          case 'clip_memory':
            result = actionsRef.current.onCommand(call.name)
            break
          case 'start_note':
            assistantNoteActive = true
            assistantNoteDraft = startNoteText(transcriptBeforeTools)
            transcriptBeforeTools = ''
            if (assistantNoteDraft) actionsRef.current.onNote(assistantNoteDraft, false)
            actionsRef.current.onNoteMode(true)
            result = 'Note capture started. Confirm to the user. Keep collecting the spoken content and summarize it when the user asks to save.'
            break
          case 'save_note': {
            const transcript = finishNoteText(assistantNoteActive ? assistantNoteDraft : startNoteText(transcriptBeforeTools))
            const noteContent = typeof call.args?.content === 'string' ? call.args.content.trim() : ''
            const noteTitle = typeof call.args?.title === 'string' ? call.args.title.trim() : ''
            const note = noteContent || transcript
            if (!note) {
              result = 'The note is empty. Ask the user to dictate note text before saving.'
              break
            }
            actionsRef.current.onNote(note, true, noteTitle || undefined)
            assistantNoteActive = false
            assistantNoteDraft = ''
            transcriptBeforeTools = ''
            actionsRef.current.onNoteMode(false)
            result = 'The organized note summary was saved.'
            break
          }
          case 'cancel_note':
            if (assistantNoteActive) actionsRef.current.onCancelNote()
            assistantNoteActive = false
            assistantNoteDraft = ''
            transcriptBeforeTools = ''
            actionsRef.current.onNoteMode(false)
            result = 'The note was discarded.'
            break
          default:
            result = 'Unknown action. Do not claim it was completed.'
        }
        return { id: call.id, name: call.name, response: { result } }
      })
      session.sendToolResponse({ functionResponses })
    }
    const speakReply = (text: string) => {
      const speechRun = speechGeneration
      speechQueue = speechQueue.then(async () => {
        if (!current() || speechRun !== speechGeneration) return
        const request = new AbortController()
        speechRequests.add(request)
        try {
          const response = await fetch('/api/live/speech', {
            method: 'POST', signal: request.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ text, ...(voiceId ? { voiceId } : {}) }),
          })
          if (!response.ok) {
            const data = await response.json() as { error?: string }
            throw new Error(data.error || 'ElevenLabs speech failed.')
          }
          const audio = await context.decodeAudioData(await response.arrayBuffer())
          if (!current() || speechRun !== speechGeneration) return
          const node = context.createBufferSource()
          node.buffer = audio; node.connect(context.destination)
          speakers.add(node); setStatus('speaking')
          node.onended = () => {
            speakers.delete(node); node.disconnect()
            if (current() && !speakers.size) setStatus('listening')
          }
          node.start()
          await new Promise<void>(resolve => { node.addEventListener('ended', () => resolve(), { once: true }) })
        } catch (reason) {
          if (!current() || request.signal.aborted || speechRun !== speechGeneration) return
          setError(reason instanceof Error ? reason.message : 'ElevenLabs speech failed.')
          setStatus('listening')
        } finally {
          speechRequests.delete(request)
        }
      })
    }
    const onMessage = (message: LiveServerMessage) => {
      if (!current()) return
      if (message.goAway) { fail('This session is ending. Tap Start assistant to reconnect.'); return }
      const content = message.serverContent
      if (content?.interrupted) { clearSpeaker(); setStatus('listening') }
      if (content?.inputTranscription?.text) {
        if (elevenLabs && (speechRequests.size || speakers.size)) { clearSpeaker(); setStatus('listening') }
        addCaption('You', content.inputTranscription.text)
        if (assistantNoteActive) {
          const segment = finishNoteText(content.inputTranscription.text)
          if (segment) assistantNoteDraft = `${assistantNoteDraft}${assistantNoteDraft ? ' ' : ''}${segment}`.trim()
          if (assistantNoteDraft) actionsRef.current.onNote(assistantNoteDraft, false)
        } else transcriptBeforeTools = `${transcriptBeforeTools} ${content.inputTranscription.text}`.trim().slice(-4000)
      }
      handleToolCalls(message)
      if (!content) return
      if (content.outputTranscription?.text) {
        addCaption('Assistant', content.outputTranscription.text)
        if (elevenLabs && !content.interrupted) {
          replyText = (replyText + content.outputTranscription.text).slice(0, 4000)
          const firstSentence = replyText.match(/(.+?[.!?])(?:\s|$)/s)
          if (firstSentence) {
            speakReply(firstSentence[1].trim())
            replyText = replyText.slice(firstSentence[0].length).trimStart()
          }
        }
      }
      if (elevenLabs) {
        if (content.turnComplete && replyText.trim()) {
          speakReply(replyText.trim()); replyText = ''
        }
        if (content.turnComplete && !assistantNoteActive) transcriptBeforeTools = ''
        return
      }
      if (content.turnComplete && !assistantNoteActive) transcriptBeforeTools = ''
      for (const part of content.modelTurn?.parts ?? []) {
        if (!part.inlineData?.data || !part.inlineData.mimeType?.startsWith('audio/pcm')) continue
        try {
          const samples = decodePcm(part.inlineData.data)
          const buffer = context.createBuffer(1, samples.length, 24000)
          buffer.copyToChannel(new Float32Array(samples), 0)
          const node = context.createBufferSource()
          node.buffer = buffer; node.connect(context.destination)
          const time = Math.max(context.currentTime + 0.025, nextAudioTime)
          nextAudioTime = time + buffer.duration
          speakers.add(node); setStatus('speaking')
          node.onended = () => { speakers.delete(node); node.disconnect(); if (current() && !speakers.size) setStatus('listening') }
          node.start(time)
        } catch { fail('The assistant audio could not play. End the session and try again.') }
      }
    }
    durationTimer = window.setTimeout(() => fail('The assistant took too long to connect. Check your connection and start again.'), 30_000)
    try {
      if (!navigator.mediaDevices?.getUserMedia || !context.audioWorklet) throw new Error('Live audio needs a current browser on HTTPS or localhost.')
      // Resume immediately within the user's tap for Safari's audio permission.
      await context.resume()
      const response = await fetch('/api/live/token', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, signal: tokenRequest.signal })
      const data = await response.json() as { error?: string; token?: string; model?: string; voiceProvider?: string }
      if (!response.ok || !data.token || !data.model) throw new Error(data.error || 'The assistant could not start.')
      elevenLabs = data.voiceProvider === 'elevenlabs'
      if (!current()) return
      mic = await navigator.mediaDevices.getUserMedia({ video: false, audio: {
        echoCancellation: true, noiseSuppression: true, channelCount: 1,
        ...(microphoneId ? { deviceId: { exact: microphoneId } } : {}),
      } })
      if (!current()) { mic.getTracks().forEach(track => track.stop()); return }
      mic.getAudioTracks()[0]?.addEventListener('ended', () => fail('The microphone disconnected. Start again to reconnect.'), { once: true })
      await context.audioWorklet.addModule('/live-audio-worklet.js')
      if (!current()) return
      const { GoogleGenAI, Modality } = await import('@google/genai')
      if (!current()) return
      const ai = new GoogleGenAI({ apiKey: data.token, httpOptions: { apiVersion: 'v1beta' } })
      session = await ai.live.connect({ model: data.model, config: {
        responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {}, tools: LIVE_TOOLS,
      }, callbacks: {
        onmessage: onMessage,
        onerror: () => fail('The Gemini connection failed. Check your internet connection and Live model access, then start again.'),
        onclose: () => fail('The assistant disconnected. Tap Start assistant to reconnect.'),
      } })
      if (!current()) { session.close(); return }
      video = document.createElement('video')
      video.muted = true; video.playsInline = true; video.autoplay = true
      video.className = 'assistant-frame-source'; video.setAttribute('aria-hidden', 'true')
      document.body.append(video)
      const canvas = document.createElement('canvas')
      let hadVision: boolean | undefined
      const sendFrame = () => {
        if (!current() || !session || !video) return
        const stream = camera.current
        if (video.srcObject !== stream) {
          video.srcObject = stream
          if (stream) void video.play().catch(() => {})
        }
        const available = !!stream?.getVideoTracks().some(track => track.readyState === 'live') && video.readyState >= 2 && video.videoWidth > 0
        setVision(available)
        if (available !== hadVision) {
          hadVision = available
          session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: available
            ? 'Camera context is now available. Use the newly arriving frames for visual questions.'
            : 'Camera context is currently unavailable. Do not describe the current scene using old frames; explain that the camera needs to be connected.' }] }], turnComplete: false })
        }
        if (!available) return
        const ratio = Math.min(1, 640 / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * ratio); canvas.height = Math.round(video.videoHeight * ratio)
        try {
          canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
          session.sendRealtimeInput({ video: { data: canvas.toDataURL('image/jpeg', 0.7).split(',')[1], mimeType: 'image/jpeg' } })
        } catch { setVision(false) }
      }
      sendFrame()
      frameTimer = window.setInterval(() => { try { sendFrame() } catch { fail('The camera context connection was interrupted. Start the assistant again.') } }, 1000)
      source = context.createMediaStreamSource(mic)
      capture = new AudioWorkletNode(context, 'live-audio-capture')
      capture.port.onmessage = event => {
        if (!current() || !session) return
        try { session.sendRealtimeInput({ audio: { data: encodePcm(event.data as Float32Array), mimeType: `audio/pcm;rate=${context.sampleRate}` } }) }
        catch { fail('The microphone stream was interrupted. Start the assistant again.') }
      }
      source.connect(capture); capture.connect(context.destination)
      // Keep demos bounded; reconnect explicitly rather than silently using stale context.
      window.clearTimeout(durationTimer)
      durationTimer = window.setTimeout(() => fail('Session finished. Tap Start assistant for another conversation.'), 8 * 60_000)
      setStatus('listening')
    } catch (reason) {
      fail(reason instanceof Error ? reason.message : 'The assistant could not start. Check microphone access and try again.')
    }
  }, [accessToken, beforeStart, microphoneId, stop, voiceId])

  useEffect(() => {
    const hidden = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', hidden)
    return () => { document.removeEventListener('visibilitychange', hidden); generation.current++; cleanup.current?.() }
  }, [stop])
  return { status, error, captions, vision, start, stop }
}
