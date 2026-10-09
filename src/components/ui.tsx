import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";
import { audio } from "@/game/audio";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "nitro";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-cyan-300 to-cyan-500 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.45),inset_0_1px_0_rgba(255,255,255,0.5)] hover:shadow-[0_0_36px_rgba(34,211,238,0.7)]",
  secondary:
    "bg-white/[0.06] text-slate-100 border border-white/10 hover:bg-white/[0.12] hover:border-cyan-300/40",
  ghost: "bg-transparent text-slate-300 hover:text-white hover:bg-white/[0.06]",
  danger: "bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[0_0_24px_rgba(244,63,94,0.4)]",
  nitro: "bg-gradient-to-b from-amber-300 to-orange-500 text-slate-950 shadow-[0_0_28px_rgba(251,191,36,0.55)]",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[11px]",
  md: "px-5 py-2.5 text-xs sm:text-sm",
  lg: "px-8 py-4 text-sm sm:text-base",
};

const ICON_SIZES: Record<Size, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
      />
    </svg>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: boolean;
  fullWidth?: boolean;
  silent?: boolean;
  tooltip?: string;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  onClick,
  loading,
  icon,
  fullWidth,
  silent,
  tooltip,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      disabled={isDisabled}
      title={tooltip}
      aria-label={icon && typeof children !== "string" ? tooltip : undefined}
      aria-busy={loading}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault();
          return;
        }
        if (!silent) audio.play("click");
        onClick?.(e);
      }}
      className={cn(
        "btn-neon inline-flex items-center justify-center gap-2 rounded-xl font-display font-bold uppercase tracking-[0.14em] select-none transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        SIZES[size],
        VARIANTS[variant],
        icon && "aspect-square p-0",
        fullWidth && "w-full",
        isDisabled &&
          "opacity-50 pointer-events-none saturate-50 brightness-75 shadow-none",
        className,
      )}
    >
      {loading && (
        <Spinner
          className={cn(ICON_SIZES[size], icon ? "" : "mr-0.5")}
        />
      )}
      {!loading && children}
    </button>
  );
}

export function Panel({
  className,
  children,
  hover,
  glow,
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass rounded-2xl transition-all duration-300",
        hover && "hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]",
        glow && "shadow-[0_0_24px_-8px_rgba(34,211,238,0.45)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Kbd({ children, size = "md", className }: { children: ReactNode; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes: Record<string, string> = {
    sm: "min-w-[1.4em] px-1 py-0.5 text-[9px]",
    md: "min-w-[1.6em] px-1.5 py-0.5 text-[10px]",
    lg: "min-w-[2em] px-2 py-1 text-xs",
  };
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-white/10 border border-white/15 border-b-2 border-b-white/25 font-mono text-slate-200 leading-none",
        sizes[size],
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Label({
  children,
  className,
  hint,
}: {
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="text-[10px] sm:text-[11px] font-display uppercase tracking-[0.3em] text-cyan-300/70">
        {children}
      </div>
      {hint && (
        <div className="text-[10px] sm:text-[11px] text-slate-400 font-ui leading-tight normal-case tracking-normal">
          {hint}
        </div>
      )}
    </div>
  );
}

export function StatBar({
  label,
  value,
  max = 1.3,
  color = "bg-cyan-400",
  showValue = true,
  size = "md",
  icon,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const heights: Record<string, string> = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };
  const textSizes: Record<string, string> = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };
  return (
    <div className={cn("flex items-center gap-3", textSizes[size])}>
      <span className="flex w-14 items-center gap-1.5 text-slate-400 uppercase tracking-wider font-ui font-semibold">
        {icon}
        {label}
      </span>
      <div className={cn("flex-1 rounded-full bg-white/10 overflow-hidden", heights[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue && (
        <span className="w-8 text-right font-mono text-slate-300">
          {value.toFixed(2)}
        </span>
      )}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const currentIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const selectByIndex = (index: number) => {
    const clamped = (index + options.length) % options.length;
    const next = options[clamped];
    if (next && next.value !== value) {
      audio.play("click");
      onChange(next.value);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      selectByIndex(currentIndex + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      selectByIndex(currentIndex - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectByIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      selectByIndex(options.length - 1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Segmented control"
      className={cn("grid gap-1.5 p-1 rounded-xl bg-black/30 border border-white/10", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            onClick={() => {
              audio.play("click");
              onChange(o.value);
            }}
            className={cn(
              "group relative rounded-lg px-2 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
              active
                ? "bg-gradient-to-b from-cyan-400/25 to-cyan-500/10 border border-cyan-300/50 shadow-[0_0_14px_rgba(34,211,238,0.25)]"
                : "border border-transparent hover:bg-white/[0.05]",
            )}
          >
            <div
              className={cn(
                "font-display text-[11px] sm:text-xs font-bold uppercase tracking-wider",
                active ? "text-cyan-200" : "text-slate-300 group-focus-visible:text-cyan-200",
              )}
            >
              {o.label}
            </div>
            {o.hint && (
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-ui leading-tight">
                {o.hint}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
