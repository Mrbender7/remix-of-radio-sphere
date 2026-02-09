import { useState, useCallback } from "react";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { useFavorites, useRecentStations } from "@/hooks/useFavorites";
import { BottomNav, TabId } from "@/components/BottomNav";
import { MiniPlayer } from "@/components/MiniPlayer";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { PremiumPage } from "@/pages/PremiumPage";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { recent, addRecent } = useRecentStations();

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
        <div className="flex flex-col h-full bg-background">
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "home" && <HomePage recent={recent} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} onGenreClick={handleGenreClick} />}
            {activeTab === "search" && <SearchPage isFavorite={isFavorite} onToggleFavorite={toggleFavorite} initialGenre={selectedGenre} />}
            {activeTab === "library" && <LibraryPage favorites={favorites} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />}
            {activeTab === "premium" && <PremiumPage />}
          </div>
          <MiniPlayer />
          <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
          <FullScreenPlayer />
        </div>
      </PremiumProvider>
    </PlayerProvider>
  );
};

export default Index;
