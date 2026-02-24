# RadioSphere — Android Auto Setup Guide

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
}
```

## Étape 2 : Copier les fichiers natifs

Copiez les fichiers suivants dans votre projet Android :

```
android-auto/RadioBrowserService.kt  →  android/app/src/main/java/app/lovable/radiosphere/RadioBrowserService.kt
android-auto/RadioAutoPlugin.kt      →  android/app/src/main/java/app/lovable/radiosphere/RadioAutoPlugin.kt
android-auto/res/xml/automotive_app_desc.xml  →  android/app/src/main/res/xml/automotive_app_desc.xml
```

## Étape 3 : Modifier AndroidManifest.xml

Ouvrez `android/app/src/main/AndroidManifest.xml` et ajoutez à l'intérieur de la balise `<application>` les éléments décrits dans `AndroidManifest-snippet.xml` :

```xml
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
```

## Étape 4 : Enregistrer le plugin Capacitor

Dans `android/app/src/main/java/app/lovable/radiosphere/MainActivity.kt`, ajoutez :

```kotlin
import app.lovable.radiosphere.RadioAutoPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(RadioAutoPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

## Étape 5 : Icône de notification

Placez une icône pour la notification dans :
```
android/app/src/main/res/drawable/ic_notification.xml
```

Vous pouvez utiliser une icône vectorielle simple (ex: un symbole radio/play).

## Étape 6 : Build & Test

```bash
# Sync les fichiers web
npx cap sync android

# Ouvrir dans Android Studio
npx cap open android

# Compiler et lancer sur appareil/émulateur
```

### Tester avec Android Auto DHU (Desktop Head Unit)

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
