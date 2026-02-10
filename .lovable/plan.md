

# Fix : Boutons Play/Pause sur la notification + Icone personnalisee + Ecran de verrouillage

## Problemes identifies

1. **Pas de boutons play/pause** sur la notification : le plugin `@capawesome-team/capacitor-android-foreground-service` supporte une propriete `buttons` pour afficher des boutons sur Android SDK 24+
2. **Icone par defaut** : `smallIcon` reference un drawable Android. Il faut fournir l'icone correcte dans le projet natif
3. **Ecran de verrouillage** : le MediaSession API est deja configure avec metadata et artwork. Avec le foreground service `mediaPlayback` actif, Android devrait afficher les controles sur le lock screen. Il faut s'assurer que le `playbackState` est toujours synchronise

## Changements cote Lovable

### Fichier : `src/contexts/PlayerContext.tsx`

**1. Ajouter des boutons a la notification du foreground service**

Le plugin supporte `buttons: NotificationButton[]` sur Android SDK 24+. On ajoutera un bouton "Pause" quand la lecture est active et "Play" quand elle est en pause.

```typescript
await ForegroundService.startForegroundService({
  id: 1,
  title: station.name,
  body: station.country || 'Radio Sphere',
  smallIcon: 'ic_notification',
  serviceType: 2,
  buttons: [
    { title: 'Pause', id: 1 }
  ],
} as any);
```

**2. Ecouter les clics sur les boutons**

Ajouter un listener `buttonClicked` dans le `useEffect` des MediaSession handlers pour synchroniser play/pause depuis la notification.

**3. Mettre a jour la notification quand l'etat change**

Utiliser `ForegroundService.updateForegroundService()` pour changer le titre du bouton entre "Play" et "Pause" selon l'etat actuel.

## Instructions pour le script PowerShell (icone personnalisee)

Pour utiliser le logo Radio Sphere comme icone de notification, il faut generer les drawables Android a partir de l'image. Ajouter dans ton script, apres `npx cap add android` :

```powershell
# Telecharger et installer l'icone de notification
# L'icone doit etre monochrome (blanc sur transparent) pour les notifications Android
$sizes = @{
    "mdpi" = 24
    "hdpi" = 36
    "xhdpi" = 48
    "xxhdpi" = 72
    "xxxhdpi" = 96
}
foreach ($density in $sizes.Keys) {
    $dir = "android/app/src/main/res/drawable-$density"
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }
    # Copier l'icone launcher comme fallback (idealement utiliser une version monochrome)
    Copy-Item "android/app/src/main/res/mipmap-$density/ic_launcher_foreground.png" "$dir/ic_notification.png" -ErrorAction SilentlyContinue
}
```

Note : pour une icone de notification parfaite sur Android, il faudrait une image **monochrome blanche sur fond transparent** (c'est une contrainte Android). L'icone launcher en fallback fonctionnera mais pourrait apparaitre comme un carre blanc sur certains appareils. Pour un rendu optimal, genere un asset monochrome dans Android Studio (clic droit sur `res` > New > Image Asset > type "Notification").

## Ecran de verrouillage

L'ecran de verrouillage utilise automatiquement les donnees du `MediaSession` API quand :
- Un foreground service de type `mediaPlayback` est actif (deja fait)
- `navigator.mediaSession.metadata` contient artwork en HTTPS (deja fait)
- `navigator.mediaSession.playbackState` est "playing" (deja fait)
- Les handlers `play` et `pause` sont enregistres (deja fait)

Cela devrait deja fonctionner. Si ce n'est pas le cas, c'est probablement parce que la notification du plugin "ecrase" visuellement celle du MediaSession. La solution est de s'assurer que les deux coexistent correctement, ce qui est le cas avec `serviceType: 2` (mediaPlayback).

## Resume

| Fichier | Modification |
|---|---|
| `src/contexts/PlayerContext.tsx` | Ajout `buttons` au foreground service, listener `buttonClicked`, et `updateForegroundService` pour toggle |

| Script PowerShell | Modification |
|---|---|
| Section post-`cap add` | Copier les drawables `ic_notification.png` dans chaque densite |

