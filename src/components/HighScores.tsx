import { useState } from "react";
import { getCar } from "@/game/cars";
import { DIFFICULTY_LABEL } from "@/game/engine";
import { clearScores } from "@/game/storage";
import { DISTANCE_LABEL } from "@/game/track";
import type { ScoreEntry } from "@/game/types";
import { cn } from "@/utils/cn";
import { Button } from "./ui";

const PLACE = ["1st", "2nd", "3rd", "4th"];

export function HighScores({ scores, onBack, onChange, highlightId }: { scores: ScoreEntry[]; onBack: () => void; onChange: () => void; highlightId?: string }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="relative h-full w-full bg-void overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.1),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(34,211,238,0.12),transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 grid-floor opacity-50 pointer-events-none" />
      <div className="relative h-full overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto px-3 py-3 sm:px-8 sm:py-6 min-h-full flex flex-col" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack}>
                ← Menu
              </Button>
              <div>
                <div className="text-[10px] font-display uppercase tracking-[0.4em] text-amber-200/70">Local leaderboard</div>
                <h1 className="font-display font-black text-xl sm:text-3xl text-white leading-none">🏆 High scores</h1>
              </div>
            </div>
            {scores.length > 0 && (
              <div className="flex items-center gap-2">
                {confirm ? (
                  <>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        clearScores();
                        setConfirm(false);
                        onChange();
                      }}
                    >
                      Confirm clear
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
                    Clear
                  </Button>
                )}
              </div>
            )}
          </header>

          <div className="glass rounded-3xl mt-4 sm:mt-6 overflow-hidden animate-slide-up">
            {scores.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-5xl mb-3">🏁</div>
                <div className="font-display font-bold text-lg text-white">No races yet</div>
                <div className="text-sm text-slate-400 font-ui mt-1">Finish a race to claim the top spot.</div>
                <Button variant="primary" className="mt-5" onClick={onBack}>
                  Back to menu
                </Button>
              </div>
            ) : (
              <table className="w-full text-left text-sm font-ui">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.25em] text-slate-400 border-b border-white/10">
                    <th className="px-3 sm:px-5 py-3 font-display">#</th>
                    <th className="px-2 py-3 font-display">Driver</th>
                    <th className="px-2 py-3 font-display text-right">Score</th>
                    <th className="px-2 py-3 font-display text-right">WPM</th>
                    <th className="px-2 py-3 font-display text-right hidden sm:table-cell">Acc</th>
                    <th className="px-2 py-3 font-display text-right">Place</th>
                    <th className="px-2 sm:px-5 py-3 font-display hidden md:table-cell">Race</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s, i) => (
                    <tr key={s.id} className={cn("border-b border-white/5 transition-colors", s.id === highlightId ? "bg-fuchsia-500/15" : i % 2 ? "bg-white/[0.02]" : "", i === 0 && "text-amber-200")}>
                      <td className="px-3 sm:px-5 py-3 font-display font-black text-base sm:text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                      <td className="px-2 py-3">
                        <div className="font-bold text-white tracking-wider">{s.name}</div>
                        <div className="text-[10px] text-slate-500">{getCar(s.car).name} · {new Date(s.date).toLocaleDateString()}</div>
                      </td>
                      <td className="px-2 py-3 text-right font-display font-bold tabular-nums">{s.score.toLocaleString()}</td>
                      <td className="px-2 py-3 text-right font-mono text-cyan-200 tabular-nums">{s.wpm}</td>
                      <td className="px-2 py-3 text-right font-mono tabular-nums hidden sm:table-cell">{s.accuracy}%</td>
                      <td className={cn("px-2 py-3 text-right font-bold", s.place === 1 ? "text-amber-300" : "text-slate-300")}>{s.place === 0 ? "DNF" : PLACE[s.place - 1]}</td>
                      <td className="px-2 sm:px-5 py-3 text-slate-400 text-xs hidden md:table-cell">
                        {DIFFICULTY_LABEL[s.difficulty]} · {DISTANCE_LABEL[s.distance]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
