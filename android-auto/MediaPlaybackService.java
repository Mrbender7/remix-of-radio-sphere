package com.radiosphere.app;

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

/**
 * MediaPlaybackService — Foreground service that displays a MediaStyle notification
 * on the lock screen and notification shade for normal (WebView) playback.
 *
 * This service does NOT play audio itself. The WebView handles actual audio playback.
 * This service is a "mirror" that shows metadata + Play/Pause controls via MediaSession.
 *
 * Communication:
 *   - Receives station info via Intent extras from RadioAutoPlugin.notifyPlaybackState()
 *   - Sends toggle broadcast (com.radiosphere.TOGGLE_PLAYBACK) back to WebView
 *     when user taps Play/Pause on the notification
 */
public class MediaPlaybackService extends Service {

    private static final String CHANNEL_ID = "radio_playback_v3";
    private static final int NOTIFICATION_ID = 2001;
    public static final String ACTION_UPDATE = "com.radiosphere.ACTION_UPDATE_MEDIA";
    public static final String ACTION_STOP = "com.radiosphere.ACTION_STOP_MEDIA";
    public static final String BROADCAST_TOGGLE = "com.radiosphere.TOGGLE_PLAYBACK";

    private static final String EXTRA_NAME = "station_name";
    private static final String EXTRA_LOGO = "station_logo";
    private static final String EXTRA_IS_PLAYING = "is_playing";

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
            @Override
            public void onPlay() {
                sendBroadcast(new Intent(BROADCAST_TOGGLE).setPackage(getPackageName()));
            }

            @Override
            public void onPause() {
                sendBroadcast(new Intent(BROADCAST_TOGGLE).setPackage(getPackageName()));
            }

            @Override
            public void onStop() {
                stopForeground(true);
                stopSelf();
            }
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

        String name = intent.getStringExtra(EXTRA_NAME);
        String logo = intent.getStringExtra(EXTRA_LOGO);
        boolean isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);

        if (name == null) name = "Radio Sphere";
        if (logo == null) logo = "";

        // Update MediaSession metadata
        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, name)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Radio Sphere")
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Live")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1);

        // Load artwork in background if URL changed
        final String finalLogo = logo;
        final String finalName = name;
        final boolean finalIsPlaying = isPlaying;

        if (!logo.isEmpty() && !logo.equals(cachedLogoUrl)) {
            cachedLogoUrl = logo;
            new Thread(() -> {
                cachedArtwork = downloadBitmap(finalLogo);
                // Re-post notification with artwork
                updateSessionAndNotification(finalName, finalIsPlaying, cachedArtwork);
            }).start();
        }

        updateSessionAndNotification(name, isPlaying, cachedArtwork);

        return START_NOT_STICKY;
    }

    private void updateSessionAndNotification(String name, boolean isPlaying, Bitmap artwork) {
        // Metadata
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

        // Playback state
        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_STOP
            | PlaybackStateCompat.ACTION_PLAY_PAUSE;
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
            .build());

        // Build notification
        Notification notification = buildNotification(name, isPlaying, artwork);
        startForeground(NOTIFICATION_ID, notification);
    }

    private Notification buildNotification(String stationName, boolean isPlaying, Bitmap artwork) {
        // Content intent — open the app
        Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0,
            openIntent != null ? openIntent : new Intent(),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Toggle action
        Intent toggleIntent = new Intent(BROADCAST_TOGGLE);
        toggleIntent.setPackage(getPackageName());
        PendingIntent togglePendingIntent = PendingIntent.getBroadcast(this, 0,
            toggleIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int toggleIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String toggleLabel = isPlaying ? "Pause" : "Play";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(stationName)
            .setContentText("Radio Sphere")
            .setSubText("Live")
            .setSmallIcon(getApplicationInfo().icon)
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setShowWhen(false)
            .addAction(toggleIcon, toggleLabel, togglePendingIntent)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0));

        if (artwork != null) {
            builder.setLargeIcon(artwork);
        }

        return builder.build();
    }

    @Nullable
    private Bitmap downloadBitmap(String urlStr) {
        try {
            String safeUrl = urlStr.replace("http://", "https://");
            HttpURLConnection conn = (HttpURLConnection) new URL(safeUrl).openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            InputStream in = conn.getInputStream();
            Bitmap bmp = BitmapFactory.decodeStream(in);
            in.close();
            conn.disconnect();
            return bmp;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
