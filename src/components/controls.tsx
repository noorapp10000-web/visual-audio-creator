import { useEffect, useRef, type ReactNode } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-panel p-4 shadow-soft">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** Press-and-hold repeater for the +/- buttons. */
function useHold(action: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const fn = useRef(action);
  fn.current = action;

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    if (interval.current) clearInterval(interval.current);
    timer.current = null;
    interval.current = null;
  };
  useEffect(() => stop, []);

  const start = () => {
    fn.current();
    timer.current = setTimeout(() => {
      interval.current = setInterval(() => fn.current(), 70);
    }, 420);
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      start();
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  };
}

function StepBtn({ children, disabled, onStep, label }: { children: ReactNode; disabled?: boolean; onStep: () => void; label: string }) {
  const hold = useHold(onStep);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      {...hold}
      className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-elevated text-foreground transition-colors hover:border-primary/60 hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/**
 * Numeric control: minus / value / plus (no drag bars).
 */
export function Num({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
  defaultValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
  defaultValue?: number;
}) {
  const decimals = step < 1 ? String(step).split(".")[1]?.length ?? 2 : 0;
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(decimals + 2))));
  const shown = value.toFixed(decimals);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        {defaultValue !== undefined && value !== defaultValue && (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
            aria-label={`إعادة ${label} للوضع الأصلي`}
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <StepBtn label={`إنقاص ${label}`} disabled={value <= min} onStep={() => onChange(clamp(value - step))}>
          <Minus className="size-4" />
        </StepBtn>
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-background/70">
          <div className="absolute inset-y-0 start-0 bg-primary/15" style={{ width: `${pct}%` }} aria-hidden />
          <div className="relative flex h-9 items-center justify-center gap-1 text-sm font-medium tabular-nums">
            {shown}
            {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
          </div>
        </div>
        <StepBtn label={`زيادة ${label}`} disabled={value >= max} onStep={() => onChange(clamp(value + step))}>
          <Plus className="size-4" />
        </StepBtn>
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <Label className="text-[13px] font-normal text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function Text({
  label,
  value,
  onChange,
  rtl,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rtl?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-normal text-muted-foreground">{label}</Label>
      {multiline ? (
        <textarea
          dir={rtl ? "rtl" : "ltr"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={cn(
            "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40",
            rtl && "font-arabic text-right text-base leading-loose",
          )}
        />
      ) : (
        <Input dir={rtl ? "rtl" : "ltr"} value={value} onChange={(e) => onChange(e.target.value)} className={cn(rtl && "font-arabic text-right")} />
      )}
    </div>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[] | { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-normal text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = value.startsWith("#") ? value.slice(0, 7) : "#ffffff";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
        aria-label={label}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-muted-foreground">{label}</div>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 px-2 text-[12px]" />
      </div>
    </div>
  );
}

export function Upload({
  label,
  accept,
  onFile,
  hint,
}: {
  label: string;
  accept: string;
  onFile: (f: File) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-background/60 px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-elevated">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}
