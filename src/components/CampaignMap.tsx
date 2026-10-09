import type { CampaignProgress, LevelDef } from "@/game/levels";
import { cn } from "@/utils/cn";

interface Props {
  levels: LevelDef[];
  progress: CampaignProgress;
  selectedId: string;
  onSelect: (level: LevelDef) => void;
}

export function CampaignMap({ levels, progress, selectedId, onSelect }: Props) {
  return (
    <section className="glass rounded-3xl border border-white/5 p-4 sm:p-6" aria-label="Campaign map">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-300/70">Campaign map</div>
          <h2 className="mt-1 font-display text-2xl font-black text-white sm:text-3xl">The Drift League</h2>
        </div>
        <div className="text-right font-ui text-[11px] text-slate-400">
          {progress.completedLevelIds.length}/{levels.length} complete
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {levels.map((level, index) => {
          const unlocked = progress.unlockedLevelIds.includes(level.id);
          const completed = progress.completedLevelIds.includes(level.id);
          const selected = selectedId === level.id;
          const best = progress.bestResults[level.id];
          return (
            <button
              key={level.id}
              type="button"
              disabled={!unlocked}
              aria-label={`${level.index}. ${level.name}${unlocked ? "" : " locked"}`}
              aria-pressed={selected}
              onClick={() => unlocked && onSelect(level)}
              className={cn(
                "relative min-h-[126px] overflow-hidden rounded-2xl border p-4 text-left transition-all",
                unlocked
                  ? "border-white/15 bg-white/[0.045] hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-300/[0.08]"
                  : "cursor-not-allowed border-white/5 bg-black/20 opacity-45",
                selected && "border-cyan-300/80 bg-cyan-300/[0.12] shadow-[0_0_28px_rgba(34,211,238,0.2)]",
              )}
            >
              <div className="absolute right-3 top-3 text-lg" aria-hidden="true">
                {completed ? "🏆" : unlocked ? "◈" : "🔒"}
              </div>
              <div className="font-display text-[10px] uppercase tracking-[0.3em] text-cyan-200/70">
                Level {level.index} · {level.world}
              </div>
              <div className="mt-1 pr-8 font-display text-lg font-black text-white">{level.name}</div>
              <div className="mt-1 line-clamp-2 font-ui text-xs text-slate-400">{level.blurb}</div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-display text-[9px] uppercase tracking-wider text-slate-500">
                <span>{level.difficulty}</span>
                <span>{level.targetWpm} WPM+</span>
                <span>{level.minimumAccuracy}% ACC</span>
                {best && <span className="text-amber-300/80">BEST {best.wpm.toFixed(0)} WPM</span>}
              </div>
              {index < levels.length - 1 && (
                <span className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 bg-cyan-300/30 xl:block" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
