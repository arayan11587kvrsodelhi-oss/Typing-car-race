import { rgba } from "./carSprite";
import type { GameEngine, Racer } from "./engine";
import type { EnvPalette } from "./environments";
import { buildSpriteSet, type SpriteSet } from "./sprites";
import { CAR_WORLD_WIDTH, exponentialFog, findSegment, LANES, mulberry32, percentRemaining, ROAD_WIDTH, RUMBLE_LENGTH, SEGMENT_LENGTH, type ProjPoint, type Segment } from "./track";


function project(p: ProjPoint, camX: number, camY: number, camZ: number, depth: number, w: number, h: number) {
  p.camera.x = p.world.x - camX;
  p.camera.y = p.world.y - camY;
  p.camera.z = p.world.z - camZ;
  const sc = depth / p.camera.z;
  p.screen.scale = sc;
  p.screen.x = Math.round(w / 2 + (sc * p.camera.x * w) / 2);
  p.screen.y = Math.round(h / 2 - (sc * p.camera.y * h) / 2);
  p.screen.w = Math.round((sc * ROAD_WIDTH * w) / 2);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class RoadRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  width = 1;
  height = 1;
  dpr = 1;
  private env: EnvPalette | null = null;
  private sprites: SpriteSet | null = null;
  private sky: HTMLCanvasElement | null = null;
  private far: HTMLCanvasElement | null = null;
  private mid: HTMLCanvasElement | null = null;
  private layerW = 1;
  private farH = 1;
  private midH = 1;
  private farOffset = 0;
  private midOffset = 0;
  private bgShift = 0;
  private twinkles: { x: number; y: number; r: number; ph: number }[] = [];
  private streakSeeds: number[] = [];
  private vignette: CanvasGradient | null = null;
  private redGrad: CanvasGradient | null = null;
  private nitroGrad: CanvasGradient | null = null;
  private time = 0;
  private portrait = false;
  private cameraHeight = 1000;
  private cameraDepth = 1 / Math.tan((100 / 2) * (Math.PI / 180));
  private drawDistance = 300;
  private seed = Math.floor(Math.random() * 1e9);
  private carsBySegment = new Map<number, Racer[]>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    for (let i = 0; i < 80; i++) this.streakSeeds.push(Math.random());
  }

  resize(w: number, h: number) {
    const isMobile = Math.min(w, h) < 700;
    this.dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    this.width = Math.max(1, Math.floor(w));
    this.height = Math.max(1, Math.floor(h));
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.portrait = h > w * 1.05;
    this.cameraHeight = this.portrait ? 720 : 1000;
    const area = this.width * this.height;
    this.drawDistance = area > 1.4e6 ? 300 : area > 6e5 ? 260 : 200;
    this.buildOverlays();
    if (this.env) this.buildBackdrop(this.env);
  }

  setEnvironment(env: EnvPalette) {
    if (this.env?.id === env.id && this.sprites) return;
    this.env = env;
    this.sprites = buildSpriteSet(env);
    this.buildBackdrop(env);
  }

  /* ---------------- backdrop builders ---------------- */
  private buildOverlays() {
    const { width: w, height: h, ctx } = this;
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.6)");
    this.vignette = v;
    const r = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
    r.addColorStop(0, "rgba(239,68,68,0)");
    r.addColorStop(1, "rgba(239,68,68,0.75)");
    this.redGrad = r;
    const n = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
    n.addColorStop(0, "rgba(251,191,36,0)");
    n.addColorStop(1, "rgba(251,191,36,0.55)");
    this.nitroGrad = n;
  }

  private buildBackdrop(env: EnvPalette) {
    // Deterministic randomness so a resize / orientation change doesn't reshuffle the skyline.
    const originalRandom = Math.random;
    Math.random = mulberry32(this.seed);
    try {
      this.buildBackdropInner(env);
    } finally {
      Math.random = originalRandom;
    }
  }

  private buildBackdropInner(env: EnvPalette) {
    const { width: w, height: h } = this;
    this.twinkles = [];
    // sky
    const sky = document.createElement("canvas");
    sky.width = w;
    sky.height = h;
    const s = sky.getContext("2d")!;
    const horizon = h * 0.5;
    const g = s.createLinearGradient(0, 0, 0, horizon + h * 0.06);
    g.addColorStop(0, env.sky[0]);
    g.addColorStop(0.35, env.sky[1]);
    g.addColorStop(0.75, env.sky[2]);
    g.addColorStop(1, env.sky[3]);
    s.fillStyle = g;
    s.fillRect(0, 0, w, h);
    const below = s.createLinearGradient(0, horizon, 0, h);
    below.addColorStop(0, env.sky[3]);
    below.addColorStop(0.15, env.fog);
    below.addColorStop(1, env.ground[0]);
    s.fillStyle = below;
    s.fillRect(0, horizon, w, h - horizon);

    if (env.stars) {
      this.twinkles = [];
      for (let i = 0; i < 180; i++) {
        const x = Math.random() * w;
        const y = Math.random() * horizon * 0.95;
        const r = 0.4 + Math.random() * 1.3;
        s.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.65})`;
        s.beginPath();
        s.arc(x, y, r, 0, Math.PI * 2);
        s.fill();
        if (i < 28) this.twinkles.push({ x, y, r: r + 0.6, ph: Math.random() * 6 });
      }
    }
    if (env.clouds) {
      for (let i = 0; i < 9; i++) {
        const cx = Math.random() * w;
        const cy = horizon * (0.3 + Math.random() * 0.55);
        const rw = w * (0.08 + Math.random() * 0.14);
        const cg = s.createRadialGradient(cx, cy, 0, cx, cy, rw);
        cg.addColorStop(0, "rgba(255,255,255,0.22)");
        cg.addColorStop(1, "rgba(255,255,255,0)");
        s.fillStyle = cg;
        s.save();
        s.translate(cx, cy);
        s.scale(1, 0.35);
        s.translate(-cx, -cy);
        s.beginPath();
        s.arc(cx, cy, rw, 0, Math.PI * 2);
        s.fill();
        s.restore();
      }
    }
    // horizon glow
    s.save();
    s.globalCompositeOperation = "lighter";
    const hg = s.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, w * 0.65);
    hg.addColorStop(0, rgba(env.horizonGlow, 0.5));
    hg.addColorStop(0.5, rgba(env.horizonGlow, 0.14));
    hg.addColorStop(1, rgba(env.horizonGlow, 0));
    s.fillStyle = hg;
    s.fillRect(0, 0, w, horizon + 2);
    s.restore();

    if (env.moon) {
      const m = env.moon;
      const mx = m.x * w, my = m.y * h, mr = m.r * Math.min(w, h) * 1.4;
      s.save();
      s.globalCompositeOperation = "lighter";
      const mg = s.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 7);
      mg.addColorStop(0, rgba(m.glow, 0.35));
      mg.addColorStop(0.4, rgba(m.glow, 0.08));
      mg.addColorStop(1, rgba(m.glow, 0));
      s.fillStyle = mg;
      s.fillRect(0, 0, w, h);
      s.restore();
      const md = s.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
      md.addColorStop(0, "#ffffff");
      md.addColorStop(0.7, m.color);
      md.addColorStop(1, "#c7d2fe");
      s.fillStyle = md;
      s.beginPath();
      s.arc(mx, my, mr, 0, Math.PI * 2);
      s.fill();
      s.fillStyle = "rgba(100,110,150,0.18)";
      for (const [ox, oy, orr] of [[0.3, 0.2, 0.22], [-0.25, 0.35, 0.16], [-0.1, -0.35, 0.12], [0.45, -0.3, 0.1]]) {
        s.beginPath();
        s.arc(mx + ox * mr, my + oy * mr, orr * mr, 0, Math.PI * 2);
        s.fill();
      }
    }
    if (env.sun) {
      const su = env.sun;
      const sx = su.x * w, sy = su.y * h, sr = su.r * Math.min(w, h) * 1.6;
      s.save();
      s.globalCompositeOperation = "lighter";
      const sg = s.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 5);
      sg.addColorStop(0, rgba(su.glow, 0.7));
      sg.addColorStop(0.35, rgba(su.glow, 0.18));
      sg.addColorStop(1, rgba(su.glow, 0));
      s.fillStyle = sg;
      s.fillRect(0, 0, w, h);
      s.restore();
      s.save();
      s.beginPath();
      s.rect(0, 0, w, horizon + 1);
      s.clip();
      const sd = s.createLinearGradient(0, sy - sr, 0, sy + sr);
      sd.addColorStop(0, "#fff7d6");
      sd.addColorStop(0.5, su.color);
      sd.addColorStop(1, su.glow);
      s.fillStyle = sd;
      s.beginPath();
      s.arc(sx, sy, sr, 0, Math.PI * 2);
      s.fill();
      if (su.banded) {
        s.fillStyle = env.sky[2];
        for (let i = 0; i < 7; i++) {
          const yy = sy + sr * (0.1 + i * 0.13);
          s.fillRect(sx - sr, yy, sr * 2, 2 + i * 1.6);
        }
      }
      s.restore();
    }
    this.sky = sky;

    // parallax layers
    const lw = Math.max(1400, w * 2);
    this.layerW = lw;
    this.farH = Math.round(h * 0.3);
    this.midH = Math.round(h * 0.22);
    this.far = this.buildFar(env, lw, this.farH);
    this.mid = this.buildMid(env, lw, this.midH);
  }

  private ridge(ctx: CanvasRenderingContext2D, lw: number, lh: number, base: number, amps: number[], phases: number[], color0: string, color1: string, sharp: boolean) {
    ctx.beginPath();
    ctx.moveTo(0, lh);
    for (let x = 0; x <= lw; x += 3) {
      let y = base;
      for (let k = 0; k < amps.length; k++) {
        const f = k + 1;
        const v = Math.sin((2 * Math.PI * f * x) / lw + phases[k]);
        y -= amps[k] * (sharp ? Math.pow(Math.abs(v), 0.6) : v);
      }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(lw, lh);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, lh);
    g.addColorStop(0, color0);
    g.addColorStop(1, color1);
    ctx.fillStyle = g;
    ctx.fill();
  }

  private buildFar(env: EnvPalette, lw: number, lh: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = lw;
    c.height = lh;
    const ctx = c.getContext("2d")!;
    const [c0, c1] = env.far.colors;
    const ph = () => Array.from({ length: 6 }, () => Math.random() * Math.PI * 2);
    if (env.far.kind === "mesas") {
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer === 0 ? c0 : c1;
        let x = Math.random() * 60;
        while (x < lw + 300) {
          const bw = 90 + Math.random() * 260;
          const bh = lh * (0.2 + Math.random() * (layer === 0 ? 0.45 : 0.32));
          const slope = 30 + Math.random() * 40;
          const draw = (ox: number) => {
            ctx.beginPath();
            ctx.moveTo(ox, lh);
            ctx.lineTo(ox + slope, lh - bh);
            ctx.lineTo(ox + bw - slope, lh - bh);
            ctx.lineTo(ox + bw, lh);
            ctx.closePath();
            ctx.fill();
          };
          draw(x);
          if (x + bw > lw) draw(x - lw);
          x += bw + 40 + Math.random() * 160;
        }
      }
      return c;
    }
    const sharp = env.far.kind === "alps";
    this.ridge(ctx, lw, lh, lh * 0.62, [lh * 0.2, lh * 0.14, lh * 0.1, lh * 0.06, lh * 0.04, lh * 0.03], ph(), c0, c1, sharp);
    if (sharp) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      const snow = ctx.createLinearGradient(0, 0, 0, lh * 0.55);
      snow.addColorStop(0, "rgba(255,255,255,0.75)");
      snow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = snow;
      ctx.fillRect(0, 0, lw, lh * 0.55);
      ctx.restore();
    }
    this.ridge(ctx, lw, lh, lh * 0.82, [lh * 0.14, lh * 0.1, lh * 0.08, lh * 0.05, lh * 0.03, lh * 0.02], ph(), c1, c1, sharp);
    return c;
  }

  private buildMid(env: EnvPalette, lw: number, lh: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = lw;
    c.height = lh;
    const ctx = c.getContext("2d")!;
    const [c0, c1] = env.mid.colors;
    if (env.mid.kind === "city") {
      let x = 0;
      const sc = clamp(lh / 160, 0.7, 1.8);
      while (x < lw) {
        const bw = (16 + Math.random() * 54) * sc;
        const bh = lh * (0.18 + Math.random() * 0.78);
        const draw = (ox: number) => {
          const g = ctx.createLinearGradient(ox, 0, ox + bw, 0);
          g.addColorStop(0, c0);
          g.addColorStop(0.5, c1);
          g.addColorStop(1, c0);
          ctx.fillStyle = g;
          ctx.fillRect(ox, lh - bh, bw, bh);
          const cols = Math.floor(bw / (7 * sc));
          const rows = Math.floor(bh / (9 * sc));
          for (let r = 0; r < rows; r++) {
            for (let cc = 0; cc < cols; cc++) {
              if (Math.random() < 0.55) continue;
              ctx.fillStyle = Math.random() < 0.7 ? `rgba(255,216,154,${0.3 + Math.random() * 0.6})` : `rgba(160,225,255,${0.3 + Math.random() * 0.5})`;
              ctx.fillRect(ox + 2 * sc + cc * 7 * sc, lh - bh + 3 * sc + r * 9 * sc, 3 * sc, 4 * sc);
            }
          }
          const rr = Math.random();
          if (rr < 0.22) {
            ctx.fillStyle = ["#22d3ee", "#e879f9", "#fbbf24"][Math.floor(Math.random() * 3)];
            ctx.fillRect(ox, lh - bh, bw, 2 * sc);
          } else if (rr < 0.4) {
            ctx.fillStyle = "#6b7280";
            ctx.fillRect(ox + bw / 2, lh - bh - 14 * sc, 1.5 * sc, 14 * sc);
            ctx.fillStyle = "#ff5555";
            ctx.fillRect(ox + bw / 2 - 1, lh - bh - 16 * sc, 3 * sc, 3 * sc);
          }
        };
        draw(x);
        if (x + bw > lw) draw(x - lw);
        x += bw + Math.random() * 6 * sc;
      }
      return c;
    }
    if (env.mid.kind === "forest") {
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer === 0 ? c0 : c1;
        let x = -20;
        while (x < lw + 40) {
          const th = lh * (layer === 0 ? 0.4 + Math.random() * 0.5 : 0.25 + Math.random() * 0.4);
          const tw = th * 0.55;
          const draw = (ox: number) => {
            ctx.beginPath();
            ctx.moveTo(ox, lh - th);
            ctx.lineTo(ox + tw / 2, lh);
            ctx.lineTo(ox - tw / 2, lh);
            ctx.closePath();
            ctx.fill();
          };
          draw(x);
          if (x + tw > lw) draw(x - lw);
          x += tw * (0.45 + Math.random() * 0.3);
        }
      }
      return c;
    }
    // dunes
    const ph = () => Array.from({ length: 4 }, () => Math.random() * Math.PI * 2);
    this.ridge(ctx, lw, lh, lh * 0.75, [lh * 0.2, lh * 0.12, lh * 0.06, lh * 0.03], ph(), c0, c1, false);
    this.ridge(ctx, lw, lh, lh * 0.9, [lh * 0.14, lh * 0.08, lh * 0.04, lh * 0.02], ph(), c1, c1, false);
    return c;
  }

  /* ---------------- frame ---------------- */
  render(engine: GameEngine, dt: number) {
    const env = engine.env;
    this.setEnvironment(env);
    if (!this.sky || !this.far || !this.mid || !this.sprites) return;
    this.time += dt;
    const { ctx, width: w, height: h } = this;
    const track = engine.track;
    const player = engine.player;
    const sf = engine.speedFactor;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    if (engine.zoom !== 1) {
      ctx.translate(w / 2, h / 2);
      ctx.scale(engine.zoom, engine.zoom);
      ctx.translate(-w / 2, -h / 2);
    }
    ctx.translate(engine.shakeX, engine.shakeY);

    const position = player.position;
    const playerZ = this.cameraHeight * this.cameraDepth;
    const baseSegment = findSegment(track, position);
    const basePercent = percentRemaining(position, SEGMENT_LENGTH);
    const playerSegment = findSegment(track, position + playerZ);
    const playerPercent = percentRemaining(position + playerZ, SEGMENT_LENGTH);
    const playerY = lerp(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);

    // parallax
    const curve = playerSegment.curve;
    const pxScale = w / 1000;
    this.farOffset += curve * sf * dt * 45 * pxScale;
    this.midOffset += curve * sf * dt * 110 * pxScale;
    const slope = (playerSegment.p2.world.y - playerSegment.p1.world.y) * 0.5;
    this.bgShift = lerp(this.bgShift, clamp(slope, -h * 0.1, h * 0.1), Math.min(1, dt * 4));

    /* --- sky & background layers --- */
    ctx.drawImage(this.sky, 0, 0);
    if (this.twinkles.length) {
      ctx.fillStyle = "#ffffff";
      for (const t of this.twinkles) {
        ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(this.time * 1.7 + t.ph));
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const horizonY = h * 0.5;
    this.drawLayer(this.far, this.farOffset, horizonY + 10 + this.bgShift * 0.4 - this.farH);
    this.drawLayer(this.mid, this.midOffset, horizonY + 8 + this.bgShift * 0.7 - this.midH);

    /* --- road --- */
    this.carsBySegment.clear();
    for (const o of engine.opponents) {
      const seg = findSegment(track, o.position);
      const list = this.carsBySegment.get(seg.index);
      if (list) list.push(o);
      else this.carsBySegment.set(seg.index, [o]);
    }

    const segs = track.segments;
    const n = segs.length;
    const camX = engine.playerX * ROAD_WIDTH;
    const camY = playerY + this.cameraHeight;
    let maxy = h;
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);
    const dd = this.drawDistance;

    for (let i = 0; i < dd; i++) {
      const segment = segs[(baseSegment.index + i) % n];
      segment.looped = segment.index < baseSegment.index;
      segment.fog = exponentialFog(i / dd, env.fogDensity);
      segment.clip = maxy;
      const camZ = position - (segment.looped ? track.length : 0);
      project(segment.p1, camX - x, camY, camZ, this.cameraDepth, w, h);
      project(segment.p2, camX - x - dx, camY, camZ, this.cameraDepth, w, h);
      x += dx;
      dx += segment.curve;
      if (segment.p1.camera.z <= this.cameraDepth || segment.p2.screen.y >= segment.p1.screen.y || segment.p2.screen.y >= maxy) continue;
      this.renderSegment(segment, env);
      maxy = segment.p1.screen.y;
    }

    /* --- sprites & rivals (back to front) --- */
    for (let i = dd - 1; i > 0; i--) {
      const segment = segs[(baseSegment.index + i) % n];
      if (segment.p1.camera.z < 40) continue;
      const sc = segment.p1.screen.scale;
      for (const sp of segment.sprites) {
        const imgs = this.sprites[sp.kind];
        const img = imgs[sp.variant % imgs.length];
        const sx = segment.p1.screen.x + (sc * sp.offset * ROAD_WIDTH * w) / 2;
        const anchor = sp.offset === 0 ? -0.5 : sp.offset < 0 ? -1 : 0;
        this.drawSprite(img.canvas, img.worldWidth, sc, sx, segment.p1.screen.y, anchor, segment.clip, segment.fog);
      }
      const cars = this.carsBySegment.get(segment.index);
      if (cars) {
        for (const car of cars) {
          const pct = percentRemaining(car.position, SEGMENT_LENGTH);
          const csc = lerp(segment.p1.screen.scale, segment.p2.screen.scale, pct);
          const cxp = lerp(segment.p1.screen.x, segment.p2.screen.x, pct) + (csc * car.laneX * ROAD_WIDTH * w) / 2;
          const cyp = lerp(segment.p1.screen.y, segment.p2.screen.y, pct);
          this.drawSprite(car.sprite.canvas, CAR_WORLD_WIDTH, csc, cxp, cyp, -0.5, segment.clip, segment.fog, car.sprite.groundY);
        }
      }
    }

    /* --- player --- */
    this.drawPlayer(engine, playerSegment, sf);
    engine.particles.draw(ctx, w, h);
    this.drawStreaks(sf, engine.nitroActive);
    ctx.restore();

    /* --- overlays (unshaken) --- */
    if (this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, w, h);
    }
    if (engine.flashRed > 0 && this.redGrad) {
      ctx.globalAlpha = engine.flashRed;
      ctx.fillStyle = this.redGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if ((engine.flashNitro > 0 || engine.nitroActive) && this.nitroGrad) {
      ctx.globalAlpha = Math.max(engine.flashNitro, engine.nitroActive ? 0.35 + 0.15 * Math.sin(this.time * 20) : 0);
      ctx.fillStyle = this.nitroGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    this.drawFloaters(engine);
  }

  private drawLayer(layer: HTMLCanvasElement, offset: number, y: number) {
    const lw = this.layerW;
    const off = ((offset % lw) + lw) % lw;
    this.ctx.drawImage(layer, -off, y);
    if (lw - off < this.width) this.ctx.drawImage(layer, lw - off, y);
  }

  private poly(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  private renderSegment(seg: Segment, env: EnvPalette) {
    const ctx = this.ctx;
    const w = this.width;
    const x1 = seg.p1.screen.x, y1 = seg.p1.screen.y, w1 = seg.p1.screen.w;
    const x2 = seg.p2.screen.x, y2 = seg.p2.screen.y, w2 = seg.p2.screen.w;
    const ci = seg.colorIdx;
    const r1 = w1 / Math.max(6, 2 * LANES * 1.5), r2 = w2 / Math.max(6, 2 * LANES * 1.5);
    const l1 = w1 / 70, l2 = w2 / 70;

    ctx.fillStyle = env.ground[ci];
    ctx.fillRect(0, y2, w, y1 - y2);
    this.poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, env.rumble[ci]);
    this.poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, env.rumble[ci]);

    if (seg.finish || seg.start) {
      const cols = 8;
      for (let c = 0; c < cols; c++) {
        const a1 = x1 - w1 + (2 * w1 * c) / cols, b1 = x1 - w1 + (2 * w1 * (c + 1)) / cols;
        const a2 = x2 - w2 + (2 * w2 * c) / cols, b2 = x2 - w2 + (2 * w2 * (c + 1)) / cols;
        this.poly(a1, y1, b1, y1, b2, y2, a2, y2, (c + seg.index) % 2 ? "#f1f5f9" : "#111318");
      }
    } else {
      this.poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, env.road[ci]);
      if (w1 > 14) {
        // edge lines
        this.poly(x1 - w1 + l1 * 0.3, y1, x1 - w1 + l1 * 1.1, y1, x2 - w2 + l2 * 1.1, y2, x2 - w2 + l2 * 0.3, y2, env.edge);
        this.poly(x1 + w1 - l1 * 1.1, y1, x1 + w1 - l1 * 0.3, y1, x2 + w2 - l2 * 0.3, y2, x2 + w2 - l2 * 1.1, y2, env.edge);
        if (Math.floor(seg.index / RUMBLE_LENGTH) % 2 === 0) {
          const lw1 = (w1 * 2) / LANES, lw2 = (w2 * 2) / LANES;
          let lx1 = x1 - w1 + lw1, lx2 = x2 - w2 + lw2;
          for (let lane = 1; lane < LANES; lane++) {
            this.poly(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, env.lane);
            lx1 += lw1;
            lx2 += lw2;
          }
        }
      }
    }
    if (seg.fog < 0.995) {
      ctx.globalAlpha = 1 - seg.fog;
      ctx.fillStyle = env.fog;
      ctx.fillRect(0, y2, w, y1 - y2 + 1);
      ctx.globalAlpha = 1;
    }
  }

  private drawSprite(img: HTMLCanvasElement, worldWidth: number, scale: number, destX: number, destY: number, anchorX: number, clipY: number, fog: number, groundY = 1) {
    const w = this.width;
    const destW = (worldWidth * scale * w) / 2;
    if (destW < 1.5) return;
    const destH = destW * (img.height / img.width);
    const dx = destX + destW * anchorX;
    const dy = destY - destH * groundY;
    if (dx > w || dx + destW < 0) return;
    const clipH = clipY ? Math.max(0, dy + destH - clipY) : 0;
    if (clipH >= destH) return;
    const ctx = this.ctx;
    if (fog < 0.995) ctx.globalAlpha = Math.max(0.05, fog);
    ctx.drawImage(img, 0, 0, img.width, img.height - (img.height * clipH) / destH, dx, dy, destW, destH - clipH);
    if (fog < 0.995) ctx.globalAlpha = 1;
  }

  private drawPlayer(engine: GameEngine, playerSegment: Segment, sf: number) {
    const { ctx, width: w, height: h } = this;
    const sp = engine.player.sprite;
    const boost = this.portrait ? 1.3 : 1;
    let destW = (CAR_WORLD_WIDTH / this.cameraHeight) * (w / 2) * boost;
    destW = clamp(destW, 110, w * 0.46);
    const destH = destW * (sp.h / sp.w);
    const curve = playerSegment.curve;
    const sway = -curve * sf * w * 0.015;
    const bounce = sf > 0.03 ? Math.sin(this.time * 41) * sf * 1.6 + (Math.random() - 0.5) * sf * 1.2 : 0;
    const groundPx = h * 0.985;
    const cx = w / 2 + sway;
    const destX = cx - destW / 2;
    const destY = groundPx - destH * sp.groundY + bounce;
    const tilt = clamp(-curve * sf * 0.028, -0.08, 0.08);

    // headlight cone on the road ahead
    const env = engine.env;
    if (env.headlightAlpha > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const top = h * 0.5;
      const g = ctx.createLinearGradient(0, destY + destH * 0.3, 0, top);
      g.addColorStop(0, `rgba(255,244,214,${env.headlightAlpha})`);
      g.addColorStop(0.6, `rgba(255,244,214,${env.headlightAlpha * 0.25})`);
      g.addColorStop(1, "rgba(255,244,214,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - destW * 0.62, destY + destH * 0.5);
      ctx.lineTo(cx - destW * 0.1 + sway, top);
      ctx.lineTo(cx + destW * 0.1 + sway, top);
      ctx.lineTo(cx + destW * 0.62, destY + destH * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, groundPx + bounce);
    ctx.rotate(tilt);
    ctx.drawImage(sp.canvas, -destW / 2, -destH * sp.groundY, destW, destH);
    // brake / stutter glow + nitro exhaust glow
    if (engine.stutter > 0 || engine.nitroActive) {
      ctx.globalCompositeOperation = "lighter";
      if (engine.stutter > 0) {
        const a = clamp(engine.stutter / 0.4, 0, 1) * 0.9;
        for (const t of sp.tailLights) {
          const px = -destW / 2 + t.x * destW;
          const py = -destH * sp.groundY + t.y * destH;
          const r = Math.max(10, t.r * destW * 3.2);
          const g = ctx.createRadialGradient(px, py, 0, px, py, r);
          g.addColorStop(0, `rgba(255,80,60,${a})`);
          g.addColorStop(0.4, `rgba(255,40,30,${a * 0.4})`);
          g.addColorStop(1, "rgba(255,40,30,0)");
          ctx.fillStyle = g;
          ctx.fillRect(px - r, py - r, r * 2, r * 2);
        }
      }
      if (engine.nitroActive) {
        for (const e of sp.exhausts) {
          const px = -destW / 2 + e.x * destW;
          const py = -destH * sp.groundY + e.y * destH;
          const r = Math.max(8, e.r * destW * 4) * (1 + 0.3 * Math.random());
          const g = ctx.createRadialGradient(px, py, 0, px, py, r);
          g.addColorStop(0, "rgba(255,255,255,0.95)");
          g.addColorStop(0.3, "rgba(125,211,252,0.7)");
          g.addColorStop(1, "rgba(251,146,60,0)");
          ctx.fillStyle = g;
          ctx.fillRect(px - r, py - r, r * 2, r * 2);
        }
      }
    }
    ctx.restore();
    engine.carScreen = { x: destX / w, y: destY / h, w: destW / w, h: destH / h };
  }

  private drawStreaks(sf: number, nitro: boolean) {
    if (sf < 0.42 && !nitro) return;
    const { ctx, width: w, height: h } = this;
    const strength = clamp((sf - 0.42) / 0.6, 0, 1) * (nitro ? 1.6 : 1) + (nitro ? 0.4 : 0);
    const cx = w / 2, cy = h * 0.46;
    const R = Math.max(w, h) * 0.8;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = nitro ? "rgba(255,220,160,0.5)" : "rgba(255,255,255,0.4)";
    const count = nitro ? 34 : 24;
    for (let i = 0; i < count; i++) {
      const a = this.streakSeeds[i * 2] * Math.PI * 2;
      const spd = 0.6 + this.streakSeeds[i * 2 + 1];
      const phase = (this.time * spd * (0.8 + sf * 2.2) + this.streakSeeds[i * 2 + 1] * 7) % 1;
      const r0 = (0.22 + phase * 0.8) * R;
      const len = (0.04 + 0.22 * strength) * R * (0.3 + phase);
      const ca = Math.cos(a), sa = Math.sin(a) * 0.85;
      ctx.globalAlpha = strength * 0.35 * phase;
      ctx.lineWidth = 1 + phase * 2.5 * strength;
      ctx.beginPath();
      ctx.moveTo(cx + ca * r0, cy + sa * r0);
      ctx.lineTo(cx + ca * (r0 + len), cy + sa * (r0 + len));
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFloaters(engine: GameEngine) {
    if (!engine.floaters.length) return;
    const { ctx, width: w, height: h } = this;
    const base = clamp(w / 1000, 0.7, 1.4) * 24;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const f of engine.floaters) {
      const t = f.life / f.maxLife;
      const pop = 1 + Math.max(0, t - 0.8) * 2.5;
      const size = base * f.size * pop;
      ctx.font = `900 ${size}px Orbitron, Rajdhani, sans-serif`;
      ctx.globalAlpha = clamp(t * 2.2, 0, 1);
      ctx.lineWidth = Math.max(3, size * 0.18);
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(f.text, f.x * w, f.y * h);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x * w, f.y * h);
    }
    ctx.restore();
  }
}
