// The Patient analysis tab (PRODUCT_SPEC §4.2): input · 3D viewer · results.
// 1280 px and up: three columns. 768 to 1279 px: viewer on top, input and results below.
// Selection, hover and the camera request live here, so the viewer and the panels stay in sync.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SamplePatient, TargetId } from "../../api/types";
import { isVesselId, VESSELS, type VesselId } from "../../config/vessels";
import { ViewerPanel } from "../../scene/ViewerPanel";
import type { ViewId, ViewRequest } from "../../scene/ViewPresets";
import { useMeta } from "../../state/MetaContext";
import { useAnalysis } from "../../state/useAnalysis";
import { PatientPanel } from "../patient/PatientPanel";
import { ResultsPanel } from "../results/ResultsPanel";

interface PatientAnalysisViewProps {
  samples: SamplePatient[];
  resetCount?: number; // each increase runs "Reset demo"
}

export function PatientAnalysisView({ samples, resetCount = 0 }: PatientAnalysisViewProps) {
  const meta = useMeta();
  const analysis = useAnalysis(meta.features);
  const { state, loadSample } = analysis;
  const [selectedTarget, setSelectedTarget] = useState<TargetId>("cad");
  const [hoveredVessel, setHoveredVessel] = useState<VesselId | null>(null);
  const [viewRequest, setViewRequest] = useState<ViewRequest | null>(null);
  const [showGroundTruth, setShowGroundTruth] = useState(false);

  const requestView = useCallback(
    (view: ViewId) => setViewRequest((current) => ({ view, nonce: (current?.nonce ?? 0) + 1 })),
    [],
  );

  // UF-1: the first sample loads by itself on the first visit.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || samples.length === 0) return;
    started.current = true;
    loadSample(samples[0]);
  }, [samples, loadSample]);

  // Reset demo: first sample, no edits, CAD selected, starting camera.
  const handledReset = useRef(resetCount);
  useEffect(() => {
    if (resetCount === handledReset.current || samples.length === 0) return;
    handledReset.current = resetCount;
    loadSample(samples[0]);
    setSelectedTarget("cad");
    setHoveredVessel(null);
    setShowGroundTruth(false);
    requestView("reset");
  }, [resetCount, samples, loadSample, requestView]);

  // Chosen from the list, an artery may be on the far side: turn the heart to show it.
  const selectFromList = useCallback(
    (target: TargetId) => {
      setSelectedTarget(target);
      const vessel = VESSELS.find((candidate) => candidate.id === target);
      if (vessel) requestView(vessel.preferredView);
    },
    [requestView],
  );

  const hoverFromList = useCallback(
    (target: TargetId | null) => setHoveredVessel(target && isVesselId(target) ? target : null),
    [],
  );

  // Not ready: the viewer keeps the colours of the last good result, like the results panel.
  const shown = state.status === "ready" ? state.result : state.lastGoodResult;
  const loadedSample = state.source === "sample" ? samples.find((sample) => sample.id === state.sampleId) : undefined;

  return (
    <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
      <PatientPanel samples={samples} analysis={analysis} />
      <div className="md:order-first md:col-span-2 xl:sticky xl:top-4 xl:order-none xl:col-span-1">
        <ViewerPanel
          predictions={shown?.predictions ?? null}
          status={state.status}
          selectedTarget={selectedTarget}
          hoveredVessel={hoveredVessel}
          viewRequest={viewRequest}
          onRequestView={requestView}
          onSelectTarget={setSelectedTarget}
          onHoverVessel={setHoveredVessel}
        />
      </div>
      <ResultsPanel
        state={state}
        selectedTarget={selectedTarget}
        hoveredTarget={hoveredVessel}
        onSelectTarget={selectFromList}
        onHoverTarget={hoverFromList}
        onRetry={analysis.retry}
        groundTruth={loadedSample?.ground_truth ?? null}
        showGroundTruth={showGroundTruth}
        onShowGroundTruth={setShowGroundTruth}
      />
    </div>
  );
}
