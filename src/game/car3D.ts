/**
 * car3D.ts — per-model 3D geometry profiles.
 *
 * Every CarGeometry3D entry describes the real silhouette proportions of the
 * named model.  The procedural renderer in CarViewer3D.tsx reads these values
 * to produce visibly different shapes for every car.
 *
 * Units: Three.js world units.  The car is centred at the origin and sits on
 * y = 0.  All values are relative so scaling works cleanly.
 */

export interface WheelGeometry3D {
  radius: number;          // tyre radius
  width: number;           // tyre width
  rimSpokes: number;       // number of spokes (3-12)
  rimStyle: "multi-spoke" | "mesh" | "turbine" | "centerlock" | "aero-dish";
  rimDepth: number;        // how concave/flat the rim face looks (0–1)
  trackWidth: number;      // lateral distance from body centre to wheel centre
  wheelbase: number;       // half-wheelbase (front & rear use same for symmetry)
  frontOffset: number;     // longitudinal position of front axle (+ = forward)
  rearOffset: number;      // longitudinal position of rear axle (- = rearward)
  caliperColor: string;    // brake caliper hex colour
  hasCentrelock: boolean;
}

export interface AeroGeometry3D {
  hasFrontSplitter: boolean;
  splitterDepth: number;     // how far the splitter sticks out front
  splitterWidth: number;     // 0–1 fraction of body width
  hasSideSkirts: boolean;
  sideSkirtHeight: number;
  hasRearWing: boolean;
  wingHeight: number;        // Y rise from boot lid
  wingWidth: number;         // 0–1 fraction of body width
  wingChord: number;         // depth of wing element
  wingEndplates: boolean;
  hasDiffuser: boolean;
  diffuserAngle: number;     // degrees upward tilt
  diffuserWidth: number;
  diffuserFins: number;
  hasHoodVents: boolean;
  hasRoofScoop: boolean;
  hasLargeIntakes: boolean;  // side / rear intakes visible from exterior
}

export interface LightingGeometry3D {
  // Headlights
  headlightShape: "round" | "narrow-strip" | "y-shape" | "diamond" | "quad-round" | "swept";
  headlightWidth: number;    // 0–1 fraction of half-body-width
  headlightY: number;        // height above ground (world units)
  headlightColor: string;
  drlShape: "none" | "ring" | "strip" | "L" | "C-shape";
  // Taillights
  taillightShape: "bar" | "round" | "boomerang" | "y-shape" | "vertical-strip" | "full-width";
  taillightY: number;
  taillightColor: string;
}

export interface BodyGeometry3D {
  // Overall envelope
  length: number;   // total body length
  width: number;    // max body width
  height: number;   // total height roof to ground
  rideHeight: number; // underbody clearance

  // Longitudinal proportions (0 = nose, 1 = tail)
  noseLength: number;       // fraction of total length to front axle
  cabinStart: number;       // fraction where A-pillar starts
  cabinEnd: number;         // fraction where C-pillar ends
  tailLength: number;       // fraction of total length behind rear axle

  // Cross-section shaping
  shoulderWidth: number;    // max width fraction at shoulder vs. at sill (>1 = wider shoulders)
  rearHaunchWidth: number;  // rear quarter panel flare (>1 = wider rear)
  frontFascia: number;      // how tall the front bumper/fascia is (fraction of height)

  // Roof / cabin
  roofHeight: number;       // how high the roof peak is above body sill
  roofWidth: number;        // 0–1 fraction of body width at roof
  roofLengthFraction: number; // fraction of total length the roof occupies
  aRoofLine: "fastback" | "notchback" | "coupe" | "targa" | "roadster" | "hatch";
  windshieldAngle: number;  // degrees of rake (45 = steep, 70 = near horizontal)
  rearScreenAngle: number;

  // Hood
  hoodHeight: number;       // height of the hood above body sill
  hoodRise: number;         // does the hood have a pronounced bulge? 0–1

  // Tail
  bootHeight: number;       // height of boot / tail above sill
  bootType: "fastback" | "notchback" | "kamm" | "ducktail" | "flat-tail";

  // Body character lines (simplified descriptor)
  characterLines: string[]; // e.g. ["Hofmeister kink", "shoulder crease", "sill step"]

  // Number of exhaust outlets and their layout
  exhaustCount: 1 | 2 | 4;
  exhaustLayout: "centre" | "split" | "wide-split" | "quad-corners" | "top-exit";
  exhaustDiameter: number;

  // Front grille type
  grilleType: "kidney" | "horseshoe" | "wide-mesh" | "full-width-diffuser" | "minimal" | "louvred" | "clamshell";
  grilleWidth: number;
  grilleHeight: number;
}

export interface CarGeometry3D {
  id: string;                // must match CarDef.id
  bodyStyle: "coupe" | "roadster" | "hypercar" | "gt" | "track-car" | "mega-gt";
  body: BodyGeometry3D;
  wheels: WheelGeometry3D;
  aero: AeroGeometry3D;
  lighting: LightingGeometry3D;

  // Per-car material overrides (paint PBR tuning)
  clearcoatStrength: number;   // 0–1
  metallicness: number;        // 0–1
  roughness: number;           // 0–1

  // Caliper colours per manufacturer
  caliperColor: string;
}

// ---------------------------------------------------------------------------
// Per-car profile definitions
// ---------------------------------------------------------------------------

const profiles: CarGeometry3D[] = [

  // ── BMW M3 Competition ─────────────────────────────────────────────────
  {
    id: "bmw-m3-competition",
    bodyStyle: "coupe",
    body: {
      // Real specs: 4 794 mm long · 1 901 mm wide · 1 433 mm tall · 2 857 mm wheelbase
      length: 4.79, width: 1.90, height: 1.43, rideHeight: 0.120,
      noseLength: 0.40, cabinStart: 0.38, cabinEnd: 0.72, tailLength: 0.28,
      shoulderWidth: 1.05, rearHaunchWidth: 1.04, frontFascia: 0.26,
      roofHeight: 0.42, roofWidth: 0.70, roofLengthFraction: 0.38,
      aRoofLine: "notchback", windshieldAngle: 58, rearScreenAngle: 62,
      hoodHeight: 0.30, hoodRise: 0.35,
      bootHeight: 0.28, bootType: "notchback",
      characterLines: ["shoulder crease", "sill step", "M-vent"],
      exhaustCount: 4, exhaustLayout: "quad-corners", exhaustDiameter: 0.065,
      grilleType: "kidney", grilleWidth: 0.52, grilleHeight: 0.22,
    },
    wheels: {
      radius: 0.345, width: 0.245, rimSpokes: 10, rimStyle: "multi-spoke",
      rimDepth: 0.6, trackWidth: 0.78, wheelbase: 1.43,
      frontOffset: 1.20, rearOffset: -1.20, caliperColor: "#1d4ed8",
      hasCentrelock: false,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.07, splitterWidth: 0.78,
      hasSideSkirts: true, sideSkirtHeight: 0.055,
      hasRearWing: false, wingHeight: 0, wingWidth: 0, wingChord: 0, wingEndplates: false,
      hasDiffuser: true, diffuserAngle: 18, diffuserWidth: 0.65, diffuserFins: 5,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "narrow-strip", headlightWidth: 0.42, headlightY: 0.80,
      headlightColor: "#dbeafe", drlShape: "L",
      taillightShape: "boomerang", taillightY: 0.94, taillightColor: "#ff2020",
    },
    clearcoatStrength: 0.9, metallicness: 0.8, roughness: 0.18, caliperColor: "#1d4ed8",
  },

  // ── BMW M4 Competition ─────────────────────────────────────────────────
  {
    id: "bmw-m4-competition",
    bodyStyle: "coupe",
    body: {
      length: 4.79, width: 1.88, height: 1.39, rideHeight: 0.110,
      noseLength: 0.41, cabinStart: 0.39, cabinEnd: 0.73, tailLength: 0.27,
      shoulderWidth: 1.06, rearHaunchWidth: 1.10, frontFascia: 0.25,
      roofHeight: 0.50, roofWidth: 0.68, roofLengthFraction: 0.36,
      aRoofLine: "coupe", windshieldAngle: 62, rearScreenAngle: 60,
      hoodHeight: 0.28, hoodRise: 0.30,
      bootHeight: 0.24, bootType: "notchback",
      characterLines: ["shoulder crease", "sill step", "M-vent line", "trailing edge"],
      exhaustCount: 4, exhaustLayout: "quad-corners", exhaustDiameter: 0.068,
      grilleType: "kidney", grilleWidth: 0.56, grilleHeight: 0.26,
    },
    wheels: {
      radius: 0.35, width: 0.25, rimSpokes: 10, rimStyle: "multi-spoke",
      rimDepth: 0.65, trackWidth: 0.78, wheelbase: 1.44,
      frontOffset: 1.22, rearOffset: -1.22, caliperColor: "#1d4ed8",
      hasCentrelock: false,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.08, splitterWidth: 0.80,
      hasSideSkirts: true, sideSkirtHeight: 0.055,
      hasRearWing: false, wingHeight: 0, wingWidth: 0, wingChord: 0, wingEndplates: false,
      hasDiffuser: true, diffuserAngle: 20, diffuserWidth: 0.68, diffuserFins: 5,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "narrow-strip", headlightWidth: 0.44, headlightY: 0.72,
      headlightColor: "#dbeafe", drlShape: "L",
      taillightShape: "boomerang", taillightY: 0.65, taillightColor: "#ff2020",
    },
    clearcoatStrength: 0.9, metallicness: 0.82, roughness: 0.17, caliperColor: "#1d4ed8",
  },

  // ── Porsche 911 GT3 RS ─────────────────────────────────────────────────
  {
    id: "porsche-911-gt3-rs",
    bodyStyle: "track-car",
    body: {
      // Real specs: 4 572 mm long · 1 900 mm body width (2 027 mm incl. mirrors)
      //             1 322 mm tall · 2 457 mm wheelbase
      length: 4.57, width: 1.90, height: 1.32, rideHeight: 0.100,
      noseLength: 0.36, cabinStart: 0.33, cabinEnd: 0.67, tailLength: 0.34,
      shoulderWidth: 1.06, rearHaunchWidth: 1.08, frontFascia: 0.22,
      roofHeight: 0.36, roofWidth: 0.66, roofLengthFraction: 0.36,
      aRoofLine: "coupe", windshieldAngle: 55, rearScreenAngle: 55,
      hoodHeight: 0.25, hoodRise: 0.12,
      bootHeight: 0.30, bootType: "ducktail",
      characterLines: ["rear haunch", "sill crease", "flying buttress"],
      exhaustCount: 2, exhaustLayout: "split", exhaustDiameter: 0.080,
      grilleType: "wide-mesh", grilleWidth: 0.70, grilleHeight: 0.18,
    },
    wheels: {
      radius: 0.36, width: 0.27, rimSpokes: 5, rimStyle: "centerlock",
      rimDepth: 0.7, trackWidth: 0.80, wheelbase: 1.40,
      frontOffset: 1.18, rearOffset: -1.25, caliperColor: "#ffd700",
      hasCentrelock: true,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.12, splitterWidth: 0.88,
      hasSideSkirts: true, sideSkirtHeight: 0.065,
      hasRearWing: true, wingHeight: 0.34, wingWidth: 0.94, wingChord: 0.28, wingEndplates: true,
      hasDiffuser: true, diffuserAngle: 28, diffuserWidth: 0.72, diffuserFins: 7,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "round", headlightWidth: 0.32, headlightY: 0.67,
      headlightColor: "#f0f4ff", drlShape: "ring",
      taillightShape: "round", taillightY: 0.84, taillightColor: "#ff2020",
    },
    clearcoatStrength: 0.85, metallicness: 0.75, roughness: 0.22, caliperColor: "#ffd700",
  },

  // ── Porsche 911 Turbo S ────────────────────────────────────────────────
  {
    id: "porsche-911-turbo-s",
    bodyStyle: "coupe",
    body: {
      // Real specs: 4 535 mm long · 1 900 mm wide · 1 302 mm tall
      length: 4.53, width: 1.90, height: 1.30, rideHeight: 0.100,
      noseLength: 0.37, cabinStart: 0.33, cabinEnd: 0.67, tailLength: 0.33,
      shoulderWidth: 1.06, rearHaunchWidth: 1.08, frontFascia: 0.24,
      roofHeight: 0.34, roofWidth: 0.66, roofLengthFraction: 0.35,
      aRoofLine: "coupe", windshieldAngle: 55, rearScreenAngle: 56,
      hoodHeight: 0.25, hoodRise: 0.10,
      bootHeight: 0.29, bootType: "ducktail",
      characterLines: ["rear haunch", "sill crease"],
      exhaustCount: 2, exhaustLayout: "split", exhaustDiameter: 0.072,
      grilleType: "wide-mesh", grilleWidth: 0.65, grilleHeight: 0.16,
    },
    wheels: {
      radius: 0.355, width: 0.265, rimSpokes: 10, rimStyle: "turbine",
      rimDepth: 0.55, trackWidth: 0.80, wheelbase: 1.38,
      frontOffset: 1.16, rearOffset: -1.22, caliperColor: "#facc15",
      hasCentrelock: false,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.08, splitterWidth: 0.80,
      hasSideSkirts: true, sideSkirtHeight: 0.050,
      hasRearWing: true, wingHeight: 0.10, wingWidth: 0.82, wingChord: 0.20, wingEndplates: false,
      hasDiffuser: true, diffuserAngle: 22, diffuserWidth: 0.68, diffuserFins: 5,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "round", headlightWidth: 0.32, headlightY: 0.66,
      headlightColor: "#f0f4ff", drlShape: "ring",
      taillightShape: "bar", taillightY: 0.82, taillightColor: "#ff2020",
    },
    clearcoatStrength: 0.92, metallicness: 0.82, roughness: 0.16, caliperColor: "#facc15",
  },

  // ── Bugatti Chiron ─────────────────────────────────────────────────────
  {
    id: "bugatti-chiron",
    bodyStyle: "hypercar",
    body: {
      // Real specs: 4 544 mm long · 2 038 mm wide · 1 212 mm tall
      length: 4.54, width: 2.04, height: 1.21, rideHeight: 0.095,
      noseLength: 0.38, cabinStart: 0.36, cabinEnd: 0.64, tailLength: 0.36,
      shoulderWidth: 1.04, rearHaunchWidth: 1.04, frontFascia: 0.28,
      roofHeight: 0.33, roofWidth: 0.62, roofLengthFraction: 0.30,
      aRoofLine: "coupe", windshieldAngle: 65, rearScreenAngle: 70,
      hoodHeight: 0.28, hoodRise: 0.15,
      bootHeight: 0.24, bootType: "kamm",
      characterLines: ["C-line", "front arch crease", "sill"],
      exhaustCount: 4, exhaustLayout: "wide-split", exhaustDiameter: 0.058,
      grilleType: "horseshoe", grilleWidth: 0.55, grilleHeight: 0.28,
    },
    wheels: {
      radius: 0.38, width: 0.28, rimSpokes: 8, rimStyle: "turbine",
      rimDepth: 0.5, trackWidth: 0.85, wheelbase: 1.50,
      frontOffset: 1.28, rearOffset: -1.28, caliperColor: "#1e3a8a",
      hasCentrelock: false,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.10, splitterWidth: 0.86,
      hasSideSkirts: true, sideSkirtHeight: 0.04,
      hasRearWing: false, wingHeight: 0, wingWidth: 0, wingChord: 0, wingEndplates: false,
      hasDiffuser: true, diffuserAngle: 20, diffuserWidth: 0.80, diffuserFins: 6,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "narrow-strip", headlightWidth: 0.50, headlightY: 0.72,
      headlightColor: "#e8f4ff", drlShape: "C-shape",
      taillightShape: "full-width", taillightY: 0.74, taillightColor: "#ff2020",
    },
    clearcoatStrength: 1.0, metallicness: 0.88, roughness: 0.12, caliperColor: "#1e3a8a",
  },

  // ── Bugatti Bolide ─────────────────────────────────────────────────────
  {
    id: "bugatti-bolide",
    bodyStyle: "track-car",
    body: {
      length: 4.62, width: 2.00, height: 1.07, rideHeight: 0.060,
      noseLength: 0.42, cabinStart: 0.40, cabinEnd: 0.66, tailLength: 0.34,
      shoulderWidth: 1.00, rearHaunchWidth: 1.02, frontFascia: 0.32,
      roofHeight: 0.26, roofWidth: 0.50, roofLengthFraction: 0.28,
      aRoofLine: "targa", windshieldAngle: 72, rearScreenAngle: 78,
      hoodHeight: 0.22, hoodRise: 0.05,
      bootHeight: 0.15, bootType: "flat-tail",
      characterLines: ["upper spine", "lower diffuser crease", "side vent cascade"],
      exhaustCount: 4, exhaustLayout: "top-exit", exhaustDiameter: 0.050,
      grilleType: "full-width-diffuser", grilleWidth: 0.82, grilleHeight: 0.32,
    },
    wheels: {
      radius: 0.36, width: 0.30, rimSpokes: 5, rimStyle: "aero-dish",
      rimDepth: 0.4, trackWidth: 0.84, wheelbase: 1.50,
      frontOffset: 1.30, rearOffset: -1.30, caliperColor: "#e11d48",
      hasCentrelock: true,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.18, splitterWidth: 0.90,
      hasSideSkirts: true, sideSkirtHeight: 0.035,
      hasRearWing: true, wingHeight: 0.40, wingWidth: 0.96, wingChord: 0.32, wingEndplates: true,
      hasDiffuser: true, diffuserAngle: 35, diffuserWidth: 0.86, diffuserFins: 8,
      hasHoodVents: true, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "narrow-strip", headlightWidth: 0.55, headlightY: 0.52,
      headlightColor: "#e8f4ff", drlShape: "C-shape",
      taillightShape: "full-width", taillightY: 0.52, taillightColor: "#ff2020",
    },
    clearcoatStrength: 0.8, metallicness: 0.65, roughness: 0.28, caliperColor: "#e11d48",
  },

  // ── Koenigsegg Jesko ───────────────────────────────────────────────────
  {
    id: "koenigsegg-jesko",
    bodyStyle: "hypercar",
    body: {
      // Real specs: 4 626 mm long · 2 030 mm wide · 1 210 mm tall · 2 700 mm wheelbase
      length: 4.68, width: 2.03, height: 1.21, rideHeight: 0.080,
      noseLength: 0.43, cabinStart: 0.41, cabinEnd: 0.65, tailLength: 0.35,
      shoulderWidth: 1.02, rearHaunchWidth: 1.04, frontFascia: 0.28,
      roofHeight: 0.31, roofWidth: 0.52, roofLengthFraction: 0.26,
      aRoofLine: "roadster", windshieldAngle: 68, rearScreenAngle: 75,
      hoodHeight: 0.26, hoodRise: 0.08,
      bootHeight: 0.18, bootType: "flat-tail",
      characterLines: ["upper spine", "side scallop", "rocker line"],
      exhaustCount: 2, exhaustLayout: "wide-split", exhaustDiameter: 0.070,
      grilleType: "louvred", grilleWidth: 0.65, grilleHeight: 0.22,
    },
    wheels: {
      radius: 0.38, width: 0.29, rimSpokes: 5, rimStyle: "centerlock",
      rimDepth: 0.6, trackWidth: 0.84, wheelbase: 1.54,
      frontOffset: 1.32, rearOffset: -1.32, caliperColor: "#94a3b8",
      hasCentrelock: true,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.14, splitterWidth: 0.84,
      hasSideSkirts: true, sideSkirtHeight: 0.05,
      hasRearWing: true, wingHeight: 0.38, wingWidth: 1.00, wingChord: 0.26, wingEndplates: true,
      hasDiffuser: true, diffuserAngle: 30, diffuserWidth: 0.82, diffuserFins: 7,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "swept", headlightWidth: 0.48, headlightY: 0.68,
      headlightColor: "#f0f8ff", drlShape: "strip",
      taillightShape: "vertical-strip", taillightY: 0.74, taillightColor: "#ff1a1a",
    },
    clearcoatStrength: 0.85, metallicness: 0.75, roughness: 0.20, caliperColor: "#94a3b8",
  },

  // ── Koenigsegg Regera ──────────────────────────────────────────────────
  {
    id: "koenigsegg-regera",
    bodyStyle: "mega-gt",
    body: {
      length: 4.70, width: 2.00, height: 1.19, rideHeight: 0.090,
      noseLength: 0.41, cabinStart: 0.39, cabinEnd: 0.67, tailLength: 0.33,
      shoulderWidth: 1.05, rearHaunchWidth: 1.04, frontFascia: 0.27,
      roofHeight: 0.32, roofWidth: 0.56, roofLengthFraction: 0.30,
      aRoofLine: "fastback", windshieldAngle: 64, rearScreenAngle: 68,
      hoodHeight: 0.27, hoodRise: 0.10,
      bootHeight: 0.20, bootType: "fastback",
      characterLines: ["side scallop", "door crease", "rocker"],
      exhaustCount: 2, exhaustLayout: "split", exhaustDiameter: 0.066,
      grilleType: "louvred", grilleWidth: 0.60, grilleHeight: 0.20,
    },
    wheels: {
      radius: 0.375, width: 0.27, rimSpokes: 5, rimStyle: "centerlock",
      rimDepth: 0.65, trackWidth: 0.83, wheelbase: 1.52,
      frontOffset: 1.28, rearOffset: -1.28, caliperColor: "#7c3aed",
      hasCentrelock: true,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.11, splitterWidth: 0.80,
      hasSideSkirts: true, sideSkirtHeight: 0.045,
      hasRearWing: false, wingHeight: 0, wingWidth: 0, wingChord: 0, wingEndplates: false,
      hasDiffuser: true, diffuserAngle: 24, diffuserWidth: 0.76, diffuserFins: 6,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "swept", headlightWidth: 0.46, headlightY: 0.68,
      headlightColor: "#f0f8ff", drlShape: "strip",
      taillightShape: "boomerang", taillightY: 0.76, taillightColor: "#ff2020",
    },
    clearcoatStrength: 0.88, metallicness: 0.80, roughness: 0.18, caliperColor: "#7c3aed",
  },

  // ── Lamborghini Aventador SVJ ──────────────────────────────────────────
  {
    id: "lamborghini-aventador-svj",
    bodyStyle: "hypercar",
    body: {
      // Real specs (incl. mirrors): 4 943 mm long · 2 098 mm wide · 1 136 mm tall
      length: 4.95, width: 2.10, height: 1.14, rideHeight: 0.095,
      noseLength: 0.44, cabinStart: 0.42, cabinEnd: 0.66, tailLength: 0.34,
      shoulderWidth: 1.02, rearHaunchWidth: 1.05, frontFascia: 0.33,
      roofHeight: 0.28, roofWidth: 0.52, roofLengthFraction: 0.26,
      aRoofLine: "targa", windshieldAngle: 70, rearScreenAngle: 80,
      hoodHeight: 0.22, hoodRise: 0.06,
      bootHeight: 0.20, bootType: "flat-tail",
      characterLines: ["angular Y", "rear blade", "door crease", "front splitter edge"],
      exhaustCount: 2, exhaustLayout: "centre", exhaustDiameter: 0.072,
      grilleType: "louvred", grilleWidth: 0.72, grilleHeight: 0.26,
    },
    wheels: {
      radius: 0.395, width: 0.30, rimSpokes: 5, rimStyle: "aero-dish",
      rimDepth: 0.4, trackWidth: 1.10, wheelbase: 1.54,
      frontOffset: 1.32, rearOffset: -1.32, caliperColor: "#d4a017",
      hasCentrelock: false,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.16, splitterWidth: 0.88,
      hasSideSkirts: true, sideSkirtHeight: 0.04,
      hasRearWing: true, wingHeight: 0.28, wingWidth: 0.95, wingChord: 0.24, wingEndplates: true,
      hasDiffuser: true, diffuserAngle: 30, diffuserWidth: 0.84, diffuserFins: 7,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "y-shape", headlightWidth: 0.45, headlightY: 0.64,
      headlightColor: "#dbeafe", drlShape: "L",
      taillightShape: "y-shape", taillightY: 0.69, taillightColor: "#ff1a1a",
    },
    clearcoatStrength: 0.82, metallicness: 0.72, roughness: 0.22, caliperColor: "#d4a017",
  },

  // ── Lamborghini Revuelto ───────────────────────────────────────────────
  {
    id: "lamborghini-revuelto",
    bodyStyle: "hypercar",
    body: {
      length: 4.94, width: 2.08, height: 1.13, rideHeight: 0.092,
      noseLength: 0.44, cabinStart: 0.42, cabinEnd: 0.65, tailLength: 0.35,
      shoulderWidth: 1.02, rearHaunchWidth: 1.06, frontFascia: 0.34,
      roofHeight: 0.27, roofWidth: 0.52, roofLengthFraction: 0.25,
      aRoofLine: "targa", windshieldAngle: 72, rearScreenAngle: 82,
      hoodHeight: 0.20, hoodRise: 0.05,
      bootHeight: 0.13, bootType: "flat-tail",
      characterLines: ["Y-blade", "side intake", "rear fin", "front wing"],
      exhaustCount: 4, exhaustLayout: "wide-split", exhaustDiameter: 0.060,
      grilleType: "louvred", grilleWidth: 0.76, grilleHeight: 0.28,
    },
    wheels: {
      radius: 0.40, width: 0.31, rimSpokes: 5, rimStyle: "aero-dish",
      rimDepth: 0.38, trackWidth: 1.12, wheelbase: 1.55,
      frontOffset: 1.33, rearOffset: -1.33, caliperColor: "#a855f7",
      hasCentrelock: false,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.18, splitterWidth: 0.90,
      hasSideSkirts: true, sideSkirtHeight: 0.038,
      hasRearWing: true, wingHeight: 0.24, wingWidth: 0.92, wingChord: 0.22, wingEndplates: true,
      hasDiffuser: true, diffuserAngle: 32, diffuserWidth: 0.86, diffuserFins: 8,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "y-shape", headlightWidth: 0.46, headlightY: 0.56,
      headlightColor: "#dbeafe", drlShape: "L",
      taillightShape: "y-shape", taillightY: 0.55, taillightColor: "#ff1a1a",
    },
    clearcoatStrength: 0.80, metallicness: 0.70, roughness: 0.24, caliperColor: "#a855f7",
  },

  // ── Ferrari SF90 Stradale ──────────────────────────────────────────────
  {
    id: "ferrari-sf90-stradale",
    bodyStyle: "hypercar",
    body: {
      // Real specs: 4 710 mm long · 1 972 mm wide · 1 186 mm tall
      length: 4.71, width: 1.99, height: 1.19, rideHeight: 0.095,
      noseLength: 0.42, cabinStart: 0.40, cabinEnd: 0.65, tailLength: 0.35,
      shoulderWidth: 1.04, rearHaunchWidth: 1.05, frontFascia: 0.28,
      roofHeight: 0.32, roofWidth: 0.54, roofLengthFraction: 0.27,
      aRoofLine: "fastback", windshieldAngle: 66, rearScreenAngle: 72,
      hoodHeight: 0.25, hoodRise: 0.08,
      bootHeight: 0.20, bootType: "kamm",
      characterLines: ["side scallop", "haunches", "B-pillar blade"],
      exhaustCount: 4, exhaustLayout: "wide-split", exhaustDiameter: 0.058,
      grilleType: "wide-mesh", grilleWidth: 0.68, grilleHeight: 0.24,
    },
    wheels: {
      radius: 0.375, width: 0.275, rimSpokes: 10, rimStyle: "multi-spoke",
      rimDepth: 0.5, trackWidth: 1.02, wheelbase: 1.50,
      frontOffset: 1.28, rearOffset: -1.28, caliperColor: "#991b1b",
      hasCentrelock: false,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.12, splitterWidth: 0.82,
      hasSideSkirts: true, sideSkirtHeight: 0.048,
      hasRearWing: false, wingHeight: 0, wingWidth: 0, wingChord: 0, wingEndplates: false,
      hasDiffuser: true, diffuserAngle: 26, diffuserWidth: 0.78, diffuserFins: 7,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "diamond", headlightWidth: 0.40, headlightY: 0.70,
      headlightColor: "#f8fbff", drlShape: "strip",
      taillightShape: "boomerang", taillightY: 0.75, taillightColor: "#ff2020",
    },
    clearcoatStrength: 0.95, metallicness: 0.84, roughness: 0.14, caliperColor: "#991b1b",
  },

  // ── McLaren 720S ───────────────────────────────────────────────────────
  {
    id: "mclaren-720s",
    bodyStyle: "hypercar",
    body: {
      // Real specs: 4 543 mm long · 2 161 mm wide · 1 196 mm tall
      length: 4.54, width: 2.16, height: 1.20, rideHeight: 0.100,
      noseLength: 0.41, cabinStart: 0.39, cabinEnd: 0.64, tailLength: 0.36,
      shoulderWidth: 1.04, rearHaunchWidth: 1.02, frontFascia: 0.26,
      roofHeight: 0.34, roofWidth: 0.56, roofLengthFraction: 0.28,
      aRoofLine: "coupe", windshieldAngle: 68, rearScreenAngle: 72,
      hoodHeight: 0.26, hoodRise: 0.06,
      bootHeight: 0.19, bootType: "kamm",
      characterLines: ["dihedral doors", "side intake", "spine"],
      exhaustCount: 2, exhaustLayout: "centre", exhaustDiameter: 0.068,
      grilleType: "wide-mesh", grilleWidth: 0.60, grilleHeight: 0.20,
    },
    wheels: {
      radius: 0.365, width: 0.265, rimSpokes: 10, rimStyle: "turbine",
      rimDepth: 0.55, trackWidth: 1.00, wheelbase: 1.49,
      frontOffset: 1.27, rearOffset: -1.27, caliperColor: "#f97316",
      hasCentrelock: false,
    },
    aero: {
      hasFrontSplitter: true, splitterDepth: 0.10, splitterWidth: 0.76,
      hasSideSkirts: true, sideSkirtHeight: 0.045,
      hasRearWing: false, wingHeight: 0, wingWidth: 0, wingChord: 0, wingEndplates: false,
      hasDiffuser: true, diffuserAngle: 24, diffuserWidth: 0.72, diffuserFins: 6,
      hasHoodVents: false, hasRoofScoop: false, hasLargeIntakes: true,
    },
    lighting: {
      headlightShape: "narrow-strip", headlightWidth: 0.38, headlightY: 0.70,
      headlightColor: "#f0f8ff", drlShape: "strip",
      taillightShape: "boomerang", taillightY: 0.76, taillightColor: "#ff2020",
    },
    clearcoatStrength: 0.88, metallicness: 0.78, roughness: 0.18, caliperColor: "#f97316",
  },
];

const profileMap = new Map<string, CarGeometry3D>(profiles.map((p) => [p.id, p]));

/** Get the 3D geometry profile for a car id.  Falls back to a generic coupe profile. */
export function getCar3DProfile(id: string): CarGeometry3D {
  return profileMap.get(id) ?? profiles[0];
}

export { profiles as ALL_CAR_PROFILES };
