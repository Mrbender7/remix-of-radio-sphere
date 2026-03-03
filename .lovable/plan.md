
Objectif immédiat
- Restaurer une recherche fiable (plus de spinner interminable, plus d’écran “vide” ambigu) même quand Radio Browser est instable.
- Garantir une liste de pays complète quand l’API répond, et un mode dégradé clair quand elle ne répond pas.

Constat d’audit (ce qui se passe réellement)
1) L’API Radio Browser est instable selon le nœud/miroir
- Le endpoint des serveurs dynamiques renvoie actuellement surtout de1/de2.
- Tests externes: certains miroirs timeout, d’autres renvoient 403/Cloudflare.
- Donc oui: il y a bien une part “API qui ne répond plus / répond mal” selon la route réseau.

2) Le code actuel amplifie cette instabilité
- `src/services/RadioService.ts` essaie les miroirs en séquentiel (5s chacun): avec plusieurs miroirs morts, une seule requête peut prendre très longtemps.
- La recherche fait souvent 2 requêtes en parallèle (`name` + `tag`) avec `Promise.all`: si une seule branche échoue, tout échoue.
- Pas de validation stricte du format de réponse (JSON tableau attendu): une réponse HTML/objet peut casser le flux.
- Pas d’annulation des requêtes obsolètes lors de la frappe (si l’utilisateur tape vite, des requêtes anciennes restent en vol).
- React Query retry par défaut sur la recherche => rallonge encore l’attente perçue.
- Résultat: “ça tourne à vide”, “pays incomplets”, “pas stable”.

Plan d’implémentation (ordre proposé)
1) Durcir le client API (priorité haute) — `src/services/RadioService.ts`
- Ajouter un fetch sûr:
  - vérification `content-type`,
  - fallback lecture texte + détection HTML/Cloudflare,
  - validation “array attendu”.
- Remplacer la logique “séquentielle lente” par une logique plus rapide:
  - miroirs priorisés (dernier miroir sain en premier),
  - nombre d’essais borné (ex: 3 max),
  - arrêt rapide sur succès (et blacklist temporaire des miroirs en échec).
- Ajouter support d’annulation (`AbortSignal`) sur toutes les méthodes de recherche/pays.
- Conserver timeout 5s mais avec compatibilité (si `AbortSignal.timeout` indisponible, fallback `AbortController + setTimeout`).
- Ne pas considérer un miroir “OK” tant que la réponse n’est pas JSON valide (et tableau).

2) Rendre la recherche tolérante aux pannes partielles — `src/pages/SearchPage.tsx`
- Passer les combinaisons `name/tag` et multi-genres de `Promise.all` à `Promise.allSettled`.
- Fusionner les succès disponibles au lieu d’échouer globalement si 1 sous-requête tombe.
- Brancher le `signal` React Query vers le service pour annuler les anciennes recherches quand l’utilisateur tape.
- Réduire les retries de la query recherche (0 ou 1 max) pour éviter l’impression de freeze.

3) Clarifier l’état “pays indisponibles” — `src/pages/SearchPage.tsx`
- Si fallback pays utilisé, afficher un message explicite (“liste réduite temporaire”) + bouton Réessayer visible.
- Conserver le dropdown utilisable, mais distinguer clairement “données API complètes” vs “mode secours”.

4) Stabiliser les autres appels parallèles sensibles — `src/hooks/useWeeklyDiscoveries.ts`
- Remplacer `Promise.all` par `Promise.allSettled` pour que l’accueil ne casse pas si une sous-requête API tombe.
- Garder des découvertes partielles plutôt que zéro résultat.

5) Instrumentation minimale pour diagnostic rapide — `src/services/RadioService.ts`
- Logs structurés (miroir tenté, raison d’échec: timeout/HTTP/non-JSON).
- Message d’erreur métier unique renvoyé à l’UI (“serveur stations indisponible”) pour éviter des états silencieux.

Validation prévue (avant livraison)
- Test E2E recherche:
  - taper rapidement une requête (ex: “jazz”, “rock fm”),
  - vérifier qu’aucun spinner ne reste bloqué et que les anciennes requêtes sont annulées.
- Test défaillance réseau:
  - simuler miroirs KO (offline/devtools),
  - vérifier affichage erreur clair + bouton Réessayer.
- Test pays:
  - cas API OK => liste complète,
  - cas API KO => fallback visible + mention “liste réduite” + retry.
- Test non-régression:
  - filtres genre/langue/pays + pagination “Plus de stations”.

Résultat attendu après correction
- Recherche perçue comme “rapide ou clairement en erreur” (plus de “tourne à vide”).
- Plus de blocage total quand un miroir répond mal.
- Pays non “mystérieusement incomplets”: soit complet, soit fallback assumé avec retry.
- Comportement global nettement plus stable même avec une API Radio Browser intermittente.

Section technique (détails d’implémentation ciblés)
- Fichiers: `src/services/RadioService.ts`, `src/pages/SearchPage.tsx`, `src/hooks/useWeeklyDiscoveries.ts`.
- Changements clés:
  - helper `fetchJsonSafely<T>()` + garde `Array.isArray`,
  - stratégie miroir bornée et priorisée,
  - signature méthodes service compatible `signal?: AbortSignal`,
  - `queryFn: ({ signal }) => ...` dans SearchPage,
  - `Promise.allSettled` + déduplication conservée.
