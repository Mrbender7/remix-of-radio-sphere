import { registerPlugin } from '@capacitor/core';
import { RadioStation } from '@/types/radio';

/**
 * RadioAutoPlugin — Capacitor plugin interface for Android Auto integration.
 * Syncs favorites, recents, and playback state from the WebView to native SharedPreferences
 * so the native MediaBrowserService can read them.
 */

export interface RadioAutoPluginInterface {
  syncFavorites(options: { stations: string }): Promise<void>;
  syncRecents(options: { stations: string }): Promise<void>;
  notifyPlaybackState(options: {
    stationId: string;
    name: string;
    logo: string;
    streamUrl: string;
    isPlaying: boolean;
    tags: string;
    country: string;
  }): Promise<void>;
  addListener(event: 'mediaToggle', callback: () => void): Promise<{ remove: () => void }>;
}

export const RadioAutoPlugin = registerPlugin<RadioAutoPluginInterface>('RadioAutoPlugin');

/**
 * Check if we're running inside Capacitor on Android
 */
function isCapacitorAndroid(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.() &&
           (window as any).Capacitor?.getPlatform?.() === 'android';
  } catch {
    return false;
  }
}

/**
 * Sync favorites list to native SharedPreferences for Android Auto browsing
 */
export async function syncFavoritesToNative(stations: RadioStation[]): Promise<void> {
  if (!isCapacitorAndroid()) return;
  try {
    await RadioAutoPlugin.syncFavorites({
      stations: JSON.stringify(stations.map(s => ({
        id: s.id,
        name: s.name,
        streamUrl: s.streamUrl,
        logo: s.logo,
        country: s.country,
        countryCode: s.countryCode,
        tags: s.tags,
        language: s.language,
        codec: s.codec,
        bitrate: s.bitrate,
        votes: s.votes,
        homepage: s.homepage,
      }))),
    });
    console.log('[RadioAuto] Favorites synced to native:', stations.length);
  } catch (e) {
    console.log('[RadioAuto] syncFavorites not available (expected in browser)', e);
  }
}

/**
 * Sync recent stations to native SharedPreferences for Android Auto browsing
 */
export async function syncRecentsToNative(stations: RadioStation[]): Promise<void> {
  if (!isCapacitorAndroid()) return;
  try {
    await RadioAutoPlugin.syncRecents({
      stations: JSON.stringify(stations.map(s => ({
        id: s.id,
        name: s.name,
        streamUrl: s.streamUrl,
        logo: s.logo,
        country: s.country,
        countryCode: s.countryCode,
        tags: s.tags,
        language: s.language,
        codec: s.codec,
        bitrate: s.bitrate,
        votes: s.votes,
        homepage: s.homepage,
      }))),
    });
    console.log('[RadioAuto] Recents synced to native:', stations.length);
  } catch (e) {
    console.log('[RadioAuto] syncRecents not available (expected in browser)', e);
  }
}

/**
 * Notify native layer of playback state changes for MediaSession updates
 */
export async function notifyNativePlaybackState(
  station: RadioStation | null,
  isPlaying: boolean
): Promise<void> {
  if (!isCapacitorAndroid() || !station) return;
  try {
    await RadioAutoPlugin.notifyPlaybackState({
      stationId: station.id,
      name: station.name,
      logo: station.logo || '',
      streamUrl: station.streamUrl,
      isPlaying,
      tags: (station.tags || []).join(','),
      country: station.country || '',
    });
    console.log('[RadioAuto] Playback state notified:', station.name, isPlaying);
  } catch (e) {
    console.log('[RadioAuto] notifyPlaybackState not available (expected in browser)', e);
  }
}
