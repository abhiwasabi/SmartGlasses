import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Camera, Check, CheckCheck, CircleHelp, Clock3, CloudOff, Coffee, FileText, FolderOpen, Glasses, HardDrive, LayoutDashboard, Leaf, LoaderCircle, Maximize2, Menu, Mountain, Plus, Radio, Search, Settings2, Square, Trash2, Video, Wifi, WifiOff, X } from 'lucide-react'
import { AssistantPanel } from './components/AssistantPanel'
import { useGeminiLive } from './hooks/useGeminiLive'
import { VoicePanel } from './components/VoicePanel'
import { VideoThumbnail } from './components/VideoThumbnail'
import { useVoiceControl } from './hooks/useVoiceControl'
import { useCamera } from './hooks/useCamera'
import { useEspCamera } from './hooks/useEspCamera'
import { useLocalState } from './hooks/useLocalState'
import { deleteRecording, getRecording } from './lib/storage'
import { formatBytes, formatDuration, initialMemories, initialNotes, validateMemories, validateNotes } from './lib/data'
import type { Memory, Note } from './lib/data'

type View = 'Overview' | 'Camera' | 'Notes' | 'Memories'
type Source = 'camera1' | 'camera2' | 'browser'
type CameraSettings = { camera1: string; camera2: string }
type Recording = { id: string; title: string; createdAt: string; duration: number; mimeType: string; size: number; blob: Blob; persisted: boolean }
const validateSettings = (v: unknown): v is CameraSettings => typeof v === 'object' && v !== null && 'camera1' in v && typeof v.camera1 === 'string' && 'camera2' in v && typeof v.camera2 === 'string'
const navItems = [{ name: 'Overview', icon: LayoutDashboard }, { name: 'Camera', icon: Video }, { name: 'Notes', icon: FileText }, { name: 'Memories', icon: Bookmark }] as const
const sourceLabels = { camera1: 'ESP32 · Camera 01', camera2: 'ESP32 · Camera 02', browser: 'Device camera' }
const isLegacySampleNote = (note: Note) => note.sample === true || (note.id.startsWith('sample-note-') && !note.body.trim() && ['Design inspiration', 'Little things to remember', 'Weekend plans'].includes(note.title))
const dateLabel = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const timeLabel = (date: string) => new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = old }
  }, [])
  return <dialog className={`modal ${wide ? 'modal-wide' : ''}`} ref={ref} onCancel={onClose} onClick={e => { if (e.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
    <div className="modal-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}
  </dialog>
}

function MemoryCard({ memory, onOpen, sessionBlob }: { memory: Memory; onOpen: () => void; sessionBlob?: Blob }) {
  const CategoryIcon = memory.category === 'Adventure' ? Mountain : memory.category === 'Work' ? Coffee : Leaf
  return <button className="memory-card" onClick={onOpen}>
    <div className={`memory-image ${!memory.image ? `memory-placeholder ${memory.category.toLowerCase()}` : ''}`}>
      {memory.image ? <img src={memory.image} alt="" loading="lazy" /> : memory.kind === 'recording' ? <VideoThumbnail id={memory.id} sessionBlob={sessionBlob} /> : <div className="placeholder-mark"><Bookmark size={36} strokeWidth={1.2} /></div>}
      <span className="memory-category"><CategoryIcon size={12} />{memory.category}</span>
      <span className="memory-type">{memory.kind === 'recording' ? <><Video size={12} /> {formatDuration(memory.duration ?? 0)}</> : <Bookmark size={13} />}</span>
      <span className="memory-open"><ArrowUpRight size={20} /></span>
    </div>
    <div className="memory-content"><h3>{memory.title}</h3><p>{memory.description}</p><div className="memory-meta"><CalendarDays size={12} /><span>{dateLabel(memory.createdAt)}</span><span className="dot-separator">·</span><span>{timeLabel(memory.createdAt)}</span>{memory.kind === 'recording' && <span className="recorded-tag">Recording</span>}</div></div>
  </button>
}

export default function App() {
  const [view, setView] = useState<View>('Overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [storedNotes, setNotes, noteError] = useLocalState('clarity-notes-v1', initialNotes, validateNotes)
  const [storedMemories, setMemories, memoryError] = useLocalState('clarity-memories-v1', initialMemories, validateMemories)
  const notes = storedNotes.filter(note => !isLegacySampleNote(note))
  const memories = storedMemories.filter(memory => !memory.sample)
  const [settings, setSettings, settingsError] = useLocalState('clarity-camera-settings-v1', { camera1: '', camera2: '' }, validateSettings)
  const [selectedNoteId, setSelectedNoteId] = useState(notes[0]?.id ?? '')
  const [noteSearch, setNoteSearch] = useState('')
  const [source, setSource] = useState<Source>('camera1')
  const [modal, setModal] = useState<'settings' | 'help' | null>(null)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [recordingLoading, setRecordingLoading] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const sessionRecordings = useRef(new Map<string, Blob>())
  const previewRef = useRef<HTMLDivElement>(null)
  const voiceNoteId = useRef<string | null>(null)
  const recordingKind = useRef<'record' | 'clip' | null>(null)
  const captureIntent = useRef<'record' | 'clip' | null>(null)
  const [pendingCapture, setPendingCapture] = useState<'record' | 'clip' | null>(null)
  const notify = useCallback((message: string) => setToast(message), [])
  const onRecorded = useCallback((recording: Recording) => {
    if (!recording.persisted) sessionRecordings.current.set(recording.id, recording.blob)
    const memory: Memory = { id: recording.id, title: `${recordingKind.current === 'clip' ? 'Memory clip' : 'Recording'} through ${source === 'browser' ? 'your lens' : source === 'camera1' ? 'camera 01' : 'camera 02'}`, description: recordingKind.current === 'clip' ? 'A hands-free memory clip. Open to watch or download.' : 'Open this memory to watch or download your recording.', createdAt: recording.createdAt, duration: recording.duration, mimeType: recording.mimeType, size: recording.size, kind: 'recording', category: 'Everyday' }
    recordingKind.current = null
    setMemories(previous => [memory, ...previous])
    notify(recording.persisted ? 'Recording saved to your memories.' : 'Recording ready. Download it now—browser storage is unavailable.')
  }, [source, setMemories, notify])
  const browserCamera = useCamera(onRecorded)
  const espCamera = useEspCamera(source === 'browser' ? '' : settings[source], onRecorded)
  const camera = source === 'browser' ? browserCamera : espCamera
  const isRecording = camera.status === 'recording'
  const isBusy = isRecording || camera.status === 'saving' || camera.status === 'connecting' || pendingCapture !== null
  const isConnected = ['ready', 'recording', 'saving'].includes(camera.status)
  const selectedNote = notes.find(note => note.id === selectedNoteId) ?? notes[0]
  const storageError = noteError || memoryError || settingsError

  function saveVoiceNote(text: string, finished: boolean, suppliedTitle?: string) {
    if (!text.trim()) return
    const id = voiceNoteId.current ?? crypto.randomUUID()
    voiceNoteId.current = id
    const words = text.trim().split(/\s+/)
    const title = suppliedTitle?.slice(0, 120) || words.slice(0, 8).join(' ').slice(0, 90) + (words.length > 8 ? '…' : '')
    const note: Note = { id, title, body: text.trim(), tag: 'Voice note', updatedAt: new Date().toISOString() }
    setNotes(previous => previous.some(item => item.id === id) ? previous.map(item => item.id === id ? note : item) : [note, ...previous])
    setSelectedNoteId(id)
    if (finished) { voiceNoteId.current = null; notify('Voice note saved.') }
  }
  function cancelVoiceNote() {
    const id = voiceNoteId.current
    if (id) setNotes(previous => previous.filter(note => note.id !== id))
    voiceNoteId.current = null
    notify('Voice note discarded.')
  }

  const voice = useVoiceControl({
    onAction(action) {
      if (action === 'record' || action === 'clip') requestCapture(action)
      else if (action === 'stop-recording') {
        if (captureIntent.current) { captureIntent.current = null; setPendingCapture(null); camera.disconnect(); notify('Pending recording cancelled.') }
        else if (isRecording) { camera.stopRecording(); notify('Finishing your recording…') }
        else notify('There is no recording in progress.')
      }
    },
    onNote(text, finished) {
      saveVoiceNote(text, finished)
    },
    onCancelNote() {
      cancelVoiceNote()
    },
  })

  const assistant = useGeminiLive(camera.stream, voice.microphoneId, voice.stop, {
    onCommand(command) {
      if (command === 'start_recording') return requestCapture('record')
      if (command === 'clip_memory') return requestCapture('clip')
      if (captureIntent.current) { captureIntent.current = null; setPendingCapture(null); camera.disconnect(); notify('Pending recording cancelled.'); return 'The pending capture was cancelled.' }
      if (isRecording) { camera.stopRecording(); notify('Finishing your recording…'); return 'Recording stopped and is being saved.' }
      notify('There is no recording in progress.')
      return 'No recording is currently in progress.'
    },
    onNote: saveVoiceNote,
    onCancelNote: cancelVoiceNote,
    onNoteMode(active) { if (active) notify('Gemini is taking a note. Say “save note” to finish or “cancel note” to discard.') },
  })
  const driveModeActive = assistant.status !== 'off' && assistant.mode === 'drive'

  function requestCapture(kind: 'record' | 'clip'): string {
    if (isRecording || camera.status === 'saving' || captureIntent.current) { notify('A recording is already in progress. Say “stop recording” to finish it.'); return 'A recording is already in progress. Do not start another one.' }
    let captureCamera = camera
    if (source !== 'browser' && !settings[source]) {
      if (kind === 'clip' && browserCamera.status !== 'ready') {
        notify('Connect a camera and leave it connected for 30 seconds before clipping a memory.')
        return 'A camera must be connected and have a full 30-second buffer before a memory can be clipped.'
      }
      captureCamera = browserCamera
      setSource('browser')
      if (kind === 'record') notify('External camera is not configured. Using this device camera instead…')
    }
    if (kind === 'clip') {
      if (captureCamera.status !== 'ready') {
        notify('Connect the camera and wait 30 seconds before clipping a memory.')
        return 'Connect the camera and wait 30 seconds so Clarity can buffer the past before clipping.'
      }
      recordingKind.current = 'clip'
      captureIntent.current = 'clip'
      notify('Saving the previous 30 seconds…')
      void captureCamera.clipPast30Seconds().then(result => {
        captureIntent.current = null
        if (!result.ok) { recordingKind.current = null; notify(result.message) }
      }).catch(() => {
        captureIntent.current = null
        recordingKind.current = null
        notify('The recent footage could not be saved. Reconnect the camera and try again.')
      })
      return 'Saving the previous 30 seconds now. Do not say it captured future footage.'
    }
    recordingKind.current = kind
    captureIntent.current = kind
    setPendingCapture(kind)
    if (captureCamera.status === 'disconnected') void captureCamera.connect()
    if (source === 'browser' || settings[source]) notify(captureCamera.status === 'ready' ? 'Starting your recording…' : 'Connecting your camera before recording…')
    return captureCamera.status === 'ready' ? 'The capture is starting. Do not say it is saved yet.' : 'The camera is connecting before capture starts. Do not say it is saved yet.'
  }
  useEffect(() => {
    if (!pendingCapture) return
    if (camera.status === 'ready') { captureIntent.current = null; camera.startRecording(); setPendingCapture(null) }
    else if (camera.status === 'disconnected' && camera.error) { captureIntent.current = null; setPendingCapture(null); recordingKind.current = null; notify(camera.error) }
  }, [pendingCapture, camera.status, camera.error, camera.startRecording, notify])
  useEffect(() => {
    if (!isRecording || recordingKind.current !== 'clip') return
    const timer = window.setTimeout(camera.stopRecording, 30_000)
    return () => window.clearTimeout(timer)
  }, [isRecording, camera.stopRecording])

  useEffect(() => {
    setNotes(previous => previous.some(isLegacySampleNote) ? previous.filter(note => !isLegacySampleNote(note)) : previous)
    setMemories(previous => previous.some(memory => memory.sample) ? previous.filter(memory => !memory.sample) : previous)
  }, [setNotes, setMemories])
  useEffect(() => { if (selectedMemory?.sample) setSelectedMemory(null) }, [selectedMemory])

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 5500); return () => clearTimeout(timer) }, [toast])
  useEffect(() => {
    setRecordingUrl(null); setRecordingError(null); setRecordingLoading(false); setConfirmDelete(false)
    if (selectedMemory?.kind !== 'recording') return
    let cancelled = false
    let url: string | undefined
    setRecordingLoading(true)
    const load = async () => {
      try {
        const blob = sessionRecordings.current.get(selectedMemory.id) ?? await getRecording(selectedMemory.id)
        if (cancelled) return
        if (!blob) throw new Error('This recording is no longer in this browser’s storage.')
        url = URL.createObjectURL(blob); setRecordingUrl(url)
      } catch (error) { if (!cancelled) setRecordingError(error instanceof Error ? error.message : 'The recording could not be loaded.') }
      finally { if (!cancelled) setRecordingLoading(false) }
    }
    void load()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [selectedMemory])
  useEffect(() => {
    if (!isRecording) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isRecording])

  function navigate(next: View) {
    if (driveModeActive && next !== 'Overview') return
    setView(next); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function addNote() {
    const note: Note = { id: crypto.randomUUID(), title: 'Untitled note', body: '', tag: 'Personal', updatedAt: new Date().toISOString() }
    setNotes(previous => [note, ...previous]); setSelectedNoteId(note.id); notify('A fresh page. Make it yours.')
  }
  function updateNote(updates: Partial<Note>) {
    if (!selectedNote) return
    setNotes(previous => previous.map(note => note.id === selectedNote.id ? { ...note, ...updates, sample: false, updatedAt: new Date().toISOString() } : note))
  }
  function changeSource(next: Source) {
    if (isBusy || source === next) return
    camera.disconnect(); camera.clearError(); setSource(next)
  }
  function connectCamera() {
    if (source !== 'browser' && !settings[source]) { setModal('settings'); return }
    void camera.connect()
  }
  async function removeMemory() {
    if (!selectedMemory) return
    setDeleting(true)
    try {
      if (selectedMemory.kind === 'recording' && !sessionRecordings.current.has(selectedMemory.id)) await deleteRecording(selectedMemory.id)
      sessionRecordings.current.delete(selectedMemory.id)
      setMemories(previous => previous.filter(memory => memory.id !== selectedMemory.id)); setSelectedMemory(null); notify('Memory deleted.')
    } catch { notify('This memory could not be deleted. Please try again.') }
    finally { setDeleting(false) }
  }
  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = { camera1: String(form.get('camera1') ?? '').trim().replace(/\/$/, ''), camera2: String(form.get('camera2') ?? '').trim().replace(/\/$/, '') }
    if (isBusy) return
    camera.disconnect(); setSettings(values); setModal(null); notify('Camera settings saved. You’re ready to connect.')
  }

  const noteEditor = <>
    {selectedNote ? <div className="note-editor">
      <div className="note-date"><span>{dateLabel(selectedNote.updatedAt)} <span>·</span> {timeLabel(selectedNote.updatedAt)}</span><span className="tag tag-warm">{selectedNote.tag}</span></div>
      <input className="note-title" aria-label="Note title" maxLength={120} value={selectedNote.title} readOnly={voice.mode === 'dictating' && selectedNote.id === voiceNoteId.current} onChange={event => updateNote({ title: event.target.value })} placeholder="Give your thought a title" />
      <textarea className="note-body" aria-label="Note text" value={selectedNote.body} readOnly={voice.mode === 'dictating' && selectedNote.id === voiceNoteId.current} onChange={event => updateNote({ body: event.target.value })} placeholder="A thought, a detail, a little thing to remember…" />
      <div className="note-editor-footer"><span>{noteError ? <><CloudOff size={13} /> Unsaved</> : <><CheckCheck size={14} /> Saved on this device</>}</span><span>{selectedNote.body.trim() ? selectedNote.body.trim().split(/\s+/).length : 0} words</span></div>
    </div> : <div className="empty-state"><FileText size={30} /><h3>Your notes will live here.</h3><p>Write a note from the Notes section, or ask Gemini to make one by voice.</p></div>}
  </>
  const cameraPanel = <section className="panel camera-panel">
    <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><Video size={19} /></span><div><h2>Your perspective</h2><p>A window into your everyday.</p></div></div><span className={`connection-label ${isConnected ? 'connected' : ''}`}><span className="status-dot" />{isRecording ? 'Recording' : isConnected ? 'Camera connected' : 'Camera offline'}</span></div>
    <div className="camera-sources" aria-label="Camera source">{(['camera1', 'camera2', 'browser'] as Source[]).map(item => <button key={item} className={source === item ? 'selected' : ''} onClick={() => changeSource(item)} disabled={isBusy}>{<Camera size={13} />}{item === 'camera1' ? 'Camera 01' : item === 'camera2' ? 'Camera 02' : 'This device'}{item !== 'browser' && <span className={`source-dot ${source === item && isConnected ? 'on' : ''}`} />}</button>)}</div>
    <div className={`camera-preview ${isConnected ? 'has-feed' : ''}`} ref={previewRef}>
      <video className={`live-video ${isConnected ? 'visible' : ''}`} key={source} ref={camera.videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
      <div className="preview-shade" />
      <div className="preview-top"><span className="preview-badge"><span className={isRecording ? 'record-dot' : 'preview-dot'} />{isRecording ? 'RECORDING' : isConnected ? 'LIVE VIEW' : 'CAMERA OFFLINE'}</span><button className="preview-expand" aria-label="Expand camera preview" onClick={() => { const target = previewRef.current; if (target?.requestFullscreen) void target.requestFullscreen().catch(() => notify('Full screen is unavailable in this browser.')); else notify('Full screen is unavailable in this browser.') }}><Maximize2 size={16} /></button></div>
      {!isConnected && <div className="preview-message"><div className="preview-camera-icon"><Glasses size={32} strokeWidth={1.5} /></div><h3>Your camera view will appear here.</h3><p>Connect a camera to preview and record footage.</p><button className="button button-preview" onClick={connectCamera} disabled={camera.status === 'connecting'}>{camera.status === 'connecting' ? <LoaderCircle size={15} className="spin" /> : <Wifi size={15} />}{camera.status === 'connecting' ? 'Connecting…' : 'Connect camera'}<ArrowRight size={14} /></button></div>}
      <div className="preview-bottom"><span>{isConnected ? sourceLabels[source] : 'A fresh perspective awaits'}</span><span>{isConnected ? source === 'browser' ? 'Local camera' : 'Wi-Fi · JPEG feed' : 'No camera connected'}</span></div>
    </div>
    <div className="camera-controls"><div className="record-clock"><span className={isRecording ? 'record-dot' : 'idle-dot'} /><span>{formatDuration(camera.elapsed)}</span><span className="clock-caption">{isRecording ? 'Recording in progress' : 'Ready when you are'}</span></div><div className="camera-actions"><button className="icon-button" aria-label="Camera settings" onClick={() => setModal('settings')} disabled={isBusy}><Settings2 size={17} /></button>{isConnected && !isBusy && <button className="icon-button" aria-label="Disconnect camera" onClick={camera.disconnect}><WifiOff size={17} /></button>}<button className={`button ${isRecording ? 'button-stop' : 'button-primary'}`} disabled={!isConnected || camera.status === 'saving'} onClick={isRecording ? camera.stopRecording : camera.startRecording}>{camera.status === 'saving' ? <LoaderCircle size={14} className="spin" /> : isRecording ? <Square size={12} fill="currentColor" /> : <span className="button-record-dot" />}{camera.status === 'saving' ? 'Saving…' : isRecording ? 'Stop recording' : 'Start recording'}</button></div></div>
    {camera.error && <div className="inline-error" role="alert"><WifiOff size={16} /><span>{camera.error}</span><button className="icon-button" aria-label="Dismiss camera error" onClick={camera.clearError}><X size={14} /></button></div>}
  </section>

  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('Overview') }}><span className="brand-icon"><Glasses size={26} strokeWidth={1.8} /></span><span>clarity<span className="brand-period">.</span></span></a>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Main navigation">{navItems.map(item => <button key={item.name} disabled={driveModeActive && item.name !== 'Overview'} aria-current={view === item.name ? 'page' : undefined} className={`nav-item ${view === item.name ? 'active' : ''}`} onClick={() => navigate(item.name)}><item.icon size={18} strokeWidth={1.8} /><span>{item.name}</span>{item.name === 'Notes' && <span className="nav-count">{notes.length}</span>}{item.name === 'Memories' && <span className="nav-count">{memories.length}</span>}{item.name === 'Camera' && isRecording && <span className="record-dot" />}</button>)}</nav>
      <div className="sidebar-bottom">
      <button className="nav-item secondary-nav" disabled={driveModeActive} onClick={() => setModal('settings')}><Settings2 size={18} />Settings</button><button className="nav-item secondary-nav" disabled={driveModeActive} onClick={() => setModal('help')}><CircleHelp size={18} />A little help</button><div className="sidebar-profile"><div className="avatar">A</div><div><strong>My workspace</strong><span>Made for your everyday</span></div><span className="profile-local" title="Local workspace"><HardDrive size={15} /></span></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar compact-header"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" disabled={driveModeActive} onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><Glasses size={19} strokeWidth={1.5} /><span className="breadcrumb-slash">/</span><span className="dashboard-title"><strong>SmartGlasses</strong><span>{view} dashboard</span></span></div><div className="topbar-actions"><span className="local-indicator"><span className="status-dot" />Local workspace</span><div className="avatar avatar-small">A</div><span className="today-date"><span className="date-number">{new Date().getDate()}</span><span className="date-description">{new Date().toLocaleDateString('en-US', { weekday: 'short' })},<br />{new Date().toLocaleDateString('en-US', { month: 'long' })}</span></span></div></header>
      <main className={`compact-page ${driveModeActive ? 'drive-mode-active' : ''}`}>
        {view === 'Overview' && <>
          <AssistantPanel assistant={assistant} microphoneId={voice.microphoneId} setMicrophoneId={voice.setMicrophoneId} microphones={voice.microphones} refreshMicrophones={voice.refreshMicrophones} cameraConnected={isConnected} />
          <VoicePanel assistantActive={assistant.status !== 'off'} clipSeconds={isRecording && recordingKind.current === 'clip' ? Math.max(0, 30 - camera.elapsed) : null} />
        </>}
        {storageError && <div className="storage-error" role="alert"><CloudOff size={17} />{storageError}</div>}
        {view === 'Overview' && <>
          <div className="capture-grid">{cameraPanel}<section className="panel quick-notes"><div className="panel-heading"><div className="panel-title"><span className="heading-icon"><FileText size={18} /></span><div><h2>Notes</h2><p>Thoughts worth keeping.</p></div></div></div>{noteEditor}<button className="all-notes-link" onClick={() => navigate('Notes')}><span><FolderOpen size={14} />All notes <span className="small-count">{notes.length}</span></span><ArrowRight size={15} /></button></section></div>
        </>}
        {view === 'Camera' && <><div className="full-camera">{cameraPanel}</div><div className="camera-info"><Wifi size={19} /><div><h3>Two cameras. Your point of view.</h3><p>Add the Wi-Fi address of each ESP32-CAM in settings, then choose a camera above. Recordings from the selected camera stay in this browser.</p></div><button className="button button-secondary" onClick={() => setModal('settings')}>Configure cameras <ArrowUpRight size={14} /></button></div></>}
        {view === 'Notes' && <section className="panel notes-workspace"><div className="notes-list"><div className="notes-search"><Search size={15} /><input aria-label="Search notes" placeholder="Search your notes" value={noteSearch} onChange={e => setNoteSearch(e.target.value)} /></div><div className="notes-list-items">{notes.filter(note => `${note.title} ${note.body}`.toLowerCase().includes(noteSearch.toLowerCase())).map(note => <button key={note.id} className={`note-list-item ${selectedNote?.id === note.id ? 'selected' : ''}`} onClick={() => setSelectedNoteId(note.id)}><div><span className="tag">{note.tag}</span></div><h3>{note.title || 'Untitled note'}</h3><p>{note.body || 'Your next thought starts here…'}</p><span className="note-list-date">{dateLabel(note.updatedAt)} · {timeLabel(note.updatedAt)}</span></button>)}{!notes.some(note => `${note.title} ${note.body}`.toLowerCase().includes(noteSearch.toLowerCase())) && <p className="list-empty">No notes found. Try another search.</p>}</div><button className="new-note-list typed-note-link" onClick={addNote}><Plus size={13} /> Write a note</button></div><div className="full-note-editor"><div className="full-note-toolbar"><span><FileText size={15} /> Your notebook</span>{selectedNote && <button className="icon-button" aria-label="Delete selected note" disabled={voice.mode === 'dictating' && selectedNote?.id === voiceNoteId.current} onClick={() => { setNotes(previous => previous.filter(note => note.id !== selectedNote.id)); notify('Note deleted.') }}><Trash2 size={16} /></button>}</div>{noteEditor}</div></section>}
        {(view === 'Overview' || view === 'Memories') && <section className="memories-section"><div className="section-heading"><div><h2>{view === 'Overview' ? 'Worth remembering' : 'Your memory collection'}<span className="small-count">{memories.length}</span></h2><p>{view === 'Overview' ? 'Small moments. A bigger picture.' : 'Find your way back to a moment.'}</p></div>{view === 'Overview' && <button className="text-button" onClick={() => navigate('Memories')}>View all memories <ArrowRight size={15} /></button>}{view === 'Memories' && <span className="collection-storage"><HardDrive size={14} />{formatBytes(memories.reduce((sum, memory) => sum + (memory.size ?? 0), 0))} stored locally</span>}</div>{memories.length ? <div className="memory-grid">{(view === 'Overview' ? memories.slice(0, 3) : memories).map(memory => <MemoryCard key={memory.id} memory={memory} sessionBlob={sessionRecordings.current.get(memory.id)} onOpen={() => setSelectedMemory(memory)} />)}</div> : <div className="empty-state memory-empty"><Bookmark size={30} /><h3>Your next memory starts with your voice.</h3><p>Say “clip a memory” to save the previous 30 seconds, or “start recording” for a longer recording.</p></div>}</section>}
        <footer className="page-footer"><span><Glasses size={16} />A little more present. A little more clarity.</span><span><HardDrive size={12} />Saved on your device<span className="footer-dot">·</span>Built for the moments in between</span></footer>
      </main>
    </div>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{navItems.map(item => <button key={item.name} aria-current={view === item.name ? 'page' : undefined} className={view === item.name ? 'active' : ''} onClick={() => navigate(item.name)}><item.icon size={21} strokeWidth={1.7} /><span>{item.name}</span></button>)}</nav>
    {toast && <div className="toast" role="status"><span className="toast-icon"><Check size={15} /></span>{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={14} /></button></div>}
    {modal === 'settings' && <Modal title="Your camera setup" subtitle="Two perspectives. One place to remember them." onClose={() => setModal(null)}><form className="modal-form" onSubmit={saveSettings}><div className="settings-intro"><Wifi size={21} /><p>Connect your computer and both ESP32-CAM modules to the same Wi-Fi network. Enter each camera’s local address below.</p></div><label><span><Camera size={14} />Camera 01 · ESP32-CAM</span><input name="camera1" type="url" placeholder="http://192.168.1.100" defaultValue={settings.camera1} disabled={isBusy} /><small>The camera’s root address, without /stream or /capture.</small></label><label><span><Camera size={14} />Camera 02 · ESP32-CAM</span><input name="camera2" type="url" placeholder="http://192.168.1.101" defaultValue={settings.camera2} disabled={isBusy} /></label><div className="settings-note"><Radio size={16} /><p>Made for Espressif’s standard CameraWebServer firmware. Wi-Fi sends the footage; the serial adapters are used for device setup. ESP32 recordings are video-only.</p></div><div className="settings-note"><HardDrive size={16} /><p>Notes and memories stay in this browser. Download recordings you want to keep outside this device.</p></div>{isBusy && <p className="form-warning">Finish recording or connecting before changing camera settings.</p>}<div className="form-footer"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={isBusy}><Check size={15} />Save settings</button></div></form></Modal>}
    {modal === 'help' && <Modal title="A little help getting started" subtitle="Make room for what matters." onClose={() => setModal(null)}><div className="help-content"><div><span className="help-number">01</span><section><h3>Connect your perspective</h3><p>Configure your two ESP32-CAM addresses in Settings, choose Camera 01 or Camera 02, and connect. Use This device to try it with your phone or computer’s camera.</p></section></div><div><span className="help-number">02</span><section><h3>Keep a moment, hands-free</h3><p>In Ask your glasses, say “start recording” and “stop recording” to save a video. Say “clip a memory” to save the previous 30 seconds; connect the camera and wait for its buffer to fill first.</p></section></div><div><span className="help-number">03</span><section><h3>Speak your notes</h3><p>In Ask your glasses, say “make a new note” for a reminder or “take lecture notes” during a class, then speak naturally. Say “save note” to get a titled, organized summary, or “cancel note” to discard it. Your draft is saved as you speak.</p></section></div><div className="help-local"><HardDrive size={17} /><p>Voice uses your browser’s default microphone and may send speech to its recognition service. Keep this page open. Clearing browser data removes saved notes and recordings. ESP32 connections need the local dashboard server running on the same network.</p></div></div></Modal>}
    {selectedMemory && <Modal title={selectedMemory.title} subtitle={`${dateLabel(selectedMemory.createdAt)} at ${timeLabel(selectedMemory.createdAt)} · ${selectedMemory.category}`} onClose={() => setSelectedMemory(null)} wide><div className="memory-detail">{selectedMemory.kind === 'recording' ? <div className="recording-player">{recordingLoading ? <div className="player-message"><LoaderCircle className="spin" />Loading your moment…</div> : recordingError ? <div className="player-message"><Video size={28} /><p>{recordingError}</p></div> : recordingUrl && <video key={recordingUrl} controls playsInline src={recordingUrl} />}</div> : selectedMemory.image ? <img className="detail-image" src={selectedMemory.image} alt={selectedMemory.title} /> : <div className="detail-illustration"><Bookmark size={48} strokeWidth={1.2} /><span>A little moment. A lasting memory.</span></div>}<p className="detail-description">{selectedMemory.description || 'Sometimes a moment speaks for itself.'}</p>{selectedMemory.kind === 'recording' && <div className="recording-details"><span><Clock3 size={14} />{formatDuration(selectedMemory.duration ?? 0)}</span><span><HardDrive size={14} />{formatBytes(selectedMemory.size ?? 0)}</span></div>}<div className="detail-actions">{confirmDelete ? <div className="delete-confirm"><span>Delete this memory?</span><button className="button button-danger" disabled={deleting} onClick={() => void removeMemory()}>{deleting ? 'Deleting…' : 'Delete'}</button><button className="button button-secondary" onClick={() => setConfirmDelete(false)}>Keep it</button></div> : <button className="text-button delete-button" onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Delete memory</button>}{recordingUrl && <a className="button button-primary" href={recordingUrl} download={`clarity-${selectedMemory.id}.${selectedMemory.mimeType?.includes('mp4') ? 'mp4' : 'webm'}`}><ArrowDownToLine size={15} />Download recording</a>}</div></div></Modal>}
  </div>
}
