// Two optional lines under an estimate: the what-if change against the loaded patient (BR-10)
// and the dataset's angiography label with a match mark (BR-11).

import type { TargetInfo, TargetPrediction } from "../../api/types";
import {
  DATASET_LABELS,
  GROUND_TRUTH_LABEL,
  GROUND_TRUTH_MATCH,
  GROUND_TRUTH_MISMATCH,
} from "../../config/copy";
import { formatDelta } from "../../utils/format";

interface EstimateNotesProps {
  target: TargetInfo;
  prediction: TargetPrediction;
  original?: TargetPrediction | null; // the loaded patient's estimate, when the inputs are modified
  truth?: 0 | 1 | null; // the dataset label, when it is being shown
}

export function EstimateNotes({ target, prediction, original, truth }: EstimateNotesProps) {
  const hasTruth = truth === 0 || truth === 1;
  if (!original && !hasTruth) return null;
  const matches = hasTruth && (truth === 1) === prediction.predicted;

  return (
    <span className="mt-1.5 block space-y-0.5 text-xs text-ink">
      {original && (
        <span data-delta={target.id} className="block tabular-nums">
          {formatDelta(original.probability, prediction.probability)}
        </span>
      )}
      {hasTruth && (
        <span data-truth={target.id} className="block">
          {GROUND_TRUTH_LABEL}: <span className="font-medium">{DATASET_LABELS[target.kind][truth]}</span>{" "}
          <span aria-hidden="true" className="font-semibold">
            {matches ? "✓" : "✗"}
          </span>
          <span className="sr-only"> ({matches ? GROUND_TRUTH_MATCH : GROUND_TRUTH_MISMATCH})</span>
        </span>
      )}
    </span>
  );
}
