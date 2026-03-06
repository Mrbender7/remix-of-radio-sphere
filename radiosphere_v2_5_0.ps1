# radiosphere_v2_5_0.ps1
# v2.5.1 -- Fixes: ICY metadata stripping, real seek-back with blob swap, onValueCommit slider,
#            watchdog bypass for blob: playback, unified export via Cache+Share, storage permission removed
$RepoUrl = "https://github.com/Mrbender7/remix-of-radio-sphere"
$ProjectFolder = "remix-of-radio-sphere"
$UTF8NoBOM = New-Object System.Text.UTF8Encoding($False)

Write-Host ">>> Lancement du Master Fix v2.5.0 - Magnetophone + Permissions + Guide" -ForegroundColor Cyan

if (Test-Path $ProjectFolder) { Remove-Item -Recurse -Force $ProjectFolder }
git clone $RepoUrl
cd $ProjectFolder
[System.Environment]::CurrentDirectory = (Get-Location).Path

# ===================================================================
# 1. Config Capacitor
# ===================================================================
Write-Host ">>> Configuration Capacitor..." -ForegroundColor Yellow
$ConfigJSON = @"
{
  "appId": "com.fhm.radiosphere",
  "appName": "Radio Sphere",
  "webDir": "dist",
  "server": { "androidScheme": "https", "allowNavigation": ["*"] }
}
"@
[System.IO.File]::WriteAllText((Join-Path (Get-Location).Path "capacitor.config.json"), $ConfigJSON, $UTF8NoBOM)

# ===================================================================
# 2. Installation et Build
# ===================================================================
Write-Host ">>> Installation des dependances et build..." -ForegroundColor Yellow
npm install --legacy-peer-deps
npm install @capacitor/core @capacitor/cli @capawesome-team/capacitor-android-foreground-service @capacitor/app @capacitor/local-notifications @capacitor/filesystem @capacitor/share
npm run build
npm install @capacitor/android
npx cap add android

# ===================================================================
# 3. Generation des icones de notification
# ===================================================================
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

# Copy station_placeholder.jpg for default artwork
$PlaceholderSrc = "android-auto/res/drawable/station_placeholder.jpg"
if (Test-Path $PlaceholderSrc) {
    Copy-Item $PlaceholderSrc "$DrawablePath/station_placeholder.jpg" -Force
    Write-Host "    station_placeholder.jpg copie dans drawable/" -ForegroundColor Green
} else {
    Write-Host "    ATTENTION: station_placeholder.jpg introuvable dans android-auto/res/drawable/" -ForegroundColor Red
}

# ===================================================================
# 3b. Generation automotive_app_desc.xml
# ===================================================================
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

# ===================================================================
# 3c. Generation network_security_config.xml
# ===================================================================
Write-Host ">>> Generation network_security_config.xml..." -ForegroundColor Yellow
$NetSecContent = @'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
'@
[System.IO.File]::WriteAllText((Join-Path (Get-Location).Path "$XmlDir/network_security_config.xml"), $NetSecContent, $UTF8NoBOM)
Write-Host "    network_security_config.xml genere avec succes" -ForegroundColor Green

# ===================================================================
# 4. MANIFEST -- Permissions + Services + Android Auto + Cast + MediaPlayback
# ===================================================================
$ManifestPath = "android/app/src/main/AndroidManifest.xml"
if (Test-Path $ManifestPath) {
    Write-Host ">>> Manifest: Injection complete (Permissions, Services, Android Auto, Cast, MediaPlayback)..." -ForegroundColor Yellow
    $ManifestContent = Get-Content $ManifestPath -Raw
    
    # Permissions
    # --- Simple permissions (name-only) ---
    $PermsList = @(
        "android.permission.INTERNET",
        "android.permission.WAKE_LOCK",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.ACCESS_WIFI_STATE",
        "android.permission.CHANGE_WIFI_MULTICAST_STATE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION"
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

    # --- Special permission: NEARBY_WIFI_DEVICES (Android 13+, requires usesPermissionFlags) ---
    if ($ManifestContent -notmatch 'NEARBY_WIFI_DEVICES') {
        $PermsToAdd += '    <uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" android:usesPermissionFlags="neverForLocation" />' + "`n"
        Write-Host "    + Permission: NEARBY_WIFI_DEVICES (Android 13+, neverForLocation)" -ForegroundColor DarkGray
    } else {
        Write-Host "    = Permission deja presente: NEARBY_WIFI_DEVICES" -ForegroundColor DarkGray
    }
    if ($PermsToAdd.Length -gt 0) {
        $ManifestContent = $ManifestContent -replace '(<manifest[^>]*>)', "`$1`n$PermsToAdd"
    }
    
    # usesCleartextTraffic
    if ($ManifestContent -notmatch 'usesCleartextTraffic') {
        $ManifestContent = $ManifestContent -replace '<application', '<application android:usesCleartextTraffic="true"'
    }

    # appCategory="audio" for media app detection
    if ($ManifestContent -notmatch 'android:appCategory') {
        $ManifestContent = $ManifestContent -replace '<application', '<application android:appCategory="audio"'
    }

    # Disable auto backup (clean uninstall = full data wipe)
    $ManifestContent = [regex]::Replace($ManifestContent, 'android:allowBackup="[^"]*"', 'android:allowBackup="false"')
    if ($ManifestContent -notmatch 'android:allowBackup=') {
        $ManifestContent = $ManifestContent -replace '<application', '<application android:allowBackup="false"'
    }

    $ManifestContent = [regex]::Replace($ManifestContent, 'android:fullBackupContent="[^"]*"', 'android:fullBackupContent="false"')
    if ($ManifestContent -notmatch 'android:fullBackupContent=') {
        $ManifestContent = $ManifestContent -replace '<application', '<application android:fullBackupContent="false"'
    }

    # networkSecurityConfig
    if ($ManifestContent -notmatch 'networkSecurityConfig') {
        $ManifestContent = $ManifestContent -replace '<application', '<application android:networkSecurityConfig="@xml/network_security_config"'
    }
    
    # Services + Cast OptionsProvider
    $ServiceDecl = @"
    <receiver android:name="io.capawesome.capacitorjs.plugins.foregroundservice.NotificationActionBroadcastReceiver" />
    <service android:name="io.capawesome.capacitorjs.plugins.foregroundservice.AndroidForegroundService" android:foregroundServiceType="mediaPlayback" />

    <!-- Android Auto + Unified Media Service -->
    <meta-data
        android:name="com.google.android.gms.car.application"
        android:resource="@xml/automotive_app_desc" />
    <service
        android:name=".RadioBrowserService"
        android:exported="true"
        android:enabled="true"
        android:foregroundServiceType="mediaPlayback"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher">
        <intent-filter>
            <action android:name="android.media.browse.MediaBrowserService" />
        </intent-filter>
    </service>

    <!-- Android Auto notification icon -->
    <meta-data
        android:name="com.google.android.gms.car.notification.SmallIcon"
        android:resource="@drawable/ic_notification" />

    <!-- Chromecast CastOptionsProvider -->
    <meta-data
        android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
        android:value="__ACTUAL_PACKAGE__.CastOptionsProvider" />

    <!-- Broadcast receiver for notification toggle (unified) -->
    <receiver
        android:name=".MediaToggleReceiver"
        android:exported="false">
        <intent-filter>
            <action android:name="com.fhm.radiosphere.TOGGLE_PLAYBACK" />
        </intent-filter>
    </receiver>
"@
    $ManifestContent = $ManifestContent -replace '(<application[^>]*>)', "`$1`n$ServiceDecl"
    
    [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $ManifestPath), $ManifestContent, $UTF8NoBOM)
}

# ===================================================================
# 5. Gradle -- ExoPlayer + Media Compat + Cast Framework + MediaRouter
# ===================================================================
$GradleAppPath = "android/app/build.gradle"
if (Test-Path $GradleAppPath) {
    Write-Host ">>> Gradle: ExoPlayer + Media Compat + Cast Framework + MediaRouter..." -ForegroundColor Yellow
    $GradleContent = Get-Content $GradleAppPath -Raw
    $DepsBlock = @"
dependencies {
    // ExoPlayer for Android Auto native audio playback
    implementation 'com.google.android.exoplayer:exoplayer-core:2.19.1'
    implementation 'com.google.android.exoplayer:exoplayer-ui:2.19.1'
    // Media Compat for MediaBrowserService, MediaSession & MediaStyle notification
    implementation 'androidx.media:media:1.7.0'
    // v2.4.0: Chromecast native SDK + MediaRouter for device discovery
    implementation 'com.google.android.gms:play-services-cast-framework:21.4.0'
    implementation 'androidx.mediarouter:mediarouter:1.7.0'
"@
    $GradleContent = $GradleContent -replace 'dependencies \{', $DepsBlock
    [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $GradleAppPath), $GradleContent, $UTF8NoBOM)
}

# ===================================================================
# 6. Generation des fichiers natifs (JAVA)
# ===================================================================
Write-Host ">>> Generation des fichiers natifs (Java)..." -ForegroundColor Yellow

$JavaSrcBase = "android/app/src/main/java"
$PackageDir = "$JavaSrcBase/com/fhm/radiosphere"
if (!(Test-Path $PackageDir)) {
    $MainActFile = Get-ChildItem -Path $JavaSrcBase -Filter "MainActivity.*" -Recurse | Select-Object -First 1
    if ($MainActFile) {
        $PackageDir = $MainActFile.DirectoryName
        Write-Host "    Package directory found: $PackageDir" -ForegroundColor DarkGray
    } else {
        $PackageDir = "$JavaSrcBase/com/fhm/radiosphere"
        New-Item -ItemType Directory -Path $PackageDir -Force | Out-Null
    }
}

$ActualPackage = "com.fhm.radiosphere"
$MainActSearch = Get-ChildItem -Path $JavaSrcBase -Filter "MainActivity.*" -Recurse | Select-Object -First 1
if ($MainActSearch) {
    $MainContent = Get-Content $MainActSearch.FullName -Raw
    if ($MainContent -match 'package\s+([\w.]+)') {
        $ActualPackage = $Matches[1]
        Write-Host "    Package detecte: $ActualPackage" -ForegroundColor DarkGray
    }
}

# Fix Manifest placeholder for CastOptionsProvider package
if (Test-Path $ManifestPath) {
    $ManifestContent = Get-Content $ManifestPath -Raw
    $ManifestContent = $ManifestContent -replace '__ACTUAL_PACKAGE__', $ActualPackage
    [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $ManifestPath), $ManifestContent, $UTF8NoBOM)
    Write-Host "    Manifest: CastOptionsProvider package set to $ActualPackage" -ForegroundColor DarkGray
}

# --- RadioAutoPlugin.java (v2.5.1 -- unified, points to RadioBrowserService) ---
Write-Host "    Generation RadioAutoPlugin.java (v2.5.1)..." -ForegroundColor DarkGray
$RadioAutoPluginJava = @'
package __PACKAGE__;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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

    @PluginMethod
    public void syncFavorites(PluginCall call) {
        String stations = call.getString("stations", "[]");
        getPrefs().edit().putString(KEY_FAVORITES, stations).apply();
        RadioBrowserService.updateFavorites(stations);
        call.resolve();
    }

    @PluginMethod
    public void syncRecents(PluginCall call) {
        String stations = call.getString("stations", "[]");
        getPrefs().edit().putString(KEY_RECENTS, stations).apply();
        RadioBrowserService.updateRecents(stations);
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
                ctx.stopService(new Intent(ctx, RadioBrowserService.class));
            } catch (Exception e) {
                // Service not running, ignore
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

        Context ctx = getContext();
        Intent serviceIntent = new Intent(ctx, RadioBrowserService.class);
        serviceIntent.setAction(RadioBrowserService.ACTION_UPDATE);
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
            try {
                ctx.startService(serviceIntent);
            } catch (Exception e) {
                // Service not running, ignore
            }
        }

        call.resolve();
    }

    public void notifyToggleFromNotification() {
        notifyListeners("mediaToggle", new com.getcapacitor.JSObject());
    }
}
'@
$RadioAutoPluginJava = $RadioAutoPluginJava -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "RadioAutoPlugin.java"), $RadioAutoPluginJava, $UTF8NoBOM)
Write-Host "    RadioAutoPlugin.java genere avec succes" -ForegroundColor Green

# (MediaPlaybackService.java removed in v2.5.1 — unified into RadioBrowserService)


# --- MediaToggleReceiver.java (v2.2.9) ---
Write-Host "    Generation MediaToggleReceiver.java..." -ForegroundColor DarkGray
$MediaToggleReceiverJava = @'
package __PACKAGE__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class MediaToggleReceiver extends BroadcastReceiver {
    private static final String TAG = "MediaToggleReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "TOGGLE_PLAYBACK broadcast received");
        RadioAutoPlugin plugin = RadioAutoPlugin.getActiveInstance();
        if (plugin != null) {
            plugin.notifyToggleFromNotification();
        }
    }
}
'@
$MediaToggleReceiverJava = $MediaToggleReceiverJava -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "MediaToggleReceiver.java"), $MediaToggleReceiverJava, $UTF8NoBOM)
Write-Host "    MediaToggleReceiver.java genere avec succes" -ForegroundColor Green

# --- CastPlugin.java (v2.4.6 -- exact user-provided code) ---
Write-Host "    Generation CastPlugin.java (v2.4.6 -- user-provided)..." -ForegroundColor DarkGray
$CastPluginJava = @'
package __PACKAGE__;

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

@CapacitorPlugin(name = "CastPlugin", permissions = { @Permission(alias = "network", strings = { "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION", "android.permission.NEARBY_WIFI_DEVICES" }) })
public class CastPlugin extends Plugin {
    private static final String TAG = "CastPlugin";
    private static final String CAST_APP_ID = CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID;
    private CastContext castContext;
    private MediaRouter mediaRouter;
    private MediaRouteSelector mediaRouteSelector;
    private boolean devicesAvailable = false;
    private PluginCall savedInitCall = null;
    private final SessionManagerListener<CastSession> sessionListener = new SessionManagerListener<CastSession>() {
        @Override public void onSessionStarting(@NonNull CastSession s) {}
        @Override public void onSessionStarted(@NonNull CastSession session, @NonNull String id) {
            JSObject data = new JSObject(); data.put("connected", true);
            data.put("deviceName", session.getCastDevice() != null ? session.getCastDevice().getFriendlyName() : "Chromecast");
            notifyListeners("castStateChanged", data);
            JSObject p = new JSObject(); p.put("action", "pauseLocal"); notifyListeners("localAudioControl", p);
        }
        @Override public void onSessionStartFailed(@NonNull CastSession s, int e) { Log.e(TAG, "Session start failed, code=" + e + ", appId=" + CAST_APP_ID); JSObject d = new JSObject(); d.put("connected", false); d.put("errorCode", e); d.put("reason", "session_start_failed"); notifyListeners("castStateChanged", d); }
        @Override public void onSessionEnding(@NonNull CastSession s) {}
        @Override public void onSessionEnded(@NonNull CastSession s, int e) {
            JSObject d = new JSObject(); d.put("connected", false); notifyListeners("castStateChanged", d);
            JSObject r = new JSObject(); r.put("action", "resumeLocal"); notifyListeners("localAudioControl", r);
        }
        @Override public void onSessionResuming(@NonNull CastSession s, @NonNull String id) {}
        @Override public void onSessionResumed(@NonNull CastSession s, boolean w) {
            JSObject d = new JSObject(); d.put("connected", true); d.put("deviceName", s.getCastDevice() != null ? s.getCastDevice().getFriendlyName() : "Chromecast");
            notifyListeners("castStateChanged", d);
        }
        @Override public void onSessionResumeFailed(@NonNull CastSession s, int e) {}
        @Override public void onSessionSuspended(@NonNull CastSession s, int r) {}
    };
    private final MediaRouter.Callback mediaRouterCallback = new MediaRouter.Callback() {
        @Override public void onRouteAdded(@NonNull MediaRouter r, @NonNull MediaRouter.RouteInfo o) { updateDeviceAvailability(r); }
        @Override public void onRouteRemoved(@NonNull MediaRouter r, @NonNull MediaRouter.RouteInfo o) { updateDeviceAvailability(r); }
        @Override public void onRouteChanged(@NonNull MediaRouter r, @NonNull MediaRouter.RouteInfo o) { updateDeviceAvailability(r); }
    };
    private void updateDeviceAvailability(MediaRouter router) {
        boolean has = false; for (MediaRouter.RouteInfo r : router.getRoutes()) { if (r.matchesSelector(mediaRouteSelector) && !r.isDefault()) { has = true; break; } }
        if (has != devicesAvailable) { devicesAvailable = has; JSObject d = new JSObject(); d.put("available", has); notifyListeners("castDevicesAvailable", d); }
    }
    private boolean hasPerms() { Context c = getContext(); if (Build.VERSION.SDK_INT >= 33) { boolean nearby = ContextCompat.checkSelfPermission(c, "android.permission.NEARBY_WIFI_DEVICES") == PackageManager.PERMISSION_GRANTED; boolean fine = ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED; return nearby && fine; }
        return ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED; }
    @PluginMethod public void checkDiscoveryPermissions(PluginCall call) { JSObject r = new JSObject(); r.put("granted", hasPerms()); call.resolve(r); }
    @PluginMethod public void requestDiscoveryPermissions(PluginCall call) { if (hasPerms()) { JSObject r = new JSObject(); r.put("granted", true); call.resolve(r); return; } requestPermissionForAlias("network", call, "networkPermissionCallback"); }
    @PermissionCallback private void networkPermissionCallback(PluginCall call) { boolean g = hasPerms(); JSObject r = new JSObject(); r.put("granted", g); call.resolve(r); if (g && savedInitCall != null) { PluginCall s = savedInitCall; savedInitCall = null; doInitialize(s); } }
    @PluginMethod public void initialize(PluginCall call) { if (!hasPerms()) { savedInitCall = call; requestPermissionForAlias("network", call, "networkPermissionCallback"); return; } doInitialize(call); }
    private void doInitialize(PluginCall call) { try { getActivity().runOnUiThread(() -> { try { castContext = CastContext.getSharedInstance(getContext()); Log.d(TAG, "CastContext status: " + (castContext != null)); castContext.getSessionManager().addSessionManagerListener(sessionListener, CastSession.class);
        mediaRouteSelector = new MediaRouteSelector.Builder().addControlCategory(CastMediaControlIntent.categoryForCast(CAST_APP_ID)).build();
        mediaRouter = MediaRouter.getInstance(getContext()); mediaRouter.addCallback(mediaRouteSelector, mediaRouterCallback, MediaRouter.CALLBACK_FLAG_REQUEST_DISCOVERY | MediaRouter.CALLBACK_FLAG_PERFORM_ACTIVE_SCAN);
        updateDeviceAvailability(mediaRouter); JSObject res = new JSObject(); res.put("initialized", true); res.put("available", devicesAvailable); call.resolve(res);
        } catch (Exception e) { call.reject(e.getMessage()); } }); } catch (Exception e) { call.reject(e.getMessage()); } }
    @PluginMethod public void requestSession(PluginCall call) { if (!hasPerms()) { requestPermissionForAlias("network", call, "networkPermissionCallback"); return; }
        try { getActivity().runOnUiThread(() -> { try { if (mediaRouter != null) { androidx.mediarouter.app.MediaRouteChooserDialog d = new androidx.mediarouter.app.MediaRouteChooserDialog(getActivity()); d.setRouteSelector(mediaRouteSelector); d.show(); call.resolve(); } else { call.reject("Not init"); } } catch (Exception e) { call.reject(e.getMessage()); } }); } catch (Exception e) { call.reject(e.getMessage()); } }
    @PluginMethod public void endSession(PluginCall call) { try { getActivity().runOnUiThread(() -> { try { if (castContext != null) { CastSession s = castContext.getSessionManager().getCurrentCastSession(); if (s != null) castContext.getSessionManager().endCurrentSession(true); } call.resolve(); } catch (Exception e) { call.reject(e.getMessage()); } }); } catch (Exception e) { call.reject(e.getMessage()); } }
    @PluginMethod public void loadMedia(PluginCall call) { String u = call.getString("streamUrl", ""); String t = call.getString("title", "Radio Sphere"); String l = call.getString("logo", "");
        Log.d(TAG, "Loading URL to Cast: " + u);
        try { getActivity().runOnUiThread(() -> { try { CastSession s = castContext != null ? castContext.getSessionManager().getCurrentCastSession() : null; if (s == null) { call.reject("No session"); return; }
        RemoteMediaClient r = s.getRemoteMediaClient(); if (r == null) { call.reject("No client"); return; }
        MediaMetadata m = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK); m.putString(MediaMetadata.KEY_TITLE, t); m.putString(MediaMetadata.KEY_ARTIST, "Radio Sphere"); if (!l.isEmpty()) m.addImage(new WebImage(Uri.parse(l.replace("http://", "https://"))));
        MediaInfo info = new MediaInfo.Builder(u).setStreamType(MediaInfo.STREAM_TYPE_LIVE).setContentType("audio/*").setMetadata(m).build();
        r.load(new MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).build()); call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); } }); } catch (Exception e) { call.reject(e.getMessage()); } }
    @PluginMethod public void togglePlayPause(PluginCall call) { try { getActivity().runOnUiThread(() -> { try { CastSession s = castContext != null ? castContext.getSessionManager().getCurrentCastSession() : null; if (s != null && s.getRemoteMediaClient() != null) { RemoteMediaClient c = s.getRemoteMediaClient(); if (c.isPlaying()) c.pause(); else c.play(); } call.resolve(); } catch (Exception e) { call.reject(e.getMessage()); } }); } catch (Exception e) { call.reject(e.getMessage()); } }
    @Override protected void handleOnDestroy() { if (castContext != null) castContext.getSessionManager().removeSessionManagerListener(sessionListener, CastSession.class); if (mediaRouter != null) mediaRouter.removeCallback(mediaRouterCallback); super.handleOnDestroy(); }
}
'@
$CastPluginJava = $CastPluginJava -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "CastPlugin.java"), $CastPluginJava, $UTF8NoBOM)
Write-Host "    CastPlugin.java genere avec succes (v2.4.7)" -ForegroundColor Green

# --- CastOptionsProvider.java (v2.4.7 -- DEFAULT_MEDIA_RECEIVER) ---
Write-Host "    Generation CastOptionsProvider.java (v2.4.7)..." -ForegroundColor DarkGray
$CastOptionsProviderJava = @'
package __PACKAGE__;

import android.content.Context;
import com.google.android.gms.cast.CastMediaControlIntent;
import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.framework.OptionsProvider;
import com.google.android.gms.cast.framework.SessionProvider;
import java.util.List;

public class CastOptionsProvider implements OptionsProvider {

    @Override
    public CastOptions getCastOptions(Context context) {
        return new CastOptions.Builder()
            .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
            .build();
    }

    @Override
    public List<SessionProvider> getAdditionalSessionProviders(Context context) {
        return null;
    }
}
'@
$CastOptionsProviderJava = $CastOptionsProviderJava -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "CastOptionsProvider.java"), $CastOptionsProviderJava, $UTF8NoBOM)
Write-Host "    CastOptionsProvider.java genere avec succes (v2.4.7)" -ForegroundColor Green

# --- RadioBrowserService.java (v2.5.2 -- unified service + favorites fix + onPlayFromMediaId fallback) ---
Write-Host "    Generation RadioBrowserService.java (v2.5.2)..." -ForegroundColor DarkGray
$RadioBrowserServiceJava = @'
package __PACKAGE__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import androidx.core.app.NotificationCompat;
import androidx.media.MediaBrowserServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.PlaybackException;
import com.google.android.exoplayer2.Player;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

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
    private static final int STREAM_BUFFER_TIMEOUT_MS = 8000;
    private static final int RESOLVE_TIMEOUT_MS = 8000;
    private static final int NETWORK_TIMEOUT_MS = 5000;

    private static final String AUTO_CHANNEL_ID = "radio_auto_playback";
    private static final int AUTO_NOTIFICATION_ID = 3001;
    private boolean foregroundStarted = false;

    // Mirror mode constants (replaces MediaPlaybackService)
    public static final String ACTION_UPDATE = "com.fhm.radiosphere.ACTION_UPDATE_MEDIA";
    public static final String ACTION_STOP = "com.fhm.radiosphere.ACTION_STOP_MEDIA";
    public static final String BROADCAST_TOGGLE = "com.fhm.radiosphere.TOGGLE_PLAYBACK";

    private Bitmap cachedMirrorArtwork;
    private String cachedMirrorLogoUrl = "";

    // Static instance for live favorites/recents refresh
    private static RadioBrowserService activeInstance;

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
    private final ExecutorService streamResolverExecutor = Executors.newSingleThreadExecutor();
    private final AtomicInteger playbackRequestSeq = new AtomicInteger(0);

    private static class StationData {
        final String id, name, streamUrl, logo, country, tags;
        StationData(String id, String name, String streamUrl, String logo, String country, String tags) {
            this.id = id; this.name = name; this.streamUrl = streamUrl;
            this.logo = logo; this.country = country; this.tags = tags;
        }
    }

    // Static methods for live browse tree refresh from Capacitor plugin
    public static void updateFavorites(String json) {
        Log.d(TAG, "updateFavorites called, instance=" + (activeInstance != null));
        if (activeInstance != null) activeInstance.notifyChildrenChanged(FAVORITES_ID);
    }
    public static void updateRecents(String json) {
        Log.d(TAG, "updateRecents called, instance=" + (activeInstance != null));
        if (activeInstance != null) activeInstance.notifyChildrenChanged(RECENTS_ID);
    }

    private final AudioManager.OnAudioFocusChangeListener audioFocusChangeListener = focusChange -> {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                player.pause();
                updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                player.setVolume(1.0f); player.play();
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
                .setWillPauseWhenDucked(false).build();
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

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                AUTO_CHANNEL_ID, "Radio Sphere Playback", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.setDescription("Notification pour la lecture Radio Sphere");
            channel.enableVibration(false);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void startAsForeground(String stationName, boolean isPlaying) {
        Notification notification = buildUnifiedNotification(stationName, isPlaying, null);
        if (!foregroundStarted) {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(AUTO_NOTIFICATION_ID, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(AUTO_NOTIFICATION_ID, notification);
            }
            foregroundStarted = true;
            Log.d(TAG, "Started foreground service for playback");
        } else {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(AUTO_NOTIFICATION_ID, notification);
        }
    }

    private Notification buildUnifiedNotification(String stationName, boolean isPlaying, Bitmap artwork) {
        Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0,
            openIntent != null ? openIntent : new Intent(),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent toggleIntent = new Intent(BROADCAST_TOGGLE);
        toggleIntent.setPackage(getPackageName());
        PendingIntent togglePendingIntent = PendingIntent.getBroadcast(this, 0,
            toggleIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int toggleIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String toggleLabel = isPlaying ? "Pause" : "Play";
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, AUTO_CHANNEL_ID)
            .setContentTitle(stationName != null ? stationName : "Radio Sphere")
            .setContentText("Radio Sphere").setSubText("Live")
            .setSmallIcon(getApplicationInfo().icon).setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setOngoing(isPlaying).setShowWhen(false)
            .addAction(toggleIcon, toggleLabel, togglePendingIntent)
            .setStyle(new MediaStyle().setMediaSession(mediaSession.getSessionToken()).setShowActionsInCompactView(0));
        if (artwork != null) {
            builder.setLargeIcon(artwork);
        } else {
            Bitmap fallback = BitmapFactory.decodeResource(getResources(), R.drawable.station_placeholder);
            if (fallback != null) builder.setLargeIcon(fallback);
        }
        return builder.build();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        activeInstance = this;
        createNotificationChannel();
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

    // --- Mirror Mode: onStartCommand (replaces MediaPlaybackService) ---

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            if (foregroundStarted) { stopForeground(true); foregroundStarted = false; }
            return START_NOT_STICKY;
        }
        if (ACTION_UPDATE.equals(action)) {
            String name = intent.getStringExtra("station_name");
            String logo = intent.getStringExtra("station_logo");
            boolean isPlaying = intent.getBooleanExtra("is_playing", false);
            if (name == null) name = "Radio Sphere";
            if (logo == null) logo = "";
            final String finalLogo = logo;
            final String finalName = name;
            final boolean finalIsPlaying = isPlaying;
            if (!logo.isEmpty() && !logo.equals(cachedMirrorLogoUrl)) {
                cachedMirrorLogoUrl = logo;
                new Thread(() -> {
                    cachedMirrorArtwork = downloadBitmap(finalLogo);
                    updateMirrorNotification(finalName, finalIsPlaying, cachedMirrorArtwork);
                }).start();
            } else if (logo.isEmpty()) {
                cachedMirrorLogoUrl = "";
                cachedMirrorArtwork = null;
            }
            updateMirrorNotification(name, isPlaying, cachedMirrorArtwork);
        }
        return START_NOT_STICKY;
    }

    private void updateMirrorNotification(String name, boolean isPlaying, Bitmap artwork) {
        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, name)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Radio Sphere")
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Live")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1);
        if (artwork != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artwork);
        } else {
            Bitmap fallback = BitmapFactory.decodeResource(getResources(), R.drawable.station_placeholder);
            if (fallback != null) {
                metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, fallback);
                metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, fallback);
            }
        }
        mediaSession.setMetadata(metaBuilder.build());
        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_STOP | PlaybackStateCompat.ACTION_PLAY_PAUSE;
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions).setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f).build());
        Notification notification = buildUnifiedNotification(name, isPlaying, artwork);
        if (!foregroundStarted) {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(AUTO_NOTIFICATION_ID, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(AUTO_NOTIFICATION_ID, notification);
            }
            foregroundStarted = true;
        } else {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(AUTO_NOTIFICATION_ID, notification);
        }
    }

    @Nullable
    private Bitmap downloadBitmap(String urlStr) {
        try {
            String safeUrl = urlStr.replace("http://", "https://");
            HttpURLConnection conn = (HttpURLConnection) new URL(safeUrl).openConnection();
            conn.setConnectTimeout(5000); conn.setReadTimeout(5000);
            InputStream in = conn.getInputStream();
            Bitmap bmp = BitmapFactory.decodeStream(in);
            in.close(); conn.disconnect();
            return bmp;
        } catch (Exception e) { return null; }
    }

    @Override
    public void onDestroy() {
        activeInstance = null;
        cancelBufferingTimeout();
        playbackRequestSeq.incrementAndGet();
        streamResolverExecutor.shutdownNow();
        handler.removeCallbacksAndMessages(null);
        abandonAudioFocus();
        if (foregroundStarted) { stopForeground(true); foregroundStarted = false; }
        player.release();
        mediaSession.release();
        super.onDestroy();
    }

    @Nullable @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName, int clientUid, @Nullable Bundle rootHints) {
        return new BrowserRoot(ROOT_ID, null);
    }

    @Override
    public void onLoadChildren(@NonNull String parentId, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        switch (parentId) {
            case ROOT_ID: {
                List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
                items.add(buildBrowsableItem(TOP_STATIONS_ID, "Top Stations", "Les stations les plus populaires"));
                items.add(buildBrowsableItem(FAVORITES_ID, "Mes Favoris", "Vos stations pr\u00e9f\u00e9r\u00e9es"));
                items.add(buildBrowsableItem(RECENTS_ID, "R\u00e9cents", "Derni\u00e8res stations \u00e9cout\u00e9es"));
                result.sendResult(items);
                break;
            }
            case FAVORITES_ID: {
                List<StationData> stations = loadStations(KEY_FAVORITES);
                stations.sort((a, b) -> a.name.compareToIgnoreCase(b.name));
                currentStations = stations;
                if (stations.isEmpty()) {
                    List<MediaBrowserCompat.MediaItem> empty = new ArrayList<>();
                    empty.add(buildInfoItem("Aucun favori", "Ajoutez des favoris depuis l'app"));
                    result.sendResult(empty);
                } else { result.sendResult(toMediaItems(stations)); }
                break;
            }
            case RECENTS_ID: {
                List<StationData> stations = loadStations(KEY_RECENTS);
                currentStations = stations;
                if (stations.isEmpty()) {
                    List<MediaBrowserCompat.MediaItem> empty = new ArrayList<>();
                    empty.add(buildInfoItem("Aucune station recente", "Ecoutez une station pour la voir ici"));
                    result.sendResult(empty);
                } else { result.sendResult(toMediaItems(stations)); }
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

    @Override
    public void onSearch(@NonNull String query, Bundle extras, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        result.detach();
        new Thread(() -> {
            List<StationData> stations = searchStations(query, 25);
            currentStations = stations;
            result.sendResult(toMediaItems(stations));
        }).start();
    }

    private final MediaSessionCompat.Callback mediaSessionCallback = new MediaSessionCompat.Callback() {
        @Override public void onPlayFromMediaId(String mediaId, Bundle extras) {
            if (mediaId == null) return;
            Log.d(TAG, "onPlayFromMediaId: " + mediaId);
            String stationId = mediaId.startsWith(STATION_PREFIX) ? mediaId.substring(STATION_PREFIX.length()) : mediaId;
            // 1. Search currentStations
            for (int i = 0; i < currentStations.size(); i++) {
                if (currentStations.get(i).id.equals(stationId)) {
                    currentIndex = i; playStation(currentStations.get(i)); return;
                }
            }
            // 2. Fallback: favorites
            List<StationData> favorites = loadStations(KEY_FAVORITES);
            for (int i = 0; i < favorites.size(); i++) {
                if (favorites.get(i).id.equals(stationId)) {
                    currentStations = favorites; currentIndex = i; playStation(favorites.get(i)); return;
                }
            }
            // 3. Fallback: recents
            List<StationData> recents = loadStations(KEY_RECENTS);
            for (int i = 0; i < recents.size(); i++) {
                if (recents.get(i).id.equals(stationId)) {
                    currentStations = recents; currentIndex = i; playStation(recents.get(i)); return;
                }
            }
            // 4. Last resort: fetch by UUID from API
            Log.d(TAG, "Station not found locally, fetching from API: " + stationId);
            new Thread(() -> {
                StationData station = fetchStationByUuid(stationId);
                if (station != null) {
                    handler.post(() -> {
                        currentStations = new ArrayList<>(); currentStations.add(station);
                        currentIndex = 0; playStation(station);
                    });
                } else { Log.w(TAG, "Station not found anywhere: " + stationId); }
            }).start();
        }
        @Override public void onPrepare() { onPlay(); }
        @Override public void onPlay() {
            if (currentStation != null) startAsForeground(currentStation.name, true);
            if (requestAudioFocus()) { player.play(); updatePlaybackState(PlaybackStateCompat.STATE_PLAYING); }
        }
        @Override public void onPause() {
            player.pause(); updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
            if (currentStation != null) startAsForeground(currentStation.name, false);
        }
        @Override public void onStop() {
            player.stop(); abandonAudioFocus(); updatePlaybackState(PlaybackStateCompat.STATE_STOPPED);
            if (foregroundStarted) { stopForeground(false); foregroundStarted = false; }
        }
        @Override public void onSkipToNext() {
            if (currentStations.isEmpty()) return;
            currentIndex = (currentIndex + 1) % currentStations.size();
            playStation(currentStations.get(currentIndex));
        }
        @Override public void onSkipToPrevious() {
            if (currentStations.isEmpty()) return;
            currentIndex = currentIndex - 1 < 0 ? currentStations.size() - 1 : currentIndex - 1;
            playStation(currentStations.get(currentIndex));
        }
        @Override public void onPlayFromSearch(String query, Bundle extras) {
            if (query == null || query.trim().isEmpty()) {
                List<StationData> favorites = loadStations(KEY_FAVORITES);
                if (!favorites.isEmpty()) { currentStations = favorites; currentIndex = 0; playStation(favorites.get(0)); }
                return;
            }
            String q = query;
            new Thread(() -> {
                List<StationData> stations = searchStations(q, 25);
                if (!stations.isEmpty()) { currentStations = stations; currentIndex = 0; playStation(stations.get(0)); }
            }).start();
        }
    };

    private final Player.Listener playerListener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int playbackState) {
            Log.d(TAG, "onPlaybackStateChanged: " + playbackState + " (IDLE=1, BUFFERING=2, READY=3, ENDED=4)");
            switch (playbackState) {
                case Player.STATE_BUFFERING:
                    updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
                    startBufferingTimeout();
                    break;
                case Player.STATE_READY:
                    cancelBufferingTimeout();
                    triedProtocolFallback = false;
                    if (player.isPlaying()) {
                        updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                        if (currentStation != null) startAsForeground(currentStation.name, true);
                    }
                    break;
                case Player.STATE_ENDED:
                    cancelBufferingTimeout();
                    updatePlaybackState(PlaybackStateCompat.STATE_STOPPED);
                    break;
                case Player.STATE_IDLE:
                    cancelBufferingTimeout();
                    break;
            }
        }
        @Override
        public void onPlayerError(PlaybackException error) {
            cancelBufferingTimeout();
            Log.e(TAG, "ExoPlayer error: " + error.getMessage() + " | errorCode=" + error.errorCode, error);
            if (!triedProtocolFallback && currentStation != null) { tryProtocolFallback(); }
            else { updatePlaybackState(PlaybackStateCompat.STATE_ERROR); }
        }
        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            updatePlaybackState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED);
            if (currentStation != null) startAsForeground(currentStation.name, isPlaying);
        }
    };

    private void startBufferingTimeout() {
        cancelBufferingTimeout();
        bufferingTimeoutRunnable = () -> {
            Log.w(TAG, "Buffering timeout (" + (STREAM_BUFFER_TIMEOUT_MS / 1000) + "s) - trying protocol fallback");
            if (currentStation != null && !triedProtocolFallback) tryProtocolFallback();
        };
        handler.postDelayed(bufferingTimeoutRunnable, STREAM_BUFFER_TIMEOUT_MS);
    }

    private void cancelBufferingTimeout() {
        if (bufferingTimeoutRunnable != null) {
            handler.removeCallbacks(bufferingTimeoutRunnable);
            bufferingTimeoutRunnable = null;
        }
    }

    private void forceResetPlayerForSwitch() {
        cancelBufferingTimeout();
        player.setPlayWhenReady(false);
        player.pause(); player.stop(); player.clearMediaItems();
        updatePlaybackState(PlaybackStateCompat.STATE_STOPPED);
    }

    private void tryProtocolFallback() {
        triedProtocolFallback = true;
        if (currentStation == null) return;
        String url = currentStation.streamUrl;
        String fallbackUrl;
        if (url.startsWith("https://")) { fallbackUrl = url.replace("https://", "http://"); }
        else if (url.startsWith("http://")) { fallbackUrl = url.replace("http://", "https://"); }
        else { return; }
        Log.d(TAG, "Protocol fallback: " + url + " -> " + fallbackUrl);
        handler.post(() -> {
            forceResetPlayerForSwitch();
            player.setMediaItem(MediaItem.fromUri(fallbackUrl));
            player.prepare(); player.setVolume(1.0f); player.play();
            updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
        });
    }

    private String resolveStreamUrlSafely(String urlStr) {
        Future<String> future = streamResolverExecutor.submit(() -> resolveStreamUrl(urlStr));
        try {
            return future.get(RESOLVE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            Log.w(TAG, "resolveStreamUrl timeout (" + RESOLVE_TIMEOUT_MS + "ms), using raw URL");
            return urlStr;
        } catch (InterruptedException e) {
            future.cancel(true); Thread.currentThread().interrupt();
            return urlStr;
        } catch (Exception e) {
            future.cancel(true);
            return urlStr;
        }
    }

    private String resolveStreamUrl(String urlStr) {
        Log.d(TAG, "resolveStreamUrl: " + urlStr);
        try {
            String resolved = followRedirects(urlStr, 5);
            String contentType = "";
            try {
                HttpURLConnection headConn = (HttpURLConnection) new URL(resolved).openConnection();
                headConn.setRequestMethod("HEAD");
                headConn.setConnectTimeout(NETWORK_TIMEOUT_MS); headConn.setReadTimeout(NETWORK_TIMEOUT_MS);
                headConn.setRequestProperty("User-Agent", USER_AGENT);
                headConn.setInstanceFollowRedirects(true);
                contentType = headConn.getContentType();
                headConn.disconnect();
                if (contentType == null) contentType = "";
                contentType = contentType.toLowerCase();
            } catch (Exception e) {
                Log.w(TAG, "HEAD failed, extension detection: " + e.getMessage());
            }
            String lower = resolved.toLowerCase();
            boolean isPls = contentType.contains("audio/x-scpls") || lower.endsWith(".pls") || lower.contains(".pls?");
            boolean isM3u = contentType.contains("audio/mpegurl") || contentType.contains("audio/x-mpegurl")
                || lower.endsWith(".m3u") || lower.endsWith(".m3u8") || lower.contains(".m3u?");
            if (isM3u) {
                String fromPlaylist = parseM3uPlaylist(resolved);
                if (fromPlaylist != null) return fromPlaylist;
            } else if (isPls) {
                String fromPlaylist = parsePlsPlaylist(resolved);
                if (fromPlaylist != null) return fromPlaylist;
            }
            return resolved;
        } catch (Exception e) {
            Log.w(TAG, "resolveStreamUrl failed: " + e.getMessage());
            return urlStr;
        }
    }

    private String followRedirects(String urlStr, int maxRedirects) throws Exception {
        String current = urlStr;
        for (int i = 0; i < maxRedirects; i++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(current).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(NETWORK_TIMEOUT_MS); conn.setReadTimeout(NETWORK_TIMEOUT_MS);
            conn.setRequestMethod("HEAD");
            conn.setRequestProperty("User-Agent", USER_AGENT);
            int code;
            try { code = conn.getResponseCode(); }
            catch (Exception e) {
                conn.disconnect();
                conn = (HttpURLConnection) new URL(current).openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(NETWORK_TIMEOUT_MS); conn.setReadTimeout(NETWORK_TIMEOUT_MS);
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", USER_AGENT);
                code = conn.getResponseCode();
            }
            if (code >= 300 && code < 400) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) break;
                if (location.startsWith("/")) {
                    URL base = new URL(current);
                    location = base.getProtocol() + "://" + base.getHost() + location;
                }
                current = location;
            } else { conn.disconnect(); break; }
        }
        return current;
    }

    private String parseM3uPlaylist(String urlStr) {
        try {
            String content = httpGet(urlStr);
            for (String line : content.split("\n")) {
                line = line.trim();
                if (!line.isEmpty() && !line.startsWith("#")) return line;
            }
        } catch (Exception e) { Log.w(TAG, "parseM3u error: " + e.getMessage()); }
        return null;
    }

    private String parsePlsPlaylist(String urlStr) {
        try {
            String content = httpGet(urlStr);
            for (String line : content.split("\n")) {
                line = line.trim();
                if (line.toLowerCase().matches("^file\\d+=.*")) {
                    String url = line.substring(line.indexOf('=') + 1).trim();
                    if (!url.isEmpty()) return url;
                }
            }
        } catch (Exception e) { Log.w(TAG, "parsePls error: " + e.getMessage()); }
        return null;
    }

    private void playStation(StationData station) {
        Log.d(TAG, "playStation: " + station.name + " | URL: " + station.streamUrl);
        currentStation = station;
        triedProtocolFallback = false;
        cancelBufferingTimeout();
        final int requestSeq = playbackRequestSeq.incrementAndGet();
        startAsForeground(station.name, true);
        if (!requestAudioFocus()) { Log.w(TAG, "Could not get audio focus"); return; }
        new Thread(() -> {
            String resolvedUrl = resolveStreamUrlSafely(station.streamUrl);
            handler.post(() -> {
                if (requestSeq != playbackRequestSeq.get()) return;
                forceResetPlayerForSwitch();
                player.setMediaItem(MediaItem.fromUri(resolvedUrl));
                player.prepare(); player.setVolume(1.0f); player.play();
                updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
            });
        }).start();
        Uri artworkUri;
        if (station.logo != null && !station.logo.isEmpty()) {
            artworkUri = Uri.parse(station.logo.replace("http://", "https://"));
        } else {
            artworkUri = Uri.parse("android.resource://" + getPackageName() + "/drawable/station_placeholder");
        }
        MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, station.id)
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, station.name)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Radio Sphere")
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Live")
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, artworkUri.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ART_URI, artworkUri.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, artworkUri.toString())
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1).build();
        mediaSession.setMetadata(metadata);
        updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
    }

    private void updatePlaybackState(int state) {
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_STOP | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH
            | PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID;
        PlaybackStateCompat.Builder builder = new PlaybackStateCompat.Builder()
            .setActions(actions).setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f);
        if (state == PlaybackStateCompat.STATE_ERROR) {
            builder.setErrorMessage(PlaybackStateCompat.ERROR_CODE_APP_ERROR, "Impossible de lire cette station");
        }
        mediaSession.setPlaybackState(builder.build());
    }

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
                    list.add(new StationData(obj.optString("id", ""), obj.optString("name", "Unknown"),
                        streamUrl, obj.optString("logo", ""), obj.optString("country", ""), obj.optString("tags", "")));
                }
            }
        } catch (Exception e) { Log.e(TAG, "parseStationsJson error", e); }
        return list;
    }

    private List<StationData> fetchTopStations(int limit) {
        for (String mirror : API_MIRRORS) {
            try { return parseApiResponse(httpGet(mirror + "/json/stations/topvote?limit=" + limit + "&hidebroken=true")); }
            catch (Exception e) { /* next */ }
        }
        return new ArrayList<>();
    }

    private StationData fetchStationByUuid(String uuid) {
        for (String mirror : API_MIRRORS) {
            try {
                String url = mirror + "/json/stations/byuuid/" + Uri.encode(uuid);
                List<StationData> results = parseApiResponse(httpGet(url));
                if (!results.isEmpty()) return results.get(0);
            } catch (Exception e) { /* next mirror */ }
        }
        return null;
    }

    private List<StationData> searchStations(String query, int limit) {
        List<StationData> nameResults = new ArrayList<>();
        List<StationData> tagResults = new ArrayList<>();
        for (String mirror : API_MIRRORS) {
            try {
                nameResults = parseApiResponse(httpGet(mirror + "/json/stations/search?name=" + Uri.encode(query)
                    + "&limit=" + limit + "&order=votes&reverse=true&hidebroken=true"));
                break;
            } catch (Exception e) { /* next */ }
        }
        for (String mirror : API_MIRRORS) {
            try {
                tagResults = parseApiResponse(httpGet(mirror + "/json/stations/search?tag=" + Uri.encode(query)
                    + "&limit=" + limit + "&order=votes&reverse=true&hidebroken=true"));
                break;
            } catch (Exception e) { /* next */ }
        }
        java.util.LinkedHashMap<String, StationData> map = new java.util.LinkedHashMap<>();
        for (StationData s : nameResults) map.put(s.id, s);
        for (StationData s : tagResults) if (!map.containsKey(s.id)) map.put(s.id, s);
        return new ArrayList<>(map.values());
    }

    private String httpGet(String urlStr) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("GET"); conn.setConnectTimeout(NETWORK_TIMEOUT_MS); conn.setReadTimeout(NETWORK_TIMEOUT_MS);
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setInstanceFollowRedirects(true);
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line).append("\n");
        reader.close(); conn.disconnect();
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
                    list.add(new StationData(obj.optString("stationuuid", ""), obj.optString("name", "Unknown"),
                        streamUrl, obj.optString("favicon", ""), obj.optString("country", ""), obj.optString("tags", "")));
                }
            }
        } catch (Exception e) { Log.e(TAG, "parseApiResponse error", e); }
        return list;
    }

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
            artworkUri = Uri.parse("android.resource://" + getPackageName() + "/drawable/station_placeholder");
        }
        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
            .setMediaId(STATION_PREFIX + station.id).setTitle(station.name)
            .setSubtitle("Radio Sphere").setIconUri(artworkUri).build();
        return new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE);
    }

    private MediaBrowserCompat.MediaItem buildBrowsableItem(String mediaId, String title, String subtitle) {
        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
            .setMediaId(mediaId).setTitle(title).setSubtitle(subtitle).build();
        return new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE);
    }

    private MediaBrowserCompat.MediaItem buildInfoItem(String title, String subtitle) {
        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
            .setMediaId("info:" + title).setTitle(title).setSubtitle(subtitle).build();
        return new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE);
    }
}
'@
$RadioBrowserServiceJava = $RadioBrowserServiceJava -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "RadioBrowserService.java"), $RadioBrowserServiceJava, $UTF8NoBOM)
Write-Host "    RadioBrowserService.java genere avec succes (v2.5.2)" -ForegroundColor Green

Write-Host "    Tous les fichiers Java generes avec succes!" -ForegroundColor Green

# ===================================================================
# 7. Patch MainActivity.java -- WebView + NotificationChannel + RadioAutoPlugin + CastPlugin
# ===================================================================
$MainAct = Get-ChildItem -Path "android/app/src/main/java" -Filter "MainActivity.java" -Recurse | Select-Object -First 1
if ($MainAct) {
    Write-Host ">>> Patch Java MainActivity (WebView + NotifChannel + RadioAutoPlugin + CastPlugin)..." -ForegroundColor Yellow
    $Java = Get-Content $MainAct.FullName -Raw

    if ($Java -notmatch 'RadioAutoPlugin') {
        $Java = $Java -replace '(import .+BridgeActivity;)', "`$1`nimport $ActualPackage.RadioAutoPlugin;"
    }
    if ($Java -notmatch 'CastPlugin') {
        $Java = $Java -replace '(import .+BridgeActivity;)', "`$1`nimport $ActualPackage.CastPlugin;"
    }

    $OnCreatePatch = @"
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(RadioAutoPlugin.class);
    registerPlugin(CastPlugin.class);
    super.onCreate(savedInstanceState);
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        android.app.NotificationChannel autoChannel = new android.app.NotificationChannel(
            "radio_auto_playback", "Radio Sphere Playback", android.app.NotificationManager.IMPORTANCE_LOW);
        autoChannel.setShowBadge(false);
        autoChannel.setDescription("Notification pour la lecture Radio Sphere");
        autoChannel.enableVibration(false);
        nm.createNotificationChannel(autoChannel);
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
    $Java = $Java -replace '(public class MainActivity extends BridgeActivity \{)', "`$1`n$OnCreatePatch"
    [System.IO.File]::WriteAllText($MainAct.FullName, $Java, $UTF8NoBOM)
} else {
    Write-Host "    ERREUR: MainActivity.java introuvable !" -ForegroundColor Red
}

# ===================================================================
# 8. Sync final
# ===================================================================
npx cap sync

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host ">>> Script v2.5.0 Termine ! Magnetophone + Permissions" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "CHANGEMENTS v2.5.0 :" -ForegroundColor Yellow
Write-Host "  ANDROID AUTO - FIX CRITIQUE :" -ForegroundColor Cyan
Write-Host "    - RadioBrowserService demarre en foreground AVANT requestAudioFocus()" -ForegroundColor White
Write-Host "    - Corrige le blocage audio sur Android 14/15 (audio focus denied)" -ForegroundColor White
Write-Host "    - Notification MediaStyle avec token MediaSession + Play/Pause" -ForegroundColor White
Write-Host "    - NotificationChannel 'radio_auto_playback' (ID 3001) dedie" -ForegroundColor White
Write-Host "    - foregroundServiceType='mediaPlayback' dans le Manifest" -ForegroundColor White
Write-Host "    - followRedirects utilise HEAD au lieu de GET (evite le streaming premature)" -ForegroundColor White
Write-Host "    - onPrepare() ajoute au callback MediaSession (requis AAOS)" -ForegroundColor White
Write-Host "  MAGNETOPHONE (Premium) :" -ForegroundColor Cyan
Write-Host "    - Buffer de 5 minutes (time-shift) avec barre de scrub" -ForegroundColor White
Write-Host "    - Enregistrement MP3 jusqu'a 10 minutes (bouton REC)" -ForegroundColor White
Write-Host "    - Animation cassette pendant l'enregistrement" -ForegroundColor White
Write-Host "    - Sauvegarde fichier ou partage apres arret" -ForegroundColor White
Write-Host "    - Fallback MediaRecorder pour navigateur web" -ForegroundColor White
Write-Host "  PERMISSIONS :" -ForegroundColor Cyan
Write-Host "    - Demande native notifications via Capacitor LocalNotifications" -ForegroundColor White
Write-Host "    - Demande stockage via Capacitor Filesystem" -ForegroundColor White
Write-Host "    - Toutes les permissions redemandees a l'ouverture de la page de bienvenue" -ForegroundColor White
Write-Host "    - Bouton 'Redemander les autorisations' dans le guide" -ForegroundColor White
Write-Host "    - Bouton 'Recharger page de bienvenue' dans le guide" -ForegroundColor White
Write-Host "  GUIDE UTILISATEUR :" -ForegroundColor Cyan
Write-Host "    - Section Autorisations ajoutee (explique chaque permission)" -ForegroundColor White
Write-Host "    - Section Magnetophone ajoutee (buffer, scrub, REC)" -ForegroundColor White
Write-Host "    - Magnetophone ajoute comme 4e option Premium" -ForegroundColor White
Write-Host "    - Traductions FR, EN, ES, DE, JA" -ForegroundColor White
Write-Host ""
Write-Host "  (Inclut tous les changements v2.4.8 : Android Auto, Chromecast, etc.)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "IMPORTANT : DESINSTALLER L'ANCIENNE APK AVANT D'INSTALLER !" -ForegroundColor Red
Write-Host ""
Write-Host "ANDROID AUTO : Activer 'Sources inconnues' dans Parametres > Developpeur" -ForegroundColor Yellow
Write-Host "               de l'app Android Auto sur le smartphone" -ForegroundColor Yellow
Write-Host ""
Write-Host ">>> npx cap open android" -ForegroundColor Cyan
