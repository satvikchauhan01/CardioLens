// F4: the overall CAD estimate. Selecting it shows the CAD model's explanation.

import type { TargetInfo, TargetPrediction } from "../../api/types";
import { CAD_CAPTION, STATUS_TEXT } from "../../config/copy";
import { formatPercent } from "../../utils/format";

interface CadSummaryCardProps {
  target: TargetInfo;
  prediction: TargetPrediction;
  levelLabel: string;
  selected: boolean;
  onSelect: () => void;
}

export function CadSummaryCard({
  target,
  prediction,
  levelLabel,
  selected,
  onSelect,
}: CadSummaryCardProps) {
  const status = prediction.predicted
    ? STATUS_TEXT.overall.predicted
    : STATUS_TEXT.overall.notPredicted;

  return (
    <div>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`w-full cursor-pointer rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          selected ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand"
        }`}
      >
        <span className="block text-xs font-medium text-ink-muted">{target.label}</span>
        <span className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-3xl font-semibold tracking-tight text-ink">
            {formatPercent(prediction.probability)}
          </span>
          <span className="text-right">
            <span className="block text-sm font-medium text-ink">{status}</span>
            <span className="block text-xs text-ink-muted">{levelLabel}</span>
          </span>
        </span>
      </button>
      <p className="mt-1.5 text-xs text-ink-muted">{CAD_CAPTION}</p>
    </div>
  );
}
