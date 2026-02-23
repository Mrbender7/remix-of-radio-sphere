

# Corrections du Full Screen Player : Partage + Lien externe + Positionnement

## Problemes identifies

1. **Le bouton "Visiter le site" ouvre le site dans l'app** : Capacitor intercepte `window.open` et affiche la page dans la WebView interne au lieu du navigateur du telephone.
2. **Le bouton "Visiter le site" est cache sous les boutons systeme** : Le padding en bas du player ne compense pas suffisamment la zone de navigation Android.
3. **Le bouton de partage ne fonctionne pas** : `navigator.share` n'est pas toujours disponible dans la WebView Capacitor.

## Solution

### 1. Installer `@capacitor/browser` (nouvelle dependance)

Ce plugin officiel Capacitor permet d'ouvrir un lien dans le navigateur par defaut du telephone (pas dans l'app).

### 2. Modifier `src/components/FullScreenPlayer.tsx`

**Lien externe** : Remplacer `window.open(url, '_blank')` par un appel a `Browser.open({ url })` du plugin `@capacitor/browser`. Avec un fallback sur `window.open` pour le mode web/preview.

**Partage** : Ajouter un fallback quand `navigator.share` n'est pas disponible : copier le texte dans le presse-papiers via `navigator.clipboard.writeText()` et afficher un toast de confirmation via `sonner`.

**Positionnement** : Augmenter le padding bottom du conteneur d'infos/controles pour que le bouton "Visiter le site" ne soit pas masque par les boutons de navigation du telephone. Passer de `pb-[max(env(safe-area-inset-bottom,16px),1rem)]` a un calcul plus genereux avec un minimum de 2rem additionnel.

### 3. Fichiers modifies

- `package.json` : ajout de `@capacitor/browser`
- `src/components/FullScreenPlayer.tsx` : logique Browser.open, fallback partage, fix padding

### 4. Impact sur le build Android

Apres ces modifications, il faudra :
1. `git pull`
2. `npm install`
3. `npx cap sync`
4. Rebuild l'APK

