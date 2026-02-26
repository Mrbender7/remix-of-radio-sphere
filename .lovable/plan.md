

# Garde-fou anti-coupure audio (ecran verrouille)

## Probleme

Quand le telephone est verrouille, le stream peut s'arreter silencieusement. Le heartbeat actuel (toutes les 10s) ne detecte que `audio.paused`, mais quand le stream meurt, l'element audio peut etre dans un etat "stalled" ou "ended" sans etre techniquement en pause. De plus, le bouton Play/Pause tente juste `audio.play()` sur une source morte, ce qui ne fonctionne pas -- il faut recharger le flux completement.

## Solution

Trois ameliorations dans `src/contexts/PlayerContext.tsx` :

### 1. Ecouter les evenements `stalled` et `ended`

Ajouter des listeners sur l'element audio pour detecter quand le flux se coupe. En cas de coupure, recharger automatiquement le stream (reset src + load + play) au lieu de simplement appeler `play()`.

- Limite a 3 tentatives consecutives (compteur reset quand la lecture reprend avec succes)
- Delai de 2 secondes entre chaque tentative pour ne pas surcharger

### 2. Ameliorer le heartbeat

Le heartbeat (10s) verifiera aussi `audio.networkState` et `audio.readyState` en plus de `audio.paused`. Si le stream semble mort (networkState idle ou readyState trop bas) alors que l'app pense qu'on joue, il relancera le flux complet plutot qu'un simple `play()`.

### 3. Corriger le togglePlay (resume apres coupure)

Quand l'utilisateur appuie Play apres une coupure, si `audio.play()` echoue ou si l'audio n'a plus de source valide, recharger le flux complet automatiquement (meme comportement que changer de station et revenir). Plus besoin de changer de station manuellement.

## Detail technique

- Nouveau ref `retryCountRef` pour limiter les tentatives (max 3)
- Nouvelle fonction `reloadStream()` : reset src, load, canplay listener, play -- reutilise la logique existante de `play()` mais sans changer de station
- Listeners `stalled` et `ended` ajoutees dans le useEffect principal (lignes 291-326)
- `togglePlay` modifie pour appeler `reloadStream()` si `play()` echoue
- Heartbeat enrichi avec verification `networkState === 3` (NETWORK_NO_SOURCE) ou `readyState < 2`

## Fichier modifie

| Fichier | Action |
|---------|--------|
| `src/contexts/PlayerContext.tsx` | Ajout reloadStream, listeners stalled/ended, heartbeat ameliore, togglePlay robuste |

