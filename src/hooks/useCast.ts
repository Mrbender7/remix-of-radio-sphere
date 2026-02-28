import { useState, useEffect, useCallback, useRef } from "react";
import { RadioStation } from "@/types/radio";

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

export function useCast() {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState<string | null>(null);
  const sdkLoadedRef = useRef(false);
  const remotePlayerRef = useRef<any>(null);
  const remotePlayerControllerRef = useRef<any>(null);

  useEffect(() => {
    if (sdkLoadedRef.current) return;
    sdkLoadedRef.current = true;

    window.__onGCastApiAvailable = (isAvailable: boolean) => {
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
              // Set up remote player
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
        console.warn("[RadioSphere] Cast SDK init error:", e);
      }
    };

    // Load SDK script
    if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const startCast = useCallback(() => {
    try {
      window.cast?.framework?.CastContext?.getInstance()?.requestSession();
    } catch (e) {
      console.warn("[RadioSphere] Cast request error:", e);
    }
  }, []);

  const stopCast = useCallback(() => {
    try {
      window.cast?.framework?.CastContext?.getInstance()?.getCurrentSession()?.endSession(true);
    } catch (e) {
      console.warn("[RadioSphere] Cast stop error:", e);
    }
  }, []);

  const loadMedia = useCallback((station: RadioStation) => {
    try {
      const session = window.cast?.framework?.CastContext?.getInstance()?.getCurrentSession();
      if (!session) return;

      const chrome = window.chrome;
      const mediaInfo = new chrome.cast.media.MediaInfo(station.streamUrl, "audio/mpeg");
      mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata();
      mediaInfo.metadata.title = station.name;
      mediaInfo.metadata.artist = "Radio Sphere";

      const logoUrl = station.logo
        ? station.logo.replace("http://", "https://")
        : `${window.location.origin}/favicon.png`;
      mediaInfo.metadata.images = [new chrome.cast.Image(logoUrl)];

      mediaInfo.customData = {
        tags: station.tags || [],
        stationId: station.id,
      };

      const request = new chrome.cast.media.LoadRequest(mediaInfo);
      session.loadMedia(request).then(
        () => console.log("[RadioSphere] Cast media loaded"),
        (err: any) => console.warn("[RadioSphere] Cast load error:", err)
      );
    } catch (e) {
      console.warn("[RadioSphere] Cast loadMedia error:", e);
    }
  }, []);

  const toggleCastPlayPause = useCallback(() => {
    if (remotePlayerControllerRef.current) {
      remotePlayerControllerRef.current.playOrPause();
    }
  }, []);

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
