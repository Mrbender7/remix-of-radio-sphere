

## Plan : Unification Android Auto + Nettoyage MediaPlaybackService — TERMINÉ ✅

### Architecture finale

**Un seul service media : `RadioBrowserService`**, qui fonctionne en deux modes :
1. **Mode Android Auto** : Browse tree + ExoPlayer natif (inchangé)
2. **Mode Notification (Mirror)** : Reçoit les updates de `RadioAutoPlugin` via Intent `ACTION_UPDATE`, met à jour sa MediaSession unique et affiche une notification MediaStyle unifiée

### v2.5.2 — Corrections favoris + navigation Android Auto

| Correction | Détail |
|-----------|--------|
| **onPlayFromMediaId** | Fallback en 4 étapes : currentStations → favorites → recents → API (fetchStationByUuid) |
| **updateFavorites/updateRecents** | Méthodes statiques appelées par RadioAutoPlugin pour rafraîchir le browse tree en temps réel via `notifyChildrenChanged()` |
| **fetchStationByUuid** | Nouvelle méthode pour récupérer une station par UUID depuis l'API radio-browser |
| **buildBrowsableItem** | Ajout d'une icône placeholder pour les dossiers (pas de trou visuel) |
| **Ordre des dossiers** | Top Stations → Mes Favoris → Récents |
| **activeInstance** | Set dans onCreate, cleared dans onDestroy pour le pattern static |

### Changements effectués

| Fichier | Action |
|---------|--------|
| `android-auto/RadioBrowserService.java` | v2.5.2: onPlayFromMediaId fallback, updateFavorites/updateRecents static, fetchStationByUuid, folder icons |
| `android-auto/RadioAutoPlugin.java` | v2.5.2: Appelle RadioBrowserService.updateFavorites/updateRecents après sync |
| `android-auto/AndroidManifest-snippet.xml` | v2.5.2: Nettoyé, MediaPlaybackService supprimé |
| `radiosphere_v2_5_0.ps1` | Templates inline mis à jour v2.5.2 |
| `android-auto/MediaPlaybackService.java` | **Supprimé** (v2.5.1) |

### Ce qui n'a pas changé
- `CastPlugin.java`, `CastOptionsProvider.java` — déjà corrects
- `PlayerContext.tsx`, `useCast.ts` — logique Cast déjà en place
- `StationCard.tsx` — placeholder déjà géré
- `MediaToggleReceiver.java` — inchangé (appelle RadioAutoPlugin)
- Browse tree, ExoPlayer, audio focus, stream resolution
