import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import BillingPlugin from "@/plugins/BillingPlugin";
import { toast } from "@/hooks/use-toast";

const PREMIUM_HASH = "a3f2b8c1d4e5";

interface PremiumContextType {
  isPremium: boolean;
  isLoading: boolean;
  purchasePremium: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  /** Legacy: unlock via password (debug/web only) */
  unlockWithPassword: (password: string) => boolean;
  lockPremium: () => void;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

const isNative = Capacitor.isNativePlatform();

function verifyPassword(input: string): boolean {
  return input === "TESTPREMIUM007";
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(() => {
    // On native, start false and let queryPurchases determine the real status
    if (isNative) return false;
    // On web, check localStorage (debug mode)
    try {
      const stored = localStorage.getItem("radiosphere_premium");
      return stored === PREMIUM_HASH;
    } catch { return false; }
  });
  const [isLoading, setIsLoading] = useState(isNative);

  // On mount (native only), check real purchase status
  useEffect(() => {
    if (!isNative) return;
    BillingPlugin.queryPurchases()
      .then(({ isPremium: purchased }) => {
        setIsPremium(purchased);
        try { localStorage.setItem("radiosphere_premium", purchased ? PREMIUM_HASH : "false"); } catch {}
      })
      .catch(() => {
        // Fallback to localStorage cache if billing unavailable
        try {
          const stored = localStorage.getItem("radiosphere_premium");
          setIsPremium(stored === PREMIUM_HASH);
        } catch {}
      })
      .finally(() => setIsLoading(false));
  }, []);

  const purchasePremium = useCallback(async () => {
    if (isNative) {
      try {
        const { purchased } = await BillingPlugin.purchasePremium();
        if (purchased) {
          setIsPremium(true);
          try { localStorage.setItem("radiosphere_premium", PREMIUM_HASH); } catch {}
        }
      } catch (err) {
        console.error("BillingPlugin.purchasePremium error:", err);
        toast({ title: "❌ Erreur d'achat", description: String(err) });
      }
    } else {
      // Web fallback: toggle for testing
      setIsPremium(true);
      try { localStorage.setItem("radiosphere_premium", PREMIUM_HASH); } catch {}
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    if (isNative) {
      try {
        const { isPremium: purchased } = await BillingPlugin.restorePurchases();
        setIsPremium(purchased);
        try { localStorage.setItem("radiosphere_premium", purchased ? PREMIUM_HASH : "false"); } catch {}
        return;
      } catch (err) {
        console.error("BillingPlugin.restorePurchases error:", err);
        // Fallback to cache
        try {
          const stored = localStorage.getItem("radiosphere_premium");
          setIsPremium(stored === PREMIUM_HASH);
        } catch {}
      }
    } else {
      // Web: check localStorage
      try {
        const stored = localStorage.getItem("radiosphere_premium");
        setIsPremium(stored === PREMIUM_HASH);
      } catch {}
    }
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
    <PremiumContext.Provider value={{ isPremium, isLoading, purchasePremium, restorePurchases, unlockWithPassword, lockPremium }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremium must be used within PremiumProvider");
  return ctx;
}
