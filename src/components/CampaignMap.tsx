import { useEffect, useMemo, useState } from "react";
import {
  CAMPAIGN_WORLDS,
  isWorldUnlocked,
  levelsForWorld,
  type CampaignProgress,
  type CampaignWorldDef,
  type LevelDef,
} from "@/game/levels";
import { cn } from "@/utils/cn";

interface Props {
  levels: LevelDef[];
  progress: CampaignProgress;
  selectedId: string;
  onSelect: (level: LevelDef) => void;
}

const WORLD_ART: Record<CampaignWorldDef["id"], { gradient: string; accent: string; skyline: string }> = {
  "neon-city": {
    gradient: "from-cyan-950 via-blue-950 to-fuchsia-950",
    accent: "text-cyan-200",
    skyline: "◢ ▌▐ ▇ ▆ ▐ ▌ ◢",
  },
  "sunset-mesa": {
    gradient: "from-red-950 via-orange-900 to-amber-600",
    accent: "text-amber-200",
    skyline: "▰ ︿︿ ▰ ︿︿ ▰",
  },
  "alpine-dawn": {
    gradient: "from-slate-950 via-blue-900 to-sky-500",
    accent: "text-sky-100",
    skyline: "▲ ︿ ▲ ︿︿ ▲",
  },
};

function LockIcon() {
  return <span aria-hidden="true">🔒</span>;
}

export function CampaignMap({ levels, progress, selectedId, onSelect }: Props) {
  const [selectedWorldId, setSelectedWorldId] = useState<CampaignWorldDef["id"] | null>(null);
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const worldId = event.state?.campaignWorld as CampaignWorldDef["id"] | undefined;
      setSelectedWorldId(CAMPAIGN_WORLDS.some((world) => world.id === worldId) ? worldId ?? null : null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const selectedWorld = CAMPAIGN_WORLDS.find((world) => world.id === selectedWorldId);
  const visibleLevels = useMemo(
    () => (selectedWorld ? levelsForWorld(selectedWorld).filter((level) => levels.some((item) => item.id === level.id)) : []),
    [levels, selectedWorld],
  );
  const completedCount = progress.completedLevelIds.length;

  if (selectedWorld) {
    const worldUnlocked = isWorldUnlocked(progress, selectedWorld);
    const art = WORLD_ART[selectedWorld.id];
    return (
      <section className="glass rounded-3xl border border-white/5 p-4 sm:p-6" aria-label={`${selectedWorld.name} level selection`}>
        <button
          type="button"
          onClick={() => {
            setSelectedWorldId(null);
            window.history.back();
          }}
          className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1 font-display text-[10px] uppercase tracking-[0.25em] text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          ← Back to Worlds
        </button>
        <div className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-5", art.gradient)}>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 select-none text-center font-display text-2xl tracking-[0.5em] text-white/15" aria-hidden="true">{art.skyline}</div>
          <div className="relative">
            <div className={cn("font-display text-[10px] uppercase tracking-[0.35em]", art.accent)}>World {CAMPAIGN_WORLDS.indexOf(selectedWorld) + 1} · {visibleLevels.length} levels</div>
            <h2 className="mt-1 font-display text-2xl font-black text-white sm:text-3xl">{selectedWorld.name}</h2>
            <p className="mt-1 max-w-xl font-ui text-sm text-slate-200/80">{selectedWorld.description}</p>
          </div>
        </div>
        {!worldUnlocked && (
          <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <LockIcon /> Complete Level {selectedWorld.levelStart - 1} to unlock this world.
          </div>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {visibleLevels.map((level) => {
            const unlocked = worldUnlocked && progress.unlockedLevelIds.includes(level.id);
            const completed = progress.completedLevelIds.includes(level.id);
            const best = progress.bestResults[level.id];
            const selected = selectedId === level.id;
            return (
              <button
                key={level.id}
                type="button"
                disabled={!unlocked}
                aria-label={`${level.index}. ${level.name}${unlocked ? "" : " locked"}`}
                aria-pressed={selected}
                onClick={() => unlocked && onSelect(level)}
                className={cn(
                  "relative min-h-[136px] overflow-hidden rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                  unlocked ? "border-white/15 bg-white/[0.045] hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-300/[0.08]" : "cursor-not-allowed border-white/5 bg-black/20 opacity-45",
                  selected && "border-cyan-300/80 bg-cyan-300/[0.12] shadow-[0_0_28px_rgba(34,211,238,0.2)]",
                )}
              >
                <div className="absolute right-3 top-3 text-lg" aria-hidden="true">{completed ? "🏆" : unlocked ? "◈" : <LockIcon />}</div>
                <div className="font-display text-[10px] uppercase tracking-[0.3em] text-cyan-200/70">Level {level.index}</div>
                <div className="mt-1 pr-8 font-display text-lg font-black text-white">{level.name}</div>
                <div className="mt-1 line-clamp-2 font-ui text-xs text-slate-400">{level.blurb}</div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-display text-[9px] uppercase tracking-wider text-slate-500">
                  <span>{level.difficulty}</span><span>{level.targetWpm} WPM+</span><span>{level.minimumAccuracy}% ACC</span>
                  {best && <span className="text-amber-300/80">BEST {best.wpm.toFixed(0)} WPM</span>}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="glass rounded-3xl border border-white/5 p-4 sm:p-6" aria-label="Campaign worlds">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-300/70">Campaign map</div>
          <h2 className="mt-1 font-display text-2xl font-black text-white sm:text-3xl">Choose your world</h2>
        </div>
        <div className="text-right font-ui text-[11px] text-slate-400">{completedCount}/{levels.length} complete</div>
      </div>
      <div className="mt-5 grid gap-4">
        {CAMPAIGN_WORLDS.map((world) => {
          const unlocked = isWorldUnlocked(progress, world);
          const worldLevels = levelsForWorld(world);
          const done = worldLevels.filter((level) => progress.completedLevelIds.includes(level.id)).length;
          const art = WORLD_ART[world.id];
          return (
            <button
              key={world.id}
              type="button"
              disabled={!unlocked}
              onClick={() => {
                if (!unlocked) return;
                window.history.pushState({ ...(window.history.state ?? {}), campaignWorld: world.id }, "", window.location.href);
                setSelectedWorldId(world.id);
              }}
              aria-label={`${world.name}${unlocked ? "" : " locked"}`}
              className={cn(
                "group relative min-h-[150px] overflow-hidden rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                "bg-gradient-to-br", art.gradient,
                unlocked ? "border-white/15 hover:-translate-y-1 hover:border-white/40 hover:shadow-[0_16px_35px_rgba(0,0,0,0.3)]" : "cursor-not-allowed border-white/5 opacity-55",
              )}
            >
              <div className="pointer-events-none absolute inset-x-0 bottom-1 select-none text-center font-display text-3xl tracking-[0.6em] text-white/15 transition-transform duration-500 group-hover:scale-105" aria-hidden="true">{art.skyline}</div>
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className={cn("font-display text-[10px] uppercase tracking-[0.35em]", art.accent)}>Levels {world.levelStart}–{world.levelEnd}</div>
                  <h3 className="mt-1 font-display text-2xl font-black text-white">{world.name}</h3>
                  <p className="mt-1 max-w-lg font-ui text-sm text-slate-200/80">{world.description}</p>
                </div>
                <div className="text-2xl" aria-hidden="true">{unlocked ? "◈" : <LockIcon />}</div>
              </div>
              <div className="relative mt-5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${(done / worldLevels.length) * 100}%` }} /></div>
                <span className="font-display text-[10px] uppercase tracking-wider text-white/70">{done}/{worldLevels.length} complete</span>
              </div>
              {!unlocked && <div className="relative mt-2 font-ui text-xs text-amber-100/80">Complete Level {world.levelStart - 1} to unlock</div>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
