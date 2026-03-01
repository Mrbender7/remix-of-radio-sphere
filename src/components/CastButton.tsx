import { usePlayer } from "@/contexts/PlayerContext";
import { useEffect, useRef, useState } from "react";
import { Cast, Loader2 } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

/**
 * CastButton — Hybrid component with 3 modes + visual fallback guarantee.
 * The icon is ALWAYS visible regardless of SDK state.
 */
export function CastButton({ className = "" }: { className?: string }) {
  const { isCastAvailable, isCasting, castUiMode, castInitState, startCast, stopCast } = usePlayer();
  const { t } = useTranslation();
  const launcherRef = useRef<HTMLElement>(null);
  const [launcherReady, setLauncherReady] = useState(false);

  // Check if google-cast-launcher custom element is actually registered & visible
  useEffect(() => {
    if (castUiMode !== "launcher") return;

    const checkLauncher = () => {
      const isRegistered = !!customElements.get("google-cast-launcher");
      setLauncherReady(isRegistered);
    };

    // Check immediately + after short delay (SDK may register late)
    checkLauncher();
    const t1 = setTimeout(checkLauncher, 2000);
    const t2 = setTimeout(checkLauncher, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [castUiMode]);

  // Style the shadow-DOM button inside google-cast-launcher
  useEffect(() => {
    if (castUiMode !== "launcher" || !launcherReady) return;
    const el = launcherRef.current;
    if (!el) return;
    const style = document.createElement("style");
    style.textContent = `
      :host { display: flex; align-items: center; justify-content: center; }
      button { width: 24px; height: 24px; }
      .casticon { fill: currentColor; }
    `;
    const tryInject = () => {
      if (el.shadowRoot && !el.shadowRoot.querySelector("style[data-rs]")) {
        style.setAttribute("data-rs", "1");
        el.shadowRoot.appendChild(style);
      }
    };
    tryInject();
    const mo = new MutationObserver(tryInject);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [castUiMode, launcherReady]);

  const baseClass = `w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
    isCasting
      ? "text-primary bg-primary/10"
      : "text-muted-foreground hover:text-foreground"
  } ${className}`;

  // ─── MODE: INITIALIZING — show loading spinner ─────────────────
  if (castInitState === "initializing") {
    return (
      <div className={`${baseClass} opacity-50 cursor-wait`} aria-label="Cast loading...">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  // ─── MODE: NATIVE (Capacitor APK) ─────────────────────────────
  if (castUiMode === "native" && castInitState === "ready") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          isCasting ? stopCast() : startCast();
        }}
        className={baseClass}
        aria-label={isCasting ? "Stop casting" : "Cast"}
      >
        <Cast className={`w-5 h-5 ${isCasting ? "animate-pulse" : ""}`} />
      </button>
    );
  }

  // ─── MODE: LAUNCHER (Chrome desktop with Cast SDK ready) ───────
  if (castUiMode === "launcher" && launcherReady) {
    return (
      <div className={baseClass}>
        {/* @ts-ignore — google-cast-launcher is a custom element from the Cast SDK */}
        <google-cast-launcher
          ref={launcherRef}
          style={{
            display: "inline-flex",
            width: 24,
            height: 24,
            cursor: "pointer",
            opacity: isCastAvailable ? 1 : 0.5,
            color: "currentColor",
            ["--connected-color" as any]: "hsl(var(--primary))",
            ["--disconnected-color" as any]: "currentColor",
          }}
        />
      </div>
    );
  }

  // ─── MODE: FALLBACK (non-Chrome, SDK not loaded, or launcher not ready) ─
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast({
                title: "Chromecast",
                description: t("cast.unsupportedBrowser"),
              });
            }}
            className={`${baseClass} opacity-50 cursor-help`}
            aria-label="Chromecast"
          >
            <Cast className="w-5 h-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{t("cast.openInChrome")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
