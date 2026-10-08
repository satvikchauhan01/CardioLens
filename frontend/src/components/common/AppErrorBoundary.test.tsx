import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

function Broken(): ReactNode {
  throw new Error("unexpected");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("app error boundary", () => {
  it("shows its content when nothing goes wrong", () => {
    render(
      <AppErrorBoundary>
        <p>the view</p>
      </AppErrorBoundary>,
    );

    expect(screen.getByText("the view")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says so and offers to reload when a view fails, instead of leaving the page empty", () => {
    // React also reports the caught error on the console; keep that out of the test output.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onReload = vi.fn();
    render(
      <AppErrorBoundary onReload={onReload}>
        <Broken />
      </AppErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Something went wrong on this page.");
    expect(alert.textContent).toContain("Reload the page to start again. Nothing you entered was saved.");

    fireEvent.click(screen.getByRole("button", { name: "Reload the page" }));
    expect(onReload).toHaveBeenCalledOnce();
  });
});
