import { RadioStation } from "@/types/radio";
import { StationCard } from "@/components/StationCard";
import { ScrollableRow } from "@/components/ScrollableRow";
import { useTranslation } from "@/contexts/LanguageContext";
import { useWeeklyDiscoveries } from "@/hooks/useWeeklyDiscoveries";
import { Heart, Sparkles, RefreshCw } from "lucide-react";
import radioSphereLogo from "@/assets/new-radio-logo.png";

const GENRES = ["70s", "80s", "90s", "ambient", "chillout", "classical", "electronic", "hiphop", "jazz", "news", "pop", "r&b", "rock", "soul"];

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-background px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <img src={radioSphereLogo} alt="Radio Sphere" className="w-12 h-12 rounded-xl mix-blend-screen animate-logo-glow" />
          <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent whitespace-nowrap">Radio Sphere</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">

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
            {favorites.slice(0, 10).map(s => (
              <StationCard key={s.id} station={s} isFavorite={true} onToggleFavorite={onToggleFavorite} />
            ))}
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
            <GenreCard key={genre} genre={genre} onClick={() => onGenreClick(genre)} />
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}

const GENRE_COLORS: Record<string, string> = {
  "70s": "from-amber-800 to-orange-500",
  "80s": "from-fuchsia-700 to-pink-400",
  "90s": "from-cyan-700 to-teal-400",
  ambient: "from-indigo-800 to-blue-400",
  chillout: "from-sky-700 to-cyan-400",
  classical: "from-blue-800 to-cyan-500",
  electronic: "from-violet-700 to-purple-400",
  hiphop: "from-emerald-700 to-teal-400",
  jazz: "from-amber-700 to-yellow-500",
  news: "from-slate-700 to-gray-400",
  pop: "from-pink-600 to-rose-400",
  "r&b": "from-rose-700 to-pink-500",
  rock: "from-red-700 to-orange-500",
  soul: "from-orange-700 to-amber-400",
};

function GenreCard({ genre, onClick }: { genre: string; onClick: () => void }) {
  return (
    <div
      className={`rounded-xl p-4 h-20 flex items-end bg-gradient-to-br ${GENRE_COLORS[genre] || "from-gray-700 to-gray-500"} cursor-pointer active:scale-95 transition-all shadow-lg border-t border-white/10`}
      onClick={onClick}
    >
      <span className="text-sm font-heading font-bold text-white capitalize drop-shadow-md">{genre}</span>
    </div>
  );
}
