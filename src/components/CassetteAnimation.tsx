import { useEffect, useState } from "react";

interface CassetteAnimationProps {
  duration: number; // recording duration in seconds
  maxDuration?: number; // max recording duration in seconds
}

export function CassetteAnimation({ duration, maxDuration = 600 }: CassetteAnimationProps) {
  const progress = Math.min(duration / maxDuration, 1);

  // Left reel slows, right reel speeds up
  const leftSpeed = 2 + (1 - progress) * 3; // 5s → 2s rotation
  const rightSpeed = 5 - progress * 3; // 5s → 2s rotation

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Cassette body */}
      <div className="relative w-56 h-36 rounded-xl bg-gradient-to-b from-[hsl(30,40%,25%)] to-[hsl(25,35%,18%)] border-2 border-[hsl(30,30%,30%)] shadow-[inset_0_2px_8px_rgba(255,200,100,0.1),0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Top label area */}
        <div className="absolute top-2 left-4 right-4 h-8 rounded bg-[hsl(45,60%,85%)] flex items-center justify-center">
          <span className="text-[10px] font-bold text-[hsl(25,40%,25%)] tracking-widest uppercase">RadioSphere REC</span>
        </div>

        {/* Tape window */}
        <div className="absolute top-14 left-6 right-6 h-14 rounded-lg bg-[hsl(220,10%,8%)] border border-[hsl(30,20%,35%)] flex items-center justify-between px-4 overflow-hidden">
          {/* Left reel */}
          <div
            className="w-10 h-10 rounded-full border-2 border-[hsl(30,30%,45%)] bg-[hsl(220,10%,12%)] flex items-center justify-center cassette-reel-spin"
            style={{ animationDuration: `${leftSpeed}s` }}
          >
            <div className="w-3 h-3 rounded-full bg-[hsl(30,30%,40%)]" />
            {/* Spokes */}
            <div className="absolute w-[2px] h-8 bg-[hsl(30,20%,35%)] rotate-0" />
            <div className="absolute w-[2px] h-8 bg-[hsl(30,20%,35%)] rotate-60" />
            <div className="absolute w-[2px] h-8 bg-[hsl(30,20%,35%)] rotate-[120deg]" />
          </div>

          {/* Tape band */}
          <div className="flex-1 mx-2 h-[2px] bg-gradient-to-r from-[hsl(25,60%,30%)] via-[hsl(25,50%,40%)] to-[hsl(25,60%,30%)]" />

          {/* Right reel */}
          <div
            className="w-10 h-10 rounded-full border-2 border-[hsl(30,30%,45%)] bg-[hsl(220,10%,12%)] flex items-center justify-center cassette-reel-spin"
            style={{ animationDuration: `${rightSpeed}s` }}
          >
            <div className="w-3 h-3 rounded-full bg-[hsl(30,30%,40%)]" />
            <div className="absolute w-[2px] h-8 bg-[hsl(30,20%,35%)] rotate-0" />
            <div className="absolute w-[2px] h-8 bg-[hsl(30,20%,35%)] rotate-60" />
            <div className="absolute w-[2px] h-8 bg-[hsl(30,20%,35%)] rotate-[120deg]" />
          </div>
        </div>

        {/* Bottom screws */}
        <div className="absolute bottom-2 left-6 w-2 h-2 rounded-full bg-[hsl(30,20%,40%)]" />
        <div className="absolute bottom-2 right-6 w-2 h-2 rounded-full bg-[hsl(30,20%,40%)]" />
      </div>

      {/* Recording counter */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500 rec-blink" />
        <span className="text-sm font-mono font-bold text-red-400 tracking-wider">
          {formatTime(duration)}
        </span>
        <span className="text-xs text-muted-foreground">
          / {formatTime(maxDuration)}
        </span>
      </div>
    </div>
  );
}
