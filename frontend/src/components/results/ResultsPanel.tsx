// Right column of the Patient analysis tab. Renders every analysis state of PRODUCT_SPEC §6.2.

import type { TargetId } from "../../api/types";
import {
  FIX_FIELDS_HINT,
  GROUND_TRUTH_MODIFIED,
  GROUND_TRUTH_ONLY_SAMPLES,
  IDLE_HINT,
  PREDICT_ERROR_TITLE,
  RESULTS_HEADING,
  RISK_LEVEL_CAPTION,
} from "../../config/copy";
import { modifiedFields, type AnalysisState } from "../../state/analysisReducer";
import { useMeta } from "../../state/MetaContext";
import { AnalysisStatus } from "../common/AnalysisStatus";
import { Card } from "../common/Card";
import { ErrorNotice, Skeleton } from "../common/Feedback";
import { AgreementNote } from "./AgreementNote";
import { CadSummaryCard } from "./CadSummaryCard";
import { ExplanationPanel } from "./ExplanationPanel";
import { GroundTruthToggle } from "./GroundTruthToggle";
import { VesselList } from "./VesselList";

interface ResultsPanelProps {
  state: AnalysisState;
  selectedTarget: TargetId;
  hoveredTarget?: TargetId | null;
  onSelectTarget: (target: TargetId) => void;
  onHoverTarget?: (target: TargetId | null) => void;
  onRetry: () => void;
  // Dataset labels of the loaded sample patient, if it is one (F8).
  groundTruth?: Record<TargetId, 0 | 1> | null;
  showGroundTruth?: boolean;
  onShowGroundTruth?: (show: boolean) => void;
}

export function ResultsPanel({
  state,
  selectedTarget,
  hoveredTarget,
  onSelectTarget,
  onHoverTarget,
  onRetry,
  groundTruth = null,
  showGroundTruth = false,
  onShowGroundTruth,
}: ResultsPanelProps) {
  const meta = useMeta();
  // Not ready: keep showing the last good result, dimmed, instead of an empty panel.
  const shown = state.status === "ready" ? state.result : state.lastGoodResult;
  const stale = state.status !== "ready";
  const error =
    state.status === "error" && state.error ? (
      <ErrorNotice title={PREDICT_ERROR_TITLE} message={state.error.message} onRetry={onRetry} />
    ) : null;

  if (!shown) {
    return (
      <Card title={RESULTS_HEADING} aside={<AnalysisStatus status={state.status} />}>
        {state.status === "predicting" && (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}
        {state.status === "idle" && <p className="text-sm text-ink-muted">{IDLE_HINT}.</p>}
        {state.status === "input_invalid" && (
          <p className="text-sm text-ink-muted">{FIX_FIELDS_HINT}</p>
        )}
        {error}
      </Card>
    );
  }

  const overall = meta.targets.find((target) => target.kind === "overall");
  const vessels = meta.targets.filter((target) => target.kind === "vessel");
  const selected = meta.targets.find((target) => target.id === selectedTarget);
  const levelLabels = Object.fromEntries(meta.risk_levels.map((level) => [level.id, level.label]));

  // BR-10: once the inputs differ from the loaded patient, show each estimate's change.
  const modified = modifiedFields(state).length > 0;
  const original = state.originalResult;
  const originals = modified && original && shown !== original ? original.predictions : null;

  // BR-11: dataset labels only for a sample patient with untouched inputs, and only beside that
  // patient's own estimates (not beside a result that is still being replaced).
  const truthUnavailable = !groundTruth ? GROUND_TRUTH_ONLY_SAMPLES : modified ? GROUND_TRUTH_MODIFIED : null;
  const truths = groundTruth && showGroundTruth && !modified && !stale ? groundTruth : null;
  const matched = truths
    ? meta.targets.filter((target) => (truths[target.id] === 1) === shown.predictions[target.id].predicted).length
    : 0;

  return (
    <Card title={RESULTS_HEADING} aside={<AnalysisStatus status={state.status} />}>
      <div className="space-y-4">
        {error}
        <div aria-busy={state.status === "predicting"} className={`space-y-4 ${stale ? "opacity-60" : ""}`}>
          {overall && (
            <CadSummaryCard
              target={overall}
              prediction={shown.predictions[overall.id]}
              levelLabel={levelLabels[shown.predictions[overall.id].risk_level]}
              selected={selectedTarget === overall.id}
              onSelect={() => onSelectTarget(overall.id)}
              original={originals?.[overall.id]}
              truth={truths?.[overall.id]}
            />
          )}
          <div>
            <VesselList
              targets={vessels}
              predictions={shown.predictions}
              levelLabels={levelLabels}
              selectedTarget={selectedTarget}
              hoveredTarget={hoveredTarget}
              onSelectTarget={onSelectTarget}
              onHoverTarget={onHoverTarget}
              originals={originals}
              truths={truths}
            />
            <p className="mt-1.5 text-xs text-ink-muted">{RISK_LEVEL_CAPTION}</p>
          </div>
          <AgreementNote agreement={shown.agreement} />
          {onShowGroundTruth && (
            <GroundTruthToggle
              checked={showGroundTruth}
              onChange={onShowGroundTruth}
              unavailableReason={truthUnavailable}
              matches={truths ? { matched, total: meta.targets.length } : null}
            />
          )}
          {selected && (
            <div className="border-t border-line pt-4">
              <ExplanationPanel target={selected} explanation={shown.explanations[selected.id]} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
