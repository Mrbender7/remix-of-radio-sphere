import { Home, Search, Heart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

const tabConfig = [
  { id: "home", labelKey: "nav.home", icon: Home },
  { id: "search", labelKey: "nav.search", icon: Search },
  { id: "library", labelKey: "nav.favorites", icon: Heart },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
] as const;

export type TabId = (typeof tabConfig)[number]["id"];

export function BottomNav({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void }) {
  const { t } = useTranslation();

  return (
    <nav className="flex items-center justify-around bg-secondary/60 backdrop-blur-lg border-t border-border px-2 py-1 pb-[env(safe-area-inset-bottom)]">
      {tabConfig.map(({ id, labelKey, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            "flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-colors min-w-[60px]",
            activeTab === id ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t(labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}
