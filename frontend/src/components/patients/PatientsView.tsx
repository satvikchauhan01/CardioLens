// The Patients page (F1): the held-out sample patients as cards, in two groups by the dataset's
// overall label, so it is plain in which of them angiography found no coronary artery disease.
// Each card also carries the models' estimates for its patient, so label and estimate can be
// compared at a glance. Choosing a card opens its analysis.

import { useState } from "react";
import type { FeatureSchema, SamplePatient, TargetId, TargetInfo, TargetPrediction } from "../../api/types";
import {
  ANALYSE,
  CARD_CAD_ESTIMATE,
  ESTIMATES_CAPTION,
  ESTIMATES_ERROR,
  ESTIMATES_LOADING,
  IN_ANALYSIS,
  NEW_PATIENT,
  OWN_PATIENT_PROMPT,
  patientCount,
  RETRY,
  SAMPLE_FILTER_ALL,
  SAMPLE_FILTER_LABEL,
  SAMPLE_GROUPS,
  SAMPLES_HEADING,
  samplesIntro,
} from "../../config/copy";
import { riskColor } from "../../config/risk";
import { featureById, useMeta } from "../../state/MetaContext";
import type { SampleEstimates, SampleEstimatesStatus } from "../../state/useSampleEstimates";
import { formatMeasurement, formatPercent, percentPoints } from "../../utils/format";
import { Card } from "../common/Card";
import { Badge, BUTTON_CLASS, Skeleton, Spinner } from "../common/Feedback";
import { Icon } from "../common/Icon";

// Age and sex are in each sample's subtitle already.
const IN_SUBTITLE = new Set(["age", "sex"]);
const FACTS_PER_CARD = 4;

type Filter = "all" | 0 | 1;

interface PatientsViewProps {
  samples: SamplePatient[];
  loadedSampleId: string | null; // the sample on the Analysis page, if it is one
  estimates?: SampleEstimates; // the models' estimates per sample id, as far as they have arrived
  estimatesStatus?: SampleEstimatesStatus;
  onRetryEstimates?: () => void;
  onChoose: (sample: SamplePatient) => void;
  onNewPatient: () => void;
}

/** The overall estimate as a small ring in its risk colour, with the percentage inside. */
function EstimateRing({ probability }: { probability: number }) {
  return (
    <span className="relative block size-14 shrink-0">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 40 40" className="size-full -rotate-90">
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-track)" strokeWidth="5" />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          pathLength={100}
          stroke={riskColor(probability)}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${percentPoints(probability)} 100`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-ink">
        {formatPercent(probability)}
      </span>
    </span>
  );
}

function SampleEstimate({
  sampleId,
  targets,
  predictions,
  waiting,
}: {
  sampleId: string;
  targets: TargetInfo[];
  predictions?: Record<TargetId, TargetPrediction>;
  waiting: boolean;
}) {
  const overall = targets.find((target) => target.kind === "overall");
  const vessels = targets.filter((target) => target.kind === "vessel");
  if (!predictions) {
    return waiting ? (
      <span className="mt-3 flex items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <span className="block flex-1 space-y-1.5">
          <Skeleton className="h-2" />
          <Skeleton className="h-2" />
          <Skeleton className="h-2" />
        </span>
      </span>
    ) : null;
  }

  return (
    <span id={`estimate-${sampleId}`} data-estimate={sampleId} className="mt-3 flex items-center gap-3">
      {overall && (
        <span className="flex flex-col items-center gap-0.5">
          <EstimateRing probability={predictions[overall.id].probability} />
          <span className="text-[0.65rem] text-ink-muted">{CARD_CAD_ESTIMATE}</span>
        </span>
      )}
      <span className="block min-w-0 flex-1 space-y-1">
        {vessels.map((vessel) => {
          const { probability } = predictions[vessel.id];
          return (
            <span key={vessel.id} className="grid grid-cols-[2rem_minmax(0,1fr)_2.25rem] items-center gap-1.5 text-xs">
              <span className="font-medium text-ink">{vessel.short_label}</span>
              <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-track">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${percentPoints(probability)}%`, backgroundColor: riskColor(probability) }}
                />
              </span>
              <span className="text-right tabular-nums text-ink">{formatPercent(probability)}</span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

function SampleCard({
  sample,
  facts,
  loaded,
  targets,
  predictions,
  waiting,
  onChoose,
}: {
  sample: SamplePatient;
  facts: FeatureSchema[];
  loaded: boolean;
  targets: TargetInfo[];
  predictions?: Record<TargetId, TargetPrediction>;
  waiting: boolean;
  onChoose: (sample: SamplePatient) => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-label={`${ANALYSE} ${sample.title}, ${sample.subtitle}`}
        aria-describedby={predictions ? `estimate-${sample.id}` : undefined}
        aria-current={loaded ? "true" : undefined}
        onClick={() => onChoose(sample)}
        className={`group flex h-full w-full cursor-pointer flex-col rounded-xl border p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
          loaded ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand"
        }`}
      >
        <span className="flex items-start justify-between gap-2">
          <span>
            <span className="block text-base font-semibold text-ink">{sample.title}</span>
            <span className="block text-sm text-ink-muted">{sample.subtitle}</span>
          </span>
          {loaded && <Badge>{IN_ANALYSIS}</Badge>}
        </span>
        <SampleEstimate sampleId={sample.id} targets={targets} predictions={predictions} waiting={waiting} />
        <span className="mt-3 block space-y-1 border-t border-line pt-3 text-xs">
          {facts.map((feature) => (
            <span key={feature.id} className="flex justify-between gap-3">
              <span className="text-ink-muted">{feature.label}</span>
              <span className="font-medium tabular-nums text-ink">
                {formatMeasurement(feature, sample.features[feature.id])}
              </span>
            </span>
          ))}
        </span>
        <span className="mt-4 block text-sm font-medium text-brand">{ANALYSE} →</span>
      </button>
    </li>
  );
}

export function PatientsView({
  samples,
  loadedSampleId,
  estimates = {},
  estimatesStatus = "idle",
  onRetryEstimates,
  onChoose,
  onNewPatient,
}: PatientsViewProps) {
  const meta = useMeta();
  const [filter, setFilter] = useState<Filter>("all");
  // What each card says about its patient: the inputs that matter most to the models (BR-9).
  const facts = meta.quick_controls
    .filter((id) => !IN_SUBTITLE.has(id))
    .flatMap((id) => featureById(meta, id) ?? [])
    .slice(0, FACTS_PER_CARD);
  const groups = SAMPLE_GROUPS.map((group) => ({
    ...group,
    members: samples.filter((sample) => sample.ground_truth.cad === group.label),
  })).filter((group) => group.members.length > 0);
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: SAMPLE_FILTER_ALL, count: samples.length },
    ...groups.map((group) => ({ id: group.label, label: group.heading, count: group.members.length })),
  ];

  return (
    <div className="space-y-6">
      <Card title={SAMPLES_HEADING}>
        <p className="text-sm text-ink-muted">{samplesIntro(samples.length)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label={SAMPLE_FILTER_LABEL} className="flex flex-wrap gap-1.5">
            {filters.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none ${
                  filter === option.id
                    ? "border-brand bg-brand text-surface"
                    : "border-line bg-surface text-ink hover:border-brand hover:text-brand"
                }`}
              >
                {option.label} · {option.count}
              </button>
            ))}
          </div>
          {estimatesStatus === "loading" && <Spinner label={ESTIMATES_LOADING} />}
          {estimatesStatus === "ready" && <p className="text-xs text-ink-muted">{ESTIMATES_CAPTION}</p>}
        </div>
        {estimatesStatus === "error" && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink">
            <span>{ESTIMATES_ERROR}</span>
            {onRetryEstimates && (
              <button type="button" onClick={onRetryEstimates} className={`${BUTTON_CLASS} px-2.5 py-1 text-xs`}>
                {RETRY}
              </button>
            )}
          </div>
        )}
      </Card>

      {groups
        .filter((group) => filter === "all" || filter === group.label)
        .map((group) => {
          const headingId = `samples-${group.label}`;
          return (
            <section key={group.label} aria-labelledby={headingId}>
              <h2 id={headingId} className="text-sm font-semibold text-ink">
                {group.heading} <span className="font-normal text-ink-muted">· {patientCount(group.members.length)}</span>
              </h2>
              <p className="text-xs text-ink-muted">{group.note}</p>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                {group.members.map((sample) => (
                  <SampleCard
                    key={sample.id}
                    sample={sample}
                    facts={facts}
                    loaded={sample.id === loadedSampleId}
                    targets={meta.targets}
                    predictions={estimates[sample.id]}
                    waiting={estimatesStatus === "loading"}
                    onChoose={onChoose}
                  />
                ))}
              </ul>
            </section>
          );
        })}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <Icon name="new" className="size-5 text-accent" />
        <p className="text-sm text-ink">{OWN_PATIENT_PROMPT}</p>
        <button type="button" onClick={onNewPatient} className={BUTTON_CLASS}>
          {NEW_PATIENT}
        </button>
      </div>
    </div>
  );
}
