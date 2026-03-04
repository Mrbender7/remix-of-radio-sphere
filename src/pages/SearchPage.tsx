import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { radioBrowserProvider, getCountries, CountryInfo } from "@/services/RadioService";
import { StationCard } from "@/components/StationCard";
import { RadioStation } from "@/types/radio";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, X, ChevronDown, ChevronUp, Check, ArrowUpDown, ArrowUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

const FALLBACK_COUNTRIES = [
  { label: "Argentina 🇦🇷", value: "Argentina" },
  { label: "Australia 🇦🇺", value: "Australia" },
  { label: "Austria 🇦🇹", value: "Austria" },
  { label: "Belgium 🇧🇪", value: "Belgium" },
  { label: "Brazil 🇧🇷", value: "Brazil" },
  { label: "Canada 🇨🇦", value: "Canada" },
  { label: "Chile 🇨🇱", value: "Chile" },
  { label: "China 🇨🇳", value: "China" },
  { label: "Colombia 🇨🇴", value: "Colombia" },
  { label: "Czechia 🇨🇿", value: "Czech Republic" },
  { label: "Denmark 🇩🇰", value: "Denmark" },
  { label: "Egypt 🇪🇬", value: "Egypt" },
  { label: "Finland 🇫🇮", value: "Finland" },
  { label: "France 🇫🇷", value: "France" },
  { label: "Germany 🇩🇪", value: "Germany" },
  { label: "Greece 🇬🇷", value: "Greece" },
  { label: "India 🇮🇳", value: "India" },
  { label: "Ireland 🇮🇪", value: "Ireland" },
  { label: "Italy 🇮🇹", value: "Italy" },
  { label: "Japan 🇯🇵", value: "Japan" },
  { label: "Mexico 🇲🇽", value: "Mexico" },
  { label: "Morocco 🇲🇦", value: "Morocco" },
  { label: "Netherlands 🇳🇱", value: "Netherlands" },
  { label: "New Zealand 🇳🇿", value: "New Zealand" },
  { label: "Norway 🇳🇴", value: "Norway" },
  { label: "Poland 🇵🇱", value: "Poland" },
  { label: "Portugal 🇵🇹", value: "Portugal" },
  { label: "Romania 🇷🇴", value: "Romania" },
  { label: "South Africa 🇿🇦", value: "South Africa" },
  { label: "Spain 🇪🇸", value: "Spain" },
  { label: "Sweden 🇸🇪", value: "Sweden" },
  { label: "Switzerland 🇨🇭", value: "Switzerland" },
  { label: "Turkey 🇹🇷", value: "Turkey" },
  { label: "UK 🇬🇧", value: "The United Kingdom Of Great Britain And Northern Ireland" },
  { label: "USA 🇺🇸", value: "The United States Of America" },
];

function countryCodeToFlag(iso: string): string {
  if (!iso || iso.length !== 2) return "";
  const codePoints = iso.toUpperCase().split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

const GENRES = ["60s", "70s", "80s", "90s", "ambient", "blues", "chillout", "classical", "country", "electronic", "funk", "hiphop", "jazz", "latin", "metal", "news", "pop", "r&b", "reggae", "rock", "soul", "techno", "trance", "world"];
const LANGUAGES = ["arabic", "english", "french", "german", "japanese", "portuguese", "spanish"];

/** Merge fulfilled results from Promise.allSettled, ignoring failures */
function mergeSettled<T>(results: PromiseSettledResult<T[]>[]): T[] {
  const merged: T[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") merged.push(...r.value);
  }
  return merged;
}

interface SearchPageProps {
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (station: RadioStation) => void;
  initialGenre?: string;
}

export function SearchPage({ isFavorite, onToggleFavorite, initialGenre }: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [allResults, setAllResults] = useState<RadioStation[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<"votes" | "name" | "clickcount">("votes");
  const { t } = useTranslation();
  const PAGE_SIZE = 40;

  useEffect(() => {
    if (initialGenre) {
      setGenres([initialGenre]);
      setQuery("");
      setCountry("");
      setLanguages([]);
    }
  }, [initialGenre]);

  const { data: apiCountries, isError: isCountriesError, refetch: retryCountries } = useQuery({
    queryKey: ["countries"],
    queryFn: ({ signal }) => getCountries(signal),
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  const countryList = useMemo(() => {
    if (!apiCountries || apiCountries.length === 0) return FALLBACK_COUNTRIES;
    return apiCountries.map((c: CountryInfo) => ({
      label: `${c.name} ${countryCodeToFlag(c.iso_3166_1)}`,
      value: c.name,
    }));
  }, [apiCountries]);

  const usingFallbackCountries = !apiCountries || apiCountries.length === 0;
  const reducedCountryListLabel = t("search.reducedCountryList");

  const hasFilters = !!(query || country || genres.length || languages.length);

  // Reset extra (load-more) results when filters change
  const [extraResults, setExtraResults] = useState<RadioStation[]>([]);
  useEffect(() => {
    setExtraResults([]);
    setOffset(0);
    setHasMore(false);
  }, [query, country, genres, languages, sortBy]);

  const sortReverse = sortBy === "name" ? "false" : "true";

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) setShowScrollTop(el.scrollTop > 300);
  }, []);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { data: results, isLoading, isError: isSearchError, refetch: retrySearch } = useQuery({
    queryKey: ["search", query, country, genres, languages, sortBy],
    queryFn: async ({ signal }) => {
      const baseParams = {
        country: country || undefined,
        language: languages.length ? languages.join(",") : undefined,
        limit: PAGE_SIZE,
        offset: 0,
        order: sortBy,
        reverse: sortReverse,
        signal,
      };

      const map = new Map<string, RadioStation>();

      // Multi-genre OR: one request per genre, then merge
      if (genres.length > 1) {
        const genreSearches = genres.map(g =>
          query
            ? Promise.allSettled([
                radioBrowserProvider.searchStations({ ...baseParams, tag: g, name: query }),
                radioBrowserProvider.searchStations({ ...baseParams, tag: [g, query].join(",") }),
              ]).then(mergeSettled)
            : radioBrowserProvider.searchStations({ ...baseParams, tag: g })
        );
        const settled = await Promise.allSettled(genreSearches);
        const allBatches = mergeSettled(settled);
        for (const s of allBatches) {
          if (Array.isArray(s)) {
            for (const st of s as RadioStation[]) if (!map.has(st.id)) map.set(st.id, st);
          } else if (s && typeof s === "object" && "id" in s) {
            if (!map.has((s as RadioStation).id)) map.set((s as RadioStation).id, s as RadioStation);
          }
        }
        return Array.from(map.values());
      }

      // Single genre or no genre
      const singleTag = genres.length === 1 ? genres[0] : undefined;
      if (singleTag) baseParams["tag"] = singleTag;

      if (query) {
        const settled = await Promise.allSettled([
          radioBrowserProvider.searchStations({ ...baseParams, name: query }),
          radioBrowserProvider.searchStations({ ...baseParams, tag: singleTag ? [singleTag, query].join(",") : query }),
        ]);
        for (const r of settled) {
          if (r.status === "fulfilled") {
            for (const s of r.value) if (!map.has(s.id)) map.set(s.id, s);
          }
        }
        if (map.size === 0 && settled.every(r => r.status === "rejected")) {
          throw settled[0].status === "rejected" ? settled[0].reason : new Error("Search failed");
        }
        return Array.from(map.values());
      } else {
        return radioBrowserProvider.searchStations(baseParams);
      }
    },
    enabled: hasFilters,
    staleTime: 2 * 60 * 1000,
    retry: 0,
  });

  // Derive allResults from query data + extra loaded pages
  useEffect(() => {
    if (results) {
      setOffset(results.length);
      setHasMore(results.length >= PAGE_SIZE);
      if (extraResults.length > 0) {
        const ids = new Set(results.map(s => s.id));
        setAllResults([...results, ...extraResults.filter(s => !ids.has(s.id))]);
      } else {
        setAllResults(results);
      }
    } else {
      setAllResults([]);
    }
  }, [results]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const baseParams = {
        country: country || undefined,
        language: languages.length ? languages.join(",") : undefined,
        limit: PAGE_SIZE,
        offset,
        order: sortBy,
        reverse: sortReverse,
      };

      let data: RadioStation[];
      const map = new Map<string, RadioStation>();

      if (genres.length > 1) {
        const genreSearches = genres.map(g =>
          query
            ? Promise.allSettled([
                radioBrowserProvider.searchStations({ ...baseParams, tag: g, name: query }),
                radioBrowserProvider.searchStations({ ...baseParams, tag: [g, query].join(",") }),
              ]).then(mergeSettled)
            : radioBrowserProvider.searchStations({ ...baseParams, tag: g })
        );
        const settled = await Promise.allSettled(genreSearches);
        const allBatches = mergeSettled(settled);
        for (const s of allBatches) {
          if (Array.isArray(s)) {
            for (const st of s as RadioStation[]) if (!map.has(st.id)) map.set(st.id, st);
          } else if (s && typeof s === "object" && "id" in s) {
            if (!map.has((s as RadioStation).id)) map.set((s as RadioStation).id, s as RadioStation);
          }
        }
        data = Array.from(map.values());
      } else {
        const singleTag = genres.length === 1 ? genres[0] : undefined;
        if (singleTag) baseParams["tag"] = singleTag;

        if (query) {
          const settled = await Promise.allSettled([
            radioBrowserProvider.searchStations({ ...baseParams, name: query }),
            radioBrowserProvider.searchStations({ ...baseParams, tag: singleTag ? [singleTag, query].join(",") : query }),
          ]);
          for (const r of settled) {
            if (r.status === "fulfilled") {
              for (const s of r.value) if (!map.has(s.id)) map.set(s.id, s);
            }
          }
          data = Array.from(map.values());
        } else {
          data = await radioBrowserProvider.searchStations(baseParams);
        }
      }

      setExtraResults(prev => {
        const ids = new Set(prev.map(s => s.id));
        return [...prev, ...data.filter(s => !ids.has(s.id))];
      });
      const newAll = [...allResults, ...data.filter(s => !new Set(allResults.map(x => x.id)).has(s.id))];
      setAllResults(newAll);
      setOffset(o => o + data.length);
      setHasMore(data.length >= PAGE_SIZE);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  const clearFilters = () => { setQuery(""); setCountry(""); setGenres([]); setLanguages([]); };

  const toggleGenre = (g: string) => setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleLanguage = (l: string) => setLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);

  return (
    <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 pb-32">
      <h1 className="text-2xl font-heading font-bold mt-6 mb-4 bg-gradient-to-r from-[hsl(220,90%,60%)] to-[hsl(280,80%,60%)] bg-clip-text text-transparent">{t("search.title")}</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          className="pl-10 pr-9 bg-accent border-0 text-foreground placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mb-3">
        <CountryDropdown
          countries={countryList}
          value={country}
          onChange={setCountry}
          placeholder={t("search.selectCountry")}
        />
        {country && (
          <button onClick={() => setCountry("")} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" /> {t("search.clearCountry")}
          </button>
        )}
        {usingFallbackCountries && !isCountriesError && (
          <div className="flex items-center gap-1.5 mt-1 px-1">
            <AlertTriangle className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              {reducedCountryListLabel === "search.reducedCountryList"
                ? "Liste de pays réduite (temporaire)"
                : reducedCountryListLabel}
            </p>
            <button onClick={() => retryCountries()} className="text-xs text-primary hover:underline font-medium ml-1">
              {t("search.retry")}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-3">
        <MultiSelectDropdown
          label={t("search.genre")}
          items={GENRES}
          selected={genres}
          onToggle={toggleGenre}
          searchable
        />
        <MultiSelectDropdown
          label={t("search.language")}
          items={LANGUAGES}
          selected={languages}
          onToggle={toggleLanguage}
        />
      </div>

      {(genres.length > 0 || languages.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {genres.map(g => (
            <Badge key={g} className="bg-[hsl(225,90%,58%)] text-white capitalize cursor-pointer gap-1 hover:bg-[hsl(225,90%,50%)]" onClick={() => toggleGenre(g)}>
              {g} <X className="w-3 h-3" />
            </Badge>
          ))}
          {languages.map(l => (
            <Badge key={l} className="bg-[hsl(280,80%,60%)] text-white capitalize cursor-pointer gap-1 hover:bg-[hsl(280,80%,50%)]" onClick={() => toggleLanguage(l)}>
              {l} <X className="w-3 h-3" />
            </Badge>
          ))}
        </div>
      )}

      {hasFilters && (
        <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground mb-4 hover:text-foreground">
          <X className="w-3 h-3" /> {t("search.resetFilters")}
        </button>
      )}

      {!isLoading && allResults.length > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          {hasMore ? `${allResults.length}+` : allResults.length} {t("search.resultsCount")}
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      )}
      {isSearchError && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-destructive text-center">{t("search.networkError")}</p>
          <button
            onClick={() => retrySearch()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {t("search.retry")}
          </button>
        </div>
      )}
      {isCountriesError && (
        <div className="flex items-center gap-2 mb-3 px-2">
          <p className="text-xs text-destructive">{t("search.countriesError")}</p>
          <button
            onClick={() => retryCountries()}
            className="text-xs text-primary hover:underline font-medium"
          >
            {t("search.retry")}
          </button>
        </div>
      )}
      {allResults.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            {(["votes", "name", "clickcount"] as const).map(key => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  sortBy === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-muted-foreground hover:text-foreground"
                )}
              >
                {t(key === "votes" ? "search.sortPopularity" : key === "name" ? "search.sortAZ" : "search.sortClicks")}
              </button>
            ))}
          </div>
          {allResults.map(s => (
            <StationCard key={s.id} station={s} compact isFavorite={isFavorite(s.id)} onToggleFavorite={onToggleFavorite} />
          ))}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 mt-2 rounded-lg bg-accent text-sm text-foreground font-medium hover:bg-accent/80 transition-colors flex items-center justify-center gap-2"
            >
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loadingMore ? t("search.loadingMore") || "Chargement..." : t("search.loadMore") || "Plus de stations"}
            </button>
          )}
        </div>
      )}
      {results && allResults.length === 0 && !isLoading && !isSearchError && (
        <p className="text-sm text-muted-foreground text-center py-12">{t("search.noResults")}</p>
      )}

      {!hasFilters && !isSearchError && (
        <p className="text-sm text-muted-foreground text-center py-12">{t("search.useFilters")}</p>
      )}

      {/* Scroll to top button */}
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
  );
}

function MultiSelectDropdown({ label, items, selected, onToggle, searchable }: { label: string; items: string[]; selected: string[]; onToggle: (v: string) => void; searchable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const checkScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(checkScroll, 50);
    return () => clearTimeout(timer);
  }, [open, checkScroll, search]);

  const filtered = search
    ? items.filter(i => i.toLowerCase().includes(search.toLowerCase()))
    : items;

  const handleCustomTag = () => {
    const tag = search.trim().toLowerCase();
    if (tag && !selected.includes(tag)) {
      onToggle(tag);
    }
    setSearch("");
  };

  return (
    <div className="relative flex-1" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-accent rounded-lg px-3 py-2.5 text-sm text-foreground"
      >
        <span className="truncate">
          {selected.length ? `${label} (${selected.length})` : label}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg bg-popover border border-border shadow-xl max-h-[280px] flex flex-col overflow-hidden">
          {searchable && (
            <div className="px-2 pb-1 pt-1 bg-popover z-10 border-b border-border shrink-0">
              <Input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && filtered.length === 0 && search.trim()) handleCustomTag(); }}
                placeholder="Rechercher..."
                className="h-8 text-xs bg-accent border-0"
              />
            </div>
          )}
          <div className="relative flex-1 min-h-0">
            {canScrollUp && (
              <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
                <ChevronUp className="w-4 h-4 text-muted-foreground animate-pulse" />
              </div>
            )}
            <div
              ref={listRef}
              className="overflow-y-auto py-1 max-h-[220px]"
              onScroll={checkScroll}
            >
              {filtered.map(item => (
                <button
                  key={item}
                  onClick={() => onToggle(item)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm capitalize hover:bg-accent transition-colors text-foreground"
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                    selected.includes(item) ? "bg-primary border-primary" : "border-muted-foreground/40"
                  )}>
                    {selected.includes(item) && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  {item}
                </button>
              ))}
              {searchable && filtered.length === 0 && search.trim() && (
                <button
                  onClick={handleCustomTag}
                  className="w-full px-3 py-2 text-sm text-primary hover:bg-accent transition-colors text-left"
                >
                  + Ajouter « {search.trim()} »
                </button>
              )}
            </div>
            {canScrollDown && (
              <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-muted-foreground animate-pulse" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountryDropdown({ countries, value, onChange, placeholder }: { countries: { label: string; value: string }[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const checkScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(checkScroll, 50);
    return () => clearTimeout(timer);
  }, [open, checkScroll, search]);

  const filtered = search
    ? countries.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : countries;

  const selectedLabel = countries.find(c => c.value === value)?.label;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-accent rounded-lg px-3 py-2.5 text-sm text-foreground"
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-[100] mt-1 w-full rounded-lg bg-popover border border-border shadow-xl max-h-[280px] flex flex-col">
          <div className="px-2 pb-1 pt-1 bg-popover z-10 border-b border-border rounded-t-lg shrink-0">
            <Input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍"
              className="h-8 text-xs bg-accent border-0"
            />
          </div>
          <div className="relative flex-1 min-h-0">
            {canScrollUp && (
              <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
                <ChevronUp className="w-4 h-4 text-muted-foreground animate-pulse" />
              </div>
            )}
            <div
              ref={listRef}
              className="overflow-y-auto py-1 max-h-[220px]"
              onScroll={checkScroll}
            >
              {filtered.map(c => (
                <button
                  key={c.value}
                  onClick={() => { onChange(c.value); setOpen(false); setSearch(""); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-foreground text-left"
                >
                  {value === c.value && <Check className="w-4 h-4 text-primary shrink-0" />}
                  {value !== c.value && <div className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
            {canScrollDown && (
              <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-muted-foreground animate-pulse" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
