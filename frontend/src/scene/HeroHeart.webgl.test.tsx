// The Home page's heart when WebGL is available. As in ViewerPanel.webgl.test.tsx, the 3D scene
// is replaced by a stand-in that shows what it was given.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { riskColor } from "../config/risk";
import { MetaContext } from "../state/MetaContext";
import { META, predictResponse } from "../test/fixtures";
import type { HeartViewerProps } from "./HeartViewer";
import { HeroHeart } from "./HeroHeart";

let scene: HeartViewerProps | null = null;
let reducedMotion = false;

vi.mock("../utils/environment", () => ({ isWebGLAvailable: () => true, usePrefersReducedMotion: () => reducedMotion }));
vi.mock("./HeartViewer", () => ({
  default: (props: HeartViewerProps) => {
    scene = props;
    return <div data-testid="scene" />;
  },
}));

function renderHeart({ active = true, predicted = true }: { active?: boolean; predicted?: boolean } = {}) {
  const ui = (isActive: boolean) => (
    <MetaContext.Provider value={META}>
      <HeroHeart predictions={predicted ? predictResponse().predictions : null} active={isActive} />
    </MetaContext.Provider>
  );
  const view = render(ui(active));
  return { rerender: (isActive: boolean) => view.rerender(ui(isActive)) };
}

describe("the heart on the Home page", () => {
  it("turns without end, in the risk colours of the patient in analysis, and leaves the wheel to the page", async () => {
    reducedMotion = false;
    renderHeart();
    await screen.findByTestId("scene");

    expect(scene!.colors).toEqual({ lad: riskColor(0.581), lcx: riskColor(0.2207), rca: riskColor(0.4402) });
    expect(scene!.turning).toBe(true);
    expect(scene!.endlessTurn).toBe(true);
    expect(scene!.zoom).toBe(false);
    expect(scene!.selectedVessel).toBeNull();
  });

  it("labels each artery with its estimate and says the same in words", async () => {
    renderHeart();
    await screen.findByTestId("scene");

    const labels = Array.from(document.querySelectorAll<HTMLElement>("[data-hero-label]"));
    expect(labels.map((label) => label.textContent)).toEqual(["LAD 58%", "LCX 22%", "RCA 44%"]);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Turning heart with the three coronary arteries coloured by estimated probability. LAD 58%. LCX 22%. RCA 44%.",
    );
  });

  it("holds still for a visitor who asked for reduced motion", async () => {
    reducedMotion = true;
    renderHeart();
    await screen.findByTestId("scene");

    expect(scene!.turning).toBe(false);
    expect(scene!.reducedMotion).toBe(true);
    reducedMotion = false;
  });

  it("has no colours before there are estimates", async () => {
    renderHeart({ predicted: false });
    await screen.findByTestId("scene");

    expect(scene!.colors).toEqual({});
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("LAD no estimate");
  });

  it("exists only while the Home page is on screen", async () => {
    const { rerender } = renderHeart();
    await screen.findByTestId("scene");

    rerender(false);
    expect(screen.queryByTestId("scene")).toBeNull();

    rerender(true);
    expect(await screen.findByTestId("scene")).toBeTruthy();
  });
});
