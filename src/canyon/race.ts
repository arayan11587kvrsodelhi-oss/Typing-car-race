/**
 * Canyon Stunt — race flow.
 *
 * Owns the single authoritative simulation tick:
 *   countdown → racing → finished (with pause layered on top)
 *
 * Progress model
 * --------------
 * The circuit is a loop of length `L`; the car's position along it (`s`) wraps.
 * This class keeps a forward-only, unwrapped `distance` and evaluates the
 * checkpoints/start line as gates on the raw wrapped `s`:
 *
 *   crossedForward(gate) := sPrev < gate <= s        (sPrev, s un-wrapped by ±L)
 *
 * Because gates are compared on the raw coordinate, reversing over a gate and
 * driving back through it re-fires it, but a gate that is *behind* the player
 * (out of order) never counts. The start line only advances the lap when all
 * checkpoints have been collected, so no lap can be skipped.
 *
 * Recovery places the car just *before* the last checkpoint, so crossing it
 * again re-validates the order.
 *
 * Pure TypeScript (no DOM/Three) so every rule is unit-testable in Node.
 */

import { clamp, createCanyonTrack, type CanyonTrack } from "./track";
import { CanyonCar, type CarInput, type StepEvents } from "./physics";
import { BoostMeter, StuntScorer, type Award, type StuntSummary } from "./scoring";

export type CanyonPhase = "countdown" | "racing" | "paused" | "finished";

export type CanyonEventType =
  | "countdown"
  | "go"
  | "checkpoint"
  | "lap"
  | "finish"
  | "crash"
  | "land"
  | "recover"
  | "boost"
  | "boostEmpty"
  | "boostReady"
  | "scrape"
  | "scrapeEnd"
  | "stunt";

export interface CanyonEvent {
  type: CanyonEventType;
  value?: number;
  text?: string;
}

export interface LapRecord {
  index: number;
  time: number;
  splits: number[];
}

export interface CanyonResult {
  totalTime: number;
  laps: LapRecord[];
  bestLap: number;
  stunts: StuntSummary;
  topSpeed: number;
  crashes: number;
  recoveries: number;
  finalScore: number;
  valid: boolean;
}

export interface CanyonRaceOptions {
  laps: number;
  assist: boolean;
  car?: CanyonCar;
  track?: CanyonTrack;
}

const COUNTDOWN_SECONDS = 3.6;

export class CanyonRace {
  readonly track: CanyonTrack;
  readonly car: CanyonCar;
  readonly scoring = new StuntScorer();
  readonly boost = new BoostMeter();
  readonly lapsToRun: number;

  phase: CanyonPhase = "countdown";
  countdown = COUNTDOWN_SECONDS;
  private lastCount = 4;

  /** Race clock (excludes countdown and pause). */
  time = 0;
  /** Completed laps. */
  lap = 0;
  lapStartTime = 0;
  lapTimes: number[] = [];
  /** Checkpoint split times for the lap in progress. */
  splits: number[] = [];
  /** Frozen split times of the most recently completed lap. */
  lastLapSplits: number[] = [];
  /** Index of the checkpoint the car must reach next (0 = start line). */
  nextCheckpoint = 0;
  totalCheckpoints = 0;
  /** Unwrapped forward distance since the start (metres). */
  distance = 0;
  /** Forward position within the current lap (0..L). */
  lapDistance = 0;
  private lastS: number;

  assist: boolean;
  topSpeed = 0;
  crashes = 0;
  recoveries = 0;
  private cooldown: Record<string, number> = {};

  events: CanyonEvent[] = [];
  result: CanyonResult | null = null;

  constructor(opts: CanyonRaceOptions) {
    this.lapsToRun = clamp(Math.round(opts.laps), 1, 5);
    this.assist = opts.assist;
    this.track = opts.track ?? createCanyonTrack();
    this.car = opts.car ?? new CanyonCar(this.track);
    this.car.reset();
    this.lastS = this.car.state.s;
  }

  /* ------------------------------ state ------------------------------ */

  get nextGate(): number {
    return this.track.checkpoints[this.nextCheckpoint] ?? this.track.checkpoints[0];
  }

  get currentLapProgress(): number {
    return clamp(this.lapDistance / this.track.length, 0, 1);
  }

  get progress(): number {
    return clamp((this.lap + this.currentLapProgress) / this.lapsToRun, 0, 1);
  }

  get lapTime(): number {
    return this.phase === "countdown" ? 0 : Math.max(0, this.time - this.lapStartTime);
  }

  get bestLap(): number | null {
    return this.lapTimes.length ? Math.min(...this.lapTimes) : null;
  }

  /** Split delta versus the previous lap at the same checkpoint. */
  lastSplitDelta(): number | null {
    const n = this.splits.length;
    if (n === 0 || this.lastLapSplits.length < n) return null;
    const current = this.splits[n - 1];
    const previous = this.lastLapSplits[n - 1];
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    return current - previous;
  }

  pause() {
    if (this.phase === "racing" || this.phase === "countdown") this.phase = "paused";
  }

  resume() {
    if (this.phase !== "paused") return;
    this.phase = this.countdown > 0 ? "countdown" : "racing";
  }

  togglePause() {
    if (this.phase === "paused") this.resume();
    else this.pause();
  }

  /** Full reset: car, clock, checkpoints, stunts, boost and results. */
  reset() {
    this.phase = "countdown";
    this.countdown = COUNTDOWN_SECONDS;
    this.lastCount = 4;
    this.time = 0;
    this.lap = 0;
    this.lapStartTime = 0;
    this.lapTimes = [];
    this.splits = [];
    this.lastLapSplits = [];
    this.nextCheckpoint = 0;
    this.totalCheckpoints = 0;
    this.distance = 0;
    this.lapDistance = 0;
    this.topSpeed = 0;
    this.crashes = 0;
    this.recoveries = 0;
    this.cooldown = {};
    this.events = [];
    this.result = null;
    this.boost.reset();
    this.scoring.reset();
    this.car.reset();
    this.lastS = this.car.state.s;
  }

  /* ------------------------------ events ----------------------------- */

  emit(type: CanyonEventType, value?: number, text?: string) {
    if (this.events.length > 48) this.events.shift();
    this.events.push({ type, value, text });
  }

  drainEvents(): CanyonEvent[] {
    if (this.events.length === 0) return this.events;
    const out = this.events;
    this.events = [];
    return out;
  }

  get recentAwards(): Award[] {
    return this.scoring.recent;
  }

  /** Cooldown gate for one-shot events (prevents replay farming). */
  private offCooldown(key: string, seconds: number): boolean {
    if ((this.cooldown[key] ?? -Infinity) + seconds > this.time) return false;
    this.cooldown[key] = this.time;
    return true;
  }

  /* ------------------------------ control ---------------------------- */

  /** Boost is owned by the race: input only ever *requests* it. */
  requestBoost() {
    if (this.phase !== "racing") return;
    if (!this.car.state.onGround) return;
    if (!this.boost.tryStart()) {
      this.emit("boostEmpty");
      return;
    }
    this.emit("boost");
  }

  releaseBoost() {
    this.boost.stop();
  }

  /**
   * Put the car back on the racing line at the last checkpoint.
   *
   * The respawn is placed a few metres BEFORE the gate so the car crosses it
   * again; crossing re-validates order and can never skip a lap.
   */
  recover(_reason: "input" | "fall" | "stuck" = "input"): boolean {
    if (this.phase !== "racing") return false;
    const cps = this.track.checkpoints;
    const len = this.track.length;
    // Respawn before the last collected gate: the start line if nothing has
    // been collected yet, otherwise the previous checkpoint.
    const lastIdx = this.totalCheckpoints === 0 ? 0 : (this.nextCheckpoint - 1 + cps.length) % cps.length;
    const s = (cps[lastIdx] - 16 + len) % len;
    const idx = this.car.trackIndex(s);
    const point = this.track.points[idx];
    this.car.reset({ x: point.x, z: point.z }, Math.atan2(point.tx, point.tz), 0);
    this.lastS = this.car.state.s;
    this.lapDistance = s;
    this.distance = this.lap * len + s;
    this.boost.stop();
    this.recoveries++;
    this.emit("recover");
    return true;
  }

  /* ------------------------------ update ----------------------------- */

  /** Advance the simulation. `dt` is seconds (already clamped by the driver). */
  update(dt: number, input: CarInput) {
    const step = clamp(dt, 0, 0.05);
    if (this.phase === "paused" || this.phase === "finished") {
      this.scoring.tick(step);
      return;
    }

    if (this.phase === "countdown") {
      this.countdown -= step;
      const count = Math.ceil(this.countdown);
      if (count < this.lastCount) {
        this.lastCount = count;
        if (count > 0) this.emit("countdown", count);
      }
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.phase = "racing";
        this.emit("go");
      }
      this.scoring.tick(step);
      return;
    }

    this.time += step;
    const boostActive = this.boost.update(step);
    if (this.boost.value >= this.boost.rules.max && this.offCooldown("boostReady", 2)) this.emit("boostReady");

    const car = this.car.state;
    const ev = this.car.step(step, input, { assist: this.assist, boostActive });
    this.topSpeed = Math.max(this.topSpeed, Math.abs(car.speed));

    const scoreBefore = this.scoring.summary.score;
    this.scoring.update(step, car, this.track, this.time);
    this.scoring.tick(step);
    this.chargeFromRide(step);
    this.handleStepEvents(ev);
    this.advanceProgress();

    const gained = this.scoring.summary.score - scoreBefore;
    if (gained > 0) {
      this.boost.charge(Math.min(24, gained / 80));
      this.emit("stunt", gained);
    }
  }

  private handleStepEvents(ev: StepEvents) {
    const car = this.car.state;
    if (ev.wall && ev.impact > 4 && this.offCooldown("scrape", 0.35)) this.emit("scrape", ev.impact);
    if (ev.crash) {
      this.crashes++;
      this.boost.stop();
      this.emit("crash", ev.impact);
    }
    if (ev.landed) {
      this.scoring.onLanding(Math.max(0.2, car.airtime), ev.landingQuality);
      this.boost.charge(8 + ev.landingQuality * 18);
      this.emit("land", ev.landingQuality);
    }
  }

  /** Wall rides and long drifts trickle-charge boost only while real. */
  private chargeFromRide(dt: number) {
    const car = this.car.state;
    if (!car.onGround) return;
    if (car.wallRide > 0.4) this.boost.charge(dt * 14);
    else if (car.drifting) this.boost.charge(dt * 9);
  }

  /**
   * Forward-only distance, plus ordered gate evaluation.
   */
  private advanceProgress() {
    const len = this.track.length;
    const s = this.car.state.s;
    const prev = this.lastS;
    let delta = s - prev;
    if (delta > len / 2) delta -= len;
    if (delta < -len / 2) delta += len;

    if (delta > 0) {
      this.distance += delta;
      this.lapDistance = Math.min(len, this.lapDistance + delta);
    }
    this.lastS = s;

    const cp = this.track.checkpoints[this.nextCheckpoint];
    if (cp === undefined) return;
    if (crossedForward(prev, s, cp, len)) {
      this.collectCheckpoint();
      return;
    }
    // Recovery can place the car just *past* its gate (never far past it). If
    // it is within the tolerance, the gate is valid; otherwise it must be
    // crossed again, so a respawn can never skip a checkpoint.
    const ahead = (s - cp + len) % len;
    if (ahead <= 2) this.collectCheckpoint();
  }

  private collectCheckpoint() {
    const cps = this.track.checkpoints;
    const idx = this.nextCheckpoint;
    this.totalCheckpoints++;
    if (idx === 0) {
      // Start/finish line. The very first crossing at launch only arms the
      // race and resets the lap clock; later crossings complete a lap.
      if (this.totalCheckpoints === 1) {
        this.lapStartTime = this.time;
        this.splits = [];
      } else {
        this.completeLap();
      }
      this.nextCheckpoint = 1 % cps.length;
      return;
    }
    this.splits.push(this.time - this.lapStartTime);
    this.scoring.onCheckpoint(idx);
    this.boost.charge(10);
    this.emit("checkpoint", idx);
    this.nextCheckpoint = (idx + 1) % cps.length;
  }

  private completeLap() {
    const lapTime = this.time - this.lapStartTime;
    const best = this.bestLap;
    this.lapTimes.push(lapTime);
    this.lastLapSplits = this.splits.slice();
    this.lap++;
    this.scoring.onLap(this.lap, lapTime, best);
    this.emit("lap", this.lap);
    this.splits = [];
    this.lapStartTime = this.time;
    this.lapDistance = 0;
    if (this.lap >= this.lapsToRun) this.finish();
  }

  private finish() {
    this.phase = "finished";
    this.boost.stop();
    this.emit("finish");
    const bestLap = this.bestLap ?? this.time;
    const timeBonus = Math.max(0, this.lapsToRun * 300 - this.time * 4) * 10;
    this.result = {
      totalTime: this.time,
      laps: this.lapTimes.map((t, i) => ({ index: i + 1, time: t, splits: i === this.lapTimes.length - 1 ? this.lastLapSplits : [] })),
      bestLap,
      stunts: { ...this.scoring.summary },
      topSpeed: this.topSpeed,
      crashes: this.crashes,
      recoveries: this.recoveries,
      finalScore: Math.round(this.scoring.summary.score + timeBonus),
      valid: this.lapTimes.length === this.lapsToRun,
    };
  }
}

/**
 * Forward crossing of a loop gate.
 *
 * The car moves from `prev` to `now` (both wrapped to [0, L)). They are
 * unwrapped to the shortest arc, then the gate is tested against it with a
 * small slack so a car that stops exactly on a gate still triggers it.
 */
export function crossedForward(prev: number, now: number, gate: number, len: number): boolean {
  let b = prev;
  let a = now;
  if (a - b > len / 2) b += len;
  else if (b - a > len / 2) a += len;
  if (a < b) return false;
  const slack = 1.5;
  return b < gate - slack && a >= gate - slack;
}
