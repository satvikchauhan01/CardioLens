// One input's contribution (BR-7, BR-14): measurement, dataset percentile, and a bar that grows
// right when the input raised the estimate and left when it lowered it. While the row is pointed
// at or focused, a note beside it spells the same contribution out.

import { useState } from "react";
import type { Contribution, FeatureSchema, ShapUnits } from "../../api/types";
import {
  CONTRIBUTION_EFFECT,
  LOWERS,
  NEUTRAL,
  PERCENTILE_HINT,
  percentileLine,
  RAISES,
  rangeLine,
  SHAP_UNIT_LABELS,
  shapLine,
  shareLine,
} from "../../config/copy";
import { formatBound, formatMeasurement, formatRelative, ordinal } from "../../utils/format";

interface ContributionBarProps {
  contribution: Contribution;
  feature: FeatureSchema;
  scale: number; // the largest |relative| in the list; that bar fills its half
  units?: ShapUnits; // what the model's SHAP values are measured in
}

const EFFECT = { raises: RAISES, lowers: LOWERS, neutral: NEUTRAL } as const;

const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(3)}`;

/** The range a numeric input has in the dataset, with its unit: "15 to 60%". */
function datasetRange(feature: FeatureSchema): string | null {
  if (feature.type !== "numeric" || feature.min === null || feature.max === null) return null;
  const step = feature.step ?? 1;
  const high = formatBound(feature.max, step, "max");
  const unit = !feature.unit ? "" : feature.unit === "%" ? "%" : ` ${feature.unit}`;
  return rangeLine(formatBound(feature.min, step, "min"), `${high}${unit}`);
}

export function ContributionBar({ contribution, feature, scale, units }: ContributionBarProps) {
  const [open, setOpen] = useState(false);
  const { direction, relative, percentile, value, shap } = contribution;
  const width = scale > 0 ? `${(Math.abs(relative) / scale) * 50}%` : "0%";
  // The share is sent with four decimals: one that rounds to 0 can still belong to an input that
  // moved the estimate a little, which BR-14 prints as "<1%".
  const share = relative === 0 && direction !== "neutral" ? "<1%" : formatRelative(relative);
  const detailsId = `contribution-${feature.id}`;
  const range = datasetRange(feature);

  return (
    <li
      tabIndex={0}
      aria-describedby={open ? detailsId : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      className="relative -mx-1.5 rounded-md px-1.5 py-2 transition-colors hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{feature.label}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
          {share}
          <span className="sr-only"> ({EFFECT[direction]})</span>
        </span>
      </div>
      <p className="text-xs text-ink-muted">
        {formatMeasurement(feature, value)}
        {percentile !== null && (
          <span title={PERCENTILE_HINT}> · {ordinal(percentile)} percentile</span>
        )}
      </p>
      <div aria-hidden="true" className="relative mt-1.5 h-2 rounded-full bg-canvas ring-1 ring-line/60">
        <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
        {direction !== "neutral" && (
          <span
            className={`absolute inset-y-0 rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
              direction === "raises" ? "left-1/2 bg-brand" : "right-1/2 bg-ink-muted"
            }`}
            style={{ width }}
          />
        )}
      </div>
      {open && (
        // Beside the list where there is room (three columns), below the row otherwise. It never
        // takes the pointer, so the rows it covers can still be reached.
        <div
          id={detailsId}
          role="tooltip"
          className="pointer-events-none absolute inset-x-0 top-full z-20 animate-pop rounded-lg border border-line bg-surface p-3 text-xs shadow-lg motion-reduce:animate-none xl:inset-x-auto xl:right-full xl:top-0 xl:mr-5 xl:w-72"
        >
          <p className="font-semibold text-ink">
            {feature.label}: {formatMeasurement(feature, value)}
          </p>
          <p className="mt-1 font-medium text-ink">{CONTRIBUTION_EFFECT[direction]}</p>
          <ul className="mt-1 space-y-0.5 text-ink-muted">
            <li>{shareLine(share)}</li>
            {units && <li>{shapLine(signed(shap), SHAP_UNIT_LABELS[units])}</li>}
            {percentile !== null && <li>{percentileLine(percentile)}</li>}
            {range && <li>{range}</li>}
          </ul>
          {feature.description && <p className="mt-1.5 border-t border-line pt-1.5 text-ink-muted">{feature.description}</p>}
        </div>
      )}
    </li>
  );
}
