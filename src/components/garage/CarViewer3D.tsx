/**
 * 2D garage vehicle viewer.
 *
 * The race and garage share the same cached Canvas 2D sprite renderer so
 * every car keeps its own silhouette and equipment without a WebGL scene.
 */
import { useEffect } from "react";
import type { CarBuild } from "@/game/types";
import { CarPreview } from "../CarPreview";

export type ViewerPreset = "front" | "rear" | "left" | "right" | "top" | "cockpit" | "reset";
export interface ViewerRequest { preset: ViewerPreset; nonce: number; }
export interface ViewerProps {
  build: CarBuild;
  garageId?: string;
  autoRotate: boolean;
  inspectPart: string | null;
  request: ViewerRequest | null;
  onReady?: () => void;
}

export function CarViewer3D({ build, garageId = "obsidian", autoRotate, inspectPart, request, onReady }: ViewerProps) {
  useEffect(() => { onReady?.(); }, [onReady, build.def.id]);

  const accent =
    garageId === "neon-city" ? "#e879f9" :
    garageId === "desert-hangar" ? "#fbbf24" :
    garageId === "alpine" ? "#7dd3fc" :
    garageId === "underground" ? "#a78bfa" :
    "#22d3ee";
  const preset = request?.preset ?? "rear";
  const transform =
    preset === "left" ? "translateX(-3%) rotate(-2deg)" :
    preset === "right" ? "translateX(3%) rotate(2deg)" :
    preset === "top" ? "scale(0.9) translateY(-4%)" :
    preset === "cockpit" ? "scale(1.08) translateY(3%)" :
    "none";

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 42%, ${accent}22 0%, #05070d 70%)` }}>
      <div
        className="absolute inset-0 transition-transform duration-500"
        style={{ transform, transformOrigin: "50% 72%" }}
      >
        <CarPreview build={build} className="h-full w-full" />
      </div>
      {autoRotate && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[9px] uppercase tracking-[0.25em] text-cyan-200/70">
          2D showroom preview
        </div>
      )}
      {inspectPart && (
        <div className="pointer-events-none absolute right-3 bottom-3 rounded-full border border-cyan-300/30 bg-black/50 px-3 py-1 text-[9px] uppercase tracking-[0.2em] text-cyan-100">
          {inspectPart} equipment
        </div>
      )}
    </div>
  );
}
