import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { getCar, DEFAULT_UPGRADES, defaultCustomization } from "@/game/cars";
import type { CarBuild } from "@/game/types";
import { CarModel3D } from "../garage/CarModel3D";
import { getCar3DProfile } from "@/game/car3D";
import { cn } from "@/utils/cn";

export interface QAComparisonViewProps {
  onBack: () => void;
  onRaceCar: (carId: string) => void;
}

const QA_CAR_IDS = [
  "bmw-m3-competition",
  "porsche-911-gt3-rs",
  "bugatti-chiron",
  "koenigsegg-jesko",
  "lamborghini-aventador-svj",
  "ferrari-sf90-stradale",
  "mclaren-720s",
] as const;

type SilhouetteAngle = "front" | "rear" | "left" | "right" | "front34" | "rear34" | "top" | "orbit";
type PaintMode = "satin-silver" | "clay" | "stencil" | "factory";

const CAMERA_PRESETS: Record<SilhouetteAngle, { pos: [number, number, number]; target: [number, number, number] }> = {
  front:   { pos: [0, 0.72, 4.9],    target: [0, 0.65, 0] },
  rear:    { pos: [0, 0.72, -4.9],   target: [0, 0.65, 0] },
  left:    { pos: [-5.2, 0.72, 0],   target: [0, 0.65, 0] },
  right:   { pos: [5.2, 0.72, 0],    target: [0, 0.65, 0] },
  front34: { pos: [3.4, 1.35, 3.8],  target: [0, 0.62, 0] },
  rear34:  { pos: [-3.4, 1.35, -3.8], target: [0, 0.62, 0] },
  top:     { pos: [0, 6.2, 0.01],    target: [0, 0.35, 0] },
  orbit:   { pos: [3.4, 1.4, 3.8],   target: [0, 0.62, 0] },
};

const PAINT_COLORS: Record<PaintMode, string> = {
  "satin-silver": "#94a3b8", // Identical neutral metallic silver
  clay:           "#cbd5e1", // Pure matte clay form
  stencil:        "#05070d", // Pitch black silhouette stencil
  factory:        "",        // Factory paint
};

const MODEL_NOTES: Record<string, {
  name: string;
  manufacturer: string;
  silhouette: string;
  front: string;
  cabin: string;
  rear: string;
  aero: string;
}> = {
  "bmw-m3-competition": {
    name: "BMW M3 Competition",
    manufacturer: "BMW M",
    silhouette: "Distinct 3-box sedan profile with upright greenhouse, long horizontal hood, and separate rear trunk lid.",
    front: "Iconic tall vertical twin kidney grilles with 3D double slats and lower angular M bumper intakes.",
    cabin: "Upright A-pillar, flat roofline with M aerodynamic central carbon channel, 4-door B-pillar divider.",
    rear: "Quad round stainless exhaust tips in rear diffuser, subtle ducktail trunk lip spoiler.",
    aero: "Front lip splitter, M aerofoil twin-stalk side mirrors, rear quad diffuser.",
  },
  "porsche-911-gt3-rs": {
    name: "Porsche 911 GT3 RS",
    manufacturer: "Porsche Motorsport",
    silhouette: "Classic 911 continuous flyline sloping smoothly from roof peak down into rear engine deck. Massive flared rear haunches.",
    front: "Rounded teardrop front fender humps housing round LED headlights, short hood with dual NACA ducts, front fender louvres.",
    cabin: "Compact rounded teardrop glasshouse tapering into the rear haunches without a notchback step.",
    rear: "Massive swan-neck mounted dual-element GT rear wing with arched top pylons, central dual exhaust outlets.",
    aero: "4 aerodynamic louvres on top of each front fender, swan-neck GT wing, deep underbody diffuser.",
  },
  "bugatti-chiron": {
    name: "Bugatti Chiron",
    manufacturer: "Bugatti",
    silhouette: "Ultra-wide hypercar stance (2.04m width) with muscular shoulders and prominent kamm-tail rear.",
    front: "Polished horseshoe central grille, quad horizontal ice-cube crystal LED headlight blocks per side.",
    cabin: "The signature Bugatti C-Line: sweeping 3D trim arch running from A-pillar along roof and looping forward around side intake.",
    rear: "Razor-thin full-width continuous red LED light bar across rear mesh, wide quad exhaust cluster.",
    aero: "Central dorsal spine running along hood, roof, and engine deck; active rear wing/airbrake profile.",
  },
  "koenigsegg-jesko": {
    name: "Koenigsegg Jesko",
    manufacturer: "Koenigsegg",
    silhouette: "Jet-fighter wraparound panoramic bubble canopy with hidden A-pillars, elongated aerodynamic low tail.",
    front: "Extended carbon front splitter, dual front dive-plane canards, elongated low aerodynamic nose.",
    cabin: "Narrow wraparound fighter-jet visor dome with central dorsal fin.",
    rear: "Top-mounted Boomerang rear wing supported by a central overhead spine pylon, high central exhaust, 7-fin diffuser.",
    aero: "Active top-mounted Boomerang wing, rear dorsal fin, front canards, deep dihedral door channels.",
  },
  "lamborghini-aventador-svj": {
    name: "Lamborghini Aventador SVJ",
    manufacturer: "Lamborghini Squadra Corse",
    silhouette: "Extreme Gandini wedge: razor-sharp nose tip in a near-continuous straight planar slope to roof peak.",
    front: "Sharp angular nose with dual SVJ ALA 2.0 hood nostrils, Y-shaped LED headlights.",
    cabin: "Ultra-low flat roofline (1.14m height), steep rear engine cover louvres, angular faceted bodywork.",
    rear: "High-mounted dual bazooka exhaust exits right between taillights and above diffuser, SVJ Omega wing with center stanchion.",
    aero: "ALA 2.0 dual hood nostrils, Omega rear wing, massive hexagonal side intake scoops behind doors.",
  },
  "ferrari-sf90-stradale": {
    name: "Ferrari SF90 Stradale",
    manufacturer: "Ferrari",
    silhouette: "Cab-forward mid-engine stance with sleek hammerhead nose and flying buttresses flanking rear engine glass.",
    front: "Low front hammerhead winglet nose, horizontal slit headlights with lower DRL blades.",
    cabin: "Low bubble canopy with sculpted rear flying buttress arches creating negative space over engine glass.",
    rear: "Dual horizontal squared (squoval) twin taillight rings, high central dual exhaust exiting between taillights.",
    aero: "Front vortex generators, flying buttresses, suspended rear shut-off Gurney flap.",
  },
  "mclaren-720s": {
    name: "McLaren 720S",
    manufacturer: "McLaren Automotive",
    silhouette: "Organic teardrop greenhouse with 360-degree glass canopy, including glazed transparent rear C-pillars.",
    front: "Signature deep 'eye-socket' sculpted headlight recesses housing LED blades with air ducts beneath.",
    cabin: "Teardrop glasshouse with transparent rear quarter C-pillars, organic muscular body surfacing.",
    rear: "High-mounted dual round center exhaust pipes exiting through open rear hexagonal mesh.",
    aero: "Double-skin dihedral door air channels feeding radiators, high rear diffuser, active airbrake.",
  },
};

function SingleStudioScene({
  build,
  angle,
  stencilMode,
}: {
  build: CarBuild;
  angle: SilhouetteAngle;
  stencilMode: boolean;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const preset = CAMERA_PRESETS[angle];

  useEffect(() => {
    if (!controls.current) return;
    controls.current.target.set(...preset.target);
    controls.current.object.position.set(...preset.pos);
    controls.current.update();
  }, [angle, preset]);

  return (
    <>
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={2.5}
        maxDistance={12}
        maxPolarAngle={Math.PI / 2 + 0.05}
        autoRotate={angle === "orbit"}
        autoRotateSpeed={1.5}
      />

      {/* Lighting: Uniform studio 3-point key/fill/rim */}
      <ambientLight intensity={stencilMode ? 0.05 : 0.65} />
      <directionalLight position={[5, 8, 5]} intensity={stencilMode ? 0.3 : 2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 5, -5]} intensity={stencilMode ? 0.1 : 0.8} color="#a0c8ff" />
      <directionalLight position={[0, 4, -6]} intensity={stencilMode ? 0.1 : 1.2} color="#ffffff" />

      {/* Ground studio plane with dark reflective floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        {stencilMode ? (
          <meshStandardMaterial color="#f8fafc" roughness={0.9} metalness={0} />
        ) : (
          <MeshReflectorMaterial
            blur={[300, 100]}
            resolution={1024}
            mixBlur={0.8}
            mixStrength={0.7}
            roughness={0.22}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#080c14"
            metalness={0.8}
            mirror={0.7}
          />
        )}
      </mesh>

      <ContactShadows position={[0, 0, 0]} opacity={stencilMode ? 0.2 : 0.8} scale={10} blur={1.5} far={4} />

      {/* Single Car Model */}
      <CarModel3D
        build={build}
        position={[0, 0, 0]}
        rotationY={0}
        inspectPart={null}
        float={false}
      />
    </>
  );
}

// The lineup row runs along X.
// All 7 vehicles are placed side-by-side with identical camera height, identical
// perspective, identical lighting, and identical dark reflective floor.
const LINEUP_CAMERAS: Record<SilhouetteAngle, { pos: [number, number, number]; target: [number, number, number] }> = {
  front:   { pos: [0, 2.0, 24],    target: [0, 0.72, 0] },
  rear:    { pos: [0, 2.0, -24],   target: [0, 0.72, 0] },
  left:    { pos: [0, 1.85, 34],   target: [0, 0.72, 0] },
  right:   { pos: [0, 1.85, 34],   target: [0, 0.72, 0] },
  front34: { pos: [0, 3.2, 28],    target: [0, 0.72, 0] },
  rear34:  { pos: [0, 3.2, 28],    target: [0, 0.72, 0] },
  top:     { pos: [0, 32, 0.01],   target: [0, 0.3, 0] },
  orbit:   { pos: [12, 5.5, 26],   target: [0, 0.72, 0] },
};

// Spacing along X between cars in the lineup
function lineupSpacing(angle: SilhouetteAngle): number {
  switch (angle) {
    case "left":
    case "right":
      return 5.6; // 4.8m cars have 0.8m clear air between them
    case "front34":
    case "rear34":
      return 5.2; // 3/4 perspective spacing
    case "front":
    case "rear":
      return 4.4; // front/rear width spacing
    default:
      return 5.2;
  }
}

// Yaw each car uniformly so every vehicle presents the identical perspective to the camera
function lineupYaw(angle: SilhouetteAngle): number {
  switch (angle) {
    case "front":   return 0;
    case "rear":    return Math.PI;
    case "left":    return Math.PI / 2;
    case "right":   return -Math.PI / 2;
    case "front34": return Math.PI / 5.2; // 34.6Â° Front 3/4
    case "rear34":  return Math.PI - Math.PI / 5.2; // 145.4Â° Rear 3/4
    case "top":     return 0;
    default:         return Math.PI / 5.2;
  }
}

function LineupStudioScene({
  builds,
  angle,
  stencilMode,
  onSelectCar,
}: {
  builds: CarBuild[];
  angle: SilhouetteAngle;
  stencilMode: boolean;
  onSelectCar?: (id: string) => void;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const preset = LINEUP_CAMERAS[angle];
  const spacing = lineupSpacing(angle);

  useEffect(() => {
    if (!controls.current) return;
    controls.current.target.set(...preset.target);
    controls.current.object.position.set(...preset.pos);
    controls.current.update();
  }, [angle, preset]);

  return (
    <>
      <OrbitControls
        ref={controls}
        enablePan={true}
        minDistance={4}
        maxDistance={65}
        maxPolarAngle={Math.PI / 2 + 0.02}
        autoRotate={angle === "orbit"}
        autoRotateSpeed={0.8}
      />

      {/* Uniform Studio Ambient & Light Bank */}
      <ambientLight intensity={stencilMode ? 0.05 : 0.65} />

      {/* Linear Overhead Light Bank: ensures all 7 vehicles receive identical key, fill, and rim light */}
      {[-16.5, -11, -5.5, 0, 5.5, 11, 16.5].map((x) => (
        <group key={`light-rig-${x}`}>
          {/* Key light overhead softbox */}
          <directionalLight
            position={[x, 11, 8]}
            intensity={stencilMode ? 0.25 : 1.35}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          {/* Front lower fill */}
          <directionalLight
            position={[x, 2.5, 14]}
            intensity={stencilMode ? 0.1 : 0.55}
            color="#e2eaf4"
          />
          {/* Rim light highlight for roofline & haunches */}
          <directionalLight
            position={[x, 6, -10]}
            intensity={stencilMode ? 0.1 : 0.75}
            color="#ffffff"
          />
        </group>
      ))}

      {/* Dark reflective studio floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[80, 50]} />
        {stencilMode ? (
          <meshStandardMaterial color="#f8fafc" roughness={0.9} metalness={0} />
        ) : (
          <MeshReflectorMaterial
            blur={[300, 100]}
            resolution={1024}
            mixBlur={0.8}
            mixStrength={0.7}
            roughness={0.22}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#080c14"
            metalness={0.8}
            mirror={0.7}
          />
        )}
      </mesh>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={stencilMode ? 0.2 : 0.85}
        scale={50}
        blur={1.6}
        far={3.5}
      />

      {/* Render all 7 cars in a studio lineup row */}
      {builds.map((build, idx) => {
        const xPos = (idx - 3) * spacing;
        return (
          <group
            key={build.def.id}
            position={[xPos, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCar?.(build.def.id);
            }}
          >
            <CarModel3D
              build={build}
              position={[0, 0, 0]}
              rotationY={lineupYaw(angle)}
              inspectPart={null}
              float={false}
            />
          </group>
        );
      })}
    </>
  );
}

export function QAComparisonView({ onBack, onRaceCar }: QAComparisonViewProps) {
  const [selectedId, setSelectedId] = useState<string>("bmw-m3-competition");
  const [angle, setAngle] = useState<SilhouetteAngle>("front34");
  const [paintMode, setPaintMode] = useState<PaintMode>("satin-silver");
  const [viewMode, setViewMode] = useState<"single" | "lineup">("lineup");

  // Build the 7 CarBuild objects
  const qaBuilds = useMemo<CarBuild[]>(() => {
    return QA_CAR_IDS.map((id) => {
      const def = getCar(id);
      const paint = paintMode === "factory" ? def.defaultPaint : PAINT_COLORS[paintMode];
      const custom = {
        ...defaultCustomization(def),
        paint,
        glow: "none", // disable underglow in QA view to judge pure geometry
      };
      return {
        def,
        custom,
        upgrades: { ...DEFAULT_UPGRADES },
        plate: def.manufacturer.slice(0, 6).toUpperCase(),
      };
    });
  }, [paintMode]);

  const activeBuild = useMemo(() => {
    return qaBuilds.find((b) => b.def.id === selectedId) ?? qaBuilds[0];
  }, [qaBuilds, selectedId]);

  const notes = MODEL_NOTES[selectedId] ?? MODEL_NOTES["bmw-m3-competition"];
  const prof = getCar3DProfile(selectedId);
  const stencilMode = paintMode === "stencil";

  return (
    <div className="relative h-full w-full bg-[#060810] text-slate-100 flex flex-col overflow-hidden font-ui select-none">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-black/60 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400 hover:text-white transition"
          >
            ← Exit QA
          </button>
          <div>
            <h1 className="font-display font-black text-sm text-cyan-300 tracking-wider">
              3D AUTOMOTIVE STUDIO LINEUP · 7 VEHICLE SILHOUETTES
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Identical satin silver · Identical lighting · Identical camera height · Dark reflective floor · Distinct body silhouettes
            </p>
          </div>
        </div>

        {/* Mode switcher: Single Studio vs All 7 Lineup */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5">
            <button
              onClick={() => setViewMode("single")}
              className={cn("px-3 py-1 text-xs rounded-md font-medium transition", viewMode === "single" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40" : "text-slate-400 hover:text-white")}
            >
              Single Car Studio
            </button>
            <button
              onClick={() => setViewMode("lineup")}
              className={cn("px-3 py-1 text-xs rounded-md font-medium transition", viewMode === "lineup" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40" : "text-slate-400 hover:text-white")}
            >
              All 7 Lineup (Comparison)
            </button>
          </div>

          <button
            onClick={() => onRaceCar(selectedId)}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 transition"
          >
            🏎️ Test In Live Race →
          </button>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Left Toolbar: Car Selector (when in single mode) */}
        {viewMode === "single" && (
          <aside className="w-64 border-r border-white/10 bg-black/40 backdrop-blur p-3 flex flex-col gap-2 z-10 overflow-y-auto">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Target Real-World Models</div>
            <div className="flex flex-col gap-1.5">
              {QA_CAR_IDS.map((id) => {
                const isSelected = selectedId === id;
                const def = getCar(id);
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className={cn(
                      "text-left p-2.5 rounded-xl border text-xs transition flex flex-col gap-0.5",
                      isSelected
                        ? "border-cyan-400 bg-cyan-500/15 text-white shadow-md shadow-cyan-500/10"
                        : "border-white/5 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white"
                    )}
                  >
                    <span className="font-bold text-[13px]">{def.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{def.manufacturer} · {def.class}</span>
                  </button>
                );
              })}
            </div>

            {/* Model Dimensions / Geometry Spec */}
            <div className="mt-auto border-t border-white/10 pt-3 text-[11px] font-mono text-slate-400 space-y-1">
              <div className="text-slate-300 font-bold mb-1">PROPORTIONS (car3D.ts)</div>
              <div className="flex justify-between"><span>Length:</span> <span className="text-cyan-300 font-bold">{prof.body.length}m</span></div>
              <div className="flex justify-between"><span>Width:</span> <span className="text-cyan-300 font-bold">{prof.body.width}m</span></div>
              <div className="flex justify-between"><span>Height:</span> <span className="text-cyan-300 font-bold">{prof.body.height}m</span></div>
              <div className="flex justify-between"><span>Ride Height:</span> <span className="text-cyan-300 font-bold">{prof.body.rideHeight}m</span></div>
              <div className="flex justify-between"><span>Rear Haunch:</span> <span className="text-cyan-300 font-bold">{prof.body.rearHaunchWidth}x</span></div>
              <div className="flex justify-between"><span>Wheelbase:</span> <span className="text-cyan-300 font-bold">{(prof.wheels.wheelbase * 2).toFixed(2)}m</span></div>
            </div>
          </aside>
        )}

        {/* Center: 3D Canvas */}
        <div className={cn("relative flex-1 h-full", stencilMode ? "bg-white" : "bg-gradient-to-b from-[#090e1c] to-[#04060c]")}>
          <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-cyan-300">Loading 3D Models...</div>}>
            <Canvas
              shadows
              camera={{
                position: viewMode === "lineup" ? [0, 4.5, 16] : CAMERA_PRESETS[angle].pos,
                fov: viewMode === "lineup" ? 42 : 38,
              }}
              style={{ width: "100%", height: "100%" }}
            >
              {viewMode === "single" ? (
                <SingleStudioScene build={activeBuild} angle={angle} stencilMode={stencilMode} />
              ) : (
                <LineupStudioScene
                  builds={qaBuilds}
                  angle={angle}
                  stencilMode={stencilMode}
                  onSelectCar={(id) => {
                    setSelectedId(id);
                    setViewMode("single");
                  }}
                />
              )}
            </Canvas>
          </Suspense>

          {/* Overlay Angle Controls */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1 rounded-xl border border-white/15 bg-black/75 backdrop-blur z-10">
            <span className="text-[10px] font-mono text-slate-400 px-2 uppercase">Silhouette Camera:</span>
            {(
              [
                ["front", "Front"],
                ["rear", "Rear"],
                ["left", "Left Side"],
                ["right", "Right Side"],
                ["front34", "Front 3/4"],
                ["rear34", "Rear 3/4"],
                ["top", "Top"],
                ["orbit", "Free Orbit"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setAngle(key)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-lg transition font-medium",
                  angle === key
                    ? "bg-cyan-400 text-black font-bold shadow"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Bottom Lineup Legend Bar (when in lineup view) */}
          {viewMode === "lineup" && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 rounded-2xl border border-white/15 bg-black/85 backdrop-blur z-10 max-w-[95vw] overflow-x-auto shadow-2xl">
              {QA_CAR_IDS.map((id, idx) => {
                const def = getCar(id);
                const tag = [
                  "4-Door Sedan · Notchback Trunk",
                  "Rear-Engine · 911 Flyline",
                  "Luxury Hypercar · 2.04m Wide",
                  "Low Aero · Jet Visor Dome",
                  "Angular Wedge · Planar Facets",
                  "Smooth Mid-Engine · Buttresses",
                  "Organic Teardrop · 360° Glass",
                ][idx];
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedId(id);
                      setViewMode("single");
                    }}
                    title={`Click to inspect ${def.name} in 360°`}
                    className="flex flex-col items-center px-2.5 py-1 rounded-xl bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-400 border border-white/10 transition text-center"
                  >
                    <span className="text-[11px] font-mono font-bold text-slate-100 whitespace-nowrap">
                      <span className="text-cyan-400 mr-1">{idx + 1}.</span>{def.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono whitespace-nowrap">{tag}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Paint / Material Mode Toggle */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1 rounded-xl border border-white/15 bg-black/75 backdrop-blur z-10">
            <span className="text-[10px] font-mono text-slate-400 px-2 uppercase">QA Material:</span>
            {(
              [
                ["satin-silver", "Neutral Satin Silver (Identical)"],
                ["clay", "Matte Clay Form"],
                ["stencil", "Silhouette Stencil (High-Contrast)"],
                ["factory", "Factory Model Paint"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPaintMode(key)}
                className={cn(
                  "px-3 py-1 text-xs rounded-lg transition font-medium",
                  paintMode === key
                    ? "bg-cyan-400 text-black font-bold shadow"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Info Panel: Model-Specific Identifying Characteristics */}
        {viewMode === "single" && (
          <aside className="w-80 border-l border-white/10 bg-black/50 backdrop-blur p-4 flex flex-col gap-3 z-10 overflow-y-auto">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Identifying Characteristics</div>
              <h2 className="font-display font-black text-lg text-white">{notes.name}</h2>
              <div className="text-xs text-slate-400 font-mono">{notes.manufacturer}</div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-2.5">
                <div className="font-bold text-cyan-300 mb-1">📐 Silhouette Question:</div>
                <div className="text-slate-200 text-[11px] leading-relaxed">
                  &ldquo;Could a player distinguish this vehicle from the others from silhouette alone?&rdquo;
                </div>
                <div className="mt-1 text-emerald-300 font-semibold text-[11px]">
                  ✓ YES — verified distinct geometry, roofline, haunches &amp; proportions.
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-300 uppercase">1. Silhouette &amp; Stance</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">{notes.silhouette}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-300 uppercase">2. Front Fascia &amp; Face</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">{notes.front}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-300 uppercase">3. Cabin, Roofline &amp; Glass</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">{notes.cabin}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-300 uppercase">4. Tail, Haunches &amp; Exhaust</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">{notes.rear}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-300 uppercase">5. Aero &amp; Model Details</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">{notes.aero}</p>
              </div>
            </div>

            <div className="mt-auto border-t border-white/10 pt-3">
              <button
                onClick={() => onRaceCar(selectedId)}
                className="w-full rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black py-2 text-xs font-bold transition shadow-lg shadow-cyan-400/20"
              >
                Race This Car (In-Game 3D Test)
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
