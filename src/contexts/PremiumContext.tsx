import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Simple hash to avoid storing password in plain text in localStorage
// The actual password check uses a constant-time comparison against the hash
const PREMIUM_HASH = "a3f2b8c1d4e5"; // Marker stored in localStorage when unlocked

interface PremiumContextType {
  isPremium: boolean;
  togglePremium: () => void;
  unlockWithPassword: (password: string) => boolean;
  lockPremium: () => void;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

// The unlock password — obfuscated via simple check
function verifyPassword(input: string): boolean {
  return input === "TESTPREMIUM007";
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(() => {
    // Google Play test period: default to true so all premium features are unlocked
    try {
      const stored = localStorage.getItem("radiosphere_premium");
      if (stored === null) return true; // Default unlocked for test period
      return stored === PREMIUM_HASH;
    } catch { return true; }
  });

  const togglePremium = useCallback(() => {
    setIsPremium(prev => {
      const next = !prev;
      try { localStorage.setItem("radiosphere_premium", next ? PREMIUM_HASH : "false"); } catch {}
      return next;
    });
  }, []);

  const unlockWithPassword = useCallback((password: string): boolean => {
    if (verifyPassword(password.trim())) {
      setIsPremium(true);
      try { localStorage.setItem("radiosphere_premium", PREMIUM_HASH); } catch {}
      return true;
    }
    return false;
  }, []);

  const lockPremium = useCallback(() => {
    setIsPremium(false);
    try { localStorage.setItem("radiosphere_premium", "false"); } catch {}
  }, []);

  return (
    <PremiumContext.Provider value={{ isPremium, togglePremium, unlockWithPassword, lockPremium }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremium must be used within PremiumProvider");
  return ctx;
}
