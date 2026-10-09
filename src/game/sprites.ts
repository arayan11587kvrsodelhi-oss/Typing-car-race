import { rgba, shade } from "./carSprite";
import type { EnvPalette, SpriteKind } from "./environments";
import { ROAD_WIDTH } from "./track";

export interface SpriteImage {
  canvas: HTMLCanvasElement;
  worldWidth: number;
}
export type SpriteSet = Record<SpriteKind, SpriteImage[]>;

function make(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx);
  return c;
}

const BILLBOARD_TEXT = [
  { t: "TYPEDRIFT", s: "TYPE FAST. DRIVE FASTER.", c: "#22d3ee" },
  { t: "NITRO", s: "PRESS ENTER WHEN READY", c: "#fbbf24" },
  { t: "FULL SEND", s: "NO BRAKES PAST HERE", c: "#e879f9" },
  { t: "SHIFT UP", s: "ACCURACY IS SPEED", c: "#4ade80" },
  { t: "DRIFT KING", s: "RACEWAY 24H", c: "#f87171" },
  { t: "KEEP TYPING", s: "THE ROAD IS YOURS", c: "#f8fafc" },
];

export function buildSpriteSet(env: EnvPalette): SpriteSet {
  const fc = env.sceneryColors;

  const lamp = make(80, 340, (ctx) => {
    const g = ctx.createLinearGradient(30, 0, 44, 0);
    g.addColorStop(0, "#5b6170");
    g.addColorStop(0.5, "#9aa1ad");
    g.addColorStop(1, "#3a3f4a");
    ctx.fillStyle = g;
    ctx.fillRect(32, 40, 10, 300);
    ctx.fillRect(22, 320, 30, 20);
    ctx.strokeStyle = "#8b919c";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(37, 44);
    ctx.quadraticCurveTo(40, 22, 62, 24);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const gl = ctx.createRadialGradient(62, 32, 0, 62, 32, 46);
    gl.addColorStop(0, rgba(env.lampLight, 0.85));
    gl.addColorStop(0.3, rgba(env.lampLight, 0.35));
    gl.addColorStop(1, rgba(env.lampLight, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(10, -10, 100, 90);
    ctx.restore();
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(52, 22, 22, 9);
    ctx.fillStyle = env.lampLight;
    ctx.fillRect(54, 29, 18, 4);
  });

  const trees = [0, 1, 2].map((v) =>
    make(240, 280, (ctx) => {
      const tg = ctx.createLinearGradient(105, 0, 135, 0);
      tg.addColorStop(0, shade(fc.trunk, -0.4));
      tg.addColorStop(0.5, shade(fc.trunk, 0.2));
      tg.addColorStop(1, shade(fc.trunk, -0.5));
      ctx.fillStyle = tg;
      ctx.fillRect(108, 150, 24, 130);
      const blobs = [
        [120, 110, 78],
        [70, 150, 52 + v * 6],
        [172, 148, 50 + v * 4],
        [120, 60 + v * 8, 48],
      ];
      for (const [x, y, r] of blobs) {
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
        g.addColorStop(0, fc.foliageLight);
        g.addColorStop(1, fc.foliage);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }),
  );

  const palms = [0, 1].map((v) =>
    make(240, 320, (ctx) => {
      ctx.strokeStyle = shade(fc.trunk, 0.1);
      ctx.lineWidth = 16;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(110, 320);
      ctx.quadraticCurveTo(100 + v * 30, 180, 140, 90);
      ctx.stroke();
      ctx.strokeStyle = shade(fc.trunk, -0.3);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(116, 320);
      ctx.quadraticCurveTo(106 + v * 30, 180, 145, 92);
      ctx.stroke();
      ctx.lineWidth = 12;
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI * 0.95 + (i / 7) * Math.PI * 0.9;
        const len = 95 + (i % 2) * 20;
        ctx.strokeStyle = i % 2 ? fc.foliage : fc.foliageLight;
        ctx.beginPath();
        ctx.moveTo(140, 90);
        ctx.quadraticCurveTo(140 + Math.cos(a) * len * 0.6, 90 + Math.sin(a) * len * 0.2 - 30, 140 + Math.cos(a) * len, 90 + Math.sin(a) * len * 0.4 + 50);
        ctx.stroke();
      }
    }),
  );

  const pines = [0, 1, 2].map((v) =>
    make(170, 320, (ctx) => {
      ctx.fillStyle = fc.trunk;
      ctx.fillRect(77, 250, 16, 70);
      const tiers = 3 + (v % 2);
      for (let i = 0; i < tiers; i++) {
        const y = 250 - i * 62;
        const wdt = 150 - i * 32;
        ctx.fillStyle = i % 2 ? fc.foliage : shade(fc.foliage, 0.12);
        ctx.beginPath();
        ctx.moveTo(85, y - 90);
        ctx.lineTo(85 + wdt / 2, y);
        ctx.lineTo(85 - wdt / 2, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba(fc.foliageLight, 0.55);
        ctx.beginPath();
        ctx.moveTo(85, y - 90);
        ctx.lineTo(85 - wdt / 2, y);
        ctx.lineTo(85 - wdt / 2 + 18, y);
        ctx.closePath();
        ctx.fill();
      }
    }),
  );

  const cacti = [0, 1].map((v) =>
    make(150, 280, (ctx) => {
      const col = fc.foliage;
      const light = fc.foliageLight;
      const body = (x: number, y: number, w: number, h: number) => {
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, shade(col, -0.3));
        g.addColorStop(0.4, light);
        g.addColorStop(1, shade(col, -0.45));
        ctx.fillStyle = g;
        const r = Math.min(w, h) / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
      };
      body(58, 30, 34, 250);
      body(18, 110 + v * 20, 24, 90);
      body(18, 180 + v * 20, 50, 22);
      body(108, 80 + v * 30, 24, 100);
      body(80, 160 + v * 30, 50, 22);
    }),
  );

  const rocks = [0, 1, 2].map((v) =>
    make(220, 130, (ctx) => {
      const pts = [
        [10, 125], [30, 70 - v * 10], [80, 30 + v * 8], [140, 20 + v * 5], [195, 60], [212, 125],
      ];
      const g = ctx.createLinearGradient(40, 10, 180, 130);
      g.addColorStop(0, shade(fc.rock, 0.3));
      g.addColorStop(0.5, fc.rock);
      g.addColorStop(1, shade(fc.rock, -0.55));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
    }),
  );

  const bushes = [0, 1].map((v) =>
    make(180, 110, (ctx) => {
      for (const [x, y, r] of [
        [50, 70, 38],
        [95, 55 + v * 8, 44],
        [140, 72, 36],
      ]) {
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 2, x, y, r);
        g.addColorStop(0, fc.foliageLight);
        g.addColorStop(1, fc.foliage);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }),
  );

  const billboards = BILLBOARD_TEXT.map((b) =>
    make(360, 300, (ctx) => {
      ctx.fillStyle = "#2a2f3b";
      ctx.fillRect(70, 170, 14, 130);
      ctx.fillRect(276, 170, 14, 130);
      ctx.fillStyle = "#0c1019";
      ctx.fillRect(14, 14, 332, 166);
      ctx.strokeStyle = "#3a4256";
      ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, 332, 166);
      ctx.save();
      ctx.shadowColor = b.c;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = b.c;
      ctx.lineWidth = 3;
      ctx.strokeRect(28, 28, 304, 138);
      ctx.fillStyle = b.c;
      ctx.font = "900 44px Orbitron, Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.t, 180, 84);
      ctx.restore();
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "700 17px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.s, 180, 134);
    }),
  );

  const buildings = [0, 1, 2].map((v) =>
    make(360, 520, (ctx) => {
      const bh = [500, 400, 300][v];
      const top = 520 - bh;
      const g = ctx.createLinearGradient(0, 0, 360, 0);
      g.addColorStop(0, "#111727");
      g.addColorStop(0.5, "#182036");
      g.addColorStop(1, "#0a0e19");
      ctx.fillStyle = g;
      ctx.fillRect(20, top, 320, bh);
      const cols = 7, rows = Math.floor(bh / 34);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.42) continue;
          ctx.fillStyle = Math.random() < 0.7 ? `rgba(255,214,150,${0.35 + Math.random() * 0.55})` : `rgba(150,220,255,${0.35 + Math.random() * 0.5})`;
          ctx.fillRect(38 + c * 44, top + 18 + r * 34, 22, 16);
        }
      }
      const neon = ["#22d3ee", "#e879f9", "#fbbf24"][v];
      ctx.save();
      ctx.shadowColor = neon;
      ctx.shadowBlur = 16;
      ctx.fillStyle = neon;
      ctx.fillRect(20, top, 320, 5);
      ctx.restore();
      ctx.fillStyle = "#6b7280";
      ctx.fillRect(176, top - 50, 6, 50);
      ctx.fillStyle = "#ff4d4d";
      ctx.beginPath();
      ctx.arc(179, top - 52, 5, 0, Math.PI * 2);
      ctx.fill();
    }),
  );

  const cone = make(90, 110, (ctx) => {
    ctx.fillStyle = "#1f2328";
    ctx.fillRect(8, 96, 74, 14);
    const g = ctx.createLinearGradient(25, 0, 65, 0);
    g.addColorStop(0, "#c2410c");
    g.addColorStop(0.5, "#fb923c");
    g.addColorStop(1, "#9a3412");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(38, 6);
    ctx.lineTo(52, 6);
    ctx.lineTo(74, 100);
    ctx.lineTo(16, 100);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(29, 44);
    ctx.lineTo(61, 44);
    ctx.lineTo(65, 62);
    ctx.lineTo(25, 62);
    ctx.closePath();
    ctx.fill();
  });

  const barrier = make(260, 130, (ctx) => {
    ctx.fillStyle = "#1f2328";
    ctx.fillRect(20, 100, 30, 30);
    ctx.fillRect(210, 100, 30, 30);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 20, 260, 84);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 20, 260, 84);
    ctx.clip();
    ctx.fillStyle = "#dc2626";
    for (let i = -2; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 44, 20);
      ctx.lineTo(i * 44 + 24, 20);
      ctx.lineTo(i * 44 + 64, 104);
      ctx.lineTo(i * 44 + 40, 104);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 20, 260, 84);
  });

  const gantry = (label: string, finish: boolean) =>
    make(1100, 330, (ctx) => {
      const steel = ctx.createLinearGradient(0, 0, 60, 0);
      steel.addColorStop(0, "#3b4150");
      steel.addColorStop(0.5, "#7c8493");
      steel.addColorStop(1, "#2a2f3a");
      ctx.fillStyle = steel;
      ctx.fillRect(0, 70, 56, 260);
      ctx.save();
      ctx.translate(1100, 0);
      ctx.scale(-1, 1);
      ctx.fillStyle = steel;
      ctx.fillRect(0, 70, 56, 260);
      ctx.restore();
      ctx.fillStyle = "#12161f";
      ctx.fillRect(0, 40, 1100, 110);
      ctx.strokeStyle = "#4b5563";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 43, 1094, 104);
      if (finish) {
        for (let i = 0; i < 44; i++) {
          ctx.fillStyle = i % 2 ? "#f8fafc" : "#0b0d12";
          ctx.fillRect(i * 25, 128, 25, 22);
          ctx.fillStyle = i % 2 ? "#0b0d12" : "#f8fafc";
          ctx.fillRect(i * 25, 40, 25, 22);
        }
      }
      ctx.save();
      const col = finish ? "#fbbf24" : "#4ade80";
      ctx.shadowColor = col;
      ctx.shadowBlur = 24;
      ctx.fillStyle = col;
      ctx.font = "900 64px Orbitron, Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 550, 96);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 12; i++) {
        const x = 90 + i * 84;
        const g = ctx.createRadialGradient(x, 156, 0, x, 156, 26);
        g.addColorStop(0, "rgba(255,255,255,0.9)");
        g.addColorStop(0.3, "rgba(255,240,200,0.5)");
        g.addColorStop(1, "rgba(255,240,200,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 26, 130, 52, 52);
      }
      ctx.restore();
    });

  const wrap = (canvas: HTMLCanvasElement, worldWidth: number): SpriteImage => ({ canvas, worldWidth });

  return {
    lamp: [wrap(lamp, 300)],
    tree: trees.map((c) => wrap(c, 1100)),
    palm: palms.map((c) => wrap(c, 1000)),
    pine: pines.map((c) => wrap(c, 700)),
    cactus: cacti.map((c) => wrap(c, 480)),
    rock: rocks.map((c) => wrap(c, 700)),
    bush: bushes.map((c) => wrap(c, 520)),
    billboard: billboards.map((c) => wrap(c, 1700)),
    building: buildings.map((c) => wrap(c, 2800)),
    cone: [wrap(cone, 140)],
    barrier: [wrap(barrier, 820)],
    gantryStart: [wrap(gantry("START", false), ROAD_WIDTH * 2 * 1.42)],
    gantryFinish: [wrap(gantry("FINISH", true), ROAD_WIDTH * 2 * 1.42)],
  };
}
