import { describe, expect, it } from "vitest";
import type { FeatureSchema } from "../api/types";
import { BMI_TOLERANCE, coherenceNotes } from "./coherence";

// Only the id and the label of a feature are used here.
const FEATURES = [
  ["weight", "Weight"], ["length", "Height"], ["bmi", "Body mass index"], ["obesity", "Obesity"],
  ["typical_chest_pain", "Typical chest pain"], ["atypical", "Atypical chest pain"],
  ["nonanginal", "Non-anginal chest pain"], ["current_smoker", "Current smoker"], ["ex_smoker", "Ex-smoker"],
].map(([id, label]) => ({ id, label }) as FeatureSchema);

// Sample A of the real model: 79 kg, 174 cm, BMI 26.09.
const PATIENT = {
  weight: 79, length: 174, bmi: 79 / 1.74 ** 2, obesity: true,
  typical_chest_pain: true, atypical: false, nonanginal: false, current_smoker: false, ex_smoker: false,
};
const notes = (changes: Record<string, number | boolean | string | null>) =>
  coherenceNotes({ ...PATIENT, ...changes }, FEATURES);

describe("unusual combinations of inputs (BR-15)", () => {
  it("says nothing about a patient as the dataset records one", () => {
    expect(notes({})).toEqual([]);
  });

  it("points out a body mass index that no longer matches weight and height", () => {
    expect(notes({ weight: 110 })).toEqual([
      "Body mass index is 26.1, but 110 kg and 174 cm give 36.3. In the dataset it is always weight ÷ height².",
    ]);
    expect(notes({ length: 150 })).toHaveLength(1);
    expect(notes({ bmi: 35 })[0]).toContain("Body mass index is 35, but 79 kg and 174 cm give 26.1.");
  });

  it("allows the small gap that rounding, or the typical values, leave", () => {
    const exact = PATIENT.bmi;

    expect(notes({ bmi: exact + BMI_TOLERANCE - 0.01 })).toEqual([]);
    expect(notes({ bmi: exact + BMI_TOLERANCE + 0.01, obesity: true })).toHaveLength(1);
    // The typical values of the real model: medians of each input on its own.
    expect(notes({ weight: 74, length: 165, bmi: 26.775510204081634 })).toEqual([]);
  });

  it("points out obesity that does not follow the body mass index", () => {
    expect(notes({ obesity: false })).toEqual([
      "Obesity is no with a body mass index of 26.1. In the dataset it is recorded as yes when the body mass index is above 25.",
    ]);
    expect(notes({ weight: 60, bmi: 60 / 1.74 ** 2, obesity: true })).toEqual([
      "Obesity is yes with a body mass index of 19.8. In the dataset it is recorded as yes when the body mass index is above 25.",
    ]);
    expect(notes({ weight: 60, bmi: 60 / 1.74 ** 2, obesity: false })).toEqual([]);
  });

  it("points out more than one type of chest pain", () => {
    expect(notes({ atypical: true })).toEqual([
      "Typical chest pain and Atypical chest pain are both set to yes. No patient in the dataset has more than one type of chest pain.",
    ]);
    expect(notes({ atypical: true, nonanginal: true })).toEqual([
      "Typical chest pain, Atypical chest pain and Non-anginal chest pain are all set to yes. No patient in the dataset has more than one type of chest pain.",
    ]);
    // None at all is a combination the dataset has (30 patients).
    expect(notes({ typical_chest_pain: false })).toEqual([]);
  });

  it("points out a current smoker who is also an ex-smoker", () => {
    expect(notes({ current_smoker: true, ex_smoker: true })).toEqual([
      "Current smoker and Ex-smoker are both set to yes. No patient in the dataset is both.",
    ]);
    expect(notes({ current_smoker: true })).toEqual([]);
  });

  it("lists every problem at once", () => {
    expect(notes({ weight: 110, obesity: false, atypical: true, current_smoker: true, ex_smoker: true })).toHaveLength(4);
  });

  it("stays silent while a value is missing, and where the schema has none of these inputs", () => {
    expect(notes({ bmi: null })).toEqual([]);
    expect(notes({ weight: null, obesity: false })).toHaveLength(1); // obesity against the BMI still stands
    expect(coherenceNotes({ age: 60, sex: "Male" }, FEATURES)).toEqual([]);
  });
});
