import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { RadioStation } from "@/types/radio";
import { toast } from "@/hooks/use-toast";
import { LocalNotifications } from "@capacitor/local-notifications";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isPlayingRef = useRef(false);
  const notifPermissionAsked = useRef(false);
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

  // Update Media Session metadata
  const updateMediaSession = useCallback((station: RadioStation, playing: boolean) => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: station.country || 'Radio Sphere',
      album: station.tags?.[0] || 'Live Radio',
      artwork: station.logo
        ? [
            { src: station.logo, sizes: '96x96', type: 'image/png' },
            { src: station.logo, sizes: '128x128', type: 'image/png' },
            { src: station.logo, sizes: '256x256', type: 'image/png' },
            { src: station.logo, sizes: '512x512', type: 'image/png' },
          ]
        : [],
    });

    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, []);

  // Register Media Session action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlePlay = () => {
      const audio = audioRef.current;
      if (!audio || !audio.src) return;
      audio.play().catch(() => {});
      setState(s => ({ ...s, isPlaying: true }));
      requestWakeLock();
    };

    const handlePause = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      setState(s => ({ ...s, isPlaying: false }));
      releaseWakeLock();
    };

    navigator.mediaSession.setActionHandler('play', handlePlay);
    navigator.mediaSession.setActionHandler('pause', handlePause);
    navigator.mediaSession.setActionHandler('stop', handlePause);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('stop', null);
    };
  }, [requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = state.volume;
    (audio as any).playsInline = true;
    audio.preload = "auto";
    audioRef.current = audio;

    audio.addEventListener("error", () => {
      setState(s => ({ ...s, isPlaying: false }));
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      toast({ title: "Erreur de lecture", description: "Impossible de lire ce flux. Essayez une autre station.", variant: "destructive" });
    });

    // Visibility change handler — resume audio if browser paused it
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlayingRef.current) {
        audio.play().catch(() => {});
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      audio.pause();
      audio.src = "";
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (notifPermissionAsked.current) return;
    notifPermissionAsked.current = true;
    try {
      const { display } = await LocalNotifications.requestPermissions();
      console.log("[RadioSphere] Notification permission:", display);
    } catch {
      // Not running in Capacitor — ignore
    }
  }, []);

  const play = useCallback((station: RadioStation) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Request notification permission on first play (needed for Android background audio)
    requestNotificationPermission();

    audio.src = station.streamUrl;
    audio.play().catch(() => {
      toast({ title: "Erreur", description: "Flux indisponible", variant: "destructive" });
    });
    setState(s => ({ ...s, currentStation: station, isPlaying: true }));
    onStationPlay?.(station);
    updateMediaSession(station, true);
    requestWakeLock();
    console.log("[RadioSphere] Audio ready");
  }, [onStationPlay, requestWakeLock, updateMediaSession, requestNotificationPermission]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !state.currentStation) return;
    if (state.isPlaying) {
      audio.pause();
      releaseWakeLock();
    } else {
      audio.play().catch(() => {});
      requestWakeLock();
    }
    const newPlaying = !state.isPlaying;
    setState(s => ({ ...s, isPlaying: newPlaying }));
    updateMediaSession(state.currentStation, newPlaying);
  }, [state.isPlaying, state.currentStation, releaseWakeLock, requestWakeLock, updateMediaSession]);

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
