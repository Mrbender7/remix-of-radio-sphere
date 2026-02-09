import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { radioBrowserProvider } from "@/services/RadioService";
import { StationCard } from "@/components/StationCard";
import { RadioStation } from "@/types/radio";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const COUNTRIES_MAP = [
  { label: "France 🇫🇷", value: "France" },
  { label: "Belgique 🇧🇪", value: "Belgium" },
  { label: "Suisse 🇨🇭", value: "Switzerland" },
  { label: "Canada 🇨🇦", value: "Canada" },
  { label: "Allemagne 🇩🇪", value: "Germany" },
  { label: "USA 🇺🇸", value: "The United States Of America" },
  { label: "Espagne 🇪🇸", value: "Spain" },
  { label: "Italie 🇮🇹", value: "Italy" },
  { label: "Royaume-Uni 🇬🇧", value: "The United Kingdom Of Great Britain And Northern Ireland" },
];

const GENRES = ["pop", "rock", "jazz", "classical", "electronic", "news", "ambient", "hiphop"];
const LANGUAGES = ["french", "english", "spanish", "german", "portuguese", "arabic", "japanese"];

interface SearchPageProps {
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (station: RadioStation) => void;
  initialGenre?: string;
}

export function SearchPage({ isFavorite, onToggleFavorite, initialGenre }: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");

  useEffect(() => {
    if (initialGenre) setGenre(initialGenre);
  }, [initialGenre]);

  const hasFilters = !!(query || country || genre || language);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", query, country, genre, language],
    queryFn: () => radioBrowserProvider.searchStations({
      name: query || undefined,
      country: country || undefined,
      tag: genre || undefined,
      language: language || undefined,
      limit: 40,
    }),
    enabled: hasFilters,
    staleTime: 2 * 60 * 1000,
  });

  const clearFilters = () => { setQuery(""); setCountry(""); setGenre(""); setLanguage(""); };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <h1 className="text-2xl font-bold mt-6 mb-4">Recherche</h1>

      {/* Search bar with X button */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une station..."
          className="pl-10 pr-9 bg-accent border-0 text-foreground placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Country Select */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pays</p>
        <Select value={country} onValueChange={v => setCountry(v === country ? "" : v)}>
          <SelectTrigger className="bg-accent border-0 text-foreground">
            <SelectValue placeholder="Choisir un pays" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border">
            {COUNTRIES_MAP.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {country && (
          <button onClick={() => setCountry("")} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" /> Effacer le pays
          </button>
        )}
      </div>

      {/* Genre & Language chips */}
      <FilterSection label="Genre" items={GENRES} selected={genre} onSelect={v => setGenre(v === genre ? "" : v)} />
      <FilterSection label="Langue" items={LANGUAGES} selected={language} onSelect={v => setLanguage(v === language ? "" : v)} />

      {hasFilters && (
        <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground mb-4 hover:text-foreground">
          <X className="w-3 h-3" /> Réinitialiser les filtres
        </button>
      )}

      {/* Results */}
      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      )}
      {results && (
        <div className="space-y-1">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucun résultat trouvé</p>
          ) : (
            results.map(s => (
              <StationCard key={s.id} station={s} compact isFavorite={isFavorite(s.id)} onToggleFavorite={onToggleFavorite} />
            ))
          )}
        </div>
      )}

      {!hasFilters && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Utilisez la recherche ou les filtres pour trouver des stations
        </p>
      )}
    </div>
  );
}

function FilterSection({ label, items, selected, onSelect }: { label: string; items: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map(item => (
          <Badge
            key={item}
            variant={selected === item ? "default" : "secondary"}
            className={cn("cursor-pointer whitespace-nowrap capitalize transition-colors", selected === item && "bg-primary text-primary-foreground")}
            onClick={() => onSelect(item)}
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
