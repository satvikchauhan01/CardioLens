import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOUR_STEPS } from "../../config/copy";
import { Tour } from "./Tour";

/** A page that has every part the tour points at, or none of them. */
function renderTour({ open = true, parts = true }: { open?: boolean; parts?: boolean } = {}) {
  const onClose = vi.fn();
  const ui = (isOpen: boolean) => (
    <>
      <button type="button">Take the tour</button>
      {parts && TOUR_STEPS.map((step) => <div key={step.target} data-tour={step.target} />)}
      <Tour open={isOpen} onClose={onClose} />
    </>
  );
  const view = render(ui(open));
  return { onClose, rerender: (isOpen: boolean) => view.rerender(ui(isOpen)) };
}

const note = () => screen.getByRole("dialog", { name: "Guided tour" });
const heading = () => screen.getByRole("heading", { level: 2 }).textContent;
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const light = () => document.querySelector<HTMLElement>("[data-tour-light]");

/** jsdom lays nothing out; this gives every part of the page a place on screen. */
function layOut() {
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: 100, left: 200, width: 300, height: 150, right: 500, bottom: 250, x: 200, y: 100, toJSON: () => ({}),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("guided tour", () => {
  it("shows nothing until it is started", () => {
    renderTour({ open: false });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on its first step, says where it is, and takes the focus", () => {
    renderTour();

    expect(note().textContent).toContain("Step 1 of 6");
    expect(heading()).toBe("The patient");
    expect(note().getAttribute("aria-describedby")).toBe("tour-text");
    expect(document.getElementById("tour-text")!.textContent).toBe(TOUR_STEPS[0].text);
    expect(document.activeElement).toBe(note());
    expect(button("Back").disabled).toBe(true);
  });

  it("walks through every step in order and ends with Finish", () => {
    const { onClose } = renderTour();
    const seen = [heading()];

    for (let step = 1; step < TOUR_STEPS.length; step += 1) {
      fireEvent.click(button("Next"));
      seen.push(heading());
    }

    expect(seen).toEqual([
      "The patient",
      "The heart carries the estimates",
      "Four estimates, four models",
      "Why this estimate",
      "What if?",
      "Compare with angiography",
    ]);
    expect(note().textContent).toContain("Step 6 of 6");
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(button("Finish"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("goes back a step, and moves with the arrow keys", () => {
    renderTour();

    fireEvent.click(button("Next"));
    fireEvent.click(button("Back"));
    expect(heading()).toBe("The patient");

    fireEvent.keyDown(note(), { key: "ArrowRight" });
    fireEvent.keyDown(note(), { key: "ArrowRight" });
    expect(heading()).toBe("Four estimates, four models");
    fireEvent.keyDown(note(), { key: "ArrowLeft" });
    expect(heading()).toBe("The heart carries the estimates");
  });

  it("ends when it is skipped or Escape is pressed", () => {
    const { onClose } = renderTour();

    fireEvent.click(button("Skip the tour"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(note(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("says the safety limits where they belong", () => {
    renderTour();

    fireEvent.click(button("Next"));
    expect(note().textContent).toContain("The colour does not show where along the artery a narrowing might be.");
    for (let step = 0; step < 3; step += 1) fireEvent.click(button("Next"));
    expect(note().textContent).toContain("This shows how the model responds, not the effect of a treatment.");
  });

  it("lights the part of the page the step is about", () => {
    layOut();
    renderTour();

    expect(light()!.dataset.tourLight).toBe("patient");
    // A little larger than the part itself.
    expect(light()!.style.top).toBe("94px");
    expect(light()!.style.left).toBe("194px");
    expect(light()!.style.width).toBe("312px");
    expect(light()!.style.height).toBe("162px");

    fireEvent.click(button("Next"));
    expect(light()!.dataset.tourLight).toBe("heart");
  });

  it("still explains a step whose part is not on the page", () => {
    renderTour({ parts: false });

    expect(light()).toBeNull();
    expect(heading()).toBe("The patient");
    fireEvent.click(button("Next"));
    expect(heading()).toBe("The heart carries the estimates");
  });

  it("keeps the focus within its note", () => {
    renderTour();
    fireEvent.click(button("Next"));
    const buttons = ["Skip the tour", "Back", "Next"].map(button);

    buttons[2].focus();
    fireEvent.keyDown(note(), { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);

    fireEvent.keyDown(note(), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons[2]);
  });

  it("starts again at the first step, and gives the focus back when it ends", () => {
    const { rerender } = renderTour({ open: false });
    const opener = button("Take the tour");
    opener.focus();

    rerender(true);
    fireEvent.click(button("Next"));
    expect(heading()).toBe("The heart carries the estimates");

    rerender(false);
    expect(document.activeElement).toBe(opener);

    rerender(true);
    expect(heading()).toBe("The patient");
  });
});
