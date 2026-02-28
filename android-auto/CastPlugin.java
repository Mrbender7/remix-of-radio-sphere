package com.radiosphere.app;

import android.content.Context;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.mediarouter.media.MediaRouteSelector;
import androidx.mediarouter.media.MediaRouter;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
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
 * App ID: 65257ADB
 * Receiver: https://mrbender7.github.io/privacy-policy-radiosphere/receiver.html
 */
@CapacitorPlugin(name = "CastPlugin")
public class CastPlugin extends Plugin {

    private static final String TAG = "CastPlugin";
    private static final String CAST_APP_ID = "65257ADB";

    private CastContext castContext;
    private MediaRouter mediaRouter;
    private MediaRouteSelector mediaRouteSelector;
    private boolean devicesAvailable = false;

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

    private void updateDeviceAvailability(MediaRouter router) {
        boolean hasDevices = false;
        for (MediaRouter.RouteInfo route : router.getRoutes()) {
            if (route.matchesSelector(mediaRouteSelector) && !route.isDefault()) {
                hasDevices = true;
                break;
            }
        }
        if (hasDevices != devicesAvailable) {
            devicesAvailable = hasDevices;
            Log.d(TAG, "Cast devices available: " + devicesAvailable);
            JSObject data = new JSObject();
            data.put("available", devicesAvailable);
            notifyListeners("castDevicesAvailable", data);
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    castContext = CastContext.getSharedInstance(getContext());
                    SessionManager sessionManager = castContext.getSessionManager();
                    sessionManager.addSessionManagerListener(sessionListener, CastSession.class);

                    mediaRouteSelector = new MediaRouteSelector.Builder()
                        .addControlCategory(CastMediaControlIntent.categoryForCast(CAST_APP_ID))
                        .build();

                    mediaRouter = MediaRouter.getInstance(getContext());
                    mediaRouter.addCallback(mediaRouteSelector, mediaRouterCallback,
                        MediaRouter.CALLBACK_FLAG_REQUEST_DISCOVERY);

                    Log.d(TAG, "Cast SDK initialized successfully");

                    JSObject result = new JSObject();
                    result.put("initialized", true);
                    result.put("available", devicesAvailable);
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

    @PluginMethod
    public void requestSession(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    if (castContext != null) {
                        castContext.getSessionManager().startSession(castContext.getSessionManager().getCurrentCastSession() != null ?
                            castContext.getSessionManager().getCurrentCastSession().getCastDevice() : null);
                    }
                    // Also try the route selector dialog approach
                    if (mediaRouter != null) {
                        androidx.mediarouter.app.MediaRouteChooserDialog dialog =
                            new androidx.mediarouter.app.MediaRouteChooserDialog(getActivity());
                        dialog.setRouteSelector(mediaRouteSelector);
                        dialog.show();
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
