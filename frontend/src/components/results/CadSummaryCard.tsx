// F4: the overall CAD estimate. Selecting it shows the CAD model's explanation.

import type { TargetInfo, TargetPrediction } from "../../api/types";
import { CAD_CAPTION, STATUS_TEXT } from "../../config/copy";
import { AnimatedPercent } from "./AnimatedPercent";
import { EstimateNotes } from "./EstimateNotes";
import { RiskGauge } from "./RiskGauge";

interface CadSummaryCardProps {
  target: TargetInfo;
  prediction: TargetPrediction;
  levelLabel: string;
  selected: boolean;
  onSelect: () => void;
  original?: TargetPrediction | null;
  truth?: 0 | 1 | null;
}

export function CadSummaryCard({
  target,
  prediction,
  levelLabel,
  selected,
  onSelect,
  original,
  truth,
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
        className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none ${
          selected ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand"
        }`}
      >
        <span className="block text-xs font-medium text-ink-muted">{target.label}</span>
        <RiskGauge target={target.id} probability={prediction.probability}>
          <AnimatedPercent probability={prediction.probability} />
        </RiskGauge>
        <span className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-ink">{status}</span>
          <span className="text-xs text-ink-muted">{levelLabel}</span>
        </span>
        <EstimateNotes target={target} prediction={prediction} original={original} truth={truth} />
      </button>
      <p className="mt-1.5 text-xs text-ink-muted">{CAD_CAPTION}</p>
    </div>
  );
}
