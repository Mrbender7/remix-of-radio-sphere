import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { RadioStation } from "@/types/radio";
import { toast } from "@/hooks/use-toast";
import { reportStationClick } from "@/services/RadioService";
import { notifyNativePlaybackState } from "@/plugins/RadioAutoPlugin";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCast } from "@/hooks/useCast";

// Note: The old Capawesome foreground service has been removed in v2.2.9.
// Lock screen / notification controls are now handled by the native MediaPlaybackService
// via notifyNativePlaybackState() which creates a proper MediaStyle notification.

// Global audio instance — survives React lifecycle, never destroyed by re-renders
// Exported so StreamBufferContext can swap src for seek-back
export const globalAudio = new Audio();
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
  isCastAvailable: boolean;
  isCasting: boolean;
  castDeviceName: string | null;
  castUiMode: import("@/hooks/useCast").CastUiMode;
  castInitState: import("@/hooks/useCast").CastInitState;
  startCast: () => void;
  stopCast: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be inside PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children, onStationPlay }: { children: React.ReactNode; onStationPlay?: (station: RadioStation) => void }) {
  const { t } = useTranslation();
  const { isCastAvailable, isCasting, castDeviceName, castUiMode, castInitState, startCast, stopCast, loadMedia: castLoadMedia, toggleCastPlayPause } = useCast();
  const audioRef = useRef<HTMLAudioElement>(globalAudio);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isPlayingRef = useRef(false);
  const notifPermissionAsked = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCanplayRef = useRef<(() => void) | null>(null);
  const pendingClearCanplayRef = useRef<(() => void) | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStationRef = useRef<RadioStation | null>(null);
  const reloadStreamRef = useRef<() => void>(() => {});
  const [state, setState] = useState<PlayerState>({
    currentStation: null,
    isPlaying: false,
    isBuffering: false,
    volume: 0.8,
    isFullScreen: false,
  });

  // Keep refs in sync with state
  useEffect(() => {
    isPlayingRef.current = state.isPlaying;
  }, [state.isPlaying]);

  useEffect(() => {
    currentStationRef.current = state.currentStation;
  }, [state.currentStation]);


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
      if (!isPlayingRef.current) return;

      const isDead = audio.paused ||
        audio.networkState === 3 /* NETWORK_NO_SOURCE */ ||
        (audio.readyState < 2 && !audio.paused);

      if (isDead) {
        console.log("[RadioSphere] Heartbeat: stream appears dead (paused:", audio.paused,
          "networkState:", audio.networkState, "readyState:", audio.readyState, ")");
        reloadStreamRef.current();
      }
    }, 10000);
  }, [requestWakeLock]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Reload stream completely (for dead stream recovery)
  const reloadStream = useCallback(() => {
    const audio = audioRef.current;
    const station = currentStationRef.current;
    if (!station || !station.streamUrl) return;
    if (retryCountRef.current >= 3) {
      console.warn("[RadioSphere] Max retries reached, giving up auto-reload");
      return;
    }
    retryCountRef.current += 1;
    console.log("[RadioSphere] Reloading stream (attempt", retryCountRef.current, "/ 3)");

    // Clean up pending listeners
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

    setState(s => ({ ...s, isBuffering: true }));

    audio.src = station.streamUrl;
    audio.load();

    const onCanplay = () => {
      audio.play().then(() => {
        retryCountRef.current = 0;
        setState(s => ({ ...s, isPlaying: true, isBuffering: false }));
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        startSilentLoop();
        startHeartbeat();
        requestWakeLock();
        if (station) {
          notifyNativePlaybackState(station, true);
        }
        console.log("[RadioSphere] Stream reloaded successfully");
      }).catch(() => {
        setState(s => ({ ...s, isPlaying: false, isBuffering: false }));
      });
      audio.removeEventListener('canplay', onCanplay);
      pendingCanplayRef.current = null;
    };
    audio.addEventListener('canplay', onCanplay);
    pendingCanplayRef.current = onCanplay;

    const timeout = setTimeout(() => {
      audio.removeEventListener('canplay', onCanplay);
      pendingCanplayRef.current = null;
      if (audio.readyState < 3) {
        console.warn("[RadioSphere] Stream reload timeout");
        setState(s => ({ ...s, isBuffering: false }));
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
  }, [requestWakeLock, startHeartbeat]);

  // Keep ref in sync
  useEffect(() => {
    reloadStreamRef.current = reloadStream;
  }, [reloadStream]);

  const updateMediaSession = useCallback((station: RadioStation, playing: boolean) => {
    if (!('mediaSession' in navigator)) return;
    // Use the app's own station placeholder when no logo — ensures the notification always shows a consistent image
    const artworkUrl = station.logo ? station.logo.replace('http://', 'https://') : new URL('/android-chrome-512x512.png', window.location.origin).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: "Radio Sphere",
      album: station.country || "Live",
      artwork: [{ src: artworkUrl, sizes: '512x512', type: 'image/png' }],
    });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, []);

  // Shared play/pause handlers used by MediaSession + native MediaStyle notification
  const handlePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    audio.play().catch(() => {});
    startSilentLoop();
    setState(s => {
      if (s.currentStation) notifyNativePlaybackState(s.currentStation, true);
      return { ...s, isPlaying: true };
    });
    requestWakeLock();
    startHeartbeat();
  }, [requestWakeLock, startHeartbeat]);

  const handlePause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    stopSilentLoop();
    setState(s => {
      if (s.currentStation) notifyNativePlaybackState(s.currentStation, false);
      return { ...s, isPlaying: false };
    });
    releaseWakeLock();
    stopHeartbeat();
  }, [releaseWakeLock, stopHeartbeat]);

  // Register Media Session action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

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
  }, [handlePlay, handlePause]);

  // Old Capawesome foreground service listener removed in v2.2.9
  // Notification buttons are now handled by MediaPlaybackService via mediaToggle event

  // v2.2.9: Listen for MediaStyle notification toggle (native MediaPlaybackService)
  useEffect(() => {
    let mediaToggleRemove: (() => void) | null = null;
    import('@/plugins/RadioAutoPlugin').then(({ RadioAutoPlugin }) => {
      // Reuse the already-registered plugin instance (avoid double registration)
      RadioAutoPlugin.addListener('mediaToggle', () => {
        console.log("[RadioSphere] mediaToggle event from native notification");
        if (isPlayingRef.current) {
          handlePause();
        } else {
          handlePlay();
        }
      }).then((listener: { remove: () => void }) => {
        mediaToggleRemove = () => listener.remove();
      });
    }).catch(() => {});

    return () => {
      if (mediaToggleRemove) mediaToggleRemove();
    };
  }, [handlePlay, handlePause]);

  // Request notification permission at startup (native Android 13+ needs Capacitor API)
  useEffect(() => {
    if (notifPermissionAsked.current) return;
    notifPermissionAsked.current = true;

    const requestNotifPermission = async () => {
      try {
        // Try native Capacitor LocalNotifications first (triggers real Android dialog on API 33+)
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const permStatus = await LocalNotifications.checkPermissions();
        console.log("[RadioSphere] Notification permission status:", permStatus.display);
        if (permStatus.display === "prompt" || permStatus.display === "prompt-with-rationale") {
          const result = await LocalNotifications.requestPermissions();
          console.log("[RadioSphere] Notification permission result:", result.display);
        }
      } catch {
        // Fallback: Web API (works in browser, not in Capacitor WebView for Android 13+)
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().then(p => {
            console.log("[RadioSphere] Notification permission (web fallback):", p);
          });
        }
      }
    };

    requestNotifPermission();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = state.volume;

    const handleError = () => {
      setState(s => ({ ...s, isPlaying: false }));
      stopSilentLoop();
      stopHeartbeat();
      notifyNativePlaybackState(null, false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      toast({ title: t("player.streamError"), description: t("player.streamErrorDesc"), variant: "destructive" });
    };
    audio.addEventListener("error", handleError);

    // Stalled / ended listeners — auto-reload dead streams
    const handleStalled = () => {
      if (!isPlayingRef.current) return;
      console.log("[RadioSphere] Stream stalled, scheduling reload in 2s");
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        if (isPlayingRef.current && (audio.readyState < 2 || audio.networkState === 3)) {
          reloadStreamRef.current();
        }
      }, 2000);
    };
    const handleEnded = () => {
      if (!isPlayingRef.current) return;
      console.log("[RadioSphere] Stream ended, reloading in 2s");
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        reloadStreamRef.current();
      }, 2000);
    };
    audio.addEventListener("stalled", handleStalled);
    audio.addEventListener("ended", handleEnded);

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
      audio.removeEventListener("stalled", handleStalled);
      audio.removeEventListener("ended", handleEnded);
      document.removeEventListener('visibilitychange', keepAlive);
      window.removeEventListener('blur', keepAlive);
      window.removeEventListener('focus', keepAlive);
      stopHeartbeat();
      releaseWakeLock();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback(async (station: RadioStation) => {
    try {
      if (!station.streamUrl) {
        console.error('[RadioSphere] Cannot play station with no stream URL.');
        toast({ title: t("player.error"), description: t("player.streamUnavailable"), variant: "destructive" });
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

      retryCountRef.current = 0;
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
            notifyNativePlaybackState(station, true);
          })
          .catch((e) => {
            console.error("[RadioSphere] Playback failed", e);
            notifyNativePlaybackState(null, false);
            stopSilentLoop();
            stopHeartbeat();
            releaseWakeLock();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
            setState(s => ({ ...s, isPlaying: false, isBuffering: false }));
            toast({ title: t("player.streamError"), description: t("player.streamErrorDesc"), variant: "destructive" });
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
          notifyNativePlaybackState(null, false);
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
          setState(s => ({ ...s, isPlaying: false, isBuffering: false }));
          toast({ title: t("player.timeout"), description: t("player.timeoutDesc"), variant: "destructive" });
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

      // Send to Chromecast if casting
      if (isCasting) {
        castLoadMedia(station);
      }
    } catch (e) {
      console.error("[RadioSphere] Unexpected error in play()", e);
      setState(s => ({ ...s, isPlaying: false, isBuffering: false }));
      toast({ title: t("player.unexpectedError"), description: t("player.unexpectedErrorDesc"), variant: "destructive" });
    }
  }, [onStationPlay, requestWakeLock, releaseWakeLock, updateMediaSession, startHeartbeat, stopHeartbeat, isCasting, castLoadMedia]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!state.currentStation) return;

    if (isCasting) {
      // When casting: only control Chromecast, don't touch local audio
      toggleCastPlayPause();
      if (state.isPlaying) {
        notifyNativePlaybackState(state.currentStation, false);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        setState(s => ({ ...s, isPlaying: false }));
        updateMediaSession(state.currentStation, false);
      } else {
        notifyNativePlaybackState(state.currentStation, true);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        setState(s => ({ ...s, isPlaying: true }));
        updateMediaSession(state.currentStation, true);
      }
      return;
    }

    if (state.isPlaying) {
      audio.pause();
      stopSilentLoop();
      stopHeartbeat();
      releaseWakeLock();
      retryCountRef.current = 0;
      notifyNativePlaybackState(state.currentStation, false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      setState(s => ({ ...s, isPlaying: false }));
      updateMediaSession(state.currentStation, false);
    } else {
      audio.play().then(() => {
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        retryCountRef.current = 0;
        setState(s => ({ ...s, isPlaying: true }));
        startSilentLoop();
        startHeartbeat();
        requestWakeLock();
        notifyNativePlaybackState(state.currentStation!, true);
        updateMediaSession(state.currentStation!, true);
      }).catch(() => {
        console.log("[RadioSphere] togglePlay: play() failed, reloading stream");
        retryCountRef.current = 0;
        reloadStream();
      });
    }
  }, [state.isPlaying, state.currentStation, releaseWakeLock, requestWakeLock, updateMediaSession, startHeartbeat, stopHeartbeat, reloadStream, isCasting, toggleCastPlayPause]);

  const setVolume = useCallback((v: number) => {
    if (audioRef.current) audioRef.current.volume = v;
    setState(s => ({ ...s, volume: v }));
  }, []);

  // Auto-push media to Chromecast when session starts or station changes
  // Also pause/resume local audio on Cast connect/disconnect
  const lastCastStationIdRef = useRef<string | null>(null);
  const wasCastingRef = useRef(false);
  useEffect(() => {
    const audio = audioRef.current;

    if (isCasting && !wasCastingRef.current) {
      // Cast just connected → pause local audio
      console.log("[RadioSphere] Cast connected — pausing local audio");
      audio.pause();
      stopSilentLoop();
    } else if (!isCasting && wasCastingRef.current) {
      // Cast just disconnected → resume local audio if we were playing
      console.log("[RadioSphere] Cast disconnected — resuming local audio");
      if (state.isPlaying && state.currentStation) {
        audio.play().catch(() => {});
        startSilentLoop();
      }
    }
    wasCastingRef.current = isCasting;

    if (isCasting && state.currentStation) {
      // Guard: don't re-push the same station
      if (lastCastStationIdRef.current !== state.currentStation.id) {
        lastCastStationIdRef.current = state.currentStation.id;
        castLoadMedia(state.currentStation);
      }
    }
    if (!isCasting) {
      lastCastStationIdRef.current = null;
    }
  }, [isCasting, state.currentStation, state.isPlaying, castLoadMedia]);

  const openFullScreen = useCallback(() => setState(s => ({ ...s, isFullScreen: true })), []);
  const closeFullScreen = useCallback(() => setState(s => ({ ...s, isFullScreen: false })), []);

  return (
    <PlayerContext.Provider value={{ ...state, play, togglePlay, setVolume, openFullScreen, closeFullScreen, isCastAvailable, isCasting, castDeviceName, castUiMode, castInitState, startCast, stopCast }}>
      {children}
    </PlayerContext.Provider>
  );
}
