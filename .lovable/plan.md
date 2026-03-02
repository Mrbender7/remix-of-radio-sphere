
# Android Auto v2.4.8 — DONE

All changes applied to `android-auto/RadioBrowserService.java` and `radiosphere_v2_4_8.ps1`.

## Changes implemented
1. **User-Agent** `RadioSphere/1.0` on all HTTP requests (followRedirects, httpGet, HEAD)
2. **Content-Type detection** via HEAD request before extension-based fallback (audio/x-scpls, audio/mpegurl)
3. **Robust PLS parsing** — case-insensitive `fileN=` matching (any number)
4. **Timeouts** increased from 5s to 8s (HTTP), 10s to 15s (buffering)
5. **Error feedback** — `setErrorMessage` on STATE_ERROR for visible AA message
6. **Genres replaced by Top Stations** (top 25 by votes via API)
7. **Favorites sorted alphabetically** (A-Z) in onLoadChildren
8. Voice search unchanged (already functional via onPlayFromSearch)
