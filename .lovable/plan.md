
# Plan v2.2.7c — Bouton scroll-up translucide + Android Auto detection et navigation

## 1. Bouton scroll-to-top : rendre translucide

Modification CSS simple dans `SearchPage.tsx` : remplacer `bg-primary` par `bg-primary/70 backdrop-blur-sm` pour un effet translucide elegant.

## 2. Android Auto : probleme de detection

**Diagnostic** : Le `MediaBrowserService` est un service Android standard. Pour qu'Android Auto le detecte, il faut que :
- Le service soit declare correctement dans le manifest (OK)
- Le `automotive_app_desc.xml` soit present (OK)
- Le service puisse demarrer independamment du WebView

**Probleme identifie** : Le service est correctement declare, mais Android Auto peut avoir du mal a le decouvrir si :
1. L'app a ete mise a jour sans que le cache AA soit rafraichi
2. Le `MediaSessionCompat` n'a pas les bons flags au demarrage

**Corrections** :
- Ajouter `mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS)` dans `onCreate()` — ces flags sont requis pour qu'AA reconnaisse le service comme un lecteur media
- Ajouter `android:enabled="true"` au service dans le manifest pour garantir la decouverte
- Ajouter un `PlaybackState` initial dans `onCreate()` avec les actions supportees — AA verifie cela a la connexion pour determiner si le service est fonctionnel

## 3. Android Auto : browse tree vide (favoris, recents, recherche)

**Diagnostic** : `onLoadChildren` lit les SharedPreferences remplies par le WebView via `RadioAutoPlugin.syncFavorites()`. Si l'app est ouverte mais que le WebView n'a pas encore synchro les donnees (ou si les favoris sont vides), la liste est vide.

**Corrections** :
- Dans `onLoadChildren` pour `FAVORITES_ID` et `RECENTS_ID` : si la liste est vide, afficher un message "Aucun favori" / "Aucun recent" comme item non-jouable au lieu d'une liste vide (meilleure UX)
- Dans la recherche (`onSearch`), s'assurer que les resultats sont aussi cherches par tag en plus du nom (ajout d'un 2e appel API par tag, fusion des resultats, comme dans le WebView)

---

## Resume des fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/pages/SearchPage.tsx` | Bouton scroll-up translucide (`bg-primary/70 backdrop-blur-sm`) |
| `android-auto/RadioBrowserService.java` | Ajout flags MediaSession, PlaybackState initial dans onCreate, message "vide" dans browse tree, recherche par tag dans onSearch |
| `radiosphere_v2_2_6.ps1` | Mise a jour du here-string RadioBrowserService.java embarque avec les memes corrections |
| `android-auto/AndroidManifest-snippet.xml` | Ajout `android:enabled="true"` sur le service |

## Detail technique

### RadioBrowserService.java — onCreate()
```java
// Ajout des flags obligatoires pour Android Auto
mediaSession.setFlags(
    MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
    MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
);

// Etat initial — AA verifie cela a la connexion
updatePlaybackState(PlaybackStateCompat.STATE_NONE);
```

### RadioBrowserService.java — onLoadChildren() ameliore
Si favoris ou recents sont vides, ajouter un item "placeholder" non-jouable pour indiquer a l'utilisateur que la categorie est vide (au lieu d'afficher rien).

### RadioBrowserService.java — onSearch() ameliore
Rechercher par nom ET par tag (comme le WebView), fusionner et dedupliquer les resultats.

### Manifest — service declaration
```xml
<service
    android:name=".RadioBrowserService"
    android:exported="true"
    android:enabled="true">
```
