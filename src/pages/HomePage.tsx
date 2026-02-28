import { useState, useRef, useCallback } from "react";
import { RadioStation } from "@/types/radio";
import { StationCard } from "@/components/StationCard";
import { ScrollableRow } from "@/components/ScrollableRow";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useWeeklyDiscoveries } from "@/hooks/useWeeklyDiscoveries";
import { Heart, Sparkles, RefreshCw, ChevronRight, ArrowUp } from "lucide-react";
import { GenreAnimation } from "@/components/GenreAnimations";
import { CastButton } from "@/components/CastButton";
import radioSphereLogo from "@/assets/new-radio-logo.png";

const GENRES = ["60s", "70s", "80s", "90s", "ambient", "blues", "chillout", "classical", "country", "electronic", "funk", "hiphop", "jazz", "latin", "metal", "news", "pop", "r&b", "reggae", "rock", "soul", "techno", "trance", "world"];

interface HomePageProps {
  recent: RadioStation[];
  favorites: RadioStation[];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (station: RadioStation) => void;
  onGenreClick: (genre: string) => void;
}

export function HomePage({ recent, favorites, isFavorite, onToggleFavorite, onGenreClick }: HomePageProps) {
  const { t } = useTranslation();
  const { discoveries, refresh, isRefreshing } = useWeeklyDiscoveries(favorites);
  const [favLimit, setFavLimit] = useState(10);
  const visibleFavs = favorites.slice(0, favLimit);
  const hasMoreFavs = favorites.length > favLimit;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) setShowScrollTop(el.scrollTop > 300);
  }, []);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-background px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={radioSphereLogo} alt="Radio Sphere" className="w-12 h-12 rounded-xl mix-blend-screen animate-logo-glow" />
            <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent whitespace-nowrap">Radio Sphere</h1>
          </div>
          <CastButton />
        </div>
      </div>

      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 pb-4">

      {recent.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-heading font-semibold mb-3 bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">{t("home.recentlyPlayed")}</h2>
          <ScrollableRow>
            {recent.slice(0, 10).map(s => (
              <StationCard key={s.id} station={s} isFavorite={isFavorite(s.id)} onToggleFavorite={onToggleFavorite} />
            ))}
          </ScrollableRow>
        </section>
      )}

      {/* Favorites section */}
      <section className="mb-6">
        <h2 className="text-lg font-heading font-semibold mb-3 bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent flex items-center gap-2">
          <Heart className="w-4 h-4 text-[hsl(280,80%,60%)]" />
          {t("home.yourFavorites")}
          {favorites.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[hsl(280,80%,60%)] text-white leading-none">{favorites.length}</span>
          )}
        </h2>
        {favorites.length > 0 ? (
          <ScrollableRow>
            {visibleFavs.map(s => (
              <StationCard key={s.id} station={s} isFavorite={true} onToggleFavorite={onToggleFavorite} />
            ))}
            {hasMoreFavs && (
              <button
                onClick={() => setFavLimit(prev => prev + 10)}
                className="flex flex-col items-center justify-center w-28 flex-shrink-0 p-3 rounded-xl hover:bg-accent transition-colors gap-1"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] flex items-center justify-center shadow-lg">
                  <ChevronRight className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-semibold bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">
                  +{Math.min(10, favorites.length - favLimit)}
                </span>
              </button>
            )}
          </ScrollableRow>
        ) : (
          <p className="text-sm text-muted-foreground">{t("home.noFavorites")}</p>
        )}
      </section>

      {/* Weekly discoveries */}
      {discoveries.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-semibold bg-gradient-to-r from-[hsl(280,80%,60%)] to-[hsl(340,80%,60%)] bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              {t("home.weeklyDiscoveries")}
            </h2>
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              aria-label="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <ScrollableRow>
            {discoveries.map(s => (
              <StationCard key={s.id} station={s} isFavorite={isFavorite(s.id)} onToggleFavorite={onToggleFavorite} />
            ))}
          </ScrollableRow>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-lg font-heading font-semibold mb-3 bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">{t("home.exploreByGenre")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {GENRES.map(genre => (
            <GenreCard key={genre} genre={genre} onClick={() => onGenreClick(genre)} t={t} />
          ))}
        </div>
      </section>
      <button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-48 right-4 z-50 w-10 h-10 rounded-full bg-primary/70 backdrop-blur-sm text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300",
          showScrollTop ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
        )}
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
      </div>
    </div>
  );
}

const GENRE_COLORS: Record<string, string> = {
  "60s": "from-yellow-700 to-orange-400",
  "70s": "from-amber-800 to-orange-500",
  "80s": "from-fuchsia-700 to-pink-400",
  "90s": "from-cyan-700 to-teal-400",
  ambient: "from-indigo-800 to-blue-400",
  blues: "from-blue-900 to-indigo-500",
  chillout: "from-sky-700 to-cyan-400",
  classical: "from-blue-800 to-cyan-500",
  country: "from-yellow-800 to-amber-500",
  electronic: "from-violet-700 to-purple-400",
  funk: "from-orange-600 to-yellow-400",
  hiphop: "from-emerald-700 to-teal-400",
  jazz: "from-amber-700 to-yellow-500",
  latin: "from-red-600 to-yellow-500",
  metal: "from-gray-800 to-zinc-500",
  news: "from-slate-700 to-gray-400",
  pop: "from-pink-600 to-rose-400",
  "r&b": "from-rose-700 to-pink-500",
  reggae: "from-green-700 to-yellow-500",
  rock: "from-red-700 to-orange-500",
  soul: "from-orange-700 to-amber-400",
  techno: "from-purple-800 to-fuchsia-500",
  trance: "from-indigo-700 to-violet-400",
  world: "from-teal-700 to-emerald-400",
};

function GenreCard({ genre, onClick, t }: { genre: string; onClick: () => void; t: (key: string) => string }) {
  return (
    <div
      className={`rounded-xl p-4 h-20 flex items-end bg-gradient-to-br ${GENRE_COLORS[genre] || "from-gray-700 to-gray-500"} cursor-pointer active:scale-95 transition-all shadow-lg border-t border-white/10 relative overflow-hidden`}
      onClick={onClick}
    >
      <GenreAnimation genre={genre} />
      <span className="text-sm font-heading font-bold text-white capitalize drop-shadow-md relative z-10">{t("genre." + genre)}</span>
    </div>
  );
}
