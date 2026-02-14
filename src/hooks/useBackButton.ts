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

  const handleBackPress = useCallback(() => {
    // If on home page, check for double back to exit
    if (isHome) {
      const now = Date.now();
      const timeSinceLastPress = now - lastBackPressRef.current;

      if (timeSinceLastPress < 300) {
        if (backPressTimeoutRef.current) {
          clearTimeout(backPressTimeoutRef.current);
        }
        onDoubleBackHome();
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
      return;
    }

    // Default: close fullscreen or go home
    onBack();
  }, [isHome, onBack, onDoubleBackHome]);

  useEffect(() => {
    // Prevent default back behavior and use our custom handler
    const handlePopState = () => {
      handleBackPress();
      // Push a new state to prevent actual navigation
      window.history.pushState(null, "", window.location.href);
    };

    // Push initial state
    window.history.pushState(null, "", window.location.href);

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (backPressTimeoutRef.current) {
        clearTimeout(backPressTimeoutRef.current);
      }
    };
  }, [handleBackPress]);
}
