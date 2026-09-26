export function encodePcm(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  samples.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample))
    view.setInt16(index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true)
  })
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
export function decodePcm(encoded: string): Float32Array {
  const binary = atob(encoded)
  if (binary.length % 2) throw new Error('Invalid PCM audio')
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  return Float32Array.from({ length: bytes.length / 2 }, (_, index) => view.getInt16(index * 2, true) / 32768)
}
