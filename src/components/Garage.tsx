import { useMemo, useState } from "react";
import { audio } from "@/game/audio";
import { CARS, PAINTS, SPOILERS, WHEELS, GLOWS, UPGRADE_COSTS, UPGRADE_DEFS, MAX_UPGRADE, DEFAULT_UPGRADES, defaultCustomization, effectiveStats } from "@/game/cars";
import { GARAGES } from "@/game/garage";
import type { CarBuild, CarCustomization, CarUpgrades, Profile } from "@/game/types";
import { cn } from "@/utils/cn";
import { Button, Label, StatBar } from "./ui";
import { CarViewer3D } from "./garage/CarViewer3D";
interface Props { profile: Profile; onProfile: (p: Profile) => void; onBack: () => void; onRace: () => void; onQA?: () => void; }
export function Garage({ profile, onProfile, onBack, onRace, onQA }: Props) {
  const [index, setIndex] = useState(() => Math.max(0, CARS.findIndex((c) => c.id === profile.selectedCar)));
  const [auto, setAuto] = useState(true);
  const [req, setReq] = useState(0);
  const [preset, setPreset] = useState<"front"|"rear"|"left"|"right"|"top"|"cockpit"|"reset">("front");
  const [inspect, setInspect] = useState<string | null>(null);
  const [toast, setToast] = useState<string|null>(null);
  const def = CARS[index] ?? CARS[0];
  const owned = profile.ownedCars.includes(def.id);
  const custom: CarCustomization = { ...defaultCustomization(def), ...(profile.customizations[def.id] ?? {}) };
  const upgrades: CarUpgrades = { ...DEFAULT_UPGRADES, ...(profile.upgrades[def.id] ?? {}) };
  const build = useMemo<CarBuild>(() => ({ def, custom, upgrades, plate: (profile.name || "ACE").toUpperCase().slice(0,7) }), [def, custom, upgrades, profile.name]);
  const stats = effectiveStats(build);
  const garageId = profile.garageId ?? "obsidian";
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 1400); };
  const saveCustom = (next: CarCustomization, cost = 0, ownedAlready = true) => {
    if (!owned) { flash("Buy the car first"); return; }
    if (cost > 0 && !ownedAlready && profile.credits < cost) { audio.play("denied"); flash("Need more credits"); return; }
    onProfile({ ...profile, credits: ownedAlready ? profile.credits : profile.credits - cost, ownedItems: ownedAlready ? profile.ownedItems : { ...profile.ownedItems, [def.id]: [...(profile.ownedItems[def.id] ?? []), cost+next.paint] }, customizations: { ...profile.customizations, [def.id]: next } });
    audio.play(ownedAlready ? "click" : "buy");
  };
  const buyCar = () => {
    if (owned) { onProfile({ ...profile, selectedCar: def.id }); audio.play("click"); return; }
    if (profile.credits < def.price) { audio.play("denied"); flash("Need more credits"); return; }
    onProfile({ ...profile, credits: profile.credits - def.price, ownedCars: [...profile.ownedCars, def.id], selectedCar: def.id });
    audio.play("buy"); flash("Added to garage");
  };
  const go = (p: typeof preset) => { setPreset(p); setReq((n) => n + 1); audio.play("click"); };
  return (
    <div className="h-full w-full overflow-y-auto overscroll-contain bg-[#05070d] pb-safe text-slate-100">
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <div className="text-right"><div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/70">{def.manufacturer} · {def.class}</div><div className="font-display text-xl font-black sm:text-3xl">{def.fullName}</div></div>
          <div className="glass rounded-xl px-3 py-1 text-amber-300 font-bold">{profile.credits.toLocaleString()} CR</div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[280px_1fr_300px]">
          <div className="glass rounded-2xl p-4">
            <Label>Vehicle</Label>
            <div className="mt-1 text-sm text-slate-300">{def.tagline}</div>
            <div className="mt-3 space-y-2"><StatBar label="Top" value={stats.top} /><StatBar label="Accel" value={stats.accel} color="bg-fuchsia-400" /><StatBar label="Grip" value={stats.grip} color="bg-emerald-400" /><StatBar label="Nitro" value={stats.nitro} color="bg-amber-400" /></div>
            <div className="mt-3 text-[11px] text-slate-400">{def.drivetrain} · {def.powertrain}<br />{def.bodyType} · {def.exhaust}<br />{def.unlockNote}</div>
            <Button variant={owned ? "secondary" : "primary"} onClick={buyCar} className="mt-3 w-full">{owned ? (profile.selectedCar === def.id ? "Selected" : "Select") : `Buy ${def.price.toLocaleString()} CR`}</Button>
            <Button variant="primary" onClick={onRace} className="mt-2 w-full">Race</Button>
            {onQA && <Button variant="secondary" onClick={onQA} className="mt-2 w-full text-cyan-300 border-cyan-400/40">🏎️ Compare silhouettes</Button>}
          </div>
          <div className="relative min-h-[300px] overflow-hidden rounded-2xl border border-white/10 bg-black sm:min-h-[520px]">
            <CarViewer3D build={build} garageId={garageId} autoRotate={auto} inspectPart={inspect} request={{ preset, nonce: req }} />
            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
              {(["rear","left","right","top","cockpit","reset"] as const).map((p) => (<button key={p} onClick={() => go(p)} className="touch-target rounded-md border border-white/15 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-200 backdrop-blur hover:border-cyan-300">{p}</button>))}
            </div>
            <div className="absolute right-2 top-2 flex gap-1">
              <button onClick={() => setAuto((a) => !a)} className={cn("touch-target rounded-md border px-2 py-1 text-[10px] uppercase tracking-widest backdrop-blur", auto ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-white/15 bg-black/60 text-slate-300")}>{auto ? "Auto on" : "Auto off"}</button>
              <button onClick={() => setInspect((v) => (v ? null : "wheels"))} className="touch-target rounded-md border border-white/15 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-200">Inspect</button>
            </div>
            {inspect && <div className="absolute left-2 bottom-2 max-w-[240px] rounded-xl border border-cyan-300/40 bg-black/70 p-2 text-[11px] text-cyan-100">Inspecting {inspect} equipment.</div>}
            {toast && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-xs">{toast}</div>}
          </div>
          <div className="glass rounded-2xl p-4">
            <Label>Showroom</Label>
            <div className="mt-2 grid gap-1">{GARAGES.map((g) => (<button key={g.id} onClick={() => { onProfile({ ...profile, garageId: g.id }); audio.play("click"); }} className={cn("rounded-lg border px-2 py-1 text-left text-xs", garageId === g.id ? "border-cyan-300 bg-cyan-400/10 text-white" : "border-white/10 text-slate-300")}>{g.name}</button>))}</div>
            <Label className="mt-3">Paint</Label>
            <div className="mt-1 flex flex-wrap gap-1">{PAINTS.map((p) => (<button key={p.id} title={p.name} onClick={() => saveCustom({ ...custom, paint: p.hex })} className={cn("h-7 w-7 rounded-full border", custom.paint === p.hex ? "border-white" : "border-white/20")} style={{ background: p.hex }} />))}</div>
            <Label className="mt-3">Wheels</Label>
            <div className="mt-1 grid gap-1">{WHEELS.map((w) => (<button key={w.id} onClick={() => saveCustom({ ...custom, wheels: w.id, rims: (w.id as unknown as CarCustomization["rims"]) })} className={cn("rounded-lg border px-2 py-1 text-left text-xs", (custom.wheels ?? custom.rims) === w.id ? "border-cyan-300 text-white" : "border-white/10 text-slate-300")}>{w.name} · {w.price} CR</button>))}</div>
            <Label className="mt-3">Spoiler</Label>
            <div className="mt-1 grid gap-1">{SPOILERS.map((s) => (<button key={s.id} onClick={() => saveCustom({ ...custom, spoiler: s.id, wing: s.id })} className={cn("rounded-lg border px-2 py-1 text-left text-xs", (custom.wing ?? custom.spoiler) === s.id ? "border-cyan-300 text-white" : "border-white/10 text-slate-300")}>{s.name} · {s.price} CR</button>))}</div>
            <Label className="mt-3">Underglow</Label>
            <div className="mt-1 flex flex-wrap gap-1">{GLOWS.map((g) => (<button key={g.id} onClick={() => saveCustom({ ...custom, glow: g.id })} className={cn("rounded-lg border px-2 py-1 text-xs", custom.glow === g.id ? "border-cyan-300 text-white" : "border-white/10 text-slate-300")}>{g.name}</button>))}</div>
            <Label className="mt-3">Performance</Label>
            <div className="mt-1 space-y-1">{UPGRADE_DEFS.map((u) => { const lv = upgrades[u.key] ?? 0; const maxed = lv >= MAX_UPGRADE; return (<div key={u.key} className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1 text-xs"><span>{u.name} {lv}/{MAX_UPGRADE}</span><button disabled={maxed} onClick={() => { const price = UPGRADE_COSTS[lv] ?? 0; if (profile.credits < price) { flash("Need credits"); return; } onProfile({ ...profile, credits: profile.credits - price, upgrades: { ...profile.upgrades, [def.id]: { ...upgrades, [u.key]: lv + 1 } } }); audio.play("buy"); }} className="rounded bg-amber-400/20 px-2 py-0.5 text-amber-200">{maxed ? "MAX" : `${(UPGRADE_COSTS[lv] ?? 0).toLocaleString()} CR`}</button></div>); })}</div>
            <div className="mt-2 flex gap-1">
              <button onClick={() => setInspect("wheels")} className="flex-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200">Wheels</button>
              <button onClick={() => setInspect("spoiler")} className="flex-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200">Spoiler</button>
              <button onClick={() => setInspect("headlights")} className="flex-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200">Lights</button>
              <button onClick={() => setInspect("exhaust")} className="flex-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200">Exhaust</button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{CARS.map((c, i) => { const isOwned = profile.ownedCars.includes(c.id); return (<button key={c.id} onClick={() => { setIndex(i); setInspect(null); audio.play("click"); }} className={cn("w-[190px] shrink-0 rounded-xl border p-2 text-left", i === index ? "border-cyan-300 bg-cyan-400/10" : "border-white/10 bg-black/40")}><div className="text-[10px] uppercase tracking-widest text-slate-400">{c.manufacturer} · {c.class}</div><div className="font-display text-sm font-bold text-white">{c.name}</div><div className={cn("mt-1 text-[10px] font-bold uppercase", isOwned ? "text-emerald-300" : "text-amber-300")}>{isOwned ? "Owned" : `${c.price.toLocaleString()} CR`}</div><div className="text-[10px] text-slate-500">{isOwned ? "" : c.unlockNote}</div></button>); })}</div>
      </div>
    </div>
  );
}