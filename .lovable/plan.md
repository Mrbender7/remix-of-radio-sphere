

# Audit complet Radio Sphere — Corrections pre-Google Play

## Bugs identifies

### 1. Messages d'erreur du player en francais uniquement (BLOQUANT UX)
**Fichier** : `src/contexts/PlayerContext.tsx`

Tous les `toast()` dans le PlayerContext sont codes en dur en francais : "Erreur de lecture", "Flux indisponible", "Delai depasse", etc. Quand l'utilisateur est en anglais, il voit quand meme du francais.

**Correction** : Le PlayerContext n'a pas acces au `useTranslation()` car il est monte au-dessus du LanguageProvider dans l'arbre. Deux options :
- Option A (recommandee) : Reorganiser l'arbre pour que `LanguageProvider` enveloppe `PlayerProvider` dans `Index.tsx` (c'est deja le cas ! LanguageProvider est au-dessus). Il suffit d'ajouter `useTranslation()` dans `PlayerProvider` et utiliser `t()` dans les toasts.
- Ajouter les cles manquantes dans `translations.ts` : `player.streamUnavailable`, `player.streamErrorDesc`, `player.timeout`, `player.timeoutDesc`, `player.unexpectedError`, `player.unexpectedErrorDesc`

### 2. Toast du sleep timer en francais uniquement
**Fichier** : `src/contexts/SleepTimerContext.tsx`, ligne 85

Le message "La lecture a ete mise en pause automatiquement." est code en dur. Meme probleme : `SleepTimerContext` est imbrique dans `LanguageProvider`, donc `useTranslation()` est accessible.

**Correction** : Utiliser `t("sleepTimer.stopped")` et ajouter la cle dans `translations.ts`.

### 3. `importFavorites` retourne le mauvais nombre
**Fichier** : `src/hooks/useFavorites.ts`, ligne 41

`return stations.length` retourne le nombre TOTAL de stations dans le CSV, pas le nombre reellement importe (apres deduplication). L'utilisateur voit "15 favoris importes" alors que seulement 3 etaient nouveaux.

**Correction** : Calculer et retourner le nombre de stations effectivement ajoutees.

### 4. Boutons imbriques dans les sections collapsibles (accessibilite)
**Fichier** : `src/pages/SettingsPage.tsx`

`CollapsibleSection` est un `<button>` qui contient d'autres `<button>` (timer, export, etc.). C'est invalide en HTML et pose des problemes d'accessibilite. Les lecteurs d'ecran et certains navigateurs peuvent avoir un comportement imprevu.

**Correction** : Remplacer le `<button>` parent par un `<div>` avec un `<button>` uniquement pour le header cliquable. Le contenu enfant ne sera plus imbrique dans un bouton.

## Recommandations Google Play

### 5. Lien vers la politique de confidentialite (REQUIS par Google Play)
Google Play exige un lien vers une politique de confidentialite accessible dans l'app ET sur la fiche Play Store. L'app ne stocke aucune donnee personnelle sur serveur, mais il faut quand meme une page/lien qui le dit explicitement.

**Correction** : Ajouter un lien "Politique de confidentialite" dans la section Reglages, pointant vers une URL hebergee (ex: page GitHub Pages ou Google Docs). Ajouter les cles de traduction correspondantes.

### 6. Version de l'app visible dans les reglages
Bonne pratique pour le support utilisateur et les mises a jour Google Play : afficher le numero de version (ex: "v2.2.7") en bas des reglages.

**Correction** : Ajouter un petit texte `v2.2.7` en footer des reglages.

---

## Resume des fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/contexts/PlayerContext.tsx` | Importer `useTranslation`, remplacer les toasts FR par `t()` |
| `src/contexts/SleepTimerContext.tsx` | Importer `useTranslation`, toast traduit |
| `src/i18n/translations.ts` | Ajouter cles pour les erreurs player + sleep timer stopped + privacy policy |
| `src/hooks/useFavorites.ts` | Corriger le retour de `importFavorites` |
| `src/pages/SettingsPage.tsx` | Corriger `CollapsibleSection` (HTML valide), ajouter lien privacy + version |

## Ce qui est OK (pas besoin de toucher)

- Architecture React propre, contexts bien separes
- Gestion audio robuste (heartbeat, wake lock, silent loop, foreground service)
- Recherche par name + tag en parallele avec deduplication
- Android Auto integration (plugin Capacitor + MediaBrowserService)
- Gestion des favoris/recents avec localStorage
- i18n FR/EN (sauf les bugs ci-dessus)
- Scroll-to-top translucide bien positionne
- Export/Import/Partage CSV fonctionnel
- Back button handler avec double-tap exit
- MediaSession + notification lockscreen
- Theming dark-only coherent
- Tailwind config propre

