interface ChipFilterProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (option: T) => string;
  /** Optional per-option counts shown as a badge. */
  counts?: Partial<Record<T, number>>;
  ariaLabel: string;
  className?: string;
}

/** Single-select chip row (horizontally scrollable on small screens). */
export function ChipFilter<T extends string>({ options, value, onChange, label, counts, ariaLabel, className = "" }: ChipFilterProps<T>) {
  return (
    <div className={`segmented ${className}`} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="segmented__option"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {label(option)}
          {counts && <span className="segmented__count">{counts[option] ?? 0}</span>}
        </button>
      ))}
    </div>
  );
}
