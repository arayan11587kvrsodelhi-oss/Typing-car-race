import { useCountUp } from "@/hooks";
import type { RaceResult } from "@/game/types";
import { cn } from "@/utils/cn";
import { Button, Kbd } from "./ui";

const PLACE_LABEL = ["1ST PLACE", "2ND PLACE", "3RD PLACE", "4TH PLACE"];
const PLACE_EMOJI = ["🏆", "🥈", "🥉", "🏁"];

function Stat({ label, value, suffix = "", accent, delay }: { label: string; value: number; suffix?: string; accent?: string; delay: number }) {
  const v = useCountUp(value, 800, delay);
  return (
    <div className="glass-light rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-center">
      <div className="text-[9px] sm:text-[10px] font-display uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className={cn("font-display font-black text-xl sm:text-3xl tabular-nums", accent ?? "text-white")}>
        {Math.round(v).toLocaleString()}
        {suffix}
      </div>
    </div>
  );
}

export function ResultsOverlay({ result, carName, isTouch, onRestart, onGarage, onExit, onNextLevel }: { result: RaceResult; carName: string; isTouch: boolean; onRestart: () => void; onGarage: () => void; onExit: () => void; onNextLevel: (levelId: string) => void }) {
  const first = result.place === 1 && !result.dnf;
  const score = useCountUp(result.score, 1200, 350);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6 bg-[#03050c]/55 backdrop-blur-[3px] animate-fade-in overflow-y-auto scrollbar-thin">
      <div className="glass rounded-3xl w-full max-w-xl p-4 sm:p-7 animate-slide-up relative overflow-hidden my-auto">
        <div className={cn("absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[220px] rounded-full blur-3xl opacity-50", first ? "bg-amber-400/40" : result.dnf ? "bg-rose-500/30" : "bg-cyan-400/30")} />
        <div className="relative text-center">
          <div className="text-[10px] sm:text-xs font-display uppercase tracking-[0.4em] text-cyan-300/70">{result.dnf ? "Time's up" : "Race complete"}</div>
          <div className="mt-1 flex items-center justify-center gap-3">
            <span className="text-3xl sm:text-5xl animate-pop">{result.dnf ? "⏱" : PLACE_EMOJI[result.place - 1]}</span>
            <h2 className={cn("font-display font-black text-3xl sm:text-5xl tracking-wider animate-pop", first ? "text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]" : result.dnf ? "text-rose-300" : "text-white")}>
              {result.dnf ? "DNF" : PLACE_LABEL[result.place - 1]}
            </h2>
          </div>
          {result.rank > 0 && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/50 bg-fuchsia-500/15 px-3 py-1 text-[11px] sm:text-xs font-display font-bold tracking-widest text-fuchsia-200 magenta-text animate-pop">
              ★ NEW HIGH SCORE · #{result.rank}
            </div>
          )}
          <div className="mt-3 sm:mt-4">
            <div className="text-[10px] font-display uppercase tracking-[0.3em] text-slate-400">Score</div>
            <div className="font-display font-black text-4xl sm:text-6xl text-white neon-text tabular-nums">{Math.round(score).toLocaleString()}</div>
          </div>
        </div>

        <div className="relative mt-4 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="WPM" value={result.wpm} accent="text-cyan-200" delay={500} />
          <Stat label="Accuracy" value={result.accuracy} suffix="%" accent={result.accuracy >= 95 ? "text-emerald-300" : "text-amber-300"} delay={650} />
          <Stat label="Max combo" value={result.maxCombo} accent="text-fuchsia-300" delay={800} />
          <Stat label="Words" value={result.words} delay={900} />
          <Stat label="Perfect lines" value={result.perfectSentences} delay={1000} />
          <Stat label="Time" value={Math.round(result.time)} suffix="s" delay={1100} />
        </div>

        <div className="relative mt-4 flex items-center justify-between rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-2.5">
          <span className="text-xs sm:text-sm font-ui text-amber-100/90">
            Credits earned · <span className="text-slate-300">{carName}</span>
          </span>
          <span className="font-display font-black text-lg sm:text-2xl text-amber-300">+{result.credits.toLocaleString()} CR</span>
        </div>
        {result.campaign && (
          <div className={cn(
            "relative mt-3 rounded-xl border px-4 py-3 text-center",
            result.campaign.qualified
              ? "border-emerald-300/35 bg-emerald-400/10"
              : "border-rose-300/30 bg-rose-400/10",
          )}>
            <div className="font-display text-xs uppercase tracking-[0.25em] text-white">
              {result.campaign.qualified ? "Level complete" : "Requirement not met"}
            </div>
            <div className="mt-1 text-xs text-slate-300">
              {result.campaign.qualified
                ? `+${result.campaign.reward} campaign credits${result.campaign.unlockedLevelId ? " · Next level unlocked" : ""}`
                : "Improve your WPM and accuracy to unlock the next level."}
            </div>
          </div>
        )}

        <div className="relative mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {result.campaign?.unlockedLevelId && (
            <Button variant="primary" size="lg" onClick={() => onNextLevel(result.campaign!.unlockedLevelId!)} className="sm:col-span-1">
              Next level
            </Button>
          )}
          <Button variant={result.campaign?.unlockedLevelId ? "secondary" : "primary"} size="lg" onClick={onRestart} className="sm:col-span-1">
            Race again {!isTouch && <Kbd>↵</Kbd>}
          </Button>
          <Button variant="secondary" size="lg" onClick={onGarage}>
            Garage
          </Button>
          <Button variant="ghost" size="lg" onClick={onExit}>
            Menu
          </Button>
        </div>
      </div>
    </div>
  );
}
