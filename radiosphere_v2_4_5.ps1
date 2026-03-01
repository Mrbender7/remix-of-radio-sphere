# radiosphere_v2_4_5.ps1
# v2.4.5 -- Cast: no forced HTTPS, audio/*, localAudioControl events, unified RadioSphereSession
$RepoUrl = "https://github.com/Mrbender7/remix-of-radio-sphere"
$ProjectFolder = "remix-of-radio-sphere"
$UTF8NoBOM = New-Object System.Text.UTF8Encoding($False)

Write-Host ">>> Lancement du Master Fix v2.4.5 - Cast audio + Android Auto unification" -ForegroundColor Cyan

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
  "appId": "com.radiosphere.app",
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

    # networkSecurityConfig
    if ($ManifestContent -notmatch 'networkSecurityConfig') {
        $ManifestContent = $ManifestContent -replace '<application', '<application android:networkSecurityConfig="@xml/network_security_config"'
    }
    
    # Services + Cast OptionsProvider
    $ServiceDecl = @"
    <receiver android:name="io.capawesome.capacitorjs.plugins.foregroundservice.NotificationActionBroadcastReceiver" />
    <service android:name="io.capawesome.capacitorjs.plugins.foregroundservice.AndroidForegroundService" android:foregroundServiceType="mediaPlayback" />

    <!-- Android Auto -->
    <meta-data
        android:name="com.google.android.gms.car.application"
        android:resource="@xml/automotive_app_desc" />
    <service
        android:name=".RadioBrowserService"
        android:exported="true"
        android:enabled="true"
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

    <!-- v2.4.0: Chromecast CastOptionsProvider (OBLIGATOIRE) -->
    <meta-data
        android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
        android:value="__ACTUAL_PACKAGE__.CastOptionsProvider" />

    <!-- v2.4.5: MediaPlaybackService with MediaBrowserService action for unified AA -->
    <service
        android:name=".MediaPlaybackService"
        android:exported="true"
        android:enabled="true"
        android:foregroundServiceType="mediaPlayback">
        <intent-filter>
            <action android:name="android.media.browse.MediaBrowserService" />
        </intent-filter>
    </service>

    <!-- v2.2.9: Broadcast receiver for notification toggle -->
    <receiver
        android:name=".MediaToggleReceiver"
        android:exported="false">
        <intent-filter>
            <action android:name="com.radiosphere.TOGGLE_PLAYBACK" />
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

# Fix Manifest placeholder for CastOptionsProvider package
if (Test-Path $ManifestPath) {
    $ManifestContent = Get-Content $ManifestPath -Raw
    $ManifestContent = $ManifestContent -replace '__ACTUAL_PACKAGE__', $ActualPackage
    [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $ManifestPath), $ManifestContent, $UTF8NoBOM)
    Write-Host "    Manifest: CastOptionsProvider package set to $ActualPackage" -ForegroundColor DarkGray
}

# --- RadioAutoPlugin.java (v2.2.9) ---
Write-Host "    Generation RadioAutoPlugin.java (v2.2.9)..." -ForegroundColor DarkGray
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

# --- MediaPlaybackService.java (v2.2.9) ---
Write-Host "    Generation MediaPlaybackService.java (v2.2.9)..." -ForegroundColor DarkGray
$MediaPlaybackServiceJava = @'
package __PACKAGE__;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MediaPlaybackService extends Service {

    private static final String CHANNEL_ID = "radio_playback_v3";
    private static final int NOTIFICATION_ID = 2001;
    public static final String ACTION_UPDATE = "com.radiosphere.ACTION_UPDATE_MEDIA";
    public static final String ACTION_STOP = "com.radiosphere.ACTION_STOP_MEDIA";
    public static final String BROADCAST_TOGGLE = "com.radiosphere.TOGGLE_PLAYBACK";

    private MediaSessionCompat mediaSession;
    private Bitmap cachedArtwork;
    private String cachedLogoUrl = "";

    @Override
    public void onCreate() {
        super.onCreate();
        mediaSession = new MediaSessionCompat(this, "RadioSphereSession");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { sendBroadcast(new Intent(BROADCAST_TOGGLE).setPackage(getPackageName())); }
            @Override public void onPause() { sendBroadcast(new Intent(BROADCAST_TOGGLE).setPackage(getPackageName())); }
            @Override public void onStop() { stopForeground(true); stopSelf(); }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            mediaSession.setActive(false);
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        String name = intent.getStringExtra("station_name");
        String logo = intent.getStringExtra("station_logo");
        boolean isPlaying = intent.getBooleanExtra("is_playing", false);
        if (name == null) name = "Radio Sphere";
        if (logo == null) logo = "";
        final String finalLogo = logo;
        final String finalName = name;
        final boolean finalIsPlaying = isPlaying;
        if (!logo.isEmpty() && !logo.equals(cachedLogoUrl)) {
            cachedLogoUrl = logo;
            new Thread(() -> {
                cachedArtwork = downloadBitmap(finalLogo);
                updateSessionAndNotification(finalName, finalIsPlaying, cachedArtwork);
            }).start();
        }
        updateSessionAndNotification(name, isPlaying, cachedArtwork);
        return START_NOT_STICKY;
    }

    private void updateSessionAndNotification(String name, boolean isPlaying, Bitmap artwork) {
        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, name)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Radio Sphere")
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Live")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1);
        if (artwork != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artwork);
        }
        mediaSession.setMetadata(metaBuilder.build());
        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_STOP | PlaybackStateCompat.ACTION_PLAY_PAUSE;
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions).setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f).build());
        Notification notification = buildNotification(name, isPlaying, artwork);
        startForeground(NOTIFICATION_ID, notification);
    }

    private Notification buildNotification(String stationName, boolean isPlaying, Bitmap artwork) {
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
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(stationName).setContentText("Radio Sphere").setSubText("Live")
            .setSmallIcon(getApplicationInfo().icon).setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setOngoing(isPlaying).setShowWhen(false)
            .addAction(toggleIcon, toggleLabel, togglePendingIntent)
            .setStyle(new MediaStyle().setMediaSession(mediaSession.getSessionToken()).setShowActionsInCompactView(0));
        if (artwork != null) builder.setLargeIcon(artwork);
        return builder.build();
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

    @Override public void onDestroy() {
        if (mediaSession != null) { mediaSession.setActive(false); mediaSession.release(); }
        super.onDestroy();
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
'@
$MediaPlaybackServiceJava = $MediaPlaybackServiceJava -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "MediaPlaybackService.java"), $MediaPlaybackServiceJava, $UTF8NoBOM)
Write-Host "    MediaPlaybackService.java genere avec succes" -ForegroundColor Green

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

# --- CastPlugin.java (v2.4.2 -- DEFAULT_MEDIA_RECEIVER, runtime permissions, diagnostic) ---
Write-Host "    Generation CastPlugin.java (v2.4.2 -- discovery fix)..." -ForegroundColor DarkGray
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
    // v2.4.2: Use DEFAULT receiver for maximum compatibility during discovery
    private static final String CAST_APP_ID = "65257ADB";

    private CastContext castContext;
    private MediaRouter mediaRouter;
    private MediaRouteSelector mediaRouteSelector;
    private boolean devicesAvailable = false;
    private PluginCall savedInitCall = null;

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

    // v2.4.2: Enhanced diagnostic logging
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

    // v2.4.2: Permission helpers
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
        Log.d(TAG, "Network permission callback - granted: " + granted);
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

    @PluginMethod
    public void initialize(PluginCall call) {
        // v2.4.2: Check permissions before initializing Cast SDK
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

    @PluginMethod
    public void requestSession(PluginCall call) {
        // v2.4.2: Ensure permissions before showing chooser
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

                    // v2.4.5: Log original URL, no forced HTTPS
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

    @Override
    protected void handleOnDestroy() {
        if (castContext != null) castContext.getSessionManager().removeSessionManagerListener(sessionListener, CastSession.class);
        if (mediaRouter != null) mediaRouter.removeCallback(mediaRouterCallback);
        super.handleOnDestroy();
    }
}
'@
$CastPluginJava = $CastPluginJava -replace '__PACKAGE__', $ActualPackage
[System.IO.File]::WriteAllText((Join-Path $PackageDir "CastPlugin.java"), $CastPluginJava, $UTF8NoBOM)
Write-Host "    CastPlugin.java genere avec succes (v2.4.2 -- discovery fix)" -ForegroundColor Green

# --- CastOptionsProvider.java (v2.4.2 -- DEFAULT_MEDIA_RECEIVER) ---
Write-Host "    Generation CastOptionsProvider.java (v2.4.2)..." -ForegroundColor DarkGray
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
            .setReceiverApplicationId("65257ADB")
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
Write-Host "    CastOptionsProvider.java genere avec succes (v2.4.2)" -ForegroundColor Green

# --- RadioBrowserService.java (v2.3.0 -- stream resolution + local artwork) ---
Write-Host "    Generation RadioBrowserService.java (v2.3.0 -- stream resolution + local artwork)..." -ForegroundColor DarkGray
$RadioBrowserServiceJava = @'
package __PACKAGE__;

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

public class RadioBrowserService extends MediaBrowserServiceCompat {

    private static final String TAG = "RadioBrowserService";
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
        final String id, name, streamUrl, logo, country, tags;
        StationData(String id, String name, String streamUrl, String logo, String country, String tags) {
            this.id = id; this.name = name; this.streamUrl = streamUrl;
            this.logo = logo; this.country = country; this.tags = tags;
        }
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

    @Nullable @Override
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
                    new Thread(() -> {
                        List<StationData> stations = fetchStationsByGenre(genre, 25);
                        currentStations = stations;
                        result.sendResult(toMediaItems(stations));
                    }).start();
                } else { result.sendResult(new ArrayList<>()); }
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
            String stationId = mediaId.startsWith(STATION_PREFIX) ? mediaId.substring(STATION_PREFIX.length()) : mediaId;
            for (int i = 0; i < currentStations.size(); i++) {
                if (currentStations.get(i).id.equals(stationId)) {
                    currentIndex = i; playStation(currentStations.get(i)); return;
                }
            }
        }
        @Override public void onPlay() {
            if (requestAudioFocus()) { player.play(); updatePlaybackState(PlaybackStateCompat.STATE_PLAYING); }
        }
        @Override public void onPause() { player.pause(); updatePlaybackState(PlaybackStateCompat.STATE_PAUSED); }
        @Override public void onStop() { player.stop(); abandonAudioFocus(); updatePlaybackState(PlaybackStateCompat.STATE_STOPPED); }
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
            Log.e(TAG, "ExoPlayer error: " + error.getMessage() + " | errorCode=" + error.errorCode, error);
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

    private void startBufferingTimeout() {
        cancelBufferingTimeout();
        bufferingTimeoutRunnable = () -> {
            Log.w(TAG, "Buffering timeout (10s) -- trying protocol fallback");
            if (currentStation != null && !triedProtocolFallback) tryProtocolFallback();
        };
        handler.postDelayed(bufferingTimeoutRunnable, 10000);
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
        if (url.startsWith("https://")) { fallbackUrl = url.replace("https://", "http://"); }
        else if (url.startsWith("http://")) { fallbackUrl = url.replace("http://", "https://"); }
        else { return; }
        Log.d(TAG, "Protocol fallback: " + url + " -> " + fallbackUrl);
        player.stop();
        player.setMediaItem(MediaItem.fromUri(fallbackUrl));
        player.prepare(); player.play();
    }

    private String resolveStreamUrl(String urlStr) {
        Log.d(TAG, "resolveStreamUrl: " + urlStr);
        try {
            String resolved = followRedirects(urlStr, 5);
            String lower = resolved.toLowerCase();
            if (lower.endsWith(".m3u") || lower.endsWith(".m3u8") || lower.contains(".m3u")) {
                String fromPlaylist = parseM3uPlaylist(resolved);
                if (fromPlaylist != null) { Log.d(TAG, "Resolved M3U: " + fromPlaylist); return fromPlaylist; }
            } else if (lower.endsWith(".pls") || lower.contains(".pls")) {
                String fromPlaylist = parsePlsPlaylist(resolved);
                if (fromPlaylist != null) { Log.d(TAG, "Resolved PLS: " + fromPlaylist); return fromPlaylist; }
            }
            Log.d(TAG, "Resolved URL: " + resolved);
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
            conn.setConnectTimeout(5000); conn.setReadTimeout(5000);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) break;
                if (location.startsWith("/")) {
                    URL base = new URL(current);
                    location = base.getProtocol() + "://" + base.getHost() + location;
                }
                Log.d(TAG, "Redirect " + code + ": " + current + " -> " + location);
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
                if (line.toLowerCase().startsWith("file1=")) return line.substring(6).trim();
            }
        } catch (Exception e) { Log.w(TAG, "parsePls error: " + e.getMessage()); }
        return null;
    }

    private void playStation(StationData station) {
        Log.d(TAG, "playStation: " + station.name + " | URL: " + station.streamUrl);
        currentStation = station;
        triedProtocolFallback = false;
        cancelBufferingTimeout();
        if (!requestAudioFocus()) { Log.w(TAG, "Could not get audio focus"); return; }

        new Thread(() -> {
            String resolvedUrl = resolveStreamUrl(station.streamUrl);
            Log.d(TAG, "Playing resolved URL: " + resolvedUrl);
            handler.post(() -> {
                player.stop();
                player.setMediaItem(MediaItem.fromUri(resolvedUrl));
                player.prepare(); player.setVolume(1.0f); player.play();
            });
        }).start();

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
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1).build();
        mediaSession.setMetadata(metadata);
        updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
    }

    private void updatePlaybackState(int state) {
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_STOP | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH
            | PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID;
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions).setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f).build());
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

    private List<StationData> fetchStationsByGenre(String genre, int limit) {
        for (String mirror : API_MIRRORS) {
            try {
                String url = mirror + "/json/stations/bytag/" + Uri.encode(genre)
                    + "?limit=" + limit + "&order=votes&reverse=true&hidebroken=true";
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
        conn.setRequestMethod("GET"); conn.setConnectTimeout(5000); conn.setReadTimeout(5000);
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
            artworkUri = Uri.parse("android.resource://" + getPackageName() + "/mipmap/ic_launcher");
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
Write-Host "    RadioBrowserService.java genere avec succes (v2.3.0 -- stream resolution + local artwork)" -ForegroundColor Green

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
Write-Host ">>> Script v2.4.2 Termine ! Cast discovery fix" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "CHANGEMENTS v2.4.2 (depuis v2.4.0) :" -ForegroundColor Yellow
Write-Host "  CAST :" -ForegroundColor Cyan
Write-Host "    - CastPlugin.java : App ID production 65257ADB (recepteur personnalise)" -ForegroundColor White
Write-Host "    - CastPlugin.java : @Permission(alias='network') avec ACCESS_FINE_LOCATION + NEARBY_WIFI_DEVICES" -ForegroundColor White
Write-Host "    - CastPlugin.java : check permissions runtime AVANT CastContext.init + requestSession" -ForegroundColor White
Write-Host "    - CastPlugin.java : diagnostic 'Scan details: Total routes=X, matching=Y, AppID=Z'" -ForegroundColor White
Write-Host "    - CastPlugin.java : CALLBACK_FLAG_PERFORM_ACTIVE_SCAN pour scan actif" -ForegroundColor White
Write-Host "    - CastOptionsProvider.java : App ID production 65257ADB" -ForegroundColor White
Write-Host "    - Manifest : + ACCESS_COARSE_LOCATION (vieux Chromecasts / mDNS)" -ForegroundColor White
Write-Host ""
Write-Host "  ANDROID AUTO :" -ForegroundColor Cyan
Write-Host "    - RadioBrowserService + MediaPlaybackService : MediaSession unifiee 'RadioSphereSession'" -ForegroundColor White
Write-Host "    - MediaPlaybackService : action MediaBrowserService ajoutee au Manifest" -ForegroundColor White
Write-Host "    - Manifest : meta-data SmallIcon pour notifications AA" -ForegroundColor White
Write-Host ""
Write-Host "  AUDIO LOCAL :" -ForegroundColor Cyan
Write-Host "    - PlayerContext : pause audio local lors du Cast connect, resume au disconnect" -ForegroundColor White
Write-Host ""
Write-Host "  CAST MEDIA v2.4.5 :" -ForegroundColor Cyan
Write-Host "    - CastPlugin.java : pas de HTTPS force, URL originale conservee" -ForegroundColor White
Write-Host "    - CastPlugin.java : Content-Type 'audio/*' (AAC/OGG/MPEG auto)" -ForegroundColor White
Write-Host "    - CastPlugin.java : Log 'Loading URL to Cast: ...' avant rmc.load()" -ForegroundColor White
Write-Host "    - CastPlugin.java : events localAudioControl (pauseLocal/resumeLocal)" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT : DESINSTALLER L'ANCIENNE APK AVANT D'INSTALLER !" -ForegroundColor Red
Write-Host ""
Write-Host "ANDROID AUTO : Activer 'Sources inconnues' dans Parametres > Developpeur" -ForegroundColor Yellow
Write-Host "               de l'app Android Auto sur le smartphone" -ForegroundColor Yellow
Write-Host ""
Write-Host "DIAGNOSTIC CHROMECAST :" -ForegroundColor Yellow
Write-Host "  1. Logcat filtre 'CastPlugin'" -ForegroundColor White
Write-Host "  2. Chercher 'Loading URL to Cast: ...' pour verifier l'URL envoyee" -ForegroundColor White
Write-Host "  3. Chercher 'Scan details: Total routes=X'" -ForegroundColor White
Write-Host "  4. Si matching > 0, les Chromecasts sont visibles" -ForegroundColor White
Write-Host "  5. Verifier 'Network permission callback - granted: true'" -ForegroundColor White
Write-Host "  6. App ID utilise : 65257ADB (recepteur personnalise RadioSphere)" -ForegroundColor White
Write-Host ""
Write-Host ">>> npx cap open android" -ForegroundColor Cyan
