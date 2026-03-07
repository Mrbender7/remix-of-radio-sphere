import { Crown, Moon, Car, CheckCircle, Disc, Cast, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePremium } from "@/contexts/PremiumContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";

export function PremiumPage() {
  const { isPremium, isLoading, purchasePremium, restorePurchases } = usePremium();
  const { t } = useTranslation();

  const features = [
    { icon: Moon, title: t("premium.sleepTimer"), desc: t("premium.sleepTimerDesc") },
    { icon: Disc, title: t("premium.recorder"), desc: t("premium.recorderDesc") },
    { icon: Car, title: t("premium.androidAuto"), desc: t("premium.androidAutoDesc") },
    { icon: Cast, title: t("premium.chromecast"), desc: t("premium.chromecastDesc") },
  ];

  const handlePurchase = async () => {
    await purchasePremium();
  };

  const handleRestore = async () => {
    await restorePurchases();
    // Show feedback after restore attempt
    setTimeout(() => {
      // Re-read from context (state will have updated)
    }, 100);
    toast({ title: t("premium.restorePurchases") + "..." });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <div className="text-center pt-10 pb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
          <Crown className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent drop-shadow-[0_0_12px_hsla(250,80%,60%,0.4)] mb-2">{t("premium.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("premium.subtitle")}</p>
        {isPremium && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-400 rounded-full px-4 py-1.5 text-sm font-semibold">
            <CheckCircle className="w-4 h-4" /> {t("premium.active")}
          </div>
        )}
      </div>

      <div className="space-y-4 mb-8">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-4 p-4 rounded-xl bg-accent">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-14">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isPremium ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            {t("premium.active")} ✨
          </div>
        ) : (
          <Button onClick={handlePurchase} className="w-full h-14 text-base font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:from-amber-500 hover:to-orange-600 rounded-xl shadow-lg">
            {t("premium.monthly")}
          </Button>
        )}

        {/* Restore purchases button — always visible */}
        <Button onClick={handleRestore} variant="outline" className="w-full h-12 text-sm font-semibold rounded-xl border-amber-500/30 text-foreground gap-2">
          <RefreshCw className="w-4 h-4" />
          {t("premium.restorePurchases")}
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">{t("premium.disclaimer")}</p>
    </div>
  );
}
