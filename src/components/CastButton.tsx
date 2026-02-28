import { usePlayer } from "@/contexts/PlayerContext";
import { useEffect, useRef } from "react";
import { Cast } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

/**
 * CastButton — Hybrid component with 3 modes:
 * - launcher: native <google-cast-launcher> for Chrome desktop
 * - native: Lucide icon button calling startCast/stopCast (Capacitor APK)
 * - fallback: visible but disabled icon with tooltip (Firefox/Safari)
 */
export function CastButton({ className = "" }: { className?: string }) {
  const { isCastAvailable, isCasting, castUiMode, startCast, stopCast } = usePlayer();
  const { t } = useTranslation();
  const launcherRef = useRef<HTMLElement>(null);

  // Style the shadow-DOM button inside google-cast-launcher
  useEffect(() => {
    if (castUiMode !== "launcher") return;
    const el = launcherRef.current;
    if (!el) return;
    const style = document.createElement("style");
    style.textContent = `
      :host { display: flex; align-items: center; justify-content: center; }
      button { width: 24px; height: 24px; }
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
  }, [castUiMode]);

  const baseClass = `w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
    isCasting
      ? "text-primary bg-primary/10"
      : "text-muted-foreground hover:text-foreground"
  } ${className}`;

  // ─── MODE: LAUNCHER (Chrome desktop with Cast SDK) ─────────────
  if (castUiMode === "launcher") {
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
            opacity: isCastAvailable ? 1 : 0.4,
          }}
        />
      </div>
    );
  }

  // ─── MODE: NATIVE (Capacitor APK) ─────────────────────────────
  if (castUiMode === "native") {
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

  // ─── MODE: FALLBACK (non-Chrome browsers) ─────────────────────
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
            className={`${baseClass} opacity-40 cursor-help`}
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
