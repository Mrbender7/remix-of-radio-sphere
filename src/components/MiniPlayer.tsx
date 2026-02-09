import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoritesContext } from "@/contexts/FavoritesContext";
import { Play, Pause, Radio, Heart } from "lucide-react";

export function MiniPlayer() {
  const { currentStation, isPlaying, togglePlay, openFullScreen } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavoritesContext();

  if (!currentStation) return null;

  const fav = isFavorite(currentStation.id);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 bg-secondary/80 backdrop-blur-lg border-t border-border cursor-pointer"
      onClick={openFullScreen}
    >
      <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center overflow-hidden flex-shrink-0">
        {currentStation.logo ? (
          <img src={currentStation.logo} alt={currentStation.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <Radio className="w-5 h-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">{currentStation.name}</p>
        <p className="text-xs text-muted-foreground truncate">{currentStation.country}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); toggleFavorite(currentStation); }}
        className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
      >
        <Heart className={`w-4 h-4 ${fav ? "fill-primary text-primary" : ""}`} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); togglePlay(); }}
        className="w-9 h-9 rounded-full bg-gradient-to-b from-primary to-primary/80 border-t border-white/20 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/40 active:shadow-sm active:translate-y-0.5 transition-all"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
    </div>
  );
}
