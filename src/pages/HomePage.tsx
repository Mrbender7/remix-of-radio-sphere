import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { radioBrowserProvider } from "@/services/RadioService";
import { StationCard } from "@/components/StationCard";
import { RadioStation } from "@/types/radio";
import { Loader2, Settings } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import radioSphereLogo from "@/assets/radio-sphere-logo.png";

const GENRES = ["pop", "rock", "jazz", "classical", "electronic", "hiphop", "news", "ambient"];

const LANG_MAP: Record<string, string> = {
  fr: "french", es: "spanish", de: "german", pt: "portuguese",
  it: "italian", ar: "arabic", ja: "japanese", nl: "dutch", pl: "polish", ru: "russian",
};

function detectLanguage(): string | undefined {
  try {
    const lang = navigator.language?.toLowerCase().slice(0, 2);
    return lang ? LANG_MAP[lang] : undefined;
  } catch { return undefined; }
}

interface HomePageProps {
  recent: RadioStation[];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (station: RadioStation) => void;
  onGenreClick: (genre: string) => void;
  onSettingsClick: () => void;
}

export function HomePage({ recent, isFavorite, onToggleFavorite, onGenreClick, onSettingsClick }: HomePageProps) {
  const detectedLang = useMemo(detectLanguage, []);
  const { t } = useTranslation();

  const { data: topStations, isLoading } = useQuery({
    queryKey: ["topStations", detectedLang],
    queryFn: () =>
      detectedLang
        ? radioBrowserProvider.searchStations({ language: detectedLang, limit: 20 })
        : radioBrowserProvider.getTopStations(20),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <div className="flex items-center justify-between mt-6 mb-4">
        <div className="flex items-center gap-2">
          <img src={radioSphereLogo} alt="Radio Sphere" className="w-8 h-8 rounded-full" />
          <h1 className="text-2xl font-bold">Radio Sphere</h1>
        </div>
        <button onClick={onSettingsClick} className="p-2 rounded-full hover:bg-accent transition-colors">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {recent.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-foreground">{t("home.recentlyPlayed")}</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {recent.slice(0, 10).map(s => (
              <StationCard key={s.id} station={s} isFavorite={isFavorite(s.id)} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-foreground">
          {detectedLang ? t("home.localPopular") : t("home.popularStations")}
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {topStations?.map(s => (
              <StationCard key={s.id} station={s} isFavorite={isFavorite(s.id)} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-foreground">{t("home.exploreByGenre")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {GENRES.map(genre => (
            <GenreCard key={genre} genre={genre} onClick={() => onGenreClick(genre)} />
          ))}
        </div>
      </section>
    </div>
  );
}

const GENRE_COLORS: Record<string, string> = {
  pop: "from-pink-600 to-rose-400",
  rock: "from-red-700 to-orange-500",
  jazz: "from-amber-700 to-yellow-500",
  classical: "from-blue-800 to-cyan-500",
  electronic: "from-violet-700 to-purple-400",
  hiphop: "from-emerald-700 to-teal-400",
  news: "from-slate-700 to-gray-400",
  ambient: "from-indigo-800 to-blue-400",
};

function GenreCard({ genre, onClick }: { genre: string; onClick: () => void }) {
  return (
    <div
      className={`rounded-xl p-4 h-20 flex items-end bg-gradient-to-br ${GENRE_COLORS[genre] || "from-gray-700 to-gray-500"} cursor-pointer active:scale-95 transition-all shadow-lg border-t border-white/10 hover:shadow-xl hover:-translate-y-0.5`}
      onClick={onClick}
    >
      <span className="text-sm font-bold text-white capitalize drop-shadow-md">{genre}</span>
    </div>
  );
}
