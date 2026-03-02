package com.radiosphere.app;

import android.content.Context;
import android.media.AudioManager;
import android.media.AudioFocusRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media.MediaBrowserServiceCompat;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.PlaybackException;
import com.google.android.exoplayer2.Player;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * RadioBrowserService — Android Auto MediaBrowserService for RadioSphere.
 *
 * v2.4.8: User-Agent headers, Content-Type playlist detection, robust PLS parsing,
 *         alphabetical favorites sort, Top Stations replacing Genres, error feedback,
 *         increased timeouts.
 */
public class RadioBrowserService extends MediaBrowserServiceCompat {

    private static final String TAG = "RadioBrowserService";
    private static final String ROOT_ID = "root";
    private static final String FAVORITES_ID = "favorites";
    private static final String RECENTS_ID = "recents";
    private static final String TOP_STATIONS_ID = "top_stations";

    private static final String STATION_PREFIX = "station:";

    private static final String PREFS_NAME = "RadioAutoPrefs";
    private static final String KEY_FAVORITES = "favorites_json";
    private static final String KEY_RECENTS = "recents_json";

    private static final String USER_AGENT = "RadioSphere/1.0";

    private static final String[] API_MIRRORS = {
        "https://de1.api.radio-browser.info",
        "https://fr1.api.radio-browser.info",
        "https://at1.api.radio-browser.info",
        "https://nl1.api.radio-browser.info"
    };

    private MediaSessionCompat mediaSession;
    private ExoPlayer player;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private List<StationData> currentStations = new ArrayList<>();
    private int currentIndex = -1;
    private Handler handler = new Handler(Looper.getMainLooper());
    private Runnable bufferingTimeoutRunnable;
    private StationData currentStation;
    private boolean triedProtocolFallback = false;

    private static class StationData {
        final String id;
        final String name;
        final String streamUrl;
        final String logo;
        final String country;
        final String tags;

        StationData(String id, String name, String streamUrl, String logo, String country, String tags) {
            this.id = id;
            this.name = name;
            this.streamUrl = streamUrl;
            this.logo = logo;
            this.country = country;
            this.tags = tags;
        }
    }

    // ─── AudioFocus ─────────────────────────────────────────────────────

    private final AudioManager.OnAudioFocusChangeListener audioFocusChangeListener = focusChange -> {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                player.pause();
                updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                player.setVolume(1.0f);
                player.play();
                updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                player.setVolume(0.2f);
                break;
        }
    };

    private boolean requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setOnAudioFocusChangeListener(audioFocusChangeListener)
                .setWillPauseWhenDucked(false)
                .build();
            return audioManager.requestAudioFocus(audioFocusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } else {
            return audioManager.requestAudioFocus(audioFocusChangeListener,
                AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
    }

    private void abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            audioManager.abandonAudioFocus(audioFocusChangeListener);
        }
    }

    // ─── Lifecycle ──────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        player = new ExoPlayer.Builder(this).build();
        player.addListener(playerListener);

        mediaSession = new MediaSessionCompat(this, "RadioSphereSession");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(mediaSessionCallback);
        mediaSession.setActive(true);
        setSessionToken(mediaSession.getSessionToken());
        updatePlaybackState(PlaybackStateCompat.STATE_NONE);
    }

    @Override
    public void onDestroy() {
        cancelBufferingTimeout();
        abandonAudioFocus();
        player.release();
        mediaSession.release();
        super.onDestroy();
    }

    // ─── Browse Tree ────────────────────────────────────────────────────

    @Nullable
    @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName, int clientUid, @Nullable Bundle rootHints) {
        return new BrowserRoot(ROOT_ID, null);
    }

    @Override
    public void onLoadChildren(@NonNull String parentId, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        switch (parentId) {
            case ROOT_ID: {
                List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
                items.add(buildBrowsableItem(FAVORITES_ID, "Favoris", "Vos stations preferees"));
                items.add(buildBrowsableItem(RECENTS_ID, "Recents", "Dernieres stations ecoutees"));
                items.add(buildBrowsableItem(TOP_STATIONS_ID, "Top Stations", "Les stations les plus populaires"));
                result.sendResult(items);
                break;
            }
            case FAVORITES_ID: {
                List<StationData> stations = loadStations(KEY_FAVORITES);
                // Sort favorites alphabetically
                stations.sort((a, b) -> a.name.compareToIgnoreCase(b.name));
                currentStations = stations;
                if (stations.isEmpty()) {
                    List<MediaBrowserCompat.MediaItem> empty = new ArrayList<>();
                    empty.add(buildInfoItem("Aucun favori", "Ajoutez des favoris depuis l'app"));
                    result.sendResult(empty);
                } else {
                    result.sendResult(toMediaItems(stations));
                }
                break;
            }
            case RECENTS_ID: {
                List<StationData> stations = loadStations(KEY_RECENTS);
                currentStations = stations;
                if (stations.isEmpty()) {
                    List<MediaBrowserCompat.MediaItem> empty = new ArrayList<>();
                    empty.add(buildInfoItem("Aucune station recente", "Ecoutez une station pour la voir ici"));
                    result.sendResult(empty);
                } else {
                    result.sendResult(toMediaItems(stations));
                }
                break;
            }
            case TOP_STATIONS_ID: {
                result.detach();
                new Thread(() -> {
                    List<StationData> stations = fetchTopStations(25);
                    currentStations = stations;
                    result.sendResult(toMediaItems(stations));
                }).start();
                break;
            }
            default: {
                result.sendResult(new ArrayList<>());
                break;
            }
        }
    }

    // ─── Voice Search ───────────────────────────────────────────────────

    @Override
    public void onSearch(@NonNull String query, Bundle extras, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        result.detach();
        new Thread(() -> {
            List<StationData> stations = searchStations(query, 25);
            currentStations = stations;
            result.sendResult(toMediaItems(stations));
        }).start();
    }

    // ─── MediaSession Callbacks ─────────────────────────────────────────

    private final MediaSessionCompat.Callback mediaSessionCallback = new MediaSessionCompat.Callback() {
        @Override
        public void onPlayFromMediaId(String mediaId, Bundle extras) {
            if (mediaId == null) return;
            String stationId = mediaId.startsWith(STATION_PREFIX) ? mediaId.substring(STATION_PREFIX.length()) : mediaId;
            for (int i = 0; i < currentStations.size(); i++) {
                if (currentStations.get(i).id.equals(stationId)) {
                    currentIndex = i;
                    playStation(currentStations.get(i));
                    return;
                }
            }
        }

        @Override
        public void onPlay() {
            if (requestAudioFocus()) {
                player.play();
                updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
            }
        }

        @Override
        public void onPause() {
            player.pause();
            updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
        }

        @Override
        public void onStop() {
            player.stop();
            abandonAudioFocus();
            updatePlaybackState(PlaybackStateCompat.STATE_STOPPED);
        }

        @Override
        public void onSkipToNext() {
            if (currentStations.isEmpty()) return;
            currentIndex = (currentIndex + 1) % currentStations.size();
            playStation(currentStations.get(currentIndex));
        }

        @Override
        public void onSkipToPrevious() {
            if (currentStations.isEmpty()) return;
            currentIndex = currentIndex - 1 < 0 ? currentStations.size() - 1 : currentIndex - 1;
            playStation(currentStations.get(currentIndex));
        }

        @Override
        public void onPlayFromSearch(String query, Bundle extras) {
            if (query == null || query.trim().isEmpty()) {
                List<StationData> favorites = loadStations(KEY_FAVORITES);
                if (!favorites.isEmpty()) {
                    currentStations = favorites;
                    currentIndex = 0;
                    playStation(favorites.get(0));
                }
                return;
            }
            String q = query;
            new Thread(() -> {
                List<StationData> stations = searchStations(q, 25);
                if (!stations.isEmpty()) {
                    currentStations = stations;
                    currentIndex = 0;
                    playStation(stations.get(0));
                }
            }).start();
        }
    };

    // ─── Player Listener ────────────────────────────────────────────────

    private final Player.Listener playerListener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int playbackState) {
            Log.d(TAG, "onPlaybackStateChanged: " + playbackState
                + " (IDLE=1, BUFFERING=2, READY=3, ENDED=4)");
            switch (playbackState) {
                case Player.STATE_BUFFERING:
                    updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
                    Log.d(TAG, "Stream is buffering...");
                    startBufferingTimeout();
                    break;
                case Player.STATE_READY:
                    cancelBufferingTimeout();
                    triedProtocolFallback = false;
                    if (player.isPlaying()) {
                        updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                        Log.d(TAG, "Stream is now playing");
                    }
                    break;
                case Player.STATE_ENDED:
                    cancelBufferingTimeout();
                    Log.w(TAG, "Stream ended unexpectedly");
                    updatePlaybackState(PlaybackStateCompat.STATE_STOPPED);
                    break;
                case Player.STATE_IDLE:
                    cancelBufferingTimeout();
                    Log.d(TAG, "Player is idle");
                    break;
            }
        }

        @Override
        public void onPlayerError(PlaybackException error) {
            cancelBufferingTimeout();
            Log.e(TAG, "ExoPlayer error: " + error.getMessage()
                + " | errorCode=" + error.errorCode, error);
            // Try protocol fallback on error
            if (!triedProtocolFallback && currentStation != null) {
                tryProtocolFallback();
            } else {
                updatePlaybackState(PlaybackStateCompat.STATE_ERROR);
            }
        }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            updatePlaybackState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED);
        }
    };

    // ─── Buffering Timeout & Protocol Fallback ──────────────────────────

    private void startBufferingTimeout() {
        cancelBufferingTimeout();
        bufferingTimeoutRunnable = () -> {
            Log.w(TAG, "Buffering timeout (15s) — trying protocol fallback");
            if (currentStation != null && !triedProtocolFallback) {
                tryProtocolFallback();
            }
        };
        handler.postDelayed(bufferingTimeoutRunnable, 15000);
    }

    private void cancelBufferingTimeout() {
        if (bufferingTimeoutRunnable != null) {
            handler.removeCallbacks(bufferingTimeoutRunnable);
            bufferingTimeoutRunnable = null;
        }
    }

    private void tryProtocolFallback() {
        triedProtocolFallback = true;
        if (currentStation == null) return;
        String url = currentStation.streamUrl;
        String fallbackUrl;
        if (url.startsWith("https://")) {
            fallbackUrl = url.replace("https://", "http://");
        } else if (url.startsWith("http://")) {
            fallbackUrl = url.replace("http://", "https://");
        } else {
            return;
        }
        Log.d(TAG, "Protocol fallback: " + url + " -> " + fallbackUrl);
        player.stop();
        player.setMediaItem(MediaItem.fromUri(fallbackUrl));
        player.prepare();
        player.play();
    }

    // ─── Stream URL Resolution ──────────────────────────────────────────

    /**
     * Resolves a stream URL by following redirects (up to 5 levels),
     * detecting playlist type by Content-Type header AND file extension,
     * and parsing .m3u / .pls playlists to get the actual stream URL.
     */
    private String resolveStreamUrl(String urlStr) {
        Log.d(TAG, "resolveStreamUrl: " + urlStr);
        try {
            String resolved = followRedirects(urlStr, 5);

            // Detect playlist type by Content-Type via HEAD request
            String contentType = "";
            try {
                HttpURLConnection headConn = (HttpURLConnection) new URL(resolved).openConnection();
                headConn.setRequestMethod("HEAD");
                headConn.setConnectTimeout(8000);
                headConn.setReadTimeout(8000);
                headConn.setRequestProperty("User-Agent", USER_AGENT);
                headConn.setInstanceFollowRedirects(true);
                contentType = headConn.getContentType();
                headConn.disconnect();
                if (contentType == null) contentType = "";
                contentType = contentType.toLowerCase();
                Log.d(TAG, "Content-Type for " + resolved + ": " + contentType);
            } catch (Exception e) {
                Log.w(TAG, "HEAD request failed, falling back to extension detection: " + e.getMessage());
            }

            String lower = resolved.toLowerCase();
            boolean isPls = contentType.contains("audio/x-scpls") || lower.endsWith(".pls") || lower.contains(".pls?");
            boolean isM3u = contentType.contains("audio/mpegurl") || contentType.contains("audio/x-mpegurl")
                || lower.endsWith(".m3u") || lower.endsWith(".m3u8") || lower.contains(".m3u?");

            if (isM3u) {
                String fromPlaylist = parseM3uPlaylist(resolved);
                if (fromPlaylist != null) {
                    Log.d(TAG, "Resolved from M3U: " + fromPlaylist);
                    return fromPlaylist;
                }
            } else if (isPls) {
                String fromPlaylist = parsePlsPlaylist(resolved);
                if (fromPlaylist != null) {
                    Log.d(TAG, "Resolved from PLS: " + fromPlaylist);
                    return fromPlaylist;
                }
            }
            Log.d(TAG, "Resolved URL: " + resolved);
            return resolved;
        } catch (Exception e) {
            Log.w(TAG, "resolveStreamUrl failed, using original: " + e.getMessage());
            return urlStr;
        }
    }

    private String followRedirects(String urlStr, int maxRedirects) throws Exception {
        String current = urlStr;
        for (int i = 0; i < maxRedirects; i++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(current).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", USER_AGENT);
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) break;
                // Handle relative URLs
                if (location.startsWith("/")) {
                    URL base = new URL(current);
                    location = base.getProtocol() + "://" + base.getHost() + location;
                }
                Log.d(TAG, "Redirect " + code + ": " + current + " -> " + location);
                current = location;
            } else {
                conn.disconnect();
                break;
            }
        }
        return current;
    }

    private String parseM3uPlaylist(String urlStr) {
        try {
            String content = httpGet(urlStr);
            String[] lines = content.split("\n");
            for (String line : lines) {
                line = line.trim();
                if (!line.isEmpty() && !line.startsWith("#")) {
                    return line;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "parseM3uPlaylist error: " + e.getMessage());
        }
        return null;
    }

    /**
     * Parse PLS playlist — case-insensitive, supports any FileN= entry.
     */
    private String parsePlsPlaylist(String urlStr) {
        try {
            String content = httpGet(urlStr);
            String[] lines = content.split("\n");
            for (String line : lines) {
                line = line.trim();
                // Match File1=, file2=, FILE3=, etc. (case-insensitive, any number)
                if (line.toLowerCase().matches("^file\\d+=.*")) {
                    String url = line.substring(line.indexOf('=') + 1).trim();
                    if (!url.isEmpty()) return url;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "parsePlsPlaylist error: " + e.getMessage());
        }
        return null;
    }

    // ─── Playback Helpers ───────────────────────────────────────────────

    private void playStation(StationData station) {
        Log.d(TAG, "playStation: " + station.name + " | URL: " + station.streamUrl);
        currentStation = station;
        triedProtocolFallback = false;
        cancelBufferingTimeout();

        if (!requestAudioFocus()) {
            Log.w(TAG, "Could not get audio focus, aborting playback");
            return;
        }

        // Resolve URL in background then play
        new Thread(() -> {
            String resolvedUrl = resolveStreamUrl(station.streamUrl);
            Log.d(TAG, "Playing resolved URL: " + resolvedUrl);

            handler.post(() -> {
                player.stop();
                player.setMediaItem(MediaItem.fromUri(resolvedUrl));
                player.prepare();
                player.setVolume(1.0f);
                player.play();
            });
        }).start();

        // Use local app icon as artwork fallback
        Uri artworkUri;
        if (station.logo != null && !station.logo.isEmpty()) {
            artworkUri = Uri.parse(station.logo.replace("http://", "https://"));
        } else {
            artworkUri = Uri.parse("android.resource://" + getPackageName() + "/mipmap/ic_launcher");
        }

        MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, station.id)
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, station.name)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Radio Sphere")
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Live")
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, artworkUri.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ART_URI, artworkUri.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, artworkUri.toString())
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1)
            .build();

        mediaSession.setMetadata(metadata);
        updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
    }

    private void updatePlaybackState(int state) {
        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_STOP
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH
            | PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID;

        PlaybackStateCompat.Builder builder = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f);

        // Add error message for user feedback on Android Auto
        if (state == PlaybackStateCompat.STATE_ERROR) {
            builder.setErrorMessage(PlaybackStateCompat.ERROR_CODE_APP_ERROR,
                "Impossible de lire cette station");
        }

        mediaSession.setPlaybackState(builder.build());
    }

    // ─── Data Helpers ───────────────────────────────────────────────────

    private List<StationData> loadStations(String key) {
        String json = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(key, "[]");
        return parseStationsJson(json);
    }

    private List<StationData> parseStationsJson(String json) {
        List<StationData> list = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String streamUrl = obj.optString("streamUrl", "");
                if (!streamUrl.isEmpty()) {
                    list.add(new StationData(
                        obj.optString("id", ""),
                        obj.optString("name", "Unknown"),
                        streamUrl,
                        obj.optString("logo", ""),
                        obj.optString("country", ""),
                        obj.optString("tags", "")
                    ));
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "parseStationsJson error", e);
        }
        return list;
    }

    private List<StationData> fetchTopStations(int limit) {
        for (String mirror : API_MIRRORS) {
            try {
                String url = mirror + "/json/stations/topvote"
                    + "?limit=" + limit + "&hidebroken=true";
                return parseApiResponse(httpGet(url));
            } catch (Exception e) { /* next */ }
        }
        return new ArrayList<>();
    }

    private List<StationData> searchStations(String query, int limit) {
        List<StationData> nameResults = new ArrayList<>();
        List<StationData> tagResults = new ArrayList<>();

        for (String mirror : API_MIRRORS) {
            try {
                String nameUrl = mirror + "/json/stations/search?name=" + Uri.encode(query)
                    + "&limit=" + limit + "&order=votes&reverse=true&hidebroken=true";
                nameResults = parseApiResponse(httpGet(nameUrl));
                break;
            } catch (Exception e) { /* next mirror */ }
        }

        for (String mirror : API_MIRRORS) {
            try {
                String tagUrl = mirror + "/json/stations/search?tag=" + Uri.encode(query)
                    + "&limit=" + limit + "&order=votes&reverse=true&hidebroken=true";
                tagResults = parseApiResponse(httpGet(tagUrl));
                break;
            } catch (Exception e) { /* next mirror */ }
        }

        java.util.LinkedHashMap<String, StationData> map = new java.util.LinkedHashMap<>();
        for (StationData s : nameResults) map.put(s.id, s);
        for (StationData s : tagResults) if (!map.containsKey(s.id)) map.put(s.id, s);
        return new ArrayList<>(map.values());
    }

    private String httpGet(String urlStr) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setInstanceFollowRedirects(true);
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line).append("\n");
        reader.close();
        conn.disconnect();
        return sb.toString();
    }

    private List<StationData> parseApiResponse(String json) {
        List<StationData> list = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String streamUrl = obj.optString("url_resolved", obj.optString("url", ""));
                if (!streamUrl.isEmpty()) {
                    list.add(new StationData(
                        obj.optString("stationuuid", ""),
                        obj.optString("name", "Unknown"),
                        streamUrl,
                        obj.optString("favicon", ""),
                        obj.optString("country", ""),
                        obj.optString("tags", "")
                    ));
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "parseApiResponse error", e);
        }
        return list;
    }

    // ─── MediaItem Builders ─────────────────────────────────────────────

    private List<MediaBrowserCompat.MediaItem> toMediaItems(List<StationData> stations) {
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
        for (StationData s : stations) items.add(stationToMediaItem(s));
        return items;
    }

    private MediaBrowserCompat.MediaItem stationToMediaItem(StationData station) {
        Uri artworkUri;
        if (station.logo != null && !station.logo.isEmpty()) {
            artworkUri = Uri.parse(station.logo.replace("http://", "https://"));
        } else {
            artworkUri = Uri.parse("android.resource://" + getPackageName() + "/mipmap/ic_launcher");
        }

        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
            .setMediaId(STATION_PREFIX + station.id)
            .setTitle(station.name)
            .setSubtitle("Radio Sphere")
            .setIconUri(artworkUri)
            .build();

        return new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE);
    }

    private MediaBrowserCompat.MediaItem buildBrowsableItem(String mediaId, String title, String subtitle) {
        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
            .setMediaId(mediaId)
            .setTitle(title)
            .setSubtitle(subtitle)
            .build();
        return new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE);
    }

    private MediaBrowserCompat.MediaItem buildInfoItem(String title, String subtitle) {
        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
            .setMediaId("info:" + title)
            .setTitle(title)
            .setSubtitle(subtitle)
            .build();
        return new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE);
    }
}
