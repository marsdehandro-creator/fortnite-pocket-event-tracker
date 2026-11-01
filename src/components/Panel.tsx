import { useEffect, type ReactNode } from "react";
import { ArrowRight } from "./Icons";

export type FocusKind = "update" | "event" | "poi" | "discovery" | "change";

/** A request (from search or a hero card) to reveal and open one record. `n` makes repeat requests distinct. */
export interface FocusRequest {
  kind: FocusKind;
  id: string;
  n: number;
}

/**
 * Lets a panel react to a focus request: `reveal` should make the record visible (expand the list, clear filters,
 * open the row); the element `#${kind}-${id}` is then scrolled into view and focused.
 */
export function useFocusTarget(kind: FocusKind, focus: FocusRequest | null, reveal: (id: string) => void) {
  useEffect(() => {
    if (!focus || focus.kind !== kind) return;
    reveal(focus.id);
    // wait for the reveal to render before scrolling
    const t = setTimeout(() => {
      const el = document.getElementById(`${kind}-${focus.id}`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      el.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [focus?.n]); // respond only to new requests, not re-renders
}

interface PanelProps {
  id: string;
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
  /** "View all" style toggle shown in the header. */
  expandLabel?: string;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  children: ReactNode;
  className?: string;
}

export function Panel({ id, icon, title, meta, expandLabel, expanded, onToggleExpanded, children, className = "" }: PanelProps) {
  return (
    <section className={`dash-panel ${className}`} aria-labelledby={id}>
      <header className="dash-panel__head">
        <span className="dash-panel__icon">{icon}</span>
        <h2 id={id}>{title}</h2>
        {meta && <span className="dash-panel__meta">{meta}</span>}
        {expandLabel && onToggleExpanded && (
          <button type="button" className="dash-panel__action" aria-expanded={expanded} onClick={onToggleExpanded}>
            {expanded ? "Show less" : expandLabel}
            <ArrowRight className={expanded ? "is-flipped" : ""} />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

/** 1–5 loot pips. */
export function LootRating({ value }: { value?: number }) {
  if (!value) return <span className="loot-rating loot-rating--none">Unrated</span>;
  return (
    <span className="loot-rating" role="img" aria-label={`Loot rating ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`loot-rating__pip${i <= value ? " is-on" : ""}`} aria-hidden="true" />
      ))}
    </span>
  );
}
