import { useState, useCallback } from "react";
import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { FavoritesProvider, useFavoritesContext } from "@/contexts/FavoritesContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { BottomNav, TabId } from "@/components/BottomNav";
import { MiniPlayer } from "@/components/MiniPlayer";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ExitConfirmDialog } from "@/components/ExitConfirmDialog";
import { useBackButton } from "@/hooks/useBackButton";

function AppContentInner() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const { favorites, toggleFavorite, isFavorite, recent, addRecent } = useFavoritesContext();
  const { isFullScreen, closeFullScreen } = usePlayer();

  const handleGenreClick = useCallback((genre: string) => {
    setSelectedGenre(genre);
    setActiveTab("search");
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    if (tab !== "search") setSelectedGenre(undefined);
    setActiveTab(tab);
  }, []);

  useBackButton({
    onBack: () => {
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

  return (
    <PremiumProvider>
      <div className="flex flex-col h-full bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 24px)' }}>
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === "home" && <HomePage recent={recent} favorites={favorites} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} onGenreClick={handleGenreClick} />}
          {activeTab === "search" && <SearchPage isFavorite={isFavorite} onToggleFavorite={toggleFavorite} initialGenre={selectedGenre} />}
          {activeTab === "library" && <LibraryPage favorites={favorites} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />}
          {activeTab === "settings" && <SettingsPage />}
        </div>
        <MiniPlayer />
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        <FullScreenPlayer />
        <ExitConfirmDialog open={showExitDialog} onOpenChange={setShowExitDialog} />
      </div>
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
