"use client";

export function HealthGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 72;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 180 180" className="size-44 -rotate-90">
        <circle cx="90" cy="90" r="72" className="fill-none stroke-white/8" strokeWidth="14" />
        <circle
          cx="90"
          cy="90"
          r="72"
          className="fill-none stroke-primary"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 1.2s ease-out",
          }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Health</p>
        <p className="mt-2 text-4xl font-semibold">{score}</p>
        <p className="text-sm text-muted-foreground">of 100</p>
      </div>
    </div>
  );
}
