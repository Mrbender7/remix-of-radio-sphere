

# Traduire Radio Sphere en espagnol et allemand

## Objectif
Ajouter l'espagnol (es) et l'allemand (de) comme nouvelles langues, et remplacer les sélecteurs de langue (boutons fr/en) par un menu deroulant dans les Reglages et la page de bienvenue.

## Fichiers a modifier

### 1. `src/i18n/translations.ts`
- Etendre le type `Language` : `"fr" | "en" | "es" | "de"`
- Ajouter les blocs de traduction `es` et `de` avec toutes les cles existantes (environ 90 cles chacun)
- Traductions completes pour chaque cle (navigation, recherche, favoris, premium, minuterie, lecteur, parametres, guide utilisateur, etc.)

### 2. `src/contexts/LanguageContext.tsx`
- Mettre a jour `detectInitialLanguage()` pour reconnaitre `"es"` et `"de"` dans le localStorage et dans `navigator.language`

### 3. `src/pages/WelcomePage.tsx`
- Remplacer les deux boutons fr/en par un **Select dropdown** (composant `Select` existant de Radix)
- Adapter les textes statiques de la page (subtitle, label "Choisissez la langue") pour utiliser la langue selectionnee plutot que du texte bilingue en dur
- Adapter les `FEATURES` avec `labelEs` et `labelDe` (ou passer par des cles de traduction)
- Adapter le bouton "Commencer" / "Get started" pour les 4 langues

### 4. `src/pages/SettingsPage.tsx`
- Remplacer les deux boutons de langue (lignes 113-128) par un **Select dropdown** avec les 4 langues
- Adapter la reference `language === "fr" ? opt.labelFr : opt.labelEn` dans le sleep timer pour supporter les 4 langues

### 5. `src/contexts/SleepTimerContext.tsx`
- Ajouter `labelEs` et `labelDe` aux options du sleep timer (ou simplifier avec une cle de traduction)

---

## Details techniques

### Nouvelles langues dans le Select
Chaque option affichera un drapeau emoji + nom :
- `🇫🇷 Francais`
- `🇬🇧 English`
- `🇪🇸 Espanol`
- `🇩🇪 Deutsch`

### Composant Select
Le projet dispose deja de `src/components/ui/select.tsx` (Radix Select). Il sera utilise directement dans WelcomePage et SettingsPage.

### Sleep Timer
Pour eviter de multiplier les labels par langue, les options `labelFr`/`labelEn` seront etendues avec `labelEs`/`labelDe`, et un helper simple choisira le bon label selon la langue courante.

### Volume de traductions
Environ 90 cles x 2 nouvelles langues = ~180 nouvelles traductions a ajouter dans le fichier translations.ts.

