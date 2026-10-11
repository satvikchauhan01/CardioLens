// BR-15: inputs that are tied together in the dataset but are separate fields in the form. A
// what-if change can describe a patient that no patient in the dataset resembles. The app then
// says so; it changes no input and blocks nothing.
//
// Every rule is a fact about the 303 rows, checked by backend/tests/test_dataset.py
// (test_relations_between_inputs_that_the_app_points_out).

import type { FeatureSchema } from "../api/types";
import { formatNumber } from "../utils/format";
import type { FormValues } from "./validation";

/** kg/m². Wider than the gap in the typical values, which are medians of each input on its own. */
export const BMI_TOLERANCE = 0.5;
export const OBESITY_ABOVE_BMI = 25;

const CHEST_PAIN_TYPES = ["typical_chest_pain", "atypical", "nonanginal"];

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** "A", "A and B", "A, B and C" */
function listed(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** One sentence per combination of the current inputs that does not occur in the dataset. */
export function coherenceNotes(values: FormValues, features: FeatureSchema[]): string[] {
  const label = (id: string) => features.find((feature) => feature.id === id)?.label ?? id;
  const notes: string[] = [];

  const { weight, length: height, bmi, obesity } = values;
  if (isNumber(weight) && isNumber(height) && isNumber(bmi) && height > 0) {
    const fromSize = weight / (height / 100) ** 2;
    if (Math.abs(bmi - fromSize) > BMI_TOLERANCE) {
      notes.push(
        `${label("bmi")} is ${formatNumber(bmi, 0.1)}, but ${formatNumber(weight, 1)} kg and ${formatNumber(height, 1)} cm give ${formatNumber(fromSize, 0.1)}. In the dataset it is always weight ÷ height².`,
      );
    }
  }

  if (isNumber(bmi) && typeof obesity === "boolean" && obesity !== bmi > OBESITY_ABOVE_BMI) {
    notes.push(
      `${label("obesity")} is ${obesity ? "yes" : "no"} with a ${label("bmi").toLowerCase()} of ${formatNumber(bmi, 0.1)}. In the dataset it is recorded as yes when the ${label("bmi").toLowerCase()} is above ${OBESITY_ABOVE_BMI}.`,
    );
  }

  const pains = CHEST_PAIN_TYPES.filter((id) => values[id] === true);
  if (pains.length > 1) {
    notes.push(
      `${listed(pains.map(label))} are ${pains.length === 2 ? "both" : "all"} set to yes. No patient in the dataset has more than one type of chest pain.`,
    );
  }

  if (values.current_smoker === true && values.ex_smoker === true) {
    notes.push(
      `${listed([label("current_smoker"), label("ex_smoker")])} are both set to yes. No patient in the dataset is both.`,
    );
  }

  return notes;
}
