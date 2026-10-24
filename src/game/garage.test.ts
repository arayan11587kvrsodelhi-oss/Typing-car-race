import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import {
  CARS,
  buildForCar,
  buildFromProfile,
  effectiveStats,
  isCarOwned,
  resolveSelectableCarId,
} from "./cars";
import { defaultProfile, normalizeProfile, saveProfile } from "./storage";

const PROFILE_KEY = "typedrift.profile.v1";
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

const STARTER = CARS[0].id;
const LOCKED = CARS.find((car) => car.id === "bugatti-chiron")!;
const OWNED = CARS.find((car) => car.id === "porsche-911-gt3-rs")!;

test("only owned vehicles are selectable", () => {
  const profile = { ...defaultProfile(), ownedCars: [STARTER, OWNED.id], selectedCar: STARTER };
  assert.equal(isCarOwned(profile, OWNED.id), true);
  assert.equal(isCarOwned(profile, LOCKED.id), false);
  assert.equal(resolveSelectableCarId(profile, OWNED.id), OWNED.id);
  assert.equal(resolveSelectableCarId(profile, LOCKED.id), STARTER, "locked car falls back to the owned selection");
});

test("a locked or unknown stored selection never becomes the race vehicle", () => {
  const lockedSelection = normalizeProfile({
    ownedCars: [STARTER],
    selectedCar: LOCKED.id,
  });
  assert.equal(lockedSelection.selectedCar, STARTER);
  assert.equal(buildFromProfile(lockedSelection).def.id, STARTER);

  const unknownSelection = normalizeProfile({ ownedCars: [STARTER], selectedCar: "not-a-car" });
  assert.equal(unknownSelection.selectedCar, STARTER);

  // buildFromProfile is defensive even when called with an un-normalized object.
  const unsafe = buildFromProfile({
    ...defaultProfile(),
    ownedCars: [STARTER],
    selectedCar: LOCKED.id,
  });
  assert.equal(unsafe.def.id, STARTER);
});

test("the race build derives stats from the selected vehicle's own upgrades", () => {
  const profile = normalizeProfile({
    credits: 12000,
    ownedCars: [STARTER, OWNED.id],
    selectedCar: OWNED.id,
    upgrades: { [OWNED.id]: { engine: 1, turbo: 2 } },
    customizations: { [OWNED.id]: { paint: "#123456" } },
  });
  saveProfile(profile);
  const reloaded = normalizeProfile(JSON.parse(values.get(PROFILE_KEY) ?? "null"));
  assert.equal(reloaded.selectedCar, OWNED.id);

  const build = buildFromProfile(reloaded);
  assert.equal(build.def.id, OWNED.id);
  assert.equal(build.custom.paint, "#123456");
  assert.equal(build.upgrades.turbo, 2);
  assert.equal(effectiveStats(build).top, OWNED.stats.top * (1 + 0.06 * 1));
  assert.equal(effectiveStats(build).accel, OWNED.stats.accel * (1 + 0.12 * 2));
});

test("previewing a locked vehicle uses its real definition without unlocking it", () => {
  const profile = defaultProfile();
  const preview = buildForCar(profile, LOCKED.id);
  assert.equal(preview.def.id, LOCKED.id);
  assert.equal(preview.def.name, LOCKED.name);
  assert.equal(isCarOwned(profile, LOCKED.id), false);
  assert.ok(Object.values(effectiveStats(preview)).every((value) => Number.isFinite(value) && value > 0));
});

test("every vehicle in CARS catalog has complete real definitions and positive stats", () => {
  assert.ok(CARS.length >= 7, "CARS has at least 7 vehicle definitions");
  for (const car of CARS) {
    assert.ok(car.id.length > 0);
    assert.ok(car.name.length > 0);
    assert.ok(car.fullName.length > 0);
    assert.ok(car.manufacturer.length > 0);
    assert.ok(typeof car.price === "number" && car.price >= 0);
    assert.ok(car.stats.top > 0);
    assert.ok(car.stats.accel > 0);
    assert.ok(car.stats.grip > 0);
    assert.ok(car.stats.nitro > 0);
  }
});

test("unlocking a vehicle deducts credits, grants ownership, and allows selection", () => {
  const initial = normalizeProfile({
    credits: 25000,
    ownedCars: [STARTER],
    selectedCar: STARTER,
  });
  saveProfile(initial);

  // Before purchase: LOCKED is not owned and cannot be selected
  assert.equal(isCarOwned(initial, LOCKED.id), false);
  assert.equal(resolveSelectableCarId(initial, LOCKED.id), STARTER);

  // Simulate purchasing LOCKED
  const cost = LOCKED.price;
  assert.ok(initial.credits >= cost, "has enough credits to unlock");
  const purchased = normalizeProfile({
    ...initial,
    credits: initial.credits - cost,
    ownedCars: [...initial.ownedCars, LOCKED.id],
    selectedCar: LOCKED.id,
  });
  saveProfile(purchased);

  // After purchase: reloaded profile shows ownership and selectedCar
  const reloaded = normalizeProfile(JSON.parse(values.get(PROFILE_KEY) ?? "null"));
  assert.equal(reloaded.credits, 25000 - cost);
  assert.ok(reloaded.ownedCars.includes(LOCKED.id));
  assert.equal(reloaded.selectedCar, LOCKED.id);
  assert.equal(isCarOwned(reloaded, LOCKED.id), true);
  assert.equal(resolveSelectableCarId(reloaded, LOCKED.id), LOCKED.id);

  // Race build matches newly unlocked car
  const raceBuild = buildFromProfile(reloaded);
  assert.equal(raceBuild.def.id, LOCKED.id);
});
