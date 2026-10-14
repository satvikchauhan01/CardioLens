import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeatureValue, PredictResponse, SamplePatient } from "../api/types";
import { predictResponse, SAMPLES } from "../test/fixtures";
import { useSampleEstimates } from "./useSampleEstimates";

// Seven patients, so that more are waiting than may be asked for at a time.
const PATIENTS: SamplePatient[] = Array.from({ length: 7 }, (_, index) => ({
  ...SAMPLES[index % SAMPLES.length],
  id: `sample-${index + 1}`,
  features: { ...SAMPLES[index % SAMPLES.length].features, age: 40 + index },
}));

/** A predict function whose calls are answered by hand. */
function controlledPredict() {
  const calls: {
    features: Record<string, FeatureValue>;
    options?: { background?: boolean };
    resolve: (response: PredictResponse) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const predict = vi.fn(
    (features: Record<string, FeatureValue>, options?: { background?: boolean }) =>
      new Promise<PredictResponse>((resolve, reject) => {
        calls.push({ features, options, resolve, reject });
      }),
  );
  return { predict, calls };
}

function setup(enabled = true) {
  const api = controlledPredict();
  const hook = renderHook(({ on }) => useSampleEstimates(PATIENTS, on, api.predict), { initialProps: { on: enabled } });
  return { ...api, hook, current: () => hook.result.current };
}

const answer = (call: { features: Record<string, FeatureValue>; resolve: (r: PredictResponse) => void }, cad: number) =>
  act(async () => call.resolve(predictResponse(call.features, { cad })));

describe("estimates for the sample patients' cards", () => {
  it("asks for nothing until the page that shows them has been opened", () => {
    const { calls, hook, current } = setup(false);
    expect(current().status).toBe("idle");
    expect(current().estimates).toEqual({});
    expect(calls).toHaveLength(0);

    hook.rerender({ on: true });

    expect(current().status).toBe("loading");
    expect(calls.length).toBeGreaterThan(0);
  });

  it("asks for three at a time, each marked as less urgent, and fills the estimates in as they arrive", async () => {
    const { calls, current } = setup();
    expect(calls.map((call) => call.features.age)).toEqual([40, 41, 42]);
    expect(calls.every((call) => call.options?.background === true)).toBe(true);

    await answer(calls[1], 0.12);

    expect(Object.keys(current().estimates)).toEqual(["sample-2"]);
    expect(current().estimates["sample-2"].cad.probability).toBe(0.12);
    expect(current().status).toBe("loading");
    // One answer makes room for one more question.
    expect(calls.map((call) => call.features.age)).toEqual([40, 41, 42, 43]);
  });

  it("is ready once every patient has its estimates", async () => {
    const { calls, current } = setup();

    for (let index = 0; index < PATIENTS.length; index += 1) await answer(calls[index], index / 10);

    expect(calls).toHaveLength(PATIENTS.length);
    expect(current().status).toBe("ready");
    expect(Object.keys(current().estimates).sort()).toEqual(PATIENTS.map((patient) => patient.id).sort());
    expect(current().estimates["sample-7"].cad.probability).toBe(0.6);
  });

  it("says so when an estimate cannot be loaded, keeps the others, and tries again on request", async () => {
    const { calls, current } = setup();
    await answer(calls[0], 0.9); // makes room for a fourth question
    await act(async () => calls[1].reject(new Error("no answer")));
    expect(current().status).toBe("loading"); // two questions are still open
    await answer(calls[2], 0.2);
    await answer(calls[3], 0.4);

    expect(current().status).toBe("error");
    expect(Object.keys(current().estimates).sort()).toEqual(["sample-1", "sample-3", "sample-4"]);
    // Nothing more was asked for once one had failed.
    const asked = calls.length;
    expect(asked).toBe(4);

    act(() => current().retry());
    expect(current().status).toBe("loading");
    for (let index = asked; index < asked + PATIENTS.length; index += 1) await answer(calls[index], 0.5);

    expect(current().status).toBe("ready");
    expect(Object.keys(current().estimates)).toHaveLength(PATIENTS.length);
  });

  it("ignores answers that arrive after the page is gone", async () => {
    const { calls, hook, current } = setup();
    const before = current();

    hook.unmount();
    await answer(calls[0], 0.9);

    expect(hook.result.current).toBe(before);
  });
});
