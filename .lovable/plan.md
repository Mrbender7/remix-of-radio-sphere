
# Fix bouton Quitter + Visualizer audio anime

## 3 modifications

### 1. Fix du bouton "Quitter" dans le dialogue de sortie

Le code actuel utilise `window.close()` ou `window.history.back()`, ce qui ne fonctionne pas dans une WebView Capacitor. Il faut utiliser le plugin `@capacitor/app` et sa methode `App.exitApp()` pour fermer nativement l'application Android.

**Fichier** : `src/components/ExitConfirmDialog.tsx`

```typescript
const handleExit = async () => {
  try {
    const { App } = await import('@capacitor/app');
    await App.exitApp();
  } catch {
    // Fallback web
    window.close();
  }
};
```

### 2. Visualizer anime sur la vignette du StationCard (quand en lecture)

Remplacer l'overlay actuel (3 barres pulsantes basiques) par un petit visualizer style "barres d'equalizer" plus dynamique et visuellement interessant, inspire de Winamp. Ce sera un composant `AudioVisualizer` reutilisable avec 5-7 barres animees a des vitesses et hauteurs differentes, avec un degrade bleu-violet.

**Fichier** : `src/components/AudioVisualizer.tsx` (nouveau)

Un composant SVG leger avec des barres animees via CSS keyframes. Chaque barre a une animation independante (durees et delais differents) pour creer un mouvement organique et non repetitif. Pas de dependance audio reelle, juste une animation decorative.

**Fichier** : `src/components/StationCard.tsx`

Remplacer le bloc des 3 barres `animate-pulse` (lignes 48-52 et 74-78) par le composant `AudioVisualizer`.

### 3. Visualizer sous l'image dans le FullScreenPlayer

Ajouter le meme composant `AudioVisualizer` en version plus grande sous l'artwork dans le player plein ecran, visible uniquement quand `isPlaying` est `true`. Ce sera une bande horizontale de barres animees entre l'image et le nom de la station, donnant un feedback visuel elegant que la lecture est en cours.

**Fichier** : `src/components/FullScreenPlayer.tsx`

Ajouter le visualizer juste apres le bloc artwork (apres ligne 37), dans un conteneur centre avec une largeur adaptee.

---

## Detail technique du composant AudioVisualizer

Le composant acceptera des props `size` (small/medium/large) pour s'adapter aux differents contextes :
- **small** : 4 barres, hauteur 16px -- pour les StationCards et le compact mode
- **medium** : 5 barres, hauteur 24px -- pour le MiniPlayer (optionnel)
- **large** : 7-9 barres, hauteur 40px, largeur elargie -- pour le FullScreenPlayer

Chaque barre utilise une animation CSS `@keyframes equalizer-bar` avec :
- Des hauteurs oscillantes entre 20% et 100%
- Des durees entre 0.4s et 0.8s
- Des delais decales pour chaque barre
- Un degrade bleu-vers-violet (coherent avec l'identite visuelle)

Les animations seront ajoutees dans le fichier `tailwind.config.lov.json` via les keyframes existants, ou directement en inline style pour eviter de surcharger la config.

## Fichiers modifies

1. `src/components/ExitConfirmDialog.tsx` -- App.exitApp()
2. `src/components/AudioVisualizer.tsx` -- nouveau composant
3. `src/components/StationCard.tsx` -- utiliser AudioVisualizer
4. `src/components/FullScreenPlayer.tsx` -- ajouter visualizer sous l'image
