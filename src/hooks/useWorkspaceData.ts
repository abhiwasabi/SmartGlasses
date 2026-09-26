import { useEffect, useState } from 'react'
import { initialMemories, initialNotes, validateMemories, validateNotes } from '../lib/data'
import type { Memory, Note } from '../lib/data'
import { supabase } from '../lib/supabase'
import { useLocalState } from './useLocalState'

type NoteRow = { id: string; title: string; body: string; tag: string; updated_at: string }
type MemoryRow = {
  id: string; title: string; description: string; created_at: string; category: Memory['category']; kind: Memory['kind'];
  image: string | null; duration: number | null; mime_type: string | null; size: number | null;
  playback_start: number | null; media_duration: number | null
}

const noteFromRow = (row: NoteRow): Note => ({ id: row.id, title: row.title, body: row.body, tag: row.tag, updatedAt: row.updated_at })
const noteToRow = (userId: string, note: Note) => ({ id: note.id, user_id: userId, title: note.title, body: note.body, tag: note.tag, updated_at: note.updatedAt })
const memoryFromRow = (row: MemoryRow): Memory => ({
  id: row.id, title: row.title, description: row.description, createdAt: row.created_at, category: row.category, kind: row.kind,
  image: row.image ?? undefined, duration: row.duration ?? undefined, mimeType: row.mime_type ?? undefined, size: row.size ?? undefined,
  playbackStart: row.playback_start ?? undefined, mediaDuration: row.media_duration ?? undefined,
})
const memoryToRow = (userId: string, memory: Memory) => ({
  id: memory.id, user_id: userId, title: memory.title, description: memory.description, created_at: memory.createdAt,
  category: memory.category, kind: memory.kind, image: memory.image ?? null, duration: memory.duration ?? null,
  mime_type: memory.mimeType ?? null, size: memory.size ?? null, playback_start: memory.playbackStart ?? null,
  media_duration: memory.mediaDuration ?? null,
})

async function removeMissing(table: 'notes' | 'memories', userId: string, ids: string[]) {
  if (!supabase) return
  const { data, error } = await supabase.from(table).select('id').eq('user_id', userId)
  if (error) throw error
  const missing = (data ?? []).map(item => item.id as string).filter(id => !ids.includes(id))
  if (missing.length) {
    const result = await supabase.from(table).delete().eq('user_id', userId).in('id', missing)
    if (result.error) throw result.error
  }
}

export function useWorkspaceData(userId: string) {
  const [notes, setNotes, noteLocalError] = useLocalState(`clarity-notes-v1:${userId}`, initialNotes, validateNotes)
  const [memories, setMemories, memoryLocalError] = useLocalState(`clarity-memories-v1:${userId}`, initialMemories, validateMemories)
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudError, setCloudError] = useState<string | null>(null)

  useEffect(() => {
    const client = supabase
    if (!client) return
    let cancelled = false
    const load = async () => {
      const [noteResult, memoryResult] = await Promise.all([
        client.from('notes').select('id,title,body,tag,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }),
        client.from('memories').select('id,title,description,created_at,category,kind,image,duration,mime_type,size,playback_start,media_duration').eq('user_id', userId).order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      if (noteResult.error || memoryResult.error) {
        setCloudError(noteResult.error?.message ?? memoryResult.error?.message ?? 'Your cloud workspace could not be loaded.')
        setCloudReady(true)
        return
      }
      const remoteNotes = (noteResult.data as NoteRow[]).map(noteFromRow)
      const remoteMemories = (memoryResult.data as MemoryRow[]).map(memoryFromRow)
      // A successful cloud read is authoritative, including an empty workspace.
      // This prevents browser data from one account being copied into another.
      setNotes(remoteNotes)
      setMemories(remoteMemories)
      setCloudReady(true)
    }
    void load()
    return () => { cancelled = true }
  }, [userId]) // The workspace remounts when the signed-in user changes.

  useEffect(() => {
    if (!supabase || !cloudReady) return
    const timer = window.setTimeout(() => {
      const sync = async () => {
        if (notes.length) {
          const result = await supabase!.from('notes').upsert(notes.map(note => noteToRow(userId, note)))
          if (result.error) throw result.error
        }
        await removeMissing('notes', userId, notes.map(note => note.id))
      }
      void sync().then(() => setCloudError(null)).catch(error => setCloudError(error instanceof Error ? error.message : 'Notes could not be synced.'))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [cloudReady, notes, userId])

  useEffect(() => {
    if (!supabase || !cloudReady) return
    const timer = window.setTimeout(() => {
      const sync = async () => {
        if (memories.length) {
          const result = await supabase!.from('memories').upsert(memories.map(memory => memoryToRow(userId, memory)))
          if (result.error) throw result.error
        }
        await removeMissing('memories', userId, memories.map(memory => memory.id))
      }
      void sync().then(() => setCloudError(null)).catch(error => setCloudError(error instanceof Error ? error.message : 'Memories could not be synced.'))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [cloudReady, memories, userId])

  return { notes, setNotes, memories, setMemories, storageError: noteLocalError || memoryLocalError || cloudError, cloudReady }
}
