// The models' estimates for every sample patient, for the cards on the Patients page. Asked from
// the same endpoint as any other prediction, a few at a time and marked as less urgent, so the
// analysis of the patient the user has chosen never waits behind them.

import { useCallback, useEffect, useState } from "react";
import { predict as predictViaApi } from "../api/client";
import type { FeatureValue, PredictResponse, SamplePatient, TargetId, TargetPrediction } from "../api/types";

export type SampleEstimates = Record<string, Record<TargetId, TargetPrediction>>;
export type SampleEstimatesStatus = "idle" | "loading" | "ready" | "error";

type Predict = (features: Record<string, FeatureValue>, options?: { background?: boolean }) => Promise<PredictResponse>;

const AT_A_TIME = 3;

export interface SampleEstimatesState {
  status: SampleEstimatesStatus;
  estimates: SampleEstimates; // filled in as the answers arrive
  retry: () => void;
}

export function useSampleEstimates(
  samples: SamplePatient[],
  enabled: boolean, // false until the page that shows them has been opened
  predict: Predict = predictViaApi,
): SampleEstimatesState {
  const [status, setStatus] = useState<SampleEstimatesStatus>("idle");
  const [estimates, setEstimates] = useState<SampleEstimates>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || samples.length === 0) return;
    let cancelled = false;
    setStatus("loading");

    const waiting = [...samples];
    let failed = false;
    async function worker() {
      for (let sample = waiting.shift(); sample && !cancelled && !failed; sample = waiting.shift()) {
        const { id, features } = sample;
        try {
          const { predictions } = await predict(features, { background: true });
          if (!cancelled) setEstimates((current) => ({ ...current, [id]: predictions }));
        } catch {
          failed = true;
        }
      }
    }
    void Promise.all(Array.from({ length: AT_A_TIME }, worker)).then(() => {
      if (!cancelled) setStatus(failed ? "error" : "ready");
    });

    return () => {
      cancelled = true;
    };
  }, [samples, enabled, predict, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { status, estimates, retry };
}
