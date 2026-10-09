import type { CarShape, DecalStyle, RimStyle, SpoilerStyle } from "./types";

export interface Anchor {
  x: number; // normalized 0..1 of sprite width
  y: number; // normalized 0..1 of sprite height
  r: number; // normalized radius (relative to width)
}

export interface CarSprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  tailLights: Anchor[];
  exhausts: Anchor[];
  wheels: Anchor[];
  groundY: number;
}

export interface CarRenderOptions {
  shape: CarShape;
  paint: string;
  rims: RimStyle;
  spoiler: SpoilerStyle;
  glow: string | "none";
  decal: DecalStyle;
  plate: string;
  width?: number;
}

/* ---------- colour helpers ---------- */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function shade(hex: string, t: number) {
  const [r, g, b] = hexToRgb(hex);
  const target = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const m = (c: number) => Math.round(c + (target - c) * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const FLARE: Record<CarShape["shape"], number> = { hatch: 0.02, coupe: 0.035, muscle: 0.055, super: 0.07, hyper: 0.085, truck: 0.015 };

function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
  const p = new Path2D();
  const rr = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rr, y);
  p.lineTo(x + w - rr, y);
  p.quadraticCurveTo(x + w, y, x + w, y + rr);
  p.lineTo(x + w, y + h - rr);
  p.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  p.lineTo(x + rr, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - rr);
  p.lineTo(x, y + rr);
  p.quadraticCurveTo(x, y, x + rr, y);
  p.closePath();
  return p;
}

const cache = new Map<string, CarSprite>();
if (typeof document !== "undefined" && document.fonts?.ready) {
  document.fonts.ready.then(() => cache.clear()).catch(() => undefined);
}

export function getCarSprite(opts: CarRenderOptions): CarSprite {
  const key = JSON.stringify(opts);
  const hit = cache.get(key);
  if (hit) return hit;
  const sprite = renderCarSprite(opts);
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  cache.set(key, sprite);
  return sprite;
}

export function renderCarSprite(opts: CarRenderOptions): CarSprite {
  const W = opts.width ?? 512;
  const H = Math.round(W * 0.75);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const s = opts.shape;
  const paint = opts.paint;
  const cx = W / 2;
  const gy = H * 0.93;
  const bw = s.bodyW * W;
  const half = bw / 2;
  const h = s.bodyH * W;
  const yb = gy - s.rideHeight * W;
  const ys = yb - h;
  const ch = s.cabinH * W;
  const yr = ys - ch;
  const cw = s.cabinW * bw;
  const rw = s.roofW * cw;
  const flare = half * FLARE[s.shape];
  const wheelD = 2 * s.wheelR * W;
  const tireW = wheelD * 0.44;
  const wheelX = half - s.wheelInset * W;
  const isDarkPaint = luminance(paint) < 0.45;

  const tailLights: Anchor[] = [];
  const exhausts: Anchor[] = [];
  const wheels: Anchor[] = [];

  /* ---- shadow ---- */
  ctx.save();
  ctx.translate(cx, gy);
  ctx.scale(1, 0.14);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, half * 1.25);
  sh.addColorStop(0, "rgba(0,0,0,0.75)");
  sh.addColorStop(0.55, "rgba(0,0,0,0.45)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, half * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  /* ---- underglow ---- */
  if (opts.glow !== "none") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(cx, gy - 0.005 * W);
    ctx.scale(1, 0.16);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, half * 1.35);
    g.addColorStop(0, rgba(opts.glow, 0.95));
    g.addColorStop(0.45, rgba(opts.glow, 0.55));
    g.addColorStop(1, rgba(opts.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, half * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---- wheels ---- */
  for (const side of [-1, 1]) {
    const x = cx + side * wheelX;
    const tx = x - tireW / 2;
    const ty = gy - wheelD;
    const tg = ctx.createLinearGradient(tx, 0, tx + tireW, 0);
    tg.addColorStop(0, "#07080b");
    tg.addColorStop(0.5, "#1a1c22");
    tg.addColorStop(1, "#07080b");
    ctx.fillStyle = tg;
    ctx.fill(roundRectPath(tx, ty, tireW, wheelD, tireW * 0.32));
    // tread grooves
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = Math.max(1, W * 0.003);
    for (let i = 1; i <= 3; i++) {
      const gyy = ty + (wheelD * i) / 4;
      ctx.beginPath();
      ctx.moveTo(tx + tireW * 0.15, gyy);
      ctx.lineTo(tx + tireW * 0.85, gyy);
      ctx.stroke();
    }
    // rim edge (visible sliver on the outer side)
    const rimW = tireW * 0.2;
    const rx = side < 0 ? tx : tx + tireW - rimW;
    const rimColor: Record<RimStyle, string> = { steel: "#3b3f48", sport: "#7c838f", chrome: "#d7dce3", neon: opts.glow !== "none" ? opts.glow : "#22d3ee" };
    ctx.fillStyle = rimColor[opts.rims];
    ctx.fill(roundRectPath(rx, ty + wheelD * 0.14, rimW, wheelD * 0.72, rimW * 0.5));
    if (opts.rims === "chrome") {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fill(roundRectPath(rx + rimW * 0.3, ty + wheelD * 0.2, rimW * 0.3, wheelD * 0.25, rimW * 0.2));
    }
    if (opts.rims === "neon") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const ng = ctx.createRadialGradient(rx + rimW / 2, ty + wheelD / 2, 0, rx + rimW / 2, ty + wheelD / 2, wheelD * 0.6);
      ng.addColorStop(0, rgba(rimColor.neon, 0.55));
      ng.addColorStop(1, rgba(rimColor.neon, 0));
      ctx.fillStyle = ng;
      ctx.fillRect(rx - wheelD * 0.6, ty - wheelD * 0.2, wheelD * 1.2 + rimW, wheelD * 1.4);
      ctx.restore();
    }
    wheels.push({ x: x / W, y: gy / H, r: tireW / 2 / W });
  }

  /* ---- body path ---- */
  const inset = half * 0.06;
  const r0 = h * 0.22;
  const shoulderR = h * 0.25;
  const body = new Path2D();
  body.moveTo(cx - half + r0, yb);
  body.lineTo(cx + half - r0, yb);
  body.quadraticCurveTo(cx + half + flare * 0.3, yb, cx + half + flare, yb - h * 0.38);
  body.quadraticCurveTo(cx + half + flare, ys + shoulderR * 1.4, cx + half - inset, ys + shoulderR);
  body.quadraticCurveTo(cx + half - inset, ys, cx + half - inset - shoulderR, ys);
  body.lineTo(cx - half + inset + shoulderR, ys);
  body.quadraticCurveTo(cx - half + inset, ys, cx - half + inset, ys + shoulderR);
  body.quadraticCurveTo(cx - half - flare, ys + shoulderR * 1.4, cx - half - flare, yb - h * 0.38);
  body.quadraticCurveTo(cx - half - flare * 0.3, yb, cx - half + r0, yb);
  body.closePath();

  const bodyGrad = ctx.createLinearGradient(0, ys, 0, yb);
  bodyGrad.addColorStop(0, shade(paint, 0.42));
  bodyGrad.addColorStop(0.18, shade(paint, 0.12));
  bodyGrad.addColorStop(0.55, paint);
  bodyGrad.addColorStop(1, shade(paint, -0.55));
  ctx.fillStyle = bodyGrad;
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);
  // side curvature
  const curv = ctx.createLinearGradient(cx - half - flare, 0, cx + half + flare, 0);
  curv.addColorStop(0, "rgba(0,0,0,0.5)");
  curv.addColorStop(0.12, "rgba(0,0,0,0.08)");
  curv.addColorStop(0.5, "rgba(255,255,255,0.05)");
  curv.addColorStop(0.88, "rgba(0,0,0,0.08)");
  curv.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = curv;
  ctx.fillRect(0, ys - 2, W, h + 4);
  // trunk deck (top surface seen from above)
  const deckH = h * 0.14;
  const deck = ctx.createLinearGradient(0, ys, 0, ys + deckH);
  deck.addColorStop(0, "rgba(255,255,255,0.35)");
  deck.addColorStop(1, "rgba(255,255,255,0.0)");
  ctx.fillStyle = deck;
  ctx.fillRect(0, ys, W, deckH);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(cx - half + inset, ys + deckH, bw - inset * 2, Math.max(1, W * 0.003));
  // lower bumper darkening
  const bump = ctx.createLinearGradient(0, yb - h * 0.34, 0, yb);
  bump.addColorStop(0, "rgba(0,0,0,0)");
  bump.addColorStop(0.1, "rgba(0,0,0,0.22)");
  bump.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = bump;
  ctx.fillRect(0, yb - h * 0.34, W, h * 0.34);
  // checker decal
  if (opts.decal === "checker") {
    const sq = h * 0.06;
    const yy = ys + h * 0.2;
    for (let row = 0; row < 2; row++) {
      for (let i = -Math.ceil(half / sq) - 1; i < Math.ceil(half / sq) + 1; i++) {
        ctx.fillStyle = (i + row) % 2 === 0 ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.9)";
        ctx.fillRect(cx + i * sq, yy + row * sq, sq, sq);
      }
    }
  }
  ctx.restore();

  /* ---- cabin ---- */
  const cr = Math.min(ch * 0.35, rw * 0.15);
  const cabin = new Path2D();
  cabin.moveTo(cx - cw / 2, ys + 1);
  cabin.lineTo(cx - rw / 2, yr + cr);
  cabin.quadraticCurveTo(cx - rw / 2, yr, cx - rw / 2 + cr, yr);
  cabin.quadraticCurveTo(cx, yr - ch * 0.07, cx + rw / 2 - cr, yr);
  cabin.quadraticCurveTo(cx + rw / 2, yr, cx + rw / 2, yr + cr);
  cabin.lineTo(cx + cw / 2, ys + 1);
  cabin.closePath();
  const cabGrad = ctx.createLinearGradient(0, yr, 0, ys);
  cabGrad.addColorStop(0, shade(paint, 0.5));
  cabGrad.addColorStop(0.25, shade(paint, 0.05));
  cabGrad.addColorStop(1, shade(paint, -0.25));
  ctx.fillStyle = cabGrad;
  ctx.fill(cabin);

  // stripes decal over roof + trunk (before glass)
  if (opts.decal === "stripes") {
    ctx.save();
    const union = new Path2D();
    union.addPath(body);
    union.addPath(cabin);
    ctx.clip(union);
    ctx.fillStyle = isDarkPaint ? "rgba(245,247,250,0.9)" : "rgba(15,17,22,0.88)";
    const sw = bw * 0.055;
    ctx.fillRect(cx - bw * 0.095, yr - 4, sw, yb - yr + 8);
    ctx.fillRect(cx + bw * 0.04, yr - 4, sw, yb - yr + 8);
    ctx.restore();
  }

  // rear window
  const pillar = Math.max(2, cw * 0.075);
  const wTop = yr + ch * 0.17;
  const wBot = ys - ch * 0.1;
  const slope = (cw - rw) / 2 / ch; // horizontal shrink per vertical px
  const win = new Path2D();
  const wxBotL = cx - cw / 2 + pillar + slope * (ys - wBot);
  const wxBotR = cx + cw / 2 - pillar - slope * (ys - wBot);
  const wxTopL = cx - cw / 2 + pillar + slope * (ys - wTop) + pillar * 0.3;
  const wxTopR = cx + cw / 2 - pillar - slope * (ys - wTop) - pillar * 0.3;
  win.moveTo(wxBotL, wBot);
  win.lineTo(wxTopL, wTop);
  win.quadraticCurveTo(cx, wTop - ch * 0.04, wxTopR, wTop);
  win.lineTo(wxBotR, wBot);
  win.closePath();
  const glass = ctx.createLinearGradient(0, wTop, 0, wBot);
  glass.addColorStop(0, "#334a66");
  glass.addColorStop(0.5, "#10192a");
  glass.addColorStop(1, "#070b12");
  ctx.fillStyle = glass;
  ctx.fill(win);
  ctx.save();
  ctx.clip(win);
  const refl = ctx.createLinearGradient(wxTopL, wTop, wxBotR, wBot);
  refl.addColorStop(0, "rgba(255,255,255,0)");
  refl.addColorStop(0.3, "rgba(255,255,255,0.05)");
  refl.addColorStop(0.45, "rgba(255,255,255,0.28)");
  refl.addColorStop(0.55, "rgba(255,255,255,0.08)");
  refl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = refl;
  ctx.fillRect(0, wTop, W, wBot - wTop);
  // third brake light
  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(cx - cw * 0.09, wTop + ch * 0.05, cw * 0.18, Math.max(2, ch * 0.06));
  ctx.restore();

  if (opts.decal === "number") {
    const rr = Math.min(ch * 0.3, cw * 0.11);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(cx, (wTop + wBot) / 2 + ch * 0.05, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0d12";
    ctx.font = `900 ${rr * 1.25}px Orbitron, Rajdhani, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("7", cx, (wTop + wBot) / 2 + ch * 0.07);
  }

  // roof highlight
  ctx.save();
  ctx.clip(cabin);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(cx - rw / 2, yr - ch * 0.08, rw, ch * 0.12);
  ctx.restore();

  // mirrors
  const mirW = s.shape === "truck" ? 0.03 * W : 0.022 * W;
  for (const side of [-1, 1]) {
    ctx.fillStyle = shade(paint, -0.3);
    ctx.beginPath();
    ctx.ellipse(cx + side * (cw / 2 + mirW * 1.1), ys - ch * 0.32, mirW, mirW * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---- spoiler ---- */
  const carbon = "#1a1d24";
  if (opts.spoiler === "lip") {
    ctx.fillStyle = shade(paint, -0.35);
    ctx.fill(roundRectPath(cx - bw * 0.4, ys - W * 0.014, bw * 0.8, W * 0.016, W * 0.006));
  } else if (opts.spoiler === "wing" || opts.spoiler === "gt") {
    const gt = opts.spoiler === "gt";
    const rise = gt ? W * 0.13 : W * 0.075;
    const plankW = gt ? bw * 0.98 : bw * 0.86;
    const plankH = gt ? W * 0.03 : W * 0.02;
    const upX = gt ? bw * 0.3 : bw * 0.3;
    const upW = W * 0.012;
    ctx.fillStyle = carbon;
    for (const side of [-1, 1]) {
      ctx.fillRect(cx + side * upX - upW / 2, ys - rise, upW, rise + 2);
    }
    const pg = ctx.createLinearGradient(0, ys - rise - plankH, 0, ys - rise);
    pg.addColorStop(0, gt ? "#2a2f3a" : shade(paint, 0.25));
    pg.addColorStop(1, gt ? "#0e1015" : shade(paint, -0.4));
    ctx.fillStyle = pg;
    ctx.fill(roundRectPath(cx - plankW / 2, ys - rise - plankH, plankW, plankH, plankH * 0.4));
    if (gt) {
      ctx.fillStyle = "#12151b";
      const epH = W * 0.06;
      ctx.fillRect(cx - plankW / 2 - W * 0.004, ys - rise - plankH - epH * 0.35, W * 0.01, epH);
      ctx.fillRect(cx + plankW / 2 - W * 0.006, ys - rise - plankH - epH * 0.35, W * 0.01, epH);
    }
  }

  /* ---- tail lights ---- */
  const drawLight = (path: Path2D, px: number, py: number, pr: number, color = "#ff2d2d") => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr * 2.4);
    g.addColorStop(0, rgba(color, 0.55));
    g.addColorStop(0.4, rgba(color, 0.22));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(px - pr * 2.4, py - pr * 2.4, pr * 4.8, pr * 4.8);
    ctx.restore();
    const lg = ctx.createRadialGradient(px, py, 0, px, py, pr * 1.2);
    lg.addColorStop(0, "#ffd6d6");
    lg.addColorStop(0.35, "#ff5a5a");
    lg.addColorStop(1, "#b00c0c");
    ctx.fillStyle = lg;
    ctx.fill(path);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = Math.max(1, W * 0.002);
    ctx.stroke(path);
    tailLights.push({ x: px / W, y: py / H, r: pr / W });
  };

  const ly = ys + h * 0.3;
  if (s.tail === "dual") {
    const lw = bw * 0.13, lh = h * 0.26;
    for (const side of [-1, 1]) {
      const lx = side < 0 ? cx - half * 0.9 : cx + half * 0.9 - lw;
      drawLight(roundRectPath(lx, ly - lh / 2, lw, lh, lh * 0.3), lx + lw / 2, ly, Math.max(lw, lh) / 2);
      // reverse light
      ctx.fillStyle = "rgba(255,245,220,0.75)";
      const rvx = side < 0 ? lx + lw + bw * 0.01 : lx - bw * 0.04;
      ctx.fill(roundRectPath(rvx, ly - lh * 0.25, bw * 0.03, lh * 0.5, 2));
    }
  } else if (s.tail === "bar") {
    const lw = bw * 0.84, lh = h * 0.13;
    drawLight(roundRectPath(cx - lw / 2, ly - lh / 2 - h * 0.05, lw, lh, lh / 2), cx, ly - h * 0.05, lw / 2);
    for (const side of [-1, 1]) {
      const bx = side < 0 ? cx - lw / 2 - bw * 0.01 : cx + lw / 2 - bw * 0.05;
      drawLight(roundRectPath(bx, ly - lh / 2 - h * 0.05, bw * 0.06, lh * 2.1, lh * 0.4), bx + bw * 0.03, ly + lh * 0.3, lh * 1.4);
    }
  } else if (s.tail === "round") {
    const lr = h * 0.14;
    for (const side of [-1, 1]) {
      for (const k of [0.8, 0.58]) {
        const px = cx + side * half * k;
        const p = new Path2D();
        p.arc(px, ly, lr, 0, Math.PI * 2);
        drawLight(p, px, ly, lr);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(px - lr * 0.3, ly - lr * 0.3, lr * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (s.tail === "split") {
    for (const side of [-1, 1]) {
      const x0 = cx + side * half * 0.92;
      const x1 = cx + side * half * 0.5;
      const p = new Path2D();
      p.moveTo(x0, ly - h * 0.16);
      p.lineTo(x1, ly - h * 0.06);
      p.lineTo(x1, ly + h * 0.1);
      p.lineTo(x0, ly + h * 0.14);
      p.closePath();
      drawLight(p, (x0 + x1) / 2, ly, Math.abs(x0 - x1) / 2);
    }
  } else {
    // vertical (truck)
    const lw = bw * 0.065, lh = h * 0.55;
    for (const side of [-1, 1]) {
      const lx = side < 0 ? cx - half * 0.93 : cx + half * 0.93 - lw;
      drawLight(roundRectPath(lx, ys + h * 0.12, lw, lh, lw * 0.3), lx + lw / 2, ys + h * 0.12 + lh / 2, lh / 2);
      ctx.fillStyle = "rgba(255,170,50,0.9)";
      ctx.fillRect(lx + lw * 0.2, ys + h * 0.15, lw * 0.6, lh * 0.14);
      ctx.fillStyle = "rgba(255,250,230,0.85)";
      ctx.fillRect(lx + lw * 0.2, ys + h * 0.12 + lh * 0.78, lw * 0.6, lh * 0.16);
    }
  }

  /* ---- diffuser + exhausts ---- */
  const sporty = s.shape === "super" || s.shape === "hyper" || s.shape === "coupe";
  if (sporty || s.shape === "muscle") {
    const dw = bw * (sporty ? 0.62 : 0.45);
    const dh = h * 0.2;
    ctx.fillStyle = "#0d0f13";
    ctx.fill(roundRectPath(cx - dw / 2, yb - dh, dw, dh, dh * 0.2));
    ctx.fillStyle = "#1f232b";
    const fins = sporty ? 5 : 3;
    for (let i = 0; i < fins; i++) {
      const fx = cx - dw / 2 + (dw * (i + 0.5)) / fins;
      ctx.fillRect(fx - W * 0.003, yb - dh, W * 0.006, dh);
    }
  }
  const er = (s.shape === "hyper" ? 0.02 : 0.026) * W;
  const ey = yb - h * 0.11;
  const exPos: number[] = s.exhaust === 1 ? [0.55] : s.exhaust === 2 ? [-0.6, 0.6] : [-0.66, -0.5, 0.5, 0.66];
  for (const k of exPos) {
    const ex = cx + k * half;
    const eg = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 0, ex, ey, er);
    eg.addColorStop(0, "#e5e7eb");
    eg.addColorStop(0.6, "#6b7280");
    eg.addColorStop(1, "#30343c");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#07080a";
    ctx.beginPath();
    ctx.arc(ex, ey, er * 0.62, 0, Math.PI * 2);
    ctx.fill();
    exhausts.push({ x: ex / W, y: ey / H, r: er / W });
  }

  /* ---- plate ---- */
  const pw = Math.max(bw * 0.2, W * 0.1);
  const ph = Math.max(h * 0.2, W * 0.035);
  const py = ys + h * (s.tail === "bar" ? 0.52 : 0.48);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill(roundRectPath(cx - pw / 2 - 2, py - 1, pw + 4, ph + 4, 3));
  const plg = ctx.createLinearGradient(0, py, 0, py + ph);
  plg.addColorStop(0, "#f3f4f6");
  plg.addColorStop(1, "#cfd3da");
  ctx.fillStyle = plg;
  ctx.fill(roundRectPath(cx - pw / 2, py, pw, ph, 2));
  ctx.fillStyle = "#111827";
  ctx.font = `700 ${ph * 0.62}px Orbitron, Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(opts.plate.slice(0, 7), cx, py + ph / 2 + 1);

  // reflectors
  ctx.fillStyle = "rgba(255,40,40,0.8)";
  for (const side of [-1, 1]) {
    ctx.fillRect(cx + side * half * 0.78 - bw * 0.025, yb - h * 0.12, bw * 0.05, h * 0.05);
  }

  // bottom glow line when underglow is on
  if (opts.glow !== "none") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const lg = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
    lg.addColorStop(0, rgba(opts.glow, 0));
    lg.addColorStop(0.2, rgba(opts.glow, 0.9));
    lg.addColorStop(0.8, rgba(opts.glow, 0.9));
    lg.addColorStop(1, rgba(opts.glow, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(cx - half, yb - 1, bw, Math.max(2, W * 0.005));
    ctx.restore();
  }

  return { canvas, w: W, h: H, tailLights, exhausts, wheels, groundY: gy / H };
}
