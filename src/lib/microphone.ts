/** Only advertise track routing on desktop Chromium versions that implement it. */
export function supportsMicrophoneSelection(userAgent: string): boolean {
  const version = userAgent.match(/(?:Chrome|Chromium)\/(\d+)/)
  return !!version && Number(version[1]) >= 135 && !/Android|iPhone|iPad|Mobile/i.test(userAgent)
}

export async function openMicrophone(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    video: false,
  })
}

export function microphoneErrorMessage(reason: unknown): string {
  const name = reason instanceof Error ? reason.name : ''
  const messages: Record<string, string> = {
    NotAllowedError: 'Microphone access was blocked. Allow microphone access for Clarity in your browser and device settings, then try again.',
    SecurityError: 'Microphone access was blocked. Allow microphone access for Clarity in your browser and device settings, then try again.',
    OverconstrainedError: 'The microphone could not open with the requested settings. Choose System default or another connected microphone and try again.',
    NotFoundError: 'No microphone was found. Connect a microphone and try again.',
    NotReadableError: 'The microphone is unavailable or busy. Close other apps using it and try again.',
    AbortError: 'Microphone startup was interrupted. Try starting the assistant again.',
  }
  return messages[name] || (reason instanceof Error ? reason.message.trim() : '') || 'The microphone could not open. Check microphone access and try again.'
}
