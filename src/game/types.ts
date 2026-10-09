export type Difficulty = "rookie" | "pro" | "legend";
export type RaceDistance = "sprint" | "circuit" | "marathon";
export type EnvironmentId =
  | "night"
  | "sunset"
  | "dawn"
  | "night-city"
  | "coastal"
  | "desert"
  | "alpine"
  | "industrial"
  | "forest"
  | "underground";

export type CarClass = "starter" | "sport" | "supercar" | "hypercar";
export type CarTier = CarClass;
export type WeatherId = "clear" | "rain" | "heavy-rain" | "fog" | "snow" | "dust";
export type TimeOfDay = "dawn" | "day" | "sunset" | "night";
export type GarageId = "obsidian" | "neon-city" | "desert-hangar" | "alpine" | "underground";
export type GameModeId =
  | "quick"
  | "career"
  | "time-attack"
  | "endurance"
  | "elimination"
  | "night-run"
  | "perfect"
  | "sprint"
  | "circuit"
  | "marathon";
export type RaceCameraId = "chase" | "cinematic" | "bumper" | "hood" | "cockpit" | "finish";

export type BodyShape = "hatch" | "coupe" | "muscle" | "super" | "hyper" | "truck";
export type TailStyle = "bar" | "dual" | "round" | "split" | "vertical";
export type SpoilerStyle = "none" | "lip" | "wing" | "gt";
export type RimStyle = "steel" | "sport" | "chrome" | "neon";
export type DecalStyle = "none" | "stripes" | "number" | "checker";

export type WheelStyleId = "steel" | "sport" | "chrome" | "neon" | "forged" | "carbon" | "track";
export type PaintFinish = "gloss" | "matte" | "metallic" | "chrome" | "pearl";
export type HeadlightStyle = "stock" | "angel" | "matrix" | "laser";
export type DrlStyle = "stock" | "blade" | "halo" | "strip";
export type UnderglowId = string | "none";
export type SplitterId = "stock" | "street" | "carbon" | "gt";
export type DiffuserId = "stock" | "street" | "carbon" | "gt";
export type SkirtId = "stock" | "street" | "carbon";
export type MirrorId = "stock" | "sport" | "carbon";
export type HoodId = "stock" | "vented" | "carbon";
export type RoofId = "stock" | "carbon" | "glass";
export type SeatId = "stock" | "sport" | "bucket" | "race";
export type SteeringId = "stock" | "sport" | "yoke";
export type TrimId = "stock" | "carbon" | "aluminum" | "neon";

export interface CarShape {
  bodyW: number;
  bodyH: number;
  cabinW: number;
  cabinH: number;
  roofW: number;
  wheelR: number;
  wheelInset: number;
  rideHeight: number;
  tail: TailStyle;
  spoiler: SpoilerStyle;
  exhaust: 1 | 2 | 4;
  shape: BodyShape;
}

export interface CarStats {
  top: number; // top speed multiplier
  accel: number; // acceleration multiplier
  grip: number; // error penalty reduction
  nitro: number; // nitro power multiplier
}

/** Verified real-world metadata (kept separate from game balance numbers). */
export interface RealWorldMeta {
  note: string;
  topSpeedKmh?: number;
  powerHp?: number;
  drivetrainNote?: string;
}

export interface GameBalanceStats extends CarStats {
  handling: number;
  braking: number;
}

export interface CarDef {
  id: string;
  manufacturer: string;
  name: string;
  fullName: string;
  class: CarClass;
  rarity: CarClass;
  tagline: string;
  price: number;
  unlockNote: string;
  shape: CarShape;
  stats: CarStats;
  balance: GameBalanceStats;
  defaultPaint: string;
  paintFinish?: PaintFinish;
  drivetrain: string;
  engineType: string;
  powertrain: string;
  bodyType: string;
  wheelStyle: string;
  exhaust: string;
  exhaustCount: 1 | 2 | 4;
  doors: number;
  cockpit: string;
  sourceNote: string;
  realWorld: RealWorldMeta;
}

export interface CarCustomization {
  paint: string;
  paintFinish?: PaintFinish;
  rims: RimStyle;
  wheels?: WheelStyleId;
  spoiler: SpoilerStyle | "stock";
  glow: string | "none";
  decal: DecalStyle;
  headlight?: HeadlightStyle;
  headlightTint?: string;
  drl?: DrlStyle;
  splitter?: SplitterId;
  diffuser?: DiffuserId;
  skirts?: SkirtId;
  mirrors?: MirrorId;
  hood?: HoodId;
  roof?: RoofId;
  wing?: SpoilerStyle | "stock";
  seats?: SeatId;
  steering?: SteeringId;
  trim?: TrimId;
  ambient?: string | "none";
  brakes?: string;
  suspension?: string;
  tires?: string;
}

export interface CarUpgrades {
  engine: number;
  turbo: number;
  tires: number;
  nitro: number;
  transmission?: number;
  brakes?: number;
  suspension?: number;
}

export interface CarBuild {
  def: CarDef;
  custom: CarCustomization;
  upgrades: CarUpgrades;
  plate: string;
}

export interface Profile {
  name: string;
  credits: number;
  ownedCars: string[];
  selectedCar: string;
  customizations: Record<string, CarCustomization>;
  upgrades: Record<string, CarUpgrades>;
  ownedItems: Record<string, string[]>; // carId -> item ids
  racesPlayed: number;
  bestWpm: number;
  levelProgress?: Record<string, boolean>;
  careerTier?: number;
  bestTimes?: Record<string, number>;
  garageId?: GarageId;
  mode?: GameModeId;
  level?: string;
}

export interface RaceConfig {
  build: CarBuild;
  difficulty: Difficulty;
  distance: RaceDistance;
  environment: EnvironmentId;
  playerName: string;
  mode?: GameModeId;
  levelId?: string;
  weather?: WeatherId;
  timeOfDay?: TimeOfDay;
  camera?: RaceCameraId;
  demo?: boolean;
  seed?: number;
}

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  wpm: number;
  accuracy: number;
  place: number;
  car: string;
  difficulty: Difficulty;
  distance: RaceDistance;
  mode?: GameModeId;
  levelId?: string;
  environment?: EnvironmentId;
  date: number;
}

export interface RaceResult {
  score: number;
  wpm: number;
  accuracy: number;
  place: number;
  time: number;
  maxCombo: number;
  words: number;
  perfectSentences: number;
  credits: number;
  dnf: boolean;
  isHighScore: boolean;
  rank: number;
}

export type GameEventType =
  | "key"
  | "error"
  | "word"
  | "sentence"
  | "perfect"
  | "nitro"
  | "nitroReady"
  | "combo"
  | "countdown"
  | "go"
  | "finish"
  | "overtake"
  | "overtaken"
  | "dnf";

export interface GameEvent {
  type: GameEventType;
  value?: number;
}
