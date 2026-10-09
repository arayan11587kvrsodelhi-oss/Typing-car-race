import { useEffect, useMemo, useState } from "react";
import { audio } from "@/game/audio";
import { effectiveStats } from "@/game/cars";
import { DIFFICULTY_BLURB, DIFFICULTY_LABEL } from "@/game/engine";
import { ENV_LIST } from "@/game/environments";
import type { Settings } from "@/game/storage";
import { LEVELS, type CampaignProgress, type LevelDef } from "@/game/levels";
import { DISTANCE_BLURB, DISTANCE_LABEL } from "@/game/track";
import type { CarBuild, Difficulty, EnvironmentId, Profile, RaceConfig, RaceDistance, ScoreEntry } from "@/game/types";
import { cn } from "@/utils/cn";
import { CarPreview } from "./CarPreview";
import { DemoBackground } from "./DemoBackground";
import { Button, Kbd, Label, SegmentedControl, StatBar } from "./ui";
import { CampaignMap } from "./CampaignMap";

interface Props {
  profile: Profile;
  settings: Settings;
  build: CarBuild;
  scores: ScoreEntry[];
  onSettings: (s: Partial<Settings>) => void;
  onName: (name: string) => void;
  campaign: CampaignProgress;
  onSelectLevel: (level: LevelDef) => void;
  selectedLevelId: string;
  onStart: (levelId: string) => void;
  onQuickRace: () => void;
  onGarage: () => void;
  onScores: () => void;
  onQA?: () => void;
}

const ENV_GRADIENT: Partial<Record<EnvironmentId, string>> = {
  night: "from-indigo-950 via-purple-900 to-fuchsia-800",
  sunset: "from-purple-900 via-orange-600 to-amber-400",
  dawn: "from-slate-800 via-sky-600 to-orange-200",
};

const STAT_ICONS = {
  top: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <path d="M21 20V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  accel: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 19 22 12 13 5 13 19"></polygon>
    </svg>
  ),
  grip: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  ),
  nitro: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
    </svg>
  ),
};

export function StartScreen({ profile, settings, build, scores, campaign, selectedLevelId, onSelectLevel, onSettings, onName, onStart, onQuickRace, onGarage, onScores, onQA }: Props) {
  const demoConfig = useMemo<RaceConfig>(
    () => ({ build, difficulty: "pro", distance: "marathon", environment: settings.environment, playerName: profile.name, demo: true }),
    [build, settings.environment, profile.name],
  );
  const stats = effectiveStats(build);
  const best = scores[0];
  const [nameLength, setNameLength] = useState(profile.name.length);
  const [quickRaceSetup, setQuickRaceSetup] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.target === document.body) {
        e.preventDefault();
        onStart(selectedLevelId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart, selectedLevelId]);

  const handleEnvSelect = (envId: EnvironmentId) => {
    audio.play("click");
    onSettings({ environment: envId });
  };

  const handleEnvKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, envId: EnvironmentId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleEnvSelect(envId);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-void">
      <DemoBackground config={demoConfig} />
      <div className="absolute inset-0 bg-gradient-to-r from-[#05070f]/95 via-[#05070f]/70 to-[#05070f]/30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070f] via-transparent to-[#05070f]/60 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent animate-scan pointer-events-none opacity-40" />
      
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-cyan-300/5 blur-[120px] animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-fuchsia-300/5 blur-[120px] animate-pulse-slow" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-cyan-300/3 via-transparent to-fuchsia-300/3 blur-[200px] opacity-30" />
      </div>

      <div className="relative h-full w-full overflow-y-auto scrollbar-thin">
        <div className="min-h-full flex flex-col px-4 py-4 sm:px-8 sm:py-8 lg:px-16 max-w-[1400px] mx-auto" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          {/* header */}
          <header className="flex items-start justify-between gap-4 mb-8 sm:mb-12">
            <div>
              <div className="text-[10px] sm:text-xs font-display uppercase tracking-[0.5em] text-cyan-300/80 animate-flicker mb-2">Typing Racer</div>
              <h1 className="font-display font-black text-[48px] sm:text-7xl lg:text-9xl leading-[0.9] tracking-tight title-gradient relative">
                <span className="relative z-10">TYPEDRIFT</span>
                <span className="absolute inset-0 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 blur-[60px] opacity-30 -z-10 scale-110" aria-hidden="true" />
              </h1>
              <p className="mt-2 font-ui text-sm sm:text-lg text-slate-300 tracking-wide max-w-xs">
                Type fast. <span className="text-cyan-200">Drive faster.</span> Every keystroke is horsepower.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="glass rounded-xl px-4 py-2.5 text-right border border-white/10">
                <div className="text-[9px] font-display uppercase tracking-[0.3em] text-amber-200/70">Credits</div>
                <div className="font-display font-black text-xl sm:text-3xl text-amber-300 leading-none">{profile.credits.toLocaleString()}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  audio.init();
                  onSettings({ muted: !settings.muted });
                }}
                className="glass rounded-xl w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070f]"
                aria-label={settings.muted ? "Unmute sound" : "Mute sound"}
                aria-pressed={settings.muted}
              >
                {settings.muted ? "🔇" : "🔊"}
              </button>
            </div>
          </header>

          {/* body */}
          <div className="flex-1 grid lg:grid-cols-[1.15fr_1fr] gap-6 sm:gap-8 mt-4 items-start">
            <section className="glass rounded-3xl p-5 sm:p-7 animate-slide-up border border-white/5">
              {quickRaceSetup ? (
                <section className="glass rounded-3xl border border-amber-300/20 p-4 sm:p-6" aria-label="Quick Race setup">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-[10px] uppercase tracking-[0.35em] text-amber-300/80">Quick Race</div>
                      <h2 className="mt-1 font-display text-2xl font-black text-white sm:text-3xl">Choose your track</h2>
                      <p className="mt-1 font-ui text-sm text-slate-400">Race any environment without changing campaign progress.</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setQuickRaceSetup(false)}>Back to campaign</Button>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Select quick race track">
                    {ENV_LIST.map((env) => {
                      const active = env.id === settings.environment;
                      return (
                        <button
                          key={env.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          tabIndex={active ? 0 : -1}
                          onClick={() => handleEnvSelect(env.id)}
                          onKeyDown={(e) => handleEnvKeyDown(e, env.id)}
                          onFocus={() => handleEnvSelect(env.id)}
                          className={cn(
                            "relative h-[76px] overflow-hidden rounded-xl border p-2 text-left transition-all duration-200 sm:h-24",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070f]",
                            active
                              ? "z-10 scale-[1.02] border-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                              : "border-white/10 hover:border-white/25 hover:shadow-[0_0_12px_rgba(34,211,238,0.15)]",
                          )}
                        >
                          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", ENV_GRADIENT[env.id])} aria-hidden="true" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" aria-hidden="true" />
                          <div className="relative">
                            <div className="font-display text-[11px] font-bold tracking-wider text-white sm:text-xs">{env.name}</div>
                            <div className="hidden font-ui text-[10px] leading-tight text-slate-200/80 sm:block">{env.blurb}</div>
                            {active && <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">✓</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="primary" size="lg" onClick={onQuickRace} className="mt-5 w-full">
                    Start Quick Race
                  </Button>
                </section>
              ) : (
                <CampaignMap
                  levels={LEVELS}
                  progress={campaign}
                  selectedId={selectedLevelId}
                  onSelect={onSelectLevel}
                />
              )}
              <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
                <div>
                  <Label className="mb-1.5 flex items-center gap-2">
                    Driver name
                    <span className="text-xs text-slate-500 font-normal">({nameLength}/10)</span>
                  </Label>
                  <div className="relative">
                    <input
                      value={profile.name}
                      maxLength={10}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9 _-]/g, "");
                        onName(value);
                        setNameLength(value.length);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      onFocus={(e) => setNameLength(e.currentTarget.value.length)}
                      className="w-full rounded-xl bg-black/40 border border-white/10 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/20 px-4 py-3 font-display font-bold text-lg tracking-[0.2em] text-white placeholder:text-slate-500/50 transition-all duration-200"
                      placeholder="ACE"
                      aria-describedby="name-hint"
                    />
                    <div id="name-hint" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400/60 pointer-events-none" aria-hidden="true">
                      {nameLength}/10
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 font-ui pb-3 hidden sm:block">
                  Best WPM <span className="text-cyan-200 font-bold text-base">{profile.bestWpm}</span> · Races <span className="text-white font-bold">{profile.racesPlayed}</span>
                </div>
              </div>

              <div className="mt-5">
                <Label className="mb-1.5">Rivals</Label>
                <SegmentedControl<Difficulty>
                  value={settings.difficulty}
                  onChange={(v) => onSettings({ difficulty: v })}
                  options={(["rookie", "pro", "legend"] as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d], hint: DIFFICULTY_BLURB[d] }))}
                />
              </div>
              <div className="mt-4">
                <Label className="mb-1.5">Distance</Label>
                <SegmentedControl<RaceDistance>
                  value={settings.distance}
                  onChange={(v) => onSettings({ distance: v })}
                  options={(["sprint", "circuit", "marathon"] as RaceDistance[]).map((d) => ({ value: d, label: DISTANCE_LABEL[d], hint: DISTANCE_BLURB[d] }))}
                />
              </div>
              <div className="mt-4">
                <Label className="mb-1.5">Graphics</Label>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Select graphics quality">
                  {(["low", "medium", "high"] as const).map((quality) => (
                    <button
                      key={quality}
                      type="button"
                      role="radio"
                      aria-checked={(settings.graphicsQuality ?? "low") === quality}
                      onClick={() => onSettings({ graphicsQuality: quality })}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-display uppercase tracking-wider transition-colors",
                        (settings.graphicsQuality ?? "low") === quality
                          ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08]",
                      )}
                    >
                      {quality}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-slate-500">Low is recommended for integrated graphics.</p>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button variant="primary" size="lg" onClick={() => onStart(selectedLevelId)} className="flex-1 text-base sm:text-lg py-4.5 font-display relative overflow-hidden group">
                  <span className="relative flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 group-hover:animate-bounce-subtle transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Start Race
                    <Kbd className="ml-1 hidden sm:inline-flex">↵</Kbd>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-fuchsia-400/20 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                </Button>
                <Button variant="secondary" size="lg" onClick={() => setQuickRaceSetup(true)} className="flex items-center justify-center gap-2">
                  Quick race
                </Button>
                <Button variant="secondary" size="lg" onClick={onScores} className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="7"></circle>
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                  </svg>
                  High Scores
                </Button>
              </div>
              <div className="mt-4 text-[11px] sm:text-xs text-slate-400 font-ui leading-relaxed">
                Type the sentence shown to accelerate. Typos make you skid, combos multiply your score, and a full nitro bar fires with <Kbd>Enter</Kbd>. Finish ahead of three rivals.
              </div>
            </section>

            <aside className="glass rounded-3xl p-5 sm:p-7 animate-slide-up [animation-delay:120ms] flex flex-col border border-white/5">
              <div className="flex items-start justify-between">
                <div>
                  <Label>Your ride</Label>
                  <div className="font-display font-black text-2xl sm:text-3xl text-white">{build.def.name}</div>
                  <div className="text-xs text-slate-400 font-ui">{build.def.tagline}</div>
                </div>
                <div className="text-right text-[10px] font-ui text-slate-400 space-y-1">
                  {(["engine", "turbo", "tires", "nitro"] as const).map((k) => {
                    const lvl = build.upgrades[k] ?? 0;
                    return (
                      <div key={k} className="uppercase tracking-wider flex items-center justify-end gap-1">
                        <span className="text-slate-400">{k}</span>
                        <span className="text-cyan-200 font-bold">{"◆".repeat(lvl)}</span>
                        <span className="text-slate-700">{"◇".repeat(Math.max(0, 3 - lvl))}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="relative mt-3 h-[200px] sm:h-[280px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#0b1020] to-[#05070f] border border-white/5">
                <CarPreview build={build} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-ui uppercase tracking-wider mb-1">
                    {STAT_ICONS.top}
                    Top Speed
                  </div>
                  <div className="font-display font-bold text-xl text-white">{stats.top.toFixed(1)}</div>
                </div>
                <div className="glass rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-ui uppercase tracking-wider mb-1">
                    {STAT_ICONS.accel}
                    Acceleration
                  </div>
                  <div className="font-display font-bold text-xl text-fuchsia-300">{stats.accel.toFixed(1)}</div>
                </div>
                <div className="glass rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-ui uppercase tracking-wider mb-1">
                    {STAT_ICONS.grip}
                    Grip
                  </div>
                  <div className="font-display font-bold text-xl text-emerald-300">{stats.grip.toFixed(1)}</div>
                </div>
                <div className="glass rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-ui uppercase tracking-wider mb-1">
                    {STAT_ICONS.nitro}
                    Nitro
                  </div>
                  <div className="font-display font-bold text-xl text-amber-300">{stats.nitro.toFixed(1)}</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <StatBar label="Top" value={stats.top} icon={STAT_ICONS.top} />
                <StatBar label="Accel" value={stats.accel} color="bg-fuchsia-400" icon={STAT_ICONS.accel} />
                <StatBar label="Grip" value={stats.grip} color="bg-emerald-400" icon={STAT_ICONS.grip} />
                <StatBar label="Nitro" value={stats.nitro} color="bg-amber-400" icon={STAT_ICONS.nitro} />
              </div>

              <Button variant="secondary" size="lg" onClick={onGarage} className="mt-5 w-full flex items-center justify-center gap-2 group">
                <svg className="w-5 h-5 transition-transform group-hover:rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
                Garage · Customize & Upgrade
              </Button>
              
              {onQA && (
                <Button variant="ghost" size="sm" onClick={onQA} className="mt-2 w-full text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/15 font-bold flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                  Automotive Lineup (All 7 Vehicles)
                </Button>
              )}
              
              {best && (
                <div className="mt-4 pt-4 border-t border-white/5 text-center text-xs font-ui text-slate-400">
                  <div className="text-[10px] uppercase tracking-wider mb-1 text-slate-500">Current Leader</div>
                  Top score <span className="text-amber-300 font-bold">{best.score.toLocaleString()}</span> by <span className="text-white">{best.name}</span> · {best.wpm} WPM
                </div>
              )}
            </aside>
          </div>

          <footer className="mt-8 text-center text-[10px] text-slate-600 font-ui tracking-widest uppercase">
            Keyboard & touch · 60 fps · Progress saved locally
          </footer>
        </div>
      </div>
    </div>
  );
}
