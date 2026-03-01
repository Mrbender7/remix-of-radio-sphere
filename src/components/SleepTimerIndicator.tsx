import { useSleepTimer } from "@/contexts/SleepTimerContext";
import { Moon, X } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

export function SleepTimerIndicator() {
  const { isActive, formattedTime, cancelTimer } = useSleepTimer();
  const { t } = useTranslation();

  if (!isActive) return null;

  return (
    <div className="fixed top-[env(safe-area-inset-top,24px)] right-3 z-50 mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md shadow-lg shadow-primary/10 animate-in fade-in slide-in-from-top-2 duration-300">
      <Moon className="w-3.5 h-3.5 text-primary animate-pulse" />
      <span className="text-xs font-semibold text-primary tabular-nums">{formattedTime}</span>
      <button
        onClick={(e) => { e.stopPropagation(); cancelTimer(); }}
        className="w-4 h-4 rounded-full flex items-center justify-center text-primary/60 hover:text-primary transition-colors"
        aria-label={t("sleepTimer.cancel")}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
