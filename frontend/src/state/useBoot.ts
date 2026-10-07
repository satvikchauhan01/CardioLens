// App boot (PRODUCT_SPEC §6.1, DF-1): metadata and sample patients, with a retry.

import { useCallback, useEffect, useState } from "react";
import { getMeta, getSamples, toApiError, type ApiError } from "../api/client";
import type { MetaResponse, SamplePatient } from "../api/types";

export type BootState =
  | { status: "booting" }
  | { status: "boot_error"; error: ApiError }
  | { status: "ready"; meta: MetaResponse; samples: SamplePatient[] };

export function useBoot(): { state: BootState; retry: () => void } {
  const [state, setState] = useState<BootState>({ status: "booting" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMeta(), getSamples()]).then(
      ([meta, { samples }]) => {
        if (!cancelled) setState({ status: "ready", meta, samples });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: "boot_error", error: toApiError(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "booting" });
    setAttempt((current) => current + 1);
  }, []);

  return { state, retry };
}
