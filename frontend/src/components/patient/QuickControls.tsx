// F7, BR-9: the most influential inputs as quick controls. A numeric input gets a slider next to
// its number field, a yes/no input a switch, and a categorical input a segmented control. They edit
// the same values as the full form below, so the two always agree.

import type { FeatureSchema } from "../../api/types";
import { QUICK_CONTROLS_HEADING } from "../../config/copy";
import { featureById, useMeta } from "../../state/MetaContext";
import type { FormValue, FormValues } from "../../state/validation";
import { formatBound } from "../../utils/format";
import { FeatureField } from "./FeatureField";

interface QuickControlsProps {
  values: FormValues;
  errors: Record<string, string>;
  onEdit: (field: string, value: FormValue) => void;
}

const ID_PREFIX = "quick";

function Slider({ feature, value, onEdit }: { feature: FeatureSchema; value: FormValue; onEdit: QuickControlsProps["onEdit"] }) {
  const step = feature.step ?? 1;
  // Slider stops are whole steps inside the dataset range.
  const min = Number(formatBound(feature.min ?? 0, step, "min"));
  const max = Number(formatBound(feature.max ?? 0, step, "max"));

  return (
    <input
      type="range"
      aria-label={`${feature.label} slider`}
      min={min}
      max={max}
      step={step}
      value={typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min}
      onChange={(event) => onEdit(feature.id, Number(event.target.value))}
      className="mt-1 w-full cursor-pointer accent-brand"
    />
  );
}

function Segmented({ feature, value, onEdit }: { feature: FeatureSchema; value: FormValue; onEdit: QuickControlsProps["onEdit"] }) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-ink">{feature.label}</legend>
      <div className="mt-1 flex overflow-hidden rounded-md border border-line">
        {(feature.categories ?? []).map((category) => {
          const chosen = value === category;
          return (
            <label
              key={category}
              className={`flex-1 cursor-pointer px-2 py-1.5 text-center text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand ${
                chosen ? "bg-brand font-medium text-surface" : "bg-surface text-ink hover:bg-brand-soft"
              }`}
            >
              <input
                type="radio"
                name={`${ID_PREFIX}-${feature.id}`}
                value={category}
                checked={chosen}
                onChange={() => onEdit(feature.id, category)}
                className="sr-only"
              />
              {category}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function QuickControls({ values, errors, onEdit }: QuickControlsProps) {
  const meta = useMeta();
  const features = meta.quick_controls.flatMap((id) => featureById(meta, id) ?? []);

  return (
    <div role="group" aria-label={QUICK_CONTROLS_HEADING} className="space-y-3">
      {features.map((feature) => {
        const value = values[feature.id] ?? null;
        if (feature.type === "categorical" || feature.type === "ordinal") {
          return <Segmented key={feature.id} feature={feature} value={value} onEdit={onEdit} />;
        }
        return (
          <div key={feature.id}>
            <FeatureField
              feature={feature}
              value={value}
              error={errors[feature.id]}
              onEdit={onEdit}
              idPrefix={ID_PREFIX}
            />
            {feature.type === "numeric" && <Slider feature={feature} value={value} onEdit={onEdit} />}
          </div>
        );
      })}
    </div>
  );
}
