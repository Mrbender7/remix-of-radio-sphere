import { useTranslation } from "@/contexts/LanguageContext";
import { usePremium } from "@/contexts/PremiumContext";
import { useSleepTimer, SLEEP_TIMER_OPTIONS } from "@/contexts/SleepTimerContext";
import { useFavoritesContext } from "@/contexts/FavoritesContext";
import radioSphereLogo from "@/assets/new-radio-logo.png";
import { cn } from "@/lib/utils";
import { Wifi, Crown, Moon, Car, Cast, CheckCircle, Database, Globe, ChevronDown, TimerOff, Lock, Unlock, KeyRound, Heart, Download, Upload, ExternalLink, ShieldCheck, RotateCcw, Sparkles, Trash2, RefreshCw } from "lucide-react";
import { LANGUAGE_OPTIONS } from "@/i18n/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { UserGuideModal } from "@/components/UserGuideModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useCallback } from "react";
import { searchStationByUrl } from "@/services/RadioService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { RadioStation } from "@/types/radio";


function CollapsibleSection({ icon: Icon, title, badge, children }: { icon: React.ElementType; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full rounded-xl bg-accent p-4 mb-4 text-left transition-all">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2"
        type="button"
      >
        <Icon className="w-5 h-5 text-amber-400" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {badge && <span className="ml-auto">{badge}</span>}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300 ml-auto", open && "rotate-180")} />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          open ? "max-h-[500px] opacity-100 mt-3" : "max-h-0 opacity-0"
        )}
      >
        {children}
      </div>
    </div>
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

interface SettingsPageProps {
  onReopenWelcome?: () => void;
  onResetApp?: () => void;
}

export function SettingsPage({ onReopenWelcome, onResetApp }: SettingsPageProps) {
  const { language, setLanguage, t } = useTranslation();
  const { isPremium, unlockWithPassword, lockPremium } = usePremium();
  const { isActive, formattedTime, startTimer, cancelTimer } = useSleepTimer();
  const { favorites, importFavorites } = useFavoritesContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [premiumCode, setPremiumCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [radioBrowserOpen, setRadioBrowserOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [unavailableStations, setUnavailableStations] = useState<RadioStation[]>([]);
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  const premiumFeatures = [
    { icon: Moon, title: t("premium.sleepTimer"), desc: t("premium.sleepTimerDesc") },
    { icon: Car, title: t("premium.androidAuto"), desc: t("premium.androidAutoDesc") },
    { icon: Cast, title: t("premium.chromecast"), desc: t("premium.chromecastDesc") },
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
        <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
          <SelectTrigger className="w-full rounded-lg bg-secondary text-foreground">
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

      {/* Sleep Timer */}
      <CollapsibleSection
        icon={Moon}
        title={t("sleepTimer.title")}
        badge={
          isActive ? (
            <span className="inline-flex items-center gap-1 bg-primary/20 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-semibold font-mono">
              ⏱ {formattedTime}
            </span>
          ) : null
        }
      >
        <div className="relative">
          <div className={cn(!isPremium && "pointer-events-none opacity-50")}>
            <p className="text-xs text-muted-foreground mb-3">{t("sleepTimer.desc")}</p>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {SLEEP_TIMER_OPTIONS.map(opt => (
                <button
                  key={opt.minutes}
                  onClick={(e) => { e.stopPropagation(); startTimer(opt.minutes); }}
                  className={cn(
                    "py-2.5 rounded-lg text-xs font-semibold transition-all",
                    "bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  {t(`sleepTimer.${opt.minutes}`)}
                </button>
              ))}
            </div>

            {/* Custom timer input */}
            <div className="flex gap-2 mb-3">
              <Input
                type="number"
                min="1"
                max="999"
                placeholder={t("sleepTimer.customPlaceholder")}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 h-9 text-xs bg-secondary border-border"
              />
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  const mins = parseInt(customMinutes);
                  if (mins > 0) {
                    startTimer(mins);
                    setCustomMinutes("");
                  }
                }}
                size="sm"
                className="h-9 px-4 text-xs font-semibold"
                disabled={!customMinutes || parseInt(customMinutes) <= 0}
              >
                {t("sleepTimer.customGo")}
              </Button>
            </div>

            {isActive && (
              <Button
                onClick={(e) => { e.stopPropagation(); cancelTimer(); }}
                variant="outline"
                size="sm"
                className="w-full rounded-lg border-destructive/30 text-destructive text-xs gap-1.5"
              >
                <TimerOff className="w-3.5 h-3.5" />
                {t("sleepTimer.cancel")}
              </Button>
            )}
          </div>
          {!isPremium && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <span className="text-2xl font-black uppercase tracking-widest opacity-25 -rotate-12 border-4 border-primary px-5 py-3 rounded-xl text-primary select-none">
                {t("premium.comingSoon")}
              </span>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Favorites management — moved right after sleep timer */}
      <CollapsibleSection icon={Heart} title={t("favorites.manage")}>
        <div className="space-y-2">
          <Button
            onClick={async () => {
              if (favorites.length === 0) {
                toast({ title: t("favorites.noFavoritesToExport") });
                return;
              }
              const header = "name,streamUrl,country,tags,homepage";
              const rows = favorites.map(s =>
                [s.name, s.streamUrl, s.country, s.tags.join(";"), s.homepage]
                  .map(v => `"${(v || "").replace(/"/g, '""')}"`)
                  .join(",")
              );
              const csv = [header, ...rows].join("\n");

              if (Capacitor.isNativePlatform()) {
                try {
                  const result = await Filesystem.writeFile({
                    path: "radiosphere_favorites.csv",
                    data: btoa(unescape(encodeURIComponent(csv))),
                    directory: Directory.Cache,
                  });
                  await Share.share({
                    title: "Radio Sphere Favorites",
                    url: result.uri,
                  });
                } catch {
                  toast({ title: `❌ ${t("favorites.importError")}`, variant: "destructive" });
                }
              } else {
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "radiosphere_favorites.csv";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast({ title: `✅ ${t("favorites.exported")}` });
              }
            }}
            variant="outline"
            size="sm"
            className="w-full rounded-lg text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {t("favorites.export")}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                try {
                  const text = ev.target?.result as string;
              const lines = text.split("\n").filter(l => l.trim());
                  const dataLines = lines.slice(1);
                  const stations: RadioStation[] = dataLines.map((line, i) => {
                    // Proper CSV parsing: split on commas respecting quoted fields
                    const cols: string[] = [];
                    let current = "";
                    let inQuotes = false;
                    for (let j = 0; j < line.length; j++) {
                      const ch = line[j];
                      if (inQuotes) {
                        if (ch === '"' && line[j + 1] === '"') { current += '"'; j++; }
                        else if (ch === '"') { inQuotes = false; }
                        else { current += ch; }
                      } else {
                        if (ch === '"') { inQuotes = true; }
                        else if (ch === ',') { cols.push(current); current = ""; }
                        else { current += ch; }
                      }
                    }
                    cols.push(current);
                    return {
                      id: `import-${Date.now()}-${i}`,
                      name: cols[0] || "Unknown",
                      streamUrl: cols[1] || "",
                      country: cols[2] || "",
                      countryCode: "",
                      tags: cols[3] ? cols[3].split(";").filter(Boolean) : [],
                      language: "",
                      codec: "",
                      bitrate: 0,
                      votes: 0,
                      logo: "",
                      homepage: cols[4] || "",
                    };
                  }).filter(s => s.streamUrl);
                  const count = importFavorites(stations);
                  toast({ title: `✅ ${count} ${t("favorites.imported")}` });

                  // Refresh metadata from Radio Browser for imported stations
                  if (count > 0) {
                    toast({ title: `🔄 ${t("favorites.refreshingMetadata")}` });
                    (async () => {
                      const notFound: RadioStation[] = [];
                      for (const station of stations) {
                        try {
                          const found = await searchStationByUrl(station.streamUrl);
                          if (found) {
                            // Update the favorite in place with full metadata
                            importFavorites([{
                              ...found,
                              id: found.id, // use the real Radio Browser UUID
                            }]);
                          } else {
                            notFound.push(station);
                          }
                        } catch {
                          notFound.push(station);
                        }
                      }
                      toast({ title: `✅ ${t("favorites.metadataRefreshed")}` });
                      if (notFound.length > 0) {
                        setUnavailableStations(notFound);
                        setShowUnavailableDialog(true);
                      }
                    })();
                  }
                } catch {
                  toast({ title: `❌ ${t("favorites.importError")}`, variant: "destructive" });
                }
              };
              reader.readAsText(file);
              e.target.value = "";
            }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="sm"
            className="w-full rounded-lg text-xs gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            {t("favorites.import")}
          </Button>

          <Button
            onClick={async () => {
              if (favorites.length === 0) {
                toast({ title: t("favorites.noFavoritesToExport") });
                return;
              }
              toast({ title: `🔄 ${t("favorites.refreshingMetadata")}` });
              const notFound: RadioStation[] = [];
              for (const station of favorites) {
                try {
                  const found = await searchStationByUrl(station.streamUrl);
                  if (found) {
                    importFavorites([{ ...found, id: found.id }]);
                  } else {
                    notFound.push(station);
                  }
                } catch {
                  notFound.push(station);
                }
              }
              toast({ title: `✅ ${t("favorites.metadataRefreshed")}` });
              if (notFound.length > 0) {
                setUnavailableStations(notFound);
                setShowUnavailableDialog(true);
              }
            }}
            variant="outline"
            size="sm"
            className="w-full rounded-lg text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t("favorites.refreshMetadata")}
          </Button>

        </div>
      </CollapsibleSection>

      {/* Premium section — with unlock/lock inside */}
      <CollapsibleSection
        icon={Crown}
        title={t("premium.title")}
        badge={
          isPremium ? (
            <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
              <CheckCircle className="w-3 h-3" /> {t("premium.active")}
            </span>
          ) : null
        }
      >
        <div className="relative">
          <div className={cn(!isPremium && "pointer-events-none opacity-50")}>
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
            <p className="text-[9px] text-muted-foreground text-center mt-2">{t("premium.disclaimer")}</p>
          </div>
          {!isPremium && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <span className="text-2xl font-black uppercase tracking-widest opacity-25 -rotate-12 border-4 border-primary px-5 py-3 rounded-xl text-primary select-none">
                {t("premium.comingSoon")}
              </span>
            </div>
          )}
        </div>

        {/* Unlock/Lock zone inside premium */}
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-foreground">
              {isPremium ? t("premium.lock") : t("premium.unlock")}
            </h3>
          </div>
          {isPremium ? (
            <Button
              onClick={() => lockPremium()}
              variant="outline"
              size="sm"
              className="w-full rounded-lg border-destructive/30 text-destructive text-xs gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              {t("premium.lock")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={t("premium.passwordPlaceholder")}
                value={premiumCode}
                onChange={(e) => { setPremiumCode(e.target.value); setCodeError(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const ok = unlockWithPassword(premiumCode);
                    if (ok) {
                      setPremiumCode("");
                      toast({ title: "🎉 " + t("premium.unlocked") });
                    } else {
                      setCodeError(true);
                    }
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "flex-1 h-9 text-xs bg-secondary border-border",
                  codeError && "border-destructive"
                )}
              />
              <Button
                onClick={() => {
                  const ok = unlockWithPassword(premiumCode);
                  if (ok) {
                    setPremiumCode("");
                    toast({ title: "🎉 " + t("premium.unlocked") });
                  } else {
                    setCodeError(true);
                  }
                }}
                size="sm"
                className="h-9 px-3 text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:from-amber-500 hover:to-orange-600"
              >
                <Unlock className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          {codeError && (
            <p className="text-[10px] text-destructive mt-1.5">{t("premium.wrongPassword")}</p>
          )}
        </div>

        {/* Restore purchases */}
        <div className="mt-3 pt-3 border-t border-border">
          <Button
            onClick={() => {
              // In a real app this would call the Play Store billing API
              // For now just show feedback
              if (isPremium) {
                toast({ title: "✅ " + t("premium.restoreSuccess") });
              } else {
                toast({ title: t("premium.restoreNone") });
              }
            }}
            variant="outline"
            size="sm"
            className="w-full rounded-lg text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t("premium.restorePurchases")}
          </Button>
        </div>
      </CollapsibleSection>

      {/* User Guide */}
      <UserGuideModal />

      {/* Collapsible disclaimers */}
      {[
        { icon: Wifi, iconSize: "w-5 h-5", title: t("settings.dataWarning"), desc: t("settings.dataWarningDesc"), key: "data" },
        { icon: Database, iconSize: "w-4 h-4", title: t("settings.dataDisclaimer"), desc: t("settings.dataDisclaimerDesc"), key: "local" },
      ].map(({ icon: Icon, iconSize, title, desc, key }) => (
        <CollapsibleDisclaimer key={key} icon={Icon} iconSize={iconSize} title={title} desc={desc} />
      ))}

      {/* Radio Browser section with links */}
      <button
        onClick={() => setRadioBrowserOpen(o => !o)}
        className="w-full rounded-xl border border-border bg-accent/50 p-4 mb-4 text-left transition-all"
      >
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold text-foreground flex-1">{t("settings.radioSource")}</h3>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", radioBrowserOpen && "rotate-180")} />
        </div>
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            radioBrowserOpen ? "max-h-60 opacity-100 mt-2" : "max-h-0 opacity-0"
          )}
        >
          <p className="text-xs text-muted-foreground leading-relaxed pl-[calc(theme(spacing.3)+theme(spacing.3))] mb-3">{t("settings.radioSourceDesc")}</p>
          <div className="flex flex-col gap-2 pl-[calc(theme(spacing.3)+theme(spacing.3))]">
            <a
              href="https://www.radio-browser.info/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> {t("settings.radioSourceLink")}
            </a>
            <a
              href="https://www.radio-browser.info/add"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> {t("settings.radioSourceAddStation")}
            </a>
          </div>
        </div>
      </button>

      {/* Privacy Policy */}
      <a
        href="https://mrbender7.github.io/privacy-policy-radiosphere/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline mb-3"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        {t("settings.privacyPolicy")}
      </a>

      {/* Reopen welcome page */}
      {onReopenWelcome && (
        <button
          onClick={onReopenWelcome}
          className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline mb-3 w-full"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {t("settings.reopenWelcome")}
        </button>
      )}

      {/* Reset app */}
      {onResetApp && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center justify-center gap-1.5 text-xs text-destructive hover:underline mb-4 w-full">
              <Trash2 className="w-3.5 h-3.5" />
              {t("settings.resetApp")}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.resetApp")}</AlertDialogTitle>
              <AlertDialogDescription>{t("settings.resetConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={onResetApp}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("settings.resetButton")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* App version */}
      <p className="text-center text-[10px] text-muted-foreground mb-6">Radio Sphere v2.4.8</p>

      {/* Unavailable stations dialog after import */}
      <Dialog open={showUnavailableDialog} onOpenChange={setShowUnavailableDialog}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{t("favorites.unavailableStations")}</DialogTitle>
            <DialogDescription className="text-xs">
              {t("favorites.unavailableDesc")}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-60">
            <div className="space-y-2">
              {unavailableStations.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                  <Wifi className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{s.streamUrl}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button size="sm" className="w-full text-xs">{t("favorites.understood")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
