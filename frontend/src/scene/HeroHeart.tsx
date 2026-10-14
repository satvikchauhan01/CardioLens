// The heart on the Home page: the same model and the same risk colours as the viewer on the
// Analysis page, turning slowly, with its labels. It can be turned by hand; selecting and
// zooming belong to the Analysis page. It exists only while the Home page is on screen, so there
// is never more than one 3D scene at a time.

import { lazy, Suspense, useRef, useState } from "react";
import type { TargetId, TargetPrediction } from "../api/types";
import { Spinner } from "../components/common/Feedback";
import { Icon } from "../components/common/Icon";
import { NO_ESTIMATE, VIEWER_LOADING } from "../config/copy";
import { riskColor } from "../config/risk";
import { VESSELS } from "../config/vessels";
import { useMeta } from "../state/MetaContext";
import { isWebGLAvailable, usePrefersReducedMotion } from "../utils/environment";
import { formatPercent } from "../utils/format";
import type { LabelElements } from "./labelAnchors";
import { ModelErrorBoundary } from "./ModelErrorBoundary";

const HeartViewer = lazy(() => import("./HeartViewer"));

const nothing = () => undefined;

interface HeroHeartProps {
  predictions: Record<TargetId, TargetPrediction> | null; // the estimates of the patient in analysis
  active: boolean; // the Home page is the one on screen
}

export function HeroHeart({ predictions, active }: HeroHeartProps) {
  const meta = useMeta();
  const reducedMotion = usePrefersReducedMotion();
  const [webgl, setWebgl] = useState(isWebGLAvailable);
  const labelElements = useRef<LabelElements>({});

  const vessels = VESSELS.map((config) => {
    const short = meta.targets.find((target) => target.id === config.id)?.short_label ?? config.id.toUpperCase();
    const prediction = predictions?.[config.id];
    const percent = prediction ? formatPercent(prediction.probability) : null;
    return {
      id: config.id,
      label: percent ? `${short} ${percent}` : short,
      spoken: `${short} ${percent ?? NO_ESTIMATE}`,
      color: prediction ? riskColor(prediction.probability) : null,
      rim: config.rimColor,
    };
  });

  if (!webgl) {
    // Without 3D graphics the Home page shows a plain mark; the Analysis page has the flat drawing.
    return (
      <div aria-hidden="true" className="heart-stage flex h-72 items-center justify-center rounded-2xl border border-line lg:h-96">
        <Icon name="heart" className="size-24 text-accent" />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Turning heart with the three coronary arteries coloured by estimated probability. ${vessels
        .map((vessel) => vessel.spoken)
        .join(". ")}.`}
      className="heart-stage relative h-72 cursor-grab overflow-hidden rounded-2xl border border-line active:cursor-grabbing lg:h-96"
    >
      {active && (
        <ModelErrorBoundary fallback={null} onError={() => setWebgl(false)}>
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Spinner label={VIEWER_LOADING} />
              </div>
            }
          >
            <HeartViewer
              colors={Object.fromEntries(vessels.flatMap((vessel) => (vessel.color ? [[vessel.id, vessel.color]] : [])))}
              labelElements={labelElements}
              selectedVessel={null}
              hoveredVessel={null}
              viewRequest={null}
              reducedMotion={reducedMotion}
              turning={!reducedMotion}
              endlessTurn
              zoom={false}
              onSelectVessel={nothing}
              onSelectHeart={nothing}
              onHoverVessel={nothing}
              onModelError={nothing}
            />
          </Suspense>
        </ModelErrorBoundary>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
        {vessels.map((vessel) => (
          <span
            key={vessel.id}
            ref={(element) => {
              labelElements.current[vessel.id] = element;
            }}
            data-hero-label={vessel.id}
            style={{ opacity: 0, borderLeftColor: vessel.rim }}
            className="absolute left-0 top-0 whitespace-nowrap rounded-md border border-l-4 border-line bg-surface/95 px-1.5 py-0.5 text-xs font-medium text-ink shadow-sm transition-opacity motion-reduce:transition-none"
          >
            {vessel.label}
          </span>
        ))}
      </div>
    </div>
  );
}
