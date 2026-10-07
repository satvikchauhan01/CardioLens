import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TargetId } from "../api/types";
import { riskColor } from "../config/risk";
import type { AnalysisState } from "../state/analysisReducer";
import { MetaContext } from "../state/MetaContext";
import { META, predictResponse } from "../test/fixtures";
import { Legend } from "./Legend";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { ViewerPanel } from "./ViewerPanel";
import { ViewPresets } from "./ViewPresets";

// In the test environment there is no WebGL, so the panel shows the 2D schematic (F11).

function renderPanel(options: { predicted?: boolean; status?: AnalysisState["status"]; selected?: TargetId } = {}) {
  const handlers = { onRequestView: vi.fn(), onSelectTarget: vi.fn(), onHoverVessel: vi.fn() };
  render(
    <MetaContext.Provider value={META}>
      <ViewerPanel
        predictions={options.predicted === false ? null : predictResponse().predictions}
        status={options.status ?? "ready"}
        selectedTarget={options.selected ?? "cad"}
        hoveredVessel={null}
        viewRequest={null}
        {...handlers}
      />
    </MetaContext.Provider>,
  );
  return handlers;
}

const strokeOf = (name: RegExp) =>
  screen.getByRole("button", { name }).querySelector("path[data-run]")?.getAttribute("stroke");

describe("viewer panel without WebGL", () => {
  it("shows the schematic with each artery's estimate, colour and full name", () => {
    renderPanel();

    expect(strokeOf(/^LAD · Left Anterior Descending · 58%$/)).toBe(riskColor(0.581));
    expect(strokeOf(/^LCX · Left Circumflex · 22%$/)).toBe(riskColor(0.2207));
    expect(strokeOf(/^RCA · Right Coronary Artery · 44%$/)).toBe(riskColor(0.4402));
    expect(screen.getByText(/3D graphics are not available in this browser/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
  });

  it("shows grey arteries and says so before there is an estimate", () => {
    renderPanel({ predicted: false, status: "idle" });

    expect(strokeOf(/^LAD · Left Anterior Descending · no estimate$/)).toBe(riskColor(null));
  });

  it("selects the clicked artery, and CAD when the heart is clicked", () => {
    const { onSelectTarget } = renderPanel({ selected: "lad" });
    expect(screen.getByRole("button", { name: /^LAD/ }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /^RCA/ }));
    expect(onSelectTarget).toHaveBeenLastCalledWith("rca");
    fireEvent.click(document.querySelector('[data-part="heart"]')!);
    expect(onSelectTarget).toHaveBeenLastCalledWith("cad");
  });

  it("carries the legend, its exact note and the stand-in notice", () => {
    renderPanel();

    // PRODUCT_SPEC §9.3, copied on purpose.
    expect(
      screen.getByText(
        "Color shows each artery's model-estimated probability of ≥50% narrowing. It does not show where along the artery a narrowing might be.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Estimated probability of ≥50% narrowing")).toBeTruthy();
    expect(screen.getByText("No estimate")).toBeTruthy();
    expect(screen.getByText(/stylised shape and the artery courses are schematic/)).toBeTruthy();
  });

  it("shows when the estimates on display are not current", () => {
    renderPanel({ status: "predicting" });
    expect(screen.getByRole("status").textContent).toBe("Updating…");
  });
});

describe("viewer controls", () => {
  it("offers the five views", () => {
    const onRequestView = vi.fn();
    render(<ViewPresets onRequestView={onRequestView} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Front", "Back", "Left", "Right", "Reset view"]);
    buttons.forEach((button) => fireEvent.click(button));
    expect(onRequestView.mock.calls.map(([view]) => view)).toEqual(["front", "back", "left", "right", "reset"]);
    expect(screen.getByRole("button", { name: "View from the patient's left" })).toBeTruthy();
  });

  it("draws the legend scale from the risk colours", () => {
    const { container } = render(<Legend />);
    const scale = container.querySelector<HTMLElement>('[style*="linear-gradient"]');

    expect(scale).not.toBeNull();
    expect(container.textContent).toContain("0%50%100%");
  });
});

describe("heart model fallback (F11)", () => {
  function BrokenModel(): ReactNode {
    throw new Error("could not load /models/heart.glb");
  }

  it("renders the stand-in and reports the failure when the model cannot be loaded", () => {
    const onError = vi.fn();
    // React also reports the caught error on the console; keep that out of the test output.
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ModelErrorBoundary fallback={<p>stand-in heart</p>} onError={onError}>
        <BrokenModel />
      </ModelErrorBoundary>,
    );
    silence.mockRestore();

    expect(screen.getByText("stand-in heart")).toBeTruthy();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("renders the model when it loads", () => {
    render(
      <ModelErrorBoundary fallback={<p>stand-in heart</p>}>
        <p>detailed heart</p>
      </ModelErrorBoundary>,
    );

    expect(screen.getByText("detailed heart")).toBeTruthy();
    expect(screen.queryByText("stand-in heart")).toBeNull();
  });
});
