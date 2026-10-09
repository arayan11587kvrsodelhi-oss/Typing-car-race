import { useEffect, useRef } from "react";
import { getCarSprite, rgba } from "@/game/carSprite";
import { resolvedSpoiler } from "@/game/cars";
import type { CarBuild } from "@/game/types";
import { cn } from "@/utils/cn";

export function CarPreview({ build, className, compact = false }: { build: CarBuild; className?: string; compact?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const sprite = getCarSprite({
        shape: build.def.shape,
        paint: build.custom.paint,
        rims: build.custom.rims,
        spoiler: resolvedSpoiler(build),
        glow: build.custom.glow,
        decal: build.custom.decal,
        plate: build.plate,
        width: 640,
      });
      const paint = build.custom.paint;
      const glow = build.custom.glow !== "none" ? build.custom.glow : paint;
      const groundY = h * (compact ? 0.78 : 0.72);
      // floor glow
      const fg = ctx.createRadialGradient(w / 2, groundY, 0, w / 2, groundY, w * 0.45);
      fg.addColorStop(0, rgba(glow, 0.35));
      fg.addColorStop(0.5, rgba(glow, 0.08));
      fg.addColorStop(1, rgba(glow, 0));
      ctx.save();
      ctx.translate(w / 2, groundY);
      ctx.scale(1, 0.32);
      ctx.translate(-w / 2, -groundY);
      ctx.fillStyle = fg;
      ctx.fillRect(0, groundY - w * 0.5, w, w);
      ctx.restore();
      // floor grid
      ctx.strokeStyle = "rgba(34,211,238,0.12)";
      ctx.lineWidth = 1;
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + i * w * 0.06, groundY - h * 0.02);
        ctx.lineTo(w / 2 + i * w * 0.18, h);
        ctx.stroke();
      }
      for (let j = 0; j < 5; j++) {
        const y = groundY + Math.pow(j / 4, 1.6) * (h - groundY);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const destW = Math.min(w * (compact ? 0.74 : 0.62), h * 1.25);
      const destH = destW * (sprite.h / sprite.w);
      const dx = w / 2 - destW / 2;
      const dy = groundY - destH * sprite.groundY;
      // reflection
      ctx.save();
      ctx.translate(0, groundY * 2);
      ctx.scale(1, -1);
      ctx.globalAlpha = 0.22;
      ctx.drawImage(sprite.canvas, dx, dy, destW, destH);
      ctx.restore();
      const fade = ctx.createLinearGradient(0, groundY, 0, groundY + destH * 0.5);
      fade.addColorStop(0, "rgba(7,10,20,0.1)");
      fade.addColorStop(1, "rgba(7,10,20,1)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, groundY, w, h - groundY);
      ctx.drawImage(sprite.canvas, dx, dy, destW, destH);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [build, compact]);

  return <canvas ref={ref} className={cn("w-full h-full", className)} />;
}
