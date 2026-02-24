package app.lovable.radiosphere

import android.content.Context
import android.content.SharedPreferences
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * RadioAutoPlugin — Native Capacitor plugin (Android side).
 *
 * Receives favorites, recents, and playback state from the WebView
 * and stores them in SharedPreferences so RadioBrowserService can read them.
 */
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
