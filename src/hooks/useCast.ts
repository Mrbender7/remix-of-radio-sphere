import { useState, useEffect, useCallback, useRef } from "react";
import { RadioStation } from "@/types/radio";
import { registerPlugin } from "@capacitor/core";

const CAST_APP_ID = "65257ADB"; // Receiver URL: https://mrbender7.github.io/privacy-policy-radiosphere/receiver.html
const SDK_URL = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";

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

export function useCast() {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState<string | null>(null);
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

      CastPlugin.initialize()
        .then((result) => {
          console.log("[RadioSphere][Cast] CastPlugin initialized:", result);
          setIsCastAvailable(result.available);
        })
        .catch((err) => {
          console.warn("[RadioSphere][Cast] CastPlugin init error:", err);
        });

      // Listen for device availability changes
      CastPlugin.addListener("castDevicesAvailable", (data: any) => {
        console.log("[RadioSphere][Cast] Devices available:", data.available);
        setIsCastAvailable(data.available);
      });

      // Listen for session state changes
      CastPlugin.addListener("castStateChanged", (data: any) => {
        console.log("[RadioSphere][Cast] Session state:", data);
        setIsCasting(data.connected);
        setCastDeviceName(data.connected ? data.deviceName : null);
      });
    } else {
      // ─── WEB PATH: Use Google Cast Sender SDK (Chrome only) ──
      console.log("[RadioSphere][Cast] Web platform, loading Cast Sender SDK...");

      window.__onGCastApiAvailable = (isAvailable: boolean) => {
        console.log("[RadioSphere][Cast] __onGCastApiAvailable:", isAvailable);
        if (!isAvailable) return;
        try {
          const cast = window.cast;
          if (!cast?.framework) return;

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
              setIsCastAvailable(
                event.castState !== cast.framework.CastState.NO_DEVICES_AVAILABLE
              );
            }
          );
        } catch (e) {
          console.warn("[RadioSphere][Cast] SDK init error:", e);
        }
      };

      if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_URL;
        script.async = true;
        document.head.appendChild(script);
      }
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
    startCast,
    stopCast,
    loadMedia,
    toggleCastPlayPause,
  };
}
