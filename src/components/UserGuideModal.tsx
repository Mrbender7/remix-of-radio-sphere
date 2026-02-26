import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/LanguageContext";
import { BookOpen, Home, Search, Heart, Settings, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "home", icon: Home, titleKey: "guide.home", contentKey: "guide.homeContent" },
  { id: "search", icon: Search, titleKey: "guide.search", contentKey: "guide.searchContent" },
  { id: "favorites", icon: Heart, titleKey: "guide.favorites", contentKey: "guide.favoritesContent" },
  { id: "settings", icon: Settings, titleKey: "guide.settings", contentKey: "guide.settingsContent" },
] as const;

export function UserGuideModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (id: string) => setOpenSection(prev => (prev === id ? null : id));

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
          {SECTIONS.map(({ id, icon: Icon, titleKey, contentKey }) => {
            const isOpen = openSection === id;
            return (
              <div key={id} className="rounded-xl bg-accent overflow-hidden">
                <button
                  onClick={() => toggle(id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left"
                  type="button"
                >
                  <Icon className="w-4.5 h-4.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground flex-1">{t(titleKey)}</span>
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
                    isOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <p className="text-xs text-muted-foreground leading-relaxed px-3.5 pb-3.5">
                    {t(contentKey)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
