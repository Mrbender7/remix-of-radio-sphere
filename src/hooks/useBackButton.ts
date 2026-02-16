import { useEffect, useRef, useCallback } from "react";

interface UseBackButtonProps {
  onBack: () => void;
  onDoubleBackHome: () => void;
  isHome: boolean;
  isFullScreen: boolean;
}

export function useBackButton({
  onBack,
  onDoubleBackHome,
  isHome,
  isFullScreen,
}: UseBackButtonProps) {
  const lastBackPressRef = useRef<number>(0);
  const backPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store latest values in refs so the native listener always has current state
  const isHomeRef = useRef(isHome);
  const isFullScreenRef = useRef(isFullScreen);
  const onBackRef = useRef(onBack);
  const onDoubleBackHomeRef = useRef(onDoubleBackHome);

  useEffect(() => { isHomeRef.current = isHome; }, [isHome]);
  useEffect(() => { isFullScreenRef.current = isFullScreen; }, [isFullScreen]);
  useEffect(() => { onBackRef.current = onBack; }, [onBack]);
  useEffect(() => { onDoubleBackHomeRef.current = onDoubleBackHome; }, [onDoubleBackHome]);

  const handleBackPress = useCallback(() => {
    // Priority 1: close fullscreen player
    if (isFullScreenRef.current) {
      onBackRef.current();
      return;
    }

    // Priority 2: if not home, go home
    if (!isHomeRef.current) {
      onBackRef.current();
      return;
    }

    // Priority 3: on home — double-tap to exit
    const now = Date.now();
    const timeSinceLastPress = now - lastBackPressRef.current;

    if (timeSinceLastPress < 300) {
      if (backPressTimeoutRef.current) {
        clearTimeout(backPressTimeoutRef.current);
      }
      onDoubleBackHomeRef.current();
      lastBackPressRef.current = 0;
    } else {
      lastBackPressRef.current = now;
      if (backPressTimeoutRef.current) {
        clearTimeout(backPressTimeoutRef.current);
      }
      backPressTimeoutRef.current = setTimeout(() => {
        lastBackPressRef.current = 0;
      }, 300);
    }
  }, []);

  useEffect(() => {
    // Native Android back button via @capacitor/app
    let nativeListenerRemove: (() => void) | null = null;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('backButton', () => {
          handleBackPress();
        });
        nativeListenerRemove = () => listener.remove();
        console.log("[RadioSphere] Native backButton listener registered");
      } catch (e) {
        console.log("[RadioSphere] @capacitor/app not available, using popstate fallback");
        // Web fallback: popstate
        window.history.pushState(null, "", window.location.href);
        const handlePopState = () => {
          handleBackPress();
          window.history.pushState(null, "", window.location.href);
        };
        window.addEventListener("popstate", handlePopState);
        nativeListenerRemove = () => {
          window.removeEventListener("popstate", handlePopState);
        };
      }
    })();

    return () => {
      if (nativeListenerRemove) nativeListenerRemove();
      if (backPressTimeoutRef.current) {
        clearTimeout(backPressTimeoutRef.current);
      }
    };
  }, [handleBackPress]);
}
