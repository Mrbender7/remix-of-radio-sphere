import { Crown, Zap, Headphones, ShieldCheck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePremium } from "@/contexts/PremiumContext";

const features = [
  { icon: Zap, title: "Sans publicité", desc: "Écoute ininterrompue, sans aucune pub" },
  { icon: Headphones, title: "Qualité HD", desc: "Audio haute qualité jusqu'à 320 kbps" },
  { icon: ShieldCheck, title: "Accès exclusif", desc: "Stations premium et contenus exclusifs" },
];

export function PremiumPage() {
  const { isPremium, togglePremium } = usePremium();

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      {/* Hero */}
      <div className="text-center pt-10 pb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
          <Crown className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">RadioFlow Premium</h1>
        <p className="text-sm text-muted-foreground">L'expérience radio ultime</p>
        {isPremium && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-400 rounded-full px-4 py-1.5 text-sm font-semibold">
            <CheckCircle className="w-4 h-4" /> Premium actif
          </div>
        )}
      </div>

      {/* Features */}
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

      {/* Pricing */}
      <div className="space-y-3 mb-8">
        {isPremium ? (
          <Button onClick={togglePremium} variant="outline" className="w-full h-14 text-base font-semibold rounded-xl border-amber-500/30 text-foreground">
            Annuler l'abonnement
          </Button>
        ) : (
          <>
            <Button onClick={togglePremium} className="w-full h-14 text-base font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:from-amber-500 hover:to-orange-600 rounded-xl shadow-lg">
              Mensuel — 4,99€/mois
            </Button>
            <Button onClick={togglePremium} variant="outline" className="w-full h-14 text-base font-semibold rounded-xl border-amber-500/30 text-foreground">
              Annuel — 49,99€/an <span className="ml-2 text-xs text-primary">-17%</span>
            </Button>
          </>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Annulez à tout moment. Les prix peuvent varier selon votre région.
      </p>
    </div>
  );
}
