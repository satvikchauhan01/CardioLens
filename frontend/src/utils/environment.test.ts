import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { isWebGLAvailable, usePrefersReducedMotion } from "./environment";

// The test setup already answers "no context" for every canvas; each test here sets its own answer.
// getContext is overloaded per context type, so the spy is typed by the one shape used here.
const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext") as unknown as MockInstance<
  (type: string) => unknown
>;

afterEach(() => {
  getContext.mockReset().mockReturnValue(null);
  vi.unstubAllGlobals();
});

describe("WebGL detection (F11)", () => {
  const context = {};

  it("is false when the browser gives no context", () => {
    getContext.mockReturnValue(null);

    expect(isWebGLAvailable()).toBe(false);
    expect(getContext.mock.calls.map(([type]) => type)).toEqual(["webgl2", "webgl"]);
  });

  it("is true with WebGL 2, without asking further", () => {
    getContext.mockImplementation((type: string) => (type === "webgl2" ? context : null));

    expect(isWebGLAvailable()).toBe(true);
    expect(getContext.mock.calls.map(([type]) => type)).toEqual(["webgl2"]);
  });

  it("is true with WebGL 1 alone", () => {
    getContext.mockImplementation((type: string) => (type === "webgl" ? context : null));

    expect(isWebGLAvailable()).toBe(true);
  });

  it("is false when asking for a context fails", () => {
    getContext.mockImplementation(() => {
      throw new Error("context creation is blocked");
    });

    expect(isWebGLAvailable()).toBe(false);
  });
});

describe("reduced motion preference", () => {
  /** A media query whose answer can be changed, as the system setting would. */
  function stubMatchMedia(matches: boolean) {
    const listeners = new Set<() => void>();
    const query = {
      matches,
      addEventListener: (_type: string, listener: () => void) => void listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => void listeners.delete(listener),
    };
    const matchMedia = vi.fn((_media: string) => query);
    vi.stubGlobal("matchMedia", matchMedia);
    return {
      matchMedia,
      listeners,
      change(next: boolean) {
        query.matches = next;
        listeners.forEach((listener) => listener());
      },
    };
  }

  it("is off where the browser has no media queries", () => {
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });

  it("starts from the system setting", () => {
    const { matchMedia } = stubMatchMedia(true);

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("follows the setting while mounted and stops listening afterwards", () => {
    const media = stubMatchMedia(false);
    const hook = renderHook(() => usePrefersReducedMotion());
    expect(hook.result.current).toBe(false);

    act(() => media.change(true));
    expect(hook.result.current).toBe(true);
    act(() => media.change(false));
    expect(hook.result.current).toBe(false);

    hook.unmount();
    expect(media.listeners.size).toBe(0);
  });
});
