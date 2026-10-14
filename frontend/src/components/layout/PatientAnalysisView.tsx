// The Analysis page (PRODUCT_SPEC §4.2): input · 3D viewer · results for the patient in analysis.
// 1280 px and up: three columns. 768 to 1279 px: viewer on top, input and results below.
// Selection, hover and the camera request live here, so the viewer and the panels stay in sync.
// The patient itself is loaded by the Workspace, from the Patients or the New patient page.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SamplePatient, TargetId } from "../../api/types";
import type { TabId } from "../../config/copy";
import { isVesselId, VESSELS, type VesselId } from "../../config/vessels";
import { ViewerPanel } from "../../scene/ViewerPanel";
import type { ViewId, ViewRequest } from "../../scene/ViewPresets";
import type { Analysis } from "../../state/useAnalysis";
import { PatientPanel } from "../patient/PatientPanel";
import { ResultsPanel } from "../results/ResultsPanel";

interface PatientAnalysisViewProps {
  samples: SamplePatient[];
  analysis: Analysis;
  onNavigate: (tab: TabId) => void;
  active?: boolean; // false while another page is on screen
  resetCount?: number; // each increase runs "Reset demo"
}

export function PatientAnalysisView({
  samples,
  analysis,
  onNavigate,
  active = true,
  resetCount = 0,
}: PatientAnalysisViewProps) {
  const { state } = analysis;
  const [selectedTarget, setSelectedTarget] = useState<TargetId>("cad");
  const [hoveredVessel, setHoveredVessel] = useState<VesselId | null>(null);
  const [viewRequest, setViewRequest] = useState<ViewRequest | null>(null);
  const [showGroundTruth, setShowGroundTruth] = useState(false);

  const requestView = useCallback(
    (view: ViewId) => setViewRequest((current) => ({ view, nonce: (current?.nonce ?? 0) + 1 })),
    [],
  );

  // Reset demo: CAD selected, dataset labels hidden, starting camera (the Workspace reloads the patient).
  const handledReset = useRef(resetCount);
  useEffect(() => {
    if (resetCount === handledReset.current) return;
    handledReset.current = resetCount;
    setSelectedTarget("cad");
    setHoveredVessel(null);
    setShowGroundTruth(false);
    requestView("reset");
  }, [resetCount, requestView]);

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
      <PatientPanel samples={samples} analysis={analysis} onNavigate={onNavigate} />
      <div className="md:order-first md:col-span-2 xl:sticky xl:top-4 xl:order-none xl:col-span-1">
        <ViewerPanel
          predictions={shown?.predictions ?? null}
          status={state.status}
          selectedTarget={selectedTarget}
          hoveredVessel={hoveredVessel}
          viewRequest={viewRequest}
          active={active}
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
