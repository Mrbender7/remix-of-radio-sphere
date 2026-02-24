import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { toast } from "@/hooks/use-toast";

export const SLEEP_TIMER_OPTIONS = [
  { minutes: 15, labelFr: "15 min", labelEn: "15 min" },
  { minutes: 30, labelFr: "30 min", labelEn: "30 min" },
  { minutes: 45, labelFr: "45 min", labelEn: "45 min" },
  { minutes: 60, labelFr: "1 heure", labelEn: "1 hour" },
  { minutes: 90, labelFr: "1h30", labelEn: "1h30" },
  { minutes: 120, labelFr: "2 heures", labelEn: "2 hours" },
];

interface SleepTimerContextType {
  /** Remaining seconds, 0 = inactive */
  remainingSeconds: number;
  /** Whether the timer is active */
  isActive: boolean;
  /** Start the timer with a duration in minutes */
  startTimer: (minutes: number) => void;
  /** Cancel the timer */
  cancelTimer: () => void;
  /** Formatted remaining time string (e.g. "1:23:45") */
  formattedTime: string;
}

const SleepTimerContext = createContext<SleepTimerContextType | null>(null);

export function useSleepTimer() {
  const ctx = useContext(SleepTimerContext);
  if (!ctx) throw new Error("useSleepTimer must be inside SleepTimerProvider");
  return ctx;
}

function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SleepTimerProvider({ children }: { children: ReactNode }) {
  const { togglePlay, isPlaying } = usePlayer();
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cancelTimer = useCallback(() => {
    clearInterval_();
    setRemainingSeconds(0);
  }, [clearInterval_]);

  const startTimer = useCallback((minutes: number) => {
    clearInterval_();
    const totalSeconds = minutes * 60;
    setRemainingSeconds(totalSeconds);

    intervalRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval_();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearInterval_]);

  // When timer reaches 0, pause playback
  useEffect(() => {
    if (remainingSeconds === 0 && intervalRef.current === null) return;
    if (remainingSeconds === 0) {
      if (isPlaying) {
        togglePlay();
        toast({
          title: "💤 Sleep Timer",
          description: "La lecture a été mise en pause automatiquement.",
        });
      }
    }
  }, [remainingSeconds, isPlaying, togglePlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearInterval_();
  }, [clearInterval_]);

  const formattedTime = formatTime(remainingSeconds);
  const isActive = remainingSeconds > 0;

  return (
    <SleepTimerContext.Provider value={{ remainingSeconds, isActive, startTimer, cancelTimer, formattedTime }}>
      {children}
    </SleepTimerContext.Provider>
  );
}
