

## Fix : Déplacer captureStream() dans le try/catch

### Modification unique dans `src/contexts/StreamBufferContext.tsx`

**Lignes 125-135** : restructurer `startCapture` pour que `captureStream()` soit à l'intérieur du `try` existant.

Avant (lignes 125-135) :
```
    stopCapture();

    const stream = (globalAudio as any).captureStream?.() || ...;
    if (!stream) { ... return; }

    try {
```

Après :
```
    stopCapture();

    try {
      const stream = (globalAudio as any).captureStream?.() || ...;
      if (!stream) { ... return; }
```

Le reste du fichier reste strictement identique. Le `catch` existant en bas de la fonction attrape désormais le `SecurityError` de `captureStream()` sur les sources cross-origin, empêchant le crash écran noir.

