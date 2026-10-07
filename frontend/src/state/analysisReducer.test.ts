import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { predictResponse, SAMPLES } from "../test/fixtures";
import {
  analysisReducer,
  initialAnalysisState,
  modifiedFields,
  type AnalysisAction,
  type AnalysisState,
} from "./analysisReducer";

const A = SAMPLES[0];
const RESULT_A = predictResponse(A.features);
const RESULT_EDITED = predictResponse({ ...A.features, age: 70 }, { lad: 0.44 });

function run(...actions: AnalysisAction[]): AnalysisState {
  return actions.reduce(analysisReducer, initialAnalysisState);
}

const load = (requestId: number): AnalysisAction => ({
  type: "LOAD", requestId, source: "sample", sampleId: A.id, values: A.features,
});
const edit = (requestId: number, value: number | null = 70): AnalysisAction => ({
  type: "EDIT", requestId, field: "age", value,
});
const ok = (requestId: number, result = RESULT_A): AnalysisAction => ({
  type: "RESPONSE_OK", requestId, result,
});
const failed = (requestId: number, error: ApiError): AnalysisAction => ({
  type: "RESPONSE_ERROR", requestId, error,
});

const NETWORK = new ApiError("NETWORK_ERROR", "The model service could not be reached.");

describe("analysis state machine (PRODUCT_SPEC §6.2)", () => {
  it("starts idle with no patient", () => {
    expect(initialAnalysisState.status).toBe("idle");
    expect(initialAnalysisState.values).toBeNull();
  });

  it("idle → LOAD → predicting", () => {
    const state = run(load(1));

    expect(state.status).toBe("predicting");
    expect(state).toMatchObject({
      source: "sample", sampleId: A.id, values: A.features, loadedValues: A.features,
      latestRequestId: 1, loadRequestId: 1, result: null, originalResult: null,
    });
  });

  it("predicting → RESPONSE_OK → ready, and the loaded patient's result is kept as the original", () => {
    const state = run(load(1), { type: "REQUEST", requestId: 1 }, ok(1));

    expect(state.status).toBe("ready");
    expect(state.result).toBe(RESULT_A);
    expect(state.originalResult).toBe(RESULT_A);
    expect(state.lastGoodResult).toBe(RESULT_A);
  });

  it("ready → EDIT → predicting: the result no longer matches, the last good one is kept", () => {
    const state = run(load(1), ok(1), edit(2));

    expect(state.status).toBe("predicting");
    expect(state.values).toEqual({ ...A.features, age: 70 });
    expect(state.loadedValues).toBe(A.features);
    expect(state.result).toBeNull();
    expect(state.lastGoodResult).toBe(RESULT_A);
    expect(state.latestRequestId).toBe(2);
  });

  it("EDIT → valid → REQUEST → RESPONSE_OK → ready with the new result; the original is unchanged", () => {
    const state = run(load(1), ok(1), edit(2), { type: "REQUEST", requestId: 2 }, ok(2, RESULT_EDITED));

    expect(state.status).toBe("ready");
    expect(state.result).toBe(RESULT_EDITED);
    expect(state.originalResult).toBe(RESULT_A);
    expect(state.lastGoodResult).toBe(RESULT_EDITED);
  });

  it("EDIT → invalid → input_invalid with field errors and the last good result", () => {
    const errors = { age: "This value is required." };
    const state = run(load(1), ok(1), edit(2, null), { type: "INVALID", requestId: 2, errors });

    expect(state.status).toBe("input_invalid");
    expect(state.fieldErrors).toEqual(errors);
    expect(state.result).toBeNull();
    expect(state.lastGoodResult).toBe(RESULT_A);
  });

  it("input_invalid → EDIT → valid → predicting with the errors cleared", () => {
    const errors = { age: "This value is required." };
    const state = run(
      load(1), ok(1), edit(2, null), { type: "INVALID", requestId: 2, errors },
      edit(3), { type: "REQUEST", requestId: 3 },
    );

    expect(state.status).toBe("predicting");
    expect(state.fieldErrors).toEqual({});
  });

  it("predicting → RESPONSE_ERROR → error with the last good result", () => {
    const state = run(load(1), ok(1), edit(2), { type: "REQUEST", requestId: 2 }, failed(2, NETWORK));

    expect(state.status).toBe("error");
    expect(state.error).toBe(NETWORK);
    expect(state.lastGoodResult).toBe(RESULT_A);
  });

  it("error → RETRY (REQUEST with the same id) → predicting → ready", () => {
    const afterRetry = run(load(1), failed(1, NETWORK), { type: "REQUEST", requestId: 1 });
    expect(afterRetry.status).toBe("predicting");
    expect(afterRetry.error).toBeNull();

    expect(analysisReducer(afterRetry, ok(1)).status).toBe("ready");
  });

  it("error → EDIT → predicting", () => {
    expect(run(load(1), failed(1, NETWORK), edit(2)).status).toBe("predicting");
  });

  it("a 422 from the server becomes field errors", () => {
    const rejected = new ApiError("VALIDATION_ERROR", "1 input needs attention.", [
      { field: "age", issue: "out_of_range", message: "Must be between 30 and 86 (range seen in the dataset)." },
    ]);
    const state = run(load(1), failed(1, rejected));

    expect(state.status).toBe("input_invalid");
    expect(state.fieldErrors).toEqual({ age: "Must be between 30 and 86 (range seen in the dataset)." });
  });

  it("discards responses that are older than the latest request", () => {
    const pending = run(load(1), ok(1), edit(2), edit(3), { type: "REQUEST", requestId: 3 });

    expect(analysisReducer(pending, ok(2, RESULT_EDITED))).toBe(pending);
    expect(analysisReducer(pending, failed(2, NETWORK))).toBe(pending);
    expect(analysisReducer(pending, { type: "INVALID", requestId: 2, errors: { age: "x" } })).toBe(pending);
    expect(analysisReducer(pending, { type: "REQUEST", requestId: 2 })).toBe(pending);
  });

  it("an edit makes the response still in flight stale", () => {
    const state = run(load(1), { type: "REQUEST", requestId: 1 }, edit(2), ok(1));

    expect(state.status).toBe("predicting");
    expect(state.result).toBeNull();
    // ...but it still answers the loaded values, so it is kept for the what-if comparison.
    expect(state.originalResult).toBe(RESULT_A);
  });

  it("loading another patient resets the original result and ignores the old patient's answer", () => {
    const B = SAMPLES[1];
    const state = run(
      load(1), ok(1),
      { type: "LOAD", requestId: 2, source: "sample", sampleId: B.id, values: B.features },
      ok(1),
    );

    expect(state.status).toBe("predicting");
    expect(state.sampleId).toBe(B.id);
    expect(state.originalResult).toBeNull();
    expect(state.lastGoodResult).toBe(RESULT_A);
  });

  it("ignores edits before a patient is loaded", () => {
    expect(run(edit(1))).toBe(initialAnalysisState);
  });
});

describe("what-if (BR-10)", () => {
  it("counts the fields that differ from the loaded patient", () => {
    expect(modifiedFields(initialAnalysisState)).toEqual([]);
    expect(modifiedFields(run(load(1), ok(1)))).toEqual([]);
    expect(modifiedFields(run(load(1), ok(1), edit(2)))).toEqual(["age"]);

    const two = run(load(1), ok(1), edit(2), { type: "EDIT", requestId: 3, field: "dm", value: false });
    expect(modifiedFields(two)).toEqual(["age", "dm"]);

    // Typing the original value back is not a modification.
    expect(modifiedFields(run(load(1), ok(1), edit(2), edit(3, 60)))).toEqual([]);
    // An emptied field counts.
    expect(modifiedFields(run(load(1), ok(1), edit(2, null)))).toEqual(["age"]);
  });

  it("RESET restores the loaded values and their result without a request", () => {
    const edited = run(load(1), ok(1), edit(2), { type: "REQUEST", requestId: 2 }, ok(2, RESULT_EDITED));
    const state = analysisReducer(edited, { type: "RESET", requestId: 3 });

    expect(state.status).toBe("ready");
    expect(state.values).toBe(A.features);
    expect(state.result).toBe(RESULT_A);
    expect(state.lastGoodResult).toBe(RESULT_A);
    expect(state.originalResult).toBe(RESULT_A);
    expect(modifiedFields(state)).toEqual([]);
  });

  it("RESET clears field errors and makes the response still in flight stale", () => {
    const errors = { age: "This value is required." };
    const invalid = run(load(1), ok(1), edit(2, null), { type: "INVALID", requestId: 2, errors });
    expect(analysisReducer(invalid, { type: "RESET", requestId: 3 })).toMatchObject({ status: "ready", fieldErrors: {} });

    const pending = run(load(1), ok(1), edit(2), { type: "REQUEST", requestId: 2 });
    const reset = analysisReducer(pending, { type: "RESET", requestId: 3 });
    expect(analysisReducer(reset, ok(2, RESULT_EDITED))).toBe(reset);
  });

  it("RESET does nothing before the loaded patient has a result", () => {
    const loading = run(load(1));
    expect(analysisReducer(loading, { type: "RESET", requestId: 2 })).toBe(loading);
    expect(analysisReducer(initialAnalysisState, { type: "RESET", requestId: 1 })).toBe(initialAnalysisState);
  });
});
