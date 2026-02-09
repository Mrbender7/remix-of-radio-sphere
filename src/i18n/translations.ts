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
    "premium.monthly": "Mensuel — 4,99€/mois",
    "premium.yearly": "Annuel — 49,99€/an",
    "premium.yearlySave": "-17%",
    "premium.cancel": "Annuler l'abonnement",
    "premium.disclaimer": "Annulez à tout moment. Les prix peuvent varier selon votre région.",

    // Player
    "player.nowPlaying": "En cours de lecture",
    "player.streamError": "Erreur de lecture",
    "player.streamErrorDesc": "Impossible de lire ce flux. Essayez une autre station.",
    "player.error": "Erreur",
    "player.streamUnavailable": "Flux indisponible",

    // Settings
    "settings.title": "Réglages",
    "settings.language": "Langue",
    "settings.languageDesc": "Choisissez la langue de l'interface",
    "settings.french": "Français",
    "settings.english": "English",
    "settings.dataWarning": "Utilisation des données",
    "settings.dataWarningDesc": "L'écoute de stations de radio utilise votre connexion internet et peut consommer des données mobiles. Nous recommandons une connexion Wi-Fi pour une utilisation prolongée.",
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
    "premium.monthly": "Monthly — €4.99/mo",
    "premium.yearly": "Yearly — €49.99/yr",
    "premium.yearlySave": "-17%",
    "premium.cancel": "Cancel subscription",
    "premium.disclaimer": "Cancel anytime. Prices may vary by region.",

    // Player
    "player.nowPlaying": "Now playing",
    "player.streamError": "Playback error",
    "player.streamErrorDesc": "Unable to play this stream. Try another station.",
    "player.error": "Error",
    "player.streamUnavailable": "Stream unavailable",

    // Settings
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.languageDesc": "Choose the interface language",
    "settings.french": "Français",
    "settings.english": "English",
    "settings.dataWarning": "Data usage",
    "settings.dataWarningDesc": "Listening to radio stations uses your internet connection and may consume mobile data. We recommend using Wi-Fi for extended listening.",
  },
};

export default translations;
