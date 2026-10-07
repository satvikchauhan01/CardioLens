// The analysis state machine of PRODUCT_SPEC §6.2. Pure: timers and requests live in useAnalysis.

import type { ApiError } from "../api/client";
import type { FeatureValue, PredictResponse } from "../api/types";
import type { FormValue, FormValues } from "./validation";

export interface AnalysisState {
  status: "idle" | "predicting" | "ready" | "input_invalid" | "error";
  source: "sample" | "typical" | null;
  sampleId: string | null;
  loadedValues: Record<string, FeatureValue> | null; // values when the patient was loaded
  values: FormValues | null; // current, possibly modified or incomplete, values
  fieldErrors: Record<string, string>;
  result: PredictResponse | null; // matches `values`; set only when status = ready
  originalResult: PredictResponse | null; // result for loadedValues (what-if deltas)
  lastGoodResult: PredictResponse | null; // shown dimmed or "Out of date" when not ready
  latestRequestId: number; // every load and edit takes a new id; older responses are discarded
  loadRequestId: number | null; // the request that predicts loadedValues
  error: ApiError | null;
}

export type AnalysisAction =
  | {
      type: "LOAD";
      requestId: number;
      source: "sample" | "typical";
      sampleId: string | null;
      values: Record<string, FeatureValue>;
    }
  | { type: "EDIT"; requestId: number; field: string; value: FormValue }
  | { type: "RESET"; requestId: number }
  | { type: "INVALID"; requestId: number; errors: Record<string, string> }
  | { type: "REQUEST"; requestId: number }
  | { type: "RESPONSE_OK"; requestId: number; result: PredictResponse }
  | { type: "RESPONSE_ERROR"; requestId: number; error: ApiError };

export const initialAnalysisState: AnalysisState = {
  status: "idle",
  source: null,
  sampleId: null,
  loadedValues: null,
  values: null,
  fieldErrors: {},
  result: null,
  originalResult: null,
  lastGoodResult: null,
  latestRequestId: 0,
  loadRequestId: null,
  error: null,
};

/** Ids of the inputs whose current value differs from the loaded patient's (BR-10). */
export function modifiedFields(state: Pick<AnalysisState, "values" | "loadedValues">): string[] {
  const { values, loadedValues } = state;
  if (!values || !loadedValues) return [];
  return Object.keys(loadedValues).filter((field) => values[field] !== loadedValues[field]);
}

export function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  const isLatest = action.requestId === state.latestRequestId;

  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        status: "predicting",
        source: action.source,
        sampleId: action.sampleId,
        loadedValues: action.values,
        values: action.values,
        fieldErrors: {},
        result: null,
        originalResult: null,
        latestRequestId: action.requestId,
        loadRequestId: action.requestId,
        error: null,
      };

    case "EDIT":
      if (!state.values) return state;
      // "predicting" covers the debounce too: from the first keystroke the results no longer
      // match the inputs, and taking a new id makes any response still in flight stale.
      return {
        ...state,
        status: "predicting",
        values: { ...state.values, [action.field]: action.value },
        result: null,
        latestRequestId: action.requestId,
        error: null,
      };

    case "RESET":
      // "Reset to original" (BR-10): back to the loaded values and their known result, no request.
      if (!state.loadedValues || !state.originalResult) return state;
      return {
        ...state,
        status: "ready",
        values: state.loadedValues,
        fieldErrors: {},
        result: state.originalResult,
        lastGoodResult: state.originalResult,
        latestRequestId: action.requestId,
        error: null,
      };

    case "INVALID":
      if (!isLatest) return state;
      return { ...state, status: "input_invalid", fieldErrors: action.errors };

    case "REQUEST":
      if (!isLatest) return state;
      return { ...state, status: "predicting", fieldErrors: {}, error: null };

    case "RESPONSE_OK": {
      // The answer for the loaded values is kept for what-if deltas even if an edit overtook it.
      const originalResult =
        action.requestId === state.loadRequestId ? action.result : state.originalResult;
      if (!isLatest) {
        return originalResult === state.originalResult ? state : { ...state, originalResult };
      }
      return {
        ...state,
        status: "ready",
        result: action.result,
        originalResult,
        lastGoodResult: action.result,
        error: null,
      };
    }

    case "RESPONSE_ERROR": {
      if (!isLatest) return state;
      const details = action.error.code === "VALIDATION_ERROR" ? (action.error.details ?? []) : [];
      if (details.length > 0) {
        // The server disagreed with the client-side checks: show its field errors.
        return {
          ...state,
          status: "input_invalid",
          fieldErrors: Object.fromEntries(details.map((detail) => [detail.field, detail.message])),
        };
      }
      return { ...state, status: "error", error: action.error };
    }
  }
}
