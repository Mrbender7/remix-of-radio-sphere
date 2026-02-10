import { useTranslation } from "@/contexts/LanguageContext";
import { usePremium } from "@/contexts/PremiumContext";
import radioSphereLogo from "@/assets/radio-sphere-logo.png";
import { cn } from "@/lib/utils";
import { Wifi, Crown, Zap, Headphones, ShieldCheck, CheckCircle, Database, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SettingsPage() {
  const { language, setLanguage, t } = useTranslation();
  const { isPremium, togglePremium } = usePremium();

  const premiumFeatures = [
    { icon: Zap, title: t("premium.noAds"), desc: t("premium.noAdsDesc") },
    { icon: Headphones, title: t("premium.hd"), desc: t("premium.hdDesc") },
    { icon: ShieldCheck, title: t("premium.exclusive"), desc: t("premium.exclusiveDesc") },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <div className="flex items-center gap-3 mt-6 mb-6">
        <img src={radioSphereLogo} alt="Radio Sphere" className="w-10 h-10 rounded-xl mix-blend-screen drop-shadow-[0_0_8px_hsl(141,73%,42%)]" />
        <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent drop-shadow-[0_0_12px_hsla(250,80%,60%,0.4)]">Radio Sphere</h1>
      </div>

      <h2 className="text-xl font-heading font-bold mb-4 bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">{t("settings.title")}</h2>

      {/* Language */}
      <div className="rounded-xl bg-accent p-4 mb-4">
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

      {/* Premium section */}
      <div className="rounded-xl bg-accent p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">{t("premium.title")}</h3>
          {isPremium && (
            <span className="ml-auto inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
              <CheckCircle className="w-3 h-3" /> {t("premium.active")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">{t("premium.subtitle")}</p>

        <div className="space-y-2 mb-3">
          {premiumFeatures.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/50">
              <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">{title}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {isPremium ? (
          <Button onClick={togglePremium} variant="outline" size="sm" className="w-full rounded-lg border-amber-500/30 text-foreground text-xs">
            {t("premium.cancel")}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button onClick={togglePremium} size="sm" className="w-full rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:from-amber-500 hover:to-orange-600 shadow-lg">
              {t("premium.monthly")}
            </Button>
            <Button onClick={togglePremium} variant="outline" size="sm" className="w-full rounded-lg border-amber-500/30 text-foreground text-xs">
              {t("premium.yearly")} <span className="ml-1.5 text-[10px] text-primary">{t("premium.yearlySave")}</span>
            </Button>
          </div>
        )}
        <p className="text-[9px] text-muted-foreground text-center mt-2">{t("premium.disclaimer")}</p>
      </div>

      {/* Data warning */}
      <div className="rounded-xl border border-border bg-accent/50 p-4 flex gap-3 mb-4">
        <Wifi className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{t("settings.dataWarning")}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("settings.dataWarningDesc")}</p>
        </div>
      </div>

      {/* Local data disclaimer */}
      <div className="rounded-xl border border-border bg-accent/50 p-4 flex gap-3 mb-4">
        <Database className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{t("settings.dataDisclaimer")}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("settings.dataDisclaimerDesc")}</p>
        </div>
      </div>

      {/* Radio source */}
      <div className="rounded-xl border border-border bg-accent/50 p-4 flex gap-3 mb-4">
        <Globe className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{t("settings.radioSource")}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("settings.radioSourceDesc")}</p>
        </div>
      </div>
    </div>
  );
}
