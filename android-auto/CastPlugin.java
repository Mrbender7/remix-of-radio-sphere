package com.radiosphere.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.mediarouter.media.MediaRouteSelector;
import androidx.mediarouter.media.MediaRouter;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.cast.CastMediaControlIntent;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManager;
import com.google.android.gms.cast.framework.SessionManagerListener;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import com.google.android.gms.common.images.WebImage;
import android.net.Uri;

/**
 * CastPlugin v2.4.2 — Capacitor plugin for native Chromecast integration.
 *
 * Key changes in v2.4.2:
 * - Uses DEFAULT_MEDIA_RECEIVER_APPLICATION_ID for broadest device discovery
 * - Runtime permission handling for Android 13+ (NEARBY_WIFI_DEVICES)
 * - Enhanced diagnostic logging (Total routes, matching routes, AppID)
 * - CALLBACK_FLAG_PERFORM_ACTIVE_SCAN for aggressive discovery
 */
@CapacitorPlugin(
    name = "CastPlugin",
    permissions = {
        @Permission(
            alias = "network",
            strings = {
                "android.permission.ACCESS_FINE_LOCATION",
                "android.permission.NEARBY_WIFI_DEVICES"
            }
        )
    }
)
public class CastPlugin extends Plugin {

    private static final String TAG = "CastPlugin";
    // Production custom receiver
    private static final String CAST_APP_ID = "65257ADB";

    private CastContext castContext;
    private MediaRouter mediaRouter;
    private MediaRouteSelector mediaRouteSelector;
    private boolean devicesAvailable = false;
    private PluginCall savedInitCall = null;

    // ─── Session listener ───────────────────────────────────────────
    private final SessionManagerListener<CastSession> sessionListener = new SessionManagerListener<CastSession>() {
        @Override public void onSessionStarting(@NonNull CastSession s) { Log.d(TAG, "Session starting..."); }
        @Override public void onSessionStarted(@NonNull CastSession session, @NonNull String id) {
            Log.d(TAG, "Session started: " + id);
            JSObject data = new JSObject();
            data.put("connected", true);
            data.put("deviceName", session.getCastDevice() != null ? session.getCastDevice().getFriendlyName() : "Chromecast");
            notifyListeners("castStateChanged", data);
            // v2.4.5: Notify JS to pause local audio immediately
            JSObject audioPause = new JSObject();
            audioPause.put("action", "pauseLocal");
            notifyListeners("localAudioControl", audioPause);
            Log.d(TAG, "Sent localAudioControl:pauseLocal to JS");
        }
        @Override public void onSessionStartFailed(@NonNull CastSession s, int err) {
            Log.e(TAG, "Session start failed: " + err);
            JSObject data = new JSObject(); data.put("connected", false); data.put("deviceName", "");
            notifyListeners("castStateChanged", data);
        }
        @Override public void onSessionEnding(@NonNull CastSession s) {}
        @Override public void onSessionEnded(@NonNull CastSession s, int err) {
            Log.d(TAG, "Session ended");
            JSObject data = new JSObject(); data.put("connected", false); data.put("deviceName", "");
            notifyListeners("castStateChanged", data);
            // v2.4.5: Notify JS to resume local audio
            JSObject audioResume = new JSObject();
            audioResume.put("action", "resumeLocal");
            notifyListeners("localAudioControl", audioResume);
            Log.d(TAG, "Sent localAudioControl:resumeLocal to JS");
        }
        @Override public void onSessionResuming(@NonNull CastSession s, @NonNull String id) {}
        @Override public void onSessionResumed(@NonNull CastSession session, boolean wasSuspended) {
            Log.d(TAG, "Session resumed");
            JSObject data = new JSObject();
            data.put("connected", true);
            data.put("deviceName", session.getCastDevice() != null ? session.getCastDevice().getFriendlyName() : "Chromecast");
            notifyListeners("castStateChanged", data);
        }
        @Override public void onSessionResumeFailed(@NonNull CastSession s, int err) {}
        @Override public void onSessionSuspended(@NonNull CastSession s, int reason) {}
    };

    // ─── MediaRouter callback ───────────────────────────────────────
    private final MediaRouter.Callback mediaRouterCallback = new MediaRouter.Callback() {
        @Override public void onRouteAdded(@NonNull MediaRouter router, @NonNull MediaRouter.RouteInfo route) {
            Log.d(TAG, "Route added: " + route.getName());
            updateDeviceAvailability(router);
        }
        @Override public void onRouteRemoved(@NonNull MediaRouter router, @NonNull MediaRouter.RouteInfo route) {
            Log.d(TAG, "Route removed: " + route.getName());
            updateDeviceAvailability(router);
        }
        @Override public void onRouteChanged(@NonNull MediaRouter router, @NonNull MediaRouter.RouteInfo route) {
            updateDeviceAvailability(router);
        }
    };

    // ─── v2.4.2: Enhanced diagnostic logging ────────────────────────
    private void updateDeviceAvailability(MediaRouter router) {
        int totalRoutes = router.getRoutes().size();
        int matchingRoutes = 0;
        boolean hasDevices = false;

        for (MediaRouter.RouteInfo route : router.getRoutes()) {
            if (route.matchesSelector(mediaRouteSelector) && !route.isDefault()) {
                hasDevices = true;
                matchingRoutes++;
                Log.d(TAG, "  Cast-compatible route: " + route.getName() + " [" + route.getDescription() + "]");
            }
        }

        Log.d(TAG, "Scan details: Total routes=" + totalRoutes + ", matching=" + matchingRoutes + ", AppID=" + CAST_APP_ID);

        if (hasDevices != devicesAvailable) {
            devicesAvailable = hasDevices;
            Log.d(TAG, "Devices available changed: " + devicesAvailable);
            JSObject data = new JSObject(); data.put("available", devicesAvailable);
            notifyListeners("castDevicesAvailable", data);
        }
    }

    // ─── Permission helpers ─────────────────────────────────────────
    private boolean hasDiscoveryPermissions() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(ctx, "android.permission.NEARBY_WIFI_DEVICES") == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void checkDiscoveryPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasDiscoveryPermissions());
        result.put("apiLevel", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    @PluginMethod
    public void requestDiscoveryPermissions(PluginCall call) {
        if (hasDiscoveryPermissions()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("network", call, "networkPermissionCallback");
    }

    @PermissionCallback
    private void networkPermissionCallback(PluginCall call) {
        boolean granted = hasDiscoveryPermissions();
        Log.d(TAG, "Network permission callback — granted: " + granted);
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);

        // If this was triggered from initialize, resume it
        if (granted && savedInitCall != null) {
            PluginCall saved = savedInitCall;
            savedInitCall = null;
            doInitialize(saved);
        }
    }

    // ─── Initialize ─────────────────────────────────────────────────
    @PluginMethod
    public void initialize(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            Log.d(TAG, "initialize — permissions missing, requesting...");
            savedInitCall = call;
            requestPermissionForAlias("network", call, "networkPermissionCallback");
            return;
        }
        doInitialize(call);
    }

    private void doInitialize(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    Log.d(TAG, "Initializing Cast SDK with AppID: " + CAST_APP_ID);
                    castContext = CastContext.getSharedInstance(getContext());
                    SessionManager sm = castContext.getSessionManager();
                    sm.addSessionManagerListener(sessionListener, CastSession.class);

                    // v2.4.2: Use DEFAULT_MEDIA_RECEIVER for broadest device discovery
                    mediaRouteSelector = new MediaRouteSelector.Builder()
                        .addControlCategory(CastMediaControlIntent.categoryForCast(
                            CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID))
                        .build();

                    mediaRouter = MediaRouter.getInstance(getContext());
                    mediaRouter.addCallback(mediaRouteSelector, mediaRouterCallback,
                        MediaRouter.CALLBACK_FLAG_REQUEST_DISCOVERY | MediaRouter.CALLBACK_FLAG_PERFORM_ACTIVE_SCAN);

                    // Immediate diagnostic scan
                    updateDeviceAvailability(mediaRouter);

                    boolean permsOk = hasDiscoveryPermissions();
                    Log.d(TAG, "Cast SDK initialized — perms=" + permsOk + ", apiLevel=" + Build.VERSION.SDK_INT);

                    JSObject result = new JSObject();
                    result.put("initialized", true);
                    result.put("available", devicesAvailable);
                    result.put("permissionsGranted", permsOk);
                    result.put("appId", CAST_APP_ID);
                    call.resolve(result);
                } catch (Exception e) {
                    Log.e(TAG, "Cast init error", e);
                    call.reject("Cast init failed: " + e.getMessage());
                }
            });
        } catch (Exception e) { call.reject("Cast init failed: " + e.getMessage()); }
    }

    // ─── Request session ────────────────────────────────────────────
    @PluginMethod
    public void requestSession(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            Log.d(TAG, "requestSession — permissions missing, requesting...");
            requestPermissionForAlias("network", call, "networkPermissionCallback");
            return;
        }
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    if (mediaRouter != null && mediaRouteSelector != null) {
                        updateDeviceAvailability(mediaRouter);
                        androidx.mediarouter.app.MediaRouteChooserDialog dialog =
                            new androidx.mediarouter.app.MediaRouteChooserDialog(getActivity());
                        dialog.setRouteSelector(mediaRouteSelector);
                        dialog.show();
                    } else {
                        call.reject("Cast not initialized");
                        return;
                    }
                    call.resolve();
                } catch (Exception e) { call.reject("requestSession failed: " + e.getMessage()); }
            });
        } catch (Exception e) { call.reject("requestSession failed: " + e.getMessage()); }
    }

    // ─── End session ────────────────────────────────────────────────
    @PluginMethod
    public void endSession(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    if (castContext != null) {
                        CastSession session = castContext.getSessionManager().getCurrentCastSession();
                        if (session != null) castContext.getSessionManager().endCurrentSession(true);
                    }
                    call.resolve();
                } catch (Exception e) { call.reject("endSession failed: " + e.getMessage()); }
            });
        } catch (Exception e) { call.reject("endSession failed: " + e.getMessage()); }
    }

    // ─── Load media ─────────────────────────────────────────────────
    @PluginMethod
    public void loadMedia(PluginCall call) {
        String streamUrl = call.getString("streamUrl", "");
        String title = call.getString("title", "Radio Sphere");
        String logo = call.getString("logo", "");
        String tags = call.getString("tags", "");
        String stationId = call.getString("stationId", "");
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    CastSession session = castContext != null ?
                        castContext.getSessionManager().getCurrentCastSession() : null;
                    if (session == null) { call.reject("No Cast session"); return; }
                    RemoteMediaClient rmc = session.getRemoteMediaClient();
                    if (rmc == null) { call.reject("No remote media client"); return; }
                    MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
                    metadata.putString(MediaMetadata.KEY_TITLE, title);
                    metadata.putString(MediaMetadata.KEY_ARTIST, "Radio Sphere");
                    if (logo != null && !logo.isEmpty()) {
                        metadata.addImage(new WebImage(Uri.parse(logo.replace("http://", "https://"))));
                    }
                    org.json.JSONObject customData = new org.json.JSONObject();
                    try { customData.put("tags", tags); customData.put("stationId", stationId); } catch (Exception e) {}

                    // v2.4.5: Log original URL for diagnostics, keep as-is (no forced HTTPS)
                    // If your Cast App ID supports cleartext, HTTP will work.
                    // If not, try HTTPS variant of the stream URL.
                    Log.d(TAG, "Loading URL to Cast: " + streamUrl);

                    MediaInfo mediaInfo = new MediaInfo.Builder(streamUrl)
                        .setStreamType(MediaInfo.STREAM_TYPE_LIVE)
                        .setContentType("audio/*")
                        .setMetadata(metadata)
                        .setCustomData(customData).build();
                    MediaLoadRequestData loadReq = new MediaLoadRequestData.Builder()
                        .setMediaInfo(mediaInfo).setAutoplay(true).build();
                    rmc.load(loadReq);
                    call.resolve();
                } catch (Exception e) { call.reject("loadMedia failed: " + e.getMessage()); }
            });
        } catch (Exception e) { call.reject("loadMedia failed: " + e.getMessage()); }
    }

    // ─── Toggle play/pause ──────────────────────────────────────────
    @PluginMethod
    public void togglePlayPause(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    CastSession session = castContext != null ?
                        castContext.getSessionManager().getCurrentCastSession() : null;
                    if (session == null) { call.resolve(); return; }
                    RemoteMediaClient client = session.getRemoteMediaClient();
                    if (client == null) { call.resolve(); return; }
                    if (client.isPlaying()) { client.pause(); } else { client.play(); }
                    call.resolve();
                } catch (Exception e) { call.reject("togglePlayPause failed: " + e.getMessage()); }
            });
        } catch (Exception e) { call.reject("togglePlayPause failed: " + e.getMessage()); }
    }

    // ─── Cleanup ────────────────────────────────────────────────────
    @Override
    protected void handleOnDestroy() {
        if (castContext != null) castContext.getSessionManager().removeSessionManagerListener(sessionListener, CastSession.class);
        if (mediaRouter != null) mediaRouter.removeCallback(mediaRouterCallback);
        super.handleOnDestroy();
    }
}
