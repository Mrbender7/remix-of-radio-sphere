

## Plan : Enregistrement continu seek-back → live (sans coupure)

### Problème actuel
Quand l'utilisateur recule dans le temps et lance un enregistrement, la lecture du blob se termine quand le contenu pré-bufferisé est épuisé. Le handler `handleBlobEnded` retourne au direct, coupant l'enregistrement. L'utilisateur perd la fin de la chanson.

### Solution
Le buffer circulaire continue de capturer le flux live en arrière-plan, même pendant la lecture du blob seek-back. L'enregistrement peut donc couvrir **du contenu passé + du contenu live arrivé depuis**.

Quand le blob de seek-back se termine naturellement **pendant un enregistrement actif** :
1. Ne PAS stopper l'enregistrement
2. Retourner au direct (restaurer `globalAudio.src` sur le stream live)
3. L'enregistrement continue de capturer les chunks live qui arrivent
4. L'utilisateur stoppe manuellement quand il veut → `stopRecording()` collecte tous les chunks depuis `recordingStartIdx` jusqu'au dernier chunk live

Comme le buffer circulaire n'a jamais cessé de recevoir les chunks du fetch parallèle, les données sont contiguës : chunks passés + chunks arrivés pendant le seek-back + chunks live après retour = un seul fichier audio sans coupure.

### Fichier à modifier

**`src/contexts/StreamBufferContext.tsx`**

- `handleBlobEnded` (ligne 546-551) : si `isRecording === true`, appeler `returnToLiveInternal()` sans stopper l'enregistrement, et afficher un toast informatif ("Retour au direct, enregistrement en cours...")
- `startRecording` (ligne 356-396) : quand on démarre l'enregistrement pendant un seek-back, positionner `recordingStartIdxRef` sur le chunk correspondant à la position de seek actuelle (pas le dernier chunk), pour capturer depuis le point de recul
- `stopRecording` (ligne 398-447) : aucun changement nécessaire — il collecte déjà `chunks.slice(startIdx)` qui inclura naturellement tous les chunks jusqu'au moment du stop

### Détail du changement startRecording

Actuellement : `recordingStartIdxRef.current = chunksRef.current.length - 1` (dernier chunk = "maintenant")

Nouveau : si `!isLive` (en seek-back), calculer l'index du chunk correspondant à `currentSeekOffsetSeconds` en arrière depuis la fin du buffer, pour que l'enregistrement démarre au point de seek.

### Résumé des modifications

| Changement | Détail |
|---|---|
| `handleBlobEnded` | Si `isRecording`, retour au direct sans stopper l'enregistrement |
| `startRecording` | En seek-back, positionner le start index au chunk de la position seek actuelle |
| Toast UX | Informer l'utilisateur que l'enregistrement continue après retour au direct |

