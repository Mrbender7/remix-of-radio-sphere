

# Nettoyage affichage Android Auto -- Titre seul

## Objectif

Supprimer l'affichage des tags, pays et autres metadonnees dans toutes les vues Android Auto (liste des favoris, recents, genres, player en cours de lecture). Seul le nom de la station sera visible. Les sous-titres afficheront simplement "Radio Sphere" de maniere uniforme.

## Zones impactees

Il y a **2 endroits** dans `RadioBrowserService.java` (et leur copie dans le script PS1) ou les tags/pays sont utilises pour l'affichage :

### 1. Player (metadonnees MediaSession) -- methode `playStation()`
- **ARTIST** : actuellement construit a partir des tags de la station
- **ALBUM** : actuellement le pays de la station

Correction : `artist = "Radio Sphere"`, `album = "Live"`

### 2. Liste de navigation (browse tree) -- methode `buildPlayableItem()`
- **Subtitle** : actuellement construit a partir des tags puis du pays

Correction : `subtitle = "Radio Sphere"` (fixe)

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `android-auto/RadioBrowserService.java` | Simplifier `playStation()` et `buildPlayableItem()` pour n'afficher que le nom |
| `radiosphere_v2_2_8.ps1` | Memes corrections dans la copie du fichier Java embarquee dans le script |

## Detail technique

### RadioBrowserService.java

**playStation()** (lignes 370-381) : Remplacer le bloc de construction `artist` (if/tags/StringBuilder) et `album` par :
```java
String artist = "Radio Sphere";
String album = "Live";
```

**buildPlayableItem()** (lignes 534-546) : Remplacer le bloc de construction `subtitle` (if/tags/StringBuilder/country) par :
```java
String subtitle = "Radio Sphere";
```

### radiosphere_v2_2_8.ps1

Memes modifications exactes dans le here-string Java correspondant (lignes 629-640 et 803-815).

