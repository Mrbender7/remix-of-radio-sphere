import { useTranslation } from "@/contexts/LanguageContext";
import { usePremium } from "@/contexts/PremiumContext";
import radioSphereLogo from "@/assets/new-radio-logo.png";
import { cn } from "@/lib/utils";
import { Wifi, Crown, Zap, Headphones, ShieldCheck, CheckCircle, Database, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function CollapsibleSection({ icon: Icon, title, badge, children }: { icon: React.ElementType; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(o => !o)}
      className="w-full rounded-xl bg-accent p-4 mb-4 text-left transition-all"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-amber-400" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {badge && <span className="ml-auto">{badge}</span>}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300 ml-auto", open && "rotate-180")} />
      </div>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          open ? "max-h-[500px] opacity-100 mt-3" : "max-h-0 opacity-0"
        )}
      >
        {children}
      </div>
    </button>
  );
}

function CollapsibleDisclaimer({ icon: Icon, iconSize, title, desc }: { icon: React.ElementType; iconSize: string; title: string; desc: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(o => !o)}
      className="w-full rounded-xl border border-border bg-accent/50 p-4 mb-4 text-left transition-all"
    >
      <div className="flex items-center gap-3">
        <Icon className={cn(iconSize, "text-muted-foreground shrink-0")} />
        <h3 className="text-sm font-semibold text-foreground flex-1">{title}</h3>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </div>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          open ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0"
        )}
      >
        <p className="text-xs text-muted-foreground leading-relaxed pl-[calc(theme(spacing.3)+theme(spacing.3))]">{desc}</p>
      </div>
    </button>
  );
}

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
        <img src={radioSphereLogo} alt="Radio Sphere" className="w-10 h-10 rounded-xl mix-blend-screen animate-logo-glow" />
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

      {/* Premium section - collapsible */}
      <CollapsibleSection
        icon={Crown}
        title={t("premium.title")}
        badge={
          isPremium && (
            <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
              <CheckCircle className="w-3 h-3" /> {t("premium.active")}
            </span>
          )
        }
      >
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
            <Button onClick={togglePremium} size="sm" className="w-full rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:from-amber-500 hover:to-orange-600 shadow-lg shadow-amber-500/30">
              {t("premium.monthly")}
            </Button>
            <Button onClick={togglePremium} variant="outline" size="sm" className="w-full rounded-lg border-amber-500/30 text-foreground text-xs">
              {t("premium.yearly")} <span className="ml-1.5 text-[10px] text-primary">{t("premium.yearlySave")}</span>
            </Button>
          </div>
        )}
        <p className="text-[9px] text-muted-foreground text-center mt-2">{t("premium.disclaimer")}</p>
      </CollapsibleSection>

      {/* Collapsible disclaimers */}
      {[
        { icon: Wifi, iconSize: "w-5 h-5", title: t("settings.dataWarning"), desc: t("settings.dataWarningDesc"), key: "data" },
        { icon: Database, iconSize: "w-4 h-4", title: t("settings.dataDisclaimer"), desc: t("settings.dataDisclaimerDesc"), key: "local" },
        { icon: Globe, iconSize: "w-4 h-4", title: t("settings.radioSource"), desc: t("settings.radioSourceDesc"), key: "radio" },
      ].map(({ icon: Icon, iconSize, title, desc, key }) => (
        <CollapsibleDisclaimer key={key} icon={Icon} iconSize={iconSize} title={title} desc={desc} />
      ))}
    </div>
  );
}
