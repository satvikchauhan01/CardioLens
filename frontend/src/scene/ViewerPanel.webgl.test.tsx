// The viewer panel when WebGL is available. The 3D scene itself cannot run in the test
// environment, so it is replaced by a stand-in that shows what the panel passes to it.

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { riskColor } from "../config/risk";
import { MetaContext } from "../state/MetaContext";
import { META, predictResponse } from "../test/fixtures";
import type { HeartViewerProps } from "./HeartViewer";
import { ViewerPanel } from "./ViewerPanel";

let scene: HeartViewerProps | null = null;

vi.mock("../utils/environment", () => ({ isWebGLAvailable: () => true, usePrefersReducedMotion: () => false }));
vi.mock("./HeartViewer", () => ({
  default: (props: HeartViewerProps) => {
    scene = props;
    return <div data-testid="scene" />;
  },
}));

function renderPanel(predicted = true) {
  const handlers = { onRequestView: vi.fn(), onSelectTarget: vi.fn(), onHoverVessel: vi.fn() };
  render(
    <MetaContext.Provider value={META}>
      <ViewerPanel
        predictions={predicted ? predictResponse().predictions : null}
        status="ready"
        selectedTarget="lcx"
        hoveredVessel="rca"
        viewRequest={null}
        {...handlers}
      />
    </MetaContext.Provider>,
  );
  return handlers;
}

const MODEL_NOTE =
  "The heart is a reference anatomy model, not this patient's heart. Only the three main arteries take a colour; their branches and the left main stem stay grey.";

describe("viewer panel with WebGL", () => {
  it("loads the 3D scene and gives it each artery's risk colour, the selection and the hover", async () => {
    renderPanel();
    expect(screen.getByRole("status").textContent).toBe("Loading the 3D viewer…");

    await screen.findByTestId("scene");

    expect(scene!.colors).toEqual({ lad: riskColor(0.581), lcx: riskColor(0.2207), rca: riskColor(0.4402) });
    expect(scene!.selectedVessel).toBe("lcx");
    expect(scene!.hoveredVessel).toBe("rca");
    expect(scene!.reducedMotion).toBe(false);
    expect(screen.queryByRole("group", { name: /Heart schematic/ })).toBeNull();
  });

  it("gives no colour to an artery without an estimate", async () => {
    renderPanel(false);
    await screen.findByTestId("scene");

    expect(scene!.colors).toEqual({});
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("LAD no estimate");
  });

  it("describes the picture in words and says what the heart model is", async () => {
    renderPanel();
    await screen.findByTestId("scene");

    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Heart with the three coronary arteries coloured by estimated probability. LAD 58%, moderate. LCX 22%, low. RCA 44%, moderate.",
    );
    expect(screen.getByText(MODEL_NOTE)).toBeTruthy();
    expect(screen.queryByText(/stylised shape/)).toBeNull();
    expect(screen.getByText("Drag to rotate · scroll to zoom · click an artery for its explanation")).toBeTruthy();
  });

  it("offers the view presets and a labels switch, with one label per artery", async () => {
    const { onRequestView } = renderPanel();
    await screen.findByTestId("scene");
    const labels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-label]"));

    expect(labels().map((label) => `${label.dataset.label}: ${label.textContent}`)).toEqual([
      "lad: LAD 58%", "lcx: LCX 22%", "rca: RCA 44%",
    ]);
    expect(scene!.labelElements.current).toEqual({ lad: labels()[0], lcx: labels()[1], rca: labels()[2] });

    fireEvent.click(screen.getByRole("button", { name: "View from the back" }));
    expect(onRequestView).toHaveBeenLastCalledWith("back");

    const toggle = screen.getByRole("checkbox", { name: "Labels" }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    expect(labels()[0].parentElement!.hidden).toBe(false);
    fireEvent.click(toggle);
    expect(labels()[0].parentElement!.hidden).toBe(true);
  });

  it("passes on what happens in the scene: selecting, and hovering with a tooltip", async () => {
    const { onSelectTarget, onHoverVessel } = renderPanel();
    await screen.findByTestId("scene");

    act(() => scene!.onSelectVessel("lad"));
    expect(onSelectTarget).toHaveBeenLastCalledWith("lad");
    act(() => scene!.onSelectHeart());
    expect(onSelectTarget).toHaveBeenLastCalledWith("cad");

    expect(screen.getByRole("tooltip", { hidden: true }).hidden).toBe(true);
    act(() => scene!.onHoverVessel("lad", { clientX: 120, clientY: 90 }));
    expect(onHoverVessel).toHaveBeenLastCalledWith("lad");
    expect(screen.getByRole("tooltip").textContent).toBe("LAD · Left Anterior Descending · 58%");

    act(() => scene!.onHoverVessel(null));
    expect(onHoverVessel).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("tooltip", { hidden: true }).hidden).toBe(true);
  });

  it("says so when the heart model cannot be used and the stand-in is drawn instead (F11)", async () => {
    renderPanel();
    await screen.findByTestId("scene");
    expect(screen.queryByText("Detailed heart model unavailable")).toBeNull();

    act(() => scene!.onModelError());

    await waitFor(() => expect(screen.getByText("Detailed heart model unavailable")).toBeTruthy());
    expect(screen.getByText(/stylised shape and the artery courses are schematic/)).toBeTruthy();
    expect(screen.queryByText(MODEL_NOTE)).toBeNull();
  });
});
