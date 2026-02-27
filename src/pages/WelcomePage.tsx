import { useState } from "react";
import radioSphereLogo from "@/assets/new-radio-logo.png";
import { Globe, Radio, Heart, Search, Music, ChevronRight } from "lucide-react";
import type { Language } from "@/i18n/translations";
import { LANGUAGE_OPTIONS } from "@/i18n/translations";
import translations from "@/i18n/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WelcomePageProps {
  onComplete: (lang: Language) => void;
}

const FEATURE_ICONS = [Radio, Search, Heart, Music] as const;
const FEATURE_KEYS = ["welcome.stations", "welcome.search", "welcome.favExport", "welcome.genres"] as const;

export function WelcomePage({ onComplete }: WelcomePageProps) {
  const [selectedLang, setSelectedLang] = useState<Language>("fr");
  const t = (key: string) => translations[selectedLang][key] ?? key;

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
        {t("welcome.subtitle")}
      </p>

      {/* Features grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-10">
        {FEATURE_KEYS.map((key, i) => {
          const Icon = FEATURE_ICONS[i];
          return (
            <div
              key={key}
              className="flex items-center gap-2.5 rounded-xl bg-accent/80 border border-border/50 p-3"
            >
              <Icon className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground text-left leading-tight">
                {t(key)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Language selector — dropdown */}
      <div className="w-full max-w-xs mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">
            {t("welcome.chooseLanguage")}
          </p>
        </div>
        <Select value={selectedLang} onValueChange={(v) => setSelectedLang(v as Language)}>
          <SelectTrigger className="w-full rounded-xl bg-secondary text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.flag} {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Continue button */}
      <button
        onClick={() => onComplete(selectedLang)}
        className="w-full max-w-xs py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[hsl(220,90%,56%)] to-[hsl(280,80%,56%)] text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-200 flex items-center justify-center gap-2"
      >
        {t("welcome.start")}
        <ChevronRight className="w-4 h-4" />
      </button>

      <p className="text-[10px] text-muted-foreground mt-6 opacity-60">Radio Sphere v2.2.8e</p>
    </div>
  );
}
