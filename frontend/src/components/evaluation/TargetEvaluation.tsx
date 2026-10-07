// F9: one target in detail: all candidates, the three out-of-fold plots, and the top inputs.

import type { MetricsResponse, TargetId, TargetInfo } from "../../api/types";
import {
  CANDIDATES_CAPTION,
  IMPORTANCE_CAPTION,
  IMPORTANCE_HEADING,
  MODEL_TYPE_LABELS,
  PLOTS_HEADING,
} from "../../config/copy";
import { featureById, useMeta } from "../../state/MetaContext";
import { CandidatesTable } from "./MetricsTables";

interface TargetEvaluationProps {
  target: TargetInfo;
  metrics: MetricsResponse["targets"][TargetId];
  threshold: number;
}

export function TargetEvaluation({ target, metrics, threshold }: TargetEvaluationProps) {
  const meta = useMeta();
  const selected = MODEL_TYPE_LABELS[metrics.selected_model];
  const plots = [
    { src: metrics.plots.roc, alt: `ROC curves for ${target.short_label}: the three candidate models on out-of-fold predictions` },
    { src: metrics.plots.calibration, alt: `Calibration of the ${selected} model for ${target.short_label}: observed fraction against mean predicted probability` },
    { src: metrics.plots.confusion, alt: `Confusion matrix of the ${selected} model for ${target.short_label} at threshold ${threshold}` },
  ];
  const largest = Math.max(0, ...metrics.global_importance.map((item) => item.share));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink">
          <span className="font-semibold">
            {target.short_label} · {target.label}.
          </span>{" "}
          {metrics.n_positive} positive and {metrics.n_negative} negative training patients (
          {(metrics.prevalence * 100).toFixed(1)}% positive). Selected model: {selected}. {metrics.selection_reason}.
        </p>
        <div className="mt-3">
          <CandidatesTable target={target.id} metrics={metrics} caption={CANDIDATES_CAPTION} />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-ink">{PLOTS_HEADING}</h4>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {plots.map((plot) => (
            <img
              key={plot.src}
              src={plot.src}
              alt={plot.alt}
              width={920}
              height={860}
              className="h-auto w-full rounded-lg border border-line"
            />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-ink">{IMPORTANCE_HEADING}</h4>
        <p className="text-xs text-ink-muted">{IMPORTANCE_CAPTION}</p>
        <ol className="mt-2 max-w-xl space-y-1.5">
          {metrics.global_importance.map((item) => (
            <li key={item.feature} className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3rem] items-center gap-2 text-xs">
              <span className="truncate text-ink">{featureById(meta, item.feature)?.label ?? item.feature}</span>
              <span aria-hidden="true" className="h-2 rounded-full bg-canvas">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${largest > 0 ? (item.share / largest) * 100 : 0}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-ink">{(item.share * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
