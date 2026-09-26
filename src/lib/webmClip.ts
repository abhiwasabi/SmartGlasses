const CLUSTER_ID = [0x1f, 0x43, 0xb6, 0x75] as const
const TIMECODE_ID = 0xe7

type ElementHeader = { id: number; dataStart: number; end: number; unknownSize: boolean }
type Cluster = { start: number; end: number; timecodeOffset: number; timecodeSize: number; timecode: number }

function readVint(bytes: Uint8Array, offset: number, isId = false): { value: number; length: number; unknown: boolean } | null {
  const first = bytes[offset]
  if (first === undefined || first === 0) return null
  let mask = 0x80
  let length = 1
  while (!(first & mask) && length <= 8) { mask >>= 1; length++ }
  if (length > 8 || offset + length > bytes.length) return null
  let value = isId ? first : first & (mask - 1)
  let unknown = !isId && (first & (mask - 1)) === mask - 1
  for (let index = 1; index < length; index++) {
    const byte = bytes[offset + index]
    value = value * 256 + byte
    if (byte !== 0xff) unknown = false
  }
  return { value, length, unknown }
}

function readElement(bytes: Uint8Array, offset: number): ElementHeader | null {
  const id = readVint(bytes, offset, true)
  if (!id) return null
  const size = readVint(bytes, offset + id.length)
  if (!size) return null
  const dataStart = offset + id.length + size.length
  const end = size.unknown ? bytes.length : dataStart + size.value
  if (end > bytes.length) return null
  return { id: id.value, dataStart, end, unknownSize: size.unknown }
}

function findCluster(bytes: Uint8Array, from: number): number {
  for (let index = from; index <= bytes.length - CLUSTER_ID.length; index++) {
    if (CLUSTER_ID.every((byte, idIndex) => bytes[index + idIndex] === byte)) return index
  }
  return -1
}

/** Returns the EBML, Segment, Info, and Tracks prefix before the first media Cluster. */
export function webmInitializationSegment(bytes: Uint8Array): Uint8Array | null {
  const cluster = findCluster(bytes, 0)
  return cluster > 0 ? bytes.slice(0, cluster) : null
}

function clusterTimecode(bytes: Uint8Array, cluster: ElementHeader): { offset: number; size: number; value: number } | null {
  let offset = cluster.dataStart
  while (offset < cluster.end) {
    const child = readElement(bytes, offset)
    if (!child) return null
    if (child.id === TIMECODE_ID) {
      const size = child.end - child.dataStart
      if (size < 1 || size > 6) return null
      let value = 0
      for (let index = child.dataStart; index < child.end; index++) value = value * 256 + bytes[index]
      return { offset: child.dataStart, size, value }
    }
    offset = child.end
  }
  return null
}

function readClusters(bytes: Uint8Array): Cluster[] {
  const clusters: Cluster[] = []
  let searchFrom = 0
  while (searchFrom < bytes.length) {
    const start = findCluster(bytes, searchFrom)
    if (start < 0) break
    const element = readElement(bytes, start)
    if (!element) break
    let end = element.end
    if (element.unknownSize) {
      const nextCluster = findCluster(bytes, element.dataStart)
      if (nextCluster < 0) break
      end = nextCluster
    }
    const timecode = clusterTimecode(bytes, { ...element, end })
    if (timecode) clusters.push({ start, end, timecodeOffset: timecode.offset, timecodeSize: timecode.size, timecode: timecode.value })
    if (end <= start) break
    searchFrom = end
  }
  return clusters
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.byteLength }
  return result
}

function writeUnsigned(bytes: Uint8Array, offset: number, size: number, value: number): void {
  let remaining = value
  for (let index = size - 1; index >= 0; index--) {
    bytes[offset + index] = remaining & 0xff
    remaining = Math.floor(remaining / 256)
  }
}

export async function makeRecentWebmClip(
  initialization: Uint8Array,
  chunks: Blob[],
  windowMs = 30_000,
): Promise<{ blob: Blob; duration: number } | null> {
  const bytes = concatBytes(await Promise.all(chunks.map(async chunk => new Uint8Array(await chunk.arrayBuffer()))))
  const clusters = readClusters(bytes)
  if (!clusters.length) return null

  const latestTimecode = clusters.at(-1)!.timecode
  const startTimecode = Math.max(0, latestTimecode - windowMs)
  const recent = clusters.filter(cluster => cluster.timecode >= startTimecode)
  if (!recent.length) return null

  const firstTimecode = recent[0].timecode
  const mediaParts = recent.map(cluster => {
    const part = bytes.slice(cluster.start, cluster.end)
    const timecodeOffset = cluster.timecodeOffset - cluster.start
    writeUnsigned(part, timecodeOffset, cluster.timecodeSize, cluster.timecode - firstTimecode)
    return part
  })
  const duration = Math.max(1, Math.min(30, Math.round((recent.at(-1)!.timecode - firstTimecode) / 1000)))
  return { blob: new Blob([initialization, ...mediaParts], { type: 'video/webm' }), duration }
}
