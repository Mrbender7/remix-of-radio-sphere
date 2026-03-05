import { useState } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useFavoritesContext } from "@/contexts/FavoritesContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { usePremium } from "@/contexts/PremiumContext";
import { useStreamBuffer } from "@/contexts/StreamBufferContext";
import { Play, Pause, ChevronDown, Volume2, Heart, Loader2, Share2, Cast, Circle, Square, Radio, Download } from "lucide-react";
import { CastButton } from "@/components/CastButton";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { CassetteAnimation } from "@/components/CassetteAnimation";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import stationPlaceholder from "@/assets/station-placeholder.png";

export function FullScreenPlayer({ onTagClick }: { onTagClick?: (tag: string) => void }) {
  const { currentStation, isPlaying, isBuffering, togglePlay, volume, setVolume, isFullScreen, closeFullScreen, isCasting, castDeviceName } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { t } = useTranslation();
  const { isPremium } = usePremium();
  const { bufferSeconds, isRecording, recordingDuration, isLive, canSeekBack, bufferAvailable, recordingAvailable, startRecording, stopRecording, seekBack, returnToLive } = useStreamBuffer();

  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [lastRecording, setLastRecording] = useState<{ blob: Blob; fileName: string } | null>(null);

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

  const handleRecToggle = async () => {
    if (!isPremium) {
      toast.error(t("player.recordPremiumOnly"));
      return;
    }
    if (isRecording) {
      const result = await stopRecording();
      if (result) {
        setLastRecording(result);
        setShowSaveSheet(true);
      }
    } else {
      startRecording();
    }
  };

  // Unified export: save to cache, then open share sheet
  const handleExportRecording = async () => {
    if (!lastRecording) return;
    try {
      const { Share } = await import("@capacitor/share");
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const saved = await Filesystem.writeFile({
            path: lastRecording.fileName,
            data: base64,
            directory: Directory.Cache,
          });
          await Share.share({
            title: lastRecording.fileName,
            url: saved.uri,
          });
          setShowSaveSheet(false);
          setLastRecording(null);
        } catch (e) {
          console.error("[Export] failed:", e);
          toast.error(t("player.unexpectedError"));
        }
      };
      reader.onerror = () => {
        toast.error(t("player.unexpectedError"));
      };
      reader.readAsDataURL(lastRecording.blob);
    } catch {
      // Fallback: browser download
      const url = URL.createObjectURL(lastRecording.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = lastRecording.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("player.fileSaved"));
      setShowSaveSheet(false);
      setLastRecording(null);
    }
  };

  const handleSeekChange = ([val]: number[]) => {
    if (val >= 0) {
      returnToLive();
    } else {
      seekBack(Math.abs(val));
    }
  };

  const formatSeekTime = (s: number) => {
    const abs = Math.abs(Math.round(s));
    const m = Math.floor(abs / 60);
    const sec = abs % 60;
    return `-${m}:${String(sec).padStart(2, "0")}`;
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

      {/* Audio Visualizer or Cassette Animation */}
      {isPlaying && (
        <div className="flex justify-center py-3">
          {isRecording ? (
            <CassetteAnimation duration={recordingDuration} maxDuration={600} />
          ) : (
            <AudioVisualizer size="large" />
          )}
        </div>
      )}

       {/* Info & Controls */}
       <div className="px-6 pb-[calc(max(env(safe-area-inset-bottom,16px),1rem)+6rem)] space-y-4">
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

        {/* Play + REC buttons */}
        <div className="flex items-center justify-center gap-6">
          {/* REC button */}
          {recordingAvailable && (
            <button
              onClick={handleRecToggle}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? "bg-red-600 shadow-lg shadow-red-500/40"
                  : "bg-accent hover:bg-red-600/20 border border-red-500/30"
              }`}
              title={isRecording ? t("player.recording") : "REC"}
            >
              {isRecording ? (
                <Square className="w-5 h-5 text-white" />
              ) : (
                <Circle className="w-5 h-5 text-red-500 fill-red-500" />
              )}
            </button>
          )}

          {/* Play button */}
          <button
            onClick={togglePlay}
            className={`w-16 h-16 rounded-full bg-gradient-to-b from-primary to-primary/80 border-t border-white/20 flex items-center justify-center text-primary-foreground active:shadow-sm active:translate-y-0.5 transition-all ${isPlaying ? "animate-play-breathe" : "shadow-lg shadow-primary/50"}`}
          >
            {isBuffering ? <Loader2 className="w-7 h-7 animate-spin" /> : isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>

          {/* Recording duration counter */}
          {isRecording && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 rec-blink" />
              <span className="text-sm font-mono text-red-400 font-semibold">
                {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>

        {/* Scrub / Timeline bar */}
        {bufferAvailable && canSeekBack && (
          <div className="space-y-1">
            <Slider
              value={[isLive ? 0 : -1]}
              min={-Math.floor(bufferSeconds)}
              max={0}
              step={1}
              onValueChange={handleSeekChange}
              className="flex-1 [&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-[hsl(220,90%,60%)] [&_[role=slider]]:to-[hsl(280,80%,60%)] [&_[role=slider]]:border-0 [&_.absolute]:bg-gradient-to-r [&_.absolute]:from-[hsl(220,90%,60%)] [&_.absolute]:to-[hsl(280,80%,60%)]"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{formatSeekTime(bufferSeconds)}</span>
              <button
                onClick={returnToLive}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                  isLive
                    ? "text-green-400 live-pulse"
                    : "text-muted-foreground bg-accent hover:text-green-400"
                }`}
              >
                <Radio className="w-3 h-3" />
                {t("player.live")}
              </button>
            </div>
          </div>
        )}

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

      {/* Export Sheet (unified save/share) */}
      {showSaveSheet && lastRecording && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-start justify-center" style={{ paddingTop: "max(env(safe-area-inset-top, 24px), 2rem)" }} onClick={() => { setShowSaveSheet(false); setLastRecording(null); }}>
          <div className="w-full max-w-md mx-4 bg-card rounded-2xl p-6 space-y-4 animate-in slide-in-from-top" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground text-center">{t("player.recordingStopped")}</h3>
            <p className="text-sm text-muted-foreground text-center">{lastRecording.fileName}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleExportRecording}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] text-white font-semibold flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                {t("player.saveRecording")}
              </button>
              <button
                onClick={() => { setShowSaveSheet(false); setLastRecording(null); }}
                className="w-full py-3 text-muted-foreground text-sm"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }
