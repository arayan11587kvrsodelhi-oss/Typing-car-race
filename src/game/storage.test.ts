import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import {
  CARS,
  DEFAULT_UPGRADES,
  buildForCar,
  buildFromProfile,
  effectiveStats,
  isCarOwned,
  normalizeCarCustomization,
  resolveSelectableCarId,
} from "./cars";
import { LEVELS, normalizeCampaignProgress } from "./levels";
import { defaultProfile, loadProfile, loadScores, normalizeProfile, saveProfile, submitScore } from "./storage";
import type { Profile, ScoreEntry } from "./types";

const PROFILE_KEY = "typedrift.profile.v1";
const SCORES_KEY = "typedrift.scores.v1";
let values = new Map<string, string>();
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

const mockStorage = {
  getItem(key: string) { return values.get(key) ?? null; },
  setItem(key: string, value: string) { values.set(key, String(value)); },
  removeItem(key: string) { values.delete(key); },
  clear() { values.clear(); },
  key(index: number) { return [...values.keys()][index] ?? null; },
  get length() { return values.size; },
};

beforeEach(() => {
  values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: mockStorage });
});

after(() => {
  if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

test("valid existing profile values and legacy car IDs are preserved", () => {
  const profile = normalizeProfile({
    name: "ARYAN_7",
    credits: 12345,
    ownedCars: ["toyota-gr-supra", "porsche-911-turbo-s", "porsche-911-turbo-s"],
    selectedCar: "porsche-911-turbo-s",
    upgrades: { "porsche-911-turbo-s": { engine: 2, turbo: 1, tires: 3, nitro: 0 } },
    customizations: { "porsche-911-turbo-s": { paint: "#aabbcc", wheels: "forged", spoiler: "gt", glow: "#22d3ee" } },
    bestWpm: 82.5,
    racesPlayed: 14,
    bestTimes: { "city-ignition": 45.25, "final-circuit": 120 },
  });

  assert.equal(profile.name, "ARYAN_7");
  assert.equal(profile.credits, 12345);
  assert.ok(profile.ownedCars.includes(CARS[0].id), "legacy starter alias resolves to the current starter car");
  assert.ok(profile.ownedCars.includes("porsche-911-turbo-s"));
  assert.equal(profile.selectedCar, "porsche-911-turbo-s");
  assert.equal(profile.upgrades["porsche-911-turbo-s"].engine, 2);
  assert.equal(profile.customizations["porsche-911-turbo-s"].wheels, "forged");
  assert.equal(profile.customizations["porsche-911-turbo-s"].paint, "#aabbcc");
  assert.equal(profile.bestWpm, 82.5);
  assert.equal(profile.racesPlayed, 14);
  assert.deepEqual(profile.bestTimes, { "city-ignition": 45.25, "final-circuit": 120 });
});

test("malformed JSON and unexpected top-level profile values fall back safely", () => {
  values.set(PROFILE_KEY, "{not valid JSON");
  assert.equal(loadProfile().credits, defaultProfile().credits);
  values.set(PROFILE_KEY, "null");
  assert.equal(loadProfile().name, "ACE");
  values.set(PROFILE_KEY, "[]");
  assert.equal(loadProfile().credits, 600);
  values.set(PROFILE_KEY, '"wrong shape"');
  assert.equal(loadProfile().ownedCars[0], CARS[0].id);
  assert.equal(normalizeProfile(null).selectedCar, CARS[0].id);
});

test("invalid numeric values cannot corrupt currency, counters, or WPM", () => {
  const profile = normalizeProfile({
    credits: -1,
    racesPlayed: 1.5,
    bestWpm: Number.POSITIVE_INFINITY,
    careerTier: -3,
    bestTimes: {
      "city-ignition": -10,
      "desert-run": Number.NaN,
      "final-circuit": 80.5,
      "unknown-level": 2,
    },
  });
  assert.equal(profile.credits, 600);
  assert.equal(profile.racesPlayed, 0);
  assert.equal(profile.bestWpm, 0);
  assert.equal(profile.careerTier, 0);
  assert.deepEqual(profile.bestTimes, { "final-circuit": 80.5 });
});

test("upgrade levels are bounded and malformed values produce finite stats", () => {
  const profile = normalizeProfile({
    selectedCar: CARS[0].id,
    upgrades: { [CARS[0].id]: { engine: 9999, turbo: "x", tires: -1, nitro: 2.5 } },
  });
  const upgrades = profile.upgrades[CARS[0].id];
  assert.equal(upgrades.engine, 3);
  assert.equal(upgrades.turbo, 0);
  assert.equal(upgrades.tires, 0);
  assert.equal(upgrades.nitro, 0);
  const stats = effectiveStats(buildFromProfile(profile));
  assert.ok(Object.values(stats).every((value) => Number.isFinite(value) && value > 0));

  const directBuild = buildFromProfile({
    ...defaultProfile(),
    upgrades: { [CARS[0].id]: { engine: Number.NaN, turbo: 9999, tires: "x", nitro: 1 } },
    customizations: null,
    name: 17,
  } as unknown as Profile);
  assert.equal(directBuild.upgrades.engine, 0);
  assert.equal(directBuild.upgrades.turbo, 3);
  assert.equal(directBuild.upgrades.tires, 0);
  assert.ok(Object.values(effectiveStats(directBuild)).every(Number.isFinite));
  assert.equal(directBuild.plate, "ACE");
});

test("unknown car, item, level, and customization identifiers are filtered", () => {
  const profile = normalizeProfile({
    ownedCars: ["missing-car", "porsche-911-turbo-s"],
    selectedCar: "missing-car",
    customizations: {
      "missing-car": { paint: "#ffffff" },
      "porsche-911-turbo-s": { paint: "not-a-color", wheels: "made-up-wheel", spoiler: "gt", glow: "made-up-glow" },
    },
    upgrades: { "missing-car": { engine: 3 }, "porsche-911-turbo-s": { engine: 1 } },
    ownedItems: { "missing-car": ["forged"], "porsche-911-turbo-s": ["forged", "not-a-real-item", "205#1d4ed8"] },
    levelProgress: { "city-ignition": true, "unknown-level": true },
    bestTimes: { "city-ignition": 40, "unknown-level": 1 },
  });
  assert.ok(!profile.ownedCars.includes("missing-car"));
  assert.equal(profile.selectedCar, CARS[0].id);
  assert.ok(!("missing-car" in profile.customizations));
  assert.ok(!("missing-car" in profile.upgrades));
  assert.deepEqual(profile.ownedItems["porsche-911-turbo-s"], ["forged", "205#1d4ed8"]);
  assert.deepEqual(profile.levelProgress, { "city-ignition": true });
  assert.deepEqual(profile.bestTimes, { "city-ignition": 40 });
  assert.equal(profile.customizations["porsche-911-turbo-s"].paint, CARS.find((car) => car.id === "porsche-911-turbo-s")!.defaultPaint);
  assert.equal(profile.customizations["porsche-911-turbo-s"].wheels, "sport");
  assert.equal(profile.customizations["porsche-911-turbo-s"].spoiler, "gt");
});

test("missing fields and partially corrupt profile data retain unaffected progress", () => {
  const partial = normalizeProfile({
    credits: 4500,
    name: "Aryan! Sharma-2",
    ownedCars: ["porsche-911-turbo-s", 7, null],
    selectedCar: "porsche-911-turbo-s",
    upgrades: { "porsche-911-turbo-s": { engine: 2, turbo: "bad" } },
    customizations: { "porsche-911-turbo-s": { paint: "#123abc", wheels: { invalid: true } } },
  });
  assert.equal(partial.credits, 4500);
  assert.equal(partial.name, "ARYAN SHAR", "stored names follow the existing 10-character input limit");
  assert.equal(partial.selectedCar, "porsche-911-turbo-s");
  assert.equal(partial.upgrades["porsche-911-turbo-s"].engine, 2);
  assert.equal(partial.upgrades["porsche-911-turbo-s"].turbo, 0);
  assert.equal(partial.customizations["porsche-911-turbo-s"].paint, "#123abc");
  assert.equal(partial.customizations["porsche-911-turbo-s"].wheels, "sport");
  assert.deepEqual(partial.bestTimes, {});
});

test("saveProfile persists the normalized schema", () => {
  saveProfile({
    ...defaultProfile(),
    credits: -200,
    upgrades: { [CARS[0].id]: { engine: 999 } },
  } as unknown as Profile);
  const written = JSON.parse(values.get(PROFILE_KEY) ?? "null") as Profile;
  assert.equal(written.credits, 600);
  assert.equal(written.upgrades[CARS[0].id].engine, 3);
  assert.equal(written.selectedCar, CARS[0].id);
});

test("campaign best results discard invalid and unknown records", () => {
  const progress = normalizeCampaignProgress({
    unlockedLevelIds: [LEVELS[0].id],
    completedLevelIds: [],
    rewardsClaimed: [],
    bestResults: {
      [LEVELS[0].id]: { wpm: 55, accuracy: 96, place: 1, score: 1000 },
      [LEVELS[1].id]: { wpm: Number.NaN, accuracy: 99, place: 1, score: 800 },
      unknown: { wpm: 99, accuracy: 99, place: 1, score: 5000 },
    },
  });
  assert.deepEqual(progress.bestResults, {
    [LEVELS[0].id]: { wpm: 55, accuracy: 96, place: 1, score: 1000 },
  });
});


test("loadScores filters malformed entries and normalizes display-sensitive fields", () => {
  values.set(SCORES_KEY, JSON.stringify([
    {
      id: "valid-score", name: "ARYAN_7", score: 1500, wpm: 82.5, accuracy: 98,
      place: 1, car: "porsche-911-turbo-s", difficulty: "pro", distance: "marathon", date: 1760000000000,
      levelId: "final-circuit",
    },
    {
      id: "bad-display-fields", name: { unexpected: true }, score: 200, wpm: Number.NaN,
      accuracy: 999, place: 99, car: "unknown-car", difficulty: "invalid", distance: "invalid",
      date: Number.POSITIVE_INFINITY, levelId: "unknown-level",
    },
    { id: "bad-score", name: "NOPE", score: "999999", wpm: 99, accuracy: 100, place: 1, car: CARS[0].id, difficulty: "rookie", distance: "circuit", date: 1760000000000 },
    null,
  ]));

  const scores = loadScores();
  assert.equal(scores.length, 2);
  assert.equal(scores[0].id, "valid-score");
  assert.equal(scores[0].name, "ARYAN_7");
  assert.equal(scores[1].name, "ACE");
  assert.equal(scores[1].wpm, 0);
  assert.equal(scores[1].accuracy, 0);
  assert.equal(scores[1].place, 0);
  assert.equal(scores[1].car, CARS[0].id);
  assert.equal(scores[1].difficulty, "rookie");
  assert.equal(scores[1].distance, "circuit");
  assert.equal(scores[1].date, 0);
  assert.equal(scores[1].levelId, undefined);
});

test("submitScore saves normalized entries and ignores invalid scores", () => {
  const base = {
    id: "new-score", name: "ARYAN_7", score: 250, wpm: 55, accuracy: 95, place: 2,
    car: CARS[0].id, difficulty: "rookie", distance: "circuit", date: 1760000000000,
  };
  assert.equal(submitScore(base as unknown as ScoreEntry), 1);
  const persisted = JSON.parse(values.get(SCORES_KEY) ?? "null") as Array<Record<string, unknown>>;
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].id, "new-score");
  assert.equal(submitScore({ ...base, score: Number.NaN } as unknown as ScoreEntry), 0);
  assert.equal(loadScores().length, 1);
});

test("vehicle garage selection accepts owned cars and keeps locked ones locked", () => {
  const base = { ...defaultProfile(), credits: 50_000 };
  const owned = CARS[0].id;
  const locked = CARS.find((car) => car.id !== owned && !base.ownedCars.includes(car.id))!;

  assert.equal(isCarOwned(base, owned), true);
  assert.equal(isCarOwned(base, locked.id), false);
  // A locked vehicle can never become the active race vehicle.
  assert.equal(resolveSelectableCarId(base, locked.id), owned);
  // An unknown vehicle falls back to the current owned selection.
  assert.equal(resolveSelectableCarId(base, "missing-car"), owned);

  const purchased = normalizeProfile({ ...base, ownedCars: [...base.ownedCars, locked.id] });
  assert.equal(resolveSelectableCarId(purchased, locked.id), locked.id);
  const build = buildFromProfile({ ...purchased, selectedCar: locked.id });
  assert.equal(build.def.id, locked.id, "the race build matches the selected vehicle");
  assert.equal(buildFromProfile({ ...purchased, selectedCar: owned }).def.id, owned);
});

test("saving and reloading keeps the selected vehicle used by the race", () => {
  const owned = CARS[0].id;
  const extra = CARS.find((car) => car.id !== owned)!;
  saveProfile({
    ...defaultProfile(),
    ownedCars: [owned, extra.id],
    selectedCar: extra.id,
    customizations: { [extra.id]: { ...normalizeCarCustomization(extra, {}), paint: "#123456" } },
    upgrades: { [extra.id]: { engine: 2, turbo: 1, tires: 0, nitro: 3 } },
  } as unknown as Profile);

  const reloaded = loadProfile();
  assert.equal(reloaded.selectedCar, extra.id);
  const build = buildFromProfile(reloaded);
  assert.equal(build.def.id, extra.id);
  assert.equal(build.custom.paint, "#123456");
  assert.equal(build.upgrades.engine, 2);
  assert.equal(build.upgrades.nitro, 3);
});

test("a selection referencing an unowned vehicle falls back to an owned one", () => {
  const owned = CARS[0].id;
  const unowned = CARS.find((car) => car.id !== owned)!;
  const profile = normalizeProfile({ ownedCars: [owned], selectedCar: unowned.id });
  assert.equal(profile.selectedCar, owned);
  assert.equal(buildFromProfile(profile).def.id, owned);
});

test("garage previews build real stats for any vehicle through the shared definitions", () => {
  for (const car of CARS) {
    const build = buildForCar(defaultProfile(), car.id);
    assert.equal(build.def.id, car.id);
    assert.deepEqual(build.upgrades, DEFAULT_UPGRADES);
    const stats = effectiveStats(build);
    assert.ok(Object.values(stats).every((value) => Number.isFinite(value) && value > 0));
    assert.equal(stats.top.toFixed(6), car.stats.top.toFixed(6));
  }
});
