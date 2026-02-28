import { useState, useEffect, useCallback, useRef } from "react";
import { RadioStation } from "@/types/radio";
import { registerPlugin } from "@capacitor/core";

const CAST_APP_ID = "65257ADB";

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: any;
    chrome?: any;
  }
  // eslint-disable-next-line no-var
  var chrome: any;
}

// ─── Native Capacitor Cast Plugin interface ─────────────────────────
interface CastPluginInterface {
  initialize(): Promise<{ initialized: boolean; available: boolean }>;
  requestSession(): Promise<void>;
  endSession(): Promise<void>;
  loadMedia(options: {
    streamUrl: string;
    title: string;
    logo: string;
    tags: string;
    stationId: string;
  }): Promise<void>;
  togglePlayPause(): Promise<void>;
  addListener(event: string, callback: (data: any) => void): Promise<{ remove: () => void }>;
}

const CastPlugin = registerPlugin<CastPluginInterface>("CastPlugin");

// ─── Platform detection ─────────────────────────────────────────────
function isCapacitorNative(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** Detect if the browser supports Cast (Chrome/Edge Chromium) */
function isChromiumBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Chrome\//.test(ua) && !/Edg\//.test(ua) || /Edg\//.test(ua);
}

export type CastUiMode = "launcher" | "native" | "fallback";

export function useCast() {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState<string | null>(null);
  const [castUiMode, setCastUiMode] = useState<CastUiMode>("fallback");
  const sdkLoadedRef = useRef(false);
  const remotePlayerRef = useRef<any>(null);
  const remotePlayerControllerRef = useRef<any>(null);
  const isNative = isCapacitorNative();

  useEffect(() => {
    if (sdkLoadedRef.current) return;
    sdkLoadedRef.current = true;

    if (isNative) {
      // ─── NATIVE PATH: Use Capacitor CastPlugin ───────────────
      console.log("[RadioSphere][Cast] Native platform detected, initializing CastPlugin...");
      setCastUiMode("native");

      CastPlugin.initialize()
        .then((result) => {
          console.log("[RadioSphere][Cast] CastPlugin initialized:", result);
          setIsCastAvailable(result.available);
        })
        .catch((err) => {
          console.warn("[RadioSphere][Cast] CastPlugin init error:", err);
        });

      CastPlugin.addListener("castDevicesAvailable", (data: any) => {
        console.log("[RadioSphere][Cast] Devices available:", data.available);
        setIsCastAvailable(data.available);
      });

      CastPlugin.addListener("castStateChanged", (data: any) => {
        console.log("[RadioSphere][Cast] Session state:", data);
        setIsCasting(data.connected);
        setCastDeviceName(data.connected ? data.deviceName : null);
      });
    } else {
      // ─── WEB PATH ────────────────────────────────────────────
      if (!isChromiumBrowser()) {
        console.log("[RadioSphere][Cast] Non-Chromium browser — fallback mode");
        setCastUiMode("fallback");
        return;
      }

      // Chromium detected — try launcher mode
      setCastUiMode("launcher");
      console.log("[RadioSphere][Cast] Chromium browser, setting up Cast SDK...");

      const initWebCastContext = () => {
        try {
          const cast = window.cast;
          if (!cast?.framework) {
            console.warn("[RadioSphere][Cast] cast.framework not available");
            return;
          }

          console.log("[RadioSphere][Cast] Initializing CastContext with App ID:", CAST_APP_ID);
          cast.framework.CastContext.getInstance().setOptions({
            receiverApplicationId: CAST_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
          });

          const ctx = cast.framework.CastContext.getInstance();

          ctx.addEventListener(
            cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
            (event: any) => {
              const session = ctx.getCurrentSession();
              if (
                event.sessionState === cast.framework.SessionState.SESSION_STARTED ||
                event.sessionState === cast.framework.SessionState.SESSION_RESUMED
              ) {
                setIsCasting(true);
                setCastDeviceName(session?.getCastDevice()?.friendlyName || null);
                remotePlayerRef.current = new cast.framework.RemotePlayer();
                remotePlayerControllerRef.current = new cast.framework.RemotePlayerController(remotePlayerRef.current);
              } else if (
                event.sessionState === cast.framework.SessionState.SESSION_ENDED
              ) {
                setIsCasting(false);
                setCastDeviceName(null);
                remotePlayerRef.current = null;
                remotePlayerControllerRef.current = null;
              }
            }
          );

          ctx.addEventListener(
            cast.framework.CastContextEventType.CAST_STATE_CHANGED,
            (event: any) => {
              const available = event.castState !== cast.framework.CastState.NO_DEVICES_AVAILABLE;
              console.log("[RadioSphere][Cast] Cast state changed:", event.castState, "available:", available);
              setIsCastAvailable(available);
            }
          );

          setIsCastAvailable(true);
          console.log("[RadioSphere][Cast] CastContext initialized successfully");
        } catch (e) {
          console.warn("[RadioSphere][Cast] SDK init error:", e);
        }
      };

      // Case 1: SDK already loaded (race condition fix)
      if (window.cast?.framework) {
        console.log("[RadioSphere][Cast] SDK already available, initializing immediately");
        initWebCastContext();
      }

      // Case 2: Normal callback path
      window.__onGCastApiAvailable = (isAvailable: boolean) => {
        console.log("[RadioSphere][Cast] __onGCastApiAvailable:", isAvailable);
        if (!isAvailable) return;
        initWebCastContext();
      };

      // Case 3: Safety timeout — if SDK never calls back after 8s, mark unavailable
      const safetyTimeout = setTimeout(() => {
        if (!window.cast?.framework) {
          console.log("[RadioSphere][Cast] Safety timeout: SDK never loaded, staying in launcher mode with low opacity");
        }
      }, 8000);

      return () => clearTimeout(safetyTimeout);
    }
  }, [isNative]);

  const startCast = useCallback(() => {
    if (isNative) {
      CastPlugin.requestSession().catch((e) =>
        console.warn("[RadioSphere][Cast] requestSession error:", e)
      );
    } else {
      try {
        window.cast?.framework?.CastContext?.getInstance()?.requestSession();
      } catch (e) {
        console.warn("[RadioSphere][Cast] Cast request error:", e);
      }
    }
  }, [isNative]);

  const stopCast = useCallback(() => {
    if (isNative) {
      CastPlugin.endSession().catch((e) =>
        console.warn("[RadioSphere][Cast] endSession error:", e)
      );
    } else {
      try {
        window.cast?.framework?.CastContext?.getInstance()?.getCurrentSession()?.endSession(true);
      } catch (e) {
        console.warn("[RadioSphere][Cast] Cast stop error:", e);
      }
    }
  }, [isNative]);

  const loadMedia = useCallback(
    (station: RadioStation) => {
      if (isNative) {
        CastPlugin.loadMedia({
          streamUrl: station.streamUrl,
          title: station.name,
          logo: station.logo || "",
          tags: (station.tags || []).join(","),
          stationId: station.id,
        }).catch((e) =>
          console.warn("[RadioSphere][Cast] loadMedia error:", e)
        );
      } else {
        try {
          const session = window.cast?.framework?.CastContext?.getInstance()?.getCurrentSession();
          if (!session) return;

          const chr = window.chrome;
          const mediaInfo = new chr.cast.media.MediaInfo(station.streamUrl, "audio/mpeg");
          mediaInfo.metadata = new chr.cast.media.MusicTrackMediaMetadata();
          mediaInfo.metadata.title = station.name;
          mediaInfo.metadata.artist = "Radio Sphere";

          const logoUrl = station.logo
            ? station.logo.replace("http://", "https://")
            : `${window.location.origin}/favicon.png`;
          mediaInfo.metadata.images = [new chr.cast.Image(logoUrl)];

          mediaInfo.customData = {
            tags: station.tags || [],
            stationId: station.id,
          };

          const request = new chr.cast.media.LoadRequest(mediaInfo);
          session.loadMedia(request).then(
            () => console.log("[RadioSphere][Cast] Media loaded"),
            (err: any) => console.warn("[RadioSphere][Cast] Load error:", err)
          );
        } catch (e) {
          console.warn("[RadioSphere][Cast] loadMedia error:", e);
        }
      }
    },
    [isNative]
  );

  const toggleCastPlayPause = useCallback(() => {
    if (isNative) {
      CastPlugin.togglePlayPause().catch((e) =>
        console.warn("[RadioSphere][Cast] togglePlayPause error:", e)
      );
    } else {
      if (remotePlayerControllerRef.current) {
        remotePlayerControllerRef.current.playOrPause();
      }
    }
  }, [isNative]);

  return {
    isCastAvailable,
    isCasting,
    castDeviceName,
    castUiMode,
    startCast,
    stopCast,
    loadMedia,
    toggleCastPlayPause,
  };
}
