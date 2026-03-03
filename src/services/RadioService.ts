import { RadioStation, RadioProvider, SearchParams } from "@/types/radio";

const FALLBACK_MIRRORS = [
  "https://all.api.radio-browser.info",
  "https://de1.api.radio-browser.info",
  "https://fr1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
];

const USER_AGENT = "RadioSphere/1.0";
const REQUEST_TIMEOUT_MS = 5000;
const MAX_MIRROR_ATTEMPTS = 6;

// Session-level mirror state
let cachedWorkingMirror: string | null = null;
let dynamicMirrors: string[] | null = null;
let mirrorFetchPromise: Promise<string[]> | null = null;
const blacklistedMirrors = new Map<string, number>(); // mirror -> blacklist expiry timestamp
const BLACKLIST_DURATION_MS = 60_000; // 1 minute

function isBlacklisted(mirror: string): boolean {
  const expiry = blacklistedMirrors.get(mirror);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    blacklistedMirrors.delete(mirror);
    return false;
  }
  return true;
}

function blacklistMirror(mirror: string) {
  blacklistedMirrors.set(mirror, Date.now() + BLACKLIST_DURATION_MS);
}

/** Safe JSON fetch: validates content-type, detects HTML error pages, ensures array response */
async function fetchJsonArray<T = any>(url: string, options?: RequestInit): Promise<T[]> {
  const res = await fetch(url, options);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
    const text = await res.text();
    if (text.trim().startsWith("<!") || text.includes("<html")) {
      throw new Error(`[RadioService] HTML response instead of JSON from ${url} (Cloudflare/auth wall)`);
    }
    // Try parsing anyway — some mirrors omit content-type
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      return parsed;
    } catch {
      throw new Error(`[RadioService] Unexpected format from ${url}: ${contentType}`);
    }
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`[RadioService] Expected array but got ${typeof data} from ${url}`);
  }
  return data;
}

/** Create a timeout-compatible AbortSignal, merging with an optional external signal */
function createTimeoutSignal(externalSignal?: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // If external signal aborts, propagate
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  // Clean up timer when aborted
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });

  return controller.signal;
}

/** Fetch dynamic mirror list from Radio Browser */
async function fetchDynamicMirrors(): Promise<string[]> {
  try {
    const signal = createTimeoutSignal();
    const data = await fetchJsonArray<{ name: string; ip: string }>(
      "https://all.api.radio-browser.info/json/servers",
      { signal }
    );
    const urls = data
      .map((s: any) => `https://${s.name}`)
      .filter((u: string) => u.includes("api.radio-browser.info"));

    // Keep deterministic priority: stable fallbacks first, then discovered mirrors
    const merged = [...FALLBACK_MIRRORS, ...urls.filter((u: string) => !FALLBACK_MIRRORS.includes(u))];
    return merged;
  } catch (e) {
    console.warn("[RadioService] Dynamic mirror fetch failed, using fallbacks:", e);
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

/** Fetch from mirrors with prioritization, blacklisting, and bounded attempts */
async function fetchWithMirrors(path: string, params?: Record<string, string>, externalSignal?: AbortSignal): Promise<any[]> {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  const allMirrors = await getMirrors();

  // Filter out blacklisted mirrors
  const available = allMirrors.filter(m => !isBlacklisted(m));
  if (available.length === 0) {
    // All blacklisted — clear blacklist and retry all
    blacklistedMirrors.clear();
    available.push(...allMirrors);
  }

  // Prioritize cached working mirror, then keep deterministic order
  const mirrors = cachedWorkingMirror && available.includes(cachedWorkingMirror)
    ? [cachedWorkingMirror, ...available.filter(m => m !== cachedWorkingMirror)]
    : available;

  // Bounded attempts (try all if less than max)
  const toTry = mirrors.slice(0, Math.min(MAX_MIRROR_ATTEMPTS, mirrors.length));

  let lastError: Error | null = null;
  for (const mirror of toTry) {
    // Check if external signal already aborted
    if (externalSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      const signal = createTimeoutSignal(externalSignal);
      const url = `${mirror}/json/${path}${query}`;
      const data = await fetchJsonArray(url, {
        headers: { "User-Agent": USER_AGENT },
        signal,
      });
      // Success — cache this mirror
      cachedWorkingMirror = mirror;
      console.debug(`[RadioService] ✓ ${mirror} for ${path}`);
      return data;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      // If it's an abort from external signal, rethrow immediately
      if (err.name === "AbortError" && externalSignal?.aborted) {
        throw err;
      }
      console.warn(`[RadioService] ✗ ${mirror} for ${path}:`, err.message);
      blacklistMirror(mirror);
      lastError = err;
    }
  }

  throw lastError || new Error("[RadioService] All mirrors failed");
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

/** Search station by exact stream URL */
export async function searchStationByUrl(streamUrl: string): Promise<RadioStation | null> {
  try {
    const data = await fetchWithMirrors("stations/byurl", { url: streamUrl, limit: "1" });
    if (data.length > 0) return normalizeStation(data[0]);
    const data2 = await fetchWithMirrors("stations/search", { url: streamUrl, limit: "1" });
    if (data2.length > 0) return normalizeStation(data2[0]);
    return null;
  } catch {
    return null;
  }
}

/** Notify Radio Browser that a station was clicked */
export async function reportStationClick(stationuuid: string): Promise<void> {
  if (!stationuuid) return;
  try {
    const mirror = cachedWorkingMirror || FALLBACK_MIRRORS[0];
    await fetch(`${mirror}/json/url/${stationuuid}`, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch {
    // Best-effort
  }
}

export interface CountryInfo {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

export async function getCountries(signal?: AbortSignal): Promise<CountryInfo[]> {
  const data = await fetchWithMirrors("countries", { order: "name", reverse: "false" }, signal);
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
    if (params.country) query.country = params.country;
    if (params.tag) query.tag = params.tag;
    if (params.tagList) query.tagList = params.tagList;
    if (params.language) query.language = params.language;

    const data = await fetchWithMirrors("stations/search", query, params.signal);
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
