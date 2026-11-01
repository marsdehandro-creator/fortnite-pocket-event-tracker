import type { StatusTone } from "../utils/status";

export function ProgressBar({ value, tone, label }: { value: number; tone: StatusTone; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className={`progress progress--${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
