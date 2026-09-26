import { useCallback, useEffect, useRef, useState } from 'react';
import { saveRecording } from '../lib/storage';
import { makeRecentWebmClip, webmInitializationSegment } from '../lib/webmClip';

export type CameraStatus = 'disconnected' | 'connecting' | 'ready' | 'recording' | 'saving';

export interface CameraRecording {
  id: string;
  title: string;
  createdAt: string;
  duration: number;
  mimeType: string;
  size: number;
  blob: Blob;
  persisted: boolean;
}

interface RecordingSession {
  id: string;
  createdAt: string;
  startedAt: number;
  stoppedAt: number | null;
  chunks: Blob[];
}

type BufferedChunk = { blob: Blob; at: number };
export type PastClipResult = { ok: true; duration: number } | { ok: false; message: string };

function cameraError(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Allow camera access in your browser settings, then reconnect.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found. Connect a camera and try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera could not start. Close other apps using it, then reconnect.';
    case 'OverconstrainedError':
      return 'The selected camera is unavailable. Select another camera and reconnect.';
    case 'SecurityError':
      return 'Camera access is blocked. Open this dashboard over HTTPS or localhost.';
    default:
      return 'The camera could not connect. Check your camera and browser permissions, then try again.';
  }
}

function recordingId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `recording-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function supportedMimeType(): string | undefined {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    .find((type) => MediaRecorder.isTypeSupported(type));
}

export function useCamera(onRecorded: (recording: CameraRecording) => void) {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<CameraStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const mountedRef = useRef(true);
  const statusRef = useRef<CameraStatus>('disconnected');
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  const preRollRecorderRef = useRef<MediaRecorder | null>(null);
  const preRollChunksRef = useRef<BufferedChunk[]>([]);
  const preRollHeaderRef = useRef<Uint8Array | null>(null);
  const preRollHeaderChunksRef = useRef<Blob[]>([]);
  const preRollStartedAtRef = useRef(0);
  const preRollErrorRef = useRef('');
  const timerRef = useRef<number | null>(null);
  const connectionRef = useRef(0);
  const trackCleanupRef = useRef<(() => void) | null>(null);
  const onRecordedRef = useRef(onRecorded);

  const videoRef = useCallback((video: HTMLVideoElement | null) => {
    const previousVideo = videoElementRef.current;
    if (previousVideo && previousVideo !== video) previousVideo.srcObject = null;
    videoElementRef.current = video;
    if (!video) return;
    video.srcObject = streamRef.current;
    video.muted = true;
    video.playsInline = true;
    if (streamRef.current) void video.play().catch(() => { /* Navigation can interrupt playback. */ });
  }, []);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const transition = useCallback((nextStatus: CameraStatus) => {
    statusRef.current = nextStatus;
    if (mountedRef.current) setStatus(nextStatus);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopPreRoll = useCallback((): Promise<void> => {
    const recorder = preRollRecorderRef.current;
    preRollRecorderRef.current = null;
    preRollChunksRef.current = [];
    preRollHeaderRef.current = null;
    preRollHeaderChunksRef.current = [];
    preRollStartedAtRef.current = 0;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve();
    return new Promise((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
      try { recorder.stop(); } catch { resolve(); }
    });
  }, []);

  const startPreRoll = useCallback(async (source: MediaStream) => {
    await stopPreRoll();
    if (source.getVideoTracks().every((track) => track.readyState !== 'live')) return;
    if (typeof MediaRecorder === 'undefined') {
      preRollErrorRef.current = 'Past clips are not supported by this browser.';
      return;
    }
    const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported?.(type));
    if (!mimeType) {
      preRollErrorRef.current = 'Past clips need a browser with WebM recording support.';
      return;
    }
    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(source, { mimeType }); }
    catch { preRollErrorRef.current = 'Past clips could not start. Reconnect the camera and try again.'; return; }
    const handleData = (event: BlobEvent) => {
      if (preRollRecorderRef.current !== recorder || !event.data.size) return;
      const at = performance.now();
      preRollChunksRef.current.push({ blob: event.data, at });
      while (preRollChunksRef.current.length && at - preRollChunksRef.current[0].at > 36_000) preRollChunksRef.current.shift();
      if (!preRollHeaderRef.current) {
        preRollHeaderChunksRef.current.push(event.data);
        void new Blob(preRollHeaderChunksRef.current).arrayBuffer().then((buffer) => {
          if (preRollRecorderRef.current === recorder && !preRollHeaderRef.current) {
            preRollHeaderRef.current = webmInitializationSegment(new Uint8Array(buffer));
            if (preRollHeaderRef.current) preRollHeaderChunksRef.current = [];
          }
        });
      }
    };
    recorder.addEventListener('dataavailable', handleData);
    preRollRecorderRef.current = recorder;
    preRollChunksRef.current = [];
    preRollHeaderRef.current = null;
    preRollHeaderChunksRef.current = [];
    preRollStartedAtRef.current = performance.now();
    preRollErrorRef.current = '';
    try { recorder.start(1000); }
    catch {
      recorder.removeEventListener('dataavailable', handleData);
      preRollRecorderRef.current = null;
      preRollErrorRef.current = 'Past clips could not start. Reconnect the camera and try again.';
    }
  }, [stopPreRoll]);

  const releaseStream = useCallback(() => {
    void stopPreRoll();
    trackCleanupRef.current?.();
    trackCleanupRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoElementRef.current) videoElementRef.current.srcObject = null;
    if (mountedRef.current) setStream(null);
  }, [stopPreRoll]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    const session = sessionRef.current;
    if (!recorder || !session) return;

    if (session.stoppedAt === null) session.stoppedAt = performance.now();
    clearTimer();
    if (mountedRef.current) {
      setElapsed(Math.floor((session.stoppedAt - session.startedAt) / 1000));
    }
    transition('saving');

    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        if (mountedRef.current) setError('The recording could not stop cleanly. Recovering any available footage.');
      }
    }
  }, [clearTimer, transition]);

  const disconnect = useCallback(() => {
    connectionRef.current += 1;
    stopRecording();
    releaseStream();
    if (statusRef.current !== 'saving') transition('disconnected');
  }, [releaseStream, stopRecording, transition]);

  const refreshDevices = useCallback(async () => {
    try {
      const available = await navigator.mediaDevices?.enumerateDevices();
      if (mountedRef.current && available) {
        setDevices(available.filter((device) => device.kind === 'videoinput'));
      }
    } catch {
      // Device names are optional; permission restrictions must not block recording.
    }
  }, []);

  const connect = useCallback(async () => {
    if (['connecting', 'recording', 'saving'].includes(statusRef.current)) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable. Use a supported browser over HTTPS or localhost.');
      return;
    }

    const connection = ++connectionRef.current;
    setError(null);
    await stopPreRoll();
    if (!mountedRef.current || connection !== connectionRef.current) return;
    releaseStream();
    transition('connecting');

    const video: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      ...(!selectedDeviceId && /Android|iPhone|iPad|iPod/.test(navigator.userAgent) ? { facingMode: { ideal: 'environment' } } : {}),
      ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
    };
    let nextStream: MediaStream;
    let withoutAudio = false;

    try {
      try {
        nextStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      } catch (firstError) {
        if (!mountedRef.current || connection !== connectionRef.current) return;
        const name = firstError instanceof DOMException || firstError instanceof Error ? firstError.name : '';
        if (!['NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError'].includes(name)) {
          throw firstError;
        }
        // Microphone permission or hardware failures should not prevent video capture.
        nextStream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        withoutAudio = true;
      }

      if (!mountedRef.current || connection !== connectionRef.current) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (!nextStream.getVideoTracks().some((track) => track.readyState === 'live')) {
        nextStream.getTracks().forEach((track) => track.stop());
        throw new Error('No live video track was returned.');
      }

      streamRef.current = nextStream;
      setStream(nextStream);
      const deviceId = nextStream.getVideoTracks()[0]?.getSettings().deviceId;
      if (deviceId) setSelectedDeviceId(deviceId);

      const ended = () => {
        if (!mountedRef.current || streamRef.current !== nextStream) return;
        setError('The camera disconnected. Any captured footage is being saved. Reconnect to continue.');
        disconnect();
      };
      const audioEnded = () => {
        if (mountedRef.current && streamRef.current === nextStream) {
          setError('The microphone disconnected. Video capture can continue without sound.');
        }
      };
      nextStream.getVideoTracks().forEach((track) => track.addEventListener('ended', ended));
      nextStream.getAudioTracks().forEach((track) => track.addEventListener('ended', audioEnded));
      trackCleanupRef.current = () => {
        nextStream.getVideoTracks().forEach((track) => track.removeEventListener('ended', ended));
        nextStream.getAudioTracks().forEach((track) => track.removeEventListener('ended', audioEnded));
      };

      setElapsed(0);
      if (withoutAudio) setError('Microphone unavailable. The camera is connected; recordings will have no sound.');
      await startPreRoll(nextStream);
      transition('ready');
      void refreshDevices();
    } catch (connectionError) {
      if (mountedRef.current && connection === connectionRef.current) {
        releaseStream();
        transition('disconnected');
        setError(cameraError(connectionError));
      }
    }
  }, [disconnect, refreshDevices, releaseStream, selectedDeviceId, startPreRoll, stopPreRoll, transition]);

  const startRecording = useCallback(async () => {
    if (statusRef.current !== 'ready') return;
    const currentStream = streamRef.current;
    if (!currentStream?.getVideoTracks().some((track) => track.readyState === 'live')) {
      setError('Connect a camera before recording.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported in this browser. Try a current version of Chrome, Firefox, or Safari.');
      return;
    }

    await stopPreRoll();
    if (statusRef.current !== 'ready' || streamRef.current !== currentStream) return;

    setError(null);
    let recorder: MediaRecorder;
    try {
      const mimeType = supportedMimeType();
      recorder = mimeType ? new MediaRecorder(currentStream, { mimeType }) : new MediaRecorder(currentStream);
    } catch {
      setError('Video recording could not start. Try reconnecting the camera or using another browser.');
      return;
    }

    const session: RecordingSession = {
      id: recordingId(),
      createdAt: new Date().toISOString(),
      startedAt: performance.now(),
      stoppedAt: null,
      chunks: [],
    };

    const handleData = (event: BlobEvent) => {
      if (event.data.size > 0) session.chunks.push(event.data);
    };
    const handleError = () => {
      if (mountedRef.current) setError('Recording was interrupted. Recovering any captured footage.');
      stopRecording();
    };
    const cleanupRecorder = () => {
      recorder.removeEventListener('dataavailable', handleData);
      recorder.removeEventListener('error', handleError);
      recorder.removeEventListener('stop', handleStop);
    };
    const finishRecording = async () => {
      cleanupRecorder();
      clearTimer();
      if (recorderRef.current === recorder) recorderRef.current = null;
      if (sessionRef.current === session) sessionRef.current = null;
      const stoppedAt = session.stoppedAt ?? performance.now();
      const duration = Math.max(1, Math.round((stoppedAt - session.startedAt) / 1000));
      const mimeType = recorder.mimeType || session.chunks[0]?.type || 'video/webm';
      const blob = new Blob(session.chunks, { type: mimeType });
      session.chunks = [];
      transition('saving');

      try {
        if (blob.size === 0) {
          if (mountedRef.current) setError('No video data was captured. Reconnect the camera and try recording again.');
          return;
        }

        let persisted = false;
        try {
          await saveRecording(session.id, blob);
          persisted = true;
        } catch {
          if (mountedRef.current) {
            setError('Browser storage could not save this recording. Download it before closing or refreshing this page.');
          }
        }

        if (mountedRef.current) {
          onRecordedRef.current({
            id: session.id,
            title: `Recording · ${new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            createdAt: session.createdAt,
            duration,
            mimeType,
            size: blob.size,
            blob,
            persisted,
          });
        }
      } finally {
        const connected = streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live');
        if (connected && streamRef.current) await startPreRoll(streamRef.current);
        transition(connected ? 'ready' : 'disconnected');
      }
    };
    const handleStop = () => {
      void finishRecording().catch(() => {
        if (mountedRef.current) setError('The recording was captured, but the dashboard could not update.');
      });
    };

    recorder.addEventListener('dataavailable', handleData);
    recorder.addEventListener('error', handleError);
    recorder.addEventListener('stop', handleStop);
    recorderRef.current = recorder;
    sessionRef.current = session;

    try {
      recorder.start(1000);
      setElapsed(0);
      transition('recording');
      timerRef.current = window.setInterval(() => {
        if (mountedRef.current) setElapsed(Math.floor((performance.now() - session.startedAt) / 1000));
      }, 250);
    } catch {
      cleanupRecorder();
      recorderRef.current = null;
      sessionRef.current = null;
      setError('Recording could not start. Reconnect your camera and try again.');
    }
  }, [clearTimer, startPreRoll, stopPreRoll, stopRecording, transition]);

  const clipPast30Seconds = useCallback(async (): Promise<PastClipResult> => {
    const recorder = preRollRecorderRef.current;
    if (statusRef.current !== 'ready' || !recorder || recorder.state !== 'recording') {
      return { ok: false, message: preRollErrorRef.current || 'Connect the camera and let it buffer for 30 seconds before clipping a memory.' };
    }
    const bufferedFor = performance.now() - preRollStartedAtRef.current;
    if (bufferedFor < 30_000) {
      return { ok: false, message: `The memory buffer is still filling. Keep the camera connected for ${Math.ceil((30_000 - bufferedFor) / 1000)} more seconds, then try again.` };
    }
    transition('saving');
    try {
      await new Promise<void>((resolve) => {
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          window.clearTimeout(timeout);
          recorder.removeEventListener('dataavailable', done);
          resolve();
        };
        const timeout = window.setTimeout(done, 1500);
        recorder.addEventListener('dataavailable', done, { once: true });
        try { recorder.requestData(); } catch { done(); }
      });
      if (preRollRecorderRef.current !== recorder) return { ok: false, message: 'The camera disconnected before the memory could be clipped.' };
      const initialization = preRollHeaderRef.current;
      const chunks = preRollChunksRef.current
        .filter((chunk) => chunk.at >= performance.now() - 36_000)
        .map((chunk) => chunk.blob);
      if (!initialization) return { ok: false, message: 'The camera buffer is not ready yet. Reconnect and try again in 30 seconds.' };
      const clip = await makeRecentWebmClip(initialization, chunks);
      if (!clip || clip.duration < 27) return { ok: false, message: 'The recent camera footage could not be assembled. Reconnect the camera and try again.' };

      const id = recordingId();
      const createdAt = new Date(Date.now() - clip.duration * 1000).toISOString();
      let persisted = false;
      try { await saveRecording(id, clip.blob); persisted = true; }
      catch { if (mountedRef.current) setError('Browser storage could not save this memory. Download it before closing or refreshing.'); }
      if (mountedRef.current) {
        onRecordedRef.current({ id, title: `Memory clip · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, createdAt, duration: clip.duration, mimeType: clip.blob.type, size: clip.blob.size, blob: clip.blob, persisted });
      }
      return { ok: true, duration: clip.duration };
    } finally {
      const connected = streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live');
      transition(connected ? 'ready' : 'disconnected');
    }
  }, [transition]);

  useEffect(() => {
    const video = videoElementRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    if (stream) void video.play().catch(() => { /* The preview may be interrupted while disconnecting. */ });
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    mountedRef.current = true;
    void refreshDevices();
    const mediaDevices = navigator.mediaDevices;
    mediaDevices?.addEventListener?.('devicechange', refreshDevices);

    return () => {
      mountedRef.current = false;
      connectionRef.current += 1;
      mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
      // Keep the final data/stop listeners until MediaRecorder flushes its last chunk.
      // The blob is still persisted, but an unmounted dashboard receives no callback.
      stopRecording();
      clearTimer();
      releaseStream();
    };
  }, [clearTimer, refreshDevices, releaseStream, stopRecording]);

  const clearError = useCallback(() => setError(null), []);

  return {
    videoRef,
    status,
    error,
    elapsed,
    stream,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    clipPast30Seconds,
    clearError,
  };
}
