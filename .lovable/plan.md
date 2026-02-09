

# Correction critique pour le Background Audio dans l'APK Capacitor

## Probleme
L'audio coupe dans l'APK car la WebView Android gele l'objet Audio quand l'app passe en arriere-plan. Le navigateur Firefox fonctionne car il gere nativement le Media Session, mais la WebView Capacitor necessite des ajustements specifiques.

## Modifications prevues

### 1. Audio global (hors cycle de vie React)
Deplacer la creation de l'objet `Audio` en dehors du composant `PlayerProvider`, au niveau du module. Cela garantit qu'il ne sera jamais detruit par un re-render ou un demontage du composant.

```typescript
// Cree une seule fois au niveau du module
const globalAudio = new Audio();
(globalAudio as any).playsInline = true;
globalAudio.preload = "auto";
```

### 2. MediaSession playbackState explicite apres play()
Apres chaque appel `audio.play()`, forcer explicitement `navigator.mediaSession.playbackState = 'playing'` pour que la WebView Android detecte l'app comme un lecteur media actif.

### 3. Hack anti-freeze : ne jamais pauser lors de visibilitychange/blur
Modifier le gestionnaire `visibilitychange` pour ne pas seulement reprendre quand l'app redevient visible, mais aussi empecher toute pause automatique quand elle passe en arriere-plan. Ajouter egalement un gestionnaire `blur` pour le meme effet.

### 4. Vibration de test au clic Play
Ajouter `navigator.vibrate(10)` dans la fonction `play()` pour verifier que les APIs natives sont accessibles dans l'APK.

### 5. Demande de permissions au demarrage
Deplacer la demande de permission de notification au montage du `PlayerProvider` (et non au premier play) pour qu'elle apparaisse des le lancement de l'app. Cela permet a Android de savoir que l'app a besoin d'afficher des notifications (prerequis pour le background audio).

## Details techniques

**Fichier modifie** : `src/contexts/PlayerContext.tsx`

Changements concrets :
- L'objet `Audio` est cree comme constante de module (`const globalAudio = new Audio()`) au lieu d'etre dans un `useEffect`
- `audioRef` pointe vers cet objet global
- Le gestionnaire `visibilitychange` re-appelle `audio.play()` dans tous les cas quand `isPlayingRef.current` est vrai (pas de pause automatique)
- Un gestionnaire `blur` est ajoute avec la meme logique
- `navigator.mediaSession.playbackState = 'playing'` est appele explicitement apres chaque `audio.play().then()`
- `navigator.vibrate(10)` est ajoute dans `play()` pour le test natif
- `requestNotificationPermission()` est appele dans un `useEffect` au montage (demarrage de l'app)

