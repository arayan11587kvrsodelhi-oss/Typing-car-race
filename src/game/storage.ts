import { migrateCarId } from "./cars";
import type { Difficulty, EnvironmentId, GameModeId, GraphicsQuality, Profile, RaceDistance, ScoreEntry } from "./types";

const KEY_PROFILE = "typedrift.profile.v1";
const KEY_SCORES = "typedrift.scores.v1";
const KEY_SETTINGS = "typedrift.settings.v1";

export interface Settings {
  muted: boolean;
  difficulty: Difficulty;
  distance: RaceDistance;
  environment: EnvironmentId;
  mode?: GameModeId;
  weather?: string;
  timeOfDay?: string;
  camera?: string;
  reducedMotion?: boolean;
  graphicsQuality: GraphicsQuality;
}

const DEFAULT_SETTINGS: Settings = {
  muted: false,
  difficulty: "rookie",
  distance: "circuit",
  environment: "night",
  mode: "quick",
  graphicsQuality: "low",
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

export function defaultProfile(): Profile {
  return {
    name: "ACE",
    credits: 600,
    ownedCars: ["toyota-gr-supra"],
    selectedCar: "toyota-gr-supra",
    customizations: {},
    upgrades: {},
    ownedItems: {},
    racesPlayed: 0,
    bestWpm: 0,
    levelProgress: {},
    careerTier: 0,
    bestTimes: {},
    garageId: "obsidian",
    mode: "quick",
  };
}

export function loadProfile(): Profile {
  const fallback = defaultProfile();
  const p = safeParse<Profile>(localStorage.getItem(KEY_PROFILE), fallback);
  const owned = Array.isArray(p.ownedCars) ? p.ownedCars.map(migrateCarId) : [];
  const unique = [...new Set(owned)];
  if (!unique.length) unique.push("toyota-gr-supra");
  p.ownedCars = unique;
  p.selectedCar = migrateCarId(p.selectedCar || unique[0]);
  if (!p.ownedCars.includes(p.selectedCar)) p.selectedCar = p.ownedCars[0];
  if (typeof p.credits !== "number") p.credits = fallback.credits;
  if (typeof p.racesPlayed !== "number") p.racesPlayed = 0;
  if (!p.customizations) p.customizations = {};
  if (!p.upgrades) p.upgrades = {};
  if (!p.ownedItems) p.ownedItems = {};
  if (!p.levelProgress) p.levelProgress = {};
  if (!p.bestTimes) p.bestTimes = {};
  if (!p.garageId) p.garageId = "obsidian";
  return p;
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY_PROFILE, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY_SCORES);
    const arr = raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Inserts a score, returns the 1-based rank (or 0 if it didn't make the top 10). */
export function submitScore(entry: ScoreEntry): number {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, 10);
  try {
    localStorage.setItem(KEY_SCORES, JSON.stringify(top));
  } catch {
    /* ignore */
  }
  const idx = top.findIndex((s) => s.id === entry.id);
  return idx >= 0 ? idx + 1 : 0;
}

export function clearScores() {
  localStorage.removeItem(KEY_SCORES);
}

export function loadSettings(): Settings {
  const settings = safeParse<Settings>(localStorage.getItem(KEY_SETTINGS), DEFAULT_SETTINGS);
  if (settings.graphicsQuality !== "low" && settings.graphicsQuality !== "medium" && settings.graphicsQuality !== "high") {
    settings.graphicsQuality = DEFAULT_SETTINGS.graphicsQuality;
  }
  return settings;
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
