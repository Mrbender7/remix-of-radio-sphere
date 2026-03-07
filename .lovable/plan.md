

# Plan v1.1.0 -- Google Play Billing + Script Update

## Contexte

L'app a un systeme Premium complet cote UI (gates, PremiumContext, page Premium, bouton "Restaurer les achats") mais tout est gere via `localStorage`. Il faut maintenant connecter au vrai Google Play Billing pour l'achat unique "Premium Lifetime" a 9,99 EUR.

## Limitation importante

**Lovable ne peut pas executer de code natif Android.** Le Google Play Billing repose sur le `BillingClient` Java natif. Le plan se decompose donc en deux parties :
1. **Cote web (Lovable)** : adapter `PremiumContext` pour communiquer avec un plugin Capacitor natif
2. **Cote natif (PS1)** : generer le fichier Java du plugin Billing + le declarer dans le Manifest/Gradle

## Changements prevus

### 1. Plugin Capacitor Billing (TypeScript)
Creer `src/plugins/BillingPlugin.ts` -- interface TypeScript pour appeler le plugin natif :
- `queryPurchases()` : verifie si l'utilisateur a deja achete
- `purchasePremium()` : lance le flux d'achat Google Play
- `restorePurchases()` : equivalent de queryPurchases pour le bouton "Restaurer"

### 2. Mise a jour PremiumContext
- Supprimer le `isPremium = true` par defaut (fin de la periode de test)
- Au mount : appeler `BillingPlugin.queryPurchases()` pour verifier le statut reel
- `purchasePremium()` remplace `togglePremium()` pour les boutons d'achat
- `restorePurchases()` appelle le plugin natif au lieu du toast factice
- Fallback web : garder le systeme mot de passe pour le debug en preview

### 3. Mise a jour PremiumPage
- Bouton unique "Acheter Premium -- 9,99 EUR" (achat unique, pas monthly/yearly)
- Bouton "Restaurer les achats" visible aussi sur cette page

### 4. Mise a jour SettingsPage
- Le bouton "Restaurer les achats" (ligne 521-538) appelle le vrai plugin au lieu du toast
- Version : `v1.0` -> `v1.1`

### 5. Script PS1 v1.1.0
Nouveau fichier `radiosphere_v1_1_0.ps1` :
- `$RepoUrl` pointe vers le bon repo
- `$ProjectFolder = "radiosphere-1.1.0"` (plus de "remix-of-radio-sphere")
- Gradle : ajouter `implementation 'com.android.billingclient:billing:6.1.0'`
- Generer `BillingPlugin.java` dans le package `com.fhm.radiosphere` :
  - Initialise `BillingClient`
  - Methode `purchasePremium` : lance `launchBillingFlow` pour le produit `premium_lifetime`
  - Methode `queryPurchases` : verifie `INAPP` purchases, retourne `{ isPremium: true/false }`
  - Acknowledge les achats non consommes
- Enregistrer le plugin dans `MainActivity.java` : `add(BillingPlugin.class)`
- Mise a jour version dans les messages de sortie

### 6. VERSIONS.md
Ajouter section v1.1.0 avec :
- Google Play Billing (achat unique Premium Lifetime 9,99 EUR)
- Fin de la periode de test (isPremium n'est plus true par defaut)
- Restauration des achats fonctionnelle
- Nouveau script de build

### 7. Configuration Play Console (instruction utilisateur)
Tu devras creer manuellement dans la Play Console :
- Produits internes > Produit geree > ID : `premium_lifetime`, prix 9,99 EUR, type "Achat unique"

## Etapes supplementaires recommandees

- **Privacy Policy** : la Play Console l'exige -- le fichier `docs/privacy-policy.html` existe deja, verifier qu'il couvre les achats in-app
- **Contenu cible et age** : declarer la tranche d'age dans la Play Console
- **Screenshots et fiche store** : preparer les visuels 16:9 et captures pour la fiche

