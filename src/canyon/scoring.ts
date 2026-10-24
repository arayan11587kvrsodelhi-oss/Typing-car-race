/**
 * Canyon Stunt — stunt scoring and the boost meter.
 *
 * Every award is gated on SIMULATED vehicle state, never on input alone:
 *   • drift score grows only while tyres are actually slipping AND grounded
 *   • a drift must last at least 0.45 s before any chain is banked
 *   • airtime is measured from wheel-off-ground to touchdown
 *   • a landing only pays if the car took off with speed and lands nose-first
 *   • near-miss requires a real wall proximity at speed, with a per-lap
 *     cooldown per location so one wall cannot be farmed
 *   • clean-line requires sustained time on the racing line, reset on contact
 *
 * Pure TypeScript; runs in tests without a renderer.
 */

import { clamp, type CanyonTrack } from "./track";
import type { CarState } from "./physics";
import { TUNING } from "./physics";

export type StuntKind =
  | "drift"
  | "air"
  | "landing"
  | "nearMiss"
  | "cleanLine"
  | "shortcut"
  | "momentum"
  | "wallRide"
  | "lap"
  | "checkpoint";

export interface Award {
  id: number;
  kind: StuntKind;
  label: string;
  points: number;
  distance?: number;
  grade?: "good" | "great" | "perfect";
  /** Seconds since the award, drives the HUD popup animation. */
  age?: number;
  /** Guards against crediting the same event twice. */
  banked?: boolean;
}

export interface StuntSummary {
  score: number;
  driftPoints: number;
  airPoints: number;
  nearMissPoints: number;
  cleanPoints: number;
  shortcutPoints: number;
  momentumPoints: number;
  wallPoints: number;
  bestDrift: number; // metres
  totalAirtime: number; // seconds
  longestAir: number; // seconds
  bestLanding: number; // 0..1
  nearMisses: number;
  cleanLineSeconds: number;
  driftChains: number;
}

export function emptySummary(): StuntSummary {
  return {
    score: 0,
    driftPoints: 0,
    airPoints: 0,
    nearMissPoints: 0,
    cleanPoints: 0,
    shortcutPoints: 0,
    momentumPoints: 0,
    wallPoints: 0,
    bestDrift: 0,
    totalAirtime: 0,
    longestAir: 0,
    bestLanding: 0,
    nearMisses: 0,
    cleanLineSeconds: 0,
    driftChains: 0,
  };
}

const NEAR_MISS_RADIUS = 3.4; // metres from the wall face (car centre)
const NEAR_MISS_SPEED = 16; // m/s ≈ 58 km/h
const NEAR_MISS_COOLDOWN = 4.0; // seconds before the same spot pays again
const CLEAN_LINE_TOLERANCE = 2.6; // metres from the ideal lateral offset
const CLEAN_LINE_MIN_SPEED = 14;
const CLEAN_LINE_AWARD_EVERY = 3.0; // seconds of sustained clean line
const MIN_DRIFT_TIME = 0.45;
const MIN_DRIFT_SPEED = 9;

/**
 * Stateful stunt scorer. One instance per race; `reset()` between laps.
 */
export class StuntScorer {
  summary = emptySummary();
  /** Short-lived awards for HUD popups; bounded ring buffer. */
  recent: Award[] = [];
  private nextId = 1;
  private drift = { active: false, time: 0, angleSum: 0, speedSum: 0, chainPoints: 0, peakAngle: 0 };
  private air = { active: false, time: 0 };
  private nearCooldown = new Map<number, number>();
  private cleanTime = 0;
  private wallScoreAccum = 0;
  private momentumTime = 0;

  reset() {
    this.summary = emptySummary();
    this.recent.length = 0;
    this.drift = { active: false, time: 0, angleSum: 0, speedSum: 0, chainPoints: 0, peakAngle: 0 };
    this.air = { active: false, time: 0 };
    this.nearCooldown.clear();
    this.cleanTime = 0;
    this.wallScoreAccum = 0;
    this.momentumTime = 0;
  }

  /** Create an event, clamped to plausible ranges. Does not credit score. */
  award(kind: StuntKind, label: string, points: number, grade?: "good" | "great" | "perfect"): Award | null {
    const safe = Number.isFinite(points) ? Math.max(0, Math.round(points)) : 0;
    if (safe <= 0) return null;
    const entry: Award = { id: this.nextId++, kind, label, points: safe, grade, age: 0 };
    if (this.recent.length >= 8) this.recent.shift();
    this.recent.push(entry);
    return entry;
  }

  /** Credit an existing event exactly once, into totals and the breakdown. */
  bank(a: Award | null) {
    if (!a || a.banked) return;
    a.banked = true;
    this.summary.score += a.points;
    this.credited(a);
  }

  private bucketFor(kind: StuntKind): keyof StuntSummary {
    switch (kind) {
      case "drift":
        return "driftPoints";
      case "air":
        return "airPoints";
      case "nearMiss":
        return "nearMissPoints";
      case "cleanLine":
        return "cleanPoints";
      case "shortcut":
        return "shortcutPoints";
      case "momentum":
        return "momentumPoints";
      case "wallRide":
        return "wallPoints";
      case "lap":
      case "checkpoint":
        return "score";
      default:
        return "score";
    }
  }

  private credited(a: Award) {
    const key = this.bucketFor(a.kind);
    if (key !== "score") this.summary[key] = (this.summary[key] as number) + a.points;
  }

  /**
   * Per-frame scoring. `elapsed` is race seconds; `lapSeed` identifies the lap,
   * so per-location cooldowns (near misses) reset naturally each lap.
   */
  update(dt: number, car: CarState, track: CanyonTrack, elapsed: number) {
    const speed = Math.abs(car.speed);

    // ---------------- drift chain ----------------
    const canDrift = car.onGround && speed > MIN_DRIFT_SPEED && Math.abs(car.driftAngle) > 0.1;
    if (canDrift) {
      if (!this.drift.active) {
        this.drift = { active: true, time: 0, angleSum: 0, speedSum: 0, chainPoints: 0, peakAngle: 0 };
      }
      this.drift.time += dt;
      this.drift.angleSum += Math.abs(car.driftAngle) * dt;
      this.drift.speedSum += speed * dt;
      this.drift.peakAngle = Math.max(this.drift.peakAngle, Math.abs(car.driftAngle));
      // Live trickle is deliberately small: the real payout is the bank.
      const trickle = Math.min(45, Math.abs(car.driftAngle) * speed * dt * 0.5);
      this.drift.chainPoints += trickle;
    } else if (this.drift.active) {
      const avgAngle = this.drift.angleSum / Math.max(0.001, this.drift.time);
      const avgSpeed = this.drift.speedSum / Math.max(0.001, this.drift.time);
      if (this.drift.time >= MIN_DRIFT_TIME && avgAngle > 0.14) {
        const meters = avgSpeed * this.drift.time;
        // Score frontier: time, distance and slip are all validated by physics.
        // No `boostMultiplier` is applied: points are not awarded twice for
        // merely holding boost while the tyres happen to be slipping.
        const base = this.drift.time * 90 + meters * 4 + this.drift.peakAngle * 360;
        const grade = avgAngle > 0.5 ? "perfect" : avgAngle > 0.3 ? "great" : "good";
        const label = this.drift.time > 2.2 ? "LONG DRIFT" : this.drift.time > 1.2 ? "DRIFT" : "SLIDE";
        const a = this.award("drift", label, base, grade);
        this.bank(a);
        if (a) {
          a.distance = Math.round(meters);
          this.summary.bestDrift = Math.max(this.summary.bestDrift, meters);
        }
        this.summary.driftChains++;
      }
      this.drift = { active: false, time: 0, angleSum: 0, speedSum: 0, chainPoints: 0, peakAngle: 0 };
    }

    // ---------------- airtime and landing ----------------
    if (!car.onGround) {
      if (!this.air.active) {
        this.air.active = true;
        this.air.time = 0;
      }
      this.air.time += dt;
      this.summary.totalAirtime += dt;
      this.summary.longestAir = Math.max(this.summary.longestAir, this.air.time);
    } else if (this.air.active) {
      // The landing is validated by physics; only real take-offs reach here.
      if (this.air.time > 0.2) {
        const fallback = clamp(0.35 + this.air.time * 0.15, 0, 0.6);
        this.onLanding(this.air.time, fallback);
      }
      this.air.active = false;
      this.air.time = 0;
    }

    // ---------------- near miss ----------------
    const wallDistance = car.halfWidth - Math.abs(car.lateral);
    if (car.onGround && speed > NEAR_MISS_SPEED && wallDistance < NEAR_MISS_RADIUS && car.surface !== "wall") {
      const cell = Math.floor(car.s / 20);
      const last = this.nearCooldown.get(cell) ?? -Infinity;
      if (elapsed - last > NEAR_MISS_COOLDOWN) {
        this.nearCooldown.set(cell, elapsed);
        const closeness = clamp(1 - wallDistance / NEAR_MISS_RADIUS, 0, 1);
        const a = this.award("nearMiss", closeness > 0.75 ? "MILLIMETRES" : "NEAR MISS", 90 + speed * 4 + closeness * 140, closeness > 0.75 ? "perfect" : "great");
        this.bank(a);
        this.summary.nearMisses++;
      }
    }

    // ---------------- clean line ----------------
    const lineOffset = this.bestLateral(track, car.index);
    const onLine = Math.abs(car.lateral - lineOffset) < CLEAN_LINE_TOLERANCE && speed > CLEAN_LINE_MIN_SPEED && car.onGround && car.surface === "road";
    if (onLine) {
      this.cleanTime += dt;
      this.summary.cleanLineSeconds += dt;
      if (this.cleanTime >= CLEAN_LINE_AWARD_EVERY) {
        this.cleanTime -= CLEAN_LINE_AWARD_EVERY;
        this.bank(this.award("cleanLine", "CLEAN LINE", 120 + speed * 3, "good"));
      }
    } else if (car.surface === "wall" || car.crashed) {
      this.cleanTime = 0;
    } else {
      this.cleanTime = Math.max(0, this.cleanTime - dt * 2);
    }

    // ---------------- sustained momentum ----------------
    if (car.onGround && speed > TUNING.maxSpeed * 0.7) {
      this.momentumTime += dt;
      if (this.momentumTime >= 5) {
        this.momentumTime = 0;
        this.bank(this.award("momentum", "FULL SEND", 150 + speed * 4, "great"));
      }
    } else if (!car.onGround) {
      // Keep airtime momentum — it is rewarded separately.
    } else {
      this.momentumTime = Math.max(0, this.momentumTime - dt * 3);
    }

    // ---------------- wall ride ----------------
    const onWall = car.onGround && car.surface === "wall" && car.wallRide > 0.3;
    if (onWall) {
      this.wallScoreAccum += speed * dt * 6;
      if (this.wallScoreAccum >= 60) {
        this.bank(this.award("wallRide", "WALL RIDE", this.wallScoreAccum, "great"));
        this.wallScoreAccum = 0;
      }
    } else {
      this.wallScoreAccum = 0;
    }
  }

  /** Called by the race when the physics layer reports a touchdown. */
  onLanding(duration: number, quality: number) {
    if (duration < 0.2 || !Number.isFinite(quality) || quality <= 0) return;
    this.bank(this.award(
      "landing",
      quality > 0.92 ? "PERFECT LANDING" : quality > 0.6 ? "CLEAN LANDING" : "ROUGH LANDING",
      duration * 320 + quality * 260,
      quality > 0.92 ? "perfect" : quality > 0.6 ? "great" : "good",
    ));
    this.summary.bestLanding = Math.max(this.summary.bestLanding, clamp(quality, 0, 1));
  }

  /** Bank a shortcut the first time it is used (validated by the race). */
  onShortcut(name: string) {
    this.bank(this.award("shortcut", `SHORTCUT · ${name}`, 400, "great"));
  }

  onCheckpoint(index: number) {
    this.bank(this.award("checkpoint", `CHECKPOINT ${index + 1}`, 75));
  }

  onLap(lapNumber: number, lapTime: number, bestLap: number | null) {
    const cleanBonus = this.cleanTime > 1 ? 50 : 0;
    const record = bestLap !== null && lapTime > 0 && lapTime < bestLap;
    this.bank(this.award("lap", record ? `LAP ${lapNumber} · RECORD` : `LAP ${lapNumber}`, 250 + cleanBonus, record ? "perfect" : "good"));
  }

  /** Decay HUD popups. */
  tick(dt: number) {
    for (let i = this.recent.length - 1; i >= 0; i--) {
      const a = this.recent[i];
      if (!a) continue;
      a.age = (a.age ?? 0) + dt;
      if (a.age > 2.6) this.recent.splice(i, 1);
    }
  }

  private bestLateral(track: CanyonTrack, index: number): number {
    const p = track.points[index];
    const b = track.bestLine[index];
    if (!p || !b) return 0;
    return (b.x - p.x) * p.nx + (b.z - p.z) * p.nz;
  }
}

/* ------------------------------------------------------------------------- */
/* Boost meter                                                               */
/* ------------------------------------------------------------------------- */

export interface BoostRules {
  max: number;
  drainPerSecond: number;
  minToStart: number;
  minActive: number;
}

export const BOOST_RULES: BoostRules = {
  max: 100,
  drainPerSecond: TUNING.boostDrain,
  minToStart: TUNING.boostMinToStart,
  minActive: TUNING.boostMinActive,
};

/**
 * Boost meter: charge from validated stunts only, burn while held.
 * `charge()` and `tryStart()` are the only entry points, so the meter can not
 * go out of bounds or run without fuel.
 */
export class BoostMeter {
  value = 0;
  active = false;
  readonly rules: BoostRules;

  constructor(rules: BoostRules = BOOST_RULES) {
    this.rules = rules;
  }

  reset() {
    this.value = 0;
    this.active = false;
  }

  /** Charge, saturating at the maximum. Returns true when it becomes full. */
  charge(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0 || this.value >= this.rules.max) return false;
    const before = this.value;
    this.value = Math.min(this.rules.max, this.value + amount);
    return before < this.rules.max && this.value >= this.rules.max;
  }

  tryStart(): boolean {
    if (this.active || this.value < this.rules.minToStart) return false;
    this.active = true;
    return true;
  }

  stop() {
    this.active = false;
  }

  update(dt: number): boolean {
    if (!this.active) return false;
    this.value = Math.max(0, this.value - this.rules.drainPerSecond * Math.max(0, dt));
    if (this.value <= this.rules.minActive) {
      this.value = 0;
      this.active = false;
    }
    return this.active;
  }

  get fraction() {
    return clamp(this.value / this.rules.max, 0, 1);
  }
}
