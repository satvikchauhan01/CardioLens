import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, META, predictResponse } from "../test/fixtures";
import { ApiError, getMeta, getSamples, predict, TIMEOUT_MS, toApiError } from "./client";

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

function stubFetch(implementation: FetchLike) {
  const mock = vi.fn(implementation);
  vi.stubGlobal("fetch", mock);
  return mock;
}

async function failure(call: Promise<unknown>): Promise<ApiError> {
  const error = await call.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("API client", () => {
  it("returns the parsed body from the API base URL", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(META));

    await expect(getMeta()).resolves.toEqual(META);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/meta");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("omit");
  });

  it("posts the features as JSON", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(predictResponse()));

    await predict({ age: 60, dm: true, sex: "Male" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/predict");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ features: { age: 60, dm: true, sex: "Male" } });
  });

  it("maps an error envelope to ApiError with code, message and details", async () => {
    const details = [{ field: "age", issue: "out_of_range", message: "Must be between 30 and 86 (range seen in the dataset)." }];
    stubFetch(async () =>
      jsonResponse({ error: { code: "VALIDATION_ERROR", message: "1 input needs attention.", details } }, 422),
    );

    const error = await failure(predict({ age: 200 }));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("1 input needs attention.");
    expect(error.details).toEqual(details);
  });

  it("keeps the reason of a 503 from the model service", async () => {
    const reason = "Artifacts not found in backend/artifacts. Run: python -m ml.train";
    stubFetch(async () => jsonResponse({ error: { code: "MODEL_UNAVAILABLE", message: reason } }, 503));

    const error = await failure(getSamples());

    expect(error.code).toBe("MODEL_UNAVAILABLE");
    expect(error.message).toBe(reason);
    expect(error.details).toBeUndefined();
  });

  it("maps a network failure to NETWORK_ERROR", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const error = await failure(getMeta());

    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("The model service could not be reached.");
  });

  it("maps an answer that is not the API's envelope to NETWORK_ERROR", async () => {
    stubFetch(async () => new Response("Bad gateway", { status: 502 }));
    expect((await failure(getMeta())).code).toBe("NETWORK_ERROR");
    expect((await failure(getMeta())).message).toContain("HTTP 502");

    stubFetch(async () => new Response("<html></html>", { status: 200 }));
    expect((await failure(getMeta())).code).toBe("NETWORK_ERROR");
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );

    const pending = failure(getMeta());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    const error = await pending;

    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("The model service took too long to answer.");
  });

  it("turns anything thrown into an ApiError", () => {
    const known = new ApiError("INTERNAL_ERROR", "Something went wrong on the server.");

    expect(toApiError(known)).toBe(known);
    expect(toApiError(new Error("boom")).code).toBe("NETWORK_ERROR");
    expect(toApiError("boom")).toBeInstanceOf(ApiError);
  });
});
