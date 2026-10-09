import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { audio } from "@/game/audio";
import { GameEngine, type RaceState } from "@/game/engine";
import { RIVALS, defaultCustomization } from "@/game/cars";
import { envFor } from "@/game/environments";
import type { CarBuild, GameEvent, RaceConfig, RaceResult } from "@/game/types";
import { useIsTouch, useVisualViewportHeight } from "@/hooks";
import { cn } from "@/utils/cn";

import { HUD, type HudState } from "./HUD";
import { RaceScene3D } from "./RaceScene3D";
import { ResultsOverlay } from "./ResultsOverlay";
import TypingPanel from "./TypingPanel";
import { Button, Kbd } from "./ui";

interface Props {
  config: RaceConfig;
  muted: boolean;
  onToggleMute: () => void;
  onFinish: (result: RaceResult) => RaceResult;
  onRestart: () => void;
  onGarage: () => void;
  onExit: () => void;
}

interface TypingState {
  target: string;
  typed: string;
  next: string;
  combo: number;
  multiplier: number;
  nitro: number;
  nitroActive: boolean;
}

const EMPTY_HUD: HudState = {
  mph: 0,
  wpm: 0,
  instWpm: 0,
  accuracy: 100,
  score: 0,
  place: 1,
  progress: 0,
  rivals: [],
  timeLeft: 0,
  state: "countdown",
  nitroActive: false,
};

const EMPTY_TYPING: TypingState = {
  target: "",
  typed: "",
  next: "",
  combo: 0,
  multiplier: 1,
  nitro: 0,
  nitroActive: false,
};

const HUD_INTERVAL_MS = 100;
const MAX_FRAME_DELTA = 0.05;

/**
 * Avoid React updates when displayed HUD values have not materially changed.
 */
function sameHud(a: HudState, b: HudState): boolean {
  if (
    a.mph !== b.mph ||
    a.wpm !== b.wpm ||
    a.instWpm !== b.instWpm ||
    a.accuracy !== b.accuracy ||
    a.score !== b.score ||
    a.place !== b.place ||
    a.progress !== b.progress ||
    a.timeLeft !== b.timeLeft ||
    a.state !== b.state ||
    a.nitroActive !== b.nitroActive ||
    a.rivals.length !== b.rivals.length
  ) {
    return false;
  }

  return a.rivals.every((rival, index) => {
    const previous = b.rivals[index];

    return (
      rival.progress === previous.progress &&
      rival.color === previous.color &&
      rival.name === previous.name
    );
  });
}

export function GameScreen({
  config,
  muted,
  onToggleMute,
  onFinish,
  onRestart,
  onGarage,
  onExit,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const engineRef = useRef<GameEngine | null>(null);

  const isTouch = useIsTouch();
  const vvHeight = useVisualViewportHeight();

  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [typing, setTyping] = useState<TypingState>(EMPTY_TYPING);

  const [shakeKey, setShakeKey] = useState(0);
  const [gameState, setGameState] = useState<RaceState>("countdown");
  const [countLabel, setCountLabel] = useState("3");
  const [showCount, setShowCount] = useState(true);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  // The 3D scene is mounted once the countdown ends — see the comment at the
  // render site.  Mounting the four car models during the countdown starves
  // the rAF loop that advances the simulation.
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneLoading, setSceneLoading] = useState(false);

  // Always use the latest callbacks without rebuilding the game loop.
  const callbacks = useRef({
    onFinish,
    onRestart,
    onGarage,
    onExit,
    onToggleMute,
  });

  callbacks.current = {
    onFinish,
    onRestart,
    onGarage,
    onExit,
    onToggleMute,
  };

  /**
   * Keep a single authoritative game engine and use refs for keyboard input.
   */
  const focusInput = useCallback(() => {
    const input = inputRef.current;

    if (!input) return;

    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
  }, []);

  const syncInput = useCallback(() => {
    const engine = engineRef.current;
    const input = inputRef.current;

    if (engine && input && input.value !== engine.typed) {
      input.value = engine.typed;
    }
  }, []);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    let disposed = false;
    let raf = 0;

    let finishTimer: number | undefined;
    let goTimer: number | undefined;

    let finishHandled = false;
    let lastHudTime = 0;
    let lastTypingSignature = "";
    let lastState: RaceState | null = null;

    let latestHud: HudState = EMPTY_HUD;

    // Create the simulation once for this race configuration.  The 3D scene
    // reads from this engine; it never advances it.
    const engine = new GameEngine(config);

    engineRef.current = engine;

    // Reset transient UI if a different race configuration is supplied.
    setHud(EMPTY_HUD);
    setTyping(EMPTY_TYPING);
    setShakeKey(0);
    setGameState(engine.state);
    setCountLabel("3");
    setShowCount(true);
    setResult(null);
    setSceneReady(false);
    setSceneLoading(false);

    audio.init();

    if (!isTouch) {
      focusInput();
    }

    const handleEvent = (event: GameEvent) => {
      if (disposed) return;

      switch (event.type) {
        case "key":
          audio.play("key");
          break;

        case "error":
          audio.play("error");
          setShakeKey((value) => value + 1);
          break;

        case "word":
          audio.play("word");
          break;

        case "sentence":
          audio.play("sentence");
          break;

        case "perfect":
          audio.play("perfect");
          break;

        case "nitro":
          audio.play("nitro");
          break;

        case "nitroReady":
          audio.play("nitroReady");
          break;

        case "combo":
          audio.play(
            event.value === -1 ? "denied" : "combo",
            event.value ?? 0
          );
          break;

        case "countdown":
          audio.play("countdown");
          setCountLabel(String(event.value));
          break;

        case "go":
          audio.play("go");
          setCountLabel("GO!");

          if (goTimer !== undefined) {
            window.clearTimeout(goTimer);
          }

          goTimer = window.setTimeout(() => {
            if (!disposed) setShowCount(false);
          }, 750);
          break;

        case "overtake":
          audio.play("overtake");
          break;

        case "overtaken":
          audio.play("overtaken");
          break;

        case "finish":
        case "dnf": {
          // Guard against duplicate result timers.
          if (finishHandled) break;
          finishHandled = true;

          audio.play(event.type);
          audio.stopEngine();
          inputRef.current?.blur();

          finishTimer = window.setTimeout(() => {
            if (disposed) return;

            if (engine.result) {
              setResult(callbacks.current.onFinish(engine.result));
            }
          }, 1300);

          break;
        }
      }
    };

    /**
     * The race simulation runs independently of keyboard events.
     *
     * Typing updates the engine's input state. This loop advances physics,
     * rendering, audio state and HUD values independently.
     */
    const frame = (now: number) => {
      if (disposed) return;

      raf = window.requestAnimationFrame(frame);

      const delta = Math.min(
        MAX_FRAME_DELTA,
        Math.max(0, (now - (frame.lastTime ?? now)) / 1000)
      );

      frame.lastTime = now;

      if (engine.state !== "finished") {
        engine.update(delta);
      }

      // The 3D scene renders itself from engine state via its own useFrame.
      // We deliberately do NOT advance the simulation there, so the engine
      // remains the single authoritative update loop.

      // Process events after the simulation has advanced.
      const events = engine.drainEvents();

      for (let i = 0; i < events.length; i++) {
        handleEvent(events[i]);
      }

      // Do not send engine updates after the finish handler stops the audio.
      if (engine.state !== "finished") {
        audio.setEngine(
          engine.speedFactor,
          engine.nitroActive,
          engine.state !== "running"
        );
      }

      // Update typing UI only when its actual content changes.
      const typingSignature = [
        engine.typingVersion,
        engine.target,
        engine.typed,
        engine.nextSentence,
        engine.combo,
        engine.multiplier,
        Math.floor(engine.nitroMeter),
        engine.nitroActive,
      ].join("\u001f");

      if (typingSignature !== lastTypingSignature) {
        lastTypingSignature = typingSignature;

        setTyping({
          target: engine.target,
          typed: engine.typed,
          next: engine.nextSentence,
          combo: engine.combo,
          multiplier: engine.multiplier,
          nitro: engine.nitroMeter,
          nitroActive: engine.nitroActive,
        });
      }

      // Update the HUD at a limited cadence, not on every animation frame.
      if (now - lastHudTime >= HUD_INTERVAL_MS) {
        lastHudTime = now;

        const nextHud: HudState = {
          mph: Math.round(engine.mph),
          wpm: Math.round(engine.getWpm() * 10) / 10,
          instWpm: Math.round(engine.getInstWpm() * 10) / 10,
          accuracy: Math.round(engine.getAccuracy() * 10) / 10,
          score: engine.score,
          place: engine.place,
          progress: Math.round(engine.progress * 10000) / 10000,
          rivals: engine.opponents.map((opponent, index) => ({
            progress:
              Math.round(engine.opponentProgress(index) * 10000) / 10000,
            color: opponent.carOpts.paint,
            name: opponent.name,
          })),
          timeLeft: Math.round(engine.timeLeft * 10) / 10,
          state: engine.state,
          nitroActive: engine.nitroActive,
        };

        if (!sameHud(nextHud, latestHud)) {
          latestHud = nextHud;
          setHud(nextHud);
        }
      }

      // Avoid unnecessary UI updates when the race state is unchanged.
      if (engine.state !== lastState) {
        lastState = engine.state;
        setGameState(engine.state);

        // Mount the 3D world as soon as the race leaves the countdown.
        if (engine.state === "running") setSceneReady(true);
        if (engine.state === "running") setSceneLoading(true);
      }
    };

    // Initialize timing so the first delta is zero rather than a large jump.
    frame.lastTime = performance.now();

    raf = window.requestAnimationFrame(frame);

    const onKeyDown = (event: KeyboardEvent) => {
      const currentEngine = engineRef.current;

      if (!currentEngine || disposed) return;

      if (event.key === "Escape") {
        event.preventDefault();

        if (currentEngine.state !== "finished") {
          currentEngine.togglePause();

          if (
            currentEngine.state === "running" ||
            currentEngine.state === "countdown"
          ) {
            focusInput();
          } else {
            inputRef.current?.blur();
          }
        }

        return;
      }

      if (currentEngine.state === "finished") {
        if (
          event.key === "Enter" ||
          event.key.toLowerCase() === "r"
        ) {
          event.preventDefault();
          callbacks.current.onRestart();
        }

        return;
      }

      if (currentEngine.state === "paused") {
        if (event.key === "Enter") {
          event.preventDefault();
          currentEngine.resume();
          focusInput();
        }

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        currentEngine.fireNitro();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();

        currentEngine.backspace(
          event.ctrlKey || event.altKey || event.metaKey
        );

        syncInput();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key.length === 1) {
        event.preventDefault();
        currentEngine.typeChar(event.key);
        syncInput();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden && engine.state === "running") {
        engine.pause();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;

      window.cancelAnimationFrame(raf);

      if (finishTimer !== undefined) {
        window.clearTimeout(finishTimer);
      }

      if (goTimer !== undefined) {
        window.clearTimeout(goTimer);
      }

      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );

      audio.stopEngine();

      engineRef.current = null;
    };
  }, [config, isTouch, focusInput, syncInput]);

  const onInput = useCallback(() => {
    const engine = engineRef.current;
    const input = inputRef.current;

    if (!engine || !input) return;

    // Supports mobile keyboards and other text-input methods.
    engine.syncFromInput(input.value);
    syncInput();
  }, [syncInput]);

  const handlePause = useCallback(() => {
    const engine = engineRef.current;

    if (!engine || engine.state === "finished") return;

    engine.togglePause();

    if (engine.state !== "paused") {
      focusInput();
    } else {
      inputRef.current?.blur();
    }
  }, [focusInput]);

  const handleResume = useCallback(() => {
    engineRef.current?.resume();
    focusInput();
  }, [focusInput]);

  const handleNitro = useCallback(() => {
    engineRef.current?.fireNitro();
    focusInput();
  }, [focusInput]);

  const handleSceneReady = useCallback(() => {
    setSceneLoading(false);
  }, []);

  const playerColor = config.build.custom.paint;
  const paused = gameState === "paused";

  // Environment palette for the 3D scene (derived from the race config).
  const engineEnv = useMemo(
    () => envFor(config.environment),
    [config.environment],
  );

  // Opponent builds for the 3D scene.  Rivals share the player's upgrade level
  // so their geometry matches what the garage would show for that model; their
  // paint comes from the engine's own rival equipment so the HUD dots and the
  // 3D cars always agree.
  const opponentBuilds = useMemo<CarBuild[]>(() => {
    const rivalDefs = RIVALS.filter((r) => r.def.id !== config.build.def.id).slice(0, 3);
    return rivalDefs.map((r) => ({
      def: r.def,
      custom: {
        ...defaultCustomization(r.def),
        paint: r.paint,
      },
      upgrades: { ...config.build.upgrades },
      plate: r.name.toUpperCase().slice(0, 7),
    }));
  }, [config.build.def.id, config.build.upgrades]);

  return (
    <div
      className="relative flex w-full flex-col overflow-hidden select-none bg-void"
      style={{
        height: vvHeight ? `${vvHeight}px` : "100%",
      }}
    >
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 overflow-hidden"
        onPointerDown={focusInput}
      >
        {/* Real 3D racing scene.  Reads engine state each frame; the engine
            update loop stays in the effect above (single authoritative loop).

            The scene is mounted only once the countdown has finished.  Building
            four full car models is heavy synchronous work, and mounting it while
            the countdown is ticking starves the rAF loop that advances the race
            (observed: the countdown froze at "3" for 25s).  Deferring keeps the
            countdown and the typing panel responsive while the geometry builds. */}
        <div
          className={cn(
            "absolute inset-0 transition-[filter] duration-300",
            paused && "blur-sm brightness-50",
          )}
        >
          {sceneReady && (
            <RaceScene3D
              engineRef={engineRef}
              playerBuild={config.build}
              env={engineEnv}
              opponentBuilds={opponentBuilds}
              quality={config.graphicsQuality ?? "low"}
              onReady={handleSceneReady}
            />
          )}
        </div>

        {sceneLoading && sceneReady && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-cyan-300/30 bg-slate-950/70 px-4 py-2 font-display text-[10px] uppercase tracking-[0.25em] text-cyan-100/80">
              Preparing race scene
            </div>
          </div>
        )}

        <HUD
          hud={hud}
          playerColor={playerColor}
          muted={muted}
          onPause={handlePause}
          onMute={() => callbacks.current.onToggleMute()}
        />

        {showCount && !paused && gameState !== "finished" && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div
              key={countLabel}
              className={cn(
                "animate-countdown font-display text-[88px] font-black leading-none sm:text-[140px]",
                countLabel === "GO!"
                  ? "text-emerald-300 drop-shadow-[0_0_40px_rgba(74,222,128,0.8)]"
                  : "text-white drop-shadow-[0_0_30px_rgba(34,211,238,0.8)]"
              )}
            >
              {countLabel}
            </div>

            {countLabel !== "GO!" && (
              <div className="mt-2 font-ui text-sm uppercase tracking-[0.3em] text-cyan-100/80 sm:text-base">
                Type the sentence to accelerate
              </div>
            )}
          </div>
        )}

        {paused && (
          <div className="absolute inset-0 flex animate-fade-in items-center justify-center p-4">
            <div className="glass w-full max-w-sm animate-slide-up rounded-3xl p-6 text-center sm:p-8">
              <div className="font-display text-[10px] uppercase tracking-[0.4em] text-cyan-300/70">
                Race paused
              </div>

              <h2 className="mt-1 font-display text-3xl font-black text-white sm:text-4xl">
                PAUSED
              </h2>

              <div className="mt-2 font-ui text-xs text-slate-400">
                {Math.round(hud.wpm)} WPM ·{" "}
                {hud.accuracy.toFixed(0)}% accuracy ·{" "}
                {hud.score.toLocaleString()} pts
              </div>

              <div className="mt-6 grid gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleResume}
                >
                  Resume {!isTouch && <Kbd>↵</Kbd>}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => callbacks.current.onRestart()}
                >
                  Restart race
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => callbacks.current.onExit()}
                >
                  Quit to menu
                </Button>
              </div>

              {!isTouch && (
                <div className="mt-5 flex flex-wrap justify-center gap-x-3 gap-y-1 font-ui text-[11px] text-slate-500">
                  <span>
                    <Kbd>Esc</Kbd> pause
                  </span>
                  <span>
                    <Kbd>Enter</Kbd> nitro
                  </span>
                  <span>
                    <Kbd>Ctrl</Kbd>+<Kbd>⌫</Kbd> delete word
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {gameState === "finished" && result && (
          <ResultsOverlay
            result={result}
            carName={config.build.def.name}
            isTouch={isTouch}
            onRestart={() => callbacks.current.onRestart()}
            onGarage={() => callbacks.current.onGarage()}
            onExit={() => callbacks.current.onExit()}
          />
        )}
      </div>

      {gameState !== "finished" && (
        <TypingPanel
          target={typing.target}
          typed={typing.typed}
          next={typing.next}
          combo={typing.combo}
          multiplier={typing.multiplier}
          nitro={typing.nitro}
          nitroActive={typing.nitroActive}
          shakeKey={shakeKey}
          isTouch={isTouch}
          inputFocused={inputFocused}
          running={
            gameState === "running" || gameState === "countdown"
          }
          onNitro={handleNitro}
          onFocusRequest={focusInput}
        />
      )}

      <input
        ref={inputRef}
        className="hidden-input"
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="go"
        aria-label="Typing input"
        onInput={onInput}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
      />
    </div>
  );
}