// Client-side input validation, mirroring the backend's BR-13 checks and messages.

import type { FeatureSchema, FeatureValue } from "../api/types";
import { formatBound } from "../utils/format";

/** A form value; null means the field is empty. */
export type FormValue = FeatureValue | null;
export type FormValues = Record<string, FormValue>;

export const REQUIRED = "This value is required.";
export const NOT_A_NUMBER = "Must be a number.";
export const NOT_FINITE = "Must be a finite number.";
export const NOT_INTEGER = "Must be a whole number.";
export const NOT_BOOLEAN = "Must be true or false.";

export function rangeMessage(feature: FeatureSchema): string {
  const step = feature.step ?? 1;
  const low = formatBound(feature.min ?? 0, step, "min");
  const high = formatBound(feature.max ?? 0, step, "max");
  return `Must be between ${low} and ${high} (range seen in the dataset).`;
}

export function allowedMessage(feature: FeatureSchema): string {
  return `Must be one of: ${(feature.categories ?? []).join(", ")}.`;
}

function problemWith(feature: FeatureSchema, value: FormValue | undefined): string | null {
  if (value === null || value === undefined) return REQUIRED;
  if (feature.type === "numeric") {
    if (typeof value !== "number") return NOT_A_NUMBER;
    if (!Number.isFinite(value)) return NOT_FINITE;
    if (feature.integer && !Number.isInteger(value)) return NOT_INTEGER;
    if (value < (feature.min ?? -Infinity) || value > (feature.max ?? Infinity)) {
      return rangeMessage(feature);
    }
    return null;
  }
  if (feature.type === "binary") return typeof value === "boolean" ? null : NOT_BOOLEAN;
  return typeof value === "string" && (feature.categories ?? []).includes(value)
    ? null
    : allowedMessage(feature);
}

/** Field id -> message for every invalid field; empty when the values can be sent. */
export function validateValues(values: FormValues, features: FeatureSchema[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const feature of features) {
    const problem = problemWith(feature, values[feature.id]);
    if (problem) errors[feature.id] = problem;
  }
  return errors;
}
