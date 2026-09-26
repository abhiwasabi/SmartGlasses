/** Decode a recording's first frame locally without playing audio or uploading it. */
export function createVideoThumbnail(blob: Blob, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Thumbnail cancelled', 'AbortError')); return }
    const video = document.createElement('video')
    const source = URL.createObjectURL(blob)
    let settled = false
    const cleanup = () => {
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      video.onloadeddata = null
      video.onerror = null
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(source)
    }
    const finish = (thumbnail?: Blob, error?: Error) => {
      if (settled) return
      settled = true
      cleanup()
      if (thumbnail) resolve(thumbnail)
      else reject(error ?? new Error('This recording has no preview frame.'))
    }
    const abort = () => finish(undefined, new DOMException('Thumbnail cancelled', 'AbortError'))
    const timeout = window.setTimeout(() => finish(undefined, new Error('Video preview timed out.')), 10000)
    signal.addEventListener('abort', abort, { once: true })
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onerror = () => finish(undefined, new Error('This recording could not be decoded.'))
    video.onloadeddata = () => {
      if (settled) return
      try {
        if (!video.videoWidth || !video.videoHeight) { finish(); return }
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 640 / video.videoWidth)
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) { finish(); return }
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(thumbnail => finish(thumbnail ?? undefined), 'image/jpeg', 0.8)
      } catch (error) { finish(undefined, error instanceof Error ? error : new Error('Video preview unavailable.')) }
    }
    video.src = source
    video.load()
  })
}
