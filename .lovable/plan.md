# Plan d'implementation : Chromecast, correctifs MiniPlayer et Android Auto

## 1. Corriger le MiniPlayer cache par la BottomNav

**Probleme** : La `BottomNav` est en `fixed bottom-0`, mais le `MiniPlayer` est positionne en flux normal juste avant elle. Sur l'APK Android, le MiniPlayer est masque sous la barre de navigation fixe.

**Solution** : Rendre le MiniPlayer egalement `fixed`, positionne juste au-dessus de la BottomNav. Ajuster le padding du contenu en consequence.

**Fichiers modifies** :

- `src/components/MiniPlayer.tsx` : ajouter `fixed bottom-[env(safe-area-inset-bottom)] left-0 right-0 z-30` et un `bottom` calcule pour se placer au-dessus de la BottomNav (~56px)
- `src/pages/Index.tsx` : augmenter le `pb-14` en `pb-28` quand un MiniPlayer est visible (via le contexte Player), pour laisser la place aux deux barres fixes

---

## 2. Integration Google Cast (Chromecast)

### 2a. Hook `src/hooks/useCast.ts`

Nouveau fichier. Charge dynamiquement le SDK Cast Sender (`cast_sender.js?loadCastFramework=1`). Configure le `CastContext` avec l'Application ID `65257ADB`.

Expose :

- `isCastAvailable` : true si un appareil Cast est detecte sur le reseau
- `isCasting` : true si connecte
- `castDeviceName` : nom de l'appareil
- `startCast()` : ouvre le picker
- `stopCast()` : deconnecte
- `loadMedia(station)` : envoie le flux au Chromecast avec `contentId` (streamUrl), `metadata` (titre, favicon URL), et `customData` (tags pour le genre)

### 2b. Bouton Cast `src/components/CastButton.tsx`

Nouveau composant. Icone Cast (lucide `Cast`). Rendu uniquement si `isCastAvailable === true`. Quand connecte, icone en couleur primaire. Clic : toggle connect/disconnect.

### 2c. Integration dans le PlayerContext

`**src/contexts/PlayerContext.tsx**` :

- Importer et utiliser `useCast`
- Quand `play(station)` est appele et que `isCasting` est true : appeler `loadMedia(station)` en plus de la lecture locale
- Quand `togglePlay()` en mode cast : envoyer play/pause au Chromecast via le `RemotePlayer`
- Exposer `isCasting` et `castDeviceName` dans le contexte

### 2d. UI - HomePage et FullScreenPlayer

`**src/pages/HomePage.tsx**` : Ajouter `CastButton` dans le header, a droite du titre "Radio Sphere"

`**src/components/FullScreenPlayer.tsx**` : Ajouter `CastButton` dans le header, entre le bouton "www" et le bouton partage. Afficher un badge "Casting vers [appareil]" quand actif.

### 2e. MiniPlayer

`**src/components/MiniPlayer.tsx**` : Quand `isCasting`, afficher une petite icone Cast + nom de l'appareil

### 2f. Traductions

`**src/i18n/translations.ts**` : Ajouter les cles `cast.castingTo`, `cast.controlFromPhone`, `cast.connected`, `cast.disconnected` dans les 5 langues.

### 2g. Donnees envoyees au receiver

Le sender envoie au receiver via les metadonnees Cast :

- `title` : nom de la station
- `images[0].url` : URL du favicon de la station (ou placeholder)
- `customData.tags` : les tags de la station (pour que le receiver detecte le genre et affiche l'animation correspondante)

---

## 3. Receiver Cast (`public/cast-receiver.html`)

Reecriture complete du fichier. Page HTML standalone (pas React) qui tourne sur le Chromecast. Utilise le Cast Web Receiver SDK v3.

**Design** :

- Fond sombre (#0a0a1a) avec degradee bleu/violet aux couleurs du theme Radio Sphere
- **En haut** : Logo anime RadioSphere (SVG inspire de `RadioSphereLogo.tsx`) + texte "Radio Sphere"
- **Au centre** : Grande animation SVG (~250px) correspondant au genre detecte dans les tags. Les 24 genres sont reproduits en SVG anime standalone (adaptes de `GenreAnimations.tsx`). Si aucun genre reconnu : animation ondes radio generique.
- **Sous l'animation** : Nom de la station en grand, gradient bleu-violet. Tags en dessous (pas de pays).
- **En bas** : Mini-lecteur avec petite icone station (favicon), nom, barres equaliseur animees
- **Tout en bas** : Mention discrete "Controlez la lecture depuis votre telephone" en 5 langues (detectee via `customData.lang` ou defaut FR)

Polices chargees via Google Fonts : Inter + Poppins.

---

## 4. Audit Android Auto : stations qui "tournent dans le vide"

**Probleme identifie** : Le `RadioBrowserService.java` utilise ExoPlayer pour la lecture native independante du WebView. Quand on selectionne une station dans Android Auto, `playStation()` est appele, qui configure ExoPlayer avec l'URL du stream. Cependant, le probleme potentiel est que certains streams radio utilisent des redirections HTTP ou des URLs `http://` (non HTTPS) qui peuvent etre bloquees par la politique de securite reseau d'Android.

**Actions correctives prevues** :

- Verifier que `playStation()` dans `RadioBrowserService.java` gere correctement les redirections HTTP et le mixed content (http/https). Ajouter `player.setMediaItem(MediaItem.fromUri(...))` avec les headers adequats si necessaire.
- S'assurer que le `network_security_config.xml` autorise le cleartext traffic pour les streams radio (beaucoup de stations n'ont pas de HTTPS)
- Ajouter un fichier `android-auto/network_security_config.xml` avec `cleartextTrafficPermitted="true"` et documenter son ajout dans le `AndroidManifest.xml`
- Ajouter un log dans `playerListener.onPlaybackStateChanged` pour diagnostiquer les cas ou le stream reste en buffering indefiniment

---

EDIT : auditer le fichier ps1 pour vérifier que tout est en place et en ordre pour android auto et chrome cast + fonctionnalités de base.  

## ✅ IMPLEMENTÉ

Tous les fichiers ci-dessus ont été créés/modifiés. Cast SDK configuré avec App ID `65257ADB`.
MiniPlayer fixé au-dessus de la BottomNav. Android Auto : logs de debug ajoutés + network_security_config.xml créé.
Cast receiver HTML complet avec les 24 animations SVG de genres.
