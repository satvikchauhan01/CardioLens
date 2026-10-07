// The Model & method tab (F9, PRODUCT_SPEC §4.3): how the models were validated and how they did.
// The metrics are fetched the first time the tab is opened and kept for the session (DF-4).

import { useCallback, useEffect, useRef, useState } from "react";
import { getMetrics, toApiError, type ApiError } from "../../api/client";
import type { MetricsResponse, TargetId } from "../../api/types";
import {
  CREDIT_HEART,
  CREDIT_LIBRARIES,
  CREDITS_HEADING,
  DETAIL_HEADING,
  LIMITATIONS,
  LIMITATIONS_HEADING,
  METHOD_HEADING,
  METRICS_ERROR_TITLE,
  METRICS_LOADING,
  MODEL_VERSION_LABEL,
  OVERVIEW_CAPTION,
  OVERVIEW_HEADING,
  SELECTION_RULE,
} from "../../config/copy";
import { useMeta } from "../../state/MetaContext";
import { Card } from "../common/Card";
import { ErrorNotice, Spinner } from "../common/Feedback";
import { OverviewTable } from "./MetricsTables";
import { TargetEvaluation } from "./TargetEvaluation";

type Load =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "ready"; metrics: MetricsResponse };

function MethodBox({ metrics }: { metrics: MetricsResponse }) {
  const { dataset, trained_at } = useMeta();
  const { validation } = metrics;
  const rows: [string, string][] = [
    ["Dataset", `${dataset.name}: ${dataset.n_total} patients (${dataset.license}).`],
    ["Held-out sample patients", validation.holdout_note],
    ["Training rows", `${validation.n_rows} patients, used for cross-validation and for the final fit.`],
    [
      "Validation",
      `Repeated stratified ${validation.n_splits}-fold cross-validation, ${validation.n_repeats} repeats (${validation.n_splits * validation.n_repeats} folds, seed ${validation.seed}).${
        validation.preprocessing_inside_folds ? " Preprocessing is refitted inside every fold." : ""
      }`,
    ],
    ["Leakage guard", `These dataset columns are never inputs to any model: ${validation.excluded_columns.join(", ")}.`],
    ["Decision threshold", `${validation.decision_threshold}: a target is predicted when its probability is at or above it.`],
    ["Model selection", SELECTION_RULE],
    [MODEL_VERSION_LABEL, `${metrics.model_version}, trained ${trained_at.replace("T", " ").replace("Z", " UTC")}.`],
  ];

  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm md:grid-cols-[14rem_minmax(0,1fr)]">
      {rows.map(([term, text]) => (
        <div key={term} className="contents">
          <dt className="font-medium text-ink">{term}</dt>
          <dd className="text-ink-muted">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MethodView({ active }: { active: boolean }) {
  const meta = useMeta();
  const [load, setLoad] = useState<Load>({ status: "idle" });
  const [target, setTarget] = useState<TargetId>(meta.targets[0].id);
  const requested = useRef(false);

  const fetchMetrics = useCallback(() => {
    setLoad({ status: "loading" });
    getMetrics().then(
      (metrics) => setLoad({ status: "ready", metrics }),
      (error: unknown) => setLoad({ status: "error", error: toApiError(error) }),
    );
  }, []);

  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    fetchMetrics();
  }, [active, fetchMetrics]);

  // Nothing is asked for, or shown, before the tab is opened for the first time.
  if (load.status === "idle") return null;
  if (load.status === "loading") {
    return (
      <Card>
        <Spinner label={METRICS_LOADING} />
      </Card>
    );
  }
  if (load.status === "error") {
    return (
      <Card>
        <ErrorNotice title={METRICS_ERROR_TITLE} message={load.error.message} onRetry={fetchMetrics} />
      </Card>
    );
  }

  const { metrics } = load;
  const chosen = meta.targets.find((candidate) => candidate.id === target) ?? meta.targets[0];

  return (
    <div className="space-y-6">
      <Card title={METHOD_HEADING}>
        <MethodBox metrics={metrics} />
      </Card>

      <Card title={OVERVIEW_HEADING}>
        <OverviewTable targets={meta.targets} metrics={metrics.targets} caption={OVERVIEW_CAPTION} />
      </Card>

      <Card title={DETAIL_HEADING}>
        <div role="group" aria-label={DETAIL_HEADING} className="mb-4 flex flex-wrap gap-1.5">
          {meta.targets.map((candidate) => {
            const pressed = candidate.id === chosen.id;
            return (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => setTarget(candidate.id)}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  pressed ? "border-brand bg-brand text-surface" : "border-line bg-surface text-ink hover:border-brand"
                }`}
              >
                {candidate.short_label}
              </button>
            );
          })}
        </div>
        <TargetEvaluation
          target={chosen}
          metrics={metrics.targets[chosen.id]}
          threshold={metrics.validation.decision_threshold}
        />
      </Card>

      <Card title={LIMITATIONS_HEADING}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {LIMITATIONS.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </Card>

      <Card title={CREDITS_HEADING}>
        <div className="space-y-2 text-sm text-ink-muted">
          <p>
            Dataset: {meta.dataset.citation} Licensed under {meta.dataset.license}.{" "}
            <a
              href={meta.dataset.url}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline focus-visible:outline-2 focus-visible:outline-brand"
            >
              UCI dataset page
            </a>
          </p>
          <p>{CREDIT_HEART}</p>
          <p>{CREDIT_LIBRARIES}</p>
        </div>
      </Card>
    </div>
  );
}
