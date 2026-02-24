# Android Auto - Integration RadioSphere

## Vue d'ensemble

L'integration Android Auto necessite du code natif Android (Kotlin) qui fonctionne en dehors du WebView. L'architecture repose sur deux piliers :

1. **Un plugin Capacitor** cote web qui synchronise les donnees (favoris, recents) vers le stockage natif Android (SharedPreferences)
2. **Un service natif Android** (`MediaBrowserServiceCompat`) qui expose l'arbre de navigation et gere la lecture audio directement sur Android Auto

## Architecture

```text
+---------------------------+          +----------------------------------+
|   WebView (Capacitor)     |          |   Android Auto                   |
|                           |          |                                  |
|  Favoris (localStorage)   |--sync--> |  SharedPreferences               |
|  Recents (localStorage)   |          |       |                          |
|  PlayerContext             |          |       v                          |
|                           |          |  MediaBrowserService             |
+---------------------------+          |    - Favoris                     |
                                       |    - Recents                     |
                                       |    - Recherche (vocale)          |
                                       |    - Genres                      |
                                       |       |                          |
                                       |       v                          |
                                       |  MediaSession (lecture audio)    |
                                       |    - Play / Pause               |
                                       |    - Next (favoris)             |
                                       |    - Artwork plein ecran        |
                                       +----------------------------------+
```

## Ecran Android Auto

Le player AA affichera :

- **Artwork en grand** (comme le FullScreenPlayer) - Remarque : Si l'artwork n'est pas suffisemment de bonne qualité, il faudrait trouver une alternative, peut-être placer le logo de l'app ou bien l'image par défaut (quand il n'y a pas d'artwork).
- **Nom de la station** + sous-titre (tags/pays)
- **Play/Pause**
- **Next** : station suivante dans les favoris
- **Previous** : station precedente dans les favoris

L'arbre de navigation (browse tree) proposera :

- **Favoris** : liste des stations favorites
- **Recents** : 20 dernieres stations ecoutees
- **Genres** : les 24 genres disponibles, chacun chargeant les stations populaires
- **Recherche vocale** : recherche de stations par nom via la commande vocale AA

## Etapes d'implementation

### Etape 1 : Plugin Capacitor "RadioAutoPlugin" (cote TypeScript)

**Nouveaux fichiers :**

- `src/plugins/RadioAutoPlugin.ts` : interface TypeScript du plugin avec les methodes :
  - `syncFavorites(stations: RadioStation[])` : envoie les favoris vers SharedPreferences
  - `syncRecents(stations: RadioStation[])` : envoie les recents vers SharedPreferences
  - `notifyPlaybackState(state: { stationId, name, logo, isPlaying })` : met a jour la MediaSession native

**Modification :**

- `src/contexts/FavoritesContext.tsx` : appeler `syncFavorites()` et `syncRecents()` a chaque changement pour maintenir les donnees synchronisees avec le natif
- `src/contexts/PlayerContext.tsx` : appeler `notifyPlaybackState()` lors de chaque changement d'etat de lecture

### Etape 2 : Fichiers natifs Android (a copier apres `npx cap add android`)

Ces fichiers seront crees dans un dossier `android-auto/` a la racine du projet. L'utilisateur devra les copier dans le projet Android apres initialisation.

**Fichiers a creer :**

1. `android-auto/RadioBrowserService.kt`
  - Extends `MediaBrowserServiceCompat`
  - Lit les favoris/recents depuis SharedPreferences
  - Construit l'arbre de navigation (root -> Favoris, Recents, Genres)
  - Implemente `onSearch()` pour la recherche vocale (appelle l'API radio-browser.info directement)
  - Gere `onLoadChildren()` pour charger les stations par genre via l'API
  - Cree la `MediaSessionCompat` avec les callbacks play/pause/next/previous
2. `android-auto/RadioPlaybackService.kt`
  - Service de lecture audio utilisant `ExoPlayer` (lecteur audio natif Android)
  - Gere le flux audio independamment du WebView
  - Met a jour les metadonnees MediaSession (artwork, titre) a chaque changement de station
  - Gere next/previous en naviguant dans la liste des favoris
3. `android-auto/res/xml/automotive_app_desc.xml`
  - Declaration des capacites Android Auto (media browsing, search)
4. `android-auto/AndroidManifest-snippet.xml`
  - Extraits a ajouter au AndroidManifest : declaration du service, intent-filters, meta-data pour Android Auto

### Etape 3 : Configuration et instructions

**Modification :**

- `capacitor.config.ts` (si present) ou creation : ajout de la config du plugin
- Mise a jour du README avec les instructions detaillees pour :
  1. Copier les fichiers natifs
  2. Ajouter les dependances Gradle (ExoPlayer, media-compat)
  3. Modifier le AndroidManifest.xml
  4. Tester sur un emulateur Android Auto (DHU - Desktop Head Unit)

## Fonctionnalite Recherche (le "wow factor" premium)

La recherche Android Auto fonctionne via commande vocale. Quand l'utilisateur dit "Cherche Jazz Radio" :

1. Android Auto appelle `onSearch("Jazz Radio")` sur le service
2. Le service fait une requete HTTP directe a l'API radio-browser.info (pas via le WebView)
3. Les resultats sont affiches comme une liste de MediaItems navigables
4. L'utilisateur selectionne une station et la lecture demarre immediatement

## Limitations et notes importantes

- Android Auto necessite un **appareil Android physique** ou le **Desktop Head Unit (DHU)** pour les tests
- Le code natif Kotlin ne peut pas etre teste depuis Lovable directement, il faut un environnement Android Studio
- La lecture audio sur AA utilise ExoPlayer nativement (pas le WebView), ce qui garantit la stabilite en conduite
- Les favoris sont synchronises du web vers le natif (sens unique) a chaque modification

## Resume des fichiers


| Fichier                                        | Action                                     |
| ---------------------------------------------- | ------------------------------------------ |
| `src/plugins/RadioAutoPlugin.ts`               | Creer - Plugin Capacitor TypeScript        |
| `src/contexts/FavoritesContext.tsx`            | Modifier - Sync favoris/recents vers natif |
| `src/contexts/PlayerContext.tsx`               | Modifier - Sync etat de lecture vers natif |
| `android-auto/RadioBrowserService.kt`          | Creer - Service de navigation AA           |
| `android-auto/RadioPlaybackService.kt`         | Creer - Service de lecture audio natif     |
| `android-auto/res/xml/automotive_app_desc.xml` | Creer - Config AA                          |
| `android-auto/AndroidManifest-snippet.xml`     | Creer - Extraits manifest                  |
| `android-auto/README-SETUP.md`                 | Creer - Instructions d'installation        |
