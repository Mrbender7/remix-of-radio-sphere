# radiosphere_v2_2_6.ps1
# Android Auto Integration + AudioFocus + Notification Buttons — Full automated setup (100% autonome)
$RepoUrl = "https://github.com/Mrbender7/remix-of-radio-sphere"
$ProjectFolder = "remix-of-radio-sphere"
$UTF8NoBOM = New-Object System.Text.UTF8Encoding($False)

Write-Host ">>> Lancement du Master Fix v2.2.6 - AudioFocus + Notification Buttons" -ForegroundColor Cyan

if (Test-Path $ProjectFolder) { Remove-Item -Recurse -Force $ProjectFolder }
git clone $RepoUrl
cd $ProjectFolder
[System.Environment]::CurrentDirectory = (Get-Location).Path

# ═══════════════════════════════════════════════════════════════════
# 1. Config Capacitor
# ═══════════════════════════════════════════════════════════════════
Write-Host ">>> Configuration Capacitor..." -ForegroundColor Yellow
$ConfigJSON = @"
{
  "appId": "com.radiosphere.app",
  "appName": "Radio Sphere",
  "webDir": "dist",
  "server": { "androidScheme": "https", "allowNavigation": ["*"] }
}
"@
$ConfigJSON | Out-File -FilePath "capacitor.config.json" -Encoding utf8

# ═══════════════════════════════════════════════════════════════════
# 2. Installation et Build
# ═══════════════════════════════════════════════════════════════════
Write-Host ">>> Installation des dependances et build..." -ForegroundColor Yellow
npm install --legacy-peer-deps
npm install @capacitor/cli @capawesome-team/capacitor-android-foreground-service @capacitor/app
npm run build
npm install @capacitor/android
npx cap add android

# ═══════════════════════════════════════════════════════════════════
# 3. Generation des icones de notification
# ═══════════════════════════════════════════════════════════════════
Write-Host ">>> Generation des icones de notification (fallback)..." -ForegroundColor Yellow

$sizes = @{ "mdpi"=24; "hdpi"=36; "xhdpi"=48; "xxhdpi"=72; "xxxhdpi"=96 }
foreach ($density in $sizes.Keys) {
    $dir = "android/app/src/main/res/drawable-$density"
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }
    $src = "android/app/src/main/res/mipmap-$density/ic_launcher_foreground.png"
    if (!(Test-Path $src)) {
        $src = "android/app/src/main/res/mipmap-$density/ic_launcher.png"
    }
    if (Test-Path $src) {
        Copy-Item $src "$dir/ic_notification.png" -Force
        Write-Host "    Copie $density -> ic_notification.png" -ForegroundColor DarkGray
    } else {
        Write-Host "    ATTENTION: Pas de source pour $density" -ForegroundColor Red
    }
}

$DrawablePath = "android/app/src/main/res/drawable"
if (!(Test-Path $DrawablePath)) { New-Item -ItemType Directory -Path $DrawablePath -Force }
$FallbackSrc = "android/app/src/main/res/mipmap-mdpi/ic_launcher.png"
if (Test-Path $FallbackSrc) {
    Copy-Item $FallbackSrc "$DrawablePath/ic_notification.png" -Force
    Write-Host "    Fallback drawable/ic_notification.png OK" -ForegroundColor DarkGray
}

# ═══════════════════════════════════════════════════════════════════
# 3b. Generation automotive_app_desc.xml (embarque dans le script)
# ═══════════════════════════════════════════════════════════════════
Write-Host ">>> Generation automotive_app_desc.xml..." -ForegroundColor Yellow
$XmlDir = "android/app/src/main/res/xml"
if (!(Test-Path $XmlDir)) { New-Item -ItemType Directory -Path $XmlDir -Force | Out-Null }

$AutoDescContent = @'
<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="media" />
</automotiveApp>
'@
[System.IO.File]::WriteAllText((Join-Path (Get-Location).Path "$XmlDir/automotive_app_desc.xml"), $AutoDescContent, $UTF8NoBOM)

if (Test-Path "$XmlDir/automotive_app_desc.xml") {
    Write-Host "    automotive_app_desc.xml genere avec succes" -ForegroundColor Green
} else {
    Write-Host "    ERREUR: automotive_app_desc.xml absent apres generation !" -ForegroundColor Red
}

# ═══════════════════════════════════════════════════════════════════
# 4. MANIFEST — Permissions + Services + Android Auto
# ═══════════════════════════════════════════════════════════════════
$ManifestPath = "android/app/src/main/AndroidManifest.xml"
if (Test-Path $ManifestPath) {
    Write-Host ">>> Manifest: Injection complete (Permissions, Services, Android Auto)..." -ForegroundColor Yellow
    $ManifestContent = Get-Content $ManifestPath -Raw
    
    # Permissions — only add if not already present
    $PermsList = @(
        "android.permission.INTERNET",
        "android.permission.WAKE_LOCK",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.POST_NOTIFICATIONS"
    )
    $PermsToAdd = ""
    foreach ($perm in $PermsList) {
        if ($ManifestContent -notmatch [regex]::Escape($perm)) {
            $PermsToAdd += "    <uses-permission android:name=`"$perm`" />`n"
            Write-Host "    + Permission: $perm" -ForegroundColor DarkGray
        } else {
            Write-Host "    = Permission deja presente: $perm" -ForegroundColor DarkGray
        }
    }
    if ($PermsToAdd.Length -gt 0) {
        $ManifestContent = $ManifestContent -replace '(<manifest[^>]*>)', "`$1`n$PermsToAdd"
    }
    
    if ($ManifestContent -notmatch 'usesCleartextTraffic') {
        $ManifestContent = $ManifestContent -replace '<application', '<application android:usesCleartextTraffic="true"'
    }
    
    # Foreground service + Android Auto MediaBrowserService
    $ServiceDecl = @"
    <receiver android:name="io.capawesome.capacitorjs.plugins.foregroundservice.NotificationActionBroadcastReceiver" />
    <service android:name="io.capawesome.capacitorjs.plugins.foregroundservice.AndroidForegroundService" android:foregroundServiceType="mediaPlayback" />

    <!-- Android Auto -->
    <meta-data
        android:name="com.google.android.gms.car.application"
        android:resource="@xml/automotive_app_desc" />
    <service
        android:name=".RadioBrowserService"
        android:exported="true">
        <intent-filter>
            <action android:name="android.media.browse.MediaBrowserService" />
        </intent-filter>
    </service>
"@
    $ManifestContent = $ManifestContent -replace '(<application[^>]*>)', "`$1`n$ServiceDecl"
    
    [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $ManifestPath), $ManifestContent, $UTF8NoBOM)
}

# ═══════════════════════════════════════════════════════════════════
# 5. Gradle — ExoPlayer + Media Compat (NO Kotlin needed)
# ═══════════════════════════════════════════════════════════════════
$GradleAppPath = "android/app/build.gradle"
if (Test-Path $GradleAppPath) {
    Write-Host ">>> Gradle: ExoPlayer + Media Compat (Java only)..." -ForegroundColor Yellow
    $GradleContent = Get-Content $GradleAppPath -Raw
    $DepsBlock = @"
dependencies {
    // ExoPlayer for Android Auto native audio playback
    implementation 'com.google.android.exoplayer:exoplayer-core:2.19.1'
    implementation 'com.google.android.exoplayer:exoplayer-ui:2.19.1'
    // Media Compat for MediaBrowserService & MediaSession
    implementation 'androidx.media:media:1.7.0'
"@
    $GradleContent = $GradleContent -replace 'dependencies \{', $DepsBlock
    [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $GradleAppPath), $GradleContent, $UTF8NoBOM)
}

# ═══════════════════════════════════════════════════════════════════
# 6. Generation des fichiers natifs Android Auto (JAVA — embarques)
# ═══════════════════════════════════════════════════════════════════
Write-Host ">>> Generation des fichiers natifs Android Auto (Java)..." -ForegroundColor Yellow

$JavaSrcBase = "android/app/src/main/java"
$PackageDir = "$JavaSrcBase/com/radiosphere/app"
if (!(Test-Path $PackageDir)) {
    $MainActFile = Get-ChildItem -Path $JavaSrcBase -Filter "MainActivity.*" -Recurse | Select-Object -First 1
    if ($MainActFile) {
        $PackageDir = $MainActFile.DirectoryName
        Write-Host "    Package directory found: $PackageDir" -ForegroundColor DarkGray
    } else {
        $PackageDir = "$JavaSrcBase/com/radiosphere/app"
        New-Item -ItemType Directory -Path $PackageDir -Force | Out-Null
    }
}

$ActualPackage = "com.radiosphere.app"
$MainActSearch = Get-ChildItem -Path $JavaSrcBase -Filter "MainActivity.*" -Recurse | Select-Object -First 1
if ($MainActSearch) {
    $MainContent = Get-Content $MainActSearch.FullName -Raw
    if ($MainContent -match 'package\s+([\w.]+)') {
        $ActualPackage = $Matches[1]
        Write-Host "    Package detecte: $ActualPackage" -ForegroundColor DarkGray
    }
}

# --- RadioAutoPlugin.java (embarque, single-quoted here-string) ---
Write-Host "    Generation RadioAutoPlugin.java..." -ForegroundColor DarkGray
$RadioAutoPluginJava = @'
package __PACKAGE__;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RadioAutoPlugin")
public class RadioAutoPlugin extends Plugin {

    private static final String PREFS_NAME = "RadioAutoPrefs";
    private static final String KEY_FAVORITES = "favorites_json";
    private static final String KEY_RECENTS = "recents_json";
    private static final String KEY_PLAYBACK_STATE = "playback_state_json";

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void syncFavorites(PluginCall call) {
        String stations = call.getString("stations", "[]");
        getPrefs().edit().putString(KEY_FAVORITES, stations).apply();
        call.resolve();
    }

    @PluginMethod
    public void syncRecents(PluginCall call) {
        String stations = call.getString("stations", "[]");
        getPrefs().edit().putString(KEY_RECENTS, stations).apply();
        call.resolve();
    }

    @PluginMethod
    public void notifyPlaybackState(PluginCall call) {
        String stationId = call.getString("stationId", "");
        String name = call.getString("name", "");
        String logo = call.getString("logo", "");
        String streamUrl = call.getString("streamUrl", "");
        Boolean isPlaying = call.getBoolean("isPlaying", false);
        String tags = call.getString("tags", "");
        String country = call.getString("country", "");

        String json = "{"
            + "\"stationId\":\"" + stationId + "\","
            + "\"name\":\"" + name.replace("\"", "\\\"") + "\","
            + "\"logo\":\"" + logo + "\","
            + "\"streamUrl\":\"" + streamUrl + "\","
            + "\"isPlaying\":" + isPlaying + ","
            + "\"tags\":\"" + tags.replace("\"", "\\\"") + "\","
            + "\"country\":\"" + country.replace("\"", "\\\"") + "\""
            + "}";

        getPrefs().edit().putString(KEY_PLAYBACK_STATE, json).apply();
        call.resolve();
    }
}
'@
$RadioAutoPluginJava = $RadioAutoPluginJava -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "RadioAutoPlugin.java"), $RadioAutoPluginJava, $UTF8NoBOM)
Write-Host "    RadioAutoPlugin.java genere avec succes" -ForegroundColor Green

# --- RadioBrowserService.java (embarque, single-quoted here-string) ---
# v2.2.6: Added AudioFocus management to pause other media apps
Write-Host "    Generation RadioBrowserService.java (v2.2.6 + AudioFocus)..." -ForegroundColor DarkGray
$RadioBrowserServiceJava = @'
package __PACKAGE__;

import android.content.Context;
import android.media.AudioManager;
import android.media.AudioFocusRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media.MediaBrowserServiceCompat;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
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
 * v2.2.6: AudioFocus management — pauses other media apps (Spotify, etc.)
 */
public class RadioBrowserService extends MediaBrowserServiceCompat {

    private static final String ROOT_ID = "root";
    private static final String FAVORITES_ID = "favorites";
    private static final String RECENTS_ID = "recents";
    private static final String GENRES_ID = "genres";

    private static final String GENRE_PREFIX = "genre:";
    private static final String STATION_PREFIX = "station:";

    private static final String PREFS_NAME = "RadioAutoPrefs";
    private static final String KEY_FAVORITES = "favorites_json";
    private static final String KEY_RECENTS = "recents_json";

    private static final String[] GENRES = {
        "60s", "70s", "80s", "90s", "ambient", "blues", "chillout", "classical",
        "country", "electronic", "funk", "hiphop", "jazz", "latin", "metal",
        "news", "pop", "r&b", "reggae", "rock", "soul", "techno", "trance", "world"
    };

    private static final String[] API_MIRRORS = {
        "https://de1.api.radio-browser.info",
        "https://fr1.api.radio-browser.info",
        "https://at1.api.radio-browser.info",
        "https://nl1.api.radio-browser.info"
    };

    private static final String DEFAULT_ARTWORK = "https://placehold.co/512x512/1a1a2e/e94560?text=RadioSphere";

    private MediaSessionCompat mediaSession;
    private ExoPlayer player;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private List<StationData> currentStations = new ArrayList<>();
    private int currentIndex = -1;

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
                // Another app took focus permanently — pause
                player.pause();
                updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                // Temporary loss (phone call, navigation voice) — pause
                player.pause();
                updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                // Regained focus — resume and restore volume
                player.setVolume(1.0f);
                player.play();
                updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                // Duck volume (e.g. navigation instruction)
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

        mediaSession = new MediaSessionCompat(this, "RadioSphereAuto");
        mediaSession.setCallback(mediaSessionCallback);
        mediaSession.setActive(true);
        setSessionToken(mediaSession.getSessionToken());
    }

    @Override
    public void onDestroy() {
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
                items.add(buildBrowsableItem(GENRES_ID, "Genres", "Explorer par genre musical"));
                result.sendResult(items);
                break;
            }
            case FAVORITES_ID: {
                List<StationData> stations = loadStations(KEY_FAVORITES);
                currentStations = stations;
                result.sendResult(toMediaItems(stations));
                break;
            }
            case RECENTS_ID: {
                List<StationData> stations = loadStations(KEY_RECENTS);
                currentStations = stations;
                result.sendResult(toMediaItems(stations));
                break;
            }
            case GENRES_ID: {
                List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
                for (String genre : GENRES) {
                    String title = genre.substring(0, 1).toUpperCase() + genre.substring(1);
                    items.add(buildBrowsableItem(GENRE_PREFIX + genre, title, "Stations " + genre + " populaires"));
                }
                result.sendResult(items);
                break;
            }
            default: {
                if (parentId.startsWith(GENRE_PREFIX)) {
                    String genre = parentId.substring(GENRE_PREFIX.length());
                    result.detach();
                    String finalGenre = genre;
                    new Thread(() -> {
                        List<StationData> stations = fetchStationsByGenre(finalGenre, 25);
                        currentStations = stations;
                        result.sendResult(toMediaItems(stations));
                    }).start();
                } else {
                    result.sendResult(new ArrayList<>());
                }
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
            switch (playbackState) {
                case Player.STATE_BUFFERING:
                    updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
                    break;
                case Player.STATE_READY:
                    if (player.isPlaying()) {
                        updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                    }
                    break;
                case Player.STATE_ENDED:
                case Player.STATE_IDLE:
                    updatePlaybackState(PlaybackStateCompat.STATE_STOPPED);
                    break;
            }
        }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            updatePlaybackState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED);
        }
    };

    // ─── Playback Helpers ───────────────────────────────────────────────

    private void playStation(StationData station) {
        // Request audio focus BEFORE starting playback — this pauses other media apps
        if (!requestAudioFocus()) {
            return; // Could not get audio focus, do not play
        }

        player.stop();
        player.setMediaItem(MediaItem.fromUri(station.streamUrl));
        player.prepare();
        player.setVolume(1.0f); // Restore volume in case it was ducked
        player.play();

        String artworkUrl = (station.logo != null && !station.logo.isEmpty())
            ? station.logo.replace("http://", "https://")
            : DEFAULT_ARTWORK;
        Uri artworkUri = Uri.parse(artworkUrl);

        String artist = "Radio Sphere";
        if (station.tags != null && !station.tags.isEmpty()) {
            String[] tagArr = station.tags.split(",");
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < Math.min(2, tagArr.length); i++) {
                if (i > 0) sb.append(" - ");
                sb.append(tagArr[i].trim());
            }
            if (sb.length() > 0) artist = sb.toString();
        }

        String album = (station.country != null && !station.country.isEmpty()) ? station.country : "Live";

        MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, station.id)
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, station.name)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
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

        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
            .build();

        mediaSession.setPlaybackState(playbackState);
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
            // ignore parse errors
        }
        return list;
    }

    private List<StationData> fetchStationsByGenre(String genre, int limit) {
        for (String mirror : API_MIRRORS) {
            try {
                String url = mirror + "/json/stations/bytag/" + Uri.encode(genre)
                    + "?limit=" + limit + "&order=votes&reverse=true&hidebroken=true";
                String response = httpGet(url);
                return parseApiResponse(response);
            } catch (Exception e) {
                // try next mirror
            }
        }
        return new ArrayList<>();
    }

    private List<StationData> searchStations(String query, int limit) {
        for (String mirror : API_MIRRORS) {
            try {
                String url = mirror + "/json/stations/search?name=" + Uri.encode(query)
                    + "&limit=" + limit + "&order=votes&reverse=true&hidebroken=true";
                String response = httpGet(url);
                return parseApiResponse(response);
            } catch (Exception e) {
                // try next mirror
            }
        }
        return new ArrayList<>();
    }

    private String httpGet(String urlStr) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line);
        }
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
            // ignore parse errors
        }
        return list;
    }

    // ─── MediaItem Builders ─────────────────────────────────────────────

    private List<MediaBrowserCompat.MediaItem> toMediaItems(List<StationData> stations) {
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
        for (StationData s : stations) {
            items.add(stationToMediaItem(s));
        }
        return items;
    }

    private MediaBrowserCompat.MediaItem stationToMediaItem(StationData station) {
        String artworkUrl = (station.logo != null && !station.logo.isEmpty())
            ? station.logo.replace("http://", "https://")
            : DEFAULT_ARTWORK;

        String subtitle = "Radio Sphere";
        if (station.tags != null && !station.tags.isEmpty()) {
            String[] tagArr = station.tags.split(",");
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < Math.min(2, tagArr.length); i++) {
                if (i > 0) sb.append(" - ");
                sb.append(tagArr[i].trim());
            }
            if (sb.length() > 0) subtitle = sb.toString();
        }
        if (subtitle.equals("Radio Sphere") && station.country != null && !station.country.isEmpty()) {
            subtitle = station.country;
        }

        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
            .setMediaId(STATION_PREFIX + station.id)
            .setTitle(station.name)
            .setSubtitle(subtitle)
            .setIconUri(Uri.parse(artworkUrl))
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
}
'@
$RadioBrowserServiceJava = $RadioBrowserServiceJava -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "RadioBrowserService.java"), $RadioBrowserServiceJava, $UTF8NoBOM)
Write-Host "    RadioBrowserService.java genere avec succes (v2.2.6 + AudioFocus)" -ForegroundColor Green

Write-Host "    Fichiers Android Auto (Java) generes avec succes!" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════════
# 7. Patch MainActivity.java — WebView + NotificationChannel + RadioAutoPlugin
# ═══════════════════════════════════════════════════════════════════
$MainAct = Get-ChildItem -Path "android/app/src/main/java" -Filter "MainActivity.java" -Recurse | Select-Object -First 1
if ($MainAct) {
    Write-Host ">>> Patch Java MainActivity (WebView + NotifChannel + RadioAutoPlugin)..." -ForegroundColor Yellow
    $Java = Get-Content $MainAct.FullName -Raw

    if ($Java -notmatch 'RadioAutoPlugin') {
        $Java = $Java -replace '(import .+BridgeActivity;)', "`$1`nimport $ActualPackage.RadioAutoPlugin;"
    }

    $OnCreatePatch = @"
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(RadioAutoPlugin.class);
    super.onCreate(savedInstanceState);
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        android.app.NotificationChannel channel = new android.app.NotificationChannel(
            "radio_playback_v3", "Radio Playback", android.app.NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        channel.setDescription("Notification silencieuse pour la lecture radio");
        channel.enableVibration(false);
        nm.createNotificationChannel(channel);
    }
  }

  @Override
  public void onResume() {
    super.onResume();
    if (getBridge() != null && getBridge().getWebView() != null) {
        android.webkit.WebSettings s = getBridge().getWebView().getSettings();
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }
  }
"@
    # Remove any existing onCreate/onResume overrides
    $Java = $Java -replace '(?s)\s*@Override\s*public void onCreate\(android\.os\.Bundle[^}]*}\s*}\s*}', ''
    $Java = $Java -replace '(?s)\s*@Override\s*public void onResume\(\).*?}\s*}', ''
    # Insert after class declaration
    $Java = $Java -replace '(public class MainActivity extends BridgeActivity \{)', "`$1`n$OnCreatePatch"
    [System.IO.File]::WriteAllText($MainAct.FullName, $Java, $UTF8NoBOM)
} else {
    Write-Host "    ERREUR: MainActivity.java introuvable !" -ForegroundColor Red
}

# ═══════════════════════════════════════════════════════════════════
# 8. Sync final
# ═══════════════════════════════════════════════════════════════════
npx cap sync

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host ">>> Script v2.2.6 Termine ! AudioFocus + Notification Buttons" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "CHANGEMENTS v2.2.6 :" -ForegroundColor Yellow
Write-Host "  - AudioFocus: Spotify/autres apps mises en pause automatiquement" -ForegroundColor White
Write-Host "  - AudioFocus: Gestion perte de focus (pause/duck/resume)" -ForegroundColor White
Write-Host "  - Notification: Boutons Play/Pause dans la barre des taches" -ForegroundColor White
Write-Host "  - Notification: Listener buttonClicked dans PlayerContext" -ForegroundColor White
Write-Host "  - Navigation Next/Previous dans favoris/recents — inchange" -ForegroundColor White
Write-Host "  - Recherche vocale + textuelle — inchange" -ForegroundColor White
Write-Host "  - Browse tree: Favoris, Recents, 24 Genres — inchange" -ForegroundColor White
Write-Host "  - Zero reference iOS — code propre" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT : DESINSTALLER L'ANCIENNE APK AVANT D'INSTALLER !" -ForegroundColor Red
Write-Host ""
Write-Host "ETAPES SUIVANTES :" -ForegroundColor Yellow
Write-Host "  1. npx cap open android" -ForegroundColor White
Write-Host "  2. Build APK dans Android Studio" -ForegroundColor White
Write-Host "  3. Tester Android Auto : lancer une station et verifier" -ForegroundColor White
Write-Host "     que Spotify se met en pause automatiquement" -ForegroundColor White
Write-Host "  4. Verifier le bouton Play/Pause dans la notification" -ForegroundColor White
Write-Host ""
Write-Host ">>> npx cap open android" -ForegroundColor Cyan
