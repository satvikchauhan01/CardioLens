import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { META } from "../test/fixtures";
import { featureById, MetaContext, useMeta } from "./MetaContext";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("metadata context", () => {
  it("gives the booted metadata to everything below it", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MetaContext.Provider value={META}>{children}</MetaContext.Provider>
    );

    expect(renderHook(() => useMeta(), { wrapper }).result.current).toBe(META);
  });

  it("fails loudly when something needs the metadata before the app has booted", () => {
    // React reports the error it rethrows; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useMeta())).toThrow("useMeta must be used after the app has booted.");
  });

  it("finds an input by its id", () => {
    expect(featureById(META, "ef_tte")?.label).toBe("Ejection fraction");
    expect(featureById(META, "not_in_schema")).toBeUndefined();
  });
});
