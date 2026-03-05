

## Audit complet du magnétophone — 3 bugs majeurs

### Problème 1 : Save affiche "fichier sauvegardé" mais le fichier est introuvable

`Directory.Documents` sur Android 10+ écrit dans le stockage sandboxé de l'app (`/data/data/com.radiosphere.app/files/Documents/`). Le fichier existe bien mais l'utilisateur ne peut pas le voir depuis un explorateur de fichiers ni depuis Downloads.

**Correction** : Unifier Save et Share. Sauvegarder le fichier dans `Directory.Cache`, puis ouvrir le share sheet natif (via `@capacitor/share`) qui permet à l'utilisateur de choisir "Enregistrer dans Fichiers", "Enregistrer dans Downloads", envoyer par WhatsApp, etc. C'est le seul moyen fiable sur Android 10+ sans accès MediaStore. Le bouton "Sauvegarder" devient "Enregistrer / Exporter" et utilise le même mécanisme que le partage.

### Problème 2 : Pas d'audio enregistré pour les flux non-MP3 (AAC, OGG, etc.)

Le buffer parallèle (`fetch` du stream) capture les octets bruts. Le Blob est créé avec `type: 'audio/mpeg'` en dur. Pour un flux AAC ou OGG, le fichier résultant est corrompu car le header MIME ne correspond pas aux données.

**Correction** :
- Stocker le `Content-Type` de la réponse fetch dans un ref (`streamMimeTypeRef`)
- Utiliser ce MIME type réel lors de la création du Blob (`audio/aac`, `audio/ogg`, etc.)
- Adapter l'extension du fichier en fonction : `.mp3`, `.aac`, `.ogg`, `.m4a`
- Fallback sur `currentStation.codec` si le Content-Type est générique (`application/octet-stream`)
- Pour le fallback MediaRecorder (quand le fetch CORS échoue), garder `audio/webm` car c'est ce que MediaRecorder produit

### Problème 3 : Seek back est un stub — impossible de remonter dans le buffer

`seekBack()` ne fait que toggler `isLive` sans changer la source audio. Le slider est purement cosmétique.

**Correction** :
- Exporter `globalAudio` depuis `PlayerContext.tsx` pour que `StreamBufferContext` puisse le manipuler directement
- Implémenter `seekBack(seconds)` :
  1. Trouver le chunk dont le timestamp = `now - seconds * 1000`
  2. Concaténer tous les chunks depuis ce point jusqu'au dernier
  3. Créer un Blob avec le MIME type détecté, puis un blob URL
  4. `globalAudio.pause()` → `globalAudio.src = blobUrl` → `globalAudio.play()`
  5. `isLive = false`
- Implémenter `returnToLive()` :
  1. Révoquer le blob URL
  2. `globalAudio.src = currentStation.streamUrl` → `globalAudio.load()` → `globalAudio.play()`
  3. `isLive = true`
- L'enregistrement pendant le seek-back fonctionne : les chunks continuent de s'accumuler en arrière-plan via le fetch parallèle

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `src/contexts/PlayerContext.tsx` | Exporter `globalAudio` (1 ligne) |
| `src/contexts/StreamBufferContext.tsx` | Stocker le MIME type du stream, implémenter seek-back réel avec swap audio, adapter extension fichier, corriger blob type |
| `src/components/FullScreenPlayer.tsx` | Remplacer le bouton "Sauvegarder" par un export via Share (save-to-cache + share sheet), supprimer `handleSaveFile` séparé |
| `radiosphere_v2_5_0.ps1` | Vérifier cohérence (aucun changement natif requis — tout est TypeScript, le `npm run build` suffit) |

### Détails techniques

**Mapping codec → MIME/extension :**

```text
Content-Type          → Extension
audio/mpeg            → .mp3
audio/aac             → .aac
audio/aacp            → .aac
audio/ogg             → .ogg
audio/flac            → .flac
audio/x-mpegurl       → .mp3 (HLS, raw bytes are usually AAC)
application/ogg       → .ogg
*fallback*            → .mp3
```

**Seek-back audio swap :** Le `globalAudio` est un objet `Audio` global hors React. Le swap de `src` est instantané. Pendant le seek-back, le fetch parallèle continue d'alimenter le buffer circulaire, donc le retour en live est sans coupure.

**PS1 :** Aucune modification native requise. Les changements sont tous dans le code TypeScript/React compilé par `npm run build`. Le script PS1 actuel est cohérent.

