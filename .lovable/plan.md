

# Refinement UX et corrections de layout

## 1. Renommer "Bibliotheque" en "Favoris"

**Fichiers concernes** : `BottomNav.tsx`, `LibraryPage.tsx`

- Dans `BottomNav.tsx` : changer le label `"Bibliothèque"` en `"Favoris"` et l'icone `Library` en `Heart`
- Dans `LibraryPage.tsx` : changer le titre `h1` de `"Bibliothèque"` en `"Favoris"`

## 2. Bouton favori sur le MiniPlayer et FullScreenPlayer

**Fichiers concernes** : `MiniPlayer.tsx`, `FullScreenPlayer.tsx`, `Index.tsx`

- Les deux players ont besoin d'acceder a `isFavorite` et `toggleFavorite`. Ces fonctions seront passees via le `PlayerProvider` ou directement en props.
- Approche : ajouter `isFavorite` et `onToggleFavorite` en props au `MiniPlayer` et `FullScreenPlayer` depuis `Index.tsx` (ou les importer du hook `useFavorites` directement dans ces composants -- mais comme le hook est deja utilise dans Index, on passera les props pour coherence).
- **Alternative plus propre** : Creer un contexte `FavoritesContext` qui wrappera l'app, ainsi les players pourront acceder aux favoris directement sans props drilling. On va utiliser cette approche.
- `MiniPlayer.tsx` : ajouter un bouton coeur a cote du bouton play/pause
- `FullScreenPlayer.tsx` : ajouter un bouton coeur sous les infos de la station

## 3. Correction du z-index du dropdown pays

**Fichier concerne** : `SearchPage.tsx`

- Ajouter `z-50` au `SelectContent` du pays pour qu'il s'affiche au-dessus de la barre de navigation
- Ajouter `shadow-xl` pour la lisibilite
- Ajouter du padding en bas de la page de recherche (`pb-32`) pour que le contenu ne soit pas cache par le mini player et la nav

## 4. Liste des pays dynamique depuis l'API Radio Browser

**Fichiers concernes** : `RadioService.ts`, `SearchPage.tsx`

- Ajouter une methode `getCountries()` dans le service radio qui appelle `/json/countries` de l'API Radio Browser
- Trier par ordre alphabetique
- Generer les drapeaux emoji a partir du code pays ISO (algorithme standard : convertir les 2 lettres du code pays en Regional Indicator Symbols)
- Dans `SearchPage.tsx` : charger la liste via `useQuery` et alimenter le `Select` dynamiquement
- Garder la liste statique comme fallback en cas d'echec API

## 5. Intelligence locale sur la page d'accueil

**Fichier concerne** : `HomePage.tsx`

- Detecter `navigator.language` (ex: `"fr-FR"`, `"fr"`, `"en-US"`)
- Si la langue contient `"fr"` : passer `language: "french"` au filtre des stations populaires
- Si `"es"` : `"spanish"`, si `"de"` : `"german"`, etc.
- Sinon : garder le top mondial (comportement actuel)
- Modifier le `useQuery` pour `topStations` en utilisant `searchStations` avec filtre langue plutot que `getTopStations`

## 6. Verification des genre cards (deja fonctionnel)

- Les genre cards appellent deja `onGenreClick` qui set le genre et switch l'onglet. On verifiera que c'est bien connecte.

## 7. Aspect 3D des boutons

**Fichiers concernes** : `HomePage.tsx` (genre cards), `MiniPlayer.tsx`, `FullScreenPlayer.tsx`, `index.css`

- Genre cards : ajouter des classes Tailwind pour un effet 3D (`shadow-lg`, `border-t border-white/10`, un leger `ring` interne, et un `hover:shadow-xl hover:-translate-y-0.5` pour l'effet de profondeur)
- Boutons play/pause du MiniPlayer et FullScreenPlayer : ajouter un gradient plus prononce, `shadow-lg shadow-primary/40`, `border-t border-white/20` pour simuler une lumiere venant du haut, et un `active:shadow-sm active:translate-y-0.5` pour l'effet d'enfoncement

---

## Details techniques

### Nouveau fichier : `src/contexts/FavoritesContext.tsx`
- Exporte `FavoritesProvider` et `useFavoritesContext`
- Encapsule le hook `useFavorites` et `useRecentStations` existants
- Place dans `Index.tsx` au niveau le plus haut

### Modifications fichier par fichier

1. **`src/contexts/FavoritesContext.tsx`** (nouveau)
   - Contexte React avec `favorites`, `toggleFavorite`, `isFavorite`, `recent`, `addRecent`

2. **`src/pages/Index.tsx`**
   - Wrapper avec `FavoritesProvider`
   - Retirer les appels directs a `useFavorites`/`useRecentStations`
   - Utiliser le contexte a la place

3. **`src/components/BottomNav.tsx`**
   - Changer label et icone de l'onglet library : `Heart` + `"Favoris"`

4. **`src/pages/LibraryPage.tsx`**
   - Titre `h1` : `"Favoris"`

5. **`src/components/MiniPlayer.tsx`**
   - Importer `useFavoritesContext`
   - Ajouter bouton coeur avec style 3D sur le bouton play

6. **`src/components/FullScreenPlayer.tsx`**
   - Importer `useFavoritesContext`
   - Ajouter bouton coeur a cote du nom de la station
   - Style 3D sur le bouton play

7. **`src/services/RadioService.ts`**
   - Ajouter methode `getCountries()` qui appelle `/json/countries`
   - Retourne `{ name: string, stationcount: number, iso_3166_1: string }[]`
   - Ajouter dans l'interface `RadioProvider`

8. **`src/pages/SearchPage.tsx`**
   - Charger les pays via `useQuery` + `getCountries()`
   - Fonction utilitaire `countryCodeToFlag(iso: string)` pour convertir code ISO en emoji drapeau
   - `SelectContent` avec `className="z-50 shadow-xl"`
   - Padding bas augmente

9. **`src/pages/HomePage.tsx`**
   - Detecter `navigator.language` et mapper vers une langue Radio Browser
   - Modifier la query `topStations` pour filtrer par langue si detectee
   - Genre cards : ajouter classes 3D (shadow, border highlight, transform on hover)

