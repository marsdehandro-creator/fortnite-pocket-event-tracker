import { formatDuration, getCountdown } from "../utils/countdown";
import type { DateInput } from "../utils/time";

interface CountdownProps {
  target: DateInput;
  now: number;
  /** Accessible label, e.g. "Downtime begins in". */
  label: string;
  size?: "md" | "lg";
}

/** Segmented d/h/m or h/m/s countdown. Shows zeros once the target has passed. */
export function Countdown({ target, now, label, size = "md" }: CountdownProps) {
  const c = getCountdown(target, now);
  const parts: [number, string][] = c.isPast
    ? [
        [0, "h"],
        [0, "m"],
        [0, "s"],
      ]
    : c.days
      ? [
          [c.days, "d"],
          [c.hours, "h"],
          [c.minutes, "m"],
        ]
      : [
          [c.hours, "h"],
          [c.minutes, "m"],
          [c.seconds, "s"],
        ];

  return (
    <div className={`countdown countdown--${size}`} role="timer" aria-label={`${label} ${formatDuration(Math.max(0, c.totalMs), { maxUnits: 3, seconds: true })}`}>
      {parts.map(([value, unit]) => (
        <span className="countdown__unit" key={unit} aria-hidden="true">
          <span className="countdown__value">{String(value).padStart(2, "0")}</span>
          <span className="countdown__label">{unit}</span>
        </span>
      ))}
    </div>
  );
}
