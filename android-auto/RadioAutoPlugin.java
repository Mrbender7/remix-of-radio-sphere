package com.radiosphere.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * RadioAutoPlugin — Native Capacitor plugin (Android side).
 *
 * Receives favorites, recents, and playback state from the WebView
 * and stores them in SharedPreferences so RadioBrowserService can read them.
 *
 * v2.2.9: Also starts/stops MediaPlaybackService for lock screen MediaStyle notification.
 */
@CapacitorPlugin(name = "RadioAutoPlugin")
public class RadioAutoPlugin extends Plugin {

    private static RadioAutoPlugin activeInstance;
    private static final String PREFS_NAME = "RadioAutoPrefs";
    private static final String KEY_FAVORITES = "favorites_json";
    private static final String KEY_RECENTS = "recents_json";
    private static final String KEY_PLAYBACK_STATE = "playback_state_json";
    public static RadioAutoPlugin getActiveInstance() {
        return activeInstance;
    }

    @Override
    public void load() {
        activeInstance = this;
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    /**
     * Called by MediaToggleReceiver when user taps Play/Pause on notification.
     * Emits a JS event that PlayerContext listens for.
     */
    public void notifyToggleFromNotification() {
        notifyListeners("mediaToggle", new com.getcapacitor.JSObject());
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
    public void clearAppData(PluginCall call) {
        try {
            getPrefs().edit()
                .remove(KEY_FAVORITES)
                .remove(KEY_RECENTS)
                .remove(KEY_PLAYBACK_STATE)
                .apply();

            Context ctx = getContext();
            try {
                ctx.stopService(new Intent(ctx, MediaPlaybackService.class));
            } catch (Exception ignored) {
                // Service may not be running
            }

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear app data", e);
        }
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

        // Save to SharedPreferences (for Android Auto)
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

        // Start or update MediaPlaybackService for lock screen notification
        Context ctx = getContext();
        Intent serviceIntent = new Intent(ctx, MediaPlaybackService.class);
        serviceIntent.setAction(MediaPlaybackService.ACTION_UPDATE);
        serviceIntent.putExtra("station_name", name);
        serviceIntent.putExtra("station_logo", logo);
        serviceIntent.putExtra("is_playing", isPlaying);

        if (isPlaying) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }
        } else {
            // Update notification to show paused state (don't stop service yet)
            try {
                ctx.startService(serviceIntent);
            } catch (Exception e) {
                // Service not running, ignore
            }
        }

        call.resolve();
    }
}
