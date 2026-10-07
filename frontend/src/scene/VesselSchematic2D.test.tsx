import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NO_ESTIMATE_COLOR, riskColor } from "../config/risk";
import type { VesselId } from "../config/vessels";
import { VesselSchematic2D, type SchematicVessel } from "./VesselSchematic2D";

const VESSELS: SchematicVessel[] = [
  { id: "lad", name: "LAD · Left Anterior Descending · 58%", label: "LAD 58%", color: riskColor(0.58) },
  { id: "lcx", name: "LCX · Left Circumflex · 22%", label: "LCX 22%", color: riskColor(0.22) },
  { id: "rca", name: "RCA · Right Coronary Artery · 91%", label: "RCA 91%", color: riskColor(0.91) },
];

function renderSchematic(overrides: { vessels?: SchematicVessel[]; selected?: VesselId | null; hovered?: VesselId | null } = {}) {
  const handlers = { onSelectVessel: vi.fn(), onSelectHeart: vi.fn(), onHoverVessel: vi.fn() };
  render(
    <VesselSchematic2D
      vessels={overrides.vessels ?? VESSELS}
      selectedVessel={overrides.selected ?? null}
      hoveredVessel={overrides.hovered ?? null}
      {...handlers}
    />,
  );
  return handlers;
}

const vessel = (name: RegExp) => screen.getByRole("button", { name });
const strokes = (element: Element, run?: "front" | "behind") =>
  Array.from(element.querySelectorAll(run ? `path[data-run="${run}"]` : "path[data-run]")).map((path) =>
    path.getAttribute("stroke"),
  );

describe("2D vessel schematic (F11)", () => {
  it("draws each artery in its risk colour with its label", () => {
    renderSchematic();

    expect(new Set(strokes(vessel(/^LAD/)))).toEqual(new Set([riskColor(0.58)]));
    expect(new Set(strokes(vessel(/^LCX/)))).toEqual(new Set([riskColor(0.22)]));
    expect(new Set(strokes(vessel(/^RCA/)))).toEqual(new Set([riskColor(0.91)]));
    expect(vessel(/^LAD/).querySelector("text")?.textContent).toBe("LAD 58%");
    expect(screen.getByRole("group", { name: /Heart schematic/ })).toBeTruthy();
  });

  it("draws the LAD in front and dashes the parts of LCX and RCA that run behind the heart", () => {
    renderSchematic();

    expect(strokes(vessel(/^LAD/), "behind")).toHaveLength(0);
    for (const name of [/^LCX/, /^RCA/]) {
      expect(strokes(vessel(name), "front").length).toBeGreaterThan(0);
      const behind = vessel(name).querySelectorAll('path[data-run="behind"]');
      expect(behind.length).toBeGreaterThan(0);
      behind.forEach((path) => expect(path.getAttribute("stroke-dasharray")).toBeTruthy());
    }
  });

  it("uses the neutral grey when there is no estimate", () => {
    renderSchematic({ vessels: VESSELS.map((item) => ({ ...item, color: null })) });

    expect(new Set(strokes(vessel(/^RCA/)))).toEqual(new Set([NO_ESTIMATE_COLOR]));
  });

  it("selects an artery by click or keyboard, and CAD by clicking the heart", () => {
    const { onSelectVessel, onSelectHeart } = renderSchematic();

    fireEvent.click(vessel(/^LCX/));
    expect(onSelectVessel).toHaveBeenLastCalledWith("lcx");
    fireEvent.keyDown(vessel(/^RCA/), { key: "Enter" });
    expect(onSelectVessel).toHaveBeenLastCalledWith("rca");
    fireEvent.keyDown(vessel(/^LAD/), { key: " " });
    expect(onSelectVessel).toHaveBeenLastCalledWith("lad");
    fireEvent.keyDown(vessel(/^LAD/), { key: "a" });
    expect(onSelectVessel).toHaveBeenCalledTimes(3);
    expect(vessel(/^LAD/).getAttribute("tabindex")).toBe("0");

    fireEvent.click(document.querySelector('[data-part="heart"]')!);
    expect(onSelectHeart).toHaveBeenCalledOnce();
  });

  it("marks the selected artery and outlines the selected or hovered one", () => {
    renderSchematic({ selected: "rca", hovered: "lad" });
    const outline = (element: Element) => element.querySelector('path[stroke="#0f172a"], path[stroke="#0369a1"]');

    expect(vessel(/^RCA/).getAttribute("aria-pressed")).toBe("true");
    expect(vessel(/^LAD/).getAttribute("aria-pressed")).toBe("false");
    expect(outline(vessel(/^RCA/))?.getAttribute("stroke")).toBe("#0f172a");
    expect(outline(vessel(/^LAD/))?.getAttribute("stroke")).toBe("#0369a1");
    expect(outline(vessel(/^LCX/))).toBeNull();
  });

  it("reports hover and focus so the list can highlight the same artery", () => {
    const { onHoverVessel } = renderSchematic();

    fireEvent.mouseEnter(vessel(/^LAD/));
    expect(onHoverVessel).toHaveBeenLastCalledWith("lad");
    fireEvent.mouseLeave(vessel(/^LAD/));
    expect(onHoverVessel).toHaveBeenLastCalledWith(null);
    fireEvent.focus(vessel(/^RCA/));
    expect(onHoverVessel).toHaveBeenLastCalledWith("rca");
    fireEvent.blur(vessel(/^RCA/));
    expect(onHoverVessel).toHaveBeenLastCalledWith(null);
  });
});
