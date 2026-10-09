/**
 * RaceCarOverlay.tsx
 *
 * A transparent Three.js WebGL canvas that sits on top of the 2D road canvas
 * and renders the player's car (and nearby opponents) as real 3D geometry.
 *
 * Architecture:
 *   GameScreen
 *     ├── <canvas> (2D road: RoadRenderer)        ← behind
 *     └── <RaceCarOverlay>                        ← on top, transparent bg
 *           └── Three.js Canvas
 *                 ├── player CarModel3D            (large, centred, low)
 *                 └── opponent CarModel3D ×3       (smaller, at road positions)
 *
 * The 2D road handles:  background, road geometry, distant sprite objects
 * This overlay handles: player car + nearby opponents as full 3D geometry
 *
 * Camera: a fixed chase-cam showing the car from 3/4 rear-left at bumper
 * height — enough to see hood, roof, wheels, spoiler and body depth.
 *
 * The opponent positions are given in normalised screen space from the
 * GameEngine so we can map them to 3D world positions.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CarBuild } from "@/game/types";
import { CarModel3D } from "./garage/CarModel3D";
import { getCar3DProfile } from "@/game/car3D";

export interface OpponentInfo {
  build: CarBuild;
  /** normalised screen x position of opponent (0 = left, 1 = right) */
  screenX: number;
  /** 0 = far away, 1 = right behind player */
  proximity: number;
  paint: string;
}

export interface RaceCarOverlayProps {
  playerBuild: CarBuild;
  opponents: OpponentInfo[];
  nitroActive: boolean;
  braking: boolean;
  stutter: boolean;
  speedFactor: number;
}

// Race camera: centered, low rear chase view matching the arcade reference.
const CAM_POS = new THREE.Vector3(0, 1.28, 5.6);
const CAM_TARGET = new THREE.Vector3(0, 0.58, -0.35);
const PERF_ENABLED = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf");

interface PerfStats {
  fps: number;
  frameTime: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  meshes: number;
  requests404: number;
}

function RacePerformanceHud({ onUpdate }: { onUpdate: (stats: PerfStats) => void }) {
  const { gl, scene } = useThree();
  const frames = useRef({ count: 0, last: performance.now() });
  const requests404 = useRef(0);

  useFrame(() => {
    frames.current.count++;
  });

  useEffect(() => {
    const onResourceError = (event: ErrorEvent) => {
      if (event.target instanceof HTMLImageElement || event.target instanceof HTMLMediaElement || event.target instanceof HTMLScriptElement) {
        requests404.current++;
      }
    };
    window.addEventListener("error", onResourceError, true);
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.max(1, now - frames.current.last);
      let meshes = 0;
      scene.traverse((object) => { if (object instanceof THREE.Mesh) meshes++; });
      onUpdate({
        fps: Math.round(frames.current.count * 1000 / elapsed),
        frameTime: elapsed / Math.max(1, frames.current.count),
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        meshes,
        requests404: requests404.current,
      });
      frames.current.count = 0;
      frames.current.last = now;
    }, 500);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("error", onResourceError, true);
    };
  }, [gl, onUpdate, scene]);

  return null;
}

function Scene({
  playerBuild,
  opponents,
  nitroActive,
  braking,
  stutter,
  speedFactor,
}: RaceCarOverlayProps) {
  // Animated steer/body-roll: small vibration when typo stutter occurs
  const rollZ = stutter ? 0.025 : 0;
  const playerY = Math.min(0.012, speedFactor * 0.004); // sits on road at y=0

  const playerProf = getCar3DProfile(playerBuild.def.id);

  // Key + fill lights
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.62} />
      <directionalLight
        position={[4, 8, 6]}
        intensity={2.1}
      />
      <directionalLight position={[-3, 3, -4]} intensity={0.55} color="#a0c8ff" />
      {/* Nitro blue back light */}
      {nitroActive && (
        <pointLight
          position={[0, 0.5, -playerProf.body.length / 2 - 0.6]}
          intensity={8}
          color="#38bdf8"
          distance={4}
        />
      )}
      {/* Brake glow */}
      {braking && (
        <pointLight
          position={[0, 0.5, -playerProf.body.length / 2 - 0.3]}
          intensity={4}
          color="#ff2233"
          distance={3}
        />
      )}

      {/* Player car — centered rear view, facing away from the camera */}
      <group position={[0, -0.02, 0.18]} rotation={[0, 0, rollZ]} scale={1.12}>
        <CarModel3D
          build={playerBuild}
          position={[0, playerY, 0]}
          rotationY={Math.PI}   /* face camera */
          inspectPart={null}
          float={false}
          braking={braking}
        />
      </group>

      {/* Opponent cars — positioned to left/right based on their road lane */}
      {opponents.map((opp, i) => {
        // Keep the race silhouette focused on the player; distant rivals are
        // already represented by the 2D road renderer.
        if (opp.proximity < 0.35) return null;
        const oppX = (opp.screenX - 0.5) * 12;  // -6 to +6 world units lateral
        const oppZ = -(8 + i * 4) / opp.proximity; // further = smaller z offset
        const scale = Math.max(0.25, opp.proximity * 0.72);
        return (
          <group key={i} position={[oppX, 0, oppZ]} scale={[scale, scale, scale]}>
            <CarModel3D
              build={opp.build}
              position={[0, 0, 0]}
              rotationY={Math.PI}
              inspectPart={null}
              float={false}
              braking={false}
            />
          </group>
        );
      })}

    </>
  );
}

export function RaceCarOverlay(props: RaceCarOverlayProps) {
  const [perf, setPerf] = useState<PerfStats | null>(null);
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <Canvas
        shadows={false}
        gl={{
          alpha: true,          // transparent background — road shows through
          antialias: true,
          powerPreference: "high-performance",
        }}
        camera={{ position: CAM_POS.toArray() as [number, number, number], fov: 35, near: 0.1, far: 80 }}
        dpr={[1, 1.25]}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMappingExposure = 1.15;
          (camera as THREE.PerspectiveCamera).lookAt(CAM_TARGET);
        }}
      >
        <Suspense fallback={null}>
          <Scene {...props} />
          {PERF_ENABLED && <RacePerformanceHud onUpdate={setPerf} />}
        </Suspense>
      </Canvas>
      {PERF_ENABLED && perf && (
        <div className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 font-mono text-[10px] leading-4 text-cyan-200">
          <div>FPS: {perf.fps}</div>
          <div>FRAME TIME: {perf.frameTime.toFixed(1)} ms</div>
          <div>DRAW CALLS: {perf.calls}</div>
          <div>TRIANGLES: {perf.triangles}</div>
          <div>GEOMETRIES: {perf.geometries}</div>
          <div>TEXTURES: {perf.textures}</div>
          <div>CAR MESHES: {perf.meshes}</div>
          <div>PARTICLES: 0</div>
          <div>404 REQUESTS: {perf.requests404}</div>
        </div>
      )}
    </div>
  );
}
