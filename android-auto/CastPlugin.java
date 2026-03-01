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
import com.google.android.gms.cast.CastDevice;
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
 * CastPlugin — Capacitor plugin for native Chromecast integration.
 * Uses the Android Cast SDK (play-services-cast-framework) to discover
 * and control Cast devices from within the Capacitor WebView.
 *
 * App ID: CC1AD845 (default test) / 65257ADB (production custom receiver)
 * Receiver: https://mrbender7.github.io/privacy-policy-radiosphere/receiver.html
 */
@CapacitorPlugin(
    name = "CastPlugin",
    permissions = {
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION }
        ),
        @Permission(
            alias = "nearbyWifi",
            strings = { "android.permission.NEARBY_WIFI_DEVICES" }
        )
    }
)
public class CastPlugin extends Plugin {

    private static final String TAG = "CastPlugin";

    // Use CC1AD845 (default receiver) for testing discovery.
    // Switch to "65257ADB" once custom receiver is confirmed working in Cast console.
    private static final String CAST_APP_ID = "CC1AD845";

    private CastContext castContext;
    private MediaRouter mediaRouter;
    private MediaRouteSelector mediaRouteSelector;
    private boolean devicesAvailable = false;
    private PluginCall savedRequestSessionCall = null;

    // ─── Session listener ───────────────────────────────────────────
    private final SessionManagerListener<CastSession> sessionListener = new SessionManagerListener<CastSession>() {
        @Override
        public void onSessionStarting(@NonNull CastSession session) {
            Log.d(TAG, "Cast session starting...");
        }

        @Override
        public void onSessionStarted(@NonNull CastSession session, @NonNull String sessionId) {
            Log.d(TAG, "Cast session started: " + sessionId);
            JSObject data = new JSObject();
            data.put("connected", true);
            data.put("deviceName", session.getCastDevice() != null ? session.getCastDevice().getFriendlyName() : "Chromecast");
            notifyListeners("castStateChanged", data);
        }

        @Override
        public void onSessionStartFailed(@NonNull CastSession session, int error) {
            Log.e(TAG, "Cast session start failed: " + error);
            JSObject data = new JSObject();
            data.put("connected", false);
            data.put("deviceName", "");
            notifyListeners("castStateChanged", data);
        }

        @Override
        public void onSessionEnding(@NonNull CastSession session) {
            Log.d(TAG, "Cast session ending...");
        }

        @Override
        public void onSessionEnded(@NonNull CastSession session, int error) {
            Log.d(TAG, "Cast session ended");
            JSObject data = new JSObject();
            data.put("connected", false);
            data.put("deviceName", "");
            notifyListeners("castStateChanged", data);
        }

        @Override
        public void onSessionResuming(@NonNull CastSession session, @NonNull String sessionId) {}

        @Override
        public void onSessionResumed(@NonNull CastSession session, boolean wasSuspended) {
            Log.d(TAG, "Cast session resumed");
            JSObject data = new JSObject();
            data.put("connected", true);
            data.put("deviceName", session.getCastDevice() != null ? session.getCastDevice().getFriendlyName() : "Chromecast");
            notifyListeners("castStateChanged", data);
        }

        @Override
        public void onSessionResumeFailed(@NonNull CastSession session, int error) {}

        @Override
        public void onSessionSuspended(@NonNull CastSession session, int reason) {}
    };

    // ─── MediaRouter callback ───────────────────────────────────────
    private final MediaRouter.Callback mediaRouterCallback = new MediaRouter.Callback() {
        @Override
        public void onRouteAdded(@NonNull MediaRouter router, @NonNull MediaRouter.RouteInfo route) {
            Log.d(TAG, "Cast route added: " + route.getName());
            updateDeviceAvailability(router);
        }

        @Override
        public void onRouteRemoved(@NonNull MediaRouter router, @NonNull MediaRouter.RouteInfo route) {
            Log.d(TAG, "Cast route removed: " + route.getName());
            updateDeviceAvailability(router);
        }

        @Override
        public void onRouteChanged(@NonNull MediaRouter router, @NonNull MediaRouter.RouteInfo route) {
            updateDeviceAvailability(router);
        }
    };

    // ─── Device availability with diagnostic logging ────────────────
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

        Log.d(TAG, "Cast routes — total: " + totalRoutes + ", matching Cast selector: " + matchingRoutes + ", hasDevices: " + hasDevices);

        if (hasDevices != devicesAvailable) {
            devicesAvailable = hasDevices;
            Log.d(TAG, "Cast devices available changed: " + devicesAvailable);
            JSObject data = new JSObject();
            data.put("available", devicesAvailable);
            notifyListeners("castDevicesAvailable", data);
        }
    }

    // ─── Permission helpers ─────────────────────────────────────────
    private boolean hasDiscoveryPermissions() {
        Context ctx = getContext();
        // Android 13+ requires NEARBY_WIFI_DEVICES
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(ctx, "android.permission.NEARBY_WIFI_DEVICES") != PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Missing permission: NEARBY_WIFI_DEVICES");
                return false;
            }
        }
        // Android 12 and below may need location for local network discovery
        if (Build.VERSION.SDK_INT < 33) {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Missing permission: ACCESS_FINE_LOCATION");
                return false;
            }
        }
        return true;
    }

    @PluginMethod
    public void checkDiscoveryPermissions(PluginCall call) {
        boolean granted = hasDiscoveryPermissions();
        JSObject result = new JSObject();
        result.put("granted", granted);
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

        // Request the right permissions based on API level
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissionForAlias("nearbyWifi", call, "discoveryPermissionCallback");
        } else {
            requestPermissionForAlias("location", call, "discoveryPermissionCallback");
        }
    }

    @PermissionCallback
    private void discoveryPermissionCallback(PluginCall call) {
        boolean granted = hasDiscoveryPermissions();
        Log.d(TAG, "Discovery permission callback — granted: " + granted);

        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);

        // If this was triggered from requestSession, resume it
        if (granted && savedRequestSessionCall != null) {
            PluginCall saved = savedRequestSessionCall;
            savedRequestSessionCall = null;
            openChooserDialog(saved);
        }
    }

    // ─── Initialize ─────────────────────────────────────────────────
    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    Log.d(TAG, "Initializing Cast SDK with App ID: " + CAST_APP_ID);

                    castContext = CastContext.getSharedInstance(getContext());
                    SessionManager sessionManager = castContext.getSessionManager();
                    sessionManager.addSessionManagerListener(sessionListener, CastSession.class);

                    mediaRouteSelector = new MediaRouteSelector.Builder()
                        .addControlCategory(CastMediaControlIntent.categoryForCast(CAST_APP_ID))
                        .build();

                    mediaRouter = MediaRouter.getInstance(getContext());
                    mediaRouter.addCallback(mediaRouteSelector, mediaRouterCallback,
                        MediaRouter.CALLBACK_FLAG_REQUEST_DISCOVERY | MediaRouter.CALLBACK_FLAG_PERFORM_ACTIVE_SCAN);

                    // Immediate route check for diagnostic
                    updateDeviceAvailability(mediaRouter);

                    boolean permsGranted = hasDiscoveryPermissions();
                    Log.d(TAG, "Cast SDK initialized — permsGranted: " + permsGranted + ", apiLevel: " + Build.VERSION.SDK_INT);

                    JSObject result = new JSObject();
                    result.put("initialized", true);
                    result.put("available", devicesAvailable);
                    result.put("permissionsGranted", permsGranted);
                    result.put("appId", CAST_APP_ID);
                    call.resolve(result);
                } catch (Exception e) {
                    Log.e(TAG, "Cast init error on UI thread", e);
                    call.reject("Cast init failed: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Cast initialize error", e);
            call.reject("Cast init failed: " + e.getMessage());
        }
    }

    // ─── Request session (with permission check) ────────────────────
    @PluginMethod
    public void requestSession(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            Log.d(TAG, "requestSession — permissions missing, requesting...");
            savedRequestSessionCall = call;
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissionForAlias("nearbyWifi", call, "discoveryPermissionCallback");
            } else {
                requestPermissionForAlias("location", call, "discoveryPermissionCallback");
            }
            return;
        }

        openChooserDialog(call);
    }

    private void openChooserDialog(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    if (mediaRouter != null && mediaRouteSelector != null) {
                        // Refresh route scan before showing dialog
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
                } catch (Exception e) {
                    Log.e(TAG, "requestSession error", e);
                    call.reject("requestSession failed: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            call.reject("requestSession failed: " + e.getMessage());
        }
    }

    // ─── End session ────────────────────────────────────────────────
    @PluginMethod
    public void endSession(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    if (castContext != null) {
                        CastSession session = castContext.getSessionManager().getCurrentCastSession();
                        if (session != null) {
                            castContext.getSessionManager().endCurrentSession(true);
                        }
                    }
                    call.resolve();
                } catch (Exception e) {
                    call.reject("endSession failed: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            call.reject("endSession failed: " + e.getMessage());
        }
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
                    if (session == null) {
                        call.reject("No active Cast session");
                        return;
                    }

                    RemoteMediaClient remoteMediaClient = session.getRemoteMediaClient();
                    if (remoteMediaClient == null) {
                        call.reject("No remote media client");
                        return;
                    }

                    MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
                    metadata.putString(MediaMetadata.KEY_TITLE, title);
                    metadata.putString(MediaMetadata.KEY_ARTIST, "Radio Sphere");

                    if (logo != null && !logo.isEmpty()) {
                        String safeLogoUrl = logo.replace("http://", "https://");
                        metadata.addImage(new WebImage(Uri.parse(safeLogoUrl)));
                    }

                    org.json.JSONObject customData = new org.json.JSONObject();
                    try {
                        customData.put("tags", tags != null ? tags.split(",") : new String[]{});
                        customData.put("stationId", stationId);
                    } catch (Exception e) { /* ignore */ }

                    MediaInfo mediaInfo = new MediaInfo.Builder(streamUrl)
                        .setStreamType(MediaInfo.STREAM_TYPE_LIVE)
                        .setContentType("audio/mpeg")
                        .setMetadata(metadata)
                        .setCustomData(customData)
                        .build();

                    MediaLoadRequestData loadRequest = new MediaLoadRequestData.Builder()
                        .setMediaInfo(mediaInfo)
                        .setAutoplay(true)
                        .build();

                    remoteMediaClient.load(loadRequest);
                    Log.d(TAG, "Cast media loaded: " + title);
                    call.resolve();
                } catch (Exception e) {
                    Log.e(TAG, "loadMedia error", e);
                    call.reject("loadMedia failed: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            call.reject("loadMedia failed: " + e.getMessage());
        }
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

                    if (client.isPlaying()) {
                        client.pause();
                    } else {
                        client.play();
                    }
                    call.resolve();
                } catch (Exception e) {
                    call.reject("togglePlayPause failed: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            call.reject("togglePlayPause failed: " + e.getMessage());
        }
    }

    // ─── Cleanup ────────────────────────────────────────────────────
    @Override
    protected void handleOnDestroy() {
        if (castContext != null) {
            castContext.getSessionManager().removeSessionManagerListener(sessionListener, CastSession.class);
        }
        if (mediaRouter != null) {
            mediaRouter.removeCallback(mediaRouterCallback);
        }
        super.handleOnDestroy();
    }
}
