import type { CarBuild, CarClass, CarCustomization, CarDef, CarUpgrades, DecalStyle, Profile, RimStyle, SpoilerStyle, WheelStyleId } from "./types";

const BAL = (top: number, accel: number, grip: number, nitro: number, handling: number, braking: number) => ({ top, accel, grip, nitro, handling, braking });
const RW = (note: string) => ({ note });
const SRC = "Original procedural showroom geometry inspired by the named model. Not a licensed replica. Game stats are fictional balance values, not manufacturer claims.";

function shapeFor(kind: CarDef["shape"]["shape"], tail: CarDef["shape"]["tail"], spoiler: SpoilerStyle, exhaust: 1 | 2 | 4, w = 0.72, h = 0.17): CarDef["shape"] {
  return { shape: kind, bodyW: w, bodyH: h, cabinW: 0.78, cabinH: 0.16, roofW: 0.62, wheelR: 0.082, wheelInset: 0.07, rideHeight: 0.04, tail, spoiler, exhaust };
}

export const LEGACY_CAR_MAP: Record<string, string> = {
  comet: "bmw-m3-competition",
  rhino: "lamborghini-aventador-svj",
  vandal: "koenigsegg-jesko",
  katana: "bmw-m4-competition",
  phantom: "porsche-911-gt3-rs",
  nova: "ferrari-sf90-stradale",
  "toyota-gr-supra": "bmw-m3-competition",
  "ford-mustang-dark-horse": "lamborghini-aventador-svj",
  "nissan-gtr-nismo": "porsche-911-turbo-s",
  "bmw-m5-cs": "bmw-m3-competition",
  "mercedes-amg-gt-black": "ferrari-sf90-stradale",
  "ferrari-296-gtb": "ferrari-sf90-stradale",
  "mclaren-750s": "mclaren-720s",
  "lamborghini-huracan-sto": "lamborghini-aventador-svj",
  "mclaren-765lt": "mclaren-720s",
  "chevrolet-corvette-zr1": "lamborghini-revuelto",
  "aston-martin-valkyrie": "koenigsegg-regera",
  "bugatti-chiron-super-sport": "bugatti-chiron",
  "bugatti-tourbillon": "bugatti-bolide",
  "koenigsegg-jesko-absolut": "koenigsegg-jesko",
  "koenigsegg-gemera": "koenigsegg-regera",
  "porsche-911-turbo-s": "porsche-911-turbo-s",
};

export function migrateCarId(id: string): string {
  if (!id) return "bmw-m3-competition";
  if (CARS.some((c) => c.id === id)) return id;
  return LEGACY_CAR_MAP[id] ?? "bmw-m3-competition";
}

export const CARS: CarDef[] = [
  // ── Starter Tier ─────────────────────────────────────────────────────────
  {
    id: "bmw-m3-competition",
    manufacturer: "BMW", name: "M3 Competition", fullName: "BMW M3 Competition",
    class: "starter", rarity: "starter",
    tagline: "Surgical performance sedan. The benchmark M car.",
    price: 0, unlockNote: "Starter car.",
    defaultPaint: "#1d4ed8",
    shape: shapeFor("coupe", "dual", "lip", 4, 0.72, 0.18),
    stats: { top: 0.90, accel: 0.95, grip: 1.0, nitro: 0.90 },
    balance: BAL(0.90, 0.95, 1.0, 0.90, 0.94, 0.92),
    drivetrain: "RWD", engineType: "Twin-turbo inline-6 (game representation)", powertrain: "Petrol",
    bodyType: "Sports Sedan", wheelStyle: "M sport alloy", exhaust: "Quad rear exhausts",
    exhaustCount: 4, doors: 4, cockpit: "M Sport cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },
  {
    id: "bmw-m4-competition",
    manufacturer: "BMW", name: "M4 Competition", fullName: "BMW M4 Competition",
    class: "starter", rarity: "starter",
    tagline: "Coupe precision with aggressive M proportions.",
    price: 1500, unlockNote: "Showroom.",
    defaultPaint: "#1e40af",
    shape: shapeFor("coupe", "split", "lip", 4, 0.72, 0.17),
    stats: { top: 0.93, accel: 0.98, grip: 0.98, nitro: 0.92 },
    balance: BAL(0.93, 0.98, 0.98, 0.92, 0.94, 0.92),
    drivetrain: "RWD", engineType: "Twin-turbo inline-6 (game representation)", powertrain: "Petrol",
    bodyType: "Coupe", wheelStyle: "M sport alloy", exhaust: "Quad rear exhausts",
    exhaustCount: 4, doors: 2, cockpit: "M Sport cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },

  // ── Sport Tier ────────────────────────────────────────────────────────────
  {
    id: "porsche-911-turbo-s",
    manufacturer: "Porsche", name: "911 Turbo S", fullName: "Porsche 911 Turbo S",
    class: "sport", rarity: "sport",
    tagline: "Surgical all-rounder. The benchmark hypercar killer.",
    price: 4500, unlockNote: "Sport tier.",
    defaultPaint: "#facc15",
    shape: shapeFor("coupe", "bar", "lip", 4, 0.73, 0.16),
    stats: { top: 1.04, accel: 1.06, grip: 1.05, nitro: 1.0 },
    balance: BAL(1.04, 1.06, 1.05, 1.0, 1.02, 1.0),
    drivetrain: "AWD", engineType: "Twin-turbo flat-6 (game representation)", powertrain: "Petrol",
    bodyType: "Coupe", wheelStyle: "Turbo alloy", exhaust: "Quad exhausts",
    exhaustCount: 4, doors: 2, cockpit: "Sports cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },

  // ── Supercar Tier ─────────────────────────────────────────────────────────
  {
    id: "porsche-911-gt3-rs",
    manufacturer: "Porsche", name: "911 GT3 RS", fullName: "Porsche 911 GT3 RS",
    class: "supercar", rarity: "supercar",
    tagline: "Aero track weapon with giant rear wing and wide rear haunches.",
    price: 8000, unlockNote: "Supercar tier.",
    defaultPaint: "#e2e8f0",
    shape: shapeFor("super", "bar", "gt", 2, 0.76, 0.15),
    stats: { top: 1.08, accel: 1.06, grip: 1.12, nitro: 1.05 },
    balance: BAL(1.08, 1.06, 1.12, 1.05, 1.10, 1.08),
    drivetrain: "RWD", engineType: "Flat-6 (game representation)", powertrain: "Petrol",
    bodyType: "Track coupe", wheelStyle: "Centre-lock", exhaust: "Dual exhausts",
    exhaustCount: 2, doors: 2, cockpit: "Track cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },
  {
    id: "ferrari-sf90-stradale",
    manufacturer: "Ferrari", name: "SF90 Stradale", fullName: "Ferrari SF90 Stradale",
    class: "supercar", rarity: "supercar",
    tagline: "Hybrid AWD Ferrari flagship. Fastest road Ferrari ever made.",
    price: 9500, unlockNote: "Supercar tier.",
    defaultPaint: "#991b1b",
    shape: shapeFor("super", "bar", "lip", 4, 0.78, 0.145),
    stats: { top: 1.16, accel: 1.14, grip: 1.04, nitro: 1.12 },
    balance: BAL(1.16, 1.14, 1.04, 1.12, 1.06, 1.06),
    drivetrain: "AWD", engineType: "Hybrid V8 (game representation)", powertrain: "Hybrid",
    bodyType: "Supercar", wheelStyle: "Aero forged", exhaust: "High exhausts",
    exhaustCount: 4, doors: 2, cockpit: "Hybrid cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },
  {
    id: "mclaren-720s",
    manufacturer: "McLaren", name: "720S", fullName: "McLaren 720S",
    class: "supercar", rarity: "supercar",
    tagline: "Lightweight supercar with dihedral doors and sculpted intakes.",
    price: 7000, unlockNote: "Supercar tier.",
    defaultPaint: "#f97316",
    shape: shapeFor("super", "bar", "wing", 2, 0.77, 0.145),
    stats: { top: 1.12, accel: 1.10, grip: 1.0, nitro: 1.10 },
    balance: BAL(1.12, 1.10, 1.0, 1.10, 1.08, 1.05),
    drivetrain: "RWD", engineType: "Twin-turbo V8 (game representation)", powertrain: "Petrol",
    bodyType: "Supercar", wheelStyle: "Forged", exhaust: "Centre exhausts",
    exhaustCount: 2, doors: 2, cockpit: "Track cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },
  {
    id: "lamborghini-aventador-svj",
    manufacturer: "Lamborghini", name: "Aventador SVJ", fullName: "Lamborghini Aventador SVJ",
    class: "supercar", rarity: "supercar",
    tagline: "Angular V12 masterpiece. Extreme aero, extreme presence.",
    price: 9000, unlockNote: "Supercar tier.",
    defaultPaint: "#d4a017",
    shape: shapeFor("super", "split", "wing", 2, 0.79, 0.15),
    stats: { top: 1.14, accel: 1.10, grip: 1.02, nitro: 1.12 },
    balance: BAL(1.14, 1.10, 1.02, 1.12, 1.04, 1.05),
    drivetrain: "AWD", engineType: "V12 (game representation)", powertrain: "Petrol",
    bodyType: "Supercar", wheelStyle: "Forged", exhaust: "High exhausts",
    exhaustCount: 2, doors: 2, cockpit: "Flagship cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },
  {
    id: "lamborghini-revuelto",
    manufacturer: "Lamborghini", name: "Revuelto", fullName: "Lamborghini Revuelto",
    class: "supercar", rarity: "supercar",
    tagline: "Hybrid V12 successor. Even more extreme aero and sharp angles.",
    price: 9800, unlockNote: "Supercar tier.",
    defaultPaint: "#a855f7",
    shape: shapeFor("super", "split", "wing", 4, 0.80, 0.145),
    stats: { top: 1.15, accel: 1.12, grip: 1.0, nitro: 1.15 },
    balance: BAL(1.15, 1.12, 1.0, 1.15, 1.05, 1.05),
    drivetrain: "AWD", engineType: "Hybrid V12 (game representation)", powertrain: "Hybrid",
    bodyType: "Supercar", wheelStyle: "Forged", exhaust: "High exhausts",
    exhaustCount: 4, doors: 2, cockpit: "Flagship cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },

  // ── Hypercar Tier ─────────────────────────────────────────────────────────
  {
    id: "bugatti-chiron",
    manufacturer: "Bugatti", name: "Chiron", fullName: "Bugatti Chiron",
    class: "hypercar", rarity: "hypercar",
    tagline: "Quad-turbo W16. The grand hypercar with horseshoe grille and C-side.",
    price: 15000, unlockNote: "Complete Hypercar Summit.",
    defaultPaint: "#1e3a8a",
    shape: shapeFor("hyper", "bar", "lip", 4, 0.82, 0.14),
    stats: { top: 1.26, accel: 1.10, grip: 1.0, nitro: 1.20 },
    balance: BAL(1.26, 1.10, 1.0, 1.20, 1.02, 1.02),
    drivetrain: "AWD", engineType: "W16 (game representation)", powertrain: "Petrol",
    bodyType: "Hypercar", wheelStyle: "Super Sport alloy", exhaust: "Quad exhausts",
    exhaustCount: 4, doors: 2, cockpit: "Luxury cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },
  {
    id: "bugatti-bolide",
    manufacturer: "Bugatti", name: "Bolide", fullName: "Bugatti Bolide",
    class: "hypercar", rarity: "hypercar",
    tagline: "Track-focused Bugatti. Ultra-low, massive aero, radical form.",
    price: 16500, unlockNote: "Complete Hypercar Summit.",
    defaultPaint: "#0f172a",
    shape: shapeFor("hyper", "bar", "gt", 4, 0.83, 0.12),
    stats: { top: 1.28, accel: 1.16, grip: 1.04, nitro: 1.22 },
    balance: BAL(1.28, 1.16, 1.04, 1.22, 1.08, 1.08),
    drivetrain: "AWD", engineType: "W16 Track (game representation)", powertrain: "Petrol",
    bodyType: "Hypercar", wheelStyle: "Aero alloy", exhaust: "Top-exit exhausts",
    exhaustCount: 4, doors: 2, cockpit: "Track cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },
  {
    id: "koenigsegg-jesko",
    manufacturer: "Koenigsegg", name: "Jesko", fullName: "Koenigsegg Jesko",
    class: "hypercar", rarity: "hypercar",
    tagline: "Ultra-low canopy, maximum downforce, massive rear wing.",
    price: 18000, unlockNote: "Complete Final Circuit.",
    defaultPaint: "#d4d4d8",
    shape: shapeFor("hyper", "bar", "gt", 2, 0.83, 0.125),
    stats: { top: 1.30, accel: 1.16, grip: 1.0, nitro: 1.25 },
    balance: BAL(1.30, 1.16, 1.0, 1.25, 1.06, 1.06),
    drivetrain: "RWD", engineType: "Twin-turbo V8 (game representation)", powertrain: "Petrol",
    bodyType: "Hypercar", wheelStyle: "Carbon centre-lock", exhaust: "Dual exhausts",
    exhaustCount: 2, doors: 2, cockpit: "Speed cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },
  {
    id: "koenigsegg-regera",
    manufacturer: "Koenigsegg", name: "Regera", fullName: "Koenigsegg Regera",
    class: "hypercar", rarity: "hypercar",
    tagline: "Hybrid mega-GT. Smoother grand-tourer proportions, unique rear.",
    price: 16000, unlockNote: "Complete Hypercar Summit.",
    defaultPaint: "#7c3aed",
    shape: shapeFor("hyper", "bar", "wing", 2, 0.82, 0.135),
    stats: { top: 1.24, accel: 1.18, grip: 1.04, nitro: 1.20 },
    balance: BAL(1.24, 1.18, 1.04, 1.20, 1.04, 1.04),
    drivetrain: "RWD", engineType: "Hybrid V8 (game representation)", powertrain: "Hybrid",
    bodyType: "Mega-GT", wheelStyle: "Aero alloy", exhaust: "Dual exhausts",
    exhaustCount: 2, doors: 2, cockpit: "Mega-GT cockpit", sourceNote: SRC, realWorld: RW("Game balance only."),
  },
];

export const CARS_BY_CLASS: Record<CarClass, CarDef[]> = {
  starter: CARS.filter((c) => c.class === "starter"),
  sport: CARS.filter((c) => c.class === "sport"),
  supercar: CARS.filter((c) => c.class === "supercar"),
  hypercar: CARS.filter((c) => c.class === "hypercar"),
};

export const PAINTS = [
  { id: "p_teal", name: "Reef Teal", hex: "#2dd4bf", price: 0 },
  { id: "p_red", name: "Rosso Corsa", hex: "#dc2626", price: 150 },
  { id: "p_blue", name: "Azure", hex: "#3b82f6", price: 150 },
  { id: "p_yellow", name: "Solar Flare", hex: "#facc15", price: 200 },
  { id: "p_white", name: "Pearl White", hex: "#e2e8f0", price: 200 },
  { id: "p_black", name: "Midnight", hex: "#1f2937", price: 250 },
  { id: "p_purple", name: "Ultraviolet", hex: "#a855f7", price: 300 },
  { id: "p_lime", name: "Acid Lime", hex: "#84cc16", price: 300 },
  { id: "p_pink", name: "Hot Magenta", hex: "#ec4899", price: 350 },
  { id: "p_gold", name: "Champagne Gold", hex: "#d4a017", price: 600 },
  { id: "p_chrome", name: "Liquid Chrome", hex: "#9ca3af", price: 900 },
];

export const RIMS: { id: RimStyle; name: string; price: number }[] = [
  { id: "steel", name: "Steel", price: 0 },
  { id: "sport", name: "Sport Alloy", price: 250 },
  { id: "chrome", name: "Chrome", price: 450 },
  { id: "neon", name: "Neon Ring", price: 700 },
];

export const WHEELS: { id: WheelStyleId; name: string; price: number; desc: string }[] = [
  { id: "steel", name: "Steel", price: 0, desc: "Stock steel wheel" },
  { id: "sport", name: "Sport Alloy", price: 250, desc: "Light sport alloy" },
  { id: "chrome", name: "Chrome", price: 450, desc: "Polished show wheel" },
  { id: "neon", name: "Neon Ring", price: 700, desc: "Illuminated rim ring" },
  { id: "forged", name: "Forged GT", price: 900, desc: "Forged performance wheel" },
  { id: "carbon", name: "Carbon Aero", price: 1200, desc: "Carbon aero wheel" },
  { id: "track", name: "Track Centre-lock", price: 1500, desc: "Motorsport look" },
];

export const SPOILERS: { id: SpoilerStyle | "stock"; name: string; price: number }[] = [
  { id: "stock", name: "Stock", price: 0 },
  { id: "lip", name: "Ducktail Lip", price: 200 },
  { id: "wing", name: "Street Wing", price: 450 },
  { id: "gt", name: "GT Wing", price: 800 },
];

export const GLOWS = [
  { id: "none", name: "Off", price: 0 },
  { id: "#22d3ee", name: "Cyan Glow", price: 400 },
  { id: "#e879f9", name: "Magenta Glow", price: 400 },
  { id: "#fbbf24", name: "Amber Glow", price: 400 },
  { id: "#4ade80", name: "Emerald Glow", price: 400 },
  { id: "#f43f5e", name: "Crimson Glow", price: 400 },
];

export const DECALS: { id: DecalStyle; name: string; price: number }[] = [
  { id: "none", name: "Clean", price: 0 },
  { id: "stripes", name: "Racing Stripes", price: 250 },
  { id: "number", name: "Race Number", price: 300 },
  { id: "checker", name: "Checker Band", price: 350 },
];

export const UPGRADE_DEFS: { key: keyof CarUpgrades; name: string; desc: string; icon: string }[] = [
  { key: "engine", name: "Engine", desc: "+6% top speed per level", icon: "E" },
  { key: "turbo", name: "Turbo", desc: "+12% accel per level", icon: "T" },
  { key: "tires", name: "Tires", desc: "-20% typo penalty per level", icon: "O" },
  { key: "nitro", name: "Nitro", desc: "+15% boost per level", icon: "N" },
];

export const UPGRADE_COSTS = [400, 900, 1600];
export const MAX_UPGRADE = 3;
export const DEFAULT_UPGRADES: CarUpgrades = { engine: 0, turbo: 0, tires: 0, nitro: 0 };

export function defaultCustomization(def: CarDef): CarCustomization {
  return {
    paint: def.defaultPaint,
    rims: "steel",
    wheels: "sport",
    spoiler: "stock",
    wing: "stock",
    glow: "none",
    decal: "none",
    headlight: "stock",
    headlightTint: "#e2e8f0",
    drl: "stock",
    splitter: "stock",
    diffuser: "stock",
    skirts: "stock",
    mirrors: "stock",
    hood: "stock",
    roof: "stock",
    seats: "stock",
    steering: "stock",
    trim: "stock",
    ambient: "none",
    brakes: "stock",
    suspension: "stock",
    tires: "stock",
  };
}

export function getCar(id: string): CarDef {
  return CARS.find((c) => c.id === migrateCarId(id)) ?? CARS[0];
}

export function buildFromProfile(profile: Profile): CarBuild {
  const def = getCar(profile.selectedCar);
  return {
    def,
    custom: { ...defaultCustomization(def), ...(profile.customizations[def.id] ?? {}) },
    upgrades: { ...DEFAULT_UPGRADES, ...(profile.upgrades[def.id] ?? {}) },
    plate: (profile.name || "ACE").toUpperCase().slice(0, 7),
  };
}

export function effectiveStats(build: CarBuild) {
  const s = build.def.stats;
  const u = build.upgrades;
  return {
    top: s.top * (1 + 0.06 * u.engine),
    accel: s.accel * (1 + 0.12 * u.turbo),
    grip: s.grip * (1 + 0.2 * u.tires),
    nitro: s.nitro * (1 + 0.15 * u.nitro),
  };
}

export function resolvedSpoiler(build: CarBuild): SpoilerStyle {
  const wing = build.custom.wing && build.custom.wing !== "stock" ? build.custom.wing : undefined;
  const base = build.custom.spoiler === "stock" ? build.def.shape.spoiler : build.custom.spoiler;
  return (wing ?? base) as SpoilerStyle;
}

export function resolvedWheels(build: CarBuild): string {
  return build.custom.wheels ?? build.custom.rims;
}

export const RIVALS = [
  { def: getCar("bmw-m4-competition"), paint: "#f59e0b", name: "Blaze" },
  { def: getCar("porsche-911-turbo-s"), paint: "#e5e7eb", name: "Ghost" },
  { def: getCar("ferrari-sf90-stradale"), paint: "#10b981", name: "Viper" },
  { def: getCar("lamborghini-aventador-svj"), paint: "#ec4899", name: "Pixel" },
  { def: getCar("mclaren-720s"), paint: "#3b82f6", name: "Tank" },
];