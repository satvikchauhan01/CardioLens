// Right column of the Patient analysis tab. Renders every analysis state of PRODUCT_SPEC §6.2.

import type { TargetId } from "../../api/types";
import {
  FIX_FIELDS_HINT,
  IDLE_HINT,
  OUT_OF_DATE,
  OUT_OF_DATE_INVALID,
  PREDICT_ERROR_TITLE,
  RESULTS_HEADING,
  RISK_LEVEL_CAPTION,
  UPDATING,
} from "../../config/copy";
import type { AnalysisState } from "../../state/analysisReducer";
import { useMeta } from "../../state/MetaContext";
import { Card } from "../common/Card";
import { Badge, ErrorNotice, Skeleton, Spinner } from "../common/Feedback";
import { AgreementNote } from "./AgreementNote";
import { CadSummaryCard } from "./CadSummaryCard";
import { ExplanationPanel } from "./ExplanationPanel";
import { VesselList } from "./VesselList";

interface ResultsPanelProps {
  state: AnalysisState;
  selectedTarget: TargetId;
  onSelectTarget: (target: TargetId) => void;
  onRetry: () => void;
}

function StatusAside({ status }: { status: AnalysisState["status"] }) {
  if (status === "predicting") return <Spinner label={UPDATING} />;
  if (status === "input_invalid") return <Badge>{OUT_OF_DATE_INVALID}</Badge>;
  if (status === "error") return <Badge>{OUT_OF_DATE}</Badge>;
  return null;
}

export function ResultsPanel({ state, selectedTarget, onSelectTarget, onRetry }: ResultsPanelProps) {
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
      <Card title={RESULTS_HEADING} aside={<StatusAside status={state.status} />}>
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

  return (
    <Card title={RESULTS_HEADING} aside={<StatusAside status={state.status} />}>
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
            />
          )}
          <div>
            <VesselList
              targets={vessels}
              predictions={shown.predictions}
              levelLabels={levelLabels}
              selectedTarget={selectedTarget}
              onSelectTarget={onSelectTarget}
            />
            <p className="mt-1.5 text-xs text-ink-muted">{RISK_LEVEL_CAPTION}</p>
          </div>
          <AgreementNote agreement={shown.agreement} />
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
