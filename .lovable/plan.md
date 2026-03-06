

## Plan : Unification Android Auto + Nettoyage MediaPlaybackService

### Probleme actuel

Deux services media coexistent :
- `RadioBrowserService` (MediaBrowserServiceCompat) — pour Android Auto, avec ExoPlayer
- `MediaPlaybackService` (Service) — pour la notification lockscreen, miroir du WebView

Deux MediaSessions distinctes (`RadioSphereSession` + `RadioSphereNotif`) peuvent confondre le systeme Android sur le routage media. Le Manifest declare les deux, ce qui peut poser des conflits de detection.

### Architecture cible

**Un seul service media : `RadioBrowserService`**, qui fonctionne en deux modes :
1. **Mode Android Auto** : Browse tree + ExoPlayer natif (inchange)
2. **Mode Notification** : Recoit les updates de `RadioAutoPlugin` via Intent, met a jour sa MediaSession et affiche une notification MediaStyle (remplace MediaPlaybackService)

### Modifications

#### 1. PS1 — Manifest (`radiosphere_v2_5_0.ps1`, section 4)
- Ajouter `android:appCategory="audio"` dans `<application>`
- **Supprimer** la declaration de `MediaPlaybackService` et son `<receiver>` `MediaToggleReceiver` du bloc `$ServiceDecl`
- Conserver uniquement `RadioBrowserService` + les meta-data existantes
- Ajouter le receiver `MediaToggleReceiver` rattache a `RadioBrowserService` (meme action `TOGGLE_PLAYBACK`)

#### 2. RadioBrowserService.java — Ajout mode notification miroir
- Ajouter les constantes `ACTION_UPDATE`, `ACTION_STOP`, `BROADCAST_TOGGLE`
- Ajouter `onStartCommand()` : recoit les intents de RadioAutoPlugin avec `station_name`, `station_logo`, `is_playing`
  - Met a jour la MediaSession existante (metadata + playback state)
  - Affiche/met a jour la notification MediaStyle avec le token de la meme session
  - Gere l'artwork : si logo vide → `android.resource://...drawable/station_placeholder`
  - Telecharge le bitmap en arriere-plan si URL changee
- La notification toggle envoie le broadcast `BROADCAST_TOGGLE` (capte par MediaToggleReceiver)

#### 3. RadioAutoPlugin.java — Pointer vers RadioBrowserService
- Remplacer `MediaPlaybackService.class` par `RadioBrowserService.class` dans `notifyPlaybackState()`
- Remplacer `MediaPlaybackService.ACTION_UPDATE` par `RadioBrowserService.ACTION_UPDATE`
- Remplacer `MediaPlaybackService.class` par `RadioBrowserService.class` dans `clearAppData()`

#### 4. PS1 — Suppression generation MediaPlaybackService
- **Supprimer** le bloc de generation de `MediaPlaybackService.java` (lignes ~415-567)
- **Mettre a jour** les templates inline de `RadioBrowserService.java` et `RadioAutoPlugin.java` avec les changements ci-dessus
- Conserver `MediaToggleReceiver.java` (inchange, il appelle `RadioAutoPlugin.getActiveInstance()`)

#### 5. PS1 — MainActivity
- Supprimer la creation du canal `radio_playback_v3` (plus necessaire, RadioBrowserService cree son propre canal `radio_auto_playback`)
- Ou mieux : garder un seul canal unifie `radio_auto_playback` pour tout

#### 6. CastPlugin / CastOptionsProvider — Verification (pas de changement)
- Deja correct : `DEFAULT_MEDIA_RECEIVER_APPLICATION_ID`, listeners `castStateChanged`/`localAudioControl`

#### 7. PlayerContext.tsx — Verification (pas de changement)
- Deja correct : logique `isCasting` → `castLoadMedia()` vs audio local
- Artwork placeholder deja en place via `stationPlaceholder` import

#### 8. StationCard.tsx — Verification (pas de changement)
- Deja correct : utilise `station-placeholder.png` comme fallback

### Fichiers modifies

| Fichier | Action |
|---------|--------|
| `radiosphere_v2_5_0.ps1` | Manifest + suppression MediaPlaybackService + MAJ templates inline |
| `android-auto/RadioBrowserService.java` | Ajout onStartCommand + mode notification miroir |
| `android-auto/MediaPlaybackService.java` | **Suppression du fichier** |

### Ce qui ne change pas
- `CastPlugin.java`, `CastOptionsProvider.java` — deja corrects
- `PlayerContext.tsx`, `useCast.ts` — logique Cast deja en place
- `StationCard.tsx` — placeholder deja gere
- Browse tree, ExoPlayer, audio focus, stream resolution
- `MediaToggleReceiver.java` — inchange (appelle RadioAutoPlugin)

