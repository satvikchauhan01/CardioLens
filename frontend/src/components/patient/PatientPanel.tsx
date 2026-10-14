// Left column of the Analysis page: who the patient is, quick what-if changes, and every input
// behind the estimates. Another patient is chosen on the Patients or the New patient page.

import type { FeatureValue, SamplePatient } from "../../api/types";
import {
  ALL_INPUTS_HEADING,
  CHANGE_PATIENT,
  COHERENCE_NOTE,
  COHERENCE_TITLE,
  IDLE_HINT,
  modifiedLabel,
  NEW_PATIENT,
  OWN_PATIENT,
  OWN_PATIENT_NOTE,
  PATIENT_HEADING,
  QUICK_CONTROLS_HEADING,
  QUICK_CONTROLS_HINT,
  RESET_TO_ORIGINAL,
  type TabId,
  WHAT_IF_NOTE,
} from "../../config/copy";
import { modifiedFields } from "../../state/analysisReducer";
import { coherenceNotes } from "../../state/coherence";
import { useMeta } from "../../state/MetaContext";
import type { Analysis } from "../../state/useAnalysis";
import { Card } from "../common/Card";
import { Badge, BUTTON_CLASS } from "../common/Feedback";
import { FeatureForm } from "./FeatureForm";
import { QuickControls } from "./QuickControls";

interface PatientPanelProps {
  samples: SamplePatient[];
  analysis: Analysis;
  onNavigate: (tab: TabId) => void;
}

/** "60 y · Male" for a patient of the user's own, as the samples' subtitles read. */
function describe(values: Record<string, FeatureValue>): string | null {
  const { age, sex } = values;
  return typeof age === "number" && typeof sex === "string" ? `${age} y · ${sex}` : null;
}

export function PatientPanel({ samples, analysis, onNavigate }: PatientPanelProps) {
  const { state } = analysis;
  const meta = useMeta();
  const modified = modifiedFields(state).length;
  // BR-15: said as soon as the inputs form a combination the dataset does not contain.
  const unusual = state.values ? coherenceNotes(state.values, meta.features) : [];
  const sample = state.source === "sample" ? samples.find((candidate) => candidate.id === state.sampleId) : undefined;

  return (
    <div className="space-y-4">
      <Card title={PATIENT_HEADING} tour="patient">
        {state.loadedValues ? (
          <div>
            <p className="text-base font-semibold text-ink">{sample ? sample.title : OWN_PATIENT}</p>
            <p className="text-sm text-ink-muted">{sample ? sample.subtitle : describe(state.loadedValues)}</p>
            <p className="mt-2 text-xs text-ink-muted">{sample ? sample.note : OWN_PATIENT_NOTE}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{IDLE_HINT}.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate("patients")} className={`${BUTTON_CLASS} px-2.5 py-1 text-xs`}>
            {CHANGE_PATIENT}
          </button>
          <button type="button" onClick={() => onNavigate("new")} className={`${BUTTON_CLASS} px-2.5 py-1 text-xs`}>
            {NEW_PATIENT}
          </button>
        </div>
        {modified > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <Badge>{modifiedLabel(modified)}</Badge>
            <button type="button" onClick={analysis.resetToOriginal} className={`${BUTTON_CLASS} px-2.5 py-1 text-xs`}>
              {RESET_TO_ORIGINAL}
            </button>
          </div>
        )}
        {unusual.length > 0 && (
          <div role="status" className="mt-3 rounded-lg border border-line bg-canvas p-3 text-xs">
            <p className="font-medium text-ink">{COHERENCE_TITLE}</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-muted">
              {unusual.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-ink-muted">{COHERENCE_NOTE}</p>
          </div>
        )}
      </Card>
      {state.values && (
        <Card title={QUICK_CONTROLS_HEADING} tour="whatif">
          <p className="mb-3 text-xs text-ink-muted">{QUICK_CONTROLS_HINT}</p>
          <QuickControls values={state.values} errors={state.fieldErrors} onEdit={analysis.edit} />
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">{WHAT_IF_NOTE}</p>
        </Card>
      )}
      <Card title={ALL_INPUTS_HEADING}>
        {state.values ? (
          <FeatureForm values={state.values} errors={state.fieldErrors} onEdit={analysis.edit} />
        ) : (
          <p className="text-sm text-ink-muted">{IDLE_HINT}.</p>
        )}
      </Card>
    </div>
  );
}
