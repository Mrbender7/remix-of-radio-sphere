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
 * Must be declared in AndroidManifest.xml:
 * <meta-data
 *     android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
 *     android:value="com.radiosphere.app.CastOptionsProvider" />
 */
public class CastOptionsProvider implements OptionsProvider {

    private static final String CAST_APP_ID = "65257ADB";

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
