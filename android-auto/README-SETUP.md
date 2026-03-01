# RadioSphere — Android Auto & Chromecast Setup Guide

## Prérequis

- Android Studio (latest stable)
- Capacitor ajouté au projet : `npx cap add android`
- Appareil Android ou émulateur avec Android Auto DHU (Desktop Head Unit)

## Étape 1 : Dépendances Gradle

Ajoutez dans `android/app/build.gradle` :

```gradle
dependencies {
    // ExoPlayer pour la lecture audio native
    implementation 'com.google.android.exoplayer:exoplayer-core:2.19.1'
    implementation 'com.google.android.exoplayer:exoplayer-ui:2.19.1'

    // Android Media Compat (MediaBrowserService, MediaSession)
    implementation 'androidx.media:media:1.7.0'

    // Chromecast / Google Cast
    implementation 'com.google.android.gms:play-services-cast-framework:21.4.0'
    implementation 'androidx.mediarouter:mediarouter:1.7.0'
}
```

## Étape 2 : Permissions dans AndroidManifest.xml

Ajoutez ces permissions au niveau `<manifest>` (avant `<application>`) :

```xml
<!-- Réseau de base -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />

<!-- Découverte réseau local (Cast) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

<!-- Android 13+ : requis pour la découverte Wi-Fi locale (mDNS/Cast) -->
<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES"
    android:usesPermissionFlags="neverForLocation" />

<!-- Services & notifications -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

> **Note Android 13+ :** La permission `NEARBY_WIFI_DEVICES` est **obligatoire** pour que le SDK Cast puisse scanner le réseau local. Sans elle, aucun appareil Chromecast ne sera détecté. Le `CastPlugin` gère automatiquement la demande runtime de cette permission.

## Étape 3 : Copier les fichiers natifs

Copiez les fichiers suivants dans votre projet Android :

```
android-auto/RadioBrowserService.kt  →  android/app/src/main/java/app/lovable/radiosphere/RadioBrowserService.kt
android-auto/RadioAutoPlugin.kt      →  android/app/src/main/java/app/lovable/radiosphere/RadioAutoPlugin.kt
android-auto/CastPlugin.java         →  android/app/src/main/java/com/radiosphere/app/CastPlugin.java
android-auto/CastOptionsProvider.java →  android/app/src/main/java/com/radiosphere/app/CastOptionsProvider.java
android-auto/res/xml/automotive_app_desc.xml  →  android/app/src/main/res/xml/automotive_app_desc.xml
```

## Étape 4 : Modifier AndroidManifest.xml (balise `<application>`)

Ajoutez à l'intérieur de la balise `<application>` :

```xml
<!-- Android Auto -->
<meta-data
    android:name="com.google.android.gms.car.application"
    android:resource="@xml/automotive_app_desc" />

<service
    android:name=".RadioBrowserService"
    android:exported="true">
    <intent-filter>
        <action android:name="android.media.browse.MediaBrowserService" />
    </intent-filter>
</service>

<!-- Chromecast — OBLIGATOIRE pour Cast SDK -->
<meta-data
    android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
    android:value="com.radiosphere.app.CastOptionsProvider" />
```

## Étape 5 : Enregistrer les plugins Capacitor

Dans `android/app/src/main/java/.../MainActivity.kt` :

```kotlin
import app.lovable.radiosphere.RadioAutoPlugin
import com.radiosphere.app.CastPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(RadioAutoPlugin::class.java)
        registerPlugin(CastPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

## Étape 6 : App ID Cast (Test vs Production)

Le fichier `CastPlugin.java` et `CastOptionsProvider.java` utilisent le même App ID.

- **Test** : `CC1AD845` (récepteur par défaut Google — permet de valider que la découverte réseau fonctionne)
- **Production** : `65257ADB` (récepteur personnalisé RadioSphere)

> **Important** : Les deux fichiers doivent utiliser le **même** App ID. Commencez par `CC1AD845` pour tester, puis passez à `65257ADB` une fois la découverte confirmée.

## Étape 7 : Build & Test

```bash
npx cap sync android
npx cap open android
# Compiler et lancer sur appareil/émulateur
```

### Diagnostic Chromecast (Logcat)

Filtrez par `CastPlugin` dans Logcat pour voir :
- Nombre de routes total et routes Cast détectées
- État des permissions (granted/missing)
- App ID utilisé
- Événements de session (connected/disconnected)

### Permissions runtime

Au premier lancement ou au clic sur le bouton Cast, l'app demandera automatiquement :
- **Android 13+** : Permission "Appareils Wi-Fi à proximité" (`NEARBY_WIFI_DEVICES`)
- **Android ≤12** : Permission "Localisation" (`ACCESS_FINE_LOCATION`)

Si l'utilisateur refuse, le bouton Cast restera visible mais la découverte d'appareils sera impossible.

## Tester avec Android Auto DHU

1. Installez le DHU depuis le SDK Manager Android Studio
2. Activez le mode développeur dans l'app Android Auto sur votre appareil
3. Lancez le DHU : `$ANDROID_HOME/extras/google/auto/desktop-head-unit`
4. RadioSphere devrait apparaître dans la liste des apps media

## Architecture

```
WebView (Capacitor)          ──sync──>   SharedPreferences
  └── FavoritesContext                      │
  └── PlayerContext                         ▼
                                     RadioBrowserService
                                       ├── Favoris
                                       ├── Récents
                                       ├── Genres (API radio-browser.info)
                                       ├── Recherche vocale
                                       └── ExoPlayer (lecture audio native)
```

## Notes

- La lecture audio sur Android Auto utilise **ExoPlayer nativement** (pas le WebView) pour une stabilité maximale en conduite
- Les favoris sont synchronisés du web → natif à chaque modification
- La recherche vocale interroge directement l'API radio-browser.info depuis le service natif
- L'artwork est affiché en plein écran sur Android Auto, avec fallback sur un placeholder si absent
- Next/Previous naviguent dans la liste courante (favoris, récents, ou résultats de recherche)
