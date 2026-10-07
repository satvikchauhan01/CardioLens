// F2: the form is generated from the feature schema, one collapsible section per clinical group.

import { useState } from "react";
import type { FeatureGroupId, FeatureSchema } from "../../api/types";
import { useMeta } from "../../state/MetaContext";
import type { FormValue, FormValues } from "../../state/validation";
import { FeatureField } from "./FeatureField";

interface FeatureFormProps {
  values: FormValues;
  errors: Record<string, string>;
  onEdit: (field: string, value: FormValue) => void;
}

function attentionLabel(count: number): string {
  return count === 1 ? "1 needs attention" : `${count} need attention`;
}

export function FeatureForm({ values, errors, onEdit }: FeatureFormProps) {
  const meta = useMeta();
  const [opened, setOpened] = useState<ReadonlySet<FeatureGroupId>>(
    () => new Set(meta.feature_groups.slice(0, 1).map((group) => group.id)),
  );

  function setOpen(group: FeatureGroupId, open: boolean) {
    setOpened((current) => {
      if (current.has(group) === open) return current;
      const next = new Set(current);
      if (open) next.add(group);
      else next.delete(group);
      return next;
    });
  }

  return (
    <div className="divide-y divide-line rounded-lg border border-line">
      {meta.feature_groups.map((group) => {
        const features = meta.features.filter((feature) => feature.group === group.id);
        const invalid = features.filter((feature) => errors[feature.id]).length;
        // A section with a field error is always shown, so "fix highlighted fields" can be acted on.
        const open = opened.has(group.id) || invalid > 0;
        const switches = features.filter((feature) => feature.type === "binary");
        const others = features.filter((feature) => feature.type !== "binary");
        const field = (feature: FeatureSchema) => (
          <FeatureField
            key={feature.id}
            feature={feature}
            value={values[feature.id] ?? null}
            error={errors[feature.id]}
            onEdit={onEdit}
          />
        );

        return (
          <details
            key={group.id}
            open={open}
            onToggle={(event) => setOpen(group.id, event.currentTarget.open)}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
              <span>{group.label}</span>
              <span className={`text-xs font-normal ${invalid ? "text-danger" : "text-ink-muted"}`}>
                {invalid ? attentionLabel(invalid) : `${features.length} inputs`}
              </span>
            </summary>
            <div className="space-y-3 px-3 pb-3">
              {others.length > 0 && <div className="grid grid-cols-2 gap-x-3 gap-y-3">{others.map(field)}</div>}
              {switches.length > 0 && <div>{switches.map(field)}</div>}
            </div>
          </details>
        );
      })}
    </div>
  );
}
