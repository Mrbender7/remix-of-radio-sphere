import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { globalAudio } from "@/contexts/PlayerContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface TimestampedChunk {
  data: Uint8Array;
  time: number;
  byteOffset: number;
}

interface StreamBufferContextType {
  bufferSeconds: number;
  isRecording: boolean;
  recordingDuration: number;
  isLive: boolean;
  canSeekBack: boolean;
  bufferAvailable: boolean;
  recordingAvailable: boolean;
  currentSeekOffsetSeconds: number;
  startRecording: () => void;
  stopRecording: () => Promise<{ blob: Blob; fileName: string } | null>;
  seekBack: (seconds: number) => void;
  returnToLive: () => void;
}

const StreamBufferContext = createContext<StreamBufferContextType | null>(null);

export function useStreamBuffer() {
  const ctx = useContext(StreamBufferContext);
  if (!ctx) throw new Error("useStreamBuffer must be inside StreamBufferProvider");
  return ctx;
}

const MAX_BUFFER_DURATION = 5 * 60;
const MAX_RECORDING_DURATION = 10 * 60;
const MAX_BUFFER_BYTES = 5 * 60 * 20 * 1024; // ~6MB for 5 min

export function StreamBufferProvider({ children }: { children: React.ReactNode }) {
  const { currentStation, isPlaying } = usePlayer();
  const { t } = useTranslation();

  const chunksRef = useRef<TimestampedChunk[]>([]);
  const totalBytesRef = useRef(0);
  const cumulativeBytesRef = useRef(0);
  const recordingStartIdxRef = useRef(-1);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekBlobUrlRef = useRef<string | null>(null);
  const stationIdRef = useRef<string | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const bufferAvailableRef = useRef(false);
  const detectedMimeRef = useRef<string>("audio/mpeg");

  const [bufferSeconds, setBufferSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [bufferAvailable, setBufferAvailable] = useState(false);
  const [recordingAvailable, setRecordingAvailable] = useState(false);
  const [currentSeekOffsetSeconds, setCurrentSeekOffsetSeconds] = useState(0);

  const clearBuffer = useCallback(() => {
    chunksRef.current = [];
    totalBytesRef.current = 0;
    cumulativeBytesRef.current = 0;
    setBufferSeconds(0);
    setIsRecording(false);
    setRecordingDuration(0);
    setIsLive(true);
    setCurrentSeekOffsetSeconds(0);
    setBufferAvailable(false);
    recordingStartIdxRef.current = -1;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    bufferAvailableRef.current = false;
    if (seekBlobUrlRef.current) {
      URL.revokeObjectURL(seekBlobUrlRef.current);
      seekBlobUrlRef.current = null;
    }
  }, []);

  const trimBuffer = useCallback(() => {
    while (totalBytesRef.current > MAX_BUFFER_BYTES && chunksRef.current.length > 0) {
      const removed = chunksRef.current.shift()!;
      totalBytesRef.current -= removed.data.byteLength;
      if (recordingStartIdxRef.current > 0) {
        recordingStartIdxRef.current--;
      } else if (recordingStartIdxRef.current === 0) {
        recordingStartIdxRef.current = 0;
      }
    }
  }, []);

  const updateBufferSeconds = useCallback(() => {
    const chunks = chunksRef.current;
    if (chunks.length < 2) {
      setBufferSeconds(0);
      return;
    }
    const duration = (chunks[chunks.length - 1].time - chunks[0].time) / 1000;
    setBufferSeconds(Math.min(duration, MAX_BUFFER_DURATION));
  }, []);

  // --- Stop fetch stream ---
  const stopFetch = useCallback(() => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
      fetchControllerRef.current = null;
    }
  }, []);

  // --- Start fetch-based stream capture (no proxy, direct fetch) ---
  const startFetch = useCallback(async (streamUrl: string) => {
    stopFetch();

    const controller = new AbortController();
    fetchControllerRef.current = controller;

    try {
      const response = await fetch(streamUrl, {
        signal: controller.signal,
        headers: { 'Accept': '*/*' },
      });

      if (!response.ok || !response.body) {
        console.warn("[StreamBuffer] Fetch failed or no body, status:", response.status);
        setBufferAvailable(false);
        setRecordingAvailable(false);
        return;
      }

      // Detect MIME type from Content-Type header
      const contentType = response.headers.get('Content-Type') || 'audio/mpeg';
      detectedMimeRef.current = contentType.split(';')[0].trim();
      console.log("[StreamBuffer] Fetch stream started, MIME:", detectedMimeRef.current);

      const reader = response.body.getReader();

      const readLoop = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value || value.byteLength === 0) continue;

            const chunk: TimestampedChunk = {
              data: value,
              time: Date.now(),
              byteOffset: cumulativeBytesRef.current,
            };
            cumulativeBytesRef.current += value.byteLength;
            chunksRef.current.push(chunk);
            totalBytesRef.current += value.byteLength;

            if (!bufferAvailableRef.current) {
              bufferAvailableRef.current = true;
              setBufferAvailable(true);
            }

            trimBuffer();
            updateBufferSeconds();
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            console.log("[StreamBuffer] Fetch aborted (normal)");
          } else {
            console.warn("[StreamBuffer] Fetch read error:", err);
          }
        }
      };

      readLoop();
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        console.log("[StreamBuffer] Fetch aborted (normal)");
      } else {
        console.warn("[StreamBuffer] Failed to fetch stream:", e);
        setBufferAvailable(false);
        setRecordingAvailable(false);
      }
    }
  }, [stopFetch, trimBuffer, updateBufferSeconds]);

  // React to station/playing changes — start fetch when audio is playing
  useEffect(() => {
    const stationId = currentStation?.id ?? null;

    if (!currentStation?.streamUrl || !isPlaying) {
      stopFetch();
      clearBuffer();
      stationIdRef.current = null;
      return;
    }

    if (stationId !== stationIdRef.current) {
      stationIdRef.current = stationId;
      clearBuffer();
      // Start fetch immediately — no need to wait for audio playing event
      startFetch(currentStation.streamUrl);
    }
  }, [currentStation?.id, currentStation?.streamUrl, isPlaying, startFetch, stopFetch, clearBuffer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFetch();
      if (seekBlobUrlRef.current) URL.revokeObjectURL(seekBlobUrlRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [stopFetch]);

  const startRecording = useCallback(() => {
    if (!bufferAvailable || chunksRef.current.length === 0) {
      toast.error(t("player.recordingNotAvailable") || "Recording not available");
      return;
    }

    if (!isLive && currentSeekOffsetSeconds > 0) {
      const now = Date.now();
      const targetTime = now - currentSeekOffsetSeconds * 1000;
      let startIdx = 0;
      for (let i = 0; i < chunksRef.current.length; i++) {
        if (chunksRef.current[i].time >= targetTime) {
          startIdx = i;
          break;
        }
      }
      recordingStartIdxRef.current = startIdx;
      console.log("[StreamBuffer] Recording started from seek-back position, offset:", currentSeekOffsetSeconds, "s, startIdx:", startIdx);
    } else {
      recordingStartIdxRef.current = chunksRef.current.length - 1;
    }

    setIsRecording(true);
    setRecordingDuration(0);

    const startTime = Date.now();
    recordingTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setRecordingDuration(elapsed);

      if (elapsed >= MAX_RECORDING_DURATION) {
        toast.info(t("player.recordingMaxReached"));
      }
    }, 1000);

    toast.success(t("player.recordingStarted"));
  }, [t, bufferAvailable, isLive, currentSeekOffsetSeconds]);

  const stopRecording = useCallback(async (): Promise<{ blob: Blob; fileName: string } | null> => {
    if (!isRecording) return null;

    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recordingStartIdxRef.current < 0) return null;
    const chunks = chunksRef.current;
    const startIdx = Math.max(0, recordingStartIdxRef.current);
    const recordedChunks = chunks.slice(startIdx);
    recordingStartIdxRef.current = -1;

    if (recordedChunks.length === 0) return null;

    // Raw audio chunks — no special header needed
    const parts: BlobPart[] = [];
    for (const c of recordedChunks) {
      parts.push(new Uint8Array(c.data));
    }

    const mime = detectedMimeRef.current;
    const blob = new Blob(parts, { type: mime });

    // Determine file extension from MIME
    let ext = 'mp3';
    if (mime.includes('aac') || mime.includes('mp4')) ext = 'aac';
    else if (mime.includes('ogg')) ext = 'ogg';
    else if (mime.includes('flac')) ext = 'flac';

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
    const stationName = (currentStation?.name ?? 'Station').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '_').slice(0, 40);
    const fileName = `RadioSphere_${stationName}_${dateStr}_${timeStr}.${ext}`;

    toast.success(t("player.recordingStopped"));
    setRecordingDuration(0);
    return { blob, fileName };
  }, [isRecording, currentStation?.name, t]);

  // --- Seek-back: build blob from raw buffer chunks ---
  const seekBack = useCallback((seconds: number) => {
    if (seconds <= 0) {
      returnToLiveInternal();
      return;
    }

    const chunks = chunksRef.current;
    if (chunks.length < 2) return;

    const now = Date.now();
    const targetTime = now - seconds * 1000;

    let startIdx = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].time >= targetTime) {
        startIdx = i;
        break;
      }
    }

    const selectedChunks = chunks.slice(startIdx);
    if (selectedChunks.length === 0) return;

    // Raw audio — no header prepend needed
    const parts: BlobPart[] = [];
    for (const c of selectedChunks) {
      parts.push(new Uint8Array(c.data));
    }

    const blob = new Blob(parts, { type: detectedMimeRef.current });

    if (seekBlobUrlRef.current) {
      URL.revokeObjectURL(seekBlobUrlRef.current);
    }

    const blobUrl = URL.createObjectURL(blob);
    seekBlobUrlRef.current = blobUrl;

    const actualOffset = (now - selectedChunks[0].time) / 1000;
    setCurrentSeekOffsetSeconds(Math.round(actualOffset));

    globalAudio.pause();
    globalAudio.src = blobUrl;
    globalAudio.load();
    globalAudio.play().catch((e) => {
      console.warn("[StreamBuffer] Seek-back play failed:", e);
    });

    setIsLive(false);
    console.log("[StreamBuffer] Seek-back to -" + Math.round(actualOffset) + "s, blob size:", blob.size, "chunks:", selectedChunks.length);
  }, []);

  // --- Return to live: restore original stream URL ---
  const returnToLiveInternal = useCallback(() => {
    if (seekBlobUrlRef.current) {
      URL.revokeObjectURL(seekBlobUrlRef.current);
      seekBlobUrlRef.current = null;
    }

    const streamUrl = currentStation?.streamUrl;
    if (streamUrl) {
      globalAudio.pause();
      globalAudio.src = streamUrl;
      globalAudio.load();
      globalAudio.play().catch((e) => {
        console.warn("[StreamBuffer] Return to live play failed:", e);
      });
    }

    setIsLive(true);
    setCurrentSeekOffsetSeconds(0);
    console.log("[StreamBuffer] Returned to live");
  }, [currentStation?.streamUrl]);

  const returnToLive = useCallback(() => {
    if (isLive) return;
    returnToLiveInternal();
  }, [isLive, returnToLiveInternal]);

  const canSeekBack = bufferAvailable && bufferSeconds > 2;

  useEffect(() => {
    if (bufferAvailable) {
      setRecordingAvailable(true);
    } else {
      setRecordingAvailable(false);
    }
  }, [bufferAvailable]);

  // Auto-return to live when blob playback ends naturally OR errors out
  useEffect(() => {
    const handleBlobEnded = () => {
      if (!isLive && seekBlobUrlRef.current && globalAudio.src.startsWith('blob:')) {
        if (isRecording) {
          console.log("[StreamBuffer] Blob ended during recording — returning to live WITHOUT stopping recording");
          returnToLiveInternal();
          toast.info(t("player.recordingContinuesLive") || "Retour au direct, enregistrement en cours...");
        } else {
          console.log("[StreamBuffer] Blob playback ended naturally, returning to live");
          returnToLiveInternal();
        }
      }
    };
    const handleBlobError = () => {
      if (globalAudio.src && globalAudio.src.startsWith('blob:')) {
        console.warn("[StreamBuffer] Blob playback error, auto-returning to live");
        returnToLiveInternal();
      }
    };
    globalAudio.addEventListener('ended', handleBlobEnded);
    globalAudio.addEventListener('error', handleBlobError);
    return () => {
      globalAudio.removeEventListener('ended', handleBlobEnded);
      globalAudio.removeEventListener('error', handleBlobError);
    };
  }, [isLive, isRecording, returnToLiveInternal, t]);

  return (
    <StreamBufferContext.Provider value={{
      bufferSeconds,
      isRecording,
      recordingDuration,
      isLive,
      canSeekBack,
      bufferAvailable,
      recordingAvailable,
      currentSeekOffsetSeconds,
      startRecording,
      stopRecording,
      seekBack,
      returnToLive,
    }}>
      {children}
    </StreamBufferContext.Provider>
  );
}
