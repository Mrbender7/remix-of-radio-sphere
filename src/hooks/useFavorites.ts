import { useState, useCallback, useEffect } from "react";
import { RadioStation } from "@/types/radio";

const FAVORITES_KEY = "radioflow_favorites";
const RECENT_KEY = "radioflow_recent";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<RadioStation[]>(() =>
    loadFromStorage<RadioStation[]>(FAVORITES_KEY, []).sort((a, b) => a.name.localeCompare(b.name))
  );

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = useCallback((station: RadioStation) => {
    setFavorites(prev => {
      const exists = prev.some(s => s.id === station.id);
      const next = exists ? prev.filter(s => s.id !== station.id) : [...prev, station];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.some(s => s.id === id), [favorites]);

  const importFavorites = useCallback((stations: RadioStation[]) => {
    setFavorites(prev => {
      const existingUrls = new Set(prev.map(s => s.streamUrl));
      const newStations = stations.filter(s => !existingUrls.has(s.streamUrl));
      return [...prev, ...newStations].sort((a, b) => a.name.localeCompare(b.name));
    });
    return stations.length;
  }, []);

  return { favorites, toggleFavorite, isFavorite, importFavorites };
}

export function useRecentStations() {
  const [recent, setRecent] = useState<RadioStation[]>(() => loadFromStorage(RECENT_KEY, []));

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }, [recent]);

  const addRecent = useCallback((station: RadioStation) => {
    setRecent(prev => {
      const filtered = prev.filter(s => s.id !== station.id);
      return [station, ...filtered].slice(0, 20);
    });
  }, []);

  return { recent, addRecent };
}
