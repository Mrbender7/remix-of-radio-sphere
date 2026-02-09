import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoritesContext } from "@/contexts/FavoritesContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { Play, Pause, ChevronDown, Radio, Volume2, Heart } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export function FullScreenPlayer() {
  const { currentStation, isPlaying, togglePlay, volume, setVolume, isFullScreen, closeFullScreen } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { t } = useTranslation();

  if (!isFullScreen || !currentStation) return null;

  const fav = isFavorite(currentStation.id);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={closeFullScreen} className="p-2 -ml-2">
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </button>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("player.nowPlaying")}</span>
        <div className="w-10" />
      </div>

      {/* Artwork */}
      <div className="flex-1 flex items-center justify-center px-10">
        <div className="w-full max-w-[300px] aspect-square rounded-2xl bg-accent shadow-2xl flex items-center justify-center overflow-hidden">
          {currentStation.logo ? (
            <img src={currentStation.logo} alt={currentStation.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <Radio className="w-24 h-24 text-primary/40" />
          )}
        </div>
      </div>

      {/* Info & Controls */}
      <div className="px-8 pb-8 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold leading-tight bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">{currentStation.name}</h2>
            <p className="text-sm text-muted-foreground">{currentStation.country} {currentStation.tags.length > 0 && `• ${currentStation.tags[0]}`}</p>
          </div>
          <button
            onClick={() => toggleFavorite(currentStation)}
            className="flex-shrink-0 p-2 rounded-full hover:bg-accent transition-colors"
          >
            <Heart className={`w-6 h-6 ${fav ? "fill-primary text-primary" : "text-muted-foreground"}`} />
          </button>
        </div>

        {/* Play button */}
        <div className="flex justify-center">
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-gradient-to-b from-primary to-primary/80 border-t border-white/20 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/40 active:shadow-sm active:translate-y-0.5 transition-all"
          >
            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[volume * 100]}
            onValueChange={([v]) => setVolume(v / 100)}
            max={100}
            step={1}
            className="flex-1"
          />
        </div>

        {/* Codec / Bitrate info */}
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          {currentStation.codec && <span>{currentStation.codec}</span>}
          {currentStation.bitrate > 0 && <span>{currentStation.bitrate} kbps</span>}
        </div>
      </div>
    </div>
  );
}
