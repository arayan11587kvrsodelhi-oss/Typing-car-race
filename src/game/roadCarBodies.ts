import * as THREE from "three";

/**
 * Shared palette plus wheel / body template colours for the road-car body
 * generators.
 *
 * NOTE: this module previously carried the body generators for every road car
 * (the seven model-specific architectures now live in
 * `src/components/garage/CarModel3D.tsx`).  An accidental paste left only the
 * colour declarations and stamped *three* copies of the whole block into the
 * file, which is what produced the `TS2451: Cannot redeclare block-scoped
 * variable` flood.  The duplicates are removed below and one canonical copy is
 * exported for reuse.
 */

// Paint colours ------------------------------------------------------------
const RED = new THREE.Color("#dc2626");
const BLUE = new THREE.Color("#3b82f6");
const GREEN = new THREE.Color("#10b981");
const AMBER = new THREE.Color("#f59e0b");
const WHITE = new THREE.Color("#e2e8f0");
const BLACK = new THREE.Color("#111827");
const GREY = new THREE.Color("#94a3b8");
const TEAL = new THREE.Color("#2dd4bf");
const PURPLE = new THREE.Color("#a855f7");
const CYAN = new THREE.Color("#22d3ee");
const NAVY = new THREE.Color("#0f172a");
const GRAY = new THREE.Color("#d4d4d8");
const DARK = new THREE.Color("#1e3a8a");
const METALLIC = new THREE.Color("#9ca3af");
const HIGHLIGHT = new THREE.Color("#fbbf24");
const RED2 = new THREE.Color("#e11d48");
const NAVY2 = new THREE.Color("#0f172a");
const BLUE2 = new THREE.Color("#3b82f6");

// Wheel template colours ----------------------------------------------------
const WHEEL = "#0b0e16";
const CALP = "#3b82f6";
const CALD = "#1e40af";

const WHEELS_TEMPLATE: string[] = [WHEEL, WHEEL, WHEEL, WHEEL];
const BODY_TEMPLATE = new THREE.Color("#e2e8f0");

/**
 * Body-type palette used by the road-car archetypes.  Single source of truth
 * for the accent colours each body style paints with.
 */
export const CAR_BODY_TEMPLATES: Record<
  string,
  { body: THREE.Color; wheels: string[]; accent: THREE.Color }
> = {
  coupe: { body: RED2, wheels: WHEELS_TEMPLATE, accent: HIGHLIGHT },
  roadster: { body: BLUE2, wheels: WHEELS_TEMPLATE, accent: CYAN },
  hypercar: { body: NAVY2, wheels: WHEELS_TEMPLATE, accent: METALLIC },
  gt: { body: DARK, wheels: WHEELS_TEMPLATE, accent: HIGHLIGHT },
  "track-car": { body: RED, wheels: WHEELS_TEMPLATE, accent: WHITE },
  "mega-gt": { body: PURPLE, wheels: WHEELS_TEMPLATE, accent: TEAL },
};

/** Shared paint palette. */
export const CAR_PAINT = {
  RED, BLUE, GREEN, AMBER, WHITE, BLACK, GREY, TEAL, PURPLE,
  CYAN, NAVY, GRAY, DARK, METALLIC, HIGHLIGHT, RED2, NAVY2, BLUE2,
} as const;

/** Wheel / caliper defaults reused by the geometry generators. */
export const CAR_WHEEL_COLORS = { WHEEL, CALP, CALD } as const;

/** Default body shell colour. */
export const CAR_BODY_DEFAULT = BODY_TEMPLATE;