import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

// Copied from PRODUCT_SPEC §9.1 on purpose, so a change to the constant alone fails this test.
const DISCLAIMER_TEXT =
  "Educational and decision-support prototype. Estimates come from a model trained on a small public research dataset (303 patients). They are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.";

const tab = (name: string) => screen.getByRole("tab", { name });
const isSelected = (name: string) => tab(name).getAttribute("aria-selected") === "true";

describe("App shell", () => {
  it("shows the name, tagline and exact disclaimer text", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("CardioLens");
    expect(
      screen.getByText("Coronary risk estimates, mapped to the vessels they describe."),
    ).toBeTruthy();
    expect(screen.getByRole("note", { name: "Disclaimer" }).textContent).toBe(DISCLAIMER_TEXT);
  });

  it("opens on Patient analysis", () => {
    render(<App />);

    expect(isSelected("Patient analysis")).toBe(true);
    expect(isSelected("Model & method")).toBe(false);
    expect(screen.getByRole("tabpanel", { name: "Patient analysis" })).toBeTruthy();
  });

  it("switches tabs on click and keeps the disclaimer on both", () => {
    render(<App />);

    fireEvent.click(tab("Model & method"));

    expect(isSelected("Model & method")).toBe(true);
    expect(isSelected("Patient analysis")).toBe(false);
    expect(screen.getByRole("tabpanel", { name: "Model & method" })).toBeTruthy();
    expect(screen.queryByRole("tabpanel", { name: "Patient analysis" })).toBeNull();
    expect(screen.getByRole("note", { name: "Disclaimer" }).textContent).toBe(DISCLAIMER_TEXT);

    fireEvent.click(tab("Patient analysis"));

    expect(isSelected("Patient analysis")).toBe(true);
    expect(screen.getByRole("note", { name: "Disclaimer" }).textContent).toBe(DISCLAIMER_TEXT);
  });

  it("switches tabs with the arrow keys and moves focus", () => {
    render(<App />);

    fireEvent.keyDown(tab("Patient analysis"), { key: "ArrowRight" });

    expect(isSelected("Model & method")).toBe(true);
    expect(document.activeElement).toBe(tab("Model & method"));

    fireEvent.keyDown(tab("Model & method"), { key: "ArrowRight" });

    expect(isSelected("Patient analysis")).toBe(true);
    expect(document.activeElement).toBe(tab("Patient analysis"));
  });
});
