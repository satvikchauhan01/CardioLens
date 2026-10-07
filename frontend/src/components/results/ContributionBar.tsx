// One input's contribution (BR-7, BR-14): measurement, dataset percentile, and a bar that grows
// right when the input raised the estimate and left when it lowered it.

import type { Contribution, FeatureSchema } from "../../api/types";
import { LOWERS, NEUTRAL, PERCENTILE_HINT, RAISES } from "../../config/copy";
import { formatMeasurement, formatRelative, ordinal } from "../../utils/format";

interface ContributionBarProps {
  contribution: Contribution;
  feature: FeatureSchema;
  scale: number; // the largest |relative| in the list; that bar fills its half
}

const EFFECT = { raises: RAISES, lowers: LOWERS, neutral: NEUTRAL } as const;

export function ContributionBar({ contribution, feature, scale }: ContributionBarProps) {
  const { direction, relative, percentile, value } = contribution;
  const width = scale > 0 ? `${(Math.abs(relative) / scale) * 50}%` : "0%";

  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{feature.label}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
          {formatRelative(relative)}
          <span className="sr-only"> ({EFFECT[direction]})</span>
        </span>
      </div>
      <p className="text-xs text-ink-muted">
        {formatMeasurement(feature, value)}
        {percentile !== null && (
          <span title={PERCENTILE_HINT}> · {ordinal(percentile)} percentile</span>
        )}
      </p>
      <div aria-hidden="true" className="relative mt-1.5 h-1.5 rounded-full bg-canvas">
        <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
        {direction !== "neutral" && (
          <span
            className={`absolute inset-y-0 rounded-full ${
              direction === "raises" ? "left-1/2 bg-brand" : "right-1/2 bg-ink-muted"
            }`}
            style={{ width }}
          />
        )}
      </div>
    </li>
  );
}
