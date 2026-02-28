import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoritesContext } from "@/contexts/FavoritesContext";
import { useRef, useEffect, useState } from "react";
import { Play, Pause, Heart, Loader2, Cast } from "lucide-react";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import stationPlaceholder from "@/assets/station-placeholder.png";

export function MiniPlayer() {
  const { currentStation, isPlaying, isBuffering, togglePlay, openFullScreen, isCasting, castDeviceName } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [needsMarquee, setNeedsMarquee] = useState(false);

  useEffect(() => {
    const check = () => {
      if (measureRef.current && containerRef.current) {
        setNeedsMarquee(measureRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [currentStation?.name]);

  if (!currentStation) return null;

  const fav = isFavorite(currentStation.id);

  return (
    <div
      className="fixed left-0 right-0 z-30 flex items-center gap-3 px-4 py-2 bg-secondary/80 backdrop-blur-lg border-t border-border cursor-pointer"
      style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
      onClick={openFullScreen}
    >
      <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center overflow-hidden flex-shrink-0">
        {currentStation.logo ? (
          <img src={currentStation.logo.replace('http://', 'https://')} alt={currentStation.name} loading="lazy" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = stationPlaceholder; }} />
        ) : (
          <img src={stationPlaceholder} alt={currentStation.name} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {/* Hidden measurer */}
        <span ref={measureRef} className="text-lg font-heading font-bold whitespace-nowrap absolute invisible pointer-events-none">{currentStation.name}</span>
        <div ref={containerRef} className="overflow-hidden">
          <p className={`text-lg font-heading font-bold bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent whitespace-nowrap ${needsMarquee ? "w-fit animate-marquee" : ""}`}>
            {needsMarquee
              ? <>{currentStation.name}&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;{currentStation.name}&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;</>
              : currentStation.name
            }
          </p>
        </div>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          {isCasting && (
            <>
              <Cast className="w-3 h-3 text-primary" />
              <span className="text-primary font-medium">{castDeviceName || 'Cast'}</span>
              <span>•</span>
            </>
          )}
          {currentStation.tags.length > 0 ? currentStation.tags.slice(0, 2).join(' • ') : ''}
        </p>
      </div>
      {isPlaying && (
        <AudioVisualizer size="medium" />
      )}
      <button
        onClick={e => { e.stopPropagation(); toggleFavorite(currentStation); }}
        className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
      >
        <Heart className={`w-4 h-4 ${fav ? "fill-[hsl(280,80%,60%)] text-[hsl(280,80%,60%)]" : ""}`} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); togglePlay(); }}
        className={`w-11 h-11 rounded-full bg-gradient-to-b from-primary to-primary/80 border-t border-white/20 flex items-center justify-center text-primary-foreground active:shadow-sm active:translate-y-0.5 transition-all ${isPlaying ? "animate-play-breathe" : "shadow-lg shadow-primary/50"}`}
      >
        {isBuffering ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>
    </div>
  );
}
