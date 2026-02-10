import { useState, useCallback } from "react";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { FavoritesProvider, useFavoritesContext } from "@/contexts/FavoritesContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { BottomNav, TabId } from "@/components/BottomNav";
import { MiniPlayer } from "@/components/MiniPlayer";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { PremiumPage } from "@/pages/PremiumPage";
import { SettingsPage } from "@/pages/SettingsPage";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const { favorites, toggleFavorite, isFavorite, recent, addRecent } = useFavoritesContext();

  const handleGenreClick = useCallback((genre: string) => {
    setSelectedGenre(genre);
    setActiveTab("search");
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    if (tab !== "search") setSelectedGenre(undefined);
    setActiveTab(tab);
  }, []);

  

  return (
    <PlayerProvider onStationPlay={addRecent}>
      <PremiumProvider>
        <div className="flex flex-col h-full bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 24px)' }}>
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "home" && <HomePage recent={recent} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} onGenreClick={handleGenreClick} />}
            {activeTab === "search" && <SearchPage isFavorite={isFavorite} onToggleFavorite={toggleFavorite} initialGenre={selectedGenre} />}
            {activeTab === "library" && <LibraryPage favorites={favorites} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />}
            {activeTab === "settings" && <SettingsPage />}
          </div>
          <MiniPlayer />
          <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
          <FullScreenPlayer />
        </div>
      </PremiumProvider>
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
