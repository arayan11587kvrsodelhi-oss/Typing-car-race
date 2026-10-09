/**
* CarModel3D.tsx
*
* A fully parametric 3D vehicle renderer driven by car3D.ts profiles.
* This single component is shared between the Garage showroom and the
* live race overlay.  The same profile â†’ the same geometry in both contexts.
*
* Architecture:
*   CarGeometry3D profile (car3D.ts)
*     â†’ ProceduralBodyMesh   (ExtrudeGeometry / custom BufferGeometry)
*     â†’ ProceduralWheelMesh  (CylinderGeometry + spokes)
*     â†’ AeroComponents       (splitter, wing, diffuser, skirts)
*     â†’ LightingComponents   (emissive head/tail lights)
*     â†’ GlowEffects          (underglow)
*
* Geometry is fully unique per car â€” body length, width, height, roof profile,
* hood length, rear proportions, aero layout, wheel size and track all vary.
*/

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CarBuild, SpoilerStyle } from "@/game/types";
import { resolvedSpoiler, resolvedWheels } from "@/game/cars";
import { getCar3DProfile, type CarGeometry3D } from "@/game/car3D";

// ---------------------------------------------------------------------------
// Helper â€” colour utilities
// ---------------------------------------------------------------------------
const CARBON = new THREE.Color("#1a1d24");
const GLASS = new THREE.Color("#091525");
const RUBBER = new THREE.Color("#0a0d14");
const CHROME_COL = new THREE.Color("#cdd5e0");
const DARK_CHROME = new THREE.Color("#3a404c");

function paintMat(color: THREE.Color, clearcoat: number, metalness: number, roughness: number) {
  return new THREE.MeshPhysicalMaterial({ color, clearcoat, clearcoatRoughness: 0.06, metalness, roughness, envMapIntensity: 1.2 });
}
function carbonMat() {
  return new THREE.MeshStandardMaterial({ color: CARBON, roughness: 0.35, metalness: 0.6 });
}
function glassMat() {
  return new THREE.MeshPhysicalMaterial({ color: GLASS, roughness: 0.04, metalness: 0.9, transmission: 0.35, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------------------
// BODY GEOMETRY CONTRACT
//
//   profile.body.width / body.height / body.length   ->  the mesh, exactly.
//
// Every generator emits a CLOSED lofted shell from explicit cross-section
// stations. Stations are written in FRACTIONS of the declared envelope, never
// in absolute metres, so a generator physically cannot drift outside the
// profile.  ``normalizeBodyToEnvelope`` is the hard backstop: whatever the
// stations produce, the finished shell is measured and rescaled so that its
// bounding box is width x height x length to floating-point accuracy.
//
// Station fields (all widths are FRACTIONS of the declared half-width):
//   t      longitudinal position, 0 = tail, 1 = nose
//   wb     half-width of the lower body / shoulder ring (0..1)
//   yb     floor height above the ground plane (metres, >= ride height)
//   yt     shoulder / beltline height (metres)
//   wc     half-width of the glass base (fraction, 0 = no greenhouse)
//   ycr    roof peak height (metres)
//   wf     half-width of the roof panel itself (fraction)
//   ang    cross-section angularity: 2 = organic round, 6+ = hard planar wedge
//   haunch extra lateral bulge of the fender mass above the shoulder (fraction)
// ---------------------------------------------------------------------------
export interface BodyStation {
  /** longitudinal position, 0 = tail, 1 = nose */
  t?: number;
  /** explicit longitudinal z coordinate */
  z?: number;
  /** lower-body half-width in metres */
  xb?: number;
  /** lower-body half-width as a fraction of the declared half-width */
  wb?: number;
  /** floor height (metres or fraction) */
  yb: number;
  /** shoulder / beltline height (metres or fraction) */
  yt: number;
  /** glass-base half-width in metres (0 = no cabin) */
  xc?: number;
  /** glass-base half-width fraction (0 = this station has no cabin) */
  wc?: number;
  /** roof peak height (metres or fraction) */
  ycr: number;
  /** roof-panel half-width in metres */
  xf?: number;
  /** roof-panel half-width fraction */
  wf?: number;
  /** cross-section angularity */
  ang?: number;
  /** fender/haunch lateral bulge fraction above the shoulder */
  haunch?: number;
}

/** Vertical architecture of a body: the Z/Y stations every car must define. */
export interface BodyMetrics {
  /** corner radius of the cross-section (m) */
  cr: number;
  /** bottom of the sill / rocker (m) */
  sill: number;
  /** wheel-centre line (m) */
  wheelY: number;
  /** top of the lower (fender/door) mass -- shoulder line (m) */
  shoulder: number;
  /** beltline / bottom of the glass (m) */
  belt: number;
  /** hood plane in front of the screen (m) */
  hood: number;
  /** roof peak -- top of the mesh (m) */
  roof: number;
  /** engine deck / boot lid behind the cabin (m) */
  deck: number;
  /** overall length of the shell (m) */
  length: number;
  /** declared half-width -- the hard lateral envelope (m) */
  halfWidth: number;
  /** nose z (+), tail z (-) */
  front: number;
  rear: number;
}

export interface BodyResult {
  geometry: THREE.BufferGeometry;
  /** measured bounding box of the generated shell */
  bounds: THREE.Box3;
  metrics: BodyMetrics;
  /** the profile the shell was normalized against */
  target: { width: number; height: number; length: number };
}

// Superellipse unit point: exponent 2 = circle, higher = boxier/planar.
function superPt(t: number, ex: number): { px: number; py: number } {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const px = Math.sign(c) * Math.pow(Math.abs(c), 2 / ex);
  const py = Math.sign(s) * Math.pow(Math.abs(s), 2 / ex);
  return { px, py };
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Build the raw loft. Geometry is authored un-normalized, but station widths
 * are fractions and the max span in X, Y and Z is reached by construction, so
 * normalization is a shape-preserving uniform-in-architecture scaling.
 */
/**
 * Build the lofted body geometry.
 * Supports both standalone station lists (where xb, xc, xf, yb, yt, ycr, z are in metres)
 * and envelope-relative stations backed by BodyMetrics.
 */
function loftedBodyGeometry(stations: BodyStation[], mOrRadial: BodyMetrics | number = 18, radialOpt = 18): THREE.BufferGeometry {
  const isMetrics = typeof mOrRadial === "object" && mOrRadial !== null;
  const m = isMetrics ? (mOrRadial as BodyMetrics) : null;
  const radial = typeof mOrRadial === "number" ? mOrRadial : radialOpt;
  const pos: number[] = [];
  const idx: number[] = [];
  const ring = radial * 2;

  // Derive metrics if not explicitly passed
  let maxHW = m ? m.halfWidth : 0.9;
  let minSill = m ? m.sill : Infinity;
  let maxRoof = m ? m.roof : -Infinity;
  if (!m) {
    for (const s of stations) {
      const w = s.xb ?? (s.wb !== undefined ? s.wb * 0.9 : 0.9);
      if (w > maxHW) maxHW = w;
      if (s.yb < minSill) minSill = s.yb;
      if (s.ycr > maxRoof) maxRoof = s.ycr;
    }
  }
  const sill = m ? m.sill : (isFinite(minSill) ? minSill : 0.1);
  const roof = m ? m.roof : (isFinite(maxRoof) ? maxRoof : 1.3);
  const ySpan = Math.max(0.02, roof - sill);
  const cr = m ? Math.min(m.cr, ySpan * 0.42, m.halfWidth * 0.5) : Math.min(0.06, ySpan * 0.2, maxHW * 0.15);
  const halfWidth = m ? m.halfWidth : maxHW;

  stations.forEach((s, si) => {
    const yt = Math.max(s.yb + 0.03, s.yt);
    const stationHW = s.xb ?? (s.wb !== undefined ? s.wb * halfWidth : halfWidth);
    const stationCabinW = s.xc ?? (s.wc !== undefined ? s.wc * halfWidth : 0);
    const hasCabin = stationCabinW > 0.02 && s.ycr > yt + 0.02;
    const stationRoofW = s.xf ?? (s.wf !== undefined ? s.wf * halfWidth : stationCabinW * 0.84);
    const ex = s.ang ?? 2.4;
    const yMid = (s.yb + yt) / 2;
    const yHalf = Math.max(0.02, (yt - s.yb) / 2);
    const bulge = s.haunch ?? 0;

    for (let j = 0; j < ring; j++) {
      const t = (j / ring) * Math.PI * 2;
      const { px, py } = superPt(t, ex);
      const upper = py > 0;

      // Lower body ring (fender / sill / door volume).
      let x = px * stationHW;
      let y = yMid + py * yHalf;
      if (y < s.yb) y = s.yb;

      // Fender + haunch mass above the shoulder line.
      if (bulge > 0 && py > 0.12) {
        const k = smoothstep(0.12, 0.92, py);
        x += Math.sign(px || 1) * bulge * halfWidth * k;
        y += bulge * ySpan * 0.45 * k;
      }

      if (hasCabin && upper) {
        // Greenhouse: glass base at the shoulder, narrowing to the roof panel.
        const { px: gpx, py: gpy } = superPt(t, 2.2);
        const gx = gpx * stationCabinW;
        const gy = yt + (gpy + 1) * 0.5 * (s.ycr - yt);
        const k = smoothstep(yt - (yt - s.yb) * 0.18, yt, y);
        x = x + (gx - x) * k;
        y = y + (gy - y) * k;
        // Roof panel crown -- pull the topmost verts in toward xf.
        if (y > s.ycr - ySpan * 0.09) {
          const rc = smoothstep(s.ycr - ySpan * 0.18, s.ycr, y);
          x = x + (Math.sign(x) * stationRoofW - x) * rc;
          y = s.ycr + (y - s.ycr) * 0.25;
        }
      }

      // Round the underside: square the floor and round the corner by cr.
      if (y < sill + cr) {
        const over = Math.max(0, Math.abs(x) - (stationHW - cr));
        if (over > 0) {
          const q = Math.sqrt(Math.max(0, cr * cr - over * over));
          y = sill + Math.min(y - sill, q);
          if (y < sill) y = sill;
        }
      }

      // Cap to max half width
      const cap = Math.max(halfWidth * 1.3, stationHW * 1.05);
      if (x > cap) x = cap;
      if (x < -cap) x = -cap;

      pos.push(x, Math.max(sill, y), s.z ?? 0);
    }

    if (si > 0) {
      const prev = (si - 1) * ring;
      const cur = si * ring;
      for (let j = 0; j < ring; j++) {
        const j2 = (j + 1) % ring;
        idx.push(prev + j, cur + j, cur + j2, prev + j, cur + j2, prev + j2);
      }
    }
  });

  // End caps (nose / tail).
  const cap = (si: number, flip: boolean) => {
    const base = si * ring;
    let cx = 0; let cy = 0; let cz = 0;
    for (let j = 0; j < ring; j++) { cx += pos[(base + j) * 3]; cy += pos[(base + j) * 3 + 1]; cz += pos[(base + j) * 3 + 2]; }
    const ci = pos.length / 3;
    pos.push(cx / ring, cy / ring, cz / ring);
    for (let j = 0; j < ring; j++) {
      const j2 = (j + 1) % ring;
      if (flip) idx.push(ci, base + j2, base + j);
      else idx.push(ci, base + j, base + j2);
    }
  };
  cap(0, true);
  cap(stations.length - 1, false);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * HARD BOUNDING-BOX CONTRACT.
 *
 * Measures the finished primary body shell and normalizes it onto the declared
 * profile dimensions. Applied ONLY to the body shell -- wheels, arches, glass,
 * lights, exhausts, splitter, diffuser, spoiler and aero are attached afterwards
 * against the normalized metrics, so accessories can never corrupt the body
 * dimensions.
 */
export function normalizeBodyToEnvelope(
  geometry: THREE.BufferGeometry,
  target: { width: number; height: number; length: number; rideHeight: number; groundOffset: number },
  metrics: BodyMetrics
): THREE.Box3 {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());

  const sx = target.width / Math.max(1e-6, size.x);
  const sy = target.height / Math.max(1e-6, size.y);
  const sz = target.length / Math.max(1e-6, size.z);

  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) * sx,
      (pos.getY(i) - bb.min.y) * sy + target.groundOffset,
      pos.getZ(i) * sz
    );
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  // The metrics used to attach accessories describe the *normalized* shell.
  metrics.halfWidth = target.width / 2;
  metrics.length = target.length;
  metrics.sill = target.groundOffset;
  metrics.roof = target.groundOffset + target.height;
  return geometry.boundingBox!.clone();
}

/**
 * Author a station list in envelope-relative form.
 * Longitudinal positions come from the profile's own proportions; every
 * vertical station is a fraction of the declared height. Runs of ``null`` in
 * ``yb`` / ``yt`` interpolate, so a station list is a compact Y-contour.
 */
export interface BodySpec {
  stations: BodyStation[];
  radial?: number;
  /** corner radius of the underside, as a fraction of the declared height */
  cornerFrac?: number;
  /** sill (rocker underside) as a fraction of the declared height */
  sillFrac?: number;
  /** shoulder / beltline as a fraction of the declared height */
  shoulderFrac?: number;
  /** hood plane as a fraction of the declared height */
  hoodFrac?: number;
  /** engine deck / boot lid as a fraction of the declared height */
  deckFrac?: number;
}

// ---------------------------------------------------------------------------
// Seven independent enclosed road-car architectures.
//
// Each generator defines its OWN station list with its own longitudinal
// layout, width profile, shoulder height, cabin position, roof curve and
// angularity. Body width, height, hood length, cabin position, roof curve,
// windshield angle, wheelbase, haunches, deck height and front/rear profiles
// all differ â€” so the meshes are physically different, not scaled copies.
//
// No open wheels, no formula nose, no exposed suspension, no single-seat
// monocoque. Every station is a closed ring; wheels tuck inside the fenders.
// ---------------------------------------------------------------------------

/** 1. BMW M3 Competition â€” 4-door SEDAN. Three-box: LONG HOOD â†’ UPRIGHT CABIN â†’ TRUNK. */
export function generateBMWM3Body(p: CarGeometry3D): THREE.BufferGeometry {
  const rh = p.body.rideHeight;
  const L = 4.79; const f = L / 2; const r = -L / 2;
  const hw = 0.90;                 // narrower than the supercars
  const belt = rh + 0.72;          // high belt line (tall doors)
  const roof = rh + 1.30;          // TALL greenhouse â€” sedan roof
  const s: BodyStation[] = [
    // nose: square, tall fascia, blunt
    { z: f, xb: hw * 0.66, yb: rh + 0.10, yt: rh + 0.62, xc: 0, ycr: 0 },
    { z: f - 0.18, xb: hw * 0.90, yb: rh + 0.02, yt: rh + 0.70, xc: 0, ycr: 0 },
    // LONG hood (â‰ˆ 1.9 m) rising to the cowl
    { z: f - 0.95, xb: hw * 0.99, yb: rh, yt: rh + 0.72, xc: 0, ycr: 0 },
    { z: f - 1.70, xb: hw * 1.00, yb: rh, yt: rh + 0.75, xc: 0, ycr: 0 },
    // UPRIGHT windshield (steep) + tall cabin begins
    { z: f - 1.95, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.86, ycr: roof, xf: hw * 0.72, ang: 2.8 },
    { z: f - 2.55, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.88, ycr: roof, xf: hw * 0.74, ang: 2.8 },
    // B-pillar / rear door volume (flat roof, tall greenhouse)
    { z: f - 3.15, xb: hw * 0.99, yb: rh, yt: belt, xc: hw * 0.86, ycr: roof, xf: hw * 0.72, ang: 2.8 },
    // C-pillar: roof steps DOWN to a separate trunk deck
    { z: f - 3.55, xb: hw * 1.00, yb: rh, yt: belt - 0.02, xc: hw * 0.78, ycr: roof - 0.30, xf: hw * 0.62, ang: 2.8 },
    // TRUNK deck â€” flat, below the roofline (notchback)
    { z: f - 3.95, xb: hw * 0.99, yb: rh, yt: rh + 0.74, xc: 0, ycr: 0 },
    // rear: square, upright tail with separate trunk lid
    { z: f - 4.45, xb: hw * 0.98, yb: rh, yt: rh + 0.72, xc: 0, ycr: 0 },
    { z: r, xb: hw * 0.93, yb: rh + 0.04, yt: rh + 0.68, xc: 0, ycr: 0 },
  ];
  return loftedBodyGeometry(s, 18);
}

/** 2. Porsche 911 GT3 RS â€” rear-engine sports car: SHORT NOSE â†’ ROUND ROOF â†’ CONTINUOUS REAR SLOPE â†’ WIDE HAUNCH. */
export function generatePorsche911GT3RSBody(p: CarGeometry3D): THREE.BufferGeometry {
  const rh = p.body.rideHeight;
  const L = 4.57; const f = L / 2; const r = -L / 2;
  const hw = 0.94;
  const belt = rh + 0.58;
  const roof = rh + 0.98;
  const s: BodyStation[] = [
    // SHORT front hood with rounded fender humps
    { z: f, xb: hw * 0.62, yb: rh + 0.14, yt: rh + 0.46, xc: 0, ycr: 0 },
    { z: f - 0.22, xb: hw * 0.86, yb: rh + 0.05, yt: rh + 0.56, xc: 0, ycr: 0 },
    { z: f - 0.70, xb: hw * 1.00, yb: rh, yt: rh + 0.60, xc: 0, ycr: 0 },   // front fender crest
    // CURVED windshield, compact cabin set forward
    { z: f - 1.10, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.80, ycr: roof, xf: hw * 0.66, ang: 2.0 },
    { z: f - 1.55, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.82, ycr: roof + 0.02, xf: hw * 0.68, ang: 2.0 },
    // ROUND roof peak, then the UNMISTAKABLE continuous 911 flyline
    { z: f - 2.05, xb: hw * 1.01, yb: rh, yt: belt, xc: hw * 0.80, ycr: roof + 0.01, xf: hw * 0.66, ang: 2.0 },
    { z: f - 2.55, xb: hw * 1.10, yb: rh, yt: belt - 0.02, xc: hw * 0.70, ycr: roof - 0.14, xf: hw * 0.56, ang: 2.0 },
    // roof flows straight into the rear deck â€” no step, no trunk
    { z: f - 3.05, xb: hw * 1.18, yb: rh, yt: belt - 0.06, xc: hw * 0.52, ycr: roof - 0.34, xf: hw * 0.40, ang: 2.0 },
    // VERY LARGE rear haunches â€” widest point of the car
    { z: f - 3.45, xb: hw * 1.24, yb: rh, yt: rh + 0.54, xc: 0, ycr: 0 },
    { z: f - 4.10, xb: hw * 1.20, yb: rh, yt: rh + 0.50, xc: 0, ycr: 0 },
    { z: r, xb: hw * 1.06, yb: rh + 0.03, yt: rh + 0.44, xc: 0, ycr: 0 },
  ];
  return loftedBodyGeometry(s, 20);
}

/** 3. Bugatti Chiron â€” WIDE + LOW + HEAVY grand-touring hypercar. */
export function generateBugattiChironBody(p: CarGeometry3D): THREE.BufferGeometry {
  const rh = p.body.rideHeight;
  const L = 4.54; const f = L / 2; const r = -L / 2;
  const hw = 1.02;                 // EXTREME width
  const belt = rh + 0.52;          // very low shoulder
  const roof = rh + 0.88;          // very low roof
  const s: BodyStation[] = [
    // long nose, broad horseshoe grille face, big front volume
    { z: f, xb: hw * 0.70, yb: rh + 0.10, yt: rh + 0.44, xc: 0, ycr: 0 },
    { z: f - 0.20, xb: hw * 0.94, yb: rh + 0.02, yt: rh + 0.50, xc: 0, ycr: 0 },
    // broad front fenders â€” full width very early
    { z: f - 0.90, xb: hw * 1.00, yb: rh, yt: rh + 0.52, xc: 0, ycr: 0 },
    { z: f - 1.55, xb: hw * 1.00, yb: rh, yt: belt, xc: 0, ycr: 0 },
    // LOW cabin â€” small, set back; long side body either side
    { z: f - 1.85, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.70, ycr: roof, xf: hw * 0.54, ang: 2.2 },
    { z: f - 2.45, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.72, ycr: roof, xf: hw * 0.56, ang: 2.2 },
    { z: f - 2.95, xb: hw * 1.01, yb: rh, yt: belt, xc: hw * 0.68, ycr: roof - 0.10, xf: hw * 0.50, ang: 2.2 },
    // wide rear shoulders, large rear deck, substantial rear volume
    { z: f - 3.45, xb: hw * 1.06, yb: rh, yt: rh + 0.50, xc: 0, ycr: 0 },
    { z: f - 4.05, xb: hw * 1.05, yb: rh, yt: rh + 0.48, xc: 0, ycr: 0 },
    { z: r, xb: hw * 0.98, yb: rh + 0.03, yt: rh + 0.44, xc: 0, ycr: 0 },
  ];
  return loftedBodyGeometry(s, 20);
}

/** 4. Koenigsegg Jesko â€” EXTREME aero hypercar; extremely low nose, panoramic low canopy, very wide rear. */
export function generateKoenigseggJeskoBody(p: CarGeometry3D): THREE.BufferGeometry {
  const rh = p.body.rideHeight;
  const L = 4.68; const f = L / 2; const r = -L / 2;
  const hw = 1.00;
  const belt = rh + 0.48;          // lowest belt of the group
  const roof = rh + 0.82;          // lowest roof
  const s: BodyStation[] = [
    // extremely low, knife-edge nose
    { z: f, xb: hw * 0.50, yb: rh + 0.05, yt: rh + 0.24, xc: 0, ycr: 0 },
    { z: f - 0.25, xb: hw * 0.82, yb: rh, yt: rh + 0.30, xc: 0, ycr: 0 },
    // deep side sculpting, long low hood
    { z: f - 0.95, xb: hw * 0.94, yb: rh, yt: rh + 0.38, xc: 0, ycr: 0 },
    { z: f - 1.60, xb: hw * 0.96, yb: rh, yt: belt, xc: 0, ycr: 0 },
    // panoramic low canopy â€” wide but very shallow
    { z: f - 1.90, xb: hw * 0.97, yb: rh, yt: belt, xc: hw * 0.74, ycr: roof, xf: hw * 0.60, ang: 2.6 },
    { z: f - 2.40, xb: hw * 0.98, yb: rh, yt: belt, xc: hw * 0.76, ycr: roof, xf: hw * 0.62, ang: 2.6 },
    { z: f - 2.90, xb: hw * 1.02, yb: rh, yt: belt, xc: hw * 0.70, ycr: roof - 0.12, xf: hw * 0.54, ang: 2.6 },
    // VERY wide rear + large rear haunches
    { z: f - 3.45, xb: hw * 1.10, yb: rh, yt: rh + 0.48, xc: 0, ycr: 0 },
    { z: f - 4.05, xb: hw * 1.09, yb: rh, yt: rh + 0.46, xc: 0, ycr: 0 },
    { z: r, xb: hw * 1.02, yb: rh + 0.03, yt: rh + 0.40, xc: 0, ycr: 0 },
  ];
  return loftedBodyGeometry(s, 18);
}

/** 5. Lamborghini Aventador SVJ â€” ANGULAR WEDGE. Sharpest / most planar of the group. */
export function generateAventadorSVJBody(p: CarGeometry3D): THREE.BufferGeometry {
  const rh = p.body.rideHeight;
  const L = 4.95; const f = L / 2; const r = -L / 2;
  const hw = 1.04;
  const belt = rh + 0.50;
  const roof = rh + 0.84;
  const A = 5.5;                   // hard planar cross-section
  const s: BodyStation[] = [
    // razor wedge nose â€” a single straight plane from tip to hood
    { z: f, xb: hw * 0.30, yb: rh + 0.04, yt: rh + 0.22, xc: 0, ycr: 0, ang: A },
    { z: f - 0.30, xb: hw * 0.80, yb: rh, yt: rh + 0.30, xc: 0, ycr: 0, ang: A },
    // angular hood â€” flat planes, sharp fender creases
    { z: f - 1.05, xb: hw * 0.94, yb: rh, yt: rh + 0.40, xc: 0, ycr: 0, ang: A },
    { z: f - 1.75, xb: hw * 0.98, yb: rh, yt: belt, xc: 0, ycr: 0, ang: A },
    // angular canopy â€” faceted glasshouse, low and flat
    { z: f - 2.05, xb: hw * 0.99, yb: rh, yt: belt, xc: hw * 0.72, ycr: roof, xf: hw * 0.58, ang: A },
    { z: f - 2.60, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.74, ycr: roof, xf: hw * 0.60, ang: A },
    { z: f - 3.10, xb: hw * 1.03, yb: rh, yt: belt, xc: hw * 0.66, ycr: roof - 0.10, xf: hw * 0.50, ang: A },
    // sharp rear shoulders + aggressive rear
    { z: f - 3.70, xb: hw * 1.07, yb: rh, yt: rh + 0.48, xc: 0, ycr: 0, ang: A },
    { z: f - 4.35, xb: hw * 1.06, yb: rh, yt: rh + 0.46, xc: 0, ycr: 0, ang: A },
    { z: r, xb: hw * 1.00, yb: rh + 0.04, yt: rh + 0.42, xc: 0, ycr: 0, ang: A },
  ];
  return loftedBodyGeometry(s, 14);
}

/** 6. Ferrari SF90 Stradale â€” SMOOTH + SCULPTED mid-engine supercar. */
export function generateFerrariSF90Body(p: CarGeometry3D): THREE.BufferGeometry {
  const rh = p.body.rideHeight;
  const L = 4.71; const f = L / 2; const r = -L / 2;
  const hw = 0.98;
  const belt = rh + 0.54;
  const roof = rh + 0.92;
  const s: BodyStation[] = [
    // short low nose, cab-forward
    { z: f, xb: hw * 0.58, yb: rh + 0.08, yt: rh + 0.34, xc: 0, ycr: 0 },
    { z: f - 0.22, xb: hw * 0.88, yb: rh + 0.02, yt: rh + 0.42, xc: 0, ycr: 0 },
    { z: f - 0.85, xb: hw * 0.98, yb: rh, yt: rh + 0.48, xc: 0, ycr: 0 },
    // forward-set windshield, low cabin â€” well ahead of centre
    { z: f - 1.20, xb: hw * 0.99, yb: rh, yt: belt, xc: hw * 0.82, ycr: roof, xf: hw * 0.68, ang: 2.3 },
    { z: f - 1.70, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.84, ycr: roof, xf: hw * 0.70, ang: 2.3 },
    { z: f - 2.20, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.78, ycr: roof - 0.06, xf: hw * 0.62, ang: 2.3 },
    // smooth waist â†’ pronounced rear haunches
    { z: f - 2.70, xb: hw * 1.02, yb: rh, yt: belt - 0.04, xc: hw * 0.58, ycr: roof - 0.22, xf: hw * 0.44, ang: 2.3 },
    { z: f - 3.25, xb: hw * 1.09, yb: rh, yt: rh + 0.52, xc: 0, ycr: 0 },   // rear haunch
    { z: f - 3.95, xb: hw * 1.07, yb: rh, yt: rh + 0.50, xc: 0, ycr: 0 },   // broad rear deck
    { z: r, xb: hw * 0.98, yb: rh + 0.04, yt: rh + 0.46, xc: 0, ycr: 0 },
  ];
  return loftedBodyGeometry(s, 22);
}

/** 7. McLaren 720S â€” ORGANIC aerodynamic: teardrop greenhouse, thin pillars, flowing fenders. */
export function generateMcLaren720SBody(p: CarGeometry3D): THREE.BufferGeometry {
  const rh = p.body.rideHeight;
  const L = 4.54; const f = L / 2; const r = -L / 2;
  const hw = 0.95;
  const belt = rh + 0.52;
  const roof = rh + 0.90;
  const s: BodyStation[] = [
    // very low front, flowing front fenders
    { z: f, xb: hw * 0.56, yb: rh + 0.06, yt: rh + 0.32, xc: 0, ycr: 0 },
    { z: f - 0.20, xb: hw * 0.88, yb: rh + 0.01, yt: rh + 0.42, xc: 0, ycr: 0 },
    { z: f - 0.80, xb: hw * 1.00, yb: rh, yt: rh + 0.50, xc: 0, ycr: 0 },   // front fender flow
    // TEARDROP greenhouse â€” widest glass base, strongly domed, thin pillars
    { z: f - 1.15, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.90, ycr: roof, xf: hw * 0.72, ang: 2.0 },
    { z: f - 1.70, xb: hw * 1.00, yb: rh, yt: belt, xc: hw * 0.92, ycr: roof + 0.02, xf: hw * 0.74, ang: 2.0 },
    // smooth cabinâ†’rear body transition, no hard step
    { z: f - 2.25, xb: hw * 1.01, yb: rh, yt: belt - 0.02, xc: hw * 0.82, ycr: roof - 0.10, xf: hw * 0.64, ang: 2.0 },
    { z: f - 2.75, xb: hw * 1.05, yb: rh, yt: belt - 0.06, xc: hw * 0.62, ycr: roof - 0.28, xf: hw * 0.46, ang: 2.0 },
    // large ORGANIC rear haunches â€” smooth bulges, not creases
    { z: f - 3.30, xb: hw * 1.12, yb: rh, yt: rh + 0.50, xc: 0, ycr: 0 },
    { z: f - 3.90, xb: hw * 1.08, yb: rh, yt: rh + 0.48, xc: 0, ycr: 0 },
    { z: r, xb: hw * 0.98, yb: rh + 0.04, yt: rh + 0.44, xc: 0, ycr: 0 },
  ];
  return loftedBodyGeometry(s, 22);
}

function buildBodyGeometry(p: CarGeometry3D): THREE.BufferGeometry {
  const id = p.id.toLowerCase();
  // â”€â”€ Explicit routing: every target model has its own generator. â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (id.includes("aventador") || id.includes("revuelto") || id.includes("huracan") || id.includes("lamborghini")) return generateAventadorSVJBody(p);
  if (id.includes("chiron") || id.includes("bugatti")) return generateBugattiChironBody(p);
  if (id.includes("jesko") || id.includes("gemera") || id.includes("koenigsegg")) return generateKoenigseggJeskoBody(p);
  if (id.includes("sf90") || id.includes("296") || id.includes("ferrari")) return generateFerrariSF90Body(p);
  if (id.includes("mclaren") || id.includes("720") || id.includes("750") || id.includes("765")) return generateMcLaren720SBody(p);
  if (id.includes("911") || id.includes("porsche")) return generatePorsche911GT3RSBody(p);
  if (id.includes("bmw") || id.includes("m3") || id.includes("m4") || id.includes("m5") || id.includes("mustang") || id.includes("supra")) return generateBMWM3Body(p);

  // â”€â”€ Explicit generic fallback (NOT used by any of the seven target cars). â”€â”€
  // A neutral enclosed coupe built from the shared profile's own measurements.
  const b = p.body;
  const L = b.length; const f = L / 2; const r = -L / 2;
  const hw = b.width / 2;
  const belt = b.rideHeight + b.height * 0.42;
  const roof = b.rideHeight + b.roofHeight;
  const cabStart = f - b.cabinStart * L;
  const cabEnd = f - b.cabinEnd * L;
  const s: BodyStation[] = [
    { z: f, xb: hw * 0.62, yb: b.rideHeight + 0.06, yt: b.rideHeight + b.height * 0.30, xc: 0, ycr: 0 },
    { z: f - 0.35, xb: hw * 0.94, yb: b.rideHeight, yt: b.rideHeight + b.height * 0.36, xc: 0, ycr: 0 },
    { z: cabStart, xb: hw * 0.99, yb: b.rideHeight, yt: belt, xc: 0, ycr: 0 },
    { z: cabStart - (cabStart - cabEnd) * 0.25, xb: hw, yb: b.rideHeight, yt: belt, xc: hw * b.roofWidth * 0.92, ycr: roof, xf: hw * b.roofWidth * 0.76, ang: 2.4 },
    { z: cabEnd + (cabStart - cabEnd) * 0.25, xb: hw, yb: b.rideHeight, yt: belt, xc: hw * b.roofWidth * 0.92, ycr: roof, xf: hw * b.roofWidth * 0.76, ang: 2.4 },
    { z: cabEnd, xb: hw * b.rearHaunchWidth, yb: b.rideHeight, yt: belt - 0.02, xc: hw * b.roofWidth * 0.72, ycr: roof - 0.12, xf: hw * b.roofWidth * 0.56, ang: 2.4 },
    { z: r + 0.3, xb: hw * b.rearHaunchWidth, yb: b.rideHeight, yt: b.rideHeight + b.bootHeight + 0.02, xc: 0, ycr: 0 },
    { z: r, xb: hw * 0.94, yb: b.rideHeight + 0.03, yt: b.rideHeight + b.bootHeight, xc: 0, ycr: 0 },
  ];
  return loftedBodyGeometry(s, 18);
}

// ---------------------------------------------------------------------------
// Wheel geometry â€” distinct per car profile
// ---------------------------------------------------------------------------
function buildWheelWell(radius: number, width: number): THREE.Mesh {
  // Inner dark wheel well liner: sits behind the wheel toward the car centerline
  const geo = new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, width * 0.85, 20, 1, true, 0, Math.PI);
  const mat = new THREE.MeshStandardMaterial({ color: "#06070a", roughness: 0.98, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.z = Math.PI / 2;
  return m;
}

function buildWheelGeometry(
  radius: number,
  width: number,
  spokes: number,
  style: string
): THREE.Group {
  const grp = new THREE.Group();

  // Tyre
  const tyreMat = new THREE.MeshStandardMaterial({ color: RUBBER, roughness: 0.88, metalness: 0.05 });
  const tyreGeo = new THREE.CylinderGeometry(radius, radius, width, 32, 1);
  const tyre = new THREE.Mesh(tyreGeo, tyreMat);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  grp.add(tyre);

  // Tyre sidewall groove
  const groove = new THREE.TorusGeometry(radius * 0.86, 0.008, 6, 32);
  const grooveMat = new THREE.MeshStandardMaterial({ color: "#050608", roughness: 0.9 });
  for (const side of [-1, 1]) {
    const g = new THREE.Mesh(groove, grooveMat);
    g.rotation.y = Math.PI / 2;
    g.position.x = side * width * 0.38;
    grp.add(g);
  }

  // Rim face
  const isChrome = style === "chrome";
  const isCarbon = style === "carbon";
  const rimCol = isChrome ? CHROME_COL : isCarbon ? CARBON : style === "neon" ? new THREE.Color("#111827") : DARK_CHROME;
  const rimMat = new THREE.MeshStandardMaterial({ color: rimCol, roughness: isChrome ? 0.1 : 0.3, metalness: isChrome ? 0.98 : 0.85 });

  const rimGeo = new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, width * 0.62, 32, 1);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.z = Math.PI / 2;
  grp.add(rim);

  // Brake disc
  const discGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width * 0.14, 24);
  const discMat = new THREE.MeshStandardMaterial({ color: "#5a6070", roughness: 0.55, metalness: 0.75 });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.z = Math.PI / 2;
  grp.add(disc);

  // Brake caliper
  const calGeo = new THREE.BoxGeometry(0.055, radius * 0.32, width * 0.62);
  const calMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#e11d48"), roughness: 0.4, metalness: 0.5, emissive: new THREE.Color("#e11d48"), emissiveIntensity: 0.08 });
  const cal = new THREE.Mesh(calGeo, calMat);
  cal.position.set(0, -radius * 0.66, 0);
  grp.add(cal);

  // Spokes / rim style
  if (style === "aero-dish" || style === "turbine") {
    // Solid-ish aero wheel â€” flat ring with cutouts suggested by thin fins
    const fins = style === "turbine" ? spokes : 5;
    for (let i = 0; i < fins; i++) {
      const angle = (i / fins) * Math.PI * 2;
      const finGeo = new THREE.BoxGeometry(radius * 0.68, 0.022, width * 0.44);
      const fin = new THREE.Mesh(finGeo, rimMat);
      fin.rotation.z = Math.PI / 2;
      fin.rotation.y = angle;
      fin.position.set(Math.sin(angle) * radius * 0.26, Math.cos(angle) * radius * 0.26, 0);
      grp.add(fin);
    }
  } else {
    // Multi-spoke wheel
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * Math.PI * 2;
      const spokeGeo = new THREE.BoxGeometry(radius * 0.72, 0.028, width * (style === "track" || style === "centerlock" ? 0.30 : 0.18));
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.rotation.z = Math.PI / 2;
      spoke.rotation.y = angle;
      spoke.position.set(Math.sin(angle) * radius * 0.28, Math.cos(angle) * radius * 0.28, 0);
      spoke.castShadow = false;
      grp.add(spoke);
    }
    // Centre cap
    const capGeo = new THREE.CylinderGeometry(radius * 0.14, radius * 0.14, width * 0.2, 16);
    const cap = new THREE.Mesh(capGeo, rimMat);
    cap.rotation.z = Math.PI / 2;
    grp.add(cap);
  }

  if (style === "centerlock" || style === "track") {
    // Centre-lock nut
    const nutGeo = new THREE.CylinderGeometry(radius * 0.07, radius * 0.07, width * 0.14, 6);
    const nutMat = new THREE.MeshStandardMaterial({ color: "#c0c8d8", roughness: 0.2, metalness: 0.98 });
    const nut = new THREE.Mesh(nutGeo, nutMat);
    nut.rotation.z = Math.PI / 2;
    nut.position.x = width * 0.32;
    grp.add(nut);
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Aero components
// ---------------------------------------------------------------------------
function buildSplitter(prof: CarGeometry3D, _paint: THREE.Color): THREE.Group | null {
  if (!prof.aero.hasFrontSplitter) return null;
  const grp = new THREE.Group();
  const b = prof.body;
  const w = b.width * prof.aero.splitterWidth;
  const d = prof.aero.splitterDepth;
  const geo = new THREE.BoxGeometry(w, 0.022, d);
  const mat = new THREE.MeshStandardMaterial({ color: CARBON, roughness: 0.35, metalness: 0.55 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, b.rideHeight + 0.01, b.length / 2 + d / 2 - 0.02);
  mesh.castShadow = true;
  grp.add(mesh);
  return grp;
}

function buildRearWing(prof: CarGeometry3D, paint: THREE.Color, spoil: SpoilerStyle): THREE.Group | null { // SpoilerStyle imported from types
  const grp = new THREE.Group();
  const b = prof.body;
  const rearZ = -b.length / 2;

  if (spoil === "lip" || spoil === "none") {
    if (!prof.aero.hasRearWing) {
      // Ducktail lip only
      if (spoil === "lip") {
        const geo = new THREE.BoxGeometry(b.width * 0.78, 0.025, 0.14);
        const mat = new THREE.MeshPhysicalMaterial({ color: paint, clearcoat: 1, metalness: 0.7, roughness: 0.2 });
        const lip = new THREE.Mesh(geo, mat);
        lip.position.set(0, b.rideHeight + b.bootHeight + 0.005, rearZ + 0.14);
        lip.castShadow = true;
        grp.add(lip);
      }
      return grp.children.length > 0 ? grp : null;
    }
  }

  const wingH = prof.aero.hasRearWing ? prof.aero.wingHeight : (spoil === "wing" ? 0.20 : spoil === "gt" ? 0.32 : 0.10);
  const wingW = prof.aero.hasRearWing ? b.width * prof.aero.wingWidth : b.width * (spoil === "gt" ? 0.94 : 0.82);
  const wingChord = prof.aero.hasRearWing ? prof.aero.wingChord : (spoil === "gt" ? 0.30 : 0.20);
  const baseY = b.rideHeight + b.bootHeight;
  const peakY = baseY + wingH;

  // Wing uprights / endplates
  const uprightMat = carbonMat();
  for (const side of [-1, 1]) {
    const uprightH = wingH + 0.02;
    const uprightGeo = new THREE.BoxGeometry(0.028, uprightH, 0.12);
    const upr = new THREE.Mesh(uprightGeo, uprightMat);
    upr.position.set(side * wingW * 0.44, baseY + uprightH / 2, rearZ + 0.22);
    upr.castShadow = true;
    grp.add(upr);

    if (prof.aero.wingEndplates || spoil === "gt") {
      const epGeo = new THREE.BoxGeometry(0.018, wingH * 0.75, wingChord + 0.04);
      const ep = new THREE.Mesh(epGeo, uprightMat);
      ep.position.set(side * (wingW / 2 + 0.009), peakY - wingH * 0.38, rearZ + 0.22);
      grp.add(ep);
    }
  }

  // Main wing element
  const wingGeo = new THREE.BoxGeometry(wingW, 0.042, wingChord);
  const wingMat = spoil === "gt"
    ? carbonMat()
    : new THREE.MeshPhysicalMaterial({ color: paint, clearcoat: 1, metalness: 0.7, roughness: 0.22 });
  const wing = new THREE.Mesh(wingGeo, wingMat);
  wing.position.set(0, peakY, rearZ + 0.22);
  wing.rotation.x = -0.08;
  wing.castShadow = true;
  grp.add(wing);

  // Second element for GT wing
  if (spoil === "gt") {
    const el2Geo = new THREE.BoxGeometry(wingW * 0.88, 0.032, wingChord * 0.6);
    const el2 = new THREE.Mesh(el2Geo, uprightMat);
    el2.position.set(0, peakY - 0.065, rearZ + 0.26);
    el2.rotation.x = 0.06;
    grp.add(el2);
  }

  return grp;
}

function buildDiffuser(prof: CarGeometry3D): THREE.Group | null {
  if (!prof.aero.hasDiffuser) return null;
  const grp = new THREE.Group();
  const b = prof.body;
  const w = b.width * prof.aero.diffuserWidth;
  const fins = prof.aero.diffuserFins;
  const angle = (prof.aero.diffuserAngle * Math.PI) / 180;
  const d = 0.42; // depth
  const mat = carbonMat();

  // Outer diffuser shell
  const geo = new THREE.BoxGeometry(w, d * Math.sin(angle) + 0.018, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = angle / 2;
  mesh.position.set(0, b.rideHeight + 0.006 + (d * Math.sin(angle)) / 2 - 0.01, -b.length / 2 + d / 2);
  mesh.castShadow = true;
  grp.add(mesh);

  // Fins
  for (let i = 0; i < fins; i++) {
    const fz = (i - (fins - 1) / 2) * (w / (fins + 0.5));
    const finGeo = new THREE.BoxGeometry(0.012, d * Math.sin(angle), d * 0.92);
    const fin = new THREE.Mesh(finGeo, mat);
    fin.rotation.x = angle / 2;
    fin.position.set(fz, b.rideHeight + (d * Math.sin(angle)) / 2, -b.length / 2 + d * 0.46);
    grp.add(fin);
  }
  return grp;
}

function buildSideSkirts(prof: CarGeometry3D, _paint: THREE.Color): THREE.Group | null {
  if (!prof.aero.hasSideSkirts) return null;
  const grp = new THREE.Group();
  const b = prof.body;
  const sk_h = prof.aero.sideSkirtHeight;
  const sk_l = b.length * 0.55;
  const mat = carbonMat();
  for (const side of [-1, 1]) {
    const geo = new THREE.BoxGeometry(0.022, sk_h, sk_l);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(side * (b.width / 2 + 0.011), b.rideHeight + sk_h / 2, -b.length * 0.04);
    grp.add(mesh);
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Headlights / tail-lights
// ---------------------------------------------------------------------------
function buildHeadlights(prof: CarGeometry3D, _glowColor: string | null): THREE.Group {
  const grp = new THREE.Group();
  const b = prof.body;
  const lg = prof.lighting;
  const frontZ = b.length / 2;
  const hlW = (b.width / 2) * lg.headlightWidth;
  const hlY = lg.headlightY;
  const emColor = new THREE.Color(lg.headlightColor);
  const emMat = new THREE.MeshStandardMaterial({ color: emColor, emissive: emColor, emissiveIntensity: 2.8, toneMapped: false });

  if (lg.headlightShape === "narrow-strip") {
    for (const side of [-1, 1]) {
      const geo = new THREE.BoxGeometry(hlW, 0.028, 0.038);
      const m = new THREE.Mesh(geo, emMat);
      m.position.set(side * (b.width / 2 - hlW / 2 - 0.04), hlY, frontZ - 0.02);
      grp.add(m);
    }
  } else if (lg.headlightShape === "round") {
    for (const side of [-1, 1]) {
      for (const k of [0.78, 0.54]) {
        const geo = new THREE.CylinderGeometry(0.062, 0.062, 0.03, 16);
        const m = new THREE.Mesh(geo, emMat);
        m.rotation.x = Math.PI / 2;
        m.position.set(side * b.width * k * 0.46, hlY, frontZ - 0.015);
        grp.add(m);
      }
    }
  } else if (lg.headlightShape === "y-shape") {
    // Y-shaped DRL (Lamborghini) â€” three arms
    for (const side of [-1, 1]) {
      const base = new THREE.BoxGeometry(0.018, hlW * 0.6, 0.038);
      const bm = new THREE.Mesh(base, emMat);
      bm.position.set(side * (b.width * 0.36), hlY, frontZ - 0.02);
      grp.add(bm);
      // two upper branches
      for (const angle of [-0.45, 0.45]) {
        const brGeo = new THREE.BoxGeometry(0.018, hlW * 0.38, 0.038);
        const br = new THREE.Mesh(brGeo, emMat);
        br.position.set(side * (b.width * 0.36 + Math.sin(angle) * hlW * 0.2), hlY + hlW * 0.34, frontZ - 0.02);
        br.rotation.z = -side * angle;
        grp.add(br);
      }
    }
  } else {
    // diamond / swept / quad-round â€” generic strip pair
    for (const side of [-1, 1]) {
      const geo = new THREE.BoxGeometry(hlW, 0.028, 0.036);
      const m = new THREE.Mesh(geo, emMat);
      m.position.set(side * (b.width / 2 - hlW / 2 - 0.05), hlY, frontZ - 0.018);
      grp.add(m);
    }
  }

  // DRL
  if (lg.drlShape !== "none") {
    const drlMat = new THREE.MeshStandardMaterial({ color: "#dbeeff", emissive: "#dbeeff", emissiveIntensity: 1.4, toneMapped: false });
    if (lg.drlShape === "strip" || lg.drlShape === "C-shape") {
      for (const side of [-1, 1]) {
        const geo = new THREE.BoxGeometry(hlW * 0.92, 0.012, 0.028);
        const m = new THREE.Mesh(geo, drlMat);
        m.position.set(side * (b.width / 2 - hlW / 2 - 0.05), hlY - 0.028, frontZ - 0.02);
        grp.add(m);
      }
    } else if (lg.drlShape === "ring") {
      for (const side of [-1, 1]) {
        const geo = new THREE.TorusGeometry(0.055, 0.008, 6, 24);
        const m = new THREE.Mesh(geo, drlMat);
        m.rotation.x = Math.PI / 2;
        m.position.set(side * b.width * 0.36, hlY, frontZ - 0.022);
        grp.add(m);
      }
    } else if (lg.drlShape === "L") {
      for (const side of [-1, 1]) {
        const hGeo = new THREE.BoxGeometry(hlW * 0.65, 0.01, 0.028);
        const h = new THREE.Mesh(hGeo, drlMat);
        h.position.set(side * (b.width / 2 - hlW * 0.18 - 0.04), hlY + 0.030, frontZ - 0.02);
        grp.add(h);
        const vGeo = new THREE.BoxGeometry(0.01, 0.062, 0.028);
        const v = new THREE.Mesh(vGeo, drlMat);
        v.position.set(side * (b.width / 2 - 0.05), hlY + 0.030, frontZ - 0.02);
        grp.add(v);
      }
    }
  }

  return grp;
}

function buildTailLights(prof: CarGeometry3D, braking: boolean): THREE.Group {
  const grp = new THREE.Group();
  const b = prof.body;
  const lg = prof.lighting;
  const rearZ = -b.length / 2;
  const intensity = braking ? 4.5 : 2.4;
  const tlMat = new THREE.MeshStandardMaterial({ color: lg.taillightColor, emissive: new THREE.Color(lg.taillightColor), emissiveIntensity: intensity, toneMapped: false });

  if (lg.taillightShape === "bar" || lg.taillightShape === "full-width") {
    const w = lg.taillightShape === "full-width" ? b.width * 0.9 : b.width * 0.82;
    const geo = new THREE.BoxGeometry(w, 0.022, 0.034);
    const m = new THREE.Mesh(geo, tlMat);
    m.position.set(0, lg.taillightY, rearZ + 0.017);
    grp.add(m);
    // End caps
    for (const side of [-1, 1]) {
      const cGeo = new THREE.BoxGeometry(0.022, 0.068, 0.034);
      const cm = new THREE.Mesh(cGeo, tlMat);
      cm.position.set(side * (b.width * 0.44), lg.taillightY - 0.023, rearZ + 0.017);
      grp.add(cm);
    }
  } else if (lg.taillightShape === "round") {
    for (const side of [-1, 1]) {
      for (const k of [0.78, 0.54]) {
        const geo = new THREE.CylinderGeometry(0.055, 0.055, 0.028, 16);
        const m = new THREE.Mesh(geo, tlMat);
        m.rotation.x = Math.PI / 2;
        m.position.set(side * b.width * k * 0.46, lg.taillightY, rearZ + 0.014);
        grp.add(m);
      }
    }
  } else if (lg.taillightShape === "boomerang") {
    for (const side of [-1, 1]) {
      // Boomerang: wide outer + inner strip at angle
      const geo1 = new THREE.BoxGeometry(b.width * 0.28, 0.02, 0.032);
      const m1 = new THREE.Mesh(geo1, tlMat);
      m1.position.set(side * b.width * 0.34, lg.taillightY, rearZ + 0.016);
      m1.rotation.z = side * 0.24;
      grp.add(m1);
      const geo2 = new THREE.BoxGeometry(0.018, b.width * 0.06, 0.032);
      const m2 = new THREE.Mesh(geo2, tlMat);
      m2.position.set(side * b.width * 0.47, lg.taillightY - 0.038, rearZ + 0.016);
      grp.add(m2);
    }
  } else if (lg.taillightShape === "y-shape") {
    for (const side of [-1, 1]) {
      const stem = new THREE.BoxGeometry(0.018, b.width * 0.09, 0.032);
      const sm = new THREE.Mesh(stem, tlMat);
      sm.position.set(side * b.width * 0.34, lg.taillightY, rearZ + 0.016);
      grp.add(sm);
      for (const angle of [-0.5, 0.5]) {
        const brGeo = new THREE.BoxGeometry(0.018, b.width * 0.055, 0.032);
        const br = new THREE.Mesh(brGeo, tlMat);
        br.position.set(side * (b.width * 0.34 + Math.sin(angle) * b.width * 0.055), lg.taillightY + b.width * 0.050, rearZ + 0.016);
        br.rotation.z = -side * angle;
        grp.add(br);
      }
    }
  } else if (lg.taillightShape === "vertical-strip") {
    for (const side of [-1, 1]) {
      const geo = new THREE.BoxGeometry(0.022, b.width * 0.12, 0.034);
      const m = new THREE.Mesh(geo, tlMat);
      m.position.set(side * (b.width * 0.44), lg.taillightY, rearZ + 0.017);
      grp.add(m);
    }
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Exhaust outlets
// ---------------------------------------------------------------------------
function buildExhausts(prof: CarGeometry3D): THREE.Group {
  const grp = new THREE.Group();
  const b = prof.body;
  const rearZ = -b.length / 2;
  const d = b.exhaustDiameter;
  const glowMat = new THREE.MeshStandardMaterial({ color: "#e5e7eb", emissive: "#8b5400", emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.9 });
  const innerMat = new THREE.MeshStandardMaterial({ color: "#07080a" });

  const positions: number[] = [];
  if (b.exhaustLayout === "centre") {
    positions.push(0);
  } else if (b.exhaustLayout === "split" || b.exhaustLayout === "wide-split") {
    const offset = b.exhaustLayout === "wide-split" ? b.width * 0.36 : b.width * 0.24;
    positions.push(-offset, offset);
  } else if (b.exhaustLayout === "quad-corners") {
    positions.push(-b.width * 0.38, -b.width * 0.26, b.width * 0.26, b.width * 0.38);
  } else if (b.exhaustLayout === "top-exit") {
    // top-exit: above boot lid
    const topGeo = new THREE.CylinderGeometry(d * 0.5, d * 0.5, 0.08, 12);
    const m = new THREE.Mesh(topGeo, glowMat);
    m.position.set(0, b.rideHeight + b.bootHeight + 0.04, rearZ + 0.24);
    m.rotation.z = Math.PI / 2;
    grp.add(m);
    return grp;
  }

  for (const x of positions) {
    const geo = new THREE.CylinderGeometry(d * 0.52, d * 0.52, 0.12, 12);
    const m = new THREE.Mesh(geo, glowMat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, b.rideHeight + b.bootHeight * 0.22, rearZ - 0.006);
    grp.add(m);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.34, d * 0.34, 0.04, 12), innerMat);
    inner.rotation.x = Math.PI / 2;
    inner.position.set(x, b.rideHeight + b.bootHeight * 0.22, rearZ - 0.06);
    grp.add(inner);
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Mirrors
// ---------------------------------------------------------------------------
function buildMirrors(prof: CarGeometry3D, paint: THREE.Color): THREE.Group {
  const grp = new THREE.Group();
  const b = prof.body;
  const mat = new THREE.MeshPhysicalMaterial({ color: paint, clearcoat: 0.8, metalness: 0.7, roughness: 0.2 });
  const isTrackCar = prof.bodyStyle === "track-car";
  for (const side of [-1, 1]) {
    const arm = new THREE.BoxGeometry(0.026, 0.038, 0.08);
    const m = new THREE.Mesh(arm, mat);
    m.position.set(side * (b.width / 2 * (isTrackCar ? 0.82 : 0.92) + 0.042), b.rideHeight + b.roofHeight * 0.62, b.cabinStart * b.length * 0.32);
    m.rotation.y = side * 0.12;
    grp.add(m);
    // mirror glass
    const faceGeo = new THREE.BoxGeometry(0.004, 0.052, 0.082);
    const faceMat = new THREE.MeshStandardMaterial({ color: "#1a2030", roughness: 0.05, metalness: 0.95 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(side * (b.width / 2 * 0.92 + 0.07), b.rideHeight + b.roofHeight * 0.62, b.cabinStart * b.length * 0.32);
    grp.add(face);
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Hood vents (Bolide, etc.)
// ---------------------------------------------------------------------------
function buildHoodVents(prof: CarGeometry3D): THREE.Group | null {
  if (!prof.aero.hasHoodVents) return null;
  const grp = new THREE.Group();
  const b = prof.body;
  const mat = carbonMat();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(0.06, 0.012, 0.14);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(side * (b.width * 0.22 + i * 0.075), b.rideHeight + b.hoodHeight + 0.006, b.length * 0.22);
      grp.add(m);
    }
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Window glass geometry â€” authentically tailored per vehicle architecture
// ---------------------------------------------------------------------------
function buildWindows(prof: CarGeometry3D): THREE.Group {
  const grp = new THREE.Group();
  const b = prof.body;
  const id = prof.id;
  const glass = glassMat();
  const trimMat = new THREE.MeshStandardMaterial({ color: "#080b12", roughness: 0.85 });

  const L = b.length;
  const f = L / 2;
  const halfW = b.width / 2;

  if (id === "bmw-m3-competition" || id.includes("m3") || id.includes("m4")) {
    // BMW M3 4-Door Sedan Greenhouse
    // 1. Upright Sedan Windshield (~58Â° rake)
    const wsAngle = 58 * (Math.PI / 180);
    const wsGeo = new THREE.PlaneGeometry(b.width * 0.64, 0.48);
    const ws = new THREE.Mesh(wsGeo, glass);
    ws.position.set(0, b.rideHeight + 1.06, f - 1.84);
    ws.rotation.x = -Math.PI / 2 + wsAngle;
    grp.add(ws);

    // 2. Sedan 4-Door Side Windows with B-Pillar divider
    for (const side of [-1, 1]) {
      // Front door window
      const frontSideGeo = new THREE.PlaneGeometry(0.58, 0.38);
      const frontSide = new THREE.Mesh(frontSideGeo, glass);
      frontSide.position.set(side * (halfW * 0.74), b.rideHeight + 1.05, f - 2.30);
      frontSide.rotation.y = side * Math.PI / 2;
      grp.add(frontSide);

      // Black B-Pillar vertical divider (authentic sedan 4-door construction)
      const bpGeo = new THREE.BoxGeometry(0.016, 0.40, 0.05);
      const bp = new THREE.Mesh(bpGeo, trimMat);
      bp.position.set(side * (halfW * 0.745), b.rideHeight + 1.05, f - 2.62);
      grp.add(bp);

      // Rear passenger door window
      const rearSideGeo = new THREE.PlaneGeometry(0.54, 0.38);
      const rearSide = new THREE.Mesh(rearSideGeo, glass);
      rearSide.position.set(side * (halfW * 0.73), b.rideHeight + 1.05, f - 2.95);
      rearSide.rotation.y = side * Math.PI / 2;
      grp.add(rearSide);
    }

    // 3. Notchback Rear Window (sloping down to separate trunk deck)
    const rwAngle = 56 * (Math.PI / 180);
    const rwGeo = new THREE.PlaneGeometry(b.width * 0.60, 0.42);
    const rw = new THREE.Mesh(rwGeo, glass);
    rw.position.set(0, b.rideHeight + 1.04, f - 3.48);
    rw.rotation.x = Math.PI / 2 - rwAngle;
    grp.add(rw);
  } else if (id === "porsche-911-gt3-rs" || id.includes("911") || id.includes("porsche")) {
    // Porsche 911 Continuous Flyline Curved Glasshouse
    const wsGeo = new THREE.PlaneGeometry(b.width * 0.62, 0.44);
    const ws = new THREE.Mesh(wsGeo, glass);
    ws.position.set(0, b.rideHeight + 0.86, f - 1.28);
    ws.rotation.x = -0.58;
    grp.add(ws);

    for (const side of [-1, 1]) {
      const swGeo = new THREE.PlaneGeometry(0.90, 0.34);
      const sw = new THREE.Mesh(swGeo, glass);
      sw.position.set(side * (halfW * 0.68), b.rideHeight + 0.84, f - 1.82);
      sw.rotation.y = side * Math.PI / 2;
      grp.add(sw);
    }

    const rwGeo = new THREE.PlaneGeometry(b.width * 0.50, 0.62);
    const rw = new THREE.Mesh(rwGeo, glass);
    rw.position.set(0, b.rideHeight + 0.76, f - 2.60);
    rw.rotation.x = 0.54;
    grp.add(rw);
  } else if (id === "bugatti-chiron" || id.includes("chiron") || id.includes("bugatti")) {
    // Bugatti Chiron: Wide low greenhouse framed by C-line
    const wsGeo = new THREE.PlaneGeometry(b.width * 0.60, 0.42);
    const ws = new THREE.Mesh(wsGeo, glass);
    ws.position.set(0, b.rideHeight + 0.74, f - 1.72);
    ws.rotation.x = -0.52;
    grp.add(ws);

    for (const side of [-1, 1]) {
      const swGeo = new THREE.PlaneGeometry(0.85, 0.28);
      const sw = new THREE.Mesh(swGeo, glass);
      sw.position.set(side * (halfW * 0.66), b.rideHeight + 0.72, f - 2.25);
      sw.rotation.y = side * Math.PI / 2;
      grp.add(sw);
    }

    const rwGeo = new THREE.PlaneGeometry(b.width * 0.44, 0.44);
    const rw = new THREE.Mesh(rwGeo, glass);
    rw.position.set(0, b.rideHeight + 0.70, f - 2.80);
    rw.rotation.x = 0.50;
    grp.add(rw);
  } else if (id === "koenigsegg-jesko" || id.includes("jesko") || id.includes("koenigsegg")) {
    // Koenigsegg Jesko: Jet-fighter wraparound visor dome
    const wsGeo = new THREE.PlaneGeometry(b.width * 0.60, 0.40);
    const ws = new THREE.Mesh(wsGeo, glass);
    ws.position.set(0, b.rideHeight + 0.66, f - 1.82);
    ws.rotation.x = -0.56;
    grp.add(ws);

    for (const side of [-1, 1]) {
      const swGeo = new THREE.PlaneGeometry(0.80, 0.26);
      const sw = new THREE.Mesh(swGeo, glass);
      sw.position.set(side * (halfW * 0.64), b.rideHeight + 0.64, f - 2.28);
      sw.rotation.y = side * Math.PI / 2;
      grp.add(sw);
    }

    const rwGeo = new THREE.PlaneGeometry(b.width * 0.42, 0.46);
    const rw = new THREE.Mesh(rwGeo, glass);
    rw.position.set(0, b.rideHeight + 0.64, f - 2.75);
    rw.rotation.x = 0.52;
    grp.add(rw);
  } else if (id === "lamborghini-aventador-svj" || id.includes("aventador") || id.includes("lamborghini")) {
    // Lamborghini Aventador SVJ: Extreme angular wedge canopy
    const wsGeo = new THREE.PlaneGeometry(b.width * 0.60, 0.42);
    const ws = new THREE.Mesh(wsGeo, glass);
    ws.position.set(0, b.rideHeight + 0.68, f - 1.95);
    ws.rotation.x = -0.60;
    grp.add(ws);

    for (const side of [-1, 1]) {
      const swGeo = new THREE.PlaneGeometry(0.85, 0.26);
      const sw = new THREE.Mesh(swGeo, glass);
      sw.position.set(side * (halfW * 0.64), b.rideHeight + 0.66, f - 2.45);
      sw.rotation.y = side * Math.PI / 2;
      grp.add(sw);
    }

    const rwGeo = new THREE.PlaneGeometry(b.width * 0.46, 0.48);
    const rw = new THREE.Mesh(rwGeo, glass);
    rw.position.set(0, b.rideHeight + 0.66, f - 2.95);
    rw.rotation.x = 0.55;
    grp.add(rw);
  } else if (id === "ferrari-sf90-stradale" || id.includes("sf90") || id.includes("ferrari")) {
    // Ferrari SF90 Stradale: Cab-forward bubble canopy
    const wsGeo = new THREE.PlaneGeometry(b.width * 0.62, 0.42);
    const ws = new THREE.Mesh(wsGeo, glass);
    ws.position.set(0, b.rideHeight + 0.73, f - 1.48);
    ws.rotation.x = -0.56;
    grp.add(ws);

    for (const side of [-1, 1]) {
      const swGeo = new THREE.PlaneGeometry(0.80, 0.28);
      const sw = new THREE.Mesh(swGeo, glass);
      sw.position.set(side * (halfW * 0.68), b.rideHeight + 0.72, f - 1.92);
      sw.rotation.y = side * Math.PI / 2;
      grp.add(sw);
    }

    const rwGeo = new THREE.PlaneGeometry(b.width * 0.46, 0.44);
    const rw = new THREE.Mesh(rwGeo, glass);
    rw.position.set(0, b.rideHeight + 0.70, f - 2.45);
    rw.rotation.x = 0.50;
    grp.add(rw);
  } else {
    // McLaren 720S: Teardrop 360-degree glasshouse
    const wsGeo = new THREE.PlaneGeometry(b.width * 0.64, 0.44);
    const ws = new THREE.Mesh(wsGeo, glass);
    ws.position.set(0, b.rideHeight + 0.72, f - 1.48);
    ws.rotation.x = -0.58;
    grp.add(ws);

    for (const side of [-1, 1]) {
      const swGeo = new THREE.PlaneGeometry(0.90, 0.30);
      const sw = new THREE.Mesh(swGeo, glass);
      sw.position.set(side * (halfW * 0.70), b.rideHeight + 0.70, f - 2.02);
      sw.rotation.y = side * Math.PI / 2;
      grp.add(sw);
    }

    const rwGeo = new THREE.PlaneGeometry(b.width * 0.52, 0.50);
    const rw = new THREE.Mesh(rwGeo, glass);
    rw.position.set(0, b.rideHeight + 0.68, f - 2.60);
    rw.rotation.x = 0.52;
    grp.add(rw);
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Grille (front face)
// ---------------------------------------------------------------------------
function buildGrille(prof: CarGeometry3D): THREE.Group {
  const grp = new THREE.Group();
  const b = prof.body;
  const frontZ = b.length / 2;
  const gW = b.width * prof.body.grilleWidth;
  const gH = b.height * prof.body.grilleHeight;
  const gY = b.rideHeight + gH * 0.6;
  const mat = new THREE.MeshStandardMaterial({ color: "#08090c", roughness: 0.8 });

  if (b.grilleType === "kidney") {
    // BMW-style twin kidney â€” two separate oval apertures
    for (const side of [-1, 1]) {
      const geo = new THREE.CylinderGeometry(gW * 0.22, gW * 0.18, gH, 16, 1);
      const m = new THREE.Mesh(geo, mat);
      m.rotation.z = Math.PI / 2;
      m.position.set(side * gW * 0.2, gY, frontZ - 0.005);
      grp.add(m);
      // grille border ring
      const ringGeo = new THREE.TorusGeometry(gW * 0.2, 0.012, 6, 20, Math.PI * 2);
      const ringMat = new THREE.MeshStandardMaterial({ color: "#9aa3b2", roughness: 0.3, metalness: 0.9 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(side * gW * 0.2, gY, frontZ - 0.001);
      grp.add(ring);
    }
  } else if (b.grilleType === "horseshoe") {
    // Bugatti horseshoe â€” single horseshoe aperture
    const geo = new THREE.TorusGeometry(gW * 0.4, 0.03, 8, 24, Math.PI * 1.4);
    const ringMat = new THREE.MeshStandardMaterial({ color: "#8b96a8", roughness: 0.25, metalness: 0.95 });
    const g = new THREE.Mesh(geo, ringMat);
    g.rotation.z = -Math.PI * 0.3;
    g.position.set(0, gY, frontZ - 0.002);
    grp.add(g);
    const fillGeo = new THREE.CylinderGeometry(gW * 0.38, gW * 0.38, gH * 0.8, 24, 1);
    const fill = new THREE.Mesh(fillGeo, mat);
    fill.rotation.z = Math.PI / 2;
    fill.position.set(0, gY, frontZ - 0.008);
    grp.add(fill);
  } else {
    // Generic wide mesh / louvred / full-width
    const fillGeo = new THREE.BoxGeometry(gW, gH, 0.032);
    const fill = new THREE.Mesh(fillGeo, mat);
    fill.position.set(0, gY, frontZ - 0.016);
    grp.add(fill);
    // Horizontal bars
    const bars = 5;
    const barMat = new THREE.MeshStandardMaterial({ color: "#2a2f3a", roughness: 0.5, metalness: 0.7 });
    for (let i = 0; i < bars; i++) {
      const bGeo = new THREE.BoxGeometry(gW - 0.03, 0.008, 0.014);
      const bm = new THREE.Mesh(bGeo, barMat);
      bm.position.set(0, gY - gH / 2 + (gH * (i + 0.5)) / bars, frontZ - 0.004);
      grp.add(bm);
    }
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Model-specific identifying geometry (silhouette & authentic details)
// ---------------------------------------------------------------------------
function buildModelDetails(prof: CarGeometry3D, paint: THREE.Color): THREE.Group | null {
  const grp = new THREE.Group();
  const b = prof.body;
  const id = prof.id;
  const carbon = carbonMat();
  const paintMaterial = new THREE.MeshPhysicalMaterial({ color: paint, clearcoat: 0.9, metalness: 0.8, roughness: 0.2 });

  if (id === "bmw-m3-competition" || id === "bmw-m4-competition") {
    // 1. Dual Vertical Kidney Grilles with vertical 3D slats
    const kw = b.width * 0.16;
    const kh = b.height * 0.32;
    const ky = b.rideHeight + b.frontFascia * b.height * 0.82;
    const kz = b.length / 2 + 0.005;
    for (const side of [-1, 1]) {
      const bezelGeo = new THREE.TorusGeometry(kw * 0.44, 0.014, 8, 20, Math.PI * 2);
      const bezelMat = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.2, metalness: 0.9 });
      const bezel = new THREE.Mesh(bezelGeo, bezelMat);
      bezel.scale.set(1, 1.45, 1);
      bezel.position.set(side * kw * 0.62, ky, kz);
      grp.add(bezel);

      // Vertical kidney double-slats
      for (let s = -2; s <= 2; s++) {
        const slatGeo = new THREE.BoxGeometry(0.008, kh * 0.78, 0.018);
        const slat = new THREE.Mesh(slatGeo, bezelMat);
        slat.position.set(side * kw * 0.62 + s * 0.014, ky, kz - 0.005);
        grp.add(slat);
      }
    }

    // 2. M Carbon Roof central aerodynamic channel
    const roofY = b.rideHeight + b.roofHeight + 0.005;
    const roofZ = b.length * (0.5 - (b.cabinStart + b.cabinEnd) / 2);
    const roofL = b.length * (b.cabinEnd - b.cabinStart) * 0.82;
    const ribGeo = new THREE.BoxGeometry(0.04, 0.012, roofL);
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(ribGeo, carbon);
      rib.position.set(side * b.width * 0.14, roofY, roofZ);
      grp.add(rib);
    }

    // 3. 4-door B-pillar (for M3 sedan)
    if (id === "bmw-m3-competition") {
      const bpGeo = new THREE.BoxGeometry(0.02, b.roofHeight * 0.48, 0.05);
      const bpMat = new THREE.MeshStandardMaterial({ color: "#090d16", roughness: 0.8 });
      for (const side of [-1, 1]) {
        const bp = new THREE.Mesh(bpGeo, bpMat);
        bp.position.set(side * (b.width * b.roofWidth * 0.49), b.rideHeight + b.hoodHeight + b.roofHeight * 0.24, b.length * (0.5 - (b.cabinStart + b.cabinEnd) / 2));
        grp.add(bp);
      }
    }

    // 4. M aerodynamic wing mirrors (twin stalk)
    for (const side of [-1, 1]) {
      const stalkGeo = new THREE.BoxGeometry(0.015, 0.04, 0.06);
      const stalk = new THREE.Mesh(stalkGeo, carbon);
      stalk.position.set(side * (b.width * 0.48), b.rideHeight + b.roofHeight * 0.68, b.length * (0.5 - b.cabinStart) + 0.04);
      grp.add(stalk);
    }
  }

  if (id === "porsche-911-gt3-rs") {
    // 1. Swan-Neck Rear Wing Mounts: arched pylons curving from engine deck to TOP of wing
    const rearZ = -b.length / 2;
    const baseY = b.rideHeight + b.bootHeight;
    const wingH = prof.aero.wingHeight;
    for (const side of [-1, 1]) {
      const p1 = new THREE.Vector3(side * b.width * 0.28, baseY + 0.02, rearZ + 0.32);
      const p2 = new THREE.Vector3(side * b.width * 0.28, baseY + wingH + 0.06, rearZ + 0.26);
      const p3 = new THREE.Vector3(side * b.width * 0.28, baseY + wingH + 0.01, rearZ + 0.18);
      const curve = new THREE.QuadraticBezierCurve3(p1, p2, p3);
      const pylonGeo = new THREE.TubeGeometry(curve, 12, 0.018, 6, false);
      const pylon = new THREE.Mesh(pylonGeo, carbon);
      pylon.castShadow = true;
      grp.add(pylon);
    }

    // 2. Front Fender Louvres: aerodynamic slats on top of front wheel arches
    const fwZ = prof.wheels.frontOffset;
    const fwX = b.width * 0.46;
    const fwY = prof.wheels.radius * 2.05;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const slatGeo = new THREE.BoxGeometry(0.08, 0.008, 0.022);
        const slat = new THREE.Mesh(slatGeo, carbon);
        slat.position.set(side * fwX, fwY, fwZ - 0.06 + i * 0.038);
        slat.rotation.x = -0.15;
        grp.add(slat);
      }
    }

    // 3. Dual Front Hood NACA Ducts
    for (const side of [-1, 1]) {
      const nacaGeo = new THREE.BoxGeometry(0.045, 0.008, 0.14);
      const nacaMat = new THREE.MeshStandardMaterial({ color: "#060910", roughness: 0.9 });
      const naca = new THREE.Mesh(nacaGeo, nacaMat);
      naca.position.set(side * b.width * 0.22, b.rideHeight + b.hoodHeight + 0.005, b.length * 0.24);
      grp.add(naca);
    }
  }

  if (id === "bugatti-chiron") {
    // 1. The iconic Bugatti C-Line (sweeping arch over roof and down side air intake)
    const cMat = new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.95, roughness: 0.12 });
    for (const side of [-1, 1]) {
      const pA = new THREE.Vector3(side * (b.width * 0.42), b.rideHeight + b.hoodHeight + 0.08, b.length * (0.5 - b.cabinStart));
      const pRoof = new THREE.Vector3(side * (b.width * 0.43), b.rideHeight + b.roofHeight + 0.02, 0);
      const pTurn = new THREE.Vector3(side * (b.width * 0.48), b.rideHeight + b.roofHeight * 0.45, -b.length * 0.18);
      const pBot = new THREE.Vector3(side * (b.width * 0.49), b.rideHeight + 0.04, -b.length * 0.05);
      const pFwd = new THREE.Vector3(side * (b.width * 0.47), b.rideHeight + 0.04, b.length * 0.15);

      const curve1 = new THREE.QuadraticBezierCurve3(pA, pRoof, pTurn);
      const curve2 = new THREE.QuadraticBezierCurve3(pTurn, pBot, pFwd);
      const path = new THREE.CurvePath<THREE.Vector3>();
      path.add(curve1);
      path.add(curve2);

      const cGeo = new THREE.TubeGeometry(path, 24, 0.022, 8, false);
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.castShadow = true;
      grp.add(cMesh);
    }

    // 2. Central Dorsal Spine (running down hood, roof, and rear engine deck)
    const spineMat = new THREE.MeshStandardMaterial({ color: "#c8d0de", metalness: 0.9, roughness: 0.2 });
    const spineGeo = new THREE.BoxGeometry(0.024, 0.016, b.length * 0.88);
    const spine = new THREE.Mesh(spineGeo, spineMat);
    spine.position.set(0, b.rideHeight + b.roofHeight * 0.78, 0);
    grp.add(spine);

    // 3. Quad Ice-Cube Headlights (4 crystal square projectors per side)
    const iceMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 3.5, toneMapped: false });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const iceGeo = new THREE.BoxGeometry(0.028, 0.022, 0.025);
        const ice = new THREE.Mesh(iceGeo, iceMat);
        ice.position.set(side * (b.width * 0.32 + i * 0.038), prof.lighting.headlightY, b.length / 2 - 0.01);
        grp.add(ice);
      }
    }
  }

  if (id === "koenigsegg-jesko") {
    // 1. Top-Mounted Boomerang Rear Wing with Central Spine Pylon
    const rearZ = -b.length / 2;
    const wingH = prof.aero.wingHeight;
    const spinePylonGeo = new THREE.BoxGeometry(0.03, wingH + 0.12, 0.38);
    const pylon = new THREE.Mesh(spinePylonGeo, carbon);
    pylon.position.set(0, b.rideHeight + b.roofHeight * 0.5 + wingH / 2, rearZ + 0.38);
    pylon.rotation.x = -0.22;
    pylon.castShadow = true;
    grp.add(pylon);

    // Boomerang swept wing shape
    for (const side of [-1, 1]) {
      const wingHalfGeo = new THREE.BoxGeometry(b.width * 0.52, 0.032, 0.28);
      const wh = new THREE.Mesh(wingHalfGeo, carbon);
      wh.position.set(side * b.width * 0.26, b.rideHeight + b.bootHeight + wingH + 0.02, rearZ + 0.22);
      wh.rotation.y = -side * 0.22; // Boomerang backward sweep!
      wh.rotation.z = -side * 0.04;
      wh.castShadow = true;
      grp.add(wh);
    }

    // 2. Dual Front Aero Canards (dive planes)
    for (const side of [-1, 1]) {
      for (let c = 0; c < 2; c++) {
        const canardGeo = new THREE.BoxGeometry(0.12, 0.008, 0.16);
        const canard = new THREE.Mesh(canardGeo, carbon);
        canard.position.set(side * (b.width * 0.44), b.rideHeight + 0.08 + c * 0.06, b.length / 2 - 0.18 - c * 0.05);
        canard.rotation.y = side * 0.35;
        canard.rotation.z = side * 0.18;
        grp.add(canard);
      }
    }

    // 3. Central Dorsal Stabilizer Fin on engine cover
    const finGeo = new THREE.BoxGeometry(0.018, 0.16, b.length * 0.28);
    const fin = new THREE.Mesh(finGeo, carbon);
    fin.position.set(0, b.rideHeight + b.roofHeight * 0.72, -b.length * 0.16);
    grp.add(fin);
  }

  if (id === "lamborghini-aventador-svj") {
    // 1. Dual Hood Nostrils (ALA 2.0 active aerodynamics)
    for (const side of [-1, 1]) {
      const nostrilGeo = new THREE.BoxGeometry(0.08, 0.015, 0.24);
      const nostrilMat = new THREE.MeshStandardMaterial({ color: "#05070e", roughness: 0.95 });
      const nostril = new THREE.Mesh(nostrilGeo, nostrilMat);
      nostril.position.set(side * b.width * 0.18, b.rideHeight + b.hoodHeight + 0.006, b.length * 0.26);
      nostril.rotation.y = side * 0.14;
      grp.add(nostril);
    }

    // 2. SVJ High-Mounted Bazooka Dual Exhausts
    const bazMat = new THREE.MeshStandardMaterial({ color: "#e5e7eb", metalness: 0.95, roughness: 0.15 });
    for (const side of [-1, 1]) {
      const bazGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.18, 16);
      const baz = new THREE.Mesh(bazGeo, bazMat);
      baz.rotation.x = Math.PI / 2;
      baz.position.set(side * 0.14, b.rideHeight + b.bootHeight * 0.82, -b.length / 2 - 0.02);
      grp.add(baz);
    }

    // 3. SVJ Omega Wing Center Stanchion
    const omegaPylonGeo = new THREE.BoxGeometry(0.04, 0.32, 0.16);
    const omegaPylon = new THREE.Mesh(omegaPylonGeo, carbon);
    omegaPylon.position.set(0, b.rideHeight + b.bootHeight + 0.14, -b.length / 2 + 0.26);
    omegaPylon.castShadow = true;
    grp.add(omegaPylon);

    // 4. Large Angular Side Intake Scoops
    for (const side of [-1, 1]) {
      const scoopGeo = new THREE.BoxGeometry(0.06, 0.18, 0.35);
      const scoop = new THREE.Mesh(scoopGeo, carbon);
      scoop.position.set(side * (b.width * 0.49), b.rideHeight + b.roofHeight * 0.35, -b.length * 0.12);
      scoop.rotation.y = -side * 0.12;
      grp.add(scoop);
    }
  }

  if (id === "ferrari-sf90-stradale") {
    // 1. Flying Buttresses flanking the rear window
    for (const side of [-1, 1]) {
      const fbGeo = new THREE.BoxGeometry(0.05, 0.14, b.length * 0.28);
      const fb = new THREE.Mesh(fbGeo, paintMaterial);
      fb.position.set(side * (b.width * 0.34), b.rideHeight + b.roofHeight * 0.62, -b.length * 0.15);
      fb.rotation.x = -0.32;
      fb.castShadow = true;
      grp.add(fb);
    }

    // 2. Dual Horizontal Squared Taillights (squoval rings)
    const tlMat = new THREE.MeshStandardMaterial({ color: "#ff1122", emissive: "#ff1122", emissiveIntensity: 3.5, toneMapped: false });
    for (const side of [-1, 1]) {
      for (const pos of [0.26, 0.38]) {
        const ringGeo = new THREE.BoxGeometry(0.062, 0.038, 0.02);
        const ring = new THREE.Mesh(ringGeo, tlMat);
        ring.position.set(side * b.width * pos, prof.lighting.taillightY, -b.length / 2 + 0.015);
        grp.add(ring);
      }
    }

    // 3. High Center Dual Exhausts (between taillights)
    const exMat = new THREE.MeshStandardMaterial({ color: "#d1d5db", metalness: 0.9, roughness: 0.2 });
    for (const side of [-1, 1]) {
      const exGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.14, 16);
      const ex = new THREE.Mesh(exGeo, exMat);
      ex.rotation.x = Math.PI / 2;
      ex.position.set(side * 0.11, prof.lighting.taillightY + 0.01, -b.length / 2 - 0.01);
      grp.add(ex);
    }
  }

  if (id === "mclaren-720s") {
    // 1. Deep "Eye-Socket" Headlight Cavities with integrated air intakes
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#060912", roughness: 0.9 });
    for (const side of [-1, 1]) {
      const socketGeo = new THREE.BoxGeometry(0.14, 0.08, 0.16);
      const socket = new THREE.Mesh(socketGeo, eyeMat);
      socket.position.set(side * (b.width * 0.36), prof.lighting.headlightY - 0.01, b.length / 2 - 0.06);
      grp.add(socket);
      // Thin LED blade headlight within the socket
      const ledGeo = new THREE.BoxGeometry(0.11, 0.012, 0.02);
      const ledMat = new THREE.MeshStandardMaterial({ color: "#e0f2fe", emissive: "#e0f2fe", emissiveIntensity: 3.2, toneMapped: false });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(side * (b.width * 0.36), prof.lighting.headlightY + 0.018, b.length / 2 - 0.01);
      grp.add(led);
    }

    // 2. Glazed Rear C-Pillars (transparent rear quarters)
    const glassMat = new THREE.MeshPhysicalMaterial({ color: "#050814", transmission: 0.88, opacity: 1, transparent: true, roughness: 0.08, ior: 1.5 });
    for (const side of [-1, 1]) {
      const qGeo = new THREE.BoxGeometry(0.02, 0.16, 0.28);
      const qp = new THREE.Mesh(qGeo, glassMat);
      qp.position.set(side * (b.width * b.roofWidth * 0.44), b.rideHeight + b.roofHeight * 0.68, -b.length * 0.12);
      qp.rotation.x = -0.35;
      grp.add(qp);
    }

    // 3. High Center Dual Round Exhausts in open mesh
    const mclExMat = new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.95, roughness: 0.15 });
    for (const side of [-1, 1]) {
      const eg = new THREE.CylinderGeometry(0.046, 0.046, 0.14, 16);
      const em = new THREE.Mesh(eg, mclExMat);
      em.rotation.x = Math.PI / 2;
      em.position.set(side * 0.13, b.rideHeight + b.bootHeight * 0.72, -b.length / 2 - 0.01);
      grp.add(em);
    }
  }

  return grp.children.length > 0 ? grp : null;
}

// ---------------------------------------------------------------------------
// Underglow plane
// ---------------------------------------------------------------------------
function buildUnderglow(prof: CarGeometry3D, color: string): THREE.Mesh {
  const b = prof.body;
  const geo = new THREE.PlaneGeometry(b.width + 0.8, b.length * 0.7);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.022;
  return m;
}

// ---------------------------------------------------------------------------
// Main CarModel3D component
// ---------------------------------------------------------------------------
export interface CarModel3DProps {
  build: CarBuild;
  /** World-space position */
  position?: [number, number, number];
  /** Y-axis rotation (radians) */
  rotationY?: number;
  /** If true, show inspect highlights */
  inspectPart?: string | null;
  /** Enable subtle idle float animation */
  float?: boolean;
  /** braking state for brake light intensity */
  braking?: boolean;
  /** override profile id (for rivals in race) */
  overrideProfileId?: string;
}

export function CarModel3D({
  build,
  position = [0, 0, 0],
  rotationY = 0,
  inspectPart = null,
  float: floatAnim = false,
  braking = false,
  overrideProfileId,
}: CarModel3DProps) {
  const group = useRef<THREE.Group>(null);
  const pid = overrideProfileId ?? build.def.id;
  const prof = getCar3DProfile(pid);
  const spoil = resolvedSpoiler(build);
  const wheelStyle = resolvedWheels(build);
  const glowOn = build.custom.glow !== "none";
  const glowColor = glowOn ? String(build.custom.glow) : "#22d3ee";
  const paint = useMemo(() => new THREE.Color(build.custom.paint || build.def.defaultPaint), [build.custom.paint, build.def.defaultPaint]);

  useFrame((state) => {
    if (!group.current || !floatAnim) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    group.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.2) * 0.016;
  });

  // Memoize heavy geometry
  const bodyGeo = useMemo(() => buildBodyGeometry(prof), [pid]);

  const paintMaterial = useMemo(
    () => paintMat(paint, prof.clearcoatStrength, prof.metallicness, prof.roughness),
    [paint, prof.clearcoatStrength, prof.metallicness, prof.roughness]
  );
  const b = prof.body;
  const wh = prof.wheels;
  const halfW = b.width / 2;

  // Wheel positions — clamp the track so every wheel sits INSIDE its fender.
  // (Profile trackWidth values are nominal; the body half-width is the hard limit.)
  const maxTrack = halfW - wh.width * 0.5 - 0.01;
  const track = Math.min(wh.trackWidth, maxTrack);
  const wheelPositions: [number, number, number][] = [
    [-track, wh.radius, wh.frontOffset],
    [track, wh.radius, wh.frontOffset],
    [-track, wh.radius, wh.rearOffset],
    [track, wh.radius, wh.rearOffset],
  ];
  const mirroredX = [true, false, true, false]; // left wheels mirror X

  const splitter = useMemo(() => buildSplitter(prof, paint), [pid, paint.getHex()]);
  const rearWing = useMemo(() => buildRearWing(prof, paint, spoil), [pid, paint.getHex(), spoil]);
  const diffuser = useMemo(() => buildDiffuser(prof), [pid]);
  const skirts = useMemo(() => buildSideSkirts(prof, paint), [pid, paint.getHex()]);
  const headlights = useMemo(() => buildHeadlights(prof, glowOn ? glowColor : null), [pid, glowColor]);
  const taillights = useMemo(() => buildTailLights(prof, braking), [pid, braking]);
  const exhausts = useMemo(() => buildExhausts(prof), [pid]);
  const mirrors = useMemo(() => buildMirrors(prof, paint), [pid, paint.getHex()]);
  const hoodVents = useMemo(() => buildHoodVents(prof), [pid]);
  const grille = useMemo(() => buildGrille(prof), [pid]);
  const modelDetails = useMemo(() => buildModelDetails(prof, paint), [pid, paint.getHex()]);
  const windows = useMemo(() => buildWindows(prof), [pid]);
  const wheelWells = useMemo(
    () =>
      ([wh.frontOffset, wh.rearOffset] as const).flatMap((wz, ai) =>
        ([-1, 1] as const).map((side) => {
          const well = buildWheelWell(wh.radius, wh.width);
          well.position.set(side * track, wh.radius, wz);
          if (side === 1) well.rotation.y = Math.PI;
          return { key: `well-${ai}-${side}`, object: well };
        }),
      ),
    [track, wh.frontOffset, wh.rearOffset, wh.radius, wh.width],
  );
  const wheels = useMemo(
    () =>
      wheelPositions.map((wpos, wi) => {
        const wheelGroup = buildWheelGeometry(wh.radius, wh.width, wh.rimSpokes, wheelStyle);
        if (mirroredX[wi]) wheelGroup.scale.x = -1;
        wheelGroup.position.set(...wpos);
        wheelGroup.traverse((c) => { if (c instanceof THREE.Mesh) c.castShadow = true; });
        return { key: `wheel-${wi}`, object: wheelGroup };
      }),
    [wheelStyle, wh.radius, wh.width, wh.rimSpokes, track, wh.frontOffset, wh.rearOffset],
  );
  const underglow = useMemo(
    () => glowOn ? buildUnderglow(prof, glowColor) : null,
    [glowOn, glowColor, pid],
  );

  // Inspect highlight material
  const hl = (part: string) => inspectPart === part;

  return (
    <group
      ref={group}
      position={position}
      rotation={[0, rotationY, 0]}
    >
      {/* ── Body ──────────────────────────────────────────────────────── */}
      <mesh geometry={bodyGeo} material={paintMaterial} castShadow receiveShadow />

      {/* ── Windows (Accurately sculpted per vehicle architecture) ──── */}
      <primitive object={windows} />

      {/* ── Model-specific real-world geometry ───────────────────────── */}
      {modelDetails && <primitive object={modelDetails} />}

      {/* ── Aero components ─────────────────────────────────────────── */}
      {splitter && <primitive object={splitter} />}
      {rearWing && <primitive object={rearWing} />}
      {diffuser && <primitive object={diffuser} />}
      {skirts && <primitive object={skirts} />}
      {hoodVents && <primitive object={hoodVents} />}

      {/* ── Lights ──────────────────────────────────────────────────── */}
      <primitive object={headlights} />
      <primitive object={taillights} />
      <primitive object={exhausts} />
      <primitive object={mirrors} />
      <primitive object={grille} />

      {/* ── Wheel wells (dark inner liner recesses inside bodywork) ─── */}
      {wheelWells.map(({ key, object }) => <primitive key={key} object={object} />)}

      {/* â”€â”€ Wheels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {wheels.map(({ key, object }) => <primitive key={key} object={object} />)}

      {/* â”€â”€ Underglow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {underglow && <primitive object={underglow} />}

      {/* â”€â”€ Inspect accent lighting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {hl("wheels") && <pointLight position={[0, 0.3, 0]} intensity={4} color="#22d3ee" distance={3} />}
      {hl("spoiler") && <pointLight position={[0, b.rideHeight + b.bootHeight + 0.5, -b.length / 2]} intensity={5} color="#22d3ee" distance={2.5} />}
      {hl("headlights") && <pointLight position={[0, b.rideHeight + 0.4, b.length / 2 + 0.4]} intensity={6} color={prof.lighting.headlightColor} distance={3} />}
      {hl("exhaust") && <pointLight position={[0, b.rideHeight + 0.2, -b.length / 2 - 0.2]} intensity={6} color="#ff6600" distance={2} />}
    </group>
  );
}
