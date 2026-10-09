export type ParticleKind = "spark" | "smoke" | "flame" | "confetti" | "glow";

export interface Particle {
  kind: ParticleKind;
  x: number; // normalized 0..1 of canvas width
  y: number; // normalized 0..1 of canvas height
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number; // in px at 1000px canvas width (scaled)
  color: string;
  rot: number;
  vr: number;
  grav: number;
  drag: number;
}

export interface Floater {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  vy: number;
}

const SPARK_COLORS = ["#fff7cc", "#ffd166", "#22d3ee", "#ffffff", "#f472b6"];
const CONFETTI = ["#22d3ee", "#e879f9", "#fbbf24", "#4ade80", "#f87171", "#ffffff"];

export class ParticleSystem {
  list: Particle[] = [];
  max = 360;

  clear() {
    this.list.length = 0;
  }

  private push(p: Particle) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(p);
  }

  sparks(x: number, y: number, count: number, power = 1, colors = SPARK_COLORS) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const sp = (0.25 + Math.random() * 0.55) * power;
      this.push({
        kind: "spark",
        x, y,
        vx: Math.cos(a) * sp * 0.6,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.75,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: 0, vr: 0, grav: 1.4, drag: 1.5,
      });
    }
  }

  smoke(x: number, y: number, count: number, side = 0) {
    for (let i = 0; i < count; i++) {
      this.push({
        kind: "smoke",
        x: x + (Math.random() - 0.5) * 0.01,
        y,
        vx: (Math.random() - 0.5) * 0.12 + side * 0.06,
        vy: 0.08 + Math.random() * 0.14,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1.1,
        size: 10 + Math.random() * 14,
        color: "#9ca3af",
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2, grav: -0.1, drag: 1.2,
      });
    }
  }

  flame(x: number, y: number, power = 1) {
    this.push({
      kind: "flame",
      x: x + (Math.random() - 0.5) * 0.006,
      y: y + (Math.random() - 0.5) * 0.004,
      vx: (Math.random() - 0.5) * 0.05,
      vy: 0.25 + Math.random() * 0.35 * power,
      life: 0.12 + Math.random() * 0.14,
      maxLife: 0.26,
      size: (9 + Math.random() * 9) * power,
      color: Math.random() < 0.6 ? "#ffb347" : "#7dd3fc",
      rot: 0, vr: 0, grav: 0, drag: 2,
    });
  }

  confetti(count: number) {
    for (let i = 0; i < count; i++) {
      this.push({
        kind: "confetti",
        x: Math.random(),
        y: -0.05 - Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 0.2,
        vy: 0.25 + Math.random() * 0.3,
        life: 3 + Math.random() * 2,
        maxLife: 5,
        size: 5 + Math.random() * 6,
        color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, grav: 0.15, drag: 0.6,
      });
    }
  }

  glow(x: number, y: number, color: string, size = 30) {
    this.push({ kind: "glow", x, y, vx: 0, vy: -0.02, life: 0.3, maxLife: 0.3, size, color, rot: 0, vr: 0, grav: 0, drag: 0 });
  }

  update(dt: number) {
    const list = this.list;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      list[w++] = p;
    }
    list.length = w;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const s = w / 1000;
    const list = this.list;
    if (list.length === 0) return;
    ctx.save();
    // additive pass
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.kind === "smoke" || p.kind === "confetti") continue;
      const t = p.life / p.maxLife;
      const px = p.x * w;
      const py = p.y * h;
      if (p.kind === "spark") {
        ctx.globalAlpha = Math.min(1, t * 1.5);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size * s * (0.6 + t * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "flame") {
        const r = p.size * s * (1.6 - t);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, "rgba(255,255,255,0.9)");
        g.addColorStop(0.35, p.color);
        g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.globalAlpha = t;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "glow") {
        const r = p.size * s * (1 + (1 - t) * 1.5);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, p.color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = t * 0.7;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // normal pass
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const t = p.life / p.maxLife;
      const px = p.x * w;
      const py = p.y * h;
      if (p.kind === "smoke") {
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size * s * (1.6 - t), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "confetti") {
        ctx.globalAlpha = Math.min(1, t * 3);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size * s * 0.5, -p.size * s * 0.3, p.size * s, p.size * s * 0.6);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
