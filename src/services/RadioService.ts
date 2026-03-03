import { RadioStation, RadioProvider, SearchParams } from "@/types/radio";

const FALLBACK_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://fr1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
];

const USER_AGENT = "RadioSphere/1.0";
const REQUEST_TIMEOUT_MS = 5000;

// Cache the working mirror for the session to avoid retrying dead ones
let cachedWorkingMirror: string | null = null;
let dynamicMirrors: string[] | null = null;
let mirrorFetchPromise: Promise<string[]> | null = null;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fetch dynamic mirror list from Radio Browser's DNS-based server list */
async function fetchDynamicMirrors(): Promise<string[]> {
  try {
    const res = await fetch("https://all.api.radio-browser.info/json/servers", {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return FALLBACK_MIRRORS;
    const servers: { name: string; ip: string }[] = await res.json();
    const urls = servers
      .map(s => `https://${s.name}`)
      .filter(u => u.includes("api.radio-browser.info"));
    // Merge dynamic + static fallbacks, deduplicated, to ensure we always have backup mirrors
    const merged = new Set([...urls, ...FALLBACK_MIRRORS]);
    return Array.from(merged);
  } catch {
    return FALLBACK_MIRRORS;
  }
}

/** Get mirrors, fetching dynamic list once per session */
async function getMirrors(): Promise<string[]> {
  if (dynamicMirrors) return dynamicMirrors;
  if (!mirrorFetchPromise) {
    mirrorFetchPromise = fetchDynamicMirrors().then(mirrors => {
      dynamicMirrors = mirrors;
      return mirrors;
    });
  }
  return mirrorFetchPromise;
}

async function fetchWithMirrors(path: string, params?: Record<string, string>): Promise<any[]> {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  const allMirrors = await getMirrors();

  // Try cached working mirror first, then shuffled others
  const mirrors = cachedWorkingMirror
    ? [cachedWorkingMirror, ...shuffleArray(allMirrors.filter(m => m !== cachedWorkingMirror))]
    : shuffleArray(allMirrors);

  let lastError: Error | null = null;
  for (const mirror of mirrors) {
    try {
      const res = await fetch(`${mirror}/json/${path}${query}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      cachedWorkingMirror = mirror;
      return await res.json();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      continue;
    }
  }
  throw lastError || new Error("All Radio Browser mirrors failed");
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

/** Search station by exact stream URL — used to refresh metadata after CSV import */
export async function searchStationByUrl(streamUrl: string): Promise<RadioStation | null> {
  try {
    const data = await fetchWithMirrors("stations/byurl", { url: streamUrl, limit: "1" });
    if (data.length > 0) return normalizeStation(data[0]);
    // Fallback: try searching by exact URL match
    const data2 = await fetchWithMirrors("stations/search", { url: streamUrl, limit: "1" });
    if (data2.length > 0) return normalizeStation(data2[0]);
    return null;
  } catch {
    return null;
  }
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
