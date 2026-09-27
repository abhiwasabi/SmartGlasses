import { repairWebmDuration } from './webmClip'

/** Re-record a decoded interval, preserving audio and producing an independent video file. */
export async function trimRecording(blob: Blob, mediaDuration: number, seconds = 15): Promise<Blob> {
  const isWebm = blob.type.includes('webm')
  const video = document.createElement('video') as HTMLVideoElement & { captureStream?: () => MediaStream }
  const canTrim = typeof video.captureStream === 'function' && isWebm && typeof MediaRecorder !== 'undefined' && (MediaRecorder.isTypeSupported?.('video/webm') ?? false)
  if (!canTrim) {
    // On Safari / mobile, video.captureStream and WebM re-encoding are unsupported.
    // Return the blob directly so the clip can be stored and played natively (e.g. as MP4).
    return blob
  }
  const source = await repairWebmDuration(blob, mediaDuration)
  const url = URL.createObjectURL(source)
  let stream: MediaStream | undefined
  let recorder: MediaRecorder | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let stopTimer: ReturnType<typeof setTimeout> | undefined
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  const waitFor = (name: string) => new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      video.removeEventListener(name, done)
      video.removeEventListener('error', failed)
    }
    const done = () => { cleanup(); resolve() }
    const failed = () => { cleanup(); reject(new Error('The saved footage could not be decoded for trimming.')) }
    const timer = setTimeout(failed, 15_000)
    video.addEventListener(name, done, { once: true })
    video.addEventListener('error', failed, { once: true })
  })

  try {
    const loaded = waitFor('loadeddata')
    video.src = url
    await loaded
    const end = Number.isFinite(video.duration) ? video.duration : mediaDuration
    const start = Math.max(0, end - seconds)
    if (start > 0) {
      const sought = waitFor('seeked')
      video.currentTime = start
      await sought
    }
    stream = video.captureStream?.()
    if (!stream || !stream.getVideoTracks().length) return blob
    const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type))
    if (!mimeType) throw new Error('This browser cannot encode memory clips as WebM.')
    recorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []
    const finished = new Promise<Blob>((resolve, reject) => {
      const stop = () => { if (recorder?.state === 'recording') recorder.stop() }
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder!.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
      recorder!.onerror = () => reject(new Error('The memory clip could not be encoded.'))
      video.onended = stop
      video.ontimeupdate = () => { if (video.currentTime >= end) stop() }
      video.onerror = () => reject(new Error('Playback failed while trimming the memory.'))
      deadline = setTimeout(() => reject(new Error('Memory trimming timed out. Keep this page visible and try again.')), (seconds + 20) * 1000)
    })
    // Attach rejection handling before playback, which can itself fail.
    void finished.catch(() => {})
    recorder.start()
    await video.play()
    stopTimer = setTimeout(() => { if (recorder?.state === 'recording') recorder.stop() }, Math.min(seconds, end) * 1000)
    const result = await finished
    if (!result.size) throw new Error('No video frames were captured while trimming the memory.')
    return await repairWebmDuration(result, Math.min(seconds, end))
  } finally {
    clearTimeout(deadline)
    clearTimeout(stopTimer)
    video.onended = null
    video.ontimeupdate = null
    video.onerror = null
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    video.pause()
    stream?.getTracks().forEach(track => track.stop())
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
