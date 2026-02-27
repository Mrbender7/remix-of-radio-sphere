# RadioSphere — Premium Roadmap

## Modèle de tarification

### Achat unique (One-Shot) — **Premium Lifetime**
- **Prix** : 9,99€ (achat unique, accès à vie)
- Débloque toutes les fonctionnalités premium actuelles et futures (basées sur Radio Browser)
- Pas d'abonnement, pas de renouvellement

### Abonnement (futur, si changement d'API)
- Envisagé uniquement si migration vers une API radio premium (contenu exclusif, qualité supérieure)
- Formule mensuelle / annuelle à définir
- Justifié par les coûts récurrents de l'API premium

---

## Fonctionnalités Premium

### 1. 🚗 Android Auto
- **Statut** : ✅ Terminé (v2.2.8d)
- **Description** : Intégration complète Android Auto avec browse tree (Favoris, Récents, Genres), recherche vocale, lecture native ExoPlayer, artwork plein écran, navigation next/previous dans les favoris
- **Fichiers concernés** : `src/plugins/RadioAutoPlugin.ts`, `android-auto/*`, `src/contexts/FavoritesContext.tsx`, `src/contexts/PlayerContext.tsx`

### 2. 💤 Sleep Timer
- **Statut** : ✅ Terminé
- **Description** : Minuterie d'arrêt automatique avec options prédéfinies (15 min, 30 min, 45 min, 1h, 1h30, 2h). Affichage du décompte en temps réel dans les réglages. Pause automatique de la lecture à expiration
- **Fichiers concernés** : `src/contexts/SleepTimerContext.tsx`, `src/pages/SettingsPage.tsx`

### 3. 📖 Mode d'emploi intégré
- **Statut** : ✅ Terminé (v2.2.8e)
- **Description** : Guide utilisateur accessible depuis les réglages, modal avec sections accordéon (Accueil, Recherche, Favoris, Réglages). Un seul accordéon ouvert à la fois. Bilingue FR/EN
- **Fichiers concernés** : `src/components/UserGuideModal.tsx`, `src/pages/SettingsPage.tsx`, `src/i18n/translations.ts`

---

## Fonctionnalités Premium futures (idées)

### 4. 📺 Chromecast / TV Casting
- Diffusion du flux audio sur Chromecast, Android TV ou tout appareil compatible Google Cast
- Nécessite le Google Cast SDK natif Android (développement conséquent)
- **Cible : v3**

### 5. 🎨 Thèmes personnalisés
- Choix de thèmes de couleurs (dark, amoled, blue, warm, etc.)
- Thème personnalisable par l'utilisateur

### 6. 📻 Qualité audio HD
- Priorisation des flux haute qualité (320 kbps)
- Indicateur de qualité dans le player

### 7. 🔇 Sans publicité
- Suppression de toute publicité future dans l'app

### 8. 📊 Statistiques d'écoute
- Temps d'écoute par jour/semaine/mois
- Stations les plus écoutées
- Genres préférés

### 9. 🌐 API Premium (nécessite abonnement)
- Accès à des contenus exclusifs via une API radio premium
- Stations en exclusivité, podcasts, replays
- **Ce cas justifierait le passage à un modèle d'abonnement**

### 10. 📂 Collections personnalisées
- Créer des collections thématiques dans les favoris (ex: "Chill", "Workout", "Jazz du soir")
- Glisser-déposer des stations entre collections
- Icône et couleur personnalisables par collection
- **Statut** : À venir (Premium)

---

## Notes techniques

- Le flag premium est géré via `src/contexts/PremiumContext.tsx`
- Pour la période de test Google Play, `isPremium` est initialisé à `true` (v2.2.8e)
- À remplacer par un vrai système de paiement (Stripe one-shot) en production
- Toutes les fonctionnalités premium doivent vérifier `isPremium` avant activation
