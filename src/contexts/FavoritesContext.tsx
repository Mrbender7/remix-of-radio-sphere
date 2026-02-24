import { createContext, useContext, ReactNode, useEffect } from "react";
import { useFavorites, useRecentStations } from "@/hooks/useFavorites";
import { RadioStation } from "@/types/radio";
import { syncFavoritesToNative, syncRecentsToNative } from "@/plugins/RadioAutoPlugin";

interface FavoritesContextType {
  favorites: RadioStation[];
  toggleFavorite: (station: RadioStation) => void;
  isFavorite: (id: string) => boolean;
  recent: RadioStation[];
  addRecent: (station: RadioStation) => void;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { recent, addRecent } = useRecentStations();

  // Sync favorites to native Android Auto SharedPreferences
  useEffect(() => {
    syncFavoritesToNative(favorites);
  }, [favorites]);

  // Sync recents to native Android Auto SharedPreferences
  useEffect(() => {
    syncRecentsToNative(recent);
  }, [recent]);

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite, recent, addRecent }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavoritesContext() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavoritesContext must be used within FavoritesProvider");
  return ctx;
}
