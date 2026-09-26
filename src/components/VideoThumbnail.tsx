import { useEffect, useState } from 'react'
import { Play, Video } from 'lucide-react'
import { getRecording } from '../lib/storage'
import { createVideoThumbnail } from '../lib/videoThumbnail'

type Props = { id: string; sessionBlob?: Blob }

export function VideoThumbnail({ id, sessionBlob }: Props) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let imageUrl: string | undefined
    setThumbnail(null)
    async function load() {
      try {
        const recording = sessionBlob ?? await getRecording(id)
        if (!recording || controller.signal.aborted) return
        const image = await createVideoThumbnail(recording, controller.signal)
        if (controller.signal.aborted) return
        imageUrl = URL.createObjectURL(image)
        setThumbnail(imageUrl)
      } catch { /* Missing or unsupported videos keep the existing placeholder. */ }
    }
    void load()
    return () => {
      controller.abort()
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [id, sessionBlob])
  return thumbnail ? <><img src={thumbnail} alt="" loading="lazy" /><span className="thumbnail-play"><Play size={20} fill="currentColor" /></span></> : <div className="placeholder-mark"><Video size={36} strokeWidth={1.2} /></div>
}
