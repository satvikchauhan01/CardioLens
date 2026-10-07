// The Patient analysis tab (PRODUCT_SPEC §4.2): input · 3D viewer · results.
// 1280 px and up: three columns. 768 to 1279 px: viewer on top, input and results below.

import { useEffect, useRef, useState } from "react";
import type { SamplePatient, TargetId } from "../../api/types";
import { VIEWER_HEADING, VIEWER_NOT_BUILT } from "../../config/copy";
import { useMeta } from "../../state/MetaContext";
import { useAnalysis } from "../../state/useAnalysis";
import { Card } from "../common/Card";
import { PatientPanel } from "../patient/PatientPanel";
import { ResultsPanel } from "../results/ResultsPanel";

export function PatientAnalysisView({ samples }: { samples: SamplePatient[] }) {
  const meta = useMeta();
  const analysis = useAnalysis(meta.features);
  const [selectedTarget, setSelectedTarget] = useState<TargetId>("cad");

  // UF-1: the first sample loads by itself on the first visit.
  const { loadSample } = analysis;
  const started = useRef(false);
  useEffect(() => {
    if (started.current || samples.length === 0) return;
    started.current = true;
    loadSample(samples[0]);
  }, [samples, loadSample]);

  return (
    <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
      <PatientPanel samples={samples} analysis={analysis} />
      <Card title={VIEWER_HEADING} className="md:order-first md:col-span-2 xl:order-none xl:col-span-1">
        <p className="text-sm text-ink-muted">{VIEWER_NOT_BUILT}</p>
      </Card>
      <ResultsPanel
        state={analysis.state}
        selectedTarget={selectedTarget}
        onSelectTarget={setSelectedTarget}
        onRetry={analysis.retry}
      />
    </div>
  );
}
