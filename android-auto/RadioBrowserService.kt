package app.lovable.radiosphere

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

/**
 * RadioBrowserService — Android Auto MediaBrowserService for RadioSphere.
 *
 * Provides browse tree (Favorites, Recents, Genres) and voice search.
 * Reads favorites/recents from SharedPreferences (synced from WebView via RadioAutoPlugin).
 * Uses ExoPlayer for native audio playback independent of the WebView.
 */
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

        // Default artwork when station has no logo
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

    // ─── Browse Tree ────────────────────────────────────────────────────

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
                    buildBrowsableItem(FAVORITES_ID, "⭐ Favoris", "Vos stations préférées"),
                    buildBrowsableItem(RECENTS_ID, "🕐 Récents", "Dernières stations écoutées"),
                    buildBrowsableItem(GENRES_ID, "🎵 Genres", "Explorer par genre musical")
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

    // ─── Voice Search ───────────────────────────────────────────────────

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

    // ─── MediaSession Callbacks ─────────────────────────────────────────

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
                // Play first favorite if no query
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

    // ─── Player Listener ────────────────────────────────────────────────

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

    // ─── Playback Helpers ───────────────────────────────────────────────

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
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, station.tags.split(",").take(2).joinToString(" • ").ifBlank { "Radio Sphere" })
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, station.country.ifBlank { "Live" })
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, artworkUri.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ART_URI, artworkUri.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, artworkUri.toString())
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1) // Live stream
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

    // ─── Data Helpers ───────────────────────────────────────────────────

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

    // ─── MediaItem Builders ─────────────────────────────────────────────

    private fun StationData.toMediaItem(): MediaBrowserCompat.MediaItem {
        val artworkUri = if (logo.isNotBlank()) {
            Uri.parse(logo.replace("http://", "https://"))
        } else {
            Uri.parse(DEFAULT_ARTWORK)
        }

        val subtitle = tags.split(",").take(2).joinToString(" • ").ifBlank { country.ifBlank { "Radio Sphere" } }

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
