import {
  CARS,
  DECALS,
  GLOWS,
  PAINTS,
  RIMS,
  SPOILERS,
  UPGRADE_DEFS,
  WHEELS,
  normalizeCarCustomization,
  normalizeCarUpgrades,
  normalizeStoredCarId,
} from "./cars";
import { GARAGES } from "./garage";
import { LEVELS, normalizeCampaignProgress, type CampaignProgress } from "./levels";
import type { Difficulty, EnvironmentId, GameModeId, GraphicsQuality, Profile, RaceDistance, ScoreEntry } from "./types";

const KEY_PROFILE = "typedrift.profile.v1";
const KEY_SCORES = "typedrift.scores.v1";
const KEY_SETTINGS = "typedrift.settings.v1";
const KEY_CAMPAIGN = "typedrift.campaign.v1";

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

const DIFFICULTIES = ["rookie", "pro", "legend"] as const;
const DISTANCES = ["sprint", "circuit", "marathon"] as const;
const ENVIRONMENTS: EnvironmentId[] = [
  "night", "sunset", "dawn", "night-city", "coastal", "desert", "alpine", "industrial", "forest", "underground",
];
const MODES: GameModeId[] = [
  "quick", "career", "time-attack", "endurance", "elimination", "night-run", "perfect", "sprint", "circuit", "marathon",
];
const WEATHER = ["clear", "rain", "heavy-rain", "fog", "snow", "dust"] as const;
const TIMES_OF_DAY = ["dawn", "day", "sunset", "night"] as const;
const CAMERAS = ["chase", "cinematic", "bumper", "hood", "cockpit", "finish"] as const;
const GRAPHICS = ["low", "medium", "high"] as const;
const LEVEL_IDS = new Set(LEVELS.map((level) => level.id));
const CAR_IDS = new Set(CARS.map((car) => car.id));

const KNOWN_ITEM_IDS = new Set<string>([
  ...PAINTS.flatMap((item) => [item.id, item.hex]),
  ...RIMS.map((item) => item.id),
  ...WHEELS.map((item) => item.id),
  ...SPOILERS.map((item) => item.id),
  ...GLOWS.map((item) => item.id),
  ...DECALS.map((item) => item.id),
  ...UPGRADE_DEFS.map((item) => item.key),
  "stock", "street", "sport", "performance", "racing", "track", "carbon", "forged", "bucket", "race", "yoke",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readStoredValue(key: string): unknown {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    // Storage can be disabled, unavailable, or contain malformed JSON.
    return undefined;
  }
}

function writeStoredValue(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort when browser storage is unavailable or full.
  }
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isChoice<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.includes(value as T);
}

function normalizeDriverName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  // Match the StartScreen input rules: uppercase letters, digits, spaces, underscores,
  // and hyphens, with the existing ten-character limit.
  return value.toUpperCase().replace(/[^A-Z0-9 _-]/g, "").slice(0, 10);
}

function normalizeCarIdRecord<T>(input: unknown, normalizeValue: (carId: string, value: unknown) => T | undefined): Record<string, T> {
  if (!isRecord(input)) return {};
  const output: Record<string, T> = {};
  for (const [rawId, value] of Object.entries(input)) {
    const carId = normalizeStoredCarId(rawId);
    if (!carId || !CAR_IDS.has(carId)) continue;
    const normalized = normalizeValue(carId, value);
    if (normalized !== undefined) output[carId] = normalized;
  }
  return output;
}

function normalizeOwnedItems(input: unknown): Profile["ownedItems"] {
  return normalizeCarIdRecord(input, (_carId, rawItems) => {
    if (!Array.isArray(rawItems)) return [];
    const items = rawItems.filter((item): item is string => {
      if (typeof item !== "string") return false;
      // Older garage code persisted values as `${price}${paintHex}`. Keep those
      // recognized legacy entries so existing user saves are not needlessly erased.
      return KNOWN_ITEM_IDS.has(item) || /^\d{1,7}#[\da-f]{3,8}$/i.test(item);
    });
    return [...new Set(items)];
  });
}

function normalizeBooleanLevelMap(input: unknown): Record<string, boolean> {
  if (!isRecord(input)) return {};
  const output: Record<string, boolean> = {};
  for (const [id, value] of Object.entries(input)) {
    if (LEVEL_IDS.has(id) && typeof value === "boolean") output[id] = value;
  }
  return output;
}

function normalizeBestTimes(input: unknown): Record<string, number> {
  if (!isRecord(input)) return {};
  const output: Record<string, number> = {};
  for (const [id, value] of Object.entries(input)) {
    // Timings are positive seconds and must belong to a real campaign level.
    if (LEVEL_IDS.has(id) && typeof value === "number" && Number.isFinite(value) && value > 0) output[id] = value;
  }
  return output;
}

export function defaultProfile(): Profile {
  const starterCar = CARS[0]?.id ?? "bmw-m3-competition";
  return {
    name: "ACE",
    credits: 600,
    ownedCars: [starterCar],
    selectedCar: starterCar,
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

/** Convert a parsed or in-memory save into a safe, schema-compatible profile. */
export function normalizeProfile(input: unknown): Profile {
  const fallback = defaultProfile();
  const value = isRecord(input) ? input : {};

  const ownedCarsInput = Array.isArray(value.ownedCars) ? value.ownedCars : [];
  const ownedCars = [...new Set(ownedCarsInput.map(normalizeStoredCarId).filter((id): id is string => Boolean(id)))];
  const starterCar = fallback.ownedCars[0];
  if (!ownedCars.includes(starterCar)) ownedCars.unshift(starterCar);

  const requestedSelection = normalizeStoredCarId(value.selectedCar);
  const selectedCar = requestedSelection && ownedCars.includes(requestedSelection) ? requestedSelection : ownedCars[0];

  const customizations = normalizeCarIdRecord(value.customizations, (carId, entry) => {
    const def = CARS.find((car) => car.id === carId);
    return def ? normalizeCarCustomization(def, entry) : undefined;
  });
  const upgrades = normalizeCarIdRecord(value.upgrades, (_carId, entry) => normalizeCarUpgrades(entry));

  const garageIds = GARAGES.map((garage) => garage.id);
  const mode = isChoice(value.mode, MODES) ? value.mode : fallback.mode;
  const bestWpm = isFiniteNonNegative(value.bestWpm) ? value.bestWpm : fallback.bestWpm;
  const careerTier = isNonNegativeSafeInteger(value.careerTier) ? value.careerTier : fallback.careerTier;

  return {
    name: normalizeDriverName(value.name, fallback.name),
    credits: isNonNegativeSafeInteger(value.credits) ? value.credits : fallback.credits,
    ownedCars,
    selectedCar,
    customizations,
    upgrades,
    ownedItems: normalizeOwnedItems(value.ownedItems),
    racesPlayed: isNonNegativeSafeInteger(value.racesPlayed) ? value.racesPlayed : fallback.racesPlayed,
    bestWpm,
    levelProgress: normalizeBooleanLevelMap(value.levelProgress),
    careerTier,
    bestTimes: normalizeBestTimes(value.bestTimes),
    garageId: isChoice(value.garageId, garageIds) ? value.garageId : fallback.garageId,
    mode,
    ...(typeof value.level === "string" && LEVEL_IDS.has(value.level) ? { level: value.level } : {}),
  };
}

export function loadProfile(): Profile {
  return normalizeProfile(readStoredValue(KEY_PROFILE));
}

export function saveProfile(profile: Profile): void {
  writeStoredValue(KEY_PROFILE, normalizeProfile(profile));
}

function normalizeScoreEntry(input: unknown): ScoreEntry | undefined {
  if (!isRecord(input)) return undefined;
  const id = typeof input.id === "string" ? input.id.trim().slice(0, 128) : "";
  if (!id || !isFiniteNonNegative(input.score)) return undefined;

  const rawDate = input.date;
  const date = typeof rawDate === "number" && Number.isSafeInteger(rawDate) && rawDate >= 0 && rawDate <= 8.64e15
    ? rawDate
    : 0;
  const car = normalizeStoredCarId(input.car) ?? CARS[0]?.id ?? "bmw-m3-competition";
  const name = normalizeDriverName(input.name, "ACE") || "ACE";
  const place = isNonNegativeSafeInteger(input.place) && input.place <= 4 ? input.place : 0;
  const wpm = isFiniteNonNegative(input.wpm) ? input.wpm : 0;
  const accuracy = isFiniteNonNegative(input.accuracy) && input.accuracy <= 100 ? input.accuracy : 0;

  return {
    id,
    name,
    score: input.score,
    wpm,
    accuracy,
    place,
    car,
    difficulty: isChoice(input.difficulty, DIFFICULTIES) ? input.difficulty : "rookie",
    distance: isChoice(input.distance, DISTANCES) ? input.distance : "circuit",
    ...(isChoice(input.mode, MODES) ? { mode: input.mode } : {}),
    ...(isChoice(input.levelId, [...LEVEL_IDS]) ? { levelId: input.levelId } : {}),
    ...(isChoice(input.environment, ENVIRONMENTS) ? { environment: input.environment } : {}),
    date,
  };
}

function normalizeScoreEntries(input: unknown): ScoreEntry[] {
  if (!Array.isArray(input)) return [];
  const byId = new Map<string, ScoreEntry>();
  for (const rawEntry of input) {
    const entry = normalizeScoreEntry(rawEntry);
    if (!entry) continue;
    const existing = byId.get(entry.id);
    if (!existing || entry.score > existing.score) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, 10);
}

export function loadScores(): ScoreEntry[] {
  return normalizeScoreEntries(readStoredValue(KEY_SCORES));
}

/** Inserts a score, returns the 1-based rank (or 0 if it didn't make the top 10). */
export function submitScore(entry: ScoreEntry): number {
  const normalizedEntry = normalizeScoreEntry(entry);
  if (!normalizedEntry) return 0;
  const top = normalizeScoreEntries([...loadScores(), normalizedEntry]);
  writeStoredValue(KEY_SCORES, top);
  const idx = top.findIndex((score) => score.id === normalizedEntry.id);
  return idx >= 0 ? idx + 1 : 0;
}

export function clearScores() {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY_SCORES);
  } catch {
    // Clearing is best-effort when browser storage is unavailable.
  }
}

export function loadSettings(): Settings {
  const value = readStoredValue(KEY_SETTINGS);
  const input = isRecord(value) ? value : {};
  return {
    muted: typeof input.muted === "boolean" ? input.muted : DEFAULT_SETTINGS.muted,
    difficulty: isChoice(input.difficulty, DIFFICULTIES) ? input.difficulty : DEFAULT_SETTINGS.difficulty,
    distance: isChoice(input.distance, DISTANCES) ? input.distance : DEFAULT_SETTINGS.distance,
    environment: isChoice(input.environment, ENVIRONMENTS) ? input.environment : DEFAULT_SETTINGS.environment,
    mode: isChoice(input.mode, MODES) ? input.mode : DEFAULT_SETTINGS.mode,
    ...(isChoice(input.weather, WEATHER) ? { weather: input.weather } : {}),
    ...(isChoice(input.timeOfDay, TIMES_OF_DAY) ? { timeOfDay: input.timeOfDay } : {}),
    ...(isChoice(input.camera, CAMERAS) ? { camera: input.camera } : {}),
    ...(typeof input.reducedMotion === "boolean" ? { reducedMotion: input.reducedMotion } : {}),
    graphicsQuality: isChoice(input.graphicsQuality, GRAPHICS) ? input.graphicsQuality : DEFAULT_SETTINGS.graphicsQuality,
  };
}

export function saveSettings(settings: Settings) {
  const input: Record<string, unknown> = isRecord(settings) ? (settings as unknown as Record<string, unknown>) : {};
  writeStoredValue(KEY_SETTINGS, {
    muted: typeof input.muted === "boolean" ? input.muted : DEFAULT_SETTINGS.muted,
    difficulty: isChoice(input.difficulty, DIFFICULTIES) ? input.difficulty : DEFAULT_SETTINGS.difficulty,
    distance: isChoice(input.distance, DISTANCES) ? input.distance : DEFAULT_SETTINGS.distance,
    environment: isChoice(input.environment, ENVIRONMENTS) ? input.environment : DEFAULT_SETTINGS.environment,
    mode: isChoice(input.mode, MODES) ? input.mode : DEFAULT_SETTINGS.mode,
    ...(isChoice(input.weather, WEATHER) ? { weather: input.weather } : {}),
    ...(isChoice(input.timeOfDay, TIMES_OF_DAY) ? { timeOfDay: input.timeOfDay } : {}),
    ...(isChoice(input.camera, CAMERAS) ? { camera: input.camera } : {}),
    ...(typeof input.reducedMotion === "boolean" ? { reducedMotion: input.reducedMotion } : {}),
    graphicsQuality: isChoice(input.graphicsQuality, GRAPHICS) ? input.graphicsQuality : DEFAULT_SETTINGS.graphicsQuality,
  });
}

export function loadCampaignProgress(): CampaignProgress {
  return normalizeCampaignProgress(readStoredValue(KEY_CAMPAIGN));
}

export function saveCampaignProgress(progress: CampaignProgress) {
  writeStoredValue(KEY_CAMPAIGN, normalizeCampaignProgress(progress));
}
