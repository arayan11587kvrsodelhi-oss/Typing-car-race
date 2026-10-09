// Measures the real generated geometry of all 7 road-car bodies.
// Run with: npx tsx measure-bodies.ts
import * as THREE from "three";
import { getCar3DProfile } from "./src/game/car3D";
import {
  generateBMWM3Body,
  generatePorsche911GT3RSBody,
  generateBugattiChironBody,
  generateKoenigseggJeskoBody,
  generateAventadorSVJBody,
  generateFerrariSF90Body,
  generateMcLaren720SBody,
} from "./src/components/garage/CarModel3D";

const gens: [string, (p: any) => THREE.BufferGeometry][] = [
  ["bmw-m3-competition", generateBMWM3Body],
  ["porsche-911-gt3-rs", generatePorsche911GT3RSBody],
  ["bugatti-chiron", generateBugattiChironBody],
  ["koenigsegg-jesko", generateKoenigseggJeskoBody],
  ["lamborghini-aventador-svj", generateAventadorSVJBody],
  ["ferrari-sf90-stradale", generateFerrariSF90Body],
  ["mclaren-720s", generateMcLaren720SBody],
];

console.log("model".padEnd(26), "lenX".padStart(6), "hgtY".padStart(6), "widZ".padStart(6), "roofY".padStart(6), "verts".padStart(7));
for (const [id, gen] of gens) {
  const prof = getCar3DProfile(id);
  const g = gen(prof);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const verts = g.getAttribute("position").count;
  const dx = bb.max.x - bb.min.x;
  const dy = bb.max.y - bb.min.y;
  const dz = bb.max.z - bb.min.z;
  console.log(
    id.padEnd(26),
    dx.toFixed(2).padStart(6),
    dy.toFixed(2).padStart(6),
    dz.toFixed(2).padStart(6),
    bb.max.y.toFixed(2).padStart(6),
    String(verts).padStart(7),
  );
}