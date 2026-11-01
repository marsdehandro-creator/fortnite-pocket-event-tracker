import type { TeamFormat } from "../types/events";
import { FORMAT_LABEL, FORMATS } from "../utils/labels";
import { ChipFilter } from "./ChipFilter";

export type FormatFilterValue = TeamFormat | "all";

interface FormatFilterProps {
  value: FormatFilterValue;
  onChange: (value: FormatFilterValue) => void;
  counts: Record<FormatFilterValue, number>;
}

const OPTIONS: FormatFilterValue[] = ["all", ...FORMATS];

export function FormatFilter({ value, onChange, counts }: FormatFilterProps) {
  return (
    <ChipFilter
      options={OPTIONS}
      value={value}
      onChange={onChange}
      counts={counts}
      label={(o) => (o === "all" ? "All" : FORMAT_LABEL[o])}
      ariaLabel="Filter events by team format"
    />
  );
}

export const isFormatFilterValue = (v: unknown): v is FormatFilterValue =>
  v === "all" || (typeof v === "string" && (FORMATS as string[]).includes(v));
