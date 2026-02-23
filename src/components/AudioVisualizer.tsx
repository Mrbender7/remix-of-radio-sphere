import { cn } from "@/lib/utils";

interface AudioVisualizerProps {
  size?: "small" | "medium" | "large";
  className?: string;
}

const sizeConfig = {
  small: { bars: 4, height: 16, gap: 2, barWidth: 3 },
  medium: { bars: 5, height: 24, gap: 2, barWidth: 3 },
  large: { bars: 9, height: 40, gap: 3, barWidth: 4 },
};

const barAnimations = [
  { duration: "0.45s", delay: "0s" },
  { duration: "0.55s", delay: "0.1s" },
  { duration: "0.4s", delay: "0.2s" },
  { duration: "0.6s", delay: "0.05s" },
  { duration: "0.5s", delay: "0.15s" },
  { duration: "0.65s", delay: "0.08s" },
  { duration: "0.42s", delay: "0.22s" },
  { duration: "0.58s", delay: "0.12s" },
  { duration: "0.48s", delay: "0.18s" },
];

export function AudioVisualizer({ size = "small", className }: AudioVisualizerProps) {
  const { bars, height, gap, barWidth } = sizeConfig[size];
  const totalWidth = bars * barWidth + (bars - 1) * gap;

  return (
    <div className={cn("flex items-end justify-center", className)} style={{ height, width: totalWidth, gap }}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: barWidth,
            height: "100%",
            background: "linear-gradient(to top, hsl(225, 90%, 58%), hsl(280, 80%, 60%))",
            animation: `equalizer-bar ${barAnimations[i % barAnimations.length].duration} ease-in-out ${barAnimations[i % barAnimations.length].delay} infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes equalizer-bar {
          0% { transform: scaleY(0.2); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
