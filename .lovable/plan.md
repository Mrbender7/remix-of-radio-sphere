

# Plan v2.2.7 — Recherche par tags, scroll-to-top, Radio Browser info, export/import/partage favoris

## 1. Recherche : inclure les tags dans la recherche textuelle

**Actuellement** : Le champ de recherche envoie uniquement le parametre `name` a l'API Radio Browser.

**Modification** : Quand l'utilisateur tape un mot-cle, effectuer **deux requetes en parallele** — une sur `name` et une sur `tag` — puis fusionner les resultats (deduplication par `id`). Cela permet de trouver des stations par leur nom OU par leurs tags (ex: taper "jazz" remontera les stations taguees jazz meme si "jazz" n'est pas dans le nom).

**Fichier** : `src/pages/SearchPage.tsx`
- Modifier la `queryFn` pour lancer `Promise.all` avec deux appels `searchStations` : un avec `name`, un avec `tag` = meme mot-cle
- Fusionner et dedupliquer les resultats
- Conserver le tri selectionne par l'utilisateur

## 2. Bouton "scroll to top" sur la page de recherche

**Modification** : Ajouter un bouton flottant (fleche vers le haut) qui apparait quand l'utilisateur a scrolle au-dela d'un certain seuil (ex: 300px). Au clic, scroll smooth vers le haut.

**Fichier** : `src/pages/SearchPage.tsx`
- Ajouter un `ref` sur le container scrollable + un state `showScrollTop`
- Ecouter l'evenement `scroll` pour afficher/masquer le bouton
- Bouton rond fixe en bas a droite avec icone `ArrowUp` de lucide-react
- Animation d'apparition/disparition

## 3. Reglages : section Radio Browser enrichie

**Actuellement** : La section "Source des stations" affiche un texte generique mentionnant "plus de 30 000 radios".

**Modifications** :
- Mettre a jour le nombre a **plus de 50 000** (le site indique 51 530 actuellement)
- Ajouter un lien cliquable vers le site : `https://www.radio-browser.info/`
- Ajouter un lien pour ajouter une station : `https://www.radio-browser.info/add`

**Fichiers** :
- `src/i18n/translations.ts` : Mettre a jour les textes FR et EN pour `settings.radioSourceDesc`, ajouter cles `settings.radioSourceLink` et `settings.radioSourceAddStation`
- `src/pages/SettingsPage.tsx` : Transformer le `CollapsibleDisclaimer` de Radio Browser en une section enrichie avec les liens cliquables (balises `<a>` avec `target="_blank"`)

## 4. Reglages : Export / Import / Partage des favoris

### Export CSV
- Bouton "Exporter les favoris" dans une nouvelle section collapsible dans les reglages
- Genere un fichier CSV avec colonnes : `name, streamUrl, country, tags, homepage`
- Utilise `Blob` + `URL.createObjectURL` + lien de telechargement (ou `navigator.share` avec fichier si disponible)

### Import CSV
- Bouton "Importer des favoris" avec un `<input type="file" accept=".csv">`
- Parse le CSV, reconstruit les objets `RadioStation` (genere un ID si absent)
- Fusionne avec les favoris existants (pas de doublons par `streamUrl`)
- Affiche un toast de confirmation avec le nombre de stations importees

### Partage natif Android
- Bouton "Partager mes favoris" qui utilise `navigator.share()` (Web Share API, supportee nativement sur Android/Capacitor)
- Partage le fichier CSV en piece jointe via `navigator.share({ files: [...] })`
- Fallback : si `navigator.share` n'est pas disponible, propose le telechargement classique

**Fichiers** :
- `src/pages/SettingsPage.tsx` : Nouvelle section collapsible "Favoris" avec les 3 boutons
- `src/i18n/translations.ts` : Ajouter les cles de traduction FR/EN pour export, import, partage
- `src/contexts/FavoritesContext.tsx` : Exposer la fonction `importFavorites(stations: RadioStation[])` pour ajouter en masse sans doublons

---

## Resume des fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/pages/SearchPage.tsx` | Recherche sur name + tag en parallele, bouton scroll-to-top |
| `src/pages/SettingsPage.tsx` | Section Radio Browser avec liens, section Export/Import/Partage favoris |
| `src/i18n/translations.ts` | Nouvelles cles de traduction (radio source, export, import, partage) + mise a jour du nombre de stations |
| `src/contexts/FavoritesContext.tsx` | Ajouter `importFavorites` au contexte |
| `src/hooks/useFavorites.ts` | Ajouter fonction `importFavorites` dans le hook |

