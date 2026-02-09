

# Fix: Audio Stopping After 5-10 Seconds in Background on Android

## Problem

Android aggressively suspends WebView processes when the app goes to background, killing the audio stream after 5-10 seconds despite existing WakeLock and visibilitychange listeners.

## Strategy

Combine 4 techniques in `src/contexts/PlayerContext.tsx` to keep the WebView process alive:

---

## 1. Silent Audio Keep-Alive Loop

Create a second global `Audio` element that plays a tiny silent audio loop continuously when the radio is active. This tricks Android into classifying the WebView as an active media process ("Media Priority"), preventing suspension.

- Generate a silent WAV file as a base64 data URI (no external file needed)
- Start the silent loop when `play()` is called
- Stop it when `togglePlay()` pauses or on error
- The silent audio is inaudible (volume set to 0.01) and uses minimal resources

```typescript
// Silent 1-second WAV as base64 data URI
const SILENCE_DATA_URI = "data:audio/wav;base64,UklGR..."; // ~1KB
const silentAudio = new Audio();
silentAudio.loop = true;
silentAudio.volume = 0.01;
silentAudio.src = SILENCE_DATA_URI;
```

## 2. Enhanced MediaSession API (Already Mostly Done)

The current implementation already has metadata and action handlers. Minor improvements:

- Add `seekbackward` and `seekforward` handlers (set to no-op) to prevent Android from showing broken seek controls
- Ensure `playbackState` is always synchronized after every state change

## 3. Improved Visibility API Handling

The current `keepAlive` listener only calls `audio.play()`. Enhance it to:

- Also restart the silent keep-alive audio
- Re-request the WakeLock (it gets released when screen turns off)
- Add a periodic "heartbeat" interval (every 10 seconds) that checks if audio should still be playing and restarts it if paused unexpectedly

```typescript
// Heartbeat: detect and recover from unexpected pauses
const heartbeat = setInterval(() => {
  if (isPlayingRef.current && audio.paused) {
    audio.play().catch(() => {});
    silentAudio.play().catch(() => {});
    requestWakeLock();
  }
}, 10000);
```

## 4. WakeLock Re-acquisition

The current WakeLock implementation is correct but doesn't re-acquire after screen lock/unlock cycles. Add:

- Re-request WakeLock on `visibilitychange` when document becomes visible again
- This is already partially done but will be strengthened

---

## Technical Details

### File Modified

`src/contexts/PlayerContext.tsx` -- single file, all changes concentrated here.

### Changes Summary

| Change | Description |
|---|---|
| Add `silentAudio` global instance | Second Audio element with silent WAV data URI, looped |
| `startSilentLoop()` / `stopSilentLoop()` helpers | Start/stop the silent audio tied to playback state |
| Update `play()` | Start silent loop alongside main audio |
| Update `togglePlay()` | Start/stop silent loop alongside main toggle |
| Add heartbeat interval | 10-second periodic check to recover from unexpected pauses |
| Add no-op `seekbackward`/`seekforward` handlers | Prevent broken seek controls on Android notification |
| Enhance `keepAlive` | Also restart silent audio + re-request WakeLock |

### No New Dependencies

Everything uses built-in Web APIs. The silent WAV is embedded as a base64 data URI (~1KB).

