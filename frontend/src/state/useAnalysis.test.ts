import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import type { FeatureValue, PredictResponse } from "../api/types";
import { FEATURES, predictResponse, SAMPLES } from "../test/fixtures";
import { EDIT_DEBOUNCE_MS, useAnalysis } from "./useAnalysis";

type Values = Record<string, FeatureValue>;

/** A predict function whose calls are answered by hand, in any order. */
function controlledPredict() {
  const calls: { values: Values; resolve: (r: PredictResponse) => void; reject: (e: unknown) => void }[] = [];
  const predict = vi.fn(
    (values: Values) =>
      new Promise<PredictResponse>((resolve, reject) => {
        calls.push({ values, resolve, reject });
      }),
  );
  return { predict, calls };
}

function setup() {
  const api = controlledPredict();
  const hook = renderHook(() => useAnalysis(FEATURES, api.predict));
  return { ...api, hook, analysis: () => hook.result.current };
}

async function settle(run: () => void) {
  await act(async () => {
    run();
    await Promise.resolve();
  });
}

const A = SAMPLES[0];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAnalysis", () => {
  it("predicts a loaded sample at once, without the debounce", async () => {
    const { predict, calls, analysis } = setup();

    act(() => analysis().loadSample(A));
    expect(analysis().state.status).toBe("predicting");
    expect(predict).toHaveBeenCalledExactlyOnceWith(A.features);

    const result = predictResponse(A.features);
    await settle(() => calls[0].resolve(result));
    expect(analysis().state.status).toBe("ready");
    expect(analysis().state.result).toBe(result);
    expect(analysis().state.originalResult).toBe(result);
  });

  it("loads the typical values from the schema defaults", () => {
    const { predict, analysis } = setup();

    act(() => analysis().loadTypical());

    const typical = Object.fromEntries(FEATURES.map((feature) => [feature.id, feature.default]));
    expect(predict).toHaveBeenCalledExactlyOnceWith(typical);
    expect(analysis().state).toMatchObject({ source: "typical", sampleId: null, values: typical });
  });

  it("debounces edits by 400 ms and sends only the latest values", async () => {
    const { predict, calls, analysis } = setup();
    act(() => analysis().loadSample(A));
    await settle(() => calls[0].resolve(predictResponse(A.features)));

    act(() => analysis().edit("age", 6));
    act(() => vi.advanceTimersByTime(EDIT_DEBOUNCE_MS - 1));
    act(() => analysis().edit("age", 61));
    act(() => vi.advanceTimersByTime(EDIT_DEBOUNCE_MS - 1));

    expect(analysis().state.status).toBe("predicting");
    expect(predict).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(1));
    expect(predict).toHaveBeenCalledTimes(2);
    expect(predict).toHaveBeenLastCalledWith({ ...A.features, age: 61 });
    expect(EDIT_DEBOUNCE_MS).toBe(400);
  });

  it("sends nothing while the inputs are invalid, then re-checks each change at once", async () => {
    const { predict, calls, analysis } = setup();
    act(() => analysis().loadSample(A));
    await settle(() => calls[0].resolve(predictResponse(A.features)));

    act(() => analysis().edit("age", 200));
    act(() => vi.advanceTimersByTime(EDIT_DEBOUNCE_MS));
    expect(analysis().state.status).toBe("input_invalid");
    expect(analysis().state.fieldErrors).toEqual({
      age: "Must be between 30 and 86 (range seen in the dataset).",
    });
    expect(predict).toHaveBeenCalledTimes(1);

    act(() => analysis().edit("age", null));
    expect(analysis().state.fieldErrors).toEqual({ age: "This value is required." });
    expect(predict).toHaveBeenCalledTimes(1);

    act(() => analysis().edit("age", 70));
    expect(analysis().state.status).toBe("predicting");
    expect(analysis().state.fieldErrors).toEqual({});
    expect(predict).toHaveBeenCalledTimes(2);
    expect(predict).toHaveBeenLastCalledWith({ ...A.features, age: 70 });
  });

  it("discards a response that arrives after a newer request", async () => {
    const { calls, analysis } = setup();
    act(() => analysis().loadSample(A));
    await settle(() => calls[0].resolve(predictResponse(A.features)));

    act(() => analysis().edit("age", 61));
    act(() => vi.advanceTimersByTime(EDIT_DEBOUNCE_MS));
    act(() => analysis().edit("age", 62));
    act(() => vi.advanceTimersByTime(EDIT_DEBOUNCE_MS));
    expect(calls).toHaveLength(3);

    const newer = predictResponse({ ...A.features, age: 62 }, { lad: 0.7 });
    await settle(() => calls[2].resolve(newer));
    await settle(() => calls[1].resolve(predictResponse({ ...A.features, age: 61 }, { lad: 0.1 })));

    expect(analysis().state.status).toBe("ready");
    expect(analysis().state.result).toBe(newer);
  });

  it("reports a failed request and predicts again on retry", async () => {
    const { predict, calls, analysis } = setup();
    act(() => analysis().loadSample(A));

    const unreachable = new ApiError("NETWORK_ERROR", "The model service could not be reached.");
    await settle(() => calls[0].reject(unreachable));
    expect(analysis().state.status).toBe("error");
    expect(analysis().state.error).toBe(unreachable);

    act(() => analysis().retry());
    expect(analysis().state.status).toBe("predicting");
    expect(predict).toHaveBeenCalledTimes(2);

    await settle(() => calls[1].resolve(predictResponse(A.features)));
    expect(analysis().state.status).toBe("ready");
  });

  it("wraps an unexpected failure in an ApiError", async () => {
    const { calls, analysis } = setup();
    act(() => analysis().loadSample(A));

    await settle(() => calls[0].reject(new Error("boom")));

    expect(analysis().state.error).toBeInstanceOf(ApiError);
    expect(analysis().state.error?.code).toBe("NETWORK_ERROR");
  });

  it("ignores edits before a patient is loaded and stops its timer on unmount", () => {
    const { predict, calls, analysis, hook } = setup();

    act(() => analysis().edit("age", 61));
    act(() => vi.advanceTimersByTime(EDIT_DEBOUNCE_MS));
    expect(predict).not.toHaveBeenCalled();

    act(() => analysis().loadSample(A));
    act(() => analysis().edit("age", 61));
    hook.unmount();
    vi.advanceTimersByTime(EDIT_DEBOUNCE_MS);
    expect(calls).toHaveLength(1);
  });
});
