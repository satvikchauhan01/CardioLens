// Centre column of the Patient analysis tab: the 3D heart (or the 2D schematic without WebGL),
// its tooltip, view presets, labels toggle and legend. It talks to the rest of the app only
// through props and callbacks (ARCHITECTURE C2).

import { lazy, Suspense, useCallback, useRef, useState } from "react";
import type { TargetId, TargetPrediction } from "../api/types";
import { AnalysisStatus } from "../components/common/AnalysisStatus";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Feedback";
import {
  LABELS_TOGGLE,
  MODEL_NOTE,
  MODEL_UNAVAILABLE_NOTICE,
  NO_ESTIMATE,
  SCHEMATIC_NOTICE,
  STAND_IN_NOTE,
  VIEWER_HEADING,
  VIEWER_HINT,
  VIEWER_LOADING,
} from "../config/copy";
import { riskColor } from "../config/risk";
import { HEART_MODEL_URL, VESSELS, type VesselId } from "../config/vessels";
import type { AnalysisState } from "../state/analysisReducer";
import { useMeta } from "../state/MetaContext";
import { isWebGLAvailable, usePrefersReducedMotion } from "../utils/environment";
import { formatPercent } from "../utils/format";
import type { ArteryPointer } from "./Artery";
import type { LabelElements } from "./labelAnchors";
import { Legend } from "./Legend";
import { VesselSchematic2D } from "./VesselSchematic2D";
import { ViewPresets, type ViewId, type ViewRequest } from "./ViewPresets";

const HeartViewer = lazy(() => import("./HeartViewer"));

interface ViewerPanelProps {
  predictions: Record<TargetId, TargetPrediction> | null; // the estimates on display, if any
  status: AnalysisState["status"];
  selectedTarget: TargetId;
  hoveredVessel: VesselId | null;
  viewRequest: ViewRequest | null;
  onRequestView: (view: ViewId) => void;
  onSelectTarget: (target: TargetId) => void;
  onHoverVessel: (vessel: VesselId | null) => void;
}

export function ViewerPanel({
  predictions,
  status,
  selectedTarget,
  hoveredVessel,
  viewRequest,
  onRequestView,
  onSelectTarget,
  onHoverVessel,
}: ViewerPanelProps) {
  const meta = useMeta();
  const reducedMotion = usePrefersReducedMotion();
  const [webgl] = useState(isWebGLAvailable);
  const [showLabels, setShowLabels] = useState(true);
  const [modelFailed, setModelFailed] = useState(false);
  const [pointerVessel, setPointerVessel] = useState<VesselId | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const labelElements = useRef<LabelElements>({});

  const levelLabels = Object.fromEntries(meta.risk_levels.map((level) => [level.id, level.label]));
  const vessels = VESSELS.map((config) => {
    const target = meta.targets.find((candidate) => candidate.id === config.id);
    const prediction = predictions?.[config.id];
    const short = target?.short_label ?? config.id.toUpperCase();
    const percent = prediction ? formatPercent(prediction.probability) : null;
    return {
      id: config.id,
      name: `${short} · ${target?.label ?? short} · ${percent ?? NO_ESTIMATE}`,
      label: percent ? `${short} ${percent}` : short,
      color: prediction ? riskColor(prediction.probability) : null,
      spoken: prediction
        ? `${short} ${percent}, ${levelLabels[prediction.risk_level].toLowerCase()}`
        : `${short} ${NO_ESTIMATE}`,
    };
  });
  const selectedVessel = VESSELS.some((vessel) => vessel.id === selectedTarget)
    ? (selectedTarget as VesselId)
    : null;
  const textAlternative = `Heart with the three coronary arteries coloured by estimated probability. ${vessels
    .map((vessel) => vessel.spoken)
    .join(". ")}.`;

  // The heart model is on screen unless there is none, it failed, or the 2D schematic is shown.
  const showsModel = webgl && HEART_MODEL_URL !== null && !modelFailed;

  const selectHeart = useCallback(() => onSelectTarget("cad"), [onSelectTarget]);

  // The tooltip follows the pointer by moving the element directly, so pointer moves do not
  // re-render anything; state changes only when the pointer enters or leaves an artery.
  const hoverInCanvas = useCallback(
    (vessel: VesselId | null, pointer?: ArteryPointer) => {
      setPointerVessel(vessel);
      onHoverVessel(vessel);
      if (!vessel || !pointer || !frame.current || !tooltip.current) return;
      const box = frame.current.getBoundingClientRect();
      const x = Math.min(pointer.clientX - box.left + 14, box.width - tooltip.current.offsetWidth - 4);
      const y = Math.max(4, pointer.clientY - box.top - 34);
      tooltip.current.style.transform = `translate(${Math.max(4, x)}px, ${y}px)`;
    },
    [onHoverVessel],
  );

  return (
    <Card title={VIEWER_HEADING} aside={<AnalysisStatus status={status} />}>
      <div
        ref={frame}
        className="relative h-[26rem] overflow-hidden rounded-lg bg-canvas xl:h-[34rem]"
        style={{ cursor: webgl ? (pointerVessel ? "pointer" : "grab") : undefined }}
      >
        {webgl ? (
          <div role="img" aria-label={textAlternative} className="absolute inset-0">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Spinner label={VIEWER_LOADING} />
                </div>
              }
            >
              <HeartViewer
                colors={Object.fromEntries(vessels.flatMap((v) => (v.color ? [[v.id, v.color]] : [])))}
                labelElements={labelElements}
                selectedVessel={selectedVessel}
                hoveredVessel={hoveredVessel}
                viewRequest={viewRequest}
                reducedMotion={reducedMotion}
                onSelectVessel={onSelectTarget}
                onSelectHeart={selectHeart}
                onHoverVessel={hoverInCanvas}
                onModelError={() => setModelFailed(true)}
              />
            </Suspense>
            {/* Positioned by the scene every frame it draws; invisible until the first one. */}
            <div aria-hidden="true" hidden={!showLabels} className="pointer-events-none absolute inset-0 z-10">
              {vessels.map((vessel) => (
                <span
                  key={vessel.id}
                  ref={(element) => {
                    labelElements.current[vessel.id] = element;
                  }}
                  data-label={vessel.id}
                  style={{ opacity: 0 }}
                  className="absolute left-0 top-0 whitespace-nowrap rounded-md border border-line bg-surface/95 px-1.5 py-0.5 text-xs font-medium text-ink shadow-sm transition-opacity motion-reduce:transition-none"
                >
                  {vessel.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <VesselSchematic2D
            vessels={vessels}
            selectedVessel={selectedVessel}
            hoveredVessel={hoveredVessel}
            onSelectVessel={onSelectTarget}
            onSelectHeart={selectHeart}
            onHoverVessel={onHoverVessel}
          />
        )}
        <div
          ref={tooltip}
          role="tooltip"
          hidden={!pointerVessel}
          className="pointer-events-none absolute left-0 top-0 z-30 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-surface shadow-md"
        >
          {vessels.find((vessel) => vessel.id === pointerVessel)?.name}
        </div>
      </div>

      {webgl && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <ViewPresets onRequestView={onRequestView} />
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(event) => setShowLabels(event.target.checked)}
              className="size-3.5 accent-brand"
            />
            {LABELS_TOGGLE}
          </label>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-muted">{webgl ? VIEWER_HINT : SCHEMATIC_NOTICE}</p>
      {modelFailed && (
        <p role="status" className="mt-1 text-xs font-medium text-ink">
          {MODEL_UNAVAILABLE_NOTICE}
        </p>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <Legend />
        <p className="mt-1 text-xs text-ink-muted">{showsModel ? MODEL_NOTE : STAND_IN_NOTE}</p>
      </div>
    </Card>
  );
}
