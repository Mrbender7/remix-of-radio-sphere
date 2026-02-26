export type Language = "fr" | "en";

const translations: Record<Language, Record<string, string>> = {
  fr: {
    // Nav
    "nav.home": "Accueil",
    "nav.search": "Recherche",
    "nav.favorites": "Favoris",
    "nav.premium": "Premium",
    "nav.settings": "Réglages",

    // Home
    "home.greeting": "Bonjour 👋",
    "home.recentlyPlayed": "Écoutées récemment",
    "home.popularStations": "Stations populaires",
    "home.localPopular": "Stations populaires",
    "home.exploreByGenre": "Explorer par genre",
    "home.yourFavorites": "Vos favoris",
    "home.weeklyDiscoveries": "Découvertes de la semaine",
    "home.noFavorites": "Ajoutez des favoris pour les retrouver ici",

    // Search
    "search.title": "Recherche",
    "search.placeholder": "Rechercher une station...",
    "search.country": "Pays",
    "search.selectCountry": "Choisir un pays",
    "search.clearCountry": "Effacer le pays",
    "search.resetFilters": "Réinitialiser les filtres",
    "search.noResults": "Aucun résultat trouvé",
    "search.useFilters": "Utilisez la recherche ou les filtres pour trouver des stations",
    "search.genre": "Genre",
    "search.language": "Langue",
    "search.loadMore": "Plus de stations",
    "search.loadingMore": "Chargement...",
    "search.sortPopularity": "Popularité",
    "search.sortAZ": "A-Z",
    "search.sortClicks": "Clicks",

    // Favorites
    "favorites.title": "Favoris",
    "favorites.empty": "Aucun favori",
    "favorites.emptyDesc": "Appuyez sur le cœur d'une station pour l'ajouter à vos favoris",

    // Premium
    "premium.title": "Radio Sphere Premium",
    "premium.subtitle": "L'expérience radio ultime",
    "premium.active": "Premium actif",
    "premium.noAds": "Sans publicité",
    "premium.noAdsDesc": "Écoute ininterrompue, sans aucune pub",
    "premium.hd": "Qualité HD",
    "premium.hdDesc": "Audio haute qualité jusqu'à 320 kbps",
    "premium.exclusive": "Accès exclusif",
    "premium.exclusiveDesc": "Stations premium et contenus exclusifs",
    "premium.monthly": "Achat unique — 9,99€",
    "premium.yearly": "",
    "premium.yearlySave": "",
    "premium.cancel": "Restaurer l'achat",
    "premium.disclaimer": "Achat unique, accès à vie. Pas d'abonnement.",
    "premium.comingSoon": "Arrive bientôt",
    "premium.passwordPlaceholder": "Entrez le code d'accès",
    "premium.unlock": "Déverrouiller",
    "premium.lock": "Verrouiller Premium",
    "premium.wrongPassword": "Code incorrect",
    "premium.unlocked": "Premium déverrouillé !",

    // Sleep Timer
    "sleepTimer.title": "Minuterie de sommeil",
    "sleepTimer.desc": "Arrête automatiquement la lecture après un délai",
    "sleepTimer.off": "Désactivée",
    "sleepTimer.active": "Actif",
    "sleepTimer.remaining": "Restant",
    "sleepTimer.cancel": "Annuler la minuterie",
    "sleepTimer.stopped": "La lecture a été mise en pause automatiquement.",

    // Player
    "player.nowPlaying": "En cours de lecture",
    "player.streamError": "Erreur de lecture",
    "player.streamErrorDesc": "Impossible de lire ce flux. Essayez une autre station.",
    "player.error": "Erreur",
    "player.streamUnavailable": "Cette station n'a pas d'URL de flux.",
    "player.visitWebsite": "Visiter le site",
    "player.timeout": "Délai dépassé",
    "player.timeoutDesc": "Le flux ne répond pas. Essayez une autre station.",
    "player.unexpectedError": "Erreur inattendue",
    "player.unexpectedErrorDesc": "Une erreur est survenue. Réessayez.",

    // Exit
    "exit.title": "Fermer l'application ?",
    "exit.description": "Appuyez une fois de plus pour quitter RadioSphere.",
    "exit.confirm": "Quitter",

    // Common
    "common.cancel": "Annuler",

    // Settings
    "settings.title": "Réglages",
    "settings.language": "Langue",
    "settings.languageDesc": "Choisissez la langue de l'interface",
    "settings.french": "Français",
    "settings.english": "English",
    "settings.dataWarning": "Utilisation des données",
    "settings.dataWarningDesc": "L'écoute de stations de radio utilise votre connexion internet et peut consommer des données mobiles. Nous recommandons une connexion Wi-Fi pour une utilisation prolongée.",
    "settings.dataDisclaimer": "Données locales",
    "settings.dataDisclaimerDesc": "Vos favoris et préférences sont stockés localement sur votre appareil. Aucune donnée personnelle n'est envoyée à un serveur.",
    "settings.radioSource": "Source des stations",
    "settings.radioSourceDesc": "La liste des stations est fournie par Radio Browser, une API communautaire libre et gratuite qui recense plus de 50 000 radios à travers le monde.",
    "settings.radioSourceLink": "Visiter Radio Browser",
    "settings.radioSourceAddStation": "Ajouter une station",

    // Favorites management
    "favorites.manage": "Gérer les favoris",
    "favorites.export": "Exporter en CSV",
    "favorites.import": "Importer un CSV",
    "favorites.share": "Partager mes favoris",
    "favorites.exported": "Favoris exportés",
    "favorites.imported": "favoris importés",
    "favorites.importError": "Erreur lors de l'import",
    "favorites.noFavoritesToExport": "Aucun favori à exporter",

    // Privacy
    "settings.privacyPolicy": "Politique de confidentialité",

    // User Guide
    "guide.title": "Mode d'emploi",
    "guide.button": "Mode d'emploi",
    "guide.home": "Accueil",
    "guide.homeContent": "L'écran d'accueil affiche vos stations écoutées récemment, les stations populaires, vos favoris en accès rapide, les découvertes de la semaine et l'exploration par genre musical.",
    "guide.search": "Recherche",
    "guide.searchContent": "Recherchez une station par nom, puis filtrez par pays, genre ou langue. Triez les résultats par popularité, ordre alphabétique ou nombre de clics. Chargez plus de résultats en bas de page.",
    "guide.favorites": "Favoris",
    "guide.favoritesContent": "Appuyez sur le cœur d'une station pour l'ajouter à vos favoris. Depuis les réglages, vous pouvez exporter vos favoris en CSV, en importer, ou les partager.",
    "guide.settings": "Réglages",
    "guide.settingsContent": "Changez la langue de l'interface, activez la minuterie de sommeil, gérez vos favoris (export/import/partage), consultez les informations sur la source des stations et la politique de confidentialité.",
  },
  en: {
    // Nav
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.favorites": "Favorites",
    "nav.premium": "Premium",
    "nav.settings": "Settings",

    // Home
    "home.greeting": "Hello 👋",
    "home.recentlyPlayed": "Recently played",
    "home.popularStations": "Popular stations",
    "home.localPopular": "Popular stations",
    "home.exploreByGenre": "Explore by genre",
    "home.yourFavorites": "Your favorites",
    "home.weeklyDiscoveries": "Weekly discoveries",
    "home.noFavorites": "Add favorites to see them here",

    // Search
    "search.title": "Search",
    "search.placeholder": "Search for a station...",
    "search.country": "Country",
    "search.selectCountry": "Select a country",
    "search.clearCountry": "Clear country",
    "search.resetFilters": "Reset filters",
    "search.noResults": "No results found",
    "search.useFilters": "Use the search bar or filters to find stations",
    "search.genre": "Genre",
    "search.language": "Language",
    "search.loadMore": "More stations",
    "search.loadingMore": "Loading...",
    "search.sortPopularity": "Popularity",
    "search.sortAZ": "A-Z",
    "search.sortClicks": "Clicks",

    // Favorites
    "favorites.title": "Favorites",
    "favorites.empty": "No favorites",
    "favorites.emptyDesc": "Tap the heart on a station to add it to your favorites",

    // Premium
    "premium.title": "Radio Sphere Premium",
    "premium.subtitle": "The ultimate radio experience",
    "premium.active": "Premium active",
    "premium.noAds": "Ad-free",
    "premium.noAdsDesc": "Uninterrupted listening, no ads ever",
    "premium.hd": "HD Quality",
    "premium.hdDesc": "High quality audio up to 320 kbps",
    "premium.exclusive": "Exclusive access",
    "premium.exclusiveDesc": "Premium stations and exclusive content",
    "premium.monthly": "One-time purchase — €9.99",
    "premium.yearly": "",
    "premium.yearlySave": "",
    "premium.cancel": "Restore purchase",
    "premium.disclaimer": "One-time purchase, lifetime access. No subscription.",
    "premium.comingSoon": "Coming soon",
    "premium.passwordPlaceholder": "Enter access code",
    "premium.unlock": "Unlock",
    "premium.lock": "Lock Premium",
    "premium.wrongPassword": "Wrong code",
    "premium.unlocked": "Premium unlocked!",

    // Sleep Timer
    "sleepTimer.title": "Sleep Timer",
    "sleepTimer.desc": "Automatically stops playback after a set time",
    "sleepTimer.off": "Off",
    "sleepTimer.active": "Active",
    "sleepTimer.remaining": "Remaining",
    "sleepTimer.cancel": "Cancel timer",
    "sleepTimer.stopped": "Playback was automatically paused.",

    // Player
    "player.nowPlaying": "Now playing",
    "player.streamError": "Playback error",
    "player.streamErrorDesc": "Unable to play this stream. Try another station.",
    "player.error": "Error",
    "player.streamUnavailable": "This station has no stream URL.",
    "player.visitWebsite": "Visit website",
    "player.timeout": "Timeout",
    "player.timeoutDesc": "The stream is not responding. Try another station.",
    "player.unexpectedError": "Unexpected error",
    "player.unexpectedErrorDesc": "An error occurred. Please try again.",

    // Exit
    "exit.title": "Close app?",
    "exit.description": "Press back one more time to exit RadioSphere.",
    "exit.confirm": "Exit",

    // Common
    "common.cancel": "Cancel",

    // Settings
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.languageDesc": "Choose the interface language",
    "settings.french": "Français",
    "settings.english": "English",
    "settings.dataWarning": "Data usage",
    "settings.dataWarningDesc": "Listening to radio stations uses your internet connection and may consume mobile data. We recommend using Wi-Fi for extended listening.",
    "settings.dataDisclaimer": "Local data",
    "settings.dataDisclaimerDesc": "Your favorites and preferences are stored locally on your device. No personal data is sent to any server.",
    "settings.radioSource": "Station source",
    "settings.radioSourceDesc": "The station list is provided by Radio Browser, a free and open community API that indexes over 50,000 radio stations worldwide.",
    "settings.radioSourceLink": "Visit Radio Browser",
    "settings.radioSourceAddStation": "Add a station",

    // Favorites management
    "favorites.manage": "Manage favorites",
    "favorites.export": "Export as CSV",
    "favorites.import": "Import CSV",
    "favorites.share": "Share my favorites",
    "favorites.exported": "Favorites exported",
    "favorites.imported": "favorites imported",
    "favorites.importError": "Import error",
    "favorites.noFavoritesToExport": "No favorites to export",

    // Privacy
    "settings.privacyPolicy": "Privacy Policy",

    // User Guide
    "guide.title": "User Guide",
    "guide.button": "User Guide",
    "guide.home": "Home",
    "guide.homeContent": "The home screen shows your recently played stations, popular stations, quick access to favorites, weekly discoveries, and genre exploration.",
    "guide.search": "Search",
    "guide.searchContent": "Search for a station by name, then filter by country, genre, or language. Sort results by popularity, alphabetical order, or click count. Load more results at the bottom.",
    "guide.favorites": "Favorites",
    "guide.favoritesContent": "Tap the heart icon on a station to add it to your favorites. From settings, you can export your favorites as CSV, import them, or share them.",
    "guide.settings": "Settings",
    "guide.settingsContent": "Change the interface language, enable the sleep timer, manage your favorites (export/import/share), view station source information and the privacy policy.",
  },
};

export default translations;
