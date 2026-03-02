

# Audit Google Play + Ameliorations demandees

## A. Audit de conformite Google Play

### Ce qui est OK
- **Politique de confidentialite** : Lien present dans les Reglages (ligne 501-509 de SettingsPage.tsx) pointant vers GitHub Pages
- **Permissions justifiees** : Internet, reseau, localisation (Cast), foreground service, notifications — toutes documentees dans la privacy policy
- **Stockage local uniquement** : Aucune donnee personnelle envoyee a un serveur (confirme dans les disclaimers)
- **Meta tags HTML** : Description, OG tags, theme-color presents dans index.html
- **Content rating** : App de streaming radio, pas de contenu sensible genere par l'app
- **Multilingue** : 5 langues supportees (FR, EN, ES, DE, JA)

### Points a corriger

1. **Version affichee obsolete** : "v2.2.8e" est affiche sur la WelcomePage (ligne 95) et SettingsPage (ligne 550), alors que le code est en v2.4.8. Doit etre mis a jour.

2. **Lien politique de confidentialite sur WelcomePage** : Google exige que les utilisateurs puissent acceder a la politique de confidentialite AVANT d'utiliser l'app. Le lien doit etre ajoute sur la page de bienvenue.

3. **Chromecast dans les features Premium** : La liste des features Premium ne mentionne que Sleep Timer et Android Auto. Le Chromecast doit etre ajoute comme feature visible dans la section Premium des Reglages.

4. **PremiumPage.tsx obsolete** : Ce fichier (pages/PremiumPage.tsx) contient une ancienne page Premium avec des boutons "monthly/yearly" factices. Elle ne semble plus utilisee (pas importee dans Index.tsx) mais reste dans le projet. A nettoyer ou ignorer.

---

## B. Plan d'implementation

### 1. WelcomePage — Ajouter lien politique de confidentialite
- Ajouter un lien cliquable sous le bouton "Commencer" avec l'icone ShieldCheck
- Texte traduit via la cle existante `settings.privacyPolicy`
- Lien vers `https://mrbender7.github.io/privacy-policy-radiosphere/`
- Style : `text-[10px] text-muted-foreground` avec hover underline

### 2. SettingsPage — Ajouter Chromecast dans les features Premium
- Ajouter une 3e entree dans le tableau `premiumFeatures` (ligne 103-106) :
  ```
  { icon: Cast, title: t("premium.chromecast"), desc: t("premium.chromecastDesc") }
  ```
- Importer `Cast` depuis lucide-react (deja utilise dans CastButton)

### 3. Traductions — Ajouter les cles manquantes
- Ajouter `premium.chromecast` et `premium.chromecastDesc` dans les 5 langues :
  - FR: "Chromecast" / "Diffusez vos stations sur votre TV ou enceinte connectee via Chromecast"
  - EN: "Chromecast" / "Cast your stations to your TV or connected speaker via Chromecast"
  - ES: "Chromecast" / "Transmite tus estaciones a tu TV o altavoz conectado via Chromecast"
  - DE: "Chromecast" / "Streame deine Sender auf deinen Fernseher oder Lautsprecher uber Chromecast"
  - JA: "Chromecast" / "Chromecastを使ってテレビやスマートスピーカーにストリーミング"

### 4. Mettre a jour le numero de version
- WelcomePage ligne 95 : "v2.2.8e" → "v2.4.8"
- SettingsPage ligne 550 : "v2.2.8e" → "v2.4.8"

---

## C. Resume des fichiers modifies

| Fichier | Modifications |
|---------|--------------|
| `src/pages/WelcomePage.tsx` | Ajouter lien privacy policy + mettre a jour version |
| `src/pages/SettingsPage.tsx` | Ajouter Chromecast aux features Premium + Cast import + mettre a jour version |
| `src/i18n/translations.ts` | Ajouter `premium.chromecast` et `premium.chromecastDesc` dans 5 langues |

