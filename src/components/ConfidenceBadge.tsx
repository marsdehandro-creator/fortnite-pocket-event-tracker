import type { Confidence } from "../types/events";
import { CONFIDENCE_HINT, CONFIDENCE_LABEL } from "../utils/labels";

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span className={`confidence confidence--${confidence}`} title={CONFIDENCE_HINT[confidence]}>
      {CONFIDENCE_LABEL[confidence]}
      <span className="sr-only"> — {CONFIDENCE_HINT[confidence]}</span>
    </span>
  );
}
