
Objectif: corriger définitivement le time-shift (remonter bien au-delà de 3–5s) et stabiliser la lecture rewind sur APK, tout en auditant les permissions et le PS1.

1) Diagnostic (audit code actuel)

- `FullScreenPlayer.tsx`
  - Le slider est contrôlé par `value={[isLive ? 0 : -1]}`: hors direct, la valeur reste figée à `-1`, donc la position choisie n’est jamais conservée.
  - Le seek est déclenché sur `onValueChange` (pendant le drag), ce qui reconstruit/recharge un Blob en boucle → saccades et lecture instable.
- `StreamBufferContext.tsx`
  - Le seek est basé sur `Date.now()` + timestamps de chunks, pas sur un index audio robuste.
  - Le buffer ne gère pas explicitement les flux ICY avec metadata (`icy-metaint`) : ces bytes parasites peuvent corrompre le flux rewind (symptôme typique: lecture qui casse après quelques secondes).
- `PlayerContext.tsx`
  - Les watchdogs (`stalled`/`ended`/heartbeat) sont pensés pour le live réseau; ils peuvent perturber la lecture `blob:` du time-shift.
- Permissions
  - Demandes dupliquées (App.tsx + PlayerContext + Welcome/guide).
  - `requestAllPermissions()` demande le storage, alors que le flux actuel “cache + share sheet” n’en a pas besoin.
- PS1
  - Vérifié: compatible avec des fixes TS.
  - À aligner côté permissions Android (éviter READ/WRITE external si non utilisées).

2) Plan d’implémentation

A. Stabiliser le rewind (priorité 1)
- Fichier: `src/components/FullScreenPlayer.tsx`
  - Remplacer la logique slider:
    - `onValueChange`: met à jour uniquement un état UI local (pas de seek réel).
    - `onValueCommit`: applique le seek une seule fois.
  - Binder le slider sur un vrai offset courant (pas `-1` fixe), exposé par le context.
  - Garder bouton LIVE pour retour instantané.

B. Rendre le buffer seekable de façon fiable (priorité 1)
- Fichier: `src/contexts/StreamBufferContext.tsx`
  - Ajouter parsing ICY:
    - Lire header `icy-metaint`.
    - Retirer les blocs metadata lors de la capture des chunks audio.
  - Passer le seek en mode “byte-accurate”:
    - Calculer la position cible depuis la fin du buffer (bytes), pas uniquement par timestamp.
    - Conserver l’offset réellement appliqué (`currentSeekOffsetSeconds`) pour l’UI.
  - Limiter les reconstructions inutiles (un seek = une reconstruction blob).
  - Exposer `currentSeekOffsetSeconds` (et éventuellement `isSeeking`) au player.

C. Empêcher les watchdog live de casser le playback rewind (priorité 1)
- Fichier: `src/contexts/PlayerContext.tsx`
  - Dans `stalled/ended/heartbeat`, ignorer la logique de reload quand `audio.src` est un `blob:` de time-shift.
  - Sur fin naturelle du blob rewind: retour direct maîtrisé (ou trigger explicite vers `returnToLive`), sans reload agressif.

D. Audit permissions (priorité 2)
- Fichiers: `src/utils/permissions.ts`, `src/App.tsx`, `src/contexts/PlayerContext.tsx`, `src/pages/WelcomePage.tsx`, `src/components/UserGuideModal.tsx`
  - Centraliser les prompts:
    - garder un point d’entrée user-gesture (Welcome + bouton manuel guide),
    - supprimer les demandes auto redondantes.
  - Supprimer la demande storage runtime non nécessaire pour “cache + share”.
  - Conserver notifications (Android 13+) avec flux explicite.

E. Vérification PS1 (préférence mémorisée: toujours vérifier)
- Fichier: `radiosphere_v2_5_0.ps1`
  - Vérifier cohérence build (OK).
  - Ajuster la liste de permissions injectées:
    - retirer `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` si non requises.
  - Ajouter note de version (ex: v2.5.1) sur les fixes time-shift + permissions.

3) Détails techniques (implémentation)

- Slider:
  - `value={[seekDraft ?? currentSeekOffsetSeconds]}` (en négatif côté UI).
  - `onValueChange` = UI only.
  - `onValueCommit` = `seekBack(abs(value))`.
- Buffer:
  - Parser ICY stateful (gère les coupures de blocs metadata entre chunks).
  - Concaténation seek en parts `BlobPart[]` (éviter copies massives inutiles).
- Robustesse:
  - Ne pas relancer le stream live pendant lecture `blob:`.
  - Traces logs ciblées: offset demandé/appliqué, metaint détecté, taille blob, raison des retours live.

4) Validation E2E (APK)

- Cas MP3 + AAC/OGG:
  1. Lancer station, attendre 2–3 min.
  2. Rewind à -30s, -90s, -180s.
  3. Vérifier lecture fluide (>30s) sans saccades.
  4. Retour LIVE immédiat.
- Enregistrement:
  - Démarrer pendant live, puis pendant rewind.
  - Stop + export/share: fichier lisible et durée cohérente.
- Permissions:
  - Premier démarrage: prompt notification au bon moment.
  - Pas de prompt storage inutile.
