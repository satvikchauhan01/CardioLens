// One schema-driven input: number field, yes/no switch, or select, chosen by the feature's type.

import { useState } from "react";
import type { FeatureSchema } from "../../api/types";
import { NO, YES } from "../../config/copy";
import type { FormValue } from "../../state/validation";
import { formatBound, formatNumber } from "../../utils/format";

interface FeatureFieldProps {
  feature: FeatureSchema;
  value: FormValue;
  error?: string;
  onEdit: (field: string, value: FormValue) => void;
  idPrefix?: string; // an input may be shown twice (quick controls and the full form)
}

const INPUT_CLASS =
  "w-full rounded-md border bg-surface px-2 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand";

const fieldId = (feature: FeatureSchema, prefix = "field") => `${prefix}-${feature.id}`;

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
      {error}
    </p>
  );
}

function toDraft(feature: FeatureSchema, value: FormValue): string {
  return typeof value === "number" ? formatNumber(value, feature.step ?? 1) : "";
}

function fromDraft(draft: string): number | null {
  return draft.trim() === "" ? null : Number(draft);
}

function NumberField({ feature, value, error, onEdit, idPrefix }: FeatureFieldProps) {
  // The text being typed is kept separately so that "12." or "0.50" is not rewritten mid-edit.
  const [draft, setDraft] = useState(() => toDraft(feature, value));
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    // The value changed from outside (a patient was loaded, a slider moved): show it.
    setSeenValue(value);
    if (fromDraft(draft) !== value) setDraft(toDraft(feature, value));
  }

  const step = feature.step ?? 1;
  const range = `${formatBound(feature.min ?? 0, step, "min")}–${formatBound(feature.max ?? 0, step, "max")}`;
  const id = fieldId(feature, idPrefix);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink">
        {feature.label}
        {feature.unit && <span className="font-normal text-ink-muted"> ({feature.unit})</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : `${id}-range`}
        title={feature.description ?? undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          onEdit(feature.id, fromDraft(event.target.value));
        }}
        className={`mt-1 ${INPUT_CLASS} ${error ? "border-danger" : "border-line"}`}
      />
      {error ? (
        <FieldError id={id} error={error} />
      ) : (
        <p id={`${id}-range`} className="mt-1 text-xs text-ink-muted">
          {range}
        </p>
      )}
    </div>
  );
}

function SwitchField({ feature, value, error, onEdit, idPrefix }: FeatureFieldProps) {
  const id = fieldId(feature, idPrefix);
  return (
    <div>
      <label
        htmlFor={id}
        title={feature.description ?? undefined}
        className="flex cursor-pointer items-center justify-between gap-3 py-1"
      >
        <span className="text-sm text-ink">{feature.label}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="w-6 text-right text-xs text-ink-muted">{value === true ? YES : NO}</span>
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={value === true}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onEdit(feature.id, event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform peer-checked:after:translate-x-4 motion-reduce:transition-none motion-reduce:after:transition-none"
          />
        </span>
      </label>
      <FieldError id={id} error={error} />
    </div>
  );
}

function SelectField({ feature, value, error, onEdit, idPrefix }: FeatureFieldProps) {
  const id = fieldId(feature, idPrefix);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink">
        {feature.label}
      </label>
      <select
        id={id}
        value={typeof value === "string" ? value : ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        title={feature.description ?? undefined}
        onChange={(event) => onEdit(feature.id, event.target.value)}
        className={`mt-1 ${INPUT_CLASS} ${error ? "border-danger" : "border-line"}`}
      >
        {(feature.categories ?? []).map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <FieldError id={id} error={error} />
    </div>
  );
}

export function FeatureField(props: FeatureFieldProps) {
  if (props.feature.type === "numeric") return <NumberField {...props} />;
  if (props.feature.type === "binary") return <SwitchField {...props} />;
  return <SelectField {...props} />;
}
