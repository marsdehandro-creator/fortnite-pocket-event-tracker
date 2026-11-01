import type { TeamFormat } from "../types/events";
import { FORMAT_LABEL, FORMATS } from "../utils/labels";

export type FormatFilterValue = TeamFormat | "all";

interface FormatFilterProps {
  value: FormatFilterValue;
  onChange: (value: FormatFilterValue) => void;
  counts: Record<FormatFilterValue, number>;
}

const OPTIONS: FormatFilterValue[] = ["all", ...FORMATS];

export function FormatFilter({ value, onChange, counts }: FormatFilterProps) {
  return (
    <div className="segmented" role="group" aria-label="Filter events by team format">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className="segmented__option"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option === "all" ? "All" : FORMAT_LABEL[option]}
          <span className="segmented__count">{counts[option]}</span>
        </button>
      ))}
    </div>
  );
}

export const isFormatFilterValue = (v: unknown): v is FormatFilterValue =>
  v === "all" || (typeof v === "string" && (FORMATS as string[]).includes(v));
