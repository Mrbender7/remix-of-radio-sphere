

# Fix : Son de notification lors du changement de station

## Cause
Quand on change de station, la fonction `play()` appelle `stopNativeForegroundService()` (ligne 300) puis `startNativeForegroundService()` (ligne 318). Ce cycle arret/redemarrage detruit et recree la notification a chaque fois, ce qui declenche le son associe au canal.

## Solution
Ne pas arreter le foreground service lors d'un changement de station. A la place, utiliser `updateNativeForegroundService()` pour mettre a jour le titre/contenu de la notification existante sans la recréer.

## Modifications dans `src/contexts/PlayerContext.tsx`

### 1. Ajouter un flag pour savoir si le service tourne deja
Un simple booleen (`foregroundServiceRunning`) permet de savoir si on doit faire un `start` ou un `update`.

### 2. Modifier la fonction `play()`
- **Supprimer** l'appel a `stopNativeForegroundService()` (ligne 300) lors du changement de station
- Dans le callback `canplay` (ligne 318), remplacer l'appel `startNativeForegroundService` par une logique conditionnelle :
  - Si le service tourne deja : appeler `updateNativeForegroundService(station, false)` 
  - Sinon : appeler `startNativeForegroundService(station, false)`

### 3. Mettre a jour le flag
- Le passer a `true` apres un `start` reussi
- Le passer a `false` apres un `stop`

## Detail technique

```text
Avant (provoque un son a chaque changement) :
  play() -> stop service -> ... -> start service (nouvelle notification = son)

Apres (silencieux) :
  play() -> ... -> update service (meme notification, juste le texte change)
```

Aucun autre fichier n'est impacte. Le script PowerShell reste inchange.
