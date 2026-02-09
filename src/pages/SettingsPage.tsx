import { useTranslation } from "@/contexts/LanguageContext";
import radioSphereLogo from "@/assets/radio-sphere-logo.png";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <div className="flex items-center gap-3 mt-6 mb-6">
        <img src={radioSphereLogo} alt="Radio Sphere" className="w-10 h-10 rounded-full" />
        <h1 className="text-2xl font-bold text-foreground">Radio Sphere</h1>
      </div>

      <h2 className="text-xl font-bold mb-4">{t("settings.title")}</h2>

      <div className="rounded-xl bg-accent p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">{t("settings.language")}</h3>
        <p className="text-xs text-muted-foreground mb-3">{t("settings.languageDesc")}</p>
        <div className="flex gap-2">
          {(["fr", "en"] as const).map(lang => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                language === lang
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {lang === "fr" ? "🇫🇷 Français" : "🇬🇧 English"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
