import { useRef, useState, useEffect, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollableRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [children]);

  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  return (
    <div className="relative group">
      <div ref={ref} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {children}
      </div>

      {canLeft && (
        <button
          onClick={() => scroll(-1)}
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 z-10",
            "w-8 h-14 rounded-r-lg bg-black/50 border border-border/30 backdrop-blur-md",
            "flex items-center justify-center text-foreground",
            "hover:bg-black/70 transition-all shadow-lg"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {canRight && (
        <button
          onClick={() => scroll(1)}
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 z-10",
            "w-8 h-14 rounded-l-lg bg-black/50 border border-border/30 backdrop-blur-md",
            "flex items-center justify-center text-foreground",
            "hover:bg-black/70 transition-all shadow-lg"
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
