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
