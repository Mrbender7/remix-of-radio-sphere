import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { RadioStation } from "@/types/radio";
import { toast } from "@/hooks/use-toast";

// Global audio instance — survives React lifecycle, never destroyed by re-renders
const globalAudio = new Audio();
(globalAudio as any).playsInline = true;
globalAudio.preload = "auto";

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

    const artworkUrl = station.logo || 'https://placehold.co/512x512/000000/FFFFFF/png?text=Radio+Sphere';

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
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      toast({ title: "Erreur de lecture", description: "Impossible de lire ce flux. Essayez une autre station.", variant: "destructive" });
    };
    audio.addEventListener("error", handleError);

    // Anti-freeze: never let the WebView pause our audio
    const keepAlive = () => {
      if (isPlayingRef.current) {
        audio.play().catch(() => {});
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        requestWakeLock();
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
      releaseWakeLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback((station: RadioStation) => {
    const audio = audioRef.current;

    // On prépare d'abord le système Android
    updateMediaSession(station, true);

    if ('vibrate' in navigator) navigator.vibrate(10);
    audio.src = station.streamUrl;

    // Petit délai pour laisser Android créer le "canal" de notification
    setTimeout(() => {
      audio.play().then(() => {
        navigator.mediaSession.playbackState = 'playing';
      }).catch(() => {
        toast({ title: "Erreur", description: "Flux indisponible", variant: "destructive" });
      });
    }, 100);

    setState(s => ({ ...s, currentStation: station, isPlaying: true }));
    onStationPlay?.(station);
    requestWakeLock();
  }, [onStationPlay, requestWakeLock, updateMediaSession]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!state.currentStation) return;
    if (state.isPlaying) {
      audio.pause();
      releaseWakeLock();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    } else {
      audio.play().then(() => {
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }).catch(() => {});
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
