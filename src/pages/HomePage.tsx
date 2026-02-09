import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { radioBrowserProvider } from "@/services/RadioService";
import { StationCard } from "@/components/StationCard";
import { RadioStation } from "@/types/radio";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import radioSphereLogo from "@/assets/radio-sphere-logo.png";

const GENRES = ["70s", "80s", "90s", "ambient", "chillout", "classical", "electronic", "hiphop", "jazz", "news", "pop", "r&b", "rock", "soul"];

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
}

export function HomePage({ recent, isFavorite, onToggleFavorite, onGenreClick }: HomePageProps) {
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
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-background px-4 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <img src={radioSphereLogo} alt="Radio Sphere" className="w-14 h-14 rounded-xl mix-blend-screen drop-shadow-[0_0_6px_hsl(141,73%,42%)]" />
          <h1 className="text-4xl font-heading font-bold bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent drop-shadow-[0_0_12px_hsla(250,80%,60%,0.4)]">Radio Sphere</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">

      {recent.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-heading font-semibold mb-3 bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">{t("home.recentlyPlayed")}</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {recent.slice(0, 10).map(s => (
              <StationCard key={s.id} station={s} isFavorite={isFavorite(s.id)} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-lg font-heading font-semibold mb-3 bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">
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
      className={`rounded-xl p-4 h-20 flex items-end bg-gradient-to-br ${GENRE_COLORS[genre] || "from-gray-700 to-gray-500"} cursor-pointer active:scale-95 transition-all shadow-lg border-t border-white/10 hover:shadow-xl hover:-translate-y-0.5`}
      onClick={onClick}
    >
      <span className="text-sm font-heading font-bold text-white capitalize drop-shadow-md">{genre}</span>
    </div>
  );
}
