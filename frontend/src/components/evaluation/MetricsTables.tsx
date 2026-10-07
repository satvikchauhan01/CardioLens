// F9: cross-validated metrics as tables. Every value is mean ± standard deviation over the folds.

import { useId, type ReactNode } from "react";
import type { MetricSet, MetricsResponse, ModelType, TargetId, TargetInfo } from "../../api/types";
import { BASELINE_LABEL, METRIC_LABELS, MODEL_TYPE_LABELS } from "../../config/copy";
import { formatStat } from "../../utils/format";

type MetricName = keyof typeof METRIC_LABELS;
const METRICS = Object.keys(METRIC_LABELS) as MetricName[];

const TABLE = "w-full border-collapse text-left text-xs";
const HEAD = "border-b border-line px-2 py-1.5 font-medium text-ink-muted";
const CELL = "border-b border-line px-2 py-1.5 tabular-nums text-ink";

function MetricCells({ metrics }: { metrics: MetricSet }) {
  return (
    <>
      {METRICS.map((name) => (
        <td key={name} className={`${CELL} whitespace-nowrap`}>
          {formatStat(metrics[name])}
        </td>
      ))}
    </>
  );
}

function MetricHeads() {
  return (
    <>
      {METRICS.map((name) => (
        <th key={name} scope="col" className={`${HEAD} whitespace-nowrap`}>
          {METRIC_LABELS[name]}
        </th>
      ))}
    </>
  );
}

/** The table scrolls sideways when it does not fit; its caption stays in place above it. */
function MetricsTable({ caption, target, children }: { caption: string; target?: TargetId; children: ReactNode }) {
  const captionId = useId();
  return (
    <div>
      <p id={captionId} className="mb-2 text-xs text-ink-muted">
        {caption}
      </p>
      <div className="overflow-x-auto">
        <table aria-labelledby={captionId} data-candidates={target} className={TABLE}>
          {children}
        </table>
      </div>
    </div>
  );
}

interface OverviewTableProps {
  targets: TargetInfo[];
  metrics: MetricsResponse["targets"];
  caption: string;
}

/** One row per target: the selected model's results. */
export function OverviewTable({ targets, metrics, caption }: OverviewTableProps) {
  return (
    <MetricsTable caption={caption}>
      <thead>
        <tr>
          <th scope="col" className={HEAD}>Target</th>
          <th scope="col" className={HEAD}>Selected model</th>
          <th scope="col" className={`${HEAD} whitespace-nowrap`}>Positive / negative</th>
          <MetricHeads />
        </tr>
      </thead>
      <tbody>
        {targets.map((target) => {
          const result = metrics[target.id];
          return (
            <tr key={target.id}>
              <th scope="row" className={`${CELL} font-semibold`}>{target.short_label}</th>
              <td className={`${CELL} whitespace-nowrap`}>{MODEL_TYPE_LABELS[result.selected_model]}</td>
              <td className={`${CELL} whitespace-nowrap`}>
                {result.n_positive} / {result.n_negative}
              </td>
              <MetricCells metrics={result.candidates[result.selected_model]} />
            </tr>
          );
        })}
      </tbody>
    </MetricsTable>
  );
}

interface CandidatesTableProps {
  target: TargetId;
  metrics: MetricsResponse["targets"][TargetId];
  caption: string;
}

/** Every candidate and the baseline for one target, the selected model marked. */
export function CandidatesTable({ target, metrics, caption }: CandidatesTableProps) {
  const models = Object.keys(metrics.candidates) as (ModelType | "baseline_prior")[];

  return (
    <MetricsTable caption={caption} target={target}>
      <thead>
        <tr>
          <th scope="col" className={HEAD}>Model</th>
          <MetricHeads />
        </tr>
      </thead>
      <tbody>
        {models.map((model) => {
          const selected = model === metrics.selected_model;
          return (
            <tr key={model} className={selected ? "bg-brand-soft" : undefined}>
              <th scope="row" className={`${CELL} whitespace-nowrap ${selected ? "font-semibold" : "font-normal"}`}>
                {model === "baseline_prior" ? BASELINE_LABEL : MODEL_TYPE_LABELS[model]}
                {selected && <span className="font-normal text-ink-muted"> · selected</span>}
              </th>
              <MetricCells metrics={metrics.candidates[model]} />
            </tr>
          );
        })}
      </tbody>
    </MetricsTable>
  );
}
