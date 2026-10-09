import { effectiveStats, resolvedSpoiler, RIVALS } from "./cars";
import { getCarSprite, type CarRenderOptions, type CarSprite } from "./carSprite";
import { envFor, type EnvPalette } from "./environments";
import { ParticleSystem, type Floater } from "./particles";
import { buildSentenceQueue } from "./sentences";
import { buildTrack, LANE_X, SEGMENT_LENGTH, type Track } from "./track";
import type { Difficulty, GameEvent, GameEventType, RaceConfig, RaceDistance, RaceResult } from "./types";

export const BASE_MAX_SPEED = 12000; // world units per second at top-speed factor 1.0
export const WPM_FOR_MAX = 85;
export const TIME_LIMITS: Record<RaceDistance, number> = { sprint: 95, circuit: 170, marathon: 290 };
export const OPPONENT_WPM: Record<Difficulty, number[]> = { rookie: [22, 30, 38], pro: [38, 48, 58], legend: [56, 70, 86] };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { rookie: "Rookie", pro: "Pro", legend: "Legend" };
export const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  rookie: "Rivals type 20-40 WPM",
  pro: "Rivals type 40-60 WPM",
  legend: "Rivals type 55-90 WPM",
};
const MAX_ERROR_TRAIL = 6;
const INST_WINDOW = 3;

export type RaceState = "countdown" | "running" | "paused" | "finished";

export interface Racer {
  id: string;
  name: string;
  isPlayer: boolean;
  position: number;
  speed: number;
  laneX: number;
  finishTime: number | null;
  targetWpm: number;
  phase: number;
  carOpts: CarRenderOptions;
  sprite: CarSprite;
  /** car definition id — used by 3D overlay to build correct geometry */
  carDefId: string;
}

export interface CarScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function normalizeChar(ch: string) {
  switch (ch) {
    case "\u2019":
    case "\u2018":
    case "\u02bc":
      return "'";
    case "\u201c":
    case "\u201d":
      return '"';
    case "\u00a0":
      return " ";
    default:
      return ch;
  }
}

/**
 * Sentence text is written as normal prose, so nearly every sentence opens on a
 * capital letter.  A player typing on a physical keyboard produces lowercase
 * `event.key` values unless they hold Shift, so comparing case-sensitively made
 * the first character of essentially every sentence impossible to enter: the
 * keystroke was counted as an error, combo stayed at 0, acceleration collapsed
 * and the race looked stuck even though the letters on screen kept changing.
 *
 * Typing games are case-insensitive; compare on a case-folded copy of the
 * character while leaving the displayed sentence (and its scoring text) intact.
 */
function matchKey(ch: string) {
  return ch.toLowerCase();
}

export class GameEngine {
  cfg: RaceConfig;
  env: EnvPalette;
  track: Track;
  state: RaceState = "countdown";
  prevState: RaceState = "countdown";
  countdown = 2.4;
  countdownStep = 4;
  time = 0;
  timeLimit: number;
  demo: boolean;

  player: Racer;
  opponents: Racer[];
  maxSpeed: number;
  stats: ReturnType<typeof effectiveStats>;

  sentences: string[];
  sentenceIndex = 0;
  target: string;
  typed = "";
  errorsThisSentence = 0;
  typingVersion = 0;
  keyTimes: number[] = [];
  lastKeyTime = -10;
  firstKeyTime = -1;

  score = 0;
  combo = 0;
  maxCombo = 0;
  multiplier = 1;
  correctChars = 0;
  errors = 0;
  words = 0;
  sentencesDone = 0;
  perfectSentences = 0;

  nitroMeter = 0;
  nitroTime = 0;
  nitroActive = false;
  nitroPower: number;
  stutter = 0;

  trauma = 0;
  shakeX = 0;
  shakeY = 0;
  flashRed = 0;
  flashNitro = 0;
  zoom = 1;
  place = 1;
  lastPlaceChange = -10;
  carScreen: CarScreenBox = { x: 0.4, y: 0.7, w: 0.2, h: 0.2 };
  particles = new ParticleSystem();
  floaters: Floater[] = [];
  events: GameEvent[] = [];
  result: RaceResult | null = null;
  playerX: number;
  private rnd = Math.random;

  constructor(cfg: RaceConfig) {
    this.cfg = cfg;
    this.demo = !!cfg.demo;
    this.env = envFor(cfg.environment);
    const seed = cfg.seed ?? Math.floor(Math.random() * 1e9);
    this.track = buildTrack(cfg.distance, this.env, seed);
    this.timeLimit = TIME_LIMITS[cfg.distance];
    this.stats = effectiveStats(cfg.build);
    this.maxSpeed = BASE_MAX_SPEED * this.stats.top;
    this.nitroPower = this.stats.nitro;
    this.sentences = buildSentenceQueue(cfg.difficulty, 40, seed);
    this.target = this.sentences[0];
    this.playerX = LANE_X[1];

    const b = cfg.build;
    const playerOpts: CarRenderOptions = {
      shape: b.def.shape,
      paint: b.custom.paint,
      rims: b.custom.rims,
      spoiler: resolvedSpoiler(b),
      glow: b.custom.glow,
      decal: b.custom.decal,
      plate: b.plate,
      width: 560,
    };
    this.player = {
      id: "player",
      name: cfg.playerName,
      isPlayer: true,
      position: 0,
      speed: 0,
      laneX: LANE_X[1],
      finishTime: null,
      targetWpm: 0,
      phase: 0,
      carOpts: playerOpts,
      sprite: getCarSprite(playerOpts),
      carDefId: b.def.id,
    };

    const wpms = OPPONENT_WPM[cfg.difficulty];
    const lanes = [LANE_X[0], LANE_X[2], LANE_X[3]];
    const equipment = [
      { rims: "chrome" as const, spoiler: "gt" as const, glow: "#38bdf8", decal: "stripes" as const },
      { rims: "neon" as const, spoiler: "wing" as const, glow: "#f472b6", decal: "number" as const },
      { rims: "steel" as const, spoiler: "lip" as const, glow: "#fbbf24", decal: "checker" as const },
    ];
    const rivalPool = RIVALS.filter((r) => r.def.id !== b.def.id).slice(0, 3);
    this.opponents = rivalPool.map((r, i) => {
      const kit = equipment[i % equipment.length];
      const opts: CarRenderOptions = {
        shape: r.def.shape,
        paint: r.paint,
        rims: kit.rims,
        spoiler: kit.spoiler,
        glow: kit.glow,
        decal: kit.decal,
        plate: r.name.toUpperCase(),
        width: 360,
      };
      return {
        id: `opp${i}`,
        name: r.name,
        isPlayer: false,
        position: SEGMENT_LENGTH * (1.6 + i * 1.5),
        speed: 0,
        laneX: lanes[i],
        finishTime: null,
        targetWpm: wpms[i] * (0.95 + this.rnd() * 0.1),
        phase: this.rnd() * 10,
        carOpts: opts,
        sprite: getCarSprite(opts),
        carDefId: r.def.id,
      };
    });

    this.place = 1 + this.opponents.filter((o) => o.position > this.player.position).length;

    if (this.demo) {
      this.state = "running";
      this.player.position = SEGMENT_LENGTH * 30;
      this.player.speed = this.maxSpeed * 0.55;
      this.opponents.forEach((o, i) => {
        o.position = this.player.position + SEGMENT_LENGTH * (6 + i * 9);
        o.speed = this.maxSpeed * 0.5;
      });
    }
  }

  /* ---------- helpers ---------- */
  private emit(type: GameEventType, value?: number) {
    this.events.push({ type, value });
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  float(text: string, color: string, size = 1, x?: number, y?: number) {
    const cs = this.carScreen;
    this.floaters.push({
      text,
      x: x ?? cs.x + cs.w / 2 + (Math.random() - 0.5) * cs.w * 0.6,
      y: y ?? cs.y - 0.02,
      life: 1,
      maxLife: 1,
      color,
      size,
      vy: -0.08,
    });
    if (this.floaters.length > 12) this.floaters.shift();
  }

  get nextSentence(): string {
    return this.sentences[this.sentenceIndex + 1] ?? "";
  }

  get speedFactor() {
    return this.player.speed / BASE_MAX_SPEED;
  }

  get mph() {
    return Math.round(this.speedFactor * 200);
  }

  get progress() {
    return Math.min(1, Math.max(0, this.player.position / this.track.finishZ));
  }

  opponentProgress(i: number) {
    return Math.min(1, Math.max(0, this.opponents[i].position / this.track.finishZ));
  }

  getWpm() {
    const t = this.firstKeyTime >= 0 ? this.time - this.firstKeyTime : 0;
    if (t < 1) return 0;
    return (this.correctChars / 5) / (t / 60);
  }

  getInstWpm() {
    const cutoff = this.time - INST_WINDOW;
    const kt = this.keyTimes;
    while (kt.length && kt[0] < cutoff) kt.shift();
    if (!kt.length) return 0;
    const span = Math.max(1, Math.min(INST_WINDOW, this.time - Math.max(this.firstKeyTime, cutoff)));
    return (kt.length / 5) / (span / 60);
  }

  getAccuracy() {
    const total = this.correctChars + this.errors;
    return total === 0 ? 100 : (this.correctChars / total) * 100;
  }

  get timeLeft() {
    return Math.max(0, this.timeLimit - this.time);
  }

  /* ---------- control ---------- */
  pause() {
    if (this.state === "running" || this.state === "countdown") {
      this.prevState = this.state;
      this.state = "paused";
    }
  }

  resume() {
    if (this.state === "paused") this.state = this.prevState;
  }

  togglePause() {
    if (this.state === "paused") this.resume();
    else this.pause();
  }

  fireNitro(): boolean {
    if (this.state !== "running" || this.nitroActive) return false;
    if (this.nitroMeter < 100) {
      this.emit("combo", -1);
      return false;
    }
    this.nitroActive = true;
    this.nitroTime = 3.2;
    this.nitroMeter = 0;
    this.trauma = Math.min(1, this.trauma + 0.55);
    this.flashNitro = 1;
    this.zoom = 1.07;
    this.emit("nitro");
    this.float("NITRO!", "#fbbf24", 1.6, 0.5, 0.42);
    return true;
  }

  /* ---------- typing ---------- */
  private firstMismatch(): number {
    for (let i = 0; i < this.typed.length; i++) if (matchKey(this.typed[i]) !== matchKey(this.target[i])) return i;
    return -1;
  }

  typeChar(raw: string) {
    if (this.state !== "running" || this.demo) return;
    const ch = normalizeChar(raw);
    if (ch.length !== 1 || ch === "\n" || ch === "\r") return;
    const mismatch = this.firstMismatch();
    if (mismatch >= 0 && this.typed.length - mismatch >= MAX_ERROR_TRAIL) return;
    if (this.typed.length >= this.target.length + MAX_ERROR_TRAIL) return;
    const idx = this.typed.length;
    this.typed += ch;
    this.typingVersion++;
    if (mismatch < 0 && idx < this.target.length && matchKey(ch) === matchKey(this.target[idx])) this.onCorrect(idx);
    else this.onError();
    if (this.typed.length === this.target.length && this.firstMismatch() < 0) this.completeSentence();
  }

  backspace(word = false) {
    if (this.state !== "running" || !this.typed.length) return;
    if (word) {
      let i = this.typed.length - 1;
      while (i >= 0 && this.typed[i] === " ") i--;
      while (i >= 0 && this.typed[i] !== " ") i--;
      this.typed = this.typed.slice(0, Math.max(0, i + 1));
    } else {
      this.typed = this.typed.slice(0, -1);
    }
    this.typingVersion++;
  }

  /** Reconcile with an external text field (mobile IME). */
  syncFromInput(value: string) {
    if (this.state !== "running") return;
    let p = 0;
    while (p < value.length && p < this.typed.length && matchKey(value[p]) === matchKey(this.typed[p])) p++;
    const removed = this.typed.length - p;
    for (let i = 0; i < removed; i++) this.backspace();
    const added = value.slice(p);
    for (const ch of added) {
      if (ch === "\n") this.fireNitro();
      else this.typeChar(ch);
    }
  }

  private onCorrect(idx: number) {
    this.correctChars++;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.firstKeyTime < 0) this.firstKeyTime = this.time;
    this.keyTimes.push(this.time);
    this.lastKeyTime = this.time;
    const prevMult = this.multiplier;
    this.multiplier = 1 + 0.5 * Math.min(3, Math.floor(this.combo / 25));
    if (this.multiplier > prevMult) {
      this.emit("combo", this.multiplier);
      this.float(`x${this.multiplier} COMBO`, "#e879f9", 1.3, 0.5, 0.36);
      this.trauma = Math.min(1, this.trauma + 0.15);
    }
    this.score += Math.round(10 * this.multiplier * (this.nitroActive ? 2 : 1));
    this.player.speed = Math.min(this.maxSpeed * 1.4, this.player.speed + this.maxSpeed * 0.006);
    const cs = this.carScreen;
    if (idx % 2 === 0) this.particles.sparks(cs.x + cs.w * (0.25 + Math.random() * 0.5), cs.y + cs.h * 0.82, 1, 0.6);
    this.emit("key");
    if (this.target[idx] === " " || idx === this.target.length - 1) this.onWord();
  }

  private onWord() {
    this.words++;
    const pts = Math.round(60 * this.multiplier);
    this.score += pts;
    this.addNitro(8);
    const cs = this.carScreen;
    this.particles.sparks(cs.x + cs.w * 0.2, cs.y + cs.h * 0.8, 5, 1);
    this.particles.sparks(cs.x + cs.w * 0.8, cs.y + cs.h * 0.8, 5, 1);
    this.emit("word");
  }

  private onError() {
    this.errors++;
    this.errorsThisSentence++;
    this.combo = 0;
    this.multiplier = 1;
    const penalty = 0.2 / this.stats.grip;
    this.player.speed *= 1 - Math.min(0.3, penalty);
    this.stutter = 0.4 / this.stats.grip;
    this.trauma = Math.min(1, this.trauma + 0.5);
    this.flashRed = 1;
    this.nitroMeter = Math.max(0, this.nitroMeter - 6);
    const cs = this.carScreen;
    const sp = this.player.sprite;
    for (const wh of sp.wheels) {
      this.particles.smoke(cs.x + cs.w * wh.x, cs.y + cs.h * wh.y, 4, wh.x < 0.5 ? -1 : 1);
    }
    this.emit("error");
  }

  private addNitro(n: number) {
    const before = this.nitroMeter;
    this.nitroMeter = Math.min(100, this.nitroMeter + n * (0.8 + 0.2 * this.nitroPower));
    if (before < 100 && this.nitroMeter >= 100) {
      this.emit("nitroReady");
      this.float("NITRO READY", "#fbbf24", 1.1, 0.5, 0.3);
    }
  }

  private completeSentence() {
    this.sentencesDone++;
    const perfect = this.errorsThisSentence === 0;
    if (perfect) {
      this.perfectSentences++;
      this.score += Math.round(500 * this.multiplier);
      this.addNitro(30);
      this.float("PERFECT +" + Math.round(500 * this.multiplier), "#4ade80", 1.4, 0.5, 0.4);
      this.trauma = Math.min(1, this.trauma + 0.25);
      this.emit("perfect");
    } else {
      this.score += Math.round(250 * this.multiplier);
      this.addNitro(14);
      this.float("+" + Math.round(250 * this.multiplier), "#22d3ee", 1.2, 0.5, 0.4);
      this.emit("sentence");
    }
    const cs = this.carScreen;
    this.particles.sparks(cs.x + cs.w / 2, cs.y + cs.h * 0.5, 22, 1.6);
    this.player.speed = Math.min(this.maxSpeed * 1.4, this.player.speed + this.maxSpeed * 0.05);
    this.sentenceIndex++;
    if (this.sentenceIndex >= this.sentences.length - 2) {
      this.sentences.push(...buildSentenceQueue(this.cfg.difficulty, 30, Math.floor(Math.random() * 1e9)).slice(1));
    }
    this.target = this.sentences[this.sentenceIndex];
    this.typed = "";
    this.errorsThisSentence = 0;
    this.typingVersion++;
  }

  /* ---------- simulation ---------- */
  update(dt: number) {
    if (this.state === "paused") return;
    this.particles.update(dt);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    const sh = this.trauma * this.trauma;
    this.shakeX = (Math.random() * 2 - 1) * sh * 26;
    this.shakeY = (Math.random() * 2 - 1) * sh * 18;
    this.flashRed = Math.max(0, this.flashRed - dt * 2.4);
    this.flashNitro = Math.max(0, this.flashNitro - dt * 0.8);
    this.zoom += (1 - this.zoom) * Math.min(1, dt * 2);

    if (this.state === "countdown") {
      this.countdown -= dt;
      const step = Math.ceil(this.countdown / 0.8);
      if (step < this.countdownStep) {
        this.countdownStep = step;
        if (step > 0) this.emit("countdown", step);
      }
      if (this.countdown <= 0) {
        this.state = "running";
        this.emit("go");
      }
      return;
    }
    if (this.state !== "running") {
      // finished: coast and slow down
      this.player.speed = Math.max(0, this.player.speed - this.maxSpeed * 0.35 * dt);
      this.player.position += this.player.speed * dt;
      this.updateOpponents(dt);
      return;
    }

    this.time += dt;
    const p = this.player;
    const instWpm = this.getInstWpm();
    const active = this.time - this.lastKeyTime < 1.6;
    let target = 0;
    if (this.demo) {
      target = this.maxSpeed * (0.58 + 0.08 * Math.sin(this.time * 0.4));
    } else if (active) {
      target = this.maxSpeed * Math.min(1.25, 0.18 + 0.82 * (instWpm / WPM_FOR_MAX));
    }
    let accel = 1.5 * this.stats.accel;
    if (this.nitroActive) {
      target = Math.max(target, this.maxSpeed * 0.95) * (1 + 0.3 * this.nitroPower);
      accel *= 2.4;
    }
    if (this.stutter > 0) {
      this.stutter -= dt;
      target = Math.min(target, this.maxSpeed * 0.3);
    }
    const rate = target > p.speed ? accel : active ? 0.9 : 0.5;
    p.speed += (target - p.speed) * Math.min(1, rate * dt);
    p.position += p.speed * dt;

    if (this.nitroActive) {
      this.nitroTime -= dt;
      const cs = this.carScreen;
      for (const ex of p.sprite.exhausts) {
        this.particles.flame(cs.x + cs.w * ex.x, cs.y + cs.h * ex.y, 1 + this.nitroPower * 0.3);
      }
      this.trauma = Math.max(this.trauma, 0.22);
      if (this.nitroTime <= 0) this.nitroActive = false;
    }

    if (this.demo) {
      if (p.position >= this.track.length - SEGMENT_LENGTH * 400) {
        p.position = SEGMENT_LENGTH * 30;
        this.opponents.forEach((o, i) => (o.position = p.position + SEGMENT_LENGTH * (6 + i * 9)));
      }
      this.updateOpponents(dt);
      return;
    }

    this.updateOpponents(dt);

    const prevPlace = this.place;
    this.place = 1 + this.opponents.filter((o) => o.position > p.position).length;
    if (this.place !== prevPlace) {
      const quiet = this.time - this.lastPlaceChange < 0.8;
      this.lastPlaceChange = this.time;
      if (this.place < prevPlace) {
        this.score += 150;
        if (!quiet) {
          this.emit("overtake");
          this.float(this.place === 1 ? "1ST PLACE!" : "OVERTAKE!", "#22d3ee", 1.2, 0.5, 0.33);
        }
      } else if (!quiet) {
        this.emit("overtaken");
      }
    }

    if (p.position >= this.track.finishZ) this.finish(false);
    else if (this.time >= this.timeLimit) this.finish(true);
  }

  private updateOpponents(dt: number) {
    const p = this.player;
    const raceLen = this.track.finishZ;
    for (const o of this.opponents) {
      const wobble = 1 + 0.12 * Math.sin(this.time * 0.37 + o.phase) + 0.05 * Math.sin(this.time * 1.31 + o.phase * 2);
      let wpm = o.targetWpm * wobble;
      if (!this.demo) {
        const delta = Math.max(-1, Math.min(1, (p.position - o.position) / (raceLen * 0.1)));
        wpm *= 1 + 0.14 * delta;
      }
      const base = this.demo ? this.maxSpeed * 0.55 : BASE_MAX_SPEED * Math.min(1.25, 0.18 + 0.82 * (wpm / WPM_FOR_MAX));
      const tgt = o.finishTime !== null ? base * 0.6 : base;
      o.speed += (tgt - o.speed) * Math.min(1, 1.1 * dt);
      o.position += o.speed * dt;
      if (o.finishTime === null && o.position >= raceLen && !this.demo) o.finishTime = this.time;
    }
  }

  private finish(dnf: boolean) {
    this.state = "finished";
    this.player.finishTime = this.time;
    const place = dnf ? 1 + this.opponents.filter((o) => o.position > this.player.position).length : 1 + this.opponents.filter((o) => o.finishTime !== null && o.finishTime <= this.time).length;
    this.place = place;
    const placeBonus = dnf ? 0 : [3000, 1500, 600, 0][place - 1];
    const timeBonus = dnf ? 0 : Math.max(0, Math.round((this.timeLimit - this.time) * 12));
    this.score += placeBonus + timeBonus;
    const credits = Math.round(this.score / 25) + (dnf ? 40 : [400, 250, 120, 60][place - 1]);
    this.result = {
      score: this.score,
      wpm: Math.round(this.getWpm()),
      accuracy: Math.round(this.getAccuracy() * 10) / 10,
      place,
      time: this.time,
      maxCombo: this.maxCombo,
      words: this.words,
      perfectSentences: this.perfectSentences,
      credits,
      dnf,
      isHighScore: false,
      rank: 0,
    };
    this.trauma = Math.min(1, this.trauma + 0.6);
    if (!dnf && place <= 3) this.particles.confetti(140);
    this.emit(dnf ? "dnf" : "finish", place);
  }
}
