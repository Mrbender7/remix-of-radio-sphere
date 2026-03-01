
Objectif validé: corriger la non-détection Chromecast sur Android (APK) en traitant les permissions Android 13+, les permissions runtime, le diagnostic natif (routes trouvées), et l’alignement App ID (custom vs CC1AD845), puis sécuriser l’appel côté frontend.

Constats confirmés dans le code actuel (audit)
1) Les 3 permissions déjà ajoutées dans le script (`ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`) sont présentes dans `radiosphere_v2_4_0.ps1`.
2) Il manque bien les permissions demandées pour Android récents:
- `NEARBY_WIFI_DEVICES` (avec `usesPermissionFlags="neverForLocation"`)
- `ACCESS_FINE_LOCATION` (utile selon devices/versions pour découverte locale).
3) `CastPlugin` est bien enregistré via le patch `MainActivity` dans le script PS1.
4) `CastPlugin.java` ne gère pas encore les permissions runtime Cast (location/nearby wifi) et ne log pas le nombre de routes (`router.getRoutes().size()`).
5) `useCast.ts` appelle déjà `initialize()` au montage en natif, mais sans handshake explicite “native ready + permissions Cast accordées”.
6) Le repo ne contient pas directement `android/app/...` version compilable; les changements Android doivent donc être portés via:
- `radiosphere_v2_4_0.ps1` (source de vérité d’injection)
- `android-auto/*` (templates natifs/documentation).

Plan d’implémentation (séquencé)
1) Renforcer l’injection Manifest dans `radiosphere_v2_4_0.ps1`
- Étendre la logique de permissions pour inclure:
  - `<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" android:usesPermissionFlags="neverForLocation" />`
  - `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />`
- Comme `NEARBY_WIFI_DEVICES` exige un attribut additionnel, remplacer la liste “noms simples” par une liste de tags XML complets (ou traitement conditionnel dédié) afin de conserver le flag `neverForLocation`.
- Mettre à jour le résumé de fin du script avec ces deux permissions pour la traçabilité.

2) Ajouter la gestion runtime permissions dans `android-auto/CastPlugin.java`
- Ajouter les aliases de permissions Capacitor dans `@CapacitorPlugin(...)`:
  - alias location (`ACCESS_FINE_LOCATION`)
  - alias nearby wifi (`NEARBY_WIFI_DEVICES`)
- Ajouter méthodes plugin explicites:
  - `checkDiscoveryPermissions()`
  - `requestDiscoveryPermissions()` (avec callback `@PermissionCallback`)
- Dans `requestSession()`, bloquer l’ouverture du chooser si permissions manquantes, demander les permissions, puis reprendre l’action (ou renvoyer erreur claire si refus).
- Dans `initialize()`, journaliser l’état des permissions et renvoyer un payload plus riche (`available`, `permissionsGranted`, éventuellement `reason`) pour aider le frontend à décider s’il doit demander les permissions.

3) Ajouter le logging diagnostic demandé dans `android-auto/CastPlugin.java`
- Dans `updateDeviceAvailability(MediaRouter router)`:
  - log `router.getRoutes().size()`
  - log nombre de routes matchant le selector Cast
  - log noms/routes retenues (en debug).
- Appeler `updateDeviceAvailability(mediaRouter)` juste après `addCallback(...)` pour avoir un état initial immédiat (pas seulement sur events add/remove/change).
- Option robustesse: utiliser aussi `CALLBACK_FLAG_PERFORM_ACTIVE_SCAN` en complément de `REQUEST_DISCOVERY` pendant la session active de l’app (diagnostic plus fiable).

4) Aligner la stratégie App ID Cast (test vs production)
Fichiers:
- `android-auto/CastPlugin.java`
- `android-auto/CastOptionsProvider.java`
- `src/hooks/useCast.ts`
- `radiosphere_v2_4_0.ps1` (blocs Java générés + résumé)

Approche:
- Introduire une stratégie explicite “test receiver” temporaire:
  - production: `65257ADB`
  - test: `CC1AD845` (ou `CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID`)
- Éviter les incohérences: `CastPlugin` et `CastOptionsProvider` doivent utiliser la même valeur au même moment.
- Exposer dans les logs natifs/web l’App ID réellement utilisé pour éviter toute ambiguïté pendant le diagnostic.
- Côté web (`useCast.ts`), garder l’App ID configurable (ex: variable d’environnement) pour tests Chrome hors APK.

5) Sécuriser le flux frontend natif dans `src/hooks/useCast.ts`
- Ajouter un petit handshake “plateforme prête” avant init native (Capacitor bridge prêt + plugin disponible).
- Avant `requestSession()`, appeler un `ensureNativeCastPermissions()`:
  - check permissions via plugin
  - request si nécessaire
  - si refus, ne pas lancer session et remonter un état clair (`castInitState`/log).
- Conserver l’init auto existante, mais ne plus considérer le chemin natif comme “ready” si les permissions Cast ne sont pas accordées.

6) Mettre à jour les templates/doc pour cohérence d’équipe
- `android-auto/README-SETUP.md`:
  - ajouter permissions `NEARBY_WIFI_DEVICES` + `ACCESS_FINE_LOCATION`
  - préciser qu’il faut accorder les permissions runtime au premier lancement ou au clic Cast
  - ajouter note Android 13+ (Nearby Wi-Fi requis).
- Optionnel: enrichir `android-auto/AndroidManifest-snippet.xml` avec section “permissions à ajouter au niveau `<manifest>`” (même si le snippet principal cible `<application>`).

Détails techniques / points d’attention
- `NEARBY_WIFI_DEVICES` est critique Android 13+; sans runtime grant, la découverte peut rester vide.
- Selon appareils Android, `ACCESS_FINE_LOCATION` reste nécessaire pour certaines APIs de scan local.
- Si l’App ID custom n’est pas autorisé pour `com.radiosphere.app` dans la console Cast SDK, la découverte/sélection peut être instable ou inopérante; le test temporaire avec `CC1AD845` permet d’isoler rapidement “problème réseau/permissions” vs “problème de receiver registration”.
- Le repo n’ayant pas `android/` versionnée ici, la correction réelle côté APK passera par:
  1. mise à jour script + templates
  2. exécution du PS1 en local sur le vrai projet Android
  3. `npx cap sync`
  4. rebuild Android Studio.

Validation (critères d’acceptation)
1) APK Android 13+:
- Au premier usage Cast, permission prompt visible.
- Après acceptation, `Logcat` montre routes > 0 (ou au moins nombre de routes détectées).
- Le bouton Cast ouvre le chooser et détecte les devices du réseau.
2) APK Android <=12:
- Demande location si nécessaire, puis découverte fonctionnelle.
3) Test App ID:
- Avec `CC1AD845`, détection OK = pipeline permissions/réseau validé.
- Repassage à `65257ADB` pour confirmer configuration console Cast/package.
4) Frontend:
- plus d’appel “silencieux” à `requestSession` si permissions refusées/non prêtes; état explicite dans les logs.

Fichiers à modifier lors de l’implémentation
- `radiosphere_v2_4_0.ps1`
- `android-auto/CastPlugin.java`
- `android-auto/CastOptionsProvider.java`
- `src/hooks/useCast.ts`
- `android-auto/README-SETUP.md`
- (optionnel) `android-auto/AndroidManifest-snippet.xml`
