package com.radiosphere.app;

import android.content.Context;
import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.framework.OptionsProvider;
import com.google.android.gms.cast.framework.SessionProvider;
import java.util.List;

/**
 * CastOptionsProvider — Required by Google Cast framework.
 * Provides the Cast Application ID so the framework knows which receiver to connect to.
 *
 * IMPORTANT: This App ID MUST match the one in CastPlugin.java.
 * - Test receiver (default): CC1AD845
 * - Production (custom):     65257ADB
 *
 * Must be declared in AndroidManifest.xml:
 * <meta-data
 *     android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
 *     android:value="com.radiosphere.app.CastOptionsProvider" />
 */
public class CastOptionsProvider implements OptionsProvider {

    // Must match CastPlugin.CAST_APP_ID — use CC1AD845 for testing, 65257ADB for production
    private static final String CAST_APP_ID = "CC1AD845";

    @Override
    public CastOptions getCastOptions(Context context) {
        return new CastOptions.Builder()
            .setReceiverApplicationId(CAST_APP_ID)
            .build();
    }

    @Override
    public List<SessionProvider> getAdditionalSessionProviders(Context context) {
        return null;
    }
}
