// The viewer panel when WebGL is available. The 3D scene itself cannot run in the test
// environment, so it is replaced by a stand-in that shows what the panel passes to it.

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { riskColor } from "../config/risk";
import { MetaContext } from "../state/MetaContext";
import { META, predictResponse } from "../test/fixtures";
import type { HeartViewerProps } from "./HeartViewer";
import { ViewerPanel } from "./ViewerPanel";

let scene: HeartViewerProps | null = null;
let sceneFails = false;

vi.mock("../utils/environment", () => ({ isWebGLAvailable: () => true, usePrefersReducedMotion: () => false }));
vi.mock("./HeartViewer", () => ({
  default: (props: HeartViewerProps) => {
    if (sceneFails) throw new Error("the graphics context could not be created");
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
  "The heart is a reference anatomy model, not this patient's heart, and its own colours carry no estimate. Each artery and its branches take the colour of that artery's estimate; the left main stem, which the LAD and the LCX share, stays grey.";

afterEach(() => {
  sceneFails = false;
  vi.restoreAllMocks();
});

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

  it("shows the 2D schematic when the 3D scene itself fails, and stays usable (F11)", async () => {
    sceneFails = true;
    // React also reports the caught error on the console; keep that out of the test output.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { onSelectTarget } = renderPanel();

    const schematic = await screen.findByRole("group", { name: /Heart schematic/ });

    expect(screen.getByText(/3D graphics are not available in this browser/)).toBeTruthy();
    expect(screen.getByText(/stylised shape and the artery courses are schematic/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Labels" })).toBeNull();
    fireEvent.click(within(schematic).getByRole("button", { name: /^LAD/ }));
    expect(onSelectTarget).toHaveBeenLastCalledWith("lad");
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

describe("the heart's own turn", () => {
  function renderTurning(props: { active?: boolean } = {}) {
    const ui = (viewRequest: { view: "front"; nonce: number } | null, active = props.active ?? true) => (
      <MetaContext.Provider value={META}>
        <ViewerPanel
          predictions={predictResponse().predictions}
          status="ready"
          selectedTarget="cad"
          hoveredVessel={null}
          viewRequest={viewRequest}
          active={active}
          onRequestView={vi.fn()}
          onSelectTarget={vi.fn()}
          onHoverVessel={vi.fn()}
        />
      </MetaContext.Provider>
    );
    const view = render(ui(null));
    return { rerender: (viewRequest: { view: "front"; nonce: number } | null, active?: boolean) => view.rerender(ui(viewRequest, active)) };
  }
  const toggle = () => screen.getByRole("button", { name: "Auto-rotate" });
  const stage = () => screen.getByRole("img").parentElement!;

  it("turns once around from the start and stops when the scene says it is done", async () => {
    renderTurning();
    await screen.findByTestId("scene");

    expect(scene!.turning).toBe(true);
    expect(scene!.endlessTurn ?? false).toBe(false);
    expect(toggle().getAttribute("aria-pressed")).toBe("true");

    act(() => scene!.onTurnDone!());
    expect(scene!.turning).toBe(false);
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
  });

  it("stops as soon as the heart is touched, and starts again on request", async () => {
    renderTurning();
    await screen.findByTestId("scene");

    fireEvent.pointerDown(stage());
    expect(scene!.turning).toBe(false);

    fireEvent.click(toggle());
    expect(scene!.turning).toBe(true);
    fireEvent.wheel(stage());
    expect(scene!.turning).toBe(false);

    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(scene!.turning).toBe(false);
  });

  it("holds still while an artery is under the pointer", async () => {
    renderTurning();
    await screen.findByTestId("scene");

    act(() => scene!.onHoverVessel("lad", { clientX: 120, clientY: 90 }));

    expect(scene!.turning).toBe(false);
  });

  it("stops when a view is asked for, by a button or by choosing a vessel in the list", async () => {
    const { rerender } = renderTurning();
    await screen.findByTestId("scene");
    expect(scene!.turning).toBe(true);

    rerender({ view: "front", nonce: 1 });

    expect(scene!.turning).toBe(false);
    expect(scene!.viewRequest).toEqual({ view: "front", nonce: 1 });
  });

  it("does not turn while another page is on screen", async () => {
    const { rerender } = renderTurning({ active: false });
    await screen.findByTestId("scene");
    expect(scene!.turning).toBe(false);
    // The switch still shows that it will turn.
    expect(toggle().getAttribute("aria-pressed")).toBe("true");

    rerender(null, true);
    expect(scene!.turning).toBe(true);
  });
});

describe("the rim colour of each artery", () => {
  it("is on each label, on the tooltip of the artery under the pointer, and named in the legend", async () => {
    renderPanel();
    await screen.findByTestId("scene");

    const labels = Array.from(document.querySelectorAll<HTMLElement>("[data-label]"));
    expect(labels.map((label) => label.style.borderLeftColor)).toEqual(["rgb(37, 99, 235)", "rgb(162, 28, 175)", "rgb(21, 128, 61)"]);

    act(() => scene!.onHoverVessel("lcx", { clientX: 120, clientY: 90 }));
    const dot = screen.getByRole("tooltip").querySelector<HTMLElement>("span")!;
    expect(dot.style.backgroundColor).toBe("rgb(162, 28, 175)");
    expect(screen.getByRole("tooltip").textContent).toBe("LCX · Left Circumflex · 22%");

    expect(document.querySelector("[data-rim-key]")!.textContent).toBe(
      "Rim colour names the artery:LAD (blue)LCX (magenta)RCA (green)The colour inside is its estimate.",
    );
  });

  it("keeps the risk colour inside: the scene is given the estimates' colours, not the rims'", async () => {
    renderPanel();
    await screen.findByTestId("scene");

    expect(Object.values(scene!.colors)).not.toContain("#2563eb");
    expect(scene!.colors.lad).toBe(riskColor(0.581));
  });
});
