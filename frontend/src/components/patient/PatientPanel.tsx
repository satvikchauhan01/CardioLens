// Left column of the Patient analysis tab: choose a patient, try quick what-if changes, and view
// or edit every input.

import type { SamplePatient } from "../../api/types";
import {
  ALL_INPUTS_HEADING,
  IDLE_HINT,
  modifiedLabel,
  PATIENT_HEADING,
  QUICK_CONTROLS_HEADING,
  QUICK_CONTROLS_HINT,
  RESET_TO_ORIGINAL,
  WHAT_IF_NOTE,
} from "../../config/copy";
import { modifiedFields } from "../../state/analysisReducer";
import type { Analysis } from "../../state/useAnalysis";
import { Card } from "../common/Card";
import { Badge, BUTTON_CLASS } from "../common/Feedback";
import { FeatureForm } from "./FeatureForm";
import { QuickControls } from "./QuickControls";
import { SamplePicker } from "./SamplePicker";

interface PatientPanelProps {
  samples: SamplePatient[];
  analysis: Analysis;
}

export function PatientPanel({ samples, analysis }: PatientPanelProps) {
  const { state } = analysis;
  const modified = modifiedFields(state).length;

  return (
    <div className="space-y-4">
      <Card title={PATIENT_HEADING}>
        <SamplePicker
          samples={samples}
          source={state.source}
          sampleId={state.sampleId}
          onLoadSample={analysis.loadSample}
          onLoadTypical={analysis.loadTypical}
        />
        {modified > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <Badge>{modifiedLabel(modified)}</Badge>
            <button type="button" onClick={analysis.resetToOriginal} className={`${BUTTON_CLASS} px-2.5 py-1 text-xs`}>
              {RESET_TO_ORIGINAL}
            </button>
          </div>
        )}
      </Card>
      {state.values && (
        <Card title={QUICK_CONTROLS_HEADING}>
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
