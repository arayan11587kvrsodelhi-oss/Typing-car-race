import type { EnvPalette, SpriteKind } from "./environments";
import type { RaceDistance } from "./types";

export const SEGMENT_LENGTH = 200;
export const ROAD_WIDTH = 2000; // half width in world units
export const RUMBLE_LENGTH = 3;
export const LANES = 4;
export const LANE_X = [-0.75, -0.25, 0.25, 0.75];
export const CAR_WORLD_WIDTH = 520;

export const DISTANCE_SEGMENTS: Record<RaceDistance, number> = { sprint: 1300, circuit: 2500, marathon: 4200 };
export const DISTANCE_LABEL: Record<RaceDistance, string> = { sprint: "Sprint", circuit: "Circuit", marathon: "Marathon" };
export const DISTANCE_BLURB: Record<RaceDistance, string> = {
  sprint: "~45 s dash",
  circuit: "~75 s race",
  marathon: "~2.5 min grind",
};

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface ProjPoint {
  world: Vec3;
  camera: Vec3;
  screen: { x: number; y: number; w: number; scale: number };
}
export interface RoadSprite {
  kind: SpriteKind;
  offset: number; // in units of ROAD_WIDTH; negative = left
  variant: number;
}
export interface Segment {
  index: number;
  p1: ProjPoint;
  p2: ProjPoint;
  curve: number;
  sprites: RoadSprite[];
  colorIdx: number;
  clip: number;
  fog: number;
  looped: boolean;
  finish: boolean;
  start: boolean;
}
export interface Track {
  segments: Segment[];
  length: number; // total world length (including run-off after the finish)
  finishZ: number;
  raceSegments: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeIn = (a: number, b: number, p: number) => a + (b - a) * Math.pow(p, 2);
const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

const LEN = { SHORT: 25, MEDIUM: 50, LONG: 100 };
const HILL = { LOW: 20, MEDIUM: 40, HIGH: 60 };
const CURVE = { EASY: 2, MEDIUM: 4, HARD: 6 };

function makePoint(y: number, z: number): ProjPoint {
  return { world: { x: 0, y, z }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } };
}

export function buildTrack(distance: RaceDistance, env: EnvPalette, seed: number): Track {
  const rnd = mulberry32(seed);
  const segments: Segment[] = [];
  const raceSegments = DISTANCE_SEGMENTS[distance];

  const lastY = () => (segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y);

  const addSegment = (curve: number, y: number) => {
    const n = segments.length;
    segments.push({
      index: n,
      p1: makePoint(lastY(), n * SEGMENT_LENGTH),
      p2: makePoint(y, (n + 1) * SEGMENT_LENGTH),
      curve,
      sprites: [],
      colorIdx: Math.floor(n / RUMBLE_LENGTH) % 2,
      clip: 0,
      fog: 1,
      looped: false,
      finish: false,
      start: false,
    });
  };

  const addRoad = (enter: number, hold: number, leave: number, curve: number, y: number) => {
    const startY = lastY();
    const endY = startY + Math.round(y) * SEGMENT_LENGTH;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  };

  const addStraight = (num = LEN.MEDIUM) => addRoad(num, num, num, 0, 0);
  const addHill = (num = LEN.MEDIUM, height = HILL.MEDIUM) => addRoad(num, num, num, 0, height);
  const addCurve = (num = LEN.MEDIUM, curve = CURVE.MEDIUM, height = 0) => addRoad(num, num, num, curve, height);
  const addSCurves = () => {
    addRoad(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, -CURVE.EASY, 0);
    addRoad(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, CURVE.MEDIUM, HILL.LOW);
    addRoad(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, CURVE.EASY, -HILL.LOW);
    addRoad(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, -CURVE.EASY, HILL.LOW);
  };
  const addBumps = () => {
    addRoad(10, 10, 10, 0, 5);
    addRoad(10, 10, 10, 0, -2);
    addRoad(10, 10, 10, 0, -5);
    addRoad(10, 10, 10, 0, 8);
    addRoad(10, 10, 10, 0, 5);
    addRoad(10, 10, 10, 0, -7);
  };
  const addDownhillToFlat = (num = LEN.LONG) => {
    const y = lastY() / SEGMENT_LENGTH;
    if (Math.abs(y) > 1) addRoad(num, num, num, (rnd() < 0.5 ? -1 : 1) * CURVE.EASY, -y);
  };

  // Opening straight so the first sentence starts on a clean, easy stretch.
  addStraight(LEN.SHORT);

  const sections = [
    () => addStraight(LEN.SHORT + Math.floor(rnd() * LEN.MEDIUM)),
    () => addCurve(LEN.MEDIUM, (rnd() < 0.5 ? -1 : 1) * CURVE.EASY, rnd() < 0.5 ? HILL.LOW : 0),
    () => addCurve(LEN.MEDIUM, (rnd() < 0.5 ? -1 : 1) * CURVE.MEDIUM, rnd() < 0.3 ? -HILL.LOW : 0),
    () => addCurve(LEN.SHORT, (rnd() < 0.5 ? -1 : 1) * CURVE.HARD, 0),
    () => addHill(LEN.MEDIUM, rnd() < 0.5 ? HILL.MEDIUM : -HILL.MEDIUM),
    () => addHill(LEN.LONG, rnd() < 0.5 ? HILL.HIGH : -HILL.HIGH),
    addSCurves,
    addBumps,
    () => addDownhillToFlat(LEN.LONG),
  ];

  while (segments.length < raceSegments - 150) {
    sections[Math.floor(rnd() * sections.length)]();
    if (Math.abs(lastY()) > HILL.HIGH * SEGMENT_LENGTH * 1.5) addDownhillToFlat(LEN.LONG);
  }
  addDownhillToFlat(LEN.MEDIUM);
  addStraight(LEN.MEDIUM);

  const finishIndex = segments.length;
  const finishZ = finishIndex * SEGMENT_LENGTH;
  // run-off after the finish so the horizon stays full as the player crosses the line
  addStraight(LEN.LONG);
  addCurve(LEN.LONG, CURVE.EASY, 0);
  addStraight(LEN.LONG);

  for (let i = finishIndex - 4; i < finishIndex; i++) segments[i].finish = true;
  for (let i = 2; i < 5; i++) segments[i].start = true;
  segments[6].sprites.push({ kind: "gantryStart", offset: 0, variant: 0 });
  segments[finishIndex].sprites.push({ kind: "gantryFinish", offset: 0, variant: 0 });

  /* ---- scenery ---- */
  const total = segments.length;
  for (let i = 12; i < total; i += 24) {
    segments[i].sprites.push({ kind: "lamp", offset: i % 48 === 12 ? -1.25 : 1.25, variant: 0 });
  }
  for (let i = 10; i < total; i += 90 + Math.floor(rnd() * 60)) {
    if (i === finishIndex || Math.abs(i - 6) < 8) continue;
    segments[i].sprites.push({ kind: "billboard", offset: rnd() < 0.5 ? -1.8 : 1.8, variant: Math.floor(rnd() * 6) });
  }
  const scenery = env.scenery;
  for (let i = 8; i < total; i += 3 + Math.floor(rnd() * 6)) {
    const seg = segments[i];
    const kind = scenery[Math.floor(rnd() * scenery.length)];
    const side = rnd() < 0.5 ? -1 : 1;
    const dist = kind === "building" ? 2.6 + rnd() * 2.5 : 1.5 + rnd() * 3.2;
    seg.sprites.push({ kind, offset: side * dist, variant: Math.floor(rnd() * 3) });
    if (rnd() < 0.35) {
      const kind2 = scenery[Math.floor(rnd() * scenery.length)];
      seg.sprites.push({ kind: kind2, offset: -side * (1.6 + rnd() * 3), variant: Math.floor(rnd() * 3) });
    }
  }
  // cones and barriers on the outside of hard curves
  for (let i = 0; i < total; i += 6) {
    const seg = segments[i];
    if (Math.abs(seg.curve) >= CURVE.HARD - 0.5) {
      seg.sprites.push({ kind: i % 12 === 0 ? "barrier" : "cone", offset: seg.curve > 0 ? -1.12 : 1.12, variant: 0 });
    }
  }

  return { segments, length: total * SEGMENT_LENGTH, finishZ, raceSegments };
}

export function findSegment(track: Track, z: number): Segment {
  const n = track.segments.length;
  return track.segments[((Math.floor(z / SEGMENT_LENGTH) % n) + n) % n];
}

export function percentRemaining(n: number, total: number) {
  return (n % total) / total;
}

export function exponentialFog(distance: number, density: number) {
  return 1 / Math.pow(Math.E, distance * distance * density);
}
