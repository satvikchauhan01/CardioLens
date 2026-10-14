// F4: one row per coronary artery. Rows are buttons, so every 3D selection also works by keyboard.
// Hovering or focusing a row highlights the same artery in the viewer, and the other way round.

import type { TargetId, TargetInfo, TargetPrediction } from "../../api/types";
import { STATUS_TEXT, VESSELS_LABEL } from "../../config/copy";
import { riskColor } from "../../config/risk";
import { rimColorOf } from "../../config/vessels";
import { percentPoints } from "../../utils/format";
import { AnimatedPercent } from "./AnimatedPercent";
import { EstimateNotes } from "./EstimateNotes";

interface VesselListProps {
  targets: TargetInfo[];
  predictions: Record<TargetId, TargetPrediction>;
  levelLabels: Record<string, string>;
  selectedTarget: TargetId;
  hoveredTarget?: TargetId | null;
  onSelectTarget: (target: TargetId) => void;
  onHoverTarget?: (target: TargetId | null) => void;
  originals?: Record<TargetId, TargetPrediction> | null; // estimates of the loaded patient (BR-10)
  truths?: Record<TargetId, 0 | 1> | null; // dataset labels, when shown (BR-11)
}

export function VesselList({
  targets,
  predictions,
  levelLabels,
  selectedTarget,
  hoveredTarget = null,
  onSelectTarget,
  onHoverTarget,
  originals,
  truths,
}: VesselListProps) {
  return (
    <ul aria-label={VESSELS_LABEL} className="space-y-2">
      {targets.map((target) => {
        const prediction = predictions[target.id];
        const selected = target.id === selectedTarget;
        const hovered = target.id === hoveredTarget;
        const status = prediction.predicted
          ? STATUS_TEXT.vessel.predicted
          : STATUS_TEXT.vessel.notPredicted;

        return (
          <li key={target.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectTarget(target.id)}
              onMouseEnter={() => onHoverTarget?.(target.id)}
              onMouseLeave={() => onHoverTarget?.(null)}
              onFocus={() => onHoverTarget?.(target.id)}
              onBlur={() => onHoverTarget?.(null)}
              className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none ${
                selected
                  ? "border-brand bg-brand-soft"
                  : hovered
                    ? "border-brand bg-surface"
                    : "border-line bg-surface hover:border-brand"
              }`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span>
                  <span
                    aria-hidden="true"
                    data-rim-swatch={target.id}
                    className="mr-1.5 inline-block h-3.5 w-1 rounded-sm align-middle"
                    style={{ backgroundColor: rimColorOf(target.id) ?? undefined }}
                  />
                  <span className="text-sm font-semibold text-ink">{target.short_label}</span>
                  <span className="text-xs text-ink-muted"> · {target.label}</span>
                </span>
                <span className="text-lg font-semibold tabular-nums text-ink">
                  <AnimatedPercent probability={prediction.probability} />
                </span>
              </span>
              <span
                aria-hidden="true"
                className="mt-1.5 block h-2 overflow-hidden rounded-full bg-track"
              >
                <span
                  data-risk-bar={target.id}
                  className="block h-full rounded-full transition-[width,background-color] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${percentPoints(prediction.probability)}%`,
                    backgroundColor: riskColor(prediction.probability),
                  }}
                />
              </span>
              <span className="mt-1.5 flex justify-between gap-3 text-xs text-ink-muted">
                <span>{status}</span>
                <span>{levelLabels[prediction.risk_level]}</span>
              </span>
              <EstimateNotes
                target={target}
                prediction={prediction}
                original={originals?.[target.id]}
                truth={truths?.[target.id]}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
