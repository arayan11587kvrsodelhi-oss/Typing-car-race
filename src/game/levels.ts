import type { Difficulty, EnvironmentId, RaceDistance } from "./types";

export interface LevelDef {
  id: string;
  index: number;
  name: string;
  world: string;
  environment: EnvironmentId;
  difficulty: Difficulty;
  distance: RaceDistance;
  targetWpm: number;
  minimumAccuracy: number;
  reward: number;
  blurb: string;
}

export type CampaignWorldId = "neon-city" | "sunset-mesa" | "alpine-dawn";

export interface CampaignWorldDef {
  id: CampaignWorldId;
  name: string;
  description: string;
  levelStart: number;
  levelEnd: number;
  environment: "night" | "sunset" | "dawn";
}

export const CAMPAIGN_WORLDS: CampaignWorldDef[] = [
  {
    id: "neon-city",
    name: "Neon City",
    description: "Midnight highway through a glowing skyline.",
    levelStart: 1,
    levelEnd: 4,
    environment: "night",
  },
  {
    id: "sunset-mesa",
    name: "Sunset Mesa",
    description: "Desert blacktop under a burning sky.",
    levelStart: 5,
    levelEnd: 8,
    environment: "sunset",
  },
  {
    id: "alpine-dawn",
    name: "Alpine Dawn",
    description: "Cold mountain pass at first light.",
    levelStart: 9,
    levelEnd: 12,
    environment: "dawn",
  },
];

export interface LevelResult {
  wpm: number;
  accuracy: number;
  dnf: boolean;
}

export const LEVELS: LevelDef[] = [
  { id: "city-ignition", index: 1, name: "Neon Streets", world: "Neon City", environment: "night-city", difficulty: "rookie", distance: "sprint", targetWpm: 18, minimumAccuracy: 70, reward: 120, blurb: "Find your line beneath the city lights." },
  { id: "desert-run", index: 2, name: "Cyber Boulevard", world: "Neon City", environment: "night-city", difficulty: "rookie", distance: "sprint", targetWpm: 22, minimumAccuracy: 75, reward: 150, blurb: "A forgiving straight-line test of control." },
  { id: "alpine-ascent", index: 3, name: "Skyline Sprint", world: "Neon City", environment: "night-city", difficulty: "rookie", distance: "circuit", targetWpm: 24, minimumAccuracy: 78, reward: 180, blurb: "Climb into the dawn and keep your rhythm." },
  { id: "neon-underground", index: 4, name: "Midnight Rush", world: "Neon City", environment: "underground", difficulty: "pro", distance: "sprint", targetWpm: 28, minimumAccuracy: 80, reward: 220, blurb: "Tight walls, quick words, no wasted motion." },
  { id: "coastal-velocity", index: 5, name: "Dust Runner", world: "Sunset Mesa", environment: "desert", difficulty: "pro", distance: "circuit", targetWpm: 32, minimumAccuracy: 82, reward: 260, blurb: "Carry speed along the desert blacktop." },
  { id: "industrial-storm", index: 6, name: "Canyon Chase", world: "Sunset Mesa", environment: "desert", difficulty: "pro", distance: "circuit", targetWpm: 36, minimumAccuracy: 84, reward: 300, blurb: "Precision through sandstone, heat, and dust." },
  { id: "forest-line", index: 7, name: "Redline Pass", world: "Sunset Mesa", environment: "desert", difficulty: "legend", distance: "circuit", targetWpm: 40, minimumAccuracy: 86, reward: 350, blurb: "The canyon walls close in as the pace rises." },
  { id: "hypercar-summit", index: 8, name: "Sunset Showdown", world: "Sunset Mesa", environment: "desert", difficulty: "legend", distance: "marathon", targetWpm: 44, minimumAccuracy: 88, reward: 420, blurb: "A long climb reserved for disciplined drivers." },
  { id: "coastal-night", index: 9, name: "Frostbite Run", world: "Alpine Dawn", environment: "alpine", difficulty: "legend", distance: "marathon", targetWpm: 48, minimumAccuracy: 90, reward: 500, blurb: "Read the road when the horizon disappears." },
  { id: "summit-storm", index: 10, name: "Glacier Curve", world: "Alpine Dawn", environment: "alpine", difficulty: "legend", distance: "marathon", targetWpm: 52, minimumAccuracy: 91, reward: 600, blurb: "The final mountain test of speed and accuracy." },
  { id: "grand-prix", index: 11, name: "Summit Velocity", world: "Alpine Dawn", environment: "alpine", difficulty: "legend", distance: "marathon", targetWpm: 56, minimumAccuracy: 92, reward: 750, blurb: "Everything learned so far, in one circuit." },
  { id: "final-circuit", index: 12, name: "Dawn Champion", world: "Alpine Dawn", environment: "alpine", difficulty: "legend", distance: "marathon", targetWpm: 60, minimumAccuracy: 94, reward: 1000, blurb: "Write your name into the mountain skyline." },
];

export function levelById(id?: string): LevelDef {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function isLevelComplete(progress: CampaignProgress, levelId: string): boolean {
  return progress.completedLevelIds.includes(levelId);
}

export function isLevelUnlocked(progress: CampaignProgress, levelId: string): boolean {
  return progress.unlockedLevelIds.includes(levelId);
}

export function canStartLevel(progress: CampaignProgress, levelId: string): boolean {
  return isLevelUnlocked(progress, levelId);
}

export function levelsForWorld(world: CampaignWorldDef): LevelDef[] {
  return LEVELS.filter((level) => level.index >= world.levelStart && level.index <= world.levelEnd);
}

export function isWorldUnlocked(progress: CampaignProgress, world: CampaignWorldDef): boolean {
  if (world.levelStart === 1) return true;
  const prerequisite = LEVELS.find((level) => level.index === world.levelStart - 1);
  return prerequisite ? progress.completedLevelIds.includes(prerequisite.id) : false;
}

export function qualifiesLevel(level: LevelDef, result: LevelResult): boolean {
  return !result.dnf && result.wpm >= level.targetWpm && result.accuracy >= level.minimumAccuracy;
}

export interface CampaignProgress {
  version: 1;
  unlockedLevelIds: string[];
  completedLevelIds: string[];
  bestResults: Record<string, { wpm: number; accuracy: number; place: number; score: number }>;
  rewardsClaimed: string[];
}

export function defaultCampaignProgress(): CampaignProgress {
  return {
    version: 1,
    unlockedLevelIds: [LEVELS[0].id],
    completedLevelIds: [],
    bestResults: {},
    rewardsClaimed: [],
  };
}

export function normalizeCampaignProgress(input: unknown): CampaignProgress {
  const fallback = defaultCampaignProgress();
  if (!input || typeof input !== "object") return fallback;
  const value = input as Partial<CampaignProgress>;
  const validIds = new Set(LEVELS.map((level) => level.id));
  const ids = (items: unknown) =>
    Array.isArray(items) ? [...new Set(items.filter((id): id is string => typeof id === "string" && validIds.has(id)))] : [];
  const unlocked = ids(value.unlockedLevelIds);
  const completed = ids(value.completedLevelIds);
  if (!unlocked.includes(LEVELS[0].id)) unlocked.unshift(LEVELS[0].id);
  for (const completedId of completed) {
    const level = LEVELS.find((item) => item.id === completedId);
    if (level) unlocked.push(level.id);
    const next = LEVELS.find((item) => item.index === (level?.index ?? 0) + 1);
    if (next) unlocked.push(next.id);
  }
  return {
    version: 1,
    unlockedLevelIds: [...new Set(unlocked)],
    completedLevelIds: completed,
    bestResults: value.bestResults && typeof value.bestResults === "object" ? value.bestResults as CampaignProgress["bestResults"] : {},
    rewardsClaimed: ids(value.rewardsClaimed),
  };
}

export function completeLevel(progress: CampaignProgress, level: LevelDef, result: LevelResult & { place: number; score: number }): CampaignProgress {
  if (!qualifiesLevel(level, result)) return progress;
  const completed = new Set(progress.completedLevelIds);
  completed.add(level.id);
  const unlocked = new Set(progress.unlockedLevelIds);
  unlocked.add(level.id);
  const next = LEVELS.find((item) => item.index === level.index + 1);
  if (next) unlocked.add(next.id);
  const previous = progress.bestResults[level.id];
  const shouldReplace = !previous || result.score > previous.score;
  return {
    ...progress,
    unlockedLevelIds: [...unlocked],
    completedLevelIds: [...completed],
    bestResults: shouldReplace ? { ...progress.bestResults, [level.id]: result } : progress.bestResults,
    rewardsClaimed: progress.rewardsClaimed.includes(level.id) ? progress.rewardsClaimed : [...progress.rewardsClaimed, level.id],
  };
}