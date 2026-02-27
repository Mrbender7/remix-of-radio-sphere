import { useState } from "react";
import radioSphereLogo from "@/assets/new-radio-logo.png";
import { Globe, Radio, Heart, Search, Music, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Language } from "@/i18n/translations";

interface WelcomePageProps {
  onComplete: (lang: Language) => void;
}

const FEATURES = [
  { icon: Radio, labelFr: "50 000+ stations", labelEn: "50,000+ stations" },
  { icon: Search, labelFr: "Recherche avancée", labelEn: "Advanced search" },
  { icon: Heart, labelFr: "Favoris & export", labelEn: "Favorites & export" },
  { icon: Music, labelFr: "24 genres musicaux", labelEn: "24 music genres" },
];

export function WelcomePage({ onComplete }: WelcomePageProps) {
  const [selectedLang, setSelectedLang] = useState<Language>("fr");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 py-10 text-center overflow-y-auto">
      {/* Logo */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl scale-150 animate-pulse" />
        <img
          src={radioSphereLogo}
          alt="Radio Sphere"
          className="w-24 h-24 rounded-2xl relative z-10 mix-blend-screen animate-logo-glow"
        />
      </div>

      {/* Title */}
      <h1 className="text-3xl font-heading font-bold bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent mb-2 drop-shadow-[0_0_16px_hsla(250,80%,60%,0.4)]">
        Radio Sphere
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        La radio mondiale à portée de main
        <br />
        <span className="text-xs opacity-70">World radio at your fingertips</span>
      </p>

      {/* Features grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-10">
        {FEATURES.map(({ icon: Icon, labelFr, labelEn }) => (
          <div
            key={labelEn}
            className="flex items-center gap-2.5 rounded-xl bg-accent/80 border border-border/50 p-3"
          >
            <Icon className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground text-left leading-tight">
              {selectedLang === "fr" ? labelFr : labelEn}
            </span>
          </div>
        ))}
      </div>

      {/* Language selector — bilingual label */}
      <div className="w-full max-w-xs mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">
            Choisissez la langue{" "}
            <span className="text-muted-foreground font-normal">/ Choose language</span>
          </p>
        </div>
        <div className="flex gap-2">
          {(["fr", "en"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLang(lang)}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
                selectedLang === lang
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-[1.02]"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              )}
            >
              {lang === "fr" ? "🇫🇷 Français" : "🇬🇧 English"}
            </button>
          ))}
        </div>
      </div>

      {/* Continue button */}
      <button
        onClick={() => onComplete(selectedLang)}
        className="w-full max-w-xs py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[hsl(220,90%,56%)] to-[hsl(280,80%,56%)] text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-200 flex items-center justify-center gap-2"
      >
        {selectedLang === "fr" ? "Commencer" : "Get started"}
        <ChevronRight className="w-4 h-4" />
      </button>

      <p className="text-[10px] text-muted-foreground mt-6 opacity-60">Radio Sphere v2.2.8e</p>
    </div>
  );
}
