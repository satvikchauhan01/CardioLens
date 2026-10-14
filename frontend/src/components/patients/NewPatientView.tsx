// The New patient page (F2): a patient of the user's own. The form is generated from the feature
// schema, one card per clinical group, and starts from typical values or from a sample patient.
// Nothing is sent until the values are valid and the user asks for the analysis.

import { useState } from "react";
import type { FeatureSchema, FeatureValue, SamplePatient } from "../../api/types";
import {
  ANALYSE_OWN,
  COHERENCE_NOTE,
  COHERENCE_TITLE,
  fixFirst,
  NEW_PATIENT,
  newPatientIntro,
  START_FROM,
  TYPICAL_VALUES,
} from "../../config/copy";
import { coherenceNotes } from "../../state/coherence";
import { useMeta } from "../../state/MetaContext";
import { validateValues, type FormValue, type FormValues } from "../../state/validation";
import { Card } from "../common/Card";
import { FeatureField } from "../patient/FeatureField";

const TYPICAL = "typical";
const ID_PREFIX = "new"; // the same inputs are also on the Analysis page

interface NewPatientViewProps {
  samples: SamplePatient[];
  onAnalyse: (values: Record<string, FeatureValue>) => void;
}

const typicalValues = (features: FeatureSchema[]): FormValues =>
  Object.fromEntries(features.map((feature) => [feature.id, feature.default]));

export function NewPatientView({ samples, onAnalyse }: NewPatientViewProps) {
  const meta = useMeta();
  const [start, setStart] = useState(TYPICAL);
  const [values, setValues] = useState<FormValues>(() => typicalValues(meta.features));

  const errors = validateValues(values, meta.features);
  const invalid = Object.keys(errors).length;
  const unusual = coherenceNotes(values, meta.features);

  function startFrom(choice: string) {
    const sample = samples.find((candidate) => candidate.id === choice);
    setStart(choice);
    setValues(sample ? sample.features : typicalValues(meta.features));
  }

  const edit = (field: string, value: FormValue) => setValues((current) => ({ ...current, [field]: value }));

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid === 0) onAnalyse(values as Record<string, FeatureValue>);
      }}
    >
      <Card title={NEW_PATIENT}>
        <p className="text-sm text-ink-muted">{newPatientIntro(meta.features.length)}</p>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink">
          <span className="font-medium">{START_FROM}</span>
          <select
            value={start}
            onChange={(event) => startFrom(event.target.value)}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          >
            <option value={TYPICAL}>{TYPICAL_VALUES}</option>
            {samples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.title} ({sample.subtitle})
              </option>
            ))}
          </select>
        </label>
      </Card>

      {meta.feature_groups.map((group) => {
        const features = meta.features.filter((feature) => feature.group === group.id);
        const switches = features.filter((feature) => feature.type === "binary");
        const others = features.filter((feature) => feature.type !== "binary");
        const field = (feature: FeatureSchema) => (
          <FeatureField
            key={feature.id}
            feature={feature}
            value={values[feature.id] ?? null}
            error={errors[feature.id]}
            onEdit={edit}
            idPrefix={ID_PREFIX}
          />
        );
        return (
          <Card key={group.id} title={group.label}>
            <div role="group" aria-label={group.label} className="space-y-4">
              {others.length > 0 && (
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{others.map(field)}</div>
              )}
              {switches.length > 0 && (
                <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{switches.map(field)}</div>
              )}
            </div>
          </Card>
        );
      })}

      <Card>
        {unusual.length > 0 && (
          <div role="status" className="mb-3 rounded-lg border border-line bg-canvas p-3 text-xs">
            <p className="font-medium text-ink">{COHERENCE_TITLE}</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-muted">
              {unusual.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-ink-muted">{COHERENCE_NOTE}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={invalid > 0}
            className="cursor-pointer rounded-md border border-brand bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-ink-muted"
          >
            {ANALYSE_OWN}
          </button>
          {invalid > 0 && (
            <p role="alert" className="text-sm font-medium text-danger">
              {fixFirst(invalid)}
            </p>
          )}
        </div>
      </Card>
    </form>
  );
}
