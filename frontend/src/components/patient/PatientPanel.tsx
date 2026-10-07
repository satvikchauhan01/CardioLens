// Left column of the Patient analysis tab: choose a patient, then view or edit the inputs.

import type { SamplePatient } from "../../api/types";
import { ALL_INPUTS_HEADING, IDLE_HINT, PATIENT_HEADING } from "../../config/copy";
import type { Analysis } from "../../state/useAnalysis";
import { Card } from "../common/Card";
import { FeatureForm } from "./FeatureForm";
import { SamplePicker } from "./SamplePicker";

interface PatientPanelProps {
  samples: SamplePatient[];
  analysis: Analysis;
}

export function PatientPanel({ samples, analysis }: PatientPanelProps) {
  const { state } = analysis;

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
      </Card>
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
