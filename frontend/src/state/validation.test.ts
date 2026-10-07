import { describe, expect, it } from "vitest";
import { FEATURES, SAMPLES } from "../test/fixtures";
import { validateValues, type FormValue } from "./validation";

const VALID = SAMPLES[0].features;
const AGE_RANGE = "Must be between 30 and 86 (range seen in the dataset).";
const BBB_ALLOWED = "Must be one of: None, LBBB, RBBB.";

function errorsWith(field: string, value: FormValue | undefined) {
  return validateValues({ ...VALID, [field]: value as FormValue }, FEATURES);
}

describe("client validation mirrors BR-13", () => {
  it("accepts every sample and the typical values", () => {
    for (const sample of SAMPLES) {
      expect(validateValues(sample.features, FEATURES)).toEqual({});
    }
    const typical = Object.fromEntries(FEATURES.map((feature) => [feature.id, feature.default]));
    expect(validateValues(typical, FEATURES)).toEqual({});
  });

  // The same cases and messages as backend/tests/test_api.py::test_invalid_value_is_rejected.
  it.each<[string, FormValue | undefined, string]>([
    ["age", null, "This value is required."],
    ["age", undefined, "This value is required."],
    ["age", "58", "Must be a number."],
    ["age", true, "Must be a number."],
    ["age", Number.NaN, "Must be a finite number."],
    ["bmi", Number.POSITIVE_INFINITY, "Must be a finite number."],
    ["age", 58.5, "Must be a whole number."],
    ["age", 29, AGE_RANGE],
    ["age", 87, AGE_RANGE],
    ["bmi", 10, "Must be between 18.2 and 40.9 (range seen in the dataset)."],
    ["cr", 2.3, "Must be between 0.5 and 2.2 (range seen in the dataset)."],
    ["dm", 1, "Must be true or false."],
    ["dm", "true", "Must be true or false."],
    ["bbb", 3, BBB_ALLOWED],
    ["bbb", "Other", BBB_ALLOWED],
    ["bbb", "lbbb", BBB_ALLOWED],
    ["vhd", "Critical", "Must be one of: None, Mild, Moderate, Severe."],
  ])("rejects %s = %s", (field, value, message) => {
    expect(errorsWith(field, value)).toEqual({ [field]: message });
  });

  it("accepts the limits of the range and non-integers where allowed", () => {
    expect(errorsWith("age", 30)).toEqual({});
    expect(errorsWith("age", 86)).toEqual({});
    expect(errorsWith("bmi", 18.115412710007302)).toEqual({});
    expect(errorsWith("bmi", 25)).toEqual({});
    expect(errorsWith("cr", 1.15)).toEqual({});
  });

  it("reports every problem together", () => {
    const errors = validateValues({ ...VALID, age: 200, sex: "X", ef_tte: null }, FEATURES);

    expect(Object.keys(errors)).toEqual(["age", "sex", "ef_tte"]);
  });
});
