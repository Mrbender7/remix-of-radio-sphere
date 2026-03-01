package com.radiosphere.app;

import android.content.Context;
import com.google.android.gms.cast.CastMediaControlIntent;
import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.framework.OptionsProvider;
import com.google.android.gms.cast.framework.SessionProvider;
import java.util.List;

/**
 * CastOptionsProvider v2.4.2 — Required by Google Cast framework.
 *
 * Uses DEFAULT_MEDIA_RECEIVER_APPLICATION_ID for maximum device discovery.
 * Once discovery is confirmed working, switch to custom App ID "65257ADB".
 */
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
