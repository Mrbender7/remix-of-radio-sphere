import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import translations, { type Language } from "@/i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem("radiosphere_language");
    if (stored === "fr" || stored === "en" || stored === "es" || stored === "de") return stored;
    const nav = navigator.language?.toLowerCase();
    if (nav?.startsWith("fr")) return "fr";
    if (nav?.startsWith("es")) return "es";
    if (nav?.startsWith("de")) return "de";
    return "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem("radiosphere_language", lang); } catch {}
  }, []);

  const t = useCallback((key: string): string => {
    return translations[language][key] ?? key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}
