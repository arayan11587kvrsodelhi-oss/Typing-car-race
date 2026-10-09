import { useEffect, useRef } from "react";
import { GameEngine } from "@/game/engine";
import { RoadRenderer } from "@/game/renderer";
import type { RaceConfig } from "@/game/types";

export function DemoBackground({ config, className }: { config: RaceConfig; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GameEngine({ ...config, demo: true, seed: 1337 });
    const renderer = new RoadRenderer(canvas);
    renderer.setEnvironment(engine.env);
    const parent = canvas.parentElement!;
    const resize = () => {
      const r = parent.getBoundingClientRect();
      renderer.resize(r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      engine.update(dt);
      renderer.render(engine, dt);
      engine.drainEvents();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [config]);

  return <canvas ref={canvasRef} className={className ?? "absolute inset-0 w-full h-full"} />;
}
