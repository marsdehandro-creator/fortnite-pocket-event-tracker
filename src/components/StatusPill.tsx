import type { StatusTone } from "../utils/status";

interface StatusPillProps {
  tone: StatusTone;
  label: string;
  /** Animate the dot — reserve for things happening right now. */
  pulse?: boolean;
  size?: "sm" | "md";
}

export function StatusPill({ tone, label, pulse = false, size = "sm" }: StatusPillProps) {
  return (
    <span className={`pill pill--${tone} pill--${size}`}>
      <span className={`dot dot--${tone}${pulse ? " dot--pulse" : ""}`} aria-hidden="true" />
      {label}
    </span>
  );
}
