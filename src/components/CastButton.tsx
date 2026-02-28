import { Cast } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";

export function CastButton({ className = "" }: { className?: string }) {
  const { isCastAvailable, isCasting, startCast, stopCast } = usePlayer();

  if (!isCastAvailable) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        isCasting ? stopCast() : startCast();
      }}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
        isCasting
          ? "text-primary bg-primary/10"
          : "text-muted-foreground hover:text-foreground"
      } ${className}`}
      aria-label={isCasting ? "Stop casting" : "Cast"}
    >
      <Cast className={`w-5 h-5 ${isCasting ? "animate-pulse" : ""}`} />
    </button>
  );
}
