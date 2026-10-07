import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, META, SAMPLES } from "../test/fixtures";
import { useBoot } from "./useBoot";

type Route = () => Response | Promise<Response>;

function mockApi(routes: Record<string, Route> = {}) {
  const defaults: Record<string, Route> = {
    "/api/meta": () => jsonResponse(META),
    "/api/samples": () => jsonResponse({ samples: SAMPLES }),
  };
  const fetchMock = vi.fn(async (url: string) => ({ ...defaults, ...routes })[url]());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("app boot (PRODUCT_SPEC §6.1, DF-1)", () => {
  it("is ready once the metadata and the sample patients have arrived", async () => {
    const fetchMock = mockApi();
    const { result } = renderHook(() => useBoot());
    expect(result.current.state).toEqual({ status: "booting" });

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(result.current.state).toEqual({ status: "ready", meta: META, samples: SAMPLES });
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual(["/api/meta", "/api/samples"]);
  });

  it("is a boot error when either request fails, with the service's reason", async () => {
    const reason = "Artifacts not found in backend/artifacts. Run: python -m ml.train";
    mockApi({ "/api/samples": () => jsonResponse({ error: { code: "MODEL_UNAVAILABLE", message: reason } }, 503) });
    const { result } = renderHook(() => useBoot());

    await waitFor(() => expect(result.current.state.status).toBe("boot_error"));

    const { state } = result.current;
    expect(state.status === "boot_error" && [state.error.code, state.error.message]).toEqual([
      "MODEL_UNAVAILABLE", reason,
    ]);
  });

  it("goes back to booting on retry and asks for both again", async () => {
    let reachable = false;
    const fetchMock = mockApi({
      "/api/meta": () => {
        if (!reachable) throw new TypeError("Failed to fetch");
        return jsonResponse(META);
      },
    });
    const { result } = renderHook(() => useBoot());
    await waitFor(() => expect(result.current.state.status).toBe("boot_error"));
    expect(result.current.state).toMatchObject({ error: { code: "NETWORK_ERROR" } });

    reachable = true;
    act(() => result.current.retry());
    expect(result.current.state).toEqual({ status: "booting" });

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("drops an answer that arrives after the app is gone", async () => {
    let answer: (response: Response) => void = () => {};
    mockApi({ "/api/meta": () => new Promise<Response>((resolve) => (answer = resolve)) });
    const { result, unmount } = renderHook(() => useBoot());

    unmount();
    answer(jsonResponse(META));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.state).toEqual({ status: "booting" });
  });
});
