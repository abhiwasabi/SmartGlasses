import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

const receiver = 'http://127.0.0.1:8765'
const scanIntervalMs = 5000

type Session = { context: string; goal: string }
type ScanResult = { status: 'spoken' | 'quiet' | 'suppressed'; message: string | null }

async function cameraFrame(video: HTMLVideoElement): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error('The camera is connected but has no frame yet. Try again in a moment.')
  }
  const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot capture a camera frame.')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const frame = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Camera frame could not be encoded.')), 'image/jpeg', 0.65)
  })
  if (frame.size > 524288) throw new Error('The camera frame is too large to scan.')
  return frame
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') return body.error
  } catch { /* A stopped local server may return HTML. */ }
  return `Assistant request failed (${response.status}).`
}

export function AssistantGoal({ connected, getVideo }: { connected: boolean; getVideo: () => HTMLVideoElement | null }) {
  const [context, setContext] = useState('walking')
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState('Checking local assistant…')
  const [scanStatus, setScanStatus] = useState('Connect a camera, then scan the scene.')
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const activeRef = useRef(false)
  const busyRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  function stopScanning() {
    activeRef.current = false
    setScanning(false)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    controllerRef.current?.abort()
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${receiver}/api/session`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error()
        const session = await response.json() as Session
        setContext(session.context)
        setGoal(session.goal)
        setSaved(true)
        setStatus(session.goal ? `Goal active: ${session.goal}` : 'Local assistant ready; safety alerts remain active')
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('Start the local assistant to set a goal') })
    return () => { controller.abort(); activeRef.current = false; if (timerRef.current !== null) window.clearTimeout(timerRef.current); controllerRef.current?.abort() }
  }, [])

  useEffect(() => {
    if (!connected && activeRef.current) {
      stopScanning()
      setScanStatus('Camera disconnected. Scanning stopped.')
    }
  }, [connected])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    stopScanning()
    setSaving(true)
    try {
      const response = await fetch(`${receiver}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: context.trim(), goal: goal.trim() }),
      })
      if (!response.ok) throw new Error(await errorMessage(response))
      setSaved(true)
      setStatus(goal.trim() ? `Goal active: ${goal.trim()}` : 'Goal cleared; safety alerts remain active')
    } catch (error) {
      setSaved(false)
      setStatus(error instanceof TypeError ? 'Local assistant unavailable at 127.0.0.1:8765' : (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function scanFrame() {
    if (busyRef.current) return
    busyRef.current = true
    setScanBusy(true)
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const video = getVideo()
      if (!connected || !video) throw new Error('Connect a camera before scanning.')
      setScanStatus('Gemini is checking the current frame…')
      const frame = await cameraFrame(video)
      if (controller.signal.aborted) return
      const response = await fetch(`${receiver}/api/frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: frame,
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(await errorMessage(response))
      const result = await response.json() as ScanResult
      if (controller.signal.aborted) return
      setScanStatus(result.status === 'spoken' && result.message ? `Alert: ${result.message}`
        : result.status === 'suppressed' ? 'Already alerted about this object.' : 'Nothing useful to say in this frame.')
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof TypeError ? 'Local assistant unavailable at 127.0.0.1:8765' : (error as Error).message
        const wasScanning = activeRef.current
        if (wasScanning) stopScanning()
        setScanStatus(wasScanning ? `Scanning stopped: ${message}` : message)
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      busyRef.current = false
      setScanBusy(false)
      if (activeRef.current) timerRef.current = window.setTimeout(() => void scanFrame(), scanIntervalMs)
    }
  }

  function startScanning() {
    if (!connected || !saved || activeRef.current) return
    activeRef.current = true
    setScanning(true)
    void scanFrame()
  }

  return <section className="panel assistant-goal" aria-labelledby="assistant-goal-heading">
    <div className="panel-heading"><div className="panel-title"><div><h2 id="assistant-goal-heading">What are you trying to do?</h2><p>Give the assistant a goal so it can judge what the camera notices.</p></div></div></div>
    <form onSubmit={save} className="assistant-goal-form">
      <label>Current activity<input value={context} onChange={event => { setContext(event.target.value); setSaved(false); stopScanning() }} maxLength={200} list="activity-suggestions" placeholder="Walking, cooking, cleaning…" required /><datalist id="activity-suggestions"><option value="walking" /><option value="running" /><option value="driving" /><option value="biking" /><option value="indoors" /></datalist></label>
      <label>Your goal<input value={goal} onChange={event => { setGoal(event.target.value); setSaved(false); stopScanning() }} maxLength={200} placeholder="Find a trash bin, locate a door, avoid obstacles…" /></label>
      <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Set goal'}</button>
    </form>
    <p className="assistant-goal-status" role="status">{status}</p>
    <div className="assistant-scan-controls">
      <button className="button button-secondary" type="button" onClick={() => void scanFrame()} disabled={!connected || !saved || scanBusy}>Scan once</button>
      <button className="button button-primary" type="button" onClick={scanning ? stopScanning : startScanning} disabled={!scanning && (!connected || !saved || scanBusy)}>{scanning ? 'Stop scanning' : 'Start scanning'}</button>
      <span>With scanning on, a resized camera frame is sent to Gemini every five seconds after the previous scan finishes.</span>
    </div>
    <p className="assistant-goal-status" role="status">{scanStatus}</p>
  </section>
}
