// The five pages and the one analysis they share. A page is built when it is first opened and
// then stays mounted, so the patient in analysis, a half-filled new patient and the loaded
// evaluation survive a change of page, and the first page does not wait for the others.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { FeatureValue, SamplePatient } from "../../api/types";
import type { TabId } from "../../config/copy";
import { useMeta } from "../../state/MetaContext";
import { useAnalysis } from "../../state/useAnalysis";
import { useSampleEstimates } from "../../state/useSampleEstimates";
import { MethodView } from "../evaluation/MethodView";
import { HomeView } from "../home/HomeView";
import { NewPatientView } from "../patients/NewPatientView";
import { PatientsView } from "../patients/PatientsView";
import { PatientAnalysisView } from "./PatientAnalysisView";

interface WorkspaceProps {
  samples: SamplePatient[];
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  onStartTour: () => void;
  resetCount: number; // each increase runs "Reset demo"
}

export function Workspace({ samples, activeTab, onNavigate, onStartTour, resetCount }: WorkspaceProps) {
  const meta = useMeta();
  const analysis = useAnalysis(meta.features);
  const { state, loadSample, loadCustom } = analysis;

  // UF-1: the first sample is in analysis from the first visit on, whichever page is open.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || samples.length === 0) return;
    started.current = true;
    loadSample(samples[0]);
  }, [samples, loadSample]);

  // Reset demo: the first sample again, with no edits.
  const handledReset = useRef(resetCount);
  useEffect(() => {
    if (resetCount === handledReset.current || samples.length === 0) return;
    handledReset.current = resetCount;
    loadSample(samples[0]);
  }, [resetCount, samples, loadSample]);

  const analyseSample = useCallback(
    (sample: SamplePatient) => {
      loadSample(sample);
      onNavigate("analysis");
    },
    [loadSample, onNavigate],
  );

  const analyseOwn = useCallback(
    (values: Record<string, FeatureValue>) => {
      loadCustom(values);
      onNavigate("analysis");
    },
    [loadCustom, onNavigate],
  );

  const toNewPatient = useCallback(() => onNavigate("new"), [onNavigate]);

  // The pages opened so far. Updated while rendering, so a page appears in the same pass.
  const [opened, setOpened] = useState<ReadonlySet<TabId>>(() => new Set([activeTab]));
  if (!opened.has(activeTab)) setOpened(new Set(opened).add(activeTab));
  const built = (tab: TabId) => tab === activeTab || opened.has(tab);

  // The estimates on the patient cards are asked for when the Patients page is first opened.
  const sampleEstimates = useSampleEstimates(samples, built("patients"));

  // A page fades in each time it is shown: the animation starts again whenever it stops being hidden.
  const page = (tab: TabId, content: () => ReactNode) => (
    <div hidden={activeTab !== tab} className="animate-page motion-reduce:animate-none">
      {built(tab) && content()}
    </div>
  );

  return (
    <>
      {page("home", () => (
        <HomeView
          samples={samples}
          state={state}
          active={activeTab === "home"}
          onNavigate={onNavigate}
          onStartTour={onStartTour}
        />
      ))}
      {page("patients", () => (
        <PatientsView
          samples={samples}
          loadedSampleId={state.source === "sample" ? state.sampleId : null}
          estimates={sampleEstimates.estimates}
          estimatesStatus={sampleEstimates.status}
          onRetryEstimates={sampleEstimates.retry}
          onChoose={analyseSample}
          onNewPatient={toNewPatient}
        />
      ))}
      {page("new", () => (
        <NewPatientView samples={samples} onAnalyse={analyseOwn} />
      ))}
      {page("analysis", () => (
        <PatientAnalysisView
          samples={samples}
          analysis={analysis}
          active={activeTab === "analysis"}
          onNavigate={onNavigate}
          resetCount={resetCount}
        />
      ))}
      {page("method", () => (
        <MethodView active={activeTab === "method"} />
      ))}
    </>
  );
}
