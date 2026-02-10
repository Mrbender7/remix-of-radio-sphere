import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { RadioStation } from "@/types/radio";
import { toast } from "@/hooks/use-toast";

// --- Android Foreground Service helpers (Capacitor only) ---
async function startNativeForegroundService(station: RadioStation) {
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.startForegroundService({
      id: 1,
      title: station.name,
      body: station.country || 'Radio Sphere',
      smallIcon: 'ic_stat_radio',
      // serviceType mediaPlayback = 2
      serviceType: 2,
    } as any);
    console.log("[RadioSphere] Foreground service started");
  } catch (e) {
    console.log("[RadioSphere] Foreground service not available", e);
  }
}

async function stopNativeForegroundService() {
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.stopForegroundService();
    console.log("[RadioSphere] Foreground service stopped");
  } catch (e) {
    console.log("[RadioSphere] Foreground service stop failed", e);
  }
}

// Global audio instance — survives React lifecycle, never destroyed by re-renders
const globalAudio = new Audio();
(globalAudio as any).playsInline = true;
globalAudio.preload = "auto";

// Silent 1-second WAV as base64 data URI (~1KB) — keeps Android WebView process alive
const SILENCE_DATA_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
const silentAudio = new Audio();
silentAudio.loop = true;
silentAudio.volume = 0.01;
silentAudio.src = SILENCE_DATA_URI;

function startSilentLoop() {
  silentAudio.play().catch(() => {});
}

function stopSilentLoop() {
  silentAudio.pause();
  silentAudio.currentTime = 0;
}

interface PlayerState {
  currentStation: RadioStation | null;
  isPlaying: boolean;
  volume: number;
  isFullScreen: boolean;
}

interface PlayerContextType extends PlayerState {
  play: (station: RadioStation) => void;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  openFullScreen: () => void;
  closeFullScreen: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be inside PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children, onStationPlay }: { children: React.ReactNode; onStationPlay?: (station: RadioStation) => void }) {
  const audioRef = useRef<HTMLAudioElement>(globalAudio);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isPlayingRef = useRef(false);
  const notifPermissionAsked = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentStation: null,
    isPlaying: false,
    volume: 0.8,
    isFullScreen: false,
  });

  // Keep ref in sync with state
  useEffect(() => {
    isPlayingRef.current = state.isPlaying;
  }, [state.isPlaying]);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // WakeLock request failed (e.g. low battery)
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Start heartbeat — recovers from unexpected pauses every 10s
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return;
    heartbeatRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (isPlayingRef.current && audio.paused) {
        console.log("[RadioSphere] Heartbeat: recovering paused audio");
        audio.play().catch(() => {});
        startSilentLoop();
        requestWakeLock();
      }
    }, 10000);
  }, [requestWakeLock]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Update Media Session metadata
  const updateMediaSession = useCallback((station: RadioStation, playing: boolean) => {
    if (!('mediaSession' in navigator)) return;

    const artworkUrl = station.logo ? station.logo.replace('http://', 'https://') : 'https://placehold.co/512x512.png';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: "Radio Sphere",
      album: station.country || "Live",
      artwork: [
        { src: artworkUrl, sizes: '512x512', type: 'image/png' }
      ],
    });

    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, []);

  // Register Media Session action handlers (including no-op seek handlers)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlePlay = () => {
      const audio = audioRef.current;
      if (!audio || !audio.src) return;
      audio.play().catch(() => {});
      startSilentLoop();
      setState(s => {
        if (s.currentStation) startNativeForegroundService(s.currentStation);
        return { ...s, isPlaying: true };
      });
      requestWakeLock();
      startHeartbeat();
    };

    const handlePause = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      stopSilentLoop();
      setState(s => ({ ...s, isPlaying: false }));
      releaseWakeLock();
      stopHeartbeat();
      stopNativeForegroundService();
    };

    const noop = () => {};

    navigator.mediaSession.setActionHandler('play', handlePlay);
    navigator.mediaSession.setActionHandler('pause', handlePause);
    navigator.mediaSession.setActionHandler('stop', handlePause);
    navigator.mediaSession.setActionHandler('seekbackward', noop);
    navigator.mediaSession.setActionHandler('seekforward', noop);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('stop', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
    };
  }, [requestWakeLock, releaseWakeLock, startHeartbeat, stopHeartbeat]);

  // Request notification permission at startup (needed for Android background audio)
  useEffect(() => {
    if (notifPermissionAsked.current) return;
    notifPermissionAsked.current = true;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(p => {
        console.log("[RadioSphere] Notification permission:", p);
      });
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = state.volume;

    const handleError = () => {
      setState(s => ({ ...s, isPlaying: false }));
      stopSilentLoop();
      stopHeartbeat();
      stopNativeForegroundService();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      toast({ title: "Erreur de lecture", description: "Impossible de lire ce flux. Essayez une autre station.", variant: "destructive" });
    };
    audio.addEventListener("error", handleError);

    // Enhanced keep-alive: restart audio + silent loop + WakeLock on visibility changes
    const keepAlive = () => {
      if (isPlayingRef.current) {
        audio.play().catch(() => {});
        startSilentLoop();
        requestWakeLock();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }
    };
    document.addEventListener('visibilitychange', keepAlive);
    window.addEventListener('blur', keepAlive);
    window.addEventListener('focus', keepAlive);

    return () => {
      audio.removeEventListener("error", handleError);
      document.removeEventListener('visibilitychange', keepAlive);
      window.removeEventListener('blur', keepAlive);
      window.removeEventListener('focus', keepAlive);
      stopHeartbeat();
      releaseWakeLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback((station: RadioStation) => {
    const audio = audioRef.current;
    audio.pause();

    const secureLogo = station.logo?.replace('http://', 'https://');
    updateMediaSession({ ...station, logo: secureLogo }, true);

    if ('vibrate' in navigator) navigator.vibrate(10);
    audio.src = station.streamUrl;
    audio.load();

    const startPlayback = () => {
      audio.play()
        .then(() => {
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
          setState(s => ({ ...s, isPlaying: true }));
          startSilentLoop();
          startHeartbeat();
          startNativeForegroundService(station);
        })
        .catch((e) => {
          console.error("Lecture différée échouée", e);
        });
      audio.removeEventListener('canplay', startPlayback);
    };
    audio.addEventListener('canplay', startPlayback);

    setState(s => ({ ...s, currentStation: station }));
    onStationPlay?.(station);
    requestWakeLock();
  }, [onStationPlay, requestWakeLock, updateMediaSession, startHeartbeat]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!state.currentStation) return;
    if (state.isPlaying) {
      audio.pause();
      stopSilentLoop();
      stopHeartbeat();
      releaseWakeLock();
      stopNativeForegroundService();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    } else {
      audio.play().then(() => {
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }).catch(() => {});
      startSilentLoop();
      startHeartbeat();
      requestWakeLock();
      startNativeForegroundService(state.currentStation);
    }
    const newPlaying = !state.isPlaying;
    setState(s => ({ ...s, isPlaying: newPlaying }));
    updateMediaSession(state.currentStation, newPlaying);
  }, [state.isPlaying, state.currentStation, releaseWakeLock, requestWakeLock, updateMediaSession, startHeartbeat, stopHeartbeat]);

  const setVolume = useCallback((v: number) => {
    if (audioRef.current) audioRef.current.volume = v;
    setState(s => ({ ...s, volume: v }));
  }, []);

  const openFullScreen = useCallback(() => setState(s => ({ ...s, isFullScreen: true })), []);
  const closeFullScreen = useCallback(() => setState(s => ({ ...s, isFullScreen: false })), []);

  return (
    <PlayerContext.Provider value={{ ...state, play, togglePlay, setVolume, openFullScreen, closeFullScreen }}>
      {children}
    </PlayerContext.Provider>
  );
}
