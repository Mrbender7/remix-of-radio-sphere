import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoritesContext } from "@/contexts/FavoritesContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { Play, Pause, ChevronDown, Volume2, Heart, Loader2, ExternalLink, Share2, Cast } from "lucide-react";
import { CastButton } from "@/components/CastButton";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import stationPlaceholder from "@/assets/station-placeholder.png";

export function FullScreenPlayer({ onTagClick }: { onTagClick?: (tag: string) => void }) {
  const { currentStation, isPlaying, isBuffering, togglePlay, volume, setVolume, isFullScreen, closeFullScreen, isCasting, castDeviceName } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { t } = useTranslation();

  if (!isFullScreen || !currentStation) return null;

  const fav = isFavorite(currentStation.id);

  const handleShare = async () => {
    const text = currentStation.homepage
      ? `${t("player.nowPlaying")}: ${currentStation.name} — ${currentStation.homepage}`
      : `${t("player.nowPlaying")}: ${currentStation.name}`;
    const shareData = {
      title: currentStation.name,
      text,
      ...(currentStation.homepage ? { url: currentStation.homepage } : {}),
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Lien copié !");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Lien copié !");
      } catch { /* silent */ }
    }
  };

  const handleOpenWebsite = async () => {
    if (!currentStation.homepage) return;
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: currentStation.homepage });
    } catch {
      window.open(currentStation.homepage, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2" style={{ paddingTop: "max(env(safe-area-inset-top, 24px), 1.5rem)" }}>
        <button onClick={closeFullScreen} className="p-2 -ml-2">
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </button>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("player.nowPlaying")}</span>
        <div className="flex items-center gap-1 -mr-2">
          {currentStation.homepage && (
            <button onClick={handleOpenWebsite} className="w-9 h-9 rounded-full bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] flex items-center justify-center text-[10px] font-extrabold text-white shadow-md shadow-primary/30 hover:opacity-90 transition-opacity">
              www
            </button>
          )}
          <CastButton />
          <button onClick={handleShare} className="p-2">
            <Share2 className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Artwork */}
      <div className="flex-1 flex items-center justify-center px-10">
        <div className="w-full max-w-[300px] aspect-square rounded-2xl bg-accent shadow-2xl flex items-center justify-center overflow-hidden" style={{ boxShadow: '0 20px 60px -10px hsla(250, 80%, 50%, 0.5), 0 10px 30px -5px hsla(220, 90%, 60%, 0.3)' }}>
          {currentStation.logo ? (
            <img src={currentStation.logo.replace('http://', 'https://')} alt={currentStation.name} loading="lazy" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = stationPlaceholder; }} />
          ) : (
            <img src={stationPlaceholder} alt={currentStation.name} className="w-full h-full object-cover" />
          )}
        </div>
      </div>

      {/* Cast indicator */}
      {isCasting && castDeviceName && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Cast className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">{castDeviceName}</span>
        </div>
      )}

      {/* Audio Visualizer */}
      {isPlaying && (
        <div className="flex justify-center py-3">
          <AudioVisualizer size="large" />
        </div>
      )}

       {/* Info & Controls */}
       <div className="px-6 pb-[calc(max(env(safe-area-inset-bottom,16px),1rem)+4rem)] space-y-4">
         <div className="flex items-start justify-between gap-3">
           <div className="min-w-0">
             <h2 className="text-3xl sm:text-4xl font-heading font-bold leading-tight bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">{currentStation.name}</h2>
              <p className="text-sm text-muted-foreground">
                {currentStation.tags.length > 0 ? currentStation.tags.slice(0, 2).join(' • ') : currentStation.country}
              </p>
           </div>
           <button
             onClick={() => toggleFavorite(currentStation)}
             className="flex-shrink-0 p-2 rounded-full hover:bg-accent transition-colors"
           >
             <Heart className={`w-6 h-6 ${fav ? "fill-[hsl(280,80%,60%)] text-[hsl(280,80%,60%)]" : "text-muted-foreground"}`} />
           </button>
         </div>

         {/* Tags */}
         {currentStation.tags.length > 0 && (
           <div className="flex flex-wrap gap-2">
             {currentStation.tags.slice(0, 4).map((tag, i) => (
               <button
                 key={i}
                 onClick={() => {
                   if (onTagClick) {
                     closeFullScreen();
                     onTagClick(tag);
                   }
                 }}
                 className="px-3 py-1 rounded-full bg-accent text-xs text-foreground font-medium hover:bg-primary/20 active:bg-primary/30 transition-colors"
               >
                 {tag}
               </button>
             ))}
           </div>
         )}

        {/* Play button */}
        <div className="flex justify-center">
          <button
            onClick={togglePlay}
            className={`w-16 h-16 rounded-full bg-gradient-to-b from-primary to-primary/80 border-t border-white/20 flex items-center justify-center text-primary-foreground active:shadow-sm active:translate-y-0.5 transition-all ${isPlaying ? "animate-play-breathe" : "shadow-lg shadow-primary/50"}`}
          >
            {isBuffering ? <Loader2 className="w-7 h-7 animate-spin" /> : isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
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
            className="flex-1 [&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-[hsl(220,90%,60%)] [&_[role=slider]]:to-[hsl(280,80%,60%)] [&_[role=slider]]:border-0 [&_.absolute]:bg-gradient-to-r [&_.absolute]:from-[hsl(220,90%,60%)] [&_.absolute]:to-[hsl(280,80%,60%)]"
          />
        </div>

         {/* Codec / Bitrate / Language info */}
         <div className="grid grid-cols-3 gap-3 py-4 px-4 rounded-xl bg-accent/50">
           {currentStation.codec && (
             <div className="text-center">
               <p className="text-xs text-muted-foreground">Codec</p>
               <p className="text-sm font-semibold text-foreground">{currentStation.codec}</p>
             </div>
           )}
           {currentStation.bitrate > 0 && (
             <div className="text-center">
               <p className="text-xs text-muted-foreground">Bitrate</p>
               <p className="text-sm font-semibold text-foreground">{currentStation.bitrate} kbps</p>
             </div>
           )}
           {currentStation.language && (
             <div className="text-center">
               <p className="text-xs text-muted-foreground">Langue</p>
               <p className="text-sm font-semibold text-foreground">{currentStation.language}</p>
             </div>
           )}
          </div>

        </div>
      </div>
    );
  }
