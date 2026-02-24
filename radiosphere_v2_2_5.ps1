# radiosphere_v2_2_5.ps1
# Android Auto Integration — Full automated setup (100% autonome)
$RepoUrl = "https://github.com/Mrbender7/radiosphere"
$ProjectFolder = "radiosphere"
$UTF8NoBOM = New-Object System.Text.UTF8Encoding($False)

Write-Host ">>> Lancement du Master Fix v2.2.5 - Android Auto Integration" -ForegroundColor Cyan

if (Test-Path $ProjectFolder) { Remove-Item -Recurse -Force $ProjectFolder }
git clone $RepoUrl
cd $ProjectFolder

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
# 5. Gradle — Kotlin fix + ExoPlayer + Media Compat
# ═══════════════════════════════════════════════════════════════════
$GradleAppPath = "android/app/build.gradle"
if (Test-Path $GradleAppPath) {
    Write-Host ">>> Gradle: Kotlin fix + ExoPlayer + Media Compat..." -ForegroundColor Yellow
    $GradleContent = Get-Content $GradleAppPath -Raw
    $DepsBlock = @"
dependencies {
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:1.8.22"))
    constraints {
        implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22")
        implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22")
    }
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
# 6. Generation des fichiers natifs Android Auto (embarques)
# ═══════════════════════════════════════════════════════════════════
Write-Host ">>> Generation des fichiers natifs Android Auto..." -ForegroundColor Yellow

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

# --- RadioBrowserService.kt (embarque, single-quoted here-string) ---
Write-Host "    Generation RadioBrowserService.kt..." -ForegroundColor DarkGray
$RadioBrowserServiceKt = @'
package __PACKAGE__

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media.MediaBrowserServiceCompat
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.Player
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL

class RadioBrowserService : MediaBrowserServiceCompat() {

    companion object {
        private const val ROOT_ID = "root"
        private const val FAVORITES_ID = "favorites"
        private const val RECENTS_ID = "recents"
        private const val GENRES_ID = "genres"
        private const val SEARCH_ID = "search"

        private const val GENRE_PREFIX = "genre:"
        private const val STATION_PREFIX = "station:"

        private const val PREFS_NAME = "RadioAutoPrefs"
        private const val KEY_FAVORITES = "favorites_json"
        private const val KEY_RECENTS = "recents_json"

        private val GENRES = listOf(
            "60s", "70s", "80s", "90s", "ambient", "blues", "chillout", "classical",
            "country", "electronic", "funk", "hiphop", "jazz", "latin", "metal",
            "news", "pop", "r&b", "reggae", "rock", "soul", "techno", "trance", "world"
        )

        private val API_MIRRORS = listOf(
            "https://de1.api.radio-browser.info",
            "https://fr1.api.radio-browser.info",
            "https://at1.api.radio-browser.info",
            "https://nl1.api.radio-browser.info"
        )

        private const val DEFAULT_ARTWORK = "https://placehold.co/512x512/1a1a2e/e94560?text=RadioSphere"
    }

    private lateinit var mediaSession: MediaSessionCompat
    private lateinit var player: ExoPlayer
    private var currentStations: List<StationData> = emptyList()
    private var currentIndex: Int = -1

    data class StationData(
        val id: String,
        val name: String,
        val streamUrl: String,
        val logo: String,
        val country: String,
        val tags: String
    )

    override fun onCreate() {
        super.onCreate()
        player = ExoPlayer.Builder(this).build()
        player.addListener(playerListener)
        mediaSession = MediaSessionCompat(this, "RadioSphereAuto").apply {
            setCallback(mediaSessionCallback)
            isActive = true
        }
        sessionToken = mediaSession.sessionToken
    }

    override fun onDestroy() {
        player.release()
        mediaSession.release()
        super.onDestroy()
    }

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?
    ): BrowserRoot {
        return BrowserRoot(ROOT_ID, null)
    }

    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        when (parentId) {
            ROOT_ID -> {
                val items = mutableListOf(
                    buildBrowsableItem(FAVORITES_ID, "Favoris", "Vos stations preferees"),
                    buildBrowsableItem(RECENTS_ID, "Recents", "Dernieres stations ecoutees"),
                    buildBrowsableItem(GENRES_ID, "Genres", "Explorer par genre musical")
                )
                result.sendResult(items)
            }
            FAVORITES_ID -> {
                val stations = loadStations(KEY_FAVORITES)
                currentStations = stations
                result.sendResult(stations.map { it.toMediaItem() }.toMutableList())
            }
            RECENTS_ID -> {
                val stations = loadStations(KEY_RECENTS)
                currentStations = stations
                result.sendResult(stations.map { it.toMediaItem() }.toMutableList())
            }
            GENRES_ID -> {
                val items = GENRES.map { genre ->
                    buildBrowsableItem(
                        "$GENRE_PREFIX$genre",
                        genre.replaceFirstChar { it.uppercase() },
                        "Stations $genre populaires"
                    )
                }
                result.sendResult(items.toMutableList())
            }
            else -> {
                if (parentId.startsWith(GENRE_PREFIX)) {
                    val genre = parentId.removePrefix(GENRE_PREFIX)
                    result.detach()
                    Thread {
                        val stations = fetchStationsByGenre(genre)
                        currentStations = stations
                        result.sendResult(stations.map { it.toMediaItem() }.toMutableList())
                    }.start()
                } else {
                    result.sendResult(mutableListOf())
                }
            }
        }
    }

    override fun onSearch(
        query: String,
        extras: Bundle?,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        result.detach()
        Thread {
            val stations = searchStations(query)
            currentStations = stations
            result.sendResult(stations.map { it.toMediaItem() }.toMutableList())
        }.start()
    }

    private val mediaSessionCallback = object : MediaSessionCompat.Callback() {

        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
            if (mediaId == null) return
            val stationId = mediaId.removePrefix(STATION_PREFIX)
            val idx = currentStations.indexOfFirst { it.id == stationId }
            if (idx >= 0) {
                currentIndex = idx
                playStation(currentStations[idx])
            }
        }

        override fun onPlay() {
            player.play()
            updatePlaybackState(PlaybackStateCompat.STATE_PLAYING)
        }

        override fun onPause() {
            player.pause()
            updatePlaybackState(PlaybackStateCompat.STATE_PAUSED)
        }

        override fun onStop() {
            player.stop()
            updatePlaybackState(PlaybackStateCompat.STATE_STOPPED)
        }

        override fun onSkipToNext() {
            if (currentStations.isEmpty()) return
            currentIndex = (currentIndex + 1) % currentStations.size
            playStation(currentStations[currentIndex])
        }

        override fun onSkipToPrevious() {
            if (currentStations.isEmpty()) return
            currentIndex = if (currentIndex - 1 < 0) currentStations.size - 1 else currentIndex - 1
            playStation(currentStations[currentIndex])
        }

        override fun onPlayFromSearch(query: String?, extras: Bundle?) {
            if (query.isNullOrBlank()) {
                val favorites = loadStations(KEY_FAVORITES)
                if (favorites.isNotEmpty()) {
                    currentStations = favorites
                    currentIndex = 0
                    playStation(favorites[0])
                }
                return
            }
            Thread {
                val stations = searchStations(query)
                if (stations.isNotEmpty()) {
                    currentStations = stations
                    currentIndex = 0
                    playStation(stations[0])
                }
            }.start()
        }
    }

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            when (playbackState) {
                Player.STATE_BUFFERING -> updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING)
                Player.STATE_READY -> {
                    if (player.isPlaying) {
                        updatePlaybackState(PlaybackStateCompat.STATE_PLAYING)
                    }
                }
                Player.STATE_ENDED, Player.STATE_IDLE -> {
                    updatePlaybackState(PlaybackStateCompat.STATE_STOPPED)
                }
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            updatePlaybackState(
                if (isPlaying) PlaybackStateCompat.STATE_PLAYING
                else PlaybackStateCompat.STATE_PAUSED
            )
        }
    }

    private fun playStation(station: StationData) {
        player.stop()
        player.setMediaItem(MediaItem.fromUri(station.streamUrl))
        player.prepare()
        player.play()

        val artworkUri = if (station.logo.isNotBlank()) {
            Uri.parse(station.logo.replace("http://", "https://"))
        } else {
            Uri.parse(DEFAULT_ARTWORK)
        }

        val metadata = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, station.id)
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, station.name)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, station.tags.split(",").take(2).joinToString(" - ").ifBlank { "Radio Sphere" })
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, station.country.ifBlank { "Live" })
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, artworkUri.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ART_URI, artworkUri.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, artworkUri.toString())
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1)
            .build()

        mediaSession.setMetadata(metadata)
        updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING)
    }

    private fun updatePlaybackState(state: Int) {
        val actions = PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_STOP or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH or
                PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID

        val playbackState = PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
            .build()

        mediaSession.setPlaybackState(playbackState)
    }

    private fun loadStations(key: String): List<StationData> {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val json = prefs.getString(key, "[]") ?: "[]"
        return parseStationsJson(json)
    }

    private fun parseStationsJson(json: String): List<StationData> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                StationData(
                    id = obj.optString("id", ""),
                    name = obj.optString("name", "Unknown"),
                    streamUrl = obj.optString("streamUrl", ""),
                    logo = obj.optString("logo", ""),
                    country = obj.optString("country", ""),
                    tags = obj.optString("tags", "")
                )
            }.filter { it.streamUrl.isNotBlank() }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun fetchStationsByGenre(genre: String, limit: Int = 25): List<StationData> {
        for (mirror in API_MIRRORS) {
            try {
                val url = "$mirror/json/stations/bytag/${Uri.encode(genre)}?limit=$limit&order=votes&reverse=true&hidebroken=true"
                val response = URL(url).readText()
                return parseApiResponse(response)
            } catch (_: Exception) {
                continue
            }
        }
        return emptyList()
    }

    private fun searchStations(query: String, limit: Int = 25): List<StationData> {
        for (mirror in API_MIRRORS) {
            try {
                val url = "$mirror/json/stations/search?name=${Uri.encode(query)}&limit=$limit&order=votes&reverse=true&hidebroken=true"
                val response = URL(url).readText()
                return parseApiResponse(response)
            } catch (_: Exception) {
                continue
            }
        }
        return emptyList()
    }

    private fun parseApiResponse(json: String): List<StationData> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                StationData(
                    id = obj.optString("stationuuid", ""),
                    name = obj.optString("name", "Unknown"),
                    streamUrl = obj.optString("url_resolved", obj.optString("url", "")),
                    logo = obj.optString("favicon", ""),
                    country = obj.optString("country", ""),
                    tags = obj.optString("tags", "")
                )
            }.filter { it.streamUrl.isNotBlank() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun StationData.toMediaItem(): MediaBrowserCompat.MediaItem {
        val artworkUri = if (logo.isNotBlank()) {
            Uri.parse(logo.replace("http://", "https://"))
        } else {
            Uri.parse(DEFAULT_ARTWORK)
        }

        val subtitle = tags.split(",").take(2).joinToString(" - ").ifBlank { country.ifBlank { "Radio Sphere" } }

        val desc = MediaDescriptionCompat.Builder()
            .setMediaId("$STATION_PREFIX$id")
            .setTitle(name)
            .setSubtitle(subtitle)
            .setIconUri(artworkUri)
            .build()

        return MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE)
    }

    private fun buildBrowsableItem(
        mediaId: String,
        title: String,
        subtitle: String
    ): MediaBrowserCompat.MediaItem {
        val desc = MediaDescriptionCompat.Builder()
            .setMediaId(mediaId)
            .setTitle(title)
            .setSubtitle(subtitle)
            .build()
        return MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE)
    }
}
'@
# Replace placeholder with actual package name
$RadioBrowserServiceKt = $RadioBrowserServiceKt -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "RadioBrowserService.kt"), $RadioBrowserServiceKt, $UTF8NoBOM)
Write-Host "    RadioBrowserService.kt genere avec succes" -ForegroundColor Green

# --- RadioAutoPlugin.kt (embarque, single-quoted here-string) ---
Write-Host "    Generation RadioAutoPlugin.kt..." -ForegroundColor DarkGray
$RadioAutoPluginKt = @'
package __PACKAGE__

import android.content.Context
import android.content.SharedPreferences
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "RadioAutoPlugin")
class RadioAutoPlugin : Plugin() {

    companion object {
        private const val PREFS_NAME = "RadioAutoPrefs"
        private const val KEY_FAVORITES = "favorites_json"
        private const val KEY_RECENTS = "recents_json"
        private const val KEY_PLAYBACK_STATE = "playback_state_json"
    }

    private fun getPrefs(): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    @PluginMethod
    fun syncFavorites(call: PluginCall) {
        val stations = call.getString("stations", "[]") ?: "[]"
        getPrefs().edit().putString(KEY_FAVORITES, stations).apply()
        call.resolve()
    }

    @PluginMethod
    fun syncRecents(call: PluginCall) {
        val stations = call.getString("stations", "[]") ?: "[]"
        getPrefs().edit().putString(KEY_RECENTS, stations).apply()
        call.resolve()
    }

    @PluginMethod
    fun notifyPlaybackState(call: PluginCall) {
        val stationId = call.getString("stationId", "") ?: ""
        val name = call.getString("name", "") ?: ""
        val logo = call.getString("logo", "") ?: ""
        val streamUrl = call.getString("streamUrl", "") ?: ""
        val isPlaying = call.getBoolean("isPlaying", false) ?: false
        val tags = call.getString("tags", "") ?: ""
        val country = call.getString("country", "") ?: ""

        val json = """
            {
                "stationId": "$stationId",
                "name": "${name.replace("\"", "\\\"")}",
                "logo": "$logo",
                "streamUrl": "$streamUrl",
                "isPlaying": $isPlaying,
                "tags": "${tags.replace("\"", "\\\"")}",
                "country": "${country.replace("\"", "\\\"")}"
            }
        """.trimIndent()

        getPrefs().edit().putString(KEY_PLAYBACK_STATE, json).apply()
        call.resolve()
    }
}
'@
$RadioAutoPluginKt = $RadioAutoPluginKt -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "RadioAutoPlugin.kt"), $RadioAutoPluginKt, $UTF8NoBOM)
Write-Host "    RadioAutoPlugin.kt genere avec succes" -ForegroundColor Green

Write-Host "    Fichiers Android Auto generes avec succes!" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════════
# 7. Patch MainActivity — WebView + NotificationChannel + RadioAutoPlugin
# ═══════════════════════════════════════════════════════════════════
$MainAct = Get-ChildItem -Path "android/app/src/main/java" -Filter "MainActivity.*" -Recurse | Select-Object -First 1
if ($MainAct) {
    $IsKotlin = $MainAct.Extension -eq ".kt"
    
    if ($IsKotlin) {
        Write-Host ">>> Patch Kotlin MainActivity (WebView + NotifChannel + RadioAutoPlugin)..." -ForegroundColor Yellow
        $Kotlin = Get-Content $MainAct.FullName -Raw
        
        if ($Kotlin -notmatch 'RadioAutoPlugin') {
            $Kotlin = $Kotlin -replace '(import .+BridgeActivity)', "`$1`nimport $ActualPackage.RadioAutoPlugin"
        }
        
        $KotlinPatch = @"
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(RadioAutoPlugin::class.java)
        super.onCreate(savedInstanceState)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val nm = getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            val channel = android.app.NotificationChannel(
                "radio_playback_v3", "Radio Playback", android.app.NotificationManager.IMPORTANCE_LOW)
            channel.setShowBadge(false)
            channel.description = "Notification silencieuse pour la lecture radio"
            channel.enableVibration(false)
            nm.createNotificationChannel(channel)
        }
        bridge?.webView?.settings?.apply {
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
    }
"@
        $Kotlin = $Kotlin -replace '(?s)\s*override fun onCreate\(savedInstanceState[^}]*\{[^}]*(\{[^}]*\}[^}]*)*\}', ''
        $Kotlin = $Kotlin -replace '(class MainActivity\s*:\s*BridgeActivity\(\)\s*\{)', "`$1`n$KotlinPatch"
        [System.IO.File]::WriteAllText($MainAct.FullName, $Kotlin, $UTF8NoBOM)
        
    } else {
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
        $Java = $Java -replace '(?s)\s*@Override\s*public void onCreate\(android\.os\.Bundle[^}]*}\s*}\s*}', ''
        $Java = $Java -replace '(?s)\s*@Override\s*public void onResume\(\).*?}\s*}', ''
        if ($Java -notmatch "RadioAutoPlugin") {
            $Java = $Java -replace 'public class MainActivity extends BridgeActivity \{', "public class MainActivity extends BridgeActivity {`n$OnCreatePatch"
        }
        [System.IO.File]::WriteAllText($MainAct.FullName, $Java, $UTF8NoBOM)
    }
}

# ═══════════════════════════════════════════════════════════════════
# 8. Sync final
# ═══════════════════════════════════════════════════════════════════
npx cap sync

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host ">>> Script v2.2.5 Termine ! Android Auto Ready" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "CHANGEMENTS v2.2.5 :" -ForegroundColor Yellow
Write-Host "  - Android Auto MediaBrowserService integre" -ForegroundColor White
Write-Host "  - ExoPlayer + Media Compat ajoutes au Gradle" -ForegroundColor White
Write-Host "  - RadioAutoPlugin Capacitor enregistre dans MainActivity" -ForegroundColor White
Write-Host "  - Browse tree: Favoris, Recents, 24 Genres" -ForegroundColor White
Write-Host "  - Recherche vocale (API radio-browser.info native)" -ForegroundColor White
Write-Host "  - Artwork plein ecran + Next/Previous dans favoris" -ForegroundColor White
Write-Host "  - Canal radio_playback_v3 avec setShowBadge(false)" -ForegroundColor White
Write-Host "  - Permissions non dupliquees (verification avant injection)" -ForegroundColor White
Write-Host "  - Fichiers natifs 100% embarques (aucune dependance externe)" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT : DESINSTALLER L'ANCIENNE APK AVANT D'INSTALLER !" -ForegroundColor Red
Write-Host ""
Write-Host "ETAPES SUIVANTES :" -ForegroundColor Yellow
Write-Host "  1. npx cap open android" -ForegroundColor White
Write-Host "  2. Build APK dans Android Studio" -ForegroundColor White
Write-Host "  3. Tester Android Auto avec le DHU (Desktop Head Unit)" -ForegroundColor White
Write-Host "     ou directement sur un vehicule compatible" -ForegroundColor White
Write-Host ""
Write-Host ">>> npx cap open android" -ForegroundColor Cyan
