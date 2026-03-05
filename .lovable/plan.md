

## Plan : Remplacer fetch/proxy par MediaRecorder sur captureStream()

### Principe

Au lieu de fetcher les chunks audio bruts via `fetch()` + `corsproxy.io`, on capture l'audio déjà décodé par le navigateur via `globalAudio.captureStream()` + `MediaRecorder`. Les chunks WebM/Opus produits alimentent le même buffer circulaire (`chunksRef`). Toute la logique aval (seek-back, enregistrement continu, transition seek→live) reste identique.

### Modifications dans `src/contexts/StreamBufferContext.tsx`

**Supprimer :**
- La classe `IcyStripper` (lignes 77-146)
- Les fonctions `fetchWithCorsFallback` et `startFetch` (lignes 232-325)
- La fonction `stopFetch` et `fetchControllerRef` (lignes 203-208)
- Les refs inutiles : `fetchControllerRef`, `fetchStartTimeRef`, `icyStripperRef`, `waitingMetaLengthRef`
- Les constantes `INITIAL_SKIP_MS`, `CODEC_TO_MIME`, `getMimeFromCodec`
- Le nettoyage de `icyStripperRef` / `waitingMetaLengthRef` dans `clearBuffer`

**Ajouter : nouvelle fonction `startCapture()`**
- Appelée quand `isPlaying` passe à `true` et qu'une station est active
- Obtient le stream via `globalAudio.captureStream?.() || globalAudio.mozCaptureStream?.()`
- Si indisponible : toast warning + `bufferAvailable = false`, la lecture continue normalement
- Crée un `MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })` avec `timeslice: 1000ms`
- Dans `ondataavailable` : convertit le `Blob` en `Uint8Array` via `arrayBuffer()`, puis push dans `chunksRef` avec le même format `TimestampedChunk { data, time, byteOffset }`
- Appelle `trimBuffer()` et `updateBufferSeconds()` après chaque chunk
- Met `bufferAvailable = true` dès le premier chunk reçu

**Ajouter : fonction `stopCapture()`**
- Stoppe le MediaRecorder s'il est actif
- Appelée lors du changement de station ou quand `isPlaying` passe à `false`

**Modifier le useEffect station/playing (lignes 328-345) :**
- Remplacer `startFetch(streamUrl)` par `startCapture()`
- Remplacer `stopFetch()` par `stopCapture()`
- Écouter l'événement `'playing'` sur `globalAudio` pour démarrer la capture (le stream n'est disponible qu'après le début de la lecture)

**Fixer le MIME type :**
- `streamMimeTypeRef.current` = `'audio/webm'` (fixe, car MediaRecorder produit du WebM)
- L'export produira des fichiers `.webm` — le format est universel et lisible partout

**Conserver sans modification :**
- `startRecording` avec la logique seek-back index
- `stopRecording` avec `chunks.slice(startIdx)` — le path "buffer chunks" est utilisé (pas le path "usingMediaRecorder")
- `seekBack` — construit un blob depuis `chunksRef` (maintenant des chunks WebM)
- `handleBlobEnded` — transition seek→live pendant enregistrement
- `returnToLiveInternal`
- `trimBuffer`, `updateBufferSeconds`
- Le buffer circulaire et toutes ses constantes (`MAX_BUFFER_BYTES`, `MAX_BUFFER_DURATION`, `MAX_RECORDING_DURATION`)

### Point d'attention : seek-back avec chunks WebM

Les chunks WebM individuels ne sont pas jouables seuls (contrairement aux chunks MP3). Pour que `seekBack()` fonctionne, le blob doit inclure le header WebM. Le premier chunk produit par MediaRecorder contient ce header. Solution : on marque le premier chunk comme "header chunk" et on l'inclut toujours en tête du blob de seek-back, même si trimBuffer l'a dépassé. On stocke le header séparément dans un `webmHeaderRef`.

### Fichier unique à modifier

`src/contexts/StreamBufferContext.tsx` — réécriture de la couche capture, conservation intacte de la couche buffer/seek/recording.

