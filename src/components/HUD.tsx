import { memo } from "react";
import { cn } from "@/utils/cn";
import type { RaceState } from "@/game/engine";

export interface HudState {
  mph: number;
  wpm: number;
  instWpm: number;
  accuracy: number;
  score: number;
  place: number;
  progress: number;
  rivals: { progress: number; color: string; name: string }[];
  timeLeft: number;
  state: RaceState;
  nitroActive: boolean;
}

const ORD = ["1ST", "2ND", "3RD", "4TH"];

function Speedo({ mph, nitro }: { mph: number; nitro: boolean }) {
  const max = 260;
  const sweep = 240;
  const angle = -sweep / 2 + Math.min(1, mph / max) * sweep;
  const ticks = Array.from({ length: 14 }, (_, i) => -sweep / 2 + (i / 13) * sweep);
  const r = 44;
  const polar = (a: number, rad: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return [50 + Math.cos(t) * rad, 50 + Math.sin(t) * rad];
  };
  const arc = (from: number, to: number, rad: number) => {
    const [x1, y1] = polar(from, rad);
    const [x2, y2] = polar(to, rad);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${rad} ${rad} 0 ${large} 1 ${x2} ${y2}`;
  };
  const wpmColor = mph >= 200 ? "#fbbf24" : mph >= 140 ? "#22d3ee" : mph >= 80 ? "#4ade80" : "#f87171";

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: "drop-shadow(0 0 16px rgba(34,211,238,0.4))" }}>
      <defs>
        <linearGradient id="speedGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="70%" stopColor="#e879f9" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <radialGradient id="nitroGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="48" fill="rgba(5,8,18,0.85)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      {nitro && <circle cx="50" cy="50" r="48" fill="url(#nitroGlow)" className="animate-pulse" />}
      <path d={arc(-sweep / 2, sweep / 2, r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" strokeLinecap="round" />
      <path d={arc(-sweep / 2, Math.max(-sweep / 2 + 0.1, angle), r)} fill="none" stroke="url(#speedGrad)" strokeWidth="5" strokeLinecap="round" className={cn(nitro && "animate-pulse")} filter="url(#glow)" />
      {ticks.map((t, i) => {
        const [x1, y1] = polar(t, 38);
        const [x2, y2] = polar(t, i % 2 === 0 ? 32 : 35);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth={i % 2 === 0 ? 1.5 : 1} />
        );
      })}
      <g transform={`rotate(${angle} 50 50)`} style={{ transition: "transform 80ms linear" }}>
        <line x1="50" y1="56" x2="50" y2="14" stroke={wpmColor} strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />
        <circle cx="50" cy="50" r="4.5" fill="#f8fafc" stroke={wpmColor} strokeWidth="1.5" />
      </g>
      <text x="50" y="70" textAnchor="middle" fontFamily="Orbitron, sans-serif" fontWeight="900" fontSize="18" fill="#f8fafc" paintOrder="stroke" stroke="rgba(0,0,0,0.5)" strokeWidth="3">
        {mph}
      </text>
      <text x="50" y="82" textAnchor="middle" fontFamily="Rajdhani, sans-serif" fontWeight="700" fontSize="7.5" fill="#94a3b8" letterSpacing="2.5">
        MPH
      </text>
      {nitro && (
        <text x="50" y="32" textAnchor="middle" fontFamily="Orbitron, sans-serif" fontWeight="900" fontSize="9" fill="#fbbf24" letterSpacing="3" className="animate-pulse" paintOrder="stroke" stroke="rgba(0,0,0,0.7)" strokeWidth="2">
          NITRO
        </text>
      )}
    </svg>
  );
}

function HUDButton({
  children,
  onClick,
  title,
  className = "",
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "glass rounded-xl flex items-center justify-center transition-all duration-150",
        "hover:bg-white/15 hover:shadow-[0_0_16px_rgba(34,211,238,0.25)]",
        "active:scale-95 active:bg-white/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50",
        "min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px]",
        className
      )}
    >
      {children}
    </button>
  );
}

function ProgressBar({
  progress,
  playerColor,
  rivals,
  place,
}: {
  progress: number;
  playerColor: string;
  rivals: { progress: number; color: string; name: string }[];
  place: number;
}) {
  return (
    <div className="relative h-8 sm:h-10 mx-2 sm:mx-4" role="img" aria-label={`Race progress: you are in ${ORD[place - 1]} place`}>
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-white/5 via-white/10 to-white/5 border border-white/5" />
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-cyan-500/20 via-cyan-400/10 to-transparent" style={{ width: `${progress * 100}%` }} />
      <div className="absolute right-[-2px] top-1/2 -translate-y-1/2 w-4 h-5 sm:w-5 sm:h-6 rounded-sm" style={{ backgroundImage: "repeating-conic-gradient(#fff 0 25%, #111 0 50%)", backgroundSize: "6px 6px" }} />
      {rivals.map((r, i) => (
        <div
          key={i}
          className="group absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-black/30 transition-[left] duration-200"
          style={{
            left: `${r.progress * 100}%`,
            background: `radial-gradient(circle at 30% 30%, ${r.color}CC, ${r.color}88)`,
            boxShadow: `0 0 10px ${r.color}, 0 0 20px ${r.color}80`,
            filter: "drop-shadow(0 0 4px currentColor)",
          }}
          title={r.name}
          aria-hidden="true"
        >
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[7px] font-black text-white/90 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            {ORD[i]}
          </span>
        </div>
      ))}
      <div
        className="group absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-3 border-white transition-[left] duration-200 flex items-center justify-center cursor-pointer"
        style={{
          left: `${progress * 100}%`,
          background: `radial-gradient(circle at 30% 30%, ${playerColor}EE, ${playerColor}99)`,
          boxShadow: `0 0 16px ${playerColor}, 0 0 32px ${playerColor}99`,
          filter: "drop-shadow(0 0 6px currentColor)",
        }}
        title="You"
        role="button"
        tabIndex={0}
        aria-label={`Your position: ${ORD[place - 1]}`}
      >
        <span className="text-[9px] sm:text-[10px] font-black text-black/70 drop-shadow-sm">▲</span>
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[7px] font-black text-white/90 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          {ORD[place - 1]}
        </span>
      </div>
    </div>
  );
}

function GaugePanel({
  label,
  value,
  unit,
  color,
  trend,
  trendLabel,
  className = "",
}: {
  label: string;
  value: number | string;
  unit?: string;
  color: string;
  trend?: number;
  trendLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("glass rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-center min-w-[72px] sm:min-w-[88px]", className)}>
      <div className="text-[8px] sm:text-[9px] font-display uppercase tracking-[0.25em] text-slate-400 mb-1">{label}</div>
      <div className="font-display font-black text-2xl sm:text-3xl leading-none tabular-nums" style={{ color }}>
        {value}
        {unit && <span className="text-lg sm:text-xl font-medium opacity-70">{unit}</span>}
      </div>
      {trend !== undefined && trendLabel && (
        <div className="mt-1 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-ui">
          <span className={cn("font-bold", trend >= 0 ? "text-emerald-300" : "text-rose-300")}>
            {trend >= 0 ? "+" : ""}{trend}
          </span>
          <span className="text-slate-500">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

export const HUD = memo(function HUD({
  hud,
  playerColor,
  muted,
  onPause,
  onMute,
}: {
  hud: HudState;
  playerColor: string;
  muted: boolean;
  onPause: () => void;
  onMute: () => void;
}) {
  const t = Math.ceil(hud.timeLeft);
  const mm = Math.floor(t / 60);
  const ss = String(t % 60).padStart(2, "0");
  const low = hud.timeLeft < 20;

  const wpmColor =
    hud.wpm >= 80 ? "#4ade80" : hud.wpm >= 50 ? "#fbbf24" : "#f87171";
  const accColor =
    hud.accuracy >= 95 ? "#4ade80" : hud.accuracy >= 85 ? "#fbbf24" : "#f87171";

  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-4 lg:p-6 perspective-hud"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {/* top bar */}
      <div className="flex items-start justify-between gap-2 sm:gap-4 flex-wrap">
        <div className="glass rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 flex items-baseline gap-2 tilt-left min-w-[72px] sm:min-w-[88px]">
          <span key={hud.place} className={cn("animate-pop font-display font-black text-xl sm:text-2xl lg:text-3xl leading-none", hud.place === 1 ? "text-amber-300" : "text-white")}>
            {ORD[hud.place - 1]}
          </span>
          <span className="text-[9px] sm:text-xs text-slate-400 font-ui self-end">/ 4</span>
        </div>

        <div className="flex-1 min-w-0 pt-1 sm:pt-0 hidden sm:block">
          <ProgressBar progress={hud.progress} playerColor={playerColor} rivals={hud.rivals} place={hud.place} />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto flex-wrap">
          <div className={cn("glass rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 tilt-right font-display font-bold text-sm sm:text-lg lg:text-xl tabular-nums", low ? "text-rose-300 animate-pulse" : "text-slate-100")}>
            {mm}:{ss}
          </div>
          <HUDButton
            onClick={onMute}
            title={muted ? "Unmute (M)" : "Mute (M)"}
            aria-label={muted ? "Unmute" : "Mute"}
            className="text-base sm:text-lg"
          >
            {muted ? "🔇" : "🔊"}
          </HUDButton>
          <HUDButton
            onClick={onPause}
            title="Pause (Esc)"
            aria-label="Pause"
            className="text-cyan-200 font-black"
          >
            ❚❚
          </HUDButton>
        </div>
      </div>

      {/* mobile progress bar - only on very small screens */}
      <div className="sm:hidden pointer-events-none px-2">
        <ProgressBar progress={hud.progress} playerColor={playerColor} rivals={hud.rivals} place={hud.place} />
      </div>

      {/* bottom gauges */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 [@media(max-height:420px)]:hidden">
        <div className="w-[88px] h-[88px] sm:w-[128px] sm:h-[128px] lg:w-[144px] lg:h-[144px] tilt-left flex-shrink-0">
          <Speedo mph={hud.mph} nitro={hud.nitroActive} />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 flex-1 min-w-0">
          <GaugePanel
            label="Avg WPM"
            value={Math.round(hud.wpm)}
            color={wpmColor}
            trend={Math.round(hud.instWpm - hud.wpm)}
            trendLabel="vs now"
          />
          <GaugePanel
            label="Instant WPM"
            value={Math.round(hud.instWpm)}
            unit="WPM"
            color="#22d3ee"
          />
          <GaugePanel
            label="Accuracy"
            value={hud.accuracy.toFixed(1)}
            unit="%"
            color={accColor}
          />
        </div>

        <div className="glass rounded-xl px-4 py-3 sm:px-5 sm:py-3 text-right tilt-right min-w-[100px] sm:min-w-[130px] flex-shrink-0">
          <div className="text-[8px] sm:text-[9px] font-display uppercase tracking-[0.2em] text-amber-300/80 mb-1">Score</div>
          <div className="font-display font-black text-2xl sm:text-3xl lg:text-4xl leading-none text-amber-200 tabular-nums neon-text">
            {hud.score.toLocaleString()}
          </div>
          <div className="mt-1 text-[9px] sm:text-xs text-slate-400 font-ui">pts</div>
        </div>
      </div>
    </div>
  );
});
