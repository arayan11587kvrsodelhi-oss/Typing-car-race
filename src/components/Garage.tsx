import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audio } from "@/game/audio";
import {
  CARS,
  CAR_CLASS_LABEL,
  DEFAULT_UPGRADES,
  GLOWS,
  MAX_UPGRADE,
  PAINTS,
  SPOILERS,
  UPGRADE_COSTS,
  UPGRADE_DEFS,
  WHEELS,
  buildForCar,
  customizationFor,
  effectiveStats,
  generateOpponentBuilds,
  isCarOwned,
  normalizeStoredCarId,
  resolveSelectableCarId,
  upgradesFor,
} from "@/game/cars";
import { GARAGES } from "@/game/garage";
import { LEVELS } from "@/game/levels";
import type { Settings } from "@/game/storage";
import type { CarBuild, CarCustomization, CarDef, GraphicsQuality, Profile } from "@/game/types";
import { cn } from "@/utils/cn";
import { Button, Label, StatBar } from "./ui";
import { CarPreview } from "./CarPreview";
import { CarViewer3D, type ViewerPreset, type ViewerRequest } from "./garage/CarViewer3D";

interface Props {
  profile: Profile;
  settings: Settings;
  onProfile: (p: Profile) => void;
  onSettings: (patch: Partial<Settings>) => void;
  onBack: () => void;
  onRace: () => void;
}

type GarageTab = "vehicles" | "customize";

const VIEW_PRESETS: { id: ViewerPreset; label: string }[] = [
  { id: "reset", label: "3/4" },
  { id: "front", label: "Front" },
  { id: "rear", label: "Rear" },
  { id: "left", label: "Side" },
  { id: "top", label: "Top" },
  { id: "cockpit", label: "Cockpit" },
];

const GRAPHICS_OPTIONS: GraphicsQuality[] = ["low", "medium", "high"];

function LockIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Vehicle Selection Garage.
 *
 * Replaces the old showroom + automatic seven-car lineup: the player previews
 * one vehicle at a time, browses every real car definition in a scrollable
 * selection grid, and selects/unlocks the vehicle used by the race.
 *
 * Locking follows the existing progression model: a car is selectable only when
 * it is present in `profile.ownedCars`. Purchases use the vehicle's `price`
 * exactly like the previous garage did.
 */
export function Garage({ profile, settings, onProfile, onSettings, onBack, onRace }: Props) {
  const [tab, setTab] = useState<GarageTab>("vehicles");
  const [browseId, setBrowseId] = useState(() => resolveSelectableCarId(profile, profile.selectedCar));
  const [auto, setAuto] = useState(false);
  const [req, setReq] = useState<ViewerRequest>({ preset: "reset", nonce: 0 });
  const [inspect, setInspect] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [canRender3D, setCanRender3D] = useState(false);
  const [view2D, setView2D] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  // One WebGL context max, and only where the disabled-GPU machines can afford it.
  useEffect(() => {
    setCanRender3D(webglAvailable());
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Keep the browse target valid if the profile changes underneath us (e.g. a
  // purchase or an external save update).
  useEffect(() => {
    if (!CARS.some((c) => c.id === browseId)) setBrowseId(resolveSelectableCarId(profile, profile.selectedCar));
  }, [browseId, profile]);

  const def = CARS.find((c) => c.id === browseId) ?? CARS[0];
  const owned = isCarOwned(profile, def.id);
  const selected = profile.selectedCar === def.id;

  const build = useMemo<CarBuild>(() => buildForCar(profile, def.id), [profile, def.id]);
  const custom: CarCustomization = useMemo(() => customizationFor(profile, def), [profile, def]);
  const upgrades = useMemo(() => upgradesFor(profile, def.id), [profile, def.id]);
  const stats = useMemo(() => effectiveStats(build), [build]);
  const garageId = profile.garageId ?? "obsidian";

  const flash = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const selectCar = useCallback(() => {
    const nextId = resolveSelectableCarId(profile, def.id);
    if (nextId !== def.id || !owned) {
      audio.play("denied");
      flash("Locked — unlock this vehicle first");
      return;
    }
    if (selected) return;
    onProfile({ ...profile, selectedCar: nextId });
    audio.play("click");
    flash(`${def.name} selected`);
  }, [def.id, def.name, flash, onProfile, owned, profile, selected]);

  const unlockCar = useCallback(() => {
    if (owned) {
      selectCar();
      return;
    }
    if (profile.credits < def.price) {
      audio.play("denied");
      flash("Need more credits");
      return;
    }
    onProfile({
      ...profile,
      credits: profile.credits - def.price,
      ownedCars: [...profile.ownedCars, def.id],
      selectedCar: def.id,
    });
    audio.play("buy");
    flash(`${def.name} added to garage`);
  }, [def.id, def.name, def.price, flash, onProfile, owned, profile, selectCar]);

  const saveCustom = useCallback(
    (next: CarCustomization) => {
      if (!owned) {
        flash("Unlock this vehicle first");
        return;
      }
      onProfile({ ...profile, customizations: { ...profile.customizations, [def.id]: next } });
      audio.play("click");
    },
    [def.id, flash, onProfile, owned, profile],
  );

  const buyUpgrade = useCallback(
    (key: keyof typeof DEFAULT_UPGRADES) => {
      if (!owned) {
        flash("Unlock this vehicle first");
        return;
      }
      const level = upgrades[key] ?? 0;
      if (level >= MAX_UPGRADE) return;
      const price = UPGRADE_COSTS[level] ?? 0;
      if (profile.credits < price) {
        audio.play("denied");
        flash("Need credits");
        return;
      }
      onProfile({
        ...profile,
        credits: profile.credits - price,
        upgrades: { ...profile.upgrades, [def.id]: { ...upgrades, [key]: level + 1 } },
      });
      audio.play("buy");
    },
    [def.id, flash, onProfile, owned, profile, upgrades],
  );

  const go = (preset: ViewerPreset) => {
    setReq((r) => ({ preset, nonce: r.nonce + 1 }));
    audio.play("click");
  };

  const quality: GraphicsQuality = settings.graphicsQuality ?? "low";
  const autoRotate = auto && quality !== "low" && !view2D;
  // Render 3D preview whenever WebGL is available; on low graphics, CarViewer3D runs
  // in demand-driven 30 FPS mode without MSAA. Users can also manually toggle 2D.
  const viewerMode = canRender3D && !view2D ? "3d" : "flat";

  return (
    <div className="h-full w-full overflow-y-auto overscroll-contain bg-[#05070d] pb-safe text-slate-100">
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-6">
        {/* ── header ─────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <div className="order-3 w-full text-center sm:order-none sm:w-auto sm:text-right">
            <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/70">Vehicle Garage</div>
            <div className="font-display text-lg font-black sm:text-2xl">{def.fullName}</div>
          </div>
          <div className="glass rounded-xl px-3 py-1 font-bold text-amber-300">{profile.credits.toLocaleString()} CR</div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[300px_1fr_320px]">
          {/* ── left: selected vehicle info + action ───────────────────── */}
          <div className="glass order-2 rounded-2xl p-4 lg:order-none">
            <Label>Vehicle</Label>
            <div className="mt-1 text-sm text-slate-300">{def.tagline}</div>
            <div className="flex mt-2 flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-widest">
              <span className="rounded-full border-white/15 px-2 py-0.5 text-slate-300">{CAR_CLASS_LABEL[def.class]}</span>
              {owned ? (
                <span className="rounded-full border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 font-bold text-emerald-300">Unlocked</span>
              ) : (
                <span className="flex items-center gap-1 rounded-full border-amber-300/40 bg-amber-400/10 px-2 py-0.5 font-bold text-amber-300"><LockIcon /> Locked</span>
              )}
              {selected && (
                <span className="flex items-center gap-1 rounded-full border-cyan-300/50 bg-cyan-400/15 px-2 py-0.5 font-bold text-cyan-200"><CheckIcon /> In use</span>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <StatBar label="Top" value={stats.top} />
              <StatBar label="Accel" value={stats.accel} color="bg-fuchsia-400" />
              <StatBar label="Grip" value={stats.grip} color="bg-emerald-400" />
              <StatBar label="Nitro" value={stats.nitro} color="bg-amber-400" />
            </div>

            <div className="mt-3 space-y-0.5 text-[11px] text-slate-400">
              <div>{def.drivetrain} · {def.powertrain} · {def.bodyType}</div>
              <div>{def.engineType}</div>
              <div>{def.exhaust} · {def.wheelStyle}</div>
              <div className="text-slate-500">{def.unlockNote}</div>
            </div>

            {owned ? (
              <Button variant={selected ? "secondary" : "primary"} onClick={selectCar} disabled={selected} className="mt-3 w-full">
                {selected ? "Selected for race" : "Use this vehicle"}
              </Button>
            ) : (
              <Button variant="primary" onClick={unlockCar} className="mt-3 w-full">
                Unlock · {def.price.toLocaleString()} CR
              </Button>
            )}
            <Button variant="secondary" onClick={onRace} className="mt-2 w-full">Race</Button>
            {!owned && profile.credits < def.price && (
              <div className="mt-2 text-center text-[10px] uppercase tracking-widest text-slate-500">
                {def.price - profile.credits > 0 ? `${(def.price - profile.credits).toLocaleString()} CR short` : ""}
              </div>
            )}
          </div>

          {/* ── centre: single large preview ───────────────────────────── */}
          <div
            className={cn(
              "relative order-1 min-h-[260px] overflow-hidden rounded-2xl border-white/10 bg-black sm:min-h-[440px] lg:order-none lg:min-h-[560px]",
              !owned && "border-amber-300/20",
            )}
          >
            {canRender3D ? (
              <CarViewer3D
                build={build}
                garageId={garageId}
                autoRotate={autoRotate}
                inspectPart={inspect}
                request={req}
                mode={viewerMode}
                quality={quality}
                opponentBuilds={generateOpponentBuilds(build)}
              />
            ) : (
              <CarPreview build={build} className="h-full w-full" />
            )}

            {!owned && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border-amber-300/40 bg-black/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200 backdrop-blur">
                  <LockIcon /> Locked · {def.price.toLocaleString()} CR
                </div>
              </div>
            )}

            <div className="absolute left-2 top-2 flex max-w-[70%] flex-wrap gap-1">
              {VIEW_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => go(p.id)} className={cn("touch-target rounded-md border-white/15 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest backdrop-blur hover:border-cyan-300", req.preset === p.id ? "text-cyan-200" : "text-slate-200")}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="absolute right-2 top-2 flex gap-1">
              {canRender3D && (
                <button
                  type="button"
                  onClick={() => {
                    setView2D((v) => !v);
                    audio.play("click");
                  }}
                  className={cn(
                    "touch-target rounded-md border px-2 py-1 text-[10px] uppercase tracking-widest backdrop-blur transition-colors",
                    view2D ? "border-amber-300/60 bg-amber-400/20 text-amber-200" : "border-white/15 bg-black/60 text-slate-300 hover:border-cyan-300",
                  )}
                  title="Switch between 3D model and 2D canvas preview"
                >
                  {view2D ? "2D" : "3D"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setAuto((a) => !a)}
                disabled={quality === "low" || view2D}
                title={quality === "low" ? "Auto-rotate is disabled on low graphics" : view2D ? "Auto-rotate is disabled in 2D preview" : undefined}
                className={cn(
                  "touch-target rounded-md border px-2 py-1 text-[10px] uppercase tracking-widest backdrop-blur disabled:opacity-40",
                  autoRotate ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-white/15 bg-black/60 text-slate-300",
                )}
              >
                {autoRotate ? "Auto on" : "Auto off"}
              </button>
            </div>
            {toast && <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border-white/15 bg-black/75 px-3 py-1 text-xs">{toast}</div>}

            {/* stacked gallery change: one model only, with a hint of the current pick */}
            <div className="pointer-events-none absolute bottom-2 right-2 rounded-md border-white/10 bg-black/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-slate-400">
              {viewerMode === "3d" ? "3D preview" : "2D preview"}
            </div>
          </div>

          {/* ── right: customization / equipment ───────────────────────── */}
          <div className="glass order-3 rounded-2xl p-4 lg:order-none">
            <div className="mb-2 flex gap-1 rounded-lg border-white/10 bg-black/30 p-0.5">
              {(["vehicles", "customize"] as GarageTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); audio.play("click"); }}
                  aria-pressed={tab === t}
                  className={cn("flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition", tab === t ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:text-white")}
                >
                  {t === "vehicles" ? "Garage" : "Customize"}
                </button>
              ))}
            </div>

            {tab === "vehicles" ? (
              <>
                <Label>Graphics</Label>
                <div className="grid mt-1 grid-cols-3 gap-1" role="radiogroup" aria-label="Garage graphics quality">
                  {GRAPHICS_OPTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      role="radio"
                      aria-checked={quality === q}
                      onClick={() => onSettings({ graphicsQuality: q })}
                      className={cn("rounded-lg border px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest", quality === q ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100" : "border-white/10 text-slate-400 hover:bg-white/5")}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {quality === "low" ? "Low: 30 FPS demand 3D rendering (efficient for laptops)." : quality === "medium" ? "Medium: 60 FPS standard 3D rendering." : "High: 60 FPS enhanced 1.5x resolution rendering."}
                </p>

                <Label className="mt-3">Showroom</Label>
                <div className="mt-1 grid gap-1">
                  {GARAGES.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { onProfile({ ...profile, garageId: g.id }); audio.play("click"); }}
                      className={cn("rounded-lg border px-2 py-1 text-left text-xs", garageId === g.id ? "border-cyan-300 bg-cyan-400/10 text-white" : "border-white/10 text-slate-300")}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>

                <Label className="mt-3">Progression</Label>
                <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                  <div>Campaign levels: {profile.levelProgress ? Object.keys(profile.levelProgress).length : 0}/{LEVELS.length}</div>
                  <div>Unlocked vehicles: {profile.ownedCars.length}/{CARS.length}</div>
                  <div>Best WPM: <span className="text-cyan-200 font-bold">{profile.bestWpm}</span></div>
                </div>
              </>
            ) : (
              <fieldset disabled={!owned} className={cn("space-y-1", !owned && "opacity-50")}>
                {!owned && <p className="mb-2 rounded-lg border-amber-300/30 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100">Unlock this vehicle to customize it.</p>}
                <Label>Paint</Label>
                <div className="flex mt-1 flex-wrap gap-1">
                  {PAINTS.map((p) => (
                    <button key={p.id} type="button" title={p.name} aria-label={p.name} onClick={() => saveCustom({ ...custom, paint: p.hex })} className={cn("h-7 w-7 rounded-full border", custom.paint === p.hex ? "border-white" : "border-white/20")} style={{ background: p.hex }} />
                  ))}
                </div>
                <Label className="mt-3">Wheels</Label>
                <div className="mt-1 grid gap-1">
                  {WHEELS.map((w) => (
                    <button key={w.id} type="button" onClick={() => saveCustom({ ...custom, wheels: w.id, rims: w.id as unknown as CarCustomization["rims"] })} className={cn("rounded-lg border px-2 py-1 text-left text-xs", (custom.wheels ?? custom.rims) === w.id ? "border-cyan-300 text-white" : "border-white/10 text-slate-300")}>
                      {w.name}
                    </button>
                  ))}
                </div>
                <Label className="mt-3">Spoiler</Label>
                <div className="mt-1 grid gap-1">
                  {SPOILERS.map((s) => (
                    <button key={s.id} type="button" onClick={() => saveCustom({ ...custom, spoiler: s.id, wing: s.id })} className={cn("rounded-lg border px-2 py-1 text-left text-xs", (custom.wing ?? custom.spoiler) === s.id ? "border-cyan-300 text-white" : "border-white/10 text-slate-300")}>
                      {s.name}
                    </button>
                  ))}
                </div>
                <Label className="mt-3">Underglow</Label>
                <div className="flex mt-1 flex-wrap gap-1">
                  {GLOWS.map((g) => (
                    <button key={g.id} type="button" onClick={() => saveCustom({ ...custom, glow: g.id })} className={cn("rounded-lg border px-2 py-1 text-xs", custom.glow === g.id ? "border-cyan-300 text-white" : "border-white/10 text-slate-300")}>
                      {g.name}
                    </button>
                  ))}
                </div>
                <Label className="mt-3">Performance</Label>
                <div className="mt-1 space-y-1">
                  {UPGRADE_DEFS.map((u) => {
                    const level = upgrades[u.key] ?? 0;
                    const maxed = level >= MAX_UPGRADE;
                    return (
                      <div key={u.key} className="flex items-center justify-between rounded-lg border-white/10 px-2 py-1 text-xs">
                        <span>{u.name} {level}/{MAX_UPGRADE}</span>
                        <button type="button" disabled={maxed} onClick={() => buyUpgrade(u.key)} className="rounded bg-amber-400/20 px-2 py-0.5 text-amber-200 disabled:opacity-50">
                          {maxed ? "MAX" : `${(UPGRADE_COSTS[level] ?? 0).toLocaleString()} CR`}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-1">
                  {["wheels", "spoiler", "headlights", "exhaust"].map((part) => (
                    <button key={part} type="button" onClick={() => setInspect((v) => (v === part ? null : part))} className="flex-1 rounded-lg border-white/10 px-1 py-1 text-[10px] capitalize text-slate-200">
                      {part === "headlights" ? "Lights" : part}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </div>

        {/* ── vehicle selection grid ─────────────────────── */}
        <div className="mt-4">
          <div className="mb-2 flex items-end justify-between gap-2">
            <div>
              <Label>Choose your vehicle</Label>
              <div className="text-[10px] text-slate-500">{CARS.length} vehicles · swipe or scroll to browse</div>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Selected: <span className="text-cyan-200">{CARS.find((c) => c.id === profile.selectedCar)?.name ?? def.name}</span></div>
          </div>

          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
            {CARS.map((car) => {
              const carOwned = isCarOwned(profile, car.id);
              const carSelected = profile.selectedCar === car.id;
              const browsing = car.id === def.id;
              return (
                <VehicleTile
                  key={car.id}
                  car={car}
                  profile={profile}
                  owned={carOwned}
                  selected={carSelected}
                  browsing={browsing}
                  onBrowse={() => {
                    setBrowseId(car.id);
                    setInspect(null);
                    audio.play("click");
                  }}
                  onUse={() => {
                    if (!carOwned) {
                      flash("Locked — unlock this vehicle first");
                      audio.play("denied");
                      return;
                    }
                    const nextId = normalizeStoredCarId(car.id);
                    if (!nextId) return;
                    setBrowseId(car.id);
                    onProfile({ ...profile, selectedCar: nextId });
                    audio.play("click");
                    flash(`${car.name} selected`);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function VehicleTile({
  car,
  profile,
  owned,
  selected,
  browsing,
  onBrowse,
  onUse,
}: {
  car: CarDef;
  profile: Profile;
  owned: boolean;
  selected: boolean;
  browsing: boolean;
  onBrowse: () => void;
  onUse: () => void;
}) {
  const thumbBuild = useMemo(() => buildForCar(profile, car.id), [profile, car.id]);
  // Tiles always use the shared cached 2D sprite renderer: seven thumbnails must
  // never mount seven WebGL scenes on a low-end machine.
  return (
    <div
      className={cn(
        "w-[210px] shrink-0 snap-start overflow-hidden rounded-xl border bg-black/40 transition-colors sm:w-auto",
        browsing ? "border-cyan-300 bg-cyan-400/10" : "border-white/10",
        !owned && "opacity-80",
      )}
    >
      <button type="button" onClick={onBrowse} aria-pressed={browsing} className="block w-full text-left">
        <div className="relative h-[86px] w-full overflow-hidden bg-gradient-to-b from-[#0b1020] to-[#05070f]">
          <CarPreview build={thumbBuild} variant="thumb" className="h-full w-full" />
          {!owned && (
            <div className="absolute right-1 top-1 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
              <LockIcon /> Locked
            </div>
          )}
          {selected && (
            <div className="absolute left-1 top-1 flex items-center gap-1 rounded bg-cyan-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200">
              <CheckIcon /> In use
            </div>
          )}
        </div>
        <div className="p-2">
          <div className="text-[9px] uppercase tracking-widest text-slate-400">{car.manufacturer} · {CAR_CLASS_LABEL[car.class]}</div>
          <div className="font-display text-sm font-bold text-white">{car.name}</div>
          <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px]">
            <span className={cn("font-bold uppercase", owned ? "text-emerald-300" : "text-amber-300")}>
              {owned ? "Unlocked" : `${car.price.toLocaleString()} CR`}
            </span>
            <span className="text-slate-500">Top {car.stats.top.toFixed(2)}</span>
          </div>
        </div>
      </button>
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onUse}
          disabled={!owned || selected}
          aria-label={`${owned ? (selected ? `${car.name} is selected` : `Use ${car.name}`) : `${car.name} is locked`}`}
          className={cn(
            "w-full rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition",
            selected
              ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
              : owned
                ? "border-cyan-300/50 text-cyan-100 hover:bg-cyan-400/15"
                : "cursor-not-allowed border-white/10 text-slate-500",
          )}
        >
          {selected ? "Selected" : owned ? "Use vehicle" : "Locked"}
        </button>
      </div>
    </div>
  );
}
