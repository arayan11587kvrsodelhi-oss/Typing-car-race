/**
 * Canyon Stunt — vehicle simulation.
 *
 * A small, deterministic arcade model:
 *   • speed along the car axis, with acceleration / braking / reverse
 *   • yaw rate from a velocity-aware steering model, with a separate grip cap
 *   • handbrake drift: yaw rate is amplified while tyre grip stays low, so the
 *     velocity vector lags the nose and produces a measurable drift angle
 *   • ballistic jumps with a landing grade
 *   • wall-ride lean on designated bowl sections
 *
 * Every car shares `TUNING`: the simulation never reads garage stats, so no
 * vehicle is faster than another in this mode.
 *
 * Pure TypeScript (no Three.js/DOM) so rules can be unit-tested in Node.
 */

import {
  buildCanyonCollision,
  clamp,
  createCanyonTrack,
  inZone,
  lateralOffset,
  surfaceYAt,
  shortestAngle,
  type CanyonPoint,
  type CanyonTrack,
  type TrimeshData,
  type Vec2,
} from "./track";

/** Shared performance envelope — identical for every garage car. */
export const TUNING = {
  maxSpeed: 58, // m/s ≈ 209 km/h
  boostSpeed: 76, // m/s ≈ 274 km/h
  reverseSpeed: 11,
  accel: 15.5,
  brake: 34,
  reverseAccel: 9,
  rollingDrag: 0.055, // fractional drag per second
  coastDrag: 1.8, // m/s² engine braking with no pedal
  steerRate: 1.85, // rad/s at low speed
  highSpeedSteer: 0.55, // fraction of authority lost at top speed
  gripLat: 21, // m/s² lateral grip with assist on
  gripLatHard: 13.5, // m/s² lateral grip with assist off
  driftGripLat: 11,
  driftYawBoost: 1.6,
  driftScrub: 0.06,
  maxOffroad: 24,
  offroadDrag: 6,
  wallFriction: 0.42,
  wallBounce: 0.18,
  wallCrash: 15, // m/s of inward speed that counts as a crash
  gravity: 20,
  radius: 0.9,
  boostDrain: 26, // % per second while boosting
  boostMinToStart: 18, // % required to fire
  boostMinActive: 0.6, // % required to keep burning
} as const;

export interface CarInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1 (negative = left)
  handbrake: boolean;
  boost: boolean;
}

export const EMPTY_INPUT: CarInput = Object.freeze({ throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false });

export type SurfaceKind = "road" | "dirt" | "wall";

export interface CarState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Heading in XZ. Cars face +z at heading 0; forward = (sin h, cos h). */
  heading: number;
  /** Signed speed along the nose. */
  speed: number;
  onGround: boolean;
  airtime: number;
  airMaxHeight: number;
  /** Normal-impact speed of the last collision (decays). */
  impact: number;
  crashed: boolean;
  surface: SurfaceKind;
  /** +1 = touching the road's left edge, -1 = right edge. */
  wallSide: 1 | -1;
  /** Inward normal of the last wall contact (world space). */
  normalX: number;
  normalY: number;
  normalZ: number;
  /** Pendulum lean while wall-riding, radians. */
  wallRide: number;
  /** Distance travelled along the circuit, wrapped to the loop. */
  s: number;
  halfWidth: number;
  bank: number;
  grip: number;
  lateral: number;
  /** Signed slip angle in radians: velocity direction minus heading. */
  driftAngle: number;
  drifting: boolean;
  /** Speed when the car last left the ground, for landing validation. */
  takeoffSpeed: number;
  /** Body springs (read by the presentation layer). */
  pitch: number;
  pitchVel: number;
  roll: number;
  rollVel: number;
  heave: number;
  heaveVel: number;
  steerVisual: number;
  boostVisual: number;
  /** Distance covered in the last step (metres). */
  step: number;
  /** Centreline sample index used this frame. */
  index: number;
}

export interface StepEvents {
  landed: boolean;
  landingQuality: number;
  crash: boolean;
  impact: number;
  wall: boolean;
  inAir: boolean;
  airHeight: number;
}

export function emptyEvents(): StepEvents {
  return { landed: false, landingQuality: 0, crash: false, impact: 0, wall: false, inAir: false, airHeight: 0 };
}

interface Smoothed {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

let _collisionCache: { points: CanyonPoint[]; mesh: TrimeshData } | null = null;
/** Collision mesh for a track (built once per track instance). */
export function collisionMeshFor(track: CanyonTrack): TrimeshData {
  if (_collisionCache && _collisionCache.points === track.points) return _collisionCache.mesh;
  const mesh = buildCanyonCollision(track);
  _collisionCache = { points: track.points, mesh };
  return mesh;
}

export class CanyonCar {
  readonly track: CanyonTrack;
  readonly state: CarState;
  private smoothed: Smoothed = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  private stuckTimer = 0;

  constructor(track: CanyonTrack = createCanyonTrack()) {
    this.track = track;
    this.state = this.spawnState();
  }

  spawnState(): CarState {
    const { startPos, startHeading } = this.track;
    const p = this.pointAt(startPos.x, startPos.z);
    const lat = lateralOffset(p, startPos.x, startPos.z);
    return {
      x: startPos.x,
      y: surfaceYAt(p, lat),
      z: startPos.z,
      vx: 0,
      vy: 0,
      vz: 0,
      heading: startHeading,
      speed: 0,
      onGround: true,
      airtime: 0,
      airMaxHeight: 0,
      impact: 0,
      crashed: false,
      surface: "road",
      wallSide: 1,
      normalX: 0,
      normalY: 1,
      normalZ: 0,
      wallRide: 0,
      s: p.s,
      halfWidth: p.halfWidth,
      bank: p.bank,
      grip: p.grip,
      lateral: lat,
      driftAngle: 0,
      drifting: false,
      takeoffSpeed: 0,
      pitch: 0,
      pitchVel: 0,
      roll: 0,
      rollVel: 0,
      heave: 0,
      heaveVel: 0,
      steerVisual: 0,
      boostVisual: 0,
      step: 0,
      index: this.trackIndex(p.s),
    };
  }

  /** Put the car on the racing surface facing down the track. */
  reset(pos: Vec2 = this.track.startPos, heading = this.track.startHeading, speed = 0): void {
    const st = this.state;
    const p = this.pointAt(pos.x, pos.z);
    const lat = lateralOffset(p, pos.x, pos.z);
    st.x = pos.x;
    st.z = pos.z;
    st.y = surfaceYAt(p, lat);
    st.vx = Math.sin(heading) * speed;
    st.vz = Math.cos(heading) * speed;
    st.vy = 0;
    st.speed = speed;
    st.heading = heading;
    st.onGround = true;
    st.airtime = 0;
    st.airMaxHeight = 0;
    st.impact = 0;
    st.crashed = false;
    st.surface = "road";
    st.wallSide = 1;
    st.normalX = 0;
    st.normalY = 1;
    st.normalZ = 0;
    st.wallRide = 0;
    st.s = p.s;
    st.index = this.trackIndex(p.s);
    st.halfWidth = p.halfWidth;
    st.bank = p.bank;
    st.grip = p.grip;
    st.lateral = lat;
    st.driftAngle = 0;
    st.drifting = false;
    st.takeoffSpeed = speed;
    st.pitch = st.pitchVel = 0;
    st.roll = st.rollVel = 0;
    st.heave = st.heaveVel = 0;
    st.steerVisual = 0;
    st.boostVisual = 0;
    st.step = 0;
    this.smoothed = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.stuckTimer = 0;
  }

  /** Closest road sample to a world position (local search, with loop wrap). */
  pointAt(x: number, z: number): CanyonPoint {
    const pts = this.track.points;
    const n = pts.length;
    const st = this.state;
    let best = st && Number.isFinite(st.index) ? st.index : 0;
    let bestD = Infinity;
    for (let k = -8; k <= 8; k++) {
      const i = (best + k + n) % n;
      const p = pts[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (bestD > 80 * 80) {
      // Recover from a teleport (respawn elsewhere on the circuit).
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    const p = pts[best];
    const ahead = pts[(best + 1) % n];
    const segX = ahead.x - p.x;
    const segZ = ahead.z - p.z;
    const segLen2 = segX * segX + segZ * segZ || 1;
    const t = clamp(((x - p.x) * segX + (z - p.z) * segZ) / segLen2, 0, 1);
    if (t <= 0.0001) return p;
    return {
      s: p.s + t * this.track.step,
      x: p.x + segX * t,
      z: p.z + segZ * t,
      y: p.y + (ahead.y - p.y) * t,
      tx: p.tx + (ahead.tx - p.tx) * t,
      tz: p.tz + (ahead.tz - p.tz) * t,
      nx: p.nx + (ahead.nx - p.nx) * t,
      nz: p.nz + (ahead.nz - p.nz) * t,
      halfWidth: p.halfWidth + (ahead.halfWidth - p.halfWidth) * t,
      bank: p.bank + (ahead.bank - p.bank) * t,
      grip: p.grip + (ahead.grip - p.grip) * t,
    };
  }

  trackIndex(s: number): number {
    const n = this.track.points.length;
    return ((Math.round(s / this.track.step) % n) + n) % n;
  }

  /**
   * Advance the car by `dt` seconds.
   *
   * XZ motion uses exact segment collision against both walls and reflects
   * velocity, so a car can never leave the canyon. The step is clamped to
   * 1/30 s: full boost moves ~2.5 m per tick, far less than the 4 m spacing
   * of collision samples.
   */
  step(dtRaw: number, input: CarInput, opts: { assist: boolean; boostActive: boolean }): StepEvents {
    const ev = emptyEvents();
    const st = this.state;
    const dt = clamp(dtRaw, 0, 1 / 30);
    if (dt <= 0) return ev;
    const wasGrounded = st.onGround;
    const prevSpeed = st.speed;

    // ---------------- smoothed controls ----------------
    const sm = this.smoothed;
    const steerTarget = clamp(input.steer, -1, 1);
    const steerRate = Math.abs(steerTarget) > Math.abs(sm.steer) ? 4.2 : 7.5;
    sm.steer += clamp(steerTarget - sm.steer, -steerRate * dt, steerRate * dt);
    sm.throttle += clamp(clamp(input.throttle, 0, 1) - sm.throttle, -8 * dt, 6 * dt);
    sm.brake += clamp(clamp(input.brake, 0, 1) - sm.brake, -10 * dt, 10 * dt);
    sm.handbrake = input.handbrake;

    const speed = st.speed;
    const absSpeed = Math.abs(speed);
    const handbrake = sm.handbrake && wasGrounded && absSpeed > 5;
    const boosting = opts.boostActive && wasGrounded;

    // ---------------- longitudinal ----------------
    const top = boosting ? TUNING.boostSpeed : st.surface === "dirt" ? TUNING.maxOffroad : TUNING.maxSpeed;
    let accel = 0;
    if (wasGrounded) {
      if (sm.throttle > 0 && sm.brake <= 0) {
        if (speed >= -0.15) {
          const headroom = clamp(1 - speed / top, 0, 1);
          accel += TUNING.accel * sm.throttle * (0.35 + 0.65 * headroom);
        } else {
          accel += TUNING.brake * sm.throttle;
        }
      }
      if (sm.brake > 0) {
        if (speed > 0.5) accel -= TUNING.brake * sm.brake;
        else accel -= TUNING.reverseAccel * sm.brake;
      }
      if (boosting && speed >= 0) accel += TUNING.accel * 1.7;
      const rolling = TUNING.rollingDrag * absSpeed;
      const coast = sm.throttle > 0 || sm.brake > 0 ? 0 : TUNING.coastDrag;
      accel -= Math.sign(speed) * Math.min(rolling + coast, absSpeed / dt);
      if (st.surface === "dirt" && speed > TUNING.maxOffroad) accel -= TUNING.offroadDrag;
      if (st.wallRide > 0.02) accel -= 2.2 * st.wallRide;
    }
    const cap = Math.max(top, wasGrounded ? speed : 0);
    let nextSpeed = clamp(speed + accel * dt, -TUNING.reverseSpeed, cap);
    if (wasGrounded && st.surface === "dirt" && nextSpeed > TUNING.maxOffroad) {
      nextSpeed = Math.max(TUNING.maxOffroad, nextSpeed - TUNING.offroadDrag * dt);
    }

    // ---------------- steering / yaw ----------------
    const speedFactor = clamp(absSpeed / TUNING.maxSpeed, 0, 1);
    const authority = TUNING.steerRate * (1 - TUNING.highSpeedSteer * speedFactor) * clamp(absSpeed / 6, 0, 1);
    let yawRate = -sm.steer * authority * (nextSpeed >= 0 ? 1 : -1);
    if (handbrake) yawRate *= TUNING.driftYawBoost;
    if (!wasGrounded) yawRate *= 0.35;
    st.heading += yawRate * dt;

    // ---------------- velocity / tyre grip ----------------
    const fx = Math.sin(st.heading);
    const fz = Math.cos(st.heading);
    const rx = fz;
    const rz = -fx;
    const vForward = st.vx * fx + st.vz * fz;
    let vLateral = st.vx * rx + st.vz * rz;

    if (!wasGrounded) {
      // No tyre forces in the air; only the small speed blend from drag.
    } else {
      const gripLat = handbrake ? TUNING.driftGripLat : opts.assist ? TUNING.gripLat : TUNING.gripLatHard;
      vLateral -= clamp(vLateral, -gripLat * dt, gripLat * dt);
      if (Math.abs(vLateral) > 1) nextSpeed -= Math.abs(vLateral) * TUNING.driftScrub * dt;
      nextSpeed = clamp(vForward + (nextSpeed - vForward) * Math.min(1, dt * 3), -TUNING.reverseSpeed, cap);
    }

    const nfx = Math.sin(st.heading);
    const nfz = Math.cos(st.heading);
    if (wasGrounded) {
      st.vx = nfx * nextSpeed + nfz * vLateral;
      st.vz = nfz * nextSpeed - nfx * vLateral;
    } else {
      const blend = Math.min(1, dt * 0.6);
      st.vx += nfx * (nextSpeed - speed) * blend;
      st.vz += nfz * (nextSpeed - speed) * blend;
    }
    st.speed = nextSpeed;

    // ---------------- integrate XZ ----------------
    st.step = Math.hypot(st.vx, st.vz) * dt;
    st.x += st.vx * dt;
    st.z += st.vz * dt;

    // ---------------- walls ----------------
    const p = this.pointAt(st.x, st.z);
    const lat = lateralOffset(p, st.x, st.z);
    const limit = p.halfWidth - TUNING.radius;
    const hitLat = Math.abs(lat) > limit;
    if (hitLat) {
      const side: 1 | -1 = lat > 0 ? 1 : -1;
      const excess = Math.abs(lat) - limit;
      st.x -= p.nx * side * excess;
      st.z -= p.nz * side * excess;
      const nx = -p.nx * side;
      const nz = -p.nz * side;
      const into = st.vx * nx + st.vz * nz;
      st.wallSide = side;
      st.normalX = nx;
      st.normalY = 0.35;
      st.normalZ = nz;
      if (into < 0) {
        const impact = -into;
        st.vx -= (1 + TUNING.wallBounce) * into * nx;
        st.vz -= (1 + TUNING.wallBounce) * into * nz;
        st.vx *= 1 - TUNING.wallFriction;
        st.vz *= 1 - TUNING.wallFriction;
        st.impact = Math.max(st.impact, impact);
        ev.wall = true;
        ev.impact = Math.max(ev.impact, impact);
        if (impact > TUNING.wallCrash) {
          ev.crash = true;
          st.crashed = true;
        }
        // Deflect the nose back along the wall.
        const tangent = Math.atan2(p.tx, p.tz);
        st.heading += clamp(shortestAngle(st.heading, tangent), -0.22, 0.22) * clamp(impact / 10, 0, 1);
      }
      st.speed = st.vx * nfx + st.vz * nfz;
      st.surface = "wall";
    } else {
      st.normalX = 0;
      st.normalY = 1;
      st.normalZ = 0;
    }

    // ---------------- wall-ride ledge ----------------
    const wallZone = wasGrounded && hitLat ? inZone(this.track.walls, p.s) : undefined;
    const ridingWall = wallZone !== undefined && st.wallSide === this.track.wallSide;
    if (ridingWall && wallZone) {
      const t = clamp((p.s - wallZone.s0) / (wallZone.s1 - wallZone.s0), 0, 1);
      const targetRide = st.speed > 20 ? Math.sin(t * Math.PI) * 1.0 + 0.12 : 0.18;
      st.wallRide += (targetRide - st.wallRide) * Math.min(1, dt * 3.2);
      st.surface = "wall";
    } else {
      st.wallRide *= Math.max(0, 1 - dt * 2.4);
      if (st.wallRide < 0.01) st.wallRide = 0;
    }

    // ---------------- vertical / jumps ----------------
    const groundY = surfaceYAt(p, lat) + st.wallRide * 3.2;
    if (wasGrounded) {
      // Ramp launch: measure the slope the ROAD rises into AHEAD of the car.
      // A lip makes this positive, and the vertical velocity set from the
      // takeoff speed and slope carries the car off the crest. A flat road
      // always reads ~0 m/s, so there are no false jumps on bumps.
      const ahead = this.pointAt(st.x + nfx * 2.5, st.z + nfz * 2.5);
      const riseRate = ((ahead.y - p.y) / 2.5) * Math.max(0, st.speed);
      if (riseRate > 4.5 && st.speed > 12) {
        st.onGround = false;
        st.airtime = 0;
        st.airMaxHeight = 0;
        st.takeoffSpeed = Math.max(0, st.speed);
        st.vy = riseRate * 0.95;
        st.y = Math.max(st.y, groundY);
      } else {
        st.y = groundY;
        st.vy = 0;
        st.onGround = true;
        if (!hitLat) st.surface = st.grip < 0.9 ? "dirt" : "road";
      }
    }
    if (!st.onGround) {
      st.vy -= TUNING.gravity * dt;
      st.y += st.vy * dt;
      st.airtime += dt;
      st.airMaxHeight = Math.max(st.airMaxHeight, st.y - groundY);
      if (st.y <= groundY && st.vy <= 0) {
        const nose = Math.sin(st.heading) * p.tx + Math.cos(st.heading) * p.tz;
        const runOff = Math.abs(lat) > p.halfWidth + 0.4;
        const speedOk = st.takeoffSpeed > 10 && st.airtime > 0.15;
        let quality = 0;
        if (speedOk) {
          quality = 0.42 + 0.4 * Math.abs(nose) + 0.18 * (1 - Math.min(1, Math.abs(st.driftAngle)));
          if (runOff) quality -= 0.5;
          if (Math.abs(nose) < 0.55 || runOff) {
            ev.crash = true;
            st.crashed = true;
          }
          quality = clamp(quality, 0, 1);
        }
        ev.landed = speedOk;
        ev.landingQuality = quality;
        ev.impact = Math.abs(st.vy);
        if (runOff || Math.abs(nose) < 0.55) st.speed *= 0.6;
        st.y = groundY;
        st.vy = 0;
        st.onGround = true;
        st.vx = Math.sin(st.heading) * st.speed;
        st.vz = Math.cos(st.heading) * st.speed;
        st.driftAngle = 0;
        st.drifting = false;
        st.pitchVel += clamp(ev.impact * 0.02, 0, 0.5);
        st.heaveVel -= 0.08;
      }
    }
    ev.inAir = !st.onGround;
    ev.airHeight = st.onGround ? 0 : st.airMaxHeight;

    // ---------------- track progress ----------------
    st.s = p.s;
    st.index = this.trackIndex(p.s);
    st.halfWidth = p.halfWidth;
    st.bank = p.bank;
    st.grip = p.grip;
    st.lateral = lateralOffset(p, st.x, st.z);

    // Drift angle: velocity direction relative to the nose.
    if (st.onGround && Math.hypot(st.vx, st.vz) > 1.5) {
      st.driftAngle = Math.atan2(st.vx * nfz - st.vz * nfx, Math.abs(st.vx * nfx + st.vz * nfz));
    } else if (!st.onGround) {
      st.driftAngle *= Math.max(0, 1 - dt * 4);
    } else {
      st.driftAngle = 0;
    }
    st.drifting = handbrake && st.onGround && Math.abs(st.speed) > 8 && Math.abs(st.driftAngle) > 0.12;

    // ---------------- body springs ----------------
    const latAccel = nextSpeed * yawRate;
    const rollTarget = clamp(-latAccel * 0.006, -0.12, 0.12);
    st.rollVel += (rollTarget - st.roll) * 60 * dt;
    st.rollVel *= Math.exp(-9 * dt);
    st.roll += st.rollVel * dt;
    const pitchTarget = clamp(-((nextSpeed - prevSpeed) / dt) * 0.0035, -0.06, 0.05);
    st.pitchVel += (pitchTarget - st.pitch) * 70 * dt;
    st.pitchVel *= Math.exp(-10 * dt);
    st.pitch += st.pitchVel * dt;
    st.heaveVel += (0 - st.heave) * 90 * dt;
    st.heaveVel *= Math.exp(-12 * dt);
    st.heave += st.heaveVel * dt;
    st.steerVisual += (sm.steer - st.steerVisual) * Math.min(1, 12 * dt);
    st.boostVisual += ((opts.boostActive ? 1 : 0) - st.boostVisual) * Math.min(1, 5 * dt);
    st.impact = Math.max(0, st.impact - dt * 30);

    // Unstick: a car idling against a wall is nudged toward the road, so the
    // player can never be trapped in an unrecoverable state.
    if (Math.abs(st.speed) < 0.4 && hitLat) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.7) {
        st.x -= p.nx * Math.sign(lat || 1) * 0.35;
        st.z -= p.nz * Math.sign(lat || 1) * 0.35;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    return ev;
  }
}

/** Build the vehicle used by a race; cars are intentionally identical. */
export function createCanyonCar(track?: CanyonTrack): CanyonCar {
  return new CanyonCar(track);
}
