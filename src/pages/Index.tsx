import { useState, useCallback } from "react";
import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { FavoritesProvider, useFavoritesContext } from "@/contexts/FavoritesContext";
import { LanguageProvider, useTranslation } from "@/contexts/LanguageContext";
import { SleepTimerProvider } from "@/contexts/SleepTimerContext";
import { BottomNav, TabId } from "@/components/BottomNav";
import { MiniPlayer } from "@/components/MiniPlayer";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { WelcomePage } from "@/pages/WelcomePage";
import { ExitConfirmDialog } from "@/components/ExitConfirmDialog";
import { SleepTimerIndicator } from "@/components/SleepTimerIndicator";
import { useBackButton } from "@/hooks/useBackButton";
import type { Language } from "@/i18n/translations";
import { clearNativeAppData } from "@/plugins/RadioAutoPlugin";

const ONBOARDING_KEY = "radiosphere_onboarded";

function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  } catch {
    return false;
  }
}

function AppContentInner() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!hasCompletedOnboarding());
  const { favorites, toggleFavorite, isFavorite, recent, addRecent } = useFavoritesContext();
  const { isFullScreen, closeFullScreen, currentStation } = usePlayer();
  const { setLanguage } = useTranslation();

  const handleTagClick = useCallback((tag: string) => {
    setSelectedGenre(tag);
    setActiveTab("search");
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    if (tab !== "search") setSelectedGenre(undefined);
    setActiveTab(tab);
  }, []);

  const handleWelcomeComplete = useCallback((lang: Language) => {
    setLanguage(lang);
    try { localStorage.setItem(ONBOARDING_KEY, "true"); } catch {}
    setShowWelcome(false);
  }, [setLanguage]);

  const handleReopenWelcome = useCallback(() => {
    setShowWelcome(true);
  }, []);

  const handleResetApp = useCallback(async () => {
    try {
      // Clear native Android persisted data (SharedPreferences)
      await clearNativeAppData();
    } catch {}

    try {
      // Clear web storage
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    // Delete all IndexedDB databases
    try {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) window.indexedDB.deleteDatabase(db.name);
      }
    } catch {}

    window.location.reload();
  }, []);

  useBackButton({
    onBack: () => {
      if (showWelcome) return;
      if (isFullScreen) {
        closeFullScreen();
      } else {
        setActiveTab("home");
      }
    },
    onDoubleBackHome: () => setShowExitDialog(true),
    isHome: activeTab === "home",
    isFullScreen,
  });

  if (showWelcome) {
    return <WelcomePage onComplete={handleWelcomeComplete} />;
  }

  return (
      <PremiumProvider>
        <SleepTimerProvider>
          <SleepTimerIndicator />
          <div className="flex flex-col h-full bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 24px)' }}>
            <div className={`flex-1 flex flex-col overflow-hidden ${currentStation ? 'pb-28' : 'pb-14'}`}>
              {activeTab === "home" && <HomePage recent={recent} favorites={favorites} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} onGenreClick={handleTagClick} />}
              {activeTab === "search" && <SearchPage isFavorite={isFavorite} onToggleFavorite={toggleFavorite} initialGenre={selectedGenre} />}
              {activeTab === "library" && <LibraryPage favorites={favorites} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />}
              {activeTab === "settings" && <SettingsPage onReopenWelcome={handleReopenWelcome} onResetApp={handleResetApp} />}
            </div>
            <MiniPlayer />
            <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
            <FullScreenPlayer onTagClick={handleTagClick} />
            <ExitConfirmDialog open={showExitDialog} onOpenChange={setShowExitDialog} />
          </div>
        </SleepTimerProvider>
      </PremiumProvider>
  );
}

function AppContent() {
  const { addRecent } = useFavoritesContext();

  return (
    <PlayerProvider onStationPlay={addRecent}>
      <AppContentInner />
    </PlayerProvider>
  );
}

const Index = () => (
  <LanguageProvider>
    <FavoritesProvider>
      <AppContent />
    </FavoritesProvider>
  </LanguageProvider>
);

export default Index;
