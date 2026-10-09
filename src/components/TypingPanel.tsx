import { cn } from "@/utils/cn";

interface TypingPanelProps {
  target: string;
  typed: string;
  next: string;
  combo: number;
  multiplier: number;
  nitro: number;
  nitroActive: boolean;
  shakeKey: number;
  isTouch: boolean;
  inputFocused: boolean;
  running: boolean;
  onNitro: () => void;
  onFocusRequest: () => void;
}

export function TypingPanel({
  target,
  typed,
  next,
  combo,
  multiplier,
  nitro,
  nitroActive,
  shakeKey,
  isTouch,
  inputFocused,
  running,
  onNitro,
  onFocusRequest,
}: TypingPanelProps) {
  const characters = Array.from(target);
  const progress = characters.length
    ? Math.min(100, (typed.length / characters.length) * 100)
    : 0;

  return (
    <section
      className="relative z-20 w-full shrink-0 border-t border-white/10 bg-[#080b12]/95 px-4 py-4 sm:px-8 sm:py-5"
      onPointerDown={onFocusRequest}
      aria-label="Race typing panel"
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-400">
              COMBO{" "}
              <strong className="text-cyan-300">{combo}</strong>
            </span>

            <span className="text-slate-400">
              MULTIPLIER{" "}
              <strong className="text-white">
                x{multiplier.toFixed(1)}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNitro();
            }}
            disabled={!running || nitro < 100 || nitroActive}
            className={cn(
              "rounded-lg border px-4 py-2 text-xs font-black tracking-widest transition",
              nitroActive
                ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                : "border-cyan-400/40 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20",
              (!running || nitro < 100 || nitroActive) &&
                "cursor-not-allowed opacity-40"
            )}
          >
            {nitroActive ? "NITRO ACTIVE" : "NITRO · ENTER"}
          </button>
        </div>

        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-400 transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          key={shakeKey}
          className={cn(
            "rounded-xl border p-4 transition-colors sm:p-5",
            inputFocused
              ? "border-cyan-400/40 bg-cyan-400/[0.04]"
              : "border-white/10 bg-white/[0.02]",
            shakeKey > 0 && "animate-[shake_180ms_ease-in-out]"
          )}
          onClick={onFocusRequest}
        >
          <div
            className="break-words font-mono text-base leading-relaxed tracking-wide sm:text-xl md:text-2xl"
            aria-label="Current sentence"
          >
            {characters.map((character, index) => {
              const entered = index < typed.length;
              // Case-insensitive to match the engine: sentence prose is capitalised
              // but a physical keyboard emits lowercase unless Shift is held.
              const correct =
                typed[index] !== undefined &&
                typed[index].toLowerCase() === character.toLowerCase();
              const current = index === typed.length;

              return (
                <span
                  key={`${index}-${character}`}
                  className={cn(
                    "relative",
                    entered && correct && "text-emerald-300",
                    entered && !correct && "text-rose-400",
                    !entered && current && "text-white",
                    !entered && !current && "text-slate-500"
                  )}
                >
                  {character === " " ? "\u00A0" : character}
                  {current && (
                    <span
                      className="absolute -right-px top-0 h-full w-0.5 animate-pulse bg-cyan-300"
                      aria-hidden="true"
                    />
                  )}
                </span>
              );
            })}
          </div>

          {next && (
            <div className="mt-3 truncate border-t border-white/5 pt-3 text-xs text-slate-500 sm:text-sm">
              NEXT: <span className="text-slate-400">{next}</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-widest text-slate-500 sm:text-xs">
          <span>
            {isTouch
              ? "Tap the sentence to type"
              : "Type to accelerate"}
          </span>

          <span className="flex items-center gap-2">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                inputFocused ? "bg-emerald-400" : "bg-slate-600"
              )}
            />
            {inputFocused ? "Input ready" : "Click to focus"}
          </span>
        </div>

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-[width] duration-150"
            style={{
              width: `${Math.max(0, Math.min(100, nitro))}%`,
            }}
          />
        </div>
      </div>
    </section>
  );
}

export default TypingPanel;