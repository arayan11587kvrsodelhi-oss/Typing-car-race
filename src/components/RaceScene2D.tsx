import { useEffect, useRef } from "react";
import { RoadRenderer } from "@/game/renderer";
import type { GameEngine } from "@/game/engine";

interface Props {
  engineRef: { current: GameEngine | null };
}

/**
 * The race presentation uses the same 2D sprite renderer as the car previews.
 * The simulation remains owned by GameScreen; this component only paints the
 * latest engine state.
 */
export function RaceScene2D({ engineRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new RoadRenderer(canvas);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    let raf = 0;
    let lastTime = performance.now();
    const frame = (now: number) => {
      const engine = engineRef.current;
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      if (engine) renderer.render(engine, dt);
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [engineRef]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
