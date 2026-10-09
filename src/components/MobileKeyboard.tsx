import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

interface Props {
  target: string;
  typed: string;
  running: boolean;
  onKey: (value: string) => void;
  onBackspace: () => void;
}

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function normalize(value: string) {
  return value.toLowerCase();
}

export function MobileKeyboard({ target, typed, running, onKey, onBackspace }: Props) {
  const next = normalize(target[typed.length] ?? "");
  const [pressed, setPressed] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

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

  const keyClass = (value: string) =>
    cn(
      "mobile-key touch-target compact-target select-none rounded-lg border font-display text-xs font-black uppercase tracking-wider text-slate-200",
      "transition-[transform,background-color,border-color,box-shadow] duration-100",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
      value.toLowerCase() === next && "mobile-key-next",
      pressed === value.toLowerCase() && feedback === "correct" && "mobile-key-correct",
      pressed === value.toLowerCase() && feedback === "wrong" && "mobile-key-wrong",
      !running && "cursor-not-allowed opacity-45",
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
        {ROWS.map((row, rowIndex) => (
          <div key={row} className={cn("flex justify-center gap-1", rowIndex === 1 && "px-[4.5%]", rowIndex === 2 && "px-[9%]")}>
            {Array.from(row).map((value) => (
              <button
                key={value}
                type="button"
                className={keyClass(value)}
                aria-label={`Type ${value}`}
                aria-pressed={value.toLowerCase() === next}
                disabled={!running}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  press(value);
                }}
              >
                {value}
              </button>
            ))}
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
          <button
            type="button"
            className={cn(keyClass(" "), "flex-1")}
            aria-label="Space"
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
          <div className="w-14" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

