import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface TimestampedChunk {
  data: Uint8Array;
  time: number; // ms timestamp
}

interface StreamBufferContextType {
  bufferSeconds: number;
  isRecording: boolean;
  recordingDuration: number;
  isLive: boolean;
  canSeekBack: boolean;
  bufferAvailable: boolean;
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

const MAX_BUFFER_DURATION = 5 * 60; // 5 minutes in seconds
const MAX_RECORDING_DURATION = 10 * 60; // 10 minutes in seconds
const INITIAL_SKIP_MS = 3000; // skip first 3s of stream data
// Rough estimate: 128kbps = 16KB/s, 5 min = ~4.7MB
const MAX_BUFFER_BYTES = 5 * 60 * 16 * 1024; // ~4.7MB

export function StreamBufferProvider({ children }: { children: React.ReactNode }) {
  const { currentStation, isPlaying } = usePlayer();
  const { t } = useTranslation();

  const chunksRef = useRef<TimestampedChunk[]>([]);
  const totalBytesRef = useRef(0);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const fetchStartTimeRef = useRef(0);
  const recordingStartIdxRef = useRef(-1);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekBlobUrlRef = useRef<string | null>(null);
  const stationIdRef = useRef<string | null>(null);

  const [bufferSeconds, setBufferSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [bufferAvailable, setBufferAvailable] = useState(false);

  const clearBuffer = useCallback(() => {
    chunksRef.current = [];
    totalBytesRef.current = 0;
    setBufferSeconds(0);
    setIsRecording(false);
    setRecordingDuration(0);
    setIsLive(true);
    setBufferAvailable(false);
    recordingStartIdxRef.current = -1;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (seekBlobUrlRef.current) {
      URL.revokeObjectURL(seekBlobUrlRef.current);
      seekBlobUrlRef.current = null;
    }
  }, []);

  const stopFetch = useCallback(() => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
      fetchControllerRef.current = null;
    }
  }, []);

  // Trim oldest chunks to stay within buffer size
  const trimBuffer = useCallback(() => {
    while (totalBytesRef.current > MAX_BUFFER_BYTES && chunksRef.current.length > 0) {
      const removed = chunksRef.current.shift()!;
      totalBytesRef.current -= removed.data.byteLength;
      // Adjust recording start index
      if (recordingStartIdxRef.current > 0) {
        recordingStartIdxRef.current--;
      } else if (recordingStartIdxRef.current === 0) {
        // Recording start was trimmed — shouldn't happen with 10min limit but handle gracefully
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

  // Start fetching stream in parallel
  const startFetch = useCallback(async (streamUrl: string) => {
    stopFetch();
    clearBuffer();

    const controller = new AbortController();
    fetchControllerRef.current = controller;
    fetchStartTimeRef.current = Date.now();

    try {
      const response = await fetch(streamUrl, {
        signal: controller.signal,
        headers: { 'Accept': '*/*' },
      });

      if (!response.ok || !response.body) {
        console.warn("[StreamBuffer] Fetch failed or no body — buffer unavailable");
        return;
      }

      setBufferAvailable(true);
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) break;

        // Skip initial data (connection noise)
        if (Date.now() - fetchStartTimeRef.current < INITIAL_SKIP_MS) continue;

        const chunk: TimestampedChunk = {
          data: value,
          time: Date.now(),
        };
        chunksRef.current.push(chunk);
        totalBytesRef.current += value.byteLength;
        trimBuffer();
        updateBufferSeconds();
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.warn("[StreamBuffer] Fetch error (CORS or network):", e?.message);
        // Buffer unavailable — graceful degradation
        setBufferAvailable(false);
      }
    }
  }, [stopFetch, clearBuffer, trimBuffer, updateBufferSeconds]);

  // React to station/playing changes
  useEffect(() => {
    const streamUrl = currentStation?.streamUrl;
    const stationId = currentStation?.id ?? null;

    if (!streamUrl || !isPlaying) {
      stopFetch();
      clearBuffer();
      stationIdRef.current = null;
      return;
    }

    // Station changed
    if (stationId !== stationIdRef.current) {
      stationIdRef.current = stationId;
      startFetch(streamUrl);
    }

    return () => {
      // Don't stop on unmount if still playing same station
    };
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
    if (chunksRef.current.length === 0) return;
    recordingStartIdxRef.current = chunksRef.current.length - 1;
    setIsRecording(true);
    setRecordingDuration(0);

    const startTime = Date.now();
    recordingTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setRecordingDuration(elapsed);

      if (elapsed >= MAX_RECORDING_DURATION) {
        // Auto-stop will be handled by the component
        toast.info(t("player.recordingMaxReached"));
      }
    }, 1000);

    toast.success(t("player.recordingStarted"));
  }, [t]);

  const stopRecording = useCallback(async (): Promise<{ blob: Blob; fileName: string } | null> => {
    if (!isRecording || recordingStartIdxRef.current < 0) return null;

    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const chunks = chunksRef.current;
    const startIdx = Math.max(0, recordingStartIdxRef.current);
    const recordedChunks = chunks.slice(startIdx);
    recordingStartIdxRef.current = -1;

    if (recordedChunks.length === 0) return null;

    // Concatenate all recorded chunks
    const totalSize = recordedChunks.reduce((sum, c) => sum + c.data.byteLength, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of recordedChunks) {
      result.set(chunk.data, offset);
      offset += chunk.data.byteLength;
    }

    const blob = new Blob([result], { type: 'audio/mpeg' });

    // Generate filename
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
    const stationName = (currentStation?.name ?? 'Station').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '_').slice(0, 40);
    const fileName = `RadioSphere_${stationName}_${dateStr}_${timeStr}.mp3`;

    toast.success(t("player.recordingStopped"));
    setRecordingDuration(0);
    return { blob, fileName };
  }, [isRecording, currentStation?.name, t]);

  const seekBack = useCallback((seconds: number) => {
    // Not implemented for audio element swap in this version —
    // This is a UI indicator. In Capacitor, we'd create a Blob URL.
    // For now, we just update the "isLive" state for UI feedback.
    if (seconds <= 0) {
      setIsLive(true);
      return;
    }
    setIsLive(false);
  }, []);

  const returnToLive = useCallback(() => {
    setIsLive(true);
    if (seekBlobUrlRef.current) {
      URL.revokeObjectURL(seekBlobUrlRef.current);
      seekBlobUrlRef.current = null;
    }
  }, []);

  const canSeekBack = bufferAvailable && bufferSeconds > 2;

  return (
    <StreamBufferContext.Provider value={{
      bufferSeconds,
      isRecording,
      recordingDuration,
      isLive,
      canSeekBack,
      bufferAvailable,
      startRecording,
      stopRecording,
      seekBack,
      returnToLive,
    }}>
      {children}
    </StreamBufferContext.Provider>
  );
}
