import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

interface Props {
  target: string;
  typed: string;
  running: boolean;
  onKey: (value: string) => void;
  onBackspace: () => void;
}

const LETTER_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

// Punctuation and technical symbols the target text now actually contains.
// Quotes and slashes are separated so `'` and `"`, and `/` and `\`, are always
// reachable even when a phone's native keyboard hides them behind layouts.
const SYMBOL_ROWS: readonly (readonly string[])[] = [
  [".", ",", "?", "!", "'", '"'],
  [":", ";", "-", "_", "(", ")"],
  ["/", "\\", "[", "]", "@", "#"],
  ["=", "+", "$", "%", "&", "*"],
];

/** Normalize for display/next comparisons: letters fold case, punctuation stays exact. */
function normalize(value: string) {
  return /[A-Za-z]/.test(value) ? value.toLowerCase() : value;
}

/** Label shown on a key (space stays readable, everything else is literal). */
function keyLabel(value: string) {
  return value === " " ? "Space" : value;
}

export function MobileKeyboard({ target, typed, running, onKey, onBackspace }: Props) {
  const next = normalize(target[typed.length] ?? "");
  const [pressed, setPressed] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [symbolMode, setSymbolMode] = useState(false);

  useEffect(() => {
    if (!pressed) return;
    const timer = window.setTimeout(() => setPressed(null), 130);
    return () => window.clearTimeout(timer);
  }, [pressed]);

  const press = (value: string) => {
    if (!running) return;
    const normalized = normalize(value);
    setPressed(normalized);
    setFeedback(normalized === next ? "correct" : "wrong");
    onKey(value);
    window.setTimeout(() => setFeedback(null), 150);
  };

  const keyClass = (value: string) => {
    const key = normalize(value);
    return cn(
      "mobile-key touch-target compact-target select-none rounded-lg border font-display text-xs font-black tracking-wider text-slate-200",
      "transition-[transform,background-color,border-color,box-shadow] duration-100",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
      key === next && "mobile-key-next",
      pressed === key && feedback === "correct" && "mobile-key-correct",
      pressed === key && feedback === "wrong" && "mobile-key-wrong",
      !running && "cursor-not-allowed opacity-45",
    );
  };

  const renderKey = (value: string, key: string) => (
    <button
      key={key}
      type="button"
      className={cn(keyClass(value), value !== " " && "flex-1")}
      aria-label={`Type ${keyLabel(value)}`}
      aria-pressed={normalize(value) === next}
      disabled={!running}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        press(value);
      }}
    >
      {keyLabel(value)}
    </button>
  );

  return (
    <div
      className="mobile-keyboard mt-3 rounded-2xl border border-cyan-300/15 bg-[#05080e] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_-8px_30px_rgba(0,0,0,0.25)] sm:hidden"
      aria-label="Mobile racing keyboard"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="mb-2 flex items-center justify-between px-1 text-[9px] uppercase tracking-[0.25em] text-slate-500">
        <span>Racing input</span>
        <span className={cn(feedback === "correct" ? "text-cyan-300" : feedback === "wrong" ? "text-rose-300" : "text-slate-500")}>
          {running ? (next === " " ? "Space next" : next ? `Next · ${next}` : "Ready") : "Paused"}
        </span>
      </div>
      <div className="space-y-1.5">
        {symbolMode
          ? SYMBOL_ROWS.map((row, rowIndex) =>
              <div key={rowIndex} className="flex justify-center gap-1">{row.map((value) => renderKey(value, `${rowIndex}-${value}`))}</div>
            )
          : LETTER_ROWS.map((row, rowIndex) => (
              <div key={row} className={cn("flex justify-center gap-1", rowIndex === 1 && "px-[4.5%]", rowIndex === 2 && "px-[9%]")}>
                {Array.from(row).map((value) => renderKey(value, value))}
              </div>
            ))}
        <div className="flex gap-1">
          <button
            type="button"
            className="mobile-key touch-target compact-target w-14 rounded-lg border border-white/10 bg-white/[0.04] font-display text-[10px] font-black uppercase tracking-wider text-slate-300"
            aria-label="Backspace"
            disabled={!running || !typed.length}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!running || !typed.length) return;
              setPressed("backspace");
              onBackspace();
            }}
          >
            ⌫
          </button>
          {symbolMode ? (
            <button
              type="button"
              className={cn(keyClass(" "), "flex-1")}
              aria-label="Type Space"
              aria-pressed={next === " "}
              disabled={!running}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                press(" ");
              }}
            >
              Space
            </button>
          ) : null}
          <button
            type="button"
            className="mobile-key touch-target compact-target w-14 rounded-lg border border-cyan-300/30 bg-cyan-400/10 font-display text-[10px] font-black uppercase tracking-wider text-cyan-200"
            aria-label={symbolMode ? "Show letters" : "Show symbols"}
            aria-pressed={symbolMode}
            disabled={!running}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSymbolMode((prev) => !prev);
            }}
          >
            {symbolMode ? "abc" : "#+="}
          </button>
        </div>
      </div>
    </div>
  );
}

