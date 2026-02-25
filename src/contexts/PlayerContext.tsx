import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { RadioStation } from "@/types/radio";
import { toast } from "@/hooks/use-toast";
import { reportStationClick } from "@/services/RadioService";
import { notifyNativePlaybackState } from "@/plugins/RadioAutoPlugin";

// --- Notification channel (created once via plugin JS API) ---
const NOTIFICATION_CHANNEL_ID = 'radio_playback_v3';
let channelCreated = false;

async function ensureNotificationChannel() {
  if (channelCreated) return;
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await (ForegroundService as any).createNotificationChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: 'Radio Playback',
      description: 'Notification silencieuse pour la lecture radio',
      importance: 2, // LOW — no sound, no vibration, visible in tray & lockscreen
      sound: undefined,
      vibration: false,
    });
    channelCreated = true;
    console.log("[RadioSphere] Notification channel created via plugin JS:", NOTIFICATION_CHANNEL_ID);
  } catch (e) {
    console.log("[RadioSphere] createNotificationChannel not available", e);
  }
}

function getStationSubtitle(station: RadioStation): string {
  if (station.tags && station.tags.length > 0) return station.tags.slice(0, 2).join(' • ');
  return station.country || 'Radio Sphere';
}

// --- Android Foreground Service helpers (Capacitor only) ---
async function startNativeForegroundService(station: RadioStation, isPaused = false) {
  try {
    await ensureNotificationChannel();
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.startForegroundService({
      id: 1,
      title: station.name,
      body: getStationSubtitle(station),
      smallIcon: 'ic_notification',
      serviceType: 2,
      silent: true,
      notificationChannelId: NOTIFICATION_CHANNEL_ID,
      buttons: [
        { title: isPaused ? '▶ Play' : '⏸ Pause', id: isPaused ? 1 : 2 }
      ],
    } as any);
    console.log("[RadioSphere] Foreground service started (channel:", NOTIFICATION_CHANNEL_ID, ")");
  } catch (e) {
    console.log("[RadioSphere] Foreground service not available", e);
  }
}

async function updateNativeForegroundService(station: RadioStation, isPaused: boolean) {
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await (ForegroundService as any).updateForegroundService({
      id: 1,
      title: station.name,
      body: getStationSubtitle(station),
      smallIcon: 'ic_notification',
      notificationChannelId: NOTIFICATION_CHANNEL_ID,
      buttons: [
        { title: isPaused ? '▶ Play' : '⏸ Pause', id: isPaused ? 1 : 2 }
      ],
    });
    console.log("[RadioSphere] Foreground service updated");
  } catch (e) {
    console.log("[RadioSphere] Foreground service update failed", e);
  }
}

async function stopNativeForegroundService() {
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.stopForegroundService();
    foregroundServiceRunning = false;
    console.log("[RadioSphere] Foreground service stopped");
  } catch (e) {
    console.log("[RadioSphere] Foreground service stop failed", e);
  }
}

// Flag: foreground service is currently running
let foregroundServiceRunning = false;

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
  isBuffering: boolean;
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
  const pendingCanplayRef = useRef<(() => void) | null>(null);
  const pendingClearCanplayRef = useRef<(() => void) | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentStation: null,
    isPlaying: false,
    isBuffering: false,
    volume: 0.8,
    isFullScreen: false,
  });

  // Keep ref in sync with state
  useEffect(() => {
    isPlayingRef.current = state.isPlaying;
  }, [state.isPlaying]);

  // Create notification channel once at mount
  useEffect(() => {
    ensureNotificationChannel();
  }, []);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // WakeLock request failed
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

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

  const updateMediaSession = useCallback((station: RadioStation, playing: boolean) => {
    if (!('mediaSession' in navigator)) return;
    const artworkUrl = station.logo ? station.logo.replace('http://', 'https://') : 'https://placehold.co/512x512.png';
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: "Radio Sphere",
      album: station.country || "Live",
      artwork: [{ src: artworkUrl, sizes: '512x512', type: 'image/png' }],
    });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, []);

  // Register Media Session action handlers + Foreground Service button listener
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlePlay = () => {
      const audio = audioRef.current;
      if (!audio || !audio.src) return;
      audio.play().catch(() => {});
      startSilentLoop();
      setState(s => {
        if (s.currentStation) startNativeForegroundService(s.currentStation, false);
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
      setState(s => {
        if (s.currentStation) updateNativeForegroundService(s.currentStation, true);
        return { ...s, isPlaying: false };
      });
      releaseWakeLock();
      stopHeartbeat();
    };

    const noop = () => {};
    navigator.mediaSession.setActionHandler('play', handlePlay);
    navigator.mediaSession.setActionHandler('pause', handlePause);
    navigator.mediaSession.setActionHandler('stop', handlePause);
    navigator.mediaSession.setActionHandler('seekbackward', noop);
    navigator.mediaSession.setActionHandler('seekforward', noop);

    // Listen for notification button clicks (Android foreground service)
    let buttonListenerRemove: (() => void) | null = null;
    import('@capawesome-team/capacitor-android-foreground-service').then(({ ForegroundService }) => {
      ForegroundService.addListener('buttonClicked', (event: any) => {
        const btnId = event?.buttonId ?? event?.id;
        if (btnId === 1) handlePlay();   // Play button
        if (btnId === 2) handlePause();  // Pause button
      }).then(listener => {
        buttonListenerRemove = () => listener.remove();
      });
    }).catch(() => {});

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('stop', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      if (buttonListenerRemove) buttonListenerRemove();
    };
  }, [requestWakeLock, releaseWakeLock, startHeartbeat, stopHeartbeat]);

  // Request notification permission at startup
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

  const play = useCallback(async (station: RadioStation) => {
    try {
      if (!station.streamUrl) {
        console.error('[RadioSphere] Cannot play station with no stream URL.');
        toast({ title: "Flux indisponible", description: "Cette station n'a pas d'URL de flux.", variant: "destructive" });
        return;
      }

      const audio = audioRef.current;

      // --- Cleanup previous pending listeners/timeouts ---
      if (pendingCanplayRef.current) {
        audio.removeEventListener('canplay', pendingCanplayRef.current);
        pendingCanplayRef.current = null;
      }
      if (pendingClearCanplayRef.current) {
        audio.removeEventListener('canplay', pendingClearCanplayRef.current);
        pendingClearCanplayRef.current = null;
      }
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }

      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      stopSilentLoop();
      stopHeartbeat();
      releaseWakeLock();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';

      setState(s => ({ ...s, currentStation: station, isBuffering: true, isPlaying: false }));
      const secureLogo = station.logo?.replace('http://', 'https://');
      updateMediaSession({ ...station, logo: secureLogo }, true);

      if ('vibrate' in navigator) navigator.vibrate(10);
      audio.src = station.streamUrl;
      audio.load();

      const startPlayback = () => {
        audio.play()
          .then(() => {
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            setState(s => ({ ...s, isPlaying: true, isBuffering: false }));
            notifyNativePlaybackState(station, true);
            startSilentLoop();
            startHeartbeat();
            if (foregroundServiceRunning) {
              updateNativeForegroundService(station, false);
            } else {
              startNativeForegroundService(station, false).then(() => { foregroundServiceRunning = true; });
            }
          })
          .catch((e) => {
            console.error("[RadioSphere] Playback failed", e);
            stopNativeForegroundService();
            stopSilentLoop();
            stopHeartbeat();
            releaseWakeLock();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
            setState(s => ({ ...s, isPlaying: false, isBuffering: false }));
            toast({ title: "Erreur de lecture", description: "Impossible de lire ce flux. Essayez une autre station.", variant: "destructive" });
          });
        audio.removeEventListener('canplay', startPlayback);
        pendingCanplayRef.current = null;
      };
      audio.addEventListener('canplay', startPlayback);
      pendingCanplayRef.current = startPlayback;

      const timeout = setTimeout(() => {
        audio.removeEventListener('canplay', startPlayback);
        pendingCanplayRef.current = null;
        pendingTimeoutRef.current = null;
        if (audio.readyState < 3) {
          console.warn("[RadioSphere] Stream timeout — no canplay after 15s");
          audio.pause();
          audio.removeAttribute('src');
          stopNativeForegroundService();
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
          setState(s => ({ ...s, isPlaying: false, isBuffering: false }));
          toast({ title: "Délai dépassé", description: "Le flux ne répond pas. Essayez une autre station.", variant: "destructive" });
        }
      }, 15000);
      pendingTimeoutRef.current = timeout;

      const clearTimeoutOnCanplay = () => {
        clearTimeout(timeout);
        pendingTimeoutRef.current = null;
        audio.removeEventListener('canplay', clearTimeoutOnCanplay);
        pendingClearCanplayRef.current = null;
      };
      audio.addEventListener('canplay', clearTimeoutOnCanplay);
      pendingClearCanplayRef.current = clearTimeoutOnCanplay;

      onStationPlay?.(station);
      reportStationClick(station.id);
      requestWakeLock();
    } catch (e) {
      console.error("[RadioSphere] Unexpected error in play()", e);
      setState(s => ({ ...s, isPlaying: false, isBuffering: false }));
      toast({ title: "Erreur inattendue", description: "Une erreur est survenue. Réessayez.", variant: "destructive" });
    }
  }, [onStationPlay, requestWakeLock, releaseWakeLock, updateMediaSession, startHeartbeat, stopHeartbeat]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!state.currentStation) return;
    if (state.isPlaying) {
      audio.pause();
      stopSilentLoop();
      stopHeartbeat();
      releaseWakeLock();
      updateNativeForegroundService(state.currentStation, true);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    } else {
      audio.play().then(() => {
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }).catch(() => {});
      startSilentLoop();
      startHeartbeat();
      requestWakeLock();
      startNativeForegroundService(state.currentStation, false);
    }
    const newPlaying = !state.isPlaying;
    setState(s => ({ ...s, isPlaying: newPlaying }));
    updateMediaSession(state.currentStation, newPlaying);
    notifyNativePlaybackState(state.currentStation, newPlaying);
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
