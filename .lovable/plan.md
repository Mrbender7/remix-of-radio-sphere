

# Ajouter le lien vers le site web de la radio dans le Full Screen Player

## Ce qui change pour l'utilisateur

Un nouveau bouton "Site web" apparait dans le full screen player (sous les infos codec/bitrate/langue). En appuyant dessus, le site de la radio s'ouvre dans le navigateur par defaut du telephone (Safari, Chrome, etc.), pas dans l'app.

Le bouton n'apparait que si la station possede un site web renseigne.

## Modifications techniques

### 1. `src/types/radio.ts`

Ajouter le champ optionnel `homepage` a l'interface `RadioStation`.

### 2. `src/services/RadioService.ts`

Dans `normalizeStation`, extraire `raw.homepage` et l'affecter au nouveau champ.

### 3. `src/components/FullScreenPlayer.tsx`

- Ajouter un bouton avec une icone `ExternalLink` (lucide-react) sous la grille codec/bitrate/langue.
- Au clic, ouvrir le lien via `window.open(url, '_blank')` qui, sur Capacitor Android, ouvre automatiquement le navigateur externe.
- Le bouton n'est affiche que si `currentStation.homepage` existe et n'est pas vide.

### 4. `src/i18n/translations.ts`

Ajouter la traduction `"player.visitWebsite"` en FR ("Visiter le site") et EN ("Visit website").

## Fichiers modifies

- `src/types/radio.ts`
- `src/services/RadioService.ts`
- `src/components/FullScreenPlayer.tsx`
- `src/i18n/translations.ts`

