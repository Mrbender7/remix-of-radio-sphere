# RadioSphere — Historique des versions

---

## v1.0.0 — 7 mars 2026 — *Première release Google Play*

**Statut :** En cours d'examen sur Google Play  
**Package :** `com.fhm.radiosphere`  
**Plateforme :** Android (Capacitor)

### Résumé

RadioSphere est une application de radio en streaming qui permet d'écouter des milliers de stations du monde entier via l'API Radio Browser. L'app propose une expérience immersive avec un lecteur plein écran, un visualiseur audio, la gestion des favoris, un historique d'écoute, et des fonctionnalités premium comme Android Auto, Chromecast et un Sleep Timer.

### Fonctionnalités

#### Core
- 🎵 Lecture radio en streaming (API Radio Browser — 30 000+ stations)
- 🔍 Recherche avancée multi-filtres (nom, genre, pays, langue)
- ❤️ Favoris avec stockage local persistant
- 🕐 Historique des stations récemment écoutées
- 🌍 Interface multilingue (FR, EN, ES, DE, JA)
- 🎨 Thème sombre natif
- 🏠 Page d'accueil avec Top Stations, découvertes hebdomadaires, récents et favoris

#### Lecteur
- MiniPlayer avec défilement marquee à vitesse constante (40px/s)
- FullScreenPlayer avec visualiseur audio animé
- Tags cliquables (lancement de recherche filtrée)
- Contrôle du volume
- Indicateur de buffering en temps réel
- Partage de station

#### Premium
- 🚗 Android Auto (browse tree, recherche vocale, ExoPlayer natif, navigation next/previous)
- 📺 Chromecast (Google Cast SDK natif, Default Media Receiver)
- 💤 Sleep Timer (15 min à 2h, décompte temps réel)
- 📖 Mode d'emploi intégré (UserGuideModal)

#### Android natif
- Notification MediaStyle (contrôles play/pause/stop sur écran de verrouillage)
- Gestion AudioFocus (pause automatique lors d'appels)
- Foreground Service pour lecture en arrière-plan
- Bouton retour natif avec dialogue de confirmation de sortie

### Technologies

| Catégorie | Technologie |
|-----------|-------------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| UI | Tailwind CSS 3 + shadcn/ui + Radix UI |
| État | React Context (Player, Favorites, Language, Premium, SleepTimer) |
| Cache API | TanStack React Query 5 |
| Routing | React Router DOM 6 |
| Natif | Capacitor 8 (Android) |
| Audio Android | ExoPlayer (Android Auto) |
| Cast | Google Cast SDK (Chromecast) |
| Icônes | Lucide React + Iconify |
| Animations | CSS Keyframes + Audio Visualizer canvas |

---

*Les versions suivantes seront documentées ici au fil des mises à jour.*
