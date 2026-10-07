// Drives the analysis reducer: loads patients, debounces edits, validates, predicts (DF-2).

import { useCallback, useEffect, useReducer, useRef } from "react";
import { predict as predictViaApi, toApiError } from "../api/client";
import type { FeatureSchema, FeatureValue, PredictResponse, SamplePatient } from "../api/types";
import { analysisReducer, initialAnalysisState, type AnalysisState } from "./analysisReducer";
import { validateValues, type FormValue, type FormValues } from "./validation";

export const EDIT_DEBOUNCE_MS = 400;

type Predict = (features: Record<string, FeatureValue>) => Promise<PredictResponse>;

export interface Analysis {
  state: AnalysisState;
  loadSample: (sample: SamplePatient) => void;
  loadTypical: () => void;
  edit: (field: string, value: FormValue) => void;
  retry: () => void;
}

export function useAnalysis(features: FeatureSchema[], predict: Predict = predictViaApi): Analysis {
  const [state, dispatch] = useReducer(analysisReducer, initialAnalysisState);
  // What the next submit needs right away, before React has re-rendered.
  const values = useRef<FormValues | null>(null);
  const invalid = useRef(false);
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = useCallback(
    (requestId: number) => {
      const current = values.current;
      if (!current) return;
      const errors = validateValues(current, features);
      invalid.current = Object.keys(errors).length > 0;
      if (invalid.current) {
        dispatch({ type: "INVALID", requestId, errors });
        return;
      }
      dispatch({ type: "REQUEST", requestId });
      predict(current as Record<string, FeatureValue>).then(
        (result) => dispatch({ type: "RESPONSE_OK", requestId, result }),
        (error: unknown) => dispatch({ type: "RESPONSE_ERROR", requestId, error: toApiError(error) }),
      );
    },
    [features, predict],
  );

  const load = useCallback(
    (source: "sample" | "typical", sampleId: string | null, loaded: Record<string, FeatureValue>) => {
      clearTimeout(timer.current);
      const requestId = ++sequence.current;
      values.current = loaded;
      dispatch({ type: "LOAD", requestId, source, sampleId, values: loaded });
      submit(requestId);
    },
    [submit],
  );

  const loadSample = useCallback(
    (sample: SamplePatient) => load("sample", sample.id, sample.features),
    [load],
  );

  const loadTypical = useCallback(
    () => load("typical", null, Object.fromEntries(features.map((f) => [f.id, f.default]))),
    [features, load],
  );

  const edit = useCallback(
    (field: string, value: FormValue) => {
      if (!values.current) return;
      clearTimeout(timer.current);
      const requestId = ++sequence.current;
      values.current = { ...values.current, [field]: value };
      dispatch({ type: "EDIT", requestId, field, value });
      if (invalid.current) {
        // While a field error is showing, re-check on every change instead of waiting.
        submit(requestId);
      } else {
        timer.current = setTimeout(() => submit(requestId), EDIT_DEBOUNCE_MS);
      }
    },
    [submit],
  );

  const retry = useCallback(() => {
    clearTimeout(timer.current);
    // Same inputs as the request that failed, so it keeps that request's id.
    submit(sequence.current);
  }, [submit]);

  return { state, loadSample, loadTypical, edit, retry };
}
