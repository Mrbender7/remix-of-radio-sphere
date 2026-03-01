

## Correction PS1 v2.4.0 — Permissions réseau Cast manquantes

### Problème identifié

L'analyse Android Studio a identifié **3 permissions réseau manquantes** qui empêchent le SDK Cast de scanner le réseau Wi-Fi pour découvrir les appareils Chromecast. Le script `radiosphere_v2_4_0.ps1` injecte déjà `CastPlugin` dans la `MainActivity` (ligne 1359), mais la liste des permissions (lignes 114-121) ne contient pas les permissions réseau requises par le Cast SDK.

### Correction

**Fichier** : `radiosphere_v2_4_0.ps1`

Ajouter 3 permissions à la liste `$PermsList` (lignes 114-121) :

- `android.permission.ACCESS_NETWORK_STATE` -- requis pour que le Cast SDK vérifie la connectivité réseau
- `android.permission.ACCESS_WIFI_STATE` -- requis pour la découverte mDNS des appareils Cast
- `android.permission.CHANGE_WIFI_MULTICAST_STATE` -- requis pour la découverte mDNS sur certaines versions Android

Mettre à jour le bloc de résumé final pour refléter l'ajout des permissions.

### Ce qui est déjà correct (pas de changement)

- `registerPlugin(CastPlugin.class)` dans `MainActivity` (ligne 1359)
- `CastOptionsProvider` dans le Manifest (ligne 165)
- Dépendances Gradle Cast (lignes 203-204)
- `CastPlugin.java` avec `MediaRouteChooserDialog` (ligne 653)

### Impact

Modification minimale : 3 lignes ajoutées dans la liste des permissions + 1 ligne dans le résumé. Aucun autre fichier impacté.

