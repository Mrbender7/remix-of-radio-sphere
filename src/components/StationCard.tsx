import { RadioStation } from "@/types/radio";
import { usePlayer } from "@/contexts/PlayerContext";
import { Heart, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import stationPlaceholder from "@/assets/station-placeholder.png";

interface StationCardProps {
  station: RadioStation;
  isFavorite: boolean;
  onToggleFavorite: (station: RadioStation) => void;
  compact?: boolean;
}

function StationLogo({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const secureSrc = src?.replace('http://', 'https://');
  return (
    <img
      src={secureSrc || stationPlaceholder}
      alt={alt}
      loading="lazy"
      className={cn("w-full h-full object-cover", className)}
      onError={e => { (e.target as HTMLImageElement).src = stationPlaceholder; }}
    />
  );
}

export function StationCard({ station, isFavorite, onToggleFavorite, compact }: StationCardProps) {
  const { play, currentStation, isPlaying } = usePlayer();
  const isActive = currentStation?.id === station.id;

  if (compact) {
    return (
      <button
        onClick={() => play(station)}
        className={cn(
          "flex items-center gap-3 w-full p-3 rounded-lg transition-colors",
          isActive ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-accent"
        )}
      >
        <div className="w-12 h-12 rounded-md bg-accent flex items-center justify-center overflow-hidden flex-shrink-0">
          <StationLogo src={station.logo} alt={station.name} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={cn("text-sm font-medium truncate", isActive && "text-primary")}>{station.name}</p>
          <p className="text-xs text-muted-foreground truncate">{station.country}{station.tags[0] ? ` • ${station.tags[0]}` : ''}</p>
        </div>
        {isActive && isPlaying && (
          <div className="flex gap-0.5 items-end h-4">
            <span className="w-1 rounded-full animate-pulse bg-[hsl(225,90%,58%)]" style={{ height: '60%' }} />
            <span className="w-1 rounded-full animate-pulse bg-[hsl(225,90%,58%)]" style={{ height: '100%', animationDelay: '0.15s' }} />
            <span className="w-1 rounded-full animate-pulse bg-[hsl(225,90%,58%)]" style={{ height: '40%', animationDelay: '0.3s' }} />
          </div>
        )}
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite(station); }}
          className="p-1.5"
        >
          <Heart className={cn("w-4 h-4", isFavorite ? "fill-[hsl(280,80%,60%)] text-[hsl(280,80%,60%)]" : "text-muted-foreground")} />
        </button>
      </button>
    );
  }

  return (
    <button
      onClick={() => play(station)}
      className="group relative flex flex-col items-center w-36 flex-shrink-0 p-3 rounded-xl transition-colors [@media(hover:hover)]:hover:bg-accent"
    >
      <div className="relative w-28 h-28 rounded-xl bg-accent mb-2 overflow-hidden shadow-lg">
        <StationLogo src={station.logo} alt={station.name} />
        <div className="absolute inset-0 bg-black/40 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <Play className="w-8 h-8 text-white" />
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite(station); }}
          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/30 backdrop-blur-sm z-10"
        >
          <Heart className={cn("w-3.5 h-3.5", isFavorite ? "fill-[hsl(280,80%,60%)] text-[hsl(280,80%,60%)]" : "text-white/80")} />
        </button>
      </div>
      <p className="text-xs font-medium text-foreground truncate w-full text-center">{station.name}</p>
      <p className="text-[10px] text-muted-foreground truncate w-full text-center">{station.country}</p>
    </button>
  );
}
