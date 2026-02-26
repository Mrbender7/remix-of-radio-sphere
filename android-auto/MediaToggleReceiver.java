package com.radiosphere.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * MediaToggleReceiver — Receives TOGGLE_PLAYBACK broadcast from MediaPlaybackService
 * notification buttons and forwards to any registered listener (WebView via Capacitor).
 *
 * This receiver is registered in AndroidManifest.xml.
 */
public class MediaToggleReceiver extends BroadcastReceiver {

    private static final String TAG = "MediaToggleReceiver";

    // Static listener that PlayerContext can register via RadioAutoPlugin
    private static Runnable toggleListener;

    public static void setToggleListener(Runnable listener) {
        toggleListener = listener;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "TOGGLE_PLAYBACK broadcast received");
        if (toggleListener != null) {
            toggleListener.run();
        }
    }
}
