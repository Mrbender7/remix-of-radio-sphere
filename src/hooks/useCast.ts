import { useState, useEffect, useCallback, useRef } from "react";
import { RadioStation } from "@/types/radio";
import { registerPlugin } from "@capacitor/core";

// Production App ID for RadioSphere custom receiver
const CAST_APP_ID = "65257ADB";

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    __castSdkReady?: boolean;
    cast?: any;
    chrome?: any;
  }
  // eslint-disable-next-line no-var
  var chrome: any;
}

// ─── Native Capacitor Cast Plugin interface ─────────────────────────
interface CastPluginInterface {
  initialize(): Promise<{ initialized: boolean; available: boolean; permissionsGranted?: boolean; appId?: string }>;
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
  checkDiscoveryPermissions(): Promise<{ granted: boolean; apiLevel: number }>;
  requestDiscoveryPermissions(): Promise<{ granted: boolean }>;
  addListener(event: string, callback: (data: any) => void): Promise<{ remove: () => void }>;
}

let CastPluginInstance: CastPluginInterface | null = null;
function getCastPlugin(): CastPluginInterface {
  if (!CastPluginInstance) {
    CastPluginInstance = registerPlugin<CastPluginInterface>("CastPlugin");
  }
  return CastPluginInstance;
}

// ─── Platform detection ─────────────────────────────────────────────
function isCapacitorNative(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export type CastUiMode = "launcher" | "native" | "fallback";
export type CastInitState = "idle" | "initializing" | "ready" | "unavailable";

export function useCast() {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState<string | null>(null);
  const [castUiMode, setCastUiMode] = useState<CastUiMode>("fallback");
  const [castInitState, setCastInitState] = useState<CastInitState>("idle");
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const initDoneRef = useRef(false);
  const remotePlayerRef = useRef<any>(null);
  const remotePlayerControllerRef = useRef<any>(null);
  const isNative = useRef(isCapacitorNative()).current;

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;
    setCastInitState("initializing");

    if (isNative) {
      // ─── NATIVE PATH ─────────────────────────────────────────
      console.log("[RadioSphere][Cast] Native platform, initializing CastPlugin...");
      setCastUiMode("native");

      const plugin = getCastPlugin();
      plugin.initialize()
        .then((result) => {
          console.log("[RadioSphere][Cast] CastPlugin initialized:", JSON.stringify(result));
          console.log("[RadioSphere][Cast] initialized=" + result.initialized + ", available=" + result.available + ", appId=" + (result.appId || "N/A"));
          setIsCastAvailable(result.available);
          setPermissionsGranted(result.permissionsGranted ?? false);
          setCastInitState("ready");

          // If permissions not granted, request them proactively
          if (!result.permissionsGranted) {
            console.log("[RadioSphere][Cast] Permissions not granted, requesting...");
            plugin.requestDiscoveryPermissions()
              .then((permResult) => {
                console.log("[RadioSphere][Cast] Permission request result:", JSON.stringify(permResult));
                setPermissionsGranted(permResult.granted);
              })
              .catch((e) => console.warn("[RadioSphere][Cast] Permission request error:", e));
          }
        })
        .catch((err) => {
          console.warn("[RadioSphere][Cast] CastPlugin init error:", err);
          setCastInitState("unavailable");
        });

      plugin.addListener("castDevicesAvailable", (data: any) => {
        console.log("[RadioSphere][Cast] castDevicesAvailable event:", JSON.stringify(data));
        setIsCastAvailable(data.available);
      });

      plugin.addListener("castStateChanged", (data: any) => {
        console.log("[RadioSphere][Cast] castStateChanged event:", JSON.stringify(data));
        setIsCasting(data.connected);
        setCastDeviceName(data.connected ? data.deviceName : null);
      });

      // v2.4.6: Listen for localAudioControl events from native plugin
      plugin.addListener("localAudioControl", (data: any) => {
        console.log("[RadioSphere][Cast] localAudioControl event:", JSON.stringify(data));
        // This event is handled by PlayerContext via isCasting state change
      });

      return;
    }

    // ─── WEB PATH ────────────────────────────────────────────────
    console.log("[RadioSphere][Cast] Web platform, initializing Cast SDK...");

    let webInitDone = false;
    const initWebCastContext = () => {
      if (webInitDone) return;
      const cast = window.cast;
      if (!cast?.framework) {
        console.warn("[RadioSphere][Cast] cast.framework not available at init time");
        setCastUiMode("fallback");
        setCastInitState("unavailable");
        return;
      }

      webInitDone = true;
      console.log("[RadioSphere][Cast] Initializing CastContext with App ID:", CAST_APP_ID);

      try {
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
            console.log("[RadioSphere][Cast] Cast state:", event.castState, "available:", available);
            setIsCastAvailable(available);
          }
        );

        setCastUiMode("launcher");
        setCastInitState("ready");
        setIsCastAvailable(true);
        setPermissionsGranted(true);
        console.log("[RadioSphere][Cast] CastContext initialized ✓");
      } catch (e) {
        console.warn("[RadioSphere][Cast] SDK init error:", e);
        setCastUiMode("fallback");
        setCastInitState("unavailable");
      }
    };

    if (window.cast?.framework || window.__castSdkReady) {
      console.log("[RadioSphere][Cast] SDK already available, init immediately");
      initWebCastContext();
    }

    const prevCallback = window.__onGCastApiAvailable;
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      console.log("[RadioSphere][Cast] __onGCastApiAvailable:", isAvailable);
      if (isAvailable) {
        initWebCastContext();
      } else {
        setCastUiMode("fallback");
        setCastInitState("unavailable");
      }
    };

    const handleBridgeEvent = () => {
      console.log("[RadioSphere][Cast] castSdkReady event received");
      initWebCastContext();
    };
    window.addEventListener("castSdkReady", handleBridgeEvent);

    const safetyTimeout = setTimeout(() => {
      if (!webInitDone) {
        console.log("[RadioSphere][Cast] Safety timeout: SDK never loaded → fallback");
        setCastUiMode("fallback");
        setCastInitState("unavailable");
      }
    }, 10000);

    return () => {
      clearTimeout(safetyTimeout);
      window.removeEventListener("castSdkReady", handleBridgeEvent);
    };
  }, [isNative]);

  const startCast = useCallback(async () => {
    if (isNative) {
      const plugin = getCastPlugin();
      try {
        await plugin.requestSession();
      } catch (e) {
        console.warn("[RadioSphere][Cast] requestSession error:", e);
      }
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
      getCastPlugin().endSession().catch((e) =>
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
        // v2.4.6: Send streamUrl without modification — plugin handles content type
        console.log("[RadioSphere][Cast] loadMedia (native):", station.name, "URL:", station.streamUrl);
        getCastPlugin().loadMedia({
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
      getCastPlugin().togglePlayPause().catch((e) =>
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
    castInitState,
    permissionsGranted,
    startCast,
    stopCast,
    loadMedia,
    toggleCastPlayPause,
  };
}
