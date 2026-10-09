import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { Garage } from "./components/Garage";
import { HighScores } from "./components/HighScores";
import { StartScreen } from "./components/StartScreen";
import { audio } from "./game/audio";
import { buildFromProfile } from "./game/cars";
import { loadProfile, loadScores, loadSettings, saveProfile, saveSettings, submitScore, type Settings } from "./game/storage";
import type { Profile, RaceConfig, RaceResult, ScoreEntry } from "./game/types";

import { QAComparisonView } from "./components/qa/QAComparisonView";

type Screen = "menu" | "garage" | "scores" | "race" | "qa";

export default function App() {
  const [profile, setProfileState] = useState<Profile>(() => loadProfile());
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [screen, setScreen] = useState<Screen>("menu");
  const [raceConfig, setRaceConfig] = useState<RaceConfig | null>(null);
  const [lastScoreId, setLastScoreId] = useState<string | undefined>();

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    audio.setMuted(settings.muted);
  }, [settings.muted]);

  const setProfile = useCallback((p: Profile) => {
    profileRef.current = p;
    setProfileState(p);
    saveProfile(p);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettingsState(next);
    saveSettings(next);
  }, []);

  const build = useMemo(() => buildFromProfile(profile), [profile]);

  const startRace = useCallback(() => {
    audio.init();
    const p = profileRef.current;
    const s = settingsRef.current;
    setRaceConfig({
      build: buildFromProfile(p),
      difficulty: s.difficulty,
      distance: s.distance,
      environment: s.environment,
      graphicsQuality: s.graphicsQuality,
      playerName: p.name || "ACE",
      seed: Math.floor(Math.random() * 1e9),
    });
    setScreen("race");
  }, []);

  const restartRace = useCallback(() => {
    audio.init();
    setRaceConfig((cfg) => (cfg ? { ...cfg, build: buildFromProfile(profileRef.current), seed: Math.floor(Math.random() * 1e9) } : cfg));
  }, []);

  const handleFinish = useCallback(
    (result: RaceResult): RaceResult => {
      const cfg = raceConfig;
      const p = profileRef.current;
      const entry: ScoreEntry = {
        id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        name: p.name || "ACE",
        score: result.score,
        wpm: result.wpm,
        accuracy: result.accuracy,
        place: result.dnf ? 0 : result.place,
        car: cfg?.build.def.id ?? p.selectedCar,
        difficulty: cfg?.difficulty ?? "rookie",
        distance: cfg?.distance ?? "circuit",
        date: Date.now(),
      };
      const rank = submitScore(entry);
      setScores(loadScores());
      setLastScoreId(entry.id);
      setProfile({
        ...p,
        credits: p.credits + result.credits,
        racesPlayed: p.racesPlayed + 1,
        bestWpm: Math.max(p.bestWpm, result.wpm),
      });
      return { ...result, rank, isHighScore: rank > 0 };
    },
    [raceConfig, setProfile],
  );

  const goMenu = useCallback(() => setScreen("menu"), []);
  const goGarage = useCallback(() => setScreen("garage"), []);
  const goScores = useCallback(() => setScreen("scores"), []);
  const goQA = useCallback(() => setScreen("qa"), []);
  const toggleMute = useCallback(() => updateSettings({ muted: !settingsRef.current.muted }), [updateSettings]);

  return (
    <div className="h-full w-full bg-void text-slate-100 font-ui">
      {screen === "menu" && (
        <StartScreen
          profile={profile}
          settings={settings}
          build={build}
          scores={scores}
          onSettings={updateSettings}
          onName={(name) => setProfile({ ...profileRef.current, name })}
          onStart={startRace}
          onGarage={goGarage}
          onScores={goScores}
          onQA={goQA}
        />
      )}
      {screen === "garage" && <Garage profile={profile} onProfile={setProfile} onBack={goMenu} onRace={startRace} onQA={goQA} />}
      {screen === "scores" && <HighScores scores={scores} onBack={goMenu} onChange={() => setScores(loadScores())} highlightId={lastScoreId} />}
      {screen === "qa" && (
        <QAComparisonView
          onBack={goMenu}
          onRaceCar={(carId) => {
            const nextProf = { ...profileRef.current, selectedCar: carId };
            setProfile(nextProf);
            setRaceConfig({
              build: buildFromProfile(nextProf),
              difficulty: settingsRef.current.difficulty,
              distance: settingsRef.current.distance,
              environment: settingsRef.current.environment,
              graphicsQuality: settingsRef.current.graphicsQuality,
              playerName: nextProf.name || "ACE",
              seed: Math.floor(Math.random() * 1e9),
            });
            setScreen("race");
          }}
        />
      )}
      {screen === "race" && raceConfig && (
        <GameScreen
          key={raceConfig.seed}
          config={raceConfig}
          muted={settings.muted}
          onToggleMute={toggleMute}
          onFinish={handleFinish}
          onRestart={restartRace}
          onGarage={goGarage}
          onExit={goMenu}
        />
      )}
    </div>
  );
}
