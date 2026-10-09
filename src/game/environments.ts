import type { EnvironmentId } from "./types";
import { baseEnvFor } from "./worlds";

export type SpriteKind =
  | "lamp"
  | "tree"
  | "palm"
  | "pine"
  | "cactus"
  | "rock"
  | "bush"
  | "billboard"
  | "building"
  | "cone"
  | "barrier"
  | "gantryStart"
  | "gantryFinish";

export interface EnvPalette {
  id: EnvironmentId;
  name: string;
  blurb: string;
  sky: [string, string, string, string]; // top -> horizon
  horizonGlow: string;
  stars: boolean;
  moon?: { x: number; y: number; r: number; color: string; glow: string };
  sun?: { x: number; y: number; r: number; color: string; glow: string; banded: boolean };
  clouds?: boolean;
  road: [string, string];
  ground: [string, string];
  rumble: [string, string];
  lane: string;
  edge: string;
  fog: string;
  fogDensity: number;
  far: { kind: "mountains" | "mesas" | "alps"; colors: [string, string] };
  mid: { kind: "city" | "dunes" | "forest"; colors: [string, string] };
  scenery: SpriteKind[];
  sceneryColors: { foliage: string; foliageLight: string; trunk: string; rock: string };
  lampLight: string;
  headlightAlpha: number;
}

export const ENVIRONMENTS: Record<string, EnvPalette> = {
  night: {
    id: "night",
    name: "Neon City",
    blurb: "Midnight highway through a glowing skyline.",
    sky: ["#03040c", "#070b1f", "#141a46", "#3b1f63"],
    horizonGlow: "#7a2d8f",
    stars: true,
    moon: { x: 0.74, y: 0.2, r: 0.045, color: "#f1f5f9", glow: "#a5b4fc" },
    road: ["#22252e", "#1f2229"],
    ground: ["#0a0d16", "#090b13"],
    rumble: ["#7f1d1d", "#9ca3af"],
    lane: "#b7bcc6",
    edge: "#d1d5db",
    fog: "#0c1024",
    fogDensity: 4.2,
    far: { kind: "mountains", colors: ["#121735", "#0a0d24"] },
    mid: { kind: "city", colors: ["#0b1020", "#05070f"] },
    scenery: ["tree", "palm", "building", "bush", "billboard"],
    sceneryColors: { foliage: "#0d2a1f", foliageLight: "#17483a", trunk: "#1a1410", rock: "#2a2f3a" },
    lampLight: "#ffd59a",
    headlightAlpha: 0.2,
  },
  sunset: {
    id: "sunset",
    name: "Sunset Mesa",
    blurb: "Desert blacktop under a burning sky.",
    sky: ["#1a1038", "#5b2a6b", "#e8614f", "#ffb347"],
    horizonGlow: "#ffd27a",
    stars: false,
    sun: { x: 0.5, y: 0.47, r: 0.11, color: "#ffd166", glow: "#ff7a45", banded: true },
    road: ["#3a3b45", "#35363f"],
    ground: ["#4a2d1c", "#432817"],
    rumble: ["#b91c1c", "#f5f5f4"],
    lane: "#e7e5e4",
    edge: "#fafaf9",
    fog: "#e3845f",
    fogDensity: 3.2,
    far: { kind: "mesas", colors: ["#6b2f4a", "#3c1a33"] },
    mid: { kind: "dunes", colors: ["#7a3b2e", "#4d2419"] },
    scenery: ["cactus", "rock", "bush", "billboard", "palm"],
    sceneryColors: { foliage: "#2f5a35", foliageLight: "#4f8a4f", trunk: "#4a2d1c", rock: "#6b4a3a" },
    lampLight: "#ffe6b3",
    headlightAlpha: 0.08,
  },
  dawn: {
    id: "dawn",
    name: "Alpine Dawn",
    blurb: "Cold mountain pass at first light.",
    sky: ["#141f3d", "#2f4d86", "#86a9d6", "#f6cfb0"],
    horizonGlow: "#ffd9b8",
    stars: false,
    sun: { x: 0.3, y: 0.46, r: 0.06, color: "#fff4d6", glow: "#ffc08a", banded: false },
    clouds: true,
    road: ["#2d3038", "#292c34"],
    ground: ["#1b3326", "#182e22"],
    rumble: ["#9f1239", "#e5e7eb"],
    lane: "#d4d4d8",
    edge: "#f4f4f5",
    fog: "#b9c9df",
    fogDensity: 5.5,
    far: { kind: "alps", colors: ["#5f7fb0", "#2e4470"] },
    mid: { kind: "forest", colors: ["#1f3b2d", "#122419"] },
    scenery: ["pine", "pine", "rock", "bush", "billboard"],
    sceneryColors: { foliage: "#17382a", foliageLight: "#2f6b4a", trunk: "#2b1d14", rock: "#596273" },
    lampLight: "#ffe9c4",
    headlightAlpha: 0.1,
  },
};

export const ENV_LIST = Object.values(ENVIRONMENTS);
function cloneEnv(base: EnvPalette, id: EnvironmentId, name: string, blurb: string): EnvPalette { return { ...base, id, name, blurb }; }
export function envFor(id: EnvironmentId): EnvPalette {
  const direct = (ENVIRONMENTS as Record<string, EnvPalette>)[id];
  if (direct) return direct;
  const base = (ENVIRONMENTS as Record<string, EnvPalette>)[baseEnvFor(id)] ?? ENVIRONMENTS.night;
  const names: Record<string, [string, string]> = { "night-city": ["Night City Rain", "Rain-soaked neon streets."], coastal: ["Coastal Highway", "Ocean cliffs at sunrise."], desert: ["Desert Highway", "Sand, rock and huge sunset."], alpine: ["Alpine Pass", "Snow, tunnels and fog."], industrial: ["Industrial District", "Factories, steam and cranes."], forest: ["Forest Road", "Dense pines and morning fog."], underground: ["Neon Underground", "Underground racing tunnels."] };
  const n = names[id] ?? [id, base.blurb];
  return cloneEnv(base, id, n[0], n[1]);
}
