import { usePlayer } from "@/contexts/PlayerContext";
import { useEffect, useRef } from "react";

/**
 * CastButton — uses the native <google-cast-launcher> custom element
 * provided by the Google Cast Sender SDK. The browser renders the icon
 * automatically and handles device discovery / session management.
 */
export function CastButton({ className = "" }: { className?: string }) {
  const { isCastAvailable, isCasting } = usePlayer();
  const ref = useRef<HTMLElement>(null);

  // Style the shadow-DOM button inside google-cast-launcher
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style = document.createElement("style");
    style.textContent = `
      :host { display: flex; align-items: center; justify-content: center; }
      button { width: 24px; height: 24px; }
    `;
    // google-cast-launcher creates a shadowRoot; inject style when ready
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
  }, []);

  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
        isCasting
          ? "text-primary bg-primary/10"
          : "text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {/* @ts-ignore — google-cast-launcher is a custom element from the Cast SDK */}
      <google-cast-launcher
        ref={ref}
        style={{ display: "inline-flex", width: 24, height: 24, cursor: "pointer", opacity: isCastAvailable ? 1 : 0.3 }}
      />
    </div>
  );
}
