const CLUSTER_ID = [0x1f, 0x43, 0xb6, 0x75] as const
const TIMECODE_ID = 0xe7
const SEGMENT_ID = 0x18538067
const INFO_ID = 0x1549a966
const DURATION_ID = 0x4489
const SIMPLE_BLOCK_ID = 0xa3

type ElementHeader = { start: number; id: number; idLength: number; sizeStart: number; sizeLength: number; dataStart: number; end: number; unknownSize: boolean }
type Cluster = { start: number; end: number; timecodeOffset: number; timecodeSize: number; timecode: number; hasKeyframe: boolean }

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
  return { start: offset, id: id.value, idLength: id.length, sizeStart: offset + id.length, sizeLength: size.length, dataStart, end, unknownSize: size.unknown }
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

function clusterHasKeyframe(bytes: Uint8Array, cluster: ElementHeader): boolean {
  let offset = cluster.dataStart
  while (offset < cluster.end) {
    const child = readElement(bytes, offset)
    if (!child) return false
    if (child.id === SIMPLE_BLOCK_ID) {
      const track = readVint(bytes, child.dataStart)
      const flagsOffset = track ? child.dataStart + track.length + 2 : child.end
      if (flagsOffset < child.end && (bytes[flagsOffset] & 0x80) !== 0) return true
    }
    offset = child.end
  }
  return false
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
    if (timecode) clusters.push({ start, end, timecodeOffset: timecode.offset, timecodeSize: timecode.size, timecode: timecode.value, hasKeyframe: clusterHasKeyframe(bytes, { ...element, end }) })
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

function encodeVint(value: number, preferredLength = 1): Uint8Array | null {
  let length = preferredLength
  while (length <= 8 && value >= 2 ** (7 * length) - 1) length++
  if (length > 8) return null
  const result = new Uint8Array(length)
  let remaining = value
  for (let index = length - 1; index >= 0; index--) {
    result[index] = remaining & 0xff
    remaining = Math.floor(remaining / 256)
  }
  result[0] |= 1 << (8 - length)
  return result
}

function durationElement(durationMs: number): Uint8Array {
  const result = new Uint8Array(11)
  result.set([0x44, 0x89, 0x88])
  new DataView(result.buffer).setFloat64(3, durationMs, false)
  return result
}

function initializationWithDuration(initialization: Uint8Array, durationMs: number): Uint8Array {
  let offset = 0
  let segment: ElementHeader | null = null
  while (offset < initialization.length) {
    const element = readElement(initialization, offset)
    if (!element) return initialization
    if (element.id === SEGMENT_ID) { segment = element; break }
    offset = element.end
  }
  if (!segment) return initialization

  offset = segment.dataStart
  let info: ElementHeader | null = null
  while (offset < segment.end) {
    const element = readElement(initialization, offset)
    if (!element) return initialization
    if (element.id === INFO_ID) { info = element; break }
    offset = element.end
  }
  if (!info) return initialization

  offset = info.dataStart
  while (offset < info.end) {
    const child = readElement(initialization, offset)
    if (!child) return initialization
    if (child.id === DURATION_ID) {
      const size = child.end - child.dataStart
      if (size !== 4 && size !== 8) return initialization
      const updated = initialization.slice()
      const view = new DataView(updated.buffer, updated.byteOffset, updated.byteLength)
      if (size === 4) view.setFloat32(child.dataStart, durationMs, false)
      else view.setFloat64(child.dataStart, durationMs, false)
      return updated
    }
    offset = child.end
  }

  const addition = durationElement(durationMs)
  const contentSize = info.end - info.dataStart + addition.length
  const encodedSize = encodeVint(contentSize, info.sizeLength)
  if (!encodedSize) return initialization
  const rebuiltInfo = concatBytes([
    initialization.slice(info.start, info.sizeStart),
    encodedSize,
    initialization.slice(info.dataStart, info.end),
    addition,
  ])
  return concatBytes([initialization.slice(0, info.start), rebuiltInfo, initialization.slice(info.end)])
}

/** Adds finite duration metadata to MediaRecorder WebM output so browser controls can play and seek it. */
export async function repairWebmDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
  if (!blob.type.includes('webm') || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return blob
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const cluster = findCluster(bytes, 0)
  if (cluster <= 0) return blob
  const initialization = bytes.slice(0, cluster)
  const repaired = initializationWithDuration(initialization, durationSeconds * 1000)
  if (repaired === initialization) return blob
  return new Blob([repaired, bytes.slice(cluster)], { type: blob.type })
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
  const firstRecent = clusters.findIndex(cluster => cluster.timecode >= startTimecode)
  if (firstRecent < 0) return null
  const firstKeyframe = clusters.findIndex((cluster, index) => index >= firstRecent && cluster.hasKeyframe)
  const recent = clusters.slice(firstKeyframe >= 0 ? firstKeyframe : firstRecent)
  if (!recent.length) return null

  const firstTimecode = recent[0].timecode
  const mediaParts = recent.map(cluster => {
    const part = bytes.slice(cluster.start, cluster.end)
    const timecodeOffset = cluster.timecodeOffset - cluster.start
    writeUnsigned(part, timecodeOffset, cluster.timecodeSize, cluster.timecode - firstTimecode)
    return part
  })
  const duration = Math.max(1, Math.min(30, Math.round((recent.at(-1)!.timecode - firstTimecode) / 1000)))
  const finalizedInitialization = initializationWithDuration(initialization, duration * 1000)
  return { blob: new Blob([finalizedInitialization, ...mediaParts], { type: 'video/webm' }), duration }
}
