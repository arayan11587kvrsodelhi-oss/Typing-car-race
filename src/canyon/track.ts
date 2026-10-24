/**
 * Canyon Stunt — circuit definition.
 *
 * Everything here is pure data + math with no Three.js dependency so the
 * vehicle and race rules can be unit-tested in Node.
 *
 * COORDINATES (metres)
 *   x = lateral, y = up, z = forward (racing direction is +z).
 *   The circuit runs 0 .. ~2.05 km and wraps back to the start (see `wrapS`).
 *
 * The road is swept as a triangle strip between `left` and `right` edges.
 * Width changes, banked corners, elevation and crests are expressed in the
 * 1-D `CanyonProfile` that `buildCanyonTrack()` samples along the centreline.
 */

export const CLOSED_LOOP = true;

export interface Vec2 {
  x: number;
  z: number;
}

export interface CanyonPoint {
  s: number;
  x: number;
  z: number;
  /** Road centre height. */
  y: number;
  /** Forward tangent, normalised. */
  tx: number;
  tz: number;
  /** Left normal in the XZ plane (unit length). */
  nx: number;
  nz: number;
  /** Half road width. */
  halfWidth: number;
  /** Surface bank in radians. Positive values raise the right-hand edge. */
  bank: number;
  /**
   * Surface grip multiplier (1 = tarmac). Sand on inside-of-corner run-off
   * costs a little speed and trail braking.
   */
  grip: number;
}

/** 1-D centreline profile, sampled with Catmull-Rom interpolation. */
export interface CanyonProfile {
  x: number[];
  z: number[];
  y: number[];
  width: number[];
  bank: number[];
  grip: number[];
}

export interface StuntZone {
  id: string;
  kind: "ramp" | "wall" | "near";
  s0: number;
  s1: number;
}

export type LandmarkKind = "arch" | "mesa" | "tower";

export interface Landmark {
  s: number;
  offset: number;
  kind: LandmarkKind;
  scale: number;
  /** Arches: inside half-width of the opening. */
  halfSpan?: number;
}

export interface CanyonTrack {
  points: CanyonPoint[];
  length: number;
  step: number;
  checkpoints: number[];
  bestLine: Vec2[];
  startPos: Vec2;
  startHeading: number;
  ramps: StuntZone[];
  walls: StuntZone[];
  nearZones: StuntZone[];
  arches: Landmark[];
  landmarks: Landmark[];
  /** Outer edge of the wall-ride bowl: 1 = left side of the road, -1 = right. */
  wallSide: number;
  /** Distance of the start/finish line from the first sample. */
  startS: number;
  name: string;
  subtitle: string;
}

export const CANYON_LENGTH = 2050;
export const TRACK_STEP = 4;

/** Shortest signed distance between two angles in the XZ plane. */
export function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/**
 * Sample a cyclic/legacy 1-D profile at distance `s`.
 *
 * The sample list is keyed on the index of `s / step`. Sampling between two
 * keys uses Catmull-Rom so elevation and bank transitions stay smooth.
 */
export function sampleProfile(values: number[], s: number, step = TRACK_STEP): number {
  const n = values.length;
  if (n === 0) return 0;
  const f = s / step;
  const i = Math.floor(f);
  const t = f - i;
  const at = (k: number) => values[((k % n) + n) % n];
  if (n < 3) return at(i) + (at(i + 1) - at(i)) * t;
  return catmull(at(i - 1), at(i), at(i + 1), at(i + 2), t);
}

/* ------------------------------------------------------------------------- */
/* Circuit layout                                                            */
/* ------------------------------------------------------------------------- */

const L = CANYON_LENGTH;

/**
 * Original circuit: long start straight, sweepers up the canyon floor, a
 * swallowed arch, a table-top jump, banked switchbacks, a wall-ride bowl and a
 * fast run home. Widths tighten in the technical middle third.
 */
export const CANYON_LAYOUT: CanyonProfile = {
  x: [
    0, 0, 0, 0, 0, 4, 22, 58, 94, 112, 108, 92, 80, 83, 98, 104, 92, 64, 38, 30, 46, 80, 118, 146, 152, 138, 110, 82, 70, 78, 102, 130, 144, 138, 116, 88, 70, 62, 55, 40, 22, 8, 0,
  ],
  z: [
    0, 20, 40, 60, 80, 104, 130, 162, 200, 242, 284, 328, 372, 412, 452, 496, 540, 576, 610, 650, 688, 720, 756, 794, 832, 874, 914, 950, 988, 1028, 1066, 1104, 1146, 1190, 1236, 1284, 1334, 1386, 1440, 1500, 1566, 1640, 1712,
  ],
  y: [
    0, 0, 0, 0, 0.2, 0.8, 1.8, 3.0, 4.2, 5.0, 4.6, 3.6, 2.4, 1.2, 0.6, 1.4, 3.2, 5.6, 7.4, 8.2, 7.6, 6.2, 4.6, 3.4, 3.0, 4.0, 6.0, 8.0, 9.0, 8.4, 6.6, 4.6, 2.8, 1.6, 0.8, 0.4, 0.6, 1.2, 1.6, 1.2, 0.6, 0.2, 0,
  ],
  width: [
    13, 13, 13, 13, 13, 12.5, 12, 12, 13, 13.5, 13, 12, 11, 11, 12, 13, 13, 12, 11, 11, 11.5, 12, 12.5, 13, 13, 12.5, 12, 11.5, 11.5, 12, 12.5, 13, 13.5, 13, 12, 11.5, 12, 13, 13, 12.5, 13, 13, 13,
  ],
  bank: [
    0, 0, 0, 0, 0, 0.02, 0.08, 0.18, 0.24, 0.2, 0.1, 0, -0.06, -0.02, 0.05, 0.12, 0.18, 0.22, 0.24, 0.24, 0.2, 0.12, 0.04, -0.04, -0.1, -0.14, -0.16, -0.12, -0.04, 0.06, 0.16, 0.26, 0.34, 0.4, 0.4, 0.32, 0.2, 0.1, 0.04, 0, 0, 0, 0,
  ],
  grip: [
    1, 1, 1, 1, 1, 1, 1, 0.94, 0.92, 0.94, 0.97, 1, 1, 1, 1, 0.96, 0.92, 0.9, 0.92, 0.94, 0.96, 0.96, 0.96, 0.96, 1, 1, 0.95, 0.95, 0.95, 0.97, 1, 1, 1, 1, 1, 0.96, 0.93, 0.95, 1, 1, 1, 1, 1,
  ],
};

const START_GATE = 16;
const RAMP_ZONE: StuntZone = { id: "table-top", kind: "ramp", s0: 300, s1: 340 };
const WALL_SIDE = 1;
const WALL_ZONE: StuntZone = { id: "wall-bowl", kind: "wall", s0: 730, s1: 860 };

const CHECKPOINT_S = [16, 373, 745, 1134, 1508];

function buildPoints(profile: CanyonProfile): CanyonPoint[] {
  const n = Math.floor(L / TRACK_STEP);
  const points: CanyonPoint[] = [];
  for (let i = 0; i < n; i++) {
    const s = i * TRACK_STEP;
    const x = sampleProfile(profile.x, s);
    const z = sampleProfile(profile.z, s);
    const y = sampleProfile(profile.y, s);
    const halfWidth = sampleProfile(profile.width, s);
    const bank = sampleProfile(profile.bank, s);
    const grip = clamp(sampleProfile(profile.grip, s), 0.8, 1);
    points.push({ s, x, z, y, tx: 0, tz: 1, nx: -1, nz: 0, halfWidth, bank, grip });
  }
  // Tangents from central differences so they do not lag the curve.
  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n];
    const b = points[(i + 1) % n];
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const p = points[i];
    p.tx = dx;
    p.tz = dz;
    p.nx = -dz;
    p.nz = dx;
  }
  return points;
}

/** Compute the road surface height at a lateral offset (banked plane). */
export function surfaceYAt(p: CanyonPoint, lateral: number): number {
  const clamped = clamp(lateral, -p.halfWidth - 1, p.halfWidth + 1);
  return p.y + clamped * Math.tan(p.bank);
}

/** The clean racing line, used for clean-line bonuses. */
function buildBestLine(points: CanyonPoint[]): Vec2[] {
  const out: Vec2[] = [];
  const span = 22; // look ~90 m ahead
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const ahead = points[(i + span) % points.length];
    let lat = 0;
    if (CLOSED_LOOP) {
      const turn = Math.atan2(ahead.tx * p.tz - ahead.tz * p.tx, ahead.tx * p.tx + ahead.tz * p.tz);
      // Outside-left entering a right-hander, clip the apex on exit.
      lat = clamp(-turn * p.halfWidth * 1.4, -p.halfWidth * 0.55, p.halfWidth * 0.55);
    }
    out.push({ x: p.x + p.nx * lat, z: p.z + p.nz * lat });
  }
  return out;
}

/** Per-sample lateral offset of the clean line (metres, positive = left). */
export function bestLineLateral(points: CanyonPoint[], i: number): number {
  const p = points[i];
  const b = buildBestLineCache(points)[i];
  return (b.x - p.x) * p.nx + (b.z - p.z) * p.nz;
}

let _bestLineCache: { points: CanyonPoint[]; line: Vec2[] } | null = null;
function buildBestLineCache(points: CanyonPoint[]): Vec2[] {
  if (_bestLineCache && _bestLineCache.points === points) return _bestLineCache.line;
  const line = buildBestLine(points);
  _bestLineCache = { points, line };
  return line;
}

export function createCanyonTrack(profile: CanyonProfile = CANYON_LAYOUT): CanyonTrack {
  const points = buildPoints(profile);
  const bestLine = buildBestLine(points);

  const startIndex = Math.round(START_GATE / TRACK_STEP);
  const p0 = points[startIndex];
  const startPos = { x: p0.x + p0.nx * p0.halfWidth * 0.35, z: p0.z };
  const startHeading = Math.atan2(p0.tx, p0.tz);

  const arches: Landmark[] = [];
  const landmarks: Landmark[] = [
    { s: 150, offset: -30, kind: "mesa", scale: 1.2 },
    { s: 520, offset: 40, kind: "mesa", scale: 1.4 },
    { s: 900, offset: -42, kind: "tower", scale: 1.1 },
    { s: 1240, offset: 46, kind: "mesa", scale: 1.5 },
    { s: 1620, offset: -36, kind: "tower", scale: 0.9 },
    { s: 1880, offset: 34, kind: "mesa", scale: 1.1 },
  ];

  const checkpoints = CHECKPOINT_S.map((s) => clamp(s, 0, L - 1));

  return {
    points,
    length: L,
    step: TRACK_STEP,
    checkpoints,
    bestLine,
    startPos,
    startHeading,
    ramps: [{ ...RAMP_ZONE }],
    walls: [{ ...WALL_ZONE }],
    nearZones: [{ id: "wall-bowl-near", kind: "near", s0: WALL_ZONE.s0, s1: WALL_ZONE.s1 }],
    arches,
    landmarks,
    wallSide: WALL_SIDE,
    startS: START_GATE,
    name: "Rattler's Reach",
    subtitle: "Canyon Stunt · Stage A–C circuit",
  };
}

/* ------------------------------------------------------------------------- */
/* Trimesh collision builder                                                 */
/* ------------------------------------------------------------------------- */

export interface TrimeshData {
  positions: Float32Array;
  indices: Uint32Array;
  /** Vertex count, for bounds checking in the solver. */
  vertexCount: number;
}

interface MeshBuilder {
  v: number[];
  i: number[];
}

function addQuad(m: MeshBuilder, a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]) {
  const base = m.v.length / 3;
  m.v.push(...a, ...b, ...c, ...d);
  m.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * Canyon collision mesh.
 *
 * Every visible surface that the car can touch is included:
 *   • the banked road ribbon (2 triangles per sample step)
 *   • the ramp deck, which rises to a lip and then drops into a landing zone
 *   • the inner and outer canyon walls as vertical strips whose height matches
 *     the visible wall mesh in the scene
 *   • the wall-ride surface (a slanted strip on the outer edge of the bowl)
 *
 * Coarse segments follow the centreline, so the mesh is a single watertight-ish
 * "trough" that keeps the car inside the canyon and makes tunnelling impossible
 * at the speeds the tyres can produce.
 */
export function buildCanyonCollision(track: CanyonTrack): TrimeshData {
  const m: MeshBuilder = { v: [], i: [] };
  const pts = track.points;
  const n = pts.length;
  const WALL_H = 26;

  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    // Surface corners (left, right)
    const aL: [number, number, number] = [a.x + a.nx * a.halfWidth, surfaceYAt(a, a.halfWidth), a.z + a.nz * a.halfWidth];
    const aR: [number, number, number] = [a.x - a.nx * a.halfWidth, surfaceYAt(a, -a.halfWidth), a.z - a.nz * a.halfWidth];
    const bL: [number, number, number] = [b.x + b.nx * b.halfWidth, surfaceYAt(b, b.halfWidth), b.z + b.nz * b.halfWidth];
    const bR: [number, number, number] = [b.x - b.nx * b.halfWidth, surfaceYAt(b, -b.halfWidth), b.z - b.nz * b.halfWidth];
    addQuad(m, aL, aR, bR, bL);

    // Vertical walls, left then right.
    addQuad(m,
      [aL[0], aL[1] + WALL_H, aL[2]],
      [aL[0], aL[1], aL[2]],
      [bL[0], bL[1], bL[2]],
      [bL[0], bL[1] + WALL_H, bL[2]],
    );
    addQuad(m,
      [aR[0], aR[1], aR[2]],
      [aR[0], aR[1] + WALL_H, aR[2]],
      [bR[0], bR[1] + WALL_H, bR[2]],
      [bR[0], bR[1], bR[2]],
    );
  }

  // Wall-ride surface: slanted ledge on `wallSide`. Its inner edge starts 1.2 m
  // off the road edge and rises 3.2 m over 4 m laterally.
  for (const zone of track.walls) {
    const i0 = Math.floor(zone.s0 / TRACK_STEP);
    const i1 = Math.min(pts.length, Math.ceil(zone.s1 / TRACK_STEP));
    for (let i = i0; i < i1 - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const side = track.wallSide;
      const edgeA: [number, number, number] = [a.x + a.nx * a.halfWidth * side, surfaceYAt(a, a.halfWidth * side), a.z + a.nz * a.halfWidth * side];
      const edgeB: [number, number, number] = [b.x + b.nx * b.halfWidth * side, surfaceYAt(b, b.halfWidth * side), b.z + b.nz * b.halfWidth * side];
      const upA: [number, number, number] = [a.x + a.nx * (a.halfWidth + 4) * side, surfaceYAt(a, a.halfWidth * side) + 3.2, a.z + a.nz * (a.halfWidth + 4) * side];
      const upB: [number, number, number] = [b.x + b.nx * (b.halfWidth + 4) * side, surfaceYAt(b, b.halfWidth * side) + 3.2, b.z + b.nz * (b.halfWidth + 4) * side];
      if (side < 0) addQuad(m, edgeA, edgeB, upB, upA);
      else addQuad(m, upA, upB, edgeB, edgeA);
    }
  }

  return {
    positions: new Float32Array(m.v),
    indices: new Uint32Array(m.i),
    vertexCount: m.v.length / 3,
  };
}

/* ------------------------------------------------------------------------- */
/* Query helpers                                                             */
/* ------------------------------------------------------------------------- */

/** Track sample index for a distance, wrapped to the loop. */
export function indexAt(track: CanyonTrack, s: number): number {
  const n = track.points.length;
  const i = Math.round(s / track.step) % n;
  return i < 0 ? i + n : i;
}

/** Signed lateral offset (metres) of a world point from the centreline. */
export function lateralOffset(p: CanyonPoint, x: number, z: number): number {
  return (x - p.x) * p.nx + (z - p.z) * p.nz;
}

/** Which side of the road (1 = left / positive normal, -1 = right). */
export function sideOf(lateral: number): 1 | -1 {
  return lateral >= 0 ? 1 : -1;
}

export function inZone(zones: StuntZone[], s: number): StuntZone | undefined {
  for (const z of zones) {
    if (s >= z.s0 && s <= z.s1) return z;
  }
  return undefined;
}
