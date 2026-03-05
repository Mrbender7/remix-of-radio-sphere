import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/LanguageContext";
import { BookOpen, Home, Search, Heart, Settings, ChevronDown, Moon, Car, Cast, Crown, ShieldAlert, RefreshCw, Disc } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestAllPermissions } from "@/utils/permissions";

const SECTIONS = [
  { id: "home", icon: Home, titleKey: "guide.home", contentKey: "guide.homeContent" },
  { id: "search", icon: Search, titleKey: "guide.search", contentKey: "guide.searchContent" },
  { id: "favorites", icon: Heart, titleKey: "guide.favorites", contentKey: "guide.favoritesContent" },
  { id: "settings", icon: Settings, titleKey: "guide.settings", contentKey: "guide.settingsContent" },
  { id: "permissions", icon: ShieldAlert, titleKey: "guide.permissions", contentKey: "guide.permissionsContent" },
  { id: "sleepTimer", icon: Moon, titleKey: "guide.sleepTimer", contentKey: "guide.sleepTimerContent", premium: true },
  { id: "recorder", icon: Disc, titleKey: "guide.recorder", contentKey: "guide.recorderContent", premium: true },
  { id: "androidAuto", icon: Car, titleKey: "guide.androidAuto", contentKey: "guide.androidAutoContent", premium: true },
  { id: "chromecast", icon: Cast, titleKey: "guide.chromecast", contentKey: "guide.chromecastContent", premium: true },
] as const;

interface UserGuideModalProps {
  onReopenWelcome?: () => void;
}

export function UserGuideModal({ onReopenWelcome }: UserGuideModalProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (id: string) => setOpenSection(prev => (prev === id ? null : id));

  const handleReRequestPermissions = async () => {
    await requestAllPermissions();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full rounded-xl bg-accent p-4 mb-4 flex items-center gap-3 text-left transition-all hover:bg-accent/80">
          <BookOpen className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground">{t("guide.button")}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto -rotate-90" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-heading font-bold bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">
            {t("guide.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {SECTIONS.map(({ id, icon: Icon, titleKey, contentKey, ...rest }) => {
            const isOpen = openSection === id;
            const isPremium = 'premium' in rest && rest.premium;
            const isPermissions = id === "permissions";
            return (
              <div key={id} className="rounded-xl bg-accent overflow-hidden">
                <button
                  onClick={() => toggle(id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left"
                  type="button"
                >
                  <Icon className="w-4.5 h-4.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground flex-1">{t(titleKey)}</span>
                  {isPremium && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-300",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <p className="text-xs text-muted-foreground leading-relaxed px-3.5 pb-2">
                    {t(contentKey)}
                  </p>
                  {isPermissions && isOpen && (
                    <div className="flex flex-col gap-2 px-3.5 pb-3.5">
                      <button
                        onClick={handleReRequestPermissions}
                        className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                        type="button"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {t("guide.permissionsReRequest")}
                      </button>
                      {onReopenWelcome && (
                        <button
                          onClick={() => {
                            setOpen(false);
                            onReopenWelcome();
                          }}
                          className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                          type="button"
                        >
                          <Home className="w-3.5 h-3.5" />
                          {t("guide.permissionsReopenWelcome")}
                        </button>
                      )}
                    </div>
                  )}
                  {!isPermissions && (
                    <div className="pb-1.5" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
