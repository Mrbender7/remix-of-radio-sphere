import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { globalAudio } from "@/contexts/PlayerContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface TimestampedChunk {
  data: Uint8Array;
  time: number; // ms timestamp
  byteOffset: number; // cumulative byte offset at start of this chunk
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
const INITIAL_SKIP_MS = 3000;
const MAX_BUFFER_BYTES = 5 * 60 * 20 * 1024; // ~6MB for 5 min

// --- MIME type / extension mapping ---
const MIME_TO_EXT: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/aac': '.aac',
  'audio/aacp': '.aac',
  'audio/x-aac': '.aac',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/ogg': '.ogg',
  'application/ogg': '.ogg',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/x-mpegurl': '.mp3',
};

const CODEC_TO_MIME: Record<string, string> = {
  'MP3': 'audio/mpeg',
  'AAC': 'audio/aac',
  'AAC+': 'audio/aac',
  'OGG': 'audio/ogg',
  'FLAC': 'audio/flac',
  'OPUS': 'audio/ogg',
  'WMA': 'audio/mpeg',
};

function getExtFromMime(mime: string): string {
  const clean = mime.split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT[clean] || '.mp3';
}

function getMimeFromCodec(codec: string | undefined): string {
  if (!codec) return 'audio/mpeg';
  return CODEC_TO_MIME[codec.toUpperCase()] || 'audio/mpeg';
}

// --- ICY metadata parser (stateful, handles cross-chunk boundaries) ---
class IcyStripper {
  private metaint: number;
  private bytesUntilMeta: number;
  private metaBytesRemaining: number;
  private inMeta: boolean;

  constructor(metaint: number) {
    this.metaint = metaint;
    this.bytesUntilMeta = metaint;
    this.metaBytesRemaining = 0;
    this.inMeta = false;
  }

  /** Strip ICY metadata from a raw chunk, returning only audio bytes */
  strip(input: Uint8Array): Uint8Array {
    const audioParts: Uint8Array[] = [];
    let i = 0;

    while (i < input.length) {
      if (this.inMeta) {
        // Still consuming metadata bytes
        const skip = Math.min(this.metaBytesRemaining, input.length - i);
        this.metaBytesRemaining -= skip;
        i += skip;
        if (this.metaBytesRemaining <= 0) {
          this.inMeta = false;
          this.bytesUntilMeta = this.metaint;
        }
      } else {
        // Audio data
        const audioBytes = Math.min(this.bytesUntilMeta, input.length - i);
        audioParts.push(input.subarray(i, i + audioBytes));
        this.bytesUntilMeta -= audioBytes;
        i += audioBytes;

        if (this.bytesUntilMeta <= 0) {
          // Next byte is the metadata length indicator
          if (i < input.length) {
            const metaLen = input[i] * 16;
            i++;
            if (metaLen > 0) {
              this.inMeta = true;
              this.metaBytesRemaining = metaLen;
            } else {
              // No metadata, reset
              this.bytesUntilMeta = this.metaint;
            }
          } else {
            // Length byte is in the next chunk — we need to handle this
            // Set a flag: next chunk starts with the meta length byte
            this.bytesUntilMeta = 0; // will read length byte first next time
          }
        }
      }
    }

    if (audioParts.length === 0) return new Uint8Array(0);
    if (audioParts.length === 1) return audioParts[0];

    const totalLen = audioParts.reduce((s, p) => s + p.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of audioParts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }
}

export function StreamBufferProvider({ children }: { children: React.ReactNode }) {
  const { currentStation, isPlaying } = usePlayer();
  const { t } = useTranslation();

  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';

  const chunksRef = useRef<TimestampedChunk[]>([]);
  const totalBytesRef = useRef(0);
  const cumulativeBytesRef = useRef(0); // total bytes ever received (for byteOffset)
  const fetchControllerRef = useRef<AbortController | null>(null);
  const fetchStartTimeRef = useRef(0);
  const recordingStartIdxRef = useRef(-1);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekBlobUrlRef = useRef<string | null>(null);
  const stationIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const usingMediaRecorderRef = useRef(false);
  const streamMimeTypeRef = useRef<string>('audio/mpeg');
  const liveStreamUrlRef = useRef<string | null>(null);
  const icyStripperRef = useRef<IcyStripper | null>(null);
  const waitingMetaLengthRef = useRef(false);

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
    streamMimeTypeRef.current = 'audio/mpeg';
    icyStripperRef.current = null;
    waitingMetaLengthRef.current = false;
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

  // Try fetching a stream URL, with CORS proxy fallback
  const fetchWithCorsFallback = useCallback(async (streamUrl: string, signal: AbortSignal): Promise<Response> => {
    try {
      const response = await fetch(streamUrl, {
        signal,
        headers: { 'Accept': '*/*', 'Icy-MetaData': '1' },
      });
      if (response.ok && response.body) return response;
      throw new Error('Response not ok or no body');
    } catch (directError: any) {
      if (directError?.name === 'AbortError') throw directError;
      console.warn("[StreamBuffer] Direct fetch failed, trying CORS proxy:", directError?.message);
      // Retry via CORS proxy
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(streamUrl)}`;
      const response = await fetch(proxyUrl, {
        signal,
        headers: { 'Accept': '*/*', 'Icy-MetaData': '1' },
      });
      if (!response.ok || !response.body) throw new Error('Proxy fetch also failed');
      console.log("[StreamBuffer] CORS proxy succeeded for:", streamUrl);
      return response;
    }
  }, []);

  // Start fetching stream in parallel — capture Content-Type + ICY headers
  const startFetch = useCallback(async (streamUrl: string) => {
    stopFetch();
    clearBuffer();
    liveStreamUrlRef.current = streamUrl;

    const controller = new AbortController();
    fetchControllerRef.current = controller;
    fetchStartTimeRef.current = Date.now();

    try {
      const response = await fetchWithCorsFallback(streamUrl, controller.signal);

      // Capture Content-Type from response
      const contentType = response.headers.get('Content-Type') || '';
      const cleanType = contentType.split(';')[0].trim().toLowerCase();
      if (cleanType && cleanType !== 'application/octet-stream' && cleanType.startsWith('audio/')) {
        streamMimeTypeRef.current = cleanType;
        console.log("[StreamBuffer] Detected stream MIME:", cleanType);
      } else if (currentStation?.codec) {
        streamMimeTypeRef.current = getMimeFromCodec(currentStation.codec);
        console.log("[StreamBuffer] Using codec fallback MIME:", streamMimeTypeRef.current);
      }

      // Check for ICY metaint
      const icyMetaint = response.headers.get('icy-metaint');
      if (icyMetaint) {
        const metaintVal = parseInt(icyMetaint, 10);
        if (metaintVal > 0) {
          icyStripperRef.current = new IcyStripper(metaintVal);
          console.log("[StreamBuffer] ICY metaint detected:", metaintVal);
        }
      }

      setBufferAvailable(true);
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) break;

        if (Date.now() - fetchStartTimeRef.current < INITIAL_SKIP_MS) continue;

        // Strip ICY metadata if present
        let audioData: Uint8Array;
        if (icyStripperRef.current) {
          audioData = icyStripperRef.current.strip(value);
          if (audioData.length === 0) continue;
        } else {
          audioData = value;
        }

        const chunk: TimestampedChunk = {
          data: audioData,
          time: Date.now(),
          byteOffset: cumulativeBytesRef.current,
        };
        cumulativeBytesRef.current += audioData.byteLength;
        chunksRef.current.push(chunk);
        totalBytesRef.current += audioData.byteLength;
        trimBuffer();
        updateBufferSeconds();
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.warn("[StreamBuffer] Fetch error (CORS or network):", e?.message);
        setBufferAvailable(false);
      }
    }
  }, [stopFetch, clearBuffer, trimBuffer, updateBufferSeconds, currentStation?.codec, fetchWithCorsFallback]);

  // React to station/playing changes
  useEffect(() => {
    const streamUrl = currentStation?.streamUrl;
    const stationId = currentStation?.id ?? null;

    if (!streamUrl || !isPlaying) {
      stopFetch();
      clearBuffer();
      stationIdRef.current = null;
      liveStreamUrlRef.current = null;
      return;
    }

    if (stationId !== stationIdRef.current) {
      stationIdRef.current = stationId;
      liveStreamUrlRef.current = streamUrl;
      startFetch(streamUrl);
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
    if (bufferAvailable && chunksRef.current.length > 0) {
      usingMediaRecorderRef.current = false;
      
      if (!isLive && currentSeekOffsetSeconds > 0) {
        // In seek-back: find chunk corresponding to current seek position
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
    } else {
      usingMediaRecorderRef.current = true;
      try {
        const stream = (globalAudio as any).captureStream?.() || (globalAudio as any).mozCaptureStream?.();
        if (!stream) {
          toast.error("Recording not available in this browser");
          return;
        }
        mediaChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) mediaChunksRef.current.push(e.data);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (e) {
        console.warn("[StreamBuffer] MediaRecorder fallback failed:", e);
        toast.error("Recording not available");
        return;
      }
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

    let blob: Blob;
    let ext: string;

    if (usingMediaRecorderRef.current && mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
      mediaRecorderRef.current = null;

      if (mediaChunksRef.current.length === 0) return null;
      blob = new Blob(mediaChunksRef.current, { type: 'audio/webm' });
      mediaChunksRef.current = [];
      ext = '.webm';
    } else {
      if (recordingStartIdxRef.current < 0) return null;
      const chunks = chunksRef.current;
      const startIdx = Math.max(0, recordingStartIdxRef.current);
      const recordedChunks = chunks.slice(startIdx);
      recordingStartIdxRef.current = -1;

      if (recordedChunks.length === 0) return null;

      // Use BlobPart[] directly — avoids large memcpy
      const parts = recordedChunks.map(c => c.data.buffer.slice(c.data.byteOffset, c.data.byteOffset + c.data.byteLength)) as ArrayBuffer[];
      const mime = streamMimeTypeRef.current;
      blob = new Blob(parts, { type: mime });
      ext = getExtFromMime(mime);
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
    const stationName = (currentStation?.name ?? 'Station').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '_').slice(0, 40);
    const fileName = `RadioSphere_${stationName}_${dateStr}_${timeStr}${ext}`;

    toast.success(t("player.recordingStopped"));
    setRecordingDuration(0);
    return { blob, fileName };
  }, [isRecording, currentStation?.name, t]);

  // --- Real seek-back: swap globalAudio.src to a blob URL from buffer ---
  const seekBack = useCallback((seconds: number) => {
    if (seconds <= 0) {
      returnToLiveInternal();
      return;
    }

    const chunks = chunksRef.current;
    if (chunks.length < 2) return;

    const now = Date.now();
    const targetTime = now - seconds * 1000;

    // Find first chunk at or after targetTime
    let startIdx = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].time >= targetTime) {
        startIdx = i;
        break;
      }
    }

    // Use BlobPart[] directly to avoid large memcpy
    const selectedChunks = chunks.slice(startIdx);
    if (selectedChunks.length === 0) return;

    const parts = selectedChunks.map(c => c.data.buffer.slice(c.data.byteOffset, c.data.byteOffset + c.data.byteLength)) as ArrayBuffer[];
    const totalSize = selectedChunks.reduce((sum, c) => sum + c.data.byteLength, 0);
    const mime = streamMimeTypeRef.current;
    const blob = new Blob(parts, { type: mime });

    // Revoke previous seek blob URL
    if (seekBlobUrlRef.current) {
      URL.revokeObjectURL(seekBlobUrlRef.current);
    }

    const blobUrl = URL.createObjectURL(blob);
    seekBlobUrlRef.current = blobUrl;

    // Calculate actual offset applied
    const actualOffset = (now - selectedChunks[0].time) / 1000;
    setCurrentSeekOffsetSeconds(Math.round(actualOffset));

    // Swap audio source
    globalAudio.pause();
    globalAudio.src = blobUrl;
    globalAudio.load();
    globalAudio.play().catch((e) => {
      console.warn("[StreamBuffer] Seek-back play failed:", e);
    });

    setIsLive(false);
    console.log("[StreamBuffer] Seek-back to -" + Math.round(actualOffset) + "s, blob size:", totalSize, "mime:", mime, "chunks:", selectedChunks.length);
  }, []);

  // --- Return to live: restore original stream URL ---
  const returnToLiveInternal = useCallback(() => {
    if (seekBlobUrlRef.current) {
      URL.revokeObjectURL(seekBlobUrlRef.current);
      seekBlobUrlRef.current = null;
    }

    const streamUrl = liveStreamUrlRef.current || currentStation?.streamUrl;
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
    } else if (isPlaying && hasMediaRecorder) {
      const hasCapture = !!(globalAudio as any).captureStream || !!(globalAudio as any).mozCaptureStream;
      setRecordingAvailable(hasCapture);
    } else {
      setRecordingAvailable(false);
    }
  }, [bufferAvailable, isPlaying, hasMediaRecorder]);

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
