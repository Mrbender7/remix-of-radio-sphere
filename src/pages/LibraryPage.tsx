import { RadioStation } from "@/types/radio";
import { StationCard } from "@/components/StationCard";
import { Heart } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

interface LibraryPageProps {
  favorites: RadioStation[];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (station: RadioStation) => void;
}

export function LibraryPage({ favorites, isFavorite, onToggleFavorite }: LibraryPageProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <h1 className="text-2xl font-heading font-bold mt-6 mb-4">{t("favorites.title")}</h1>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Heart className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">{t("favorites.empty")}</h2>
          <p className="text-sm text-muted-foreground max-w-[250px]">{t("favorites.emptyDesc")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {favorites.map(s => (
            <StationCard key={s.id} station={s} compact isFavorite={isFavorite(s.id)} onToggleFavorite={onToggleFavorite} />
          ))}
        </div>
      )}
    </div>
  );
}
