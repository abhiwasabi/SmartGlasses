import { useCallback, useEffect, useRef, useState } from 'react';
import { saveRecording } from '../lib/storage';
import type { CameraRecording, CameraStatus } from './useCamera';

interface EspRecordingSession {
  id: string;
  createdAt: string;
  startedAt: number;
  stoppedAt: number | null;
  chunks: Blob[];
}

async function drawSnapshot(canvas: HTMLCanvasElement, blob: Blob): Promise<void> {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser cannot render camera frames.');

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    try {
      if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
      if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
      context.drawImage(bitmap, 0, 0);
    } finally {
      bitmap.close();
    }
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The camera returned an invalid image.'));
      image.src = objectUrl;
    });
    if (canvas.width !== image.naturalWidth) canvas.width = image.naturalWidth;
    if (canvas.height !== image.naturalHeight) canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fetchSnapshot(address: string, canvas: HTMLCanvasElement, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException('Connection cancelled.', 'AbortError');
  const requestController = new AbortController();
  const abort = () => requestController.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = window.setTimeout(abort, 8000);

  try {
    const response = await fetch(`/api/camera/capture?url=${encodeURIComponent(address)}`, {
      signal: requestController.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      let message = `Camera request failed (${response.status}).`;
      try {
        const details: unknown = await response.json();
        if (typeof details === 'object' && details !== null && 'error' in details && typeof details.error === 'string') {
          message = details.error;
        }
      } catch {
        // A missing local proxy may return an HTML page instead of JSON.
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    if (signal.aborted) throw new DOMException('Connection cancelled.', 'AbortError');
    if (!blob.size) throw new Error('The camera returned an empty frame.');
    await drawSnapshot(canvas, blob);
  } catch (error) {
    if (requestController.signal.aborted && !signal.aborted) {
      throw new Error('The camera took too long to respond. Check its address and Wi-Fi connection.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

export function useEspCamera(url: string, onRecorded: (recording: CameraRecording) => void) {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<CameraStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const mountedRef = useRef(true);
  const statusRef = useRef<CameraStatus>('disconnected');
  const streamRef = useRef<MediaStream | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const connectionRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sessionRef = useRef<EspRecordingSession | null>(null);
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

  useEffect(() => { onRecordedRef.current = onRecorded; }, [onRecorded]);

  const transition = useCallback((next: CameraStatus) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
  }, []);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const releaseCapture = useCallback(() => {
    connectionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoElementRef.current) videoElementRef.current.srcObject = null;
    if (mountedRef.current) setStream(null);
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    const session = sessionRef.current;
    if (!recorder || !session) return;
    if (session.stoppedAt === null) session.stoppedAt = performance.now();
    clearRecordingTimer();
    if (mountedRef.current) setElapsed(Math.floor((session.stoppedAt - session.startedAt) / 1000));
    transition('saving');
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        if (mountedRef.current) setError('Recording was interrupted. Recovering any captured footage.');
      }
    }
  }, [clearRecordingTimer, transition]);

  const disconnect = useCallback(() => {
    stopRecording();
    releaseCapture();
    if (statusRef.current !== 'saving') transition('disconnected');
  }, [releaseCapture, stopRecording, transition]);

  const connect = useCallback(async () => {
    if (['connecting', 'recording', 'saving'].includes(statusRef.current)) return;
    if (!url.trim()) {
      setError('Enter the camera’s Wi-Fi address before connecting.');
      return;
    }

    let address: string;
    try {
      const parsed = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `http://${url.trim()}`);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported protocol.');
      address = parsed.toString();
    } catch {
      setError('Enter a valid camera address, such as http://192.168.1.100.');
      return;
    }

    const canvas = document.createElement('canvas');
    if (typeof canvas.captureStream !== 'function') {
      setError('This browser cannot capture the camera preview. Try a current version of Chrome, Firefox, or Safari.');
      return;
    }

    releaseCapture();
    const connection = connectionRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    transition('connecting');
    const isCurrent = () => mountedRef.current && connectionRef.current === connection && !controller.signal.aborted;

    try {
      await fetchSnapshot(address, canvas, controller.signal);
      if (!isCurrent()) return;
      const capturedStream = canvas.captureStream(10);
      streamRef.current = capturedStream;
      setStream(capturedStream);
      setElapsed(0);
      transition('ready');

      let failures = 0;
      const poll = async () => {
        if (!isCurrent()) return;
        const started = performance.now();
        try {
          await fetchSnapshot(address, canvas, controller.signal);
          failures = 0;
        } catch (captureError) {
          if (!isCurrent()) return;
          failures += 1;
          if (failures >= 3) {
            disconnect();
            const detail = captureError instanceof Error ? captureError.message : 'The camera stopped responding.';
            setError(`Camera connection lost. ${detail} Reconnect to continue.`);
            return;
          }
        }
        if (isCurrent()) {
          pollTimerRef.current = window.setTimeout(() => void poll(), Math.max(0, 100 - (performance.now() - started)));
        }
      };
      pollTimerRef.current = window.setTimeout(() => void poll(), 100);
    } catch (connectionError) {
      if (!isCurrent()) return;
      releaseCapture();
      transition('disconnected');
      const detail = connectionError instanceof Error ? connectionError.message : 'The camera could not be reached.';
      setError(`Could not connect. ${detail}`);
    }
  }, [disconnect, releaseCapture, transition, url]);

  const startRecording = useCallback(() => {
    if (statusRef.current !== 'ready' || !streamRef.current) return;
    if (typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported in this browser. Try another browser.');
      return;
    }

    let recorder: MediaRecorder;
    try {
      const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
      const mimeType = typeof MediaRecorder.isTypeSupported === 'function'
        ? types.find((type) => MediaRecorder.isTypeSupported(type))
        : undefined;
      recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);
    } catch {
      setError('Recording could not start. Reconnect the camera and try again.');
      return;
    }

    const session: EspRecordingSession = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `recording-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
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
    const cleanup = () => {
      recorder.removeEventListener('dataavailable', handleData);
      recorder.removeEventListener('error', handleError);
      recorder.removeEventListener('stop', handleStop);
    };
    const finish = async () => {
      cleanup();
      clearRecordingTimer();
      if (recorderRef.current === recorder) recorderRef.current = null;
      if (sessionRef.current === session) sessionRef.current = null;
      const duration = Math.max(1, Math.round(((session.stoppedAt ?? performance.now()) - session.startedAt) / 1000));
      const mimeType = recorder.mimeType || session.chunks[0]?.type || 'video/webm';
      const blob = new Blob(session.chunks, { type: mimeType });
      session.chunks = [];
      transition('saving');

      try {
        if (!blob.size) {
          if (mountedRef.current) setError('No video data was captured. Reconnect the camera and try again.');
          return;
        }
        let persisted = false;
        try {
          await saveRecording(session.id, blob);
          persisted = true;
        } catch {
          if (mountedRef.current) setError('Browser storage could not save this recording. Download it before closing or refreshing this page.');
        }
        if (mountedRef.current) {
          onRecordedRef.current({
            id: session.id,
            title: `ESP32 recording · ${new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            createdAt: session.createdAt,
            duration,
            mimeType,
            size: blob.size,
            blob,
            persisted,
          });
        }
      } finally {
        transition(streamRef.current ? 'ready' : 'disconnected');
      }
    };
    const handleStop = () => {
      void finish().catch(() => {
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
      setError(null);
      setElapsed(0);
      transition('recording');
      recordingTimerRef.current = window.setInterval(() => {
        if (mountedRef.current) setElapsed(Math.floor((performance.now() - session.startedAt) / 1000));
      }, 250);
    } catch {
      cleanup();
      recorderRef.current = null;
      sessionRef.current = null;
      setError('Recording could not start. Reconnect the camera and try again.');
    }
  }, [clearRecordingTimer, stopRecording, transition]);

  useEffect(() => {
    const video = videoElementRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    if (stream) void video.play().catch(() => { /* Disconnecting can interrupt preview playback. */ });
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopRecording();
      clearRecordingTimer();
      releaseCapture();
    };
  }, [clearRecordingTimer, releaseCapture, stopRecording]);

  useEffect(() => {
    // A changed endpoint invalidates the old source even if the parent switches it mid-request.
    return () => disconnect();
  }, [url, disconnect]);

  const clearError = useCallback(() => setError(null), []);

  return { videoRef, status, error, elapsed, stream, connect, disconnect, startRecording, stopRecording, clearError };
}
