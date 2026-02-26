import { RadioStation, RadioProvider, SearchParams } from "@/types/radio";

const FALLBACK_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://fr1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
];

const USER_AGENT = "RadioSphere/1.0";

// Cache the working mirror for the session to avoid retrying dead ones
let cachedWorkingMirror: string | null = null;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeStation(raw: any): RadioStation {
  return {
    id: raw.stationuuid || raw.id || "",
    name: raw.name || "Unknown",
    streamUrl: raw.url_resolved || raw.url || "",
    logo: raw.favicon || "",
    country: raw.country || "",
    countryCode: raw.countrycode || "",
    tags: raw.tags ? raw.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    language: raw.language || "",
    codec: raw.codec || "",
    bitrate: raw.bitrate || 0,
    votes: raw.votes || 0,
    homepage: raw.homepage || "",
  };
}

async function fetchWithMirrors(path: string, params?: Record<string, string>): Promise<any[]> {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";

  // Try cached working mirror first, then shuffled fallbacks
  const mirrors = cachedWorkingMirror
    ? [cachedWorkingMirror, ...shuffleArray(FALLBACK_MIRRORS.filter(m => m !== cachedWorkingMirror))]
    : shuffleArray(FALLBACK_MIRRORS);

  for (const mirror of mirrors) {
    try {
      const res = await fetch(`${mirror}/json/${path}${query}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) continue;
      cachedWorkingMirror = mirror;
      return await res.json();
    } catch {
      continue;
    }
  }
  throw new Error("All Radio Browser mirrors failed");
}

/** Notify Radio Browser that a station was clicked (community contribution) */
export async function reportStationClick(stationuuid: string): Promise<void> {
  if (!stationuuid) return;
  try {
    const mirror = cachedWorkingMirror || FALLBACK_MIRRORS[0];
    await fetch(`${mirror}/json/url/${stationuuid}`, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch {
    // Best-effort, don't block playback
  }
}

export interface CountryInfo {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

export async function getCountries(): Promise<CountryInfo[]> {
  const data = await fetchWithMirrors("countries", { order: "name", reverse: "false" });
  return data
    .filter((c: any) => c.name && c.iso_3166_1 && c.stationcount > 0)
    .map((c: any) => ({ name: c.name, iso_3166_1: c.iso_3166_1, stationcount: c.stationcount }))
    .sort((a: CountryInfo, b: CountryInfo) => a.name.localeCompare(b.name));
}

export const radioBrowserProvider: RadioProvider = {
  async searchStations(params: SearchParams): Promise<RadioStation[]> {
    const query: Record<string, string> = {
      limit: String(params.limit || 30),
      offset: String(params.offset || 0),
      order: params.order || "votes",
      reverse: params.reverse ?? "true",
      hidebroken: "true",
    };
    if (params.name) query.name = params.name;
    // Keep using country name — the API supports both, and our UI uses display names
    if (params.country) query.country = params.country;
    if (params.tag) query.tag = params.tag;
    if (params.tagList) query.tagList = params.tagList;
    if (params.language) query.language = params.language;

    const data = await fetchWithMirrors("stations/search", query);
    return data.map(normalizeStation);
  },

  async getTopStations(limit = 20): Promise<RadioStation[]> {
    const data = await fetchWithMirrors("stations/topvote", { limit: String(limit), hidebroken: "true" });
    return data.map(normalizeStation);
  },

  async getStationsByTag(tag: string, limit = 20): Promise<RadioStation[]> {
    const data = await fetchWithMirrors("stations/bytag/" + encodeURIComponent(tag), { limit: String(limit), order: "votes", reverse: "true", hidebroken: "true" });
    return data.map(normalizeStation);
  },

  async getStationsByCountry(country: string, limit = 20): Promise<RadioStation[]> {
    const data = await fetchWithMirrors("stations/bycountry/" + encodeURIComponent(country), { limit: String(limit), order: "votes", reverse: "true", hidebroken: "true" });
    return data.map(normalizeStation);
  },
};
