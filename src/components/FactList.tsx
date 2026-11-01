import type { ReactNode } from "react";

export interface Fact {
  label: string;
  value: ReactNode;
  /** Visually de-emphasise values that aren't published yet. */
  muted?: boolean;
}

/** Label/value grid used inside cards. */
export function FactList({ facts, className = "" }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={`facts ${className}`}>
      {facts.map((f) => (
        <div className="facts__item" key={f.label}>
          <dt>{f.label}</dt>
          <dd className={f.muted ? "is-muted" : undefined}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
