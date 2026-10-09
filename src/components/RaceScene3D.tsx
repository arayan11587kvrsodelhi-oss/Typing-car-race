/**
 * RaceScene3D.tsx
 *
 * The real 3D racing world.  Replaces the 2D `RoadRenderer` canvas with a
 * genuine Three.js perspective scene:
 *
 *   • a perspective road with lane markings and rumble strips that scrolls to
 *     communicate forward velocity
 *   • roadside city buildings, a ground plane and a fogged horizon
 *   • a chase camera (deliberately NOT the garage close-up)
 *   • directional lighting with ground shadows
 *   • the seven real vehicles, rendered with the SAME `CarModel3D` component and
 *     `car3D.ts` profiles the garage uses — no sprites, no generic meshes
 *
 * WORLD SCALE
 * -----------
 * The imported car profiles are authored in metres (a car is ~4.5–5.0 long and
 * ~1.1–1.4 tall), and `CarModel3D` normalises its body to exactly those
 * dimensions.  This scene therefore works entirely in metres:
 *
 *     road half-width   4.0 m   (4 lanes)
 *     lane width        1.5 m
 *     camera            6.0 m above, 11 m behind the car
 *
 * The engine's own `SEGMENT_LENGTH` (200) is a *track* unit and is deliberately
 * NOT used for geometry — only to convert travelled distance into metres.
 *
 * SIMULATION OWNERSHIP
 * --------------------
 * This component NEVER calls `engine.update()`.  `GameScreen` owns the single
 * authoritative loop; this scene only READS engine state each frame, so exactly
 * one simulation update happens per frame.
 *
 * PERFORMANCE
 * -----------
 * All geometry/materials are created once.  Road motion is a single texture-free
 * scroll of a fixed mesh pool plus a moving set of dashed markings; scenery is a
 * fixed pool.  No allocations and no React state updates during animation.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GameEngine } from "@/game/engine";
import { SEGMENT_LENGTH } from "@/game/track";
import type { CarBuild, GraphicsQuality } from "@/game/types";
import type { EnvPalette } from "@/game/environments";
import { CarModel3D } from "./garage/CarModel3D";

/** Live engine handle shared with the scene without triggering React renders. */
export interface EngineHandle {
  current: GameEngine | null;
}

export interface RaceScene3DProps {
  engineRef: EngineHandle;
  playerBuild: CarBuild;
  env: EnvPalette;
  opponentBuilds: CarBuild[];
  quality: GraphicsQuality;
  onReady?: () => void;
}

/* ------------------------------------------------------- world dimensions */

const ROAD_HALF_W = 4.0;        // half road width in metres
const LANE_W = 2.0;             // one lane
const ROAD_LEN = 260;           // how much road is drawn ahead
const DASH_PERIOD = 6;          // metres between centre-line dashes

const CAM_HEIGHT = 2.6;         // metres above the road
const CAM_BACK = 8.2;           // metres behind the car centre
const CAM_LOOK_AHEAD = 16;      // aim this far down the road
const CAM_LOOK_Y = 2.4;         // aim ABOVE the car so the car reads low in frame

/** Real-world metres per track unit. */
const METRES_PER_SEGMENT = 1 / SEGMENT_LENGTH;

interface QualityProfile {
  dpr: number;
  roadDashes: number;
  scenery: number;
  streaks: number;
  shadows: boolean;
  shadowMap: number;
  fps: number;
}

const QUALITY: Record<GraphicsQuality, QualityProfile> = {
  low: { dpr: 1, roadDashes: 24, scenery: 18, streaks: 12, shadows: false, shadowMap: 0, fps: 30 },
  medium: { dpr: 1.25, roadDashes: 32, scenery: 30, streaks: 20, shadows: true, shadowMap: 512, fps: 60 },
  high: { dpr: 1.5, roadDashes: 43, scenery: 46, streaks: 30, shadows: true, shadowMap: 1024, fps: 60 },
};

/* ------------------------------------------------------------ tiny helpers */

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ------------------------------------------------------------------ road */

/**
 * The road surface, kerbs and dashed centre-line.
 *
 * Motion is produced by a repeating pattern: the centre-line dashes advance
 * toward the camera and wrap, and a subtle texture-less sheen is not used at
 * all — the moving dashes plus the speed streaks are what sell velocity.
 */
function Road({ engineRef, env, quality }: { engineRef: EngineHandle; env: EnvPalette; quality: QualityProfile }) {
  const dashes = useRef<(THREE.Mesh | null)[]>([]);
  const travelled = useRef(0);

  const roadMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: env.road[0], roughness: 0.94, metalness: 0.02 }),
    [env],
  );
  const kerbMatA = useMemo(
    () => new THREE.MeshStandardMaterial({ color: env.rumble[0], roughness: 0.85 }),
    [env],
  );
  const kerbMatB = useMemo(
    () => new THREE.MeshStandardMaterial({ color: env.rumble[1], roughness: 0.85 }),
    [env],
  );
  const dashMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: env.lane,
        roughness: 0.6,
        emissive: env.lane,
        emissiveIntensity: 0.18,
      }),
    [env],
  );

  const dashGeo = useMemo(() => new THREE.PlaneGeometry(0.16, 2.4), []);

  // Advance the dashes with the player's real speed, wrapping each one.
  useFrame((_, rawDt) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.state !== "running") return;
    const dt = Math.min(0.05, rawDt);
    // speedFactor is 0..~1.4; convert to metres/second.
    const speed = engine.speedFactor * 55;
    travelled.current += speed * dt;
    const offset = travelled.current % DASH_PERIOD;

    dashes.current.forEach((m, i) => {
      if (!m) return;
      const base = -(i * DASH_PERIOD);
      let z = base + offset;
      // Keep the finite marking pool moving through the visible road.
      if (z > 0) z -= ROAD_LEN;
      m.position.z = z;
    });
  });

  return (
    <group>
      {/* tarmac */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -ROAD_LEN / 2 + 20]} receiveShadow>
        <planeGeometry args={[ROAD_HALF_W * 2, ROAD_LEN + 60]} />
        <primitive object={roadMat} attach="material" />
      </mesh>

      {/* kerbs — a continuous strip either side */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[side * (ROAD_HALF_W + 0.35), 0.02, -ROAD_LEN / 2 + 20]}
        >
          <planeGeometry args={[0.7, ROAD_LEN + 60]} />
          <primitive object={side < 0 ? kerbMatA : kerbMatB} attach="material" />
        </mesh>
      ))}

      {/* dashed lane markings down the two inner lane separators */}
      {[-LANE_W, LANE_W].map((lx) =>
        Array.from({ length: quality.roadDashes }).map((_, i) => (
          <mesh
            key={`${lx}-${i}`}
            ref={(m) => {
              if (m) dashes.current[lx < 0 ? i : quality.roadDashes + i] = m;
            }}
            geometry={dashGeo}
            material={dashMat}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[lx, 0.03, -(i * ROAD_LEN / quality.roadDashes)]}
          />
        )),
      )}
    </group>
  );
}

/* --------------------------------------------------------------- scenery */

/** Roadside buildings on both sides, plus a fogged horizon plane. */
function Scenery({ env, quality }: { env: EnvPalette; quality: QualityProfile }) {
  const COUNT = quality.scenery;

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: env.mid.colors[0], roughness: 0.9, metalness: 0.1 }),
    [env],
  );
  const windowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: env.mid.colors[1],
        emissive: env.lampLight,
        emissiveIntensity: 0.7,
        roughness: 0.4,
      }),
    [env],
  );

  const specs = useMemo(
    () =>
      Array.from({ length: COUNT }).map((_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const h = 8 + hash01(i * 3.1) * 26;
        const w = 5 + hash01(i * 7.7) * 9;
        const depth = 5 + hash01(i * 4.4) * 8;
        const gap = 9 + hash01(i * 5.3) * 22;         // metres out from the kerb
        const z = -(i * 11) - 8;                       // march into the distance
        return { side, h, w, depth, gap, z };
      }),
    [],
  );

  return (
    <group>
      {specs.map((s, i) => (
        <group key={i} position={[s.side * (ROAD_HALF_W + s.gap), 0, s.z]}>
          <mesh geometry={boxGeo} material={wallMat} position={[0, s.h / 2, 0]} scale={[s.w, s.h, s.depth]} />
          {/* a lit window band facing the road */}
          <mesh
            geometry={boxGeo}
            material={windowMat}
            position={[s.side * -s.w * 0.51, s.h * 0.55, 0]}
            scale={[0.12, s.h * 0.32, s.depth * 0.7]}
          />
        </group>
      ))}
    </group>
  );
}

/* --------------------------------------------------------- road streaks */

/** Short ground streaks that rush past to reinforce speed. */
function SpeedStreaks({ engineRef, env, quality }: { engineRef: EngineHandle; env: EnvPalette; quality: QualityProfile }) {
  const COUNT = quality.streaks;
  const items = useRef<(THREE.Mesh | null)[]>([]);
  const travel = useRef(0);

  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }).map((_, i) => ({
        x: (hash01(i * 2.7) - 0.5) * ROAD_HALF_W * 1.8,
        z: -hash01(i * 9.1) * 90,
      })),
    [],
  );

  const geo = useMemo(() => new THREE.PlaneGeometry(0.09, 3.2), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: env.edge, transparent: true, opacity: 0.22 }),
    [env],
  );

  useFrame((_, rawDt) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.state !== "running") return;
    const dt = Math.min(0.05, rawDt);
    travel.current += engine.speedFactor * 46 * dt;
    const off = travel.current % 90;
    items.current.forEach((m, i) => {
      if (!m) return;
      m.position.z = seeds[i].z + off;
      if (m.position.z > 8) m.position.z -= 90;
    });
  });

  return (
    <group>
      {seeds.map((s, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) items.current[i] = m;
          }}
          geometry={geo}
          material={mat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[s.x, 0.02, s.z]}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ world */

function World({ engineRef, playerBuild, env, opponentBuilds, quality: qualityId, onReady }: RaceScene3DProps) {
  const quality = QUALITY[qualityId];
  const { camera } = useThree();
  const playerGroup = useRef<THREE.Group>(null);
  const oppGroups = useRef<(THREE.Group | null)[]>([]);
  const rollRef = useRef(0);
  const bendRef = useRef(0);
  const worldRef = useRef<THREE.Group>(null);
  const [carsReady, setCarsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCarsReady(true);
      onReady?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onReady]);

  // Lanes (metres) for the three rivals, matching the track's LANE_X spread.
  const oppLanes = useMemo(() => [-3.0, 0, 3.0], []);

  useFrame((_, rawDt) => {
    const engine = engineRef.current;
    if (!engine) return;
    const dt = Math.min(0.05, rawDt);
    const sf = engine.speedFactor;
    const isRunning = engine.state === "running";

    // ---- curve the world gently through bends ----
    const seg = Math.floor(engine.player.position / SEGMENT_LENGTH);
    const segs = engine.track.segments;
    let c = 0;
    for (let i = seg; i < seg + 26 && i < segs.length; i++) c += segs[i].curve;
    // curve is O(1..few); scale into a modest lateral drift
    const target = Math.max(-6, Math.min(6, c * 0.35));
    bendRef.current += (target - bendRef.current) * Math.min(1, dt * 2.2);
    if (worldRef.current) worldRef.current.position.x = bendRef.current;

    // ---- player body motion ----
    const targetRoll = isRunning
      ? (engine.nitroActive ? -0.03 : 0) - engine.shakeX * 0.0008
      : 0;
    rollRef.current += (targetRoll - rollRef.current) * Math.min(1, dt * 5);

    if (playerGroup.current) {
      if (isRunning) {
        playerGroup.current.position.y =
          0.02 + Math.abs(Math.sin(engine.time * 16)) * 0.006 * sf;
      }
      playerGroup.current.rotation.z = rollRef.current;
      if (isRunning && engine.stutter > 0) {
        playerGroup.current.position.x = (Math.random() - 0.5) * 0.06;
      } else if (isRunning) {
        playerGroup.current.position.x += (0 - playerGroup.current.position.x) * Math.min(1, dt * 8);
      }
    }

    // ---- chase camera: behind and above, looking down the road ----
    const camX = bendRef.current * 0.35;
    camera.position.x += (camX - camera.position.x) * Math.min(1, dt * 2.6);
    camera.position.y += (CAM_HEIGHT + sf * 0.15 - camera.position.y) * Math.min(1, dt * 2.4);
    camera.position.z = CAM_BACK;
    camera.lookAt(camera.position.x * 0.5, CAM_LOOK_Y, -CAM_LOOK_AHEAD);

    // ---- opponents: real 3D cars at their true road positions ----
    opponentBuilds.forEach((_, i) => {
      const g = oppGroups.current[i];
      const opp = engine.opponents[i];
      if (!g || !opp) return;
      // convert the track gap into metres along the road
      const relUnits = opp.position - engine.player.position;
      const relM = relUnits * METRES_PER_SEGMENT * 60;
      const visible = relM > -14 && relM < 210;
      g.visible = visible;
      if (!visible) return;
      g.position.set(oppLanes[i] ?? 0, 0.02, -relM - 1.5);
      g.scale.setScalar(Math.max(0.55, Math.min(1, 1.35 - relM / 260)));
    });
  });

  return (
    <group ref={worldRef}>
      <fog attach="fog" args={[env.fog, 40, 230]} />
      <color attach="background" args={[env.sky[0]]} />

      {/* lighting */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={[env.sky[2], env.ground[1], 0.6]} />
      <directionalLight
        position={[12, 26, 14]}
        intensity={2.2}
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowMap}
        shadow-mapSize-height={quality.shadowMap}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0015}
      />
      <directionalLight position={[-10, 8, -14]} intensity={0.5} color={env.horizonGlow} />

      {/* ground plane beyond the road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -120]}>
        <planeGeometry args={[600, 620]} />
        <meshStandardMaterial color={env.ground[0]} roughness={1} />
      </mesh>

      <Road engineRef={engineRef} env={env} quality={quality} />
      <Scenery env={env} quality={quality} />
      <SpeedStreaks engineRef={engineRef} env={env} quality={quality} />

      {/* the player's car — real model-specific geometry, facing away from camera */}
      {carsReady && <group ref={playerGroup} position={[0, 0.02, 0]}>
        <CarModel3D
          build={playerBuild}
          position={[0, 0, 0]}
          rotationY={Math.PI}
          inspectPart={null}
          float={false}
          braking={false}
        />
      </group>}

      {/* rivals — real model-specific geometry */}
      {carsReady && opponentBuilds.map((b, i) => (
        <group
          key={i}
          ref={(g) => {
            oppGroups.current[i] = g;
          }}
        >
          <CarModel3D
            build={b}
            position={[0, 0, 0]}
            rotationY={Math.PI}
            inspectPart={null}
            float={false}
            braking={false}
          />
        </group>
      ))}
    </group>
  );
}

/* --------------------------------------------------------------- exported */

export function RaceScene3D(props: RaceScene3DProps) {
  const quality = QUALITY[props.quality];
  return (
    <Canvas
      frameloop={props.quality === "low" ? "never" : "always"}
      shadows={quality.shadows}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      dpr={quality.dpr}
      camera={{ fov: 48, near: 0.3, far: 700, position: [0, CAM_HEIGHT, CAM_BACK] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      {props.quality === "low" && <FrameDriver fps={quality.fps} />}
      <World {...props} />
    </Canvas>
  );
}

function FrameDriver({ fps }: { fps: number }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const interval = 1000 / fps;
    const tick = (now: number) => {
      if (now - last >= interval) {
        last = now;
        invalidate();
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [fps, invalidate]);

  return null;
}
